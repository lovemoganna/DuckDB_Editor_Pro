import React, { useState, useMemo } from 'react';
import { duckDBService } from '../services/duckdbService';
import { ModalShell, ActionButton, FormInput } from './ui/Workbench';
import { Layers, Plus, Copy, Check, Code2, Sparkles, AlertTriangle } from 'lucide-react';
import { toastService } from '../services/toastService';

interface CreateViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewCreated: (viewName: string) => void;
  onRefreshTables: () => Promise<void>;
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
  onOpenSqlInTab?: (sql: string) => void;
  tables?: string[];
}

export const CreateViewModal: React.FC<CreateViewModalProps> = ({
  isOpen,
  onClose,
  onViewCreated,
  onRefreshTables,
  onNotify,
  onOpenSqlInTab,
  tables = [],
}) => {
  const [viewName, setViewName] = useState('');
  const [viewSql, setViewSql] = useState(() => {
    if (tables.length > 0) {
      return `SELECT *\nFROM "${tables[0]}"\nLIMIT 100;`;
    }
    return 'SELECT 1 AS id, \'sample\' AS name;';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Generate live CREATE VIEW DDL
  const generatedDdl = useMemo(() => {
    const cleanName = viewName.trim() || 'new_view';
    const cleanSql = viewSql.trim().replace(/;+$/, '');
    return `CREATE OR REPLACE VIEW "${cleanName}" AS\n${cleanSql};`;
  }, [viewName, viewSql]);

  const handleApplyPreset = (type: 'filter' | 'aggregate' | 'simple') => {
    const targetTable = tables[0] || 'your_table';
    if (type === 'filter') {
      setViewName(`v_filtered_${targetTable}`);
      setViewSql(`SELECT *\nFROM "${targetTable}"\nWHERE id > 0\nLIMIT 100;`);
    } else if (type === 'aggregate') {
      setViewName(`v_summary_${targetTable}`);
      setViewSql(`SELECT count(*) AS total_count\nFROM "${targetTable}";`);
    } else {
      setViewName(`v_${targetTable}`);
      setViewSql(`SELECT *\nFROM "${targetTable}";`);
    }
    setError(null);
  };

  const handleCopyDdl = () => {
    navigator.clipboard.writeText(generatedDdl);
    setCopied(true);
    toastService.success('已复制视图 DDL 到剪贴板');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInEditor = () => {
    if (onOpenSqlInTab) {
      onOpenSqlInTab(generatedDdl);
      onClose();
    }
  };

  const handleCreate = async () => {
    const name = viewName.trim();
    if (!name) {
      setError('请输入视图名称');
      return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      setError('视图名称仅支持英文字母、数字和下划线，且不能以数字开头');
      return;
    }
    const sql = viewSql.trim();
    if (!sql) {
      setError('请输入视图查询 SQL 语句');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await duckDBService.createView(name, sql);
      toastService.success(`视图 "${name}" 创建成功`);
      if (onNotify) onNotify(`视图 "${name}" 创建成功`, 'success');
      await onRefreshTables();
      onViewCreated(name);
      onClose();
      setViewName('');
    } catch (e: any) {
      const msg = e.message || '创建视图失败';
      setError(msg);
      toastService.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title="新建视图 (Create View)"
      description="在 DuckDB 数据库中定义自定义逻辑视图，支持聚合、联表与过滤分析"
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <ActionButton
              onClick={handleCopyDdl}
              variant="secondary"
              icon={copied ? Check : Copy}
            >
              {copied ? '已复制' : '复制 DDL'}
            </ActionButton>
            {onOpenSqlInTab && (
              <ActionButton
                onClick={handleOpenInEditor}
                variant="secondary"
                icon={Code2}
              >
                在编辑器中打开
              </ActionButton>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ActionButton onClick={onClose} variant="secondary" disabled={loading}>
              取消
            </ActionButton>
            <ActionButton
              onClick={handleCreate}
              variant="primary"
              disabled={loading || !viewName.trim() || !viewSql.trim()}
              icon={Plus}
              loading={loading}
            >
              立即创建视图
            </ActionButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-monokai-surface border border-monokai-border text-monokai-pink text-xs font-mono">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 break-all">{error}</div>
          </div>
        )}

        {/* View Name */}
        <div>
          <label className="block text-xs font-medium text-monokai-fg mb-1">
            视图名称 <span className="text-monokai-pink">*</span>
          </label>
          <FormInput
            type="text"
            value={viewName}
            onChange={e => {
              setViewName(e.target.value);
              setError(null);
            }}
            placeholder="例如：v_active_users, v_monthly_sales"
            className="w-full font-mono text-xs"
            autoFocus
          />
        </div>

        {/* Preset quick templates */}
        {tables.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-monokai-comment mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-monokai-yellow" />
              <span>快速模板预设：</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleApplyPreset('simple')}
                className="px-2.5 py-1 rounded-md text-xs bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-monokai-fg transition-colors cursor-pointer"
              >
                全表基础视图
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('filter')}
                className="px-2.5 py-1 rounded-md text-xs bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-monokai-fg transition-colors cursor-pointer"
              >
                条件过滤视图
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('aggregate')}
                className="px-2.5 py-1 rounded-md text-xs bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-monokai-fg transition-colors cursor-pointer"
              >
                聚合统计视图
              </button>
            </div>
          </div>
        )}

        {/* SQL Definition */}
        <div>
          <label className="block text-xs font-medium text-monokai-fg mb-1">
            视图查询 SQL (SELECT 语句) <span className="text-monokai-pink">*</span>
          </label>
          <textarea
            rows={6}
            value={viewSql}
            onChange={e => {
              setViewSql(e.target.value);
              setError(null);
            }}
            placeholder="SELECT ... FROM ..."
            className="w-full rounded-lg bg-monokai-bg border border-monokai-border focus:border-monokai-accent p-2.5 text-xs font-mono text-monokai-fg placeholder-monokai-comment/60 focus:outline-none focus:ring-1 focus:ring-monokai-accent resize-y"
          />
        </div>

        {/* Preview DDL */}
        <div>
          <span className="block text-[11px] font-bold text-monokai-comment uppercase tracking-wider mb-1">
            实时 DDL 预览
          </span>
          <div className="p-2.5 rounded-lg bg-monokai-bg border border-monokai-border font-mono text-[11px] text-monokai-green overflow-x-auto select-text whitespace-pre">
            {generatedDdl}
          </div>
        </div>
      </div>
    </ModalShell>
  );
};
