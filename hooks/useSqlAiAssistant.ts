/**
 * useSqlAiAssistant — AI assistance orchestration for the SQL Editor
 *
 * Extracted from SqlEditor.tsx (Loop 3 of SqlEditor Pro refactor).
 *
 * Responsibilities:
 *   - handleAiGenerate(prompt)        NL → SQL (overwrites active tab)
 *   - handleAiFix()                   Auto-fix SQL that errored on last run
 *   - handleAiContinueOptimize(type)  Improve / explain / DuckDB-adapt
 *   - handleAiExplain()               Persisted Markdown explanation
 *   - handleAiFill(type)              Inject context-aware SQL template
 *   - handleAISuggestion(prompt)      Update code from a suggestion
 *
 * All state lives in the `useSqlEditorStore`. This hook just reads
 * selectors + invokes `aiService` + persists via store actions.
 */

import { useCallback } from 'react';
import { aiService } from '../services/aiService';
import { buildSchemaContext } from '../services/sqlContextBuilder';
import {
  getAllExplanations,
  saveExplanation,
} from '../services/aiExplanationStorage';
import { OPTIMIZATION_PROMPTS, FILL_PROMPTS, DEFAULT_FILL_PROMPT } from '../data/sqlAiPrompts';
import { useSqlEditorStore } from './store/useSqlEditorStore';
import type { ColumnInfo, SqlTab } from '../types';

const SCHEMA_TREE_SELECTOR = (s: { schemaTree: Record<string, ColumnInfo[]> }) =>
  s.schemaTree;

export interface UseSqlAiAssistantReturn {
  handleAiGenerate: () => Promise<void>;
  handleAiFix: () => Promise<void>;
  handleAiContinueOptimize: (type: 'improve' | 'explain' | 'adapt') => Promise<void>;
  handleAiExplain: () => Promise<void>;
  handleAIFill: () => void;
  handleAISuggestion: () => Promise<void>;
  handleAiOptimizeProfiling: (bottleneckInfo: string) => Promise<string | undefined>;
  generateAIFillPrompt: (
    sqlType: string,
    tableName?: string,
    columns?: ColumnInfo[]
  ) => string;
  generateFilledSql: (
    sqlType: string,
    tableName: string | null,
    columns: ColumnInfo[] | undefined
  ) => string;
  isAiLoading: boolean;
  isFixing: boolean;
}

export function useSqlAiAssistant(): UseSqlAiAssistantReturn {
  const isAiLoading = useSqlEditorStore((s) => s.isAiLoading);
  const isFixing = useSqlEditorStore((s) => s.isFixing);

  const handleAiGenerate = useCallback(async () => {
    const state = useSqlEditorStore.getState();
    if (!state.aiPrompt.trim()) return;
    state.setIsAiLoading(true);
    try {
      const schemaStr = await buildSchemaContext();
      const sql = await aiService.generateSql(state.aiPrompt, schemaStr);
      state.setAiOptimizationHistory((prev) => [...prev.slice(-4), { sql, timestamp: Date.now() }]);
      state.updateActiveTab({ code: sql });
    } catch (e) {
      console.error(e);
    } finally {
      state.setIsAiLoading(false);
    }
  }, []);

  const handleAiFix = useCallback(async () => {
    const state = useSqlEditorStore.getState();
    const tab = state.getActiveTab();
    if (!tab || !tab.result?.error) return;
    state.setIsFixing(true);
    try {
      const schemaStr = await buildSchemaContext();
      const fixedSql = await aiService.fixSql(tab.code, tab.result.error, schemaStr);
      state.updateActiveTab({ code: fixedSql });
    } catch (e) {
      console.error(e);
    } finally {
      state.setIsFixing(false);
    }
  }, []);

  const handleAiContinueOptimize = useCallback(
    async (type: 'improve' | 'explain' | 'adapt') => {
      const state = useSqlEditorStore.getState();
      const tab = state.getActiveTab();
      if (!tab || !tab.code.trim()) return;
      state.setIsAiLoading(true);
      try {
        const schemaStr = await buildSchemaContext();
        const promptFn = OPTIMIZATION_PROMPTS[type] || OPTIMIZATION_PROMPTS.improve;
        const aiResult = await aiService.generateSql(promptFn(tab.code), schemaStr);

        if (type === 'explain') {
          // Persist + open the explanation modal (caller renders the modal).
          const explanationRecord = {
            id: `explain_${Date.now()}`,
            sql: tab.code,
            explanation: aiResult,
            createdAt: Date.now(),
          };
          await saveExplanation(explanationRecord as any);
          const history = await getAllExplanations();
          state.setAiExplanationHistory(history);
          state.setAiExplanation(aiResult);
          state.setShowAiExplanation(true);
        } else {
          state.setAiOptimizationHistory((prev) => [
            ...prev.slice(-4),
            { sql: aiResult, timestamp: Date.now() },
          ]);
          state.updateActiveTab({ code: aiResult });
          state.showToast(
            type === 'improve' ? 'SQL 优化完成' : 'DuckDB 适配完成',
            'success'
          );
        }
      } catch (e) {
        console.error(e);
      } finally {
        state.setIsAiLoading(false);
      }
    },
    []
  );

  // Alias used by the toolbar (toolbar calls handleAiExplain which is the
  // same as handleAiContinueOptimize('explain')).
  const handleAiExplain = useCallback(
    () => handleAiContinueOptimize('explain'),
    [handleAiContinueOptimize]
  );

  /**
   * Build a context-aware SQL template based on the current table schema.
   * Used by the "AI 智能填充" button.
   */
  const generateFilledSql = useCallback(
    (sqlType: string, tableName: string | null, columns: ColumnInfo[] | undefined) => {
      const tbl = tableName || 'table_name';
      const hasCols = !!columns && columns.length > 0;
      const cols5 = hasCols ? (columns as ColumnInfo[]).slice(0, 5).map((c) => c.name) : ['col1', 'col2', 'col3'];
      const allCols = hasCols ? (columns as ColumnInfo[]).map((c) => c.name) : [];
      const timeCol = allCols.find((c) => /date|time|created|updated|ts|at/i.test(c)) || 'created_at';
      const numCol = allCols.find((c) => /amount|count|total|sum|value|price|qty/i.test(c)) || 'amount';
      const idCol = allCols.find((c) => /^id$|_id$/i.test(c)) || 'id';

      switch (sqlType) {
        case 'select':
          return hasCols
            ? `SELECT ${cols5.join(', ')}\nFROM ${tbl}\nWHERE 1=1\n  -- AND ${cols5[0]} = 'value'\nORDER BY ${idCol} DESC\nLIMIT 100;`
            : `SELECT column1, column2\nFROM ${tbl}\nWHERE condition\nORDER BY id DESC\nLIMIT 100;`;
        case 'join':
          return `SELECT\n    t1.${idCol},\n    t1.${cols5[0] || 'col1'},\n    t2.related_col\nFROM ${tbl} t1\nLEFT JOIN other_table t2\n    ON t1.${idCol} = t2.${tbl}_id\nWHERE t1.${timeCol} >= current_date - interval '30 day'\nLIMIT 100;`;
        case 'aggregate':
          return `SELECT\n    date_trunc('day', ${timeCol}) AS date,\n    COUNT(*)               AS row_count,\n    COUNT(DISTINCT ${idCol}) AS unique_count,\n    SUM(${numCol})         AS total_${numCol}\nFROM ${tbl}\nWHERE ${timeCol} >= current_date - interval '30 day'\nGROUP BY 1\nORDER BY 1 DESC;`;
        case 'transform':
          return `-- 数据转换 / 清洗示例\nSELECT\n    TRY_CAST(${timeCol} AS DATE)              AS date_clean,\n    TRIM(LOWER(${cols5[0] || 'text_col'}))    AS text_clean,\n    COALESCE(${numCol}, 0)                    AS ${numCol}_filled\nFROM ${tbl}\nWHERE ${numCol} IS NOT NULL;\n\n-- 列转行示例（UNPIVOT）\n-- UNPIVOT ${tbl}\n-- ON (${cols5.slice(0, 3).join(', ')})\n-- INTO NAME metric VALUE value;`;
        case 'performance':
          return `-- 执行计划诊断：在原始查询前加 EXPLAIN ANALYZE\nEXPLAIN ANALYZE\nSELECT ${cols5.slice(0, 3).join(', ')}\nFROM ${tbl}\nWHERE ${timeCol} >= current_date - interval '7 day'\nLIMIT 1000;\n\n-- 执行后在结果区点击「Plan」标签查看详细计划`;
        case 'utilities':
          return `-- 数据摘要统计（一行搞定）\nSUMMARIZE ${tbl};\n\n-- 数据质量检查\nSELECT 'null_check'   AS check_type, COUNT(*) FILTER (WHERE ${cols5[0] || 'col1'} IS NULL) AS issues FROM ${tbl}\nUNION ALL\nSELECT 'dup_check',   COUNT(*) - COUNT(DISTINCT ${idCol}) FROM ${tbl}\nUNION ALL\nSELECT 'total_rows',  COUNT(*) FROM ${tbl};\n\n-- 随机抽样 100 行（固定种子可重现）\n-- CALL setseed(0.42);\n-- SELECT * FROM ${tbl} USING SAMPLE 100 ROWS;`;
        default:
          return `SELECT * FROM ${tbl} LIMIT 10;`;
      }
    },
    []
  );

  const generateAIFillPrompt = useCallback(
    (sqlType: string, tableName?: string, columns?: ColumnInfo[]) => {
      const columnList = columns?.map((c) => `${c.name} (${c.type})`).join(', ') || '';
      const ctx = tableName
        ? `表: ${tableName}，字段: ${columnList || '未知'}`
        : '请先在左侧 Schema 选择一个表';
      const fn = FILL_PROMPTS[sqlType] || DEFAULT_FILL_PROMPT;
      return fn(tableName || '', ctx);
    },
    []
  );

  const handleAIFill = useCallback(() => {
    const state = useSqlEditorStore.getState();
    const tab = state.getActiveTab();
    if (!tab) return;
    const tableMatch = tab.code.match(/(?:FROM|INTO|UPDATE|TABLE)\s+"?([a-zA-Z0-9_]+)"?/i);
    const currentTable = tableMatch ? tableMatch[1] : '';
    const schemaTree = SCHEMA_TREE_SELECTOR(state);
    const currentColumns = currentTable ? schemaTree[currentTable] : undefined;
    const filled = generateFilledSql(state.selectedSqlType, currentTable, currentColumns);
    state.updateActiveTab({ code: filled });
    state.showToast(`已填充模板`, 'success');
  }, [generateFilledSql]);

  const handleAISuggestion = useCallback(async () => {
    const state = useSqlEditorStore.getState();
    if (!state.aiSuggestion.trim()) return;
    state.setIsGeneratingSuggestion(true);
    try {
      const schemaStr = await buildSchemaContext();
      const sql = await aiService.generateSql(state.aiSuggestion, schemaStr);
      state.updateActiveTab({ code: sql });
      state.setAiSuggestion('');
    } catch (e) {
      console.error(e);
    } finally {
      state.setIsGeneratingSuggestion(false);
    }
  }, []);

  const handleAiOptimizeProfiling = useCallback(async (bottleneckInfo: string): Promise<string | undefined> => {
    const state = useSqlEditorStore.getState();
    const tab = state.getActiveTab();
    if (!tab || !tab.code.trim()) return;
    state.setIsAiLoading(true);
    try {
      const schemaStr = await buildSchemaContext();
      const prompt = OPTIMIZATION_PROMPTS.diagnoseProfiling(tab.code, bottleneckInfo);
      const aiResult = await aiService.generateSql(prompt, schemaStr);
      return aiResult;
    } catch (e) {
      console.error(e);
      state.showToast('AI 优化诊断失败', 'warning');
    } finally {
      state.setIsAiLoading(false);
    }
  }, []);

  return {
    handleAiGenerate,
    handleAiFix,
    handleAiContinueOptimize,
    handleAiExplain,
    handleAIFill,
    handleAISuggestion,
    generateAIFillPrompt,
    generateFilledSql,
    handleAiOptimizeProfiling,
    isAiLoading,
    isFixing,
  };
}

export default useSqlAiAssistant;
