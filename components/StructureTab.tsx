import React, { useState, useMemo, useEffect } from 'react';
import { ColumnInfo, ColumnStats } from '../types';
import { getTypeIcon } from '../utils';
import {
  Layout,
  Ruler,
  MousePointerClick,
  Key,
  X,
  Network,
  Copy,
  Trash2,
  ListTree,
  Plus,
  BarChart3,
  Code2,
  Check,
  Edit2,
  Database,
  ArrowRight,
  Sparkles,
  LayoutDashboard,
  ZoomIn,
  ZoomOut,
  AlertCircle,
} from 'lucide-react';
import {
  PageShell,
  PageHeader,
  SegmentedTabs,
  SegmentedTab,
  SearchInput,
  ActionButton,
  EmptyState,
  FormInput,
  FormSelect,
  IconButton,
  Badge,
  InlineAlert,
  NavJumpChip,
} from './ui/Workbench';
import { CodeHighlightBlock } from './ui/CodeHighlightBlock';
import { EMPTY_STATE_MESSAGES } from '../designSystem';

export type AddColumnOverrides = { name?: string; type?: string };

export interface StructureTabProps {
  tables: string[];
  currentTable: string | null;
  schema: ColumnInfo[];
  fullSchemaTree: Record<string, ColumnInfo[]>;
  structureViewMode: 'list' | 'graph';
  editColumnMode: { colName: string; newName: string; newType: string } | null;
  newColName: string;
  newColType: string;
  selectedColStats: { col: string; stats: ColumnStats } | null;
  isRenaming: boolean;
  renameTableName: string;

  onSetStructureViewMode: (v: 'list' | 'graph') => void;
  onSetEditColumnMode: (v: { colName: string; newName: string; newType: string } | null) => void;
  onSetNewColName: (v: string) => void;
  onSetNewColType: (v: string) => void;
  onSetSelectedColStats: (v: { col: string; stats: ColumnStats } | null) => void;
  onSetIsRenaming: (v: boolean) => void;
  onSetRenameTableName: (v: string) => void;
  onHandleRenameTable: () => void;
  onHandleAddColumn: (overrides?: AddColumnOverrides) => void;
  onHandleDropColumn: (colName: string) => void;
  onHandleSaveColumnEdit: () => void;
  onShowColumnStats: (col: string) => void;
  onHandleCopySchema: () => void;
  onHandleDuplicateTable: () => void;
  onHandleDropTable: () => void;
  onAddNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  onSelectTable?: (tableName: string) => void;
  onLoadDemo?: () => void;
  onShowCreateModal?: () => void;
  onShowImportModal?: () => void;
  onNavigateToDashboard?: () => void;
  initialInspectorTab?: RightInspectorTab;
  onNavigateToData?: (tableName: string) => void;
  onNavigateToAnalysis?: (tableName: string) => void;
  onNavigateToMetrics?: (tableName: string) => void;
  onNavigateToSql?: (sql: string) => void;
}

export type RightInspectorTab = 'profile' | 'add' | 'ddl';

const STRUCTURE_VIEWS: readonly SegmentedTab<'list' | 'graph'>[] = [
  { value: 'list', label: '列表视图', icon: Layout },
  { value: 'graph', label: 'ER 关系图谱', icon: Network },
];

const INSPECTOR_TABS: readonly SegmentedTab<RightInspectorTab>[] = [
  { value: 'profile', label: '字段画像', icon: BarChart3 },
  { value: 'add', label: '添加字段', icon: Plus },
  { value: 'ddl', label: 'DDL 脚本', icon: Code2 },
];

export const DUCKDB_DATA_TYPES = [
  'VARCHAR',
  'INTEGER',
  'BIGINT',
  'BOOLEAN',
  'FLOAT',
  'DOUBLE',
  'DECIMAL(18,2)',
  'DECIMAL(18,4)',
  'DATE',
  'TIMESTAMP',
  'JSON',
  'BLOB',
  'UUID',
] as const;

/**
 * Returns unified Monokai Pro semantic badge styling based on DuckDB data type.
 */
export const getTypeBadgeStyle = (type: string): string => {
  const t = (type || '').toUpperCase();
  if (/INT|FLOAT|DOUBLE|DECIMAL|NUMERIC|REAL|HUGEINT|SMALLINT|TINYINT/.test(t)) {
    return 'text-monokai-cyan bg-monokai-surface border-monokai-border';
  }
  if (/CHAR|TEXT|STRING|VARCHAR/.test(t)) {
    return 'text-monokai-green bg-monokai-surface border-monokai-border';
  }
  if (/DATE|TIME|TIMESTAMP|INTERVAL/.test(t)) {
    return 'text-monokai-yellow bg-monokai-surface border-monokai-border';
  }
  if (/BOOL/.test(t)) {
    return 'text-monokai-amethyst bg-monokai-surface border-monokai-border';
  }
  if (/JSON|STRUCT|MAP|BLOB|UNION|LIST|ARRAY/.test(t)) {
    return 'text-monokai-orange bg-monokai-surface border-monokai-border';
  }
  return 'text-monokai-comment bg-monokai-surface/60 border-monokai-border';
};

/**
 * Modernized ER Relationship Graph Canvas with zoom controls & bidirectional navigation
 */
export const SchemaGraph: React.FC<{
  fullSchemaTree: Record<string, ColumnInfo[]>;
  currentTable: string | null;
  onSelectTable?: (tableName: string) => void;
  onViewTableDetails?: (tableName: string) => void;
}> = ({ fullSchemaTree, currentTable, onSelectTable, onViewTableDetails }) => {
  const NODE_WIDTH = 250;
  const NODE_HEIGHT_BASE = 42;
  const MARGIN_X = 60;
  const MARGIN_Y = 60;
  const cols = 3;

  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [zoomScale, setZoomScale] = useState(1);

  const tableNames = useMemo(() => {
    const all = Object.keys(fullSchemaTree);
    if (!filterQuery.trim()) return all;
    const q = filterQuery.toLowerCase();
    return all.filter(
      name =>
        name.toLowerCase().includes(q) ||
        fullSchemaTree[name]?.some(c => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q)),
    );
  }, [fullSchemaTree, filterQuery]);

  if (Object.keys(fullSchemaTree).length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-monokai-bg font-sans">
        <EmptyState
          icon={Network}
          title="暂无关联数据表"
          description="在系统导入或创建数据表后，拓扑检测引擎将自动解析主外键关联并在此绘制拓扑关系图谱"
        />
      </div>
    );
  }

  const nodes: { name: string; x: number; y: number; columns: ColumnInfo[] }[] = [];
  const edges: { source: typeof nodes[0]; target: typeof nodes[0]; col: string; id: string }[] = [];

  tableNames.forEach((t, i) => {
    const colIdx = i % cols;
    const rowIdx = Math.floor(i / cols);
    const x = MARGIN_X + colIdx * (NODE_WIDTH + 140);
    const y = MARGIN_Y + rowIdx * 340;
    nodes.push({ name: t, x, y, columns: fullSchemaTree[t] || [] });
  });

  // Intelligent FK Heuristic Detection
  nodes.forEach(source => {
    source.columns.forEach(col => {
      const lowerCol = col.name.toLowerCase();
      let targetBase = '';
      if (lowerCol.endsWith('_id')) {
        targetBase = lowerCol.replace(/_id$/, '');
      } else if (lowerCol.endsWith('id') && lowerCol.length > 2) {
        targetBase = lowerCol.replace(/id$/, '');
      }

      if (targetBase) {
        const targetNode = nodes.find(n => {
          const nLower = n.name.toLowerCase();
          return (
            nLower === targetBase ||
            nLower === `${targetBase}s` ||
            nLower === `${targetBase}es` ||
            (targetBase.endsWith('y') && nLower === `${targetBase.slice(0, -1)}ies`)
          );
        });

        if (targetNode && targetNode.name !== source.name) {
          edges.push({
            source,
            target: targetNode,
            col: col.name,
            id: `${source.name}.${col.name}->${targetNode.name}`,
          });
        }
      }
    });
  });

  const totalHeight = Math.max(800, (Math.ceil(Math.max(nodes.length, 1) / cols) + 1) * 360);

  const handleZoomIn = () => setZoomScale(s => Math.min(1.8, Number((s + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoomScale(s => Math.max(0.6, Number((s - 0.15).toFixed(2))));
  const handleResetZoom = () => setZoomScale(1);

  return (
    <div className="h-full flex flex-col bg-monokai-bg font-sans overflow-hidden relative select-none">
      {/* Graph Floating Command Bar */}
      <div className="absolute top-4 left-6 z-20 flex flex-wrap items-center gap-2.5 bg-monokai-sidebar/95 backdrop-blur-sm border border-monokai-border p-2 rounded-lg shadow-lg">
        <SearchInput
          value={filterQuery}
          onChange={setFilterQuery}
          onClear={() => setFilterQuery('')}
          placeholder="在图谱中搜索表名或字段..."
          size="sm"
          className="w-56"
        />

        <div className="h-4 w-px bg-monokai-border mx-0.5" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-0.5">
          <IconButton label="缩小画布" icon={ZoomOut} size="sm" onClick={handleZoomOut} />
          <button
            type="button"
            onClick={handleResetZoom}
            title="恢复 100% 缩放"
            className="px-1.5 py-0.5 rounded-md text-[11px] font-mono text-monokai-fg bg-monokai-surface border border-monokai-border hover:border-monokai-accent/60 transition-colors cursor-pointer"
          >
            {Math.round(zoomScale * 100)}%
          </button>
          <IconButton label="放大画布" icon={ZoomIn} size="sm" onClick={handleZoomIn} />
        </div>

        <div className="h-4 w-px bg-monokai-border mx-0.5" />

        <span className="text-[10px] font-mono text-monokai-comment px-2 py-1 rounded-md bg-monokai-surface border border-monokai-border">
          {nodes.length} 张表 · {edges.length} 条关联拓扑
        </span>

        {/* Mini Legend */}
        <div className="hidden sm:flex items-center gap-2 pl-1 text-[10px] font-mono text-monokai-comment">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-monokai-pink" /> PK 主键
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-monokai-cyan" /> FK 关联
          </span>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <EmptyState
            icon={Network}
            title="无匹配的表或字段"
            description={`未找到包含「${filterQuery}」的表名或字段，请调整搜索关键词。`}
            action={
              <ActionButton variant="secondary" size="sm" onClick={() => setFilterQuery('')}>
                清空筛选
              </ActionButton>
            }
          />
        </div>
      ) : (
      /* Main Interactive Scalable Canvas Area */
      <div className="flex-1 overflow-auto p-10 relative bg-[radial-gradient(var(--monokai-border)_1px,transparent_1px)] [background-size:24px_24px] custom-scrollbar">
        <div
          style={{
            transform: `scale(${zoomScale})`,
            transformOrigin: 'top left',
            transition: 'transform 0.15s ease-out',
            minWidth: '1280px',
            minHeight: `${totalHeight}px`,
            position: 'relative',
          }}
        >
          {/* SVG Vector Edges Layer */}
          <svg
            width="100%"
            height={totalHeight}
            className="absolute top-0 left-0 pointer-events-none min-w-[1280px]"
          >
            <defs>
              <marker
                id="graph-arrowhead"
                markerWidth="12"
                markerHeight="8"
                refX="10"
                refY="4"
                orient="auto"
              >
                <polygon points="0 0, 10 4, 0 8" fill="var(--monokai-cyan)" />
              </marker>
              <marker
                id="graph-arrowhead-hover"
                markerWidth="12"
                markerHeight="8"
                refX="10"
                refY="4"
                orient="auto"
              >
                <polygon points="0 0, 10 4, 0 8" fill="var(--monokai-accent)" />
              </marker>
            </defs>

            {edges.map(e => {
              const sx = e.source.x + NODE_WIDTH;
              const sy = e.source.y + NODE_HEIGHT_BASE + 18;
              const tx = e.target.x;
              const ty = e.target.y + NODE_HEIGHT_BASE + 18;
              const isHovered = hoveredEdge === e.id;
              const d = `M ${sx} ${sy} C ${sx + 60} ${sy}, ${tx - 60} ${ty}, ${tx} ${ty}`;
              const midX = (sx + tx) / 2;
              const midY = (sy + ty) / 2;

              return (
                <g
                  key={e.id}
                  className="transition-all duration-200"
                  onMouseEnter={() => setHoveredEdge(e.id)}
                  onMouseLeave={() => setHoveredEdge(null)}
                >
                  {/* Wider hit test area for easy hover */}
                  <path
                    d={d}
                    stroke="transparent"
                    strokeWidth="16"
                    fill="none"
                    className="pointer-events-auto cursor-pointer"
                  />
                  {/* Rendered bezier relation curve */}
                  <path
                    d={d}
                    stroke={isHovered ? 'var(--monokai-accent)' : 'var(--monokai-cyan)'}
                    strokeWidth={isHovered ? 2 : 1.5}
                    strokeDasharray={isHovered ? 'none' : '4 2'}
                    fill="none"
                    markerEnd={isHovered ? 'url(#graph-arrowhead-hover)' : 'url(#graph-arrowhead)'}
                    opacity={isHovered ? 1 : 0.65}
                  />
                  {/* Foreign Key Column Edge Badge */}
                  <g transform={`translate(${midX}, ${midY})`} className="pointer-events-none">
                    <rect
                      x="-38"
                      y="-10"
                      width="76"
                      height="20"
                      rx="4"
                      fill="var(--monokai-sidebar)"
                      stroke={isHovered ? 'var(--monokai-accent)' : 'var(--monokai-cyan)'}
                      strokeWidth="1"
                      opacity="0.95"
                    />
                    <text
                      x="0"
                      y="3.5"
                      fill={isHovered ? 'var(--monokai-accent)' : 'var(--monokai-cyan)'}
                      fontSize="9"
                      fontWeight="600"
                      textAnchor="middle"
                      fontFamily="var(--font-mono)"
                    >
                      {e.col}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          {/* Table Entity Cards */}
          {nodes.map(node => {
            const isSelected = currentTable === node.name;
            const pkCol = node.columns.find(c => c.pk);

            return (
              <div
                key={node.name}
                onClick={() => onSelectTable && onSelectTable(node.name)}
                onDoubleClick={() => {
                  if (onViewTableDetails) onViewTableDetails(node.name);
                }}
                className={`absolute rounded-lg border bg-monokai-sidebar shadow-md transition-all duration-150 flex flex-col w-[250px] cursor-pointer group ${
                  isSelected
                    ? 'border-monokai-accent ring-1 ring-monokai-accent/30 shadow-monokai-accent/10'
                    : 'border-monokai-border hover:border-monokai-border-strong hover:shadow-lg'
                }`}
                style={{ left: node.x, top: node.y }}
              >
                {/* Card Header */}
                <div className="bg-monokai-surface px-3 py-2 border-b border-monokai-border flex items-center justify-between rounded-t-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <Database className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-monokai-accent' : 'text-monokai-comment'}`} />
                    <span className="font-mono font-semibold text-xs text-monokai-fg truncate">
                      {node.name}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-monokai-bg border border-monokai-border text-monokai-comment shrink-0">
                    {node.columns.length} 列
                  </span>
                </div>

                {/* Columns List Preview */}
                <div className="p-2 space-y-1 max-h-56 overflow-y-auto custom-scrollbar">
                  {node.columns.map(c => {
                    const isPk = Boolean(c.pk);
                    return (
                      <div
                        key={c.name}
                        className={`flex items-center justify-between text-xs font-mono py-1 px-1.5 rounded transition-colors ${
                          isPk ? 'bg-monokai-surface text-monokai-pink font-semibold' : 'text-monokai-fg hover:bg-monokai-surface'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isPk ? (
                            <Key className="w-3 h-3 text-monokai-pink shrink-0" />
                          ) : (
                            <span className="text-[10px] text-monokai-comment">{getTypeIcon(c.type)}</span>
                          )}
                          <span className="truncate">{c.name}</span>
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-normal shrink-0 ${getTypeBadgeStyle(c.type)}`}>
                          {c.type}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Card Footer with Quick Jump Action */}
                <div className="px-3 py-1.5 bg-monokai-bg border-t border-monokai-border text-[10px] font-mono text-monokai-comment rounded-b-lg flex items-center justify-between">
                  <span>{pkCol ? `主键: ${pkCol.name}` : '无主键'}</span>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      if (onViewTableDetails) onViewTableDetails(node.name);
                      else if (onSelectTable) onSelectTable(node.name);
                    }}
                    className="text-monokai-comment hover:text-monokai-accent flex items-center gap-1 text-[10px] opacity-80 group-hover:opacity-100 transition-all cursor-pointer"
                    title="切换到列表视图深度查看此表"
                  >
                    <span>详情</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
};

export const StructureTab: React.FC<StructureTabProps> = ({
  tables,
  currentTable,
  schema,
  fullSchemaTree,
  structureViewMode,
  editColumnMode,
  newColName,
  newColType,
  selectedColStats,
  isRenaming,
  renameTableName,
  onSetStructureViewMode,
  onSetEditColumnMode,
  onSetNewColName,
  onSetNewColType,
  onSetSelectedColStats,
  onSetIsRenaming,
  onSetRenameTableName,
  onHandleRenameTable,
  onHandleAddColumn,
  onHandleDropColumn,
  onHandleSaveColumnEdit,
  onShowColumnStats,
  onHandleCopySchema,
  onHandleDuplicateTable,
  onHandleDropTable,
  onAddNotification,
  onSelectTable,
  onLoadDemo,
  onShowCreateModal,
  onShowImportModal,
  onNavigateToDashboard,
  initialInspectorTab,
  onNavigateToData,
  onNavigateToAnalysis,
  onNavigateToMetrics,
  onNavigateToSql,
}) => {
  const [colFilter, setColFilter] = useState('');
  const [inspectorTab, setInspectorTab] = useState<RightInspectorTab>(initialInspectorTab || 'profile');
  const [copiedColName, setCopiedColName] = useState<string | null>(null);
  const [copiedTableName, setCopiedTableName] = useState(false);
  const [copiedDdl, setCopiedDdl] = useState(false);

  // Add Column Form extra states for constraints
  const [addColNotNull, setAddColNotNull] = useState(false);
  const [addColDefault, setAddColDefault] = useState('');

  // Sync with initialInspectorTab from external navigation
  useEffect(() => {
    if (initialInspectorTab) {
      setInspectorTab(initialInspectorTab);
    }
  }, [initialInspectorTab]);

  // Switch to profiler tab when new column stats arrive
  useEffect(() => {
    if (selectedColStats) {
      setInspectorTab('profile');
    }
  }, [selectedColStats]);

  const filteredSchema = useMemo(() => {
    if (!colFilter.trim()) return schema;
    const lower = colFilter.toLowerCase();
    return schema.filter(
      c => c.name.toLowerCase().includes(lower) || c.type.toLowerCase().includes(lower),
    );
  }, [schema, colFilter]);

  // Enhanced DDL generation including PRIMARY KEY, NOT NULL and DEFAULT values
  const generatedDdl = useMemo(() => {
    if (!currentTable || schema.length === 0) return '';
    return `CREATE TABLE "${currentTable}" (\n  ${schema
      .map(c => {
        const pk = c.pk ? ' PRIMARY KEY' : '';
        const notnull = c.notnull && !c.pk ? ' NOT NULL' : '';
        const dflt = c.dflt_value !== null && c.dflt_value !== undefined ? ` DEFAULT ${c.dflt_value}` : '';
        return `"${c.name}" ${c.type}${pk}${notnull}${dflt}`;
      })
      .join(',\n  ')}\n);`;
  }, [currentTable, schema]);

  const handleCopyDdlWithFeedback = () => {
    if (!generatedDdl) return;
    navigator.clipboard.writeText(generatedDdl);
    setCopiedDdl(true);
    onAddNotification('DDL 语句已成功复制到剪贴板', 'success');
    setTimeout(() => setCopiedDdl(false), 2000);
  };

  const handleCopyColumn = (colName: string) => {
    navigator.clipboard.writeText(colName);
    setCopiedColName(colName);
    onAddNotification(`字段名 "${colName}" 已复制到剪贴板`, 'info');
    setTimeout(() => setCopiedColName(null), 1800);
  };

  const handleCopyTableName = () => {
    if (!currentTable) return;
    navigator.clipboard.writeText(currentTable);
    setCopiedTableName(true);
    onAddNotification(`表名 "${currentTable}" 已复制`, 'info');
    setTimeout(() => setCopiedTableName(false), 1800);
  };

  // Add column validation
  const addColumnValidation = useMemo(() => {
    const trimmed = newColName.trim();
    if (!trimmed) return { valid: false, error: '请输入字段名称' };
    if (schema.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      return { valid: false, error: '该字段名在当前表中已存在' };
    }
    return { valid: true, error: null };
  }, [newColName, schema]);

  // Add column handler with constraint compilation (pass overrides to avoid stale state race)
  const handlePerformAddColumn = () => {
    if (!addColumnValidation.valid) {
      onAddNotification(addColumnValidation.error || '字段定义不合法', 'error');
      return;
    }
    let fullType = newColType;
    if (addColNotNull) fullType += ' NOT NULL';
    if (addColDefault.trim()) fullType += ` DEFAULT ${addColDefault.trim()}`;

    onHandleAddColumn({ name: newColName.trim(), type: fullType });
    setAddColNotNull(false);
    setAddColDefault('');
  };

  // When no tables exist
  if (tables.length === 0) {
    return (
      <PageShell scroll="page" className="h-full items-center justify-center p-6 sm:p-8">
        <EmptyState
          icon={ListTree}
          title="未找到可分析的数据表"
          description="请导入或创建一张数据表以探索 Schema 结构与 ER 拓扑关系，或使用下方快捷动作开始。"
          className="w-full max-w-2xl bg-transparent border-0"
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <ActionButton
                variant="primary"
                size="sm"
                icon={Sparkles}
                onClick={() => {
                  if (onLoadDemo) onLoadDemo();
                  else window.dispatchEvent(new CustomEvent('duckdb-load-demo'));
                }}
              >
                加载示例数据
              </ActionButton>
              {onShowCreateModal && (
                <ActionButton variant="secondary" size="sm" icon={Plus} onClick={onShowCreateModal}>
                  新建数据表
                </ActionButton>
              )}
              <ActionButton
                variant="secondary"
                size="sm"
                icon={Database}
                onClick={() => {
                  if (onShowImportModal) onShowImportModal();
                  else window.dispatchEvent(new CustomEvent('duckdb-open-import'));
                }}
              >
                导入数据文件
              </ActionButton>
              {onNavigateToDashboard && (
                <ActionButton variant="ghost" size="sm" icon={LayoutDashboard} onClick={onNavigateToDashboard}>
                  返回仪表盘
                </ActionButton>
              )}
            </div>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell scroll="none" className="h-full min-h-0 w-full overflow-hidden">
      {/* Standard Unified Page Header */}
      <PageHeader
        title="Schema 架构体系"
        description="数据模型定义 · 字段类型约束 · 关系 ER 图谱 · 在线 DDL 演变"
        icon={Ruler}
        tone="yellow"
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {onNavigateToDashboard && (
              <ActionButton
                variant="ghost"
                size="sm"
                icon={LayoutDashboard}
                onClick={onNavigateToDashboard}
                title="返回首页仪表盘"
              >
                仪表盘
              </ActionButton>
            )}

            {onShowCreateModal && (
              <ActionButton
                variant="secondary"
                size="sm"
                icon={Plus}
                onClick={onShowCreateModal}
                title="新建一张数据表"
              >
                新建表
              </ActionButton>
            )}

            <SegmentedTabs
              aria-label="Schema 视图模式"
              value={structureViewMode}
              items={STRUCTURE_VIEWS}
              tone="yellow"
              size="sm"
              onChange={onSetStructureViewMode}
            />

            {currentTable && structureViewMode === 'list' && (
              <>
                <ActionButton
                  variant="secondary"
                  size="sm"
                  icon={Copy}
                  onClick={onHandleDuplicateTable}
                  title="复制克隆此数据表及其结构"
                >
                  克隆表
                </ActionButton>
                <ActionButton
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={onHandleDropTable}
                  title="删除当前数据表"
                >
                  删除表
                </ActionButton>
              </>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-hidden relative min-h-0">
        {structureViewMode === 'graph' ? (
          <SchemaGraph
            fullSchemaTree={fullSchemaTree}
            currentTable={currentTable}
            onSelectTable={tableName => {
              if (onSelectTable) onSelectTable(tableName);
            }}
            onViewTableDetails={tableName => {
              if (onSelectTable) onSelectTable(tableName);
              onSetStructureViewMode('list');
            }}
          />
        ) : currentTable ? (
          <div className="h-full flex flex-col p-3 sm:p-4 overflow-hidden">
            {/* Top Toolbar: Table Title, Inline Rename, Quick Switcher, Metadata Badges & Jumpers */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3 bg-monokai-sidebar px-3 py-2 rounded-lg border border-monokai-border shadow-xs shrink-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                {/* Table Icon & Active Table Name / Rename */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-monokai-surface text-monokai-fg border border-monokai-border shrink-0">
                    <Database className="w-3.5 h-3.5 text-monokai-cyan" />
                  </div>

                  {isRenaming ? (
                    <div className="flex items-center gap-1.5">
                      <FormInput
                        autoFocus
                        sizeVariant="sm"
                        fontVariant="mono"
                        className="w-44 font-semibold"
                        value={renameTableName}
                        onChange={e => onSetRenameTableName(e.target.value)}
                        onBlur={() => onSetIsRenaming(false)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') onHandleRenameTable();
                          if (e.key === 'Escape') onSetIsRenaming(false);
                        }}
                      />
                      <ActionButton
                        variant="success"
                        size="sm"
                        onMouseDown={e => e.preventDefault()}
                        onClick={onHandleRenameTable}
                      >
                        确认
                      </ActionButton>
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => onSetIsRenaming(false)}
                      >
                        取消
                      </ActionButton>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-xs font-bold text-monokai-fg cursor-pointer hover:text-monokai-yellow transition-colors font-mono tracking-tight flex items-center gap-1.5 group"
                        onClick={() => {
                          onSetRenameTableName(currentTable);
                          onSetIsRenaming(true);
                        }}
                        title="点击重命名当前数据表"
                      >
                        {currentTable}
                        <Edit2 className="w-3 h-3 text-monokai-comment group-hover:text-monokai-yellow opacity-60 transition-opacity" />
                      </span>

                      <IconButton
                        label="复制当前表名"
                        icon={copiedTableName ? Check : Copy}
                        size="sm"
                        tone={copiedTableName ? 'primary' : 'neutral'}
                        onClick={handleCopyTableName}
                        className="!h-7 !w-7"
                      />

                      {tables && tables.length > 1 && onSelectTable && (
                        <FormSelect
                          value={currentTable}
                          onChange={e => onSelectTable(e.target.value)}
                          sizeVariant="sm"
                          className="w-auto max-w-[11rem] font-mono text-monokai-fg-muted"
                          title="快速切换当前数据表"
                        >
                          {tables.map(tbl => (
                            <option key={tbl} value={tbl}>
                              {tbl}
                            </option>
                          ))}
                        </FormSelect>
                      )}
                    </div>
                  )}
                </div>

                {/* Table Metadata Badges */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <Badge tone="neutral" size="sm">
                    {filteredSchema.length} / {schema.length} 字段
                  </Badge>
                  {schema.some(c => c.pk) ? (
                    <Badge tone="pink" size="sm">
                      <Key className="w-2.5 h-2.5" /> 已设主键
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="sm">
                      无主键
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyDdlWithFeedback}
                    className="inline-flex items-center gap-1 rounded-md bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border px-2 py-0.5 text-[10px] font-mono text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
                    title="复制此表的建表 DDL 语句"
                  >
                    {copiedDdl ? <Check size={11} className="text-monokai-accent" /> : <Code2 size={11} />}
                    <span>{copiedDdl ? '已复制 DDL' : '复制 DDL'}</span>
                  </button>
                </div>

                {/* Cross-Module Quick Jump Buttons */}
                <div className="flex items-center gap-1.5 border-l border-monokai-border pl-2.5 flex-wrap">
                  {onNavigateToData && (
                    <NavJumpChip
                      label="数据网格 ↗"
                      title="在数据网格中浏览当前表数据"
                      toneClass="text-monokai-cyan"
                      icon={<Layout size={11} />}
                      onClick={() => onNavigateToData(currentTable)}
                    />
                  )}
                  {onNavigateToAnalysis && (
                    <NavJumpChip
                      label="分析中心 ↗"
                      title="在分析中心探查此表质量与分布"
                      toneClass="text-monokai-green"
                      icon={<BarChart3 size={11} />}
                      onClick={() => onNavigateToAnalysis(currentTable)}
                    />
                  )}
                  {onNavigateToMetrics && (
                    <NavJumpChip
                      label="指标建模 ↗"
                      title="在指标中心为此表声明度量指标"
                      toneClass="text-monokai-amethyst"
                      icon={<Sparkles size={11} />}
                      onClick={() => onNavigateToMetrics(currentTable)}
                    />
                  )}
                  {onNavigateToSql && (
                    <NavJumpChip
                      label="SQL 查询 ↗"
                      title="在 SQL 工作台中查询此表"
                      toneClass="text-monokai-yellow"
                      icon={<Code2 size={11} />}
                      onClick={() => onNavigateToSql(`SELECT * FROM "${currentTable}" LIMIT 100;`)}
                    />
                  )}
                </div>
              </div>

              {/* Right Filter Search Input */}
              <SearchInput
                value={colFilter}
                onChange={setColFilter}
                onClear={() => setColFilter('')}
                placeholder="搜索字段名或数据类型..."
                className="w-52"
                size="sm"
              />
            </div>

            {/* Dual Column Workbench Grid: Left Fields Table + Right Contextual Inspector */}
            <div className="flex-1 flex flex-col lg:flex-row gap-3 overflow-hidden min-h-0">
              {/* Left Column: High-Density Columns Table */}
              <div className="bg-monokai-sidebar border border-monokai-border rounded-lg flex-1 flex flex-col shadow-xs overflow-hidden min-w-0">
                <div className="overflow-auto flex-1 custom-scrollbar">
                  <table className="w-full text-left font-sans border-collapse">
                    <thead className="bg-monokai-surface border-b border-monokai-border text-[10px] uppercase tracking-wider text-monokai-comment sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5 pl-3.5 text-monokai-accent font-mono font-semibold">字段名称 (Column)</th>
                        <th className="p-2.5 text-monokai-orange font-mono font-semibold">数据类型 (Type)</th>
                        <th className="p-2.5 text-monokai-pink font-mono font-semibold">约束与默认值 (Constraints)</th>
                        <th className="p-2.5 pr-3.5 text-monokai-green font-mono text-right font-semibold">操作 (Actions)</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs bg-monokai-bg/60 divide-y divide-monokai-border/40">
                      {filteredSchema.map(col => {
                        const isEditing = editColumnMode?.colName === col.name;
                        const isSelectedForStats = selectedColStats?.col === col.name;

                        return (
                          <tr
                            key={col.name}
                            className={`transition-colors group ${
                              isSelectedForStats
                                ? 'bg-monokai-elevated text-monokai-fg'
                                : 'hover:bg-monokai-surface/60'
                            }`}
                          >
                            {/* Column Name */}
                            <td className="p-2 pl-3.5 font-mono font-medium text-monokai-fg">
                              {isEditing ? (
                                <FormInput
                                  autoFocus
                                  sizeVariant="sm"
                                  fontVariant="mono"
                                  value={editColumnMode.newName}
                                  onChange={e =>
                                    onSetEditColumnMode({
                                      ...editColumnMode,
                                      newName: e.target.value,
                                    })
                                  }
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') onHandleSaveColumnEdit();
                                    if (e.key === 'Escape') onSetEditColumnMode(null);
                                  }}
                                  placeholder="字段名称"
                                />
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-monokai-fg group-hover:text-monokai-yellow transition-colors truncate">
                                    {col.name}
                                  </span>
                                  <IconButton
                                    label="复制字段名"
                                    icon={copiedColName === col.name ? Check : Copy}
                                    size="sm"
                                    tone={copiedColName === col.name ? 'primary' : 'neutral'}
                                    onClick={() => handleCopyColumn(col.name)}
                                    className="!h-6 !w-6 opacity-0 group-hover:opacity-100"
                                  />
                                </div>
                              )}
                            </td>

                            {/* Data Type */}
                            <td className="p-2 font-mono">
                              {isEditing ? (
                                <FormSelect
                                  sizeVariant="sm"
                                  className="font-mono"
                                  value={editColumnMode.newType}
                                  onChange={e =>
                                    onSetEditColumnMode({
                                      ...editColumnMode,
                                      newType: e.target.value,
                                    })
                                  }
                                >
                                  {DUCKDB_DATA_TYPES.map(t => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </FormSelect>
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border font-medium ${getTypeBadgeStyle(
                                    col.type,
                                  )}`}
                                >
                                  {getTypeIcon(col.type)} {col.type}
                                </span>
                              )}
                            </td>

                            {/* Constraints & Default Value */}
                            <td className="p-2 font-mono text-xs">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {col.pk ? (
                                  <Badge tone="pink" size="sm">
                                    <Key className="w-2.5 h-2.5" /> PK
                                  </Badge>
                                ) : null}
                                {col.notnull ? (
                                  <Badge tone="yellow" size="sm">
                                    NOT NULL
                                  </Badge>
                                ) : null}
                                {!col.pk && !col.notnull && (
                                  <span className="text-monokai-comment text-[10px] italic">NULLABLE</span>
                                )}
                                {col.dflt_value !== null && col.dflt_value !== undefined && (
                                  <Badge
                                    tone="accent"
                                    size="sm"
                                    title={`默认值表达式: ${String(col.dflt_value)}`}
                                  >
                                    DEFAULT: {String(col.dflt_value)}
                                  </Badge>
                                )}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="p-2 pr-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isEditing ? (
                                  <>
                                    <ActionButton
                                      variant="success"
                                      size="sm"
                                      onClick={onHandleSaveColumnEdit}
                                      icon={Check}
                                      title="保存修改 (Enter)"
                                    >
                                      保存
                                    </ActionButton>
                                    <ActionButton
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onSetEditColumnMode(null)}
                                      title="取消 (Esc)"
                                    >
                                      取消
                                    </ActionButton>
                                  </>
                                ) : (
                                  <>
                                    <ActionButton
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => {
                                        onShowColumnStats(col.name);
                                        setInspectorTab('profile');
                                      }}
                                      icon={BarChart3}
                                      title="查看字段画像与频次分布"
                                    >
                                      画像
                                    </ActionButton>
                                    <ActionButton
                                      variant="secondary"
                                      size="sm"
                                      onClick={() =>
                                        onSetEditColumnMode({
                                          colName: col.name,
                                          newName: col.name,
                                          newType: col.type,
                                        })
                                      }
                                      icon={Edit2}
                                      title="修改字段名称与数据类型"
                                    >
                                      编辑
                                    </ActionButton>
                                    <ActionButton
                                      variant="danger"
                                      size="sm"
                                      onClick={() => onHandleDropColumn(col.name)}
                                      icon={Trash2}
                                      title="删除此字段"
                                    />
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredSchema.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="p-8 text-center text-monokai-comment font-mono text-xs"
                          >
                            <div className="flex flex-col items-center gap-2">
                              <span>未匹配到包含 "{colFilter}" 的字段名称或数据类型。</span>
                              <ActionButton
                                variant="ghost"
                                size="sm"
                                onClick={() => setColFilter('')}
                              >
                                清空筛选条件
                              </ActionButton>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Column: Contextual Inspector Workbench Panel */}
              <div className="bg-monokai-sidebar border border-monokai-border rounded-lg w-full lg:w-[350px] xl:w-[380px] shrink-0 flex flex-col shadow-xs overflow-hidden">
                {/* Inspector Header Tabs */}
                <div className="p-2 border-b border-monokai-border bg-monokai-surface flex items-center justify-between">
                  <SegmentedTabs<RightInspectorTab>
                    aria-label="审查面板选项卡"
                    value={inspectorTab}
                    items={INSPECTOR_TABS}
                    size="sm"
                    tone="yellow"
                    onChange={val => setInspectorTab(val)}
                  />
                </div>

                {/* Inspector Content Viewport */}
                <div className="p-3.5 flex-1 overflow-y-auto custom-scrollbar font-sans text-xs">
                  {/* Tab 1: Column Profiler (字段画像) */}
                  {inspectorTab === 'profile' && (
                    <div>
                      {selectedColStats ? (
                        <div className="space-y-3.5 animate-[fadeIn_0.15s_ease-out]">
                          <div className="flex items-center justify-between pb-2 border-b border-monokai-border">
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge tone="yellow" size="sm">字段画像</Badge>
                              <h4 className="font-mono font-bold text-xs text-monokai-fg truncate" title={selectedColStats.col}>
                                {selectedColStats.col}
                              </h4>
                              <IconButton
                                label="复制字段名"
                                icon={Copy}
                                size="sm"
                                onClick={() => handleCopyColumn(selectedColStats.col)}
                                className="!h-6 !w-6"
                              />
                            </div>
                            <IconButton
                              label="关闭画像"
                              icon={X}
                              size="sm"
                              onClick={() => onSetSelectedColStats(null)}
                              className="!h-7 !w-7"
                            />
                          </div>

                          {/* Metric Cards Matrix with Percentages */}
                          {(() => {
                            const total = selectedColStats.stats.total_count || 0;
                            const nulls = selectedColStats.stats.null_count || 0;
                            const nullRate = total > 0 ? ((nulls / total) * 100).toFixed(1) : '0.0';
                            const distinct = selectedColStats.stats.distinct_count || 0;
                            const distinctRatio = total > 0 ? ((distinct / total) * 100).toFixed(1) : '0.0';

                            return (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-monokai-surface border border-monokai-border p-2 rounded-lg shadow-xs">
                                  <div className="text-[10px] text-monokai-comment font-medium">总行数 (Total)</div>
                                  <div className="font-mono text-xs font-bold text-monokai-fg tabular-nums mt-0.5">
                                    {total.toLocaleString()}
                                  </div>
                                </div>
                                <div className="bg-monokai-surface border border-monokai-border p-2 rounded-lg shadow-xs">
                                  <div className="flex items-center justify-between text-[10px] text-monokai-comment font-medium">
                                    <span>空值 (Nulls)</span>
                                    <span className="font-mono text-monokai-orange font-semibold">{nullRate}%</span>
                                  </div>
                                  <div className="font-mono text-xs font-bold text-monokai-orange tabular-nums mt-0.5">
                                    {nulls.toLocaleString()}
                                  </div>
                                </div>
                                <div className="bg-monokai-surface border border-monokai-border p-2 rounded-lg col-span-2 shadow-xs">
                                  <div className="flex items-center justify-between text-[10px] text-monokai-comment font-medium">
                                    <span>唯一值估计 (Distinct)</span>
                                    <span className="font-mono text-monokai-cyan font-semibold">基数比: {distinctRatio}%</span>
                                  </div>
                                  <div className="font-mono text-xs font-bold text-monokai-cyan tabular-nums mt-0.5">
                                    {distinct.toLocaleString()}
                                  </div>
                                </div>
                                <div className="bg-monokai-surface border border-monokai-border p-2 rounded-lg shadow-xs">
                                  <div className="text-[10px] text-monokai-comment font-medium">最小值 (Min)</div>
                                  <div
                                    className="font-mono text-xs truncate py-0.5 text-monokai-fg font-semibold mt-0.5"
                                    title={String(selectedColStats.stats.min)}
                                  >
                                    {String(selectedColStats.stats.min ?? '-')}
                                  </div>
                                </div>
                                <div className="bg-monokai-surface border border-monokai-border p-2 rounded-lg shadow-xs">
                                  <div className="text-[10px] text-monokai-comment font-medium">最大值 (Max)</div>
                                  <div
                                    className="font-mono text-xs truncate py-0.5 text-monokai-fg font-semibold mt-0.5"
                                    title={String(selectedColStats.stats.max)}
                                  >
                                    {String(selectedColStats.stats.max ?? '-')}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Top 5 Frequency Distribution */}
                          {selectedColStats.stats.top_k && selectedColStats.stats.top_k.length > 0 ? (
                            <div className="bg-monokai-surface border border-monokai-border p-2.5 rounded shadow-xs">
                              <h5 className="text-[10px] uppercase font-bold text-monokai-comment mb-2 tracking-wider flex items-center justify-between">
                                <span>Top 5 高频值分布</span>
                                <span className="text-[9px] font-mono text-monokai-comment font-normal">占比</span>
                              </h5>
                              <div className="space-y-2">
                                {selectedColStats.stats.top_k.map((k, idx) => {
                                  const ratio = selectedColStats.stats.total_count
                                    ? (k.count / selectedColStats.stats.total_count) * 100
                                    : 0;
                                  return (
                                    <div key={idx} className="space-y-1">
                                      <div className="flex items-center justify-between text-xs font-mono">
                                        <span
                                          className="text-monokai-fg font-medium truncate max-w-[170px]"
                                          title={String(k.value)}
                                        >
                                          {String(k.value)}
                                        </span>
                                        <span className="text-monokai-comment text-[10px] tabular-nums">
                                          {k.count.toLocaleString()} ({ratio.toFixed(1)}%)
                                        </span>
                                      </div>
                                      <div className="h-1.5 bg-monokai-bg rounded-full overflow-hidden border border-monokai-border/40">
                                        <div
                                          className="h-full bg-monokai-cyan rounded-full transition-all duration-300"
                                          style={{ width: `${Math.max(4, ratio)}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-monokai-surface/60 border border-monokai-border p-2.5 rounded text-center text-monokai-comment text-[11px]">
                              暂无频次聚集特征
                            </div>
                          )}

                          {/* Contextual Action: Explore in SQL */}
                          {onNavigateToSql && (
                            <ActionButton
                              variant="secondary"
                              size="sm"
                              className="w-full text-monokai-yellow hover:border-monokai-yellow/40"
                              icon={Code2}
                              onClick={() => {
                                onNavigateToSql(
                                  `SELECT "${selectedColStats.col}", COUNT(*) AS freq\nFROM "${currentTable}"\nGROUP BY "${selectedColStats.col}"\nORDER BY freq DESC\nLIMIT 50;`
                                );
                              }}
                              title="在 SQL 工作台中按该列执行分组频次聚合"
                            >
                              在 SQL 工作台中探查此列 ↗
                            </ActionButton>
                          )}
                        </div>
                      ) : (
                        <div className="py-8 px-2 text-center text-monokai-comment space-y-3">
                          <BarChart3 className="w-9 h-9 mx-auto text-monokai-comment/40" />
                          <div className="font-semibold text-monokai-fg text-xs">未选中字段画像</div>
                          <p className="text-[11px] text-monokai-comment/80 leading-relaxed max-w-xs mx-auto">
                            点击左侧表格中任一字段的 <span className="text-monokai-yellow font-mono">【画像】</span> 按钮，或在下方快速选择：
                          </p>

                          {/* Quick Column Selection Pills */}
                          {schema.length > 0 && (
                            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2 max-h-48 overflow-y-auto custom-scrollbar">
                              {schema.map(c => (
                                <button
                                  key={c.name}
                                  type="button"
                                  onClick={() => onShowColumnStats(c.name)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-[11px] font-mono text-monokai-fg hover:text-monokai-yellow transition-colors cursor-pointer"
                                  title={`点击查看 ${c.name} 字段画像`}
                                >
                                  {c.pk && <Key size={10} className="text-monokai-pink" />}
                                  <span>探查 {c.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 2: Add Column (添加字段) */}
                  {inspectorTab === 'add' && (
                    <div className="space-y-3 animate-[fadeIn_0.15s_ease-out]">
                      <div className="flex items-center gap-2 pb-2 border-b border-monokai-border">
                        <Badge tone="neutral" size="sm">ALTER TABLE</Badge>
                        <h4 className="font-mono font-semibold text-xs text-monokai-fg">
                          添加新字段
                        </h4>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] text-monokai-comment mb-1 font-medium">
                            字段名称 <span className="text-monokai-pink">*</span>
                          </label>
                          <FormInput
                            sizeVariant="sm"
                            fontVariant="mono"
                            tone={newColName && !addColumnValidation.valid ? 'danger' : 'neutral'}
                            value={newColName}
                            onChange={e => onSetNewColName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handlePerformAddColumn();
                            }}
                            placeholder="例如: status, score, payload_json"
                          />
                          {newColName && !addColumnValidation.valid && (
                            <p className="mt-1 text-[10px] text-monokai-pink flex items-center gap-1">
                              <AlertCircle size={10} />
                              <span>{addColumnValidation.error}</span>
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[11px] text-monokai-comment mb-1 font-medium">
                            数据类型
                          </label>
                          <FormSelect
                            sizeVariant="sm"
                            className="font-mono"
                            value={newColType}
                            onChange={e => onSetNewColType(e.target.value)}
                          >
                            {DUCKDB_DATA_TYPES.map(t => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </FormSelect>
                        </div>

                        <div>
                          <label className="block text-[11px] text-monokai-comment mb-1 font-medium">
                            默认值表达式（可选）
                          </label>
                          <FormInput
                            sizeVariant="sm"
                            fontVariant="mono"
                            value={addColDefault}
                            onChange={e => setAddColDefault(e.target.value)}
                            placeholder="例如: 0, 'active', CURRENT_TIMESTAMP"
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-0.5">
                          <input
                            type="checkbox"
                            id="add-col-notnull"
                            checked={addColNotNull}
                            onChange={e => setAddColNotNull(e.target.checked)}
                            className="rounded border-monokai-border text-monokai-accent focus:ring-monokai-accent cursor-pointer"
                          />
                          <label htmlFor="add-col-notnull" className="text-xs text-monokai-fg cursor-pointer select-none">
                            非空约束 (NOT NULL)
                          </label>
                        </div>

                        {/* Live ALTER TABLE SQL Preview */}
                        <div className="bg-monokai-bg border border-monokai-border p-2 rounded-lg text-[10px] font-mono text-monokai-comment break-all leading-relaxed">
                          <span className="text-monokai-pink font-semibold">ALTER TABLE</span> "{currentTable}" <span className="text-monokai-pink font-semibold">ADD COLUMN</span> "{newColName.trim() || 'column_name'}" {newColType}{addColNotNull ? ' NOT NULL' : ''}{addColDefault.trim() ? ` DEFAULT ${addColDefault.trim()}` : ''};
                        </div>

                        <ActionButton
                          variant="primary"
                          size="sm"
                          className="w-full"
                          onClick={handlePerformAddColumn}
                          disabled={!addColumnValidation.valid}
                          icon={Plus}
                        >
                          确认添加字段
                        </ActionButton>
                      </div>
                    </div>
                  )}

                  {/* Tab 3: DDL Definition (DDL 语句预览) */}
                  {inspectorTab === 'ddl' && (
                    <div className="space-y-3 animate-[fadeIn_0.15s_ease-out]">
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-[11px] text-monokai-comment font-mono">生成的完整建表 DDL</span>
                        <ActionButton
                          variant="ghost"
                          size="sm"
                          icon={copiedDdl ? Check : Copy}
                          onClick={handleCopyDdlWithFeedback}
                        >
                          {copiedDdl ? '已复制' : '复制 DDL'}
                        </ActionButton>
                      </div>

                      <CodeHighlightBlock
                        code={generatedDdl}
                        language="sql"
                        title={`DDL: "${currentTable}"`}
                        maxHeight="320px"
                        allowFormat={true}
                      />

                      {onNavigateToSql && (
                        <ActionButton
                          variant="primary"
                          size="sm"
                          className="w-full"
                          icon={Code2}
                          onClick={() => onNavigateToSql(generatedDdl)}
                          title="将生成的 DDL 载入 SQL 工作台以供执行或改造"
                        >
                          在 SQL 工作台中打开 / 运行 ↗
                        </ActionButton>
                      )}

                      <InlineAlert tone="info" title="常用 DuckDB DDL 提示">
                        <ul className="space-y-1 list-disc pl-3.5 text-[11px]">
                          <li>主键创建后不可通过 ALTER TABLE 新增，需在建表时指定。</li>
                          <li>
                            删除列：
                            <code className="text-monokai-pink font-mono ml-1">ALTER TABLE tbl DROP COLUMN col;</code>
                          </li>
                          <li>
                            类型转换：
                            <code className="text-monokai-pink font-mono ml-1">ALTER TABLE tbl ALTER col TYPE new_type;</code>
                          </li>
                        </ul>
                      </InlineAlert>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center p-6 sm:p-8 bg-monokai-bg">
            <EmptyState
              icon={MousePointerClick}
              title={EMPTY_STATE_MESSAGES.SCHEMA.title}
              description={EMPTY_STATE_MESSAGES.SCHEMA.description}
              action={
                <div className="flex flex-col items-center gap-3">
                  {tables && tables.length > 0 && onSelectTable && (
                    <div className="flex flex-wrap items-center justify-center gap-2 max-w-md">
                      {tables.map(tbl => (
                        <button
                          key={tbl}
                          type="button"
                          onClick={() => onSelectTable(tbl)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-monokai-sidebar hover:bg-monokai-elevated border border-monokai-border text-xs font-mono text-monokai-fg hover:text-monokai-accent transition-colors cursor-pointer"
                        >
                          <Database size={12} className="text-monokai-cyan" />
                          <span>{tbl}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <ActionButton
                      variant="secondary"
                      size="sm"
                      icon={Network}
                      onClick={() => onSetStructureViewMode('graph')}
                    >
                      打开 ER 图谱
                    </ActionButton>
                    {onNavigateToDashboard && (
                      <ActionButton variant="ghost" size="sm" icon={LayoutDashboard} onClick={onNavigateToDashboard}>
                        返回仪表盘
                      </ActionButton>
                    )}
                  </div>
                </div>
              }
            />
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default StructureTab;
