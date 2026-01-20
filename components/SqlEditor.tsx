import React, { useState, useEffect, useRef } from 'react';
import { duckDBService } from '../services/duckdbService';
import { geminiService } from '../services/geminiService';
import { QueryResult, QueryHistoryItem, SavedQuery, ColumnInfo, ChartConfig } from '../types';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';
import { getTypeIcon } from '../App';
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
}

interface SqlTab {
    id: string;
    title: string;
    code: string;
    result: QueryResult | null;
    loading: boolean;
    viewMode: 'table' | 'chart' | 'explain';
    chartConfig: ChartConfig;
    page: number;
    filterTerm: string; // Client-side filter for results
}

const SNIPPETS = {
    'CTE': 'WITH cte_name AS (\n    SELECT * FROM table\n)\nSELECT * FROM cte_name;',
    'Window Rank': 'SELECT *, ROW_NUMBER() OVER (PARTITION BY col ORDER BY date DESC) as rn FROM table;',
    'JSON Extract': "SELECT json_extract_string(json_col, '$.key') as val FROM table;",
    'Date Trunc': "SELECT date_trunc('month', timestamp_col) as mth, COUNT(*) FROM table GROUP BY 1;",
    'Case When': "CASE \n    WHEN condition THEN 'A'\n    ELSE 'B'\nEND",
    'Join': "SELECT t1.*, t2.*\nFROM table1 t1\nJOIN table2 t2 ON t1.id = t2.id;",
    'Pivot': "PIVOT table ON col_name USING SUM(val_col);",
    'Macro': "CREATE MACRO pair_sum(a, b) AS a + b;"
};

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

const DEFAULT_CODE = "-- Type your SQL here or use AI to generate it\nSELECT * FROM _sys_audit_log ORDER BY log_time DESC;";

const MONOKAI_COLORS = [
    'rgba(249, 38, 114, 0.8)', // Pink
    'rgba(166, 226, 46, 0.8)', // Green
    'rgba(102, 217, 239, 0.8)', // Blue
    'rgba(253, 151, 31, 0.8)', // Orange
    'rgba(174, 129, 255, 0.8)', // Purple
    'rgba(230, 219, 116, 0.8)', // Yellow
];

export const SqlEditor: React.FC<SqlEditorProps> = ({ onRun, initialCode }) => {
  // --- Tab State Management ---
  const [tabs, setTabs] = useState<SqlTab[]>(() => {
      try {
          const saved = localStorage.getItem('duckdb_sql_tabs');
          if (saved) {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed) && parsed.length > 0) {
                  return parsed.map((t: any) => ({
                      ...t, 
                      result: null, 
                      loading: false, 
                      filterTerm: '',
                      chartConfig: {
                          ...t.chartConfig,
                          yKeys: t.chartConfig.yKeys || (t.chartConfig.yKey ? [t.chartConfig.yKey] : []),
                          yRightKeys: t.chartConfig.yRightKeys || [],
                          stacked: t.chartConfig.stacked || false,
                          horizontal: t.chartConfig.horizontal || false
                      }
                  }));
              }
          }
      } catch(e) {}
      return [{
          id: 'default-tab',
          title: 'Untitled Query',
          code: DEFAULT_CODE,
          result: null,
          loading: false,
          viewMode: 'table',
          chartConfig: { type: 'bar', xKey: '', yKeys: [], yRightKeys: [], stacked: false, horizontal: false },
          page: 0,
          filterTerm: ''
      }];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
      try {
          const saved = localStorage.getItem('duckdb_sql_tabs');
          if (saved) {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed) && parsed.length > 0) return parsed[0].id;
          }
      } catch(e) {}
      return 'default-tab';
  });
  
  // AI & Sidebar State
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'history' | 'saved' | 'schema' | 'cheatsheet'>('schema');
  
  // Data for Sidebar
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [schemaTree, setSchemaTree] = useState<Record<string, ColumnInfo[]>>({});
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [historyFilter, setHistoryFilter] = useState('');

  // Modals & Menus
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showMaterializeModal, setShowMaterializeModal] = useState(false);
  const [materializeType, setMaterializeType] = useState<'TABLE' | 'VIEW'>('TABLE');
  const [materializeName, setMaterializeName] = useState('');
  
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showSnippetsMenu, setShowSnippetsMenu] = useState(false);
  const [showYAxisMenu, setShowYAxisMenu] = useState(false);
  const [showYRightAxisMenu, setShowYRightAxisMenu] = useState(false);
  const [saveQueryName, setSaveQueryName] = useState('');
  const [saveAsWidget, setSaveAsWidget] = useState(false);
  const [widgetType, setWidgetType] = useState<'value' | 'table' | 'chart'>('table');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showMaterializeMenu, setShowMaterializeMenu] = useState(false);
  
  // Editing Tab Title
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');

  // Editor Splitter State
  const [editorHeightPercent, setEditorHeightPercent] = useState(50);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const chartRef = useRef<any>(null);
  const PAGE_SIZE = 50;

  // --- Initialization ---

  useEffect(() => {
      try {
          const hist = localStorage.getItem('duckdb_sql_history');
          if (hist) setHistory(JSON.parse(hist));
          const saved = localStorage.getItem('duckdb_saved_queries');
          if (saved) setSavedQueries(JSON.parse(saved));
          refreshSchema();
      } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
      if (initialCode) {
          setTabs(prev => {
              if (prev.length === 0) {
                  const newTab = createTabObject(initialCode);
                  setActiveTabId(newTab.id);
                  return [newTab];
              }
              return prev.map(t => t.id === activeTabId ? { ...t, code: initialCode } : t);
          });
      }
  }, [initialCode]);

  useEffect(() => {
      if (tabs.length > 0) {
          const toSave = tabs.map(t => ({
              ...t,
              result: null, 
              loading: false
          }));
          localStorage.setItem('duckdb_sql_tabs', JSON.stringify(toSave));
      }
  }, [tabs]);

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
      } catch(e) { console.error(e); }
  };

  // --- Tab Helpers ---

  const createTabObject = (code = DEFAULT_CODE): SqlTab => ({
      id: Date.now().toString(),
      title: 'Untitled Query',
      code,
      result: null,
      loading: false,
      viewMode: 'table',
      chartConfig: { type: 'bar', xKey: '', yKeys: [], yRightKeys: [], stacked: false, horizontal: false },
      page: 0,
      filterTerm: ''
  });

  const createNewTab = () => {
      const newTab = createTabObject();
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newTab.id);
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newTabs = tabs.filter(t => t.id !== id);
      if (newTabs.length === 0) {
          const defaultTab = createTabObject();
          setTabs([defaultTab]);
          setActiveTabId(defaultTab.id);
      } else {
          setTabs(newTabs);
          if (activeTabId === id) {
              setActiveTabId(newTabs[newTabs.length - 1].id);
          }
      }
  };

  const updateActiveTab = (updates: Partial<SqlTab>) => {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...updates } : t));
  };

  const getActiveTab = () => tabs.find(t => t.id === activeTabId) || tabs[0];

  const handleTitleDoubleClick = (tab: SqlTab) => {
      setEditingTitleId(tab.id);
      setTempTitle(tab.title);
  };

  const saveTitle = () => {
      if (editingTitleId) {
          setTabs(prev => prev.map(t => t.id === editingTitleId ? { ...t, title: tempTitle || 'Untitled' } : t));
          setEditingTitleId(null);
      }
  };

  // --- Execution Logic ---

  const execute = async (explain = false) => {
      const tab = getActiveTab();
      if (!tab || tab.loading) return;

      updateActiveTab({ loading: true, viewMode: explain ? 'explain' : 'table', page: 0, filterTerm: '' });
      
      const startTime = performance.now();
      let sqlToRun = tab.code;
      if (explain && !sqlToRun.toUpperCase().startsWith('EXPLAIN')) {
          sqlToRun = `EXPLAIN ${tab.code}`;
      }

      try {
          const upper = tab.code.trim().toUpperCase();
          let type = 'QUERY';
          if (upper.startsWith('INSERT')) type = 'INSERT';
          if (upper.startsWith('UPDATE')) type = 'UPDATE';
          if (upper.startsWith('DELETE')) type = 'DELETE';
          if (upper.startsWith('CREATE')) type = 'CREATE';
          if (upper.startsWith('DROP')) type = 'DELETE';
          if (upper.startsWith('ALTER')) type = 'ALTER';
          if (upper.startsWith('PIVOT')) type = 'QUERY';

          const tableMatch = tab.code.match(/(?:FROM|INTO|UPDATE|TABLE)\s+"?([a-zA-Z0-9_]+)"?/i);
          const table = tableMatch ? tableMatch[1] : null;

          let rows;
          if (explain) {
              rows = await duckDBService.query(sqlToRun);
          } else {
              rows = await duckDBService.executeAndAudit(sqlToRun, type, table, 'Executed via SQL Editor');
          }

          const endTime = performance.now();

          if (type === 'CREATE' || type === 'DROP' || type === 'ALTER') {
              refreshSchema();
          }

          const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
          
          let chartConfig = tab.chartConfig;
          if (!explain && columns.length >= 1) {
              // Try to find reasonable defaults: All numeric columns as Y keys
              const numericCols = columns.filter(c => typeof rows[0][c] === 'number');
              const yKeys = numericCols.length > 0 ? numericCols.slice(0, 3) : [columns[0]];
              const xCol = columns.find(c => !yKeys.includes(c)) || columns[0];
              
              chartConfig = {
                  ...chartConfig,
                  xKey: xCol,
                  yKeys: yKeys,
                  yRightKeys: [] // Reset right keys on new execution
              };
          }

          updateActiveTab({
              result: {
                  columns,
                  rows,
                  executionTime: endTime - startTime,
                  isExplain: explain
              },
              loading: false,
              chartConfig
          });

          if (!explain) saveToHistory(tab.code, 'success');
          onRun(); 

      } catch (e: any) {
          updateActiveTab({
              result: { columns: [], rows: [], executionTime: 0, error: e.message },
              loading: false
          });
          if (!explain) saveToHistory(tab.code, 'error');
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          execute();
      }
  };

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

  // --- AI & Tools ---

  const formatSql = () => {
      const tab = getActiveTab();
      if (!tab) return;
      let formatted = tab.code
        .replace(/\s+/g, ' ')
        .replace(/(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|INSERT|UPDATE|DELETE|CREATE|PIVOT)/gi, '\n$1')
        .replace(/;/g, ';\n')
        .trim();
      updateActiveTab({ code: formatted });
  };

  const handleAiGenerate = async () => {
      if (!aiPrompt.trim()) return;
      setIsAiLoading(true);
      try {
          const tables = await duckDBService.getTables();
          let schemaStr = "";
          for (const t of tables) {
              const cols = await duckDBService.getTableSchema(t);
              const colStr = cols.map(c => `${c.name} (${c.type})`).join(', ');
              schemaStr += `Table ${t}: [${colStr}]\n`;
          }
          const sql = await geminiService.generateSql(aiPrompt, schemaStr);
          updateActiveTab({ code: sql });
      } catch (e) { console.error(e); } 
      finally { setIsAiLoading(false); }
  };

  const handleAiFix = async () => {
      const tab = getActiveTab();
      if (!tab || !tab.result?.error) return;
      setIsFixing(true);
      try {
        const tables = await duckDBService.getTables();
        let schemaStr = "";
        for (const t of tables) {
            const cols = await duckDBService.getTableSchema(t);
            schemaStr += `Table ${t}: [${cols.map(c => c.name).join(',')}]\n`;
        }
        const fixedSql = await geminiService.fixSql(tab.code, tab.result.error, schemaStr);
        updateActiveTab({ code: fixedSql });
      } catch (e) { console.error(e); } 
      finally { setIsFixing(false); }
  };

  // --- Persistence Wrappers ---
  const saveToHistory = (sql: string, status: 'success' | 'error') => {
      const newItem: QueryHistoryItem = { id: Date.now().toString(), sql, timestamp: Date.now(), status };
      const updated = [newItem, ...history].slice(0, 50);
      setHistory(updated);
      localStorage.setItem('duckdb_sql_history', JSON.stringify(updated));
  };

  const clearHistory = () => {
      setHistory([]);
      localStorage.removeItem('duckdb_sql_history');
  };

  const handleSaveQuery = () => {
      const tab = getActiveTab();
      if (!tab || !saveQueryName.trim()) return;
      const newSaved: SavedQuery = {
          id: Date.now().toString(),
          name: saveQueryName,
          sql: tab.code,
          createdAt: Date.now(),
          pinned: saveAsWidget,
          widgetType: saveAsWidget ? widgetType : undefined,
          chartConfig: (saveAsWidget && widgetType === 'chart') ? tab.chartConfig : undefined
      };
      const updated = [...savedQueries, newSaved];
      setSavedQueries(updated);
      localStorage.setItem('duckdb_saved_queries', JSON.stringify(updated));
      setShowSaveModal(false);
      setSaveQueryName('');
      setSaveAsWidget(false);
      setActiveSidebarTab('saved');
  };

  const deleteSavedQuery = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updated = savedQueries.filter(q => q.id !== id);
      setSavedQueries(updated);
      localStorage.setItem('duckdb_saved_queries', JSON.stringify(updated));
  };

  // --- Sidebar Helpers ---
  const insertText = (text: string) => {
      const tab = getActiveTab();
      if (tab) updateActiveTab({ code: tab.code + text });
  };

  const toggleTableExpand = (table: string) => {
      const newSet = new Set(expandedTables);
      if (newSet.has(table)) newSet.delete(table); else newSet.add(table);
      setExpandedTables(newSet);
  };

  // --- Export ---
  const downloadResult = async (format: 'csv' | 'json' | 'parquet') => {
      const tab = getActiveTab();
      if (!tab || !tab.result || !tab.result.rows.length) return;
      
      const fileName = `query_result_${Date.now()}.${format}`;
      
      try {
          if (format === 'parquet') {
              const blob = await duckDBService.exportParquet(tab.code, 'export.parquet');
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = fileName;
              link.click();
          } else {
              let content = '', mime = '';
              const replacer = (key: string, value: any) => typeof value === 'bigint' ? value.toString() : value;
              
              if (format === 'json') {
                  content = JSON.stringify(tab.result.rows, replacer, 2);
                  mime = 'application/json';
              } else {
                  const headers = tab.result.columns.join(',');
                  const rows = tab.result.rows.map(r => 
                      tab.result!.columns.map(c => {
                          const v = r[c];
                          const safeV = typeof v === 'bigint' ? v.toString() : v;
                          return safeV === null ? '' : `"${String(safeV).replace(/"/g, '""')}"`;
                      }).join(',')
                  ).join('\n');
                  content = `${headers}\n${rows}`;
                  mime = 'text/csv';
              }
              const blob = new Blob([content], { type: mime });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = fileName;
              link.click();
          }
          setShowExportMenu(false);
      } catch(e) { alert("Export failed. Ensure query supports export."); }
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
      const { columns, rows } = tab.result;
      
      let text = '';
      if (mode === 'tsv') {
          text = columns.join('\t') + '\n' + rows.map(r => columns.map(c => r[c]).join('\t')).join('\n');
      } else if (mode === 'md') {
          const sep = `| ${columns.map(() => '---').join(' | ')} |`;
          const header = `| ${columns.join(' | ')} |`;
          const body = rows.map(r => `| ${columns.map(c => r[c]).join(' | ')} |`).join('\n');
          text = `${header}\n${sep}\n${body}`;
      } else if (mode === 'html') {
          const header = `<thead><tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>`;
          const body = `<tbody>${rows.map(r => `<tr>${columns.map(c => `<td>${r[c]}</td>`).join('')}</tr>`).join('')}</tbody>`;
          text = `<table border="1" cellspacing="0" cellpadding="5">\n${header}\n${body}\n</table>`;
      }
      navigator.clipboard.writeText(text);
  };

  const toggleYAxis = (col: string) => {
      const tab = getActiveTab();
      if(!tab) return;
      const current = new Set(tab.chartConfig.yKeys);
      // If adding to Left axis, remove from Right axis to keep mutually exclusive
      const currentRight = new Set(tab.chartConfig.yRightKeys || []);
      
      if(current.has(col)) current.delete(col);
      else {
          current.add(col);
          currentRight.delete(col);
      }
      
      updateActiveTab({ chartConfig: { ...tab.chartConfig, yKeys: Array.from(current), yRightKeys: Array.from(currentRight) }});
  };

  const toggleYRightAxis = (col: string) => {
      const tab = getActiveTab();
      if(!tab) return;
      const currentRight = new Set(tab.chartConfig.yRightKeys || []);
      // If adding to Right axis, remove from Left axis
      const currentLeft = new Set(tab.chartConfig.yKeys);

      if(currentRight.has(col)) currentRight.delete(col);
      else {
          currentRight.add(col);
          currentLeft.delete(col);
      }

      updateActiveTab({ chartConfig: { ...tab.chartConfig, yRightKeys: Array.from(currentRight), yKeys: Array.from(currentLeft) }});
  };

  // --- Rendering Helpers ---
  const activeTab = getActiveTab();

  if (!activeTab) {
      return (
        <div className="flex flex-col h-full items-center justify-center text-monokai-comment">
            <div className="animate-pulse">Loading Editor...</div>
            <button onClick={createNewTab} className="mt-4 px-4 py-2 bg-monokai-accent hover:text-white rounded text-sm">Reset Tabs</button>
        </div>
      );
  }

  // Filter Rows client-side
  const allRows = activeTab.result?.rows || [];
  const filteredRows = activeTab.filterTerm 
    ? allRows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(activeTab.filterTerm.toLowerCase())))
    : allRows;

  const paginatedRows = filteredRows.slice(activeTab.page * PAGE_SIZE, (activeTab.page + 1) * PAGE_SIZE);
  const maxPage = filteredRows.length > 0 ? Math.ceil(filteredRows.length / PAGE_SIZE) - 1 : 0;

  const getChartData = () => {
      // ... (chart logic unchanged from previous step, but keeping file intact)
      if (!activeTab.result) return { labels: [], datasets: [] };
      
      const config = activeTab.chartConfig;
      
      if (config.type === 'scatter') {
          const yKey = config.yKeys[0] || '';
          return {
              datasets: [{
                  label: `${yKey} vs ${config.xKey}`,
                  data: filteredRows.map(r => ({
                      x: Number(r[config.xKey]),
                      y: Number(r[yKey])
                  })),
                  backgroundColor: 'rgba(102, 217, 239, 0.7)', // Monokai Blue
                  pointRadius: 4,
                  pointHoverRadius: 6
              }]
          };
      }

      const labels = filteredRows.map(r => String(r[config.xKey]));
      
      const datasets = config.yKeys.map((yKey, index) => {
          const data = filteredRows.map(r => Number(r[yKey]));
          const color = MONOKAI_COLORS[index % MONOKAI_COLORS.length];
          
          return {
              label: yKey,
              data: data,
              backgroundColor: (config.type === 'pie' || config.type === 'doughnut') ? MONOKAI_COLORS : color,
              borderColor: (config.type === 'line') ? color.replace('0.8', '1') : 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              fill: (config.type === 'line' && config.yKeys.length === 1 && !config.stacked),
              borderRadius: 2,
              yAxisID: 'y'
          };
      });

      if (config.yRightKeys && config.yRightKeys.length > 0) {
          config.yRightKeys.forEach((yKey, index) => {
              const data = filteredRows.map(r => Number(r[yKey]));
              const color = MONOKAI_COLORS[(config.yKeys.length + index) % MONOKAI_COLORS.length];
              
              datasets.push({
                  label: `${yKey} (R)`,
                  data: data,
                  type: 'line', 
                  backgroundColor: color,
                  borderColor: color.replace('0.8', '1'),
                  borderWidth: 2,
                  borderDash: [5, 5], 
                  fill: false,
                  yAxisID: 'y1'
              } as any);
          });
      }

      return {
          labels,
          datasets
      };
  };

  const chartOptions: any = {
      // ... (options logic unchanged)
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
          mode: 'index',
          intersect: false,
      },
      indexAxis: activeTab.chartConfig.horizontal ? 'y' : 'x',
      plugins: { 
          legend: { labels: { color: '#f8f8f2', font: { family: 'JetBrains Mono' } } }, 
          title: { display: true, text: activeTab.title, color: '#f8f8f2', font: { size: 16 } },
          datalabels: {
              color: '#fff',
              display: 'auto',
              font: { weight: 'bold', size: 10 },
              anchor: activeTab.chartConfig.stacked ? 'center' : (activeTab.chartConfig.type === 'bar' ? 'end' : 'center'),
              align: activeTab.chartConfig.stacked ? 'center' : (activeTab.chartConfig.type === 'bar' ? 'top' : 'center'),
              offset: 0,
              opacity: 0.8,
              textShadowBlur: 4,
              textShadowColor: 'rgba(0,0,0,0.5)',
              formatter: (value: any) => {
                  if (typeof value === 'object' && value !== null) return value.y;
                  return value;
              }
          }
      },
      scales: activeTab.chartConfig.type === 'pie' || activeTab.chartConfig.type === 'doughnut' ? {
          x: { display: false },
          y: { display: false }
      } : { 
          x: { 
              type: activeTab.chartConfig.type === 'scatter' ? 'linear' : 'category',
              stacked: activeTab.chartConfig.stacked,
              position: 'bottom',
              ticks: { color: '#75715e' }, 
              grid: { color: '#3e3d32' },
              title: { display: true, text: activeTab.chartConfig.xKey, color: '#f8f8f2' }
          }, 
          y: { 
              type: 'linear',
              display: true,
              position: 'left',
              stacked: activeTab.chartConfig.stacked,
              ticks: { color: '#75715e' }, 
              grid: { color: '#3e3d32' },
              title: { display: true, text: activeTab.chartConfig.yKeys.join(', '), color: '#f8f8f2' }
          },
          y1: {
              type: 'linear',
              display: (activeTab.chartConfig.yRightKeys && activeTab.chartConfig.yRightKeys.length > 0),
              position: 'right',
              grid: { drawOnChartArea: false }, 
              ticks: { color: '#66d9ef' }, 
              title: { display: true, text: activeTab.chartConfig.yRightKeys?.join(', '), color: '#66d9ef' }
          }
      },
      animation: { duration: 500 }
  };

  const filteredHistory = history.filter(h => h.sql.toLowerCase().includes(historyFilter.toLowerCase()));

  return (
    <div className="flex flex-col h-full gap-4 relative">
        {/* Modals ... */}
        {showSaveModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-[fadeIn_0.2s]">
                <div className="bg-monokai-sidebar border border-monokai-accent p-6 rounded shadow-2xl w-96 animate-[slideIn_0.2s_ease-out]">
                    <h3 className="text-lg font-bold text-monokai-green mb-4">Save Query</h3>
                    <input autoFocus value={saveQueryName} onChange={e => setSaveQueryName(e.target.value)} placeholder="Query Name" className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded text-white outline-none mb-4" />
                    <div className="mb-6 p-3 bg-monokai-bg border border-monokai-accent rounded">
                        <label className="flex items-center gap-2 cursor-pointer mb-2"><input type="checkbox" checked={saveAsWidget} onChange={e => setSaveAsWidget(e.target.checked)} /><span className="text-sm font-bold text-monokai-yellow">Pin to Dashboard</span></label>
                        {saveAsWidget && (
                            <select value={widgetType} onChange={(e: any) => setWidgetType(e.target.value)} className="w-full bg-monokai-sidebar border border-monokai-accent p-1 rounded text-xs text-white">
                                <option value="table">Mini Table</option>
                                <option value="value">Single Value</option>
                                <option value="chart">Chart Widget</option>
                            </select>
                        )}
                    </div>
                    <div className="flex justify-end gap-2"><button onClick={() => setShowSaveModal(false)} className="px-3 py-1 text-sm hover:text-white">Cancel</button><button onClick={handleSaveQuery} className="px-4 py-1 bg-monokai-green text-monokai-bg font-bold rounded text-sm hover:opacity-90">Save</button></div>
                </div>
            </div>
        )}
        
        {showMaterializeModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-[fadeIn_0.2s]">
                <div className="bg-monokai-sidebar border border-monokai-accent p-6 rounded shadow-2xl w-96 animate-[slideIn_0.2s_ease-out]">
                    <h3 className="text-lg font-bold text-monokai-purple mb-2">Create {materializeType}</h3>
                    <input autoFocus value={materializeName} onChange={e => setMaterializeName(e.target.value)} placeholder={`${materializeType} Name`} className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded text-white outline-none mb-6 focus:border-monokai-purple transition-colors" />
                    <div className="flex justify-end gap-2"><button onClick={() => setShowMaterializeModal(false)} className="px-3 py-1 text-sm hover:text-white">Cancel</button><button onClick={handleMaterialize} className="px-4 py-1 bg-monokai-purple text-white font-bold rounded text-sm hover:opacity-90">Create</button></div>
                </div>
            </div>
        )}

        {showShortcutsModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={() => setShowShortcutsModal(false)}>
                <div className="bg-monokai-sidebar border border-monokai-accent p-6 rounded shadow-2xl w-96" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-bold text-monokai-blue mb-4">Shortcuts</h3>
                    <ul className="space-y-3 text-sm">
                        <li className="flex justify-between border-b border-monokai-accent pb-2"><span className="text-monokai-comment">Run Query</span><span className="font-mono bg-monokai-accent px-2 rounded text-white">Ctrl + Enter</span></li>
                        <li className="flex justify-between border-b border-monokai-accent pb-2"><span className="text-monokai-comment">Command Palette</span><span className="font-mono bg-monokai-accent px-2 rounded text-white">Ctrl/Cmd + K</span></li>
                    </ul>
                    <div className="mt-6 flex justify-end"><button onClick={() => setShowShortcutsModal(false)} className="px-4 py-2 bg-monokai-accent text-white rounded">Close</button></div>
                </div>
            </div>
        )}

        {/* AI Bar ... */}
        <div className="flex gap-2 items-center bg-monokai-sidebar p-2 rounded border border-monokai-accent shrink-0 shadow-lg">
            <span className="text-xl animate-pulse">✨</span>
            <input type="text" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()} placeholder="Ask AI (e.g., 'Show top 5 users by sales')..." className="flex-1 bg-transparent border-none focus:ring-0 text-monokai-blue placeholder-monokai-comment outline-none font-mono text-sm" />
            <button onClick={handleAiGenerate} disabled={isAiLoading} className="px-4 py-1.5 bg-monokai-purple/20 border border-monokai-purple text-monokai-purple text-xs font-bold rounded hover:bg-monokai-purple hover:text-white transition-all disabled:opacity-50">{isAiLoading ? 'Thinking...' : 'Generate SQL'}</button>
        </div>

        <div className="flex flex-1 min-h-0 gap-4">
            <div className="flex flex-col gap-0 flex-1 min-w-0">
                {/* Editor Area with Tabs ... */}
                <div 
                    className="flex flex-col gap-0 min-h-[100px] border border-monokai-accent rounded-t-lg bg-monokai-bg overflow-hidden shadow-2xl relative"
                    style={{ height: `${editorHeightPercent}%` }}
                    ref={editorContainerRef}
                >
                    {/* ... Tabs ... */}
                    <div className="flex items-end bg-[#1e1f1c] pt-2 px-2 gap-1 overflow-x-auto scrollbar-hide border-b border-monokai-accent">
                        {tabs.map(tab => {
                             const isActive = activeTabId === tab.id;
                             return (
                            <div 
                                key={tab.id} 
                                className={`group relative flex items-center gap-2 px-4 py-2 text-xs cursor-pointer min-w-[140px] max-w-[200px] select-none transition-all rounded-t-md border-t border-l border-r ${isActive ? 'bg-monokai-bg border-monokai-accent z-10 text-white font-bold' : 'bg-[#2a2b24] border-transparent text-monokai-comment hover:bg-[#33342e]'}`}
                                onClick={() => setActiveTabId(tab.id)}
                                onDoubleClick={() => handleTitleDoubleClick(tab)}
                            >
                                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-monokai-green' : 'bg-monokai-comment/30'}`}></div>
                                {editingTitleId === tab.id ? (
                                    <input autoFocus value={tempTitle} onChange={e => setTempTitle(e.target.value)} onBlur={saveTitle} onKeyDown={e => e.key === 'Enter' && saveTitle()} className="bg-transparent text-white outline-none w-full" />
                                ) : (
                                    <span className="truncate flex-1">{tab.title}</span>
                                )}
                                <button onClick={(e) => closeTab(tab.id, e)} className="opacity-0 group-hover:opacity-100 hover:text-monokai-pink font-bold ml-1">×</button>
                                {isActive && <div className="absolute bottom-[-1px] left-0 right-0 h-1 bg-monokai-bg z-20"></div>}
                            </div>
                        )})}
                        <button onClick={createNewTab} className="px-3 py-2 text-monokai-comment hover:text-white font-bold text-lg mb-0.5 opacity-50 hover:opacity-100 transition-opacity">+</button>
                    </div>

                    {/* Toolbar */}
                    <div className="flex justify-between items-center p-2 bg-monokai-bg border-b border-monokai-accent z-10">
                        {/* ... Left Toolbar ... */}
                        <div className="flex gap-2">
                            <button onClick={() => execute(false)} disabled={activeTab.loading} className={`px-4 py-1.5 bg-monokai-green text-monokai-bg font-bold rounded text-xs hover:opacity-90 disabled:opacity-50 transition-transform active:scale-95 flex items-center gap-2 ${activeTab.loading ? 'animate-pulse' : ''}`}>
                                <span>▶</span> Run
                            </button>
                            <button onClick={() => execute(true)} disabled={activeTab.loading} className="px-4 py-1.5 border border-monokai-purple text-monokai-purple font-bold rounded text-xs hover:bg-monokai-purple hover:text-white disabled:opacity-50 transition-colors">Explain</button>
                            <div className="relative">
                                <button onClick={() => setShowSnippetsMenu(!showSnippetsMenu)} className="px-3 py-1.5 bg-monokai-accent text-monokai-comment hover:text-white text-xs font-bold rounded flex items-center gap-1 border border-transparent hover:border-monokai-comment transition-colors">
                                    <span>🧩</span> Snippets ▼
                                </button>
                                {showSnippetsMenu && (
                                    <div className="absolute top-full left-0 mt-1 bg-monokai-sidebar border border-monokai-accent rounded shadow-xl z-50 min-w-[200px]">
                                        {Object.entries(SNIPPETS).map(([label, snippet]) => (
                                            <button 
                                                key={label}
                                                className="w-full text-left px-4 py-2 text-xs text-monokai-fg hover:bg-monokai-accent hover:text-monokai-blue transition-colors"
                                                onClick={() => { insertText(snippet); setShowSnippetsMenu(false); }}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {showSnippetsMenu && <div className="fixed inset-0 z-40" onClick={() => setShowSnippetsMenu(false)} />}
                            </div>
                        </div>
                        {/* Right Toolbar */}
                        <div className="flex gap-2">
                            <div className="relative">
                                <button onClick={() => setShowMaterializeMenu(!showMaterializeMenu)} className="px-3 py-1 text-xs border border-monokai-purple text-monokai-purple hover:bg-monokai-purple hover:text-white rounded transition-colors flex items-center gap-1">
                                    <span>💾</span> Materialize ▼
                                </button>
                                {showMaterializeMenu && (
                                    <div className="absolute top-full right-0 mt-1 bg-monokai-sidebar border border-monokai-accent rounded shadow-xl z-50 min-w-[150px]">
                                        <button onClick={() => openMaterializeModal('TABLE')} className="w-full text-left px-4 py-2 text-xs text-monokai-fg hover:bg-monokai-accent hover:text-monokai-blue transition-colors">Save as Table</button>
                                        <button onClick={() => openMaterializeModal('VIEW')} className="w-full text-left px-4 py-2 text-xs text-monokai-fg hover:bg-monokai-accent hover:text-monokai-blue transition-colors">Save as View</button>
                                    </div>
                                )}
                                {showMaterializeMenu && <div className="fixed inset-0 z-40" onClick={() => setShowMaterializeMenu(false)} />}
                            </div>
                            <button onClick={() => setShowShortcutsModal(true)} className="text-xs text-monokai-comment hover:text-white px-2 py-1">⌨️ Shortcuts</button>
                            <button onClick={formatSql} className="text-xs text-monokai-yellow hover:text-white px-2 py-1">Format</button>
                            <button onClick={() => setShowSaveModal(true)} className="text-xs text-monokai-orange hover:text-white px-2 py-1">Save</button>
                        </div>
                    </div>

                    {/* Code Editor */}
                    <div className="relative flex-1 overflow-auto bg-monokai-bg">
                        <Editor
                            value={activeTab.code}
                            onValueChange={code => updateActiveTab({ code })}
                            highlight={code => Prism.highlight(code, Prism.languages.sql, 'sql')}
                            padding={24}
                            style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 14, minHeight: '100%', backgroundColor: '#272822' }}
                            textareaClassName="focus:outline-none"
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
                    <div className="flex justify-between items-center bg-[#1e1f1c] p-2 border-b border-monokai-accent shrink-0">
                        <div className="flex gap-1 bg-monokai-bg p-0.5 rounded border border-monokai-accent/30">
                            <button onClick={() => updateActiveTab({ viewMode: 'table' })} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded ${activeTab.viewMode === 'table' ? 'bg-monokai-accent text-white shadow-sm' : 'text-monokai-comment hover:text-white'}`}>Table</button>
                            <button onClick={() => updateActiveTab({ viewMode: 'chart' })} disabled={!activeTab.result || activeTab.result.rows.length === 0 || activeTab.result.isExplain} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded ${activeTab.viewMode === 'chart' ? 'bg-monokai-accent text-monokai-pink shadow-sm' : 'text-monokai-comment hover:text-monokai-pink disabled:opacity-30'}`}>Chart</button>
                            {activeTab.result?.isExplain && <button onClick={() => updateActiveTab({ viewMode: 'explain' })} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-monokai-purple text-white">Plan</button>}
                        </div>

                        {activeTab.result && !activeTab.result.error && !activeTab.result.isExplain && (
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 bg-monokai-sidebar border border-monokai-accent/30 rounded px-2 py-0.5 mr-2">
                                    <span className="text-monokai-comment text-xs">🔍</span>
                                    <input 
                                        className="bg-transparent border-none outline-none text-xs text-monokai-fg placeholder-monokai-comment/50 w-32 focus:w-48 transition-all"
                                        placeholder="Filter results..."
                                        value={activeTab.filterTerm}
                                        onChange={(e) => updateActiveTab({ filterTerm: e.target.value, page: 0 })}
                                    />
                                    {activeTab.filterTerm && <button onClick={() => updateActiveTab({ filterTerm: '' })} className="text-monokai-pink text-xs hover:text-white font-bold">✕</button>}
                                </div>

                                {maxPage > 0 && activeTab.viewMode === 'table' && (
                                    <div className="flex items-center gap-1 mr-2 bg-monokai-bg rounded px-1 border border-monokai-accent/30">
                                        <button onClick={() => updateActiveTab({ page: Math.max(0, activeTab.page - 1) })} disabled={activeTab.page === 0} className="text-monokai-comment hover:text-white disabled:opacity-30 px-2 py-0.5">◀</button>
                                        <span className="text-[10px] font-mono w-12 text-center text-monokai-fg">{activeTab.page + 1}/{maxPage + 1}</span>
                                        <button onClick={() => updateActiveTab({ page: Math.min(maxPage, activeTab.page + 1) })} disabled={activeTab.page === maxPage} className="text-monokai-comment hover:text-white disabled:opacity-30 px-2 py-0.5">▶</button>
                                    </div>
                                )}
                                <div className="flex border border-monokai-accent/30 rounded overflow-hidden">
                                    <button onClick={() => copyToClipboard('tsv')} className="text-[10px] bg-[#2a2b24] hover:bg-monokai-accent px-2 py-1 border-r border-monokai-accent/30" title="Copy TSV">📋</button>
                                    <button onClick={() => copyToClipboard('md')} className="text-[10px] bg-[#2a2b24] hover:bg-monokai-accent px-2 py-1 border-r border-monokai-accent/30" title="Copy MD">📝</button>
                                    <button onClick={() => copyToClipboard('html')} className="text-[10px] bg-[#2a2b24] hover:bg-monokai-accent px-2 py-1" title="Copy HTML">🌐</button>
                                </div>
                                <div className="relative">
                                    <button onClick={() => setShowExportMenu(!showExportMenu)} className="text-[10px] bg-monokai-blue/10 text-monokai-blue hover:bg-monokai-blue hover:text-monokai-bg px-2 py-1 rounded font-bold transition-colors">Export ▼</button>
                                    {showExportMenu && (
                                        <div className="absolute right-0 bottom-full mb-1 bg-monokai-sidebar border border-monokai-accent p-1 rounded shadow-xl z-30 min-w-[100px] flex flex-col gap-0.5">
                                            <button onClick={() => downloadResult('csv')} className="text-xs text-left px-2 py-1 hover:bg-monokai-accent rounded text-monokai-fg">CSV</button>
                                            <button onClick={() => downloadResult('json')} className="text-xs text-left px-2 py-1 hover:bg-monokai-accent rounded text-monokai-fg">JSON</button>
                                            <button onClick={() => downloadResult('parquet')} className="text-xs text-left px-2 py-1 hover:bg-monokai-accent rounded text-monokai-orange">Parquet</button>
                                        </div>
                                    )}
                                    {showExportMenu && <div className="fixed inset-0 z-20" onClick={() => setShowExportMenu(false)} />}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 bg-monokai-bg overflow-hidden relative">
                       {/* ... Result Content ... */}
                       {/* ... (Kept existing result rendering logic) ... */}
                        {activeTab.result?.error ? (
                            <div className="p-8 flex flex-col items-center justify-center h-full text-center">
                                <div className="text-monokai-pink font-mono mb-6 bg-[#1e1f1c] p-6 rounded-lg border border-monokai-pink/50 max-w-2xl shadow-lg">
                                    <div className="text-xs uppercase font-bold tracking-widest mb-2 opacity-50">Error</div>
                                    {activeTab.result.error}
                                </div>
                                <button onClick={handleAiFix} disabled={isFixing} className="px-6 py-2 bg-monokai-purple text-white font-bold rounded shadow-lg hover:bg-monokai-purple/80 flex items-center gap-2 transition-transform active:scale-95">
                                    {isFixing ? '🧠 Analyzing...' : '✨ Fix with AI'}
                                </button>
                            </div>
                        ) : activeTab.loading ? (
                            <div className="p-4 text-monokai-comment text-center h-full flex items-center justify-center flex-col gap-4">
                                <div className="w-12 h-12 border-4 border-monokai-blue border-t-transparent rounded-full animate-spin"></div>
                                <div className="animate-pulse tracking-widest text-xs uppercase font-bold">Executing Query...</div>
                            </div>
                        ) : !activeTab.result ? (
                            <div className="p-4 text-monokai-comment/30 text-center h-full flex items-center justify-center flex-col gap-4 select-none">
                                <div className="text-6xl animate-bounce">⌨️</div>
                                <div className="text-sm">Cmd/Ctrl + Enter to run</div>
                                <div className="flex gap-2 text-xs">
                                    <span className="bg-monokai-sidebar px-2 py-1 rounded border border-monokai-accent">SELECT</span>
                                    <span className="bg-monokai-sidebar px-2 py-1 rounded border border-monokai-accent">FROM</span>
                                    <span className="bg-monokai-sidebar px-2 py-1 rounded border border-monokai-accent">WHERE</span>
                                </div>
                            </div>
                        ) : activeTab.viewMode === 'explain' ? (
                            <div className="p-4 overflow-auto h-full font-mono text-sm">
                                <pre className="text-xs text-monokai-fg bg-[#1e1f1c] p-4 rounded border border-monokai-accent/50 whitespace-pre-wrap">{activeTab.result.rows.map(r => r['explain_value'] || r['explore_value'] || JSON.stringify(r)).join('\n')}</pre>
                            </div>
                        ) : activeTab.viewMode === 'table' ? (
                            <div className="overflow-auto h-full w-full custom-scrollbar">
                                <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                                    <thead className="bg-[#1e1f1c] sticky top-0 z-10 shadow-md">
                                        <tr>
                                            {activeTab.result.columns.map(c => (
                                                <th key={c} className="p-2 font-mono text-xs text-monokai-blue border-b border-r border-monokai-accent/50 last:border-r-0 select-none hover:bg-monokai-accent/20 transition-colors">
                                                    {c}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="font-mono text-xs">
                                        {paginatedRows.map((r, i) => (
                                            <tr key={i} className="border-b border-monokai-accent/20 hover:bg-monokai-accent/30 transition-colors even:bg-white/5">
                                                {activeTab.result!.columns.map(c => (
                                                    <td key={c} className="p-2 text-monokai-fg border-r border-monokai-accent/20 last:border-r-0 max-w-[300px] truncate" title={String(r[c])}>
                                                        {r[c] === null ? <span className="text-monokai-comment italic">NULL</span> : String(r[c])}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                        {paginatedRows.length === 0 && (
                                            <tr><td colSpan={activeTab.result.columns.length} className="p-8 text-center text-monokai-comment">No results match your filter.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col p-4 bg-[#1e1f1c]">
                                {/* ... Chart Controls ... */}
                                <div className="flex gap-4 mb-4 items-end justify-between border-b border-monokai-accent pb-4 flex-wrap">
                                    <div className="flex gap-4 flex-wrap items-end">
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-monokai-comment mb-1">Chart Type</label>
                                            <select value={activeTab.chartConfig.type} onChange={(e: any) => updateActiveTab({ chartConfig: { ...activeTab.chartConfig, type: e.target.value } })} className="bg-monokai-bg border border-monokai-accent text-xs p-1.5 rounded text-white outline-none focus:border-monokai-blue">
                                                <option value="bar">Bar</option>
                                                <option value="line">Line</option>
                                                <option value="pie">Pie</option>
                                                <option value="doughnut">Doughnut</option>
                                                <option value="scatter">Scatter</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-monokai-comment mb-1">X Axis</label>
                                            <select value={activeTab.chartConfig.xKey} onChange={(e) => updateActiveTab({ chartConfig: { ...activeTab.chartConfig, xKey: e.target.value } })} className="bg-monokai-bg border border-monokai-accent text-xs p-1.5 rounded text-white outline-none focus:border-monokai-blue">
                                                {activeTab.result.columns.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        
                                        {/* Primary Y Axis */}
                                        <div className="relative">
                                            <label className="block text-[10px] uppercase font-bold text-monokai-comment mb-1">Y Axis (Left)</label>
                                            <button 
                                                onClick={() => setShowYAxisMenu(!showYAxisMenu)} 
                                                className="bg-monokai-bg border border-monokai-accent text-xs p-1.5 rounded text-white outline-none focus:border-monokai-blue w-32 text-left truncate flex justify-between items-center"
                                            >
                                                <span>{activeTab.chartConfig.yKeys.length > 0 ? `${activeTab.chartConfig.yKeys.length} selected` : 'Select...'}</span>
                                                <span className="text-[10px]">▼</span>
                                            </button>
                                            {showYAxisMenu && (
                                                <div className="absolute top-full left-0 mt-1 bg-monokai-sidebar border border-monokai-accent rounded shadow-xl z-50 min-w-[150px] max-h-48 overflow-y-auto">
                                                    {activeTab.result.columns.map(c => {
                                                        const isNum = activeTab.result?.rows.length ? typeof activeTab.result.rows[0][c] === 'number' : true;
                                                        return (
                                                        <label key={c} className="flex items-center gap-2 p-2 hover:bg-monokai-accent cursor-pointer text-xs">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={activeTab.chartConfig.yKeys.includes(c)} 
                                                                onChange={() => toggleYAxis(c)}
                                                                disabled={!isNum && activeTab.chartConfig.type !== 'bar' && activeTab.chartConfig.type !== 'line'}
                                                            />
                                                            <span className={!isNum ? 'opacity-50' : 'text-white'}>{c}</span>
                                                        </label>
                                                    )})}
                                                </div>
                                            )}
                                            {showYAxisMenu && <div className="fixed inset-0 z-40" onClick={() => setShowYAxisMenu(false)} />}
                                        </div>

                                        {/* Secondary Y Axis (Combo Chart) */}
                                        {(activeTab.chartConfig.type === 'bar' || activeTab.chartConfig.type === 'line') && (
                                            <div className="relative">
                                                <label className="block text-[10px] uppercase font-bold text-monokai-blue mb-1">Right Axis (Line)</label>
                                                <button 
                                                    onClick={() => setShowYRightAxisMenu(!showYRightAxisMenu)} 
                                                    className="bg-monokai-bg border border-monokai-blue text-xs p-1.5 rounded text-white outline-none focus:border-monokai-blue w-32 text-left truncate flex justify-between items-center"
                                                >
                                                    <span>{activeTab.chartConfig.yRightKeys && activeTab.chartConfig.yRightKeys.length > 0 ? `${activeTab.chartConfig.yRightKeys.length} selected` : 'None'}</span>
                                                    <span className="text-[10px]">▼</span>
                                                </button>
                                                {showYRightAxisMenu && (
                                                    <div className="absolute top-full left-0 mt-1 bg-monokai-sidebar border border-monokai-blue rounded shadow-xl z-50 min-w-[150px] max-h-48 overflow-y-auto">
                                                        {activeTab.result.columns.map(c => {
                                                            const isNum = activeTab.result?.rows.length ? typeof activeTab.result.rows[0][c] === 'number' : true;
                                                            return (
                                                            <label key={c} className="flex items-center gap-2 p-2 hover:bg-monokai-accent cursor-pointer text-xs">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={activeTab.chartConfig.yRightKeys?.includes(c)} 
                                                                    onChange={() => toggleYRightAxis(c)}
                                                                    disabled={!isNum}
                                                                />
                                                                <span className={!isNum ? 'opacity-50' : 'text-white'}>{c}</span>
                                                            </label>
                                                        )})}
                                                    </div>
                                                )}
                                                {showYRightAxisMenu && <div className="fixed inset-0 z-40" onClick={() => setShowYRightAxisMenu(false)} />}
                                            </div>
                                        )}
                                        
                                        {(activeTab.chartConfig.type === 'bar' || activeTab.chartConfig.type === 'line') && (
                                            <div className="flex gap-4 border-l border-monokai-accent pl-4 ml-2">
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={activeTab.chartConfig.stacked} 
                                                        onChange={e => updateActiveTab({ chartConfig: { ...activeTab.chartConfig, stacked: e.target.checked } })}
                                                    />
                                                    <span className="text-xs text-monokai-comment group-hover:text-white">Stacked</span>
                                                </label>
                                                {activeTab.chartConfig.type === 'bar' && (
                                                    <label className="flex items-center gap-2 cursor-pointer group">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={activeTab.chartConfig.horizontal} 
                                                            onChange={e => updateActiveTab({ chartConfig: { ...activeTab.chartConfig, horizontal: e.target.checked } })}
                                                        />
                                                        <span className="text-xs text-monokai-comment group-hover:text-white">Horizontal</span>
                                                    </label>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={downloadChartImage} className="text-xs bg-monokai-blue text-monokai-bg px-3 py-1.5 rounded font-bold hover:opacity-90 ml-auto">Save Image</button>
                                </div>
                                <div className="flex-1 relative min-h-0">
                                    {activeTab.chartConfig.type === 'bar' && <Bar ref={chartRef} data={getChartData()} options={chartOptions} />}
                                    {activeTab.chartConfig.type === 'line' && <Line ref={chartRef} data={getChartData()} options={chartOptions} />}
                                    {activeTab.chartConfig.type === 'pie' && <Pie ref={chartRef} data={getChartData()} options={chartOptions} />}
                                    {activeTab.chartConfig.type === 'doughnut' && <Doughnut ref={chartRef} data={getChartData()} options={chartOptions} />}
                                    {activeTab.chartConfig.type === 'scatter' && <Scatter ref={chartRef} data={getChartData()} options={chartOptions} />}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Status Bar */}
                    {activeTab.result && !activeTab.result.error && (
                        <div className="bg-monokai-bg border-t border-monokai-accent p-1 px-4 flex justify-between items-center text-[10px] font-mono text-monokai-comment">
                            <div className="flex gap-4">
                                <span className="text-monokai-green">✓ Success</span>
                                <span>{filteredRows.length} rows (filtered from {allRows.length})</span>
                                <span>{activeTab.result.columns.length} cols</span>
                            </div>
                            <div>
                                <span>Time: {activeTab.result.executionTime.toFixed(2)}ms</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar (Schema/History) ... */}
            <div className="w-64 bg-monokai-sidebar border-l border-monokai-accent flex flex-col shrink-0">
                <div className="flex border-b border-monokai-accent bg-[#1e1f1c]">
                    {['schema', 'history', 'saved', 'cheatsheet'].map((t: any) => (
                        <button key={t} onClick={() => setActiveSidebarTab(t)} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-colors ${activeSidebarTab === t ? 'border-monokai-pink text-white bg-monokai-bg' : 'border-transparent text-monokai-comment hover:text-white hover:bg-monokai-bg/50'}`}>{t === 'cheatsheet' ? 'Help' : t}</button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto">
                    {/* ... Sidebar content unchanged ... */}
                    {activeSidebarTab === 'schema' && (
                        <div className="p-0">
                            {Object.keys(schemaTree).length === 0 && <div className="p-8 text-center text-xs text-monokai-comment italic">No tables found.<br/>Import data to get started.</div>}
                            {Object.keys(schemaTree).map(table => (
                                <div key={table}>
                                    <div className="p-2 border-b border-monokai-accent/30 hover:bg-monokai-accent cursor-pointer flex items-center gap-2 group transition-colors" onClick={() => toggleTableExpand(table)}>
                                        <span className="text-[10px] text-monokai-comment group-hover:text-white transition-colors">{expandedTables.has(table) ? '▼' : '▶'}</span>
                                        <span className="text-xs font-bold text-monokai-fg group-hover:text-monokai-blue truncate">{table}</span>
                                        <button className="ml-auto text-[10px] opacity-0 group-hover:opacity-100 text-monokai-comment hover:text-white px-1" onClick={(e) => { e.stopPropagation(); insertText(table); }}>⏎</button>
                                    </div>
                                    {expandedTables.has(table) && <div className="bg-[#1a1b18] shadow-inner">{schemaTree[table].map(col => (<div key={col.name} className="pl-6 pr-2 py-1.5 text-[11px] font-mono text-monokai-comment hover:text-monokai-orange hover:bg-monokai-accent/20 cursor-pointer flex justify-between group" onClick={() => insertText(col.name)}><span>{col.name}</span><span className="opacity-50 text-[9px] flex items-center gap-1">{getTypeIcon(col.type)} {col.type}</span></div>))}</div>}
                                </div>
                            ))}
                        </div>
                    )}
                    {activeSidebarTab === 'history' && (
                        <>
                            <div className="p-2 border-b border-monokai-accent sticky top-0 bg-monokai-sidebar z-10"><input className="w-full bg-monokai-bg border border-monokai-accent rounded px-2 py-1 text-xs text-white outline-none focus:border-monokai-comment" placeholder="Search history..." value={historyFilter} onChange={e => setHistoryFilter(e.target.value)} /></div>
                            <div className="p-2 flex justify-end"><button onClick={clearHistory} className="text-[10px] text-monokai-pink hover:underline uppercase font-bold tracking-wider">Clear All</button></div>
                            {filteredHistory.map(item => (<div key={item.id} className="p-3 border-b border-monokai-accent/50 cursor-pointer hover:bg-monokai-accent group transition-colors" onClick={() => insertText(item.sql)}><div className="flex justify-between items-center mb-1"><span className={`text-[9px] font-bold px-1 rounded ${item.status === 'success' ? 'bg-monokai-green/20 text-monokai-green' : 'bg-monokai-pink/20 text-monokai-pink'}`}>{item.status === 'success' ? 'OK' : 'ERR'}</span><span className="text-[10px] text-monokai-comment">{new Date(item.timestamp).toLocaleTimeString()}</span></div><div className="text-xs font-mono text-monokai-fg line-clamp-2 opacity-80">{item.sql}</div></div>))}
                        </>
                    )}
                    {activeSidebarTab === 'saved' && (
                        <>
                            <div className="p-3 text-xs text-monokai-comment border-b border-monokai-accent bg-monokai-bg/30 italic">Click query to load code.</div>
                            {savedQueries.map(item => (<div key={item.id} className="p-3 border-b border-monokai-accent/50 cursor-pointer hover:bg-monokai-accent group transition-colors" onClick={() => updateActiveTab({ code: item.sql })}><div className="flex justify-between items-center mb-1"><span className="text-xs font-bold text-monokai-green flex items-center gap-2">{item.name}{item.pinned && <span className="text-[10px]" title="Pinned to Dashboard">📌</span>}</span><button onClick={(e) => deleteSavedQuery(item.id, e)} className="text-monokai-comment hover:text-monokai-pink p-1 opacity-0 group-hover:opacity-100 transition-opacity">✕</button></div><div className="text-xs font-mono text-monokai-fg line-clamp-1 opacity-60">{item.sql}</div></div>))}
                        </>
                    )}
                    {activeSidebarTab === 'cheatsheet' && (
                        <div className="p-0">
                            {CHEATSHEET.map((item, idx) => (<div key={idx} className="p-3 border-b border-monokai-accent/30 cursor-pointer hover:bg-monokai-accent group flex justify-between items-center transition-colors" onClick={() => insertText(item.code)}><span className="text-xs font-bold text-monokai-fg group-hover:text-monokai-yellow">{item.label}</span><span className="text-[9px] text-monokai-comment uppercase border border-monokai-comment/30 px-1 rounded tracking-wider">{item.cat}</span></div>))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};