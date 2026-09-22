import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { 
  Play, Sparkles, HelpCircle, CheckCircle2, ShieldCheck, Database, 
  ArrowRight, Activity, Cpu, RefreshCw, RotateCcw, Share2, Calculator,
  ChevronDown, ChevronRight, Search, Filter, Keyboard, Undo2, Redo2,
  Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw as ResetIcon,
  ExternalLink, Link2, Target, Settings, X, Check
} from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';

export interface ObjectTypeItem {
  id: number;
  name: string;
  description: string;
}

export interface ObjectItem {
  id: number;
  object_type_id: number;
  name: string;
  properties: string;
  annotations?: string;
}

export interface LinkTypeItem {
  id: number;
  name: string;
  description: string;
}

export interface LinkItem {
  id: number;
  link_type_id: number;
  source_object_id: number;
  target_object_id: number;
  weight?: number;
}

export interface ActionItem {
  id: number;
  object_id: number;
  name: string;
  description: string;
  status: string;
  execute_at?: string;
}

export interface IntrospectionItem {
  id: number;
  object_id: number;
  question: string;
  answer: string;
  created_at?: string;
}

export interface InsightItem {
  id: number;
  object_id: number;
  insight: string;
  tag?: string;
  created_at?: string;
}

export interface OntologyLessonData {
  _meta: {
    name: string;
    description: string;
    core_concept?: string;
    case_background?: string;
  };
  objectTypes: ObjectTypeItem[];
  objects: ObjectItem[];
  linkTypes: LinkTypeItem[];
  links: LinkItem[];
  actions: ActionItem[];
  introspections: IntrospectionItem[];
  insights: InsightItem[];
}

interface OntologyInteractiveViewerProps {
  data: OntologyLessonData;
}

// ============================================================
// Tab 配置
// ============================================================
type ViewTab = 'graph' | 'topology' | 'actions' | 'introspections' | 'insights';

interface TabConfig {
  id: ViewTab;
  label: string;
  icon: React.ElementType;
  color: string;
  count?: number;
}

const TAB_CONFIGS: TabConfig[] = [
  { id: 'graph', label: '结构视图', icon: Database, color: 'blue', count: 0 },
  { id: 'topology', label: '拓扑网络', icon: Share2, color: 'cyan', count: 0 },
  { id: 'actions', label: '双向行动', icon: Activity, color: 'yellow', count: 0 },
  { id: 'introspections', label: '反思探针', icon: HelpCircle, color: 'purple', count: 0 },
  { id: 'insights', label: '决策洞察', icon: Sparkles, color: 'green', count: 0 },
];

// ============================================================
// 快捷键提示组件
// ============================================================
const KeyboardShortcuts: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const shortcuts = [
    { key: '↑↓', desc: '选择上/下一个对象' },
    { key: 'Enter', desc: '确认选择' },
    { key: 'Tab', desc: '切换视图' },
    { key: 'Ctrl+Z', desc: '撤销操作' },
    { key: 'Ctrl+Y', desc: '重做操作' },
    { key: 'Esc', desc: '关闭此提示' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-monokai-sidebar border border-monokai-border rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-monokai-fg flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-monokai-cyan" />
            键盘快捷键
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 border-b border-monokai-border/50 last:border-0">
              <span className="text-sm text-monokai-comment">{s.desc}</span>
              <kbd className="px-2 py-1 bg-monokai-surface rounded text-xs font-mono text-monokai-fg border border-monokai-border">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 工具栏组件
// ============================================================
const Toolbar: React.FC<{
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  tabCounts: Record<ViewTab, number>;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onShowShortcuts: () => void;
  selectedObjectName?: string;
}> = ({ activeTab, onTabChange, tabCounts, onUndo, onRedo, canUndo, canRedo, onShowShortcuts, selectedObjectName }) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-monokai-blue text-white',
    cyan: 'bg-monokai-cyan text-monokai-bg',
    yellow: 'bg-monokai-yellow text-monokai-bg',
    purple: 'bg-monokai-amethyst text-white',
    green: 'bg-monokai-green text-monokai-bg',
  };

  return (
    <div className="bg-monokai-sidebar px-5 py-3 border-b border-monokai-border flex flex-wrap items-center justify-between gap-3">
      {/* 左侧：标题 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-[10px] font-bold bg-monokai-cyan/20 text-monokai-cyan rounded-full border border-monokai-cyan/30 uppercase tracking-wider">
            {TAB_CONFIGS.find(t => t.id === activeTab)?.color === 'blue' ? 'Structure' :
             TAB_CONFIGS.find(t => t.id === activeTab)?.color === 'cyan' ? 'Topology' :
             TAB_CONFIGS.find(t => t.id === activeTab)?.color === 'yellow' ? 'Action' :
             TAB_CONFIGS.find(t => t.id === activeTab)?.color === 'purple' ? 'Introspect' :
             'Insight'}
          </span>
          <h3 className="text-sm font-bold text-monokai-fg">{TAB_CONFIGS.find(t => t.id === activeTab)?.label}</h3>
        </div>
        {selectedObjectName && (
          <span className="text-xs text-monokai-comment">
            · 已选择: <span className="text-monokai-cyan">{selectedObjectName}</span>
          </span>
        )}
      </div>

      {/* 中间：Tab 切换器 */}
      <div className="flex bg-monokai-surface p-1 rounded-lg border border-monokai-border">
        {TAB_CONFIGS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = tabCounts[tab.id];
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                isActive
                  ? colorMap[tab.color]
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
              title={tab.label}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className={`text-[10px] px-1 rounded-full ${
                isActive ? 'bg-white/20' : 'bg-monokai-bg'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 右侧：操作按钮 */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-2 rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          title="撤销 (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-2 rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          title="重做 (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-monokai-border mx-1" />
        <button
          onClick={onShowShortcuts}
          className="p-2 rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-all"
          title="快捷键"
        >
          <Keyboard className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ============================================================
// 对象详情面板
// ============================================================
const ObjectDetailPanel: React.FC<{
  object: ObjectItem;
  objectType?: ObjectTypeItem;
  links: LinkItem[];
  objects: ObjectItem[];
  linkTypes: LinkTypeItem[];
  onNavigateToObject: (id: number) => void;
  isUpdated: boolean;
}> = ({ object, objectType, links, objects, linkTypes, onNavigateToObject, isUpdated }) => {
  const [showProps, setShowProps] = useState(true);

  // 计算派生属性
  const calculateDerivedProperties = (obj: ObjectItem) => {
    try {
      const props = JSON.parse(obj.properties || '{}');
      if ('confidence' in props || 'credit_score' in props) {
        const baseScore = props.credit_score || (props.confidence ? props.confidence * 100 : 80);
        props._derived_audit_score = Math.min(100, Math.round(baseScore * 1.05));
        props._logic_function_evaluated = 'Func_Audit_Score_V2(baseScore)';
      }
      return props;
    } catch (e) {
      return {};
    }
  };

  // 获取关联链接
  const connectedLinks = useMemo(() => {
    return links.filter(
      (l) => l.source_object_id === object.id || l.target_object_id === object.id
    );
  }, [links, object.id]);

  const derivedProps = calculateDerivedProperties(object);

  return (
    <div className="bg-monokai-sidebar p-4 rounded-lg border border-monokai-border flex flex-col justify-between h-full">
      {object ? (
        <div className="space-y-4">
          {/* 头部 */}
          <div className="flex items-center justify-between border-b border-monokai-border-subtle pb-3">
            <div>
              <h4 className="text-sm font-bold text-monokai-cyan flex items-center gap-2">
                {object.name}
                {isUpdated && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-monokai-green text-monokai-bg font-bold rounded animate-pulse">
                    已跃迁
                  </span>
                )}
              </h4>
              <p className="text-xs text-monokai-comment mt-0.5">
                类型: <span className="text-monokai-fg font-medium">{objectType?.name}</span>
                {objectType?.description && ` (${objectType.description})`}
              </p>
            </div>
            {object.annotations && (
              <span className="px-2 py-1 text-[10px] bg-monokai-yellow/20 text-monokai-yellow rounded border border-monokai-yellow/30 font-medium">
                {object.annotations}
              </span>
            )}
          </div>

          {/* 属性面板 */}
          <div>
            <button
              onClick={() => setShowProps(!showProps)}
              className="w-full flex items-center justify-between text-[11px] font-bold text-monokai-comment uppercase flex items-center gap-1.5 mb-2 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-1">
                <Calculator className="w-3.5 h-3.5 text-monokai-yellow" />
                属性与逻辑函数
              </span>
              {showProps ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            
            {showProps && (
              <pre className="p-3 bg-monokai-surface text-monokai-green rounded-lg text-xs font-mono overflow-x-auto border border-monokai-border-subtle">
                {JSON.stringify(derivedProps, null, 2)}
              </pre>
            )}
          </div>

          {/* 关联链接 */}
          <div>
            <h5 className="text-[11px] font-bold text-monokai-comment uppercase mb-2 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-monokai-green" />
              语义连接 ({connectedLinks.length})
            </h5>
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
              {connectedLinks.length === 0 ? (
                <p className="text-xs text-monokai-comment p-2">暂无关联链接</p>
              ) : (
                connectedLinks.map((l) => {
                  const linkType = linkTypes.find((lt) => lt.id === l.link_type_id);
                  const isSource = l.source_object_id === object.id;
                  const otherObjId = isSource ? l.target_object_id : l.source_object_id;
                  const otherObj = objects.find((o) => o.id === otherObjId);
                  const isOutgoing = l.source_object_id === object.id;

                  return (
                    <div
                      key={l.id}
                      onClick={() => otherObj && onNavigateToObject(otherObj.id)}
                      className="text-xs p-2 bg-monokai-surface rounded border border-monokai-border flex items-center justify-between hover:border-monokai-border-strong cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                          isOutgoing 
                            ? 'bg-monokai-cyan/15 text-monokai-cyan border border-monokai-cyan/30' 
                            : 'bg-monokai-yellow/15 text-monokai-yellow border border-monokai-yellow/30'
                        }`}>
                          {isOutgoing ? '→ 出度' : '← 入度'}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-monokai-bg text-monokai-green border border-monokai-border rounded shrink-0 font-medium">
                          {linkType?.name || '未知关系'}
                        </span>
                        <span className="text-monokai-fg truncate font-medium group-hover:text-monokai-cyan transition-colors">
                          {otherObj?.name || '未知对象'}
                        </span>
                      </div>
                      <Target className="w-3.5 h-3.5 text-monokai-comment opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-monokai-comment text-xs py-8">
          选择左侧对象查看详细属性与连接
        </div>
      )}
    </div>
  );
};

// ============================================================
// 拓扑视图
// ============================================================
const TopologyView: React.FC<{
  objects: ObjectItem[];
  objectTypes: ObjectTypeItem[];
  links?: LinkItem[];
  linkTypes?: LinkTypeItem[];
  selectedObjectId: number | null;
  onSelectObject: (id: number) => void;
  onSwitchToGraph: () => void;
}> = ({ objects, objectTypes, links = [], linkTypes = [], selectedObjectId, onSelectObject, onSwitchToGraph }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // 计算节点位置 (简单布局)
  const nodePositions = useMemo(() => {
    const centerX = 200;
    const centerY = 150;
    const radius = Math.min(140, Math.max(80, objects.length * 28));
    
    return objects.map((obj, idx) => {
      const angle = (idx / objects.length) * 2 * Math.PI - Math.PI / 2;
      return {
        id: obj.id,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        obj,
      };
    });
  }, [objects]);

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.2, 2));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.2, 0.5));
  const handleReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  return (
    <div className="bg-monokai-bg/80 p-5 rounded-lg border border-monokai-cyan/30 relative min-h-[300px] overflow-hidden">
      {/* 工具栏 */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-monokai-sidebar/90 rounded-lg border border-monokai-border p-1">
        <button onClick={handleZoomOut} className="p-1.5 rounded hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg transition-colors" title="缩小">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] text-monokai-comment px-1">{Math.round(zoom * 100)}%</span>
        <button onClick={handleZoomIn} className="p-1.5 rounded hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg transition-colors" title="放大">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-monokai-border mx-0.5" />
        <button onClick={handleReset} className="p-1.5 rounded hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg transition-colors" title="重置">
          <ResetIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 标题 */}
      <h4 className="text-xs font-bold text-monokai-cyan uppercase tracking-wider mb-4 flex items-center justify-between">
        <span>交互式网络拓扑节点图</span>
        <span className="text-[10px] text-monokai-comment font-normal">
          {links.length > 0 ? `已建立 ${links.length} 条有向语义关系 Link` : '实体独立辨识期 · 点击节点跳转详情'}
        </span>
      </h4>

      {/* SVG 画布 */}
      <svg 
        width="100%" 
        height="280" 
        viewBox="0 0 400 300"
        style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, transformOrigin: 'center' }}
        className="transition-transform"
      >
        <defs>
          <marker id="topo-arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#67e8f9" />
          </marker>
        </defs>

        {/* 语义连接线 */}
        {links.length > 0 ? (
          links.map((link) => {
            const srcPos = nodePositions.find(p => p.id === link.source_object_id);
            const tgtPos = nodePositions.find(p => p.id === link.target_object_id);
            if (!srcPos || !tgtPos) return null;
            const linkType = linkTypes.find(lt => lt.id === link.link_type_id);
            const midX = (srcPos.x + tgtPos.x) / 2;
            const midY = (srcPos.y + tgtPos.y) / 2;

            return (
              <g key={`link-${link.id || `${link.source_object_id}-${link.target_object_id}`}`}>
                <line
                  x1={srcPos.x}
                  y1={srcPos.y}
                  x2={tgtPos.x}
                  y2={tgtPos.y}
                  stroke="#67e8f9"
                  strokeWidth="1.5"
                  strokeOpacity="0.45"
                  markerEnd="url(#topo-arrow)"
                />
                {linkType && (
                  <text
                    x={midX}
                    y={midY - 4}
                    textAnchor="middle"
                    fill="#a6e22e"
                    fontSize="7"
                    fontFamily="monospace"
                    className="select-none pointer-events-none"
                  >
                    {linkType.name}
                  </text>
                )}
              </g>
            );
          })
        ) : (
          objects.map((obj, idx) => {
            const pos = nodePositions[idx];
            return objects.slice(idx + 1).map((targetObj) => {
              const targetPos = nodePositions.find(p => p.id === targetObj.id);
              if (!targetPos) return null;
              return (
                <line
                  key={`${obj.id}-${targetObj.id}`}
                  x1={pos.x}
                  y1={pos.y}
                  x2={targetPos.x}
                  y2={targetPos.y}
                  stroke="rgba(103, 232, 249, 0.15)"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                />
              );
            });
          })
        )}

        {/* 节点 */}
        {nodePositions.map(({ id, x, y, obj }) => {
          const isSelected = id === selectedObjectId;
          const typeObj = objectTypes.find(t => t.id === obj.object_type_id);
          
          return (
            <g
              key={id}
              onClick={() => onSelectObject(id)}
              className="cursor-pointer"
            >
              {/* 外圈 */}
              <circle
                cx={x}
                cy={y}
                r={isSelected ? 32 : 28}
                fill={isSelected ? 'rgba(103, 232, 249, 0.2)' : 'rgba(40, 42, 54, 0.8)'}
                stroke={isSelected ? '#67e8f9' : '#45475a'}
                strokeWidth={isSelected ? 2 : 1}
                className="transition-all duration-200"
              />
              
              {/* 内圈 */}
              <circle
                cx={x}
                cy={y}
                r={20}
                fill="#282a36"
                stroke={isSelected ? '#67e8f9' : '#45475a'}
                strokeWidth="1"
              />
              
              {/* ID */}
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fill={isSelected ? '#67e8f9' : '#6272a4'}
                fontSize="10"
                fontWeight="bold"
              >
                #{id}
              </text>
              
              {/* 名称 */}
              <text
                x={x}
                y={y + 45}
                textAnchor="middle"
                fill="#f8f8f2"
                fontSize="9"
              >
                {obj.name.length > 12 ? obj.name.slice(0, 12) + '...' : obj.name}
              </text>
              
              {/* 类型标签 */}
              <text
                x={x}
                y={y + 56}
                textAnchor="middle"
                fill="#6272a4"
                fontSize="7"
              >
                {typeObj?.name?.slice(0, 8) || 'ObjectType'}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ============================================================
// 行动视图
// ============================================================
const ActionsView: React.FC<{
  actions: ActionItem[];
  objects: ObjectItem[];
  onExecuteAction: (action: ActionItem) => void;
  executingActionId: number | null;
  updatedObjectIds: Set<number>;
  onUndo: () => void;
  historyLength: number;
  actionLogs: string[];
  dbSynced: boolean;
}> = ({ actions, objects, onExecuteAction, executingActionId, updatedObjectIds, onUndo, historyLength, actionLogs, dbSynced }) => {
  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between bg-monokai-sidebar p-3 rounded-lg border border-monokai-border">
        <span className="text-xs text-monokai-comment flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-monokai-green" />
          双向 Action 带有事务撤销 (Rollback Undo) 保护
        </span>
        <button
          onClick={onUndo}
          disabled={historyLength === 0}
          className="px-3 py-1.5 bg-monokai-surface text-monokai-fg rounded-md text-xs font-medium hover:bg-monokai-elevated transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 border border-monokai-border"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          撤销 Action ({historyLength})
        </button>
      </div>

      {/* Action 卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actions.map((act) => {
          const targetObj = objects.find((o) => o.id === act.object_id);
          const isRunning = executingActionId === act.id;
          const isExecuted = updatedObjectIds.has(act.object_id);
          
          return (
            <div
              key={act.id}
              className="bg-monokai-sidebar p-4 rounded-lg border border-monokai-yellow/30 flex flex-col justify-between gap-3 shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-monokai-yellow flex items-center gap-1.5">
                    <Activity className="w-4 h-4" />
                    {act.name}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 bg-monokai-surface text-monokai-comment rounded border border-monokai-border-subtle">
                    作用于: {targetObj?.name || '全网'}
                  </span>
                </div>
                <p className="text-xs text-monokai-fg leading-relaxed mb-2">{act.description}</p>
              </div>

              <button
                onClick={() => onExecuteAction(act)}
                disabled={isRunning}
                className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ${
                  isExecuted
                    ? 'bg-monokai-green text-monokai-bg hover:opacity-90'
                    : 'bg-monokai-yellow text-monokai-bg hover:opacity-90'
                }`}
              >
                {isRunning ? (
                  <>
                    <Cpu className="w-4 h-4 animate-spin text-monokai-bg" />
                    双向事务回写中...
                  </>
                ) : isExecuted ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    再次执行 Action 并刷新写回记录
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    执行 Action & 回写底层数据源
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* 日志面板 */}
      {actionLogs.length > 0 && (
        <div className="bg-monokai-surface p-3 rounded-lg border border-monokai-border text-xs font-mono">
          <div className="flex items-center justify-between text-monokai-comment mb-2 text-[10px] uppercase">
            <span>Palantir 双向回写实时日志 (Writeback Audit Trace)</span>
            {dbSynced && (
              <span className="text-monokai-green flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> DuckDB 已同步
              </span>
            )}
          </div>
          <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
            {actionLogs.map((log, idx) => (
              <div key={idx} className="text-monokai-green text-[11px]">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// 反思探针视图
// ============================================================
const IntrospectionsView: React.FC<{
  introspections: IntrospectionItem[];
  objects: ObjectItem[];
  onNavigateToObject: (id: number) => void;
}> = ({ introspections, objects, onNavigateToObject }) => (
  <div className="space-y-3">
    {introspections.map((intro) => {
      const targetObj = objects.find((o) => o.id === intro.object_id);
      
      return (
        <div
          key={intro.id}
          className="bg-monokai-sidebar p-4 rounded-lg border border-monokai-cyan/30 space-y-3"
        >
          {/* 问题 */}
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-bold text-monokai-cyan flex items-center gap-1.5 flex-1">
              <HelpCircle className="w-4 h-4 text-monokai-cyan shrink-0 mt-0.5" />
              探针质询: {intro.question}
            </span>
            <button
              onClick={() => intro.object_id && onNavigateToObject(intro.object_id)}
              className="text-[10px] px-2 py-1 bg-monokai-surface text-monokai-comment rounded border border-monokai-border hover:border-monokai-cyan/50 hover:text-monokai-cyan transition-colors shrink-0"
            >
              对象: {targetObj?.name || '未知'}
            </button>
          </div>
          
          {/* 答案 */}
          <div className="p-3 bg-monokai-surface rounded-lg text-xs text-monokai-fg border border-monokai-border leading-relaxed">
            <span className="font-bold text-monokai-green mr-1">诊断解答:</span>
            {intro.answer}
          </div>
        </div>
      );
    })}
  </div>
);

// ============================================================
// 决策洞察视图
// ============================================================
const InsightsView: React.FC<{
  insights: InsightItem[];
  objects: ObjectItem[];
}> = ({ insights, objects }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {insights.map((ins) => (
      <div
        key={ins.id}
        className="bg-monokai-sidebar p-4 rounded-lg border border-monokai-green/40 flex flex-col justify-between gap-3 shadow-lg"
      >
        <div className="flex items-start gap-2.5">
          <Sparkles className="w-5 h-5 text-monokai-green shrink-0 mt-0.5" />
          <div className="flex-1">
            {ins.tag && (
              <span className="px-2 py-0.5 text-[9px] bg-monokai-green/20 text-monokai-green rounded font-bold uppercase tracking-wider mb-2 inline-block">
                {ins.tag}
              </span>
            )}
            <p className="text-xs text-monokai-fg font-medium leading-relaxed">{ins.insight}</p>
          </div>
        </div>
      </div>
    ))}
  </div>
);

// ============================================================
// 主组件
// ============================================================
export const OntologyInteractiveViewer: React.FC<OntologyInteractiveViewerProps> = ({ data }) => {
  // 状态
  const [activeTab, setActiveTab] = useState<ViewTab>('graph');
  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(data.objects[0]?.id || null);
  const [executingActionId, setExecutingActionId] = useState<number | null>(null);
  const [actionLogs, setActionLogs] = useState<string[]>([]);
  const [dbSynced, setDbSynced] = useState<boolean>(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Undo/Redo 状态
  const [objectsState, setObjectsState] = useState<ObjectItem[]>(data.objects);
  const [historyStack, setHistoryStack] = useState<ObjectItem[][]>([]);
  const [redoStack, setRedoStack] = useState<ObjectItem[][]>([]);
  const [updatedObjectIds, setUpdatedObjectIds] = useState<Set<number>>(new Set());

  // 选中对象
  const selectedObject = objectsState.find((o) => o.id === selectedObjectId);
  const selectedObjectType = data.objectTypes.find((ot) => ot.id === selectedObject?.object_type_id);

  // Tab 计数
  const tabCounts: Record<ViewTab, number> = {
    graph: objectsState.length,
    topology: objectsState.length,
    actions: data.actions.length,
    introspections: data.introspections.length,
    insights: data.insights.length,
  };

  // 导航到对象
  const handleNavigateToObject = useCallback((id: number) => {
    setSelectedObjectId(id);
    setActiveTab('graph');
  }, []);

  // 执行 Action
  const handleExecuteAction = async (action: ActionItem) => {
    setExecutingActionId(action.id);
    const targetObj = objectsState.find((o) => o.id === action.object_id);
    const timeStr = new Date().toLocaleTimeString();

    // 保存 Undo 快照
    setHistoryStack((prev) => [...prev, objectsState]);
    setRedoStack([]); // 清空重做栈

    const logEntry = `[${timeStr}] 触发行动: "${action.name}" -> 作用对象 [${targetObj?.name || '未知'}]`;
    setActionLogs((prev) => [logEntry, ...prev]);

    try {
      // 写回 DuckDB 审计表
      await duckDBService.query(`CREATE TABLE IF NOT EXISTS _sys_ontology_writeback_log (
        id VARCHAR,
        action_name VARCHAR,
        target_object VARCHAR,
        executed_at TIMESTAMP
      );`);

      await duckDBService.query(`INSERT INTO _sys_ontology_writeback_log VALUES (
        'WB-${Date.now()}',
        '${action.name.replace(/'/g, "''")}',
        '${targetObj?.name.replace(/'/g, "''") || ''}',
        CURRENT_TIMESTAMP
      );`);

      // 实时更新 UI
      setObjectsState((prev) =>
        prev.map((obj) => {
          if (obj.id === action.object_id) {
            try {
              const currentProps = JSON.parse(obj.properties || '{}');
              const updatedProps = {
                ...currentProps,
                status: 'Verified_Executed',
                last_writeback: new Date().toLocaleTimeString(),
                _audit_verified: true,
                _logic_eval: 'Logic_Func_Pass_V4',
              };
              return {
                ...obj,
                properties: JSON.stringify(updatedProps),
                annotations: (obj.annotations || '').replace(' (已回写更新)', '') + ' (已回写更新)',
              };
            } catch (e) {
              return obj;
            }
          }
          return obj;
        })
      );

      setUpdatedObjectIds((prev) => new Set(prev).add(action.object_id));
      window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));

      setTimeout(() => {
        setActionLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] ✅ 双向回写成功：DuckDB 底层数据源与 Logic Functions 派生计算均已实时更正！`,
          ...prev,
        ]);
        setExecutingActionId(null);
        setDbSynced(true);
      }, 600);
    } catch (e: any) {
      console.warn('[OntologyViewer] Action execute warning:', e);
      setTimeout(() => {
        setActionLogs((prev) => [`[${new Date().toLocaleTimeString()}] ⚠️ 拟态模拟成功 (底层只读模式)`, ...prev]);
        setExecutingActionId(null);
      }, 500);
    }
  };

  // Undo
  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const previousState = historyStack[historyStack.length - 1];
    setRedoStack((prev) => [...prev, objectsState]);
    setObjectsState(previousState);
    setHistoryStack((prev) => prev.slice(0, prev.length - 1));
    setActionLogs((prev) => [`[${new Date().toLocaleTimeString()}] ↺ 执行事务撤销 (Rollback Undo)：已恢复上一步数字孪生快照`, ...prev]);
  };

  // Redo
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setHistoryStack((prev) => [...prev, objectsState]);
    setObjectsState(nextState);
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setActionLogs((prev) => [`[${new Date().toLocaleTimeString()}] ↻ 执行事务重做 (Redo)：已恢复下一步数字孪生快照`, ...prev]);
  };

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Y: Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
      // Tab: 切换 Tab
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const tabs: ViewTab[] = ['graph', 'topology', 'actions', 'introspections', 'insights'];
        const currentIndex = tabs.indexOf(activeTab);
        const nextIndex = e.shiftKey ? (currentIndex - 1 + tabs.length) % tabs.length : (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex]);
      }
      // Esc: 关闭快捷键提示
      if (e.key === 'Escape') {
        if (showShortcuts) {
          setShowShortcuts(false);
        }
      }
      // ↑↓: 选择上/下一个对象
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const currentIndex = objectsState.findIndex(o => o.id === selectedObjectId);
        const nextIndex = e.key === 'ArrowUp' 
          ? (currentIndex - 1 + objectsState.length) % objectsState.length
          : (currentIndex + 1) % objectsState.length;
        setSelectedObjectId(objectsState[nextIndex].id);
      }
      // Enter: 切换到详情视图
      if (e.key === 'Enter' && selectedObjectId) {
        setActiveTab('graph');
      }
      // ?: 显示快捷键
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        setShowShortcuts(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, selectedObjectId, objectsState, historyStack, redoStack, showShortcuts]);

  return (
    <div className="my-6 bg-monokai-elevated border border-monokai-border rounded-xl overflow-hidden shadow-2xl">
      {/* Meta Header */}
      <div className="bg-monokai-sidebar px-5 py-4 border-b border-monokai-border flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold bg-monokai-cyan/20 text-monokai-cyan rounded-full border border-monokai-cyan/30 uppercase tracking-wider">
              {data._meta.core_concept || 'Palantir Ontology'}
            </span>
            <h3 className="text-base font-bold text-monokai-fg">{data._meta.name}</h3>
          </div>
          <p className="text-xs text-monokai-comment mt-1">{data._meta.description}</p>
        </div>

        {/* 工具栏 */}
        <Toolbar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabCounts={tabCounts}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={historyStack.length > 0}
          canRedo={redoStack.length > 0}
          onShowShortcuts={() => setShowShortcuts(true)}
          selectedObjectName={selectedObject?.name}
        />
      </div>

      {/* Case Background Banner */}
      {data._meta.case_background && (
        <div className="mx-5 mt-4 p-3 bg-monokai-yellow/10 border border-monokai-yellow/30 rounded-lg text-xs text-monokai-fg flex items-start gap-2.5">
          <span className="px-2 py-0.5 text-[9px] bg-monokai-yellow text-monokai-bg font-bold rounded shrink-0 uppercase tracking-wider">
            探索背景案例
          </span>
          <p className="leading-relaxed text-monokai-fg/90 font-medium">{data._meta.case_background}</p>
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-5">
        {/* GRAPH VIEW */}
        {activeTab === 'graph' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Objects List */}
            <div className="md:col-span-1 bg-monokai-sidebar p-3 rounded-lg border border-monokai-border">
              <h4 className="text-xs font-bold text-monokai-comment uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>抽象实体对象</span>
                <span className="text-[10px] text-monokai-cyan font-normal">点击查看详情</span>
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {objectsState.map((obj) => {
                  const isSelected = obj.id === selectedObjectId;
                  const isUpdated = updatedObjectIds.has(obj.id);
                  const typeObj = data.objectTypes.find((t) => t.id === obj.object_type_id);
                  
                  return (
                    <button
                      key={obj.id}
                      onClick={() => setSelectedObjectId(obj.id)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all flex flex-col gap-1 relative overflow-hidden ${
                        isSelected
                          ? 'bg-monokai-cyan/15 border-monokai-cyan text-monokai-fg shadow'
                          : isUpdated
                          ? 'bg-monokai-green/10 border-monokai-green/60 text-monokai-fg'
                          : 'bg-monokai-surface border-monokai-border text-monokai-comment hover:border-monokai-border-strong'
                      }`}
                    >
                      {isUpdated && (
                        <div className="absolute top-0 right-0 bg-monokai-green text-monokai-bg text-[8px] font-bold px-1.5 py-0.5 rounded-bl">
                          已跃迁
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-monokai-fg truncate">{obj.name}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-monokai-sidebar text-monokai-comment border border-monokai-border-subtle">
                          {typeObj?.name || 'ObjectType'}
                        </span>
                      </div>
                      {obj.annotations && (
                        <p className="text-[10px] text-monokai-comment/80 truncate">{obj.annotations}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Object Detail */}
            <div className="md:col-span-2">
              <ObjectDetailPanel
                object={selectedObject!}
                objectType={selectedObjectType}
                links={data.links}
                objects={objectsState}
                linkTypes={data.linkTypes}
                onNavigateToObject={handleNavigateToObject}
                isUpdated={updatedObjectIds.has(selectedObjectId!)}
              />
            </div>
          </div>
        )}

        {/* TOPOLOGY GRAPH CANVAS VIEW */}
        {activeTab === 'topology' && (
          <TopologyView
            objects={objectsState}
            objectTypes={data.objectTypes}
            links={data.links}
            linkTypes={data.linkTypes}
            selectedObjectId={selectedObjectId}
            onSelectObject={(id) => {
              setSelectedObjectId(id);
              setActiveTab('graph');
            }}
            onSwitchToGraph={() => setActiveTab('graph')}
          />
        )}

        {/* ACTIONS VIEW */}
        {activeTab === 'actions' && (
          <ActionsView
            actions={data.actions}
            objects={objectsState}
            onExecuteAction={handleExecuteAction}
            executingActionId={executingActionId}
            updatedObjectIds={updatedObjectIds}
            onUndo={handleUndo}
            historyLength={historyStack.length}
            actionLogs={actionLogs}
            dbSynced={dbSynced}
          />
        )}

        {/* INTROSPECTIONS VIEW */}
        {activeTab === 'introspections' && (
          <IntrospectionsView
            introspections={data.introspections}
            objects={objectsState}
            onNavigateToObject={handleNavigateToObject}
          />
        )}

        {/* INSIGHTS VIEW */}
        {activeTab === 'insights' && (
          <InsightsView
            insights={data.insights}
            objects={objectsState}
          />
        )}
      </div>

      {/* 快捷键提示弹窗 */}
      {showShortcuts && (
        <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
};
