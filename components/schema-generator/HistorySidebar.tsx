import React from 'react';
import { FolderOpen, X, Trash2, Database, Table2, Clock, Play } from 'lucide-react';
import { SavedAnalysis } from '../../types';

interface HistorySidebarProps {
  history: SavedAnalysis[];
  onClose: () => void;
  onLoadAnalysis: (analysis: SavedAnalysis) => void;
  onDeleteAnalysis: (id: string) => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  history,
  onClose,
  onLoadAnalysis,
  onDeleteAnalysis
}) => {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex backdrop-blur-xs animate-in fade-in duration-200">
      <div className="ml-auto w-96 max-w-full bg-monokai-sidebar h-full shadow-2xl overflow-y-auto border-l border-monokai-border flex flex-col custom-scrollbar">
        <div className="sticky top-0 bg-monokai-sidebar border-b border-monokai-border px-4 py-3.5 flex items-center justify-between z-10 shrink-0">
          <h3 className="text-sm font-bold text-monokai-fg flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-monokai-yellow" />
            <span>分析历史</span>
            <span className="text-[10px] text-monokai-comment font-mono ml-1">({history.length})</span>
          </h3>
          <button
            onClick={onClose}
            className="text-monokai-comment hover:text-monokai-fg transition-colors p-1 rounded-md hover:bg-monokai-surface"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex-1 bg-monokai-bg">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-monokai-comment py-12">
              <div className="w-12 h-12 rounded-full bg-monokai-surface flex items-center justify-center mb-3 border border-monokai-border">
                <FolderOpen className="w-6 h-6 text-monokai-comment/60" />
              </div>
              <p className="text-xs font-medium text-monokai-fg">暂无分析历史</p>
              <p className="text-[10px] mt-1 text-monokai-comment">完成 Schema 分析后将在此处保存历史</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((analysis) => (
                <div key={analysis.id} className="bg-monokai-surface rounded-xl p-3.5 border border-monokai-border hover:border-monokai-accent/60 transition-all shadow-xs group">
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-mono font-bold text-monokai-fg truncate group-hover:text-monokai-accent transition-colors">{analysis.fileName}</h4>
                      <p className="text-[10px] text-monokai-comment mt-0.5 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(analysis.timestamp)}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => onDeleteAnalysis(analysis.id)}
                      className="text-monokai-comment hover:text-monokai-pink p-1 rounded hover:bg-monokai-bg transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="删除分析记录"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3 text-xs bg-monokai-bg/60 p-2 rounded-lg border border-monokai-border/60 font-mono">
                    <div>
                      <span className="text-[10px] text-monokai-comment block">数据行数</span>
                      <span className="font-medium text-monokai-fg">{analysis.summary.rowCount.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-monokai-comment block">字段列数</span>
                      <span className="font-medium text-monokai-fg">{analysis.summary.columnCount}</span>
                    </div>
                  </div>

                  <div className="mb-3 flex items-center gap-1.5 text-xs">
                    <Table2 className="w-3 h-3 text-monokai-comment shrink-0" />
                    <span className="text-[11px] text-monokai-comment">表名:</span>
                    <span className="font-mono font-medium text-monokai-fg truncate">{analysis.summary.tableName}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => onLoadAnalysis(analysis)}
                      className="flex-1 bg-monokai-accent text-monokai-bg hover:bg-monokai-accent-hover py-1.5 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Play className="w-3 h-3" />
                      <span>加载分析</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
