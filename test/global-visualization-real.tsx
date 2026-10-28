/** Test-only browser surface. All business rows come from the frozen readonly file. */
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { duckDBService } from '../services/duckdbService';
import { widgetRowsToChartSpec } from '../services/analysis/adapters/dashboardWidgetAdapter';
import { listChartTypes } from '../services/analysis/chartRegistry';
import { ChartRenderer } from '../components/charts/ChartRenderer';
import { WidgetChartConfigPanel } from '../components/Dashboard/WidgetChartConfigPanel';
import type { ChartConfig } from '../types';

let ready:Promise<void>|undefined;
function baseline(){return ready ||= (async()=>{
  const response=await fetch('../data/crud-lab/baseline.duckdb');
  if(!response.ok)throw new Error(`基线加载失败 ${response.status}`);
  const bytes=await response.arrayBuffer();
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!=='a16db823884ef4c8a6056214c624eaf12fc12a454e31a93f2ab180b5948cc887')throw new Error('基线哈希不一致');
  await duckDBService.registerFileBuffer('governance.duckdb',new Uint8Array(bytes));
  await duckDBService.query("ATTACH 'governance.duckdb' AS governance (READ_ONLY)");
})();}
function Validation(){
  const [configOpen,setConfigOpen]=useState(false),[overrides,setOverrides]=useState<Partial<ChartConfig>>({});
  const [type,setType]=useState<ChartConfig['type']>('bar'),[mode,setMode]=useState('normal'),[filter,setFilter]=useState(''),[revision,setRevision]=useState(0);
  const [width,setWidth]=useState(760),[height,setHeight]=useState(440),[full,setFull]=useState(false),[rows,setRows]=useState<Record<string,unknown>[]>([]),[status,setStatus]=useState('查询中'),[brush,setBrush]=useState('');
  const [query,setQuery]=useState('');
  const series=['line','area','combo','waterfall'].includes(type),raw=['scatter','histogram','table','pivot'].includes(type);
  const config:ChartConfig={id:'real-governance',title:'USD 完成订单',type,xKey:raw?'record':series?'period':'channel',yKeys:['amount'],unit:'USD',
    aggregation:'none',stackMode:mode==='percent'?'percent':'none',formatByKey:{amount:{unit:'USD',percent:false,compact:false}},
    ...(type==='area'||mode==='percent'?{yKeys:['amount','fee']}:{}),
    ...(type==='combo'?{yRightKeys:['orders'],unitRight:'笔'}:{}),
    ...(type==='scatter'?{xKey:'fee',sizeKey:'amount',colorKey:'channel',brushField:'record',showTrendLine:true,highlightOutliers:true}:{}),
    ...(type==='pivot'?{rowKey:'channel',colKey:'status',valKey:'amount',aggFunc:'sum'}:{}),showValues:true,binCount:4,...overrides};
  useEffect(()=>{
    let current=true;setRows([]);setStatus('查询中');setBrush('');
    const where=`currency='USD' AND status='completed'${filter?" AND channel='wire_transfer'":''}${mode==='empty'?' AND false':''}`;
    const source='governance.main.fiat_transactions';
    const sql=mode==='failure'?`SELECT missing FROM ${source}`:raw?`SELECT fiat_order_id record,channel,status,amount,fee FROM ${source} WHERE ${where} ORDER BY created_at`:
      type==='counter'||type==='kpi'?`SELECT SUM(amount) amount FROM ${source} WHERE ${where}`:
      series?`SELECT CAST(DATE_TRUNC('month',created_at) AS VARCHAR) period,SUM(${type==='waterfall'?"CASE WHEN direction='withdrawal' THEN -amount ELSE amount END":'amount'}) amount,SUM(fee) fee,COUNT(*) orders${type==='waterfall'?",CASE WHEN ROW_NUMBER() OVER (ORDER BY period)=1 THEN 'start' ELSE 'change' END node_role":''} FROM ${source} WHERE ${where} GROUP BY 1 ORDER BY 1`:
      `SELECT channel,SUM(amount) amount,SUM(fee) fee FROM ${source} WHERE ${where} GROUP BY channel ORDER BY channel`;
    setQuery(sql);
    baseline().then(()=>duckDBService.readQuery(sql)).then(result=>{if(current){setRows(result as Record<string,unknown>[]);setStatus('真实查询完成');}}).catch(error=>{if(current){setRows([]);setStatus(`查询失败: ${error.message}`);}});
    return()=>{current=false;};
  },[type,mode,filter,revision]);
  const spec=widgetRowsToChartSpec(rows,config);
  const content=<ChartRenderer chartSpec={spec} hideTitle={false} onBrush={(field,value)=>setBrush(`${field}=${value}`)} onBrushSelection={(field,values)=>setBrush(`${field} IN (${values.join(',')})`)}/>;
  return <main className="bg-monokai-bg text-monokai-fg min-h-screen p-3"><h1>真实数据可视化治理验收</h1>
    <div className="flex flex-wrap gap-3 my-3">
      <label>类型<select aria-label="类型" value={type} onChange={e=>{setOverrides({});setType(e.target.value as ChartConfig['type']);}}>{[...listChartTypes().map(t=>({id:t.id,label:t.label})),{id:'pivot',label:'透视表'}].map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
      <label>模式<select aria-label="模式" value={mode} onChange={e=>setMode(e.target.value)}>{['normal','percent','empty','failure'].map(m=><option key={m}>{m}</option>)}</select></label>
      <label>渠道<select aria-label="渠道" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">全部</option><option value="wire_transfer">wire_transfer</option></select></label>
      <label>宽度<input aria-label="宽度" type="number" value={width} onChange={e=>setWidth(Number(e.target.value))}/></label>
      <label>高度<input aria-label="高度" type="number" value={height} onChange={e=>setHeight(Number(e.target.value))}/></label>
      <button onClick={()=>setRevision(revision+1)}>刷新</button><button onClick={()=>setFull(true)}>全屏</button>
      <button onClick={()=>setConfigOpen(true)}>字段配置</button>
    </div>
    <p role="status">{status} · {rows.length} 行 · {spec.emptyState} · 联动 {brush||'—'}</p>
    <section aria-label="验收图表" style={{width:Math.min(width,window.innerWidth-24),height}} className="border border-monokai-border">{!full&&content}</section>
    {full&&<div role="dialog" aria-label="全屏验收" className="fixed inset-0 z-50 bg-monokai-bg p-4 flex flex-col"><button onClick={()=>setFull(false)}>退出全屏</button><div className="flex-1 min-h-0">{content}</div></div>}
    {configOpen&&<WidgetChartConfigPanel config={config} columns={Object.keys(rows[0]||{})} onClose={()=>setConfigOpen(false)} onChange={next=>{setOverrides(next);setType(next.type);setConfigOpen(false);}}/>}
    <details open><summary>实际查询与引擎结果</summary><pre data-testid="engine" className="whitespace-pre-wrap break-all">{JSON.stringify({query,rows,spec},(_key,value)=>typeof value==='bigint'?String(value):value,2)}</pre></details>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Validation/>);
