import React from 'react';
import { Database, X, Code } from 'lucide-react';

export interface MaterializeModalProps {
  isOpen: boolean;
  onClose: () => void;
  materializeType: 'TABLE' | 'VIEW';
  materializeName: string;
  setMaterializeName: (name: string) => void;
  onConfirm: () => void;
}

export const MaterializeModal: React.FC<MaterializeModalProps> = ({
  isOpen,
  onClose,
  materializeType,
  materializeName,
  setMaterializeName,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 p-4 select-none">
      <div className="bg-monokai-sidebar border border-monokai-border rounded-xl shadow-2xl w-full max-w-[420px] overflow-hidden animate-[slideIn_0.25s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-monokai-bg/90 border-b border-monokai-border shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border border-monokai-border bg-monokai-surface ${materializeType === 'TABLE' ? 'text-monokai-blue' : 'text-monokai-amethyst'}`}>
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-monokai-fg">持久化为 {materializeType === 'TABLE' ? '物理表 (Table)' : '视图 (View)'}</h3>
              <p className="text-[10px] text-monokai-comment">将查询结果实体化存储至当前数据库</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-monokai-surface flex items-center justify-center text-monokai-comment hover:text-monokai-pink transition-colors cursor-pointer"
            title="关闭窗口"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-monokai-comment mb-2">
              {materializeType === 'TABLE' ? '新建表名称' : '新建视图名称'}
            </label>
            <input
              autoFocus
              value={materializeName}
              onChange={e => setMaterializeName(e.target.value)}
              placeholder={`输入 ${materializeType === 'TABLE' ? '表' : '视图'} 名称...`}
              className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-2 text-xs text-monokai-fg placeholder-monokai-comment/50 outline-none focus:border-monokai-accent transition-colors font-mono"
            />
          </div>

          {/* SQL Preview */}
          <div className="p-3 bg-monokai-bg/70 border border-monokai-border/80 rounded-lg">
            <div className="flex items-center gap-2 mb-1.5">
              <Code className="w-3 h-3 text-monokai-comment" />
              <span className="text-[10px] font-medium text-monokai-comment font-mono">SQL Preview</span>
            </div>
            <pre className="text-[10.5px] text-monokai-fg/80 font-mono truncate bg-monokai-surface p-2 rounded border border-monokai-border/40">
              CREATE {materializeType} "{materializeName || 'target_name'}" AS ...
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 px-5 py-3.5 bg-monokai-bg border-t border-monokai-border">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface rounded-lg transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={!materializeName.trim()}
            className="px-4 py-1.5 font-bold rounded-lg text-xs bg-monokai-accent text-monokai-bg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Database size={13} />
            立即创建
          </button>
        </div>
      </div>
    </div>
  );
};
