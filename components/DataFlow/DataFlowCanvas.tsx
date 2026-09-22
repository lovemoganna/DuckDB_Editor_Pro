/**
 * DataFlowCanvas - 现代工业级数据流与 ETL 编排工作台
 *
 * 核心架构重构：
 * 1. 顶部单行高聚合顶栏 (40px)：整合模式切换、关联查询选择器、实时联动指示与核心动作组
 * 2. 现代专业 IDE 三栏布局：
 *    - 左侧：DataFlowAssetSidebar 数据库表/视图对象树 + ETL 算子库（支持 HTML5 拖拽入画布）
 *    - 中央：极简沉浸式 DAG 画布（极简流线型节点 + 防碰撞错峰连线徽章 + 视口工具岛）
 *    - 右侧：停靠推挤式 Inspector 检查器（支持 280~560px 宽度自由拖拽，分屏模式智能降级为浮动抽屉）
 *    - 底部：DataFlowBottomDrawer 折叠控制台（平时 28px 精致状态栏，可拖拽拉伸展开）
 * 3. 修复 LiveSync 焦点锁定与日志无害化、屏蔽系统修饰键冲突
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  NodeMouseHandler,
  EdgeMouseHandler,
  MiniMap,
  ConnectionMode,
  ConnectionLineType,
  type Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  MousePointer,
  Hand,
  Plus,
  Minus,
  Scan,
  RefreshCw,
  Play,
  FileCode2,
  Database,
  Layers,
  Zap,
  ArrowRightLeft,
  Columns2,
  Code,
  Table,
  Maximize2,
  Map,
  LayoutGrid,
  Sliders,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Workflow,
  Link2,
  Sigma,
  Upload,
  ChevronDown,
} from 'lucide-react';

import { useWorkflowStore, wouldCreateCycle, type DataFlowMode } from '../../services/dataflow/workflowStore';
import { DataFlowNode } from './nodes/DataFlowNode';
import { DataFlowCustomEdge } from './edges/DataFlowCustomEdge';
import { DataFlowInspector } from './panels/DataFlowInspector';
import { DataFlowBottomDrawer } from './panels/DataFlowBottomDrawer';
import { DataFlowAssetSidebar } from './panels/DataFlowAssetSidebar';
import { Tab } from '../../types';
import { useAppStore } from '../../hooks/store/useAppStore';
import { toastService } from '../../services/toastService';
import {
  dfDividerV,
  dfIconBtn,
  dfIconBtnActive,
  dfModePillActive,
  dfModePillGroup,
  dfModePillIdle,
  dfShell,
  dfToolbarIsland,
} from './dataflowUi';

const nodeTypes = {
  dataFlowNode: DataFlowNode,
};

const edgeTypes = {
  dataFlowEdge: DataFlowCustomEdge,
  default: DataFlowCustomEdge,
};

interface CanvasToolbarProps {
  showMiniMap: boolean;
  onToggleMiniMap: () => void;
  isPanMode: boolean;
  onSetPanMode: (v: boolean) => void;
}

const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  showMiniMap,
  onToggleMiniMap,
  isPanMode,
  onSetPanMode,
}) => {
  const { zoomIn, zoomOut, fitView, getZoom } = useReactFlow();
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const autoLayout = useWorkflowStore(s => s.autoLayout);
  const addNode = useWorkflowStore(s => s.addNode);

  const syncZoom = () => {
    const z = Math.round(getZoom() * 100);
    setZoomLevel(z);
  };

  const handleZoomIn = () => { zoomIn(); setTimeout(syncZoom, 50); };
  const handleZoomOut = () => { zoomOut(); setTimeout(syncZoom, 50); };
  const handleFitView = () => {
    fitView({ padding: 0.2, duration: 400 });
    setTimeout(syncZoom, 450);
  };

  const handleAutoLayout = () => {
    autoLayout();
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 350 });
      toastService.success('已自动优化并对齐 DAG 拓扑布局');
    }, 50);
  };

  return (
    <div className={`absolute left-4 top-3.5 z-20 ${dfToolbarIsland}`}>
      {/* 箭头指针 / 抓手平移 */}
      <button
        type="button"
        onClick={() => onSetPanMode(false)}
        className={!isPanMode ? dfIconBtnActive : dfIconBtn}
        title="选择模式 (快捷键: S)"
      >
        <MousePointer className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onSetPanMode(true)}
        className={isPanMode ? dfIconBtnActive : dfIconBtn}
        title="平移画布 (快捷键: H)"
      >
        <Hand className="h-3.5 w-3.5" />
      </button>

      <div className={dfDividerV} />

      {/* 缩小 */}
      <button
        type="button"
        onClick={handleZoomOut}
        className={dfIconBtn}
        title="缩小画布"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>

      {/* 缩放百分比 */}
      <span className="px-1 text-meta text-monokai-fg min-w-[38px] text-center font-mono">
        {zoomLevel}%
      </span>

      {/* 放大 */}
      <button
        type="button"
        onClick={handleZoomIn}
        className={dfIconBtn}
        title="放大画布"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      <div className={dfDividerV} />

      {/* 适应视图 */}
      <button
        type="button"
        onClick={handleFitView}
        className={dfIconBtn}
        title="全图自适应居中 (Fit View)"
      >
        <Scan className="h-3.5 w-3.5" />
      </button>

      {/* 自动拓扑布局 */}
      <button
        type="button"
        onClick={handleAutoLayout}
        className={dfIconBtn}
        title="智能分层拓扑整理布局"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>

      {/* 小地图开关 */}
      <button
        type="button"
        onClick={onToggleMiniMap}
        className={showMiniMap ? dfIconBtnActive : dfIconBtn}
        title="切换全景小地图 (MiniMap)"
      >
        <Map className="h-3.5 w-3.5" />
      </button>

      <div className={dfDividerV} />

      {/* 快捷添加算子节点下拉 */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="flex items-center gap-1 px-1.5 py-1 rounded bg-monokai-accent/15 text-monokai-accent hover:bg-monokai-accent/25 transition-colors cursor-pointer text-xs font-semibold"
          title="在画布中快速添加算子节点"
        >
          <Plus className="h-3 w-3" />
          <span>加算子</span>
          <ChevronDown className={`h-2.5 w-2.5 opacity-70 transition-transform duration-150 ${showAddMenu ? 'rotate-180' : ''}`} />
        </button>
        {showAddMenu && (
          <div
            className="absolute left-0 top-full mt-1.5 w-44 rounded-md border border-monokai-border bg-monokai-surface/98 p-1 shadow-2xl backdrop-blur-md z-50 text-xs flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 font-sans"
          >
            <button
              type="button"
              onClick={() => { addNode('sql_transform'); setShowAddMenu(false); toastService.success('已添加「SQL 转换」算子'); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-monokai-fg hover:bg-monokai-elevated hover:text-monokai-accent transition-colors text-left cursor-pointer"
            >
              <Code className="h-3.5 w-3.5 text-monokai-amethyst shrink-0" />
              <span>SQL 转换</span>
            </button>
            <button
              type="button"
              onClick={() => { addNode('join'); setShowAddMenu(false); toastService.success('已添加「表连接」算子'); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-monokai-fg hover:bg-monokai-elevated hover:text-monokai-pink transition-colors text-left cursor-pointer"
            >
              <Link2 className="h-3.5 w-3.5 text-monokai-pink shrink-0" />
              <span>表连接 (Join)</span>
            </button>
            <button
              type="button"
              onClick={() => { addNode('aggregate'); setShowAddMenu(false); toastService.success('已添加「聚合统计」算子'); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-monokai-fg hover:bg-monokai-elevated hover:text-monokai-yellow transition-colors text-left cursor-pointer"
            >
              <Sigma className="h-3.5 w-3.5 text-monokai-yellow shrink-0" />
              <span>聚合统计 (GroupBy)</span>
            </button>
            <button
              type="button"
              onClick={() => { addNode('result'); setShowAddMenu(false); toastService.success('已添加「结果表」节点'); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-monokai-fg hover:bg-monokai-elevated hover:text-monokai-cyan transition-colors text-left cursor-pointer"
            >
              <Table className="h-3.5 w-3.5 text-monokai-cyan shrink-0" />
              <span>结果表 (Result)</span>
            </button>
            <button
              type="button"
              onClick={() => { addNode('export'); setShowAddMenu(false); toastService.success('已添加「导出数据」节点'); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-monokai-fg hover:bg-monokai-elevated hover:text-monokai-cyan transition-colors text-left cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-monokai-cyan shrink-0" />
              <span>导出文件 (Export)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export interface DataFlowCanvasProps {
  hideSubNav?: boolean;
  standalone?: boolean;
  initialMode?: DataFlowMode;
  onSwitchToSqlEditor?: () => void;
  onOpenInSqlEditor?: (sql: string, title?: string) => void;
  activeSql?: string;
  activeTabTitle?: string;
  activeQueryResult?: any;
  tabs?: Array<{ id: string; title: string; sql: string }>;
  activeTabId?: string;
  onSelectTab?: (tabId: string) => void;
  layoutMode?: 'editor' | 'split' | 'canvas';
  onChangeLayoutMode?: (mode: 'editor' | 'split' | 'canvas') => void;
}

const DataFlowCanvasInner: React.FC<DataFlowCanvasProps> = ({
  hideSubNav = false,
  standalone = false,
  initialMode,
  onSwitchToSqlEditor,
  onOpenInSqlEditor,
  activeSql = '',
  activeTabTitle = 'SQL 查询',
  activeQueryResult,
  tabs,
  activeTabId,
  onSelectTab,
  layoutMode,
  onChangeLayoutMode,
}) => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectNode,
    selectedNodeId,
    loadWorkflow,
    dataFlowMode,
    setDataFlowMode,
    syncFromSql,
    syncFromCatalog,
    syncExecutionResult,
    compileWorkflowToSql,
    runAll,
    deleteNode,
    deleteEdge,
    addNode,
    addSourceNodeForTable,
    autoLayout,
    isExecuting,
    liveSyncWithSql,
    setLiveSyncWithSql,
    resetToDefaultDemo,
  } = useWorkflowStore();

  const { setActiveTab } = useAppStore();
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showMiniMap, setShowMiniMap] = useState<boolean>(false);
  const [isPanMode, setIsPanMode] = useState<boolean>(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  
  // 右侧检查器：默认收起，选中节点后再打开，避免首屏三栏挤占画布
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
    const saved = localStorage.getItem('dataflow_inspector_width');
    return saved ? Math.max(280, Math.min(560, Number(saved))) : 300;
  });
  const [isDraggingInspector, setIsDraggingInspector] = useState<boolean>(false);

  // 左侧资产栏：默认折叠；自由编排模式自动展开，SQL/血缘模式自动收起
  const [isAssetSidebarCollapsed, setIsAssetSidebarCollapsed] = useState<boolean>(true);
  const prevDataFlowModeRef = useRef<DataFlowMode | null>(null);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

  // 检查器拖拽宽度调整
  const handleInspectorMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingInspector(true);
    const startX = e.clientX;
    const startWidth = inspectorWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const nextWidth = Math.max(280, Math.min(580, startWidth + deltaX));
      setInspectorWidth(nextWidth);
      localStorage.setItem('dataflow_inspector_width', String(nextWidth));
    };

    const handleMouseUp = () => {
      setIsDraggingInspector(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [inspectorWidth]);

  // 全局快捷键监听（严格过滤修饰键，防止与 Ctrl+S / Ctrl+H 冲突）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (isInput) return;

      // 严格检查修饰键：若按住了 Ctrl、Meta、Alt，绝不触发单键快捷键
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 's' || e.key === 'S') {
        setIsPanMode(false);
      } else if (e.key === 'h' || e.key === 'H') {
        setIsPanMode(true);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          e.preventDefault();
          deleteNode(selectedNodeId);
          toastService.info('已从画布中删除选中节点');
        } else if (selectedEdgeId) {
          e.preventDefault();
          deleteEdge(selectedEdgeId);
          setSelectedEdgeId(null);
          toastService.info('已从画布中删除选中连线');
        }
      } else if (e.key === 'Escape') {
        selectNode(null);
        setSelectedEdgeId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedEdgeId, deleteNode, deleteEdge, selectNode]);

  // 分屏模式下默认折叠 Inspector，最大化 DAG 空间
  useEffect(() => {
    if (layoutMode === 'split') {
      setIsInspectorOpen(false);
    }
  }, [layoutMode]);

  // 模式切换时自动收/展左侧资产栏：自由编排需要拖拽算子，其余模式让出画布
  useEffect(() => {
    const prev = prevDataFlowModeRef.current;
    prevDataFlowModeRef.current = dataFlowMode;
    // 首次挂载也按模式对齐；仅在模式变化或首次时调整
    if (prev === dataFlowMode && prev !== null) return;
    setIsAssetSidebarCollapsed(dataFlowMode !== 'custom');
  }, [dataFlowMode]);

  // 初始化加载
  useEffect(() => {
    if (standalone) {
      if (initialMode === 'catalog' || !activeSql.trim()) {
        void syncFromCatalog();
      } else {
        void loadWorkflow(activeSql, activeTabTitle);
      }
    } else {
      void loadWorkflow(activeSql, activeTabTitle);
    }
  }, [standalone, initialMode, loadWorkflow, syncFromCatalog, activeSql, activeTabTitle]);

  // 外部 SQL 发生变化时，若处于 Live Sync 且为 SQL 模式，静默解析流图（保持当前选中态不变）
  useEffect(() => {
    if (!liveSyncWithSql || dataFlowMode !== 'sql' || !activeSql.trim()) return;

    const timer = setTimeout(() => {
      syncFromSql(activeSql, activeTabTitle, false);
    }, 500);

    return () => clearTimeout(timer);
  }, [activeSql, activeTabTitle, liveSyncWithSql, dataFlowMode, syncFromSql]);

  // SQL 工作台产生最新执行结果时，同步给对应节点
  useEffect(() => {
    if (activeQueryResult) {
      syncExecutionResult(activeTabTitle, activeQueryResult, activeSql);
    }
  }, [activeQueryResult, activeTabTitle, activeSql, syncExecutionResult]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      selectNode(node.id);
      setSelectedEdgeId(null);
      setIsInspectorOpen(true);
    },
    [selectNode]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
    setSelectedEdgeId(null);
  }, [selectNode]);

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_, edge) => {
      setSelectedEdgeId(edge.id);
      selectNode(null);
    },
    [selectNode]
  );

  // 连线实时合法性校验 (杜绝自环、重复边与死循环 DAG)
  const isValidConnection = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return false;
    if (connection.source === connection.target) return false;

    // 检查重复连线
    const isDuplicate = edges.some(
      e =>
        (e.source === connection.source && e.target === connection.target && e.sourceHandle === connection.sourceHandle && e.targetHandle === connection.targetHandle) ||
        (e.source === connection.target && e.target === connection.source && e.sourceHandle === connection.targetHandle && e.targetHandle === connection.sourceHandle)
    );
    if (isDuplicate) return false;

    // 检查拓扑有向环
    const isReversed =
      connection.sourceHandle === 'input' ||
      connection.sourceHandle === 'left' ||
      connection.sourceHandle === 'right' ||
      connection.targetHandle === 'output';

    const fromId = isReversed ? connection.target : connection.source;
    const toId = isReversed ? connection.source : connection.target;

    return !wouldCreateCycle(fromId, toId, edges);
  }, [edges]);

  // HTML5 Drag & Drop 算子和表入画布
  const getFlowCoordinates = useCallback((clientX: number, clientY: number) => {
    if (typeof (reactFlowInstance as any).screenToFlowPosition === 'function') {
      return (reactFlowInstance as any).screenToFlowPosition({ x: clientX, y: clientY });
    }
    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    if (bounds && typeof reactFlowInstance.project === 'function') {
      return reactFlowInstance.project({ x: clientX - bounds.left, y: clientY - bounds.top });
    }
    return { x: 300, y: 200 };
  }, [reactFlowInstance]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const table = e.dataTransfer.getData('application/duckdb-table');
    const operator = e.dataTransfer.getData('application/duckdb-operator');
    const pos = getFlowCoordinates(e.clientX, e.clientY);

    if (table) {
      void addSourceNodeForTable(table, pos);
      toastService.success(`已添加数据源节点「${table}」`);
    } else if (operator) {
      addNode(operator as any, pos);
      toastService.success(`已添加「${operator}」算子节点`);
    }
  }, [getFlowCoordinates, addSourceNodeForTable, addNode]);

  // 手动从当前 SQL 同步
  const handleManualSyncFromSql = async () => {
    if (!activeSql.trim()) {
      toastService.info('SQL 工作台中暂无查询内容');
      return;
    }
    setIsSyncing(true);
    try {
      await syncFromSql(activeSql, activeTabTitle, true);
      toastService.success(`已重新解析生成数据流图: ${activeTabTitle}`);
    } catch (e: any) {
      toastService.error(`解析失败: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // 切换到全库血缘
  const handleSwitchToCatalog = async () => {
    setIsSyncing(true);
    await setDataFlowMode('catalog');
    toastService.info('已同步 DuckDB 全库表与视图依赖血缘');
    setTimeout(() => setIsSyncing(false), 500);
  };

  // 编译并反哺为 SQL 工作台查询
  const handleCompileToSql = () => {
    const fullSql = compileWorkflowToSql();
    if (!fullSql || fullSql.startsWith('--')) {
      toastService.warning('画布为空，无法编译为 SQL');
      return;
    }
    const baseName = (activeTabTitle || 'dataflow').replace(/(\.sql|_dag)+$/gi, '');
    const title = `${baseName || 'dataflow'}_dag.sql`;
    if (onOpenInSqlEditor) {
      onOpenInSqlEditor(fullSql, title);
    } else {
      window.dispatchEvent(
        new CustomEvent('duckdb_execute_sql', {
          detail: { sql: fullSql, title, autoRun: false },
        })
      );
    }
    toastService.success(`已编译为 CTE 并在 SQL 工作台新建标签: ${title}`);
  };

  const isSplitMode = layoutMode === 'split';

  return (
    <div className={dfShell}>
      {/* 顶部三态视图导航 (当未隐藏且非独立全屏时) */}
      {!hideSubNav && !standalone && (
        <div className="flex items-center justify-between border-b border-monokai-border bg-monokai-sidebar px-3 py-1 text-2xs shrink-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-monokai-surface text-monokai-fg font-medium border border-monokai-border/80 shadow-xs"
            >
              <Workflow className="w-3.5 h-3.5 text-monokai-accent" />
              <span>数据流画布</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (onSwitchToSqlEditor) onSwitchToSqlEditor();
                else setActiveTab(Tab.SQL);
              }}
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60 transition-colors cursor-pointer"
            >
              <FileCode2 className="w-3.5 h-3.5 text-monokai-cyan" />
              <span>SQL 编辑器</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab(Tab.DATA);
              }}
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60 transition-colors cursor-pointer"
            >
              <Table className="w-3.5 h-3.5 text-monokai-yellow" />
              <span>表数据查看器</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 统一现代化单行高聚合顶栏 (高度严格收敛为 40px) ── */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-monokai-border bg-monokai-sidebar px-3 z-30 select-none gap-2 overflow-x-auto scrollbar-hide">
        {/* 左侧：工作流标识 + 驱动模式切换胶囊 */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 pr-2 border-r border-monokai-border/80">
            <Workflow className="w-4 h-4 text-monokai-accent" />
            <span className="font-mono text-xs font-bold text-monokai-fg tracking-tight hidden sm:inline">
              DataFlow
            </span>
          </div>

          {/* 模式选择胶囊 */}
          <div className={dfModePillGroup}>
            <button
              type="button"
              onClick={async () => {
                await setDataFlowMode('sql');
                if (activeSql) await syncFromSql(activeSql, activeTabTitle, true);
              }}
              className={dataFlowMode === 'sql' ? dfModePillActive : dfModePillIdle}
              title="当前 SQL 查询逻辑流程图 (CTE / JOIN / GROUP BY)"
            >
              <FileCode2 className="w-3 h-3" />
              <span>当前 SQL 流图</span>
            </button>

            <button
              type="button"
              onClick={handleSwitchToCatalog}
              className={dataFlowMode === 'catalog' ? 'flex items-center gap-1 px-2 py-0.5 rounded bg-monokai-cyan/20 text-monokai-cyan font-semibold shadow-xs cursor-pointer' : dfModePillIdle}
              title="全库表与视图依赖血缘"
            >
              <Database className="w-3 h-3" />
              <span>全库表与视图血缘</span>
            </button>

            <button
              type="button"
              onClick={() => setDataFlowMode('custom')}
              className={dataFlowMode === 'custom' ? 'flex items-center gap-1 px-2 py-0.5 rounded bg-monokai-yellow/20 text-monokai-yellow font-semibold shadow-xs cursor-pointer' : dfModePillIdle}
              title="自由编排模式：从左侧资产栏自由拖放算子"
            >
              <Layers className="w-3 h-3" />
              <span>自由编排</span>
            </button>
          </div>
        </div>

        {/* 中部：关联查询切换与实时联动指示 */}
        <div className="flex items-center gap-2 shrink-0">
          {tabs && tabs.length > 0 && (
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="text-meta text-monokai-comment font-normal hidden md:inline">关联:</span>
              <select
                aria-label="关联查询"
                value={activeTabId}
                onChange={e => {
                  onSelectTab?.(e.target.value);
                  void setDataFlowMode('sql');
                }}
                className="h-6 px-1.5 rounded bg-monokai-surface border border-monokai-border text-xs text-monokai-fg font-mono outline-none cursor-pointer"
              >
                {tabs.map(tab => (
                  <option key={tab.id} value={tab.id}>
                    {tab.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {dataFlowMode === 'sql' && (
            <button
              type="button"
              onClick={() => setLiveSyncWithSql(!liveSyncWithSql)}
              className={`flex items-center gap-1 h-6 px-2 rounded text-meta font-mono border transition-colors cursor-pointer ${
                liveSyncWithSql
                  ? 'bg-monokai-accent/15 border-monokai-accent/30 text-monokai-accent'
                  : 'bg-monokai-surface/40 border-monokai-border text-monokai-comment'
              }`}
              title="打字时静默解析并平滑更新 DAG（绝不漂移焦点）"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${liveSyncWithSql ? 'bg-monokai-accent shadow-[0_0_5px_rgba(166,226,46,0.8)]' : 'bg-monokai-comment'}`} />
              <span className="hidden sm:inline">{liveSyncWithSql ? '实时联动: 开' : '实时联动: 关'}</span>
            </button>
          )}
        </div>

        {/* 右侧：动作按钮组 (布局 / 同步 / 编译 / 运行全流程) */}
        <div className="flex items-center gap-1.5 font-sans shrink-0">
          {/* 独立模式下快速切换至 SQL 工作台 */}
          {standalone && (
            <button
              type="button"
              onClick={() => {
                if (onSwitchToSqlEditor) {
                  onSwitchToSqlEditor();
                } else {
                  setActiveTab(Tab.SQL);
                }
              }}
              className="flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-colors cursor-pointer"
              title="进入 SQL 工作台"
            >
              <Code className="w-3.5 h-3.5 text-monokai-yellow" />
              <span className="hidden lg:inline">SQL 工作台</span>
            </button>
          )}

          {/* 分屏布局切换 (若提供) */}
          {!hideSubNav && !standalone && onChangeLayoutMode && (
            <div className="flex items-center rounded-md border border-monokai-border bg-monokai-surface p-0.5 mr-1">
              <button
                type="button"
                onClick={() => onChangeLayoutMode('editor')}
                className={`p-1 rounded text-xs cursor-pointer ${
                  layoutMode === 'editor' ? 'bg-monokai-accent/20 text-monokai-accent' : 'text-monokai-comment hover:text-monokai-fg'
                }`}
                title="纯编辑器模式"
              >
                <Code className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onChangeLayoutMode('split')}
                className={`p-1 rounded text-xs cursor-pointer ${
                  layoutMode === 'split' ? 'bg-monokai-accent/20 text-monokai-accent' : 'text-monokai-comment hover:text-monokai-fg'
                }`}
                title="分屏对照模式"
              >
                <Columns2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onChangeLayoutMode('canvas')}
                className={`p-1 rounded text-xs cursor-pointer ${
                  layoutMode === 'canvas' ? 'bg-monokai-accent/20 text-monokai-accent' : 'text-monokai-comment hover:text-monokai-fg'
                }`}
                title="全屏数据流模式"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleManualSyncFromSql}
            disabled={isSyncing}
            className="flex items-center gap-1 h-7 px-2 rounded-md bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-xs text-monokai-fg transition-colors cursor-pointer disabled:opacity-50"
            title="从当前 SQL 编辑器内容重新解析流图"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-monokai-accent' : 'text-monokai-comment'}`} />
            <span>从 SQL 同步</span>
          </button>

          <button
            type="button"
            onClick={handleCompileToSql}
            className="flex items-center gap-1 h-7 px-2 rounded-md bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-xs text-monokai-fg transition-colors cursor-pointer"
            title="将整幅画布逆向编译为一条完整带 CTE 的 SQL"
          >
            <ArrowRightLeft className="w-3 h-3 text-monokai-cyan" />
            <span>编译为 SQL</span>
          </button>

          {/* 核心主行动：运行全流程 */}
          <button
            type="button"
            onClick={runAll}
            disabled={isExecuting}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-monokai-accent text-monokai-bg hover:brightness-105 active:scale-95 text-xs font-semibold transition-all cursor-pointer shadow-sm disabled:opacity-50"
            title="依拓扑依赖顺序在 DuckDB 中执行当前流水线"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{isExecuting ? '执行中...' : '运行全流程'}</span>
          </button>
        </div>
      </div>

      {/* ── 主工作区：左侧资产栏 + 中央画布 + 右侧停靠属性面板 ── */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden relative">
        {/* React Flow 水印清理与 Handle 外观增强（不覆盖 left/right/transform 几何） */}
        <style>{`
          .react-flow__attribution {
            display: none !important;
          }
          /*
           * 关键：全局 [role=button]{position:relative} 会覆盖 RF 默认 absolute，
           * 导致节点按文档流堆叠，连线仍按 transform 计算 → 视觉上「连线接不上」。
           */
          .dataflow-reactflow-canvas .react-flow__node {
            position: absolute !important;
          }
          .dataflow-reactflow-canvas .react-flow__nodes {
            position: absolute !important;
            width: 100%;
            height: 100%;
            pointer-events: none;
            transform-origin: 0 0;
          }
          .dataflow-node-handle {
            transition: box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
          }
          .dataflow-node-handle:hover {
            box-shadow: 0 0 10px rgba(166, 226, 46, 0.9) !important;
            border-color: var(--monokai-fg) !important;
          }
          .react-flow__handle-connecting {
            box-shadow: 0 0 12px rgba(102, 217, 239, 0.95) !important;
          }
          .react-flow__handle-valid {
            box-shadow: 0 0 12px rgba(166, 226, 46, 0.95) !important;
            background-color: var(--monokai-accent) !important;
          }
          .react-flow__connection-path {
            stroke: var(--monokai-accent) !important;
            stroke-width: 2.5px !important;
            stroke-dasharray: 5 4;
            animation: dashdraw 0.5s linear infinite;
          }
          @keyframes dashdraw {
            from { stroke-dashoffset: 10; }
            to { stroke-dashoffset: 0; }
          }
          .dataflow-reactflow-canvas .react-flow__handle.dataflow-node-handle {
            box-shadow: 0 0 0 8px transparent;
          }
        `}</style>

        {/* 左侧：数据库表血缘树 + 算子面板（仅独立全屏下或自定义编排激活） */}
        {!isSplitMode && (
          <DataFlowAssetSidebar
            isCollapsed={isAssetSidebarCollapsed}
            onToggleCollapse={() => setIsAssetSidebarCollapsed(v => !v)}
          />
        )}

        {/* 中央：沉浸式 ReactFlow 画布 */}
        <div
          ref={reactFlowWrapper}
          onDragOver={onDragOver}
          onDrop={onDrop}
          className="relative flex-1 min-w-0 h-full bg-monokai-bg overflow-hidden"
        >
          {/* 画布悬浮视口工具岛 */}
          <CanvasToolbar
            showMiniMap={showMiniMap}
            onToggleMiniMap={() => setShowMiniMap(!showMiniMap)}
            isPanMode={isPanMode}
            onSetPanMode={setIsPanMode}
          />

          {/* 画布为空时的引导卡片 */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center select-none bg-monokai-bg">
              <div className="w-12 h-12 rounded-xl bg-monokai-surface border border-monokai-border flex items-center justify-center mb-3 text-monokai-accent shadow-xl">
                <Workflow className="w-6 h-6" />
              </div>
              <h3 className="text-xs font-semibold text-monokai-fg mb-1 font-mono tracking-tight">
                数据流画布就绪
              </h3>
              <p className="text-2xs text-monokai-comment max-w-md mb-1.5 leading-relaxed">
                从 SQL 工作台同步 CTE / JOIN 血缘，或拖入表与算子编排流水线。
              </p>
              <p className="text-2xs text-monokai-comment/80 max-w-sm mb-5 font-mono">
                连线协议：上节点右侧中点 → 下节点左侧中点
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onSwitchToSqlEditor) onSwitchToSqlEditor();
                    else setActiveTab(Tab.SQL);
                  }}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-monokai-accent text-monokai-bg font-semibold text-xs cursor-pointer hover:brightness-105"
                >
                  <Code className="w-3 h-3" />
                  <span>前往 SQL 工作台</span>
                </button>
                <button
                  type="button"
                  onClick={handleSwitchToCatalog}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-xs text-monokai-fg cursor-pointer"
                >
                  <Database className="w-3 h-3 text-monokai-cyan" />
                  <span>全库表血缘</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await resetToDefaultDemo();
                    toastService.success('已加载电商分析真实数据流');
                  }}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-xs text-monokai-yellow cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>加载演示流图</span>
                </button>
              </div>
            </div>
          )}

          <ReactFlow
            nodes={nodes.map(n => ({
              ...n,
              // 固定节点盒模型，确保 React Flow handleBounds 与视觉卡片 208×52 对齐
              width: 208,
              height: 52,
              style: { ...(typeof n.style === 'object' && n.style ? n.style : {}), width: 208, height: 52 },
              selected: n.id === selectedNodeId,
            }))}
            edges={edges.map(e => ({
              ...e,
              // 兜底：任何缺失句柄的边强制右中→左中协议
              sourceHandle: e.sourceHandle || 'output',
              targetHandle: e.targetHandle || e.data?.joinSide || 'input',
              selected: e.id === selectedEdgeId,
            }))}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            isValidConnection={isValidConnection}
            connectionMode={ConnectionMode.Loose}
            connectionRadius={28}
            connectionLineType={ConnectionLineType.SmoothStep}
            connectionLineStyle={{ stroke: 'var(--monokai-accent)', strokeWidth: 2.5 }}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{
              type: 'dataFlowEdge',
              sourceHandle: 'output',
              targetHandle: 'input',
            }}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2}
            panOnDrag={isPanMode}
            selectionOnDrag={!isPanMode}
            panOnScroll={false}
            nodesConnectable
            edgesUpdatable={false}
            className="dataflow-reactflow-canvas"
          >
            <svg style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, pointerEvents: 'none' }}>
              <defs>
                <marker
                  id="df-marker-default"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerUnits="strokeWidth"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--monokai-comment)" />
                </marker>
                <marker
                  id="df-marker-accent"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerUnits="strokeWidth"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--monokai-accent)" />
                </marker>
                <marker
                  id="df-marker-cyan"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerUnits="strokeWidth"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--monokai-cyan)" />
                </marker>
                <marker
                  id="df-marker-dimmed"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerUnits="strokeWidth"
                  markerWidth="5.5"
                  markerHeight="5.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--monokai-edge-muted)" />
                </marker>
              </defs>
            </svg>
            <Background
              variant={BackgroundVariant.Dots}
              gap={16}
              size={1}
              color="var(--monokai-elevated)"
            />
            {showMiniMap && (
              <MiniMap
                position="bottom-left"
                nodeColor={node => {
                  if (node.data?.status === 'error') return 'var(--monokai-pink)';
                  if (node.data?.status === 'success') return 'var(--monokai-accent)';
                  if (node.data?.type === 'join') return 'var(--monokai-pink)';
                  if (node.data?.type === 'aggregate') return 'var(--monokai-yellow)';
                  if (node.data?.type === 'source') return 'var(--monokai-cyan)';
                  return 'var(--monokai-purple)';
                }}
                nodeStrokeWidth={2}
                maskColor="rgba(24, 25, 22, 0.8)"
                className="!bg-monokai-surface !border !border-monokai-border !rounded-md !shadow-xl !m-3"
              />
            )}
          </ReactFlow>

          {/* 检查器收起状态下，若有选中节点，悬浮唤出胶囊 */}
          {!isInspectorOpen && selectedNodeId && (
            <button
              type="button"
              onClick={() => setIsInspectorOpen(true)}
              className="absolute right-3 top-3.5 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-monokai-border bg-monokai-surface/90 text-monokai-comment hover:text-monokai-accent hover:border-monokai-accent/40 shadow-lg backdrop-blur-md text-xs font-mono transition-all cursor-pointer select-none"
              title="查看已选节点的属性与数据预览"
            >
              <Sliders className="w-3.5 h-3.5 text-monokai-cyan" />
              <span>属性详情</span>
            </button>
          )}
        </div>

        {/* ── 右侧属性面板：独立模式为停靠推挤式，分屏模式智能降级为浮动抽屉 ── */}
        {isInspectorOpen && (
          isSplitMode ? (
            /* 分屏模式：降级为右上轻量浮动抽屉，避免挤扁画布 */
            <div className="absolute right-0 top-0 bottom-0 z-30 w-[320px] max-w-[85vw] h-full border-l border-monokai-border bg-monokai-surface/95 backdrop-blur-md shadow-2xl flex flex-col animate-in slide-in-from-right duration-150">
              <div className="flex items-center justify-between px-3 py-2 border-b border-monokai-border/80 bg-monokai-sidebar/80 text-xs">
                <span className="font-semibold text-monokai-fg flex items-center gap-1.5 font-mono">
                  <Sliders className="w-3.5 h-3.5 text-monokai-cyan" />
                  <span>节点详情</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsInspectorOpen(false)}
                  className="p-1 rounded hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg cursor-pointer"
                  title="收起检查器"
                >
                  <PanelRightClose className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <DataFlowInspector onOpenInSqlEditor={onOpenInSqlEditor} />
              </div>
            </div>
          ) : (
            /* 独立大屏模式：现代专业停靠式侧栏 (Docked Panel)，支持左边缘拖拽调整宽度 */
            <div
              style={{ width: `${inspectorWidth}px` }}
              className={`shrink-0 border-l border-monokai-border bg-monokai-surface flex flex-col h-full relative select-none ${
                isDraggingInspector ? 'select-none' : ''
              }`}
            >
              {/* 左边缘拖拽拉伸把手 */}
              <div
                onMouseDown={handleInspectorMouseDown}
                className="absolute -left-1.5 top-0 bottom-0 w-3 cursor-ew-resize z-30 group hover:bg-monokai-accent/10 transition-colors flex items-center justify-center"
                title="左右拖动调节面板宽度"
              >
                <div className="w-0.5 h-8 rounded bg-monokai-border group-hover:bg-monokai-accent transition-colors" />
              </div>

              {/* 顶部标题栏 */}
              <div className="flex h-9 shrink-0 items-center justify-between border-b border-monokai-border px-3 bg-monokai-sidebar/80 text-xs">
                <span className="font-semibold text-monokai-fg flex items-center gap-1.5 font-mono">
                  <Sliders className="w-3.5 h-3.5 text-monokai-cyan" />
                  <span>属性与执行配置</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsInspectorOpen(false)}
                  className="p-1 rounded hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg cursor-pointer"
                  title="折叠检查器面板"
                >
                  <PanelRightClose className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 检查器主体 */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <DataFlowInspector onOpenInSqlEditor={onOpenInSqlEditor} />
              </div>
            </div>
          )
        )}
      </div>

      {/* ── 底部可伸缩控制台抽屉（平时收拢为 28px 状态栏，可拖拽高度展开） ── */}
      <DataFlowBottomDrawer />
    </div>
  );
};

export const DataFlowCanvas: React.FC<DataFlowCanvasProps> = ({
  hideSubNav,
  standalone,
  initialMode,
  onSwitchToSqlEditor,
  onOpenInSqlEditor,
  activeSql,
  activeTabTitle,
  activeQueryResult,
  tabs,
  activeTabId,
  onSelectTab,
  layoutMode,
  onChangeLayoutMode,
}) => {
  return (
    <ReactFlowProvider>
      <DataFlowCanvasInner
        hideSubNav={hideSubNav}
        standalone={standalone}
        initialMode={initialMode}
        onSwitchToSqlEditor={onSwitchToSqlEditor}
        onOpenInSqlEditor={onOpenInSqlEditor}
        activeSql={activeSql}
        activeTabTitle={activeTabTitle}
        activeQueryResult={activeQueryResult}
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={onSelectTab}
        layoutMode={layoutMode}
        onChangeLayoutMode={onChangeLayoutMode}
      />
    </ReactFlowProvider>
  );
};
