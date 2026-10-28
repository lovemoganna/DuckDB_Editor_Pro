import { afterEach, expect, it } from 'vitest';
import { useDataInspection } from './useDataInspection';
afterEach(() => useDataInspection.getState().invalidate());
it('keeps table evidence scoped by database and schema', () => {
  const base = {catalog:'first',schema:'main',table:'records',checkedAt:1,status:'issues' as const,rules:[],constraints:[]};
  useDataInspection.getState().record(base);
  useDataInspection.getState().record({...base,catalog:'second',status:'passed'});
  expect(Object.values(useDataInspection.getState().reports).map(report=>report.status)).toEqual(['issues','passed']);
});
it('invalidates evidence on data/schema change instead of keeping a stale pass', () => {
  useDataInspection.getState().record({catalog:'first',schema:'main',table:'records',checkedAt:1,status:'passed',rules:[],constraints:[]});
  window.dispatchEvent(new Event('duckdb-schema-changed'));
  expect(useDataInspection.getState().reports).toEqual({});
});
