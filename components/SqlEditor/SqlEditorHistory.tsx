import React from 'react';
import { Clock, Save, X, Pin, Copy, Terminal, Search } from 'lucide-react';
import { QueryHistoryItem, SavedQuery } from '../../types';
import { highlightSql } from '../../utils';
import { toastService } from '../../services/toastService';

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

  const handleCopy = (sql: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sql);
    toastService.success('已复制 SQL 语句');
  };

  return (
    <>
      {activeSidebarTab === 'history' && (
        <div className="flex flex-col h-full bg-monokai-bg font-sans select-none">
          {/* Search & Actions Header */}
          <div className="p-2 border-b border-monokai-border/80 bg-monokai-surface/40 flex items-center gap-1.5 shrink-0">
            <div className="relative flex-1">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-monokai-comment pointer-events-none" />
              <input
                className="w-full bg-monokai-bg border border-monokai-border/80 rounded-md pl-6 pr-6 py-1 text-[11px] font-mono text-monokai-fg placeholder-monokai-comment/50 outline-none focus:border-monokai-accent focus:ring-1 focus:ring-monokai-accent/30 transition-all"
                placeholder="搜索历史查询..."
                value={historyFilter}
                onChange={onHistoryFilterChange}
              />
              {historyFilter && (
                <button
                  onClick={() => onHistoryFilterChange({ target: { value: '' } } as any)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-monokai-comment hover:text-monokai-fg p-0.5 cursor-pointer"
                  title="清空搜索"
                >
                  <X size={11} />
                </button>
              )}
            </div>
            <button
              onClick={onClearHistory}
              className="text-[10px] text-monokai-comment hover:text-monokai-pink font-bold font-mono px-2 py-1 rounded bg-monokai-surface/60 hover:bg-monokai-surface transition-colors cursor-pointer shrink-0"
              title="清空所有执行历史"
            >
              清空
            </button>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredHistory.length === 0 && (
              <div className="p-8 text-center space-y-2">
                <Clock size={22} className="mx-auto text-monokai-comment/25" />
                <div className="text-xs text-monokai-comment italic font-mono">
                  {historyFilter ? '未找到匹配的历史查询' : '暂无查询历史'}
                </div>
              </div>
            )}
            {filteredHistory.map(item => (
              <div
                key={item.id}
                onClick={() => onHistoryItemClick(item.sql)}
                className="px-2.5 py-2 border-b border-monokai-border/30 cursor-pointer hover:bg-monokai-surface/60 border-l-2 border-transparent hover:border-monokai-border-strong group transition-all relative"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[8.5px] font-bold font-mono px-1.5 py-0.5 rounded-xs ${
                        item.status === 'success'
                          ? 'bg-monokai-green/15 text-monokai-green border border-monokai-border'
                          : 'bg-monokai-pink/15 text-monokai-pink border border-monokai-border'
                      }`}
                    >
                      {item.status === 'success' ? 'OK' : 'ERR'}
                    </span>
                    {item.executionTime && (
                      <span className="text-[9px] font-mono text-monokai-comment/70 tabular-nums">
                        {item.executionTime.toFixed(0)}ms
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-monokai-comment/60 tabular-nums">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    {/* Hover action buttons */}
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-1 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => handleCopy(item.sql, e)}
                        className="p-1 rounded text-monokai-comment hover:text-monokai-fg bg-monokai-surface border border-monokai-border/60 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        title="复制 SQL"
                      >
                        <Copy size={10} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onHistoryItemClick(item.sql);
                          toastService.info('已载入历史 SQL 到编辑器');
                        }}
                        className="p-1 rounded text-monokai-comment hover:text-monokai-yellow bg-monokai-surface border border-monokai-border/60 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        title="载入到编辑器"
                      >
                        <Terminal size={10} />
                      </button>
                    </div>
                  </div>
                </div>
                <div
                  className="text-[10px] font-mono text-monokai-fg/80 line-clamp-2 leading-relaxed bg-monokai-bg/60 p-1.5 rounded border border-monokai-border/40 transition-colors"
                  dangerouslySetInnerHTML={{ __html: highlightSql(item.sql) }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSidebarTab === 'saved' && (
        <div className="flex flex-col h-full bg-monokai-bg font-sans select-none">
          <div className="p-2 border-b border-monokai-border/80 flex items-center justify-between bg-monokai-surface/40 shrink-0">
            <span className="text-[10.5px] font-mono text-monokai-comment font-bold flex items-center gap-1.5">
              <Pin size={11} className="text-monokai-yellow" /> SQL 收藏夹
            </span>
            <span className="text-[9.5px] font-mono bg-monokai-surface border border-monokai-border/60 px-1.5 py-0.5 rounded text-monokai-yellow font-bold tabular-nums">
              {savedQueries.length} 项
            </span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {savedQueries.length === 0 && (
              <div className="p-8 text-center space-y-2">
                <Save size={22} className="mx-auto text-monokai-comment/25" />
                <div className="text-xs text-monokai-comment italic font-mono">暂无已存查询</div>
              </div>
            )}
            {savedQueries.map(item => (
              <div
                key={item.id}
                onClick={() => onSavedQueryClick(item.sql)}
                className="px-2.5 py-2 border-b border-monokai-border/30 cursor-pointer hover:bg-monokai-surface/60 border-l-2 border-transparent hover:border-monokai-border-strong group transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Pin size={10} className="text-monokai-yellow shrink-0" />
                    <span className="text-[11px] font-mono font-bold text-monokai-fg truncate group-hover:text-monokai-yellow transition-colors">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleCopy(item.sql, e)}
                      className="p-1 rounded text-monokai-comment hover:text-monokai-fg bg-monokai-surface border border-monokai-border/60 opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-95 cursor-pointer transition-all"
                      title="复制 SQL"
                    >
                      <Copy size={10} />
                    </button>
                    <button
                      onClick={(e) => onDeleteSavedQuery(item.id, e)}
                      className="p-1 rounded text-monokai-comment hover:text-monokai-pink bg-monokai-surface border border-monokai-border/60 opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-95 cursor-pointer transition-all"
                      title="删除已存查询"
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
                <div
                  className="text-[9.5px] font-mono text-monokai-comment/80 line-clamp-1 leading-relaxed bg-monokai-bg/60 p-1.5 rounded border border-monokai-border/40"
                  dangerouslySetInnerHTML={{ __html: highlightSql(item.sql) }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

