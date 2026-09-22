import React from 'react';
import {
  Layers,
  Plus,
  BarChart3,
  Trash2,
  ChevronRight,
  LayoutDashboard,
} from 'lucide-react';
import { Dashboard as IDashboard } from '../../types';

interface DashboardAnalyticsHubProps {
  dashboards: IDashboard[];
  loading: boolean;
  onCreateDashboard: () => void;
  onSelectDashboard: (dashboard: IDashboard) => void;
  onDeleteDashboard: (id: string) => void;
}

export const DashboardAnalyticsHub: React.FC<DashboardAnalyticsHubProps> = ({
  dashboards,
  loading,
  onCreateDashboard,
  onSelectDashboard,
  onDeleteDashboard,
}) => {
  return (
    <div className="flex flex-col rounded-md border border-monokai-border bg-monokai-surface overflow-hidden font-sans">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-monokai-border bg-monokai-elevated">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-monokai-orange" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-monokai-fg">
            专题分析大盘
          </h3>
          <span className="rounded-md bg-monokai-bg border border-monokai-border px-1.5 py-0.2 font-mono text-2xs text-monokai-comment">
            {dashboards.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onCreateDashboard}
          className="flex items-center gap-1 font-mono text-meta text-monokai-orange hover:text-monokai-fg transition-colors cursor-pointer"
        >
          <Plus className="h-3 w-3" />
          <span>新建看板</span>
        </button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-xs text-monokai-comment font-mono">
          载入看板列表中…
        </div>
      ) : dashboards.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center p-4 text-center text-xs text-monokai-comment">
          <LayoutDashboard className="h-5 w-5 text-monokai-comment mb-1.5" />
          <p className="text-monokai-fg-muted font-medium">暂无已保存的专题大盘</p>
          <button
            type="button"
            onClick={onCreateDashboard}
            className="mt-1.5 font-mono text-xs text-monokai-orange hover:underline cursor-pointer"
          >
            创建首个多图表大盘 →
          </button>
        </div>
      ) : (
        <div className="max-h-[220px] overflow-y-auto custom-scrollbar divide-y divide-monokai-border/50">
          {dashboards.map(dashboard => (
            <div
              key={dashboard.id}
              role="button"
              tabIndex={0}
              aria-label={`打开仪表板：${dashboard.name}`}
              onClick={() => onSelectDashboard(dashboard)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectDashboard(dashboard);
                }
              }}
              className="group flex h-10 items-center justify-between px-3 text-xs hover:bg-monokai-elevated transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <BarChart3 className="h-3.5 w-3.5 text-monokai-orange shrink-0" />
                <span className="font-semibold text-monokai-fg text-xs truncate">
                  {dashboard.name}
                </span>
                <span className="font-mono text-2xs text-monokai-comment shrink-0">
                  {dashboard.items?.length || 0} 个图表
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0 pl-2">
                <span className="text-2xs font-mono text-monokai-comment">
                  {new Date(dashboard.updatedAt).toLocaleDateString()}
                </span>
                <button
                  type="button"
                  aria-label={`删除仪表板：${dashboard.name}`}
                  onClick={event => {
                    event.stopPropagation();
                    onDeleteDashboard(dashboard.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 rounded p-1 text-monokai-comment hover:text-monokai-pink transition-all cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <ChevronRight className="h-3.5 w-3.5 text-monokai-comment group-hover:text-monokai-cyan transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
