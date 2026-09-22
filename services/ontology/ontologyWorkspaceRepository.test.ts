import { describe, expect, it, vi } from 'vitest';
import type { MappingItem, OntologyEdge, OntologyNode } from '../../types/ontologyWorkspace';
import { OntologyWorkspaceRepository } from './ontologyWorkspaceRepository';

const seed = {
  revisionId: 'rev-seed',
  version: 'v0.9',
  author: 'system',
  message: 'Seed',
  nodes: [{ id: 'A', name: 'A', label: 'A', iri: 'ex:A', description: '', abstractionLevel: 'L1', domain: 'Commerce', type: 'class', status: 'normal' }] as OntologyNode[],
  edges: [] as OntologyEdge[],
  mappings: [] as MappingItem[],
};

describe('OntologyWorkspaceRepository', () => {
  it('initializes storage and persists the seed when no revision exists', async () => {
    const query = vi.fn(async (sql: string) => sql.includes('SELECT revision_id') ? [] : []);
    const repository = new OntologyWorkspaceRepository({ query });
    const snapshot = await repository.loadLatestOrSeed(seed);

    expect(snapshot.revisionId).toBe('rev-seed');
    expect(query.mock.calls.some(([sql]) => sql.includes('CREATE TABLE IF NOT EXISTS _sys_ontology_workspace_revision'))).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO _sys_ontology_workspace_revision'))).toBe(true);
  });

  it('hydrates the current snapshot from persisted JSON', async () => {
    const query = vi.fn(async (sql: string) => {
      if (!sql.includes('SELECT revision_id')) return [];
      return [{
        revision_id: 'rev-live', version: 'v1.2', author: 'luoyu', message: 'Live', created_at: '2026-08-31 11:30:00',
        nodes_json: JSON.stringify(seed.nodes), edges_json: '[]', mappings_json: '[]',
      }];
    });
    const repository = new OntologyWorkspaceRepository({ query });
    const snapshot = await repository.loadLatestOrSeed(seed);
    expect(snapshot.revisionId).toBe('rev-live');
    expect(snapshot.nodes[0].name).toBe('A');
  });

  it('publishes a new revision transactionally and clears only the active draft', async () => {
    const calls: string[] = [];
    const repository = new OntologyWorkspaceRepository({ query: async (sql: string) => { calls.push(sql); return []; } });
    await repository.publish({ ...seed, revisionId: 'rev-next', version: 'v1.0', message: 'Publish draft' }, 'active');

    expect(calls).toContain('BEGIN TRANSACTION');
    expect(calls.some((sql) => sql.includes("DELETE FROM _sys_ontology_workspace_draft WHERE draft_id = 'active'"))).toBe(true);
    expect(calls).toContain('COMMIT');
  });
});
