import { beforeEach,describe,it,expect,vi } from 'vitest';
const state=vi.hoisted(()=>({database:'crud_lab',schema:'main',metric:{id:'m',name:'current metric',sqlValidation:'SELECT amount FROM fiat_transactions',formula:'',version:2}}));
const records = vi.hoisted(() => ({ value: [] as any[] }));
vi.mock('../../services/dbService',()=>({dbService:{getDomainSetting:async()=>records.value}}));
vi.mock('../../services/duckdbService',()=>({duckDBService:{
  getCurrentCatalogAndSchema:async()=>({catalog:state.database,schema:state.schema}),
  getTables:async()=>['fiat_transactions'],
  switchAnalysisContext:async(target:{kind:string,id:string})=>{ if(target.kind==='database'){state.database=target.id;state.schema='main';}else state.schema=target.id;return{catalog:state.database,schema:state.schema};},
}}));
vi.mock('../../services/metricAssetStorage',()=>({activeAnalysisDatabase:()=>state.database}));
vi.mock('./useDataViewStore',()=>({useDataViewStore:{getState:()=>({pagination:{limit:50},setSortConfig:vi.fn(),setFilterQuery:vi.fn(),setDataViewMode:vi.fn(),setHiddenColumns:vi.fn(),fetchTableData:vi.fn(),fetchProfileData:vi.fn()})}}));
vi.mock('../../services/visualizationAssets',()=>({loadVisualizationAssets:async()=>[]}));
vi.mock('../../services/metricAnalyzer',()=>({metricAnalyzer:{loadMetricPackages:()=>[{id:'p',sourceTables:['crypto_transactions'],metrics:[state.metric]}],validateMetric:async()=>({isValid:true,sql:state.metric.sqlValidation})}}));
import { resolveAnalysisContext,openAnalysis,navigateToAnalysisSource,useAnalysisWorkspace } from './useAnalysisWorkspace';
import { useAppStore } from './useAppStore';
import { Tab } from '../../types';
describe('shared analytical provenance',()=>{
  beforeEach(()=>{state.database='crud_lab';state.schema='main';records.value=[];useAnalysisWorkspace.getState().setContext(null);});
  it('reloads a saved analysis by identity and rejects deletion instead of using a stale SQL snapshot',async()=>{
    records.value=[{id:'a',databaseName:'crud_lab',title:'最新保存分析',sql:'SELECT amount FROM fiat_transactions',sourceTables:[],savedAt:1,note:''}];
    const context={analysisId:'a',databaseName:'crud_lab',title:'旧标题',sql:'SELECT 999',sourceTables:[]};
    expect((await resolveAnalysisContext(context)).sql).toBe(records.value[0].sql);
    records.value=[];
    await expect(resolveAnalysisContext(context)).rejects.toThrow('关联分析已删除');
  });
  it('opens the physical catalog and schema before selecting a same-named source table',async()=>{
    state.database='other';state.schema='archive';
    await navigateToAnalysisSource('crud_lab.lab_baseline.fiat_transactions');
    expect(state.database).toBe('crud_lab');expect(state.schema).toBe('lab_baseline');
    expect(useAppStore.getState().currentTable).toBe('fiat_transactions');
    expect(useAppStore.getState().activeTab).toBe(Tab.DATA);
  });
  it('rejects a removed source rather than navigating to a wrong table',async()=>{
    await expect(navigateToAnalysisSource('crud_lab.main.removed')).rejects.toThrow('已不存在');
  });
  it('opens the actual source and analysis destination together',()=>{
    openAnalysis({databaseName:'crud_lab',title:'Metric',metricId:'m',sourceTables:['crud_lab.main.fiat_transactions']});
    expect(useAppStore.getState().currentTable).toBe('fiat_transactions');
    expect(useAppStore.getState().activeTab).toBe(Tab.ANALYSIS_HUB);
    expect(useAnalysisWorkspace.getState().context?.metricId).toBe('m');
  });
  it('resolves a changed metric definition instead of a copied historical SQL or package first table',async()=>{
    const result=await resolveAnalysisContext({databaseName:'crud_lab',title:'Old',metricId:'m',sql:'SELECT * FROM crypto_transactions',sourceTables:['crypto_transactions']});
    expect(result.sql).toBe(state.metric.sqlValidation);expect(result.sourceTables).toEqual(['fiat_transactions']);
  });
  it('rejects a stale catalog or deleted definition',async()=>{
    state.database='other';await expect(resolveAnalysisContext({databaseName:'crud_lab',title:'Old',metricId:'m',sourceTables:[]})).rejects.toThrow('数据库已切换');
    state.database='crud_lab';await expect(resolveAnalysisContext({databaseName:'crud_lab',title:'Old',metricId:'deleted',sourceTables:[]})).rejects.toThrow('已删除');
  });
  it('rejects same-catalog schema drift',async()=>{
    await expect(resolveAnalysisContext({databaseName:'crud_lab',schemaName:'lab_baseline',title:'Old',sql:'SELECT * FROM fiat_transactions',sourceTables:[]})).rejects.toThrow('Schema');
  });
  it('does not use a removed chart snapshot as live analysis',async()=>{
    await expect(resolveAnalysisContext({databaseName:'crud_lab',title:'Old',chartId:'deleted',sql:'SELECT 1',sourceTables:[]})).rejects.toThrow('关联图表已删除');
  });
});
