import { duckDBService } from '../../services/duckdbService';

export const DEFAULT_WORKBENCH_SQL = `SELECT
    r.region,
    c.category,
    COUNT(DISTINCT o.order_id) AS 订单数,
    SUM(oi.quantity) AS 销量,
    SUM(oi.quantity * oi.unit_price) AS 营业额,
    ROUND(SUM(oi.quantity * oi.unit_price) / NULLIF(COUNT(DISTINCT o.order_id), 0), 2) AS 客单价
FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id
JOIN customers cu ON o.customer_id = cu.customer_id
JOIN regions r ON cu.region_id = r.region_id
JOIN products p ON oi.product_id = p.product_id
JOIN categories c ON p.category_id = c.category_id
WHERE o.order_date >= '2024-01-01' AND o.order_date < '2025-01-01'
  AND o.status IN ('completed', 'shipped')
GROUP BY r.region, c.category
ORDER BY 营业额 DESC;`;

// Target sample rows matching screenshot exactly (24 aggregated rows)
export const TARGET_SAMPLE_ROWS = [
  { region: 'North America', category: 'Electronics', 订单数: 186, 销量: 542, 营业额: 198742.15, 客单价: 1067.97 },
  { region: 'Asia Pacific', category: 'Electronics', 订单数: 152, 销量: 433, 营业额: 152318.40, 客单价: 1002.76 },
  { region: 'Europe', category: 'Electronics', 订单数: 143, 销量: 408, 营业额: 136784.20, 客单价: 956.54 },
  { region: 'North America', category: 'Home', 订单数: 158, 销量: 512, 营业额: 126530.75, 客单价: 800.83 },
  { region: 'Europe', category: 'Home', 订单数: 135, 销量: 436, 营业额: 108654.30, 客单价: 804.11 },
  { region: 'Asia Pacific', category: 'Home', 订单数: 128, 销量: 405, 营业额: 97845.60, 客单价: 764.42 },
  { region: 'North America', category: 'Clothing', 订单数: 121, 销量: 398, 营业额: 78249.80, 客单价: 647.52 },
  { region: 'Europe', category: 'Clothing', 订单数: 109, 销量: 352, 营业额: 66512.90, 客单价: 610.67 },
  { region: 'Asia Pacific', category: 'Clothing', 订单数: 97, 销量: 308, 营业额: 54321.40, 客单价: 560.02 },
  { region: 'North America', category: 'Sports', 订单数: 88, 销量: 267, 营业额: 45887.60, 客单价: 521.45 },
  { region: 'Europe', category: 'Sports', 订单数: 82, 销量: 245, 营业额: 41230.50, 客单价: 502.81 },
  { region: 'Asia Pacific', category: 'Sports', 订单数: 76, 销量: 228, 营业额: 38940.20, 客单价: 512.37 },
  { region: 'North America', category: 'Beauty', 订单数: 69, 销量: 210, 营业额: 32450.80, 客单价: 470.30 },
  { region: 'Europe', category: 'Beauty', 订单数: 64, 销量: 195, 营业额: 29870.40, 客单价: 466.73 },
  { region: 'Asia Pacific', category: 'Beauty', 订单数: 58, 销量: 178, 营业额: 26540.10, 客单价: 457.59 },
  { region: 'South America', category: 'Electronics', 订单数: 52, 销量: 160, 营业额: 24320.00, 客单价: 467.69 },
  { region: 'South America', category: 'Home', 订单数: 46, 销量: 142, 营业额: 21050.60, 客单价: 457.62 },
  { region: 'South America', category: 'Clothing', 订单数: 41, 销量: 125, 营业额: 18760.30, 客单价: 457.57 },
  { region: 'North America', category: 'Other', 订单数: 38, 销量: 112, 营业额: 16420.50, 客单价: 432.12 },
  { region: 'Europe', category: 'Other', 订单数: 33, 销量: 98, 营业额: 14890.20, 客单价: 451.22 },
  { region: 'Asia Pacific', category: 'Other', 订单数: 29, 销量: 86, 营业额: 13650.80, 客单价: 470.72 },
  { region: 'South America', category: 'Sports', 订单数: 28, 销量: 82, 营业额: 12980.40, 客单价: 463.59 },
  { region: 'South America', category: 'Beauty', 订单数: 26, 销量: 78, 营业额: 12650.00, 客单价: 486.54 },
  { region: 'South America', category: 'Other', 订单数: 24, 销量: 72, 营业额: 12345.60, 客单价: 514.40 },
];

export const DEMO_COLUMN_TYPES: Record<string, string> = {
  region: 'VARCHAR',
  category: 'VARCHAR',
  订单数: 'BIGINT',
  销量: 'BIGINT',
  营业额: 'DECIMAL(18,2)',
  客单价: 'DECIMAL(18,2)',
  order_id: 'BIGINT',
  order_date: 'DATE',
  customer_id: 'BIGINT',
  order_count: 'BIGINT',
  revenue: 'DECIMAL(18,2)',
  avg_order_amount: 'DECIMAL(18,2)',
  region_name: 'VARCHAR',
  category_name: 'VARCHAR',
  amount: 'DECIMAL(18,2)',
  status: 'VARCHAR',
  month: 'DATE',
  orders: 'BIGINT',
  units_sold: 'BIGINT',
  avg_order_value: 'DECIMAL(18,2)',
  source_file: 'VARCHAR',
};

export const DEMO_FILES = [
  { name: 'orders_202412.parquet', size: '152 MB', type: 'parquet' },
  { name: 'customers.parquet', size: '28 MB', type: 'parquet' },
  { name: 'products.parquet', size: '9.4 MB', type: 'parquet' },
  { name: 'returns_202412.parquet', size: '32 MB', type: 'parquet' },
  { name: 'exchange_rates.csv', size: '2.1 MB', type: 'csv' },
  { name: 'readme.md', size: '1 KB', type: 'file' },
];

export const DEMO_REMOTE_SOURCES = [
  { name: 's3://company-data/', type: 's3', uri: 's3://company-data/' },
  { name: 'https://data.example.com/', type: 'http', uri: 'https://data.example.com/' },
];

export const DEMO_RECENT_QUERIES = [
  { title: 'revenue_q4.sql', time: '09:42:21', rows: '1,000 行' },
  { title: 'churn_analysis.sql', time: '09:12:08', rows: '246 行' },
  { title: 'top_customers.sql', time: '08:55:30', rows: '1,234 行' },
  { title: 'orders_overview.sql', time: '昨天', rows: '12 行' },
  { title: 'region_summary.sql', time: '昨天', rows: '8,912 行' },
];

export const DEMO_TABLE_ROW_COUNTS: Record<string, number> = {
  categories: 6,
  customers: 500,
  date_dim: 365,
  order_items: 2000,
  orders: 1000,
  products: 100,
  regions: 6,
  transactions: 1000,
  dates: 365,
  stores: 120,
  returns: 4520,
  payments: 850000,
};

let seedPromise: Promise<void> | null = null;

export async function seedDemoWorkbenchData(): Promise<void> {
  if (seedPromise) {
    return seedPromise;
  }
  seedPromise = (async () => {
    const seedSql = `
    -- 1. Regions table
    CREATE TABLE IF NOT EXISTS regions (
      region_id INTEGER PRIMARY KEY,
      region_name VARCHAR NOT NULL,
      region VARCHAR,
      country_code VARCHAR
    );
    INSERT INTO regions
    SELECT 1, 'North America', 'North America', 'US' WHERE NOT EXISTS (SELECT 1 FROM regions WHERE region_id = 1);
    INSERT INTO regions
    SELECT 2, 'Europe', 'Europe', 'EU' WHERE NOT EXISTS (SELECT 1 FROM regions WHERE region_id = 2);
    INSERT INTO regions
    SELECT 3, 'Asia Pacific', 'Asia Pacific', 'AP' WHERE NOT EXISTS (SELECT 1 FROM regions WHERE region_id = 3);
    INSERT INTO regions
    SELECT 4, 'South America', 'South America', 'SA' WHERE NOT EXISTS (SELECT 1 FROM regions WHERE region_id = 4);
    INSERT INTO regions
    SELECT 5, 'Africa', 'Africa', 'AF' WHERE NOT EXISTS (SELECT 1 FROM regions WHERE region_id = 5);
    INSERT INTO regions
    SELECT 6, 'Middle East', 'Middle East', 'ME' WHERE NOT EXISTS (SELECT 1 FROM regions WHERE region_id = 6);

    -- 2. Categories table
    CREATE TABLE IF NOT EXISTS categories (
      category_id INTEGER PRIMARY KEY,
      category_name VARCHAR NOT NULL,
      category VARCHAR
    );
    INSERT INTO categories
    SELECT 1, 'Electronics', 'Electronics' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE category_id = 1);
    INSERT INTO categories
    SELECT 2, 'Home', 'Home' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE category_id = 2);
    INSERT INTO categories
    SELECT 3, 'Clothing', 'Clothing' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE category_id = 3);
    INSERT INTO categories
    SELECT 4, 'Sports', 'Sports' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE category_id = 4);
    INSERT INTO categories
    SELECT 5, 'Beauty', 'Beauty' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE category_id = 5);
    INSERT INTO categories
    SELECT 6, 'Other', 'Other' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE category_id = 6);

    -- 3. Customers table
    CREATE TABLE IF NOT EXISTS customers (
      customer_id BIGINT PRIMARY KEY,
      customer_name VARCHAR NOT NULL,
      email VARCHAR,
      region_id INTEGER,
      region VARCHAR,
      signup_date DATE
    );
    INSERT INTO customers
    SELECT 
      10000 + i AS customer_id,
      'Customer_' || i AS customer_name,
      'user_' || i || '@example.com' AS email,
      1 + CAST(i % 5 AS INTEGER) AS region_id,
      CASE CAST(i % 5 AS INTEGER)
        WHEN 0 THEN 'North America'
        WHEN 1 THEN 'Europe'
        WHEN 2 THEN 'Asia Pacific'
        WHEN 3 THEN 'South America'
        ELSE 'Africa'
      END AS region,
      DATE '2023-01-01' + (i % 365) * INTERVAL 1 DAY AS signup_date
    FROM range(1, 501) t(i)
    WHERE NOT EXISTS (SELECT 1 FROM customers LIMIT 1);

    -- 4. Products table
    CREATE TABLE IF NOT EXISTS products (
      product_id BIGINT PRIMARY KEY,
      product_name VARCHAR NOT NULL,
      category_id INTEGER,
      category VARCHAR,
      unit_price DOUBLE,
      stock_qty INTEGER
    );
    INSERT INTO products
    SELECT
      100 + i AS product_id,
      'Product ' || i AS product_name,
      1 + CAST(i % 6 AS INTEGER) AS category_id,
      CASE CAST(i % 6 AS INTEGER)
        WHEN 0 THEN 'Electronics'
        WHEN 1 THEN 'Home'
        WHEN 2 THEN 'Clothing'
        WHEN 3 THEN 'Sports'
        WHEN 4 THEN 'Beauty'
        ELSE 'Other'
      END AS category,
      ROUND(10 + (random() * 500), 2) AS unit_price,
      CAST(10 + (random() * 100) AS INTEGER) AS stock_qty
    FROM range(1, 101) t(i)
    WHERE NOT EXISTS (SELECT 1 FROM products LIMIT 1);

    -- 5. Orders table
    CREATE TABLE IF NOT EXISTS orders (
      order_id BIGINT PRIMARY KEY,
      customer_id BIGINT NOT NULL,
      order_date DATE NOT NULL,
      region_id INTEGER NOT NULL,
      region VARCHAR,
      status VARCHAR NOT NULL,
      source_file VARCHAR
    );
    INSERT INTO orders
    SELECT
      8760234 + i AS order_id,
      10000 + CAST(1 + (random() * 490) AS BIGINT) AS customer_id,
      DATE '2024-01-01' + CAST(random() * 365 AS INTEGER) * INTERVAL 1 DAY AS order_date,
      1 + CAST(random() * 4.99 AS INTEGER) AS region_id,
      CASE CAST(i % 5 AS INTEGER)
        WHEN 0 THEN 'Europe'
        WHEN 1 THEN 'Asia Pacific'
        WHEN 2 THEN 'North America'
        WHEN 3 THEN 'South America'
        ELSE 'Africa'
      END AS region,
      CASE CAST(random() * 10 AS INTEGER)
        WHEN 0 THEN 'cancelled'
        WHEN 1 THEN 'pending'
        WHEN 2 THEN 'pending'
        ELSE 'completed'
      END AS status,
      'orders_202412.parquet' AS source_file
    FROM range(1, 1001) t(i)
    WHERE NOT EXISTS (SELECT 1 FROM orders LIMIT 1);

    -- 6. Order Items table
    CREATE TABLE IF NOT EXISTS order_items (
      item_id BIGINT PRIMARY KEY,
      order_id BIGINT NOT NULL,
      product_id BIGINT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price DOUBLE NOT NULL,
      amount DOUBLE NOT NULL
    );
    INSERT INTO order_items
    SELECT
      i AS item_id,
      8760234 + (1 + (i % 1000)) AS order_id,
      100 + (1 + (i % 99)) AS product_id,
      1 + CAST(random() * 3 AS INTEGER) AS quantity,
      ROUND(25.0 + (random() * 200.0), 2) AS unit_price,
      ROUND(25.0 + (random() * 400.0), 2) AS amount
    FROM range(1, 2001) t(i)
    WHERE NOT EXISTS (SELECT 1 FROM order_items LIMIT 1);

    -- 7. Transactions table
    CREATE TABLE IF NOT EXISTS transactions (
      tx_id BIGINT PRIMARY KEY,
      order_id BIGINT NOT NULL,
      amount DOUBLE NOT NULL,
      payment_method VARCHAR,
      tx_date DATE
    );
    INSERT INTO transactions
    SELECT
      100000 + i AS tx_id,
      8760234 + (1 + (i % 1000)) AS order_id,
      ROUND(50.0 + (random() * 600.0), 2) AS amount,
      CASE (i % 4)
        WHEN 0 THEN 'Credit Card'
        WHEN 1 THEN 'PayPal'
        WHEN 2 THEN 'Apple Pay'
        ELSE 'Wire Transfer'
      END AS payment_method,
      DATE '2024-01-01' + (i % 365) * INTERVAL 1 DAY AS tx_date
    FROM range(1, 1001) t(i)
    WHERE NOT EXISTS (SELECT 1 FROM transactions LIMIT 1);

    -- 8. Date Dimension
    CREATE TABLE IF NOT EXISTS date_dim (
      date_key INTEGER PRIMARY KEY,
      full_date DATE NOT NULL,
      year INTEGER,
      month INTEGER,
      day INTEGER,
      quarter INTEGER
    );
    INSERT INTO date_dim
    SELECT
      CAST(strftime(d, '%Y%m%d') AS INTEGER) AS date_key,
      d AS full_date,
      year(d) AS year,
      month(d) AS month,
      day(d) AS day,
      quarter(d) AS quarter
    FROM (
      SELECT DATE '2024-01-01' + i * INTERVAL 1 DAY AS d
      FROM range(0, 365) t(i)
    )
    WHERE NOT EXISTS (SELECT 1 FROM date_dim LIMIT 1);

    -- 9. Views in main schema (Matching Reference Screenshot)
    CREATE OR REPLACE VIEW daily_sales AS
    SELECT 
      o.order_date,
      COUNT(DISTINCT o.order_id) AS total_orders,
      ROUND(SUM(oi.amount), 2) AS total_revenue
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    GROUP BY 1;

    CREATE OR REPLACE VIEW top_customers AS
    SELECT 
      c.customer_id,
      c.customer_name,
      COUNT(DISTINCT o.order_id) AS order_count,
      ROUND(SUM(oi.amount), 2) AS total_spent
    FROM customers c
    JOIN orders o ON c.customer_id = o.customer_id
    JOIN order_items oi ON o.order_id = oi.order_id
    GROUP BY 1, 2;

    CREATE OR REPLACE VIEW order_summary AS
    SELECT status, COUNT(*) AS cnt, ROUND(AVG(amount), 2) AS avg_amt
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.order_id
    GROUP BY status;

    CREATE OR REPLACE VIEW recent_orders AS
    SELECT * FROM orders ORDER BY order_date DESC LIMIT 100;

    -- 10. Schema 'sales' & Tables
    CREATE SCHEMA IF NOT EXISTS sales;

    CREATE TABLE IF NOT EXISTS sales.raw_orders AS
    SELECT * FROM orders LIMIT 300;

    CREATE TABLE IF NOT EXISTS sales.raw_order_items AS
    SELECT * FROM order_items LIMIT 500;

    CREATE TABLE IF NOT EXISTS sales.raw_customers AS
    SELECT * FROM customers LIMIT 200;

    CREATE TABLE IF NOT EXISTS sales.imports (
      import_id BIGINT,
      batch_no VARCHAR,
      file_name VARCHAR,
      record_count INTEGER,
      imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO sales.imports
    SELECT * FROM (VALUES 
      (1, 'BATCH_202412_01', 'orders_202412.parquet', 1000, CURRENT_TIMESTAMP),
      (2, 'BATCH_202412_02', 'customers.parquet', 500, CURRENT_TIMESTAMP)
    ) AS t(import_id, batch_no, file_name, record_count, imported_at)
    WHERE NOT EXISTS (SELECT 1 FROM sales.imports LIMIT 1);

    CREATE OR REPLACE VIEW sales.v_raw_sales AS
    SELECT * FROM sales.raw_orders WHERE status = 'completed';

    CREATE OR REPLACE VIEW sales.v_import_status AS
    SELECT file_name, SUM(record_count) as total_records FROM sales.imports GROUP BY file_name;

    CREATE OR REPLACE VIEW sales.staging_metrics AS
    SELECT count(*) as total_raw_orders FROM sales.raw_orders;

    -- 11. Schema 'dim' & Tables
    CREATE SCHEMA IF NOT EXISTS dim;

    CREATE TABLE IF NOT EXISTS dim.dim_customers AS
    SELECT customer_id, customer_name, email, region FROM customers;

    CREATE TABLE IF NOT EXISTS dim.dim_products AS
    SELECT product_id, product_name, category, unit_price FROM products;

    CREATE TABLE IF NOT EXISTS dim.dim_dates AS
    SELECT * FROM date_dim;

    CREATE TABLE IF NOT EXISTS dim.dim_regions AS
    SELECT * FROM regions;

    CREATE TABLE IF NOT EXISTS dim.dim_channels (
      channel_id INTEGER PRIMARY KEY,
      channel_name VARCHAR,
      channel_type VARCHAR
    );
    INSERT INTO dim.dim_channels
    SELECT * FROM (VALUES 
      (1, 'Online Direct', 'WEB'),
      (2, 'Mobile App', 'APP'),
      (3, 'Retail Partner', 'OFFLINE')
    ) t(channel_id, channel_name, channel_type)
    WHERE NOT EXISTS (SELECT 1 FROM dim.dim_channels LIMIT 1);

    CREATE OR REPLACE VIEW dim.dim_calendar AS
    SELECT full_date, year, month, quarter FROM dim.dim_dates;
  `;

  try {
    await duckDBService.query(seedSql);
  } catch (e) {
    console.warn('Demo data initialization query error (ignored):', e);
  }

  // Generate virtual files in DuckDB VFS for Parquet & CSV files
  const filesToExport = [
    {
      name: 'orders_202412.parquet',
      sql: `COPY (SELECT * FROM orders LIMIT 500) TO 'orders_202412.parquet' (FORMAT PARQUET);`,
    },
    {
      name: 'customers.parquet',
      sql: `COPY (SELECT * FROM customers LIMIT 200) TO 'customers.parquet' (FORMAT PARQUET);`,
    },
    {
      name: 'products.parquet',
      sql: `COPY (SELECT * FROM products) TO 'products.parquet' (FORMAT PARQUET);`,
    },
    {
      name: 'returns_202412.parquet',
      sql: `COPY (SELECT * FROM orders LIMIT 50) TO 'returns_202412.parquet' (FORMAT PARQUET);`,
    },
    {
      name: 'exchange_rates.csv',
      sql: `COPY (
        SELECT 'USD' AS from_currency, 'EUR' AS to_currency, 0.92 AS rate, DATE '2024-12-01' AS date
        UNION ALL SELECT 'USD', 'GBP', 0.79, DATE '2024-12-01'
        UNION ALL SELECT 'USD', 'JPY', 156.40, DATE '2024-12-01'
        UNION ALL SELECT 'USD', 'CNY', 7.23, DATE '2024-12-01'
        UNION ALL SELECT 'EUR', 'USD', 1.08, DATE '2024-12-01'
        UNION ALL SELECT 'GBP', 'USD', 1.26, DATE '2024-12-01'
      ) TO 'exchange_rates.csv' (HEADER, DELIMITER ',');`,
    },
    {
      name: 'readme.md',
      sql: `COPY (
        SELECT 1 AS line_no, '# DuckDB Analytics Workspace Demo' AS content
        UNION ALL SELECT 2, 'This dataset demonstrates DuckDB analytical capabilities.'
        UNION ALL SELECT 3, '- Tables: orders, customers, products, transactions, regions, date_dim'
        UNION ALL SELECT 4, '- Views: v_sales_summary, v_customer_ltv'
        UNION ALL SELECT 5, '- Files: Parquet and CSV files for zero-copy scan and querying'
      ) TO 'readme.md' (HEADER, DELIMITER '\t');`,
    },
  ];

  for (const item of filesToExport) {
    try {
      await duckDBService.query(item.sql);
    } catch (fErr) {
      console.warn(`[DuckDB] Failed to create virtual file ${item.name} (ignored):`, fErr);
    }
  }
  })();
  return seedPromise;
}

export async function seedWebLogsData(): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS web_access_logs AS
    SELECT 
      100000 + i AS log_id,
      TIMESTAMP '2025-01-01 00:00:00' + INTERVAL (i * 17) SECOND AS request_time,
      '192.168.' || (i % 20)::VARCHAR || '.' || ((i * 7) % 250 + 1)::VARCHAR AS client_ip,
      ['GET', 'POST', 'PUT', 'DELETE'][1 + (i % 4)] AS http_method,
      ['/api/v1/query', '/api/v1/auth', '/dashboard', '/api/v1/export', '/static/bundle.js', '/api/v1/health'][1 + (i % 6)] AS request_path,
      [200, 200, 200, 201, 400, 401, 404, 500][1 + (i % 8)] AS status_code,
      ROUND(10 + (i * 37 % 850) + (i % 5) * 20.5, 2) AS latency_ms,
      ['Chrome/128.0', 'Firefox/130.0', 'Safari/17.4', 'Edge/128.0', 'DuckDB-Client/1.1'][1 + (i % 5)] AS user_agent
    FROM range(1, 5001) t(i);
  `;
  await duckDBService.query(sql);
}

export async function seedUserFunnelData(): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS user_events AS
    SELECT 
      1000 + (i % 450) AS user_id,
      'sess_' || (i % 700)::VARCHAR AS session_id,
      TIMESTAMP '2025-02-01 08:00:00' + INTERVAL (i * 43) SECOND AS event_time,
      ['page_view', 'search', 'view_item', 'add_to_cart', 'checkout_start', 'payment_success'][1 + (i % 6)] AS event_name,
      ['iOS', 'Android', 'Web', 'macOS'][1 + (i % 4)] AS platform,
      ROUND(CASE WHEN i % 6 >= 3 THEN 29.9 + (i * 13 % 400) ELSE 0 END, 2) AS event_value
    FROM range(1, 2501) t(i);
  `;
  await duckDBService.query(sql);
}
