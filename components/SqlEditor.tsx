import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Play, Save, FolderOpen, X, Plus, Clock, Database, ChevronRight, ChevronDown, ChevronLeft, Search, MoreVertical, Layout, Type, Download, Trash2, Maximize2, Minimize2, Table, BarChart2, FileText, Smartphone, Monitor, RefreshCw, Sparkles, Lightbulb, Zap, AlertTriangle, Target, Wand2, Eye, EyeOff, Code, Info, Loader2, RotateCcw, HelpCircle, MessageSquare, Copy, Check, Link, Link2, Wrench, Globe, Pin, Terminal, ClipboardList } from 'lucide-react';
import { duckDBService } from '../services/duckdbService';
import { dbService } from '../services/dbService';
import { aiService } from '../services/aiService';
import { useSqlExecution } from '../hooks/useSqlExecution';
import { useSqlAiAssistant } from '../hooks/useSqlAiAssistant';
import { useSqlEditorExtensions } from '../hooks/useSqlEditorExtensions';
import { useSqlEditorStore, useToastAutoDismiss } from '../hooks/store/useSqlEditorStore';
import { saveExplanation, getAllExplanations, clearAllExplanations, deleteExplanation, AiExplanation } from '../services/aiExplanationStorage';
import { QueryResult, QueryHistoryItem, SavedQuery, ColumnInfo, ChartConfig, SqlTab } from '../types';
import { getTypeIcon, highlightSql } from '../utils';
import { SQL_CATEGORY_HELP, SNIPPET_GROUPS, SNIPPET_CATEGORY_META, SNIPPETS } from '../data/sqlEditorData';
import type { SqlCategoryHelp } from '../data/sqlEditorData';
import { exportCsv, exportJson, exportMarkdown, exportExcel, generateHtmlReport, copyAsTsv, copyAsMarkdown, copyAsHtml, downloadBlob, exportDataAsync } from '../utils/sqlExporter';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut, Scatter } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { TableTree } from './TableTree';
import CodeMirror from '@uiw/react-codemirror';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { EditorView } from '@codemirror/view';
import { format } from 'sql-formatter';
import { ChartDashboard } from './ChartDashboard';
import { ChartBuilder } from './ChartBuilder';
import { SkillAssistant } from './SkillAssistant';
import { SqlEditorHistory, SqlEditorTabs, SqlEditorToolbar, SaveQueryModal, MaterializeModal } from './SqlEditor/index';
import { SqlEditorHelpPanel } from './SqlEditor/SqlEditorHelpPanel';
import { SqlEditorResultTable } from './SqlEditor/SqlEditorResultTable';
import { SqlEditorExplainView } from './SqlEditor/SqlEditorExplainView';
import { SqlEditorErrorView } from './SqlEditor/SqlEditorErrorView';
import { SqlEditorProfilingView } from './SqlEditor/SqlEditorProfilingView';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    ChartDataLabels
);

interface SqlEditorProps {
    onRun: () => void;
    initialCode?: string;
    pendingChartConfig?: ChartConfig | null;
    isZenMode: boolean;
    onToggleZen: () => void;
    onPendingConsumed?: () => void;
}
// Extracted to data/sqlEditorData.tsx

const CHEATSHEET = [
    { label: 'Select All', code: 'SELECT * FROM table_name;', cat: 'Basic' },
    { label: 'Filter (Where)', code: "SELECT * FROM table_name WHERE col = 'val';", cat: 'Basic' },
    { label: 'Sort', code: 'SELECT * FROM table_name ORDER BY col DESC;', cat: 'Basic' },
    { label: 'Limit', code: 'SELECT * FROM table_name LIMIT 10;', cat: 'Basic' },
    { label: 'Aggregation', code: 'SELECT col, COUNT(*) FROM table_name GROUP BY col;', cat: 'Aggr' },
    { label: 'Join', code: 'SELECT t1.*, t2.* FROM t1 JOIN t2 ON t1.id = t2.id;', cat: 'Join' },
    { label: 'Insert', code: "INSERT INTO table_name (col1, col2) VALUES (1, 'val');", cat: 'DML' },
    { label: 'Update', code: "UPDATE table_name SET col = 'val' WHERE id = 1;", cat: 'DML' },
    { label: 'CSV Import', code: "CREATE TABLE t AS SELECT * FROM read_csv_auto('file.csv');", cat: 'I/O' },
    { label: 'Parquet Import', code: "CREATE TABLE t AS SELECT * FROM read_parquet('file.parquet');", cat: 'I/O' },
    { label: 'Current Date', code: 'SELECT current_date, current_timestamp;', cat: 'Func' },
    { label: 'Regex Match', code: "SELECT * FROM t WHERE regexp_matches(col, 'pattern');", cat: 'Func' },
];

const DEFAULT_CODE = "-- Welcome to DuckDB! Try running this generator query (no tables required):\nSELECT \n    i AS id,\n    'User_' || i AS username,\n    CASE WHEN i % 2 = 0 THEN 'Active' ELSE 'Inactive' END AS status,\n    round(random() * 100, 2) AS score\nFROM range(1, 6) t(i);";

const MONOKAI_COLORS = [
    'rgba(249, 38, 114, 0.8)', // Pink
    'rgba(166, 226, 46, 0.8)', // Green
    'rgba(102, 217, 239, 0.8)', // Blue
    'rgba(253, 151, 31, 0.8)', // Orange
    'rgba(174, 129, 255, 0.8)', // Purple
    'rgba(230, 219, 116, 0.8)', // Yellow
];

// (Re-exports kept for backward-compat via components/SqlEditor/index.ts)

// Note: `generateAIFillPrompt` was extracted to hooks/useSqlAiAssistant.ts (Loop 3).
// The local constant is retained for any external callers that may import it
// via the module barrel; it delegates to the hook's pure helper.
const generateAIFillPrompt = (
  sqlType: string,
  tableName?: string,
  columns?: ColumnInfo[]
): string => {
  // Local re-implementation preserved for the constant's external API.
  // The AI assistant hook provides a parallel implementation; keep them
  // in sync by routing through the prompt table when reachable.
  const columnList = columns?.map(c => `${c.name} (${c.type})`).join(', ') || '';
  const ctx = tableName ? `表: ${tableName}，字段: ${columnList || '未知'}` : '请先在左侧 Schema 选择一个表';

  switch (sqlType) {
    case 'select':
      return `为 DuckDB 生成带 WHERE 条件和 LIMIT 的基础 SELECT 查询。${ctx}`;
    case 'join':
      return `为 DuckDB 生成 LEFT JOIN 多表关联查询，主表是 ${tableName || 'table1'}，${ctx}`;
    case 'aggregate':
      return `为 DuckDB 生成按时间维度分组的聚合分析 SQL，包含 COUNT 和 SUM。${ctx}`;
    case 'transform':
      return `为 DuckDB 生成数据转换 SQL，使用 TRY_CAST 进行类型转换并用 TRIM/LOWER 清洗字符串。${ctx}`;
    case 'performance':
      return `为以下查询生成 EXPLAIN ANALYZE 诊断版本，并在注释中说明如何解读执行计划。${ctx}`;
    case 'utilities':
      return `为 DuckDB 生成 SUMMARIZE 摘要统计语句，并附上数据质量检查 SQL（NULL 率、重复行）。${ctx}`;
    default:
      return `为 DuckDB 生成 SQL 查询。${ctx}`;
  }
};

export const SqlEditor: React.FC<SqlEditorProps> = ({ onRun, initialCode, pendingChartConfig, isZenMode, onToggleZen, onPendingConsumed }) => {
    // --- Toast auto-dismiss (subscription-based, replaces imperative timer) ---
    useToastAutoDismiss();

    // --- Store selectors (replaces ~25 useState calls) ---
    const tabs = useSqlEditorStore((s) => s.tabs);
    const activeTabId = useSqlEditorStore((s) => s.activeTabId);
    const setActiveTabId = useSqlEditorStore((s) => s.setActiveTabId);
    const createTab = useSqlEditorStore((s) => s.createTab);
    const closeTabStore = useSqlEditorStore((s) => s.closeTab);
    const updateActiveTab = useSqlEditorStore((s) => s.updateActiveTab);
    const getActiveTab = useSqlEditorStore((s) => s.getActiveTab);
    const renameTab = useSqlEditorStore((s) => s.renameTab);
    const editingTitleId = useSqlEditorStore((s) => s.editingTitleId);
    const setEditingTitleId = useSqlEditorStore((s) => s.setEditingTitleId);
    const tempTitle = useSqlEditorStore((s) => s.tempTitle);
    const setTempTitle = useSqlEditorStore((s) => s.setTempTitle);

    const aiPrompt = useSqlEditorStore((s) => s.aiPrompt);
    const setAiPrompt = useSqlEditorStore((s) => s.setAiPrompt);
    const isAiLoading = useSqlEditorStore((s) => s.isAiLoading);
    const setIsAiLoading = useSqlEditorStore((s) => s.setIsAiLoading);
    const isFixing = useSqlEditorStore((s) => s.isFixing);
    const setIsFixing = useSqlEditorStore((s) => s.setIsFixing);
    const activeSidebarTab = useSqlEditorStore((s) => s.activeSidebarTab);
    const setActiveSidebarTab = useSqlEditorStore((s) => s.setActiveSidebarTab);

    const toast = useSqlEditorStore((s) => s.toast);
    const showToast = useSqlEditorStore((s) => s.showToast);

    const selectedSqlType = useSqlEditorStore((s) => s.selectedSqlType);
    const setSelectedSqlType = useSqlEditorStore((s) => s.setSelectedSqlType);
    const showLivePreview = useSqlEditorStore((s) => s.showLivePreview);
    const setShowLivePreview = useSqlEditorStore((s) => s.setShowLivePreview);
    const liveSqlPreview = useSqlEditorStore((s) => s.liveSqlPreview);
    const setLiveSqlPreview = useSqlEditorStore((s) => s.setLiveSqlPreview);
    const isGeneratingPreview = useSqlEditorStore((s) => s.isGeneratingPreview);
    const setIsGeneratingPreview = useSqlEditorStore((s) => s.setIsGeneratingPreview);
    const aiSuggestion = useSqlEditorStore((s) => s.aiSuggestion);
    const setAiSuggestion = useSqlEditorStore((s) => s.setAiSuggestion);
    const isGeneratingSuggestion = useSqlEditorStore((s) => s.isGeneratingSuggestion);
    const setIsGeneratingSuggestion = useSqlEditorStore((s) => s.setIsGeneratingSuggestion);
    const copiedField = useSqlEditorStore((s) => s.copiedField);
    const setCopiedField = useSqlEditorStore((s) => s.setCopiedField);
    const lastClearedContent = useSqlEditorStore((s) => s.lastClearedContent);
    const setLastClearedContent = useSqlEditorStore((s) => s.setLastClearedContent);
    const previewDebounceRef = useRef<NodeJS.Timeout | null>(null);

    const history = useSqlEditorStore((s) => s.history);
    const savedQueries = useSqlEditorStore((s) => s.savedQueries);
    const setSavedQueries = useSqlEditorStore((s) => s.setSavedQueries);
    const schemaTree = useSqlEditorStore((s) => s.schemaTree);
    const setSchemaTree = useSqlEditorStore((s) => s.setSchemaTree);
    const historyFilter = useSqlEditorStore((s) => s.historyFilter);
    const setHistoryFilter = useSqlEditorStore((s) => s.setHistoryFilter);
    const addHistory = useSqlEditorStore((s) => s.addHistory);
    const clearHistoryStore = useSqlEditorStore((s) => s.clearHistory);

    const showSaveModal = useSqlEditorStore((s) => s.showSaveModal);
    const setShowSaveModal = useSqlEditorStore((s) => s.setShowSaveModal);
    const showChartBuilder = useSqlEditorStore((s) => s.showChartBuilder);
    const setShowChartBuilder = useSqlEditorStore((s) => s.setShowChartBuilder);
    const editingChartId = useSqlEditorStore((s) => s.editingChartId);
    const setEditingChartId = useSqlEditorStore((s) => s.setEditingChartId);
    const showMaterializeModal = useSqlEditorStore((s) => s.showMaterializeModal);
    const setShowMaterializeModal = useSqlEditorStore((s) => s.setShowMaterializeModal);
    const materializeType = useSqlEditorStore((s) => s.materializeType);
    const setMaterializeType = useSqlEditorStore((s) => s.setMaterializeType);
    const materializeName = useSqlEditorStore((s) => s.materializeName);
    const setMaterializeName = useSqlEditorStore((s) => s.setMaterializeName);

    const showSnippetsMenu = useSqlEditorStore((s) => s.showSnippetsMenu);
    const setShowSnippetsMenu = useSqlEditorStore((s) => s.setShowSnippetsMenu);
    const expandedSnippetCategory = useSqlEditorStore((s) => s.expandedSnippetCategory);
    const setExpandedSnippetCategory = useSqlEditorStore((s) => s.setExpandedSnippetCategory);
    const hoveredSnippet = useSqlEditorStore((s) => s.hoveredSnippet);
    const setHoveredSnippet = useSqlEditorStore((s) => s.setHoveredSnippet);
    const aiOptimizationHistory = useSqlEditorStore((s) => s.aiOptimizationHistory);
    const setAiOptimizationHistory = useSqlEditorStore((s) => s.setAiOptimizationHistory);
    const aiExplanation = useSqlEditorStore((s) => s.aiExplanation);
    const setAiExplanation = useSqlEditorStore((s) => s.setAiExplanation);
    const showAiExplanation = useSqlEditorStore((s) => s.showAiExplanation);
    const setShowAiExplanation = useSqlEditorStore((s) => s.setShowAiExplanation);
    const aiExplanationHistory = useSqlEditorStore((s) => s.aiExplanationHistory);
    const setAiExplanationHistory = useSqlEditorStore((s) => s.setAiExplanationHistory);
    const saveQueryName = useSqlEditorStore((s) => s.saveQueryName);
    const setSaveQueryName = useSqlEditorStore((s) => s.setSaveQueryName);
    const saveAsWidget = useSqlEditorStore((s) => s.saveAsWidget);
    const setSaveAsWidget = useSqlEditorStore((s) => s.setSaveAsWidget);
    const widgetType = useSqlEditorStore((s) => s.widgetType);
    const setWidgetType = useSqlEditorStore((s) => s.setWidgetType);
    const showExportMenu = useSqlEditorStore((s) => s.showExportMenu);
    const setShowExportMenu = useSqlEditorStore((s) => s.setShowExportMenu);
    const showMaterializeMenu = useSqlEditorStore((s) => s.showMaterializeMenu);
    const setShowMaterializeMenu = useSqlEditorStore((s) => s.setShowMaterializeMenu);
    const showSkillAssistant = useSqlEditorStore((s) => s.showSkillAssistant);
    const setShowSkillAssistant = useSqlEditorStore((s) => s.setShowSkillAssistant);
    const autoRefreshInterval = useSqlEditorStore((s) => s.autoRefreshInterval);
    const setAutoRefreshInterval = useSqlEditorStore((s) => s.setAutoRefreshInterval);

    const editorHeightPercent = useSqlEditorStore((s) => s.editorHeightPercent);
    const setEditorHeightPercent = useSqlEditorStore((s) => s.setEditorHeightPercent);
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);

    const chartRef = useRef<any>(null);
    const PAGE_SIZE = 50;

    const selectionRef = useRef('');
    const cursorOffsetRef = useRef(0);
    const activeTab = getActiveTab();

    const hasMismatchedBrackets = useMemo(() => {
        if (!activeTab || !activeTab.code) return false;
        let count = 0;
        for (const char of activeTab.code) {
            if (char === '(') count++;
            else if (char === ')') count--;
            if (count < 0) return true;
        }
        return count !== 0;
    }, [activeTab?.code]);

    const [dbStats, setDbStats] = useState<{ databaseSize: string; memoryUsage: string; memoryLimit: string } | null>(null);

    const refreshDiagnostics = async () => {
        try {
            const stats = await duckDBService.getDatabaseDiagnostics();
            setDbStats(stats);
        } catch (e) { console.error(e); }
    };

    // --- Helpers (kept local; operate on store selectors) ---

    const createNewTab = () => {
        createTab();
    };

    const closeTab = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        closeTabStore(id);
    };

    const handleTitleDoubleClick = (tab: SqlTab) => {
        setEditingTitleId(tab.id);
        setTempTitle(tab.title);
    };

    const saveTitle = () => {
        if (editingTitleId) {
            renameTab(editingTitleId, tempTitle);
            setEditingTitleId(null);
        }
    };

    // --- Initialization ---

    useEffect(() => {
        loadData();

        const handleSchemaChange = () => {
            refreshSchema();
        };
        window.addEventListener('duckdb-schema-changed', handleSchemaChange);
        return () => {
            window.removeEventListener('duckdb-schema-changed', handleSchemaChange);
        };
    }, []);

    const loadData = async () => {
        try {
            const saved = await dbService.getQueries();
            setSavedQueries(saved);
            // 加载 AI 解释历史
            const explanationHistory = await getAllExplanations();
            setAiExplanationHistory(explanationHistory);
        } catch (e) { console.error(e); }
        refreshSchema();
    };

    useEffect(() => {
        if (initialCode) {
            const store = useSqlEditorStore.getState();
            const tab = store.getActiveTab();
            if (!tab) {
                store.createTab(initialCode);
            } else {
                store.updateActiveTab({ code: initialCode });
            }
        }
    }, [initialCode]);

    const historyDraftRef = useRef<string | null>(null);
    const currentHistoryIndexRef = useRef<number>(-1);

    useEffect(() => {
        historyDraftRef.current = null;
        currentHistoryIndexRef.current = -1;
    }, [activeTabId]);

    const handleNavigateHistory = useCallback((direction: 'up' | 'down'): boolean => {
        const uniqueHistory = Array.from(new Set(history.map(h => h.sql)));
        if (uniqueHistory.length === 0) return false;

        let newIndex = currentHistoryIndexRef.current;
        if (direction === 'up') {
            if (newIndex === -1) {
                historyDraftRef.current = activeTab?.code ?? '';
            }
            if (newIndex < uniqueHistory.length - 1) {
                newIndex++;
            } else {
                return false;
            }
        } else {
            if (newIndex > -1) {
                newIndex--;
            } else {
                return false;
            }
        }

        currentHistoryIndexRef.current = newIndex;
        const newCode = newIndex === -1 ? (historyDraftRef.current ?? '') : uniqueHistory[newIndex];
        updateActiveTab({ code: newCode });
        return true;
    }, [history, activeTab?.code, updateActiveTab]);

    // Handle pending chart config from Metrics - auto-run SQL
    useEffect(() => {
        if (pendingChartConfig) {
            const sqlCode = initialCode || ''; // Get SQL from initialCode prop
            const store = useSqlEditorStore.getState();
            const tab = store.getActiveTab();
            if (!tab) {
                const newId = store.createTab(pendingChartConfig.title || 'Metric Chart');
                store.updateTabById(newId, {
                    code: sqlCode,
                    chartConfig: pendingChartConfig,
                    charts: [pendingChartConfig],
                    viewMode: 'chart',
                });
            } else {
                store.updateActiveTab({
                    code: sqlCode || tab.code,
                    chartConfig: pendingChartConfig,
                    charts: [...(tab.charts || []), pendingChartConfig],
                    viewMode: 'chart',
                });
            }

            // Auto-run the SQL after setting the config (with a small delay to ensure state is updated)
            if (sqlCode) {
                setTimeout(() => {
                    onRun();
                    // Notify parent that pending has been consumed
                    onPendingConsumed?.();
                }, 150);
            }
        }
    }, [pendingChartConfig, initialCode]); // Also track initialCode changes

    // (Tabs auto-persist via Zustand persist middleware — see useSqlEditorStore.ts.)

    // Dragging Logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current || !editorContainerRef.current) return;
            const containerRect = editorContainerRef.current.parentElement?.getBoundingClientRect();
            if (!containerRect) return;

            const relativeY = e.clientY - containerRect.top;
            const percent = (relativeY / containerRect.height) * 100;
            setEditorHeightPercent(Math.min(Math.max(percent, 20), 80)); // Clamp between 20% and 80%
        };

        const handleMouseUp = () => {
            isDraggingRef.current = false;
            document.body.style.cursor = 'default';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const startDragging = () => {
        isDraggingRef.current = true;
        document.body.style.cursor = 'row-resize';
    };

    const refreshSchema = async () => {
        try {
            const tables = await duckDBService.getTables();
            const tree: Record<string, ColumnInfo[]> = {};
            for (const t of tables) {
                const cols = await duckDBService.getTableSchema(t);
                tree[t] = cols;
            }
            setSchemaTree(tree);
            refreshDiagnostics();
        } catch (e) { console.error(e); }
    };

    // --- Execution Logic (delegated to useSqlExecution hook) ---
    const { execute: runExecute, handleKeyDown: hookHandleKeyDown, cancel: cancelExecution } = useSqlExecution({
        getActiveTab,
        updateActiveTab,
        onAfterRun: () => {
            if (onRun) onRun();
            refreshDiagnostics();
        },
        saveToHistory: (sql, status, duration) => saveToHistory(sql, status, duration),
        refreshSchema,
        onCancel: () => {
            showToast('查询已取消', 'warning');
        },
        onError: (msg) => {
            console.error('SQL execution error:', msg);
        },
    });

    /** Thin wrapper preserving original signature `execute(explain)`. */
    const execute = (explain = false) => runExecute(explain, selectionRef.current.trim() || undefined, cursorOffsetRef.current);

    /** Thin wrapper preserving original handleKeyDown signature. */
    const handleKeyDown = (e: React.KeyboardEvent) =>
        hookHandleKeyDown(e, { lastClearedContent, onUndoClear: handleUndoClear });

    // --- Materialization ---
    const openMaterializeModal = (type: 'TABLE' | 'VIEW') => {
        setMaterializeType(type);
        setMaterializeName('');
        setShowMaterializeModal(true);
        setShowMaterializeMenu(false);
    };

    const handleMaterialize = async () => {
        const tab = getActiveTab();
        if (!tab || !materializeName) return;

        const sql = `CREATE ${materializeType} "${materializeName}" AS ${tab.code}`;

        try {
            updateActiveTab({ loading: true });
            await duckDBService.executeAndAudit(sql, 'CREATE', materializeName, `Materialized from SQL Editor as ${materializeType}`);
            setShowMaterializeModal(false);
            refreshSchema();
            updateActiveTab({ loading: false });
            alert(`Successfully created ${materializeType}: ${materializeName}`);
            onRun(); // Refresh global
        } catch (e: any) {
            alert(`Failed to create ${materializeType}: ${e.message}`);
            updateActiveTab({ loading: false });
        }
    };

    // --- AI & Tools (delegated to useSqlAiAssistant hook) ---
    const ai = useSqlAiAssistant();
    const handleAIFill = ai.handleAIFill;

    // 快速清除 - 清空当前编辑器内容 + AI 输入框
    const handleClear = useCallback(() => {
        const tab = getActiveTab();
        if (!tab) return;

        // 同时保存 SQL 内容与 AI 输入框，以便撤销
        setLastClearedContent({ sql: tab.code, aiInput: aiPrompt });
        updateActiveTab({ code: '' });
        setAiPrompt('');
        showToast('已清除 SQL 与 AI 输入，Ctrl+Z 可撤销', 'info');
    }, [aiPrompt, showToast]);

    // 撤销清除 - 同时恢复 SQL 内容与 AI 输入框
    const handleUndoClear = useCallback(() => {
        const tab = getActiveTab();
        if (!tab || !lastClearedContent) return;

        updateActiveTab({ code: lastClearedContent.sql });
        setAiPrompt(lastClearedContent.aiInput);
        setLastClearedContent(null);
        showToast('已恢复清除前的内容（SQL + AI 输入）', 'success');
    }, [lastClearedContent, showToast]);

    // 实时预览 - 基于当前输入生成 SQL 预览
    const generateLivePreview = useCallback(async () => {
        const tab = getActiveTab();
        if (!tab || !tab.code.trim()) {
            setLiveSqlPreview('// 请输入 SQL 以预览');
            return;
        }

        // 基本语法验证和格式化
        setIsGeneratingPreview(true);
        try {
            const formatted = format(tab.code, {
                language: 'postgresql',
                keywordCase: 'upper',
                linesBetweenQueries: 2
            });
            setLiveSqlPreview(formatted);
        } catch {
            setLiveSqlPreview(tab.code);
        } finally {
            setIsGeneratingPreview(false);
        }
    }, []);

    // Auto-save draft (debounced 3s after last keystroke)
    const lastSavedAt = useSqlEditorStore((s) => s.lastSavedAt);
    const setLastSavedAt = useSqlEditorStore((s) => s.setLastSavedAt);
    const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const savedContentRef = useRef<string>('');

    useEffect(() => {
        const tab = useSqlEditorStore.getState().getActiveTab();
        if (!tab || !tab.code || tab.code === savedContentRef.current) return;
        if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
        autoSaveRef.current = setTimeout(() => {
            savedContentRef.current = tab.code;
            setLastSavedAt(Date.now());
            try {
                const drafts = JSON.parse(localStorage.getItem('sql-editor-drafts') || '{}');
                drafts[tab.id] = { code: tab.code, savedAt: Date.now() };
                localStorage.setItem('sql-editor-drafts', JSON.stringify(drafts));
            } catch { /* ignore */ }
        }, 3000);
    }, [activeTabId]);

    // Restore draft on tab switch if the tab has no code
    useEffect(() => {
        const tab = useSqlEditorStore.getState().getActiveTab();
        if (!tab || tab.code) return;
        try {
            const drafts = JSON.parse(localStorage.getItem('sql-editor-drafts') || '{}');
            const draft = drafts[tab.id];
            if (draft && draft.code) {
                updateActiveTab({ code: draft.code });
                savedContentRef.current = draft.code;
            }
        } catch { /* ignore */ }
    }, [activeTabId]);

    // AI 建议生成 (delegated to useSqlAiAssistant)
    const handleAISuggestion = ai.handleAISuggestion;

    // 复制功能
    const handleCopy = (text: string, fieldName: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const formatSql = () => {
        const tab = getActiveTab();
        if (!tab) return;
        try {
            const formatted = format(tab.code, {
                language: 'postgresql', // DuckDB is Postgres-compatible enough for formatting
                keywordCase: 'upper',
                linesBetweenQueries: 2
            });
            updateActiveTab({ code: formatted });
        } catch (e) {
            console.error("Formatting failed", e);
            // Fallback to basic trimming if formatter fails
            updateActiveTab({ code: tab.code.trim() });
        }
    };

    const handleAiGenerate = ai.handleAiGenerate;
    const handleAiContinueOptimize = ai.handleAiContinueOptimize;
    const handleAiFix = ai.handleAiFix;

    // --- Persistence Wrappers (now backed by Zustand store) ---
    const saveToHistory = (sql: string, status: 'success' | 'error', duration: number = 0) => {
        const newItem: QueryHistoryItem = {
            id: (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            sql,
            timestamp: Date.now(),
            status,
            executionTime: duration
        };
        addHistory(newItem);
    };

    const clearHistory = () => {
        clearHistoryStore();
    };

    const handleSaveQuery = async () => {
        const tab = getActiveTab();
        if (!tab || !saveQueryName.trim()) return;
        const newSaved: SavedQuery = {
            id: Date.now().toString(),
            name: saveQueryName,
            sql: tab.code,
            createdAt: Date.now(),
            pinned: saveAsWidget,
            widgetType: saveAsWidget ? widgetType : undefined,
            charts: (saveAsWidget && widgetType === 'chart') ? [tab.chartConfig] : undefined
        };
        await dbService.saveQuery(newSaved);
        await loadData(); // Reload to refresh list

        setShowSaveModal(false);
        setSaveQueryName('');
        setSaveAsWidget(false);
        setActiveSidebarTab('saved');
    };

    const deleteSavedQuery = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await dbService.deleteQuery(id);
        const updated = savedQueries.filter(q => q.id !== id);
        setSavedQueries(updated);
    };

    // --- Sidebar Helpers ---
    const insertText = (text: string) => {
        const tab = getActiveTab();
        if (tab) updateActiveTab({ code: tab.code + text });
    };

    const toggleTableExpand = (table: string) => {
        useSqlEditorStore.getState().toggleTableExpand(table);
    };

    // --- Export ---
    const handleExportHtmlReport = () => {
        const tab = getActiveTab();
        if (!tab || !tab.result) return;
        const chartImg = chartRef.current ? chartRef.current.toBase64Image() : null;
        const html = generateHtmlReport(tab.title, tab.code, tab.result, { chartImage: chartImg });
        downloadBlob(new Blob([html], { type: 'text/html' }), `report_${Date.now()}.html`);
        setShowExportMenu(false);
    };

    const downloadResult = async (format: 'csv' | 'json' | 'parquet' | 'excel') => {
        const tab = getActiveTab();
        if (!tab || !tab.result || !tab.result.rows.length) return;
        const ts = Date.now();
        try {
            updateActiveTab({ loading: true });
            showToast('开始异步格式化并导出...', 'info');
            if (format === 'parquet') {
                const blob = await duckDBService.exportParquet(tab.code, 'export.parquet');
                downloadBlob(blob, `query_result_${ts}.parquet`);
            } else {
                const blob = await exportDataAsync(format, tab.result);
                downloadBlob(blob, `query_result_${ts}.${format === 'excel' ? 'xls' : format}`);
            }
            showToast('文件导出成功', 'success');
            setShowExportMenu(false);
        } catch (e: any) {
            console.error(e);
            showToast(`导出失败: ${e.message || e}`, 'warning');
        } finally {
            updateActiveTab({ loading: false });
        }
    };

    const downloadChartImage = () => {
        if (chartRef.current) {
            const link = document.createElement('a');
            link.download = `chart_${Date.now()}.png`;
            link.href = chartRef.current.toBase64Image();
            link.click();
        }
    };

    const copyToClipboard = (mode: 'tsv' | 'md' | 'html') => {
        const tab = getActiveTab();
        if (!tab || !tab.result) return;
        const fn = mode === 'tsv' ? copyAsTsv : mode === 'md' ? copyAsMarkdown : copyAsHtml;
        navigator.clipboard.writeText(fn(tab.result));
    };

    const toggleYAxis = (col: string) => {
        const tab = getActiveTab();
        if (!tab) return;
        const current = new Set(tab.chartConfig.yKeys);
        const currentRight = new Set(tab.chartConfig.yRightKeys || []);

        if (current.has(col)) current.delete(col);
        else {
            current.add(col);
            currentRight.delete(col);
        }

        updateActiveTab({ chartConfig: { ...tab.chartConfig, yKeys: Array.from(current), yRightKeys: Array.from(currentRight) } });
    };

    const toggleYRightAxis = (col: string) => {
        const tab = getActiveTab();
        if (!tab) return;
        const currentRight = new Set(tab.chartConfig.yRightKeys || []);
        const currentLeft = new Set(tab.chartConfig.yKeys);

        if (currentRight.has(col)) currentRight.delete(col);
        else {
            currentRight.add(col);
            currentLeft.delete(col);
        }

        updateActiveTab({ chartConfig: { ...tab.chartConfig, yRightKeys: Array.from(currentRight), yKeys: Array.from(currentLeft) } });
    };

    // --- Rendering Helpers ---

    // 自动刷新定时器
    useEffect(() => {
        if (autoRefreshInterval <= 0 || !activeTab?.code) return;

        const interval = setInterval(() => {
            onRun();
        }, autoRefreshInterval * 1000);

        return () => clearInterval(interval);
    }, [autoRefreshInterval, activeTab?.code, onRun]);

    if (!activeTab) {
        return <div className="flex flex-col h-full items-center justify-center text-monokai-comment">Loading...</div>;
    }

    const allRows = activeTab.result?.rows || [];
    const filteredRows = activeTab.filterTerm
        ? allRows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(activeTab.filterTerm.toLowerCase())))
        : allRows;

    const paginatedRows = filteredRows.slice(activeTab.page * PAGE_SIZE, (activeTab.page + 1) * PAGE_SIZE);
    const maxPage = filteredRows.length > 0 ? Math.ceil(filteredRows.length / PAGE_SIZE) - 1 : 0;



    const filteredHistory = history.filter(h => h.sql.toLowerCase().includes(historyFilter.toLowerCase()));

    return (
        <div className="flex flex-col h-full gap-4 relative">
            {/* Toast 状态提示 */}
            {toast && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-2xl text-sm font-medium transition-all animate-[fadeIn_0.2s] border ${toast.type === 'success' ? 'bg-monokai-green/20 border-monokai-green/50 text-monokai-green' :
                        toast.type === 'warning' ? 'bg-monokai-yellow/20 border-monokai-yellow/50 text-monokai-yellow' :
                            'bg-monokai-blue/20 border-monokai-blue/50 text-monokai-blue'
                    }`}>
                    {toast.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> :
                        toast.type === 'warning' ? <AlertTriangle className="w-4 h-4 shrink-0" /> :
                            <Info className="w-4 h-4 shrink-0" />}
                    <span>{toast.message}</span>
                </div>
            )}
            <SaveQueryModal
                isOpen={showSaveModal}
                onClose={() => setShowSaveModal(false)}
                saveQueryName={saveQueryName}
                setSaveQueryName={setSaveQueryName}
                saveAsWidget={saveAsWidget}
                setSaveAsWidget={setSaveAsWidget}
                widgetType={widgetType}
                setWidgetType={setWidgetType}
                onSave={handleSaveQuery}
            />
            {/* AI 解释弹窗 */}
            {showAiExplanation && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s]">
                    <div className="bg-monokai-sidebar border border-monokai-accent rounded-xl shadow-2xl w-[600px] max-h-[80vh] overflow-hidden animate-[slideIn_0.25s_ease-out]">
                        {/* 头部 */}
                        <div className="flex items-center justify-between px-5 py-4 bg-monokai-bg border-b border-monokai-accent">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-monokai-purple/20 flex items-center justify-center">
                                    <Zap className="w-4 h-4 text-monokai-purple" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-monokai-fg">SQL 解释</h3>
                                    <p className="text-[10px] text-monokai-comment">当前查询的作用和计算逻辑</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAiExplanation(false)}
                                className="w-7 h-7 rounded-lg hover:bg-monokai-accent flex items-center justify-center text-monokai-comment hover:text-monokai-fg transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* 原始 SQL */}
                        <div className="px-5 py-3 bg-monokai-bg/50 border-b border-monokai-accent/50">
                            <div className="flex items-center gap-2 mb-2">
                                <Code className="w-3 h-3 text-monokai-comment" />
                                <span className="text-[10px] font-medium text-monokai-comment">原始 SQL</span>
                            </div>
                            <pre className="text-xs text-monokai-fg/80 font-mono whitespace-pre-wrap bg-monokai-bg p-3 rounded-lg border border-monokai-accent/30 max-h-24 overflow-auto">
                                {activeTab.code}
                            </pre>
                        </div>

                        {/* 解释内容 */}
                        <div className="p-5 overflow-auto max-h-[50vh] text-sm text-monokai-fg">
                            <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h1: ({children}) => <h1 className="text-lg font-bold text-monokai-purple mb-3 mt-2">{children}</h1>,
                                    h2: ({children}) => <h2 className="text-base font-bold text-monokai-blue mb-2 mt-3">{children}</h2>,
                                    h3: ({children}) => <h3 className="text-sm font-semibold text-monokai-purple mb-1 mt-2">{children}</h3>,
                                    p: ({children}) => <p className="mb-2 leading-relaxed">{children}</p>,
                                    ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1 ml-2">{children}</ul>,
                                    ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1 ml-2">{children}</ol>,
                                    li: ({children}) => <li className="text-monokai-fg/90 mb-1">{children}</li>,
                                    strong: ({children}) => <strong className="text-monokai-pink font-semibold">{children}</strong>,
                                    em: ({children}) => <em className="text-monokai-yellow">{children}</em>,
                                    code: ({className, children, ...props}) => {
                                        const match = /language-(\w+)/.exec(className || '');
                                        const isInline = !match && !className;
                                        if (isInline) {
                                            return <code className="bg-monokai-bg px-1.5 py-0.5 rounded text-monokai-purple text-xs font-mono">{children}</code>;
                                        }
                                        return <code className="block bg-monokai-bg p-3 rounded-lg border border-monokai-accent/30 text-xs font-mono overflow-x-auto mb-2" {...props}>{children}</code>;
                                    },
                                    pre: ({children}) => <pre className="mb-2">{children}</pre>,
                                    a: ({href, children}) => <a href={href} className="text-monokai-blue hover:underline">{children}</a>,
                                    blockquote: ({children}) => <blockquote className="border-l-4 border-monokai-purple pl-3 italic text-monokai-comment mb-2">{children}</blockquote>,
                                }}
                            >
                                {aiExplanation}
                            </ReactMarkdown>
                        </div>

                        {/* 底部按钮 */}
                        <div className="flex justify-between items-center px-5 py-4 bg-monokai-bg border-t border-monokai-accent">
                            <div className="flex gap-2">
                                {aiExplanationHistory.length > 0 && (
                                    <button
                                        onClick={async () => {
                                            if (confirm('确定要清除所有解释历史吗？')) {
                                                await clearAllExplanations();
                                                setAiExplanationHistory([]);
                                            }
                                        }}
                                        className="px-3 py-1.5 text-xs font-medium text-monokai-red hover:bg-monokai-red/20 rounded-lg transition-colors"
                                    >
                                        清除历史
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => setShowAiExplanation(false)}
                                className="px-4 py-2 text-sm font-medium text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent rounded-lg transition-colors"
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <MaterializeModal
                isOpen={showMaterializeModal}
                onClose={() => setShowMaterializeModal(false)}
                materializeType={materializeType}
                materializeName={materializeName}
                setMaterializeName={setMaterializeName}
                onConfirm={handleMaterialize}
            />


            <div className="flex flex-1 min-h-0 gap-4">
                <div className="flex flex-col gap-0 flex-1 min-w-0">
                    {/* Editor Area with Tabs */}
                    <div
                        className="flex flex-col gap-0 min-h-[100px] border border-monokai-accent rounded-t-lg bg-monokai-bg overflow-hidden shadow-2xl relative"
                        style={{ height: `${editorHeightPercent}%` }}
                        ref={editorContainerRef}
                    >
                        {/* Tabs */}
                        <SqlEditorTabs
                            tabs={tabs}
                            activeTabId={activeTabId}
                            editingTitleId={editingTitleId}
                            tempTitle={tempTitle}
                            onTabClick={setActiveTabId}
                            onTabDoubleClick={handleTitleDoubleClick}
                            onCloseTab={closeTab}
                            onCreateTab={createNewTab}
                            onTitleChange={e => setTempTitle(e.target.value)}
                            onTitleSave={saveTitle}
                            onTitleKeyDown={e => e.key === 'Enter' && saveTitle()}
                        />

                        {/* Toolbar */}
                        <SqlEditorToolbar
                            activeTab={activeTab}
                            isZenMode={isZenMode}
                            showSnippetsMenu={showSnippetsMenu}
                            expandedSnippetCategory={expandedSnippetCategory}
                            hoveredSnippet={hoveredSnippet}
                            showMaterializeMenu={showMaterializeMenu}
                            showLivePreview={showLivePreview}
                            isAiLoading={isAiLoading}
                            aiPrompt={aiPrompt}
                            selectedSqlType={selectedSqlType}
                            lastClearedContent={lastClearedContent}
                            onUndoClear={handleUndoClear}
                            onExecute={(overrideSql) => execute(false, overrideSql)}
                            onCancel={cancelExecution}
                            onToggleSnippets={() => setShowSnippetsMenu(!showSnippetsMenu)}
                            onSnippetCategoryToggle={setExpandedSnippetCategory}
                            onSnippetHover={setHoveredSnippet}
                            onSnippetInsert={insertText}
                            onSnippetsMenuToggle={() => setShowSnippetsMenu(!showSnippetsMenu)}
                            onShowSkillAssistant={() => setShowSkillAssistant(true)}
                            onToggleMaterializeMenu={() => setShowMaterializeMenu(!showMaterializeMenu)}
                            onOpenMaterializeModal={openMaterializeModal}
                            onFormatSql={formatSql}
                            onSaveModal={() => setShowSaveModal(true)}
                            onClear={handleClear}
                            onToggleZen={onToggleZen}
                            onToggleLivePreview={() => setShowLivePreview(!showLivePreview)}
                            onAiPromptChange={e => setAiPrompt(e.target.value)}
                            onAiPromptClear={() => setAiPrompt('')}
                            onAiGenerate={handleAiGenerate}
                            onSqlTypeChange={e => setSelectedSqlType(e.target.value)}
                            onAIFill={handleAIFill}
                            onAiExplain={() => handleAiContinueOptimize('explain')}
                        />

                        {/* Code Editor */}
                        <div className="relative flex-1 overflow-auto bg-monokai-bg" onKeyDown={handleKeyDown} tabIndex={0}>
                            {showLivePreview && (
                                <div className="absolute top-0 left-0 right-0 bottom-0 z-20 flex flex-col bg-monokai-bg/95 backdrop-blur-sm">
                                    <div className="flex items-center justify-between px-3 py-2 bg-monokai-surface border-b border-monokai-accent">
                                        <div className="flex items-center gap-2">
                                            <Eye className="w-4 h-4 text-monokai-purple" />
                                            <span className="text-xs font-bold text-monokai-fg">SQL 格式化预览</span>
                                            {isGeneratingPreview && <Loader2 className="w-3 h-3 animate-spin text-monokai-purple" />}
                                        </div>
                                        <button
                                            onClick={() => setShowLivePreview(false)}
                                            className="text-xs text-monokai-comment hover:text-monokai-fg px-2 py-1"
                                        >
                                            关闭
                                        </button>
                                    </div>
                                    <pre 
                                        className="flex-1 overflow-auto p-4 font-mono text-xs text-monokai-fg whitespace-pre-wrap"
                                        dangerouslySetInnerHTML={{ __html: highlightSql(liveSqlPreview || activeTab.code || '-- 输入 SQL 以查看预览') }}
                                    />
                                </div>
                            )}
                            <CodeMirror
                                key={`${activeTabId}-${Object.keys(schemaTree).join(',')}`}
                                value={activeTab.code}
                                height="100%"
                                theme={monokai}
                                onUpdate={(viewUpdate) => {
                                    const main = viewUpdate.state.selection.main;
                                    selectionRef.current = viewUpdate.state.sliceDoc(main.from, main.to);
                                    cursorOffsetRef.current = main.head;
                                }}
                                extensions={[
                                    ...useSqlEditorExtensions({
                                        onExecute: onRun,
                                        onCancel: cancelExecution,
                                        onNavigateHistory: handleNavigateHistory,
                                    }),
                                    EditorView.lineWrapping,
                                    EditorView.theme({
                                        "&": { backgroundColor: "#272822", color: "#f8f8f2", fontFamily: "'Victor Mono', 'Noto Sans SC', monospace", fontSize: "10px" },
                                        ".cm-gutters": { backgroundColor: "#272822", color: "#75715e", border: "none", fontSize: "10px" },
                                        ".cm-activeLine": { backgroundColor: "rgba(73, 72, 62, .15)" },
                                        ".cm-activeLineGutter": { backgroundColor: "rgba(73, 72, 62, .15)" },
                                        ".cm-content": { fontFamily: "'Victor Mono', 'Noto Sans SC', monospace", fontSize: "10px" },
                                        ".cm-line": { fontFamily: "'Victor Mono', 'Noto Sans SC', monospace", fontSize: "10px" },
                                        ".cm-tooltip-autocomplete": { fontFamily: "'Victor Mono', 'Noto Sans SC', monospace", fontSize: "10px" },
                                        ".cm-completionLabel": { fontFamily: "'Victor Mono', 'Noto Sans SC', monospace", fontSize: "10px" },
                                        ".cm-completionDetail": { fontFamily: "'Victor Mono', 'Noto Sans SC', monospace", fontSize: "10px", color: "#75715e" }
                                    }, { dark: true })
                                ]}
                                onChange={(value) => updateActiveTab({ code: value })}
                                className="h-full text-[10px]"
                                basicSetup={{
                                    lineNumbers: true,
                                    foldGutter: true,
                                    dropCursor: true,
                                    allowMultipleSelections: true,
                                    indentOnInput: true,
                                }}
                            />
                        </div>
                    </div>

                    {/* Resizer Handle */}
                    <div
                        onMouseDown={startDragging}
                        className="h-2 bg-monokai-bg hover:bg-monokai-blue cursor-row-resize z-20 flex items-center justify-center transition-colors group"
                    >
                        <div className="w-8 h-1 rounded-full bg-monokai-accent group-hover:bg-white"></div>
                    </div>

                    {/* Results Area */}
                    <div className="flex flex-col gap-0 flex-1 min-h-0 border border-monokai-accent rounded-b-lg bg-monokai-bg relative">
                        {/* View Toggles */}
                        <div className="flex justify-between items-center bg-monokai-surface p-2 border-b border-monokai-accent shrink-0">
                            <div className="flex gap-1 bg-monokai-bg p-0.5 rounded border border-monokai-accent/30">
                                <button onClick={() => updateActiveTab({ viewMode: 'table' })} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded ${activeTab.viewMode === 'table' ? 'bg-monokai-accent text-monokai-fg shadow-sm' : 'text-monokai-comment hover:text-monokai-fg'}`}>Table</button>
                                <button onClick={() => updateActiveTab({ viewMode: 'chart' })} disabled={!activeTab.result || activeTab.result.rows.length === 0 || activeTab.result.isExplain} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded ${activeTab.viewMode === 'chart' ? 'bg-monokai-accent text-monokai-pink shadow-sm' : 'text-monokai-comment hover:text-monokai-pink disabled:opacity-30'}`}>Chart</button>
                                {activeTab.result?.isExplain && <button onClick={() => updateActiveTab({ viewMode: 'explain' })} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-monokai-purple text-monokai-fg">Plan</button>}
                                <button onClick={() => updateActiveTab({ viewMode: 'profiling' })} disabled={!activeTab.code.trim()} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded ${activeTab.viewMode === 'profiling' ? 'bg-monokai-accent text-monokai-fg shadow-sm' : 'text-monokai-comment hover:text-monokai-fg disabled:opacity-30'}`}>Profiling</button>
                            </div>
                            {activeTab.viewMode === 'chart' && (
                                <div className="flex items-center gap-2">
                                    {/* Source indicator for metric charts */}
                                    {activeTab.charts?.some(c => c.source === 'metric') && (
                                        <span className="text-xs bg-monokai-purple/20 text-monokai-purple px-2 py-0.5 rounded flex items-center gap-1">
                                            <BarChart2 size={10} />
                                            指标图表
                                        </span>
                                    )}
                                    <button
                                        onClick={() => { setEditingChartId(null); setShowChartBuilder(true); }}
                                        className="ml-2 px-3 py-1 bg-monokai-green text-monokai-bg font-bold rounded text-[10px] uppercase tracking-wider hover:opacity-90 flex items-center gap-1 transition-transform active:scale-95"
                                    >
                                        <Plus size={12} /> New Visualization
                                    </button>
                                    <button
                                        onClick={() => onRun()}
                                        className="px-2 py-1 bg-monokai-blue/20 text-monokai-blue hover:bg-monokai-blue hover:text-monokai-bg rounded text-[10px] flex items-center gap-1"
                                        title="刷新图表数据"
                                    >
                                        <RefreshCw size={12} /> 刷新
                                    </button>
                                    <select
                                        value={autoRefreshInterval}
                                        onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                                        className="px-2 py-1 bg-monokai-bg border border-monokai-accent/30 rounded text-[10px] text-monokai-comment"
                                        title="自动刷新间隔"
                                    >
                                        <option value={0}>自动刷新: 关闭</option>
                                        <option value={5}>5秒</option>
                                        <option value={10}>10秒</option>
                                        <option value={30}>30秒</option>
                                        <option value={60}>1分钟</option>
                                        <option value={300}>5分钟</option>
                                    </select>
                                </div>
                            )}

                            {activeTab.result && !activeTab.result.error && !activeTab.result.isExplain && (
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-2 bg-monokai-sidebar border border-monokai-accent/30 rounded px-2 py-0.5 mr-2">
                                        <Search size={12} className="text-monokai-comment shrink-0" />
                                        <input
                                            className="bg-transparent border-none outline-none text-xs text-monokai-fg placeholder-monokai-comment/50 w-32 focus:w-48 transition-all"
                                            placeholder="Filter results..."
                                            value={activeTab.filterTerm}
                                            onChange={(e) => updateActiveTab({ filterTerm: e.target.value, page: 0 })}
                                        />
                                        {activeTab.filterTerm && <button onClick={() => updateActiveTab({ filterTerm: '' })} className="text-monokai-pink hover:text-monokai-fg"><X size={12} /></button>}
                                    </div>

                                    {maxPage > 0 && activeTab.viewMode === 'table' && (
                                        <div className="flex items-center gap-1 mr-2 bg-monokai-bg rounded px-1 border border-monokai-accent/30">
                                            <button onClick={() => updateActiveTab({ page: Math.max(0, activeTab.page - 1) })} disabled={activeTab.page === 0} className="text-monokai-comment hover:text-monokai-fg disabled:opacity-30 px-2 py-0.5"><ChevronLeft size={14} /></button>
                                            <span className="text-[10px] font-mono w-12 text-center text-monokai-fg">{activeTab.page + 1}/{maxPage + 1}</span>
                                            <button onClick={() => updateActiveTab({ page: Math.min(maxPage, activeTab.page + 1) })} disabled={activeTab.page === maxPage} className="text-monokai-comment hover:text-monokai-fg disabled:opacity-30 px-2 py-0.5"><ChevronRight size={14} /></button>
                                        </div>
                                    )}
                                    <div className="flex border border-monokai-accent/30 rounded overflow-hidden">
                                        <button onClick={() => copyToClipboard('tsv')} className="text-[10px] bg-monokai-sidebar hover:bg-monokai-accent px-2 py-1 border-r border-monokai-accent/30 flex items-center" title="Copy TSV"><Copy size={11} className="text-monokai-comment" /></button>
                                        <button onClick={() => copyToClipboard('md')} className="text-[10px] bg-monokai-sidebar hover:bg-monokai-accent px-2 py-1 border-r border-monokai-accent/30 flex items-center" title="Copy MD"><FileText size={11} className="text-monokai-comment" /></button>
                                        <button onClick={() => copyToClipboard('html')} className="text-[10px] bg-monokai-sidebar hover:bg-monokai-accent px-2 py-1 flex items-center" title="Copy HTML"><Globe size={11} className="text-monokai-comment" /></button>
                                    </div>
                                    <div className="relative">
                                        <button onClick={() => setShowExportMenu(!showExportMenu)} className="text-[10px] bg-monokai-blue/10 text-monokai-blue hover:bg-monokai-blue hover:text-monokai-bg px-2 py-1 rounded font-bold transition-colors">Export ▼</button>
                                        {showExportMenu && (
                                            <div className="absolute right-0 bottom-full mb-1 bg-monokai-sidebar border border-monokai-accent p-1 rounded shadow-xl z-30 min-w-[100px] flex flex-col gap-0.5">
                                                <button onClick={() => downloadResult('csv')} className="text-xs text-left px-2 py-1 hover:bg-monokai-accent rounded text-monokai-fg">CSV</button>
                                                <button onClick={() => downloadResult('excel')} className="text-xs text-left px-2 py-1 hover:bg-monokai-accent rounded text-monokai-fg">Excel (.xlsx/.xls)</button>
                                                <button onClick={() => downloadResult('json')} className="text-xs text-left px-2 py-1 hover:bg-monokai-accent rounded text-monokai-fg">JSON</button>
                                                <button onClick={() => downloadResult('parquet')} className="text-xs text-left px-2 py-1 hover:bg-monokai-accent rounded text-monokai-orange">Parquet</button>
                                                <button onClick={() => handleExportHtmlReport()} className="text-xs text-left px-2 py-1 hover:bg-monokai-accent rounded text-monokai-green font-bold">HTML Report</button>
                                            </div>
                                        )}
                                        {showExportMenu && <div className="fixed inset-0 z-20" onClick={() => setShowExportMenu(false)} />}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 bg-monokai-surface overflow-hidden relative">
                            {/* ... Result Content ... */}
                            {activeTab.result?.error ? (
                                <SqlEditorErrorView
                                    error={activeTab.result.error}
                                    isFixing={ai.isFixing}
                                    isAiLoading={ai.isAiLoading}
                                    hasCode={!!activeTab.code.trim()}
                                    onFixWithAi={handleAiFix}
                                    onContinueOptimize={() => handleAiContinueOptimize('improve')}
                                />
                            ) : activeTab.loading ? (
                                <div className="p-4 text-monokai-comment text-center h-full flex items-center justify-center flex-col gap-4">
                                    <div className="w-12 h-12 border-4 border-monokai-blue border-t-transparent rounded-full animate-spin"></div>
                                    <div className="animate-pulse tracking-widest text-xs uppercase font-bold">Executing Query...</div>
                                </div>
                            ) : !activeTab.result ? (
                                <div className="p-4 text-monokai-comment/30 text-center h-full flex items-center justify-center flex-col gap-4 select-none">
                                    <Terminal size={48} className="animate-bounce" />
                                    <div className="text-sm">Cmd/Ctrl + Enter to run</div>
                                    <div className="flex gap-2 text-xs">
                                        <span className="bg-monokai-sidebar px-2 py-1 rounded border border-monokai-accent">SELECT</span>
                                        <span className="bg-monokai-sidebar px-2 py-1 rounded border border-monokai-accent">FROM</span>
                                        <span className="bg-monokai-sidebar px-2 py-1 rounded border border-monokai-accent">WHERE</span>
                                    </div>
                                </div>
                            ) : activeTab.viewMode === 'explain' ? (
                                <SqlEditorExplainView result={activeTab.result} />
                            ) : activeTab.viewMode === 'profiling' ? (
                                <SqlEditorProfilingView sql={activeTab.code} />
                            ) : activeTab.viewMode === 'table' ? (
                                <SqlEditorResultTable
                                    result={activeTab.result}
                                    filterTerm={activeTab.filterTerm}
                                    page={activeTab.page}
                                    pageSize={PAGE_SIZE}
                                    onFilterTermChange={(v) => updateActiveTab({ filterTerm: v, page: 0 })}
                                    onPageChange={(v) => updateActiveTab({ page: v })}
                                />
                            ) : (
                                <div className="h-full flex flex-col p-4 bg-monokai-surface">
                                    {(!activeTab.charts || activeTab.charts.length === 0) ? (
                                        <div className="flex flex-col items-center justify-center h-full text-monokai-comment opacity-50">
                                            <BarChart2 size={48} className="mb-4" />
                                            <p>No visualizations yet.</p>
                                            <p className="text-xs mt-2">Click "New Visualization" above to create one.</p>
                                        </div>
                                    ) : (
                                        <ChartDashboard
                                            charts={activeTab.charts}
                                            data={activeTab.result?.rows || []}
                                            onEdit={(id) => { setEditingChartId(id); setShowChartBuilder(true); }}
                                            onDelete={(id) => {
                                                const updated = activeTab.charts.filter(c => c.id !== id);
                                                updateActiveTab({ charts: updated });
                                            }}
                                        />
                                    )}
                                </div>
                            )}

                            {/* Chart Builder Modal */}
                            {showChartBuilder && activeTab.result && (
                                <ChartBuilder
                                    columns={activeTab.result.columns}
                                    data={activeTab.result.rows}
                                    initialConfig={editingChartId ? activeTab.charts.find(c => c.id === editingChartId) : undefined}
                                    onCancel={() => setShowChartBuilder(false)}
                                    onSave={(config) => {
                                        let updatedCharts;
                                        const currentCharts = activeTab.charts || [];
                                        if (editingChartId) {
                                            updatedCharts = currentCharts.map(c => c.id === editingChartId ? config : c);
                                        } else {
                                            updatedCharts = [...currentCharts, config];
                                        }
                                        updateActiveTab({ charts: updatedCharts });
                                        setShowChartBuilder(false);
                                    }}
                                />
                            )}

                            {/* Skill Assistant Modal */}
                            {showSkillAssistant && (
                                <SkillAssistant
                                    isOpen={showSkillAssistant}
                                    onClose={() => setShowSkillAssistant(false)}
                                    onInsertSql={(sql) => insertText('\n' + sql)}
                                    currentTable={(getActiveTab() as any)?.selectedTable}
                                    currentColumns={activeTab?.result?.columns as any}
                                />
                            )}
                        </div>
                    </div>

                    {/* Footer Status Bar */}
                    {
                        activeTab.result && !activeTab.result.error && (
                            <div className="bg-monokai-surface border-t border-monokai-accent px-4 py-1.5 flex justify-between items-center text-[10px] font-mono text-monokai-comment select-none">
                                <div className="flex gap-6">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-monokai-green shadow-[0_0_5px_rgba(166,226,46,0.5)]"></span>
                                        <span className="text-monokai-green font-bold">Success</span>
                                    </div>
                                    {hasMismatchedBrackets && (
                                        <div className="flex items-center gap-1 text-monokai-orange font-bold text-[9px] bg-monokai-orange/10 border border-monokai-orange/30 px-2 py-0.5 rounded animate-pulse">
                                            <AlertTriangle size={10} className="shrink-0" />
                                            <span>括号不匹配</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                        <Table size={11} className="text-monokai-comment" />
                                        <span className="text-monokai-fg">
                                            <span className="text-monokai-fg font-bold">{filteredRows.length}</span> rows
                                            {filteredRows.length !== allRows.length && <span className="opacity-50"> (filtered from {allRows.length})</span>}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={11} className="text-monokai-comment" />
                                        <span className="text-monokai-fg"><span className="text-monokai-fg font-bold">{activeTab.result.executionTime.toFixed(2)}</span> ms</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Layout size={11} className="text-monokai-comment" />
                                        <span className="text-monokai-fg">{activeTab.result.columns.length} columns</span>
                                    </div>
                                    {dbStats && (
                                        <div className="flex items-center gap-1.5 border-l border-monokai-accent/30 pl-3">
                                            <Database size={11} className="text-monokai-comment" />
                                            <span>RAM: <strong className="text-monokai-cyan">{dbStats.memoryUsage}</strong> / {dbStats.memoryLimit}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {/* AI 优化快捷入口 */}
                                    {activeTab.code.trim() && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleAiContinueOptimize('improve')}
                                                disabled={isAiLoading}
                                                className="flex items-center gap-1 px-2 py-0.5 bg-monokai-green/10 hover:bg-monokai-green/20 text-monokai-green/80 hover:text-monokai-green rounded transition-colors text-[9px]"
                                                title="优化 SQL"
                                            >
                                                <Sparkles size={10} />
                                                优化
                                            </button>
                                            <button
                                                onClick={() => handleAiContinueOptimize('explain')}
                                                disabled={isAiLoading}
                                                className="flex items-center gap-1 px-2 py-0.5 bg-monokai-purple/10 hover:bg-monokai-purple/20 text-monokai-purple/80 hover:text-monokai-purple rounded transition-colors text-[9px]"
                                                title="解释 SQL"
                                            >
                                                <Lightbulb size={10} />
                                                解释
                                            </button>
                                            <button
                                                onClick={() => handleAiContinueOptimize('adapt')}
                                                disabled={isAiLoading}
                                                className="flex items-center gap-1 px-2 py-0.5 bg-monokai-blue/10 hover:bg-monokai-blue/20 text-monokai-blue/80 hover:text-monokai-blue rounded transition-colors text-[9px]"
                                                title="适配 DuckDB"
                                            >
                                                <Wand2 size={10} />
                                                适配
                                            </button>
                                        </div>
                                    )}
                                    <div className="opacity-50 hover:opacity-100 transition-opacity">
                                        DuckDB WASM
                                    </div>
                                </div>
                            </div>
                        )
                    }
                </div >
                {/* Sidebar (Schema/History) */}
                {
                    !isZenMode && (
                        <div className="w-64 bg-monokai-bg border-l border-monokai-accent/60 flex flex-col shrink-0 overflow-hidden">
                            {/* Tab Navigation */}
                            <div className="flex gap-0.5 p-1 bg-monokai-surface/50 border-b border-monokai-accent/40">
                                {([
                                    { key: 'schema', icon: <Database size={10} />, label: 'Schema' },
                                    { key: 'history', icon: <Clock size={10} />, label: 'History' },
                                    { key: 'saved', icon: <Save size={10} />, label: 'Saved' },
                                    { key: 'help', icon: <HelpCircle size={10} />, label: 'Help' },
                                ] as const).map(({ key, icon, label }) => (
                                    <button
                                        key={key}
                                        onClick={() => setActiveSidebarTab(key)}
                                        className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 text-[9px] font-bold rounded transition-all ${activeSidebarTab === key
                                                ? 'bg-monokai-bg text-monokai-accent shadow-sm'
                                                : 'text-monokai-comment/50 hover:text-monokai-comment hover:bg-monokai-bg/60'
                                            }`}
                                    >
                                        {icon}
                                        <span>{label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 overflow-hidden flex flex-col">
                                {activeSidebarTab === 'schema' && (
                                    <div className="h-full"><TableTree tables={Object.keys(schemaTree)} onInsert={insertText} /></div>
                                )}
                                {activeSidebarTab === 'history' && (
                                    <SqlEditorHistory
                                        activeSidebarTab={activeSidebarTab}
                                        history={history}
                                        savedQueries={savedQueries}
                                        historyFilter={historyFilter}
                                        onHistoryFilterChange={e => setHistoryFilter(e.target.value)}
                                        onClearHistory={clearHistory}
                                        onHistoryItemClick={(sql) => insertText(sql)}
                                        onSavedQueryClick={(sql) => updateActiveTab({ code: sql })}
                                        onDeleteSavedQuery={deleteSavedQuery}
                                    />
                                )}
                                {activeSidebarTab === 'help' && (
                                    <SqlEditorHelpPanel
                                        selectedSqlType={selectedSqlType}
                                        onSelectedSqlTypeChange={setSelectedSqlType}
                                    />
                                )}
                            </div>
                        </div>
                    )
                }
            </div>
        </div>
    );
};