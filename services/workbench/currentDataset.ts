import type {QueryResult} from '../../types';
import type {DatasetDefinition} from './analysisTypes';
import {requireAnalysisQuery} from '../analysis/readQueryGuard';

/** A query dataset represents the executed statement, never subsequent editor text or one result page. */
export function datasetFromQueryResult(result:QueryResult,id:string,title:string):DatasetDefinition {
  if(result.error || result.isExplain)throw new Error('请先成功执行一条只读查询');
  if(!result.databaseName || !result.schemaName || !result.executedSql)throw new Error('缺少查询来源，请重新执行');
  return {id:`sql:${id}`,name:`查询：${title}`,catalog:result.databaseName,schema:result.schemaName,kind:'query',version:1,
    sql:requireAnalysisQuery(result.executedSql),fields:result.columns.map((name,index)=>({name,type:result.columnTypes?.[index] || result.columnTypeMap?.[name] || 'VARCHAR'}))};
}
