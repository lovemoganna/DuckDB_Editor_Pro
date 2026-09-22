import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Zap,
  Play,
  Terminal,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  PieChart,
  Activity,
  AlertOctagon,
  BarChart,
  Users,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import {
  analysisEngine,
  classifySemanticType,
  type RecipeMetadata,
} from './analysisEngine';
import { AnalysisChartRenderer } from './AnalysisChartRenderer';
import type { ColumnInfo, ChartConfig } from '../../types';
import { toastService } from '../../services/toastService';
import { ActionButton } from '../ui/Workbench';

interface AnalysisRecipeCenterProps {
  currentTable: string;
  schema: ColumnInfo[];
  onInsertSql?: (sql: string, executeDirectly?: boolean) => void;
}

const RECIPES: RecipeMetadata[] = [
  {
    id: 'pareto',
    title: '二八帕累托法则分析 (Pareto 80/20)',
    badge: '价值集中度',
    description: '识别驱动全盘 80% 业务产出的 20% 头部核心实体（大客户、爆款商品等）',
    applicableScenario: '客户价值分级、滞销/爆款 SKU 识别、资源倾斜策略',
    icon: 'TrendingUp',
    params: [
      { key: 'entityCol', label: '实体标识字段', description: '如 customer_id, product_name', type: 'column_select', filterType: 'any' },
      { key: 'metricCol', label: '价值贡献度量', description: '如 revenue, amount, quantity', type: 'column_select', filterType: 'numeric' },
    ],
  },
  {
    id: 'rfm',
    title: 'RFM 客户/实体价值分层模型',
    badge: '用户画像',
    description: '基于消费间隔 (R)、频次 (F)、消费金额 (M) 分层，自动标记高价值/流失风险客户',
    applicableScenario: '高价值客户识别、精准营销召回、客户流失预警',
    icon: 'Users',
    params: [
      { key: 'userCol', label: '用户/实体字段', description: '如 customer_id, user_id', type: 'column_select', filterType: 'any' },
      { key: 'dateCol', label: '消费时间字段', description: '如 order_date, created_at', type: 'column_select', filterType: 'temporal' },
      { key: 'amountCol', label: '消费金额字段', description: '如 amount, revenue, total_price', type: 'column_select', filterType: 'numeric' },
    ],
  },
  {
    id: 'iqr',
    title: '箱线图 IQR 离群异常值探查',
    badge: '异常体检',
    description: '基于 Tukey 四分位距算法（Q1/Q3/1.5*IQR）自动甄别并定位极端异常值记录',
    applicableScenario: '刷单检测、金额录入失误、极端耗时/慢查询排查',
    icon: 'AlertOctagon',
    params: [
      { key: 'numCol', label: '目标数值字段', description: '如 amount, latency, price', type: 'column_select', filterType: 'numeric' },
    ],
  },
  {
    id: 'histogram',
    title: '等宽数值分布分箱 (Histograms)',
    badge: '离散分布',
    description: '将连续数值按离散等宽区间分箱统计，探查数据集中波峰与长尾分布',
    applicableScenario: '客单价区间、订单规模分布、用户年龄/时长分段',
    icon: 'BarChart',
    params: [
      { key: 'numCol', label: '待分箱数值字段', description: '如 order_amount, score', type: 'column_select', filterType: 'numeric' },
      {
        key: 'bucketCount',
        label: '划分区间数',
        description: '建议 6 ~ 12 个分箱',
        type: 'select',
        options: [
          { label: '5 个分箱', value: 5 },
          { label: '8 个分箱 (推荐)', value: 8 },
          { label: '10 个分箱', value: 10 },
          { label: '12 个分箱', value: 12 },
        ],
        defaultValue: 8,
      },
    ],
  },
  {
    id: 'cohort',
    title: '用户群组与留存队列观察',
    badge: '留存生命周期',
    description: '按用户首次激活月份分组，观察后续各月的复购与活跃留存衰减轨迹',
    applicableScenario: '产品留存分析、获客质量评估、LTV 生命周期预测',
    icon: 'Activity',
    params: [
      { key: 'userCol', label: '用户标识字段', description: '如 customer_id, user_id', type: 'column_select', filterType: 'any' },
      { key: 'dateCol', label: '行为时间字段', description: '如 order_date, event_time', type: 'column_select', filterType: 'temporal' },
    ],
  },
];

export const AnalysisRecipeCenter: React.FC<AnalysisRecipeCenterProps> = ({
  currentTable,
  schema,
  onInsertSql,
}) => {
  const [selectedRecipeId, setSelectedRecipeId] = useState<RecipeMetadata['id']>('pareto');
  const [recipeParams, setRecipeParams] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [rows, setRows] = useState<any[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [generatedSql, setGeneratedSql] = useState<string>('');
  const [executionTimeMs, setExecutionTimeMs] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  const selectedRecipe = useMemo(() => {
    return RECIPES.find(r => r.id === selectedRecipeId) || RECIPES[0];
  }, [selectedRecipeId]);

  // Available column classifications
  const numericColumns = useMemo(() => {
    return schema.filter(c => classifySemanticType(c.name, c.type) === 'numeric').map(c => c.name);
  }, [schema]);

  const dateColumns = useMemo(() => {
    return schema.filter(c => classifySemanticType(c.name, c.type) === 'temporal').map(c => c.name);
  }, [schema]);

  // Smart auto-match columns for the recipe
  useEffect(() => {
    if (!currentTable || schema.length === 0) return;

    const matched: Record<string, any> = {};
    selectedRecipe.params.forEach(p => {
      if (p.type === 'column_select') {
        if (p.filterType === 'numeric') {
          matched[p.key] = numericColumns[0] || schema[0]?.name || '';
        } else if (p.filterType === 'temporal') {
          matched[p.key] = dateColumns[0] || schema[0]?.name || '';
        } else {
          // any / entity
          const idCol = schema.find(c => c.name.toLowerCase().includes('id') || c.name.toLowerCase().includes('name'));
          matched[p.key] = idCol ? idCol.name : schema[0]?.name || '';
        }
      } else if (p.type === 'select') {
        matched[p.key] = p.defaultValue ?? p.options?.[0]?.value;
      }
    });

    setRecipeParams(matched);
  }, [currentTable, schema, selectedRecipeId, numericColumns, dateColumns]);

  // Execute recipe
  const handleRunRecipe = useCallback(async () => {
    if (!currentTable) return;
    setLoading(true);
    try {
      const res = await analysisEngine.executeRecipe(selectedRecipeId, currentTable, recipeParams);
      setGeneratedSql(res.sql);
      setRows(res.rows);
      setInsights(res.insights);
      setExecutionTimeMs(res.executionTimeMs);
    } catch (err: any) {
      console.error('[AnalysisRecipeCenter] Recipe execution failed:', err);
      toastService.error(`配方计算执行失败: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [selectedRecipeId, currentTable, recipeParams]);

  // Run automatically on param match
  useEffect(() => {
    if (Object.keys(recipeParams).length > 0) {
      void handleRunRecipe();
    }
  }, [recipeParams, handleRunRecipe]);

  const handleCopySql = () => {
    if (!generatedSql) return;
    navigator.clipboard.writeText(generatedSql);
    setCopied(true);
    toastService.success('配方 SQL 已复制！');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInSqlEditor = () => {
    if (!generatedSql) return;
    if (onInsertSql) {
      onInsertSql(generatedSql, false);
      toastService.success('已带入 SQL 工作台！');
    }
  };

  // Build chart config depending on recipe
  const chartConfig: ChartConfig = useMemo(() => {
    const cols = rows.length > 0 ? Object.keys(rows[0]) : [];

    if (selectedRecipeId === 'pareto') {
      return {
        id: 'pareto_chart',
        title: '帕累托价值累计曲线 (前 100 实体)',
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
        title: '等宽区间样本频次分布',
        type: 'bar',
        xKey: cols[1] || '区间范围',
        yKeys: [cols[2] || '样本频次'],
        showLegend: true,
        showValues: false,
      };
    }

    // Default bar
    return {
      id: 'recipe_chart',
      title: `${selectedRecipe.title} 结果分布`,
      type: 'bar',
      xKey: cols[0] || '',
      yKeys: cols.length > 1 ? [cols[1]] : [],
      showLegend: true,
      showValues: false,
    };
  }, [selectedRecipeId, rows, selectedRecipe]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-monokai-bg font-sans">
      {/* Top Recipe Picker Tiles */}
      <div className="border-b border-monokai-border bg-monokai-surface px-4 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-monokai-yellow/20 text-monokai-yellow">
              <Zap className="h-3.5 w-3.5" />
            </span>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-monokai-fg">
                业务分析场景配方库
              </h3>
              <p className="text-[10px] text-monokai-comment">
                开箱即用 • 自动适配当前表字段 • 本地毫秒级计算帕累托、RFM与异常分箱
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ActionButton
              variant="secondary"
              size="sm"
              icon={copied ? Check : Copy}
              onClick={handleCopySql}
            >
              {copied ? '已复制' : '复制 SQL'}
            </ActionButton>

            <ActionButton
              variant="warning"
              size="sm"
              icon={Terminal}
              onClick={handleOpenInSqlEditor}
            >
              在 SQL 工作台编辑
            </ActionButton>
          </div>
        </div>

        {/* Recipe Cards Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {RECIPES.map(recipe => (
            <button
              key={recipe.id}
              type="button"
              onClick={() => setSelectedRecipeId(recipe.id)}
              className={`flex flex-col text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                selectedRecipeId === recipe.id
                  ? 'border-monokai-border-strong bg-monokai-surface shadow-xs'
                  : 'border-monokai-border bg-monokai-bg/60 hover:bg-monokai-bg hover:border-monokai-border/90'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-monokai-bg border border-monokai-border text-monokai-orange">
                  {recipe.badge}
                </span>
              </div>
              <span className="text-xs font-bold text-monokai-fg line-clamp-1">
                {recipe.title.split(' ')[0]}
              </span>
              <span className="text-[10px] text-monokai-comment mt-0.5 line-clamp-1">
                {recipe.applicableScenario}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Parameter Binding & Auto-Mapping Bar */}
      <div className="border-b border-monokai-border bg-monokai-bg/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-mono text-monokai-comment font-semibold">
            映射当前表 [{currentTable}] 字段:
          </span>

          {selectedRecipe.params.map(p => (
            <div key={p.key} className="flex items-center gap-1.5">
              <span className="text-[10.5px] text-monokai-fg/80 font-mono">{p.label}:</span>
              {p.type === 'column_select' ? (
                <select
                  value={recipeParams[p.key] || ''}
                  onChange={e => setRecipeParams({ ...recipeParams, [p.key]: e.target.value })}
                  className="rounded border border-monokai-border bg-monokai-surface px-2 py-0.5 text-xs text-monokai-cyan font-mono focus:border-monokai-accent focus:outline-none"
                >
                  {schema.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={recipeParams[p.key] || ''}
                  onChange={e => setRecipeParams({ ...recipeParams, [p.key]: e.target.value })}
                  className="rounded border border-monokai-border bg-monokai-surface px-2 py-0.5 text-xs text-monokai-fg font-mono focus:outline-none"
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

        <div className="flex items-center gap-2">
          <ActionButton
            variant="success"
            size="sm"
            icon={Play}
            onClick={handleRunRecipe}
            loading={loading}
          >
            立即运行配方
          </ActionButton>
        </div>
      </div>

      {/* Main Results Area */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar flex flex-col gap-4">
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-xs font-mono text-monokai-comment">
            <RefreshCw className="h-6 w-6 animate-spin text-monokai-orange" />
            <span>正在执行 {selectedRecipe.title} 核心算法…</span>
          </div>
        ) : (
          <>
            {/* Insights Highlights Cards */}
            {insights.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-monokai-border bg-monokai-surface p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-monokai-yellow uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>智能计算业务洞察</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1">
                  {insights.map((txt, idx) => (
                    <div
                      key={idx}
                      className="rounded bg-monokai-bg border border-monokai-border/60 p-2.5 text-xs text-monokai-fg/90 leading-relaxed font-sans"
                    >
                      <span className="font-mono text-monokai-orange mr-1.5 font-bold">#{idx + 1}</span>
                      {txt}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Visual Chart */}
            {(selectedRecipeId === 'pareto' || selectedRecipeId === 'histogram') && (
              <AnalysisChartRenderer
                data={rows}
                config={chartConfig}
                height={260}
              />
            )}

            {/* Results Grid Table */}
            <div className="flex flex-col rounded-lg border border-monokai-border bg-monokai-surface overflow-hidden">
              <div className="px-3.5 py-2 border-b border-monokai-border bg-monokai-bg flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-monokai-fg">
                  {selectedRecipe.title} 输出明细 ({rows.length} 条)
                </span>
                <span className="text-[10px] text-monokai-comment">
                  耗时: {executionTimeMs} ms
                </span>
              </div>

              <div className="max-h-64 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-monokai-border bg-monokai-bg/70 sticky top-0">
                      {rows.length > 0 &&
                        Object.keys(rows[0]).map(col => (
                          <th key={col} className="px-3 py-2 text-monokai-comment">
                            {col}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-monokai-border/40">
                    {rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-monokai-bg/40 transition-colors">
                        {Object.keys(row).map((col, cIdx) => (
                          <td key={cIdx} className="px-3 py-1.5 text-monokai-fg/90 whitespace-nowrap">
                            {row[col] !== null && row[col] !== undefined
                              ? typeof row[col] === 'number'
                                ? Number.isInteger(row[col])
                                  ? row[col].toLocaleString()
                                  : row[col].toFixed(2)
                                : String(row[col])
                              : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
