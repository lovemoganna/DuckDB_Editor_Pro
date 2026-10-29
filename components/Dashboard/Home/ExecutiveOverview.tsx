import React, { useEffect, useRef, useState } from 'react';
import { ensureExecutiveMetrics, type ExecutiveMetric } from '../../../services/executiveMetrics';
import { executeAnalysisQuery } from '../../../services/analysis/readQuery';
import { activeAnalysisDatabase } from '../../../services/metricAssetStorage';
import { useAppStore } from '../../../hooks/store/useAppStore';
import { analyzeMetric, openAnalysis } from '../../../hooks/store/useAnalysisWorkspace';
import { AnalysisResultTable } from '../../AnalysisHub/analysisUi';
import { AnalysisChartRenderer } from '../../AnalysisHub/AnalysisChartRenderer';

const columnLabels: Record<string,string> = { family:'类型',unit:'资产',deposits:'入金',withdrawals:'出金',net:'净流入',channel:'渠道',orders:'订单数',completed:'已完成',success_pct:'完成率 %',order_id:'订单',uid:'用户 UID',amount:'金额',status:'状态',created_at:'创建时间',issue:'待核对项',source_table:'来源表',record_id:'记录',asset:'资产',quote_currency:'报价资产',rate_to_usdt:'汇率',effective_date:'有效日期',source:'来源' };
export function ExecutiveOverview({ refreshTrigger = 0 }: { refreshTrigger?: number }) {
  const database = useAppStore(s => s.currentDatabase);
  const [metrics, setMetrics] = useState<ExecutiveMetric[]>([]);
  const [results, setResults] = useState<Record<string,Record<string,unknown>[]>>({});
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(false);
  const [revision,setRevision] = useState(0);
  const [unit,setUnit] = useState('fiat:USD');
  const version = useRef(0);
  useEffect(() => {
    const refresh = () => setRevision(v => v+1);
    ['duckdb-schema-changed','duckdb-metrics-updated'].forEach(e => window.addEventListener(e, refresh));
    return () => ['duckdb-schema-changed','duckdb-metrics-updated'].forEach(e => window.removeEventListener(e, refresh));
  }, []);
  useEffect(() => {
    const request = ++version.current;
    setLoading(true); setResults({}); setErrors({}); setMetrics([]);
    void (async () => {
      try {
        const pkg = await ensureExecutiveMetrics();
        if (!pkg || request !== version.current) return;
        setMetrics(pkg.metrics);
        const data: Record<string,Record<string,unknown>[]> = {}, failures: Record<string,string> = {};
        await Promise.all(pkg.metrics.map(async metric => { try { data[metric.id] = await executeAnalysisQuery(metric.sqlValidation || metric.formula); } catch(error) { failures[metric.id] = (error as Error).message; } }));
        if (request !== version.current || activeAnalysisDatabase() !== pkg.databaseName) return;
        setResults(data); setErrors(failures);
      } catch(error) { if(request === version.current) setErrors({ setup: (error as Error).message }); }
      finally { if(request === version.current) setLoading(false); }
    })();
    return () => { version.current++; };
  }, [database,refreshTrigger,revision]);
  if (!metrics.length) return errors.setup ? <p role="alert">业务概览不可用：{errors.setup}</p> : null;
  const find = (key: string) => metrics.find(m => m.id.endsWith(`:${key}`));
  const data = (key: string) => results[find(key)?.id || ''] || [];
  const monthly = data('monthly');
  const units: string[] = Array.from(new Set(monthly.map(row => `${row.family}:${row.unit}`)));
  const selectedUnit = units.includes(unit) ? unit : units[0] || unit;
  const monthlyMetric = find('monthly');
  const panel = (key: string) => {
    const metric = find(key); if(!metric) return null;
    return <section key={key} className="rounded-lg border border-monokai-border bg-monokai-sidebar p-4 min-w-0">
      <button onClick={() => analyzeMetric(metric)} className="text-sm font-semibold hover:text-monokai-cyan mb-2">{metric.name} ↗</button>
      <p className="text-xs text-monokai-comment mb-3">{metric.definition}</p>
      {errors[metric.id] ? <p role="alert" className="text-monokai-pink">{errors[metric.id]}</p> : loading ? <p className="text-xs">正在计算…</p> : key === 'networks' ? <div className="h-64"><AnalysisChartRenderer height={250} data={data(key)} config={metric.presentation}/></div> : <AnalysisResultTable columnLabels={columnLabels} rows={data(key)} columns={Object.keys(data(key)[0] || {})} maxHeightClass="max-h-64" emptyMessage="当前没有匹配记录"/>}
    </section>;
  };
  return <section className="space-y-4" aria-label="资金业务总览">
    <div className="flex items-end justify-between gap-3"><div><p className="text-xs text-monokai-cyan mb-1">EXECUTIVE OVERVIEW</p><h2 className="text-xl font-semibold">资金流动与业务核对</h2><p className="text-xs text-monokai-comment mt-2">{database} · 四张真实表 · 已完成交易口径 · 按资产独立计量</p></div><button className="text-xs text-monokai-cyan" onClick={() => setRevision(v=>v+1)}>刷新业务数据</button></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">{metrics.slice(0,4).map(metric => <button key={metric.id} onClick={() => analyzeMetric(metric)} className="text-left rounded-lg border border-monokai-border bg-monokai-sidebar p-4 hover:border-monokai-cyan">
      <span className="text-xs text-monokai-comment">{metric.name}</span><div className="text-2xl font-mono font-bold text-monokai-green my-3">{loading ? '…' : errors[metric.id] ? '不可用' : results[metric.id]?.[0]?.value == null ? '—' : Number(results[metric.id][0].value).toLocaleString('zh-CN',{maximumFractionDigits:8})}<span className="text-xs ml-2 text-monokai-comment">{metric.unit}</span></div><p className="text-xs leading-relaxed text-monokai-comment">{metric.definition}</p><span className="block mt-3 text-xs text-monokai-cyan">查看口径与分析 ↗</span>
    </button>)}</div>
    <div className="grid lg:grid-cols-2 gap-4"><section className="rounded-lg border border-monokai-border bg-monokai-sidebar p-4">
      <div className="flex justify-between items-center mb-2"><h3 className="text-sm font-semibold">月度流入与流出</h3><select aria-label="趋势资产" className="bg-monokai-bg text-xs rounded border border-monokai-border p-1" value={selectedUnit} onChange={e=>setUnit(e.target.value)}>{units.map(u=><option key={u} value={u}>{u.replace(':',' · ')}</option>)}</select></div><p className="text-xs text-monokai-comment mb-3">按订单创建月 · completed · 每次查看一种资产</p>
      <div className="h-64">{monthlyMetric && !loading && <AnalysisChartRenderer height={250} data={monthly.filter(row=>`${row.family}:${row.unit}`===selectedUnit)} config={{ ...monthlyMetric.presentation, type:'line', unit:selectedUnit.split(':')[1] }}/>}</div>
      {monthlyMetric && <button className="mt-3 text-xs text-monokai-cyan" onClick={() => openAnalysis({databaseName:database,title:`月度流动 · ${selectedUnit}`,sql:`SELECT * FROM (${monthlyMetric.sqlValidation}) AS monthly WHERE family='${selectedUnit.split(':')[0].replace(/'/g,"''")}' AND unit='${selectedUnit.split(':')[1]?.replace(/'/g,"''") || ''}'`,sourceTables:[],chartConfig:{...monthlyMetric.presentation,type:'line',unit:selectedUnit.split(':')[1]}})}>分析当前资产趋势 ↗</button>}
    </section>{panel('networks')}</div>
    <div className="grid lg:grid-cols-2 gap-4">{panel('liquidity')}{panel('channels')}</div>
    <div className="grid lg:grid-cols-2 gap-4">{panel('exceptions')}{panel('quality')}</div>
    <details className="rounded-lg border border-monokai-border p-3"><summary className="cursor-pointer text-xs text-monokai-comment">汇率来源与有效日期 · 历史快照，不作为实时价格</summary><div className="mt-3">{panel('rates')}</div></details>
  </section>;
}
