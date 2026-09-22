import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataFlowCanvas } from './DataFlowCanvas';
import { useWorkflowStore } from '../../services/dataflow/workflowStore';

// Mock ResizeObserver for jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock ReactFlow to render children without WebGL / canvas requirement in jsdom
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    ReactFlow: ({ children }: any) => <div data-testid="reactflow-mock">{children}</div>,
    Background: () => <div data-testid="rf-background" />,
    useReactFlow: () => ({
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      fitView: vi.fn(),
      getZoom: () => 1,
    }),
  };
});

describe('DataFlowCanvas UI & Integration Tests', () => {
  beforeEach(async () => {
    await useWorkflowStore.getState().resetToDefaultDemo();
  });

  it('renders top tabs and controls', () => {
    render(<DataFlowCanvas />);

    // Top subrow tabs
    expect(screen.getByText('数据流画布')).toBeInTheDocument();
    expect(screen.getByText('SQL 编辑器')).toBeInTheDocument();
    expect(screen.getByText('表数据查看器')).toBeInTheDocument();
  });

  it('renders the 8 left sidebar rail actions', () => {
    render(<DataFlowCanvas />);

    // 自由编排模式下侧栏会自动展开；若仍折叠则点开
    const expandBtn = screen.queryByTitle('展开左侧资产与算子库');
    if (expandBtn) fireEvent.click(expandBtn);

    expect(screen.getAllByText('数据源').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SQL').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('数据表')).toBeInTheDocument();
    expect(screen.getAllByText('连接').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('聚合').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('可视化')).toBeInTheDocument();
    expect(screen.getByText('导出')).toBeInTheDocument();
    expect(screen.getByText('历史')).toBeInTheDocument();
  });

  it('renders right inspector panel with aggregate node configuration', () => {
    render(<DataFlowCanvas />);

    // 默认收起检查器；有选中节点时通过悬浮胶囊打开
    const openInspector = screen.getByTitle('查看已选节点的属性与数据预览');
    fireEvent.click(openInspector);

    expect(screen.getAllByText('聚合统计').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('节点配置')).toBeInTheDocument();
    expect(screen.getByText('SQL 预览')).toBeInTheDocument();
    expect(screen.getByText('运行节点')).toBeInTheDocument();
  });

  it('renders bottom drawer with run logs', () => {
    render(<DataFlowCanvas />);

    expect(screen.getByText('运行日志')).toBeInTheDocument();
    expect(screen.getByText('节点历史')).toBeInTheDocument();

    fireEvent.click(screen.getByText('展开控制台'));
    expect(screen.getByText('清空')).toBeInTheDocument();
    expect(screen.getByText('自动滚动')).toBeInTheDocument();
    expect(screen.getByText('DuckDB 运行中')).toBeInTheDocument();
  });

  it('renders dynamic generation mode switchers and workbench action buttons', () => {
    render(<DataFlowCanvas />);

    expect(screen.getByText('当前 SQL 流图')).toBeInTheDocument();
    expect(screen.getByText('全库表与视图血缘')).toBeInTheDocument();
    expect(screen.getByText('自由编排')).toBeInTheDocument();
    expect(screen.getByText('从 SQL 同步')).toBeInTheDocument();
    expect(screen.getByText('运行全流程')).toBeInTheDocument();
    expect(screen.getByText('编译为 SQL')).toBeInTheDocument();
  });

  it('triggers compile to SQL callback when clicking 编译为 SQL', () => {
    const handleOpenInSql = vi.fn();
    render(<DataFlowCanvas onOpenInSqlEditor={handleOpenInSql} />);

    const compileBtn = screen.getByText('编译为 SQL');
    fireEvent.click(compileBtn);

    expect(handleOpenInSql).toHaveBeenCalled();
  });

  it('renders clean empty state with action buttons when nodes are empty', () => {
    useWorkflowStore.setState({ nodes: [], edges: [] });
    render(<DataFlowCanvas activeSql="" />);

    expect(screen.getByText('数据流画布就绪')).toBeInTheDocument();
    expect(screen.getByText('前往 SQL 工作台')).toBeInTheDocument();
    expect(screen.getByText('全库表血缘')).toBeInTheDocument();
  });

  it('renders Quick Add operator button on toolbar and allows adding operator', () => {
    render(<DataFlowCanvas />);

    const addBtn = screen.getByText('加算子');
    expect(addBtn).toBeInTheDocument();

    fireEvent.click(addBtn);
    expect(screen.getAllByText('SQL 转换').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('表连接 (Join)')).toBeInTheDocument();
    expect(screen.getByText('聚合统计 (GroupBy)')).toBeInTheDocument();
    expect(screen.getByText('结果表 (Result)')).toBeInTheDocument();
    expect(screen.getByText('导出文件 (Export)')).toBeInTheDocument();

    const initialNodes = useWorkflowStore.getState().nodes.length;
    fireEvent.click(screen.getByText('表连接 (Join)'));
    expect(useWorkflowStore.getState().nodes.length).toBe(initialNodes + 1);
  });
});

