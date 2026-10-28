import React, { useState, useMemo, useRef } from 'react';
import { duckDBService } from '../services/duckdbService';
import { ModalShell, ActionButton } from './ui/Workbench';
import {
  Table2,
  Plus,
  Trash2,
  Copy,
  Check,
  Code2,
  Sparkles,
  Key,
  Terminal,
  ArrowUp,
  ArrowDown,
  Info,
  Layers,
} from 'lucide-react';
import { toastService } from '../services/toastService';

export interface ColumnDefinition {
  name: string;
  type: string;
  pk: boolean;
  notNull: boolean;
  defaultValue?: string;
  comment?: string;
}

interface DataTypeMeta {
  type: string;
  category: 'numeric' | 'text' | 'datetime' | 'boolean' | 'json' | 'other';
  icon: string;
  color: string;
  badgeBg: string;
}

const COMMON_DATA_TYPES: DataTypeMeta[] = [
  { type: 'INTEGER', category: 'numeric', icon: '#', color: 'text-monokai-cyan', badgeBg: 'bg-monokai-surface text-monokai-cyan border-monokai-border' },
  { type: 'BIGINT', category: 'numeric', icon: '#', color: 'text-monokai-cyan', badgeBg: 'bg-monokai-surface text-monokai-cyan border-monokai-border' },
  { type: 'DOUBLE', category: 'numeric', icon: '#', color: 'text-monokai-cyan', badgeBg: 'bg-monokai-surface text-monokai-cyan border-monokai-border' },
  { type: 'FLOAT', category: 'numeric', icon: '#', color: 'text-monokai-cyan', badgeBg: 'bg-monokai-surface text-monokai-cyan border-monokai-border' },
  { type: 'DECIMAL(18,2)', category: 'numeric', icon: '#', color: 'text-monokai-cyan', badgeBg: 'bg-monokai-surface text-monokai-cyan border-monokai-border' },
  { type: 'VARCHAR', category: 'text', icon: 'Aa', color: 'text-monokai-yellow', badgeBg: 'bg-monokai-surface text-monokai-yellow border-monokai-border' },
  { type: 'UUID', category: 'text', icon: 'ID', color: 'text-monokai-yellow', badgeBg: 'bg-monokai-surface text-monokai-yellow border-monokai-border' },
  { type: 'TIMESTAMP', category: 'datetime', icon: '🕒', color: 'text-monokai-purple', badgeBg: 'bg-monokai-surface text-monokai-purple border-monokai-border' },
  { type: 'DATE', category: 'datetime', icon: '📅', color: 'text-monokai-purple', badgeBg: 'bg-monokai-surface text-monokai-purple border-monokai-border' },
  { type: 'BOOLEAN', category: 'boolean', icon: '0/1', color: 'text-monokai-pink', badgeBg: 'bg-monokai-surface text-monokai-pink border-monokai-border' },
  { type: 'JSON', category: 'json', icon: '{}', color: 'text-monokai-accent', badgeBg: 'bg-monokai-surface text-monokai-accent border-monokai-border' },
];

const getTypeMeta = (type: string): DataTypeMeta => {
  const found = COMMON_DATA_TYPES.find(d => d.type.toUpperCase() === type.toUpperCase());
  if (found) return found;
  const t = type.toUpperCase();
  if (t.includes('INT') || t.includes('DOUBLE') || t.includes('FLOAT') || t.includes('DECIMAL')) {
    return { type, category: 'numeric', icon: '#', color: 'text-monokai-cyan', badgeBg: 'bg-monokai-surface text-monokai-cyan border-monokai-border' };
  }
  if (t.includes('VARCHAR') || t.includes('TEXT') || t.includes('CHAR') || t.includes('UUID')) {
    return { type, category: 'text', icon: 'Aa', color: 'text-monokai-yellow', badgeBg: 'bg-monokai-surface text-monokai-yellow border-monokai-border' };
  }
  if (t.includes('TIME') || t.includes('DATE')) {
    return { type, category: 'datetime', icon: '🕒', color: 'text-monokai-purple', badgeBg: 'bg-monokai-surface text-monokai-purple border-monokai-border' };
  }
  if (t.includes('BOOL')) {
    return { type, category: 'boolean', icon: '0/1', color: 'text-monokai-pink', badgeBg: 'bg-monokai-surface text-monokai-pink border-monokai-border' };
  }
  if (t.includes('JSON')) {
    return { type, category: 'json', icon: '{}', color: 'text-monokai-accent', badgeBg: 'bg-monokai-surface text-monokai-accent border-monokai-border' };
  }
  return { type, category: 'other', icon: 'Aa', color: 'text-monokai-cyan', badgeBg: 'bg-monokai-surface text-monokai-cyan border-monokai-border' };
};

interface PresetConfig {
  label: string;
  badge: string;
  description: string;
  columns: ColumnDefinition[];
}

const PRESETS: Record<string, PresetConfig> = {
  basic: {
    label: '基础主键表',
    badge: '通用推荐',
    description: '含自增主键 (BIGINT PK)、名称 (VARCHAR) 及自动生成创建时间戳',
    columns: [
      { name: 'id', type: 'BIGINT', pk: true, notNull: true, comment: '主键唯一标识' },
      { name: 'name', type: 'VARCHAR', pk: false, notNull: true, comment: '实体名称' },
      { name: 'created_at', type: 'TIMESTAMP', pk: false, notNull: true, defaultValue: 'CURRENT_TIMESTAMP', comment: '记录生成时间' },
    ],
  },
  timeseries: {
    label: '时序指标表',
    badge: '遥测分析',
    description: '含复合主键 (时间戳 + 指标名)、双精度浮点数值及 JSON 维度标签',
    columns: [
      { name: 'timestamp', type: 'TIMESTAMP', pk: true, notNull: true, defaultValue: 'CURRENT_TIMESTAMP', comment: '指标采集时间戳' },
      { name: 'metric_name', type: 'VARCHAR', pk: true, notNull: true, comment: '指标名称代码' },
      { name: 'metric_value', type: 'DOUBLE', pk: false, notNull: true, defaultValue: '0.0', comment: '指标遥测数值' },
      { name: 'tags', type: 'JSON', pk: false, notNull: false, defaultValue: "'{}'", comment: '多维扩展标签' },
    ],
  },
  ecommerce: {
    label: '电商订单表',
    badge: '业务事务',
    description: '含订单编码主键、客户编号、精确货币金额 (DECIMAL)、履约状态及时间戳',
    columns: [
      { name: 'order_id', type: 'VARCHAR', pk: true, notNull: true, comment: '业务订单编号' },
      { name: 'customer_id', type: 'VARCHAR', pk: false, notNull: true, comment: '下单客户编号' },
      { name: 'total_amount', type: 'DECIMAL(18,2)', pk: false, notNull: true, defaultValue: '0.00', comment: '实付总金额' },
      { name: 'status', type: 'VARCHAR', pk: false, notNull: true, defaultValue: "'pending'", comment: '订单流转状态' },
      { name: 'created_at', type: 'TIMESTAMP', pk: false, notNull: true, defaultValue: 'CURRENT_TIMESTAMP', comment: '订单创建时间' },
    ],
  },
};

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTableCreated: (tableName: string) => void;
  onRefreshTables: () => Promise<void>;
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
  onOpenSqlInTab?: (sql: string) => void;
}

export const CreateTableModal: React.FC<CreateTableModalProps> = ({
  isOpen,
  onClose,
  onTableCreated,
  onRefreshTables,
  onNotify,
  onOpenSqlInTab,
}) => {
  const [tableName, setTableName] = useState('');
  const [activePreset, setActivePreset] = useState<string | null>('basic');
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    { name: 'id', type: 'BIGINT', pk: true, notNull: true, comment: '主键唯一标识' },
    { name: 'name', type: 'VARCHAR', pk: false, notNull: false, comment: '名称' },
    { name: 'created_at', type: 'TIMESTAMP', pk: false, notNull: true, defaultValue: 'CURRENT_TIMESTAMP', comment: '创建时间' },
  ]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastNameInputRef = useRef<HTMLInputElement | null>(null);

  const pkCount = useMemo(() => columns.filter(c => c.pk).length, [columns]);
  const nnCount = useMemo(() => columns.filter(c => c.notNull).length, [columns]);

  const generatedDdl = useMemo(() => {
    const cleanName = tableName.trim() || 'new_table';
    const colClauses: string[] = [];
    const pkCols: string[] = [];
    const commentClauses: string[] = [];

    columns.forEach(col => {
      const colName = col.name.trim() || 'unnamed_col';
      let clause = `    "${colName}" ${col.type}`;
      if (col.notNull && !col.pk) {
        clause += ' NOT NULL';
      }
      if (col.defaultValue && col.defaultValue.trim()) {
        clause += ` DEFAULT ${col.defaultValue.trim()}`;
      }
      if (col.pk) {
        pkCols.push(`"${colName}"`);
      }
      colClauses.push(clause);

      if (col.comment && col.comment.trim()) {
        commentClauses.push(`COMMENT ON COLUMN "${cleanName}"."${colName}" IS '${col.comment.trim().replace(/'/g, "''")}';`);
      }
    });

    if (pkCols.length > 0) {
      colClauses.push(`    PRIMARY KEY (${pkCols.join(', ')})`);
    }

    let ddl = `CREATE TABLE "${cleanName}" (\n${colClauses.join(',\n')}\n);`;
    if (commentClauses.length > 0) {
      ddl += `\n\n${commentClauses.join('\n')}`;
    }
    return ddl;
  }, [tableName, columns]);

  const handleAddColumn = () => {
    setColumns(prev => [
      ...prev,
      { name: `col_${prev.length + 1}`, type: 'VARCHAR', pk: false, notNull: false },
    ]);
    setTimeout(() => {
      lastNameInputRef.current?.focus();
      lastNameInputRef.current?.select();
    }, 50);
  };

  const handleRemoveColumn = (index: number) => {
    if (columns.length <= 1) return;
    setColumns(prev => prev.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setColumns(prev => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= columns.length - 1) return;
    setColumns(prev => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleDuplicateColumn = (index: number) => {
    const target = columns[index];
    const duplicated: ColumnDefinition = {
      ...target,
      name: `${target.name || 'col'}_copy`,
      pk: false,
    };
    setColumns(prev => {
      const next = [...prev];
      next.splice(index + 1, 0, duplicated);
      return next;
    });
  };

  const handleUpdateColumn = (index: number, patch: Partial<ColumnDefinition>) => {
    setColumns(prev => prev.map((col, i) => (i === index ? { ...col, ...patch } : col)));
  };

  const handleApplyPreset = (presetKey: string) => {
    const p = PRESETS[presetKey];
    if (p) {
      setColumns(JSON.parse(JSON.stringify(p.columns)));
      setActivePreset(presetKey);
      if (!tableName) {
        setTableName(presetKey === 'basic' ? 'users' : presetKey === 'timeseries' ? 'system_metrics' : 'orders');
      }
    }
  };

  const handleCopyDdl = async () => {
    try {
      await navigator.clipboard.writeText(generatedDdl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toastService.info('DDL 已成功复制到剪贴板');
    } catch {
      // fallback
    }
  };

  const handleCreate = async () => {
    if (!tableName.trim()) return;
    setLoading(true);
    try {
      await duckDBService.executeAndAudit(
        generatedDdl,
        'CREATE',
        tableName.trim(),
        `Created table with ${columns.length} columns`
      );
      toastService.success(`数据表 "${tableName.trim()}" 创建成功`);
      if (onNotify) {
        onNotify(`Table "${tableName}" created`, 'success');
      }
      await onRefreshTables();
      onTableCreated(tableName.trim());
      onClose();
      setTableName('');
    } catch (e: any) {
      toastService.error('创建数据表失败', e.message || String(e));
      if (onNotify) {
        onNotify(e.message || 'Failed to create table', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const ddlLines = useMemo(() => generatedDdl.split('\n'), [generatedDdl]);

  return (
    <ModalShell
      open={isOpen}
      title="新建数据表 (Create Table)"
      description="在 DuckDB 数据库中可视化定义列结构、数据类型、主键与约束，实时生成生产级 DDL"
      onClose={onClose}
      size="xl"
      footer={(
        <div className="flex items-center justify-between w-full font-sans">
          <div className="text-[11px] text-monokai-comment hidden sm:flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-monokai-surface border border-monokai-border font-mono text-[10px] text-monokai-yellow">Enter</kbd>
              <span>自动添加列</span>
            </span>
            <span className="text-monokai-border">·</span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-monokai-surface border border-monokai-border font-mono text-[10px] text-monokai-yellow">Tab</kbd>
              <span>切换焦点</span>
            </span>
            <span className="text-monokai-border">·</span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-monokai-surface border border-monokai-border font-mono text-[10px] text-monokai-yellow">ESC</kbd>
              <span>关闭窗口</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ActionButton
              type="button"
              onClick={onClose}
              disabled={loading}
              variant="secondary"
            >
              取消
            </ActionButton>
            {onOpenSqlInTab && (
              <ActionButton
                type="button"
                onClick={() => {
                  onOpenSqlInTab(generatedDdl);
                  onClose();
                }}
                disabled={loading}
                variant="secondary"
                icon={Terminal}
              >
                在 SQL 编辑器中打开
              </ActionButton>
            )}
            <ActionButton
              type="button"
              onClick={handleCreate}
              disabled={loading || !tableName.trim() || columns.some(c => !c.name.trim())}
              variant="primary"
              icon={Check}
              loading={loading}
            >
              立即创建数据表
            </ActionButton>
          </div>
        </div>
      )}
    >
      <div className="space-y-3.5 font-sans text-xs">
        {/* 1. 表基础信息卡片 */}
        <div className="p-3.5 rounded-lg bg-monokai-surface border border-monokai-border shadow-sm space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-monokai-fg flex items-center gap-1.5" htmlFor="create-table-name">
                <span>数据表名称 (Table Name) <span className="text-monokai-pink">*</span></span>
              </label>
              <div className="flex items-center gap-1.5 text-[11px] text-monokai-comment">
                <span>创建于当前 Schema:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-monokai-elevated text-monokai-yellow border border-monokai-border font-mono font-semibold text-[11px]">
                  main
                </span>
              </div>
            </div>
            <div className="relative flex items-center">
              <div className="absolute left-3 flex items-center pointer-events-none text-monokai-comment">
                <Table2 className="h-4 w-4" />
              </div>
              <input
                id="create-table-name"
                type="text"
                autoFocus
                value={tableName}
                onChange={e => setTableName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddColumn();
                  }
                }}
                placeholder="例如：customer_orders, user_profiles"
                className="w-full h-9 pl-10 pr-4 rounded-lg bg-monokai-bg border border-monokai-border focus:border-monokai-accent text-xs font-mono text-monokai-fg placeholder-monokai-comment outline-none transition-all"
              />
            </div>
          </div>

          {/* 预设模板选择栏 */}
          <div className="pt-1 border-t border-monokai-border-subtle">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-[11px] font-semibold text-monokai-fg-muted flex items-center gap-1 shrink-0">
                <Sparkles className="w-3 h-3 text-monokai-yellow" /> 快捷模板配置:
              </span>
              {Object.entries(PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleApplyPreset(key)}
                  className={`group px-2.5 py-1 rounded-lg text-xs font-sans transition-all cursor-pointer flex items-center gap-1.5 ${
                    activePreset === key
                      ? 'bg-monokai-elevated text-monokai-accent border border-monokai-accent/40 font-semibold shadow-xs'
                      : 'bg-monokai-surface hover:bg-monokai-elevated text-monokai-fg-muted hover:text-monokai-fg border border-monokai-border'
                  }`}
                >
                  <span>{p.label}</span>
                  <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                    activePreset === key ? 'bg-monokai-bg text-monokai-accent' : 'bg-monokai-bg text-monokai-comment group-hover:text-monokai-fg-muted'
                  }`}>
                    {p.badge}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setColumns([{ name: 'id', type: 'BIGINT', pk: true, notNull: true, comment: '主键' }]);
                  setActivePreset('empty');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-sans transition-all cursor-pointer ${
                  activePreset === 'empty'
                    ? 'bg-monokai-elevated text-monokai-accent border border-monokai-accent/40 font-semibold shadow-xs'
                    : 'bg-monokai-surface hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-fg border border-monokai-border'
                }`}
              >
                仅单主键列
              </button>
            </div>
            {activePreset && PRESETS[activePreset] && (
              <p className="text-[11px] text-monokai-comment flex items-center gap-1 pl-1">
                <Info className="w-3 h-3 text-monokai-cyan shrink-0" />
                <span>{PRESETS[activePreset].description}</span>
              </p>
            )}
          </div>
        </div>

        {/* 2. 字段定义工作台表格 (Columns Schema Designer) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-monokai-fg flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-monokai-cyan" />
                <span>字段与类型定义 (Columns Schema)</span>
                <span className="text-[11px] font-semibold text-monokai-yellow">({columns.length} 列)</span>
              </label>
              {/* 实时遥测指标指示 */}
              <div className="hidden sm:flex items-center gap-1.5 pl-2">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-monokai-surface border border-monokai-border text-[10px] font-mono font-bold text-monokai-yellow">
                  <Key className="w-2.5 h-2.5" />
                  {pkCount} 主键
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-monokai-surface border border-monokai-border text-[10px] font-mono font-bold text-monokai-orange">
                  {nnCount} 非空
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddColumn}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border hover:border-monokai-cyan/50 text-xs font-semibold text-monokai-cyan hover:text-monokai-fg transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>添加字段</span>
            </button>
          </div>

          <div className="border border-monokai-border rounded-lg overflow-hidden bg-monokai-surface shadow-sm">
            {/* 表头 */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-monokai-elevated border-b border-monokai-border text-[11px] font-semibold text-monokai-comment uppercase tracking-wider select-none">
              <div className="col-span-3 pl-1">字段名称 (Name)</div>
              <div className="col-span-2">数据类型 (Type)</div>
              <div className="col-span-1 text-center">主键 (PK)</div>
              <div className="col-span-1 text-center">非空 (NN)</div>
              <div className="col-span-2 pl-1">默认值 (Default)</div>
              <div className="col-span-2 pl-1">字段注释 (Comment)</div>
              <div className="col-span-1 text-center">操作</div>
            </div>

            {/* 字段列表 */}
            <div className="max-h-64 overflow-y-auto divide-y divide-monokai-border/40 p-1 space-y-1 custom-scrollbar bg-monokai-bg">
              {columns.map((col, idx) => {
                const meta = getTypeMeta(col.type);
                const isLast = idx === columns.length - 1;
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded-md hover:bg-monokai-surface transition-colors group"
                  >
                    {/* 字段名称 */}
                    <div className="col-span-3">
                      <input
                        ref={isLast ? lastNameInputRef : undefined}
                        type="text"
                        value={col.name}
                        onChange={e => handleUpdateColumn(idx, { name: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddColumn();
                          }
                        }}
                        placeholder="column_name"
                        className="w-full h-7.5 px-2 bg-monokai-surface border border-monokai-border focus:border-monokai-accent rounded-md text-xs font-mono text-monokai-fg focus:outline-none transition-colors"
                      />
                    </div>

                    {/* 数据类型 + 类型微图标 */}
                    <div className="col-span-2 relative">
                      <div className="flex items-center bg-monokai-surface border border-monokai-border focus-within:border-monokai-accent rounded-md overflow-hidden">
                        <span className={`px-1.5 py-0.5 text-[10px] font-mono font-bold border-r border-monokai-border select-none ${meta.badgeBg}`}>
                          {meta.icon}
                        </span>
                        <select
                          value={col.type}
                          onChange={e => handleUpdateColumn(idx, { type: e.target.value })}
                          className={`w-full h-7.5 pl-1.5 pr-1 bg-transparent text-xs font-mono font-semibold focus:outline-none cursor-pointer ${meta.color}`}
                        >
                          {COMMON_DATA_TYPES.map(t => (
                            <option key={t.type} value={t.type} className="bg-monokai-surface text-monokai-fg">
                              {t.type}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* 主键 (PK) */}
                    <div className="col-span-1 flex justify-center">
                      <label className="flex items-center justify-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={col.pk}
                          onChange={e => handleUpdateColumn(idx, { pk: e.target.checked, notNull: e.target.checked ? true : col.notNull })}
                          className="sr-only"
                        />
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-all ${
                          col.pk
                            ? 'bg-monokai-yellow/15 text-monokai-yellow'
                            : 'bg-monokai-surface text-monokai-comment hover:text-monokai-fg'
                        }`}>
                          <Key className="w-2.5 h-2.5" />
                          PK
                        </span>
                      </label>
                    </div>

                    {/* 非空 (NN) */}
                    <div className="col-span-1 flex justify-center">
                      <label className="flex items-center justify-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={col.notNull}
                          disabled={col.pk}
                          onChange={e => handleUpdateColumn(idx, { notNull: e.target.checked })}
                          className="sr-only"
                        />
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-all ${
                          col.pk
                            ? 'bg-monokai-surface text-monokai-comment opacity-40 cursor-not-allowed'
                            : col.notNull
                            ? 'bg-monokai-orange/15 text-monokai-orange'
                            : 'bg-monokai-surface text-monokai-comment hover:text-monokai-fg'
                        }`}>
                          NN
                        </span>
                      </label>
                    </div>

                    {/* 默认值 */}
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={col.defaultValue || ''}
                        onChange={e => handleUpdateColumn(idx, { defaultValue: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddColumn();
                          }
                        }}
                        placeholder="NULL"
                        className="w-full h-7.5 px-2 bg-monokai-surface border border-monokai-border focus:border-monokai-accent rounded-md text-xs font-mono text-monokai-purple placeholder-monokai-comment focus:outline-none"
                      />
                    </div>

                    {/* 字段注释 */}
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={col.comment || ''}
                        onChange={e => handleUpdateColumn(idx, { comment: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddColumn();
                          }
                        }}
                        placeholder="注释..."
                        className="w-full h-7.5 px-2 bg-monokai-surface border border-monokai-border focus:border-monokai-accent rounded-md text-xs font-sans text-monokai-fg placeholder-monokai-comment focus:outline-none"
                      />
                    </div>

                    {/* 操作组：上移、下移、复制、删除 */}
                    <div className="col-span-1 flex items-center justify-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-fg disabled:opacity-20 cursor-pointer transition-colors"
                        title="上移"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx === columns.length - 1}
                        className="p-1 rounded hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-fg disabled:opacity-20 cursor-pointer transition-colors"
                        title="下移"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateColumn(idx)}
                        className="p-1 rounded hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-cyan cursor-pointer transition-colors"
                        title="复制该行"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveColumn(idx)}
                        disabled={columns.length <= 1}
                        className="p-1 rounded hover:bg-monokai-pink/15 text-monokai-comment hover:text-monokai-pink disabled:opacity-20 cursor-pointer transition-colors"
                        title="删除该列"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. 实时 DDL 语句预览区 (Live DDL Cockpit) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-monokai-comment uppercase tracking-wider flex items-center gap-1.5">
              <Code2 className="w-3 h-3 text-monokai-accent" />
              <span>实时 DDL 语句预览 (Live DDL Cockpit)</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-monokai-comment hidden sm:inline">DuckDB SQL · 语法就绪</span>
              <button
                type="button"
                onClick={handleCopyDdl}
                className="flex items-center gap-1 text-[11px] text-monokai-cyan hover:text-monokai-fg font-sans cursor-pointer transition-colors px-2 py-0.5 rounded hover:bg-monokai-elevated"
                title="复制代码到剪贴板"
              >
                {copied ? <Check className="w-3 h-3 text-monokai-accent" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? '已复制' : '复制代码'}</span>
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-monokai-surface border border-monokai-border overflow-hidden shadow-sm">
            {/* IDE 终端标签栏 */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-monokai-elevated border-b border-monokai-border select-none">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-monokai-pink/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-monokai-yellow/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-monokai-accent/80 inline-block" />
                <span className="ml-2 font-mono text-[11px] text-monokai-fg-muted">{tableName.trim() || 'new_table'}.sql</span>
                <span className="text-[10px] font-mono text-monokai-comment">({ddlLines.length} 行)</span>
              </div>
              <button
                type="button"
                onClick={handleCopyDdl}
                className="flex items-center gap-1 text-[10.5px] font-mono text-monokai-fg-muted hover:text-monokai-yellow hover:bg-monokai-surface border border-monokai-border hover:border-monokai-yellow/60 px-2 py-0.5 rounded cursor-pointer transition-all shadow-xs"
                title="复制代码 (Copy DDL)"
              >
                {copied ? <Check className="w-3 h-3 text-monokai-accent" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? '已复制' : '复制代码'}</span>
              </button>
            </div>

            {/* DDL 代码区域 */}
            <div className="p-3 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-32 custom-scrollbar flex bg-monokai-bg">
              <span className="sr-only">{generatedDdl}</span>
              {/* 行号槽 */}
              <div className="select-none text-monokai-comment pr-3 text-right border-r border-monokai-border-subtle mr-3 shrink-0">
                {ddlLines.map((_, i) => (
                  <div key={i}>{String(i + 1).padStart(2, '0')}</div>
                ))}
              </div>
              {/* 代码内容 */}
              <div className="flex-1">
                <div>
                  <span className="text-monokai-pink font-bold">CREATE TABLE </span>
                  <span className="text-monokai-fg">"{tableName.trim() || 'new_table'}" </span>
                  <span className="text-monokai-comment">(</span>
                </div>
                {columns.map((col, idx) => {
                  const isLast = idx === columns.length - 1 && !columns.some(c => c.pk);
                  return (
                    <div key={idx} className="pl-4">
                      <span className="text-monokai-fg">"{col.name.trim() || 'unnamed_col'}" </span>
                      <span className="text-monokai-cyan">{col.type}</span>
                      {col.notNull && !col.pk && <span className="text-monokai-pink"> NOT NULL</span>}
                      {col.defaultValue && col.defaultValue.trim() && (
                        <>
                          <span className="text-monokai-pink"> DEFAULT </span>
                          <span className="text-monokai-purple">{col.defaultValue.trim()}</span>
                        </>
                      )}
                      {(!isLast || columns.some(c => c.pk)) && <span className="text-monokai-comment">,</span>}
                    </div>
                  );
                })}
                {columns.some(c => c.pk) && (
                  <div className="pl-4">
                    <span className="text-monokai-pink">PRIMARY KEY </span>
                    <span className="text-monokai-comment">(</span>
                    <span className="text-monokai-fg">
                      {columns.filter(c => c.pk).map(c => `"${c.name.trim() || 'unnamed_col'}"`).join(', ')}
                    </span>
                    <span className="text-monokai-comment">)</span>
                  </div>
                )}
                <div><span className="text-monokai-comment">);</span></div>
                {columns.some(c => Boolean(c.comment?.trim())) && (
                  <div className="mt-2 pt-2 border-t border-monokai-border-subtle">
                    {columns.filter(c => Boolean(c.comment?.trim())).map((c, i) => (
                      <div key={i} className="text-monokai-comment">
                        <span className="text-monokai-pink">COMMENT ON COLUMN </span>
                        <span className="text-monokai-fg">"{tableName.trim() || 'new_table'}"."{c.name.trim() || 'unnamed_col'}" </span>
                        <span className="text-monokai-pink">IS </span>
                        <span className="text-monokai-yellow">'{c.comment!.trim().replace(/'/g, "''")}'</span>
                        <span className="text-monokai-comment">;</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};

export default CreateTableModal;
