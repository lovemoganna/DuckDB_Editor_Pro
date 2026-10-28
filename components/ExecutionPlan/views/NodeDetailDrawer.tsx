/**
 * components/ExecutionPlan/views/NodeDetailDrawer.tsx
 *
 * Premium Inspector Drawer displaying full operator details upon node selection.
 * Adheres strictly to the requirement of separating:
 * - DuckDB Fact (ground-truth numbers directly from engine)
 * - Registry Knowledge (operator category definitions)
 * - Editor Pro Derived (diagnostic observations and SQL mapping)
 */

import React from 'react';
import {
  ExecutionNode,
  ExecutionPlanGraph,
} from '../model/types';
import { getCategoryTheme } from '../model/operatorRegistry';
import {
  X,
  Sparkles,
  Info,
  Layers,
  Database,
  Flame,
  AlertTriangle,
  Code,
  Gauge,
  CheckCircle2,
  HardDrive,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { toastService } from '../../../services/toastService';

export interface NodeDetailDrawerProps {
  node: ExecutionNode | null;
  graph: ExecutionPlanGraph;
  onClose: () => void;
  onSendToAi?: (operatorContext: string) => void;
}

export const NodeDetailDrawer: React.FC<NodeDetailDrawerProps> = ({
  node,
  graph,
  onClose,
  onSendToAi,
}) => {
  if (!node) return null;

  const theme = getCategoryTheme(node.category);
  const metrics = node.metrics;

  const handleAiOptimize = () => {
    if (!onSendToAi) return;
    const infoText = [
      `算子名称: ${node.name} (${node.chineseName})`,
      `类别: ${node.category}`,
      `实际产出行数: ${metrics.actualRows !== undefined ? metrics.actualRows : '未知'}`,
      `预估基数: ${metrics.estimatedRows !== undefined ? metrics.estimatedRows : '未知'}`,
      `耗时: ${metrics.timingMs !== undefined ? `${metrics.timingMs.toFixed(2)} ms` : '未测定'}`,
      `耗时占比: ${metrics.timingPercentage !== undefined ? `${metrics.timingPercentage.toFixed(1)}%` : '未知'}`,
      `额外属性: ${JSON.stringify(node.extraInfo)}`,
      node.diagnostics.length > 0
        ? `诊断现象: ${node.diagnostics.map(d => d.phenomenon).join('; ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    onSendToAi(infoText);
  };

  const handleCopyJson = () => {
    const rawData = {
      name: node.name,
      chineseName: node.chineseName,
      category: node.category,
      metrics: node.metrics,
      extraInfo: node.extraInfo,
      diagnostics: node.diagnostics,
      sqlHint: node.sqlHint,
    };
    navigator.clipboard.writeText(JSON.stringify(rawData, null, 2));
    toastService.success('已复制算子详细数据至剪贴板');
  };

  return (
    <div
      data-testid="node-detail-drawer"
      className="w-84 md:w-96 border-l border-monokai-border bg-monokai-sidebar/95 backdrop-blur-xl flex flex-col h-full shrink-0 shadow-2xl z-30 select-text"
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="p-3.5 border-b border-monokai-border flex items-center justify-between gap-2 bg-monokai-surface/70">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-[9.5px] px-2 py-0.5 rounded-md font-semibold uppercase tracking-wider border ${theme.badgeBg} ${theme.badgeText} border-transparent`}
            >
              {node.category}
            </span>
            <span className="font-bold text-sm text-monokai-fg truncate tracking-tight">
              {node.chineseName}
            </span>
          </div>
          <div className="font-mono text-xs text-monokai-comment/90 truncate mt-0.5 font-medium">
            {node.name}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCopyJson}
            title="复制该节点完整 JSON"
            className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="关闭详情"
            className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Scrollable Body ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs font-sans">
        {/* SECTION 1: Registry Knowledge */}
        <div className="rounded-xl p-3.5 bg-monokai-surface/60 border border-monokai-border/70 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-monokai-fg text-[11px] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-monokai-cyan" />
              算子释义与职责
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 font-mono font-medium">
              算子知识库
            </span>
          </div>
          <p className="text-monokai-fg/90 leading-relaxed text-[11.5px] font-medium">
            {node.summary}
          </p>
          {node.description && (
            <p className="text-monokai-comment text-[10.5px] leading-relaxed pt-1.5 border-t border-monokai-border/40">
              {node.description}
            </p>
          )}
        </div>

        {/* SECTION 2: Observed Diagnostics (if any) */}
        {node.diagnostics.length > 0 && (
          <div className="rounded-xl p-3.5 bg-rose-950/25 border border-rose-500/40 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-rose-300 text-[11px] flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                性能与健康诊断
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-mono font-medium">
                分析诊断
              </span>
            </div>
            <div className="space-y-1.5">
              {node.diagnostics.map((diag, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-monokai-bg/70 border border-rose-500/25">
                  <div className="font-semibold text-rose-400 text-[11px] mb-0.5">
                    {diag.title}
                  </div>
                  <div className="text-[10.5px] text-monokai-fg/90 leading-snug">
                    {diag.phenomenon}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 3: Performance Metrics (DuckDB Facts vs Derived) */}
        <div className="rounded-xl p-3.5 bg-monokai-surface/60 border border-monokai-border/70 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-monokai-fg text-[11px] flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-monokai-green" />
              执行与数据指标
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-mono font-medium">
              引擎实测
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-[10.5px]">
            <div className="p-2.5 rounded-lg bg-monokai-bg/70 border border-monokai-border/50">
              <div className="text-monokai-comment text-[9.5px]">实际产出行数:</div>
              <div className="font-bold text-emerald-400 text-xs mt-1">
                {metrics.actualRows !== undefined ? metrics.actualRows.toLocaleString() : '—'}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-monokai-bg/70 border border-monokai-border/50">
              <div className="text-monokai-comment text-[9.5px]">预估输出基数:</div>
              <div className="font-bold text-monokai-fg text-xs mt-1">
                {metrics.estimatedRows !== undefined ? metrics.estimatedRows.toLocaleString() : '—'}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-monokai-bg/70 border border-monokai-border/50">
              <div className="text-monokai-comment text-[9.5px]">单算子耗时:</div>
              <div className="font-bold text-yellow-300 text-xs mt-1">
                {metrics.timingMs !== undefined ? `${metrics.timingMs.toFixed(2)} ms` : '—'}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-monokai-bg/70 border border-monokai-border/50">
              <div className="text-monokai-comment text-[9.5px]">耗时占比 (推导):</div>
              <div className="font-bold text-monokai-fg text-xs mt-1 flex items-center gap-1.5">
                <span>{metrics.timingPercentage !== undefined ? `${metrics.timingPercentage.toFixed(1)}%` : '—'}</span>
                {metrics.timingPercentage !== undefined && (
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      metrics.timingPercentage >= 35
                        ? 'bg-rose-500'
                        : metrics.timingPercentage >= 15
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                  />
                )}
              </div>
            </div>

            {typeof metrics.rowsScanned === 'number' && (
              <div className="p-2.5 rounded-lg bg-monokai-bg/70 border border-monokai-border/50 col-span-2">
                <div className="text-monokai-comment text-[9.5px]">存储扫描行数:</div>
                <div className="font-bold text-sky-400 text-xs mt-1">
                  {metrics.rowsScanned.toLocaleString()} 行
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 4: Raw Extra Info from DuckDB */}
        {Object.keys(node.extraInfo).length > 0 && (
          <div className="rounded-xl p-3.5 bg-monokai-surface/60 border border-monokai-border/70 space-y-2 shadow-xs">
            <span className="font-semibold text-monokai-fg text-[11px] flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-monokai-orange" />
              引擎物理属性 (Extra Info)
            </span>

            <div className="space-y-1.5">
              {Object.entries(node.extraInfo).map(([key, val]) => (
                <div key={key} className="p-2.5 rounded-lg bg-monokai-bg/70 border border-monokai-border/40 font-mono text-[10px]">
                  <div className="text-monokai-comment text-[9px] uppercase tracking-wider font-semibold">{key}:</div>
                  <div className="text-monokai-fg break-all mt-0.5 leading-snug">
                    {Array.isArray(val) ? val.join(', ') : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 5: SQL Clause Mapping (Derived) */}
        {node.sqlHint && (
          <div className="rounded-xl p-3.5 bg-monokai-surface/60 border border-monokai-border/70 space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-monokai-fg text-[11px] flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-monokai-cyan" />
                关联 SQL 片段
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 font-mono font-medium">
                Editor Pro Derived
              </span>
            </div>
            <pre className="p-2.5 rounded-lg bg-monokai-bg/90 border border-monokai-border/50 font-mono text-[10.5px] text-monokai-cyan overflow-x-auto leading-relaxed">
              {node.sqlHint}
            </pre>
            <div className="text-[9.5px] text-monokai-comment/80 leading-normal">
              * 由 Editor Pro 基于算子元数据推导匹配，非 DuckDB 物理执行追踪事实。
            </div>
          </div>
        )}
      </div>

      {/* ── Footer Actions ─────────────────────────────────────────── */}
      {onSendToAi && (
        <div className="p-3 border-t border-monokai-border bg-monokai-surface/80">
          <button
            type="button"
            onClick={handleAiOptimize}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-monokai-cyan/20 to-monokai-cyan/10 hover:from-monokai-cyan/30 hover:to-monokai-cyan/20 text-monokai-cyan border border-monokai-cyan/50 font-semibold text-xs transition-all shadow-sm cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>帮我优化此算子 (AI Analyze)</span>
          </button>
        </div>
      )}
    </div>
  );
};
