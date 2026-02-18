import React, { useEffect, useState, useRef } from 'react';
// @ts-ignore
import { Responsive } from 'react-grid-layout';
// @ts-ignore
import 'react-grid-layout/css/styles.css';
import { Dashboard, DashboardItem } from '../types';
import { DashboardWidget } from './DashboardWidget';
import _ from 'lodash';

interface DashboardGridProps {
    dashboard: Dashboard;
    refreshTrigger: number;
    onLayoutChange: (layout: any[]) => void;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({ dashboard, refreshTrigger, onLayoutChange }) => {
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
        minH: 2
    }));

    return (
        <div ref={containerRef} className="w-full h-full">
            {width > 0 && (
                <Responsive
                    className="layout"
                    layouts={{ lg: layout }}
                    breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                    cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                    rowHeight={60}
                    width={width}
                    onLayoutChange={(currentLayout: any[]) => {
                        // Convert back to DashboardItem format
                        // We only care about the layout changes (x, y, w, h)
                        // We need to merge this back into the parent Dashboard object
                        // But here we just emit the raw layout for the parent to handle
                        onLayoutChange(currentLayout);
                    }}
                    // @ts-ignore
                    draggableHandle=".drag-handle"
                >
                    {dashboard.items.map(item => (
                        <div key={item.i} className="bg-monokai-sidebar border border-monokai-accent rounded shadow-lg overflow-hidden flex flex-col">
                            <DashboardWidget
                                savedQueryId={item.savedQueryId}
                                refreshTrigger={refreshTrigger}
                            />
                        </div>
                    ))}
                </Responsive>
            )}
        </div>
    );
};
