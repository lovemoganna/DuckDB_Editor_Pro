import { describe, it, expect, vi } from 'vitest';
import { emptyModelingDraft, normalizeModelingDraft, schemaProposal, diffModelingDraft, acceptModelingSuggestion, deleteModelingType, deletionImpact, queryModelingInstances, modelingMappingSignature } from './ontologyModelingDraft';
import { saveModelingDraft } from './ontologyModelingPersistence';

const model = () => normalizeModelingDraft({ ...emptyModelingDraft(), objectTypes: [
  { name: 'Customer', identifier: 'customer', description: '', properties: { id: 'INTEGER' as const } },
  { name: 'Order', identifier: 'order', description: '', properties: { id: 'INTEGER' as const } },
], linkTypes: [{ name: 'PLACED', description: '', fromType: 'Customer', toType: 'Order' }],
actions: [{ name: 'Place', objectName: 'Order', description: '' }] });

describe('shared modeling draft boundaries', () => {
  it('keeps blank modeling and AI schema proposals free of fabricated instances', () => {
    const draft = model();
    expect(draft.objects).toEqual([]);
    const proposed = schemaProposal({ ...draft, objects: [{ name: 'Example', objectType: 'Order', properties: {} }],
      actions: [{ name: 'Pay', objectName: 'Example', description: '' }] });
    expect(proposed.objects).toEqual([]);
    expect(proposed.actions[0].objectName).toBe('Order');
  });
  it('requires per-item acceptance and rejects suggestions made stale by manual edits', () => {
    const draft = model(), next = { ...draft, actions: [...draft.actions, { name: 'Pay', objectName: 'Order', description: '' }] };
    const changes = diffModelingDraft(draft, next);
    expect(draft.actions).toHaveLength(1);
    expect(acceptModelingSuggestion(draft, changes[0]).actions).toHaveLength(2);
    const change = diffModelingDraft(draft, { ...draft, objectTypes: draft.objectTypes.map(t => ({ ...t, description: 'AI' })) })[0];
    expect(() => acceptModelingSuggestion({ ...draft, objectTypes: draft.objectTypes.map(t => ({ ...t, description: 'manual' })) }, change)).toThrow('手动修改');
  });
  it('locates identifier conflicts, empty endpoints, dangling instances and invalid typed values', () => {
    const draft = model();
    draft.objectTypes[1].identifier = 'customer';
    draft.linkTypes[0].toType = '';
    draft.objects = [{ name: 'o', objectType: 'Missing', properties: {} }, { name: 'c', objectType: 'Customer', properties: { id: 'abc' } }];
    draft.links = [{ from: 'c', to: 'absent', linkType: 'PLACED', weight: 1 }];
    const errors = normalizeModelingDraft(draft).validationIssues.filter(i => i.level === 'error');
    expect(errors.some(i => i.message.includes('标识符'))).toBe(true);
    expect(errors.some(i => i.message.includes('端点') || i.message.includes('来源'))).toBe(true);
    expect(errors.some(i => i.message.includes('INTEGER'))).toBe(true);
    expect(errors.filter(i => i.element).every(i => i.fix)).toBe(true);
  });
  it('reports deletion impact and cascades instance links and actions without deleting other types', () => {
    const draft = model();
    draft.objects = [{ name: 'c', objectType: 'Customer', properties: {} }, { name: 'o', objectType: 'Order', properties: {} }];
    draft.links = [{ from: 'c', to: 'o', linkType: 'PLACED', weight: 1 }];
    expect(deletionImpact(draft, 'Order').relatedTypes).toEqual(['Customer']);
    const next = deleteModelingType(draft, 'Order');
    expect(next.objects.map(o => o.name)).toEqual(['c']);
    expect(next.links).toEqual([]); expect(next.actions).toEqual([]);
  });
  it('does not begin persistence for invalid structures', async () => {
    const executeTransaction = vi.fn(), query = vi.fn();
    const draft = model(); draft.linkTypes[0].toType = 'Missing';
    await expect(saveModelingDraft({ query, executeTransaction }, { objectTypeTable: 'ot', objectTable: 'o', linkTypeTable: 'lt', linkTable: 'l', actionTable: 'a' }, draft)).rejects.toThrow('校验失败');
    expect(executeTransaction).not.toHaveBeenCalled(); expect(query).not.toHaveBeenCalled();
  });
  it('retains valid remaining query results when deleting a mapped type, without hiding stale mappings', () => {
    const draft = model();
    draft.objects = [{ name: 'customer:1', objectType: 'Customer', properties: { id: 1 },
      provenance: { catalog: 'db', schema: 'main', table: 'customers', idField: 'id', key: '1' } }];
    draft.instanceMappingSignature = modelingMappingSignature(draft);
    expect(deleteModelingType(draft, 'Order').validationIssues.some(i => i.id === 'mapping-stale')).toBe(false);
    draft.objectTypes[0].identifier = 'changed';
    expect(deleteModelingType(draft, 'Order').validationIssues.some(i => i.id === 'mapping-stale')).toBe(true);
  });
  it('uses qualified source queries and explicit joins; refuses ambiguous identities', async () => {
    const draft = model();
    draft.objectTypes[0].mapping = { catalog: 'db', schema: 'main', table: 'customers', idField: 'id', properties: { id: 'id' } };
    draft.objectTypes[1].mapping = { catalog: 'db', schema: 'main', table: 'orders', idField: 'id', properties: { id: 'id' } };
    draft.linkTypes[0].mapping = { sourceField: 'id', targetField: 'customer_id' };
    const query = vi.fn(async (sql: string) => sql.includes('information_schema.columns') ? [{ column_name: 'id' }, { column_name: 'customer_id' }]
      : sql.includes('HAVING') ? [] : sql.includes(' JOIN ') ? [{ source_key: '1', target_key: '2' }]
      : sql.includes('"customers"') ? [{ id: 1 }] : [{ id: 2, customer_id: 1 }]);
    const result = await queryModelingInstances(draft, query);
    expect(result.objects.map(o => o.name)).toEqual(['customer:1','order:2']);
    expect(result.links).toHaveLength(1);
    expect(query.mock.calls.some(([sql]) => sql.includes('"db"."main"."orders"') && sql.includes('s."id" = t."customer_id"'))).toBe(true);
    query.mockImplementation(async sql => sql.includes('HAVING') ? [{ id: null }] : [{ column_name: 'id' }]);
    await expect(queryModelingInstances(draft, query)).rejects.toThrow('空值或重复值');
  });
});
