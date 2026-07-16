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
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s]">
      <div className="bg-monokai-sidebar border border-monokai-accent rounded-xl shadow-2xl w-[400px] overflow-hidden animate-[slideIn_0.25s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-monokai-bg border-b border-monokai-accent">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${materializeType === 'TABLE' ? 'bg-monokai-blue/20' : 'bg-monokai-amethyst/20'}`}>
              <Database className={`w-4 h-4 ${materializeType === 'TABLE' ? 'text-monokai-blue' : 'text-monokai-amethyst'}`} />
            </div>
            <div>
              <h3 className="text-base font-bold text-monokai-fg">创建 {materializeType === 'TABLE' ? '表' : '视图'}</h3>
              <p className="text-[10px] text-monokai-comment">将查询结果持久化存储</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-monokai-accent flex items-center justify-center text-monokai-comment hover:text-monokai-fg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-monokai-comment mb-2">
              {materializeType === 'TABLE' ? '表名称' : '视图名称'}
            </label>
            <input
              autoFocus
              value={materializeName}
              onChange={e => setMaterializeName(e.target.value)}
              placeholder={`输入${materializeType === 'TABLE' ? '表' : '视图'}名称...`}
              className="w-full bg-monokai-bg border border-monokai-accent rounded-lg px-3 py-2.5 text-sm text-monokai-fg placeholder-monokai-comment/50 outline-none focus:border-monokai-amethyst/50 focus:ring-1 focus:ring-monokai-amethyst/20 transition-all"
            />
          </div>

          {/* SQL Preview */}
          <div className="p-3 bg-monokai-bg/50 border border-monokai-accent/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Code className="w-3 h-3 text-monokai-comment" />
              <span className="text-[10px] font-medium text-monokai-comment">SQL 预览</span>
            </div>
            <pre className="text-[10px] text-monokai-fg/70 font-mono truncate">
              CREATE {materializeType} "{materializeName || 'name'}" AS ...
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 bg-monokai-bg border-t border-monokai-accent">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={!materializeName.trim()}
            className={`px-5 py-2 font-bold rounded-lg text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 ${materializeType === 'TABLE' ? 'bg-monokai-blue text-monokai-bg' : 'bg-monokai-amethyst text-monokai-fg'}`}
          >
            <Database size={14} />
            立即创建
          </button>
        </div>
      </div>
    </div>
  );
};
