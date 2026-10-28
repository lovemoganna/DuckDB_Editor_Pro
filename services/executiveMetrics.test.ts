import { describe,it,expect,vi } from 'vitest';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
vi.mock('./metricAnalyzer',()=>({ metricAnalyzer: {} }));
vi.mock('./duckdbService',()=>({ duckDBService: {} }));
import { executiveMetricPackage } from './executiveMetrics';
import { aggSql } from './analysis/calcCompiler';
const baseline = resolve('data/crud-lab/baseline.duckdb');
const native = spawnSync('duckdb',['--version'],{encoding:'utf8'});
describe.skipIf(!existsSync(baseline) || native.status !== 0)('real Google Sheet baseline business definitions',()=>{
  const pkg = executiveMetricPackage('baseline');
  function query(key:string) {
    const sql=pkg.metrics.find(m=>m.id.endsWith(':'+key))!.sqlValidation!;
    const result=spawnSync('duckdb',[baseline,'-readonly','-bail','-json'],{input:sql,encoding:'utf8'});
    expect(result.status,result.stderr).toBe(0);return JSON.parse(result.stdout);
  }
  it('uses the completed-only source benchmark without mixing USD and USDT',()=>{
    expect(query('usd-gmv')[0].value).toBe(104270);
    expect(query('usdt-gmv')[0].value).toBe(13000);
    expect(query('success')[0]).toEqual({value:86,completed:43,total:50});
    expect(query('usd-net')[0].value).toBe(47730);
    expect(query('liquidity').find((r:any)=>r.unit==='USDT').net).toBe(3000);
    expect(query('liquidity').find((r:any)=>r.unit==='BTC').net).toBeCloseTo(.061,8);
  });
  it('executes every reference query and retains risks and historical rates',()=>{
    for(const metric of pkg.metrics) query(metric.id.split(':').pop()!);
    expect(query('exceptions')).toHaveLength(7);
    expect(query('quality').some((row:any)=>row.issue==='非完成订单带完成时间')).toBe(true);
    expect(query('rates').every((row:any)=>row.effective_date==='2024-09-01')).toBe(true);
    expect(query('monthly').every((row:any)=>row.unit && row.family && /^\d{4}-\d{2}$/.test(row.month))).toBe(true);
    const trend=query('usd-monthly');
    expect(trend.reduce((sum:number,row:any)=>sum+row.net,0)).toBe(47730);
    expect(trend.find((row:any)=>row.month==='2025-05')).toMatchObject({deposits:0,withdrawals:0,net:0});
  });
  it('retains sub-cent crypto quantities in shared SUM and AVG analysis',()=>{
    const sql=`SELECT ${aggSql('sum','amount')} AS total, ${aggSql('avg','amount')} AS average FROM (VALUES (0.001::DECIMAL(18,8)),(0.002::DECIMAL(18,8))) AS amounts(amount);`;
    const result=spawnSync('duckdb',[baseline,'-readonly','-bail','-json'],{input:sql,encoding:'utf8'});
    expect(result.status,result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)[0]).toEqual({total:0.003,average:0.0015});
  });
});
