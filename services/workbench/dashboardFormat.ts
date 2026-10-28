import type { Dashboard } from '../../types';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
const chartTypes = new Set(['bar','line','area','pie','doughnut','scatter','counter','kpi','pivot','table','funnel','waterfall','histogram','combo']);
function filters(value: unknown, path: string) {
  if (!Array.isArray(value)) throw new Error(`${path} 必须是筛选列表`);
  value.forEach((filter, index) => {
    if (!record(filter) || typeof filter.id !== 'string' || typeof filter.field !== 'string' ||
      !['eq','ne','gte','lt','lte','contains','isNull','notNull','in'].includes(String(filter.operator)) ||
      typeof filter.value !== 'string' || !record(filter.bindings) ||
      !Object.values(filter.bindings).every(value => typeof value === 'string') ||
      (filter.values !== undefined && !strings(filter.values))) throw new Error(`${path}[${index}] 筛选配置无效`);
  });
}
function settings(value: unknown, path: string) {
  if (!record(value)) throw new Error(`${path} 组件设置无效`);
  for (const key of ['title','datasetId','sourceCatalog']) {
    if (value[key] !== undefined && typeof value[key] !== 'string') throw new Error(`${path}.${key} 无效`);
  }
  if (value.linked !== undefined && typeof value.linked !== 'boolean') throw new Error(`${path}.linked 无效`);
  if (value.filters !== undefined) filters(value.filters, `${path}.filters`);
  if (value.querySpec !== undefined) {
    const spec = value.querySpec;
    if (!record(spec) || typeof spec.datasetId !== 'string' || !spec.datasetId || !strings(spec.dimensions) ||
      !['COUNT','SUM','AVG','MIN','MAX','DETAIL'].includes(String(spec.aggregation)) ||
      (spec.measure !== undefined && typeof spec.measure !== 'string') ||
      (spec.timeGrain !== undefined && !['day','week','month','year'].includes(String(spec.timeGrain)))) throw new Error(`${path}.querySpec 无效`);
  }
  if (value.chartConfig !== undefined) validateDashboardChart(value.chartConfig, `${path}.chartConfig`);
}
export function validateDashboardChart(value: unknown, path = 'chart') {
  if (!record(value) || typeof value.id !== 'string' || typeof value.title !== 'string' ||
    !chartTypes.has(String(value.type)) || typeof value.xKey !== 'string' || !strings(value.yKeys) ||
    (value.yRightKeys !== undefined && !strings(value.yRightKeys))) throw new Error(`${path} 图表必需字段无效`);
}

export function layoutOverlaps(items: Dashboard['items']) {
  return items.some((a, index) => items.slice(index + 1).some(b =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h));
}

/** Stable vertical repair: preserve x/w/h, references, and the original array order. */
export function repairDashboardLayout(board: Dashboard): Dashboard {
  const placed: Dashboard['items'] = [];
  const positions = new Map<string, number>();
  [...board.items].sort((a,b) => a.y - b.y || a.x - b.x).forEach(item => {
    let y = item.y;
    while (true) {
      const collisions = placed.filter(other => item.x < other.x + other.w && other.x < item.x + item.w && y < other.y + other.h && other.y < y + item.h);
      if (!collisions.length) break;
      y = Math.max(...collisions.map(other => other.y + other.h));
    }
    if (y + item.h > 10000) throw new Error(`组件 ${item.i} 整理后超出画布范围`);
    positions.set(item.i, y);
    placed.push({...item, y});
  });
  return {...board, items: board.items.map(item => ({...item, y: positions.get(item.i)!}))};
}

/** Upgrade in memory; legacy SQL, identities and geometry are preserved. */
export function normalizeDashboard(board: Dashboard): Dashboard {
  if (!board || typeof board !== 'object' || typeof board.id !== 'string' || !board.id.trim()) throw new Error('看板身份无效');
  if ((board.formatVersion || 1) > 2) throw new Error('此看板由较新版本创建，请升级后打开');
  if (board.formatVersion !== undefined && (!Number.isSafeInteger(board.formatVersion) || board.formatVersion < 1)) throw new Error('看板版本无效');
  if (!Array.isArray(board.items)) throw new Error('看板组件列表无效，原配置已保留');
  if (board.context !== undefined) {
    if (!record(board.context) || !Number.isFinite(board.context.refreshSeconds) || board.context.refreshSeconds < 0) throw new Error('看板筛选或刷新配置无效，原配置已保留');
    filters(board.context.filters, 'context.filters');
  }
  if (board.layoutLocked !== undefined && typeof board.layoutLocked !== 'boolean') throw new Error('看板布局锁定设置无效');
  const ids = new Set<string>();
  for (const item of board.items) {
    if (!item || typeof item.i !== 'string' || !item.i || typeof item.savedQueryId !== 'string' || !item.savedQueryId) throw new Error('看板组件引用无效');
    if (ids.has(item.i)) throw new Error('看板组件身份重复');
    ids.add(item.i);
    if (![item.x, item.y, item.w, item.h].every(Number.isSafeInteger) || item.x < 0 || item.y < 0 || item.w < 1 || item.h < 1 || item.x + item.w > 12 || item.y + item.h > 10000) throw new Error(`组件 ${item.i} 布局无效，原配置已保留`);
    if (item.settings !== undefined) settings(item.settings, `items[${item.i}].settings`);
  }
  return {...board,formatVersion:2,context:board.context || {filters:[],refreshSeconds:0},items:board.items.map(item=>({...item,settings:item.settings || {linked:true}}))};
}

export function cloneDashboard(board: Dashboard, name: string): Dashboard {
  if (!name.trim()) throw new Error('请输入视图名称');
  const clone=structuredClone(normalizeDashboard(board));
  return {...clone,id:crypto.randomUUID(),name:name.trim(),items:clone.items.map(item=>({...item,i:crypto.randomUUID()})),createdAt:Date.now(),updatedAt:Date.now()};
}
