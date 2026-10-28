import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { readSheet } from 'read-excel-file/node';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const transport=vi.hoisted(()=>({readQuery:vi.fn()}));
vi.mock('../duckdbService',()=>({duckDBService:{readQuery:transport.readQuery,getRuntimeInfo:()=>({currentDatabase:'funds',databaseContextRevision:0})}}));
import { buildSliceQuery, executeSqlSlice, discoverSliceTables, suggestSliceIdentity, validateSliceIdentity, listSliceValues, applySliceFilters, type ProjectionMapping, type SliceTable } from './sqlGraphProjection';
const folder=mkdtempSync(join(tmpdir(),'ontology-slice-'));
const db=join(folder,'funds.duckdb');
const original='C:/Users/luoyu/AppData/Roaming/.emacs.d/org-roam/pages/sql/exchange_funds_flow_dataset.xlsx';
const workbook=process.env.SQL_SLICE_WORKBOOK || (existsSync(original) ? original : resolve('data/crud-lab/source/google-sheet.xlsx'));
const source:Record<string,Record<string,unknown>[]>={};
let tables:SliceTable[]=[];
const literal=(v:unknown):string=>v==null?'NULL':typeof v==='number'?String(v):`'${String(v instanceof Date?v.toISOString():v).replace(/'/g,"''")}'`;
const q=(v:string)=>`"${v.replace(/"/g,'""')}"`;
function native(sql:string,readonly=true) {
  const result=execFileSync('duckdb',[db,...(readonly?['-readonly']:[]),'-bail','-json'],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
  return result?JSON.parse(result):[];
}
beforeAll(async()=>{
  for(const name of ['users','fiat_transactions','crypto_transactions','exchange_rates']) {
    const [header,...rows]=await readSheet(workbook,name);
    source[name]=rows.map(row=>Object.fromEntries(header.map((field,index)=>[String(field),row[index]])));
    const types=header.map((_,index)=>rows.some(row=>typeof row[index]==='number')?'DOUBLE':'VARCHAR');
    native(`CREATE TABLE ${q(name)} (${header.map((field,index)=>`${q(String(field))} ${types[index]}`).join(',')}); INSERT INTO ${q(name)} VALUES ${rows.map(row=>`(${header.map((_,index)=>literal(row[index])).join(',')})`).join(',')};`,false);
  }
  transport.readQuery.mockImplementation(async(sql:string)=>native(sql));
  tables=await discoverSliceTables();
});
afterAll(()=>rmSync(folder,{recursive:true,force:true}));
describe('SQL → local ontology using the actual four-sheet funds workbook',()=>{
  it('discovers all actual sheets and columns without creating a business model from static data',()=>{
    expect(tables.map(t=>t.name).sort()).toEqual(Object.keys(source).sort());
    expect(Object.values(source).map(rows=>rows.length)).toEqual([10,25,25,8]);
  });
  for(const [name,pk,unitField,unit] of [['fiat_transactions','fiat_order_id','currency','USD'],['crypto_transactions','crypto_order_id','asset','USDT']]) {
    it(`guides ${name} with verified identity and visual filters against real rows`,async()=>{
      const from=tables.find(t=>t.name===name)!, users=tables.find(t=>t.name==='users')!;
      expect(await suggestSliceIdentity(from)).toBe(pk);
      expect(await suggestSliceIdentity(users)).toBe('uid');
      expect(await listSliceValues(from,'status')).toEqual([...new Set(source[name].map(row=>String(row.status)))].sort());
      await validateSliceIdentity(from,pk);
      await expect(validateSliceIdentity(from,'uid')).rejects.toThrow('重复或空值');
      const query=buildSliceQuery(from,pk,users,'uid','uid');
      const sql=applySliceFilters(query.sql,from,[{field:'status',operator:'eq',value:'completed'},{field:unitField,operator:'eq',value:unit}]);
      const result=await executeSqlSlice(sql,query.mapping);
      const expected=source[name].filter(row=>row.status==='completed'&&row[unitField]===unit);
      expect(result.rows).toHaveLength(expected.length);expect(result.graph.links).toHaveLength(expected.length);
      expect((await executeSqlSlice(applySliceFilters(query.sql,from,[{field:'status',operator:'eq',value:"completed' OR true --"}]),query.mapping)).rows).toHaveLength(0);
    });
    it(`projects only ${name} matching the business question, with exact user relationships`,async()=>{
      const from=tables.find(t=>t.name===name)!,users=tables.find(t=>t.name==='users')!;
      const query=buildSliceQuery(from,pk,users,'uid','uid');
      expect((await executeSqlSlice(query.sql,query.mapping)).rows).toHaveLength(source[name].length);
      const result=await executeSqlSlice(`${query.sql}\nWHERE s.status='completed' AND s.${q(unitField)}='${unit}'`,query.mapping);
      const expected=source[name].filter(row=>row.status==='completed'&&row[unitField]===unit);
      expect(result.rows).toHaveLength(expected.length);
      expect(result.graph.links).toHaveLength(expected.length);
      expect(result.graph.nodes.filter(n=>n._typeName===name).map(n=>n._trace.key[pk]).sort()).toEqual(expected.map(row=>String(row[pk])).sort());
      const expectedUsers=[...new Set(expected.map(row=>String(row.uid)))].sort();
      expect(result.graph.nodes.filter(n=>n._typeName==='users').map(n=>n._trace.key.uid).sort()).toEqual(expectedUsers);
      for(const link of result.graph.links) {
        const row=result.rows[link._rowIndices[0]];
        // The workbook stores user uid as text and transaction uid as numeric; DuckDB joins their values.
        expect(String(row.s_uid)).toBe(String(row.t_uid));
      }
      const empty=await executeSqlSlice(`${query.sql}\nWHERE false`,query.mapping);
      expect(empty.graph.nodes).toEqual([]);expect(empty.graph.links).toEqual([]);
      await expect(executeSqlSlice(`${query.sql}\nWHERE no_such_field=1`,query.mapping)).rejects.toThrow();
    });
  }
  it('preserves the rate date and explicit asset join without treating a benchmark as a transaction-date rate',async()=>{
    const mapping:ProjectionMapping={nodes:[{type:'Fiat',table:'funds.main.fiat_transactions',key:{fiat_order_id:'order_id'}},{type:'Rate',table:'funds.main.exchange_rates',key:{asset:'asset',effective_date:'effective_date'},properties:{rate_to_usdt:'rate',source:'rate_source'}}],edges:[{type:'benchmarkForAsset',source:'Fiat',target:'Rate'}]};
    const result=await executeSqlSlice(`SELECT f.fiat_order_id AS order_id,r.asset,r.effective_date,r.rate_to_usdt AS rate,r.source AS rate_source FROM fiat_transactions f JOIN exchange_rates r ON f.currency=r.asset WHERE f.currency='EUR' AND f.status='completed'`,mapping);
    const expected=source.fiat_transactions.filter(row=>row.currency==='EUR'&&row.status==='completed');
    expect(result.graph.links).toHaveLength(expected.length);
    expect(result.graph.nodes.filter(n=>n._typeName==='Rate')).toHaveLength(1);
    const rate=source.exchange_rates.find(row=>row.asset==='EUR')!;
    expect(result.graph.nodes.find(n=>n._typeName==='Rate')!._trace.properties.rate_to_usdt).toBe(rate.rate_to_usdt);
  });
  it('preserves a shared query dataset and its filters through identity checks, joins and projection',async()=>{
    const table=tables.find(t=>t.name==='fiat_transactions')!;
    const dataset={...table,sourceSql:`SELECT * FROM "funds"."main"."fiat_transactions" WHERE status='completed' AND currency='USD'`,provenance:'funds.main.fiat_transactions'};
    const users=tables.find(t=>t.name==='users')!;
    expect(await suggestSliceIdentity(dataset)).toBe('fiat_order_id');
    const query=buildSliceQuery(dataset,'fiat_order_id',users,'uid','uid');
    const result=await executeSqlSlice(query.sql,query.mapping);
    expect(result.rows).toHaveLength(9);expect(result.graph.nodes).toHaveLength(13);expect(result.graph.links).toHaveLength(9);
    const node=result.graph.nodes.find(n=>n._typeName==='fiat_transactions')!;
    expect(node._trace.table).toBe('funds.main.fiat_transactions');expect(node._trace.sql).toBe(dataset.sourceSql);
    const empty={...dataset,sourceSql:dataset.sourceSql+' AND false'};
    expect(await suggestSliceIdentity(empty)).toBe('fiat_order_id');
    const emptyQuery=buildSliceQuery(empty,'fiat_order_id',users,'uid','uid');
    expect((await executeSqlSlice(emptyQuery.sql,emptyQuery.mapping)).graph.nodes).toEqual([]);
  });
});
