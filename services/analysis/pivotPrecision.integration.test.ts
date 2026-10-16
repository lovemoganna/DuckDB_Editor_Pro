import {spawnSync} from 'node:child_process';
import {expect,it} from 'vitest';
import {compiledPivotSql,defaultPivot} from './pivotExperience';
import {computePivotTable} from './chartDisplay';
// The repository's native DuckDB integration dependency; no database file or user data is opened.
function execute(sql:string):Record<string,unknown>[] {
  const result=spawnSync('duckdb',['-bail','-json'],{input:sql,encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr || result.error?.message || 'DuckDB CLI unavailable');
  return JSON.parse(result.stdout);
}
const source={id:'native:precision',name:'Native precision',catalog:'memory',schema:'main',kind:'query' as const,version:1,
  sql:"SELECT 'R' AS region, CAST(9007199254740993 AS DECIMAL(38,0)) AS amount",fields:[{name:'region',type:'VARCHAR'},{name:'amount',type:'DECIMAL(38,0)'}]};
it('keeps large DECIMAL sums exact through real SQL and the matrix',()=>{
  const d={...defaultPivot(source),metrics:[{column:'amount',agg:'sum' as const,alias:'金额'}],sortMetric:'金额'};
  const rows=execute(compiledPivotSql(d));expect(rows[0]['金额']).toBe('9007199254740993');
  const pivot=computePivotTable(rows,'region','','金额');expect(String(pivot.grandTotal)).toBe('9007199254740993');
});
it('sorts native numbers before textual result transport',()=>{
  const d={...defaultPivot({...source,sql:"SELECT * FROM (VALUES ('A',2),('B',10),('C',100)) v(region,amount)"}),metrics:[{column:'amount',agg:'sum' as const,alias:'金额'}],sortMetric:'金额'};
  expect(execute(compiledPivotSql(d)).map(row=>row.region)).toEqual(['C','B','A']);
});
it('retains tiny decimals and does not manufacture a zero for an all-null maximum',()=>{
  const tiny={...source,sql:"SELECT 'R' region, CAST('0.000000000000000000000000000001' AS DECIMAL(38,30)) amount",fields:[source.fields[0],{name:'amount',type:'DECIMAL(38,30)'}]};
  const d={...defaultPivot(tiny),metrics:[{column:'amount',agg:'sum' as const,alias:'金额'}],sortMetric:'金额'};
  expect(execute(compiledPivotSql(d))[0]['金额']).toBe('0.000000000000000000000000000001');
  const nullable={...d,source:{...tiny,sql:"SELECT 'R' region, CAST(NULL AS DECIMAL(38,30)) amount"},metrics:[{column:'amount',agg:'max' as const,alias:'金额'}]};
  const rows=execute(compiledPivotSql(nullable));expect(computePivotTable(rows,'region','','金额').grandTotal).toBeNull();
});
