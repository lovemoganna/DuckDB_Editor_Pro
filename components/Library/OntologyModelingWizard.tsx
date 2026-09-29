/**
 * OntologyModelingWizard — AI 本体建模工作台 (Ontology Modeling Studio)
 *
 * 彻底重构规范：
 * 1. 一条清晰主流程：输入业务需求 → AI 提取 Object Type / Property / Link Type / Action Type → 图谱实时预览 → 选中局部编辑 → 自动校验 → 确认写入本体
 * 2. 主画布只建模 Object Type (User / Product / Order)，绝不把实例数据 (User_Alice / Order_ORD001) 作为图谱节点
 * 3. 实例数据剥离至“示例 / 验证”层，专门用于验证 Schema 合理性
 * 4. 中间图谱为页面视觉和操作核心，左右面板仅服务于当前选中节点
 * 5. 删除重复按钮、重复状态卡片与无意义配置铺陈
 * 6. 属性、关系、Action 按需展开折叠，上下文 AI 建议仅在需要时呈现
 * 7. 编辑节点/关系即时双向同步至 SVG 拓扑图谱
 * 8. 实时体检反模式：重复对象、错误关系、实例/类型混淆、无意义抽象与孤立节点
 * 9. 大幅压缩工具栏与底部空白，极大化有效画布视口
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Wand2, Loader2, ChevronRight, ChevronLeft, Check, Plus, Trash2,
  Table2, AlertTriangle, Sparkles, ArrowDown, ArrowRightLeft,
  Zap, BrainCircuit, Activity, RotateCcw, ZoomIn, ZoomOut,
  CheckCircle2, AlertCircle, Info, RefreshCw, Send, Tag, Link2, Sliders,
  Database, GitMerge, Edit3, X, HelpCircle, Layers, FileSpreadsheet,
  CheckSquare, ArrowUpRight, Maximize2, Minimize2, PanelRightClose, PanelRightOpen
} from 'lucide-react';
import {
  ontologyModelingService,
  OntologyModelingResult,
  ModelingProgress,
  ModelingObjectType,
  ModelingObject,
  ModelingLinkType,
  ModelingLink,
  ModelingAction,
  ModelingValidationIssue
} from '../../services/ontologyModelingService';
import { ModalShell, ActionButton } from '../ui/Workbench';

// ============================================================
// Types & Constants
// ============================================================

type WorkbenchStep = 'input' | 'workbench' | 'commit';
type InspectorTab = 'properties' | 'links' | 'actions' | 'verification' | 'diagnostics';
type CanvasViewMode = 'graph' | 'table';

interface Props {
  onClose: () => void;
  onImport: (result: OntologyModelingResult, options?: { replace?: boolean }) => Promise<void>;
}

const PRESET_TEMPLATES = [
  {
    label: '🛒 跨境电商与仓储履约',
    text: '跨境电商物流履约系统：包含采购客户、商品SKU、交易订单、中央保税仓与跨境配送运单实体，涵盖客户下单、保税仓出库、国际干线运输、清关交付以及售后退款取消动作。',
  },
  {
    label: '🏥 智慧医疗门诊处方',
    text: '医院门诊挂号与电子处方系统：包括就诊患者、主治医师、挂号预约单、电子处方与药品库存主数据，关联就诊签到、名医接诊、处方开具与药房发药扣减闭环。',
  },
  {
    label: '💳 金融信贷授信风控',
    text: '数字金融消费信贷审批：包含借款申请人、信贷申请件、风控大数据评分报告与授信放款合同，涵盖客户申请、风控模型实时跑批、经理终审与核心银企直连放款出资。',
  },
  {
    label: '⚡ 智能物联网监控运维',
    text: '工厂车间工业物联网监控：包含边缘智能网关、温湿度传感器子设备、实时时序遥测数据流与超温告警工单，支持指标越限告警、运维接单与边缘侧下发风机降温指令。',
  },
  {
    label: '📋 SaaS客户成功旅程',
    text: '企业级SaaS客户全生命周期运营：包含企业租户、坐席操作员、软件订阅套餐、增购订单与服务工单实体，覆盖试用开通、付费续期、工单派发与权限冻结动作。',
  },
];

const CATEGORY_STYLES: Record<string, { bg: string; border: string; text: string; dot: string; fill: string; stroke: string }> = {
  Core: { bg: 'bg-monokai-cyan/15', border: 'border-monokai-cyan/40', text: 'text-monokai-cyan', dot: 'bg-monokai-cyan', fill: '#8be9fd', stroke: '#50fa7b' },
  Transaction: { bg: 'bg-monokai-yellow/15', border: 'border-monokai-yellow/40', text: 'text-monokai-yellow', dot: 'bg-monokai-yellow', fill: '#f1fa8c', stroke: '#ffb86c' },
  Master: { bg: 'bg-monokai-amethyst/15', border: 'border-monokai-amethyst/40', text: 'text-monokai-amethyst', dot: 'bg-monokai-amethyst', fill: '#bd93f9', stroke: '#ff79c6' },
  Event: { bg: 'bg-monokai-orange/15', border: 'border-monokai-orange/40', text: 'text-monokai-orange', dot: 'bg-monokai-orange', fill: '#ffb86c', stroke: '#ff5555' },
};

function getNodeStyle(category?: string, name?: string) {
  if (category && CATEGORY_STYLES[category]) return CATEGORY_STYLES[category];
  const cat = name?.toLowerCase().includes('order') || name?.toLowerCase().includes('appoint') ? 'Transaction'
    : name?.toLowerCase().includes('user') || name?.toLowerCase().includes('customer') || name?.toLowerCase().includes('doctor') ? 'Master'
    : name?.toLowerCase().includes('event') || name?.toLowerCase().includes('alert') || name?.toLowerCase().includes('metric') ? 'Event'
    : 'Core';
  return CATEGORY_STYLES[cat] || CATEGORY_STYLES.Core;
}

// ============================================================
// Interactive SVG Graph Canvas (ObjectType Centered)
// ============================================================

interface GraphCanvasProps {
  objectTypes: ModelingObjectType[];
  linkTypes: ModelingLinkType[];
  actions: ModelingAction[];
  selectedTypeName: string | null;
  selectedLinkIndex: number | null;
  onSelectType: (name: string) => void;
  onSelectLink: (index: number) => void;
  nodePositions: Record<string, { x: number; y: number }>;
  onUpdateNodePosition: (name: string, pos: { x: number; y: number }) => void;
  isInspectorCollapsed?: boolean;
  onToggleInspector?: () => void;
}

const OntologyWorkbenchGraph: React.FC<GraphCanvasProps> = ({
  objectTypes,
  linkTypes,
  actions,
  selectedTypeName,
  selectedLinkIndex,
  onSelectType,
  onSelectLink,
  nodePositions,
  onUpdateNodePosition,
  isInspectorCollapsed,
  onToggleInspector,
}) => {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);

  // Auto-fit to view function: calculates bounding box of all nodes and centers it
  const fitToView = useCallback(() => {
    const nodeNames = objectTypes.map(ot => ot.name);
    const svgEl = svgRef.current;
    if (nodeNames.length === 0 || !svgEl) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    const viewWidth = svgEl.clientWidth || 800;
    const viewHeight = svgEl.clientHeight || 560;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodeNames.forEach(name => {
      const pos = nodePositions[name] || { x: 300, y: 250 };
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
    });

    const cardW = 160;
    const cardH = 88;
    const margin = 48;

    const bboxLeft = minX - cardW / 2 - margin;
    const bboxRight = maxX + cardW / 2 + margin;
    const bboxTop = minY - cardH / 2 - margin;
    const bboxBottom = maxY + cardH / 2 + margin;

    const bboxWidth = Math.max(bboxRight - bboxLeft, 240);
    const bboxHeight = Math.max(bboxBottom - bboxTop, 180);

    const scaleX = viewWidth / bboxWidth;
    const scaleY = viewHeight / bboxHeight;
    const optimalZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.35), 1.25);

    const centerX = (bboxLeft + bboxRight) / 2;
    const centerY = (bboxTop + bboxBottom) / 2;

    const optimalPanX = viewWidth / 2 - centerX * optimalZoom;
    const optimalPanY = viewHeight / 2 - centerY * optimalZoom;

    setZoom(Number(optimalZoom.toFixed(2)));
    setPan({ x: Math.round(optimalPanX), y: Math.round(optimalPanY) });
  }, [objectTypes, nodePositions]);

  // Initial and reactive fit to view
  useEffect(() => {
    if (objectTypes.length > 0) {
      const timer = setTimeout(() => {
        fitToView();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [objectTypes.length, isInspectorCollapsed, fitToView]);

  const handleNodeMouseDown = (e: React.MouseEvent, typeName: string) => {
    e.stopPropagation();
    setDraggingNode(typeName);
    onSelectType(typeName);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingNode) {
      const svg = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - svg.left - pan.x) / zoom;
      const y = (e.clientY - svg.top - pan.y) / zoom;
      onUpdateNodePosition(draggingNode, { x: Math.round(x), y: Math.round(y) });
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setDraggingNode(null);
    setIsPanning(false);
  };

  const handleSvgMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.3), 2.5);

    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const scaleRatio = newZoom / zoom;
      const newPanX = mouseX - (mouseX - pan.x) * scaleRatio;
      const newPanY = mouseY - (mouseY - pan.y) * scaleRatio;
      setZoom(Number(newZoom.toFixed(2)));
      setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
    } else {
      setZoom(Number(newZoom.toFixed(2)));
    }
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Connected links for active highlight
  const connectedLinkIndices = useMemo(() => {
    if (!selectedTypeName) return new Set<number>();
    const set = new Set<number>();
    linkTypes.forEach((lt, idx) => {
      if (lt.fromType === selectedTypeName || lt.toType === selectedTypeName) {
        set.add(idx);
      }
    });
    return set;
  }, [selectedTypeName, linkTypes]);

  // Action count map per ObjectType
  const actionCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    actions.forEach(a => {
      map[a.objectName] = (map[a.objectName] || 0) + 1;
    });
    return map;
  }, [actions]);

  return (
    <div className="relative w-full h-full flex flex-col bg-monokai-bg/95 border border-monokai-border/80 rounded-xl overflow-hidden select-none">
      {/* Canvas Header Toolbar */}
      <div className="h-9 px-3 border-b border-monokai-border/70 bg-monokai-surface/60 flex items-center justify-between text-xs text-monokai-comment shrink-0">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-3.5 h-3.5 text-monokai-cyan" />
          <span className="font-semibold text-monokai-fg">动态本体图谱预览</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-monokai-cyan/15 text-monokai-cyan font-mono">
            {`${objectTypes.length} 本体类型 (Schema) · ${linkTypes.length} 关系类型 · ${actions.length} 业务行动`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Zoom Percentage */}
          <button
            onClick={resetView}
            title="点击重置 100%"
            className="px-1.5 py-0.5 rounded bg-black/30 font-mono text-[10px] text-monokai-fg/80 hover:text-monokai-cyan transition-colors mr-0.5"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => setZoom(z => Math.min(z + 0.15, 2.5))}
            title="放大 (或滚轮向上)"
            className="p-1 rounded hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(z - 0.15, 0.3))}
            title="缩小 (或滚轮向下)"
            className="p-1 rounded hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={fitToView}
            title="自适应全貌居中 (Fit to View)"
            className="p-1 rounded hover:bg-monokai-surface text-monokai-cyan hover:text-white transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetView}
            title="重置视图"
            className="p-1 rounded hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {onToggleInspector && (
            <div className="border-l border-monokai-border/70 pl-1.5 ml-1">
              <button
                onClick={onToggleInspector}
                title={isInspectorCollapsed ? '展开右侧检查器' : '收起右侧检查器 (全屏超大画布)'}
                className="px-2 py-0.5 rounded bg-monokai-surface hover:bg-monokai-surface/80 border border-monokai-border text-[11px] text-monokai-fg flex items-center gap-1 transition-colors"
              >
                {isInspectorCollapsed ? (
                  <>
                    <PanelRightOpen className="w-3 h-3 text-monokai-cyan" />
                    <span>展开侧栏</span>
                  </>
                ) : (
                  <>
                    <PanelRightClose className="w-3 h-3 text-monokai-comment" />
                    <span>全宽画布</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SVG Canvas Body */}
      <div className="flex-1 w-full h-full overflow-hidden relative cursor-grab active:cursor-grabbing">
        <svg
          ref={svgRef}
          className="w-full h-full"
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onDoubleClick={fitToView}
        >
          <defs>
            <marker
              id="arrowhead-schema"
              markerWidth="10"
              markerHeight="7"
              refX="16"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#6272a4" />
            </marker>
            <marker
              id="arrowhead-schema-active"
              markerWidth="12"
              markerHeight="8"
              refX="18"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0, 12 4, 0 8" fill="#8be9fd" />
            </marker>
            <marker
              id="arrowhead-schema-selected"
              markerWidth="14"
              markerHeight="9"
              refX="20"
              refY="4.5"
              orient="auto"
            >
              <polygon points="0 0, 14 4.5, 0 9" fill="#ff79c6" />
            </marker>
            {/* Grid Pattern */}
            <pattern id="workbench-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
            </pattern>
          </defs>

          {/* Grid Background */}
          <rect width="100%" height="100%" fill="url(#workbench-grid)" />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* 1. Edges (Link Types) */}
            {linkTypes.map((link, idx) => {
              const fromPos = nodePositions[link.fromType] || { x: 100, y: 100 };
              const toPos = nodePositions[link.toType] || { x: 300, y: 300 };
              const isSelected = selectedLinkIndex === idx;
              const isConnected = connectedLinkIndices.has(idx);

              const dx = toPos.x - fromPos.x;
              const dy = toPos.y - fromPos.y;
              const midX = (fromPos.x + toPos.x) / 2;
              const midY = (fromPos.y + toPos.y) / 2;

              // Arc curvature
              const curvature = 0.15;
              const cx = midX - dy * curvature;
              const cy = midY + dx * curvature;

              const pathData = `M ${fromPos.x} ${fromPos.y} Q ${cx} ${cy} ${toPos.x} ${toPos.y}`;

              const strokeColor = isSelected ? '#ff79c6' : isConnected ? '#8be9fd' : '#44475a';
              const strokeWidth = isSelected ? 2.5 : isConnected ? 2 : 1.2;
              const markerEnd = isSelected ? 'url(#arrowhead-schema-selected)' : isConnected ? 'url(#arrowhead-schema-active)' : 'url(#arrowhead-schema)';

              return (
                <g key={`edge-${idx}`} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onSelectLink(idx); }}>
                  <path
                    d={pathData}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={isSelected ? '4 2' : undefined}
                    markerEnd={markerEnd}
                    className="transition-colors duration-150"
                  />
                  {/* Invisible thicker path for easier clicking */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                  />
                  {/* Link Label Tag */}
                  <g transform={`translate(${cx}, ${cy})`}>
                    <rect
                      x="-42"
                      y="-10"
                      width="84"
                      height="20"
                      rx="10"
                      fill={isSelected ? '#ff79c6' : isConnected ? '#1e1f29' : '#282a36'}
                      stroke={isSelected ? '#ff79c6' : isConnected ? '#8be9fd' : '#6272a4'}
                      strokeWidth={isSelected ? 1.5 : 1}
                      className="transition-all"
                    />
                    <text
                      textAnchor="middle"
                      dy="4"
                      fontSize="9"
                      fontWeight="bold"
                      fill={isSelected ? '#282a36' : isConnected ? '#8be9fd' : '#f8f8f2'}
                      fontFamily="monospace"
                    >
                      {link.verb || link.name}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* 2. Nodes (Object Types Schema Cards) */}
            {objectTypes.map((ot) => {
              const pos = nodePositions[ot.name] || { x: 200, y: 200 };
              const isSelected = selectedTypeName === ot.name;
              const style = getNodeStyle(ot.category, ot.name);
              const props = ot.properties || {};
              const propKeys = Object.keys(props);
              const previewProps = propKeys.slice(0, 3);
              const extraCount = propKeys.length - previewProps.length;
              const actionCount = actionCountMap[ot.name] || 0;

              const cardW = 160;
              const cardH = 88;

              return (
                <g
                  key={`node-${ot.name}`}
                  transform={`translate(${pos.x - cardW / 2}, ${pos.y - cardH / 2})`}
                  className="cursor-pointer"
                  onMouseDown={(e) => handleNodeMouseDown(e, ot.name)}
                  onClick={(e) => { e.stopPropagation(); onSelectType(ot.name); }}
                >
                  {/* Node Outer Halo for Selection */}
                  {isSelected && (
                    <rect
                      x="-4"
                      y="-4"
                      width={cardW + 8}
                      height={cardH + 8}
                      rx="14"
                      fill="none"
                      stroke="#8be9fd"
                      strokeWidth="2.5"
                      strokeDasharray="4 2"
                      className="animate-pulse"
                    />
                  )}

                  {/* Main Card Shell */}
                  <rect
                    width={cardW}
                    height={cardH}
                    rx="10"
                    fill="#1e1f29"
                    stroke={isSelected ? '#8be9fd' : style.stroke}
                    strokeWidth={isSelected ? 2 : 1.2}
                    className="shadow-lg transition-colors"
                  />

                  {/* Card Header Background */}
                  <path
                    d={`M 0 10 A 10 10 0 0 1 10 0 L ${cardW - 10} 0 A 10 10 0 0 1 ${cardW} 10 L ${cardW} 26 L 0 26 Z`}
                    fill={style.fill}
                    fillOpacity="0.18"
                  />

                  {/* Type Icon & Name */}
                  <circle cx="14" cy="13" r="4.5" fill={style.fill} />
                  <text
                    x="25"
                    y="16"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#f8f8f2"
                    className="select-none"
                  >
                    {ot.name}
                  </text>

                  {/* Category Tag */}
                  <rect
                    x={cardW - 48}
                    y="4"
                    width="42"
                    height="16"
                    rx="4"
                    fill="rgba(0,0,0,0.5)"
                  />
                  <text
                    x={cardW - 27}
                    y="15"
                    textAnchor="middle"
                    fontSize="8.5"
                    fontWeight="600"
                    fill={style.fill}
                  >
                    {ot.category || 'Core'}
                  </text>

                  {/* Properties Mini List */}
                  <g transform="translate(10, 32)">
                    {previewProps.map((key, pIdx) => {
                      const propDef = props[key];
                      const typeStr = typeof propDef === 'object' && propDef?.type ? propDef.type : String(propDef || 'VARCHAR');
                      return (
                        <g key={key} transform={`translate(0, ${pIdx * 13})`}>
                          <text x="0" y="8" fontSize="8.5" fill="#6272a4" fontFamily="monospace">
                            •
                          </text>
                          <text x="8" y="8" fontSize="8.5" fill="#e2e8f0" fontFamily="monospace">
                            {key.length > 11 ? key.slice(0, 10) + '…' : key}:
                          </text>
                          <text x="90" y="8" fontSize="8" fill="#8be9fd" fontFamily="monospace">
                            {typeStr.slice(0, 7)}
                          </text>
                        </g>
                      );
                    })}
                    {previewProps.length === 0 && (
                      <text x="0" y="10" fontSize="8.5" fill="#6272a4" fontStyle="italic">
                        暂无属性定义
                      </text>
                    )}
                  </g>

                  {/* Card Bottom Meta Footer */}
                  <line x1="0" y1={cardH - 18} x2={cardW} y2={cardH - 18} stroke="#282a36" strokeWidth="1" />
                  <g transform={`translate(8, ${cardH - 6})`}>
                    <text fontSize="8" fill="#6272a4">
                      {propKeys.length} 字段 {extraCount > 0 ? `(+${extraCount})` : ''}
                    </text>
                    {actionCount > 0 && (
                      <text x="80" fontSize="8" fill="#ffb86c">
                        ⚡ {actionCount} 行动
                      </text>
                    )}
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating Quick Helper */}
        <div className="absolute bottom-2 left-3 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm border border-white/5 text-[10px] text-monokai-comment flex items-center gap-2 pointer-events-none">
          <span>💡 提示：主图谱仅展示本体类型 (Schema) · 滚轮自由缩放 / 拖动画布 / 双击空白居中全貌</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Main Wizard Component
// ============================================================

export const OntologyModelingWizard: React.FC<Props> = ({ onClose, onImport }) => {
  // Step navigation
  const [step, setStep] = useState<WorkbenchStep>('input');
  const [conceptInput, setConceptInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<ModelingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Model state
  const [draft, setDraft] = useState<OntologyModelingResult | null>(null);
  const [selectedTypeName, setSelectedTypeName] = useState<string | null>(null);
  const [selectedLinkIndex, setSelectedLinkIndex] = useState<number | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('properties');
  const [canvasViewMode, setCanvasViewMode] = useState<CanvasViewMode>('graph');
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);

  // Node spatial positions for SVG layout
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});

  // Local refine & operations state
  const [isRefining, setIsRefining] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState('');
  const [targetMergeType, setTargetMergeType] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [isOverwrite, setIsOverwrite] = useState(false);

  // Synchronize layout positions whenever draft changes
  useEffect(() => {
    if (draft?.graphLayout?.nodes) {
      const posMap: Record<string, { x: number; y: number }> = {};
      draft.graphLayout.nodes.forEach((node) => {
        posMap[node.id] = { x: node.x ?? 300, y: node.y ?? 200 };
      });
      setNodePositions(posMap);
    }
    // Set default selected type
    if (draft && draft.objectTypes.length > 0 && !selectedTypeName) {
      setSelectedTypeName(draft.objectTypes[0].name);
    }
  }, [draft]);

  const handleUpdateNodePosition = useCallback((name: string, pos: { x: number; y: number }) => {
    setNodePositions((prev) => ({ ...prev, [name]: pos }));
  }, []);

  // 1. Start AI Modeling from Concept
  const handleStartModeling = async (inputText?: string) => {
    const textToModel = inputText || conceptInput;
    if (!textToModel.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await ontologyModelingService.modelFromConcept(textToModel, (p) => {
        setProgress(p);
      });
      setDraft(res);
      if (res.objectTypes.length > 0) {
        setSelectedTypeName(res.objectTypes[0].name);
      }
      setSelectedLinkIndex(null);
      setStep('workbench');
    } catch (err: any) {
      setError(`本体建模推导失败: ${err.message || '未知错误'}`);
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  // 2. Refine Operations
  const handleRefine = async (instruction?: string) => {
    if (!draft) return;
    const prompt = instruction || refineInstruction;
    if (!prompt.trim()) return;

    setIsRefining(true);
    setError(null);
    try {
      const next = await ontologyModelingService.refineModel(draft, prompt);
      setDraft(next);
      setRefineInstruction('');
    } catch (err: any) {
      setError(`微调失败: ${err.message}`);
    } finally {
      setIsRefining(false);
    }
  };

  // 3. Auto Fix Anti-patterns
  const handleAutoFix = () => {
    if (!draft) return;
    const fixed = ontologyModelingService.autoFixIssues(draft);
    setDraft(fixed);
  };

  // 4. ObjectType CRUD & Rename (Immediate sync to graph)
  const currentSelectedType = useMemo(() => {
    if (!draft || !selectedTypeName) return null;
    return draft.objectTypes.find((t) => t.name === selectedTypeName) || null;
  }, [draft, selectedTypeName]);

  const handleRenameType = (oldName: string, newName: string) => {
    if (!draft || !newName.trim() || oldName === newName) return;
    const trimmed = newName.trim();

    // 1. Update ObjectTypes
    const nextTypes = draft.objectTypes.map((t) =>
      t.name === oldName ? { ...t, name: trimmed } : t
    );

    // 2. Update LinkTypes from/to
    const nextLinkTypes = draft.linkTypes.map((lt) => ({
      ...lt,
      fromType: lt.fromType === oldName ? trimmed : lt.fromType,
      toType: lt.toType === oldName ? trimmed : lt.toType,
    }));

    // 3. Update actions
    const nextActions = draft.actions.map((a) => ({
      ...a,
      objectName: a.objectName === oldName ? trimmed : a.objectName,
    }));

    // 4. Update seed instances
    const nextObjects = draft.objects.map((o) =>
      o.objectType === oldName ? { ...o, objectType: trimmed } : o
    );

    // 5. Update positions
    setNodePositions((prev) => {
      const next = { ...prev };
      if (next[oldName]) {
        next[trimmed] = next[oldName];
        delete next[oldName];
      }
      return next;
    });

    const { issues, score } = ontologyModelingService.validateModel({
      objectTypes: nextTypes,
      objects: nextObjects,
      linkTypes: nextLinkTypes,
      links: draft.links,
      actions: nextActions,
    });

    setDraft({
      ...draft,
      objectTypes: nextTypes,
      linkTypes: nextLinkTypes,
      actions: nextActions,
      objects: nextObjects,
      validationIssues: issues,
      healthScore: score,
    });
    setSelectedTypeName(trimmed);
  };

  const handleUpdateTypeCategory = (typeName: string, category: 'Core' | 'Transaction' | 'Master' | 'Event') => {
    if (!draft) return;
    const nextTypes = draft.objectTypes.map((t) =>
      t.name === typeName ? { ...t, category } : t
    );
    setDraft({ ...draft, objectTypes: nextTypes });
  };

  const handleAddObjectType = () => {
    if (!draft) return;
    const baseName = 'NewEntity';
    let counter = 1;
    let name = baseName;
    while (draft.objectTypes.some((t) => t.name === name)) {
      name = `${baseName}_${counter++}`;
    }

    const newType: ModelingObjectType = {
      name,
      description: '新增业务实体类型',
      category: 'Core',
      properties: {
        id: 'VARCHAR',
        status: 'VARCHAR',
        created_at: 'TIMESTAMP',
      },
    };

    const nextTypes = [...draft.objectTypes, newType];
    // Add default seed verification instance
    const newSampleObj: ModelingObject = {
      name: `${name}_01`,
      objectType: name,
      properties: { id: '001', status: 'active', created_at: new Date().toISOString() },
      annotations: '场景验证示例',
    };
    const nextObjects = [...draft.objects, newSampleObj];

    // Assign position
    setNodePositions((prev) => ({
      ...prev,
      [name]: { x: 380 + (Math.random() * 80 - 40), y: 260 + (Math.random() * 80 - 40) },
    }));

    const { issues, score } = ontologyModelingService.validateModel({
      objectTypes: nextTypes,
      objects: nextObjects,
      linkTypes: draft.linkTypes,
      links: draft.links,
      actions: draft.actions,
    });

    setDraft({
      ...draft,
      objectTypes: nextTypes,
      objects: nextObjects,
      validationIssues: issues,
      healthScore: score,
    });
    setSelectedTypeName(name);
  };

  const handleDeleteObjectType = (typeName: string) => {
    if (!draft) return;
    const nextTypes = draft.objectTypes.filter((t) => t.name !== typeName);
    const nextLinkTypes = draft.linkTypes.filter((lt) => lt.fromType !== typeName && lt.toType !== typeName);
    const nextActions = draft.actions.filter((a) => a.objectName !== typeName);
    const nextObjects = draft.objects.filter((o) => o.objectType !== typeName);

    const { issues, score } = ontologyModelingService.validateModel({
      objectTypes: nextTypes,
      objects: nextObjects,
      linkTypes: nextLinkTypes,
      links: draft.links,
      actions: nextActions,
    });

    setDraft({
      ...draft,
      objectTypes: nextTypes,
      linkTypes: nextLinkTypes,
      actions: nextActions,
      objects: nextObjects,
      validationIssues: issues,
      healthScore: score,
    });
    setSelectedTypeName(nextTypes[0]?.name || null);
  };

  // 5. Properties CRUD on Selected ObjectType
  const handleAddProperty = (propName: string, propType: string = 'VARCHAR') => {
    if (!draft || !selectedTypeName || !propName.trim()) return;
    const trimmed = propName.trim();
    const nextTypes = draft.objectTypes.map((t) => {
      if (t.name !== selectedTypeName) return t;
      const props = { ...(t.properties || {}) };
      props[trimmed] = propType;
      return { ...t, properties: props };
    });
    setDraft({ ...draft, objectTypes: nextTypes });
  };

  const handleUpdateProperty = (oldKey: string, newKey: string, newType: string) => {
    if (!draft || !selectedTypeName) return;
    const nextTypes = draft.objectTypes.map((t) => {
      if (t.name !== selectedTypeName) return t;
      const props = { ...(t.properties || {}) };
      delete props[oldKey];
      props[newKey] = newType;
      return { ...t, properties: props };
    });
    setDraft({ ...draft, objectTypes: nextTypes });
  };

  const handleDeleteProperty = (key: string) => {
    if (!draft || !selectedTypeName) return;
    const nextTypes = draft.objectTypes.map((t) => {
      if (t.name !== selectedTypeName) return t;
      const props = { ...(t.properties || {}) };
      delete props[key];
      return { ...t, properties: props };
    });
    setDraft({ ...draft, objectTypes: nextTypes });
  };

  // 6. LinkTypes CRUD (Schema Edges)
  const currentSelectedLink = useMemo(() => {
    if (!draft || selectedLinkIndex === null) return null;
    return draft.linkTypes[selectedLinkIndex] || null;
  }, [draft, selectedLinkIndex]);

  const handleAddLinkType = () => {
    if (!draft || draft.objectTypes.length < 2) return;
    const fromType = selectedTypeName || draft.objectTypes[0].name;
    const toType = draft.objectTypes.find((t) => t.name !== fromType)?.name || draft.objectTypes[1].name;
    const name = `REL_${fromType.toUpperCase()}_TO_${toType.toUpperCase()}`;

    const nextLinkTypes = [
      ...draft.linkTypes,
      {
        name,
        description: '业务关联关系',
        fromType,
        toType,
        verb: '关联',
      },
    ];

    const { issues, score } = ontologyModelingService.validateModel({
      objectTypes: draft.objectTypes,
      objects: draft.objects,
      linkTypes: nextLinkTypes,
      links: draft.links,
      actions: draft.actions,
    });

    setDraft({ ...draft, linkTypes: nextLinkTypes, validationIssues: issues, healthScore: score });
    setSelectedLinkIndex(nextLinkTypes.length - 1);
    setInspectorTab('links');
  };

  const handleUpdateLinkType = (index: number, val: Partial<ModelingLinkType>) => {
    if (!draft) return;
    const nextLinkTypes = [...draft.linkTypes];
    nextLinkTypes[index] = { ...nextLinkTypes[index], ...val };

    const { issues, score } = ontologyModelingService.validateModel({
      objectTypes: draft.objectTypes,
      objects: draft.objects,
      linkTypes: nextLinkTypes,
      links: draft.links,
      actions: draft.actions,
    });

    setDraft({ ...draft, linkTypes: nextLinkTypes, validationIssues: issues, healthScore: score });
  };

  const handleReverseLinkType = (index: number) => {
    if (!draft) return;
    const link = draft.linkTypes[index];
    handleUpdateLinkType(index, { fromType: link.toType, toType: link.fromType });
  };

  const handleDeleteLinkType = (index: number) => {
    if (!draft) return;
    const nextLinkTypes = draft.linkTypes.filter((_, i) => i !== index);
    const { issues, score } = ontologyModelingService.validateModel({
      objectTypes: draft.objectTypes,
      objects: draft.objects,
      linkTypes: nextLinkTypes,
      links: draft.links,
      actions: draft.actions,
    });
    setDraft({ ...draft, linkTypes: nextLinkTypes, validationIssues: issues, healthScore: score });
    setSelectedLinkIndex(null);
  };

  // 7. Actions CRUD
  const handleAddAction = () => {
    if (!draft || draft.objectTypes.length === 0) return;
    const target = selectedTypeName || draft.objectTypes[0].name;
    const nextActions = [
      ...draft.actions,
      { name: 'NewAction', objectName: target, description: '业务操作', targetStatus: 'completed' },
    ];
    setDraft({ ...draft, actions: nextActions });
    setInspectorTab('actions');
  };

  const handleUpdateAction = (index: number, val: Partial<ModelingAction>) => {
    if (!draft) return;
    const nextActions = [...draft.actions];
    nextActions[index] = { ...nextActions[index], ...val };
    setDraft({ ...draft, actions: nextActions });
  };

  const handleDeleteAction = (index: number) => {
    if (!draft) return;
    const nextActions = draft.actions.filter((_, i) => i !== index);
    setDraft({ ...draft, actions: nextActions });
  };

  // 8. Node Merge & Local Regeneration
  const handleConfirmMerge = () => {
    if (!draft || !selectedTypeName || !targetMergeType || selectedTypeName === targetMergeType) return;
    const merged = ontologyModelingService.mergeNodes(draft, selectedTypeName, targetMergeType);
    setDraft(merged);
    setSelectedTypeName(targetMergeType);
    setTargetMergeType('');
  };

  const handleRegenerateNode = async () => {
    if (!draft || !selectedTypeName) return;
    setIsRefining(true);
    try {
      const next = await ontologyModelingService.regenerateNode(draft, selectedTypeName);
      setDraft(next);
    } catch (err: any) {
      setError(`局部重新生成失败: ${err.message}`);
    } finally {
      setIsRefining(false);
    }
  };

  // 9. Commit & Write to Ontology
  const handleCommitImport = async () => {
    if (!draft) return;
    setIsImporting(true);
    try {
      await onImport(draft, { replace: isOverwrite });
      onClose();
    } catch (err: any) {
      setError(`写入本体图谱失败: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title="AI 本体建模工作台 (Ontology Modeling Studio)"
      description="业务需求驱动 · Schema与验证解耦 · 实时拓扑交互 · 拓扑体检 · 直写正式本体"
      badge="生产级本体建模"
      icon={BrainCircuit}
      iconColor="text-monokai-cyan"
      zIndex="z-[99999]"
      size="xl"
      className="!max-w-[1680px] !w-[98vw] !h-[94vh] flex flex-col"
    >
      <div className="flex-1 flex flex-col min-h-0 -mx-2 -my-2">
        {/* ── TOP HEADER / BREADCRUMB PIPELINE ────────────────── */}
        <div className="h-10 px-4 border-b border-monokai-border bg-monokai-surface/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6 text-xs">
            <button
              onClick={() => setStep('input')}
              className={`flex items-center gap-2 font-medium cursor-pointer transition-colors ${
                step === 'input' ? 'text-monokai-cyan font-bold' : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step === 'input' ? 'bg-monokai-cyan text-monokai-bg font-bold' : 'bg-monokai-surface border border-monokai-border text-monokai-comment'
              }`}>1</span>
              <span>业务需求输入</span>
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-monokai-comment/40" />

            <button
              disabled={!draft}
              onClick={() => draft && setStep('workbench')}
              className={`flex items-center gap-2 font-medium cursor-pointer transition-colors ${
                step === 'workbench' ? 'text-monokai-cyan font-bold' : draft ? 'text-monokai-comment hover:text-monokai-fg' : 'text-monokai-comment/40 cursor-not-allowed'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step === 'workbench' ? 'bg-monokai-cyan text-monokai-bg font-bold' : 'bg-monokai-surface border border-monokai-border text-monokai-comment'
              }`}>2</span>
              <span>四要素建模工作台</span>
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-monokai-comment/40" />

            <button
              disabled={!draft}
              onClick={() => draft && setStep('commit')}
              className={`flex items-center gap-2 font-medium cursor-pointer transition-colors ${
                step === 'commit' ? 'text-monokai-cyan font-bold' : draft ? 'text-monokai-comment hover:text-monokai-fg' : 'text-monokai-comment/40 cursor-not-allowed'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step === 'commit' ? 'bg-monokai-cyan text-monokai-bg font-bold' : 'bg-monokai-surface border border-monokai-border text-monokai-comment'
              }`}>3</span>
              <span>写入本体图谱</span>
            </button>
          </div>

          {draft && step === 'workbench' && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-monokai-comment font-mono hidden md:inline">
                {draft.domain}
              </span>

              <button
                onClick={() => setInspectorTab('diagnostics')}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  draft.healthScore >= 85 ? 'bg-monokai-green/15 text-monokai-green border border-monokai-green/30' :
                  draft.healthScore >= 70 ? 'bg-monokai-yellow/15 text-monokai-yellow border border-monokai-yellow/30' :
                  'bg-monokai-orange/15 text-monokai-orange border border-monokai-orange/30'
                }`}
                title="查看模型健康诊断与反模式检查"
              >
                <Activity className="w-3 h-3" />
                健康度 {draft.healthScore}%
              </button>

              <button
                onClick={handleAutoFix}
                title="一键自动修复孤立节点、实例混淆与弱语义关系"
                className="px-2.5 py-1 rounded bg-monokai-surface border border-monokai-border hover:border-monokai-cyan text-xs text-monokai-cyan flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                自动体检修复
              </button>

              <button
                data-testid="enter-commit-step-btn"
                onClick={() => setStep('commit')}
                className="px-3 py-1 rounded bg-monokai-cyan text-monokai-bg font-bold text-xs flex items-center gap-1.5 hover:bg-monokai-cyan/90 transition-colors cursor-pointer"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                写入本体图谱
              </button>
            </div>
          )}
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-monokai-orange/15 border border-monokai-orange/40 text-xs text-monokai-orange flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-monokai-comment hover:text-white">✕</button>
          </div>
        )}

        {/* ── STEP 1: 业务需求输入 ────────────────────────────── */}
        {step === 'input' && !isLoading && (
          <div className="flex-1 p-6 flex flex-col justify-between max-w-4xl mx-auto w-full overflow-y-auto custom-scrollbar">
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-monokai-fg flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-monokai-cyan" />
                  描述您的真实业务需求或数据
                </h3>
                <p className="text-xs text-monokai-comment leading-relaxed">
                  输入自然语言业务流程、实际数据样例或系统描述。AI 将主动萃取核心对象类型 (Object Type)、特征属性 (Property)、业务关联纽带 (Link Type) 和驱动流转动作 (Action Type)。
                </p>
              </div>

              {/* Textarea */}
              <div className="rounded-xl border border-monokai-border bg-monokai-surface/30 p-3.5 focus-within:border-monokai-cyan transition-colors">
                <textarea
                  value={conceptInput}
                  onChange={(e) => setConceptInput(e.target.value)}
                  placeholder="例如：跨境电商履约体系：包含采购客户、商品SKU、交易订单、中央保税仓与物流运单，支持客户下单、仓库出库、运单交付及售后取消退款..."
                  rows={6}
                  className="w-full bg-transparent text-sm text-monokai-fg placeholder-monokai-comment/50 focus:outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Preset Scenarios */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-monokai-comment">快速选用行业模板场景：</span>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {PRESET_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.label}
                      onClick={() => setConceptInput(tmpl.text)}
                      className="p-3 text-left rounded-xl bg-monokai-surface/40 hover:bg-monokai-surface/80 border border-monokai-border/70 hover:border-monokai-cyan/50 transition-all cursor-pointer group space-y-1"
                    >
                      <div className="text-xs font-bold text-monokai-fg group-hover:text-monokai-cyan transition-colors">
                        {tmpl.label}
                      </div>
                      <p className="text-[11px] text-monokai-comment line-clamp-2 leading-relaxed">
                        {tmpl.text}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-6 border-t border-monokai-border/60 flex items-center justify-end gap-3">
              <ActionButton variant="secondary" onClick={onClose}>
                取消
              </ActionButton>
              <ActionButton
                variant="primary"
                onClick={() => handleStartModeling()}
                disabled={!conceptInput.trim()}
                icon={Wand2}
              >
                开始 AI 业务建模
              </ActionButton>
            </div>
          </div>
        )}

        {/* ── LOADING PROGRESS VIEW ────────────────────────── */}
        {isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-monokai-cyan/20 animate-spin" style={{ animationDuration: '3s' }} />
              <div className="absolute inset-1.5 rounded-full border-2 border-monokai-amethyst/30 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
              <div className="absolute inset-3 rounded-full bg-monokai-cyan/15 flex items-center justify-center">
                <BrainCircuit className="w-6 h-6 text-monokai-cyan animate-pulse" />
              </div>
            </div>

            <div className="text-center space-y-2 max-w-sm">
              <h4 className="text-sm font-bold text-monokai-fg">
                {progress?.message || 'AI 正在提炼业务本体 Schema...'}
              </h4>
              <p className="text-xs text-monokai-comment">
                严格分离 Schema 类型图谱与实例验证层，识别四要素与业务状态机
              </p>
            </div>

            <div className="w-64">
              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progress?.progress ?? 20}%`,
                    background: 'linear-gradient(90deg, #bd93f9, #8be9fd)',
                  }}
                />
              </div>
              <span className="text-center block text-[10px] text-monokai-comment mt-1 font-mono">
                {progress?.progress ?? 20}%
              </span>
            </div>
          </div>
        )}

        {/* ── STEP 2: 交互式本体工作台 (Focused Workbench) ───────────── */}
        {step === 'workbench' && draft && (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* ── CENTER HERO: 动态本体图谱预览 (70% or 100% width) ── */}
            <div className={`h-full p-2 min-h-0 overflow-hidden flex flex-col transition-[width] duration-200 ${
              isInspectorCollapsed ? 'w-full' : 'w-[70%]'
            }`}>
              {/* Quick Canvas Toolbar */}
              <div className="h-8 px-2 pb-1 flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddObjectType}
                    className="px-2 py-1 rounded bg-monokai-surface border border-monokai-border hover:border-monokai-cyan text-xs text-monokai-fg flex items-center gap-1 cursor-pointer transition-colors"
                    title="新增对象类型 (Object Type)"
                  >
                    <Plus className="w-3 h-3 text-monokai-cyan" /> +类型 (Type)
                  </button>
                  <button
                    onClick={handleAddLinkType}
                    className="px-2 py-1 rounded bg-monokai-surface border border-monokai-border hover:border-monokai-amethyst text-xs text-monokai-fg flex items-center gap-1 cursor-pointer transition-colors"
                    title="新增关系类型 (Link Type)"
                  >
                    <Plus className="w-3 h-3 text-monokai-amethyst" /> +关系 (Link)
                  </button>
                  <button
                    onClick={handleAddAction}
                    className="px-2 py-1 rounded bg-monokai-surface border border-monokai-border hover:border-monokai-orange text-xs text-monokai-fg flex items-center gap-1 cursor-pointer transition-colors"
                    title="新增业务行动 (Action Type)"
                  >
                    <Plus className="w-3 h-3 text-monokai-orange" /> +行动 (Action)
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* View Mode Toggle */}
                  <div className="flex items-center rounded-lg bg-black/40 border border-monokai-border/60 p-0.5">
                    <button
                      onClick={() => setCanvasViewMode('graph')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                        canvasViewMode === 'graph' ? 'bg-monokai-cyan text-monokai-bg' : 'text-monokai-comment hover:text-white'
                      }`}
                    >
                      图谱拓扑 (Schema)
                    </button>
                    <button
                      onClick={() => setCanvasViewMode('table')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                        canvasViewMode === 'table' ? 'bg-monokai-cyan text-monokai-bg' : 'text-monokai-comment hover:text-white'
                      }`}
                    >
                      四要素列表
                    </button>
                  </div>
                </div>
              </div>

              {/* View Container */}
              {canvasViewMode === 'graph' ? (
                <div className="flex-1 min-h-0">
                  <OntologyWorkbenchGraph
                    objectTypes={draft.objectTypes}
                    linkTypes={draft.linkTypes}
                    actions={draft.actions}
                    selectedTypeName={selectedTypeName}
                    selectedLinkIndex={selectedLinkIndex}
                    onSelectType={(name) => {
                      setSelectedTypeName(name);
                      setSelectedLinkIndex(null);
                    }}
                    onSelectLink={(idx) => {
                      setSelectedLinkIndex(idx);
                      setSelectedTypeName(null);
                      setInspectorTab('links');
                    }}
                    nodePositions={nodePositions}
                    onUpdateNodePosition={handleUpdateNodePosition}
                    isInspectorCollapsed={isInspectorCollapsed}
                    onToggleInspector={() => setIsInspectorCollapsed(prev => !prev)}
                  />
                </div>
              ) : (
                /* Table Matrix View */
                <div className="flex-1 border border-monokai-border rounded-xl bg-monokai-surface/20 p-3 overflow-y-auto custom-scrollbar space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-monokai-fg mb-2">对象类型清单 (Object Types)</h4>
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-monokai-border/70 text-monokai-comment font-mono text-[11px]">
                          <th className="py-1">类型名称</th>
                          <th className="py-1">所属分类</th>
                          <th className="py-1">属性字段</th>
                          <th className="py-1 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.objectTypes.map((ot) => (
                          <tr key={ot.name} className="border-b border-monokai-border/30 hover:bg-monokai-surface/40">
                            <td className="py-1.5 font-bold text-monokai-cyan cursor-pointer" onClick={() => { setSelectedTypeName(ot.name); setCanvasViewMode('graph'); }}>
                              {ot.name}
                            </td>
                            <td className="py-1.5 text-monokai-comment">{ot.category || 'Core'}</td>
                            <td className="py-1.5 text-monokai-fg/80 font-mono text-[10px]">
                              {Object.keys(ot.properties || {}).join(', ') || '无'}
                            </td>
                            <td className="py-1.5 text-right">
                              <button
                                onClick={() => { setSelectedTypeName(ot.name); setCanvasViewMode('graph'); }}
                                className="text-monokai-cyan hover:underline text-[11px]"
                              >
                                编辑
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-monokai-fg mb-2">关系类型清单 (Link Types)</h4>
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-monokai-border/70 text-monokai-comment font-mono text-[11px]">
                          <th className="py-1">关系名</th>
                          <th className="py-1">起点类型</th>
                          <th className="py-1">终点类型</th>
                          <th className="py-1">业务动词</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.linkTypes.map((lt, i) => (
                          <tr key={i} className="border-b border-monokai-border/30">
                            <td className="py-1.5 font-bold text-monokai-amethyst">{lt.name}</td>
                            <td className="py-1.5 text-monokai-fg">{lt.fromType}</td>
                            <td className="py-1.5 text-monokai-fg">{lt.toType}</td>
                            <td className="py-1.5 text-monokai-green font-mono">{lt.verb}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT PANEL: 焦点检查器 (Point-and-Edit Inspector) ── */}
            {isInspectorCollapsed ? (
              <div className="w-10 h-full border-l border-monokai-border bg-monokai-sidebar/60 flex flex-col items-center py-3 min-h-0 shrink-0 select-none">
                <button
                  onClick={() => setIsInspectorCollapsed(false)}
                  title="展开右侧焦点检查器"
                  className="p-1.5 rounded-lg bg-monokai-surface border border-monokai-border hover:border-monokai-cyan text-monokai-cyan transition-colors cursor-pointer mb-3"
                >
                  <PanelRightOpen className="w-3.5 h-3.5" />
                </button>
                <div
                  className="text-[11px] text-monokai-comment flex flex-col items-center tracking-wider font-mono cursor-pointer hover:text-monokai-cyan transition-colors py-2"
                  onClick={() => setIsInspectorCollapsed(false)}
                  style={{ writingMode: 'vertical-rl' }}
                >
                  展开属性与关系面板
                </div>
                {draft.validationIssues.length > 0 && (
                  <div
                    onClick={() => { setIsInspectorCollapsed(false); setInspectorTab('diagnostics'); }}
                    className="mt-auto p-1.5 rounded-full bg-monokai-orange/20 text-monokai-orange cursor-pointer"
                    title={`存在 ${draft.validationIssues.length} 条待优化诊断项`}
                  >
                    <Activity className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                )}
              </div>
            ) : (
              <div className="w-[30%] h-full border-l border-monokai-border bg-monokai-sidebar/40 flex flex-col min-h-0 overflow-hidden shrink-0">
                {/* Inspector Header Tabs */}
                <div className="h-9 px-2 border-b border-monokai-border bg-monokai-surface/40 flex items-center justify-between gap-1 shrink-0">
                  <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {[
                      { id: 'properties', label: '实体属性', icon: Tag, count: currentSelectedType ? Object.keys(currentSelectedType.properties || {}).length : 0 },
                      { id: 'links', label: '关系连线', icon: Link2, count: draft.linkTypes.length },
                      { id: 'actions', label: '行动列表', icon: Zap, count: draft.actions.length },
                      { id: 'verification', label: '示例验证', icon: FileSpreadsheet, count: draft.objects.length },
                      { id: 'diagnostics', label: '体检诊断', icon: Activity, count: draft.validationIssues.length },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const isActive = inspectorTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setInspectorTab(tab.id as InspectorTab)}
                          className={`flex-1 flex items-center justify-center gap-1 py-1 px-1 rounded-lg text-xs transition-all cursor-pointer ${
                            isActive
                              ? 'bg-monokai-cyan/15 text-monokai-cyan font-bold border border-monokai-cyan/30'
                              : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60'
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{tab.label}</span>
                          <span className={`text-[9px] px-1 rounded-full ${
                            tab.id === 'diagnostics' && tab.count > 0 ? 'bg-monokai-orange/20 text-monokai-orange' : 'bg-black/30 text-monokai-comment'
                          }`}>
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setIsInspectorCollapsed(true)}
                    title="收起检查器以全屏预览图谱"
                    className="p-1 rounded hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg transition-colors shrink-0 ml-0.5"
                  >
                    <PanelRightClose className="w-3.5 h-3.5" />
                  </button>
                </div>

              {/* Inspector Body */}
              <div className="flex-1 p-3 space-y-3.5 overflow-y-auto custom-scrollbar min-h-0">
                {/* Real-time Health & Auto-fix Quick Banner */}
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-monokai-surface/40 border border-monokai-border/70 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-monokai-fg">
                    <Activity className="w-3.5 h-3.5 text-monokai-green" />
                    <span>模型健康度:</span>
                    <span className="font-mono font-bold text-monokai-cyan">{draft.healthScore}分</span>
                  </div>
                  <button
                    onClick={handleAutoFix}
                    className="px-2 py-0.5 rounded bg-monokai-surface border border-monokai-border hover:border-monokai-cyan text-xs text-monokai-cyan font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Zap className="w-3 h-3" />
                    一键自动修复防错
                  </button>
                </div>
                {/* 1. CURRENT SELECTED OBJECT TYPE CARD */}
                {currentSelectedType && (
                  <div className="p-3 rounded-xl bg-monokai-surface/50 border border-monokai-border/80 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-monokai-fg">
                        <Edit3 className="w-3.5 h-3.5 text-monokai-cyan" />
                        <span>正在编辑节点:</span>
                        <input
                          type="text"
                          value={currentSelectedType.name}
                          onChange={(e) => handleRenameType(currentSelectedType.name, e.target.value)}
                          className="px-1.5 py-0.5 rounded bg-black/40 border border-monokai-border font-mono font-bold text-monokai-cyan text-xs focus:outline-none focus:border-monokai-cyan w-32"
                        />
                      </div>
                      <button
                        onClick={handleRegenerateNode}
                        disabled={isRefining}
                        className="text-[11px] text-monokai-cyan hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {isRefining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        重新推导该节点
                      </button>
                    </div>

                    {/* Category Selector & Node Merge */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-monokai-comment block mb-1">实体分类 (Category):</span>
                        <select
                          value={currentSelectedType.category || 'Core'}
                          onChange={(e) => handleUpdateTypeCategory(currentSelectedType.name, e.target.value as any)}
                          className="w-full px-2 py-1 rounded bg-black/40 border border-monokai-border text-monokai-fg text-xs focus:outline-none focus:border-monokai-cyan"
                        >
                          <option value="Core">Core (核心业务对象)</option>
                          <option value="Transaction">Transaction (交易与单据)</option>
                          <option value="Master">Master (主数据与主体)</option>
                          <option value="Event">Event (事件与流转)</option>
                        </select>
                      </div>

                      <div>
                        <span className="text-[10px] text-monokai-comment block mb-1">节点合并 (Merge):</span>
                        <div className="flex items-center gap-1">
                          <select
                            value={targetMergeType}
                            onChange={(e) => setTargetMergeType(e.target.value)}
                            className="flex-1 px-1.5 py-1 rounded bg-black/40 border border-monokai-border text-monokai-fg text-xs focus:outline-none focus:border-monokai-cyan"
                          >
                            <option value="">合并至...</option>
                            {draft.objectTypes
                              .filter((t) => t.name !== currentSelectedType.name)
                              .map((t) => (
                                <option key={t.name} value={t.name}>{t.name}</option>
                              ))}
                          </select>
                          <button
                            onClick={handleConfirmMerge}
                            disabled={!targetMergeType}
                            className="px-2 py-1 rounded bg-monokai-amethyst text-monokai-bg font-bold text-xs hover:bg-monokai-amethyst/90 disabled:opacity-40 cursor-pointer"
                          >
                            确认
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. TAB: PROPERTIES */}
                {inspectorTab === 'properties' && currentSelectedType && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-monokai-fg flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-monokai-cyan" />
                        【{currentSelectedType.name}】属性 Schema 字典
                      </span>
                      <button
                        onClick={() => handleAddProperty(`new_prop_${Date.now().toString().slice(-3)}`)}
                        className="text-[11px] text-monokai-cyan hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> 新建属性
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {Object.entries(currentSelectedType.properties || {}).map(([key, propDef]) => {
                        const typeVal = typeof propDef === 'object' && propDef?.type ? propDef.type : String(propDef || 'VARCHAR');
                        return (
                          <div
                            key={key}
                            className="p-1.5 rounded-lg bg-monokai-surface/40 border border-monokai-border/70 flex items-center gap-2 text-xs"
                          >
                            <input
                              type="text"
                              defaultValue={key}
                              onBlur={(e) => {
                                if (e.target.value !== key) {
                                  handleUpdateProperty(key, e.target.value, typeVal);
                                }
                              }}
                              className="flex-1 px-1.5 py-0.5 rounded bg-black/30 border border-monokai-border text-monokai-fg font-mono text-xs focus:outline-none focus:border-monokai-cyan"
                            />
                            <select
                              value={typeVal}
                              onChange={(e) => handleUpdateProperty(key, key, e.target.value)}
                              className="px-1.5 py-0.5 rounded bg-black/40 border border-monokai-border text-monokai-cyan font-mono text-[11px] focus:outline-none"
                            >
                              <option value="VARCHAR">VARCHAR</option>
                              <option value="DECIMAL">DECIMAL</option>
                              <option value="INTEGER">INTEGER</option>
                              <option value="BOOLEAN">BOOLEAN</option>
                              <option value="TIMESTAMP">TIMESTAMP</option>
                              <option value="JSON">JSON</option>
                            </select>
                            <button
                              onClick={() => handleDeleteProperty(key)}
                              className="p-1 rounded text-monokai-comment hover:text-monokai-pink hover:bg-monokai-surface transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. TAB: LINKS (Schema Relationships) */}
                {inspectorTab === 'links' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-monokai-fg flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-monokai-amethyst" />
                        本体关系连线 (Link Types)
                      </span>
                      <button
                        onClick={handleAddLinkType}
                        className="text-[11px] text-monokai-amethyst hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> 新建关联
                      </button>
                    </div>

                    <div className="space-y-2">
                      {draft.linkTypes.map((link, idx) => {
                        const isSelected = selectedLinkIndex === idx;
                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedLinkIndex(idx)}
                            className={`p-2.5 rounded-xl border text-xs space-y-2 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-monokai-amethyst/10 border-monokai-amethyst/60 shadow-sm'
                                : 'bg-monokai-surface/30 border-monokai-border/70 hover:border-monokai-comment/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <input
                                type="text"
                                value={link.name}
                                onChange={(e) => handleUpdateLinkType(idx, { name: e.target.value })}
                                className="font-mono font-bold text-monokai-amethyst bg-transparent border-b border-transparent hover:border-monokai-border focus:border-monokai-amethyst focus:outline-none text-xs"
                              />
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleReverseLinkType(idx); }}
                                  title="反转起点与终点"
                                  className="p-1 rounded hover:bg-monokai-surface text-monokai-comment hover:text-white"
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteLinkType(idx); }}
                                  title="删除关系"
                                  className="p-1 rounded hover:bg-monokai-surface text-monokai-comment hover:text-monokai-pink"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-monokai-fg">
                              <select
                                value={link.fromType}
                                onChange={(e) => handleUpdateLinkType(idx, { fromType: e.target.value })}
                                className="flex-1 px-1.5 py-0.5 rounded bg-black/40 border border-monokai-border font-semibold text-xs"
                              >
                                {draft.objectTypes.map((t) => (
                                  <option key={t.name} value={t.name}>{t.name}</option>
                                ))}
                              </select>
                              <span className="text-monokai-comment">→</span>
                              <input
                                type="text"
                                value={link.verb || ''}
                                placeholder="动词(如 下单)"
                                onChange={(e) => handleUpdateLinkType(idx, { verb: e.target.value })}
                                className="w-20 px-1 py-0.5 rounded bg-black/40 border border-monokai-border text-center text-[11px] text-monokai-green font-mono"
                              />
                              <span className="text-monokai-comment">→</span>
                              <select
                                value={link.toType}
                                onChange={(e) => handleUpdateLinkType(idx, { toType: e.target.value })}
                                className="flex-1 px-1.5 py-0.5 rounded bg-black/40 border border-monokai-border font-semibold text-xs"
                              >
                                {draft.objectTypes.map((t) => (
                                  <option key={t.name} value={t.name}>{t.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. TAB: ACTIONS */}
                {inspectorTab === 'actions' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-monokai-fg flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-monokai-orange" />
                        业务流转行动 (Actions)
                      </span>
                      <button
                        onClick={handleAddAction}
                        className="text-[11px] text-monokai-orange hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> 新建Action
                      </button>
                    </div>

                    <div className="space-y-2">
                      {draft.actions.map((act, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-monokai-surface/40 border border-monokai-border/70 space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <input
                              type="text"
                              value={act.name}
                              onChange={(e) => handleUpdateAction(idx, { name: e.target.value })}
                              className="font-mono font-bold text-monokai-orange bg-transparent border-b border-transparent hover:border-monokai-border focus:border-monokai-orange focus:outline-none text-xs"
                            />
                            <button
                              onClick={() => handleDeleteAction(idx)}
                              className="p-1 rounded hover:bg-monokai-surface text-monokai-comment hover:text-monokai-pink"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[10px] text-monokai-comment block">驱动目标实体:</span>
                              <select
                                value={act.objectName}
                                onChange={(e) => handleUpdateAction(idx, { objectName: e.target.value })}
                                className="w-full px-1.5 py-0.5 rounded bg-black/40 border border-monokai-border text-monokai-fg text-xs"
                              >
                                {draft.objectTypes.map((t) => (
                                  <option key={t.name} value={t.name}>{t.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <span className="text-[10px] text-monokai-comment block">目标状态变迁:</span>
                              <input
                                type="text"
                                value={act.targetStatus || ''}
                                placeholder="如: completed"
                                onChange={(e) => handleUpdateAction(idx, { targetStatus: e.target.value })}
                                className="w-full px-1.5 py-0.5 rounded bg-black/40 border border-monokai-border text-monokai-green text-xs font-mono"
                              />
                            </div>
                          </div>

                          <input
                            type="text"
                            value={act.description || ''}
                            placeholder="业务触发逻辑说明..."
                            onChange={(e) => handleUpdateAction(idx, { description: e.target.value })}
                            className="w-full px-1.5 py-0.5 rounded bg-black/20 border border-monokai-border/50 text-[11px] text-monokai-fg/80"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. TAB: VERIFICATION LAYER (示例与验证层) */}
                {inspectorTab === 'verification' && (
                  <div className="space-y-3">
                    <div className="p-2.5 rounded-xl bg-monokai-surface/40 border border-monokai-border/70 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-monokai-cyan">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>场景实例验证层 (Validation Data)</span>
                      </div>
                      <p className="text-[11px] text-monokai-comment leading-relaxed">
                        实例数据仅用于验证当前 Schema 字段与关系是否合理，不污染本体主模型。确认写入时将同步持久化为测试基准数据。
                      </p>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-monokai-fg">
                        当前类型 【{selectedTypeName || '全部'}】 示例记录：
                      </span>
                      <div className="space-y-1.5">
                        {draft.objects
                          .filter((o) => !selectedTypeName || o.objectType === selectedTypeName)
                          .map((obj, i) => (
                            <div key={i} className="p-2 rounded-lg bg-black/30 border border-monokai-border/60 text-xs font-mono space-y-1">
                              <div className="flex items-center justify-between text-monokai-fg font-bold">
                                <span>{obj.name}</span>
                                <span className="text-[10px] text-monokai-cyan font-normal">{obj.objectType}</span>
                              </div>
                              <div className="text-[10px] text-monokai-comment">
                                {JSON.stringify(obj.properties)}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. TAB: DIAGNOSTICS */}
                {inspectorTab === 'diagnostics' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-monokai-surface/40 border border-monokai-border/70 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-monokai-fg">模型拓扑健康指数</span>
                        <span className="font-mono font-bold text-monokai-cyan text-sm">{draft.healthScore} / 100</span>
                      </div>

                      {draft.validationIssues.length === 0 ? (
                        <div className="p-2 rounded-lg bg-monokai-green/10 border border-monokai-green/30 text-xs text-monokai-green flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>拓扑结构规范，无孤立实体或反模式冲突</span>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                          {draft.validationIssues.map((issue) => (
                            <div
                              key={issue.id}
                              className={`p-2 rounded-lg text-[11px] flex items-start gap-1.5 border ${
                                issue.level === 'error'
                                  ? 'bg-monokai-pink/10 border-monokai-pink/30 text-monokai-pink'
                                  : issue.level === 'warning'
                                  ? 'bg-monokai-orange/10 border-monokai-orange/30 text-monokai-orange'
                                  : 'bg-monokai-cyan/10 border-monokai-cyan/30 text-monokai-cyan'
                              }`}
                            >
                              {issue.level === 'error' ? <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> :
                               issue.level === 'warning' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> :
                               <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                              <div className="flex-1 leading-relaxed">
                                <span className="font-bold mr-1">
                                  {issue.category === 'property_as_node' ? '[属性误建为类型]' :
                                   issue.category === 'hierarchy' ? '[实例/类型混淆]' :
                                   issue.category === 'duplicate' ? '[重复类型定义]' :
                                   issue.category === 'orphan' ? '[孤立游离节点]' : '[关系连线提示]'}
                                </span>
                                <span>{issue.message}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={handleAutoFix}
                        className="w-full py-1.5 rounded-lg bg-monokai-surface border border-monokai-border hover:border-monokai-cyan text-xs text-monokai-cyan font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        一键自动修复防错
                      </button>
                    </div>
                  </div>
                )}

                {/* 7. CONTEXTUAL RATIONALE CARD */}
                <div className="p-2.5 rounded-xl bg-monokai-surface/20 border border-monokai-border/40 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-monokai-fg">
                    <span className="flex items-center gap-1.5 text-monokai-cyan">
                      <Sparkles className="w-3 h-3" />
                      <span>{draft.title}</span>
                    </span>
                    <span className="text-[11px] text-monokai-comment">· 建模设计依据：</span>
                  </div>
                  <p className="text-xs text-monokai-fg/80 leading-relaxed">
                    {draft.rationale}
                  </p>
                </div>
              </div>
            </div>
            )}
          </div>
        )}

        {/* ── STEP 3: 确认写入本体图谱 ────────────────────────── */}
        {step === 'commit' && draft && (
          <div className="flex-1 p-6 flex flex-col justify-between max-w-3xl mx-auto w-full overflow-y-auto custom-scrollbar">
            <div className="space-y-6">
              <div className="space-y-1.5 text-center">
                <h3 className="text-base font-bold text-monokai-fg flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-monokai-green" />
                  确认写入本体知识图谱
                </h3>
                <p className="text-xs text-monokai-comment">
                  模型校验完成，准备将本体定义写入底层持久化知识表
                </p>
              </div>

              {/* Summary Metrics Grid */}
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-xl bg-monokai-surface/40 border border-monokai-border/80">
                  <div className="text-lg font-bold font-mono text-monokai-cyan">{draft.objectTypes.length}</div>
                  <div className="text-[11px] text-monokai-comment">本体类型 (Schema)</div>
                </div>
                <div className="p-3 rounded-xl bg-monokai-surface/40 border border-monokai-border/80">
                  <div className="text-lg font-bold font-mono text-monokai-amethyst">{draft.linkTypes.length}</div>
                  <div className="text-[11px] text-monokai-comment">关系类型 (Link Types)</div>
                </div>
                <div className="p-3 rounded-xl bg-monokai-surface/40 border border-monokai-border/80">
                  <div className="text-lg font-bold font-mono text-monokai-orange">{draft.actions.length}</div>
                  <div className="text-[11px] text-monokai-comment">业务行动 (Actions)</div>
                </div>
                <div className="p-3 rounded-xl bg-monokai-surface/40 border border-monokai-border/80">
                  <div className="text-lg font-bold font-mono text-monokai-green">{draft.objects.length}</div>
                  <div className="text-[11px] text-monokai-comment">场景验证实例</div>
                </div>
              </div>

              {/* Overwrite or Merge Toggle */}
              <div className="p-4 rounded-xl bg-monokai-surface/30 border border-monokai-border/70 space-y-3">
                <span className="text-xs font-bold text-monokai-fg block">写入模式选择：</span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsOverwrite(false)}
                    className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                      !isOverwrite
                        ? 'bg-monokai-cyan/15 border-monokai-cyan text-monokai-cyan font-bold'
                        : 'bg-black/30 border-monokai-border/70 text-monokai-comment hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Check className={`w-4 h-4 ${!isOverwrite ? 'opacity-100' : 'opacity-0'}`} />
                      <span>增量合并写入 (推荐)</span>
                    </div>
                    <p className="text-[11px] text-monokai-comment font-normal leading-relaxed">
                      保留现有数据库中已有本体数据，仅将新萃取的类型、关系及行动增量合入。
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsOverwrite(true)}
                    className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                      isOverwrite
                        ? 'bg-monokai-pink/15 border-monokai-pink text-monokai-pink font-bold'
                        : 'bg-black/30 border-monokai-border/70 text-monokai-comment hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Check className={`w-4 h-4 ${isOverwrite ? 'opacity-100' : 'opacity-0'}`} />
                      <span>全新覆盖写入</span>
                    </div>
                    <p className="text-[11px] text-monokai-comment font-normal leading-relaxed">
                      清空现有本体主表，完全由当前设计的四要素模型全新重建。
                    </p>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Commit Action Buttons */}
            <div className="pt-6 border-t border-monokai-border/60 flex items-center justify-between">
              <ActionButton variant="secondary" onClick={() => setStep('workbench')}>
                <ChevronLeft className="w-3.5 h-3.5" />
                返回修改模型
              </ActionButton>

              <ActionButton
                variant="primary"
                onClick={handleCommitImport}
                disabled={isImporting}
                icon={isImporting ? Loader2 : Database}
              >
                {isImporting ? '正在写入知识表...' : '确认写入本体图谱'}
              </ActionButton>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
};
