/**
 * DataFlowCanvas - 现代工业级数据流与 ETL 编排工作台
 *
 * 核心架构重构：
 * 1. 顶部单行高聚合顶栏 (36px)：整合模式切换、关联查询选择器、实时联动指示与核心动作组
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
  Sparkles,
  Workflow,
  Link2,
  Sigma,
  Upload,
  ChevronDown,
  AlertCircle,
  Pause,
  StepForward,
  SkipBack,
  Compass,
  X,
  Wrench,
} from 'lucide-react';

import { useWorkflowStore, wouldCreateCycle, type DataFlowMode } from '../../services/dataflow/workflowStore';
import { SQL_PITFALL_PRESETS } from '../../services/dataflow/sqlToWorkflowParser';
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
  const { zoomIn, zoomOut, fitView, getZoom } = useReactFlow();
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
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
      <button
        type="button"
        onClick={onToggleMiniMap}
        className={showMiniMap ? dfIconBtnActive : dfIconBtn}
        title="切换全景小地图 (MiniMap)"
      >
        <Map className="h-3.5 w-3.5" />
      </button>

      {!isSplitMode && (
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
    stepperState,
    startStepping,
    stopStepping,
    stepNext,
    stepPrev,
    setStepIndex,
    togglePlayStepping,
    loadPitfallPreset,
    isReverseTracing,
    traceReverseLineage,
    clearLineageTrace,
    setInspectorTab,
    syncStatus,
    lastSyncError,
    focusFaultyNode,
  } = useWorkflowStore();

  const { setActiveTab } = useAppStore();
  const { confirm } = useConfirmDialog();
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showMiniMap, setShowMiniMap] = useState<boolean>(false);
  const [isPanMode, setIsPanMode] = useState<boolean>(false);
  const [showToolsMenu, setShowToolsMenu] = useState<boolean>(false);
  const [showPitfallMenu, setShowPitfallMenu] = useState<boolean>(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

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
  const lastCenteredNodeRef = useRef<string | null>(null);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

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

  /** 打开右侧检查器并定位到含「运行套路」的节点（节点卡已不再内嵌展开，避免空操作） */
  const handleShowParadigmGuide = useCallback(() => {
    const target =
      nodes.find(n => n.id === selectedNodeId && n.data.paradigm) ||
      nodes.find(n => n.data.paradigm) ||
      nodes.find(n => n.id === selectedNodeId) ||
      nodes[0];

    if (!target) {
      toastService.info('当前流图为空，请先从 SQL 同步或加载演示流图');
      return;
    }

    selectNode(target.id);
    setInspectorTab('config');
    setIsInspectorOpen(true);
    setShowToolsMenu(false);

    if (typeof reactFlowInstance?.setCenter === 'function') {
      reactFlowInstance.setCenter(target.position.x + 112, target.position.y + 40, {
        zoom: 1.1,
        duration: 350,
      });
    }

    if (target.data.paradigm) {
      toastService.success(`已打开「${target.data.title || '当前步骤'}」的运行套路与避坑指南`);
    } else {
      toastService.info('已打开节点详情；该步骤暂无套路说明，可切换其他算子查看');
    }
  }, [nodes, selectedNodeId, selectNode, setInspectorTab, reactFlowInstance]);

  // 点击菜单外部关闭「学习与工具」
  useEffect(() => {
    if (!showToolsMenu && !showPitfallMenu) return;
    const onDocClick = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setShowToolsMenu(false);
        setShowPitfallMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showToolsMenu, showPitfallMenu]);

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
        setShowPitfallMenu(false);
        useWorkflowStore.setState({ activeSqlRange: null });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedEdgeId, deleteNode, deleteEdge, selectNode, nodes, confirm]);

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
      setInspectorTab('config');
      if (lastCenteredNodeRef.current !== node.id) {
        centerOnNode(node.id, 1.05, 280);
      }
      if (node.data?.sqlRange) {
        useWorkflowStore.setState({ activeSqlRange: node.data.sqlRange });
        dispatchFocusSqlEditor({ sqlRange: node.data.sqlRange });
      }
    },
    [selectNode, setInspectorTab, centerOnNode]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
    setSelectedEdgeId(null);
    setIsInspectorOpen(false);
    setShowToolsMenu(false);
    useWorkflowStore.setState({ activeSqlRange: null });
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

      {/* ── 统一现代化单行高聚合顶栏 (高度严格收敛为 36px) ── */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-monokai-border bg-monokai-sidebar px-3 z-30 select-none gap-2 overflow-x-auto scrollbar-hide">
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
                className={dataFlowMode === 'sql' ? dfModePillActive : dfModePillIdle}
                title="当前 SQL 查询逻辑流程图 (CTE / JOIN / GROUP BY)"
              >
                <FileCode2 className="w-3 h-3" />
                <span>当前 SQL 流图</span>
              </button>

              <button
                type="button"
                onClick={handleSwitchToCatalog}
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
              <span>物理执行计划</span>
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
                className="h-6 px-1.5 rounded bg-monokai-surface/80 border border-monokai-border text-2xs text-monokai-fg font-mono outline-none cursor-pointer"
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
              className="flex items-center gap-1 h-6 px-1.5 rounded text-2xs font-mono text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
              title="打字时静默解析并平滑更新 DAG（绝不漂移焦点）"
            >
              <span className={liveSyncWithSql ? dfStatusDot : dfStatusDotIdle} />
              <span className="hidden sm:inline">{liveSyncWithSql ? '实时联动: 开' : '实时联动: 关'}</span>
            </button>
          )}

          {nodes.length > 0 && (
            <div className="hidden lg:flex items-center gap-1 px-2 py-0.5 rounded bg-monokai-surface/50 border border-monokai-border/40 text-3xs font-mono text-monokai-comment">
              <span>{nodes.length} 算子步骤</span>
              <span>·</span>
              <span>
                {(nodes.reduce((sum, n) => sum + (n.data.executionTimeSec ? n.data.executionTimeSec * 1000 : 0), 0)).toFixed(1)}ms
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
                  setShowPitfallMenu(false);
                }}
                className={`flex items-center gap-1 h-7 px-2 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
                  showToolsMenu || stepperState.isActive
                    ? 'bg-monokai-elevated border-monokai-accent/50 text-monokai-accent'
                    : 'bg-monokai-surface/70 border-monokai-border text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated'
                }`}
                title="学习与诊断工具：单步推演、避坑演练、套路解析、编译为 SQL"
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
                  className="absolute right-0 top-full mt-1.5 w-56 rounded-lg border border-monokai-border bg-monokai-surface/98 p-1 shadow-2xl backdrop-blur-md z-50 text-xs flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 font-sans"
                >
                  <div className="px-2 py-1 text-2xs font-semibold text-monokai-comment border-b border-monokai-border/60 mb-0.5">
                    学习与诊断
                  </div>

                  <button
                    type="button"
                    role="menuitem"
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

                  <div className="relative">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => setShowPitfallMenu(v => !v)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-monokai-fg hover:bg-monokai-elevated transition-colors text-left cursor-pointer w-full"
                    >
                      <Compass className="w-3.5 h-3.5 text-monokai-purple shrink-0" />
                      <span className="flex-1">避坑演练</span>
                      <ChevronDown className={`w-2.5 h-2.5 opacity-60 transition-transform ${showPitfallMenu ? 'rotate-180' : ''}`} />
                    </button>
                    {showPitfallMenu && (
                      <div className="mt-0.5 ml-1 mr-0.5 rounded-md border border-monokai-border/80 bg-monokai-bg/90 p-1 flex flex-col gap-0.5 max-h-56 overflow-y-auto custom-scrollbar">
                        {SQL_PITFALL_PRESETS.map(preset => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              const res = loadPitfallPreset(preset.id);
                              setShowPitfallMenu(false);
                              setShowToolsMenu(false);
                              if (res && onOpenInSqlEditor) {
                                onOpenInSqlEditor(res.buggySql, `${preset.name}.sql`);
                              }
                            }}
                            className="flex flex-col items-start px-2 py-1.5 rounded hover:bg-monokai-elevated transition-colors text-left cursor-pointer group"
                          >
                            <div className="flex items-center gap-1.5 w-full">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${preset.category === 'binder_error' || preset.category === 'groupby_violation' ? 'bg-monokai-pink' : preset.category === 'join_degradation' || preset.category === 'cartesian_blowup' ? 'bg-monokai-yellow' : 'bg-monokai-accent'}`} />
                              <span className="font-medium text-monokai-fg group-hover:text-monokai-accent transition-colors text-2xs leading-snug">
                                {preset.name}
                              </span>
                            </div>
                            <span className="text-[10px] text-monokai-comment line-clamp-1 mt-0.5 pl-3">
                              {preset.summary || preset.bugDescription}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleShowParadigmGuide}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-monokai-fg hover:bg-monokai-elevated transition-colors text-left cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-monokai-yellow shrink-0" />
                    <span>套路解析</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
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

          {/* 从 SQL 同步 */}
          <button
            type="button"
            onClick={handleManualSyncFromSql}
            disabled={showSyncProgress}
            className={dfBtnSecondary}
            title="从当前 SQL 编辑器内容重新解析执行路径"
          >
            <RefreshCw className={`w-3 h-3 ${showSyncProgress ? 'animate-spin text-monokai-accent' : 'text-monokai-comment'}`} />
            <span>{showSyncProgress ? '同步中...' : '从 SQL 同步'}</span>
          </button>

          {/* 核心主行动：运行全流程（分屏以 SQL 执行为主，隐藏画布跑批） */}
          {!isSplitMode && (
            <button
              type="button"
              onClick={runAll}
              disabled={isExecuting}
              className={dfBtnPrimary}
              title="依拓扑依赖顺序在 DuckDB 中执行当前流水线"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{isExecuting ? '执行中...' : '运行全流程'}</span>
            </button>
          )}
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
                {syncStatus === 'error'
                  ? '执行路径同步失败'
                  : activeSql.trim()
                    ? '等待从 SQL 生成执行路径'
                    : '执行路径画布就绪'}
              </h3>
              <p className={dfEmptyHint}>
                {syncStatus === 'error' && lastSyncError
                  ? lastSyncError
                  : activeSql.trim()
                    ? '检测到编辑器中已有 SQL。同步后将基于 DuckDB 执行计划生成算子路径。'
                    : '从 SQL 工作台同步 DuckDB 执行计划路径，或切换全屏模式编排流水线。'}
              </p>
              {!isSplitMode && syncStatus !== 'error' && (
                <p className="text-2xs text-monokai-comment/70 max-w-sm font-mono">
                  连线：右中输出 → 左中输入
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                {activeSql.trim() ? (
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
                {!isSplitMode && syncStatus !== 'error' && (
                  <>
                    <button type="button" onClick={handleSwitchToCatalog} className={dfBtnSecondary}>
                      <Database className="w-3 h-3 text-monokai-cyan" />
                      <span>全库表血缘</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await resetToDefaultDemo();
                        toastService.success('已加载电商分析真实数据流');
                      }}
                      className={dfBtnSecondary}
                    >
                      <Sparkles className="w-3 h-3 text-monokai-yellow" />
                      <span>加载演示流图</span>
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
              </div>
            </div>
          )}

          <ReactFlow
            nodes={nodes.map(n => ({
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
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-monokai-accent text-monokai-bg font-semibold hover:brightness-105 active:scale-95 transition-all cursor-pointer shadow-xs"
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

      {/* ── 底部可伸缩控制台抽屉（平时收拢为 28px 状态栏，分屏模式由 SQL 工作台主控制台统一接管） ── */}
      {!isSplitMode && <DataFlowBottomDrawer />}
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
