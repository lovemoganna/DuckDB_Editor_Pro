import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, LayoutDashboard, Lock, Unlock, X } from 'lucide-react';
import { Dashboard, Tab } from '../../../types';
import { DashboardGrid } from '../../DashboardGrid';
import { dbService } from '../../../services/dbService';
import { toastService } from '../../../services/toastService';
import { DB } from '../dashboardUi';
import type { BoardBrushFilter } from './homeBoardTypes';
import { WorkspaceObjects } from './WorkspaceObjects';
import { DashboardContextControls, DatasetComposer, DatasetWidgetBuilder } from './WorkbenchControls';
import { DatasetPreview } from './DatasetPreview';
import { loadDatasets } from '../../../services/workbench/datasets';
import { useWorkbenchRevision } from '../../../services/workbench/runtime';
import type { DatasetDefinition, WidgetSettings } from '../../../services/workbench/analysisTypes';

export type { BoardBrushFilter } from './homeBoardTypes';

export interface HomeBoardCanvasProps {
  dashboard: Dashboard | null;
  loading?: boolean;
  refreshTrigger: number;
  /** Optional SQL {{param}} substitution; UI entry removed until widgets use placeholders. */
  boardParams?: Record<string, string>;
  brushFilter: BoardBrushFilter | null;
  onBrushFilterChange: (filter: BoardBrushFilter | null) => void;
  onDashboardChange: (dashboard: Dashboard) => void;
  onNavigate: (tab: Tab) => void;
  onGenerateChart?: () => void;
  onNewQuery?: () => void;
  onSelectTable?: (tableName: string) => void;
  onSelectTableStructure?: (tableName: string) => void;
  onSelectTableDataFlow?: (tableName: string) => void;
}

export const HomeBoardCanvas: React.FC<HomeBoardCanvasProps> = ({
  dashboard,
  loading = false,
  refreshTrigger,
  boardParams = {},
  brushFilter,
  onBrushFilterChange,
  onDashboardChange,
  onNavigate,
  onGenerateChart,
  onNewQuery,
  onSelectTable,
  onSelectTableStructure,
  onSelectTableDataFlow,
}) => {
  const revision = useWorkbenchRevision();
  const [datasets,setDatasets] = useState<DatasetDefinition[]>([]);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [datasetError,setDatasetError] = useState('');
  const [loadedOwner,setLoadedOwner] = useState('');
  const [timerRevision,setTimerRevision] = useState(0);
  const owner = dashboard?.databaseName || 'memory';
  const currentView = useRef({ id: dashboard?.id, owner });
  currentView.current = { id: dashboard?.id, owner };
  const publish = useCallback((next: Dashboard) => {
    if (currentView.current.id === next.id && currentView.current.owner === next.databaseName) onDashboardChange(next);
    window.dispatchEvent(new CustomEvent('duckdb-home-dashboard-updated'));
  }, [onDashboardChange]);
  const refreshDatasets = useCallback(async()=>{
    try { setDatasets(await loadDatasets(owner)); setLoadedOwner(owner); setDatasetError(''); }
    catch(error) { setDatasetError(`数据集读取失败：${String((error as Error).message)}`); }
  },[owner]);
  useEffect(()=>{let active=true;void loadDatasets(owner).then(next=>{if(active){setDatasets(next);setLoadedOwner(owner);setDatasetError('');}}).catch(error=>{if(active)setDatasetError(String(error.message));});return()=>{active=false;};},[owner,revision]);
  useEffect(() => { setSelectedDataset(''); }, [owner]);
  useEffect(()=>{const seconds=dashboard?.context?.refreshSeconds;if(!seconds)return;const timer=window.setInterval(()=>setTimerRevision(n=>n+1),Math.max(30,seconds)*1000);return()=>window.clearInterval(timer);},[dashboard?.id,dashboard?.context?.refreshSeconds]);
  const saveBoard = useCallback(async(next:Dashboard)=>{
    const updated = await dbService.updateDashboard(next.id, next.databaseName!, current => ({...current,formatVersion:2,context:next.context}));
    publish(updated);
  },[publish]);
  const saveSettings = useCallback(async(id:string,settings:WidgetSettings)=>{
    if(!dashboard)return;
    const updated = await dbService.updateDashboard(dashboard.id, owner, current => {
      if (!current.items.some(item => item.i === id)) throw new Error('此组件已移除，请重新打开视图');
      return {...current,formatVersion:2,items:current.items.map(item=>item.i===id?{...item,settings}:item)};
    });
    publish(updated);
  },[dashboard?.id,owner,publish]);
  /** Default locked: window resize must not rewrite saved x/y/w/h */
  const layoutLocked = dashboard ? dashboard.layoutLocked !== false : true;

  const handleLayoutChange = useCallback(
    async (layout: Array<{ i: string; x: number; y: number; w: number; h: number }>) => {
      if (!dashboard || dashboard.layoutLocked !== false) return;
      try {
        const updated = await dbService.updateDashboard(dashboard.id, owner, current => ({ ...current, items: current.layoutLocked !== false ? current.items : current.items.map((item) => {
        const l = layout.find((x) => x.i === item.i);
        if (!l) return item;
        return { ...item, x: l.x, y: l.y, w: l.w, h: l.h };
        }) }));
        publish(updated);
      } catch(error) { toastService.error(`布局未保存，原布局已保留：${String((error as Error).message)}`); }
    },
    [dashboard, owner, publish],
  );

  const handleToggleLayoutLock = useCallback(async () => {
    if (!dashboard) return;
    try {
      const updated = await dbService.updateDashboard(dashboard.id, owner, current => ({...current,layoutLocked:current.layoutLocked === false}));
      publish(updated);
      toastService.success(updated.layoutLocked ? '布局已锁定 — 窗口缩放不再移动图表' : '布局已解锁 — 可拖拽与调整尺寸');
    } catch(error) { toastService.error(`布局状态未保存：${String((error as Error).message)}`); }
  }, [dashboard?.id, owner, publish]);

  const handleRemoveWidget = useCallback(
    async (itemId: string) => {
      if (!dashboard) return;
      try {
        const updated = await dbService.updateDashboard(dashboard.id, owner, current => ({...current,items:current.items.filter(i=>i.i!==itemId)}));
        publish(updated);
      } catch(error) { toastService.error(`组件未移除：${String((error as Error).message)}`); }
    },
    [dashboard?.id, owner, publish],
  );

  const isEmpty = !dashboard || dashboard.items.length === 0;

  return (
    <section className="relative z-0 flex flex-col gap-3">
      <WorkspaceObjects board={dashboard} onChange={onDashboardChange}
        controls={<>
          <label className="flex items-center gap-2">数据集<select aria-label="浏览数据集" className="max-w-[240px] min-w-0 rounded border border-monokai-border bg-monokai-surface px-2 py-1"
            value={selectedDataset} onChange={event => setSelectedDataset(event.target.value)}>
            <option value="">选择数据集</option>{datasets.map(dataset => <option key={dataset.id} value={dataset.id}>{dataset.name}</option>)}
          </select></label>
          {dashboard && <DashboardContextControls board={dashboard} datasets={datasets} onSave={saveBoard}/>}
        </>}
        createControls={dashboard && <div className="flex flex-wrap gap-2"><DatasetWidgetBuilder board={dashboard} datasets={datasets} onCreated={publish}/><DatasetComposer owner={owner} datasets={datasets} onCreated={refreshDatasets}/></div>}
        settings={dashboard?.description && <details><summary>指标口径</summary><p>{dashboard.description}</p></details>}
      />
      {datasetError&&<div role="alert" className="text-xs text-monokai-pink"><p>{datasetError}</p><button className="underline" onClick={()=>void refreshDatasets()}>重试读取数据集</button></div>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <LayoutDashboard className="h-4 w-4 text-monokai-accent shrink-0" />
          <h2 className={DB.sectionTitle}>{dashboard?.name || '分析看板'}</h2>
          <span className={DB.sectionMeta}>
            {dashboard?.items.length ? `${dashboard.items.length} 项分析` : ''}
          </span>

        </div>
        <div className="flex items-center gap-1.5">
          {brushFilter && (
            <button
              type="button"
              onClick={() => onBrushFilterChange(null)}
              className={`${DB.chip} hover:border-monokai-pink/40 cursor-pointer`}
              title="清除联动筛选"
            >
              筛选: {brushFilter.column}={brushFilter.value}
              <X className="h-3 w-3" />
            </button>
          )}
          {!isEmpty && (
            <button
              type="button"
              onClick={() => void handleToggleLayoutLock()}
              className={layoutLocked ? DB.btnSecondary : DB.btnPrimary}
              title={
                layoutLocked
                  ? '解锁后可拖拽并调整每个图表宽高；窗口缩放不会改布局'
                  : '锁定后固定所有图表位置与尺寸'
              }
            >
              {layoutLocked ? (
                <>
                  <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>编辑布局</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>完成编辑</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className={`${DB.empty} py-16`}>
          <span className="text-monokai-comment font-mono text-xs">加载看板…</span>
        </div>
      )}

      {!loading && isEmpty && <p className="text-monokai-comment text-xs">暂无图表，点击“添加分析”创建。</p>}
      {!loading && (isEmpty || selectedDataset) && loadedOwner === owner && <DatasetPreview
        key={`${owner}:${selectedDataset}`} dataset={datasets.find(dataset => dataset.id === selectedDataset) || datasets.find(dataset => dataset.catalog === owner && !dataset.error) || datasets.find(dataset => !dataset.error)}
        datasets={datasets} context={dashboard?.context} revision={refreshTrigger + revision} />}

      {!loading && dashboard && loadedOwner===owner && dashboard.items.length > 0 && (
        <div
          className="relative z-0 overflow-x-auto py-1"
        >
          {!layoutLocked && (
            <p className="px-2 pb-2 text-2xs text-monokai-comment font-mono">
              拖拽标题栏移动 · 拖右下角 / 右边 / 底边调整宽高 · 邻接卡片会自动让位 · 完成后点「完成编辑」
            </p>
          )}
          <DashboardGrid
            dashboard={dashboard}
            refreshTrigger={refreshTrigger + timerRevision + revision}
            datasets={datasets}
            context={dashboard.context}
            onSettingsChange={saveSettings}
            onLayoutChange={handleLayoutChange}
            onRemoveWidget={handleRemoveWidget}
            onNavigate={onNavigate}
            boardParams={boardParams}
            brushFilter={brushFilter}
            onBrushFilter={onBrushFilterChange}
            onSelectTable={onSelectTable}
            onSelectTableStructure={onSelectTableStructure}
            onSelectTableDataFlow={onSelectTableDataFlow}
          />
        </div>
      )}
    </section>
  );
};
