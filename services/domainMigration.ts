import { duckDBService } from './duckdbService';
import { dbService } from './dbService';
import { quoteIdent, quoteLiteral } from './databaseCatalog';
import type { SavedQuery, Dashboard } from '../types';
import { rebindDomainSql } from './domainMigrationSql';
import { HOME_DASHBOARD_ID, homeDashboardIdForCatalog } from './homeDashboardService';

export type DomainObjectKind = 'table' | 'view' | 'query' | 'dashboard';
export interface DomainObject { kind: DomainObjectKind; id: string; label: string; rowCount?: number }

function qualified(catalog: string, name: string): string {
  return `${quoteIdent(catalog)}.${quoteIdent('main')}.${quoteIdent(name)}`;
}

export async function listDomainObjects(source: string): Promise<DomainObject[]> {
  const catalog = (await duckDBService.listDatabases()).find((db) => db.name === source);
  if (!catalog) throw new Error(`源数据库「${source}」未挂载`);
  const rows = await duckDBService.query(`
    SELECT table_name AS name, table_type AS type
    FROM information_schema.tables
    WHERE table_catalog = ${quoteLiteral(source)} AND table_schema = 'main'
    ORDER BY table_type, table_name`);
  const objects: DomainObject[] = [];
  for (const row of rows) {
    const name = String(row.name);
    const kind = String(row.type).toUpperCase().includes('VIEW') ? 'view' : 'table';
    if (name.startsWith('_sys_')) continue;
    let rowCount: number | undefined;
    if (kind === 'table') {
      const count = await duckDBService.query(`SELECT COUNT(*) AS n FROM ${qualified(source, name)}`);
      rowCount = Number(count[0]?.n || 0);
    }
    objects.push({ kind, id: name, label: name, rowCount });
  }
  for (const query of await dbService.getQueries(source)) {
    objects.push({ kind: 'query', id: query.id, label: query.name });
  }
  for (const dashboard of await dbService.getDashboards(source) as Dashboard[]) {
    objects.push({ kind: 'dashboard', id: dashboard.id, label: dashboard.name });
  }
  return objects;
}

/** Copy explicitly selected objects. The source catalog is never modified. */
export async function copyDomainObjects(source: string, target: string, selected: DomainObject[]): Promise<{ copied: number; rows: number }> {
  if (source === target) throw new Error('源库和目标库必须不同');
  const databases = await duckDBService.listDatabases();
  if (!databases.some((db) => db.name === source) || !databases.some((db) => db.name === target)) {
    throw new Error('源库和目标库都必须已挂载');
  }
  const available = await listDomainObjects(source);
  const valid = new Set(available.map((object) => `${object.kind}:${object.id}`));
  if (selected.some((object) => !valid.has(`${object.kind}:${object.id}`))) throw new Error('迁移列表已过期，请重新读取');
  const existing = await listDomainObjects(target);
  const occupied = new Set(existing.map((object) => `${object.kind}:${object.id}`));
  const targetId = (object: DomainObject) => object.kind === 'dashboard' && object.id.startsWith(`${HOME_DASHBOARD_ID}::`)
    ? homeDashboardIdForCatalog(target) : object.id;
  if (selected.some((object) => occupied.has(`${object.kind}:${targetId(object)}`))) throw new Error('目标库有同名对象；请取消选择冲突对象');
  const dashboards = await dbService.getDashboards(source) as Dashboard[];
  const selectedQueries = new Set(selected.filter((object) => object.kind === 'query').map((object) => object.id));
  const targetQueries = new Set(existing.filter((object) => object.kind === 'query').map((object) => object.id));
  for (const object of selected.filter((item) => item.kind === 'dashboard')) {
    const board = dashboards.find((item) => item.id === object.id);
    if (board?.items.some((item) => !selectedQueries.has(item.savedQueryId) && !targetQueries.has(item.savedQueryId))) {
      throw new Error(`仪表盘「${object.label}」的查询未选择，请一并选择关联查询`);
    }
  }

  let copied = 0;
  let rows = 0;
  // Tables first, then views and metadata. Each table copy is transactional.
  for (const object of [...selected].sort((a, b) => (a.kind === 'table' ? 0 : 1) - (b.kind === 'table' ? 0 : 1))) {
    if (object.kind === 'table') {
      await duckDBService.executeTransaction([`CREATE TABLE ${qualified(target, object.id)} AS SELECT * FROM ${qualified(source, object.id)}`]);
      const count = await duckDBService.query(`SELECT COUNT(*) AS n FROM ${qualified(target, object.id)}`);
      const actual = Number(count[0]?.n || 0);
      if (actual !== object.rowCount) {
        await duckDBService.query(`DROP TABLE ${qualified(target, object.id)}`);
        throw new Error(`表「${object.id}」复制行数不一致`);
      }
      rows += actual;
    } else if (object.kind === 'view') {
      const views = await duckDBService.query(`SELECT sql FROM duckdb_views() WHERE database_name = ${quoteLiteral(source)} AND schema_name = 'main' AND view_name = ${quoteLiteral(object.id)}`);
      const ddl = String(views[0]?.sql || '');
      if (!ddl) throw new Error(`无法读取视图「${object.id}」定义`);
      const rewritten = ddl.replace(/^CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:(?:"(?:""|[^"])+"|[A-Za-z_][\w]*)\.){0,2}(?:"(?:""|[^"])+"|[A-Za-z_][\w]*)/i, `CREATE VIEW ${qualified(target, object.id)}`);
      if (rewritten === ddl) throw new Error(`无法安全复制视图「${object.id}」定义`);
      await duckDBService.query(rebindDomainSql(rewritten, source, target));
    } else if (object.kind === 'query') {
      const item = (await dbService.getQueries(source)).find((query) => query.id === object.id) as SavedQuery | undefined;
      if (!item) throw new Error(`查询「${object.label}」已不存在`);
      await dbService.saveQuery({ ...item, sql: rebindDomainSql(item.sql, source, target),
        referencedTables: item.referencedTables?.map((name) => name.startsWith(`${source}.`) ? `${target}.${name.slice(source.length + 1)}` : name),
        databaseName: target });
    } else {
      const item = (await dbService.getDashboards(source) as Dashboard[]).find((dashboard) => dashboard.id === object.id);
      if (!item) throw new Error(`仪表盘「${object.label}」已不存在`);
      await dbService.saveDashboard({ ...item, id: targetId(object), databaseName: target });
    }
    copied += 1;
  }
  return { copied, rows };
}
