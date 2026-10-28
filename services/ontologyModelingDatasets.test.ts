import { describe, expect, it, vi } from 'vitest';
import { datasetModelingMapping, resolveModelingDatasets, modelingPropertyType } from './ontologyModelingDatasets';
import { emptyModelingDraft, queryModelingInstances } from './ontologyModelingDraft';
import type { DatasetDefinition } from './workbench/analysisTypes';
import { saveModelingDraft } from './ontologyModelingPersistence';
import { ontologyModelingService } from './ontologyModelingService';

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('./workbench/datasets', () => ({ loadDatasets: mocks.load }));
const dataset: DatasetDefinition = { id: 'funds-completed', name: '已完成交易', kind: 'query', catalog: 'funds', schema: 'main', version: 2,
  sql: 'SELECT id, amount FROM "funds"."main"."fiat_transactions" WHERE status = \'completed\'', fields: [{ name: 'id', type: 'BIGINT' }, { name: 'amount', type: 'DECIMAL(18,2)' }] };
const draft = () => {
  const result = emptyModelingDraft();
  const mapping = datasetModelingMapping({ ...dataset, sql: `${dataset.sql} AND amount > 100` }, 'funds', dataset);
  mapping.idField = 'id';
  result.objectTypes = [{ name: 'Trade', identifier: 'trade', description: '', mapping, properties: { id: 'INTEGER', amount: 'DECIMAL' } }];
  return result;
};
describe('workspace dataset ontology integration', () => {
  it('queries the selected SQL dataset with its current filters and records its stable identity', async () => {
    mocks.load.mockResolvedValue([dataset]);
    const query = vi.fn(async (sql: string) => sql.startsWith('DESCRIBE') ? [{column_name:'id'}, {column_name:'amount'}]
      : sql.includes('HAVING') ? [] : [{id:9, amount:123.45}]);
    const result = await queryModelingInstances(draft(), query);
    expect(result.objects[0].properties.amount).toBe(123.45);
    expect(result.objects[0].provenance?.dataset).toMatchObject({ id:dataset.id, version:2, owner:'funds' });
    expect(query.mock.calls.every(([sql]) => sql.includes('amount > 100'))).toBe(true);
    expect(mocks.load).toHaveBeenCalledWith('funds');
  });
  it('rejects changed, missing or invalid datasets before preview or formal save', async () => {
    for (const definitions of [[], [{...dataset, version:3}], [{...dataset, sql:'SELECT 1'}], [{...dataset,error:'missing field'}]]) {
      mocks.load.mockResolvedValue(definitions);
      await expect(resolveModelingDatasets(draft())).rejects.toThrow('重新选择数据集');
    }
    const executeTransaction = vi.fn();
    await expect(saveModelingDraft({query:vi.fn(),executeTransaction}, {objectTypeTable:'ot',objectTable:'o',linkTypeTable:'lt',linkTable:'l',actionTable:'a'}, draft())).rejects.toThrow('重新选择数据集');
    expect(executeTransaction).not.toHaveBeenCalled();
  });
  it('prevents a draft being written after switching database or schema', async () => {
    mocks.load.mockResolvedValue([dataset]);
    const result = draft(); result.targetContext = {catalog:'funds',schema:'main'};
    const query = vi.fn(async () => [{catalog:'other',schema:'main'}]);
    await expect(saveModelingDraft({query,executeTransaction:async callback=>callback(query)}, {objectTypeTable:'ot',objectTable:'o',linkTypeTable:'lt',linkTable:'l',actionTable:'a'}, result)).rejects.toThrow('工作区已切换');
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('maps DuckDB field types into the existing property model', () => {
    expect(['BIGINT','DECIMAL(18,2)','DATE','BOOLEAN','VARCHAR'].map(modelingPropertyType)).toEqual(['INTEGER','DECIMAL','TIMESTAMP','BOOLEAN','VARCHAR']);
  });
  it('accepts real DuckDB timestamp milliseconds without replacing the source value', () => {
    const result = emptyModelingDraft();
    result.objectTypes = [{name:'User',description:'',properties:{created_at:'TIMESTAMP'}}];
    result.objects = [{name:'u',objectType:'User',properties:{created_at:1705307400000}}];
    expect(ontologyModelingService.validateModel(result).issues.filter(i=>i.level==='error')).toEqual([]);
    result.objects[0].properties.created_at = 'invalid date';
    expect(ontologyModelingService.validateModel(result).issues.some(i=>i.level==='error')).toBe(true);
  });
});
