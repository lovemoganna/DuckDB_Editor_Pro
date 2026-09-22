import React from 'react';
import { Save, X } from 'lucide-react';

export interface SaveQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  saveQueryName: string;
  setSaveQueryName: (name: string) => void;
  saveAsWidget: boolean;
  setSaveAsWidget: (val: boolean) => void;
  widgetType: 'table' | 'value' | 'chart';
  setWidgetType: (type: 'table' | 'value' | 'chart') => void;
  onSave: () => void;
}

export const SaveQueryModal: React.FC<SaveQueryModalProps> = ({
  isOpen,
  onClose,
  saveQueryName,
  setSaveQueryName,
  saveAsWidget,
  setSaveAsWidget,
  widgetType,
  setWidgetType,
  onSave,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 p-4 select-none">
      <div className="bg-monokai-sidebar border border-monokai-border rounded-xl shadow-2xl w-full max-w-[420px] overflow-hidden animate-[slideIn_0.25s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-monokai-bg/90 border-b border-monokai-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-monokai-surface border border-monokai-border flex items-center justify-center text-monokai-green">
              <Save className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-monokai-fg">保存查询为书签</h3>
              <p className="text-[10px] text-monokai-comment">持久化当前 SQL 语句并可选择固定至看板</p>
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
          {/* Query Name Input */}
          <div>
            <label className="block text-xs font-medium text-monokai-comment mb-2">查询名称</label>
            <input
              autoFocus
              value={saveQueryName}
              onChange={e => setSaveQueryName(e.target.value)}
              placeholder="输入查询名称..."
              className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-2 text-xs text-monokai-fg placeholder-monokai-comment/50 outline-none focus:border-monokai-accent focus:ring-1 focus:ring-monokai-accent/30 transition-all font-mono"
            />
          </div>

          {/* Pin to Dashboard Option */}
          <div className="p-3.5 bg-monokai-bg/70 border border-monokai-border/80 rounded-lg">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={saveAsWidget}
                  onChange={e => setSaveAsWidget(e.target.checked)}
                  className="w-4 h-4 rounded border-monokai-border bg-monokai-bg text-monokai-green focus:ring-monokai-accent/30 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-monokai-fg">固定到仪表板</span>
                  <p className="text-[10px] text-monokai-comment mt-0.5">将此查询添加为仪表板小部件</p>
                </div>
              </div>
            </label>

            {/* Widget Type Select */}
            {saveAsWidget && (
              <div className="mt-3 pl-7">
                <label className="block text-[10px] text-monokai-comment mb-1 font-mono">小部件展示类型</label>
                <select
                  value={widgetType}
                  onChange={(e: any) => setWidgetType(e.target.value)}
                  className="w-full bg-monokai-surface border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-accent cursor-pointer font-sans"
                >
                  <option value="table">迷你表格 (Table)</option>
                  <option value="value">单值显示 (KPI Value)</option>
                  <option value="chart">图表 (Visualization)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end gap-2.5 px-5 py-3.5 bg-monokai-bg border-t border-monokai-border">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface rounded-lg transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={onSave}
            disabled={!saveQueryName.trim()}
            className="px-4 py-1.5 bg-monokai-green text-monokai-bg font-bold rounded-lg text-xs hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Save size={13} />
            保存查询
          </button>
        </div>
      </div>
    </div>
  );
};
