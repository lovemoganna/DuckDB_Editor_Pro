import {beforeEach,describe,it,expect,vi} from 'vitest';
const {read}=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('../duckdbService',()=>({duckDBService:{readQueryWithParams:read,
 readQueryBatchWithParams:async(statements:{sql:string;params:unknown[]}[],lifecycle?:{isCurrent?:()=>boolean})=>{
  if(lifecycle?.isCurrent && !lifecycle.isCurrent())throw new DOMException('stale','AbortError');
  const results=[];for(const statement of statements)results.push(await read(statement.sql,statement.params));return results;
 }}}));
vi.mock('../analysisObjects',()=>({resolveAnalysisObject:async(q:unknown)=>q}));
vi.mock('../homeDashboardService',()=>({enrichSavedQueryLineage:(q:unknown)=>q,applyBoardParams:(sql:string)=>sql}));
import {executeWidget,invalidateWorkbench,brushBindings,temporalBrush} from './runtime';
import type {DatasetDefinition,DashboardContext} from './analysisTypes';
import type {SavedQuery} from '../../types';
const dataset:DatasetDefinition={id:'d',name:'orders',catalog:'sales',schema:'main',table:'orders',sql:'SELECT * FROM sales.main.orders',fields:[{name:'region',type:'VARCHAR'},{name:'amount',type:'DECIMAL(18,2)'},{name:'created_at',type:'TIMESTAMP'}],kind:'table',version:1};
const query:SavedQuery={id:'q',name:'original',sql:'SELECT SUM(amount) FROM orders',databaseName:'sales',createdAt:1,datasetId:'d',querySpec:{datasetId:'d',dimensions:['region'],measure:'amount',aggregation:'SUM'}};
const context:DashboardContext={refreshSeconds:0,filters:[{id:'r',field:'region',operator:'eq',value:'A',bindings:{d:'region',other:'area'}}]};
const input={query,datasets:[dataset],context,refresh:0,params:{}};
beforeEach(()=>{
 invalidateWorkbench();read.mockReset();read.mockImplementation(async(sql:string)=>sql.startsWith('DESCRIBE')?[{column_name:'region',column_type:'VARCHAR'},{column_name:'value',column_type:'DECIMAL(18,2)'}]:sql.includes('COUNT(*) AS count')?[{count:201}]:[{region:'A',value:12}]);
});
describe('shared analysis runtime',()=>{
 it('applies field edits only to the current placement and keeps the source definition intact',async()=>{
  const edited=await executeWidget({...input,settings:{querySpec:{datasetId:'d',dimensions:[],aggregation:'COUNT'}}});
  expect(edited.query.sql).toContain('COUNT(*) AS value');expect(edited.query.querySpec?.aggregation).toBe('COUNT');
  expect(query.querySpec?.aggregation).toBe('SUM');
  const original=await executeWidget(input);expect(original.query.sql).toContain('SUM("amount")');
 });
 it('merges matching requests, binds conditions and paginates output rather than source rows',async()=>{
  const [a,b]=await Promise.all([executeWidget(input),executeWidget(input)]);expect(read).toHaveBeenCalledTimes(3);expect(a.rows).toEqual(b.rows);expect(a.total).toBe(201);
  expect(read.mock.calls[0][1]).toEqual(['A']);expect(read.mock.calls[2][0]).toContain('LIMIT 100 OFFSET 0');expect(a.query.sql).not.toContain('LIMIT');expect(a.notices).toContain('图表显示当前页结果；完整聚合已计算，请分页或缩小维度范围');
 });
 it('keeps independent instance filters and chart presentation out of original definitions',async()=>{
  const a=await executeWidget({...input,settings:{title:'instance',linked:false,filters:[{id:'b',field:'region',operator:'eq',value:'B',bindings:{d:'region'}}]}});
  expect(a.query.name).toBe('instance');expect(query.name).toBe('original');expect(read.mock.calls[0][1]).toEqual(['B']);
  await executeWidget(input);expect(read).toHaveBeenCalledTimes(6);
 });
 it('recomputes after invalidation and manual refresh, evicts failed requests',async()=>{
  await executeWidget(input);await executeWidget({...input,force:true});expect(read).toHaveBeenCalledTimes(6);
  invalidateWorkbench();read.mockRejectedValueOnce(new Error('source unavailable'));await expect(executeWidget(input)).rejects.toThrow('source unavailable');await executeWidget(input);expect(read).toHaveBeenCalledTimes(10);
 });
 it('maintains explicit source bindings and mapped cross-dataset brushing',()=>{
  expect(brushBindings(query,[dataset],'region',context)).toEqual({d:'region',other:'area'});
  expect(brushBindings(query,[dataset],'missing',context)).toEqual({});
  expect(temporalBrush({...query,querySpec:{datasetId:'d',dimensions:['created_at'],aggregation:'COUNT',timeGrain:'month'}},'created_at','2025-02-01')).toEqual({from:'2025-02-01 00:00:00',to:'2025-03-01 00:00:00'});
 });
 it('invalidates definition versions and rejects a JOIN key that became nonunique',async()=>{
  await executeWidget(input);
  read.mockResolvedValueOnce([{id:1}]);
  await expect(executeWidget({...input,datasets:[{...dataset,version:2,uniqueKeys:[{sql:'SELECT id FROM people.main.customers',key:'id'}]}]})).rejects.toThrow('右侧关联键不唯一');
  expect(read.mock.calls[3][0]).toContain('HAVING COUNT(*) > 1');
 });
 it('shares a forced refresh with in-flight work and evicts that work if it fails',async()=>{
  let rejectOld!: (error:Error)=>void;
  read.mockImplementationOnce(()=>new Promise((_resolve,reject)=>{rejectOld=reject;}));
  const old=executeWidget(input);
  const assertion=expect(old).rejects.toThrow('old request');
  await vi.waitFor(()=>expect(read).toHaveBeenCalledTimes(1));
  const forced=executeWidget({...input,force:true});
  const forcedAssertion=expect(forced).rejects.toThrow('old request');
  await Promise.resolve();expect(read).toHaveBeenCalledTimes(1);
  rejectOld(new Error('old request'));await Promise.all([assertion,forcedAssertion]);
  await executeWidget(input);expect(read).toHaveBeenCalledTimes(4);
 });
 it('does not reuse unqualified SQL between catalogs or schemas',async()=>{
  const raw={...query,querySpec:undefined,datasetId:undefined,sql:'SELECT 1 AS value',referencedSchemas:['main']};
  await executeWidget({...input,query:raw,datasets:[]});
  await executeWidget({...input,query:{...raw,databaseName:'other'},datasets:[]});
  await executeWidget({...input,query:{...raw,referencedSchemas:['other_schema']},datasets:[]});
  expect(read).toHaveBeenCalledTimes(9);
 });
 it('keeps a shared query alive for a current subscriber when another becomes stale',async()=>{
  let current=true;let release!:(value:any)=>void;
  read.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  const a=executeWidget({...input,lifecycle:{isCurrent:()=>current}});
  const rejected=expect(a).rejects.toMatchObject({name:'AbortError'});
  await vi.waitFor(()=>expect(read).toHaveBeenCalledTimes(1));
  const b=executeWidget(input);await Promise.resolve();await Promise.resolve();
  current=false;release([{column_name:'value',column_type:'INTEGER'}]);
  await b;await rejected;expect(read).toHaveBeenCalledTimes(3);
 });
});
