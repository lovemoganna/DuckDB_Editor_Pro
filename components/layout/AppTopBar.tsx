import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  Plus,
  Keyboard,
  Info,
  ExternalLink,
  Trash2,
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
      className={`
        relative flex items-center gap-1.5 h-9 px-3.5 rounded-lg
        font-medium text-[11px] tracking-wide
        transition-all duration-200 ease-out
        cursor-pointer select-none shrink-0
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent
        ${isActive ? 'font-semibold' : 'hover:scale-[1.02]'}
      `}
      style={{
        color: isActive ? '#ffffff' : DESIGN.chrome.text,
        background: isActive ? theme.bg : 'transparent',
        border: `1px solid ${isActive ? theme.border : 'transparent'}`,
        boxShadow: isActive ? `0 2px 8px -2px ${theme.glow}` : 'none',
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
      
      {/* Glow effect for active state */}
      {isActive && (
        <span
          className="absolute inset-0 rounded-lg opacity-20 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, ${theme.color} 0%, transparent 70%)`,
            filter: 'blur(6px)',
          }}
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
        color: isActive ? '#ffffff' : DESIGN.chrome.textMuted,
        background: isActive ? `rgba(255, 255, 255, 0.06)` : 'transparent',
        border: `1px solid ${isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent'}`,
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
            background: `linear-gradient(90deg, transparent 0%, ${themeColor} 50%, transparent 100%)`,
            boxShadow: `0 0 6px ${themeColor}`,
          }}
        />
      )}

      {/* Keyboard shortcut badge */}
      {item.shortcut && !isActive && (
        <span
          aria-hidden="true"
          className="ml-0.5 px-1 py-0.5 rounded text-[9px] font-mono"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}
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
    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>表:</span>
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
      flex items-center gap-1.5 h-8 px-2.5 rounded-lg
      text-[11px] font-medium
      transition-all duration-150
      cursor-pointer select-none
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
      hover:scale-[1.02]
      ${variant === 'filled' ? 'bg-white/5 border border-white/10' : ''}
    `}
    style={{
      color: DESIGN.chrome.text,
      ...(variant === 'filled' && { borderColor: 'rgba(255,255,255,0.1)' }),
    }}
    title={shortcut ? `${label} (${shortcut})` : label}
  >
    {icon}
    {showText && <span>{label}</span>}
    {shortcut && (
      <span className="hidden xl:inline text-[9px] ml-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
        {shortcut}
      </span>
    )}
  </button>
);

/**
 * Status Indicator - Runtime status pill
 */
const StatusIndicator: React.FC<{ persistent: boolean; storageMode?: string }> = ({ persistent, storageMode }) => (
  <div className="flex items-center gap-1.5 text-[10px] font-medium">
    <span
      className="w-1.5 h-1.5 rounded-full"
      style={{
        background: persistent ? DESIGN.theme.core.color : 'var(--monokai-orange)',
        boxShadow: `0 0 6px ${persistent ? DESIGN.theme.core.color : 'var(--monokai-orange)'}`,
      }}
    />
    <span style={{ color: persistent ? DESIGN.theme.core.color : 'var(--monokai-orange)' }}>
      {persistent ? (storageMode === 'indexeddb' ? '已保存到 IndexedDB' : '已保存到 OPFS') : '内存临时模式'}
    </span>
  </div>
);

/**
 * Dropdown Panel
 */
const DropdownPanel: React.FC<{
  children: React.ReactNode;
  align?: 'left' | 'right';
}> = ({ children, align = 'right' }) => (
  <div
    className={`
      absolute top-full mt-2 w-56 rounded-xl overflow-hidden
      animate-in fade-in zoom-in-95 duration-150
      z-[70]
    `}
    style={{
      [align]: 0,
      background: 'rgba(15, 20, 25, 0.98)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 16px 48px -8px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
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
  setActiveTab,
  setShowCreateModal,
  setShowImportModal,
  setShowSettingsModal,
  runtimeInfo,
  activeDatabase = 'memory',
}) => {
  // State
  const [selectedDomainId, setSelectedDomainId] = useState<string>('core');
  const [showDbDropdown, setShowDbDropdown] = useState(false);
  const [showHelpDropdown, setShowHelpDropdown] = useState(false);

  // Refs
  const topBarRef = useRef<HTMLElement>(null);
  const dbDropdownRef = useRef<HTMLDivElement>(null);
  const helpDropdownRef = useRef<HTMLDivElement>(null);

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
          Boolean(target?.closest('.cm-editor'));

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
      className="flex h-12 w-full items-center justify-between px-4 shrink-0 select-none z-50"
      style={{
        background: 'linear-gradient(180deg, rgba(15, 20, 25, 0.98) 0%, rgba(15, 20, 25, 0.94) 100%)',
        borderBottom: `1px solid ${DESIGN.chrome.border}`,
        boxShadow: '0 4px 24px -4px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* ===== LEFT SECTION ===== */}
      <div className="flex items-center gap-3 min-w-0 flex-1 overflow-x-auto overflow-y-hidden scrollbar-none">
        
        {/* Branding */}
        <button
          type="button"
          onClick={() => {
            setSelectedDomainId('core');
            setActiveTab(Tab.DASHBOARD);
          }}
          className="group flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity rounded-lg p-1 -ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/50"
          title="返回首页仪表盘"
        >
          {/* Logo mark */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
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
              className="font-semibold text-sm tracking-tight leading-none"
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #a3e635 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              DuckDB Studio
            </span>
            <span className="text-[9px] font-mono tracking-widest mt-0.5" style={{ color: 'rgba(16, 185, 129, 0.6)' }}>
              PRO
            </span>
          </div>
        </button>

        {/* Separator */}
        <div
          className="h-6 w-px shrink-0 mx-1"
          style={{ background: 'rgba(255,255,255,0.1)' }}
        />

        {/* Domain Navigation */}
        <nav
          className="flex items-center gap-1 p-1 rounded-lg shrink-0"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
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
          style={{ background: 'rgba(255,255,255,0.1)' }}
        />

        {/* Feature Tabs */}
        <nav
          role="tablist"
          className="flex items-center gap-0.5 p-1 rounded-lg shrink-0"
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.04)',
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
      <div className="flex items-center gap-1 shrink-0 ml-4">

        {/* Projects Button */}
        <ToolButton
          icon={<FolderPhosphor size={15} />}
          label="项目"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('open-project-manager-modal'));
            closeMenus();
          }}
          variant="filled"
        />

        {/* Database Dropdown */}
        <div ref={dbDropdownRef} className="relative">
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
              background: showDbDropdown ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${showDbDropdown ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.08)'}`,
              color: DESIGN.chrome.text,
            }}
          >
            <DatabasePhosphor size={15} weight="regular" />
            <span className="text-[11px] font-medium max-w-[90px] truncate hidden xl:inline">
              {activeDatabase}
            </span>
            <div className="w-px h-4 bg-white/10" />
            <StatusIndicator persistent={runtimeInfo?.persistent ?? false} storageMode={runtimeInfo?.storageMode} />
          </button>

          {showDbDropdown && (
            <DropdownPanel align="right">
              <div className="px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                当前连接数据库
              </div>
              <div
                className="mx-2 mb-2 px-3 py-2.5 rounded-lg flex items-center justify-between"
                style={{
                  background: DESIGN.theme.core.bg,
                  border: `1px solid ${DESIGN.theme.core.border}`,
                }}
              >
                <span className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  {activeDatabase}
                </span>
                <CheckCirclePhosphor size={16} weight="fill" style={{ color: DESIGN.theme.core.color }} />
              </div>
              <div className="mx-2 mb-2" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }} />
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(true);
                  setShowDbDropdown(false);
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-[11px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2"
                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                <Plus size={15} />
                <span>挂载新数据库 / 文件...</span>
              </button>

              {runtimeInfo?.storageMode === 'indexeddb' && (
                <button
                  type="button"
                  onClick={async () => {
                    await duckDBService.clearIndexedDBCache?.();
                    toastService.success('已清理工作区缓存 (IndexedDB)');
                    setShowDbDropdown(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-[11px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 text-rose-400 hover:bg-white/5"
                >
                  <Trash2 size={15} />
                  <span>清理工作区缓存 (IndexedDB)</span>
                </button>
              )}
            </DropdownPanel>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-white/10 mx-1" />

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
              background: showHelpDropdown ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              color: showHelpDropdown ? '#ffffff' : DESIGN.chrome.textMuted,
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
                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                <div className="flex items-center gap-2.5">
                  <Keyboard size={15} className="opacity-60" />
                  <span>快捷键清单</span>
                </div>
                <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>?</span>
              </button>

              <div className="mx-2 my-1" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }} />

              <a
                href="https://duckdb.org/docs/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-4 py-2.5 text-[11px] transition-colors"
                style={{ color: 'rgba(255, 255, 255, 0.5)' }}
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
                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                <Info size={15} className="opacity-60" />
                <span>关于 DuckDB Studio</span>
              </button>
            </DropdownPanel>
          )}
        </div>

        {/* Settings */}
        <ToolButton
          icon={<GearPhosphor size={15} />}
          label="系统与 AI 首选项设置"
          onClick={() => { closeMenus(); setShowSettingsModal(true); }}
          showText={false}
        />
      </div>
    </header>
  );
};

export default AppTopBar;
