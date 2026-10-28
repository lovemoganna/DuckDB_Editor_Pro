import { describe, expect, it } from 'vitest';
import { computeDiagnostics } from '../../components/ExecutionPlan/model/diagnostics';
import { ExecutionNode } from '../../components/ExecutionPlan/model/types';

describe('Diagnostic Engine', () => {
  const createBaseNode = (overrides?: Partial<ExecutionNode>): ExecutionNode => ({
    id: 'test_node',
    name: 'TEST_OP',
    operatorType: 'TEST_OP',
    category: 'other',
    isUnknownOperator: false,
    chineseName: '测试算子',
    summary: '测试',
    metrics: {},
    extraInfo: {},
    diagnostics: [],
    childrenIds: [],
    parentIds: [],
    ...overrides,
  });

  it('detects high scan ratio when scanned rows >> actual rows', () => {
    const node = createBaseNode({
      category: 'scan',
      metrics: {
        rowsScanned: 10000,
        actualRows: 10,
      },
    });

    const diags = computeDiagnostics(node, [], 0.1);
    const scanDiag = diags.find(d => d.type === 'high_scan_ratio');
    expect(scanDiag).toBeDefined();
    expect(scanDiag?.severity).toBe('warning');
    expect(scanDiag?.source).toBe('editor_pro_derived');
    expect(scanDiag?.phenomenon).toContain('10,000');
    expect(scanDiag?.phenomenon).toContain('10');
  });

  it('detects cardinality mismatch when estimated != actual by > 5x', () => {
    const node = createBaseNode({
      metrics: {
        estimatedRows: 20,
        actualRows: 200,
      },
    });

    const diags = computeDiagnostics(node, [], 0.1);
    const cardDiag = diags.find(d => d.type === 'cardinality_mismatch');
    expect(cardDiag).toBeDefined();
    expect(cardDiag?.source).toBe('editor_pro_derived');
    expect(cardDiag?.phenomenon).toContain('200');
    expect(cardDiag?.phenomenon).toContain('20');
  });

  it('detects data explosion when join output exceeds input row sum', () => {
    const child1 = createBaseNode({ id: 'c1', metrics: { actualRows: 50 } });
    const child2 = createBaseNode({ id: 'c2', metrics: { actualRows: 50 } });

    const joinNode = createBaseNode({
      category: 'join',
      metrics: {
        actualRows: 500, // 500 > (50 + 50) * 1.5
      },
    });

    const diags = computeDiagnostics(joinNode, [child1, child2], 0.1);
    const explosionDiag = diags.find(d => d.type === 'data_explosion');
    expect(explosionDiag).toBeDefined();
    expect(explosionDiag?.severity).toBe('warning');
    expect(explosionDiag?.source).toBe('editor_pro_derived');
    expect(explosionDiag?.phenomenon).toContain('放大约 5.0 倍');
  });

  it('detects timing hotspot when node timing >= 35% of total', () => {
    const node = createBaseNode({
      metrics: {
        timingSeconds: 0.045, // 45ms out of 100ms = 45%
      },
    });

    const diags = computeDiagnostics(node, [], 0.1); // total = 0.1s
    const hotspotDiag = diags.find(d => d.type === 'timing_hotspot');
    expect(hotspotDiag).toBeDefined();
    expect(hotspotDiag?.severity).toBe('critical');
    expect(hotspotDiag?.source).toBe('editor_pro_derived');
    expect(hotspotDiag?.phenomenon).toContain('45.0%');
  });
});
