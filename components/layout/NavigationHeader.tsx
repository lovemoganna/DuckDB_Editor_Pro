import React from 'react';
import { Tab } from '../../types';

interface NavigationHeaderProps {
  activeTab: Tab;
  currentTable: string | null;
  setActiveTab: (tab: Tab) => void;
  fetchTableData: (tableName: string, offset: number, limit: number) => void;
  refreshAudit: () => void;
}

export const NavigationHeader: React.FC<NavigationHeaderProps> = ({
  activeTab,
  currentTable,
  setActiveTab,
  fetchTableData,
  refreshAudit,
}) => {
  return (
    <div className="h-14 border-b border-monokai-accent/50 flex items-center px-4 gap-3 bg-monokai-sidebar shrink-0 overflow-x-auto">
      {/* Group 1: Core Database Views */}
      <div className="flex items-center gap-1">
        {[
          { id: Tab.DASHBOARD, label: 'Dashboard', icon: '🏠' },
          { id: Tab.DATA, label: 'Data', icon: '📊' },
          { id: Tab.STRUCTURE, label: 'Schema', icon: '📐' },
          { id: Tab.SQL, label: 'SQL', icon: '📝' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === Tab.DATA && currentTable) {
                fetchTableData(currentTable, 0, 50);
              }
            }}
            className={`h-9 px-3 flex items-center gap-2 text-sm font-medium transition-all rounded-md relative ${
              activeTab === tab.id
                ? 'bg-monokai-bg text-monokai-fg'
                : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg/30'
            }`}
          >
            <span>{tab.icon}</span> {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-monokai-green rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="w-px h-8 bg-monokai-accent/30 shrink-0" />

      {/* Group 2: AI & Analytics Hub */}
      <div className="flex items-center gap-1">
        {[
          { id: Tab.ANALYSIS_HUB, label: 'Analysis Hub', icon: '🤖' },
          { id: Tab.METRICS, label: 'Metrics', icon: '📈' },
          { id: Tab.AUDIT, label: 'Logs', icon: '📜' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === Tab.AUDIT) refreshAudit();
            }}
            className={`h-9 px-3 flex items-center gap-2 text-sm font-medium transition-all rounded-md relative ${
              activeTab === tab.id
                ? 'bg-monokai-bg text-monokai-fg'
                : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg/30'
            }`}
          >
            <span>{tab.icon}</span> {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-monokai-amethyst rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="w-px h-8 bg-monokai-accent/30 shrink-0" />

      {/* Group 3: Extensions & Advanced Capabilities */}
      <div className="flex items-center gap-1">
        {[
          { id: Tab.EXTENSIONS, label: 'Plugins', icon: '🧩' },
          { id: Tab.TUTORIALS, label: 'Learn', icon: '🎓' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`h-9 px-3 flex items-center gap-2 text-sm font-medium transition-all rounded-md relative ${
              activeTab === tab.id
                ? 'bg-monokai-bg text-monokai-fg'
                : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg/30'
            }`}
          >
            <span>{tab.icon}</span> {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-monokai-blue rounded-full" />
            )}
          </button>
        ))}
        <button
          onClick={() => setActiveTab(Tab.AI_SKILLS)}
          className={`h-9 px-3 flex items-center gap-2 text-sm font-medium transition-all rounded-md relative font-sans ${
            activeTab === Tab.AI_SKILLS
              ? 'bg-monokai-bg text-monokai-fg'
              : 'text-monokai-amethyst hover:text-monokai-fg hover:bg-monokai-amethyst/20'
          }`}
        >
          <span>⚡</span> AI Skills
        </button>
        <button
          onClick={() => setActiveTab(Tab.LIBRARY)}
          className={`h-9 px-3 flex items-center gap-2 text-sm font-medium transition-all rounded-md relative font-sans ${
            activeTab === Tab.LIBRARY
              ? 'bg-monokai-bg text-monokai-fg'
              : 'text-monokai-blue hover:text-monokai-fg hover:bg-monokai-blue/20'
          }`}
        >
          <span>📚</span> Library
        </button>
        <button
          onClick={() => setActiveTab(Tab.ONTOLOGY)}
          className={`h-9 px-3 flex items-center gap-2 text-sm font-medium transition-all rounded-md relative ${
            activeTab === Tab.ONTOLOGY
              ? 'bg-monokai-bg text-monokai-fg'
              : 'text-monokai-amethyst hover:text-monokai-fg hover:bg-monokai-amethyst/20'
          }`}
        >
          <span>🕸️</span> Ontology
        </button>
        <button
          onClick={() => setActiveTab(Tab.COMPOSITIONAL_DEDUCTION)}
          className={`h-9 px-3 flex items-center gap-2 text-sm font-medium transition-all rounded-md relative ${
            activeTab === Tab.COMPOSITIONAL_DEDUCTION
              ? 'bg-monokai-bg text-monokai-fg'
              : 'text-monokai-cyan hover:text-monokai-fg hover:bg-monokai-cyan/20'
          }`}
        >
          <span>🧪</span> Deduction
        </button>
      </div>
      <div className="flex-1" />
    </div>
  );
};
