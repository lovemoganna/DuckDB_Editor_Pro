import React from 'react';
import {
  Terminal,
  TerminalSquare,
  Pin,
  Play,
  Copy,
} from 'lucide-react';
import { renderMonokaiSql } from './sqlHighlight';
import { PinnedQueryItem, RecentActivityItem } from './types';

interface TelemetryActivityStreamProps {
  recentActivity: RecentActivityItem[];
  pinnedQueries: PinnedQueryItem[];
  onRunHistoricalQuery: (sql: string) => void;
  onCopyQuery: (sql: string, event: React.MouseEvent) => void;
  onNavigateToHistory: () => void;
}

export const TelemetryActivityStream: React.FC<TelemetryActivityStreamProps> = ({
  recentActivity,
  pinnedQueries,
  onRunHistoricalQuery,
  onCopyQuery,
  onNavigateToHistory,
}) => {
  return (
    <div className="flex flex-col rounded-md border border-monokai-border bg-monokai-surface overflow-hidden font-sans">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-monokai-border bg-monokai-elevated">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-monokai-cyan" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-monokai-fg">
            最近查询与收藏
          </h3>
        </div>
        <button
          type="button"
          onClick={onNavigateToHistory}
          className="font-mono text-meta text-monokai-comment hover:text-monokai-cyan transition-colors cursor-pointer"
        >
          查看全部 →
        </button>
      </div>

      {recentActivity.length === 0 && pinnedQueries.length === 0 ? (
        <div className="flex h-28 flex-col items-center justify-center p-4 text-center text-xs text-monokai-comment">
          <TerminalSquare className="h-5 w-5 text-monokai-comment mb-1" />
          <p className="text-monokai-fg-muted font-medium">暂无即席查询记录</p>
        </div>
      ) : (
        <div className="max-h-[220px] overflow-y-auto custom-scrollbar divide-y divide-monokai-border/50">
          {/* Pinned queries first */}
          {pinnedQueries.map(query => (
            <div
              key={query.id}
              role="button"
              tabIndex={0}
              title={query.sql || query.name}
              onClick={() => onRunHistoricalQuery(query.sql || query.name)}
              onKeyDown={e => {
                if (e.key === 'Enter') onRunHistoricalQuery(query.sql || query.name);
              }}
              className="group flex h-9 items-center justify-between px-3 text-xs hover:bg-monokai-elevated transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Pin className="h-3.5 w-3.5 shrink-0 text-monokai-yellow" aria-hidden="true" />
                <span className="font-semibold text-monokai-fg text-xs shrink-0">
                  {query.name}
                </span>
                {query.sql && (
                  <span className="min-w-0 truncate">
                    {renderMonokaiSql(query.sql)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pl-2 shrink-0">
                <button
                  type="button"
                  onClick={e => onCopyQuery(query.sql || query.name, e)}
                  title="复制 SQL"
                  aria-label="复制 SQL"
                  className="rounded p-1 text-monokai-comment hover:text-monokai-fg"
                >
                  <Copy className="h-3 w-3" />
                </button>
                <span className="flex items-center gap-1 text-meta text-monokai-cyan font-mono">
                  运行 <Play className="h-2.5 w-2.5 fill-current" />
                </span>
              </div>
            </div>
          ))}

          {/* Recent query stream */}
          {recentActivity.map(item => {
            const isSuccess = item.status !== 'error';
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                title={item.sql}
                onClick={() => onRunHistoricalQuery(item.sql)}
                onKeyDown={e => {
                  if (e.key === 'Enter') onRunHistoricalQuery(item.sql);
                }}
                className="group flex h-9 items-center justify-between px-3 text-xs hover:bg-monokai-elevated transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      isSuccess ? 'bg-monokai-green' : 'bg-monokai-pink'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">{renderMonokaiSql(item.sql)}</div>
                </div>

                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pl-2 shrink-0">
                  <button
                    type="button"
                    onClick={e => onCopyQuery(item.sql, e)}
                    title="复制 SQL"
                    aria-label="复制 SQL"
                    className="rounded p-1 text-monokai-comment hover:text-monokai-fg"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <span className="flex items-center gap-1 text-meta text-monokai-cyan font-mono">
                    运行 <Play className="h-2.5 w-2.5 fill-current" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
