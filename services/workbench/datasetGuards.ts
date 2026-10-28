import {duckDBService} from '../duckdbService';
import {quoteIdent} from '../databaseCatalog';
import {requireAnalysisQuery} from '../analysis/readQueryGuard';

/** Recheck when executing: a previously unique key can change after new imports. */
export async function validateUniqueKeys(keys:{sql:string;key:string}[]) {
  for(const guard of keys) {
    const key=quoteIdent(guard.key);
    const duplicates=await duckDBService.readQueryWithParams(`SELECT ${key} FROM (\n${requireAnalysisQuery(guard.sql)}\n) AS source WHERE ${key} IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1 LIMIT 1`,[]);
    if(duplicates.length)throw new Error('右侧关联键不唯一，会放大左侧记录与金额。请先建立按关联键聚合的数据集。');
  }
}
