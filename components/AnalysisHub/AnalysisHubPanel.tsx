/**
 * AnalysisHubPanel — Root container for Analysis Hub
 * 
 * Three main views:
 * - Library: SQL template library (from Abstraction)
 * - Analysis: Data analysis pipeline (from SchemaGenerator)
 * - Lab: Sandbox SQL execution (from Abstraction)
 * 
 * Handbook is accessible as a view mode within the Analysis view.
 */

import React, { useEffect } from 'react';
import { Layers, FlaskConical, Activity, Download, Database } from 'lucide-react';
import { useAnalysisHubStore } from '../../hooks/store/analysisHubStore';
import { LibraryView } from '../Abstraction/LibraryView';
import { AbstractionLab } from '../Abstraction/AbstractionLab';
import { AbstractionForm } from '../Abstraction/AbstractionForm';
import { AbstractionExportDialog } from '../Abstraction/AbstractionExportDialog';
import { SchemaGenerator } from '../SchemaGenerator';
import { SAMPLE_ABSTRACTION_TABLES } from '../../utils/abstractionSeedData';
import { saveAbstractionTable } from '../../services/libraryStorage';
import { AbstractionTable } from '../../types';

interface AnalysisHubPanelProps {
  initialSql?: string;
  onInsertSql?: (sql: string) => void;
}

export const AnalysisHubPanel: React.FC<AnalysisHubPanelProps> = ({
  initialSql,
  onInsertSql,
}) => {
  const activeMainTab = useAnalysisHubStore(s => s.activeMainTab);
  const setActiveMainTab = useAnalysisHubStore(s => s.setActiveMainTab);
  const showForm = useAnalysisHubStore(s => s.showForm);
  const editingTable = useAnalysisHubStore(s => s.editingTable);
  const closeForm = useAnalysisHubStore(s => s.closeForm);
  const addTable = useAnalysisHubStore(s => s.addTable);
  const loadTables = useAnalysisHubStore(s => s.loadTables);
  const showExportDialog = useAnalysisHubStore(s => s.showExportDialog);
  const setShowExportDialog = useAnalysisHubStore(s => s.setShowExportDialog);
  const domains = useAnalysisHubStore(s => s.domains);
  const updateTable = useAnalysisHubStore(s => s.updateTable);
  const loadSessions = useAnalysisHubStore(s => s.loadSessions);

  useEffect(() => {
    loadTables();
    loadSessions();
  }, [loadTables, loadSessions]);

  const handleFillSamples = async () => {
    for (const sample of SAMPLE_ABSTRACTION_TABLES) {
      try { await saveAbstractionTable(sample); } catch { /* ignore duplicates */ }
    }
    await loadTables();
  };

  const handleFormSubmit = async (data: Omit<AbstractionTable, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingTable && editingTable.id === '__prefill__') {
      await addTable(data);
    } else if (editingTable) {
      await updateTable({ ...editingTable, ...data });
    } else {
      await addTable(data);
    }
    closeForm();
  };

  const tabs = [
    { id: 'library' as const, label: '模板库', icon: Layers },
    { id: 'analysis' as const, label: '数据分析', icon: Activity },
    { id: 'lab' as const, label: '实验台', icon: FlaskConical },
  ];

  return (
    <div className="h-full flex flex-col bg-monokai-bg font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-monokai-surface border-b border-monokai-border">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-monokai-amethyst to-monokai-blue flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-monokai-fg tracking-tight">Analysis Hub</span>
          </div>

          <nav className="flex items-center gap-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveMainTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all duration-150 ${
                    activeMainTab === tab.id
                      ? 'bg-monokai-amethyst/15 text-monokai-amethyst font-medium'
                      : 'text-monokai-fg-muted hover:text-monokai-fg hover:bg-monokai-bg'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {activeMainTab === 'library' && (
            <button
              onClick={handleFillSamples}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-monokai-fg-muted hover:text-monokai-fg bg-monokai-bg hover:bg-monokai-sidebar rounded-md transition-colors"
              title="填充示例数据"
            >
              <Database className="w-3.5 h-3.5" />
              填充示例
            </button>
          )}
          <button
            onClick={() => setShowExportDialog(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-monokai-fg-muted hover:text-monokai-fg bg-monokai-bg hover:bg-monokai-sidebar rounded-md transition-colors"
            title="导入/导出"
          >
            <Download className="w-3.5 h-3.5" />
            导入导出
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {activeMainTab === 'library' && (
          <LibraryView onInsertSql={onInsertSql} />
        )}
        {activeMainTab === 'analysis' && (
          <div className="h-full overflow-auto">
            <SchemaGenerator
              onExecuteSql={onInsertSql}
              onRefresh={undefined}
            />
          </div>
        )}
        {activeMainTab === 'lab' && (
          <AbstractionLab initialSql={initialSql} onInsertSql={onInsertSql} />
        )}
      </main>

      {/* Dialogs */}
      <AbstractionForm
        isOpen={showForm}
        onClose={closeForm}
        onSubmit={handleFormSubmit}
        editingTable={editingTable}
        domains={domains}
      />
      <AbstractionExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
      />
    </div>
  );
};

export default AnalysisHubPanel;
