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
  subcategory: 'VARCHAR',
  brand: 'VARCHAR',
  country: 'VARCHAR',
  city: 'VARCHAR',
  customer_segment: 'VARCHAR',
  loyalty_tier: 'VARCHAR',
  channel: 'VARCHAR',
  price_tier: 'VARCHAR',
  订单数: 'BIGINT',
  销量: 'BIGINT',
  营业额: 'DECIMAL(18,2)',
  客单价: 'DECIMAL(18,2)',
  order_id: 'BIGINT',
  order_date: 'DATE',
  shipping_date: 'DATE',
  delivery_date: 'DATE',
  delivery_days: 'INTEGER',
  customer_id: 'BIGINT',
  order_count: 'BIGINT',
  revenue: 'DECIMAL(18,2)',
  cost_price: 'DECIMAL(18,2)',
  unit_price: 'DECIMAL(18,2)',
  discount_rate: 'DECIMAL(5,2)',
  discount_amount: 'DECIMAL(18,2)',
  net_amount: 'DECIMAL(18,2)',
  cost_amount: 'DECIMAL(18,2)',
  profit: 'DECIMAL(18,2)',
  gross_profit: 'DECIMAL(18,2)',
  margin_rate: 'DECIMAL(6,4)',
  avg_order_amount: 'DECIMAL(18,2)',
  region_name: 'VARCHAR',
  category_name: 'VARCHAR',
  amount: 'DECIMAL(18,2)',
  status: 'VARCHAR',
  is_delayed: 'BOOLEAN',
  fiscal_quarter: 'VARCHAR',
  month: 'DATE',
  year_month: 'VARCHAR',
  is_weekend: 'BOOLEAN',
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
  date_dim: 731,
  order_items: 4000,
  orders: 2000,
  products: 100,
  regions: 6,
  transactions: 2000,
  dates: 731,
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
    -- Schema migration for existing tables if already created
    CREATE TABLE IF NOT EXISTS regions (
      region_id INTEGER PRIMARY KEY,
      region_name VARCHAR NOT NULL,
      region VARCHAR,
      country_code VARCHAR,
      region_code VARCHAR
    );
    ALTER TABLE regions ADD COLUMN IF NOT EXISTS region_code VARCHAR;

    CREATE TABLE IF NOT EXISTS categories (
      category_id INTEGER PRIMARY KEY,
      category_name VARCHAR NOT NULL,
      category VARCHAR
    );

    CREATE TABLE IF NOT EXISTS products (
      product_id BIGINT PRIMARY KEY,
      product_name VARCHAR NOT NULL,
      category_id INTEGER,
      category VARCHAR,
      subcategory VARCHAR,
      brand VARCHAR,
      cost_price DOUBLE,
      unit_price DOUBLE,
      margin_rate DOUBLE,
      price_tier VARCHAR,
      stock_qty INTEGER
    );
    ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id INTEGER;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory VARCHAR;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS brand VARCHAR;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DOUBLE;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS margin_rate DOUBLE;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS price_tier VARCHAR;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_price DOUBLE;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_qty INTEGER;

    CREATE TABLE IF NOT EXISTS customers (
      customer_id BIGINT PRIMARY KEY,
      customer_name VARCHAR NOT NULL,
      email VARCHAR,
      region_id INTEGER,
      region VARCHAR,
      country VARCHAR,
      city VARCHAR,
      customer_segment VARCHAR,
      loyalty_tier VARCHAR,
      signup_date DATE,
      channel VARCHAR
    );
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS country VARCHAR;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS city VARCHAR;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_segment VARCHAR;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_tier VARCHAR;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS channel VARCHAR;

    CREATE TABLE IF NOT EXISTS date_dim (
      date_key INTEGER PRIMARY KEY,
      full_date DATE NOT NULL,
      year INTEGER,
      quarter INTEGER,
      month INTEGER,
      day INTEGER,
      year_month VARCHAR,
      week_of_year INTEGER,
      day_of_week INTEGER,
      day_name VARCHAR,
      is_weekend BOOLEAN,
      is_holiday BOOLEAN,
      fiscal_year INTEGER,
      fiscal_quarter INTEGER
    );
    ALTER TABLE date_dim ADD COLUMN IF NOT EXISTS year_month VARCHAR;
    ALTER TABLE date_dim ADD COLUMN IF NOT EXISTS week_of_year INTEGER;
    ALTER TABLE date_dim ADD COLUMN IF NOT EXISTS day_of_week INTEGER;
    ALTER TABLE date_dim ADD COLUMN IF NOT EXISTS day_name VARCHAR;
    ALTER TABLE date_dim ADD COLUMN IF NOT EXISTS is_weekend BOOLEAN;
    ALTER TABLE date_dim ADD COLUMN IF NOT EXISTS is_holiday BOOLEAN;
    ALTER TABLE date_dim ADD COLUMN IF NOT EXISTS fiscal_year INTEGER;
    ALTER TABLE date_dim ADD COLUMN IF NOT EXISTS fiscal_quarter INTEGER;

    CREATE TABLE IF NOT EXISTS orders (
      order_id BIGINT PRIMARY KEY,
      customer_id BIGINT NOT NULL,
      order_date DATE NOT NULL,
      shipping_date DATE,
      delivery_date DATE,
      delivery_days INTEGER,
      region_id INTEGER NOT NULL,
      region VARCHAR,
      country VARCHAR,
      city VARCHAR,
      channel_id INTEGER,
      channel VARCHAR,
      customer_segment VARCHAR,
      status VARCHAR NOT NULL,
      payment_method VARCHAR,
      total_amount DOUBLE DEFAULT 0.0,
      discount_amount DOUBLE DEFAULT 0.0,
      shipping_fee DOUBLE DEFAULT 0.0,
      final_amount DOUBLE DEFAULT 0.0,
      cost_amount DOUBLE DEFAULT 0.0,
      profit DOUBLE DEFAULT 0.0,
      items_count INTEGER DEFAULT 0,
      source_file VARCHAR
    );
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_date DATE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date DATE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_days INTEGER;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id BIGINT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_date DATE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS region_id INTEGER;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS region VARCHAR;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS country VARCHAR;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS city VARCHAR;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel_id INTEGER;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel VARCHAR;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_segment VARCHAR;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount DOUBLE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DOUBLE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee DOUBLE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS final_amount DOUBLE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS cost_amount DOUBLE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS profit DOUBLE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS items_count INTEGER;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS source_file VARCHAR;

    CREATE TABLE IF NOT EXISTS order_items (
      item_id BIGINT PRIMARY KEY,
      order_id BIGINT NOT NULL,
      product_id BIGINT NOT NULL,
      category_id INTEGER,
      category VARCHAR,
      subcategory VARCHAR,
      brand VARCHAR,
      quantity INTEGER NOT NULL,
      unit_price DOUBLE NOT NULL,
      cost_price DOUBLE NOT NULL,
      amount DOUBLE NOT NULL,
      discount_rate DOUBLE NOT NULL,
      discount_amount DOUBLE NOT NULL,
      net_amount DOUBLE NOT NULL,
      cost_amount DOUBLE NOT NULL,
      profit DOUBLE NOT NULL,
      margin_rate DOUBLE NOT NULL
    );
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS category_id INTEGER;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS category VARCHAR;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS subcategory VARCHAR;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS brand VARCHAR;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_price DOUBLE;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount_rate DOUBLE;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount_amount DOUBLE;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS net_amount DOUBLE;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_amount DOUBLE;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS profit DOUBLE;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS margin_rate DOUBLE;

    CREATE TABLE IF NOT EXISTS transactions (
      tx_id BIGINT PRIMARY KEY,
      order_id BIGINT NOT NULL,
      amount DOUBLE NOT NULL,
      payment_method VARCHAR,
      status VARCHAR,
      fee DOUBLE,
      tx_date DATE
    );
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status VARCHAR;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fee DOUBLE;

    -- 1. Populate Regions (6 rows)
    INSERT INTO regions
    SELECT 1, 'North America', 'North America', 'US', 'NA' WHERE NOT EXISTS (SELECT 1 FROM regions WHERE region_id = 1);
    INSERT INTO regions
    SELECT 2, 'Europe', 'Europe', 'EU', 'EU' WHERE NOT EXISTS (SELECT 1 FROM regions WHERE region_id = 2);
    INSERT INTO regions
    SELECT 3, 'Asia Pacific', 'Asia Pacific', 'AP', 'APAC' WHERE NOT EXISTS (SELECT 1 FROM regions WHERE region_id = 3);
    INSERT INTO regions
    SELECT 4, 'South America', 'South America', 'SA', 'LATAM' WHERE NOT EXISTS (SELECT 1 FROM regions WHERE region_id = 4);
    INSERT INTO regions
    SELECT 5, 'Africa', 'Africa', 'AF', 'MEA' WHERE NOT EXISTS (SELECT 1 FROM regions WHERE region_id = 5);
    INSERT INTO regions
    SELECT 6, 'Middle East', 'Middle East', 'ME', 'MEA' WHERE NOT EXISTS (SELECT 1 FROM regions WHERE region_id = 6);

    -- 2. Populate Categories (6 rows)
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

    -- 3. Populate Customers (500 rows with country, city, segment, tier, channel)
    INSERT INTO customers
    SELECT 
      10000 + i AS customer_id,
      'Customer_' || i AS customer_name,
      'user_' || i || '@example.com' AS email,
      1 + CAST(i % 6 AS INTEGER) AS region_id,
      CASE CAST(i % 6 AS INTEGER)
        WHEN 0 THEN 'North America'
        WHEN 1 THEN 'Europe'
        WHEN 2 THEN 'Asia Pacific'
        WHEN 3 THEN 'South America'
        WHEN 4 THEN 'Africa'
        ELSE 'Middle East'
      END AS region,
      CASE CAST(i % 6 AS INTEGER)
        WHEN 0 THEN CASE WHEN i % 3 = 0 THEN 'Canada' ELSE 'United States' END
        WHEN 1 THEN ['Germany', 'United Kingdom', 'France'][1 + (i % 3)]
        WHEN 2 THEN ['Japan', 'China', 'Australia'][1 + (i % 3)]
        WHEN 3 THEN ['Brazil', 'Argentina', 'Chile'][1 + (i % 3)]
        WHEN 4 THEN ['South Africa', 'Egypt', 'Kenya'][1 + (i % 3)]
        ELSE ['UAE', 'Saudi Arabia', 'Qatar'][1 + (i % 3)]
      END AS country,
      CASE CAST(i % 6 AS INTEGER)
        WHEN 0 THEN ['New York', 'San Francisco', 'Chicago', 'Seattle', 'Toronto', 'Vancouver'][1 + (i % 6)]
        WHEN 1 THEN ['Berlin', 'Munich', 'London', 'Manchester', 'Paris', 'Lyon'][1 + (i % 6)]
        WHEN 2 THEN ['Tokyo', 'Osaka', 'Shanghai', 'Shenzhen', 'Sydney', 'Melbourne'][1 + (i % 6)]
        WHEN 3 THEN ['Sao Paulo', 'Rio de Janeiro', 'Buenos Aires', 'Santiago'][1 + (i % 4)]
        WHEN 4 THEN ['Johannesburg', 'Cape Town', 'Cairo', 'Nairobi'][1 + (i % 4)]
        ELSE ['Dubai', 'Abu Dhabi', 'Riyadh', 'Doha'][1 + (i % 4)]
      END AS city,
      CASE
        WHEN i % 10 = 0 THEN 'VIP Consumer'
        WHEN i % 10 = 1 THEN 'Enterprise'
        WHEN i % 10 IN (2, 3) THEN 'SMB'
        WHEN i % 10 >= 8 THEN 'New Customer'
        ELSE 'Standard Consumer'
      END AS customer_segment,
      CASE
        WHEN i % 10 = 0 THEN 'Platinum'
        WHEN i % 10 IN (1, 2) THEN 'Gold'
        WHEN i % 10 IN (3, 4, 5) THEN 'Silver'
        ELSE 'Bronze'
      END AS loyalty_tier,
      DATE '2022-01-01' + CAST((i * 3 % 730) AS INTEGER) * INTERVAL 1 DAY AS signup_date,
      ['Online Direct', 'Mobile App', 'Retail Partner', 'Corporate Sales'][1 + (i % 4)] AS channel
    FROM range(1, 501) t(i)
    WHERE NOT EXISTS (SELECT 1 FROM customers LIMIT 1);

    -- 4. Populate Products (100 rows with subcategory, brand, cost, margin, price tier)
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
      CASE CAST(i % 6 AS INTEGER)
        WHEN 0 THEN ['Smartphones', 'Laptops', 'Audio', 'Wearables'][1 + (i % 4)]
        WHEN 1 THEN ['Furniture', 'Kitchenware', 'Lighting', 'Bedding'][1 + (i % 4)]
        WHEN 2 THEN ['Menswear', 'Womenswear', 'Footwear', 'Outerwear'][1 + (i % 4)]
        WHEN 3 THEN ['Fitness Gear', 'Outdoor', 'Sportswear', 'Cycling'][1 + (i % 4)]
        WHEN 4 THEN ['Skincare', 'Fragrance', 'Haircare', 'Cosmetics'][1 + (i % 4)]
        ELSE ['Stationery', 'Pet Supplies', 'Travel Gear', 'Toys'][1 + (i % 4)]
      END AS subcategory,
      ['Apex', 'Stellar', 'Nova', 'Vertex', 'Prime', 'Pulse', 'Aura', 'Horizon'][1 + (i % 8)] AS brand,
      ROUND((15.0 + (i * 19 % 450) + (i % 7) * 8.5) * (0.50 + ((i % 5) * 0.05)), 2) AS cost_price,
      ROUND(15.0 + (i * 19 % 450) + (i % 7) * 8.5, 2) AS unit_price,
      ROUND((1.0 - (0.50 + ((i % 5) * 0.05))), 4) AS margin_rate,
      CASE
        WHEN (15.0 + (i * 19 % 450) + (i % 7) * 8.5) < 50 THEN 'Budget'
        WHEN (15.0 + (i * 19 % 450) + (i % 7) * 8.5) < 200 THEN 'Mid-Range'
        WHEN (15.0 + (i * 19 % 450) + (i % 7) * 8.5) < 400 THEN 'Premium'
        ELSE 'Flagship'
      END AS price_tier,
      CAST(20 + (i * 23 % 180) AS INTEGER) AS stock_qty
    FROM range(1, 101) t(i)
    WHERE NOT EXISTS (SELECT 1 FROM products LIMIT 1);

    -- 5. Populate Date Dimension (731 rows: full 2-year continuous temporal span 2023-2024 for YoY/MoM)
    INSERT INTO date_dim
    SELECT
      CAST(strftime(d, '%Y%m%d') AS INTEGER) AS date_key,
      d AS full_date,
      year(d) AS year,
      quarter(d) AS quarter,
      month(d) AS month,
      day(d) AS day,
      strftime(d, '%Y-%m') AS year_month,
      week(d) AS week_of_year,
      dayofweek(d) AS day_of_week,
      strftime(d, '%A') AS day_name,
      dayofweek(d) IN (0, 6) AS is_weekend,
      ((month(d) = 1 AND day(d) = 1) OR (month(d) = 12 AND day(d) = 25) OR (month(d) = 10 AND day(d) = 1) OR (month(d) = 5 AND day(d) = 1)) AS is_holiday,
      year(d) AS fiscal_year,
      quarter(d) AS fiscal_quarter
    FROM (
      SELECT DATE '2023-01-01' + i * INTERVAL 1 DAY AS d
      FROM range(0, 731) t(i)
    )
    WHERE NOT EXISTS (SELECT 1 FROM date_dim LIMIT 1);

    -- 6. Populate Orders (2000 rows across 2023 and 2024 with rich fulfillment & dimensions)
    INSERT INTO orders
    SELECT
      8760000 + i AS order_id,
      10001 + CAST((i * 17 % 495) AS BIGINT) AS customer_id,
      CASE
        WHEN i <= 800 THEN DATE '2023-01-01' + CAST(i * 364.0 / 800.0 AS INTEGER) * INTERVAL 1 DAY
        ELSE DATE '2024-01-01' + CAST((i - 800) * 365.0 / 1200.0 AS INTEGER) * INTERVAL 1 DAY
      END AS order_date,
      (CASE
        WHEN i <= 800 THEN DATE '2023-01-01' + CAST(i * 364.0 / 800.0 AS INTEGER) * INTERVAL 1 DAY
        ELSE DATE '2024-01-01' + CAST((i - 800) * 365.0 / 1200.0 AS INTEGER) * INTERVAL 1 DAY
      END) + (1 + (i % 2)) * INTERVAL 1 DAY AS shipping_date,
      (CASE
        WHEN i <= 800 THEN DATE '2023-01-01' + CAST(i * 364.0 / 800.0 AS INTEGER) * INTERVAL 1 DAY
        ELSE DATE '2024-01-01' + CAST((i - 800) * 365.0 / 1200.0 AS INTEGER) * INTERVAL 1 DAY
      END) + (2 + (i % 5)) * INTERVAL 1 DAY AS delivery_date,
      2 + (i % 5) AS delivery_days,
      1 + CAST((i * 7 % 6) AS INTEGER) AS region_id,
      CASE CAST((i * 7 % 6) AS INTEGER)
        WHEN 0 THEN 'North America'
        WHEN 1 THEN 'Europe'
        WHEN 2 THEN 'Asia Pacific'
        WHEN 3 THEN 'South America'
        WHEN 4 THEN 'Africa'
        ELSE 'Middle East'
      END AS region,
      CASE CAST((i * 7 % 6) AS INTEGER)
        WHEN 0 THEN CASE WHEN i % 3 = 0 THEN 'Canada' ELSE 'United States' END
        WHEN 1 THEN ['Germany', 'United Kingdom', 'France'][1 + (i % 3)]
        WHEN 2 THEN ['Japan', 'China', 'Australia'][1 + (i % 3)]
        WHEN 3 THEN ['Brazil', 'Argentina', 'Chile'][1 + (i % 3)]
        WHEN 4 THEN ['South Africa', 'Egypt', 'Kenya'][1 + (i % 3)]
        ELSE ['UAE', 'Saudi Arabia', 'Qatar'][1 + (i % 3)]
      END AS country,
      CASE CAST((i * 7 % 6) AS INTEGER)
        WHEN 0 THEN ['New York', 'San Francisco', 'Chicago', 'Seattle', 'Toronto', 'Vancouver'][1 + (i % 6)]
        WHEN 1 THEN ['Berlin', 'Munich', 'London', 'Manchester', 'Paris', 'Lyon'][1 + (i % 6)]
        WHEN 2 THEN ['Tokyo', 'Osaka', 'Shanghai', 'Shenzhen', 'Sydney', 'Melbourne'][1 + (i % 6)]
        WHEN 3 THEN ['Sao Paulo', 'Rio de Janeiro', 'Buenos Aires', 'Santiago'][1 + (i % 4)]
        WHEN 4 THEN ['Johannesburg', 'Cape Town', 'Cairo', 'Nairobi'][1 + (i % 4)]
        ELSE ['Dubai', 'Abu Dhabi', 'Riyadh', 'Doha'][1 + (i % 4)]
      END AS city,
      1 + (i % 4) AS channel_id,
      ['Online Direct', 'Mobile App', 'Retail Partner', 'Corporate Sales'][1 + (i % 4)] AS channel,
      CASE
        WHEN i % 10 = 0 THEN 'VIP Consumer'
        WHEN i % 10 = 1 THEN 'Enterprise'
        WHEN i % 10 IN (2, 3) THEN 'SMB'
        WHEN i % 10 >= 8 THEN 'New Customer'
        ELSE 'Standard Consumer'
      END AS customer_segment,
      CASE
        WHEN i % 35 = 0 THEN 'cancelled'
        WHEN i % 40 = 0 THEN 'refunded'
        WHEN i % 18 = 0 THEN 'pending'
        WHEN i % 8 = 0 THEN 'shipped'
        ELSE 'completed'
      END AS status,
      ['Credit Card', 'PayPal', 'Apple Pay', 'Wire Transfer'][1 + (i % 4)] AS payment_method,
      0.0 AS total_amount,
      0.0 AS discount_amount,
      0.0 AS shipping_fee,
      0.0 AS final_amount,
      0.0 AS cost_amount,
      0.0 AS profit,
      0 AS items_count,
      'orders_history.parquet' AS source_file
    FROM range(1, 2001) t(i)
    WHERE NOT EXISTS (SELECT 1 FROM orders LIMIT 1);

    -- 7. Populate Order Items (4000 rows with amount, net amount, cost, profit, margin rate)
    INSERT INTO order_items
    SELECT
      i AS item_id,
      8760000 + (1 + ((i - 1) % 2000)) AS order_id,
      101 + CAST((i * 31 % 99) AS BIGINT) AS product_id,
      1 + CAST((101 + (i * 31 % 99)) % 6 AS INTEGER) AS category_id,
      CASE CAST((101 + (i * 31 % 99)) % 6 AS INTEGER)
        WHEN 0 THEN 'Electronics'
        WHEN 1 THEN 'Home'
        WHEN 2 THEN 'Clothing'
        WHEN 3 THEN 'Sports'
        WHEN 4 THEN 'Beauty'
        ELSE 'Other'
      END AS category,
      CASE CAST((101 + (i * 31 % 99)) % 6 AS INTEGER)
        WHEN 0 THEN ['Smartphones', 'Laptops', 'Audio', 'Wearables'][1 + (i % 4)]
        WHEN 1 THEN ['Furniture', 'Kitchenware', 'Lighting', 'Bedding'][1 + (i % 4)]
        WHEN 2 THEN ['Menswear', 'Womenswear', 'Footwear', 'Outerwear'][1 + (i % 4)]
        WHEN 3 THEN ['Fitness Gear', 'Outdoor', 'Sportswear', 'Cycling'][1 + (i % 4)]
        WHEN 4 THEN ['Skincare', 'Fragrance', 'Haircare', 'Cosmetics'][1 + (i % 4)]
        ELSE ['Stationery', 'Pet Supplies', 'Travel Gear', 'Toys'][1 + (i % 4)]
      END AS subcategory,
      ['Apex', 'Stellar', 'Nova', 'Vertex', 'Prime', 'Pulse', 'Aura', 'Horizon'][1 + (i % 8)] AS brand,
      1 + ((i * 7) % 4) AS quantity,
      ROUND(15.0 + ((101 + (i * 31 % 99)) * 19 % 450) + ((101 + (i * 31 % 99)) % 7) * 8.5, 2) AS unit_price,
      ROUND((15.0 + ((101 + (i * 31 % 99)) * 19 % 450) + ((101 + (i * 31 % 99)) % 7) * 8.5) * (0.50 + (((101 + (i * 31 % 99)) % 5) * 0.05)), 2) AS cost_price,
      ROUND((1 + ((i * 7) % 4)) * (15.0 + ((101 + (i * 31 % 99)) * 19 % 450) + ((101 + (i * 31 % 99)) % 7) * 8.5), 2) AS amount,
      CASE WHEN i % 5 = 0 THEN 0.15 WHEN i % 7 = 0 THEN 0.10 WHEN i % 11 = 0 THEN 0.20 ELSE 0.0 END AS discount_rate,
      ROUND((1 + ((i * 7) % 4)) * (15.0 + ((101 + (i * 31 % 99)) * 19 % 450) + ((101 + (i * 31 % 99)) % 7) * 8.5) * (CASE WHEN i % 5 = 0 THEN 0.15 WHEN i % 7 = 0 THEN 0.10 WHEN i % 11 = 0 THEN 0.20 ELSE 0.0 END), 2) AS discount_amount,
      ROUND((1 + ((i * 7) % 4)) * (15.0 + ((101 + (i * 31 % 99)) * 19 % 450) + ((101 + (i * 31 % 99)) % 7) * 8.5) * (1.0 - (CASE WHEN i % 5 = 0 THEN 0.15 WHEN i % 7 = 0 THEN 0.10 WHEN i % 11 = 0 THEN 0.20 ELSE 0.0 END)), 2) AS net_amount,
      ROUND((1 + ((i * 7) % 4)) * (15.0 + ((101 + (i * 31 % 99)) * 19 % 450) + ((101 + (i * 31 % 99)) % 7) * 8.5) * (0.50 + (((101 + (i * 31 % 99)) % 5) * 0.05)), 2) AS cost_amount,
      ROUND(
        ((1 + ((i * 7) % 4)) * (15.0 + ((101 + (i * 31 % 99)) * 19 % 450) + ((101 + (i * 31 % 99)) % 7) * 8.5) * (1.0 - (CASE WHEN i % 5 = 0 THEN 0.15 WHEN i % 7 = 0 THEN 0.10 WHEN i % 11 = 0 THEN 0.20 ELSE 0.0 END)))
        - ((1 + ((i * 7) % 4)) * (15.0 + ((101 + (i * 31 % 99)) * 19 % 450) + ((101 + (i * 31 % 99)) % 7) * 8.5) * (0.50 + (((101 + (i * 31 % 99)) % 5) * 0.05))),
        2
      ) AS profit,
      ROUND(
        (
          ((1 + ((i * 7) % 4)) * (15.0 + ((101 + (i * 31 % 99)) * 19 % 450) + ((101 + (i * 31 % 99)) % 7) * 8.5) * (1.0 - (CASE WHEN i % 5 = 0 THEN 0.15 WHEN i % 7 = 0 THEN 0.10 WHEN i % 11 = 0 THEN 0.20 ELSE 0.0 END)))
          - ((1 + ((i * 7) % 4)) * (15.0 + ((101 + (i * 31 % 99)) * 19 % 450) + ((101 + (i * 31 % 99)) % 7) * 8.5) * (0.50 + (((101 + (i * 31 % 99)) % 5) * 0.05)))
        ) / NULLIF(((1 + ((i * 7) % 4)) * (15.0 + ((101 + (i * 31 % 99)) * 19 % 450) + ((101 + (i * 31 % 99)) % 7) * 8.5) * (1.0 - (CASE WHEN i % 5 = 0 THEN 0.15 WHEN i % 7 = 0 THEN 0.10 WHEN i % 11 = 0 THEN 0.20 ELSE 0.0 END))), 0),
        4
      ) AS margin_rate
    FROM range(1, 4001) t(i)
    WHERE NOT EXISTS (SELECT 1 FROM order_items LIMIT 1);

    -- 8. Aggregate order items amounts into orders
    UPDATE orders o
    SET
      total_amount = s.total_amt,
      discount_amount = s.discount_amt,
      shipping_fee = CASE WHEN s.net_amt >= 150.0 THEN 0.0 ELSE 12.0 END,
      final_amount = s.net_amt + (CASE WHEN s.net_amt >= 150.0 THEN 0.0 ELSE 12.0 END),
      cost_amount = s.cost_amt,
      profit = s.net_amt - s.cost_amt,
      items_count = s.cnt
    FROM (
      SELECT
        order_id,
        ROUND(SUM(amount), 2) AS total_amt,
        ROUND(SUM(discount_amount), 2) AS discount_amt,
        ROUND(SUM(net_amount), 2) AS net_amt,
        ROUND(SUM(cost_amount), 2) AS cost_amt,
        CAST(SUM(quantity) AS INTEGER) AS cnt
      FROM order_items
      GROUP BY order_id
    ) s
    WHERE o.order_id = s.order_id AND (o.final_amount IS NULL OR o.final_amount = 0.0);

    -- 9. Populate Transactions (2000 rows)
    INSERT INTO transactions
    SELECT
      100000 + r.i AS tx_id,
      o.order_id,
      COALESCE(o.final_amount, 88.0) AS amount,
      o.payment_method,
      CASE WHEN o.status = 'cancelled' THEN 'failed' WHEN o.status = 'refunded' THEN 'refunded' ELSE 'success' END AS status,
      ROUND(COALESCE(o.final_amount, 88.0) * 0.02, 2) AS fee,
      o.order_date AS tx_date
    FROM (SELECT i, 8760000 + i AS order_id FROM range(1, 2001) t(i)) r
    LEFT JOIN orders o ON r.order_id = o.order_id
    WHERE NOT EXISTS (SELECT 1 FROM transactions LIMIT 1);

    -- 10. Analytical Wide View: Unified Multi-Dimensional Fact View
    CREATE OR REPLACE VIEW v_analytics_order_details AS
    SELECT
      oi.item_id,
      oi.order_id,
      o.order_date,
      d.year,
      d.quarter,
      d.month,
      d.year_month,
      d.week_of_year,
      d.day_name,
      d.is_weekend,
      o.customer_id,
      c.customer_name,
      c.customer_segment,
      c.loyalty_tier,
      o.region_id,
      r.region,
      c.country,
      c.city,
      o.channel,
      o.status,
      o.payment_method,
      oi.product_id,
      p.product_name,
      p.category_id,
      p.category,
      p.subcategory,
      p.brand,
      p.price_tier,
      oi.quantity,
      oi.unit_price,
      oi.cost_price,
      oi.amount,
      oi.discount_rate,
      oi.discount_amount,
      oi.net_amount,
      oi.cost_amount,
      oi.profit,
      oi.margin_rate,
      o.delivery_days
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.order_id
    JOIN customers c ON o.customer_id = c.customer_id
    JOIN products p ON oi.product_id = p.product_id
    JOIN regions r ON o.region_id = r.region_id
    LEFT JOIN date_dim d ON o.order_date = d.full_date;

    -- 11. Analytical Mart View: Monthly Trend & YoY / MoM Summary
    CREATE OR REPLACE VIEW v_monthly_kpi_summary AS
    WITH monthly_agg AS (
      SELECT
        d.year,
        d.month,
        d.year_month,
        COUNT(DISTINCT o.order_id) AS total_orders,
        SUM(oi.quantity) AS total_units,
        ROUND(SUM(oi.net_amount), 2) AS total_revenue,
        ROUND(SUM(oi.cost_amount), 2) AS total_cost,
        ROUND(SUM(oi.profit), 2) AS total_profit,
        ROUND(SUM(oi.profit) / NULLIF(SUM(oi.net_amount), 0) * 100, 2) AS margin_rate_pct,
        ROUND(SUM(oi.net_amount) / NULLIF(COUNT(DISTINCT o.order_id), 0), 2) AS aov
      FROM orders o
      JOIN order_items oi ON o.order_id = oi.order_id
      JOIN date_dim d ON o.order_date = d.full_date
      WHERE o.status IN ('completed', 'shipped')
      GROUP BY d.year, d.month, d.year_month
    )
    SELECT
      year,
      month,
      year_month,
      total_orders,
      total_units,
      total_revenue,
      total_cost,
      total_profit,
      margin_rate_pct,
      aov,
      LAG(total_revenue, 1) OVER (ORDER BY year_month) AS mom_prior_revenue,
      ROUND((total_revenue - LAG(total_revenue, 1) OVER (ORDER BY year_month)) / NULLIF(LAG(total_revenue, 1) OVER (ORDER BY year_month), 0) * 100, 2) AS mom_growth_pct,
      LAG(total_revenue, 12) OVER (ORDER BY year_month) AS prior_year_revenue,
      ROUND((total_revenue - LAG(total_revenue, 12) OVER (ORDER BY year_month)) / NULLIF(LAG(total_revenue, 12) OVER (ORDER BY year_month), 0) * 100, 2) AS yoy_growth_rate
    FROM monthly_agg;

    -- 12. Analytical Mart View: Product Category & Brand Performance
    CREATE OR REPLACE VIEW v_category_performance AS
    SELECT
      p.category,
      p.subcategory,
      p.brand,
      COUNT(DISTINCT p.product_id) AS sku_count,
      SUM(oi.quantity) AS total_units_sold,
      ROUND(SUM(oi.net_amount), 2) AS total_revenue,
      ROUND(SUM(oi.cost_amount), 2) AS total_cost,
      ROUND(SUM(oi.profit), 2) AS gross_profit,
      ROUND(SUM(oi.profit) / NULLIF(SUM(oi.net_amount), 0) * 100, 2) AS margin_rate_pct
    FROM order_items oi
    JOIN products p ON oi.product_id = p.product_id
    JOIN orders o ON oi.order_id = o.order_id
    WHERE o.status IN ('completed', 'shipped')
    GROUP BY p.category, p.subcategory, p.brand;

    -- 13. Analytical Mart View: Sales Channel Conversion & Metrics
    CREATE OR REPLACE VIEW v_channel_performance AS
    SELECT
      o.channel,
      COUNT(DISTINCT o.order_id) AS total_orders,
      ROUND(SUM(oi.net_amount), 2) AS total_revenue,
      ROUND(SUM(oi.profit), 2) AS total_profit,
      ROUND(SUM(oi.profit) / NULLIF(SUM(oi.net_amount), 0) * 100, 2) AS margin_rate_pct,
      ROUND(SUM(oi.net_amount) / NULLIF(COUNT(DISTINCT o.order_id), 0), 2) AS aov,
      ROUND(COUNT(CASE WHEN o.status = 'completed' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 1) AS completion_rate_pct,
      ROUND(COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 1) AS cancellation_rate_pct
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    GROUP BY o.channel;

    -- 14. Analytical Mart View: Customer RFM Segmentation
    CREATE OR REPLACE VIEW v_customer_rfm_segments AS
    WITH base_rfm AS (
      SELECT
        c.customer_id,
        c.customer_name,
        c.customer_segment,
        c.loyalty_tier,
        c.region,
        c.country,
        c.city,
        c.channel AS acquisition_channel,
        DATE_DIFF('day', MAX(o.order_date), DATE '2024-12-31') AS recency_days,
        COUNT(DISTINCT o.order_id) AS frequency_orders,
        ROUND(SUM(oi.net_amount), 2) AS monetary_total,
        ROUND(SUM(oi.profit), 2) AS profit_total
      FROM customers c
      LEFT JOIN orders o ON c.customer_id = o.customer_id AND o.status IN ('completed', 'shipped')
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      GROUP BY c.customer_id, c.customer_name, c.customer_segment, c.loyalty_tier, c.region, c.country, c.city, c.channel
    )
    SELECT
      *,
      CASE
        WHEN frequency_orders >= 5 AND recency_days <= 60 THEN '核心高价值客户'
        WHEN frequency_orders >= 3 AND recency_days <= 90 THEN '成熟忠诚客户'
        WHEN frequency_orders = 1 AND recency_days <= 60 THEN '潜力新客'
        WHEN recency_days > 180 THEN '沉默流失客群'
        ELSE '大众普通客户'
      END AS rfm_tier
    FROM base_rfm;

    -- 15. Backward-Compatible Standard Views
    CREATE OR REPLACE VIEW daily_sales AS
    SELECT 
      o.order_date,
      COUNT(DISTINCT o.order_id) AS total_orders,
      ROUND(SUM(oi.net_amount), 2) AS total_revenue,
      ROUND(SUM(oi.profit), 2) AS total_profit,
      SUM(oi.quantity) AS units_sold,
      ROUND(SUM(oi.net_amount) / NULLIF(COUNT(DISTINCT o.order_id), 0), 2) AS aov
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    GROUP BY 1;

    CREATE OR REPLACE VIEW top_customers AS
    SELECT 
      c.customer_id,
      c.customer_name,
      COUNT(DISTINCT o.order_id) AS order_count,
      ROUND(SUM(oi.net_amount), 2) AS total_spent
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

    -- 16. Schema 'sales' & Tables
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

    -- 17. Schema 'dim' & Tables
    CREATE SCHEMA IF NOT EXISTS dim;

    CREATE TABLE IF NOT EXISTS dim.dim_customers AS
    SELECT customer_id, customer_name, email, region, country, city, customer_segment FROM customers;

    CREATE TABLE IF NOT EXISTS dim.dim_products AS
    SELECT product_id, product_name, category, subcategory, brand, unit_price, cost_price FROM products;

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
    SELECT full_date, year, month, quarter, year_month, is_weekend FROM dim.dim_dates;
  `;

  try {
    await duckDBService.query(seedSql);
  } catch (e) {
    console.warn('Demo data initialization query error (ignored):', e);
    // Allow a later ensure pass to retry after schema ALTER fixes
    seedPromise = null;
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

export function resetDemoSeedPromise(): void {
  seedPromise = null;
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
