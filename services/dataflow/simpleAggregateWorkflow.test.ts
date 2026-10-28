import { describe, it, expect } from 'vitest';
import { buildRealExecutionWorkflow } from './sqlExecutionPlanParser';

describe('simple scalar aggregate workflow clarity', () => {
  it('builds a single connected SCAN → AGGREGATE → RESULT chain for SUM without GROUP BY', () => {
    const sql = 'SELECT ROUND(SUM(amount), 2) AS revenue FROM order_items;';
    const { nodes, edges } = buildRealExecutionWorkflow({ sql, tabTitle: '总营业额' });

    expect(nodes.length).toBeGreaterThanOrEqual(2);
    expect(nodes.length).toBeLessThanOrEqual(4);

    const sources = nodes.filter((n) => n.data.type === 'source');
    expect(sources.length).toBe(1);
    expect(
      sources[0].data.tableName === 'order_items' ||
        /order_items/i.test(sources[0].data.title) ||
        /order_items/i.test(String(sources[0].data.subtitle || '')),
    ).toBe(true);

    expect(nodes.some((n) => n.data.type === 'aggregate')).toBe(true);
    expect(nodes.some((n) => n.data.type === 'result')).toBe(true);

    // Every non-result node must have an outgoing edge; every non-source must have an incoming edge
    const outCount = new Map<string, number>();
    const inCount = new Map<string, number>();
    for (const n of nodes) {
      outCount.set(n.id, 0);
      inCount.set(n.id, 0);
    }
    for (const e of edges) {
      outCount.set(e.source, (outCount.get(e.source) || 0) + 1);
      inCount.set(e.target, (inCount.get(e.target) || 0) + 1);
    }

    for (const n of nodes) {
      if (n.data.type === 'result') {
        expect(inCount.get(n.id)).toBeGreaterThan(0);
        expect(outCount.get(n.id)).toBe(0);
      } else if (n.data.type === 'source') {
        expect(outCount.get(n.id)).toBeGreaterThan(0);
      } else {
        expect(inCount.get(n.id)).toBeGreaterThan(0);
        expect(outCount.get(n.id)).toBeGreaterThan(0);
      }
    }

    // No orphan nodes
    const connected = new Set<string>();
    for (const e of edges) {
      connected.add(e.source);
      connected.add(e.target);
    }
    for (const n of nodes) {
      expect(connected.has(n.id)).toBe(true);
    }
  });

  it('uses EXPLAIN plan but still collapses duplicate anonymous scans', () => {
    const explain = `
┌─────────────────────────────┐
│     UNGROUPED_AGGREGATE     │
│   Aggregates: sum(#0)       │
└─────────────┬───────────────┘
┌─────────────┴───────────────┐
│         PROJECTION          │
│      Expressions: amount    │
└─────────────┬───────────────┘
┌─────────────┴───────────────┐
│    SEQ_SCAN on order_items  │
│         EC: 2000            │
└─────────────────────────────┘
`;
    const sql = 'SELECT ROUND(SUM(amount), 2) AS revenue FROM order_items;';
    const { nodes, edges } = buildRealExecutionWorkflow({
      sql,
      planText: explain,
      tabTitle: '总营业额',
    });

    const sources = nodes.filter((n) => n.data.type === 'source');
    expect(sources.length).toBe(1);
    expect(nodes.filter((n) => n.data.type === 'aggregate').length).toBe(1);
    expect(edges.length).toBeGreaterThanOrEqual(nodes.length - 1);
  });
});
