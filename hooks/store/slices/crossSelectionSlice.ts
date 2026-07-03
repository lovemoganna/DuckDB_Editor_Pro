/**
 * crossSelectionSlice.ts — Cross-view selection state for Schema graph, Ontology graph, and Canvas
 *
 * Tracks the "navigation contract" between the three views rendered inside OntologyPanel:
 *   - SchemaGraphView  (Schema 图)
 *   - D3GraphView      (知识图谱)
 *   - OntologyCanvas    (结构画布)
 *
 * These views previously communicated via a brittle window global hack.
 * This slice replaces that with a clean, typed, Zustand-backed state.
 */

import { create } from 'zustand';

// Re-export LifeObject type from the canonical location
// (used by SchemaGraphView to display ontology objects per table)
export type { LifeObject } from '../../../hooks/useOntologyStore';

export interface CrossSelectionSlice {
  // ── Schema graph node selection ───────────────────────────
  // The table name currently highlighted/selected in SchemaGraphView
  selectedSchemaTable: string | null;
  setSelectedSchemaTable: (name: string | null) => void;

  // ── Ontology graph highlighting ────────────────────────────
  // The _sourceTable value used to filter/highlight nodes in D3GraphView
  highlightedSourceTable: string | null;
  setHighlightedSourceTable: (name: string | null) => void;

  // ── Jump orchestration ─────────────────────────────────────
  // When a schema node is clicked, SchemaGraphView calls triggerJumpToOntologyGraph()
  // to request that OntologyPanel switch to the ontology graph tab and highlight the
  // corresponding nodes. The useEffect in OntologyPanel consumes this.
  pendingJumpToOntologyGraph: boolean;
  triggerJumpToOntologyGraph: () => void;
  clearPendingJump: () => void;

  // ── Bidirectional navigation ────────────────────────────────
  // When a D3GraphView node is selected, record which schema table it came from
  // so the inspector panel can show "_sourceTable" info
  selectedOntologyNodeSourceTable: string | null;
  setSelectedOntologyNodeSourceTable: (name: string | null) => void;
}

export const createCrossSelectionSlice = (
  set: (partial: Partial<CrossSelectionSlice>) => void
): CrossSelectionSlice => ({
  selectedSchemaTable: null,
  setSelectedSchemaTable: (name) => set({ selectedSchemaTable: name }),

  highlightedSourceTable: null,
  setHighlightedSourceTable: (name) => set({ highlightedSourceTable: name }),

  pendingJumpToOntologyGraph: false,
  triggerJumpToOntologyGraph: () => set({ pendingJumpToOntologyGraph: true }),
  clearPendingJump: () => set({ pendingJumpToOntologyGraph: false }),

  selectedOntologyNodeSourceTable: null,
  setSelectedOntologyNodeSourceTable: (name) =>
    set({ selectedOntologyNodeSourceTable: name }),
});

/**
 * Standalone Zustand store for cross-view selection state.
 * Components subscribe via: const cross = useCrossSelection()
 */
export const useCrossSelection = create<CrossSelectionSlice>((set) =>
  createCrossSelectionSlice(set)
);
