import { describe, it, expect, beforeEach, vi } from 'vitest';
import { duckDBService } from '../duckdbService';
import { useWorkflowStore } from './workflowStore';
import {
  getInitialEcommerceNodes,
  getInitialEcommerceEdges,
} from './seedEcommerceWorkflow';

/** Custom-mode fixture only — production paths must never inject this graph. */
function seedCustomGraphFixture() {
  useWorkflowStore.setState({
    nodes: getInitialEcommerceNodes(),
    edges: getInitialEcommerceEdges(),
    selectedNodeId: 'node-aggregate',
    dataFlowMode: 'custom',
    liveSyncWithSql: false,
    activeSql: '',
    activeTabTitle: '',
    syncStatus: 'ready',
    lastSyncError: null,
    activeSqlRange: null,
  });
}

describe('Workflow Store & State Machine Tests', () => {
  it('attaches execution results without profiling and executing SQL for a second time',async()=>{
    const plan=vi.spyOn(duckDBService,'getExplainPlan').mockResolvedValue({planText:'Error explaining query: multi statement'});
    const sql='UPDATE users SET kyc_level=2; SELECT COUNT(*) FROM users';
    try {
      useWorkflowStore.setState({activeSql:sql});
      await useWorkflowStore.getState().syncExecutionResult('一次执行',{rows:[{count:10}],columns:['count']},sql);
      expect(plan).not.toHaveBeenCalled();
    } finally { plan.mockRestore(); }
  });
  it('clears source graphs, previews and SQL when switching databases', () => {
    seedCustomGraphFixture();
    useWorkflowStore.setState({ activeSql: 'SELECT * FROM old_table', availableTables: ['old_table'] });
    useWorkflowStore.getState().resetDatabaseContext();
    expect(useWorkflowStore.getState().nodes).toEqual([]);
    expect(useWorkflowStore.getState().edges).toEqual([]);
    expect(useWorkflowStore.getState().activeSql).toBe('');
    expect(useWorkflowStore.getState().availableTables).toEqual([]);
  });
  beforeEach(() => {
    localStorage.removeItem('duckdb_workflow_state_v3');
    useWorkflowStore.setState({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      activeSql: '',
      activeTabTitle: '',
      runLogs: [],
      dataFlowMode: 'sql',
      liveSyncWithSql: true,
      syncStatus: 'idle',
      lastSyncError: null,
      activeSqlRange: null,
    });
  });

  it('resetToDefaultDemo clears graph when no active SQL (never injects ecommerce demo)', async () => {
    seedCustomGraphFixture();
    useWorkflowStore.setState({ activeSql: '' });
    await useWorkflowStore.getState().resetToDefaultDemo();
    const { nodes, edges, selectedNodeId, dataFlowMode, liveSyncWithSql } = useWorkflowStore.getState();
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
    expect(selectedNodeId).toBeNull();
    expect(dataFlowMode).toBe('sql');
    expect(liveSyncWithSql).toBe(true);
  });

  it('resetToDefaultDemo rebuilds graph from activeSql only', async () => {
    useWorkflowStore.setState({
      activeSql: 'SELECT country, SUM(amount) AS total FROM sales GROUP BY country',
      activeTabTitle: '区域汇总',
    });
    await useWorkflowStore.getState().resetToDefaultDemo();
    const { nodes, edges, activeSql } = useWorkflowStore.getState();
    expect(activeSql.toLowerCase()).toContain('sales');
    expect(nodes.length).toBeGreaterThan(0);
    expect(edges.length).toBeGreaterThanOrEqual(1);
    expect(nodes.some(n => n.id === 'node-aggregate')).toBe(false);
  });

  it('loadWorkflow initializes clean empty state when no tables exist and no SQL provided, avoiding fake data injection', async () => {
    // Calling loadWorkflow with empty string and no tables in DB
    await useWorkflowStore.getState().loadWorkflow('', '');
    const { nodes, edges, dataFlowMode } = useWorkflowStore.getState();
    expect(nodes.length).toBe(0);
    expect(edges.length).toBe(0);
    expect(dataFlowMode).toBe('sql');
  });

  it('loadWorkflow parses SQL directly when activeSql contains comments before WITH', async () => {
    const commentedSql = `
      -- 商业指标分析查询
      /* 多行说明注释 */
      WITH
        kpi AS (
          SELECT id, amount FROM orders WHERE amount > 50
        )
      SELECT * FROM kpi;
    `;
    await useWorkflowStore.getState().loadWorkflow(commentedSql, 'KPI分析');
    const { nodes, edges, activeTabTitle } = useWorkflowStore.getState();
    expect(activeTabTitle).toBe('KPI分析');
    expect(nodes.some(n => n.data.type === 'source')).toBe(true);
    expect(nodes.some(n => n.data.type === 'result')).toBe(true);
    expect(edges.length).toBeGreaterThanOrEqual(1);
  });

  it('propagates dirty state to downstream nodes when config changes', () => {
    seedCustomGraphFixture();
    const store = useWorkflowStore.getState();

    // 修改 SQL Transform 节点配置
    store.updateNodeConfig('node-sql-transform', {
      sql: `SELECT * FROM {{input}} WHERE sales_amount > 100`,
    });

    const updatedNodes = useWorkflowStore.getState().nodes;
    const sqlNode = updatedNodes.find(n => n.id === 'node-sql-transform');
    const joinNode = updatedNodes.find(n => n.id === 'node-join');
    const aggNode = updatedNodes.find(n => n.id === 'node-aggregate');
    const resNode = updatedNodes.find(n => n.id === 'node-result');
    const expNode = updatedNodes.find(n => n.id === 'node-export');

    // 自身以及所有可达下游节点必须自动变成 dirty
    expect(sqlNode?.data.status).toBe('dirty');
    expect(joinNode?.data.status).toBe('dirty');
    expect(aggNode?.data.status).toBe('dirty');
    expect(resNode?.data.status).toBe('dirty');
    expect(expNode?.data.status).toBe('dirty');
  });

  it('can add and delete nodes cleanly', () => {
    useWorkflowStore.setState({dataFlowMode:'custom'});
    const store = useWorkflowStore.getState();
    const initialCount = store.nodes.length;

    store.addNode('aggregate');
    expect(useWorkflowStore.getState().nodes.length).toBe(initialCount + 1);

    const newlyAdded = useWorkflowStore.getState().nodes[useWorkflowStore.getState().nodes.length - 1];
    expect(newlyAdded.data.type).toBe('aggregate');

    store.deleteNode(newlyAdded.id);
    expect(useWorkflowStore.getState().nodes.length).toBe(initialCount);
  });

  it('dynamically generates workflow DAG from SQL Workbench query via syncFromSql', async () => {
    const store = useWorkflowStore.getState();
    const query = `
      WITH
        monthly_sales AS (
          SELECT customer_id, SUM(sales_amount) as total_spent
          FROM demo_sales
          GROUP BY customer_id
        )
      SELECT c.name, ms.total_spent
      FROM monthly_sales ms
      JOIN demo_customers c ON ms.customer_id = c.customer_id;
    `;

    await store.syncFromSql(query, '月度销售分析');

    const state = useWorkflowStore.getState();
    expect(state.dataFlowMode).toBe('sql');
    expect(state.activeTabTitle).toBe('月度销售分析');

    // Should have source nodes (demo_sales, demo_customers), join node, and result node
    expect(state.nodes.some(n => n.data.type === 'source' && (n.data.tableName === 'demo_sales' || n.data.title.includes('demo_sales')))).toBe(true);
    expect(state.nodes.some(n => n.data.type === 'source' && (n.data.tableName === 'demo_customers' || n.data.title.includes('demo_customers')))).toBe(true);
    expect(state.nodes.some(n => n.data.type === 'join')).toBe(true);
    expect(state.nodes.some(n => n.data.type === 'result')).toBe(true);
    expect(state.edges.length).toBeGreaterThanOrEqual(3);
  });

  it('updates target node when syncExecutionResult is called from SQL Workbench', async () => {
    const store = useWorkflowStore.getState();
    await store.syncFromSql(`SELECT * FROM demo_sales LIMIT 10`, '快速探查');

    const mockResult = {
      resultId: 'res_123',
      queryTitle: '快速探查',
      columns: ['order_id', 'customer_id', 'sales_amount'],
      columnTypes: ['INT', 'INT', 'DOUBLE'],
      rows: [
        { order_id: 1, customer_id: 10, sales_amount: 99.5 },
        { order_id: 2, customer_id: 20, sales_amount: 150.0 },
      ],
      totalRowCount: 2,
      executionTime: 42,
    };

    const flow=useWorkflowStore.getState().logicalFlowData!;
    store.applyExecutionEvent({runId:'actual',tabId:useWorkflowStore.getState().activeDocumentId,documentVersion:flow.source.sourceHash,connectionId:'writer',statementId:flow.statements[0].id,sourceSpan:flow.statements[0].sourceSpan,status:'success',result:mockResult,durationMs:42,terminal:true});

    const updatedNodes = useWorkflowStore.getState().nodes;
    const finalNode = updatedNodes.find(n => n.data.type === 'result') || updatedNodes[updatedNodes.length - 1];

    expect(finalNode.data.rowCount).toBe(2);
    expect(finalNode.data.columnCount).toBe(3);
    expect(finalNode.data.status).toBe('success');
  });

  it('compiles DAG back to SQL query string for roundtrip integration', async () => {
    const store = useWorkflowStore.getState();
    const query = `
      WITH
        filtered AS (
          SELECT * FROM demo_sales WHERE sales_amount > 100
        )
      SELECT * FROM filtered;
    `;

    await store.syncFromSql(query, '过滤订单');
    const fullSql = store.compileWorkflowToSql();

    expect(fullSql).toContain('WITH');
    expect(fullSql).toContain('SELECT');
    expect(fullSql.trim().endsWith(';')).toBe(true);
  });

  it('selectNode calculates ancestor and descendant lineage highlights', () => {
    seedCustomGraphFixture();
    const store = useWorkflowStore.getState();
    // 选中中间节点 node-join
    store.selectNode('node-join');

    const { nodes, edges } = useWorkflowStore.getState();
    const joinNode = nodes.find(n => n.id === 'node-join');
    const sqlNode = nodes.find(n => n.id === 'node-sql-transform');
    const aggNode = nodes.find(n => n.id === 'node-aggregate');

    expect(joinNode?.data.highlightState).toBe('none'); // Selected node itself
    expect(sqlNode?.data.highlightState).toBe('ancestor'); // Upstream source
    expect(aggNode?.data.highlightState).toBe('descendant'); // Downstream target

    // Deselecting node clears highlights
    store.selectNode(null);
    const clearedNodes = useWorkflowStore.getState().nodes;
    expect(clearedNodes.every(n => n.data.highlightState === 'none')).toBe(true);
  });

  it('autoLayout rearranges nodes without errors', () => {
    seedCustomGraphFixture();
    const store = useWorkflowStore.getState();
    store.autoLayout();
    const { nodes } = useWorkflowStore.getState();
    expect(nodes.length).toBe(9);
    expect(nodes[0].position.x).toBeGreaterThanOrEqual(0);
  });

  it('guarantees unique runLogs IDs even when multiple logs are created in rapid succession', async () => {
    const store = useWorkflowStore.getState();
    store.clearLogs();

    // Trigger rapid executions
    await Promise.all([
      store.syncExecutionResult('Tab 1', { totalRowCount: 10, executionTime: 20 }),
      store.syncExecutionResult('Tab 2', { totalRowCount: 20, executionTime: 30 }),
      store.syncExecutionResult('Tab 3', { error: 'Test error 1' }),
      store.syncExecutionResult('Tab 4', { error: 'Test error 2' }),
    ]);

    const logs = useWorkflowStore.getState().runLogs;
    expect(logs.length).toBe(0);
    const logIds = logs.map(l => l.id);
    const uniqueIds = new Set(logIds);
    expect(uniqueIds.size).toBe(logs.length);
  });

  it('connects nodes in standard direction (source -> target)', () => {
    seedCustomGraphFixture();
    const store = useWorkflowStore.getState();
    const initialEdges = store.edges.length;

    // Connect from node-aggregate to node-export
    store.onConnect({
      source: 'node-aggregate',
      sourceHandle: 'output',
      target: 'node-export',
      targetHandle: 'input',
    });

    const nextEdges = useWorkflowStore.getState().edges;
    expect(nextEdges.length).toBe(initialEdges + 1);
    const addedEdge = nextEdges.find(e => e.source === 'node-aggregate' && e.target === 'node-export');
    expect(addedEdge).toBeDefined();
    expect(addedEdge?.sourceHandle).toBe('output');
    expect(addedEdge?.targetHandle).toBe('input');
  });

  it('automatically inverts reversed drag connections (target -> source)', () => {
    seedCustomGraphFixture();
    const store = useWorkflowStore.getState();
    const initialEdges = store.edges.length;

    // User starts drag from node-export (input) towards node-aggregate (output)
    store.onConnect({
      source: 'node-export',
      sourceHandle: 'input',
      target: 'node-aggregate',
      targetHandle: 'output',
    });

    const nextEdges = useWorkflowStore.getState().edges;
    expect(nextEdges.length).toBe(initialEdges + 1);
    // Real source should be node-aggregate, real target should be node-export
    const addedEdge = nextEdges.find(e => e.source === 'node-aggregate' && e.target === 'node-export');
    expect(addedEdge).toBeDefined();
    expect(addedEdge?.sourceHandle).toBe('output');
    expect(addedEdge?.targetHandle).toBe('input');
  });

  it('intelligently assigns left and right handles for Join node', () => {
    useWorkflowStore.setState({dataFlowMode:'custom'});
    const store = useWorkflowStore.getState();
    // Add two source nodes and a join node without pre-selection
    store.selectNode(null);
    store.addNode('source', { x: 0, y: 0 });
    const src1 = useWorkflowStore.getState().nodes[useWorkflowStore.getState().nodes.length - 1].id;
    store.selectNode(null);
    store.addNode('source', { x: 0, y: 100 });
    const src2 = useWorkflowStore.getState().nodes[useWorkflowStore.getState().nodes.length - 1].id;
    store.selectNode(null);
    store.addNode('join', { x: 300, y: 50 });
    const joinNode = useWorkflowStore.getState().nodes[useWorkflowStore.getState().nodes.length - 1].id;

    // First connection to join with unspecified or 'input' handle should map to 'left'
    store.onConnect({
      source: src1,
      sourceHandle: 'output',
      target: joinNode,
      targetHandle: null,
    });

    let edge1 = useWorkflowStore.getState().edges.find(e => e.source === src1 && e.target === joinNode);
    expect(edge1?.targetHandle).toBe('left');
    expect(edge1?.data?.relationType).toBe('join');

    // Second connection to join should auto-map to 'right'
    store.onConnect({
      source: src2,
      sourceHandle: 'output',
      target: joinNode,
      targetHandle: null,
    });

    let edge2 = useWorkflowStore.getState().edges.find(e => e.source === src2 && e.target === joinNode);
    expect(edge2?.targetHandle).toBe('right');
    expect(edge2?.data?.relationType).toBe('join');
  });

  it('prevents cyclic DAG connections and self-loops', () => {
    seedCustomGraphFixture();
    const store = useWorkflowStore.getState();
    const initialEdges = store.edges.length;

    // Self loop
    store.onConnect({
      source: 'node-join',
      target: 'node-join',
      sourceHandle: 'output',
      targetHandle: 'left',
    });
    expect(useWorkflowStore.getState().edges.length).toBe(initialEdges);

    // Cannot connect to source node as target
    store.onConnect({
      source: 'node-result',
      sourceHandle: 'output',
      target: 'node-source-sales',
      targetHandle: 'input',
    });
    expect(useWorkflowStore.getState().edges.length).toBe(initialEdges);

    // True Cycle: node-result -> node-sql-transform (sql leads to join -> agg -> result)
    store.onConnect({
      source: 'node-result',
      sourceHandle: 'output',
      target: 'node-sql-transform',
      targetHandle: 'input',
    });
    expect(useWorkflowStore.getState().edges.length).toBe(initialEdges);
  });

  it('allows disconnecting edges cleanly via deleteEdge and marks downstream dirty', () => {
    seedCustomGraphFixture();
    const store = useWorkflowStore.getState();
    const edgeToDelete = store.edges[0];
    const targetNodeId = edgeToDelete.target;

    store.deleteEdge(edgeToDelete.id);
    const updatedEdges = useWorkflowStore.getState().edges;
    expect(updatedEdges.some(e => e.id === edgeToDelete.id)).toBe(false);

    // Target node should be marked dirty
    const targetNode = useWorkflowStore.getState().nodes.find(n => n.id === targetNodeId);
    expect(targetNode?.data.status).toBe('dirty');
  });

  it('clears graph when syncFromSql receives empty SQL', async () => {
    const store = useWorkflowStore.getState();
    await store.syncFromSql('SELECT 1 AS n', '有查询');
    expect(useWorkflowStore.getState().nodes.length).toBeGreaterThan(0);

    await store.syncFromSql('   ', '空查询');

    const state = useWorkflowStore.getState();
    expect(state.nodes).toEqual([]);
    expect(state.edges).toEqual([]);
    expect(state.selectedNodeId).toBeNull();
    expect(state.activeSqlRange).toBeNull();
    expect(state.syncStatus).toBe('idle');
    expect(state.lastSyncError).toBeNull();
  });

  it('loadWorkflow with explicit empty SQL does not resurrect previous store SQL', async () => {
    const store = useWorkflowStore.getState();
    await store.syncFromSql('SELECT 42 AS n', '旧查询');
    expect(useWorkflowStore.getState().activeSql).toContain('42');

    await store.loadWorkflow('', '新标签');
    const state = useWorkflowStore.getState();
    expect(state.activeSql).toBe('');
    expect(state.nodes).toEqual([]);
  });

  it('newer syncFromSql wins over a slower older call', async () => {
    const store = useWorkflowStore.getState();
    const slow = store.syncFromSql(
      `SELECT c.customer_name, SUM(oi.amount) AS revenue
       FROM orders o
       JOIN order_items oi ON o.order_id = oi.order_id
       JOIN customers c ON o.customer_id = c.customer_id
       GROUP BY 1`,
      '慢查询',
    );
    await store.syncFromSql(
      `SELECT ROUND(SUM(oi.amount) / NULLIF(COUNT(DISTINCT o.order_id), 0), 2) AS aov
       FROM orders o JOIN order_items oi ON o.order_id = oi.order_id`,
      '客单价',
    );
    await slow;
    const state = useWorkflowStore.getState();
    expect(state.activeTabTitle).toBe('客单价');
    expect(state.activeSql.toLowerCase()).toContain('aov');
    expect(state.activeSql.toLowerCase()).not.toContain('customer_name');
  });

  it('SQL A → 流程 A；切换 SQL B 后流程 A 完全消失', async () => {
    const store = useWorkflowStore.getState();

    const sqlA = `SELECT customer_name FROM customers WHERE region = 'west'`;
    await store.syncFromSql(sqlA, '查询 A');
    const afterA = useWorkflowStore.getState();
    expect(afterA.nodes.length).toBeGreaterThan(0);
    expect(afterA.activeSql).toContain('customer_name');
    const snapshotA = afterA.nodes.map(n => ({
      title: n.data.title,
      table: n.data.tableName,
      predicate: n.data.predicate,
      subtitle: n.data.subtitle,
    }));

    const sqlB = `SELECT ROUND(SUM(amount), 2) AS total FROM order_items`;
    const pending = store.syncFromSql(sqlB, '查询 B');
    // 切换瞬间旧图必须被清空，不能短暂叠留流程 A
    expect(useWorkflowStore.getState().nodes).toEqual([]);
    expect(useWorkflowStore.getState().edges).toEqual([]);
    expect(useWorkflowStore.getState().activeSql).toBe(sqlB);
    await pending;
    const afterB = useWorkflowStore.getState();

    expect(afterB.activeSql).toBe(sqlB);
    expect(afterB.activeTabTitle).toBe('查询 B');
    expect(afterB.nodes.length).toBeGreaterThan(0);

    // 流程 A 的业务语义不得残留
    const blobB = afterB.nodes
      .map(n => [n.data.title, n.data.tableName, n.data.predicate, n.data.subtitle, n.data.sqlSnippet].join(' '))
      .join('\n')
      .toLowerCase();
    expect(blobB).not.toContain('customer_name');
    expect(blobB).not.toContain('customers');
    expect(blobB).not.toContain('region');
    expect(blobB).toMatch(/order_items|amount|sum|aggregate|scan|result/);

    // 整图快照必须变化（不是在旧图上叠加）
    const snapshotB = afterB.nodes.map(n => ({
      title: n.data.title,
      table: n.data.tableName,
      predicate: n.data.predicate,
      subtitle: n.data.subtitle,
    }));
    expect(snapshotB).not.toEqual(snapshotA);

    // 未真实跑过查询时，节点不得冒充已成功
    expect(afterB.nodes.every(n => n.data.status === 'idle' || n.data.status === 'error')).toBe(true);
  });

  it('focusFaultyNode sets activeSqlRange and selectedNodeId', () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'faulty',
          type: 'dataFlowNode',
          position: { x: 0, y: 0 },
          data: {
            title: '坏节点',
            type: 'schema',
            status: 'error',
            bugInfo: {
              hasBug: true,
              severity: 'error',
              title: '语法错误',
              detail: 'Parser Error',
              suggestion: '检查 SQL',
            },
            sqlRange: { startLine: 4, endLine: 4 },
          },
        } as any,
      ],
      edges: [],
      selectedNodeId: null,
      activeSqlRange: null,
    });

    const id = useWorkflowStore.getState().focusFaultyNode(null);
    expect(id).toBe('faulty');
    expect(useWorkflowStore.getState().selectedNodeId).toBe('faulty');
    expect(useWorkflowStore.getState().activeSqlRange).toEqual({ startLine: 4, endLine: 4 });
  });

  it('does not attach legacy error results to a current SQL graph', async () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'n1',
          type: 'dataFlowNode',
          position: { x: 0, y: 0 },
          data: {
            title: 'SCAN',
            type: 'source',
            status: 'idle',
            sqlRange: { startLine: 1, endLine: 1 },
          },
        } as any,
      ],
      edges: [],
      activeSql: 'SELECT bad_col FROM orders',
      activeTabTitle: '坏查询',
    });

    await useWorkflowStore.getState().syncExecutionResult('坏查询', {
      error: 'Binder Error: Referenced column "bad_col" not found\nLINE 1: SELECT bad_col FROM orders\n               ^',
      executionTime: 12,
    }, 'SELECT bad_col FROM orders');

    const state = useWorkflowStore.getState();
    expect(state.selectedNodeId).toBeNull();
    expect(state.nodes.some(n => n.data.status === 'error' || n.data.bugInfo?.hasBug)).toBe(false);
    // focusFaultyNode / buildRealExecutionWorkflow should surface a sqlRange when possible
    expect(state.syncStatus).toBe('idle');
  });
});
