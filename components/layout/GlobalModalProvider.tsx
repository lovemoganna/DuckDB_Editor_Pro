import React from 'react';
import { Notification } from '../../types';
import { CreateTableModal } from '../CreateTableModal';
import { DuplicateTableModal } from '../DuplicateTableModal';
import { RowDetailPanel } from '../RowDetailPanel';
import { SettingsModal } from '../SettingsModal';
import { ImportWizard } from '../ImportWizard';
import { ExportModal } from '../ExportModal';

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
  return (
    <>
      <CreateTableModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTableCreated={handleTableSelect}
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
      <SettingsModal
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
      <ImportWizard
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => {}}
        onRefreshTables={refreshTables}
        onNotify={addNotification}
      />
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />

      {/* Toast Notifications */}
      <div className="fixed bottom-10 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`pointer-events-auto px-4 py-3 rounded shadow-lg border-l-4 text-sm font-bold flex items-center gap-2 animate-[slideIn_0.3s_ease-out] ${
              n.type === 'success'
                ? 'bg-monokai-sidebar border-monokai-green text-monokai-green'
                : n.type === 'error'
                ? 'bg-monokai-sidebar border-monokai-pink text-monokai-pink'
                : 'bg-monokai-sidebar border-monokai-blue text-monokai-blue'
            }`}
          >
            <span>{n.type === 'success' ? '✓' : n.type === 'error' ? '✕' : 'ℹ'}</span>
            {n.message}
          </div>
        ))}
      </div>
    </>
  );
};
