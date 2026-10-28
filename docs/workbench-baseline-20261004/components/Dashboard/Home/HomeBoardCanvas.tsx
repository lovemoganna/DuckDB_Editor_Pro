import React, { useCallback } from 'react';
import { BarChart3, LayoutDashboard, Lock, Unlock, X } from 'lucide-react';
import { Dashboard, Tab } from '../../../types';
import { DashboardGrid } from '../../DashboardGrid';
import { dbService } from '../../../services/dbService';
import { toastService } from '../../../services/toastService';
import { DB } from '../dashboardUi';
import type { BoardBrushFilter } from './homeBoardTypes';
import { WorkspaceObjects } from './WorkspaceObjects';

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
  /** Default locked: window resize must not rewrite saved x/y/w/h */
  const layoutLocked = dashboard ? dashboard.layoutLocked !== false : true;

  const handleLayoutChange = useCallback(
    async (layout: Array<{ i: string; x: number; y: number; w: number; h: number }>) => {
      if (!dashboard || dashboard.layoutLocked !== false) return;
      const items = dashboard.items.map((item) => {
        const l = layout.find((x) => x.i === item.i);
        if (!l) return item;
        return { ...item, x: l.x, y: l.y, w: l.w, h: l.h };
      });
      const updated = { ...dashboard, items, updatedAt: Date.now() };
      await dbService.saveDashboard(updated);
      onDashboardChange(updated);
      window.dispatchEvent(new CustomEvent('duckdb-home-dashboard-updated'));
    },
    [dashboard, onDashboardChange],
  );

  const handleToggleLayoutLock = useCallback(async () => {
    if (!dashboard) return;
    const nextLocked = !(dashboard.layoutLocked !== false);
    const updated: Dashboard = {
      ...dashboard,
      layoutLocked: nextLocked,
      updatedAt: Date.now(),
    };
    await dbService.saveDashboard(updated);
    onDashboardChange(updated);
    toastService.success(nextLocked ? '布局已锁定 — 窗口缩放不再移动图表' : '布局已解锁 — 可拖拽与调整尺寸');
  }, [dashboard, onDashboardChange]);

  const handleRemoveWidget = useCallback(
    async (itemId: string) => {
      if (!dashboard) return;
      const updated = {
        ...dashboard,
        items: dashboard.items.filter((i) => i.i !== itemId),
        updatedAt: Date.now(),
      };
      await dbService.saveDashboard(updated);
      onDashboardChange(updated);
      window.dispatchEvent(new CustomEvent('duckdb-home-dashboard-updated'));
    },
    [dashboard, onDashboardChange],
  );

  const isEmpty = !dashboard || dashboard.items.length === 0;

  return (
    <section className="relative z-0 flex flex-col gap-3">
      <WorkspaceObjects board={dashboard} onChange={onDashboardChange}/>
      {dashboard?.description && <details className="text-xs text-monokai-comment"><summary>指标口径与看板说明</summary><p className="mt-2 leading-relaxed">{dashboard.description}</p></details>}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <LayoutDashboard className="h-4 w-4 text-monokai-accent shrink-0" />
          <h2 className={DB.sectionTitle}>{dashboard?.name || '分析看板'}</h2>
          <span className={DB.sectionMeta}>
            {dashboard ? `${dashboard.items.length} 个组件` : '—'}
          </span>
          {!isEmpty && (
            <span
              className={`${DB.chip} ${layoutLocked ? 'border-monokai-green/40 text-monokai-green' : 'border-monokai-yellow/40 text-monokai-yellow'}`}
            >
              {layoutLocked ? '已锁定' : '编辑中'}
            </span>
          )}
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
                  <span>解锁布局</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>保存并锁定布局</span>
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

      {!loading && isEmpty && (
        <div className={`${DB.empty} py-14 gap-3`}>
          <BarChart3 className="h-8 w-8 text-monokai-comment/70" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-monokai-fg">还没有可视化</p>
            <p className="text-meta text-monokai-comment max-w-md">
              从数据出发写 SQL，把结果一键生成图表并沉淀到这里。每个图表都可反查 SQL、数据表与 Schema。
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {onNewQuery && (
              <button type="button" onClick={onNewQuery} className={DB.btnPrimary}>
                新建查询
              </button>
            )}
            {onGenerateChart && (
              <button type="button" onClick={onGenerateChart} className={DB.btnSecondary}>
                从最近结果生成图表
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && dashboard && dashboard.items.length > 0 && (
        <div
          className={`relative z-0 py-1 ${
            layoutLocked ? 'overflow-x-auto' : 'overflow-visible'
          }`}
        >
          {!layoutLocked && (
            <p className="px-2 pb-2 text-2xs text-monokai-comment font-mono">
              拖拽标题栏移动 · 拖右下角 / 右边 / 底边调整宽高 · 邻接卡片会自动让位 · 完成后点「锁定布局」
            </p>
          )}
          <DashboardGrid
            dashboard={dashboard}
            refreshTrigger={refreshTrigger}
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
