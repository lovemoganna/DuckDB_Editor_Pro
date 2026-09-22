import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Play, Save, FolderOpen, X, Plus, Clock, Database, ChevronRight, ChevronDown, ChevronLeft, Search, MoreVertical, Layout, Type, Download, Trash2, Maximize2, Minimize2, Table, BarChart2, FileText, Smartphone, Monitor, RefreshCw, Sparkles, Lightbulb, Zap, AlertTriangle, Target, Wand2, Eye, EyeOff, Code, Info, Loader2, RotateCcw, HelpCircle, MessageSquare, Copy, Check, Link, Link2, Wrench, Globe, Pin, Terminal, ClipboardList } from 'lucide-react';
import { duckDBService } from '../services/duckdbService';
import { dbService } from '../services/dbService';
import { aiService } from '../services/aiService';
import { toastService } from '../services/toastService';
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
import {
    SqlEditorHistory,
    SqlEditorTabs,
    SqlEditorToolbar,
    SaveQueryModal,
    MaterializeModal,
    AiDiffProposalModal,
    AiResultInsightsModal,
} from './SqlEditor/index';
import { AiCapabilityPromptModal } from './AiCapabilityLibrary/AiCapabilityPromptModal';
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
    'rgba(174, 129, 255, 0.8)', // Amethyst
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
    const aiProposal = useSqlEditorStore((s) => s.aiProposal);
    const setAiProposal = useSqlEditorStore((s) => s.setAiProposal);
    const aiResultInsights = useSqlEditorStore((s) => s.aiResultInsights);
    const setAiResultInsights = useSqlEditorStore((s) => s.setAiResultInsights);
    const aiCapabilityPromptModal = useSqlEditorStore((s) => s.aiCapabilityPromptModal);
    const setAiCapabilityPromptModal = useSqlEditorStore((s) => s.setAiCapabilityPromptModal);
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
    const execute = (explain = false, overrideSql?: string) => runExecute(explain, overrideSql ?? (selectionRef.current.trim() || undefined), cursorOffsetRef.current);

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
            toastService.success(`成功创建${materializeType === 'VIEW' ? '视图' : '数据表'}: ${materializeName}`);
            window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));
            onRun(); // Refresh global
        } catch (e: any) {
            toastService.error(`创建${materializeType === 'VIEW' ? '视图' : '数据表'}失败: ${e.message}`);
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
        if (!tab || tab.code === savedContentRef.current) return;
        if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
        if (!tab.code) {
            savedContentRef.current = '';
            setLastSavedAt(Date.now());
            try {
                const drafts = JSON.parse(localStorage.getItem('sql-editor-drafts') || '{}');
                drafts[tab.id] = { code: '', savedAt: Date.now() };
                localStorage.setItem('sql-editor-drafts', JSON.stringify(drafts));
            } catch { /* ignore */ }
            return;
        }
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

    // Restore draft on tab switch only if draft is explicitly present and tab code is undefined
    useEffect(() => {
        const tab = useSqlEditorStore.getState().getActiveTab();
        if (!tab || typeof tab.code !== 'undefined') return;
        try {
            const drafts = JSON.parse(localStorage.getItem('sql-editor-drafts') || '{}');
            const draft = drafts[tab.id];
            if (draft && typeof draft.code === 'string') {
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
        if (!tab) return;
        const currentCode = tab.code;
        const offset = cursorOffsetRef.current ?? currentCode.length;
        const before = currentCode.slice(0, offset);
        const after = currentCode.slice(offset);
        updateActiveTab({ code: before + text + after });
        cursorOffsetRef.current = offset + text.length;
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

    const renderViewSwitcher = () => (
        <div className="flex items-center gap-1 bg-monokai-bg/90 p-0.5 rounded-lg border border-monokai-border/70 shrink-0 select-none shadow-xs">
            <button 
                onClick={() => updateActiveTab({ viewMode: 'table' })} 
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[10.5px] font-mono font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                    activeTab.viewMode === 'table' 
                        ? 'bg-monokai-surface text-monokai-yellow shadow-xs border border-monokai-border' 
                        : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60 border border-transparent'
                }`}
                title="数据网格结果"
            >
                <Table size={11} className={activeTab.viewMode === 'table' ? 'text-monokai-yellow' : 'text-monokai-comment'} />
                <span>Table</span>
            </button>
            <button 
                onClick={() => updateActiveTab({ viewMode: 'chart' })} 
                disabled={!activeTab.result || activeTab.result.rows.length === 0 || activeTab.result.isExplain} 
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[10.5px] font-mono font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                    activeTab.viewMode === 'chart' 
                        ? 'bg-monokai-surface text-monokai-pink shadow-xs border border-monokai-border' 
                        : 'text-monokai-comment hover:text-monokai-pink disabled:opacity-30 disabled:cursor-not-allowed border border-transparent'
                }`}
                title="可视化图表"
            >
                <BarChart2 size={11} className={activeTab.viewMode === 'chart' ? 'text-monokai-pink' : 'text-monokai-comment'} />
                <span>Chart</span>
            </button>
            {activeTab.result?.isExplain && (
                <button 
                    onClick={() => updateActiveTab({ viewMode: 'explain' })} 
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[10.5px] font-mono font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                        activeTab.viewMode === 'explain'
                            ? 'bg-monokai-surface text-monokai-amethyst shadow-xs border border-monokai-border'
                            : 'text-monokai-comment hover:text-monokai-amethyst border border-transparent'
                    }`}
                    title="执行计划 DAG 与拓扑"
                >
                    <FileText size={11} className={activeTab.viewMode === 'explain' ? 'text-monokai-amethyst' : 'text-monokai-comment'} />
                    <span>Plan</span>
                </button>
            )}
            <button 
                onClick={() => updateActiveTab({ viewMode: 'profiling' })} 
                disabled={!activeTab.code.trim()} 
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[10.5px] font-mono font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                    activeTab.viewMode === 'profiling' 
                        ? 'bg-monokai-surface text-monokai-blue shadow-xs border border-monokai-border' 
                        : 'text-monokai-comment hover:text-monokai-blue disabled:opacity-30 disabled:cursor-not-allowed border border-transparent'
                }`}
                title="算子级性能耗时剖析"
            >
                <Zap size={11} className={activeTab.viewMode === 'profiling' ? 'text-monokai-blue' : 'text-monokai-comment'} />
                <span>Profiling</span>
            </button>
        </div>
    );

    return (
        <div className="context-ide-sql flex flex-col h-full gap-0 overflow-hidden bg-monokai-bg relative" data-context-ide="sql">
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
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 p-4">
                    <div className="bg-monokai-sidebar border border-monokai-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col text-monokai-fg">
                        {/* 头部 */}
                        <div className="flex items-center justify-between px-5 py-4 bg-monokai-bg/90 border-b border-monokai-border shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-monokai-amethyst/15 border border-monokai-border flex items-center justify-center">
                                    <Sparkles className="w-4 h-4 text-monokai-amethyst" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-monokai-fg">AI SQL 逻辑解读与诊断</h3>
                                    <p className="text-[10px] text-monokai-comment">深度剖析当前查询计算逻辑、关键过滤项与执行意图</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAiExplanation(false)}
                                className="w-7 h-7 rounded-lg hover:bg-monokai-surface flex items-center justify-center text-monokai-comment hover:text-monokai-pink transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* 原始 SQL */}
                        <div className="px-5 py-3 bg-monokai-bg/60 border-b border-monokai-border/60 shrink-0">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <Code className="w-3.5 h-3.5 text-monokai-comment" />
                                <span className="text-[10.5px] font-mono font-semibold text-monokai-comment uppercase tracking-wider">原始 SQL</span>
                            </div>
                            <pre className="text-xs text-monokai-fg/85 font-mono whitespace-pre-wrap bg-monokai-surface/60 p-2.5 rounded-lg border border-monokai-border/60 max-h-24 overflow-auto custom-scrollbar">
                                {activeTab.code}
                            </pre>
                        </div>

                        {/* 解释内容 */}
                        <div className="p-5 overflow-auto flex-1 text-sm text-monokai-fg leading-relaxed custom-scrollbar bg-monokai-sidebar/40">
                            <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h1: ({children}) => <h1 className="text-base font-bold text-monokai-amethyst mb-2.5 mt-2 border-b border-monokai-border/40 pb-1">{children}</h1>,
                                    h2: ({children}) => <h2 className="text-sm font-bold text-monokai-blue mb-2 mt-3">{children}</h2>,
                                    h3: ({children}) => <h3 className="text-xs font-semibold text-monokai-yellow mb-1 mt-2">{children}</h3>,
                                    p: ({children}) => <p className="mb-2.5 leading-relaxed text-xs text-monokai-fg/90">{children}</p>,
                                    ul: ({children}) => <ul className="list-disc list-inside mb-2.5 space-y-1 ml-2 text-xs">{children}</ul>,
                                    ol: ({children}) => <ol className="list-decimal list-inside mb-2.5 space-y-1 ml-2 text-xs">{children}</ol>,
                                    li: ({children}) => <li className="text-monokai-fg/90">{children}</li>,
                                    strong: ({children}) => <strong className="text-monokai-pink font-semibold">{children}</strong>,
                                    em: ({children}) => <em className="text-monokai-yellow not-italic font-mono">{children}</em>,
                                    code: ({className, children}) => {
                                        const match = /language-(\w+)/.exec(className || '');
                                        const isInline = !match && !className;
                                        if (isInline) {
                                            return <code className="bg-monokai-bg px-1.5 py-0.5 rounded text-monokai-amethyst text-xs font-mono border border-monokai-border/40">{children}</code>;
                                        }
                                        return <code className="block bg-monokai-bg p-3 rounded-lg border border-monokai-border/60 text-xs font-mono overflow-x-auto mb-2 text-monokai-fg">{children}</code>;
                                    },
                                    pre: ({children}) => <pre className="mb-2">{children}</pre>,
                                    a: ({href, children}) => <a href={href} className="text-monokai-blue hover:underline font-medium">{children}</a>,
                                    blockquote: ({children}) => <blockquote className="border-l-4 border-monokai-border pl-3 italic text-monokai-comment mb-2.5 bg-monokai-bg/40 py-1 rounded-r">{children}</blockquote>,
                                }}
                            >
                                {aiExplanation}
                            </ReactMarkdown>
                        </div>

                        {/* 底部按钮 */}
                        <div className="flex justify-between items-center px-5 py-3.5 bg-monokai-bg/90 border-t border-monokai-border shrink-0">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(aiExplanation);
                                        showToast('已复制 AI 解释内容到剪贴板', 'success');
                                    }}
                                    className="px-3 py-1.5 text-xs font-medium text-monokai-fg bg-monokai-surface hover:bg-monokai-surface/80 border border-monokai-border/60 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                                >
                                    <Copy size={12} className="text-monokai-comment" />
                                    <span>复制解释</span>
                                </button>
                                {aiExplanationHistory.length > 0 && (
                                    <button
                                        onClick={async () => {
                                            if (confirm('确定要清除所有解释历史吗？')) {
                                                await clearAllExplanations();
                                                setAiExplanationHistory([]);
                                            }
                                        }}
                                        className="px-3 py-1.5 text-xs font-medium text-monokai-pink/80 hover:text-monokai-pink hover:bg-monokai-pink/15 rounded-lg transition-colors cursor-pointer"
                                    >
                                        清除历史
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => setShowAiExplanation(false)}
                                className="px-4 py-1.5 text-xs font-bold text-monokai-bg bg-monokai-amethyst hover:brightness-110 rounded-lg transition-all cursor-pointer shadow-xs active:scale-95"
                            >
                                我知道了
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
            <AiDiffProposalModal
                isOpen={Boolean(aiProposal?.isOpen)}
                title={aiProposal?.title || 'AI 差异优化提案'}
                explanation={aiProposal?.explanation || ''}
                originalSql={aiProposal?.originalSql || ''}
                proposedSql={aiProposal?.proposedSql || ''}
                onApply={(finalSql) => {
                    updateActiveTab({ code: finalSql });
                    setAiProposal(null);
                    showToast('已成功应用 AI 优化代码', 'success');
                }}
                onClose={() => setAiProposal(null)}
            />
            <AiResultInsightsModal
                isOpen={Boolean(aiResultInsights?.isOpen)}
                result={aiResultInsights?.result || null}
                insightMarkdown={aiResultInsights?.insightMarkdown || ''}
                isLoading={Boolean(aiResultInsights?.isLoading)}
                onClose={() => setAiResultInsights(null)}
            />
            <AiCapabilityPromptModal
                modalData={aiCapabilityPromptModal}
                onClose={() => setAiCapabilityPromptModal(null)}
            />


            <div className="flex flex-1 min-h-0">
                {/* Sidebar (Schema/History) */}
                {
                    !isZenMode && (
                        <div className="w-64 bg-monokai-sidebar border-r border-monokai-border flex flex-col shrink-0 overflow-hidden relative select-none animate-in slide-in-from-left duration-150">
                            {/* Tab Navigation */}
                            <div className="flex p-1 bg-monokai-surface/60 border-b border-monokai-border/80 shrink-0 gap-0.5">
                                {([
                                    { key: 'schema', icon: <Database size={11} />, label: 'Schema', count: Object.keys(schemaTree).length },
                                    { key: 'history', icon: <Clock size={11} />, label: 'History', count: history.length },
                                    { key: 'saved', icon: <Save size={11} />, label: 'Saved', count: savedQueries.length },
                                    { key: 'help', icon: <HelpCircle size={11} />, label: 'Help', count: undefined },
                                ] as const).map(({ key, icon, label, count }) => (
                                    <button
                                        key={key}
                                        onClick={() => setActiveSidebarTab(key)}
                                        className={`flex-1 flex items-center justify-center gap-1 py-1 text-[10.5px] font-mono font-medium rounded-md transition-all cursor-pointer ${
                                            activeSidebarTab === key
                                                ? 'bg-monokai-bg text-monokai-yellow shadow-xs border border-monokai-border font-semibold'
                                                : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/80 border border-transparent'
                                        }`}
                                        title={`${label}${count !== undefined ? ` (${count})` : ''}`}
                                    >
                                        {icon}
                                        <span>{label}</span>
                                        {count !== undefined && count > 0 && (
                                            <span className={`text-[8.5px] px-1 rounded ${
                                                activeSidebarTab === key
                                                    ? 'bg-monokai-yellow/20 text-monokai-yellow'
                                                    : 'bg-monokai-surface text-monokai-comment'
                                            }`}>
                                                {count}
                                            </span>
                                        )}
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
                                {activeSidebarTab === 'saved' && (
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
                                        onInsertSnippet={insertText}
                                    />
                                )}
                            </div>
                        </div>
                    )
                }

                <div className="flex flex-col gap-0 flex-1 min-w-0 relative">
                    {/* Editor Area with Tabs */}
                    <div
                        className="flex flex-col gap-0 min-h-[100px] border-b border-monokai-border bg-monokai-bg overflow-hidden relative"
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
                                            <Eye className="w-4 h-4 text-monokai-amethyst" />
                                            <span className="text-xs font-bold text-monokai-fg">SQL 格式化预览</span>
                                            {isGeneratingPreview && <Loader2 className="w-3 h-3 animate-spin text-monokai-amethyst" />}
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
                                        "&": { backgroundColor: "#272822", color: "#f8f8f2", fontFamily: "'Victor Mono', 'JetBrains Mono', Consolas, Menlo, Monaco, monospace", fontSize: "12px" },
                                        ".cm-gutters": { backgroundColor: "#272822", color: "#75715e", border: "none", fontSize: "12px" },
                                        ".cm-activeLine": { backgroundColor: "rgba(73, 72, 62, .15)" },
                                        ".cm-activeLineGutter": { backgroundColor: "rgba(73, 72, 62, .15)" },
                                        ".cm-content": { fontFamily: "'Victor Mono', 'JetBrains Mono', Consolas, Menlo, Monaco, monospace", fontSize: "12px", lineHeight: "1.6", fontVariantLigatures: "none" },
                                        ".cm-line": { fontFamily: "'Victor Mono', 'JetBrains Mono', Consolas, Menlo, Monaco, monospace", fontSize: "12px", lineHeight: "1.6" },
                                    }, { dark: true })
                                ]}
                                onChange={(value) => updateActiveTab({ code: value })}
                                className="h-full text-xs"
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
                        onDoubleClick={() => setEditorHeightPercent(50)}
                        className="h-1.5 bg-monokai-sidebar hover:bg-monokai-blue/40 active:bg-monokai-blue/60 cursor-row-resize z-20 flex items-center justify-center transition-colors group select-none border-t border-b border-monokai-border/40"
                        title="拖拽调整编辑器与结果区比例 (双击重置为 50/50)"
                    >
                        <div className="w-8 h-0.5 rounded-full bg-monokai-comment/40 group-hover:bg-monokai-blue transition-colors"></div>
                    </div>

                    {/* Results Area */}
                    <div className="flex flex-col gap-0 flex-1 min-h-0 bg-monokai-bg relative overflow-hidden">
                        {/* Unified Result Header for non-table views, error, or empty/loading states */}
                        {!(activeTab.viewMode === 'table' && activeTab.result && !activeTab.result.error) && (
                            <div className="h-9 flex items-center justify-between px-3 bg-monokai-sidebar/95 border-b border-monokai-border shrink-0 select-none">
                                <div className="flex items-center gap-2">
                                    {renderViewSwitcher()}
                                </div>
                                {activeTab.viewMode === 'chart' && (
                                    <div className="flex items-center gap-2">
                                        {/* Source indicator for metric charts */}
                                        {activeTab.charts?.some(c => c.source === 'metric') && (
                                            <span className="text-[11px] bg-monokai-purple/20 text-monokai-purple px-2 py-0.5 rounded flex items-center gap-1">
                                                <BarChart2 size={11} />
                                                指标图表
                                            </span>
                                        )}
                                        <button
                                            onClick={() => { setEditingChartId(null); setShowChartBuilder(true); }}
                                            className="px-2.5 py-1 bg-monokai-green text-monokai-bg font-semibold rounded text-xs hover:opacity-90 flex items-center gap-1 transition-transform active:scale-95 cursor-pointer"
                                        >
                                            <Plus size={13} /> 新建可视化
                                        </button>
                                        <button
                                            onClick={() => onRun()}
                                            className="px-2.5 py-1 bg-monokai-blue/20 text-monokai-blue hover:bg-monokai-blue hover:text-monokai-bg rounded text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                            title="刷新图表数据"
                                        >
                                            <RefreshCw size={12} /> 刷新
                                        </button>
                                        <select
                                            value={autoRefreshInterval}
                                            onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                                            className="px-2 py-1 bg-monokai-bg border border-monokai-border rounded text-xs text-monokai-comment outline-none cursor-pointer"
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
                            </div>
                        )}

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
                                    <div className="w-10 h-10 border-3 border-monokai-blue border-t-transparent rounded-full animate-spin"></div>
                                    <div className="tracking-wider text-xs font-mono text-monokai-comment">Executing Query...</div>
                                </div>
                            ) : !activeTab.result ? (
                                <div className="p-6 text-center h-full flex items-center justify-center flex-col gap-3 select-none">
                                    <div className="w-12 h-12 rounded-xl bg-monokai-sidebar border border-monokai-border/60 flex items-center justify-center text-monokai-comment/60 shadow-inner">
                                        <Terminal size={22} className="text-monokai-comment/80" />
                                    </div>
                                    <div className="text-xs text-monokai-comment flex items-center gap-1.5 font-medium">
                                        <span>按</span>
                                        <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-monokai-sidebar border border-monokai-border rounded text-monokai-fg shadow-xs">
                                            Ctrl
                                        </kbd>
                                        <span>+</span>
                                        <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-monokai-sidebar border border-monokai-border rounded text-monokai-fg shadow-xs">
                                            Enter
                                        </kbd>
                                        <span>执行查询或选中代码</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-monokai-comment/60">
                                        <span>常用技巧：支持</span>
                                        <span className="font-mono text-monokai-comment/90">:param</span>
                                        <span>动态参数与智能补全</span>
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
                                    onOpenExplain={activeTab.result.isExplain ? () => updateActiveTab({ viewMode: 'explain' }) : undefined}
                                    onExportParquet={() => downloadResult('parquet')}
                                    onExportHtml={() => handleExportHtmlReport()}
                                    viewSwitcher={renderViewSwitcher()}
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

                    {/* Permanent Telemetry Status Bar */}
                    <div className="h-7.5 bg-monokai-sidebar/95 backdrop-blur-xs border-t border-monokai-border/70 px-3 flex justify-between items-center text-[11px] font-mono text-monokai-comment select-none shrink-0 z-20">
                        <div className="flex items-center gap-3.5">
                            {/* Engine & Query Status Indicator */}
                            {activeTab.loading ? (
                                <div className="flex items-center gap-1.5 text-monokai-blue bg-monokai-blue/10 border border-monokai-border px-2 py-0.5 rounded-md">
                                    <span className="w-2 h-2 rounded-full bg-monokai-blue animate-ping"></span>
                                    <span className="font-semibold text-[10.5px]">Executing...</span>
                                </div>
                            ) : activeTab.result?.error ? (
                                <div className="flex items-center gap-1.5 text-monokai-pink bg-monokai-pink/10 border border-monokai-border px-2 py-0.5 rounded-md">
                                    <span className="w-2 h-2 rounded-full bg-monokai-pink"></span>
                                    <span className="font-semibold text-[10.5px]">Query Error</span>
                                </div>
                            ) : activeTab.result ? (
                                <div className="flex items-center gap-1.5 text-monokai-green bg-monokai-green/10 border border-monokai-border px-2 py-0.5 rounded-md shadow-xs">
                                    <span className="w-2 h-2 rounded-full bg-monokai-green shadow-[0_0_6px_rgba(166,226,46,0.8)]"></span>
                                    <span className="font-semibold text-[10.5px]">Success</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 text-monokai-comment bg-monokai-surface/60 border border-monokai-border/50 px-2 py-0.5 rounded-md">
                                    <span className="w-2 h-2 rounded-full bg-monokai-comment/50"></span>
                                    <span className="text-[10.5px]">Ready</span>
                                </div>
                            )}

                            {hasMismatchedBrackets && (
                                <div className="flex items-center gap-1 text-monokai-orange font-medium text-[10px] bg-monokai-orange/15 border border-monokai-border px-2 py-0.5 rounded-md ">
                                    <AlertTriangle size={11} className="shrink-0 text-monokai-orange" />
                                    <span>括号未闭合</span>
                                </div>
                            )}

                            {activeTab.result && !activeTab.result.error && (
                                <div className="flex items-center gap-3 bg-monokai-bg/60 border border-monokai-border/60 px-2.5 py-0.5 rounded-md text-[10.5px]">
                                    <div className="flex items-center gap-1.5">
                                        <Table size={11} className="text-monokai-comment" />
                                        <span className="text-monokai-fg font-medium">
                                            <span className="font-bold tabular-nums">{filteredRows.length.toLocaleString()}</span> 行
                                            {filteredRows.length !== allRows.length && <span className="opacity-50"> (全 {allRows.length.toLocaleString()})</span>}
                                        </span>
                                    </div>
                                    <span className="text-monokai-border/80">•</span>
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={11} className="text-monokai-comment" />
                                        <span className="text-monokai-fg font-medium">
                                            <span className="font-bold text-monokai-yellow tabular-nums">{activeTab.result.executionTime.toFixed(1)}</span> ms
                                        </span>
                                    </div>
                                    <span className="text-monokai-border/80">•</span>
                                    <div className="flex items-center gap-1.5">
                                        <Layout size={11} className="text-monokai-comment" />
                                        <span className="text-monokai-fg font-medium tabular-nums">{activeTab.result.columns.length} 列</span>
                                    </div>
                                </div>
                            )}

                            {dbStats && (
                                <div className="hidden sm:flex items-center gap-1.5 border-l border-monokai-border/60 pl-3 text-[10.5px]">
                                    <Database size={11} className="text-monokai-comment" />
                                    <span>RAM: <strong className="text-monokai-cyan font-bold tabular-nums">{dbStats.memoryUsage}</strong> / {dbStats.memoryLimit}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2.5">
                            {/* AI 优化快捷入口 */}
                            {activeTab.code.trim() && (
                                <div className="hidden md:flex items-center gap-1 bg-monokai-surface/40 p-0.5 rounded-lg border border-monokai-border/40">
                                    <button
                                        onClick={() => handleAiContinueOptimize('improve')}
                                        disabled={isAiLoading}
                                        className="flex items-center gap-1 px-2 py-0.5 bg-monokai-green/10 hover:bg-monokai-green/20 text-monokai-green border border-monokai-border rounded transition-all text-[10.5px] font-semibold cursor-pointer active:scale-95"
                                        title="优化 SQL 结构与性能"
                                    >
                                        <Sparkles size={11} />
                                        <span>优化</span>
                                    </button>
                                    <button
                                        onClick={() => handleAiContinueOptimize('explain')}
                                        disabled={isAiLoading}
                                        className="flex items-center gap-1 px-2 py-0.5 bg-monokai-amethyst/10 hover:bg-monokai-amethyst/20 text-monokai-amethyst border border-monokai-border rounded transition-all text-[10.5px] font-semibold cursor-pointer active:scale-95"
                                        title="AI 深入解释 SQL"
                                    >
                                        <Lightbulb size={11} />
                                        <span>解释</span>
                                    </button>
                                    <button
                                        onClick={() => handleAiContinueOptimize('adapt')}
                                        disabled={isAiLoading}
                                        className="flex items-center gap-1 px-2 py-0.5 bg-monokai-blue/10 hover:bg-monokai-blue/20 text-monokai-blue border border-monokai-border rounded transition-all text-[10.5px] font-semibold cursor-pointer active:scale-95"
                                        title="适配 DuckDB 语法与函数"
                                    >
                                        <Wand2 size={11} />
                                        <span>适配</span>
                                    </button>
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-[10px] text-monokai-comment bg-monokai-bg/60 border border-monokai-border/60 px-2 py-0.5 rounded-md">
                                <span className="w-1.5 h-1.5 rounded-full bg-monokai-green"></span>
                                <span>DuckDB WASM</span>
                                <span className="border-l border-monokai-border/60 pl-1.5 font-mono text-[9.5px]">UTF-8</span>
                            </div>
                        </div>
                    </div>
                </div >
            </div>
        </div>
    );
};