/**
 * DataFlowAssetSidebar - 现代专业 IDE 左侧资产与算子面板
 *
 * 核心特性：
 * 1. 双分组垂直折叠面板：
 *    - 上半区：数据库与血缘对象树（已挂载 Table / View，支持关键字搜索与拖拽入画布）
 *    - 下半区：标准 ETL 算子库（数据源、SQL 派生、JOIN、聚合、导出，支持原生 HTML5 拖拽放置）
 * 2. 支持一键展开/折叠，最大化画布可用面积
 * 3. 实时反映 DuckDB 工作区表元数据（行数、字段数）
 */

import React, { useState, useEffect } from 'react';
import {
  Database,
  Search,
  RefreshCw,
  Table,
  Layers,
  Code2,
  Link2,
  Sigma,
  Upload,
  History,
  ChevronDown,
  ChevronRight,
  Plus,
  GripVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Eye,
} from 'lucide-react';
import { useWorkflowStore } from '../../../services/dataflow/workflowStore';
import { duckDBService } from '../../../services/duckdbService';
import type { WorkflowNodeType } from '../../../services/dataflow/workflowTypes';
import { dfPanelHeader, dfPanelTitle } from '../dataflowUi';

export interface DataFlowAssetSidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface OperatorItem {
  type?: WorkflowNodeType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  bgColor: string;
  action?: () => void;
}

const OPERATORS: OperatorItem[] = [
  {
    type: 'source',
    title: '数据源',
    description: '加载 Parquet / CSV / Table',
    icon: Database,
    accentColor: 'text-monokai-cyan',
    bgColor: 'bg-monokai-cyan/10 border-monokai-cyan/30',
  },
  {
    type: 'sql_transform',
    title: 'SQL',
    description: '自定义 SQL 派生与表达式',
    icon: Code2,
    accentColor: 'text-monokai-amethyst',
    bgColor: 'bg-monokai-amethyst/10 border-monokai-amethyst/30',
  },
  {
    type: 'schema',
    title: '数据表',
    description: '结构检验与模式字段',
    icon: Table,
    accentColor: 'text-monokai-amethyst',
    bgColor: 'bg-monokai-amethyst/10 border-monokai-amethyst/30',
  },
  {
    type: 'join',
    title: '连接',
    description: 'INNER / LEFT / FULL 关联',
    icon: Link2,
    accentColor: 'text-monokai-pink',
    bgColor: 'bg-monokai-pink/10 border-monokai-pink/30',
  },
  {
    type: 'aggregate',
    title: '聚合',
    description: 'GROUP BY 与度量统计',
    icon: Sigma,
    accentColor: 'text-monokai-yellow',
    bgColor: 'bg-monokai-yellow/10 border-monokai-yellow/30',
  },
  {
    type: 'result',
    title: '可视化',
    description: '数据汇总全量采样分析',
    icon: Table,
    accentColor: 'text-monokai-accent',
    bgColor: 'bg-monokai-accent/10 border-monokai-accent/30',
  },
  {
    type: 'export',
    title: '导出',
    description: '导出 Parquet / CSV / JSON',
    icon: Upload,
    accentColor: 'text-monokai-cyan',
    bgColor: 'bg-monokai-cyan/10 border-monokai-cyan/30',
  },
  {
    title: '历史',
    description: '全链路执行与控制台日志',
    icon: History,
    accentColor: 'text-monokai-comment',
    bgColor: 'bg-white/[0.05] border-monokai-border/40',
  },
];

export const DataFlowAssetSidebar: React.FC<DataFlowAssetSidebarProps> = ({
  isCollapsed: controlledCollapsed,
  onToggleCollapse: controlledToggle,
}) => {
  const {
    availableTables,
    refreshAvailableTables,
    addNode,
    addSourceNodeForTable,
    dataFlowMode,
    setBottomDrawerTab,
    setIsBottomDrawerOpen,
  } = useWorkflowStore();

  const [localCollapsed, setLocalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : localCollapsed;
  const toggleCollapse = controlledToggle || (() => setLocalCollapsed(!localCollapsed));

  const [tableSearch, setTableSearch] = useState('');
  const [isTablesSectionOpen, setIsTablesSectionOpen] = useState(true);
  const [isOperatorsSectionOpen, setIsOperatorsSectionOpen] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    refreshAvailableTables();
  }, [refreshAvailableTables]);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRefreshing(true);
    await refreshAvailableTables();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filteredTables = availableTables.filter(t =>
    t.toLowerCase().includes(tableSearch.toLowerCase().trim())
  );

  const isCustomMode = dataFlowMode === 'custom';

  if (isCollapsed) {
    return (
      <div className="w-10 shrink-0 border-r border-monokai-border bg-monokai-surface/90 flex flex-col items-center py-2.5 select-none z-10">
        <button
          type="button"
          onClick={toggleCollapse}
          className="p-1.5 rounded hover:bg-white/[0.06] text-monokai-comment hover:text-monokai-fg cursor-pointer transition-colors"
          title="展开左侧资产与算子库"
        >
          <PanelLeftOpen className="w-4 h-4 text-monokai-accent" />
        </button>
        <div className="my-2 h-px w-6 bg-monokai-border" />
        <button
          type="button"
          onClick={() => {
            toggleCollapse();
            setIsTablesSectionOpen(true);
          }}
          className="p-2 rounded text-monokai-comment hover:text-monokai-cyan transition-colors cursor-pointer"
          title="数据表与血缘对象"
        >
          <Database className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            toggleCollapse();
            setIsOperatorsSectionOpen(true);
          }}
          className="p-2 rounded text-monokai-comment hover:text-monokai-accent transition-colors cursor-pointer"
          title="ETL 算子库"
        >
          <Layers className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-60 shrink-0 border-r border-monokai-border bg-monokai-surface/95 flex flex-col h-full font-sans select-none z-10">
      {/* ── 顶栏标题与折叠 ── */}
      <div className={dfPanelHeader}>
        <span className={dfPanelTitle}>
          <Layers className="w-3.5 h-3.5 text-monokai-accent" />
          <span>资产与算子库</span>
        </span>
        <button
          type="button"
          onClick={toggleCollapse}
          className="p-1 rounded hover:bg-white/[0.06] text-monokai-comment hover:text-monokai-fg cursor-pointer transition-colors"
          title="折叠侧边栏"
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        {/* ── 分组 1: 数据库与血缘对象树 ── */}
        <div className="border-b border-monokai-border/80">
          <div
            onClick={() => setIsTablesSectionOpen(!isTablesSectionOpen)}
            className="flex items-center justify-between px-3 py-2 bg-monokai-surface/60 hover:bg-monokai-elevated/60 cursor-pointer transition-colors text-xs font-semibold text-monokai-fg"
          >
            <div className="flex items-center gap-1.5">
              {isTablesSectionOpen ? (
                <ChevronDown className="w-3 h-3 text-monokai-comment" />
              ) : (
                <ChevronRight className="w-3 h-3 text-monokai-comment" />
              )}
              <Database className="w-3.5 h-3.5 text-monokai-cyan" />
              <span>数据表与视图</span>
              <span className="text-2xs text-monokai-comment font-mono font-normal">
                ({availableTables.length})
              </span>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="p-1 rounded hover:bg-white/[0.08] text-monokai-comment hover:text-monokai-accent cursor-pointer"
              title="刷新表列表"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-monokai-accent' : ''}`} />
            </button>
          </div>

          {isTablesSectionOpen && (
            <div className="p-2 space-y-1.5">
              {/* 搜索框 */}
              <div className="relative">
                <Search className="absolute left-2 top-2 w-3 h-3 text-monokai-comment" />
                <input
                  type="text"
                  placeholder="搜索数据表 / 视图..."
                  value={tableSearch}
                  onChange={e => setTableSearch(e.target.value)}
                  className="w-full rounded-md bg-monokai-bg border border-monokai-border pl-7 pr-2 py-1 text-meta font-mono text-monokai-fg placeholder:text-monokai-comment outline-none focus:border-monokai-accent/70"
                />
              </div>

              {/* 表清单 */}
              <div className="max-h-44 overflow-y-auto custom-scrollbar space-y-1 pr-0.5">
                {filteredTables.length > 0 ? (
                  filteredTables.map(tbl => (
                    <div
                      key={tbl}
                      draggable
                      onDragStart={e => {
                        e.dataTransfer.setData('application/duckdb-table', tbl);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      className="group flex items-center justify-between p-1.5 rounded-md border border-monokai-border/50 bg-monokai-bg/60 hover:bg-monokai-elevated hover:border-monokai-accent/40 cursor-grab active:cursor-grabbing transition-all text-xs"
                      title={`拖拽至画布以创建「${tbl}」数据源节点`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <GripVertical className="w-2.5 h-2.5 text-monokai-comment/40 group-hover:text-monokai-comment shrink-0" />
                        <Table className="w-3 h-3 text-monokai-cyan shrink-0" />
                        <span className="font-mono text-meta text-monokai-fg font-medium truncate">
                          {tbl}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => addSourceNodeForTable(tbl)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-monokai-accent/20 text-monokai-accent cursor-pointer transition-opacity"
                        title="点击直接添加至画布"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-3 text-center text-2xs text-monokai-comment font-mono">
                    {tableSearch ? '未匹配到表' : '暂无数据表'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── 分组 2: ETL 算子库与模板 ── */}
        <div className="flex-1 flex flex-col min-h-0">
          <div
            onClick={() => setIsOperatorsSectionOpen(!isOperatorsSectionOpen)}
            className="flex items-center justify-between px-3 py-2 bg-monokai-surface/60 hover:bg-monokai-elevated/60 cursor-pointer transition-colors text-xs font-semibold text-monokai-fg border-b border-monokai-border/60"
          >
            <div className="flex items-center gap-1.5">
              {isOperatorsSectionOpen ? (
                <ChevronDown className="w-3 h-3 text-monokai-comment" />
              ) : (
                <ChevronRight className="w-3 h-3 text-monokai-comment" />
              )}
              <Layers className="w-3.5 h-3.5 text-monokai-yellow" />
              <span>ETL 算子库</span>
            </div>
            {!isCustomMode && (
              <span className="text-2xs font-normal text-monokai-comment px-1 rounded bg-white/[0.04]">
                仅编排模式
              </span>
            )}
          </div>

          {isOperatorsSectionOpen && (
            <div className="p-2 space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
              <div className="text-2xs text-monokai-comment px-1 pb-1">
                拖拽算子卡片至右侧画布任意位置：
              </div>
              {OPERATORS.map(op => {
                const Icon = op.icon;
                const isAction = !op.type;
                const isAvailable = isAction || isCustomMode;
                return (
                  <div
                    key={op.title || op.type}
                    draggable={Boolean(isCustomMode && op.type)}
                    onDragStart={e => {
                      if (!isCustomMode || !op.type) return;
                      e.dataTransfer.setData('application/duckdb-operator', op.type);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => {
                      if (op.action) {
                        op.action();
                      } else if (op.title === '历史') {
                        setBottomDrawerTab('logs');
                        setIsBottomDrawerOpen(true);
                      } else if (isCustomMode && op.type) {
                        addNode(op.type);
                      }
                    }}
                    className={`group flex items-center gap-2.5 p-2 rounded-lg border transition-all ${
                      isAvailable
                        ? 'border-monokai-border/60 bg-monokai-bg/60 hover:bg-monokai-elevated hover:border-monokai-accent/40 cursor-pointer'
                        : 'border-monokai-border/40 bg-monokai-bg/30 opacity-50 cursor-not-allowed'
                    }`}
                    title={
                      isAction
                        ? `打开「${op.title}」面板`
                        : isCustomMode
                        ? `拖拽或点击添加「${op.title}」算子`
                        : '切换至「自由编排」模式后可使用算子库'
                    }
                  >
                    <div className={`w-7 h-7 shrink-0 rounded-md border flex items-center justify-center ${op.bgColor}`}>
                      <Icon className={`w-3.5 h-3.5 ${op.accentColor}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-monokai-fg leading-tight">
                          {op.title}
                        </span>
                        {isCustomMode && op.type && (
                          <Plus className="w-3 h-3 text-monokai-comment group-hover:text-monokai-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                      <div className="text-2xs text-monokai-comment truncate mt-0.5">
                        {op.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
