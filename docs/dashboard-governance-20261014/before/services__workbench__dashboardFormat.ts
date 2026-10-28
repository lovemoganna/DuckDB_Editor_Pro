import type { Dashboard } from '../../types';

/** Upgrade in memory; legacy SQL, identities and geometry are preserved. */
export function normalizeDashboard(board: Dashboard): Dashboard {
  if ((board.formatVersion || 1) > 2) throw new Error('此看板由较新版本创建，请升级后打开');
  return {...board,formatVersion:2,context:board.context || {filters:[],refreshSeconds:0},items:board.items.map(item=>({...item,settings:item.settings || {linked:true}}))};
}

export function cloneDashboard(board: Dashboard, name: string): Dashboard {
  if (!name.trim()) throw new Error('请输入视图名称');
  const clone=structuredClone(normalizeDashboard(board));
  return {...clone,id:crypto.randomUUID(),name:name.trim(),items:clone.items.map(item=>({...item,i:crypto.randomUUID()})),createdAt:Date.now(),updatedAt:Date.now()};
}
