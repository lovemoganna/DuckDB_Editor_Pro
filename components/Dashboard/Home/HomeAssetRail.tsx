import React, { useMemo, useState } from 'react';
import {
  Table as TableIcon,
  Search,
  Play,
  Eye,
  Key,
  ArrowRight,
  Clock,
  Activity,
  Database,
} from 'lucide-react';
import { Tab } from '../../../types';
import {
  type TableItemDetail,
  type DashboardDbMetrics,
  type RecentImportItem,
} from '../../../hooks/useDashboardWorkflow';
import { DB } from '../dashboardUi';

export interface TableReadinessHint {
  name: string;
  score: number;
  missing: string[];
  hasTime: boolean;
  hasMeasure: boolean;
  hasCategory: boolean;
}

export interface HomeAssetRailProps {
  tables: TableItemDetail[];
  metrics?: DashboardDbMetrics;
  recentImports?: RecentImportItem[];
  tableUsageFrequency?: Array<{ name: string; count: number }>;
  tableReadiness?: TableReadinessHint[];
  onSelectTable?: (tableName: string) => void;
  onSelectTableStructure?: (tableName: string) => void;
  onSelectTableAnalysis?: (tableName: string) => void;
  onSelectTableMetrics?: (tableName: string) => void;
  onPeekTable?: (tableName: string) => void;
  onQuickQuery?: (tableName: string) => void;
  onNavigate?: (tab: Tab) => void;
  onOpenImport?: () => void;
}

export const HomeAssetRail: React.FC<HomeAssetRailProps> = ({
  tables = [],
  metrics,
  recentImports = [],
  tableUsageFrequency = [],
  tableReadiness = [],
  onSelectTable,
  onSelectTableStructure,
  onSelectTableAnalysis,
  onSelectTableMetrics,
  onPeekTable,
  onQuickQuery,
  onNavigate,
  onOpenImport,
}) => {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'all' | 'hot' | 'recent'>('all');

  const freqMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of tableUsageFrequency) m.set(f.name.toLowerCase(), f.count);
    return m;
  }, [tableUsageFrequency]);

  const readinessMap = useMemo(() => {
    const m = new Map<string, TableReadinessHint>();
    for (const r of tableReadiness) m.set(r.name.toLowerCase(), r);
    return m;
  }, [tableReadiness]);

  const recentTableNames = useMemo(() => {
    const names = new Set<string>();
    for (const imp of recentImports.slice(0, 8)) {
      if (imp.tableName) {
        for (const part of String(imp.tableName).split(',')) {
          names.add(part.trim().toLowerCase());
        }
      }
    }
    return names;
  }, [recentImports]);

  const filtered = useMemo(() => {
    let list = [...tables];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) => t.name.toLowerCase().includes(q) || t.schema?.toLowerCase().includes(q),
      );
    }
    if (mode === 'hot') {
      list.sort(
        (a, b) =>
          (freqMap.get(b.name.toLowerCase()) || 0) - (freqMap.get(a.name.toLowerCase()) || 0),
      );
      list = list.filter((t) => (freqMap.get(t.name.toLowerCase()) || 0) > 0).slice(0, 12);
    } else if (mode === 'recent') {
      list = list.filter((t) => recentTableNames.has(t.name.toLowerCase()));
      if (list.length === 0) {
        list = [...tables].slice(0, 8);
      }
    } else {
      list.sort((a, b) => b.rowCount - a.rowCount);
    }
    return list;
  }, [tables, search, mode, freqMap, recentTableNames]);

  const relationHint = useMemo(() => {
    const withPk = tables.filter((t) => t.hasPrimaryKey).length;
    const views = tables.filter((t) => t.type === 'view').length;
    return { withPk, views, total: tables.length };
  }, [tables]);

  return (
    <section className={`${DB.panelLg} gap-3 min-h-[360px]`}>
      <div className={DB.sectionHeader}>
        <div className="flex items-center gap-2 min-w-0">
          <Database className="h-3.5 w-3.5 text-monokai-accent shrink-0" />
          <h2 className={DB.sectionTitle}>数据资产</h2>
          <span className={DB.sectionMeta}>
            {metrics?.tableCount ?? tables.length} 表
            {metrics?.viewCount ? ` · ${metrics.viewCount} 视图` : ''}
          </span>
        </div>
        <button
          type="button"
          className={DB.btnGhostLink}
          onClick={() => onNavigate?.(Tab.DATA)}
        >
          全部
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-2xs font-mono text-monokai-comment">
        <span className={DB.chip}>行数合计 {metrics?.formattedTotalRows || '0'}</span>
        <span className={DB.chip}>有 PK {relationHint.withPk}</span>
        <span className={DB.chip}>体积 {metrics?.dataSize || '0 B'}</span>
        {recentImports[0] && (
          <span className={DB.chip} title={recentImports[0].name}>
            <Clock className="h-3 w-3" />
            最近导入 {recentImports[0].tableName || recentImports[0].name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-monokai-comment" />
          <input
            className={DB.input}
            placeholder="搜索表…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={DB.segment}>
          {(
            [
              ['all', '全部'],
              ['hot', '高频'],
              ['recent', '最近'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={mode === id ? DB.segmentItemActive : DB.segmentItem}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tables.length === 0 ? (
        <div className={DB.empty}>
          <p className="text-sm text-monokai-fg">尚无数据表</p>
          <p className="text-meta text-monokai-comment">导入 CSV / Parquet 或新建表后，资产会出现在这里</p>
          {onOpenImport && (
            <button type="button" onClick={onOpenImport} className={`${DB.btnSecondary} mt-2`}>
              导入数据
            </button>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-1 overflow-y-auto custom-scrollbar flex-1 max-h-[420px] pr-0.5">
          {filtered.map((t) => {
            const uses = freqMap.get(t.name.toLowerCase()) || 0;
            const ready = readinessMap.get(t.name.toLowerCase());
            return (
              <li key={t.name}>
                <div className="group flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:border-monokai-border hover:bg-monokai-elevated/50 transition-colors">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                    onClick={() => onSelectTable?.(t.name)}
                    title={
                      ready?.missing?.length
                        ? `打开数据：${t.name}（缺口：${ready.missing.join('、')}）`
                        : `打开数据：${t.name}`
                    }
                  >
                    <TableIcon className="h-3.5 w-3.5 shrink-0 text-monokai-fg-muted" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-monokai-fg font-mono">
                          {t.name}
                        </span>
                        {t.hasPrimaryKey && (
                          <span title="有主键">
                            <Key className="h-2.5 w-2.5 text-monokai-yellow shrink-0" />
                          </span>
                        )}
                        {t.type === 'view' && <span className={DB.badgeInfo}>VIEW</span>}
                        {ready && (
                          <span
                            className={ready.score >= 60 ? DB.badgeOk : DB.badgeWarn}
                            title={ready.missing.join('；') || '分析字段较完备'}
                          >
                            {ready.score}%
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-2 text-2xs font-mono text-monokai-comment">
                        <span>{t.formattedRowCount} 行</span>
                        <span>{t.columnCount ?? '—'} 列</span>
                        <span>{t.formattedSize}</span>
                        {ready && (
                          <span>
                            {[
                              ready.hasMeasure ? '度量' : null,
                              ready.hasTime ? '时间' : null,
                              ready.hasCategory ? '分类' : null,
                            ]
                              .filter(Boolean)
                              .join('·') || '缺分析字段'}
                          </span>
                        )}
                        {uses > 0 && (
                          <span className="text-monokai-accent">
                            <Activity className="inline h-2.5 w-2.5 mr-0.5" />
                            {uses} 次查询
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      className={DB.btnIcon}
                      style={{ height: 28, width: 28 }}
                      title={`预览 ${t.name}`}
                      onClick={() => onPeekTable?.(t.name)}
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className={DB.btnIcon}
                      style={{ height: 28, width: 28 }}
                      title="快速查询"
                      onClick={() => onQuickQuery?.(t.name)}
                    >
                      <Play className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="text-2xs text-monokai-comment hover:text-monokai-fg px-1 cursor-pointer"
                      title="Schema"
                      onClick={() => onSelectTableStructure?.(t.name)}
                    >
                      Schema
                    </button>
                    <button
                      type="button"
                      className="text-2xs text-monokai-comment hover:text-monokai-fg px-1 cursor-pointer"
                      title="分析"
                      onClick={() => onSelectTableAnalysis?.(t.name)}
                    >
                      分析
                    </button>
                    {onSelectTableMetrics && <button type="button" className="text-2xs text-monokai-cyan hover:underline px-1 cursor-pointer" title={`管理 ${t.name} 的业务指标`} onClick={() => onSelectTableMetrics(t.name)}>指标</button>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
