/**
 * useSqlAiAssistant — Context-Aware AI Co-pilot orchestration for the SQL Editor
 *
 * Responsibilities:
 *   - executeCapability(cap)          Universal execution driver for Knowledge AI Capabilities
 *   - handleAiGenerate(prompt)        NL → SQL (Opens Diff review if code exists)
 *   - handleAiFix()                   Auto-diagnose & fix SQL error (Opens Diff Proposal Modal)
 *   - handleAiContinueOptimize(type)  Performance / Dialect optimization (Opens Diff Proposal Modal)
 *   - handleAiExplain()               Markdown explanation
 *   - handleAiResultInsight()         Result set business insights & anomaly detector
 *   - handleAIFill(type)              Inject context-aware SQL template
 *
 * All actions prioritize AI Safety & User Confirmation:
 * Modifying actions pop up the `AiDiffProposalModal` instead of silent overwrites.
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
import { useAppStore } from './store/useAppStore';
import { AiCapabilityDefinition } from '../services/aiCapabilitiesStorage';
import type { ColumnInfo, QueryResult } from '../types';

export interface UseSqlAiAssistantReturn {
  executeCapability: (cap: AiCapabilityDefinition) => Promise<void>;
  handleAiGenerate: () => Promise<void>;
  handleAiFix: () => Promise<void>;
  handleAiContinueOptimize: (type: 'improve' | 'explain' | 'adapt') => Promise<void>;
  handleAiExplain: () => Promise<void>;
  handleAiResultInsight: () => Promise<void>;
  handleAIFill: () => void;
  handleAISuggestion: () => Promise<void>;
  handleAiOptimizeProfiling: (bottleneckInfo: string) => Promise<string | undefined>;
  cancelAiRequest: () => void;
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

  /**
   * Universal execution driver connecting Knowledge AI Capabilities to active SQL Editor context
   */
  const executeCapability = useCallback(async (cap: AiCapabilityDefinition) => {
    const state = useSqlEditorStore.getState();
    const tab = state.getActiveTab();
    state.setIsAiLoading(true);
    try {
      const currentSql = tab?.code || '';
      const schemaStr = await buildSchemaContext(currentSql, 5);
      const errorMessage = tab?.result?.error || '无分析报错';
      const rowCount = tab?.result?.rows.length || 0;
      const columns = (tab?.result?.columns || []).join(', ');
      const sampleData = JSON.stringify((tab?.result?.rows || []).slice(0, 10), null, 2);

      let substitutedPrompt = cap.promptTemplate
        .replace(/\{currentSql\}/g, currentSql)
        .replace(/\{schemaContext\}/g, schemaStr)
        .replace(/\{errorMessage\}/g, errorMessage)
        .replace(/\{rowCount\}/g, String(rowCount))
        .replace(/\{columns\}/g, columns)
        .replace(/\{sampleData\}/g, sampleData);

      if (substitutedPrompt.includes('{userPrompt}')) {
        state.setIsAiLoading(false);
        state.setAiCapabilityPromptModal({
          isOpen: true,
          capability: cap,
          substitutedPrompt,
          schemaContext: schemaStr,
        });
        return;
      }

      const response = await aiService.generateSql(substitutedPrompt, schemaStr);

      if (response.startsWith('-- Error generating SQL:')) {
        const errorDetail = response.replace('-- Error generating SQL:', '').trim();
        state.showToast(`AI 执行失败: ${errorDetail}`, 'warning');
        if (errorDetail.includes('API Key not configured')) {
          useAppStore.getState().setShowSettingsModal(true);
        }
        return;
      }

      if (cap.category === 'insight') {
        // Open Markdown insights report modal
        state.setAiResultInsights({
          isOpen: true,
          result: tab?.result || null,
          insightMarkdown: response,
          isLoading: false,
        });
      } else {
        // Open Diff Proposal Safety Modal for SQL modifications
        state.setAiProposal({
          isOpen: true,
          title: `🤖 AI 能力执行: ${cap.name}`,
          explanation: cap.description,
          originalSql: currentSql,
          proposedSql: response.replace(/```sql|```/g, '').trim(),
        });
      }
    } catch (e: any) {
      console.error(e);
      state.showToast(`AI 能力执行失败: ${e.message || e}`, 'warning');
      if (e.message?.includes('API Key not configured')) {
        useAppStore.getState().setShowSettingsModal(true);
      }
    } finally {
      state.setIsAiLoading(false);
    }
  }, []);

  const handleAiGenerate = useCallback(async () => {
    const state = useSqlEditorStore.getState();
    if (!state.aiPrompt.trim()) return;
    const tab = state.getActiveTab();
    state.setIsAiLoading(true);
    try {
      const schemaStr = await buildSchemaContext(state.aiPrompt, 5);
      const generatedSql = await aiService.generateSql(state.aiPrompt, schemaStr);
      
      if (tab && tab.code.trim()) {
        state.setAiProposal({
          isOpen: true,
          title: '✨ AI 自然语言生成 SQL 确认',
          explanation: `基于需求: "${state.aiPrompt}" 生成的 DuckDB SQL 代码。`,
          originalSql: tab.code,
          proposedSql: generatedSql,
        });
      } else {
        state.updateActiveTab({ code: generatedSql });
        state.showToast('已由 AI 生成 SQL 代码', 'success');
      }
    } catch (e: any) {
      console.error(e);
      state.showToast(`AI 生成失败: ${e.message || e}`, 'warning');
    } finally {
      state.setIsAiLoading(false);
    }
  }, []);

  const cancelAiRequest = useCallback(() => {
    const state = useSqlEditorStore.getState();
    if (aiService.cancelActiveRequest()) {
      state.showToast('AI 请求已取消', 'warning');
    }
    state.setIsAiLoading(false);
    state.setIsFixing(false);
    state.setIsGeneratingSuggestion(false);
  }, []);

  const handleAiFix = useCallback(async () => {
    const state = useSqlEditorStore.getState();
    const tab = state.getActiveTab();
    if (!tab || !tab.result?.error) {
      state.showToast('当前查询无错误日志', 'info');
      return;
    }
    state.setIsFixing(true);
    try {
      const schemaStr = await buildSchemaContext(tab.code, 5);
      const fixedSql = await aiService.fixSql(tab.code, tab.result.error, schemaStr);
      
      state.setAiProposal({
        isOpen: true,
        title: '🛠️ AI 错误智能诊断与修复提案',
        explanation: `针对错误: "${tab.result.error.slice(0, 150)}..." 进行智能修复推导。`,
        originalSql: tab.code,
        proposedSql: fixedSql,
      });
    } catch (e: any) {
      console.error(e);
      state.showToast(`AI 诊断修复失败: ${e.message || e}`, 'warning');
    } finally {
      state.setIsFixing(false);
    }
  }, []);

  const handleAiContinueOptimize = useCallback(
    async (type: 'improve' | 'explain' | 'adapt') => {
      const state = useSqlEditorStore.getState();
      const tab = state.getActiveTab();
      if (!tab || !tab.code.trim()) {
        state.showToast('请先输入要解释或优化的 SQL 代码', 'warning');
        return;
      }
      state.setIsAiLoading(true);
      try {
        const schemaStr = await buildSchemaContext(tab.code, 5);
        const promptFn = OPTIMIZATION_PROMPTS[type] || OPTIMIZATION_PROMPTS.improve;
        const aiResult = await aiService.generateSql(promptFn(tab.code), schemaStr);

        if (type === 'explain') {
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
          state.setAiProposal({
            isOpen: true,
            title: type === 'improve' ? 'AI 性能与重构优化提案' : 'DuckDB 方言与写法适配提案',
            explanation: type === 'improve' ? '优化了 JOIN 条件与 CTE 结构以提升 DuckDB 引擎查询性能。' : '根据 DuckDB 最新方言标准对语法进行了兼容性重构。',
            originalSql: tab.code,
            proposedSql: aiResult,
          });
        }
      } catch (e: any) {
        console.error(e);
        state.showToast(`AI 优化处理失败: ${e.message || e}`, 'warning');
      } finally {
        state.setIsAiLoading(false);
      }
    },
    []
  );

  const handleAiExplain = useCallback(
    () => handleAiContinueOptimize('explain'),
    [handleAiContinueOptimize]
  );

  const handleAiResultInsight = useCallback(async () => {
    const state = useSqlEditorStore.getState();
    const tab = state.getActiveTab();
    if (!tab || !tab.result || tab.result.rows.length === 0) {
      state.showToast('暂无查询结果集可进行 AI 分析', 'warning');
      return;
    }

    const res = tab.result;
    state.setAiResultInsights({
      isOpen: true,
      result: res,
      insightMarkdown: '',
      isLoading: true,
    });

    try {
      const topRowsPreview = JSON.stringify(res.rows.slice(0, 10), null, 2);
      const prompt = `请对以下 DuckDB 查询结果集进行专业的数据分析与业务解读：
SQL 查询: ${tab.code}
字段维度: ${res.columns.join(', ')}
总行数: ${res.rows.length}
前 10 行样例数据:
${topRowsPreview}

请生成包含【数据概览】、【业务结论】、【潜在异常/极值提醒】与【后续数据下钻建议】的 Markdown 分析报告。`;

      const insight = await aiService.generateSql(prompt, `Columns: ${res.columns.join(', ')}`);
      state.setAiResultInsights({
        isOpen: true,
        result: res,
        insightMarkdown: insight,
        isLoading: false,
      });
    } catch (e: any) {
      state.showToast(`AI 分析生成失败: ${e.message || e}`, 'warning');
      state.setAiResultInsights(null);
    }
  }, []);

  const generateAIFillPrompt = useCallback(
    (sqlType: string, tableName?: string, columns?: ColumnInfo[]) => {
      const fn = FILL_PROMPTS[sqlType] || DEFAULT_FILL_PROMPT;
      const colStr = columns && columns.length > 0 ? `相关字段: ${columns.map((c) => c.name).join(', ')}` : '';
      return fn(tableName || 'table_name', colStr);
    },
    []
  );

  const generateFilledSql = useCallback(
    (sqlType: string, tableName: string | null, columns: ColumnInfo[] | undefined) => {
      const tbl = tableName || 'table_name';
      const hasCols = !!columns && columns.length > 0;
      const cols5 = hasCols ? (columns as ColumnInfo[]).slice(0, 5).map((c) => c.name) : ['col1', 'col2', 'col3'];

      switch (sqlType) {
        case 'select':
          return `SELECT ${cols5.join(', ')}\nFROM "${tbl}"\nLIMIT 50;`;
        case 'join':
          return `SELECT t1.*, t2.*\nFROM "${tbl}" t1\nLEFT JOIN "other_table" t2 ON t1.id = t2.id\nLIMIT 50;`;
        case 'aggregate':
          return `SELECT ${cols5[0]}, COUNT(*) AS cnt, AVG(${cols5[1] || cols5[0]}) AS avg_val\nFROM "${tbl}"\nGROUP BY ${cols5[0]}\nORDER BY cnt DESC\nLIMIT 20;`;
        case 'transform':
          return `SELECT\n  COALESCE(${cols5[0]}, 'N/A') AS clean_${cols5[0]},\n  UPPER(${cols5[1] || cols5[0]}) AS formatted_col\nFROM "${tbl}";`;
        case 'performance':
          return `EXPLAIN ANALYZE\nSELECT ${cols5.join(', ')}\nFROM "${tbl}"\nWHERE ${cols5[0]} IS NOT NULL;`;
        default:
          return `SELECT * FROM "${tbl}" LIMIT 50;`;
      }
    },
    []
  );

  const handleAIFill = useCallback(() => {
    const state = useSqlEditorStore.getState();
    const tab = state.getActiveTab();
    if (!tab) return;

    const tables = Object.keys(state.schemaTree);
    const tableMatch = tab.code.match(/(?:FROM|INTO|UPDATE|TABLE)\s+"?([a-zA-Z0-9_.]+)"?/i);
    const detectedTable = tableMatch?.[1] || tables[0] || 'table_name';
    const cols = state.schemaTree[detectedTable];

    const newSql = generateFilledSql(state.selectedSqlType, detectedTable, cols);
    state.updateActiveTab({ code: newSql });
    state.showToast(`已生成 ${state.selectedSqlType} 智能模版 (${detectedTable})`, 'success');
  }, [generateFilledSql]);

  const handleAISuggestion = useCallback(async () => {
    const state = useSqlEditorStore.getState();
    const tab = state.getActiveTab();
    if (!tab || !tab.code.trim()) return;

    state.setIsGeneratingSuggestion(true);
    try {
      const schemaStr = await buildSchemaContext(tab.code, 5);
      const suggestion = await aiService.generateSql(
        `请为以下 SQL 提供优化补充建议:\n${tab.code}`,
        schemaStr
      );
      state.setAiSuggestion(suggestion);
    } catch (e: any) {
      console.error(e);
      state.showToast(`AI 建议生成失败: ${e.message || e}`, 'warning');
    } finally {
      state.setIsGeneratingSuggestion(false);
    }
  }, []);

  const handleAiOptimizeProfiling = useCallback(
    async (bottleneckInfo: string): Promise<string | undefined> => {
      const state = useSqlEditorStore.getState();
      const tab = state.getActiveTab();
      if (!tab || !tab.code.trim()) return undefined;

      state.setIsAiLoading(true);
      try {
        const schemaStr = await buildSchemaContext(tab.code, 5);
        const prompt = `已知 DuckDB 查询分析信息:\n${bottleneckInfo}\n\n当前 SQL:\n${tab.code}\n\n请针对全表扫描或算子瓶颈给出优化建议。`;
        const result = await aiService.generateSql(prompt, schemaStr);
        return result;
      } catch (e: any) {
        console.error(e);
        state.showToast(`性能诊断优化失败: ${e.message || e}`, 'warning');
        return undefined;
      } finally {
        state.setIsAiLoading(false);
      }
    },
    []
  );

  return {
    executeCapability,
    handleAiGenerate,
    handleAiFix,
    handleAiContinueOptimize,
    handleAiExplain,
    handleAiResultInsight,
    handleAIFill,
    handleAISuggestion,
    handleAiOptimizeProfiling,
    cancelAiRequest,
    generateAIFillPrompt,
    generateFilledSql,
    isAiLoading,
    isFixing,
  };
}
