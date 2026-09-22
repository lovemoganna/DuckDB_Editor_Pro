import React from 'react';
import { QueryHistoryItem } from '../../types';
import { CheckCircle2, XCircle, Zap, Star, Copy, Play, Check, Eye, Trash2 } from 'lucide-react';
import { highlightSql } from '../../utils';

interface HistoryCardViewProps {
  items: QueryHistoryItem[];
  copiedId: string | null;
  selectedId: string | null;
  onSelect: (item: QueryHistoryItem) => void;
  onCopy: (sql: string, id: string, e?: React.MouseEvent) => void;
  onLoadAndRun: (sql: string, e?: React.MouseEvent) => void;
  onToggleStar: (id: string, e?: React.MouseEvent) => void;
  onDelete: (id: string, e?: React.MouseEvent) => void;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return '刚刚';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return '昨天';
  return `${days} 天前`;
}

function fmtMs(ms: number): string {
  if (ms === 0) return '0ms';
  if (ms < 1) return '<1ms';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

export const HistoryCardView: React.FC<HistoryCardViewProps> = ({
  items,
  copiedId,
  selectedId,
  onSelect,
  onCopy,
  onLoadAndRun,
  onToggleStar,
  onDelete,
}) => {
  return (
    <div className="space-y-3 max-w-6xl mx-auto font-sans">
      {items.map((item, idx) => {
        const itemId = item.id || String(idx);
        const isSuccess = item.status === 'success';
        const isCopied = copiedId === itemId;
        const isSelected = selectedId === itemId;
        const isSlow = (item.executionTime || 0) >= 1000;

        return (
          <article
            key={itemId}
            onClick={() => onSelect(item)}
            className={`group relative flex flex-col justify-between rounded-md border transition-all shadow-xs p-3.5 space-y-2.5 cursor-pointer ${
              isSelected
                ? 'border-monokai-border-strong bg-monokai-surface'
                : 'border-monokai-border bg-monokai-surface/60 hover:border-monokai-border-strong hover:bg-monokai-surface'
            }`}
          >
            {/* Top Bar: Status + Time + Latency + Star */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div
                  className={`shrink-0 px-2 py-0.5 rounded-md font-mono text-[10.5px] font-medium flex items-center gap-1 bg-monokai-bg border border-monokai-border ${
                    isSuccess
                      ? 'text-monokai-green'
                      : 'text-monokai-pink'
                  }`}
                >
                  {isSuccess ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  <span>{isSuccess ? 'SUCCESS' : 'ERROR'}</span>
                </div>

                <span className="text-[11px] text-monokai-comment font-mono">
                  {timeAgo(item.timestamp)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Latency badge */}
                <span
                  className={`font-mono text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1 bg-monokai-bg border border-monokai-border ${
                    isSlow
                      ? 'text-monokai-pink font-medium'
                      : 'text-monokai-comment'
                  }`}
                >
                  <Zap size={11} className={isSlow ? 'text-monokai-pink' : 'text-monokai-comment'} />
                  <span>{fmtMs(item.executionTime ?? 0)}</span>
                </span>

                {/* Star Button */}
                <button
                  type="button"
                  onClick={(e) => onToggleStar(itemId, e)}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    item.isStarred
                      ? 'text-monokai-yellow hover:bg-monokai-hover'
                      : 'text-monokai-comment/50 hover:text-monokai-yellow hover:bg-monokai-hover'
                  }`}
                  title={item.isStarred ? '取消收藏' : '收藏此查询'}
                >
                  <Star size={14} className={item.isStarred ? 'fill-monokai-yellow' : ''} />
                </button>
              </div>
            </div>

            {/* Monospace Code Preview Box */}
            <div
              className="rounded-md border border-monokai-border bg-monokai-bg px-3.5 py-2.5 font-mono text-xs text-monokai-fg/90 line-clamp-3 leading-relaxed hover:border-monokai-border-strong transition-colors select-text break-all"
              dangerouslySetInnerHTML={{ __html: highlightSql(item.sql) }}
            />

            {/* Error snippet if available */}
            {item.error && (
              <div className="rounded-md border border-monokai-border bg-monokai-bg px-2.5 py-1 text-[11px] font-mono text-monokai-pink line-clamp-1">
                ⚠️ 错误: {item.error}
              </div>
            )}

            {/* Bottom Action Strip */}
            <div className="flex items-center justify-between pt-1 border-t border-monokai-border/40 text-xs">
              <span className="text-[10px] text-monokai-comment font-mono">
                {new Date(item.timestamp).toLocaleString('zh-CN')}
              </span>

              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                {/* Detail View */}
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className="h-7 inline-flex items-center gap-1 px-2.5 rounded-md text-xs font-sans text-monokai-comment hover:text-monokai-fg hover:bg-monokai-hover transition-colors cursor-pointer border border-monokai-border"
                  title="查看详情分析"
                >
                  <Eye size={12} className="text-monokai-comment" />
                  <span>详情</span>
                </button>

                {/* Copy */}
                <button
                  type="button"
                  onClick={(e) => onCopy(item.sql, itemId, e)}
                  className="h-7 inline-flex items-center gap-1 px-2.5 rounded-md text-xs font-sans text-monokai-comment hover:text-monokai-fg hover:bg-monokai-hover transition-colors cursor-pointer border border-monokai-border"
                  title="复制 SQL 语句"
                >
                  {isCopied ? <Check size={12} className="text-monokai-green" /> : <Copy size={12} />}
                  <span>{isCopied ? '已复制' : '复制'}</span>
                </button>

                {/* Load and Run */}
                <button
                  type="button"
                  onClick={(e) => onLoadAndRun(item.sql, e)}
                  className="h-7 inline-flex items-center gap-1 px-2.5 rounded-md text-xs font-sans font-medium bg-monokai-green text-monokai-bg hover:brightness-105 transition-colors cursor-pointer"
                  title="在 SQL 编辑器中载入并运行"
                >
                  <Play size={11} fill="currentColor" />
                  <span>载入运行</span>
                </button>

                {/* Delete Item */}
                <button
                  type="button"
                  onClick={(e) => onDelete(itemId, e)}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md text-monokai-comment/50 hover:text-monokai-pink hover:bg-monokai-hover transition-colors cursor-pointer border border-transparent hover:border-monokai-border ml-1"
                  title="删除单条历史记录"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
};
