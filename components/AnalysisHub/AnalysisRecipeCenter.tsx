import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Zap, Play, Terminal, Sparkles, Download } from 'lucide-react';
import {
  analysisEngine,
  classifySemanticType,
  type RecipeMetadata,
} from './analysisEngine';
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

const RECIPES: RecipeMetadata[] = [
  {
    id: 'pareto',
    title: '帕累托 80/20 分析',
    badge: '价值集中度',
    description: '识别驱动 80% 产出的头部实体',
    applicableScenario: '客户价值 / 爆款 SKU / 资源倾斜',
    icon: 'TrendingUp',
    params: [
      {
        key: 'entityCol',
        label: '实体字段',
        description: '如 customer_id, product_name',
        type: 'column_select',
        filterType: 'any',
      },
      {
        key: 'metricCol',
        label: '价值度量',
        description: '如 revenue, amount',
        type: 'column_select',
        filterType: 'numeric',
      },
    ],
  },
  {
    id: 'rfm',
    title: 'RFM 价值分层',
    badge: '用户画像',
    description: '按 R/F/M 分层标记高价值与流失风险',
    applicableScenario: '精准营销 / 流失预警',
    icon: 'Users',
    params: [
      {
        key: 'userCol',
        label: '用户字段',
        description: '如 customer_id',
        type: 'column_select',
        filterType: 'any',
      },
      {
        key: 'dateCol',
        label: '时间字段',
        description: '如 order_date',
        type: 'column_select',
        filterType: 'temporal',
      },
      {
        key: 'amountCol',
        label: '金额字段',
        description: '如 amount',
        type: 'column_select',
        filterType: 'numeric',
      },
    ],
  },
  {
    id: 'iqr',
    title: 'IQR 离群探查',
    badge: '异常体检',
    description: 'Tukey 四分位距定位极端异常值',
    applicableScenario: '刷单 / 录入失误 / 慢查询',
    icon: 'AlertOctagon',
    params: [
      {
        key: 'numCol',
        label: '数值字段',
        description: '如 amount, latency',
        type: 'column_select',
        filterType: 'numeric',
      },
    ],
  },
  {
    id: 'histogram',
    title: '等宽分箱分布',
    badge: '离散分布',
    description: '连续数值按区间统计波峰与长尾',
    applicableScenario: '客单价 / 订单规模分段',
    icon: 'BarChart',
    params: [
      {
        key: 'numCol',
        label: '数值字段',
        description: '如 order_amount',
        type: 'column_select',
        filterType: 'numeric',
      },
      {
        key: 'bucketCount',
        label: '分箱数',
        description: '建议 6~12',
        type: 'select',
        options: [
          { label: '5 箱', value: 5 },
          { label: '8 箱', value: 8 },
          { label: '10 箱', value: 10 },
          { label: '12 箱', value: 12 },
        ],
        defaultValue: 8,
      },
    ],
  },
  {
    id: 'cohort',
    title: '群组留存观察',
    badge: '留存生命周期',
    description: '按首次激活月观察复购衰减',
    applicableScenario: '产品留存 / 获客质量',
    icon: 'Activity',
    params: [
      {
        key: 'userCol',
        label: '用户字段',
        description: '如 customer_id',
        type: 'column_select',
        filterType: 'any',
      },
      {
        key: 'dateCol',
        label: '行为时间',
        description: '如 order_date',
        type: 'column_select',
        filterType: 'temporal',
      },
    ],
  },
];

export const AnalysisRecipeCenter: React.FC<AnalysisRecipeCenterProps> = ({
  currentTable,
  schema,
  onInsertSql,
}) => {
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
          const idCol = schema.find(
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
    if (!currentTable) return;
    setLoading(true);
    setError(null);
    try {
      const res = await analysisEngine.executeRecipe(selectedRecipeId, currentTable, recipeParams);
      setGeneratedSql(res.sql);
      setRows(res.rows);
      setInsights(res.insights);
      setExecutionTimeMs(res.executionTimeMs);
    } catch (err: unknown) {
      console.error('[AnalysisRecipeCenter] Recipe execution failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setRows([]);
      setInsights([]);
      toastService.error(`配方计算失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [selectedRecipeId, currentTable, recipeParams]);

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

  const chartConfig: ChartConfig = useMemo(() => {
    const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
    if (selectedRecipeId === 'pareto') {
      return {
        id: 'pareto_chart',
        title: '帕累托累计贡献曲线',
        type: 'line',
        xKey: cols[0] || '实体标识',
        yKeys: [cols[3] || '累计贡献率_百分比'],
        showLegend: true,
        showValues: false,
      };
    }
    if (selectedRecipeId === 'histogram') {
      return {
        id: 'histogram_chart',
        title: '等宽区间频次分布',
        type: 'bar',
        xKey: cols[1] || '区间范围',
        yKeys: [cols[2] || '样本频次'],
        showLegend: true,
        showValues: false,
      };
    }
    if (selectedRecipeId === 'rfm' || selectedRecipeId === 'iqr') {
      return {
        id: 'recipe_chart',
        title: `${selectedRecipe.title} 分布`,
        type: 'bar',
        xKey: cols[0] || '',
        yKeys: cols.length > 1 ? [cols[1]] : [],
        showLegend: true,
        showValues: false,
      };
    }
    return {
      id: 'recipe_chart',
      title: `${selectedRecipe.title} 结果`,
      type: 'bar',
      xKey: cols[0] || '',
      yKeys: cols.length > 1 ? [cols[1]] : [],
      showLegend: true,
      showValues: false,
    };
  }, [selectedRecipeId, rows, selectedRecipe]);

  const showChart =
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
                    <option key={opt.value} value={opt.value}>
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

            {showChart && (
              <AnalysisChartRenderer data={rows} config={chartConfig} height={AH.chartHeight} />
            )}

            {selectedRecipeId === 'cohort' && rows.length > 0 && (
              <AnalysisEmptyHint message="群组留存以交叉表呈现；下方明细为各队列 × 周期的留存矩阵。" />
            )}

            <AnalysisResultTable
              columns={rows.length > 0 ? Object.keys(rows[0]) : []}
              rows={rows}
              title={`${selectedRecipe.title} 明细`}
              metaRight={`${executionTimeMs} ms`}
              emptyMessage="暂无配方输出，请检查字段映射后重试。"
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
