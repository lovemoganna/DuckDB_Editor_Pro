/**
 * Force-repair retail fact tables used by Analysis Home widgets.
 *
 * Ontology/benchmark stubs often create an `orders` table whose order_id space
 * does not match `order_items`, or that lacks region/status. Blind DROP+seed
 * then inserts seed IDs (8760000+) that still don't join. Rebuild orders FROM
 * distinct order_items.order_id instead.
 */

import { duckDBService } from './duckdbService';
import {
  resetDemoSeedPromise,
  seedDemoWorkbenchData,
} from '../components/Workbench/seedWorkbenchData';

async function tableColumns(name: string): Promise<string[]> {
  try {
    const cols = await duckDBService.getTableColumns(name);
    return (cols || []).map((c) => String(c).toLowerCase());
  } catch {
    return [];
  }
}

async function tableHasRows(name: string): Promise<boolean> {
  try {
    const res = await duckDBService.readQuery(
      `SELECT COUNT(*) AS c FROM "${name.replace(/"/g, '""')}"`,
    );
    return Number(res?.[0]?.c || 0) > 0;
  } catch {
    return false;
  }
}

async function countQuery(sql: string): Promise<number> {
  try {
    const res = await duckDBService.readQuery(sql);
    return Number(res?.[0]?.c || 0);
  } catch {
    return 0;
  }
}

async function dropRetailDependentViews(): Promise<void> {
  const views = [
    'daily_sales',
    'recent_orders',
    'order_summary',
    'top_customers',
    'v_analytics_order_details',
    'v_monthly_kpi_summary',
    'v_customer_rfm',
  ];
  for (const v of views) {
    try {
      await duckDBService.query(`DROP VIEW IF EXISTS ${v}`);
    } catch {
      /* ignore */
    }
  }
}

function ordersSchemaIncomplete(cols: string[]): boolean {
  if (cols.length === 0) return true;
  const required = ['order_id', 'order_date', 'status', 'region'];
  return !required.every((c) => cols.includes(c));
}

async function ordersJoinBroken(): Promise<boolean> {
  const items = await countQuery('SELECT COUNT(DISTINCT order_id) AS c FROM order_items');
  if (items === 0) return false;
  const joined = await countQuery(`
    SELECT COUNT(*) AS c
    FROM order_items oi
    JOIN orders o ON o.order_id = oi.order_id
    WHERE o.region IS NOT NULL
  `);
  return joined === 0;
}

async function ensureRegions(): Promise<boolean> {
  const tables = (await duckDBService.getTables()).map((t) => t.toLowerCase());
  if (tables.includes('regions') && (await tableHasRows('regions'))) return false;
  await duckDBService.query(`
    CREATE TABLE IF NOT EXISTS regions (
      region_id INTEGER PRIMARY KEY,
      region_name VARCHAR,
      region VARCHAR,
      country_code VARCHAR,
      region_code VARCHAR
    );
    INSERT INTO regions
    SELECT * FROM (VALUES
      (1, 'North America', 'North America', 'US', 'NA'),
      (2, 'Europe', 'Europe', 'EU', 'EU'),
      (3, 'Asia Pacific', 'Asia Pacific', 'AP', 'APAC'),
      (4, 'South America', 'South America', 'SA', 'LATAM'),
      (5, 'Africa', 'Africa', 'AF', 'MEA'),
      (6, 'Middle East', 'Middle East', 'ME', 'MEA')
    ) v(region_id, region_name, region, country_code, region_code)
    WHERE NOT EXISTS (SELECT 1 FROM regions LIMIT 1);
  `);
  return true;
}

async function backfillOrderItemCategories(): Promise<boolean> {
  await duckDBService.query(`
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS category_id INTEGER;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS category VARCHAR;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS category_label VARCHAR;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS quantity INTEGER;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS amount DOUBLE;
  `);

  const labeled = await countQuery(`
    SELECT COUNT(*) AS c FROM order_items
    WHERE category_label IS NOT NULL
      AND TRIM(CAST(category_label AS VARCHAR)) <> ''
      AND TRY_CAST(TRIM(CAST(category_label AS VARCHAR)) AS INTEGER) IS NULL
  `);
  if (labeled > 0) {
    // Still normalize quantity
    await duckDBService.query(`
      UPDATE order_items
      SET quantity = COALESCE(NULLIF(quantity, 0), 1)
      WHERE quantity IS NULL OR quantity <= 0;
    `);
    return false;
  }

  await duckDBService.query(`
    UPDATE order_items
    SET category_id = COALESCE(
      category_id,
      TRY_CAST(category AS INTEGER),
      1 + CAST((COALESCE(product_id, item_id, 1) % 6) AS INTEGER)
    )
    WHERE category_id IS NULL;
    UPDATE order_items
    SET category_label = CASE (ABS(COALESCE(category_id, 1)) % 6)
      WHEN 0 THEN 'Electronics'
      WHEN 1 THEN 'Home'
      WHEN 2 THEN 'Clothing'
      WHEN 3 THEN 'Sports'
      WHEN 4 THEN 'Beauty'
      ELSE 'Other'
    END;
    UPDATE order_items
    SET category = category_label
    WHERE typeof(category) = 'VARCHAR';
    UPDATE order_items
    SET quantity = COALESCE(NULLIF(quantity, 0), 1)
    WHERE quantity IS NULL OR quantity <= 0;
  `);
  return true;
}

/**
 * Rebuild orders so every order_items.order_id has a matching header row
 * with region / status / order_date for home charts.
 */
async function rebuildOrdersFromItems(): Promise<void> {
  await dropRetailDependentViews();
  await duckDBService.query(`DROP TABLE IF EXISTS orders`);
  await duckDBService.query(`
    CREATE TABLE orders AS
    SELECT
      d.order_id,
      10001 + CAST((HASH(d.order_id::VARCHAR) % 495) AS BIGINT) AS customer_id,
      DATE '2024-01-01'
        + CAST((HASH(d.order_id::VARCHAR) % 365) AS INTEGER) AS order_date,
      1 + CAST((HASH(d.order_id::VARCHAR || '-r') % 6) AS INTEGER) AS region_id,
      CASE CAST((HASH(d.order_id::VARCHAR || '-r') % 6) AS INTEGER)
        WHEN 0 THEN 'North America'
        WHEN 1 THEN 'Europe'
        WHEN 2 THEN 'Asia Pacific'
        WHEN 3 THEN 'South America'
        WHEN 4 THEN 'Africa'
        ELSE 'Middle East'
      END AS region,
      CASE CAST((HASH(d.order_id::VARCHAR || '-s') % 10) AS INTEGER)
        WHEN 0 THEN 'cancelled'
        WHEN 1 THEN 'refunded'
        WHEN 2 THEN 'pending'
        WHEN 3 THEN 'shipped'
        WHEN 4 THEN 'shipped'
        ELSE 'completed'
      END AS status,
      CASE CAST((HASH(d.order_id::VARCHAR || '-p') % 4) AS INTEGER)
        WHEN 0 THEN 'Credit Card'
        WHEN 1 THEN 'PayPal'
        WHEN 2 THEN 'Apple Pay'
        ELSE 'Wire Transfer'
      END AS payment_method,
      COALESCE(a.total_amount, 0) AS total_amount,
      COALESCE(a.items_count, 0) AS items_count
    FROM (SELECT DISTINCT order_id FROM order_items WHERE order_id IS NOT NULL) d
    LEFT JOIN (
      SELECT
        order_id,
        ROUND(SUM(COALESCE(amount, 0)), 2) AS total_amount,
        CAST(COUNT(*) AS INTEGER) AS items_count
      FROM order_items
      GROUP BY order_id
    ) a ON a.order_id = d.order_id;
  `);
}

async function ensureCustomers(): Promise<boolean> {
  const tables = (await duckDBService.getTables()).map((t) => t.toLowerCase());
  const hasOrders = tables.includes('orders') && (await tableHasRows('orders'));
  if (!hasOrders) return false;

  const customerCount = tables.includes('customers')
    ? await countQuery('SELECT COUNT(*) AS c FROM customers')
    : 0;
  const missing = await countQuery(`
    SELECT COUNT(*) AS c FROM (
      SELECT DISTINCT customer_id FROM orders WHERE customer_id IS NOT NULL
    ) o
    WHERE NOT EXISTS (
      SELECT 1 FROM customers c WHERE c.customer_id = o.customer_id
    )
  `).catch(async () => {
    // customers table missing
    return 1;
  });

  if (customerCount > 0 && missing === 0) return false;

  await duckDBService.query(`
    CREATE TABLE IF NOT EXISTS customers (
      customer_id BIGINT PRIMARY KEY,
      customer_name VARCHAR,
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
  `);

  // Wipe empty/stale dim and rebuild from orders so COUNT(*) matches reality
  if (customerCount === 0 || missing > 0) {
    try {
      await duckDBService.query('DELETE FROM customers');
    } catch {
      /* empty or missing ok */
    }
    await duckDBService.query(`
      INSERT INTO customers (
        customer_id, customer_name, email, region_id, region,
        country, city, customer_segment, loyalty_tier, signup_date, channel
      )
      SELECT
        o.customer_id,
        'Customer ' || o.customer_id,
        'c' || o.customer_id || '@example.com',
        o.region_id,
        o.region,
        'US',
        'City ' || (1 + CAST((HASH(o.customer_id::VARCHAR) % 20) AS INTEGER)),
        CASE CAST((HASH(o.customer_id::VARCHAR || '-seg') % 4) AS INTEGER)
          WHEN 0 THEN 'VIP Consumer'
          WHEN 1 THEN 'Enterprise'
          WHEN 2 THEN 'SMB'
          ELSE 'Standard Consumer'
        END,
        CASE CAST((HASH(o.customer_id::VARCHAR || '-loy') % 3) AS INTEGER)
          WHEN 0 THEN 'Gold'
          WHEN 1 THEN 'Silver'
          ELSE 'Bronze'
        END,
        DATE '2023-01-01' + CAST((HASH(o.customer_id::VARCHAR) % 600) AS INTEGER),
        CASE CAST((HASH(o.customer_id::VARCHAR || '-ch') % 4) AS INTEGER)
          WHEN 0 THEN 'Online Direct'
          WHEN 1 THEN 'Mobile App'
          WHEN 2 THEN 'Retail Partner'
          ELSE 'Corporate Sales'
        END
      FROM (
        SELECT DISTINCT customer_id, region_id, region
        FROM orders
        WHERE customer_id IS NOT NULL
      ) o;
    `);
    return true;
  }

  return false;
}

async function recreateDailySales(): Promise<boolean> {
  try {
    await duckDBService.query(`
      CREATE OR REPLACE VIEW daily_sales AS
      SELECT
        o.order_date,
        COUNT(DISTINCT o.order_id) AS total_orders,
        ROUND(SUM(COALESCE(oi.net_amount, oi.amount)), 2) AS total_revenue,
        ROUND(SUM(COALESCE(oi.profit, 0)), 2) AS total_profit,
        SUM(COALESCE(oi.quantity, 1)) AS units_sold,
        ROUND(
          SUM(COALESCE(oi.net_amount, oi.amount))
            / NULLIF(COUNT(DISTINCT o.order_id), 0),
          2
        ) AS aov
      FROM orders o
      JOIN order_items oi ON o.order_id = oi.order_id
      GROUP BY 1;
    `);
    return true;
  } catch (e) {
    console.warn('[repairHomeRetailTables] daily_sales recreate failed', e);
    return false;
  }
}

/**
 * Rebuild stub/incompatible retail tables so home default widgets can query them.
 * @returns true if any table was mutated
 */
export async function repairHomeRetailTables(): Promise<boolean> {
  const tables = await duckDBService.getTables();
  const lower = tables.map((t) => t.toLowerCase());
  let mutated = false;

  // No fact items at all → fall back to full demo seed
  if (!lower.includes('order_items') || !(await tableHasRows('order_items'))) {
    resetDemoSeedPromise();
    await seedDemoWorkbenchData();
    return true;
  }

  if (await backfillOrderItemCategories()) mutated = true;
  if (await ensureRegions()) mutated = true;

  const orderCols = lower.includes('orders') ? await tableColumns('orders') : [];
  const mustRebuildOrders =
    !lower.includes('orders') ||
    ordersSchemaIncomplete(orderCols) ||
    (await ordersJoinBroken());

  if (mustRebuildOrders) {
    await rebuildOrdersFromItems();
    mutated = true;
  }

  if (await ensureCustomers()) mutated = true;

  const tablesAfter = (await duckDBService.getTables()).map((t) => t.toLowerCase());
  if (!tablesAfter.includes('daily_sales') || mutated) {
    if (await recreateDailySales()) mutated = true;
  }

  return mutated;
}
