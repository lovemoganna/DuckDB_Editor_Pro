import React, { useEffect, useState, useRef } from 'react';
// @ts-ignore
import { Responsive } from 'react-grid-layout';
// @ts-ignore
import 'react-grid-layout/css/styles.css';
import { Dashboard, Tab } from '../types';
import { DashboardWidget } from './DashboardWidget';

interface DashboardGridProps {
  dashboard: Dashboard;
  refreshTrigger: number;
  onLayoutChange: (layout: any[]) => void;
  onRemoveWidget: (itemId: string) => void;
  onNavigate?: (tab: Tab) => void;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  dashboard,
  refreshTrigger,
  onLayoutChange,
  onRemoveWidget,
  onNavigate,
}) => {
  const [width, setWidth] = useState(1200);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Transform DashboardItems to React-Grid-Layout format
  const layout = dashboard.items.map(item => ({
    i: item.i,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: 2,
    minH: 2,
  }));

  return (
    <div ref={containerRef} className="w-full h-full pb-12">
      {width > 0 && (
        <Responsive
          className="layout"
          layouts={{ lg: layout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          width={width}
          onLayoutChange={(currentLayout: any[]) => {
            onLayoutChange(currentLayout);
          }}
          // @ts-ignore
          draggableHandle=".drag-handle"
        >
          {dashboard.items.map(item => (
            <div
              key={item.i}
              className="group flex flex-col overflow-hidden rounded-[2px] border border-monokai-border bg-monokai-surface transition-colors hover:border-monokai-border-strong"
            >
              <DashboardWidget
                savedQueryId={item.savedQueryId}
                refreshTrigger={refreshTrigger}
                onRemove={() => onRemoveWidget(item.i)}
                onNavigate={onNavigate}
              />
            </div>
          ))}
        </Responsive>
      )}
    </div>
  );
};
