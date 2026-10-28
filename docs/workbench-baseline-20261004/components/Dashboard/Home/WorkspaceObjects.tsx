import React, { useEffect, useState } from 'react';
import { dbService } from '../../../services/dbService';
import { listAnalysisObjects, type AnalysisObject } from '../../../services/analysisObjects';
import { addObjectToDashboard, createHomeView, selectHomeView } from '../../../services/homeDashboardService';
import { refreshDatabaseAnalysis, useDatabaseAnalysis } from '../../../services/databaseAnalysis';
import { toastService } from '../../../services/toastService';
import { useAppStore } from '../../../hooks/store/useAppStore';
import type { Dashboard } from '../../../types';
import { openExecutiveWorkspace } from '../../../services/executiveWorkspace';
import { DrawerShell } from '../../ui/Workbench';

const labels = { metric: '指标', chart: '可视化', analysis: '分析' };
export function WorkspaceObjects({ board, onChange }: { board: Dashboard | null; onChange: (board: Dashboard) => void }) {
  const database = useAppStore(state => state.currentDatabase);
  const revision = useDatabaseAnalysis(state => state.revision);
  const [views, setViews] = useState<Dashboard[]>([]), [objects, setObjects] = useState<AnalysisObject[]>([]);
  const [open, setOpen] = useState(false), [name, setName] = useState(''), [search, setSearch] = useState('');
  const [kind, setKind] = useState('all'), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [managing, setManaging] = useState(false);
  const filteredObjects = objects.filter(object => (kind === 'all' || kind === object.kind) && object.name.toLowerCase().includes(search.trim().toLowerCase()));
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [nextViews, nextObjects] = await Promise.all([dbService.getDashboards(database), listAnalysisObjects(database)]);
        if (active) { setViews(nextViews); setObjects(nextObjects); setError(''); }
      } catch (err) { if (active) setError(String((err as Error).message)); }
    };
    void load();
    const events = ['duckdb-analysis-objects-updated', 'duckdb-metrics-updated', 'duckdb-metric-charts-updated', 'duckdb-home-dashboard-updated'];
    events.forEach(event => window.addEventListener(event, load));
    return () => { active = false; events.forEach(event => window.removeEventListener(event, load)); };
  }, [database, revision, board?.id]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); } catch (err) { setError(String((err as Error).message)); } finally { setBusy(false); }
  };
  const button = 'inline-flex items-center justify-center min-h-8 px-3 py-1.5 rounded-md border border-monokai-border bg-monokai-elevated text-monokai-fg hover:bg-monokai-hover disabled:opacity-50 transition-colors';
  return <section className="rounded border border-monokai-border p-3 space-y-3 text-xs bg-monokai-surface">
    <div className="flex flex-wrap gap-2 items-center">
      <label>工作台视图 <select aria-label="工作台视图" value={board?.id || ''} disabled={busy} className="ml-2 bg-monokai-bg p-2 border border-monokai-border rounded"
        onChange={event => void run(async () => { await selectHomeView(event.target.value, database); const next = views.find(view => view.id === event.target.value); if (next) onChange(next); })}>
        {views.map(view => <option key={view.id} value={view.id}>{view.name}</option>)}
      </select></label>
      <button className="min-h-8 px-3 rounded-md bg-monokai-accent text-monokai-bg font-semibold disabled:opacity-50 hover:bg-monokai-accent-hover" disabled={busy || !board} onClick={() => setOpen(true)}>添加分析内容</button>
      <button className={button} disabled={busy} onClick={() => void run(async () => { await refreshDatabaseAnalysis(); toastService.success('已发现新内容，原有布局与定义已保留'); })}>重新发现数据</button>
      {objects.some(object => object.kind === 'metric' && object.id.startsWith('executive:')) && <button className={`${button} text-monokai-cyan`} disabled={busy} onClick={() => void run(async () => { onChange(await openExecutiveWorkspace()); })}>打开资金总览</button>}
      <button className={button} aria-expanded={managing} disabled={busy} onClick={() => setManaging(value => !value)}>管理视图</button>
      <span className="text-monokai-comment">每次编排自动保存 · 数据变更自动重算</span>
    </div>
    {managing && <div className="flex flex-wrap gap-2 items-center border-t border-monokai-border pt-3">
      <input aria-label="视图名称" placeholder="新视图名称" value={name} onChange={event => setName(event.target.value)} className="bg-monokai-bg border border-monokai-border rounded p-2"/>
      <button className={button} disabled={busy || !name.trim()} onClick={() => void run(async () => { onChange(await createHomeView(name)); setName(''); })}>创建视图</button>
      <button className={button} disabled={busy || !board || !name.trim()} onClick={() => void run(async () => { if (!board) return; const next = { ...board, name: name.trim(), updatedAt: Date.now() }; await dbService.saveDashboard(next); onChange(next); setViews(views.map(view => view.id === next.id ? next : view)); setName(''); })}>重命名当前视图</button>
    </div>}
    {error && <p role="alert" className="text-monokai-pink">{error}</p>}
    <DrawerShell open={open} title="添加分析内容" description="引用已有指标、图表或分析，可重复加入当前视图。" size="xl" onClose={() => setOpen(false)} closeLabel="关闭内容库">
      <div className="space-y-3 text-xs">
      <div className="flex gap-2"><input aria-label="搜索分析对象" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索指标、图表或分析" className="p-2 bg-monokai-bg border border-monokai-border rounded flex-1"/>
        <select aria-label="分析对象类型" value={kind} onChange={event => setKind(event.target.value)} className="bg-monokai-bg p-2"><option value="all">全部</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      <p className="text-monokai-comment">引用原始定义，支持重复放置。图表或指标失效时，组件会显示原因。</p>
      <p role="status" className="text-monokai-comment">{filteredObjects.length} / {objects.length} 个分析对象</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {filteredObjects.map(object =>
          <div key={`${object.kind}:${object.id}`} className="flex gap-2 items-center justify-between p-2 border border-monokai-border rounded"><div className="min-w-0"><span className="text-monokai-comment">{labels[object.kind]} · </span><span>{object.name}</span></div>
            <button disabled={busy || !board} className={`${button} shrink-0 text-monokai-cyan`} aria-label={`添加${labels[object.kind]} ${object.name}`} onClick={() => void run(async () => { if (board) { onChange(await addObjectToDashboard(object, board)); toastService.success(`${object.name} 已加入当前视图`); } })}>加入</button></div>)}
        {objects.length === 0 && <p>上传 SQL 后自动发现可分析内容。</p>}
        {objects.length > 0 && filteredObjects.length === 0 && <div className="col-span-full rounded-md border border-monokai-border p-6 text-center"><p>没有匹配的分析内容</p><button className={`${button} mt-3`} onClick={() => { setSearch(''); setKind('all'); }}>清除筛选</button></div>}
      </div>
      </div>
    </DrawerShell>
  </section>;
}
