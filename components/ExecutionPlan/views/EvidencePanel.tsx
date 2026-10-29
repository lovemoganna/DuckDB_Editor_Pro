/**
 * components/ExecutionPlan/views/EvidencePanel.tsx
 *
 * Professional Evidence & Raw Audit Panel for Execution Plans.
 * Offers two distinct, complementary tabs:
 * 1. Text Outline: Strictly aligned, readable execution plan outline with aligned metrics matrix and tree.
 * 2. Raw JSON: Beautifully indented engine JSON with search, quick-copy, and collapse.
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  FileJson,
  ListTree,
  Search,
  Code2,
  Table,
  AlignLeft,
  Flame,
  AlertTriangle,
  HardDrive,
  Clock,
  Layers,
} from 'lucide-react';
import { ExecutionPlanGraph, ExecutionNode } from '../model/types';
import { toastService } from '../../../services/toastService';

export interface EvidencePanelProps {
  graph?: ExecutionPlanGraph;
  rawJson?: any;
  rawText?: string;
  outlineText?: string;
  onClose: () => void;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  graph,
  rawJson,
  rawText,
  outlineText,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'outline' | 'json'>('outline');
  const [outlineViewMode, setOutlineViewMode] = useState<'table' | 'text'>('table');
  const [copied, setCopied] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  // Formatted JSON string
  const jsonString = useMemo(() => {
    if (!rawJson) return '/* 无结构化引擎 JSON 数据 */';
    try {
      return typeof rawJson === 'string' ? JSON.stringify(JSON.parse(rawJson), null, 2) : JSON.stringify(rawJson, null, 2);
    } catch {
      return String(rawJson);
    }
  }, [rawJson]);

  // Clean outline text
  const cleanOutlineText = useMemo(() => {
    if (outlineText && outlineText.trim()) return outlineText;
    if (rawText && rawText.trim()) {
      if (rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
        try {
          return JSON.stringify(JSON.parse(rawText), null, 2);
        } catch {
          return rawText;
        }
      }
      return rawText;
    }
    return '/* 暂无物理计划大纲 */';
  }, [outlineText, rawText]);

  const activeContent = activeTab === 'outline' ? cleanOutlineText : jsonString;

  // Filter text lines if search query is provided
  const displayContent = useMemo(() => {
    if (!filterQuery.trim()) return activeContent;
    const q = filterQuery.toLowerCase();
    const lines = activeContent.split('\n');
    return lines
      .filter(line => line.toLowerCase().includes(q))
      .join('\n');
  }, [activeContent, filterQuery]);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    toastService.success(activeTab === 'outline' ? '已复制物理大纲文本' : '已复制格式化 JSON 原文');
    setTimeout(() => setCopied(false), 2000);
  };

  // Structured metrics list from graph
  const tableNodes = useMemo(() => {
    if (!graph || graph.nodes.size === 0) return [];
    const list = Array.from(graph.nodes.values()) as ExecutionNode[];
    if (!filterQuery.trim()) return list;
    const q = filterQuery.toLowerCase();
    return list.filter(
      n =>
        n.name.toLowerCase().includes(q) ||
        n.chineseName.toLowerCase().includes(q) ||
        n.category.toLowerCase().includes(q) ||
        JSON.stringify(n.extraInfo).toLowerCase().includes(q)
    );
  }, [graph, filterQuery]);

  return (
    <div
      data-testid="evidence-panel"
      className="absolute inset-x-3 bottom-3 top-14 z-40 bg-monokai-sidebar/95 backdrop-blur-xl border border-monokai-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-[fadeIn_0.15s]"
    >
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <div className="px-4 py-2.5 border-b border-monokai-border flex items-center justify-between gap-3 bg-monokai-surface/80 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-bold text-xs text-monokai-fg flex items-center gap-1.5 shrink-0">
            <Code2 className="w-4 h-4 text-monokai-cyan" />
            <span>执行计划审计与证据数据 (Evidence)</span>
          </span>

          {/* Subtabs */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-monokai-bg border border-monokai-border/70 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('outline')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'outline'
                  ? 'bg-monokai-elevated text-monokai-green shadow-xs'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <ListTree className="w-3.5 h-3.5" />
              <span>结构化大纲文本</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('json')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'json'
                  ? 'bg-monokai-elevated text-monokai-cyan shadow-xs'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>引擎 JSON 原文</span>
            </button>
          </div>

          {/* Outline Display Sub-Mode (Table Alignment vs Raw Plain Text) */}
          {activeTab === 'outline' && graph && graph.nodes.size > 0 && (
            <div className="flex items-center p-0.5 rounded-lg bg-monokai-bg border border-monokai-border/60 shrink-0">
              <button
                type="button"
                onClick={() => setOutlineViewMode('table')}
                title="表格对齐视图（各列严格对齐）"
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  outlineViewMode === 'table' ? 'bg-monokai-elevated text-monokai-cyan' : 'text-monokai-comment hover:text-monokai-fg'
                }`}
              >
                <Table className="w-3 h-3" />
                <span>对齐排版</span>
              </button>
              <button
                type="button"
                onClick={() => setOutlineViewMode('text')}
                title="纯文本视图 (ASCII 大纲)"
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  outlineViewMode === 'text' ? 'bg-monokai-elevated text-monokai-cyan' : 'text-monokai-comment hover:text-monokai-fg'
                }`}
              >
                <AlignLeft className="w-3 h-3" />
                <span>纯文本</span>
              </button>
            </div>
          )}

          {/* Line Filter Input */}
          <div className="relative w-40 md:w-56 hidden sm:block">
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="过滤关键字..."
              className="w-full h-7 pl-7 pr-2 rounded-lg bg-monokai-bg border border-monokai-border text-xs text-monokai-fg placeholder:text-monokai-comment/60 focus:outline-none focus:border-monokai-cyan/60 font-mono"
            />
            <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-monokai-comment" />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-monokai-comment hover:text-monokai-fg"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            title="复制当前大纲文本"
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-monokai-border bg-monokai-bg text-xs font-mono text-monokai-fg hover:border-monokai-cyan/60 hover:text-monokai-cyan transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-monokai-green" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制' : '复制内容'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            title="关闭审计面板"
            className="p-1 rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Content View ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4 bg-monokai-bg select-text">
        {activeTab === 'outline' && outlineViewMode === 'table' && graph && graph.nodes.size > 0 ? (
          <div className="space-y-4 max-w-6xl mx-auto">
            {/* Header KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-monokai-surface/60 border border-monokai-border flex items-center justify-between">
                <div className="flex items-center gap-2 text-monokai-comment text-xs">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>查询耗时</span>
                </div>
                <div className="font-mono text-xs font-bold text-amber-300">
                  {typeof graph.queryLatencySeconds === 'number'
                    ? `${(graph.queryLatencySeconds * 1000).toFixed(2)} ms`
                    : '无 (未测耗时)'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-monokai-surface/60 border border-monokai-border flex items-center justify-between">
                <div className="flex items-center gap-2 text-monokai-comment text-xs">
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  <span>CPU 耗时</span>
                </div>
                <div className="font-mono text-xs font-bold text-rose-300">
                  {typeof graph.queryCpuTimeSeconds === 'number'
                    ? `${(graph.queryCpuTimeSeconds * 1000).toFixed(2)} ms`
                    : '无'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-monokai-surface/60 border border-monokai-border flex items-center justify-between">
                <div className="flex items-center gap-2 text-monokai-comment text-xs">
                  <Layers className="w-3.5 h-3.5 text-monokai-cyan" />
                  <span>算子节点数</span>
                </div>
                <div className="font-mono text-xs font-bold text-monokai-fg">
                  {graph.nodes.size} 个
                </div>
              </div>

              <div className="p-3 rounded-xl bg-monokai-surface/60 border border-monokai-border flex items-center justify-between">
                <div className="flex items-center gap-2 text-monokai-comment text-xs">
                  <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                  <span>峰值内存</span>
                </div>
                <div className="font-mono text-xs font-bold text-emerald-300">
                  {typeof graph.systemPeakMemoryBytes === 'number' && graph.systemPeakMemoryBytes > 0
                    ? `${(graph.systemPeakMemoryBytes / (1024 * 1024)).toFixed(2)} MB`
                    : '-'}
                </div>
              </div>
            </div>

            {/* Aligned Operator Metrics Table */}
            <div className="rounded-xl border border-monokai-border overflow-hidden bg-monokai-surface/40 shadow-xs">
              <div className="px-3 py-2 bg-monokai-surface/80 border-b border-monokai-border flex items-center justify-between">
                <span className="text-xs font-bold text-monokai-fg flex items-center gap-2">
                  <Table className="w-3.5 h-3.5 text-monokai-cyan" />
                  <span>算子指标对齐矩阵表 (Operator Metrics Matrix)</span>
                </span>
                <span className="text-[11px] font-mono text-monokai-comment">共 {tableNodes.length} 个步骤</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-monokai-border bg-monokai-surface/90 text-monokai-comment text-[11px]">
                      <th className="py-2 px-3 text-left font-semibold">算子类别与名称</th>
                      <th className="py-2 px-3 text-right font-semibold">耗时 (ms)</th>
                      <th className="py-2 px-3 text-right font-semibold">实际产出行</th>
                      <th className="py-2 px-3 text-right font-semibold">扫描行数</th>
                      <th className="py-2 px-3 text-right font-semibold">预估行数</th>
                      <th className="py-2 px-3 text-left font-semibold">关键属性 / 谓词条件</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-monokai-border/50">
                    {tableNodes.map(node => {
                      const detailList = [
                        node.extraInfo['Table'] ? `Table: ${node.extraInfo['Table']}` : null,
                        node.extraInfo['Filters'] ? `Filter: ${node.extraInfo['Filters']}` : null,
                        node.extraInfo['Conditions'] ? `On: ${node.extraInfo['Conditions']}` : null,
                        node.extraInfo['Projections'] ? `Projections: ${node.extraInfo['Projections']}` : null,
                      ].filter(Boolean);

                      return (
                        <tr
                          key={node.id}
                          className="hover:bg-monokai-elevated/40 transition-colors group"
                        >
                          <td className="py-2 px-3 text-left font-medium text-monokai-fg whitespace-nowrap">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-monokai-bg border border-monokai-border/80 text-monokai-cyan mr-1.5">
                              {node.category.toUpperCase()}
                            </span>
                            <span>{node.chineseName}</span>
                            <span className="text-monokai-comment ml-1 text-[11px]">({node.name})</span>
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-amber-300 font-bold whitespace-nowrap">
                            {node.metrics.timingMs !== undefined ? `${node.metrics.timingMs.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-emerald-300 font-semibold whitespace-nowrap">
                            {node.metrics.actualRows !== undefined ? node.metrics.actualRows.toLocaleString() : '-'}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-sky-300 whitespace-nowrap">
                            {node.metrics.rowsScanned !== undefined ? node.metrics.rowsScanned.toLocaleString() : '-'}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-monokai-comment whitespace-nowrap">
                            {node.metrics.estimatedRows !== undefined ? node.metrics.estimatedRows.toLocaleString() : '-'}
                          </td>
                          <td className="py-2 px-3 text-left text-monokai-fg/80 max-w-xs truncate text-[11px]">
                            {detailList.length > 0 ? detailList.join(' | ') : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Indented Tree Outline Card */}
            <div className="rounded-xl border border-monokai-border p-3.5 bg-monokai-surface/30">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-monokai-border/60">
                <span className="text-xs font-bold text-monokai-fg flex items-center gap-1.5">
                  <ListTree className="w-3.5 h-3.5 text-monokai-green" />
                  <span>执行树大纲 (Execution Hierarchy Outline)</span>
                </span>
                <span className="text-[11px] text-monokai-comment">首尾贯通 · 严格对齐</span>
              </div>
              <pre
                className="text-monokai-fg/90 whitespace-pre font-mono text-xs leading-relaxed select-text"
                style={{
                  fontFamily: "ui-monospace, 'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {displayContent}
              </pre>
            </div>
          </div>
        ) : (
          <pre
            className="text-monokai-fg/95 whitespace-pre leading-relaxed select-text tracking-tight font-mono text-xs"
            style={{
              fontFamily: "ui-monospace, 'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
              fontVariantNumeric: 'tabular-nums',
              tabSize: 4,
            }}
          >
            {displayContent || (filterQuery ? '/* 无匹配行 */' : '/* 内容为空 */')}
          </pre>
        )}
      </div>
    </div>
  );
};
