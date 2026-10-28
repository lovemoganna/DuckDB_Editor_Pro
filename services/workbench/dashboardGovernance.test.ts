import { expect, it } from 'vitest';
import { normalizeDashboard, repairDashboardLayout, layoutOverlaps } from './dashboardFormat';
import type { Dashboard } from '../../types';
const board: Dashboard = {id:'b',name:'b',databaseName:'sales',createdAt:1,updatedAt:1,items:[
  {i:'a',savedQueryId:'q',x:0,y:0,w:6,h:5},
  {i:'b',savedQueryId:'q',x:0,y:0,w:6,h:3},
  {i:'c',savedQueryId:'q',x:6,y:0,w:6,h:2},
]};
it('repairs only collisions deterministically without changing references or horizontal geometry', () => {
  const original = structuredClone(board);
  const repaired = repairDashboardLayout(normalizeDashboard(board));
  expect(repaired.items.map(item => item.y)).toEqual([0,5,0]);
  expect(layoutOverlaps(repaired.items)).toBe(false);
  expect(repairDashboardLayout(repaired)).toEqual(repaired);
  expect(board).toEqual(original);
  expect(repaired.items.map(({i,savedQueryId,x,w,h}) => ({i,savedQueryId,x,w,h}))).toEqual(original.items.map(({i,savedQueryId,x,w,h}) => ({i,savedQueryId,x,w,h})));
});
it('rejects extreme geometry and malformed nested configuration with a location', () => {
  expect(() => normalizeDashboard({...board,items:[{...board.items[0],h:100000000}]})).toThrow('a');
  expect(() => normalizeDashboard({...board,context:{filters:[null] as any,refreshSeconds:30}})).toThrow('context.filters[0]');
  expect(() => normalizeDashboard({...board,items:[{...board.items[0],settings:{chartConfig:{type:'bar'} as any}}]})).toThrow('chartConfig');
  expect(() => normalizeDashboard({...board,items:[{...board.items[0],settings:{filters:[{}] as any}}]})).toThrow('settings.filters[0]');
});
