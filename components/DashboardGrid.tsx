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
import { BOARD_CANVAS_MIN_WIDTH, viewportBoardLayout, type WidgetContent } from '../utils/dashboardLayout';
import { WidgetErrorBoundary } from './Dashboard/WidgetErrorBoundary';
import { reportDashboardIncident } from '../services/dashboardDiagnostics';
import type { DatasetDefinition, DashboardContext, WidgetSettings } from '../services/workbench/analysisTypes';

/** Fixed canvas grid — window resize only changes cell pixel size, never col count. */
export const HOME_BOARD_COLS = 12;
export const HOME_BOARD_ROW_HEIGHT = 60;
export const HOME_BOARD_MARGIN: [number, number] = [8, 8];
export const HOME_BOARD_MIN_W = 4;
export const HOME_BOARD_MIN_H = 5;

interface DashboardGridProps {
  datasets?: DatasetDefinition[];
  context?: DashboardContext;
  onSettingsChange?: (id:string,settings:WidgetSettings)=>Promise<void>;
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
export function clampLayoutItem(item: { i: string; x: number; y: number; w: number; h: number }, minimum = { w: HOME_BOARD_MIN_W, h: HOME_BOARD_MIN_H }) {
  const w = Math.max(minimum.w, Math.min(HOME_BOARD_COLS, Math.round(item.w)));
  const h = Math.max(minimum.h, Math.round(item.h));
  const x = Math.max(0, Math.min(HOME_BOARD_COLS - w, Math.round(item.x)));
  const y = Math.max(0, Math.round(item.y));
  return { i: item.i, x, y, w, h };
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  datasets,
  context,
  onSettingsChange,
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
  // Legacy small cards remain editable without silently enlarging their saved size.
  const minimumFor = useCallback((id: string) => {
    const item = dashboard.items.find(item => item.i === id);
    return { w: Math.min(item?.w ?? HOME_BOARD_MIN_W, HOME_BOARD_MIN_W), h: Math.min(item?.h ?? HOME_BOARD_MIN_H, HOME_BOARD_MIN_H) };
  }, [dashboard.items]);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const timer=window.setTimeout(()=>{
      const size=containerRef.current?.getBoundingClientRect();
      if(document.visibilityState==='visible' && size && size.height>0 && size.width<=0)
        reportDashboardIncident({stage:'size',catalog:dashboard.databaseName,boardId:dashboard.id,code:'board-zero-width',width:size.width,height:size.height});
    },1500);
    return()=>window.clearTimeout(timer);
  },[dashboard.id,dashboard.databaseName]);
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
        ({
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
        ...(editable ? clampLayoutItem(item, minimumFor(item.i)) : item),
        minW: minimumFor(item.i).w,
        minH: minimumFor(item.i).h,
        maxW: HOME_BOARD_COLS,
        // Per-item static mirrors lock; also disable via drag/resize config
        static: layoutLocked,
        isDraggable: editable,
        isResizable: editable,
      })),
    [layout, layoutLocked, editable, minimumFor],
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
        clampLayoutItem({ i: item.i, x: item.x, y: item.y, w: item.w, h: item.h }, minimumFor(item.i)),
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
    [layoutLocked, layout, onLayoutChange, minimumFor],
  );

  const renderWidget = (item: Dashboard['items'][number]) => (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg">
                <DashboardWidget
                  item={item}
                  datasets={datasets}
                  context={context}
                  ownerCatalog={dashboard.databaseName}
                  layoutEditable={editable}
                  onSettingsChange={onSettingsChange}
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
  );
  const readable = viewportBoardLayout(dashboard.items, width);
  const isolatedWidget = (item: Dashboard['items'][number]) => <WidgetErrorBoundary key={`${dashboard.databaseName}:${dashboard.id}:${item.i}`} catalog={dashboard.databaseName} boardId={dashboard.id} widgetId={item.i} formatVersion={dashboard.formatVersion}>{renderWidget(item)}</WidgetErrorBoundary>;

  return (
    <div
      ref={containerRef}
      className={`relative z-0 w-full min-w-0 pb-3 ${layoutLocked ? 'home-board-locked' : 'home-board-unlocked'}`}
      data-layout-locked={layoutLocked ? 'true' : 'false'}
    >
      {layoutLocked && width > 0 && <div data-testid={readable.stacked ? 'readable-board' : 'saved-board'} className="grid items-start"
        style={{ gridTemplateColumns: `repeat(${readable.columns}, minmax(0, 1fr))`, gap: 8, gridAutoRows: readable.stacked ? undefined : 60 }}>
        {readable.items.map(position => {
          const item = dashboard.items.find(item => item.i === position.i)!;
          return <div key={position.i} data-widget-id={position.i} className="min-w-0"
            style={{ gridColumn: `${position.column} / span ${position.span}`, gridRow: `${position.row} / span ${position.rowSpan}`, height: position.height }}>
            {isolatedWidget(item)}
          </div>;
        })}
      </div>}
      {width > 0 && editable && (
        <GridLayout
          key={editable ? 'board-edit' : 'board-locked'}
          className="layout" style={editable ? { minWidth: BOARD_CANVAS_MIN_WIDTH } : undefined}
          layout={gridLayout}
          width={editable ? Math.max(BOARD_CANVAS_MIN_WIDTH, width) : width}
          gridConfig={gridConfig}
          dragConfig={dragConfig}
          resizeConfig={resizeConfig}
          compactor={compactor}
          // Persist only after user drag/resize — never on width-only remount
          onDragStop={(next) => commitLayout(next)}
          onResizeStop={(next) => commitLayout(next)}
        >
          {dashboard.items.map(item => <div key={item.i} data-widget-id={item.i} className="min-w-0 h-full flex flex-col">{isolatedWidget(item)}</div>)}
        </GridLayout>
      )}
    </div>
  );
};

/** Read-only adaptation; caller must never persist this decision. */
export function needsReadableLayout(items: Array<{ i?: string; w: number; h: number }>, width: number, content: Record<string, WidgetContent> = {}) {
  return width > 0 && width < BOARD_CANVAS_MIN_WIDTH;
}
