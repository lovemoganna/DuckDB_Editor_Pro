/**
 * DataFlow 连线协议回归测试
 * 硬约束：上游 sourceHandle=output（右中）→ 下游 targetHandle=input|left|right（左中）
 */

import { describe, it, expect } from 'vitest';
import { Position, getSmoothStepPath } from 'reactflow';
import { parseSqlToWorkflow } from '../../../services/dataflow/sqlToWorkflowParser';
import { getInitialEcommerceEdges } from '../../../services/dataflow/seedEcommerceWorkflow';

describe('DataFlow edge connection protocol (right-mid → left-mid)', () => {
  it('every ecommerce seed edge uses output → input|left|right handles', () => {
    const edges = getInitialEcommerceEdges();
    expect(edges.length).toBeGreaterThan(0);

    for (const edge of edges) {
      expect(edge.sourceHandle).toBe('output');
      expect(['input', 'left', 'right']).toContain(edge.targetHandle);
      expect(edge.type).toBe('dataFlowEdge');
    }
  });

  it('join edges carry joinSide while still anchoring to left/right mid handles', () => {
    const edges = getInitialEcommerceEdges();
    const joinLeft = edges.find(e => e.id === 'edge-sql-join');
    const joinRight = edges.find(e => e.id === 'edge-cust-join');

    expect(joinLeft?.targetHandle).toBe('left');
    expect(joinLeft?.data?.joinSide).toBe('left');
    expect(joinRight?.targetHandle).toBe('right');
    expect(joinRight?.data?.joinSide).toBe('right');
  });

  it('SQL parser emits output → left/right/input with joinSide for JOIN queries', () => {
    const sql = `
      SELECT a.*, b.name
      FROM orders a
      INNER JOIN customers b ON a.customer_id = b.customer_id
      WHERE a.status = 'completed'
    `;
    const { edges } = parseSqlToWorkflow(sql, { tabTitle: 'join_test' });

    expect(edges.length).toBeGreaterThanOrEqual(2);
    for (const edge of edges) {
      expect(edge.sourceHandle).toBe('output');
      expect(['input', 'left', 'right']).toContain(edge.targetHandle);
    }

    const joinEdges = edges.filter(e => e.data?.relationType === 'join');
    expect(joinEdges.length).toBe(2);
    expect(joinEdges.map(e => e.data?.joinSide).sort()).toEqual(['left', 'right']);
  });

  it('smooth-step path with Right→Left positions starts at source and ends at target midpoints', () => {
    // 模拟两节点：源右中 (208, 26) → 目标左中 (280, 26)
    const sourceX = 208;
    const sourceY = 26;
    const targetX = 280;
    const targetY = 26;

    const [path] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition: Position.Right,
      targetX,
      targetY,
      targetPosition: Position.Left,
      borderRadius: 12,
      offset: 16,
    });

    // React Flow 使用空格分隔坐标：M208 26L...L280 26
    expect(path.startsWith(`M${sourceX} ${sourceY}`)).toBe(true);
    expect(path.endsWith(`L${targetX} ${targetY}`) || path.includes(`L${targetX} ${targetY}`)).toBe(true);
    expect(sourceY).toBe(targetY);
  });

  it('CTE pipeline edges always leave via output and enter via left-side handles', () => {
    const sql = `
      WITH filtered AS (
        SELECT * FROM sales WHERE status = 'ok'
      ),
      summed AS (
        SELECT country, SUM(amount) AS total FROM filtered GROUP BY country
      )
      SELECT * FROM summed
    `;
    const { nodes, edges } = parseSqlToWorkflow(sql, { tabTitle: 'cte_flow' });

    expect(nodes.length).toBeGreaterThanOrEqual(3);
    expect(edges.length).toBeGreaterThanOrEqual(2);

    for (const edge of edges) {
      expect(edge.sourceHandle).toBe('output');
      expect(['input', 'left', 'right']).toContain(edge.targetHandle);
    }
  });
});
