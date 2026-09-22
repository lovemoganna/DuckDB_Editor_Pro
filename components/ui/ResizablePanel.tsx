/**
 * ResizablePanel - 可拖拽调整宽度的水平分割面板
 *
 * 功能：
 * - 水平拖拽分割线调整宽度
 * - 拖拽时实时显示宽度指示器
 * - 双击恢复默认宽度
 * - 支持最小/最大宽度限制
 * - 支持垂直方向（高度可调）
 * - 视觉增强：分割线高亮、拖拽状态指示
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GripVertical, Maximize2 } from 'lucide-react';

interface ResizablePanelProps {
  /** 左侧/顶部面板内容 */
  children: React.ReactNode;
  /** 右侧/底部面板内容 */
  secondPanel?: React.ReactNode;
  /** 默认宽度（px） */
  defaultWidth?: number;
  /** 最小宽度（px） */
  minWidth?: number;
  /** 最大宽度（px） */
  maxWidth?: number;
  /** 是否垂直方向（true=高度可调） */
  vertical?: boolean;
  /** 面板背景色 */
  bgColor?: string;
  /** 分割线颜色 */
  dividerColor?: string;
  /** 是否可折叠 */
  collapsible?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 宽度变化回调 */
  onWidthChange?: (width: number) => void;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  secondPanel,
  defaultWidth = 600,
  minWidth = 280,
  maxWidth = 900,
  vertical = false,
  bgColor = '#1e1f1c',
  dividerColor = '#66d9ef',
  collapsible = false,
  className = '',
  onWidthChange,
}) => {
  // 面板当前宽度/高度
  const [size, setSize] = useState(defaultWidth);
  // 是否正在拖拽
  const [isDragging, setIsDragging] = useState(false);
  // 是否折叠
  const [isCollapsed, setIsCollapsed] = useState(false);
  // 拖拽时显示的尺寸指示器
  const [dragIndicator, setDragIndicator] = useState<number | null>(null);
  // 尺寸指示器淡出定时器
  const indicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; size: number }>({ x: 0, y: 0, size: 0 });

  // 拖拽开始
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(true);
      setDragIndicator(size);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        size,
      };

      // 添加全局样式防止选中文本
      document.body.classList.add('is-resizing');
    },
    [size]
  );

  // 拖拽中
  const handleDragMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      let newSize: number;

      if (vertical) {
        // 垂直方向：调整高度
        const deltaY = e.clientY - dragStartRef.current.y;
        newSize = dragStartRef.current.size + deltaY;
      } else {
        // 水平方向：调整宽度
        const deltaX = e.clientX - dragStartRef.current.x;
        newSize = dragStartRef.current.size + deltaX;
      }

      // 限制范围
      newSize = Math.max(minWidth, Math.min(maxWidth, newSize));
      setDragIndicator(newSize);
    },
    [isDragging, vertical, minWidth, maxWidth]
  );

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);
    document.body.classList.remove('is-resizing');

    if (dragIndicator !== null) {
      setSize(dragIndicator);
      onWidthChange?.(dragIndicator);

      // 延迟淡出指示器
      if (indicatorTimerRef.current) {
        clearTimeout(indicatorTimerRef.current);
      }
      indicatorTimerRef.current = setTimeout(() => {
        setDragIndicator(null);
      }, 800);
    }
  }, [isDragging, dragIndicator, onWidthChange]);

  // 双击恢复默认宽度
  const handleDoubleClick = useCallback(() => {
    setSize(defaultWidth);
    onWidthChange?.(defaultWidth);
    setDragIndicator(null);
  }, [defaultWidth, onWidthChange]);

  // 点击折叠/展开
  const handleCollapseClick = useCallback(() => {
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed]);

  // 监听全局鼠标事件
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (indicatorTimerRef.current) {
        clearTimeout(indicatorTimerRef.current);
      }
    };
  }, []);

  // 分割线样式
  const dividerStyle: React.CSSProperties = {
    width: vertical ? '100%' : '8px',
    height: vertical ? '8px' : '100%',
    background: isDragging
      ? 'linear-gradient(90deg, transparent 0%, #66d9ef 50%, transparent 100%)'
      : `linear-gradient(90deg, transparent 0%, ${dividerColor} 50%, transparent 100%)`,
    cursor: vertical ? 'row-resize' : 'col-resize',
    transition: isDragging ? 'none' : 'background 0.2s ease',
    flexShrink: 0,
    position: 'relative',
  };

  return (
    <div
      ref={containerRef}
      className={`flex ${vertical ? 'flex-col' : 'flex-row'} ${className}`}
      style={{ background: bgColor }}
    >
      {/* 主面板 */}
      <div
        className="overflow-hidden flex-shrink-0 transition-all duration-200"
        style={
          vertical
            ? { height: isCollapsed ? 0 : size, minHeight: isCollapsed ? 0 : minWidth }
            : { width: isCollapsed ? 0 : size, minWidth: isCollapsed ? 0 : minWidth }
        }
      >
        {children}
      </div>

      {/* 折叠按钮 */}
      {collapsible && !isCollapsed && (
        <button
          onClick={handleCollapseClick}
          className="absolute z-10 flex items-center justify-center bg-monokai-surface hover:bg-monokai-sidebar transition-colors rounded border border-monokai-accent"
          style={{
            [vertical ? 'top' : 'left']: isCollapsed ? 0 : size,
            [vertical ? 'left' : 'top']: 0,
            [vertical ? 'width' : 'height']: '100%',
            [vertical ? 'height' : 'width']: '24px',
          }}
          title="折叠面板"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className={`text-monokai-comment transition-transform ${vertical ? '' : '-rotate-90'}`}
          >
            <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      )}

      {/* 分割线 */}
      {!isCollapsed && (
        <div
          className={`resizable-divider flex items-center justify-center group ${isDragging ? 'is-dragging' : ''}`}
          style={dividerStyle}
          onMouseDown={handleDragStart}
          onDoubleClick={handleDoubleClick}
        >
          {/* 分割线中心拖拽指示器 */}
          <div
            className="absolute w-1.5 h-10 rounded-full flex items-center justify-center transition-all duration-200"
            style={{
              background: isDragging ? '#75715e' : 'transparent',
              boxShadow: isDragging ? '0 0 8px rgba(117, 113, 94, 0.5)' : 'none',
              opacity: isDragging ? 1 : 0.7,
            }}
          >
            {isDragging ? (
              <GripVertical className="w-3.5 h-3.5 text-monokai-fg" />
            ) : (
              <div className="flex flex-col gap-1">
                <div className="w-1 h-1 rounded-full bg-monokai-comment/40 group-hover:bg-monokai-comment/70 transition-colors" />
                <div className="w-1 h-1 rounded-full bg-monokai-comment/40 group-hover:bg-monokai-comment/70 transition-colors" />
                <div className="w-1 h-1 rounded-full bg-monokai-comment/40 group-hover:bg-monokai-comment/70 transition-colors" />
              </div>
            )}
          </div>

          {/* 宽度指示器 */}
          {isDragging && dragIndicator !== null && (
            <div className="resizable-width-indicator">
              <div className="flex items-center gap-1.5">
                <Maximize2 className="w-3 h-3" />
                <span>{dragIndicator}px</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 第二面板 */}
      {secondPanel && !isCollapsed && (
        <div className="flex-1 overflow-hidden">
          {secondPanel}
        </div>
      )}
    </div>
  );
};

export default ResizablePanel;
