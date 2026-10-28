import { describe, it, expect, vi, beforeAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
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
    useViewport: () => ({ zoom: 1, x: 0, y: 0 }),
    Background: () => <div data-testid="rf-background" />,
    useReactFlow: () => ({
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      fitView: vi.fn(),
      getZoom: () => 1,
      setCenter: vi.fn(),
      setViewport: vi.fn(),
      getNodes: () => useWorkflowStore.getState().nodes,
    }),
  };
});

describe('DataFlowCanvas UI & Integration Tests', () => {
  it('offers all SQL layouts and changes geometry without losing relationships', async () => {
    render(<DataFlowCanvas activeSql="SELECT customer_id, SUM(sales_amount) as total_spent FROM demo_sales GROUP BY customer_id" />);
    const chooser = screen.getByRole('combobox', { name: '流程图布局' });
    expect(within(chooser).getAllByRole('option').map(o => o.textContent)).toEqual(['自动','横向','纵向','树形','力导向']);
    await waitFor(()=>expect(useWorkflowStore.getState().syncStatus).toBe('ready'));
    const edges=useWorkflowStore.getState().edges.map(e=>e.id);
    expect(edges.length).toBeGreaterThan(0);
    fireEvent.change(chooser,{target:{value:'vertical'}});
    await waitFor(()=>{
      expect(useWorkflowStore.getState().nodes.length).toBeGreaterThan(0);
      expect(useWorkflowStore.getState().nodes.filter(n=>n.type!=='logicalBoundary').every(n=>n.data.flowDirection==='DOWN')).toBe(true);
    });
    expect(useWorkflowStore.getState().edges.map(e=>e.id)).toEqual(edges);
    await act(()=>useWorkflowStore.getState().setSqlLayoutMode('auto'));
  });
  it('returns to a ready empty canvas for SQL that contains only comments', async () => {
    await useWorkflowStore.getState().syncFromSql('-- editor guidance\n/* another header */', 'empty');
    render(<DataFlowCanvas activeSql={'-- editor guidance\n/* another header */'} />);
    expect(screen.getByText('执行路径画布就绪')).toBeInTheDocument();
    expect(screen.queryByText('等待从 SQL 生成执行路径')).not.toBeInTheDocument();
    expect(useWorkflowStore.getState().nodes).toHaveLength(0);
    expect(useWorkflowStore.getState().syncStatus).toBe('idle');
  });

  beforeEach(async () => {
    await useWorkflowStore.getState().syncFromSql(
      `SELECT customer_id, SUM(sales_amount) as total_spent FROM demo_sales GROUP BY customer_id`,
      '销售分析'
    );
    const aggNode = useWorkflowStore.getState().nodes.find(n => n.data.type === 'aggregate' || n.id === 'node_agg_step');
    if (aggNode) {
      useWorkflowStore.getState().selectNode(aggNode.id);
    }
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

    // 侧栏默认折叠；若折叠则点开
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

    expect(screen.getByText('Relation 状态（语义推断）')).toBeInTheDocument();
    expect(screen.getByText('Grain · 粒度')).toBeInTheDocument();
    expect(screen.getByText('真实 Statement 输出')).toBeInTheDocument();
    expect(screen.queryByText('运行节点')).not.toBeInTheDocument();
  });

  it('renders bottom drawer with run logs', () => {
    render(<DataFlowCanvas />);

    expect(screen.getByText('运行日志')).toBeInTheDocument();
    expect(screen.getByText('节点历史')).toBeInTheDocument();

    fireEvent.click(screen.getByText('展开控制台'));
    expect(screen.getByText('清空')).toBeInTheDocument();
    expect(screen.getByText('自动滚动')).toBeInTheDocument();
    expect(screen.getByText('流程待运行')).toBeInTheDocument();
  });

  it('renders dynamic generation mode switchers and workbench action buttons', () => {
    render(<DataFlowCanvas />);

    expect(screen.getByText('当前 SQL 流图')).toBeInTheDocument();
    expect(screen.getByText('全库表与视图血缘')).toBeInTheDocument();
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
    expect(screen.queryByText('从当前 SQL 重建')).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByTitle('关闭属性抽屉'));
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

    const closeBtn = screen.queryByTitle('关闭属性抽屉');
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

  it('renders Quick Add operator button on toolbar and allows adding operator in custom mode', () => {
    useWorkflowStore.setState({ dataFlowMode: 'custom' });
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

  it('preserves an explicit custom mode when the editor contains SQL', async () => {
    useWorkflowStore.setState({ dataFlowMode: 'custom', liveSyncWithSql: false });
    render(<DataFlowCanvas activeSql="SELECT 1" />);
    await new Promise(resolve => setTimeout(resolve, 220));
    expect(useWorkflowStore.getState().dataFlowMode).toBe('custom');
    expect(screen.getByText('加算子')).toBeInTheDocument();
    expect(screen.queryByText('从 SQL 同步')).not.toBeInTheDocument();
  });

  it('preserves catalog mode and hides graph editing with SQL present', async () => {
    useWorkflowStore.setState({ dataFlowMode: 'catalog', liveSyncWithSql: false });
    render(<DataFlowCanvas activeSql="SELECT 1" />);
    await new Promise(resolve => setTimeout(resolve, 220));
    expect(useWorkflowStore.getState().dataFlowMode).toBe('catalog');
    expect(screen.queryByText('加算子')).not.toBeInTheDocument();
    expect(screen.getByText('刷新血缘')).toBeInTheDocument();
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

  it('tools menu keeps step/compile and no longer exposes preset/paradigm entries', () => {
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
    expect(screen.getByText('单步推演')).toBeInTheDocument();
    expect(screen.getByText('编译为 SQL')).toBeInTheDocument();
    expect(screen.queryByText('套路解析')).not.toBeInTheDocument();
    expect(screen.queryByText('避坑演练')).not.toBeInTheDocument();
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

  it('dynamically recalculates flowchart when activeSql changes from Code A to Code B', async () => {
    useWorkflowStore.setState({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      dataFlowMode: 'sql',
      liveSyncWithSql: true,
      syncStatus: 'idle',
      activeSql: '',
    });

    const { rerender } = render(
      <DataFlowCanvas
        layoutMode="split"
        activeSql="SELECT country, SUM(sales) FROM sales GROUP BY country"
        activeTabTitle="Code A"
      />
    );

    // Canvas effect alone must build Code A (no manual syncFromSql)
    await waitFor(() => {
      const state = useWorkflowStore.getState();
      expect(state.nodes.some(n => n.data.tableName === 'sales' || n.data.title.includes('sales'))).toBe(true);
      expect(state.nodes.some(n => n.data.type === 'aggregate' || n.data.title.includes('聚合') || n.data.title.toLowerCase().includes('sum'))).toBe(true);
      expect(state.nodes.some(n => n.data.type === 'join')).toBe(false);
    }, { timeout: 3000 });

    rerender(
      <DataFlowCanvas
        layoutMode="split"
        activeSql="SELECT o.id, u.name FROM orders o JOIN users u ON o.user_id = u.id"
        activeTabTitle="Code B"
      />
    );

    await waitFor(() => {
      const state = useWorkflowStore.getState();
      // Code A structure fully replaced
      expect(state.nodes.some(n => n.data.tableName === 'sales' || n.data.title.includes('sales'))).toBe(false);
      expect(state.nodes.some(n => n.data.type === 'aggregate')).toBe(false);
      // Code B generated
      expect(state.nodes.some(n => n.data.tableName === 'orders' || n.data.title.includes('orders'))).toBe(true);
      expect(state.nodes.some(n => n.data.tableName === 'users' || n.data.title.includes('users'))).toBe(true);
      expect(state.nodes.some(n => n.data.type === 'join')).toBe(true);
      expect(state.activeTabTitle).toBe('Code B');
    }, { timeout: 3000 });
  });

  it('activates and controls 单步推演 simulation in Custom mode', () => {
    useWorkflowStore.setState({dataFlowMode:'custom',liveSyncWithSql:false});
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


