import React, { useState } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Database,
  Table,
  Eye,
  FileCode,
  Plus,
  Radio,
  Server,
  Layers,
  Link,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useOntologyWorkspaceStore } from '../../hooks/useOntologyWorkspaceStore';

export const OntologyExplorer: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSchemasOpen, setIsSchemasOpen] = useState(true);
  const [isTablesOpen, setIsTablesOpen] = useState(true);
  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState(true);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);

  const {
    nodes,
    mappings,
    setFocusEntity,
    loadTableDataPreview,
    setSelectedDrawerTab,
    catalogTables,
    revisions,
  } = useOntologyWorkspaceStore();

  const defaultSchemaTables = [
    { name: 'classes', qualifiedName: 'main.classes', count: '48.6K' },
    { name: 'properties', qualifiedName: 'main.properties', count: '87.1K' },
    { name: 'relations', qualifiedName: 'main.relations', count: '12.3K' },
    { name: 'individuals', qualifiedName: 'main.individuals', count: '6.8K' },
    { name: 'annotations', qualifiedName: 'main.annotations', count: '5.6K' },
    { name: 'imports', qualifiedName: 'main.imports', count: '3.2K' },
    { name: 'rule_engine', qualifiedName: 'main.rule_engine', count: '1.2K' },
    { name: 'change_log', qualifiedName: 'main.change_log', count: '890' },
    { name: 'snapshots', qualifiedName: 'main.snapshots', count: '420' },
    { name: 'system_config', qualifiedName: 'main.system_config', count: '320' },
  ];

  const liveSchemaTables = catalogTables.filter((table) => table.schema === 'main').map((table) => ({
    name: table.tableName,
    qualifiedName: `${table.schema}.${table.tableName}`,
    count: table.rowCount > 1000 ? `${(table.rowCount / 1000).toFixed(1)}K` : table.rowCount.toLocaleString(),
  }));

  const schemaTables = liveSchemaTables.length > 0 ? liveSchemaTables : defaultSchemaTables;

  const defaultQueryHistory = [
    { sql: 'ontology_overview.sql', time: '10:35' },
    { sql: 'class_hierarchy.sql', time: '10:19' },
    { sql: 'property_usage.sql', time: '10:11' },
    { sql: 'individual_summary.sql', time: '09:48' },
    { sql: 'graph_explore.sql', time: '09:30' },
  ];

  const liveQueryHistory = revisions.slice(0, 8).map((revision) => {
    const timestamp = revision.createdAt ? new Date(revision.createdAt) : null;
    return {
      sql: `${revision.version} · ${revision.message || 'Ontology revision'}`,
      time: timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : revision.author,
    };
  });

  const queryHistory = liveQueryHistory.length > 0 ? liveQueryHistory : defaultQueryHistory;

  const matchedClasses = searchTerm.trim()
    ? nodes.filter(
        (n) =>
          n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          n.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  return (
    <aside
      aria-label="本体导航浏览区"
      className="flex h-full w-[220px] min-w-[220px] max-w-[220px] 2xl:w-[260px] 2xl:min-w-[260px] 2xl:max-w-[260px] flex-col border-r border-monokai-border bg-monokai-bg font-sans text-xs select-none text-monokai-comment"
    >
      {/* Header title */}
      <div className="flex h-9 items-center justify-between border-b border-monokai-border px-3 font-semibold text-monokai-fg tracking-wide">
        <span className="text-[11px] uppercase tracking-wider text-monokai-comment">Explorer</span>
      </div>

      {/* Search Filter */}
      <div className="p-2 border-b border-monokai-border">
        <div className="flex items-center gap-1.5 rounded bg-monokai-elevated px-2.5 py-1.5 border border-monokai-border text-monokai-comment focus-within:border-monokai-cyan transition-colors">
          <Search className="h-3.5 w-3.5 shrink-0 text-monokai-comment" />
          <input
            type="text"
            placeholder="Search classes, properties..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-[11px] text-monokai-fg placeholder-[var(--monokai-comment)] outline-none"
          />
        </div>
      </div>

      {/* Navigation Tree Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-3">
        {/* Search Results Filter View if searching */}
        {searchTerm.trim() ? (
          <div className="space-y-1">
            <div className="px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider text-monokai-comment">
              Matched Concepts ({matchedClasses.length})
            </div>
            {matchedClasses.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  setFocusEntity(n.name);
                }}
                className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-monokai-elevated text-monokai-fg-muted hover:text-white cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-monokai-purple" />
                  <span className="font-semibold text-xs">{n.label}</span>
                </div>
                <span className="text-[10px] font-mono text-monokai-comment">{n.abstractionLevel}</span>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* 1. CONNECTIONS */}
            <div>
              <div className="flex items-center justify-between px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider text-monokai-comment">
                <span>Connections</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-monokai-elevated text-monokai-fg-muted transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-monokai-accent" />
                  <span className="font-medium text-monokai-fg">Local Connection</span>
                </div>
                <span className="text-[10px] font-mono text-monokai-comment">DuckDB 1.0.0</span>
              </div>
            </div>

            {/* 2. SCHEMAS */}
            <div>
              <button
                onClick={() => setIsSchemasOpen(!isSchemasOpen)}
                className="flex w-full items-center justify-between px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider text-monokai-comment hover:text-monokai-fg-muted"
              >
                <div className="flex items-center gap-1">
                  {isSchemasOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3 text-monokai-comment" />}
                  <span>Schemas ({new Set(catalogTables.map((table) => table.schema)).size})</span>
                </div>
              </button>

              {isSchemasOpen && (
                <div className="ml-2 pl-2 border-l border-monokai-hover space-y-1 mt-1">
                  {/* main schema */}
                  <div className="flex items-center gap-1.5 px-1.5 py-1 text-monokai-cyan font-mono text-[11px]">
                    <Database className="h-3.5 w-3.5" />
                    <span>main</span>
                  </div>

                  {/* Tables nested */}
                  <div className="ml-2 space-y-0.5">
                    <button
                      onClick={() => setIsTablesOpen(!isTablesOpen)}
                      className="flex w-full items-center gap-1 px-1.5 py-1 text-monokai-comment hover:text-monokai-fg text-[11px]"
                    >
                      {isTablesOpen ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                      <span className="font-medium">Tables ({schemaTables.length})</span>
                    </button>

                    {isTablesOpen && (
                      <div className="ml-3 pl-1.5 border-l border-monokai-border space-y-0.5">
                        {schemaTables.map((t) => (
                          <div
                            key={t.name}
                            onClick={() => {
                              setFocusEntity(t.qualifiedName);
                              void loadTableDataPreview(t.qualifiedName);
                              setSelectedDrawerTab('dataPreview');
                            }}
                            className="flex items-center justify-between px-1.5 py-0.5 rounded hover:bg-monokai-hover text-monokai-comment hover:text-monokai-fg-muted cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <Table className="h-3 w-3 text-monokai-cyan" />
                              <span className="truncate">{t.name}</span>
                            </div>
                            <span className="text-[9.5px] font-mono text-monokai-comment">{t.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {isTablesOpen && schemaTables.length === 0 && <div className="ml-3 px-2 py-1 text-[10px] text-monokai-comment">No physical tables in main.</div>}

                    {/* Views */}
                    <div className="flex items-center justify-between px-1.5 py-1 text-monokai-comment hover:text-monokai-fg text-[11px] cursor-pointer">
                      <div className="flex items-center gap-1.5">
                        <Eye className="h-3 w-3 text-monokai-purple" />
                        <span>Views (4)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. DATA SOURCES / MAPPINGS */}
            <div>
              <button
                onClick={() => setIsDataSourcesOpen(!isDataSourcesOpen)}
                className="flex w-full items-center justify-between px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider text-monokai-comment hover:text-monokai-fg-muted"
              >
                <div className="flex items-center gap-1">
                  {isDataSourcesOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3 text-monokai-comment" />}
                  <span>Data Sources / Mappings</span>
                </div>
              </button>

              {isDataSourcesOpen && (
                <div className="space-y-1 mt-1">
                  {mappings.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        loadTableDataPreview(m.sourceTable);
                        setSelectedDrawerTab('mappings');
                      }}
                      className="group flex flex-col px-2 py-1.5 rounded hover:bg-monokai-elevated border border-transparent hover:border-monokai-border transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium text-monokai-cyan group-hover:underline truncate text-[11px]">
                          {m.sourceTable}
                        </span>
                        <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-monokai-accent/20 text-monokai-accent font-mono">
                          Mapped
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-monokai-comment mt-0.5">
                        <span>{m.sourceTable.startsWith('ext_') ? 'External API' : 'Physical Table'}</span>
                        <span className="font-mono">{(m.sampleRowsCount / 1000000).toFixed(1)}M rows</span>
                      </div>
                    </div>
                  ))}

                  {/* Add data source button */}
                  <button
                    onClick={() => {
                      setSelectedDrawerTab('mappings');
                    }}
                    className="flex items-center gap-1.5 w-full px-2 py-1.5 mt-1 rounded border border-dashed border-monokai-border hover:border-monokai-cyan text-monokai-cyan hover:bg-monokai-cyan/10 text-[11px] font-medium transition-colors justify-center"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Data Source</span>
                  </button>
                </div>
              )}
            </div>

            {/* 4. QUERY HISTORY */}
            <div>
              <button
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className="flex w-full items-center justify-between px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider text-monokai-comment hover:text-monokai-fg-muted"
              >
                <div className="flex items-center gap-1">
                  {isHistoryOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3 text-monokai-comment" />}
                  <span>Query History</span>
                </div>
              </button>

              {isHistoryOpen && (
                <div className="space-y-0.5 mt-1">
                  {queryHistory.map((q) => (
                    <div
                      key={q.sql}
                      className="flex items-center justify-between px-2 py-1 rounded hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-fg-muted text-[10.5px] cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <FileCode className="h-3 w-3 text-monokai-comment" />
                        <span className="truncate font-mono">{q.sql}</span>
                      </div>
                      <span className="text-[9.5px] font-mono text-monokai-comment">{q.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
