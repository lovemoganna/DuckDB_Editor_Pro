import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkflowStore } from './workflowStore';

describe('Workflow Store & State Machine Tests', () => {
  beforeEach(async () => {
    await useWorkflowStore.getState().resetToDefaultDemo();
  });

  it('provides ecommerce demo workflow when resetToDefaultDemo is invoked', () => {
    const { nodes, edges, selectedNodeId } = useWorkflowStore.getState();
    expect(nodes.length).toBe(9);
    expect(edges.length).toBe(8);
    expect(selectedNodeId).toBe('node-aggregate');

    const aggNode = nodes.find(n => n.id === 'node-aggregate');
    expect(aggNode).toBeDefined();
    expect(aggNode?.data.title).toBe('聚合统计');
    expect(aggNode?.data.rowCount).toBe(6);
    expect(aggNode?.data.columnCount).toBe(5);
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
    expect(nodes.some(n => n.id === 'node_cte_kpi')).toBe(true);
    expect(nodes.some(n => n.id === 'node_final_result')).toBe(true);
    expect(edges.length).toBeGreaterThanOrEqual(1);
  });

  it('propagates dirty state to downstream nodes when config changes', () => {
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

    // Should have source nodes (demo_sales, demo_customers), CTE node (monthly_sales), and result node
    expect(state.nodes.some(n => n.data.type === 'source' && n.data.title === 'demo_sales')).toBe(true);
    expect(state.nodes.some(n => n.data.type === 'source' && n.data.title === 'demo_customers')).toBe(true);
    expect(state.nodes.some(n => n.id === 'node_cte_monthly_sales')).toBe(true);
    expect(state.nodes.some(n => n.id === 'node_final_result')).toBe(true);
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

    store.syncExecutionResult('快速探查', mockResult);

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
    expect(logs.length).toBe(4);
    const logIds = logs.map(l => l.id);
    const uniqueIds = new Set(logIds);
    expect(uniqueIds.size).toBe(logs.length);
  });

  it('connects nodes in standard direction (source -> target)', () => {
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
});

