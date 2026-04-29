/**
 * AbstractionPanel — 数据抽象模块根容器
 *
 * 职责：
 * - 顶部 Tab 导航（模板库 / 实验台）
 * - 全局工具按钮（导入导出、填充示例）
 * - 表单弹窗和导入导出对话框挂载点
 */

import React, { useEffect } from 'react';
import {
  Layers,
  FlaskConical,
  Download,
  Database,
} from 'lucide-react';
import { useAnalysisHubStore } from '../../hooks/store/analysisHubStore';
import { LibraryView } from './LibraryView';
import { AbstractionLab } from './AbstractionLab';
import { AbstractionForm } from './AbstractionForm';
import { AbstractionExportDialog } from './AbstractionExportDialog';
import { SAMPLE_ABSTRACTION_TABLES } from '../../utils/abstractionSeedData';
import { saveAbstractionTable } from '../../services/libraryStorage';
import { AbstractionTable } from '../../types';

interface AbstractionPanelProps {
  initialSql?: string;
  onInsertSql?: (sql: string) => void;
}

export const AbstractionPanel: React.FC<AbstractionPanelProps> = ({
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

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const handleFillSamples = async () => {
    for (const sample of SAMPLE_ABSTRACTION_TABLES) {
      try { await saveAbstractionTable(sample); } catch { /* ignore duplicates */ }
    }
    await loadTables();
  };

  const handleFormSubmit = async (data: Omit<AbstractionTable, 'id' | 'createdAt' | 'updatedAt'>) => {
    // 处理 AI 预填充数据的特殊情况（editingTable.id === '__prefill__'）
    if (editingTable && editingTable.id === '__prefill__') {
      await addTable(data);
    } else if (editingTable) {
      await updateTable({ ...editingTable, ...data });
    } else {
      await addTable(data);
    }
    closeForm();
  };

  return (
    <div className="h-full flex flex-col bg-monokai-bg font-sans">
      {/* 顶部导航栏 */}
      <header className="flex items-center justify-between px-5 py-3 bg-monokai-surface border-b border-monokai-border">
        {/* 左侧：Logo + Tab */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-monokai-purple to-monokai-blue flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-monokai-fg tracking-tight">数据抽象</span>
          </div>

          <nav className="flex items-center gap-1">
            <button
              onClick={() => setActiveMainTab('library')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all duration-150 ${
                activeMainTab === 'library'
                  ? 'bg-monokai-purple/15 text-monokai-purple font-medium'
                  : 'text-monokai-fg-muted hover:text-monokai-fg hover:bg-monokai-bg'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              模板库
            </button>
            <button
              onClick={() => setActiveMainTab('lab')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all duration-150 ${
                activeMainTab === 'lab'
                  ? 'bg-monokai-purple/15 text-monokai-purple font-medium'
                  : 'text-monokai-fg-muted hover:text-monokai-fg hover:bg-monokai-bg'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              实验台
            </button>
          </nav>
        </div>

        {/* 右侧：工具按钮 */}
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

      {/* 内容区域 */}
      <main className="flex-1 overflow-hidden">
        {activeMainTab === 'library' ? (
          <LibraryView onInsertSql={onInsertSql} />
        ) : (
          <AbstractionLab initialSql={initialSql} onInsertSql={onInsertSql} />
        )}
      </main>

      {/* 弹窗 */}
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

export default AbstractionPanel;
