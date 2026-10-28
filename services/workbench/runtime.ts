import { useSyncExternalStore } from 'react';
import { duckDBService } from '../duckdbService';
import { resolveAnalysisObject } from '../analysisObjects';
import { enrichSavedQueryLineage, applyBoardParams } from '../homeDashboardService';
import { requireAnalysisQuery } from '../analysis/readQueryGuard';
import { compileAnalysis, relationReferences, datasetForRelation, analysisSqlForEditor } from './queryCompiler';
import type { SavedQuery } from '../../types';
import type { AnalysisFilter, DatasetDefinition, DashboardContext, WidgetSettings } from './analysisTypes';
import {validateUniqueKeys} from './datasetGuards';
import { requireCurrent, type QueryLifecycle } from './queryLifecycle';

let revision = 0;
const listeners = new Set<() => void>();
type Execution = {rows:Record<string,unknown>[];total:number;at:number;fieldTypes:Record<string,string>};
type Entry = {promise:Promise<Execution>;pending:boolean;refresh:number;consumers:Set<QueryLifecycle>;queueWaitMs:number;completion?:Promise<void>};
const cache = new Map<string, Entry>();
export function invalidateWorkbench() { revision++; cache.clear(); listeners.forEach(listener=>listener()); }
if (typeof window !== 'undefined') {
  ['duckdb-schema-changed','duckdb-database-changed','duckdb-datasets-changed','duckdb-saved-queries-updated','duckdb-analysis-objects-updated','duckdb-metrics-updated','duckdb-metric-charts-updated'].forEach(event=>window.addEventListener(event,invalidateWorkbench));
}
export function useWorkbenchRevision() { return useSyncExternalStore(callback=>{listeners.add(callback);return()=>listeners.delete(callback);},()=>revision,()=>0); }

export async function executeWidget(input: {
  query: SavedQuery; settings?: WidgetSettings; datasets: DatasetDefinition[];
  context?: DashboardContext; brush?: {column:string;value:string;values?:string[];range?:{from:number;to:number;includeTo:boolean};temporalRange?:{from:string;to:string};bindings?:Record<string,string>} | null;
  refresh: number; params: Record<string,string>; page?: number; force?: boolean;
  lifecycle?: QueryLifecycle;
}) {
  requireCurrent(input.lifecycle);
  const sourceCatalog = input.settings?.sourceCatalog || input.query.databaseName || 'memory';
  // Cross-catalog references must be explicit, immutable query definitions; never switch USE.
  let query = enrichSavedQueryLineage(await resolveAnalysisObject(input.query));
  requireCurrent(input.lifecycle);
  const settings = input.settings || {};
  if (settings.chartConfig) query = {...query,charts:[settings.chartConfig],widgetType:settings.chartConfig.type==='counter'?'value':settings.chartConfig.type==='table'?'table':'chart'};
  if (settings.title) query = {...query,name:settings.title};
  const filters: AnalysisFilter[] = settings.linked === false ? [] : [...(input.context?.filters || [])];
  const sourceSpec = settings.querySpec || query.querySpec;
  const scopeDataset = input.datasets.find(d=>d.id===(settings.datasetId || sourceSpec?.datasetId || query.datasetId));
  const querySchema = scopeDataset?.schema || query.referencedSchemas?.[0] || 'main';
  if (input.brush && settings.linked !== false) {
    const brush = input.brush;
    const bindings = brush.bindings || {};
    if (Object.keys(bindings).length) {
      filters.push({id:'brush',field:brush.column,operator:brush.values ? 'in' : brush.range||brush.temporalRange?'gte':'eq',value:brush.temporalRange?.from || (brush.range?String(brush.range.from):brush.value),values:brush.values,bindings});
      if (brush.range) filters.push({id:'brush-end',field:brush.column,operator:brush.range.includeTo?'lte':'lt',value:String(brush.range.to),bindings});
      if (brush.temporalRange) filters.push({id:'brush-end',field:brush.column,operator:'lt',value:brush.temporalRange.to,bindings});
    }
  }
  const spec=sourceSpec ? {...sourceSpec,datasetId:settings.datasetId || sourceSpec.datasetId} : undefined;
  const compiled = compileAnalysis({sql:applyBoardParams(query.sql,input.params),catalog:sourceCatalog,schema:querySchema,datasets:input.datasets,
    spec,globalFilters:filters,localFilters:settings.filters});
  const statement = requireAnalysisQuery(compiled.sql);
  // The aggregation itself runs over all source rows. Only output detail is paged.
  const page = Math.max(0,input.page || 0), limit=100;
  const versions=compiled.datasetIds.map(id=>{const d=input.datasets.find(source=>source.id===id);return [id,d?.version,d?.uniqueKeys];});
  const key = JSON.stringify([sourceCatalog,querySchema,statement,compiled.params,page,versions,revision]);
  let entry=cache.get(key);
  // Refresh invalidates completed results, but never duplicates an execution already in flight.
  if(entry && !entry.pending && (input.force || entry.refresh !== input.refresh)) {cache.delete(key);entry=undefined;}
  const consumer = input.lifecycle || {};
  if (!entry) {
    const created:Entry={promise:undefined!,pending:true,refresh:input.refresh,consumers:new Set([consumer]),queueWaitMs:0};
    const lifecycle:QueryLifecycle={isCurrent:()=>[...created.consumers].some(c=>!c.isCurrent || c.isCurrent()),
      onQueueStart:waitMs=>{created.queueWaitMs=waitMs;created.consumers.forEach(c=>c.onQueueStart?.(waitMs));},
      onExecutionScheduled:completion=>{created.completion=completion;created.consumers.forEach(c=>c.onExecutionScheduled?.(completion));}};
    created.promise=Promise.resolve().then(async()=>{
      requireCurrent(lifecycle);
      if(scopeDataset?.uniqueKeys)await validateUniqueKeys(scopeDataset.uniqueKeys);
      requireCurrent(lifecycle);
      const [fields,totals,rows]=await duckDBService.readQueryBatchWithParams([
        {sql:`DESCRIBE ${statement}`,params:compiled.params},
        {sql:`SELECT COUNT(*) AS count FROM (\n${statement}\n) AS result`,params:compiled.params},
        {sql:`SELECT * FROM (\n${statement}\n) AS result LIMIT ${limit} OFFSET ${page*limit}`,params:compiled.params},
      ],lifecycle);
      return {rows,total:Number(totals[0]?.count || 0),at:Date.now(),fieldTypes:Object.fromEntries(fields.map(f=>[String(f.column_name),String(f.column_type)]))};
    });
    entry=created;
    cache.set(key,created);
    if(cache.size>128) cache.delete(cache.keys().next().value!);
    void created.promise.then(()=>{created.pending=false;},()=>{if(cache.get(key)===created)cache.delete(key);});
  } else {
    entry.consumers.add(consumer);
    if(entry.completion)consumer.onExecutionScheduled?.(entry.completion);
    if(entry.queueWaitMs)consumer.onQueueStart?.(entry.queueWaitMs);
  }
  let result:Execution;
  try {result=await entry.promise;requireCurrent(input.lifecycle);} finally {entry.consumers.delete(consumer);}
  if(result.total>limit&&query.charts?.[0]?.type!=='table')compiled.notices.push('图表显示当前页结果；完整聚合已计算，请分页或缩小维度范围');
  return {...result,query:enrichSavedQueryLineage({...query,querySpec:spec,sql:analysisSqlForEditor(compiled),referencedTables:[],referencedSchemas:[]}),notices:compiled.notices,datasetIds:compiled.datasetIds,pageSize:limit};
}

export function brushBindings(query: SavedQuery, datasets: DatasetDefinition[], field: string, context?: DashboardContext) {
  let sourceField=field;
  if(!query.querySpec) {
    const match = query.sql.match(new RegExp(`(?:SELECT|,)\\s*(?:"?[\\w]+"?\\.)?"?([\\w]+)"?\\s+AS\\s+"?${field.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"?\\b`,'i'));
    if(match) sourceField=match[1];
  }
  const ids=query.querySpec?[query.querySpec.datasetId]:relationReferences(query.sql).map(ref=>datasetForRelation(ref.parts,datasets,query.databaseName || 'memory','main')?.id);
  const bindings=Object.fromEntries(datasets.filter(d=>ids.includes(d.id)&&d.fields.some(f=>f.name===sourceField)).map(d=>[d.id,sourceField]));
  for(const filter of context?.filters||[]) {
    if(Object.entries(bindings).some(([id,name])=>filter.bindings[id]===name))Object.assign(bindings,filter.bindings);
  }
  return bindings;
}

export function temporalBrush(query:SavedQuery,field:string,value:string) {
  const grain=query.querySpec?.timeGrain;
  if(!grain || query.querySpec?.dimensions[0]!==field)return undefined;
  const from=new Date(value.replace(' ','T')+'Z');
  if(!Number.isFinite(from.getTime()))return undefined;
  const to=new Date(from);
  if(grain==='month')to.setUTCMonth(to.getUTCMonth()+1);
  else if(grain==='year')to.setUTCFullYear(to.getUTCFullYear()+1);
  else to.setUTCDate(to.getUTCDate()+(grain==='week'?7:1));
  // Wall-clock TIMESTAMP is intentionally preserved; no browser timezone conversion.
  return {from:from.toISOString().slice(0,19).replace('T',' '),to:to.toISOString().slice(0,19).replace('T',' ')};
}
