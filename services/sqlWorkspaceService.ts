import { openDB } from 'idb';
import { duckDBService } from './duckdbService';
import { dbService } from './dbService';
import { useAppStore } from '../hooks/store/useAppStore';
import { refreshDatabaseAnalysis } from './databaseAnalysis';
import { splitSqlStatements } from './dataflow/sqlToWorkflowParser';
import { stripSqlHeader } from './sqlScript';

export interface SqlSource { name: string; content: string; hash: string; database: string; schema: string; tables: string[]; savedAt: number; version: number }
const sourceKey = 'sql-source-v1';
async function sourceArchive() {
  return openDB('studio-sql-sources', 1, { upgrade(db) { db.createObjectStore('sources'); } });
}

export function declaredSqlTables(content: string): string[] {
  const tables = splitSqlStatements(content).flatMap(statement => {
    const clean = stripSqlHeader(statement);
    const match = clean.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:"(?:[^"]|"")*"|[\w]+)(?:\s*\.\s*(?:"(?:[^"]|"")*"|[\w]+)){0,2})/i);
    if (!match) return [];
    const parts = match[1].match(/"(?:[^"]|"")*"|[\w]+/g) || [];
    return [parts[parts.length - 1].replace(/^"|"$/g, '').replace(/""/g, '"')];
  });
  return [...new Set(tables)];
}

export async function loadSqlSource(database: string): Promise<SqlSource | null> {
  const source = await dbService.getDomainSetting<SqlSource>(sourceKey, database);
  if (source) return source;
  const archive = await sourceArchive();
  try { return await archive.get('sources', database) || null; } finally { archive.close(); }
}

export async function importSqlWorkspace(file: File): Promise<SqlSource> {
  await duckDBService.init();
  const content = await file.text();
  if (!content.trim()) throw new Error('SQL 文件为空');
  let scope = await duckDBService.getCurrentCatalogAndSchema();
  // A first SQL upload automatically gets a durable database, with no configuration step.
  if (scope.catalog === 'memory' && duckDBService.getRuntimeInfo().storageMode === 'opfs') {
    const alias = `sql_${file.name.replace(/\.sql$/i, '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40) || 'workspace'}`;
    const databases = await duckDBService.listDatabases();
    if (databases.some(database => database.name === alias)) await duckDBService.useDatabase(alias);
    else await duckDBService.createDatabase(alias, { persistent: true, activate: true });
    scope = await duckDBService.getCurrentCatalogAndSchema();
  }
  useAppStore.getState().setCurrentDatabase(scope.catalog);
  const previous = await loadSqlSource(scope.catalog);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const tables = await duckDBService.importSqlScript(content, previous?.name === file.name && previous.schema === scope.schema
    ? [...new Set([...previous.tables, ...declaredSqlTables(previous.content)])] : []);
  const declared = declaredSqlTables(content);
  const source: SqlSource = { name: file.name, content, hash, database: scope.catalog, schema: scope.schema,
    tables: declared.filter(table => tables.includes(table)), savedAt: Date.now(), version: (previous?.version || 0) + 1 };
  // The original SQL file is durable even if OPFS is temporarily unavailable.
  const archive = await sourceArchive();
  try { await archive.put('sources', source, scope.catalog); await archive.put('sources', scope.catalog, '__last__'); } finally { archive.close(); }
  await dbService.saveDomainSetting(sourceKey, source, scope.catalog);
  useAppStore.getState().setTables(tables);
  useAppStore.getState().setCurrentTable(tables[0] || null);
  useAppStore.getState().bumpDashboardRefresh();
  await refreshDatabaseAnalysis();
  window.dispatchEvent(new CustomEvent('duckdb-sql-source-updated'));
  return source;
}

export async function reloadSqlWorkspace(database: string): Promise<SqlSource> {
  const source = await loadSqlSource(database);
  if (!source) throw new Error('尚未保存 SQL 文件');
  return importSqlWorkspace(new File([source.content], source.name, { type: 'application/sql' }));
}

/** Restore the last uploaded workspace on app restart without asking for configuration. */
export async function restoreSqlWorkspaceSession(): Promise<void> {
  const archive = await sourceArchive();
  let source: SqlSource | undefined;
  try {
    const last = await archive.get('sources', '__last__');
    source = last ? await archive.get('sources', last) : (await archive.getAll('sources')).filter(item => item && typeof item === 'object' && item.content).sort((a, b) => b.savedAt - a.savedAt)[0];
  } finally { archive.close(); }
  if (!source) return;
  if (source.database !== 'memory' && duckDBService.getRuntimeInfo().storageMode === 'opfs') {
    const attached = await duckDBService.listDatabases();
    if (!attached.some(database => database.name === source!.database)) {
      const files = await duckDBService.listDetachedDatabaseFiles();
      if (!files.includes(source.database)) throw new Error(`保存的 SQL 数据库 ${source.database} 文件不存在，请重新上传 SQL 副本`);
      await duckDBService.attachDatabase(source.database, { persistent: true });
    }
    await duckDBService.useDatabase(source.database);
    if (source.schema !== 'main') await duckDBService.switchAnalysisContext({id:source.schema,kind:'schema'});
    return;
  }
  const scope = await duckDBService.getCurrentCatalogAndSchema();
  if (scope.catalog === 'memory' && (await duckDBService.getTables()).length === 0) {
    await duckDBService.importSqlScript(source.content);
    await dbService.saveDomainSetting(sourceKey, { ...source, database: 'memory' }, 'memory');
  }
}
