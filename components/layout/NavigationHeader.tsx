import React from 'react';
import {
  Keyboard,
  Table2,
} from 'lucide-react';
import { Tab } from '../../types';
import { useAppStore } from '../../hooks/store/useAppStore';
import {
  WORKSPACE_FEATURES,
  type WorkspaceFeatureSection,
} from '../../services/workspaceNavigation';
import type { DuckDBRuntimeInfo } from '../../services/duckdbService';
import { DragonLogo } from '../ui/DragonLogo';
// Phosphor Icons - unified with AppTopBar
import {
  Database as DatabasePhosphor,
  ChartLine as ChartLinePhosphor,
  Books as BooksPhosphor,
  Brain as BrainPhosphor,
  MagnifyingGlass as MagnifyingGlassPhosphor,
  ArrowsOutSimple as ArrowsOutSimplePhosphor,
  ArrowsInSimple as ArrowsInSimplePhosphor,
} from '@phosphor-icons/react';

// ============================================
// Design Tokens - Consistent with AppTopBar
// ============================================
const DESIGN = {
  theme: {
    database: { glowColor: '#10b981', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.25)' },
    analytics: { glowColor: '#8b5cf6', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.25)' },
    knowledge: { glowColor: '#f59e0b', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)' },
    capability: { glowColor: '#f43f5e', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)', border: 'rgba(244, 63, 94, 0.25)' },
  },
  chrome: {
    bg: 'rgba(10, 14, 20, 0.95)',
    border: 'rgba(255, 255, 255, 0.08)',
    text: 'rgba(255, 255, 255, 0.7)',
    textMuted: 'rgba(255, 255, 255, 0.4)',
  },
} as const;

// ============================================
// Types
// ============================================
interface NavigationHeaderProps {
  activeTab: Tab;
  currentTable: string | null;
  setActiveTab: (tab: Tab) => void;
  fetchTableData: (tableName: string, offset: number, limit: number) => void;
  refreshAudit: () => void;
  runtimeInfo: DuckDBRuntimeInfo;
}

// ============================================
// Constants
// ============================================
const SECTION_ORDER: readonly WorkspaceFeatureSection[] = ['database', 'analytics', 'knowledge', 'capability'];

const SECTION_LABELS: Record<WorkspaceFeatureSection, string> = {
  database: '数据工程',
  analytics: '分析洞察',
  knowledge: '知识网络',
  capability: 'AI 认知',
};

const SECTION_ICONS: Record<WorkspaceFeatureSection, React.ComponentType<{ className?: string; weight?: 'fill' | 'regular'; size?: number; style?: React.CSSProperties }>> = {
  database: DatabasePhosphor,
  analytics: ChartLinePhosphor,
  knowledge: BooksPhosphor,
  capability: BrainPhosphor,
};

// ============================================
// Sub-Components
// ============================================

/**
 * Navigation Icon Button - Square icon buttons in sidebar
 */
const NavIconButton: React.FC<{
  section: WorkspaceFeatureSection;
  isActive: boolean;
  onClick: () => void;
}> = ({ section, isActive, onClick }) => {
  const Icon = SECTION_ICONS[section];
  const theme = DESIGN.theme[section];

  return (
    <button
      type="button"
      aria-label={SECTION_LABELS[section]}
      aria-pressed={isActive}
      onClick={onClick}
      className={`
        group relative flex h-14 w-14 flex-col items-center justify-center gap-1.5
        rounded-xl border transition-all duration-200
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        ${isActive ? 'scale-105' : 'hover:scale-[1.02]'}
      `}
      style={{
        background: isActive ? theme.bg : 'rgba(255, 255, 255, 0.03)',
        border: isActive ? `1px solid ${theme.border}` : '1px solid transparent',
        boxShadow: isActive
          ? `0 4px 12px -4px ${theme.glowColor}30, 0 0 0 1px ${theme.border} inset`
          : 'none',
      }}
    >
      {/* Active left accent bar */}
      {isActive && (
        <span
          className="absolute -left-0.5 top-2 bottom-2 w-0.5 rounded-r-full"
          style={{
            background: theme.color,
            boxShadow: `0 0 10px ${theme.color}`,
          }}
        />
      )}

      {/* Glow effect */}
      {isActive && (
        <span
          className="absolute inset-0 rounded-xl opacity-15 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, ${theme.color} 0%, transparent 70%)`,
            filter: 'blur(6px)',
          }}
        />
      )}

      {/* Icon */}
      <Icon
        size={20}
        weight={isActive ? 'fill' : 'regular'}
        className="relative z-10"
        style={{
          color: isActive ? theme.color : 'rgba(255, 255, 255, 0.35)',
          filter: isActive ? `drop-shadow(0 0 6px ${theme.color}80)` : 'none',
        }}
      />

      {/* Label */}
      <span
        className="text-[10px] font-medium leading-none relative z-10"
        style={{
          color: isActive ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.4)',
        }}
      >
        {SECTION_LABELS[section]}
      </span>
    </button>
  );
};

/**
 * Tool Icon Button - Smaller utility buttons
 */
const ToolIconButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  theme?: { color: string; bg: string; border: string };
  onClick: () => void;
}> = ({ icon, label, isActive = false, theme, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`
      flex h-10 w-10 items-center justify-center rounded-xl
      border transition-all duration-150
      focus-visible:outline-none focus-visible:ring-2
      hover:scale-105
    `}
    style={
      isActive && theme
        ? {
            background: theme.bg,
            border: `1px solid ${theme.border}`,
          }
        : {
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid transparent',
          }
    }
    title={label}
    aria-label={label}
  >
    {icon}
  </button>
);

/**
 * Runtime Status Badge
 */
const RuntimeStatusBadge: React.FC<{ runtimeInfo: DuckDBRuntimeInfo }> = ({ runtimeInfo }) => {
  const modeLabel = runtimeInfo.persistent
    ? (runtimeInfo.storageMode === 'opfs' ? 'OPFS' : 'IDB')
    : 'MEM';
  const fullLabel = runtimeInfo.persistent
    ? (runtimeInfo.storageMode === 'opfs' ? 'OPFS' : 'IndexedDB')
    : '内存临时模式';

  return (
    <div
      aria-label="DuckDB 运行状态"
      className="mb-1 mt-1 flex h-9 w-10 flex-col items-center justify-center gap-0.5 rounded-xl border"
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}
      title={`${runtimeInfo.version} · ${fullLabel}`}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{
          background: runtimeInfo.ready ? DESIGN.theme.database.color : '#f59e0b',
          boxShadow: `0 0 6px ${runtimeInfo.ready ? DESIGN.theme.database.color : '#f59e0b'}`,
        }}
      />
      <span className="text-[8px] font-bold" style={{ color: 'rgba(255, 255, 255, 0.35)' }}>
        {modeLabel}
      </span>
      <span className="sr-only">{runtimeInfo.version} {fullLabel}</span>
    </div>
  );
};

// ============================================
// Main Component
// ============================================
export const NavigationHeader: React.FC<NavigationHeaderProps> = ({
  activeTab,
  currentTable,
  setActiveTab,
  fetchTableData,
  refreshAudit,
  runtimeInfo,
}) => {
  const isZenMode = useAppStore(state => state.isZenMode);
  const toggleZenMode = useAppStore(state => state.toggleZenMode);

  const activeSection = WORKSPACE_FEATURES.find(feature => feature.tab === activeTab)?.section ?? 'database';

  const navigate = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === Tab.DATA && currentTable) fetchTableData(currentTable, 0, 50);
    if (tab === Tab.AUDIT) refreshAudit();
  };

  const navigateToSection = (section: WorkspaceFeatureSection) => {
    const firstFeature = WORKSPACE_FEATURES.find(feature => feature.section === section);
    if (firstFeature) navigate(firstFeature.tab);
  };

  return (
    <aside
      aria-label="全局工作区轨道"
      className="flex h-full w-[80px] shrink-0 flex-col items-center border-r py-3 font-sans select-none"
      style={{
        background: DESIGN.chrome.bg,
        borderColor: DESIGN.chrome.border,
        backdropFilter: 'blur(16px)',
        boxShadow: '4px 0 24px -4px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* Logo Section */}
      <button
        type="button"
        onClick={() => navigate(Tab.DASHBOARD)}
        className="mb-4 flex w-14 flex-col items-center gap-1.5 border-0 bg-transparent px-0 py-1 transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
        aria-label="打开 DuckDB Studio 仪表板"
        title="DuckDB Studio PRO"
      >
        <span className="relative">
          <DragonLogo size="sm" variant="brand" />
          {/* Status indicator dot */}
          <span
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2"
            style={{
              background: runtimeInfo.ready ? DESIGN.theme.database.color : '#f59e0b',
              borderColor: '#0a0e14',
              boxShadow: `0 0 8px ${runtimeInfo.ready ? DESIGN.theme.database.color : '#f59e0b'}`,
            }}
          />
        </span>
        <span className="text-[10px] font-semibold leading-tight tracking-tight text-white/90">
          DuckDB
        </span>
        {/* PRO badge */}
        <span
          className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
          style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            color: DESIGN.theme.database.color,
          }}
        >
          PRO
        </span>
      </button>

      {/* Separator */}
      <div
        className="mb-3 h-px w-12"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.12) 50%, transparent 100%)',
        }}
      />

      {/* Main Navigation Icons */}
      <nav aria-label="工作区主分类" className="flex w-full flex-1 flex-col items-center gap-2 px-2">
        {SECTION_ORDER.map(section => (
          <NavIconButton
            key={section}
            section={section}
            isActive={section === activeSection}
            onClick={() => navigateToSection(section)}
          />
        ))}
      </nav>

      {/* Bottom Tool Section */}
      <div className="flex w-full flex-col items-center gap-2 border-t px-2 pt-3" style={{ borderColor: DESIGN.chrome.border }}>

        {/* Current Table Indicator */}
        {currentTable && (
          <ToolIconButton
            icon={<Table2 size={18} style={{ color: DESIGN.theme.database.color }} />}
            label={`当前数据表：${currentTable}`}
            isActive={true}
            theme={DESIGN.theme.database}
            onClick={() => navigate(Tab.DATA)}
          />
        )}

        {/* Search Button */}
        <ToolIconButton
          icon={<MagnifyingGlassPhosphor size={18} weight="regular" style={{ color: 'rgba(255, 255, 255, 0.45)' }} />}
          label="全局命令面板 (Ctrl+K)"
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
        />

        {/* Keyboard Shortcuts */}
        <ToolIconButton
          icon={<Keyboard size={18} style={{ color: 'rgba(255, 255, 255, 0.45)' }} />}
          label="键盘快捷键指南"
          onClick={() => window.dispatchEvent(new CustomEvent('open-keyboard-shortcuts'))}
        />

        {/* Zen Mode Toggle */}
        <ToolIconButton
          icon={
            isZenMode ? (
              <ArrowsInSimplePhosphor size={18} weight="regular" style={{ color: '#8b5cf6' }} />
            ) : (
              <ArrowsOutSimplePhosphor size={18} weight="regular" style={{ color: 'rgba(255, 255, 255, 0.45)' }} />
            )
          }
          label={isZenMode ? '退出沉浸模式' : '进入沉浸模式'}
          isActive={isZenMode}
          theme={{ color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.25)' }}
          onClick={toggleZenMode}
        />

        {/* Runtime Status */}
        <RuntimeStatusBadge runtimeInfo={runtimeInfo} />
      </div>
    </aside>
  );
};

export default NavigationHeader;
