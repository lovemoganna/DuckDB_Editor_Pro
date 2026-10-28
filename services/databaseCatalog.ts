/**
 * Real DuckDB multi-database catalog — CREATE / ATTACH / USE / DETACH / SHOW DATABASES.
 * One attached catalog = one analysis domain. No frontend-only "fake databases".
 */

export type CatalogSqlExecutor = (sql: string) => Promise<Record<string, unknown>[]>;

export interface CatalogDatabaseInfo {
  name: string;
  path: string | null;
  type: string;
  readonly: boolean;
  internal: boolean;
  isCurrent: boolean;
  /** true when path is an OPFS / filesystem .duckdb (not :memory:) */
  persistent: boolean;
  /** The database opened by DuckDB itself; it cannot be detached. */
  isPrimary?: boolean;
}

export interface DatabaseCatalogDeps {
  /** Register an OPFS-backed .duckdb (and companions) so ATTACH can open it. Returns ATTACH path. */
  ensurePersistentFile?: (alias: string) => Promise<string>;
  /** Configure DuckDB's OPFS auto handler for a file that does not exist yet. */
  createPersistentFile?: (alias: string) => Promise<string>;
  /** Release VFS handles after DETACH so another session can open the file. */
  releasePersistentFile?: (alias: string) => Promise<void>;
  /** Delete the OPFS .duckdb (and wal companions) after detach. */
  deletePersistentFile?: (alias: string) => Promise<void>;
  /** List OPFS *.duckdb basenames (without extension), excluding the session hub. */
  listPersistentFiles?: () => Promise<string[]>;
  supportsPersistentFiles: boolean;
  /** Catalog name of the OPFS session hub — not an analysis workspace. */
  sessionHubName?: string;
}

export const MEMORY_DATABASE_NAME = 'memory';
export const DEFAULT_SESSION_HUB_ALIAS = 'duckdb_manager_workspace';

export function sanitizeDatabaseAlias(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('数据库名称不能为空');
  if (trimmed.length > 64) throw new Error('数据库名称不能超过 64 个字符');
  const alias = trimmed
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, '_$1');
  if (!alias) throw new Error('数据库名称无效，请使用字母、数字或下划线');
  if (alias.toLowerCase() === MEMORY_DATABASE_NAME) {
    throw new Error('memory 是保留的临时分析空间，请换一个名称');
  }
  if (alias.toLowerCase() === DEFAULT_SESSION_HUB_ALIAS) {
    throw new Error('该名称为系统会话库保留，请换一个名称');
  }
  return alias;
}

export function quoteIdent(name: string): string {
  return `"${String(name).replace(/"/g, '""')}"`;
}

export function quoteLiteral(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function opfsDatabasePath(alias: string): string {
  const safe = sanitizeDatabaseAlias(alias);
  return `opfs://${safe}.duckdb`;
}

export function isMemoryPath(path: string | null | undefined): boolean {
  if (!path) return true;
  const normalized = path.trim().toLowerCase();
  return normalized === '' || normalized === ':memory:' || normalized === 'memory';
}

function rowString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).length > 0) return String(value);
  }
  return '';
}

export class DatabaseCatalog {
  constructor(
    private readonly execute: CatalogSqlExecutor,
    private readonly deps: DatabaseCatalogDeps,
  ) {}

  async listDatabases(): Promise<CatalogDatabaseInfo[]> {
    const current = await this.currentDatabaseName();
    const hub = this.deps.sessionHubName || DEFAULT_SESSION_HUB_ALIAS;

    let rows: Record<string, unknown>[] = [];
    try {
      rows = await this.execute(`
        SELECT database_name, path, type,
               CAST(readonly AS INTEGER) AS readonly_flag,
               CAST(internal AS INTEGER) AS internal_flag
        FROM duckdb_databases()
        ORDER BY CASE WHEN database_name = ${quoteLiteral(MEMORY_DATABASE_NAME)} THEN 0 ELSE 1 END,
                 database_name
      `);
    } catch {
      try {
        rows = await this.execute('SHOW DATABASES');
      } catch {
        throw new Error('无法从 DuckDB Catalog 读取数据库列表');
      }
    }

    return rows
      .map((row) => {
        const name =
          rowString(row, 'database_name', 'database', 'name') ||
          String(Object.values(row)[0] ?? '');
        const path = row.path == null ? null : String(row.path);
        // DuckDB-Wasm can expose Arrow BOOLEAN scalars as non-boolean bytes in
        // toJSON(); cast in SQL and compare numerically instead of truthiness.
        const internal = Number(row.internal_flag ?? row.internal ?? 0) === 1;
        return {
          name,
          path,
          type: rowString(row, 'type') || (isMemoryPath(path) ? 'memory' : 'duckdb'),
          readonly: Number(row.readonly_flag ?? row.readonly ?? 0) === 1,
          internal,
          isCurrent: name === current,
          persistent: !isMemoryPath(path),
          isPrimary: name === (rows.some((candidate) => rowString(candidate, 'database_name', 'database', 'name') === hub)
            ? hub : MEMORY_DATABASE_NAME),
        } satisfies CatalogDatabaseInfo;
      })
      .filter((db) => Boolean(db.name) && !['system', 'temp'].includes(db.name.toLowerCase()));
  }

  async currentDatabaseName(): Promise<string> {
    const rows = await this.execute('SELECT current_database() AS db');
    if (!rows[0]?.db) throw new Error('DuckDB 未返回当前数据库');
    return String(rows[0].db);
  }

  /**
   * Create a new analysis database and ATTACH it.
   * persistent=true → OPFS .duckdb file; false → ATTACH ':memory:' AS alias (ephemeral isolation).
   */
  async createDatabase(
    name: string,
    opts?: { persistent?: boolean; activate?: boolean },
  ): Promise<CatalogDatabaseInfo> {
    const alias = sanitizeDatabaseAlias(name);
    const existing = await this.listDatabases();
    if (existing.some((db) => db.name === alias)) {
      throw new Error(`数据库「${alias}」已存在`);
    }

    if (opts?.persistent !== false && !this.deps.supportsPersistentFiles) {
      throw new Error('OPFS 不可用，无法创建持久化 .duckdb 文件');
    }
    const wantPersistent = opts?.persistent !== false;
    await this.attachByAlias(alias, { persistent: wantPersistent, create: true });

    if (opts?.activate !== false) {
      await this.useDatabase(alias);
    }

    const listed = await this.listDatabases();
    const created = listed.find((db) => db.name === alias);
    if (!created) throw new Error(`数据库「${alias}」创建后未出现在 Catalog 中`);
    return created;
  }

  /** ATTACH an existing OPFS / memory database by alias. */
  async attachDatabase(
    name: string,
    opts?: { persistent?: boolean; path?: string },
  ): Promise<CatalogDatabaseInfo> {
    const alias = sanitizeDatabaseAlias(name);
    const listed = await this.listDatabases();
    if (listed.some((db) => db.name === alias)) {
      return listed.find((db) => db.name === alias)!;
    }

    const wantPersistent = opts?.persistent !== false && !opts?.path?.startsWith(':memory:');
    if (wantPersistent && !this.deps.supportsPersistentFiles) {
      throw new Error('OPFS 不可用，无法挂载持久化 .duckdb 文件');
    }

    await this.attachByAlias(alias, {
      persistent: wantPersistent,
      path: opts?.path,
      create: false,
    });

    const after = await this.listDatabases();
    const attached = after.find((db) => db.name === alias);
    if (!attached) throw new Error(`挂载数据库「${alias}」失败`);
    return attached;
  }

  async useDatabase(name: string): Promise<{ catalog: string; schema: string }> {
    const alias = name.trim() === MEMORY_DATABASE_NAME || name.trim() === (this.deps.sessionHubName || DEFAULT_SESSION_HUB_ALIAS)
      ? name.trim()
      : sanitizeDatabaseAlias(name);

    const listed = await this.listDatabases();
    const knownNames = new Set(listed.map((db) => db.name));
    // The primary catalog and memory are both present in DuckDB's real catalog.
    if (alias !== MEMORY_DATABASE_NAME && !knownNames.has(alias)) {
      // Try attach from OPFS before failing
      if (this.deps.supportsPersistentFiles) {
        await this.attachByAlias(alias, { persistent: true, create: false });
      } else {
        throw new Error(`数据库「${alias}」未挂载`);
      }
    }

    await this.execute(`USE ${quoteIdent(alias)}`);
    // Prefer main schema inside the selected catalog
    try {
      await this.execute(`SET schema = 'main'`);
    } catch {
      /* some builds bind schema with USE */
    }

    const catalog = await this.currentDatabaseName();
    let schema = 'main';
    try {
      const rows = await this.execute('SELECT current_schema() AS sch');
      schema = String(rows[0]?.sch || 'main');
    } catch {
      /* keep main */
    }
    return { catalog, schema };
  }

  async detachDatabase(name: string): Promise<void> {
    const alias = sanitizeDatabaseAlias(name);
    if (alias === (this.deps.sessionHubName || DEFAULT_SESSION_HUB_ALIAS)) {
      throw new Error('旧工作区是 DuckDB 主数据库，不能卸载');
    }
    if (alias === MEMORY_DATABASE_NAME) {
      throw new Error('不能卸载 memory 临时分析空间');
    }

    const current = await this.currentDatabaseName();
    if (current === alias) {
      await this.useDatabase(MEMORY_DATABASE_NAME);
    }

    const database = (await this.listDatabases()).find((item) => item.name === alias);
    if (database?.persistent && !database.readonly) await this.execute(`CHECKPOINT ${quoteIdent(alias)}`);

    await this.execute(`DETACH DATABASE IF EXISTS ${quoteIdent(alias)}`);
    await this.deps.releasePersistentFile?.(alias);
    if ((await this.listDatabases()).some((db) => db.name === alias)) {
      throw new Error(`数据库「${alias}」卸载后仍在 Catalog 中`);
    }
  }

  /** DETACH + delete the underlying .duckdb file (if persistent). */
  async dropDatabase(name: string): Promise<void> {
    const alias = sanitizeDatabaseAlias(name);
    const database = (await this.listDatabases()).find((item) => item.name === alias);
    if (!database) throw new Error(`数据库「${alias}」未挂载`);
    await this.detachDatabase(alias);
    if (database.persistent) await this.deps.deletePersistentFile?.(alias);
  }

  /**
   * On boot: ATTACH every OPFS *.duckdb that is not the session hub.
   * Does not change the current database (caller should USE memory).
   */
  async remountPersistedDatabases(): Promise<string[]> {
    if (!this.deps.supportsPersistentFiles || !this.deps.listPersistentFiles) {
      return [];
    }
    const files = await this.deps.listPersistentFiles();
    const hub = this.deps.sessionHubName || DEFAULT_SESSION_HUB_ALIAS;
    const mounted: string[] = [];
    const existing = new Set((await this.listDatabases()).map((db) => db.name));

    for (const fileAlias of files) {
      if (!fileAlias || fileAlias === hub || fileAlias === MEMORY_DATABASE_NAME) continue;
      if (existing.has(fileAlias)) {
        mounted.push(fileAlias);
        continue;
      }
      try {
        await this.attachByAlias(fileAlias, { persistent: true, create: false });
        mounted.push(fileAlias);
      } catch (err) {
        console.warn(`[DatabaseCatalog] Failed to remount ${fileAlias}:`, err);
      }
    }
    return mounted;
  }

  private async attachByAlias(
    alias: string,
    opts: { persistent: boolean; path?: string; create: boolean },
  ): Promise<void> {
    if (!opts.persistent) {
      await this.execute(
        `ATTACH IF NOT EXISTS ${quoteLiteral(':memory:')} AS ${quoteIdent(alias)}`,
      );
      return;
    }

    let path = opts.path;
    if (!path) {
      if (!this.deps.ensurePersistentFile) {
        throw new Error('当前环境不支持持久化数据库文件（需要 OPFS）');
      }
      if (!opts.create && this.deps.listPersistentFiles) {
        const files = await this.deps.listPersistentFiles();
        if (!files.includes(alias)) throw new Error(`持久化文件不存在: ${alias}.duckdb`);
      }
      path = opts.create && this.deps.createPersistentFile
        ? await this.deps.createPersistentFile(alias)
        : await this.deps.ensurePersistentFile(alias);
    }

    try {
      await this.execute(`ATTACH ${quoteLiteral(path)} AS ${quoteIdent(alias)}`);
    } catch (error) {
      await this.deps.releasePersistentFile?.(alias);
      throw error;
    }
  }
}
