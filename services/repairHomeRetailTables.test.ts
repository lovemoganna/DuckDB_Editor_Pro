import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getTables: vi.fn(),
  readQuery: vi.fn(),
  query: vi.fn(),
  getTableColumns: vi.fn(),
  seedDemo: vi.fn(),
  resetSeed: vi.fn(),
}));

vi.mock('./duckdbService', () => ({
  duckDBService: {
    getTables: mocks.getTables,
    readQuery: mocks.readQuery,
    query: mocks.query,
    getTableColumns: mocks.getTableColumns,
  },
}));

vi.mock('../components/Workbench/seedWorkbenchData', () => ({
  seedDemoWorkbenchData: mocks.seedDemo,
  resetDemoSeedPromise: mocks.resetSeed,
}));

describe('repairHomeRetailTables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTables.mockResolvedValue([
      'orders',
      'order_items',
      'customers',
      'regions',
      'products',
      'daily_sales',
    ]);
    mocks.readQuery.mockResolvedValue([{ c: 50 }]);
    mocks.getTableColumns.mockResolvedValue([
      'order_id',
      'order_date',
      'status',
      'region',
      'region_id',
      'customer_id',
    ]);
    mocks.query.mockResolvedValue([]);
    mocks.seedDemo.mockResolvedValue(undefined);
  });

  it('rebuilds orders from order_items when region join is broken', async () => {
    mocks.getTableColumns.mockResolvedValue([
      'order_id',
      'order_date',
      'status',
      'region',
      'customer_id',
    ]);
    mocks.readQuery.mockImplementation(async (sql: string) => {
      const s = sql.toLowerCase();
      if (s.includes('from order_items oi') && s.includes('join orders')) return [{ c: 0 }];
      if (s.includes('count(distinct order_id)')) return [{ c: 1000 }];
      if (s.includes('try_cast') || s.includes('category')) return [{ c: 100 }];
      if (s.includes('not exists') && s.includes('customers')) return [{ c: 0 }];
      return [{ c: 50 }];
    });

    const { repairHomeRetailTables } = await import('./repairHomeRetailTables');
    const repaired = await repairHomeRetailTables();

    expect(repaired).toBe(true);
    expect(mocks.query).toHaveBeenCalledWith('DROP TABLE IF EXISTS orders');
    const sqlJoined = mocks.query.mock.calls.map((c) => String(c[0])).join('\n');
    expect(sqlJoined).toContain('CREATE TABLE orders AS');
    expect(sqlJoined).toContain('FROM order_items');
    expect(mocks.seedDemo).not.toHaveBeenCalled();
  });

  it('is a no-op when retail schema joins cleanly', async () => {
    mocks.readQuery.mockImplementation(async (sql: string) => {
      const s = sql.toLowerCase();
      if (s.includes('from order_items oi') && s.includes('join orders')) return [{ c: 500 }];
      if (s.includes('count(distinct order_id)')) return [{ c: 1000 }];
      if (s.includes('try_cast') || (s.includes('category') && s.includes('count'))) return [{ c: 100 }];
      if (s.includes('not exists') && s.includes('customers')) return [{ c: 0 }];
      return [{ c: 50 }];
    });

    const { repairHomeRetailTables } = await import('./repairHomeRetailTables');
    const repaired = await repairHomeRetailTables();

    expect(repaired).toBe(false);
    expect(mocks.query).not.toHaveBeenCalledWith('DROP TABLE IF EXISTS orders');
    expect(mocks.seedDemo).not.toHaveBeenCalled();
  });

  it('backfills numeric-only categories into names', async () => {
    mocks.readQuery.mockImplementation(async (sql: string) => {
      const s = sql.toLowerCase();
      // named categories = 0 → need backfill
      if (s.includes('try_cast') && s.includes('category')) return [{ c: 0 }];
      if (s.includes('from order_items oi') && s.includes('join orders')) return [{ c: 500 }];
      if (s.includes('count(distinct order_id)')) return [{ c: 1000 }];
      if (s.includes('not exists') && s.includes('customers')) return [{ c: 0 }];
      return [{ c: 50 }];
    });

    const { repairHomeRetailTables } = await import('./repairHomeRetailTables');
    const repaired = await repairHomeRetailTables();

    expect(repaired).toBe(true);
    const sqlJoined = mocks.query.mock.calls.map((c) => String(c[0])).join('\n');
    expect(sqlJoined).toContain('UPDATE order_items');
    expect(sqlJoined).toContain('Electronics');
  });

  it('seeds when order_items is missing', async () => {
    mocks.getTables.mockResolvedValue(['regions']);
    const { repairHomeRetailTables } = await import('./repairHomeRetailTables');
    const repaired = await repairHomeRetailTables();
    expect(repaired).toBe(true);
    expect(mocks.resetSeed).toHaveBeenCalled();
    expect(mocks.seedDemo).toHaveBeenCalled();
  });
});
