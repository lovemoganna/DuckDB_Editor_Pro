import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getTables: vi.fn(),
  getCurrentCatalogAndSchema: vi.fn(),
  readQuery: vi.fn(),
  query: vi.fn(),
  getTableSchema: vi.fn(),
  getTableColumns: vi.fn(),
  getDashboards: vi.fn(),
  saveDashboard: vi.fn(),
  getQueries: vi.fn(),
  saveQuery: vi.fn(),
  seedDemo: vi.fn(),
  resetSeed: vi.fn(),
  repairRetail: vi.fn(),
}));

vi.mock('./duckdbService', () => ({
  duckDBService: {
    getTables: mocks.getTables,
    getCurrentCatalogAndSchema: mocks.getCurrentCatalogAndSchema,
    readQuery: mocks.readQuery,
    query: mocks.query,
    getTableSchema: mocks.getTableSchema,
    getTableColumns: mocks.getTableColumns,
  },
}));

vi.mock('./dbService', () => ({
  dbService: {
    getDashboards: mocks.getDashboards,
    saveDashboard: mocks.saveDashboard,
    getQueries: mocks.getQueries,
    saveQuery: mocks.saveQuery,
    getDomainSetting: vi.fn(async () => null),
    saveDomainSetting: vi.fn(async () => undefined),
  },
}));

vi.mock('../components/Workbench/seedWorkbenchData', () => ({
  seedDemoWorkbenchData: mocks.seedDemo,
  resetDemoSeedPromise: mocks.resetSeed,
}));

vi.mock('./repairHomeRetailTables', () => ({
  repairHomeRetailTables: mocks.repairRetail,
}));

vi.mock('./recentImportsService', () => ({
  recentImportsService: { seedDemoImports: vi.fn() },
}));

vi.mock('./analyticalCatalogService', () => ({
  buildAnalyticalCatalog: vi.fn(async () => ({
    builtAt: Date.now(),
    tableCount: 0,
    tables: [],
    coreMetrics: [],
    timeDimensions: [],
    categoryDimensions: [],
    comparisonDimensions: [],
    drillPaths: [],
    linkageFields: [],
    workspaceGaps: [],
    overallReadinessScore: 0,
  })),
}));

describe('ensureHomeDefaultVisualizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTables.mockResolvedValue([]);
    mocks.getCurrentCatalogAndSchema.mockResolvedValue({ catalog: 'memory', schema: 'main' });
    mocks.readQuery.mockResolvedValue([{ c: 0 }]);
    mocks.getTableColumns.mockResolvedValue([
      'order_id',
      'order_date',
      'status',
      'region',
      'region_id',
    ]);
    mocks.getDashboards.mockResolvedValue([]);
    mocks.saveDashboard.mockResolvedValue(undefined);
    mocks.getQueries.mockResolvedValue([]);
    mocks.saveQuery.mockResolvedValue(undefined);
    mocks.seedDemo.mockResolvedValue(undefined);
    mocks.repairRetail.mockResolvedValue(false);
  });

  it('upgrades generated metric output names without modifying user queries', async () => {
    const { ensureHomeDefaultVisualizations } = await import('./homeDefaultVisualizations');
    mocks.getCurrentCatalogAndSchema.mockResolvedValue({ catalog: 'domain_a', schema: 'main' });
    mocks.getQueries.mockResolvedValue([
      { id: 'home-auto-table__row_count', sql: 'SELECT COUNT(*) AS row_count FROM "table"', charts: [{ yKeys: ['metric_value'] }] },
      { id: 'user-query', sql: 'SELECT COUNT(*) AS row_count FROM "table"', charts: [{ yKeys: ['metric_value'] }] },
    ]);
    await ensureHomeDefaultVisualizations([]);
    expect(mocks.saveQuery).toHaveBeenCalledWith(expect.objectContaining({
      id: 'home-auto-table__row_count', databaseName: 'domain_a', sql: 'SELECT COUNT(*) AS metric_value FROM "table"',
    }));
    expect(mocks.saveQuery).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'user-query' }));
  });

  it('leaves an empty database empty', async () => {
    const { ensureHomeDefaultVisualizations } = await import('./homeDefaultVisualizations');
    const result = await ensureHomeDefaultVisualizations([]);

    expect(mocks.seedDemo).not.toHaveBeenCalled();
    expect(result.seededData).toBe(false);
    expect(result.widgetsAdded).toBe(0);
    expect(result.tableNames).toEqual([]);
    expect(mocks.saveQuery).not.toHaveBeenCalled();
  });

  it('does not re-add widgets when board already has items', async () => {
    mocks.getTables.mockResolvedValue([
      'orders',
      'order_items',
      'products',
      'customers',
      'regions',
    ]);
    mocks.readQuery.mockResolvedValue([{ c: 50 }]);
    mocks.getDashboards.mockResolvedValue([
      {
        id: 'home-default-board',
        name: '分析首页',
        items: [{ i: 'w1', savedQueryId: 'x', x: 0, y: 0, w: 4, h: 3 }],
        createdAt: 1,
        updatedAt: 1,
        template: 'auto-defaults-v14',
      },
    ]);

    const { ensureHomeDefaultVisualizations } = await import('./homeDefaultVisualizations');
    const result = await ensureHomeDefaultVisualizations([
      'orders',
      'order_items',
      'products',
      'customers',
      'regions',
    ]);

    expect(result.widgetsAdded).toBe(0);
    expect(mocks.seedDemo).not.toHaveBeenCalled();
  });

  it('repairs v1 default SQL when template is stale', async () => {
    mocks.getTables.mockResolvedValue([
      'orders',
      'order_items',
      'products',
      'customers',
      'daily_sales',
    ]);
    mocks.readQuery.mockResolvedValue([{ c: 50 }]);
    mocks.getDashboards.mockResolvedValue([
      {
        id: 'home-default-board',
        name: '分析首页',
        items: [
          {
            i: 'w-home-def-line-daily',
            savedQueryId: 'home-def-line-daily',
            x: 6,
            y: 2,
            w: 6,
            h: 4,
          },
        ],
        createdAt: 1,
        updatedAt: 1,
        template: 'auto-defaults-v1',
      },
    ]);
    mocks.getQueries.mockResolvedValue([
      {
        id: 'home-def-line-daily',
        name: '日销售额趋势',
        sql: 'SELECT sale_date FROM daily_sales',
        createdAt: 1,
      },
    ]);

    const { ensureHomeDefaultVisualizations } = await import('./homeDefaultVisualizations');
    const result = await ensureHomeDefaultVisualizations([
      'orders',
      'order_items',
      'products',
      'customers',
      'daily_sales',
    ]);

    expect(mocks.saveQuery).toHaveBeenCalled();
    const savedSql = mocks.saveQuery.mock.calls.find(
      (c: unknown[]) => (c[0] as { id?: string })?.id === 'home-def-line-daily',
    )?.[0]?.sql as string;
    expect(savedSql).toContain('order_date');
    expect(savedSql).not.toContain('sale_date');
    const unitsQuery = mocks.saveQuery.mock.calls.find(
      (c: unknown[]) => (c[0] as { id?: string })?.id === 'home-def-line-daily-units',
    )?.[0] as { name?: string; sql?: string; charts?: Array<{ yKeys?: string[] }> } | undefined;
    expect(unitsQuery?.name).toBe('日销售量趋势');
    expect(unitsQuery?.sql).toContain('quantity');
    expect(unitsQuery?.charts?.[0]?.yKeys).toContain('units');
    expect(mocks.saveDashboard).toHaveBeenCalled();
    expect(result.board.template || mocks.saveDashboard.mock.calls.at(-1)?.[0]?.template).toBeTruthy();
  });

  it('does not re-seed when one marker is empty but another has rows', async () => {
    mocks.getTables.mockResolvedValue(['orders', 'order_items', 'transactions']);
    mocks.readQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('"transactions"')) return [{ c: 0 }];
      if (sql.includes('COUNT(*)')) return [{ c: 50 }];
      return [];
    });
    mocks.getDashboards.mockResolvedValue([
      {
        id: 'home-default-board',
        name: '分析首页',
        items: [{ i: 'w1', savedQueryId: 'x', x: 0, y: 0, w: 4, h: 3 }],
        createdAt: 1,
        updatedAt: 1,
        template: 'auto-defaults-v9',
      },
    ]);

    const { ensureHomeDefaultVisualizations } = await import('./homeDefaultVisualizations');
    const first = await ensureHomeDefaultVisualizations(['orders', 'order_items', 'transactions']);
    const second = await ensureHomeDefaultVisualizations(['orders', 'order_items', 'transactions']);

    expect(mocks.seedDemo).not.toHaveBeenCalled();
    expect(first.seededData).toBe(false);
    expect(second.seededData).toBe(false);
  });

  it('never repairs retail data implicitly', async () => {
    mocks.repairRetail.mockResolvedValue(true);
    mocks.getTables.mockResolvedValue([
      'orders',
      'order_items',
      'products',
      'customers',
      'regions',
      'daily_sales',
    ]);
    mocks.readQuery.mockResolvedValue([{ c: 100 }]);
    mocks.getDashboards.mockResolvedValue([
      {
        id: 'home-default-board',
        name: '分析首页',
        items: [],
        createdAt: 1,
        updatedAt: 1,
      },
    ]);

    const { ensureHomeDefaultVisualizations } = await import('./homeDefaultVisualizations');
    const result = await ensureHomeDefaultVisualizations([
      'orders',
      'order_items',
      'products',
      'customers',
    ]);

    expect(mocks.repairRetail).not.toHaveBeenCalled();
    expect(result.seededData).toBe(false);
    expect(result.widgetsAdded).toBeGreaterThan(0);
  });

  it('dedupes concurrent homepage loads without seeding data', async () => {
    const { ensureHomeDefaultVisualizations } = await import('./homeDefaultVisualizations');
    const p1 = ensureHomeDefaultVisualizations([]);
    const p2 = ensureHomeDefaultVisualizations([]);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(r2);
    expect(r1.seededData).toBe(false);
    expect(mocks.seedDemo).not.toHaveBeenCalled();
  });

  it('does not publish retail templates when live columns cannot bind their SQL', async () => {
    mocks.getTables.mockResolvedValue(['orders', 'order_items', 'products', 'customers']);
    mocks.query.mockRejectedValue(new Error('Binder Error: amount does not exist'));
    const { ensureHomeDefaultVisualizations } = await import('./homeDefaultVisualizations');
    const result = await ensureHomeDefaultVisualizations();
    expect(result.widgetsAdded).toBe(0);
    expect(mocks.saveQuery).not.toHaveBeenCalled();
  });

  it('does not recreate an intentionally emptied home board', async () => {
    mocks.getTables.mockResolvedValue(['sales']);
    mocks.getDashboards.mockResolvedValue([{ id: 'home-default-board', name: 'home', items: [],
      createdAt: 1, updatedAt: 1, template: 'auto-defaults-v12' }]);
    const { ensureHomeDefaultVisualizations } = await import('./homeDefaultVisualizations');
    expect((await ensureHomeDefaultVisualizations()).widgetsAdded).toBe(0);
    expect(mocks.saveQuery).not.toHaveBeenCalled();
  });
});
