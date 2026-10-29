/**
 * OPFS helpers for DuckDB multi-database files (*.duckdb + wal companions).
 */

import { DEFAULT_SESSION_HUB_ALIAS, sanitizeDatabaseAlias } from './databaseCatalog';
import { validateDuckDBDatabaseFile } from './workspaceDatabaseFile';

const WAL_SUFFIXES = ['.wal', '.wal.checkpoint', '.wal.recovery'] as const;

export function duckdbFileName(alias: string): string {
  return `${alias === DEFAULT_SESSION_HUB_ALIAS ? alias : sanitizeDatabaseAlias(alias)}.duckdb`;
}

export function opfsAttachPath(alias: string): string {
  return `opfs://${duckdbFileName(alias)}`;
}

export function isOpfsAvailable(): boolean {
  return typeof navigator !== 'undefined'
    && 'storage' in navigator
    && typeof navigator.storage?.getDirectory === 'function';
}

async function getOpfsRoot(): Promise<FileSystemDirectoryHandle> {
  if (!isOpfsAvailable()) {
    throw new Error('OPFS 不可用：无法创建持久化数据库文件');
  }
  return navigator.storage.getDirectory();
}

export async function listOpfsDuckdbAliases(
  excludeHub: string = DEFAULT_SESSION_HUB_ALIAS,
): Promise<string[]> {
  if (!isOpfsAvailable()) return [];
  try {
    const root = await getOpfsRoot();
    const aliases: string[] = [];
    // @ts-expect-error async iterator on FileSystemDirectoryHandle
    for await (const [name] of root.entries()) {
      if (typeof name !== 'string' || !name.endsWith('.duckdb')) continue;
      if (name.endsWith('.duckdb.wal') || name.includes('.wal')) continue;
      const alias = name.replace(/\.duckdb$/, '');
      if (!alias || alias === excludeHub) continue;
      aliases.push(alias);
    }
    return aliases.sort((a, b) => a.localeCompare(b));
  } catch (err) {
    console.warn('[opfsDatabaseFiles] list failed:', err);
    return [];
  }
}

/** Ensure the .duckdb file (+ empty wal companions) exist in OPFS; return ATTACH path. */
export async function ensureOpfsDuckdbFile(alias: string): Promise<string> {
  const fileName = duckdbFileName(alias);
  const root = await getOpfsRoot();
  await root.getFileHandle(fileName, { create: true });
  for (const suffix of WAL_SUFFIXES) {
    try {
      await root.getFileHandle(`${fileName}${suffix}`, { create: true });
    } catch {
      /* optional companions */
    }
  }
  return `opfs://${fileName}`;
}

/** Seed only a new/empty session hub; never replace an existing database. */
export async function prepareOpfsWorkspaceFile(): Promise<void> {
  const root = await getOpfsRoot();
  const handle = await root.getFileHandle(duckdbFileName(DEFAULT_SESSION_HUB_ALIAS), { create: true });
  if ((await handle.getFile()).size !== 0) return;
  const response = await fetch(`${import.meta.env.BASE_URL}empty_domain.duckdb`);
  if (!response.ok) throw new Error('无法读取空白 DuckDB 数据库模板');
  const bytes = new Uint8Array(await response.arrayBuffer());
  validateDuckDBDatabaseFile(bytes);
  const writable = await handle.createWritable();
  try {
    await writable.write(bytes);
    await writable.close();
  } catch (error) {
    try { await writable.abort(error); } catch { /* preserve the write error */ }
    throw error;
  }
}

/** Copy a user-selected, checkpointed DuckDB file into OPFS without overwriting an existing domain. */
export async function importOpfsDuckdbFile(file: File, alias: string): Promise<string> {
  const fileName = duckdbFileName(alias);
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateDuckDBDatabaseFile(bytes);
  const root = await getOpfsRoot();
  try {
    await root.getFileHandle(fileName);
    throw new Error(`数据库文件 ${fileName} 已存在`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('已存在')) throw error;
    if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error;
  }
  const handle = await root.getFileHandle(fileName, { create: true });
  try {
    const writable = await handle.createWritable();
    await writable.write(bytes);
    await writable.close();
    return `opfs://${fileName}`;
  } catch (error) {
    try { await root.removeEntry(fileName); } catch { /* preserve original error */ }
    throw error;
  }
}

/** Initialize a new domain from a checkpointed, empty DuckDB file shipped with the app. */
export async function createOpfsDuckdbFile(alias: string): Promise<string> {
  const response = await fetch(`${import.meta.env.BASE_URL}empty_domain.duckdb`);
  if (!response.ok) throw new Error('无法读取空白 DuckDB 数据库模板');
  const bytes = new Uint8Array(await response.arrayBuffer());
  validateDuckDBDatabaseFile(bytes);
  return importOpfsDuckdbFile(new File([bytes], duckdbFileName(alias)), alias);
}

export async function deleteOpfsDuckdbFile(alias: string): Promise<void> {
  if (!isOpfsAvailable()) throw new Error('OPFS 不可用，无法删除数据库文件');
  const fileName = duckdbFileName(alias);
  const root = await getOpfsRoot();
  const toRemove = [fileName, ...WAL_SUFFIXES.map((s) => `${fileName}${s}`)];
  for (const name of toRemove) {
    try {
      await root.removeEntry(name);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error;
    }
  }
}

/** Export a DuckDB database file from OPFS as a Blob. */
export async function exportOpfsDuckdbFile(alias: string = DEFAULT_SESSION_HUB_ALIAS): Promise<Blob> {
  if (!isOpfsAvailable()) throw new Error('OPFS 不可用，无法导出底层数据库文件');
  const fileName = duckdbFileName(alias);
  const root = await getOpfsRoot();
  try {
    const handle = await root.getFileHandle(fileName);
    return await handle.getFile();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      throw new Error(`OPFS 中未找到数据库文件 ${fileName}`);
    }
    throw error;
  }
}
