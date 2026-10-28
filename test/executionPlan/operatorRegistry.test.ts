import { describe, expect, it } from 'vitest';
import {
  lookupOperator,
  normalizeOperatorName,
  OPERATOR_REGISTRY,
  getCategoryTheme,
} from '../../components/ExecutionPlan/model/operatorRegistry';

describe('Operator Registry', () => {
  it('normalizes operator names correctly', () => {
    expect(normalizeOperatorName('hash_group_by')).toBe('HASH_GROUP_BY');
    expect(normalizeOperatorName('SEQ_SCAN ')).toBe('SEQ_SCAN');
    expect(normalizeOperatorName('  TOP_N  ')).toBe('TOP_N');
  });

  it('accurately resolves well-known DuckDB operators', () => {
    const hashJoin = lookupOperator('HASH_JOIN');
    expect(hashJoin.isUnknown).toBe(false);
    expect(hashJoin.entry.category).toBe('join');
    expect(hashJoin.entry.chineseName).toBe('哈希关联');

    const seqScan = lookupOperator('SEQ_SCAN');
    expect(seqScan.isUnknown).toBe(false);
    expect(seqScan.entry.category).toBe('scan');
    expect(seqScan.entry.chineseName).toBe('顺序表扫描');

    const groupBy = lookupOperator('HASH_GROUP_BY');
    expect(groupBy.isUnknown).toBe(false);
    expect(groupBy.entry.category).toBe('aggregate');
    expect(groupBy.entry.chineseName).toBe('哈希分组聚合');

    const filter = lookupOperator('FILTER');
    expect(filter.isUnknown).toBe(false);
    expect(filter.entry.category).toBe('filter');
  });

  it('gracefully handles unknown operators without failing or throwing', () => {
    const unknown1 = lookupOperator('FUTURE_QUANTUM_SCAN');
    expect(unknown1.isUnknown).toBe(true);
    expect(unknown1.entry.name).toBe('FUTURE_QUANTUM_SCAN');
    expect(unknown1.entry.category).toBe('scan'); // inferred from SCAN keyword
    expect(unknown1.entry.summary).toContain('DuckDB 物理算子');

    const unknown2 = lookupOperator('SOME_COMPLETELY_NEW_OPCODE');
    expect(unknown2.isUnknown).toBe(true);
    expect(unknown2.entry.name).toBe('SOME_COMPLETELY_NEW_OPCODE');
    expect(unknown2.entry.category).toBe('other');
  });

  it('provides category visual theme tokens', () => {
    const scanTheme = getCategoryTheme('scan');
    expect(scanTheme.lineColor).toBe('#38bdf8');

    const joinTheme = getCategoryTheme('join');
    expect(joinTheme.lineColor).toBe('#fbbf24');

    const aggTheme = getCategoryTheme('aggregate');
    expect(aggTheme.lineColor).toBe('#c084fc');
  });
});
