import React, { useEffect, useRef, useState } from 'react';
import { useAnalysisWorkspace, resolveAnalysisContext, navigateToAnalysisSource, type AnalysisWorkspaceContext } from '../../hooks/store/useAnalysisWorkspace';
import { useAppStore } from '../../hooks/store/useAppStore';
import { executeAnalysisQuery } from '../../services/analysis/readQuery';
import { metricAnalyzer } from '../../services/metricAnalyzer';
import { dbService } from '../../services/dbService';
import { addObjectToDashboard } from '../../services/homeDashboardService';
import { deleteAnalysisRecord } from '../../services/analysisObjects';
import { duckDBService } from '../../services/duckdbService';
import { activeAnalysisDatabase } from '../../services/metricAssetStorage';
import { toastService } from '../../services/toastService';
import { Tab, type MetricChart } from '../../types';
import { AnalysisResultTable } from './analysisUi';
import { AnalysisChartRenderer } from './AnalysisChartRenderer';
import { ActionButton } from '../ui/Workbench';

type SavedAnalysis = AnalysisWorkspaceContext & { id: string; savedAt: number; note: string };
export function LinkedAnalysis({ onInsertSql }: { onInsertSql?: (sql: string, execute?: boolean) => void }) {
  const context = useAnalysisWorkspace(s => s.context);
  const setContext = useAnalysisWorkspace(s => s.setContext);
  const database = useAppStore(s => s.currentDatabase);
  const refresh = useAppStore(s => s.dashboardRefreshTrigger);
  const [records, setRecords] = useState<SavedAnalysis[]>([]);
  const [resolved, setResolved] = useState<AnalysisWorkspaceContext | null>(null);
  const [rows, setRows] = useState<Record<string,unknown>[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const visibleRecords = records.filter(record => `${record.title} ${record.note}`.toLowerCase().includes(search.trim().toLowerCase()));
  const version = useRef(0);
  useEffect(() => {
    let active = true;
    if (!context?.analysisId) { setNote(''); return; }
    void dbService.getDomainSetting<SavedAnalysis[]>('linked-analyses', database).then(saved => {
      if (active) setNote(saved?.find(record => record.id === context.analysisId)?.note || '');
    });
    return () => { active = false; };
  }, [context?.analysisId, database]);
  useEffect(() => {
    let active = true;
    void dbService.getDomainSetting<SavedAnalysis[]>('linked-analyses', database).then(saved => { if(active) setRecords(saved || []); }).catch(() => { if(active) setRecords([]); });
    return () => { active = false; };
  }, [database, revision]);
  useEffect(() => {
    const reload = () => setRevision(v => v + 1);
    ['duckdb-schema-changed','duckdb-metrics-updated','duckdb-metric-charts-updated','duckdb-analysis-objects-updated'].forEach(e => window.addEventListener(e,reload));
    return () => ['duckdb-schema-changed','duckdb-metrics-updated','duckdb-metric-charts-updated','duckdb-analysis-objects-updated'].forEach(e => window.removeEventListener(e,reload));
  }, []);
  useEffect(() => {
    const request = ++version.current;
    setRows([]); setResolved(null); setError(''); setLoading(Boolean(context));
    if (!context) return;
    void (async () => {
      try {
        const next = await resolveAnalysisContext(context);
        const result = await executeAnalysisQuery(next.sql);
        if (request !== version.current || activeAnalysisDatabase() !== next.databaseName) return;
        const scope = await duckDBService.getCurrentCatalogAndSchema();
        if (request !== version.current || scope.catalog !== next.databaseName || scope.schema !== next.schemaName) return;
        setResolved(next); setRows(result);
        if (!context.schemaName) setContext({ ...context, schemaName: next.schemaName });
      } catch (err) { if(request === version.current) setError(String((err as Error).message)); }
      finally { if(request === version.current) setLoading(false); }
    })();
    return () => { version.current++; };
  }, [context, database, refresh, revision]);
  const save = async () => {
    if (!resolved || loading || error) return;
    try {
      const id = resolved.analysisId || `analysis:${crypto.randomUUID()}`;
      const record: SavedAnalysis = { ...resolved, analysisId: id, id, savedAt: Date.now(), note };
      const current = await dbService.getDomainSetting<SavedAnalysis[]>('linked-analyses', resolved.databaseName) || [];
      const next = [...current.filter(item => item.id !== id), record];
      await dbService.saveDomainSetting('linked-analyses', next, resolved.databaseName);
      setContext({ ...resolved, analysisId: id });
      setRecords(next); window.dispatchEvent(new CustomEvent('duckdb-analysis-objects-updated'));
      toastService.success('分析来源与笔记已保存，重新打开时使用最新数据');
    } catch(err) { toastService.error(`保存失败：${String(err)}`); }
  };
  const remove = async (record: SavedAnalysis) => {
    try {
      await deleteAnalysisRecord(record.id, database);
      if (context?.analysisId === record.id) setContext(null);
      toastService.success('分析已删除；引用它的组件将说明来源已不存在');
    } catch (err) { toastService.error(String((err as Error).message)); }
  };
  const visualize = async () => {
    if (!resolved || !resolved.sql) return;
    try {
      let chart: MetricChart | undefined;
      if (resolved.metricId) {
        const pkg = metricAnalyzer.loadMetricPackages().find(p => p.metrics.some(m => m.id === resolved.metricId));
        const metric = pkg?.metrics.find(m => m.id === resolved.metricId);
        if (!pkg || !metric) throw new Error('关联指标已删除');
        chart = await metricAnalyzer.generateChart(metric, pkg.id, resolved.sourceTables[0]);
      } else {
        const config = resolved.chartConfig || { id: `analysis-chart:${Date.now()}`, title: resolved.title, type: 'table' as const, xKey: '', yKeys: [] };
        chart = { id: resolved.chartId || config.id, databaseName: resolved.databaseName, metricName: resolved.title, sql: resolved.sql, sourceTable: resolved.sourceTables[0], chartConfig: config, createdAt: Date.now() };
        metricAnalyzer.saveMetricChart(chart);
      }
      useAnalysisWorkspace.getState().setContext({ ...resolved, chartId: chart.id, chartConfig: chart.chartConfig });
      useAnalysisWorkspace.getState().setVisualizationMetricId(chart.metricId || null);
      useAppStore.getState().setCurrentTable(null);
      useAppStore.getState().setActiveTab(Tab.VISUALIZATION);
    } catch(err) { toastService.error(`生成图表失败：${String(err)}`); }
  };
  return <div className="h-full overflow-auto p-3 space-y-3 text-xs text-monokai-fg">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-sm font-semibold">{resolved?.title || context?.title || '关联分析'}</h2><p className="text-xs text-monokai-comment mt-1">数据 → 指标定义 → 查询结果 → 可视化 → 分析笔记</p></div>
      <ActionButton size="sm" variant="secondary" disabled={!context || loading} onClick={() => setRevision(v => v+1)}>重新计算</ActionButton>
    </div>
    <div className="flex flex-wrap gap-3 text-xs">
      {(resolved?.sourceTables || []).map(table => <button key={table} onClick={() => void navigateToAnalysisSource(table).catch(err => toastService.error(String(err.message)))} className="text-monokai-cyan">来源：{table}</button>)}
      {resolved?.metricId && <span className="text-monokai-comment">指标 ID：{resolved.metricId} · 使用当前定义</span>}
    </div>
    {loading && <p role="status" aria-live="polite">正在读取当前数据…</p>}
    {error && <p role="alert" className="text-monokai-pink">{error}</p>}
    {!context && <p className="text-monokai-comment">从首页业务指标、指标卡片或图表进入，也可打开下方保存的分析。</p>}
    {resolved && !loading && !error && <>
      {resolved.chartConfig && <div className={resolved.chartConfig.type === 'counter' ? 'h-28' : 'h-64'}><AnalysisChartRenderer height={resolved.chartConfig.type === 'counter' ? 100 : 250} data={rows} config={resolved.chartConfig}/></div>}
      <AnalysisResultTable rows={rows} columns={Object.keys(rows[0] || {})} title="当前查询结果"/>
      <details className="text-xs"><summary className="cursor-pointer">查询口径与来源 SQL</summary><pre className="mt-2 p-3 bg-monokai-bg whitespace-pre-wrap">{resolved.sql}</pre></details>
      <textarea aria-label="分析笔记" placeholder="记录观察；保存来源，打开时重新计算" value={note} onChange={e => setNote(e.target.value)} className="w-full p-3 border border-monokai-border rounded bg-monokai-bg text-xs"/>
      <div className="flex flex-wrap gap-2"><ActionButton size="sm" variant="primary" onClick={() => void save()}>保存分析</ActionButton><ActionButton size="sm" variant="secondary" onClick={() => void visualize()}>生成关联可视化</ActionButton><ActionButton size="sm" variant="ghost" disabled={!onInsertSql} onClick={() => onInsertSql?.(resolved.sql || '', false)}>在 SQL 工作台查看</ActionButton></div>
    </>}
    <section className="border-t border-monokai-border pt-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">已保存的分析 · {records.length} · {database}</h3><input aria-label="搜索已保存分析" placeholder="搜索标题或笔记" value={search} onChange={event => setSearch(event.target.value)} className="rounded-md border border-monokai-border bg-monokai-surface px-3 py-2" /></div>
      <div className="divide-y divide-monokai-border rounded-md border border-monokai-border bg-monokai-surface">
        {visibleRecords.map(record => <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="min-w-0 flex-1"><button className="text-left text-monokai-cyan font-medium hover:underline" onClick={() => { setNote(record.note); setContext({ ...record, analysisId: record.id }); }}>{record.title}</button><p className="mt-1 text-[11px] text-monokai-comment">{new Date(record.savedAt).toLocaleString()}</p>{record.note && <p className="mt-1 text-monokai-fg-muted line-clamp-2">{record.note}</p>}</div>
          <div className="flex gap-2"><ActionButton size="sm" variant="secondary" onClick={() => void addObjectToDashboard({kind:'analysis',id:record.id,name:record.title}).then(() => toastService.success('分析已加入当前首页视图')).catch(err => toastService.error(String(err.message)))}>加入首页</ActionButton><ActionButton size="sm" variant="ghost" aria-label={`删除分析 ${record.title}`} className="text-monokai-pink" onClick={() => void remove(record)}>删除</ActionButton></div>
        </div>)}
        {visibleRecords.length === 0 && <p className="p-6 text-center text-monokai-comment">{records.length ? '没有匹配的分析，请调整搜索条件。' : '尚未保存分析。从指标或图表进入后即可记录并保存。'}</p>}
      </div>
    </section>
  </div>;
}
