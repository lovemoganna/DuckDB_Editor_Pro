import { duckDBService } from './duckdbService';
import { AssetItem, QualityIssue } from '../components/Dashboard/types';

export const BENCHMARK_METRIC_PRESETS: Record<string, {
  rowCount: number;
  sizeEstimate: string;
  columnCount: number;
  status: AssetItem['status'];
  lastAnalyzedAt: string | null;
  issues: QualityIssue[];
}> = {
  'main.customers': {
    rowCount: 1200000,
    sizeEstimate: '128 MB',
    columnCount: 5,
    status: 'normal',
    lastAnalyzedAt: '2026-09-02 09:12',
    issues: [],
  },
  'main.order_items': {
    rowCount: 18600000,
    sizeEstimate: '612 MB',
    columnCount: 6,
    status: 'normal',
    lastAnalyzedAt: '2026-09-02 09:13',
    issues: [],
  },
  'main.orders': {
    rowCount: 12452319,
    sizeEstimate: '512.3 MB',
    columnCount: 24,
    status: 'attention',
    lastAnalyzedAt: '2026-09-02 10:12',
    issues: [
      {
        id: 'null_orders_status_amount',
        type: 'null_anomaly',
        title: '2 列存在空值',
        ruleDesc: '字段 status 与 total_amount 包含非预期的空值记录',
        affectedRows: 2134,
        affectedRatio: 0.00017,
        detectedAt: '2026-09-02 10:12',
        column: 'status',
        filterSql: 'SELECT * FROM main.orders WHERE status IS NULL OR total_amount IS NULL LIMIT 100;',
      },
      {
        id: 'dup_orders_customer_date',
        type: 'duplicate_risk',
        title: '1 项重复风险',
        ruleDesc: '同一客户在同一秒内存在多笔订单记录，疑似重试幂等异常',
        affectedRows: 48,
        affectedRatio: 0.000004,
        detectedAt: '2026-09-02 10:12',
        column: 'customer_id, order_date',
        filterSql: 'SELECT customer_id, order_date, COUNT(*) as cnt FROM main.orders GROUP BY 1, 2 HAVING cnt > 1 LIMIT 100;',
      },
      {
        id: 'missing_constraint_orders',
        type: 'custom',
        title: '缺少业务唯一约束',
        ruleDesc: '缺少 (customer_id, order_date) 组合唯一性校验',
        detectedAt: '2026-09-02 10:12',
      },
    ],
  },
  'main.products': {
    rowCount: 320000,
    sizeEstimate: '64 MB',
    columnCount: 5,
    status: 'normal',
    lastAnalyzedAt: '2026-08-31 18:05',
    issues: [],
  },
  'main.regions': {
    rowCount: 5000,
    sizeEstimate: '1.2 MB',
    columnCount: 3,
    status: 'normal',
    lastAnalyzedAt: '2026-08-31 18:05',
    issues: [],
  },
  'main.daily_sales': {
    rowCount: 0,
    sizeEstimate: '—',
    columnCount: 3,
    status: 'unanalyzed',
    lastAnalyzedAt: '2026-09-02 08:50',
    issues: [],
  },
  'main.top_customers': {
    rowCount: 0,
    sizeEstimate: '—',
    columnCount: 3,
    status: 'unanalyzed',
    lastAnalyzedAt: '2026-09-01 19:33',
    issues: [],
  },
  'main.order_summary': {
    rowCount: 0,
    sizeEstimate: '—',
    columnCount: 3,
    status: 'unanalyzed',
    lastAnalyzedAt: '2026-08-31 17:21',
    issues: [],
  },
  'main.recent_orders': {
    rowCount: 0,
    sizeEstimate: '—',
    columnCount: 24,
    status: 'unanalyzed',
    lastAnalyzedAt: '2026-08-31 17:21',
    issues: [],
  },
  'sales.raw_orders': {
    rowCount: 3200000,
    sizeEstimate: '142 MB',
    columnCount: 4,
    status: 'normal',
    lastAnalyzedAt: '2026-09-02 09:10',
    issues: [],
  },
  'sales.raw_order_items': {
    rowCount: 12100000,
    sizeEstimate: '398 MB',
    columnCount: 4,
    status: 'normal',
    lastAnalyzedAt: '2026-09-02 09:11',
    issues: [],
  },
  'sales.raw_customers': {
    rowCount: 980000,
    sizeEstimate: '76 MB',
    columnCount: 4,
    status: 'normal',
    lastAnalyzedAt: '2026-09-01 23:02',
    issues: [],
  },
  'sales.imports': {
    rowCount: 120000,
    sizeEstimate: '18 MB',
    columnCount: 5,
    status: 'attention',
    lastAnalyzedAt: '2026-08-30 21:11',
    issues: [
      {
        id: 'missing_pk_imports',
        type: 'missing_pk',
        title: '缺少主键约束',
        ruleDesc: 'sales.imports 未显式定义 PRIMARY KEY，存在无法精确按行更新风险',
        affectedRows: 120000,
        affectedRatio: 1.0,
        detectedAt: '2026-08-30 21:11',
      },
    ],
  },
  'sales.v_raw_sales': {
    rowCount: 0,
    sizeEstimate: '—',
    columnCount: 4,
    status: 'unanalyzed',
    lastAnalyzedAt: '2026-08-30 21:11',
    issues: [],
  },
  'sales.v_import_status': {
    rowCount: 0,
    sizeEstimate: '—',
    columnCount: 2,
    status: 'unanalyzed',
    lastAnalyzedAt: '2026-08-30 21:11',
    issues: [],
  },
  'sales.staging_metrics': {
    rowCount: 0,
    sizeEstimate: '—',
    columnCount: 1,
    status: 'unanalyzed',
    lastAnalyzedAt: '2026-08-30 21:11',
    issues: [],
  },
  'dim.dim_customers': {
    rowCount: 980000,
    sizeEstimate: '76 MB',
    columnCount: 6,
    status: 'normal',
    lastAnalyzedAt: '2026-09-01 23:02',
    issues: [],
  },
  'dim.dim_products': {
    rowCount: 320000,
    sizeEstimate: '64 MB',
    columnCount: 5,
    status: 'normal',
    lastAnalyzedAt: '2026-09-01 22:47',
    issues: [],
  },
  'dim.dim_dates': {
    rowCount: 3700,
    sizeEstimate: '1.2 MB',
    columnCount: 8,
    status: 'normal',
    lastAnalyzedAt: '2026-09-01 22:43',
    issues: [],
  },
  'dim.dim_regions': {
    rowCount: 5000,
    sizeEstimate: '1.2 MB',
    columnCount: 4,
    status: 'normal',
    lastAnalyzedAt: '2026-08-31 18:05',
    issues: [],
  },
  'dim.dim_channels': {
    rowCount: 2000,
    sizeEstimate: '512 KB',
    columnCount: 3,
    status: 'unanalyzed',
    lastAnalyzedAt: '2026-08-31 17:58',
    issues: [],
  },
  'dim.dim_calendar': {
    rowCount: 0,
    sizeEstimate: '—',
    columnCount: 4,
    status: 'unanalyzed',
    lastAnalyzedAt: '2026-08-31 17:58',
    issues: [],
  },
};

/**
 * Seeds the complete BRD 20.1 & screenshot benchmark dataset into DuckDB WASM.
 */
export async function seedBenchmarkDataset(): Promise<void> {
  const statements = [
    // 1. Create schemas
    `CREATE SCHEMA IF NOT EXISTS sales;`,
    `CREATE SCHEMA IF NOT EXISTS dim;`,

    // 2. Schema main tables
    `CREATE TABLE IF NOT EXISTS main.customers (
      customer_id BIGINT PRIMARY KEY,
      name VARCHAR NOT NULL,
      email VARCHAR,
      region_id BIGINT,
      created_at TIMESTAMP
    );`,
    `INSERT INTO main.customers VALUES
      (1, 'Alice Smith', 'alice@example.com', 1, TIMESTAMP '2024-01-15 10:00:00'),
      (2, 'Bob Jones', 'bob@example.com', 2, TIMESTAMP '2024-02-20 14:30:00'),
      (3, 'Charlie Brown', 'charlie@example.com', 1, TIMESTAMP '2024-03-05 09:15:00'),
      (4, 'Diana Prince', 'diana@example.com', 3, TIMESTAMP '2024-03-12 16:45:00'),
      (5, 'Evan Wright', 'evan@example.com', 2, TIMESTAMP '2024-04-01 11:20:00')
    ON CONFLICT DO NOTHING;`,

    `CREATE TABLE IF NOT EXISTS main.products (
      product_id BIGINT PRIMARY KEY,
      product_name VARCHAR NOT NULL,
      category_id BIGINT,
      price DECIMAL(10,2),
      stock_quantity INTEGER
    );`,
    `INSERT INTO main.products VALUES
      (101, 'MacBook Pro 16', 1, 2499.00, 45),
      (102, 'Dell UltraSharp 27', 1, 649.00, 120),
      (103, 'Ergonomic Desk Chair', 2, 389.00, 80),
      (104, 'Mechanical Keyboard', 1, 149.00, 300),
      (105, 'Standing Desk', 2, 599.00, 50)
    ON CONFLICT DO NOTHING;`,

    `CREATE TABLE IF NOT EXISTS main.regions (
      region_id BIGINT PRIMARY KEY,
      region_name VARCHAR NOT NULL,
      country_code VARCHAR
    );`,
    `INSERT INTO main.regions VALUES
      (1, 'North America', 'US'),
      (2, 'Europe West', 'DE'),
      (3, 'Asia Pacific', 'SG'),
      (4, 'Latin America', 'BR')
    ON CONFLICT DO NOTHING;`,

    // main.orders: 24 columns, matches reference inspector exactly
    `CREATE TABLE IF NOT EXISTS main.orders (
      id BIGINT PRIMARY KEY,
      customer_id BIGINT,
      order_date TIMESTAMP,
      status VARCHAR,
      total_amount DECIMAL(12,2),
      items_count INTEGER,
      payment_method VARCHAR,
      shipping_address VARCHAR,
      billing_address VARCHAR,
      carrier VARCHAR,
      tracking_number VARCHAR,
      discount_amount DECIMAL(10,2),
      tax_amount DECIMAL(10,2),
      shipping_fee DECIMAL(10,2),
      is_gift BOOLEAN,
      notes VARCHAR,
      source VARCHAR,
      ip_address VARCHAR,
      user_agent VARCHAR,
      device_type VARCHAR,
      currency VARCHAR,
      warehouse_id BIGINT,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    );`,
    `INSERT INTO main.orders (id, customer_id, order_date, status, total_amount, items_count, payment_method, shipping_address, billing_address, carrier, tracking_number, discount_amount, tax_amount, shipping_fee, is_gift, notes, source, ip_address, user_agent, device_type, currency, warehouse_id, created_at, updated_at) VALUES
      (1001, 1, TIMESTAMP '2026-09-02 08:30:00', 'completed', 2797.00, 3, 'Credit Card', '100 Market St, SF', '100 Market St, SF', 'FedEx', 'TRK-987123', 0.00, 220.00, 15.00, false, 'Leave at door', 'web', '192.168.1.1', 'Mozilla/5.0', 'desktop', 'USD', 1, TIMESTAMP '2026-09-02 08:30:00', TIMESTAMP '2026-09-02 08:30:00'),
      (1002, 2, TIMESTAMP '2026-09-02 09:15:00', 'completed', 649.00, 1, 'PayPal', '250 Kingsway, London', '250 Kingsway, London', 'DHL', 'TRK-987124', 20.00, 50.00, 10.00, false, null, 'mobile', '192.168.1.2', 'Safari/17.0', 'mobile', 'USD', 2, TIMESTAMP '2026-09-02 09:15:00', TIMESTAMP '2026-09-02 09:15:00'),
      (1003, 3, TIMESTAMP '2026-09-02 09:45:00', null, 389.00, 1, 'Credit Card', '50 Orchard Rd, Singapore', '50 Orchard Rd, Singapore', 'UPS', 'TRK-987125', 0.00, 30.00, 12.00, true, 'Birthday present', 'web', '192.168.1.3', 'Chrome/124.0', 'desktop', 'USD', 3, TIMESTAMP '2026-09-02 09:45:00', TIMESTAMP '2026-09-02 09:45:00'),
      (1004, 4, TIMESTAMP '2026-09-02 10:00:00', 'shipped', null, 2, 'Wire', '800 Paulista Ave, Sao Paulo', '800 Paulista Ave, Sao Paulo', 'Correios', 'TRK-987126', 15.00, 45.00, 20.00, false, null, 'web', '192.168.1.4', 'Edge/123.0', 'desktop', 'USD', 4, TIMESTAMP '2026-09-02 10:00:00', TIMESTAMP '2026-09-02 10:00:00'),
      (1005, 1, TIMESTAMP '2026-09-02 08:30:00', 'completed', 149.00, 1, 'Credit Card', '100 Market St, SF', '100 Market St, SF', 'FedEx', 'TRK-987127', 0.00, 12.00, 5.00, false, null, 'web', '192.168.1.1', 'Mozilla/5.0', 'desktop', 'USD', 1, TIMESTAMP '2026-09-02 08:30:00', TIMESTAMP '2026-09-02 08:30:00')
    ON CONFLICT DO NOTHING;`,

    `CREATE TABLE IF NOT EXISTS main.order_items (
      item_id BIGINT PRIMARY KEY,
      order_id BIGINT,
      product_id BIGINT,
      quantity INTEGER,
      unit_price DECIMAL(10,2),
      subtotal DECIMAL(12,2)
    );`,
    `INSERT INTO main.order_items VALUES
      (1, 1001, 101, 1, 2499.00, 2499.00),
      (2, 1001, 104, 2, 149.00, 298.00),
      (3, 1002, 102, 1, 649.00, 649.00),
      (4, 1003, 103, 1, 389.00, 389.00)
    ON CONFLICT DO NOTHING;`,

    // main views
    `CREATE OR REPLACE VIEW main.daily_sales AS
      SELECT order_date::DATE as sale_date, COUNT(*) as orders_count, SUM(total_amount) as daily_revenue
      FROM main.orders WHERE total_amount IS NOT NULL GROUP BY 1;`,
    `CREATE OR REPLACE VIEW main.top_customers AS
      SELECT customer_id, COUNT(*) as orders_count, SUM(total_amount) as total_spent
      FROM main.orders WHERE total_amount IS NOT NULL GROUP BY 1;`,
    `CREATE OR REPLACE VIEW main.order_summary AS
      SELECT COALESCE(status, 'unknown') as status, COUNT(*) as count, SUM(total_amount) as total_val
      FROM main.orders GROUP BY 1;`,
    `CREATE OR REPLACE VIEW main.recent_orders AS
      SELECT * FROM main.orders ORDER BY order_date DESC LIMIT 100;`,

    // 3. Schema sales tables
    `CREATE TABLE IF NOT EXISTS sales.raw_orders (
      raw_id BIGINT PRIMARY KEY,
      payload VARCHAR,
      source VARCHAR,
      received_at TIMESTAMP
    );`,
    `INSERT INTO sales.raw_orders VALUES
      (1, '{"event":"order_created","id":1001}', 'pos_store_1', TIMESTAMP '2026-09-02 09:10:00'),
      (2, '{"event":"order_created","id":1002}', 'online_web', TIMESTAMP '2026-09-02 09:11:00')
    ON CONFLICT DO NOTHING;`,

    `CREATE TABLE IF NOT EXISTS sales.raw_order_items (
      raw_item_id BIGINT PRIMARY KEY,
      raw_order_id BIGINT,
      sku VARCHAR,
      qty INTEGER
    );`,
    `INSERT INTO sales.raw_order_items VALUES
      (1, 1, 'SKU-MAC-16', 1),
      (2, 2, 'SKU-DELL-27', 1)
    ON CONFLICT DO NOTHING;`,

    `CREATE TABLE IF NOT EXISTS sales.raw_customers (
      raw_cust_id BIGINT PRIMARY KEY,
      raw_name VARCHAR,
      channel VARCHAR,
      sync_time TIMESTAMP
    );`,
    `INSERT INTO sales.raw_customers VALUES
      (1, 'Alice Smith', 'direct', TIMESTAMP '2026-09-01 23:02:00'),
      (2, 'Bob Jones', 'google_ads', TIMESTAMP '2026-09-01 23:02:00')
    ON CONFLICT DO NOTHING;`,

    // sales.imports has NO primary key (demonstrating missing PK)
    `CREATE TABLE IF NOT EXISTS sales.imports (
      batch_id BIGINT,
      file_name VARCHAR,
      row_count BIGINT,
      imported_by VARCHAR,
      imported_at TIMESTAMP
    );`,
    `INSERT INTO sales.imports VALUES
      (101, 'orders_202608.parquet', 120000, 'etl_worker_1', TIMESTAMP '2026-08-30 21:11:00');`,

    // sales views
    `CREATE OR REPLACE VIEW sales.v_raw_sales AS SELECT * FROM sales.raw_orders;`,
    `CREATE OR REPLACE VIEW sales.v_import_status AS SELECT file_name, imported_at FROM sales.imports;`,
    `CREATE OR REPLACE VIEW sales.staging_metrics AS SELECT COUNT(*) as total_imports FROM sales.imports;`,

    // 4. Schema dim tables
    `CREATE TABLE IF NOT EXISTS dim.dim_customers (
      customer_key BIGINT PRIMARY KEY,
      customer_id BIGINT,
      name VARCHAR,
      segment VARCHAR,
      valid_from DATE,
      valid_to DATE
    );`,
    `INSERT INTO dim.dim_customers VALUES
      (1, 1, 'Alice Smith', 'Enterprise', DATE '2024-01-01', DATE '2099-12-31')
    ON CONFLICT DO NOTHING;`,

    `CREATE TABLE IF NOT EXISTS dim.dim_products (
      product_key BIGINT PRIMARY KEY,
      product_id BIGINT,
      product_name VARCHAR,
      category VARCHAR,
      brand VARCHAR
    );`,
    `INSERT INTO dim.dim_products VALUES
      (1, 101, 'MacBook Pro 16', 'Laptops', 'Apple')
    ON CONFLICT DO NOTHING;`,

    `CREATE TABLE IF NOT EXISTS dim.dim_dates (
      date_key INTEGER PRIMARY KEY,
      full_date DATE,
      year INTEGER,
      quarter INTEGER,
      month INTEGER,
      day_of_month INTEGER,
      day_name VARCHAR,
      is_weekend BOOLEAN
    );`,
    `INSERT INTO dim.dim_dates VALUES
      (20260901, DATE '2026-09-01', 2026, 3, 9, 1, 'Tuesday', false),
      (20260902, DATE '2026-09-02', 2026, 3, 9, 2, 'Wednesday', false)
    ON CONFLICT DO NOTHING;`,

    `CREATE TABLE IF NOT EXISTS dim.dim_regions (
      region_key BIGINT PRIMARY KEY,
      region_id BIGINT,
      region_name VARCHAR,
      sub_region VARCHAR
    );`,
    `INSERT INTO dim.dim_regions VALUES
      (1, 1, 'North America', 'US West')
    ON CONFLICT DO NOTHING;`,

    `CREATE TABLE IF NOT EXISTS dim.dim_channels (
      channel_key BIGINT,
      channel_name VARCHAR,
      channel_group VARCHAR
    );`,
    `INSERT INTO dim.dim_channels VALUES
      (1, 'Online Direct', 'Direct'),
      (2, 'Affiliate', 'Partner');`,

    // dim view
    `CREATE OR REPLACE VIEW dim.dim_calendar AS
      SELECT date_key, full_date, year, month FROM dim.dim_dates;`,
  ];

  for (const sql of statements) {
    try {
      await duckDBService.query(sql);
    } catch (e) {
      console.warn('[Benchmark Seed] Statement execution warning:', sql, e);
    }
  }

  // Pre-seed analysis snapshots into localStorage so the dashboard shows the benchmark state immediately
  try {
    const STORAGE_KEY = 'duckdb_asset_analysis_snapshots_v1';
    const existing = localStorage.getItem(STORAGE_KEY);
    const map = existing ? JSON.parse(existing) : {};

    for (const [id, preset] of Object.entries(BENCHMARK_METRIC_PRESETS)) {
      if (!map[id]) {
        map[id] = {
          lastAnalyzedAt: preset.lastAnalyzedAt,
          issues: preset.issues,
          status: preset.status,
          nullRate: preset.issues.some(i => i.type === 'null_anomaly') ? 0.00017 : 0,
        };
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('[Benchmark Seed] Failed to save initial analysis snapshots:', err);
  }
}
