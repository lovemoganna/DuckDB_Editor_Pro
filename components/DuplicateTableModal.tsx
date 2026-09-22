import React, { useState, useMemo } from 'react';
import { duckDBService } from '../services/duckdbService';
import { ModalShell, ActionButton, FormInput } from './ui/Workbench';
import { Copy, Database, Layers, Code2 } from 'lucide-react';
import { toastService } from '../services/toastService';

interface DuplicateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTable: string | null;
  onTableCreated: (tableName: string) => void;
  onRefreshTables: () => Promise<void>;
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const DuplicateTableModal: React.FC<DuplicateTableModalProps> = ({
  isOpen,
  onClose,
  sourceTable,
  onTableCreated,
  onRefreshTables,
  onNotify,
}) => {
  const [targetName, setTargetName] = useState('');
  const [cloneMode, setCloneMode] = useState<'full' | 'schema_only'>('full');
  const [loading, setLoading] = useState(false);

  // Default target name
  React.useEffect(() => {
    if (sourceTable && !targetName) {
      setTargetName(`${sourceTable}_copy`);
    }
  }, [sourceTable]);

  // Live SQL preview
  const duplicateSql = useMemo(() => {
    if (!sourceTable) return '';
    const cleanTarget = targetName.trim() || 'new_table_copy';
    if (cloneMode === 'schema_only') {
      return `CREATE TABLE "${cleanTarget}" AS SELECT * FROM "${sourceTable}" WHERE 1=0;`;
    }
    return `CREATE TABLE "${cleanTarget}" AS SELECT * FROM "${sourceTable}";`;
  }, [sourceTable, targetName, cloneMode]);

  const handleDuplicate = async () => {
    if (!sourceTable || !targetName.trim()) return;
    setLoading(true);
    try {
      await duckDBService.executeAndAudit(
        duplicateSql,
        'CREATE',
        targetName.trim(),
        `Duplicated from ${sourceTable} (mode: ${cloneMode})`
      );
      toastService.success(`数据表 "${targetName.trim()}" 克隆成功`);
      if (onNotify) {
        onNotify(`Table "${targetName.trim()}" duplicated successfully`, 'success');
      }
      await onRefreshTables();
      onTableCreated(targetName.trim());
      onClose();
      setTargetName('');
    } catch (e: any) {
      toastService.error('克隆数据表失败', e.message || String(e));
      if (onNotify) {
        onNotify(e.message || 'Failed to duplicate table', 'error');
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <ModalShell
      open={isOpen}
      title="克隆复制数据表 (Duplicate Table)"
      description="基于现有数据表快速克隆副本，支持包含数据全量克隆或仅保留结构定义"
      onClose={onClose}
      size="md"
      footer={(
        <>
          <ActionButton variant="secondary" onClick={onClose} disabled={loading}>
            取消
          </ActionButton>
          <ActionButton
            variant="primary"
            icon={Copy}
            onClick={handleDuplicate}
            disabled={loading || !targetName.trim() || !sourceTable}
            loading={loading}
          >
            立即克隆表
          </ActionButton>
        </>
      )}
    >
      <div className="space-y-4 font-sans text-xs">
        {/* Source Table Display */}
        <div className="p-3 rounded-lg border border-monokai-border bg-monokai-surface flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-monokai-cyan" />
            <span className="text-monokai-comment">源数据表：</span>
            <span className="font-mono font-bold text-monokai-fg">{sourceTable || '-'}</span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-monokai-elevated text-monokai-comment border border-monokai-border/60">
            DuckDB Table
          </span>
        </div>

        {/* Target Table Name Input */}
        <div>
          <label className="block text-xs font-semibold text-monokai-fg mb-1.5" htmlFor="duplicate-target-name">
            新数据表名称 <span className="text-monokai-pink">*</span>
          </label>
          <FormInput
            id="duplicate-target-name"
            type="text"
            value={targetName}
            onChange={e => setTargetName(e.target.value)}
            placeholder={`例如：${sourceTable || 'table'}_backup`}
            autoFocus
            sizeVariant="md"
            fontVariant="mono"
          />
        </div>

        {/* Clone Mode Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-monokai-comment uppercase tracking-wider">
            克隆模式 (Clone Mode)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                cloneMode === 'full'
                  ? 'border-monokai-accent bg-monokai-accent/15 text-monokai-fg shadow-xs'
                  : 'border-monokai-border bg-monokai-surface text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated'
              }`}
            >
              <input
                type="radio"
                name="cloneMode"
                value="full"
                checked={cloneMode === 'full'}
                onChange={() => setCloneMode('full')}
                className="hidden"
              />
              <div className="flex items-center gap-2 font-semibold text-xs text-monokai-fg mb-1">
                <Database className="w-3.5 h-3.5 text-monokai-cyan" />
                <span>包含数据 (Schema + Data)</span>
              </div>
              <p className="text-[11px] text-monokai-comment leading-relaxed">
                完整复制表结构并导入源表的所有数据行。
              </p>
            </label>

            <label
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                cloneMode === 'schema_only'
                  ? 'border-monokai-accent bg-monokai-accent/15 text-monokai-fg shadow-xs'
                  : 'border-monokai-border bg-monokai-surface text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated'
              }`}
            >
              <input
                type="radio"
                name="cloneMode"
                value="schema_only"
                checked={cloneMode === 'schema_only'}
                onChange={() => setCloneMode('schema_only')}
                className="hidden"
              />
              <div className="flex items-center gap-2 font-semibold text-xs text-monokai-fg mb-1">
                <Layers className="w-3.5 h-3.5 text-monokai-green" />
                <span>仅表结构 (Schema Only)</span>
              </div>
              <p className="text-[11px] text-monokai-comment leading-relaxed">
                仅创建相同字段与类型的新空表，不复制数据行。
              </p>
            </label>
          </div>
        </div>

        {/* Live SQL Preview */}
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-monokai-comment uppercase tracking-wider flex items-center gap-1">
            <Code2 className="w-3 h-3 text-monokai-cyan" /> SQL 执行语句预览
          </span>
          <pre className="p-2.5 rounded-lg bg-monokai-bg border border-monokai-border font-mono text-xs text-monokai-green overflow-x-auto whitespace-pre-wrap">
            {duplicateSql}
          </pre>
        </div>
      </div>
    </ModalShell>
  );
};

export default DuplicateTableModal;
