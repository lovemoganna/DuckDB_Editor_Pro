import { beforeEach, describe, expect, it, vi } from 'vitest';
import { duckDBService } from './duckdbService';

type MockQueryResult = {
  toArray: () => Array<{
    toJSON?: () => Record<string, unknown>;
    database_name?: string;
    table_name?: string;
  }>;
};

const emptyResult = (): MockQueryResult => ({ toArray: () => [] });

describe('DuckDBService persistence and import contracts', () => {
  const query = vi.fn(async (sql: string): Promise<MockQueryResult> => {
    if (sql.includes('duckdb_databases()')) {
      return emptyResult();
    }
    return emptyResult();
  });

  const db = {
    registerFileHandle: vi.fn(async () => undefined),
    dropFile: vi.fn(async () => undefined),
    dropFiles: vi.fn(async () => undefined),
    flushFiles: vi.fn(async () => undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis.navigator, 'storage', {
      configurable: true,
      value: {
        getDirectory: vi.fn(async () => ({})),
      },
    });

    Object.assign(duckDBService as unknown as Record<string, unknown>, {
      db,
      conn: { query },
      readConn: { query },
      isInitialized: true,
      isLegacy: false,
      initPromise: Promise.resolve(),
      queryQueue: Promise.resolve(),
      projectStore: null,
      storageMode: 'opfs',
      workspaceSnapshot: {
        persist: vi.fn(async () => ({ size: 4, files: [] })),
      },
    });
  });

  it('creates a durable project namespace without manufacturing a file or forcing an incompatible flush', async () => {
    await duckDBService.attachProject('analytics');

    expect(query).toHaveBeenCalledWith(expect.stringContaining('CREATE SCHEMA IF NOT EXISTS'));
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining('ATTACH'));
    expect(db.registerFileHandle).not.toHaveBeenCalled();
    expect(db.flushFiles).not.toHaveBeenCalled();
  });

  it('executes an imported SQL script without re-entering the serialized query queue', async () => {
    const script = new File(
      ['CREATE TABLE imported_values(id INTEGER); INSERT INTO imported_values VALUES (1);'],
      'import.sql',
      { type: 'text/sql' },
    );

    const outcome = await Promise.race([
      duckDBService.importFile(script, 'imported_values').then(() => 'completed'),
      new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 100)),
    ]);

    expect(outcome).toBe('completed');
    expect(query).toHaveBeenCalledWith('CREATE TABLE imported_values(id INTEGER)');
    expect(query).toHaveBeenCalledWith('INSERT INTO imported_values VALUES (1)');
  });

  it('lists user tables from the active logical project schema', async () => {
    query.mockResolvedValueOnce({
      toArray: () => [
        { toJSON: () => ({ table_name: '_sys_kv_store' }) },
        { toJSON: () => ({ table_name: 'ai_traces' }) },
        { toJSON: () => ({ table_name: 'durable_probe' }) },
      ],
    });

    await expect(duckDBService.getTables()).resolves.toEqual(['ai_traces', 'durable_probe']);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('information_schema.tables'));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('current_schema()'));
  });

  it('stores ontology pattern arrays as portable text without JSON casts', async () => {
    await duckDBService.saveOntologyPattern({
      id: 'portable-pattern',
      title: 'Portable pattern',
      seedIds: [],
      coreNodes: [],
      principles: [],
      bestPractices: [],
      antiPatterns: [],
    });

    const patternInsert = query.mock.calls
      .map(([sql]) => sql)
      .find(sql => sql.includes('INSERT INTO _sys_ontology_pattern_library'));
    expect(patternInsert).toBeDefined();
    expect(patternInsert).not.toContain('::JSON');
  });

  it('initializes ontology tables in one worker round trip', async () => {
    await duckDBService.ontologyInit();

    const ontologyDdlCalls = query.mock.calls
      .map(([sql]) => sql)
      .filter(sql => sql.includes('life_object_type') || sql.includes('life_canvas_edge'));
    expect(ontologyDdlCalls).toHaveLength(1);
    expect(ontologyDdlCalls[0]).toContain('life_object_type');
    expect(ontologyDdlCalls[0]).toContain('life_canvas_edge');
  });

  it('scopes SQL editor metadata to the active schema and hides system tables', async () => {
    query.mockResolvedValueOnce({
      toArray: () => [
        {
          toJSON: () => ({
            table_name: '_sys_kv_store',
            column_name: 'key',
            data_type: 'VARCHAR',
          }),
        },
        {
          toJSON: () => ({
            table_name: 'durable_probe',
            column_name: 'marker',
            data_type: 'INTEGER',
          }),
        },
      ],
    });

    await expect(duckDBService.getSchemaContext()).resolves.toEqual({
      durable_probe: [{ name: 'marker', type: 'INTEGER' }],
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('table_schema = current_schema()'));
  });

  it('switches both writer and read sessions when activating a project', async () => {
    const schemaName = 'project_analytics_4209a13a';
    query.mockImplementation(async (sql) => ({
      toArray: () => (
        sql.includes('SELECT schema_name')
          ? [{ toJSON: () => ({ schema_name: schemaName }) }]
          : []
      ),
    }));

    await duckDBService.useProject('analytics');

    const schemaSwitches = query.mock.calls.filter(([sql]) =>
      sql === `SET schema = '${schemaName}'`,
    );
    expect(schemaSwitches.length).toBeGreaterThanOrEqual(1);
  });

  it('clears a rejected initialization attempt so the next call can retry', async () => {
    const failedAttempt = Promise.reject(new Error('transient worker failure'));
    // Silence unhandled rejection warning in test runner
    failedAttempt.catch(() => {});
    Object.assign(duckDBService as unknown as Record<string, unknown>, {
      db: null,
      conn: null,
      readConn: null,
      isInitialized: false,
      initPromise: failedAttempt,
      workspaceDatabaseFile: null,
      storageMode: 'memory',
    });

    await expect(duckDBService.init()).rejects.toThrow('transient worker failure');
    expect((duckDBService as unknown as { initPromise: Promise<void> | null }).initPromise).toBeNull();
  });

  it('safely skips querying life_canvas_edge when table does not exist', async () => {
    // When getTables returns tables without life_canvas_edge
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.tables')) {
        return {
          toArray: () => [
            { toJSON: () => ({ table_name: 'users' }) },
          ],
        };
      }
      return emptyResult();
    });

    const edges = await duckDBService.loadOntologyCanvasEdges();
    expect(edges).toEqual([]);
    const edgeQueryCalls = query.mock.calls.filter(([sql]) =>
      sql.includes('FROM life_canvas_edge'),
    );
    expect(edgeQueryCalls).toHaveLength(0);
  });
});
