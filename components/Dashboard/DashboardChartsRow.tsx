import React, { useState } from 'react';
import { Layers, ArrowUpRight, Search, X, ShieldAlert } from 'lucide-react';
import { Tab } from '../../types';
import {
  type GrowthTrendItem,
  type LatencyTrendItem,
  type DashboardDbMetrics,
  formatBytes,
} from '../../hooks/useDashboardWorkflow';

interface DashboardChartsRowProps {
  growthData: GrowthTrendItem[];
  latencyData: LatencyTrendItem[];
  metrics: DashboardDbMetrics;
  onNavigate?: (tab: Tab) => void;
  onInspectIssue?: (sql: string) => void;
  onSelectTable?: (tableName: string) => void;
  onSelectTableStructure?: (tableName: string, focusTab?: 'profile' | 'add' | 'ddl') => void;
  onSelectTableWithFilter?: (tableName: string, filter: string) => void;
  growthMetric?: 'rows' | 'size';
  onGrowthMetricChange?: (metric: 'rows' | 'size') => void;
  growthLimit?: number;
  onGrowthLimitChange?: (limit: number) => void;
  latencyFilter?: 'all' | 'fast' | 'normal' | 'slow';
  onLatencyFilterChange?: (filter: 'all' | 'fast' | 'normal' | 'slow') => void;
  tableTypeFilter?: 'all' | 'table' | 'view';
  onTableTypeFilterChange?: (filter: 'all' | 'table' | 'view') => void;
  onSelectTableAnalysis?: (tableName: string) => void;
  onSelectTableMetrics?: (tableName: string) => void;
  onQuickQuery?: (tableName: string) => void;
}

export const DashboardChartsRow: React.FC<DashboardChartsRowProps> = ({
  growthData = [],
  latencyData = [],
  metrics,
  onNavigate,
  onInspectIssue,
  onSelectTable,
  onSelectTableStructure,
  onSelectTableWithFilter,
  growthMetric = 'rows',
  onGrowthMetricChange,
  growthLimit = 6,
  onGrowthLimitChange,
  latencyFilter = 'all',
  onLatencyFilterChange,
  tableTypeFilter = 'all',
  onTableTypeFilterChange,
  onSelectTableAnalysis,
  onSelectTableMetrics,
  onQuickQuery,
}) => {
  const [hoveredGrowthIndex, setHoveredGrowthIndex] = useState<number | null>(null);
  const [hoveredLatencyIndex, setHoveredLatencyIndex] = useState<number | null>(null);
  const [showQualityDetails, setShowQualityDetails] = useState<'pk' | 'null' | null>(null);

  // Dynamic max value from real data
  const maxRowVal = Math.max(
    growthMetric === 'size' ? 1024 : 100,
    ...(growthData || []).map(d => Math.max(d.importRows, d.queryRows || 0))
  );

  const totalTables = metrics?.tableTypeDistribution?.total ?? 0;
  const tableCount = metrics?.tableTypeDistribution?.table ?? 0;
  const viewCount = metrics?.tableTypeDistribution?.view ?? 0;

  // Real Donut slices
  const tableTypes = [
    {
      type: 'table' as const,
      label: '表 (Table)',
      count: tableCount,
      pct: totalTables > 0 ? Math.round((tableCount / totalTables) * 100) : 0,
      color: '#66d9ef',
    },
    {
      type: 'view' as const,
      label: '视图 (View)',
      count: viewCount,
      pct: totalTables > 0 ? Math.round((viewCount / totalTables) * 100) : 0,
      color: '#ae81ff',
    },
  ];

  // SVG Donut calculation
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPct = 0;

  const formatYAxis = (val: number) => {
    if (growthMetric === 'size') {
      return formatBytes(val);
    }
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
    return String(Math.round(val));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 w-full min-w-0">
      {/* 1. 数据增长趋势 (各表规模分布) */}
      <div className="flex flex-col p-3.5 sm:p-4 rounded-xl bg-monokai-surface border border-monokai-border shadow-sm min-w-0 overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-monokai-fg tracking-wide">数据增长趋势</h3>
            <span className="text-2xs text-monokai-comment font-mono">
              {growthMetric === 'size' ? '各表存储体积对比' : '各表行数规模对比'}
            </span>
          </div>

          {/* Real Dimensional Controls */}
          <div className="flex items-center gap-1.5">
            {onGrowthMetricChange && (
              <div className="flex items-center bg-monokai-elevated rounded-lg p-0.5 border border-monokai-border text-2xs">
                <button
                  type="button"
                  onClick={() => onGrowthMetricChange('rows')}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${growthMetric === 'rows' ? 'bg-monokai-surface border border-monokai-accent/40 text-monokai-accent font-bold' : 'text-monokai-comment hover:text-monokai-fg'}`}
                >
                  行数
                </button>
                <button
                  type="button"
                  onClick={() => onGrowthMetricChange('size')}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${growthMetric === 'size' ? 'bg-monokai-surface border border-monokai-accent/40 text-monokai-accent font-bold' : 'text-monokai-comment hover:text-monokai-fg'}`}
                >
                  体积
                </button>
              </div>
            )}
            {onGrowthLimitChange && (
              <select
                value={growthLimit}
                onChange={e => onGrowthLimitChange(Number(e.target.value))}
                className="bg-monokai-elevated border border-monokai-border rounded-lg px-2 py-0.5 text-2xs text-monokai-fg-muted cursor-pointer focus:outline-none focus:border-monokai-accent"
              >
                <option value={6}>TOP 6</option>
                <option value={10}>TOP 10</option>
                <option value={0}>全部</option>
              </select>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-3 text-2xs text-monokai-comment mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-monokai-accent" />
            <span>{growthMetric === 'size' ? '数据体积' : '导入行数'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-monokai-cyan" />
            <span>{growthMetric === 'size' ? '字段数量' : '查询行数'}</span>
          </div>
        </div>

        {/* Bar Chart Container */}
        <div className="relative flex-1 min-h-[175px] flex items-end">
          {growthData.length === 0 ? (
            <div className="flex flex-col items-center justify-center w-full h-[140px] text-center p-4 border border-dashed border-monokai-border rounded-lg">
              <Layers className="w-6 h-6 text-monokai-comment mb-1.5" />
              <p className="text-xs text-monokai-fg-muted">暂无数据表规模分布</p>
              <p className="text-meta text-monokai-comment mt-0.5">
                创建或导入数据表后，此处将直观呈现各表规模对比
              </p>
            </div>
          ) : (
            <>
              {/* Y Axis Labels */}
              <div className="flex flex-col justify-between h-[135px] text-2xs text-monokai-comment font-mono pr-2 pb-5 select-none shrink-0">
                <span>{formatYAxis(maxRowVal)}</span>
                <span>{formatYAxis(maxRowVal * 0.5)}</span>
                <span>0</span>
              </div>

              {/* Bars Area */}
              <div className="relative flex-1 h-[135px] flex items-end justify-between border-b border-monokai-border pb-1 px-1 gap-1 overflow-x-auto custom-scrollbar">
                {/* Background Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-25">
                  <div className="w-full border-b border-dashed border-monokai-border" />
                  <div className="w-full border-b border-dashed border-monokai-border" />
                  <div className="w-full border-b border-dashed border-monokai-border" />
                </div>

                {growthData.map((item, idx) => {
                  const hImp = Math.max(6, Math.min(110, (item.importRows / maxRowVal) * 110));
                  const hQry = Math.max(3, Math.min(110, ((item.queryRows || 0) / maxRowVal) * 110));
                  const isHovered = hoveredGrowthIndex === idx;

                  return (
                    <div
                      key={item.date}
                      onClick={() => onSelectTable && onSelectTable(item.date)}
                      onMouseEnter={() => setHoveredGrowthIndex(idx)}
                      onMouseLeave={() => setHoveredGrowthIndex(null)}
                      title={`点击进入数据表格浏览表 "${item.date}"`}
                      className="group relative flex flex-col items-center cursor-pointer flex-1 min-w-[32px] px-0.5"
                    >
                      {isHovered && (
                        <div className="absolute -top-16 z-30 px-2.5 py-1.5 bg-monokai-elevated border border-monokai-border text-2xs font-mono rounded-md shadow-xl text-monokai-fg pointer-events-none whitespace-nowrap">
                          <div className="font-bold text-monokai-fg mb-0.5">{item.date}</div>
                          <div>
                            {growthMetric === 'size' ? '体积' : '行数'}:{' '}
                            {growthMetric === 'size' && item.formattedSize ? item.formattedSize : item.importRows.toLocaleString()}
                          </div>
                          <div>字段列数: {item.columnCount ?? '—'} 个</div>
                          {(item.queryCount || 0) > 0 && <div>查询热度: {item.queryCount} 次</div>}
                          {item.formattedSize && growthMetric !== 'size' && <div>预估存储: {item.formattedSize}</div>}
                        </div>
                      )}

                      {/* Dual Bars */}
                      <div className="flex items-end gap-1">
                        <div
                          className="w-2.5 sm:w-3 rounded-t-[3px] transition-all duration-200 group-hover:brightness-125 bg-monokai-accent"
                          style={{
                            height: `${hImp}px`,
                            boxShadow: '0 0 8px rgba(166, 226, 46, 0.25)',
                          }}
                        />
                        <div
                          className="w-2.5 sm:w-3 rounded-t-[3px] transition-all duration-200 group-hover:brightness-125 bg-monokai-cyan"
                          style={{
                            height: `${hQry}px`,
                            boxShadow: '0 0 8px rgba(102, 217, 239, 0.25)',
                          }}
                        />
                      </div>

                      {/* Date / Table Label */}
                      <span className="text-2xs font-mono text-monokai-comment mt-2 select-none truncate max-w-[64px] group-hover:text-monokai-fg font-medium">
                        {item.date}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. 查询性能与耗时分布 */}
      <div className="flex flex-col p-3.5 sm:p-4 rounded-xl bg-monokai-surface border border-monokai-border shadow-sm min-w-0 overflow-hidden">
        <div className="flex items-center justify-between mb-2 gap-2 min-w-0">
          <h3 className="text-xs font-semibold text-monokai-fg tracking-wide shrink-0">查询性能</h3>
          {onLatencyFilterChange && latencyFilter !== 'all' && (
            <button
              type="button"
              onClick={() => onLatencyFilterChange('all')}
              className="text-2xs text-monokai-cyan hover:underline cursor-pointer font-mono shrink-0"
            >
              清除过滤
            </button>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-3 text-2xs text-monokai-comment mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-monokai-cyan" />
            <span>平均耗时</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-monokai-amethyst" />
            <span>P95 耗时</span>
          </div>
        </div>

        {/* Clickable 3 Latency Range Pills */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-2.5 min-w-0">
          <div
            role="button"
            tabIndex={0}
            onClick={() => onLatencyFilterChange && onLatencyFilterChange(latencyFilter === 'fast' ? 'all' : 'fast')}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onLatencyFilterChange && onLatencyFilterChange(latencyFilter === 'fast' ? 'all' : 'fast');
              }
            }}
            title="点击仅过滤极速查询"
            className={`p-1.5 sm:p-2 rounded-lg text-center cursor-pointer transition-all duration-150 border min-w-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent ${
              latencyFilter === 'fast'
                ? 'bg-monokai-accent/20 border-monokai-accent shadow-xs'
                : 'bg-monokai-elevated hover:bg-monokai-border/40 border-monokai-border'
            }`}
          >
            <span className="text-2xs sm:text-2xs text-monokai-comment block truncate">极速 (&lt;50ms)</span>
            <span className="text-xs sm:text-sm font-bold font-mono text-monokai-accent">
              {metrics.latencyDistribution?.fastCount ?? 0}
            </span>
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => onLatencyFilterChange && onLatencyFilterChange(latencyFilter === 'normal' ? 'all' : 'normal')}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onLatencyFilterChange && onLatencyFilterChange(latencyFilter === 'normal' ? 'all' : 'normal');
              }
            }}
            title="点击仅过滤标准查询"
            className={`p-1.5 sm:p-2 rounded-lg text-center cursor-pointer transition-all duration-150 border min-w-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent ${
              latencyFilter === 'normal'
                ? 'bg-monokai-cyan/20 border-monokai-cyan shadow-xs'
                : 'bg-monokai-elevated hover:bg-monokai-border/40 border-monokai-border'
            }`}
          >
            <span className="text-2xs sm:text-2xs text-monokai-comment block truncate">标准 (50-200ms)</span>
            <span className="text-xs sm:text-sm font-bold font-mono text-monokai-cyan">
              {metrics.latencyDistribution?.normalCount ?? 0}
            </span>
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => onLatencyFilterChange && onLatencyFilterChange(latencyFilter === 'slow' ? 'all' : 'slow')}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onLatencyFilterChange && onLatencyFilterChange(latencyFilter === 'slow' ? 'all' : 'slow');
              }
            }}
            title="点击仅过滤慢查询"
            className={`p-1.5 sm:p-2 rounded-lg text-center cursor-pointer transition-all duration-150 border min-w-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent ${
              latencyFilter === 'slow'
                ? 'bg-monokai-yellow/20 border-monokai-yellow shadow-xs'
                : 'bg-monokai-elevated hover:bg-monokai-border/40 border-monokai-border'
            }`}
          >
            <span className="text-2xs sm:text-2xs text-monokai-comment block truncate">慢查询 (&gt;200ms)</span>
            <span className={`text-xs sm:text-sm font-bold font-mono ${(metrics.latencyDistribution?.slowCount ?? 0) > 0 ? 'text-monokai-yellow' : 'text-monokai-comment'}`}>
              {metrics.latencyDistribution?.slowCount ?? 0}
            </span>
          </div>
        </div>

        {/* Execution Latency Trend line / points */}
        <div className="relative flex-1 min-h-[120px] flex flex-col justify-end min-w-0">
          {latencyData.length === 0 ? (
            <div className="flex flex-col items-center justify-center w-full h-[110px] text-center p-3 border border-dashed border-monokai-border rounded-lg">
              <span className="text-meta text-monokai-fg-muted">
                {latencyFilter !== 'all' ? '当前筛选档位暂无匹配记录' : '暂无查询执行记录'}
              </span>
              <span className="text-2xs text-monokai-comment mt-1">
                {latencyFilter !== 'all'
                  ? '当前档位暂无记录，可点击“清除过滤”查看全部'
                  : '在 SQL 工作台运行查询后，此处将自动记录耗时分布与执行详情'}
              </span>
              {latencyFilter !== 'all' && onLatencyFilterChange && (
                <button
                  type="button"
                  onClick={() => onLatencyFilterChange('all')}
                  className="mt-2 px-2 py-0.5 text-2xs font-mono rounded bg-monokai-elevated border border-monokai-border text-monokai-cyan hover:bg-monokai-border/40 transition-colors cursor-pointer"
                >
                  重置为全部
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-end justify-between border-b border-monokai-border pb-2 pt-2 px-0.5 sm:px-1 gap-0.5 sm:gap-1 min-w-0 w-full overflow-x-auto custom-scrollbar">
              {latencyData.map((d, idx) => {
                const isHovered = hoveredLatencyIndex === idx;
                const barHeight = Math.max(6, Math.min(65, (d.avgMs / 300) * 65));
                const p95Height = Math.max(6, Math.min(68, (d.p95Ms / 300) * 65));
                const barColor = d.status === 'error' ? '#f92672' : d.avgMs > 200 ? '#e6db74' : '#66d9ef';

                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredLatencyIndex(idx)}
                    onMouseLeave={() => setHoveredLatencyIndex(null)}
                    onClick={() => d.sql && onInspectIssue && onInspectIssue(d.sql)}
                    title="点击在 SQL 工作台中重放该查询"
                    className="group relative flex flex-col items-center flex-1 min-w-0 cursor-pointer"
                  >
                    {isHovered && (
                      <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-30 px-2.5 py-1.5 bg-monokai-elevated border border-monokai-border text-2xs font-mono rounded-md shadow-xl text-monokai-fg pointer-events-none whitespace-nowrap">
                        <div className="font-bold text-monokai-fg">均值: {d.avgMs} ms · P95: {d.p95Ms} ms</div>
                        <div className="text-monokai-cyan max-w-[160px] truncate">{d.sql || 'SQL 查询'}</div>
                      </div>
                    )}
                    <span className="text-3xs sm:text-2xs font-mono text-monokai-comment mb-1 w-full text-center truncate tabular-nums leading-none">
                      {d.avgMs}
                      <span className="hidden sm:inline">ms</span>
                    </span>
                    <div className="relative w-full max-w-[28px] mx-auto flex items-end justify-center">
                      <div
                        className="w-full rounded-t-[2px] transition-all duration-200 group-hover:brightness-125"
                        style={{
                          height: `${barHeight}px`,
                          backgroundColor: barColor,
                        }}
                      />
                      {/* P95 Marker indicator */}
                      <div
                        data-testid={`p95-marker-${idx}`}
                        className="absolute w-2 h-0.5 bg-monokai-amethyst rounded-full shadow-[0_0_4px_#ae81ff] pointer-events-none"
                        style={{
                          bottom: `${p95Height}px`,
                        }}
                      />
                    </div>
                    <span className="text-3xs sm:text-2xs font-mono text-monokai-comment mt-1 w-full text-center truncate leading-none">
                      {d.date}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. 表类型分布 & 数据质量巡检 */}
      <div className="flex flex-col p-3.5 sm:p-4 rounded-xl bg-monokai-surface border border-monokai-border shadow-sm min-w-0 overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-monokai-fg tracking-wide">表类型分布</h3>
            {tableTypeFilter !== 'all' && onTableTypeFilterChange && (
              <button
                type="button"
                onClick={() => onTableTypeFilterChange('all')}
                className="text-2xs text-monokai-cyan hover:underline cursor-pointer font-mono"
              >
                清除过滤
              </button>
            )}
          </div>
          <div className="text-meta font-mono text-monokai-comment">
            <span>总表数</span>: <span className="text-monokai-fg font-bold">{totalTables}</span>
          </div>
        </div>

        <div className="flex items-center justify-between flex-1 gap-4 pt-1">
          {/* Donut Chart SVG (Interactive Slices) */}
          <div className="relative w-26 h-26 sm:w-28 sm:h-28 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="var(--monokai-border-subtle, #2d2e29)"
                strokeWidth="14"
              />
              {totalTables > 0 &&
                tableTypes.map(t => {
                  if (t.count === 0) return null;
                  const strokeDasharray = `${(t.pct / 100) * circumference} ${circumference}`;
                  const strokeDashoffset = -((accumulatedPct / 100) * circumference);
                  accumulatedPct += t.pct;
                  const isSelected = tableTypeFilter === t.type;

                  return (
                    <circle
                      key={t.label}
                      cx="60"
                      cy="60"
                      r={radius}
                      fill="none"
                      stroke={t.color}
                      strokeWidth={isSelected ? 16 : 14}
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      opacity={tableTypeFilter === 'all' || isSelected ? 1 : 0.35}
                      className="transition-all duration-300 cursor-pointer hover:opacity-80"
                      onClick={() => onTableTypeFilterChange && onTableTypeFilterChange(tableTypeFilter === t.type ? 'all' : t.type)}
                    >
                      <title>{`点击联动筛选${t.label}`}</title>
                    </circle>
                  );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-base font-bold font-mono text-monokai-fg">{totalTables}</span>
              <span className="text-2xs text-monokai-comment">对象总计</span>
            </div>
          </div>

          {/* Slices Legend & Quality Status with 1-Click Jump */}
          <div className="flex flex-col justify-center gap-1.5 flex-1 min-w-0">
            {tableTypes.map(t => {
              const isSelected = tableTypeFilter === t.type;
              return (
                <div
                  key={t.label}
                  role="button"
                  tabIndex={0}
                  onClick={() => onTableTypeFilterChange && onTableTypeFilterChange(tableTypeFilter === t.type ? 'all' : t.type)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onTableTypeFilterChange && onTableTypeFilterChange(tableTypeFilter === t.type ? 'all' : t.type);
                    }
                  }}
                  title={`点击在下方列表联动筛选 ${t.label}`}
                  className={`flex items-center justify-between text-meta px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                    isSelected ? 'bg-monokai-elevated border border-monokai-border font-bold' : 'hover:bg-monokai-surface'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                    <span className={`truncate ${isSelected ? 'text-monokai-fg' : 'text-monokai-fg-muted'}`}>{t.label}</span>
                  </div>
                  <span className="font-mono font-medium text-monokai-fg text-meta">
                    {t.count} ({t.pct}%)
                  </span>
                </div>
              );
            })}

            <div className="mt-1.5 pt-1.5 border-t border-monokai-border flex flex-col gap-1 text-meta">
              <div className="flex items-center justify-between">
                <span className="text-monokai-comment">缺少主键:</span>
                {totalTables === 0 ? (
                  <span className="font-mono text-monokai-comment">未挂载表</span>
                ) : metrics.qualityIssues?.missingPkCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowQualityDetails(showQualityDetails === 'pk' ? null : 'pk')}
                    className="inline-flex items-center gap-1 font-mono text-monokai-yellow font-bold hover:underline cursor-pointer"
                    title="点击查看缺少主键的表清单"
                  >
                    <span>{metrics.qualityIssues.missingPkCount} 张表</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                ) : (
                  <span className="font-mono text-monokai-accent">0 项 (正常)</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-monokai-comment">空值异常:</span>
                {totalTables === 0 ? (
                  <span className="font-mono text-monokai-comment">未挂载表</span>
                ) : metrics.qualityIssues?.nullAnomalyCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowQualityDetails(showQualityDetails === 'null' ? null : 'null')}
                    className="inline-flex items-center gap-1 font-mono text-monokai-yellow font-bold hover:underline cursor-pointer"
                    title="点击查看异常空值字段清单"
                  >
                    <span>{metrics.qualityIssues.nullAnomalyCount} 个列</span>
                    <Search className="w-3 h-3" />
                  </button>
                ) : (
                  <span className="font-mono text-monokai-accent">0 项 (无空值)</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quality Detail Expandable Drawer/Card */}
        {showQualityDetails && (
          <div className="mt-3 p-3 rounded-lg bg-monokai-elevated border border-monokai-border text-xs space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-monokai-border pb-1.5">
              <span className="font-semibold text-monokai-fg flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-monokai-yellow" />
                {showQualityDetails === 'pk' ? '缺少主键表诊断清单' : '空值率异常列清单'}
              </span>
              <button
                type="button"
                onClick={() => setShowQualityDetails(null)}
                className="text-monokai-comment hover:text-monokai-fg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-1 text-meta">
              {showQualityDetails === 'pk' ? (
                metrics.qualityIssues.missingPkTables.map(tbl => (
                  <div key={tbl} className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-monokai-surface">
                    <span className="font-mono text-monokai-fg">{tbl}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectTableStructure) {
                          onSelectTableStructure(tbl, 'add');
                        } else {
                          onSelectTable && onSelectTable(tbl);
                          onNavigate && onNavigate(Tab.STRUCTURE);
                        }
                      }}
                      className="text-monokai-cyan hover:underline font-mono text-2xs"
                    >
                      补全主键 ↗
                    </button>
                  </div>
                ))
              ) : (
                metrics.qualityIssues.nullAnomalyDetails.map((issue, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-monokai-surface">
                    <span className="font-mono text-monokai-fg truncate max-w-[140px]">
                      {issue.table}.{issue.column}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-monokai-yellow font-mono text-2xs">{issue.nullCount} 空值 ({issue.nullRate}%)</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectTableWithFilter) {
                            onSelectTableWithFilter(issue.table, `"${issue.column}" IS NULL`);
                          } else {
                            onSelectTable && onSelectTable(issue.table);
                          }
                        }}
                        className="text-monokai-accent hover:underline font-mono text-2xs"
                        title="在数据网格中过滤显示空值行"
                      >
                        网格过滤 ↗
                      </button>
                      <button
                        type="button"
                        onClick={() => onInspectIssue && onInspectIssue(`SELECT * FROM "${issue.table}" WHERE "${issue.column}" IS NULL LIMIT 50;`)}
                        className="text-monokai-cyan hover:underline font-mono text-2xs"
                        title="在 SQL 工作台中查询"
                      >
                        SQL ↗
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
