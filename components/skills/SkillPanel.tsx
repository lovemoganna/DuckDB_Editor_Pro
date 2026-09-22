/**
 * SkillPanel — Browse + Guide Dual Mode with unified SkillContext
 *
 * State managed via SkillContext (Zustand + local state).
 * Sub-components consume from context instead of prop drilling.
 * Follows Monokai theme from DESIGN_SYSTEM.md
 *
 * Fix: Use conditional rendering instead of absolute positioning with translate
 * to avoid pointer-events blocking issues. The old approach with both views
 * absolutely positioned at the same coordinates caused click events to be
 * captured by whichever element happened to be on top, regardless of visibility.
 */

import React, { lazy, Suspense } from 'react';
import { Library, Terminal, Sparkles } from 'lucide-react';
import { SegmentedTabs } from '../ui/Workbench';

// Context
import { SkillProvider, useSkillContext } from './context/SkillContext';

// Extracted sub-components
import { BrowseMode } from './BrowseMode';
import { SpotlightSearch } from './SpotlightSearch';
import { DuckDBGuide } from './DuckDBGuide';

// Lazy-load heavy components
const SkillImportModal = lazy(() => import('../SkillImportModal').then(m => ({ default: m.SkillImportModal })));

interface SkillPanelProps {
  isOpen: boolean;
  onClose?: () => void;
  onExecuteSql?: (sql: string) => void;
  currentTable?: string;
  currentColumns?: { name: string; type: string }[];
}

const SKILL_VIEW_TABS = [
  { value: 'guide' as const, label: 'AI Skills', icon: Terminal },
  { value: 'browse' as const, label: '技能方案', icon: Library },
];

// ─────────────────────────────────────────────────────────────────────
// Inner panel — lives inside SkillProvider so children can use the hook
// ─────────────────────────────────────────────────────────────────────
const SkillPanelInner: React.FC<Pick<SkillPanelProps, 'onExecuteSql'>> = ({
  onExecuteSql,
}) => {
  const {
    viewMode, setViewMode,
    showImportModal, setShowImportModal,
  } = useSkillContext();

  return (
    <>
      <SpotlightSearch />

      <Suspense fallback={null}>
        <SkillImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
        />
      </Suspense>

      <div className="flex h-full w-full flex-col overflow-hidden border border-monokai-border bg-monokai-bg font-sans">
        {/* Navigation Tabs — Standard Segmented Control Bar */}
        <div className="flex min-h-16 items-center justify-between px-5 sm:px-6 bg-monokai-sidebar/95 border-b border-monokai-border/80 shrink-0 select-none backdrop-blur-md shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-monokai-accent/30 bg-monokai-accent/10 text-monokai-accent shadow-inner">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <SegmentedTabs
              aria-label="Skill 模式"
              value={viewMode}
              items={SKILL_VIEW_TABS}
              size="md"
              onChange={setViewMode}
            />
          </div>

          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 px-3 py-1.5 bg-monokai-surface rounded-lg border border-monokai-border/80 text-monokai-comment text-xs font-mono shadow-inner">
                <div className="w-2 h-2 rounded-full bg-monokai-green animate-pulse" />
                <span className="text-xs text-monokai-comment font-mono font-medium">DUCKDB ENGINE READY</span>
             </div>
          </div>
        </div>

        {/*
          FIX: Use conditional rendering instead of absolute positioning.
          The old approach with both views absolutely positioned at `inset: 0`
          caused the inactive view to block pointer events on the active view,
          because both divs occupied the exact same screen coordinates.
          With conditional rendering, only the active view exists in the DOM.
        */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'guide' && (
            <DuckDBGuide className="" onExecuteSql={onExecuteSql} />
          )}
          {viewMode === 'browse' && (
            <BrowseMode onExecuteSql={onExecuteSql} />
          )}
        </div>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Outer wrapper — provides SkillContext
// ─────────────────────────────────────────────────────────────────────
export const SkillPanel: React.FC<SkillPanelProps> = ({
  isOpen,
  onClose,
  onExecuteSql,
  currentTable,
  currentColumns,
}) => {
  if (!isOpen) return null;

  return (
    <SkillProvider>
      <SkillPanelInner
        onExecuteSql={onExecuteSql}
      />
    </SkillProvider>
  );
};
