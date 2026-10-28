import React, { useEffect, useState, useMemo } from 'react';
import {
  Columns,
  FileSpreadsheet,
  Terminal,
  Copy,
  ExternalLink,
  Loader2,
  Activity,
  Check,
  Layers,
  Search,
  BarChart3,
  Network,
  X,
} from 'lucide-react';
import { ActionButton, DrawerShell } from '../ui/Workbench';
import { duckDBService } from '../../services/duckdbService';
import { toastService } from '../../services/toastService';

interface QuickTablePeekDrawerProps {
  tableName: string | null;
  onClose: () => void;
  onNavigateToData: (tableName: string) => void;
  onNavigateToDataWithFilter?: (tableName: string, filter: string) => void;
  onNavigateToStructure?: (tableName: string) => void;
  onNavigateToAnalysis?: (tableName: string) => void;
  onNavigateToMetrics?: (tableName: string) => void;
  onNavigateToDataFlow?: (tableName: string) => void;
  onNavigateToSql: (sql: string) => void;
}

export const QuickTablePeekDrawer: React.FC<QuickTablePeekDrawerProps> = ({
  tableName,
  onClose,
  onNavigateToData,
  onNavigateToDataWithFilter,
  onNavigateToStructure,
  onNavigateToAnalysis,
  onNavigateToMetrics,
  onNavigateToDataFlow,
  onNavigateToSql,
}) => {
  const [activeTab, setActiveTab] = useState<'sample' | 'schema' | 'summarize'>('sample');
  const [sampleRows, setSampleRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<Array<{ name: string; type: string; pk?: number | boolean; notnull?: number | boolean }>>([]);
  const [summarizeRows, setSummarizeRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [columnFilter, setColumnFilter] = useState('');

  useEffect(() => {
    if (!tableName) return;

    let isMounted = true;
    setLoading(true);
    setSampleRows([]);
    setColumns([]);
    setSummarizeRows([]);
    setRowCount(null);

    const loadData = async () => {
      try {
        // 1. Fetch schema
        const schema = await duckDBService.getTableSchema(tableName);
        if (!isMounted) return;
        setColumns(schema || []);

        // 2. Fetch sample 10 rows
        const rows = await duckDBService.query(`SELECT * FROM "${tableName}" LIMIT 10;`);
        if (!isMounted) return;
        setSampleRows(rows || []);

        // 3. Fetch count
        try {
          const countRes = await duckDBService.query(`SELECT COUNT(*) as total FROM "${tableName}";`);
          if (isMounted && countRes && countRes[0]) {
            setRowCount(Number(countRes[0].total));
          }
        } catch {
          // Non-critical
        }

        // 4. Fetch summarize stats
        try {
          const sumRes = await duckDBService.query(`SUMMARIZE "${tableName}";`);
          if (isMounted) {
            setSummarizeRows(sumRes || []);
          }
        } catch {
          // Non-critical
        }
      } catch (err: any) {
        console.error('Failed to peek table', err);
        toastService.error(`读取数据表异常: ${err?.message || '未知错误'}`);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [tableName]);

  const filteredColumns = useMemo(() => {
    if (!columnFilter.trim()) return columns;
    const term = columnFilter.toLowerCase().trim();
    return columns.filter(c => c.name.toLowerCase().includes(term) || c.type.toLowerCase().includes(term));
  }, [columns, columnFilter]);

  const filteredSummarizeRows = useMemo(() => {
    if (!columnFilter.trim()) return summarizeRows;
    const term = columnFilter.toLowerCase().trim();
    return summarizeRows.filter(sr =>
      String(sr.column_name || '').toLowerCase().includes(term) ||
      String(sr.column_type || '').toLowerCase().includes(term)
    );
  }, [summarizeRows, columnFilter]);

  if (!tableName) return null;

  const handleCopyTableName = () => {
    void navigator.clipboard.writeText(tableName);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toastService.success(`已复制表名: ${tableName}`);
  };

  const getColTypeBadgeColor = (type: string) => {
    const t = type.toUpperCase();
    if (t.includes('INT') || t.includes('BIGINT') || t.includes('SMALLINT') || t.includes('DECIMAL') || t.includes('DOUBLE') || t.includes('FLOAT') || t.includes('NUMERIC')) {
      return 'text-monokai-cyan bg-monokai-cyan/15 border-monokai-cyan/30';
    }
    if (t.includes('VARCHAR') || t.includes('TEXT') || t.includes('CHAR') || t.includes('STRING')) {
      return 'text-monokai-accent bg-monokai-accent/15 border-monokai-accent/30';
    }
    if (t.includes('TIME') || t.includes('DATE') || t.includes('TIMESTAMP')) {
      return 'text-monokai-yellow bg-monokai-yellow/15 border-monokai-yellow/30';
    }
    if (t.includes('BOOL')) {
      return 'text-monokai-amethyst bg-monokai-amethyst/15 border-monokai-amethyst/30';
    }
    return 'text-monokai-fg bg-monokai-elevated border-monokai-border';
  };

  return (
    <DrawerShell
      open={!!tableName}
      onClose={onClose}
      title={`数据表速览：${tableName}`}
      description={[
        tableName,
        'DuckDB Native 表',
        rowCount !== null ? `${rowCount.toLocaleString()} 行记录` : null,
        `${columns.length} 个字段`,
      ]
        .filter(Boolean)
        .join(' · ')}
      side="right"
      size="xl"
      className="!max-w-4xl bg-monokai-bg"
      contentClassName="!p-0 flex flex-col"
      closeLabel="关闭速览抽屉"
      headerActions={
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <button
            type="button"
            onClick={handleCopyTableName}
            className="text-monokai-comment hover:text-monokai-fg cursor-pointer p-1 rounded-md hover:bg-monokai-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70"
            title="复制表名"
            aria-label="复制表名"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-monokai-green" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          {onNavigateToStructure && (
            <ActionButton
              variant="secondary"
              size="sm"
              icon={Layers}
              onClick={() => {
                onClose();
                onNavigateToStructure(tableName);
              }}
              className="!text-monokai-cyan"
            >
              结构管理
            </ActionButton>
          )}
          {onNavigateToAnalysis && (
            <ActionButton
              variant="secondary"
              size="sm"
              icon={Activity}
              onClick={() => {
                onClose();
                onNavigateToAnalysis(tableName);
              }}
              className="!text-monokai-green"
            >
              分析探查
            </ActionButton>
          )}
          {onNavigateToMetrics && (
            <ActionButton
              variant="secondary"
              size="sm"
              icon={BarChart3}
              onClick={() => {
                onClose();
                onNavigateToMetrics(tableName);
              }}
              className="!text-monokai-amethyst"
            >
              指标建模
            </ActionButton>
          )}
          {onNavigateToDataFlow && (
            <ActionButton
              variant="secondary"
              size="sm"
              icon={Network}
              onClick={() => {
                onClose();
                onNavigateToDataFlow(tableName);
              }}
              className="!text-monokai-orange"
            >
              数据流
            </ActionButton>
          )}
          <ActionButton
            variant="secondary"
            size="sm"
            icon={ExternalLink}
            onClick={() => {
              onClose();
              onNavigateToData(tableName);
            }}
          >
            打开数据网格
          </ActionButton>
        </div>
      }
    >
      {/* Tab Header & Search */}
      <div className="flex items-center justify-between border-b border-monokai-border bg-monokai-sidebar/70 px-5 sm:px-6 pt-2 select-none gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('sample')}
              className={`flex items-center gap-1.5 sm:gap-2 border-b-2 px-3 py-2 text-xs font-semibold font-mono transition-all cursor-pointer ${
                activeTab === 'sample'
                  ? 'border-monokai-fg text-monokai-fg font-bold'
                  : 'border-transparent text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>前 10 行样本数据</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schema')}
              className={`flex items-center gap-1.5 sm:gap-2 border-b-2 px-3 py-2 text-xs font-semibold font-mono transition-all cursor-pointer ${
                activeTab === 'schema'
                  ? 'border-monokai-fg text-monokai-fg font-bold'
                  : 'border-transparent text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <Columns className="h-3.5 w-3.5" />
              <span>字段结构 ({columns.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('summarize')}
              className={`flex items-center gap-1.5 sm:gap-2 border-b-2 px-3 py-2 text-xs font-semibold font-mono transition-all cursor-pointer ${
                activeTab === 'summarize'
                  ? 'border-monokai-fg text-monokai-fg font-bold'
                  : 'border-transparent text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span>SUMMARIZE 统计画像</span>
            </button>
          </div>

          <div className="relative pb-1.5 w-36 sm:w-48">
            <Search className="w-3 h-3 text-monokai-comment absolute left-2 top-2 pointer-events-none" />
            <input
              type="text"
              value={columnFilter}
              onChange={e => setColumnFilter(e.target.value)}
              placeholder="筛选字段名…"
              className="w-full pl-6 pr-5 py-0.5 rounded-md bg-monokai-elevated border border-monokai-border text-meta font-mono text-monokai-fg placeholder:text-monokai-comment focus:outline-none focus:border-monokai-accent"
            />
            {columnFilter && (
              <button
                type="button"
                onClick={() => setColumnFilter('')}
                className="absolute right-1.5 top-1.5 text-monokai-comment hover:text-monokai-fg cursor-pointer"
                title="清除筛选"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-auto p-5 sm:p-6 custom-scrollbar bg-monokai-bg">
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-xs font-mono text-monokai-comment">
              <Loader2 className="h-8 w-8 text-monokai-fg animate-spin" />
              <span>正在抽样并解析字段架构与统计画像…</span>
            </div>
          ) : activeTab === 'sample' ? (
            <div className="space-y-4">
              {sampleRows.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-xs font-mono text-monokai-comment border border-dashed border-monokai-border rounded-xl p-6">
                  表中暂无任何数据记录
                </div>
              ) : filteredColumns.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center text-xs font-mono text-monokai-comment border border-dashed border-monokai-border rounded-xl p-4">
                  未找到匹配的字段 “{columnFilter}”
                </div>
              ) : (
                <div className="overflow-x-auto border border-monokai-border rounded-xl bg-monokai-surface/30 shadow-md">
                  <table className="w-full text-left font-mono text-meta border-collapse">
                    <thead>
                      <tr className="border-b border-monokai-border bg-monokai-sidebar text-monokai-fg">
                        <th className="px-2.5 py-2 whitespace-nowrap font-bold text-center text-monokai-comment border-r border-monokai-border/60 w-10 text-2xs">
                          #
                        </th>
                        {filteredColumns.map(col => (
                          <th key={col.name} className="px-3 py-2 whitespace-nowrap font-bold border-r border-monokai-border/60 last:border-r-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-monokai-fg">{col.name}</span>
                              {Boolean(col.pk) && (
                                <span className="px-1 py-0.2 rounded text-2xs font-mono font-bold bg-monokai-yellow/20 text-monokai-yellow border border-monokai-yellow/40">
                                  PK
                                </span>
                              )}
                            </div>
                            <span className="text-2xs font-normal text-monokai-comment">{col.type}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-monokai-border/60 bg-monokai-bg/60">
                      {sampleRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-monokai-surface/60 transition-colors">
                          <td className="px-2.5 py-1.5 whitespace-nowrap text-center text-2xs font-mono text-monokai-comment bg-monokai-sidebar/30 border-r border-monokai-border/40 select-none">
                            {rIdx + 1}
                          </td>
                          {filteredColumns.map(col => {
                            const val = row[col.name];
                            let formattedContent: React.ReactNode;
                            if (val === null || val === undefined) {
                              formattedContent = (
                                <span className="text-monokai-comment italic font-mono text-2xs bg-monokai-elevated/70 px-1 py-0.2 rounded border border-monokai-border/40">
                                  null
                                </span>
                              );
                            } else if (typeof val === 'bigint') {
                              formattedContent = String(val);
                            } else if (typeof val === 'object') {
                              try {
                                formattedContent = JSON.stringify(val, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
                              } catch {
                                formattedContent = String(val);
                              }
                            } else {
                              formattedContent = String(val);
                            }

                            return (
                              <td key={col.name} className="px-3 py-1.5 whitespace-nowrap border-r border-monokai-border/40 last:border-r-0 text-monokai-fg/90">
                                {formattedContent}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Instant Queries Quick Runner */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToSql(`SELECT * FROM "${tableName}" LIMIT 100;`);
                  }}
                  className="flex items-center gap-2 rounded-lg border border-monokai-border bg-monokai-surface px-3.5 py-1.5 text-xs font-semibold text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>在 SQL 编辑器中深入分析 →</span>
                </button>
              </div>
            </div>
          ) : activeTab === 'schema' ? (
            /* Schema Tab */
            <div className="space-y-3">
              {filteredColumns.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center text-xs font-mono text-monokai-comment border border-dashed border-monokai-border rounded-xl p-4">
                  未找到匹配的字段 “{columnFilter}”
                </div>
              ) : (
                <div className="divide-y divide-monokai-border/60 border border-monokai-border rounded-xl overflow-hidden bg-monokai-surface/40 shadow-sm">
                  {filteredColumns.map((col, idx) => (
                    <div key={col.name} className="flex items-center justify-between px-4 py-2 text-xs bg-monokai-surface/30 hover:bg-monokai-surface/80 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-monokai-comment text-meta w-6 text-right">{idx + 1}</span>
                        <span className="font-mono font-bold text-meta text-monokai-fg truncate">{col.name}</span>
                        {Boolean(col.pk) && (
                          <span className="px-1.5 py-0.2 rounded text-2xs font-mono font-bold bg-monokai-yellow/20 text-monokai-yellow border border-monokai-yellow/40">
                            PK
                          </span>
                        )}
                        {Boolean(col.notnull) && (
                          <span className="px-1.5 py-0.2 rounded text-2xs font-mono text-monokai-comment border border-monokai-border/60">
                            NOT NULL
                          </span>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-md border font-mono text-2xs font-medium ${getColTypeBadgeColor(col.type)}`}>
                        {col.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {onNavigateToStructure && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToStructure(tableName);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-monokai-cyan/40 bg-monokai-surface text-monokai-cyan hover:bg-monokai-elevated text-xs font-mono transition-colors cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>前往结构管理器修改字段与约束 →</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* SUMMARIZE Tab */
            <div className="space-y-3">
              {summarizeRows.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-xs font-mono text-monokai-comment border border-dashed border-monokai-border rounded-xl p-6">
                  未获取到统计画像数据
                </div>
              ) : filteredSummarizeRows.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center text-xs font-mono text-monokai-comment border border-dashed border-monokai-border rounded-xl p-4">
                  未找到匹配的统计画像列 “{columnFilter}”
                </div>
              ) : (
                <div className="overflow-x-auto border border-monokai-border rounded-xl bg-monokai-surface/30 shadow-md">
                  <table className="w-full text-left font-mono text-meta border-collapse">
                    <thead>
                      <tr className="border-b border-monokai-border bg-monokai-sidebar text-monokai-fg">
                        <th className="px-3 py-2 whitespace-nowrap font-bold">字段名</th>
                        <th className="px-3 py-2 whitespace-nowrap font-bold">类型</th>
                        <th className="px-3 py-2 whitespace-nowrap font-bold">最小值</th>
                        <th className="px-3 py-2 whitespace-nowrap font-bold">最大值</th>
                        <th className="px-3 py-2 whitespace-nowrap font-bold">唯一基数</th>
                        <th className="px-3 py-2 whitespace-nowrap font-bold">平均值</th>
                        <th className="px-3 py-2 whitespace-nowrap font-bold">空值率</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-monokai-border/60 bg-monokai-bg/60">
                      {filteredSummarizeRows.map((sr, idx) => (
                        <tr key={idx} className="hover:bg-monokai-surface/60 transition-colors">
                          <td className="px-3 py-1.5 whitespace-nowrap font-bold text-monokai-fg border-r border-monokai-border/40">
                            {String(sr.column_name || '')}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap font-mono text-monokai-comment border-r border-monokai-border/40">
                            {String(sr.column_type || '')}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap border-r border-monokai-border/40 text-monokai-fg/90">
                            {String(sr.min ?? '-')}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap border-r border-monokai-border/40 text-monokai-fg/90">
                            {String(sr.max ?? '-')}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap border-r border-monokai-border/40 text-monokai-fg/90">
                            {String(sr.approx_unique ?? '-')}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap border-r border-monokai-border/40 text-monokai-fg/90">
                            {sr.avg !== null && sr.avg !== undefined ? Number(sr.avg).toFixed(2) : '-'}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-monokai-yellow font-semibold">
                            <div className="flex items-center justify-between gap-1.5">
                              <span>{sr.null_percentage !== null && sr.null_percentage !== undefined ? `${Number(sr.null_percentage).toFixed(1)}%` : '0%'}</span>
                              {Number(sr.null_percentage) > 0 && (
                                <div className="flex items-center gap-1">
                                  {onNavigateToDataWithFilter && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onClose();
                                        onNavigateToDataWithFilter(tableName, `"${sr.column_name}" IS NULL`);
                                      }}
                                      className="text-2xs text-monokai-accent hover:underline font-mono px-1 py-0.2 rounded bg-monokai-surface border border-monokai-border/80 cursor-pointer"
                                      title="在数据网格中过滤显示空值记录"
                                    >
                                      过滤 ↗
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClose();
                                      onNavigateToSql(`SELECT * FROM "${tableName}" WHERE "${sr.column_name}" IS NULL LIMIT 50;`);
                                    }}
                                    className="text-2xs text-monokai-cyan hover:underline font-mono px-1 py-0.2 rounded bg-monokai-surface border border-monokai-border/80 cursor-pointer"
                                    title="在 SQL 工作台中查询空值样本"
                                  >
                                    SQL ↗
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
    </DrawerShell>
  );
};
