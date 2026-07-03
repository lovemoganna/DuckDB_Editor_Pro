/**
 * hooks/store/useAppStore.test.ts — Unit tests for useAppStore
 *
 * Tests:
 * - fetchTableData updates state correctly on success and error
 * - pagination: page change updates tableData
 * - filter: WHERE clause built correctly from filterQuery
 * - handleTableSelect resets pagination and sort state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from './useAppStore';

// ─── Mock duckDBService ─────────────────────────────────────────────────────────
//
// vi.mock is hoisted. We use vi.hoisted() to create stable mock functions
// before the hoisted vi.mock factory runs.
// Each test calls mockReset() in beforeEach to clear call history AND
// queued mockResolvedValueOnce values so no stale state leaks between tests.

const mockQuery = vi.hoisted(() => vi.fn());
const mockGetTableSchema = vi.hoisted(() => vi.fn());
const mockGetTables = vi.hoisted(() => vi.fn());

vi.mock('../../services/duckdbService', () => ({
  duckDBService: {
    query: mockQuery,
    getTableSchema: mockGetTableSchema,
    getTables: mockGetTables,
    escapeLiteral: (v: unknown) => {
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'number') return v.toString();
      if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
      return `'${String(v).replace(/'/g, "''")}'`;
    },
  },
}));

beforeEach(() => {
  // mockReset clears call history AND queued mockResolvedValueOnce values.
  mockQuery.mockReset();
  mockGetTableSchema.mockReset();
  mockGetTables.mockReset();

  // Reset store to a clean initial state
  useAppStore.setState({
    currentTable: null,
    tableData: [],
    tableColumns: [],
    pagination: { limit: 50, offset: 0, total: 0 },
    filterQuery: '',
    sortConfig: null,
    loadingData: false,
    schema: [],
    notifications: [],
    selectedRows: new Set(),
  });
});

// ─── Test Fixtures ─────────────────────────────────────────────────────────────

const mockSchema = [
  { name: 'id', type: 'BIGINT', notnull: true, dflt_value: null, pk: true },
  { name: 'name', type: 'VARCHAR', notnull: false, dflt_value: null, pk: false },
  { name: 'amount', type: 'DOUBLE', notnull: false, dflt_value: null, pk: false },
];

const mockRows = [
  { id: 1, name: 'Alice', amount: 100 },
  { id: 2, name: 'Bob', amount: 200 },
];

// ─── fetchTableData ───────────────────────────────────────────────────────────

describe('fetchTableData', () => {
  it('loads table data and updates state on success', async () => {
    // ARRANGE
    mockGetTableSchema.mockResolvedValueOnce(mockSchema);
    mockQuery
      .mockResolvedValueOnce([{ c: 2 }])  // COUNT
      .mockResolvedValueOnce(mockRows);    // SELECT

    // ACT
    await useAppStore.getState().fetchTableData('orders', 0, 50);

    // ASSERT
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('COUNT(*)'));
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM "orders"'));
    expect(useAppStore.getState().tableData).toEqual(mockRows);
    expect(useAppStore.getState().loadingData).toBe(false);
    expect(useAppStore.getState().schema).toEqual(mockSchema);
  });

  it('sets loadingData true during fetch', async () => {
    mockGetTableSchema.mockResolvedValueOnce(mockSchema);
    mockQuery
      .mockResolvedValueOnce([{ c: 2 }])
      .mockResolvedValueOnce(mockRows);

    const loadingValues: boolean[] = [];
    const unsub = useAppStore.subscribe((state) => {
      loadingValues.push(state.loadingData);
    });

    await useAppStore.getState().fetchTableData('orders', 0, 50);
    unsub();

    expect(loadingValues).toContain(true);
    expect(loadingValues[loadingValues.length - 1]).toBe(false);
  });

  it('clears tableData and adds error notification on failure', async () => {
    // ARRANGE
    mockGetTableSchema.mockRejectedValueOnce(new Error('Table not found'));

    // ACT
    await useAppStore.getState().fetchTableData('nonexistent', 0, 50);

    // ASSERT
    const state = useAppStore.getState();
    expect(state.tableData).toEqual([]);
    expect(state.loadingData).toBe(false);
    expect(state.notifications.some(n => n.type === 'error')).toBe(true);
  });

  it('passes LIMIT and OFFSET correctly to the SELECT query', async () => {
    // ARRANGE
    mockGetTableSchema.mockResolvedValueOnce(mockSchema);
    mockQuery
      .mockResolvedValueOnce([{ c: 100 }])
      .mockResolvedValueOnce([]);

    // ACT
    await useAppStore.getState().fetchTableData('orders', 50, 25);

    // ASSERT — second call is SELECT
    expect(mockQuery.mock.calls.length).toBeGreaterThanOrEqual(2);
    const selectCall = mockQuery.mock.calls[1]?.[0] as string | undefined;
    expect(selectCall).toBeDefined();
    expect(selectCall!).toContain('LIMIT 25');
    expect(selectCall!).toContain('OFFSET 50');
  });

  it('applies ORDER BY when currentSort is provided', async () => {
    // ARRANGE
    mockGetTableSchema.mockResolvedValueOnce(mockSchema);
    mockQuery
      .mockResolvedValueOnce([{ c: 2 }])
      .mockResolvedValueOnce(mockRows);

    // ACT
    await useAppStore.getState().fetchTableData('orders', 0, 50, { key: 'amount', direction: 'DESC' });

    // ASSERT
    expect(mockQuery.mock.calls.length).toBeGreaterThanOrEqual(2);
    const selectCall = mockQuery.mock.calls[1]?.[0] as string | undefined;
    expect(selectCall).toBeDefined();
    expect(selectCall!).toContain('ORDER BY "amount" DESC');
  });

  it('uses primary key for default ordering when no sort provided', async () => {
    // ARRANGE
    mockGetTableSchema.mockResolvedValueOnce(mockSchema);
    mockQuery
      .mockResolvedValueOnce([{ c: 2 }])
      .mockResolvedValueOnce(mockRows);

    // ACT
    await useAppStore.getState().fetchTableData('orders', 0, 50);

    // ASSERT
    expect(mockQuery.mock.calls.length).toBeGreaterThanOrEqual(2);
    const selectCall = mockQuery.mock.calls[1]?.[0] as string | undefined;
    expect(selectCall).toBeDefined();
    expect(selectCall!).toContain('ORDER BY "id" ASC');
  });
});

// ─── pagination ────────────────────────────────────────────────────────────────

describe('pagination', () => {
  it('fetchTableData with offset=50 uses correct OFFSET in SELECT query', async () => {
    // ARRANGE
    mockGetTableSchema.mockResolvedValueOnce(mockSchema);
    mockQuery
      .mockResolvedValueOnce([{ c: 100 }])
      .mockResolvedValueOnce([]);

    // ACT — directly test fetchTableData with offset 50 (same as handlePageChange(50))
    await useAppStore.getState().fetchTableData('orders', 50, 50);

    // ASSERT
    expect(mockQuery.mock.calls.length).toBeGreaterThanOrEqual(2);
    const selectCall = mockQuery.mock.calls[1]?.[0] as string | undefined;
    expect(selectCall).toBeDefined();
    expect(selectCall!).toContain('OFFSET 50');
  });

  it('handlePageChange ignores negative offset', () => {
    useAppStore.setState({ currentTable: 'orders', pagination: { limit: 50, offset: 0, total: 100 } });

    const fetchSpy = vi.spyOn(useAppStore.getState(), 'fetchTableData');

    useAppStore.getState().handlePageChange(-1);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('handlePageChange ignores offset beyond total', () => {
    useAppStore.setState({ currentTable: 'orders', pagination: { limit: 50, offset: 0, total: 100 } });

    const fetchSpy = vi.spyOn(useAppStore.getState(), 'fetchTableData');

    useAppStore.getState().handlePageChange(200);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetchTableData updates pagination.total from COUNT query', async () => {
    // ARRANGE
    mockGetTableSchema.mockResolvedValueOnce(mockSchema);
    mockQuery
      .mockResolvedValueOnce([{ c: 999 }])
      .mockResolvedValueOnce([]);

    // ACT
    await useAppStore.getState().fetchTableData('orders', 0, 50);

    // ASSERT
    expect(useAppStore.getState().pagination.total).toBe(999);
  });
});

// ─── filter ────────────────────────────────────────────────────────────────────

describe('filter', () => {
  it('builds WHERE clause from filterQuery when filterQuery is set', async () => {
    // ARRANGE
    useAppStore.setState({ filterQuery: 'amount > 100' });
    mockGetTableSchema.mockResolvedValueOnce(mockSchema);
    mockQuery
      .mockResolvedValueOnce([{ c: 1 }])
      .mockResolvedValueOnce([{ id: 2, name: 'Bob', amount: 200 }]);

    // ACT
    await useAppStore.getState().fetchTableData('orders', 0, 50);

    // ASSERT
    expect(mockQuery.mock.calls.length).toBeGreaterThanOrEqual(2);
    const countCall = mockQuery.mock.calls[0]?.[0] as string | undefined;
    const selectCall = mockQuery.mock.calls[1]?.[0] as string | undefined;
    expect(countCall).toBeDefined();
    expect(selectCall).toBeDefined();
    expect(countCall!).toContain('WHERE amount > 100');
    expect(selectCall!).toContain('WHERE amount > 100');
  });

  it('accepts filter override as currentFilter parameter', async () => {
    // ARRANGE — filterQuery state is empty, but currentFilter is passed directly
    useAppStore.setState({ filterQuery: '' });
    mockGetTableSchema.mockResolvedValueOnce(mockSchema);
    mockQuery
      .mockResolvedValueOnce([{ c: 1 }])
      .mockResolvedValueOnce([{ id: 1, name: 'Alice', amount: 100 }]);

    // ACT
    await useAppStore.getState().fetchTableData('orders', 0, 50, undefined, "name = 'Alice'");

    // ASSERT
    const countCall = mockQuery.mock.calls[0]?.[0] as string | undefined;
    expect(countCall).toBeDefined();
    expect(countCall!).toContain("WHERE name = 'Alice'");
  });

  it('uses currentFilter over filterQuery when both are present', async () => {
    // ARRANGE
    useAppStore.setState({ filterQuery: 'amount > 100' });
    mockGetTableSchema.mockResolvedValueOnce(mockSchema);
    mockQuery
      .mockResolvedValueOnce([{ c: 1 }])
      .mockResolvedValueOnce([]);

    // ACT — currentFilter overrides state filterQuery
    await useAppStore.getState().fetchTableData('orders', 0, 50, undefined, "name LIKE 'A%'");

    // ASSERT
    const countCall = mockQuery.mock.calls[0]?.[0] as string | undefined;
    expect(countCall).toBeDefined();
    expect(countCall!).toContain("WHERE name LIKE 'A%'");
    expect(countCall!).not.toContain('amount > 100');
  });

  it('handles filter error by setting error notification (does not reject)', async () => {
    // ARRANGE
    useAppStore.setState({ filterQuery: 'invalid syntax' });
    mockGetTableSchema.mockResolvedValueOnce(mockSchema);
    mockQuery.mockRejectedValueOnce(new Error('syntax error'));

    // ACT — fetchTableData catches errors internally and resolves (not rejects)
    await useAppStore.getState().fetchTableData('orders', 0, 50);

    // ASSERT
    expect(useAppStore.getState().tableData).toEqual([]);
    expect(useAppStore.getState().loadingData).toBe(false);
    expect(useAppStore.getState().notifications.some(n => n.type === 'error')).toBe(true);
  });

  it('handles empty filterQuery gracefully (no WHERE clause)', async () => {
    // ARRANGE
    useAppStore.setState({ filterQuery: '' });
    mockGetTableSchema.mockResolvedValueOnce(mockSchema);
    mockQuery
      .mockResolvedValueOnce([{ c: 2 }])
      .mockResolvedValueOnce(mockRows);

    // ACT
    await useAppStore.getState().fetchTableData('orders', 0, 50);

    // ASSERT
    expect(mockQuery.mock.calls.length).toBeGreaterThanOrEqual(2);
    const countCall = mockQuery.mock.calls[0]?.[0] as string | undefined;
    const selectCall = mockQuery.mock.calls[1]?.[0] as string | undefined;
    expect(countCall).toBeDefined();
    expect(selectCall).toBeDefined();
    expect(countCall!).not.toContain('WHERE');
    expect(selectCall!).not.toContain('WHERE');
  });

  it('handles whitespace-only filterQuery as empty', async () => {
    // ARRANGE
    useAppStore.setState({ filterQuery: '   ' });
    mockGetTableSchema.mockResolvedValueOnce(mockSchema);
    mockQuery
      .mockResolvedValueOnce([{ c: 2 }])
      .mockResolvedValueOnce(mockRows);

    // ACT
    await useAppStore.getState().fetchTableData('orders', 0, 50);

    // ASSERT
    const countCall = mockQuery.mock.calls[0]?.[0] as string | undefined;
    expect(countCall).toBeDefined();
    expect(countCall!).not.toContain('WHERE');
  });
});

// ─── handleTableSelect ─────────────────────────────────────────────────────────

describe('handleTableSelect', () => {
  it('sets currentTable and resets pagination offset', async () => {
    // ARRANGE
    useAppStore.setState({ pagination: { limit: 50, offset: 100, total: 200 } });
    mockGetTableSchema.mockResolvedValueOnce(mockSchema);
    mockQuery
      .mockResolvedValueOnce([{ c: 2 }])
      .mockResolvedValueOnce(mockRows);

    // ACT
    await useAppStore.getState().handleTableSelect('orders');

    // ASSERT
    expect(useAppStore.getState().currentTable).toBe('orders');
    expect(useAppStore.getState().pagination.offset).toBe(0);
  });

  it('resets sortConfig and filterQuery on table select', async () => {
    // ARRANGE
    useAppStore.setState({ sortConfig: { key: 'amount', direction: 'DESC' }, filterQuery: 'id > 0' });
    mockGetTableSchema.mockResolvedValueOnce(mockSchema);
    mockQuery
      .mockResolvedValueOnce([{ c: 2 }])
      .mockResolvedValueOnce(mockRows);

    // ACT
    await useAppStore.getState().handleTableSelect('orders');

    // ASSERT
    expect(useAppStore.getState().sortConfig).toBeNull();
    expect(useAppStore.getState().filterQuery).toBe('');
  });
});
