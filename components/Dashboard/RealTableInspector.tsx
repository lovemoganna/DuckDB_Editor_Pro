import React, { useState } from 'react';
import {
  Table2,
  Columns,
  Activity,
  FileSpreadsheet,
  Terminal,
  Copy,
  ExternalLink,
  Play,
  Loader2,
  Check,
  Download,
  AlertCircle,
} from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { toastService } from '../../services/toastService';

interface RealTableInspectorProps {
  tableName: string | null;
  onNavigateToData: (tableName: string) => void;
  onNavigateToSql: (sql: string) => void;
}

export const RealTableInspector: React.FC<RealTableInspectorProps> = ({
  tableName,
  onNavigateToData,
  onNavigateToSql,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'schema' | 'summarize'>('preview');

  // Preview state
  const [previewRows, setPreviewRows] = useState<any[] | null>(null);
  const [previewCols, setPreviewCols] = useState<string[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewElapsedMs, setPreviewElapsedMs] = useState<number | null>(null);

  // Schema state
  const [schemaCols, setSchemaCols] = useState<Array<{ name: string; type: string }> | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);

  // Summarize state
  const [summarizeRows, setSummarizeRows] = useState<any[] | null>(null);
  const [summarizeCols, setSummarizeCols] = useState<string[]>([]);
  const [loadingSummarize, setLoadingSummarize] = useState(false);
  const [summarizeElapsedMs, setSummarizeElapsedMs] = useState<number | null>(null);

  const [copied, setCopied] = useState(false);
  const [lastLoadedTable, setLastLoadedTable] = useState<string | null>(null);

  // If selected table changed, reset cached inspection
  if (tableName !== lastLoadedTable) {
    setLastLoadedTable(tableName);
    setPreviewRows(null);
    setSchemaCols(null);
    setSummarizeRows(null);
  }

  // 1. Load preview rows on explicit user trigger
  const handleLoadPreview = async () => {
    if (!tableName) return;
    setLoadingPreview(true);
    const start = performance.now();
    try {
      const rows = await duckDBService.query(`SELECT * FROM "${tableName}" LIMIT 50;`);
      const elapsed = +(performance.now() - start).toFixed(2);
      const cols = rows && rows.length > 0 ? Object.keys(rows[0]) : [];
      setPreviewRows(rows || []);
      setPreviewCols(cols);
      setPreviewElapsedMs(elapsed);
    } catch (err: any) {
      console.error('Failed to load table preview', err);
      toastService.error(`加载数据失败: ${err?.message || '未知错误'}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  // 2. Load schema columns on explicit user trigger
  const handleLoadSchema = async () => {
    if (!tableName) return;
    setLoadingSchema(true);
    try {
      const schema = await duckDBService.getTableSchema(tableName);
      setSchemaCols(schema || []);
    } catch (err: any) {
      console.error('Failed to load table schema', err);
      toastService.error(`加载表结构失败: ${err?.message || '未知错误'}`);
    } finally {
      setLoadingSchema(false);
    }
  };

  // 3. Run SUMMARIZE profiling on explicit user trigger
  const handleRunSummarize = async () => {
    if (!tableName) return;
    setLoadingSummarize(true);
    const start = performance.now();
    try {
      const rows = await duckDBService.query(`SUMMARIZE "${tableName}";`);
      const elapsed = +(performance.now() - start).toFixed(2);
      const cols = rows && rows.length > 0 ? Object.keys(rows[0]) : [];
      setSummarizeRows(rows || []);
      setSummarizeCols(cols);
      setSummarizeElapsedMs(elapsed);
    } catch (err: any) {
      console.error('Failed to summarize table', err);
      toastService.error(`画像探查失败: ${err?.message || '未知错误'}`);
    } finally {
      setLoadingSummarize(false);
    }
  };

  const handleCopyTableName = () => {
    if (!tableName) return;
    void navigator.clipboard.writeText(tableName);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toastService.success(`已复制表名: ${tableName}`);
  };

  if (!tableName) {
    return (
      <div className="flex h-56 flex-col items-center justify-center rounded-md border border-dashed border-monokai-border bg-monokai-surface/60 p-6 text-center text-xs text-monokai-comment font-mono">
        <Table2 className="h-7 w-7 text-monokai-comment mb-2" />
        <p className="font-medium text-monokai-fg-muted">未选择数据表</p>
        <p className="text-meta text-monokai-comment mt-1 max-w-sm">
          在左侧“数据资产全景透视”中选择任意数据表，即可就地查看真实数据、字段结构或运行画像探查。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-md border border-monokai-border bg-monokai-surface overflow-hidden font-sans shadow-xs">
      {/* Table Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 border-b border-monokai-border bg-monokai-elevated">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-monokai-border bg-monokai-bg text-monokai-fg">
            <Table2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-monokai-fg truncate">
                {tableName}
              </span>
              <button
                type="button"
                onClick={handleCopyTableName}
                className="text-monokai-comment hover:text-monokai-fg cursor-pointer p-0.5"
                title="复制表名"
              >
                {copied ? <Check className="h-3 w-3 text-monokai-green" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
            <span className="text-2xs font-mono text-monokai-comment">
              DuckDB 原生表 · 就地检视器
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateToData(tableName)}
            className="flex h-7 items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-bg px-2.5 text-xs font-medium text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-colors cursor-pointer"
            title="跳转到完整可编辑数据网格"
          >
            <ExternalLink className="h-3 w-3" />
            <span>进入数据网格</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateToSql(`SELECT * FROM "${tableName}" LIMIT 100;`)}
            className="flex h-7 items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-bg px-2.5 text-xs font-semibold text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-colors cursor-pointer"
            title="在 SQL 工作台中编写复杂查询"
          >
            <Terminal className="h-3 w-3" />
            <span>SQL 查询 →</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-monokai-border bg-monokai-surface px-4 pt-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold font-mono transition-colors cursor-pointer ${
            activeTab === 'preview'
              ? 'border-monokai-fg text-monokai-fg'
              : 'border-transparent text-monokai-comment hover:text-monokai-fg'
          }`}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          <span>真实数据前 50 行</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('schema')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold font-mono transition-colors cursor-pointer ${
            activeTab === 'schema'
              ? 'border-monokai-fg text-monokai-fg'
              : 'border-transparent text-monokai-comment hover:text-monokai-fg'
          }`}
        >
          <Columns className="h-3.5 w-3.5" />
          <span>字段结构元数据</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('summarize')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold font-mono transition-colors cursor-pointer ${
            activeTab === 'summarize'
              ? 'border-monokai-fg text-monokai-fg'
              : 'border-transparent text-monokai-comment hover:text-monokai-fg'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>SUMMARIZE 统计画像</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-4">
        {/* TAB 1: PREVIEW */}
        {activeTab === 'preview' && (
          <div className="space-y-3">
            {!previewRows ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-md border border-monokai-border/80 bg-monokai-bg p-4 text-center">
                <p className="text-xs text-monokai-fg-muted font-medium">尚未载入数据预览</p>
                <button
                  type="button"
                  onClick={handleLoadPreview}
                  disabled={loadingPreview}
                  className="mt-2.5 flex items-center gap-1.5 rounded-md bg-monokai-cyan px-3 py-1.5 text-xs font-bold text-monokai-bg hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loadingPreview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                  <span>就地读取前 50 行真实数据</span>
                </button>
              </div>
            ) : previewRows.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-xs font-mono text-monokai-comment border border-monokai-border rounded-md">
                表中暂无任何记录行
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-monokai-comment">
                  <span>已就地载入 {previewRows.length} 行数据 · {previewCols.length} 个字段</span>
                  {previewElapsedMs !== null && (
                    <span className="text-monokai-cyan font-bold">耗时: {previewElapsedMs} ms</span>
                  )}
                </div>

                <div className="max-h-64 overflow-auto border border-monokai-border rounded-md custom-scrollbar bg-monokai-bg">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-monokai-border bg-monokai-elevated text-monokai-fg sticky top-0">
                        {previewCols.map(c => (
                          <th key={c} className="px-3 py-2 border-r border-monokai-border/40 last:border-r-0 whitespace-nowrap font-bold">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-monokai-border/30">
                      {previewRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-monokai-elevated transition-colors">
                          {previewCols.map(c => {
                            const val = row[c];
                            const formatted = val === null || val === undefined
                              ? <span className="text-monokai-comment/40 italic">null</span>
                              : typeof val === 'object'
                              ? JSON.stringify(val)
                              : String(val);

                            return (
                              <td key={c} className="px-3 py-1.5 border-r border-monokai-border/20 last:border-r-0 whitespace-nowrap text-monokai-fg">
                                {formatted}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SCHEMA */}
        {activeTab === 'schema' && (
          <div className="space-y-3">
            {!schemaCols ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-md border border-monokai-border/80 bg-monokai-bg p-4 text-center">
                <p className="text-xs text-monokai-fg-muted font-medium">尚未载入字段定义</p>
                <button
                  type="button"
                  onClick={handleLoadSchema}
                  disabled={loadingSchema}
                  className="mt-2.5 flex items-center gap-1.5 rounded-md bg-monokai-cyan px-3 py-1.5 text-xs font-bold text-monokai-bg hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loadingSchema ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Columns className="h-3.5 w-3.5" />}
                  <span>读取表字段元数据</span>
                </button>
              </div>
            ) : schemaCols.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-xs font-mono text-monokai-comment border border-monokai-border rounded-md">
                未检测到字段信息
              </div>
            ) : (
              <div className="divide-y divide-monokai-border/50 border border-monokai-border rounded-md overflow-hidden">
                {schemaCols.map((col, idx) => (
                  <div key={col.name} className="flex items-center justify-between px-3.5 py-2 text-xs bg-monokai-bg hover:bg-monokai-elevated transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-monokai-comment text-2xs w-6 text-right">{idx + 1}</span>
                      <span className="font-mono font-bold text-monokai-fg truncate">{col.name}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md border border-monokai-border bg-monokai-elevated font-mono text-meta text-monokai-fg font-medium">
                      {col.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SUMMARIZE PROFILING */}
        {activeTab === 'summarize' && (
          <div className="space-y-3">
            {!summarizeRows ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-md border border-monokai-border/80 bg-monokai-bg p-4 text-center">
                <p className="text-xs text-monokai-fg-muted font-medium">尚未运行字段统计画像</p>
                <p className="text-meta text-monokai-comment mt-0.5 max-w-sm">
                  DuckDB 原生 SUMMARIZE 可以秒级计算所有字段的类型、极值、空值率与近似去重数。
                </p>
                <button
                  type="button"
                  onClick={handleRunSummarize}
                  disabled={loadingSummarize}
                  className="mt-3 flex items-center gap-1.5 rounded-md bg-monokai-green px-3.5 py-1.5 text-xs font-bold text-monokai-bg hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loadingSummarize ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                  <span>就地运行 SUMMARIZE 数据画像</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-monokai-comment">
                  <span className="text-monokai-green font-semibold">
                    SUMMARIZE 统计完成 ({summarizeRows.length} 个字段画像)
                  </span>
                  {summarizeElapsedMs !== null && (
                    <span className="text-monokai-cyan font-bold">耗时: {summarizeElapsedMs} ms</span>
                  )}
                </div>

                <div className="max-h-64 overflow-auto border border-monokai-border rounded-md custom-scrollbar bg-monokai-bg">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-monokai-border bg-monokai-elevated text-monokai-fg sticky top-0">
                        {summarizeCols.map(c => (
                          <th key={c} className="px-3 py-2 border-r border-monokai-border/40 last:border-r-0 whitespace-nowrap font-bold">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-monokai-border/30">
                      {summarizeRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-monokai-elevated transition-colors">
                          {summarizeCols.map(c => (
                            <td key={c} className="px-3 py-1.5 border-r border-monokai-border/20 last:border-r-0 whitespace-nowrap text-monokai-fg">
                              {String(row[c] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
