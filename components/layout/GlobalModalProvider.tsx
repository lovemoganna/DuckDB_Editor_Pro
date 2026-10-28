import React, { useState, useEffect } from 'react';
import { Notification, Tab } from '../../types';
import { CreateTableModal } from '../CreateTableModal';
import { CreateViewModal } from '../CreateViewModal';
import { ClearWorkspaceModal } from '../ClearWorkspaceModal';
import { DuplicateTableModal } from '../DuplicateTableModal';
import { RowDetailPanel } from '../RowDetailPanel';
import { DeferredTool } from '../ui/DeferredTool';
const SettingsModal = React.lazy(() => import('../SettingsModal').then(module => ({ default: module.SettingsModal })));
const ImportWizard = React.lazy(() => import('../ImportWizard').then(module => ({ default: module.ImportWizard })));
const ExportModal = React.lazy(() => import('../ExportModal').then(module => ({ default: module.ExportModal })));
const WorkspaceBackupModal = React.lazy(() => import('../WorkspaceBackupModal').then(module => ({ default: module.WorkspaceBackupModal })));
const ProjectManagerModal = React.lazy(() => import('../ProjectManagerModal').then(module => ({ default: module.ProjectManagerModal })));
import { duckDBService } from '../../services/duckdbService';
import { useConfirmDialog } from '../ui/ConfirmDialog';
import { useAppStore } from '../../hooks/store/useAppStore';

interface GlobalModalProviderProps {
  showCreateModal: boolean;
  setShowCreateModal: (v: boolean) => void;
  showDuplicateModal: boolean;
  setShowDuplicateModal: (v: boolean) => void;
  showSettingsModal: boolean;
  setShowSettingsModal: (v: boolean) => void;
  showImportModal: boolean;
  setShowImportModal: (v: boolean) => void;
  showExportModal: boolean;
  setShowExportModal: (v: boolean) => void;
  currentTable: string | null;
  tableData: any[];
  expandedRowIdx: number | null;
  setExpandedRowIdx: (idx: number | null) => void;
  notifications: Notification[];
  aiProvider: string;
  aiApiKey: string;
  aiBaseUrl: string;
  aiModel: string;
  availableModels: { id: string; name: string }[];
  loadingModels: boolean;
  handleTableSelect: (name: string) => void;
  refreshTables: () => Promise<void>;
  addNotification: (message: string, type?: 'info' | 'success' | 'error') => void;
  setAiProvider: (v: string) => void;
  setAiApiKey: (v: string) => void;
  setAiBaseUrl: (v: string) => void;
  setAiModel: (v: string) => void;
  setAvailableModels: (models: { id: string; name: string }[]) => void;
  setLoadingModels: (v: boolean) => void;
  handleExportWorkspace: () => void;
  handleImportWorkspace: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const GlobalModalProvider: React.FC<GlobalModalProviderProps> = ({
  showCreateModal,
  setShowCreateModal,
  showDuplicateModal,
  setShowDuplicateModal,
  showSettingsModal,
  setShowSettingsModal,
  showImportModal,
  setShowImportModal,
  showExportModal,
  setShowExportModal,
  currentTable,
  tableData,
  expandedRowIdx,
  setExpandedRowIdx,
  notifications,
  aiProvider,
  aiApiKey,
  aiBaseUrl,
  aiModel,
  availableModels,
  loadingModels,
  handleTableSelect,
  refreshTables,
  addNotification,
  setAiProvider,
  setAiApiKey,
  setAiBaseUrl,
  setAiModel,
  setAvailableModels,
  setLoadingModels,
  handleExportWorkspace,
  handleImportWorkspace,
}) => {
  const { confirm } = useConfirmDialog();
  const [showWorkspaceBackupModal, setShowWorkspaceBackupModal] = useState(false);
  const [showCreateViewModal, setShowCreateViewModal] = useState(false);
  const [showClearWorkspaceModal, setShowClearWorkspaceModal] = useState(false);
  const showProjectManagerModal = useAppStore((state) => state.showProjectManagerModal);
  const setShowProjectManagerModal = useAppStore((state) => state.setShowProjectManagerModal);
  const [currentProject, setCurrentProject] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenWorkspaceBackup = () => setShowWorkspaceBackupModal(true);
    const handleOpenExportDatabase = () => setShowExportModal(true);
    const handleOpenSettings = () => setShowSettingsModal(true);
    const handleOpenCreateView = () => setShowCreateViewModal(true);
    const handleOpenCreateTable = () => setShowCreateModal(true);
    const handleOpenImport = () => setShowImportModal(true);
    const handleOpenClearWorkspace = () => setShowClearWorkspaceModal(true);
    const handleOpenProjectManager = () => setShowProjectManagerModal(true);

    const handleClearAllViews = async () => {
      const ok = await confirm({
        title: '清空所有视图',
        message: '⚠️ 确定要清空所有分析视图吗？此操作将彻底删除所有自定义视图！',
        variant: 'danger',
      });
      if (!ok) return;
      try {
        const count = await duckDBService.clearViews();
        addNotification(`已清空 ${count} 个视图`, 'success');
        await refreshTables();
        window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));
      } catch (e: any) {
        addNotification(`清空视图失败: ${e.message}`, 'error');
      }
    };

    const handleClearAllMacros = async () => {
      const ok = await confirm({
        title: '清空宏与自定义函数',
        message: '⚠️ 确定要清空所有宏与自定义函数吗？此操作将彻底删除所有已定义宏！',
        variant: 'danger',
      });
      if (!ok) return;
      try {
        const count = await duckDBService.clearMacros();
        addNotification(`已清空 ${count} 个宏与自定义函数`, 'success');
        window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));
      } catch (e: any) {
        addNotification(`清空宏失败: ${e.message}`, 'error');
      }
    };

    window.addEventListener('open-workspace-backup-modal', handleOpenWorkspaceBackup);
    window.addEventListener('open-export-database-modal', handleOpenExportDatabase);
    window.addEventListener('open-settings-modal', handleOpenSettings);
    window.addEventListener('open-create-view-modal', handleOpenCreateView);
    window.addEventListener('open-create-table-modal', handleOpenCreateTable);
    window.addEventListener('open-import-modal', handleOpenImport);
    window.addEventListener('duckdb-open-import', handleOpenImport);
    window.addEventListener('open-clear-workspace-modal', handleOpenClearWorkspace);
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setShowProjectManagerModal(!useAppStore.getState().showProjectManagerModal);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('open-project-manager-modal', handleOpenProjectManager);
    window.addEventListener('clear-all-views', handleClearAllViews);
    window.addEventListener('clear-all-macros', handleClearAllMacros);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('open-workspace-backup-modal', handleOpenWorkspaceBackup);
      window.removeEventListener('open-export-database-modal', handleOpenExportDatabase);
      window.removeEventListener('open-settings-modal', handleOpenSettings);
      window.removeEventListener('open-create-view-modal', handleOpenCreateView);
      window.removeEventListener('open-create-table-modal', handleOpenCreateTable);
      window.removeEventListener('open-import-modal', handleOpenImport);
      window.removeEventListener('duckdb-open-import', handleOpenImport);
      window.removeEventListener('open-clear-workspace-modal', handleOpenClearWorkspace);
      window.removeEventListener('open-project-manager-modal', handleOpenProjectManager);
      window.removeEventListener('clear-all-views', handleClearAllViews);
      window.removeEventListener('clear-all-macros', handleClearAllMacros);
    };
  }, [setShowCreateModal, setShowExportModal, setShowImportModal, setShowSettingsModal, addNotification, refreshTables]);

  const handleProjectSelected = async (name: string) => {
    const catalog = name || 'memory';
    setCurrentProject(catalog);
    useAppStore.getState().setCurrentDatabase(catalog);
    useAppStore.getState().setCurrentTable(null);
    useAppStore.getState().setTables([]);
    await refreshTables();
    window.dispatchEvent(
      new CustomEvent('duckdb-database-changed', {
        detail: { catalog, schema: 'main' },
      }),
    );
    addNotification(
      catalog === 'memory'
        ? '已切换至 memory 临时分析空间'
        : `已切换至数据库「${catalog}」——表、视图与仪表盘已隔离`,
      'success',
    );
  };

  return (
    <>
      <CreateTableModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTableCreated={handleTableSelect}
        onRefreshTables={refreshTables}
        onNotify={addNotification}
        onOpenSqlInTab={(sql) => {
          useAppStore.getState().setPendingSql(sql);
          useAppStore.getState().setActiveTab(Tab.SQL);
        }}
      />
      <CreateViewModal
        isOpen={showCreateViewModal}
        onClose={() => setShowCreateViewModal(false)}
        onViewCreated={handleTableSelect}
        onRefreshTables={refreshTables}
        onNotify={addNotification}
      />
      <ClearWorkspaceModal
        isOpen={showClearWorkspaceModal}
        onClose={() => setShowClearWorkspaceModal(false)}
        onRefreshTables={refreshTables}
        onNotify={addNotification}
      />
      <DuplicateTableModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        sourceTable={currentTable}
        onTableCreated={handleTableSelect}
        onRefreshTables={refreshTables}
        onNotify={addNotification}
      />
      <RowDetailPanel
        isOpen={expandedRowIdx !== null}
        expandedRowIdx={expandedRowIdx}
        tableData={tableData}
        onClose={() => setExpandedRowIdx(null)}
        onNavigatePrev={() => setExpandedRowIdx(Math.max(0, (expandedRowIdx ?? 0) - 1))}
        onNavigateNext={() => setExpandedRowIdx(Math.min(tableData.length - 1, (expandedRowIdx ?? 0) + 1))}
      />
      <DeferredTool open={showSettingsModal} onClose={() => setShowSettingsModal(false)}><SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        aiProvider={aiProvider}
        aiApiKey={aiApiKey}
        aiBaseUrl={aiBaseUrl}
        aiModel={aiModel}
        availableModels={availableModels}
        loadingModels={loadingModels}
        onSetAiProvider={setAiProvider}
        onSetAiApiKey={setAiApiKey}
        onSetAiBaseUrl={setAiBaseUrl}
        onSetAiModel={setAiModel}
        onSetAvailableModels={setAvailableModels}
        onSetLoadingModels={setLoadingModels}
        onNotify={addNotification}
        onExportWorkspace={handleExportWorkspace}
        onImportWorkspace={handleImportWorkspace}
      />
      </DeferredTool>
      <DeferredTool open={showWorkspaceBackupModal} onClose={() => setShowWorkspaceBackupModal(false)}><WorkspaceBackupModal
        isOpen={showWorkspaceBackupModal}
        onClose={() => setShowWorkspaceBackupModal(false)}
        onExportWorkspace={handleExportWorkspace}
        onImportWorkspaceSuccess={refreshTables}
      />
      </DeferredTool>
      <DeferredTool open={showImportModal} onClose={() => setShowImportModal(false)}><ImportWizard
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={async (createdTables?: string[]) => {
          await refreshTables();
          if (createdTables && createdTables.length > 0) {
            handleTableSelect(createdTables[0]);
            useAppStore.getState().setActiveTab(Tab.DATA);
          }
        }}
        onRefreshTables={refreshTables}
        onNotify={addNotification}
      />
      </DeferredTool>
      <DeferredTool open={showExportModal} onClose={() => setShowExportModal(false)}><ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
      </DeferredTool>
      <DeferredTool open={showProjectManagerModal} onClose={() => setShowProjectManagerModal(false)}><ProjectManagerModal
        isOpen={showProjectManagerModal}
        onClose={() => setShowProjectManagerModal(false)}
        onProjectSelected={handleProjectSelected}
        currentProject={currentProject}
      />
      </DeferredTool>
    </>
  );
};

