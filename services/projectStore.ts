export type ProjectSqlExecutor = (sql: string) => Promise<Record<string, unknown>[]>;

const PROJECT_CATALOG_TABLE = 'main._sys_projects';

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createProjectSchemaName(projectName: string): string {
  const normalized = projectName.trim().normalize('NFKD').toLowerCase();
  const slug = normalized
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'workspace';

  return `project_${slug}_${fnv1a(projectName.trim())}`;
}

function validateProjectName(projectName: string): string {
  const normalized = projectName.trim();
  if (!normalized) {
    throw new Error('Project name cannot be empty');
  }
  if (normalized.length > 120) {
    throw new Error('Project name cannot exceed 120 characters');
  }
  return normalized;
}

export class ProjectStore {
  private catalogReady = false;

  constructor(private readonly execute: ProjectSqlExecutor) {}

  async ensureCatalog(): Promise<void> {
    if (this.catalogReady) return;
    await this.execute(`
      CREATE TABLE IF NOT EXISTS ${PROJECT_CATALOG_TABLE} (
        project_name VARCHAR PRIMARY KEY,
        schema_name VARCHAR UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    this.catalogReady = true;
  }

  async listProjects(): Promise<string[]> {
    await this.ensureCatalog();
    const rows = await this.execute(`
      SELECT project_name
      FROM ${PROJECT_CATALOG_TABLE}
      ORDER BY lower(project_name), project_name
    `);
    return rows
      .map(row => String(row.project_name ?? ''))
      .filter(Boolean);
  }

  async ensureProject(projectName: string): Promise<string> {
    const normalized = validateProjectName(projectName);
    await this.ensureCatalog();

    const existing = await this.findSchema(normalized);
    if (existing) return existing;

    const schemaName = createProjectSchemaName(normalized);
    await this.execute('BEGIN TRANSACTION');
    try {
      await this.execute(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      await this.execute(`
        CREATE TABLE IF NOT EXISTS "${schemaName}"._sys_kv_store (
          key VARCHAR PRIMARY KEY,
          value VARCHAR,
          updated_at TIMESTAMP
        )
      `);
      await this.execute(`
        INSERT INTO ${PROJECT_CATALOG_TABLE} (project_name, schema_name)
        VALUES (${quoteLiteral(normalized)}, ${quoteLiteral(schemaName)})
      `);
      await this.execute('COMMIT');
      return schemaName;
    } catch (error) {
      try {
        await this.execute('ROLLBACK');
      } catch {
        // Preserve the original creation error.
      }
      throw error;
    }
  }

  async activateProject(projectName: string): Promise<string> {
    const normalized = validateProjectName(projectName);
    await this.ensureCatalog();
    const schemaName = await this.findSchema(normalized);
    if (!schemaName) {
      throw new Error(`Project "${normalized}" does not exist`);
    }
    await this.execute(`SET schema = ${quoteLiteral(schemaName)}`);
    return schemaName;
  }

  async activateMain(): Promise<void> {
    await this.execute(`SET schema = 'main'`);
  }

  async deleteProject(projectName: string): Promise<boolean> {
    const normalized = validateProjectName(projectName);
    await this.ensureCatalog();
    const schemaName = await this.findSchema(normalized);
    if (!schemaName) return false;

    await this.execute('BEGIN TRANSACTION');
    try {
      await this.execute(`SET schema = 'main'`);
      await this.execute(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await this.execute(`
        DELETE FROM ${PROJECT_CATALOG_TABLE}
        WHERE project_name = ${quoteLiteral(normalized)}
      `);
      await this.execute('COMMIT');
      return true;
    } catch (error) {
      try {
        await this.execute('ROLLBACK');
      } catch {
        // Preserve the original deletion error.
      }
      throw error;
    }
  }

  async deleteAllProjects(): Promise<number> {
    const projects = await this.listProjects();
    for (const projectName of projects) {
      await this.deleteProject(projectName);
    }
    return projects.length;
  }

  private async findSchema(projectName: string): Promise<string | null> {
    const rows = await this.execute(`
      SELECT schema_name
      FROM ${PROJECT_CATALOG_TABLE}
      WHERE project_name = ${quoteLiteral(projectName)}
      LIMIT 1
    `);
    const schemaName = rows[0]?.schema_name;
    return typeof schemaName === 'string' && schemaName ? schemaName : null;
  }
}
