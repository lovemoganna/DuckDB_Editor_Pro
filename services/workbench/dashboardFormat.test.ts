import {describe,it,expect} from 'vitest';
import {normalizeDashboard,cloneDashboard} from './dashboardFormat';
import type {Dashboard} from '../../types';
const legacy:Dashboard={id:'legacy',name:'old',databaseName:'sales',items:[{i:'a',savedQueryId:'q',x:1,y:2,w:4,h:3}],createdAt:1,updatedAt:1};
describe('dashboard format',()=>{
 it('upgrades old geometry and references without mutating the source',()=>{
  const next=normalizeDashboard(legacy);expect(next.formatVersion).toBe(2);expect(next.items[0].savedQueryId).toBe('q');expect(next.items[0].x).toBe(1);expect(legacy.formatVersion).toBeUndefined();expect(next.context?.filters).toEqual([]);
 });
 it('clones independent instances while retaining original analysis identities',()=>{
  const board=normalizeDashboard(legacy);board.items[0].settings!.filters=[];const copy=cloneDashboard(board,'copy');
  expect(copy.id).not.toBe(board.id);expect(copy.items[0].i).not.toBe('a');expect(copy.items[0].savedQueryId).toBe('q');expect(copy.context).not.toBe(board.context);expect(copy.items[0].settings).not.toBe(board.items[0].settings);
 });
 it('rejects future formats instead of overwriting them',()=>{expect(()=>normalizeDashboard({...legacy,formatVersion:3})).toThrow('较新版本');});
});

it('rejects malformed geometry before a renderer sees it, preserving the input',()=>{
 const bad={...legacy,items:[{...legacy.items[0],w:0}]};
 const before=JSON.stringify(bad);
 expect(()=>normalizeDashboard(bad)).toThrow('布局');
 expect(JSON.stringify(bad)).toBe(before);
 expect(()=>normalizeDashboard({...legacy,items:null} as any)).toThrow('组件列表');
 expect(()=>normalizeDashboard({...legacy,items:[legacy.items[0],legacy.items[0]]})).toThrow('重复');
});
