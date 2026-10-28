import React, { useState, useMemo, useEffect } from 'react';
import {
  Table as TableIcon,
  Search,
  Play,
  Database,
  Plus,
  Upload,
  ArrowRight,
  Eye,
  Key,
  BarChart3,
  Activity,
  FileSpreadsheet,
  FileText,
  Clock,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  PieChart,
  Sparkles,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { duckDBService } from '../../../services/duckdbService';
import { Tab } from '../../../types';
import {
  type TableItemDetail,
  type DashboardDbMetrics,
  type RecentImportItem,
} from '../../../hooks/useDashboardWorkflow';
import { useAppStore } from '../../../hooks/store/useAppStore';
import { EmptyCockpitIllustration } from './DashboardSvgIllustrations';
import { DB } from '../dashboardUi';

interface DataAssetTopologyViewProps {
  tables: TableItemDetail[];
  metrics?: DashboardDbMetrics;
  recentImports?: RecentImportItem[];
  onSelectTable?: (tableName: string) => void;
  onSelectTableStructure?: (tableName: string, focusTab?: 'profile' | 'add' | 'ddl') => void;
  onSelectTableAnalysis?: (tableName: string) => void;
  onSelectTableMetrics?: (tableName: string) => void;
  onPeekTable?: (tableName: string) => void;
  onQuickQuery?: (tableName: string) => void;
  onNavigate?: (tab: Tab) => void;
  onOpenCreate?: () => void;
  onOpenImport?: () => void;
  onOpenExport?: () => void;
}

interface CalculatedNode {
  name: string;
  rowCount: string;
  rawRowCount: number;
  type: string;
  hasPrimaryKey?: boolean;
  isCenter: boolean;
  x: number;
  y: number;
}

export const DataAssetTopologyView: React.FC<DataAssetTopologyViewProps> = ({
  tables = [],
  metrics,
  recentImports = [],
  onSelectTable,
  onSelectTableStructure,
  onSelectTableAnalysis,
  onSelectTableMetrics,
  onPeekTable,
  onQuickQuery,
  onNavigate,
  onOpenCreate,
  onOpenImport,
  onOpenExport,
}) => {
  type AssetViewTab = 'er' | 'schema' | 'profile' | 'sample' | 'quality' | 'dataset';
  /** Default to asset list — ER / profile are secondary progressive disclosure */
  const [activeTab, setActiveTab] = useState<AssetViewTab>('dataset');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);

  // Instant sampling states
  const [sampleRows, setSampleRows] = useState<Record<string, any>[]>([]);
  const [sampleCols, setSampleCols] = useState<string[]>([]);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [sampleReloadKey, setSampleReloadKey] = useState(0);

  const setCurrentTable = useAppStore((s) => s.setCurrentTable);

  const filteredTables = useMemo(() => {
    if (!searchQuery.trim()) return tables;
    const q = searchQuery.toLowerCase();
    return tables.filter(
      (t) => t.name.toLowerCase().includes(q) || t.schema?.toLowerCase().includes(q)
    );
  }, [tables, searchQuery]);

  const activeTargetTable = selectedTableName || filteredTables[0]?.name || tables[0]?.name;

  useEffect(() => {
    if (activeTab !== 'sample' || !activeTargetTable) return;
    let isCancelled = false;
    setSampleLoading(true);
    setSampleError(null);

    duckDBService.query(`SELECT * FROM "${activeTargetTable}" LIMIT 10;`)
      .then((res) => {
        if (isCancelled) return;
        if (Array.isArray(res)) {
          setSampleRows(res);
          if (res.length > 0 && typeof res[0] === 'object' && res[0] !== null) {
            setSampleCols(Object.keys(res[0]));
          } else {
            setSampleCols([]);
          }
        } else {
          setSampleRows([]);
          setSampleCols([]);
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        setSampleError(err?.message || '采样查询执行失败');
        setSampleRows([]);
      })
      .finally(() => {
        if (!isCancelled) setSampleLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeTab, activeTargetTable, sampleReloadKey]);

  // Column type breakdown & profiling
  const tableProfileMetrics = useMemo(() => {
    const target = filteredTables.find((t) => t.name === activeTargetTable) || filteredTables[0] || tables[0];
    if (!target) return null;

    const cols = target.columns || [];
    let numericCount = 0;
    let textCount = 0;
    let timeCount = 0;
    let boolCount = 0;
    let otherCount = 0;

    cols.forEach((c) => {
      const typeStr = (c.type || '').toUpperCase();
      if (/INT|FLOAT|DOUBLE|DECIMAL|NUMERIC|BIGINT|HUGEINT|REAL/.test(typeStr)) {
        numericCount++;
      } else if (/CHAR|VARCHAR|TEXT|STRING/.test(typeStr)) {
        textCount++;
      } else if (/DATE|TIME|TIMESTAMP|INTERVAL/.test(typeStr)) {
        timeCount++;
      } else if (/BOOL/.test(typeStr)) {
        boolCount++;
      } else {
        otherCount++;
      }
    });

    const totalCols = cols.length || 1;
    return {
      table: target,
      numericCount,
      textCount,
      timeCount,
      boolCount,
      otherCount,
      totalCols: cols.length,
      numericPct: Math.round((numericCount / totalCols) * 100),
      textPct: Math.round((textCount / totalCols) * 100),
      timePct: Math.round((timeCount / totalCols) * 100),
      boolPct: Math.round((boolCount / totalCols) * 100),
      otherPct: Math.round((otherCount / totalCols) * 100),
    };
  }, [filteredTables, activeTargetTable, tables]);

  // Data Quality Audit
  const qualityAudit = useMemo(() => {
    const total = tables.length;
    if (total === 0) return { score: 100, missingPk: [], emptyTables: [], viewCount: 0, tableCount: 0 };
    const missingPk = tables.filter((t) => t.type !== 'view' && !t.hasPrimaryKey);
    const emptyTables = tables.filter((t) => t.rowCount === 0);
    const viewCount = tables.filter((t) => t.type === 'view').length;
    const tableCount = total - viewCount;

    let deductions = 0;
    if (tableCount > 0) {
      deductions += Math.round((missingPk.length / tableCount) * 25);
      deductions += Math.round((emptyTables.length / tableCount) * 20);
    }
    const score = Math.max(40, 100 - deductions);

    return {
      score,
      missingPk,
      emptyTables,
      viewCount,
      tableCount,
    };
  }, [tables]);

  // Dynamically calculate node layout based purely on REAL tables
  const { nodes, centerNode, connections } = useMemo(() => {
    if (filteredTables.length === 0) {
      return { nodes: [], centerNode: null, connections: [] };
    }

    // Sort to find largest table as center hub
    const sorted = [...filteredTables].sort((a, b) => b.rowCount - a.rowCount);
    const center = sorted[0];
    const satellites = sorted.slice(1, 9); // Max 8 satellite nodes for clean visualization

    const calculatedCenter: CalculatedNode = {
      name: center.name,
      rowCount: center.formattedRowCount,
      rawRowCount: center.rowCount,
      type: center.type || 'table',
      hasPrimaryKey: center.hasPrimaryKey,
      isCenter: true,
      x: 50,
      y: 48,
    };

    const calculatedSatellites: CalculatedNode[] = satellites.map((sat, i) => {
      // Position satellites radially around center
      const angle = (i / satellites.length) * 2 * Math.PI - Math.PI / 2;
      const radiusX = 35; // Horizontal radius %
      const radiusY = 26; // Vertical radius %
      const x = 50 + radiusX * Math.cos(angle);
      const y = 46 + radiusY * Math.sin(angle);

      return {
        name: sat.name,
        rowCount: sat.formattedRowCount,
        rawRowCount: sat.rowCount,
        type: sat.type || 'table',
        hasPrimaryKey: sat.hasPrimaryKey,
        isCenter: false,
        x: Math.max(14, Math.min(86, Math.round(x))),
        y: Math.max(14, Math.min(78, Math.round(y))),
      };
    });

    const allNodes = [calculatedCenter, ...calculatedSatellites];

    // Compute bezier connection curves from satellites to center (mapped to viewBox="0 0 100 100")
    const connList = calculatedSatellites.map((sat) => ({
      from: sat.name,
      to: calculatedCenter.name,
      d: `M ${sat.x} ${sat.y} Q 50 ${sat.y}, 50 48`,
      isView: sat.type === 'view',
    }));

    return {
      nodes: allNodes,
      centerNode: calculatedCenter,
      connections: connList,
    };
  }, [filteredTables]);

  const selectedTableDetail = useMemo(() => {
    return filteredTables.find((t) => t.name === selectedTableName) || null;
  }, [filteredTables, selectedTableName]);

  const handleNodeClick = (node: CalculatedNode) => {
    setSelectedTableName((prev) => (prev === node.name ? null : node.name));
    setCurrentTable(node.name);
  };

  const handleNodeDoubleClick = (node: CalculatedNode) => {
    if (onPeekTable) {
      onPeekTable(node.name);
    } else if (onSelectTable) {
      onSelectTable(node.name);
    }
  };

  const handleNavigateToData = (tableName: string) => {
    setCurrentTable(tableName);
    if (onSelectTable) {
      onSelectTable(tableName);
    } else {
      onNavigate?.(Tab.DATA);
    }
  };

  return (
    <div className={`${DB.panelLg}`}>
      {/* Quiet panel chrome — title + tools, no icon tile */}
      <div className="flex flex-col gap-2 border-b border-monokai-border/80 pb-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <h2 className="text-sm font-semibold text-monokai-fg font-sans tracking-tight">数据资产</h2>
            <span className="font-mono text-2xs text-monokai-comment tabular-nums">
              {tables.length}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onOpenCreate && (
              <button type="button" onClick={onOpenCreate} className={DB.btnSecondary} title="新建表">
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">新建</span>
              </button>
            )}
            {onOpenImport && (
              <button type="button" onClick={onOpenImport} className={DB.btnSecondary} title="导入数据">
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">导入</span>
              </button>
            )}
            {onOpenExport && (
              <button type="button" onClick={onOpenExport} className={DB.btnSecondary} title="导出">
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">导出</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate?.(Tab.DATA)}
              className={DB.btnGhostLink}
              title="打开数据网格"
            >
              <span>数据页</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* Primary views + secondary select — avoid 6-pill chrome */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <div className={DB.segment}>
              {(
                [
                  { id: 'dataset' as const, label: '数据集' },
                  { id: 'er' as const, label: 'ER' },
                  { id: 'schema' as const, label: '结构' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`${activeTab === tab.id ? DB.segmentItemActive : DB.segmentItem} ${DB.focus}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor="asset-more-view">
              更多视图
            </label>
            <select
              id="asset-more-view"
              value={['profile', 'sample', 'quality'].includes(activeTab) ? activeTab : ''}
              onChange={(e) => {
                const v = e.target.value as AssetViewTab | '';
                if (v) setActiveTab(v);
              }}
              className="rounded-md border border-monokai-border bg-monokai-elevated px-2 py-0.5 text-2xs font-mono text-monokai-fg-muted hover:text-monokai-fg cursor-pointer focus:outline-none focus:border-monokai-accent/70"
              title="画像 / 抽样 / 质量"
            >
              <option value="" disabled>
                更多…
              </option>
              <option value="profile">画像</option>
              <option value="sample">抽样</option>
              <option value="quality">
                {qualityAudit.missingPk.length > 0 ? '质量 (!)' : '质量'}
              </option>
            </select>
          </div>

          <div className="relative flex items-center flex-1 min-w-[140px] max-w-[200px]">
            <Search className="absolute left-2 h-3.5 w-3.5 text-monokai-comment pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索表…"
              className={DB.input}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-monokai-comment hover:text-monokai-fg font-mono text-xs cursor-pointer"
                title="清除搜索"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      {activeTab === 'er' ? (
        <div className="relative mt-2.5 flex-1 w-full overflow-hidden rounded-md border border-monokai-border bg-monokai-bg/60 min-h-[360px]">
          {/* Subtle grid background */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)',
              backgroundSize: '20px 20px',
            }}
          />

          {tables.length === 0 ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center space-y-3 p-4 text-center">
              <EmptyCockpitIllustration className="mb-1" />
              <div>
                <p className="text-xs sm:text-sm font-semibold text-monokai-fg">当前数据库暂无数据表或视图</p>
                <p className="mt-0.5 text-xs text-monokai-comment">
                  导入外部 CSV / Parquet，或在 SQL 编辑器中运行 DDL 语句创建表
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenCreate}
                  className="inline-flex items-center gap-1 rounded bg-monokai-accent text-monokai-bg font-semibold px-2.5 py-1 text-xs hover:bg-monokai-accent/90 transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="h-3 w-3" />
                  <span>新建数据表</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenImport}
                  className="inline-flex items-center gap-1 rounded border border-monokai-border bg-monokai-elevated px-2.5 py-1 text-xs font-medium text-monokai-fg hover:border-monokai-border-strong transition-all cursor-pointer"
                >
                  <Upload className="h-3 w-3" />
                  <span>导入文件</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* SVG Connecting Curves */}
              <svg
                className="absolute inset-0 h-full w-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="grad-active-conn" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#66d9ef" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#a6e22e" stopOpacity="0.8" />
                  </linearGradient>
                </defs>

                {connections.map((conn) => (
                  <path
                    key={`${conn.from}-${conn.to}`}
                    d={conn.d}
                    stroke="url(#grad-active-conn)"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                    fill="none"
                    strokeDasharray={conn.isView ? '4 2' : undefined}
                  />
                ))}
              </svg>

              {/* Render Dynamic Nodes */}
              {nodes.map((node, index) => {
                const isSelected = selectedTableName === node.name;
                const isView = node.type === 'view';
                const isSearchMatch = searchQuery
                  ? node.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
                  : true;

                // Color themes aligned with Monokai
                const satellitePalettes = [
                  { border: 'border-monokai-cyan/70', bg: 'bg-monokai-elevated', text: 'text-monokai-cyan' },
                  { border: 'border-monokai-purple/70', bg: 'bg-monokai-elevated', text: 'text-monokai-purple' },
                  { border: 'border-monokai-yellow/70', bg: 'bg-monokai-elevated', text: 'text-monokai-yellow' },
                  { border: 'border-monokai-orange/70', bg: 'bg-monokai-elevated', text: 'text-monokai-orange' },
                  { border: 'border-monokai-accent/70', bg: 'bg-monokai-elevated', text: 'text-monokai-accent' },
                ];
                const theme = satellitePalettes[(index - 1 + satellitePalettes.length) % satellitePalettes.length];

                return (
                  <div
                    key={node.name}
                    onClick={() => handleNodeClick(node)}
                    onDoubleClick={() => handleNodeDoubleClick(node)}
                    style={{
                      left: `${node.x}%`,
                      top: `${node.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className={`group absolute z-10 flex cursor-pointer items-center gap-2 rounded-md border p-2 shadow-sm   transition-all duration-200 hover:scale-105 hover:z-30 ${
                      node.isCenter
                        ? 'border-monokai-accent bg-monokai-elevated min-w-[120px] py-1.5 px-2.5 ring-1 ring-monokai-accent/60'
                        : isView
                          ? 'border-monokai-purple/70 bg-monokai-elevated min-w-[105px]'
                          : `${theme.border} ${theme.bg} min-w-[105px]`
                    } ${isSelected ? 'ring-2 ring-monokai-cyan ring-offset-1 ring-offset-monokai-bg' : ''} ${
                      !isSearchMatch ? 'opacity-30 scale-95' : searchQuery ? 'ring-2 ring-monokai-cyan animate-pulse' : ''
                    }`}
                  >
                    {/* Hover Quick Action Pill */}
                    <div className="pointer-events-none group-hover:pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded bg-monokai-elevated border border-monokai-border p-0.5 shadow-md z-30">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigateToData(node.name);
                        }}
                        className="p-1 hover:bg-monokai-hover rounded text-monokai-cyan"
                        title="查看数据网格"
                      >
                        <TableIcon className="h-2.5 w-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickQuery?.(node.name);
                        }}
                        className="p-1 hover:bg-monokai-hover rounded text-monokai-accent"
                        title="在 SQL 编辑器查询"
                      >
                        <Play className="h-2.5 w-2.5 fill-current" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPeekTable?.(node.name);
                        }}
                        className="p-1 hover:bg-monokai-hover rounded text-monokai-yellow"
                        title="抽屉快速预览"
                      >
                        <Eye className="h-2.5 w-2.5" />
                      </button>
                    </div>

                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-monokai-bg">
                      <TableIcon
                        className={`h-3 w-3 ${
                          node.isCenter
                            ? 'text-monokai-accent'
                            : isView
                              ? 'text-monokai-purple'
                              : theme.text
                        }`}
                      />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-xs font-bold text-monokai-fg">{node.name}</span>
                        {node.hasPrimaryKey && (
                          <span title="包含主键" className="inline-flex shrink-0">
                            <Key className="h-2.5 w-2.5 text-monokai-yellow" />
                          </span>
                        )}
                      </div>
                      <div
                        className={`font-mono text-2xs ${
                          node.isCenter
                            ? 'text-monokai-accent'
                            : isView
                              ? 'text-monokai-purple'
                              : theme.text
                        }`}
                      >
                        {node.rowCount} 行
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* In-situ Docked Selected Entity Inspector */}
              {selectedTableDetail && (
                <div className="absolute bottom-2 left-2 right-2 z-30 flex flex-wrap items-center justify-between gap-2 rounded-md border border-monokai-cyan/50 bg-monokai-surface/95 backdrop-blur-md px-3 py-1.5 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-monokai-elevated border border-monokai-cyan/40 text-monokai-cyan shrink-0">
                      <TableIcon className="h-3 w-3" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-monokai-fg truncate">{selectedTableDetail.name}</span>
                        <span className="rounded bg-monokai-elevated px-1 py-0.2 text-3xs font-mono text-monokai-fg-muted border border-monokai-border">
                          {selectedTableDetail.type || 'table'}
                        </span>
                        {selectedTableDetail.hasPrimaryKey && (
                          <span className="rounded bg-monokai-yellow/15 border border-monokai-yellow/30 px-1 py-0.2 text-3xs font-mono text-monokai-yellow font-bold">PK</span>
                        )}
                      </div>
                      <div className="font-mono text-2xs text-monokai-comment flex items-center gap-2">
                        <span className="text-monokai-accent">{selectedTableDetail.formattedRowCount} 行</span>
                        <span>·</span>
                        <span>{selectedTableDetail.columnCount} 列</span>
                        <span>·</span>
                        <span>{selectedTableDetail.formattedSize}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleNavigateToData(selectedTableDetail.name)}
                      className="flex items-center gap-1 rounded bg-monokai-elevated hover:bg-monokai-hover border border-monokai-border px-2 py-0.5 text-meta font-mono text-monokai-cyan transition-colors cursor-pointer"
                      title="进入数据网格查看"
                    >
                      <TableIcon className="h-2.5 w-2.5" />
                      <span>数据网格</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuickQuery?.(selectedTableDetail.name)}
                      className="flex items-center gap-1 rounded bg-monokai-cyan/20 hover:bg-monokai-cyan/30 border border-monokai-cyan/40 px-2 py-0.5 text-meta font-mono text-monokai-cyan font-semibold transition-colors cursor-pointer"
                      title="在 SQL 编辑器中运行抽样查询"
                    >
                      <Play className="h-2.5 w-2.5 fill-current" />
                      <span>即席查询</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onPeekTable?.(selectedTableDetail.name)}
                      className="flex items-center gap-1 rounded bg-monokai-elevated hover:bg-monokai-hover border border-monokai-border px-2 py-0.5 text-meta font-mono text-monokai-yellow transition-colors cursor-pointer"
                      title="打开全景抽屉查看字段与剖析"
                    >
                      <Eye className="h-2.5 w-2.5" />
                      <span>抽屉预览</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTableName(null)}
                      className="ml-1 text-monokai-comment hover:text-monokai-fg p-0.5 font-mono text-xs cursor-pointer"
                      title="关闭检视坞"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {/* Dynamic Footer Tip (rendered when no table is pinned) */}
              {!selectedTableDetail && (
                <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-meta text-monokai-comment font-mono">
                  <span className="pointer-events-none">点击实体就地锁定检视 · 双击抽屉全景 · 悬停快捷入口</span>
                  <div className="flex items-center gap-2">
                    {filteredTables.length > nodes.length && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('schema')}
                        className="rounded bg-monokai-cyan/15 border border-monokai-cyan/40 px-2 py-0.5 text-meta text-monokai-cyan hover:bg-monokai-cyan/25 cursor-pointer pointer-events-auto transition-colors font-mono"
                        title="点击切换到表结构列表查看全部数据表"
                      >
                        +{filteredTables.length - nodes.length} 张更多表 (切至结构列表)
                      </button>
                    )}
                    <span className="pointer-events-none">
                      {nodes.length} 实体 · {connections.length} 关联路径
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : activeTab === 'schema' ? (
        <div className="mt-2.5 flex-1 w-full overflow-y-auto space-y-1.5 custom-scrollbar pr-1 min-h-[360px]">
          {filteredTables.length === 0 ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-monokai-comment text-xs font-mono">
              无匹配的表资产
            </div>
          ) : (
            filteredTables.map((t) => (
              <div
                key={t.name}
                onClick={() => handleNavigateToData(t.name)}
                className="flex items-center justify-between rounded-md border border-monokai-border bg-monokai-elevated/40 p-2 hover:border-monokai-cyan hover:bg-monokai-hover/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <TableIcon className="h-3.5 w-3.5 text-monokai-cyan shrink-0" />
                  <span className="text-xs font-bold text-monokai-fg truncate">{t.name}</span>
                  <span className="rounded bg-monokai-surface px-1.5 py-0.2 font-mono text-2xs text-monokai-fg-muted border border-monokai-border">
                    {t.type || 'table'}
                  </span>
                  {t.hasPrimaryKey && (
                    <span className="rounded bg-monokai-yellow/15 border border-monokai-yellow/30 px-1 py-0.2 text-2xs font-mono text-monokai-yellow">
                      PK
                    </span>
                  )}
                  {t.columnCount > 0 && (
                    <span className="text-meta text-monokai-comment font-mono">
                      {t.columnCount} 列
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="font-mono text-xs text-monokai-accent">{t.formattedRowCount} 行</span>
                  <span className="font-mono text-xs text-monokai-comment">{t.formattedSize}</span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPeekTable?.(t.name);
                    }}
                    className="flex h-5 items-center gap-1 rounded bg-monokai-surface border border-monokai-border px-2 text-meta font-mono text-monokai-fg hover:border-monokai-border-strong cursor-pointer"
                    title="零跳转抽屉快速预览"
                  >
                    <Eye className="h-2.5 w-2.5 text-monokai-cyan" />
                    <span>预览</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickQuery?.(t.name);
                    }}
                    className="flex h-5 items-center gap-1 rounded bg-monokai-cyan/20 border border-monokai-cyan/40 px-2 text-meta font-mono text-monokai-cyan hover:bg-monokai-cyan/30 cursor-pointer"
                    title="在 SQL 编辑器中打开查询"
                  >
                    <Play className="h-2.5 w-2.5 fill-current" />
                    <span>查询</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'profile' ? (
        <div className="mt-2.5 flex-1 w-full overflow-y-auto space-y-3 custom-scrollbar pr-1 min-h-[360px]">
          {filteredTables.length === 0 ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-monokai-comment text-xs font-mono">
              暂无可用表进行画像分析
            </div>
          ) : tableProfileMetrics ? (
            <div className="space-y-3">
              {/* Table Picker & Identity */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-monokai-border bg-monokai-elevated/40 p-2.5">
                <div className="flex items-center gap-2">
                  <TableIcon className="h-4 w-4 text-monokai-cyan" />
                  <span className="text-xs font-mono text-monokai-comment">当前画像表:</span>
                  <select
                    value={tableProfileMetrics.table.name}
                    onChange={(e) => {
                      setSelectedTableName(e.target.value);
                      setCurrentTable(e.target.value);
                    }}
                    className="bg-monokai-surface border border-monokai-border text-monokai-fg rounded px-2 py-0.5 text-xs font-mono font-bold cursor-pointer hover:border-monokai-cyan focus:outline-none"
                  >
                    {filteredTables.map((t) => (
                      <option key={t.name} value={t.name} className="bg-monokai-elevated text-monokai-fg">
                        {t.name} ({t.formattedRowCount} 行)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const sql = `SELECT * FROM "${tableProfileMetrics.table.name}" LIMIT 20;`;
                      onQuickQuery?.(tableProfileMetrics.table.name);
                    }}
                    className="flex items-center gap-1 rounded bg-monokai-accent/15 border border-monokai-accent/40 text-monokai-accent hover:bg-monokai-accent/25 px-2 py-0.5 text-xs font-mono transition-colors cursor-pointer"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    <span>即时 SQL 探查</span>
                  </button>
                </div>
              </div>

              {/* Core Table Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-md border border-monokai-border bg-monokai-bg/60 p-2 text-center">
                  <div className="text-2xs text-monokai-comment font-mono">数据记录数</div>
                  <div className="text-sm font-bold font-mono text-monokai-accent mt-0.5">
                    {tableProfileMetrics.table.formattedRowCount}
                  </div>
                </div>
                <div className="rounded-md border border-monokai-border bg-monokai-bg/60 p-2 text-center">
                  <div className="text-2xs text-monokai-comment font-mono">字段总数</div>
                  <div className="text-sm font-bold font-mono text-monokai-cyan mt-0.5">
                    {tableProfileMetrics.totalCols} 列
                  </div>
                </div>
                <div className="rounded-md border border-monokai-border bg-monokai-bg/60 p-2 text-center">
                  <div className="text-2xs text-monokai-comment font-mono">存储空间</div>
                  <div className="text-sm font-bold font-mono text-monokai-yellow mt-0.5">
                    {tableProfileMetrics.table.formattedSize || '—'}
                  </div>
                </div>
                <div className="rounded-md border border-monokai-border bg-monokai-bg/60 p-2 text-center">
                  <div className="text-2xs text-monokai-comment font-mono">主键完整度</div>
                  <div className={`text-sm font-bold font-mono mt-0.5 ${tableProfileMetrics.table.hasPrimaryKey ? 'text-monokai-accent' : 'text-monokai-pink'}`}>
                    {tableProfileMetrics.table.hasPrimaryKey ? '✓ 已设主键' : '⚠ 缺失主键'}
                  </div>
                </div>
              </div>

              {/* Column Type Breakdown Chart */}
              <div className="rounded-md border border-monokai-border bg-monokai-elevated/30 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-monokai-fg flex items-center gap-1.5">
                    <PieChart className="h-3.5 w-3.5 text-monokai-purple" />
                    <span>字段类型构成分布 (Type Breakdown)</span>
                  </span>
                  <span className="text-monokai-comment">{tableProfileMetrics.totalCols} 个字段</span>
                </div>

                {/* Progress bar */}
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-monokai-bg border border-monokai-border/80">
                  {tableProfileMetrics.numericPct > 0 && (
                    <div
                      style={{ width: `${tableProfileMetrics.numericPct}%` }}
                      className="bg-monokai-accent transition-all"
                      title={`数值型: ${tableProfileMetrics.numericCount} 列 (${tableProfileMetrics.numericPct}%)`}
                    />
                  )}
                  {tableProfileMetrics.textPct > 0 && (
                    <div
                      style={{ width: `${tableProfileMetrics.textPct}%` }}
                      className="bg-monokai-cyan transition-all"
                      title={`文本型: ${tableProfileMetrics.textCount} 列 (${tableProfileMetrics.textPct}%)`}
                    />
                  )}
                  {tableProfileMetrics.timePct > 0 && (
                    <div
                      style={{ width: `${tableProfileMetrics.timePct}%` }}
                      className="bg-monokai-yellow transition-all"
                      title={`时间型: ${tableProfileMetrics.timeCount} 列 (${tableProfileMetrics.timePct}%)`}
                    />
                  )}
                  {tableProfileMetrics.boolPct > 0 && (
                    <div
                      style={{ width: `${tableProfileMetrics.boolPct}%` }}
                      className="bg-monokai-purple transition-all"
                      title={`布尔型: ${tableProfileMetrics.boolCount} 列 (${tableProfileMetrics.boolPct}%)`}
                    />
                  )}
                  {tableProfileMetrics.otherPct > 0 && (
                    <div
                      style={{ width: `${tableProfileMetrics.otherPct}%` }}
                      className="bg-monokai-comment transition-all"
                      title={`复杂/其他: ${tableProfileMetrics.otherCount} 列 (${tableProfileMetrics.otherPct}%)`}
                    />
                  )}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-3 pt-1 text-meta font-mono">
                  <span className="flex items-center gap-1 text-monokai-fg">
                    <span className="h-2 w-2 rounded-full bg-monokai-accent" />
                    <span>数值型 {tableProfileMetrics.numericCount} ({tableProfileMetrics.numericPct}%)</span>
                  </span>
                  <span className="flex items-center gap-1 text-monokai-fg">
                    <span className="h-2 w-2 rounded-full bg-monokai-cyan" />
                    <span>文本型 {tableProfileMetrics.textCount} ({tableProfileMetrics.textPct}%)</span>
                  </span>
                  <span className="flex items-center gap-1 text-monokai-fg">
                    <span className="h-2 w-2 rounded-full bg-monokai-yellow" />
                    <span>时间型 {tableProfileMetrics.timeCount} ({tableProfileMetrics.timePct}%)</span>
                  </span>
                  <span className="flex items-center gap-1 text-monokai-fg">
                    <span className="h-2 w-2 rounded-full bg-monokai-purple" />
                    <span>布尔型 {tableProfileMetrics.boolCount} ({tableProfileMetrics.boolPct}%)</span>
                  </span>
                </div>
              </div>

              {/* Columns Table */}
              <div className="rounded-md border border-monokai-border bg-monokai-elevated/20 overflow-hidden">
                <div className="px-3 py-2 bg-monokai-elevated/60 border-b border-monokai-border flex items-center justify-between text-xs font-mono font-bold text-monokai-fg">
                  <span>字段名称 (Column Name)</span>
                  <span>DuckDB 类型 (Type)</span>
                </div>
                <div className="max-h-48 overflow-y-auto custom-scrollbar divide-y divide-monokai-border/40 text-xs font-mono">
                  {tableProfileMetrics.table.columns && tableProfileMetrics.table.columns.length > 0 ? (
                    tableProfileMetrics.table.columns.map((c, i) => (
                      <div key={c.name || i} className="flex items-center justify-between px-3 py-1.5 hover:bg-monokai-hover/50 transition-colors">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {c.isPrimaryKey && <Key className="h-3 w-3 text-monokai-yellow shrink-0" />}
                          <span className="text-monokai-fg truncate">{c.name}</span>
                          {!c.nullable && <span className="text-2xs text-monokai-pink font-semibold">NOT NULL</span>}
                        </div>
                        <span className="text-monokai-cyan font-bold">{c.type || 'UNKNOWN'}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-monokai-comment text-xs">
                      可点击上方“即时 SQL 探查”运行 DESCRIBE 获取完整字段元数据
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : activeTab === 'sample' ? (
        <div className="mt-2.5 flex-1 w-full overflow-hidden flex flex-col min-h-[360px]">
          {/* Sample Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 shrink-0 border-b border-monokai-border">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-monokai-comment">抽样目标表:</span>
              <select
                value={activeTargetTable}
                onChange={(e) => {
                  setSelectedTableName(e.target.value);
                  setCurrentTable(e.target.value);
                }}
                className="bg-monokai-surface border border-monokai-border text-monokai-cyan rounded px-2 py-0.5 text-xs font-mono font-bold cursor-pointer hover:border-monokai-cyan focus:outline-none"
              >
                {filteredTables.map((t) => (
                  <option key={t.name} value={t.name} className="bg-monokai-elevated text-monokai-fg">
                    {t.name} ({t.formattedRowCount} 行)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSampleReloadKey((k) => k + 1)}
                className="flex items-center gap-1 rounded bg-monokai-elevated border border-monokai-border px-2 py-0.5 text-xs font-mono text-monokai-fg hover:border-monokai-cyan transition-colors cursor-pointer"
                title="重新抽样"
              >
                <RefreshCw className={`h-3 w-3 ${sampleLoading ? 'animate-spin text-monokai-cyan' : ''}`} />
                <span>刷新样本</span>
              </button>
              <button
                type="button"
                onClick={() => onQuickQuery?.(activeTargetTable)}
                className="flex items-center gap-1 rounded bg-monokai-cyan/15 border border-monokai-cyan/40 text-monokai-cyan hover:bg-monokai-cyan/25 px-2 py-0.5 text-xs font-mono transition-colors cursor-pointer"
                title="在 SQL 编辑器中运行完整分析"
              >
                <ExternalLink className="h-3 w-3" />
                <span>在 SQL 编辑器中探查</span>
              </button>
            </div>
          </div>

          {/* Sample Data Grid */}
          <div className="flex-1 w-full overflow-auto custom-scrollbar mt-2 border border-monokai-border rounded-lg bg-monokai-bg/60">
            {sampleLoading ? (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center space-y-2 text-monokai-comment">
                <Loader2 className="h-5 w-5 animate-spin text-monokai-cyan" />
                <span className="text-xs font-mono">正在从 DuckDB 向量引擎读取前 10 行样本...</span>
              </div>
            ) : sampleError ? (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center p-4 text-center">
                <ShieldAlert className="h-6 w-6 text-monokai-pink mb-1" />
                <div className="text-xs font-mono text-monokai-pink font-bold">{sampleError}</div>
                <button
                  type="button"
                  onClick={() => setSampleReloadKey((k) => k + 1)}
                  className="mt-2 text-xs font-mono text-monokai-cyan underline cursor-pointer"
                >
                  重试抽样
                </button>
              </div>
            ) : sampleRows.length === 0 ? (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-monokai-comment text-xs font-mono">
                当前表无记录，可尝试导入数据或运行生成查询
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-monokai-elevated/80 border-b border-monokai-border sticky top-0 z-10">
                    <th className="py-1.5 px-2 text-2xs text-monokai-comment w-10 text-center font-bold">#</th>
                    {sampleCols.map((col) => (
                      <th key={col} className="py-1.5 px-3 text-monokai-fg font-bold whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-monokai-border/40">
                  {sampleRows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-monokai-hover/60 transition-colors">
                      <td className="py-1 px-2 text-center text-2xs text-monokai-comment">{rowIdx + 1}</td>
                      {sampleCols.map((col) => {
                        const val = row[col];
                        return (
                          <td key={col} className="py-1 px-3 whitespace-nowrap text-monokai-fg-muted">
                            {val === null || val === undefined ? (
                              <span className="text-monokai-comment italic">null</span>
                            ) : typeof val === 'object' ? (
                              JSON.stringify(val)
                            ) : (
                              String(val)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : activeTab === 'quality' ? (
        <div className="mt-2.5 flex-1 w-full overflow-y-auto space-y-3 custom-scrollbar pr-1 min-h-[360px]">
          {/* Quality Health Score Banner */}
          <div className="flex items-center justify-between rounded-md border border-monokai-border bg-monokai-elevated/40 p-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-monokai-accent/40 bg-monokai-accent/15 text-monokai-accent">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <div className="text-xs sm:text-sm font-bold text-monokai-fg flex items-center gap-1.5">
                  <span>数据质量健康度评分</span>
                  <span className="rounded bg-monokai-accent/20 border border-monokai-accent/40 px-1.5 py-0.2 text-xs font-mono text-monokai-accent font-bold">
                    {qualityAudit.score} / 100
                  </span>
                </div>
                <div className="text-xs text-monokai-comment font-mono mt-0.5">
                  已体检 {qualityAudit.tableCount} 张物理表 · {qualityAudit.viewCount} 个视图
                </div>
              </div>
            </div>

            <div className="text-right text-xs font-mono">
              <span className="text-monokai-fg-muted font-medium">主键覆盖率: </span>
              <span className="font-bold text-monokai-accent">
                {qualityAudit.tableCount > 0
                  ? `${Math.round(((qualityAudit.tableCount - qualityAudit.missingPk.length) / qualityAudit.tableCount) * 100)}%`
                  : '100%'}
              </span>
            </div>
          </div>

          {/* Quality Risk Cards */}
          <div className="space-y-2">
            <div className="text-xs font-mono font-bold text-monokai-fg flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-monokai-pink" />
              <span>待关注的质量风险项 ({qualityAudit.missingPk.length + qualityAudit.emptyTables.length})</span>
            </div>

            {qualityAudit.missingPk.length === 0 && qualityAudit.emptyTables.length === 0 ? (
              <div className="rounded-lg border border-monokai-accent/30 bg-monokai-accent/5 p-4 text-center">
                <ShieldCheck className="h-8 w-8 text-monokai-accent mx-auto mb-1.5" />
                <div className="text-xs font-bold text-monokai-fg font-sans">全库数据资产质量健康</div>
                <div className="text-meta text-monokai-comment font-mono mt-0.5">
                  所有物理表均已设置主键约束，未发现孤立零行空表
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {qualityAudit.missingPk.map((t) => (
                  <div key={t.name} className="flex items-center justify-between rounded-md border border-monokai-border bg-monokai-surface p-2.5 text-xs font-mono">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="rounded bg-monokai-pink/15 border border-monokai-pink/30 px-1.5 py-0.5 text-2xs text-monokai-pink font-bold">
                        无主键
                      </span>
                      <span className="font-bold text-monokai-fg truncate">{t.name}</span>
                      <span className="text-monokai-comment text-meta">({t.formattedRowCount} 行)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectTableStructure?.(t.name, 'ddl')}
                      className="text-xs font-mono text-monokai-cyan hover:underline cursor-pointer"
                    >
                      补全 DDL 主键 →
                    </button>
                  </div>
                ))}

                {qualityAudit.emptyTables.map((t) => (
                  <div key={t.name} className="flex items-center justify-between rounded-md border border-monokai-border bg-monokai-surface p-2.5 text-xs font-mono">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="rounded bg-monokai-yellow/15 border border-monokai-yellow/30 px-1.5 py-0.5 text-2xs text-monokai-yellow font-bold">
                        空表 (0行)
                      </span>
                      <span className="font-bold text-monokai-fg truncate">{t.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenImport}
                      className="text-xs font-mono text-monokai-accent hover:underline cursor-pointer"
                    >
                      导入数据 →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-2.5 flex-1 w-full overflow-y-auto space-y-2.5 custom-scrollbar pr-1 min-h-[360px]">
          {/* Asset list — primary home surface */}
          <div className="rounded-md border border-monokai-border bg-monokai-elevated/40 overflow-hidden">
            <div className="flex items-center justify-between border-b border-monokai-border px-3 py-2">
              <span className="text-xs font-semibold text-monokai-fg font-sans">表与视图</span>
              <span className={DB.metaMono}>{filteredTables.length} 项</span>
            </div>
            {filteredTables.length === 0 ? (
              <div className="p-4 text-center space-y-2">
                <p className="text-xs font-semibold text-monokai-fg">当前数据库暂无数据表或视图</p>
                <p className="text-2xs text-monokai-comment font-mono">
                  导入 CSV / Parquet，或新建空表开始
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onOpenImport}
                    className="inline-flex items-center gap-1 rounded bg-monokai-cyan/15 border border-monokai-cyan/30 px-2.5 py-1 text-xs font-mono text-monokai-cyan hover:bg-monokai-cyan/25 transition-colors cursor-pointer"
                  >
                    <Upload className="h-3 w-3" />
                    <span>导入文件</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenCreate}
                    className="inline-flex items-center gap-1 rounded border border-monokai-border bg-monokai-surface px-2.5 py-1 text-xs font-mono text-monokai-fg hover:border-monokai-border-strong transition-colors cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>新建表</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-monokai-border max-h-[220px] overflow-y-auto custom-scrollbar">
                {filteredTables.map((t) => (
                  <div
                    key={t.name}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-monokai-hover/50 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => handleNavigateToData(t.name)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                    >
                      <TableIcon className={`h-3.5 w-3.5 shrink-0 ${t.type === 'view' ? 'text-monokai-purple' : 'text-monokai-cyan'}`} />
                      <span className="truncate text-xs font-medium text-monokai-fg font-mono">{t.name}</span>
                      <span className="shrink-0 rounded border border-monokai-border bg-monokai-surface px-1 py-0.5 text-2xs font-mono text-monokai-comment">
                        {t.type || 'table'}
                      </span>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-2xs text-monokai-accent">{t.formattedRowCount}</span>
                      <button
                        type="button"
                        onClick={() => onPeekTable?.(t.name)}
                        className="rounded border border-monokai-border bg-monokai-surface px-1.5 py-0.5 text-2xs font-mono text-monokai-comment hover:text-monokai-fg hover:border-monokai-border-strong cursor-pointer"
                        title={`预览 ${t.name}`}
                      >
                        <Eye className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onQuickQuery?.(t.name)}
                        className="rounded border border-monokai-border bg-monokai-surface px-1.5 py-0.5 text-2xs font-mono text-monokai-comment hover:text-monokai-accent hover:border-monokai-accent/40 cursor-pointer"
                        title={`查询 ${t.name}`}
                      >
                        <Play className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Engine Storage Stats */}
          <div className="rounded-md border border-monokai-border bg-monokai-elevated/40 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-monokai-fg-muted font-medium">当前活跃数据库</span>
              <span className="font-mono text-monokai-fg font-bold">{metrics?.databaseName || 'duckdb_managed'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-monokai-fg-muted font-medium">存储模式</span>
              <span className="font-mono text-monokai-accent font-bold">
                {metrics?.isPersistent ? 'OPFS 本地持久化' : '内存临时沙盒'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-monokai-fg-muted font-medium">实体分布</span>
              <span className="font-mono text-monokai-cyan font-bold">
                {tables.filter((t) => t.type !== 'view').length} 表 · {tables.filter((t) => t.type === 'view').length} 视图
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-monokai-fg-muted font-medium">占用空间</span>
              <span className="font-mono text-monokai-yellow font-bold">{metrics?.dataSize || '0 B'}</span>
            </div>
          </div>

          {/* Recent Ingestions or Ingestion Hub */}
          <div className="rounded-md border border-monokai-border bg-monokai-elevated/40 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-monokai-fg flex items-center gap-1.5 font-sans">
                <Clock className="h-3.5 w-3.5 text-monokai-cyan" />
                <span>近期数据导入与挂载记录</span>
              </span>
              <button
                type="button"
                onClick={onOpenImport}
                className="text-xs font-mono text-monokai-cyan hover:underline cursor-pointer"
              >
                + 导入新数据集
              </button>
            </div>

            {recentImports && recentImports.length > 0 ? (
              <div className="space-y-1">
                {recentImports.slice(0, 4).map((imp) => (
                  <div
                    key={imp.id || imp.name}
                    className="flex items-center justify-between rounded bg-monokai-surface px-2 py-1 text-xs font-mono text-monokai-fg border border-monokai-border"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileSpreadsheet className="h-3 w-3 text-monokai-accent shrink-0" />
                      <span className="truncate text-monokai-fg font-medium">{imp.name}</span>
                      <span className="text-monokai-comment">→</span>
                      <span className="text-monokai-cyan">{imp.tableName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-monokai-accent">{imp.rowCount?.toLocaleString()} 行</span>
                      <span className="text-monokai-comment">{imp.size}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded border border-dashed border-monokai-border bg-monokai-bg/40 p-3 text-center space-y-2">
                <p className="text-xs text-monokai-fg-muted font-sans">
                  原生支持加载与即时查询 Parquet、CSV、Excel、Arrow、SQLite 等格式文件
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenImport}
                    className="inline-flex items-center gap-1 rounded bg-monokai-cyan/15 border border-monokai-cyan/30 px-2.5 py-1 text-xs font-mono text-monokai-cyan hover:bg-monokai-cyan/25 transition-colors cursor-pointer"
                  >
                    <Upload className="h-3 w-3" />
                    <span>上传或拖入本地文件</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenCreate}
                    className="inline-flex items-center gap-1 rounded bg-monokai-elevated border border-monokai-border px-2.5 py-1 text-xs font-mono text-monokai-fg hover:border-monokai-border-strong transition-colors cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>新建空数据表</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
