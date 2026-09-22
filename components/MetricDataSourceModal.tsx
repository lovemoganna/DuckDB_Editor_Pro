import React, { useState } from 'react';
import { Database, Copy, Check, FileSpreadsheet, FileCode, Layers, Server } from 'lucide-react';
import { ActionButton, FormInput, ModalShell } from './ui/Workbench';
import { toastService } from '../services/toastService';

interface MetricDataSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DataSourceType = 'csv' | 'parquet' | 'json' | 'sqlite';

const DATA_SOURCE_TYPES: {
  type: DataSourceType;
  label: string;
  icon: typeof Database;
  desc: string;
  ext: string;
}[] = [
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
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title="连接外部数据源"
      description="利用 DuckDB WASM 直接挂载本地文件或远端数据源视图"
      icon={Database}
      size="md"
      footer={
        <>
          <ActionButton variant="secondary" size="sm" onClick={onClose}>
            取消
          </ActionButton>
          <ActionButton
            variant="primary"
            size="sm"
            icon={copied ? Check : Copy}
            onClick={handleGenerateAndCopy}
          >
            {copied ? '已复制挂载 SQL' : '生成并复制 SQL'}
          </ActionButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-monokai-fg-muted">
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
                  className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-3 text-left transition-all ${
                    isSelected
                      ? 'border-monokai-border-strong bg-monokai-surface text-monokai-fg shadow-xs'
                      : 'border-monokai-border bg-monokai-sidebar text-monokai-comment hover:border-monokai-border-strong hover:text-monokai-fg'
                  }`}
                >
                  <IconComp
                    size={16}
                    className={`mt-0.5 shrink-0 ${isSelected ? 'text-monokai-fg' : 'text-monokai-comment'}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-monokai-fg">{item.label}</div>
                    <div className="mt-0.5 truncate text-2xs text-monokai-comment">{item.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-monokai-fg-muted">
              2. 数据表视图别名 (View Name)
            </label>
            <FormInput
              fontVariant="mono"
              value={sourceName}
              onChange={e => setSourceName(e.target.value)}
              placeholder="例如: raw_orders, user_events"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-monokai-fg-muted">
              3. 文件路径或网络 URL
            </label>
            <FormInput
              fontVariant="mono"
              value={sourcePath}
              onChange={e => setSourcePath(e.target.value)}
              placeholder={
                sourceType === 'sqlite'
                  ? 'database.db 或 /path/to/sqlite.db'
                  : 'https://example.com/data.parquet 或 ./data.csv'
              }
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-mono text-2xs font-semibold uppercase text-monokai-comment">
              SQL 挂载命令预览
            </span>
            <span className="font-mono text-2xs text-monokai-accent">DuckDB Native</span>
          </div>
          <div className="whitespace-pre-wrap rounded-md border border-monokai-border/90 bg-monokai-sidebar p-3 font-mono text-xs leading-relaxed text-monokai-accent">
            {generateSql()}
          </div>
        </div>
      </div>
    </ModalShell>
  );
};
