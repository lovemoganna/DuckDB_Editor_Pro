import { beforeEach, describe, expect, it, vi } from 'vitest';
import { duckDBService } from './duckdbService';

describe('DuckDBService views and macros management', () => {
  const queryMock = vi.fn();
  const executeAndAuditMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    Object.assign(duckDBService as unknown as Record<string, unknown>, {
      isInitialized: true,
      conn: { query: queryMock },
      readConn: { query: queryMock },
      query: queryMock,
      executeAndAudit: executeAndAuditMock,
      registeredFiles: new Map(),
    });
  });

  describe('getViews', () => {
    it('retrieves distinct view names from duckdb_views() or information_schema.views', async () => {
      queryMock.mockResolvedValueOnce([
        { view_name: 'v_sales_summary' },
        { view_name: 'v_active_users' },
      ]);

      const views = await duckDBService.getViews();
      expect(views).toEqual(['v_sales_summary', 'v_active_users']);
      expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('duckdb_views()'));
    });

    it('falls back to information_schema.views if duckdb_views() fails', async () => {
      queryMock
        .mockRejectedValueOnce(new Error('no duckdb_views'))
        .mockResolvedValueOnce([
          { table_name: 'v_fallback' },
        ]);

      const views = await duckDBService.getViews();
      expect(views).toEqual(['v_fallback']);
    });
  });

  describe('getMacros', () => {
    it('retrieves scalar and table macros from duckdb_functions() across temp and main schemas', async () => {
      queryMock.mockResolvedValueOnce([
        { function_name: 'growth_rate' },
        { function_name: 'filter_orders' },
      ]);

      const macros = await duckDBService.getMacros();
      expect(macros).toEqual(['growth_rate', 'filter_orders']);
      expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('duckdb_functions()'));
      expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('table_macro'));
    });
  });

  describe('dropView', () => {
    it('executes DROP VIEW IF EXISTS with audit', async () => {
      executeAndAuditMock.mockResolvedValueOnce(undefined);

      await duckDBService.dropView('v_sales');
      expect(executeAndAuditMock).toHaveBeenCalledWith(
        'DROP VIEW IF EXISTS "v_sales"',
        'DROP',
        'v_sales',
        'Dropped view'
      );
    });

    it('falls back to CASCADE if standard DROP VIEW fails', async () => {
      executeAndAuditMock
        .mockRejectedValueOnce(new Error('dependency error'))
        .mockResolvedValueOnce(undefined);

      await duckDBService.dropView('v_sales');
      expect(executeAndAuditMock).toHaveBeenCalledWith(
        'DROP VIEW IF EXISTS "v_sales" CASCADE',
        'DROP',
        'v_sales',
        'Dropped view cascade'
      );
    });
  });

  describe('dropMacro', () => {
    it('attempts DROP MACRO and falls back to DROP MACRO TABLE / DROP FUNCTION if needed', async () => {
      executeAndAuditMock
        .mockRejectedValueOnce(new Error('is a table macro'))
        .mockResolvedValueOnce(undefined);

      await duckDBService.dropMacro('my_table_macro');
      expect(executeAndAuditMock).toHaveBeenCalledWith(
        'DROP MACRO IF EXISTS "my_table_macro"',
        'DROP',
        'my_table_macro',
        'Dropped macro'
      );
      expect(executeAndAuditMock).toHaveBeenCalledWith(
        'DROP MACRO TABLE IF EXISTS "my_table_macro"',
        'DROP',
        'my_table_macro',
        'Dropped table macro'
      );
    });
  });

  describe('clearViews and clearMacros', () => {
    it('clears all detected views and returns count', async () => {
      vi.spyOn(duckDBService, 'getViews').mockResolvedValue(['v1', 'v2', 'v3']);
      const dropSpy = vi.spyOn(duckDBService, 'dropView').mockResolvedValue(undefined);

      const count = await duckDBService.clearViews();
      expect(count).toBe(3);
      expect(dropSpy).toHaveBeenCalledTimes(3);
    });

    it('clears all detected macros and returns count', async () => {
      vi.spyOn(duckDBService, 'getMacros').mockResolvedValue(['m1', 'm2']);
      const dropSpy = vi.spyOn(duckDBService, 'dropMacro').mockResolvedValue(undefined);

      const count = await duckDBService.clearMacros();
      expect(count).toBe(2);
      expect(dropSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('dropTable on views', () => {
    it('seamlessly drops a view when dropTable is invoked on a view target', async () => {
      vi.spyOn(duckDBService, 'getViews').mockResolvedValue(['v_active']);
      const dropViewSpy = vi.spyOn(duckDBService, 'dropView').mockResolvedValue(undefined);

      await duckDBService.dropTable('v_active');
      expect(dropViewSpy).toHaveBeenCalledWith('v_active');
    });

    it('falls back to dropView if DROP TABLE throws a view catalog error', async () => {
      vi.spyOn(duckDBService, 'getViews').mockResolvedValue([]);
      executeAndAuditMock.mockRejectedValueOnce(new Error('Catalog Error: v_calc is not a table, it is a view!'));
      const dropViewSpy = vi.spyOn(duckDBService, 'dropView').mockResolvedValue(undefined);

      await duckDBService.dropTable('v_calc');
      expect(dropViewSpy).toHaveBeenCalledWith('v_calc');
    });
  });

  describe('clearAllData with options', () => {
    it('drops views, macros, tables, and files based on options', async () => {
      vi.spyOn(duckDBService, 'getViews').mockResolvedValue(['v1']);
      vi.spyOn(duckDBService, 'getMacros').mockResolvedValue(['m1', 'm2']);
      vi.spyOn(duckDBService, 'getBaseTables').mockResolvedValue(['t1']);
      const dropViewSpy = vi.spyOn(duckDBService, 'dropView').mockResolvedValue(undefined);
      const dropMacroSpy = vi.spyOn(duckDBService, 'dropMacro').mockResolvedValue(undefined);
      const dropTableSpy = vi.spyOn(duckDBService, 'dropTable').mockResolvedValue(undefined as any);

      const res = await duckDBService.clearAllData({
        tables: true,
        views: true,
        macros: true,
        files: true,
      });

      expect(dropViewSpy).toHaveBeenCalledWith('v1');
      expect(dropMacroSpy).toHaveBeenCalledWith('m1');
      expect(dropMacroSpy).toHaveBeenCalledWith('m2');
      expect(dropTableSpy).toHaveBeenCalledWith('t1');
      expect(res).toEqual({
        droppedTables: 1,
        droppedViews: 1,
        droppedMacros: 2,
        droppedFiles: 0,
      });
    });
  });
});