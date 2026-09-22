import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { useOntologyWorkspaceStore } from '../../../hooks/useOntologyWorkspaceStore';
import {
  OntologyAiCopilotController,
  GraphAnalyticsController,
  EtlMappingAuditController,
  GovernanceAuditController,
  SemanticFederationController,
} from '../../../services/ontology/ontologyWorkspaceBackendExtended';

describe('Ontology Workspace MECE Subsystems Batch 2 (Controllers 6-10)', () => {
  beforeEach(() => {
    const store = useOntologyWorkspaceStore.getState();
    store.setActiveMode('map');
    store.setFocusEntity('Product');
  });

  // ==========================================================================
  // CONTROLLER 6: Ontology AI Copilot & NL-to-SQL
  // ==========================================================================
  it('Controller 6 (MECE-6): AI Copilot generates domain concepts and transpiles NL questions to SQL', async () => {
    // 1. Generate ontology from prompt
    const generated = await OntologyAiCopilotController.generateOntologyFromPrompt(
      'Create a logistics and warehouse distribution model'
    );
    expect(generated.concepts.length).toBeGreaterThanOrEqual(1);
    expect(generated.concepts[0].name).toBe('WarehouseHub');
    expect(generated.axiomsCount).toBeGreaterThan(0);

    // 2. NL to SQL translation
    const queryResult = await OntologyAiCopilotController.translateNlToSemanticQuery(
      'Find top products with high revenue and their suppliers',
      'Product'
    );
    expect(queryResult.sqlQuery).toContain('SELECT');
    expect(queryResult.sqlQuery).toContain('main.products');
    expect(queryResult.navigatedConcepts).toContain('Product');
    expect(queryResult.confidence).toBeGreaterThan(0.9);
  });

  // ==========================================================================
  // CONTROLLER 7: Graph Analytics & Centrality
  // ==========================================================================
  it('Controller 7 (MECE-7): Graph Analytics computes topology density, centrality scores and detects cycles', () => {
    const state = useOntologyWorkspaceStore.getState();
    const metrics = GraphAnalyticsController.calculateTopologyMetrics(state.nodes, state.edges);

    expect(metrics.totalNodes).toBeGreaterThan(10);
    expect(metrics.totalEdges).toBeGreaterThan(15);
    expect(metrics.graphDensity).toBeGreaterThan(0);
    expect(metrics.averageDegree).toBeGreaterThan(0);
    expect(metrics.hasCycles).toBe(false); // Valid hierarchy should have no cycles
    expect(metrics.topCentralConcepts.length).toBeGreaterThan(0);
    expect(metrics.topCentralConcepts[0].degree).toBeGreaterThanOrEqual(2);
  });

  // ==========================================================================
  // CONTROLLER 8: ETL Ingestion & Arrow Mapping Audit
  // ==========================================================================
  it('Controller 8 (MECE-8): ETL Mapping Audit verifies column integrity and generates DuckDB view scripts', async () => {
    const state = useOntologyWorkspaceStore.getState();
    const productMapping = state.mappings[0];

    const audit = await EtlMappingAuditController.auditMappingIntegrity(productMapping);
    expect(audit.integrityScore).toBeGreaterThan(90);
    expect(audit.duplicateKeyCount).toBe(0);
    expect(audit.recommendations.length).toBeGreaterThan(0);

    const etlSql = EtlMappingAuditController.generateDuckDbIngestionSql(productMapping);
    expect(etlSql).toContain('CREATE OR REPLACE VIEW');
    expect(etlSql).toContain('v_ontology_product');
  });

  // ==========================================================================
  // CONTROLLER 9: Governance & Compliance Auditing
  // ==========================================================================
  it('Controller 9 (MECE-9): Governance Controller audits naming conventions, annotations, and health score', () => {
    const state = useOntologyWorkspaceStore.getState();
    const report = GovernanceAuditController.auditGovernanceStandards(state.nodes, state.edges);

    expect(report.healthScore).toBeGreaterThanOrEqual(70);
    expect(report.totalAxiomsChecked).toBeGreaterThan(20);
    expect(Array.isArray(report.issues)).toBe(true);
  });

  // ==========================================================================
  // CONTROLLER 10: Semantic Federation & Schema Alignment
  // ==========================================================================
  it('Controller 10 (MECE-10): Semantic Federation reconciles external schema payloads to ontology properties', async () => {
    const externalApiPayload = {
      sourceName: 'ext_payments_gateway',
      fields: [
        { name: 'transaction_id', type: 'VARCHAR', sampleValue: 'TXN-9021' },
        { name: 'charged_amount', type: 'DECIMAL', sampleValue: 129.5 },
        { name: 'timestamp_utc', type: 'TIMESTAMP', sampleValue: '2026-08-30T14:20:00Z' },
      ],
    };

    const alignments = await SemanticFederationController.proposeSchemaAlignments(
      externalApiPayload,
      'Payment'
    );

    expect(alignments.length).toBe(3);
    const amountAlignment = alignments.find((a) => a.externalField === 'charged_amount');
    expect(amountAlignment?.suggestedOntologyProperty).toBe('amount');
    expect(amountAlignment?.confidenceScore).toBeGreaterThan(0.9);
  });
});
