/**
 * ResizableLayout - 可调节布局组件
 * 
 * 优化功能：
 * - 更好的响应式支持
 * - 拖拽手柄样式优化
 * - 宽度持久化
 * - 性能优化
 */

import React, { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';

interface ResizableLayoutProps {
  /** 左侧初始宽度 */
  leftInitialWidth?: number;
  /** 右侧初始宽度 */
  rightInitialWidth?: number;
  /** 最小宽度 */
  minWidth?: number;
  /** 左侧占比上限，0-1 之间。如 0.35 表示左侧不超过视口 35% */
  maxLeftRatio?: number;
  /** 右侧占比上限，0-1 之间。如 0.35 表示右侧不超过视口 35% */
  maxRightRatio?: number;
  /** 是否在移动端隐藏左侧面板 */
  collapseOnMobile?: boolean;
  /** 移动端断点 (px) */
  mobileBreakpoint?: number;
  /** 拖拽手柄样式 */
  handleStyle?: 'line' | 'bar' | 'hidden';
  /** 是否持久化宽度到 localStorage */
  persistWidth?: boolean;
  /** localStorage 键名前缀 */
  storagePrefix?: string;
  /** 额外的容器类名 */
  className?: string;
  children: (props: {
    leftWidth: number;
    rightWidth: number;
    isResizingLeft: boolean;
    isResizingRight: boolean;
    leftRef: React.RefObject<HTMLDivElement>;
    rightRef: React.RefObject<HTMLDivElement>;
    setLeftWidth?: (width: number) => void;
    setRightWidth?: (width: number) => void;
    startResizingLeft: (e: React.MouseEvent | React.TouchEvent) => void;
    startResizingRight: (e: React.MouseEvent | React.TouchEvent) => void;
  }) => React.ReactNode;
}

export const ResizableLayout: React.FC<ResizableLayoutProps> = ({
  leftInitialWidth = 320,
  rightInitialWidth = 400,
  minWidth = 240,
  maxLeftRatio = 0.35,
  maxRightRatio = 0.40,
  collapseOnMobile = true,
  mobileBreakpoint = 768,
  handleStyle = 'line',
  persistWidth = true,
  storagePrefix = 'resizable-layout',
  className,
  children,
}) => {
  const [leftWidth, setLeftWidth] = useState(leftInitialWidth);
  const [rightWidth, setRightWidth] = useState(rightInitialWidth);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // localStorage 键名
  const storageKey = `${storagePrefix}-widths`;

  // 从 localStorage 加载保存的宽度
  const loadSavedWidths = useCallback(() => {
    if (!persistWidth) return null;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[ResizableLayout] Failed to load saved widths:', e);
    }
    return null;
  }, [persistWidth, storageKey]);

  // 保存宽度到 localStorage
  const saveWidths = useCallback((left: number, right: number) => {
    if (!persistWidth) return;
    
    try {
      localStorage.setItem(storageKey, JSON.stringify({ left, right }));
    } catch (e) {
      console.warn('[ResizableLayout] Failed to save widths:', e);
    }
  }, [persistWidth, storageKey]);

  // 检测是否为移动端
  const checkMobile = useCallback(() => {
    setIsMobile(window.innerWidth < mobileBreakpoint);
  }, [mobileBreakpoint]);

  // 初始化
  useLayoutEffect(() => {
    checkMobile();
    
    const savedWidths = loadSavedWidths();
    const vw = window.innerWidth;
    
    if (savedWidths && !isMobile) {
      // 使用保存的宽度，但不超过限制
      const computedLeft = Math.max(
        minWidth,
        Math.min(savedWidths.left, Math.floor(vw * maxLeftRatio))
      );
      const computedRight = Math.max(
        minWidth,
        Math.min(savedWidths.right, Math.floor(vw * maxRightRatio))
      );
      setLeftWidth(computedLeft);
      setRightWidth(computedRight);
    } else {
      // 使用默认宽度
      const computedLeft = Math.max(minWidth, Math.min(leftInitialWidth, Math.floor(vw * maxLeftRatio)));
      const computedRight = Math.max(minWidth, Math.min(rightInitialWidth, Math.floor(vw * maxRightRatio)));
      setLeftWidth(computedLeft);
      setRightWidth(computedRight);
    }
    
    setIsMounted(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听窗口大小变化
  useEffect(() => {
    checkMobile();
    
    const handleResize = () => {
      checkMobile();
      
      if (!isMounted) return;
      
      const vw = window.innerWidth;
      const maxL = Math.floor(vw * maxLeftRatio);
      const maxR = Math.floor(vw * maxRightRatio);
      
      setLeftWidth(prev => Math.max(minWidth, Math.min(prev, maxL)));
      setRightWidth(prev => Math.max(minWidth, Math.min(prev, maxR)));
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMounted, minWidth, maxLeftRatio, maxRightRatio, checkMobile]);

  // 限制 resize 时的最大宽度
  const clampLeft = useCallback((width: number) => {
    const maxL = Math.floor(window.innerWidth * maxLeftRatio);
    return Math.max(minWidth, Math.min(width, maxL));
  }, [minWidth, maxLeftRatio]);

  const clampRight = useCallback((width: number) => {
    const maxR = Math.floor(window.innerWidth * maxRightRatio);
    return Math.max(minWidth, Math.min(width, maxR));
  }, [minWidth, maxRightRatio]);

  const startResizingLeft = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
  }, []);

  const startResizingRight = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizingLeft(false);
    setIsResizingRight(false);
    saveWidths(leftWidth, rightWidth);
  }, [leftWidth, rightWidth, saveWidths]);

  const resize = useCallback(
    (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;

      if (isResizingLeft) {
        setLeftWidth(clampLeft(clientX));
      }

      if (isResizingRight) {
        const viewportWidth = window.innerWidth;
        setRightWidth(clampRight(viewportWidth - clientX));
      }
    },
    [isResizingLeft, isResizingRight, clampLeft, clampRight]
  );

  // 拖拽事件监听
  useEffect(() => {
    if (isResizingLeft || isResizingRight) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
      window.addEventListener('touchmove', resize);
      window.addEventListener('touchend', stopResizing);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('touchmove', resize);
      window.removeEventListener('touchend', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('touchmove', resize);
      window.removeEventListener('touchend', stopResizing);
    };
  }, [isResizingLeft, isResizingRight, resize, stopResizing]);

  // 移动端收起侧边栏
  const effectiveLeftWidth = collapseOnMobile && isMobile ? 0 : leftWidth;

  return (
    <div
      ref={containerRef}
      className={`w-full h-full min-h-0 flex overflow-hidden ${className || ''} ${isResizingLeft || isResizingRight ? 'select-none' : ''}`}
    >
      {children({
        leftWidth: effectiveLeftWidth,
        rightWidth,
        isResizingLeft,
        isResizingRight,
        leftRef,
        rightRef,
        setLeftWidth: (w: number) => {
          const clamped = Math.max(minWidth, Math.min(w, Math.floor(window.innerWidth * maxLeftRatio)));
          setLeftWidth(clamped);
          saveWidths(clamped, rightWidth);
        },
        setRightWidth: (w: number) => {
          const clamped = Math.max(minWidth, Math.min(w, Math.floor(window.innerWidth * maxRightRatio)));
          setRightWidth(clamped);
          saveWidths(leftWidth, clamped);
        },
        startResizingLeft,
        startResizingRight,
      })}
    </div>
  );
};

export default ResizableLayout;
