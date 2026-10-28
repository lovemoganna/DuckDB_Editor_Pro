import { describe, expect, it, vi } from 'vitest';
import { proposeDatabaseMetrics } from './databaseAnalysis';
import { ensureExecutiveMetrics } from './executiveMetrics';
import type { AnalyticalCatalog } from '../types/analyticalCatalog';
vi.mock('./duckdbService', () => ({duckDBService:{getCurrentCatalogAndSchema:async()=>({catalog:'isolated',schema:'main'}),readQuery:async()=>[]}}));

describe('unconfirmed semantics safely degrade', () => {
  it('keeps counts, direction distribution and created_at trends as diagnostic drafts with real bindings', () => {
    const model={tables:[{tableName:'payments',rowCount:25,fields:[],measures:[],categoryDimensions:[{columnName:'direction',distinctCount:2}],timeDimensions:[{columnName:'created_at',physicalType:'TIMESTAMP',min:'2026-01-01',max:'2026-03-01'}]}]} as unknown as AnalyticalCatalog;
    const candidates=proposeDatabaseMetrics(model,'isolated','main');
    expect(candidates).toHaveLength(3);
    for(const candidate of candidates) expect(candidate).toMatchObject({sourceTable:'isolated.main.payments',unit:'行',governance:{role:'diagnostic',reviewStatus:'draft'}});
    expect(candidates.map(candidate=>candidate.dependencies)).toEqual([[],['direction'],['created_at']]);
  });
  it('does not create business definitions from matching table names', async () => {
    expect(await ensureExecutiveMetrics()).toBeNull();
  });
  it('does not sum unknown numeric values or force a date trend without a real range', () => {
    const field = {columnName:'amount',physicalType:'DOUBLE'};
    const model = {tables:[{tableName:'unknown',rowCount:1,fields:[field],measures:[field],categoryDimensions:[],timeDimensions:[{columnName:'date',physicalType:'DATE',min:'2026-10-08',max:'2026-10-08'}]}]} as unknown as AnalyticalCatalog;
    expect(proposeDatabaseMetrics(model,'isolated','main').map(metric=>metric.presentation?.type)).toEqual(['counter']);
    model.tables[0].rowCount = Number.NaN;
    expect(proposeDatabaseMetrics(model,'isolated','main')).toEqual([]);
  });
});
