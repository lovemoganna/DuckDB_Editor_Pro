import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Database, Table2, ChevronDown, ChevronRight, RefreshCw, Loader2, CheckSquare, Square, Wand2, Info } from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { SchemaInferencePanel } from './SchemaInferencePanel';
import { useOntologyStore, ontologyActions } from '../../hooks/useOntologyStore';

// Stable store reference: only used for dispatch, not state
const useStoreDispatch = () => {
  const { dispatch } = useOntologyStore();
  return dispatch;
};

interface TableInfo {
  name: string;
  columns: { name: string; type: string; pk?: boolean; notnull?: boolean }[];
  rowCount?: number;
}

interface SchemaTabProps {
  onSchemaChange?: (selectedTables: string[]) => void;
  selectedTables?: string[];
  onInfer?: (tables: TableInfo[]) => void;
  onInferDone?: () => void;
  autoInfer?: boolean;
}

export const SchemaTab: React.FC<SchemaTabProps> = ({
  onSchemaChange,
  selectedTables: externalSelectedTables,
  onInfer,
  onInferDone,
  autoInfer,
}) => {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [internalSelectedTables, setInternalSelectedTables] = useState<Set<string>>(new Set());
  const [inferPanelOpen, setInferPanelOpen] = useState(false);
  const storeDispatch = useStoreDispatch();

  const isControlled = externalSelectedTables !== undefined;
  const selectedTables = isControlled
    ? new Set(externalSelectedTables)
    : internalSelectedTables;

  const loadTables = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const tableNames = await duckDBService.getTables();
      const tableInfos: TableInfo[] = [];
      for (const name of tableNames) {
        const cols = await duckDBService.getTableSchema(name);
        tableInfos.push({
          name,
          columns: cols.map((c: any) => ({
            name: c.name,
            type: c.type || 'VARCHAR',
            pk: !!c.pk,
            notnull: !!c.notnull,
          })),
        });
      }
      setTables(tableInfos);
    } catch (e) {
      console.error('Failed to load tables', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const prevSelectedRef = useRef<string[] | undefined>(undefined);
  const prevOnSchemaChangeRef = useRef(onSchemaChange);
  const prevAutoInferRef = useRef(autoInfer);

  useEffect(() => {
    prevOnSchemaChangeRef.current = onSchemaChange;
  }, [onSchemaChange]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  // Fire onSchemaChange whenever selection changes (both controlled and uncontrolled modes)
  useEffect(() => {
    const arr = Array.from(selectedTables);
    const prev = prevSelectedRef.current;
    const isSame =
      prev !== undefined &&
      prev.length === arr.length &&
      prev.every((v, i) => v === arr[i]);

    if (!isSame) {
      prevSelectedRef.current = arr;
      prevOnSchemaChangeRef.current?.(arr);
    }
  }, [selectedTables]);

  // When autoInfer fires (transition false → true), immediately propagate selection to parent
  // so D3GraphView receives updated selectedTables and the graph can filter properly.
  useEffect(() => {
    if (!autoInfer || tables.length === 0) return;
    // Detect first trigger: prevAutoInferRef starts as undefined/false.
    // Skip if already been through this effect (prevAutoInferRef was set to true).
    if (prevAutoInferRef.current === true) return;
    prevAutoInferRef.current = true;

    const allTableNames = tables.map(t => t.name);
    setInternalSelectedTables(new Set(allTableNames));
    setInferPanelOpen(true);
    // Notify parent immediately so OntologyPanel.selectedTables updates
    onSchemaChange?.(allTableNames);
  }, [autoInfer, tables]); // omit onSchemaChange — it causes spurious re-triggers

  const handleToggleTable = (name: string) => {
    const next = new Set(selectedTables);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    if (isControlled) {
      onSchemaChange?.(Array.from(next));
    } else {
      setInternalSelectedTables(next);
    }
  };

  const toggleExpand = (name: string) => {
    setExpandedTables(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set(tables.map(t => t.name));
    if (isControlled) {
      onSchemaChange?.(Array.from(all));
    } else {
      setInternalSelectedTables(all);
    }
  };

  const selectNone = () => {
    if (isControlled) {
      onSchemaChange?.([]);
    } else {
      setInternalSelectedTables(new Set());
    }
  };

  const handleInfer = () => {
    if (selectedTables.size === 0) return;
    setInferPanelOpen(true);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-monokai-comment">
        <Loader2 className="w-8 h-8 animate-spin text-monokai-cyan" />
        <span className="text-sm">正在扫描数据库表...</span>
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-monokai-comment">
        <Database className="w-10 h-10 text-monokai-comment/30" />
        <span className="text-sm">数据库中没有找到表</span>
        <button
          onClick={() => loadTables(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs rounded-lg bg-monokai-sidebar/40 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-sidebar/60 transition-colors border border-monokai-border/30"
        >
          <RefreshCw className="w-3.5 h-3.5" /> 重新扫描
        </button>
      </div>
    );
  }

  return (
    <>
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 shrink-0 border-b border-monokai-border/50 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-monokai-cyan" />
            <span className="text-sm font-semibold text-monokai-fg">数据库表</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-monokai-sidebar/60 text-monokai-comment">{tables.length}</span>
          </div>
          <button
            onClick={() => loadTables(true)}
            title="刷新表列表"
            className="p-1.5 rounded-lg text-monokai-comment/50 hover:text-monokai-cyan hover:bg-monokai-cyan/10 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="h-px bg-monokai-border/20" />
        {/* Selection controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={selectAll}
            className="text-[11px] px-3 py-1 rounded-full bg-monokai-sidebar/40 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-sidebar/70 border border-monokai-border/30 transition-all"
          >
            全选
          </button>
          <button
            onClick={selectNone}
            className="text-[11px] px-3 py-1 rounded-full bg-monokai-sidebar/40 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-sidebar/70 border border-monokai-border/30 transition-all"
          >
            取消
          </button>
          {selectedTables.size > 0 && (
            <span className="text-[11px] px-3 py-1 rounded-full bg-monokai-cyan/10 text-monokai-cyan border border-monokai-cyan/30 font-medium">
              已选 {selectedTables.size}
            </span>
          )}
        </div>
      </div>

      {/* Table list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 space-y-2">
        {tables.map(table => {
          const isSelected = selectedTables.has(table.name);
          const isExpanded = expandedTables.has(table.name);

          return (
            <div key={table.name} className={`rounded-xl border transition-all ${
              isSelected
                ? 'border-monokai-cyan/40 bg-monokai-cyan/[0.05]'
                : 'border-monokai-border/40 bg-monokai-surface hover:border-monokai-border/70'
            }`}>
              {/* Table header row: checkbox + name + badge + expand chevron */}
              <div className="flex items-center gap-2 px-3 py-2.5">

                {/* Selection checkbox — standalone clickable with visible affordance */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleToggleTable(table.name); }}
                  className="shrink-0 p-0.5 rounded-md border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-monokai-cyan/60"
                  style={{
                    borderColor: isSelected ? 'rgba(56,189,248,0.5)' : 'transparent',
                    background: isSelected ? 'rgba(56,189,248,0.08)' : 'transparent',
                  }}
                  title={isSelected ? `取消选择「${table.name}」` : `选择「${table.name}」`}
                >
                  {isSelected
                    ? <CheckSquare className="w-4 h-4 text-monokai-cyan" />
                    : <Square className="w-4 h-4 text-monokai-comment/40" />
                  }
                </button>

                {/* Table icon + name — clicking the row toggles selection */}
                <button
                  type="button"
                  onClick={() => handleToggleTable(table.name)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-monokai-cyan/40 rounded"
                >
                  <Table2 className="w-3.5 h-3.5 shrink-0 text-monokai-comment/60" />
                  <span className={`text-xs font-medium flex-1 truncate ${isSelected ? 'text-monokai-cyan' : 'text-monokai-fg'}`}>
                    {table.name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-monokai-sidebar/60 text-monokai-comment shrink-0">
                    {table.columns.length} 列
                  </span>
                </button>

                {/* Expand chevron — clicking toggles expand only, no side effects */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleExpand(table.name); }}
                  className="shrink-0 p-1 rounded-md text-monokai-comment/40 hover:text-monokai-comment hover:bg-monokai-sidebar/40 transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-monokai-cyan/40"
                  title={isExpanded ? '收起' : '展开'}
                >
                  {isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5" />
                    : <ChevronRight className="w-3.5 h-3.5" />
                  }
                </button>
              </div>

              {/* Column details */}
              {isExpanded && (
                <div className="border-t border-monokai-border/30 px-3 py-2.5 bg-monokai-sidebar/20 space-y-1">
                  {table.columns.map(col => (
                    <div key={col.name} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-monokai-sidebar/40 transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-monokai-comment/30" />
                      <span className="text-[11px] font-mono text-monokai-fg truncate flex-1">{col.name}</span>
                      {col.pk && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-monokai-yellow/10 text-monokai-yellow shrink-0">PK</span>
                      )}
                      <span className="text-[10px] text-monokai-comment/60 shrink-0 font-mono">{col.type}</span>
                      {col.notnull && (
                        <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-monokai-red/10 text-monokai-red/70 shrink-0">NOT NULL</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer CTA */}
      {selectedTables.size > 0 && (
        <div className="shrink-0 px-3 py-3 border-t border-monokai-border/50 bg-monokai-sidebar/20">
          <div className="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-xl bg-monokai-sidebar/30 border border-monokai-border/30">
            <Info className="w-3.5 h-3.5 text-monokai-cyan shrink-0" />
            <span className="text-[11px] text-monokai-comment leading-relaxed">
              已选择 <strong className="text-monokai-cyan">{selectedTables.size}</strong> 张表，可推断本体结构
            </span>
          </div>
          <button
            onClick={handleInfer}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold
              bg-monokai-amethyst/15 text-monokai-amethyst hover:bg-monokai-amethyst/25
              border border-monokai-amethyst/25 transition-all shadow-[0_0_14px_rgba(189,174,255,0.18)]"
          >
            <Wand2 className="w-4 h-4" />
            推断本体结构
          </button>
        </div>
      )}
    </div>
    {inferPanelOpen && (
      <SchemaInferencePanel
        tables={tables.filter(t => selectedTables.has(t.name))}
        onClose={() => setInferPanelOpen(false)}
        onInferDone={() => {
          onInferDone?.();
          storeDispatch(ontologyActions.setActiveTab('graph'));
        }}
      />
    )}
    </>
  );
};

export default SchemaTab;
