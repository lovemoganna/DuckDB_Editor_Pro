import { useUiTheme } from '../../services/uiTheme';
import { APP_BUILD_ID } from '../../services/buildInfo';
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  Plus,
  Keyboard,
  Info,
  ExternalLink,
  Trash2,
  Sun,
  Moon,
} from 'lucide-react';
import {
  Database as DatabasePhosphor,
  ChartLine as ChartLinePhosphor,
  Lightbulb as LightbulbPhosphor,
  Brain as BrainPhosphor,
  Sparkle as SparklePhosphor,
  Folder as FolderPhosphor,
  House as HousePhosphor,
  Table as TablePhosphor,
  Columns as ColumnsPhosphor,
  Terminal as TerminalPhosphor,
  ChartBar as ChartBarPhosphor,
  ChartPie as ChartPiePhosphor,
  Compass as CompassPhosphor,
  ClockCounterClockwise as HistoryPhosphor,
  Scroll as ScrollTextPhosphor,
  Books as BooksPhosphor,
  BookOpen as BookOpenPhosphor,
  GraduationCap as GraduationCapPhosphor,
  ShareNetwork as ShareNetworkPhosphor,
  GitBranch as GitBranchPhosphor,
  MagnifyingGlass as MagnifyingGlassPhosphor,
  Gear as GearPhosphor,
  Question as QuestionPhosphor,
  CheckCircle as CheckCirclePhosphor,
  Plugs,
} from '@phosphor-icons/react';
import { Tab } from '../../types';
import { duckDBService, type DuckDBRuntimeInfo } from '../../services/duckdbService';
import { toastService } from '../../services/toastService';
import { useCopilotStore } from '../../hooks/store/useCopilotStore';
import { useAppStore } from '../../hooks/store/useAppStore';

// ============================================
// Domain chrome — Monokai accents only (values from index.css)
// ============================================
const DESIGN = {
  height: {
    tab: '2rem',
    domain: '2.25rem',
    bar: '3rem',
  },
  theme: {
    core: {
      color: 'var(--monokai-accent)',
      bg: 'color-mix(in srgb, var(--monokai-accent) 12%, transparent)',
      border: 'color-mix(in srgb, var(--monokai-accent) 30%, transparent)',
      glow: 'color-mix(in srgb, var(--monokai-accent) 40%, transparent)',
    },
    analytics: {
      color: 'var(--monokai-purple)',
      bg: 'color-mix(in srgb, var(--monokai-purple) 12%, transparent)',
      border: 'color-mix(in srgb, var(--monokai-purple) 30%, transparent)',
      glow: 'color-mix(in srgb, var(--monokai-purple) 40%, transparent)',
    },
    knowledge: {
      color: 'var(--monokai-yellow)',
      bg: 'color-mix(in srgb, var(--monokai-yellow) 12%, transparent)',
      border: 'color-mix(in srgb, var(--monokai-yellow) 30%, transparent)',
      glow: 'color-mix(in srgb, var(--monokai-yellow) 40%, transparent)',
    },
    ai: {
      color: 'var(--monokai-pink)',
      bg: 'color-mix(in srgb, var(--monokai-pink) 12%, transparent)',
      border: 'color-mix(in srgb, var(--monokai-pink) 30%, transparent)',
      glow: 'color-mix(in srgb, var(--monokai-pink) 40%, transparent)',
    },
  },
  chrome: {
    bg: 'color-mix(in srgb, var(--monokai-bg) 95%, transparent)',
    border: 'var(--monokai-border)',
    text: 'var(--monokai-fg-muted)',
    textMuted: 'var(--monokai-comment)',
  },
} as const;

// ============================================
// Type Definitions
// ============================================
export type AnalysisContextOption = {
  id: string;
  label: string;
  kind: 'schema' | 'database' | 'project';
  isCurrent: boolean;
};

export interface AppTopBarProps {
  activeTab: Tab;
  currentTable: string | null;
  tables: string[];
  setActiveTab: (tab: Tab) => void;
  handleTableSelect: (name: string) => void;
  handleCreateDemo: () => void;
  setShowCreateModal: (v: boolean) => void;
  setShowImportModal: (v: boolean) => void;
  setShowExportModal: (v: boolean) => void;
  setShowSettingsModal: (v: boolean) => void;
  fetchTableData: (tableName: string, offset: number, limit: number) => void;
  refreshAudit: () => void;
  runtimeInfo: DuckDBRuntimeInfo;
  activeDatabase?: string;
  analysisContexts?: AnalysisContextOption[];
  onSwitchAnalysisContext?: (target: { id: string; kind: AnalysisContextOption['kind'] }) => Promise<void> | void;
}

interface NavTabItem {
  tab: Tab;
  label: string;
  icon: React.ComponentType<{ className?: string; weight?: 'fill' | 'regular'; size?: number }>;
  shortcut?: string;
}

interface DomainCategory {
  id: 'core' | 'analytics' | 'knowledge' | 'ai';
  label: string;
  tag: string;
  icon: React.ComponentType<{ className?: string; weight?: 'fill' | 'regular'; size?: number; style?: React.CSSProperties }>;
  defaultTab: Tab;
  items: NavTabItem[];
}

// ============================================
// Domain Configuration - Clean & Semantic
// ============================================
const DOMAIN_CATEGORIES: DomainCategory[] = [
  {
    id: 'core',
    label: '工程核心',
    tag: 'CORE',
    icon: (props) => <DatabasePhosphor weight={props.weight || 'regular'} {...props} />,
    defaultTab: Tab.DASHBOARD,
    items: [
      { tab: Tab.DASHBOARD, label: '仪表盘', icon: HousePhosphor, shortcut: '1' },
      { tab: Tab.DATA, label: '数据', icon: TablePhosphor, shortcut: '2' },
      { tab: Tab.STRUCTURE, label: 'Schema', icon: ColumnsPhosphor, shortcut: '3' },
      { tab: Tab.SQL, label: 'SQL', icon: TerminalPhosphor, shortcut: '4' },
      { tab: Tab.DATAFLOW, label: '数据流', icon: GitBranchPhosphor, shortcut: '5' },
    ],
  },
  {
    id: 'analytics',
    label: '分析洞察',
    tag: 'ANALYTICS',
    icon: (props) => <ChartLinePhosphor weight={props.weight || 'regular'} {...props} />,
    defaultTab: Tab.METRICS,
    items: [
      { tab: Tab.METRICS, label: '指标', icon: ChartBarPhosphor },
      { tab: Tab.VISUALIZATION, label: '可视化', icon: ChartPiePhosphor },
      { tab: Tab.ANALYSIS_HUB, label: '分析', icon: CompassPhosphor },
      { tab: Tab.HISTORY, label: '历史', icon: HistoryPhosphor },
      { tab: Tab.AUDIT, label: '审计', icon: ScrollTextPhosphor },
    ],
  },
  {
    id: 'knowledge',
    label: '知识沉淀',
    tag: 'KNOWLEDGE',
    icon: (props) => <BooksPhosphor weight={props.weight || 'regular'} {...props} />,
    defaultTab: Tab.LIBRARY,
    items: [
      { tab: Tab.LIBRARY, label: '知识资产', icon: BookOpenPhosphor },
      { tab: Tab.EXTENSIONS, label: '插件', icon: Plugs },
      { tab: Tab.TUTORIALS, label: '知识联动', icon: GraduationCapPhosphor },
    ],
  },
  {
    id: 'ai',
    label: 'AI 认知',
    tag: 'AI',
    icon: (props) => <BrainPhosphor weight={props.weight || 'regular'} {...props} />,
    defaultTab: Tab.ONTOLOGY,
    items: [
      { tab: Tab.ONTOLOGY, label: '本体图谱', icon: ShareNetworkPhosphor },
      { tab: Tab.AI_SKILLS, label: '技能', icon: SparklePhosphor },
      { tab: Tab.AI_CAPABILITIES, label: '能力', icon: LightbulbPhosphor },
      { tab: Tab.COMPOSITIONAL_DEDUCTION, label: '推演', icon: GitBranchPhosphor },
    ],
  },
];

// ============================================
// Helper Hooks
// ============================================
function useOutsideClick(ref: React.RefObject<HTMLElement | null>, callback: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, callback]);
}

// ============================================
// Sub-Components
// ============================================

/**
 * Domain Button - Top level navigation
 */
const DomainButton: React.FC<{
  domain: DomainCategory;
  isActive: boolean;
  onClick: () => void;
}> = ({ domain, isActive, onClick }) => {
  const theme = DESIGN.theme[domain.id];
  const Icon = domain.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`
        relative flex items-center gap-1.5 h-9 px-3.5 rounded-lg
        font-medium text-[11px] tracking-wide
        transition-colors duration-200 ease-out
        cursor-pointer select-none shrink-0
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent
        ${isActive ? 'font-semibold' : ''}
      `}
      style={{
        color: isActive ? 'var(--monokai-fg)' : DESIGN.chrome.text,
        background: isActive ? theme.bg : 'transparent',
        border: `1px solid ${isActive ? theme.border : 'transparent'}`,
        boxShadow: 'none',
      }}
      title={domain.label}
    >
      {/* Active indicator bar */}
      {isActive && (
        <span
          className="absolute left-1 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
          style={{ background: theme.color }}
        />
      )}
      
      {/* Icon */}
      <span className="shrink-0 relative z-10" style={{ color: isActive ? theme.color : DESIGN.chrome.textMuted }}>
        <Icon size={16} weight={isActive ? 'fill' : 'regular'} />
      </span>

      {/* Label */}
      <span className="relative z-10">{domain.label}</span>
    </button>
  );
};

/**
 * Feature Tab Button - Second level navigation
 */
const FeatureTabButton: React.FC<{
  item: NavTabItem;
  isActive: boolean;
  themeColor: string;
  onClick: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}> = ({ item, isActive, themeColor, onClick, onKeyDown }) => {
  const Icon = item.icon;

  return (
    <button
      type="button"
      role="tab"
      aria-label={item.label}
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`
        relative flex items-center gap-1.5 h-8 px-2.5 rounded-md
        font-medium text-[11px]
        transition-all duration-150 ease-out
        cursor-pointer select-none shrink-0
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
        ${isActive ? 'font-semibold' : 'hover:font-medium'}
      `}
      style={{
        color: isActive ? 'var(--monokai-fg)' : DESIGN.chrome.textMuted,
        background: isActive ? `color-mix(in srgb, var(--monokai-fg) 6%, transparent)` : 'transparent',
        border: `1px solid ${isActive ? 'color-mix(in srgb, var(--monokai-fg) 10%, transparent)' : 'transparent'}`,
      }}
      title={item.shortcut ? `${item.label} (Ctrl+${item.shortcut})` : item.label}
    >
      {/* Icon */}
      <span className="shrink-0" style={{ color: isActive ? themeColor : DESIGN.chrome.textMuted }}>
        <Icon size={14} weight={isActive ? 'fill' : 'regular'} />
      </span>

      {/* Label */}
      <span>{item.label}</span>

      {/* Active underline */}
      {isActive && (
        <span
          className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
          style={{
            background: themeColor,
          }}
        />
      )}

      {/* Keyboard shortcut badge */}
      {item.shortcut && !isActive && (
        <span
          aria-hidden="true"
          className="ml-0.5 px-1 py-0.5 rounded text-[9px] font-mono"
          style={{ background: 'color-mix(in srgb, var(--monokai-fg) 5%, transparent)', color: 'color-mix(in srgb, var(--monokai-fg) 30%, transparent)' }}
        >
          {item.shortcut}
        </span>
      )}
    </button>
  );
};

/**
 * Table Context Badge
 */
const TableContextBadge: React.FC<{ table: string }> = ({ table }) => (
  <div
    className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-md ml-2 shrink-0"
    style={{
      background: DESIGN.theme.core.bg,
      border: `1px solid ${DESIGN.theme.core.border}`,
    }}
  >
    <TablePhosphor size={14} style={{ color: DESIGN.theme.core.color }} />
    <span className="text-[11px]" style={{ color: 'color-mix(in srgb, var(--monokai-fg) 50%, transparent)' }}>表:</span>
    <span
      className="text-[11px] font-medium truncate max-w-[100px]"
      style={{ color: DESIGN.theme.core.color }}
    >
      {table}
    </span>
  </div>
);

/**
 * Tool Button - Icon-only or icon+text button
 */
const ToolButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  showText?: boolean;
  onClick: () => void;
  variant?: 'default' | 'filled';
}> = ({ icon, label, shortcut, showText = true, onClick, variant = 'default' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`
      flex shrink-0 items-center gap-1.5 h-8 px-2.5 rounded-lg whitespace-nowrap
      text-[11px] font-medium
      transition-all duration-150
      cursor-pointer select-none
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
      hover:scale-[1.02]
      ${variant === 'filled' ? 'bg-monokai-hover border border-monokai-border' : ''}
    `}
    style={{
      color: DESIGN.chrome.text,
      ...(variant === 'filled' && { borderColor: 'color-mix(in srgb, var(--monokai-fg) 10%, transparent)' }),
    }}
    title={shortcut ? `${label} (${shortcut})` : label}
    aria-label={label}
  >
    {icon}
    {showText && <span className="workspace-tool-label">{label}</span>}
    {shortcut && (
      <span className="hidden xl:inline text-[9px] ml-0.5" style={{ color: 'color-mix(in srgb, var(--monokai-fg) 25%, transparent)' }}>
        {shortcut}
      </span>
    )}
  </button>
);

/**
 * Status Indicator - Runtime status pill
 */
const StatusIndicator: React.FC<{ persistent: boolean; storageMode?: string; database?: string }> = ({ persistent, storageMode, database }) => (
  <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[10px] font-medium">
    <span
      className="w-1.5 h-1.5 rounded-full"
      style={{
        background: persistent && database !== 'memory' ? DESIGN.theme.core.color : 'var(--monokai-orange)',
        boxShadow: `0 0 6px ${persistent && database !== 'memory' ? DESIGN.theme.core.color : 'var(--monokai-orange)'}`,
      }}
    />
    <span style={{ color: persistent && database !== 'memory' ? DESIGN.theme.core.color : 'var(--monokai-orange)' }}>
      {database === 'memory' ? '临时分析空间' : persistent ? (storageMode === 'indexeddb' ? '已保存到 IndexedDB' : '已保存到 OPFS') : '内存临时模式'}
    </span>
  </div>
);

/**
 * Dropdown Panel
 */
const DropdownPanel: React.FC<{
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}> = ({ children, align = 'right', className = '' }) => (
  <div
    className={`
      absolute top-full mt-2 w-56 rounded-xl overflow-hidden
      animate-in fade-in zoom-in-95 duration-150
      z-[70] ${className}
    `}
    style={{
      [align]: 0,
      background: 'var(--monokai-sidebar)',
      backdropFilter: 'blur(20px)',
      border: '1px solid color-mix(in srgb, var(--monokai-fg) 10%, transparent)',
      boxShadow: '0 16px 48px -8px rgba(0, 0, 0, 0.5), 0 0 0 1px color-mix(in srgb, var(--monokai-fg) 5%, transparent) inset',
    }}
  >
    {children}
  </div>
);

// ============================================
// Main Component
// ============================================
export const AppTopBar: React.FC<AppTopBarProps> = ({
  activeTab,
  currentTable,
  tables = [],
  setActiveTab,
  handleTableSelect,
  handleCreateDemo,
  setShowCreateModal,
  setShowImportModal,
  setShowExportModal,
  setShowSettingsModal,
  fetchTableData,
  refreshAudit,
  runtimeInfo,
  activeDatabase = 'memory',
  analysisContexts: propAnalysisContexts,
  onSwitchAnalysisContext,
}) => {
  const { theme, setTheme } = useUiTheme();
  // State
  const [selectedDomainId, setSelectedDomainId] = useState<string>('core');
  const [showDbDropdown, setShowDbDropdown] = useState(false);
  const [showHelpDropdown, setShowHelpDropdown] = useState(false);
  const [internalContexts, setInternalContexts] = useState<AnalysisContextOption[]>([]);
  const [switchingContext, setSwitchingContext] = useState(false);

  // AI Copilot state
  const isCopilotOpen = useCopilotStore((s) => s.isOpen);
  const toggleCopilot = useCopilotStore((s) => s.toggleOpen);

  // Refs
  const topBarRef = useRef<HTMLElement>(null);
  const dbDropdownRef = useRef<HTMLDivElement>(null);
  const helpDropdownRef = useRef<HTMLDivElement>(null);

  // Refresh analysis contexts from duckDBService
  const refreshContexts = useCallback(async () => {
    try {
      const list = await duckDBService.listAnalysisContexts();
      if (list && list.length > 0) {
        setInternalContexts(list);
      }
    } catch {
      // fallback handled in useMemo
    }
  }, []);

  useEffect(() => {
    void refreshContexts();
    const handleDbChange = () => { void refreshContexts(); };
    window.addEventListener('duckdb-database-changed', handleDbChange);
    window.addEventListener('duckdb-schema-changed', handleDbChange);
    return () => {
      window.removeEventListener('duckdb-database-changed', handleDbChange);
      window.removeEventListener('duckdb-schema-changed', handleDbChange);
    };
  }, [refreshContexts]);

  useEffect(() => {
    if (showDbDropdown) {
      void refreshContexts();
    }
  }, [showDbDropdown, refreshContexts]);

  const contexts = useMemo(() => {
    if (propAnalysisContexts && propAnalysisContexts.length > 0) {
      return propAnalysisContexts;
    }
    if (internalContexts.length > 0) {
      return internalContexts;
    }
    const isMemory = !runtimeInfo?.persistent || runtimeInfo?.storageMode === 'memory' || activeDatabase === 'memory';
    return [
      {
        id: activeDatabase || 'memory',
        label: `${isMemory ? '内存库' : '持久库'} · ${activeDatabase || 'memory'}${activeDatabase === 'memory' ? '（临时）' : ''}`,
        kind: 'database' as const,
        isCurrent: true,
      },
    ];
  }, [propAnalysisContexts, internalContexts, activeDatabase, runtimeInfo?.persistent, runtimeInfo?.storageMode]);

  const handleSwitchContext = async (target: AnalysisContextOption) => {
    if (target.isCurrent || switchingContext) {
      setShowDbDropdown(false);
      return;
    }
    setSwitchingContext(true);
    try {
      setShowDbDropdown(false);
      if (onSwitchAnalysisContext) {
        await onSwitchAnalysisContext(target);
      } else {
        await duckDBService.switchAnalysisContext(target);
        useAppStore.getState().setCurrentDatabase(target.kind === 'database' || target.kind === 'project' ? target.id : useAppStore.getState().currentDatabase);
        useAppStore.getState().setCurrentTable(null);
        useAppStore.getState().setTables([]);
        const updated = await duckDBService.getTables();
        useAppStore.getState().setTables(updated);
        if (updated[0] && handleTableSelect) handleTableSelect(updated[0]);
        toastService.success(
          `已切换到 ${target.kind === 'database' || target.kind === 'project' ? '数据库' : 'Schema'}「${target.id}」`,
        );
      }
      await refreshContexts();
    } catch (err: any) {
      toastService.error(`切换失败: ${err?.message || '未知错误'}`);
    } finally {
      setSwitchingContext(false);
    }
  };

  // Close dropdowns helper
  const closeMenus = useCallback(() => {
    setShowDbDropdown(false);
    setShowHelpDropdown(false);
  }, []);

  // Close dropdowns on outside click
  useOutsideClick(topBarRef, closeMenus);

  // Keyboard handler for Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const expandedBtn = topBarRef.current?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]');
        if (expandedBtn) {
          e.preventDefault();
          closeMenus();
          expandedBtn.focus();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [closeMenus]);

  // Sync domain selection with activeTab
  useEffect(() => {
    const matchedDomain = DOMAIN_CATEGORIES.find(d => d.items.some(i => i.tab === activeTab));
    if (matchedDomain) {
      setSelectedDomainId(matchedDomain.id);
    }
  }, [activeTab]);

  // Global hotkeys for core tabs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        const isInputField =
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          Boolean(target?.isContentEditable) ||
          Boolean(typeof target?.closest === 'function' && target.closest('.cm-editor'));

        if (isInputField) return;

        const keyToTab: Record<string, Tab> = {
          '1': Tab.DASHBOARD,
          '2': Tab.DATA,
          '3': Tab.STRUCTURE,
          '4': Tab.SQL,
          '5': Tab.DATAFLOW,
        };

        if (keyToTab[e.key]) {
          e.preventDefault();
          setActiveTab(keyToTab[e.key]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

  // Tab keyboard navigation
  const handleTabKeyDown = (e: React.KeyboardEvent, index: number, items: NavTabItem[]) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();

    const newIndex =
      e.key === 'Home' ? 0 :
      e.key === 'End' ? items.length - 1 :
      e.key === 'ArrowRight' ? (index + 1) % items.length :
      (index - 1 + items.length) % items.length;

    setActiveTab(items[newIndex].tab);
    const buttons = (e.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[newIndex]?.focus();
  };

  // Derived values
  const activeDomain = useMemo(() =>
    DOMAIN_CATEGORIES.find(d => d.id === selectedDomainId) || DOMAIN_CATEGORIES[0],
    [selectedDomainId]
  );

  const themeColor = DESIGN.theme[activeDomain.id as keyof typeof DESIGN.theme].color;

  return (
    <header
      ref={topBarRef}
      aria-label="全局工作区顶栏"
      className="workspace-topbar flex max-sm:flex-wrap max-sm:gap-y-1 h-12 w-full items-center justify-between px-4 shrink-0 select-none z-50"
      style={{
        background: 'linear-gradient(180deg, var(--monokai-sidebar) 0%, var(--monokai-sidebar) 100%)',
        borderBottom: `1px solid ${DESIGN.chrome.border}`,
        boxShadow: 'none',
      }}
    >
      {/* ===== LEFT SECTION ===== */}
      <div className="workspace-navigation flex items-center gap-3 min-w-0 flex-1 max-sm:flex-none max-sm:w-full overflow-x-auto overflow-y-hidden scrollbar-none">
        
        {/* Branding */}
        <button
          type="button"
          onClick={() => {
            setSelectedDomainId('core');
            setActiveTab(Tab.DASHBOARD);
          }}
          className="group flex shrink-0 items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity rounded-lg p-1 -ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/50"
          title="返回首页仪表盘"
          aria-label="DuckDB Studio · 返回首页仪表盘"
        >
          {/* Logo mark */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #8b5cf6 100%)',
              boxShadow: '0 4px 12px -2px rgba(16, 185, 129, 0.4)',
            }}
          >
            <span className="text-base font-black text-white drop-shadow-md">🪶</span>
          </div>

          {/* Brand text */}
          <div className="flex flex-col items-start">
            <span
              className="font-semibold text-xs whitespace-nowrap tracking-tight leading-none"
              style={{
                background: theme === 'light'
                  ? 'linear-gradient(135deg, #0f172a 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #ffffff 0%, #a3e635 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              DuckDB Studio
            </span>
            <span className="text-[9px] font-mono tracking-widest mt-0.5" style={{ color: 'rgba(16, 185, 129, 0.7)' }}>
              PRO
            </span>
          </div>
        </button>

        {/* Separator */}
        <div
          className="h-6 w-px shrink-0 mx-1"
          style={{ background: 'color-mix(in srgb, var(--monokai-fg) 10%, transparent)' }}
        />

        {/* Domain Navigation */}
        <nav
          className="flex items-center gap-1 p-1 rounded-lg shrink-0"
          style={{
            background: 'color-mix(in srgb, var(--monokai-fg) 3%, transparent)',
            border: '1px solid color-mix(in srgb, var(--monokai-fg) 5%, transparent)',
          }}
          aria-label="业务领域大类"
        >
          {DOMAIN_CATEGORIES.map((domain) => (
            <DomainButton
              key={domain.id}
              domain={domain}
              isActive={activeDomain.id === domain.id}
              onClick={() => {
                setSelectedDomainId(domain.id);
                if (!domain.items.some(i => i.tab === activeTab)) {
                  setActiveTab(domain.defaultTab);
                }
              }}
            />
          ))}
        </nav>

        {/* Separator */}
        <div
          className="h-6 w-px shrink-0 mx-1"
          style={{ background: 'color-mix(in srgb, var(--monokai-fg) 10%, transparent)' }}
        />

        {/* Feature Tabs */}
        <nav
          role="tablist"
          className="flex items-center gap-0.5 p-1 rounded-lg shrink-0"
          style={{
            background: 'color-mix(in srgb, var(--monokai-fg) 2%, transparent)',
            border: '1px solid color-mix(in srgb, var(--monokai-fg) 4%, transparent)',
          }}
          aria-label={`${activeDomain.label}功能标签页`}
        >
          {activeDomain.items.map((item, index) => (
            <FeatureTabButton
              key={item.tab}
              item={item}
              isActive={activeTab === item.tab}
              themeColor={themeColor}
              onClick={() => {
                closeMenus();
                setActiveTab(item.tab);
              }}
              onKeyDown={(e) => handleTabKeyDown(e, index, activeDomain.items)}
            />
          ))}
        </nav>

        {/* Context Badge */}
        {currentTable && (activeTab === Tab.DATA || activeTab === Tab.STRUCTURE || activeTab === Tab.SQL) && (
          <TableContextBadge table={currentTable} />
        )}
      </div>

      {/* ===== RIGHT SECTION ===== */}
      <div className="workspace-tools flex items-center gap-1 shrink-0 ml-4 max-sm:ml-0 max-sm:w-full max-sm:flex-wrap">

        {/* Projects Button */}
        <ToolButton
          icon={<FolderPhosphor size={15} />}
          label="项目"
          shortcut="Ctrl+Shift+D"
          onClick={() => {
            useAppStore.getState().setShowProjectManagerModal(true);
            window.dispatchEvent(new CustomEvent('open-project-manager-modal'));
            closeMenus();
          }}
          variant="filled"
        />

        {/* Create Table Button */}
        <ToolButton
          icon={<TablePhosphor size={15} />}
          label="新建表"
          onClick={() => {
            setShowCreateModal?.(true);
            useAppStore.getState().setShowCreateModal(true);
            window.dispatchEvent(new CustomEvent('open-create-table-modal'));
            closeMenus();
          }}
          variant="default"
        />

        {/* Database Dropdown */}
        <div ref={dbDropdownRef} className="relative shrink-0">
          <button
            type="button"
            aria-expanded={showDbDropdown}
            aria-haspopup="true"
            onClick={() => {
              setShowDbDropdown(prev => !prev);
              setShowHelpDropdown(false);
            }}
            className="flex items-center gap-2 h-8 px-2.5 rounded-lg transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{
              background: showDbDropdown ? 'color-mix(in srgb, var(--monokai-fg) 8%, transparent)' : 'color-mix(in srgb, var(--monokai-fg) 4%, transparent)',
              border: `1px solid ${showDbDropdown ? 'color-mix(in srgb, var(--monokai-fg) 12%, transparent)' : 'color-mix(in srgb, var(--monokai-fg) 8%, transparent)'}`,
              color: DESIGN.chrome.text,
            }}
          >
            <DatabasePhosphor size={15} weight="regular" />
            <span className="text-[11px] font-medium max-w-[90px] truncate hidden xl:inline">
              {activeDatabase}
            </span>
            <div className="w-px h-4 bg-monokai-border" />
            <StatusIndicator persistent={runtimeInfo?.persistent ?? false} storageMode={runtimeInfo?.storageMode} database={activeDatabase} />
          </button>

          {showDbDropdown && (
            <DropdownPanel align="right" className="min-w-[280px]">
              <div className="flex items-center justify-between px-3 py-2 border-b border-monokai-border/60">
                <span className="text-[10px] uppercase font-mono tracking-wider text-monokai-comment">
                  切换分析数据库
                </span>
                <span className="text-[10px] text-monokai-comment font-mono">
                  {contexts.length} 个可用目标
                </span>
              </div>

              {/* Context options grouped by Database and Schema */}
              <div className="max-h-72 overflow-y-auto custom-scrollbar py-1">
                {/* 数据库分组 */}
                <div className="px-3 pt-1.5 pb-1 text-[10px] font-semibold text-monokai-comment uppercase tracking-wider flex items-center gap-1.5">
                  <DatabasePhosphor size={12} className="text-monokai-accent" />
                  <span>数据库 (Database)</span>
                </div>
                {contexts
                  .filter((ctx) => ctx.kind !== 'schema')
                  .map((ctx) => {
                    const isCurrent = ctx.isCurrent || (contexts.every((c) => !c.isCurrent) && ctx.id === activeDatabase);
                    return (
                      <button
                        key={`${ctx.kind}:${ctx.id}`}
                        type="button"
                        role="option"
                        aria-selected={isCurrent}
                        onClick={() => void handleSwitchContext(ctx)}
                        className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-monokai-accent/15 text-monokai-accent font-medium'
                            : 'text-monokai-fg-muted hover:bg-monokai-surface hover:text-monokai-fg'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <DatabasePhosphor size={14} className="shrink-0 text-monokai-comment" />
                          <span className="truncate font-mono text-[11px]">{ctx.label}</span>
                        </div>
                        {isCurrent && (
                          <CheckCirclePhosphor size={14} weight="fill" className="text-monokai-accent shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}

                {/* 当前库下的 Schema 分组 */}
                {contexts.some((ctx) => ctx.kind === 'schema') && (
                  <>
                    <div className="my-1.5 mx-2 border-t border-monokai-border/40" />
                    <div className="px-3 pt-1 pb-1 text-[10px] font-semibold text-monokai-comment uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <FolderPhosphor size={12} className="text-amber-400" />
                        <span>当前库模式 (Schema)</span>
                      </span>
                      <span className="text-[9px] lowercase font-normal text-monokai-comment/70">所属: {activeDatabase}</span>
                    </div>
                    {contexts
                      .filter((ctx) => ctx.kind === 'schema')
                      .map((ctx) => {
                        return (
                          <button
                            key={`${ctx.kind}:${ctx.id}`}
                            type="button"
                            role="option"
                            aria-selected={ctx.isCurrent}
                            onClick={() => void handleSwitchContext(ctx)}
                            className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                              ctx.isCurrent
                                ? 'bg-monokai-accent/15 text-monokai-accent font-medium'
                                : 'text-monokai-fg-muted hover:bg-monokai-surface hover:text-monokai-fg'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1 pl-1">
                              <span className="font-mono text-[10px] text-amber-400/80">§</span>
                              <span className="truncate font-mono text-[11px]">{ctx.label}</span>
                            </div>
                            {ctx.isCurrent && (
                              <CheckCirclePhosphor size={14} weight="fill" className="text-monokai-accent shrink-0 ml-2" />
                            )}
                          </button>
                        );
                      })}
                  </>
                )}
              </div>

              <div className="my-1 border-t border-monokai-border/60" />

              {/* Management actions */}
              <button
                type="button"
                onClick={() => {
                  setShowDbDropdown(false);
                  setShowCreateModal?.(true);
                  useAppStore.getState().setShowCreateModal(true);
                  window.dispatchEvent(new CustomEvent('open-create-table-modal'));
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-monokai-fg-muted hover:bg-monokai-surface hover:text-amber-400 font-medium transition-colors cursor-pointer"
              >
                <TablePhosphor size={14} className="shrink-0 text-amber-400" />
                <span>新建数据表 (可视化设计器)…</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowDbDropdown(false);
                  useAppStore.getState().setShowProjectManagerModal(true);
                  window.dispatchEvent(new CustomEvent('open-project-manager-modal'));
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-monokai-accent hover:bg-monokai-surface font-medium transition-colors cursor-pointer"
              >
                <Plus size={14} className="shrink-0 text-monokai-accent" />
                <span>管理数据库（创建 / 挂载 / 卸载）…</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowImportModal(true);
                  setShowDbDropdown(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-monokai-fg-muted hover:bg-monokai-surface hover:text-monokai-accent transition-colors cursor-pointer"
              >
                <FolderPhosphor size={14} className="shrink-0" />
                <span>导入数据表文件 (CSV / Parquet / Excel)...</span>
              </button>

              {runtimeInfo?.storageMode === 'indexeddb' && (
                <button
                  type="button"
                  onClick={async () => {
                    await duckDBService.clearIndexedDBCache?.();
                    toastService.success('已清理工作区缓存 (IndexedDB)');
                    setShowDbDropdown(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[11px] transition-colors cursor-pointer text-rose-400 hover:bg-monokai-hover"
                >
                  <Trash2 size={14} className="shrink-0" />
                  <span>清理工作区缓存 (IndexedDB)</span>
                </button>
              )}
            </DropdownPanel>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-monokai-border mx-1" />

        {/* AI Copilot Toggle Button (历史与审计模块不启用右侧侧边栏) */}
        {activeTab !== Tab.HISTORY && activeTab !== Tab.AUDIT && (
          <ToolButton
            icon={<SparklePhosphor size={15} weight={isCopilotOpen ? 'fill' : 'regular'} style={{ color: isCopilotOpen ? 'var(--monokai-pink)' : undefined }} />}
            label="AI 助手"
            shortcut="Ctrl+I"
            onClick={toggleCopilot}
            variant={isCopilotOpen ? 'filled' : 'default'}
          />
        )}

        {/* Search Button */}
        <ToolButton
          icon={<MagnifyingGlassPhosphor size={15} />}
          label="⌘K"
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
          }}
          showText={false}
        />

        {/* Help Dropdown */}
        <div ref={helpDropdownRef} className="relative">
          <button
            type="button"
            aria-expanded={showHelpDropdown}
            aria-haspopup="true"
            onClick={() => {
              setShowHelpDropdown(prev => !prev);
              setShowDbDropdown(false);
            }}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{
              background: showHelpDropdown ? 'color-mix(in srgb, var(--monokai-fg) 8%, transparent)' : 'transparent',
              color: showHelpDropdown ? 'var(--monokai-fg)' : DESIGN.chrome.textMuted,
            }}
            title="帮助与快捷键"
          >
            <QuestionPhosphor size={16} weight="regular" />
          </button>

          {showHelpDropdown && (
            <DropdownPanel align="right">
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-keyboard-shortcuts'));
                  setShowHelpDropdown(false);
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-[11px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2"
                style={{ color: 'color-mix(in srgb, var(--monokai-fg) 70%, transparent)' }}
              >
                <div className="flex items-center gap-2.5">
                  <Keyboard size={15} className="opacity-60" />
                  <span>快捷键清单</span>
                </div>
                <span className="text-[10px] font-mono" style={{ color: 'color-mix(in srgb, var(--monokai-fg) 25%, transparent)' }}>?</span>
              </button>

              <div className="mx-2 my-1" style={{ borderTop: '1px solid color-mix(in srgb, var(--monokai-fg) 6%, transparent)' }} />

              <a
                href="https://duckdb.org/docs/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-4 py-2.5 text-[11px] transition-colors"
                style={{ color: 'color-mix(in srgb, var(--monokai-fg) 50%, transparent)' }}
                onClick={() => setShowHelpDropdown(false)}
              >
                <div className="flex items-center gap-2.5">
                  <ExternalLink size={15} className="opacity-60" />
                  <span>DuckDB 官方文档</span>
                </div>
              </a>

              <button
                type="button"
                onClick={() => {
                  toastService.info('DuckDB Studio v1.0 - 高性能数据分析工作台');
                  setShowHelpDropdown(false);
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[11px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2"
                style={{ color: 'color-mix(in srgb, var(--monokai-fg) 70%, transparent)' }}
              >
                <Info size={15} className="opacity-60" />
                <span>关于 DuckDB Studio · {APP_BUILD_ID}</span>
              </button>
            </DropdownPanel>
          )}
        </div>

        <ToolButton icon={theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />} label={theme === 'dark' ? '切换为浅色模式' : '切换为深色模式'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} showText={false} />
        {/* Settings */}
        <ToolButton
          icon={<GearPhosphor size={15} />}
          label="AI 模型设置"
          onClick={() => { closeMenus(); setShowSettingsModal(true); }}
          showText={false}
        />
      </div>
    </header>
  );
};

export default AppTopBar;
