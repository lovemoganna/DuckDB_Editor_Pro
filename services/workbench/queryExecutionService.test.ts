import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryExecutionService } from './queryExecutionService';
import { duckDBService } from '../duckdbService';
import { useSqlEditorStore } from '../../hooks/store/useSqlEditorStore';

describe('QueryExecutionService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully executes dynamic SQL and registers QuerySnapshot', async () => {
    const mockExecRes = {
      columns: ['num', 'title'],
      columnTypes: ['BIGINT', 'VARCHAR'],
      columnTypeMap: { num: 'BIGINT', title: 'VARCHAR' },
      rows: [{ num: 42, title: 'Hello DuckDB' }],
      executionTime: 15.5,
    };

    vi.spyOn(duckDBService, 'queryWithMetadata').mockResolvedValue(mockExecRes as any);

    const { snapshot, task } = await queryExecutionService.executeQuery(
      'tab-test-1',
      'SELECT 42 AS num, \'Hello DuckDB\' AS title;',
      'test.sql'
    );

    expect(task.status).toBe('success');
    expect(snapshot).toBeDefined();
    expect(snapshot?.columns).toEqual(['num', 'title']);
    expect(snapshot?.rows).toEqual([{ num: 42, title: 'Hello DuckDB' }]);
    expect(snapshot?.totalRowCount).toBe(1);
  });

  it('properly captures DuckDB execution errors and marks task as failed', async () => {
    const mockErrorRes = {
      columns: [],
      columnTypes: [],
      columnTypeMap: {},
      rows: [],
      error: 'Catalog Error: Table with name non_existent does not exist! LINE 1: SELECT * FROM non_existent',
    };

    vi.spyOn(duckDBService, 'queryWithMetadata').mockResolvedValue(mockErrorRes as any);

    const { task, snapshot } = await queryExecutionService.executeQuery(
      'tab-test-2',
      'SELECT * FROM non_existent;',
      'error.sql'
    );

    expect(task.status).toBe('failed');
    expect(task.error).toContain('non_existent does not exist');
    expect(task.errorLine).toBe(1);
    expect(snapshot).toBeUndefined();
  });

  it('cancels ongoing query when tab execution is cancelled', async () => {
    vi.spyOn(duckDBService, 'queryWithMetadata').mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 200));
      return { columns: ['id'], columnTypes: ['INTEGER'], columnTypeMap: { id: 'INTEGER' }, rows: [] } as any;
    });

    const execPromise = queryExecutionService.executeQuery(
      'tab-test-3',
      'SELECT pg_sleep(10);',
      'long.sql'
    );

    expect(queryExecutionService.isTabRunning('tab-test-3')).toBe(true);
    const cancelled = queryExecutionService.cancelTabExecution('tab-test-3');
    expect(cancelled).toBe(true);

    const { task } = await execPromise;
    expect(task.status).toBe('cancelled');
  });

  it('automatically writes execution success record to useSqlEditorStore history', async () => {
    useSqlEditorStore.getState().clearHistory();
    const mockExecRes = {
      columns: ['val'],
      columnTypes: ['INTEGER'],
      columnTypeMap: { val: 'INTEGER' },
      rows: [{ val: 100 }],
      executionTime: 8.5,
    };
    vi.spyOn(duckDBService, 'queryWithMetadata').mockResolvedValue(mockExecRes as any);

    await queryExecutionService.executeQuery('tab-hist-1', 'SELECT 100 AS val;', 'val.sql');

    const history = useSqlEditorStore.getState().history;
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].sql).toBe('SELECT 100 AS val;');
    expect(history[0].status).toBe('success');
    expect(history[0].affectedRows).toBe(1);
  });

  it('automatically writes execution failure record to useSqlEditorStore history', async () => {
    useSqlEditorStore.getState().clearHistory();
    const mockErrorRes = {
      columns: [],
      columnTypes: [],
      columnTypeMap: {},
      rows: [],
      error: 'Parser Error: syntax error at or near "SELCT"',
    };
    vi.spyOn(duckDBService, 'queryWithMetadata').mockResolvedValue(mockErrorRes as any);

    await queryExecutionService.executeQuery('tab-hist-2', 'SELCT 1;', 'syntax_err.sql');

    const history = useSqlEditorStore.getState().history;
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].sql).toBe('SELCT 1;');
    expect(history[0].status).toBe('error');
    expect(history[0].error).toContain('syntax error');
  });
});
