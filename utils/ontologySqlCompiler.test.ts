import { describe, it, expect } from 'vitest';
import { compileOntologyGraphToSql, SqlCompilerNode, SqlCompilerEdge } from './ontologySqlCompiler';

describe('ontologySqlCompiler', () => {
  it('returns empty message when nodes are empty', () => {
    const res = compileOntologyGraphToSql([], []);
    expect(res.sql).toContain('Canvas graph is empty');
    expect(res.executionOrder).toEqual([]);
    expect(res.hasCycle).toBe(false);
  });

  it('correctly orders a 2-node dependency graph', () => {
    const nodes: SqlCompilerNode[] = [
      { id: 'n2', name: 'Order_Summary', sourceTable: 'orders' },
      { id: 'n1', name: 'User_Base', sourceTable: 'users' },
    ];
    const edges: SqlCompilerEdge[] = [
      { id: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', joinType: 'INNER', onCondition: 'orders.user_id = users.id' },
    ];

    const res = compileOntologyGraphToSql(nodes, edges);
    expect(res.hasCycle).toBe(false);
    expect(res.executionOrder).toEqual(['n1', 'n2']);
    expect(res.sql).toContain('WITH cte_user_base AS');
    expect(res.sql).toContain('cte_order_summary AS');
    expect(res.sql).toContain('INNER JOIN cte_user_base ON orders.user_id = users.id');
    expect(res.sql).toContain('SELECT * FROM cte_order_summary;');
  });

  it('detects cycles and provides fallback ordering', () => {
    const nodes: SqlCompilerNode[] = [
      { id: 'a', name: 'NodeA' },
      { id: 'b', name: 'NodeB' },
    ];
    const edges: SqlCompilerEdge[] = [
      { id: 'e1', sourceNodeId: 'a', targetNodeId: 'b' },
      { id: 'e2', sourceNodeId: 'b', targetNodeId: 'a' },
    ];

    const res = compileOntologyGraphToSql(nodes, edges);
    expect(res.hasCycle).toBe(true);
    expect(res.sql).toContain('Cyclic dependency detected');
  });
});
