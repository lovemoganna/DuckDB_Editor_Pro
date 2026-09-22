import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Hash,
  Calendar,
  Layers,
  Key,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  Copy,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { analysisEngine, type ColumnProfile, type TableOverview } from './analysisEngine';
import type { ColumnInfo } from '../../types';
import { toastService } from '../../services/toastService';

interface AnalysisProfilerProps {
  currentTable: string;
  schema: ColumnInfo[];
  onNavigateToPivot: (column: string) => void;
  onNavigateToTimeSeries: (column: string) => void;
  onInsertSql?: (sql: string, executeDirectly?: boolean) => void;
}

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
        analysisEngine.fetchTableOverview(currentTable, schema),
        analysisEngine.fetchColumnProfiles(currentTable, schema),
      ]);
      setOverview(ov);
      setProfiles(profs);
    } catch (err: any) {
      console.error('[AnalysisProfiler] Failed to profile table:', err);
      setError(err?.message || '读取表画像时发生未知错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentTable, schema]);

  // Filtered columns
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.type.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedSemanticFilter === 'all' || p.semanticType === selectedSemanticFilter;
      return matchesSearch && matchesType;
    });
  }, [profiles, searchTerm, selectedSemanticFilter]);

  // Health alerts
  const healthAlerts = useMemo(() => {
    const alerts: { level: 'warning' | 'info' | 'success'; text: string }[] = [];
    const highNullCols = profiles.filter(p => p.nullRate > 20);
    if (highNullCols.length > 0) {
      alerts.push({
        level: 'warning',
        text: `发现 ${highNullCols.length} 个字段缺失率超过 20% (${highNullCols.map(c => c.name).join(', ')})`,
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
    const sql = `SELECT 
  COUNT(*) AS total_rows,
  COUNT("${colName}") AS non_null_count,
  COUNT(DISTINCT "${colName}") AS distinct_count,
  MIN("${colName}") AS min_val,
  MAX("${colName}") AS max_val
FROM "${currentTable}";`;
    navigator.clipboard.writeText(sql);
    toastService.success(`已复制 "${colName}" 字段探查 SQL！`);
  };

  if (loading && !overview) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-monokai-comment font-mono text-xs">
        <RefreshCw className="h-6 w-6 animate-spin text-monokai-orange" />
        <p>正在极速探测数据表 [{currentTable}] 字段画像与统计极值…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-500/20 bg-monokai-surface p-5 text-center text-xs text-rose-400">
        <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-rose-400" />
        <p className="font-semibold text-monokai-fg">数据体检异常</p>
        <p className="mt-1 font-mono text-rose-300/90">{error}</p>
        <button
          type="button"
          onClick={loadData}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-1.5 font-sans font-medium text-rose-400 hover:bg-rose-500/20 border border-monokai-border transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3 w-3" />
          重试体检
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar p-4 text-monokai-fg">
      {/* 1. Overview Health Dashboard Tiles */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex flex-col rounded-lg border border-monokai-border bg-monokai-surface p-3">
            <span className="text-[11px] text-monokai-comment font-mono flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-monokai-orange" />
              总记录行数
            </span>
            <span className="mt-1 text-xl font-bold font-mono text-monokai-fg">
              {overview.rowCount.toLocaleString()}
            </span>
            <span className="text-[10px] text-monokai-comment mt-0.5 font-mono">
              ~{overview.estimatedMemoryKb} KB 内存开销
            </span>
          </div>

          <div className="flex flex-col rounded-lg border border-monokai-border bg-monokai-surface p-3">
            <span className="text-[11px] text-monokai-comment font-mono flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-monokai-cyan" />
              物理字段数
            </span>
            <span className="mt-1 text-xl font-bold font-mono text-monokai-fg">
              {overview.columnCount}
            </span>
            <span className="text-[10px] text-monokai-comment mt-0.5 font-mono">
              主键: {overview.pkColumns.length > 0 ? overview.pkColumns.join(', ') : '未显式指定'}
            </span>
          </div>

          <div className="flex flex-col rounded-lg border border-monokai-border bg-monokai-surface p-3">
            <span className="text-[11px] text-monokai-comment font-mono flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-monokai-green" />
              数据完备率
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-monokai-green">
                {overview.completenessRate}%
              </span>
            </div>
            <div className="w-full bg-monokai-bg rounded-full h-1 mt-1.5 overflow-hidden">
              <div
                className="bg-monokai-green h-full rounded-full transition-all"
                style={{ width: `${overview.completenessRate}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col rounded-lg border border-monokai-border bg-monokai-surface p-3">
            <span className="text-[11px] text-monokai-comment font-mono flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-monokai-yellow" />
              全表健康度评分
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-monokai-yellow">
                {overview.healthScore}
              </span>
              <span className="text-[11px] text-monokai-comment">/ 100</span>
            </div>
            <span className="text-[10px] text-monokai-comment mt-0.5">
              {overview.healthScore >= 90 ? '状态极佳，适合直接建模分析' : '存在部分空值，建议预处理'}
            </span>
          </div>
        </div>
      )}

      {/* 2. Health Alerts if any */}
      {healthAlerts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {healthAlerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs border ${
                alert.level === 'warning'
                  ? 'border-monokai-border-subtle bg-amber-500/10 text-amber-400'
                  : 'border-monokai-border-subtle bg-sky-500/10 text-sky-400'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{alert.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* 3. Search & Semantic Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-monokai-border/60 pb-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-monokai-comment" />
          <input
            type="text"
            placeholder="搜索字段名或数据类型..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-monokai-border bg-monokai-surface py-1.5 pl-8 pr-3 text-xs text-monokai-fg placeholder-monokai-comment focus:border-monokai-accent focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'all', label: '全部字段' },
            { id: 'numeric', label: '数值度量' },
            { id: 'categorical', label: '维度分类' },
            { id: 'temporal', label: '时间日期' },
            { id: 'identifier', label: '主外键/ID' },
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedSemanticFilter(f.id)}
              className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
                selectedSemanticFilter === f.id
                  ? 'bg-monokai-surface border border-monokai-border text-monokai-accent font-semibold'
                  : 'bg-monokai-surface border border-monokai-border text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            title="刷新体检数据"
            onClick={loadData}
            className="p-1.5 rounded bg-monokai-surface border border-monokai-border text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4. Column Profiles Grid/Table */}
      <div className="flex flex-col gap-2.5">
        {filteredProfiles.map(prof => {
          const isNumeric = prof.semanticType === 'numeric';
          const isTemporal = prof.semanticType === 'temporal';

          return (
            <div
              key={prof.name}
              className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-lg border border-monokai-border bg-monokai-surface p-3.5 hover:border-monokai-border/90 transition-all shadow-xs"
            >
              {/* Col Info */}
              <div className="flex items-start gap-3 min-w-[240px]">
                <div className="mt-0.5">
                  {isNumeric && <Hash className="h-4 w-4 text-monokai-comment" />}
                  {isTemporal && <Calendar className="h-4 w-4 text-monokai-comment" />}
                  {prof.semanticType === 'categorical' && <Layers className="h-4 w-4 text-monokai-comment" />}
                  {prof.semanticType === 'identifier' && <Key className="h-4 w-4 text-monokai-accent" />}
                  {prof.semanticType === 'boolean' && <CheckCircle2 className="h-4 w-4 text-monokai-comment" />}
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-semibold text-monokai-fg">
                      {prof.name}
                    </span>
                    {prof.isPrimaryKeyCandidate && (
                      <span className="rounded bg-monokai-surface px-1.5 py-0.5 font-mono text-[9px] font-semibold text-monokai-accent border border-monokai-border">
                        PK CANDIDATE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-[10px] text-monokai-comment">
                      {prof.type}
                    </span>
                    <span className="text-[10px] text-monokai-comment/50">•</span>
                    <span className="text-[10px] text-monokai-comment font-mono">
                      基数(唯一样本): {prof.distinctCount.toLocaleString()} ({prof.cardinalityRate}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Quality & Extrema Stats */}
              <div className="flex flex-wrap items-center gap-6 min-w-[280px]">
                {/* Null rate */}
                <div className="flex flex-col min-w-[100px]">
                  <span className="text-[10px] text-monokai-comment">缺失率 (Nulls)</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-16 bg-monokai-bg rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          prof.nullRate > 20 ? 'bg-monokai-pink' : prof.nullRate > 0 ? 'bg-monokai-yellow' : 'bg-monokai-green'
                        }`}
                        style={{ width: `${prof.nullRate}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs font-semibold">
                      {prof.nullRate}%
                    </span>
                  </div>
                </div>

                {/* Min / Max / Avg Stats for numeric */}
                {isNumeric ? (
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-monokai-comment">MIN</span>
                      <span className="font-semibold text-monokai-fg">{prof.min ?? '-'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-monokai-comment">MAX</span>
                      <span className="font-semibold text-monokai-fg">{prof.max ?? '-'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-monokai-comment">AVG</span>
                      <span className="font-semibold text-monokai-cyan">{prof.avg ?? '-'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-monokai-comment">MEDIAN</span>
                      <span className="font-semibold text-monokai-green">{prof.median ?? '-'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col min-w-[160px]">
                    <span className="text-[10px] text-monokai-comment">取值极值范围</span>
                    <span className="font-mono text-xs text-monokai-fg truncate max-w-[200px]" title={`${prof.min} ~ ${prof.max}`}>
                      {prof.min !== null ? `"${prof.min}"` : 'null'} ~ {prof.max !== null ? `"${prof.max}"` : 'null'}
                    </span>
                  </div>
                )}

                {/* Top 5 Frequent distribution */}
                {prof.topValues && prof.topValues.length > 0 && (
                  <div className="hidden xl:flex flex-col min-w-[180px]">
                    <span className="text-[10px] text-monokai-comment mb-0.5">高频分布 TOP 3</span>
                    <div className="flex flex-col gap-0.5">
                      {prof.topValues.slice(0, 3).map((tv, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-monokai-fg/80 truncate max-w-[110px]" title={tv.value}>
                            {tv.value}
                          </span>
                          <span className="text-monokai-comment">{tv.ratio}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0 border-t lg:border-t-0 border-monokai-border/40 pt-2 lg:pt-0">
                <button
                  type="button"
                  onClick={() => onNavigateToPivot(prof.name)}
                  className="inline-flex items-center gap-1 rounded bg-monokai-bg border border-monokai-border px-2.5 py-1 text-xs text-monokai-fg hover:border-monokai-border-strong hover:text-monokai-orange transition-colors cursor-pointer"
                  title="将该字段加入多维透视聚合工作台"
                >
                  <TrendingUp className="h-3 w-3" />
                  <span>以此列透视</span>
                </button>

                {isTemporal && (
                  <button
                    type="button"
                    onClick={() => onNavigateToTimeSeries(prof.name)}
                    className="inline-flex items-center gap-1 rounded bg-monokai-bg border border-monokai-border px-2.5 py-1 text-xs text-monokai-orange hover:bg-monokai-orange/10 transition-colors cursor-pointer"
                    title="以此时间字段开启时序走势与波动分析"
                  >
                    <Calendar className="h-3 w-3" />
                    <span>时序分析</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleCopyColumnProfileSql(prof.name)}
                  className="p-1.5 rounded text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg transition-colors cursor-pointer"
                  title="复制此字段的统计 SQL"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
