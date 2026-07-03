import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Database, Layers, Zap, Settings, X, Edit3, ArrowRight } from 'lucide-react';

// Custom helper: get colors based on nodeType or metadata
export const getNodeColor = (type: string) => {
  switch (type) {
    case 'Source': return '#a78bfa'; // Purple
    case 'Transform': return '#38bdf8'; // Blue
    case 'Control': return '#fb923c'; // Orange
    case 'Sink': return '#4ade80'; // Green
    default: return '#94a3b8';
  }
};

export const SourceNode: React.FC<NodeProps> = ({ id, data }) => {
  const color = getNodeColor('Source');
  return (
    <div
      className="bg-monokai-bg/95 border rounded-xl shadow-xl flex flex-col min-w-[160px] max-w-[240px] pointer-events-auto"
      style={{ borderColor: `${color}40`, boxShadow: `0 4px 15px rgba(0,0,0,0.4)` }}
    >
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-monokai-accent/10 bg-monokai-sidebar/40 rounded-t-xl">
        <Database className="w-3.5 h-3.5 text-monokai-purple" />
        <span className="text-[10px] font-bold text-monokai-purple uppercase tracking-wider">Source</span>
        <button
          onClick={(e) => { e.stopPropagation(); data.onDelete?.(id); }}
          className="ml-auto p-0.5 rounded hover:bg-monokai-red/10 text-monokai-comment hover:text-monokai-red transition-all"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="p-3 flex flex-col justify-center gap-1 min-h-[50px]">
        <div className="text-xs font-bold text-monokai-fg truncate">{data.name || '未命名对象'}</div>
        <div className="text-[10px] text-monokai-comment truncate">{data.tableName || '无绑定表'}</div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: color, border: '2px solid #0d0d14', width: 8, height: 8 }}
      />
    </div>
  );
};

export const TransformNode: React.FC<NodeProps> = ({ id, data }) => {
  const color = getNodeColor('Transform');
  return (
    <div
      className="bg-monokai-bg/95 border rounded-xl shadow-xl flex flex-col min-w-[160px] max-w-[240px] pointer-events-auto"
      style={{ borderColor: `${color}40`, boxShadow: `0 4px 15px rgba(0,0,0,0.4)` }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: color, border: '2px solid #0d0d14', width: 8, height: 8 }}
      />
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-monokai-accent/10 bg-monokai-sidebar/40 rounded-t-xl">
        <Layers className="w-3.5 h-3.5 text-monokai-cyan" />
        <span className="text-[10px] font-bold text-monokai-cyan uppercase tracking-wider">Transform</span>
        <button
          onClick={(e) => { e.stopPropagation(); data.onDelete?.(id); }}
          className="ml-auto p-0.5 rounded hover:bg-monokai-red/10 text-monokai-comment hover:text-monokai-red transition-all"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="p-3 flex flex-col justify-center gap-1 min-h-[50px]">
        <div className="text-xs font-bold text-monokai-fg truncate">{data.name || 'SQL转换'}</div>
        {data.sqlFragment ? (
          <div className="text-[9px] font-mono text-monokai-cyan/70 bg-black/30 px-1.5 py-0.5 rounded truncate">
            {data.sqlFragment}
          </div>
        ) : (
          <div className="text-[9px] text-monokai-comment italic">双击配置 SQL...</div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: color, border: '2px solid #0d0d14', width: 8, height: 8 }}
      />
    </div>
  );
};

export const ControlNode: React.FC<NodeProps> = ({ id, data }) => {
  const color = getNodeColor('Control');
  return (
    <div
      className="bg-monokai-bg/95 border rounded-xl shadow-xl flex flex-col min-w-[160px] max-w-[240px] pointer-events-auto"
      style={{ borderColor: `${color}40`, boxShadow: `0 4px 15px rgba(0,0,0,0.4)` }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: color, border: '2px solid #0d0d14', width: 8, height: 8 }}
      />
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-monokai-accent/10 bg-monokai-sidebar/40 rounded-t-xl">
        <Settings className="w-3.5 h-3.5 text-monokai-orange" />
        <span className="text-[10px] font-bold text-monokai-orange uppercase tracking-wider">Filter</span>
        <button
          onClick={(e) => { e.stopPropagation(); data.onDelete?.(id); }}
          className="ml-auto p-0.5 rounded hover:bg-monokai-red/10 text-monokai-comment hover:text-monokai-red transition-all"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="p-3 flex flex-col justify-center gap-1 min-h-[50px]">
        <div className="text-xs font-bold text-monokai-fg truncate">{data.name || '条件过滤'}</div>
        <div className="text-[9px] font-mono text-monokai-orange/70 bg-black/30 px-1.5 py-0.5 rounded truncate">
          {data.sqlFragment || 'WHERE 1=1'}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: color, border: '2px solid #0d0d14', width: 8, height: 8 }}
      />
    </div>
  );
};

export const SinkNode: React.FC<NodeProps> = ({ id, data }) => {
  const color = getNodeColor('Sink');
  return (
    <div
      className="bg-monokai-bg/95 border rounded-xl shadow-xl flex flex-col min-w-[160px] max-w-[240px] pointer-events-auto"
      style={{ borderColor: `${color}40`, boxShadow: `0 4px 15px rgba(0,0,0,0.4)` }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: color, border: '2px solid #0d0d14', width: 8, height: 8 }}
      />
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-monokai-accent/10 bg-monokai-sidebar/40 rounded-t-xl">
        <Zap className="w-3.5 h-3.5 text-monokai-green" />
        <span className="text-[10px] font-bold text-monokai-green uppercase tracking-wider">Sink</span>
        <button
          onClick={(e) => { e.stopPropagation(); data.onDelete?.(id); }}
          className="ml-auto p-0.5 rounded hover:bg-monokai-red/10 text-monokai-comment hover:text-monokai-red transition-all"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="p-3 flex flex-col justify-center gap-1 min-h-[50px]">
        <div className="text-xs font-bold text-monokai-fg truncate">{data.name || '最终导出'}</div>
        <div className="text-[10px] text-monokai-comment truncate">{data.tableName || '输出到新表'}</div>
      </div>
    </div>
  );
};

export const GroupSpaceNode: React.FC<NodeProps> = ({ id, data }) => {
  return (
    <div
      className="h-full w-full border border-dashed rounded-2xl p-4 bg-monokai-sidebar/20 pointer-events-auto flex flex-col"
      style={{ borderColor: `${data.color || '#a78bfa'}50`, minWidth: 200, minHeight: 160 }}
    >
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-monokai-accent/10">
        <span className="text-[11px] font-bold tracking-wider uppercase font-sans" style={{ color: data.color || '#a78bfa' }}>
          {data.title || '分组空间'}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); data.onDelete?.(id); }}
          className="p-0.5 rounded hover:bg-monokai-red/10 text-monokai-comment hover:text-monokai-red transition-all pointer-events-auto"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="flex-1" />
    </div>
  );
};
