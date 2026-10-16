import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { widgetRowsToChartSpec } from './adapters/dashboardWidgetAdapter';
import { adaptChartSpec } from './adapters/chartJsAdapter';
import { compileAnalysisSql } from './sqlCompiler';
import { summarizeTableRows } from './chartDisplay';
import { createEmptySpec } from './types';
import { formatTableValue, formatValueBySpec } from '../../utils/chartFormat';
import { formatPieSliceLabelText } from '../../utils/chartStyleRules';
import type { ChartConfig } from '../../types';

const file=resolve('data/crud-lab/baseline.duckdb');
function sql(query:string):Record<string,any>[] {
  expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe('a16db823884ef4c8a6056214c624eaf12fc12a454e31a93f2ab180b5948cc887');
  const result=spawnSync('duckdb',[file,'-readonly','-bail','-json'],{input:query,encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr || result.error?.message);
  return result.stdout.trim()?JSON.parse(result.stdout):[];
}
const config=(patch:Partial<ChartConfig>={}):ChartConfig=>({id:'governance',title:'真实订单金额',type:'bar',xKey:'channel',yKeys:['amount'],unit:'USD',...patch});
describe('real-source global visualization governance',()=>{
  it('uses the actual filtered records for KPI sums and null-measure row counts',()=>{
    const rows=sql("SELECT channel,amount FROM fiat_transactions WHERE currency='USD' AND status='completed'");
    const spec=widgetRowsToChartSpec(rows,config({type:'kpi',aggregation:'sum',kpiTarget:104000}));
    const total=rows.reduce((sum,row)=>sum+Number(row.amount),0);
    expect(spec.kpiValue).toBe(total);
    expect(spec.kpiCompare?.[0]).toMatchObject({key:'target',value:total-104000});
    const nullRows=sql("SELECT channel,CAST(NULL AS DOUBLE) amount FROM fiat_transactions WHERE currency='USD' AND status='completed'");
    const count=widgetRowsToChartSpec(nullRows,config({aggregation:'count'}));
    expect(count.emptyState).toBe('ok');
    expect(count.cartesian?.series[0].values.reduce((sum,value)=>sum+(value||0),0)).toBe(rows.length);
  });
  it('matches independent DuckDB AVG ranking for every real payment category',()=>{
    const rows=sql("SELECT channel,amount FROM fiat_transactions WHERE status='completed' AND currency='USD'");
    const expected=sql("SELECT channel,AVG(amount) amount FROM fiat_transactions WHERE status='completed' AND currency='USD' GROUP BY channel ORDER BY amount DESC,channel LIMIT 1");
    const spec=widgetRowsToChartSpec(rows,config({aggregation:'avg',topN:1}));
    expect(spec.cartesian?.labels).toEqual(expected.map(row=>row.channel));
    expect(spec.cartesian?.series[0].values).toEqual(expected.map(row=>Number(row.amount)));
  });
  it('counts real fixed-width histogram samples and recomputes filtered percentages',()=>{
    for(const predicate of ["currency='USD' AND status='completed'","currency='USD' AND status='completed' AND channel='ach'"]){
      const rows=sql(`SELECT fiat_order_id record,amount FROM fiat_transactions WHERE ${predicate}`);
      const spec=widgetRowsToChartSpec(rows,config({type:'histogram',xKey:'record',binWidth:10000,valueMode:'percent'}));
      expect(spec.emptyState).toBe('ok');
      const bins=spec.histogramBins!;
      expect(bins.reduce((sum,bin)=>sum+bin.count,0)).toBe(rows.length);
      bins.forEach((bin,index)=>{
        const expected=rows.filter(row=>Number(row.amount)>=bin.from&&(Number(row.amount)<bin.to||index===bins.length-1&&Number(row.amount)<=bin.to)).length;
        expect(bin.count).toBe(expected);
        expect(bin.percent).toBeCloseTo(expected/rows.length*100,10);
      });
      const bundle=adaptChartSpec(spec);
      if(bundle.kind!=='canvas')throw new Error(JSON.stringify(bundle));
      expect(bundle.data.datasets[0].data).toEqual(bins.map(bin=>bin.percent));
    }
  });
  it.each(['bar','area','combo'] as const)('%s percent display overrides the saved absolute measure format',type=>{
    const rows=sql("SELECT channel, SUM(amount) amount, SUM(fee) fee FROM fiat_transactions WHERE currency='USD' AND status='completed' GROUP BY channel ORDER BY channel");
    const spec=widgetRowsToChartSpec(rows,config({type,yKeys:['amount','fee'],stackMode:'percent',formatByKey:{amount:{unit:'USD',percent:false},fee:{unit:'USD',percent:false}}}));
    const bundle=adaptChartSpec(spec);
    expect(spec.formatByKey?.amount).toMatchObject({unit:'%',percent:true});
    expect(spec.formatByKey?.fee).toMatchObject({unit:'%',percent:true});
    rows.forEach((row,index)=>{
      const total=Number(row.amount)+Number(row.fee);
      expect(spec.cartesian?.series[0].values[index]).toBeCloseTo(Number(row.amount)/total*100,8);
      expect(spec.cartesian?.series[1].values[index]).toBeCloseTo(Number(row.fee)/total*100,8);
    });
    if(bundle.kind!=='canvas')throw new Error(JSON.stringify(bundle));
    const value=spec.cartesian!.series[0].values[0]!;
    const expected=formatValueBySpec(value,spec.formatByKey?.amount);
    expect(expected).toContain('%');
    expect(bundle.options.plugins.datalabels.formatter(value,{dataset:{metricKey:'amount'}})).toBe(expected);
    expect(bundle.options.plugins.tooltip.callbacks.label({raw:value,dataset:{metricKey:'amount'}})).toContain(expected);
    expect(bundle.options.scales.y).toMatchObject({min:0,max:100});
    expect(bundle.options.scales.y.ticks.callback?.(50.5)).toContain('50.5%');
  });
  it('formats a VARCHAR decimal measure consistently while preserving identifiers and text',()=>{
    const row=sql("SELECT CAST(SUM(amount) AS VARCHAR) amount FROM fiat_transactions WHERE currency='USD' AND status='completed'")[0];
    const fmt={unit:'USD',compact:false,decimals:2};
    expect(formatTableValue(row.amount,'amount',fmt)).toBe(formatValueBySpec(Number(row.amount),fmt));
    expect(formatTableValue('000042','order_id',fmt)).toBe('000042');
    expect(formatTableValue('2024','year')).toBe('2024');
    const dimensions=sql("SELECT CAST(YEAR(created_at) AS VARCHAR) period,amount FROM fiat_transactions WHERE currency='USD'");
    const spec=widgetRowsToChartSpec(dimensions,config({type:'table',xKey:'period'}));
    expect(formatTableValue(dimensions[0].period,'period',spec.formatByKey?.period)).toBe(dimensions[0].period);
  });
  it('rejects missing bound fields rather than silently producing a null graph',()=>{
    const rows=sql('SELECT channel, amount FROM fiat_transactions');
    for(const patch of [{yKeys:['missing']},{labelKey:'missing'},{groupBy:'missing'},{type:'scatter',xKey:'missing'}] as Partial<ChartConfig>[]) {
      expect(widgetRowsToChartSpec(rows,config(patch)).emptyState).toBe('error');
    }
  });
  it('rejects a text scatter axis and retains explicit null-axis feedback',()=>{
    const rows=sql('SELECT channel, amount FROM fiat_transactions');
    const spec=widgetRowsToChartSpec(rows,config({type:'scatter'}));
    expect(spec.emptyState).toBe('error');
    expect(spec.emptyMessage).toContain('channel');
  });
  it('never falls back from an unregistered saved chart type to a bar',()=>{
    const rows=sql('SELECT channel, amount FROM fiat_transactions');
    expect(widgetRowsToChartSpec(rows,config({type:'unregistered' as any})).emptyState).toBe('error');
  });
  it('does not add quantities from separate axes in a stacked tooltip',()=>{
    const rows=sql("SELECT channel,SUM(amount) amount,COUNT(*) orders FROM fiat_transactions WHERE currency='USD' GROUP BY channel");
    const spec=widgetRowsToChartSpec(rows,config({type:'combo',stackMode:'stack',yRightKeys:['orders'],unitRight:'笔'}));
    const bundle=adaptChartSpec(spec);
    if(bundle.kind!=='canvas')throw new Error(JSON.stringify(bundle));
    const footer=bundle.options.plugins.tooltip.callbacks.footer;
    expect(footer([{dataset:{yAxisID:'y'},parsed:{y:100}},{dataset:{yAxisID:'y1'},parsed:{y:2}}] as any)).toBe('合计: 100 USD');
  });
  it('compares real monthly orders with the actual previous calendar period',()=>{
    const spec=createEmptySpec({dataset:{table:'fiat_transactions'},dimensions:[{id:'date',column:'created_at',dateTrunc:'month',alias:'period'}],
      metrics:[{id:'amount',column:'amount',agg:'sum',alias:'amount'}],calcs:[{id:'mom',kind:'mom',alias:'mom',sourceMetricId:'amount'}],
      filters:{global:[{column:'currency',op:'=',value:'USD'},{column:'status',op:'=',value:'completed'}],cascade:[],interactive:[]},sort:[{by:'period',order:'asc'}],visual:{chartType:'line'}});
    const actual=sql(compileAnalysisSql(spec).sql);
    const raw=sql("SELECT CAST(created_at AS DATE) AS source_date,amount FROM fiat_transactions WHERE currency='USD' AND status='completed'");
    const monthly=new Map<string,number>();
    for(const row of raw){const month=row.source_date.slice(0,7);monthly.set(month,(monthly.get(month)||0)+row.amount);}
    for(const row of actual){const month=row.period.slice(0,7);const date=new Date(`${month}-01T00:00:00Z`);date.setUTCMonth(date.getUTCMonth()-1);const prior=monthly.get(date.toISOString().slice(0,7));
      const expected=prior==null||prior===0?null:Math.round(((monthly.get(month)!-prior)/prior*100)*100)/100;
      expect(row.mom,month).toBe(expected);
    }
  });
  it('keeps period baselines inside each real currency group, including missing months',()=>{
    const spec=createEmptySpec({dataset:{table:'fiat_transactions'},dimensions:[{id:'date',column:'created_at',dateTrunc:'month',alias:'period'},{id:'currency',column:'currency',alias:'currency'}],
      metrics:[{id:'amount',column:'amount',agg:'sum',alias:'amount'}],calcs:[{id:'mom',kind:'mom',alias:'mom',sourceMetricId:'amount'},{id:'yoy',kind:'yoy',alias:'yoy',sourceMetricId:'amount'}],
      visual:{chartType:'line'}});
    const actual=sql(compileAnalysisSql(spec).sql);
    const raw=sql('SELECT CAST(created_at AS DATE) AS source_date,currency,amount FROM fiat_transactions');
    const sums=new Map<string,number>();
    for(const row of raw){const key=`${row.currency}/${row.source_date.slice(0,7)}`;sums.set(key,(sums.get(key)||0)+row.amount);}
    for(const row of actual)for(const kind of ['mom','yoy']) {
      const date=new Date(`${row.period.slice(0,7)}-01T00:00:00Z`);
      if(kind==='mom')date.setUTCMonth(date.getUTCMonth()-1);else date.setUTCFullYear(date.getUTCFullYear()-1);
      const prior=sums.get(`${row.currency}/${date.toISOString().slice(0,7)}`);
      const expected=prior==null||prior===0?null:Math.round((row.amount-prior)/prior*10000)/100;
      expect(row[kind],`${row.currency}/${row.period}/${kind}`).toBe(expected);
    }
  });
  it('requires a time grain for period comparison instead of comparing categories',()=>{
    expect(()=>compileAnalysisSql(createEmptySpec({dataset:{table:'fiat_transactions'},dimensions:[{id:'channel',column:'channel'}],
      metrics:[{id:'m',column:'amount',agg:'sum',alias:'amount'}],calcs:[{id:'mom',kind:'mom',alias:'mom',sourceMetricId:'m'}]}))).toThrow('时间维度');
  });
  it('keeps valid null and zero values distinct from a missing binding',()=>{
    const rows=sql('SELECT channel,fee AS amount FROM fiat_transactions WHERE fee=0');
    expect(rows.length).toBeGreaterThan(0);
    expect(widgetRowsToChartSpec(rows,config()).emptyState).toBe('ok');
    const nullRows=sql("SELECT channel,CAST(NULL AS DECIMAL(18,2)) amount FROM fiat_transactions WHERE currency='USD'");
    expect(widgetRowsToChartSpec(nullRows,config()).emptyState).toBe('all_null');
  });
  it('preserves absolute right-axis formats when the left stack becomes percent',()=>{
    const rows=sql("SELECT channel,SUM(amount) amount,COUNT(*) orders FROM fiat_transactions WHERE currency='USD' GROUP BY channel");
    const spec=widgetRowsToChartSpec(rows,config({type:'combo',stackMode:'percent',yRightKeys:['orders'],unitRight:'笔',formatByKey:{amount:{unit:'USD',percent:false},orders:{unit:'笔',percent:false}}}));
    expect(spec.formatByKey?.amount).toMatchObject({unit:'%',percent:true});
    expect(spec.formatByKey?.orders).toMatchObject({unit:'笔',percent:false});
    expect(spec.cartesian?.series[1].values).toEqual(rows.map(row=>row.orders));
  });
  it('does not require an unused category field for a KPI aggregate',()=>{
    const rows=sql("SELECT SUM(amount) amount FROM fiat_transactions WHERE currency='USD' AND status='completed'");
    expect(widgetRowsToChartSpec(rows,config({type:'kpi'})).kpiValue).toBe(104270);
    expect(widgetRowsToChartSpec(rows,config({type:'kpi'})).emptyState).toBe('ok');
  });
  it('uses the same percentage precision inside and outside real pie sectors',()=>{
    const rows=sql("SELECT channel,SUM(amount) amount FROM fiat_transactions WHERE currency='USD' AND status='completed' GROUP BY channel ORDER BY channel");
    const spec=widgetRowsToChartSpec(rows,config({type:'pie'}));
    for(const slice of spec.sliceLabels!){
      const expected=formatValueBySpec(slice.percent,{percent:true,decimals:1});
      expect(slice.label).toContain(expected);
      expect(formatPieSliceLabelText(slice,slice.key,String(slice.value),'inside')).toContain(expected);
      expect(formatPieSliceLabelText(slice,slice.key,String(slice.value),'outside')).toContain(expected);
    }
  });
  it('summarizes explicitly bound VARCHAR measures without summing numeric-looking dimensions',()=>{
    const rows=sql("SELECT fiat_order_id record,CAST(amount AS VARCHAR) amount FROM fiat_transactions WHERE currency='USD' AND status='completed'");
    expect(summarizeTableRows(rows,['record','amount'],['amount'])).toEqual({amount:104270});
    expect(summarizeTableRows([{category:'000042'}],['category'])).toEqual({});
  });
});
