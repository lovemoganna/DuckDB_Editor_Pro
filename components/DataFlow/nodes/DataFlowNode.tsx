/**
 * DataFlowNode - 现代化本体图谱风格真实 SQL 执行路径节点
 *
 * 核心设计原则：
 * 1. 真实物理执行路径：展示扫描(SCAN) -> 过滤(FILTER) -> 连接(JOIN) -> 聚合(AGGREGATE) -> 排序(SORT) -> 结果(RESULT)
 * 2. 视觉对标【AI认知】本体图谱：暗色磨砂玻璃、发光描边、呼吸状态灯、缩放自适应 (Zoom Adaptive)
 * 3. 极简 3 行高信噪比卡片：
 *    - 行 1: 执行步骤序号 (S1) + 算子图标与类型 (SCAN orders) + 耗时/瓶颈占比/异常指示 (🚨 / 🔥45% / 0.3ms)
 *    - 行 2: 核心执行上下文 (下推过滤条件 / 连接键 / 分组列 / 物理表名)
 *    - 行 3: 数据吞吐与变化 (输入行 ➔ 输出行 ↓削减率) + 结果列数
 * 4. 杜绝卡片内部折叠展开导致的画布几何跳变，深层诊断与采样数据统一归集至 Inspector
 */

import React, { memo, useEffect } from 'react';
import { Handle, Position, NodeProps, useUpdateNodeInternals, useViewport } from 'reactflow';
import {
  Database,
  Filter,
  Link2,
  Sigma,
  Table,
  Code,
  Upload,
  FileSpreadsheet,
  Play,
  AlertCircle,
  Zap,
  Compass,
  ArrowDownWideNarrow,
  Layers,
} from 'lucide-react';
import { useWorkflowStore } from '../../../services/dataflow/workflowStore';
import {
  dispatchDataflowTraceFault,
  dispatchFocusSqlEditor,
} from '../../../services/dataflow/dataflowEvents';
import type { DataFlowNodeData } from '../../../services/dataflow/workflowTypes';
import { DF_COLOR, DF_STATUS_LABEL } from '../dataflowUi';

export const DATAFLOW_NODE_CARD_WIDTH = 224;
export const DATAFLOW_NODE_CARD_HEIGHT = 74;

/** 可见端口：只改外观，不改 RF 几何定位 */
const HANDLE_VISIBLE: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  border: `2px solid ${DF_COLOR.handleRing}`,
  backgroundColor: DF_COLOR.accent,
  zIndex: 30,
};

/** Join 语义别名：同锚点、不可见，供历史 edge 的 left/right 仍命中左中 */
const HANDLE_ALIAS: React.CSSProperties = {
  width: 9,
  height: 9,
  opacity: 0,
  pointerEvents: 'none',
  border: 'none',
  background: 'transparent',
  zIndex: 1,
};

const COMPACT_ZOOM_THRESHOLD = 0.45;

export const DataFlowNode: React.FC<NodeProps<DataFlowNodeData>> = memo(({ id, data, selected }) => {
  const selectedNodeId = useWorkflowStore(s => s.selectedNodeId);
  const updateNodeInternals = useUpdateNodeInternals();
  const { zoom } = useViewport();

  const isSelected = !!selected || selectedNodeId === id || selectedNodeId === data.id;
  const isCompact = zoom < COMPACT_ZOOM_THRESHOLD;
  const vertical = data.flowDirection === 'DOWN';
  const inputPosition = vertical ? Position.Top : Position.Left;
  const outputPosition = vertical ? Position.Bottom : Position.Right;
  const anchorStyle = (output = false, fraction = '50%'): React.CSSProperties => vertical
    ? { left: fraction, top: output ? undefined : -4, bottom: output ? -4 : undefined, transform: 'translateX(-50%)' }
    : { left: output ? undefined : -4, right: output ? -4 : undefined, top: fraction, transform: 'translateY(-50%)' };

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, data.type, data.flowDirection, isCompact, updateNodeInternals]);

  const {
    type,
    title,
    status,
    executionTimeSec,
    rowCount,
    columnCount,
    format,
    stepIndex,
    sqlStage,
    paradigm,
    bugInfo,
    hasAnomaly,
    clauseSnippet,
    inputRowCount,
    filterRatio,
  } = data;

  const getNodeIcon = () => {
    if (sqlStage === 'where' || type === 'schema') {
      return <Filter className="h-3.5 w-3.5 text-monokai-orange" />;
    }
    if (sqlStage === 'having') {
      return <Filter className="h-3.5 w-3.5 text-monokai-pink" />;
    }
    if (sqlStage === 'orderby' || data.config?.operatorName?.toLowerCase().includes('order') || data.config?.operatorName?.toLowerCase().includes('sort') || data.config?.operatorName?.toLowerCase().includes('limit')) {
      return <ArrowDownWideNarrow className="h-3.5 w-3.5 text-monokai-cyan" />;
    }
    if (data.config?.operatorName?.toLowerCase().includes('window')) {
      return <Layers className="h-3.5 w-3.5 text-monokai-amethyst" />;
    }
    switch (type) {
      case 'source':
        if (format?.toLowerCase().includes('csv') || title?.endsWith('.csv')) {
          return <FileSpreadsheet className="h-3.5 w-3.5 text-monokai-cyan" />;
        }
        return <Database className="h-3.5 w-3.5 text-monokai-blue" />;
      case 'sql_transform':
        return <Code className="h-3.5 w-3.5 text-monokai-amethyst" />;
      case 'join':
        return <Link2 className="h-3.5 w-3.5 text-monokai-pink" />;
      case 'aggregate':
        return <Sigma className="h-3.5 w-3.5 text-monokai-yellow" />;
      case 'result':
        return <Table className="h-3.5 w-3.5 text-monokai-accent" />;
      case 'export':
        return <Upload className="h-3.5 w-3.5 text-monokai-cyan" />;
      default:
        return <Database className="h-3.5 w-3.5 text-monokai-fg" />;
    }
  };

  const getIconBg = () => {
    if (sqlStage === 'where' || type === 'schema') {
      return 'bg-monokai-orange/15 border-monokai-orange/35 text-monokai-orange';
    }
    if (sqlStage === 'having') {
      return 'bg-monokai-pink/15 border-monokai-pink/35 text-monokai-pink';
    }
    if (sqlStage === 'orderby' || data.config?.operatorName?.toLowerCase().includes('order') || data.config?.operatorName?.toLowerCase().includes('sort') || data.config?.operatorName?.toLowerCase().includes('limit')) {
      return 'bg-monokai-cyan/15 border-monokai-cyan/35 text-monokai-cyan';
    }
    if (data.config?.operatorName?.toLowerCase().includes('window')) {
      return 'bg-monokai-amethyst/15 border-monokai-amethyst/35 text-monokai-amethyst';
    }
    switch (type) {
      case 'source':
        return 'bg-monokai-blue/15 border-monokai-blue/35 text-monokai-blue';
      case 'sql_transform':
        return 'bg-monokai-amethyst/15 border-monokai-amethyst/35 text-monokai-amethyst';
      case 'join':
        return 'bg-monokai-pink/15 border-monokai-pink/35 text-monokai-pink';
      case 'aggregate':
        return 'bg-monokai-yellow/15 border-monokai-yellow/35 text-monokai-yellow';
      case 'result':
      case 'export':
        return 'bg-monokai-accent/15 border-monokai-accent/35 text-monokai-accent';
      default:
        return 'bg-monokai-elevated border-monokai-border text-monokai-fg';
    }
  };

  const formatRows = (num?: number) => {
    if (num === undefined || num === null) return '-';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  const highlightState = data.highlightState || 'none';
  const isAncestor = highlightState === 'ancestor';
  const isDescendant = highlightState === 'descendant';
  const isDimmed = highlightState === 'dimmed';
  const hasBug = !!bugInfo?.hasBug || status === 'error';
  const isWarning = !!hasAnomaly || bugInfo?.severity === 'warning';
  const isStepActive = data.executionStatus==='running'||!!data.isStepActive;
  const isStepCompleted = data.executionStatus==='success'&&!data.rolledBack||!!data.isStepCompleted;
  const executionLabel=data.rolledBack?'已回滚':({queued:'等待',running:'执行中',success:'成功',failed:'失败',cancelled:'已取消',skipped:'已跳过'} as const)[data.executionStatus!]||'就绪';

  let borderStyle = `1px solid ${DF_COLOR.border}`;
  let boxShadow: string | undefined;

  // 选中态优先级：error > selected > anomaly > lineage > idle
  if (hasBug) {
    borderStyle = `2px solid ${DF_COLOR.pink}`;
    boxShadow = `0 0 14px color-mix(in srgb, ${DF_COLOR.pink} 45%, transparent)`;
  } else if (isSelected) {
    borderStyle = `2px solid ${DF_COLOR.accent}`;
    boxShadow = `0 0 12px color-mix(in srgb, ${DF_COLOR.accent} 35%, transparent)`;
  } else if (isWarning) {
    borderStyle = `1.5px solid ${DF_COLOR.orange}`;
    boxShadow = `0 0 10px color-mix(in srgb, ${DF_COLOR.orange} 30%, transparent)`;
  } else if (isStepActive) {
    borderStyle = `2px solid ${DF_COLOR.yellow}`;
    boxShadow = `0 0 12px color-mix(in srgb, ${DF_COLOR.yellow} 40%, transparent)`;
  } else if (isStepCompleted) {
    borderStyle = `1.5px solid color-mix(in srgb, ${DF_COLOR.accent} 50%, transparent)`;
  } else if (isAncestor) {
    borderStyle = `2px solid ${DF_COLOR.accent}`;
    boxShadow = `0 0 10px color-mix(in srgb, ${DF_COLOR.accent} 30%, transparent)`;
  } else if (isDescendant) {
    borderStyle = `2px solid ${DF_COLOR.cyan}`;
    boxShadow = `0 0 10px color-mix(in srgb, ${DF_COLOR.cyan} 30%, transparent)`;
  }

  // ── 紧凑鸟瞰：保持统一 224×74 盒模型，内容视觉缩放，避免边线错位 ──
  if (isCompact) {
    return (
      <div
        style={{
          border: borderStyle,
          boxShadow,
          opacity: isDimmed ? 0.35 : 1,
          width: DATAFLOW_NODE_CARD_WIDTH,
          height: DATAFLOW_NODE_CARD_HEIGHT,
        }}
        className="group relative rounded-lg bg-monokai-surface/95 px-2.5 text-monokai-fg backdrop-blur-md transition-all duration-150 select-none flex items-center justify-between gap-1.5 cursor-pointer"
        data-execution-status={data.executionStatus || status}
        data-statement-id={data.statementId}
        title={`${title} ${executionLabel}`}
      >
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border ${getIconBg()}`}>
          {getNodeIcon()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            {stepIndex !== undefined && (
              <span className="shrink-0 px-1 rounded bg-monokai-elevated text-monokai-comment text-3xs font-mono font-bold">
                S{stepIndex}
              </span>
            )}
            <span className="truncate text-2xs font-semibold text-monokai-fg font-mono">
              {title}
            </span>
          </div>
          <div className="text-3xs text-monokai-comment font-mono truncate">
            {data.rolledBack?'已回滚':data.executionStatus==='running'?'执行中':data.executionStatus==='queued'?'等待':rowCount !== undefined ? `${formatRows(rowCount)} 行` : data.executionStatus?executionLabel:type}
          </div>
        </div>

        <div className="shrink-0">
          {hasBug ? (
            <span className="w-2 h-2 rounded-full bg-monokai-pink" />
          ) : isWarning ? (
            <span className="w-2 h-2 rounded-full bg-monokai-orange" />
          ) : status === 'success' ? (
            <span className="w-1.5 h-1.5 rounded-full bg-monokai-accent/70" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-monokai-comment/50" />
          )}
        </div>

        {(type !== 'source' || data.logicalKind) && (
          <Handle
            type="target"
            position={inputPosition}
            id="input"
            style={{ ...HANDLE_VISIBLE, ...anchorStyle() }}
          />
        )}
        {type === 'join' && data.logicalKind && ['left','right'].map((handle,index)=><Handle key={handle} type="target" position={inputPosition} id={handle} style={{...HANDLE_VISIBLE,...anchorStyle(false,index?'65%':'35%')}}/>)}
        {type !== 'export' && (
          <Handle
            type="source"
            position={outputPosition}
            id="output"
            style={{ ...HANDLE_VISIBLE, ...anchorStyle(true) }}
          />
        )}
      </div>
    );
  }

  // ── 现代标准极简执行算子卡片 (Zero Clutter, High Signal) ──
  return (
    <div
      style={{
        border: borderStyle,
        boxShadow,
        opacity: isDimmed ? 0.35 : 1,
        width: DATAFLOW_NODE_CARD_WIDTH,
        height: DATAFLOW_NODE_CARD_HEIGHT,
      }}
      data-execution-status={data.executionStatus || status}
      data-statement-id={data.statementId}
      className={`group relative rounded-md bg-monokai-surface/95 text-monokai-fg backdrop-blur-md transition-all duration-150 select-none shadow-md flex flex-col justify-between p-2 cursor-pointer ${
        !isSelected && !isAncestor && !isDescendant && !hasBug && !isWarning
          ? 'hover:border-monokai-accent/40 hover:bg-monokai-elevated/90'
          : ''
      } ${hasBug ? 'ring-1 ring-monokai-pink/40' : ''}`}
    >
      {/* 行 1：步骤序号 + 算子类型/表名 + 状态指示 */}
      <div className="flex h-5 items-center justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${getIconBg()}`}>
            {getNodeIcon()}
          </div>
          <div className="flex items-center gap-1 min-w-0 truncate">
            {stepIndex !== undefined && (
              <span className="shrink-0 px-1 py-0.2 rounded text-3xs font-mono font-bold bg-monokai-elevated text-monokai-comment border border-monokai-border">
                S{stepIndex}
              </span>
            )}
            <span className="truncate text-xs font-semibold text-monokai-fg leading-tight font-mono tracking-tight" title={title}>
              {title}
            </span>
          </div>
        </div>

        {/* 右侧状态微徽标 */}
        <div className="shrink-0 flex items-center gap-1">
          {hasBug ? (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-3xs font-mono font-bold bg-monokai-pink/20 text-monokai-pink border border-monokai-pink/40">
              <AlertCircle className="w-2.5 h-2.5" />
              <span>异常</span>
            </span>
          ) : data.config?.isBottleneck ? (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-3xs font-mono font-bold bg-monokai-orange/20 text-monokai-orange border border-monokai-orange/40" title="耗时瓶颈算子">
              <Zap className="w-2.5 h-2.5 fill-current" />
              <span>{data.config.costPercent}%</span>
            </span>
          ) : data.executionStatus ? (
            <span className={`text-3xs font-mono ${isStepActive ? 'text-monokai-yellow' : 'text-monokai-comment'}`}>{executionLabel}</span>
          ) : isStepActive ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-mono font-bold bg-monokai-yellow/20 text-monokai-yellow border border-monokai-yellow/50">
              <Play className="w-2 h-2 fill-current" />
            </span>
          ) : ['running', 'queued', 'dirty', 'blocked', 'cancelled'].includes(status) ? (
            <span className={`text-2xs font-mono ${status === 'running' ? 'text-monokai-accent' : 'text-monokai-orange'}`}>{DF_STATUS_LABEL[status]}</span>
          ) : executionTimeSec !== undefined ? (
            <span className="text-3xs font-mono text-monokai-comment">
              {(executionTimeSec * 1000).toFixed(0)}ms
            </span>
          ) : data.config?.costPercent ? (
            <span className="text-3xs font-mono text-monokai-comment">
              {data.config.costPercent}%
            </span>
          ) : (
            <span className="text-3xs font-mono text-monokai-comment/70">—</span>
          )}
        </div>
      </div>

      {/* 行 2：核心条件 / 谓词 / 关键表达式 (稳定 h-[18px]) */}
      {(data.predicate || data.joinSummary || data.groupBySummary || clauseSnippet) ? (
        <div
          className="h-[18px] w-full rounded bg-monokai-bg/80 border border-monokai-border px-1.5 text-3xs font-mono text-monokai-fg-muted truncate leading-none flex items-center gap-1 min-w-0"
          title={data.predicate || data.joinSummary || data.groupBySummary || clauseSnippet}
        >
          {data.predicate ? (
            <>
              <Filter className="w-2.5 h-2.5 shrink-0 text-monokai-orange" />
              <span className="text-monokai-orange truncate">{data.predicate}</span>
            </>
          ) : data.joinSummary ? (
            <>
              <Link2 className="w-2.5 h-2.5 shrink-0 text-monokai-pink" />
              <span className="text-monokai-pink truncate">{data.joinSummary}</span>
            </>
          ) : data.groupBySummary ? (
            <>
              <Sigma className="w-2.5 h-2.5 shrink-0 text-monokai-yellow" />
              <span className="text-monokai-yellow truncate">{data.groupBySummary}</span>
            </>
          ) : (
            <>
              <Code className="w-2.5 h-2.5 shrink-0 text-monokai-cyan" />
              <span className="text-monokai-cyan truncate">{clauseSnippet}</span>
            </>
          )}
        </div>
      ) : (
        <div className="h-[18px] text-3xs font-mono text-monokai-comment truncate px-1 flex items-center min-w-0">
          <span className="truncate">{data.tableName ? `数据表: ${data.tableName}` : (paradigm?.stageName || data.subtitle || type)}</span>
        </div>
      )}

      {/* 行 3：吞吐 / 异常可操作 CTA (带 min-w-0 截断保护) */}
      <div className="flex h-[18px] items-center justify-between text-3xs font-mono text-monokai-comment border-t border-monokai-border/70 pt-0.5 min-w-0">
        <div className="flex items-center gap-1 min-w-0 truncate mr-1">
          {inputRowCount !== undefined && (
            <span className="truncate shrink-0">{formatRows(inputRowCount)} ➔</span>
          )}
          <span className="font-semibold text-monokai-fg truncate shrink-0">
            {rowCount !== undefined ? `${formatRows(rowCount)} 行` : '—'}
          </span>
          {filterRatio !== undefined && (
            <span className={`text-3xs font-bold px-1 rounded shrink-0 ${filterRatio >= 0 ? 'bg-monokai-accent/15 text-monokai-accent' : 'bg-monokai-pink/15 text-monokai-pink'}`}>
              {filterRatio >= 0 ? `↓${filterRatio}%` : `↑${Math.abs(filterRatio)}%`}
            </span>
          )}
        </div>

        {hasBug ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dispatchDataflowTraceFault({
                  nodeId: id,
                  openInspector: true,
                  focusSql: false,
                });
              }}
              className="text-3xs font-sans px-1.5 py-0.2 rounded bg-monokai-elevated hover:bg-monokai-border text-monokai-fg font-semibold transition-colors cursor-pointer border border-monokai-border"
              title="打开右侧诊断详情"
            >
              诊断
            </button>
            {data.sqlRange && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  useWorkflowStore.setState({ activeSqlRange: data.sqlRange || null });
                  dispatchFocusSqlEditor({ sqlRange: data.sqlRange });
                }}
                className="text-3xs font-sans px-1.5 py-0.2 rounded bg-monokai-pink/20 hover:bg-monokai-pink/30 text-monokai-pink font-semibold transition-colors cursor-pointer border border-monokai-pink/40"
                title={`返回 SQL 第 ${data.sqlRange.startLine} 行修正`}
              >
                回 SQL
              </button>
            )}
          </div>
        ) : type === 'result' ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              useWorkflowStore.getState().traceReverseLineage(id);
            }}
            className="text-3xs font-sans px-1.5 py-0.2 rounded bg-monokai-accent/15 hover:bg-monokai-accent/25 text-monokai-accent font-semibold transition-colors cursor-pointer border border-monokai-accent/30 flex items-center gap-0.5 shrink-0"
            title="一键从最终结果反向追溯至所有底层输入数据源"
          >
            <Compass className="w-2.5 h-2.5" />
            <span>反向追溯</span>
          </button>
        ) : columnCount !== undefined ? (
          <span className="text-3xs text-monokai-comment shrink-0">
            {columnCount}列
          </span>
        ) : null}
      </div>

      {/* 端口 Handles：export 为终端节点，不暴露输出端口 */}
      {(type !== 'source' || data.logicalKind) && (
        <>
          <Handle
            type="target"
            position={inputPosition}
            id="input"
            style={{ ...HANDLE_VISIBLE, ...anchorStyle() }}
            className="dataflow-node-handle"
          />
          <Handle
            type="target"
            position={inputPosition}
            id="left"
            style={{ ...HANDLE_ALIAS, ...anchorStyle(false, data.logicalKind ? '35%' : '50%') }}
            className="dataflow-node-handle"
          />
          <Handle
            type="target"
            position={inputPosition}
            id="right"
            style={{ ...HANDLE_ALIAS, ...anchorStyle(false, data.logicalKind ? '65%' : '50%') }}
            className="dataflow-node-handle"
          />
        </>
      )}

      {type !== 'export' && (
        <Handle
          type="source"
          position={outputPosition}
          id="output"
          style={{ ...HANDLE_VISIBLE, ...anchorStyle(true) }}
          className="dataflow-node-handle"
        />
      )}
    </div>
  );
});

DataFlowNode.displayName = 'DataFlowNode';
