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
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s]">
      <div className="bg-monokai-sidebar border border-monokai-accent rounded-xl shadow-2xl w-[400px] overflow-hidden animate-[slideIn_0.25s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-monokai-bg border-b border-monokai-accent">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-monokai-green/20 flex items-center justify-center">
              <Save className="w-4 h-4 text-monokai-green" />
            </div>
            <h3 className="text-base font-bold text-monokai-fg">保存查询</h3>
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
          {/* Query Name Input */}
          <div>
            <label className="block text-xs font-medium text-monokai-comment mb-2">查询名称</label>
            <input
              autoFocus
              value={saveQueryName}
              onChange={e => setSaveQueryName(e.target.value)}
              placeholder="输入查询名称..."
              className="w-full bg-monokai-bg border border-monokai-accent rounded-lg px-3 py-2.5 text-sm text-monokai-fg placeholder-monokai-comment/50 outline-none focus:border-monokai-green/50 focus:ring-1 focus:ring-monokai-green/20 transition-all"
            />
          </div>

          {/* Pin to Dashboard Option */}
          <div className="p-4 bg-monokai-bg/50 border border-monokai-accent/50 rounded-lg">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={saveAsWidget}
                  onChange={e => setSaveAsWidget(e.target.checked)}
                  className="w-4 h-4 rounded border-monokai-accent bg-monokai-bg text-monokai-green focus:ring-monokai-green/30"
                />
                <div>
                  <span className="text-sm font-medium text-monokai-fg">固定到仪表板</span>
                  <p className="text-[10px] text-monokai-comment mt-0.5">将此查询添加为小部件显示</p>
                </div>
              </div>
            </label>

            {/* Widget Type Select */}
            {saveAsWidget && (
              <div className="mt-4 pl-7">
                <label className="block text-xs text-monokai-comment mb-2">小部件类型</label>
                <select
                  value={widgetType}
                  onChange={(e: any) => setWidgetType(e.target.value)}
                  className="w-full bg-monokai-bg border border-monokai-accent rounded-lg px-3 py-2 text-sm text-monokai-fg outline-none focus:border-monokai-green/50"
                >
                  <option value="table">迷你表格</option>
                  <option value="value">单值显示</option>
                  <option value="chart">图表</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end gap-3 px-5 py-4 bg-monokai-bg border-t border-monokai-accent">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={onSave}
            disabled={!saveQueryName.trim()}
            className="px-5 py-2 bg-monokai-green text-monokai-bg font-bold rounded-lg text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <Save size={14} />
            保存查询
          </button>
        </div>
      </div>
    </div>
  );
};
