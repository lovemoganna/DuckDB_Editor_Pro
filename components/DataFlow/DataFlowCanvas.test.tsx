import { describe, it, expect, vi, beforeAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { DataFlowCanvas } from './DataFlowCanvas';
import { DataFlowCustomEdge } from './edges/DataFlowCustomEdge';
import { useWorkflowStore } from '../../services/dataflow/workflowStore';

// Mock ResizeObserver for jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeAll(() => {
  // React Flow 在 jsdom 中会触碰 DOMMatrix；补齐避免测试后置 rAF 抛错
  if (typeof (window as any).DOMMatrixReadOnly === 'undefined') {
    (window as any).DOMMatrixReadOnly = class {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      constructor() {}
    };
  }
  if (typeof (window as any).DOMMatrix === 'undefined') {
    (window as any).DOMMatrix = (window as any).DOMMatrixReadOnly;
  }
});

// Mock ReactFlow to render children without WebGL / canvas requirement in jsdom
vi.mock('reactflow', async () => {
  const actual = await vi.importActual<any>('reactflow');
  return {
    ...actual,
    ReactFlow: ({ children }: any) => <div data-testid="reactflow-mock">{children}</div>,
    Background: () => <div data-testid="rf-background" />,
    useReactFlow: () => ({
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      fitView: vi.fn(),
      getZoom: () => 1,
      setCenter: vi.fn(),
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
    // 次要工具收纳在「工具」溢出菜单中
    expect(screen.getByText('工具')).toBeInTheDocument();
    fireEvent.click(screen.getByText('工具'));
    expect(screen.getByText('编译为 SQL')).toBeInTheDocument();
  });

  it('triggers compile to SQL callback when clicking 编译为 SQL', () => {
    const handleOpenInSql = vi.fn();
    render(<DataFlowCanvas onOpenInSqlEditor={handleOpenInSql} />);

    fireEvent.click(screen.getByText('工具'));
    fireEvent.click(screen.getByText('编译为 SQL'));

    expect(handleOpenInSql).toHaveBeenCalled();
  });

  it('renders clean empty state with action buttons when nodes are empty', () => {
    useWorkflowStore.setState({ nodes: [], edges: [], syncStatus: 'idle', lastSyncError: null });
    render(<DataFlowCanvas activeSql="" />);

    expect(screen.getByText('执行路径画布就绪')).toBeInTheDocument();
    expect(screen.getByText('前往 SQL 工作台')).toBeInTheDocument();
    expect(screen.getByText('全库表血缘')).toBeInTheDocument();
  });

  it('shows sync-from-SQL as primary empty CTA when editor already has SQL', () => {
    useWorkflowStore.setState({ nodes: [], edges: [], syncStatus: 'idle', lastSyncError: null });
    render(<DataFlowCanvas activeSql="SELECT 1 AS n" />);

    expect(screen.getByText('等待从 SQL 生成执行路径')).toBeInTheDocument();
    expect(screen.getByText('从当前 SQL 同步')).toBeInTheDocument();
    expect(screen.queryByText('前往 SQL 工作台')).not.toBeInTheDocument();
  });

  it('shows sync error empty state with retry CTA', () => {
    useWorkflowStore.setState({
      nodes: [],
      edges: [],
      syncStatus: 'error',
      lastSyncError: 'Parser Error: syntax error at or near SELECT',
    });
    render(<DataFlowCanvas activeSql="SELEC 1" onSwitchToSqlEditor={() => {}} />);

    expect(screen.getByText('执行路径同步失败')).toBeInTheDocument();
    expect(screen.getByText('Parser Error: syntax error at or near SELECT')).toBeInTheDocument();
    expect(screen.getByText('重试同步')).toBeInTheDocument();
    expect(screen.getByText('回编辑器修正')).toBeInTheDocument();
  });

  it('shows fault banner in split mode when inspector is closed', () => {
    useWorkflowStore.setState({
      loadWorkflow: (async () => {}) as any,
      nodes: [
        {
          id: 'node_bug',
          type: 'dataFlowNode',
          position: { x: 80, y: 80 },
          data: {
            label: 'FILTER',
            title: 'FILTER',
            status: 'error',
            type: 'schema',
            bugInfo: {
              hasBug: true,
              severity: 'error',
              title: '列不存在',
              detail: 'Referenced column missing',
              suggestion: '检查列名',
            },
            sqlRange: { startLine: 2, endLine: 2 },
          },
        } as any,
      ],
      edges: [],
      selectedNodeId: null,
    });

    render(<DataFlowCanvas layoutMode="split" hideSubNav />);

    // RTL render 会刷 effect：分屏异常自动打开 Inspector；关掉后应出现异常条
    fireEvent.click(screen.getByTitle('收起检查器'));
    const banner = screen.getByTestId('dataflow-fault-banner');
    expect(banner).toBeInTheDocument();
    expect(within(banner).getByText('查看诊断')).toBeInTheDocument();
    expect(within(banner).getByText('回 SQL')).toBeInTheDocument();
  });

  it('handles dataflow_trace_fault by selecting node and opening inspector', () => {
    useWorkflowStore.setState({
      loadWorkflow: (async () => {}) as any,
      nodes: [
        {
          id: 'node_where_err',
          type: 'dataFlowNode',
          position: { x: 100, y: 100 },
          data: {
            label: 'WHERE',
            title: 'WHERE 行级初筛',
            status: 'error',
            type: 'schema',
            bugInfo: {
              hasBug: true,
              severity: 'error',
              title: '字段别名提前引用',
              detail: 'Binder Error',
              suggestion: '改用原始表达式',
            },
            sqlRange: { startLine: 3, endLine: 3 },
          },
        } as any,
      ],
      edges: [],
      selectedNodeId: null,
      activeSqlRange: null,
    });

    render(<DataFlowCanvas />);

    const closeBtn = screen.queryByTitle('收起检查器');
    if (closeBtn) fireEvent.click(closeBtn);

    act(() => {
      window.dispatchEvent(
        new CustomEvent('dataflow_trace_fault', {
          detail: { nodeId: 'node_where_err', openInspector: true, focusSql: true },
        })
      );
    });

    expect(useWorkflowStore.getState().selectedNodeId).toBe('node_where_err');
    expect(useWorkflowStore.getState().activeSqlRange).toEqual({ startLine: 3, endLine: 3 });
    expect(screen.getByText('节点配置')).toBeInTheDocument();
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

  it('renders 快速溯源 Bug button when error node exists and focuses on culprit node', () => {
    // Inject a node with error status & bugInfo
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'node_where_err',
          type: 'dataFlowNode',
          position: { x: 100, y: 100 },
          data: {
            label: 'WHERE 行级初筛',
            title: 'WHERE 行级初筛',
            status: 'error',
            sqlStage: 'where',
            stepIndex: 2,
            bugInfo: {
              hasBug: true,
              severity: 'error',
              title: '字段别名提前引用',
              detail: 'Binder Error: Referenced column "discounted_price" does not exist in source table.',
              suggestion: '请将 WHERE 中的别名替换为原始计算表达式或在上一层 CTE 中计算。',
            },
            nodeType: 'filter',
            isSource: false,
            isOutput: false,
          },
        },
      ],
      edges: [],
      selectedNodeId: null,
      isInspectorOpen: false,
    });

    render(<DataFlowCanvas />);

    const bugTraceBtn = screen.getByText('快速溯源 Bug');
    expect(bugTraceBtn).toBeInTheDocument();

    fireEvent.click(bugTraceBtn);

    // Inspector should open and node should be selected
    const state = useWorkflowStore.getState();
    expect(state.selectedNodeId).toBe('node_where_err');
    expect(screen.getByText('节点配置')).toBeInTheDocument();
    expect(screen.getAllByText('字段别名提前引用').length).toBeGreaterThanOrEqual(1);
  });

  it('opens inspector via 套路解析 instead of dead node expansion toggle', () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'node_from',
          type: 'dataFlowNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'FROM 数据装载',
            title: 'FROM 数据装载',
            status: 'idle',
            sqlStage: 'from',
            stepIndex: 1,
            type: 'source',
            config: { tableName: 'orders' },
            paradigm: {
              stage: 'from',
              stageName: 'FROM',
              executionOrder: 1,
              roleDesc: '数据装载',
              mentalModel: '先确定数据从哪来',
              pitfallWarning: '注意别名与表作用域',
            },
            nodeType: 'sql',
            isSource: true,
            isOutput: false,
          },
        },
      ],
      edges: [],
      selectedNodeId: null,
    });

    render(<DataFlowCanvas />);

    fireEvent.click(screen.getByText('工具'));
    fireEvent.click(screen.getByText('套路解析'));

    expect(useWorkflowStore.getState().selectedNodeId).toBe('node_from');
    expect(screen.getByText('节点配置')).toBeInTheDocument();
    expect(screen.getByText('SQL 运行套路法则')).toBeInTheDocument();
  });

  it('renders DataFlowCustomEdge correctly with highlightState and isErrorPath without errors', () => {
    const { container, rerender } = render(
      <svg>
        <DataFlowCustomEdge
          id="edge_test_1"
          source="n1"
          target="n2"
          sourceX={100}
          sourceY={100}
          targetX={300}
          targetY={100}
          sourcePosition={'right' as any}
          targetPosition={'left' as any}
          data={{
            transformationType: 'filter',
            highlightState: 'ancestor',
            isErrorPath: false,
          }}
        />
      </svg>
    );

    expect(container.querySelector('path')).toBeInTheDocument();

    // Rerender with isErrorPath = true
    rerender(
      <svg>
        <DataFlowCustomEdge
          id="edge_test_1"
          source="n1"
          target="n2"
          sourceX={100}
          sourceY={100}
          targetX={300}
          targetY={100}
          sourcePosition={'right' as any}
          targetPosition={'left' as any}
          data={{
            transformationType: 'filter',
            highlightState: 'none',
            isErrorPath: true,
          }}
        />
      </svg>
    );

    expect(container.querySelector('path')).toBeInTheDocument();
  });

  it('renders 避坑演练 menu and loads a pitfall preset scenario', () => {
    const handleOpenInSql = vi.fn();
    render(<DataFlowCanvas onOpenInSqlEditor={handleOpenInSql} />);

    fireEvent.click(screen.getByText('工具'));
    fireEvent.click(screen.getByText('避坑演练'));
    expect(screen.getByText('别名在 WHERE 中提前使用 (Binder Error)')).toBeInTheDocument();

    // Click the preset
    fireEvent.click(screen.getByText('别名在 WHERE 中提前使用 (Binder Error)'));
    expect(handleOpenInSql).toHaveBeenCalled();
  });

  it('activates and controls 单步推演 simulation with floating stepper island', () => {
    render(<DataFlowCanvas />);

    fireEvent.click(screen.getByText('工具'));
    const stepperToggleBtn = screen.getByText('单步推演');
    expect(stepperToggleBtn).toBeInTheDocument();

    // Start stepping
    fireEvent.click(stepperToggleBtn);

    // Stepper island should be visible
    expect(screen.getByText('执行时序推演')).toBeInTheDocument();
    expect(screen.getByText(/STEP 1 \//)).toBeInTheDocument();

    // Step next
    const nextBtn = screen.getByText('单步推进');
    fireEvent.click(nextBtn);
    expect(screen.getByText(/STEP 2 \//)).toBeInTheDocument();

    // Exit stepping
    const exitBtn = screen.getByTitle('退出单步推演');
    fireEvent.click(exitBtn);

    expect(screen.queryByText('执行时序推演')).not.toBeInTheDocument();
  });
});


