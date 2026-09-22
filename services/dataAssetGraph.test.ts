import { describe, expect, it } from 'vitest';
import { MetricDefinition, MetricPackage } from '../types';
import { DataAssetGraphService } from './dataAssetGraph';

const metric = (
  id: string,
  name: string,
  dependencies: string[],
  formula: string,
): MetricDefinition => ({
  id,
  name,
  scenario: '',
  characteristics: '',
  value: '',
  definition: '',
  formula,
  example: '',
  dependencies,
  createdAt: 1,
});

const financePackage: MetricPackage = {
  id: 'finance',
  name: 'Finance',
  description: '',
  sourceTables: ['orders'],
  createdAt: 1,
  updatedAt: 1,
  metrics: [
    metric('revenue', 'revenue', ['amount'], 'SUM(amount)'),
    metric('margin', 'margin', ['revenue', 'cost'], 'revenue - SUM(cost)'),
  ],
};

describe('DataAssetGraphService', () => {
  it('composes tables, columns, and semantic metrics into one graph', () => {
    const graph = DataAssetGraphService.build({
      schemaTree: {
        orders: [
          { name: 'amount', type: 'DECIMAL' },
          { name: 'cost', type: 'DECIMAL' },
        ],
      },
      metricPackages: [financePackage],
    });

    expect(graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'table:orders', type: 'table' }),
      expect.objectContaining({ id: 'column:orders.amount', type: 'column' }),
      expect.objectContaining({ id: 'metric:finance.revenue', type: 'metric' }),
    ]));
    expect(graph.edges).toEqual(expect.arrayContaining([
      {
        source: 'column:orders.amount',
        target: 'metric:finance.revenue',
        type: 'METRIC_DEPENDS_ON_COLUMN',
      },
      {
        source: 'metric:finance.revenue',
        target: 'metric:finance.margin',
        type: 'METRIC_DEPENDS_ON_METRIC',
      },
    ]));
  });

  it('returns transitive impact paths for a source column', () => {
    const impact = DataAssetGraphService.analyzeColumnImpact(
      [financePackage],
      'orders',
      'amount',
    );

    expect(impact.map(item => [item.metricId, item.depth])).toEqual([
      ['revenue', 1],
      ['margin', 2],
    ]);
  });
});
