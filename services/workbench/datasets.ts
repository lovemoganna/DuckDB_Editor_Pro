import { duckDBService } from '../duckdbService';
import { dbService } from '../dbService';
import { quoteIdent } from '../databaseCatalog';
import { requireAnalysisQuery } from '../analysis/readQueryGuard';
import { compileAnalysis } from './queryCompiler';
import type { DatasetDefinition } from './analysisTypes';

export async function loadDatasets(owner: string): Promise<DatasetDefinition[]> {
  const rows = await duckDBService.readQuery(`SELECT database_name, schema_name, table_name FROM duckdb_tables() WHERE NOT internal AND schema_name <> '__studio' UNION SELECT database_name, schema_name, view_name AS table_name FROM duckdb_views() WHERE NOT internal AND schema_name <> '__studio'`);
  console.warn('[loadDatasets] rows found:', rows.length, JSON.stringify(rows));
  const datasets = await Promise.all(rows.filter(row=>!String(row.table_name).startsWith('_sys_')).map(async row => {
    const catalog = String(row.database_name), schema = String(row.schema_name), table = String(row.table_name);
    const sql = `SELECT * FROM ${quoteIdent(catalog)}.${quoteIdent(schema)}.${quoteIdent(table)}`;
    let fields: any[] = [];
    try {
      fields = await duckDBService.readQuery(`DESCRIBE ${sql}`);
    } catch {
      try {
        fields = await duckDBService.readQuery(`DESCRIBE ${quoteIdent(catalog)}.${quoteIdent(schema)}.${quoteIdent(table)}`);
      } catch {
        try {
          fields = await duckDBService.readQuery(`DESCRIBE ${quoteIdent(table)}`);
        } catch (err: any) {
          console.warn('[loadDatasets] DESCRIBE error for', table, err?.message);
          return null;
        }
      }
    }
    return {
      id: `table:${JSON.stringify([catalog,schema,table])}`,
      name: `${catalog}.${schema}.${table}`,
      catalog,
      schema,
      table,
      sql,
      fields: fields.map(field => ({name: String(field.column_name), type: String(field.column_type)})),
      version: 1,
      kind: 'table' as const
    };
  }));
  const custom = await dbService.getDomainSetting<DatasetDefinition[]>('workbench-datasets-v1', owner) || [];
  const checked=await Promise.all(custom.map(async dataset=>{
    try {
      const fields=await duckDBService.readQuery(`DESCRIBE ${requireAnalysisQuery(dataset.sql)}`);
      return {...dataset,error:undefined,fields:fields.map(field=>({name:String(field.column_name),type:String(field.column_type)}))};
    } catch(error) {return {...dataset,error:String((error as Error).message)};}
  }));
  return [...datasets.filter((d): d is NonNullable<typeof d> => d !== null), ...checked];
}
export async function saveQueryDataset(owner: string, name: string, sql: string, uniqueKeys?:DatasetDefinition['uniqueKeys'], existingId?:string): Promise<DatasetDefinition> {
  if (!name.trim()) throw new Error('请输入数据集名称');
  const scope = await duckDBService.getCurrentCatalogAndSchema();
  const statement = compileAnalysis({sql:requireAnalysisQuery(sql),catalog:scope.catalog,schema:scope.schema,datasets:await loadDatasets(owner)}).sql;
  const fields = await duckDBService.readQuery(`DESCRIBE ${statement}`);
  if (!fields.length) throw new Error('数据集没有可用字段');
  const old = await dbService.getDomainSetting<DatasetDefinition[]>('workbench-datasets-v1',owner) || [];
  const previous=old.find(d=>d.id===existingId);
  if(existingId&&!previous)throw new Error('数据集定义已不存在，请重新打开编辑');
  const dataset: DatasetDefinition = { id: previous?.id || crypto.randomUUID(),name:name.trim(),catalog:scope.catalog,schema:scope.schema,sql:statement,
    fields:fields.map(field=>({name:String(field.column_name),type:String(field.column_type)})),version:(previous?.version||0)+1,kind:'query',uniqueKeys:uniqueKeys || (previous?.sql===statement?previous.uniqueKeys:undefined) };
  await dbService.saveDomainSetting('workbench-datasets-v1',previous?old.map(d=>d.id===dataset.id?dataset:d):[...old,dataset],owner);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('duckdb-datasets-changed'));
  return dataset;
}
