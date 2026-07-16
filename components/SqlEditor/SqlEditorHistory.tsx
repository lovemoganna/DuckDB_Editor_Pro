import React from 'react';
import { Clock, Save, X, Pin } from 'lucide-react';
import { QueryHistoryItem, SavedQuery } from '../../types';
import { highlightSql } from '../../utils';

export interface SqlEditorHistoryProps {
  activeSidebarTab: 'history' | 'saved' | 'schema' | 'help';
  history: QueryHistoryItem[];
  savedQueries: SavedQuery[];
  historyFilter: string;
  onHistoryFilterChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearHistory: () => void;
  onHistoryItemClick: (sql: string) => void;
  onSavedQueryClick: (sql: string) => void;
  onDeleteSavedQuery: (id: string, e: React.MouseEvent) => void;
}

export const SqlEditorHistory: React.FC<SqlEditorHistoryProps> = ({
  activeSidebarTab,
  history,
  savedQueries,
  historyFilter,
  onHistoryFilterChange,
  onClearHistory,
  onHistoryItemClick,
  onSavedQueryClick,
  onDeleteSavedQuery,
}) => {
  const filteredHistory = historyFilter
    ? history.filter(item => item.sql.toLowerCase().includes(historyFilter.toLowerCase()))
    : history;

  return (
    <>
      {activeSidebarTab === 'history' && (
        <div className="flex flex-col h-full">
          <div className="px-2 pt-2 pb-1 border-b border-monokai-accent/30 flex items-center gap-2">
            <input
              className="flex-1 bg-monokai-bg border border-monokai-accent/40 rounded px-2 py-1 text-[10px] text-monokai-fg outline-none focus:border-monokai-accent transition-colors"
              placeholder="Filter history..."
              value={historyFilter}
              onChange={onHistoryFilterChange}
            />
            <button onClick={onClearHistory} className="text-[9px] text-monokai-amethyst/70 hover:text-monokai-amethyst uppercase font-bold tracking-wider shrink-0">Clear</button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredHistory.length === 0 && (
              <div className="p-6 text-center">
                <Clock size={20} className="mx-auto mb-2 text-monokai-comment/20" />
                <div className="text-[10px] text-monokai-comment/40 italic">No query history</div>
              </div>
            )}
            {filteredHistory.map(item => (
              <div key={item.id} onClick={() => onHistoryItemClick(item.sql)} className="px-2 py-2 border-b border-monokai-accent/20 cursor-pointer hover:bg-monokai-surface/60 group transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded-sm ${item.status === 'success'
                    ? 'bg-monokai-green/10 text-monokai-green border border-monokai-green/20'
                    : 'bg-monokai-pink/10 text-monokai-pink border border-monokai-pink/20'
                  }`}>
                    {item.status === 'success' ? 'OK' : 'ERR'}
                  </span>
                  <div className="flex items-center gap-1.5 text-[9px] text-monokai-comment/40">
                     {item.executionTime && <span>{item.executionTime.toFixed(0)}ms</span>}
                     <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-monokai-fg/60 line-clamp-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: highlightSql(item.sql) }} />
              </div>
            ))}
          </div>
        </div>
      )}
      {activeSidebarTab === 'saved' && (
        <div className="flex flex-col h-full">
          <div className="px-2 pt-2 pb-1 border-b border-monokai-accent/30 flex items-center justify-between">
            <span className="text-[9px] text-monokai-comment/40 italic">tap to load SQL</span>
            <span className="text-[9px] text-monokai-comment/30">{savedQueries.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {savedQueries.length === 0 && (
              <div className="p-6 text-center">
                <Save size={20} className="mx-auto mb-2 text-monokai-comment/20" />
                <div className="text-[10px] text-monokai-comment/40 italic">No saved queries</div>
              </div>
            )}
            {savedQueries.map(item => (
              <div key={item.id} onClick={() => onSavedQueryClick(item.sql)} className="px-2 py-2 border-b border-monokai-accent/20 cursor-pointer hover:bg-monokai-surface/60 group transition-colors">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1 min-w-0">
                    <Pin size={9} className="text-monokai-yellow shrink-0" />
                    <span className="text-[10px] font-semibold text-monokai-green truncate">{item.name}</span>
                  </div>
                  <button onClick={(e) => onDeleteSavedQuery(item.id, e)} className="shrink-0 text-monokai-comment/30 hover:text-monokai-pink transition-colors opacity-0 group-hover:opacity-100">
                    <X size={10} />
                  </button>
                </div>
                <div className="text-[9px] font-mono text-monokai-comment/50 line-clamp-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: highlightSql(item.sql) }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
