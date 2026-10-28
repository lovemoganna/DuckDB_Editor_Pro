import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dashboard, SavedQuery } from '../types';
const state = vi.hoisted(() => ({boards: [] as Dashboard[], queries: [] as SavedQuery[], selected: ''}));
vi.mock('./duckdbService',()=>({duckDBService:{getCurrentCatalogAndSchema:async()=>({catalog:'funds',schema:'main'})}}));
vi.mock('./dbService',()=>({dbService:{
  getDashboards:async()=>state.boards,
  saveDashboard:async(board:Dashboard)=>{state.boards.push(board);},
}}));
vi.mock('./homeDashboardService',()=>({selectHomeView:async(id:string)=>{state.selected=id;}}));
vi.mock('./analysisObjects',()=>({saveObjectReference:async(object:{id:string,name:string},database:string)=>{
  const q:SavedQuery={id:object.id,databaseName:database,name:object.name,sql:'',createdAt:1,analysisRef:{kind:'metric',id:object.id}};
  state.queries.push(q);return q;
}}));
vi.mock('./metricAnalyzer',()=>({metricAnalyzer:{getMetricPackage:()=>({id:'executive:funds:main',metrics:
  ['usd-gmv','usdt-gmv','success','usd-net','usd-monthly','networks','liquidity','channels','exceptions','quality','rates'].map(key=>({id:`executive:funds:main:${key}`,name:key}))})}}));
import { openExecutiveWorkspace } from './executiveWorkspace';
describe('editable executive arrangement of shared objects',()=>{
  beforeEach(()=>{state.boards=[];state.queries=[];state.selected='';});
  it('creates references rather than copied queries and retains all other user views',async()=>{
    const custom:Dashboard={id:'custom',name:'自定义',items:[],createdAt:1,updatedAt:1,databaseName:'funds'};
    state.boards.push(custom);
    const board=await openExecutiveWorkspace();
    expect(board.items).toHaveLength(9);
    expect(state.queries.every(q=>q.sql==='' && q.analysisRef?.kind==='metric')).toBe(true);
    expect(board.items.slice(0,4).map(item=>item.y)).toEqual([0,0,0,0]);
    expect(state.boards[0]).toBe(custom);expect(state.selected).toBe(board.id);
  });
  it('never reseeds a view after the user removes, moves or resizes its components',async()=>{
    const board=await openExecutiveWorkspace();
    board.items=[{...board.items[0],x:5,y:7,w:6,h:5}];
    const count=state.queries.length;
    expect(await openExecutiveWorkspace()).toBe(board);
    expect(state.queries).toHaveLength(count);
    expect(board.items[0]).toMatchObject({x:5,y:7,w:6,h:5});
  });
});
