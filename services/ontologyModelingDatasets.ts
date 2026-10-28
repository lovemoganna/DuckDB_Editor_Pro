import type { DatasetDefinition } from './workbench/analysisTypes';
import { loadDatasets } from './workbench/datasets';
import { requireAnalysisQuery } from './analysis/readQueryGuard';
import type { ModelingObjectType, OntologyModelingResult } from './ontologyModelingService';

export function modelingPropertyType(sqlType: string) {
  const type = sqlType.toUpperCase();
  if (/^(U?(TINY|SMALL|BIG|HUGE)?INT|INTEGER)/.test(type)) return 'INTEGER' as const;
  if (/^(DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL)/.test(type)) return 'DECIMAL' as const;
  if (/^BOOL/.test(type)) return 'BOOLEAN' as const;
  if (/^(DATE|TIMESTAMP)/.test(type)) return 'TIMESTAMP' as const;
  if (/^(JSON|STRUCT|MAP|LIST)|\[\]$/.test(type)) return 'JSON' as const;
  return 'VARCHAR' as const;
}

export function datasetModelingMapping(dataset: DatasetDefinition, owner: string, definition = dataset): NonNullable<ModelingObjectType['mapping']> {
  if (dataset.error || definition.error) throw new Error(`数据集不可用：${dataset.error || definition.error}`);
  if (dataset.version !== definition.version) throw new Error('当前数据集版本已变化，请重新选择后创建类型。');
  return { catalog: dataset.catalog, schema: dataset.schema, table: dataset.table || '', idField: '',
    properties: Object.fromEntries(dataset.fields.map(f => [f.name, f.name])),
    dataset: { owner, id: dataset.id, version: definition.version, sql: requireAnalysisQuery(dataset.sql),
      definitionSql: definition.sql, name: dataset.name } };
}

/** Resolve the same registry used by Home; never silently fall back to an obsolete SQL snapshot. */
export async function resolveModelingDatasets(draft: OntologyModelingResult, loader = loadDatasets) {
  const owners = new Map<string, DatasetDefinition[]>();
  const resolved = new Map<string, DatasetDefinition>();
  for (const type of draft.objectTypes) {
    const ref = type.mapping?.dataset;
    if (!ref) continue;
    if (!owners.has(ref.owner)) owners.set(ref.owner, await loader(ref.owner));
    const current = owners.get(ref.owner)!.find(d => d.id === ref.id);
    if (!current || current.error || current.version !== ref.version || current.sql !== ref.definitionSql) {
      throw new Error(`对象 ${type.name} 的数据集「${ref.name}」已修改、删除或不可用，请重新选择数据集并预览。`);
    }
    const fields = new Set(current.fields.map(f => f.name));
    if (![type.mapping!.idField, ...Object.values(type.mapping!.properties)].every(f => fields.has(f)))
      throw new Error(`对象 ${type.name} 的数据集字段已变化，请重新选择来源字段并预览。`);
    requireAnalysisQuery(ref.sql);
    resolved.set(type.name, current);
  }
  return resolved;
}
