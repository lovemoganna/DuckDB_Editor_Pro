import { beforeEach, describe, expect, it } from 'vitest';
import { clearDeductionHistory, deleteDeductionHistory, loadDeductionHistory, saveDeductionHistory } from './deductionHistoryStorage';
import type { DeductionHistoryRecord } from './deductionTypes';

const makeRecord = (index: number): DeductionHistoryRecord => ({
  id: `run-${index}`,
  createdAt: `2026-08-13T00:00:${String(index).padStart(2, '0')}.000Z`,
  request: { input: `输入 ${index}`, externalMappingRequested: false, sources: [] },
  result: {
    version: 1,
    input: `输入 ${index}`,
    features: [], relations: [], contexts: [],
    structure: { id: 'root', type: 'context', label: '空', children: [] },
    coreMeaning: { text: '空', supportingFeatureIds: [], supportingRelationIds: [] },
    punchline: { text: '空', supportingFeatureIds: [], supportingRelationIds: [] },
    validation: { status: 'valid', issues: [] },
  },
});

describe('deductionHistoryStorage public seam', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the newest 20 successful runs', () => {
    for (let index = 0; index < 23; index += 1) saveDeductionHistory(makeRecord(index));
    const records = loadDeductionHistory();
    expect(records).toHaveLength(20);
    expect(records[0].id).toBe('run-22');
    expect(records.at(-1)?.id).toBe('run-3');
  });

  it('deletes one record and clears all records', () => {
    saveDeductionHistory(makeRecord(1));
    saveDeductionHistory(makeRecord(2));
    deleteDeductionHistory('run-2');
    expect(loadDeductionHistory().map(record => record.id)).toEqual(['run-1']);
    clearDeductionHistory();
    expect(loadDeductionHistory()).toEqual([]);
  });

  it('ignores malformed or unsupported stored data', () => {
    localStorage.setItem('duckdb-manager.deduction-history', '{broken');
    expect(loadDeductionHistory()).toEqual([]);
    localStorage.setItem('duckdb-manager.deduction-history', JSON.stringify({ version: 99, records: [makeRecord(1)] }));
    expect(loadDeductionHistory()).toEqual([]);
    const broken = makeRecord(2) as unknown as { result: { version: number; features: null } };
    broken.result.features = null;
    localStorage.setItem('duckdb-manager.deduction-history', JSON.stringify({ version: 1, records: [broken] }));
    expect(loadDeductionHistory()).toEqual([]);
    const brokenElement = makeRecord(3) as unknown as { result: { features: null[] } };
    brokenElement.result.features = [null];
    localStorage.setItem('duckdb-manager.deduction-history', JSON.stringify({ version: 1, records: [brokenElement] }));
    expect(loadDeductionHistory()).toEqual([]);

    const brokenSource = makeRecord(4) as unknown as { request: { sources: null[] } };
    brokenSource.request.sources = [null];
    localStorage.setItem('duckdb-manager.deduction-history', JSON.stringify({ version: 1, records: [brokenSource] }));
    expect(loadDeductionHistory()).toEqual([]);
  });
});
