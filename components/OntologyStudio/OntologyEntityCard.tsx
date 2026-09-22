import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Database, Key, Hash, Layers, Trash2, ArrowRight, Activity } from 'lucide-react';
import { OntologyEntity } from '../../types/ontologyStudioTypes';
import { useOntologyStudioStore } from '../../hooks/useOntologyStudioStore';

export interface EntityNodeData {
  entity: OntologyEntity;
}

const formatNumber = (num?: number): string => {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
};

export const OntologyEntityCard: React.FC<NodeProps<EntityNodeData>> = memo(({ data, selected }) => {
  const { entity } = data;
  const { selectElement, deleteEntity } = useOntologyStudioStore();

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectElement('entity', entity.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteEntity(entity.id);
  };

  const accentColor = entity.color || '#66d9ef';

  return (
    <div
      onClick={handleCardClick}
      className={`relative w-[280px] rounded-lg border bg-monokai-surface shadow-md transition-all duration-150 select-none cursor-pointer group ${
        selected
          ? 'ring-2 ring-monokai-accent/70 border-monokai-accent shadow-sm'
          : 'border-monokai-border hover:border-white/20'
      }`}
      style={{
        borderColor: selected ? accentColor : undefined,
      }}
    >
      {/* 4 Connection Handles for interactive relation drawing */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-2.5 !h-2.5 !bg-monokai-cyan !border-2 !border-monokai-bg hover:!scale-125 transition-transform !-ml-1.5"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-2.5 !h-2.5 !bg-monokai-accent !border-2 !border-monokai-bg hover:!scale-125 transition-transform !-mr-1.5"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!w-2.5 !h-2.5 !bg-monokai-cyan !border-2 !border-monokai-bg hover:!scale-125 transition-transform !-mt-1.5"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-2.5 !h-2.5 !bg-monokai-accent !border-2 !border-monokai-bg hover:!scale-125 transition-transform !-mb-1.5"
      />

      {/* Top Header */}
      <div className="p-3 border-b border-monokai-border flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 shadow-xs"
            style={{ backgroundColor: `${accentColor}20`, border: `1px solid ${accentColor}50` }}
          >
            <Layers className="w-3.5 h-3.5" style={{ color: accentColor }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-monokai-fg tracking-tight truncate">
                {entity.name}
              </span>
              {entity.label && entity.label !== entity.name && (
                <span className="text-meta text-monokai-comment truncate">({entity.label})</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {entity.mappedTable ? (
                <span className="inline-flex items-center gap-1 text-meta font-mono px-1.5 py-0.5 rounded bg-monokai-bg text-monokai-cyan border border-monokai-border truncate">
                  <Database className="w-3 h-3 text-monokai-cyan" />
                  {entity.mappedTable}
                </span>
              ) : (
                <span className="text-meta text-monokai-pink italic">未绑定物理表</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {entity.rowCount !== undefined && entity.rowCount > 0 && (
            <span className="text-meta font-mono px-1.5 py-0.5 rounded bg-monokai-bg text-monokai-fg-muted border border-monokai-border">
              {formatNumber(entity.rowCount)}行
            </span>
          )}
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 p-1 text-monokai-comment hover:text-monokai-pink rounded hover:bg-monokai-bg transition-all cursor-pointer"
            title="删除实体"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Description if present */}
      {entity.description && (
        <div className="px-3 pt-2 pb-1 text-meta text-monokai-comment line-clamp-1">
          {entity.description}
        </div>
      )}

      {/* Properties List */}
      <div className="p-2 space-y-1">
        {entity.properties.slice(0, 6).map((prop) => (
          <div
            key={prop.name}
            className={`flex items-center justify-between px-2 py-1 rounded text-meta font-mono transition-colors ${
              prop.isPrimaryKey
                ? 'bg-amber-500/10 text-amber-300 border border-monokai-border-subtle'
                : prop.isForeignKey
                ? 'bg-monokai-surface text-monokai-fg border border-monokai-border-subtle'
                : 'text-monokai-fg-muted hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              {prop.isPrimaryKey ? (
                <Key className="w-3 h-3 text-monokai-yellow shrink-0" />
              ) : prop.isForeignKey ? (
                <ArrowRight className="w-3 h-3 text-monokai-cyan shrink-0" />
              ) : (
                <Hash className="w-3 h-3 text-monokai-comment shrink-0" />
              )}
              <span className="font-medium truncate">{prop.name}</span>
            </div>
            <span className="text-2xs text-monokai-comment uppercase shrink-0 font-mono ml-2">
              {prop.type}
            </span>
          </div>
        ))}

        {entity.properties.length > 6 && (
          <div className="text-center py-0.5 text-2xs text-monokai-comment font-mono">
            + 更多 {entity.properties.length - 6} 个字段...
          </div>
        )}
      </div>

      {/* Metrics Footer (if any) */}
      {entity.metrics && entity.metrics.length > 0 && (
        <div className="px-3 py-1.5 border-t border-monokai-border bg-monokai-bg/60 rounded-b-lg flex items-center justify-between text-meta">
          <span className="text-monokai-comment font-medium flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-monokai-accent" />
            度量指标
          </span>
          <span className="text-monokai-accent font-mono font-medium truncate max-w-[160px]">
            {entity.metrics.map((m) => m.name).join(', ')}
          </span>
        </div>
      )}
    </div>
  );
});

OntologyEntityCard.displayName = 'OntologyEntityCard';
