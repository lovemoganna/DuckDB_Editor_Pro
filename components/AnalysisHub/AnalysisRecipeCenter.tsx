import { useAnalysisUnit } from './AnalysisUnitSelector';
import { openAnalysis } from '../../hooks/store/useAnalysisWorkspace';
import { activeAnalysisDatabase } from '../../services/metricAssetStorage';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Zap, Play, Terminal, Sparkles, Download } from 'lucide-react';
import {
  executeRecipe,
  getRecipeList,
  classifySemanticType,
  type RecipeMetadata,
  type ChartSpec,
} from '../../services/analysis';
import { AnalysisChartRenderer } from './AnalysisChartRenderer';
import type { ColumnInfo, ChartConfig } from '../../types';
import { toastService } from '../../services/toastService';
import {
  AH,
  AnalysisLoadingState,
  AnalysisSubViewHeader,
  AnalysisResultTable,
  AnalysisEmptyHint,
  AnalysisErrorState,
  AnalysisSqlBar,
} from './analysisUi';

interface AnalysisRecipeCenterProps {
  currentTable: string;
  schema: ColumnInfo[];
  onInsertSql?: (sql: string, executeDirectly?: boolean) => void;
}

const RECIPES = getRecipeList();

export const AnalysisRecipeCenter: React.FC<AnalysisRecipeCenterProps> = ({
  currentTable,
  schema,
  onInsertSql,
}) => {
  const queryVersion = useRef(0);
  useEffect(() => () => { queryVersion.current++; }, []);
  const { column: unitColumn, unit: selectedUnit, selector: unitSelector } = useAnalysisUnit(currentTable, schema);
  const [selectedRecipeId, setSelectedRecipeId] = useState<RecipeMetadata['id']>('pareto');
  const [recipeParams, setRecipeParams] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [generatedSql, setGeneratedSql] = useState('');
  const [executionTimeMs, setExecutionTimeMs] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showSqlDrawer, setShowSqlDrawer] = useState(false);
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);
  const [chartSpec, setChartSpec] = useState<ChartSpec | null>(null);

  const selectedRecipe = useMemo(
    () => RECIPES.find(r => r.id === selectedRecipeId) || RECIPES[0],
    [selectedRecipeId],
  );

  const numericColumns = useMemo(
    () => schema.filter(c => classifySemanticType(c.name, c.type) === 'numeric').map(c => c.name),
    [schema],
  );

  const dateColumns = useMemo(
    () => schema.filter(c => classifySemanticType(c.name, c.type) === 'temporal').map(c => c.name),
    [schema],
  );

  useEffect(() => {
    if (!currentTable || schema.length === 0) return;
    const matched: Record<string, unknown> = {};
    selectedRecipe.params.forEach(p => {
      if (p.type === 'column_select') {
        if (p.filterType === 'numeric') {
          matched[p.key] = numericColumns[0] || schema[0]?.name || '';
        } else if (p.filterType === 'temporal') {
          matched[p.key] = dateColumns[0] || schema[0]?.name || '';
        } else {
          const idCol = schema.find(c => /^(uid|user_id|customer_id)$/i.test(c.name)) || schema.find(
            c =>
              c.name.toLowerCase().includes('id') || c.name.toLowerCase().includes('name'),
          );
          matched[p.key] = idCol ? idCol.name : schema[0]?.name || '';
        }
      } else if (p.type === 'select') {
        matched[p.key] = p.defaultValue ?? p.options?.[0]?.value;
      }
    });
    setRecipeParams(matched);
    setError(null);
  }, [currentTable, schema, selectedRecipe, numericColumns, dateColumns]);

  const handleRunRecipe = useCallback(async () => {
    if (!currentTable || unitColumn && !selectedUnit) return;
    const request = ++queryVersion.current;
    setLoading(true);
    setError(null);
    try {
      const res = await executeRecipe(selectedRecipeId, currentTable, { ...recipeParams, unitColumn, selectedUnit });
      if (request !== queryVersion.current) return;
      setGeneratedSql(res.sql);
      setRows(res.rows);
      setInsights(res.insights);
      setExecutionTimeMs(res.executionTimeMs);
      setChartConfig(res.chartConfig);
      setChartSpec(res.chart);
    } catch (err: unknown) {
      if (request !== queryVersion.current) return;
      console.error('[AnalysisRecipeCenter] Recipe execution failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setRows([]);
      setInsights([]);
      setChartConfig(null);
      setChartSpec(null);
      toastService.error(`配方计算失败: ${msg}`);
    } finally {
      if (request === queryVersion.current) setLoading(false);
    }
  }, [selectedRecipeId, currentTable, recipeParams, unitColumn, selectedUnit]);

  useEffect(() => {
    if (Object.keys(recipeParams).length > 0) {
      void handleRunRecipe();
    }
  }, [recipeParams, handleRunRecipe]);

  const handleCopySql = () => {
    if (!generatedSql) return;
    void navigator.clipboard.writeText(generatedSql);
    setCopied(true);
    toastService.success('配方 SQL 已复制');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInSqlEditor = () => {
    if (!generatedSql || !onInsertSql) return;
    onInsertSql(generatedSql, false);
    toastService.success('已带入 SQL 工作台');
  };

  const handleExportCsv = () => {
    if (rows.length === 0) return;
    const cols = Object.keys(rows[0]);
    const headers = cols.join(',');
    const csvRows = rows.map(row =>
      cols
        .map(col => {
          const val = row[col];
          if (val === null || val === undefined) return '';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(','),
    );
    const blob = new Blob([`${headers}\n${csvRows.join('\n')}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recipe_${selectedRecipeId}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toastService.success('已导出 CSV');
  };

  const showChart =
    !!chartConfig &&
    rows.length > 0 &&
    (selectedRecipeId === 'pareto' ||
      selectedRecipeId === 'histogram' ||
      selectedRecipeId === 'rfm' ||
      selectedRecipeId === 'iqr');

  if (!currentTable || schema.length === 0) {
    return (
      <div className={AH.pane}>
        <div className={AH.scrollBody}>
          <AnalysisEmptyHint message="请选择数据表后再运行业务配方。" />
        </div>
      </div>
    );
  }

  return (
    <div className={AH.pane}>
      <div className={AH.configBar}>
        <div className="flex gap-4 items-center mb-2">{unitSelector}<button disabled={!generatedSql || loading || Boolean(error)} className="text-xs text-monokai-cyan disabled:opacity-40" onClick={() => openAnalysis({databaseName:activeAnalysisDatabase(),title:chartConfig?.title || '场景分析',sql:generatedSql,chartConfig:chartConfig || undefined,sourceTables:[currentTable]})}>保存与复用本次分析</button></div>
        <AnalysisSubViewHeader
          icon={Zap}
          iconTone="yellow"
          title="业务分析场景配方"
          description="自动映射字段 · 帕累托 / RFM / IQR / 分箱 / 留存"
          actions={
            <>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={rows.length === 0}
                className={AH.btnGhost}
              >
                <Download className="h-3 w-3" aria-hidden="true" />
                导出 CSV
              </button>
              <button
                type="button"
                onClick={handleOpenInSqlEditor}
                disabled={!generatedSql || !onInsertSql}
                className={AH.btnWarning}
              >
                <Terminal className="h-3 w-3" aria-hidden="true" />
                打开 SQL
              </button>
            </>
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
          {RECIPES.map(recipe => (
            <button
              key={recipe.id}
              type="button"
              onClick={() => setSelectedRecipeId(recipe.id)}
              className={`flex flex-col text-left p-2 transition-colors cursor-pointer ${
                selectedRecipeId === recipe.id
                  ? `${AH.card} border-monokai-border-strong`
                  : `${AH.cardMuted} hover:border-monokai-border-strong`
              }`}
            >
              <span className={`${AH.badge} text-monokai-orange border-monokai-orange/30 mb-1 w-fit`}>
                {recipe.badge}
              </span>
              <span className="text-meta font-semibold text-monokai-fg line-clamp-1">
                {recipe.title}
              </span>
              <span className="text-2xs text-monokai-comment mt-0.5 line-clamp-1">
                {recipe.applicableScenario}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-b border-monokai-border bg-monokai-bg/80 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-2xs font-mono text-monokai-comment font-semibold">
            映射 [{currentTable}]
          </span>
          {selectedRecipe.params.map(p => (
            <div key={p.key} className="flex items-center gap-1">
              <span className="text-2xs text-monokai-fg/80 font-mono">{p.label}</span>
              {p.type === 'column_select' ? (
                <select
                  value={String(recipeParams[p.key] || '')}
                  onChange={e => setRecipeParams({ ...recipeParams, [p.key]: e.target.value })}
                  className={`${AH.select} text-monokai-cyan`}
                >
                  {schema.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={String(recipeParams[p.key] ?? '')}
                  onChange={e =>
                    setRecipeParams({
                      ...recipeParams,
                      [p.key]: Number(e.target.value) || e.target.value,
                    })
                  }
                  className={AH.select}
                >
                  {p.options?.map(opt => (
                    <option key={String(opt.value)} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleRunRecipe}
          disabled={loading}
          className={AH.btnSuccess}
        >
          <Play className={`h-3 w-3 ${loading ? 'animate-pulse' : ''}`} aria-hidden="true" />
          {loading ? '运行中…' : '运行配方'}
        </button>
      </div>

      <div className={`${AH.scrollBody} flex flex-col gap-2.5`}>
        {error ? (
          <AnalysisErrorState title="配方执行异常" message={error} onRetry={handleRunRecipe} />
        ) : loading ? (
          <AnalysisLoadingState message={`正在执行 ${selectedRecipe.title}…`} />
        ) : (
          <>
            {insights.length > 0 && (
              <div className={`${AH.card} p-2.5 flex flex-col gap-2`}>
                <div className="flex items-center gap-1.5 text-2xs font-bold text-monokai-yellow uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>业务洞察</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
                  {insights.map((txt, idx) => (
                    <div key={idx} className={`${AH.quote} text-meta`}>
                      <span className="font-mono text-monokai-orange mr-1 font-bold">#{idx + 1}</span>
                      {txt}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showChart && chartConfig && (
              <AnalysisChartRenderer
                data={rows}
                config={chartConfig}
                chartSpec={chartSpec}
                height={AH.chartHeight}
              />
            )}

            {selectedRecipeId === 'cohort' && rows.length > 0 && (
              <AnalysisEmptyHint message="群组留存以交叉表呈现；下方明细为各队列 × 周期的留存矩阵。" />
            )}

            <AnalysisResultTable
              columns={rows.length > 0 ? Object.keys(rows[0]) : []}
              rows={rows}
              title={`${selectedRecipe.title} 明细`}
              metaRight={`${executionTimeMs} ms`}
              emptyMessage={selectedRecipeId === 'iqr' && insights.length ? '未发现超出 IQR 范围的记录。' : '暂无配方输出，请检查字段映射后重试。'}
            />
          </>
        )}
      </div>

      <AnalysisSqlBar
        sql={generatedSql}
        open={showSqlDrawer}
        onToggle={() => setShowSqlDrawer(v => !v)}
        onCopy={handleCopySql}
        copied={copied}
      />
    </div>
  );
};
