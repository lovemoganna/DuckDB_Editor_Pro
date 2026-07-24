import React from 'react';
import { Tab } from '../../types';

interface AppSidebarProps {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
  tables: string[];
  currentTable: string | null;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  handleTableSelect: (name: string) => void;
  handleCreateDemo: () => void;
  setShowCreateModal: (v: boolean) => void;
  setShowImportModal: (v: boolean) => void;
  setShowExportModal: (v: boolean) => void;
  setShowSettingsModal: (v: boolean) => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  tables,
  currentTable,
  activeTab,
  setActiveTab,
  handleTableSelect,
  handleCreateDemo,
  setShowCreateModal,
  setShowImportModal,
  setShowExportModal,
  setShowSettingsModal,
}) => {
  return (
    <div
      aria-label="Sidebar navigation"
      className={`flex-shrink-0 bg-monokai-sidebar border-r border-monokai-accent flex flex-col transition-all duration-300 ${
        isSidebarCollapsed ? 'w-14' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div
        className={`p-3 border-b border-monokai-accent/50 bg-gradient-to-r from-monokai-bg to-monokai-sidebar flex items-center gap-3 cursor-pointer hover:from-monokai-accent/20 hover:to-monokai-accent/10 transition-all ${
          isSidebarCollapsed ? 'justify-center' : ''
        }`}
        onClick={() => setActiveTab(Tab.DASHBOARD)}
        title="Dashboard"
      >
        <span className="text-2xl">🦆</span>
        {!isSidebarCollapsed && (
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-monokai-green truncate">DuckDB Pro</span>
            <span className="text-[9px] text-monokai-comment bg-monokai-bg/60 px-1.5 py-0.5 rounded w-fit">
              WASM Edition
            </span>
          </div>
        )}
      </div>

      {/* Navigation Content */}
      <div className="flex-1 overflow-y-auto p-3 bg-monokai-bg">
        {!isSidebarCollapsed && (
          <>
            {/* Tables Section */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs uppercase text-monokai-yellow font-bold tracking-wider flex items-center gap-2">
                  <span>📋</span> Tables
                </h3>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="text-monokai-green hover:text-white w-6 h-6 flex items-center justify-center rounded-full hover:bg-monokai-green/20 transition-all text-lg"
                  title="Create Table"
                >
                  +
                </button>
              </div>
              <div className="bg-monokai-surface/50 rounded-lg border border-monokai-accent/30 p-2 min-h-[80px]">
                {tables.length > 0 ? (
                  <ul className="space-y-0.5">
                    {tables.map(t => (
                      <li key={t}>
                        <button
                          onClick={() => handleTableSelect(t)}
                          className={`w-full text-left px-2 py-1.5 rounded text-sm font-mono truncate transition-all ${
                            currentTable === t && activeTab !== Tab.DASHBOARD
                              ? 'bg-monokai-pink text-white shadow-sm'
                              : 'text-monokai-fg hover:bg-monokai-accent/60 hover:pl-3'
                          }`}
                        >
                          ▸ {t}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-monokai-comment italic mb-3">No tables yet</p>
                    <button
                      onClick={handleCreateDemo}
                      className="text-xs text-monokai-blue hover:text-white underline decoration-dotted underline-offset-2"
                    >
                      Load Demo Data
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Data I/O Section */}
            <div className="mb-6">
              <h3 className="text-xs uppercase text-monokai-cyan font-bold mb-3 tracking-wider flex items-center gap-2">
                <span>⚡</span> Data I/O
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex flex-col items-center justify-center gap-1 py-3 px-2 border border-dashed border-monokai-blue/40 rounded-lg text-xs text-monokai-blue hover:bg-monokai-blue/15 hover:border-monokai-blue transition-all"
                >
                  <span className="text-xl">📥</span> Import
                </button>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="flex flex-col items-center justify-center gap-1 py-3 px-2 border border-dashed border-monokai-orange/40 rounded-lg text-xs text-monokai-orange hover:bg-monokai-orange/15 hover:border-monokai-orange transition-all"
                >
                  <span className="text-xl">📤</span> Export
                </button>
              </div>
            </div>

            {/* System Status Card */}
            <div className="mb-4">
              <div className="bg-gradient-to-br from-monokai-bg to-monokai-sidebar/50 rounded-lg p-3 border border-monokai-accent/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-monokai-comment uppercase tracking-wider">Database</span>
                  <span className="text-[10px] font-bold text-monokai-green flex items-center gap-1">● Ready</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-monokai-comment">Total Tables</span>
                  <span className="text-sm font-bold text-monokai-fg">{tables.length}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Collapsed Mode Shortcuts */}
        {isSidebarCollapsed && (
          <div className="flex flex-col gap-3 items-center mt-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-monokai-green text-xl hover:scale-110 transition-transform"
              title="Create Table"
            >
              +
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="text-monokai-blue text-xl hover:scale-110 transition-transform"
              title="Import Data"
            >
              📥
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="text-monokai-orange text-xl hover:scale-110 transition-transform"
              title="Export DB"
            >
              📤
            </button>
          </div>
        )}
      </div>

      {/* Footer / Toggle */}
      <div className="p-2 border-t border-monokai-accent bg-monokai-bg flex flex-col gap-2 justify-center">
        {!isSidebarCollapsed && (
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-monokai-comment hover:text-white hover:bg-monokai-accent rounded transition-colors w-full"
          >
            <span>⚙️</span> Settings & Backup
          </button>
        )}
        {isSidebarCollapsed && (
          <button
            onClick={() => setShowSettingsModal(true)}
            className="text-lg hover:text-white text-monokai-comment"
            title="Settings"
          >
            ⚙️
          </button>
        )}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="text-monokai-comment hover:text-white text-center w-full"
        >
          {isSidebarCollapsed ? '»' : '«'}
        </button>
      </div>
    </div>
  );
};
