import { describe, expect, it, vi } from 'vitest';
import { DuckDBAccessMode } from '@duckdb/duckdb-wasm';
import {
  createWorkspaceOpenConfig,
  DuckDBRuntime,
  duckDBResultToRows,
  openWorkspaceDatabase,
  verifyDuckDBReadiness,
  WORKSPACE_DATABASE_PATH,
} from './duckdbRuntime';

describe('DuckDBRuntime storage selection', () => {
  it('opens the durable workspace directly in OPFS when supported', () => {
    expect(createWorkspaceOpenConfig(true)).toEqual(expect.objectContaining({
      path: WORKSPACE_DATABASE_PATH,
      accessMode: DuckDBAccessMode.READ_WRITE,
      arrowLosslessConversion: true,
      opfs: { fileHandling: 'auto' },
    }));
  });

  it('falls back to an in-memory database when OPFS is unavailable', () => {
    expect(createWorkspaceOpenConfig(false)).toEqual(expect.objectContaining({
      path: ':memory:',
      accessMode: DuckDBAccessMode.READ_WRITE,
    }));
    expect(createWorkspaceOpenConfig(false)).not.toHaveProperty('opfs');
  });

  it('reports OPFS mode when the durable database opens successfully', async () => {
    const open = vi.fn().mockResolvedValue(undefined);

    const result = await openWorkspaceDatabase({ open }, true);

    expect(open).toHaveBeenCalledWith(createWorkspaceOpenConfig(true));
    expect(result).toEqual({ mode: 'opfs' });
  });

  it('falls back to memory when the OPFS database cannot be opened', async () => {
    const persistenceError = new Error('OPFS permission denied');
    const open = vi.fn()
      .mockRejectedValueOnce(persistenceError)
      .mockResolvedValueOnce(undefined);

    await expect(openWorkspaceDatabase({ open }, true)).resolves.toEqual({
      mode: 'memory',
      persistenceError,
    });
    expect(open.mock.calls).toEqual([
      [createWorkspaceOpenConfig(true)],
      [createWorkspaceOpenConfig(false)],
    ]);
  });
});

describe('DuckDBRuntime execution contracts', () => {
  it('only reports the engine ready after a real query returns the expected value', async () => {
    const healthyConnection = {
      query: vi.fn().mockResolvedValue({
        toArray: () => [{ toJSON: () => ({ readiness_check: 42 }) }],
      }),
      cancelSent: vi.fn(),
    };

    await expect(verifyDuckDBReadiness(healthyConnection)).resolves.toBeUndefined();
    expect(healthyConnection.query).toHaveBeenCalledWith(
      'SELECT 42::INTEGER AS readiness_check',
    );
  });

  it('rejects a false-ready engine whose first query cannot return data', async () => {
    const brokenConnection = {
      query: vi.fn().mockResolvedValue({ toArray: () => [] }),
      cancelSent: vi.fn(),
    };

    await expect(verifyDuckDBReadiness(brokenConnection)).rejects.toThrow(
      'DuckDB readiness probe returned an unexpected result',
    );
  });

  it('preserves BIGINT and DECIMAL values as exact strings', async () => {
    const query = vi.fn().mockResolvedValue({
      toArray: () => [{
        toJSON: () => ({
          safe_bigint: 42n,
          unsafe_bigint: 9007199254740993n,
          decimal_value: { scale: 2, toString: () => '123.45' },
        }),
      }],
    });
    const runtime = new DuckDBRuntime();

    const rows = await runtime.execute({ query, cancelSent: vi.fn() }, 'SELECT values');

    expect(rows).toEqual([{
      safe_bigint: '42',
      unsafe_bigint: '9007199254740993',
      decimal_value: '123.45',
    }]);
  });

  it('cancels the connection that owns the active query', async () => {
    let resolveQuery: ((value: unknown) => void) | undefined;
    const query = vi.fn(() => new Promise(resolve => {
      resolveQuery = resolve;
    }));
    const cancelSent = vi.fn().mockResolvedValue(true);
    const runtime = new DuckDBRuntime();
    const pending = runtime.execute({ query, cancelSent }, 'SELECT slow');

    await expect(runtime.cancelActiveQuery()).resolves.toBe(true);
    expect(cancelSent).toHaveBeenCalledOnce();

    resolveQuery?.({ toArray: () => [] });
    await pending;
  });

  it('rolls back failed transactions on the same connection', async () => {
    const query = vi.fn().mockResolvedValue({ toArray: () => [] });
    const runtime = new DuckDBRuntime();
    const connection = { query, cancelSent: vi.fn() };

    await expect(runtime.transaction(connection, async execute => {
      await execute('INSERT INTO values_table VALUES (1)');
      throw new Error('boom');
    })).rejects.toThrow('boom');

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN TRANSACTION',
      'INSERT INTO values_table VALUES (1)',
      'ROLLBACK',
    ]);
  });
});


describe('Arrow decimal result decoding', () => {
  it('decodes signed HUGEINT exactly while preserving ordinary binary cells', () => {
    const bytes = (value: bigint) => { let n=BigInt.asUintN(128,value);const out=new Uint8Array(16);for(let i=0;i<16;i++){out[i]=Number(n&255n);n>>=8n;}return out; };
    const blob=bytes(42n);
    const result={schema:{fields:[{name:'total',type:{typeId:15,byteWidth:16}},{name:'blob',type:{typeId:4}}]},toArray:()=>[{total:bytes(104270n),blob},{total:bytes(-7n),blob},{total:bytes(9007199254740993n),blob}]};
    const rows=duckDBResultToRows(result, value => value);
    expect(rows.map(row=>row.total)).toEqual([104270,-7,'9007199254740993']);
    expect(rows[0].blob).toEqual(blob);
  });

  it('opens the prepared writable VFS path after registering the primary file', async () => {
    const order: string[] = [];
    const open = vi.fn(async () => { order.push('open'); });
    const prepare = vi.fn(async () => { order.push('register'); return 'duckdb_manager_workspace.duckdb'; });
    expect(await openWorkspaceDatabase({ open }, true, prepare)).toEqual({ mode: 'opfs' });
    expect(order).toEqual(['register', 'open']);
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ path: 'duckdb_manager_workspace.duckdb', accessMode: DuckDBAccessMode.READ_WRITE }));
  });
  it('uses column scale for fractional and signed decimal128 cells without losing precision', () => {
    const result = {
      schema: { fields: [
        { name: 'crypto', type: { typeId: 7, scale: 8 } },
        { name: 'negative', type: { typeId: 7, scale: 2 } },
        { name: 'large', type: { typeId: 7, scale: 2 } },
        { name: 'empty', type: { typeId: 7, scale: 8 } },
        { name: 'blob', type: { typeId: 4 } },
      ] },
      toArray: () => [{ toJSON: () => ({
        crypto: new Uint32Array([2000000, 0, 0, 0]),
        negative: new Uint32Array([0xffffff85, 0xffffffff, 0xffffffff, 0xffffffff]),
        large: 900719925474099301n,
        empty: null,
        blob: 'unchanged',
      }) }],
    };
    expect(duckDBResultToRows(result)).toEqual([{
      crypto: '0.02000000', negative: '-1.23', large: '9007199254740993.01',
      empty: null, blob: 'unchanged',
    }]);
  });
});
