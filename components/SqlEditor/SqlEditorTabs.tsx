import React from 'react';
import { X, Plus } from 'lucide-react';
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
    <div className="flex items-end bg-monokai-surface pt-2 px-2 gap-1 overflow-x-auto scrollbar-hide border-b border-monokai-accent">
      {tabs.map(tab => {
        const isActive = activeTabId === tab.id;
        return (
          <div
            key={tab.id}
            className={`group relative flex items-center gap-2 px-4 py-2 text-xs cursor-pointer min-w-[140px] max-w-[200px] select-none transition-all rounded-t-md border-t border-l border-r ${isActive ? 'bg-monokai-bg border-monokai-accent z-10 text-monokai-fg font-bold' : 'bg-monokai-sidebar border-transparent text-monokai-comment hover:bg-monokai-accent'}`}
            onClick={() => onTabClick(tab.id)}
            onDoubleClick={() => onTabDoubleClick(tab)}
          >
            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-monokai-green' : 'bg-monokai-comment/30'}`}></div>
            {editingTitleId === tab.id ? (
              <input
                autoFocus
                value={tempTitle}
                onChange={onTitleChange}
                onBlur={onTitleSave}
                onKeyDown={onTitleKeyDown}
                className="bg-transparent text-monokai-fg outline-none w-full"
              />
            ) : (
              <span className="truncate flex-1">{tab.title}</span>
            )}
            <button onClick={(e) => onCloseTab(tab.id, e)} className="opacity-0 group-hover:opacity-100 hover:text-monokai-pink font-bold ml-1">×</button>
            {isActive && <div className="absolute bottom-[-1px] left-0 right-0 h-1 bg-monokai-bg z-20"></div>}
          </div>
        );
      })}
      <button onClick={onCreateTab} className="px-3 py-1.5 text-monokai-comment hover:text-monokai-fg font-bold text-lg opacity-50 hover:opacity-100 transition-opacity h-[29px] flex items-end">
        +
      </button>
    </div>
  );
};
