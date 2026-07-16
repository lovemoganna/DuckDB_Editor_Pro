/**
 * ThinkingDisplay — Live AI thinking pipeline display
 *
 * Shows each phase of the skill execution pipeline with status indicators,
 * connecting lines, and a streaming SQL output for the final phase.
 */

import React from 'react';
import {
  Brain,
  Search,
  Zap,
  Code2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Circle,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { ThinkingStep, ThinkingPhase } from '../../types';

const PHASE_ICONS: Record<ThinkingPhase, React.ElementType> = {
  intent: Search,
  extract: Brain,
  skill_select: Zap,
  sql_generate: Code2,
  validating: CheckCircle2,
  executing: Zap,
  confirm: Circle,
};

const PHASE_LABELS: Record<ThinkingPhase, string> = {
  intent: '意图识别',
  extract: '参数解析',
  skill_select: '技能匹配',
  sql_generate: 'SQL 生成',
  validating: '验证 SQL',
  executing: '执行中',
  confirm: '等待确认',
};

interface ThinkingDisplayProps {
  steps: ThinkingStep[];
  streamingSql?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onCancel?: () => void;
  progress?: number;  // 0-100
  className?: string;
}

const StepIcon: React.FC<{ step: ThinkingStep }> = ({ step }) => {
  const Icon = PHASE_ICONS[step.phase];
  switch (step.status) {
    case 'done':
      return <CheckCircle2 className="w-3.5 h-3.5 text-monokai-green shrink-0" />;
    case 'error':
      return <AlertCircle className="w-3.5 h-3.5 text-monokai-red shrink-0" />;
    case 'running':
      return <Loader2 className="w-3.5 h-3.5 text-monokai-amethyst animate-spin shrink-0" />;
    case 'cancelled':
      return <X className="w-3.5 h-3.5 text-monokai-yellow shrink-0" />;
    default:
      return <Circle className="w-3 h-3 text-monokai-comment shrink-0" />;
  }
};

const StepConnector: React.FC<{ step: ThinkingStep; prevStep: ThinkingStep }> = ({
  step,
  prevStep,
}) => {
  const isActive =
    (step.status !== 'pending') || (prevStep.status === 'done') || (prevStep.status === 'running');
  return (
    <div
      className={`absolute left-[15px] -top-3 w-px h-3 ${
        isActive ? 'bg-monokai-amethyst/40' : 'bg-monokai-accent/20'
      }`}
    />
  );
};

export const ThinkingDisplay: React.FC<ThinkingDisplayProps> = ({
  steps,
  streamingSql = '',
  isCollapsed = false,
  onToggleCollapse,
  onCancel,
  progress = 0,
  className = '',
}) => {
  const activeStep = steps.find(s => s.status === 'running');
  const doneCount = steps.filter(s => s.status === 'done').length;
  const hasCancelled = steps.some(s => s.status === 'cancelled');
  const stepProgress = steps.length > 0 ? (doneCount / steps.length) * 100 : 0;
  const displayProgress = progress > 0 ? progress : stepProgress;

  // Streaming SQL step is always the last one
  const sqlStep = steps.find(s => s.phase === 'sql_generate');

  return (
    <div className={`mb-3 border border-monokai-amethyst/30 rounded-xl overflow-hidden ${className}`}>
      {/* Collapsed header / progress bar */}
      {isCollapsed ? (
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center gap-3 px-4 py-2.5 bg-monokai-sidebar/60 hover:bg-monokai-sidebar/80 transition-colors text-left"
        >
          <div className="flex items-center gap-1.5 shrink-0">
            {hasCancelled ? (
              <X className="w-3.5 h-3.5 text-monokai-yellow" />
            ) : activeStep ? (
              <Loader2 className="w-3.5 h-3.5 text-monokai-amethyst animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-monokai-green" />
            )}
            <span className="text-xs text-monokai-comment">
              {hasCancelled
                ? '已取消'
                : activeStep
                ? `${PHASE_LABELS[activeStep.phase]}...`
                : `${doneCount}/${steps.length} 步完成${steps.some(s => s.endTime) ? ' · ' + (() => {
                    const totalMs = steps.reduce((acc, s) => acc + ((s.endTime ?? Date.now()) - (s.startTime ?? 0)), 0);
                    return totalMs >= 1000 ? `${(totalMs / 1000).toFixed(1)}s` : `${totalMs}ms`;
                  })() : ''}`}
            </span>
          </div>
          {/* Mini progress bar */}
          <div className="flex-1 h-1 bg-monokai-accent/20 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                hasCancelled ? 'bg-monokai-yellow' : 'bg-monokai-amethyst'
              }`}
              style={{ width: `${displayProgress}%` }}
            />
          </div>
          {onCancel && activeStep && !hasCancelled && (
            <button
              onClick={(e) => { e.stopPropagation(); onCancel(); }}
              className="p-1 rounded hover:bg-monokai-red/20 transition-colors shrink-0"
              title="取消执行"
            >
              <X className="w-3.5 h-3.5 text-monokai-red" />
            </button>
          )}
          <ChevronUp className="w-3.5 h-3.5 text-monokai-comment shrink-0" />
        </button>
      ) : (
        <>
          {/* Expanded header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-monokai-sidebar/60 border-b border-monokai-amethyst/20">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {hasCancelled ? (
                  <X className="w-3.5 h-3.5 text-monokai-yellow" />
                ) : activeStep ? (
                  <Loader2 className="w-3.5 h-3.5 text-monokai-amethyst animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-monokai-green" />
                )}
                <span className="text-xs font-medium text-monokai-amethyst font-sans">
                  {hasCancelled
                    ? '已取消'
                    : activeStep
                    ? `${PHASE_LABELS[activeStep.phase]}...`
                    : '思考过程'}
                </span>
              </div>
              {/* Progress bar */}
              <div className="flex-1 max-w-[120px] h-1.5 bg-monokai-accent/20 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    hasCancelled ? 'bg-monokai-yellow' : 'bg-monokai-amethyst'
                  }`}
                  style={{ width: `${displayProgress}%` }}
                />
              </div>
              <span className="text-[10px] text-monokai-comment font-mono">
                {Math.round(displayProgress)}%
              </span>
            </div>
            <div className="flex items-center gap-1">
              {onCancel && activeStep && !hasCancelled && (
                <button
                  onClick={onCancel}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono border border-monokai-red/40 text-monokai-red hover:bg-monokai-red/10 rounded transition-colors"
                  title="取消执行"
                >
                  <X className="w-3 h-3" />
                  取消
                </button>
              )}
              {onToggleCollapse && (
                <button
                  onClick={onToggleCollapse}
                  className="p-1 rounded hover:bg-monokai-accent/20 transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-monokai-comment" />
                </button>
              )}
            </div>
          </div>

          {/* Step list */}
          <div className="px-4 py-3 space-y-0 bg-monokai-bg/40">
            {steps.map((step, idx) => {
              const Icon = PHASE_ICONS[step.phase];
              return (
                <div key={step.phase} className="relative flex items-start gap-3">
                  {/* Vertical connector line */}
                  {idx > 0 && <StepConnector step={step} prevStep={steps[idx - 1]} />}

                  {/* Icon bubble */}
                  <div
                    className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      step.status === 'done'
                        ? 'bg-monokai-green/10'
                        : step.status === 'running'
                        ? 'bg-monokai-amethyst/10'
                        : step.status === 'error'
                        ? 'bg-monokai-red/10'
                        : step.status === 'cancelled'
                        ? 'bg-monokai-yellow/10'
                        : 'bg-monokai-accent/10'
                    }`}
                  >
                    <StepIcon step={step} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs font-medium font-sans ${
                          step.status === 'done'
                            ? 'text-monokai-green'
                            : step.status === 'running'
                            ? 'text-monokai-amethyst'
                            : step.status === 'error'
                            ? 'text-monokai-red'
                            : step.status === 'cancelled'
                            ? 'text-monokai-yellow'
                            : 'text-monokai-comment'
                        }`}
                      >
                        {PHASE_LABELS[step.phase]}
                      </span>
                      {step.status === 'running' && (
                        <span className="text-[10px] text-monokai-amethyst/70 font-sans animate-pulse">
                          进行中...
                        </span>
                      )}
                      {step.status === 'done' && step.endTime && step.startTime && (
                        <span className="text-[9px] text-monokai-comment/50 font-sans px-1 py-0.5 bg-monokai-accent/10 rounded">
                          {(() => {
                            const ms = step.endTime! - step.startTime!;
                            return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
                          })()}
                        </span>
                      )}
                      {step.status === 'error' && (
                        <span className="text-[10px] text-monokai-red/70 font-sans">失败</span>
                      )}
                      {step.status === 'cancelled' && (
                        <span className="text-[10px] text-monokai-yellow/70 font-sans">已取消</span>
                      )}
                    </div>

                    {/* Step content — show up to 3 lines without truncation */}
                    {step.content && step.phase !== 'sql_generate' && (
                      <div className="mt-1 space-y-0.5">
                        {step.content.split('\n').slice(0, 4).map((line, li) => (
                          <p
                            key={li}
                            className="text-[10px] text-monokai-comment font-sans leading-relaxed"
                          >
                            {line.length > 120 ? line.slice(0, 120) + '...' : line}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Streaming SQL output */}
            {(sqlStep?.status === 'running' || streamingSql) && (
              <div className="mt-2 ml-9">
                <div className="text-[10px] text-monokai-comment/70 mb-1 font-sans flex items-center gap-1">
                  <Code2 className="w-3 h-3" />
                  输出
                </div>
                <pre className="text-[10px] font-mono text-monokai-fg bg-monokai-sidebar/80 rounded-lg p-2.5 overflow-x-auto max-h-40 leading-relaxed whitespace-pre-wrap break-all">
                  {streamingSql}
                  {sqlStep?.status === 'running' && (
                    <span className="inline-block w-2 h-3.5 bg-monokai-amethyst ml-0.5 animate-pulse align-middle" />
                  )}
                </pre>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ThinkingDisplay;
