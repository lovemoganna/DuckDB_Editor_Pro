import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, Play, Code, Copy, Terminal, Layers, Grid, Table, Database, Plus, Edit3,
  Trash2, Download, RefreshCw, Save, X, Star, ArrowLeft, ArrowRight, Sliders,
  CheckCircle2, Sparkles, Folder, FileText, ChevronRight, BookOpen, Settings,
  ChevronDown, ChevronUp, BarChart2, Filter, RotateCcw
} from 'lucide-react';
import { AH } from '../AnalysisHub/analysisUi';
import {
  QUICK_SQL_TEMPLATES,
  QUICK_TEMPLATE_CATEGORIES,
  DuckDbQuickTemplate,
  TemplateCategoryKey
} from '../../data/duckdbTemplatesData';
import {
  getStoredSqlTemplates,
  saveCustomSqlTemplate,
  deleteCustomSqlTemplate,
  resetDefaultSqlTemplates,
  exportSqlTemplatesJson
} from '../../services/sqlTemplatesStorage';
import { useSqlEditorStore } from '../../hooks/store/useSqlEditorStore';
import { useAppStore } from '../../hooks/store/useAppStore';
import { Tab } from '../../types';
import { toastService } from '../../services/toastService';

const cleanUiLabel = (label: string) => label.replace(/^[^\p{L}\p{N}]+/u, '');

interface VisualSqlDashboardProps {
  onInsertSql?: (sql: string, executeDirectly?: boolean) => void;
  /** Hub-selected table — preferred over tables[0] for template binding */
  currentTable?: string;
  /** Hub schema column names for {column_name} binding */
  columnNames?: string[];
  /** Optional SQL seed when landing from an external jump */
  initialSql?: string;
}

export const VisualSqlDashboard: React.FC<VisualSqlDashboardProps> = ({
  onInsertSql,
  currentTable: hubTable,
  columnNames: hubColumns = [],
  initialSql,
}) => {
  const [allTemplates, setAllTemplates] = useState<DuckDbQuickTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // First screen card display limit (首屏控量, 默认 8 项)
  const [displayLimit, setDisplayLimit] = useState<number>(8);

  // Secondary info accordion (次要信息默认折叠)
  const [showStatsAccordion, setShowStatsAccordion] = useState<boolean>(false);

  // Tier 2 State: Selected template for Tier 2 Dedicated Content Workspace
  const [activeDetailTemplate, setActiveDetailTemplate] = useState<DuckDbQuickTemplate | null>(null);

  // Sub-tab state for complex queries in Tier 2
  const [complexDetailTab, setComplexDetailTab] = useState<'code' | 'params' | 'docs'>('code');

  // Edit / Create Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<DuckDbQuickTemplate>>({});

  const reloadTemplates = () => {
    const list = getStoredSqlTemplates();
    setAllTemplates(list);
  };

  useEffect(() => {
    reloadTemplates();
  }, []);

  // Zustand tables and schema tree state
  const tables = useAppStore(s => s.tables);
  const activeTabId = useSqlEditorStore(s => s.activeTabId);
  const tabs = useSqlEditorStore(s => s.tabs);
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);

  const defaultTable = hubTable || tables[0] || '';
  const activeColumns =
    hubColumns.length > 0 ? hubColumns : activeTab?.result?.columns || [];

  const [overrideTable, setOverrideTable] = useState(defaultTable);
  const [overrideCol, setOverrideCol] = useState(activeColumns[0] || '');
  const [customParamValues, setCustomParamValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (hubTable) {
      setOverrideTable(hubTable);
      return;
    }
    if (tables.length > 0 && !overrideTable) {
      setOverrideTable(tables[0]);
    }
  }, [hubTable, tables, overrideTable]);

  useEffect(() => {
    if (activeColumns.length > 0 && (!overrideCol || !activeColumns.includes(overrideCol))) {
      setOverrideCol(activeColumns[0]);
    }
  }, [activeColumns, overrideCol]);

  // Surface external SQL seed (e.g. jump from another module) without forcing a template pick
  const [seedSqlNotice, setSeedSqlNotice] = useState<string | null>(null);
  useEffect(() => {
    if (initialSql && initialSql.trim()) {
      setSeedSqlNotice(initialSql.trim());
    }
  }, [initialSql]);

  const filteredTemplates = useMemo(() => {
    return allTemplates.filter((tpl) => {
      let matchesCat = false;
      if (selectedCategory === 'all') {
        matchesCat = true;
      } else if (selectedCategory === 'custom_only') {
        matchesCat = tpl.isSystem === false;
      } else {
        matchesCat = tpl.category === selectedCategory;
      }

      const matchesSearch =
        tpl.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tpl.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tpl.sqlExample.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tpl.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [allTemplates, selectedCategory, searchTerm]);

  // Detected parameters for active detail template (Tier 2)
  const detectedParams = useMemo(() => {
    if (!activeDetailTemplate) return [];
    const matches = activeDetailTemplate.sqlExample.match(/\{[a-zA-Z0-9_]+\}/g);
    return matches ? Array.from(new Set(matches)) : [];
  }, [activeDetailTemplate]);

  // Live substituted SQL for active detail template (Tier 2)
  const liveRenderedSql = useMemo(() => {
    if (!activeDetailTemplate) return '';
    let sql = activeDetailTemplate.sqlExample
      .replace(/\{table_name\}/g, overrideTable || '{table_name}')
      .replace(/\{column_name\}/g, overrideCol || '{column_name}');

    Object.entries(customParamValues).forEach(([paramTag, val]) => {
      if (val && paramTag !== '{table_name}' && paramTag !== '{column_name}') {
        sql = sql.split(paramTag).join(val);
      }
    });

    return sql;
  }, [activeDetailTemplate, overrideTable, overrideCol, customParamValues]);

  // Query Complexity Classifier for Dynamic Layout
  const templateComplexity = useMemo(() => {
    if (!activeDetailTemplate) return 'simple';
    const sqlLines = activeDetailTemplate.sqlExample.trim().split('\n').length;
    const paramCount = detectedParams.length;
    
    if (sqlLines <= 3 && paramCount <= 2) {
      return 'simple'; // 简单 SQL ➔ 紧凑单栏 Focus 卡片
    } else if (sqlLines >= 6 || activeDetailTemplate.category === 'join' || activeDetailTemplate.category === 'set_operations') {
      return 'complex'; // 复杂 SQL ➔ 分区分页 Tabbed 工作台
    }
    return 'medium'; // 适中 SQL ➔ 自然双栏
  }, [activeDetailTemplate, detectedParams]);

  const handleApplyTemplateToEditor = (sqlToInsert: string, executeDirectly = false) => {
    if (onInsertSql) {
      onInsertSql(sqlToInsert, executeDirectly);
    } else {
      useSqlEditorStore.getState().updateActiveTab({ code: sqlToInsert });
      useAppStore.getState().setActiveTab(Tab.SQL);
    }
    toastService.success(executeDirectly ? '模板 SQL 已带入并准备执行！' : '模板 SQL 已成功带入编辑器！');
  };

  const [isCopied, setIsCopied] = useState(false);

  const handleCopySql = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setIsCopied(true);
    toastService.success('已成功复制 SQL 代码到剪贴板！');
    setTimeout(() => setIsCopied(false), 1500);
  };

  // CRUD Handlers for Custom Templates
  const handleOpenCreateModal = () => {
    setEditingTemplate({
      id: `custom_tpl_${Date.now().toString(36)}`,
      title: '',
      category: 'basic_query',
      categoryLabel: '🔍 基础查询',
      purpose: '指定该自定义模板要解决的核心问题...',
      keyParameters: ['{table_name}', '{column_name}'],
      sqlExample: `SELECT *\nFROM "{table_name}"\nWHERE "{column_name}" IS NOT NULL\nLIMIT 50;`,
      tags: ['自定义', '模板'],
      isSystem: false,
    });
    setShowEditModal(true);
  };

  const handleOpenEditModal = (tpl: DuckDbQuickTemplate) => {
    setEditingTemplate({ ...tpl });
    setShowEditModal(true);
  };

  const handleCloneTemplate = (tpl: DuckDbQuickTemplate) => {
    const cloned: DuckDbQuickTemplate = {
      ...tpl,
      id: `custom_tpl_${Date.now().toString(36)}`,
      title: `${tpl.title} (副本)`,
      isSystem: false,
      createdAt: Date.now(),
    };
    saveCustomSqlTemplate(cloned);
    reloadTemplates();
    setActiveDetailTemplate(cloned);
    toastService.success(`已复制创建自定义模板「${cloned.title}」`);
  };

  const handleSaveCustomTemplate = () => {
    if (!editingTemplate.title || !editingTemplate.sqlExample) {
      toastService.warning('请填写模板名称与 SQL 代码示例！');
      return;
    }

    const catMeta = QUICK_TEMPLATE_CATEGORIES.find(c => c.key === editingTemplate.category);

    const fullTemplate: DuckDbQuickTemplate = {
      id: editingTemplate.id || `custom_tpl_${Date.now().toString(36)}`,
      title: editingTemplate.title,
      category: (editingTemplate.category as TemplateCategoryKey) || 'basic_query',
      categoryLabel: catMeta?.label || '🔍 基础查询',
      purpose: editingTemplate.purpose || '解决特定的数据分析/SQL 查询场景',
      keyParameters: editingTemplate.keyParameters || ['{table_name}'],
      sqlExample: editingTemplate.sqlExample,
      tags: editingTemplate.tags || ['自定义'],
      isSystem: false,
      createdAt: editingTemplate.createdAt || Date.now(),
    };

    saveCustomSqlTemplate(fullTemplate);
    reloadTemplates();
    setActiveDetailTemplate(fullTemplate);
    setShowEditModal(false);
    toastService.success(`自定义 SQL 模板「${fullTemplate.title}」已保存！`);
  };

  const handleDeleteCustomTemplate = (id: string) => {
    if (confirm('确定要删除此自定义 SQL 模板吗？')) {
      deleteCustomSqlTemplate(id);
      reloadTemplates();
      if (activeDetailTemplate?.id === id) {
        setActiveDetailTemplate(null);
      }
      toastService.info('已删除该自定义 SQL 模板');
    }
  };

  const handleResetDefaults = () => {
    if (confirm('确定要重置并恢复系统预设 SQL 模板吗？')) {
      resetDefaultSqlTemplates();
      reloadTemplates();
      setActiveDetailTemplate(null);
      toastService.success('已恢复系统预设模板');
    }
  };

  const customCount = allTemplates.filter(t => t.isSystem === false).length;

  // Split categories: top 4 featured + rest in dropdown
  const featuredCategories = QUICK_TEMPLATE_CATEGORIES.slice(0, 3);
  const remainingCategories = QUICK_TEMPLATE_CATEGORIES.slice(3);

  // =========================================================================
  // TIER 2: 内容深入 — 布局跟着内容走 (Adaptive Detail Workspace)
  // =========================================================================
  if (activeDetailTemplate) {
    return (
      <div className={`${AH.pane} ${AH.scrollBody} flex flex-col gap-2.5`}>
        {/* Tier 2 Header Navigation / Breadcrumbs */}
        <div className={`${AH.card} p-2.5 flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-3">
        <button
        onClick={() => setActiveDetailTemplate(null)}
        className="px-3.5 py-2 bg-monokai-orange/15 hover:bg-monokai-orange/20 text-monokai-orange font-semibold text-xs rounded-md transition-all flex items-center gap-2 cursor-pointer border border-monokai-border shadow-xs"
        >
        <ArrowLeft size={16} />
        <span>返回模板看板</span>
        </button>

        <div className="h-4 w-px bg-monokai-accent/30 hidden sm:block" />

        <div className="flex items-center gap-2 text-xs font-mono">
        <span className="text-monokai-comment">Analysis Hub</span>
        <ChevronRight size={13} className="text-monokai-comment" />
        <span className="text-monokai-comment">{cleanUiLabel(activeDetailTemplate.categoryLabel)}</span>
        <ChevronRight size={13} className="text-monokai-comment" />
        <span className="text-monokai-fg font-semibold">{activeDetailTemplate.title}</span>
        
        {/* Complexity Badge */}
        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ml-2 ${
        templateComplexity === 'simple' ? 'bg-monokai-green/20 text-monokai-green border border-monokai-green/30' :
        templateComplexity === 'complex' ? 'bg-monokai-pink/20 text-monokai-pink border border-monokai-pink/30' :
        'bg-monokai-yellow/20 text-monokai-yellow border border-monokai-yellow/30'
        }`}>
        {templateComplexity === 'simple' ? '简单场景 (单栏紧凑)' :
        templateComplexity === 'complex' ? '复杂场景 (分区工作台)' :
        '适中场景 (自适应双栏)'}
        </span>
        </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
        <button
        onClick={() => handleCloneTemplate(activeDetailTemplate)}
        className="px-3 py-1.5 text-xs bg-monokai-surface hover:bg-monokai-accent/30 text-monokai-comment hover:text-monokai-fg rounded-md transition-colors flex items-center gap-1.5 cursor-pointer border border-monokai-border"
        >
        <Copy size={13} />
        <span>克隆副本</span>
        </button>

        {activeDetailTemplate.isSystem === false && (
        <>
        <button
        onClick={() => handleOpenEditModal(activeDetailTemplate)}
        className="px-3 py-1.5 text-xs bg-monokai-surface hover:bg-monokai-yellow/20 text-monokai-yellow rounded-md transition-colors flex items-center gap-1.5 cursor-pointer border border-monokai-yellow/30"
        >
        <Edit3 size={13} />
        <span>编辑</span>
        </button>
        <button
        onClick={() => handleDeleteCustomTemplate(activeDetailTemplate.id)}
        className="px-3 py-1.5 text-xs bg-monokai-surface hover:bg-monokai-pink/20 text-monokai-pink rounded-md transition-colors flex items-center gap-1.5 cursor-pointer border border-monokai-pink/30"
        >
        <Trash2 size={13} />
        <span>删除</span>
        </button>
        </>
        )}
        </div>
        </div>

        {/* Dynamic Adaptive Layout based on Content Complexity */}
        {templateComplexity === 'simple' ? (
        // CASE A: 简单 SQL ➔ 紧凑单栏 Focus 卡片 (max-w-2xl 居中, 绝无浪费留白)
        <div className="max-w-2xl mx-auto w-full bg-monokai-surface border border-monokai-border rounded-md p-3.5 shadow-xs flex flex-col gap-5">
        <div className="bg-monokai-bg/80 p-4 rounded-md border border-monokai-border/60">
        <div className="text-[10px] font-bold text-monokai-yellow uppercase mb-1">解决什么问题:</div>
        <div className="text-[11px] text-monokai-fg/90 leading-relaxed">{activeDetailTemplate.purpose}</div>
        </div>

        <div className="bg-monokai-bg/80 p-4 rounded-md border border-monokai-border/60 flex flex-col gap-3">
        <div className="text-[10px] font-bold text-monokai-cyan uppercase flex items-center gap-1.5">
        <Sliders size={13} /> 变量参数绑定:
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
        <label className="text-[10px] text-monokai-comment block mb-1 font-mono">物理表 ({'{table_name}'}):</label>
        {tables.length > 0 ? (
        <select
        value={overrideTable}
        onChange={(e) => setOverrideTable(e.target.value)}
        className="w-full bg-monokai-surface border border-monokai-border rounded-md px-2 py-1 text-meta text-monokai-yellow font-mono outline-none cursor-pointer"
        >
        {tables.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        ) : (
        <input
        type="text"
        value={overrideTable}
        onChange={(e) => setOverrideTable(e.target.value)}
        className="w-full bg-monokai-surface border border-monokai-border rounded-md px-2 py-1 text-meta text-monokai-yellow font-mono outline-none"
        />
        )}
        </div>

        <div>
        <label className="text-[10px] text-monokai-comment block mb-1 font-mono">目标字段 ({'{column_name}'}):</label>
        {activeColumns.length > 0 ? (
        <select
        value={overrideCol}
        onChange={(e) => setOverrideCol(e.target.value)}
        className="w-full bg-monokai-surface border border-monokai-border rounded-md px-2 py-1 text-meta text-monokai-cyan font-mono outline-none cursor-pointer"
        >
        {activeColumns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        ) : (
        <input
        type="text"
        value={overrideCol}
        onChange={(e) => setOverrideCol(e.target.value)}
        className="w-full bg-monokai-surface border border-monokai-border rounded-md px-2 py-1 text-meta text-monokai-cyan font-mono outline-none"
        />
        )}
        </div>
        </div>
        </div>

        <div>
        <div className="flex items-center justify-between mb-1 text-[10px] font-bold text-monokai-comment uppercase font-mono">
        <span>LIVE SUBSTITUTED SQL:</span>
        <button
        onClick={() => {
        navigator.clipboard.writeText(liveRenderedSql);
        toastService.success('已复制 SQL 代码到剪贴板');
        }}
        className="text-monokai-comment hover:text-monokai-fg cursor-pointer flex items-center gap-1"
        >
        <Copy size={12} /> 复制代码
        </button>
        </div>
        <pre className="p-2.5 bg-monokai-bg border border-monokai-border rounded-md text-meta font-mono text-monokai-cyan whitespace-pre-wrap max-h-72 overflow-auto custom-scrollbar">
        {liveRenderedSql}
        </pre>
        </div>

        <div className="flex justify-end gap-3 pt-2">
        <button
        onClick={() => handleApplyTemplateToEditor(liveRenderedSql, false)}
        className="px-2 py-1 bg-monokai-bg border border-monokai-border hover:bg-monokai-elevated/50 text-monokai-fg font-semibold text-meta rounded-md transition-all flex items-center gap-1.5 cursor-pointer border border-monokai-border"
        >
        <Code size={14} /> 仅带入 SQL 编辑器
        </button>

        <button
        onClick={() => {
        handleApplyTemplateToEditor(liveRenderedSql, true);
        setActiveDetailTemplate(null);
        }}
        className="px-2.5 py-1 bg-monokai-orange text-monokai-bg font-semibold text-meta rounded-md hover:opacity-90 transition-all flex items-center gap-2 shadow-xs cursor-pointer"
        >
        <Play size={14} fill="currentColor" /> 带入并直接运行
        </button>
        </div>
        </div>
        ) : templateComplexity === 'complex' ? (
        // CASE B: 复杂 SQL ➔ 分区分页 Tabbed 工作台 (多表 JOIN/CTE 嵌套)
        <div className="flex flex-col gap-4 flex-1">
        <div className="flex items-center gap-2 bg-monokai-surface p-1.5 rounded-md border border-monokai-border w-fit">
        <button
        onClick={() => setComplexDetailTab('code')}
        className={`px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
        complexDetailTab === 'code' ? 'bg-monokai-orange text-monokai-bg shadow-xs' : 'text-monokai-comment hover:text-monokai-fg'
        }`}
        >
        <Terminal size={14} /> <span>SQL 代码工作台</span>
        </button>

        <button
        onClick={() => setComplexDetailTab('params')}
        className={`px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
        complexDetailTab === 'params' ? 'bg-monokai-orange text-monokai-bg shadow-xs' : 'text-monokai-comment hover:text-monokai-fg'
        }`}
        >
        <Settings size={14} /> <span>物理表与变量配置</span>
        </button>

        <button
        onClick={() => setComplexDetailTab('docs')}
        className={`px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
        complexDetailTab === 'docs' ? 'bg-monokai-orange text-monokai-bg shadow-xs' : 'text-monokai-comment hover:text-monokai-fg'
        }`}
        >
        <BookOpen size={14} /> <span>DuckDB 官方语法参考</span>
        </button>
        </div>

        {complexDetailTab === 'code' && (
        <div className="bg-monokai-surface p-3 rounded-md border border-monokai-border flex flex-col gap-2.5 shadow-xs flex-1">
        <div className="flex items-center justify-between border-b border-monokai-border/60 pb-3">
        <span className="text-xs font-semibold text-monokai-fg font-mono uppercase tracking-wider">LIVE SUBSTITUTED SQL (复杂高级查询)</span>
        <button
        onClick={() => {
        navigator.clipboard.writeText(liveRenderedSql);
        toastService.success('已复制 SQL 代码到剪贴板');
        }}
        className="px-3 py-1.5 bg-monokai-surface text-monokai-fg font-bold text-xs rounded-md flex items-center gap-1.5 cursor-pointer border border-monokai-border"
        >
        <Copy size={13} /> 复制代码
        </button>
        </div>

        <pre className="p-2.5 bg-monokai-bg border border-monokai-border rounded-md text-meta font-mono text-monokai-cyan whitespace-pre-wrap overflow-auto custom-scrollbar min-h-[240px]">
        {liveRenderedSql}
        </pre>

        <div className="flex justify-end gap-3 pt-2">
        <button
        onClick={() => handleApplyTemplateToEditor(liveRenderedSql, false)}
        className="px-2 py-1 bg-monokai-bg border border-monokai-border text-monokai-fg font-semibold text-meta rounded-md cursor-pointer border border-monokai-border"
        >
        <Code size={15} /> 仅带入 SQL 编辑器
        </button>
        <button
        onClick={() => {
        handleApplyTemplateToEditor(liveRenderedSql, true);
        setActiveDetailTemplate(null);
        }}
        className="px-2.5 py-1 bg-monokai-orange text-monokai-bg font-semibold text-meta rounded-md hover:opacity-90 shadow-xs cursor-pointer"
        >
        <Play size={15} fill="currentColor" /> 带入并直接运行
        </button>
        </div>
        </div>
        )}

        {complexDetailTab === 'params' && (
        <div className="bg-monokai-surface p-3 rounded-md border border-monokai-border flex flex-col gap-3 shadow-xs max-w-2xl">
        <h3 className="text-xs font-semibold text-monokai-cyan uppercase font-mono tracking-wider flex items-center gap-1.5">
        <Sliders size={16} /> 绑定物理表与检测到的变量参数
        </h3>
        <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
        <label className="text-[11px] text-monokai-comment font-bold block mb-1 font-mono">绑定物理表 ({'{table_name}'}):</label>
        {tables.length > 0 ? (
        <select
        value={overrideTable}
        onChange={(e) => setOverrideTable(e.target.value)}
        className="w-full bg-monokai-bg border border-monokai-border rounded-md px-2 py-1 text-meta text-monokai-yellow font-mono outline-none"
        >
        {tables.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        ) : (
        <input
        type="text"
        value={overrideTable}
        onChange={(e) => setOverrideTable(e.target.value)}
        className="w-full bg-monokai-bg border border-monokai-border rounded-md px-2 py-1 text-meta text-monokai-yellow font-mono outline-none"
        />
        )}
        </div>

        <div>
        <label className="text-[11px] text-monokai-comment font-bold block mb-1 font-mono">目标字段 ({'{column_name}'}):</label>
        {activeColumns.length > 0 ? (
        <select
        value={overrideCol}
        onChange={(e) => setOverrideCol(e.target.value)}
        className="w-full bg-monokai-bg border border-monokai-border rounded-md px-2 py-1 text-meta text-monokai-cyan font-mono outline-none"
        >
        {activeColumns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        ) : (
        <input
        type="text"
        value={overrideCol}
        onChange={(e) => setOverrideCol(e.target.value)}
        className="w-full bg-monokai-bg border border-monokai-border rounded-md px-2 py-1 text-meta text-monokai-cyan font-mono outline-none"
        />
        )}
        </div>
        </div>

        {detectedParams.filter(p => p !== '{table_name}' && p !== '{column_name}').length > 0 && (
        <div className="pt-3 border-t border-monokai-border/60 flex flex-col gap-3">
        <span className="text-[11px] text-monokai-comment font-bold">检测到的变量参数:</span>
        <div className="grid grid-cols-2 gap-3">
        {detectedParams.filter(p => p !== '{table_name}' && p !== '{column_name}').map(paramTag => (
        <div key={paramTag}>
        <label className="text-[10px] text-monokai-comment font-mono block mb-1">{paramTag}:</label>
        <input
        type="text"
        value={customParamValues[paramTag] || ''}
        onChange={(e) => setCustomParamValues({ ...customParamValues, [paramTag]: e.target.value })}
        placeholder={paramTag.replace(/[\{\}]/g, '')}
        className="w-full bg-monokai-bg border border-monokai-border rounded-md px-2 py-1 text-meta text-monokai-green font-mono outline-none"
        />
        </div>
        ))}
        </div>
        </div>
        )}
        </div>
        )}

        {complexDetailTab === 'docs' && (
        <div className="bg-monokai-surface p-3 rounded-md border border-monokai-border flex flex-col gap-2.5 shadow-xs max-w-2xl text-xs">
        <h3 className="text-xs font-semibold text-monokai-yellow uppercase tracking-wider">场景用途与规范说明</h3>
        <p className="text-monokai-fg/90 leading-relaxed">{activeDetailTemplate.purpose}</p>
        {activeDetailTemplate.notesRef && (
        <div className="p-3 bg-monokai-bg rounded-md border border-monokai-border font-mono text-[11px]">
        DuckDB 文档参考章节: <span className="text-monokai-cyan">{activeDetailTemplate.notesRef}</span>
        </div>
        )}
        </div>
        )}
        </div>
        ) : (
        // CASE C: 适中 SQL ➔ 自然双栏 (items-start 高度自适应包裹)
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="bg-monokai-surface p-3 rounded-md border border-monokai-border flex flex-col gap-2">
        <div className="text-[11px] font-semibold text-monokai-yellow uppercase tracking-wider">解决什么问题</div>
        <p className="text-[11px] text-monokai-fg/90 leading-relaxed">{activeDetailTemplate.purpose}</p>
        </div>

        <div className="bg-monokai-surface p-3 rounded-md border border-monokai-border flex flex-col gap-3">
        <div className="text-[11px] font-semibold text-monokai-cyan uppercase tracking-wider">物理表与变量绑定</div>
        <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
        <label className="text-[10px] text-monokai-comment font-mono block mb-1">物理表 ({'{table_name}'}):</label>
        {tables.length > 0 ? (
        <select
        value={overrideTable}
        onChange={(e) => setOverrideTable(e.target.value)}
        className="w-full border border-monokai-border rounded-md px-2 py-1 text-meta bg-monokai-bg text-monokai-yellow font-mono outline-none"
        >
        {tables.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        ) : (
        <input
        type="text"
        value={overrideTable}
        onChange={(e) => setOverrideTable(e.target.value)}
        className="w-full border border-monokai-border rounded-md px-2 py-1 text-meta bg-monokai-bg text-monokai-yellow font-mono outline-none"
        />
        )}
        </div>

        <div>
        <label className="text-[10px] text-monokai-comment font-mono block mb-1">目标字段 ({'{column_name}'}):</label>
        {activeColumns.length > 0 ? (
        <select
        value={overrideCol}
        onChange={(e) => setOverrideCol(e.target.value)}
        className="w-full border border-monokai-border rounded-md px-2 py-1 text-meta bg-monokai-bg text-monokai-cyan font-mono outline-none"
        >
        {activeColumns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        ) : (
        <input
        type="text"
        value={overrideCol}
        onChange={(e) => setOverrideCol(e.target.value)}
        className="w-full border border-monokai-border rounded-md px-2 py-1 text-meta bg-monokai-bg text-monokai-cyan font-mono outline-none"
        />
        )}
        </div>
        </div>
        </div>
        </div>

        <div className="lg:col-span-7 bg-monokai-surface p-3 rounded-md border border-monokai-border flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-monokai-border/60 pb-2.5">
        <span className="text-xs font-semibold text-monokai-fg font-mono uppercase">LIVE SUBSTITUTED SQL</span>
        <button
        onClick={() => handleCopySql(liveRenderedSql)}
        className={`px-3 py-1.5 font-bold text-xs rounded-md flex items-center gap-1.5 cursor-pointer transition-all border ${
        isCopied
        ? 'bg-monokai-green/20 text-monokai-green border-monokai-green/40'
        : 'bg-monokai-surface text-monokai-fg hover:bg-monokai-accent/30 border-monokai-border'
        }`}
        >
        {isCopied ? <CheckCircle2 size={13} className="text-monokai-green" /> : <Copy size={13} />}
        <span>{isCopied ? '已复制' : '复制代码'}</span>
        </button>
        </div>

        <pre className="p-2.5 bg-monokai-bg border border-monokai-border rounded-md text-meta font-mono text-monokai-cyan whitespace-pre-wrap max-h-72 overflow-auto custom-scrollbar">
        {liveRenderedSql}
        </pre>

        <div className="flex justify-end gap-3 pt-2">
        <button
        onClick={() => handleApplyTemplateToEditor(liveRenderedSql, false)}
        className="px-2 py-1 bg-monokai-bg border border-monokai-border text-monokai-fg font-semibold text-meta rounded-md cursor-pointer border border-monokai-border"
        >
        <Code size={15} /> 仅带入 SQL 编辑器
        </button>
        <button
        onClick={() => {
        handleApplyTemplateToEditor(liveRenderedSql, true);
        setActiveDetailTemplate(null);
        }}
        className="px-2.5 py-1 bg-monokai-orange text-monokai-bg font-semibold text-meta rounded-md hover:opacity-90 shadow-xs cursor-pointer"
        >
        <Play size={15} fill="currentColor" /> 带入并直接运行
        </button>
        </div>
        </div>
        </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // TIER 1: 第一层看板 — 极轻量主次分明 (Ultra-Lightweight Discovery Dashboard)
  // =========================================================================
  const displayedTemplates = filteredTemplates.slice(0, displayLimit);

  return (
    <div className={`${AH.pane} ${AH.scrollBody} flex flex-col gap-2.5 relative`}>
      {/* 1. Header Banner (轻量化 Header + 可折叠统计 Accordion) */}
      <div className={`${AH.card} p-2.5 flex flex-col gap-2`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-6 w-6 items-center justify-center bg-monokai-orange/20 text-monokai-orange rounded-md shrink-0">
        <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
        <h2 className={AH.sectionTitle}>SQL 模板</h2>
        <p className={AH.sectionDesc}>
        精选高频业务场景。先在看板快速寻找，挑选后再深入配置与带入执行。
        {overrideTable ? ` · 绑定表 ${overrideTable}` : ''}
        </p>
        </div>
        </div>

        {/* Quick Actions & Collapsible Toggle */}
        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
        <button
        onClick={() => setShowStatsAccordion(!showStatsAccordion)}
        className={AH.btnGhost}
        title="切换显示/折叠资产统计概览"
        >
        <BarChart2 size={13} />
        <span>资产统计 ({allTemplates.length})</span>
        {showStatsAccordion ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        <button
        onClick={exportSqlTemplatesJson}
        className="px-3 py-1.5 bg-monokai-surface hover:bg-monokai-accent/30 text-monokai-fg font-bold text-xs rounded-md transition-all flex items-center gap-1.5 cursor-pointer border border-monokai-border"
        title="导出全部模板 JSON"
        >
        <Download size={13} />
        <span>导出</span>
        </button>

        <button
        onClick={handleOpenCreateModal}
        className="px-3.5 py-1.5 bg-monokai-orange text-monokai-bg font-semibold text-xs rounded-md hover:opacity-90 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
        <Plus size={14} />
        <span>新建模板</span>
        </button>
        </div>
        </div>

        {/* Collapsible Secondary Info: Statistics Summary Accordion */}
        {showStatsAccordion && (
        <div className="pt-3 border-t border-monokai-border/60 grid grid-cols-2 md:grid-cols-4 gap-3 animate-in fade-in duration-150">
        <div className="bg-monokai-bg/60 p-3 rounded-md border border-monokai-border/60 flex items-center justify-between">
        <div>
        <div className="text-[10px] text-monokai-comment font-bold">SQL 模板总数</div>
        <div className="text-sm font-bold text-monokai-fg font-mono">{allTemplates.length} 项</div>
        </div>
        <Grid size={16} className="text-monokai-blue" />
        </div>

        <div className="bg-monokai-bg/60 p-3 rounded-md border border-monokai-border/60 flex items-center justify-between">
        <div>
        <div className="text-[10px] text-monokai-comment font-bold">高频业务分类</div>
        <div className="text-sm font-bold text-monokai-green font-mono">{QUICK_TEMPLATE_CATEGORIES.length} 个</div>
        </div>
        <Layers size={16} className="text-monokai-green" />
        </div>

        <div className="bg-monokai-bg/60 p-3 rounded-md border border-monokai-border/60 flex items-center justify-between">
        <div>
        <div className="text-[10px] text-monokai-comment font-bold">我的自定义模板</div>
        <div className="text-sm font-bold text-monokai-yellow font-mono">{customCount} 项</div>
        </div>
        <Star size={16} className="text-monokai-yellow" />
        </div>

        <div className="bg-monokai-bg/60 p-3 rounded-md border border-monokai-border/60 flex items-center justify-between">
        <div>
        <div className="text-[10px] text-monokai-comment font-bold">已加载物理表</div>
        <div className="text-sm font-bold text-monokai-pink font-mono">{tables.length} 张表</div>
        </div>
        <Database size={16} className="text-monokai-pink" />
        </div>
        </div>
        )}
      </div>

      {/* 2. Streamlined Single-Line Category Filter & Search Control Row */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
        {/* Streamlined Category Pills */}
        <div className={`${AH.segmentTrack} flex-wrap gap-1 p-1`}>
        <button
        type="button"
        onClick={() => setSelectedCategory('all')}
        className={selectedCategory === 'all' ? AH.chipActive : AH.chip}
        >
        全部 ({allTemplates.length})
        </button>

        <button
        type="button"
        onClick={() => setSelectedCategory('custom_only')}
        className={
          selectedCategory === 'custom_only'
            ? `${AH.chipActive} text-monokai-yellow border-monokai-yellow/40`
            : `${AH.chip} text-monokai-yellow`
        }
        >
        <Star size={11} aria-hidden="true" />
        <span>自定义 ({customCount})</span>
        </button>

        {/* Top 3 Featured Category Pills */}
        {featuredCategories.map((cat) => {
        const count = allTemplates.filter(t => t.category === cat.key).length;
        return (
        <button
        type="button"
        key={cat.key}
        onClick={() => setSelectedCategory(cat.key)}
        className={selectedCategory === cat.key ? AH.chipActive : AH.chip}
        >
        <span>{cleanUiLabel(cat.label)}</span>
        <span className="text-2xs font-mono opacity-80">({count})</span>
        </button>
        );
        })}

        {/* Remaining Categories Dropdown */}
        <div className="relative">
        <select
        value={remainingCategories.some(c => c.key === selectedCategory) ? selectedCategory : ''}
        onChange={(e) => {
        if (e.target.value) setSelectedCategory(e.target.value);
        }}
        className="bg-monokai-surface text-monokai-comment border border-monokai-border rounded-md px-2.5 py-1 text-xs font-bold outline-none cursor-pointer hover:text-monokai-fg"
        >
        <option value="" disabled>更多分类 ({remainingCategories.length}) ▼</option>
        {remainingCategories.map(c => {
        const count = allTemplates.filter(t => t.category === c.key).length;
        return (
        <option key={c.key} value={c.key}>{cleanUiLabel(c.label)} ({count})</option>
        );
        })}
        </select>
        </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full lg:w-72 shrink-0">
        <Search size={14} className="absolute left-3 top-2.5 text-monokai-comment" />
        <input
        type="text"
        value={searchTerm}
        onChange={(e) => {
        setSearchTerm(e.target.value);
        setDisplayLimit(8); // Reset limit on search
        }}
        placeholder="搜索场景名称或用途..."
        className={`w-full pl-8 ${AH.input}`}
        />
        </div>
      </div>

      {seedSqlNotice && (
        <div className={`${AH.card} p-2.5 flex flex-col gap-1.5`}>
          <div className="flex items-center justify-between gap-2">
            <span className={AH.label}>外部带入的 SQL 草稿</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={AH.btnGhost}
                onClick={() => {
                  handleApplyTemplateToEditor(seedSqlNotice, false);
                }}
              >
                <Terminal size={12} aria-hidden="true" />
                打开编辑器
              </button>
              <button
                type="button"
                className={AH.iconBtn}
                onClick={() => setSeedSqlNotice(null)}
                title="关闭提示"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
          </div>
          <pre className={`${AH.codePanel} max-h-28`}>{seedSqlNotice}</pre>
        </div>
      )}

      {/* 3. Tier 1: Controlled Scenario Discovery Grid (首屏精选控量) */}
      {filteredTemplates.length === 0 ? (
        <div className={`${AH.card} p-6 text-center flex flex-col items-center justify-center gap-2.5`}>
        <div className="p-2.5 bg-monokai-bg text-monokai-comment rounded-md border border-monokai-border">
        <Search size={22} aria-hidden="true" />
        </div>
        <h3 className="text-meta font-semibold text-monokai-fg">未找到匹配的 SQL 常用模板</h3>
        <p className={`${AH.sectionDesc} max-w-sm`}>
        没有找到包含关键词「{searchTerm}」的模板。您可以尝试清除搜索框，或点击下方新建自定义模板。
        </p>
        <div className="flex items-center gap-2 mt-1">
        <button
        type="button"
        onClick={() => {
        setSearchTerm('');
        setSelectedCategory('all');
        }}
        className={AH.btnGhost}
        >
        <RotateCcw size={14} className="text-monokai-cyan" aria-hidden="true" />
        <span>重置所有筛选条件</span>
        </button>

        <button
        onClick={() => {
        setEditingTemplate({
        id: `custom_tpl_${Date.now().toString(36)}`,
        title: searchTerm ? `自定义: ${searchTerm}` : '新建 SQL 模板',
        category: 'basic_query',
        categoryLabel: '🔍 基础查询',
        purpose: '按需解决特定的 SQL 查询场景',
        keyParameters: ['{table_name}'],
        sqlExample: `SELECT *\nFROM "{table_name}"\nLIMIT 50;`,
        tags: ['自定义'],
        isSystem: false,
        });
        setShowEditModal(true);
        }}
        className="px-4 py-2 bg-monokai-orange text-monokai-bg font-semibold text-xs rounded-md hover:opacity-90 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
        <Plus size={14} />
        <span>基于搜索词新建自定义模板</span>
        </button>
        </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
        <div className="divide-y divide-monokai-border/40 border border-monokai-border bg-monokai-surface">
        {displayedTemplates.map((tpl) => (
        <div
        key={tpl.id}
        onClick={() => setActiveDetailTemplate(tpl)}
        className="grid cursor-pointer grid-cols-[minmax(180px,1fr)_minmax(220px,2fr)_auto] items-center gap-3 px-3 py-2 hover:bg-monokai-bg/40"
        >
        <div className="min-w-0">
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2">
        <div>
        <h3 className="text-xs font-semibold text-monokai-fg group-hover:text-monokai-accent transition-colors flex items-center gap-1.5">
        {tpl.title}
        {tpl.isSystem === false ? (
        <span className="text-[9px] bg-monokai-yellow/20 text-monokai-yellow px-1.5 py-0.5 rounded font-mono">
        自定义
        </span>
        ) : (
        <span className="text-[9px] bg-monokai-green/15 text-monokai-green px-1.5 py-0.5 rounded font-mono">
        预设
        </span>
        )}
        </h3>
        <span className="text-[10px] text-monokai-comment font-mono mt-0.5 block">
        {cleanUiLabel(tpl.categoryLabel)}
        </span>
        </div>
        </div>

        {/* 1 句话用途摘要 */}
        <div className="hidden">
        <div className="text-[9px] font-bold text-monokai-yellow uppercase mb-0.5">
        场景摘要:
        </div>
        <div className="text-monokai-fg/90 text-[11px] leading-relaxed line-clamp-2">
        {tpl.purpose}
        </div>
        </div>
        </div>

        {/* Card Footer Actions */}
        <div className="min-w-0 text-[11px] leading-relaxed text-monokai-comment line-clamp-2">
        {tpl.purpose}
        <div className="mt-1 flex gap-1">
        {tpl.tags.slice(0, 1).map(t => (
        <span key={t} className="text-[9px] text-monokai-comment bg-monokai-surface px-1.5 py-0.5 rounded font-mono">
        #{t}
        </span>
        ))}
        </div>
        </div>

        <button
        onClick={(e) => {
        e.stopPropagation();
        setActiveDetailTemplate(tpl);
        }}
        className="flex min-h-8 items-center gap-1 border border-monokai-border px-3 text-[11px] font-semibold text-monokai-orange hover:bg-monokai-orange/10"
        >
        <span>进入详细内容</span>
        <ArrowRight size={12} />
        </button>
        </div>
        ))}
        </div>

        {/* Load More / First Screen Display Limit Driver */}
        {filteredTemplates.length > 8 && (
        <div className="flex justify-center border-t border-monokai-border/60 pt-4">
        {displayLimit < filteredTemplates.length ? (
        <button
        onClick={() => setDisplayLimit(filteredTemplates.length)}
        className="px-5 py-2.5 bg-monokai-surface hover:bg-monokai-surface text-monokai-orange font-semibold text-xs rounded-md border border-monokai-border hover:border-monokai-orange transition-all flex items-center gap-2 cursor-pointer shadow-xs"
        >
        <ChevronDown size={15} />
        <span>展开更多场景 (已展示 {displayedTemplates.length} / {filteredTemplates.length} 项)</span>
        </button>
        ) : (
        <button
        onClick={() => setDisplayLimit(8)}
        className="px-5 py-2 bg-monokai-surface hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg font-bold text-xs rounded-md border border-monokai-border transition-all flex items-center gap-2 cursor-pointer"
        >
        <ChevronUp size={15} />
        <span>收起部分场景 (恢复精选 8 项首屏)</span>
        </button>
        )}
        </div>
        )}
        </div>
      )}

      {/* Create / Edit Custom Template Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <div className="bg-monokai-surface border border-monokai-border rounded-md shadow-xs max-w-xl w-full p-3.5 text-monokai-fg flex flex-col gap-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between border-b border-monokai-border pb-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
        <Sparkles size={18} className="text-monokai-orange" />
        {editingTemplate.createdAt ? '编辑自定义 SQL 模板' : '新建自定义 SQL 模板'}
        </h3>
        <button onClick={() => setShowEditModal(false)} className="text-monokai-comment hover:text-monokai-pink cursor-pointer">
        <X size={18} />
        </button>
        </div>

        <div className="flex flex-col gap-3.5 text-xs">
        <div className="grid grid-cols-2 gap-3">
        <div>
        <label className="block text-monokai-comment mb-1 font-bold">模板标题 (*):</label>
        <input
        type="text"
        value={editingTemplate.title || ''}
        onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
        placeholder="例如: 常用多表 FULL JOIN 比对"
        className="w-full bg-monokai-bg border border-monokai-border rounded-md px-2 py-1 text-meta text-monokai-fg outline-none focus:border-monokai-accent"
        />
        </div>

        <div>
        <label className="block text-monokai-comment mb-1 font-bold">模板分类 (*):</label>
        <select
        value={editingTemplate.category || 'basic_query'}
        onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value as any })}
        className="w-full bg-monokai-bg border border-monokai-border rounded-md px-2 py-1 text-meta text-monokai-fg outline-none focus:border-monokai-accent cursor-pointer"
        >
        {QUICK_TEMPLATE_CATEGORIES.map(c => (
        <option key={c.key} value={c.key}>{cleanUiLabel(c.label)}</option>
        ))}
        </select>
        </div>
        </div>

        <div>
        <label className="block text-monokai-comment mb-1 font-bold">解决什么问题 (用途):</label>
        <input
        type="text"
        value={editingTemplate.purpose || ''}
        onChange={(e) => setEditingTemplate({ ...editingTemplate, purpose: e.target.value })}
        placeholder="说明该 SQL 模板的核心作用..."
        className="w-full bg-monokai-bg border border-monokai-border rounded-md px-2 py-1 text-meta text-monokai-fg outline-none focus:border-monokai-accent"
        />
        </div>

        <div className="grid grid-cols-2 gap-3">
        <div>
        <label className="block text-monokai-comment mb-1 font-bold">可替换参数 (逗号分隔):</label>
        <input
        type="text"
        value={(editingTemplate.keyParameters || []).join(', ')}
        onChange={(e) => setEditingTemplate({ ...editingTemplate, keyParameters: e.target.value.split(',').map(p => p.trim()).filter(Boolean) })}
        placeholder="{table_name}, {column_name}"
        className="w-full bg-monokai-bg border border-monokai-border rounded-md px-2 py-1 text-meta text-monokai-fg outline-none focus:border-monokai-accent font-mono"
        />
        </div>

        <div>
        <label className="block text-monokai-comment mb-1 font-bold">标签 (逗号分隔):</label>
        <input
        type="text"
        value={(editingTemplate.tags || []).join(', ')}
        onChange={(e) => setEditingTemplate({ ...editingTemplate, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
        placeholder="自定义, JOIN, 分析"
        className="w-full bg-monokai-bg border border-monokai-border rounded-md px-2 py-1 text-meta text-monokai-fg outline-none focus:border-monokai-accent"
        />
        </div>
        </div>

        <div>
        <div className="flex items-center justify-between mb-1">
        <label className="block text-monokai-comment font-bold">
        SQL 代码示例 (可包含占位符 {'{table_name}'}, {'{column_name}'}):
        </label>
        <button
        type="button"
        onClick={() => {
        if (!editingTemplate.sqlExample) return;
        const matches = editingTemplate.sqlExample.match(/\{[a-zA-Z0-9_]+\}/g);
        if (matches) {
        const uniqueParams = Array.from(new Set(matches));
        setEditingTemplate({
        ...editingTemplate,
        keyParameters: uniqueParams
        });
        toastService.success(`已自动提取 ${uniqueParams.length} 个变量参数: ${uniqueParams.join(', ')}`);
        } else {
        toastService.info('未在 SQL 中匹配到 {param} 格式参数');
        }
        }}
        className="text-[10px] text-monokai-orange hover:underline cursor-pointer flex items-center gap-1 font-bold"
        >
        <Sparkles size={11} /> 从 SQL 自动提取变量参数
        </button>
        </div>
        <textarea
        rows={6}
        value={editingTemplate.sqlExample || ''}
        onChange={(e) => setEditingTemplate({ ...editingTemplate, sqlExample: e.target.value })}
        className="w-full bg-monokai-bg border border-monokai-border rounded-md p-3 text-xs font-mono text-monokai-fg outline-none focus:border-monokai-accent custom-scrollbar"
        />
        </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-monokai-border pt-3">
        <button
        onClick={() => setShowEditModal(false)}
        className="px-4 py-2 bg-monokai-surface text-monokai-comment hover:text-monokai-fg rounded-md text-xs font-bold cursor-pointer"
        >
        取消
        </button>
        <button
        onClick={handleSaveCustomTemplate}
        className="px-2.5 py-1 bg-monokai-orange text-monokai-bg font-semibold text-meta rounded-md hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
        <Save size={14} />
        <span>保存模板</span>
        </button>
        </div>
        </div>
        </div>
      )}
    </div>
  );
};

export default VisualSqlDashboard;
