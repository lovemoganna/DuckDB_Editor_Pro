/**
 * components/ExecutionPlan/canvas/HtmlNodeCard.tsx
 *
 * Glassmorphic HTML Card rendering an ExecutionNode on the Execution Canvas.
 * Dynamically adjusts presentation based on the active Lens:
 * - Explain Lens: Operator semantics & human explanation
 * - Data Lens: Data transformation, actual/estimated rows, scanned volume
 * - Cost Lens: Latency, operator timing, and percentage cost hotspot
 */

import React from 'react';
import {
  ExecutionNode,
  LensType,
  OperatorCategory,
} from '../model/types';
import { getCategoryTheme } from '../model/operatorRegistry';
import {
  AlertTriangle,
  Flame,
  Layers,
  Database,
  ArrowRight,
  TrendingUp,
  Filter,
  GitMerge,
  BarChart2,
  ArrowUpDown,
  AppWindow,
  Maximize2,
  HardDrive,
  Cpu,
  Zap,
} from 'lucide-react';

export interface HtmlNodeCardProps {
  node: ExecutionNode;
  lens: LensType;
  isSelected: boolean;
  isHighlighted: boolean;
  onSelect: (nodeId: string) => void;
}

function getCategoryIcon(category: OperatorCategory) {
  switch (category) {
    case 'scan':
      return HardDrive;
    case 'filter':
      return Filter;
    case 'join':
      return GitMerge;
    case 'aggregate':
      return BarChart2;
    case 'sort':
      return ArrowUpDown;
    case 'window':
      return AppWindow;
    case 'projection':
      return Layers;
    case 'result':
      return Maximize2;
    default:
      return Cpu;
  }
}

export const HtmlNodeCard: React.FC<HtmlNodeCardProps> = ({
  node,
  lens,
  isSelected,
  isHighlighted,
  onSelect,
}) => {
  const theme = getCategoryTheme(node.category);
  const metrics = node.metrics;
  const CategoryIcon = getCategoryIcon(node.category);
  const hasCriticalDiag = node.diagnostics.some(d => d.severity === 'critical');
  const hasWarningDiag = node.diagnostics.some(d => d.severity === 'warning');

  // Ring & shadow highlights
  const selectedRing = isSelected
    ? 'ring-2 ring-monokai-cyan shadow-[0_0_24px_rgba(102,217,239,0.4)] scale-[1.025] z-10'
    : isHighlighted
    ? 'ring-1.5 ring-monokai-accent/80 shadow-[0_0_14px_rgba(253,151,31,0.25)]'
    : 'hover:shadow-lg hover:border-monokai-cyan/60 hover:translate-y-[-1px]';

  const diagRing = hasCriticalDiag
    ? 'border-rose-500/80 shadow-[0_0_14px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/50'
    : hasWarningDiag
    ? 'border-amber-500/70 shadow-[0_0_10px_rgba(251,191,36,0.22)] ring-1 ring-amber-500/40'
    : '';

  // Extract key expression for Explain lens
  const keyDetail =
    node.extraInfo['Detail'] ||
    node.extraInfo['Table'] ||
    node.extraInfo['Function'] ||
    node.extraInfo['Filters'] ||
    node.extraInfo['Conditions'] ||
    node.extraInfo['Groups'] ||
    node.extraInfo['Projections'] ||
    '';

  const detailText = Array.isArray(keyDetail)
    ? keyDetail.join(', ')
    : typeof keyDetail === 'object'
    ? JSON.stringify(keyDetail)
    : String(keyDetail || '');

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`node-${node.id}`}
      aria-label={`${node.chineseName} (${node.name})`}
      onClick={() => onSelect(node.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(node.id);
      }}
      className={`w-[260px] h-[100px] select-none rounded-xl p-2.5 transition-all duration-200 cursor-pointer flex flex-col justify-between border backdrop-blur-md relative overflow-hidden ${
        theme.nodeBg
      } ${diagRing || theme.border} ${selectedRing} ${theme.glowShadow}`}
    >
      {/* Accent left indicator bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ backgroundColor: theme.accentColor }}
      />

      {/* ── Top Header: Icon, Name, Opcode, Badges ─────────────────── */}
      <div className="flex items-start justify-between gap-1.5 min-w-0 pl-1">
        <div className="min-w-0 flex-1 flex items-start gap-2">
          {/* Category Icon Badge */}
          <div className={`p-1 rounded-lg border shrink-0 flex items-center justify-center mt-0.5 ${theme.iconBg}`}>
            <CategoryIcon className="w-3.5 h-3.5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-monokai-fg truncate tracking-tight" title={node.chineseName}>
                {node.chineseName}
              </span>
              {node.isUnknownOperator && (
                <span className="text-[9px] px-1 py-0.2 bg-monokai-comment/20 text-monokai-comment rounded font-mono shrink-0">
                  未知
                </span>
              )}
            </div>
            <div className="font-mono text-[9.5px] text-monokai-comment/85 truncate font-medium" title={node.name}>
              {node.name}
            </div>
          </div>
        </div>

        {/* Category Badge or Diagnostic Icon */}
        <div className="flex items-center gap-1 shrink-0">
          {hasCriticalDiag ? (
            <span title={node.diagnostics[0]?.phenomenon} className="flex items-center text-rose-400 animate-pulse">
              <Flame className="w-3.5 h-3.5" />
            </span>
          ) : hasWarningDiag ? (
            <span title={node.diagnostics[0]?.phenomenon} className="flex items-center text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
          ) : null}

          <span
            className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold tracking-wide border uppercase ${theme.badgeBg} ${theme.badgeText} border-transparent`}
          >
            {node.category}
          </span>
        </div>
      </div>

      {/* ── Dynamic Lens Body ───────────────────────────────────────── */}
      <div className="pt-1.5 border-t border-monokai-border/40 min-h-0 flex-1 flex flex-col justify-center pl-1">
        {/* LENS 1: EXPLAIN */}
        {lens === 'explain' && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10.5px] text-monokai-fg/90 truncate leading-snug font-medium" title={node.summary}>
              {node.summary}
            </span>
            {detailText ? (
              <span className="font-mono text-[9px] text-monokai-cyan/90 truncate bg-monokai-bg/60 px-1 py-0.5 rounded" title={detailText}>
                {detailText}
              </span>
            ) : (
              <span className="text-[9px] text-monokai-comment/60 italic truncate">
                无特殊过滤/投影条件
              </span>
            )}
          </div>
        )}

        {/* LENS 2: DATA */}
        {lens === 'data' && (
          <div className="space-y-0.5 font-mono text-[10px]">
            <div className="flex items-center justify-between">
              <span className="text-monokai-comment text-[9px]">产出行数 (Actual):</span>
              <span className="font-bold text-emerald-400">
                {metrics.actualRows !== undefined ? metrics.actualRows.toLocaleString() : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between text-[9px] text-monokai-comment/80">
              <span>预估基数 (Est):</span>
              <span className="text-monokai-fg/80">
                {metrics.estimatedRows !== undefined ? metrics.estimatedRows.toLocaleString() : '—'}
              </span>
            </div>

            {typeof metrics.rowsScanned === 'number' && metrics.rowsScanned > 0 && (
              <div className="flex items-center justify-between text-[9px] text-sky-400/90">
                <span>读取扫描行:</span>
                <span className="font-semibold">{metrics.rowsScanned.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* LENS 3: COST */}
        {lens === 'cost' && (
          <div className="space-y-0.5 font-mono text-[10px]">
            <div className="flex items-center justify-between">
              <span className="text-monokai-comment text-[9px]">算子耗时:</span>
              <span
                className={`font-bold ${
                  (metrics.timingPercentage ?? 0) >= 35
                    ? 'text-rose-400'
                    : (metrics.timingPercentage ?? 0) >= 15
                    ? 'text-amber-400'
                    : 'text-yellow-300'
                }`}
              >
                {metrics.timingMs !== undefined ? `${metrics.timingMs.toFixed(2)} ms` : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between text-[9px] text-monokai-comment/80">
              <span>耗时占比:</span>
              <div className="flex items-center gap-1.5">
                {metrics.timingPercentage !== undefined && (
                  <div className="w-10 h-1.5 rounded-full bg-monokai-bg overflow-hidden border border-monokai-border/40">
                    <div
                      className={`h-full rounded-full ${
                        metrics.timingPercentage >= 35
                          ? 'bg-rose-500'
                          : metrics.timingPercentage >= 15
                          ? 'bg-amber-500'
                          : 'bg-monokai-yellow'
                      }`}
                      style={{ width: `${Math.min(100, metrics.timingPercentage)}%` }}
                    />
                  </div>
                )}
                <span
                  className={`font-semibold ${
                    (metrics.timingPercentage ?? 0) >= 35
                      ? 'text-rose-400 font-bold'
                      : (metrics.timingPercentage ?? 0) >= 15
                      ? 'text-amber-400'
                      : 'text-monokai-fg'
                  }`}
                >
                  {metrics.timingPercentage !== undefined ? `${metrics.timingPercentage.toFixed(1)}%` : '—'}
                </span>
              </div>
            </div>

            {typeof metrics.cpuTimeSeconds === 'number' && metrics.cpuTimeSeconds > 0 && (
              <div className="flex items-center justify-between text-[8.5px] text-monokai-comment/60">
                <span>CPU 时间:</span>
                <span>{(metrics.cpuTimeSeconds * 1000).toFixed(2)} ms</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
