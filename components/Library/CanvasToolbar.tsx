/**
 * CanvasToolbar — Mode selector, mode-specific tools, utility row
 *
 * Optimized: horizontal scroll container, unified button height 28px,
 * 6px gaps between rows, MECE dropdown minWidth 180px.
 */

import React from 'react';
import {
  PlusCircle, RefreshCcw, Terminal, HelpCircle, Trash2,
  Layout, Sparkles, Loader2, ChevronDown,
  Minus, Undo2, Plus, Network
} from 'lucide-react';
import type { CanvasMode, MECELayer } from './OntologyCanvas.types';
import { MECE_LAYER_COLORS } from './OntologyCanvas.types';
import { CANVAS_MODE_DESIGN } from './CanvasModeDesign';

// ── Monokai palette ─────────────────────────────────────────────────────────
const MK = {
  blue:       '#818cf8',
  green:      '#4ade80',
  red:        '#f87171',
  indigo:     '#6366f1',
  muted:      '#64748b',
  faint:      'rgba(255,255,255,0.06)',
  border:     'rgba(255,255,255,0.08)',
  sep:        'rgba(255,255,255,0.08)',
} as const;

// ── Shared button style ───────────────────────────────────────────────────────
// Height 28px (padding 5px 10px), font 11px
const btnBase: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '5px 10px', borderRadius: 8,
  fontSize: 11, fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s',
  border: '1px solid',
  fontFamily: "'IBM Plex Sans', Arial, sans-serif",
  whiteSpace: 'nowrap',
};

// ── ModeSelector ─────────────────────────────────────────────────────────────
interface ModeSelectorProps {
  canvasMode: CanvasMode;
  onModeSwitch: (mode: CanvasMode) => void;
}

function ModeSelector({ canvasMode, onModeSwitch }: ModeSelectorProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 12px',
      background: 'rgba(15,15,24,0.95)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      width: 'fit-content',
    }}>
      {(Object.keys(CANVAS_MODE_DESIGN) as CanvasMode[]).map(mode => {
        const m = CANVAS_MODE_DESIGN[mode];
        const isActive = canvasMode === mode;
        return (
          <button
            key={mode}
            onClick={() => onModeSwitch(mode)}
            title={m.description}
            style={{
              ...btnBase,
              border: `1px ${isActive ? 'solid' : 'transparent'}`,
              borderColor: isActive ? `${m.color}50` : 'transparent',
              color: isActive ? m.color : MK.muted,
            }}
          >
            {m.icon}
            <span>{m.labelZh}</span>
          </button>
        );
      })}
      <div style={{ height: 16, width: 1, background: MK.sep, margin: '0 4px' }} />
      <span style={{ fontSize: 10, color: '#475569', paddingRight: 4 }}>
        {CANVAS_MODE_DESIGN[canvasMode].description}
      </span>
    </div>
  );
}

// ── Separator ─────────────────────────────────────────────────────────────────
const SEP = () => (
  <div style={{ width: 1, height: 20, background: MK.sep, margin: '0 4px', alignSelf: 'center' }} />
);

// ── Pipeline Mode Toolbar ────────────────────────────────────────────────────
interface PipelineToolbarProps {
  onAddNode: () => void;
  onAutoLayout: () => void;
  onShowSqlPreview: () => void;
  showSqlPreview: boolean;
  onShowHelp: () => void;
  showHelp: boolean;
  onShowClearMenu: () => void;
}

function PipelineToolbar({
  onAddNode, onAutoLayout, onShowSqlPreview, showSqlPreview,
  onShowHelp, showHelp, onShowClearMenu,
}: PipelineToolbarProps) {
  return (
    <>
      <button onClick={onAddNode}
        style={{
          ...btnBase,
          background: 'rgba(99,102,241,0.08)',
          borderColor: 'rgba(99,102,241,0.2)',
          color: MK.blue,
        }}>
        <PlusCircle className="w-3.5 h-3.5" />
        添加节点
      </button>
      <button onClick={onAutoLayout}
        style={{
          ...btnBase,
          background: 'rgba(74,222,128,0.08)',
          borderColor: 'rgba(74,222,128,0.2)',
          color: MK.green,
        }}>
        <RefreshCcw className="w-3.5 h-3.5" />
        智能布局
      </button>
      <button onClick={onShowSqlPreview}
        style={{
          ...btnBase,
          background: showSqlPreview ? 'rgba(99,102,241,0.15)' : 'transparent',
          borderColor: showSqlPreview ? 'rgba(99,102,241,0.4)' : MK.border,
          color: showSqlPreview ? MK.blue : MK.muted,
        }}>
        <Terminal className="w-3.5 h-3.5" />
        导出 SQL
      </button>
      <SEP />
      <button onClick={onShowHelp}
        style={{
          ...btnBase,
          background: showHelp ? 'rgba(99,102,241,0.15)' : 'transparent',
          borderColor: showHelp ? 'rgba(99,102,241,0.4)' : MK.border,
          color: showHelp ? MK.blue : MK.muted,
        }}>
        <HelpCircle className="w-3.5 h-3.5" />
        指南
      </button>
      <button onClick={onShowClearMenu}
        style={{
          ...btnBase,
          background: 'rgba(239,68,68,0.08)',
          borderColor: 'rgba(239,68,68,0.25)',
          color: MK.red,
        }}>
        <Trash2 className="w-3.5 h-3.5" />
        清除
      </button>
    </>
  );
}

// ── Knowledge Mode Toolbar ───────────────────────────────────────────────────
interface KnowledgeToolbarProps {
  onAddNode: () => void;
  onAddSpace: () => void;
  onAutoLayout: () => void;
  activeLayer: MECELayer;
  onLayerChange: (layer: MECELayer) => void;
  showLayerDropdown: boolean;
  onToggleLayerDropdown: () => void;
  onMeceFill: () => void;
  isAIFilling: boolean;
  onShowHelp: () => void;
  showHelp: boolean;
  onShowClearMenu: () => void;
}

function KnowledgeToolbar({
  onAddNode, onAddSpace, onAutoLayout,
  activeLayer, onLayerChange, showLayerDropdown, onToggleLayerDropdown,
  onMeceFill, isAIFilling,
  onShowHelp, showHelp, onShowClearMenu,
}: KnowledgeToolbarProps) {
  const layerLabels: Record<MECELayer, string> = {
    foundation: '基础', relations: '关系', methodology: '方法论', patterns: '模式', domains: '领域',
  };
  const layerColor = MECE_LAYER_COLORS[activeLayer];

  return (
    <>
      <button onClick={onAddNode}
        style={{
          ...btnBase,
          background: 'rgba(99,102,241,0.08)',
          borderColor: 'rgba(99,102,241,0.2)',
          color: MK.blue,
        }}>
        <PlusCircle className="w-3.5 h-3.5" />
        节点
      </button>
      <button onClick={onAddSpace}
        style={{
          ...btnBase,
          background: 'rgba(56,189,248,0.08)',
          borderColor: 'rgba(56,189,248,0.2)',
          color: '#7dd3fc',
        }}>
        <Layout className="w-3.5 h-3.5" />
        空间
      </button>
      <button onClick={onAutoLayout}
        style={{
          ...btnBase,
          background: 'rgba(74,222,128,0.08)',
          borderColor: 'rgba(74,222,128,0.2)',
          color: MK.green,
        }}>
        <RefreshCcw className="w-3.5 h-3.5" />
        智能布局
      </button>
      <SEP />
      {/* MECE Layer Dropdown */}
      <div style={{ position: 'relative' }}>
        <button onClick={onToggleLayerDropdown}
          style={{
            ...btnBase,
            background: `${layerColor}15`,
            borderColor: `${layerColor}50`,
            color: layerColor,
            minWidth: 100,
          }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: layerColor, flexShrink: 0 }} />
          {layerLabels[activeLayer]}
          <ChevronDown className="w-3 h-3" />
        </button>
        {showLayerDropdown && (
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            marginTop: 6, minWidth: 180,
            background: 'rgba(23,23,35,0.98)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
            padding: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 300,
          }}>
            {(Object.keys(MECE_LAYER_COLORS) as MECELayer[]).map(layer => (
              <button
                key={layer}
                onClick={() => { onLayerChange(layer); onToggleLayerDropdown(); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 14px', borderRadius: 8,
                  fontSize: 11, fontWeight: activeLayer === layer ? 700 : 500,
                  background: activeLayer === layer ? `${MECE_LAYER_COLORS[layer]}15` : 'none',
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  color: activeLayer === layer ? MECE_LAYER_COLORS[layer] : MK.muted,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: MECE_LAYER_COLORS[layer], flexShrink: 0 }} />
                {layerLabels[layer]}
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={onMeceFill} disabled={isAIFilling}
        style={{
          ...btnBase,
          background: `${layerColor}15`,
          borderColor: `${layerColor}40`,
          color: layerColor,
          cursor: isAIFilling ? 'not-allowed' : 'pointer',
        }}>
        {isAIFilling
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> AI 构思中...</>
          : <><Sparkles className="w-3.5 h-3.5" /> AI 生成</>}
      </button>
      <SEP />
      <button onClick={onShowHelp}
        style={{
          ...btnBase,
          background: showHelp ? 'rgba(99,102,241,0.15)' : 'transparent',
          borderColor: showHelp ? 'rgba(99,102,241,0.4)' : MK.border,
          color: showHelp ? MK.blue : MK.muted,
        }}>
        <HelpCircle className="w-3.5 h-3.5" />
        指南
      </button>
      <button onClick={onShowClearMenu}
        style={{
          ...btnBase,
          background: 'rgba(239,68,68,0.08)',
          borderColor: 'rgba(239,68,68,0.25)',
          color: MK.red,
        }}>
        <Trash2 className="w-3.5 h-3.5" />
        清除
      </button>
    </>
  );
}

// ── Explorer Mode Toolbar ─────────────────────────────────────────────────────
interface ExplorerToolbarProps {
  onLoadSchemaTables: () => void;
  onShowSqlPreview: () => void;
  showSqlPreview: boolean;
  onShowHelp: () => void;
  showHelp: boolean;
  onShowClearMenu: () => void;
}

function ExplorerToolbar({
  onLoadSchemaTables, onShowSqlPreview, showSqlPreview,
  onShowHelp, showHelp, onShowClearMenu,
}: ExplorerToolbarProps) {
  return (
    <>
      <button onClick={onLoadSchemaTables}
        style={{
          ...btnBase,
          background: 'rgba(56,189,248,0.08)',
          borderColor: 'rgba(56,189,248,0.2)',
          color: '#7dd3fc',
        }}>
        <RefreshCcw className="w-3.5 h-3.5" />
        刷新 Schema
      </button>
      <button onClick={onShowSqlPreview}
        style={{
          ...btnBase,
          background: showSqlPreview ? 'rgba(99,102,241,0.15)' : 'transparent',
          borderColor: showSqlPreview ? 'rgba(99,102,241,0.4)' : MK.border,
          color: showSqlPreview ? MK.blue : MK.muted,
        }}>
        <Terminal className="w-3.5 h-3.5" />
        依赖分析
      </button>
      <SEP />
      <button onClick={onShowHelp}
        style={{
          ...btnBase,
          background: showHelp ? 'rgba(99,102,241,0.15)' : 'transparent',
          borderColor: showHelp ? 'rgba(99,102,241,0.4)' : MK.border,
          color: showHelp ? MK.blue : MK.muted,
        }}>
        <HelpCircle className="w-3.5 h-3.5" />
        指南
      </button>
      <button onClick={onShowClearMenu}
        style={{
          ...btnBase,
          background: 'rgba(239,68,68,0.08)',
          borderColor: 'rgba(239,68,68,0.25)',
          color: MK.red,
        }}>
        <Trash2 className="w-3.5 h-3.5" />
        清除
      </button>
    </>
  );
}

// ── Utility Row ───────────────────────────────────────────────────────────────
interface UtilityRowProps {
  undoStackLength: number;
  redoStackLength: number;
  onUndo: () => void;
  onRedo: () => void;
  selectedItemIdsSize: number;
  onAlignSelected: (dir: 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY') => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onExplore?: () => void;
}

function UtilityRow({
  undoStackLength, redoStackLength, onUndo, onRedo,
  selectedItemIdsSize, onAlignSelected,
  snapEnabled, onToggleSnap,
  zoom, onZoomIn, onZoomOut, onZoomReset,
  onExplore,
}: UtilityRowProps) {
  const btnMini: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '4px 8px', borderRadius: 6,
    fontSize: 10, fontWeight: 600,
    border: '1px solid rgba(255,255,255,0.08)',
    cursor: 'pointer',
    fontFamily: "'IBM Plex Sans', Arial, sans-serif",
  };

  const alignBtns: { dir: 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY'; label: string }[] = [
    { dir: 'left', label: '左' }, { dir: 'centerX', label: '中' },
    { dir: 'right', label: '右' }, { dir: 'top', label: '顶' },
    { dir: 'centerY', label: '垂' }, { dir: 'bottom', label: '底' },
  ];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
      padding: '4px 14px',
      background: 'rgba(15,15,24,0.9)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10,
    }}>
      {/* Undo / Redo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <button
          onClick={onUndo} disabled={undoStackLength === 0}
          title="撤销 (Ctrl+Z)"
          style={{
            ...btnMini,
            background: 'none',
            color: undoStackLength === 0 ? '#374151' : MK.muted,
            cursor: undoStackLength === 0 ? 'not-allowed' : 'pointer',
          }}>
          <Undo2 className="w-3.5 h-3.5" />
          撤销
        </button>
        <button
          onClick={onRedo} disabled={redoStackLength === 0}
          title="重做 (Ctrl+Shift+Z)"
          style={{
            ...btnMini,
            background: 'none',
            color: redoStackLength === 0 ? '#374151' : MK.muted,
            cursor: redoStackLength === 0 ? 'not-allowed' : 'pointer',
          }}>
          <Undo2 className="w-3.5 h-3.5" style={{ transform: 'scaleX(-1)' }} />
          重做
        </button>
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 16, background: MK.sep }} />

      {/* Alignment */}
      {selectedItemIdsSize > 1 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 9, color: '#64748b', marginRight: 2 }}>对齐</span>
            {alignBtns.map(({ dir, label }) => (
              <button
                key={dir}
                onClick={() => onAlignSelected(dir)}
                title={`对齐${label}`}
                style={{
                  width: 22, height: 22, borderRadius: 4, fontSize: 11,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#94a3b8', cursor: 'pointer',
                }}>
                {label}
              </button>
            ))}
          </div>
          {/* Separator */}
          <div style={{ width: 1, height: 16, background: MK.sep }} />
        </>
      )}

      {/* Snap */}
      <button
        onClick={onToggleSnap}
        title={snapEnabled ? '网格吸附：开' : '网格吸附：关'}
        style={{
          ...btnMini,
          background: snapEnabled ? 'rgba(99,102,241,0.1)' : 'none',
          borderColor: snapEnabled ? 'rgba(99,102,241,0.3)' : MK.border,
          color: snapEnabled ? MK.blue : MK.muted,
        }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <line x1="0" y1="4" x2="12" y2="4" stroke="currentColor" strokeWidth="1" />
          <line x1="0" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1" />
          <line x1="4" y1="0" x2="4" y2="12" stroke="currentColor" strokeWidth="1" />
          <line x1="8" y1="0" x2="8" y2="12" stroke="currentColor" strokeWidth="1" />
        </svg>
        {snapEnabled ? '吸附' : '自由'}
      </button>

      {/* Separator */}
      <div style={{ width: 1, height: 16, background: MK.sep }} />

      {/* Zoom */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={onZoomOut} title="缩小 (Ctrl+-)"
          style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'none', border: '1px solid rgba(255,255,255,0.08)',
            color: MK.muted, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Minus className="w-3 h-3" />
        </button>
        <button
          onClick={onZoomReset} title="重置缩放 (Ctrl+0)"
          style={{
            minWidth: 48, height: 24, borderRadius: 6,
            background: 'none', border: '1px solid rgba(255,255,255,0.08)',
            color: '#94a3b8', fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer', textAlign: 'center',
          }}>
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={onZoomIn} title="放大 (Ctrl+=)"
          style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'none', border: '1px solid rgba(255,255,255,0.08)',
            color: MK.muted, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Explore (switch to Graph view) */}
      {onExplore && (
        <button
          onClick={onExplore}
          title="探索图谱 — 浏览全貌"
          style={{
            ...btnMini,
            background: 'rgba(56,189,248,0.08)',
            borderColor: 'rgba(56,189,248,0.25)',
            color: '#7dd3fc',
            cursor: 'pointer',
          }}>
          <Network className="w-3.5 h-3.5" />
          探索
        </button>
      )}
    </div>
  );
}

// ── CanvasToolbar (root) ─────────────────────────────────────────────────────
interface CanvasToolbarProps {
  canvasMode: CanvasMode;
  onModeSwitch: (mode: CanvasMode) => void;
  onAddNode: () => void;
  onAddSpace: () => void;
  onAutoLayout: () => void;
  onShowSqlPreview: () => void;
  showSqlPreview: boolean;
  onShowHelp: () => void;
  showHelp: boolean;
  onShowClearMenu: () => void;
  activeLayer: MECELayer;
  onLayerChange: (layer: MECELayer) => void;
  showLayerDropdown: boolean;
  onToggleLayerDropdown: () => void;
  onMeceFill: () => void;
  isAIFilling: boolean;
  onLoadSchemaTables: () => void;
  undoStackLength: number;
  redoStackLength: number;
  onUndo: () => void;
  onRedo: () => void;
  selectedItemIdsSize: number;
  onAlignSelected: (dir: 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY') => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onExplore?: () => void;
}

const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  canvasMode, onModeSwitch,
  onAddNode, onAddSpace, onAutoLayout,
  onShowSqlPreview, showSqlPreview,
  onShowHelp, showHelp, onShowClearMenu,
  activeLayer, onLayerChange, showLayerDropdown, onToggleLayerDropdown, onMeceFill, isAIFilling,
  onLoadSchemaTables,
  undoStackLength, redoStackLength, onUndo, onRedo,
  selectedItemIdsSize, onAlignSelected,
  snapEnabled, onToggleSnap,
  zoom, onZoomIn, onZoomOut, onZoomReset,
  onExplore,
}) => {
  return (
    <>
      <ModeSelector canvasMode={canvasMode} onModeSwitch={onModeSwitch} />

      {/* Main tool row — horizontal scroll when too wide */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 12px',
        background: 'rgba(23,23,35,0.95)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        maxWidth: 'calc(100% - 16px)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {canvasMode === 'pipeline' && (
            <PipelineToolbar
              onAddNode={onAddNode} onAutoLayout={onAutoLayout}
              onShowSqlPreview={onShowSqlPreview} showSqlPreview={showSqlPreview}
              onShowHelp={onShowHelp} showHelp={showHelp}
              onShowClearMenu={onShowClearMenu}
            />
          )}
          {canvasMode === 'knowledge' && (
            <KnowledgeToolbar
              onAddNode={onAddNode} onAddSpace={onAddSpace} onAutoLayout={onAutoLayout}
              activeLayer={activeLayer} onLayerChange={onLayerChange}
              showLayerDropdown={showLayerDropdown} onToggleLayerDropdown={onToggleLayerDropdown}
              onMeceFill={onMeceFill} isAIFilling={isAIFilling}
              onShowHelp={onShowHelp} showHelp={showHelp}
              onShowClearMenu={onShowClearMenu}
            />
          )}
          {canvasMode === 'explorer' && (
            <ExplorerToolbar
              onLoadSchemaTables={onLoadSchemaTables}
              onShowSqlPreview={onShowSqlPreview} showSqlPreview={showSqlPreview}
              onShowHelp={onShowHelp} showHelp={showHelp}
              onShowClearMenu={onShowClearMenu}
            />
          )}
        </div>
      </div>

      {/* Utility row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <UtilityRow
          undoStackLength={undoStackLength} redoStackLength={redoStackLength}
          onUndo={onUndo} onRedo={onRedo}
          selectedItemIdsSize={selectedItemIdsSize} onAlignSelected={onAlignSelected}
          snapEnabled={snapEnabled} onToggleSnap={onToggleSnap}
          zoom={zoom} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onZoomReset={onZoomReset}
          onExplore={onExplore}
        />
      </div>
    </>
  );
};

export default CanvasToolbar;
