import type { DatasetDefinition } from '../workbench/analysisTypes';
import type { AnalysisRecord } from '../analysisObjects';
import { dbService } from '../dbService';
import { mutateDomainSetting } from '../domainSettingMutation';
import { duckDBService } from '../duckdbService';
import { validateUniqueKeys } from '../workbench/datasetGuards';
import { pivotConfigToSpec, type PivotDimension, type PivotMetric, type PivotFilter } from './adapters/workbenchAdapter';
export type { PivotDimension, PivotMetric, PivotFilter };
import { compileAnalysisSql, compileFilterClause } from './sqlCompiler';
import { requireAnalysisQuery } from './readQueryGuard';
import { classifySemanticType } from './semantic';
import { quoteIdent, literalValue, sanitizeAlias } from './sqlUtils';
import type { AnalysisSpec } from './types';

export interface PivotJoinConfig {
  enabled: boolean;
  secondaryTable: string;
  joinType: 'LEFT' | 'INNER';
  primaryKey: string;
  secondaryKey: string;
  fanOutRisk?: boolean;
}

export interface PivotDefinition {
  version: 1;
  source: DatasetDefinition;
  title: string;
  row?: PivotDimension;
  rows?: PivotDimension[];
  column?: PivotDimension;
  metrics: PivotMetric[];
  filters: PivotFilter[];
  sortMetric: string;
  sortOrder: 'asc' | 'desc';
  limit: number;
  view: 'table' | 'chart';
  chartType: 'bar' | 'line' | 'area';
  visibleMetric: number;
  unit: string;
  decimals?: number;
  nullDisplay?: 'dash' | 'zero' | 'empty';
  joinConfig?: PivotJoinConfig;
}

export const pivotDrafts = new Map<string, {definition: PivotDefinition; analysisId?: string; savedKey?: string;savedAt?:number}>();
export const pivotSourceKey = (source: DatasetDefinition) => JSON.stringify([source.catalog,source.schema,source.id,source.sql]);
export const pivotDefinitionKey = (definition: PivotDefinition) => JSON.stringify(definition);
/** SQL identity deliberately excludes presentation and session state. */
export const pivotQueryKey = (def: PivotDefinition) => {
  const rowDims = getPivotRowDimensions(def);
  return JSON.stringify({source:pivotSourceKey(def.source),rows:rowDims,column:def.column,metrics:def.metrics.map(({decimals,...metric})=>metric),filters:def.filters,sortMetric:def.sortMetric,sortOrder:def.sortOrder,limit:def.limit,unit:def.unit,joinConfig:def.joinConfig});
};
export const pivotNumericType=(type:string)=>/^(U?TINYINT|U?SMALLINT|U?INTEGER|U?BIGINT|HUGEINT|UHUGEINT|INT\d*|FLOAT|DOUBLE|REAL|DECIMAL|NUMERIC)(\b|\()/i.test(type);

export function getPivotRowDimensions(definition: PivotDefinition): PivotDimension[] {
  if (definition.rows && definition.rows.length > 1) {
    if (definition.row && definition.row.column !== definition.rows[0]?.column) {
      return [definition.row, ...definition.rows.slice(1)];
    }
    return definition.rows;
  }
  if (definition.row) return [definition.row];
  if (definition.rows && definition.rows.length) return definition.rows;
  return [];
}

export function defaultPivot(source: DatasetDefinition, initialDimension?: string): PivotDefinition {
  const fields = source.fields;
  const preferred = fields.find(f => classifySemanticType(f.name,f.type) === 'categorical')
    || fields.find(f => classifySemanticType(f.name,f.type) === 'temporal') || fields[0];
  const name = initialDimension && fields.some(f=>f.name===initialDimension) ? initialDimension : preferred?.name || '';
  const selected = fields.find(f=>f.name===name);
  const initialRow: PivotDimension = {column:name,
    ...(selected && classifySemanticType(name,selected.type)==='temporal' ? {dateTrunc:'month' as const} : {})};
  return {version:1,source,title:`${source.name} · 透视表`,
    row: initialRow,
    metrics:[{agg:'count',alias:'记录数'}],filters:[],sortMetric:'记录数',sortOrder:'desc',limit:50,
    view:'table',chartType:'bar',visibleMetric:0,unit:''};
}

/** Virtual single-value dimension used when the user leaves 行 empty: all records collapse into one row. */
export const PIVOT_ALL_ROWS_COLUMN = '汇总范围';
export const PIVOT_ALL_ROWS_VALUE = '全部';
/** Metric used when the user leaves 值 empty: plain record count, so the table still shows how many records fall in each cell. */
export const PIVOT_DEFAULT_METRIC: PivotMetric = {agg: 'count', alias: '记录数'};

export function pivotToSpec(definition: PivotDefinition): AnalysisSpec {
  if (definition.version !== 1) throw new Error('不支持此透视配置版本');
  const {column} = definition;
  const configuredRows = getPivotRowDimensions(definition).filter(r=>r.column);
  const emptyRows = configuredRows.length === 0;
  const metrics = definition.metrics.length ? definition.metrics : [PIVOT_DEFAULT_METRIC];
  const rawSource = definition.source;
  if (rawSource.error) throw new Error(rawSource.error);
  requireAnalysisQuery(rawSource.sql);
  // Empty 行: every record falls into a single virtual row, so totals and drill-down keep working.
  const source: DatasetDefinition = emptyRows ? {
    ...rawSource,
    sql: `SELECT *, ${literalValue(PIVOT_ALL_ROWS_VALUE)} AS ${quoteIdent(PIVOT_ALL_ROWS_COLUMN)} FROM (\n${rawSource.sql}\n) AS __pivot_all_rows_source`,
    fields: [...rawSource.fields, {name: PIVOT_ALL_ROWS_COLUMN, type: 'VARCHAR'}],
  } : rawSource;
  const rowDims: PivotDimension[] = emptyRows ? [{column: PIVOT_ALL_ROWS_COLUMN}] : configuredRows;
  const names = new Set(rawSource.fields.map(f=>f.name));
  for (const name of [...configuredRows.map(r=>r.column),column?.column,...metrics.map(m=>m.column),...definition.filters.map(f=>f.column)].filter(Boolean)) {
    if(!names.has(name!)) throw new Error(`字段 ${name} 已不存在，请修改透视配置`);
  }
  if (emptyRows && column?.column === PIVOT_ALL_ROWS_COLUMN) throw new Error('列字段名称与虚拟汇总行冲突，请改用其他字段');
  const rowCols = new Set(rowDims.map(r=>r.column));
  if (column?.column && rowCols.has(column.column)) throw new Error('行与列不能使用相同字段');
  if (metrics.some(m=>!m.alias.trim() || m.alias.length>100 || m.alias.startsWith('__pivot_'))
    || new Set(metrics.map(m=>m.alias)).size !== metrics.length) throw new Error('值名称须非空、唯一，不超过 100 字，且不能使用 __pivot_ 前缀');
  if (metrics.some(m=>!m.column && m.agg!=='count')) throw new Error('仅记录计数可以不选择数值字段');
  for(const metric of metrics)if(['sum','avg'].includes(metric.agg) && !pivotNumericType(source.fields.find(field=>field.name===metric.column)?.type || ''))throw new Error(`「${metric.column}」不是数值字段，请选择计数、去重计数或数值字段`);
  if (!Number.isInteger(definition.limit) || definition.limit<0 || definition.limit>10000) throw new Error('展示组数应为 0 至 10000 的整数');
  for(const dim of [...rowDims, ...(column?[column]:[])]) if(dim?.dateTrunc && !['day','week','month','quarter','year'].includes(dim.dateTrunc)) throw new Error('日期粒度无效');

  const spec = pivotConfigToSpec({
    tableName: source.table || source.name,
    rowDimensions: [...rowDims, ...(column ? [column] : [])],
    metrics,
    filters: definition.filters,
    sortMetric: metrics.some(m=>m.alias===definition.sortMetric)?definition.sortMetric:metrics[0].alias,
    sortOrder: definition.sortOrder,
    limit: definition.limit,
  }, {chartType:definition.view==='table'?'table':definition.chartType,title:definition.title});

  spec.dataset = {table:source.table || source.name,sql:source.sql,catalog:source.catalog,schema:source.schema};
  spec.fields = source.fields.map(f=>({column:f.name,physicalType:f.type}));

  const numRowDims = rowDims.length;
  const rowAliases = spec.dimensions.slice(0, numRowDims).map(d=>d.alias!);
  const colAlias = column ? spec.dimensions[numRowDims]?.alias : undefined;
  spec.pivotLayout = {rowAlias:rowAliases[0], columnAlias:colAlias, rowAliases};

  const dimAliases = new Set(spec.dimensions.map(d=>d.alias));
  if(metrics.some(m=>dimAliases.has(m.alias)))throw new Error('值名称不能与分组字段名称重复');
  const unit = source.fields.find(f=>/^(currency|asset)$/i.test(f.name));
  if(unit && definition.unit) spec.filters.global.push({column:unit.name,op:'=',value:definition.unit});
  const monetary = (m:PivotMetric) => !['count','count_distinct'].includes(m.agg) && /amount|fee|price|revenue|balance/i.test(m.column || '');
  if(unit && metrics.some(monetary) && !definition.unit && !spec.filters.global.some(f=>f.column===unit.name && f.op==='=' && f.value!==''))throw new Error('请选择一种计量资产，避免边际汇总混合不同资产');
  spec.visual.encoding={x:spec.dimensions[0].alias,y:[metrics[definition.visibleMetric]?.alias || metrics[0].alias],series:spec.dimensions[numRowDims]?.alias};
  spec.visual.formatByKey = Object.fromEntries(metrics.map(m=>[m.alias,{precisionSafe:true,compact:false,decimals:['count','count_distinct'].includes(m.agg)?0:(m.decimals ?? definition.decimals ?? 8),unit:monetary(m)?definition.unit:''}]));
  if(definition.view==='table') spec.visual.pivot = {
    rowKey: rowAliases[0],
    colKey: colAlias || '',
    valKey: sanitizeAlias(metrics[definition.visibleMetric]?.alias || metrics[0].alias),
    aggregation: 'sum',
    nullDisplay: definition.nullDisplay || 'dash'
  };
  return spec;
}

export async function validatePivotSource(source: DatasetDefinition): Promise<DatasetDefinition> {
  const scope = await duckDBService.getCurrentCatalogAndSchema();
  if(scope.catalog!==source.catalog || scope.schema!==source.schema)throw new Error('透视来源所属数据库或 Schema 已变化，请回到原范围再打开');
  if(source.error)throw new Error(source.error);
  await validateUniqueKeys(source.uniqueKeys || []);
  const rows = await duckDBService.readQuery(`DESCRIBE ${requireAnalysisQuery(source.sql)}`);
  const current = await duckDBService.getCurrentCatalogAndSchema();
  if(current.catalog!==scope.catalog || current.schema!==scope.schema)throw new Error('分析范围已切换，请重新打开');
  return {...source,fields:rows.map(f=>({name:String(f.column_name),type:String(f.column_type)}))};
}

export async function loadPivotRecord(id:string): Promise<AnalysisRecord> {
  const scope = await duckDBService.getCurrentCatalogAndSchema();
  const records = await dbService.getDomainSetting<AnalysisRecord[]>('linked-analyses',scope.catalog) || [];
  const record = records.find(r=>r.id===id);
  if(!record)throw new Error('关联分析已删除，请重新选择');
  if(!record.pivot)throw new Error('此历史分析没有可恢复的透视配置，请在已保存分析中查看');
  const source = await validatePivotSource(record.pivot.source);
  const pivot = {...record.pivot,source};
  if(pivot.version!==1)throw new Error('不支持此透视配置版本');
  return {...record,pivot};
}

/** Same compiler/filter semantics as the aggregate, with exact row/column bindings and bounded paging. */
export function pivotDetailSql(spec: AnalysisSpec, row:unknown, column:unknown, page:number): string {
  if (!spec.dataset.sql || !Number.isInteger(page) || page<0) throw new Error('无效明细请求');
  const clauses = [...spec.filters.global,...spec.filters.interactive].map(compileFilterClause);
  const rowAliases = spec.pivotLayout?.rowAliases || (spec.pivotLayout?.rowAlias ? [spec.pivotLayout.rowAlias] : [spec.dimensions[0]?.alias]);
  const numRowDims = rowAliases.length;

  spec.dimensions.forEach((dim,index)=>{
    let value: unknown;
    if (index < numRowDims) {
      if (typeof row === 'object' && row !== null && !Array.isArray(row)) {
        value = Object.hasOwn(row, dim.alias!) ? (row as any)[dim.alias!] : (row as any)[dim.column];
      } else {
        value = row;
      }
    } else {
      value = column;
    }
    const expr=dim.dateTrunc?`DATE_TRUNC('${dim.dateTrunc}', ${quoteIdent(dim.column)})`:quoteIdent(dim.column);
    clauses.push(value==null?`${expr} IS NULL`:`CAST(${expr} AS VARCHAR) = ${literalValue(String(value))}`);
  });
  const order = 'ALL';
  return `SELECT * FROM (\n${requireAnalysisQuery(spec.dataset.sql)}\n) AS __pivot_detail WHERE ${clauses.join(' AND ')} ORDER BY ${order} LIMIT 51 OFFSET ${page*50}`;
}

export async function savePivotRecord(definition:PivotDefinition, sql:string, chartConfig:AnalysisRecord['chartConfig'], id?:string, expectedSavedAt?:number):Promise<AnalysisRecord> {
  const scope=await duckDBService.getCurrentCatalogAndSchema();
  if(scope.catalog!==definition.source.catalog || scope.schema!==definition.source.schema)throw new Error('数据范围已切换，请重新打开透视表');
  pivotToSpec(definition);
  if(requireAnalysisQuery(sql)!==requireAnalysisQuery(compiledPivotSql(definition)))throw new Error('结果与当前透视配置不一致，请等待重新计算后保存');
  if(!definition.title.trim())throw new Error('请输入分析名称');
  let record!:AnalysisRecord;
  await mutateDomainSetting<AnalysisRecord[]>('linked-analyses',scope.catalog,current=>{
  const records=current || [];
  const previous=id?records.find(record=>record.id===id):undefined;
  if(id && !previous)throw new Error('原分析已删除，请另存为新的分析');
  if(previous && expectedSavedAt!==undefined && previous.savedAt!==expectedSavedAt)throw new Error('此分析已在其他位置更新，请重新打开或另存为，避免覆盖');
  const nextId=id || `analysis:${crypto.randomUUID()}`;
  record={...previous,id:nextId,analysisId:nextId,savedAt:Math.max(Date.now(),(previous?.savedAt || 0)+1),note:previous?.note || '',
    databaseName:scope.catalog,schemaName:scope.schema,title:definition.title,sql,chartConfig,
    sourceTables:definition.source.table?[[definition.source.catalog,definition.source.schema,definition.source.table].join('.')]:[],
    pivot:structuredClone(definition)};
  return [...records.filter(r=>r.id!==nextId),record];
  });
  window.dispatchEvent(new CustomEvent('duckdb-analysis-objects-updated'));
  window.dispatchEvent(new CustomEvent('duckdb-home-dashboard-updated'));
  return record;
}

export function compiledPivotSql(definition:PivotDefinition):string {
  return compileAnalysisSql(pivotToSpec(definition)).sql;
}

export async function buildJoinedSource(
  primaryTable: string,
  secondaryTable: string,
  joinType: 'LEFT' | 'INNER',
  primaryKey: string,
  secondaryKey: string
): Promise<{ source: DatasetDefinition; fanOutRisk: boolean }> {
  const scope = await duckDBService.getCurrentCatalogAndSchema();
  const qPrimary = [scope.catalog, scope.schema, primaryTable].map(quoteIdent).join('.');
  const qSecondary = [scope.catalog, scope.schema, secondaryTable].map(quoteIdent).join('.');

  const primaryCols = await duckDBService.readQuery(`DESCRIBE ${qPrimary}`);
  const secondaryCols = await duckDBService.readQuery(`DESCRIBE ${qSecondary}`);

  const selects: string[] = [];
  const fields: Array<{ name: string; type: string }> = [];

  for (const c of primaryCols) {
    const colName = String(c.column_name);
    const colType = String(c.column_type);
    const aliasName = `${primaryTable}.${colName}`;
    selects.push(`t1.${quoteIdent(colName)} AS ${quoteIdent(aliasName)}`);
    fields.push({ name: aliasName, type: colType });
  }
  for (const c of secondaryCols) {
    const colName = String(c.column_name);
    const colType = String(c.column_type);
    const aliasName = `${secondaryTable}.${colName}`;
    selects.push(`t2.${quoteIdent(colName)} AS ${quoteIdent(aliasName)}`);
    fields.push({ name: aliasName, type: colType });
  }

  const joinSql = `SELECT\n  ${selects.join(',\n  ')}\nFROM ${qPrimary} AS t1\n${joinType} JOIN ${qSecondary} AS t2 ON t1.${quoteIdent(primaryKey)} = t2.${quoteIdent(secondaryKey)}`;

  let fanOutRisk = false;
  try {
    const riskCheck = await duckDBService.readQuery(
      `SELECT COUNT(*) AS total_count, COUNT(DISTINCT ${quoteIdent(secondaryKey)}) AS distinct_count FROM ${qSecondary} WHERE ${quoteIdent(secondaryKey)} IS NOT NULL`
    );
    if (riskCheck.length) {
      const total = Number(riskCheck[0].total_count || 0);
      const distinct = Number(riskCheck[0].distinct_count || 0);
      if (total > distinct) {
        fanOutRisk = true;
      }
    }
  } catch {
    /* ignore check error */
  }

  const source: DatasetDefinition = {
    id: `joined:${JSON.stringify([scope.catalog, scope.schema, primaryTable, secondaryTable, joinType, primaryKey, secondaryKey])}`,
    name: `${primaryTable} ⋈ ${secondaryTable}`,
    catalog: scope.catalog,
    schema: scope.schema,
    table: primaryTable,
    kind: 'query',
    version: 1,
    sql: joinSql,
    fields,
  };

  return { source, fanOutRisk };
}

export async function listPivotRecords(): Promise<AnalysisRecord[]> {
  const scope = await duckDBService.getCurrentCatalogAndSchema();
  const records = await dbService.getDomainSetting<AnalysisRecord[]>('linked-analyses', scope.catalog) || [];
  return records.filter(r => !!r.pivot);
}

export async function deletePivotRecord(id: string): Promise<void> {
  const scope = await duckDBService.getCurrentCatalogAndSchema();
  await mutateDomainSetting<AnalysisRecord[]>('linked-analyses', scope.catalog, current => {
    return (current || []).filter(r => r.id !== id);
  });
  window.dispatchEvent(new CustomEvent('duckdb-analysis-objects-updated'));
}
