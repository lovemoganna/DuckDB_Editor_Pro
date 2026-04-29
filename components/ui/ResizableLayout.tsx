import React, { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';

interface ResizableLayoutProps {
  leftInitialWidth?: number;
  rightInitialWidth?: number;
  minWidth?: number;
  /** 左侧占比上限，0-1 之间。如 0.35 表示左侧不超过视口 35% */
  maxLeftRatio?: number;
  /** 右侧占比上限，0-1 之间。如 0.35 表示右侧不超过视口 35% */
  maxRightRatio?: number;
  children: (props: {
    leftWidth: number;
    rightWidth: number;
    isResizingLeft: boolean;
    isResizingRight: boolean;
    leftRef: React.RefObject<HTMLDivElement>;
    rightRef: React.RefObject<HTMLDivElement>;
    startResizingLeft: (e: React.MouseEvent | React.TouchEvent) => void;
    startResizingRight: (e: React.MouseEvent | React.TouchEvent) => void;
  }) => React.ReactNode;
}

export const ResizableLayout: React.FC<ResizableLayoutProps> = ({
  leftInitialWidth = 340,
  rightInitialWidth = 380,
  minWidth = 200,
  maxLeftRatio = 0.45,
  maxRightRatio = 0.45,
  children,
}) => {
  const [leftWidth, setLeftWidth] = useState(leftInitialWidth);
  const [rightWidth, setRightWidth] = useState(rightInitialWidth);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  // 根据屏幕宽度计算初始宽度（仅挂载时执行一次）
  useLayoutEffect(() => {
    const vw = window.innerWidth;
    const computedLeft = Math.min(leftInitialWidth, Math.floor(vw * maxLeftRatio));
    const computedRight = Math.min(rightInitialWidth, Math.floor(vw * maxRightRatio));
    setLeftWidth(computedLeft);
    setRightWidth(computedRight);
    setIsMounted(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 窗口 resize 时重新计算（保持比例，但不低于最小值）
  useEffect(() => {
    if (!isMounted) return;
    const handleResize = () => {
      const vw = window.innerWidth;
      const maxL = Math.floor(vw * maxLeftRatio);
      const maxR = Math.floor(vw * maxRightRatio);
      setLeftWidth(prev => Math.max(minWidth, Math.min(prev, maxL)));
      setRightWidth(prev => Math.max(minWidth, Math.min(prev, maxR)));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMounted, minWidth, maxLeftRatio, maxRightRatio]);

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
  }, []);

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

  return (
    <>
      {children({
        leftWidth,
        rightWidth,
        isResizingLeft,
        isResizingRight,
        leftRef,
        rightRef,
        startResizingLeft,
        startResizingRight,
      })}
    </>
  );
};
