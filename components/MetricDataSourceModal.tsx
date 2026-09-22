import React, { useState } from 'react';
import { Database, X, Copy, Check, FileSpreadsheet, FileCode, Layers, Server } from 'lucide-react';
import { ActionButton, IconButton } from './ui/Workbench';
import { toastService } from '../services/toastService';

interface MetricDataSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DataSourceType = 'csv' | 'parquet' | 'json' | 'sqlite';

const DATA_SOURCE_TYPES: { type: DataSourceType; label: string; icon: typeof Database; desc: string; ext: string }[] = [
  { type: 'csv', label: 'CSV / TSV 文件', icon: FileSpreadsheet, desc: '本地或远程 HTTP(S) CSV 结构化文件', ext: '.csv, .tsv' },
  { type: 'parquet', label: 'Parquet 列存', icon: Layers, desc: '高性能分析列存格式，支持零拷贝扫描', ext: '.parquet' },
  { type: 'json', label: 'JSON / NDJSON', icon: FileCode, desc: '嵌套或半结构化文档数据流', ext: '.json, .ndjson' },
  { type: 'sqlite', label: 'SQLite 数据库', icon: Server, desc: '通过 ATTACH 挂载本地 SQLite 库', ext: '.db, .sqlite' },
];

export const MetricDataSourceModal: React.FC<MetricDataSourceModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [sourceType, setSourceType] = useState<DataSourceType>('csv');
  const [sourceName, setSourceName] = useState('');
  const [sourcePath, setSourcePath] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const generateSql = () => {
    const alias = sourceName.trim() || 'my_datasource';
    const path = sourcePath.trim() || `data.${sourceType}`;
    switch (sourceType) {
      case 'csv':
        return `-- 挂载 CSV 视图: ${alias}\nCREATE OR REPLACE VIEW ${alias} AS\nSELECT * FROM read_csv_auto('${path}');`;
      case 'parquet':
        return `-- 挂载 Parquet 视图: ${alias}\nCREATE OR REPLACE VIEW ${alias} AS\nSELECT * FROM read_parquet('${path}');`;
      case 'json':
        return `-- 挂载 JSON 视图: ${alias}\nCREATE OR REPLACE VIEW ${alias} AS\nSELECT * FROM read_json_auto('${path}');`;
      case 'sqlite':
        return `-- 挂载 SQLite 数据库: ${alias}\nATTACH '${path}' AS ${alias};\n-- 查询示例:\nSELECT * FROM ${alias}.table_name LIMIT 10;`;
    }
  };

  const handleGenerateAndCopy = () => {
    if (!sourceName.trim() || !sourcePath.trim()) {
      toastService.warning('请填写完整信息', '请输入数据源别名以及有效的文件路径或 URL');
      return;
    }
    const sql = generateSql();
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true);
      toastService.success('挂载 SQL 已复制到剪贴板', '可在「SQL」编辑器中直接粘贴并执行');
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 1200);
    }).catch(() => {
      toastService.error('复制失败', '请手动复制下方的 SQL 预览语句');
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="连接外部数据源"
    >
      <div
        className="w-full max-w-xl bg-monokai-sidebar border border-monokai-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-monokai-border bg-monokai-sidebar/95">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-monokai-surface border border-monokai-border flex items-center justify-center text-monokai-fg-muted shrink-0">
              <Database size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-monokai-fg flex items-center gap-2">
                连接外部数据源 (External Source)
              </h2>
              <p className="text-xs text-monokai-comment mt-0.5">
                利用 DuckDB WASM 虚拟引擎直接挂载本地文件或远端数据源视图
              </p>
            </div>
          </div>
          <IconButton label="关闭" icon={X} onClick={onClose} size="sm" />
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 bg-monokai-bg overflow-y-auto max-h-[70vh] custom-scrollbar">
          {/* Data Source Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-monokai-fg-muted uppercase tracking-wider mb-2">
              1. 选择数据源格式
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DATA_SOURCE_TYPES.map(item => {
                const isSelected = sourceType === item.type;
                const IconComp = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setSourceType(item.type)}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-monokai-surface border-monokai-border-strong text-monokai-fg shadow-xs'
                        : 'bg-monokai-sidebar border-monokai-border text-monokai-comment hover:text-monokai-fg hover:border-monokai-border-strong'
                    }`}
                  >
                    <IconComp size={16} className={`mt-0.5 shrink-0 ${isSelected ? 'text-monokai-fg' : 'text-monokai-comment'}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-monokai-fg">{item.label}</div>
                      <div className="text-[10px] text-monokai-comment truncate mt-0.5">{item.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Configuration Form */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1.5">
                2. 数据表视图别名 (View Name)
              </label>
              <input
                type="text"
                value={sourceName}
                onChange={e => setSourceName(e.target.value)}
                placeholder="例如: raw_orders, user_events"
                className="w-full bg-monokai-surface border border-monokai-border rounded-lg px-3 py-2 text-xs font-mono text-monokai-fg placeholder-monokai-comment/60 focus:border-monokai-border-strong focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1.5">
                3. 文件路径或网络 URL (Resource Path / URL)
              </label>
              <input
                type="text"
                value={sourcePath}
                onChange={e => setSourcePath(e.target.value)}
                placeholder={
                  sourceType === 'sqlite'
                    ? 'database.db 或 /path/to/sqlite.db'
                    : 'https://example.com/data.parquet 或 ./data.csv'
                }
                className="w-full bg-monokai-surface border border-monokai-border rounded-lg px-3 py-2 text-xs font-mono text-monokai-fg placeholder-monokai-comment/60 focus:border-monokai-border-strong focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* SQL Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-semibold uppercase text-monokai-comment">
                SQL 挂载命令预览
              </span>
              <span className="text-[10px] text-monokai-green font-mono">DuckDB Native</span>
            </div>
            <div className="bg-monokai-sidebar border border-monokai-border/90 rounded-lg p-3 font-mono text-xs text-monokai-green whitespace-pre-wrap leading-relaxed">
              {generateSql()}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-monokai-border bg-monokai-sidebar/95 flex items-center justify-end gap-2">
          <ActionButton variant="secondary" size="sm" onClick={onClose}>
            取消
          </ActionButton>
          <ActionButton
            variant="primary"
            size="sm"
            icon={copied ? Check : Copy}
            onClick={handleGenerateAndCopy}
            className="!bg-monokai-blue text-monokai-bg font-bold hover:brightness-110"
          >
            {copied ? '已复制挂载 SQL' : '生成并复制 SQL'}
          </ActionButton>
        </div>
      </div>
    </div>
  );
};
