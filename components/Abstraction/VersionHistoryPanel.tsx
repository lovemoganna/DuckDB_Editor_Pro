/**
 * VersionHistoryPanel — 版本历史面板（底部抽屉样式）
 *
 * 改进：
 * - 紧凑水平布局，适合底部抽屉
 * - 版本时间轴可视化
 * - 恢复版本一键操作
 */

import React, { useState } from 'react';
import { History, RotateCcw, Trash2, ChevronRight } from 'lucide-react';
import { SandboxVersion } from '../../hooks/useAbstractionSandbox';

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
          <History className="w-3.5 h-3.5 text-monokai-purple" />
          <span className="text-xs font-medium text-monokai-fg">{versions.length} 个版本</span>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-monokai-fg-muted hover:text-monokai-pink transition-colors rounded hover:bg-monokai-pink/10"
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
                className={`w-56 flex-shrink-0 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-monokai-purple/10 border-monokai-purple/50'
                    : 'bg-monokai-bg border-monokai-border hover:border-monokai-fg-muted'
                }`}
                onClick={() => setActiveId(isActive ? null : version.id)}
              >
                {/* 版本卡片内容 */}
                <div className="flex flex-col h-full p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      {isNewest && (
                        <span className="px-1 py-0.5 text-[9px] font-bold rounded bg-monokai-purple/20 text-monokai-purple">
                          最新
                        </span>
                      )}
                      <span className="text-[10px] text-monokai-fg-muted/60">
                        v{versions.length - idx}
                      </span>
                    </div>
                    <span className="text-[10px] text-monokai-fg-muted/60">
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
                  <pre className="text-[9px] text-monokai-fg-muted/50 font-mono bg-monokai-surface border border-monokai-border rounded px-2 py-1 line-clamp-2 mb-2 flex-1 overflow-hidden">
                    {version.sql.trim().split('\n')[0]}
                  </pre>

                  {/* 操作按钮 */}
                  {isActive && (
                    <div className="flex items-center gap-2 mt-auto">
                      <button
                        onClick={(e) => { e.stopPropagation(); onRestore(version); setActiveId(null); }}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium rounded-md bg-monokai-blue/15 text-monokai-blue hover:bg-monokai-blue/25 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        恢复
                      </button>
                      <ChevronRight className="w-3 h-3 text-monokai-fg-muted/40" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VersionHistoryPanel;
