import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { duckDBService } from '../../services/duckdbService';
import { useDataViewStore } from './useDataViewStore';
import { useAppStore } from './useAppStore';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('useDataViewStore public state contract', () => {
  beforeEach(() => {
    vi.spyOn(duckDBService,'getCurrentCatalogAndSchema').mockResolvedValue({catalog:'memory',schema:'main'});
    useAppStore.setState({currentDatabase:'memory',currentTable:null,activeDataset:null});
    useDataViewStore.setState({
      tableData: [],
      tableColumns: [],
      loadingData: false,
      pagination: { limit: 50, offset: 0, total: 0 },
      schema: [],
      profileData: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lets schema and data mutation flows replace their derived view state', () => {
    const store = useDataViewStore.getState();
    const schema = [{ name: 'id', type: 'INTEGER', nullable: false, pk: true }];

    store.setTableData([{ id: 1 }]);
    store.setTableColumns(['id']);
    store.setLoadingData(true);
    store.setPagination({ limit: 25, offset: 25, total: 75 });
    store.setSchema(schema);
    store.setProfileData([{ column_name: 'id' }]);

    expect(useDataViewStore.getState()).toMatchObject({
      tableData: [{ id: 1 }],
      tableColumns: ['id'],
      loadingData: true,
      pagination: { limit: 25, offset: 25, total: 75 },
      schema,
      profileData: [{ column_name: 'id' }],
    });
  });

  it('ignores a slower response after the user switches tables', async () => {
    const slowRows = deferred<any[]>();

    vi.spyOn(duckDBService, 'query').mockResolvedValue([{ c: 1 }]);
    vi.spyOn(duckDBService, 'getTableSchema').mockImplementation(async tableName => [
      { name: `${tableName}_id`, type: 'INTEGER', notnull: true, dflt_value: null, pk: true },
    ]);
    vi.spyOn(duckDBService, 'readQuery')
      .mockImplementationOnce(() => slowRows.promise)
      .mockResolvedValueOnce([{ newer_id: 2 }]);

    const oldRequest = useDataViewStore.getState().fetchTableData('older', 0, 50);
    await vi.waitFor(() => expect(duckDBService.readQuery).toHaveBeenCalledTimes(1));

    await useDataViewStore.getState().fetchTableData('newer', 0, 50);
    slowRows.resolve([{ older_id: 1 }]);
    await oldRequest;

    expect(useDataViewStore.getState()).toMatchObject({
      tableData: [{ newer_id: 2 }],
      tableColumns: ['newer_id'],
      loadingData: false,
    });
  });

  it('keeps table rows when profile fetch races in parallel', async () => {
    const tableRows = deferred<any[]>();
    const profileRows = deferred<any[]>();

    vi.spyOn(duckDBService, 'query').mockImplementation(async (sql: string) => {
      if (sql.startsWith('SUMMARIZE')) return profileRows.promise;
      return [{ c: 1 }];
    });
    vi.spyOn(duckDBService, 'getTableSchema').mockResolvedValue([
      { name: 'id', type: 'INTEGER', notnull: true, dflt_value: null, pk: true },
    ]);
    vi.spyOn(duckDBService, 'readQuery').mockImplementation(() => tableRows.promise);

    const tablePromise = useDataViewStore.getState().fetchTableData('orders', 0, 50, [], '');
    const profilePromise = useDataViewStore.getState().fetchProfileData('orders');

    profileRows.resolve([{ column_name: 'id' }]);
    await profilePromise;

    tableRows.resolve([{ id: 42 }]);
    await tablePromise;

    expect(useDataViewStore.getState()).toMatchObject({
      tableData: [{ id: 42 }],
      tableColumns: ['id'],
      profileData: [{ column_name: 'id' }],
      filterQuery: '',
      loadingData: false,
    });
  });

  it('shares applied filters across modules without limiting the dataset to the current grid page',async()=>{
    useAppStore.setState({currentTable:'orders'});
    vi.spyOn(duckDBService,'query').mockResolvedValue([{c:9}]);
    vi.spyOn(duckDBService,'getTableSchema').mockResolvedValue([{name:'id',type:'INTEGER',notnull:true,dflt_value:null,pk:true}]);
    vi.spyOn(duckDBService,'readQuery').mockResolvedValue([{id:8}]);
    await useDataViewStore.getState().fetchTableData('orders',5,1,[],"status='completed'");
    expect(useAppStore.getState().activeDataset?.sql).toBe('SELECT * FROM "memory"."main"."orders" WHERE status=\'completed\'');
    expect(useAppStore.getState().activeDataset?.error).toBeUndefined();
    expect(useDataViewStore.getState().pagination.total).toBe(9);
    vi.mocked(duckDBService.query).mockRejectedValue(new Error('missing field'));
    await expect(useDataViewStore.getState().fetchTableData('orders',0,1,[],'missing=1')).rejects.toThrow();
    expect(useAppStore.getState().activeDataset?.error).toContain('missing field');
    expect(useAppStore.getState().activeDataset?.sql).toContain('missing=1');
  });
});
