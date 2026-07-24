import React from 'react';
import { Clock, Database, Bookmark } from 'lucide-react';
import { SqlEditorHistory } from './SqlEditorHistory';
import { TableTree } from '../TableTree';
import type { QueryHistoryItem, SavedQuery } from '../../types';

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
  return (
    <div className="w-64 border-r border-monokai-accent/30 bg-monokai-bg flex flex-col shrink-0 overflow-hidden">
      {/* Sidebar Tabs */}
      <div className="flex border-b border-monokai-accent/30 bg-monokai-surface shrink-0">
        <button
          onClick={() => setActiveSidebarTab('schema')}
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeSidebarTab === 'schema'
              ? 'border-monokai-yellow text-monokai-yellow bg-monokai-bg'
              : 'border-transparent text-monokai-comment hover:text-monokai-fg'
          }`}
        >
          <Database size={13} />
          <span>Schema</span>
        </button>
        <button
          onClick={() => setActiveSidebarTab('history')}
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeSidebarTab === 'history'
              ? 'border-monokai-yellow text-monokai-yellow bg-monokai-bg'
              : 'border-transparent text-monokai-comment hover:text-monokai-fg'
          }`}
        >
          <Clock size={13} />
          <span>History</span>
        </button>
        <button
          onClick={() => setActiveSidebarTab('saved')}
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeSidebarTab === 'saved'
              ? 'border-monokai-yellow text-monokai-yellow bg-monokai-bg'
              : 'border-transparent text-monokai-comment hover:text-monokai-fg'
          }`}
        >
          <Bookmark size={13} />
          <span>Saved</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeSidebarTab === 'schema' && (
          <div className="h-full overflow-y-auto">
            <TableTree onSelectTable={(name) => onInsertCode(`SELECT * FROM ${name} LIMIT 10;`)} />
          </div>
        )}
        {activeSidebarTab === 'history' && (
          <SqlEditorHistory
            history={history}
            historyFilter={historyFilter}
            setHistoryFilter={setHistoryFilter}
            onSelectQuery={onSelectQuery}
            onClearHistory={onClearHistory}
          />
        )}
        {activeSidebarTab === 'saved' && (
          <div className="h-full overflow-y-auto p-2 space-y-2">
            {savedQueries.length === 0 ? (
              <div className="text-xs text-monokai-comment p-4 text-center">No saved queries</div>
            ) : (
              savedQueries.map((sq) => (
                <div
                  key={sq.id}
                  onClick={() => onSelectSavedQuery(sq.sql)}
                  className="p-2 bg-monokai-surface hover:bg-monokai-accent/30 rounded border border-monokai-accent/30 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center justify-between font-medium text-xs text-monokai-fg mb-1">
                    <span>{sq.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSavedQuery(sq.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-monokai-pink text-[10px] hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="text-[11px] font-mono text-monokai-comment truncate">{sq.sql}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
