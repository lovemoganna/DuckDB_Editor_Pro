/**
 * GraphOverlayPanels — Controls, Stats, Legend, Search, Context Menu
 *
 * Design: Monokai dark, flat, minimal. No glow effects, no spring animations,
 * no bright accent fills. All controls use ctrl-btn / ctrl-pill / ctrl-input system.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Network, RefreshCw, Loader2, HelpCircle, Trash2,
  AlertTriangle, ChevronDown, ChevronRight, Download, FileText,
  FileSpreadsheet, Image, Code, Database, Search, X, Settings, RotateCcw, EyeOff
} from 'lucide-react';
import type { GraphNode } from './D3GraphView/D3GraphView.types';

// ── Local palette (Monokai only, used sparingly) ────────────────────────────
const C = {
  fg:    '#f8f8f2',
  muted: '#75715e',
  blue:  '#66d9ef',
  green: '#a6e22e',
  yel:   '#e6db74',
  orange:'#fd971f',
  pur:   '#ae81ff',
  pink:  '#f92672',
} as const;

// ── SectionCard — bare collapsible divider, no chrome ────────────────────────
interface SectionCardProps {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  label, children, defaultOpen = true,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-1 py-1.5 text-left"
      >
        <span className="text-[10px] text-monokai-comment">{label}</span>
        <ChevronRight
          className={`w-3 h-3 text-monokai-muted ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && (
        <div className="px-1 pb-2 space-y-1.5">
          {children}
        </div>
      )}
    </div>
  );
};

// ── Export Dropdown ──────────────────────────────────────────────────────────
const ExportDropdown: React.FC<{
  onViewRawData: () => void;
  onDownloadCSV: () => void;
  onDownloadExcel: () => void;
  onExportDuckDB: () => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportJSON: () => void;
}> = ({ onViewRawData, onDownloadCSV, onDownloadExcel, onExportDuckDB, onExportPNG, onExportSVG, onExportJSON }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const items = [
    { label: '原始数据',   act: onViewRawData },
    { label: '下载 CSV',   act: onDownloadCSV },
    { label: '下载 Excel', act: onDownloadExcel },
    { label: 'DuckDB 表', act: onExportDuckDB },
    { label: 'PNG 图片',  act: onExportPNG },
    { label: 'SVG 矢量',  act: onExportSVG },
    { label: 'JSON 拓扑', act: onExportJSON },
  ] as const;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} className="ctrl-btn-full">
        <Download className="w-3 h-3" />
        导出
        <ChevronDown className={`w-3 h-3 ml-auto ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 z-[1100] rounded border border-[#3e3d32] bg-[#272822] p-0.5">
          {items.map(item => (
            <button
              key={item.label}
              onClick={() => { item.act(); setOpen(false); }}
              className="w-full text-left px-2 py-1.5 text-[10px] text-monokai-comment hover:bg-[#3e3d32] hover:text-monokai-fg rounded"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── GraphControlsPanel ────────────────────────────────────────────────────────
interface GraphControlsPanelProps {
  showHelp: boolean;
  onToggleHelp: () => void;
  onClose: () => void;
  showAIFillInput: boolean;
  onToggleAIFill: () => void;
  aiFillTopic: string;
  onAIFillTopicChange: (v: string) => void;
  onAIFill: () => void;
  isAiFilling: boolean;
  onFitAll: () => void;
  onResetLayout: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRefresh: () => void;
  focusedNodeId: string | null;
  onClearFocus: () => void;
  showClusters: boolean;
  onToggleClusters: () => void;
  clusterMode: 'community' | 'type' | 'property' | 'cc';
  onClusterModeChange: (m: 'community' | 'type' | 'property' | 'cc') => void;
  edgeColorMode: 'linkType' | 'cluster';
  onEdgeColorModeChange: () => void;
  onCollapseAllTypes: () => void;
  onExpandAllTypes: () => void;
  onExpandAllCommunities?: () => void;
  collapseCommunities: boolean;
  onToggleCollapseCommunities: () => void;
  showClearConfirm: boolean;
  onToggleClearConfirm: () => void;
  onQuickClear: () => void;
  showTypeHubNodes: boolean;
  onToggleTypeHubNodes: () => void;
  showLinkTypeNodes: boolean;
  onToggleLinkTypeNodes: () => void;
  showTypeInstLinks: boolean;
  onToggleTypeInstLinks: () => void;
  onShowAllLayers: () => void;
  labelMode: 'auto' | 'all' | 'top' | 'hover';
  onLabelModeChange: (m: 'auto' | 'all' | 'top' | 'hover') => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  filterWeightMin: number;
  filterWeightMax: number;
  filterDirection: 'all' | 'in' | 'out';
  filterWeightPercentile: number;
  filterNodeImportance: 'all' | 'hub' | 'peripheral';
  filterNodeKeyword: string;
  filterLinkTypes: Set<number>;
  graphData: any;
  onFilterChange: (p: {
    filterWeightMin?: number; filterWeightMax?: number;
    filterDirection?: 'all' | 'in' | 'out'; filterWeightPercentile?: number;
    filterNodeImportance?: 'all' | 'hub' | 'peripheral'; filterNodeKeyword?: string;
    filterLinkTypes?: Set<number>;
  }) => void;
  onResetFilters: () => void;
  pathHighlightSource: string | null;
  pathHighlightTarget: string | null;
  onClearPath: () => void;
  linkDistance: number;
  chargeStrength: number;
  collisionRadius: number;
  onPhysicsChange: (p: { linkDistance?: number; chargeStrength?: number; collisionRadius?: number }) => void;
  onResetPhysics: () => void;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  searchHighlightedRef: React.MutableRefObject<string[]>;
  onNavigateSearch: (dir: 1 | -1) => void;
  onViewRawData: () => void;
  onDownloadCSV: () => void;
  onDownloadExcel: () => void;
  onExportDuckDB: () => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportJSON: () => void;
}

export const GraphControlsPanel: React.FC<GraphControlsPanelProps> = ({
  showHelp, onToggleHelp, onClose,
  showAIFillInput, onToggleAIFill, aiFillTopic, onAIFillTopicChange, onAIFill, isAiFilling,
  onFitAll, onResetLayout, onZoomIn, onZoomOut, onRefresh,
  focusedNodeId, onClearFocus,
  showClusters, onToggleClusters, clusterMode, onClusterModeChange, edgeColorMode, onEdgeColorModeChange,
  onCollapseAllTypes, onExpandAllTypes, onExpandAllCommunities,
  collapseCommunities, onToggleCollapseCommunities,
  showClearConfirm, onToggleClearConfirm, onQuickClear,
  showTypeHubNodes, onToggleTypeHubNodes, showLinkTypeNodes, onToggleLinkTypeNodes, showTypeInstLinks, onToggleTypeInstLinks, onShowAllLayers,
  labelMode, onLabelModeChange,
  showFilters, onToggleFilters,
  filterWeightMin, filterWeightMax, filterDirection, filterWeightPercentile,
  filterNodeImportance, filterNodeKeyword, filterLinkTypes, graphData,
  onFilterChange, onResetFilters,
  pathHighlightSource, pathHighlightTarget, onClearPath,
  linkDistance, chargeStrength, collisionRadius, onPhysicsChange, onResetPhysics,
  searchTerm, onSearchChange, searchHighlightedRef, onNavigateSearch,
  onViewRawData, onDownloadCSV, onDownloadExcel, onExportDuckDB, onExportPNG, onExportSVG, onExportJSON,
}) => {

  const labelHints: Record<string, string> = {
    auto:  '随缩放 + 连接度自动调节',
    all:   '显示全部节点标签',
    top:   '仅显示连接最多的 10%',
    hover: '仅显示悬停节点标签',
  };

  return (
    <div
      className="absolute top-3 left-3 z-[1000] graph-control-card p-2.5 min-w-[220px]"
      style={{ maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}
    >
      {/* ── Header row ── */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-monokai-muted" />
          <span className="text-[11px] text-monokai-fg">图谱控制</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleHelp}
            className="ctrl-btn"
            title="使用说明"
          >
            <HelpCircle className="w-3 h-3" />
          </button>
          <button onClick={onClose} className="ctrl-btn">
            关闭
          </button>
        </div>
      </div>

      {/* ── Help ── */}
      {showHelp && (
        <div className="px-2 py-2 text-[10px] text-monokai-comment leading-[1.9] mb-2 rounded border border-monokai-muted/20 bg-monokai-muted/5">
          拖动节点 &rarr; 移动并固定位置<br />
          滚轮 &rarr; 缩放 &nbsp;&nbsp; 双击 &rarr; 释放固定<br />
          右键节点 &rarr; 折叠 / 展开 &nbsp;&nbsp; Alt+S 搜索
        </div>
      )}

      {/* ── View ── */}
      <SectionCard label="视图">
        <div className="grid grid-cols-4 gap-1">
          <button onClick={onFitAll} className="ctrl-btn justify-center text-[10px]">Fit</button>
          <button onClick={onResetLayout} className="ctrl-btn justify-center text-[10px]">
            <RotateCcw className="w-3 h-3" />
          </button>
          <button onClick={onZoomIn} className="ctrl-btn justify-center text-[10px]">+</button>
          <button onClick={onRefresh} className="ctrl-btn justify-center text-[10px]">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </SectionCard>

      {/* ── AI Fill ── */}
      <SectionCard label="生成图谱" defaultOpen={false}>
        {showAIFillInput ? (
          <div className="flex gap-1 items-center">
            <input
              autoFocus
              value={aiFillTopic}
              onChange={e => onAIFillTopicChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onAIFill(); if (e.key === 'Escape') onToggleAIFill(); }}
              placeholder="输入图谱主题"
              className="ctrl-input flex-1"
            />
            <button onClick={onAIFill} disabled={isAiFilling} className="ctrl-btn shrink-0">
              {isAiFilling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Network className="w-3 h-3" />}
            </button>
            <button onClick={onToggleAIFill} className="ctrl-btn shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button onClick={onToggleAIFill} disabled={isAiFilling} className="ctrl-btn-full">
            <Network className="w-3 h-3" />
            {isAiFilling ? '生成中...' : '基于主题生成'}
          </button>
        )}
      </SectionCard>

      {/* ── Layout ── */}
      <SectionCard label="布局">
        <div className="flex gap-1 flex-wrap">
          <button onClick={onToggleClusters} className={`ctrl-pill ${showClusters ? 'ctrl-pill-active' : ''}`}>
            聚类
          </button>
          {focusedNodeId && (
            <button onClick={onClearFocus} className="ctrl-pill ctrl-pill-active">
              退出聚焦
            </button>
          )}
        </div>
        {showClusters && (
          <div className="flex gap-1 flex-wrap">
            {([['cc', '连通分量'], ['community', '社区'], ['type', '类型']] as const).map(([m, lbl]) => (
              <button key={m} onClick={() => onClusterModeChange(m)} className={`ctrl-pill ${clusterMode === m ? 'ctrl-pill-active' : ''}`}>
                {lbl}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1">
          <button onClick={onCollapseAllTypes} className="ctrl-btn text-[10px] flex-1 justify-center">收起</button>
          <button onClick={onExpandAllTypes} className="ctrl-btn text-[10px] flex-1 justify-center">展开</button>
        </div>
        <div className="flex gap-1">
          <button onClick={onToggleCollapseCommunities} className={`ctrl-pill ${collapseCommunities ? 'ctrl-pill-active' : ''}`}>
            稠密社区
          </button>
          {collapseCommunities && onExpandAllCommunities && (
            <button onClick={onExpandAllCommunities} className="ctrl-btn text-[10px] px-2">
              展开全部
            </button>
          )}
          {showClearConfirm ? (
            <div className="flex gap-1 flex-1">
              <button onClick={onQuickClear} className="flex-1 py-1 text-[10px] rounded bg-red-600/60 hover:bg-red-600 text-white border border-red-600">
                确认
              </button>
              <button onClick={onToggleClearConfirm} className="ctrl-btn text-[10px] px-2">取消</button>
            </div>
          ) : (
            <button onClick={onToggleClearConfirm} className="ctrl-btn text-[10px] flex-1 justify-center">
              <Trash2 className="w-3 h-3" /> 清空
            </button>
          )}
        </div>
      </SectionCard>

      {/* ── Layers ── */}
      <SectionCard label="显示层次" defaultOpen={false}>
        <div className="flex gap-1 flex-wrap">
          {[
            { label: '类型集',   active: showTypeHubNodes,    act: onToggleTypeHubNodes },
            { label: '关系类型', active: showLinkTypeNodes,   act: onToggleLinkTypeNodes },
            { label: '类型连线', active: showTypeInstLinks,  act: onToggleTypeInstLinks },
          ].map(({ label, active, act }) => (
            <button key={label} onClick={act} className={`ctrl-pill ${active ? 'ctrl-pill-active' : ''}`}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={onShowAllLayers} className="ctrl-btn text-[10px] w-full justify-center">
          显示全部
        </button>
      </SectionCard>

      {/* ── Labels ── */}
      <SectionCard label="标签" defaultOpen={false}>
        <div className="grid grid-cols-4 gap-0.5">
          {([['auto', '自动'], ['all', '全部'], ['top', '核心'], ['hover', '悬停']] as const).map(([m, lbl]) => (
            <button key={m} onClick={() => onLabelModeChange(m)}
              className={`py-1 rounded text-[9px] border text-center ${
                labelMode === m
                  ? 'ctrl-pill-active border-monokai-muted/60'
                  : 'border-monokai-muted/20 text-monokai-muted hover:border-monokai-muted/50 hover:text-monokai-fg'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
        <div className="text-[9px] text-monokai-muted/60">{labelHints[labelMode]}</div>
      </SectionCard>

      {/* ── Filters ── */}
      <SectionCard label="边过滤" defaultOpen={false}>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-monokai-muted/60">
            {filterLinkTypes.size > 0 ? `${filterLinkTypes.size} 种关系` : '全部关系'}
          </span>
          <button onClick={onResetFilters} className="text-[9px] text-monokai-muted/50 hover:text-monokai-fg">重置</button>
        </div>

        {/* Weight range */}
        <div className="text-[9px] text-monokai-muted/60 mb-1">
          权重 {filterWeightMin.toFixed(1)} — {filterWeightMax.toFixed(1)}
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-[8px] text-monokai-muted/40 w-4 shrink-0">min</span>
          <input type="range" min="0" max="1" step="0.05" value={filterWeightMin}
            onChange={e => onFilterChange({ filterWeightMin: Number(e.target.value) })}
            className="monokai-slider flex-1" style={{ accentColor: C.muted }} />
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-[8px] text-monokai-muted/40 w-4 shrink-0">max</span>
          <input type="range" min="0" max="1" step="0.05" value={filterWeightMax}
            onChange={e => onFilterChange({ filterWeightMax: Number(e.target.value) })}
            className="monokai-slider flex-1" style={{ accentColor: C.muted }} />
        </div>

        {/* Direction */}
        <div className="flex gap-1">
          {([['all', '全部'], ['in', '入'], ['out', '出']] as const).map(([dir, lbl]) => (
            <button key={dir} onClick={() => onFilterChange({ filterDirection: dir })}
              className={`text-[9px] flex-1 py-1 rounded border text-center ${
                filterDirection === dir
                  ? 'ctrl-pill-active border-monokai-muted/60'
                  : 'border-monokai-muted/20 text-monokai-muted hover:border-monokai-muted/50 hover:text-monokai-fg'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        {/* Percentile */}
        <div>
          <div className="text-[9px] text-monokai-muted/60 mb-1">显示 Top {filterWeightPercentile}%</div>
          <input type="range" min="5" max="100" step="5" value={filterWeightPercentile}
            onChange={e => onFilterChange({ filterWeightPercentile: Number(e.target.value) })}
            className="monokai-slider w-full" style={{ accentColor: C.muted }} />
        </div>

        {/* Importance */}
        <div className="flex gap-1">
          {([['all', '全部'], ['hub', '枢纽'], ['peripheral', '边缘']] as const).map(([imp, lbl]) => (
            <button key={imp} onClick={() => onFilterChange({ filterNodeImportance: imp })}
              className={`text-[9px] flex-1 py-1 rounded border text-center ${
                filterNodeImportance === imp
                  ? 'ctrl-pill-active border-monokai-muted/60'
                  : 'border-monokai-muted/20 text-monokai-muted hover:border-monokai-muted/50 hover:text-monokai-fg'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        {/* Keyword */}
        <input type="text" value={filterNodeKeyword}
          onChange={e => onFilterChange({ filterNodeKeyword: e.target.value })}
          placeholder="节点关键词..."
          className="ctrl-input"
        />

        {/* Link types */}
        {graphData && (() => {
          const uniqueLinkTypes = [...new Set(
            graphData.links.filter((l: any) => l._linkTypeId !== undefined).map((l: any) => l._linkTypeId)
          )] as number[];
          if (uniqueLinkTypes.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-1">
              {uniqueLinkTypes.map(ltId => {
                const lt = graphData.linkTypeMap[ltId];
                const isActive = filterLinkTypes.size === 0 || filterLinkTypes.has(ltId);
                return (
                  <button key={ltId}
                    onClick={() => {
                      const next = new Set(filterLinkTypes);
                      if (filterLinkTypes.size === 0) {
                        uniqueLinkTypes.forEach(id => { if (id !== ltId) next.add(id); });
                      } else if (next.has(ltId)) { next.delete(ltId); } else { next.add(ltId); }
                      onFilterChange({ filterLinkTypes: next.size === uniqueLinkTypes.length ? new Set() : next });
                    }}
                    className={`text-[8px] px-1.5 py-0.5 rounded border ${
                      isActive
                        ? 'border-monokai-muted/30 text-monokai-muted'
                        : 'border-monokai-muted/60 text-monokai-muted/80'
                    }`}
                  >
                    {lt?.name || `类型${ltId}`}
                  </button>
                );
              })}
            </div>
          );
        })()}
      </SectionCard>

      {/* ── Physics ── */}
      <SectionCard label="力场" defaultOpen={false}>
        <div className="space-y-1">
          {[
            { label: '向心力', val: linkDistance, min: 20, max: 300, key: 'linkDistance' as const },
            { label: '排斥力', val: chargeStrength, min: -1000, max: -10, key: 'chargeStrength' as const },
            { label: '防拥挤', val: collisionRadius, min: 0, max: 80, key: 'collisionRadius' as const },
          ].map(({ label, val, min, max, key }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-monokai-muted w-9 shrink-0">{label}</span>
              <input type="range" min={min} max={max} value={val}
                onChange={e => onPhysicsChange({ [key]: Number(e.target.value) })}
                className="monokai-slider flex-1" style={{ accentColor: C.muted }} />
              <span className="text-[9px] font-mono text-monokai-muted/80 w-8 text-right">{val}</span>
            </div>
          ))}
        </div>
        <button onClick={onResetPhysics}
          className="text-[9px] text-monokai-muted/50 hover:text-monokai-fg pt-0.5 text-right w-full">
          复位
        </button>
      </SectionCard>

      {/* ── Search ── */}
      <SectionCard label="搜索" defaultOpen={false}>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-monokai-muted/40" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onNavigateSearch(1);
              else if (e.key === 'Escape') onSearchChange('');
            }}
            placeholder="搜索节点..."
            className="ctrl-input pl-7 pr-6"
          />
          {searchTerm && (
            <button onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-monokai-muted/40 hover:text-monokai-fg">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        {searchHighlightedRef.current.length > 0 && (
          <div className="flex gap-1 items-center">
            <button onClick={() => onNavigateSearch(-1)} className="ctrl-btn text-[9px]">上一个</button>
            <button onClick={() => onNavigateSearch(1)} className="ctrl-btn text-[9px]">下一个</button>
            <span className="text-[9px] text-monokai-muted/60 ml-auto font-mono">
              {searchHighlightedRef.current.length} 条
            </span>
          </div>
        )}
      </SectionCard>

      {/* ── Path highlight ── */}
      {(pathHighlightSource || pathHighlightTarget) && (
        <div className="px-2 py-1.5 text-[10px] text-monokai-muted border border-monokai-muted/20 rounded bg-monokai-muted/5">
          {pathHighlightSource && !pathHighlightTarget
            ? `${pathHighlightSource.split('::')[1] || pathHighlightSource} — 点击终点...`
            : '计算路径中...'}
          <button onClick={onClearPath} className="ml-2 text-monokai-muted/50 hover:text-monokai-fg">
            取消
          </button>
        </div>
      )}

      {/* ── Export ── */}
      <ExportDropdown
        onViewRawData={onViewRawData}
        onDownloadCSV={onDownloadCSV}
        onDownloadExcel={onDownloadExcel}
        onExportDuckDB={onExportDuckDB}
        onExportPNG={onExportPNG}
        onExportSVG={onExportSVG}
        onExportJSON={onExportJSON}
      />
    </div>
  );
};

// ── GraphStatsPanel ─────────────────────────────────────────────────────────

interface GraphStatsPanelProps {
  stats: { nodes: number; links: number };
  infoContent: string;
  onClose: () => void;
  renderMode?: 'svg' | 'webgl';
  simMode?: 'local' | 'worker';
  hiddenCounts?: { typeCollapsed: number; communityCollapsed: number };
}

export const GraphStatsPanel: React.FC<GraphStatsPanelProps> = ({ stats, infoContent, onClose, renderMode, simMode, hiddenCounts }) => (
  <div className="absolute top-3 right-3 z-[1000] graph-control-card p-2.5 min-w-[180px]">
    <div className="flex items-center justify-between mb-2 px-1">
      <span className="text-[11px] text-monokai-fg">统计</span>
      <button onClick={onClose} className="ctrl-btn text-[10px]">关闭</button>
    </div>

    {renderMode && (
      <div className="flex gap-1 mb-2 px-1">
        <span className="text-[9px] text-monokai-muted/60 px-1.5 py-0.5 rounded border border-monokai-muted/20">
          {renderMode === 'webgl' ? 'WebGL' : 'SVG'}
        </span>
        {simMode && (
          <span className="text-[9px] text-monokai-muted/60 px-1.5 py-0.5 rounded border border-monokai-muted/20">
            {simMode === 'worker' ? 'Worker' : 'Local'}
          </span>
        )}
      </div>
    )}

    <div className="space-y-1 px-1 mb-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-monokai-muted">节点</span>
        <span className="text-[11px] font-mono text-monokai-fg">{stats.nodes}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-monokai-muted">连接</span>
        <span className="text-[11px] font-mono text-monokai-fg">{stats.links}</span>
      </div>
    </div>

    {(hiddenCounts?.typeCollapsed > 0 || hiddenCounts?.communityCollapsed > 0) && (
      <div className="px-2 py-2 text-[9px] rounded mb-2"
        style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)' }}>
        <div className="flex items-center gap-1 mb-1">
          <EyeOff className="w-3 h-3 text-yellow-400" />
          <span className="font-medium text-yellow-400">已隐藏节点</span>
        </div>
        {hiddenCounts?.typeCollapsed > 0 && (
          <div className="text-yellow-400/80">
            类型折叠: {hiddenCounts.typeCollapsed} 个节点
          </div>
        )}
        {hiddenCounts?.communityCollapsed > 0 && (
          <div className="text-yellow-400/80">
            社区聚合: {hiddenCounts.communityCollapsed} 个节点
          </div>
        )}
      </div>
    )}

    {(stats.nodes > 800 || stats.links > 1500) && (
      <div className="px-2 py-2 text-[9px] text-monokai-muted/70 border border-monokai-muted/20 rounded mb-2">
        <div className="flex items-center gap-1 mb-1">
          <AlertTriangle className="w-3 h-3" />
          渲染上限警戒 — 当前量级逼近 GPU 限制
        </div>
        建议切换至表格检索或使用 Focus 模式
      </div>
    )}

    <div className="border-t border-monokai-muted/20 pt-2 px-1">
      <div dangerouslySetInnerHTML={{ __html: infoContent || '<span style="color:#555;font-size:10px">单击节点查看详情</span>' }} />
    </div>
  </div>
);

// ── GraphLegend ─────────────────────────────────────────────────────────────

const NODE_COLORS = ['#c77dff', '#a070d0', '#fd971f', '#ae81ff', '#e6db74', '#a6e22e', '#66d9ef'];
const LINK_COLORS = ['#909090', '#ff5a8a'];

interface GraphLegendProps { onClose: () => void; }

export const GraphLegend: React.FC<GraphLegendProps> = ({ onClose }) => (
  <div className="absolute bottom-3 left-3 z-[1000] graph-control-card p-2.5 min-w-[140px]">
    <div className="flex items-center justify-between mb-2 px-1">
      <span className="text-[11px] text-monokai-fg">图例</span>
      <button onClick={onClose} className="ctrl-btn text-[10px]">关闭</button>
    </div>

    {([
      { color: NODE_COLORS[0], r: 8, label: '类型集' },
      { color: NODE_COLORS[1], r: 5, label: '实例节点' },
      { color: LINK_COLORS[0], r: 3, label: '关系连线' },
      { color: '#50fa7b',     r: 3, label: '已完成行动' },
      { color: LINK_COLORS[1], r: 3, label: '待处理行动' },
    ] as const).map(item => (
      <div key={item.label} className="flex items-center gap-2 py-0.5">
        <svg width="14" height="14" viewBox="-10 -10 20 20" className="shrink-0">
          <circle cx="0" cy="0" r={item.r} fill={item.color} stroke="#444" strokeWidth="1" />
        </svg>
        <span className="text-[10px] text-monokai-comment">{item.label}</span>
      </div>
    ))}

    <div className="border-t border-monokai-muted/20 mt-2 pt-2 space-y-1">
      <div className="flex items-center gap-2">
        <svg width="30" height="8" className="shrink-0">
          <defs>
            <marker id="lg-arrow" markerWidth="4" markerHeight="3" refX="4" refY="1.5" orient="auto">
              <polygon points="0 0, 4 1.5, 0 3" fill="#a070d0" />
            </marker>
          </defs>
          <line x1="0" y1="4" x2="22" y2="4" stroke="#a070d0" strokeWidth="2" markerEnd="url(#lg-arrow)" />
        </svg>
        <span className="text-[10px] text-monokai-comment">关系连线</span>
      </div>
      <div className="flex items-center gap-2">
        <svg width="30" height="8" className="shrink-0">
          <line x1="0" y1="4" x2="22" y2="4" stroke="#c77dff" strokeWidth="1.2" strokeDasharray="4 2" markerEnd="url(#lg-arrow)" />
        </svg>
        <span className="text-[10px] text-monokai-comment">归属类型（虚线）</span>
      </div>
    </div>
  </div>
);

// ── GraphTopBar ─────────────────────────────────────────────────────────────

interface GraphTopBarProps {
  showControls: boolean;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  onNavigateSearch: (dir: 1 | -1) => void;
  searchHighlightedRef: React.MutableRefObject<string[]>;
  interactionMode: 'select' | 'connect';
  onInteractionModeChange: (m: 'select' | 'connect') => void;
}

export const GraphTopBar: React.FC<GraphTopBarProps> = ({
  showControls, searchTerm, onSearchChange, onNavigateSearch, searchHighlightedRef,
  interactionMode, onInteractionModeChange,
}) => (
  <div
    className="absolute top-3 z-[1000] flex items-center gap-2 px-3 py-1.5 graph-control-card"
    style={{
      left: showControls ? 300 : 180,
      minWidth: 180,
      transition: 'left 0.3s',
    }}
  >
    <Search className="w-3 h-3 text-monokai-muted shrink-0" />
    <input
      type="text"
      value={searchTerm}
      onChange={e => onSearchChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') onNavigateSearch(1); else if (e.key === 'Escape') onSearchChange(''); }}
      placeholder="搜索"
      className="bg-transparent text-monokai-fg border-none outline-none text-[11px] min-w-[100px] flex-1 max-w-[200px]"
    />
    {searchTerm && (
      <button onClick={() => onSearchChange('')}
        className="text-[10px] text-monokai-muted hover:text-monokai-fg shrink-0">
        清除
      </button>
    )}
    {searchHighlightedRef.current.length > 0 && (
      <span className="text-[10px] text-monokai-muted shrink-0 font-mono">
        {searchHighlightedRef.current.length}
      </span>
    )}
    <span className="text-[10px] text-monokai-muted/30 shrink-0">|</span>
    {([['select', '选择'], ['connect', '连线']] as const).map(([mode, label]) => (
      <button
        key={mode}
        onClick={() => onInteractionModeChange(mode)}
        className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${
          interactionMode === mode
            ? 'ctrl-pill-active'
            : 'border-monokai-muted/20 text-monokai-muted hover:border-monokai-muted/50 hover:text-monokai-fg'
        }`}
      >
        {label}
      </button>
    ))}
  </div>
);

// ── GraphContextMenu ────────────────────────────────────────────────────────

interface GraphContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  node: GraphNode | null;
  collapsedRef: React.MutableRefObject<Set<string>>;
  onFocusMode: () => void;
  onExpandNeighbors: () => void;
  onToggleCollapse: () => void;
  onToggleTypeHubCollapse: () => void;
  onClose: () => void;
}

export const GraphContextMenu: React.FC<GraphContextMenuProps> = ({
  visible, x, y, node, collapsedRef,
  onFocusMode, onExpandNeighbors, onToggleCollapse, onToggleTypeHubCollapse, onClose,
}) => {
  if (!visible || !node) return null;
  const nodeId = node.id || '';
  const isCollapsed = collapsedRef.current.has(nodeId);
  const isTypeHubCollapsed = node.group === 'typeHub' && collapsedRef.current.has(`type::${(node as any)._typeId}`);

  const btnStyle: React.CSSProperties = {
    width: '100%', padding: '6px 14px', background: 'none', border: 'none',
    color: C.fg, textAlign: 'left', cursor: 'pointer', fontSize: 11,
    display: 'flex', alignItems: 'center', gap: 6,
  };

  return (
    <div style={{
      position: 'fixed', top: y, left: x,
      background: '#272822', border: '1px solid #3e3d32',
      borderRadius: 4,
      padding: '3px 0', zIndex: 9999, minWidth: 140,
    }}>
      <button onClick={onFocusMode} style={btnStyle}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(62,61,50,0.4)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
        焦点模式
      </button>
      <button onClick={onExpandNeighbors} style={{ ...btnStyle, color: C.blue }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(62,61,50,0.4)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
        展开邻近
      </button>
      <button onClick={onToggleCollapse}
        style={{ ...btnStyle, color: isCollapsed ? C.orange : C.fg }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(62,61,50,0.4)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
        {isCollapsed ? '展开' : '折叠'}子网
      </button>
      {node.group === 'typeHub' && (
        <button onClick={onToggleTypeHubCollapse}
          style={{ ...btnStyle, color: isTypeHubCollapsed ? C.orange : C.pur }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(62,61,50,0.4)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
          {isTypeHubCollapsed ? '展开' : '折叠'}实例 ({(node as any)._instanceCount || 0})
        </button>
      )}
    </div>
  );
};

// ── GraphEmptyState ─────────────────────────────────────────────────────────

interface GraphEmptyStateProps {
  showAIFillInput: boolean;
  aiFillTopic: string;
  isAiFilling: boolean;
  onToggleAIFill: () => void;
  onAIFillTopicChange: (v: string) => void;
  onAIFill: () => void;
  onRefresh: () => void;
  onDownloadCSV: () => void;
  onDownloadExcel: () => void;
}

export const GraphEmptyState: React.FC<GraphEmptyStateProps> = ({
  showAIFillInput, aiFillTopic, isAiFilling,
  onToggleAIFill, onAIFillTopicChange, onAIFill, onRefresh, onDownloadCSV, onDownloadExcel,
}) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-[100] pointer-events-none">
    <div className="text-center">
      <Network className="w-10 h-10 mx-auto mb-3 text-monokai-muted/30" />
      <div className="text-[14px] text-monokai-muted mb-1">本体尚未初始化</div>
      <div className="text-[11px] text-monokai-muted/50 max-w-[360px] leading-[1.9] mb-3">
        在左侧「示例」中探索「我的人生」示例，<br />
        或切换到「我的 Schema」从数据库表结构推断本体。<br />
        <span className="text-monokai-yellow/60">若数据已存在但未显示，请点击下方「刷新」按钮。</span>
      </div>

      {showAIFillInput && (
        <div className="flex gap-1.5 justify-center mb-3 pointer-events-all">
          <input autoFocus value={aiFillTopic}
            onChange={e => onAIFillTopicChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onAIFill(); if (e.key === 'Escape') onToggleAIFill(); }}
            placeholder="输入图谱主题"
            className="ctrl-input w-56 text-[12px]"
          />
          <button onClick={onAIFill} disabled={isAiFilling}
            className="ctrl-btn">
            {isAiFilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
          </button>
          <button onClick={onToggleAIFill} className="ctrl-btn">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex gap-1.5 justify-center pointer-events-all flex-wrap">
        <button onClick={onToggleAIFill} disabled={isAiFilling} className="ctrl-btn-full">
          <Network className="w-3.5 h-3.5" />
          {isAiFilling ? '生成中...' : '基于主题生成'}
        </button>
        <button onClick={onRefresh} className="ctrl-btn">
          <RefreshCw className="w-3.5 h-3.5" /> 刷新
        </button>
        <button onClick={onDownloadCSV} className="ctrl-btn">CSV</button>
        <button onClick={onDownloadExcel} className="ctrl-btn">Excel</button>
      </div>
    </div>
  </div>
);

// ── LayerVisibilityHint ──────────────────────────────────────────────────────

interface LayerVisibilityHintProps { onShowAll: () => void; }

export const LayerVisibilityHint: React.FC<LayerVisibilityHintProps> = ({ onShowAll }) => (
  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-2 graph-control-card pointer-events-all"
    style={{ maxWidth: 420 }}>
    <AlertTriangle className="w-3.5 h-3.5 text-monokai-muted shrink-0" />
    <span className="text-[11px] text-monokai-muted flex-1">
      图层可能被关闭，图谱内容未显示
    </span>
    <button onClick={onShowAll} className="ctrl-btn text-[10px] shrink-0">
      显示全部
    </button>
  </div>
);
