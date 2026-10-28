import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import GridLayout, {
  noCompactor,
  verticalCompactor,
  type Layout,
} from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Dashboard, Tab } from '../types';
import { DashboardWidget } from './DashboardWidget';
import type { BoardBrushFilter } from './Dashboard/Home/homeBoardTypes';

/** Fixed canvas grid — window resize only changes cell pixel size, never col count. */
export const HOME_BOARD_COLS = 12;
export const HOME_BOARD_ROW_HEIGHT = 60;
export const HOME_BOARD_MARGIN: [number, number] = [8, 8];
export const HOME_BOARD_MIN_W = 2;
export const HOME_BOARD_MIN_H = 2;

interface DashboardGridProps {
  dashboard: Dashboard;
  refreshTrigger: number;
  /** Persist user drag/resize only (not window resize). */
  onLayoutChange: (layout: Array<{ i: string; x: number; y: number; w: number; h: number }>) => void;
  onRemoveWidget: (itemId: string) => void;
  onNavigate?: (tab: Tab) => void;
  boardParams?: Record<string, string>;
  brushFilter?: BoardBrushFilter | null;
  onBrushFilter?: (filter: BoardBrushFilter | null) => void;
  onSelectTable?: (tableName: string) => void;
  onSelectTableStructure?: (tableName: string) => void;
  onSelectTableDataFlow?: (tableName: string) => void;
}

/** Clamp a layout item to the fixed 12-col canvas grid (no out-of-bounds). */
export function clampLayoutItem(item: { i: string; x: number; y: number; w: number; h: number }) {
  const w = Math.max(HOME_BOARD_MIN_W, Math.min(HOME_BOARD_COLS, Math.round(item.w)));
  const h = Math.max(HOME_BOARD_MIN_H, Math.round(item.h));
  const x = Math.max(0, Math.min(HOME_BOARD_COLS - w, Math.round(item.x)));
  const y = Math.max(0, Math.round(item.y));
  return { i: item.i, x, y, w, h };
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  dashboard,
  refreshTrigger,
  onLayoutChange,
  onRemoveWidget,
  onNavigate,
  boardParams,
  brushFilter,
  onBrushFilter,
  onSelectTable,
  onSelectTableStructure,
  onSelectTableDataFlow,
}) => {
  const [width, setWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  /** default locked so existing boards stop jumping until user unlocks */
  const layoutLocked = dashboard.layoutLocked !== false;
  const editable = !layoutLocked;

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const next = Math.floor(entry.contentRect.width);
        if (next > 0) setWidth(next);
      }
    });
    resizeObserver.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width) || 1200);
    return () => resizeObserver.disconnect();
  }, []);

  const layout = useMemo(
    () =>
      dashboard.items.map((item) =>
        clampLayoutItem({
          i: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        }),
      ),
    [dashboard.items],
  );

  const gridLayout = useMemo(
    () =>
      layout.map((item) => ({
        ...item,
        minW: HOME_BOARD_MIN_W,
        minH: HOME_BOARD_MIN_H,
        maxW: HOME_BOARD_COLS,
        // Per-item static mirrors lock; also disable via drag/resize config
        static: layoutLocked,
        isDraggable: editable,
        isResizable: editable,
      })),
    [layout, layoutLocked, editable],
  );

  /**
   * Unlocked: vertical compact so resizing a packed card pushes neighbors
   * (preventCollision alone snaps back when the 12-col board is full).
   * Locked: noCompactor — window width changes must not reflow saved coords.
   */
  const compactor = editable ? verticalCompactor : noCompactor;

  const gridConfig = useMemo(
    () => ({
      cols: HOME_BOARD_COLS,
      rowHeight: HOME_BOARD_ROW_HEIGHT,
      margin: HOME_BOARD_MARGIN,
      containerPadding: [0, 0] as [number, number],
    }),
    [],
  );

  const dragConfig = useMemo(
    () => ({
      enabled: editable,
      bounded: true,
      handle: '.drag-handle',
    }),
    [editable],
  );

  const resizeConfig = useMemo(
    () => ({
      enabled: editable,
      handles: ['se', 'e', 's'] as const,
    }),
    [editable],
  );

  const commitLayout = useCallback(
    (next: Layout) => {
      if (layoutLocked) return;
      const clamped = next.map((item) =>
        clampLayoutItem({ i: item.i, x: item.x, y: item.y, w: item.w, h: item.h }),
      );
      const same =
        clamped.length === layout.length &&
        clamped.every((c) => {
          const prev = layout.find((p) => p.i === c.i);
          return prev && prev.x === c.x && prev.y === c.y && prev.w === c.w && prev.h === c.h;
        });
      if (same) return;
      onLayoutChange(clamped);
    },
    [layoutLocked, layout, onLayoutChange],
  );

  return (
    <div
      ref={containerRef}
      className={`relative z-0 w-full pb-3 ${layoutLocked ? 'home-board-locked' : 'home-board-unlocked'}`}
      data-layout-locked={layoutLocked ? 'true' : 'false'}
    >
      {width > 0 && (
        <GridLayout
          key={editable ? 'board-edit' : 'board-locked'}
          className="layout"
          layout={gridLayout}
          width={width}
          gridConfig={gridConfig}
          dragConfig={dragConfig}
          resizeConfig={resizeConfig}
          compactor={compactor}
          // Persist only after user drag/resize — never on width-only remount
          onDragStop={(next) => commitLayout(next)}
          onResizeStop={(next) => commitLayout(next)}
        >
          {dashboard.items.map((item) => (
            <div
              key={item.i}
              className="group relative z-0 flex flex-col overflow-visible rounded-lg hover:z-20"
            >
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg">
                <DashboardWidget
                  savedQueryId={item.savedQueryId}
                  widgetInstanceId={item.i}
                  refreshTrigger={refreshTrigger}
                  onRemove={() => onRemoveWidget(item.i)}
                  onNavigate={onNavigate}
                  boardParams={boardParams}
                  brushFilter={brushFilter}
                  onBrushFilter={onBrushFilter}
                  onSelectTable={onSelectTable}
                  onSelectTableStructure={onSelectTableStructure}
                  onSelectTableDataFlow={onSelectTableDataFlow}
                />
              </div>
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  );
};
