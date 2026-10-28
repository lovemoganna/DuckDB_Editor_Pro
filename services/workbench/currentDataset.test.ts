import {expect,it} from 'vitest';
import {datasetFromQueryResult} from './currentDataset';
it('keeps the executed query and full scope instead of displayed result-page rows',()=>{
  const sql="SELECT uid FROM memory.main.users WHERE country_code='US'";
  expect(datasetFromQueryResult({executedSql:sql,databaseName:'memory',schemaName:'main',columns:['uid'],columnTypes:['BIGINT'],rows:[{uid:1}],executionTime:1},'tab','US users')).toMatchObject({sql,catalog:'memory',schema:'main',fields:[{name:'uid',type:'BIGINT'}]});
});
it('rejects mutations, multi-statement scripts, explain results and missing execution provenance',()=>{
  const result={executedSql:'DELETE FROM users',databaseName:'memory',schemaName:'main',columns:[],rows:[],executionTime:1};
  for(const change of [{},{executedSql:'SELECT 1; SELECT 2'},{executedSql:'SELECT 1',isExplain:true},{executedSql:undefined}])expect(()=>datasetFromQueryResult({...result,...change},'tab','title')).toThrow();
});
