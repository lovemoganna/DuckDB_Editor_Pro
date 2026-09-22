import React, { useState, useMemo, useRef } from 'react';
import { duckDBService } from '../services/duckdbService';
import { ModalShell } from './ui/Workbench';
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
  { type: 'INTEGER', category: 'numeric', icon: '#', color: 'text-[#66d9ef]', badgeBg: 'bg-[#252623] text-[#66d9ef] border-[#3a3b36]' },
  { type: 'BIGINT', category: 'numeric', icon: '#', color: 'text-[#66d9ef]', badgeBg: 'bg-[#252623] text-[#66d9ef] border-[#3a3b36]' },
  { type: 'DOUBLE', category: 'numeric', icon: '#', color: 'text-[#66d9ef]', badgeBg: 'bg-[#252623] text-[#66d9ef] border-[#3a3b36]' },
  { type: 'FLOAT', category: 'numeric', icon: '#', color: 'text-[#66d9ef]', badgeBg: 'bg-[#252623] text-[#66d9ef] border-[#3a3b36]' },
  { type: 'DECIMAL(18,2)', category: 'numeric', icon: '#', color: 'text-[#66d9ef]', badgeBg: 'bg-[#252623] text-[#66d9ef] border-[#3a3b36]' },
  { type: 'VARCHAR', category: 'text', icon: 'Aa', color: 'text-[#e6db74]', badgeBg: 'bg-[#252623] text-[#e6db74] border-[#3a3b36]' },
  { type: 'UUID', category: 'text', icon: 'ID', color: 'text-[#e6db74]', badgeBg: 'bg-[#252623] text-[#e6db74] border-[#3a3b36]' },
  { type: 'TIMESTAMP', category: 'datetime', icon: '🕒', color: 'text-[#ae81ff]', badgeBg: 'bg-[#252623] text-[#ae81ff] border-[#3a3b36]' },
  { type: 'DATE', category: 'datetime', icon: '📅', color: 'text-[#ae81ff]', badgeBg: 'bg-[#252623] text-[#ae81ff] border-[#3a3b36]' },
  { type: 'BOOLEAN', category: 'boolean', icon: '0/1', color: 'text-[#f92672]', badgeBg: 'bg-[#252623] text-[#f92672] border-[#3a3b36]' },
  { type: 'JSON', category: 'json', icon: '{}', color: 'text-[#a6e22e]', badgeBg: 'bg-[#252623] text-[#a6e22e] border-[#3a3b36]' },
];

const getTypeMeta = (type: string): DataTypeMeta => {
  const found = COMMON_DATA_TYPES.find(d => d.type.toUpperCase() === type.toUpperCase());
  if (found) return found;
  const t = type.toUpperCase();
  if (t.includes('INT') || t.includes('DOUBLE') || t.includes('FLOAT') || t.includes('DECIMAL')) {
    return { type, category: 'numeric', icon: '#', color: 'text-[#66d9ef]', badgeBg: 'bg-[#252623] text-[#66d9ef] border-[#3a3b36]' };
  }
  if (t.includes('VARCHAR') || t.includes('TEXT') || t.includes('CHAR') || t.includes('UUID')) {
    return { type, category: 'text', icon: 'Aa', color: 'text-[#e6db74]', badgeBg: 'bg-[#252623] text-[#e6db74] border-[#3a3b36]' };
  }
  if (t.includes('TIME') || t.includes('DATE')) {
    return { type, category: 'datetime', icon: '🕒', color: 'text-[#ae81ff]', badgeBg: 'bg-[#252623] text-[#ae81ff] border-[#3a3b36]' };
  }
  if (t.includes('BOOL')) {
    return { type, category: 'boolean', icon: '0/1', color: 'text-[#f92672]', badgeBg: 'bg-[#252623] text-[#f92672] border-[#3a3b36]' };
  }
  if (t.includes('JSON')) {
    return { type, category: 'json', icon: '{}', color: 'text-[#a6e22e]', badgeBg: 'bg-[#252623] text-[#a6e22e] border-[#3a3b36]' };
  }
  return { type, category: 'other', icon: 'Aa', color: 'text-[#66d9ef]', badgeBg: 'bg-[#252623] text-[#66d9ef] border-[#3a3b36]' };
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
          <div className="text-[11px] text-[#75715e] hidden sm:flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[#1e1f1c] border border-[#3a3b36] font-mono text-[10px] text-[#e6db74]">Enter</kbd>
              <span>自动添加列</span>
            </span>
            <span className="text-[#3a3b36]">·</span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[#1e1f1c] border border-[#3a3b36] font-mono text-[10px] text-[#e6db74]">Tab</kbd>
              <span>切换焦点</span>
            </span>
            <span className="text-[#3a3b36]">·</span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[#1e1f1c] border border-[#3a3b36] font-mono text-[10px] text-[#e6db74]">ESC</kbd>
              <span>关闭窗口</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-[4px] border border-[#3a3b36] bg-[#252623] text-xs font-medium text-[#d8d7cc] hover:text-[#f8f8f2] hover:bg-[#2d2e29] transition-colors cursor-pointer disabled:opacity-50"
            >
              取消
            </button>
            {onOpenSqlInTab && (
              <button
                type="button"
                onClick={() => {
                  onOpenSqlInTab(generatedDdl);
                  onClose();
                }}
                disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] border border-[#3a3b36] bg-[#2d2e29] text-xs font-semibold text-[#66d9ef] hover:border-[#66d9ef] hover:text-[#f8f8f2] transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <Terminal className="w-3.5 h-3.5 text-[#66d9ef]" />
                <span>在 SQL 编辑器中打开</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCreate}
              disabled={loading || !tableName.trim() || columns.some(c => !c.name.trim())}
              className="flex items-center gap-1.5 px-4.5 py-1.5 rounded-[4px] bg-[#e6db74] text-xs font-bold text-[#1e1f1c] hover:bg-[#d8cc60] active:scale-[0.98] transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="w-3.5 h-3.5 border-2 border-[#1e1f1c] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
              <span>立即创建数据表</span>
            </button>
          </div>
        </div>
      )}
    >
      <div className="space-y-3.5 font-sans text-xs">
        {/* 1. 表基础信息卡片 */}
        <div className="p-3.5 rounded-lg bg-[#181915] border border-[#33352f]/90 shadow-sm space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#f8f8f2] flex items-center gap-1.5" htmlFor="create-table-name">
                <span>数据表名称 (Table Name) <span className="text-[#f92672]">*</span></span>
              </label>
              <div className="flex items-center gap-1.5 text-[11px] text-[#75715e]">
                <span>创建于当前 Schema:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#252623] text-[#e6db74] border border-[#3a3b36] font-mono font-semibold text-[11px]">
                  main
                </span>
              </div>
            </div>
            <div className="relative flex items-center">
              <div className="absolute left-3 flex items-center pointer-events-none text-[#75715e]">
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
                className="w-full h-9 pl-10 pr-4 rounded-[4px] bg-[#1c1d19] border border-[#3a3b36] focus:border-[#5c5d55] focus:bg-[#22231e] text-xs font-mono text-[#f8f8f2] placeholder-[#75715e] outline-none transition-all caret-[#f8f8f2]"
              />
            </div>
          </div>

          {/* 预设模板选择栏 */}
          <div className="pt-1 border-t border-[#2d2e29]">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-[11px] font-semibold text-[#939293] flex items-center gap-1 shrink-0">
                <Sparkles className="w-3 h-3 text-[#e6db74]" /> 快捷模板配置:
              </span>
              {Object.entries(PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleApplyPreset(key)}
                  className={`group px-2.5 py-1 rounded-[4px] text-xs font-sans transition-all cursor-pointer flex items-center gap-1.5 ${
                    activePreset === key
                      ? 'bg-[#2d2e29] text-[#e6db74] border border-[#5c5d55] font-semibold shadow-xs'
                      : 'bg-[#252623] hover:bg-[#2d2e29] text-[#d8d7cc] hover:text-[#f8f8f2] border border-[#3a3b36]'
                  }`}
                >
                  <span>{p.label}</span>
                  <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                    activePreset === key ? 'bg-[#181915] text-[#e6db74]' : 'bg-[#181915] text-[#75715e] group-hover:text-[#939293]'
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
                className={`px-2.5 py-1 rounded-[4px] text-xs font-sans transition-all cursor-pointer ${
                  activePreset === 'empty'
                    ? 'bg-[#2d2e29] text-[#e6db74] border border-[#5c5d55] font-semibold shadow-xs'
                    : 'bg-[#252623] hover:bg-[#2d2e29] text-[#75715e] hover:text-[#d8d7cc] border border-[#3a3b36]'
                }`}
              >
                仅单主键列
              </button>
            </div>
            {activePreset && PRESETS[activePreset] && (
              <p className="text-[11px] text-[#75715e] flex items-center gap-1 pl-1">
                <Info className="w-3 h-3 text-[#66d9ef] shrink-0" />
                <span>{PRESETS[activePreset].description}</span>
              </p>
            )}
          </div>
        </div>

        {/* 2. 字段定义工作台表格 (Columns Schema Designer) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-[#f8f8f2] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#66d9ef]" />
                <span>字段与类型定义 (Columns Schema)</span>
                <span className="text-[11px] font-semibold text-[#e6db74]">({columns.length} 列)</span>
              </label>
              {/* 实时遥测指标指示 */}
              <div className="hidden sm:flex items-center gap-1.5 pl-2">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#252623] border border-[#3a3b36] text-[10px] font-mono font-bold text-[#e6db74]">
                  <Key className="w-2.5 h-2.5" />
                  {pkCount} 主键
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#252623] border border-[#3a3b36] text-[10px] font-mono font-bold text-[#fd971f]">
                  {nnCount} 非空
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddColumn}
              className="flex items-center gap-1 px-3 py-1 rounded-[4px] bg-[#2d2e29] hover:bg-[#34352f] border border-[#3a3b36] hover:border-[#66d9ef] text-xs font-semibold text-[#66d9ef] hover:text-[#f8f8f2] transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>添加字段</span>
            </button>
          </div>

          <div className="border border-[#33352f] rounded-[6px] overflow-hidden bg-[#181915] shadow-sm">
            {/* 表头 */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-[#252623] border-b border-[#33352f] text-[11px] font-semibold text-[#75715e] uppercase tracking-wider select-none">
              <div className="col-span-3 pl-1">字段名称 (Name)</div>
              <div className="col-span-2">数据类型 (Type)</div>
              <div className="col-span-1 text-center">主键 (PK)</div>
              <div className="col-span-1 text-center">非空 (NN)</div>
              <div className="col-span-2 pl-1">默认值 (Default)</div>
              <div className="col-span-2 pl-1">字段注释 (Comment)</div>
              <div className="col-span-1 text-center">操作</div>
            </div>

            {/* 字段列表 */}
            <div className="max-h-64 overflow-y-auto divide-y divide-[#33352f]/50 p-1 space-y-1 custom-scrollbar bg-[#1c1d19]">
              {columns.map((col, idx) => {
                const meta = getTypeMeta(col.type);
                const isLast = idx === columns.length - 1;
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded-[3px] hover:bg-[#252623]/80 transition-colors group"
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
                        className="w-full h-7.5 px-2 bg-[#181915] border border-[#3a3b36] focus:border-[#5c5d55] rounded-[3px] text-xs font-mono text-[#f8f8f2] focus:outline-none transition-colors caret-[#f8f8f2]"
                      />
                    </div>

                    {/* 数据类型 + 类型微图标 */}
                    <div className="col-span-2 relative">
                      <div className="flex items-center bg-[#181915] border border-[#3a3b36] focus-within:border-[#5c5d55] rounded-[3px] overflow-hidden">
                        <span className={`px-1.5 py-0.5 text-[10px] font-mono font-bold border-r border-[#3a3b36] select-none ${meta.badgeBg}`}>
                          {meta.icon}
                        </span>
                        <select
                          value={col.type}
                          onChange={e => handleUpdateColumn(idx, { type: e.target.value })}
                          className={`w-full h-7.5 pl-1.5 pr-1 bg-transparent text-xs font-mono font-semibold focus:outline-none cursor-pointer ${meta.color}`}
                        >
                          {COMMON_DATA_TYPES.map(t => (
                            <option key={t.type} value={t.type} className="bg-[#252623] text-[#f8f8f2]">
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
                        className="w-full h-7.5 px-2 bg-[#181915] border border-[#3a3b36] focus:border-[#5c5d55] rounded-[3px] text-xs font-mono text-[#ae81ff] placeholder-[#75715e] focus:outline-none caret-[#f8f8f2]"
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
                        className="w-full h-7.5 px-2 bg-[#181915] border border-[#3a3b36] focus:border-[#5c5d55] rounded-[3px] text-xs font-sans text-[#f8f8f2] placeholder-[#75715e] focus:outline-none caret-[#f8f8f2]"
                      />
                    </div>

                    {/* 操作组：上移、下移、复制、删除 */}
                    <div className="col-span-1 flex items-center justify-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-[#34352f] text-[#75715e] hover:text-[#f8f8f2] disabled:opacity-20 cursor-pointer transition-colors"
                        title="上移"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx === columns.length - 1}
                        className="p-1 rounded hover:bg-[#34352f] text-[#75715e] hover:text-[#f8f8f2] disabled:opacity-20 cursor-pointer transition-colors"
                        title="下移"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateColumn(idx)}
                        className="p-1 rounded hover:bg-[#34352f] text-[#75715e] hover:text-[#66d9ef] cursor-pointer transition-colors"
                        title="复制该行"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveColumn(idx)}
                        disabled={columns.length <= 1}
                        className="p-1 rounded hover:bg-[#382025] text-[#75715e] hover:text-[#f92672] disabled:opacity-20 cursor-pointer transition-colors"
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
            <span className="text-[11px] font-semibold text-[#75715e] uppercase tracking-wider flex items-center gap-1.5">
              <Code2 className="w-3 h-3 text-[#a6e22e]" />
              <span>实时 DDL 语句预览 (Live DDL Cockpit)</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#75715e] hidden sm:inline">DuckDB SQL · 语法就绪</span>
              <button
                type="button"
                onClick={handleCopyDdl}
                className="flex items-center gap-1 text-[11px] text-[#66d9ef] hover:text-[#f8f8f2] font-sans cursor-pointer transition-colors px-2 py-0.5 rounded hover:bg-[#252623]"
                title="复制代码到剪贴板"
              >
                {copied ? <Check className="w-3 h-3 text-[#a6e22e]" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? '已复制' : '复制代码'}</span>
              </button>
            </div>
          </div>

          <div className="rounded-[6px] bg-[#181915] border border-[#33352f] overflow-hidden shadow-sm">
            {/* IDE 终端标签栏 */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#22231e] border-b border-[#33352f] select-none">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f92672]/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#e6db74]/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#a6e22e]/80 inline-block" />
                <span className="ml-2 font-mono text-[11px] text-[#939293]">{tableName.trim() || 'new_table'}.sql</span>
                <span className="text-[10px] font-mono text-[#75715e]">({ddlLines.length} 行)</span>
              </div>
              <button
                type="button"
                onClick={handleCopyDdl}
                className="flex items-center gap-1 text-[10.5px] font-mono text-[#d8d7cc] hover:text-[#e6db74] hover:bg-[#2d2e29] border border-[#3a3b36] hover:border-[#e6db74]/60 px-2 py-0.5 rounded cursor-pointer transition-all shadow-xs"
                title="复制代码 (Copy DDL)"
              >
                {copied ? <Check className="w-3 h-3 text-[#a6e22e]" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? '已复制' : '复制代码'}</span>
              </button>
            </div>

            {/* DDL 代码区域 */}
            <div className="p-3 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-32 custom-scrollbar flex">
              <span className="sr-only">{generatedDdl}</span>
              {/* 行号槽 */}
              <div className="select-none text-[#5c584a] pr-3 text-right border-r border-[#2d2e29] mr-3 shrink-0">
                {ddlLines.map((_, i) => (
                  <div key={i}>{String(i + 1).padStart(2, '0')}</div>
                ))}
              </div>
              {/* 代码内容 */}
              <div className="flex-1">
                <div>
                  <span className="text-[#f92672] font-bold">CREATE TABLE </span>
                  <span className="text-[#f8f8f2]">"{tableName.trim() || 'new_table'}" </span>
                  <span className="text-[#75715e]">(</span>
                </div>
                {columns.map((col, idx) => {
                  const isLast = idx === columns.length - 1 && !columns.some(c => c.pk);
                  return (
                    <div key={idx} className="pl-4">
                      <span className="text-[#f8f8f2]">"{col.name.trim() || 'unnamed_col'}" </span>
                      <span className="text-[#66d9ef]">{col.type}</span>
                      {col.notNull && !col.pk && <span className="text-[#f92672]"> NOT NULL</span>}
                      {col.defaultValue && col.defaultValue.trim() && (
                        <>
                          <span className="text-[#f92672]"> DEFAULT </span>
                          <span className="text-[#ae81ff]">{col.defaultValue.trim()}</span>
                        </>
                      )}
                      {(!isLast || columns.some(c => c.pk)) && <span className="text-[#75715e]">,</span>}
                    </div>
                  );
                })}
                {columns.some(c => c.pk) && (
                  <div className="pl-4">
                    <span className="text-[#f92672]">PRIMARY KEY </span>
                    <span className="text-[#75715e]">(</span>
                    <span className="text-[#f8f8f2]">
                      {columns.filter(c => c.pk).map(c => `"${c.name.trim() || 'unnamed_col'}"`).join(', ')}
                    </span>
                    <span className="text-[#75715e]">)</span>
                  </div>
                )}
                <div><span className="text-[#75715e]">);</span></div>
                {columns.some(c => Boolean(c.comment?.trim())) && (
                  <div className="mt-2 pt-2 border-t border-[#2d2e29]/60">
                    {columns.filter(c => Boolean(c.comment?.trim())).map((c, i) => (
                      <div key={i} className="text-[#75715e]">
                        <span className="text-[#f92672]">COMMENT ON COLUMN </span>
                        <span className="text-[#f8f8f2]">"{tableName.trim() || 'new_table'}"."{c.name.trim() || 'unnamed_col'}" </span>
                        <span className="text-[#f92672]">IS </span>
                        <span className="text-[#e6db74]">'{c.comment!.trim().replace(/'/g, "''")}'</span>
                        <span className="text-[#75715e]">;</span>
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
