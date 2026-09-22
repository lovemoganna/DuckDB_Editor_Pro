import { describe, it, expect } from 'vitest';
import {
  extractCteDefinitions,
  extractTableReferences,
  splitSqlStatements,
  parseSqlToWorkflow,
  parseCatalogToWorkflow,
  compileWorkflowToFullSql,
  calculateDagLayout,
  updateSqlCteDefinition,
} from './sqlToWorkflowParser';

describe('sqlToWorkflowParser - SQL to DAG Engine Tests', () => {
  it('correctly extracts balanced CTEs and main query', () => {
    const sql = `
      WITH
        cte_filtered AS (
          SELECT id, name, amount FROM raw_orders WHERE amount > (SELECT AVG(amount) FROM raw_orders)
        ),
        cte_summary AS (
          SELECT name, SUM(amount) AS total FROM cte_filtered GROUP BY name
        )
      SELECT name, total FROM cte_summary WHERE total > 500;
    `;

    const { ctes, mainQuery } = extractCteDefinitions(sql);
    expect(ctes.length).toBe(2);
    expect(ctes[0].name).toBe('cte_filtered');
    expect(ctes[0].query).toContain('WHERE amount > (SELECT AVG(amount) FROM raw_orders)');
    expect(ctes[1].name).toBe('cte_summary');
    expect(ctes[1].query).toContain('GROUP BY name');
    expect(mainQuery).toContain('SELECT name, total FROM cte_summary WHERE total > 500');
  });

  it('correctly splits multi-statement SQL handling comments and string literals', () => {
    const sql = `
      -- Create staging table
      CREATE TABLE staging AS SELECT 'hello; world' AS greeting;
      /* Block comment with ; inside */
      CREATE VIEW v_active AS SELECT * FROM staging WHERE greeting != ';';
      SELECT * FROM v_active;
    `;

    const stmts = splitSqlStatements(sql);
    expect(stmts.length).toBe(3);
    expect(stmts[0]).toContain("CREATE TABLE staging AS SELECT 'hello; world' AS greeting");
    expect(stmts[1]).toContain('CREATE VIEW v_active AS SELECT * FROM staging');
    expect(stmts[2]).toBe('SELECT * FROM v_active');
  });

  it('extracts table references and DuckDB table functions', () => {
    const sql1 = `
      SELECT o.id, c.name 
      FROM demo_orders o 
      JOIN demo_customers c ON o.customer_id = c.id
      WHERE o.status = 'active'
    `;
    const tables1 = extractTableReferences(sql1);
    expect(tables1).toContain('demo_orders');
    expect(tables1).toContain('demo_customers');

    const sql2 = `SELECT * FROM read_parquet('data/sales_2024.parquet')`;
    const tables2 = extractTableReferences(sql2);
    expect(tables2).toContain('data/sales_2024.parquet');
  });

  it('parses CTE query into full DAG with physical sources, transform nodes, and edges', () => {
    const sql = `
      WITH
        clean_sales AS (
          SELECT order_id, customer_id, sales_amount 
          FROM demo_sales 
          WHERE status = 'completed'
        ),
        customer_agg AS (
          SELECT customer_id, SUM(sales_amount) as total_spent, COUNT(order_id) as order_cnt
          FROM clean_sales
          GROUP BY customer_id
        )
      SELECT c.name, a.total_spent, a.order_cnt
      FROM customer_agg a
      JOIN demo_customers c ON a.customer_id = c.customer_id;
    `;

    const { nodes, edges } = parseSqlToWorkflow(sql, { tabTitle: '客户销售报表' });

    // Sources: demo_sales, demo_customers
    const sourceSales = nodes.find(n => n.data.type === 'source' && n.data.title === 'demo_sales');
    const sourceCustomers = nodes.find(n => n.data.type === 'source' && n.data.title === 'demo_customers');
    expect(sourceSales).toBeDefined();
    expect(sourceCustomers).toBeDefined();

    // CTE nodes
    const cleanSalesNode = nodes.find(n => n.id === 'node_cte_clean_sales');
    const customerAggNode = nodes.find(n => n.id === 'node_cte_customer_agg');
    expect(cleanSalesNode).toBeDefined();
    expect(customerAggNode).toBeDefined();
    expect(customerAggNode?.data.type).toBe('aggregate');

    // Final result node
    const resultNode = nodes.find(n => n.id === 'node_final_result');
    expect(resultNode).toBeDefined();
    expect(resultNode?.data.title).toBe('客户销售报表');

    // Edges
    // demo_sales -> clean_sales
    expect(edges.some(e => e.source === sourceSales?.id && e.target === cleanSalesNode?.id)).toBe(true);
    // clean_sales -> customer_agg
    expect(edges.some(e => e.source === cleanSalesNode?.id && e.target === customerAggNode?.id)).toBe(true);
    // customer_agg -> final_result & demo_customers -> final_result
    expect(edges.some(e => e.source === customerAggNode?.id && e.target === resultNode?.id)).toBe(true);
    expect(edges.some(e => e.source === sourceCustomers?.id && e.target === resultNode?.id)).toBe(true);
  });

  it('parses single SELECT query with JOIN & GROUP BY into multi-stage DAG', () => {
    const sql = `
      SELECT c.country, SUM(s.sales_amount) as total
      FROM demo_sales s
      JOIN demo_customers c ON s.customer_id = c.id
      GROUP BY c.country
    `;

    const { nodes, edges } = parseSqlToWorkflow(sql);

    expect(nodes.some(n => n.data.type === 'source')).toBe(true);
    expect(nodes.some(n => n.data.type === 'join')).toBe(true);
    expect(nodes.some(n => n.data.type === 'aggregate')).toBe(true);
    expect(nodes.some(n => n.data.type === 'result')).toBe(true);
    expect(edges.length).toBeGreaterThanOrEqual(3);
  });

  it('parses multi-statement CREATE VIEW / TABLE script', () => {
    const sql = `
      CREATE TABLE staging_data AS SELECT * FROM demo_sales WHERE amount > 0;
      CREATE VIEW v_sales_kpi AS SELECT country, count(*) as count FROM staging_data GROUP BY country;
      SELECT * FROM v_sales_kpi;
    `;

    const { nodes, edges } = parseSqlToWorkflow(sql);

    const stagingNode = nodes.find(n => n.data.title === 'staging_data');
    const kpiNode = nodes.find(n => n.data.title === 'v_sales_kpi');
    expect(stagingNode).toBeDefined();
    expect(kpiNode).toBeDefined();

    // Lineage edge staging_data -> v_sales_kpi
    expect(edges.some(e => e.source === stagingNode?.id && e.target === kpiNode?.id)).toBe(true);
  });

  it('parses DuckDB catalog tables and views into database lineage DAG', () => {
    const catalog = [
      { name: 'orders', isView: false },
      { name: 'customers', isView: false },
      { name: 'v_order_details', isView: true, sql: 'SELECT * FROM orders o JOIN customers c ON o.customer_id = c.id' },
      { name: 'v_daily_kpi', isView: true, sql: 'SELECT country, count(*) as cnt FROM v_order_details GROUP BY country' },
    ];

    const { nodes, edges } = parseCatalogToWorkflow(catalog);
    expect(nodes.length).toBe(4);

    const ordersNode = nodes.find(n => n.data.title === 'orders');
    const detailsNode = nodes.find(n => n.data.title === 'v_order_details');
    const kpiNode = nodes.find(n => n.data.title === 'v_daily_kpi');

    expect(ordersNode?.data.type).toBe('source');
    expect(detailsNode?.data.type).toBe('join');
    expect(kpiNode?.data.type).toBe('aggregate');

    // Edges: orders -> v_order_details -> v_daily_kpi
    expect(edges.some(e => e.source === ordersNode?.id && e.target === detailsNode?.id)).toBe(true);
    expect(edges.some(e => e.source === detailsNode?.id && e.target === kpiNode?.id)).toBe(true);
  });

  it('compiles DAG back to valid CTE SQL query for SQL workbench roundtrip', () => {
    const sql = `
      WITH
        filtered AS (
          SELECT * FROM demo_sales WHERE status = 'completed'
        ),
        aggregated AS (
          SELECT customer_id, SUM(sales_amount) as spent FROM filtered GROUP BY customer_id
        )
      SELECT * FROM aggregated;
    `;

    const { nodes, edges } = parseSqlToWorkflow(sql);
    const compiledSql = compileWorkflowToFullSql(nodes, edges);

    expect(compiledSql).toContain('WITH');
    expect(compiledSql).toContain('SELECT');
    expect(compiledSql.trim().endsWith(';')).toBe(true);
  });

  it('calculates hierarchical layout with no overlapping positions', () => {
    const nodes: any[] = [
      { id: 's1', type: 'dataFlowNode', position: { x: 0, y: 0 }, data: { title: 's1' } },
      { id: 's2', type: 'dataFlowNode', position: { x: 0, y: 0 }, data: { title: 's2' } },
      { id: 't1', type: 'dataFlowNode', position: { x: 0, y: 0 }, data: { title: 't1' } },
      { id: 'r1', type: 'dataFlowNode', position: { x: 0, y: 0 }, data: { title: 'r1' } },
    ];
    const edges: any[] = [
      { id: 'e1', source: 's1', target: 't1' },
      { id: 'e2', source: 's2', target: 't1' },
      { id: 'e3', source: 't1', target: 'r1' },
    ];

    const laidOut = calculateDagLayout(nodes, edges);
    const s1 = laidOut.find(n => n.id === 's1')!;
    const s2 = laidOut.find(n => n.id === 's2')!;
    const t1 = laidOut.find(n => n.id === 't1')!;
    const r1 = laidOut.find(n => n.id === 'r1')!;

    // Level 0: s1 and s2 (same x, different y)
    expect(s1.position.x).toBe(s2.position.x);
    expect(s1.position.y).not.toBe(s2.position.y);

    // Level 1: t1 (greater x than s1)
    expect(t1.position.x).toBeGreaterThan(s1.position.x);

    // Level 2: r1 (greater x than t1)
    expect(r1.position.x).toBeGreaterThan(t1.position.x);
  });

  it('correctly handles SQL comments and parentheses inside comments and strings within CTEs', () => {
    const complexSql = `
      -- 头部说明注释 (测试括号)
      /* 块注释 (测试括号 2) */
      WITH
        cleaned_cte AS (
          SELECT id, 'str with (paren) and ''escaped quote''' AS note
          FROM orders
          -- 行尾单行注释: filter by status (default 1)
          /* 块级内联注释: (another paren) */
          WHERE status > 0
        )
      SELECT * FROM cleaned_cte;
    `;

    const { ctes, mainQuery } = extractCteDefinitions(complexSql);
    expect(ctes.length).toBe(1);
    expect(ctes[0].name).toBe('cleaned_cte');
    expect(ctes[0].query).toContain("str with (paren) and ''escaped quote''");
    expect(ctes[0].query).toContain('WHERE status > 0');
    expect(mainQuery).toContain('SELECT * FROM cleaned_cte');

    const { nodes, edges } = parseSqlToWorkflow(complexSql);
    expect(nodes.some(n => n.id === 'node_cte_cleaned_cte')).toBe(true);
    expect(nodes.some(n => n.id === 'node_final_result')).toBe(true);
  });

  it('correctly extracts comma-separated table joins and array table functions', () => {
    const commaSql = `
      SELECT o.id, c.name, p.title
      FROM orders o, customers c, products p
      WHERE o.user_id = c.id AND o.item_id = p.id;
    `;
    const tables = extractTableReferences(commaSql);
    expect(tables).toContain('orders');
    expect(tables).toContain('customers');
    expect(tables).toContain('products');

    const arrayFuncSql = `SELECT * FROM read_parquet(['f1.parquet', 'f2.parquet'])`;
    const funcTables = extractTableReferences(arrayFuncSql);
    expect(funcTables).toContain('f1.parquet');
  });

  it('generates standalone calculation node for queries without tables (e.g. version(), math)', () => {
    const calcSql = `SELECT 'DuckDB WASM' AS status, 1 + 1 AS calc, current_date AS today;`;
    const { nodes, edges } = parseSqlToWorkflow(calcSql, { tabTitle: '系统自检' });
    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe('node_calc_result');
    expect(nodes[0].data.title).toBe('系统自检');
    expect(nodes[0].data.config.sql).toBe(calcSql);
    expect(edges.length).toBe(0);
  });

  describe('updateSqlCteDefinition - Bidirectional AST/CTE Rewrite Engine', () => {
    it('accurately updates target CTE query while preserving surrounding CTEs and comments', () => {
      const originalSql = `
        -- Step 1: Filter
        WITH
          raw_data AS (
            SELECT * FROM orders WHERE amount > 10
          ),
          -- Step 2: Summary
          summary AS (
            SELECT country, SUM(amount) AS total FROM raw_data GROUP BY country
          )
        SELECT * FROM summary;
      `;

      const newSummaryQuery = `SELECT country, SUM(amount) AS total, AVG(amount) AS avg_amt FROM raw_data WHERE amount > 20 GROUP BY country`;
      const updated = updateSqlCteDefinition(originalSql, 'summary', newSummaryQuery);

      expect(updated).toContain('-- Step 1: Filter');
      expect(updated).toContain('SELECT * FROM orders WHERE amount > 10');
      expect(updated).toContain('AVG(amount) AS avg_amt');
      expect(updated).toContain('WHERE amount > 20');
      expect(updated).toContain('SELECT * FROM summary;');
    });

    it('accurately updates main query after CTE definitions', () => {
      const originalSql = `
        WITH cte AS (SELECT 1 AS num)
        SELECT * FROM cte;
      `;
      const newMain = `SELECT num * 2 AS doubled FROM cte ORDER BY doubled DESC`;
      const updated = updateSqlCteDefinition(originalSql, 'main_query', newMain);

      expect(updated).toContain('WITH cte AS (SELECT 1 AS num)');
      expect(updated).toContain('SELECT num * 2 AS doubled FROM cte ORDER BY doubled DESC;');
    });

    it('replaces single non-CTE query directly', () => {
      const originalSql = `SELECT a, b FROM table1 WHERE a = 1;`;
      const newQuery = `SELECT a, b, c FROM table1 WHERE a = 2`;
      const updated = updateSqlCteDefinition(originalSql, 'main_query', newQuery);
      expect(updated).toBe('SELECT a, b, c FROM table1 WHERE a = 2;');
    });
  });

  describe('compileWorkflowToFullSql - JOIN handle ordering check', () => {
    it('correctly maps left and right tables based on targetHandle even when edges array is reversed', () => {
      const nodes: any[] = [
        { id: 'n1', data: { type: 'source', title: 'orders', config: { tableName: 'orders' } } },
        { id: 'n2', data: { type: 'source', title: 'customers', config: { tableName: 'customers' } } },
        {
          id: 'n_join',
          data: {
            type: 'join',
            title: 'join_step',
            config: {
              joinType: 'INNER',
              conditions: [{ id: 'c1', leftColumn: 'customer_id', rightColumn: 'id' }],
            },
          },
        },
      ];

      // Edge for right table is added first, edge for left table is added second
      const edges: any[] = [
        { id: 'e2', source: 'n2', target: 'n_join', targetHandle: 'right' },
        { id: 'e1', source: 'n1', target: 'n_join', targetHandle: 'left' },
      ];

      const fullSql = compileWorkflowToFullSql(nodes, edges);
      // Left table must be orders, right table must be customers
      expect(fullSql).toMatch(/orders\s+l[\s\S]*customers\s+r/);
      expect(fullSql).toContain('l."customer_id" = r."id"');
    });
  });
});
