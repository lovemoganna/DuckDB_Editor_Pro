import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Square,
  Sparkles,
  AlignLeft,
  Activity,
  Save,
  Plus,
  Minus,
  X,
  FileCode,
  ChevronDown,
  Layers,
  History,
  Cpu,
  Copy,
  Workflow,
  ArrowDownToLine,
  ArrowUpToLine,
  Columns2,
  Maximize2,
  Check,
  Zap,
  RefreshCw,
} from 'lucide-react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { EditorView, Decoration, keymap, type DecorationSet } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';
import { sql } from '@codemirror/lang-sql';
import { autocompletion, moveCompletionSelection } from '@codemirror/autocomplete';
import { sqlAutocompleteTheme } from '../../themes/sqlAutocompleteTheme';
import {
  createSqlCompletionSource,
  sqlSchemaCache,
  type SchemaTree,
} from '../../services/sql/sqlCompletionEngine';
import { useConfirmDialog } from '../ui/ConfirmDialog';
import { format } from 'sql-formatter';
import { ResultSection } from './ResultSection';
import type { QueryResult } from '../../types';
import { querySnapshotManager } from '../../services/workbench/querySnapshotManager';
import { toastService } from '../../services/toastService';
import { DataFlowCanvas } from '../DataFlow/DataFlowCanvas';
import { useWorkflowStore } from '../../services/dataflow/workflowStore';

// ── CodeMirror State Effect & Field for DataFlow → Editor line highlight ──
const setHighlightLines = StateEffect.define<{ from: number; to: number } | null>();

const highlightLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setHighlightLines)) {
        if (e.value == null) return Decoration.none;
        const mark = Decoration.mark({ class: 'cm-dataflow-highlight' });
        return Decoration.set([mark.range(e.value.from, e.value.to)]);
      }
    }
    return deco.map(tr.changes);
  },
  provide: f => EditorView.decorations.from(f),
});


export interface SqlQueryTab {
  id: string;
  title: string;
  sql: string;
  isDirty?: boolean;
  result?: QueryResult | null;
}

interface SqlWorkspacePanelProps {
  tabs: SqlQueryTab[];
  activeTabId: string;
  catalogContext?: { catalog: string; schema: string };
  onSelectTab: (tabId: string) => void;
  onAddTab: (initialSql?: string, customTitle?: string, autoRun?: boolean) => void;
  onCloseTab: (tabId: string) => void;
  onUpdateTabSql: (tabId: string, sql: string) => void;
  onRenameTab: (tabId: string, title: string) => void;
  onExecuteQuery: (sql: string, explain?: boolean, isProfile?: boolean) => Promise<void>;
  onExecuteSelection: (selectedSql?: string) => Promise<void>;
  onStopQuery: () => void;
  isRunning: boolean;
  activeQueryResult: QueryResult | null;
  previousResult?: QueryResult | null;
  selectedColumn?: string | null;
  onSelectColumn?: (colName: string) => void;
  onExportCsv?: () => void;
  onExportParquet?: () => void;
  onExportJson?: () => void;
  onCopyClipboard?: () => void;
  onViewPreviousResult?: () => void;
  onUseQualifiedName?: (qualifiedName: string) => void;
  onApplyFilterToSql?: (filterSqlClause: string) => void;
  onApplyAggregateToSql?: (aggregateSql: string, tabTitle?: string, autoRun?: boolean) => void;
  aiMode?: 'explain' | 'analyze' | null;
  onTriggerAiExplain?: () => void;
  onTriggerAiAnalyze?: () => void;
  isDataFlowActive?: boolean;
  onSelectDataFlow?: () => void;
  onToggleDataFlow?: (active: boolean) => void;
  onNavigateToDataFlow?: () => void;
}

export const SqlWorkspacePanel: React.FC<SqlWorkspacePanelProps> = ({
  tabs,
  activeTabId,
  isDataFlowActive = false,
  onSelectDataFlow,
  onToggleDataFlow,
  onNavigateToDataFlow,
  catalogContext = { catalog: 'memory', schema: 'main' },
  onSelectTab,
  onAddTab,
  onCloseTab,
  onUpdateTabSql,
  onRenameTab,
  onExecuteQuery,
  onExecuteSelection,
  onStopQuery,
  isRunning,
  activeQueryResult,
  previousResult,
  selectedColumn,
  onSelectColumn,
  onExportCsv,
  onExportParquet,
  onExportJson,
  onCopyClipboard,
  onViewPreviousResult,
  onUseQualifiedName,
  onApplyFilterToSql,
  onApplyAggregateToSql,
  aiMode = 'explain',
  onTriggerAiExplain,
  onTriggerAiAnalyze,
}) => {
  const { confirm } = useConfirmDialog();
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  /** MECE: only one floating menu open at a time */
  type ToolbarMenu = 'run' | 'persist' | 'history' | 'flowchart' | null;
  const [openMenu, setOpenMenu] = useState<ToolbarMenu>(null);

  // DataFlow ↔ Editor layout mode: 'canvas' = full canvas, 'split' = side-by-side, 'editor' = switch back
  const [layoutMode, setLayoutMode] = useState<'editor' | 'split' | 'canvas'>(() => {
    const saved = localStorage.getItem('workbench_dataflow_layout_mode');
    return (saved === 'canvas' || saved === 'split') ? saved : 'split';
  });

  const handleToggleDataFlow = (active: boolean) => {
    if (onToggleDataFlow) {
      onToggleDataFlow(active);
    } else if (active && onSelectDataFlow) {
      onSelectDataFlow();
    }
  };

  const handleChangeLayoutMode = (mode: 'editor' | 'split' | 'canvas') => {
    if (mode === 'editor') {
      handleToggleDataFlow(false);
    } else {
      setLayoutMode(mode);
      localStorage.setItem('workbench_dataflow_layout_mode', mode);
      if (!isDataFlowActive) {
        handleToggleDataFlow(true);
      }
    }
  };

  // Persist editor / result height split ratio
  const [editorHeightPct, setEditorHeightPct] = useState<number>(() => {
    const saved = localStorage.getItem('workbench_split_pct');
    return saved ? Number(saved) : 40;
  });

  // DataFlow ↔ Editor width split ratio in split mode (default 48%)
  const [dataFlowSplitPct, setDataFlowSplitPct] = useState<number>(() => {
    const saved = localStorage.getItem('workbench_dataflow_split_pct');
    return saved ? Math.max(20, Math.min(80, Number(saved))) : 48;
  });
  const [isDraggingDataFlowDivider, setIsDraggingDataFlowDivider] = useState<boolean>(false);

  // Editor font size setting (10px default)
  const [editorFontSize, setEditorFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('workbench_editor_font_size');
    return saved ? Number(saved) : 10;
  });

  const [isDraggingDivider, setIsDraggingDivider] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const persistMenuRef = useRef<HTMLDivElement>(null);
  const runMenuRef = useRef<HTMLDivElement>(null);
  const historyPopoverRef = useRef<HTMLDivElement>(null);
  const flowchartMenuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = (menu: Exclude<ToolbarMenu, null>) => {
    setOpenMenu(prev => (prev === menu ? null : menu));
  };
  const closeMenus = () => setOpenMenu(null);

  // ── Bidirectional DataFlow → Editor highlight ──
  // When the user clicks a node in the canvas, activeSqlRange changes.
  // We dispatch a CodeMirror decoration to highlight the corresponding lines.
  const activeSqlRange = useWorkflowStore(s => s.activeSqlRange);
  const liveSyncWithSql = useWorkflowStore(s => s.liveSyncWithSql);
  const setLiveSyncWithSql = useWorkflowStore(s => s.setLiveSyncWithSql);
  const syncFromSql = useWorkflowStore(s => s.syncFromSql);

  useEffect(() => {
    const view = cmRef.current?.view;
    if (!view) return;

    if (!activeSqlRange) {
      view.dispatch({ effects: setHighlightLines.of(null) });
      return;
    }

    const doc = view.state.doc;
    const lineCount = doc.lines;
    const startLine = Math.max(1, Math.min(activeSqlRange.startLine, lineCount));
    const endLine = Math.max(startLine, Math.min(activeSqlRange.endLine, lineCount));

    const from = doc.line(startLine).from;
    const to = doc.line(endLine).to;

    view.dispatch({
      effects: setHighlightLines.of({ from, to }),
      selection: { anchor: from },
      scrollIntoView: true,
    });
  }, [activeSqlRange]);

  // Extract selected SQL from CodeMirror
  const getSelectedSql = (): string => {
    const view = cmRef.current?.view;
    if (!view) return '';
    const selection = view.state.selection.main;
    if (!selection.empty) {
      return view.state.sliceDoc(selection.from, selection.to).trim();
    }
    return '';
  };

  // Align CodeMirror with design-token SQL editor font stack
  const editorThemeExtension = useMemo(() => {
    const sqlFont = "var(--font-sql-editor) !important";
    return EditorView.theme({
      "&": {
        fontFamily: sqlFont,
        fontSize: `${editorFontSize}px !important`,
      },
      ".cm-scroller": {
        fontFamily: sqlFont,
        lineHeight: "1.55 !important",
      },
      ".cm-content": {
        fontFamily: sqlFont,
        fontSize: `${editorFontSize}px !important`,
        lineHeight: "1.55 !important",
        padding: "8px 0 !important",
      },
      ".cm-line": {
        fontFamily: sqlFont,
        fontSize: `${editorFontSize}px !important`,
        lineHeight: "1.55 !important",
      },
      ".cm-gutters": {
        fontFamily: sqlFont,
        fontSize: "11px !important",
      },
      ".cm-lineNumbers, .cm-gutterElement": {
        fontFamily: sqlFont,
        fontSize: "11px !important",
      },
      ".cm-activeLine": {
        backgroundColor: "rgba(255, 255, 255, 0.035) !important",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "var(--monokai-elevated) !important",
        color: "var(--monokai-yellow) !important",
      },
      ".cm-tooltip, .cm-tooltip-autocomplete": {
        fontFamily: sqlFont,
        fontSize: "8px !important",
      },
    });
  }, [editorFontSize]);

  // DataFlow node → editor line highlight theme
  const dataFlowHighlightTheme = useMemo(() =>
    EditorView.theme({
      '.cm-dataflow-highlight': {
        backgroundColor: 'rgba(102, 217, 239, 0.15) !important',
        outline: '1px solid rgba(102, 217, 239, 0.4)',
        borderRadius: '2px',
      },
    }),
  []);

  // ── Dynamic DuckDB Schema Perception & Live Sync ──
  const [schemaTree, setSchemaTree] = useState<SchemaTree>(() => sqlSchemaCache.getSchema());

  useEffect(() => {
    const unsubscribe = sqlSchemaCache.subscribe((newSchema) => {
      setSchemaTree(newSchema);
    });
    if (Object.keys(sqlSchemaCache.getSchema()).length === 0) {
      void sqlSchemaCache.refreshSchema();
    }
    return unsubscribe;
  }, []);

  const sqlCompletionSource = useMemo(() => {
    return createSqlCompletionSource(() => schemaTree);
  }, [schemaTree]);

  // Combined CodeMirror 6 Extensions for SQL Editor with custom Autocomplete
  const editorExtensions = useMemo(() => {
    return [
      sql(),
      autocompletion({
        override: [sqlCompletionSource],
        defaultKeymap: true,
        activateOnTyping: true,
      }),
      // M-n / M-p (Alt-n / Alt-p): move autocomplete selection like Emacs
      keymap.of([
        { key: 'Alt-n', run: moveCompletionSelection(true) },
        { key: 'Alt-p', run: moveCompletionSelection(false) },
      ]),
      sqlAutocompleteTheme,
      editorThemeExtension,
      dataFlowHighlightTheme,
      highlightLineField,
    ];
  }, [sqlCompletionSource, editorThemeExtension, dataFlowHighlightTheme]);

  const handleRunSelection = () => {
    const selected = getSelectedSql();
    if (selected) {
      onExecuteSelection(selected);
    } else {
      toastService.info('未选中文本，已自动执行当前全文 (Ctrl+Enter)');
      onExecuteQuery(activeTab?.sql || '');
    }
  };

  const handleAttemptCloseTab = async (tab: SqlQueryTab, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tab.isDirty) {
      const ok = await confirm({
        title: '关闭未保存标签',
        message: `查询标签页 "${tab.title}" 存在未保存修改，确认关闭吗？`,
        variant: 'warning',
      });
      if (ok) {
        onCloseTab(tab.id);
      }
    } else {
      onCloseTab(tab.id);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideRun = runMenuRef.current?.contains(target);
      const insidePersist = persistMenuRef.current?.contains(target);
      const insideHistory = historyPopoverRef.current?.contains(target);
      const insideFlowchart = flowchartMenuRef.current?.contains(target);
      if (!insideRun && !insidePersist && !insideHistory && !insideFlowchart) {
        closeMenus();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenus();
      // Ctrl/Cmd+S save
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (activeTab) {
          localStorage.setItem(`saved_query_${activeTab.id}`, activeTab.sql);
          onUpdateTabSql(activeTab.id, activeTab.sql);
          toastService.success(`已保存查询 "${activeTab.title}"`);
        }
      }
      // Ctrl+Shift+F format
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleFormatSql();
      }
      // Alt+D or Ctrl+Alt+D: toggle flowchart
      if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleToggleDataFlow(!isDataFlowActive);
        toastService.info(!isDataFlowActive ? '已展开流程图 (Alt+D)' : '已收起流程图 (Alt+D)');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab, isDataFlowActive]);

  const handleFormatSql = () => {
    if (!activeTab?.sql) return;
    try {
      const formatted = format(activeTab.sql, {
        language: 'duckdb' as any,
        keywordCase: 'upper',
        tabWidth: 4,
        linesBetweenQueries: 2,
      });
      onUpdateTabSql(activeTab.id, formatted);
      toastService.success('SQL 已格式化');
    } catch {
      try {
        const formatted = format(activeTab.sql, {
          language: 'sql',
          keywordCase: 'upper',
          tabWidth: 4,
        });
        onUpdateTabSql(activeTab.id, formatted);
        toastService.success('SQL 已格式化');
      } catch (e: any) {
        toastService.error(`格式化失败: ${e.message}`);
      }
    }
  };

  const handleCopySql = async () => {
    const sql = activeTab?.sql || '';
    if (!sql.trim()) {
      toastService.info('编辑器为空，无可复制内容');
      return;
    }
    try {
      await navigator.clipboard.writeText(sql);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 1800);
      toastService.success('已复制当前 SQL');
    } catch {
      toastService.error('复制失败：浏览器剪贴板权限不足');
    }
  };

  const handleAdjustFontSize = (delta: number) => {
    setEditorFontSize(prev => {
      const next = Math.max(10, Math.min(20, prev + delta));
      localStorage.setItem('workbench_editor_font_size', String(next));
      return next;
    });
  };

  const handleSaveQuery = () => {
    if (!activeTab) return;
    localStorage.setItem(`saved_query_${activeTab.id}`, activeTab.sql);
    onUpdateTabSql(activeTab.id, activeTab.sql);
    toastService.success(`已保存查询 "${activeTab.title}"`);
  };

  const handleStartRename = (tab: SqlQueryTab, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTabId(tab.id);
    setEditingTitle(tab.title);
  };

  const handleFinishRename = () => {
    if (editingTabId && editingTitle.trim()) {
      onRenameTab(editingTabId, editingTitle.trim());
    }
    setEditingTabId(null);
  };

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingDivider(true);
  };

  const handleDataFlowDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingDataFlowDivider(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingDivider || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const pct = Math.max(15, Math.min(80, (relativeY / rect.height) * 100));
      setEditorHeightPct(pct);
      localStorage.setItem('workbench_split_pct', String(pct));
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
    };

    if (isDraggingDivider) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingDataFlowDivider || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const pct = Math.max(20, Math.min(80, (relativeX / rect.width) * 100));
      setDataFlowSplitPct(pct);
      localStorage.setItem('workbench_dataflow_split_pct', String(pct));
    };

    const handleMouseUp = () => {
      setIsDraggingDataFlowDivider(false);
    };

    if (isDraggingDataFlowDivider) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDataFlowDivider]);

  const recentSnapshots = [...querySnapshotManager.getAllSnapshots()].sort((a, b) =>
    String(b.executedAt || '').localeCompare(String(a.executedAt || ''))
  );
  const lineCount = (activeTab?.sql || '').split('\n').length;
  const charCount = (activeTab?.sql || '').length;
  const renderEditorAndResults = () => (
    <div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden relative">
      {/* SQL Editor Area */}
      <div
        className="relative overflow-hidden bg-monokai-bg flex flex-col"
        style={{ height: `${editorHeightPct}%` }}
      >
        <div className="flex-1 h-full overflow-hidden font-mono" style={{ fontFamily: 'var(--font-sql-editor)' }}>
          <CodeMirror
            ref={cmRef}
            value={activeTab?.sql || ''}
            height="100%"
            theme={monokai}
            extensions={editorExtensions}
            onChange={(val) => onUpdateTabSql(activeTab.id, val)}
            onUpdate={(viewUpdate) => {
              if (viewUpdate.selectionSet && isDataFlowActive) {
                const head = viewUpdate.state.selection.main.head;
                const line = viewUpdate.state.doc.lineAt(head).number;
                useWorkflowStore.getState().syncCursorLine(line);
              }
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                  handleRunSelection();
                } else {
                  onExecuteQuery(activeTab?.sql || '');
                  if (/\b(?:create|drop|alter|truncate|insert|vacuum)\b/i.test(activeTab?.sql || '')) {
                    setTimeout(() => void sqlSchemaCache.refreshSchema(), 350);
                  }
                }
              }
            }}
            className="h-full text-[12px] font-mono custom-codemirror"
            style={{ fontSize: `${editorFontSize}px`, fontFamily: 'var(--font-sql-editor)' }}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightSpecialChars: true,
              foldGutter: true,
              autocompletion: false,
              bracketMatching: true,
              closeBrackets: true,
            }}
          />
        </div>
      </div>

      {/* Resizable Divider Bar */}
      <div
        onMouseDown={handleDividerMouseDown}
        onDoubleClick={() => {
          setEditorHeightPct(50);
          localStorage.setItem('workbench_split_pct', '50');
          toastService.info('已重置分屏为 50% / 50%');
        }}
        className={`group relative h-7 shrink-0 cursor-row-resize z-20 transition-all duration-300 flex items-center justify-between px-3.5 select-none font-sans border-y ${
          isDraggingDivider
            ? 'bg-gradient-to-r from-monokai-cyan/12 via-monokai-cyan/22 to-monokai-cyan/12 border-monokai-cyan/50 shadow-[inset_0_1px_0_rgba(102,217,239,0.25),inset_0_-1px_0_rgba(102,217,239,0.25),0_0_24px_-6px_rgba(102,217,239,0.35)]'
            : 'bg-gradient-to-b from-monokai-sidebar/85 via-monokai-bg/65 to-monokai-sidebar/85 border-monokai-border/80 hover:from-monokai-cyan/6 hover:via-monokai-elevated/55 hover:to-monokai-cyan/6 hover:border-monokai-cyan/30'
        }`}
        title="拖动调整比例，双击恢复 50/50 分屏"
        role="separator"
        aria-orientation="horizontal"
        aria-valuenow={Math.round(editorHeightPct)}
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-monokai-fg/15 to-transparent" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-monokai-bg/80 to-transparent" />

        <div className="flex items-center gap-2.5 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className={`relative w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              isDraggingDivider
                ? 'bg-monokai-cyan shadow-[0_0_10px_rgba(102,217,239,0.95)] animate-pulse scale-125'
                : 'bg-monokai-comment/45 group-hover:bg-monokai-cyan/85 group-hover:shadow-[0_0_8px_rgba(102,217,239,0.65)]'
            }`} aria-hidden="true" />
            <span className="text-[9px] uppercase tracking-[0.14em] text-monokai-comment/90 font-bold transition-colors group-hover:text-monokai-fg-muted">
              分隔条
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 pl-2.5 ml-0.5 border-l border-monokai-border/60">
            <div className="flex items-center gap-1 group/stat transition-all">
              <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded bg-monokai-surface/70 text-[9px] text-monokai-comment/90 font-mono border border-monokai-border/45 font-bold group-hover/stat:text-monokai-cyan group-hover/stat:border-monokai-cyan/40 transition-colors">L</span>
              <span className="tabular-nums font-bold text-monokai-fg-muted text-[10px] tracking-tight group-hover/stat:text-monokai-cyan transition-colors">{lineCount}</span>
            </div>
            <span className="text-monokai-comment/30 text-[9px]">·</span>
            <div className="flex items-center gap-1 group/stat transition-all">
              <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded bg-monokai-surface/70 text-[9px] text-monokai-comment/90 font-mono border border-monokai-border/45 font-bold group-hover/stat:text-monokai-cyan group-hover/stat:border-monokai-cyan/40 transition-colors">C</span>
              <span className="tabular-nums font-bold text-monokai-fg-muted text-[10px] tracking-tight group-hover/stat:text-monokai-cyan transition-colors">{charCount}</span>
            </div>
          </div>

          {isDraggingDivider && (
            <span className="px-2 py-0.5 rounded-md bg-monokai-cyan/25 text-monokai-cyan font-bold text-[10px] tabular-nums animate-in fade-in zoom-in-95 duration-150 border border-monokai-cyan/50 shadow-[0_0_14px_-2px_rgba(102,217,239,0.55)] tracking-tight">
              {Math.round(editorHeightPct)} <span className="opacity-55">/</span> {Math.round(100 - editorHeightPct)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditorHeightPct(15);
              localStorage.setItem('workbench_split_pct', '15');
            }}
            className="group/btn flex items-center gap-1.5 px-2.5 py-1 rounded-md text-monokai-comment/85 hover:text-monokai-cyan hover:bg-monokai-cyan/12 hover:border-monokai-cyan/45 hover:shadow-[0_0_0_1px_rgba(102,217,239,0.12)] transition-all duration-200 text-[10px] cursor-pointer border border-transparent font-sans font-semibold tracking-tight"
            title="最大化结果集 (折叠代码区)"
          >
            <ArrowDownToLine className="w-3 h-3 transition-all duration-200 group-hover/btn:text-monokai-cyan group-hover/btn:scale-110" />
            <span className="hidden sm:inline">最大化结果</span>
            <span className="sm:hidden">结果</span>
          </button>

          <div
            className="flex items-center justify-center w-14 h-5 rounded-md transition-all duration-200 cursor-grab active:cursor-grabbing
              bg-gradient-to-b from-monokai-bg/90 to-monokai-bg/60 border border-monokai-border/65
              group-hover:border-monokai-cyan/55 group-hover:bg-gradient-to-b group-hover:from-monokai-cyan/15 group-hover:to-monokai-cyan/5
              shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-1px_0_rgba(0,0,0,0.2)]"
            aria-hidden="true"
          >
            <div className="flex flex-col gap-[3px] items-center">
              <div className="flex gap-[2.5px]">
                {[0,1,2].map(i => (
                  <span
                    key={`top-${i}`}
                    className="w-[2.5px] h-[2.5px] rounded-full transition-all duration-200
                      bg-monokai-comment/55 group-hover:bg-monokai-cyan/95 group-hover:shadow-[0_0_4px_rgba(102,217,239,0.7)]"
                  />
                ))}
              </div>
              <div className="flex gap-[2.5px]">
                {[0,1,2].map(i => (
                  <span
                    key={`bottom-${i}`}
                    className="w-[2.5px] h-[2.5px] rounded-full transition-all duration-200
                      bg-monokai-comment/55 group-hover:bg-monokai-cyan/95 group-hover:shadow-[0_0_4px_rgba(102,217,239,0.7)]"
                  />
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditorHeightPct(85);
              localStorage.setItem('workbench_split_pct', '85');
            }}
            className="group/btn flex items-center gap-1.5 px-2.5 py-1 rounded-md text-monokai-comment/85 hover:text-monokai-green hover:bg-monokai-green/12 hover:border-monokai-green/45 hover:shadow-[0_0_0_1px_rgba(166,226,46,0.12)] transition-all duration-200 text-[10px] cursor-pointer border border-transparent font-sans font-semibold tracking-tight"
            title="最大化编辑器 (折叠结果集)"
          >
            <ArrowUpToLine className="w-3 h-3 transition-all duration-200 group-hover/btn:text-monokai-green group-hover/btn:scale-110" />
            <span className="hidden sm:inline">最大化代码</span>
            <span className="sm:hidden">代码</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-monokai-comment/75 font-sans">
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-monokai-bg/85 border border-monokai-border/75 text-[9px] font-mono text-monokai-fg-muted font-bold shadow-[inset_0_-1px_0_rgba(0,0,0,0.25)] tracking-tight">
              双击
            </span>
            <span className="text-[10px] tracking-tight font-medium">重置</span>
          </div>
          <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-md bg-gradient-to-b from-monokai-surface/65 to-monokai-surface/40 border border-monokai-border/65 text-[10px] font-mono text-monokai-fg-muted font-bold tabular-nums tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            {Math.round(editorHeightPct)}<span className="text-monokai-comment/60 ml-0.5">%</span>
          </span>
        </div>
      </div>

      {/* Results Section */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <ResultSection
          result={activeQueryResult}
          previousResult={previousResult}
          loading={isRunning}
          isStale={Boolean(activeTab?.isDirty)}
          selectedColumn={selectedColumn}
          activeTabSql={activeTab?.sql}
          activeTabTitle={activeTab?.title}
          onSelectColumn={onSelectColumn}
          onExportCsv={onExportCsv}
          onExportParquet={onExportParquet}
          onExportJson={onExportJson}
          onCopyClipboard={onCopyClipboard}
          onViewPreviousResult={onViewPreviousResult}
          onUseQualifiedName={onUseQualifiedName}
          onApplyFilterToSql={onApplyFilterToSql}
          onApplyAggregateToSql={onApplyAggregateToSql}
        />
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="flex h-full w-full flex-col bg-monokai-bg select-none text-monokai-fg font-sans">
      {/* 1. Tab Bar (Dedicated File & Query Tabs Layer) - Refined visual hierarchy */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-monokai-border bg-gradient-to-b from-monokai-sidebar via-monokai-sidebar/95 to-monokai-bg/60 px-2 select-none z-30 relative">
        {/* Subtle top hairline highlight */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-monokai-fg/8 to-transparent" />

        {/* Left: Query Tabs with smooth horizontal scroll & active indicator */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide min-w-0 flex-1 py-0.5">
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId;
            const isEditing = editingTabId === tab.id;

            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                onDoubleClick={(e) => handleStartRename(tab, e)}
                className={`group relative flex items-center gap-2 h-7 px-3 cursor-pointer transition-all duration-200 text-xs font-mono select-none shrink-0 border-x border-t ${
                  isActive
                    ? 'bg-gradient-to-b from-monokai-bg via-monokai-bg to-monokai-elevated/60 text-monokai-fg font-semibold border-t-2 border-t-monokai-yellow border-x-monokai-border shadow-[0_-1px_4px_-1px_rgba(230,219,116,0.35),inset_0_1px_0_rgba(255,255,255,0.025)]'
                    : 'bg-gradient-to-b from-monokai-surface/20 to-monokai-surface/5 text-monokai-comment hover:bg-monokai-surface/50 hover:text-monokai-fg hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] border-transparent border-b border-b-monokai-border/80 hover:border-monokai-border'
                }`}
              >
                {isActive ? (
                  <span className="relative flex items-center justify-center w-1.5 h-1.5 shrink-0">
                    <span className="absolute inset-0 bg-monokai-yellow/45 blur-[2px] rounded-full animate-pulse" />
                    <span className="relative w-1.5 h-1.5 rounded-full bg-monokai-yellow" />
                  </span>
                ) : (
                  <FileCode className="w-3.5 h-3.5 text-monokai-comment/55 shrink-0 group-hover:text-monokai-comment transition-colors" />
                )}
                {isEditing ? (
                  <input
                    type="text"
                    aria-label="重命名查询标签"
                    placeholder="查询名称"
                    autoFocus
                    value={editingTitle}
                    onChange={e => setEditingTitle(e.target.value)}
                    onBlur={handleFinishRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleFinishRename();
                      if (e.key === 'Escape') setEditingTabId(null);
                    }}
                    className="w-24 bg-monokai-surface border border-monokai-border rounded px-1.5 py-0.5 text-xs text-monokai-fg focus:outline-none"
                  />
                ) : (
                  <>
                    <span className="truncate max-w-[160px]">{tab.title}</span>
                    {tab.isDirty && (
                      <span className="w-1.5 h-1.5 rounded-full bg-monokai-yellow shrink-0" title="未保存更改" />
                    )}
                  </>
                )}

                {tabs.length > 1 && (
                  <button
                    onClick={(e) => handleAttemptCloseTab(tab, e)}
                    className="p-0.5 rounded hover:bg-monokai-surface hover:text-monokai-fg text-monokai-comment opacity-0 group-hover:opacity-100 transition-all cursor-pointer ml-0.5"
                    title="关闭标签页"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Plus tab button */}
          <button
            onClick={() => onAddTab()}
            title="新建查询标签页"
            className="flex items-center justify-center w-6.5 h-6.5 rounded hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg border border-transparent hover:border-monokai-border transition-colors ml-0.5 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Tab Bar Utilities: Tab count */}
        <div className="flex items-center gap-2 text-monokai-comment text-[11px] font-mono shrink-0 pl-2">
          <span>{tabs.length} 个查询</span>
        </div>
      </div>

      {/* 2. Action Toolbar — Primary CTA left, utilities grouped, context right */}
      <div
            className="flex h-9 shrink-0 items-center border-b border-monokai-border bg-monokai-surface/45 px-2 select-none z-20 font-sans overflow-hidden relative"
            role="toolbar"
            aria-label="SQL 工作区工具栏"
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-monokai-fg/6 to-transparent" />

            {/* LEFT: 执行 | 编辑 | 视图 | 持久化 */}
            <div className="flex items-center min-w-0 flex-1 gap-0">
              {/* Zone A: 执行 */}
              <div role="group" aria-label="执行" className="flex items-center gap-1 shrink-0 pr-2">
                <div ref={runMenuRef} className="relative flex items-center">
                  <div
                    className={`inline-flex items-stretch rounded-md overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${
                      isRunning ? 'opacity-75' : openMenu === 'run' ? 'ring-1 ring-monokai-green/50' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onExecuteQuery(activeTab?.sql || '')}
                      disabled={isRunning}
                      className="flex items-center gap-1.5 h-7 pl-2.5 pr-2 bg-monokai-green hover:brightness-110 text-monokai-bg font-semibold text-xs tracking-tight transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
                      title="运行全文 (Ctrl+Enter)"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>运行</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleMenu('run')}
                      className="flex items-center justify-center h-7 w-6 bg-monokai-green/90 hover:brightness-110 text-monokai-bg border-l border-monokai-bg/25 cursor-pointer select-none"
                      title="更多执行选项"
                      aria-label="更多执行选项"
                      aria-expanded={openMenu === 'run'}
                      aria-haspopup="menu"
                    >
                      <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${openMenu === 'run' ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {openMenu === 'run' && (
                    <div
                      role="menu"
                      aria-label="执行控制"
                      className="absolute left-0 top-full mt-1.5 z-[120] w-[20rem] rounded-xl bg-monokai-elevated border border-monokai-border shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100 font-sans"
                    >
                      <div className="flex items-center justify-between px-2.5 py-1.5 mb-1 border-b border-monokai-border-subtle text-[11px]">
                        <span className="font-semibold text-monokai-fg flex items-center gap-1.5 font-mono">
                          <Play className="w-3 h-3 text-monokai-green fill-current" />
                          执行
                        </span>
                        <span className="text-[10px] text-monokai-comment font-mono bg-monokai-surface border border-monokai-border px-1.5 py-0.5 rounded">
                          DuckDB
                        </span>
                      </div>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onExecuteQuery(activeTab?.sql || '');
                          closeMenus();
                        }}
                        className="group flex w-full items-center gap-3 p-2 rounded-lg hover:bg-monokai-surface text-left cursor-pointer transition-colors"
                      >
                        <div className="w-7 h-7 rounded-md bg-monokai-surface text-monokai-fg-muted flex items-center justify-center shrink-0 border border-monokai-border-subtle group-hover:text-monokai-green transition-colors">
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs font-medium text-monokai-fg flex items-center justify-between gap-2">
                            运行全文
                            <kbd className="wb-kbd">Ctrl+Enter</kbd>
                          </span>
                          <span className="text-[11px] text-monokai-comment">执行编辑器内全部 SQL</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          handleRunSelection();
                          closeMenus();
                        }}
                        className="group flex w-full items-center gap-3 p-2 rounded-lg hover:bg-monokai-surface text-left cursor-pointer transition-colors"
                      >
                        <div className="w-7 h-7 rounded-md bg-monokai-surface text-monokai-fg-muted flex items-center justify-center shrink-0 border border-monokai-border-subtle group-hover:text-monokai-cyan transition-colors">
                          <FileCode className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs font-medium text-monokai-fg flex items-center justify-between gap-2">
                            运行选中
                            <kbd className="wb-kbd">Ctrl+Shift+Enter</kbd>
                          </span>
                          <span className="text-[11px] text-monokai-comment">仅执行高亮选区；无选区则跑全文</span>
                        </div>
                      </button>

                      <div className="h-px bg-monokai-border-subtle my-1" />

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onExecuteQuery(activeTab?.sql || '', true, false);
                          closeMenus();
                        }}
                        className="group flex w-full items-center gap-3 p-2 rounded-lg hover:bg-monokai-surface text-left cursor-pointer transition-colors"
                      >
                        <div className="w-7 h-7 rounded-md bg-monokai-surface text-monokai-fg-muted flex items-center justify-center shrink-0 border border-monokai-border-subtle group-hover:text-monokai-yellow transition-colors">
                          <Activity className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs font-medium text-monokai-fg flex items-center justify-between gap-2">
                            执行计划
                            <kbd className="wb-kbd">Ctrl+E</kbd>
                          </span>
                          <span className="text-[11px] text-monokai-comment">物理算子与预期开销</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onExecuteQuery(activeTab?.sql || '', true, true);
                          closeMenus();
                        }}
                        className="group flex w-full items-center gap-3 p-2 rounded-lg hover:bg-monokai-surface text-left cursor-pointer transition-colors"
                      >
                        <div className="w-7 h-7 rounded-md bg-monokai-surface text-monokai-fg-muted flex items-center justify-center shrink-0 border border-monokai-border-subtle group-hover:text-monokai-orange transition-colors">
                          <Cpu className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs font-medium text-monokai-fg flex items-center justify-between gap-2">
                            深度剖析
                            <kbd className="wb-kbd">Ctrl+Shift+A</kbd>
                          </span>
                          <span className="text-[11px] text-monokai-comment">真实节点耗时</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onStopQuery}
                  disabled={!isRunning}
                  className={`relative flex items-center justify-center gap-1 h-7 w-7 rounded-md text-xs transition-all duration-150 select-none shrink-0 ${
                    isRunning
                      ? 'bg-monokai-pink text-monokai-bg hover:brightness-110 cursor-pointer active:scale-95 shadow-[0_0_10px_-2px_rgba(249,38,114,0.5)]'
                      : 'text-monokai-comment/35 cursor-not-allowed'
                  }`}
                  title={isRunning ? '停止当前查询' : '无正在执行的查询'}
                  aria-label="停止"
                >
                  <Square className={`w-3 h-3 ${isRunning ? 'fill-current' : ''}`} />
                </button>
              </div>

              <div className="w-px h-4 bg-monokai-border/70 shrink-0" aria-hidden />

              {/* Zone B: 编辑 — single segmented control */}
              <div
                role="group"
                aria-label="编辑"
                className="flex items-center h-7 mx-2 shrink-0 rounded-md border border-monokai-border/70 bg-monokai-bg/35 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={handleFormatSql}
                  className="group flex items-center gap-1 h-full px-2 text-monokai-comment hover:text-monokai-cyan hover:bg-monokai-cyan/10 text-xs font-medium transition-colors cursor-pointer select-none"
                  title="智能格式化 SQL (Ctrl+Shift+F)"
                >
                  <AlignLeft className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden lg:inline">格式化</span>
                </button>

                <div className="w-px h-3.5 bg-monokai-border/60" aria-hidden />

                <button
                  type="button"
                  onClick={handleCopySql}
                  className={`flex items-center justify-center h-full w-7 transition-colors cursor-pointer select-none ${
                    copiedSql
                      ? 'text-monokai-green bg-monokai-green/10'
                      : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/80'
                  }`}
                  title="复制当前 SQL 代码到剪贴板"
                >
                  {copiedSql ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>

                <div className="w-px h-3.5 bg-monokai-border/60" aria-hidden />

                <div className="inline-flex items-center h-full" title={`编辑器字号 ${editorFontSize}px`}>
                  <button
                    type="button"
                    onClick={() => handleAdjustFontSize(-1)}
                    disabled={editorFontSize <= 10}
                    className="flex items-center justify-center w-6 h-full text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/80 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    title="减小字号"
                    aria-label="减小字号"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="min-w-[1.75rem] text-center text-[10px] font-mono tabular-nums text-monokai-fg-muted select-none">
                    {editorFontSize}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAdjustFontSize(1)}
                    disabled={editorFontSize >= 20}
                    className="flex items-center justify-center w-6 h-full text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/80 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    title="增大字号"
                    aria-label="增大字号"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="w-px h-4 bg-monokai-border/70 shrink-0" aria-hidden />

              {/* Zone C: 视图与流程图 */}
              <div ref={flowchartMenuRef} role="group" aria-label="视图模式与流程图" className="relative flex items-center shrink-0 mx-2">
                <div
                  className={`inline-flex items-stretch h-7 rounded-md overflow-hidden border transition-colors duration-150 ${
                    isDataFlowActive
                      ? 'border-monokai-accent/55 bg-monokai-accent/12'
                      : 'border-monokai-border/70 bg-monokai-bg/35 hover:border-monokai-accent/35'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleDataFlow(!isDataFlowActive)}
                    className={`flex items-center gap-1.5 h-full px-2 text-xs font-medium transition-colors cursor-pointer select-none ${
                      isDataFlowActive
                        ? 'bg-monokai-accent text-monokai-bg hover:brightness-105'
                        : 'text-monokai-comment hover:text-monokai-accent hover:bg-monokai-accent/10'
                    }`}
                    title={isDataFlowActive ? '点击收起流程图，返回纯代码编辑器 (Alt+D)' : '展开 SQL 流程图与执行血缘 (Alt+D)'}
                  >
                    <Workflow className="w-3.5 h-3.5 shrink-0" />
                    <span>流程图</span>
                    {isDataFlowActive && (
                      <span className="text-[9px] font-mono font-bold px-1 rounded bg-monokai-bg/20">
                        分屏
                      </span>
                    )}
                  </button>

                  {isDataFlowActive ? (
                    <div className="flex items-center gap-0.5 pl-0.5 pr-0.5 border-l border-monokai-accent/30 animate-in fade-in duration-150">
                      <button
                        type="button"
                        onClick={() => onNavigateToDataFlow?.()}
                        className="flex items-center gap-1 h-6 px-1.5 rounded text-[11px] font-medium text-monokai-comment hover:text-monokai-cyan hover:bg-monokai-cyan/15 transition-colors cursor-pointer"
                        title="在独立数据流大屏中查看完整血缘拓扑 (Ctrl+5)"
                      >
                        <Maximize2 className="w-3 h-3 text-monokai-cyan" />
                        <span className="hidden xl:inline">大屏拓扑</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setLiveSyncWithSql(!liveSyncWithSql);
                          toastService.info(!liveSyncWithSql ? '已开启 SQL 实时同步流图' : '已关闭 SQL 实时同步');
                        }}
                        className={`flex items-center justify-center w-6 h-6 rounded transition-colors cursor-pointer ${
                          liveSyncWithSql
                            ? 'text-monokai-yellow hover:bg-monokai-yellow/15'
                            : 'text-monokai-comment/50 hover:text-monokai-fg hover:bg-monokai-surface/60'
                        }`}
                        title={liveSyncWithSql ? '实时同步已开启（SQL 变更自动更新流程图）' : '实时同步已暂停'}
                        aria-label="切换实时同步"
                      >
                        <Zap className={`w-3 h-3 ${liveSyncWithSql ? 'fill-current' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          syncFromSql(activeTab?.sql || '', activeTab?.title || 'Query');
                          toastService.success('流程图已重新同步');
                        }}
                        className="flex items-center justify-center w-6 h-6 rounded text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60 transition-colors cursor-pointer"
                        title="立即从当前 SQL 重建流程图"
                        aria-label="刷新流程图"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleDataFlow(false)}
                        className="flex items-center justify-center w-6 h-6 rounded text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/15 transition-colors cursor-pointer"
                        title="收起流程图 (Alt+D)"
                        aria-label="收起流程图"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleMenu('flowchart')}
                      className={`flex items-center justify-center w-6 h-full border-l border-monokai-border/60 text-monokai-comment hover:text-monokai-accent hover:bg-monokai-accent/10 transition-colors cursor-pointer ${
                        openMenu === 'flowchart' ? 'text-monokai-accent bg-monokai-accent/10' : ''
                      }`}
                      title="选择展开模式"
                      aria-label="流程图模式选项"
                      aria-expanded={openMenu === 'flowchart'}
                      aria-haspopup="menu"
                    >
                      <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${openMenu === 'flowchart' ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>

                {openMenu === 'flowchart' && !isDataFlowActive && (
                  <div
                    role="menu"
                    aria-label="流程图展开选项"
                    className="absolute left-0 top-full mt-1.5 z-[120] w-64 rounded-xl bg-monokai-elevated border border-monokai-border shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100 font-sans text-xs"
                  >
                    <div className="flex items-center justify-between px-2.5 py-1.5 mb-1 border-b border-monokai-border-subtle text-[11px]">
                      <span className="font-semibold text-monokai-fg flex items-center gap-1.5 font-mono">
                        <Workflow className="w-3.5 h-3.5 text-monokai-accent" />
                        流程图模式
                      </span>
                      <span className="text-[10px] text-monokai-comment font-mono bg-monokai-surface border border-monokai-border px-1.5 py-0.5 rounded">
                        DAG
                      </span>
                    </div>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        handleChangeLayoutMode('split');
                        closeMenus();
                      }}
                      className="group flex w-full items-center gap-3 p-2 rounded-lg hover:bg-monokai-surface text-left cursor-pointer transition-colors"
                    >
                      <div className="w-7 h-7 rounded-md bg-monokai-surface text-monokai-fg-muted flex items-center justify-center shrink-0 border border-monokai-border-subtle group-hover:text-monokai-accent transition-colors">
                        <Columns2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-medium text-monokai-fg flex items-center justify-between gap-2">
                          对照分屏
                          <kbd className="wb-kbd">Alt+D</kbd>
                        </span>
                        <span className="text-[11px] text-monokai-comment">左侧流程图，右侧代码与结果</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeMenus();
                        onNavigateToDataFlow?.();
                      }}
                      className="group flex w-full items-center gap-3 p-2 rounded-lg hover:bg-monokai-surface text-left cursor-pointer transition-colors"
                    >
                      <div className="w-7 h-7 rounded-md bg-monokai-surface text-monokai-fg-muted flex items-center justify-center shrink-0 border border-monokai-border-subtle group-hover:text-monokai-cyan transition-colors">
                        <Maximize2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-medium text-monokai-fg flex items-center justify-between gap-2">
                          进入数据流大屏
                          <kbd className="wb-kbd">Ctrl+5</kbd>
                        </span>
                        <span className="text-[11px] text-monokai-comment">全库表血缘拓扑与宏观流水线看板</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              <div className="w-px h-4 bg-monokai-border/70 shrink-0" aria-hidden />

              {/* Zone D: 持久化 */}
              <div ref={persistMenuRef} role="group" aria-label="持久化" className="relative shrink-0 ml-2">
                <div
                  className={`inline-flex items-stretch h-7 rounded-md overflow-hidden border border-monokai-border/70 bg-monokai-bg/35 transition-colors ${
                    openMenu === 'persist' ? 'border-monokai-border bg-monokai-surface' : 'hover:border-monokai-border'
                  }`}
                >
                  <button
                    type="button"
                    onClick={handleSaveQuery}
                    className="flex items-center gap-1.5 h-full px-2 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/80 text-xs font-medium transition-colors cursor-pointer select-none"
                    title="保存当前 SQL (Ctrl+S)"
                  >
                    <Save className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden md:inline">保存</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleMenu('persist')}
                    className="flex items-center justify-center h-full w-6 border-l border-monokai-border/60 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/80 transition-colors cursor-pointer select-none"
                    title="更多持久化选项"
                    aria-label="更多持久化选项"
                    aria-expanded={openMenu === 'persist'}
                    aria-haspopup="menu"
                  >
                    <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${openMenu === 'persist' ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {openMenu === 'persist' && (
                  <div
                    role="menu"
                    aria-label="持久化选项"
                    className="absolute left-0 top-full mt-1.5 z-[120] w-72 rounded-xl bg-monokai-elevated border border-monokai-border shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100 text-xs font-sans"
                  >
                    <div className="flex items-center justify-between px-2.5 py-1.5 mb-1 border-b border-monokai-border-subtle text-[11px]">
                      <span className="font-semibold text-monokai-fg flex items-center gap-1.5 font-mono">
                        <Save className="w-3.5 h-3.5 text-monokai-fg-muted" />
                        持久化
                      </span>
                      <span className="text-[10px] text-monokai-comment font-mono bg-monokai-surface border border-monokai-border px-1.5 py-0.5 rounded">
                        SQL
                      </span>
                    </div>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        handleSaveQuery();
                        closeMenus();
                      }}
                      className="group flex w-full items-center gap-3 p-2 rounded-lg hover:bg-monokai-surface text-left cursor-pointer transition-colors"
                    >
                      <div className="w-7 h-7 rounded-md bg-monokai-surface text-monokai-fg-muted flex items-center justify-center shrink-0 border border-monokai-border-subtle group-hover:text-monokai-green transition-colors">
                        <Save className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-monokai-fg">保存到工作区</span>
                        <span className="text-[11px] text-monokai-comment">写入本地标签页快照 (Ctrl+S)</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onAddTab(`CREATE VIEW v_${Date.now().toString().slice(-4)} AS\n${activeTab?.sql || ''}`);
                        closeMenus();
                      }}
                      className="group flex w-full items-center gap-3 p-2 rounded-lg hover:bg-monokai-surface text-left cursor-pointer transition-colors"
                    >
                      <div className="w-7 h-7 rounded-md bg-monokai-surface text-monokai-fg-muted flex items-center justify-center shrink-0 border border-monokai-border-subtle group-hover:text-monokai-yellow transition-colors">
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-monokai-fg">保存为视图</span>
                        <span className="text-[11px] text-monokai-comment">新建 CREATE VIEW 标签页</span>
                      </div>
                    </button>

                    <p className="px-2.5 pt-1.5 pb-1 text-[10px] text-monokai-comment/80 leading-relaxed border-t border-monokai-border-subtle mt-1">
                      结果导出（CSV / Parquet / JSON）在下方结果区工具栏
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: 智能 | 历史 | 上下文 */}
            <div className="flex items-center gap-1.5 shrink-0 pl-2 ml-1 border-l border-monokai-border/60">
              {/* Zone E: 智能 */}
              <div
                role="group"
                aria-label="智能助手"
                className="inline-flex items-stretch h-7 rounded-md overflow-hidden border border-monokai-border/70 bg-monokai-bg/35"
              >
                <button
                  type="button"
                  onClick={onTriggerAiExplain}
                  className={`flex items-center gap-1 h-full px-2 text-xs font-medium transition-colors cursor-pointer select-none ${
                    aiMode === 'explain'
                      ? 'bg-monokai-amethyst/15 text-monokai-amethyst'
                      : 'text-monokai-comment hover:text-monokai-amethyst hover:bg-monokai-amethyst/10'
                  }`}
                  title="AI 解释：一句话说明查询意图"
                  aria-label="AI 解释"
                >
                  <Sparkles className={`w-3.5 h-3.5 shrink-0 ${aiMode === 'explain' ? 'animate-pulse' : ''}`} />
                  <span className="hidden xl:inline">解释</span>
                </button>
                <div className="w-px self-stretch bg-monokai-border/60" aria-hidden />
                <button
                  type="button"
                  onClick={onTriggerAiAnalyze}
                  className={`flex items-center gap-1 h-full px-2 text-xs font-medium transition-colors cursor-pointer select-none ${
                    aiMode === 'analyze'
                      ? 'bg-monokai-green/15 text-monokai-green'
                      : 'text-monokai-comment hover:text-monokai-green hover:bg-monokai-green/10'
                  }`}
                  title="AI 分析：性能与逻辑风险诊断"
                  aria-label="AI 分析"
                >
                  <Activity className={`w-3.5 h-3.5 shrink-0 ${aiMode === 'analyze' ? 'animate-pulse' : ''}`} />
                  <span className="hidden xl:inline">分析</span>
                </button>
              </div>

              {/* Zone F: 历史 */}
              <div ref={historyPopoverRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => toggleMenu('history')}
                  className={`flex items-center gap-1 h-7 px-2 rounded-md text-xs transition-colors cursor-pointer border select-none shrink-0 ${
                    openMenu === 'history'
                      ? 'bg-monokai-surface text-monokai-fg border-monokai-border'
                      : 'bg-monokai-bg/35 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/80 border-monokai-border/70'
                  }`}
                  title="查询执行历史"
                  aria-expanded={openMenu === 'history'}
                  aria-haspopup="dialog"
                >
                  <History className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden xl:inline">历史</span>
                  <span className="text-[10px] font-mono min-w-[1.1rem] text-center tabular-nums text-monokai-comment">
                    {recentSnapshots.length}
                  </span>
                </button>

                {openMenu === 'history' && (
                  <div
                    role="dialog"
                    aria-label="查询历史"
                    className="absolute right-0 top-full mt-1.5 z-[120] w-[22rem] max-h-[420px] rounded-xl bg-monokai-elevated border border-monokai-border shadow-2xl p-2.5 flex flex-col gap-1.5 overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-100 font-sans"
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-monokai-border-subtle text-[11px] text-monokai-comment">
                      <span className="font-semibold text-monokai-fg flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-monokai-fg-muted" />
                        查询历史
                      </span>
                      <button
                        type="button"
                        onClick={closeMenus}
                        className="p-1 rounded-md hover:bg-monokai-surface hover:text-monokai-fg cursor-pointer text-monokai-comment transition-colors"
                        aria-label="关闭历史"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar max-h-72 space-y-1 py-1">
                      {recentSnapshots.length > 0 ? (
                        recentSnapshots.map(s => (
                          <div
                            key={s.snapshotId}
                            className="p-2 rounded-lg bg-monokai-surface border border-monokai-border-subtle hover:border-monokai-border transition-colors group"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateTabSql(activeTab.id, s.sql);
                                closeMenus();
                                toastService.info(`已回填「${s.title || '历史查询'}」`);
                              }}
                              className="w-full text-left cursor-pointer min-w-0"
                              title="回填到编辑器"
                            >
                              <div className="text-monokai-fg truncate font-medium text-xs font-mono">
                                {s.title || '历史查询'}
                                {s.isExplain && (
                                  <span className="ml-1.5 text-[9px] text-monokai-yellow font-sans not-italic">执行计划</span>
                                )}
                              </div>
                              <div className="text-[10px] text-monokai-comment flex items-center gap-1.5 mt-0.5 font-mono">
                                <span>{s.totalRowCount.toLocaleString()} 行</span>
                                <span aria-hidden>•</span>
                                <span>{Math.round(s.executionTime)}ms</span>
                                <span aria-hidden>•</span>
                                <span className="truncate">{s.executedAt || '刚刚'}</span>
                              </div>
                            </button>
                            <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-monokai-border-subtle/80 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  onUpdateTabSql(activeTab.id, s.sql);
                                  closeMenus();
                                  void onExecuteQuery(s.sql);
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-monokai-green hover:bg-monokai-green/10 cursor-pointer"
                                title="回填并立即运行"
                              >
                                <Play className="w-2.5 h-2.5 fill-current" />
                                运行
                              </button>
                              <button
                                type="button"
                                onClick={async e => {
                                  e.stopPropagation();
                                  try {
                                    await navigator.clipboard.writeText(s.sql);
                                    toastService.success('已复制历史 SQL');
                                  } catch {
                                    toastService.error('复制失败');
                                  }
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated cursor-pointer"
                                title="复制 SQL"
                              >
                                <Copy className="w-2.5 h-2.5" />
                                复制
                              </button>
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  onUpdateTabSql(activeTab.id, s.sql);
                                  closeMenus();
                                  toastService.info('已回填到编辑器');
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-monokai-comment hover:text-monokai-cyan hover:bg-monokai-cyan/10 cursor-pointer ml-auto"
                                title="仅回填"
                              >
                                <FileCode className="w-2.5 h-2.5" />
                                回填
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-8 px-4 text-center text-xs text-monokai-comment space-y-1">
                          <div>暂无查询历史</div>
                          <div className="text-[10px] text-monokai-comment/70">
                            运行 SQL 后，执行记录与耗时会自动出现在此
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Context chip — catalog.schema (read-only orientation) */}
              <div
                className="hidden lg:flex items-center gap-1 h-7 px-2 rounded-md border border-monokai-border/60 bg-monokai-bg/40 text-[10px] font-mono text-monokai-comment shrink-0"
                title={`当前目录上下文：${catalogContext.catalog}.${catalogContext.schema}`}
              >
                <span className="text-monokai-fg-muted truncate max-w-[7rem]">{catalogContext.catalog}</span>
                <span className="opacity-40">.</span>
                <span className="text-monokai-cyan/90 truncate max-w-[5rem]">{catalogContext.schema}</span>
              </div>
            </div>
          </div>

      {/* 3. Main Workspace Area: Pure Code / Split View */}
      {isDataFlowActive ? (
        // ── Split mode: canvas left (adjustable %), editor+results right (adjustable %) ──
        <div
          className={`flex-1 min-h-0 w-full flex overflow-hidden bg-monokai-bg relative ${
            isDraggingDataFlowDivider ? 'select-none cursor-col-resize' : ''
          }`}
        >
          {/* Transparent overlay during drag to prevent canvas/monaco/codemirror from intercepting mouse events */}
          {isDraggingDataFlowDivider && (
            <div className="absolute inset-0 z-50 cursor-col-resize select-none pointer-events-auto" />
          )}

          {/* Left: DataFlow canvas (adjustable width) */}
          <div
            className="h-full overflow-hidden shrink-0 relative"
            style={{ width: `${dataFlowSplitPct}%` }}
          >
            <DataFlowCanvas
              hideSubNav={true}
              onSwitchToSqlEditor={() => handleToggleDataFlow(false)}
              onOpenInSqlEditor={(sql, title) => onAddTab(sql, title, true)}
              activeSql={activeTab?.sql || ''}
              activeTabTitle={activeTab?.title || 'Query'}
              activeQueryResult={activeQueryResult}
              tabs={tabs}
              activeTabId={activeTabId}
              onSelectTab={(tabId) => onSelectTab(tabId)}
              layoutMode="split"
              onChangeLayoutMode={handleChangeLayoutMode}
            />
          </div>

          {/* Vertical Draggable Resizer Divider */}
          <div
            data-testid="dataflow-split-divider"
            onMouseDown={handleDataFlowDividerMouseDown}
            onDoubleClick={() => {
              setDataFlowSplitPct(50);
              localStorage.setItem('workbench_dataflow_split_pct', '50');
              toastService.info('已重置分屏为 50% / 50%');
            }}
            role="separator"
            aria-orientation="vertical"
            aria-label="拖拽调整流图与编辑器宽度"
            aria-valuenow={Math.round(dataFlowSplitPct)}
            title="按住左右拖拽调整分屏比例，双击重置为 50/50"
            className={`group relative w-2 h-full shrink-0 cursor-col-resize z-30 transition-all duration-200 flex items-center justify-center select-none border-x ${
              isDraggingDataFlowDivider
                ? 'bg-gradient-to-b from-monokai-accent/15 via-monokai-accent/25 to-monokai-accent/15 border-monokai-accent/50 shadow-[0_0_16px_rgba(166,226,46,0.35)]'
                : 'bg-gradient-to-r from-monokai-sidebar/90 via-monokai-bg/70 to-monokai-sidebar/90 border-monokai-border/80 hover:from-monokai-accent/10 hover:via-monokai-elevated/60 hover:to-monokai-accent/10 hover:border-monokai-accent/35'
            }`}
          >
            {/* Center decorative grip pills */}
            <div className="flex flex-col gap-1 items-center justify-center py-2 pointer-events-none">
              <span
                className={`w-0.5 h-6 rounded-full transition-all duration-200 ${
                  isDraggingDataFlowDivider
                    ? 'bg-monokai-accent shadow-[0_0_8px_rgba(166,226,46,0.9)] scale-y-110'
                    : 'bg-monokai-comment/40 group-hover:bg-monokai-accent/80 group-hover:shadow-[0_0_6px_rgba(166,226,46,0.6)]'
                }`}
              />
            </div>

            {/* Percentage tooltip shown during drag */}
            {isDraggingDataFlowDivider && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-monokai-sidebar/95 border border-monokai-accent/60 text-[10px] font-mono font-bold text-monokai-accent shadow-lg pointer-events-none whitespace-nowrap z-50">
                {Math.round(dataFlowSplitPct)}% : {100 - Math.round(dataFlowSplitPct)}%
              </div>
            )}
          </div>

          {/* Right: SQL Editor + Results (remaining width) */}
          <div
            className="h-full flex flex-col overflow-hidden min-w-0"
            style={{ width: `${100 - dataFlowSplitPct}%` }}
          >
            {renderEditorAndResults()}
          </div>
        </div>
      ) : (
        renderEditorAndResults()
      )}
    </div>
  );
};
