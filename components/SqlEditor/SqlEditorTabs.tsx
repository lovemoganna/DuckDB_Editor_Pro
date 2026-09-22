import React from 'react';
import { X, Plus, FileCode } from 'lucide-react';
import { SqlTab } from '../../types';

export interface SqlEditorTabsProps {
  tabs: SqlTab[];
  activeTabId: string;
  editingTitleId: string | null;
  tempTitle: string;
  onTabClick: (tabId: string) => void;
  onTabDoubleClick: (tab: SqlTab) => void;
  onCloseTab: (tabId: string, e: React.MouseEvent) => void;
  onCreateTab: () => void;
  onTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTitleSave: () => void;
  onTitleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const SqlEditorTabs: React.FC<SqlEditorTabsProps> = ({
  tabs,
  activeTabId,
  editingTitleId,
  tempTitle,
  onTabClick,
  onTabDoubleClick,
  onCloseTab,
  onCreateTab,
  onTitleChange,
  onTitleSave,
  onTitleKeyDown,
}) => {
  return (
    <div
      aria-label="SQL Editor Tabs"
      className="h-8 flex items-stretch bg-monokai-sidebar px-2 gap-1 overflow-x-auto custom-scrollbar border-b border-monokai-border/70 select-none shrink-0"
    >
      {tabs.map(tab => {
        const isActive = activeTabId === tab.id;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`group relative flex items-center gap-2 px-3 text-xs cursor-pointer min-w-[120px] max-w-[240px] transition-all duration-150 rounded-t-lg border-t-2 ${
              isActive
                ? 'bg-monokai-bg text-monokai-fg font-medium z-10 shadow-xs border-monokai-border-strong'
                : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60 border-transparent'
            }`}
            onClick={() => onTabClick(tab.id)}
            onDoubleClick={() => onTabDoubleClick(tab)}
          >
            <FileCode size={13} className={`shrink-0 transition-colors ${isActive ? 'text-monokai-yellow' : 'text-monokai-comment/60 group-hover:text-monokai-comment'}`} />
            {editingTitleId === tab.id ? (
              <input
                autoFocus
                value={tempTitle}
                aria-label="Tab title"
                placeholder="标签名称"
                onFocus={e => e.target.select()}
                onChange={onTitleChange}
                onBlur={onTitleSave}
                onKeyDown={onTitleKeyDown}
                onClick={e => e.stopPropagation()}
                className="bg-monokai-surface text-monokai-fg border border-monokai-border px-1.5 py-0.5 rounded outline-none w-full text-xs font-mono font-medium focus:ring-1 focus:ring-monokai-accent/30"
              />
            ) : (
              <span className="truncate flex-1 font-mono text-[11px] leading-tight" title={`${tab.title} (双击重命名)`}>
                {tab.title}
              </span>
            )}

            {tabs.length > 1 && (
              <button
                type="button"
                onClick={e => onCloseTab(tab.id, e)}
                className="opacity-0 group-hover:opacity-100 hover:bg-monokai-pink/20 hover:text-monokai-pink text-monokai-comment p-0.5 rounded transition-all cursor-pointer shrink-0 ml-auto"
                title="关闭标签页"
                aria-label="关闭标签页"
              >
                <X size={12} />
              </button>
            )}
            {isActive && <div className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-monokai-bg z-20" />}
          </div>
        );
      })}

      {/* New Tab Button */}
      <button
        type="button"
        onClick={onCreateTab}
        className="self-center h-6.5 w-6.5 ml-1 text-monokai-comment hover:text-monokai-yellow hover:bg-monokai-surface/80 rounded-md transition-all duration-150 cursor-pointer flex items-center justify-center shrink-0 active:scale-95 border border-transparent hover:border-monokai-border/60"
        title="新建 SQL 标签页"
        aria-label="新建 SQL 标签页"
      >
        <Plus size={13} />
      </button>
    </div>
  );
};
