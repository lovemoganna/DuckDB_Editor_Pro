import React from 'react';
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex">
      <div className="ml-auto w-96 bg-monokai-bg h-full shadow-xl overflow-y-auto border-l border-monokai-border">
        <div className="sticky top-0 bg-monokai-bg border-b border-monokai-border px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-monokai-fg">📂 分析历史</h3>
          <button
            onClick={onClose}
            className="text-monokai-comment hover:text-monokai-fg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {history.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-monokai-comment">暂无分析历史</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((analysis) => (
                <div key={analysis.id} className="bg-monokai-surface rounded-lg p-4 border border-monokai-border">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-monokai-fg truncate">{analysis.fileName}</h4>
                      <p className="text-sm text-monokai-comment mt-1">
                        {formatDate(analysis.timestamp)}
                      </p>
                    </div>
                    <button
                      onClick={() => onDeleteAnalysis(analysis.id)}
                      className="text-monokai-comment hover:text-monokai-red transition-colors ml-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <span className="text-monokai-comment">数据行数:</span>
                      <span className="font-medium ml-1 text-monokai-fg">{analysis.summary.rowCount.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-monokai-comment">列数:</span>
                      <span className="font-medium ml-1 text-monokai-fg">{analysis.summary.columnCount}</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <span className="text-monokai-comment text-sm">表名:</span>
                    <span className="font-medium ml-1 text-monokai-fg">{analysis.summary.tableName}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => onLoadAnalysis(analysis)}
                      className="flex-1 bg-monokai-amethyst text-white px-3 py-2 rounded text-sm hover:opacity-90 transition-colors"
                    >
                      加载分析
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
