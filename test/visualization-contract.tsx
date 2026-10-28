/** Browser regression surface: real DuckDB queries and production ChartSpec/renderer. */
import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../index.css';
import { duckDBService } from '../services/duckdbService';
import { widgetRowsToChartSpec } from '../services/analysis/adapters/dashboardWidgetAdapter';
import { listChartTypes } from '../services/analysis/chartRegistry';
import { ChartRenderer } from '../components/charts/ChartRenderer';
import type { ChartConfig } from '../types';

function Validation() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]), [status, setStatus] = useState('初始化');
  const [count, setCount] = useState(12), [scenario, setScenario] = useState('positive'), [width, setWidth] = useState(560), [height, setHeight] = useState(360);
  const [brush, setBrush] = useState(''), [type, setType] = useState<ChartConfig['type']>('bar');
  useEffect(() => {
    let current = true;
    setRows([]);setStatus('查询中');setBrush('');
    const expression = scenario === 'null' ? 'NULL' : scenario === 'signed' ? '(i-5)*10.5' : scenario === 'zero' ? '0' : 'i*10.5';
    const sql = `SELECT '类别_' || i AS category, DATE '2025-01-01' + CAST(i AS INTEGER) AS period, ${expression} AS amount, i*2.5 AS other, i::DOUBLE AS x, i*3.2 AS success_pct, '分组_' || i%3 AS segment, 'record_' || i AS record FROM range(1,${scenario === 'empty' ? 1 : count+1}) t(i) ORDER BY i DESC`;
    duckDBService.readQuery(sql).then(result => { if (current) { setRows(result as Record<string, unknown>[]);setStatus('DuckDB 查询完成'); } }).catch(error => { if(current) setStatus(String(error)); });
    return () => {current=false;};
  }, [count, scenario]);
  const config: ChartConfig = {id:'browser-contract',title:'当前查询金额',type,xKey:type === 'scatter' ? 'x' : ['line','area','combo'].includes(type) ? 'period' : 'category',
    yKeys:['amount'],unit:'USD',aggregation:'none',showValues:true,showLegend:true,
    yRightKeys:type === 'combo' ? ['success_pct'] : undefined, unitRight:type === 'combo' ? '%' : undefined,
    sizeKey:type === 'scatter' ? 'other' : undefined, colorKey:type === 'scatter' ? 'segment' : undefined,
    showTrendLine:type === 'scatter', highlightOutliers:type === 'scatter',
    brushField:type === 'scatter' ? 'record' : undefined,
  };
  const spec = widgetRowsToChartSpec(rows, config);
  return <main className="bg-monokai-bg text-monokai-fg min-h-screen p-3">
    <h1>可视化契约验收：实际 DuckDB → Registry → Adapter → Renderer</h1>
    <div className="flex flex-wrap gap-3 my-3">
      <label>类型<select aria-label="类型" value={type} onChange={event => setType(event.target.value as ChartConfig['type'])}>{listChartTypes().map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label>数据<select aria-label="数据" value={scenario} onChange={event=>setScenario(event.target.value)}>{['positive','signed','zero','null','empty'].map(item=><option key={item}>{item}</option>)}</select></label>
      <label>行数<input aria-label="行数" type="number" value={count} onChange={event=>setCount(Math.max(1,Math.min(10000,Number(event.target.value))))}/></label>
      <label>宽度<input aria-label="宽度" type="number" value={width} onChange={event=>setWidth(Number(event.target.value))}/></label>
      <label>高度<input aria-label="高度" type="number" value={height} onChange={event=>setHeight(Number(event.target.value))}/></label>
    </div>
    <p role="status">{status} · {rows.length} 行 · {spec.emptyState} · 总量 {spec.centerTotal ?? '—'} · 联动 {brush || '—'}</p>
    <section aria-label="验收图表" style={{width:Math.min(width,window.innerWidth-24),height}} className="my-3 border border-monokai-border">
      <ChartRenderer chartSpec={spec} hideTitle={false} onBrush={(field,value)=>setBrush(`${field}=${value}`)} onBrushSelection={(field,values)=>setBrush(`${field} IN (${values.join(', ')})`)}/>
    </section>
    <details><summary>引擎输出</summary><pre className="whitespace-pre-wrap break-all">{JSON.stringify({ labels:spec.cartesian?.labels,values:spec.cartesian?.series,percent:spec.sliceLabels,empty:spec.emptyState },null,2)}</pre></details>
  </main>;
}
const root:Root = import.meta.hot?.data.root || createRoot(document.getElementById('root')!);
if(import.meta.hot) import.meta.hot.data.root=root;
root.render(<Validation/>);
