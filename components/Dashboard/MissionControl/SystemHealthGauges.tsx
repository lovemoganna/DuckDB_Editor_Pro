import React, { useMemo, useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, Cpu, HardDrive, Database, Zap } from 'lucide-react';
import { type DashboardDbMetrics } from '../../../hooks/useDashboardWorkflow';
import { duckDBService } from '../../../services/duckdbService';
import { KpiPortalTooltip, type KpiTooltipData } from '../KpiDynamicMiniCharts';

export interface SystemHealthGaugesProps {
  metrics: DashboardDbMetrics;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  embedded?: boolean;
}

interface GaugeProps {
  label: string;
  value: string;
  subtext: string;
  percentage: number;
  color: string;
  glowColor: string;
  strokeColor: string;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}

const CircularGauge: React.FC<GaugeProps> = ({
  label,
  value,
  subtext,
  percentage,
  strokeColor,
  glowColor,
  onMouseEnter,
  onMouseLeave,
}) => {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const validPercentage = typeof percentage === 'number' && !Number.isNaN(percentage) ? percentage : 0;
  const strokeDashoffset = circumference - (Math.max(0, Math.min(100, validPercentage)) / 100) * circumference;

  // Normalize display: convert MiB/GiB/KiB to MB/GB/KB to fit cleanly without truncation
  const displayVal = value.replace('MiB', 'MB').replace('GiB', 'GB').replace('KiB', 'KB');
  const fontSize = displayVal.length > 7 ? 'text-3xs' : displayVal.length > 5 ? 'text-2xs' : 'text-xs';

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-md bg-monokai-elevated/50 border border-monokai-border hover:border-monokai-border-strong hover:bg-monokai-hover/60 transition-all cursor-pointer group"
    >
      <span className="font-mono text-2xs font-bold text-monokai-fg-muted mb-0.5 group-hover:text-monokai-fg transition-colors truncate max-w-full">
        {label}
      </span>
      <div className="relative flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10">
        <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 50 50">
          {/* Background Track */}
          <circle
            cx="25"
            cy="25"
            r={radius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="3.5"
            fill="transparent"
          />
          {/* Progress Arc */}
          <circle
            cx="25"
            cy="25"
            r={radius}
            stroke={strokeColor}
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{
              transition: 'stroke-dashoffset 0.8s ease-in-out',
            }}
          />
        </svg>

        {/* Center Text with responsive font size */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-0.5">
          <span className={`font-mono font-bold text-monokai-fg tracking-tight leading-none ${fontSize}`}>
            {displayVal}
          </span>
        </div>
      </div>

      <span className="mt-1 text-center font-mono text-2xs text-monokai-comment truncate max-w-[72px]" title={subtext}>
        {subtext}
      </span>
    </div>
  );
};

export const SystemHealthGauges: React.FC<SystemHealthGaugesProps> = ({
  metrics,
  onRefresh,
  isRefreshing = false,
  embedded = false,
}) => {
  const [currentTime, setCurrentTime] = useState(() => new Date().toTimeString().split(' ')[0]);
  const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [tooltip, setTooltip] = useState<KpiTooltipData | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toTimeString().split(' ')[0]);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real Storage Quota Estimation via Browser API
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      navigator.storage
        .estimate()
        .then((est) => {
          if (est.usage != null && est.quota != null) {
            setStorageEstimate({ usage: est.usage, quota: est.quota });
          }
        })
        .catch(() => {});
    }
  }, [metrics.dataSize]);

  // Query activity is observable; CPU utilization is not exposed by the browser.
  const isExecuting = Boolean(isRefreshing || duckDBService.isBatchRunning?.());
  const engineActivity = isExecuting ? 100 : 0;
  const engineText = isExecuting ? '计算中' : '空闲';

  // Real Storage calculation
  const storagePercentage = useMemo(() => {
    if (storageEstimate && storageEstimate.quota > 0) {
      return (storageEstimate.usage / storageEstimate.quota) * 100;
    }
    return 0;
  }, [storageEstimate, metrics.rawSizeBytes]);

  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;

  const handleCpuHover = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      title: 'WASM 向量计算引擎',
      badge: {
        label: isExecuting ? '计算中' : '就绪待命',
        tone: isExecuting ? 'warn' : 'ok',
      },
      items: [
        { label: '硬件线程', value: cores ? `${cores} (HardwareConcurrency)` : '未采集' },
        { label: '向量指令集', value: '128-bit SIMD', color: 'text-monokai-cyan' },
        { label: '执行载体', value: 'Dedicated WebWorker' },
        { label: '执行状态', value: engineText, color: isExecuting ? 'text-monokai-yellow' : 'text-monokai-accent' },
      ],
      footer: '显示查询执行状态；浏览器未提供 CPU 利用率',
    });
  };

  const handleMemoryHover = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      title: 'DuckDB 内存管理器',
      badge: {
        label: metrics.memoryPercentageDisplay || '0%',
        tone: metrics.memoryPercentage > 80 ? 'warn' : 'ok',
      },
      items: [
        { label: '已分配缓冲', value: metrics.memoryUsageFormatted || '0 B', color: 'text-monokai-yellow' },
        { label: '缓冲池上限', value: metrics.memoryTotalGb > 0 ? `${metrics.memoryTotalGb} GB` : '未采集' },
        { label: '持久化架构', value: metrics.modeLabel || '内存数据库' },
        { label: '内存优化', value: 'PRAGMA shrink_memory;' },
      ],
      footer: '基于 DuckDB Buffer Manager 实时遥测',
    });
  };

  const handleDiskHover = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const quotaGb = storageEstimate ? (storageEstimate.quota / (1024 * 1024 * 1024)).toFixed(1) : '—';
    const usedGb = storageEstimate ? (storageEstimate.usage / (1024 * 1024 * 1024)).toFixed(2) : '—';
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      title: '本地存储配额与空间',
      badge: {
        label: storageEstimate ? `${storagePercentage.toFixed(2)}% 配额已用` : '配额未采集',
        tone: storagePercentage > 80 ? 'warn' : 'info',
      },
      items: [
        { label: '表数据占用', value: metrics.dataSize || '0 B', color: 'text-monokai-purple' },
        { label: '浏览器配额', value: `${quotaGb} GB` },
        { label: '已用总空间', value: `${usedGb} GB` },
        { label: '底层介质', value: metrics.isPersistent ? 'IndexedDB / OPFS' : '内存临时虚拟盘' },
      ],
      footer: '支持断网离线安全访问',
    });
  };

  const handleSuccessHover = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const total = metrics.totalQueries;
    const ok = total - metrics.errorCount;
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      title: 'SQL 查询质量评估',
      badge: {
        label: total > 0 ? `${metrics.successRatePct}% 成功率` : '暂无执行',
        tone: metrics.errorCount > 0 ? 'warn' : 'ok',
      },
      items: [
        { label: '成功查询', value: `${ok} 次`, color: 'text-monokai-accent' },
        { label: '报错中断', value: `${metrics.errorCount} 次`, color: metrics.errorCount > 0 ? 'text-monokai-pink' : 'text-monokai-comment' },
        { label: '累计执行', value: `${total} 次` },
        { label: '平均耗时', value: metrics.formattedAvgLatency || '—' },
      ],
      footer: '执行失败可展开 EXPLAIN 详细诊断',
    });
  };

  const gaugeContent = (
    <div className="grid grid-cols-4 gap-1.5">
      {/* 1. CPU */}
      <CircularGauge
        label="引擎"
        value={engineText}
        subtext="执行状态"
        percentage={engineActivity}
        strokeColor="#66d9ef"
        glowColor="rgba(102, 217, 239, 0.4)"
        color="text-monokai-cyan"
        onMouseEnter={handleCpuHover}
        onMouseLeave={() => setTooltip(null)}
      />

      {/* 2. 内存 */}
      <CircularGauge
        label="内存"
        value={metrics.memoryUsageFormatted || '—'}
        subtext={metrics.memoryPercentageDisplay || '0%'}
        percentage={metrics.memoryPercentage}
        strokeColor="#e6db74"
        glowColor="rgba(230, 219, 116, 0.4)"
        color="text-monokai-yellow"
        onMouseEnter={handleMemoryHover}
        onMouseLeave={() => setTooltip(null)}
      />

      {/* 3. 磁盘 */}
      <CircularGauge
        label="磁盘"
        value={metrics.dataSize || '—'}
        subtext="表体积估算"
        percentage={storagePercentage}
        strokeColor="#ae81ff"
        glowColor="rgba(174, 129, 255, 0.4)"
        color="text-monokai-purple"
        onMouseEnter={handleDiskHover}
        onMouseLeave={() => setTooltip(null)}
      />

      {/* 4. 查询成功率 */}
      <CircularGauge
        label="查询成功率"
        value={metrics.totalQueries > 0 ? `${metrics.successRatePct}%` : '—'}
        subtext={
          metrics.totalQueries > 0
            ? `${metrics.totalQueries - metrics.errorCount}/${metrics.totalQueries}`
            : '0/0'
        }
        percentage={metrics.totalQueries > 0 ? metrics.successRatePct : 0}
        strokeColor="#a6e22e"
        glowColor="rgba(166, 226, 46, 0.4)"
        color="text-monokai-accent"
        onMouseEnter={handleSuccessHover}
        onMouseLeave={() => setTooltip(null)}
      />
    </div>
  );

  if (embedded) {
    return (
      <>
        <KpiPortalTooltip tooltip={tooltip} />
        <div className="relative z-10 border-t border-monokai-border pt-3 mt-auto flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-monokai-accent/15 text-monokai-accent border border-monokai-accent/30">
                <ShieldCheck className="h-3 w-3" />
              </span>
              <h3 className="text-xs font-bold text-monokai-fg tracking-tight font-sans">系统状态</h3>
              <span className="flex items-center gap-1 text-meta font-mono text-monokai-accent font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-monokai-accent animate-pulse" />
                {isExecuting ? '计算中' : '引擎空闲'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-meta font-mono text-monokai-comment">
              <span>{currentTime}</span>
              <button
                type="button"
                onClick={onRefresh}
                className="p-1 hover:text-monokai-fg transition-colors cursor-pointer"
                title="手动刷新健康度指标"
              >
                <RefreshCw
                  className={`h-3 w-3 ${isRefreshing ? 'animate-spin text-monokai-accent' : ''}`}
                />
              </button>
            </div>
          </div>

          {gaugeContent}
        </div>
      </>
    );
  }

  return (
    <>
      <KpiPortalTooltip tooltip={tooltip} />
      <div className="relative flex flex-col overflow-hidden rounded-md border border-monokai-border bg-monokai-surface p-4 shadow-xs group shrink-0">
        {/* Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-monokai-border pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-monokai-accent/15 text-monokai-accent border border-monokai-accent/30">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-bold text-monokai-fg tracking-tight font-sans">系统状态</h2>
            <span className="flex items-center gap-1 text-xs font-mono text-monokai-accent font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-monokai-accent animate-pulse" />
              {isExecuting ? '计算中' : '引擎空闲'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-monokai-comment">
            <span>最后更新 {currentTime}</span>
            <button
              type="button"
              onClick={onRefresh}
              className="p-1 hover:text-monokai-fg transition-colors cursor-pointer"
              title="手动刷新健康度指标"
            >
              <RefreshCw
                className={`h-3 w-3 ${isRefreshing ? 'animate-spin text-monokai-accent' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* 4 Circular Gauges */}
        <div className="relative z-10 mt-3">{gaugeContent}</div>
      </div>
    </>
  );
};
