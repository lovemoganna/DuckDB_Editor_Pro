import { describe, expect, it } from 'vitest';
import { MetricDefinition, MetricPackage } from '../types';
import { SemanticMetricCatalog } from './semanticMetricCatalog';

const metric = (overrides: Partial<MetricDefinition>): MetricDefinition => ({
  id: 'metric-1',
  name: 'revenue',
  scenario: 'sales',
  characteristics: 'additive',
  value: 'tracks sales',
  definition: 'recognized revenue',
  formula: 'SUM(amount)',
  example: 'monthly revenue',
  dependencies: ['amount'],
  unit: 'USD',
  category: 'finance',
  createdAt: 1,
  version: 1,
  history: [],
  ...overrides,
});

describe('SemanticMetricCatalog', () => {
  it('creates an immutable version with field-level change history', () => {
    const catalog = new SemanticMetricCatalog(() => 100);
    const previous = metric({});

    const next = catalog.versionMetric(previous, {
      ...previous,
      formula: 'SUM(net_amount)',
      dependencies: ['net_amount'],
    });

    expect(next).toMatchObject({
      version: 2,
      updatedAt: 100,
      formula: 'SUM(net_amount)',
    });
    expect(next.history?.at(-1)).toMatchObject({
      version: 2,
      changedAt: 100,
      changedFields: ['formula', 'dependencies'],
      previousValues: {
        formula: 'SUM(amount)',
        dependencies: ['amount'],
      },
    });
    expect(previous.version).toBe(1);
  });

  it('computes transitive impact from a source column through dependent metrics', () => {
    const catalog = new SemanticMetricCatalog(() => 100);
    const pkg: MetricPackage = {
      id: 'finance',
      name: 'Finance',
      description: '',
      sourceTables: ['orders'],
      createdAt: 1,
      updatedAt: 1,
      metrics: [
        metric({ id: 'revenue', name: 'revenue', dependencies: ['amount'] }),
        metric({ id: 'margin', name: 'margin', dependencies: ['revenue', 'cost'] }),
      ],
    };

    expect(catalog.analyzeColumnImpact([pkg], 'orders', 'amount')).toEqual([
      expect.objectContaining({ metricId: 'revenue', depth: 1 }),
      expect.objectContaining({ metricId: 'margin', depth: 2 }),
    ]);
  });

  it('builds parser-backed lineage for an aggregate metric formula', () => {
    const catalog = new SemanticMetricCatalog(() => 100);
    const graph = catalog.buildMetricLineage(metric({}), 'orders');

    expect(graph.diagnostics.errors).toEqual([]);
    expect(graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'orders', column: 'amount' }),
      expect.objectContaining({ label: 'revenue', type: 'metric' }),
    ]));
  }, 30000);
});
