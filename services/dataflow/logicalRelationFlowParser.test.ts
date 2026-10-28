import { describe, expect, it } from 'vitest';
import { hashSql, isFlowDataCurrent, parseLogicalRelationFlow } from './logicalRelationFlowParser';

describe('logical relation flow contract', () => {
  it('uses standard SHA-256 content hashes in browser-safe code', () => {
    expect(hashSql('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it('builds relation/operator flow without physical plan fields', () => {
    const sql = `SELECT category, SUM(amount) AS total
      FROM orders WHERE status = 'paid' GROUP BY category ORDER BY total DESC LIMIT 10`;
    const flow = parseLogicalRelationFlow(sql);
    expect(flow.contractVersion).toBe('2.0');
    expect(flow.source.sourceHash).toBe(hashSql(sql));
    expect(flow.nodes.some(node => node.kind === 'relation' && node.relation?.sourceKind === 'table')).toBe(true);
    expect(flow.nodes.some(node => node.operator?.type === 'filter')).toBe(true);
    expect(flow.nodes.some(node => node.operator?.type === 'aggregate')).toBe(true);
    expect(flow.nodes.some(node => node.operator?.type === 'projection')).toBe(true);
    expect(JSON.stringify(flow)).not.toMatch(/physicalPlan|EXPLAIN|executionPlan/i);
  });

  it('keeps query boundaries and recursive back edges', () => {
    const flow = parseLogicalRelationFlow(`WITH RECURSIVE tree AS (
      SELECT 1 AS n UNION ALL SELECT n + 1 FROM tree WHERE n < 3
    ) SELECT * FROM tree`);
    expect(flow.nodes.some(node => node.boundary?.kind === 'recursive_cte')).toBe(true);
    expect(flow.edges.some(edge => edge.kind === 'recursive_back')).toBe(true);
    expect(flow.nodes.some(node => node.relation?.sourceKind === 'cte_reference')).toBe(true);
  });

  it('preserves set operation modifiers and reshape operators', () => {
    const flow = parseLogicalRelationFlow(`SELECT * FROM a UNION ALL BY NAME SELECT * FROM b`);
    const set = flow.nodes.find(node => node.operator?.type === 'set_operation');
    expect(set?.operator?.details).toMatchObject({ operation: 'UNION', modifier: 'ALL' });
    const pivot = parseLogicalRelationFlow(`PIVOT (SELECT category, amount FROM sales) ON category USING sum(amount)`);
    expect(pivot.nodes.some(node => node.operator?.type === 'reshape' && node.operator.subtype === 'PIVOT')).toBe(true);
  });

  it('keeps join subtypes and reports incomplete SQL without a stale graph', () => {
    const flow = parseLogicalRelationFlow('SELECT * FROM a LEFT JOIN b ON a.id = b.id');
    expect(flow.nodes.some(node => node.operator?.type === 'join' && node.operator.subtype === 'LEFT')).toBe(true);
    const incomplete = parseLogicalRelationFlow('SELECT * FROM (');
    expect(incomplete.status).toBe('parse_error');
    expect(incomplete.diagnostics.some(diagnostic => diagnostic.code === 'FLOW_PARSE_ERROR')).toBe(true);
  });

  it('uses the current SQL hash and never accepts stale flow data', () => {
    const sql = 'SELECT * FROM orders';
    const flow = parseLogicalRelationFlow(sql);
    expect(isFlowDataCurrent(flow, sql)).toBe(true);
    expect(isFlowDataCurrent(flow, `${sql} WHERE id > 1`)).toBe(false);
  });

  it('supports multi-statement boundaries', () => {
    const flow = parseLogicalRelationFlow('CREATE TEMP TABLE t AS SELECT 1 AS x; SELECT * FROM t;');
    expect(flow.statements).toHaveLength(2);
    expect(new Set(flow.statements.map(statement => statement.boundaryId)).size).toBe(2);
  });
});
