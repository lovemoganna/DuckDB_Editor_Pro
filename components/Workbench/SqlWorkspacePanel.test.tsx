// @vitest-environment jsdom

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SqlWorkspacePanel, SqlQueryTab } from './SqlWorkspacePanel';

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
  DataFlowCanvas: ({ layoutMode }: any) => (
    <div data-testid="mock-dataflow-canvas" data-layout={layoutMode}>
      DataFlowCanvas Mock
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

  it('renders all 6 MECE toolbar zones in default closed mode', () => {
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

    // Zone 4: Persistence — save button (title pattern match)
    expect(screen.getByTitle('保存当前 SQL (Ctrl+S)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '更多持久化选项' })).toBeInTheDocument();

    // Zone 5: AI Assistance — exact title match
    expect(screen.getByTitle('AI 解释：一句话说明查询意图')).toBeInTheDocument();
    expect(screen.getByTitle('AI 分析：性能与逻辑风险诊断')).toBeInTheDocument();

    // Zone 6: History — history toggle button and catalog context chip
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
});
