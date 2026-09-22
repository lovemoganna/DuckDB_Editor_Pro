import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectStore, createProjectSchemaName } from './projectStore';

describe('ProjectStore', () => {
  const execute = vi.fn<(sql: string) => Promise<Record<string, unknown>[]>>();

  beforeEach(() => {
    execute.mockReset();
    execute.mockResolvedValue([]);
  });

  it('derives a stable, safe schema name without collapsing distinct project names', () => {
    const first = createProjectSchemaName('Sales / 2026');
    const repeated = createProjectSchemaName('Sales / 2026');
    const distinct = createProjectSchemaName('Sales - 2026');

    expect(first).toBe(repeated);
    expect(first).toMatch(/^project_[a-z0-9_]+_[a-f0-9]{8}$/);
    expect(distinct).not.toBe(first);
  });

  it('creates a persistent project namespace and records its user-facing name', async () => {
    const store = new ProjectStore(execute);
    const schemaName = await store.ensureProject('analytics');

    expect(schemaName).toBe(createProjectSchemaName('analytics'));
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS main._sys_projects'));
    expect(execute).toHaveBeenCalledWith('BEGIN TRANSACTION');
    expect(execute).toHaveBeenCalledWith(expect.stringContaining(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`));
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining(`CREATE TABLE IF NOT EXISTS "${schemaName}"._sys_kv_store`),
    );
    const projectKvDdl = execute.mock.calls
      .map(([sql]) => sql)
      .find(sql => sql.includes(`"${schemaName}"._sys_kv_store`));
    expect(projectKvDdl).toContain('value VARCHAR');
    expect(projectKvDdl).not.toContain('value JSON');
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("VALUES ('analytics'"),
    );
    expect(execute).toHaveBeenCalledWith('COMMIT');
  });

  it('activates only a registered project schema', async () => {
    const schemaName = createProjectSchemaName('analytics');
    execute.mockImplementation(async (sql) => (
      sql.includes('SELECT schema_name')
        ? [{ schema_name: schemaName }]
        : []
    ));

    const store = new ProjectStore(execute);
    await store.activateProject('analytics');

    expect(execute).toHaveBeenCalledWith(`SET schema = '${schemaName}'`);
  });

  it('rolls back project creation when its namespace cannot be initialized', async () => {
    execute.mockImplementation(async (sql) => {
      if (sql.includes('CREATE TABLE IF NOT EXISTS "project_analytics_')) {
        throw new Error('write failed');
      }
      return [];
    });

    const store = new ProjectStore(execute);

    await expect(store.ensureProject('analytics')).rejects.toThrow('write failed');
    expect(execute).toHaveBeenCalledWith('ROLLBACK');
  });
});
