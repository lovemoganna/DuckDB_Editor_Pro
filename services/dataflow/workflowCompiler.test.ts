import { describe, it, expect } from 'vitest';
import {
  sortWorkflowTopologically,
  compileNodeSql,
  resolveNodeInputs,
  getNodeViewName,
} from './workflowCompiler';
import type { DataFlowNode, DataFlowEdge } from './workflowTypes';
import { buildRealExecutionWorkflow } from './sqlExecutionPlanParser';

describe('Workflow Compiler & DAG Tests', () => {
  it('preserves a long multiline SQL filter and aggregate when executing a fallback diagram', () => {
    const description = 'x'.repeat(140);
    const query = `SELECT 'USD' AS unit, SUM(amount) AS completed_amount\nFROM fiat_transactions\nWHERE status = 'completed'\nAND currency = 'USD' AND description <> '${description}';`;
    const workflow = buildRealExecutionWorkflow({ sql: query });
    const filter = workflow.nodes.find(node => node.data.type === 'schema')!;
    const aggregate = workflow.nodes.find(node => node.data.type === 'aggregate')!;
    const inputs = { primary: '_df_view_input', all: ['_df_view_input'] };
    const filteredSql = compileNodeSql(filter, inputs).sql;
    expect(filteredSql).toBe(`SELECT * FROM "_df_view_input" WHERE status = 'completed'\nAND currency = 'USD' AND description <> '${description}'`);
    expect(compileNodeSql(aggregate, inputs).sql).toBe(query.slice(0, -1));
  });

  it('correctly sorts DAG in topological order', () => {
    const nodes: DataFlowNode[] = [
      { id: 'source-1', type: 'dataFlowNode', position: { x: 0, y: 0 }, data: { id: 'source-1', type: 'source', title: 'Src', status: 'idle', config: {} } },
      { id: 'transform-1', type: 'dataFlowNode', position: { x: 0, y: 0 }, data: { id: 'transform-1', type: 'sql_transform', title: 'Tx', status: 'idle', config: {} } },
      { id: 'agg-1', type: 'dataFlowNode', position: { x: 0, y: 0 }, data: { id: 'agg-1', type: 'aggregate', title: 'Agg', status: 'idle', config: {} } },
    ];

    const edges: DataFlowEdge[] = [
      { id: 'e1', source: 'source-1', target: 'transform-1' },
      { id: 'e2', source: 'transform-1', target: 'agg-1' },
    ];

    const { order, hasCycle } = sortWorkflowTopologically(nodes, edges);
    expect(hasCycle).toBe(false);
    expect(order).toEqual(['source-1', 'transform-1', 'agg-1']);
  });

  it('detects cycles in cyclic graph', () => {
    const nodes: DataFlowNode[] = [
      { id: 'a', type: 'dataFlowNode', position: { x: 0, y: 0 }, data: { id: 'a', type: 'sql_transform', title: 'A', status: 'idle', config: {} } },
      { id: 'b', type: 'dataFlowNode', position: { x: 0, y: 0 }, data: { id: 'b', type: 'sql_transform', title: 'B', status: 'idle', config: {} } },
    ];

    const edges: DataFlowEdge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'a' },
    ];

    const { hasCycle } = sortWorkflowTopologically(nodes, edges);
    expect(hasCycle).toBe(true);
  });

  it('compiles Aggregate node SQL with GroupBy, Multi-aggregations and Filter correctly', () => {
    const node: DataFlowNode = {
      id: 'agg-node',
      type: 'dataFlowNode',
      position: { x: 0, y: 0 },
      data: {
        id: 'agg-node',
        type: 'aggregate',
        title: '聚合统计',
        status: 'configured',
        config: {
          nodeName: '聚合统计',
          groupBy: ['country', 'category'],
          aggregations: [
            { id: 'a1', alias: 'total_sales', func: 'SUM', column: 'sales_amount' },
            { id: 'a2', alias: 'order_count', func: 'COUNT', column: 'order_id' },
            { id: 'a3', alias: 'customer_count', func: 'COUNT(DISTINCT)', column: 'customer_id' },
          ],
          filter: "order_date >= '2024-01-01'\nAND order_date < '2025-01-01'",
        },
      },
    };

    const inputs = {
      primary: '_df_view_node_join',
      all: ['_df_view_node_join'],
    };

    const { sql, error } = compileNodeSql(node, inputs);
    expect(error).toBeUndefined();
    expect(sql).toContain('"country"');
    expect(sql).toContain('"category"');
    expect(sql).toContain('SUM("sales_amount") AS "total_sales"');
    expect(sql).toContain('COUNT("order_id") AS "order_count"');
    expect(sql).toContain('COUNT(DISTINCT "customer_id") AS "customer_count"');
    expect(sql).toContain('FROM "_df_view_node_join"');
    expect(sql).toContain("WHERE order_date >= '2024-01-01'");
    expect(sql).toContain('GROUP BY "country", "category"');
  });

  it('compiles Join node SQL with left and right inputs', () => {
    const node: DataFlowNode = {
      id: 'join-node',
      type: 'dataFlowNode',
      position: { x: 0, y: 0 },
      data: {
        id: 'join-node',
        type: 'join',
        title: '表连接',
        status: 'configured',
        config: {
          joinType: 'INNER',
          conditions: [
            { id: 'c1', leftColumn: 'customer_id', rightColumn: 'customer_id' },
          ],
        },
      },
    };

    const inputs = {
      left: '_df_view_sales',
      right: '_df_view_customers',
      all: ['_df_view_sales', '_df_view_customers'],
    };

    const { sql, error } = compileNodeSql(node, inputs);
    expect(error).toBeUndefined();
    expect(sql).toContain('FROM "_df_view_sales" AS l');
    expect(sql).toContain('INNER JOIN "_df_view_customers" AS r');
    expect(sql).toContain('l."customer_id" = r."customer_id"');
  });

  it('compiles Schema node with predicate and clauseSnippet into valid SQL', () => {
    const node: DataFlowNode = {
      id: 'filter-node',
      type: 'dataFlowNode',
      position: { x: 0, y: 0 },
      data: {
        id: 'filter-node',
        type: 'schema',
        title: 'FILTER (初筛)',
        status: 'configured',
        predicate: 'sales_amount > 100',
        clauseSnippet: 'WHERE sales_amount > 100',
        config: {},
      },
    };

    const inputs = {
      primary: '_df_view_raw_sales',
      all: ['_df_view_raw_sales'],
    };

    const { sql, error } = compileNodeSql(node, inputs);
    expect(error).toBeUndefined();
    expect(sql).toBe('SELECT * FROM "_df_view_raw_sales" WHERE sales_amount > 100');
  });

  it('compiles Sort and snippet SQL transforms seamlessly', () => {
    const node: DataFlowNode = {
      id: 'sort-node',
      type: 'dataFlowNode',
      position: { x: 0, y: 0 },
      data: {
        id: 'sort-node',
        type: 'sql_transform',
        title: 'SORT & LIMIT',
        status: 'configured',
        clauseSnippet: 'ORDER BY total_amount DESC LIMIT 10',
        config: {},
      },
    };

    const inputs = {
      primary: '_df_view_aggregated',
      all: ['_df_view_aggregated'],
    };

    const { sql, error } = compileNodeSql(node, inputs);
    expect(error).toBeUndefined();
    expect(sql).toBe('SELECT * FROM "_df_view_aggregated" ORDER BY total_amount DESC LIMIT 10');
  });
});
