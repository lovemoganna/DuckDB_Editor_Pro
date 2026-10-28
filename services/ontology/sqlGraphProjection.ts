import { duckDBService } from '../duckdbService';
import { requireAnalysisQuery } from '../analysis/readQuery';
import type { GraphData, GraphNode, GraphLink } from '../../components/Library/D3GraphView/D3GraphView.types';

export interface NodeBinding {
  sourceSql?: string;
  type: string;
  table: string;
  /** Source key column -> query result alias. Supports composite identities. */
  key: Record<string, string>;
  label?: string;
  properties?: Record<string, string>;
}
export interface EdgeBinding {
  type: string;
  source: string;
  target: string;
  /** Optional query aliases identifying distinct parallel relationships. */
  key?: string[];
  properties?: Record<string, string>;
}
export interface ProjectionMapping { nodes: NodeBinding[]; edges: EdgeBinding[] }
export interface SliceResult { graph: GraphData; rows: Record<string, unknown>[]; skipped: number; sql: string; catalog: string }
export const SLICE_ROW_LIMIT = 1000;
/** Graph engines may mutate coordinates and resolve endpoints to objects. SQL results remain reusable. */
export function prepareSqlProjectionGraph(result: SliceResult | null): GraphData {
  if (!result) return {nodes:[],links:[],typeMap:{},linkTypeMap:{},typeNames:[]};
  return {...result.graph, nodes:result.graph.nodes.map(node=>({...node})), links:result.graph.links.map(link=>({...link,
    source: typeof link.source === 'string' ? link.source : link.source.id,
    target: typeof link.target === 'string' ? link.target : link.target.id,
  }))};
}
export const quoteIdentifier = (name: string) => `"${name.replace(/"/g, '""')}"`;
const serialize = (value: unknown) => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v);
const scalar = (value: unknown) => value === null || value === undefined || value === '' ? null :
  typeof value === 'object' ? (() => { throw new Error('对象标识必须为标量字段'); })() : String(value);

export function validateMapping(mapping: ProjectionMapping): void {
  if (!mapping || !Array.isArray(mapping.nodes) || !mapping.nodes.length || !Array.isArray(mapping.edges)) throw new Error('映射需要 nodes 和 edges 数组');
  const types = new Set<string>();
  for (const node of mapping.nodes) {
    if (!node.type?.trim() || !node.table?.trim() || !node.key || !Object.keys(node.key).length || Object.values(node.key).some(v => typeof v !== 'string' || !v)) throw new Error('每个对象需要类型、来源表及主键映射');
    if (types.has(node.type)) throw new Error(`对象类型重复：${node.type}`);
    types.add(node.type);
  }
  for (const edge of mapping.edges) {
    if (!edge.type?.trim() || !types.has(edge.source) || !types.has(edge.target)) throw new Error('关系需要类型及有效的源、目标对象类型');
    if (edge.key && (!Array.isArray(edge.key) || edge.key.some(k => typeof k !== 'string' || !k))) throw new Error('关系标识需要查询字段数组');
  }
}

/** Only query rows contribute nodes/edges. No expansion into the ontology repository. */
export function projectSqlRows(rows: Record<string, unknown>[], mapping: ProjectionMapping, catalog: string): { graph: GraphData; skipped: number } {
  validateMapping(mapping);
  const nodes = new Map<string, GraphNode>();
  const links = new Map<string, GraphLink>();
  let skipped = 0;
  const read = (row: Record<string, unknown>, alias: string) => {
    if (!Object.hasOwn(row, alias)) throw new Error(`查询缺少映射字段：${alias}`);
    return row[alias];
  };
  const properties = (row: Record<string, unknown>, fields: Record<string, string> = {}) => Object.fromEntries(Object.entries(fields).map(([name, alias]) => [name, read(row, alias)]));
  rows.forEach((row, rowIndex) => {
    const ids = new Map<string, string>();
    mapping.nodes.forEach((binding, index) => {
      const key = Object.fromEntries(Object.entries(binding.key).map(([name, alias]) => [name, scalar(read(row, alias))]));
      if (Object.values(key).some(v => v === null)) { skipped++; return; }
      const id = serialize([catalog, binding.table, binding.type, key]);
      ids.set(binding.type, id);
      const props = properties(row, binding.properties);
      const label = binding.label ? scalar(read(row, binding.label)) : null;
      const trace = { catalog, table: binding.table, key, properties: props, ...(binding.sourceSql ? {sql:binding.sourceSql} : {}) };
      const existing = nodes.get(id);
      if (existing && existing._fingerprint !== serialize([label, trace])) throw new Error(`同一对象出现冲突属性：${binding.type}，请核对主键或 JOIN 粒度`);
      if (existing) { existing._rowIndices.push(rowIndex); return; }
      nodes.set(id, { id, label: label || `${binding.type} ${Object.values(key).join(' / ')}`, group: 'instance',
        color: ['#528aa3', '#8a70a6', '#a67b52', '#56877a'][index % 4], size: 13,
        description: serialize(trace), _propsRaw: serialize(props), _typeName: binding.type,
        _typeId: index + 1, _propsCount: Object.keys(props).length,
        _trace: trace, _rowIndices: [rowIndex], _fingerprint: serialize([label, trace]) });
    });
    mapping.edges.forEach((binding, index) => {
      const source = ids.get(binding.source), target = ids.get(binding.target);
      if (!source || !target) { skipped++; return; }
      const key = (binding.key || []).map(alias => scalar(read(row, alias)));
      if (key.some(k => k === null)) throw new Error(`关系标识为空：${binding.type}`);
      const id = serialize([source, target, binding.type, key]);
      const props = properties(row, binding.properties);
      const existing = links.get(id);
      if (existing && serialize(existing._properties) !== serialize(props)) throw new Error(`同一关系出现冲突属性：${binding.type}，请设置关系 key`);
      if (existing) { existing._rowIndices.push(rowIndex); return; }
      links.set(id, { source, target, color: '#a67b52', weight: 0.8, _id: id, id, _linkTypeId: index + 1,
        _linkTypeName: binding.type, _properties: props, _rowIndices: [rowIndex] });
    });
  });
  return { graph: { nodes: [...nodes.values()], links: [...links.values()],
    typeMap: Object.fromEntries(mapping.nodes.map((n,i)=>[i+1,{id:i+1,name:n.type,description:n.table}])),
    linkTypeMap: Object.fromEntries(mapping.edges.map((e,i)=>[i+1,{id:i+1,name:e.type,description:'SQL 查询中的显式关系'}])),
    typeNames: mapping.nodes.map(n => n.type) }, skipped };
}

export async function executeSqlSlice(sql: string, mapping: ProjectionMapping): Promise<SliceResult> {
  validateMapping(mapping);
  const statement = requireAnalysisQuery(sql);
  const context = duckDBService.getRuntimeInfo();
  const catalog = context.currentDatabase;
  const rows = await duckDBService.readQuery(`SELECT * FROM (\n${statement}\n) AS __ontology_slice LIMIT ${SLICE_ROW_LIMIT + 1}`);
  const current = duckDBService.getRuntimeInfo();
  if (current.currentDatabase !== catalog || current.databaseContextRevision !== context.databaseContextRevision) throw new Error('数据库上下文已变化，请重新查询');
  if (rows.length > SLICE_ROW_LIMIT) throw new Error(`切片超过 ${SLICE_ROW_LIMIT} 行，请缩小 SQL 条件；未展示截断图谱`);
  return { ...projectSqlRows(rows, mapping, catalog), rows, sql: statement, catalog };
}

export interface SliceTable { catalog: string; schema: string; name: string; columns: string[]; primaryKey: string[]; sourceSql?: string; provenance?: string }
const sliceTableSql = (table: SliceTable) => table.sourceSql ? `(\n${requireAnalysisQuery(table.sourceSql)}\n)` : [table.catalog, table.schema, table.name].map(quoteIdentifier).join('.');

/** Suggestions are checked against current data; field names alone never establish identity. */
export async function suggestSliceIdentity(table: SliceTable): Promise<string> {
  const candidates = table.primaryKey.length === 1 ? table.primaryKey : table.columns.filter(c => /(^id$|_id$|^uid$)/i.test(c)).slice(0, 6);
  if (!candidates.length) return '';
  const context = duckDBService.getRuntimeInfo();
  const rows = await duckDBService.readQuery(`SELECT COUNT(*) AS total, ${candidates.map((c, i) => `COUNT(DISTINCT NULLIF(CAST(${quoteIdentifier(c)} AS VARCHAR), '')) AS k${i}`).join(', ')} FROM ${sliceTableSql(table)}`);
  const now = duckDBService.getRuntimeInfo();
  if (now.currentDatabase !== context.currentDatabase || now.databaseContextRevision !== context.databaseContextRevision) throw new Error('数据库上下文已变化');
  const row = rows[0];
  return row && Number(row.total) > 0 ? candidates.find((_, i) => Number(row[`k${i}`]) === Number(row.total)) || '' : candidates[0] || '';
}

export async function validateSliceIdentity(table: SliceTable, key: string): Promise<void> {
  if (!table.columns.includes(key)) throw new Error('请选择真实的对象标识字段');
  const context = duckDBService.getRuntimeInfo();
  const rows = await duckDBService.readQuery(`SELECT COUNT(*) AS total, COUNT(DISTINCT NULLIF(CAST(${quoteIdentifier(key)} AS VARCHAR), '')) AS unique_keys FROM ${sliceTableSql(table)}`);
  const now = duckDBService.getRuntimeInfo();
  if (now.currentDatabase !== context.currentDatabase || now.databaseContextRevision !== context.databaseContextRevision) throw new Error('数据库上下文已变化');
  if (!rows[0] || Number(rows[0].total) !== Number(rows[0].unique_keys)) throw new Error(`${table.name}.${key} 存在重复或空值，不能唯一识别对象。请选择订单号等唯一字段；复合标识可在高级查询中配置。`);
}

export async function listSliceValues(table: SliceTable, field: string): Promise<string[]> {
  if (!table.columns.includes(field)) return [];
  const context = duckDBService.getRuntimeInfo();
  const column = quoteIdentifier(field);
  const rows = await duckDBService.readQuery(`SELECT DISTINCT CAST(${column} AS VARCHAR) AS value FROM ${sliceTableSql(table)} WHERE ${column} IS NOT NULL ORDER BY value LIMIT 50`);
  const now = duckDBService.getRuntimeInfo();
  if (now.currentDatabase !== context.currentDatabase || now.databaseContextRevision !== context.databaseContextRevision) throw new Error('数据库上下文已变化');
  return rows.map(row => String(row.value));
}

export interface SliceFilter { field: string; operator: 'eq' | 'neq' | 'contains' | 'null' | 'notnull'; value: string }
/** Text matching keeps the guided flow type-independent, with escaped literals and validated identifiers. */
export function applySliceFilters(sql: string, table: SliceTable, filters: SliceFilter[]): string {
  if (!filters.length) return sql;
  const conditions = filters.map(filter => {
    if (!table.columns.includes(filter.field)) throw new Error('请为每条筛选选择字段，或移除不需要的筛选');
    const column = `s.${quoteIdentifier(filter.field)}`;
    const literal = `'${filter.value.replace(/'/g, "''")}'`;
    switch (filter.operator) {
      case 'eq': return `CAST(${column} AS VARCHAR) = ${literal}`;
      case 'neq': return `CAST(${column} AS VARCHAR) <> ${literal}`;
      case 'contains': return `contains(CAST(${column} AS VARCHAR), ${literal})`;
      case 'null': return `${column} IS NULL`;
      case 'notnull': return `${column} IS NOT NULL`;
      default: throw new Error('不支持的筛选方式');
    }
  });
  return `${sql}\nWHERE ${conditions.join('\n  AND ')}\n`;
}
export async function discoverSliceTables(): Promise<SliceTable[]> {
  const context = duckDBService.getRuntimeInfo();
  const rows = await duckDBService.readQuery(`SELECT c.table_catalog,c.table_schema,c.table_name,c.column_name,
    EXISTS (SELECT 1 FROM information_schema.key_column_usage k JOIN information_schema.table_constraints t
      ON t.constraint_catalog=k.constraint_catalog AND t.constraint_schema=k.constraint_schema AND t.constraint_name=k.constraint_name
      WHERE t.constraint_type='PRIMARY KEY' AND k.table_catalog=c.table_catalog AND k.table_schema=c.table_schema
      AND k.table_name=c.table_name AND k.column_name=c.column_name) AS is_pk
    FROM information_schema.columns c WHERE c.table_catalog=current_database() ORDER BY c.table_schema,c.table_name,c.ordinal_position`);
  const now = duckDBService.getRuntimeInfo();
  if (now.currentDatabase !== context.currentDatabase || now.databaseContextRevision !== context.databaseContextRevision) throw new Error('数据库上下文已变化');
  const tables = new Map<string, SliceTable>();
  for (const row of rows) {
    const id = serialize([row.table_catalog,row.table_schema,row.table_name]);
    if (!tables.has(id)) tables.set(id, { catalog: row.table_catalog, schema: row.table_schema, name: row.table_name, columns: [], primaryKey: [] });
    const table = tables.get(id)!; table.columns.push(row.column_name);
    if (row.is_pk) table.primaryKey.push(row.column_name);
  }
  return [...tables.values()];
}

/** Explicit user-confirmed join, never inferred from similar field names. */
export function buildSliceQuery(source: SliceTable, key: string, target?: SliceTable, foreignKey?: string, targetKey?: string): { sql: string; mapping: ProjectionMapping } {
  const tableSql = sliceTableSql;
  const bind = (table: SliceTable, pk: string, prefix: string, type: string): NodeBinding => {
    if (!table.columns.includes(pk)) throw new Error('请选择真实的对象标识字段');
    const label = table.columns.find(c => /^(name|title)$|_name$/i.test(c)) || pk;
    return { type, table: table.provenance || [table.catalog, table.schema, table.name].map(quoteIdentifier).join('.'), ...(table.sourceSql?{sourceSql:table.sourceSql}:{}), key: { [pk]: `${prefix}${pk}` }, label: `${prefix}${label}`, properties: Object.fromEntries(table.columns.map(c => [c, `${prefix}${c}`])) };
  };
  const nodes = [bind(source, key, 's_', source.name)];
  const fields = source.columns.map(c => `s.${quoteIdentifier(c)} AS ${quoteIdentifier(`s_${c}`)}`);
  let join = '';
  const edges: EdgeBinding[] = [];
  if (target) {
    if (!source.columns.includes(foreignKey || '') || !target.columns.includes(targetKey || '')) throw new Error('请选择关联字段');
    const type = target.name === source.name ? `${target.name}（关联对象）` : target.name;
    nodes.push(bind(target, targetKey!, 't_', type));
    fields.push(...target.columns.map(c => `t.${quoteIdentifier(c)} AS ${quoteIdentifier(`t_${c}`)}`));
    join = `\nLEFT JOIN ${tableSql(target)} t ON s.${quoteIdentifier(foreignKey!)} = t.${quoteIdentifier(targetKey!)}`;
    edges.push({ type: `${source.name}.${foreignKey} → ${target.name}.${targetKey}`, source: source.name, target: type });
  }
  return { sql: `SELECT\n  ${fields.join(',\n  ')}\nFROM ${tableSql(source)} s${join}\n-- 在此添加 WHERE 条件以限定当前任务\n`, mapping: { nodes, edges } };
}
