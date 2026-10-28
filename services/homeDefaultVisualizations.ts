/** Build homepage visualizations only from objects already in the active database. */

import { duckDBService } from './duckdbService';
import { dbService } from './dbService';
import { buildAnalyticalCatalog } from './analyticalCatalogService';
import {
  HOME_DASHBOARD_ID,
  HOME_DASHBOARD_NAME,
  enrichSavedQueryLineage,
  getOrCreateHomeDashboard,
} from './homeDashboardService';
import type { ChartConfig, ChartType, Dashboard, SavedQuery } from '../types';
import type { CoreMetricProposal } from '../types/analyticalCatalog';

/** Bump when default SQL/layout changes so existing boards get repaired. */
const DEFAULT_VIZ_FLAG = 'auto-defaults-v14';
const DEFAULT_QUERY_PREFIX = 'home-def-';

/** Core fact tables that make home analytics useful. */
const ANALYTICAL_MARKERS = ['orders', 'order_items', 'daily_sales', 'transactions'];

export interface EnsureHomeDefaultsResult {
  board: Dashboard;
  seededData: boolean;
  widgetsAdded: number;
  tableNames: string[];
}

/** In-flight dedupe — concurrent callers share one ensure pass. */
const ensureInflight = new Map<string, Promise<EnsureHomeDefaultsResult>>();

async function tableHasRows(name: string): Promise<boolean> {
  try {
    const res = await duckDBService.readQuery(`SELECT COUNT(*) AS c FROM "${name.replace(/"/g, '""')}"`);
    return Number(res?.[0]?.c || 0) > 0;
  } catch {
    return false;
  }
}

async function tableColumns(name: string): Promise<string[]> {
  try {
    const cols = await duckDBService.getTableColumns(name);
    return (cols || []).map((c) => c.toLowerCase());
  } catch {
    return [];
  }
}

/**
 * Detect stub / half-migrated retail schema that breaks home widgets:
 * e.g. empty `orders` with only order_id while order_items has revenue rows,
 * or orders missing region/status/order_date.
 */
async function retailSchemaIncomplete(tables: string[]): Promise<boolean> {
  const lower = tables.map((t) => t.toLowerCase());
  if (!lower.includes('order_items') || !(await tableHasRows('order_items'))) {
    return false;
  }
  if (!lower.includes('orders')) return true;
  if (!(await tableHasRows('orders'))) return true;

  const orderCols = await tableColumns('orders');
  const required = ['order_id', 'order_date', 'status'];
  if (!required.every((c) => orderCols.includes(c))) return true;
  if (!orderCols.includes('region') && !orderCols.includes('region_id')) return true;
  return false;
}

/**
 * Seed when workspace has no usable analytical data, or retail schema is a broken stub.
 */
async function workspaceNeedsSeed(tables: string[]): Promise<boolean> {
  if (!tables || tables.length === 0) return true;
  if (await retailSchemaIncomplete(tables)) return true;

  const lower = tables.map((t) => t.toLowerCase());
  const presentMarkers = ANALYTICAL_MARKERS.filter((m) => lower.includes(m));
  if (presentMarkers.length > 0) {
    for (const m of presentMarkers) {
      if (await tableHasRows(m)) return false;
    }
    return true;
  }
  for (const t of tables.slice(0, 8)) {
    if (await tableHasRows(t)) return false;
  }
  return true;
}

interface DefaultWidgetSpec {
  id: string;
  name: string;
  sql: string;
  widgetType: SavedQuery['widgetType'];
  chart?: ChartConfig;
  w: number;
  h: number;
  x: number;
  y: number;
}

/**
 * Curated defaults — prefer order_items denormalized dims so charts stay alive
 * even when products/orders stubs are incomplete; still work on full seed schema.
 */
function retailDefaultWidgets(): DefaultWidgetSpec[] {
  return [
    {
      id: 'home-def-kpi-revenue',
      name: '总营业额',
      sql: `SELECT ROUND(SUM(amount), 2) AS revenue FROM order_items;`,
      widgetType: 'value',
      chart: {
        id: 'def-kpi-revenue',
        title: '总营业额',
        type: 'counter',
        xKey: 'revenue',
        yKeys: ['revenue'],
        unit: '¥',
        yAxisLabel: '营业额',
        source: 'manual',
      },
      w: 3,
      h: 2,
      x: 0,
      y: 0,
    },
    {
      id: 'home-def-kpi-orders',
      name: '订单数',
      sql: `SELECT COUNT(DISTINCT order_id) AS order_count FROM order_items;`,
      widgetType: 'value',
      chart: {
        id: 'def-kpi-orders',
        title: '订单数',
        type: 'counter',
        xKey: 'order_count',
        yKeys: ['order_count'],
        unit: '笔',
        yAxisLabel: '订单数',
        source: 'manual',
      },
      w: 3,
      h: 2,
      x: 3,
      y: 0,
    },
    {
      id: 'home-def-kpi-aov',
      name: '客单价',
      sql: `SELECT ROUND(SUM(amount) / NULLIF(COUNT(DISTINCT order_id), 0), 2) AS aov
FROM order_items;`,
      widgetType: 'value',
      chart: {
        id: 'def-kpi-aov',
        title: '客单价',
        type: 'counter',
        xKey: 'aov',
        yKeys: ['aov'],
        unit: '¥',
        yAxisLabel: '客单价',
        source: 'manual',
      },
      w: 3,
      h: 2,
      x: 6,
      y: 0,
    },
    {
      id: 'home-def-kpi-customers',
      name: '客户数',
      sql: `SELECT COUNT(DISTINCT customer_id) AS customers FROM orders WHERE customer_id IS NOT NULL;`,
      widgetType: 'value',
      chart: {
        id: 'def-kpi-customers',
        title: '客户数',
        type: 'counter',
        xKey: 'customers',
        yKeys: ['customers'],
        unit: '人',
        yAxisLabel: '客户数',
        source: 'manual',
      },
      w: 3,
      h: 2,
      x: 9,
      y: 0,
    },
    {
      id: 'home-def-bar-region',
      name: '区域营业额',
      sql: `SELECT o.region AS region,
       ROUND(SUM(oi.amount), 2) AS revenue
FROM order_items oi
JOIN orders o ON o.order_id = oi.order_id
WHERE o.region IS NOT NULL
GROUP BY o.region
ORDER BY revenue DESC;`,
      widgetType: 'chart',
      chart: {
        id: 'def-bar-region',
        title: '区域营业额',
        type: 'bar',
        xKey: 'region',
        yKeys: ['revenue'],
        aggregation: 'none',
        unit: '¥',
        yAxisLabel: '营业额',
        xAxisLabel: '区域',
        showLegend: true,
        legendPosition: 'bottom',
        legendAlign: 'center',
        source: 'manual',
      },
      w: 6,
      h: 4,
      x: 0,
      y: 2,
    },
    {
      id: 'home-def-line-daily',
      name: '日销售额趋势',
      sql: `SELECT order_date,
       ROUND(total_revenue, 2) AS revenue,
       total_orders AS orders
FROM daily_sales
ORDER BY order_date
LIMIT 90;`,
      widgetType: 'chart',
      chart: {
        id: 'def-line-daily',
        title: '日销售额趋势',
        type: 'line',
        xKey: 'order_date',
        yKeys: ['revenue'],
        aggregation: 'none',
        unit: '¥',
        yAxisLabel: '销售额',
        xAxisLabel: '日期',
        showLegend: true,
        legendPosition: 'bottom',
        legendAlign: 'center',
        source: 'manual',
      },
      w: 6,
      h: 4,
      x: 6,
      y: 2,
    },
    {
      id: 'home-def-line-daily-units',
      name: '日销售量趋势',
      sql: `SELECT CAST(o.order_date AS DATE) AS order_date,
       CAST(SUM(COALESCE(oi.quantity, 1)) AS INTEGER) AS units
FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id
GROUP BY 1
ORDER BY 1
LIMIT 90;`,
      widgetType: 'chart',
      chart: {
        id: 'def-line-daily-units',
        title: '日销售量趋势',
        type: 'line',
        xKey: 'order_date',
        yKeys: ['units'],
        aggregation: 'none',
        unit: '件',
        yAxisLabel: '销售量',
        xAxisLabel: '日期',
        showLegend: true,
        legendPosition: 'bottom',
        legendAlign: 'center',
        source: 'manual',
      },
      w: 12,
      h: 4,
      x: 0,
      y: 6,
    },
    {
      id: 'home-def-bar-category',
      name: '品类销量',
      sql: `SELECT CAST(oi.category AS VARCHAR) AS category,
       SUM(COALESCE(oi.quantity, 1)) AS units,
       ROUND(SUM(COALESCE(oi.amount, 0)), 2) AS revenue
FROM order_items oi
WHERE oi.category IS NOT NULL
  AND TRIM(CAST(oi.category AS VARCHAR)) <> ''
  AND TRY_CAST(TRIM(CAST(oi.category AS VARCHAR)) AS INTEGER) IS NULL
GROUP BY 1
ORDER BY units DESC;`,
      widgetType: 'chart',
      chart: {
        id: 'def-bar-category',
        title: '品类销量',
        type: 'bar',
        xKey: 'category',
        yKeys: ['units'],
        aggregation: 'none',
        unit: '件',
        yAxisLabel: '销量',
        xAxisLabel: '品类',
        showLegend: true,
        legendPosition: 'bottom',
        legendAlign: 'center',
        source: 'manual',
      },
      w: 6,
      h: 4,
      x: 0,
      y: 10,
    },
    {
      id: 'home-def-status',
      name: '订单状态分布',
      sql: `SELECT COALESCE(status, 'unknown') AS status, COUNT(*) AS order_count
FROM orders
GROUP BY 1
ORDER BY order_count DESC;`,
      widgetType: 'chart',
      chart: {
        id: 'def-doughnut-status',
        title: '订单状态分布',
        type: 'doughnut',
        xKey: 'status',
        yKeys: ['order_count'],
        showValues: true,
        labelMode: 'auto',
        unit: '笔',
        yAxisLabel: '订单数',
        showLegend: true,
        legendPosition: 'bottom',
        legendAlign: 'center',
        source: 'manual',
      },
      w: 6,
      h: 4,
      x: 6,
      y: 10,
    },
    {
      id: 'home-def-tbl-top-orders',
      name: '高价值订单明细',
      sql: `SELECT
  o.order_id,
  strftime(o.order_date, '%Y-%m-%d') AS order_date,
  o.region,
  o.status,
  COALESCE(CAST(oi.category AS VARCHAR), 'Other') AS category,
  CAST(SUM(COALESCE(oi.quantity, 1)) AS INTEGER) AS units,
  ROUND(SUM(COALESCE(oi.amount, 0)), 2) AS revenue
FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id
GROUP BY o.order_id, o.order_date, o.region, o.status, 5
ORDER BY revenue DESC
LIMIT 40;`,
      widgetType: 'table',
      w: 12,
      h: 5,
      x: 0,
      y: 14,
    },
  ];
}

function chartFromMetric(m: CoreMetricProposal): {
  chart: ChartConfig;
  widgetType: SavedQuery['widgetType'];
  w: number;
  h: number;
} {
  if (!m.measureColumn || (!m.timeDimension && m.categoryDimensions.length === 0)) {
    return {
      widgetType: 'value',
      w: 3,
      h: 2,
      chart: {
        id: `c-${m.id}`,
        title: m.name,
        type: 'counter',
        xKey: 'metric_value',
        yKeys: ['metric_value'],
        unit: m.aggregation === 'count' ? '行' : '',
        source: 'manual',
      },
    };
  }
  const xKey = m.timeDimension || m.categoryDimensions[0] || 'metric_value';
  const type: ChartType = m.timeDimension ? 'line' : 'bar';
  return {
    widgetType: 'chart',
    w: 6,
    h: 3,
    chart: {
      id: `c-${m.id}`,
      title: m.name,
      type,
      xKey,
      yKeys: ['metric_value'],
      unit: m.aggregation === 'count' ? '行' : '',
      groupBy: m.timeDimension ? m.categoryDimensions[0] : undefined,
      aggregation: 'none',
      showLegend: Boolean(m.timeDimension && m.categoryDimensions[0]),
      source: 'manual',
    },
  };
}

async function catalogFallbackWidgets(tables: string[]): Promise<DefaultWidgetSpec[]> {
  try {
    const catalog = await buildAnalyticalCatalog(tables);
    const specs: DefaultWidgetSpec[] = [];
    let x = 0;
    let y = 0;
    let rowHeight = 0;
    const picks = [
      ...catalog.coreMetrics.filter((m) => m.measureColumn).slice(0, 4),
      ...catalog.coreMetrics.filter((m) => !m.measureColumn).slice(0, 2),
    ].slice(0, 6);

    for (const m of picks) {
      const { chart, widgetType, w, h } = chartFromMetric(m);
      if (x + w > 12) {
        x = 0;
        y += rowHeight;
        rowHeight = 0;
      }
      specs.push({
        id: `home-auto-${m.id}`,
        name: m.name,
        sql: m.sql.replace(/;\s*$/, ''),
        widgetType,
        chart,
        w,
        h,
        x,
        y,
      });
      x += w;
      rowHeight = Math.max(rowHeight, h);
    }
    return specs;
  } catch {
    return [];
  }
}

async function upsertDefaultQuery(spec: DefaultWidgetSpec): Promise<void> {
  const existingQueries = await dbService.getQueries();
  const prev = existingQueries.find((s) => s.id === spec.id);
  const q = enrichSavedQueryLineage({
    id: spec.id,
    name: spec.name,
    sql: spec.sql,
    createdAt: prev?.createdAt ?? Date.now(),
    pinned: true,
    widgetType: spec.widgetType,
    charts: spec.chart ? [spec.chart] : undefined,
  });
  await dbService.saveQuery(q);
}

async function persistWidgets(
  specs: DefaultWidgetSpec[],
  options: { replaceAutoDefaults?: boolean; emitUpdateEvent?: boolean } = {},
): Promise<number> {
  let board = await getOrCreateHomeDashboard();
  const replace = options.replaceAutoDefaults === true;
  // Default silent: ensure() callers already refresh UI; emitting would re-enter ensure → toast loop
  const emitUpdateEvent = options.emitUpdateEvent === true;

  let items = replace
    ? board.items.filter((i) => !String(i.savedQueryId || '').startsWith(DEFAULT_QUERY_PREFIX) && !String(i.savedQueryId || '').startsWith('home-auto-'))
    : [...board.items];

  let added = 0;
  const baseY = replace ? items.reduce((bottom, item) => Math.max(bottom, item.y + item.h), 0) : 0;

  for (const spec of specs) {
    await upsertDefaultQuery(spec);

    const existingIdx = items.findIndex((i) => i.savedQueryId === spec.id);
    if (existingIdx >= 0) {
      continue;
    }

    items.push({
      i: `w-${spec.id}`,
      savedQueryId: spec.id,
      x: spec.x,
      y: spec.y + baseY,
      w: spec.w,
      h: spec.h,
    });
    added += 1;
  }

  board = {
    ...board,
    id: board.id || HOME_DASHBOARD_ID,
    name: board.name || HOME_DASHBOARD_NAME,
    databaseName: board.databaseName,
    items,
    template: DEFAULT_VIZ_FLAG,
    layoutLocked: board.layoutLocked ?? true,
    updatedAt: Date.now(),
  };
  await dbService.saveDashboard(board);
  if (emitUpdateEvent && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('duckdb-home-dashboard-updated'));
  }

  return added;
}

async function runEnsureHomeDefaultVisualizations(
  _currentTables: string[] = [],
): Promise<EnsureHomeDefaultsResult> {
  // A database is an independent domain. Opening its homepage must never
  // populate it with demo tables or modify an existing retail schema.
  const tables = await duckDBService.getTables();
  const seededData = false;

  let board = await getOrCreateHomeDashboard();
  let widgetsAdded = 0;

  // Compatibility for generated metrics saved before the engine standardized its
  // output column. Preserve user-authored queries and chart configuration.
  const catalog = (await duckDBService.getCurrentCatalogAndSchema()).catalog;
  for (const query of await dbService.getQueries(catalog)) {
    if (query.id.startsWith('home-auto-') && query.charts?.some((chart) => chart.yKeys.includes('metric_value'))
      && /^SELECT\s+COUNT\(\*\)\s+AS\s+row_count\b/i.test(query.sql.trim())) {
      await dbService.saveQuery({ ...query, databaseName: catalog,
        sql: query.sql.replace(/\bAS\s+row_count\b/i, 'AS metric_value') });
    }
  }

  const lower = tables.map((t) => t.toLowerCase());
  const canUseRetail = ['orders', 'order_items', 'products', 'customers'].every((t) =>
    lower.includes(t),
  );

  const needsFill = board.items.length === 0 && !board.template;
  // Repair after seed/table repair or when template flag is stale
  const needsRepair =
    board.items.length > 0 && Boolean(board.template?.startsWith('auto-defaults-')) && board.template !== DEFAULT_VIZ_FLAG;

  if (needsFill || needsRepair) {
    let specs: DefaultWidgetSpec[] = [];
    if (canUseRetail) {
      specs = retailDefaultWidgets();
      if (!lower.includes('daily_sales')) {
        specs = specs.filter((s) => s.id !== 'home-def-line-daily');
      }
      const orderCols = lower.includes('orders') ? await tableColumns('orders') : [];
      if (
        !orderCols.includes('region') &&
        !orderCols.includes('region_id') &&
        !lower.includes('regions')
      ) {
        specs = specs.filter((s) => s.id !== 'home-def-bar-region');
      }
    } else {
      specs = await catalogFallbackWidgets(tables);
    }

    // Table names alone cannot prove a retail schema supports a template.
    // Bind every proposed query against live columns before publishing it.
    const validSpecs: DefaultWidgetSpec[] = [];
    for (const spec of specs) {
      try {
        await duckDBService.query(`EXPLAIN ${spec.sql.replace(/;\s*$/, '')}`);
        validSpecs.push(spec);
      } catch { /* unavailable columns are not published as dead widgets */ }
    }
    specs = validSpecs;
    if (!specs.length && tables.length) {
      for (const spec of await catalogFallbackWidgets(tables)) {
        try {
          await duckDBService.query(`EXPLAIN ${spec.sql.replace(/;\s*$/, '')}`);
          specs.push(spec);
        } catch { /* keep an honest empty board when no query can bind */ }
      }
    }

    if (specs.length > 0 || needsRepair) {
      const added = await persistWidgets(specs, {
        replaceAutoDefaults: needsRepair || needsFill,
      });
      widgetsAdded = needsRepair ? Math.max(added, specs.length) : added;
      board = await getOrCreateHomeDashboard();
    }
  }

  return { board, seededData, widgetsAdded, tableNames: tables };
}

/** Ensure the active database has a board; never create data as a side effect. */
export async function ensureHomeDefaultVisualizations(
  currentTables: string[] = [],
): Promise<EnsureHomeDefaultsResult> {
  const catalog = (await duckDBService.getCurrentCatalogAndSchema()).catalog;
  const existing = ensureInflight.get(catalog);
  if (existing) return existing;
  const operation = runEnsureHomeDefaultVisualizations(currentTables).finally(() => {
    ensureInflight.delete(catalog);
  });
  ensureInflight.set(catalog, operation);
  return operation;
}
