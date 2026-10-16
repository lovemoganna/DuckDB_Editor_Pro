import { describe, it, expect, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
vi.mock('../duckdbService', () => ({ duckDBService: { getTableSchema: vi.fn(), readQuery: vi.fn() } }));
import { duckDBService } from '../duckdbService';
import { executeRecipe } from './recipes';
const baseline = resolve('data/crud-lab/baseline.duckdb');
const native = spawnSync('duckdb', ['--version'], {encoding:'utf8'});
describe.skipIf(!existsSync(baseline) || native.status !== 0)('unit-scoped recipes on real source data', () => {
  function installNativeQueries() {
    vi.mocked(duckDBService.getTableSchema).mockResolvedValue([{name:'asset',type:'VARCHAR'}, {name:'amount',type:'DECIMAL(18,8)'}] as any);
    vi.mocked(duckDBService.readQuery).mockImplementation(async sql => {
      const result = spawnSync('duckdb', [baseline,'-readonly','-bail','-json'], {input:sql,encoding:'utf8'});
      expect(result.status,result.stderr).toBe(0);
      return result.stdout.trim() ? JSON.parse(result.stdout) : [];
    });
  }
  it('keeps actual IQR bounds even when BTC has no outliers', async () => {
    installNativeQueries();
    const result = await executeRecipe('iqr','baseline.main.crypto_transactions',{numCol:'amount',selectedUnit:'BTC'});
    expect(result.rows).toHaveLength(0);
    expect(result.extraStats?.q3).toBeGreaterThan(0);
    expect(result.extraStats?.upperBound).toBeGreaterThan(.05);
    expect(result.extraStats?.cleanSql).not.toContain('<= 0;');
  });
  it('bins all four BTC records without an unsupported SQL function or zeroed labels', async () => {
    installNativeQueries();
    const result = await executeRecipe('histogram','baseline.main.crypto_transactions',{numCol:'amount',selectedUnit:'BTC',bucketCount:8});
    expect(result.rows.reduce((n,row)=>n+Number(row.样本频次),0)).toBe(4);
    expect(result.sql).not.toContain('WIDTH_BUCKET');
    expect(result.rows.some(row=>String(row.区间范围).includes('0.001'))).toBe(true);
  });
});
