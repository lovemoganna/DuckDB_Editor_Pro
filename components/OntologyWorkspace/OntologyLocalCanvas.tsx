import React, { useState } from 'react';
import {
  Compass,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Layers,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Sparkles,
  Check,
  RotateCcw,
} from 'lucide-react';
import { useOntologyWorkspaceStore } from '../../hooks/useOntologyWorkspaceStore';

export const OntologyLocalCanvas: React.FC = () => {
  const {
    nodes,
    edges,
    context,
    setFocusEntity,
    selectEntity,
    setDepth,
  } = useOntologyWorkspaceStore();

  const [zoomLevel, setZoomLevel] = useState(100);
  const [showHierarchy, setShowHierarchy] = useState(true);
  const [showSameLevel, setShowSameLevel] = useState(true);
  const [showCrossLevel, setShowCrossLevel] = useState(true);

  const focusName = context.focusEntityId || 'Product';
  const focusNode = nodes.find((n) => n.id === focusName || n.name === focusName) || nodes[0];
  if (!focusNode) return null;

  const handleNeighborClick = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    if (e.shiftKey) {
      selectEntity(name, true);
    } else {
      selectEntity(name, false);
      setFocusEntity(name);
    }
  };

  const handleNeighborDoubleClick = (name: string) => {
    setFocusEntity(name);
  };

  const depth = context.depth || 2;

  const visibleEdges = edges.filter((edge) => {
    if (context.assertedInferredFilter === 'asserted' && !edge.asserted) return false;
    if (context.assertedInferredFilter === 'inferred' && !edge.inferred) return false;
    if (context.relationTypeFilter !== 'All' && edge.type !== context.relationTypeFilter && edge.relationName !== context.relationTypeFilter) return false;
    return true;
  });
  const parentRelation = visibleEdges.find((edge) => edge.source === focusNode.name && edge.type === 'subClassOf');
  const sameLevelRelations = visibleEdges.filter((edge) => edge.type !== 'subClassOf' && edge.type !== 'mappedTo' && (edge.source === focusNode.name || edge.target === focusNode.name));
  const neighborFor = (edge: (typeof visibleEdges)[number] | undefined) => edge ? nodes.find((node) => node.name === (edge.source === focusNode.name ? edge.target : edge.source)) : undefined;
  const leftRelation = sameLevelRelations[0];
  const rightRelation = sameLevelRelations[1];
  const lowerRelation = sameLevelRelations[2];
  const leftNode = neighborFor(leftRelation);
  const rightNode = neighborFor(rightRelation);
  const lowerNode = neighborFor(lowerRelation);
  const childNodes = depth > 1 ? visibleEdges.filter((edge) => edge.target === focusNode.name && edge.type === 'subClassOf').map((edge) => nodes.find((node) => node.name === edge.source)).filter((node): node is NonNullable<typeof node> => Boolean(node)) : [];
  const groundingRelation = visibleEdges.find((edge) => edge.source === focusNode.name && edge.type === 'mappedTo');
  const groundingNode = groundingRelation ? nodes.find((node) => node.name === groundingRelation.target) : undefined;
  const aggregateNodes = context.showInstancesMode === 'hidden' ? [] : nodes.filter((node) => node.type === 'individual_agg' && node.parentClassId === focusNode.id);

  return (
    <div className="relative flex-1 overflow-hidden bg-monokai-bg select-none flex flex-col font-sans">
      {/* 1. TOP LOCAL CONTROLS BAR */}
      <div className="flex h-10 items-center justify-between border-b border-monokai-border bg-monokai-bg px-4 text-xs">
        <div className="flex items-center gap-4">
          {/* Scope Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-monokai-comment">Scope:</span>
            <select
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="bg-monokai-elevated border border-monokai-border rounded px-2.5 py-1 text-xs text-white font-mono outline-none"
            >
              <option value={1}>1 hop</option>
              <option value={2}>2 hops</option>
              <option value={3}>3 hops</option>
            </select>
          </div>

          {/* Filter Checkboxes */}
          <div className="flex items-center gap-3 text-monokai-fg-muted">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showHierarchy}
                onChange={(e) => setShowHierarchy(e.target.checked)}
                className="rounded border-monokai-border bg-monokai-elevated text-monokai-cyan"
              />
              <span>Hierarchy</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showSameLevel}
                onChange={(e) => setShowSameLevel(e.target.checked)}
                className="rounded border-monokai-border bg-monokai-elevated text-monokai-cyan"
              />
              <span>Same-level</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showCrossLevel}
                onChange={(e) => setShowCrossLevel(e.target.checked)}
                className="rounded border-monokai-border bg-monokai-elevated text-monokai-cyan"
              />
              <span>Cross-level</span>
            </label>
          </div>
        </div>

        <button
          onClick={() => {
            setShowHierarchy(true);
            setShowSameLevel(true);
            setShowCrossLevel(true);
            setDepth(2);
          }}
          className="text-xs text-monokai-comment hover:text-white flex items-center gap-1"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Clear</span>
        </button>
      </div>

      {/* 2. LOCAL CANVAS BODY */}
      <div className="relative flex-1 flex items-center justify-center p-6 overflow-hidden">
        {/* Background Radial Dots */}
        <div className="absolute inset-0 bg-[radial-gradient(var(--monokai-elevated)_1px,transparent_1px)] [background-size:20px_20px] opacity-35" />

        {/* Concentric Guide Rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-[300px] h-[300px] rounded-full border border-dashed border-monokai-cyan" />
          <div className="w-[520px] h-[520px] rounded-full border border-dashed border-monokai-cyan absolute" />
        </div>

        {/* Center Surrounding Node Structure */}
        <div
          className="relative w-[780px] h-[520px] flex items-center justify-center transition-transform duration-200"
          style={{ transform: `scale(${zoomLevel / 100})` }}
        >
          {/* CENTER FOCUS NODE */}
          <div
            className="absolute z-20 flex flex-col items-center justify-center px-6 py-3 rounded-xl bg-monokai-elevated border-2 border-monokai-cyan shadow-2xl shadow-monokai-cyan/30 ring-4 ring-monokai-cyan/20"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-monokai-purple" />
              <span className="font-bold text-sm text-white">{focusNode.label}</span>
            </div>
            <span className="text-[10px] font-mono text-monokai-cyan mt-0.5">
              {focusNode.abstractionLevel} Domain Concepts
            </span>
          </div>

          {/* Under Center Focus Node: Sample Individuals */}
          <div className="absolute top-[290px] flex items-center gap-2 z-15">
            {aggregateNodes.map((p) => (
              <div
                key={p.name}
                className="px-2 py-1 rounded bg-monokai-elevated border border-monokai-orange text-monokai-orange font-mono text-[10px] shadow"
              >
                <span>{p.label}</span> <span className="font-bold">{p.instanceCountLabel}</span>
              </div>
            ))}
          </div>

          {/* TOP PARENT: BusinessEntity (subClassOf) */}
          {showHierarchy && parentRelation && (
            <>
              <div
                onClick={(e) => handleNeighborClick(e, parentRelation.target)}
                onDoubleClick={() => handleNeighborDoubleClick(parentRelation.target)}
                className="absolute top-10 z-10 flex flex-col items-center px-4 py-2 rounded-lg bg-monokai-elevated border border-monokai-border hover:border-monokai-cyan text-monokai-fg-muted hover:text-white cursor-pointer shadow-md"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-monokai-purple" />
                  <span className="font-semibold text-xs">{parentRelation.target}</span>
                </div>
                <span className="text-[9.5px] font-mono text-monokai-comment">L0 Upper Ontology</span>
              </div>
              <div className="absolute top-[76px] h-[120px] w-px border-l-2 border-monokai-border flex items-center justify-center">
                <span className="bg-monokai-bg px-1.5 py-0.5 text-[9.5px] font-mono text-monokai-comment border border-monokai-border rounded shadow-md flex items-center gap-1 z-10">
                  <span className="text-monokai-purple">&uarr;</span>
                  <span>{parentRelation.relationName}</span>
                </span>
              </div>
            </>
          )}

          {/* LEFT: Category (belongsToCategory) */}
          {showSameLevel && leftRelation && leftNode && (
            <>
              <div
                onClick={(e) => handleNeighborClick(e, leftNode.name)}
                onDoubleClick={() => handleNeighborDoubleClick(leftNode.name)}
                className="absolute left-6 z-10 flex flex-col items-center px-4 py-2 rounded-lg bg-monokai-elevated border border-monokai-border hover:border-monokai-cyan text-monokai-fg-muted hover:text-white cursor-pointer shadow-md"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-monokai-purple" />
                  <span className="font-semibold text-xs">{leftNode.label}</span>
                </div>
                <span className="text-[9.5px] font-mono text-monokai-comment">L1 Domain Concepts</span>
              </div>
              <div className="absolute left-[130px] w-[180px] h-px border-t-2 border-monokai-border flex items-center justify-center">
                <span className="bg-monokai-bg px-1.5 py-0.5 text-[9.5px] font-mono text-monokai-cyan border border-monokai-border rounded shadow-md flex items-center gap-1 z-10">
                  <span>&larr;</span>
                  <span>{leftRelation.relationName}</span>
                </span>
              </div>
            </>
          )}

          {/* RIGHT: Supplier (suppliedBy) */}
          {showSameLevel && rightRelation && rightNode && (
            <>
              <div
                onClick={(e) => handleNeighborClick(e, rightNode.name)}
                onDoubleClick={() => handleNeighborDoubleClick(rightNode.name)}
                className={`absolute right-6 z-10 flex flex-col items-center px-4 py-2 rounded-lg border cursor-pointer shadow-md transition-all ${
                  context.selectedEntityIds.includes(rightNode.name)
                    ? 'bg-monokai-elevated border-2 border-monokai-accent text-white ring-2 ring-monokai-accent/30'
                    : 'bg-monokai-elevated border-monokai-border hover:border-monokai-cyan text-monokai-fg-muted hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-monokai-purple" />
                  <span className="font-semibold text-xs">{rightNode.label}</span>
                </div>
                <span className="text-[9.5px] font-mono text-monokai-comment">L1 Domain Concepts</span>

                {/* Callout hint */}
                <div className="absolute -bottom-6 bg-monokai-accent text-white px-2 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap shadow">
                  点击 {rightNode.label} 将其加入选择
                </div>
              </div>
              <div className="absolute right-[130px] w-[180px] h-px border-t-2 border-monokai-cyan flex items-center justify-center">
                <span className="bg-monokai-bg px-1.5 py-0.5 text-[9.5px] font-mono text-monokai-cyan border border-monokai-cyan rounded shadow-md flex items-center gap-1 z-10">
                  <span>{rightRelation.relationName}</span>
                  <span>&rarr;</span>
                </span>
              </div>
            </>
          )}

          {/* BOTTOM-RIGHT: Store (soldAt) */}
          {showSameLevel && lowerRelation && lowerNode && (
            <div
              onClick={(e) => handleNeighborClick(e, lowerNode.name)}
              onDoubleClick={() => handleNeighborDoubleClick(lowerNode.name)}
              className="absolute bottom-16 right-20 z-10 flex flex-col items-center px-3.5 py-1.5 rounded-lg bg-monokai-elevated border border-monokai-border hover:border-monokai-cyan text-monokai-fg-muted hover:text-white cursor-pointer shadow"
            >
              <span className="font-semibold text-xs">{lowerNode.label}</span>
              <span className="text-[9px] text-monokai-comment">L1 Domain</span>
            </div>
          )}

          {/* BOTTOM-LEFT: Electronics & Clothing */}
          {showHierarchy && childNodes.length > 0 && (
            <div className="absolute bottom-16 left-20 flex gap-4 z-10">
              {childNodes.slice(0, 4).map((child) => <div key={child.id} onClick={(e) => handleNeighborClick(e, child.name)} onDoubleClick={() => handleNeighborDoubleClick(child.name)} className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-monokai-elevated border border-monokai-border hover:border-monokai-cyan text-monokai-fg-muted hover:text-white cursor-pointer shadow"><span className="font-semibold text-xs">{child.label}</span><span className="text-[9px] text-monokai-comment">{child.abstractionLevel} Specialized</span></div>)}
            </div>
          )}

          {/* BOTTOM: main.products Table */}
          {showCrossLevel && groundingRelation && groundingNode && (
            <>
              <div
                onClick={(e) => handleNeighborClick(e, groundingNode.name)}
                className="absolute -bottom-4 z-10 flex flex-col items-center px-4 py-2 rounded-lg bg-monokai-elevated border border-monokai-cyan hover:border-monokai-cyan text-monokai-cyan hover:text-white cursor-pointer shadow-md"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-monokai-cyan" />
                  <span className="font-mono font-semibold text-xs">{groundingNode.label}</span>
                </div>
                <span className="text-[9px] font-mono text-monokai-comment">Table · {groundingNode.instanceCountLabel || groundingNode.instanceCount?.toLocaleString() || 'live'}</span>
              </div>
              <div className="absolute bottom-[40px] h-[130px] w-px border-l-2 border-dashed border-monokai-cyan flex items-center justify-center">
                <span className="bg-monokai-bg px-1.5 py-0.5 text-[9px] font-mono text-monokai-cyan border border-monokai-cyan rounded shadow-md flex items-center gap-1 z-10">
                  <span>&darr;</span>
                  <span>{groundingRelation.relationName}</span>
                </span>
              </div>
            </>
          )}
        </div>

        {/* 3. FLOATING GRAPH LEGEND (Right) */}
        <div className="absolute right-4 top-4 p-3 rounded-lg border border-monokai-hover bg-monokai-bg/95 backdrop-blur text-[10.5px] space-y-1 text-monokai-comment shadow-2xl z-40">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-monokai-purple" />
            <span>Class</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-monokai-cyan" />
            <span>Object Property</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-monokai-cyan" />
            <span>Data Property</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-monokai-orange" />
            <span>Individual (Agg.)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-monokai-cyan" />
            <span>Data Source</span>
          </div>
          <div className="pt-1 border-t border-monokai-hover space-y-1 text-[10px]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-monokai-comment" />
              <span>subClassOf</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-monokai-cyan" />
              <span>same-level relation</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 border-t border-dashed border-monokai-cyan" />
              <span>mappedTo</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 border-t border-dashed border-monokai-orange" />
              <span>inferred</span>
            </div>
          </div>
        </div>

        {/* 4. MINIMAP & ZOOM CONTROLS (Bottom Right) */}
        <div className="absolute right-4 bottom-4 flex flex-col items-end gap-2 z-40">
          <div className="w-32 h-20 rounded-lg border border-monokai-hover bg-monokai-bg/90 backdrop-blur p-1.5 relative flex items-center justify-center shadow-lg">
            <span className="text-[9px] font-mono text-monokai-comment absolute top-1 left-1.5">Mini Map</span>
            <div className="w-16 h-10 border border-monokai-cyan/50 bg-monokai-cyan/10 rounded flex items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-monokai-cyan" />
            </div>
          </div>

          <div className="flex items-center gap-1 bg-monokai-elevated border border-monokai-border rounded px-1.5 py-0.5 text-xs text-monokai-fg-muted shadow">
            <button
              onClick={() => setZoomLevel(Math.max(50, zoomLevel - 15))}
              className="p-1 hover:text-white"
            >
              <ZoomOut className="h-3 w-3" />
            </button>
            <span className="font-mono text-[10px] px-1">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel(Math.min(150, zoomLevel + 15))}
              className="p-1 hover:text-white"
            >
              <ZoomIn className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
