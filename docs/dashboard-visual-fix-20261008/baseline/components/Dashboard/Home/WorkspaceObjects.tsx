import React, { useEffect, useState } from 'react';
import { dbService } from '../../../services/dbService';
import { listAnalysisObjects, type AnalysisObject } from '../../../services/analysisObjects';
import { addObjectToDashboard, createHomeView, selectHomeView } from '../../../services/homeDashboardService';
import { refreshDatabaseAnalysis, useDatabaseAnalysis } from '../../../services/databaseAnalysis';
import { toastService } from '../../../services/toastService';
import { useAppStore } from '../../../hooks/store/useAppStore';
import type { Dashboard } from '../../../types';
import { openExecutiveWorkspace } from '../../../services/executiveWorkspace';
import { ActionButton, DrawerShell, FormInput, FormSelect } from '../../ui/Workbench';
import { cloneDashboard } from '../../../services/workbench/dashboardFormat';

const labels = { metric: '指标', chart: '可视化', analysis: '分析' };
export function WorkspaceObjects({ board, onChange, controls, createControls, settings }: { board: Dashboard | null; onChange: (board: Dashboard) => void; controls?: React.ReactNode; createControls?: React.ReactNode; settings?: React.ReactNode }) {
  const activeDatabase = useAppStore(state => state.currentDatabase);
  const database = board?.databaseName || activeDatabase;
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
  return <section className="space-y-2 text-xs">
    <div className="flex flex-wrap gap-2 items-center">
      <label>视图 <FormSelect sizeVariant="sm" aria-label="工作台视图" value={board?.id || ''} disabled={busy} className="ml-2 !w-auto max-w-full"
        onChange={event => { const id = event.target.value; void run(async () => { await selectHomeView(id, database); const next = (await dbService.getDashboards(database)).find(view => view.id === id); if (next) onChange(next); }); }}>
        {views.map(view => <option key={view.id} value={view.id}>{view.name}</option>)}
      </FormSelect></label>
      <ActionButton size="sm" variant="primary" disabled={busy || !board} onClick={() => setOpen(true)}>添加分析</ActionButton>
      {controls}
      <ActionButton size="sm" aria-expanded={managing} disabled={busy} onClick={() => setManaging(value => !value)}>视图设置</ActionButton>

    </div>
    {managing && <div className="flex flex-wrap gap-2 items-center border-t border-monokai-border pt-3">
            <ActionButton size="sm" disabled={busy} onClick={() => void run(async () => { await refreshDatabaseAnalysis(); toastService.success('已发现新内容，原有布局与定义已保留'); })}>重新发现数据</ActionButton>
      {objects.some(object => object.kind === 'metric' && object.id.startsWith('executive:')) && <ActionButton size="sm" className="text-monokai-cyan" disabled={busy} onClick={() => void run(async () => { onChange(await openExecutiveWorkspace()); })}>打开资金总览</ActionButton>}

      {settings}
      <FormInput sizeVariant="sm" aria-label="视图名称" placeholder="新视图名称" value={name} onChange={event => setName(event.target.value)} className="!w-auto max-w-full"/>
      <ActionButton size="sm" disabled={busy || !name.trim()} onClick={() => void run(async () => { onChange(await createHomeView(name)); setName(''); })}>创建视图</ActionButton>
      <ActionButton size="sm" disabled={busy || !board || !name.trim()} onClick={() => void run(async () => { if (!board) return; const next = await dbService.updateDashboard(board.id,database,current=>({...current,name:name.trim()})); onChange(next); setViews(views.map(view => view.id === next.id ? next : view)); setName(''); })}>重命名当前视图</ActionButton>
      <ActionButton size="sm" disabled={busy || !board || !name.trim()} onClick={() => void run(async () => { if (!board) return; const current=(await dbService.getDashboards(database)).find(view=>view.id===board.id);if(!current)throw new Error('此视图已移除，请重新选择');const next=cloneDashboard(current,name);await dbService.saveDashboard(next);await selectHomeView(next.id,database);onChange(next);setName('');window.dispatchEvent(new CustomEvent('duckdb-home-dashboard-updated')); })}>复制当前视图</ActionButton>
    </div>}
    {error && <p role="alert" className="text-monokai-pink">{error}</p>}
    <DrawerShell open={open} title="添加分析" size="xl" onClose={() => setOpen(false)} closeLabel="关闭内容库">
      <div className="space-y-3 text-xs">
      {createControls}
      <div className="flex gap-2"><FormInput sizeVariant="sm" aria-label="搜索分析对象" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索指标、图表或分析" className="min-w-0 flex-1"/>
        <FormSelect sizeVariant="sm" aria-label="分析对象类型" value={kind} onChange={event => setKind(event.target.value)} className="!w-auto"><option value="all">全部</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</FormSelect></div>

      <p role="status" className="text-monokai-comment">{filteredObjects.length} / {objects.length} 个分析对象</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {filteredObjects.map(object =>
          <div key={`${object.kind}:${object.id}`} className="flex gap-2 items-center justify-between p-2 border border-monokai-border rounded"><div className="min-w-0"><span className="text-monokai-comment">{labels[object.kind]} · </span><span>{object.name}</span>{object.unavailableReason && <p className="mt-1 break-words text-monokai-pink">{object.unavailableReason}</p>}</div>
            <ActionButton size="sm" disabled={busy || !board || !!object.unavailableReason} title={object.unavailableReason} className="shrink-0 text-monokai-cyan" aria-label={`添加${labels[object.kind]} ${object.name}`} onClick={() => void run(async () => { if (board && !object.unavailableReason) { onChange(await addObjectToDashboard(object, board)); toastService.success(`${object.name} 已加入当前视图`); } })}>加入</ActionButton></div>)}
        {objects.length === 0 && <p>暂无已保存的分析，可从数据集创建。</p>}
        {objects.length > 0 && filteredObjects.length === 0 && <div className="col-span-full rounded-md border border-monokai-border p-6 text-center"><p>没有匹配的分析内容</p><ActionButton size="sm" className="mt-3" onClick={() => { setSearch(''); setKind('all'); }}>清除筛选</ActionButton></div>}
      </div>
      </div>
    </DrawerShell>
  </section>;
}
