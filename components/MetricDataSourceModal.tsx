import './metricUi.css';
import React, { useState, useEffect } from 'react';
import { quoteIdent, escapeLiteral } from '../services/analysis/sqlUtils';
import { Database, Copy, Check, Play, FileSpreadsheet, FileCode, Layers, Server } from 'lucide-react';
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
  useEffect(() => { setCopied(false); }, [sourceName, sourcePath, sourceType, isOpen]);
  const complete = Boolean(sourceName.trim() && sourcePath.trim());

  const generateSql = () => {
    const alias = quoteIdent(sourceName.trim() || 'my_datasource');
    const path = escapeLiteral(sourcePath.trim() || `data.${sourceType}`);
    switch (sourceType) {
      case 'csv':
        return `CREATE OR REPLACE VIEW ${alias} AS\nSELECT * FROM read_csv_auto('${path}');`;
      case 'parquet':
        return `CREATE OR REPLACE VIEW ${alias} AS\nSELECT * FROM read_parquet('${path}');`;
      case 'json':
        return `CREATE OR REPLACE VIEW ${alias} AS\nSELECT * FROM read_json_auto('${path}');`;
      case 'sqlite':
        return `ATTACH '${path}' AS ${alias} (TYPE SQLITE);`;
    }
  };

  const handleGenerateAndCopy = async () => {
    if (!sourceName.trim() || !sourcePath.trim()) {
      toastService.warning('请填写完整信息', '请输入数据源别名以及有效的文件路径或 URL');
      return;
    }
    const sql = generateSql();
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      toastService.success('挂载 SQL 已复制到剪贴板', '可在「SQL」编辑器中直接粘贴并执行');
    } catch {
      toastService.error('复制失败', '请手动复制下方的 SQL 预览语句');
    }
  };

  const handleExecuteInWorkbench = () => {
    if (!sourceName.trim() || !sourcePath.trim()) {
      toastService.warning('请填写完整信息', '请输入数据源别名以及有效的文件路径或 URL');
      return;
    }
    const sql = generateSql();
    const alias = sourceName.trim();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(sql).catch(() => {});
    }
    window.dispatchEvent(
      new CustomEvent('duckdb_execute_sql', {
        detail: { sql, autoRun: true, title: `挂载数据源: ${alias}` },
      })
    );
    toastService.info('挂载 SQL 已发送至 SQL 工作台', '请在工作台查看执行结果；SQLite 需要运行环境支持对应扩展。');
    onClose();
  };

  return (
    <ModalShell
      className="metric-surface"
      open={isOpen}
      onClose={onClose}
      title="连接外部数据源"
      description="生成挂载 SQL；本地文件需先导入工作区，远程文件需支持浏览器跨域访问"
      icon={Database}
      size="md"
      footer={
        <>
          <ActionButton variant="secondary" size="sm" onClick={onClose}>
            取消
          </ActionButton>
          <ActionButton
            variant="secondary"
            size="sm"
            icon={copied ? Check : Copy}
            onClick={handleGenerateAndCopy}
            disabled={!complete}
          >
            {copied ? '已复制 SQL' : '复制 SQL'}
          </ActionButton>
          <ActionButton
            variant="primary"
            size="sm"
            icon={Play}
            onClick={handleExecuteInWorkbench}
            disabled={!complete}
          >
            在 SQL 编辑器中运行
          </ActionButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-monokai-fg-muted">
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
                  aria-pressed={isSelected}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent ${
                    isSelected
                      ? 'border-monokai-border-strong bg-monokai-surface text-monokai-fg shadow-xs'
                      : 'border-monokai-border bg-monokai-sidebar text-monokai-comment hover:border-monokai-border-strong hover:text-monokai-fg hover:bg-monokai-surface/60'
                  }`}
                >
                  <IconComp
                    size={16}
                    className={`mt-0.5 shrink-0 ${isSelected ? 'text-monokai-accent' : 'text-monokai-comment'}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-monokai-fg">{item.label}</div>
                    <div className="mt-0.5 truncate text-[11px] text-monokai-comment">{item.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-monokai-fg-muted">
              2. 数据表视图别名 (View Name)
            </label>
            <FormInput
              fontVariant="mono"
              value={sourceName}
              aria-label="数据源别名"
              onChange={e => setSourceName(e.target.value)}
              placeholder="例如: raw_orders, user_events"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-monokai-fg-muted">
              3. 文件路径或网络 URL
            </label>

            <FormInput
              fontVariant="mono"
              value={sourcePath}
              aria-label="文件路径或网络 URL"
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
          <pre className="whitespace-pre-wrap break-all" aria-label="SQL 挂载命令预览">
            {generateSql()}
          </pre>
        </div>
      </div>
    </ModalShell>
  );
};
