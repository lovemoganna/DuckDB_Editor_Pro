import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  getAllKnowledgeAssets,
  getKnowledgeAssetById,
  saveKnowledgeAsset,
  deleteKnowledgeAsset,
  toggleAssetFavorite,
  exportKnowledgeAssetsToJson,
  importKnowledgeAssetsFromJson,
  resetKnowledgeAssetsToSeeds,
} from './knowledgeAssetStorage';
import { SEED_KNOWLEDGE_ASSETS } from '../data/seedAssets';
import { CodeAsset } from '../types';

describe('knowledgeAssetStorage', () => {
  beforeEach(async () => {
    // 每次测试前重置为默认种子数据
    await resetKnowledgeAssetsToSeeds();
  });

  it('initializes with seed knowledge assets when store is initialized', async () => {
    const assets = await getAllKnowledgeAssets();
    expect(assets.length).toBeGreaterThanOrEqual(SEED_KNOWLEDGE_ASSETS.length);
    const lesson1 = assets.find((a) => a.id === 'duckdb-sql-lesson-1');
    expect(lesson1).toBeDefined();
    expect(lesson1?.type).toBe('note');
  });

  it('saves a new asset and retrieves it by id', async () => {
    const newCode: CodeAsset = {
      id: 'test-custom-sql',
      type: 'code',
      title: '自定义测试查询',
      category: 'snippet',
      description: '测试自定义 SQL 片段',
      sql: 'SELECT 1 AS test_val;',
      tags: ['Test', 'DuckDB'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveKnowledgeAsset(newCode);

    const retrieved = await getKnowledgeAssetById('test-custom-sql');
    expect(retrieved).toBeDefined();
    expect(retrieved?.title).toBe('自定义测试查询');
    expect(retrieved?.type).toBe('code');
  });

  it('toggles favorite status correctly', async () => {
    const assetId = 'duckdb-sql-lesson-1';
    const before = await getKnowledgeAssetById(assetId);
    const initialFav = Boolean(before?.isFavorite);

    const toggledFav = await toggleAssetFavorite(assetId);
    expect(toggledFav).toBe(!initialFav);

    const after = await getKnowledgeAssetById(assetId);
    expect(after?.isFavorite).toBe(!initialFav);
  });

  it('deletes an asset successfully', async () => {
    const testId = 'duckdb-sql-lesson-2';
    const before = await getKnowledgeAssetById(testId);
    expect(before).toBeDefined();

    await deleteKnowledgeAsset(testId);

    const after = await getKnowledgeAssetById(testId);
    expect(after).toBeNull();
  });

  it('exports assets to valid JSON', async () => {
    const jsonStr = await exportKnowledgeAssetsToJson();
    expect(typeof jsonStr).toBe('string');
    const parsed = JSON.parse(jsonStr);
    expect(parsed.version).toBe('1.0');
    expect(Array.isArray(parsed.assets)).toBe(true);
    expect(parsed.assets.length).toBeGreaterThan(0);
  });

  it('imports assets and updates existing records', async () => {
    const importPayload = {
      version: '1.0',
      assets: [
        {
          id: 'imported-test-1',
          type: 'code',
          title: '外部导入的 SQL',
          category: 'template',
          description: '从外部导入',
          sql: 'SELECT * FROM imported_table;',
          tags: ['Imported'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    const res = await importKnowledgeAssetsFromJson(JSON.stringify(importPayload));
    expect(res.added).toBe(1);

    const imported = await getKnowledgeAssetById('imported-test-1');
    expect(imported).toBeDefined();
    expect(imported?.title).toBe('外部导入的 SQL');
  });

  it('automatically purges deprecated assets from IndexedDB on load', async () => {
    // 模拟旧版本 IndexedDB 中遗留了已删除的资产
    await saveKnowledgeAsset({
      id: 'code-parquet-inspect',
      type: 'code',
      title: 'Parquet 极速元数据与数据分布抽样',
      category: 'template',
      description: '旧版资产',
      sql: 'SELECT 1;',
      tags: ['DuckDB'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await saveKnowledgeAsset({
      id: 'metric-gmv-net',
      type: 'metric',
      name: 'GMV (净成交交易总额)',
      businessMeaning: '旧指标',
      calculationFormula: 'SUM(amount)',
      sourceTables: ['orders'],
      dimensions: [],
      owner: 'test',
      tags: ['GMV'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const assets = await getAllKnowledgeAssets();
    expect(assets.some((a) => a.id === 'code-parquet-inspect')).toBe(false);
    expect(assets.some((a) => a.id === 'metric-gmv-net')).toBe(false);

    // 验证 IndexedDB 数据库中也被物理清理
    const afterParquet = await getKnowledgeAssetById('code-parquet-inspect');
    const afterGmv = await getKnowledgeAssetById('metric-gmv-net');
    expect(afterParquet).toBeNull();
    expect(afterGmv).toBeNull();
  });
});
