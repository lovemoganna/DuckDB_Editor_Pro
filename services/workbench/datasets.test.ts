import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({read:vi.fn(),get:vi.fn(),save:vi.fn()}));
vi.mock('../duckdbService',()=>({duckDBService:{readQuery:mocks.read,getCurrentCatalogAndSchema:async()=>({catalog:'sales',schema:'main'})}}));
vi.mock('../dbService',()=>({dbService:{getDomainSetting:mocks.get,saveDomainSetting:mocks.save}}));
import {saveQueryDataset,loadDatasets} from './datasets';
const existing={id:'stable',name:'source',catalog:'sales',schema:'main',sql:'SELECT * FROM "sales"."main"."orders"',fields:[{name:'id',type:'INTEGER'}],version:1,kind:'query',uniqueKeys:[{sql:'SELECT id FROM sales.main.orders',key:'id'}]};
beforeEach(()=>{
 mocks.get.mockReset().mockResolvedValue([existing]);mocks.save.mockReset();mocks.read.mockReset().mockImplementation(async(sql:string)=>sql.includes('duckdb_tables()')?[{database_name:'sales',schema_name:'main',table_name:'orders'}]:[{column_name:'id',column_type:'INTEGER'}]);
});
describe('dataset ownership and definition editing',()=>{
 it('updates the stable definition and version within its owning catalog',async()=>{
  const next=await saveQueryDataset('owner','renamed',existing.sql,undefined,'stable');
  expect(next.id).toBe('stable');expect(next.version).toBe(2);expect(next.uniqueKeys).toEqual(existing.uniqueKeys);expect(existing.name).toBe('source');expect(mocks.save).toHaveBeenCalledWith('workbench-datasets-v1',[next],'owner');
 });
 it('rejects mutations and missing editing identities before persistence',async()=>{
  await expect(saveQueryDataset('owner','bad','DROP TABLE orders')).rejects.toThrow('只读');
  await expect(saveQueryDataset('owner','lost',existing.sql,undefined,'gone')).rejects.toThrow('已不存在');expect(mocks.save).not.toHaveBeenCalled();
 });
 it('refreshes actual source metadata and preserves unavailable saved identities for recovery',async()=>{
  mocks.read.mockImplementation(async(sql:string)=>{if(sql.includes('duckdb_tables()'))return [];throw new Error('source detached');});
  const result=await loadDatasets('owner');expect(result[0].id).toBe('stable');expect(result[0].error).toBe('source detached');
 });
});
