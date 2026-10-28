import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { dbService } from './dbService';
import { duckDBService } from './duckdbService';
import { readSidecar, writeSidecar } from './studioMetadataSidecar';
import type { Dashboard } from '../types';
const valid: Dashboard = {id:'valid',name:'valid',databaseName:'governance',createdAt:1,updatedAt:1,items:[{i:'w',savedQueryId:'q',x:0,y:0,w:6,h:7}]};
afterEach(() => { vi.restoreAllMocks(); window.dispatchEvent(new Event('duckdb-database-changed')); });

it('isolates invalid JSON and future versions while retaining the valid board and all source records', async()=>{
  vi.spyOn(dbService,'isReadonlyConfiguration').mockResolvedValue(false);
  vi.spyOn(dbService as any,'ensureMetadata').mockResolvedValue('metadata');
  const rows=[{id:'bad',payload:'{'},{id:'future',payload:JSON.stringify({...valid,id:'future',formatVersion:99})},{id:'valid',payload:JSON.stringify(valid)}];
  const query=vi.spyOn(duckDBService,'query').mockResolvedValue(rows);
  const boards=await dbService.getDashboards('governance');
  expect(boards.map(board=>board.id)).toEqual(['valid']);
  expect(dbService.getDashboardReadIssues('governance').map(issue=>issue.id)).toEqual(['bad','future']);
  expect(query).toHaveBeenCalledTimes(1);
  expect(rows[0].payload).toBe('{');
});
it('persists readonly configurations in the sidecar, scopes them by catalog, and overlays source records without DDL',async()=>{
  const catalog='readonly-governance';
  const read=vi.spyOn(duckDBService,'readQuery').mockImplementation(async(sql)=>{
    if(sql.includes('duckdb_databases()'))return [{readonly:-31,readonly_flag:1}];
    if(sql.includes('duckdb_tables()'))return [{table_name:'objects'}];
    if(sql.includes("kind = 'dashboard'"))return [{id:'valid',payload:JSON.stringify({...valid,databaseName:catalog})}];
    return [];
  });
  const write=vi.spyOn(duckDBService,'query');
  await dbService.saveDashboard({...valid,databaseName:catalog,name:'browser-saved'});
  await dbService.saveDomainSetting('active-home-view','valid',catalog);
  expect((await dbService.getDashboards(catalog))[0].name).toBe('browser-saved');
  expect(await dbService.getDomainSetting('active-home-view',catalog)).toBe('valid');
  window.dispatchEvent(new Event('duckdb-database-changed'));
  expect((await dbService.getDashboards(catalog))[0].name).toBe('browser-saved');
  expect(await readSidecar('other-catalog','dashboard')).toEqual([]);
  await dbService.deleteDashboard('valid',catalog);
  expect(await dbService.getDashboards(catalog)).toEqual([]);
  expect(write).not.toHaveBeenCalled();
  expect(read.mock.calls.every(([sql])=>!/^CREATE|^INSERT|^DELETE/.test(sql))).toBe(true);
});
it('surfaces a sidecar transaction failure rather than reporting a successful save',async()=>{
  const put=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(()=>{throw new Error('quota exceeded');});
  await expect(writeSidecar({catalog:'quota',kind:'dashboard',id:'b',payload:'{}',updated_at:1})).rejects.toThrow('quota exceeded');
  put.mockRestore();
  expect(await readSidecar('quota','dashboard')).toEqual([]);
});

it('handles an actual aborted transaction without an unhandled completion rejection',async()=>{
  const nativePut=IDBObjectStore.prototype.put;
  const put=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value:unknown,key?:IDBValidKey){
    const request=nativePut.call(this,value,key);this.transaction.abort();return request;
  });
  await expect(writeSidecar({catalog:'abort',kind:'dashboard',id:'b',payload:'{}',updated_at:1})).rejects.toThrow();
  put.mockRestore();
  expect(await readSidecar('abort','dashboard')).toEqual([]);
});
