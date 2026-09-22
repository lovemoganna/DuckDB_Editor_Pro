import { create } from 'zustand';
import { ColumnInfo, ColumnStats } from '../../types';

export interface SchemaViewState {
  newColName: string;
  newColType: string;
  selectedColStats: { col: string; stats: ColumnStats } | null;
  renameTableName: string;
  isRenaming: boolean;
  editColumnMode: { colName: string; newName: string; newType: string } | null;
  structureViewMode: 'list' | 'graph';
  fullSchemaTree: Record<string, ColumnInfo[]>;

  // Actions
  setNewColName: (v: string) => void;
  setNewColType: (v: string) => void;
  setSelectedColStats: (v: { col: string; stats: ColumnStats } | null) => void;
  setRenameTableName: (v: string) => void;
  setIsRenaming: (v: boolean) => void;
  setEditColumnMode: (v: { colName: string; newName: string; newType: string } | null) => void;
  setStructureViewMode: (v: 'list' | 'graph') => void;
  setFullSchemaTree: (tree: Record<string, ColumnInfo[]> | ((prev: Record<string, ColumnInfo[]>) => Record<string, ColumnInfo[]>)) => void;
  resetFormState: () => void;
}

export const useSchemaViewStore = create<SchemaViewState>((set) => ({
  newColName: '',
  newColType: 'VARCHAR',
  selectedColStats: null,
  renameTableName: '',
  isRenaming: false,
  editColumnMode: null,
  structureViewMode: 'list',
  fullSchemaTree: {},

  setNewColName: (newColName) => set({ newColName }),
  setNewColType: (newColType) => set({ newColType }),
  setSelectedColStats: (selectedColStats) => set({ selectedColStats }),
  setRenameTableName: (renameTableName) => set({ renameTableName }),
  setIsRenaming: (isRenaming) => set({ isRenaming }),
  setEditColumnMode: (editColumnMode) => set({ editColumnMode }),
  setStructureViewMode: (structureViewMode) => set({ structureViewMode }),
  setFullSchemaTree: (tree) => set(state => ({
    fullSchemaTree: typeof tree === 'function' ? tree(state.fullSchemaTree) : tree
  })),
  resetFormState: () => set({
    newColName: '',
    newColType: 'VARCHAR',
    renameTableName: '',
    isRenaming: false,
    editColumnMode: null,
    selectedColStats: null,
  }),
}));
