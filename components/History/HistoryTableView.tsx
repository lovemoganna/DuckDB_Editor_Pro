import React from 'react';
import { QueryHistoryItem } from '../../types';
import { CheckCircle2, XCircle, Zap, Star, Copy, Play, Check, Eye, Trash2 } from 'lucide-react';
import { highlightSql } from '../../utils';

interface HistoryTableViewProps {
  items: QueryHistoryItem[];
  copiedId: string | null;
  selectedId: string | null;
  onSelect: (item: QueryHistoryItem) => void;
  onCopy: (sql: string, id: string, e?: React.MouseEvent) => void;
  onLoadAndRun: (sql: string, e?: React.MouseEvent) => void;
  onToggleStar: (id: string, e?: React.MouseEvent) => void;
  onDelete: (id: string, e?: React.MouseEvent) => void;
}

function fmtMs(ms: number): string {
  if (ms === 0) return '0ms';
  if (ms < 1) return '<1ms';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

export const HistoryTableView: React.FC<HistoryTableViewProps> = ({
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
    <div className="max-w-6xl mx-auto rounded-md border border-monokai-border bg-monokai-sidebar overflow-hidden font-sans shadow-xs">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-monokai-border bg-monokai-surface text-[11px] font-medium text-monokai-comment select-none">
              <th className="py-2.5 px-3 w-12 text-center">收藏</th>
              <th className="py-2.5 px-3 w-24">状态</th>
              <th className="py-2.5 px-4 min-w-[300px]">SQL 查询语句</th>
              <th className="py-2.5 px-3 w-28 text-right">耗时</th>
              <th className="py-2.5 px-4 w-40">执行时间</th>
              <th className="py-2.5 px-3 w-36 text-right">快捷操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-monokai-border/40 text-xs">
            {items.map((item, idx) => {
              const itemId = item.id || String(idx);
              const isSuccess = item.status === 'success';
              const isCopied = copiedId === itemId;
              const isSelected = selectedId === itemId;
              const isSlow = (item.executionTime || 0) >= 1000;

              return (
                <tr
                  key={itemId}
                  onClick={() => onSelect(item)}
                  className={`group transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-monokai-hover text-monokai-fg'
                      : 'hover:bg-monokai-surface/60'
                  }`}
                >
                  <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => onToggleStar(itemId, e)}
                      className={`p-1 rounded-md transition-colors cursor-pointer ${
                        item.isStarred
                          ? 'text-monokai-yellow hover:bg-monokai-hover'
                          : 'text-monokai-comment/40 hover:text-monokai-yellow hover:bg-monokai-hover'
                      }`}
                      title={item.isStarred ? '取消收藏' : '收藏此查询'}
                    >
                      <Star size={13} className={item.isStarred ? 'fill-monokai-yellow' : ''} />
                    </button>
                  </td>

                  <td className="py-2 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono text-[10px] font-medium bg-monokai-bg border border-monokai-border ${
                        isSuccess
                          ? 'text-monokai-green'
                          : 'text-monokai-pink'
                      }`}
                    >
                      {isSuccess ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                      <span>{isSuccess ? 'SUCCESS' : 'ERROR'}</span>
                    </span>
                  </td>

                  <td className="py-2 px-4 font-mono text-[11px] text-monokai-fg/90">
                    <div
                      className="line-clamp-1 truncate max-w-md"
                      dangerouslySetInnerHTML={{ __html: highlightSql(item.sql) }}
                    />
                  </td>

                  <td className="py-2 px-3 text-right font-mono text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 ${
                        isSlow
                          ? 'text-monokai-pink font-semibold'
                          : 'text-monokai-comment'
                      }`}
                    >
                      <Zap size={10} className={isSlow ? 'text-monokai-pink' : 'text-monokai-comment'} />
                      <span>{fmtMs(item.executionTime ?? 0)}</span>
                    </span>
                  </td>

                  <td className="py-2 px-4 font-mono text-[10.5px] text-monokai-comment">
                    {new Date(item.timestamp).toLocaleString('zh-CN')}
                  </td>

                  <td className="py-2 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => onSelect(item)}
                        className="p-1 rounded-md text-monokai-comment hover:text-monokai-fg hover:bg-monokai-hover transition-colors cursor-pointer"
                        title="查看详情"
                      >
                        <Eye size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => onCopy(item.sql, itemId, e)}
                        className="p-1 rounded-md text-monokai-comment hover:text-monokai-fg hover:bg-monokai-hover transition-colors cursor-pointer"
                        title="复制 SQL"
                      >
                        {isCopied ? <Check size={13} className="text-monokai-green" /> : <Copy size={13} />}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => onLoadAndRun(item.sql, e)}
                        className="p-1 rounded-md text-monokai-green hover:bg-monokai-hover transition-colors cursor-pointer"
                        title="载入并运行"
                      >
                        <Play size={13} className="fill-monokai-green" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => onDelete(itemId, e)}
                        className="p-1 rounded-md text-monokai-comment/50 hover:text-monokai-pink hover:bg-monokai-hover transition-colors cursor-pointer"
                        title="删除记录"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
