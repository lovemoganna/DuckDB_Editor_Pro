import React, { useEffect, useRef } from 'react';
import {
  Edit3,
  Trash2,
  Link,
  Focus,
  PlusCircle,
  Sparkles,
  ArrowLeftRight,
  Eye,
} from 'lucide-react';

export interface ContextMenuState {
  x: number;
  y: number;
  type: 'node' | 'edge' | 'canvas';
  targetId?: string;
  targetData?: any;
}

export interface CanvasContextMenuProps {
  menu: ContextMenuState | null;
  onClose: () => void;
  onEditNode?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onAddEdgeFromNode?: (nodeId: string) => void;
  onFocusNode?: (nodeId: string) => void;
  onEditEdge?: (edgeId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  onReverseEdge?: (edgeId: string) => void;
  onCreateNodeAtPos?: (x: number, y: number) => void;
  onAutoLayout?: () => void;
}

export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  menu,
  onClose,
  onEditNode,
  onDeleteNode,
  onAddEdgeFromNode,
  onFocusNode,
  onEditEdge,
  onDeleteEdge,
  onReverseEdge,
  onCreateNodeAtPos,
  onAutoLayout,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!menu) return null;

  const { x, y, type, targetId } = menu;

  return (
    <div
      ref={containerRef}
      style={{ left: `${x}px`, top: `${y}px` }}
      className="fixed z-50 min-w-[170px] bg-slate-900/95 backdrop-blur-md border border-slate-700/70 rounded-xl shadow-2xl p-1 text-slate-200 text-xs animate-in fade-in zoom-in-95 duration-100"
    >
      {type === 'node' && targetId && (
        <>
          <button
            onClick={() => {
              onEditNode?.(targetId);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-cyan-950/80 hover:text-cyan-300 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
            <span>编辑实体信息</span>
          </button>

          <button
            onClick={() => {
              onAddEdgeFromNode?.(targetId);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-cyan-950/80 hover:text-cyan-300 transition-colors"
          >
            <Link className="w-3.5 h-3.5 text-cyan-400" />
            <span>创建关联连线</span>
          </button>

          <button
            onClick={() => {
              onFocusNode?.(targetId);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            <Focus className="w-3.5 h-3.5 text-indigo-400" />
            <span>聚焦至画布中央</span>
          </button>

          <div className="h-px bg-slate-800 my-1" />

          <button
            onClick={() => {
              onDeleteNode?.(targetId);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-950/80 hover:text-rose-300 text-rose-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>删除此实体</span>
          </button>
        </>
      )}

      {type === 'edge' && targetId && (
        <>
          <button
            onClick={() => {
              onEditEdge?.(targetId);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-cyan-950/80 hover:text-cyan-300 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
            <span>编辑关系属性</span>
          </button>

          <button
            onClick={() => {
              onReverseEdge?.(targetId);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
            <span>反转连线方向</span>
          </button>

          <div className="h-px bg-slate-800 my-1" />

          <button
            onClick={() => {
              onDeleteEdge?.(targetId);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-950/80 hover:text-rose-300 text-rose-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>解绑连线关系</span>
          </button>
        </>
      )}

      {type === 'canvas' && (
        <>
          <button
            onClick={() => {
              onCreateNodeAtPos?.(x, y);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-cyan-950/80 hover:text-cyan-300 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>在此处新建实体</span>
          </button>

          <button
            onClick={() => {
              onAutoLayout?.();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>重新自动整理图拓扑</span>
          </button>
        </>
      )}
    </div>
  );
};
