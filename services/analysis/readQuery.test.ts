import { describe, expect, it, vi } from 'vitest';
vi.mock('../duckdbService', () => ({ duckDBService: { query: vi.fn(), getRuntimeInfo: vi.fn() } }));
import { requireAnalysisQuery, executeAnalysisQuery } from './readQuery';
import { duckDBService } from '../duckdbService';
describe('analysis read queries', () => {
  it('stops before executing a query if its database changed during EXPLAIN', async () => {
    vi.mocked(duckDBService.getRuntimeInfo).mockReturnValueOnce({currentDatabase: 'first'} as any).mockReturnValueOnce({currentDatabase: 'second'} as any);
    vi.mocked(duckDBService.query).mockResolvedValue([]);
    await expect(executeAnalysisQuery('SELECT * FROM sales')).rejects.toThrow('数据库已切换');
    expect(duckDBService.query).toHaveBeenCalledTimes(1);
    expect(duckDBService.query).toHaveBeenCalledWith('EXPLAIN SELECT * FROM sales');
  });
  it('preserves quoted semicolons and comments in a single CTE', () => {
    expect(requireAnalysisQuery("-- revenue\nWITH x AS (SELECT ';' AS label) SELECT * FROM x; -- tail")).toContain('WITH x');
  });
  it('removes trailing comment-only statements before embedding a saved query', () => {
    expect(requireAnalysisQuery('SELECT COUNT(*) AS metric_value FROM sales; -- optional GROUP BY region'))
      .toBe('SELECT COUNT(*) AS metric_value FROM sales');
  });
  it.each(['SELECT 1; DELETE FROM sales', 'DELETE FROM sales', 'WITH x AS (SELECT 1) INSERT INTO sales SELECT * FROM x'])('rejects an automatic mutation or script: %s', sql => {
    expect(() => requireAnalysisQuery(sql)).toThrow();
  });
});
