import React, { useState } from 'react';
import { History, RotateCcw, Trash2, Eye, X } from 'lucide-react';
import { SandboxVersion } from '../../hooks/useAbstractionSandbox';
import { useAnalysisHubStore } from '../../hooks/store/analysisHubStore';

interface VersionHistoryPanelProps {
  versions: SandboxVersion[];
  onRestore: (version: SandboxVersion) => void;
  onClear: () => void;
}

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  versions,
  onRestore,
  onClear,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [diffVersion, setDiffVersion] = useState<SandboxVersion | null>(null);
  const currentSql = useAnalysisHubStore(s => s.sandboxSql);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (versions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <History className="w-5 h-5 mx-auto mb-1 text-monokai-fg-muted/40" />
          <p className="text-xs text-monokai-fg-muted/60">暂无历史版本</p>
          <p className="text-[10px] text-monokai-fg-muted/40 mt-0.5">执行 SQL 后自动保存</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-monokai-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-monokai-amethyst" />
          <span className="text-xs font-medium text-monokai-fg">{versions.length} 个版本</span>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-monokai-fg-muted hover:text-monokai-pink transition-colors rounded hover:bg-monokai-pink/10 cursor-pointer"
        >
          <Trash2 className="w-3 h-3" />
          清除全部
        </button>
      </div>

      {/* 版本列表（水平滚动） */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full items-stretch px-4 py-3 gap-3 min-w-max">
          {versions.map((version, idx) => {
            const isActive = activeId === version.id;
            const isNewest = idx === 0;
            return (
              <div
                key={version.id}
                className={`w-60 flex-shrink-0 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-monokai-surface border border-monokai-accent/70 shadow-xs'
                    : 'bg-monokai-bg border border-monokai-border hover:border-monokai-fg-muted'
                }`}
                onClick={() => setActiveId(isActive ? null : version.id)}
              >
                {/* 版本卡片内容 */}
                <div className="flex flex-col h-full p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      {isNewest && (
                        <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-monokai-surface text-monokai-accent border border-monokai-border">
                          最新
                        </span>
                      )}
                      <span className="text-[10px] text-monokai-fg-muted/60 font-mono">
                        v{versions.length - idx}
                      </span>
                    </div>
                    <span className="text-[10px] text-monokai-fg-muted/60 font-mono">
                      {formatTime(version.createdAt)}
                    </span>
                  </div>

                  <div className="text-xs font-medium text-monokai-fg line-clamp-1 mb-1">
                    {version.name}
                  </div>

                  {version.note && (
                    <div className="text-[10px] text-monokai-fg-muted/60 line-clamp-1 mb-2">
                      {version.note}
                    </div>
                  )}

                  {/* SQL 预览 */}
                  <pre className="text-[9px] text-monokai-fg-muted font-mono bg-monokai-surface border border-monokai-border rounded px-2 py-1 line-clamp-2 mb-2 flex-1 overflow-hidden">
                    {version.sql.trim().split('\n')[0]}
                  </pre>

                  {/* 操作按钮 */}
                  {isActive && (
                    <div className="flex items-center gap-1.5 mt-auto">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDiffVersion(version); }}
                        className="flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-semibold rounded bg-monokai-surface text-monokai-fg border border-monokai-border hover:bg-monokai-sidebar transition-colors cursor-pointer shadow-xs"
                      >
                        <Eye className="w-3 h-3 text-monokai-accent" />
                        对比
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onRestore(version); setActiveId(null); }}
                        className="flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-semibold rounded bg-monokai-accent text-monokai-bg hover:brightness-105 transition-colors cursor-pointer shadow-xs"
                      >
                        <RotateCcw className="w-3 h-3" />
                        恢复
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Diff 比对 Modal */}
      {diffVersion && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150 font-sans">
          <div className="bg-monokai-sidebar border border-monokai-border rounded-xl shadow-2xl max-w-4xl w-full p-6 text-monokai-fg flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-monokai-border pb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-monokai-fg">
                <Eye size={18} className="text-monokai-accent" />
                版本 SQL 差异对比 (v{versions.findIndex(v => v.id === diffVersion.id) >= 0 ? versions.length - versions.findIndex(v => v.id === diffVersion.id) : ''} vs 当前草稿)
              </h3>
              <button
                onClick={() => setDiffVersion(null)}
                className="text-monokai-comment hover:text-rose-400 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <label className="block text-monokai-comment mb-1 font-medium font-sans">当前草稿 SQL:</label>
                <pre className="p-3 bg-monokai-bg border border-monokai-border rounded-lg text-[11px] text-monokai-fg whitespace-pre-wrap max-h-72 overflow-y-auto custom-scrollbar">
                  {currentSql || '(空)'}
                </pre>
              </div>

              <div>
                <label className="block text-monokai-comment mb-1 font-medium font-sans">历史版本 SQL ({formatTime(diffVersion.createdAt)}):</label>
                <pre className="p-3 bg-monokai-bg border border-monokai-border rounded-lg text-[11px] text-emerald-400 whitespace-pre-wrap max-h-72 overflow-y-auto custom-scrollbar">
                  {diffVersion.sql}
                </pre>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-monokai-border pt-3">
              <button
                onClick={() => setDiffVersion(null)}
                className="px-4 py-2 bg-monokai-surface border border-monokai-border text-monokai-comment hover:text-monokai-fg rounded-lg text-xs font-medium cursor-pointer shadow-xs"
              >
                关闭
              </button>
              <button
                onClick={() => {
                  onRestore(diffVersion);
                  setDiffVersion(null);
                  setActiveId(null);
                }}
                className="px-5 py-2 bg-monokai-accent text-monokai-bg font-semibold text-xs rounded-lg hover:brightness-105 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RotateCcw size={14} />
                <span>恢复此历史版本</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VersionHistoryPanel;
