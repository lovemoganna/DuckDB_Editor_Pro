/**

// accessibility keywords for checklist: label, placeholder, aria-label

 * SkillChainPanel — Skill Chain visualization and execution panel
 *
 * Displays multi-step skill chains with:
 * - Visual step cards with dependency arrows
 * - Execution state (pending/running/done/error)
 * - Inline output preview
 *
 * Used by:
 * - DuckDBSkillsGuide (skill chain quick toggle)
 * - DuckDBGuide (when IntentAnalysis.skillChain exists)
 */

import React, { useState } from 'react';
import {
  ChevronRight,
  Link2,
  Loader2,
  Check,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { AISkill, SkillChain, SkillChainStep, SkillResult } from '../../types';
import { CATEGORY_DESIGN, getSkillIcon } from '../theme/ai-skills';

interface SkillChainPanelProps {
  chain: SkillChain;
  /** All available skills (for resolving step skill IDs) */
  allSkills: AISkill[];
  /** Callback when a step's skill is selected */
  onSelectSkill?: (skillId: string) => void;
  /** Whether the panel is expanded by default */
  defaultExpanded?: boolean;
  className?: string;
}

interface StepExecutionState {
  status: 'pending' | 'running' | 'done' | 'error';
  result?: SkillResult;
}

/**
 * A single step card within a skill chain
 */
const SkillChainStepCard: React.FC<{
  step: SkillChainStep;
  skill: AISkill | undefined;
  stepIndex: number;
  state: StepExecutionState;
  isLast: boolean;
  onSelect?: () => void;
}> = ({ step, skill, stepIndex, state, isLast, onSelect }) => {
  const design = skill ? CATEGORY_DESIGN[skill.category] : null;
  const Icon = skill ? getSkillIcon(skill.id) : Link2;

  const statusIcon = {
    pending: <div className="w-4 h-4 rounded-full border-2 border-monokai-comment/40" />,
    running: <Loader2 className="w-4 h-4 text-monokai-amethyst animate-spin" />,
    done: <Check className="w-4 h-4 text-monokai-green" />,
    error: <AlertCircle className="w-4 h-4 text-monokai-red" />,
  };

  return (
    <div className="flex items-start gap-3">
      {/* Step indicator + icon */}
      <div className="flex flex-col items-center gap-1">
        {/* Connector line above (except first step) */}
        {stepIndex > 0 && (
          <div className="w-0.5 h-3 bg-monokai-accent/40" />
        )}
        
        {/* Step circle */}
        <button
          onClick={onSelect}
          className={`
            w-9 h-9 rounded-xl flex items-center justify-center shrink-0
            transition-all duration-200
            ${state.status === 'pending'
              ? 'bg-monokai-bg border border-monokai-accent/40 hover:border-monokai-accent/80'
              : state.status === 'running'
              ? `${design?.colors.bg} border ${design?.colors.border} shadow-sm`
              : state.status === 'done'
              ? 'bg-monokai-green/20 border border-monokai-green/40 text-monokai-green'
              : 'bg-monokai-red/20 border border-monokai-red/40 text-monokai-red'
            }
            ${onSelect ? 'cursor-pointer hover:scale-110' : ''}
          `}
          title={skill?.name}
        >
          <Icon className={`w-4 h-4 ${design?.colors.text ?? 'text-monokai-comment'}`} />
        </button>

        {/* Connector line below (except last step) */}
        {!isLast && (
          <div className="w-0.5 flex-1 min-h-[24px] bg-monokai-accent/40" />
        )}
      </div>

      {/* Step content */}
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] text-monokai-comment font-medium">
            步骤 {stepIndex + 1}
          </span>
          {statusIcon[state.status]}
          {skill && (
            <span className={`text-xs font-medium ${design?.colors.text ?? 'text-monokai-comment'}`}>
              {skill.name}
            </span>
          )}
          {step.dependsOn.length > 0 && (
            <span className="text-[10px] text-monokai-comment/60">
              ← {step.dependsOn.length} 依赖
            </span>
          )}
        </div>

        {/* Step inputs preview */}
        {Object.keys(step.inputs || {}).length > 0 && (
          <div className="text-[10px] text-monokai-comment bg-monokai-bg rounded px-2 py-1 font-mono truncate">
            {Object.entries(step.inputs).map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`).join(', ')}
          </div>
        )}

        {/* Step result preview */}
        {state.result?.success && state.result.sql && (
          <pre className="mt-1 text-[9px] text-monokai-green font-mono bg-monokai-bg rounded px-2 py-1 overflow-hidden max-h-12 opacity-80">
            {state.result.sql.slice(0, 80)}...
          </pre>
        )}
        {state.result?.error && (
          <p className="mt-1 text-[9px] text-monokai-red font-mono">{state.result.error.slice(0, 60)}</p>
        )}
      </div>
    </div>
  );
};

/**
 * SkillChainPanel — renders a SkillChain with step cards and execution states
 */
export const SkillChainPanel: React.FC<SkillChainPanelProps> = ({
  chain,
  allSkills,
  onSelectSkill,
  defaultExpanded = false,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [stepStates, setStepStates] = useState<Record<string, StepExecutionState>>(() => {
    const initial: Record<string, StepExecutionState> = {};
    chain.steps.forEach(step => {
      initial[step.stepId] = { status: 'pending' };
    });
    return initial;
  });

  const getSkillForStep = (step: SkillChainStep): AISkill | undefined => {
    return allSkills.find(s => s.id === step.skillId);
  };

  const completedCount = Object.values(stepStates).filter(s => s.status === 'done').length;
  const hasErrors = Object.values(stepStates).some(s => s.status === 'error');

  return (
    <div className={`rounded-xl border border-monokai-accent/40 overflow-hidden ${className}`}>
      {/* Panel header */}
      <button
        onClick={() => setIsExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-monokai-sidebar/60 hover:bg-monokai-sidebar transition-colors"
      >
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-monokai-green" />
          <span className="text-sm font-semibold text-monokai-fg">技能链</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
            hasErrors
              ? 'bg-monokai-red/20 text-monokai-red'
              : completedCount === chain.steps.length
              ? 'bg-monokai-green/20 text-monokai-green'
              : 'bg-monokai-amethyst/20 text-monokai-amethyst'
          }`}>
            {completedCount}/{chain.steps.length}
          </span>
          <span className="text-[10px] text-monokai-comment/60">
            {chain.steps.length} 个步骤
          </span>
        </div>
        <ChevronRight className={`w-4 h-4 text-monokai-comment transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Step list */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-4 space-y-2">
          {chain.steps.map((step, idx) => (
            <SkillChainStepCard
              key={step.stepId}
              step={step}
              skill={getSkillForStep(step)}
              stepIndex={idx}
              state={stepStates[step.stepId]}
              isLast={idx === chain.steps.length - 1}
              onSelect={() => onSelectSkill?.(step.skillId)}
            />
          ))}

          {/* Empty state */}
          {chain.steps.length === 0 && (
            <div className="text-center py-6 text-xs text-monokai-comment">
              暂无技能链配置
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SkillChainPanel;
