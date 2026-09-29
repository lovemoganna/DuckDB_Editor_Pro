import { describe, it, expect } from 'vitest';
import {
  parseDuckDbExplainPlan,
  buildRealExecutionWorkflow,
  traceUpstreamLineage,
  classifyOperator,
} from './sqlExecutionPlanParser';

describe('sqlExecutionPlanParser', () => {
  describe('classifyOperator', () => {
    it('classifies various DuckDB scan operators', () => {
      expect(classifyOperator('SEQ_SCAN')).toBe('scan');
      expect(classifyOperator('COLUMN_DATA_SCAN')).toBe('scan');
      expect(classifyOperator('PARQUET_SCAN')).toBe('scan');
    });

    it('classifies join, aggregate, sort, filter, result', () => {
      expect(classifyOperator('HASH_JOIN')).toBe('join');
      expect(classifyOperator('HASH_GROUP_BY')).toBe('aggregate');
      expect(classifyOperator('FILTER')).toBe('filter');
      expect(classifyOperator('ORDER_BY')).toBe('sort');
      expect(classifyOperator('RESULT_COLLECTOR')).toBe('result');
    });
  });

  describe('parseDuckDbExplainPlan', () => {
    it('parses realistic DuckDB EXPLAIN box output with EC, Cost, and timing', () => {
      const boxExplain = `
┌─────────────────────────────────────┐
│             HASH_JOIN               │
│         EC: 100 (100.00%)           │
│           Cost: 5820.46             │
│        Actual time: 0.85ms          │
│       Estimated Cardinalities: 1200 │
└─────────────────────────────────────┘
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│        Condition: o_custkey = c_id  │
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
    ┌─────────────────────────────────┐
    │          SEQ_SCAN on orders     │
    │         EC: 50000 (40.00%)      │
    │        Actual time: 0.35ms      │
    │        Filters: o_total > 100   │
    └─────────────────────────────────┘
    ┌─────────────────────────────────┐
    │        SEQ_SCAN on customers    │
    │         EC: 2000 (10.00%)       │
    │        Actual time: 0.15ms      │
    └─────────────────────────────────┘
`;

      const parsed = parseDuckDbExplainPlan(boxExplain);
      expect(parsed.length).toBe(1);
      const root = parsed[0];
      expect(root.category).toBe('join');
      expect(root.actualTimeMs).toBe(0.85);
      expect(root.costPercent).toBeGreaterThan(0);
      expect(root.children.length).toBe(2);

      const leftChild = root.children[0];
      expect(leftChild.category).toBe('scan');
      expect(leftChild.tableName).toBe('orders');
      expect(leftChild.filterConditions).toContain('o_total > 100');

      const rightChild = root.children[1];
      expect(rightChild.category).toBe('scan');
      expect(rightChild.tableName).toBe('customers');
    });
  });

  describe('buildRealExecutionWorkflow', () => {
    it('generates forward data flow DAG where Scans flow into Join and Result', () => {
      const explain = `
┌─────────────────────────────────────┐
│             HASH_JOIN               │
│         EC: 100 (100.00%)           │
│        Actual time: 1.2ms           │
└─────────────────────────────────────┘
    ┌─────────────────────────────────┐
    │          SEQ_SCAN on orders     │
    │        Actual time: 0.4ms       │
    └─────────────────────────────────┘
    ┌─────────────────────────────────┐
    │        SEQ_SCAN on customers    │
    │        Actual time: 0.2ms       │
    └─────────────────────────────────┘
`;
      const sql = 'SELECT * FROM orders JOIN customers ON orders.c_id = customers.id';
      const result = buildRealExecutionWorkflow({ sql, planText: explain });

      expect(result.nodes.length).toBeGreaterThanOrEqual(3);
      expect(result.edges.length).toBeGreaterThanOrEqual(2);

      // Verify node types
      const scans = result.nodes.filter(n => n.data.type === 'source');
      expect(scans.length).toBe(2);
      expect(scans.some(s => s.data.tableName === 'orders')).toBe(true);
      expect(scans.some(s => s.data.tableName === 'customers')).toBe(true);

      const joinNode = result.nodes.find(n => n.data.type === 'join');
      expect(joinNode).toBeDefined();

      // Verify forward edges: Scan -> Join
      const edgesToJoin = result.edges.filter(e => e.target === joinNode?.id);
      expect(edgesToJoin.length).toBe(2);
      expect(edgesToJoin.map(e => e.source).sort()).toEqual(scans.map(s => s.id).sort());

      // Handles must follow standard output -> input|left|right
      for (const edge of result.edges) {
        expect(edge.sourceHandle).toBe('output');
        expect(['input', 'left', 'right']).toContain(edge.targetHandle);
      }
    });

    it('identifies and highlights Catalog Error node when table does not exist', () => {
      const sql = 'SELECT * FROM non_existent_orders WHERE status = 1';
      const errorMsg = 'Catalog Error: Table with name "non_existent_orders" does not exist!';

      const result = buildRealExecutionWorkflow({
        sql,
        executionError: errorMsg,
      });

      expect(result.faultyNodeId).toBeTruthy();
      const faultyNode = result.nodes.find(n => n.id === result.faultyNodeId);
      expect(faultyNode).toBeDefined();
      expect(faultyNode?.data.status).toBe('error');
      expect(faultyNode?.data.hasAnomaly).toBe(true);
      expect(faultyNode?.data.bugInfo?.hasBug).toBe(true);
      expect(faultyNode?.data.bugInfo?.title).toContain('Catalog Error');
    });

    it('identifies and highlights Binder Error node when column does not exist', () => {
      const sql = 'SELECT * FROM orders WHERE non_existent_col > 100';
      const errorMsg = 'Binder Error: Referenced column "non_existent_col" not found in FROM clause!';

      const result = buildRealExecutionWorkflow({
        sql,
        executionError: errorMsg,
      });

      expect(result.faultyNodeId).toBeTruthy();
      const faultyNode = result.nodes.find(n => n.id === result.faultyNodeId);
      expect(faultyNode).toBeDefined();
      expect(faultyNode?.data.status).toBe('error');
      expect(faultyNode?.data.bugInfo?.title).toContain('Binder Error');
      expect(faultyNode?.data.bugInfo?.detail).toContain('non_existent_col');
    });
  });

  describe('traceUpstreamLineage', () => {
    it('builds full SCAN -> FILTER -> JOIN -> AGGREGATE -> SORT -> RESULT pipeline', () => {
      const explain = `
┌─────────────────────────────────────┐
│          ORDER_BY                   │
│        Actual time: 0.1ms           │
└─────────────────────────────────────┘
    ┌─────────────────────────────────┐
    │          HASH_GROUP_BY          │
    │        Actual time: 0.5ms       │
    │        Groups: c_name           │
    └─────────────────────────────────┘
        ┌─────────────────────────────┐
        │          HASH_JOIN          │
        │        Actual time: 0.8ms   │
        └─────────────────────────────┘
            ┌─────────────────────────┐
            │          FILTER         │
            │        Actual time: 0.2ms│
            │      Filters: amt > 100 │
            └─────────────────────────┘
                ┌─────────────────────┐
                │   SEQ_SCAN on orders│
                │        Rows: 50000  │
                └─────────────────────┘
            ┌─────────────────────────┐
            │ SEQ_SCAN on customers   │
            │        Rows: 2000       │
            └─────────────────────────┘
`;
      const sql = `
        SELECT c_name, SUM(amt)
        FROM orders
        JOIN customers ON orders.c_id = customers.id
        WHERE amt > 100
        GROUP BY c_name
        ORDER BY SUM(amt) DESC
      `;
      const result = buildRealExecutionWorkflow({ sql, planText: explain });

      // Check that all 6 categories are present
      const categories = result.nodes.map(n => n.data.type);
      expect(categories).toContain('source'); // scans
      expect(categories).toContain('schema'); // filter
      expect(categories).toContain('join');   // join
      expect(categories).toContain('aggregate'); // group by
      expect(categories).toContain('sql_transform'); // sort / order by
      expect(categories).toContain('result'); // result

      // Verify node context fields
      const filterNode = result.nodes.find(n => n.data.type === 'schema');
      expect(filterNode?.data.predicate).toContain('amt > 100');

      const aggNode = result.nodes.find(n => n.data.type === 'aggregate');
      expect(aggNode?.data.groupBySummary).toContain('c_name');

      const joinNode = result.nodes.find(n => n.data.type === 'join');
      expect(joinNode?.data.executionTimeSec).toBeCloseTo(0.0008, 4);

      // Verify bottleneck detection
      const bottleneckNode = result.nodes.find(n => n.data.config?.isBottleneck);
      expect(bottleneckNode).toBeDefined();
    });

    it('identifies and highlights Conversion Error node', () => {
      const sql = 'SELECT CAST(status AS INTEGER) FROM orders';
      const errorMsg = 'Conversion Error: Could not convert string "ACTIVE" to INT32';

      const result = buildRealExecutionWorkflow({
        sql,
        executionError: errorMsg,
      });

      expect(result.faultyNodeId).toBeTruthy();
      const faultyNode = result.nodes.find(n => n.id === result.faultyNodeId);
      expect(faultyNode).toBeDefined();
      expect(faultyNode?.data.status).toBe('error');
      expect(faultyNode?.data.bugInfo?.title).toContain('Conversion Error');
    });

    it('traces lineage from final result back to all upstream scan nodes', () => {
      const sql = 'SELECT * FROM orders JOIN customers ON orders.c_id = customers.id';
      const explain = `
┌─────────────────────────────────────┐
│             HASH_JOIN               │
└─────────────────────────────────────┘
    ┌─────────────────────────────────┐
    │        SEQ_SCAN on customers    │
    └─────────────────────────────────┘
`;
      const result = buildRealExecutionWorkflow({ sql, planText: explain });
      expect(result.resultNodeId).toBeTruthy();

      const { ancestorNodeIds } = traceUpstreamLineage(
        result.nodes,
        result.edges,
        result.resultNodeId!
      );

      // Must include result node itself
      expect(ancestorNodeIds.has(result.resultNodeId!)).toBe(true);

      // Must include all scans
      for (const scanId of result.traceableSourceIds) {
        expect(ancestorNodeIds.has(scanId)).toBe(true);
      }
    });

    it('identifies and highlights Syntax Error node with line number and sqlRange', () => {
      const sql = 'SELECT * \nFROM orders \nWHERE status == 1';
      const errorMsg = 'Parser Error: syntax error at or near "==" (LINE 3, POS 15)';

      const result = buildRealExecutionWorkflow({
        sql,
        executionError: errorMsg,
      });

      expect(result.faultyNodeId).toBeTruthy();
      const faultyNode = result.nodes.find(n => n.id === result.faultyNodeId);
      expect(faultyNode).toBeDefined();
      expect(faultyNode?.data.status).toBe('error');
      expect(faultyNode?.data.bugInfo?.title).toContain('Syntax Error');
      expect(faultyNode?.data.sqlRange?.startLine).toBe(3);
    });

    it('correctly isolates physical_plan when mixed with logical_plan', () => {
      const combined = `
logical_plan
┌─────────────────────────────┐
│      LOGICAL_PROJECTION     │
└─────────────────────────────┘
physical_plan
┌─────────────────────────────┐
│          HASH_JOIN          │
│        Actual time: 1.2ms   │
└─────────────────────────────┘
    ┌─────────────────────────┐
    │     CHUNK_SCAN orders   │
    └─────────────────────────┘
    ┌─────────────────────────┐
    │    DELIM_SCAN customers │
    └─────────────────────────┘
`;
      const ops = parseDuckDbExplainPlan(combined);
      expect(ops.length).toBe(1);
      expect(ops[0].category).toBe('join');
      expect(ops[0].children.length).toBe(2);
      expect(ops[0].children[0].category).toBe('scan');
      expect(ops[0].children[1].category).toBe('scan');
    });

    it('identifies and highlights Group By Violation error node', () => {
      const sql = 'SELECT customer_id, count(*), order_date\nFROM orders\nGROUP BY customer_id';
      const errorMsg = 'Binder Error: column "order_date" must appear in the GROUP BY clause or be used in an aggregate function';

      const result = buildRealExecutionWorkflow({
        sql,
        executionError: errorMsg,
      });

      expect(result.faultyNodeId).toBeTruthy();
      const faultyNode = result.nodes.find(n => n.id === result.faultyNodeId);
      expect(faultyNode).toBeDefined();
      expect(faultyNode?.data.status).toBe('error');
      expect(faultyNode?.data.bugInfo?.title).toContain('Group By Violation');
      expect(faultyNode?.data.bugInfo?.detail).toContain('order_date');
      expect(faultyNode?.data.bugInfo?.suggestion).toContain('ANY_VALUE');
    });

    it('identifies and highlights Division by Zero error node', () => {
      const sql = 'SELECT total_amount / item_count FROM orders';
      const errorMsg = 'Conversion Error: Division by zero';

      const result = buildRealExecutionWorkflow({
        sql,
        executionError: errorMsg,
      });

      expect(result.faultyNodeId).toBeTruthy();
      const faultyNode = result.nodes.find(n => n.id === result.faultyNodeId);
      expect(faultyNode).toBeDefined();
      expect(faultyNode?.data.status).toBe('error');
      expect(faultyNode?.data.bugInfo?.title).toContain('Division By Zero');
      expect(faultyNode?.data.bugInfo?.suggestion).toContain('NULLIF');
    });

    it('synthesizes multi-table joins as binary cascaded nodes with window operator', () => {
      const sql = 'SELECT o.id, c.name, l.price, ROW_NUMBER() OVER (PARTITION BY o.id ORDER BY l.price DESC) FROM orders o JOIN customers c ON o.c_id = c.id JOIN lineitem l ON o.id = l.o_id';
      const result = buildRealExecutionWorkflow({ sql });

      const joins = result.nodes.filter(n => n.data.type === 'join');
      expect(joins.length).toBeGreaterThanOrEqual(1);

      const windowNode = result.nodes.find(n => n.data.title.includes('WINDOW') || n.data.config?.operatorName?.includes('WINDOW'));
      expect(windowNode).toBeDefined();
    });

    it('prunes all intermediate PROJECTION nodes and merges LIMIT with ORDER_BY into SORT & LIMIT', () => {
      // Realistic DuckDB plan containing 3 intermediate PROJECTIONS, STREAMING_LIMIT + ORDER_BY, and RESULT_COLLECTOR
      const noisyExplain = `
┌─────────────────────────────────────┐
│          RESULT_COLLECTOR           │
│         EC: 10 (100.00%)            │
│        Actual time: 0.05ms          │
└─────────────────────────────────────┘
    ┌─────────────────────────────────┐
    │           PROJECTION            │
    │         EC: 10 (100.00%)        │
    │        Actual time: 0.02ms      │
    │       Projections: c_id, sum    │
    └─────────────────────────────────┘
        ┌─────────────────────────────┐
        │       STREAMING_LIMIT       │
        │         EC: 10 (100.00%)    │
        │        Actual time: 0.04ms  │
        └─────────────────────────────┘
            ┌─────────────────────────┐
            │          TOP_N          │
            │         EC: 100 (50.00%)│
            │        Actual time: 0.15ms│
            └─────────────────────────┘
                ┌─────────────────────┐
                │     PROJECTION      │
                │        Actual time: 0.01ms│
                └─────────────────────┘
                    ┌─────────────────┐
                    │  HASH_GROUP_BY  │
                    │   Actual time: 0.8ms│
                    │   Groups: c_id  │
                    └─────────────────┘
                        ┌─────────────┐
                        │ PROJECTION  │
                        └─────────────┘
                            ┌─────────┐
                            │ SEQ_SCAN on orders │
                            │ Actual time: 0.3ms │
                            │ Filters: amt > 0   │
                            └─────────┘
`;
      const sql = 'SELECT c_id, sum(amt) FROM orders WHERE amt > 0 GROUP BY c_id ORDER BY sum(amt) DESC LIMIT 10';
      const result = buildRealExecutionWorkflow({ sql, planText: noisyExplain });

      // There must NOT be any redundant PROJECTION / SCALAR EXPRESSION nodes rendered!
      const projectionNodes = result.nodes.filter(n => n.data.type === 'sql_transform' && n.data.title.includes('计算表达式'));
      expect(projectionNodes.length).toBe(0);

      // Exactly 1 Scan, 1 Group By, 1 Sort & Limit, 1 Result
      const types = result.nodes.map(n => n.data.type);
      expect(types).toContain('source');
      expect(types).toContain('aggregate');
      expect(types).toContain('sql_transform'); // SORT & LIMIT
      expect(types).toContain('result');

      // Total nodes must be exactly 4 (Scan -> Aggregate -> Sort & Limit -> Result)
      expect(result.nodes.length).toBe(4);

      // Verify SORT & LIMIT combined node
      const sortLimitNode = result.nodes.find(n => n.data.title.includes('SORT & LIMIT'));
      expect(sortLimitNode).toBeDefined();

      // Verify that there is ONLY ONE result node, and no duplicate df_final_result
      const resultNodes = result.nodes.filter(n => n.data.type === 'result');
      expect(resultNodes.length).toBe(1);

      // Verify the edges form a clean linear forward chain:
      // Scan -> Aggregate -> Sort & Limit -> Result
      expect(result.edges.length).toBe(3);
    });

    it('correctly prunes noisy optimizer artifacts (EMPTY_RESULT and nameless DELIM_SCAN)', () => {
      const noisyExplain = `
┌─────────────────────────────────────┐
│          RESULT_COLLECTOR           │
└─────────────────────────────────────┘
    ┌─────────────────────────────────┐
    │           EMPTY_RESULT          │
    └─────────────────────────────────┘
        ┌─────────────────────────────┐
        │            FILTER           │
        │          Filters: 1 = 0     │
        └─────────────────────────────┘
            ┌─────────────────────────┐
            │        DELIM_SCAN       │
            └─────────────────────────┘
                ┌─────────────────────┐
                │   SEQ_SCAN on orders│
                └─────────────────────┘
`;
      const sql = 'SELECT * FROM orders WHERE 1 = 0';
      const result = buildRealExecutionWorkflow({ sql, planText: noisyExplain });

      // DELIM_SCAN without table and EMPTY_RESULT must be stripped
      expect(result.nodes.some(n => n.data.title.includes('EMPTY_RESULT'))).toBe(false);
      expect(result.nodes.some(n => n.data.title.includes('DELIM_SCAN'))).toBe(false);

      // SCAN and FILTER and RESULT remain
      expect(result.nodes.some(n => n.data.type === 'source')).toBe(true);
      expect(result.nodes.some(n => n.data.type === 'schema')).toBe(true);
      expect(result.nodes.some(n => n.data.type === 'result')).toBe(true);
    });
  });
});

