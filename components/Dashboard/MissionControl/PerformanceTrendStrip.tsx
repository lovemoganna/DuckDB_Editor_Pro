import { formatValueBySpec } from '../../../utils/chartFormat';
import { queryHistogram as buildQueryHistogram, queryLatency, importGrowth, memorySnapshot } from '../../../services/analysis/telemetryCharts';
import React, { useState, useMemo } from 'react';
import { Activity, ChevronDown, ChevronRight } from 'lucide-react';
import { QueryHistoryItem } from '../../../types';
import {
  type DashboardDbMetrics,
  type RecentImportItem,
  type GrowthTrendItem,
  type LatencyTrendItem,
} from '../../../hooks/useDashboardWorkflow';
import {
  KpiPortalTooltip,
  type KpiTooltipData,
} from '../KpiDynamicMiniCharts';
import { DB } from '../dashboardUi';

interface PerformanceTrendStripProps {
  metrics: DashboardDbMetrics;
  allHistoryItems?: QueryHistoryItem[];
  recentImports?: RecentImportItem[];
  growthData?: GrowthTrendItem[];
  latencyData?: LatencyTrendItem[];
  onSelectQueryPoint?: (queryId: string, sql: string) => void;
  /** When true, charts stay collapsed until the user expands (keeps home calm). */
  defaultCollapsed?: boolean;
}

function formatQueryTime(timestamp?: number | string): string {
  if (!timestamp) return '刚刚';
  const d = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  if (isNaN(d.getTime())) return String(timestamp);
  return d.toTimeString().slice(0, 8);
}

export const PerformanceTrendStrip: React.FC<PerformanceTrendStripProps> = ({
  metrics,
  allHistoryItems = [],
  recentImports = [],
  growthData = [],
  latencyData = [],
  onSelectQueryPoint,
  defaultCollapsed = false,
}) => {
  const [activeRange, setActiveRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');
  const [tooltip, setTooltip] = useState<KpiTooltipData | null>(null);
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed);

  const ranges: Array<{ id: '1h' | '6h' | '24h' | '7d'; label: string }> = [
    { id: '1h', label: '1小时' },
    { id: '6h', label: '6小时' },
    { id: '24h', label: '24小时' },
    { id: '7d', label: '7天' },
  ];

  const rangeDurationMs = useMemo(() => {
    switch (activeRange) {
      case '1h':
        return 60 * 60 * 1000;
      case '6h':
        return 6 * 60 * 60 * 1000;
      case '24h':
        return 24 * 60 * 60 * 1000;
      case '7d':
        return 7 * 24 * 60 * 60 * 1000;
    }
  }, [activeRange]);

  // 1. Real Query Histogram Bucketing with interval details
  const { queryHistogram, histogramDetails, currentHistory, range, averageLatency, total:rangeQueryTotal, queryTrendLabel, latencyTrendLabel } = useMemo(() => buildQueryHistogram(allHistoryItems, rangeDurationMs, activeRange === '7d'), [allHistoryItems, rangeDurationMs, activeRange]);

  const maxBucketCount = Math.max(...queryHistogram, 1);

  // 2. Real Latency Waveform Curve with Interactive Points
  const { latencyCurvePath, latencyPoints } = useMemo(() => queryLatency(currentHistory,10,186,26,7,34,range), [currentHistory,range]);
  const { memoryPoints, memoryAreaPath, memoryLinePath } = useMemo(() => memorySnapshot(metrics.memoryPercentage, metrics.memoryTotalGb), [metrics.memoryPercentage, metrics.memoryTotalGb]);
  const { dataStepCurve, importPoints, totalFormatted: importedRows } = useMemo(() => importGrowth(recentImports,range), [recentImports,range]);

  // Real rolling time axis labels matching activeRange
  const timeLabels = useMemo(() => {
    const now = new Date();
    const labels: string[] = [];
    const stepMs =
      activeRange === '1h'
        ? 10 * 60 * 1000
        : activeRange === '6h'
          ? 60 * 60 * 1000
          : activeRange === '24h'
            ? 4 * 60 * 60 * 1000
            : 24 * 60 * 60 * 1000;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * stepMs);
      if (activeRange === '7d') {
        labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
      } else {
        labels.push(
          `${String(d.getHours()).padStart(2, '0')}:${String(
            activeRange === '1h' ? Math.floor(d.getMinutes() / 10) * 10 : 0,
          ).padStart(2, '0')}`,
        );
      }
    }
    return labels;
  }, [activeRange]);

  const importGrowthLabel = importPoints.length ? `当前时段 ${importPoints.length} 次成功导入` : '当前时段暂无成功导入';

  return (
    <>
      {isExpanded && <KpiPortalTooltip tooltip={tooltip} />}

      <div className={`${DB.panelLg} p-3`}>
        <div className={`flex items-center justify-between ${isExpanded ? 'border-b border-monokai-border pb-3' : ''}`}>
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className={`flex items-center gap-2 text-left min-w-0 ${DB.focus}`}
            aria-expanded={isExpanded}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-monokai-cyan/15 text-monokai-cyan border border-monokai-cyan/30">
              <Activity className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold text-monokai-fg tracking-tight font-sans">性能趋势</h2>
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-monokai-comment" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-monokai-comment" />
                )}
              </div>
              <span className="text-meta text-monokai-comment font-sans">
                {isExpanded ? '查询吞吐 · 延迟 · 导入节奏' : '点击展开时序与负载遥测'}
              </span>
            </div>
          </button>

          {isExpanded && (
            <div className="flex items-center gap-1 rounded-md border border-monokai-border bg-monokai-elevated p-0.5">
              {ranges.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setActiveRange(r.id)}
                  className={`rounded px-2.5 py-0.5 text-xs font-mono transition-colors cursor-pointer ${
                    activeRange === r.id
                      ? 'bg-monokai-accent text-monokai-bg font-bold shadow-xs'
                      : 'text-monokai-fg-muted hover:text-monokai-fg'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {isExpanded && (
        <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {/* 1. 查询次数 */}
          <div className="flex flex-col justify-between rounded-md border border-monokai-border bg-monokai-elevated/40 p-3 hover:border-monokai-cyan/50 hover:bg-monokai-hover/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-monokai-fg font-sans">查询次数</span>
              <span className="text-2xs font-mono text-monokai-cyan">时序柱状图</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-xl sm:text-2xl font-bold text-monokai-fg">
                {rangeQueryTotal}
              </span>
              {queryTrendLabel !== '—' && (
                <span
                  className={`font-mono text-xs font-semibold ${
                    queryTrendLabel.startsWith('-') ? 'text-monokai-pink' : 'text-monokai-accent'
                  }`}
                >
                  {queryTrendLabel}
                </span>
              )}
            </div>

            {/* Interactive Histogram with Tooltip */}
            <div
              className="mt-2 flex items-end gap-1.5 h-12 pt-2 border-b border-monokai-border"
              onMouseLeave={() => setTooltip(null)}
            >
              {queryHistogram.map((cnt, i) => {
                const h =
                  allHistoryItems.length === 0
                    ? 4
                    : Math.max(4, Math.round((cnt / maxBucketCount) * 36));
                const detail = histogramDetails[i];
                const hasQueries = detail.queries.length > 0;
                return (
                  <div
                    key={i}
                    onClick={() => {
                      if (hasQueries) {
                        const target = detail.queries.find((q) => q.status === 'error') || detail.queries[0];
                        onSelectQueryPoint?.(target.id, target.sql);
                      }
                    }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({
                        x: rect.left + rect.width / 2,
                        y: rect.top - 8,
                        title: `查询区间 · ${detail.startTime} - ${detail.endTime}`,
                        badge: {
                          label: `${cnt} 次查询`,
                          tone: cnt > 0 ? (detail.errorCount > 0 ? 'warn' : 'ok') : 'neutral',
                        },
                        items: [
                          { label: '执行总量', value: `${cnt} 次`, color: 'text-monokai-cyan' },
                          { label: '成功次数', value: `${detail.successCount} 次`, color: 'text-monokai-accent' },
                          { label: '报错次数', value: `${detail.errorCount} 次`, color: detail.errorCount > 0 ? 'text-monokai-pink' : 'text-monokai-comment' },
                          {
                            label: '区间占比',
                            value: formatValueBySpec(detail.percent, {percent:true,decimals:1}),
                          },
                        ],
                        footer: hasQueries ? '点击在上方查询流中定位并展开此区间记录' : '鼠标移动切换时段明细',
                      });
                    }}
                    className={`w-full rounded-xs transition-all duration-200 cursor-pointer ${
                      cnt > 0
                        ? 'bg-monokai-cyan/70 hover:bg-monokai-cyan hover:scale-y-110 origin-bottom shadow-xs'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                    style={{ height: `${h}px` }}
                  />
                );
              })}
            </div>

            <div className="mt-1.5 flex justify-between font-mono text-2xs text-monokai-comment">
              {timeLabels.map((lbl, idx) => (
                <span key={idx}>{lbl}</span>
              ))}
            </div>
          </div>

          {/* 2. 平均查询时间 */}
          <div className="flex flex-col justify-between rounded-md border border-monokai-border bg-monokai-elevated/40 p-3 hover:border-monokai-accent/50 hover:bg-monokai-hover/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-monokai-fg font-sans">平均查询时间</span>
              <span className="text-2xs font-mono text-monokai-accent">当前时段均值 · 曲线最近 10 次</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-xl sm:text-2xl font-bold text-monokai-fg">
                {averageLatency != null ? formatValueBySpec(averageLatency,{unit:'ms',decimals:1}) : '—'}
              </span>
              {latencyTrendLabel !== '—' && (
                <span
                  className={`font-mono text-xs font-semibold ${
                    latencyTrendLabel.startsWith('-') ? 'text-monokai-accent' : 'text-monokai-pink'
                  }`}
                >
                  {latencyTrendLabel}
                </span>
              )}
            </div>

            {/* Interactive SVG Line Waveform with Data Points */}
            <div
              className="mt-2 h-12 pt-2 border-b border-monokai-border relative"
              onMouseLeave={() => setTooltip(null)}
            >
              {allHistoryItems.length === 0 ? (
                <div
                  className="flex h-full w-full items-center justify-center opacity-40 hover:opacity-80 transition-opacity cursor-help"
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8,
                      title: '延迟基准趋势',
                      badge: { label: '待执行', tone: 'neutral' },
                      items: [{ label: '执行历史', value: '0 条记录' }],
                      footer: '运行 SQL 后自动生成耗时波形',
                    });
                  }}
                >
                  <div className="h-0.5 w-full rounded-full bg-monokai-accent/30" />
                </div>
              ) : (
                <svg className="h-full w-full overflow-visible" viewBox="0 0 200 40" fill="none">
                  {/* Dashed baseline for average */}
                  <line
                    x1="0"
                    y1="20"
                    x2="200"
                    y2="20"
                    stroke="rgba(255,255,255,0.1)"
                    strokeDasharray="3 3"
                  />

                  {/* Curve Path */}
                  {latencyCurvePath && (
                    <path
                      d={latencyCurvePath}
                      stroke="#a6e22e"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  )}

                  {/* Interactive Points */}
                  {latencyPoints.map((p, idx) => {
                    const diff = p.latency - (averageLatency ?? 0);
                    const diffLabel = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} ms vs 均值`;
                    return (
                      <g key={idx}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="8"
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({
                              x: rect.left + rect.width / 2,
                              y: rect.top - 8,
                              title: '查询耗时采样',
                              badge: {
                                label:
                                  p.latency < 50
                                    ? '极速 <50ms'
                                    : p.latency < 200
                                      ? '正常'
                                      : '偏慢',
                                tone:
                                  p.latency < 50
                                    ? 'ok'
                                    : p.latency < 200
                                      ? 'info'
                                      : 'warn',
                              },
                              items: [
                                {
                                  label: '执行延时',
                                  value: formatValueBySpec(p.latency,{unit:'ms',decimals:1}),
                                  color: 'text-monokai-accent',
                                },
                                {
                                  label: '均值对比',
                                  value: diffLabel,
                                  color: diff <= 0 ? 'text-monokai-accent' : 'text-monokai-yellow',
                                },
                                {
                                  label: '执行时刻',
                                  value: formatQueryTime(p.item.timestamp),
                                },
                                {
                                  label: 'SQL 摘要',
                                  value: p.item.sql
                                    ? `${p.item.sql.slice(0, 36)}${
                                        p.item.sql.length > 36 ? '...' : ''
                                      }`
                                    : 'SELECT ...',
                                  color: 'text-monokai-fg-muted',
                                },
                              ],
                              footer: '点击可在上方查询动态流中精准定位并展开诊断',
                            });
                          }}
                          onClick={() => {
                            onSelectQueryPoint?.(p.item.id, p.item.sql);
                          }}
                        />
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="3"
                          fill="#a6e22e"
                          className="pointer-events-none transition-transform hover:scale-150"
                        />
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>

            <div className="mt-1.5 flex justify-between font-mono text-2xs text-monokai-comment">
              {timeLabels.map((lbl, idx) => (
                <span key={idx}>{lbl}</span>
              ))}
            </div>
          </div>

          {/* 3. 内存使用 */}
          <div className="flex flex-col justify-between rounded-md border border-monokai-border bg-monokai-elevated/40 p-3 hover:border-monokai-purple/50 hover:bg-monokai-hover/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-monokai-fg font-sans">内存使用</span>
              <span className="text-2xs font-mono text-monokai-purple">Buffer 容量</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-xl sm:text-2xl font-bold text-monokai-fg">
                {metrics.memoryUsageFormatted || '—'}
              </span>
              <span className="font-mono text-xs text-monokai-purple font-semibold">
                {metrics.memoryPercentageDisplay || '未采集'}
              </span>
            </div>

            {/* Interactive SVG Area Chart */}
            <div
              className="mt-2 h-12 pt-2 border-b border-monokai-border relative"
              onMouseLeave={() => setTooltip(null)}
            >
              <svg
                className="h-full w-full overflow-visible"
                viewBox="0 0 200 40"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="purple-grad-trend-real" x1="0%" y1="0%" x2="0%" y2="1">
                    <stop offset="0%" stopColor="#ae81ff" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#ae81ff" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d={memoryAreaPath} fill="url(#purple-grad-trend-real)" />
                <path
                  d={memoryLinePath}
                  stroke="#ae81ff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />

                {/* Interactive Points on Memory Nodes */}
                {memoryPoints.map((pt, idx) => (
                  <g key={idx}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="7"
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({
                          x: rect.left + rect.width / 2,
                          y: rect.top - 8,
                          title: `内存遥测 · ${pt.label}`,
                          badge: {
                            label: metrics.memoryPercentageDisplay || '未采集',
                            tone: metrics.memoryPercentage > 80 ? 'warn' : 'ok',
                          },
                          items: [
                            {
                              label: '已用缓存',
                              value: metrics.memoryUsageFormatted || '未采集',
                              color: 'text-monokai-purple',
                            },
                            {
                              label: '最大限制',
                              value: metrics.memoryTotalGb > 0 ? `${metrics.memoryTotalGb} GB` : '未采集',
                            },
                            {
                              label: '运行模式',
                              value: metrics.modeLabel || '内存数据库',
                            },
                            {
                              label: '回收方式',
                              value: 'PRAGMA shrink_memory',
                              color: 'text-monokai-comment',
                            },
                          ],
                          footer: 'DuckDB Buffer Manager 实时管控',
                        });
                      }}
                    />
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="2.5"
                      fill="#ae81ff"
                      className="pointer-events-none"
                    />
                  </g>
                ))}
              </svg>
            </div>

            <div className="mt-1.5 flex justify-between font-mono text-2xs text-monokai-comment">
              <span>当前采样 · 无历史曲线</span>
            </div>
          </div>

          {/* 4. 数据量增长 */}
          <div className="flex flex-col justify-between rounded-md border border-monokai-border bg-monokai-elevated/40 p-3 hover:border-monokai-yellow/50 hover:bg-monokai-hover/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-monokai-fg font-sans">成功导入累计行数</span>
              <span className="text-2xs font-mono text-monokai-yellow">摄入阶梯</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-xl sm:text-2xl font-bold text-monokai-fg">
                {importedRows}
              </span>
              <span
                className={`font-mono text-xs font-semibold ${
                  importPoints.length > 0 ? 'text-monokai-yellow' : 'text-monokai-comment'
                }`}
              >
                {importGrowthLabel}
              </span>
            </div>

            {/* Real Step curve based on imports with Interactive Points */}
            <div
              className="mt-2 h-12 pt-2 border-b border-monokai-border relative"
              onMouseLeave={() => setTooltip(null)}
            >
              {importPoints.length === 0 ? (
                <div
                  className="flex h-full w-full items-center justify-center opacity-40 hover:opacity-80 transition-opacity cursor-help"
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8,
                      title: '数据摄入跟踪',
                      badge: { label: '暂无摄入', tone: 'neutral' },
                      items: [{ label: '导入历史', value: '0 次' }],
                      footer: '导入 CSV/Parquet 文件后自动绘制数据增长阶梯',
                    });
                  }}
                >
                  <div className="h-0.5 w-full rounded-full bg-monokai-yellow/30" />
                </div>
              ) : (
                <svg className="h-full w-full overflow-visible" viewBox="0 0 200 40" fill="none">
                  <path
                    d={dataStepCurve}
                    stroke="#e6db74"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {importPoints.map((p, idx) => (
                    <g key={idx}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="8"
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({
                            x: rect.left + rect.width / 2,
                            y: rect.top - 8,
                            title: `数据导入: ${p.item.name}`,
                            badge: {
                              label: `${(p.item.rowCount ?? 0).toLocaleString()} 行`,
                              tone: 'ok',
                            },
                            items: [
                              {
                                label: '目标表名',
                                value: p.item.tableName,
                                color: 'text-monokai-yellow',
                              },
                              {
                                label: '摄入行数',
                                value: `${(p.item.rowCount ?? 0).toLocaleString()} 行`,
                              },
                              { label: '导入时刻', value: p.item.importedAt || '刚刚' },
                              {
                                label: '处理状态',
                                value: p.item.status === 'success' ? '流式解析完成' : '导入中',
                              },
                            ],
                            footer: '零拷贝高效加载至 DuckDB 表',
                          });
                        }}
                      />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="3"
                        fill="#e6db74"
                        className="pointer-events-none transition-transform hover:scale-150"
                      />
                    </g>
                  ))}
                </svg>
              )}
            </div>

            <div className="mt-1.5 flex justify-between font-mono text-2xs text-monokai-comment">
              {timeLabels.map((lbl, idx) => (
                <span key={idx}>{lbl}</span>
              ))}
            </div>
          </div>
        </div>
        )}
      </div>
    </>
  );
};
