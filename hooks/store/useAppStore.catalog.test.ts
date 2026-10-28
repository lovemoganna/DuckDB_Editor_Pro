import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore, type CurrentDatasetContext } from './useAppStore';

const tableDataset: CurrentDatasetContext = {
  id: 'table:memory.main.selected', name: 'selected', kind: 'table', version: 1,
  catalog: 'memory', schema: 'main', table: 'selected',
  sql: 'SELECT * FROM selected', fields: [],
};

describe('table catalog selection reconciliation', () => {
  beforeEach(() => useAppStore.setState({
    tables: ['selected', 'other'], currentTable: 'selected', activeDataset: tableDataset,
  }));

  it('clears the removed table and its dataset after a catalog refresh', () => {
    useAppStore.getState().setTables(['other']);
    expect(useAppStore.getState().currentTable).toBeNull();
    expect(useAppStore.getState().activeDataset).toBeNull();
    expect(useAppStore.getState().tables).toEqual(['other']);
  });

  it('preserves a selected table that remains in the catalog', () => {
    useAppStore.getState().setTables(['other', 'selected', 'new_table']);
    expect(useAppStore.getState().currentTable).toBe('selected');
    expect(useAppStore.getState().activeDataset).toEqual(tableDataset);
  });

  it('preserves independent query results when an unrelated selected table disappears', () => {
    const queryDataset = { ...tableDataset, id: 'query:1', kind: 'query' as const, table: undefined, sql: 'SELECT 42' };
    useAppStore.setState({ activeDataset: queryDataset });
    useAppStore.getState().setTables([]);
    expect(useAppStore.getState().currentTable).toBeNull();
    expect(useAppStore.getState().activeDataset).toEqual(queryDataset);
  });

  it('does not clear a dataset belonging to another table', () => {
    const otherDataset = { ...tableDataset, id: 'table:other', table: 'other' };
    useAppStore.setState({ activeDataset: otherDataset });
    useAppStore.getState().setTables(['other']);
    expect(useAppStore.getState().activeDataset).toEqual(otherDataset);
  });
});
