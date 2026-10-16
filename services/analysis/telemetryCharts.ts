import type { QueryHistoryItem } from '../../types';
import type { RecentImportItem } from '../recentImportsService';
import { chartNumber, formatValueBySpec } from '../../utils/chartFormat';
import { widgetRowsToChartSpec } from './adapters/dashboardWidgetAdapter';

const time = (value: unknown) => typeof value === 'number' ? value : Date.parse(String(value ?? ''));
export function queryHistogram(history: QueryHistoryItem[], duration: number, daily: boolean, now = Date.now()) {
  const start = now - duration, step = duration / 8;
  const fmt = (value: number) => { const date = new Date(value); return `${daily ? `${date.getMonth()+1}/${date.getDate()} ` : ''}${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`; };
  const details = Array.from({ length: 8 }, (_, i) => ({ successCount: 0, errorCount: 0, queries: [] as QueryHistoryItem[], startTime: fmt(start+i*step), endTime: fmt(start+(i+1)*step), percent: 0 }));
  for (const item of history) {
    const timestamp = time(item.timestamp);
    if (!Number.isFinite(timestamp) || timestamp < start || timestamp > now) continue;
    const bucket = details[Math.min(7, Math.floor((timestamp-start)/step))];
    bucket.queries.push(item); if (item.status === 'success') bucket.successCount++; else bucket.errorCount++;
  }
  const total = details.reduce((sum, bucket) => sum + bucket.queries.length, 0);
  const currentHistory = details.flatMap(bucket => bucket.queries);
  const previousHistory = history.filter(item => time(item.timestamp)>=start-duration&&time(item.timestamp)<start);
  const comparison = (current:number|null,previous:number|null) => previous != null && previous > 0 && current != null ? `较前一等长时段 ${formatValueBySpec((current-previous)/previous*100,{percent:true,decimals:1})}` : '—';
  const avg = (items:QueryHistoryItem[]) => { const values=items.map(item=>chartNumber(item.executionTime)).filter((value):value is number=>value!=null&&value>=0); return values.length?values.reduce((a,b)=>a+b,0)/values.length:null; };
  details.forEach(bucket => bucket.percent = total ? bucket.queries.length / total * 100 : 0);
  const spec = widgetRowsToChartSpec(details.map(bucket => ({ interval: `${bucket.startTime}–${bucket.endTime}`, count: bucket.queries.length })),
    { id: 'query-telemetry', title: '当前时间范围查询次数', type: 'bar', xKey: 'interval', yKeys: ['count'], unit: '次' });
  return { spec, queryHistogram: spec.cartesian?.series[0]?.values.map(value => value ?? 0) || [], histogramDetails: details, total,
    averageLatency:avg(currentHistory),currentHistory,range:{from:start,to:now},queryTrendLabel:comparison(total,previousHistory.length),latencyTrendLabel:comparison(avg(currentHistory),avg(previousHistory)) };
}

export function queryLatency(history: QueryHistoryItem[], limit = 10, width = 186, height = 26, left = 7, baseline = 34, range?:{from:number;to:number}) {
  const sample = history.filter(item => chartNumber(item.executionTime) != null && item.executionTime >= 0 && Number.isFinite(time(item.timestamp)))
    .sort((a,b) => time(a.timestamp)-time(b.timestamp)).slice(-limit);
  const spec = widgetRowsToChartSpec(sample.map(item => ({ timestamp: new Date(time(item.timestamp)).toISOString(), latency: item.executionTime })),
    { id: 'latency-telemetry', title: '查询耗时', type: 'line', xKey: 'timestamp', yKeys: ['latency'], unit: 'ms' });
  const avg = sample.length ? sample.reduce((sum, item) => sum + item.executionTime, 0)/sample.length : null;
  const max = sample.reduce((max,item) => Math.max(max,item.executionTime), 1);
  const start = range?.from ?? (sample.length ? time(sample[0].timestamp) : 0), end = range?.to ?? (sample.length ? time(sample.at(-1)!.timestamp) : 0);
  const points = sample.map(item => ({ x: end > start ? left+(time(item.timestamp)-start)/(end-start)*width : left+width/2,
    y: baseline-item.executionTime/max*height, latency:item.executionTime, item }));
  const path = points.length > 1 ? `M ${points.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')}` : '';
  return { spec, latencyPoints: points, latencyCurvePath: path, avgLatency: avg ?? 0, maxLatency: max };
}

export function importGrowth(imports: RecentImportItem[], range?: {from:number;to:number}) {
  const valid = imports.filter(item => item.status === 'success' && (!range || (time(item.importedAt)>=range.from && time(item.importedAt)<=range.to)) && chartNumber(item.rowCount) != null && item.rowCount! >= 0 && Number.isFinite(time(item.importedAt)))
    .sort((a,b) => time(a.importedAt)-time(b.importedAt));
  let total = 0;
  const rows = valid.map(item => ({ timestamp: new Date(time(item.importedAt)).toISOString(), rows: total += item.rowCount! }));
  const spec = widgetRowsToChartSpec(rows, { id:'import-telemetry', title:'成功导入累计行数', type:'line', xKey:'timestamp', yKeys:['rows'], unit:'行' });
  const first = range?.from ?? (valid.length ? time(valid[0].importedAt) : 0), last = range?.to ?? (valid.length ? time(valid.at(-1)!.importedAt) : 0);
  const points = valid.map((item,index) => ({ x: last > first ? 10+(time(item.importedAt)-first)/(last-first)*180 : 100,
    y: 34-(total ? rows[index].rows/total : 0)*24, item }));
  let previousY = 34;
  const steps = points.map(point => { const segment = ` L ${point.x} ${previousY} L ${point.x} ${point.y}`; previousY=point.y; return segment; }).join('');
  return { spec, importPoints:points, dataStepCurve: points.length ? `M 0 34${steps}` : '', total, totalFormatted:formatValueBySpec(total,{unit:'行',decimals:0}) };
}

export function memorySnapshot(percent: number, limitGb: number) {
  const measured = limitGb > 0 && chartNumber(percent) != null && percent >= 0;
  const spec = widgetRowsToChartSpec(measured ? [{ memory_pct: percent }] : [], { id:'memory-snapshot',title:'当前内存占用',type:'kpi',xKey:'',yKeys:['memory_pct'],unit:'%' });
  return { spec, memoryPoints: measured ? [{ x:100,y:35-Math.min(100,percent)/100*26,label:'当前采样' }] : [],
    memoryAreaPath:'', memoryLinePath:'' };
}

export function tableVolume<T extends { name:string; schema?:string; rowCount:number }>(tables:T[], limit:number, totalRows?:number) {
  const topTables = tables.filter(table => chartNumber(table.rowCount) != null && table.rowCount >= 0).sort((a,b) => b.rowCount-a.rowCount).slice(0,limit);
  const maxRows = topTables.reduce((max,table) => Math.max(max,table.rowCount),1);
  const spec = widgetRowsToChartSpec(topTables.map(table => ({ table: `${table.schema || 'main'}.${table.name}`, rows:table.rowCount })),
    {id:'table-volume',title:'数据表行数',type:'bar',xKey:'table',yKeys:['rows'],unit:'行'});
  const shares = new Map(topTables.map(table => [table, totalRows && totalRows > 0 ? table.rowCount/totalRows*100 : null]));
  return {spec,topTables,maxRows,shares};
}
