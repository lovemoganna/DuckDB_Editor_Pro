import { duckDBService } from '../duckdbService';
import { requireAnalysisQuery } from './readQueryGuard';
export { requireAnalysisQuery } from './readQueryGuard';

export async function executeAnalysisQuery(sql: string): Promise<any[]> {
  const statement = requireAnalysisQuery(sql);
  const catalog = duckDBService.getRuntimeInfo?.().currentDatabase;
  await duckDBService.query(`EXPLAIN ${statement}`);
  if (catalog !== duckDBService.getRuntimeInfo?.().currentDatabase) throw new Error('数据库已切换，请重新执行查询');
  return duckDBService.query(statement);
}
