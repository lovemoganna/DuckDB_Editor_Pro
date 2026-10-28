import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('./databaseAnalysis',()=>({refreshDatabaseAnalysis:vi.fn()}));
vi.mock('./analysisObjects',()=>({listAnalysisObjects:vi.fn()}));
vi.mock('./homeDashboardService',()=>({getOrCreateHomeDashboard:vi.fn(),addObjectToDashboard:vi.fn()}));
vi.mock('./dbService',()=>({dbService:{getDomainSetting:vi.fn(),saveDomainSetting:vi.fn()}}));
vi.mock('./metricAssetStorage',()=>({activeAnalysisDatabase:()=> 'db'}));
import { selectInitialHomeObjects, ensureDynamicHome } from './dynamicHome';
import { refreshDatabaseAnalysis } from './databaseAnalysis';
import { getOrCreateHomeDashboard, addObjectToDashboard } from './homeDashboardService';
import { dbService } from './dbService';
import type { AnalysisObject } from './analysisObjects';
import { listAnalysisObjects } from './analysisObjects';
describe('initial home selection',()=>{
  beforeEach(() => vi.clearAllMocks());
  it('keeps first discovery as suggestions instead of writing a board', async () => {
    vi.clearAllMocks();
    const board = { id:'new',items:[] };
    vi.mocked(refreshDatabaseAnalysis).mockResolvedValue({tables:[{tableName:'real',rowCount:10}]} as never);
    vi.mocked(getOrCreateHomeDashboard).mockResolvedValue(board as never);
    vi.mocked(dbService.getDomainSetting).mockResolvedValue(null);
    vi.mocked(listAnalysisObjects).mockResolvedValue([{id:'saved-analysis',kind:'metric',name:'用户指标',sql:'SELECT 1'}]);
    const result = await ensureDynamicHome();
    expect(result.board).toBe(board);
    expect(result.widgetsAdded).toBe(0);
    expect(addObjectToDashboard).not.toHaveBeenCalled();
  });
  it('shows relevant distribution and trend rather than one count per table',()=>{
    const make=(table:string,key:string,type:string):AnalysisObject=>({id:`discovered:db:main:${table}:${key}`,kind:'metric',name:key,sql:'SELECT 1',chartConfig:{id:key,title:key,type:type as never,xKey:'',yKeys:[]}});
    const objects=[...Array.from({length:20},(_,i)=>make(`table${i}`,'count','counter')),make('table0','category:region','bar'),make('table0','trend:date','line')];
    expect(selectInitialHomeObjects(objects,['table0']).map(o=>o.chartConfig?.type)).toEqual(['bar','line']);
  });
  it('does not promote a record count or arbitrary SUM to a business KPI',()=>{
    const objects = ['count','sum:amount'].map(key=>({ id:`discovered:db:main:table0:${key}`,kind:'metric' as const,name:key,sql:'SELECT 1' }));
    expect(selectInitialHomeObjects(objects,['table0'])).toEqual([]);
  });
  it('does not populate a view the user already cleared',async()=>{
    vi.mocked(refreshDatabaseAnalysis).mockResolvedValue({tables:[{tableName:'real',rowCount:10}]} as never);
    vi.mocked(getOrCreateHomeDashboard).mockResolvedValue({items:[],id:'view'} as never);
    vi.mocked(dbService.getDomainSetting).mockResolvedValue(true);
    await ensureDynamicHome(); expect(addObjectToDashboard).not.toHaveBeenCalled();
  });
});
