import { describe, expect, it } from 'vitest';
import { Node, Edge } from 'reactflow';
import {
  compileOntologyToCTE,
  sanitizeSqlIdentifier,
  sortNodesTopologically,
} from './OntologyCteCompiler';

describe('OntologyCteCompiler', () => {
  it('should sanitize SQL identifiers correctly', () => {
    expect(sanitizeSqlIdentifier('Customer Base')).toBe('customer_base');
    expect(sanitizeSqlIdentifier('123 Order Table')).toBe('node_123_order_table');
    expect(sanitizeSqlIdentifier('User-Profile@V1!')).toBe('user_profile_v1_');
  });

  it('should sort DAG nodes topologically', () => {
    const nodes: Node[] = [
      { id: '3', data: { label: 'Node C' }, position: { x: 0, y: 0 } },
      { id: '1', data: { label: 'Node A' }, position: { x: 0, y: 0 } },
      { id: '2', data: { label: 'Node B' }, position: { x: 0, y: 0 } },
    ];

    const edges: Edge[] = [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' },
    ];

    const { order, hasCycle } = sortNodesTopologically(nodes, edges);

    expect(hasCycle).toBe(false);
    expect(order).toEqual(['1', '2', '3']);
  });

  it('should compile canvas nodes and edges to valid DuckDB CTE SQL', () => {
    const nodes: Node[] = [
      {
        id: 'n1',
        data: {
          label: 'Customer Table',
          tableName: 'raw_customers',
          columns: ['id', 'name', 'segment'],
          layer: 'Foundation',
        },
        position: { x: 0, y: 0 },
      },
      {
        id: 'n2',
        data: {
          label: 'Orders Joined',
          columns: ['id', 'customer_id', 'total_amount'],
          layer: 'Relations',
        },
        position: { x: 100, y: 0 },
      },
    ];

    const edges: Edge[] = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        data: { joinType: 'INNER', joinCondition: 'raw_customers.id = orders.customer_id' },
      },
    ];

    const result = compileOntologyToCTE(nodes, edges, { viewName: 'v_customer_orders' });

    expect(result.errors).toHaveLength(0);
    expect(result.cteCount).toBe(2);
    expect(result.topologicalOrder).toEqual(['customer_table', 'orders_joined']);
    expect(result.sql).toContain('CREATE OR REPLACE VIEW v_customer_orders AS');
    expect(result.sql).toContain('customer_table AS (');
    expect(result.sql).toContain('SELECT id, name, segment');
    expect(result.sql).toContain('FROM raw_customers');
    expect(result.sql).toContain('orders_joined AS (');
    expect(result.sql).toContain('SELECT * FROM orders_joined;');
  });

  it('fails closed instead of emitting executable SQL for a cyclic graph', () => {
    const nodes: Node[] = [
      { id: 'a', data: { label: 'Node A' }, position: { x: 0, y: 0 } },
      { id: 'b', data: { label: 'Node B' }, position: { x: 100, y: 0 } },
    ];
    const edges: Edge[] = [
      { id: 'a-b', source: 'a', target: 'b' },
      { id: 'b-a', source: 'b', target: 'a' },
    ];

    const result = compileOntologyToCTE(nodes, edges);

    expect(result.hasCycle).toBe(true);
    expect(result.cteCount).toBe(0);
    expect(result.errors).toContain('Cannot compile a cyclic ontology graph');
    expect(result.sql).not.toContain('CREATE OR REPLACE VIEW');
  });
});
