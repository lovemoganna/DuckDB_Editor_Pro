import React from 'react';
import { Clock, Database, Bookmark, Trash2, Code2 } from 'lucide-react';
import { SqlEditorHistory } from './SqlEditorHistory';
import { TableTree } from '../TableTree';
import type { QueryHistoryItem, SavedQuery } from '../../types';
import { useSqlEditorStore } from '../../hooks/store/useSqlEditorStore';

interface SqlEditorSidebarProps {
  activeSidebarTab: 'schema' | 'history' | 'saved';
  setActiveSidebarTab: (tab: 'schema' | 'history' | 'saved') => void;
  history: QueryHistoryItem[];
  historyFilter: string;
  setHistoryFilter: (v: string) => void;
  onSelectQuery: (sql: string) => void;
  onClearHistory: () => void;
  savedQueries: SavedQuery[];
  onSelectSavedQuery: (sql: string) => void;
  onDeleteSavedQuery: (id: string) => void;
  onInsertCode: (code: string) => void;
}

export const SqlEditorSidebar: React.FC<SqlEditorSidebarProps> = ({
  activeSidebarTab,
  setActiveSidebarTab,
  history,
  historyFilter,
  setHistoryFilter,
  onSelectQuery,
  onClearHistory,
  savedQueries,
  onSelectSavedQuery,
  onDeleteSavedQuery,
  onInsertCode,
}) => {
  const schemaTree = useSqlEditorStore(state => state.schemaTree);

  return (
    <div className="w-64 border-r border-monokai-border bg-monokai-sidebar/80 flex flex-col shrink-0 overflow-hidden select-none">
      {/* Sidebar Tabs */}
      <div className="flex border-b border-monokai-border bg-monokai-sidebar shrink-0 p-1 gap-1">
        <button
          onClick={() => setActiveSidebarTab('schema')}
          className={`flex-1 py-1.5 px-2 text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-all rounded-md cursor-pointer ${
            activeSidebarTab === 'schema'
              ? 'bg-monokai-surface text-monokai-yellow shadow-xs'
              : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/50'
          }`}
        >
          <Database size={13} />
          <span>Schema</span>
        </button>
        <button
          onClick={() => setActiveSidebarTab('history')}
          className={`flex-1 py-1.5 px-2 text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-all rounded-md cursor-pointer ${
            activeSidebarTab === 'history'
              ? 'bg-monokai-surface text-monokai-yellow shadow-xs'
              : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/50'
          }`}
        >
          <Clock size={13} />
          <span>History</span>
        </button>
        <button
          onClick={() => setActiveSidebarTab('saved')}
          className={`flex-1 py-1.5 px-2 text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-all rounded-md cursor-pointer ${
            activeSidebarTab === 'saved'
              ? 'bg-monokai-surface text-monokai-yellow shadow-xs'
              : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/50'
          }`}
        >
          <Bookmark size={13} />
          <span>Saved</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden bg-monokai-bg">
        {activeSidebarTab === 'schema' && (
          <div className="h-full overflow-y-auto custom-scrollbar p-1">
            <TableTree tables={Object.keys(schemaTree)} onInsert={onInsertCode} />
          </div>
        )}
        {(activeSidebarTab === 'history' || activeSidebarTab === 'saved') && (
          <SqlEditorHistory
            activeSidebarTab={activeSidebarTab}
            history={history}
            savedQueries={savedQueries}
            historyFilter={historyFilter}
            onHistoryFilterChange={event => setHistoryFilter(event.target.value)}
            onClearHistory={onClearHistory}
            onHistoryItemClick={onSelectQuery}
            onSavedQueryClick={onSelectSavedQuery}
            onDeleteSavedQuery={(id) => onDeleteSavedQuery(id)}
          />
        )}
      </div>
    </div>
  );
};

