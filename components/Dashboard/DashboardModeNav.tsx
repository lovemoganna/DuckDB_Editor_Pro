import React from 'react';
import { Database, Layers, Zap } from 'lucide-react';
import { DashboardMainViewMode } from './types';

interface DashboardModeNavProps {
  currentMode: DashboardMainViewMode;
  onSelectMode: (mode: DashboardMainViewMode) => void;
  tableCount: number;
  dashboardCount: number;
}

export const DashboardModeNav: React.FC<DashboardModeNavProps> = ({
  currentMode,
  onSelectMode,
  tableCount,
  dashboardCount,
}) => {
  const modes: Array<{
    id: DashboardMainViewMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    {
      id: 'cockpit',
      label: '全景驾驶舱',
      icon: Database,
      badge: tableCount,
    },
    {
      id: 'analytics',
      label: '多维 BI 看板',
      icon: Layers,
      badge: dashboardCount,
    },
    {
      id: 'scratchpad',
      label: '即席算子与流水',
      icon: Zap,
    },
  ];

  return (
    <nav aria-label="仪表盘视图导航" className="flex items-center gap-1 border-b border-monokai-border/80 pb-2">
      {modes.map(mode => {
        const Icon = mode.icon;
        const isActive = currentMode === mode.id;

        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onSelectMode(mode.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold font-sans transition-all cursor-pointer ${
              isActive
                ? 'bg-monokai-elevated text-monokai-fg font-semibold border border-monokai-border shadow-xs'
                : 'text-monokai-fg-muted hover:bg-monokai-surface hover:text-monokai-fg border border-transparent'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-monokai-fg' : 'text-monokai-comment'}`} />
            <span>{mode.label}</span>
            {mode.badge !== undefined && (
              <span
                className={`ml-1 rounded-md px-1.5 py-0.2 font-mono text-2xs ${
                  isActive
                    ? 'bg-monokai-bg text-monokai-fg font-semibold border border-monokai-border'
                    : 'bg-monokai-surface text-monokai-comment border border-monokai-border'
                }`}
              >
                {mode.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
