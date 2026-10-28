import { ontologyModelingService, type OntologyModelingResult, type ModelingObjectType } from './ontologyModelingService';
import { requireAnalysisQuery } from './analysis/readQueryGuard';
import { resolveModelingDatasets } from './ontologyModelingDatasets';
import { validateUniqueKeys } from './workbench/datasetGuards';

export const emptyModelingDraft = (): OntologyModelingResult => ({
  modelingVersion: 1, title: '本体草案', domain: '手动建模', rationale: '对象类型定义与真实数据实例分层管理。',
  objectTypes: [], objects: [], linkTypes: [], links: [], actions: [], validationIssues: [], healthScore: 100,
  suggestedDDL: '', seedData: {}, graphLayout: { nodes: [], links: [] },
});

export function normalizeModelingDraft(draft: OntologyModelingResult): OntologyModelingResult {
  const { issues, score } = ontologyModelingService.validateModel(draft);
  if (draft.instanceMappingSignature && draft.instanceMappingSignature !== modelingMappingSignature(draft) && draft.objects.some(o => o.provenance)) {
    issues.push({ id: 'mapping-stale', level: 'error', category: 'syntax', message: '数据映射或对象标识已修改，实例预览已过期。', fix: '打开数据映射，重新查询真实实例后再保存。' });
  }
  const seedData: OntologyModelingResult['seedData'] = {};
  draft.objects.forEach(o => { (seedData[o.objectType] ||= []).push(o); });
  return { ...draft, modelingVersion: 1, validationIssues: issues, healthScore: score, seedData,
    graphLayout: {
      nodes: draft.objectTypes.map((t, i) => ({ id: t.name, label: t.name, group: t.category || 'Core', objectType: t.name,
        x: 200 + (i % 3) * 240, y: 160 + Math.floor(i / 3) * 160 })),
      links: draft.linkTypes.map(l => ({ source: l.fromType, target: l.toType, label: l.verb || l.name })),
    },
  };
}

/** AI examples are hypotheses, never business instances. */
export function schemaProposal(result: OntologyModelingResult, base = emptyModelingDraft()): OntologyModelingResult {
  return normalizeModelingDraft({ ...base, ...result, baseRevision: base.baseRevision, baseline: base.baseline,
    objectTypes: result.objectTypes.map(t => {
      const old = base.objectTypes.find(o => o.name === t.name);
      return { ...old, ...t, sourceId: old?.sourceId, identifier: t.identifier || old?.identifier || t.name, mapping: old?.mapping };
    }),
    linkTypes: result.linkTypes.map(l => ({ ...base.linkTypes.find(o => o.name === l.name), ...l,
      sourceId: base.linkTypes.find(o => o.name === l.name)?.sourceId })),
    objects: base.objects, links: base.links,
    actions: result.actions.map(a => ({ ...a,
      objectName: result.objects.find(o => o.name === a.objectName)?.objectType || a.objectName,
      sourceId: base.actions.find(o => o.name === a.name)?.sourceId })),
  });
}

export type ModelingSuggestion = { id: string; kind: 'objectTypes' | 'linkTypes' | 'actions'; name: string; before?: unknown; after?: unknown };
export function diffModelingDraft(base: OntologyModelingResult, next: OntologyModelingResult): ModelingSuggestion[] {
  return (['objectTypes', 'linkTypes', 'actions'] as const).flatMap(kind => {
    const names = new Set([...base[kind].map(t => t.name), ...next[kind].map(t => t.name)]);
    return [...names].flatMap(name => {
      const before = base[kind].find(t => t.name === name), after = next[kind].find(t => t.name === name);
      return JSON.stringify(before) === JSON.stringify(after) ? [] : [{ id: `${kind}:${name}`, kind, name, before, after }];
    });
  });
}
export function acceptModelingSuggestion(draft: OntologyModelingResult, suggestion: ModelingSuggestion): OntologyModelingResult {
  const current = draft[suggestion.kind].find(t => t.name === suggestion.name);
  if (JSON.stringify(current) !== JSON.stringify(suggestion.before)) throw new Error('该元素已被手动修改，请重新生成建议。');
  return normalizeModelingDraft({ ...draft, [suggestion.kind]: [
    ...draft[suggestion.kind].filter(t => t.name !== suggestion.name), ...(suggestion.after ? [suggestion.after] : []),
  ] });
}

export function deletionImpact(draft: OntologyModelingResult, typeName: string) {
  const objects = draft.objects.filter(o => o.objectType === typeName);
  const names = new Set(objects.map(o => o.name));
  const relations = draft.linkTypes.filter(l => l.fromType === typeName || l.toType === typeName);
  return { objects, relations, relatedTypes: [...new Set(relations.flatMap(l => [l.fromType, l.toType]).filter(n => n !== typeName))],
    links: draft.links.filter(l => names.has(l.from) || names.has(l.to) || relations.some(t => t.name === l.linkType)),
    actions: draft.actions.filter(a => a.objectName === typeName || names.has(a.objectName)),
    externalReferences: draft.dependentReferences?.filter(r => objects.some(o => o.sourceId === r.objectId)) || [] };
}

export function deleteModelingType(draft: OntologyModelingResult, name: string) {
  const impact = deletionImpact(draft, name);
  const next = { ...draft, objectTypes: draft.objectTypes.filter(t => t.name !== name),
    objects: draft.objects.filter(o => !impact.objects.includes(o)), linkTypes: draft.linkTypes.filter(l => !impact.relations.includes(l)),
    links: draft.links.filter(l => !impact.links.includes(l)), actions: draft.actions.filter(a => !impact.actions.includes(a)) };
  if (draft.instanceMappingSignature === modelingMappingSignature(draft)) next.instanceMappingSignature = modelingMappingSignature(next);
  return normalizeModelingDraft(next);
}

export const quoteModelingIdent = (s: string) => `"${s.replace(/"/g, '""')}"`;
export const mappingTableSql = (m: NonNullable<ModelingObjectType['mapping']>) => m.dataset
  ? `(\n${requireAnalysisQuery(m.dataset.sql)}\n)` : [m.catalog, m.schema, m.table].map(quoteModelingIdent).join('.');
export const modelingMappingSignature = (d: OntologyModelingResult) => JSON.stringify({ types: d.objectTypes.map(t => [t.name, t.identifier, t.mapping]), relations: d.linkTypes.map(l => [l.name, l.fromType, l.toType, l.mapping]) });
export type ModelingQuery = (sql: string) => Promise<any[]>;

/** Query actual source tables; never invent rows or infer joins. Reject null/duplicate identities. */
export async function queryModelingInstances(draft: OntologyModelingResult, query: ModelingQuery): Promise<OntologyModelingResult> {
  const datasets = await resolveModelingDatasets(draft);
  for (const dataset of datasets.values()) if (dataset.uniqueKeys?.length) await validateUniqueKeys(dataset.uniqueKeys);
  const objects: OntologyModelingResult['objects'] = draft.objects.filter(o => !o.provenance);
  const links: OntologyModelingResult['links'] = draft.links.filter(l => !l.provenance);
  const keys = new Map<string, Map<string, string>>();
  for (const t of draft.objectTypes) {
    const m = t.mapping;
    if (!m) continue;
    const table = mappingTableSql(m), id = quoteModelingIdent(m.idField);
    const columns = m.dataset ? await query(`DESCRIBE SELECT * FROM ${table} AS dataset_source`)
      : await query(`SELECT column_name FROM information_schema.columns WHERE table_catalog = '${m.catalog.replace(/'/g, "''")}' AND table_schema = '${m.schema.replace(/'/g, "''")}' AND table_name = '${m.table.replace(/'/g, "''")}'`);
    const fields = new Set(columns.map(c => c.column_name));
    if (![m.idField, ...Object.values(m.properties)].every(f => fields.has(f))) throw new Error(`${t.name} 映射字段不存在，请重新选择真实字段。`);
    const invalid = await query(`SELECT ${id} FROM ${table} AS dataset_source GROUP BY ${id} HAVING ${id} IS NULL OR count(*) > 1 LIMIT 1`);
    if (invalid.length) throw new Error(`${t.name} 的标识字段存在空值或重复值，请选择唯一且非空的字段。`);
    const rows = await query(`SELECT * FROM ${table} AS dataset_source LIMIT 501`);
    if (rows.length > 500) throw new Error(`${t.name} 超过 500 行预览上限，请先在 DuckDB 创建筛选视图。`);
    const byKey = new Map<string, string>(); keys.set(t.name, byKey);
    for (const row of rows) {
      const key = String(row[m.idField]);
      const name = `${t.identifier || t.name}:${key}`;
      byKey.set(key, name);
      const previous = draft.objects.find(o => o.name === name);
      objects.push({ name, objectType: t.name, sourceId: previous?.sourceId,
        properties: Object.fromEntries(Object.entries(m.properties).map(([p, f]) => [p, row[f]])),
        annotations: `DuckDB: ${table}; identity=${m.idField}`, provenance: { ...m, key } });
    }
  }
  for (const l of draft.linkTypes) {
    if (!l.mapping) continue;
    const from = draft.objectTypes.find(t => t.name === l.fromType)?.mapping;
    const to = draft.objectTypes.find(t => t.name === l.toType)?.mapping;
    if (!from || !to) throw new Error(`关系 ${l.name} 的两端都需要配置数据映射。`);
    const rows = await query(`SELECT CAST(s.${quoteModelingIdent(from.idField)} AS VARCHAR) AS source_key, CAST(t.${quoteModelingIdent(to.idField)} AS VARCHAR) AS target_key FROM ${mappingTableSql(from)} s JOIN ${mappingTableSql(to)} t ON s.${quoteModelingIdent(l.mapping.sourceField)} = t.${quoteModelingIdent(l.mapping.targetField)} LIMIT 2001`);
    if (rows.length > 2000) throw new Error(`关系 ${l.name} 超过 2000 条预览上限，请先创建筛选视图。`);
    for (const row of rows) {
      const source = keys.get(l.fromType)?.get(String(row.source_key)), target = keys.get(l.toType)?.get(String(row.target_key));
      if (!source || !target) throw new Error(`关系 ${l.name} 的端点超出实例预览范围。`);
      if (!links.some(e => e.from === source && e.to === target && e.linkType === l.name))
        links.push({ from: source, to: target, linkType: l.name, weight: 1, description: `${l.mapping.sourceField} = ${l.mapping.targetField}`, provenance: l.mapping,
          sourceId: draft.links.find(e => e.from === source && e.to === target && e.linkType === l.name)?.sourceId });
    }
  }
  const result = normalizeModelingDraft({ ...draft, objects, links, instanceMappingSignature: modelingMappingSignature(draft) });
  const errors = result.validationIssues.filter(i => i.level === 'error');
  if (errors.length) throw new Error(errors.map(e => e.message).join('；'));
  return result;
}
