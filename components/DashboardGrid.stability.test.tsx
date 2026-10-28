import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardGrid } from './DashboardGrid';
import type { Dashboard } from '../types';

const state = vi.hoisted(() => ({ fail: false, report: null as any }));
vi.mock('./DashboardWidget', () => ({ DashboardWidget: (props: any) => {
  if (props.item.i === 'bad' && state.fail) throw new Error('broken renderer');
  const [detail, setDetail] = React.useState('loading');
  React.useEffect(() => { state.report = (...args: any[]) => { setDetail(args[1]); props.onDisplayKind?.(...args); }; }, [props.onDisplayKind]);
  return <><p>{props.item.i} result</p><span>{detail}</span></>;
} }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); state.fail = false; });
const board: Dashboard = { id:'board', databaseName:'memory', name:'board', createdAt:1, updatedAt:1,
  items:[{i:'bad',savedQueryId:'q1',x:0,y:0,w:4,h:6},{i:'good',savedQueryId:'q2',x:4,y:0,w:8,h:6}] };
function setup() {
  let resize: ResizeObserverCallback = () => {};
  vi.stubGlobal('ResizeObserver', class { constructor(callback: ResizeObserverCallback) { resize = callback; } observe() {} disconnect() {} });
  const save = vi.fn();
  const view = render(<DashboardGrid dashboard={board} refreshTrigger={0} onLayoutChange={save} onRemoveWidget={vi.fn()}/>);
  act(() => resize([{contentRect:{width:1200}}] as ResizeObserverEntry[], {} as ResizeObserver));
  return { ...view, save, resize };
}
it('isolates a throwing card and retries it without losing the neighboring card', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  state.fail = true;
  setup();
  expect(screen.getByText('good result')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('组件显示失败');
  state.fail = false;
  fireEvent.click(screen.getByRole('button', {name:'重试此组件'}));
  expect(screen.getByText('bad result')).toBeInTheDocument();
  expect(screen.getByText('good result')).toBeInTheDocument();
});
it('does not move or resize cards when asynchronous content metadata arrives', () => {
  const view = setup();
  const layout = () => [...view.container.querySelectorAll('[data-widget-id]')].map(el => el.getAttribute('style'));
  const before = layout();
  expect(before).toHaveLength(2);
  act(() => state.report?.('bad', 'value', 1, 1));
  act(() => state.report?.('good', 'table', 100, 5, 48));
  expect(layout()).toEqual(before);
  expect(view.save).not.toHaveBeenCalled();
});
