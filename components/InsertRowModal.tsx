import React, { useState, useEffect, useMemo } from 'react';
import { duckDBService } from '../services/duckdbService';
import { ColumnInfo } from '../types';
import { ModalShell, ActionButton } from './ui/Workbench';
import { ListPlus, Copy, Check, Sparkles, Key, AlertCircle, RotateCcw } from 'lucide-react';
import { toastService } from '../services/toastService';
import { getTypeIcon } from '../utils';

export interface InsertRowModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  schema: ColumnInfo[];
  initialData?: Record<string, any>;
  onRowInserted: () => void;
}

export const InsertRowModal: React.FC<InsertRowModalProps> = ({
  isOpen,
  onClose,
  tableName,
  schema,
  initialData,
  onRowInserted,
}) => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initialize form fields based on schema or initialData
  const initForm = React.useCallback(() => {
    if (schema.length > 0) {
      const initial: Record<string, string> = {};
      schema.forEach(col => {
        if (initialData && initialData[col.name] !== undefined && initialData[col.name] !== null) {
          initial[col.name] = String(initialData[col.name]);
        } else if (col.dflt_value) {
          initial[col.name] = String(col.dflt_value);
        } else {
          initial[col.name] = '';
        }
      });
      setFormData(initial);
    }
  }, [schema, initialData]);

  useEffect(() => {
    if (isOpen) {
      initForm();
    }
  }, [isOpen, initForm]);

  const handleFieldChange = (colName: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [colName]: value,
    }));
  };

  const handleResetForm = () => {
    initForm();
    toastService.info('表单输入已重置');
  };

  // Convert string form values to typed object for DuckDB
  const parsedData = useMemo(() => {
    const result: Record<string, any> = {};
    schema.forEach(col => {
      const raw = formData[col.name];
      if (raw === undefined || raw === '') {
        if (!col.notnull && !col.pk) {
          result[col.name] = null;
        }
        return;
      }
      const typeUpper = (col.type || '').toUpperCase();
      if (typeUpper.includes('INT') || typeUpper.includes('BIGINT') || typeUpper.includes('HUGEINT')) {
        const parsed = parseInt(raw, 10);
        result[col.name] = isNaN(parsed) ? raw : parsed;
      } else if (typeUpper.includes('FLOAT') || typeUpper.includes('DOUBLE') || typeUpper.includes('DECIMAL') || typeUpper.includes('NUMERIC') || typeUpper.includes('REAL')) {
        const parsed = parseFloat(raw);
        result[col.name] = isNaN(parsed) ? raw : parsed;
      } else if (typeUpper.includes('BOOL')) {
        result[col.name] = raw.toLowerCase() === 'true' || raw === '1';
      } else {
        result[col.name] = raw;
      }
    });
    return result;
  }, [formData, schema]);

  // Live SQL preview
  const generatedSql = useMemo(() => {
    const activeCols = Object.keys(parsedData).filter(k => parsedData[k] !== undefined);
    if (activeCols.length === 0) {
      return `INSERT INTO "${tableName}" DEFAULT VALUES;`;
    }
    const cols = activeCols.map(c => `"${c}"`).join(', ');
    const vals = activeCols.map(c => duckDBService.escapeLiteral(parsedData[c])).join(', ');
    return `INSERT INTO "${tableName}" (${cols})\nVALUES (${vals});`;
  }, [tableName, parsedData]);

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(generatedSql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toastService.info('SQL 已复制到剪贴板');
    } catch {
      // ignore
    }
  };

  const handleInsert = async () => {
    if (!tableName) return;
    setLoading(true);
    try {
      await duckDBService.insertRow(tableName, parsedData);
      toastService.success(`成功在表 "${tableName}" 中插入 1 行数据`);
      onRowInserted();
      onClose();
    } catch (e: any) {
      toastService.error('插入数据失败', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      open={isOpen}
      title={`新建数据行 · ${tableName}`}
      description="为目标表录入新行字段数据，支持类型感知自动校验与实时 SQL 预览"
      onClose={onClose}
      size="lg"
      footer={(
        <>
          <button
            type="button"
            onClick={handleResetForm}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-monokai-border bg-monokai-surface hover:bg-monokai-surface/80 text-monokai-comment hover:text-monokai-fg text-xs font-mono transition-colors cursor-pointer mr-auto"
            title="重置为默认值"
          >
            <RotateCcw size={13} /> 重置
          </button>
          <ActionButton variant="secondary" onClick={onClose} disabled={loading}>
            取消
          </ActionButton>
          <ActionButton
            variant="primary"
            icon={ListPlus}
            onClick={handleInsert}
            loading={loading}
          >
            确认插入
          </ActionButton>
        </>
      )}
    >
      <div className="space-y-4 font-sans text-xs">
        {/* Fields list */}
        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
          {schema.map(col => {
            const isPk = Boolean(col.pk);
            const isNotNull = Boolean(col.notnull);

            return (
              <div
                key={col.name}
                className="p-3 rounded-lg border border-monokai-border bg-monokai-surface/60 hover:bg-monokai-surface/80 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isPk && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-monokai-yellow/15 text-monokai-yellow">
                        <Key size={10} /> PK
                      </span>
                    )}
                    <span className="font-mono font-semibold text-monokai-fg text-xs">
                      {col.name}
                    </span>
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-monokai-fg-muted bg-monokai-bg border border-monokai-border-subtle">
                      {getTypeIcon(col.type)}
                      <span>{col.type}</span>
                    </span>
                  </div>
                  {isNotNull && !isPk && (
                    <span className="text-[10px] font-mono text-monokai-pink flex items-center gap-1">
                      <AlertCircle size={10} /> 必填 (NOT NULL)
                    </span>
                  )}
                </div>

                <input
                  type="text"
                  value={formData[col.name] ?? ''}
                  onChange={e => handleFieldChange(col.name, e.target.value)}
                  placeholder={col.dflt_value ? `默认值: ${col.dflt_value}` : isNotNull ? '必填值…' : 'NULL (留空)'}
                  className="w-full h-8 bg-monokai-bg border border-monokai-border focus:border-monokai-accent/60 focus:ring-1 focus:ring-monokai-accent/30 rounded-md px-3 text-xs font-mono text-monokai-fg placeholder:text-monokai-comment focus:outline-none transition-colors"
                />
              </div>
            );
          })}
        </div>

        {/* Live SQL Preview Box */}
        <div className="rounded-lg border border-monokai-border bg-monokai-bg p-3.5 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-monokai-comment">
            <span className="flex items-center gap-1.5 text-monokai-fg-muted font-medium">
              <Sparkles size={13} className="text-monokai-accent" /> 即时执行 SQL 预览
            </span>
            <button
              type="button"
              onClick={handleCopySql}
              className="flex items-center gap-1 hover:text-monokai-fg transition-colors cursor-pointer text-xs"
            >
              {copied ? <Check size={12} className="text-monokai-green" /> : <Copy size={12} />}
              <span>{copied ? '已复制' : '复制 SQL'}</span>
            </button>
          </div>
          <pre className="text-xs font-mono text-monokai-fg overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-28 custom-scrollbar bg-monokai-surface/40 p-2.5 rounded-md border border-monokai-border/40">
            {generatedSql}
          </pre>
        </div>
      </div>
    </ModalShell>
  );
};

export default InsertRowModal;
