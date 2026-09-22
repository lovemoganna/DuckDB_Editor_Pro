import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ColumnProfiler } from './columnProfiler';
import { TransformationEngine } from './transformationEngine';
import { QuerySnapshotManager } from './querySnapshotManager';
import { QueryExecutionService } from './queryExecutionService';
import type { QuerySnapshot } from './types';

describe('Workbench Backend Interaction Services (BRD index10.md Section 3)', () => {
  const sampleSnapshot: QuerySnapshot = {
    snapshotId: 'snap_sample_1',
    executionId: 'exec_sample_1',
    tabId: 'tab_1',
    title: 'Customer Analysis',
    sql: 'SELECT region, category, 营业额 FROM orders;',
    columns: ['region', 'category', '营业额'],
    columnTypes: ['VARCHAR', 'VARCHAR', 'DECIMAL(18,2)'],
    columnTypeMap: {
      region: 'VARCHAR',
      category: 'VARCHAR',
      营业额: 'DECIMAL(18,2)',
    },
    rows: [
      { region: 'North America', category: 'Electronics', 营业额: 198742.15 },
      { region: 'Europe', category: 'Electronics', 营业额: 152318.40 },
      { region: 'Asia Pacific', category: 'Electronics', 营业额: 136784.20 },
      { region: 'North America', category: 'Home', 营业额: 126530.75 },
    ],
    totalRowCount: 4,
    executionTime: 420,
    executedAt: '09:42:11',
  };

  describe('ColumnProfiler', () => {
    let profiler: ColumnProfiler;

    beforeEach(() => {
      profiler = new ColumnProfiler();
    });

    it('calculates exact numeric statistics bound to snapshot and column', () => {
      const profile = profiler.profileColumn(sampleSnapshot, '营业额');
      expect(profile.snapshotId).toBe('snap_sample_1');
      expect(profile.columnName).toBe('营业额');
      expect(profile.columnType).toBe('DECIMAL(18,2)');
      expect(profile.isNumeric).toBe(true);
      expect(profile.min).toBe('126,530.75');
      expect(profile.max).toBe('198,742.15');
      expect(profile.nullCount).toBe(0);
      expect(profile.distinctCount).toBe(4);
      expect(profile.histogramBars.length).toBe(20);
      expect(profile.topValues.length).toBe(4);
    });

    it('caches and returns identical profile for same snapshot and column', () => {
      const prof1 = profiler.profileColumn(sampleSnapshot, '营业额');
      const prof2 = profiler.profileColumn(sampleSnapshot, '营业额');
      expect(prof1).toBe(prof2);
    });
  });

  describe('TransformationEngine', () => {
    let engine: TransformationEngine;

    beforeEach(() => {
      engine = new TransformationEngine();
    });

    it('applies in-memory filter and generates derived CTE SQL', () => {
      const derived = engine.applyTransformation(
        sampleSnapshot,
        {
          filters: [{ column: 'region', operator: '=', value: 'North America' }],
        },
        'snap_derived_1'
      );

      expect(derived.rows.length).toBe(2);
      expect(derived.parentSnapshotId).toBe('snap_sample_1');
      expect(derived.sql).toContain('WITH source_data AS');
      expect(derived.sql).toContain('WHERE "region" = \'North America\'');
    });

    it('applies in-memory grouping and metrics', () => {
      const derived = engine.applyTransformation(
        sampleSnapshot,
        {
          groupBy: ['region'],
          metrics: [
            { column: '营业额', aggregator: 'SUM', alias: '总营业额' },
            { column: 'category', aggregator: 'COUNT', alias: '品类数' },
          ],
        },
        'snap_derived_group'
      );

      expect(derived.columns).toEqual(['region', '总营业额', '品类数']);
      expect(derived.rows.length).toBe(3);
    });
  });

  describe('QuerySnapshotManager', () => {
    let manager: QuerySnapshotManager;

    beforeEach(() => {
      manager = new QuerySnapshotManager();
    });

    it('tracks snapshot lifecycle, undo, and redo', () => {
      manager.registerSnapshot(sampleSnapshot);
      expect(manager.getActiveSnapshotForTab('tab_1')?.snapshotId).toBe('snap_sample_1');

      const derived = manager.deriveSnapshot('snap_sample_1', {
        sorts: [{ column: '营业额', direction: 'ASC' }],
      });
      expect(derived).toBeDefined();
      expect(manager.getActiveSnapshotForTab('tab_1')?.snapshotId).toBe(derived?.snapshotId);

      // Undo
      const undone = manager.undoTransformation('tab_1');
      expect(undone?.snapshotId).toBe('snap_sample_1');

      // Redo
      const redone = manager.redoTransformation('tab_1');
      expect(redone?.snapshotId).toBe(derived?.snapshotId);
    });
  });
});
