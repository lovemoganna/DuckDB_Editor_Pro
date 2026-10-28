/**
 * DataFlowCanvas - 现代工业级数据流与 ETL 编排工作台
 *
 * 核心架构重构：
 * 1. 顶部单行高聚合顶栏 (36px)：整合模式切换、关联查询选择器、实时联动指示与核心动作组
 * 2. 布局对标【本体图谱-实体画布】：
 *    - 左侧：DataFlowAssetSidebar（独立全屏可用）
 *    - 中央：沉浸式 DAG 画布
 *    - 右侧：属性详情绝对覆盖抽屉（w-80 / backdrop-blur，与实体画布属性面板一致）
 *    - 底部：DataFlowBottomDrawer 折叠控制台
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { readableFlowViewport } from '../../services/dataflow/logicalFlowViewport';
import { LOGICAL_FLOW_LAYOUTS, type LogicalFlowLayoutMode } from '../../services/dataflow/logicalFlowLayout';
import { stripSqlHeader } from '../../services/sqlScript';
import ReactFlow, {
  Background,
  BackgroundVariant,
  useReactFlow,
  useViewport,
  useStore as useReactFlowStore,
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
  Workflow,
  Link2,
  Sigma,
  Upload,
  ChevronDown,
  AlertCircle,
  Pause,
  StepForward,
  SkipBack,
  X,
  Wrench,
} from 'lucide-react';

import { useWorkflowStore, wouldCreateCycle, type DataFlowMode } from '../../services/dataflow/workflowStore';
import {
  DATAFLOW_CENTER_NODE_EVENT,
  DATAFLOW_TRACE_FAULT_EVENT,
  dispatchFocusSqlEditor,
  type DataflowCenterNodeDetail,
  type DataflowTraceFaultDetail,
} from '../../services/dataflow/dataflowEvents';
import { DataFlowNode, DATAFLOW_NODE_CARD_WIDTH, DATAFLOW_NODE_CARD_HEIGHT } from './nodes/DataFlowNode';
import { DataFlowCustomEdge } from './edges/DataFlowCustomEdge';
import { DataFlowInspector } from './panels/DataFlowInspector';
import { DataFlowBottomDrawer } from './panels/DataFlowBottomDrawer';
import { DataFlowAssetSidebar } from './panels/DataFlowAssetSidebar';
import { Tab } from '../../types';
import { useAppStore } from '../../hooks/store/useAppStore';
import { toastService } from '../../services/toastService';
import { useConfirmDialog } from '../ui/ConfirmDialog';
import {
  dfBtnGhost,
  dfBtnPrimary,
  dfBtnSecondary,
  dfBtnWarn,
  dfDividerV,
  dfEmpty,
  dfEmptyHint,
  dfEmptyTitle,
  dfFaultBanner,
  dfIconBtn,
  dfIconBtnActive,
  dfMenuItem,
  dfMenuPanel,
  dfModePillActive,
  dfModePillGroup,
  dfModePillIdle,
  dfShell,
  dfStatusDot,
  dfStatusDotIdle,
  dfSyncBar,
  dfSyncBarFill,
  dfToolbarIsland,
} from './dataflowUi';

const nodeTypes = {
  dataFlowNode: DataFlowNode,
  logicalBoundary: ({ data }: { data: { title: string } }) => <div className="h-full w-full rounded-lg border border-monokai-border bg-monokai-bg/30 pointer-events-none"><div className="px-3 py-2 text-[10px] text-monokai-comment">{data.title}</div></div>,
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
  isSplitMode?: boolean;
}

const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  showMiniMap,
  onToggleMiniMap,
  isPanMode,
  onSetPanMode,
  isSplitMode = false,
}) => {
  const { zoomIn, zoomOut, fitView, getNodes, setViewport } = useReactFlow();
  const viewportWidth = useReactFlowStore(s => s.width);
  const viewportHeight = useReactFlowStore(s => s.height);
  const { zoom } = useViewport();
  const zoomLevel = Math.round(zoom * 100);
  const dataFlowMode = useWorkflowStore(s => s.dataFlowMode);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const autoLayout = useWorkflowStore(s => s.autoLayout);
  const sqlLayoutMode = useWorkflowStore(s => s.sqlLayoutMode);
  const setSqlLayoutMode = useWorkflowStore(s => s.setSqlLayoutMode);
  const addNode = useWorkflowStore(s => s.addNode);

  const handleZoomIn = () => zoomIn();
  const handleZoomOut = () => zoomOut();
  const handleFitView = () => fitView({ padding: 0.2, maxZoom: 1, duration: 400 });

  const handleAutoLayout = async () => {
    await autoLayout();
      if (dataFlowMode === 'sql') {
        const viewport = readableFlowViewport(getNodes(), viewportWidth, viewportHeight);
        if (viewport) setViewport(viewport, { duration: 350 });
      } else fitView({ padding: 0.2, maxZoom: 1, duration: 350 });
      toastService.success('已自动优化并对齐 DAG 拓扑布局');
  };
  const handleLayoutChange = async (mode: LogicalFlowLayoutMode) => {
    await setSqlLayoutMode(mode);
    const state = useWorkflowStore.getState();
    if (state.dataFlowMode !== 'sql' || state.sqlLayoutMode !== mode) return;
    const viewport = readableFlowViewport(state.nodes, viewportWidth, viewportHeight);
    if (viewport) setViewport(viewport, { duration: 0 });
  };

  useEffect(() => {
    if (!showAddMenu) return;
    const onDocClick = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAddMenu(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showAddMenu]);

  const addOperator = (
    type: 'source' | 'schema' | 'sql_transform' | 'join' | 'aggregate' | 'result' | 'export',
    label: string,
  ) => {
    addNode(type);
    setShowAddMenu(false);
    toastService.success(`已添加「${label}」`);
  };

  return (
    <div
      className={`absolute ${
        isSplitMode ? 'bottom-3.5 left-3 z-20' : 'left-4 top-3.5 z-20'
      } ${dfToolbarIsland}`}
    >
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

      <button type="button" onClick={handleZoomOut} className={dfIconBtn} title="缩小画布">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="px-1 text-meta text-monokai-fg min-w-[38px] text-center font-mono">
        {zoomLevel}%
      </span>
      <button type="button" onClick={handleZoomIn} className={dfIconBtn} title="放大画布">
        <Plus className="h-3.5 w-3.5" />
      </button>

      <div className={dfDividerV} />

      <button type="button" onClick={handleFitView} className={dfIconBtn} title="全图自适应居中 (Fit View)">
        <Scan className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={handleAutoLayout} className={dfIconBtn} title="智能分层拓扑整理布局">
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
      {dataFlowMode === 'sql' && (
        <select
          aria-label="流程图布局"
          title="切换流程图布局"
          value={sqlLayoutMode}
          onChange={event => void handleLayoutChange(event.target.value as LogicalFlowLayoutMode)}
          className="h-7 max-w-[82px] rounded border border-monokai-border bg-monokai-bg px-1 text-[11px] text-monokai-fg focus:outline-none focus:ring-1 focus:ring-monokai-accent"
        >
          {LOGICAL_FLOW_LAYOUTS.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
        </select>
      )}
      <button
        type="button"
        onClick={onToggleMiniMap}
        className={showMiniMap ? dfIconBtnActive : dfIconBtn}
        title="切换全景小地图 (MiniMap)"
      >
        <Map className="h-3.5 w-3.5" />
      </button>

      {!isSplitMode && dataFlowMode === 'custom' && (
        <>
          <div className={dfDividerV} />
          <div className="relative" ref={addMenuRef}>
            <button
              type="button"
              onClick={() => setShowAddMenu(!showAddMenu)}
              className={`${dfBtnPrimary} !h-6 !px-1.5 !text-2xs`}
              title="在画布中快速添加算子节点"
              aria-expanded={showAddMenu}
              aria-haspopup="menu"
            >
              <Plus className="h-3 w-3" />
              <span>加算子</span>
              <ChevronDown className={`h-2.5 w-2.5 opacity-70 transition-transform duration-150 ${showAddMenu ? 'rotate-180' : ''}`} />
            </button>
            {showAddMenu && (
              <div role="menu" className={`${dfMenuPanel} left-0 top-full w-44`}>
                <button type="button" role="menuitem" onClick={() => addOperator('source', '数据源')} className={dfMenuItem}>
                  <Database className="h-3.5 w-3.5 text-monokai-cyan shrink-0" />
                  <span>数据源</span>
                </button>
                <button type="button" role="menuitem" onClick={() => addOperator('schema', 'Schema 检验')} className={dfMenuItem}>
                  <Table className="h-3.5 w-3.5 text-monokai-amethyst shrink-0" />
                  <span>Schema 检验</span>
                </button>
                <button type="button" role="menuitem" onClick={() => addOperator('sql_transform', 'SQL 转换')} className={dfMenuItem}>
                  <Code className="h-3.5 w-3.5 text-monokai-amethyst shrink-0" />
                  <span>SQL 转换</span>
                </button>
                <button type="button" role="menuitem" onClick={() => addOperator('join', '表连接')} className={dfMenuItem}>
                  <Link2 className="h-3.5 w-3.5 text-monokai-pink shrink-0" />
                  <span>表连接 (Join)</span>
                </button>
                <button type="button" role="menuitem" onClick={() => addOperator('aggregate', '聚合统计')} className={dfMenuItem}>
                  <Sigma className="h-3.5 w-3.5 text-monokai-yellow shrink-0" />
                  <span>聚合统计 (GroupBy)</span>
                </button>
                <button type="button" role="menuitem" onClick={() => addOperator('result', '结果表')} className={dfMenuItem}>
                  <Table className="h-3.5 w-3.5 text-monokai-cyan shrink-0" />
                  <span>结果表 (Result)</span>
                </button>
                <button type="button" role="menuitem" onClick={() => addOperator('export', '导出数据')} className={dfMenuItem}>
                  <Upload className="h-3.5 w-3.5 text-monokai-cyan shrink-0" />
                  <span>导出文件 (Export)</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export interface DataFlowCanvasProps {
  hideSubNav?: boolean;
  standalone?: boolean;
  initialMode?: DataFlowMode;
  initialFocusTable?: string;
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
  initialFocusTable,
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
    cancelSqlRun,
    deleteNode,
    deleteEdge,
    addNode,
    addSourceNodeForTable,
    autoLayout,
    isExecuting,
    liveSyncWithSql,
    stepperState,
    startStepping,
    stopStepping,
    stepNext,
    stepPrev,
    setStepIndex,
    togglePlayStepping,
    isReverseTracing,
    traceReverseLineage,
    clearLineageTrace,
    setInspectorTab,
    syncStatus,
    lastSyncError,
    logicalFlowData,
    focusFaultyNode,
  } = useWorkflowStore();

  const { setActiveTab } = useAppStore();
  const { confirm } = useConfirmDialog();
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showMiniMap, setShowMiniMap] = useState<boolean>(false);
  const [isPanMode, setIsPanMode] = useState<boolean>(false);
  const [showToolsMenu, setShowToolsMenu] = useState<boolean>(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  // 右侧属性抽屉：默认收起，选中节点后再打开（与实体画布属性侧栏一致，覆盖而非挤占画布）
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);

  // 左侧资产栏：默认折叠；自由编排模式自动展开，SQL/血缘模式自动收起
  const [isAssetSidebarCollapsed, setIsAssetSidebarCollapsed] = useState<boolean>(true);
  const prevDataFlowModeRef = useRef<DataFlowMode | null>(null);
  const lastCenteredNodeRef = useRef<string | null>(null);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

  // Fit only when the graph's membership or mode changes, never on a field edit or drag.
  const graphMembership = nodes.map(n => n.id).join('|');
  const graphGeometry = nodes.map(n => `${n.id}:${n.position.x}:${n.position.y}:${n.style?.width}:${n.style?.height}`).join('|');
  const showReadableFlow = useCallback(() => {
    const element = reactFlowWrapper.current;
    if (useWorkflowStore.getState().dataFlowMode !== 'sql' || !element) {
      reactFlowInstance.fitView({ padding: .2, maxZoom: 1, duration: 250 });
      return;
    }
    const viewport = readableFlowViewport(useWorkflowStore.getState().nodes, element.clientWidth, element.clientHeight);
    if (viewport) reactFlowInstance.setViewport(viewport, { duration: 0 });
  }, [reactFlowInstance]);
  useEffect(() => {
    if (!graphMembership) return;
    const timer = window.setTimeout(() => {
      showReadableFlow();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [graphMembership, graphGeometry, dataFlowMode, showReadableFlow]);

  useEffect(() => {
    const element = reactFlowWrapper.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const store = useWorkflowStore.getState();
        const width = Math.round(element.clientWidth);
        if (width > 0 && Math.abs(store.canvasWidth - width) > 16) {
          useWorkflowStore.setState({ canvasWidth: width });
          if (store.dataFlowMode === 'sql' && store.logicalFlowData) store.autoLayout();
        }
        showReadableFlow();
      });
    });
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [showReadableFlow]);

  const hasBugOrAnomaly = useMemo(() => {
    return nodes.some(n => n.data.bugInfo?.hasBug || n.data.status === 'error' || n.data.hasAnomaly);
  }, [nodes]);

  const faultNode = useMemo(() => {
    return nodes.find(n => n.data.bugInfo?.hasBug || n.data.status === 'error' || n.data.hasAnomaly) || null;
  }, [nodes]);

  const showSyncProgress = isSyncing || syncStatus === 'syncing';

  const centerOnNode = useCallback(
    (nodeId: string, zoom = 1.15, duration = 500) => {
      const target = nodes.find(n => n.id === nodeId);
      if (!target || typeof reactFlowInstance?.setCenter !== 'function') return;
      reactFlowInstance.setCenter(
        target.position.x + DATAFLOW_NODE_CARD_WIDTH / 2,
        target.position.y + DATAFLOW_NODE_CARD_HEIGHT / 2,
        { zoom, duration }
      );
      lastCenteredNodeRef.current = nodeId;
    },
    [nodes, reactFlowInstance]
  );

  const handleTraceBug = useCallback(() => {
    const focusedId = focusFaultyNode(faultNode?.id || null);
    if (focusedId) {
      centerOnNode(focusedId);
      setIsInspectorOpen(true);
      setInspectorTab('config');
      const title = nodes.find(n => n.id === focusedId)?.data?.title || '步骤';
      toastService.info(`已定位并聚焦至异常点：「${title}」`);
    } else {
      toastService.info('当前 SQL 流水线未检测到错误或异常点位');
    }
  }, [focusFaultyNode, faultNode, centerOnNode, nodes, setInspectorTab]);

  // 统一溯源事件：结果区 CTA / store 执行失败后触发相机 + Inspector
  useEffect(() => {
    const onTraceFault = (ev: Event) => {
      const detail = (ev as CustomEvent<DataflowTraceFaultDetail>).detail || {};
      const nodeId =
        detail.nodeId ||
        nodes.find(n => n.data.bugInfo?.hasBug || n.data.status === 'error' || n.data.hasAnomaly)?.id;
      if (!nodeId) return;

      const target = nodes.find(n => n.id === nodeId);
      if (!target) return;

      selectNode(nodeId);
      if (detail.centerOnly) {
        if (lastCenteredNodeRef.current !== nodeId) {
          centerOnNode(nodeId, 1.05, 350);
        }
        return;
      }

      centerOnNode(nodeId);
      if (detail.openInspector !== false) {
        setIsInspectorOpen(true);
        setInspectorTab('config');
      }
      if (detail.focusSql !== false && target.data.sqlRange) {
        dispatchFocusSqlEditor({ sqlRange: target.data.sqlRange });
      }
    };

    window.addEventListener(DATAFLOW_TRACE_FAULT_EVENT, onTraceFault as EventListener);
    return () => window.removeEventListener(DATAFLOW_TRACE_FAULT_EVENT, onTraceFault as EventListener);
  }, [nodes, selectNode, centerOnNode, setInspectorTab]);

  // 单步推演：激活节点发生变化时，平滑居中聚焦画布
  useEffect(() => {
    if (!stepperState.isActive || !stepperState.activeNodeId) return;
    const targetNode = nodes.find(n => n.id === stepperState.activeNodeId);
    if (targetNode && typeof reactFlowInstance?.setCenter === 'function') {
      reactFlowInstance.setCenter(targetNode.position.x + 104, targetNode.position.y + 26, {
        zoom: 1.15,
        duration: 400,
      });
    }
  }, [stepperState.isActive, stepperState.activeNodeId, nodes, reactFlowInstance]);

  // 点击菜单外部关闭「工具」
  useEffect(() => {
    if (!showToolsMenu) return;
    const onDocClick = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setShowToolsMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showToolsMenu]);

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
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && dataFlowMode === 'custom') {
        if (selectedNodeId) {
          e.preventDefault();
          const nodeTitle =
            nodes.find(n => n.id === selectedNodeId)?.data?.title || '选中节点';
          void (async () => {
            const ok = await confirm({
              title: '删除节点？',
              message: `将从画布移除「${nodeTitle}」及其相关连线，此操作不可撤销。`,
              confirmText: '删除',
              cancelText: '取消',
              variant: 'danger',
            });
            if (!ok) return;
            deleteNode(selectedNodeId);
            setIsInspectorOpen(false);
            toastService.info('已从画布中删除选中节点');
          })();
        } else if (selectedEdgeId) {
          e.preventDefault();
          void (async () => {
            const ok = await confirm({
              title: '删除连线？',
              message: '将移除选中的数据依赖连线，此操作不可撤销。',
              confirmText: '删除',
              cancelText: '取消',
              variant: 'danger',
            });
            if (!ok) return;
            deleteEdge(selectedEdgeId);
            setSelectedEdgeId(null);
            toastService.info('已从画布中删除选中连线');
          })();
        }
      } else if (e.key === 'Escape') {
        selectNode(null);
        setSelectedEdgeId(null);
        setIsInspectorOpen(false);
        setShowToolsMenu(false);
        if (!useWorkflowStore.getState().executionSqlRange) useWorkflowStore.setState({ activeSqlRange: null });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedEdgeId, deleteNode, deleteEdge, selectNode, nodes, confirm, dataFlowMode]);

  // 分屏模式：出现异常时强制打开诊断；异常清除后不强制关闭（尊重用户手动打开）
  useEffect(() => {
    if (layoutMode !== 'split') return;
    if (hasBugOrAnomaly) {
      setIsInspectorOpen(true);
      setInspectorTab('config');
    }
  }, [layoutMode, hasBugOrAnomaly, setInspectorTab]);

  // Inspector 上下游跳转：选中 + 居中 + 保持面板打开
  useEffect(() => {
    const onCenter = (ev: Event) => {
      const detail = (ev as CustomEvent<DataflowCenterNodeDetail>).detail;
      if (!detail?.nodeId) return;
      selectNode(detail.nodeId);
      centerOnNode(detail.nodeId, detail.zoom ?? 1.1, 350);
      if (detail.openInspector !== false) {
        setIsInspectorOpen(true);
        setInspectorTab('config');
      }
    };
    window.addEventListener(DATAFLOW_CENTER_NODE_EVENT, onCenter as EventListener);
    return () => window.removeEventListener(DATAFLOW_CENTER_NODE_EVENT, onCenter as EventListener);
  }, [selectNode, centerOnNode, setInspectorTab]);

  // 模式切换时自动收/展左侧资产栏：自由编排需要拖拽算子，其余模式让出画布
  useEffect(() => {
    const prev = prevDataFlowModeRef.current;
    prevDataFlowModeRef.current = dataFlowMode;
    // 首次挂载也按模式对齐；仅在模式变化或首次时调整
    if (prev === dataFlowMode && prev !== null) return;
    setIsAssetSidebarCollapsed(dataFlowMode !== 'custom');
  }, [dataFlowMode]);

  // Sole driver: current editor SQL → parse → replace graph. Never keep a static copy.
  const lastSyncedSqlRef = useRef<string | null>(null);
  const isSplitWorkbench = layoutMode === 'split';

  // Catalog deep links initialize once; later explicit mode choices remain authoritative.
  useEffect(() => {
    if (standalone && initialMode === 'catalog') {
      void setDataFlowMode('catalog', initialFocusTable);
    }
  }, [standalone, initialMode, initialFocusTable, setDataFlowMode]);

  useEffect(() => {
    // Explicit modes survive editor content changes; only split view is always SQL-driven.
    if (isSplitWorkbench) {
      if (dataFlowMode !== 'sql' || !liveSyncWithSql) {
        useWorkflowStore.setState({ dataFlowMode: 'sql', liveSyncWithSql: true });
      }
    } else if (dataFlowMode !== 'sql' || !liveSyncWithSql) {
      return;
    }

    const sql = activeSql || '';
    const normalized = sql;

    if (
      lastSyncedSqlRef.current === normalized &&
      useWorkflowStore.getState().activeSql === normalized &&
      useWorkflowStore.getState().syncStatus === 'ready' &&
      (normalized === ''
        ? useWorkflowStore.getState().nodes.length === 0
        : useWorkflowStore.getState().nodes.length > 0)
    ) {
      return;
    }

    // When SQL changes, set syncing status without blanking existing nodes (double-buffering)
    if (lastSyncedSqlRef.current !== null && lastSyncedSqlRef.current !== normalized) {
      if (normalized === '') {
        useWorkflowStore.setState({
          nodes: [],
          edges: [],
          selectedNodeId: null,
          activeSqlRange: null,
          syncStatus: 'idle',
        });
      } else {
        useWorkflowStore.setState({
          syncStatus: 'syncing',
        });
      }
    }

    const timer = setTimeout(() => {
      lastSyncedSqlRef.current = normalized;
      if(useWorkflowStore.getState().activeSql!==sql||useWorkflowStore.getState().syncStatus!=='ready')void syncFromSql(sql, activeTabTitle, false);
    }, 180);

    return () => clearTimeout(timer);
  }, [
    activeSql,
    activeTabTitle,
    liveSyncWithSql,
    dataFlowMode,
    syncFromSql,
    syncFromCatalog,
    standalone,
    initialMode,
    isSplitWorkbench,
  ]);

  // Decorate graph with execution metrics only when a new result arrives —
  // never re-apply an old result just because the editor SQL changed.
  useEffect(() => {
    if (useWorkflowStore.getState().dataFlowMode === 'sql') return;
    if (!activeQueryResult || (!isSplitWorkbench && useWorkflowStore.getState().dataFlowMode !== 'sql')) return;
    const editorSql = (activeSql || '').trim();
    let cancelled = false;
    let fitTimer: ReturnType<typeof setTimeout> | undefined;
    void syncExecutionResult(activeTabTitle, activeQueryResult, editorSql || undefined).then(() => {
      if (cancelled) return;
      // Profiling can replace positions while retaining node IDs. Fit after the actual update.
      fitTimer = setTimeout(() => {
        if (!cancelled) reactFlowInstance.fitView({ padding: 0.2, maxZoom: 1, duration: 250 });
      }, 100);
    });
    return () => { cancelled = true; if (fitTimer) clearTimeout(fitTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally ignore activeSql edits
  }, [activeQueryResult?.resultId, activeTabTitle, syncExecutionResult]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      selectNode(node.id);
      setSelectedEdgeId(null);
      setIsInspectorOpen(true);
      setInspectorTab('config');
      if (node.data?.sqlRange && !useWorkflowStore.getState().executionSqlRange) {
        useWorkflowStore.setState({ activeSqlRange: node.data.sqlRange });
        dispatchFocusSqlEditor({ sqlRange: node.data.sqlRange });
      }
    },
    [selectNode, setInspectorTab]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
    setSelectedEdgeId(null);
    setIsInspectorOpen(false);
    setShowToolsMenu(false);
    if (!useWorkflowStore.getState().executionSqlRange) useWorkflowStore.setState({ activeSqlRange: null });
  }, [selectNode]);

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_, edge) => {
      setSelectedEdgeId(edge.id);
      selectNode(null);
      // 点连线时收起空检查器，避免右侧空白占位
      setIsInspectorOpen(false);
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

    // 检查拓扑有向环与端点类型合法性
    const isReversed =
      connection.sourceHandle === 'input' ||
      connection.sourceHandle === 'left' ||
      connection.sourceHandle === 'right' ||
      connection.targetHandle === 'output';

    const fromId = isReversed ? connection.target : connection.source;
    const toId = isReversed ? connection.source : connection.target;

    const fromNode = nodes.find(n => n.id === fromId);
    const toNode = nodes.find(n => n.id === toId);
    if (fromNode?.data.type === 'export' || toNode?.data.type === 'source') {
      return false;
    }

    return !wouldCreateCycle(fromId, toId, edges);
  }, [edges, nodes]);

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
    e.dataTransfer.dropEffect = dataFlowMode === 'custom' ? 'copy' : 'none';
  }, [dataFlowMode]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (dataFlowMode !== 'custom') return;
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
  }, [getFlowCoordinates, addSourceNodeForTable, addNode, dataFlowMode]);

  // 手动从当前 SQL 同步
  const handleManualSyncFromSql = async () => {
    if (!stripSqlHeader(activeSql)) {
      toastService.info('SQL 工作台中暂无查询内容');
      return;
    }
    setIsSyncing(true);
    try {
      await syncFromSql(activeSql, activeTabTitle, true);
      const err = useWorkflowStore.getState().lastSyncError;
      if (err) {
        toastService.error(`同步失败: ${err}`);
      } else {
        toastService.success(`已重新解析生成执行路径: ${activeTabTitle}`);
      }
    } catch (e: any) {
      toastService.error(`解析失败: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // 切换到全库血缘
  const handleSwitchToCatalog = async () => {
    setIsSyncing(true);
    try {
      await setDataFlowMode('catalog');
      toastService.info('已同步 DuckDB 全库表与视图依赖血缘');
    } catch (err) {
      toastService.error(`血缘同步失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setIsSyncing(false); }
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
    <div className={`${dfShell} ${isSplitMode ? 'dataflow-split' : ''}`}>
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

      {/* ── 统一现代化单行高聚合顶栏 (高度严格收敛为 36px) ── */}
      <div className="dataflow-topbar flex flex-wrap shrink-0 items-center justify-between border-b border-monokai-border bg-monokai-sidebar px-3 py-1 z-30 select-none gap-2 min-h-9">
        {/* 左侧：工作流标识 + 驱动模式切换胶囊 */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 pr-2 border-r border-monokai-border/80">
            <Workflow className="w-3.5 h-3.5 text-monokai-accent" />
            <span className="font-mono text-xs font-bold text-monokai-fg tracking-tight hidden sm:inline">
              SQL 流程图
            </span>
          </div>

          {/* 模式选择胶囊：全屏模式支持 3 模态切换，分屏模式收敛为专注执行计划 */}
          {!isSplitMode ? (
            <div className={dfModePillGroup}>
              <button
                type="button"
                onClick={async () => {
                  await setDataFlowMode('sql');
                  if (activeSql) await syncFromSql(activeSql, activeTabTitle, true);
                }}
                aria-pressed={dataFlowMode === 'sql'}
                className={dataFlowMode === 'sql' ? dfModePillActive : dfModePillIdle}
                title="当前 SQL 查询逻辑流程图 (CTE / JOIN / GROUP BY)"
              >
                <FileCode2 className="w-3 h-3" />
                <span>当前 SQL 流图</span>
              </button>

              <button
                type="button"
                onClick={handleSwitchToCatalog}
                aria-pressed={dataFlowMode === 'catalog'}
                className={
                  dataFlowMode === 'catalog'
                    ? 'flex items-center gap-1 px-2 py-0.5 rounded bg-monokai-elevated text-monokai-cyan font-semibold shadow-xs cursor-pointer'
                    : dfModePillIdle
                }
                title="全库表与视图依赖血缘"
              >
                <Database className="w-3 h-3" />
                <span>全库表与视图血缘</span>
              </button>

              <button
                type="button"
                onClick={() => setDataFlowMode('custom')}
                aria-pressed={dataFlowMode === 'custom'}
                className={
                  dataFlowMode === 'custom'
                    ? 'flex items-center gap-1 px-2 py-0.5 rounded bg-monokai-elevated text-monokai-yellow font-semibold shadow-xs cursor-pointer'
                    : dfModePillIdle
                }
                title="自由编排模式：从左侧资产栏自由拖放算子"
              >
                <Layers className="w-3 h-3" />
                <span>自由编排</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-monokai-surface/80 border border-monokai-border/60 text-3xs font-mono text-monokai-accent font-semibold">
              <Zap className="w-3 h-3 text-monokai-accent" />
              <span>Logical Relation Flow</span>
            </div>
          )}
        </div>

        {/* 中部：关联查询切换与健康/流向概览 */}
        <div className="flex items-center gap-2 shrink-0">
          {tabs && tabs.length > 0 && (
            <div className="flex items-center gap-1 font-mono text-2xs">
              <span className="text-monokai-comment font-normal hidden md:inline">关联:</span>
              <select
                aria-label="关联查询"
                value={activeTabId}
                onChange={e => {
                  onSelectTab?.(e.target.value);
                  void setDataFlowMode('sql');
                }}
                className="h-6 px-1.5 rounded-md bg-monokai-surface/90 border border-monokai-border text-2xs text-monokai-fg font-mono outline-none cursor-pointer hover:border-monokai-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent/60 transition-colors"
              >
                {tabs.map(tab => (
                  <option key={tab.id} value={tab.id}>
                    {tab.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(dataFlowMode === 'sql' || isSplitWorkbench) && (
            <div
              className="flex items-center gap-1 h-6 px-1.5 rounded text-2xs font-mono text-monokai-accent"
              title="流程图始终由当前编辑器 SQL 实时生成"
            >
              <span className={dfStatusDot} />
              <span className="hidden sm:inline">SQL 实时驱动</span>
            </div>
          )}

          {nodes.length > 0 && (
            <div className="hidden lg:flex items-center gap-1 px-2 py-0.5 rounded bg-monokai-surface/50 border border-monokai-border/40 text-3xs font-mono text-monokai-comment">
              <span>{nodes.filter(n=>n.type!=='logicalBoundary').length} 逻辑节点</span>
              <span>·</span>
              <span>
                {nodes.some(n => n.data.executionTimeSec !== undefined) ? `${nodes.reduce((sum, n) => sum + (n.data.executionTimeSec ?? 0) * 1000, 0).toFixed(1)}ms` : '耗时未采集'}
              </span>
            </div>
          )}
        </div>

        {/* 右侧：动作控制中心（主次分明：主运行/定位醒目，辅助工具收敛） */}
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
              className={dfBtnGhost}
              title="进入 SQL 工作台"
            >
              <Code className="w-3 h-3 text-monokai-yellow" />
              <span className="hidden lg:inline">SQL 工作台</span>
            </button>
          )}

          {/* 布局切换：分屏 / 全屏画布 / 回编辑器（Workbench 挂载时可用） */}
          {onChangeLayoutMode && (
            <div className="flex items-center rounded border border-monokai-border/70 bg-monokai-surface/60 p-0.5 mr-0.5">
              <button
                type="button"
                onClick={() => onChangeLayoutMode('editor')}
                className={`p-1 rounded text-2xs cursor-pointer ${
                  layoutMode === 'editor' ? 'bg-monokai-elevated text-monokai-accent' : 'text-monokai-comment hover:text-monokai-fg'
                }`}
                title="纯编辑器模式"
              >
                <Code className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onChangeLayoutMode('split')}
                className={`p-1 rounded text-2xs cursor-pointer ${
                  layoutMode === 'split' ? 'bg-monokai-elevated text-monokai-accent' : 'text-monokai-comment hover:text-monokai-fg'
                }`}
                title="分屏对照模式"
              >
                <Columns2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onChangeLayoutMode('canvas')}
                className={`p-1 rounded text-2xs cursor-pointer ${
                  layoutMode === 'canvas' ? 'bg-monokai-elevated text-monokai-accent' : 'text-monokai-comment hover:text-monokai-fg'
                }`}
                title="全屏数据流模式"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* 学习与诊断工具：收纳进溢出菜单，避免与「运行 / 同步」抢视线 */}
          {!isSplitMode && (
            <div className="relative" ref={toolsMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setShowToolsMenu(v => !v);
                }}
                className={`flex items-center gap-1 h-7 px-2 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
                  showToolsMenu || stepperState.isActive
                    ? 'bg-monokai-elevated border-monokai-accent/50 text-monokai-accent'
                    : 'bg-monokai-surface/70 border-monokai-border text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated'
                }`}
                title="工具：单步推演、编译为 SQL"
                aria-expanded={showToolsMenu}
                aria-haspopup="menu"
              >
                <Wrench className="w-3 h-3" />
                <span className="hidden sm:inline">工具</span>
                <ChevronDown className={`w-2.5 h-2.5 opacity-70 transition-transform ${showToolsMenu ? 'rotate-180' : ''}`} />
              </button>

              {showToolsMenu && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 w-56 rounded-lg border border-monokai-border bg-monokai-surface p-1 shadow-2xl backdrop-blur-md z-50 text-xs flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 font-sans"
                >
                  <div className="px-2 py-1 text-2xs font-semibold text-monokai-comment border-b border-monokai-border/60 mb-0.5">
                    工具
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    disabled={nodes.length === 0 || dataFlowMode === 'sql'}
                    onClick={() => {
                      if (stepperState.isActive) {
                        stopStepping();
                      } else {
                        startStepping();
                      }
                      setShowToolsMenu(false);
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-monokai-fg hover:bg-monokai-elevated transition-colors text-left cursor-pointer"
                  >
                    <Zap className={`w-3.5 h-3.5 shrink-0 ${stepperState.isActive ? 'text-monokai-yellow' : 'text-monokai-comment'}`} />
                    <span className="flex-1">{stepperState.isActive ? '退出单步推演' : '单步推演'}</span>
                    {stepperState.isActive && (
                      <span className="text-2xs text-monokai-yellow font-mono">进行中</span>
                    )}
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    disabled={nodes.length === 0}
                    onClick={() => {
                      handleCompileToSql();
                      setShowToolsMenu(false);
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-monokai-fg hover:bg-monokai-elevated transition-colors text-left cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-monokai-cyan shrink-0" />
                    <span>编译为 SQL</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {!isSplitMode && <div className="w-px h-3.5 bg-monokai-border/80 mx-0.5" />}

          {/* 异常快速溯源 (高信号报警) */}
          {hasBugOrAnomaly && (
            <button
              type="button"
              onClick={handleTraceBug}
              data-testid="dataflow-trace-bug-btn"
              className={dfBtnWarn}
              title="一键平滑定位并聚焦到异常步骤节点"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{isSplitMode ? '溯源异常' : '快速溯源 Bug'}</span>
            </button>
          )}

          {/* 结果反向溯源：分屏降噪，仅全屏展示 */}
          {!isSplitMode && nodes.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (isReverseTracing) {
                  clearLineageTrace();
                } else {
                  traceReverseLineage(selectedNodeId || undefined);
                }
              }}
              className={`${dfBtnSecondary} ${
                isReverseTracing
                  ? '!bg-monokai-cyan/20 !border-monokai-cyan !text-monokai-cyan font-semibold'
                  : ''
              }`}
              title="从最终结果/选中节点一键反向追溯至底层原始数据源 (RESULT ← ... ← SCAN)"
            >
              <ArrowRightLeft className={`w-3.5 h-3.5 ${isReverseTracing ? 'text-monokai-cyan' : 'text-monokai-comment'}`} />
              <span className="hidden md:inline">{isReverseTracing ? '退出追溯' : '反向追溯'}</span>
            </button>
          )}

          {/* Mode-specific synchronization never replaces a custom workflow. */}
          {dataFlowMode === 'catalog' && <button type="button" onClick={handleSwitchToCatalog} disabled={showSyncProgress} className={dfBtnSecondary}><RefreshCw className="w-3 h-3" />刷新血缘</button>}
          {(dataFlowMode === 'sql' || isSplitMode) && <button
            type="button"
            onClick={handleManualSyncFromSql}
            disabled={showSyncProgress}
            className={dfBtnSecondary}
            title="从当前 SQL 编辑器内容重新解析执行路径"
          >
            <RefreshCw className={`w-3 h-3 ${showSyncProgress ? 'animate-spin text-monokai-accent' : 'text-monokai-comment'}`} />
            <span>{showSyncProgress ? '同步中...' : '从 SQL 同步'}</span>
          </button>}

          {/* 核心主行动：运行全流程（分屏以 SQL 执行为主，隐藏画布跑批） */}
          {!isSplitMode && (<>
            <button
              type="button"
              onClick={runAll}
              disabled={isExecuting || nodes.length === 0 || dataFlowMode === 'catalog'}
              className={dfBtnPrimary}
              title="依拓扑依赖顺序在 DuckDB 中执行当前流水线"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{isExecuting ? '执行中...' : '运行全流程'}</span>
            </button>
            {dataFlowMode==='sql'&&isExecuting&&<button type="button" onClick={cancelSqlRun} className={dfBtnSecondary}>停止脚本</button>}
          </>)}
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
            box-shadow: 0 0 10px color-mix(in srgb, var(--monokai-accent) 90%, transparent) !important;
            border-color: var(--monokai-fg) !important;
          }
          .react-flow__handle-connecting {
            box-shadow: 0 0 12px color-mix(in srgb, var(--monokai-cyan) 95%, transparent) !important;
          }
          .react-flow__handle-valid {
            box-shadow: 0 0 12px color-mix(in srgb, var(--monokai-accent) 95%, transparent) !important;
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
          {/* 同步进度条 */}
          {showSyncProgress && (
            <div className={dfSyncBar} data-testid="dataflow-sync-bar" aria-label="正在同步执行路径">
              <div className={dfSyncBarFill} />
            </div>
          )}

          {/* 画布悬浮视口工具岛 */}
          <CanvasToolbar
            showMiniMap={showMiniMap}
            onToggleMiniMap={() => setShowMiniMap(!showMiniMap)}
            isPanMode={isPanMode}
            onSetPanMode={setIsPanMode}
            isSplitMode={isSplitMode}
          />

          {/* 异常条：Inspector 未开时仍可完成「查看诊断 / 回 SQL」 */}
          {hasBugOrAnomaly && faultNode && !isInspectorOpen && !isReverseTracing && (
            <div className={dfFaultBanner} data-testid="dataflow-fault-banner" role="status">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-monokai-pink" />
              <span className="min-w-0 flex-1 truncate text-monokai-pink font-semibold">
                {faultNode.data.title || '异常算子'}
                {faultNode.data.bugInfo?.title ? ` · ${faultNode.data.bugInfo.title}` : ''}
              </span>
              <button
                type="button"
                onClick={() => {
                  selectNode(faultNode.id);
                  setIsInspectorOpen(true);
                  setInspectorTab('config');
                  centerOnNode(faultNode.id);
                }}
                className="shrink-0 rounded px-1.5 py-0.5 text-monokai-fg hover:bg-monokai-elevated cursor-pointer"
              >
                查看诊断
              </button>
              {faultNode.data.sqlRange && (
                <button
                  type="button"
                  onClick={() => {
                    useWorkflowStore.setState({ activeSqlRange: faultNode.data.sqlRange || null });
                    dispatchFocusSqlEditor({ sqlRange: faultNode.data.sqlRange });
                    toastService.info(`已定位 SQL 第 ${faultNode.data.sqlRange!.startLine} 行`);
                  }}
                  className="shrink-0 rounded px-1.5 py-0.5 bg-monokai-pink/20 text-monokai-pink font-semibold hover:bg-monokai-pink/30 cursor-pointer"
                >
                  回 SQL
                </button>
              )}
            </div>
          )}

          {/* 反向血缘追溯浮动指示条 */}
          {isReverseTracing && (
            <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-3.5 py-1.5 rounded-md bg-monokai-surface/95 border border-monokai-cyan/60 text-xs font-mono text-monokai-cyan shadow-2xl backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-monokai-cyan" />
              <span className="font-semibold text-monokai-fg">
                反向血缘追溯中：<span className="text-monokai-cyan">RESULT ← 算子 ← SCAN</span>
              </span>
              <button
                type="button"
                onClick={clearLineageTrace}
                className="ml-1 px-1.5 py-0.5 rounded bg-monokai-elevated hover:bg-monokai-border text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer text-[10px]"
                title="退出反向追溯模式"
              >
                退出追溯
              </button>
            </div>
          )}

          {/* 画布为空 / 同步失败引导 */}
          {nodes.length === 0 && (
            <div className={`absolute inset-0 z-10 ${dfEmpty} bg-monokai-bg`}>
              <div className={`w-12 h-12 rounded-xl bg-monokai-surface border flex items-center justify-center mb-1 shadow-xl ${
                syncStatus === 'error' ? 'border-monokai-pink/50 text-monokai-pink' : 'border-monokai-border text-monokai-accent'
              }`}>
                {syncStatus === 'error' ? <AlertCircle className="w-6 h-6" /> : <Workflow className="w-6 h-6" />}
              </div>
              <h3 className={dfEmptyTitle}>
                {dataFlowMode === 'custom' ? '开始编排数据流' : dataFlowMode === 'catalog' ? '暂无表与视图血缘' : syncStatus === 'error'
                  ? '执行路径同步失败'
                  : stripSqlHeader(activeSql)
                    ? '等待从 SQL 生成执行路径'
                    : '执行路径画布就绪'}
              </h3>
              <p className={dfEmptyHint}>
                {dataFlowMode === 'custom' ? '从左侧选择数据表或添加算子，再连接节点并配置执行参数。' : dataFlowMode === 'catalog' ? '连接数据库或导入数据表后刷新血缘。' : syncStatus === 'error' && lastSyncError
                  ? lastSyncError
                  : stripSqlHeader(activeSql)
                    ? '检测到编辑器中已有 SQL。同步后将基于 DuckDB 执行计划生成算子路径。'
                    : '从 SQL 工作台同步 DuckDB 执行计划路径，或切换全屏模式编排流水线。'}
              </p>
              {!isSplitMode && syncStatus !== 'error' && (
                <p className="text-2xs text-monokai-comment/70 max-w-sm font-mono">
                  连线：右中输出 → 左中输入
                </p>
              )}
              {dataFlowMode !== 'custom' && <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                {dataFlowMode === 'catalog' ? <button type="button" onClick={handleSwitchToCatalog} disabled={showSyncProgress} className={dfBtnPrimary}>刷新血缘</button> : stripSqlHeader(activeSql) ? (
                  <button
                    type="button"
                    onClick={handleManualSyncFromSql}
                    disabled={showSyncProgress}
                    className={dfBtnPrimary}
                  >
                    <RefreshCw className={`w-3 h-3 ${showSyncProgress ? 'animate-spin' : ''}`} />
                    <span>{showSyncProgress ? '同步中...' : syncStatus === 'error' ? '重试同步' : '从当前 SQL 同步'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (onSwitchToSqlEditor) onSwitchToSqlEditor();
                      else setActiveTab(Tab.SQL);
                    }}
                    className={dfBtnPrimary}
                  >
                    <Code className="w-3 h-3" />
                    <span>前往 SQL 工作台</span>
                  </button>
                )}
                {syncStatus === 'error' && onSwitchToSqlEditor && (
                  <button type="button" onClick={() => onSwitchToSqlEditor()} className={dfBtnSecondary}>
                    <Code className="w-3 h-3 text-monokai-pink" />
                    <span>回编辑器修正</span>
                  </button>
                )}
                {!isSplitMode && dataFlowMode === 'sql' && syncStatus !== 'error' && (
                  <>
                    <button type="button" onClick={handleSwitchToCatalog} className={dfBtnSecondary}>
                      <Database className="w-3 h-3 text-monokai-cyan" />
                      <span>全库表血缘</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDataFlowMode('custom')}
                      className={dfBtnGhost}
                    >
                      <Layers className="w-3 h-3" />
                      <span>进入自由编排</span>
                    </button>
                  </>
                )}
              </div>}
            </div>
          )}

          {dataFlowMode==='sql'&&logicalFlowData?.diagnostics.length!==0&&logicalFlowData?.diagnostics.length&&<div role="status" className="absolute left-3 right-3 top-3 z-30 rounded border border-monokai-orange/40 bg-monokai-bg p-2 text-xs text-monokai-orange">{logicalFlowData.diagnostics.map(d=><div key={`${d.code}-${d.sourceSpan?.start}`}>{d.sourceSpan?`第 ${d.sourceSpan.startLine} 行：`:''}{d.message}</div>)}</div>}
          <ReactFlow
            nodes={nodes.map(n => n.type === 'logicalBoundary' ? n : ({
              ...n,
              // 固定节点盒模型，确保 React Flow handleBounds 与视觉卡片对齐（含 compact）
              width: DATAFLOW_NODE_CARD_WIDTH,
              height: DATAFLOW_NODE_CARD_HEIGHT,
              style: {
                ...(typeof n.style === 'object' && n.style ? n.style : {}),
                width: DATAFLOW_NODE_CARD_WIDTH,
                height: DATAFLOW_NODE_CARD_HEIGHT,
              },
              selected: n.id === selectedNodeId,
            }))}
            edges={edges.map(e => ({
              ...e,
              // 兜底：任何缺失句柄的边强制右中→左中协议
              sourceHandle: e.sourceHandle || 'output',
              targetHandle: e.targetHandle || e.data?.joinSide || 'input',
              selected: e.id === selectedEdgeId,
            }))}
            nodesDraggable={dataFlowMode !== 'sql'}
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
            } as any}
            fitView={dataFlowMode !== 'sql'}
            fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
            minZoom={0.2}
            maxZoom={2}
            panOnDrag={dataFlowMode === 'sql' || isPanMode}
            selectionOnDrag={!isPanMode}
            panOnScroll={false}
            nodesConnectable={dataFlowMode === 'custom'}
            deleteKeyCode={null}
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
                <marker
                  id="df-marker-pink"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerUnits="strokeWidth"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--monokai-pink)" />
                </marker>
                <marker
                  id="df-marker-yellow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerUnits="strokeWidth"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--monokai-yellow)" />
                </marker>
              </defs>
            </svg>
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
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
                maskColor="color-mix(in srgb, var(--monokai-bg) 80%, transparent)"
                className="!bg-monokai-surface !border !border-monokai-border !rounded-md !shadow-xl !m-3"
              />
            )}
          </ReactFlow>

          {/* 检查器收起时：右上角唤出胶囊（对齐实体画布属性入口） */}
          {!isInspectorOpen && selectedNodeId && (
            <button
              type="button"
              onClick={() => setIsInspectorOpen(true)}
              className={`absolute ${
                isSplitMode ? 'right-2.5 top-2.5 !py-1 !px-2 !text-2xs' : 'right-3 top-3 px-2.5 py-1.5 text-xs'
              } z-20 flex items-center gap-1.5 rounded-lg border border-monokai-border bg-monokai-bg/95 text-monokai-fg-muted hover:text-monokai-fg hover:border-monokai-fg-muted/40 shadow-xl backdrop-blur-md font-bold transition-all cursor-pointer select-none`}
              title="查看已选节点的属性与数据预览"
            >
              <Sliders className="w-3.5 h-3.5 text-monokai-cyan" />
              <span>属性详情</span>
            </button>
          )}

          {/* 右侧属性抽屉：绝对覆盖，分屏模式收敛为 w-72，布局与【本体图谱-实体画布】属性面板一致 */}
          {isInspectorOpen && (
            <div className={`absolute top-0 right-0 bottom-0 ${
              isSplitMode ? 'w-72 max-w-full' : 'w-80 max-w-full'
            } border-l border-monokai-border bg-monokai-bg/95 backdrop-blur-md flex flex-col h-full z-20 animate-in slide-in-from-right duration-250 shadow-2xl`}>
              <DataFlowInspector
                onOpenInSqlEditor={onOpenInSqlEditor}
                onClose={() => setIsInspectorOpen(false)}
              />
            </div>
          )}

          {/* ── 底部单步推演仿真器浮动控制岛 (Floating Stepper Island) ── */}
          {stepperState.isActive && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-xl bg-monokai-surface/95 border border-monokai-accent/40 shadow-2xl backdrop-blur-md text-xs font-sans animate-in slide-in-from-bottom-4 duration-200">
              <div className="flex items-center gap-2 pr-3 border-r border-monokai-border/80">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-monokai-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-monokai-accent" />
                </span>
                <span className="font-mono font-bold text-monokai-fg tracking-tight">
                  执行时序推演
                </span>
                <span className="px-1.5 py-0.5 rounded bg-monokai-elevated text-2xs font-mono text-monokai-accent border border-monokai-accent/30">
                  STEP {stepperState.currentStepIndex} / {stepperState.totalSteps}
                </span>
              </div>

              {/* 控制器按钮组 */}
              <div className="flex items-center gap-1.5">
                {/* 复位 */}
                <button
                  type="button"
                  onClick={() => setStepIndex(1)}
                  className="p-1.5 rounded-md hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
                  title="复位至第一步"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>

                {/* 上一步 */}
                <button
                  type="button"
                  onClick={stepPrev}
                  disabled={stepperState.currentStepIndex <= 1}
                  className="p-1.5 rounded-md hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="上一步"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                {/* 连续演示 / 暂停 */}
                <button
                  type="button"
                  onClick={togglePlayStepping}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-monokai-accent text-[var(--dataflow-on-accent)] font-semibold hover:brightness-105 active:scale-95 transition-all cursor-pointer shadow-xs"
                  title={stepperState.isPlaying ? '暂停自动推演' : '开始自动按时序推演'}
                >
                  {stepperState.isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>暂停</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>演示</span>
                    </>
                  )}
                </button>

                {/* 单步推进 */}
                <button
                  type="button"
                  onClick={stepNext}
                  disabled={stepperState.currentStepIndex >= stepperState.totalSteps}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-monokai-fg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="下一步 (单步推进)"
                >
                  <span>单步推进</span>
                  <StepForward className="w-3.5 h-3.5 text-monokai-accent" />
                </button>

                <div className="w-px h-4 bg-monokai-border/80 mx-1" />

                {/* 退出推演 */}
                <button
                  type="button"
                  onClick={stopStepping}
                  className="p-1.5 rounded-md hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-pink transition-colors cursor-pointer"
                  title="退出单步推演"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 底部可伸缩控制台抽屉（平时收拢为 28px 状态栏，分屏模式由 SQL 工作台主控制台统一接管） ── */}
      {!isSplitMode && <DataFlowBottomDrawer />}
    </div>
  );
};

export const DataFlowCanvas: React.FC<DataFlowCanvasProps> = ({
  hideSubNav,
  standalone,
  initialMode,
  initialFocusTable,
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
        initialFocusTable={initialFocusTable}
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
