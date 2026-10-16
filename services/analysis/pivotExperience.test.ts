import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({catalog:'memory',schema:'main',records:[] as any[],fields:[] as any[]}));
vi.mock('../duckdbService',()=>({duckDBService:{getCurrentCatalogAndSchema:async()=>({catalog:state.catalog,schema:state.schema}),readQuery:async()=>state.fields}}));
vi.mock('../dbService',()=>({dbService:{getDomainSetting:async()=>state.records,saveDomainSetting:async(_key:string,records:any[])=>{state.records=structuredClone(records);}}}));
vi.mock('../workbench/datasetGuards',()=>({validateUniqueKeys:async()=>{}}));
import {compiledPivotSql,defaultPivot,loadPivotRecord,pivotDetailSql,pivotToSpec,savePivotRecord,validatePivotSource} from './pivotExperience';
import {computePivotTable} from './chartDisplay';
import {validateMeasurementUnits} from './unitGuard';
const source={id:'query:orders',name:'Filtered orders',catalog:'memory',schema:'main',kind:'query' as const,version:1,
  sql:"SELECT * FROM orders WHERE status = 'completed'",fields:[{name:'id',type:'INTEGER'},{name:'region',type:'VARCHAR'},{name:'created',type:'DATE'},{name:'amount',type:'DOUBLE'},{name:'customer',type:'VARCHAR'}]};
beforeEach(()=>{state.catalog='memory';state.schema='main';state.records=[];state.fields=source.fields.map(f=>({column_name:f.name,column_type:f.type}));});
describe('pivot data and editable definition contract',()=>{
  it('retains both simultaneous saves and rejects stale edits',async()=>{
    const a=defaultPivot(source), b={...a,title:'B'};
    const [first]=await Promise.all([savePivotRecord(a,compiledPivotSql(a),undefined),savePivotRecord(b,compiledPivotSql(b),undefined)]);
    expect(state.records).toHaveLength(2);
    await savePivotRecord(b,compiledPivotSql(b),undefined,first.id,first.savedAt);
    await expect(savePivotRecord(a,compiledPivotSql(a),undefined,first.id,first.savedAt)).rejects.toThrow('其他位置更新');
  });
  it('defaults to records instead of summing identifiers or unknown numeric fields',()=>{
    expect(defaultPivot(source).row.column).toBe('region');
    expect(defaultPivot(source).metrics).toEqual([{agg:'count',alias:'记录数'}]);
    expect(defaultPivot({...source,fields:[source.fields[0],source.fields[3]]}).metrics[0].agg).toBe('count');
  });
  it('preserves executed source SQL and computes margins from source records for every metric',()=>{
    const definition={...defaultPivot(source),row:{column:'region'},column:{column:'created',dateTrunc:'month' as const},
      metrics:[{column:'amount',agg:'avg' as const,alias:'平均金额'},{column:'customer',agg:'count_distinct' as const,alias:'客户数'}]};
    const sql=compiledPivotSql(definition);
    expect(sql).toContain(source.sql);
    expect(sql).toContain('pivot_row_totals AS (SELECT');
    expect(sql).toContain('pivot_col_totals AS (SELECT');
    expect(sql).toContain('pivot_all_totals AS (SELECT COALESCE(AVG(');
    expect(sql).toContain('COUNT(DISTINCT "customer")');
    expect(sql).toContain('IS NOT DISTINCT FROM');
    expect(sql).toContain('"__pivot_all_客户数"');
    expect(sql).toContain('LIMIT 50');
    expect(sql).not.toContain('SUM("平均金额")');
  });
  it('uses source-computed weighted average and distinct totals, including typed null identity',()=>{
    const rows=[{region:null,month:'Jan',avg:10,__pivot_row_avg:20,__pivot_col_avg:25,__pivot_all_avg:30,__pivot_count:8},
      {region:'—',month:'Jan',avg:40,__pivot_row_avg:40,__pivot_col_avg:25,__pivot_all_avg:30,__pivot_count:8}];
    const pivot=computePivotTable(rows,'region','month','avg');
    expect(pivot.rowValues).toHaveLength(2);
    expect(pivot.rowLabels?.['null']).toBe('（空值）');
    expect(pivot.rowTotals['null']).toBe(20);
    expect(pivot.grandTotal).toBe(30);
    expect(pivot.grandCount).toBe(8);
    expect(pivot.totalsScope).toBe('source');
  });
  it('drills using inherited query, additional filters, both dimensions, exact month and bounded paging',()=>{
    const definition={...defaultPivot(source),row:{column:'region'},column:{column:'created',dateTrunc:'month' as const},filters:[{column:'amount',op:'>' as const,value:'100'}]};
    const sql=pivotDetailSql(pivotToSpec(definition),"O'North",'2026-10-01',2);
    expect(sql).toContain(source.sql);
    expect(sql).toContain('"amount" > 100');
    expect(sql).toContain("CAST(\"region\" AS VARCHAR) = 'O''North'");
    expect(sql).toContain("CAST(DATE_TRUNC('month', \"created\") AS VARCHAR) = '2026-10-01'");
    expect(sql).toContain('LIMIT 51 OFFSET 100');
    expect(pivotDetailSql(pivotToSpec(definition),null,null,0)).toContain('"region" IS NULL');
  });
  it('rejects drift, invalid sources and fields without falling back to a similarly named table',async()=>{
    state.schema='archive';
    await expect(validatePivotSource(source)).rejects.toThrow('Schema');
    state.schema='main';
    expect(()=>pivotToSpec({...defaultPivot(source),source:{...source,sql:'DELETE FROM orders'}})).toThrow('只读');
    expect(()=>pivotToSpec({...defaultPivot(source),row:{column:'removed'}})).toThrow('已不存在');
    expect(()=>pivotToSpec({...defaultPivot(source),column:{column:'region'}})).toThrow('相同字段');
  });
  it('does not allow a mixed-asset grand total even if currency is a dimension',()=>{
    const monetarySource={...source,fields:[...source.fields,{name:'currency',type:'VARCHAR'}]};
    const definition={...defaultPivot(monetarySource),row:{column:'currency'},metrics:[{column:'amount',agg:'sum' as const,alias:'金额'}]};
    expect(()=>pivotToSpec(definition)).toThrow('计量资产');
    expect(()=>validateMeasurementUnits(pivotToSpec({...definition,unit:'CNY'}))).not.toThrow();
  });
  it('saves the whole definition, updates the same identity, and reloads the latest definition',async()=>{
    const definition={...defaultPivot(source),column:{column:'created',dateTrunc:'month' as const},unit:'',visibleMetric:0};
    const saved=await savePivotRecord(definition,compiledPivotSql(definition),undefined);
    expect(saved.pivot).toEqual(definition);
    const updated={...definition,title:'Revised',limit:25};
    const next=await savePivotRecord(updated,compiledPivotSql(updated),undefined,saved.id);
    expect(next.id).toBe(saved.id);expect(state.records).toHaveLength(1);
    expect((await loadPivotRecord(saved.id)).pivot).toEqual(updated);
  });
  it('rejects stale result/config pairs and deleted records; copy receives a new identity',async()=>{
    const definition=defaultPivot(source);
    await expect(savePivotRecord({...definition,limit:10},compiledPivotSql(definition),undefined)).rejects.toThrow('不一致');
    const saved=await savePivotRecord(definition,compiledPivotSql(definition),undefined);
    const copy=await savePivotRecord(definition,compiledPivotSql(definition),undefined);
    expect(copy.id).not.toBe(saved.id);
    state.records=[];
    await expect(savePivotRecord(definition,compiledPivotSql(definition),undefined,saved.id)).rejects.toThrow('已删除');
    await expect(loadPivotRecord(saved.id)).rejects.toThrow('已删除');
  });
  it('keeps historical SQL-only analysis readable without pretending its form can be reconstructed',async()=>{
    state.records=[{id:'legacy',sql:'SELECT 1',databaseName:'memory',title:'Old'}];
    await expect(loadPivotRecord('legacy')).rejects.toThrow('历史分析');
  });
  it('opens an existing definition with current fields so removed field bindings can be repaired in the editor',async()=>{
    const definition=defaultPivot(source);
    const saved=await savePivotRecord(definition,compiledPivotSql(definition),undefined);
    state.fields=state.fields.filter(field=>field.column_name!=='region');
    const reopened=await loadPivotRecord(saved.id);
    expect(reopened.pivot?.row.column).toBe('region');
    expect(()=>pivotToSpec(reopened.pivot!)).toThrow('已不存在');
    expect(()=>pivotToSpec({...reopened.pivot!,row:{column:'customer'}})).not.toThrow();
  });
});
