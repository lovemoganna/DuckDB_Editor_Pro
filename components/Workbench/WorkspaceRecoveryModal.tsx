import React from 'react';
import { RotateCcw, Database as DatabaseIcon, Layers } from 'lucide-react';
import { ActionButton } from '../ui/Workbench';

export interface WorkspaceRecoveryModalProps {
  open: boolean;
  onRestore: () => void;
  onDismiss: () => void;
  onCloseForever?: () => void;
  tabCount: number;
  activeDatabase: string;
  activeSchema: string;
  currentTable: string;
}

export const WorkspaceRecoveryModal: React.FC<WorkspaceRecoveryModalProps> = ({
  open,
  onRestore,
  onDismiss,
  onCloseForever,
  tabCount,
  activeDatabase,
  activeSchema,
  currentTable,
}) => {
  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-label="恢复上次工作区"
      className="fixed bottom-12 right-6 z-50 w-80 rounded-xl border border-monokai-border bg-monokai-elevated shadow-2xl p-4 space-y-3 font-sans select-none animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      <div className="flex items-center justify-between border-b border-monokai-border-subtle pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-monokai-accent/15 text-monokai-accent flex items-center justify-center border border-monokai-accent/30">
            <RotateCcw className="w-3.5 h-3.5" />
          </div>
          <span className="wb-panel-title">恢复上次工作区</span>
        </div>
        <ActionButton variant="ghost" size="sm" onClick={onDismiss} aria-label="关闭">
          关闭
        </ActionButton>
      </div>

      <div className="space-y-1.5 text-[11px] text-monokai-fg font-mono">
        <div className="flex justify-between">
          <span className="text-monokai-comment font-sans">上次保存状态:</span>
          <span className="text-monokai-fg-muted">已自动恢复</span>
        </div>
        <div className="flex justify-between">
          <span className="text-monokai-comment font-sans">已恢复:</span>
          <span className="text-monokai-fg font-mono">{tabCount} 个查询标签页</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-monokai-comment font-sans shrink-0">当前数据库:</span>
          <span className="text-monokai-fg-muted truncate flex items-center gap-1">
            <DatabaseIcon className="w-3 h-3 shrink-0" />
            {activeDatabase || 'memory'}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-monokai-comment font-sans shrink-0">活动数据表:</span>
          <span className="text-monokai-fg font-mono truncate flex items-center gap-1">
            <Layers className="w-3 h-3 shrink-0" />
            {currentTable || '无'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-monokai-comment font-sans">Schema:</span>
          <span className="text-monokai-fg-muted">{activeSchema || 'main'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-monokai-border-subtle gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={onDismiss}
            className="wb-link text-[11px]"
          >
            不再显示
          </button>
          {onCloseForever && (
            <button
              type="button"
              onClick={onCloseForever}
              className="text-monokai-comment hover:text-monokai-pink text-[11px] cursor-pointer transition-colors"
              title="永久关闭此提示"
            >
              永久关闭
            </button>
          )}
        </div>
        <ActionButton variant="primary" size="sm" onClick={onRestore}>
          恢复
        </ActionButton>
      </div>
    </div>
  );
};

export default WorkspaceRecoveryModal;
