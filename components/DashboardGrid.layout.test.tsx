import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardGrid } from './DashboardGrid';
import type { Dashboard } from '../types';

const grid = vi.hoisted(() => ({ props: null as any, mounts: 0 }));
vi.mock('react-grid-layout', () => ({
  default: (props: any) => { grid.props = props; return <div>{props.children}</div>; },
  noCompactor: {}, verticalCompactor: {},
}));
vi.mock('./DashboardWidget', () => ({ DashboardWidget: (props: any) => {
  React.useEffect(() => { grid.mounts++; }, []);
  return <div>分析结果</div>;
} }));
afterEach(() => vi.unstubAllGlobals());

it('does not persist resize adaptation; user resizing still saves', () => {
  let measure: ResizeObserverCallback = () => {};
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) { measure = callback; }
    observe() {} disconnect() {}
  });
  const board = { id: 'board', name: '分析', databaseName: 'test', layoutLocked: true,
    items: [{ i: 'item', x: 0, y: 0, w: 2, h: 2, queryId: 'query' }] } as Dashboard;
  const save = vi.fn();
  const props = { dashboard: board, refreshTrigger: 0, onLayoutChange: save, onRemoveWidget: vi.fn() };
  const view = render(<DashboardGrid {...props} />);
  for (const width of [1440, 768, 390, 1280]) act(() => measure([{ contentRect: { width } }] as ResizeObserverEntry[], {} as ResizeObserver));
  expect(save).not.toHaveBeenCalled();
  expect(board.items[0]).toMatchObject({ x: 0, y: 0, w: 2, h: 2 });
  const mounts = grid.mounts;
  for (const width of [1440, 390, 1280]) act(() => measure([{ contentRect: { width } }] as ResizeObserverEntry[], {} as ResizeObserver));
  expect(grid.mounts).toBe(mounts);
  view.rerender(<DashboardGrid {...props} dashboard={{ ...board, layoutLocked: false }} />);
  expect(grid.props.width).toBe(1280);
  act(() => grid.props.onResizeStop([{ i: 'item', x: 0, y: 0, w: 6, h: 7 }]));
  expect(save).toHaveBeenCalledWith([{ i: 'item', x: 0, y: 0, w: 6, h: 7 }]);
});
