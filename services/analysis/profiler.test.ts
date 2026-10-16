import { beforeEach, expect, it, vi } from 'vitest';
const readQuery = vi.hoisted(() => vi.fn());
vi.mock('../duckdbService', () => ({ duckDBService: { readQuery, getCurrentCatalogAndSchema: async () => ({catalog:'test',schema:'main'}) } }));
import { fetchTableOverview, fetchColumnProfiles } from './profiler';
const schema = [{ name: 'id', type: 'BIGINT', pk: false }] as any;
beforeEach(() => readQuery.mockReset());
it('does not rate a table by missing primary keys or invent its size', async () => {
  readQuery.mockResolvedValueOnce([{total_rows:120}]).mockResolvedValueOnce([{id_nulls:0}]);
  const result = await fetchTableOverview('records', schema);
  expect(result.completenessRate).toBe(100);
  expect(Number.isNaN(result.healthScore)).toBe(true);
  expect(Number.isNaN(result.estimatedMemoryKb)).toBe(true);
});
it('does not turn a failed null audit into complete data', async () => {
  readQuery.mockResolvedValueOnce([{total_rows:120}]).mockRejectedValueOnce(new Error('query failed'));
  expect(Number.isNaN((await fetchTableOverview('records', schema)).completenessRate)).toBe(true);
});
it('reports a failed field profile instead of fabricated missing values', async () => {
  readQuery.mockResolvedValueOnce([{total_rows:120}]).mockRejectedValueOnce(new Error('query failed'));
  await expect(fetchColumnProfiles('records', schema)).rejects.toThrow('字段 id 检查失败');
});
