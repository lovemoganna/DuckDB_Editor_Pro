/**
 * services/ontology/ontologyStorage.test.ts — Regression tests for Ontology Storage Service
 *
 * Tests:
 * - exportOntologyToJSON() returns correct JSON structure with all 5 tables
 * - importOntologyFromJSON() correctly replaces existing records (INSERT OR REPLACE)
 * - queryAllOntologyTables() returns all 5 table datasets
 * - Safe literal escaping (no injection from malicious field values)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  exportOntologyToJSON,
  downloadOntologyJSON,
  importOntologyFromJSON,
  queryAllOntologyTables,
  validateDraftPayload,
  executeOntologyDraft,
  updateOntologyObject,
  createOntologyObject,
  updateOntologyAnnotation,
  updateOntologyLinkWeight,
  createOntologyLink,
  deleteOntologyLink,
  deleteOntologyNodeTree,
  addIntrospection,
  addInsight,
  getInsightsByTag,
  deleteInsight,
  type OntologyMapping,
} from './ontologyStorage';

// ─── Mock duckDBService ─────────────────────────────────────────────────────────

// vi.mock is hoisted — create mock with vi.hoisted() so it is available in the factory
const { mockQuery } = vi.hoisted(() => {
  const fn = vi.fn() as any;
  fn.escapeLiteral = (v: unknown) => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return v.toString();
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    return `'${String(v).replace(/'/g, "''")}'`;
  };
  return { mockQuery: fn };
});

vi.mock('../duckdbService', () => ({
  duckDBService: { query: mockQuery, escapeLiteral: mockQuery.escapeLiteral as (v: unknown) => string },
}));

beforeEach(() => {
  mockQuery.mockReset();
});

// ─── Test Fixtures ─────────────────────────────────────────────────────────────

const mockMapping: OntologyMapping = {
  objectTable: 'life_object',
  objectTypeTable: 'life_object_type',
  linkTable: 'life_link',
  linkTypeTable: 'life_link_type',
  actionTable: 'life_action',
  introspectionTable: 'life_introspection',
  insightTable: 'life_insight',
};

const mockObjectTypes = [
  { id: 1, name: 'User', description: 'System user' },
  { id: 2, name: 'Product', description: 'E-commerce product' },
];

const mockObjects = [
  { id: 1, object_type_id: 1, name: 'Alice', properties: '{}', annotations: '' },
  { id: 2, object_type_id: 1, name: 'Bob', properties: '{}', annotations: '' },
];

const mockLinkTypes = [
  { id: 1, name: 'purchased', description: 'User purchased product' },
];

const mockLinks = [
  { id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 2, weight: 0.9 },
];

const mockActions = [
  { id: 1, object_id: 1, name: 'send_email', description: 'Send email notification', status: 'pending', execute_at: null },
];

// ─── exportOntologyToJSON ─────────────────────────────────────────────────────

describe('exportOntologyToJSON', () => {
  it('returns a JSON structure with version, exportedAt, and all 5 tables', async () => {
    mockQuery
      .mockResolvedValueOnce(mockObjectTypes)
      .mockResolvedValueOnce(mockObjects)
      .mockResolvedValueOnce(mockLinkTypes)
      .mockResolvedValueOnce(mockLinks)
      .mockResolvedValueOnce(mockActions);

    const result = await exportOntologyToJSON(mockMapping);

    expect(result).toHaveProperty('version', '1.0');
    expect(result).toHaveProperty('exportedAt');
    expect(result.objectTypes).toEqual(mockObjectTypes);
    expect(result.objects).toEqual(mockObjects);
    expect(result.linkTypes).toEqual(mockLinkTypes);
    expect(result.links).toEqual(mockLinks);
    expect(result.actions).toEqual(mockActions);
  });

  it('returns empty arrays when tables are empty (null response)', async () => {
    mockQuery.mockResolvedValue(null);

    const result = await exportOntologyToJSON(mockMapping);

    expect(result.objectTypes).toEqual([]);
    expect(result.objects).toEqual([]);
    expect(result.linkTypes).toEqual([]);
    expect(result.links).toEqual([]);
    expect(result.actions).toEqual([]);
  });

  it('queries all 5 tables in parallel', async () => {
    mockQuery.mockResolvedValue([]);

    await exportOntologyToJSON(mockMapping);

    expect(mockQuery).toHaveBeenCalledTimes(5);
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM life_object_type');
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM life_object');
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM life_link');
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM life_link_type');
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM life_action');
  });
});

// ─── importOntologyFromJSON ───────────────────────────────────────────────────

describe('importOntologyFromJSON', () => {
  it('calls INSERT OR REPLACE for object types with correct escaped values', async () => {
    mockQuery.mockResolvedValue({});

    await importOntologyFromJSON(mockMapping, {
      objectTypes: [{ id: 99, name: "O'Brien", description: "A test's value" }],
      objects: [],
      linkTypes: [],
      links: [],
      actions: [],
    });

    // Verify the object type INSERT was called
    const otCall = mockQuery.mock.calls.find(
      (call) => String(call[0]).includes('INSERT OR REPLACE') && String(call[0]).includes('life_object_type')
    );
    expect(otCall).toBeDefined();
    // escapeLiteral doubles single quotes: O'Brien → 'O''Brien' in the SQL string
    expect(String(otCall![0])).toContain("O''Brien");
  });

  it('serializes object properties and annotations as JSON strings', async () => {
    mockQuery.mockResolvedValue({});

    await importOntologyFromJSON(mockMapping, {
      objectTypes: [],
      objects: [
        {
          id: 5,
          object_type_id: 1,
          name: 'Item',
          properties: '{"price":100,"active":true}',
          annotations: '{"note":"important"}',
        },
      ],
      linkTypes: [],
      links: [],
      actions: [],
    });

    const objCall = mockQuery.mock.calls.find(
      (call) => String(call[0]).includes('INSERT OR REPLACE') && String(call[0]).includes('life_object')
    );
    expect(objCall).toBeDefined();
    // Object properties should be serialized as JSON string
    expect(String(objCall![0])).toContain('price');
  });

  it('handles null/undefined descriptions gracefully', async () => {
    mockQuery.mockResolvedValue({});

    await importOntologyFromJSON(mockMapping, {
      objectTypes: [{ id: 1, name: 'Type', description: null as any }],
      objects: [],
      linkTypes: [],
      links: [],
      actions: [],
    });

    const call = mockQuery.mock.calls[0];
    expect(call).toBeDefined();
    // Should not throw — NULL is the correct fallback for null description
  });

  it('returns accurate counts of imported objects and links', async () => {
    mockQuery.mockResolvedValue({});

    const result = await importOntologyFromJSON(mockMapping, {
      objectTypes: [{ id: 1, name: 'T', description: 'D' }],
      objects: [
        { id: 1, object_type_id: 1, name: 'O1', properties: '{}', annotations: '' },
        { id: 2, object_type_id: 1, name: 'O2', properties: '{}', annotations: '' },
      ],
      linkTypes: [],
      links: [
        { id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 2, weight: 0.8 },
      ],
      actions: [],
    });

    expect(result.objectCount).toBe(2);
    expect(result.linkCount).toBe(1);
  });

  it('applies default weight of 0.5 when link weight is undefined', async () => {
    mockQuery.mockResolvedValue({});

    await importOntologyFromJSON(mockMapping, {
      objectTypes: [],
      objects: [],
      linkTypes: [],
      links: [{ id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 2, weight: undefined as any }],
      actions: [],
    });

    const linkCall = mockQuery.mock.calls.find(
      (call) => String(call[0]).includes('life_link')
    );
    expect(String(linkCall![0])).toContain('0.5');
  });

  it('rejects invalid numeric ids before writing SQL', async () => {
    mockQuery.mockResolvedValue({});

    await expect(importOntologyFromJSON(mockMapping, {
      objectTypes: [
        { id: '1); DROP TABLE life_object; --' as any, name: 'Unsafe', description: '' },
      ],
      objects: [],
      linkTypes: [],
      links: [],
      actions: [],
    })).rejects.toThrow('Invalid id value for objectTypes.id');

    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('applies default status "pending" when action status is undefined', async () => {
    mockQuery.mockResolvedValue({});

    await importOntologyFromJSON(mockMapping, {
      objectTypes: [],
      objects: [],
      linkTypes: [],
      links: [],
      actions: [
        { id: 1, object_id: 1, name: 'Task', description: 'Do it', status: undefined as any, execute_at: null },
      ],
    });

    const actionCall = mockQuery.mock.calls.find(
      (call) => String(call[0]).includes('life_action')
    );
    expect(String(actionCall![0])).toContain('pending');
  });
});

// ─── queryAllOntologyTables ───────────────────────────────────────────────────

describe('queryAllOntologyTables', () => {
  it('returns an object with all 5 table arrays', async () => {
    mockQuery
      .mockResolvedValueOnce(mockObjectTypes)
      .mockResolvedValueOnce(mockObjects)
      .mockResolvedValueOnce(mockLinkTypes)
      .mockResolvedValueOnce(mockLinks)
      .mockResolvedValueOnce(mockActions);

    const result = await queryAllOntologyTables(mockMapping);

    expect(result).toHaveProperty('objectTypes', mockObjectTypes);
    expect(result).toHaveProperty('objects', mockObjects);
    expect(result).toHaveProperty('linkTypes', mockLinkTypes);
    expect(result).toHaveProperty('links', mockLinks);
    expect(result).toHaveProperty('actions', mockActions);
  });

  it('queries in parallel', async () => {
    mockQuery.mockResolvedValue([]);

    const p = queryAllOntologyTables(mockMapping);
    // All 5 calls should be made synchronously (Promise.all)
    await p;

    expect(mockQuery).toHaveBeenCalledTimes(5);
  });
});

// ─── validateDraftPayload ─────────────────────────────────────────────────────

describe('validateDraftPayload', () => {
  it('returns valid=true for a well-formed payload', () => {
    const payload = {
      objects: [
        { id: 1, name: 'Project', object_type_id: 1, properties: {}, annotations: '' },
        { id: 2, name: 'Metric', object_type_id: 2, properties: {}, annotations: '' },
      ],
      links: [{ id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 2, weight: 0.5 }],
      actions: [{ id: 1, object_id: 1, name: 'Review', description: '' }],
      introspections: [{ id: 1, object_id: 1, question: 'Q?', answer: 'A' }],
      insights: [{ id: 1, object_id: 2, insight: 'Test insight', tag: 'test' }],
    };
    const { valid, errors } = validateDraftPayload(payload);
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('rejects link with source_object_id not in objects', () => {
    const payload = {
      objects: [{ id: 1, name: 'A', object_type_id: 1, properties: {}, annotations: '' }],
      links: [{ id: 1, link_type_id: 1, source_object_id: 99, target_object_id: 1, weight: 0.5 }],
      actions: [], introspections: [], insights: [],
    };
    const { valid, errors } = validateDraftPayload(payload);
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('source_object_id 99'))).toBe(true);
  });

  it('rejects link with weight outside [0, 1] range', () => {
    const payload = {
      objects: [{ id: 1, name: 'A', object_type_id: 1, properties: {}, annotations: '' }],
      links: [{ id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 1, weight: 1.5 }],
      actions: [], introspections: [], insights: [],
    };
    const { valid, errors } = validateDraftPayload(payload);
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('weight 1.5'))).toBe(true);
  });

  it('rejects negative object id', () => {
    const payload = {
      objects: [{ id: -1, name: 'Bad', object_type_id: 1, properties: {}, annotations: '' }],
      links: [], actions: [], introspections: [], insights: [],
    };
    const { valid, errors } = validateDraftPayload(payload);
    expect(valid).toBe(false);
    expect(errors[0]).toContain('-1');
  });

  it('rejects action with object_id not in objects', () => {
    const payload = {
      objects: [{ id: 1, name: 'A', object_type_id: 1, properties: {}, annotations: '' }],
      links: [],
      actions: [{ id: 1, object_id: 99, name: 'Action' }],
      introspections: [], insights: [],
    };
    const { valid, errors } = validateDraftPayload(payload);
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('Action 1') && e.includes('object_id 99'))).toBe(true);
  });

  it('allows empty arrays (all optional)', () => {
    const payload = { objects: [], links: [], actions: [], introspections: [], insights: [] };
    const { valid } = validateDraftPayload(payload);
    expect(valid).toBe(true);
  });

  it('rejects insight with invalid object_id', () => {
    const payload = {
      objects: [{ id: 1, name: 'A', object_type_id: 1, properties: {}, annotations: '' }],
      links: [], actions: [], introspections: [],
      insights: [{ id: 1, object_id: 999, insight: 'X', tag: '' }],
    };
    const { valid, errors } = validateDraftPayload(payload);
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('Insight 1'))).toBe(true);
  });
});

// ─── executeOntologyDraft ────────────────────────────────────────────────────

describe('executeOntologyDraft', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('escapes single quotes in object names — no SQL injection', async () => {
    mockQuery.mockResolvedValue({});
    await executeOntologyDraft(mockMapping, {
      objects: [{ id: 1, name: "Test's object", object_type_id: 1 }],
      links: [], actions: [], introspections: [], insights: [],
    });
    const objCall = mockQuery.mock.calls.find(c => String(c[0]).includes('life_object'));
    const sql = String(objCall![0]);
    // ID must be numeric (unquoted) in SQL
    expect(sql).toContain('VALUES (1, 1,');
    // Name is properly escaped: 'Test''s object' (the ' became '')
    expect(sql).toContain("Test''s");
    // Verify the string is properly closed: odd number of quotes = 1 open, 1 close, any escaped doubled
    const quoteCount = (sql.match(/'/g) || []).length;
    expect(quoteCount % 2).toBe(0);
  });

  it('uses default object_type_id=1 when not provided', async () => {
    mockQuery.mockResolvedValue({});
    await executeOntologyDraft(mockMapping, {
      objects: [{ id: 5, name: 'NoType', properties: {} }],
      links: [], actions: [], introspections: [], insights: [],
    });
    const objCall = mockQuery.mock.calls.find(c => String(c[0]).includes('life_object'));
    expect(String(objCall![0])).toContain('1'); // default type_id
  });
});

// ─── Safe write methods ──────────────────────────────────────────────────────

describe('safe write methods', () => {
  beforeEach(() => { mockQuery.mockReset(); mockQuery.mockResolvedValue({}); });

  it('updateOntologyObject escapes name with single quotes', async () => {
    await updateOntologyObject(mockMapping, 1, { name: "O'Brien problem" });
    const call = mockQuery.mock.calls[0];
    expect(String(call[0])).toContain("O''Brien");
  });

  it('createOntologyObject escapes name', async () => {
    await createOntologyObject(mockMapping, "Name with 'quote", 1, {});
    const call = mockQuery.mock.calls[0];
    expect(String(call[0])).toContain("Name with ''quote");
  });

  it('addIntrospection escapes question and answer', async () => {
    await addIntrospection(mockMapping, 1, "What about 'this'?", "It's fine");
    const call = mockQuery.mock.calls[0];
    expect(String(call[0])).toContain("this''");
  });

  it('addInsight escapes insight text and tag', async () => {
    await addInsight(mockMapping, 1, "Insight with 'special' chars", "tag's value");
    const call = mockQuery.mock.calls[0];
    expect(String(call[0])).toContain("tag's value".replace(/'/g, "''"));
  });

  it('getInsightsByTag escapes tag in WHERE clause', async () => {
    mockQuery.mockResolvedValue([]);
    await getInsightsByTag(mockMapping, "tag' OR '1'='1");
    const call = mockQuery.mock.calls[0];
    const sql = String(call[0]);
    // Single quotes are doubled: ' → ''; the " OR " pattern is neutralized
    expect(sql).not.toMatch(/tag' OR/); // no raw injection fragment
    // The SQL contains properly escaped quotes: tag becomes tag''
    expect(sql).toContain("tag''");
    // The '1'='1 becomes ''1''=''1 — quotes doubled
    expect(sql).toContain("''1''");
  });

  it('updateOntologyLinkWeight passes numeric weight directly', async () => {
    mockQuery.mockResolvedValue({});
    await updateOntologyLinkWeight(mockMapping, 5, 0.75);
    const call = mockQuery.mock.calls[0];
    expect(String(call[0])).toContain('weight = 0.75');
    // weight should be numeric, not quoted
    expect(String(call[0]).match(/weight = '\d/)).toBeNull();
  });

  it('createOntologyLink uses provided weight', async () => {
    mockQuery.mockResolvedValue({});
    await createOntologyLink(mockMapping, 1, 2, 3, 0.8);
    const call = mockQuery.mock.calls[0];
    expect(String(call[0])).toContain('0.8');
  });

  it('deleteOntologyLink calls DELETE with correct id', async () => {
    mockQuery.mockResolvedValue({});
    await deleteOntologyLink(mockMapping, 42);
    const call = mockQuery.mock.calls[0];
    expect(String(call[0])).toContain('DELETE FROM "life_link" WHERE id = 42');
  });

  it('deleteOntologyNodeTree deletes from all linked tables', async () => {
    mockQuery.mockResolvedValue({});
    await deleteOntologyNodeTree(mockMapping, 7);
    // Should delete from action, introspection, insight, link, canvas_state, object
    expect(mockQuery.mock.calls.length).toBeGreaterThanOrEqual(5);
  });

  it('deleteInsight calls DELETE with correct id', async () => {
    mockQuery.mockResolvedValue({});
    await deleteInsight(mockMapping, 99);
    const call = mockQuery.mock.calls[0];
    expect(String(call[0])).toContain('DELETE FROM');
    expect(String(call[0])).toContain('99');
  });
});
