import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { type QueryHistoryItem } from '../../types';
import { type TableItemDetail } from '../../hooks/useDashboardWorkflow';

// ============================================================================
// Tooltip Types & Portal Floating Component
// ============================================================================

export interface KpiTooltipData {
  x: number;
  y: number;
  title: string;
  badge?: {
    label: string;
    tone: 'ok' | 'warn' | 'danger' | 'info' | 'neutral';
  };
  items: Array<{
    label: string;
    value: string;
    color?: string;
  }>;
  footer?: string;
}

export const KpiPortalTooltip: React.FC<{ tooltip: KpiTooltipData | null }> = ({ tooltip }) => {
  if (!tooltip || typeof document === 'undefined') return null;

  // Clamp horizontal coordinate to avoid viewport overflow
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const clampedX = Math.max(100, Math.min(windowWidth - 110, tooltip.x));

  const badgeToneClass = (tone?: string) => {
    switch (tone) {
      case 'ok':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'warn':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'danger':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'neutral':
        return 'bg-slate-700/40 text-slate-300 border-slate-600/50';
      default:
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    }
  };

  return createPortal(
    <div
      role="tooltip"
      className="fixed z-[9999] pointer-events-none -translate-x-1/2 -translate-y-full transition-all duration-75 select-none animate-in fade-in zoom-in-95 duration-100"
      style={{ left: `${clampedX}px`, top: `${tooltip.y}px` }}
    >
      <div className="flex flex-col gap-1.5 rounded-lg border border-slate-700/80 bg-[#090d18]/95 px-3 py-2 shadow-2xl backdrop-blur-md text-xs min-w-[170px] max-w-[280px]">
        {/* Header with Title & Badge */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1">
          <span className="truncate font-semibold text-white tracking-tight" title={tooltip.title}>
            {tooltip.title}
          </span>
          {tooltip.badge && (
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono border ${badgeToneClass(
                tooltip.badge.tone,
              )}`}
            >
              {tooltip.badge.label}
            </span>
          )}
        </div>

        {/* Breakdown Items List */}
        <div className="space-y-1 font-mono text-[11px]">
          {tooltip.items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2">
              <span className="text-slate-400">{item.label}</span>
              <span className={`font-semibold ${item.color || 'text-slate-100'}`}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Optional Footer Hint */}
        {tooltip.footer && (
          <div className="border-t border-white/5 pt-1 text-[10px] text-slate-400 italic">
            {tooltip.footer}
          </div>
        )}
      </div>
      {/* Micro Arrow Pointer */}
      <div className="mx-auto -mt-px h-0 w-0 border-x-4 border-x-transparent border-t-4 border-t-[#090d18]" />
    </div>,
    document.body,
  );
};

// Helper to format timestamps cleanly
function formatTime(timestamp?: number | string): string {
  if (!timestamp) return '刚刚';
  const d = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  if (isNaN(d.getTime())) return String(timestamp);
  return d.toTimeString().slice(0, 8);
}

// ============================================================================
// 1. Table Distribution Mini Chart (Top Tables by Size / Rows)
// ============================================================================
interface TableDistributionMiniChartProps {
  tables?: TableItemDetail[];
  onTooltip?: (data: KpiTooltipData | null) => void;
}

export const TableDistributionMiniChart: React.FC<TableDistributionMiniChartProps> = ({
  tables = [],
  onTooltip,
}) => {
  const topTables = useMemo(() => {
    if (!tables || tables.length === 0) return [];
    return [...tables]
      .sort((a, b) => (b.rowCount || 0) - (a.rowCount || 0))
      .slice(0, 5);
  }, [tables]);

  const maxRows = useMemo(() => {
    if (topTables.length === 0) return 1;
    return Math.max(...topTables.map((t) => t.rowCount || 1), 1);
  }, [topTables]);

  const handleMouseEnter = (e: React.MouseEvent, t: TableItemDetail) => {
    if (!onTooltip) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      title: t.name,
      badge: {
        label: t.type || '物理表',
        tone: 'info',
      },
      items: [
        { label: '行数规模', value: `${t.formattedRowCount || t.rowCount.toLocaleString()} 行`, color: 'text-cyan-300' },
        { label: '存储占用', value: t.formattedSize || '0 B', color: 'text-sky-300' },
        { label: '所属模式', value: t.schema || 'main' },
        { label: '更新时间', value: t.updatedAt || '刚刚' },
      ],
      footer: '点击卡片直达数据浏览网格',
    });
  };

  if (topTables.length === 0) {
    return (
      <div
        className="flex h-8 w-12 items-center justify-center opacity-40 hover:opacity-90 transition-opacity cursor-help"
        onMouseEnter={(e) => {
          if (!onTooltip) return;
          const rect = e.currentTarget.getBoundingClientRect();
          onTooltip({
            x: rect.left + rect.width / 2,
            y: rect.top - 8,
            title: '数据表资产',
            badge: { label: '空库状态', tone: 'neutral' },
            items: [{ label: '物理表数', value: '0 张', color: 'text-slate-400' }],
            footer: '导入文件或执行 CREATE TABLE 即可生成分布柱图',
          });
        }}
        onMouseLeave={() => onTooltip?.(null)}
      >
        <div className="h-0.5 w-10 rounded-full bg-cyan-500/30" />
      </div>
    );
  }

  return (
    <div
      className="flex h-8 items-end justify-end gap-1.5 px-0.5"
      onMouseLeave={() => onTooltip?.(null)}
    >
      {topTables.map((table, idx) => {
        const heightPct = Math.max(20, Math.min(100, Math.round(((table.rowCount || 1) / maxRows) * 100)));
        return (
          <div
            key={table.name + idx}
            onMouseEnter={(e) => handleMouseEnter(e, table)}
            className="group/bar relative flex flex-col items-center justify-end h-full w-2 cursor-pointer"
          >
            <div
              style={{ height: `${heightPct}%` }}
              className="w-full rounded-xs bg-gradient-to-t from-cyan-600 via-sky-400 to-cyan-200 transition-all duration-200 group-hover/bar:brightness-125 group-hover/bar:shadow-sm group-hover/bar:shadow-cyan-400/80 group-hover/bar:w-2.5"
            />
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// 2. Table Row Volume Breakdown Mini Chart (Multi-Table Volume Distribution)
// ============================================================================
interface TableRowVolumeMiniChartProps {
  tables?: TableItemDetail[];
  totalRows?: number;
  onTooltip?: (data: KpiTooltipData | null) => void;
}

export const TableRowVolumeMiniChart: React.FC<TableRowVolumeMiniChartProps> = ({
  tables = [],
  totalRows = 0,
  onTooltip,
}) => {
  const topTables = useMemo(() => {
    if (!tables || tables.length === 0) return [];
    return [...tables]
      .sort((a, b) => (b.rowCount || 0) - (a.rowCount || 0))
      .slice(0, 4);
  }, [tables]);

  const maxRows = useMemo(() => {
    if (topTables.length === 0) return 1;
    return Math.max(...topTables.map((t) => t.rowCount || 1), 1);
  }, [topTables]);

  const handleMouseEnter = (e: React.MouseEvent, t: TableItemDetail) => {
    if (!onTooltip) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sharePct = totalRows > 0 ? ((t.rowCount / totalRows) * 100).toFixed(1) : '100';
    onTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      title: t.name,
      badge: {
        label: `占比 ${sharePct}%`,
        tone: 'ok',
      },
      items: [
        { label: '表行数', value: `${t.formattedRowCount || t.rowCount.toLocaleString()} 行`, color: 'text-emerald-300' },
        { label: '库总行数', value: `${totalRows.toLocaleString()} 行` },
        { label: '数据架构', value: t.schema || 'main' },
        { label: '字段列数', value: t.columnCount ? `${t.columnCount} 列` : '—' },
      ],
      footer: '点击卡片直达行数洞察分析',
    });
  };

  if (topTables.length === 0) {
    return (
      <div
        className="flex h-8 w-12 items-center justify-center opacity-40 hover:opacity-90 transition-opacity cursor-help"
        onMouseEnter={(e) => {
          if (!onTooltip) return;
          const rect = e.currentTarget.getBoundingClientRect();
          onTooltip({
            x: rect.left + rect.width / 2,
            y: rect.top - 8,
            title: '行数规模统计',
            badge: { label: '暂无数据', tone: 'neutral' },
            items: [{ label: '总记录数', value: '0 行', color: 'text-slate-400' }],
            footer: '载入数据后将动态展示各表行数占比',
          });
        }}
        onMouseLeave={() => onTooltip?.(null)}
      >
        <div className="h-0.5 w-10 rounded-full bg-emerald-500/30" />
      </div>
    );
  }

  return (
    <div
      className="flex h-8 items-end justify-end gap-1 px-0.5"
      onMouseLeave={() => onTooltip?.(null)}
    >
      {topTables.map((table, idx) => {
        const heightPct = Math.max(22, Math.min(100, Math.round(((table.rowCount || 1) / maxRows) * 100)));
        return (
          <div
            key={table.name + idx}
            onMouseEnter={(e) => handleMouseEnter(e, table)}
            className="group/vol relative flex flex-col items-center justify-end h-full w-2 cursor-pointer"
          >
            <div
              style={{ height: `${heightPct}%` }}
              className="w-full rounded-xs bg-gradient-to-t from-emerald-700 via-emerald-400 to-lime-300 transition-all duration-200 group-hover/vol:brightness-125 group-hover/vol:shadow-sm group-hover/vol:shadow-emerald-400/80 group-hover/vol:w-2.5"
            />
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// 3. Query Timeline Sparkline (Real Queries Plotted Chronologically)
// ============================================================================
interface QueryTimelineSparklineProps {
  historyItems?: QueryHistoryItem[];
  totalQueries?: number;
  successRatePct?: number;
  onTooltip?: (data: KpiTooltipData | null) => void;
}

export const QueryTimelineSparkline: React.FC<QueryTimelineSparklineProps> = ({
  historyItems = [],
  totalQueries = 0,
  successRatePct = 100,
  onTooltip,
}) => {
  const sampleQueries = useMemo(() => {
    if (!historyItems || historyItems.length === 0) return [];
    // Take the last 8 queries in chronological order (left to right)
    return [...historyItems.slice(0, 8)].reverse();
  }, [historyItems]);

  const maxLatency = useMemo(() => {
    if (sampleQueries.length === 0) return 50;
    return Math.max(...sampleQueries.map((q) => q.executionTime || 10), 30);
  }, [sampleQueries]);

  const points = useMemo(() => {
    if (sampleQueries.length < 2) return [];
    const width = 56;
    const height = 20;
    return sampleQueries.map((item, index) => {
      const x = (index / (sampleQueries.length - 1)) * width + 2;
      const normalizedLatency = Math.min(item.executionTime || 10, maxLatency);
      const y = height - (normalizedLatency / maxLatency) * 16 + 2;
      return { x, y, item };
    });
  }, [sampleQueries, maxLatency]);

  const pathD = useMemo(() => {
    if (points.length < 2) return '';
    return `M ${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`;
  }, [points]);

  const handlePointHover = (e: React.MouseEvent, item: QueryHistoryItem) => {
    if (!onTooltip) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isSuccess = item.status === 'success';
    onTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      title: isSuccess ? 'SQL 查询成功' : 'SQL 查询报错',
      badge: {
        label: isSuccess ? '200 OK' : 'ERROR',
        tone: isSuccess ? 'ok' : 'danger',
      },
      items: [
        { label: '执行耗时', value: `${(item.executionTime || 0).toFixed(1)} ms`, color: 'text-amber-300' },
        { label: '执行时间', value: formatTime(item.timestamp) },
        { label: '返回行数', value: `${item.affectedRows ?? 0} 行` },
        {
          label: 'SQL 摘要',
          value: item.sql ? `${item.sql.slice(0, 36)}${item.sql.length > 36 ? '...' : ''}` : 'SELECT ...',
          color: 'text-slate-300',
        },
      ],
      footer: '点击卡片前往 SQL 工作台重跑或探查',
    });
  };

  if (sampleQueries.length === 0) {
    return (
      <div
        className="flex h-7 w-14 items-center justify-center opacity-40 hover:opacity-90 transition-opacity cursor-help shrink-0"
        onMouseEnter={(e) => {
          if (!onTooltip) return;
          const rect = e.currentTarget.getBoundingClientRect();
          onTooltip({
            x: rect.left + rect.width / 2,
            y: rect.top - 8,
            title: '查询执行时序',
            badge: { label: '待执行', tone: 'neutral' },
            items: [{ label: '历史记录', value: '0 次', color: 'text-slate-400' }],
            footer: '在 SQL 编辑器执行查询后自动绘制时序走势',
          });
        }}
        onMouseLeave={() => onTooltip?.(null)}
      >
        <div className="h-0.5 w-12 rounded-full bg-amber-500/30" />
      </div>
    );
  }

  return (
    <svg
      className="h-7 w-14 text-amber-300 overflow-visible shrink-0 select-none"
      viewBox="0 0 60 24"
      fill="none"
      onMouseLeave={() => onTooltip?.(null)}
    >
      <defs>
        <linearGradient id="amber-glow-path" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ca8a04" />
          <stop offset="100%" stopColor="#facc15" />
        </linearGradient>
      </defs>

      {/* Sparkline Connecting Path */}
      {pathD && (
        <path
          d={pathD}
          stroke="url(#amber-glow-path)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Interactive Dots for Each Query */}
      {points.map((p, idx) => {
        const isSuccess = p.item.status === 'success';
        const isLast = idx === points.length - 1;
        return (
          <g key={p.item.id || idx}>
            {/* Transparent Hit Area for Easy Mouse Hover */}
            <circle
              cx={p.x}
              cy={p.y}
              r="7"
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={(e) => handlePointHover(e, p.item)}
            />
            {/* Visible Data Dot */}
            <circle
              cx={p.x}
              cy={p.y}
              r={isLast ? 3.5 : 2.5}
              fill={isSuccess ? (isLast ? '#fde047' : '#eab308') : '#f43f5e'}
              className={`transition-transform duration-150 hover:scale-150 pointer-events-none ${
                isLast ? 'animate-pulse' : ''
              }`}
            />
          </g>
        );
      })}
    </svg>
  );
};

// ============================================================================
// 4. Latency Trend Sparkline (Real Execution Latencies & Benchmark)
// ============================================================================
interface LatencyTrendSparklineProps {
  historyItems?: QueryHistoryItem[];
  avgLatencyMs?: number;
  onTooltip?: (data: KpiTooltipData | null) => void;
}

export const LatencyTrendSparkline: React.FC<LatencyTrendSparklineProps> = ({
  historyItems = [],
  avgLatencyMs = 0,
  onTooltip,
}) => {
  const sampleQueries = useMemo(() => {
    if (!historyItems || historyItems.length === 0) return [];
    return [...historyItems.slice(0, 8)].reverse();
  }, [historyItems]);

  const maxLatency = useMemo(() => {
    if (sampleQueries.length === 0) return 60;
    return Math.max(...sampleQueries.map((q) => q.executionTime || 10), avgLatencyMs * 1.5, 40);
  }, [sampleQueries, avgLatencyMs]);

  const points = useMemo(() => {
    if (sampleQueries.length < 2) return [];
    const width = 56;
    const height = 20;
    return sampleQueries.map((item, index) => {
      const x = (index / (sampleQueries.length - 1)) * width + 2;
      const latency = item.executionTime || 1;
      const y = height - (latency / maxLatency) * 16 + 2;
      return { x, y, latency, item };
    });
  }, [sampleQueries, maxLatency]);

  const pathD = useMemo(() => {
    if (points.length < 2) return '';
    return `M ${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`;
  }, [points]);

  const avgLineY = useMemo(() => {
    const height = 20;
    return height - (Math.min(avgLatencyMs, maxLatency) / maxLatency) * 16 + 2;
  }, [avgLatencyMs, maxLatency]);

  const handlePointHover = (e: React.MouseEvent, item: QueryHistoryItem, latency: number) => {
    if (!onTooltip) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const diff = latency - avgLatencyMs;
    const diffLabel = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} ms vs 均值`;
    onTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      title: '查询执行耗时',
      badge: {
        label: latency < 50 ? '极速 <50ms' : latency < 200 ? '正常' : '偏慢',
        tone: latency < 50 ? 'ok' : latency < 200 ? 'info' : 'warn',
      },
      items: [
        { label: '本次耗时', value: `${latency.toFixed(1)} ms`, color: 'text-cyan-300' },
        { label: '均值对比', value: diffLabel, color: diff <= 0 ? 'text-emerald-400' : 'text-amber-400' },
        { label: '执行时间', value: formatTime(item.timestamp) },
        {
          label: '查询语句',
          value: item.sql ? `${item.sql.slice(0, 36)}${item.sql.length > 36 ? '...' : ''}` : 'SELECT ...',
          color: 'text-slate-300',
        },
      ],
      footer: '基于本地 WebAssembly 引擎原生运行',
    });
  };

  if (sampleQueries.length === 0) {
    return (
      <div
        className="flex h-7 w-14 items-center justify-center opacity-40 hover:opacity-90 transition-opacity cursor-help shrink-0"
        onMouseEnter={(e) => {
          if (!onTooltip) return;
          const rect = e.currentTarget.getBoundingClientRect();
          onTooltip({
            x: rect.left + rect.width / 2,
            y: rect.top - 8,
            title: '延迟基准走势',
            badge: { label: '待测量', tone: 'neutral' },
            items: [{ label: '平均耗时', value: '—', color: 'text-slate-400' }],
            footer: '运行 SQL 后将生成延迟波动曲线与基准线',
          });
        }}
        onMouseLeave={() => onTooltip?.(null)}
      >
        <div className="h-0.5 w-12 rounded-full bg-cyan-500/30" />
      </div>
    );
  }

  return (
    <svg
      className="h-7 w-14 text-cyan-400 overflow-visible shrink-0 select-none"
      viewBox="0 0 60 24"
      fill="none"
      onMouseLeave={() => onTooltip?.(null)}
    >
      {/* Dashed Average Baseline */}
      {avgLatencyMs > 0 && (
        <line
          x1="2"
          y1={avgLineY}
          x2="58"
          y2={avgLineY}
          stroke="#06b6d4"
          strokeWidth="1"
          strokeDasharray="2 2"
          opacity="0.5"
        />
      )}

      {/* Latency Curve */}
      {pathD && (
        <path
          d={pathD}
          stroke="#22d3ee"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Interactive Points */}
      {points.map((p, idx) => (
        <g key={p.item.id || idx}>
          <circle
            cx={p.x}
            cy={p.y}
            r="7"
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={(e) => handlePointHover(e, p.item, p.latency)}
          />
          <circle
            cx={p.x}
            cy={p.y}
            r="2.5"
            fill="#38bdf8"
            className="transition-transform duration-150 hover:scale-150 pointer-events-none"
          />
        </g>
      ))}
    </svg>
  );
};

// ============================================================================
// 5. WASM Worker Telemetry Visualizer (4 Subsystem Pulse Channels)
// ============================================================================
interface WasmWorkerTelemetryMiniChartProps {
  activeSessions?: number;
  onTooltip?: (data: KpiTooltipData | null) => void;
}

export const WasmWorkerTelemetryMiniChart: React.FC<WasmWorkerTelemetryMiniChartProps> = ({
  activeSessions = 1,
  onTooltip,
}) => {
  const subsystems = [
    { name: 'Worker 主线程', status: '运行中', spec: 'WASM Dedicated Worker', height: 'h-4', tone: 'ok' },
    { name: 'SIMD 指令集', status: '已启用', spec: '128-bit 矢量化加速', height: 'h-6', tone: 'ok' },
    { name: 'Arrow IPC 缓冲区', status: '就绪', spec: '零拷贝 SharedArrayBuffer', height: 'h-7', tone: 'info' },
    { name: 'OPFS / 内存映射', status: '已挂载', spec: 'Origin Private FileSystem', height: 'h-5', tone: 'ok' },
  ] as const;

  const handleBarHover = (e: React.MouseEvent, sub: typeof subsystems[number]) => {
    if (!onTooltip) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      title: sub.name,
      badge: {
        label: sub.status,
        tone: sub.tone as any,
      },
      items: [
        { label: '子系统架构', value: sub.spec, color: 'text-purple-300' },
        { label: '活跃连接数', value: `${activeSessions} 个会话` },
        { label: '调度引擎', value: 'WebAssembly 1.33' },
      ],
      footer: '点击卡片前往系统偏好设置配置 Worker 参数',
    });
  };

  return (
    <div
      className="flex items-end justify-end gap-1 h-8 shrink-0 pb-0.5 px-0.5"
      onMouseLeave={() => onTooltip?.(null)}
    >
      {subsystems.map((sub, i) => (
        <div
          key={i}
          onMouseEnter={(e) => handleBarHover(e, sub)}
          className={`w-1.5 ${sub.height} rounded-xs cursor-pointer transition-all duration-200 bg-gradient-to-t from-purple-700 via-purple-500 to-indigo-300 hover:brightness-125 hover:shadow-xs hover:shadow-purple-400/60 hover:w-2`}
        />
      ))}
    </div>
  );
};

// ============================================================================
// 6. Memory Gauge Mini Chart (Interactive Capacity Meter)
// ============================================================================
interface MemoryGaugeMiniChartProps {
  memoryPercentage?: number;
  memoryUsageFormatted?: string;
  memoryPercentageDisplay?: string;
  memoryTotalGb?: number;
  isShrinking?: boolean;
  onTooltip?: (data: KpiTooltipData | null) => void;
}

export const MemoryGaugeMiniChart: React.FC<MemoryGaugeMiniChartProps> = ({
  memoryPercentage = 0,
  memoryUsageFormatted = '0 B',
  memoryPercentageDisplay = '< 1%',
  memoryTotalGb = 2.0,
  isShrinking = false,
  onTooltip,
}) => {
  const handleMouseEnter = (e: React.MouseEvent) => {
    if (!onTooltip) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      title: 'DuckDB 内存缓冲池',
      badge: {
        label: isShrinking ? '回收中...' : '正常',
        tone: isShrinking ? 'warn' : 'ok',
      },
      items: [
        { label: '当前已用', value: memoryUsageFormatted, color: 'text-cyan-300' },
        { label: '预算上限', value: `${memoryTotalGb} GB` },
        { label: '池占用率', value: memoryPercentageDisplay, color: 'text-sky-300' },
        { label: '缓冲策略', value: 'LRU 内存替换' },
      ],
      footer: '点击卡片立即触发 PRAGMA shrink_memory 回收缓存',
    });
  };

  const clampedPct = Math.max(10, Math.min(100, memoryPercentage));

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => onTooltip?.(null)}
      className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-800/80 border border-white/5 cursor-pointer relative group/meter"
    >
      <div
        className={`h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 transition-all duration-300 group-hover/meter:brightness-125 group-hover/meter:shadow-xs group-hover/meter:shadow-cyan-400/50 ${
          isShrinking ? 'animate-pulse' : ''
        }`}
        style={{ width: `${clampedPct}%` }}
      />
    </div>
  );
};
