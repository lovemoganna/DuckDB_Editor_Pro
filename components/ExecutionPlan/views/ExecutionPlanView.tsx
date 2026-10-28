/**
 * components/ExecutionPlan/views/ExecutionPlanView.tsx
 *
 * Master Query X-Ray / Execution Canvas Component.
 *
 * Fully refactored Execution Plan viewer for DuckDB Editor Pro.
 * Replaces ASCII box parsing with structured JSON Execution Model.
 * Supports Explain / Data / Cost lenses on identical topology.
 * Provides explicit profiling execution, evidence drawer, error isolation,
 * and high-visibility status overview strip.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Layers,
  Database,
  Gauge,
  Search,
  Sparkles,
  Zap,
  RotateCcw,
  FileCode,
  AlertTriangle,
  Loader2,
  X,
  FileText,
  Flame,
  Clock,
  HardDrive,
  Info,
  CheckCircle2,
  ArrowLeftRight,
  ArrowDownUp,
} from 'lucide-react';
import {
  LensType,
  LayoutDirection,
  ExecutionPlanGraph,
} from '../model/types';
import { buildExecutionModel } from '../model/planParser';
import { formatExecutionGraphAsTextOutline } from '../model/formatPlanText';
import { ExecutionCanvas } from '../canvas/ExecutionCanvas';
import { NodeDetailDrawer } from './NodeDetailDrawer';
import { EvidencePanel } from './EvidencePanel';

export interface ExecutionPlanViewProps {
  planText?: string;
  jsonPlan?: any;
  loading?: boolean;
  totalRows?: number;
  executionTime?: number;
  activeSql?: string;
  planSourceSql?: string;
  planFetchedAt?: number | null;
  analyzeMode?: boolean;
  onAnalyzeModeChange?: (analyze: boolean) => void;
  onSendToAi?: (operatorContext: string) => void;
  onRefreshExplain?: () => void;
  initialLens?: LensType;
}

export const ExecutionPlanView: React.FC<ExecutionPlanViewProps> = ({
  planText = '',
  jsonPlan,
  loading = false,
  totalRows,
  executionTime,
  activeSql,
  planSourceSql,
  planFetchedAt,
  analyzeMode = false,
  onAnalyzeModeChange,
  onSendToAi,
  onRefreshExplain,
  initialLens = 'explain',
}) => {
  const [lens, setLens] = useState<LensType>(initialLens);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [direction, setDirection] = useState<LayoutDirection>('LR');

  // Build unified ExecutionModel from structured JSON or fallback
  const graph: ExecutionPlanGraph = useMemo(() => {
    try {
      if (jsonPlan) {
        return buildExecutionModel(jsonPlan, { rawText: planText, fullSql: activeSql });
      }
      if (planText) {
        return buildExecutionModel(planText, { rawText: planText, fullSql: activeSql });
      }
    } catch (parseErr: any) {
      console.error('Failed to build execution model:', parseErr);
      return {
        rootNodeId: '',
        nodes: new Map(),
        edges: [],
        isAnalyzed: false,
        rawText: planText,
        error: `执行计划解析异常: ${parseErr.message || String(parseErr)}`,
      };
    }

    return {
      rootNodeId: '',
      nodes: new Map(),
      edges: [],
      isAnalyzed: false,
      rawText: planText,
    };
  }, [jsonPlan, planText, activeSql]);

  // Formatted ASCII outline tree for evidence & audit tab
  const outlineText = useMemo(() => formatExecutionGraphAsTextOutline(graph), [graph]);

  // Keep selected node state valid
  useEffect(() => {
    if (selectedNodeId && !graph.nodes.has(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [graph, selectedNodeId]);

  // Filtered nodes search
  const searchedNodeId = useMemo(() => {
    if (!searchTerm.trim()) return null;
    const term = searchTerm.toLowerCase();
    for (const [id, node] of graph.nodes) {
      if (
        node.name.toLowerCase().includes(term) ||
        node.chineseName.toLowerCase().includes(term) ||
        node.summary.toLowerCase().includes(term) ||
        String(node.extraInfo['Table'] || '').toLowerCase().includes(term)
      ) {
        return id;
      }
    }
    return null;
  }, [searchTerm, graph]);

  const activeSelectedId = selectedNodeId || searchedNodeId;
  const selectedNode = activeSelectedId ? graph.nodes.get(activeSelectedId) ?? null : null;

  // Compute graph-wide aggregate metrics
  const graphSummary = useMemo(() => {
    let totalOutputRows = 0;
    let totalScanned = 0;
    let maxTimingMs = 0;
    let bottleneckNode: { id: string; name: string; chineseName: string; ms: number } | null = null;
    let warningCount = 0;

    for (const node of graph.nodes.values()) {
      if (typeof node.metrics.actualRows === 'number') {
        totalOutputRows = Math.max(totalOutputRows, node.metrics.actualRows);
      }
      if (typeof node.metrics.rowsScanned === 'number') {
        totalScanned += node.metrics.rowsScanned;
      }
      if (typeof node.metrics.timingMs === 'number' && node.metrics.timingMs > maxTimingMs) {
        maxTimingMs = node.metrics.timingMs;
        bottleneckNode = {
          id: node.id,
          name: node.name,
          chineseName: node.chineseName,
          ms: node.metrics.timingMs,
        };
      }
      if (node.diagnostics.length > 0) {
        warningCount += node.diagnostics.length;
      }
    }

    return {
      nodeCount: graph.nodes.size,
      totalOutputRows,
      totalScanned,
      bottleneckNode,
      warningCount,
    };
  }, [graph]);

  // Format DuckDB query latency (Fact)
  const formattedLatency = useMemo(() => {
    if (typeof graph.queryLatencySeconds === 'number') {
      return `${(graph.queryLatencySeconds * 1000).toFixed(2)} ms`;
    }
    if (typeof executionTime === 'number' && executionTime > 0) {
      return `${executionTime.toFixed(1)} ms`;
    }
    return null;
  }, [graph.queryLatencySeconds, executionTime]);

  // Format DuckDB query CPU time (Fact)
  const formattedCpuTime = useMemo(() => {
    if (typeof graph.queryCpuTimeSeconds === 'number') {
      return `${(graph.queryCpuTimeSeconds * 1000).toFixed(2)} ms`;
    }
    return null;
  }, [graph.queryCpuTimeSeconds]);

  // Check error state
  const isPlanTextError = Boolean(
    planText.startsWith('Error explaining') ||
    planText.startsWith('执行计划解析异常') ||
    planText.startsWith('刷新执行计划失败')
  );

  const isError = Boolean(graph.error || isPlanTextError);

  const errorMessage = isPlanTextError
    ? planText.replace(/^(执行计划解析异常:\s*|Error explaining query:\s*|刷新执行计划失败:\s*)/i, '').trim()
    : graph.error || planText;

  return (
    <div
      data-testid="execution-plan-view"
      className="flex flex-col w-full h-full bg-monokai-bg relative overflow-hidden select-none font-sans"
    >
      {/* ── Top Toolbar ─────────────────────────────────────────────── */}
      <div className="h-11 border-b border-monokai-border bg-monokai-sidebar/95 px-3 flex items-center justify-between gap-3 shrink-0 z-20">
        {/* Left: Lens Switcher & Search */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Three Lens Switcher Tabs */}
          <div className="flex items-center p-0.5 rounded-lg bg-monokai-bg border border-monokai-border/80 shadow-inner">
            <button
              type="button"
              role="tab"
              aria-selected={lens === 'explain'}
              onClick={() => setLens('explain')}
              title="Explain Lens: 算子物理含义与语义解读"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                lens === 'explain'
                  ? 'bg-monokai-elevated text-monokai-cyan shadow-sm ring-1 ring-monokai-cyan/30'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Explain</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={lens === 'data'}
              onClick={() => setLens('data')}
              title="Data Lens: 真实数据行数、缩减比与扫描量"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                lens === 'data'
                  ? 'bg-monokai-elevated text-monokai-green shadow-sm ring-1 ring-monokai-green/30'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Data</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={lens === 'cost'}
              onClick={() => setLens('cost')}
              title="Cost Lens: 算子耗时分布与计算成本热点"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                lens === 'cost'
                  ? 'bg-monokai-elevated text-monokai-yellow shadow-sm ring-1 ring-monokai-yellow/30'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>Cost</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-36 md:w-48 hidden sm:block">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索算子 / 表名..."
              className="w-full h-7 pl-7 pr-2 rounded-lg bg-monokai-bg border border-monokai-border text-xs text-monokai-fg placeholder:text-monokai-comment/60 focus:outline-none focus:border-monokai-cyan/60"
            />
            <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-monokai-comment" />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-monokai-comment hover:text-monokai-fg"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Facts, Profiling Button, Evidence & Refresh */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Query Latency Fact Badge */}
          {formattedLatency && (
            <div
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-monokai-bg border border-monokai-border text-[11px] font-mono text-monokai-fg"
              title="整体查询耗时 (DuckDB Fact)"
            >
              <Clock className="w-3 h-3 text-monokai-comment" />
              <span className="text-monokai-comment text-[10px]">Latency:</span>
              <span className="font-bold text-monokai-cyan">{formattedLatency}</span>
            </div>
          )}

          {/* CPU Time Fact Badge */}
          {formattedCpuTime && (
            <div
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-monokai-bg border border-monokai-border text-[11px] font-mono text-monokai-fg"
              title="累计 CPU 运行时间 (DuckDB Fact)"
            >
              <span className="text-monokai-comment text-[10px]">CPU:</span>
              <span className="text-monokai-fg/90">{formattedCpuTime}</span>
            </div>
          )}

          {/* Horizontal / Vertical layout toggle button */}
          <button
            type="button"
            onClick={() => setDirection(d => (d === 'LR' ? 'BT' : 'LR'))}
            title={direction === 'LR' ? '当前：横向布局 (LR)，点击切换为纵向布局 (BT)' : '当前：纵向布局 (BT)，点击切换为横向布局 (LR)'}
            className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              direction === 'LR'
                ? 'bg-monokai-elevated text-monokai-cyan border-monokai-cyan/50 shadow-xs'
                : 'bg-monokai-bg border-monokai-border text-monokai-comment hover:text-monokai-fg'
            }`}
          >
            {direction === 'LR' ? <ArrowLeftRight className="w-3.5 h-3.5 text-monokai-cyan" /> : <ArrowDownUp className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{direction === 'LR' ? '横向' : '纵向'}</span>
          </button>

          {/* Explicit Profiling Action Button */}
          {onAnalyzeModeChange && (
            <button
              type="button"
              onClick={() => onAnalyzeModeChange(!analyzeMode)}
              title={analyzeMode ? '已处于性能测试模式' : '执行带性能剖析的物理执行计划 (EXPLAIN ANALYZE)'}
              className={`flex items-center gap-1 h-7 px-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                analyzeMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                  : 'bg-monokai-bg border-monokai-border text-monokai-comment hover:text-monokai-fg hover:border-monokai-comment'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>测耗时</span>
            </button>
          )}

          {/* Evidence Drawer Button */}
          <button
            type="button"
            onClick={() => setShowEvidence(!showEvidence)}
            title="查看 / 隐藏引擎原文"
            className={`flex items-center gap-1 h-7 px-2.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
              showEvidence
                ? 'bg-monokai-elevated text-monokai-cyan border-monokai-cyan/50 shadow-xs'
                : 'bg-monokai-bg border-monokai-border text-monokai-comment hover:text-monokai-fg'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">原始数据</span>
          </button>

          {/* Refresh Button */}
          {onRefreshExplain && (
            <button
              type="button"
              onClick={onRefreshExplain}
              disabled={loading}
              title="重新获取执行计划"
              className="h-7 w-7 flex items-center justify-center rounded-lg border border-monokai-border bg-monokai-bg text-monokai-comment hover:text-monokai-fg hover:border-monokai-cyan/40 transition-colors disabled:opacity-40 cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* ── Sub-header Metrics Strip ─────────────────────────────────── */}
      {!isError && graph.nodes.size > 0 && (
        <div className="h-7 px-3 border-b border-monokai-border/60 bg-monokai-surface/40 flex items-center justify-between text-[11px] font-sans text-monokai-comment shrink-0 z-10">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="font-semibold text-monokai-fg">{graphSummary.nodeCount}</span> 物理算子
            </span>
            {graphSummary.totalScanned > 0 && (
              <span className="flex items-center gap-1 text-sky-400">
                <HardDrive className="w-3 h-3" />
                <span>扫描 {graphSummary.totalScanned.toLocaleString()} 行</span>
              </span>
            )}
            {graphSummary.bottleneckNode && (
              <button
                type="button"
                onClick={() => setSelectedNodeId(graphSummary.bottleneckNode!.id)}
                title="点击直接定位并查看该瓶颈算子详情"
                className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-amber-500/30 transition-all cursor-pointer shadow-xs"
              >
                <Flame className="w-3 h-3 text-amber-400 shrink-0" />
                <span>耗时瓶颈: {graphSummary.bottleneckNode.chineseName} ({graphSummary.bottleneckNode.ms.toFixed(2)} ms)</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {graphSummary.warningCount > 0 ? (
              <span className="flex items-center gap-1 text-rose-400 font-medium">
                <AlertTriangle className="w-3 h-3" />
                <span>{graphSummary.warningCount} 项诊断建议</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400/80">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>拓扑健康</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Main Canvas & View Area ─────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Loading State */}
        {loading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-monokai-bg/80 backdrop-blur-xs">
            <Loader2 className="w-7 h-7 text-monokai-cyan animate-spin mb-2" />
            <span className="text-xs font-medium text-monokai-fg">正在解读执行步骤</span>
            <span className="text-[11px] text-monokai-comment mt-1">从 DuckDB 获取物理计划拓扑与性能指标...</span>
          </div>
        )}

        {/* Error State */}
        {isError && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-text">
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-3">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="font-bold text-sm text-monokai-fg mb-1">无法生成执行计划</div>
            <p className="text-xs text-rose-400/90 max-w-md mb-4 leading-relaxed font-mono">
              {errorMessage}
            </p>
            {onRefreshExplain && (
              <button
                type="button"
                onClick={onRefreshExplain}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-monokai-border bg-monokai-surface text-xs font-semibold text-monokai-fg hover:border-monokai-cyan/50 hover:text-monokai-cyan transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>重试刷新</span>
              </button>
            )}
          </div>
        )}

        {/* Empty State */}
        {!isError && !loading && graph.nodes.size === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-monokai-comment select-none">
            <Layers className="w-8 h-8 opacity-40 mb-2" />
            <span className="text-xs font-medium text-monokai-fg/80">还没有执行步骤</span>
            <span className="text-[11px] text-monokai-comment mt-1">在上方编辑器输入 SQL 后将自动展现执行计划拓扑</span>
          </div>
        )}

        {/* Interactive Canvas View */}
        {!isError && graph.nodes.size > 0 && (
          <div className="flex-1 min-h-0 flex relative">
            <ExecutionCanvas
              graph={graph}
              lens={lens}
              selectedNodeId={activeSelectedId}
              onSelectNode={setSelectedNodeId}
              direction={direction}
              onDirectionChange={setDirection}
            />

            {/* Inspector Drawer */}
            {selectedNode && (
              <NodeDetailDrawer
                node={selectedNode}
                graph={graph}
                onClose={() => setSelectedNodeId(null)}
                onSendToAi={onSendToAi}
              />
            )}
          </div>
        )}

        {/* Evidence Panel (Text Outline / Raw JSON) */}
        {showEvidence && (
          <EvidencePanel
            graph={graph}
            rawJson={graph.rawJson}
            rawText={graph.rawText || planText}
            outlineText={outlineText}
            onClose={() => setShowEvidence(false)}
          />
        )}
      </div>
    </div>
  );
};

export default ExecutionPlanView;
