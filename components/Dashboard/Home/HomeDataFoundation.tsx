import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GitBranch,
  Layers,
  Link2,
  Loader2,
  Shuffle,
  Table as TableIcon,
} from 'lucide-react';
import type { AnalyticalCatalog } from '../../../types/analyticalCatalog';
import { Tab } from '../../../types';
import { DB } from '../dashboardUi';
import { useAppStore } from '../../../hooks/store/useAppStore';
import { toastService } from '../../../services/toastService';
import { metricAnalyzer } from '../../../services/metricAnalyzer';
import { analyzeMetric } from '../../../hooks/store/useAnalysisWorkspace';

export interface HomeDataFoundationProps {
  catalog: AnalyticalCatalog | null;
  loading?: boolean;
  onNavigate: (tab: Tab) => void;
  onSelectQuery?: (sql: string, executeDirectly?: boolean) => void;
  onOpenImport?: () => void;
  onSelectTableMetrics?: (tableName: string) => void;
}

type PillarKey = 'metrics' | 'time' | 'category' | 'comparison' | 'drill' | 'link';

/**
 * Surfaces analytical data readiness — metrics / time / category / comparison / drill / linkage.
 * No charts here: only whether real DuckDB-derived fields exist to analyze.
 * Strict principle: data foundation first, no mock/static data.
 */
export const HomeDataFoundation: React.FC<HomeDataFoundationProps> = ({
  catalog,
  loading = false,
  onNavigate,
  onSelectQuery,
  onOpenImport,
  onSelectTableMetrics,
}) => {
  const setPendingSql = useAppStore((s) => s.setPendingSql);
  const setPendingChartConfig = useAppStore((s) => s.setPendingChartConfig);

  const [activePillar, setActivePillar] = useState<PillarKey>('metrics');
  const [expanded, setExpanded] = useState<boolean>(false);

  const chips = useMemo(() => {
    if (!catalog) return [];
    return [
      {
        key: 'metrics' as PillarKey,
        label: '核心指标',
        count: catalog.coreMetrics.length,
        ok: catalog.coreMetrics.some((m) => m.measureColumn),
        icon: BarChart3,
        desc: '由真实数值列与统计函数聚合形成的业务指标',
      },
      {
        key: 'time' as PillarKey,
        label: '时间维度',
        count: catalog.timeDimensions.length,
        ok: catalog.timeDimensions.length > 0,
        icon: Calendar,
        desc: '支持日/周/月/季/年多颗粒度趋势分析的时间序列',
      },
      {
        key: 'category' as PillarKey,
        label: '分类维度',
        count: catalog.categoryDimensions.length,
        ok: catalog.categoryDimensions.length > 0,
        icon: Layers,
        desc: '地理、品类、状态、渠道等多维分组与切片列',
      },
      {
        key: 'comparison' as PillarKey,
        label: '对比维度',
        count: catalog.comparisonDimensions.length,
        ok: catalog.comparisonDimensions.length > 0,
        icon: Shuffle,
        desc: '用于同环比、AB 分组及低基数分类对比分析',
      },
      {
        key: 'drill' as PillarKey,
        label: '可下钻明细',
        count: catalog.drillPaths.length,
        ok: catalog.drillPaths.length > 0,
        icon: GitBranch,
        desc: '跨层级（地理/产品/时间）与外键关系的下钻明细路径',
      },
      {
        key: 'link' as PillarKey,
        label: '图表联动字段',
        count: catalog.linkageFields.length,
        ok: catalog.linkageFields.length > 0,
        icon: Link2,
        desc: '跨表、跨组件传递筛选与高亮参数的公共关联键',
      },
    ];
  }, [catalog]);

  const runSqlAnalysis = (sql: string, title: string, chartType: 'bar' | 'line' | 'table' = 'bar') => {
    setPendingSql(sql);
    setPendingChartConfig({
      id: `metric-${Date.now()}`,
      title,
      type: chartType,
      xKey: '',
      yKeys: [],
      source: 'manual',
    });
    onSelectQuery?.(sql, true);
    onNavigate(Tab.SQL);
    toastService.info(`已载入「${title}」真实数据 SQL`);
  };

  if (loading && !catalog) {
    return (
      <section className={`${DB.panelLg} gap-2 py-4`}>
        <div className="flex items-center gap-2 text-monokai-comment">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs">正在从 DuckDB 扫描字段角色与分析完备度…</span>
        </div>
      </section>
    );
  }

  if (!catalog) return null;

  return (
    <section className={`${DB.panelLg} gap-3`}>
      <div className={DB.sectionHeader}>
        <div className="flex items-center gap-2 min-w-0">
          <TableIcon className="h-3.5 w-3.5 text-monokai-accent shrink-0" />
          <h2 className={DB.sectionTitle}>数据基础与完备度</h2>
          <span className={DB.sectionMeta}>
            分析字段就绪度 {catalog.overallReadinessScore}% · 扫描 {catalog.tableCount} 表 · 此评分不代表业务质检或合规通过率
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onOpenImport && catalog.tableCount === 0 && (
            <button type="button" className={DB.btnSecondary} onClick={onOpenImport}>
              导入数据
            </button>
          )}
          <button
            type="button"
            className={`${DB.btnSecondary} text-2xs py-1 px-2`}
            onClick={() => setExpanded(!expanded)}
            title={expanded ? '收起明细' : '展开数据基础明细'}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? '收起' : '展开详情'}
          </button>
        </div>
      </div>

      {/* 6 Pillars Chips */}
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => {
          const Icon = c.icon;
          const isSelected = activePillar === c.key;
          return (
            <button
              type="button"
              key={c.key}
              onClick={() => {
                setActivePillar(c.key);
                if (!expanded) setExpanded(true);
              }}
              className={`${DB.chip} cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-monokai-accent/15 border-monokai-accent text-white font-medium shadow-sm'
                  : c.ok
                    ? 'border-monokai-accent/35 text-monokai-accent hover:border-monokai-accent/70'
                    : 'border-monokai-yellow/35 text-monokai-yellow hover:border-monokai-yellow/70'
              }`}
              title={`${c.label}: ${c.desc}`}
            >
              <Icon className="h-3 w-3" />
              <span>{c.label}</span>
              <span className="rounded-full bg-monokai-elevated px-1.5 py-0.2 text-2xs font-mono font-bold">
                {c.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Workspace Gaps Warning */}
      {catalog.workspaceGaps.length > 0 && (
        <div className="rounded-md border border-monokai-yellow/30 bg-monokai-yellow/8 px-3 py-2 space-y-1">
          <div className="flex items-center gap-1.5 text-monokai-yellow text-xs font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>分析所需数据缺口（由实时 DuckDB 元数据扫描推导，杜绝 Mock）</span>
          </div>
          <ul className="list-disc pl-4 text-2xs font-mono text-monokai-fg-muted space-y-0.5">
            {catalog.workspaceGaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Expanded Detail Panel for Selected Pillar */}
      {expanded && (
        <div className="rounded-md border border-monokai-border/80 bg-monokai-elevated/40 p-3 space-y-2.5">
          {activePillar === 'metrics' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-2xs text-monokai-comment">
                <span className="font-mono uppercase tracking-wide">
                  核心指标明细（推导自真实表数值度量列）
                </span>
                <span>共 {catalog.coreMetrics.length} 个候选指标</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {catalog.coreMetrics.slice(0, 8).map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-col justify-between rounded border border-monokai-border/60 bg-monokai-bg/60 p-2 hover:border-monokai-border-strong transition-all"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-white truncate">{m.name}</span>
                        <span className="text-2xs font-mono rounded bg-monokai-panel px-1 text-monokai-accent shrink-0">
                          {m.aggregation.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-2xs font-mono text-monokai-comment mt-0.5 truncate">
                        表: {m.tableName} {m.measureColumn ? `· 列: ${m.measureColumn}` : ''}
                      </div>
                      <div className="text-2xs text-monokai-fg-muted/80 mt-1 line-clamp-1" title={m.rationale}>
                        {m.rationale}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between pt-1 border-t border-monokai-border/30">
                      <span className="text-2xs font-mono text-monokai-comment truncate max-w-[180px]">
                        {m.timeDimension ? `时间:${m.timeDimension}` : ''}
                        {m.categoryDimensions[0] ? ` 分类:${m.categoryDimensions[0]}` : ''}
                      </span>
                      <button
                        type="button"
                        className={DB.btnGhostLink}
                        onClick={() => {
                          const metric = metricAnalyzer.loadMetricPackages().flatMap(pkg => pkg.metrics).find(metric => metric.id === m.id);
                          if (metric) analyzeMetric(metric, m.tableName);
                          else runSqlAnalysis(m.sql, m.name, m.timeDimension ? 'line' : 'bar');
                        }}
                      >
                        <ExternalLink className="h-3 w-3 inline mr-1" />
                        分析指标
                      </button>
                      {onSelectTableMetrics && <button type="button" className={DB.btnGhostLink} onClick={() => onSelectTableMetrics(m.tableName)}>管理指标</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePillar === 'time' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-2xs text-monokai-comment">
                <span className="font-mono uppercase tracking-wide">
                  时间维度明细（时间序列与聚合颗粒度）
                </span>
                <span>共 {catalog.timeDimensions.length} 个时间列</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {catalog.timeDimensions.slice(0, 8).map((t) => (
                  <div
                    key={`${t.tableName}-${t.columnName}`}
                    className="flex flex-col justify-between rounded border border-monokai-border/60 bg-monokai-bg/60 p-2 hover:border-monokai-border-strong transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white truncate">{t.columnName}</span>
                        <span className="text-2xs font-mono rounded bg-monokai-panel px-1.5 text-monokai-cyan">
                          粒度: {t.suggestedGrain}
                        </span>
                      </div>
                      <div className="text-2xs font-mono text-monokai-comment mt-0.5">
                        表: {t.tableName} · 类型: {t.physicalType}
                      </div>
                      {(t.min != null || t.max != null) && (
                        <div className="text-2xs font-mono text-monokai-fg-muted mt-1 truncate">
                          跨度: {String(t.min ?? '')} ~ {String(t.max ?? '')}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 pt-1 border-t border-monokai-border/30 flex justify-end">
                      <button
                        type="button"
                        className={DB.btnGhostLink}
                        onClick={() =>
                          runSqlAnalysis(
                            `SELECT "${t.columnName}", COUNT(*) AS count FROM "${t.tableName}" WHERE "${t.columnName}" IS NOT NULL GROUP BY 1 ORDER BY 1 LIMIT 100;`,
                            `${t.tableName} 按 ${t.columnName} 趋势`,
                            'line',
                          )
                        }
                      >
                        <ExternalLink className="h-3 w-3 inline mr-1" />
                        时间趋势分析
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePillar === 'category' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-2xs text-monokai-comment">
                <span className="font-mono uppercase tracking-wide">
                  分类维度明细（切片/钻取候选维度）
                </span>
                <span>共 {catalog.categoryDimensions.length} 个分类列</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {catalog.categoryDimensions.slice(0, 8).map((c) => (
                  <div
                    key={`${c.tableName}-${c.columnName}`}
                    className="flex flex-col justify-between rounded border border-monokai-border/60 bg-monokai-bg/60 p-2 hover:border-monokai-border-strong transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white truncate">{c.columnName}</span>
                        {c.linkable && (
                          <span className="text-2xs font-mono rounded bg-monokai-accent/15 text-monokai-accent px-1">
                            可联动
                          </span>
                        )}
                      </div>
                      <div className="text-2xs font-mono text-monokai-comment mt-0.5">
                        表: {c.tableName} {c.distinctCount != null ? `· 基数: ${c.distinctCount}` : ''}
                      </div>
                      {c.sampleValues && c.sampleValues.length > 0 && (
                        <div className="text-2xs font-mono text-monokai-fg-muted mt-1 truncate">
                          样本: {c.sampleValues.slice(0, 4).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 pt-1 border-t border-monokai-border/30 flex justify-end">
                      <button
                        type="button"
                        className={DB.btnGhostLink}
                        onClick={() =>
                          runSqlAnalysis(
                            `SELECT "${c.columnName}", COUNT(*) AS count FROM "${c.tableName}" WHERE "${c.columnName}" IS NOT NULL GROUP BY 1 ORDER BY count DESC LIMIT 20;`,
                            `${c.tableName} 按 ${c.columnName} 分布`,
                            'bar',
                          )
                        }
                      >
                        <ExternalLink className="h-3 w-3 inline mr-1" />
                        分布分析
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePillar === 'comparison' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-2xs text-monokai-comment">
                <span className="font-mono uppercase tracking-wide">
                  对比维度明细（多组别 / 同环比分析）
                </span>
                <span>共 {catalog.comparisonDimensions.length} 个对比维度</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {catalog.comparisonDimensions.slice(0, 8).map((d, idx) => (
                  <div
                    key={`${d.tableName}-${d.columnName}-${d.kind}-${idx}`}
                    className="flex flex-col justify-between rounded border border-monokai-border/60 bg-monokai-bg/60 p-2 hover:border-monokai-border-strong transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white truncate">{d.columnName}</span>
                        <span
                          className={`text-2xs font-mono rounded px-1.5 ${
                            d.kind === 'category_split'
                              ? 'bg-monokai-yellow/15 text-monokai-yellow'
                              : 'bg-monokai-accent/15 text-monokai-accent'
                          }`}
                        >
                          {d.kind === 'category_split' ? '组别切分' : '时间周期'}
                        </span>
                      </div>
                      <div className="text-2xs font-mono text-monokai-comment mt-0.5">
                        表: {d.tableName} {d.distinctCount != null ? `· 分组数: ${d.distinctCount}` : ''}
                      </div>
                    </div>
                    <div className="mt-2 pt-1 border-t border-monokai-border/30 flex justify-end">
                      <button
                        type="button"
                        className={DB.btnGhostLink}
                        onClick={() =>
                          runSqlAnalysis(
                            `SELECT "${d.columnName}", COUNT(*) AS total_records FROM "${d.tableName}" GROUP BY 1 ORDER BY 1 LIMIT 50;`,
                            `${d.tableName} 基于 ${d.columnName} 对比`,
                            'bar',
                          )
                        }
                      >
                        <ExternalLink className="h-3 w-3 inline mr-1" />
                        对比分析
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePillar === 'drill' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-2xs text-monokai-comment">
                <span className="font-mono uppercase tracking-wide">
                  可下钻明细路径（跨层级与外键穿透）
                </span>
                <span>共 {catalog.drillPaths.length} 条下钻路径</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {catalog.drillPaths.slice(0, 8).map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col justify-between rounded border border-monokai-border/60 bg-monokai-bg/60 p-2 hover:border-monokai-border-strong transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white truncate">{p.label}</span>
                        {p.hierarchyType && (
                          <span className="text-2xs font-mono rounded bg-monokai-panel px-1.5 text-monokai-green">
                            {p.hierarchyType}
                          </span>
                        )}
                      </div>
                      <div className="text-2xs font-mono text-monokai-comment mt-0.5 truncate">
                        {p.fromTable}.{p.fromColumn} → {p.toTable}.{p.toColumn}
                      </div>
                    </div>
                    <div className="mt-2 pt-1 border-t border-monokai-border/30 flex justify-end">
                      <button
                        type="button"
                        className={DB.btnGhostLink}
                        onClick={() =>
                          runSqlAnalysis(
                            p.detailSqlTemplate.replace('{{value}}', "'%'"),
                            `下钻穿透: ${p.label}`,
                            'table',
                          )
                        }
                      >
                        <ExternalLink className="h-3 w-3 inline mr-1" />
                        穿透下钻
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePillar === 'link' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-2xs text-monokai-comment">
                <span className="font-mono uppercase tracking-wide">
                  图表联动所需字段（跨组件筛选与参数交互）
                </span>
                <span>共 {catalog.linkageFields.length} 个联动字段</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {catalog.linkageFields.slice(0, 8).map((l) => (
                  <div
                    key={l.columnName}
                    className="flex flex-col justify-between rounded border border-monokai-border/60 bg-monokai-bg/60 p-2 hover:border-monokai-border-strong transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white truncate">{l.columnName}</span>
                        <span className="text-2xs font-mono rounded bg-monokai-cyan/15 text-monokai-cyan px-1.5">
                          {l.recommendedRole || l.role}
                        </span>
                      </div>
                      <div className="text-2xs font-mono text-monokai-comment mt-0.5 truncate">
                        运算符: {l.filterOperator || '='} · 关联表 ({l.tables.length}): {l.tables.join(', ')}
                      </div>
                    </div>
                    <div className="mt-2 pt-1 border-t border-monokai-border/30 flex justify-end">
                      <button
                        type="button"
                        className={DB.btnGhostLink}
                        onClick={() =>
                          runSqlAnalysis(
                            `SELECT "${l.columnName}", COUNT(*) AS ref_count FROM "${l.tables[0]}" GROUP BY 1 ORDER BY 2 DESC LIMIT 50;`,
                            `联动字段验证: ${l.columnName}`,
                            'bar',
                          )
                        }
                      >
                        <ExternalLink className="h-3 w-3 inline mr-1" />
                        验证联动
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

