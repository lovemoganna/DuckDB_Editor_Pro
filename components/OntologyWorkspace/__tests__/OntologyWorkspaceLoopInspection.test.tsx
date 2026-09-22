import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useOntologyWorkspaceStore } from '../../../hooks/useOntologyWorkspaceStore';
import { OntologyWorkspace } from '../OntologyWorkspace';
import {
  SchemaCatalogController,
  ShaclValidationController,
  OntologyReasoningController,
  OntologySqlTranspiler,
  VersionLifecycleController,
} from '../../../services/ontology/ontologyWorkspaceBackend';

describe('Ontology Workspace MECE Loop Inspection & Render Verification', () => {
  beforeEach(() => {
    const store = useOntologyWorkspaceStore.getState();
    store.setActiveMode('map');
    store.setFocusEntity('Product');
  });

  // ==========================================================================
  // LOOP 1: MAP Global Overview Rendering & Interaction
  // ==========================================================================
  it('Loop 1: MAP Canvas renders Y-axis abstraction levels and X-axis domain channels', () => {
    const { container } = render(<OntologyWorkspace />);

    // Verify 5 Domains
    expect(screen.getAllByText('Commerce').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Customer').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Fulfillment').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Risk').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Finance').length).toBeGreaterThanOrEqual(1);

    // Verify Y-axis layers
    expect(screen.getAllByText('L0').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('L1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('L2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('L3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('GROUNDING LAYER').length).toBeGreaterThanOrEqual(1);

    // Verify Core entities in MAP
    expect(screen.getAllByText('Product').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Category').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('BusinessEntity').length).toBeGreaterThanOrEqual(1);
  });

  // ==========================================================================
  // LOOP 2: LOCAL Neighborhood View & Dynamic Depth
  // ==========================================================================
  it('Loop 2: LOCAL Canvas renders concentric neighbors and sample individual pills', () => {
    useOntologyWorkspaceStore.getState().setActiveMode('local');
    useOntologyWorkspaceStore.getState().setFocusEntity('Product');

    render(<OntologyWorkspace />);

    // Verify Focus node
    expect(screen.getAllByText('Product').length).toBeGreaterThanOrEqual(1);

    // Verify surrounding neighbors
    expect(screen.getAllByText('BusinessEntity').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Category').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Supplier').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Store').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Electronics').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Clothing').length).toBeGreaterThanOrEqual(1);

    // Verify aggregated individuals are derived from the ontology model
    expect(screen.getByText('2.35M')).toBeDefined();

    // Verify MiniMap
    expect(screen.getByText('Mini Map')).toBeDefined();
  });

  // ==========================================================================
  // LOOP 3: MATRIX Grid & Cell Tooltip
  // ==========================================================================
  it('Loop 3: MATRIX View renders L1 grid and cell selection highlight', () => {
    useOntologyWorkspaceStore.getState().setActiveMode('matrix');

    render(<OntologyWorkspace />);

    // Verify Matrix table headers
    expect(screen.getByText('Entity \\ Target')).toBeDefined();
    expect(screen.getAllByText('Product').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Supplier').length).toBeGreaterThanOrEqual(2);

    // Verify Breadcrumb
    expect(screen.getByText(/Ontology > All > L1 > Product > Supplier/i)).toBeDefined();
  });

  // ==========================================================================
  // LOOP 4: PATH Lineage & Provenance Explain
  // ==========================================================================
  it('Loop 4: PATH View renders multi-hop sequence and explain cards', () => {
    useOntologyWorkspaceStore.getState().setActiveMode('path');
    useOntologyWorkspaceStore.getState().setPathEndpoints('Product', 'Supplier');

    render(<OntologyWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: /Find Paths/i }));

    // Verify Path list
    expect(screen.getAllByText(/Path 1/i).length).toBeGreaterThanOrEqual(1);

    // Verify Step 1
    expect(screen.getAllByText(/suppliedBy/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Provenance & Axiom Evidence/i)).toBeDefined();
  });

  // ==========================================================================
  // LOOP 5: COMPARE Mode Feature Matrix
  // ==========================================================================
  it('Loop 5: COMPARE View renders side-by-side hero cards and diff metrics', () => {
    const store = useOntologyWorkspaceStore.getState();
    store.selectEntity('Product', false);
    store.selectEntity('Supplier', true); // Triggers Compare Mode

    render(<OntologyWorkspace />);

    expect(screen.getByText('Compare Mode')).toBeDefined();
    expect(screen.getByText('SuperClass')).toBeDefined();
    expect(screen.getByText('SubClasses')).toBeDefined();
    expect(screen.getByText('Instances (approx.)')).toBeDefined();
    expect(screen.getByText(/^Shared \(\d+\)$/)).toBeDefined();
    expect(screen.getByText(/^Only in Product \(\d+\)$/)).toBeDefined();
    expect(screen.getByText(/^Only in Supplier \(\d+\)$/)).toBeDefined();
  });

  // ==========================================================================
  // LOOP 6: DIFF Mode Version Comparison
  // ==========================================================================
  it('Loop 6: DIFF View renders v0.8 vs v0.9 change tree and impact breakdown', () => {
    useOntologyWorkspaceStore.getState().setActiveMode('diff');

    render(<OntologyWorkspace />);

    expect(screen.getByText('DIFF MODE:')).toBeDefined();
    expect(screen.getAllByText(/v0.8/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/v0.9/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Added/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Modified/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Removed/i).length).toBeGreaterThanOrEqual(1);
  });

  // ==========================================================================
  // LOOP 7: MECE Backend Controllers & Closed-Loop Pipeline
  // ==========================================================================
  it('Loop 7: MECE Backend Controllers execute catalog sampling, SHACL check, reasoning, and serialization', async () => {
    // 1. Schema Catalog
    const tables = await SchemaCatalogController.listPhysicalTables();
    expect(Array.isArray(tables)).toBe(true);
    if (tables.some((table) => `${table.schema}.${table.tableName}` === 'main.products')) {
      const productSamples = await SchemaCatalogController.sampleTableRows('main.products', 5);
      expect(productSamples.length).toBeLessThanOrEqual(5);
    }

    // 2. SHACL Validation
    const state = useOntologyWorkspaceStore.getState();
    const issues = await ShaclValidationController.executeShaclValidation(state.nodes, state.mappings);
    expect(Array.isArray(issues)).toBe(true);
    expect(issues.every((issue) => ['error', 'warning', 'info'].includes(issue.severity))).toBe(true);

    // 3. Reasoning Engine
    const report = await OntologyReasoningController.executeReasoning(state.nodes, state.edges);
    expect(report.status).toBe('current');
    expect(report.totalInferredAxioms).toBeGreaterThanOrEqual(report.inferredAxioms.length);
    expect(report.newInferredCount).toBe(report.inferredAxioms.length);

    // 4. SQL Transpilation
    const sql = OntologySqlTranspiler.transpileToDuckDbSql({
      sourceClass: 'Product',
      targetClass: 'Supplier',
      relationChain: ['suppliedBy'],
    });
    expect(sql).toContain('SELECT * FROM main.products');

    // 5. Version Lifecycle & Export
    const turtleExport = VersionLifecycleController.exportOntology('ttl', state.nodes, state.edges);
    expect(turtleExport).toContain('@prefix owl:');
  });
});
