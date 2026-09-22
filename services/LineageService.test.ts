import { describe, expect, it } from 'vitest';
import { LineageService } from './LineageService';

describe('LineageService parser-backed lineage', () => {
  const sql = `WITH totals AS (
    SELECT customer_id, SUM(amount) AS total
    FROM orders
    GROUP BY customer_id
  )
  SELECT c.name AS customer_name, COALESCE(t.total, 0) AS total
  FROM customers c
  JOIN totals t ON c.id = t.customer_id`;

  it('resolves physical tables, CTEs, nested expressions and column edges', () => {
    const graph = LineageService.parseSqlLineage(sql);
    const tableLabels = graph.nodes
      .filter(node => node.type === 'table')
      .map(node => node.label);

    expect(tableLabels).toEqual(expect.arrayContaining(['orders', 'customers']));
    expect(tableLabels).not.toContain('totals');
    expect(graph.diagnostics.parser).toBe('dt-sql-parser/postgresql');
    expect(graph.diagnostics.errors).toEqual([]);

    const amountSource = graph.nodes.find(node => node.table === 'orders' && node.column === 'amount');
    const innerTotal = graph.nodes.find(node =>
      node.type === 'metric' && node.label === 'total' && node.scopeDepth === 4,
    );
    const outerTotal = graph.nodes.find(node =>
      node.type === 'column' && node.label === 'total' && node.scopeDepth === 2,
    );

    expect(amountSource).toBeDefined();
    expect(innerTotal).toBeDefined();
    expect(outerTotal).toBeDefined();
    expect(graph.edges).toContainEqual(expect.objectContaining({
      source: amountSource!.id,
      target: innerTotal!.id,
      relationType: 'AGGREGATED_BY',
    }));
    expect(graph.edges).toContainEqual(expect.objectContaining({
      source: innerTotal!.id,
      target: outerTotal!.id,
      relationType: 'DERIVED_FROM',
    }));
  }, 30000);

  it('does not split a function argument comma into a fake output column', () => {
    const graph = LineageService.parseSqlLineage(sql);
    const outerOutputs = graph.nodes.filter(node =>
      node.scopeDepth === 2 && (node.type === 'column' || node.type === 'metric'),
    );

    expect(outerOutputs.map(node => node.label)).toEqual(['customer_name', 'total']);
  });

  it('fails with explicit diagnostics instead of inventing lineage for invalid SQL', () => {
    const graph = LineageService.parseSqlLineage('SELECT FROM');

    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.diagnostics.errors.length).toBeGreaterThan(0);
    expect(graph.diagnostics.confidence).toBe('blocked');
  });
});
