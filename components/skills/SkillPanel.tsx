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
import { Library, Terminal } from 'lucide-react';

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

      <div className="flex h-full w-full flex-col overflow-hidden border border-monokai-accent bg-monokai-bg">
        {/* Navigation Tabs — flat segmented control */}
        <div className="flex items-center px-4 bg-monokai-sidebar border-b border-monokai-accent h-12 flex-shrink-0">
          {/* Flat segmented group */}
          <div className="flex items-center gap-0 p-0.5 bg-monokai-bg border border-monokai-accent">
            <button
              onClick={() => setViewMode('guide')}
              className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-medium transition-all duration-200 ${
                viewMode === 'guide'
                  ? 'bg-monokai-accent text-monokai-purple border border-monokai-accent'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              AI Skills
            </button>
            <button
              onClick={() => setViewMode('browse')}
              className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-medium transition-all duration-200 ${
                viewMode === 'browse'
                  ? 'bg-monokai-accent text-monokai-blue border border-monokai-accent'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <Library className="w-3.5 h-3.5" />
              技能方案
            </button>
          </div>

          <div className="ml-auto flex items-center gap-3">
             <div className="flex items-center gap-1.5 px-2 py-1 bg-monokai-bg border border-monokai-accent">
                <div className="w-1.5 h-1.5 bg-monokai-green animate-pulse" />
                <span className="text-[10px] text-monokai-comment font-mono">DUCKDB READY</span>
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
            <DuckDBGuide className="" />
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
