import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, PanelBottom, PanelLeft, PanelRight } from 'lucide-react';

export interface WorkbenchLayoutState {
  leftOpen: boolean;
  rightOpen: boolean;
  bottomOpen: boolean;
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;
}

export interface WorkbenchShellProps {
  featureId: string;
  children: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
  bottom?: React.ReactNode;
  status?: React.ReactNode;
  commandBar?: React.ReactNode;
  className?: string;
  defaultLayout?: Partial<WorkbenchLayoutState>;
}

const DEFAULT_LAYOUT: WorkbenchLayoutState = {
  leftOpen: true,
  rightOpen: true,
  bottomOpen: true,
  leftWidth: 260,
  rightWidth: 300,
  bottomHeight: 36,
};

const LEFT_MIN = 208;
const LEFT_MAX = 420;
const RIGHT_MIN = 240;
const RIGHT_MAX = 420;
const BOTTOM_MIN = 24;
const BOTTOM_MAX = 64;
const DESKTOP_INSPECTOR_BREAKPOINT = 1200;
const OVERLAY_BREAKPOINT = 1024;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const storageKey = (featureId: string) => `duckdb-workbench-layout:v1:${featureId}`;

const readLayout = (featureId: string, defaults: WorkbenchLayoutState): WorkbenchLayoutState => {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(storageKey(featureId));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<WorkbenchLayoutState>;
    return {
      ...defaults,
      ...parsed,
      leftWidth: clamp(parsed.leftWidth ?? defaults.leftWidth, LEFT_MIN, LEFT_MAX),
      rightWidth: clamp(parsed.rightWidth ?? defaults.rightWidth, RIGHT_MIN, RIGHT_MAX),
      bottomHeight: clamp(parsed.bottomHeight ?? defaults.bottomHeight, BOTTOM_MIN, BOTTOM_MAX),
    };
  } catch {
    return defaults;
  }
};

type ResizeTarget = 'left' | 'right' | 'bottom';

export const WorkbenchShell: React.FC<WorkbenchShellProps> = ({
  featureId,
  children,
  left,
  right,
  bottom,
  status,
  commandBar,
  className = '',
  defaultLayout,
}) => {
  const defaults = useMemo<WorkbenchLayoutState>(() => ({ ...DEFAULT_LAYOUT, ...defaultLayout }), [
    defaultLayout?.bottomHeight,
    defaultLayout?.bottomOpen,
    defaultLayout?.leftOpen,
    defaultLayout?.leftWidth,
    defaultLayout?.rightOpen,
    defaultLayout?.rightWidth,
  ]);
  const [layout, setLayout] = useState<WorkbenchLayoutState>(() => readLayout(featureId, defaults));
  const [viewportWidth, setViewportWidth] = useState(() => typeof window === 'undefined' ? 1440 : window.innerWidth);
  const [compactRightOpen, setCompactRightOpen] = useState(false);
  const resizeRef = useRef<{ target: ResizeTarget; startX: number; startY: number; startValue: number } | null>(null);
  const rightToggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setLayout(readLayout(featureId, defaults));
    setCompactRightOpen(false);
  }, [defaults, featureId]);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      if (window.innerWidth >= DESKTOP_INSPECTOR_BREAKPOINT) setCompactRightOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(featureId), JSON.stringify(layout));
    } catch {
      // Storage is an enhancement; the workbench remains usable without it.
    }
  }, [featureId, layout]);

  const updateLayout = useCallback((patch: Partial<WorkbenchLayoutState>) => {
    setLayout(current => ({ ...current, ...patch }));
  }, []);

  const startResize = useCallback((target: ResizeTarget, event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeRef.current = {
      target,
      startX: event.clientX,
      startY: event.clientY,
      startValue: target === 'left' ? layout.leftWidth : target === 'right' ? layout.rightWidth : layout.bottomHeight,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [layout.bottomHeight, layout.leftWidth, layout.rightWidth]);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize) return;
      if (resize.target === 'left') {
        updateLayout({ leftWidth: clamp(resize.startValue + event.clientX - resize.startX, LEFT_MIN, LEFT_MAX) });
      } else if (resize.target === 'right') {
        updateLayout({ rightWidth: clamp(resize.startValue - event.clientX + resize.startX, RIGHT_MIN, RIGHT_MAX) });
      } else {
        const containerHeight = Math.max(1, window.innerHeight - 88);
        const deltaPercent = ((resize.startY - event.clientY) / containerHeight) * 100;
        updateLayout({ bottomHeight: clamp(resize.startValue + deltaPercent, BOTTOM_MIN, BOTTOM_MAX) });
      }
    };
    const handleEnd = () => {
      resizeRef.current = null;
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
    };
  }, [updateLayout]);

  const keyboardResize = useCallback((target: ResizeTarget, event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 32 : 16;
    if (event.key === 'Home') {
      event.preventDefault();
      updateLayout(target === 'left' ? { leftWidth: defaults.leftWidth } : target === 'right' ? { rightWidth: defaults.rightWidth } : { bottomHeight: defaults.bottomHeight });
      return;
    }
    if (target === 'bottom') {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      updateLayout({ bottomHeight: clamp(layout.bottomHeight + (event.key === 'ArrowUp' ? step / 4 : -step / 4), BOTTOM_MIN, BOTTOM_MAX) });
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    if (target === 'left') updateLayout({ leftWidth: clamp(layout.leftWidth + direction * step, LEFT_MIN, LEFT_MAX) });
    else updateLayout({ rightWidth: clamp(layout.rightWidth - direction * step, RIGHT_MIN, RIGHT_MAX) });
  }, [defaults.bottomHeight, defaults.leftWidth, defaults.rightWidth, layout.bottomHeight, layout.leftWidth, layout.rightWidth, updateLayout]);

  const compactInspector = viewportWidth < DESKTOP_INSPECTOR_BREAKPOINT;
  const overlayPanes = viewportWidth < OVERLAY_BREAKPOINT;
  const leftVisible = Boolean(left) && layout.leftOpen;
  const rightVisible = Boolean(right) && (compactInspector ? compactRightOpen : layout.rightOpen);
  const bottomVisible = Boolean(bottom) && layout.bottomOpen;

  useEffect(() => {
    if (!compactInspector || !compactRightOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setCompactRightOpen(false);
      window.requestAnimationFrame(() => rightToggleRef.current?.focus());
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [compactInspector, compactRightOpen]);

  const toggleRightPane = useCallback(() => {
    if (compactInspector) {
      setCompactRightOpen(current => !current);
      return;
    }
    updateLayout({ rightOpen: !layout.rightOpen });
  }, [compactInspector, layout.rightOpen, updateLayout]);

  const paneToggleClass = 'inline-flex h-7 w-7 items-center justify-center rounded-md border border-monokai-border bg-monokai-surface text-monokai-comment transition-colors hover:border-monokai-border-strong hover:text-monokai-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent';

  return (
    <section className={`workbench-shell flex h-full min-h-0 flex-col overflow-hidden bg-monokai-bg text-monokai-fg ${className}`} data-workbench-feature={featureId}>
      {(commandBar || left || right || bottom) && (
        <div className="workbench-shell__commandbar flex h-9 shrink-0 items-center gap-2 border-b border-monokai-border bg-monokai-sidebar px-2.5">
          {left && (
            <button type="button" className={paneToggleClass} onClick={() => updateLayout({ leftOpen: !layout.leftOpen })} aria-label={layout.leftOpen ? '折叠左侧资源' : '展开左侧资源'} title={layout.leftOpen ? '折叠左侧资源' : '展开左侧资源'}>
              {layout.leftOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <PanelLeft className="h-3.5 w-3.5" />}
            </button>
          )}
          <div className="min-w-0 flex-1">{commandBar}</div>
          {bottom && (
            <button type="button" className={paneToggleClass} onClick={() => updateLayout({ bottomOpen: !layout.bottomOpen })} aria-label={layout.bottomOpen ? '折叠底部面板' : '展开底部面板'} title={layout.bottomOpen ? '折叠底部面板' : '展开底部面板'}>
              {layout.bottomOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <PanelBottom className="h-3.5 w-3.5" />}
            </button>
          )}
          {right && (
            <button ref={rightToggleRef} type="button" className={paneToggleClass} aria-expanded={rightVisible} onClick={toggleRightPane} aria-label={rightVisible ? '折叠右侧上下文' : '展开右侧上下文'} title={rightVisible ? '折叠右侧上下文' : '展开右侧上下文'}>
              {rightVisible ? <ChevronRight className="h-3.5 w-3.5" /> : <PanelRight className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {leftVisible && (
          <>
            <aside className={`workbench-shell__left min-h-0 shrink-0 overflow-hidden border-r border-monokai-border bg-monokai-sidebar ${overlayPanes ? 'absolute inset-y-0 left-0 z-40 shadow-2xl' : ''}`} style={{ width: layout.leftWidth }}>
              {left}
            </aside>
            <div role="separator" aria-label="调整左侧窗格宽度" aria-orientation="vertical" aria-valuemin={LEFT_MIN} aria-valuemax={LEFT_MAX} aria-valuenow={Math.round(layout.leftWidth)} tabIndex={0} className="workbench-separator workbench-separator--vertical" onPointerDown={event => startResize('left', event)} onDoubleClick={() => updateLayout({ leftWidth: defaults.leftWidth })} onKeyDown={event => keyboardResize('left', event)} />
          </>
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <main className="workbench-shell__main min-h-0 flex-1 overflow-hidden">{children}</main>
          {bottomVisible && (
            <>
              <div role="separator" aria-label="调整底部面板高度" aria-orientation="horizontal" aria-valuemin={BOTTOM_MIN} aria-valuemax={BOTTOM_MAX} aria-valuenow={Math.round(layout.bottomHeight)} tabIndex={0} className="workbench-separator workbench-separator--horizontal" onPointerDown={event => startResize('bottom', event)} onDoubleClick={() => updateLayout({ bottomHeight: defaults.bottomHeight })} onKeyDown={event => keyboardResize('bottom', event)} />
              <section className="workbench-shell__bottom min-h-0 shrink-0 overflow-hidden border-t border-monokai-border bg-monokai-surface" style={{ height: `${layout.bottomHeight}%` }}>{bottom}</section>
            </>
          )}
        </div>

        {rightVisible && (
          <>
            {!compactInspector && <div role="separator" aria-label="调整右侧窗格宽度" aria-orientation="vertical" aria-valuemin={RIGHT_MIN} aria-valuemax={RIGHT_MAX} aria-valuenow={Math.round(layout.rightWidth)} tabIndex={0} className="workbench-separator workbench-separator--vertical" onPointerDown={event => startResize('right', event)} onDoubleClick={() => updateLayout({ rightWidth: defaults.rightWidth })} onKeyDown={event => keyboardResize('right', event)} />}
            <aside className={`workbench-shell__right min-h-0 shrink-0 overflow-hidden border-l border-monokai-border bg-monokai-sidebar ${compactInspector ? 'absolute inset-y-0 right-0 z-40 shadow-2xl' : ''}`} style={{ width: layout.rightWidth }}>{right}</aside>
          </>
        )}
      </div>

      {status && <footer className="workbench-shell__status flex h-6 shrink-0 items-center border-t border-monokai-border bg-monokai-sidebar px-3 text-[10px] font-mono text-monokai-comment">{status}</footer>}
    </section>
  );
};

export default WorkbenchShell;
