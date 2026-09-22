import React from 'react';
import { Settings, User, Terminal } from 'lucide-react';
import { ActionButton, IconButton } from '../ui/Workbench';

interface DataAssetHeaderProps {
  version?: string;
  tableCount?: number;
  onOpenCreateTable: () => void;
  onOpenImport: () => void;
  onNavigateToSql: () => void;
  onOpenSettings: () => void;
}

export const DataAssetHeader: React.FC<DataAssetHeaderProps> = ({
  onOpenCreateTable,
  onOpenImport,
  onNavigateToSql,
  onOpenSettings,
}) => {
  return (
    <header className="flex h-12 items-center justify-between bg-monokai-bg px-6 font-sans select-none shrink-0 z-30 border-b border-monokai-border">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-3.5 w-3.5 rounded-full bg-monokai-yellow shrink-0 shadow-xs ring-2 ring-monokai-yellow/20" />
          <span className="font-bold text-sm tracking-tight text-monokai-fg">
            DuckDB Studio
          </span>
        </div>
        <div className="h-3 w-px bg-monokai-border" />
        <span className="text-xs text-monokai-comment font-normal">
          数据资产仪表盘
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs font-sans">
        <ActionButton variant="ghost" size="sm" onClick={onOpenCreateTable}>
          新建表
        </ActionButton>

        <ActionButton variant="ghost" size="sm" onClick={onOpenImport}>
          导入数据
        </ActionButton>

        <ActionButton
          variant="secondary"
          size="sm"
          icon={Terminal}
          onClick={onNavigateToSql}
          className="!bg-monokai-yellow !text-monokai-bg font-bold hover:!bg-monokai-yellow/90 ml-1"
        >
          打开 SQL 工作台
        </ActionButton>

        <div className="h-3.5 w-px bg-monokai-border-subtle mx-1" />

        <IconButton
          label="设置"
          icon={Settings}
          tone="neutral"
          size="sm"
          onClick={onOpenSettings}
        />

        <button
          type="button"
          onClick={onOpenSettings}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-monokai-elevated text-monokai-fg-muted hover:text-monokai-fg hover:bg-monokai-hover ring-1 ring-monokai-border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70 focus-visible:ring-offset-1 focus-visible:ring-offset-monokai-bg"
          title="用户中心"
          aria-label="用户中心"
        >
          <User className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
};
