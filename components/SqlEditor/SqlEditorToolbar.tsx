import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play, Code, ChevronDown, Sparkles, Save, Type, Trash2, Minimize2, Maximize2,
  Eye, EyeOff, ChevronLeft, Loader2, Wand2, Database, FileText, X, Copy, Check, Keyboard, FolderOpen, Table, HardDrive, Edit3, BarChart2, Activity, Clock, Plus, Settings, Upload, Square, Download, Cpu
} from 'lucide-react';
import { SqlTab } from '../../types';
import { SNIPPET_GROUPS, SNIPPET_CATEGORY_META } from '../../data/sqlEditorData';
import { useSqlEditorStore } from '../../hooks/store/useSqlEditorStore';
import { useAppStore } from '../../hooks/store/useAppStore';
import { exportCsv, exportJson, exportMarkdown, generateHtmlReport } from '../../utils/sqlExporter';

export interface SqlEditorToolbarProps {
  activeTab: SqlTab;
  isZenMode: boolean;
  showSnippetsMenu: boolean;
  expandedSnippetCategory: string | null;
  hoveredSnippet: { label: string; sql: string } | null;
  showMaterializeMenu: boolean;
  showLivePreview: boolean;
  isAiLoading: boolean;
  aiPrompt: string;
  selectedSqlType: string;
  lastClearedContent: { sql: string; aiInput: string } | null;
  onUndoClear: () => void;
  onExecute: (overrideSql?: string) => void;
  onCancel?: () => void;
  onToggleSnippets: () => void;
  onSnippetCategoryToggle: (category: string | null) => void;
  onSnippetHover: (snippet: { label: string; sql: string } | null) => void;
  onSnippetInsert: (sql: string) => void;
  onSnippetsMenuToggle: () => void;
  onShowSkillAssistant: () => void;
  onToggleMaterializeMenu: () => void;
  onOpenMaterializeModal: (type: 'TABLE' | 'VIEW') => void;
  onFormatSql: () => void;
  onSaveModal: () => void;
  onClear: () => void;
  onToggleZen: () => void;
  onToggleLivePreview: () => void;
  onAiPromptChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAiPromptClear: () => void;
  onAiGenerate: () => void;
  onSqlTypeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onAIFill: () => void;
  onAiExplain: () => void;
}

export const SqlEditorToolbar: React.FC<SqlEditorToolbarProps> = ({
  activeTab,
  isZenMode,
  showSnippetsMenu,
  expandedSnippetCategory,
  showLivePreview,
  isAiLoading,
  aiPrompt,
  selectedSqlType,
  lastClearedContent,
  onUndoClear,
  onExecute,
  onCancel,
  onSnippetCategoryToggle,
  onSnippetInsert,
  onShowSkillAssistant,
  onOpenMaterializeModal,
  onFormatSql,
  onSaveModal,
  onClear,
  onToggleZen,
  onToggleLivePreview,
  onAiPromptChange,
  onAiPromptClear,
  onAiGenerate,
  onSqlTypeChange,
  onAIFill,
  onAiExplain,
}) => {
  const tableMatch = activeTab.code.match(/(?:FROM|INTO|UPDATE|TABLE)\s+"?([a-zA-Z0-9_.]+)"?/i);
  const detectedTable = tableMatch?.[1];

  // Local Dropdown and Modal States
  const [activeDropdown, setActiveDropdown] = useState<'save' | 'snippets' | 'layout' | 'diagnostics' | 'edit' | 'history' | 'ai' | 'datasource' | 'export' | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [copied, setCopied] = useState(false);

  // Dynamic SQL Parameter Injection State
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  // Refs for clicking outside
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Zustand Store selectors
  const storeHistory = useSqlEditorStore((s) => s.history);
  const createTab = useSqlEditorStore((s) => s.createTab);
  const setActiveTabId = useSqlEditorStore((s) => s.setActiveTabId);
  const updateActiveTab = useSqlEditorStore((s) => s.updateActiveTab);
  const setActiveSidebarTab = useSqlEditorStore((s) => s.setActiveSidebarTab);

  // Global App Store
  const {
    setShowCreateModal,
    setShowDuplicateModal,
    setShowImportModal,
    setShowSettingsModal
  } = useAppStore();

  // Dynamic SQL Parameter Parsing logic
  const parsedParams = useMemo(() => {
    const code = activeTab.code || '';
    const colonRegex = /(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)(?!:)/g;
    const braceRegex = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    const params = new Set<string>();
    let match;
    while ((match = colonRegex.exec(code)) !== null) {
      if (!/^\d+$/.test(match[1])) {
        params.add(match[1]);
      }
    }
    while ((match = braceRegex.exec(code)) !== null) {
      params.add(match[1]);
    }
    return Array.from(params);
  }, [activeTab.code]);

  // Sync parameters state
  useEffect(() => {
    setParamValues(prev => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach(k => {
        if (!parsedParams.includes(k)) {
          delete next[k];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [parsedParams]);

  // Execute query with substituted parameters
  const handleExecuteWithParams = () => {
    let substitutedSql = activeTab.code;
    parsedParams.forEach(name => {
      const val = paramValues[name] || '';
      const colonRegex = new RegExp(`(?<!:):${name}(?!:)`, 'g');
      const braceRegex = new RegExp(`\\$\\{${name}\\}`, 'g');
      substitutedSql = substitutedSql.replace(colonRegex, val).replace(braceRegex, val);
    });
    onExecute(substitutedSql);
  };

  const toggleDropdown = (dropdown: typeof activeDropdown) => {
    setActiveDropdown(prev => prev === dropdown ? null : dropdown);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(activeTab.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNewTab = () => {
    const newTabId = createTab();
    setActiveTabId(newTabId);
    setActiveDropdown(null);
  };

  const handleQuickHistoryInsert = (sql: string) => {
    onSnippetInsert(sql);
    setActiveDropdown(null);
  };

  const handleOpenSidebarTab = (tab: 'history' | 'saved' | 'schema' | 'help') => {
    setActiveSidebarTab(tab);
    if (isZenMode) {
      onToggleZen();
    }
    setActiveDropdown(null);
  };

  // Result Exports implementation
  const handleExport = (format: 'csv' | 'json' | 'markdown' | 'html') => {
    const result = activeTab.result;
    if (!result) return;
    
    let blob: Blob;
    let filename = `export_${activeTab.title.replace(/\s+/g, '_') || 'query'}_${Date.now()}`;
    
    if (format === 'csv') {
      blob = exportCsv(result);
      filename += '.csv';
    } else if (format === 'json') {
      blob = exportJson(result);
      filename += '.json';
    } else if (format === 'markdown') {
      const mdContent = exportMarkdown(result);
      blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
      filename += '.md';
    } else {
      const htmlContent = generateHtmlReport(activeTab.title, activeTab.code, result);
      blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      filename += '.html';
    }
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setActiveDropdown(null);
  };

  // Coarse memory estimation
  const getEstMemory = () => {
    const result = activeTab.result;
    if (!result || !result.rows || result.rows.length === 0) return '0 KB';
    const cellCount = result.rows.length * result.columns.length;
    const estimatedBytes = cellCount * 16 + result.rows.length * 64;
    if (estimatedBytes < 1024) {
      return `${estimatedBytes} B`;
    } else if (estimatedBytes < 1024 * 1024) {
      return `${(estimatedBytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  };

  const getSqlTypeLabel = (type: string) => {
    switch (type) {
      case 'select': return 'SELECT';
      case 'join': return 'JOIN';
      case 'aggregate': return '聚合';
      case 'transform': return '转换';
      case 'performance': return '执行分析';
      case 'utilities': return '工具方法';
      default: return 'SQL';
    }
  };

  // Close dropdowns on outside click or ESC key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null);
        setShowShortcuts(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isZenMode]);

  return (
    <div 
      ref={toolbarRef}
      className="flex flex-col bg-monokai-bg select-none shadow-md z-40 w-full relative border-b border-monokai-accent/30 font-sans"
    >
      {/* ──────────────────────────────────────────────────────────── */}
      {/* ROW 1: UPPER DECK (Execution Controls, DB Connection Pill, Params, AI Search Bar) */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between p-2 gap-3 border-b border-monokai-accent/25 flex-wrap md:flex-nowrap bg-monokai-bg">
        {/* Left Side: Run & Undo & DB Connections */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          {/* Play/Stop Button */}
          {activeTab.loading ? (
            <button
              onClick={onCancel}
              className="px-3.5 py-1.5 bg-monokai-pink text-monokai-bg font-bold rounded-sm text-xs hover:opacity-90 hover:shadow-[0_0_8px_rgba(249,38,114,0.4)] transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer animate-pulse"
              title="停止当前查询"
            >
              <Square size={11} fill="currentColor" />
              停止
            </button>
          ) : (
            <button
              onClick={handleExecuteWithParams}
              className="px-3.5 py-1.5 bg-monokai-green text-monokai-bg font-bold rounded-sm text-xs hover:opacity-90 hover:shadow-[0_0_8px_rgba(166,226,46,0.4)] transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
              title="运行 SQL (Ctrl+Enter)"
            >
              <Play size={11} />
              运行
            </button>
          )}

          {/* Undo Clear */}
          {lastClearedContent && (
            <button
              onClick={onUndoClear}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-monokai-blue/10 border border-monokai-blue/30 hover:bg-monokai-blue/20 text-monokai-blue text-xs font-semibold rounded-sm transition-all cursor-pointer"
              title="撤销上一次清除"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              撤销
            </button>
          )}

          <div className="w-[1px] h-4 bg-monokai-accent/20 mx-0.5 hidden sm:block"></div>

          {/* Database Connection Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-monokai-surface/40 border border-monokai-accent/30 rounded-sm text-[10px] text-monokai-comment font-mono shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-monokai-green animate-pulse"></span>
            <Database size={10} className="text-monokai-green" />
            <span>DuckDB WASM (Memory)</span>
          </div>
        </div>

        {/* Middle/Center: Dynamic SQL Parameters Injection Inputs */}
        {parsedParams.length > 0 && (
          <div className="flex-1 flex items-center gap-2 px-3 py-1 bg-monokai-surface/30 border border-monokai-accent/15 rounded-sm overflow-x-auto max-w-lg custom-scrollbar">
            <span className="text-[10px] text-monokai-yellow font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Cpu size={10} />
              SQL 参数:
            </span>
            {parsedParams.map(name => (
              <div key={name} className="flex items-center gap-1 shrink-0 font-mono text-xs">
                <span className="text-monokai-comment text-[10px]">:{name}=</span>
                <input
                  type="text"
                  value={paramValues[name] || ''}
                  placeholder="值"
                  onChange={e => setParamValues(prev => ({ ...prev, [name]: e.target.value }))}
                  className="w-16 h-6 px-1.5 bg-monokai-bg border border-monokai-accent/50 focus:border-monokai-yellow text-monokai-yellow outline-none rounded-xs text-[10px] text-center"
                />
              </div>
            ))}
          </div>
        )}

        {/* Right Side: AI Prompt Search Input Bar */}
        <div className="flex-1 min-w-[200px] max-w-[420px] h-8 bg-monokai-surface/60 px-3 py-1 rounded-sm border border-monokai-accent/50 focus-within:border-monokai-purple/60 focus-within:shadow-[0_0_8px_rgba(174,129,255,0.2)] transition-all flex items-center justify-between z-10">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Wand2 className="w-3.5 h-3.5 text-monokai-purple/80 shrink-0" />
            <input
              type="text"
              value={aiPrompt}
              onChange={onAiPromptChange}
              onKeyDown={(e) => e.key === 'Enter' && !isAiLoading && onAiGenerate()}
              placeholder="描述需求，AI 生成 SQL..."
              className="bg-transparent border-none focus:ring-0 text-monokai-blue placeholder-monokai-comment/40 outline-none font-mono text-xs flex-1 py-0"
            />
          </div>
          
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {aiPrompt && (
              <button
                onClick={onAiPromptClear}
                className="text-monokai-comment hover:text-monokai-pink transition-colors p-0.5 cursor-pointer"
                title="清除输入"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onAiGenerate}
              disabled={isAiLoading || !aiPrompt.trim()}
              className="text-monokai-purple hover:text-monokai-fg disabled:opacity-40 transition-all p-0.5 cursor-pointer"
              title="AI 生成代码 (Enter)"
            >
              {isAiLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ROW 2: LOWER DECK (Grouped Dropdowns, Results Export, Execution Stats) */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between p-1.5 px-2 bg-monokai-surface/10 gap-2 flex-wrap md:flex-nowrap">
        {/* Left Side: 6 Grouped Dropdowns */}
        <div className="flex items-center gap-1.5 flex-wrap z-50">
          
          {/* Group 1: 数据源 (Data & Connections) */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('datasource')}
              className={`px-2 py-1 border text-[11px] font-bold rounded-xs flex items-center gap-1 transition-all cursor-pointer ${
                activeDropdown === 'datasource' 
                  ? 'bg-monokai-green text-monokai-bg border-monokai-green' 
                  : 'bg-monokai-surface/40 border-monokai-accent/40 hover:border-monokai-green hover:text-monokai-green text-monokai-fg'
              }`}
            >
              <Database size={10} />
              数据源
              <ChevronDown size={8} className={`transition-transform duration-200 ${activeDropdown === 'datasource' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'datasource' && (
              <div className="absolute top-full left-0 mt-1 bg-monokai-sidebar/95 backdrop-blur-md border border-monokai-accent rounded-xs shadow-xl z-55 min-w-[170px] p-1 animate-in fade-in slide-in-from-top-1 duration-150 border-t-monokai-green/50">
                <button 
                  onClick={() => { setShowImportModal(true); setActiveDropdown(null); }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-green/10 hover:text-monokai-green rounded-xs transition-colors flex items-center gap-2"
                >
                  <Upload size={11} className="text-monokai-green" />
                  导入外部数据
                </button>
                <button 
                  onClick={() => { setShowCreateModal(true); setActiveDropdown(null); }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-blue/10 hover:text-monokai-blue rounded-xs transition-colors flex items-center gap-2"
                >
                  <Plus size={11} className="text-monokai-blue" />
                  新建空数据表
                </button>
                <button 
                  onClick={() => { setShowDuplicateModal(true); setActiveDropdown(null); }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-purple/10 hover:text-monokai-purple rounded-xs transition-colors flex items-center gap-2"
                >
                  <Copy size={11} className="text-monokai-purple" />
                  复制克隆已有表
                </button>
                <div className="border-t border-monokai-accent/20 my-1"></div>
                <button 
                  onClick={() => { setShowSettingsModal(true); setActiveDropdown(null); }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-yellow/10 hover:text-monokai-yellow rounded-xs transition-colors flex items-center gap-2"
                >
                  <Settings size={11} className="text-monokai-yellow" />
                  系统运行偏好
                </button>
              </div>
            )}
          </div>

          {/* Group 2: 存储与导出 (Save & Export) */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('save')}
              className={`px-2 py-1 border text-[11px] font-bold rounded-xs flex items-center gap-1 transition-all cursor-pointer ${
                activeDropdown === 'save' 
                  ? 'bg-monokai-orange text-monokai-bg border-monokai-orange' 
                  : 'bg-monokai-surface/40 border-monokai-accent/40 hover:border-monokai-orange hover:text-monokai-orange text-monokai-fg'
              }`}
            >
              <Save size={10} />
              存储/导出
              <ChevronDown size={8} className={`transition-transform duration-200 ${activeDropdown === 'save' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'save' && (
              <div className="absolute top-full left-0 mt-1 bg-monokai-sidebar/95 backdrop-blur-md border border-monokai-accent rounded-xs shadow-xl z-55 min-w-[190px] p-1 animate-in fade-in slide-in-from-top-1 duration-150 border-t-monokai-orange/50">
                <div className="px-2.5 py-0.5 text-[9px] text-monokai-comment uppercase font-bold tracking-wider mb-1">标签与视图管理</div>
                <button 
                  onClick={handleNewTab}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-green/10 hover:text-monokai-green rounded-xs transition-colors flex items-center gap-2"
                >
                  <Plus size={11} className="text-monokai-green" />
                  <span>新建 SQL 标签页</span>
                </button>
                <button 
                  onClick={() => { onSaveModal(); setActiveDropdown(null); }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-orange/10 hover:text-monokai-orange rounded-xs transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Save size={11} className="text-monokai-orange" />
                    <span>保存当前查询</span>
                  </div>
                  <span className="text-[8px] text-monokai-comment/60 font-mono">Ctrl+S</span>
                </button>
                <button 
                  onClick={() => { onOpenMaterializeModal('TABLE'); setActiveDropdown(null); }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-purple/10 hover:text-monokai-purple rounded-xs transition-colors flex items-center gap-2"
                >
                  <Table size={11} className="text-monokai-purple/70" />
                  物化为 DuckDB 表
                </button>
                <button 
                  onClick={() => { onOpenMaterializeModal('VIEW'); setActiveDropdown(null); }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-purple/10 hover:text-monokai-purple rounded-xs transition-colors flex items-center gap-2"
                >
                  <Eye size={11} className="text-monokai-purple/70" />
                  物化为 DuckDB 视图
                </button>

                <div className="border-t border-monokai-accent/20 my-1"></div>
                
                {/* Result Exporters Integrated Directly */}
                <div className="px-2.5 py-0.5 text-[9px] text-monokai-comment uppercase font-bold tracking-wider mb-1">快速导出结果</div>
                <button
                  onClick={() => handleExport('csv')}
                  disabled={!activeTab.result || activeTab.result.rows.length === 0}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-yellow/10 hover:text-monokai-yellow rounded-xs transition-colors flex items-center gap-2 disabled:opacity-30"
                >
                  <Download size={11} className="text-monokai-yellow" />
                  导出为 CSV (Excel)
                </button>
                <button
                  onClick={() => handleExport('json')}
                  disabled={!activeTab.result || activeTab.result.rows.length === 0}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-blue/10 hover:text-monokai-blue rounded-xs transition-colors flex items-center gap-2 disabled:opacity-30"
                >
                  <Download size={11} className="text-monokai-blue" />
                  导出为 JSON 数据
                </button>
                <button
                  onClick={() => handleExport('markdown')}
                  disabled={!activeTab.result || activeTab.result.rows.length === 0}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-orange/10 hover:text-monokai-orange rounded-xs transition-colors flex items-center gap-2 disabled:opacity-30"
                >
                  <Download size={11} className="text-monokai-orange" />
                  导出为 Markdown 表
                </button>
                <button
                  onClick={() => handleExport('html')}
                  disabled={!activeTab.result || activeTab.result.rows.length === 0}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-purple/10 hover:text-monokai-purple rounded-xs transition-colors flex items-center gap-2 disabled:opacity-30"
                >
                  <Download size={11} className="text-monokai-purple" />
                  生成 HTML 报告
                </button>
              </div>
            )}
          </div>

          {/* Group 3: SQL 工具 (SQL Helper) */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('snippets')}
              className={`px-2 py-1 border text-[11px] font-bold rounded-xs flex items-center gap-1 transition-all cursor-pointer ${
                activeDropdown === 'snippets' 
                  ? 'bg-monokai-yellow text-monokai-bg border-monokai-yellow' 
                  : 'bg-monokai-surface/40 border-monokai-accent/40 hover:border-monokai-yellow hover:text-monokai-yellow text-monokai-fg'
              }`}
            >
              <Code size={10} />
              SQL 助手
              <ChevronDown size={8} className={`transition-transform duration-200 ${activeDropdown === 'snippets' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'snippets' && (
              <div className="absolute top-full left-0 mt-1 bg-monokai-sidebar/95 backdrop-blur-md border border-monokai-accent rounded-xs shadow-xl z-55 min-w-[210px] max-h-[320px] overflow-y-auto custom-scrollbar p-1 animate-in fade-in slide-in-from-top-1 duration-150 border-t-monokai-yellow/50">
                <button
                  onClick={() => { onFormatSql(); setActiveDropdown(null); }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-yellow/10 hover:text-monokai-yellow rounded-xs transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 font-bold font-sans">
                    <Type size={11} className="text-monokai-yellow" />
                    <span>格式化 SQL</span>
                  </div>
                  <span className="text-[7px] text-monokai-comment/60 font-mono">Ctrl+Shift+F</span>
                </button>

                <button
                  onClick={() => { onToggleLivePreview(); setActiveDropdown(null); }}
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded-xs transition-colors flex items-center justify-between ${
                    showLivePreview 
                      ? 'bg-monokai-purple/10 text-monokai-purple font-bold' 
                      : 'text-monokai-fg hover:bg-monokai-purple/10 hover:text-monokai-purple'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {showLivePreview ? <Eye size={11} /> : <EyeOff size={11} />}
                    <span>格式化预览</span>
                  </div>
                  {showLivePreview ? (
                    <span className="text-[8px] bg-monokai-purple/20 text-monokai-purple px-1 py-0.5 rounded-xs">已开</span>
                  ) : (
                    <span className="text-[8px] text-monokai-comment/40">已关</span>
                  )}
                </button>

                <div className="border-t border-monokai-accent/20 my-1"></div>
                <div className="px-2.5 py-0.5 text-[9px] text-monokai-comment uppercase font-bold tracking-wider mb-1">常用 SQL 模板</div>
                
                {Object.entries(SNIPPET_GROUPS).map(([groupName, snippets]) => (
                  <div key={groupName} className="px-1">
                    <button
                      className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-monokai-yellow/80 hover:bg-monokai-yellow/5 rounded-xs transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSnippetCategoryToggle(expandedSnippetCategory === groupName ? null : groupName);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="shrink-0">{SNIPPET_CATEGORY_META[groupName]?.icon || <FileText className="w-3 h-3" />}</span>
                        <span className="truncate max-w-[110px] font-sans">{groupName}</span>
                        <span className="text-monokai-comment/50 text-[8px]">({Object.keys(snippets).length})</span>
                      </div>
                      <ChevronDown
                        size={8}
                        className={`transition-transform ${expandedSnippetCategory === groupName ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {expandedSnippetCategory === groupName && (
                      <div className="pl-3 max-h-36 overflow-y-auto custom-scrollbar bg-monokai-bg/30 rounded-xs my-0.5">
                        {Object.entries(snippets).map(([label, snippet]) => (
                          <button
                            key={label}
                            className="w-full text-left px-2.5 py-1 text-xs text-monokai-fg hover:bg-monokai-yellow/10 hover:text-monokai-yellow transition-colors flex items-center gap-1.5"
                            onClick={() => { onSnippetInsert(snippet); setActiveDropdown(null); }}
                          >
                            <Code className="w-3 h-3 text-monokai-yellow/40 shrink-0" />
                            <span className="truncate font-sans">{label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Group 4: 视图与诊断 (Diagnostics & View) */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('layout')}
              className={`px-2 py-1 border text-[11px] font-bold rounded-xs flex items-center gap-1 transition-all cursor-pointer ${
                activeDropdown === 'layout' 
                  ? 'bg-monokai-blue text-monokai-bg border-monokai-blue' 
                  : 'bg-monokai-surface/40 border-monokai-accent/40 hover:border-monokai-blue hover:text-monokai-blue text-monokai-fg'
              }`}
            >
              <Activity size={10} />
              视图诊断
              <ChevronDown size={8} className={`transition-transform duration-200 ${activeDropdown === 'layout' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'layout' && (
              <div className="absolute top-full left-0 mt-1 bg-monokai-sidebar/95 backdrop-blur-md border border-monokai-accent rounded-xs shadow-xl z-55 min-w-[180px] p-1 animate-in fade-in slide-in-from-top-1 duration-150 border-t-monokai-blue/50">
                <div className="px-2.5 py-0.5 text-[9px] text-monokai-comment uppercase font-bold tracking-wider mb-1">结果面板视图</div>
                <button
                  onClick={() => { updateActiveTab({ viewMode: 'table' }); setActiveDropdown(null); }}
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded-xs transition-colors flex items-center gap-2 ${
                    activeTab.viewMode === 'table' ? 'bg-monokai-accent/15 text-monokai-accent font-bold' : 'text-monokai-fg hover:bg-monokai-accent/10 hover:text-monokai-accent'
                  }`}
                >
                  <Table size={11} />
                  数据结果表
                </button>
                <button
                  onClick={() => { updateActiveTab({ viewMode: 'chart' }); setActiveDropdown(null); }}
                  disabled={!activeTab.result || activeTab.result.rows.length === 0}
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded-xs transition-colors flex items-center gap-2 disabled:opacity-30 ${
                    activeTab.viewMode === 'chart' ? 'bg-monokai-pink/15 text-monokai-pink font-bold' : 'text-monokai-fg hover:bg-monokai-pink/10 hover:text-monokai-pink'
                  }`}
                >
                  <BarChart2 size={11} />
                  可视化图表
                </button>
                <button
                  onClick={() => { updateActiveTab({ viewMode: 'explain' }); setActiveDropdown(null); }}
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded-xs transition-colors flex items-center gap-2 ${
                    activeTab.viewMode === 'explain' ? 'bg-monokai-purple/15 text-monokai-purple font-bold' : 'text-monokai-fg hover:bg-monokai-purple/10 hover:text-monokai-purple'
                  }`}
                >
                  <Activity size={11} />
                  诊断执行计划
                </button>
                <button
                  onClick={() => { updateActiveTab({ viewMode: 'profiling' }); setActiveDropdown(null); }}
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded-xs transition-colors flex items-center gap-2 ${
                    activeTab.viewMode === 'profiling' ? 'bg-monokai-green/15 text-monokai-green font-bold' : 'text-monokai-fg hover:bg-monokai-green/10 hover:text-monokai-green'
                  }`}
                >
                  <Activity size={11} />
                  性能剖析视图
                </button>

                <div className="border-t border-monokai-accent/20 my-1"></div>

                <button
                  onClick={() => { onToggleZen(); setActiveDropdown(null); }}
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded-xs transition-colors flex items-center justify-between ${
                    isZenMode 
                      ? 'bg-monokai-pink/10 text-monokai-pink font-bold' 
                      : 'text-monokai-fg hover:bg-monokai-pink/10 hover:text-monokai-pink'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isZenMode ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                    <span>极简禅模式</span>
                  </div>
                  {isZenMode ? (
                    <span className="text-[8px] bg-monokai-pink/20 text-monokai-pink px-1 py-0.5 rounded-xs">开启</span>
                  ) : (
                    <span className="text-[8px] text-monokai-comment/40">关闭</span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Group 5: 历史与树 (History & Schema) */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('history')}
              className={`px-2 py-1 border text-[11px] font-bold rounded-xs flex items-center gap-1 transition-all cursor-pointer ${
                activeDropdown === 'history' 
                  ? 'bg-monokai-yellow text-monokai-bg border-monokai-yellow' 
                  : 'bg-monokai-surface/40 border-monokai-accent/40 hover:border-monokai-yellow hover:text-monokai-yellow text-monokai-fg'
              }`}
            >
              <Clock size={10} />
              执行历史
              <ChevronDown size={8} className={`transition-transform duration-200 ${activeDropdown === 'history' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'history' && (
              <div className="absolute top-full left-0 mt-1 bg-monokai-sidebar/95 backdrop-blur-md border border-monokai-accent rounded-xs shadow-xl z-55 min-w-[210px] max-h-[350px] overflow-y-auto custom-scrollbar p-1 animate-in fade-in slide-in-from-top-1 duration-150 border-t-monokai-yellow/50">
                <div className="px-2.5 py-1 text-[9px] text-monokai-comment uppercase font-bold tracking-wider">最近执行语句</div>
                {storeHistory.length === 0 ? (
                  <div className="px-2.5 py-1.5 text-xs text-monokai-comment/50 italic">暂无执行历史</div>
                ) : (
                  storeHistory.slice(0, 5).map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickHistoryInsert(item.sql)}
                      className="w-full text-left px-2.5 py-1 text-xs text-monokai-fg hover:bg-monokai-yellow/10 hover:text-monokai-yellow rounded-xs transition-colors font-mono truncate block"
                      title={item.sql}
                    >
                      {item.sql}
                    </button>
                  ))
                )}

                <div className="border-t border-monokai-accent/20 my-1"></div>
                <div className="px-2.5 py-1 text-[9px] text-monokai-comment uppercase font-bold tracking-wider">管理面板面板</div>
                <button 
                  onClick={() => handleOpenSidebarTab('history')}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-yellow/10 hover:text-monokai-yellow rounded-xs transition-colors flex items-center gap-2"
                >
                  <Clock size={11} className="text-monokai-yellow/70" />
                  打开历史记录面板
                </button>
                <button 
                  onClick={() => handleOpenSidebarTab('schema')}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-blue/10 hover:text-monokai-blue rounded-xs transition-colors flex items-center gap-2"
                >
                  <Database size={11} className="text-monokai-blue/70" />
                  展开数据库 Schema 树
                </button>
              </div>
            )}
          </div>

          {/* Group 6: 编辑工具 (Edit Utils) */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('edit')}
              className={`px-2 py-1 border text-[11px] font-bold rounded-xs flex items-center gap-1 transition-all cursor-pointer ${
                activeDropdown === 'edit'
                  ? 'bg-monokai-purple text-monokai-bg border-monokai-purple'
                  : 'bg-monokai-surface/40 border-monokai-accent/40 hover:border-monokai-purple hover:text-monokai-purple text-monokai-fg'
              }`}
            >
              <Edit3 size={10} />
              编辑
              <ChevronDown size={8} className={`transition-transform duration-200 ${activeDropdown === 'edit' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'edit' && (
              <div className="absolute top-full left-0 mt-1 bg-monokai-sidebar/95 backdrop-blur-md border border-monokai-accent rounded-xs shadow-xl z-55 min-w-[180px] p-1 animate-in fade-in slide-in-from-top-1 duration-150 border-t-monokai-purple/50">
                <button
                  onClick={handleCopySql}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-green/10 hover:text-monokai-green rounded-xs transition-colors flex items-center gap-2"
                >
                  {copied ? <Check size={11} className="text-monokai-green animate-bounce" /> : <Copy size={11} />}
                  <span>{copied ? '已复制！' : '复制全部 SQL'}</span>
                </button>

                <button
                  onClick={() => { setShowShortcuts(true); setActiveDropdown(null); }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-blue/10 hover:text-monokai-blue rounded-xs transition-colors flex items-center gap-2"
                >
                  <Keyboard size={11} className="text-monokai-blue" />
                  <span>快捷键指南</span>
                </button>

                <div className="border-t border-monokai-accent/20 my-1"></div>

                <button
                  onClick={() => { onClear(); setActiveDropdown(null); }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-pink hover:bg-monokai-pink/10 rounded-xs transition-colors flex items-center justify-between font-bold"
                >
                  <div className="flex items-center gap-2">
                    <Trash2 size={11} />
                    <span>清空编辑器</span>
                  </div>
                  <span className="text-[8px] text-monokai-comment/60 font-mono font-normal">Ctrl+L</span>
                </button>
              </div>
            )}
          </div>

          {/* Group 7: AI 助手 (AI Specialty Tools) */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('ai')}
              className={`px-2 py-1 border text-[11px] font-bold rounded-xs flex items-center gap-1 transition-all cursor-pointer ${
                activeDropdown === 'ai'
                  ? 'bg-monokai-purple text-monokai-bg border-monokai-purple'
                  : 'bg-monokai-purple/10 border-monokai-purple/30 text-monokai-purple hover:bg-monokai-purple hover:text-monokai-bg'
              }`}
            >
              <Sparkles size={10} />
              AI 智能
              <span className="text-[8px] bg-monokai-purple/20 px-1 py-0.5 rounded text-monokai-purple font-mono scale-90 border border-monokai-purple/30 uppercase tracking-tight shrink-0 hidden sm:inline-block">
                {getSqlTypeLabel(selectedSqlType)}
              </span>
              <ChevronDown size={8} className={`transition-transform duration-200 ${activeDropdown === 'ai' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'ai' && (
              <div className="absolute top-full left-0 mt-1 bg-monokai-sidebar/95 backdrop-blur-md border border-monokai-accent rounded-xs shadow-xl z-55 min-w-[200px] p-2.5 animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col gap-2 border-t-monokai-purple/50">
                <div>
                  <div className="text-[9px] text-monokai-comment uppercase font-bold tracking-wider mb-1">AI 模式选择</div>
                  <select
                    value={selectedSqlType}
                    onChange={onSqlTypeChange}
                    className="w-full bg-monokai-bg border border-monokai-accent rounded-xs px-2 py-1 text-xs text-monokai-fg outline-none focus:border-monokai-purple transition-all cursor-pointer h-7"
                  >
                    <option value="select">SELECT 模版</option>
                    <option value="join">JOIN 关联</option>
                    <option value="aggregate">聚合统计</option>
                    <option value="transform">数据清洗转换</option>
                    <option value="performance">性能执行分析</option>
                    <option value="utilities">辅助工具方法</option>
                  </select>
                </div>

                <div className="border-t border-monokai-accent/20 my-0.5"></div>

                <button
                  onClick={() => { onAIFill(); setActiveDropdown(null); }}
                  className="w-full flex items-center justify-between text-left px-2 py-1.5 text-xs text-monokai-fg hover:bg-monokai-green/10 hover:text-monokai-green rounded-xs transition-colors"
                  title={detectedTable ? `基于当前表 ${detectedTable} 进行智能查询模版填充` : '基于上下文生成模版填充'}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={11} className="text-monokai-green" />
                    <span>智能填充模版</span>
                  </div>
                  {detectedTable && (
                    <span className="text-[8px] bg-monokai-green/20 text-monokai-green px-1 py-0.5 rounded font-mono truncate max-w-[80px]">
                      {detectedTable}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => { onAiExplain(); setActiveDropdown(null); }}
                  disabled={!activeTab.code.trim()}
                  className="w-full flex items-center gap-2 text-left px-2 py-1.5 text-xs text-monokai-fg hover:bg-monokai-purple/10 hover:text-monokai-purple disabled:opacity-40 rounded-xs transition-colors"
                  title="AI 全方位解释当前 SQL 的运行机制与结构"
                >
                  <Sparkles size={11} className="text-monokai-purple" />
                  <span>智能解释 SQL</span>
                </button>

                <button
                  onClick={() => { onShowSkillAssistant(); setActiveDropdown(null); }}
                  className="w-full flex items-center gap-2 text-left px-2 py-1.5 text-xs text-monokai-fg hover:bg-monokai-purple/10 hover:text-monokai-purple rounded-xs transition-colors font-bold"
                  title="管理和运行特定的 AI SQL 数据处理技能"
                >
                  <Sparkles size={11} className="text-monokai-purple animate-pulse" />
                  <span>AI 数据处理技能</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Micro-Widgets for Execution Statistics */}
        {activeTab.result && !activeTab.result.error && (
          <div className="flex items-center gap-2.5 px-3 py-1 bg-monokai-surface/30 border border-monokai-accent/10 rounded-sm text-[10px] text-monokai-comment font-mono shrink-0 ml-auto flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-monokai-blue font-bold">⏱️</span>
              <span>执行耗时:</span>
              <span className="text-monokai-blue font-bold">{activeTab.result.executionTime.toFixed(1)}ms</span>
            </div>
            <div className="w-[1px] h-3 bg-monokai-accent/20"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-monokai-green font-bold">📊</span>
              <span>返回行数:</span>
              <span className="text-monokai-green font-bold">{activeTab.result.rows.length.toLocaleString()}</span>
            </div>
            <div className="w-[1px] h-3 bg-monokai-accent/20"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-monokai-yellow font-bold">💾</span>
              <span>估算内存:</span>
              <span className="text-monokai-yellow font-bold">{getEstMemory()}</span>
            </div>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* DIALOG: SHORTCUTS HELP MODAL */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showShortcuts && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-monokai-sidebar border border-monokai-accent rounded-md shadow-2xl p-5 max-w-sm w-full mx-4 relative text-monokai-fg">
            <button 
              onClick={() => setShowShortcuts(false)}
              className="absolute top-3.5 right-3.5 text-monokai-comment hover:text-monokai-pink transition-colors p-1 cursor-pointer"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-2 border-b border-monokai-accent/30 pb-3 mb-4">
              <Keyboard className="text-monokai-blue w-5 h-5" />
              <h3 className="text-sm font-bold">SQL 编辑器快捷键指南</h3>
            </div>
            
            <div className="flex flex-col gap-3 font-mono text-xs">
              <div className="flex justify-between items-center py-1 border-b border-monokai-accent/10">
                <span className="text-monokai-comment">运行 SQL 查询</span>
                <span className="bg-monokai-surface px-2 py-0.5 rounded border border-monokai-accent/50 text-[10px] text-monokai-green">Ctrl + Enter</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-monokai-accent/10">
                <span className="text-monokai-comment">格式化 SQL</span>
                <span className="bg-monokai-surface px-2 py-0.5 rounded border border-monokai-accent/50 text-[10px] text-monokai-yellow">Ctrl + Shift + F</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-monokai-accent/10">
                <span className="text-monokai-comment">保存查询项目</span>
                <span className="bg-monokai-surface px-2 py-0.5 rounded border border-monokai-accent/50 text-[10px] text-monokai-orange">Ctrl + S</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-monokai-accent/10">
                <span className="text-monokai-comment">清空编辑器内容</span>
                <span className="bg-monokai-surface px-2 py-0.5 rounded border border-monokai-accent/50 text-[10px] text-monokai-pink">Ctrl + L</span>
              </div>
            </div>

            <div className="mt-5 text-center">
              <button 
                onClick={() => setShowShortcuts(false)}
                className="px-4 py-1.5 bg-monokai-accent text-monokai-bg font-bold rounded-sm text-xs hover:opacity-90 transition-all cursor-pointer"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
