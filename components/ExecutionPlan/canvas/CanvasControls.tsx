/**
 * components/ExecutionPlan/canvas/CanvasControls.tsx
 *
 * Floating viewport and layout controls for the Execution Canvas.
 * Supports Zoom In/Out, Reset, Fit-to-View, and Layout Direction toggling.
 */

import React from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  ArrowDownUp,
  ArrowLeftRight,
} from 'lucide-react';
import { LayoutDirection } from '../model/types';

export interface CanvasControlsProps {
  scale: number;
  direction: LayoutDirection;
  nodeCount: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitToView: () => void;
  onToggleDirection: () => void;
}

export const CanvasControls: React.FC<CanvasControlsProps> = ({
  scale,
  direction,
  nodeCount,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToView,
  onToggleDirection,
}) => {
  const getDirectionMeta = () => {
    switch (direction) {
      case 'LR':
        return {
          icon: <ArrowLeftRight className="w-3.5 h-3.5 text-monokai-cyan" />,
          label: '横向布局',
          title: '当前：横向从左到右 (LR)。点击切换为纵向数据流 (BT)',
        };
      case 'TB':
        return {
          icon: <ArrowDownUp className="w-3.5 h-3.5 text-amber-400" />,
          label: '纵向计划树',
          title: '当前：纵向自顶向下计划树 (TB)。点击切换为横向布局 (LR)',
        };
      case 'BT':
      default:
        return {
          icon: <ArrowDownUp className="w-3.5 h-3.5 text-monokai-comment" />,
          label: '纵向数据流',
          title: '当前：纵向自底向上数据流 (BT)。点击切换为横向布局 (LR)',
        };
    }
  };

  const dirMeta = getDirectionMeta();

  return (
    <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 p-1 rounded-xl bg-monokai-surface/90 backdrop-blur-md border border-monokai-border shadow-xl">
      {/* Node Count Chip */}
      <div className="px-2 py-0.5 text-[10px] font-mono text-monokai-comment border-r border-monokai-border/60">
        {nodeCount} 算子
      </div>

      {/* Direction Toggle */}
      <button
        type="button"
        onClick={onToggleDirection}
        title={dirMeta.title}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-medium text-monokai-fg/80 hover:bg-monokai-elevated hover:text-monokai-cyan transition-colors"
      >
        {dirMeta.icon}
        <span>{dirMeta.label}</span>
      </button>

      <div className="w-px h-4 bg-monokai-border/60" />

      {/* Zoom Out */}
      <button
        type="button"
        onClick={onZoomOut}
        title="缩小 (Zoom Out)"
        className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated transition-colors"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>

      {/* Zoom % text / reset */}
      <button
        type="button"
        onClick={onResetZoom}
        title="重置缩放 (100%)"
        className="px-1.5 py-0.5 rounded text-[10.5px] font-mono font-medium text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated transition-colors"
      >
        {Math.round(scale * 100)}%
      </button>

      {/* Zoom In */}
      <button
        type="button"
        onClick={onZoomIn}
        title="放大 (Zoom In)"
        className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated transition-colors"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>

      {/* Fit to View */}
      <button
        type="button"
        onClick={onFitToView}
        title="全貌自适应 (Fit to View)"
        className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-cyan hover:bg-monokai-elevated transition-colors"
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
