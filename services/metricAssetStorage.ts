import { duckDBService } from './duckdbService';

export function activeAnalysisDatabase(): string {
  return duckDBService.getRuntimeInfo?.()?.currentDatabase || 'memory';
}

type Asset = { id: string; databaseName?: string };
export type AutomaticDismissal = Asset & { kind: 'package' | 'chart' | 'analysis' };
export function automaticDismissals(): AutomaticDismissal[] {
  return readMetricAssets<AutomaticDismissal>('duckdb_automatic_dismissals').filter(item => item.databaseName === activeAnalysisDatabase());
}
export function dismissAutomaticObject(kind: AutomaticDismissal['kind'], id: string): void {
  if (!id.includes('discovered:') && !id.includes('executive:')) return;
  const markers = automaticDismissals();
  if (!markers.some(item => item.kind === kind && item.id === id)) writeMetricAssets('duckdb_automatic_dismissals', [...markers, {kind,id}], 'duckdb-metrics-updated');
}
export function restoreAutomaticDismissals(items: AutomaticDismissal[]): void {
  writeMetricAssets('duckdb_automatic_dismissals', items, 'duckdb-metrics-updated');
}

const stockFormulas: Record<string, string> = {
  metric_demo_total_gmv: 'SUM(total_amount)',
  metric_demo_order_count: 'COUNT(order_id)',
  metric_demo_avg_order_value: 'AVG(total_amount)',
  metric_demo_paying_users: 'COUNT(DISTINCT customer_id)',
  metric_demo_daily_sales_trend: "SELECT date_trunc('day', order_date) AS day, SUM(total_amount) AS gmv FROM orders GROUP BY 1",
  metric_demo_high_value_ratio: 'COUNT(CASE WHEN total_amount >= 1000 THEN 1 END) * 1.0 / NULLIF(COUNT(*), 0)',
};

function isUneditedStockAsset(key: string, item: any): boolean {
  if (key === 'duckdb_metric_packages') {
    return item.id === 'pkg_official_demo_ecommerce'
      && item.name === '电商全域核心运营指标包 (官方全功能示例)'
      && item.metrics?.length === 6
      && item.updatedAt === item.createdAt
      && item.metrics.every((metric: any) => stockFormulas[metric.id] === metric.formula && !metric.history?.length);
  }
  if (key === 'duckdb_metric_charts') {
    if (item.updatedAt !== item.createdAt) return false;
    return (item.id === 'chart_demo_total_gmv'
      && item.sql === "SELECT date_trunc('day', order_date) AS order_date, SUM(total_amount) AS total_amount FROM orders GROUP BY 1;")
      || (item.id === 'chart_demo_order_count' && item.sql === 'SELECT COUNT(order_id) AS order_count FROM orders;');
  }
  return false;
}

/** Keep legacy data recoverable before assigning it to its first opened catalog. */
export function readMetricAssets<T extends Asset>(key: string): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Expected an asset array');
    const catalog = activeAnalysisDatabase();
    let changed = false;
    const assets = parsed.filter((item) => {
      const valid = item && typeof item.id === 'string' && !isUneditedStockAsset(key, item);
      if (!valid) changed = true;
      return valid;
    }).map((item) => {
      if (item.databaseName) return item;
      changed = true;
      return { ...item, databaseName: catalog };
    });
    if (changed) {
      if (!localStorage.getItem(`${key}_before_catalog_migration`)) {
        localStorage.setItem(`${key}_before_catalog_migration`, raw);
      }
      localStorage.setItem(key, JSON.stringify(assets));
    }
    return assets;
  } catch {
    if (!localStorage.getItem(`${key}_recovery`)) localStorage.setItem(`${key}_recovery`, raw);
    return [];
  }
}

export function writeMetricAssets<T extends Asset>(key: string, assets: T[], event: string): void {
  const catalog = activeAnalysisDatabase();
  const otherCatalogs = readMetricAssets<T>(key).filter((item) => item.databaseName !== catalog);
  localStorage.setItem(key, JSON.stringify([
    ...otherCatalogs,
    ...assets.map((item) => ({ ...item, databaseName: catalog })),
  ]));
  window.dispatchEvent(new CustomEvent(event));
}
