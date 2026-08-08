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
import { RISK_INFERENCE_WORKSPACE } from './ontologyInferenceRiskTemplate';

// ─── Mock duckDBService ─────────────────────────────────────────────────────────

// vi.mock is hoisted — create mock with vi.hoisted() so it is available in the factory
const { mockQuery, mockExecuteTransaction, mockOntologyInit } = vi.hoisted(() => {
  const fn = vi.fn() as any;
  fn.escapeLiteral = (v: unknown) => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return v.toString();
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    return `'${String(v).replace(/'/g, "''")}'`;
  };
  return {
    mockQuery: fn,
    mockExecuteTransaction: vi.fn(),
    mockOntologyInit: vi.fn(),
  };
});

const inferenceMocks = vi.hoisted(() => ({
  loadWorkspace: vi.fn(),
  validateWorkspace: vi.fn(),
  saveWorkspace: vi.fn(),
}));

const reasoningMocks = vi.hoisted(() => ({
  loadCatalog: vi.fn(),
  saveCatalog: vi.fn(),
  createSnapshot: vi.fn(),
  validateModel: vi.fn(),
}));

vi.mock('../duckdbService', () => ({
  duckDBService: {
    query: mockQuery,
    executeTransaction: mockExecuteTransaction,
    ontologyInit: mockOntologyInit,
    escapeLiteral: mockQuery.escapeLiteral as (v: unknown) => string,
  },
}));

vi.mock('./ontologyInferenceModule', () => ({
  ontologyInferenceModule: inferenceMocks,
}));

vi.mock('./ontologyReasoningModule', () => ({
  ontologyReasoningModule: reasoningMocks,
}));

beforeEach(() => {
  mockQuery.mockReset();
  mockExecuteTransaction.mockReset();
  mockOntologyInit.mockReset();
  mockOntologyInit.mockResolvedValue(undefined);
  inferenceMocks.loadWorkspace.mockReset();
  inferenceMocks.validateWorkspace.mockReset();
  inferenceMocks.saveWorkspace.mockReset();
  inferenceMocks.loadWorkspace.mockResolvedValue({
    features: [],
    rules: [],
    outcomes: [],
  });
  inferenceMocks.saveWorkspace.mockResolvedValue(undefined);
  inferenceMocks.validateWorkspace.mockResolvedValue(undefined);
  reasoningMocks.loadCatalog.mockReset();
  reasoningMocks.saveCatalog.mockReset();
  reasoningMocks.createSnapshot.mockReset();
  reasoningMocks.validateModel.mockReset();
  reasoningMocks.loadCatalog.mockResolvedValue({
    propertyDefinitions: [],
    rules: [],
    actionDefinitions: [],
  });
  reasoningMocks.saveCatalog.mockResolvedValue(undefined);
  reasoningMocks.createSnapshot.mockReturnValue({ snapshotId: 'import-snapshot' });
  reasoningMocks.validateModel.mockReturnValue([]);
  mockExecuteTransaction.mockImplementation(async (statements: string[]) => {
    for (const statement of statements) {
      await mockQuery(statement);
    }
    return [];
  });
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

const mockIntrospections = [
  { id: 1, object_id: 1, question: 'Why?', answer: 'Because.', created_at: '2026-07-28' },
];

const mockInsights = [
  { id: 1, object_id: 1, insight: 'Keep the boundary deep.', tag: 'architecture', created_at: '2026-07-28' },
];

// ─── exportOntologyToJSON ─────────────────────────────────────────────────────

describe('exportOntologyToJSON', () => {
  it('returns a v3 round-trip JSON structure with native reasoning and legacy inference definitions', async () => {
    mockQuery
      .mockResolvedValueOnce(mockObjectTypes)
      .mockResolvedValueOnce(mockObjects)
      .mockResolvedValueOnce(mockLinkTypes)
      .mockResolvedValueOnce(mockLinks)
      .mockResolvedValueOnce(mockActions)
      .mockResolvedValueOnce(mockIntrospections)
      .mockResolvedValueOnce(mockInsights);
    inferenceMocks.loadWorkspace.mockResolvedValue(RISK_INFERENCE_WORKSPACE);
    const nativeCatalog = {
      propertyDefinitions: [{
        id: 'property.user.status', logicalId: 'property.user.status', version: 1,
        objectTypeId: 1, key: 'status', name: '状态', valueType: 'string', nullable: false,
        status: 'active',
      }],
      rules: [],
      actionDefinitions: [],
    };
    reasoningMocks.loadCatalog.mockResolvedValue(nativeCatalog);

    const result = await exportOntologyToJSON(mockMapping);

    expect(result).toHaveProperty('version', '3.0');
    expect(result).toHaveProperty('exportedAt');
    expect(result.objectTypes).toEqual(mockObjectTypes);
    expect(result.objects).toEqual(mockObjects);
    expect(result.linkTypes).toEqual(mockLinkTypes);
    expect(result.links).toEqual(mockLinks);
    expect(result.actions).toEqual(mockActions);
    expect(result.introspections).toEqual(mockIntrospections);
    expect(result.insights).toEqual(mockInsights);
    expect(result.features).toEqual(RISK_INFERENCE_WORKSPACE.features);
    expect(result.rules).toEqual(RISK_INFERENCE_WORKSPACE.rules);
    expect(result.outcomes).toEqual(RISK_INFERENCE_WORKSPACE.outcomes);
    expect(result.propertyDefinitions).toEqual(nativeCatalog.propertyDefinitions);
    expect(result.ruleDefinitions).toEqual([]);
    expect(result.actionDefinitions).toEqual([]);
  });

  it('returns empty arrays when tables are empty (null response)', async () => {
    mockQuery.mockResolvedValue(null);

    const result = await exportOntologyToJSON(mockMapping);

    expect(result.objectTypes).toEqual([]);
    expect(result.objects).toEqual([]);
    expect(result.linkTypes).toEqual([]);
    expect(result.links).toEqual([]);
    expect(result.actions).toEqual([]);
    expect(result.features).toEqual([]);
    expect(result.rules).toEqual([]);
    expect(result.outcomes).toEqual([]);
    expect(result.propertyDefinitions).toEqual([]);
    expect(result.ruleDefinitions).toEqual([]);
    expect(result.actionDefinitions).toEqual([]);
  });

  it('queries all 7 tables in parallel', async () => {
    mockQuery.mockResolvedValue([]);

    await exportOntologyToJSON(mockMapping);

    expect(mockQuery).toHaveBeenCalledTimes(7);
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM life_object_type');
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM life_object');
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM life_link');
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM life_link_type');
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM life_action');
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM life_introspection');
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM life_insight');
  });
});

// ─── importOntologyFromJSON ───────────────────────────────────────────────────

describe('importOntologyFromJSON', () => {
  it('imports v3 native property, rule and action definitions without parsing descriptions', async () => {
    const nativeCatalog = {
      propertyDefinitions: [{
        id: 'property.user.status', logicalId: 'property.user.status', version: 1,
        objectTypeId: 1, key: 'status', name: '状态', valueType: 'string' as const,
        nullable: false, status: 'active' as const,
      }],
      ruleDefinitions: [],
      actionDefinitions: [],
    };

    await importOntologyFromJSON(mockMapping, {
      version: '3.0', objectTypes: [], objects: [], linkTypes: [], links: [], actions: [],
      ...nativeCatalog,
    });

    expect(reasoningMocks.saveCatalog).toHaveBeenCalledWith({
      propertyDefinitions: nativeCatalog.propertyDefinitions,
      rules: [],
      actionDefinitions: [],
    });
  });
  it('validates native definitions before mutating ontology tables', async () => {
    reasoningMocks.validateModel.mockReturnValue(['悬空属性引用']);

    await expect(importOntologyFromJSON(mockMapping, {
      version: '3.0',
      objectTypes: [], objects: [], linkTypes: [], links: [], actions: [],
      propertyDefinitions: [], ruleDefinitions: [], actionDefinitions: [],
    })).rejects.toThrow('悬空属性引用');

    expect(mockOntologyInit).not.toHaveBeenCalled();
    expect(mockExecuteTransaction).not.toHaveBeenCalled();
    expect(reasoningMocks.saveCatalog).not.toHaveBeenCalled();
  });
  it('imports v2 feature, rule and outcome definitions without inferring rules from insights', async () => {
    await importOntologyFromJSON(mockMapping, {
      version: '2.0',
      objectTypes: [],
      objects: [],
      linkTypes: [],
      links: [],
      actions: [],
      insights: [{
        id: 1,
        object_id: 1,
        insight: '金额很高，也许值得观察',
        tag: 'observation',
        created_at: '2026-07-30',
      }],
      ...RISK_INFERENCE_WORKSPACE,
    });

    expect(inferenceMocks.saveWorkspace).toHaveBeenCalledWith({
      ...RISK_INFERENCE_WORKSPACE,
      dependencyFeatureIds: [],
      dependencyRuleIds: [],
    });
  });

  it('accepts a v1 payload without creating guessed feature or rule definitions', async () => {
    await importOntologyFromJSON(mockMapping, {
      version: '1.0',
      objectTypes: [],
      objects: [],
      linkTypes: [],
      links: [],
      actions: [],
      insights: [{
        id: 1,
        object_id: 1,
        insight: '如果金额大于十万则高风险',
        tag: 'legacy',
        created_at: '2026-07-30',
      }],
    });

    expect(inferenceMocks.saveWorkspace).not.toHaveBeenCalled();
  });

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

  it('rejects malformed structured payloads before starting an import transaction', async () => {
    await expect(importOntologyFromJSON(mockMapping, {
      objectTypes: [],
      objects: [{
        id: 5,
        object_type_id: 1,
        name: 'Broken',
        properties: '{"unterminated":',
        annotations: '',
      }],
      linkTypes: [],
      links: [],
      actions: [],
    })).rejects.toThrow('objects.properties must be valid JSON');

    expect(mockOntologyInit).not.toHaveBeenCalled();
    expect(mockExecuteTransaction).not.toHaveBeenCalled();
  });

  it.each(['null', '[]'])(
    'rejects non-object properties JSON (%s) before starting an import transaction',
    async properties => {
      await expect(importOntologyFromJSON(mockMapping, {
        objectTypes: [],
        objects: [{
          id: 5,
          object_type_id: 1,
          name: 'Broken',
          properties,
          annotations: '',
        }],
        linkTypes: [],
        links: [],
        actions: [],
      })).rejects.toThrow('objects.properties must be a JSON object');

      expect(mockOntologyInit).not.toHaveBeenCalled();
      expect(mockExecuteTransaction).not.toHaveBeenCalled();
    },
  );

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

  it.each([
    ['an empty id', { objectTypes: [{ id: '' as any, name: 'Unsafe', description: '' }] }],
    ['a string weight', {
      links: [{
        id: 1,
        link_type_id: 1,
        source_object_id: 1,
        target_object_id: 2,
        weight: '0.5' as any,
      }],
    }],
    ['an out-of-range weight', {
      links: [{
        id: 1,
        link_type_id: 1,
        source_object_id: 1,
        target_object_id: 2,
        weight: 1.5,
      }],
    }],
  ])('rejects %s before writing ontology import SQL', async (_label, partial) => {
    await expect(importOntologyFromJSON(mockMapping, {
      objectTypes: [],
      objects: [],
      linkTypes: [],
      links: [],
      actions: [],
      ...partial,
    })).rejects.toThrow();

    expect(mockOntologyInit).not.toHaveBeenCalled();
    expect(mockExecuteTransaction).not.toHaveBeenCalled();
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

  it('preserves an unbound action with a null object id', async () => {
    await importOntologyFromJSON(mockMapping, {
      objectTypes: [],
      objects: [],
      linkTypes: [],
      links: [],
      actions: [
        {
          id: 2,
          object_id: null as any,
          name: 'Unbound task',
          description: '',
          status: 'pending',
          execute_at: null,
        },
      ],
    });

    const statement = (mockExecuteTransaction.mock.calls[0][0] as string[])[0];
    expect(statement).toContain("VALUES (2, NULL, 'Unbound task'");
  });

  it('initializes storage and imports introspections and insights in the same transaction', async () => {
    await importOntologyFromJSON(mockMapping, {
      objectTypes: [],
      objects: [],
      linkTypes: [],
      links: [],
      actions: [],
      introspections: mockIntrospections,
      insights: mockInsights,
    });

    expect(mockOntologyInit).toHaveBeenCalledOnce();
    expect(mockExecuteTransaction).toHaveBeenCalledOnce();
    const statements = mockExecuteTransaction.mock.calls[0][0] as string[];
    expect(statements.some(statement => statement.includes('life_introspection'))).toBe(true);
    expect(statements.some(statement => statement.includes('life_insight'))).toBe(true);
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

  it.each([
    ['object id', { objects: [{ id: '1; DROP TABLE life_object' as any, name: 'A', object_type_id: 1 }] }],
    ['object type id', { objects: [{ id: 1, name: 'A', object_type_id: '1; DROP' as any }] }],
    ['link type id', {
      objects: [{ id: 1, name: 'A', object_type_id: 1 }],
      links: [{ id: 1, link_type_id: Number.NaN, source_object_id: 1, target_object_id: 1 }],
    }],
    ['action id', {
      objects: [{ id: 1, name: 'A', object_type_id: 1 }],
      actions: [{ id: Number.POSITIVE_INFINITY, object_id: 1, name: 'A' }],
    }],
  ])('rejects an unsafe numeric %s in an AI draft', (_label, partial) => {
    const payload = {
      objects: [],
      links: [],
      actions: [],
      introspections: [],
      insights: [],
      ...partial,
    };

    expect(validateDraftPayload(payload as any).valid).toBe(false);
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

  it('does not reach the transaction boundary for unsafe numeric AI output', async () => {
    await expect(executeOntologyDraft(mockMapping, {
      objects: [{ id: 1, name: 'Unsafe', object_type_id: '1); DROP TABLE life_object; --' as any }],
      links: [],
      actions: [],
      introspections: [],
      insights: [],
    })).rejects.toThrow('Invalid ontology draft');

    expect(mockExecuteTransaction).not.toHaveBeenCalled();
  });
});

describe('atomic ontology mutations', () => {
  it('commits a multi-table import through one transaction boundary', async () => {
    mockExecuteTransaction.mockResolvedValue([]);

    await importOntologyFromJSON(mockMapping, {
      objectTypes: [{ id: 1, name: 'Type', description: '' }],
      objects: [{ id: 1, object_type_id: 1, name: 'Object', properties: '{}', annotations: '' }],
      linkTypes: [],
      links: [],
      actions: [],
    });

    expect(mockExecuteTransaction).toHaveBeenCalledOnce();
    expect(mockExecuteTransaction.mock.calls[0][0]).toHaveLength(2);
  });

  it('commits dependent node-tree deletes through one transaction boundary', async () => {
    mockExecuteTransaction.mockResolvedValue([]);

    await deleteOntologyNodeTree(mockMapping, 7);

    expect(mockExecuteTransaction).toHaveBeenCalledOnce();
    expect(mockExecuteTransaction.mock.calls[0][0]).toHaveLength(6);
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
