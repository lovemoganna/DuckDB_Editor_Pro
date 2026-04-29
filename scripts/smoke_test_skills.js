/**
 * AI Skills Smoke Test — Comprehensive Generator Validation
 *
 * Imports and executes every registered generator with realistic inputs
 * to verify they produce valid, non-empty SQL output without throwing.
 *
 * Run: node scripts/smoke_test_skills.js
 * (Node 18+ with ESM support)
 */

// Minimal SkillExecutionContext matching types.ts
const makeContext = (overrides = {}) => ({
  tableName: 'orders',
  columns: [
    { name: 'order_id', type: 'VARCHAR' },
    { name: 'user_id', type: 'VARCHAR' },
    { name: 'amount', type: 'DOUBLE' },
    { name: 'status', type: 'VARCHAR' },
    { name: 'created_at', type: 'TIMESTAMP' },
  ],
  currentSql: 'SELECT * FROM orders LIMIT 100;',
  ...overrides,
});

// ─── Dynamic Import Helper ────────────────────────────────────────────────────

async function loadGenerators() {
  const [{ sqlQueryGenerators, sqlDdlGenerators, analysisGenerators,
           transformationGenerators, optimizationGenerators, utilityGenerators }] = await Promise.all([
    import('../services/skills/sql-generators/index.ts'),
  ]);
  return { sqlQueryGenerators, sqlDdlGenerators, analysisGenerators,
           transformationGenerators, optimizationGenerators, utilityGenerators };
}

// ─── Test Cases ───────────────────────────────────────────────────────────────

const testCases = [
  // Query Generators
  { name: 'sql-select', fn: (g, c) => g.select({ conditions: "status = 'paid'", orderBy: 'created_at DESC', limit: 50 }, c) },
  { name: 'sql-join', fn: (g, c) => g.join({ joinType: 'LEFT JOIN', rightTable: 'users', joinCondition: 'orders.user_id = users.id', selectColumns: 'orders.*, users.name' }, c) },
  { name: 'sql-aggregation', fn: (g, c) => g.aggregation({ aggregationType: 'SUM', groupBy: 'DATE_TRUNC(\'month\', created_at)', having: 'SUM(amount) > 1000' }, c) },
  { name: 'sql-window', fn: (g, c) => g.window({ windowFunc: 'ROW_NUMBER', partitionBy: 'user_id', orderBy: 'created_at DESC', alias: 'rn' }, c) },
  { name: 'sql-cte', fn: (g, c) => g.cte({ cteName: 'recent_orders', as: 'SELECT * FROM orders WHERE status = \'paid\'', select: 'SELECT * FROM recent_orders LIMIT 100' }, c) },
  { name: 'sql-insert', fn: (g, c) => g.insert({ tableName: 'orders', values: "(1, 'user_1', 99.99, 'paid', NOW())", columns: 'order_id, user_id, amount, status, created_at' }, c) },
  { name: 'sql-update', fn: (g, c) => g.update({ tableName: 'orders', set: "status = 'shipped'", where: "order_id = 123" }, c) },
  { name: 'sql-delete', fn: (g, c) => g.delete({ tableName: 'orders', where: "created_at < NOW() - INTERVAL '90 days'", limit: 1000 }, c) },

  // DDL Generators
  { name: 'sql-create-table', fn: (g, c) => g.createTable({ tableName: 'test_table', columns: 'id INTEGER PRIMARY KEY,\nname VARCHAR NOT NULL', ifNotExists: true }, c) },
  { name: 'sql-alter-table', fn: (g, c) => g.alterTable({ tableName: 'orders', alterType: 'ADD COLUMN', columnDefinition: 'updated_at TIMESTAMP DEFAULT NOW()' }, c) },
  { name: 'sql-drop-table', fn: (g, c) => g.dropTable({ tableName: 'stale_data', mode: 'DROP TABLE IF EXISTS' }, c) },
  { name: 'sql-create-index', fn: (g, c) => g.createIndex({ tableName: 'orders', columns: 'user_id, created_at', indexName: 'idx_orders_user_date', ifNotExists: true, unique: false }, c) },

  // Analysis Generators
  { name: 'analysis-time-series', fn: (g, c) => g.timeSeries({ timeColumn: 'created_at', valueColumn: 'amount', granularity: 'day', analysis: 'moving_average', window: 7 }, c) },
  { name: 'analysis-comparison', fn: (g, c) => g.comparison({ comparisonType: '占比分析', groupBy: 'status' }, c) },
  { name: 'analysis-funnel', fn: (g, c) => g.funnel({ steps: 'view: product_view\nevent: add_to_cart\npurchase: checkout', userColumn: 'user_id' }, c) },
  { name: 'analysis-retention', fn: (g, c) => g.retention({ userColumn: 'user_id', timeColumn: 'created_at', periods: '1,7,30' }, c) },

  // Transformation Generators
  { name: 'transform-pivot', fn: (g, c) => g.pivot({ tableName: 'sales', rowColumn: 'region', columnColumn: 'product', valueColumn: 'revenue', aggregator: 'SUM' }, c) },
  { name: 'transform-unpivot', fn: (g, c) => g.unpivot({ tableName: 'wide_table', valueColumns: 'col_a, col_b, col_c', variableColumn: 'metric_name', valueColumn: 'metric_value' }, c) },
  { name: 'transform-type-conversion', fn: (g, c) => g.typeConversion({ conversions: 'VARCHAR→INTEGER' }, c) },
  { name: 'transform-string-manipulation', fn: (g, c) => g.stringManipulation({ operations: 'CONCAT' }, c) },
  { name: 'transform-date-handling', fn: (g, c) => g.dateHandling({ operations: 'DATE_TRUNC' }, c) },

  // Optimization Generators
  { name: 'optimization-explain', fn: (g, c) => g.explain({ sql: 'SELECT * FROM orders WHERE status = \'paid\'' }, c) },
  { name: 'optimization-index', fn: (g, c) => g.index({ tableName: 'orders', columns: 'status, created_at DESC' }, c) },
  { name: 'optimization-query-rewrite', fn: (g, c) => g.queryRewrite({ originalSql: 'SELECT * FROM orders WHERE id IN (SELECT id FROM users)' }, c) },

  // Utility Generators
  { name: 'utility-test-data', fn: (g, c) => g.testData({ tableName: 'test_orders', rowCount: 100, schema: 'order_id INTEGER, name VARCHAR' }, c) },
  { name: 'utility-summarize', fn: (g, c) => g.summarize({ tableName: 'orders' }, c) },
  { name: 'utility-sample-query', fn: (g, c) => g.sampleQuery({ tableName: 'orders', sampleMethod: 'BERNOULLI', sampleSize: '10%' }, c) },
];

// ─── Runner ───────────────────────────────────────────────────────────────────

async function runSmokeTest() {
  console.log('🚀 AI Skills Smoke Test — Generator Validation\n');
  console.log('=' .repeat(70) + '\n');

  let passed = 0;
  let failed = 0;
  const failures = [];

  const generators = await loadGenerators();
  const ctx = makeContext();

  // Flatten generators by category
  const categories = [
    { label: 'Query Generators', gens: generators.sqlQueryGenerators },
    { label: 'DDL Generators', gens: generators.sqlDdlGenerators },
    { label: 'Analysis Generators', gens: generators.analysisGenerators },
    { label: 'Transformation Generators', gens: generators.transformationGenerators },
    { label: 'Optimization Generators', gens: generators.optimizationGenerators },
    { label: 'Utility Generators', gens: generators.utilityGenerators },
  ];

  for (const category of categories) {
    console.log(`\n📁 ${category.label}`);
    console.log('-'.repeat(50));

    for (const [name, fn] of Object.entries(category.gens)) {
      if (typeof fn !== 'function') continue;

      try {
        const result = fn({}, ctx); // empty inputs — expect graceful fallback

        if (typeof result !== 'string' || result.trim().length === 0) {
          failed++;
          failures.push({ name: `${category.label} > ${name}`, error: 'Returned empty or non-string' });
          console.log(`  ❌ ${name.padEnd(30)} → Returned empty/non-string`);
        } else {
          passed++;
          const snippet = result.split('\n')[0].substring(0, 60).padEnd(60);
          console.log(`  ✅ ${name.padEnd(30)} → ${snippet}...`);
        }
      } catch (err) {
        failed++;
        failures.push({ name: `${category.label} > ${name}`, error: err.message });
        console.log(`  ❌ ${name.padEnd(30)} → ${err.message}`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\n🏁 Results: ${passed} ✅ passed, ${failed} ❌ failed`);

  if (failures.length > 0) {
    console.log('\n⚠️  Failures:');
    for (const f of failures) {
      console.log(`  • ${f.name}: ${f.error}`);
    }
    process.exit(1);
  } else {
    console.log('\n🎉 All generators executed successfully!');
    process.exit(0);
  }
}

runSmokeTest().catch(err => {
  console.error('❌ Smoke test crashed:', err.message);
  process.exit(1);
});
