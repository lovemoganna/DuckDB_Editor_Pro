// @vitest-environment jsdom

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SqlWorkspacePanel, SqlQueryTab } from './SqlWorkspacePanel';
import { dbService } from '../../services/dbService';

afterEach(() => vi.restoreAllMocks());

// Mock ResizeObserver for jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock chartjs to avoid canvas errors in jsdom
vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="mock-bar-chart" />,
  Line: () => <div data-testid="mock-line-chart" />,
  Scatter: () => <div data-testid="mock-scatter-chart" />,
}));

// Mock the entire DataFlowCanvas component so that reactflow / webgl is never needed in these tests
vi.mock('../DataFlow/DataFlowCanvas', () => ({
  DataFlowCanvas: ({ layoutMode, onChangeLayoutMode }: any) => (
    <div data-testid="mock-dataflow-canvas" data-layout={layoutMode}>
      DataFlowCanvas Mock
      <button onClick={() => onChangeLayoutMode('canvas')}>全屏数据流模式</button>
      <button onClick={() => onChangeLayoutMode('split')}>分屏对照模式</button>
    </div>
  ),
}));

describe('SqlWorkspacePanel MECE Toolbar & Flowchart Interaction Tests', () => {
  const mockTabs: SqlQueryTab[] = [
    {
      id: 'tab-1',
      title: 'query_1.sql',
      sql: 'SELECT * FROM test_table LIMIT 10;',
      isDirty: false,
    },
  ];

  const defaultProps = {
    tabs: mockTabs,
    activeTabId: 'tab-1',
    catalogContext: { catalog: 'memory', schema: 'main' },
    onSelectTab: vi.fn(),
    onAddTab: vi.fn(),
    onCloseTab: vi.fn(),
    onUpdateTabSql: vi.fn(),
    onRenameTab: vi.fn(),
    onExecuteQuery: vi.fn().mockResolvedValue(undefined),
    onExecuteSelection: vi.fn().mockResolvedValue(undefined),
    onStopQuery: vi.fn(),
    isRunning: false,
    activeQueryResult: null,
    onToggleDataFlow: vi.fn(),
    onSelectDataFlow: vi.fn(),
    onTriggerAiExplain: vi.fn(),
    onTriggerAiAnalyze: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('lets keyboard users resize and reset the editor/result split with persisted bounds', () => {
    render(<SqlWorkspacePanel {...defaultProps} />);
    const splitter = screen.getByRole('separator', {name:'调整 SQL 编辑器与结果区域高度'});
    splitter.focus();
    fireEvent.keyDown(splitter, {key:'ArrowDown'});
    expect(splitter.getAttribute('aria-valuenow')).toBe('45');
    expect(localStorage.getItem('workbench_split_pct')).toBe('45');
    fireEvent.keyDown(splitter, {key:'End'});
    fireEvent.keyDown(splitter, {key:'ArrowDown'});
    expect(splitter.getAttribute('aria-valuenow')).toBe('85');
    fireEvent.keyDown(splitter, {key:'Home'});
    expect(splitter.getAttribute('aria-valuenow')).toBe('15');
    fireEvent.keyDown(splitter, {key:'Enter'});
    expect(splitter.getAttribute('aria-valuenow')).toBe('50');
  });

  it('allows graph projection of an executed unsaved query and blocks it only after later edits',()=>{
    const result={executedSql:mockTabs[0].sql,executedDocumentSql:mockTabs[0].sql,databaseName:'memory',schemaName:'main',columns:['id'],rows:[{id:1}],executionTime:1};
    const view=render(<SqlWorkspacePanel {...defaultProps} tabs={[{...mockTabs[0],isDirty:true}]} activeQueryResult={result}/>);
    expect(screen.getByRole('button',{name:'在图谱中查看'})).toBeEnabled();
    view.rerender(<SqlWorkspacePanel {...defaultProps} tabs={[{...mockTabs[0],sql:'SELECT changed',isDirty:true}]} activeQueryResult={result}/>);
    expect(screen.getByRole('button',{name:'在图谱中查看'})).toBeDisabled();
  });

  it('renders toolbar zones in default closed mode without redundant save button next to flowchart', () => {
    render(<SqlWorkspacePanel {...defaultProps} isDataFlowActive={false} />);

    // Zone 1: Core Execution — Run button and stop
    expect(screen.getByTitle('运行全文 (Ctrl+Enter)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '更多执行选项' })).toBeInTheDocument();
    // Stop button (disabled when not running) has title "无正在执行的查询"
    expect(screen.getByTitle('无正在执行的查询')).toBeInTheDocument();

    // Zone 2: Source Editing — Format, Copy, Font size
    expect(screen.getByTitle('智能格式化 SQL (Ctrl+Shift+F)')).toBeInTheDocument();
    expect(screen.getByTitle('复制当前 SQL 代码到剪贴板')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '减小字号' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '增大字号' })).toBeInTheDocument();

    // Zone 3: View & Flowchart Mode — flowchart toggle (DAG badge lives in mode menu)
    expect(screen.getByText('流程图')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '流程图模式选项' })).toBeInTheDocument();

    // Redundant save button on toolbar right of flowchart has been cleanly removed
    expect(screen.queryByTitle('保存当前 SQL (Ctrl+S)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '更多持久化选项' })).not.toBeInTheDocument();

    // Zone 4: AI Assistance — exact title match
    expect(screen.getByTitle('AI 解释：一句话说明查询意图')).toBeInTheDocument();
    expect(screen.getByTitle('AI 分析：性能与逻辑风险诊断')).toBeInTheDocument();

    // Zone 5: History — history toggle button and catalog context chip
    expect(screen.getByTitle('查询执行历史')).toBeInTheDocument();
    // Catalog chip (hidden on smaller viewports via 'hidden lg:flex' but present in DOM)
    expect(screen.getByTitle(/当前目录上下文/)).toBeInTheDocument();
  });

  it('calls onToggleDataFlow(true) when clicking the Flowchart toggle button in closed state', () => {
    const handleToggleDataFlow = vi.fn();
    render(<SqlWorkspacePanel {...defaultProps} isDataFlowActive={false} onToggleDataFlow={handleToggleDataFlow} />);

    const flowchartBtn = screen.getByText('流程图').closest('button')!;
    fireEvent.click(flowchartBtn);

    expect(handleToggleDataFlow).toHaveBeenCalledWith(true);
  });

  it('renders controls (大屏拓扑, 收起流程图) and resizer divider when isDataFlowActive is true', () => {
    const handleToggleDataFlow = vi.fn();
    render(<SqlWorkspacePanel {...defaultProps} isDataFlowActive={true} onToggleDataFlow={handleToggleDataFlow} />);

    expect(screen.getByText('大屏拓扑')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '收起流程图' })).toBeInTheDocument();

    // Vertical resizer divider is rendered in split layout
    expect(screen.getByTestId('dataflow-split-divider')).toBeInTheDocument();

    // Clicking close button triggers onToggleDataFlow(false)
    fireEvent.click(screen.getByRole('button', { name: '收起流程图' }));
    expect(handleToggleDataFlow).toHaveBeenCalledWith(false);
  });

  it('navigates to dataflow via 大屏拓扑 button', () => {
    const handleNavigate = vi.fn();
    render(<SqlWorkspacePanel {...defaultProps} isDataFlowActive={true} onNavigateToDataFlow={handleNavigate} />);

    const navBtn = screen.getByText('大屏拓扑');
    fireEvent.click(navBtn);

    expect(handleNavigate).toHaveBeenCalledTimes(1);
  });

  it('toggles flowchart via Alt+D keyboard shortcut (bound on document)', () => {
    const handleToggleDataFlow = vi.fn();
    render(<SqlWorkspacePanel {...defaultProps} isDataFlowActive={false} onToggleDataFlow={handleToggleDataFlow} />);

    // Alt+D is bound to document
    fireEvent.keyDown(document, { key: 'd', altKey: true });
    expect(handleToggleDataFlow).toHaveBeenCalledWith(true);
  });

  it('opens flowchart dropdown and shows correct menu items', () => {
    render(<SqlWorkspacePanel {...defaultProps} isDataFlowActive={false} />);

    const menuBtn = screen.getByRole('button', { name: '流程图模式选项' });
    fireEvent.click(menuBtn);

    // The dropdown menu renders with role="menu" and aria-label="流程图展开选项"
    expect(screen.getByRole('menu', { name: '流程图展开选项' })).toBeInTheDocument();
    expect(screen.getByText('对照分屏')).toBeInTheDocument();
    expect(screen.getByText('进入数据流大屏')).toBeInTheDocument();
    expect(screen.getByText('DAG')).toBeInTheDocument();
  });

  it('switches the actual content area to canvas and restores the split editor', () => {
    render(<SqlWorkspacePanel {...defaultProps} isDataFlowActive={true} />);
    expect(screen.getByTestId('dataflow-split-divider')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '全屏数据流模式' }));
    expect(screen.getByTestId('mock-dataflow-canvas')).toHaveAttribute('data-layout', 'canvas');
    expect(screen.getByTestId('mock-dataflow-canvas').parentElement).toHaveStyle({ width: '100%' });
    expect(screen.queryByTestId('dataflow-split-divider')).not.toBeInTheDocument();
    expect(document.querySelector('.cm-content')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '分屏对照模式' }));
    expect(screen.getByTestId('mock-dataflow-canvas')).toHaveAttribute('data-layout', 'split');
    expect(screen.getByTestId('dataflow-split-divider')).toBeInTheDocument();
    expect(document.querySelector('.cm-content')).not.toBeNull();
  });

  it('resets vertical resizer split percentage on double click', () => {
    render(<SqlWorkspacePanel {...defaultProps} isDataFlowActive={true} />);

    const resizer = screen.getByTestId('dataflow-split-divider');
    fireEvent.doubleClick(resizer);

    expect(localStorage.getItem('workbench_dataflow_split_pct')).toBe('50');
  });

  it('tab bar shows active query tab title', () => {
    render(<SqlWorkspacePanel {...defaultProps} isDataFlowActive={false} />);
    expect(screen.getByText('query_1.sql')).toBeInTheDocument();
  });

  it('safely handles empty activeSqlRange and empty doc without throwing RangeError', () => {
    const emptyTab = [{ id: 'empty_tab', title: 'empty.sql', sql: '' }];
    expect(() => {
      render(
        <SqlWorkspacePanel
          {...defaultProps}
          tabs={emptyTab}
          activeTabId="empty_tab"
          activeSqlRange={{ startLine: 1, endLine: 1 }}
        />
      );
    }).not.toThrow();
  });

  it('renders close button even with 1 tab and opens context menu on right click and more options button', () => {
    const onCloseTab = vi.fn();
    const onCloseOtherTabs = vi.fn();
    const onCloseAllTabs = vi.fn();

    const twoTabs = [
      ...mockTabs,
      { id: 'tab-2', title: 'query_2.sql', sql: 'SELECT 2;', isDirty: false },
    ];

    render(
      <SqlWorkspacePanel
        {...defaultProps}
        tabs={twoTabs}
        activeTabId="tab-1"
        onCloseTab={onCloseTab}
        onCloseOtherTabs={onCloseOtherTabs}
        onCloseAllTabs={onCloseAllTabs}
      />
    );

    // Close button exists even on tabs
    const closeButtons = screen.getAllByLabelText('关闭标签页');
    expect(closeButtons.length).toBeGreaterThan(0);

    // Click close button on active tab
    fireEvent.click(closeButtons[0]);
    expect(onCloseTab).toHaveBeenCalledWith('tab-1');

    // Right click on tab-1
    const tabEl = screen.getByText('query_1.sql').closest('[role="tab"], div')!;
    fireEvent.contextMenu(tabEl, { clientX: 200, clientY: 100 });

    // Menu should show Save As and Close options
    expect(screen.getByText('另存为已保存查询...')).toBeTruthy();
    expect(screen.getByText('另存为本地 .duckdb 文件')).toBeTruthy();
    expect(screen.getByText('另存为本地 .sql 文件')).toBeTruthy();
    expect(screen.getByText('复制为新标签页 (副本)')).toBeTruthy();
    expect(screen.getByText('重命名标签页')).toBeTruthy();
    expect(screen.getByText('关闭当前标签页')).toBeTruthy();
    expect(screen.getByText('关闭其他标签页')).toBeTruthy();
    expect(screen.getByText('关闭右侧标签页')).toBeTruthy();
    expect(screen.getByText('关闭全部标签页')).toBeTruthy();

    // Click "关闭其他标签页"
    fireEvent.click(screen.getByText('关闭其他标签页'));
    expect(onCloseOtherTabs).toHaveBeenCalledWith('tab-1');
  });

  it('keeps single-tab controls visible and disables other/right close actions', () => {
    render(<SqlWorkspacePanel {...defaultProps} />);
    expect(screen.getByLabelText('关闭标签页').className).toContain('opacity-100');
    expect(screen.getByLabelText('标签选项').className).toContain('opacity-100');
    fireEvent.click(screen.getByLabelText('标签选项'));
    expect(screen.getByText('关闭其他标签页').closest('button')).toBeDisabled();
    expect(screen.getByText('关闭右侧标签页').closest('button')).toBeDisabled();
  });

  it('keeps action controls discoverable on inactive tabs too', () => {
    render(<SqlWorkspacePanel {...defaultProps} tabs={[...mockTabs, { id: 'tab-2', title: 'query_2.sql', sql: 'SELECT 2;' }]} />);
    const more = screen.getAllByLabelText('标签选项');
    const close = screen.getAllByLabelText('关闭标签页');
    expect(more[1].className).toContain('opacity-70');
    expect(close[1].className).toContain('opacity-70');
  });

  it('saves the named target into its catalog and marks it saved after persistence', async () => {
    const save = vi.spyOn(dbService, 'saveQuery').mockResolvedValue(undefined);
    const onTabSaved = vi.fn();
    render(<SqlWorkspacePanel {...defaultProps} onTabSaved={onTabSaved}
      catalogContext={{catalog:'sales',schema:'main'}} />);
    fireEvent.click(screen.getByLabelText('标签选项'));
    fireEvent.click(screen.getByText('另存为已保存查询...'));
    fireEvent.change(screen.getByPlaceholderText('输入查询名称...'), {target:{value:' 自定义查询 '}});
    fireEvent.click(screen.getByRole('button',{name:'另存为',exact:true}));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      name:'自定义查询',sql:mockTabs[0].sql,databaseName:'sales',
    })));
    await waitFor(() => expect(onTabSaved).toHaveBeenCalledWith('tab-1',mockTabs[0].sql,'sales'));
  });

  it('keeps the save dialog and dirty state when database persistence fails', async () => {
    vi.spyOn(dbService, 'saveQuery').mockRejectedValue(new Error('disk unavailable'));
    const onTabSaved = vi.fn();
    render(<SqlWorkspacePanel {...defaultProps} onTabSaved={onTabSaved} />);
    fireEvent.click(screen.getByLabelText('标签选项'));
    fireEvent.click(screen.getByText('另存为已保存查询...'));
    fireEvent.click(screen.getByRole('button',{name:'另存为',exact:true}));
    await waitFor(() => expect(screen.getByRole('button',{name:'另存为',exact:true})).toBeEnabled());
    expect(screen.getByPlaceholderText('输入查询名称...')).toBeInTheDocument();
    expect(onTabSaved).not.toHaveBeenCalled();
  });

  it.each(['关闭当前标签页','关闭其他标签页','关闭右侧标签页','关闭全部标签页'])(
    'confirms unsaved changes before %s and preserves tabs on cancellation', async action => {
      const confirm = vi.spyOn(window,'confirm').mockReturnValue(false);
      const close = vi.fn();
      render(<SqlWorkspacePanel {...defaultProps} tabs={[
        {...mockTabs[0],isDirty:true}, {id:'second',title:'second.sql',sql:'SELECT 2;',isDirty:true},
      ]} onCloseTab={close} onCloseOtherTabs={close} onCloseTabsToRight={close} onCloseAllTabs={close} />);
      fireEvent.click(screen.getAllByLabelText('标签选项')[0]);
      fireEvent.click(screen.getByText(action));
      await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
      expect(close).not.toHaveBeenCalled();
    }
  );

  it('supports middle close and double clicking the blank strip or title', () => {
    render(<SqlWorkspacePanel {...defaultProps} />);
    fireEvent.mouseDown(screen.getByRole('tab',{name:/query_1/}),{button:1});
    expect(defaultProps.onCloseTab).toHaveBeenCalledWith('tab-1');
    fireEvent.doubleClick(screen.getByRole('tablist',{name:'SQL 查询标签页'}));
    expect(defaultProps.onAddTab).toHaveBeenCalledOnce();
    fireEvent.doubleClick(screen.getByText('query_1.sql'));
    fireEvent.change(screen.getByLabelText('重命名查询标签'),{target:{value:'renamed.sql'}});
    fireEvent.keyDown(screen.getByLabelText('重命名查询标签'),{key:'Enter'});
    expect(defaultProps.onRenameTab).toHaveBeenCalledWith('tab-1','renamed.sql');
  });
});
