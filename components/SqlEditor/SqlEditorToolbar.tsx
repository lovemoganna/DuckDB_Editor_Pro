import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play, Code, ChevronDown, Sparkles, Save, Type, Trash2, Minimize2, Maximize2,
  ChevronLeft, Loader2, Wand2, FileText, X, Copy, Check, Keyboard, FolderOpen, Table, Plus, Settings, Upload, Square, Download, Sidebar, Eye, EyeOff, BookOpen, Cpu, Star, ExternalLink, Search, Variable
} from 'lucide-react';
import { SqlTab, Tab } from '../../types';
import { QUICK_TEMPLATE_CATEGORIES } from '../../data/duckdbTemplatesData';
import { useSqlEditorStore } from '../../hooks/store/useSqlEditorStore';
import { useAppStore } from '../../hooks/store/useAppStore';
import { exportCsv, exportJson, exportMarkdown, generateHtmlReport } from '../../utils/sqlExporter';
import { EDITOR_THEMES } from '../../themes/sqlEditorThemes';
import { getStoredAiCapabilities, AiCapabilityDefinition, AI_CAPABILITIES_CHANGED_EVENT, AI_CAPABILITY_CATEGORIES } from '../../services/aiCapabilitiesStorage';
import { getStoredSqlTemplates, TEMPLATES_CHANGED_EVENT, DuckDbQuickTemplate } from '../../services/sqlTemplatesStorage';
import { SaveTemplateModal } from '../SqlTemplates/SaveTemplateModal';
import { SaveCapabilityModal } from '../AiCapabilityLibrary/SaveCapabilityModal';
import { toastService } from '../../services/toastService';
import { duckDBService } from '../../services/duckdbService';

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
  tables?: string[];
  onAiPromptChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAiPromptClear: () => void;
  onAiGenerate: () => void;
  onSqlTypeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onAIFill: () => void;
  onAiExplain: () => void;
  onAiFix?: () => void;
  onAiOptimize?: () => void;
  onAiResultInsight?: () => void;
  onOpenKnowledgeHub?: () => void;
  onExecuteCapability?: (cap: AiCapabilityDefinition) => void;
}

export const SqlEditorToolbar: React.FC<SqlEditorToolbarProps> = ({
  activeTab,
  isZenMode,
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
  hoveredSnippet,
  onSnippetHover,
  onAiPromptChange,
  onAiPromptClear,
  onAiGenerate,
  onSqlTypeChange,
  onAIFill,
  onAiExplain,
  onAiFix,
  onAiOptimize,
  onAiResultInsight,
  onOpenKnowledgeHub,
  onExecuteCapability,
}) => {
  // Local Dropdown state (4 dedicated, non-overlapping categories)
  const [activeDropdown, setActiveDropdown] = useState<'files' | 'ai' | 'snippets' | 'more' | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close active dropdown when clicking anywhere outside the toolbar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [showSaveCapabilityModal, setShowSaveCapabilityModal] = useState(false);
  const [analysisHubTemplates, setAnalysisHubTemplates] = useState<DuckDbQuickTemplate[]>(() => getStoredSqlTemplates());
  const [registeredCapabilities, setRegisteredCapabilities] = useState<AiCapabilityDefinition[]>(() => getStoredAiCapabilities());

  useEffect(() => {
    const updateTemplates = () => {
      setAnalysisHubTemplates(getStoredSqlTemplates());
    };
    window.addEventListener(TEMPLATES_CHANGED_EVENT, updateTemplates);
    return () => window.removeEventListener(TEMPLATES_CHANGED_EVENT, updateTemplates);
  }, []);

  useEffect(() => {
    const updateCapabilities = () => {
      setRegisteredCapabilities(getStoredAiCapabilities());
    };
    window.addEventListener(AI_CAPABILITIES_CHANGED_EVENT, updateCapabilities);
    return () => window.removeEventListener(AI_CAPABILITIES_CHANGED_EVENT, updateCapabilities);
  }, []);

  const availableTables = useAppStore((s) => s.tables) || [];
  const [targetTable, setTargetTable] = useState<string>(() => availableTables[0] || '');
  const [dynamicColumns, setDynamicColumns] = useState<string[]>([]);

  useEffect(() => {
    if (availableTables.length > 0 && (!targetTable || !availableTables.includes(targetTable))) {
      setTargetTable(availableTables[0]);
    }
  }, [availableTables, targetTable]);

  useEffect(() => {
    let isMounted = true;
    if (targetTable) {
      duckDBService.getTableColumns(targetTable).then((cols) => {
        if (isMounted && cols.length > 0) {
          setDynamicColumns(cols);
        }
      });
    }
    return () => { isMounted = false; };
  }, [targetTable]);

  const availableColumns = useMemo(() => {
    if (dynamicColumns.length > 0) {
      return dynamicColumns;
    }
    if (activeTab.result?.columns && activeTab.result.columns.length > 0) {
      return activeTab.result.columns;
    }
    return ['id', 'name', 'status', 'score'];
  }, [dynamicColumns, activeTab.result?.columns]);

  const [targetColumn, setTargetColumn] = useState<string>(() => availableColumns[0] || 'id');

  useEffect(() => {
    if (availableColumns.length > 0 && (!targetColumn || !availableColumns.includes(targetColumn))) {
      setTargetColumn(availableColumns[0]);
    }
  }, [availableColumns, targetColumn]);

  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [allExpanded, setAllExpanded] = useState(false);

  // Dynamic sub-sections from Analysis Hub categories
  const categorizedTemplates = useMemo(() => {
    const term = templateSearchTerm.trim().toLowerCase();
    const groups: { groupKey: string; groupLabel: string; icon: string; items: DuckDbQuickTemplate[] }[] = [];

    // Categories from Analysis Hub (includes system & custom templates grouped by category)
    QUICK_TEMPLATE_CATEGORIES.forEach(cat => {
      let items = analysisHubTemplates.filter(t => t.category === cat.key);
      if (term) {
        items = items.filter(t => 
          t.title.toLowerCase().includes(term) ||
          t.purpose.toLowerCase().includes(term) ||
          t.sqlExample.toLowerCase().includes(term)
        );
      }
      if (items.length > 0) {
        groups.push({
          groupKey: cat.key,
          groupLabel: cat.label,
          icon: cat.icon,
          items,
        });
      }
    });

    return groups;
  }, [analysisHubTemplates, templateSearchTerm]);

  const [aiSearchTerm, setAiSearchTerm] = useState('');
  const [expandedAiCategory, setExpandedAiCategory] = useState<string | null>(null);
  const [allAiExpanded, setAllAiExpanded] = useState(false);

  // Group registered AI Capabilities by Category
  const categorizedCapabilities = useMemo(() => {
    const term = aiSearchTerm.trim().toLowerCase();
    const groups: { groupKey: string; groupLabel: string; icon: string; items: AiCapabilityDefinition[] }[] = [];

    AI_CAPABILITY_CATEGORIES.forEach(cat => {
      let items = registeredCapabilities.filter(c => c.category === cat.key);
      if (term) {
        items = items.filter(c =>
          c.name.toLowerCase().includes(term) ||
          c.description.toLowerCase().includes(term) ||
          c.purpose.toLowerCase().includes(term) ||
          (c.tags || []).some(t => t.toLowerCase().includes(term))
        );
      }
      if (items.length > 0) {
        groups.push({
          groupKey: cat.key,
          groupLabel: cat.label,
          icon: cat.icon,
          items,
        });
      }
    });

    return groups;
  }, [registeredCapabilities, aiSearchTerm]);

  // Zustand Store selectors
  const createTab = useSqlEditorStore((s) => s.createTab);
  const setActiveTabId = useSqlEditorStore((s) => s.setActiveTabId);
  const editorTheme = useSqlEditorStore((s) => s.editorTheme);
  const setEditorTheme = useSqlEditorStore((s) => s.setEditorTheme);

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
      blob = new Blob([exportMarkdown(result)], { type: 'text/markdown;charset=utf-8' });
      filename += '.md';
    } else {
      blob = new Blob([generateHtmlReport(activeTab.title, activeTab.code, result)], { type: 'text/html;charset=utf-8' });
      filename += '.html';
    }
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setActiveDropdown(null);
  };

  return (
    <div className="flex flex-col shrink-0 border-b border-monokai-border bg-monokai-sidebar z-40 select-none">
      <div ref={toolbarRef as any} className="h-10 px-3 flex items-center justify-between gap-2 text-monokai-fg text-xs">
      
      {/* ──────────────────────────────────────────────────────────── */}
      {/* LEFT: High-Frequency Core Direct Actions */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Sidebar Toggle Button */}
        <button
          onClick={onToggleZen}
          className={`h-7.5 w-7.5 rounded-md transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
            !isZenMode
              ? 'bg-monokai-accent/15 text-monokai-accent hover:bg-monokai-accent hover:text-monokai-bg'
              : 'bg-monokai-surface text-monokai-comment hover:text-monokai-accent'
          }`}
          title={isZenMode ? '展开侧边栏' : '收起侧边栏'}
        >
          <Sidebar size={14} />
        </button>

        {/* Primary Action: Run / Stop SQL Query */}
        {activeTab.loading ? (
          <button
            onClick={onCancel}
            className="h-7.5 px-3.5 bg-monokai-pink text-monokai-bg font-bold rounded-md text-xs hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
            title="停止当前查询"
          >
            <Square size={12} fill="currentColor" />
            <span>停止</span>
          </button>
        ) : (
          <button
            onClick={handleExecuteWithParams}
            className="h-7.5 px-3.5 bg-monokai-green text-monokai-bg font-bold rounded-md text-xs hover:bg-[#b8f53c] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
            title="运行 SQL (Ctrl+Enter)"
          >
            <Play size={12} fill="currentColor" />
            <span>运行</span>
          </button>
        )}

        {/* High-Frequency: Format SQL */}
        <button
          onClick={onFormatSql}
          className="h-7.5 px-2.5 bg-monokai-surface hover:bg-monokai-hover border border-monokai-border text-monokai-fg font-medium rounded-md text-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
          title="格式化代码 (Ctrl+Shift+F)"
        >
          <Type size={13} className="text-monokai-comment" />
          <span>格式化</span>
        </button>

        {/* Conditional Undo Clear */}
        {lastClearedContent && (
          <button
            onClick={onUndoClear}
            className="h-7.5 flex items-center gap-1.5 px-2.5 bg-monokai-surface hover:bg-monokai-hover text-monokai-accent text-xs font-semibold rounded-md border border-monokai-border transition-all cursor-pointer active:scale-[0.98]"
            title="撤销上一次清除"
          >
            <ChevronLeft size={13} />
            <span>撤销</span>
          </button>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* RIGHT: Streamlined 3-Group Action Dropdowns */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 shrink-0 z-50">
        
        {/* Dropdown 1: 📚 SQL 模板 (First in Toolbar) */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown('snippets')}
            className={`h-7.5 px-2.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] ${
              activeDropdown === 'snippets' 
                ? 'bg-monokai-surface text-monokai-accent font-semibold shadow-xs' 
                : 'bg-monokai-surface hover:bg-monokai-hover text-monokai-fg'
            }`}
          >
            <FileText size={13} />
            SQL 模板
            <ChevronDown size={11} className={`transition-transform duration-200 ${activeDropdown === 'snippets' ? 'rotate-180' : ''}`} />
          </button>

          {activeDropdown === 'snippets' && (
            <div className="absolute top-full right-0 mt-1 bg-monokai-sidebar border border-monokai-border rounded-lg shadow-2xl z-[120] min-w-[350px] max-w-[calc(100vw-32px)] max-h-[75vh] overflow-y-auto custom-scrollbar p-2.5 animate-in fade-in duration-100 flex flex-col gap-2">
              {/* Header & Templates count */}
              <div className="px-2 py-1 text-[10px] text-monokai-comment uppercase font-bold tracking-wider flex items-center justify-between border-b border-monokai-border-subtle pb-1.5">
                <span className="flex items-center gap-1.5 font-sans text-monokai-fg font-medium">
                  <FileText size={12} className="text-monokai-accent" />
                  <span>SQL 模板与代码片段</span>
                </span>
                <span className="font-mono text-monokai-fg-muted text-[10px] bg-monokai-surface px-1.5 py-0.5 rounded border border-monokai-border-subtle">{analysisHubTemplates.length} 项模板</span>
              </div>

              {/* Menu Top Search Bar & Action Controls */}
              <div className="flex flex-col gap-1.5 border-b border-monokai-border/40 pb-2">
                <div className="relative flex items-center">
                  <Search size={11} className="absolute left-2.5 text-monokai-comment" />
                  <input
                    type="text"
                    value={templateSearchTerm}
                    onChange={(e) => setTemplateSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setActiveDropdown(null);
                      }
                    }}
                    placeholder="搜索 SQL 模板 (例如: JOIN, 聚合)..."
                    className="w-full bg-monokai-bg rounded-md pl-7 pr-7 py-1 text-xs text-monokai-fg outline-none focus:ring-1 focus:ring-monokai-accent/30 placeholder:text-monokai-comment/60 font-medium"
                  />
                  {templateSearchTerm && (
                    <button
                      aria-label="清空搜索"
                      onClick={() => setTemplateSearchTerm('')}
                      className="absolute right-2 text-monokai-comment hover:text-monokai-pink cursor-pointer"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                {/* Table & Column Target Selector Bar */}
                <div className="flex items-center justify-between gap-1.5 px-2 py-1 bg-monokai-bg/70 rounded-md text-monokai-comment">
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    <span className="font-semibold text-monokai-fg text-[9px] shrink-0">🎯 表:</span>
                    <select
                      value={targetTable}
                      onChange={(e) => setTargetTable(e.target.value)}
                      className="bg-monokai-surface text-monokai-yellow rounded px-1 py-0.5 text-[9px] outline-none font-mono cursor-pointer min-w-0 flex-1 truncate"
                    >
                      {availableTables.length === 0 ? (
                        <option value="">(暂无可用数据表)</option>
                      ) : (
                        availableTables.map((tbl) => (
                          <option key={tbl} value={tbl}>{tbl}</option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    <span className="font-semibold text-monokai-fg text-[9px] shrink-0">📌 列:</span>
                    <select
                      value={targetColumn}
                      onChange={(e) => setTargetColumn(e.target.value)}
                      className="bg-monokai-surface text-monokai-cyan rounded px-1 py-0.5 text-[9px] outline-none font-mono cursor-pointer min-w-0 flex-1 truncate"
                    >
                      {availableColumns.length === 0 ? (
                        <option value="">(暂无列)</option>
                      ) : (
                        availableColumns.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between px-1 pt-0.5 text-[9px] text-monokai-comment font-bold">
                  <span>模板分类 ({categorizedTemplates.reduce((acc, g) => acc + g.items.length, 0)} 项)</span>
                  <button
                    onClick={() => setAllExpanded(!allExpanded)}
                    className="text-monokai-yellow hover:underline cursor-pointer flex items-center gap-0.5 font-mono text-[9px]"
                  >
                    {allExpanded ? '折叠全部' : '展开全部'}
                  </button>
                </div>
              </div>
              
              {/* Dynamic Analysis Hub Sub-sections */}
              {categorizedTemplates.length === 0 ? (
                <div className="p-4 text-center flex flex-col items-center justify-center gap-1.5 text-monokai-comment my-2">
                  <FileText size={20} className="text-monokai-comment/40" />
                  <span className="text-xs font-bold text-monokai-fg">未找到匹配的 SQL 模板</span>
                  <span className="text-[10px] text-monokai-comment/80">没有包含「{templateSearchTerm}」的模板</span>
                  <button
                    onClick={() => setTemplateSearchTerm('')}
                    className="mt-1 px-2.5 py-1 text-[10px] font-bold bg-monokai-surface hover:bg-monokai-surface/80 text-monokai-yellow rounded cursor-pointer active:scale-95 transition-all"
                  >
                    清空搜索关键词
                  </button>
                </div>
              ) : (
                categorizedTemplates.map((catGroup) => {
                  const isGroupExpanded = templateSearchTerm.trim() !== '' || allExpanded || expandedSnippetCategory === catGroup.groupKey;
                  return (
                    <div key={catGroup.groupKey} className="rounded-md overflow-hidden bg-monokai-bg/40 mb-1">
                      <button
                        className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-bold rounded-xs transition-colors cursor-pointer text-monokai-fg hover:bg-monokai-surface/60 text-left"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSnippetCategoryToggle(expandedSnippetCategory === catGroup.groupKey ? null : catGroup.groupKey);
                        }}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span>{catGroup.icon}</span>
                          <span className="truncate">{catGroup.groupLabel}</span>
                          <span className="text-monokai-comment font-mono text-[9px] bg-monokai-surface px-1.5 py-0.5 rounded font-normal">({catGroup.items.length})</span>
                        </div>
                        <ChevronDown
                          size={11}
                          className={`transition-transform duration-150 shrink-0 text-monokai-comment ${isGroupExpanded ? 'rotate-180 text-monokai-yellow' : ''}`}
                        />
                      </button>
                      {isGroupExpanded && (
                        <div className="p-1 border-t border-monokai-border/40 flex flex-col gap-0.5 bg-monokai-sidebar/50">
                          {catGroup.items.map((tpl) => {
                            const table = targetTable || availableTables[0] || 'table_name';
                            const col = (availableColumns.includes(targetColumn) ? targetColumn : availableColumns[0]) || 'column_name';
                            const substituted = tpl.sqlExample
                              .replace(/\$\{table_name\}|\{table_name\}|\$\{table\}|\{table\}/g, table)
                              .replace(/\$\{column_name\}|\{column_name\}|\$\{column\}|\{column\}/g, col);

                            return (
                              <div
                                key={tpl.id}
                                className="w-full text-left px-2 py-1.5 text-xs text-monokai-fg hover:bg-monokai-yellow/15 hover:text-monokai-yellow transition-colors flex items-start justify-between gap-1.5 cursor-pointer group rounded"
                                onMouseEnter={() => onSnippetHover({ label: tpl.title, sql: tpl.sqlExample })}
                                onMouseLeave={() => onSnippetHover(null)}
                                onClick={() => {
                                  onSnippetInsert(substituted);
                                  onSnippetHover(null);
                                  setActiveDropdown(null);
                                  toastService.success(`已插入「${tpl.title}」(自动关联表 ${table})`);
                                }}
                              >
                                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <Code className="w-3 h-3 text-monokai-yellow/60 group-hover:text-monokai-yellow shrink-0 mt-0.5" />
                                    <span className="truncate font-semibold text-xs text-monokai-fg group-hover:text-monokai-yellow">{tpl.title}</span>
                                  </div>
                                  <span className="text-[10px] text-monokai-comment/80 line-clamp-1 pl-4 font-sans font-normal">{tpl.purpose}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                  <button
                                    title="复制 SQL 代码"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(substituted);
                                      toastService.success(`已复制「${tpl.title}」SQL 代码`);
                                    }}
                                    className="p-1 hover:bg-monokai-yellow/20 rounded text-monokai-comment hover:text-monokai-yellow opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                  >
                                    <Copy size={10} />
                                  </button>
                                  <button
                                    title="生成为 DuckDB MACRO 宏函数"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                       const macroName = `macro_${tpl.id}`;
                                       const cleanSubstituted = substituted.trim().replace(/;+$/, '');
                                       const macroSql = `CREATE OR REPLACE MACRO ${macroName}() AS (\n  ${cleanSubstituted}\n);`;
                                      onSnippetInsert(macroSql);
                                      setActiveDropdown(null);
                                      toastService.success(`已生成 MACRO 代码「${macroName}」`);
                                    }}
                                    className="p-1 hover:bg-monokai-blue/20 rounded text-monokai-comment hover:text-monokai-blue opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center gap-0.5 font-mono text-[8px]"
                                  >
                                    <Sparkles size={9} className="text-monokai-blue" />
                                    <span>宏</span>
                                  </button>
                                  {tpl.isSystem === false && (
                                    <span className="text-[8px] bg-monokai-yellow/20 text-monokai-yellow px-1 rounded font-mono shrink-0">自定义</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              <div className="pt-1">
                <button
                  onClick={() => {
                    useAppStore.getState().setActiveTab(Tab.ANALYSIS_HUB);
                    setActiveDropdown(null);
                  }}
                  className="w-full flex items-center justify-between text-left px-2.5 py-1.5 text-xs text-monokai-yellow hover:bg-monokai-yellow/15 rounded-md transition-colors font-bold cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <ExternalLink size={12} className="text-monokai-yellow" />
                    <span>⚡ 打开 Analysis Hub 模板大厅</span>
                  </div>
                  <ChevronLeft size={10} className="rotate-180 text-monokai-yellow" />
                </button>
              </div>
            </div>
          )}

          {/* Floating Snippet Code Preview Popover */}
          {hoveredSnippet && (
            <div className="absolute right-full top-0 mr-2 w-80 bg-monokai-sidebar/95 backdrop-blur-xl border border-monokai-border rounded-xl p-3 shadow-2xl z-[130] pointer-events-none animate-in fade-in duration-150">
              <div className="text-[10px] font-bold text-monokai-yellow uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Code size={12} className="text-monokai-yellow" />
                <span>模板代码预览: {hoveredSnippet.label}</span>
              </div>
              <pre className="text-[10px] font-mono text-monokai-fg bg-monokai-bg/90 p-2.5 rounded-lg border border-monokai-border/60 overflow-x-auto whitespace-pre-wrap max-h-56 custom-scrollbar">
                <code>{hoveredSnippet.sql}</code>
              </pre>
            </div>
          )}
        </div>

        {/* Dropdown 2: 📁 文件与导出 (Files & Export) */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown('files')}
            className={`h-7.5 px-2.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] ${
              activeDropdown === 'files' 
                ? 'bg-monokai-green text-monokai-bg shadow-xs font-bold' 
                : 'bg-monokai-surface hover:bg-monokai-surface/80 hover:text-monokai-green text-monokai-fg border border-monokai-border/40'
            }`}
          >
            <FolderOpen size={13} />
            文件与导出
            <ChevronDown size={11} className={`transition-transform duration-200 ${activeDropdown === 'files' ? 'rotate-180' : ''}`} />
          </button>

          {activeDropdown === 'files' && (
            <div className="absolute top-full right-0 mt-1 bg-monokai-sidebar/95 backdrop-blur-xl border border-monokai-border rounded-xl shadow-2xl z-[120] min-w-[340px] max-w-[calc(100vw-32px)] max-h-[75vh] overflow-y-auto custom-scrollbar p-2.5 animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col gap-2">
              {/* Header & Items count */}
              <div className="px-2 py-1 text-[10px] text-monokai-comment uppercase font-bold tracking-wider flex items-center justify-between border-b border-monokai-border/60 pb-1.5">
                <span className="flex items-center gap-1.5 font-sans">
                  <FolderOpen size={12} className="text-monokai-green" />
                  <span>文件与数据导出</span>
                </span>
                <span className="font-mono text-monokai-green text-[10px] font-bold bg-monokai-green/10 px-1.5 py-0.5 rounded border border-monokai-border">8 项功能</span>
              </div>

              {/* Group 1: Query Files */}
              <div className="rounded-lg overflow-hidden bg-monokai-surface/40 border border-monokai-border/50 p-2 flex flex-col gap-1">
                <div className="px-1 text-[9px] font-bold text-monokai-comment uppercase tracking-wider flex items-center gap-1">
                  <span>📝 SQL 查询文件操作</span>
                </div>
                <button 
                  onClick={handleNewTab}
                  className="w-full text-left px-2 py-1.5 text-xs text-monokai-fg hover:bg-monokai-green/15 hover:text-monokai-green rounded transition-colors flex items-center gap-2 font-medium cursor-pointer"
                >
                  <Plus size={11} className="text-monokai-green" />
                  <span>新建 SQL 标签页</span>
                </button>
                <button 
                  onClick={() => { onSaveModal(); setActiveDropdown(null); }}
                  className="w-full text-left px-2 py-1.5 text-xs text-monokai-fg hover:bg-monokai-orange/15 hover:text-monokai-orange rounded transition-colors flex items-center justify-between font-medium cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Save size={11} className="text-monokai-orange" />
                    <span>保存当前查询</span>
                  </div>
                  <span className="text-[8px] bg-monokai-surface text-monokai-comment px-1.5 py-0.5 rounded font-mono">Ctrl+S</span>
                </button>
                <button 
                  onClick={() => { setShowSaveTemplateModal(true); setActiveDropdown(null); }}
                  className="w-full text-left px-2 py-1.5 text-xs text-monokai-fg hover:bg-monokai-amethyst/15 hover:text-monokai-amethyst rounded transition-colors flex items-center justify-between font-bold cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={11} className="text-monokai-amethyst" />
                    <span>✨ 沉淀为 Analysis Hub 模板</span>
                  </div>
                </button>
                <button 
                  onClick={handleCopySql}
                  className="w-full text-left px-2 py-1.5 text-xs text-monokai-fg hover:bg-monokai-blue/15 hover:text-monokai-blue rounded transition-colors flex items-center gap-2 font-medium cursor-pointer"
                >
                  {copied ? <Check size={11} className="text-monokai-green animate-bounce" /> : <Copy size={11} className="text-monokai-blue" />}
                  <span>{copied ? '已复制 SQL 代码！' : '复制 SQL 代码'}</span>
                </button>
              </div>

              {/* Group 2: Results Export */}
              <div className="rounded-md overflow-hidden bg-monokai-bg/40 p-1.5 flex flex-col gap-1">
                <div className="px-1 text-[9px] font-bold text-monokai-comment uppercase tracking-wider flex items-center gap-1">
                  <span>📤 结果数据导出</span>
                </div>
                <button
                  onClick={() => handleExport('csv')}
                  disabled={!activeTab.result || activeTab.result.rows.length === 0}
                  className="w-full text-left px-2 py-1.5 text-xs text-monokai-fg hover:bg-monokai-yellow/15 hover:text-monokai-yellow rounded transition-colors flex items-center gap-2 disabled:opacity-30 cursor-pointer font-medium"
                >
                  <Download size={11} className="text-monokai-yellow" />
                  导出为 CSV (Excel)
                </button>
                <button
                  onClick={() => handleExport('json')}
                  disabled={!activeTab.result || activeTab.result.rows.length === 0}
                  className="w-full text-left px-2 py-1.5 text-xs text-monokai-fg hover:bg-monokai-blue/15 hover:text-monokai-blue rounded transition-colors flex items-center gap-2 disabled:opacity-30 cursor-pointer font-medium"
                >
                  <Download size={11} className="text-monokai-blue" />
                  导出为 JSON
                </button>
                <button
                  onClick={() => handleExport('markdown')}
                  disabled={!activeTab.result || activeTab.result.rows.length === 0}
                  className="w-full text-left px-2 py-1.5 text-xs text-monokai-fg hover:bg-monokai-orange/15 hover:text-monokai-orange rounded transition-colors flex items-center gap-2 disabled:opacity-30 cursor-pointer font-medium"
                >
                  <Download size={11} className="text-monokai-orange" />
                  导出为 Markdown 表
                </button>
                <button
                  onClick={() => handleExport('html')}
                  disabled={!activeTab.result || activeTab.result.rows.length === 0}
                  className="w-full text-left px-2 py-1.5 text-xs text-monokai-fg hover:bg-monokai-amethyst/15 hover:text-monokai-amethyst rounded transition-colors flex items-center gap-2 disabled:opacity-30 cursor-pointer font-medium"
                >
                  <Download size={11} className="text-monokai-amethyst" />
                  生成 HTML 报表
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dropdown 3: 🪄 AI 智能 (AI Assistant) */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown('ai')}
            className={`h-7.5 px-2.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] ${
              activeDropdown === 'ai' 
                ? 'bg-monokai-amethyst text-monokai-bg shadow-xs font-bold' 
                : 'bg-monokai-surface hover:bg-monokai-surface/80 hover:text-monokai-amethyst text-monokai-fg border border-monokai-border/40'
            }`}
          >
            <Sparkles size={13} />
            AI 智能
            <ChevronDown size={11} className={`transition-transform duration-200 ${activeDropdown === 'ai' ? 'rotate-180' : ''}`} />
          </button>

          {activeDropdown === 'ai' && (
            <div className="absolute top-full right-0 mt-1 bg-monokai-sidebar/95 backdrop-blur-xl border border-monokai-border rounded-xl shadow-2xl z-[120] min-w-[350px] max-w-[calc(100vw-32px)] max-h-[75vh] overflow-y-auto custom-scrollbar p-2.5 animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col gap-2">
              {/* Header & Capabilities count */}
              <div className="px-2 py-1 text-[10px] text-monokai-comment uppercase font-bold tracking-wider flex items-center justify-between border-b border-monokai-border/60 pb-1.5">
                <span className="flex items-center gap-1.5 font-sans">
                  <Sparkles size={12} className="text-monokai-amethyst" />
                  <span>AI 能力库关联调用</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setShowSaveCapabilityModal(true); setActiveDropdown(null); }}
                    className="flex items-center gap-1 text-[10px] text-monokai-yellow hover:underline font-bold cursor-pointer transition-colors"
                    title="将当前编辑器内容沉淀为 AI 能力"
                  >
                    <Plus size={10} />
                    <span>沉淀能力</span>
                  </button>
                  <span className="font-mono text-monokai-amethyst text-[10px] font-bold bg-monokai-amethyst/10 px-1.5 py-0.5 rounded border border-monokai-border">({registeredCapabilities.length})</span>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-monokai-comment pointer-events-none" />
                <input
                  type="text"
                  placeholder="搜索 AI 能力名称/用途/标签..."
                  value={aiSearchTerm}
                  onChange={(e) => setAiSearchTerm(e.target.value)}
                  className="w-full bg-monokai-bg rounded-md pl-7 pr-7 py-1 text-xs text-monokai-fg placeholder-monokai-comment/60 outline-none focus:ring-1 focus:ring-monokai-accent/30 font-sans"
                />
                {aiSearchTerm && (
                  <button
                    onClick={() => setAiSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-monokai-comment hover:text-monokai-fg cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between px-1 pt-0.5 text-[9px] text-monokai-comment font-bold">
                <span>能力分类 ({categorizedCapabilities.reduce((acc, g) => acc + g.items.length, 0)} 项)</span>
                <button
                  onClick={() => setAllAiExpanded(!allAiExpanded)}
                  className="text-monokai-amethyst hover:underline cursor-pointer flex items-center gap-0.5 font-mono text-[9px]"
                >
                  {allAiExpanded ? '折叠全部' : '展开全部'}
                </button>
              </div>

              {/* Categorized Accordion Groups */}
              <div className="flex flex-col gap-1">
                {categorizedCapabilities.length === 0 ? (
                  <div className="py-6 text-center text-xs text-monokai-comment font-sans">
                    未找到匹配「{aiSearchTerm}」的 AI 能力
                  </div>
                ) : (
                  categorizedCapabilities.map((catGroup) => {
                    const isExpanded = aiSearchTerm.trim() !== '' || allAiExpanded || expandedAiCategory === catGroup.groupKey;
                    return (
                      <div key={catGroup.groupKey} className="rounded-md overflow-hidden bg-monokai-bg/40">
                        {/* Category Accordion Header */}
                        <button
                          onClick={() => setExpandedAiCategory(expandedAiCategory === catGroup.groupKey ? null : catGroup.groupKey)}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-monokai-fg font-bold hover:bg-monokai-surface/60 transition-colors text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{catGroup.icon}</span>
                            <span>{catGroup.groupLabel}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-monokai-surface text-monokai-comment font-mono font-normal">
                              {catGroup.items.length}
                            </span>
                          </div>
                          <ChevronDown size={12} className={`text-monokai-comment transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Category Items */}
                        {isExpanded && (
                          <div className="p-1 border-t border-monokai-border/40 flex flex-col gap-0.5 bg-monokai-sidebar/50">
                            {catGroup.items.map((cap) => {
                              const isDisabled =
                                (cap.id === 'error_fix' && !activeTab.result?.error) ||
                                (cap.id === 'sql_optimize' && !activeTab.code.trim()) ||
                                (cap.id === 'sql_explain' && !activeTab.code.trim()) ||
                                (cap.id === 'result_insight' && (!activeTab.result || activeTab.result.rows.length === 0));

                              let statusBadge = '已就绪';
                              if (cap.id === 'error_fix' && !activeTab.result?.error) statusBadge = '需报错日志';
                              else if ((cap.id === 'sql_optimize' || cap.id === 'sql_explain') && !activeTab.code.trim()) statusBadge = '需 SQL 代码';
                              else if (cap.id === 'result_insight' && (!activeTab.result || activeTab.result.rows.length === 0)) statusBadge = '需结果集';

                              return (
                                <button
                                  key={cap.id}
                                  onClick={() => {
                                    if (onExecuteCapability) {
                                      onExecuteCapability(cap);
                                    }
                                    setActiveDropdown(null);
                                  }}
                                  disabled={isDisabled}
                                  className={`w-full flex items-start gap-2 text-left px-2 py-1.5 rounded transition-all cursor-pointer ${
                                    isDisabled
                                      ? 'opacity-40 cursor-not-allowed hover:bg-transparent'
                                      : 'hover:bg-monokai-amethyst/15'
                                  }`}
                                >
                                  <div className="p-1 rounded bg-monokai-bg shrink-0 mt-0.5">
                                    <Sparkles size={10} className={cap.isSystem ? 'text-monokai-amethyst' : 'text-monokai-yellow'} />
                                  </div>
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="font-bold text-xs text-monokai-fg truncate">{cap.name}</span>
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                                        statusBadge === '已就绪'
                                          ? 'bg-monokai-green/15 text-monokai-green'
                                          : 'bg-monokai-bg text-monokai-comment'
                                      }`}>
                                        {statusBadge}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-monokai-comment truncate font-normal leading-tight mt-0.5">
                                      {cap.purpose || cap.description}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Action: Sole Navigation Route to AI Capability Hub */}
              <div className="pt-1 border-t border-monokai-border/60">
                <button
                  onClick={() => { onOpenKnowledgeHub?.(); setActiveDropdown(null); }}
                  className="w-full flex items-center justify-between text-left px-2.5 py-1.5 text-xs text-monokai-fg hover:bg-monokai-amethyst/20 hover:text-monokai-amethyst rounded-lg transition-colors font-bold group cursor-pointer bg-monokai-amethyst/10 shadow-xs"
                >
                  <div className="flex items-center gap-2 font-sans">
                    <Cpu size={13} className="text-monokai-amethyst" />
                    <span>打开 AI 能力库 (Hub) 全量大厅</span>
                  </div>
                  <ChevronLeft size={10} className="rotate-180 text-monokai-comment group-hover:text-monokai-amethyst transition-transform" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dropdown 4: ⚙️ 更多与设置 (More & Settings) */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown('more')}
            className={`h-7.5 px-2.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] ${
              activeDropdown === 'more' 
                ? 'bg-monokai-blue text-monokai-bg shadow-xs' 
                : 'bg-monokai-surface hover:bg-monokai-surface/80 hover:text-monokai-blue text-monokai-fg'
            }`}
          >
            <Settings size={13} />
            更多设置
            <ChevronDown size={11} className={`transition-transform duration-200 ${activeDropdown === 'more' ? 'rotate-180' : ''}`} />
          </button>

          {activeDropdown === 'more' && (
            <div className="absolute top-full right-0 mt-1 bg-monokai-sidebar/95 backdrop-blur-xl border border-monokai-border rounded-xl shadow-2xl z-[120] min-w-[300px] max-h-[75vh] overflow-y-auto custom-scrollbar p-2 animate-in fade-in slide-in-from-top-1 duration-150 border-t-monokai-blue/80 flex flex-col gap-2">
              {/* Header & Items count */}
              <div className="px-2 py-1 text-[10px] text-monokai-comment uppercase font-bold tracking-wider flex items-center justify-between border-b border-monokai-border/60 pb-1.5">
                <span className="flex items-center gap-1.5 font-sans">
                  <Settings size={12} className="text-monokai-blue" />
                  <span>编辑器模式与主题设置</span>
                </span>
                <span className="font-mono text-monokai-blue text-[10px] font-bold">{EDITOR_THEMES.length + 4} 项配置</span>
              </div>

              {/* Group 1: Views & Modes */}
              <div className="border border-monokai-border/60 rounded-md overflow-hidden bg-monokai-bg/40 p-1.5 flex flex-col gap-1">
                <div className="px-1 text-[9px] font-bold text-monokai-comment uppercase tracking-wider flex items-center gap-1">
                  <span>👁️ 视图与工作模式</span>
                </div>
                <button
                  onClick={() => { onToggleZen(); setActiveDropdown(null); }}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors flex items-center justify-between font-medium cursor-pointer ${
                    isZenMode 
                      ? 'bg-monokai-pink/15 text-monokai-pink font-bold' 
                      : 'text-monokai-fg hover:bg-monokai-pink/10 hover:text-monokai-pink'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isZenMode ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                    <span>极简禅模式</span>
                  </div>
                  {isZenMode && <span className="text-[8px] bg-monokai-pink/20 text-monokai-pink px-1.5 py-0.5 rounded font-mono">开启中</span>}
                </button>

                <button
                  onClick={() => { onToggleLivePreview(); setActiveDropdown(null); }}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors flex items-center justify-between font-medium cursor-pointer ${
                    showLivePreview 
                      ? 'bg-monokai-amethyst/15 text-monokai-amethyst font-bold' 
                      : 'text-monokai-fg hover:bg-monokai-amethyst/10 hover:text-monokai-amethyst'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {showLivePreview ? <Eye size={11} /> : <EyeOff size={11} />}
                    <span>格式化预览</span>
                  </div>
                  {showLivePreview ? (
                    <span className="text-[8px] bg-monokai-amethyst/20 text-monokai-amethyst px-1.5 py-0.5 rounded font-mono">已开启</span>
                  ) : (
                    <span className="text-[8px] text-monokai-comment/60">已关闭</span>
                  )}
                </button>

                <button
                  onClick={() => { setShowShortcuts(true); setActiveDropdown(null); }}
                  className="w-full text-left px-2 py-1.5 text-xs text-monokai-fg hover:bg-monokai-blue/15 hover:text-monokai-blue rounded transition-colors flex items-center gap-2 font-medium cursor-pointer"
                >
                  <Keyboard size={11} className="text-monokai-blue" />
                  <span>快捷键指南</span>
                </button>
              </div>

              {/* Group 2: Themes */}
              <div className="border border-monokai-border/60 rounded-md overflow-hidden bg-monokai-bg/40 p-1.5 flex flex-col gap-1">
                <div className="px-1 text-[9px] font-bold text-monokai-comment uppercase tracking-wider flex items-center gap-1">
                  <span>🎨 语法高亮主题</span>
                </div>
                {EDITOR_THEMES.map(theme => (
                  <button
                    key={theme.id}
                    onClick={() => { setEditorTheme(theme.id); }}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors flex items-center gap-2 cursor-pointer font-medium ${
                      editorTheme === theme.id
                        ? 'bg-monokai-surface text-monokai-blue font-bold'
                        : 'text-monokai-fg hover:bg-monokai-surface/60 hover:text-monokai-blue'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: theme.preview.keyword }} />
                      <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: theme.preview.fn }} />
                      <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: theme.preview.string }} />
                    </span>
                    <span>{theme.label}</span>
                    {editorTheme === theme.id && <span className="text-[8px] bg-monokai-blue/20 text-monokai-blue px-1.5 py-0.5 rounded font-mono ml-auto">✓</span>}
                  </button>
                ))}
              </div>

              {/* Danger Action */}
              <div className="border border-monokai-border rounded-md overflow-hidden bg-monokai-pink/5 p-1.5">
                <button
                  onClick={() => { onClear(); setActiveDropdown(null); }}
                  className="w-full text-left px-2 py-1.5 text-xs text-monokai-pink hover:bg-monokai-pink/20 rounded transition-colors flex items-center justify-between font-bold cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Trash2 size={11} />
                    <span>清空编辑器内容</span>
                  </div>
                  <span className="text-[8px] bg-monokai-pink/20 text-monokai-pink px-1.5 py-0.5 rounded font-mono font-normal">Ctrl+L</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* PARAMETER STRIP: Auto-appears when query has :param or ${param} */}
      {/* ──────────────────────────────────────────────────────────── */}
      {parsedParams.length > 0 && (
        <div className="bg-monokai-surface/95 border-t border-monokai-border px-3.5 py-1.5 flex items-center gap-2 overflow-x-auto custom-scrollbar text-xs animate-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-1.5 text-monokai-accent font-bold text-[10.5px] font-mono shrink-0">
            <Variable size={12} className="text-monokai-accent" />
            <span>动态参数 ({parsedParams.length}):</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {parsedParams.map((paramName) => (
              <div key={paramName} className="flex items-center bg-monokai-bg border border-monokai-border/80 rounded-md px-2 py-0.5 focus-within:border-monokai-accent transition-colors">
                <span className="text-[10.5px] font-mono text-monokai-accent shrink-0 mr-1.5">:{paramName} =</span>
                <input
                  type="text"
                  placeholder="填写参数值..."
                  value={paramValues[paramName] || ''}
                  onChange={(e) => setParamValues(prev => ({ ...prev, [paramName]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleExecuteWithParams();
                    }
                  }}
                  className="bg-transparent border-none outline-none text-xs text-monokai-fg font-mono w-24 focus:w-36 transition-all placeholder:text-monokai-comment/40"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleExecuteWithParams}
            className="ml-auto px-2.5 py-0.5 bg-monokai-green/15 hover:bg-monokai-green text-monokai-green hover:text-monokai-bg rounded-md text-[10.5px] font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1 active:scale-95 shadow-xs"
            title="使用当前参数执行查询 (Enter)"
          >
            <Play size={10} fill="currentColor" />
            <span>带参执行</span>
          </button>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* DIALOG: SHORTCUTS HELP MODAL */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showShortcuts && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-monokai-sidebar border border-monokai-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden text-monokai-fg">
            <div className="flex items-center justify-between px-5 py-4 bg-monokai-bg/90 border-b border-monokai-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-monokai-blue/15 border border-monokai-border flex items-center justify-center text-monokai-blue">
                  <Keyboard size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-monokai-fg">SQL 编辑器快捷键指南</h3>
                  <p className="text-[10px] text-monokai-comment">键盘高效操作指令与全局快捷键</p>
                </div>
              </div>
              <button 
                onClick={() => setShowShortcuts(false)}
                className="w-7 h-7 rounded-lg hover:bg-monokai-surface flex items-center justify-center text-monokai-comment hover:text-monokai-pink transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-2.5 font-mono text-xs">
              <div className="flex justify-between items-center p-2 rounded-lg bg-monokai-surface/40 border border-monokai-border/40">
                <span className="text-monokai-fg font-sans font-medium">运行 SQL 查询 / 选中代码</span>
                <span className="bg-monokai-bg px-2 py-1 rounded text-[10.5px] text-monokai-green font-bold border border-monokai-border shadow-xs">Ctrl + Enter</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-monokai-surface/40 border border-monokai-border/40">
                <span className="text-monokai-fg font-sans font-medium">智能格式化 SQL</span>
                <span className="bg-monokai-bg px-2 py-1 rounded text-[10.5px] text-monokai-yellow font-bold border border-monokai-border shadow-xs">Ctrl + Shift + F</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-monokai-surface/40 border border-monokai-border/40">
                <span className="text-monokai-fg font-sans font-medium">保存当前查询为书签</span>
                <span className="bg-monokai-bg px-2 py-1 rounded text-[10.5px] text-monokai-orange font-bold border border-monokai-border shadow-xs">Ctrl + S</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-monokai-surface/40 border border-monokai-border/40">
                <span className="text-monokai-fg font-sans font-medium">清空编辑器内容</span>
                <span className="bg-monokai-bg px-2 py-1 rounded text-[10.5px] text-monokai-pink font-bold border border-monokai-border shadow-xs">Ctrl + L</span>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-monokai-bg/90 border-t border-monokai-border flex justify-end">
              <button 
                onClick={() => setShowShortcuts(false)}
                className="px-4 py-1.5 bg-monokai-blue text-monokai-bg font-bold rounded-lg text-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-xs"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save to Analysis Hub Template Modal */}
      <SaveTemplateModal
        isOpen={showSaveTemplateModal}
        onClose={() => setShowSaveTemplateModal(false)}
        defaultSql={activeTab.code}
        defaultTitle={activeTab.title !== 'Untitled Query' ? activeTab.title : '常用 SQL 模板'}
      />

      {/* Save to AI Capability Library Modal */}
      <SaveCapabilityModal
        isOpen={showSaveCapabilityModal}
        onClose={() => setShowSaveCapabilityModal(false)}
        defaultPrompt={aiPrompt || activeTab.code}
        defaultName={activeTab.title !== 'Untitled Query' ? activeTab.title : '自定义 AI 分析能力'}
      />
    </div>
  );
};
