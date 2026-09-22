import { describe, expect, it, vi } from 'vitest';
import { DuckDBAccessMode } from '@duckdb/duckdb-wasm';
import {
  createWorkspaceOpenConfig,
  DuckDBRuntime,
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
