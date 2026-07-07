/**
 * hooks/useOntologyStore.crud.test.ts — Integration tests for useOntologyStore CRUD operations
 *
 * Mocks:
 * - Worker, WebSocket stubs (vitest.setup.ts)
 * - duckDBService stub (this file, via vi.hoisted + vi.mock)
 * - @duckdb/duckdb-wasm mock (vitest.setup.ts)
 *
 * Key insight: vi.mock is hoisted to the top of the file. The factory function is
 * executed at module-parse time, so it cannot reference variables declared in the
 * same file. We use vi.hoisted() for factory-scope mock functions, and reference
 * those hoisted references inside the factory.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// ─── 1. Hoisted factory-scope functions ───────────────────────────────────────
//
// These are hoisted to the top of the file by vi.hoisted(), so they are available
// when the vi.mock factory runs. We reference them as bare identifiers inside the
// factory (not as `const` variables, which are not hoisted).

const _query = vi.hoisted(() => vi.fn());
const _getMaxId = vi.hoisted(() => vi.fn());
const _deleteNodeTree = vi.hoisted(() => vi.fn());
const _deleteLink = vi.hoisted(() => vi.fn());
const _updateLinkWeight = vi.hoisted(() => vi.fn());
const _getIntrospections = vi.hoisted(() => vi.fn());
const _getInsights = vi.hoisted(() => vi.fn());
const _addIntrospection = vi.hoisted(() => vi.fn());
const _addInsight = vi.hoisted(() => vi.fn());
const _ontologyInit = vi.hoisted(() => vi.fn());
const _ontologySeed = vi.hoisted(() => vi.fn());
const _flushCatalog = vi.hoisted(() => vi.fn());
const _getTables = vi.hoisted(() => vi.fn());
const _getObjectTypes = vi.hoisted(() => vi.fn());
const _getObjects = vi.hoisted(() => vi.fn());
const _getLinkTypes = vi.hoisted(() => vi.fn());
const _getLinks = vi.hoisted(() => vi.fn());
const _getActions = vi.hoisted(() => vi.fn());

const _escapeLiteral = (v: unknown): string => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return v.toString();
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return `'${String(v).replace(/'/g, "''")}'`;
};

// ─── 2. Mock duckDBService ───────────────────────────────────────────────────────

vi.mock('../services/duckdbService', () => ({
  duckDBService: {
    query: _query,
    getMaxId: _getMaxId,
    deleteOntologyNodeTree: _deleteNodeTree,
    deleteOntologyLink: _deleteLink,
    updateOntologyLinkWeight: _updateLinkWeight,
    getOntologyIntrospections: _getIntrospections,
    getOntologyInsights: _getInsights,
    addIntrospection: _addIntrospection,
    addInsight: _addInsight,
    ontologyInit: _ontologyInit,
    ontologySeed: _ontologySeed,
    flushCatalog: _flushCatalog,
    getTables: _getTables,
    getOntologyObjectTypes: _getObjectTypes,
    getOntologyObjects: _getObjects,
    getOntologyLinkTypes: _getLinkTypes,
    getOntologyLinks: _getLinks,
    getOntologyActions: _getActions,
    escapeLiteral: _escapeLiteral,
    getOntologyInsightTable: () => 'life_insight',
    getOntologyObjectTable: () => 'life_object',
    getOntologyCanvasStateTable: () => 'life_canvas_state',
    getOntologyCanvasEdgeTable: () => 'life_canvas_edge',
  },
}));

// ─── 3. Import the mocked duckDBService for use in tests ───────────────────────

import { duckDBService } from '../services/duckdbService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TABLES = [
  'life_object_type', 'life_object', 'life_link_type', 'life_link',
  'life_action', 'life_introspection', 'life_insight',
];

const FIXTURE = {
  objectTypes: [
    { id: 1, name: 'Person', description: 'A human being' },
    { id: 2, name: 'Company', description: 'A business entity' },
  ],
  objects: [
    { id: 1, object_type_id: 1, name: 'Alice', properties: '{}', annotations: '' },
    { id: 2, object_type_id: 1, name: 'Bob', properties: '{}', annotations: '' },
  ],
  linkTypes: [{ id: 1, name: 'works_at', description: 'Employment' }],
  links: [{ id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 2, weight: 0.5 }],
  actions: [{ id: 1, object_id: 1, name: 'Send email', description: '', status: 'pending', execute_at: null }],
  introspections: [{ id: 1, object_id: 1, question: 'What is this?', answer: 'A person', created_at: '2026-01-01' }],
  insights: [{ id: 1, object_id: 1, insight: 'Key insight', tag: 'important', created_at: '2026-01-01' }],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Queue results for one loadData() call (one mount/refresh cycle).
 * Called twice: once for mount, once for refresh after CRUD.
 */
function queueLoad(data = FIXTURE) {
  _getTables.mockResolvedValueOnce(TABLES as any);
  _getObjectTypes.mockResolvedValueOnce(data.objectTypes as any);
  _getObjects.mockResolvedValueOnce(data.objects as any);
  _getLinkTypes.mockResolvedValueOnce(data.linkTypes as any);
  _getLinks.mockResolvedValueOnce(data.links as any);
  _getActions.mockResolvedValueOnce(data.actions as any);
  _getIntrospections.mockResolvedValueOnce(data.introspections as any);
  _getInsights.mockResolvedValueOnce(data.insights as any);
}

function resetAll() {
  _query.mockReset();
  _getMaxId.mockReset();
  _deleteNodeTree.mockReset();
  _deleteLink.mockReset();
  _updateLinkWeight.mockReset();
  _getIntrospections.mockReset();
  _getInsights.mockReset();
  _addIntrospection.mockReset();
  _addInsight.mockReset();
  _ontologyInit.mockReset();
  _ontologySeed.mockReset();
  _flushCatalog.mockReset();
  _getTables.mockReset();
  _getObjectTypes.mockReset();
  _getObjects.mockReset();
  _getLinkTypes.mockReset();
  _getLinks.mockReset();
  _getActions.mockReset();
}

// ─── ObjectType CRUD ──────────────────────────────────────────────────────────

describe('ObjectType CRUD', () => {
  beforeEach(() => {
    resetAll();
    queueLoad();  // mount
    queueLoad();  // refresh after CRUD
  });

  it('createObjectType calls duckDBService.query with INSERT', async () => {
    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.createObjectType('Task', 'A task');
    expect(_query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'));
  });

  it('createObjectType throws on INSERT failure', async () => {
    resetAll();
    queueLoad();
    _query.mockImplementation((sql: string) => {
      if (sql && sql.includes('INSERT INTO')) {
        return Promise.reject(new Error('DB error'));
      }
      return Promise.resolve([]);
    });

    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await expect(result.current.createObjectType('Task', 'A task')).rejects.toThrow('DB error');
  });

  it('updateObjectType fires UPDATE query', async () => {
    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.updateObjectType(1, 'Human', 'Updated');
    const calls = _query.mock.calls.filter(([s]) => typeof s === 'string' && s.includes('UPDATE'));
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][0]).toContain('Human');
  });

  it('deleteObjectType fires DELETE query', async () => {
    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.deleteObjectType(1);
    const calls = _query.mock.calls.filter(([s]) => typeof s === 'string' && s.includes('DELETE FROM'));
    expect(calls.length).toBeGreaterThan(0);
  });
});

// ─── Object CRUD ─────────────────────────────────────────────────────────────

describe('Object CRUD', () => {
  beforeEach(() => {
    resetAll();
    queueLoad();
    queueLoad();
  });

  it('createObject calls duckDBService.query with INSERT', async () => {
    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.createObject('Charlie', 1, '{}');
    expect(_query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'));
  });

  it('updateObject fires UPDATE query', async () => {
    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.updateObject(1, 'Alicia', 1, '{}');
    const calls = _query.mock.calls.filter(([s]) => typeof s === 'string' && s.includes('UPDATE'));
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][0]).toContain('Alicia');
  });

  it('deleteObject calls deleteOntologyNodeTree', async () => {
    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.deleteObject(1);
    expect(_deleteNodeTree).toHaveBeenCalled();
  });

  it('deleteObject rolls back on cascade failure', async () => {
    _deleteNodeTree.mockRejectedValue(new Error('Cascade failed'));
    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await expect(result.current.deleteObject(1)).rejects.toThrow('Cascade failed');
  });
});

// ─── LinkType CRUD ───────────────────────────────────────────────────────────

describe('LinkType CRUD', () => {
  beforeEach(() => {
    resetAll();
    queueLoad();
    queueLoad();
  });

  it('createLinkType calls duckDBService.query with INSERT', async () => {
    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.createLinkType('owns', 'Ownership');
    expect(_query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'));
  });

  it('updateLinkType fires UPDATE query', async () => {
    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.updateLinkType(1, 'employs', 'Employment');
    const calls = _query.mock.calls.filter(([s]) => typeof s === 'string' && s.includes('UPDATE'));
    expect(calls.length).toBeGreaterThan(0);
  });

  it('deleteLinkType fires DELETE query', async () => {
    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.deleteLinkType(1);
    const calls = _query.mock.calls.filter(([s]) => typeof s === 'string' && s.includes('DELETE FROM'));
    expect(calls.length).toBeGreaterThan(0);
  });
});

// ─── Link CRUD ──────────────────────────────────────────────────────────────

describe('Link CRUD', () => {
  beforeEach(() => {
    resetAll();
    queueLoad();
    queueLoad();
  });

  it('createLink fires INSERT query', async () => {
    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.createLink(1, 2, 1, 0.8);
    expect(_query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'));
  });

  it('updateLink fires UPDATE query', async () => {
    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.updateLink(1, 2, 1, 2, 0.9);
    const calls = _query.mock.calls.filter(([s]) => typeof s === 'string' && s.includes('UPDATE'));
    expect(calls.length).toBeGreaterThan(0);
  });

  it('deleteLink calls deleteOntologyLink', async () => {
    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.deleteLink(1);
    expect(_deleteLink).toHaveBeenCalled();
  });

  it('deleteLink rolls back on error', async () => {
    _deleteLink.mockRejectedValue(new Error('Link delete failed'));
    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await expect(result.current.deleteLink(1)).rejects.toThrow('Link delete failed');
  });

  it('updateLinkWeight delegates to duckDBService', async () => {
    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.updateLinkWeight(1, 0.9);
    expect(_updateLinkWeight).toHaveBeenCalled();
  });
});

// ─── Action CRUD ─────────────────────────────────────────────────────────────

describe('Action CRUD', () => {
  beforeEach(() => {
    resetAll();
    queueLoad();
    queueLoad();
  });

  it('createAction fires INSERT query', async () => {
    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.createAction('New action', 1);
    expect(_query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'));
  });

  it('updateAction fires UPDATE query with status', async () => {
    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.updateAction(1, 'Updated', 'desc', 'done');
    const calls = _query.mock.calls.filter(([s]) => typeof s === 'string' && s.includes('UPDATE'));
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.some(([s]) => s.includes('done'))).toBe(true);
  });

  it('deleteAction fires DELETE query', async () => {
    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.deleteAction(1);
    const calls = _query.mock.calls.filter(([s]) => typeof s === 'string' && s.includes('DELETE FROM'));
    expect(calls.length).toBeGreaterThan(0);
  });
});

// ─── Introspection / Insight CRUD ───────────────────────────────────────────

describe('Introspection / Insight CRUD', () => {
  beforeEach(() => {
    resetAll();
    queueLoad();
  });

  it('addIntrospection calls duckDBService.addIntrospection', async () => {
    _addIntrospection.mockResolvedValue(undefined);
    const intro2 = { id: 2, object_id: 1, question: 'New?', answer: 'Yes', created_at: '2026-01-02' };
    _getIntrospections
      .mockResolvedValueOnce(FIXTURE.introspections as any)
      .mockResolvedValueOnce([...FIXTURE.introspections, intro2] as any);

    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.addIntrospection(1, 'New?', 'Yes');
    expect(_addIntrospection).toHaveBeenCalledWith(1, 'New?', 'Yes');
  });

  it('addInsight calls duckDBService.addInsight', async () => {
    _addInsight.mockResolvedValue(undefined);
    const insight2 = { id: 2, object_id: 1, insight: 'New insight', tag: 'test', created_at: '2026-01-02' };
    _getInsights
      .mockResolvedValueOnce(FIXTURE.insights as any)
      .mockResolvedValueOnce([...FIXTURE.insights, insight2] as any);

    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.addInsight(1, 'New insight', 'test');
    expect(_addInsight).toHaveBeenCalledWith(1, 'New insight', 'test');
  });

  it('deleteInsight removes by ID', async () => {
    _query.mockResolvedValue([]);
    _getInsights
      .mockResolvedValueOnce(FIXTURE.insights as any)
      .mockResolvedValueOnce([] as any);

    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.deleteInsight(1);
    const calls = _query.mock.calls.filter(([s]) => typeof s === 'string' && s.includes('life_insight'));
    expect(calls.length).toBeGreaterThan(0);
  });
});

// ─── Data Lifecycle ───────────────────────────────────────────────────────────

describe('Data Lifecycle', () => {
  beforeEach(() => {
    resetAll();
  });

  it('initOntology calls duckDBService.ontologyInit', async () => {
    _ontologyInit.mockResolvedValue(undefined);
    _ontologySeed.mockResolvedValue(undefined);
    queueLoad(); // mount
    queueLoad(); // initOntology → loadData

    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});

    await act(async () => {
      await result.current.initOntology();
    });

    expect(_ontologyInit).toHaveBeenCalled();
  });

  it('refresh calls duckDBService.getTables', async () => {
    queueLoad();
    // Reset then re-queue for the refresh call
    _query.mockReset();
    _getTables.mockReset();
    _getObjectTypes.mockReset();
    _getObjects.mockReset();
    _getLinkTypes.mockReset();
    _getLinks.mockReset();
    _getActions.mockReset();
    _getIntrospections.mockReset();
    _getInsights.mockReset();
    queueLoad();

    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.refresh();
    expect(_getTables).toHaveBeenCalled();
  });
});

// ─── SQL Injection Safety ────────────────────────────────────────────────────

describe('SQL Injection Safety', () => {
  beforeEach(() => {
    resetAll();
    queueLoad();
    queueLoad();
  });

  it('createObjectType escapes single quotes in name', async () => {
    const maliciousName = "Robert'; DROP TABLE users;--";
    const maliciousDesc = "Description with 'quotes'";

    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.createObjectType(maliciousName, maliciousDesc);

    const call = _query.mock.calls.find(([s]) => typeof s === 'string' && s.includes('INSERT INTO'));
    expect(call).toBeDefined();
    const [sql] = call!;
    expect(sql).not.toContain("Robert'; DROP TABLE");
    expect(sql).toContain("Robert''; DROP TABLE");
  });

  it('createObject escapes single quotes in name', async () => {
    const maliciousName = "Alice'; DELETE FROM users;--";

    const { useOntologyStore } = await import('./useOntologyStore');
    const { result } = renderHook(() => useOntologyStore());
    await waitFor(() => {});
    await result.current.createObject(maliciousName, 1, '{}');

    const call = _query.mock.calls.find(([s]) => typeof s === 'string' && s.includes('INSERT INTO'));
    expect(call).toBeDefined();
    const [sql] = call!;
    expect(sql).not.toContain("Alice'; DELETE");
    expect(sql).toContain("Alice''; DELETE");
  });
});
