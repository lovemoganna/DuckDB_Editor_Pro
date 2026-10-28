import { requireAnalysisQuery } from '../analysis/readQueryGuard';
import { quoteIdent } from '../databaseCatalog';
import type { AnalysisFilter, CompiledAnalysis, DatasetDefinition, WidgetQuerySpec } from './analysisTypes';

/** Offsets preserve comments/literals; only FROM/JOIN relations are replaced. */
export function sqlTokens(sql: string) {
  const pattern = /--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Za-z_][\w$]*|\d+(?:\.\d+)?|[^\s]/g;
  return [...sql.matchAll(pattern)].filter(m => !m[0].startsWith('--') && !m[0].startsWith('/*'))
    .map(m => ({ text: m[0], start: m.index!, end: m.index! + m[0].length }));
}
const ident = (s: string) => s.startsWith('"') ? s.slice(1, -1).replace(/""/g, '"') : s;
const isIdent = (s: string) => /^(?:[A-Za-z_][\w$]*|"(?:""|[^"])*")$/.test(s);
function declaredCtes(sql: string): Set<string> {
  const tokens=sqlTokens(sql), names=new Set<string>();
  for(let i=0;i<tokens.length;i++) {
    if(!/^with$/i.test(tokens[i].text))continue;
    let cursor=i+1;
    if(/^recursive$/i.test(tokens[cursor]?.text||''))cursor++;
    const skipGroup=()=>{
      let depth=0;
      do { const text=tokens[cursor++]?.text;if(text==='(')depth++;else if(text===')')depth--; } while(cursor<tokens.length&&depth>0);
    };
    while(isIdent(tokens[cursor]?.text||'')) {
      const name=ident(tokens[cursor++].text);
      if(tokens[cursor]?.text==='(')skipGroup();
      if(!/^as$/i.test(tokens[cursor++]?.text||''))break;
      if(/^not$/i.test(tokens[cursor]?.text||''))cursor++;
      if(/^materialized$/i.test(tokens[cursor]?.text||''))cursor++;
      if(tokens[cursor]?.text!=='(')break;
      names.add(name);skipGroup();
      if(tokens[cursor]?.text!==',')break;
      cursor++;
    }
  }
  return names;
}
export function relationReferences(sql: string) {
  const tokens = sqlTokens(sql);
  const refs: { parts: string[]; start: number; end: number; alias: boolean }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    // IS [NOT] DISTINCT FROM compares values; its FROM token does not introduce a relation.
    if (/^from$/i.test(tokens[i].text) && /^distinct$/i.test(tokens[i - 1]?.text || '')) continue;
    if (!/^(from|join)$/i.test(tokens[i].text) || !tokens[i + 1] || !isIdent(tokens[i + 1].text)) continue;
    const start = ++i, parts = [ident(tokens[i].text)];
    while (tokens[i + 1]?.text === '.' && tokens[i + 2] && isIdent(tokens[i + 2].text)) { i += 2; parts.push(ident(tokens[i].text)); }
    if (tokens[i + 1]?.text === '(') continue; // table function, never guess its fields
    const next = tokens[i + 1]?.text || '';
    const alias = /^as$/i.test(next) || (isIdent(next) && !/^(where|join|left|right|full|inner|cross|on|using|group|order|having|limit|offset|union|except|intersect|qualify|window|pivot|unpivot|sample)$/i.test(next));
    refs.push({ parts, start: tokens[start].start, end: tokens[i].end, alias });
  }
  return refs;
}
export function datasetForRelation(parts: string[], datasets: DatasetDefinition[], catalog: string, schema: string) {
  const targetTable = parts.at(-1);
  const targetSchema = parts.at(-2);
  const targetCatalog = parts.at(-3);
  return datasets.find(d => {
    if (d.table !== targetTable) return false;
    if (targetSchema && d.schema !== targetSchema) return false;
    if (targetCatalog) return d.catalog === targetCatalog;
    return (d.schema === schema || !d.schema) && (d.catalog === catalog || d.catalog === 'memory');
  });
}

function predicate(filter: AnalysisFilter, dataset: DatasetDefinition, params: CompiledAnalysis['params']) {
  if (filter.operator === 'in') {
    if (!filter.values?.length) return 'FALSE';
    return `(${filter.values.map(value => predicate({ ...filter, operator: 'eq', value }, dataset, params)).join(' OR ')})`;
  }
  const field = filter.bindings[dataset.id];
  const meta = dataset.fields.find(f => f.name === field);
  if (!meta) throw new Error(`筛选字段 ${field} 不属于数据集 ${dataset.name}`);
  const column = quoteIdent(field);
  if (filter.operator === 'isNull') return `${column} IS NULL`;
  if (filter.operator === 'notNull') return `${column} IS NOT NULL`;
  const numeric = /INT|DECIMAL|DOUBLE|FLOAT|REAL|NUMERIC/i.test(meta.type);
  let value: string | number | boolean = filter.value;
  if (numeric) { if (!filter.value.trim() || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(filter.value.trim()) || !Number.isFinite(Number(filter.value))) throw new Error(`${field} 需要有效数字`); value = filter.value.trim(); }
  else if (/BOOLEAN/i.test(meta.type)) { if (!/^(true|false)$/i.test(filter.value)) throw new Error(`${field} 需要 true 或 false`); value = filter.value.toLowerCase() === 'true'; }
  if (/DATE|TIME/i.test(meta.type) && !Number.isFinite(Date.parse(filter.value))) throw new Error(`${field} 需要有效日期时间`);
  if (filter.operator === 'contains') { params.push(String(value)); return `contains(CAST(${column} AS VARCHAR), ?)`; }
  const operator = { eq: '=', ne: '<>', gte: '>=', lt: '<', lte: '<=' }[filter.operator];
  if (!operator) throw new Error('不支持的筛选运算');
  params.push(value);
  return `${column} ${operator} ${numeric ? `CAST(? AS ${meta.type})` : '?'}`;
}

export function validateFilters(filters: AnalysisFilter[], datasets: DatasetDefinition[]) {
  for (const filter of filters) {
    if (!Object.keys(filter.bindings).length) throw new Error(`筛选 ${filter.field} 至少需要一个数据集绑定`);
    for (const id of Object.keys(filter.bindings)) {
      const dataset = datasets.find(d=>d.id===id);
      if (!dataset) throw new Error(`筛选 ${filter.field} 的数据集已不可访问，请移除该绑定`);
      predicate(filter,dataset,[]);
    }
  }
}

/** Executable review copy for the SQL editor; execution always uses prepared params. */
export function analysisSqlForEditor(compiled: CompiledAnalysis) {
  let index=0,sql=compiled.sql;
  const replacements=sqlTokens(sql).filter(token=>token.text==='?').map(token=>{
    const value=compiled.params[index++];
    if(value===undefined)throw new Error('查询参数缺失');
    const literal=value===null?'NULL':typeof value==='string'?`'${value.replace(/'/g,"''")}'`:String(value);
    return {...token,literal};
  });
  if(index!==compiled.params.length)throw new Error('查询参数数量不匹配');
  for(const replacement of replacements.reverse())sql=sql.slice(0,replacement.start)+replacement.literal+sql.slice(replacement.end);
  return sql;
}

export function compileAnalysis(input: {
  sql: string; catalog: string; schema: string; datasets: DatasetDefinition[];
  globalFilters?: AnalysisFilter[]; localFilters?: AnalysisFilter[]; spec?: WidgetQuerySpec;
}): CompiledAnalysis {
  const result: CompiledAnalysis = { sql: '', params: [], notices: [], datasetIds: [] };
  const globals = input.globalFilters || [], locals = input.localFilters || [];
  const used = new Set<string>();
  const conditions = (dataset: DatasetDefinition) => [...globals, ...locals].filter(filter => filter.bindings[dataset.id]).map(filter => {
    used.add(filter.id); return predicate(filter, dataset, result.params);
  });
  if (input.spec) {
    const spec = input.spec, dataset = input.datasets.find(d => d.id === spec.datasetId);
    if (!dataset) throw new Error('组件绑定的数据集已不存在，请重新绑定');
    if (dataset.error) throw new Error(`数据集 ${dataset.name} 不可用：${dataset.error}`);
    const field = (name: string) => { if (!dataset.fields.some(f => f.name === name)) throw new Error(`数据集字段 ${name} 已失效`); return quoteIdent(name); };
    const dimensionNames = [...new Set(spec.dimensions)];
    if (dimensionNames.includes('value') && spec.aggregation!=='DETAIL') throw new Error('value 是结果度量名称，请为此维度建立另一个字段名');
    if (spec.timeGrain && !dimensionNames.length) throw new Error('请选择时间维度');
    if (spec.timeGrain && !['day','week','month','year'].includes(spec.timeGrain)) throw new Error('时间粒度无效');
    const dimensions = dimensionNames.map(name=> {
      const column=field(name);
      if (!spec.timeGrain || name!==dimensionNames[0]) return column;
      if (!/DATE|TIMESTAMP/i.test(dataset.fields.find(f=>f.name===name)!.type)) throw new Error('时间粒度需要日期或时间戳维度');
      return `date_trunc('${spec.timeGrain}', ${column})`;
    });
    if (!['COUNT','SUM','AVG','MIN','MAX','DETAIL'].includes(spec.aggregation)) throw new Error('聚合方式无效');
    const measure = spec.measure ? field(spec.measure) : '*';
    if (measure === '*' && !['COUNT','DETAIL'].includes(spec.aggregation)) throw new Error('请选择度量字段');
    const where = conditions(dataset);
    const select = spec.aggregation==='DETAIL' ? '*' : `${dimensions.map((d,i)=>`${d} AS ${field(dimensionNames[i])}`).join(', ')}${dimensions.length?', ':''}${spec.aggregation}(${measure}) AS value`;
    result.sql = `SELECT ${select} FROM (\n${requireAnalysisQuery(dataset.sql)}\n) AS dataset${where.length ? ' WHERE ' + where.join(' AND ') : ''}${spec.aggregation!=='DETAIL'&&dimensions.length ? ' GROUP BY ' + dimensions.join(', ') : ''}${spec.aggregation==='DETAIL'?' ORDER BY ALL':dimensions.length?' ORDER BY '+dimensions.join(', '):''}`;
    result.datasetIds.push(dataset.id);
  } else {
    const sql = requireAnalysisQuery(input.sql);
    if (sqlTokens(sql).some(t => t.text === '?')) throw new Error('自定义 SQL 的位置参数尚未绑定');
    const refs = relationReferences(sql);
    const ctes = declaredCtes(sql);
    if (globals.length || locals.length) {
      let depth=0; const fromDepths=new Set<number>();
      const tokens=sqlTokens(sql);
      for(const [index,token] of tokens.entries()) {
        if(token.text==='(')depth++;
        else if(token.text===')'){fromDepths.delete(depth);depth--;}
        else if(/^from$/i.test(token.text))fromDepths.add(depth);
        else if(/^(where|group|order|having|limit|union|qualify)$/i.test(token.text))fromDepths.delete(depth);
        else if(token.text===',' && fromDepths.has(depth)) {
          // A lateral table function adds derived rows, not an untracked source relation.
          const lateralFunction=/^lateral$/i.test(tokens[index+1]?.text||'')
            && isIdent(tokens[index+2]?.text||'') && tokens[index+3]?.text==='(';
          if(!lateralFunction)throw new Error('逗号关联 SQL 尚不支持统一筛选，请改用显式 JOIN 或结构化数据集');
        }
      }
    }
    const replacements: { start: number; end: number; sql: string }[] = [];
    for (const ref of refs) {
      const dataset = datasetForRelation(ref.parts, input.datasets, input.catalog, input.schema);
      if (!dataset) {
        if (ref.parts.length===1 && ctes.has(ref.parts[0])) continue;
        throw new Error(`数据来源 ${ref.parts.join('.')} 不可访问或缺少字段元数据`);
      }
      if (ref.parts.length === 1 && new RegExp(`(?:WITH|,)\\s*"?${dataset.table!.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"?\\s+AS\\s*\\(`,'i').test(sql)) {
        if ([...globals,...locals].some(f => f.bindings[dataset.id])) throw new Error('CTE 与来源表同名，请改名或绑定结构化数据集');
        continue;
      }
      result.datasetIds.push(dataset.id);
      const where = conditions(dataset);
      const qualified = `${quoteIdent(dataset.catalog)}.${quoteIdent(dataset.schema)}.${quoteIdent(dataset.table!)}`;
      replacements.push({ start: ref.start, end: ref.end, sql: where.length
        ? `(SELECT * FROM ${qualified} WHERE ${where.join(' AND ')})${ref.alias ? '' : ' AS ' + quoteIdent(dataset.table!)}`
        : qualified });
    }
    result.sql = sql;
    for (const replacement of replacements.reverse()) result.sql = result.sql.slice(0,replacement.start) + replacement.sql + result.sql.slice(replacement.end);
  }
  for (const filter of locals) if (!used.has(filter.id)) throw new Error(`局部筛选 ${filter.field} 未绑定到此组件来源`);
  for (const filter of globals) if (!used.has(filter.id)) result.notices.push(`不参与筛选：${filter.field}（未绑定此数据集）`);
  result.datasetIds = [...new Set(result.datasetIds)];
  requireAnalysisQuery(result.sql);
  return result;
}
