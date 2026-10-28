import React, { useState, useEffect, useMemo } from 'react';
import { DataQualityChecks } from './DataQualityChecks';
import {
  CheckCircle2,
  Database,
  Hash,
  Calendar,
  Layers,
  Key,
  Search,
  TrendingUp,
  Copy,
  RefreshCw,
  Sparkles,
  Activity,
  Terminal,
} from 'lucide-react';
import { fetchTableOverview, fetchColumnProfiles, type ColumnProfile, type TableOverview } from '../../services/analysis';
import type { ColumnInfo } from '../../types';
import { toastService } from '../../services/toastService';
import { InlineAlert } from '../ui/Workbench';
import {
  AH,
  AnalysisLoadingState,
  AnalysisErrorState,
  AnalysisEmptyHint,
  AnalysisKpiTile,
  AnalysisSubViewHeader,
} from './analysisUi';

interface AnalysisProfilerProps {
  currentTable: string;
  schema: ColumnInfo[];
  onNavigateToPivot: (column: string) => void;
  onNavigateToTimeSeries: (column: string) => void;
  onInsertSql?: (sql: string, executeDirectly?: boolean) => void;
}

function buildColumnProfileSql(tableName: string, colName: string): string {
  return `SELECT \n  COUNT(*) AS total_rows,\n  COUNT("${colName}") AS non_null_count,\n  COUNT(DISTINCT "${colName}") AS distinct_count,\n  MIN("${colName}") AS min_val,\n  MAX("${colName}") AS max_val\nFROM "${tableName}";`;
}

const SEMANTIC_FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'numeric', label: '数值' },
  { id: 'categorical', label: '维度' },
  { id: 'temporal', label: '时间' },
  { id: 'identifier', label: 'ID/键' },
];

export const AnalysisProfiler: React.FC<AnalysisProfilerProps> = ({
  currentTable,
  schema,
  onNavigateToPivot,
  onNavigateToTimeSeries,
  onInsertSql,
}) => {
  const [overview, setOverview] = useState<TableOverview | null>(null);
  const [profiles, setProfiles] = useState<ColumnProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSemanticFilter, setSelectedSemanticFilter] = useState<string>('all');

  const loadData = async () => {
    if (!currentTable || schema.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const [ov, profs] = await Promise.all([
        fetchTableOverview(currentTable, schema),
        fetchColumnProfiles(currentTable, schema),
      ]);
      setOverview(ov);
      setProfiles(profs);
    } catch (err: unknown) {
      console.error('[AnalysisProfiler] Failed to profile table:', err);
      setError(err instanceof Error ? err.message : '读取表画像时发生未知错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTable, schema]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        p.name.toLowerCase().includes(q) || p.type.toLowerCase().includes(q);
      const matchesType =
        selectedSemanticFilter === 'all' || p.semanticType === selectedSemanticFilter;
      return matchesSearch && matchesType;
    });
  }, [profiles, searchTerm, selectedSemanticFilter]);

  const healthAlerts = useMemo(() => {
    const alerts: { level: 'warning' | 'info'; text: string }[] = [];
    const highNullCols = profiles.filter(p => p.nullRate > 20);
    if (highNullCols.length > 0) {
      alerts.push({
        level: 'info',
        text: `空值观察：${highNullCols.length} 个字段缺失率超过 20% (${highNullCols.map(c => c.name).join(', ')})；是否异常需按字段规则确认。`,
      });
    }
    const pkCandidates = profiles.filter(p => p.isPrimaryKeyCandidate);
    if (pkCandidates.length > 0 && (!overview?.pkColumns || overview.pkColumns.length === 0)) {
      alerts.push({
        level: 'info',
        text: `候选唯一主键列：${pkCandidates.map(c => c.name).join(', ')} (100% 唯一且无空值)`,
      });
    }
    return alerts;
  }, [profiles, overview]);

  const handleCopyColumnProfileSql = (colName: string) => {
    const sql = buildColumnProfileSql(currentTable, colName);
    void navigator.clipboard.writeText(sql);
    toastService.success(`已复制 "${colName}" 字段探查 SQL`);
  };

  const handleOpenColumnProfileSql = (colName: string) => {
    const sql = buildColumnProfileSql(currentTable, colName);
    if (onInsertSql) {
      onInsertSql(sql, false);
      toastService.success('已带入 SQL 工作台');
      return;
    }
    handleCopyColumnProfileSql(colName);
  };

  if (!currentTable || schema.length === 0) {
    return (
      <div className={AH.pane}>
        <div className={AH.scrollBody}>
          <AnalysisEmptyHint message="请选择一张有效数据表以开始字段体检。" />
        </div>
      </div>
    );
  }

  if (loading && !overview) {
    return (
      <div className={AH.pane}>
        <AnalysisLoadingState message={`正在探测 [${currentTable}] 字段画像与统计极值…`} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={AH.pane}>
        <AnalysisErrorState title="数据体检异常" message={error} onRetry={loadData} />
        <DataQualityChecks currentTable={currentTable} columns={schema.map(column => column.name)}/>
      </div>
    );
  }

  return (
    <div className={AH.pane}>
      {/* ─── Config bar ─────────────────────────────────────────────── */}
      <div className={AH.configBar}>
        <AnalysisSubViewHeader
          icon={Activity}
          iconTone="accent"
          title="数据体检与字段画像"
          description="完备率 · 基数 · 极值 · 空值观察 · 跳转透视或时序"
          actions={
            <button
              type="button"
              title="刷新体检数据"
              aria-label="刷新体检数据"
              onClick={loadData}
              className={AH.iconBtn}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
          }
        />

        {/* Search + filter row — inline with config bar, no extra border */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search
              className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-monokai-comment pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="搜索字段名或类型…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`w-full pl-7 ${AH.input}`}
              aria-label="搜索字段"
            />
          </div>

          <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="语义类型过滤">
            {SEMANTIC_FILTERS.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedSemanticFilter(f.id)}
                className={selectedSemanticFilter === f.id ? AH.chipActive : AH.chip}
                aria-pressed={selectedSemanticFilter === f.id}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Scrollable body ─────────────────────────────────────────── */}
      <div className={`${AH.scrollBody} flex flex-col gap-2.5`}>
        <DataQualityChecks currentTable={currentTable} columns={schema.map(column => column.name)}/>
        {/* KPI overview */}
        {overview && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <AnalysisKpiTile
              label="总记录行数"
              icon={Database}
              iconClassName="text-monokai-orange"
              value={overview.rowCount.toLocaleString()}
              hint="当前表；未应用筛选"
            />
            <AnalysisKpiTile
              label="物理字段数"
              icon={Layers}
              iconClassName="text-monokai-cyan"
              value={overview.columnCount}
              hint={`主键: ${overview.pkColumns.length > 0 ? overview.pkColumns.join(', ') : '未指定'}`}
            />
            <AnalysisKpiTile
              label="数据完备率"
              icon={CheckCircle2}
              iconClassName="text-monokai-green"
              value={<span className="text-monokai-green">{Number.isFinite(overview.completenessRate) ? `${overview.completenessRate}%` : '未知'}</span>}
              hint={
                <div title="非空单元格数 / 总单元格数；可空字段缺失不等于质量异常" className={AH.progressTrack}>
                  <div
                    className="bg-monokai-green h-full rounded-sm transition-all"
                    style={{ width: `${Number.isFinite(overview.completenessRate) ? `${overview.completenessRate}%` : '未知'}` }}
                  />
                </div>
              }
            />
          </div>
        )}

        {/* Health alerts */}
        {healthAlerts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {healthAlerts.map((alert, i) => (
              <InlineAlert key={i} tone={alert.level === 'warning' ? 'warning' : 'info'}>
                <span className={AH.body}>{alert.text}</span>
              </InlineAlert>
            ))}
          </div>
        )}

        {/* Column profile cards */}
        <div className="flex flex-col gap-2">
          {filteredProfiles.length === 0 ? (
            <AnalysisEmptyHint message="没有匹配的字段，请调整搜索或语义筛选。" />
          ) : (
            filteredProfiles.map(prof => {
              const isNumeric = prof.semanticType === 'numeric';
              const isTemporal = prof.semanticType === 'temporal';

              return (
                <div
                  key={prof.name}
                  className={`${AH.cardInteractive} flex flex-col lg:flex-row lg:items-center justify-between gap-2.5`}
                >
                  {/* Left: name + type */}
                  <div className="flex items-start gap-2 min-w-[180px]">
                    <div className="mt-0.5 text-monokai-comment shrink-0">
                      {isNumeric && <Hash className="h-3.5 w-3.5" aria-hidden="true" />}
                      {isTemporal && <Calendar className="h-3.5 w-3.5" aria-hidden="true" />}
                      {prof.semanticType === 'categorical' && (
                        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {prof.semanticType === 'identifier' && (
                        <Key className="h-3.5 w-3.5 text-monokai-accent" aria-hidden="true" />
                      )}
                      {prof.semanticType === 'boolean' && (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-meta font-semibold text-monokai-fg truncate">
                          {prof.name}
                        </span>
                        {prof.isPrimaryKeyCandidate && (
                          <span title="当前数据非空且值唯一，仅为主键候选，不代表数据库已声明主键约束" className="rounded-sm bg-monokai-accent/10 px-1 py-px font-mono text-[9px] font-semibold text-monokai-accent border border-monokai-accent/30 shrink-0">
                            候选键
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-2xs text-monokai-comment font-mono">
                        <span>{prof.type}</span>
                        <span className="opacity-40">·</span>
                        <span>
                          基数 {prof.distinctCount.toLocaleString()} ({prof.cardinalityRate}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: stats */}
                  <div className="flex flex-wrap items-center gap-3 min-w-[220px]">
                    {/* Null rate */}
                    <div className="flex flex-col min-w-[80px]">
                      <span className={AH.label}>缺失率</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-12 bg-monokai-bg rounded-sm h-1 overflow-hidden">
                          <div
                            className={`h-full rounded-sm transition-all ${
                              prof.nullRate > 20
                                ? 'bg-monokai-pink'
                                : prof.nullRate > 0
                                  ? 'bg-monokai-yellow'
                                  : 'bg-monokai-green'
                            }`}
                            style={{ width: `${Math.min(prof.nullRate, 100)}%` }}
                          />
                        </div>
                        <span className={`font-mono text-meta font-semibold ${
                          prof.nullRate > 20 ? 'text-monokai-pink' : prof.nullRate > 0 ? 'text-monokai-yellow' : 'text-monokai-comment'
                        }`}>{prof.nullRate}%</span>
                      </div>
                    </div>

                    {/* Numeric stats */}
                    {isNumeric ? (
                      <div className="flex items-center gap-3 text-meta font-mono">
                        {[
                          ['MIN', prof.min, 'text-monokai-fg/80'],
                          ['MAX', prof.max, 'text-monokai-fg/80'],
                          ['AVG', prof.avg, 'text-monokai-cyan'],
                          ['MED', prof.median, 'text-monokai-green'],
                        ].map(([k, v, cls]) => (
                          <div key={k as string} className="flex flex-col">
                            <span className={AH.label}>{k}</span>
                            <span className={`font-semibold ${cls}`}>{v ?? '-'}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col min-w-[120px]">
                        <span className={AH.label}>取值范围</span>
                        <span
                          className="font-mono text-meta text-monokai-fg/80 truncate max-w-[160px]"
                          title={`${prof.min} ~ ${prof.max}`}
                        >
                          {prof.min !== null ? `"${prof.min}"` : 'null'} ~{' '}
                          {prof.max !== null ? `"${prof.max}"` : 'null'}
                        </span>
                      </div>
                    )}

                    {/* Top values */}
                    {prof.topValues && prof.topValues.length > 0 && (
                      <div className="hidden xl:flex flex-col min-w-[140px]">
                        <span className={`${AH.label} mb-0.5`}>高频 TOP 3</span>
                        <div className="flex flex-col gap-0.5">
                          {prof.topValues.slice(0, 3).map((tv, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-2xs font-mono"
                            >
                              <span
                                className="text-monokai-fg/80 truncate max-w-[90px]"
                                title={tv.value}
                              >
                                {tv.value}
                              </span>
                              <span className="text-monokai-comment ml-1 shrink-0">{tv.ratio}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-1 shrink-0 border-t lg:border-t-0 border-monokai-border/30 pt-2 lg:pt-0">
                    <button
                      type="button"
                      onClick={() => onNavigateToPivot(prof.name)}
                      className={AH.btnGhost}
                      title="将该字段加入透视工作台"
                    >
                      <TrendingUp className="h-3 w-3" aria-hidden="true" />
                      <span>透视</span>
                    </button>

                    {isTemporal && (
                      <button
                        type="button"
                        onClick={() => onNavigateToTimeSeries(prof.name)}
                        className={`${AH.btnGhost} text-monokai-orange hover:border-monokai-orange/40`}
                        title="开启时序分析"
                      >
                        <Calendar className="h-3 w-3" aria-hidden="true" />
                        <span>时序</span>
                      </button>
                    )}

                    {onInsertSql && (
                      <button
                        type="button"
                        onClick={() => handleOpenColumnProfileSql(prof.name)}
                        className={AH.iconBtn}
                        title="在 SQL 工作台打开此字段探查语句"
                        aria-label="打开字段探查 SQL"
                      >
                        <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopyColumnProfileSql(prof.name)}
                      className={AH.iconBtn}
                      title="复制此字段的统计 SQL"
                      aria-label="复制字段统计 SQL"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
