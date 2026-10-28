import { dbService } from './dbService';
import { duckDBService } from './duckdbService';
import { requireAnalysisQuery } from './analysis/readQuery';
import { saveObjectReference } from './analysisObjects';
import type { AnalysisObject } from './analysisObjects';
import {
  extractSchemasFromSql,
  extractTablesFromSql,
  computeVizHint,
} from './queryVizHint';
import type { Dashboard, DashboardItem, SavedQuery, ChartConfig, VizHint, MetricChart } from '../types';

export const HOME_DASHBOARD_ID = 'home-default-board';
export const HOME_DASHBOARD_NAME = '分析首页';

export function homeDashboardIdForCatalog(catalog: string): string {
  const safe = (catalog || 'memory').trim() || 'memory';
  return `${HOME_DASHBOARD_ID}::${safe}`;
}

export function enrichSavedQueryLineage(query: SavedQuery): SavedQuery {
  const referencedTables = query.referencedTables?.length
    ? query.referencedTables
    : extractTablesFromSql(query.sql);
  const referencedSchemas = query.referencedSchemas?.length
    ? query.referencedSchemas
    : extractSchemasFromSql(query.sql);
  const vizHint: VizHint =
    query.vizHint ||
    computeVizHint({
      rowCount: query.lastResultMeta?.rowCount,
      columns: query.lastResultMeta?.columns,
      hasChart: Boolean(query.charts?.length),
    });
  return { ...query, referencedTables, referencedSchemas, vizHint };
}

async function resolveActiveCatalog(): Promise<string> {
  try {
    const info = duckDBService.getRuntimeInfo?.();
    if (info?.ready && info.currentDatabase) {
      return info.currentDatabase;
    }
    if (!info?.ready) return 'memory';
    const ctx = await duckDBService.getCurrentCatalogAndSchema();
    return ctx.catalog || 'memory';
  } catch {
    return 'memory';
  }
}

export async function getOrCreateHomeDashboard(): Promise<Dashboard> {
  const catalog = await resolveActiveCatalog();
  const homeId = homeDashboardIdForCatalog(catalog);
  const all = await dbService.getDashboards(catalog);
  const selected = await dbService.getDomainSetting<string>('active-home-view', catalog);
  const issues = dbService.getDashboardReadIssues?.(catalog) || [];
  if (selected && issues.some(issue => issue.id === selected)) throw new Error('当前视图配置无法读取，原记录已保留；请从视图列表选择其他视图');

  const existing =
    all.find((d: Dashboard) => d.id === selected) ||
    all.find((d: Dashboard) => d.id === homeId) ||
    // Legacy unscoped home board — only adopt when on memory catalog
    (catalog === 'memory'
      ? all.find((d: Dashboard) => d.id === HOME_DASHBOARD_ID && !d.databaseName)
      : undefined);

  if (existing) {
    // Migrate legacy board into catalog-scoped id when needed
    if (existing.id === HOME_DASHBOARD_ID && !existing.databaseName && catalog === 'memory') {
      const migrated: Dashboard = {
        ...existing,
        id: homeId,
        databaseName: catalog,
        updatedAt: Date.now(),
      };
      await dbService.saveDashboard(migrated);
      return migrated;
    }
    if (!existing.databaseName || existing.databaseName !== catalog) {
      const scoped: Dashboard = {
        ...existing,
        id: existing.id.includes('::') ? existing.id : homeId,
        databaseName: catalog,
        updatedAt: Date.now(),
      };
      await dbService.saveDashboard(scoped);
      return scoped;
    }
    return existing;
  }

  if (issues.some(issue => issue.id === homeId)) throw new Error('默认视图配置无法读取，原记录已保留；请从视图列表选择其他视图');
  const now = Date.now();
  const board: Dashboard = {
    id: homeId,
    name: HOME_DASHBOARD_NAME,
    description: `数据库「${catalog}」的可视化与 KPI`,
    items: [],
    createdAt: now,
    updatedAt: now,
    layoutLocked: true,
    databaseName: catalog,
  };
  await dbService.saveDashboard(board);
  return board;
}

function nextGridSlot(items: DashboardItem[]): { x: number; y: number; w: number; h: number } {
  if (items.length === 0) return { x: 0, y: 0, w: 6, h: 7 };
  const maxY = Math.max(...items.map((i) => i.y + i.h));
  const rowItems = items.filter((i) => i.y + i.h >= maxY);
  const usedX = rowItems.reduce((acc, i) => Math.max(acc, i.x + i.w), 0);
  if (usedX + 6 <= 12) return { x: usedX, y: maxY - (rowItems[0]?.h || 5), w: 6, h: 7 };
  return { x: 0, y: maxY, w: 6, h: 7 };
}

export async function addSavedQueryToHomeBoard(
  savedQueryId: string,
  opts?: { w?: number; h?: number },
): Promise<Dashboard> {
  const board = await getOrCreateHomeDashboard();
  if (board.items.some((i) => i.savedQueryId === savedQueryId)) {
    return board;
  }
  const slot = nextGridSlot(board.items);
  const item: DashboardItem = {
    i: `w-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedQueryId,
    x: slot.x,
    y: slot.y,
    w: opts?.w ?? slot.w,
    h: opts?.h ?? slot.h,
  };
  const updated = await dbService.updateDashboard(board.id, board.databaseName!, current => {
    if (current.items.some(i => i.savedQueryId === savedQueryId)) return current;
    return { ...current, items: [...current.items, { ...item, ...nextGridSlot(current.items), w: opts?.w ?? slot.w, h: opts?.h ?? slot.h }] };
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('duckdb-home-dashboard-updated'));
  }
  return updated;
}

export async function createWidgetFromSql(params: {
  databaseName?: string;
  name: string;
  sql: string;
  widgetType?: SavedQuery['widgetType'];
  chartConfig?: ChartConfig;
  rowCount?: number;
  columns?: string[];
  addToBoard?: boolean;
  metricChartId?: string;
}): Promise<{ query: SavedQuery; board?: Dashboard }> {
  const referencedTables = extractTablesFromSql(params.sql);
  const referencedSchemas = extractSchemasFromSql(params.sql);
  const vizHint = computeVizHint({
    rowCount: params.rowCount,
    columns: params.columns,
    hasChart: Boolean(params.chartConfig),
  });

  const query: SavedQuery = enrichSavedQueryLineage({
    id: `sq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    databaseName: params.databaseName,
    name: params.name,
    sql: params.sql,
    createdAt: Date.now(),
    widgetType: params.widgetType || (params.chartConfig ? 'chart' : 'table'),
    charts: params.chartConfig ? [params.chartConfig] : undefined,
    referencedTables,
    referencedSchemas,
    lastResultMeta: {
      rowCount: params.rowCount,
      columns: params.columns,
      ranAt: Date.now(),
    },
    vizHint,
    pinned: true,
    metricChartId: params.metricChartId,
  });

  await dbService.saveQuery(query);

  let board: Dashboard | undefined;
  if (params.addToBoard !== false) {
    board = await addSavedQueryToHomeBoard(query.id, {
      w: query.widgetType === 'value' ? 4 : 6,
      h: query.widgetType === 'value' ? 3 : 7,
    });
  }

  return { query, board };
}

export async function addObjectToDashboard(object: Pick<AnalysisObject, 'kind' | 'id' | 'name' | 'chartConfig'>, target?: Dashboard): Promise<Dashboard> {
  const board = target || await getOrCreateHomeDashboard();
  const query = await saveObjectReference(object, board.databaseName!);
  const updated = await dbService.updateDashboard(board.id, board.databaseName!, current => ({ ...current, items: [...current.items, {
    i: crypto.randomUUID(), savedQueryId: query.id, ...nextGridSlot(current.items),
    ...(['counter', 'kpi'].includes(object.chartConfig?.type || '') ? { w: 3, h: 3 } : {}),
  }] }));
  window.dispatchEvent(new CustomEvent('duckdb-home-dashboard-updated'));
  return updated;
}

export async function createHomeView(name: string): Promise<Dashboard> {
  const catalog = await resolveActiveCatalog();
  if (!name.trim()) throw new Error('请输入视图名称');
  const now = Date.now();
  const board: Dashboard = { id: `view:${crypto.randomUUID()}`, name: name.trim(), databaseName: catalog,
    items: [], createdAt: now, updatedAt: now, layoutLocked: false };
  await dbService.saveDashboard(board);
  await dbService.saveDomainSetting('active-home-view', board.id, catalog);
  window.dispatchEvent(new CustomEvent('duckdb-home-dashboard-updated'));
  return board;
}

export async function selectHomeView(id: string, catalog: string): Promise<void> {
  const board = (await dbService.getDashboards(catalog)).find((board: Dashboard) => board.id === id);
  if (!board) throw new Error('此工作台视图不存在');
  await dbService.saveDomainSetting('active-home-view', id, catalog);
  window.dispatchEvent(new CustomEvent('duckdb-home-dashboard-updated'));
}

export async function loadHomePinnedChartIds(): Promise<Set<string>> {
  const board = await getOrCreateHomeDashboard();
  const queries = await dbService.getQueries(board.databaseName);
  const queryIds = new Set(board.items.map((item) => item.savedQueryId));
  return new Set(queries.filter((query) => queryIds.has(query.id)).flatMap((query) =>
    query.analysisRef?.kind === 'chart' ? [query.analysisRef.id] : query.metricChartId ? [query.metricChartId] : (query.charts || []).map((config) => `saved:${query.id}:${config.id}`),
  ));
}

/** Pin the original query when present, otherwise create one linked copy. */
export async function pinChartToHome(chart: MetricChart): Promise<string> {
  const board = await getOrCreateHomeDashboard();
  if (chart.databaseName && chart.databaseName !== board.databaseName) {
    throw new Error('图表所属数据库与当前首页不一致');
  }
  if (!chart.savedQueryId) {
    const previous = (await dbService.getQueries(board.databaseName)).find(query => query.metricChartId === chart.id);
    if (previous) {
      await dbService.saveQuery({ ...previous, analysisRef: {kind:'chart',id:chart.id}, sql: '', charts: undefined });
      await addSavedQueryToHomeBoard(previous.id);
      return previous.id;
    }
    const query = await saveObjectReference({ kind: 'chart', id: chart.id, name: chart.metricName }, board.databaseName!);
    await addSavedQueryToHomeBoard(query.id);
    return query.id;
  }
  const queries = await dbService.getQueries(board.databaseName);
  const existing = queries.find((query) => chart.savedQueryId
    ? query.id === chart.savedQueryId : query.metricChartId === chart.id);
  if (existing) {
    if (!chart.savedQueryId) {
      await dbService.saveQuery({ ...existing, name: chart.chartConfig.title || chart.metricName,
        sql: chart.sql, charts: [chart.chartConfig], databaseName: board.databaseName, pinned: true });
    }
    await addSavedQueryToHomeBoard(existing.id);
    return existing.id;
  }
  const { query } = await createWidgetFromSql({
    name: chart.chartConfig.title || chart.metricName, sql: chart.sql,
    chartConfig: chart.chartConfig, metricChartId: chart.id,
  });
  return query.id;
}

export async function unpinChartFromHome(chart: MetricChart): Promise<void> {
  const board = await getOrCreateHomeDashboard();
  const queries = await dbService.getQueries(board.databaseName);
  const linked = new Set(queries.filter((query) => chart.savedQueryId
    ? query.id === chart.savedQueryId : query.metricChartId === chart.id || (query.analysisRef?.kind === 'chart' && query.analysisRef.id === chart.id)).map((query) => query.id));
  const items = board.items.filter((item) => !linked.has(item.savedQueryId));
  if (items.length === board.items.length) return;
  await dbService.updateDashboard(board.id, board.databaseName!, current => ({ ...current, items: current.items.filter(item => !linked.has(item.savedQueryId)) }));
  window.dispatchEvent(new CustomEvent('duckdb-home-dashboard-updated'));
}

export async function syncLinkedChart(chart: MetricChart): Promise<void> {
  const queries = await dbService.getQueries(chart.databaseName);
  const normalizedSql = (sql: string) => {
    try { return requireAnalysisQuery(sql).trim(); } catch { return sql.trim(); }
  };
  for (const query of queries.filter((item) => item.metricChartId === chart.id
    || (!item.metricChartId && item.id.startsWith('home-auto-') && normalizedSql(item.sql) === normalizedSql(chart.sql)))) {
    await dbService.saveQuery(enrichSavedQueryLineage({
      ...query, metricChartId: chart.id, name: chart.chartConfig.title || chart.metricName,
      sql: chart.sql, charts: [chart.chartConfig], referencedTables: [], referencedSchemas: [],
    }));
  }
  window.dispatchEvent(new CustomEvent('duckdb-home-dashboard-updated'));
}

export function applyBoardParams(sql: string, params: Record<string, string>): string {
  if (!sql || !params || Object.keys(params).length === 0) return sql;
  return sql.replace(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g, (_m, key: string) => {
    const v = params[key];
    if (v == null || v === '') return _m;
    // Escape single quotes for SQL string safety when value looks non-numeric
    if (/^-?\d+(\.\d+)?$/.test(v)) return v;
    return `'${String(v).replace(/'/g, "''")}'`;
  });
}
