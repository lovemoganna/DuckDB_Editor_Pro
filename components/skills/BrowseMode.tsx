/**
 * BrowseMode - Tactical Command Center Layout
 *
 * 3-column layout:
 * 1. SkillList (Catalog)
 * 2. SkillInvoker (Parameters)
 * 3. SqlPreview / Execution Results (Output)
 *
 * All state consumed from SkillContext — no prop drilling.
 */

import React, { lazy, Suspense, useState } from 'react';
import { Sparkles, Terminal, Zap } from 'lucide-react';
import { SqlPreview } from '../SqlPreview';
import { SkillList } from './SkillList';
import { useSkillContext } from './context/SkillContext';
import { PipelineBuilder } from './PipelineBuilder';
import { ResizablePanel } from '../ui/ResizablePanel';

const SkillInvoker = lazy(() => import('./SkillInvoker').then(m => ({ default: m.default })));

interface BrowseModeProps {
  onExecuteSql?: (sql: string) => void;
}

// 中间列默认宽度
const DEFAULT_MIDDLE_WIDTH = 600;
const MIN_MIDDLE_WIDTH = 280;
const MAX_MIDDLE_WIDTH = 900;

export const BrowseMode: React.FC<BrowseModeProps> = ({ onExecuteSql }) => {
  // 中间列宽度状态（支持拖拽调整）
  const [middleWidth, setMiddleWidth] = useState(DEFAULT_MIDDLE_WIDTH);

  const {
    selectedSkill, browseResult,
    isExecuting, setIsExecuting,
    setBrowseResult,
    currentTable, currentColumns,
    searchQuery, setSearchQuery,
    selectedCategory, setSelectedCategory,
    filteredSkills, skillsByCategory,
    expandedCategories, toggleCategory,
    sortOrder, setSortOrder,
    setSelectedSkill,
    showImportModal, setShowImportModal,
    isPipelineMode,
  } = useSkillContext();

  return (
    <div className="skill-browser flex h-full w-full bg-monokai-bg text-monokai-fg overflow-hidden">
      {/* Column 1: Skill List (Catalog) */}
      <div className="skill-catalog w-[280px] flex-shrink-0 border-r border-monokai-border bg-monokai-sidebar">
        <SkillList
          currentTable={currentTable}
          onShowImportModal={() => setShowImportModal(true)}
          onSkillSelect={setSelectedSkill}
        />
      </div>

      {isPipelineMode ? (
        <PipelineBuilder currentTable={currentTable} currentColumns={currentColumns} />
      ) : (
        <>
          {/* Column 2: Parameters (SkillInvoker) - 可拖拽调整宽度 */}
          <ResizablePanel
            defaultWidth={DEFAULT_MIDDLE_WIDTH}
            minWidth={MIN_MIDDLE_WIDTH}
            maxWidth={MAX_MIDDLE_WIDTH}
            bgColor="var(--monokai-bg)"
            className="skill-parameters flex-shrink-0"
            onWidthChange={setMiddleWidth}
          >
            {selectedSkill ? (
              <div className="h-full flex flex-col">
                <Suspense fallback={
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 rounded-lg border border-monokai-border flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-monokai-fg-muted" />
                      </div>
                      <span className="text-xs text-monokai-comment">加载执行单元...</span>
                    </div>
                  </div>
                }>
                  <SkillInvoker
                    skill={selectedSkill}
                    currentTable={currentTable}
                    currentColumns={currentColumns}
                    onExecute={setBrowseResult}
                    isExecuting={isExecuting}
                    setIsExecuting={setIsExecuting}
                  />
                </Suspense>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8">
                {/* Empty state illustration */}
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-monokai-surface border border-monokai-border flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-monokai-amethyst opacity-60" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg bg-monokai-elevated border border-monokai-border flex items-center justify-center">
                    <Zap className="w-4 h-4 text-monokai-yellow" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-monokai-fg mb-2">等待选择技能</h3>
                <p className="text-xs text-monokai-comment text-center max-w-[200px]">
                  请从左侧选择一个 AI 技能以开始生成 SQL
                </p>
              </div>
            )}
          </ResizablePanel>

          {/* Column 3: Output (SqlPreview) */}
          <div className="skill-output flex-1 flex flex-col bg-monokai-bg min-w-0">
            {/* Output header */}
            <div className="h-12 bg-monokai-bg border-b border-monokai-border flex items-center px-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-monokai-surface border border-monokai-border flex items-center justify-center">
                  <Terminal className="w-4 h-4 text-monokai-green" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-monokai-fg">输出终端</span>
                  <span className="text-[9px] text-monokai-comment ml-2">OUTPUT_TERMINAL</span>
                </div>
              </div>
              {browseResult && (
                <div className="ml-auto flex items-center gap-2">
                  {browseResult.success ? (
                    <span className="px-2 py-1 text-[9px] rounded bg-monokai-green/10 text-monokai-green border border-monokai-green/20">
                      执行成功
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-[9px] rounded bg-monokai-red/10 text-monokai-red border border-monokai-red/20">
                      执行失败
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Output content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {browseResult ? (
                <div className="p-4">
                  <SqlPreview
                    sql={browseResult.sql || ''}
                    explanation={browseResult.explanation}
                    error={browseResult.error}
                    onExecute={onExecuteSql}
                    onClose={() => setBrowseResult(null)}
                  />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-monokai-comment">
                  {/* Terminal style empty state */}
                  <div className="font-mono text-xs opacity-50 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-monokai-green">&gt;</span>
                      <span>READY_FOR_EXECUTION</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-monokai-amethyst">&gt;</span>
                      <span className="text-monokai-comment">选择技能并配置参数...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
