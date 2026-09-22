import React from 'react';
import { Tab } from '../../types';
import {
  Database,
  Terminal,
  Table2,
  BarChart3,
  Network,
  ScrollText,
  BookOpen,
  UploadCloud,
  Settings,
  ChevronsLeft,
} from 'lucide-react';

interface DashboardIconRailProps {
  onNavigate: (tab: Tab) => void;
  onOpenSettings: () => void;
  onOpenImport: () => void;
  onOpenCreateTable: () => void;
}

const railBtnIdle =
  'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70 focus-visible:ring-offset-1 focus-visible:ring-offset-monokai-bg';
const railBtnActive =
  'bg-monokai-yellow/15 text-monokai-yellow border border-monokai-yellow/30 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70 focus-visible:ring-offset-1 focus-visible:ring-offset-monokai-bg';

export const DashboardIconRail: React.FC<DashboardIconRailProps> = ({
  onNavigate,
  onOpenSettings,
  onOpenImport,
}) => {
  const topItems = [
    { id: 'dashboard', icon: Database, label: '数据资产', shortLabel: '资产', action: undefined, active: true },
    { id: 'sql', icon: Terminal, label: 'SQL 工作台', shortLabel: 'SQL', action: () => onNavigate(Tab.SQL), active: false },
    { id: 'data', icon: Table2, label: '数据浏览', shortLabel: '数据', action: () => onNavigate(Tab.DATA), active: false },
    { id: 'metrics', icon: BarChart3, label: '指标看板', shortLabel: '指标', action: () => onNavigate(Tab.METRICS), active: false },
    { id: 'ontology', icon: Network, label: '本体图谱', shortLabel: '图谱', action: () => onNavigate(Tab.ONTOLOGY), active: false },
    { id: 'audit', icon: ScrollText, label: '审计日志', shortLabel: '审计', action: () => onNavigate(Tab.AUDIT), active: false },
    { id: 'library', icon: BookOpen, label: '知识库', shortLabel: '知识库', action: () => onNavigate(Tab.LIBRARY), active: false },
  ];

  return (
    <aside
      className="flex flex-col justify-between w-[72px] bg-monokai-bg border-r border-monokai-border select-none shrink-0 z-20 font-sans"
      aria-label="主侧边导航栏"
    >
      <div className="flex flex-col items-center py-2.5 gap-1.5 px-1.5">
        {topItems.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              aria-current={item.active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center w-full py-1.5 rounded-md transition-all cursor-pointer ${
                item.active ? railBtnActive : railBtnIdle
              }`}
              title={item.label}
              aria-label={item.label}
            >
              {item.active && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-monokai-yellow rounded-r-sm" />
              )}
              <Icon className="h-4.5 w-4.5" />
              <span className="text-2xs font-medium tracking-tight mt-0.5 scale-95 leading-none">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center py-2.5 gap-1 border-t border-monokai-border px-1.5">
        <button
          type="button"
          onClick={onOpenImport}
          className={`flex flex-col items-center justify-center w-full py-1.5 rounded-md transition-colors cursor-pointer ${railBtnIdle}`}
          title="导入数据"
          aria-label="导入数据"
        >
          <UploadCloud className="h-4.5 w-4.5" />
          <span className="text-2xs font-normal tracking-tight mt-0.5 scale-95 leading-none">
            导入
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className={`flex flex-col items-center justify-center w-full py-1.5 rounded-md transition-colors cursor-pointer ${railBtnIdle}`}
          title="设置"
          aria-label="设置"
        >
          <Settings className="h-4.5 w-4.5" />
          <span className="text-2xs font-normal tracking-tight mt-0.5 scale-95 leading-none">
            设置
          </span>
        </button>

        <button
          type="button"
          className="flex items-center justify-center w-full h-8 text-monokai-border-strong hover:text-monokai-fg-muted transition-colors cursor-pointer mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70 focus-visible:ring-offset-1 focus-visible:ring-offset-monokai-bg rounded-md"
          title="收起导航"
          aria-label="收起导航"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
};
