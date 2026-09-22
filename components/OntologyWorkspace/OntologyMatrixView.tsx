import React, { useState } from 'react';
import {
  Grid,
  Layers,
  ArrowRight,
  Sparkles,
  Link2,
  ChevronRight,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { useOntologyWorkspaceStore } from '../../hooks/useOntologyWorkspaceStore';
import { buildSameLevelMatrix } from '../../services/ontology/ontologyWorkspaceModel';

export const OntologyMatrixView: React.FC = () => {
  const {
    nodes,
    edges,
    context,
    setFocusEntity,
    selectRelation,
    setMatrixLayer,
    setSelectedDrawerTab,
  } = useOntologyWorkspaceStore();

  const [hoveredCell, setHoveredCell] = useState<{ row: string; col: string; x?: number; y?: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: string; col: string }>({
    row: 'Product',
    col: 'Supplier',
  });

  const matrix = buildSameLevelMatrix(nodes, edges, context.matrixLayer, {
    includeInferred: context.assertedInferredFilter !== 'asserted',
    domain: context.domainFilter,
    relationTypes: context.relationTypeFilter === 'All' ? undefined : [context.relationTypeFilter],
  });
  const matrixEntities = matrix.entities.map((node) => node.name);

  const handleCellClick = (row: string, col: string) => {
    setSelectedCell({ row, col });
    setFocusEntity(row);
    const relation = matrix.cells[row]?.[col]?.relations[0];
    if (relation) selectRelation(relation.id);
    setSelectedDrawerTab('relations');
  };

  const activeCellData = matrix.cells[selectedCell.row]?.[selectedCell.col] || null;

  return (
    <div className="flex-1 overflow-hidden bg-monokai-bg flex flex-col font-sans select-none">
      {/* 1. TOP MATRIX FILTER BAR */}
      <div className="flex h-10 items-center justify-between border-b border-monokai-border bg-monokai-bg px-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-monokai-comment">
            <span>Layer:</span>
            <select aria-label="Matrix abstraction layer" value={context.matrixLayer} onChange={(event) => setMatrixLayer(event.target.value as 'L0' | 'L1' | 'L2')} className="font-semibold text-white px-2 py-0.5 rounded bg-monokai-elevated border border-monokai-border">
              <option value="L0">L0 (Upper Ontology)</option><option value="L1">L1 (Domain Concepts)</option><option value="L2">L2 (Specialized Concepts)</option>
            </select>
          </div>

          <div className="flex items-center gap-1 text-monokai-comment">
            <span>Filter:</span>
            <span className="text-monokai-cyan font-mono px-2 py-0.5 rounded bg-monokai-elevated border border-monokai-border">
              All
            </span>
          </div>

          <div className="flex items-center gap-1 text-monokai-comment">
            <span>Relation Types:</span>
            <span className="text-white px-2 py-0.5 rounded bg-monokai-elevated border border-monokai-border">
              All
            </span>
          </div>

          <div className="flex items-center gap-1 text-monokai-comment">
            <span>Data Sources:</span>
            <span className="text-white px-2 py-0.5 rounded bg-monokai-elevated border border-monokai-border">
              All
            </span>
          </div>

          <div className="flex items-center gap-1 text-monokai-comment">
            <span>Show Instances:</span>
            <span className="text-white px-2 py-0.5 rounded bg-monokai-elevated border border-monokai-border">
              Aggregated
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-monokai-accent bg-monokai-accent/15 px-2 py-0.5 rounded border border-monokai-accent/30">
            Asserted &amp; Inferred
          </span>
        </div>
      </div>

      {/* 2. MATRIX GRID BODY */}
      <div className="flex-1 overflow-auto custom-scrollbar p-4 flex flex-col justify-between">
        <div className="relative">
          <table className="w-full text-center border-collapse text-xs font-mono">
            <thead>
              <tr>
                <th className="p-2.5 border border-monokai-hover bg-monokai-surface text-monokai-comment text-left">
                  Entity \ Target
                </th>
                {matrixEntities.map((col) => (
                  <th
                    key={col}
                    className={`p-2.5 border border-monokai-hover text-[11px] font-semibold transition-colors ${
                      selectedCell.col === col || hoveredCell?.col === col
                        ? 'bg-monokai-cyan/20 text-monokai-cyan border-monokai-cyan/60'
                        : 'bg-monokai-surface text-monokai-fg-muted'
                    }`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixEntities.map((row) => (
                <tr key={row}>
                  {/* Row Header */}
                  <td
                    className={`p-2.5 border border-monokai-hover text-left text-[11px] font-semibold transition-colors ${
                      selectedCell.row === row || hoveredCell?.row === row
                        ? 'bg-monokai-cyan/20 text-monokai-cyan border-monokai-cyan/60'
                        : 'bg-monokai-surface text-monokai-fg-muted'
                    }`}
                  >
                    {row}
                  </td>

                  {/* Matrix Cells */}
                  {matrixEntities.map((col) => {
                    const cell = matrix.cells[row]?.[col];
                    const isSelected = selectedCell.row === row && selectedCell.col === col;
                    const isHovered = hoveredCell?.row === row || hoveredCell?.col === col;

                    return (
                      <td
                        key={col}
                        onClick={() => handleCellClick(row, col)}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredCell({ row, col, x: rect.left, y: rect.top });
                        }}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`p-2.5 border border-monokai-hover text-center transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-monokai-cyan text-white font-bold ring-2 ring-monokai-cyan scale-105 z-10 shadow-lg'
                            : isHovered
                            ? 'bg-monokai-elevated text-monokai-fg'
                            : 'hover:bg-monokai-elevated/60 text-monokai-comment'
                        }`}
                      >
                        {cell?.relations.length ? (
                          <div className="flex items-center justify-center gap-1">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                isSelected
                                  ? 'bg-white'
                                : cell.kind === 'inferred' || cell.kind === 'mixed'
                                  ? 'bg-monokai-orange'
                                  : 'bg-monokai-accent'
                              }`}
                            />
                            <span className="font-bold">{cell.relations.length}</span>
                          </div>
                        ) : (
                          <span className="opacity-20">&middot;</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {activeCellData?.relations.length > 0 && (
            <div className="absolute right-4 top-14 w-64 p-3 rounded-lg border border-monokai-cyan bg-monokai-surface/95 backdrop-blur shadow-2xl z-30 font-sans space-y-2 animate-in fade-in zoom-in-95">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-monokai-comment">
                Linked Highlight
              </div>
              <div className="flex items-center justify-between border-b border-monokai-hover pb-1.5">
                <span className="font-bold text-white text-xs">{selectedCell.row} &rarr; {selectedCell.col}</span>
                <span className="text-[10px] font-mono text-monokai-accent font-semibold">{activeCellData.relations.length} 条关系</span>
              </div>
              <div className="space-y-1 text-[11px] font-mono text-monokai-comment">
                <div className="flex justify-between">
                  <span>直连关系:</span>
                  <span className="text-white font-semibold">{activeCellData.relations.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>当前层级:</span>
                  <span className="text-monokai-cyan font-semibold">{context.matrixLayer} &rarr; {context.matrixLayer}</span>
                </div>
                <div className="flex justify-between">
                  <span>证据:</span>
                  <span className="text-monokai-accent font-semibold">Asserted &amp; Inferred</span>
                </div>
              </div>
              <div className="pt-1 border-t border-monokai-hover text-[10.5px] font-mono text-monokai-cyan">
                {activeCellData.relations.map((relation) => relation.relationName).join(', ')}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Breadcrumb Trail */}
        <div className="pt-3 border-t border-monokai-border flex items-center justify-between text-xs font-mono text-monokai-comment">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-monokai-elevated border border-monokai-border text-monokai-cyan">
              Ontology &gt; {context.domainFilter} &gt; {context.matrixLayer} &gt; {selectedCell.row} &gt; {selectedCell.col}
            </span>
          </div>

          <div className="text-[10.5px] text-monokai-accent font-semibold">
            选择单元格高亮: {selectedCell.row} &rarr; {selectedCell.col} ({activeCellData?.relations.length || 0} 条)
          </div>
        </div>
      </div>
    </div>
  );
};
