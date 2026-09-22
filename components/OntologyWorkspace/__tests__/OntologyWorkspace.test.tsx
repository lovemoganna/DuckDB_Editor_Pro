import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useOntologyWorkspaceStore } from '../../../hooks/useOntologyWorkspaceStore';
import { OntologyWorkspace } from '../OntologyWorkspace';

describe('Ontology Workspace & State Pipeline', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useOntologyWorkspaceStore.getState();
    store.setActiveMode('map');
    store.setFocusEntity('Product');
  });

  it('initializes with single Analysis Context and core ontology topology', () => {
    const state = useOntologyWorkspaceStore.getState();
    expect(state.nodes.length).toBeGreaterThan(10);
    expect(state.edges.length).toBeGreaterThan(15);
    expect(state.context.focusEntityId).toBe('Product');
    expect(state.context.activeMode).toBe('map');

    // Verify L0, L1, L2, L3, Grounding nodes exist
    const l0 = state.nodes.filter((n) => n.abstractionLevel === 'L0');
    const l1 = state.nodes.filter((n) => n.abstractionLevel === 'L1');
    const l3 = state.nodes.filter((n) => n.abstractionLevel === 'L3');
    const grounding = state.nodes.filter((n) => n.abstractionLevel === 'GROUNDING');

    expect(l0.length).toBeGreaterThan(0);
    expect(l1.length).toBeGreaterThan(0);
    expect(l3.length).toBeGreaterThan(0);
    expect(grounding.length).toBeGreaterThan(0);
  });

  it('switches view modes without losing analysis context and records history', () => {
    const { setActiveMode, context } = useOntologyWorkspaceStore.getState();

    setActiveMode('local');
    expect(useOntologyWorkspaceStore.getState().context.activeMode).toBe('local');
    expect(useOntologyWorkspaceStore.getState().context.focusEntityId).toBe('Product');

    setActiveMode('matrix');
    expect(useOntologyWorkspaceStore.getState().context.activeMode).toBe('matrix');
    expect(useOntologyWorkspaceStore.getState().context.focusEntityId).toBe('Product');

    setActiveMode('path');
    expect(useOntologyWorkspaceStore.getState().context.activeMode).toBe('path');
    expect(useOntologyWorkspaceStore.getState().context.focusEntityId).toBe('Product');

    expect(useOntologyWorkspaceStore.getState().context.history.length).toBeGreaterThan(1);
  });

  it('multi-selecting 2 entities triggers COMPARE mode', () => {
    const { selectEntity } = useOntologyWorkspaceStore.getState();
    selectEntity('Product', false);
    selectEntity('Supplier', true); // Shift + Click

    const state = useOntologyWorkspaceStore.getState();
    expect(state.context.activeMode).toBe('compare');
    expect(state.context.selectedEntityIds).toContain('Product');
    expect(state.context.selectedEntityIds).toContain('Supplier');
  });

  it('calculates shortest path and provenance explain between Product and Supplier', () => {
    const { findPaths } = useOntologyWorkspaceStore.getState();
    const paths = findPaths('Product', 'Supplier');

    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0].isShortest).toBe(true);
    expect(paths[0].steps[0].relation).toBe('suppliedBy');
  });

  it('triggers closed-loop editing, recalculates impact, and sets validation/reasoning to stale', () => {
    const { applyPropertyEditToDraft, statePipeline } = useOntologyWorkspaceStore.getState();

    applyPropertyEditToDraft({
      propertyName: 'suppliedBy',
      domain: 'Product',
      range: 'Supplier OR Store',
      characteristics: { functional: false },
    });

    const newState = useOntologyWorkspaceStore.getState();

    // Verify State Pipeline transitions
    expect(newState.statePipeline.modelStatus).toBe('modified');
    expect(newState.statePipeline.mappingStatus).toBe('needs_check');
    expect(newState.statePipeline.validationStatus).toBe('stale');
    expect(newState.statePipeline.reasoningStatus).toBe('outdated');
    expect(newState.draftChanges.length).toBeGreaterThan(0);

    // Verify Impact Preview in draft
    const latestChange = newState.draftChanges[0];
    expect(latestChange.impact.classesCount).toBeGreaterThan(0);
    expect(latestChange.impact.objectPropertiesCount).toBeGreaterThan(0);
    expect(latestChange.impact.examples).toContain('Product');
  });

  it('runs reasoning and transitions status pipeline to completed', async () => {
    const { runReasoning } = useOntologyWorkspaceStore.getState();
    await runReasoning();

    const state = useOntologyWorkspaceStore.getState();
    expect(state.statePipeline.reasoningStatus).toBe('completed');
    expect(state.reasoningReport.status).toBe('current');
    expect(state.reasoningReport.inferredAxioms.length).toBeGreaterThan(0);
  });

  it('renders OntologyWorkspace component and all main panels without errors', () => {
    render(<OntologyWorkspace />);

    // Verify Explorer is present
    expect(screen.getByText('Explorer')).toBeDefined();
    expect(screen.getByText('Connections')).toBeDefined();
    expect(screen.getAllByText('Local Connection').length).toBeGreaterThanOrEqual(1);

    // Verify Navigation Bar is present
    expect(screen.getByText('MAP (Global)')).toBeDefined();
    expect(screen.getByText('LOCAL (Neighborhood)')).toBeDefined();
    expect(screen.getByText('MATRIX (Same-level)')).toBeDefined();
    expect(screen.getByText('PATH (Trace)')).toBeDefined();
    expect(screen.getByText('COMPARE')).toBeDefined();
    expect(screen.getByText('DIFF')).toBeDefined();

    // Verify Status Pipeline is present
    expect(screen.getByText('运行验证')).toBeDefined();
    expect(screen.getByText('运行推理')).toBeDefined();
    expect(screen.getByText('发布模型')).toBeDefined();
  });
});
