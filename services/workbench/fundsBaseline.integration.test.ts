import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readSheet } from 'read-excel-file/node';
import type { DatasetDefinition } from './analysisTypes';
import type { SavedQuery } from '../../types';

// Replace only the browser transport. SQL and parameters execute against the frozen real DuckDB file.
vi.mock('../duckdbService',()=>({duckDBService:{readQueryBatchWithParams:async(statements:any[])=>statements.map(s=>native(s.sql,s.params))}}));
vi.mock('../analysisObjects',()=>({resolveAnalysisObject:async(q:SavedQuery)=>q}));
vi.mock('../metricAnalyzer',()=>({metricAnalyzer:{}}));
import { executiveMetricPackage } from '../executiveMetrics';
import { executeWidget, invalidateWorkbench, brushBindings } from './runtime';
import { analysisSqlForEditor } from './queryCompiler';
import { widgetRowsToChartSpec } from '../analysis/adapters/dashboardWidgetAdapter';

const file=resolve('data/crud-lab/baseline.duckdb');
const expectedHash='a16db823884ef4c8a6056214c624eaf12fc12a454e31a93f2ab180b5948cc887';
function native(sql:string,params:(string|number|boolean|null)[]=[]):Record<string,any>[] {
  const statement=analysisSqlForEditor({sql,params,notices:[],datasetIds:[]});
  const result=spawnSync('duckdb',[file,'-readonly','-bail','-json'],{input:statement,encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr || result.error?.message || 'DuckDB executable unavailable');
  return result.stdout.trim()?JSON.parse(result.stdout):[];
}
const pkg=executiveMetricPackage('baseline');
let datasets:DatasetDefinition[]=[];
let source:Record<string,Record<string,any>[]>={};
function definition(key:string):SavedQuery {
  const metric=pkg.metrics.find(metric=>metric.id.endsWith(':'+key))!;
  return {id:metric.id,name:metric.name,sql:metric.sqlValidation!,databaseName:'baseline',createdAt:1,charts:[metric.presentation],widgetType:metric.presentation.type==='counter'?'value':metric.presentation.type==='table'?'table':'chart'};
}
const run=(key:string,extra:Partial<Parameters<typeof executeWidget>[0]>={})=>executeWidget({query:definition(key),datasets,refresh:0,params:{},...extra});
beforeAll(async()=>{
  expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(expectedHash);
  const xlsx=resolve('data/crud-lab/source/google-sheet.xlsx');
  const manifest=JSON.parse(readFileSync(resolve('data/crud-lab/manifest.json'),'utf8'));
  expect(createHash('sha256').update(readFileSync(xlsx)).digest('hex')).toBe(manifest.source_sha256);
  for(const table of ['users','fiat_transactions','crypto_transactions','exchange_rates']) {
    const [header,...rows]=await readSheet(xlsx,table);
    source[table]=rows.filter(row=>row.some(cell=>cell!==null)).map(row=>Object.fromEntries(header.map((field,index)=>[String(field),row[index]])));
  }
  datasets=['users','fiat_transactions','crypto_transactions','exchange_rates'].map(table=>({id:table,name:table,catalog:'baseline',schema:'main',table,kind:'table',version:1,sql:`SELECT * FROM "baseline"."main"."${table}"`,fields:native(`DESCRIBE "${table}"`).map(f=>({name:f.column_name,type:f.column_type}))}));
});
beforeEach(invalidateWorkbench);

it('independently reconciles business results with the frozen XLSX source rows',async()=>{
  // Independent of production SQL, compiler, runtime and stored dashboard values.
  expect(datasets.map(d=>native(`SELECT COUNT(*) AS n FROM "${d.table}"`)[0].n)).toEqual(datasets.map(d=>source[d.table!].length));
  const fiat=source.fiat_transactions,crypto=source.crypto_transactions;
  const usd=fiat.filter(row=>row.status==='completed'&&row.currency==='USD');
  const usdt=crypto.filter(row=>row.status==='completed'&&row.asset==='USDT');
  const sum=(rows:Record<string,any>[],net=false)=>rows.reduce((value,row)=>value+Number(row.amount)*(net&&row.direction==='withdrawal'?-1:1),0);
  expect((await run('usd-gmv')).rows).toEqual([{value:sum(usd)}]);
  expect((await run('usdt-gmv')).rows).toEqual([{value:sum(usdt)}]);
  expect((await run('usd-net')).rows).toEqual([{value:sum(usd,true)}]);
  const transactions=[...fiat,...crypto],completed=transactions.filter(row=>row.status==='completed').length;
  expect((await run('success')).rows).toEqual([{value:100*completed/transactions.length,completed,total:transactions.length}]);
  const channel={refreshSeconds:0,filters:[{id:'channel',field:'channel',operator:'eq' as const,value:'wire_transfer',bindings:{fiat_transactions:'channel'}}]};
  expect((await run('usd-gmv',{context:channel})).rows).toEqual([{value:sum(usd.filter(row=>row.channel==='wire_transfer'))}]);
  expect((await run('usd-net',{context:channel})).rows).toEqual([{value:sum(usd.filter(row=>row.channel==='wire_transfer'),true)}]);
  const monthly=(channelOnly=false)=>{
    const all=fiat.filter(row=>row.currency==='USD'&&(!channelOnly||row.channel==='wire_transfer'));
    const monthOf=(row:Record<string,any>)=>row.created_at instanceof Date ? row.created_at.toISOString().slice(0,7) : String(row.created_at).slice(0,7);
    const range=all.map(monthOf).sort();
    const index=(month:string)=>Number(month.slice(0,4))*12+Number(month.slice(5,7))-1;
    const rows=[];
    for(let cursor=index(range[0]);cursor<=index(range[range.length-1]);cursor++) {
      const month=`${Math.floor(cursor/12)}-${String(cursor%12+1).padStart(2,'0')}`;
      const completed=all.filter(row=>row.status==='completed'&&monthOf(row)===month);
      const deposits=sum(completed.filter(row=>row.direction==='deposit'));
      const withdrawals=sum(completed.filter(row=>row.direction==='withdrawal'));
      rows.push({month,deposits,withdrawals,net:deposits-withdrawals});
    }
    return rows;
  };
  expect((await run('usd-monthly')).rows).toEqual(monthly());
  expect((await run('usd-monthly',{context:channel})).rows).toEqual(monthly(true));
});

it('returns genuine empty results and missing-field errors without reusing cached source rows',async()=>{
  const query={...definition('usd-net'),sql:'SELECT currency,amount FROM fiat_transactions'};
  const populated=await executeWidget({query,datasets,refresh:0,params:{}});
  expect(populated.total).toBe(source.fiat_transactions.length);
  const context={refreshSeconds:0,filters:[{id:'empty',field:'currency',operator:'eq' as const,value:'__absent_currency__',bindings:{fiat_transactions:'currency'}}]};
  const empty=await executeWidget({query,datasets,context,refresh:0,params:{}});
  expect(empty.rows).toEqual([]);expect(empty.total).toBe(0);
  await expect(executeWidget({query:{...query,sql:'SELECT missing_amount FROM fiat_transactions'},datasets,refresh:0,params:{}})).rejects.toThrow(/missing_amount/);
  expect((await executeWidget({query,datasets,refresh:0,params:{}})).rows).toEqual(populated.rows);
});

it('locks the real source counts and separate-unit business results',async()=>{
  expect(datasets.map(d=>native(`SELECT COUNT(*) AS n FROM "${d.table}"`)[0].n)).toEqual([10,25,25,8]);
  expect((await run('usd-gmv')).rows).toEqual([{value:104270}]);
  expect((await run('usdt-gmv')).rows).toEqual([{value:13000}]);
  expect((await run('success')).rows).toEqual([{value:86,completed:43,total:50}]);
  expect((await run('usd-net')).rows).toEqual([{value:47730}]);
});
it('matches every widget output to its unmodified source SQL',async()=>{
  for(const metric of pkg.metrics) {
    const key=metric.id.split(':').pop()!;
    const output=await run(key);
    expect(output.rows,metric.name).toEqual(native(metric.sqlValidation!));
    expect(output.total,metric.name).toBe(output.rows.length);
    expect(output.notices,metric.name).toEqual([]);
  }
});
it('keeps monthly points and totals intact through chart adaptation',async()=>{
  const output=await run('usd-monthly');
  const spec=widgetRowsToChartSpec(output.rows,output.query.charts![0]);
  expect(output.total).toBe(10);
  expect(output.rows.reduce((sum,r)=>sum+Number(r.net),0)).toBe(47730);
  expect(output.rows.find(r=>r.month==='2025-05')).toEqual({month:'2025-05',deposits:0,withdrawals:0,net:0});
  expect(spec).toBeTruthy();
  expect(output.rows).toEqual(native(definition('usd-monthly').sql));
});
it('binds global and brush filters against the same real source',async()=>{
  const context={refreshSeconds:0,filters:[{id:'currency',field:'currency',operator:'eq' as const,value:'USD',bindings:{fiat_transactions:'currency'}},{id:'status',field:'status',operator:'eq' as const,value:'completed',bindings:{fiat_transactions:'status'}}]};
  const output=await run('usd-gmv',{context});
  expect(output.rows).toEqual([{value:104270}]);
  const q={...definition('usd-gmv'),sql:'SELECT * FROM "baseline"."main"."fiat_transactions"'};
  const bindings=brushBindings(q,datasets,'channel',context);
  const filtered=await executeWidget({query:q,datasets,context,brush:{column:'channel',value:'wire_transfer',bindings},refresh:0,params:{}});
  const sql=`SELECT * FROM fiat_transactions WHERE currency='USD' AND status='completed' AND channel='wire_transfer'`;
  expect(filtered.rows).toEqual(native(sql));
  expect(filtered.total).toBe(5);
});
it('repeats forced and cached refreshes without changing results or definitions',async()=>{
  const q=definition('usd-monthly'),snapshot=JSON.stringify(q);
  const expected=native(q.sql);
  for(let refresh=0;refresh<3;refresh++) {
    const output=await run('usd-monthly',{refresh,force:true});
    expect(output.rows).toEqual(expected);
    expect((await run('usd-monthly',{refresh})).rows).toEqual(expected);
  }
  expect(JSON.stringify(q)).toBe(snapshot);
});

it('applies the fixed channel filter to the monthly series without changing its SQL definition',async()=>{
  const query=definition('usd-monthly'),before=JSON.stringify(query);
  const context={refreshSeconds:0,filters:[{id:'channel',field:'channel',operator:'eq' as const,value:'wire_transfer',bindings:{fiat_transactions:'channel'}}]};
  const output=await run('usd-monthly',{context});
  const expectedSql=query.sql.replaceAll('"baseline"."main"."fiat_transactions"',"(SELECT * FROM fiat_transactions WHERE channel='wire_transfer')");
  expect(output.rows).toEqual(native(expectedSql));
  expect(output.rows.reduce((sum,row)=>sum+Number(row.net),0)).toBe(48000);
  expect(output.notices).toEqual([]);
  expect(JSON.stringify(query)).toBe(before);
});
