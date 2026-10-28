import { getOrCreateHomeDashboard } from './homeDashboardService';
import { refreshDatabaseAnalysis } from './databaseAnalysis';
import { type AnalysisObject } from './analysisObjects';
import { activeAnalysisDatabase } from './metricAssetStorage';

/** Discovery updates the object library; only explicit user actions populate Home. */
export async function ensureDynamicHome() {
  const database = activeAnalysisDatabase();
  const model = await refreshDatabaseAnalysis();
  if (activeAnalysisDatabase() !== database) throw new Error('数据库已切换，请重试');
  const board = await getOrCreateHomeDashboard();
  if (activeAnalysisDatabase() !== database || (board.databaseName && board.databaseName !== database)) throw new Error('数据库已切换，请重试');
  return { board, widgetsAdded: 0, tableNames: model.tables.map(table => table.tableName) };
}

/** Saved definitions first; unknown business meaning falls back to descriptive results. */
export function selectInitialHomeObjects(objects: AnalysisObject[], tables: string[]) {
  const candidates = objects.filter(object => object.kind === 'metric' && !object.unavailableReason);
  const defined = candidates.filter(object => !object.id.startsWith('discovered:') && !object.id.endsWith(':quality') && !object.id.endsWith(':rates'));
  if (defined.length) return defined.slice(0, 6);
  const seed = tables.find(table => candidates.some(object => object.id.includes(`:${table}:`) && !object.id.endsWith(':count')));
  if (!seed) return [];
  const group = candidates.filter(object => object.id.includes(`:${seed}:`));
  return group.filter(object => !object.id.endsWith(':count') && !object.id.includes(':sum:')).slice(0, 6);
}
