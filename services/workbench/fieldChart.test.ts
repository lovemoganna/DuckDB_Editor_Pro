import {describe, it, expect} from 'vitest';
import {fieldChartQuery} from './fieldChart';
import type {DatasetDefinition} from './analysisTypes';
const dataset: DatasetDefinition = {id:'fiat',name:'fiat_transactions',catalog:'live',schema:'main',kind:'table',version:1,
  sql:'SELECT * FROM live.main.fiat_transactions',fields:[{name:'amount',type:'DECIMAL(20,2)'},{name:'currency',type:'VARCHAR'},{name:'status',type:'VARCHAR'},{name:'created_at',type:'TIMESTAMP'}]};
const draft = {name:'Transactions',dimension:'',series:'',measure:'',aggregation:'COUNT' as const,type:'counter' as const};
describe('dataset field chart definition',()=>{
  it('uses the existing structured compiler for a record card',()=>{
    const query=fieldChartQuery(dataset,[dataset],draft);
    expect(query.sql).toContain('COUNT(*) AS value');expect(query.widgetType).toBe('value');expect(query.querySpec?.dimensions).toEqual([]);
  });
  it('separates currency units before aggregation and preserves chart series',()=>{
    const query=fieldChartQuery(dataset,[dataset],{...draft,dimension:'status',measure:'amount',aggregation:'SUM',type:'bar'});
    expect(query.querySpec?.dimensions).toEqual(['status','currency']);expect(query.charts?.[0].groupBy).toBe('currency');
    expect(query.sql).toContain('SUM("amount")');expect(query.sql).toContain('GROUP BY');
  });
  it('rejects missing measures, stale fields and unsupported dimensional encodings',()=>{
    expect(()=>fieldChartQuery(dataset,[dataset],{...draft,aggregation:'SUM'})).toThrow('数值');
    expect(()=>fieldChartQuery(dataset,[dataset],{...draft,dimension:'missing'})).toThrow();
    expect(()=>fieldChartQuery(dataset,[dataset],{...draft,dimension:'status',series:'created_at',measure:'amount',aggregation:'SUM'})).toThrow('两个');
    expect(()=>fieldChartQuery(dataset,[dataset],{...draft,type:'line'})).toThrow('维度');
  });
  it('uses date bucketing and forces detail to the shared table renderer',()=>{
    expect(fieldChartQuery(dataset,[dataset],{...draft,dimension:'created_at',timeGrain:'month',type:'line'}).sql).toContain("date_trunc('month'");
    expect(fieldChartQuery(dataset,[dataset],{...draft,aggregation:'DETAIL',type:'bar'}).charts?.[0].type).toBe('table');
  });
});
