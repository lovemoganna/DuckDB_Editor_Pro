import React from 'react';
import { Database, Code } from 'lucide-react';
import { ActionButton, FormInput, ModalShell } from '../ui/Workbench';

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
}) => (
  <ModalShell
    open={isOpen}
    onClose={onClose}
    title={`持久化为 ${materializeType === 'TABLE' ? '物理表 (Table)' : '视图 (View)'}`}
    description="将查询结果实体化存储至当前数据库"
    icon={Database}
    iconColor={materializeType === 'TABLE' ? 'text-monokai-cyan' : 'text-monokai-amethyst'}
    size="sm"
    footer={
      <>
        <ActionButton variant="ghost" size="sm" onClick={onClose}>
          取消
        </ActionButton>
        <ActionButton
          variant="primary"
          size="sm"
          icon={Database}
          onClick={onConfirm}
          disabled={!materializeName.trim()}
        >
          立即创建
        </ActionButton>
      </>
    }
  >
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-xs font-medium text-monokai-comment">
          {materializeType === 'TABLE' ? '新建表名称' : '新建视图名称'}
        </label>
        <FormInput
          autoFocus
          fontVariant="mono"
          value={materializeName}
          onChange={e => setMaterializeName(e.target.value)}
          placeholder={`输入 ${materializeType === 'TABLE' ? '表' : '视图'} 名称...`}
        />
      </div>

      <div className="rounded-md border border-monokai-border/80 bg-monokai-bg/70 p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <Code className="h-3 w-3 text-monokai-comment" aria-hidden="true" />
          <span className="font-mono text-2xs font-medium text-monokai-comment">SQL Preview</span>
        </div>
        <pre className="truncate rounded-md border border-monokai-border/40 bg-monokai-surface p-2 font-mono text-2xs text-monokai-fg/80">
          CREATE {materializeType} &quot;{materializeName || 'target_name'}&quot; AS ...
        </pre>
      </div>
    </div>
  </ModalShell>
);
