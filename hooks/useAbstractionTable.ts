/**
 * useAbstractionTable — 抽象表状态管理 Hook（Zustand Wrapper 版本）
 *
 * 核心职责：封装 Zustand store 的 library 相关操作
 * 所有状态直接来自 store，hook 只负责调用 store actions
 */

import { useCallback, useEffect } from 'react';
import { useAnalysisHubStore, useSelectedTable, useFilteredTables } from './store/analysisHubStore';
import { AbstractionTable } from '../types';

export const useAbstractionTable = () => {
  // 直接从 store 读取状态（零 props drilling）
  const tables = useAnalysisHubStore(s => s.tables);
  const selectedTable = useSelectedTable();
  const showForm = useAnalysisHubStore(s => s.showForm);
  const editingTable = useAnalysisHubStore(s => s.editingTable);
  const copiedId = useAnalysisHubStore(s => s.copiedId);
  const isLoading = useAnalysisHubStore(s => s.isLoading);
  const domains = useAnalysisHubStore(s => s.domains);
  const filteredTables = useFilteredTables();

  // Store actions
  const loadTables = useAnalysisHubStore(s => s.loadTables);
  const selectTable = useAnalysisHubStore(s => s.selectTable);
  const addTable = useAnalysisHubStore(s => s.addTable);
  const updateTable = useAnalysisHubStore(s => s.updateTable);
  const removeTable = useAnalysisHubStore(s => s.removeTable);
  const toggleFavorite = useAnalysisHubStore(s => s.toggleFavorite);
  const setCopiedId = useAnalysisHubStore(s => s.setCopiedId);
  const openAddForm = useAnalysisHubStore(s => s.openAddForm);
  const openEditForm = useAnalysisHubStore(s => s.openEditForm);
  const closeForm = useAnalysisHubStore(s => s.closeForm);

  // 初始化加载
  useEffect(() => {
    loadTables();
  }, [loadTables]);

  // CRUD 回调
  const handleAdd = useCallback(async (
    table: Omit<AbstractionTable, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    return await addTable(table);
  }, [addTable]);

  const handleUpdate = useCallback(async (table: AbstractionTable) => {
    return await updateTable(table);
  }, [updateTable]);

  const handleDelete = useCallback(async (id: string) => {
    await removeTable(id);
  }, [removeTable]);

  const handleToggleFavorite = useCallback(async (id: string) => {
    await toggleFavorite(id);
  }, [toggleFavorite]);

  // 复制
  const handleCopy = useCallback((id: string) => {
    setCopiedId(id);
  }, [setCopiedId]);

  // 选择
  const handleSelect = useCallback((table: AbstractionTable | null) => {
    selectTable(table?.id || null);
  }, [selectTable]);

  // 打开编辑表单
  const handleOpenEdit = useCallback((table: AbstractionTable) => {
    openEditForm(table);
  }, [openEditForm]);

  // 打开新增表单
  const handleOpenAdd = useCallback(() => {
    openAddForm();
  }, [openAddForm]);

  // 关闭表单
  const handleCloseForm = useCallback(() => {
    closeForm();
  }, [closeForm]);

  return {
    // 状态（来自 store）
    tables,
    selectedTable,
    showForm,
    editingTable,
    copiedId,
    isLoading,
    domains,
    filteredTables,

    // 操作
    loadTables,
    handleAdd,
    handleUpdate,
    handleDelete,
    handleToggleFavorite,
    handleCopy,
    handleSelect,
    handleOpenEdit,
    handleOpenAdd,
    handleCloseForm,
  };
};
