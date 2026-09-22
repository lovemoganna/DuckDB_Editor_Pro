import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Box,
  BrainCircuit,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  DownloadCloud,
  Gauge,
  GraduationCap,
  History,
  Layers,
  LibraryBig,
  ListTree,
  Network,
  Plus,
  Plug,
  Search,
  ScrollText,
  Settings,
  Sparkles,
  Table2,
  Terminal,
  TerminalSquare,
  Trash2,
  UploadCloud,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Tab } from '../../types';
import { duckDBService, type DuckDBRuntimeInfo } from '../../services/duckdbService';
import { useConfirmDialog } from '../ui/ConfirmDialog';
import {
  WORKSPACE_FEATURES,
  type WorkspaceFeatureSection,
  type WorkspaceIconName,
} from '../../services/workspaceNavigation';
import { useAppStore } from '../../hooks/store/useAppStore';
import { toastService } from '../../services/toastService';

interface AppSidebarProps {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
  tables: string[];
  currentTable: string | null;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  handleTableSelect: (name: string) => void;
  handleCreateDemo: () => void;
  setShowCreateModal: (v: boolean) => void;
  setShowImportModal: (v: boolean) => void;
  setShowExportModal: (v: boolean) => void;
  setShowSettingsModal: (v: boolean) => void;
  runtimeInfo: DuckDBRuntimeInfo;
  refreshAudit?: () => void;
}

const SECTION_LABELS: Record<WorkspaceFeatureSection, string> = {
  database: '数据工程',
  analytics: '分析洞察',
  knowledge: '知识网络',
  capability: 'AI 认知',
};

const SECTION_DESCRIPTIONS: Record<WorkspaceFeatureSection, string> = {
  database: '管理数据、结构与查询',
  analytics: '指标、日志与扩展能力',
  knowledge: '沉淀分析方法与知识资产',
  capability: '组合 AI、本体与推演能力',
};

const ICONS: Record<WorkspaceIconName, LucideIcon> = {
  dashboard: Gauge,
  sql: TerminalSquare,
  data: Table2,
  schema: ListTree,
  metrics: BarChart3,
  logs: ScrollText,
  history: History,
  plugins: Plug,
  library: LibraryBig,
  analysis: Activity,
  learn: GraduationCap,
  ai: BrainCircuit,
  skills: Sparkles,
  ontology: Network,
  deduction: Box,
};

export const AppSidebar: React.FC<AppSidebarProps> = ({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  tables,
  currentTable,
  activeTab,
  setActiveTab,
  handleTableSelect,
  handleCreateDemo,
  setShowCreateModal,
  setShowImportModal,
  setShowExportModal,
  setShowSettingsModal,
  runtimeInfo,
  refreshAudit,
}) => {
  const { confirm } = useConfirmDialog();
  const [tableSearch, setTableSearch] = useState('');
  const [assetsExpanded, setAssetsExpanded] = useState(true);
  const [views, setViews] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const setPendingSql = useAppStore(state => state.setPendingSql);
  const activeFeature = WORKSPACE_FEATURES.find(feature => feature.tab === activeTab);
  const activeSection = activeFeature?.section ?? 'database';
  const sectionFeatures = WORKSPACE_FEATURES.filter(feature => feature.section === activeSection);

  useEffect(() => {
    let active = true;
    duckDBService.getViews().then(v => {
      if (active) setViews(new Set(v));
    }).catch(() => {});

    const handleSchemaChanged = () => {
      duckDBService.getViews().then(v => {
        if (active) setViews(new Set(v));
      }).catch(() => {});
    };

    window.addEventListener('duckdb-schema-changed', handleSchemaChanged);
    return () => {
      active = false;
      window.removeEventListener('duckdb-schema-changed', handleSchemaChanged);
    };
  }, [tables]);

  const filteredTables = useMemo(() => {
    if (!tableSearch.trim()) return tables;
    const query = tableSearch.toLowerCase().trim();
    return tables.filter(table => table.toLowerCase().includes(query));
  }, [tables, tableSearch]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isSidebarCollapsed || !assetsExpanded) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        const target = event.target as HTMLElement;
        if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [assetsExpanded, isSidebarCollapsed]);

  const navigate = (tab: Tab) => {
    if (tab === Tab.DATA && currentTable) {
      handleTableSelect(currentTable);
      return;
    }
    setActiveTab(tab);
    if (tab === Tab.AUDIT) refreshAudit?.();
  };

  const handleQuickQuery = (tableName: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setPendingSql(`SELECT * FROM ${tableName} LIMIT 100;`);
    setActiveTab(Tab.SQL);
    toastService.info(`已载入查询：SELECT * FROM ${tableName}`);
  };

  const handleCopyTableName = (tableName: string, event: React.MouseEvent) => {
    event.stopPropagation();
    void navigator.clipboard.writeText(tableName);
    toastService.success(`已复制名称：“${tableName}”`);
  };

  const handleClearAllTables = () => {
    window.dispatchEvent(new CustomEvent('open-clear-workspace-modal'));
  };

  const handleDeleteSingleTable = async (tableName: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const isView = views.has(tableName);
    const itemType = isView ? '视图' : '数据表';
    const ok = await confirm({
      title: `删除${itemType}`,
      message: `确定要删除${itemType} "${tableName}" 吗？此操作无法撤销。`,
      variant: 'danger',
    });
    if (!ok) return;
    try {
      if (isView) {
        await duckDBService.dropView(tableName);
      } else {
        await duckDBService.dropTable(tableName);
      }
      toastService.success(`${itemType} "${tableName}" 已删除`);
      if (refreshAudit) refreshAudit();
    } catch (e: any) {
      toastService.error(`删除${itemType}失败: ${e.message}`);
    }
  };

  return (
    <aside
      aria-label="上下文导航与数据资产"
      className={`app-sidebar flex shrink-0 flex-col overflow-hidden border-r border-monokai-border/80 bg-[#171c19] transition-[width] duration-200 select-none max-[1100px]:w-16 ${
        isSidebarCollapsed ? 'w-16' : 'w-[248px]'
      }`}
    >
      <div className={`flex h-16 shrink-0 items-center border-b border-monokai-border/80 ${isSidebarCollapsed ? 'justify-center px-2' : 'px-4'}`}>
        {isSidebarCollapsed ? (
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(false)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-monokai-comment hover:bg-monokai-surface hover:text-monokai-fg"
            aria-label="展开上下文导航"
            title="展开上下文导航"
          >
            <ChevronRight className="h-4.5 w-4.5" />
          </button>
        ) : (
          <div className="min-w-0 max-[1100px]:hidden">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-monokai-accent">{SECTION_LABELS[activeSection]}</p>
            <p className="mt-1 truncate text-xs text-monokai-comment">{SECTION_DESCRIPTIONS[activeSection]}</p>
          </div>
        )}
      </div>

      <nav aria-label={`${SECTION_LABELS[activeSection]}功能`} className={`shrink-0 border-b border-monokai-border/40 ${isSidebarCollapsed ? 'p-2' : 'p-3'}`}>
        <div className="space-y-1">
          {sectionFeatures.map(feature => {
            const Icon = ICONS[feature.icon];
            const active = feature.tab === activeTab;
            return (
              <button
                key={feature.tab}
                type="button"
                onClick={() => navigate(feature.tab)}
                aria-current={active ? 'page' : undefined}
                aria-label={feature.label}
                title={isSidebarCollapsed ? feature.label : undefined}
                className={`group relative flex h-10 w-full items-center rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70 max-[1100px]:justify-center max-[1100px]:px-0 ${
                  isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
                } ${
                  active
                    ? 'bg-monokai-accent/15 text-monokai-accent'
                    : 'text-monokai-comment hover:bg-monokai-surface hover:text-monokai-fg'
                }`}
              >
                {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-monokai-accent" aria-hidden="true" />}
                <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                {!isSidebarCollapsed && <span className="truncate text-[13px] font-medium max-[1100px]:hidden">{feature.label}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="flex-1 overflow-hidden">
        {!isSidebarCollapsed ? (
          <section className="flex h-full flex-col max-[1100px]:hidden" aria-label="数据库资产">
            <button
              type="button"
              onClick={() => setAssetsExpanded(value => !value)}
              className="flex h-11 w-full shrink-0 items-center justify-between px-4 text-left text-monokai-fg hover:bg-monokai-surface/50"
              aria-expanded={assetsExpanded}
            >
              <span className="flex items-center gap-2 text-xs font-semibold">
                <Database className="h-4 w-4 text-monokai-accent" />
                数据库资产
                <span className="rounded bg-monokai-surface px-1.5 py-0.5 font-mono text-[10px] text-monokai-comment">{tables.length}</span>
              </span>
              <ChevronDown className={`h-4 w-4 text-monokai-comment transition-transform ${assetsExpanded ? '' : '-rotate-90'}`} />
            </button>

            {assetsExpanded && (
              <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 pb-3">
                <div className="flex items-center gap-2 rounded-lg bg-monokai-bg/70 px-2.5 focus-within:ring-1 focus-within:ring-monokai-accent">
                  <Search className="h-4 w-4 shrink-0 text-monokai-comment" />
                  <input
                    ref={searchInputRef}
                    value={tableSearch}
                    onChange={event => setTableSearch(event.target.value)}
                    placeholder="搜索表或视图"
                    className="h-9 min-w-0 flex-1 border-0 bg-transparent px-0 text-xs text-monokai-fg outline-none placeholder:text-monokai-comment/60"
                  />
                  {tableSearch && (
                    <button type="button" onClick={() => setTableSearch('')} className="text-monokai-comment hover:text-monokai-fg" aria-label="清空搜索">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setShowCreateModal(true)} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-monokai-surface/80 text-xs text-monokai-comment hover:bg-monokai-accent/15 hover:text-monokai-accent transition-colors">
                    <Plus className="h-3.5 w-3.5" /> 新建
                  </button>
                  <button type="button" onClick={() => setShowImportModal(true)} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-monokai-surface/80 text-xs text-monokai-comment hover:bg-monokai-accent/15 hover:text-monokai-accent transition-colors">
                    <UploadCloud className="h-3.5 w-3.5" /> 导入
                  </button>
                  {tables.length > 0 && (
                    <button type="button" onClick={handleClearAllTables} className="flex h-8 w-8 items-center justify-center rounded-lg bg-monokai-surface/80 text-xs text-monokai-comment hover:bg-monokai-pink/15 hover:text-monokai-pink transition-colors" title="清空工作区资源 (数据表、视图、宏、文件)" aria-label="清空工作区资源">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-monokai-bg/45 p-1 custom-scrollbar">
                  {filteredTables.length > 0 ? (
                    <ul className="space-y-0.5">
                      {filteredTables.map(table => {
                        const selected = currentTable === table && activeTab !== Tab.DASHBOARD;
                        const isView = views.has(table);
                        return (
                          <li key={table}>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => handleTableSelect(table)}
                              onKeyDown={event => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  handleTableSelect(table);
                                }
                              }}
                              className={`group flex h-9 w-full items-center gap-2 rounded-md px-2 text-left font-mono text-xs transition-colors ${
                                selected
                                  ? 'bg-monokai-accent/15 text-monokai-accent'
                                  : 'text-monokai-fg/80 hover:bg-monokai-surface/70 hover:text-monokai-fg'
                              }`}
                              title={`查看${isView ? '视图' : '表'} ${table}`}
                            >
                              {isView ? (
                                <Layers className="h-3.5 w-3.5 shrink-0 text-monokai-yellow" />
                              ) : (
                                <Table2 className="h-3.5 w-3.5 shrink-0" />
                              )}
                              <span className="min-w-0 flex-1 truncate">{table}</span>
                              {isView && (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 bg-monokai-yellow/15 text-monokai-yellow rounded-xs shrink-0">
                                  VIEW
                                </span>
                              )}
                              <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                                <button type="button" onClick={event => handleCopyTableName(table, event)} className="flex items-center justify-center rounded p-1 text-monokai-comment hover:bg-monokai-bg hover:text-monokai-fg" title={isView ? `复制视图名` : `复制表名`} aria-label={`复制 ${table}`}>
                                  <Copy className="h-3 w-3" />
                                </button>
                                <button type="button" onClick={event => handleQuickQuery(table, event)} className="flex items-center justify-center rounded p-1 text-monokai-comment hover:bg-monokai-bg hover:text-monokai-accent" title="快速查询" aria-label={`快速查询 ${table}`}>
                                  <Terminal className="h-3 w-3" />
                                </button>
                                <button type="button" onClick={event => handleDeleteSingleTable(table, event)} className="flex items-center justify-center rounded p-1 text-monokai-comment hover:bg-monokai-bg hover:text-monokai-pink" title={isView ? `删除视图` : `删除数据表`} aria-label={`删除 ${table}`}>
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : tables.length > 0 ? (
                    <div className="flex h-24 flex-col items-center justify-center gap-2 text-xs text-monokai-comment">
                      <span>未找到匹配的数据表</span>
                      <button type="button" onClick={() => setTableSearch('')} className="text-monokai-accent">清空搜索</button>
                    </div>
                  ) : (
                    <div className="flex h-36 flex-col items-center justify-center gap-3 px-4 text-center">
                      <Database className="h-6 w-6 text-monokai-comment/50" />
                      <p className="text-xs text-monokai-comment">暂无数据资产</p>
                      <button type="button" onClick={handleCreateDemo} className="flex h-8 items-center gap-1.5 rounded-lg border border-monokai-accent/30 bg-monokai-accent/10 px-3 text-xs text-monokai-accent">
                        <Sparkles className="h-3.5 w-3.5" /> 加载示例数据
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        ) : (
          <div className="flex h-full flex-col items-center gap-2 py-3">
            <button type="button" onClick={() => setShowCreateModal(true)} className="flex h-10 w-10 items-center justify-center rounded-lg text-monokai-comment hover:bg-monokai-surface hover:text-monokai-accent" title="新建数据表" aria-label="新建数据表">
              <Plus className="h-4.5 w-4.5" />
            </button>
            <button type="button" onClick={() => setShowImportModal(true)} className="flex h-10 w-10 items-center justify-center rounded-lg text-monokai-comment hover:bg-monokai-surface hover:text-monokai-accent" title="导入数据" aria-label="导入数据">
              <UploadCloud className="h-4.5 w-4.5" />
            </button>
          </div>
        )}
      </div>

      <footer className={`shrink-0 border-t border-monokai-border/40 p-2 max-[1100px]:hidden ${isSidebarCollapsed ? 'space-y-1' : 'space-y-2'}`}>
        {!isSidebarCollapsed && (
          <div className="flex items-center justify-between rounded-lg bg-monokai-bg/60 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-mono text-[10px] text-monokai-comment">{runtimeInfo.version || 'DuckDB-WASM'}</p>
              <p className={`mt-0.5 text-[10px] font-medium ${runtimeInfo.persistent ? 'text-monokai-green' : 'text-monokai-orange'}`}>
                {runtimeInfo.persistent ? 'OPFS 持久化' : '内存临时模式'}
              </p>
            </div>
            <span className={`h-2 w-2 rounded-full ${runtimeInfo.ready ? 'bg-monokai-green' : 'bg-monokai-orange'}`} />
          </div>
        )}
        <div className={`flex ${isSidebarCollapsed ? 'flex-col' : 'items-center'} gap-1`}>
          <button type="button" onClick={() => setShowSettingsModal(true)} className={`flex h-9 items-center rounded-lg text-monokai-comment hover:bg-monokai-surface hover:text-monokai-fg ${isSidebarCollapsed ? 'w-full justify-center' : 'flex-1 gap-2 px-2.5 text-xs'}`} title="系统设置与备份" aria-label="系统设置与备份">
            <Settings className="h-4 w-4" /> {!isSidebarCollapsed && <span>系统设置</span>}
          </button>
          <button type="button" onClick={() => setShowExportModal(true)} className={`flex h-9 items-center rounded-lg text-monokai-comment hover:bg-monokai-surface hover:text-monokai-fg ${isSidebarCollapsed ? 'w-full justify-center' : 'w-9 justify-center'}`} title="导出备份" aria-label="导出备份">
            <DownloadCloud className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className={`flex h-9 items-center rounded-lg text-monokai-comment hover:bg-monokai-surface hover:text-monokai-fg ${isSidebarCollapsed ? 'w-full justify-center' : 'w-9 justify-center'}`} title={isSidebarCollapsed ? '展开侧栏' : '收起侧栏'} aria-label={isSidebarCollapsed ? '展开侧栏' : '收起侧栏'}>
            {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </footer>
    </aside>
  );
};
