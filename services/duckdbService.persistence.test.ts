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
  it('qualifies delayed ontology position writes with their original database and schema', async () => {
    const write = vi.spyOn(duckDBService, 'query').mockResolvedValue([]);
    try {
      await duckDBService.saveOntologyCanvasState('object_1',null,1,'Object','',10,20,0,0,'object',{}, {catalog:'source"db',schema:'analytics'});
      expect(write).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO "source""db"."analytics"."life_canvas_state"'));
    } finally { write.mockRestore(); }
  });
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
      storageMode: 'memory',
      databaseCatalog: null,
      currentDatabaseName: 'memory',
      sqlTransactionOpen: false,
      workspaceSnapshot: {
        persist: vi.fn(async () => ({ size: 4, files: [] })),
      },
    });
    (duckDBService as any).initDatabaseCatalog();
  });

  it('rolls back a failed import replacement instead of leaving the target dropped', async () => {
    query.mockImplementation(async sql => {
      if (sql.startsWith('CREATE TABLE')) throw new Error('Conversion Error');
      return emptyResult();
    });
    await expect(duckDBService.executeTransaction([
      'DROP TABLE "main"."orders"', 'CREATE TABLE "main"."orders" AS SELECT bad_cast',
    ])).rejects.toThrow('Conversion Error');
    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN TRANSACTION', 'DROP TABLE "main"."orders"',
      'CREATE TABLE "main"."orders" AS SELECT bad_cast', 'ROLLBACK',
    ]);
  });

  it('does not commit or roll back an existing user SQL transaction during import', async () => {
    Object.assign(duckDBService as any, { sqlTransactionOpen: true });
    await expect(duckDBService.executeTransaction(['CREATE TABLE orders(id INTEGER)'])).rejects.toThrow('请先完成当前 SQL 事务');
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects a case-only mount alias conflict before reading the local database', async () => {
    const list = vi.spyOn(duckDBService, 'listDatabases').mockResolvedValue([{ name: 'Analytics' } as any]);
    const read = vi.fn(async () => new ArrayBuffer(32));
    try {
      await expect(duckDBService.importDatabaseFile({ arrayBuffer: read } as File, 'analytics')).rejects.toThrow('已挂载');
      expect(read).not.toHaveBeenCalled();
    } finally { list.mockRestore(); }
  });

  it('mounts a local file read-only for the session when OPFS is unavailable', async () => {
    const bytes = new Uint8Array(32); bytes.set([68, 85, 67, 75], 8);
    const mounted = { name: 'analytics', readonly: true } as any;
    const list = vi.spyOn(duckDBService, 'listDatabases').mockResolvedValueOnce([]).mockResolvedValue([mounted]);
    const register = vi.spyOn(duckDBService, 'registerFileBuffer').mockResolvedValue();
    const sql = vi.spyOn(duckDBService, 'query').mockResolvedValue([]);
    try {
      expect(await duckDBService.importDatabaseFile({ arrayBuffer: async () => bytes.buffer } as File, 'analytics')).toEqual(mounted);
      expect(register).toHaveBeenCalledWith(expect.stringMatching(/\.duckdb$/), bytes);
      expect(sql).toHaveBeenCalledWith(expect.stringContaining('AS "analytics" (READ_ONLY)'));
    } finally { list.mockRestore(); register.mockRestore(); sql.mockRestore(); }
  });

  it('checkpoints real persistent catalogs before acknowledging a metadata write', async () => {
    Object.assign(duckDBService as unknown as Record<string, unknown>, { storageMode: 'opfs' });
    query.mockImplementation(async (sql) => sql.includes('duckdb_databases()')
      ? { toArray: () => [{ toJSON: () => ({ database_name: 'domain_a' }) }] }
      : emptyResult());
    await duckDBService.query("INSERT INTO domain_a.__studio.objects VALUES ('setting', 'filter', '{}', 1)");
    expect(query).toHaveBeenCalledWith('CHECKPOINT "domain_a"');
    expect(query.mock.calls.findIndex(([sql]) => sql.startsWith('INSERT')))
      .toBeLessThan(query.mock.calls.findIndex(([sql]) => sql.startsWith('CHECKPOINT')));
  });
  it('keeps bound result metadata, totals and rows ahead of a queued mutation', async () => {
    const order:string[]=[];
    let release!:()=>void;
    const wait=new Promise<void>(resolve=>{release=resolve;});
    const prepare=vi.fn(async(sql:string)=>({
      query:async(...params:unknown[])=>{
        order.push(sql);expect(params).toEqual(["A' --"]);
        if(sql==='DESCRIBE SELECT ? AS metadata')await wait;
        return emptyResult();
      },close:vi.fn(async()=>{}),
    }));
    Object.assign(duckDBService as any,{conn:{prepare,query:async(sql:string)=>{order.push(sql);return emptyResult();}}});
    const reads=duckDBService.readQueryBatchWithParams(['metadata','total','rows'].map(name=>({sql:`${name==='metadata'?'DESCRIBE ':''}SELECT ? AS ${name}`,params:["A' --"]})));
    await vi.waitFor(()=>expect(order).toEqual(['DESCRIBE SELECT ? AS metadata']));
    const mutation=duckDBService.query('UPDATE users SET kyc_level=2');
    release();await Promise.all([reads,mutation]);
    expect(order.slice(0,4)).toEqual(['DESCRIBE SELECT ? AS metadata','SELECT ? AS total','SELECT ? AS rows','UPDATE users SET kyc_level=2']);
    await expect(duckDBService.readQueryBatchWithParams([{sql:'DELETE FROM users',params:[]}])).rejects.toThrow('只读');
    await expect(duckDBService.readQueryBatchWithParams([{sql:'DESCRIBE DELETE FROM users',params:[]}])).rejects.toThrow('只读');
  });
  it('invalidates downstream analysis after commented mutations, truncate, merge and transaction completion', async () => {
    const changed = vi.spyOn(duckDBService,'dispatchSchemaChanged').mockImplementation(()=>{});
    try {
      for (const sql of ['-- 数据更新\nUPDATE users SET kyc_level=2', 'TRUNCATE users',
        'MERGE INTO users USING changes ON users.uid=changes.uid WHEN MATCHED THEN UPDATE SET kyc_level=2', 'COMMIT', 'ROLLBACK']) {
        changed.mockClear(); await duckDBService.query(sql); expect(changed).toHaveBeenCalled();
      }
      changed.mockClear();
      await duckDBService.query("INSERT INTO memory.__studio.objects VALUES ('setting','x','{}',1)");
      expect(changed).not.toHaveBeenCalled();
    } finally { changed.mockRestore(); }
  });
  it('refreshes analysis after audited table edits and records the actual affected count', async () => {
    const changed=vi.spyOn(duckDBService,'dispatchSchemaChanged').mockImplementation(()=>{});
    query.mockResolvedValueOnce({toArray:()=>[{toJSON:()=>({Count:7})}]});
    try {
      await duckDBService.executeAndAudit('-- edit\nUPDATE users SET kyc_level=2','UPDATE','users','Edit');
      expect(changed).toHaveBeenCalled();
      expect(query).toHaveBeenCalledWith(expect.stringContaining("'Edit', 7,"));
    } finally {changed.mockRestore();}
  });
  it('never replays mutation scripts while obtaining execution plans',async()=>{
    const run=vi.spyOn(duckDBService,'query').mockResolvedValue([]);
    try {
      expect((await duckDBService.getExplainPlan('UPDATE users SET kyc_level=2; DELETE FROM users',false)).planText).toContain('单条 SQL');
      expect((await duckDBService.getExplainPlan('UPDATE users SET kyc_level=2',true)).planText).toContain('只读');
      expect(run).not.toHaveBeenCalled();
      await duckDBService.getExplainPlan('UPDATE users SET kyc_level=2',false);
      expect(run).toHaveBeenCalledWith('EXPLAIN UPDATE users SET kyc_level=2');
    } finally { run.mockRestore(); }
  });

  it('refuses a durable project without OPFS instead of silently creating memory', async () => {
    const attached = new Set(['memory']);
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('current_database()')) {
        return { toArray: () => [{ toJSON: () => ({ db: 'memory' }) }] };
      }
      if (sql.includes('duckdb_databases()')) {
        return {
          toArray: () =>
            [...attached].map((name) => ({
              toJSON: () => ({
                database_name: name,
                path: name === 'memory' ? ':memory:' : ':memory:',
                internal: false,
              }),
            })),
        };
      }
      if (String(sql).includes('ATTACH')) {
        attached.add('analytics');
        return emptyResult();
      }
      return emptyResult();
    });

    await expect(duckDBService.attachProject('analytics')).rejects.toThrow(/OPFS/);

    expect(query).not.toHaveBeenCalledWith(expect.stringContaining('ATTACH'));
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining('CREATE SCHEMA IF NOT EXISTS'));
    expect(attached.has('analytics')).toBe(false);
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

  it('rolls back SQL replacement if a later statement fails and keeps comment semicolons intact', async () => {
    query.mockImplementation(async sql => {
      if (sql.includes('SELECT current_database()')) return {toArray:() => [{toJSON:() => ({db:'memory',sch:'main'})}]};
      if (sql === 'INSERT INTO missing VALUES (1)') throw new Error('missing table');
      return emptyResult();
    });
    await expect(duckDBService.importSqlScript('-- header; comment\n\n-- second\nCREATE TABLE imported(id INT); INSERT INTO missing VALUES (1);',['imported']))
      .rejects.toThrow('已回滚');
    expect(query).toHaveBeenCalledWith('DROP TABLE IF EXISTS "memory"."main"."imported"');
    expect(query).toHaveBeenCalledWith('CREATE TABLE imported(id INT)');
    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(query).not.toHaveBeenCalledWith('COMMIT');
  });

  it('lists user tables from the active catalog + schema', async () => {
    query.mockResolvedValueOnce({
      toArray: () => [
        { toJSON: () => ({ table_name: '_sys_kv_store' }) },
        { toJSON: () => ({ table_name: 'ai_traces' }) },
        { toJSON: () => ({ table_name: 'durable_probe' }) },
      ],
    });

    await expect(duckDBService.getTables()).resolves.toEqual(['ai_traces', 'durable_probe']);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('information_schema.tables'));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('current_database()'));
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

  it('switches both writer and read sessions when activating a database', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes('current_database()')) {
        return { toArray: () => [{ toJSON: () => ({ db: sql.includes('USE') ? 'analytics' : 'memory' }) }] };
      }
      if (sql.includes('current_schema()')) {
        return { toArray: () => [{ toJSON: () => ({ sch: 'main' }) }] };
      }
      if (sql.includes('duckdb_databases()')) {
        return {
          toArray: () => [
            { toJSON: () => ({ database_name: 'memory', path: ':memory:', internal: false }) },
            { toJSON: () => ({ database_name: 'analytics', path: ':memory:', internal: false }) },
          ],
        };
      }
      return emptyResult();
    });

    Object.assign(duckDBService as unknown as Record<string, unknown>, {
      storageMode: 'memory',
      databaseCatalog: null,
    });
    (duckDBService as any).initDatabaseCatalog?.();

    await duckDBService.useProject('analytics');

    const useCalls = query.mock.calls.filter(([sql]) =>
      String(sql).includes('USE') && String(sql).includes('analytics'),
    );
    expect(useCalls.length).toBeGreaterThanOrEqual(1);
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
