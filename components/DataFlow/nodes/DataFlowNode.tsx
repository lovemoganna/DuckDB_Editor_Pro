/**
 * DataFlowNode - 极简流线型节点组件
 *
 * Handle 协议（硬约束）：
 * - 输出：右侧垂直中点 id="output" (source / Position.Right)
 * - 输入：左侧垂直中点 id="input"  (target / Position.Left)
 * - Join：语义口 left/right 与 input 叠在同一左中锚点，保证视觉上始终「右中 → 左中」
 *
 * 定位策略：绝不覆盖 React Flow 默认的 left/right/transform，
 * 仅设置尺寸与配色，避免 getBoundingClientRect 与路径锚点错位。
 */

import React, { memo, useEffect } from 'react';
import { Handle, Position, NodeProps, useUpdateNodeInternals } from 'reactflow';
import {
  Database,
  Columns,
  Code,
  Link,
  Sigma,
  Table,
  Upload,
  FileSpreadsheet,
  Play,
  RotateCw,
} from 'lucide-react';
import { useWorkflowStore } from '../../../services/dataflow/workflowStore';
import type { DataFlowNodeData } from '../../../services/dataflow/workflowTypes';

/** 可见端口：只改外观，不改 RF 几何定位 */
const HANDLE_VISIBLE: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  border: '2px solid var(--monokai-handle-ring)',
  backgroundColor: 'var(--monokai-accent)',
  zIndex: 30,
};

const HANDLE_CYAN: React.CSSProperties = {
  ...HANDLE_VISIBLE,
  backgroundColor: 'var(--monokai-cyan)',
};

/** Join 语义别名：同锚点、不可见，供历史 edge 的 left/right 仍命中左中 */
const HANDLE_ALIAS: React.CSSProperties = {
  width: 10,
  height: 10,
  opacity: 0,
  pointerEvents: 'none',
  border: 'none',
  background: 'transparent',
  zIndex: 1,
};

export const DataFlowNode: React.FC<NodeProps<DataFlowNodeData>> = memo(({ id, data, selected }) => {
  const selectedNodeId = useWorkflowStore(s => s.selectedNodeId);
  const runSingleCte = useWorkflowStore(s => s.runSingleCte);
  const updateNodeInternals = useUpdateNodeInternals();
  const isSelected = !!selected || selectedNodeId === id || selectedNodeId === data.id;

  // 动态端口变化后强制刷新 handleBounds，杜绝边锚点落到节点中心/顶底
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, data.type, updateNodeInternals]);

  const {
    type,
    title,
    status,
    executionTimeSec,
    rowCount,
    columnCount,
    format,
  } = data;

  const getNodeIcon = () => {
    switch (type) {
      case 'source':
        if (format?.toLowerCase().includes('csv') || title.endsWith('.csv')) {
          return <FileSpreadsheet className="h-3.5 w-3.5 text-monokai-cyan" />;
        }
        return <Database className="h-3.5 w-3.5 text-monokai-blue" />;
      case 'schema':
        return <Columns className="h-3.5 w-3.5 text-monokai-amethyst" />;
      case 'sql_transform':
        return <Code className="h-3.5 w-3.5 text-monokai-amethyst" />;
      case 'join':
        return <Link className="h-3.5 w-3.5 text-monokai-pink" />;
      case 'aggregate':
        return <Sigma className="h-3.5 w-3.5 text-monokai-yellow" />;
      case 'result':
        return <Table className="h-3.5 w-3.5 text-monokai-cyan" />;
      case 'export':
        return <Upload className="h-3.5 w-3.5 text-monokai-cyan" />;
      default:
        return <Database className="h-3.5 w-3.5 text-monokai-fg" />;
    }
  };

  const getIconBg = () => {
    switch (type) {
      case 'source':
        return 'bg-monokai-blue/15 border-monokai-blue/40 text-monokai-blue';
      case 'schema':
      case 'sql_transform':
        return 'bg-monokai-amethyst/15 border-monokai-amethyst/40 text-monokai-amethyst';
      case 'join':
        return 'bg-monokai-pink/15 border-monokai-pink/40 text-monokai-pink';
      case 'aggregate':
        return 'bg-monokai-yellow/15 border-monokai-yellow/40 text-monokai-yellow';
      case 'result':
      case 'export':
        return 'bg-monokai-cyan/15 border-monokai-cyan/40 text-monokai-cyan';
      default:
        return 'bg-monokai-elevated border-monokai-border text-monokai-fg';
    }
  };

  const formatRows = (num?: number) => {
    if (num === undefined || num === null) return '-';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  const highlightState = data.highlightState || 'none';
  const isAncestor = highlightState === 'ancestor';
  const isDescendant = highlightState === 'descendant';
  const isDimmed = highlightState === 'dimmed';

  let borderStyle = '1px solid var(--monokai-border)';
  let boxShadow: string | undefined;

  if (isSelected) {
    borderStyle = '2px solid var(--monokai-accent)';
    boxShadow = '0 0 16px rgba(166, 226, 46, 0.45)';
  } else if (isAncestor) {
    borderStyle = '2px solid var(--monokai-accent)';
    boxShadow = '0 0 14px rgba(166, 226, 46, 0.4)';
  } else if (isDescendant) {
    borderStyle = '2px solid var(--monokai-cyan)';
    boxShadow = '0 0 14px rgba(102, 217, 239, 0.4)';
  }

  return (
    <div
      style={{
        border: borderStyle,
        boxShadow,
        opacity: isDimmed ? 0.35 : 1,
        width: 208,
        height: 52,
      }}
      className={`group relative rounded-lg bg-monokai-surface/95 px-2.5 py-1.5 text-monokai-fg backdrop-blur-md transition-all duration-150 select-none flex items-center justify-between gap-2 ${
        !isSelected && !isAncestor && !isDescendant ? 'hover:border-monokai-border-strong hover:bg-monokai-elevated' : ''
      }`}
      title={`${title}\n状态: ${status || '就绪'}\n行数: ${rowCount !== undefined ? rowCount.toLocaleString() : '未统计'}`}
    >
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${getIconBg()}`}>
        {getNodeIcon()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-xs font-semibold text-monokai-fg leading-snug font-mono">
            {title}
          </span>
          {isAncestor && (
            <span className="shrink-0 px-1 py-0.2 rounded bg-monokai-accent/20 text-monokai-accent text-3xs font-mono border border-monokai-accent/40">
              源
            </span>
          )}
          {isDescendant && (
            <span className="shrink-0 px-1 py-0.2 rounded bg-monokai-cyan/20 text-monokai-cyan text-3xs font-mono border border-monokai-cyan/40">
              去
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[9.5px] text-monokai-comment leading-tight mt-0.5 font-mono truncate">
          <span>{type}</span>
          {columnCount !== undefined && (
            <>
              <span>·</span>
              <span>{columnCount}列</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end shrink-0 pl-1">
        <div className="flex items-center gap-1 font-mono text-[10.5px]">
          {data.filterRatio !== undefined && (
            <span className={`text-[8.5px] font-bold px-0.5 rounded ${data.filterRatio >= 0 ? 'text-monokai-accent' : 'text-monokai-pink'}`}>
              {data.filterRatio >= 0 ? `↓${data.filterRatio}%` : `↑${Math.abs(data.filterRatio)}%`}
            </span>
          )}
          <span className="font-semibold text-monokai-fg">
            {formatRows(rowCount)}
          </span>
        </div>

        <div className="flex items-center gap-1 mt-0.5">
          {status === 'running' ? (
            <span className="flex items-center gap-0.5 text-3xs text-monokai-yellow font-mono">
              <RotateCw className="w-2.5 h-2.5 animate-spin" />
              <span>运行中</span>
            </span>
          ) : status === 'error' ? (
            <span className="flex items-center gap-0.5 text-3xs text-monokai-pink font-mono" title="执行报错">
              <span className="w-1.5 h-1.5 rounded-full bg-monokai-pink animate-pulse" />
              <span>报错</span>
            </span>
          ) : status === 'dirty' ? (
            <span className="flex items-center gap-0.5 text-3xs text-monokai-orange font-mono" title="上游变更需重跑">
              <span className="w-1.5 h-1.5 rounded-full bg-monokai-orange" />
              <span>待跑</span>
            </span>
          ) : status === 'success' ? (
            <span className="flex items-center gap-0.5 text-3xs text-monokai-accent font-mono" title="DuckDB 数据就绪">
              <span className="w-1.5 h-1.5 rounded-full bg-monokai-accent shadow-[0_0_5px_rgba(166,226,46,0.6)]" />
              <span>{executionTimeSec !== undefined ? `${executionTimeSec}s` : 'OK'}</span>
            </span>
          ) : (
            <span className="flex items-center gap-0.5 text-3xs text-monokai-comment font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-monokai-comment/60" />
              <span>就绪</span>
            </span>
          )}

          {type !== 'source' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                runSingleCte(id);
              }}
              disabled={status === 'running'}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/[0.1] text-monokai-comment hover:text-monokai-accent transition-all cursor-pointer"
              title={`就地单步试跑「${title}」`}
            >
              <Play className="h-2.5 w-2.5 fill-current" />
            </button>
          )}
        </div>
      </div>

      {/* ── 左侧输入：统一垂直中点 ── */}
      {type !== 'source' && (
        <>
          <Handle
            id="input"
            type="target"
            position={Position.Left}
            className="dataflow-node-handle"
            style={type === 'join' ? HANDLE_CYAN : HANDLE_VISIBLE}
            title={type === 'join' ? 'Join 输入（左中）' : '数据输入 (Input)'}
          />
          {/* Join 语义口与 input 同锚左中，保证历史 left/right 边仍落在中点 */}
          {type === 'join' && (
            <>
              <Handle
                id="left"
                type="target"
                position={Position.Left}
                style={HANDLE_ALIAS}
                isConnectable={false}
              />
              <Handle
                id="right"
                type="target"
                position={Position.Left}
                style={HANDLE_ALIAS}
                isConnectable={false}
              />
            </>
          )}
        </>
      )}

      {/* ── 右侧输出：统一垂直中点 ── */}
      {type !== 'export' && (
        <Handle
          id="output"
          type="source"
          position={Position.Right}
          className="dataflow-node-handle"
          style={HANDLE_VISIBLE}
          title="数据输出 (Output)"
        />
      )}
    </div>
  );
});

DataFlowNode.displayName = 'DataFlowNode';
