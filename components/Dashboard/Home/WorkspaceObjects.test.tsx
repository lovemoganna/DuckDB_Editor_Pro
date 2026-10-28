// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { WorkspaceObjects } from './WorkspaceObjects';
import type { Dashboard } from '../../../types';
import { listAnalysisObjects } from '../../../services/analysisObjects';
import { addObjectToDashboard } from '../../../services/homeDashboardService';

vi.mock('../../../services/dbService', () => ({ dbService: { getDashboards: vi.fn(async () => []), saveDashboard: vi.fn() } }));
vi.mock('../../../services/analysisObjects', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../services/analysisObjects')>()), listAnalysisObjects: vi.fn(async () => [{ kind: 'metric', id: 'm1', name: '真实订单数' }, {kind:'metric',id:'missing',name:'失效订单数',unavailableReason:'来源表已不存在'}]) }));
vi.mock('../../../services/homeDashboardService', () => ({ addObjectToDashboard: vi.fn(async (_object, board) => board), createHomeView: vi.fn(), selectHomeView: vi.fn() }));
vi.mock('../../../services/databaseAnalysis', () => ({ useDatabaseAnalysis: (selector: (state: unknown) => unknown) => selector({revision: 1}), refreshDatabaseAnalysis: vi.fn() }));
vi.mock('../../../hooks/store/useAppStore', () => ({ useAppStore: (selector: (state: unknown) => unknown) => selector({currentDatabase: 'real'}) }));
vi.mock('../../../services/executiveWorkspace', () => ({ openExecutiveWorkspace: vi.fn() }));
vi.mock('../../../services/toastService', () => ({ toastService: { success: vi.fn() } }));
afterEach(cleanup);
const board = { id: 'board1', name: '工作台', items: [] } as Dashboard;

describe('workspace content library', () => {
  it('does not replace the current view when an add to a previous view finishes', async () => {
    let finish!: (board: Dashboard) => void;
    vi.mocked(addObjectToDashboard).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const onChange = vi.fn();
    const view = render(<WorkspaceObjects board={board} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', {name:'添加分析'}));
    fireEvent.click(await screen.findByRole('button', {name:'添加指标 真实订单数'}));
    view.rerender(<WorkspaceObjects board={{...board,id:'board2'}} onChange={onChange} />);
    await act(async () => finish(board));
    expect(onChange).not.toHaveBeenCalled();
  });
  it('marks a canonical saved object reference as already on the board', async () => {
    render(<WorkspaceObjects board={{...board,items:[{i:'placement',savedQueryId:'analysis-ref:metric:m1',x:0,y:0,w:3,h:3}]}} onChange={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'添加分析'}));
    await screen.findByText('真实订单数');
    expect(screen.getByText('已在看板')).toBeTruthy();
  });
  it('shows a failed load inside the open library and retries without closing it', async () => {
    vi.mocked(listAnalysisObjects).mockRejectedValueOnce(new Error('library unavailable'));
    render(<WorkspaceObjects board={board} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button',{name:'添加分析'}));
    const dialog=screen.getByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('library unavailable');
    expect(within(dialog).queryByText('暂无已保存的分析，可从数据集创建。')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button',{name:'重试读取分析对象'}));
    await within(dialog).findByText('真实订单数');
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });
  it('does not restore an older object list when update events overlap', async () => {
    let finishOlder!: (objects: Awaited<ReturnType<typeof listAnalysisObjects>>) => void;
    vi.mocked(listAnalysisObjects).mockImplementationOnce(() => new Promise(resolve => { finishOlder = resolve; }));
    render(<WorkspaceObjects board={board} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '添加分析' }));
    window.dispatchEvent(new Event('duckdb-analysis-objects-updated'));
    await screen.findByText('真实订单数');
    await act(async () => finishOlder([{ kind: 'metric', id: 'older', name: '过期对象' }]));
    await waitFor(() => expect(screen.queryByText('过期对象')).toBeNull());
    expect(screen.getByText('真实订单数')).toBeTruthy();
  });
  it('keeps a failed definition visible with its reason and disables adding it', async () => {
    render(<WorkspaceObjects board={board} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '添加分析' }));
    await screen.findByText('来源表已不存在');
    expect((screen.getByRole('button', {name:'添加指标 失效订单数'}) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', {name:'添加指标 真实订单数'}) as HTMLButtonElement).disabled).toBe(false);
  });
  it('keeps management collapsed and explains filtered empty results without losing source objects', async () => {
    render(<WorkspaceObjects board={board} onChange={vi.fn()} />);
    expect(screen.queryByRole('textbox', { name: '视图名称' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '添加分析' }));
    await screen.findByText('真实订单数');
    fireEvent.change(screen.getByRole('textbox', { name: '搜索分析对象' }), {target: {value: 'missing'}});
    expect(screen.getByText('没有匹配的分析内容')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
    expect(screen.getByText('真实订单数')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '关闭内容库' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: '视图设置' }));
    expect(screen.getByRole('textbox', { name: '视图名称' })).toBeTruthy();
  });
});
