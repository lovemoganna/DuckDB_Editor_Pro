import { duckDBService } from './duckdbService';
import { dbService } from './dbService';
import { metricAnalyzer } from './metricAnalyzer';
import { saveObjectReference } from './analysisObjects';
import { selectHomeView } from './homeDashboardService';
import type { Dashboard } from '../types';

/** A saved starting arrangement of original objects, never a separately rendered dashboard. */
export async function openExecutiveWorkspace(): Promise<Dashboard> {
  const { catalog, schema } = await duckDBService.getCurrentCatalogAndSchema();
  const pkg = metricAnalyzer.getMetricPackage(`executive:${catalog}:${schema}`);
  if (!pkg) throw new Error('当前数据不具备资金业务指标，请先重新发现数据');
  const id = `view:executive:${catalog}:${schema}`;
  const existing = (await dbService.getDashboards(catalog)).find(board => board.id === id);
  if (existing) { await selectHomeView(id, catalog); return existing; }
  const layout: Array<[string, number, number, number, number]> = [
    ['usd-gmv',0,0,3,3], ['usdt-gmv',3,0,3,3], ['success',6,0,3,3], ['usd-net',9,0,3,3],
    ['usd-monthly',0,3,8,5], ['networks',8,3,4,5],
    ['liquidity',0,8,6,5], ['channels',6,8,6,5],
    ['rates',0,13,12,4],
  ];
  const items: Dashboard['items'] = [];
  for (const [key,x,y,w,h] of layout) {
    const metric = pkg.metrics.find(metric => metric.id === `${pkg.id}:${key}`);
    if (!metric) continue; // Respect definitions the user explicitly removed.
    const query = await saveObjectReference({kind:'metric',id:metric.id,name:metric.name}, catalog);
    items.push({i:crypto.randomUUID(),savedQueryId:query.id,x,y,w,h});
  }
  const current = await duckDBService.getCurrentCatalogAndSchema();
  if (current.catalog !== catalog || current.schema !== schema) throw new Error('数据范围已切换，请重新打开资金总览');
  const now = Date.now();
  const board: Dashboard = {id,name:'资金业务总览',databaseName:catalog,createdAt:now,updatedAt:now,items,layoutLocked:true,
    description:'核心指标 → 分布与趋势 → 明细核对。金额只统计已完成交易；完成率覆盖全部订单。单位分别展示，历史汇率不代表实时价格。解锁后可自由编排，后续打开保留您的修改。'};
  await dbService.saveDashboard(board);
  await selectHomeView(id, catalog);
  return board;
}
