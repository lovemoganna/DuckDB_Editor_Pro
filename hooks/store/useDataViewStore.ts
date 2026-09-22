import { create } from 'zustand';
import { ColumnInfo } from '../../types';
import { duckDBService } from '../../services/duckdbService';

let activeDataRequestId = 0;

export interface DataViewState {
  dataViewMode: 'grid' | 'profile';
  tableData: any[];
  tableColumns: string[];
  hiddenColumns: Set<string>;
  loadingData: boolean;
  pagination: { limit: number; offset: number; total: number };
  schema: ColumnInfo[];
  sortConfig: { key: string; direction: 'ASC' | 'DESC' }[];
  filterQuery: string;
  selectedRows: Set<any>;
  profileData: any[];
  expandedRowIdx: number | null;
  showColMenu: boolean;
  editingCell: { rowIdx: number; col: string; val: any } | null;

  // Actions
  setDataViewMode: (mode: 'grid' | 'profile') => void;
  setTableData: (rows: any[]) => void;
  setTableColumns: (columns: string[]) => void;
  setLoadingData: (loading: boolean) => void;
  setPagination: (pagination: { limit: number; offset: number; total: number }) => void;
  setSchema: (schema: ColumnInfo[]) => void;
  setProfileData: (profile: any[]) => void;
  setHiddenColumns: (cols: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  toggleColumnVisibility: (col: string) => void;
  setShowColMenu: (v: boolean) => void;
  setFilterQuery: (query: string) => void;
  setEditingCell: (cell: { rowIdx: number; col: string; val: any } | null) => void;
  setExpandedRowIdx: (idx: number | null) => void;
  setSelectedRows: (rows: Set<any> | ((prev: Set<any>) => Set<any>)) => void;
  setSortConfig: (config: { key: string; direction: 'ASC' | 'DESC' }[]) => void;
  
  // Data Fetching
  fetchTableData: (tableName: string, offset: number, limit: number, currentSort?: any, currentFilter?: string) => Promise<void>;
  fetchProfileData: (tableName: string) => Promise<void>;
  handlePageChange: (tableName: string, newOffset: number) => Promise<void>;
  handleSort: (tableName: string, key: string, shiftKey?: boolean) => Promise<void>;
}

export const useDataViewStore = create<DataViewState>((set, get) => ({
  dataViewMode: 'grid',
  tableData: [],
  tableColumns: [],
  hiddenColumns: new Set<string>(),
  loadingData: false,
  pagination: { limit: 50, offset: 0, total: 0 },
  schema: [],
  sortConfig: [],
  filterQuery: '',
  selectedRows: new Set<any>(),
  profileData: [],
  expandedRowIdx: null,
  showColMenu: false,
  editingCell: null,

  setDataViewMode: (mode) => set({ dataViewMode: mode }),
  setTableData: (tableData) => set({ tableData }),
  setTableColumns: (tableColumns) => set({ tableColumns }),
  setLoadingData: (loadingData) => set({ loadingData }),
  setPagination: (pagination) => set({ pagination }),
  setSchema: (schema) => set({ schema }),
  setProfileData: (profileData) => set({ profileData }),
  setHiddenColumns: (cols) => set(state => ({
    hiddenColumns: typeof cols === 'function' ? cols(state.hiddenColumns) : cols
  })),
  toggleColumnVisibility: (col) => set(state => {
    const next = new Set(state.hiddenColumns);
    if (next.has(col)) next.delete(col);
    else next.add(col);
    return { hiddenColumns: next };
  }),
  setShowColMenu: (v) => set({ showColMenu: v }),
  setFilterQuery: (filterQuery) => set({ filterQuery }),
  setEditingCell: (editingCell) => set({ editingCell }),
  setExpandedRowIdx: (expandedRowIdx) => set({ expandedRowIdx }),
  setSelectedRows: (rows) => set(state => ({
    selectedRows: typeof rows === 'function' ? rows(state.selectedRows) : rows
  })),
  setSortConfig: (sortConfig) => set({ sortConfig }),

  fetchTableData: async (tableName, offset, limit, currentSort = get().sortConfig, currentFilter = get().filterQuery) => {
    const requestId = ++activeDataRequestId;
    set({ loadingData: true });
    try {
      const whereClause = currentFilter.trim() ? `WHERE ${currentFilter}` : '';
      const countQuery = `SELECT COUNT(*) as c FROM "${tableName}" ${whereClause}`;
      let total = 0;
      try {
        const countRes = await duckDBService.query(countQuery);
        total = Number(countRes[0].c);
      } catch (e: any) { throw new Error(`Invalid Filter: ${e.message}`); }

      const schemaInfo = await duckDBService.getTableSchema(tableName);

      let query = `SELECT * FROM "${tableName}" ${whereClause}`;
      if (currentSort && currentSort.length > 0) {
        const orderStr = currentSort.map((s: any) => `"${s.key}" ${s.direction}`).join(', ');
        query += ` ORDER BY ${orderStr}`;
      } else {
        const pk = schemaInfo.find((c: any) => c.pk);
        if (pk) query += ` ORDER BY "${pk.name}" ASC`;
      }
      query += ` LIMIT ${limit} OFFSET ${offset}`;

      const data = await duckDBService.readQuery(query);
      if (requestId !== activeDataRequestId) return;
      set({
        tableData: data,
        schema: schemaInfo,
        tableColumns: schemaInfo.map((c: any) => c.name),
        pagination: { limit, offset, total },
        selectedRows: new Set(),
      });
    } catch (e: any) {
      if (requestId !== activeDataRequestId) return;
      set({ tableData: [] });
      throw e;
    } finally {
      if (requestId === activeDataRequestId) {
        set({ loadingData: false });
      }
    }
  },

  fetchProfileData: async (tableName) => {
    const requestId = ++activeDataRequestId;
    set({ loadingData: true });
    try {
      const profile = await duckDBService.query(`SUMMARIZE SELECT * FROM "${tableName}"`);
      if (requestId === activeDataRequestId) {
        set({ profileData: profile });
      }
    } finally {
      if (requestId === activeDataRequestId) {
        set({ loadingData: false });
      }
    }
  },

  handlePageChange: async (tableName, newOffset) => {
    const { pagination, fetchTableData } = get();
    if (newOffset < 0 || (pagination.total > 0 && newOffset >= pagination.total)) return;
    await fetchTableData(tableName, newOffset, pagination.limit);
  },

  handleSort: async (tableName, key, shiftKey) => {
    const { sortConfig, pagination, fetchTableData } = get();
    let newSort: { key: string; direction: 'ASC' | 'DESC' }[] = [];
    const existingIdx = sortConfig.findIndex(s => s.key === key);

    if (shiftKey) {
      if (existingIdx > -1) {
        const current = sortConfig[existingIdx];
        if (current.direction === 'ASC') {
          newSort = [...sortConfig];
          newSort[existingIdx] = { key, direction: 'DESC' };
        } else {
          newSort = sortConfig.filter(s => s.key !== key);
        }
      } else {
        newSort = [...sortConfig, { key, direction: 'ASC' }];
      }
    } else {
      if (existingIdx > -1 && sortConfig.length === 1) {
        const current = sortConfig[0];
        if (current.direction === 'ASC') {
          newSort = [{ key, direction: 'DESC' }];
        } else {
          newSort = [];
        }
      } else {
        newSort = [{ key, direction: 'ASC' }];
      }
    }

    set({ sortConfig: newSort });
    await fetchTableData(tableName, 0, pagination.limit, newSort);
  },
}));
