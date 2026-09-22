import React from 'react';
import { Save } from 'lucide-react';
import { ActionButton, FormInput, FormSelect, ModalShell } from '../ui/Workbench';

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
}) => (
  <ModalShell
    open={isOpen}
    onClose={onClose}
    title="保存查询为书签"
    description="持久化当前 SQL 语句并可选择固定至看板"
    icon={Save}
    iconColor="text-monokai-accent"
    size="sm"
    footer={
      <>
        <ActionButton variant="ghost" size="sm" onClick={onClose}>
          取消
        </ActionButton>
        <ActionButton
          variant="primary"
          size="sm"
          icon={Save}
          onClick={onSave}
          disabled={!saveQueryName.trim()}
        >
          保存查询
        </ActionButton>
      </>
    }
  >
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-xs font-medium text-monokai-comment">查询名称</label>
        <FormInput
          autoFocus
          fontVariant="mono"
          value={saveQueryName}
          onChange={e => setSaveQueryName(e.target.value)}
          placeholder="输入查询名称..."
        />
      </div>

      <div className="rounded-md border border-monokai-border/80 bg-monokai-bg/70 p-3.5">
        <label className="flex cursor-pointer items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={saveAsWidget}
              onChange={e => setSaveAsWidget(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-monokai-border bg-monokai-bg text-monokai-accent focus:ring-monokai-accent/30"
            />
            <div>
              <span className="text-xs font-semibold text-monokai-fg">固定到仪表板</span>
              <p className="mt-0.5 text-2xs text-monokai-comment">将此查询添加为仪表板小部件</p>
            </div>
          </div>
        </label>

        {saveAsWidget && (
          <div className="mt-3 pl-7">
            <label className="mb-1 block font-mono text-2xs text-monokai-comment">小部件展示类型</label>
            <FormSelect
              value={widgetType}
              onChange={e => setWidgetType(e.target.value as 'table' | 'value' | 'chart')}
              className="font-mono"
            >
              <option value="table">迷你表格 (Table)</option>
              <option value="value">单值显示 (KPI Value)</option>
              <option value="chart">图表 (Visualization)</option>
            </FormSelect>
          </div>
        )}
      </div>
    </div>
  </ModalShell>
);
