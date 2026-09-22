import {
  DuckDBAccessMode,
  type AsyncDuckDB,
  type DuckDBConfig,
} from '@duckdb/duckdb-wasm';
import { WORKSPACE_DATABASE_FILE_NAME } from './workspaceDatabaseFile';

export type DuckDBStorageMode = 'opfs' | 'memory';
export const WORKSPACE_DATABASE_PATH = `opfs://${WORKSPACE_DATABASE_FILE_NAME}`;

export interface WorkspaceOpenResult {
  mode: DuckDBStorageMode;
  persistenceError?: Error;
}

type OpenableDuckDB = Pick<AsyncDuckDB, 'open'>;

export interface RuntimeConnection {
  query(sql: string): Promise<unknown>;
  cancelSent(): Promise<boolean> | boolean;
}

export interface PreparedRuntimeConnection extends RuntimeConnection {
  prepare(sql: string): Promise<{
    query(...params: unknown[]): Promise<unknown>;
    close(): Promise<void>;
  }>;
}

type RuntimeRow = Record<string, unknown>;

function isDecimalLike(value: Record<string, unknown>): boolean {
  const constructorName = value.constructor?.name ?? '';
  return 'scale' in value
    || constructorName.includes('Decimal')
    || constructorName.includes('Numeric');
}

export function normalizeDuckDBValue(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value === null || value === undefined || value instanceof Date) return value ?? null;
  if (Array.isArray(value)) return value.map(normalizeDuckDBValue);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (isDecimalLike(record) && typeof value.toString === 'function') {
      return value.toString();
    }
    return Object.fromEntries(
      Object.entries(record).map(([key, nested]) => [key, normalizeDuckDBValue(nested)]),
    );
  }
  return value;
}

export function duckDBResultToRows(result: unknown): RuntimeRow[] {
  if (!result || typeof (result as { toArray?: unknown }).toArray !== 'function') return [];
  const values = (result as { toArray(): unknown[] }).toArray();
  return values.map(value => {
    const row = value && typeof (value as { toJSON?: unknown }).toJSON === 'function'
      ? (value as { toJSON(): RuntimeRow }).toJSON()
      : value as RuntimeRow;
    return normalizeDuckDBValue(row) as RuntimeRow;
  });
}

export async function verifyDuckDBReadiness(
  connection: RuntimeConnection,
): Promise<void> {
  const rows = duckDBResultToRows(
    await connection.query('SELECT 42::INTEGER AS readiness_check'),
  );
  if (rows.length !== 1 || Number(rows[0].readiness_check) !== 42) {
    throw new Error('DuckDB readiness probe returned an unexpected result');
  }
}

/**
 * Owns query result conversion, active-query cancellation, and transaction
 * lifecycle. Higher-level services may serialize work, but do not need to know
 * the worker cancellation or Arrow conversion details.
 */
export class DuckDBRuntime {
  private active: { connection: RuntimeConnection; token: symbol } | null = null;

  async executeArrow(connection: RuntimeConnection, sql: string): Promise<unknown> {
    const token = Symbol('duckdb-query');
    this.active = { connection, token };
    try {
      return await connection.query(sql);
    } finally {
      if (this.active?.token === token) {
        this.active = null;
      }
    }
  }

  async execute(connection: RuntimeConnection, sql: string): Promise<RuntimeRow[]> {
    return duckDBResultToRows(await this.executeArrow(connection, sql));
  }

  async executePrepared(
    connection: PreparedRuntimeConnection,
    sql: string,
    params: unknown[],
  ): Promise<RuntimeRow[]> {
    const token = Symbol('duckdb-prepared-query');
    this.active = { connection, token };
    let statement: Awaited<ReturnType<PreparedRuntimeConnection['prepare']>> | null = null;
    try {
      statement = await connection.prepare(sql);
      return duckDBResultToRows(await statement.query(...params));
    } finally {
      if (statement) {
        try {
          await statement.close();
        } catch {
          // Statement cleanup must not mask the query result or original error.
        }
      }
      if (this.active?.token === token) {
        this.active = null;
      }
    }
  }

  async cancelActiveQuery(): Promise<boolean> {
    const active = this.active;
    if (!active) return false;
    return Boolean(await active.connection.cancelSent());
  }

  async transaction<T>(
    connection: RuntimeConnection,
    operation: (execute: (sql: string) => Promise<RuntimeRow[]>) => Promise<T>,
  ): Promise<T> {
    await this.execute(connection, 'BEGIN TRANSACTION');
    try {
      const result = await operation(sql => this.execute(connection, sql));
      await this.execute(connection, 'COMMIT');
      return result;
    } catch (error) {
      try {
        await this.execute(connection, 'ROLLBACK');
      } catch {
        // Preserve the original operation error.
      }
      throw error;
    }
  }
}

export function createWorkspaceOpenConfig(useOPFS: boolean): DuckDBConfig {
  const shared = {
    accessMode: DuckDBAccessMode.READ_WRITE,
    arrowLosslessConversion: true,
    query: {
      castBigIntToDouble: false,
      castDecimalToDouble: false,
      castTimestampToDate: false,
    },
  } satisfies DuckDBConfig;

  if (useOPFS) {
    return {
      ...shared,
      path: WORKSPACE_DATABASE_PATH,
      opfs: { fileHandling: 'auto' },
    };
  }

  return { ...shared, path: ':memory:' };
}

export async function openWorkspaceDatabase(
  database: OpenableDuckDB,
  useOPFS: boolean,
): Promise<WorkspaceOpenResult> {
  if (!useOPFS) {
    await database.open(createWorkspaceOpenConfig(false));
    return { mode: 'memory' };
  }

  try {
    await database.open(createWorkspaceOpenConfig(true));
    return { mode: 'opfs' };
  } catch (error) {
    await database.open(createWorkspaceOpenConfig(false));
    return {
      mode: 'memory',
      persistenceError: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
