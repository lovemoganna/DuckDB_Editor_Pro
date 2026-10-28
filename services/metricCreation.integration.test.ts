import { beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const runtime=vi.hoisted(()=>({query:vi.fn(),schema:vi.fn()}));
vi.mock('./duckdbService',()=>({duckDBService:{getRuntimeInfo:()=>({currentDatabase:'baseline'}),query:runtime.query,getTableSchema:runtime.schema}}));
vi.mock('./homeDashboardService',()=>({syncLinkedChart:vi.fn(),pinChartToHome:vi.fn()}));
import { metricAnalyzer } from './metricAnalyzer';
import { metricSource } from './metricSql';

const baseline=resolve('data/crud-lab/baseline.duckdb');
function query(sql:string) {
  const output=execFileSync('duckdb',[baseline,'-readonly','-json','-c',sql],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  return /^EXPLAIN\b/i.test(sql) ? [] : output ? JSON.parse(output) : [];
}
beforeEach(()=>{
  localStorage.clear();vi.clearAllMocks();
  runtime.query.mockImplementation(async(sql:string)=>query(sql));
  runtime.schema.mockImplementation(async(table:string)=>query(`SELECT name,type FROM pragma_table_info('${table.replace(/'/g,"''")}')`));
});

describe('P0 metric creation on the readonly real baseline',()=>{
  it('retains a partial generated definition, computes its own table, saves and reuses its contract',async()=>{
    const [metric]=metricAnalyzer.validateMetrics([{name:'完成 USD 金额',sourceTable:'main.fiat_transactions',unit:'USD',
      calculation:{aggregation:'SUM',field:'amount',filter:"status='completed' AND currency='USD'",groupBy:['direction'],timeField:'created_at',grain:'month'},
      governance:{entity:'法币交易',sourceGrain:'每行一笔法币订单'}}]);
    const pkg=metricAnalyzer.createMetricPackage('P0 验收','',['users','main.fiat_transactions'],[metric]);
    const validation=await metricAnalyzer.validateMetric(metric,metricSource(metric,pkg.sourceTables));
    expect(validation.isValid,validation.error).toBe(true);
    expect(validation.sql).toContain('FROM "main"."fiat_transactions"');
    expect(validation.result!.reduce((total:number,row:any)=>total+Number(row.value),0)).toBe(104270);
    expect(validation.result!.every(row=>row.period!=null&&row.direction!=null)).toBe(true);
    metricAnalyzer.saveMetricPackage(pkg);
    const restored=metricAnalyzer.getMetricPackage(pkg.id)!.metrics[0];
    expect(restored.calculation).toEqual(metric.calculation);
    expect(restored.unit).toBe('USD');expect(restored.governance?.reviewStatus).toBe('draft');
    const first=await metricAnalyzer.generateChart(restored,pkg.id,metricSource(restored,pkg.sourceTables));
    const again=await metricAnalyzer.generateChart(restored,pkg.id,metricSource(restored,pkg.sourceTables));
    expect(again.id).toBe(first.id);expect(again.sql).toBe(validation.sql);
  });
  it('preserves full preaggregated JOIN SQL and refuses to guess a missing source from a multi-table package',async()=>{
    const formula=`WITH amounts AS (SELECT uid,SUM(amount) AS amount FROM fiat_transactions WHERE currency='USD' AND status='completed' GROUP BY uid) SELECT u.country_code,SUM(a.amount) AS value FROM amounts a JOIN users u USING(uid) GROUP BY u.country_code`;
    const [metric]=metricAnalyzer.validateMetrics([{name:'国别完成金额',formula,unit:'USD',dependencies:['amount','uid','country_code']}]);
    const validation=await metricAnalyzer.validateMetric(metric,metricSource(metric,['users','fiat_transactions']));
    expect(validation.isValid,validation.error).toBe(true);expect(validation.sql).toBe(formula);
    expect(validation.result!.reduce((total:number,row:any)=>total+Number(row.value),0)).toBe(104270);
    const unbound={...metric,formula:'SUM(amount)'};
    const failed=await metricAnalyzer.validateMetric(unbound,metricSource(unbound,['users','fiat_transactions']));
    expect(failed.isValid).toBe(false);expect(failed.error).toContain('未绑定来源表');
  });
});
