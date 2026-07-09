import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play, Code, ChevronDown, Sparkles, Save, Type, Trash2, Minimize2, Maximize2,
  Eye, EyeOff, ChevronLeft, Loader2, Wand2, Database, FileText, X, Copy, Check, Keyboard, FolderOpen, Table, HardDrive, Edit3, BarChart2, Activity, Clock, Plus, Settings, Upload, Square, Download, Cpu, Sidebar
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
  const [activeDropdown, setActiveDropdown] = useState<'files' | 'export' | 'templates' | 'history' | 'system' | null>(null);
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
          {/* Sidebar Toggle Button */}
          <button
            onClick={onToggleZen}
            className={`p-1.5 rounded-xs transition-all flex items-center justify-center cursor-pointer border ${
              !isZenMode
                ? 'bg-monokai-accent/10 border-monokai-accent/20 text-monokai-accent hover:bg-monokai-accent hover:text-monokai-bg'
                : 'bg-monokai-surface border-monokai-border text-monokai-comment hover:text-monokai-accent hover:border-monokai-accent/40'
            }`}
            title={isZenMode ? "展开侧边栏 (禅模式关)" : "收起侧边栏 (禅模式开)"}
          >
            <Sidebar size={11} />
          </button>

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
      {/* ROW 2: LOWER DECK (Consolidated Dropdowns) */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between p-1.5 px-2 bg-monokai-surface/20 gap-2 flex-wrap md:flex-nowrap border-t border-monokai-accent/10">
        {/* Left Side: Consolidated Dropdowns */}
        <div className="flex items-center gap-1.5 flex-wrap z-50">
          
          {/* Dropdown 1: 数据与文件 (Files & Data) */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('files')}
              className={`px-2.5 py-1 border text-[11px] font-bold rounded-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeDropdown === 'files' 
                  ? 'bg-monokai-green text-monokai-bg border-monokai-green' 
                  : 'bg-monokai-surface/30 border-monokai-accent/20 hover:border-monokai-green hover:text-monokai-green text-monokai-fg'
              }`}
            >
              <FolderOpen size={10} />
              数据与文件
              <ChevronDown size={8} className={`transition-transform duration-200 ${activeDropdown === 'files' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'files' && (
              <div className="absolute top-full left-0 mt-1 bg-monokai-sidebar/95 backdrop-blur-md border border-monokai-accent/30 rounded-xs shadow-xl z-55 min-w-[180px] p-1 animate-in fade-in slide-in-from-top-1 duration-150 border-t-monokai-green/50">
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
                <div className="px-2.5 py-0.5 text-[9px] text-monokai-comment uppercase font-bold tracking-wider mb-1">数据库表操作</div>
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
              </div>
            )}
          </div>

          {/* Dropdown 2: 数据导出 (Export) */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('export')}
              className={`px-2.5 py-1 border text-[11px] font-bold rounded-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeDropdown === 'export' 
                  ? 'bg-monokai-orange text-monokai-bg border-monokai-orange' 
                  : 'bg-monokai-surface/30 border-monokai-accent/20 hover:border-monokai-orange hover:text-monokai-orange text-monokai-fg'
              }`}
            >
              <Download size={10} />
              数据导出
              <ChevronDown size={8} className={`transition-transform duration-200 ${activeDropdown === 'export' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'export' && (
              <div className="absolute top-full left-0 mt-1 bg-monokai-sidebar/95 backdrop-blur-md border border-monokai-accent/30 rounded-xs shadow-xl z-55 min-w-[170px] p-1 animate-in fade-in slide-in-from-top-1 duration-150 border-t-monokai-orange/50">
                <div className="px-2.5 py-0.5 text-[9px] text-monokai-comment uppercase font-bold tracking-wider mb-1">结果导出格式</div>
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

          {/* Dropdown 3: 智能与模板 (Smart & Templates) */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('templates')}
              className={`px-2.5 py-1 border text-[11px] font-bold rounded-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeDropdown === 'templates' 
                  ? 'bg-monokai-purple text-monokai-bg border-monokai-purple' 
                  : 'bg-monokai-surface/30 border-monokai-accent/20 hover:border-monokai-purple hover:text-monokai-purple text-monokai-fg'
              }`}
            >
              <Sparkles size={10} />
              智能与模板
              <ChevronDown size={8} className={`transition-transform duration-200 ${activeDropdown === 'templates' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'templates' && (
              <div className="absolute top-full left-0 mt-1 bg-monokai-sidebar/95 backdrop-blur-md border border-monokai-accent/30 rounded-xs shadow-xl z-55 min-w-[210px] max-h-[350px] overflow-y-auto custom-scrollbar p-1 animate-in fade-in slide-in-from-top-1 duration-150 border-t-monokai-purple/50">
                <div className="px-2.5 py-0.5 text-[9px] text-monokai-comment uppercase font-bold tracking-wider mb-1">AI 辅助工具</div>
                <div className="px-2 py-1">
                  <select
                    value={selectedSqlType}
                    onChange={onSqlTypeChange}
                    className="w-full bg-monokai-bg border border-monokai-accent/40 rounded-xs px-2 py-1 text-xs text-monokai-fg outline-none focus:border-monokai-purple transition-all cursor-pointer h-7"
                  >
                    <option value="select">SELECT 模版</option>
                    <option value="join">JOIN 关联</option>
                    <option value="aggregate">聚合统计</option>
                    <option value="transform">数据清洗转换</option>
                    <option value="performance">性能执行分析</option>
                    <option value="utilities">辅助工具方法</option>
                  </select>
                </div>

                <button
                  onClick={() => { onAIFill(); setActiveDropdown(null); }}
                  className="w-full flex items-center justify-between text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-green/10 hover:text-monokai-green rounded-xs transition-colors"
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
                  className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-purple/10 hover:text-monokai-purple disabled:opacity-40 rounded-xs transition-colors"
                >
                  <Sparkles size={11} className="text-monokai-purple" />
                  <span>AI 智能解释 SQL</span>
                </button>

                <button
                  onClick={() => { onShowSkillAssistant(); setActiveDropdown(null); }}
                  className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-purple/10 hover:text-monokai-purple rounded-xs transition-colors font-bold"
                >
                  <Sparkles size={11} className="text-monokai-purple animate-pulse" />
                  <span>AI 数据处理技能</span>
                </button>

                <div className="border-t border-monokai-accent/20 my-1"></div>
                <div className="px-2.5 py-0.5 text-[9px] text-monokai-comment uppercase font-bold tracking-wider mb-1">SQL 语法排版</div>
                <button
                  onClick={() => { onFormatSql(); setActiveDropdown(null); }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-yellow/10 hover:text-monokai-yellow rounded-xs transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 font-bold">
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
                        <span className="truncate max-w-[110px]">{groupName}</span>
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
                            <span className="truncate">{label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dropdown 4: 执行历史 (History) */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('history')}
              className={`px-2.5 py-1 border text-[11px] font-bold rounded-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeDropdown === 'history' 
                  ? 'bg-monokai-yellow text-monokai-bg border-monokai-yellow' 
                  : 'bg-monokai-surface/30 border-monokai-accent/20 hover:border-monokai-yellow hover:text-monokai-yellow text-monokai-fg'
              }`}
            >
              <Clock size={10} />
              执行历史
              <ChevronDown size={8} className={`transition-transform duration-200 ${activeDropdown === 'history' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'history' && (
              <div className="absolute top-full left-0 mt-1 bg-monokai-sidebar/95 backdrop-blur-md border border-monokai-accent/30 rounded-xs shadow-xl z-55 min-w-[210px] max-h-[350px] overflow-y-auto custom-scrollbar p-1 animate-in fade-in slide-in-from-top-1 duration-150 border-t-monokai-yellow/50">
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
                <div className="px-2.5 py-1 text-[9px] text-monokai-comment uppercase font-bold tracking-wider">管理面板</div>
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

          {/* Dropdown 5: 系统设置 (System Settings) */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('system')}
              className={`px-2.5 py-1 border text-[11px] font-bold rounded-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeDropdown === 'system' 
                  ? 'bg-monokai-blue text-monokai-bg border-monokai-blue' 
                  : 'bg-monokai-surface/30 border-monokai-accent/20 hover:border-monokai-blue hover:text-monokai-blue text-monokai-fg'
              }`}
            >
              <Settings size={10} />
              系统设置
              <ChevronDown size={8} className={`transition-transform duration-200 ${activeDropdown === 'system' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'system' && (
              <div className="absolute top-full left-0 mt-1 bg-monokai-sidebar/95 backdrop-blur-md border border-monokai-accent/30 rounded-xs shadow-xl z-55 min-w-[180px] p-1 animate-in fade-in slide-in-from-top-1 duration-150 border-t-monokai-blue/50">
                <div className="px-2.5 py-0.5 text-[9px] text-monokai-comment uppercase font-bold tracking-wider mb-1">系统与视图</div>
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
                  {isZenMode && <span className="text-[8px] bg-monokai-pink/20 text-monokai-pink px-1 py-0.5 rounded-xs">开</span>}
                </button>

                <button 
                  onClick={() => { setShowSettingsModal(true); setActiveDropdown(null); }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-yellow/10 hover:text-monokai-yellow rounded-xs transition-colors flex items-center gap-2"
                >
                  <Settings size={11} className="text-monokai-yellow" />
                  <span>系统运行偏好</span>
                </button>

                <button
                  onClick={() => { setShowShortcuts(true); setActiveDropdown(null); }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-blue/10 hover:text-monokai-blue rounded-xs transition-colors flex items-center gap-2"
                >
                  <Keyboard size={11} className="text-monokai-blue" />
                  <span>快捷键指南</span>
                </button>

                <div className="border-t border-monokai-accent/20 my-1"></div>
                <div className="px-2.5 py-0.5 text-[9px] text-monokai-comment uppercase font-bold tracking-wider mb-1">编辑器操作</div>
                
                <button
                  onClick={handleCopySql}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-green/10 hover:text-monokai-green rounded-xs transition-colors flex items-center gap-2"
                >
                  {copied ? <Check size={11} className="text-monokai-green animate-bounce" /> : <Copy size={11} />}
                  <span>{copied ? '已复制！' : '复制全部 SQL'}</span>
                </button>

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
        </div>
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
