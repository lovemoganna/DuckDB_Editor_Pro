import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  enrichSavedQueryLineage,
  applyBoardParams,
} from './homeDashboardService';

const mocks = vi.hoisted(() => ({
  getDashboards: vi.fn(),
  saveDashboard: vi.fn(),
  saveQuery: vi.fn(),
  getQueries: vi.fn(),
  getDashboardReadIssues: vi.fn(),
  selected: null as string | null,
}));

vi.mock('./dbService', () => ({
  dbService: {
    getDashboards: mocks.getDashboards,
    saveDashboard: mocks.saveDashboard,
    updateDashboard: async (id: string, catalog: string, edit: (board: any) => any) => {
      const current = (await mocks.getDashboards(catalog)).find((board: any) => board.id === id);
      if (!current) throw new Error("missing test board");
      const next = edit(current); await mocks.saveDashboard(next); mocks.getDashboards.mockResolvedValue([next]); return next;
    },
    saveQuery: mocks.saveQuery,
    getQueries: mocks.getQueries,
    getDashboardReadIssues: mocks.getDashboardReadIssues,
    getDomainSetting: vi.fn().mockImplementation(async()=>mocks.selected),
    saveDomainSetting: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./duckdbService', () => ({
  duckDBService: {
    getRuntimeInfo: () => ({ ready: true, persistent: false, currentDatabase: 'memory' }),
    getCurrentCatalogAndSchema: async () => ({ catalog: 'memory', schema: 'main' }),
  },
}));

describe('homeDashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDashboards.mockResolvedValue([]);
    mocks.saveDashboard.mockResolvedValue(undefined);
    mocks.saveQuery.mockResolvedValue(undefined);
    mocks.getDashboardReadIssues.mockReturnValue([]);
    mocks.selected=null;
  });

  it('enriches SQL with referenced tables and schemas', () => {
    const q = enrichSavedQueryLineage({
      id: '1',
      name: 't',
      sql: 'SELECT * FROM orders JOIN customers ON 1=1',
      createdAt: 1,
    });
    expect(q.referencedTables).toEqual(expect.arrayContaining(['orders', 'customers']));
    expect(q.referencedSchemas).toContain('main');
    expect(q.vizHint).toBeDefined();
  });

  it('never replaces a damaged default view, but permits selecting a different valid view',async()=>{
    const {getOrCreateHomeDashboard,homeDashboardIdForCatalog}=await import('./homeDashboardService');
    mocks.getDashboardReadIssues.mockReturnValue([{id:homeDashboardIdForCatalog('memory'),message:'invalid'}]);
    await expect(getOrCreateHomeDashboard()).rejects.toThrow('原记录已保留');
    expect(mocks.saveDashboard).not.toHaveBeenCalled();
    mocks.selected='other';
    mocks.getDashboards.mockResolvedValue([{id:'other',databaseName:'memory',name:'other',items:[],createdAt:1,updatedAt:1}]);
    expect((await getOrCreateHomeDashboard()).id).toBe('other');
    expect(mocks.saveDashboard).not.toHaveBeenCalled();
  });

  it('creates default home board when none exists', async () => {
    const { getOrCreateHomeDashboard, homeDashboardIdForCatalog } = await import('./homeDashboardService');
    const board = await getOrCreateHomeDashboard();
    expect(board.id).toBe(homeDashboardIdForCatalog('memory'));
    expect(board.databaseName).toBe('memory');
    expect(board.items).toEqual([]);
    expect(mocks.saveDashboard).toHaveBeenCalled();
  });

  it('adds saved query to home board once', async () => {
    const { addSavedQueryToHomeBoard, homeDashboardIdForCatalog } = await import('./homeDashboardService');
    const homeId = homeDashboardIdForCatalog('memory');
    mocks.getDashboards.mockResolvedValue([
      {
        id: homeId,
        name: '分析首页',
        items: [],
        createdAt: 1,
        updatedAt: 1,
        databaseName: 'memory',
      },
    ]);
    const board = await addSavedQueryToHomeBoard('sq-1');
    expect(board.items).toHaveLength(1);
    expect(board.items[0].savedQueryId).toBe('sq-1');

    mocks.getDashboards.mockResolvedValue([board]);
    const again = await addSavedQueryToHomeBoard('sq-1');
    expect(again.items).toHaveLength(1);
  });

  it('applies board params into SQL placeholders', () => {
    expect(applyBoardParams('SELECT {{n}}', { n: '3' })).toBe('SELECT 3');
    expect(applyBoardParams("SELECT {{name}}", { name: "O'Brien" })).toContain("O''Brien");
  });

  it('repeats an original analysis object as independent layout instances without copying its SQL', async () => {
    const { addObjectToDashboard } = await import('./homeDashboardService');
    mocks.getQueries.mockResolvedValue([]);
    const original = { id: 'v', name: '自由编排', databaseName: 'memory', items: [], createdAt: 1, updatedAt: 1 };
    mocks.getDashboards.mockResolvedValue([original]);
    const object = { kind: 'metric' as const, id: 'm', name: '真实指标' };
    const first = await addObjectToDashboard(object, original);
    const second = await addObjectToDashboard(object, first);
    expect(second.items).toHaveLength(2);
    expect(second.items[0].i).not.toBe(second.items[1].i);
    expect(second.items[0].savedQueryId).toBe(second.items[1].savedQueryId);
    expect(mocks.saveQuery).toHaveBeenCalledWith(expect.objectContaining({sql:'',analysisRef:{kind:'metric',id:'m'}}));
  });

  it('does not silently replace the home board with an unrelated saved dashboard', async () => {
    const { getOrCreateHomeDashboard } = await import('./homeDashboardService');
    mocks.getDashboards.mockResolvedValue([{ id: 'user-board', name: '私人看板', items: [], databaseName: 'memory' }]);
    expect((await getOrCreateHomeDashboard()).id).toBe('home-default-board::memory');
  });

  it('unpins the actual home widget and derives status from board membership', async () => {
    const { loadHomePinnedChartIds, unpinChartFromHome } = await import('./homeDashboardService');
    const board = { id: 'home-default-board::memory', databaseName: 'memory', name: 'home',
      createdAt: 1, updatedAt: 1, items: [{ i: 'w', savedQueryId: 'sq', x: 0, y: 0, w: 4, h: 3 }] };
    mocks.getDashboards.mockResolvedValue([board]);
    mocks.getQueries.mockResolvedValue([{ id: 'sq', metricChartId: 'c' }]);
    expect(await loadHomePinnedChartIds()).toEqual(new Set(['c']));
    await unpinChartFromHome({ id: 'c' } as any);
    expect(mocks.saveDashboard).toHaveBeenCalledWith(expect.objectContaining({ items: [] }));
  });

  it('pins a linked metric chart once instead of duplicating saved queries', async () => {
    const { pinChartToHome } = await import('./homeDashboardService');
    mocks.getDashboards.mockResolvedValue([{ id: 'home-default-board::memory', databaseName: 'memory',
      name: 'home', items: [{ i: 'w', savedQueryId: 'sq', x: 0, y: 0, w: 4, h: 3 }] }]);
    mocks.getQueries.mockResolvedValue([{ id: 'sq', metricChartId: 'c' }]);
    expect(await pinChartToHome({ id: 'c', metricName: 'm', sql: 'SELECT 1 AS total',
      chartConfig: { id: 'cfg', title: 'total', type: 'counter', xKey: '', yKeys: ['total'] }, createdAt: 1 })).toBe('sq');
    expect(mocks.saveQuery).toHaveBeenCalledWith(expect.objectContaining({ id: 'sq' }));
    expect(mocks.saveDashboard).not.toHaveBeenCalled();
  });
  it('reuses an existing generated home query when its metric SQL is the same', async () => {
    const { syncLinkedChart } = await import('./homeDashboardService');
    mocks.getQueries.mockResolvedValue([{ id: 'home-auto-sales__row_count', sql: 'SELECT COUNT(*) AS total FROM sales; -- old hint', createdAt: 1 }]);
    await syncLinkedChart({ id: 'c', metricName: 'Rows', sql: 'SELECT COUNT(*) AS total FROM sales;', createdAt: 2,
      chartConfig: { id: 'cfg', title: 'Rows', type: 'counter', xKey: '', yKeys: ['total'] } });
    expect(mocks.saveQuery).toHaveBeenCalledWith(expect.objectContaining({ id: 'home-auto-sales__row_count', metricChartId: 'c' }));
  });
});
