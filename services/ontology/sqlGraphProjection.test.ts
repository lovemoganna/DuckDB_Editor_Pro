import { describe, expect, it, vi, beforeEach } from 'vitest';
const runtime = vi.hoisted(() => ({ readQuery: vi.fn(), currentDatabase: 'real', databaseContextRevision: 0 }));
vi.mock('../duckdbService', () => ({ duckDBService: { readQuery: runtime.readQuery, getRuntimeInfo: () => ({currentDatabase: runtime.currentDatabase, databaseContextRevision: runtime.databaseContextRevision}) } }));
import { projectSqlRows, executeSqlSlice, buildSliceQuery, applySliceFilters, suggestSliceIdentity, validateSliceIdentity, prepareSqlProjectionGraph, type ProjectionMapping } from './sqlGraphProjection';
const mapping: ProjectionMapping = {nodes:[{type:'Payment',table:'real.main.payments',key:{id:'pid'},properties:{amount:'amount'}},{type:'User',table:'real.main.users',key:{id:'uid'}}],edges:[{type:'belongsTo',source:'Payment',target:'User'}]};
beforeEach(() => { vi.clearAllMocks(); runtime.currentDatabase='real';runtime.databaseContextRevision=0; });
describe('SQL graph projection contract', () => {
  it('isolates engine mutations, preserves source trace and relation IDs, and clears pending projections',()=>{
    const projected=projectSqlRows([{pid:1,uid:2,amount:10}],mapping,'real');
    const result={...projected,rows:[{pid:1,uid:2,amount:10}],sql:'SELECT',catalog:'real'};
    const engine=prepareSqlProjectionGraph(result);
    engine.nodes[0].x=900;engine.links[0].source=engine.nodes[0];
    expect(result.graph.nodes[0].x).toBeUndefined();expect(typeof result.graph.links[0].source).toBe('string');
    expect(engine.nodes[0]._trace.key).toEqual({id:'1'});expect(engine.links[0].id).toBe(engine.links[0]._id);
    expect(engine.typeMap[1].name).toBe('Payment');expect(engine.linkTypeMap[1].name).toBe('belongsTo');
    expect(prepareSqlProjectionGraph(null).nodes).toEqual([]);
  });
  const table={catalog:'real',schema:'main',name:'payments',columns:['id','uid','status'],primaryKey:[]};
  it('validates filter identifiers and operators, escapes literal values, and handles null explicitly',()=>{
    expect(applySliceFilters('SELECT * FROM payments s',table,[{field:'status',operator:'contains',value:"a'b%"},{field:'uid',operator:'null',value:''}])).toContain("contains(CAST(s.\"status\" AS VARCHAR), 'a''b%')\n  AND s.\"uid\" IS NULL");
    expect(()=>applySliceFilters('SELECT',table,[{field:'missing',operator:'eq',value:'x'}])).toThrow('选择字段');
    expect(()=>applySliceFilters('SELECT',table,[{field:'id',operator:'DROP' as any,value:'x'}])).toThrow('不支持');
  });
  it('only suggests identities proven unique and rejects stale identity checks',async()=>{
    runtime.readQuery.mockResolvedValue([{total:4,k0:4,k1:2}]);expect(await suggestSliceIdentity(table)).toBe('id');
    runtime.readQuery.mockResolvedValue([{total:4,unique_keys:2}]);await expect(validateSliceIdentity(table,'uid')).rejects.toThrow('重复或空值');
    runtime.readQuery.mockImplementation(async()=>{runtime.databaseContextRevision++;return [{total:4,k0:4}];});
    await expect(suggestSliceIdentity(table)).rejects.toThrow('上下文');
  });
  it('deduplicates objects and relationships while preserving every contributing query row', () => {
    const row={pid:1,uid:2,amount:10};
    const {graph}=projectSqlRows([row,row,{pid:3,uid:2,amount:20}],mapping,'real');
    expect(graph.nodes).toHaveLength(3);expect(graph.links).toHaveLength(2);
    expect(graph.nodes.find(n=>n._typeName==='User')!._rowIndices).toEqual([0,1,2]);
    expect(graph.links[0]._rowIndices).toEqual([0,1]);expect(graph.nodes[0]._trace.key).toEqual({id:'1'});
  });
  it('does not synthesize missing LEFT JOIN endpoints or relationships', () => {
    const result=projectSqlRows([{pid:1,uid:null,amount:10}],mapping,'real');
    expect(result.graph.nodes).toHaveLength(1);expect(result.graph.links).toHaveLength(0);expect(result.skipped).toBe(2);
  });
  it('rejects missing aliases, conflicting identities and invalid mappings', () => {
    expect(()=>projectSqlRows([{pid:1,amount:10}],mapping,'real')).toThrow('uid');
    expect(()=>projectSqlRows([{pid:1,uid:2,amount:10},{pid:1,uid:2,amount:20}],mapping,'real')).toThrow('冲突');
    expect(()=>projectSqlRows([], {nodes:[],edges:[]},'real')).toThrow('映射');
  });
  it('supports composite identities and distinct parallel edges', () => {
    const m:ProjectionMapping={nodes:[{type:'Rate',table:'rates',key:{asset:'a',date:'d'}},{type:'Quote',table:'quotes',key:{code:'q'}}],edges:[{type:'quotedIn',source:'Rate',target:'Quote',key:['venue']}]};
    const result=projectSqlRows([{a:'USD',d:'2025-01',q:'USDT',venue:'A'},{a:'USD',d:'2025-01',q:'USDT',venue:'B'}],m,'real');
    expect(result.graph.nodes).toHaveLength(2);expect(result.graph.links).toHaveLength(2);
  });
  it('rejects mutations before querying and rejects oversized slices rather than silently truncating', async () => {
    await expect(executeSqlSlice('DELETE FROM payments',mapping)).rejects.toThrow('只读');expect(runtime.readQuery).not.toHaveBeenCalled();
    runtime.readQuery.mockResolvedValue(Array(1001).fill({}));
    await expect(executeSqlSlice('SELECT * FROM payments;',mapping)).rejects.toThrow('超过');
    expect(runtime.readQuery.mock.calls[0][0]).toMatch(/LIMIT 1001$/);
  });
  it('rejects a result if the database switched away and back while SQL was running', async () => {
    runtime.readQuery.mockImplementation(async()=>{runtime.databaseContextRevision+=2;return [];});
    await expect(executeSqlSlice('SELECT 1',mapping)).rejects.toThrow('上下文');
  });
  it('quotes actual table and column identifiers and only joins explicitly selected fields', () => {
    const table={catalog:'a',schema:'odd.schema',name:'pay"ment',columns:['order id','uid'],primaryKey:[]};
    const result=buildSliceQuery(table,'order id');
    expect(result.sql).toContain('"a"."odd.schema"."pay""ment"');expect(result.mapping.nodes[0].key).toEqual({'order id':'s_order id'});
    expect(result.sql).not.toContain('JOIN');
  });
});
