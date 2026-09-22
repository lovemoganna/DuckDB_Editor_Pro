import type {
  DraftChange,
  MappingItem,
  OntologyEdge,
  OntologyNode,
  ReasoningReport,
  StatePipeline,
  ValidationIssue,
} from '../../types/ontologyWorkspace';
import { duckDBService } from '../duckdbService';

export interface OntologyWorkspaceSnapshot {
  revisionId: string;
  version: string;
  author: string;
  message: string;
  createdAt?: string;
  nodes: OntologyNode[];
  edges: OntologyEdge[];
  mappings: MappingItem[];
}

export interface OntologyWorkspaceDraft {
  draftId: string;
  baseRevisionId: string;
  author: string;
  changes: DraftChange[];
  statePipeline: StatePipeline;
}

export type OntologyRunPayload = ValidationIssue[] | ReasoningReport | Record<string, unknown>;

export interface QueryExecutor {
  query(sql: string): Promise<any[]>;
}

const sqlString = (value: string): string => `'${value.replace(/'/g, "''")}'`;
const jsonString = (value: unknown): string => sqlString(JSON.stringify(value));

const safeParse = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export class OntologyWorkspaceRepository {
  constructor(private readonly executor: QueryExecutor = duckDBService) {}

  async initialize(): Promise<void> {
    await this.executor.query(`
      CREATE TABLE IF NOT EXISTS _sys_ontology_workspace_revision (
        revision_id VARCHAR PRIMARY KEY,
        version VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        author VARCHAR NOT NULL,
        message VARCHAR,
        nodes_json VARCHAR NOT NULL,
        edges_json VARCHAR NOT NULL,
        mappings_json VARCHAR NOT NULL
      );
      CREATE TABLE IF NOT EXISTS _sys_ontology_workspace_draft (
        draft_id VARCHAR PRIMARY KEY,
        base_revision_id VARCHAR NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        author VARCHAR NOT NULL,
        changes_json VARCHAR NOT NULL,
        state_pipeline_json VARCHAR NOT NULL
      );
      CREATE TABLE IF NOT EXISTS _sys_ontology_workspace_run (
        run_id VARCHAR PRIMARY KEY,
        run_type VARCHAR NOT NULL,
        revision_id VARCHAR NOT NULL,
        status VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        payload_json VARCHAR NOT NULL
      )
    `);
  }

  private async insertRevision(snapshot: OntologyWorkspaceSnapshot): Promise<void> {
    await this.executor.query(`
      INSERT INTO _sys_ontology_workspace_revision (
        revision_id, version, author, message, nodes_json, edges_json, mappings_json
      ) VALUES (
        ${sqlString(snapshot.revisionId)},
        ${sqlString(snapshot.version)},
        ${sqlString(snapshot.author)},
        ${sqlString(snapshot.message)},
        ${jsonString(snapshot.nodes)},
        ${jsonString(snapshot.edges)},
        ${jsonString(snapshot.mappings)}
      ) ON CONFLICT (revision_id) DO NOTHING
    `);
  }

  async loadLatestOrSeed(seed: OntologyWorkspaceSnapshot): Promise<OntologyWorkspaceSnapshot> {
    await this.initialize();
    const rows = await this.executor.query(`
      SELECT revision_id, version, created_at, author, message, nodes_json, edges_json, mappings_json
      FROM _sys_ontology_workspace_revision
      ORDER BY created_at DESC, revision_id DESC
      LIMIT 1
    `);
    if (rows.length === 0) {
      await this.insertRevision(seed);
      return seed;
    }
    const row = rows[0];
    return {
      revisionId: String(row.revision_id),
      version: String(row.version),
      createdAt: row.created_at ? String(row.created_at) : undefined,
      author: String(row.author || 'unknown'),
      message: String(row.message || ''),
      nodes: safeParse<OntologyNode[]>(row.nodes_json, seed.nodes),
      edges: safeParse<OntologyEdge[]>(row.edges_json, seed.edges),
      mappings: safeParse<MappingItem[]>(row.mappings_json, seed.mappings),
    };
  }

  async listRevisions(): Promise<Array<Pick<OntologyWorkspaceSnapshot, 'revisionId' | 'version' | 'createdAt' | 'author' | 'message'>>> {
    await this.initialize();
    const rows = await this.executor.query(`
      SELECT revision_id, version, created_at, author, message
      FROM _sys_ontology_workspace_revision
      ORDER BY created_at DESC, revision_id DESC
    `);
    return rows.map((row) => ({
      revisionId: String(row.revision_id),
      version: String(row.version),
      createdAt: row.created_at ? String(row.created_at) : undefined,
      author: String(row.author || 'unknown'),
      message: String(row.message || ''),
    }));
  }

  async loadDraft(draftId = 'active'): Promise<OntologyWorkspaceDraft | null> {
    await this.initialize();
    const rows = await this.executor.query(`
      SELECT draft_id, base_revision_id, author, changes_json, state_pipeline_json
      FROM _sys_ontology_workspace_draft
      WHERE draft_id = ${sqlString(draftId)}
      LIMIT 1
    `);
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      draftId: String(row.draft_id),
      baseRevisionId: String(row.base_revision_id),
      author: String(row.author || 'unknown'),
      changes: safeParse<DraftChange[]>(row.changes_json, []),
      statePipeline: safeParse<StatePipeline>(row.state_pipeline_json, {
        modelStatus: 'clean', mappingStatus: 'up_to_date', validationStatus: 'not_run',
        validationWarningCount: 0, validationErrorCount: 0, reasoningStatus: 'not_run', draftCount: 0,
      }),
    };
  }

  async saveDraft(draft: OntologyWorkspaceDraft): Promise<void> {
    await this.initialize();
    await this.executor.query(`
      INSERT INTO _sys_ontology_workspace_draft (
        draft_id, base_revision_id, updated_at, author, changes_json, state_pipeline_json
      ) VALUES (
        ${sqlString(draft.draftId)}, ${sqlString(draft.baseRevisionId)}, now(),
        ${sqlString(draft.author)}, ${jsonString(draft.changes)}, ${jsonString(draft.statePipeline)}
      )
      ON CONFLICT (draft_id) DO UPDATE SET
        base_revision_id = EXCLUDED.base_revision_id,
        updated_at = now(),
        author = EXCLUDED.author,
        changes_json = EXCLUDED.changes_json,
        state_pipeline_json = EXCLUDED.state_pipeline_json
    `);
  }

  async recordRun(runType: 'validation' | 'reasoning' | 'mapping', revisionId: string, status: string, payload: OntologyRunPayload): Promise<string> {
    await this.initialize();
    const runId = `${runType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await this.executor.query(`
      INSERT INTO _sys_ontology_workspace_run (run_id, run_type, revision_id, status, payload_json)
      VALUES (${sqlString(runId)}, ${sqlString(runType)}, ${sqlString(revisionId)}, ${sqlString(status)}, ${jsonString(payload)})
    `);
    return runId;
  }

  async publish(snapshot: OntologyWorkspaceSnapshot, draftId = 'active'): Promise<void> {
    await this.initialize();
    await this.executor.query('BEGIN TRANSACTION');
    try {
      await this.insertRevision(snapshot);
      await this.executor.query(`DELETE FROM _sys_ontology_workspace_draft WHERE draft_id = ${sqlString(draftId)}`);
      await this.executor.query('COMMIT');
    } catch (error) {
      try {
        await this.executor.query('ROLLBACK');
      } catch {
        // Preserve the original transaction error.
      }
      throw error;
    }
  }
}

export const ontologyWorkspaceRepository = new OntologyWorkspaceRepository();
