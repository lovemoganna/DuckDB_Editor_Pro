/**
 * services/schema/schemaInferenceService.test.ts — Unit tests for schemaInferenceService
 *
 * Tests:
 * - getObjectTypeDbIdByName returns correct ID or 0 when not found
 * - getLinkTypeDbIdByName returns correct ID or 0 when not found
 * - getObjectIdsByObjectType returns array of IDs
 * - buildOntologyIdMap builds correct { objectTypeId, linkTypeId } map
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getObjectTypeDbIdByName,
  getLinkTypeDbIdByName,
  getObjectIdsByObjectType,
  buildOntologyIdMap,
} from './schemaInferenceService';

// ─── Mock duckDBService ─────────────────────────────────────────────────────────
//
// vi.mock is hoisted. We use vi.hoisted() to create stable mock functions
// so the hoisted vi.mock factory can reference them at module-boot time.
// We MUST include all properties the SUT accesses on duckDBService —
// duckDBService.escapeLiteral is called inside template literals in the SUT.
const _mockQuery = vi.hoisted(() => vi.fn());

vi.mock('../duckdbService', () => ({
  duckDBService: {
    query: _mockQuery,
    // escapeLiteral is called inside template literals in the SUT — required!
    escapeLiteral: (v: unknown) => {
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'number') return v.toString();
      if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
      return `'${String(v).replace(/'/g, "''")}'`;
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// Alias for readable test code — same reference as _mockQuery
const mockQuery = _mockQuery;

// ─── getObjectTypeDbIdByName ──────────────────────────────────────────────────

describe('getObjectTypeDbIdByName', () => {
  it('returns the id when object type exists', async () => {
    // ARRANGE
    mockQuery.mockResolvedValueOnce([{ id: 42 }]);

    // ACT
    const result = await getObjectTypeDbIdByName('User');

    // ASSERT
    expect(result).toBe(42);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('life_object_type'));
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("'User'"));
  });

  it('returns 0 when object type does not exist', async () => {
    // ARRANGE
    mockQuery.mockResolvedValueOnce([]);

    // ACT
    const result = await getObjectTypeDbIdByName('NonExistent');

    // ASSERT
    expect(result).toBe(0);
  });

  it('returns 0 when query result has no id property', async () => {
    // ARRANGE
    mockQuery.mockResolvedValueOnce([{}]);

    // ACT
    const result = await getObjectTypeDbIdByName('User');

    // ASSERT
    expect(result).toBe(0);
  });

  it('escapes name with single quotes correctly', async () => {
    // ARRANGE
    mockQuery.mockResolvedValueOnce([{ id: 5 }]);

    // ACT
    await getObjectTypeDbIdByName("O'Brien");

    // ASSERT
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("'O''Brien'"));
  });
});

// ─── getLinkTypeDbIdByName ───────────────────────────────────────────────────

describe('getLinkTypeDbIdByName', () => {
  it('returns the id when link type exists', async () => {
    // ARRANGE
    mockQuery.mockResolvedValueOnce([{ id: 7 }]);

    // ACT
    const result = await getLinkTypeDbIdByName('purchased');

    // ASSERT
    expect(result).toBe(7);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('life_link_type'));
  });

  it('returns 0 when link type does not exist', async () => {
    // ARRANGE
    mockQuery.mockResolvedValueOnce([]);

    // ACT
    const result = await getLinkTypeDbIdByName('unknown_link');

    // ASSERT
    expect(result).toBe(0);
  });

  it('throws TypeError when query result is null', async () => {
    // ARRANGE
    mockQuery.mockResolvedValueOnce(null);

    // ACT & ASSERT — the SUT calls rows[0] on null without null guard, throws as unhandled rejection
    await expect(getLinkTypeDbIdByName('purchased')).rejects.toThrow();
  });
});

// ─── getObjectIdsByObjectType ─────────────────────────────────────────────────

describe('getObjectIdsByObjectType', () => {
  it('returns array of object IDs for given object type', async () => {
    // ARRANGE
    mockQuery.mockResolvedValueOnce([
      { id: 10 },
      { id: 20 },
      { id: 30 },
    ]);

    // ACT
    const result = await getObjectIdsByObjectType(1);

    // ASSERT
    expect(result).toEqual([10, 20, 30]);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('life_object'));
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('object_type_id = 1'));
  });

  it('returns empty array when no objects match', async () => {
    // ARRANGE
    mockQuery.mockResolvedValueOnce([]);

    // ACT
    const result = await getObjectIdsByObjectType(99);

    // ASSERT
    expect(result).toEqual([]);
  });

  it('throws TypeError when query result is null', async () => {
    // ARRANGE
    mockQuery.mockResolvedValueOnce(null);

    // ACT & ASSERT — the SUT calls rows.map() on null without null guard, throws as unhandled rejection
    await expect(getObjectIdsByObjectType(1)).rejects.toThrow();
  });

  it('maps over all rows correctly', async () => {
    // ARRANGE
    mockQuery.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);

    // ACT
    const result = await getObjectIdsByObjectType(2);

    // ASSERT
    expect(result).toHaveLength(4);
    expect(result).toEqual(expect.arrayContaining([1, 2, 3, 4]));
  });
});

// ─── buildOntologyIdMap ───────────────────────────────────────────────────────

describe('buildOntologyIdMap', () => {
  it('builds correct map with valid object and link type names', async () => {
    // ARRANGE — parallel calls: getObjectTypeDbIdByName + getLinkTypeDbIdByName
    mockQuery
      .mockResolvedValueOnce([{ id: 3 }])  // User
      .mockResolvedValueOnce([{ id: 5 }]);  // purchased

    // ACT
    const result = await buildOntologyIdMap(['User'], ['purchased']);

    // ASSERT
    expect(result.objectTypeId).toBe(3);
    expect(result.linkTypeId).toBe(5);
  });

  it('returns 0 for objectTypeId when no object type matches', async () => {
    // ARRANGE
    mockQuery
      .mockResolvedValueOnce([])  // Ghost — no match
      .mockResolvedValueOnce([{ id: 5 }]);

    // ACT
    const result = await buildOntologyIdMap(['Ghost'], ['purchased']);

    // ASSERT
    expect(result.objectTypeId).toBe(0);
    expect(result.linkTypeId).toBe(5);
  });

  it('returns 0 for linkTypeId when no link type matches', async () => {
    // ARRANGE
    mockQuery
      .mockResolvedValueOnce([{ id: 3 }])
      .mockResolvedValueOnce([]);  // unknown — no match

    // ACT
    const result = await buildOntologyIdMap(['User'], ['unknown']);

    // ASSERT
    expect(result.objectTypeId).toBe(3);
    expect(result.linkTypeId).toBe(0);
  });

  it('uses first positive ID when multiple object type names provided', async () => {
    // ARRANGE — queries both names in parallel
    mockQuery
      .mockResolvedValueOnce([])  // Ghost — no match
      .mockResolvedValueOnce([{ id: 7 }]);  // User — match

    // ACT
    const result = await buildOntologyIdMap(['Ghost', 'User'], []);

    // ASSERT
    expect(result.objectTypeId).toBe(7);
  });

  it('handles empty arrays for both type names', async () => {
    // ACT
    const result = await buildOntologyIdMap([], []);

    // ASSERT
    expect(result.objectTypeId).toBe(0);
    expect(result.linkTypeId).toBe(0);
  });

  it('queries in parallel for objectTypeNames and linkTypeNames', async () => {
    // ARRANGE
    mockQuery
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 2 }])
      .mockResolvedValueOnce([{ id: 3 }])
      .mockResolvedValueOnce([{ id: 4 }]);

    // ACT
    await buildOntologyIdMap(['A', 'B'], ['C', 'D']);

    // ASSERT — all 4 calls made in parallel (Promise.all)
    expect(mockQuery).toHaveBeenCalledTimes(4);
  });
});
