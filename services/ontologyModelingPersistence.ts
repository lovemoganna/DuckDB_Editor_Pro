import { emptyModelingDraft, normalizeModelingDraft, quoteModelingIdent, mappingTableSql, type ModelingQuery } from './ontologyModelingDraft';
import type { OntologyModelingResult } from './ontologyModelingService';
import { ONTOLOGY_CREATE_STATEMENTS } from '../components/Library/ontologyDataModel';
import { resolveModelingDatasets } from './ontologyModelingDatasets';

type Mapping = { objectTypeTable: string; objectTable: string; linkTypeTable: string; linkTable: string; actionTable: string; introspectionTable?: string; insightTable?: string };
type Client = { query: ModelingQuery; executeTransaction: (callback: (query: ModelingQuery) => Promise<void>) => Promise<unknown> };
const literal = (v: unknown) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const table = (s: string) => s.split('.').map(quoteModelingIdent).join('.');
const metadataTable = (m: Mapping) => table(`${m.objectTypeTable}__modeling_schema`);
const kinds = ['objectTypes', 'objects', 'linkTypes', 'links', 'actions'] as const;
const tableNames = (m: Mapping) => [m.objectTypeTable, m.objectTable, m.linkTypeTable, m.linkTable, m.actionTable];

export async function readModelingSchema(query: ModelingQuery, mapping: Pick<Mapping, 'objectTypeTable'>): Promise<OntologyModelingResult | undefined> {
  const parts = `${mapping.objectTypeTable}__modeling_schema`.split('.');
  const exists = await query(`SELECT table_name FROM information_schema.tables WHERE table_name=${literal(parts.at(-1))} AND table_schema=${parts.length > 1 ? literal(parts.at(-2)) : 'current_schema()'} AND table_catalog=${parts.length > 2 ? literal(parts.at(-3)) : 'current_database()'}`);
  if (!exists.length) return undefined;
  const saved = await query(`SELECT definition FROM ${table(parts.join('.'))} WHERE id = 1`);
  return saved[0] ? JSON.parse(saved[0].definition) : undefined;
}

async function readSnapshot(query: ModelingQuery, mapping: Mapping) {
  const rows: Record<string, any[]> = {};
  // Sequential reads also work inside the writer's transaction.
  for (const [i, kind] of kinds.entries()) rows[kind] = await query(`SELECT * FROM ${table(tableNames(mapping)[i])} ORDER BY id`);
  const metadata = await readModelingSchema(query, mapping);
  const references: NonNullable<OntologyModelingResult['dependentReferences']> = [];
  for (const [name, label] of [[mapping.introspectionTable, '反思记录'], [mapping.insightTable, '洞察记录'],
    [mapping.objectTable === 'life_object' ? 'life_canvas_state' : undefined, '实体画布']] as const) {
    if (!name) continue;
    const parts = name.split('.');
    const exists = await query(`SELECT table_name FROM information_schema.tables WHERE table_name=${literal(parts.at(-1))} AND table_schema=${parts.length > 1 ? literal(parts.at(-2)) : 'current_schema()'} AND table_catalog=${parts.length > 2 ? literal(parts.at(-3)) : 'current_database()'}`);
    if (!exists.length) continue;
    const refs = await query(`SELECT object_id FROM ${table(name)} WHERE object_id IS NOT NULL${name === 'life_canvas_state' ? " AND (node_type IS NULL OR node_type <> 'object')" : ''} ORDER BY object_id`);
    references.push(...refs.map(r => ({ table: name, objectId: Number(r.object_id), label })));
  }
  // References are rechecked inside the save transaction; automatic layout writes must not invalidate a draft.
  return { rows, metadata, references, revision: JSON.stringify({ rows, metadata }) };
}

export async function loadModelingDraft(query: ModelingQuery, mapping: Mapping): Promise<OntologyModelingResult> {
  const { rows, metadata, revision, references } = await readSnapshot(query, mapping);
  const draft = emptyModelingDraft();
  const scope = (await query('SELECT current_database() AS catalog, current_schema() AS schema'))[0];
  draft.targetContext = scope;
  draft.instanceMappingSignature = metadata?.instanceMappingSignature;
  draft.dependentReferences = references;
  draft.baseRevision = revision;
  draft.baseline = Object.fromEntries(kinds.map(k => [k, rows[k].map(r => Number(r.id))])) as OntologyModelingResult['baseline'];
  const types = new Map(rows.objectTypes.map(r => [Number(r.id), r.name]));
  const objects = new Map(rows.objects.map(r => [Number(r.id), r.name]));
  const linkTypes = new Map(rows.linkTypes.map(r => [Number(r.id), r.name]));
  const find = <K extends typeof kinds[number]>(kind: K, r: any): OntologyModelingResult[K][number] | undefined =>
    metadata?.[kind].find(x => x.sourceId === Number(r.id) || ('name' in x && x.name === r.name)) as OntologyModelingResult[K][number] | undefined;
  draft.objectTypes = rows.objectTypes.map(r => ({ ...find('objectTypes', r), sourceId: Number(r.id), name: r.name, description: r.description || '' }));
  draft.objects = rows.objects.map(r => ({ ...find('objects', r), sourceId: Number(r.id), name: r.name,
    objectType: types.get(Number(r.object_type_id)) || '', properties: typeof r.properties === 'string' ? JSON.parse(r.properties || '{}') : r.properties || {}, annotations: r.annotations || '' }));
  draft.linkTypes = rows.linkTypes.map(r => {
    const saved = find('linkTypes', r) as OntologyModelingResult['linkTypes'][number] | undefined;
    const example = rows.links.find(l => Number(l.link_type_id) === Number(r.id));
    const from = rows.objects.find(o => Number(o.id) === Number(example?.source_object_id));
    const to = rows.objects.find(o => Number(o.id) === Number(example?.target_object_id));
    return { ...saved, sourceId: Number(r.id), name: r.name, description: r.description || '',
      fromType: saved?.fromType || types.get(Number(from?.object_type_id)) || '',
      toType: saved?.toType || types.get(Number(to?.object_type_id)) || '' };
  });
  draft.links = rows.links.map(r => ({ ...find('links', r), sourceId: Number(r.id), from: objects.get(Number(r.source_object_id)) || '',
    to: objects.get(Number(r.target_object_id)) || '', linkType: linkTypes.get(Number(r.link_type_id)) || '', weight: Number(r.weight) }));
  draft.actions = rows.actions.map(r => ({ ...find('actions', r), sourceId: Number(r.id), name: r.name,
    objectName: objects.get(Number(r.object_id)) || '', description: r.description || '' }));
  // Schema actions have no instance target and live in the same normalized definition.
  draft.actions.push(...(metadata?.actions.filter(a => a.sourceId === undefined) || []));
  return normalizeModelingDraft(draft);
}

/** Validate before writes; atomically save standard ontology rows plus otherwise lossy schema metadata. */
export async function saveModelingDraft(client: Client, mapping: Mapping, input: OntologyModelingResult, replace = false) {
  const draft = normalizeModelingDraft(structuredClone(input));
  const errors = draft.validationIssues.filter(i => i.level === 'error');
  if (errors.length) throw new Error(`本体校验失败：${errors.map(i => i.message).join('；')}`);
  await resolveModelingDatasets(draft);
  await client.executeTransaction(async query => {
    if (draft.targetContext) {
      const scope = (await query('SELECT current_database() AS catalog, current_schema() AS schema'))[0];
      if (scope?.catalog !== draft.targetContext.catalog || scope?.schema !== draft.targetContext.schema)
        throw new Error(`工作区已切换，请回到 ${draft.targetContext.catalog}.${draft.targetContext.schema} 后保存；当前草案已保留。`);
    }
    for (const type of draft.objectTypes) {
      if (!type.mapping) continue;
      const columns = await query(`DESCRIBE SELECT * FROM ${mappingTableSql(type.mapping)} AS dataset_source`);
      const fields = new Set(columns.map(c => c.column_name));
      if (![type.mapping.idField, ...Object.values(type.mapping.properties)].every(f => fields.has(f)))
        throw new Error(`对象 ${type.name} 的数据来源字段已变化，请重新映射并预览。`);
    }
    for (const [i, name] of ['life_object_type','life_object','life_link_type','life_link','life_action'].entries()) {
      await query(ONTOLOGY_CREATE_STATEMENTS[i].replace(`IF NOT EXISTS ${name}`, `IF NOT EXISTS ${table(tableNames(mapping)[i])}`));
    }
    // The existing default graph saves positions and references in these tables.
    if (mapping.objectTable === 'life_object') {
      for (const statement of ONTOLOGY_CREATE_STATEMENTS.slice(5, 9)) await query(statement);
    }
    const snapshot = await readSnapshot(query, mapping);
    if (draft.baseRevision && snapshot.revision !== draft.baseRevision) throw new Error('正式本体已变化，请取消草案并重新载入，避免覆盖其他修改。');
    const tables = tableNames(mapping);
    const deletedObjectIds = snapshot.rows.objects.filter(r => replace || (draft.baseline?.objects.includes(Number(r.id)) && !draft.objects.some(o => o.sourceId === Number(r.id)))).map(r => Number(r.id));
    const dependencies = snapshot.references.filter(r => deletedObjectIds.includes(r.objectId));
    if (dependencies.length) throw new Error(`删除会影响 ${dependencies.map(r => r.label).join('、')}。请先在相应组件解除引用，再重新载入正式本体编辑。`);
    if (mapping.objectTable === 'life_object' && deletedObjectIds.length) {
      await query(`DELETE FROM life_canvas_state WHERE node_type='object' AND object_id IN (${deletedObjectIds.join(',')})`);
    }
    for (const kind of kinds) {
      for (const item of draft[kind]) {
        if (item.sourceId !== undefined && !draft.baseline?.[kind].includes(item.sourceId)) throw new Error('草案包含未经载入的正式元素标识。');
        if (!replace && item.sourceId === undefined && 'name' in item && snapshot.rows[kind].some(r => r.name.trim().toLowerCase() === item.name.trim().toLowerCase()))
          throw new Error(`正式本体已存在 ${item.name}，请从「编辑已保存本体」载入后修改。`);
      }
    }
    const insert = async (index: number, columns: string[], values: unknown[]) => {
      await query(`INSERT INTO ${table(tables[index])} (${columns.map(quoteModelingIdent).join(',')}) VALUES (${values.map(literal).join(',')})`);
    };
    const remove = async (index: number, ids: number[]) => {
      if (ids.length) await query(`DELETE FROM ${table(tables[index])} WHERE id IN (${ids.join(',')})`);
    };
    // Remove children before parents. Preserve unrelated formal rows during incremental import.
    const removed = (kind: typeof kinds[number]) => (draft.baseline?.[kind] || []).filter(id => !draft[kind].some(r => r.sourceId === id));
    for (const i of [4, 3, 1, 2, 0]) {
      if (replace) await query(`DELETE FROM ${table(tables[i])}`);
      else await remove(i, removed(kinds[i]));
    }
    const allocate = (kind: typeof kinds[number]) => {
      let id = Math.max(0, ...snapshot.rows[kind].map(r => Number(r.id)));
      return () => ++id;
    };
    const typeIds = new Map<string, number>(), objectIds = new Map<string, number>(), linkIds = new Map<string, number>();
    const nextType = allocate('objectTypes'), nextObject = allocate('objects'), nextLinkType = allocate('linkTypes'), nextLink = allocate('links'), nextAction = allocate('actions');
    for (const t of draft.objectTypes) {
      const id = t.sourceId ?? nextType(); typeIds.set(t.name, id); t.sourceId = id;
      if (!replace && snapshot.rows.objectTypes.some(r => Number(r.id) === id)) await query(`UPDATE ${table(tables[0])} SET name=${literal(t.name)}, description=${literal(t.description)} WHERE id=${id}`);
      else await insert(0, ['id','name','description'], [id,t.name,t.description]);
    }
    for (const o of draft.objects) {
      const id = o.sourceId ?? nextObject(); objectIds.set(o.name, id); o.sourceId = id;
      const values = [typeIds.get(o.objectType),o.name,JSON.stringify(o.properties),o.annotations || ''];
      if (!replace && snapshot.rows.objects.some(r => Number(r.id) === id)) await query(`UPDATE ${table(tables[1])} SET ${['object_type_id','name','properties','annotations'].map((c,i) => `${quoteModelingIdent(c)}=${literal(values[i])}`).join(',')} WHERE id=${id}`);
      else await insert(1, ['id','object_type_id','name','properties','annotations'], [id,...values]);
    }
    for (const l of draft.linkTypes) {
      const id = l.sourceId ?? nextLinkType(); linkIds.set(l.name, id); l.sourceId = id;
      if (!replace && snapshot.rows.linkTypes.some(r => Number(r.id) === id)) await query(`UPDATE ${table(tables[2])} SET name=${literal(l.name)}, description=${literal(l.description)} WHERE id=${id}`);
      else await insert(2, ['id','name','description'], [id,l.name,l.description]);
    }
    for (const l of draft.links) {
      const id = l.sourceId ?? nextLink();
      if (!replace && l.sourceId !== undefined) await remove(3, [id]);
      l.sourceId = id;
      await insert(3, ['id','link_type_id','source_object_id','target_object_id','weight'], [id,linkIds.get(l.linkType),objectIds.get(l.from),objectIds.get(l.to),l.weight]);
    }
    for (const a of draft.actions) {
      const objectId = objectIds.get(a.objectName);
      if (!objectId) {
        if (!replace && a.sourceId !== undefined) await remove(4, [a.sourceId]);
        a.sourceId = undefined; continue;
      }
      const id = a.sourceId ?? nextAction();
      const existingAction = !replace && snapshot.rows.actions.some(r => Number(r.id) === id);
      a.sourceId = id;
      if (existingAction) await query(`UPDATE ${table(tables[4])} SET object_id=${literal(objectId)}, name=${literal(a.name)}, description=${literal(a.description)} WHERE id=${id}`);
      else await insert(4, ['id','object_id','name','description','status'], [id,objectId,a.name,a.description,'pending']);
    }
    const existing = snapshot.metadata;
    const definition = !replace && !draft.baseline && existing ? { ...draft,
      objectTypes: [...existing.objectTypes, ...draft.objectTypes], linkTypes: [...existing.linkTypes, ...draft.linkTypes],
      actions: [...existing.actions, ...draft.actions], objects: [...existing.objects, ...draft.objects], links: [...existing.links, ...draft.links] } : draft;
    await query(`CREATE TABLE IF NOT EXISTS ${metadataTable(mapping)} (id INTEGER PRIMARY KEY, definition VARCHAR NOT NULL)`);
    await query(`INSERT OR REPLACE INTO ${metadataTable(mapping)} VALUES (1, ${literal(JSON.stringify({ ...definition, baseRevision: undefined, baseline: undefined }))})`);
  });
}
