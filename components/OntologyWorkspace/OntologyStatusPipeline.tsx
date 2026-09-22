import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Play,
  Brain,
  UploadCloud,
  Layers,
  Sparkles,
  GitCommit,
  ArrowRight,
  ChevronRight,
  Info,
  Clock,
} from 'lucide-react';
import { useOntologyWorkspaceStore } from '../../hooks/useOntologyWorkspaceStore';

export const OntologyStatusPipeline: React.FC = () => {
  const {
    statePipeline,
    runValidation,
    runReasoning,
    publishDraft,
    setSelectedDrawerTab,
    openPropertyEditModal,
    validationIssues,
    reasoningReport,
    draftChanges,
    publishing,
  } = useOntologyWorkspaceStore();

  const [showFlowDetails, setShowFlowDetails] = useState(false);

  return (
    <div className="flex flex-col border-t border-monokai-border bg-monokai-bg font-sans text-xs select-none">
      {/* 1. Optional 4-Phase Stepper Cards Drawer */}
      {showFlowDetails && (
        <div className="grid grid-cols-4 gap-3 p-3 bg-monokai-bg border-b border-monokai-border overflow-x-auto custom-scrollbar animate-in slide-in-from-bottom-2 duration-150">
          {/* Card 1: Change Preview */}
          <div className="p-3 rounded-lg border border-monokai-border bg-monokai-elevated space-y-2">
            <div className="flex items-center justify-between font-mono">
              <span className="font-bold text-monokai-cyan text-[11px]">(1) CHANGE PREVIEW</span>
              <span className="text-[10px] text-monokai-orange font-bold">Draft</span>
            </div>
            <div className="text-[10.5px] text-monokai-comment">
              {draftChanges[0] ? <>Latest change: <strong className="text-white">{draftChanges[0].entityName}</strong> &rarr; {draftChanges[0].description}</> : 'No active draft changes.'}
            </div>
            <div className="space-y-0.5 text-[10px] font-mono text-monokai-comment bg-monokai-bg p-2 rounded">
              <div>Changes: <strong className="text-white">{draftChanges.length}</strong></div>
              <div>Validation errors: <strong className="text-monokai-pink">{statePipeline.validationErrorCount}</strong></div>
              <div>Validation warnings: <strong className="text-monokai-yellow">{statePipeline.validationWarningCount}</strong></div>
              <div>Reasoning: <strong className="text-monokai-orange">{statePipeline.reasoningStatus}</strong></div>
            </div>
            <div className="flex gap-1.5 pt-1">
              <button
                onClick={() => openPropertyEditModal('suppliedBy')}
                className="flex-1 py-1 rounded bg-monokai-cyan hover:bg-monokai-cyan text-white text-[10.5px] font-medium text-center"
              >
                Edit Range
              </button>
            </div>
          </div>

          {/* Card 2: Validation */}
          <div className="p-3 rounded-lg border border-monokai-border bg-monokai-elevated space-y-2">
            <div className="flex items-center justify-between font-mono">
              <span className="font-bold text-monokai-yellow text-[11px]">(2) VALIDATION</span>
              <span className="text-[10px] text-monokai-yellow font-bold">{statePipeline.validationStatus}</span>
            </div>
            <div className="text-[10.5px] text-monokai-comment">
              SHACL schema and property constraint validation.
            </div>
            <div className="space-y-0.5 text-[10px] font-mono text-monokai-comment bg-monokai-bg p-2 rounded">
              <div className="text-monokai-pink">Errors: {validationIssues.filter((issue) => issue.severity === 'error').length}</div>
              <div className="text-monokai-yellow">Warnings: {validationIssues.filter((issue) => issue.severity === 'warning').length}</div>
              <div className="text-monokai-cyan">Info: {validationIssues.filter((issue) => issue.severity === 'info').length}</div>
            </div>
            <div className="flex gap-1.5 pt-1">
              <button
                onClick={() => setSelectedDrawerTab('validation')}
                className="flex-1 py-1 rounded bg-monokai-hover hover:bg-monokai-border text-monokai-fg-muted text-[10.5px] font-medium text-center"
              >
                View Details
              </button>
              <button
                onClick={runValidation}
                className="flex-1 py-1 rounded bg-monokai-accent hover:bg-monokai-accent text-white text-[10.5px] font-medium text-center"
              >
                Run Check
              </button>
            </div>
          </div>

          {/* Card 3: Reasoning */}
          <div className="p-3 rounded-lg border border-monokai-border bg-monokai-elevated space-y-2">
            <div className="flex items-center justify-between font-mono">
              <span className="font-bold text-monokai-orange text-[11px]">(3) REASONING</span>
              <span className="text-[10px] text-monokai-orange font-bold">{statePipeline.reasoningStatus}</span>
            </div>
            <div className="text-[10.5px] text-monokai-comment">
              Ontology changed since last reasoning run.
            </div>
            <div className="space-y-0.5 text-[10px] font-mono text-monokai-comment bg-monokai-bg p-2 rounded">
              <div>Last run: <span className="text-white">{reasoningReport.lastRunTime || 'Never'}</span></div>
              <div>Changes since run: <strong className="text-monokai-orange">{draftChanges.length}</strong></div>
            </div>
            <div className="pt-1">
              <button
                onClick={runReasoning}
                className="w-full py-1 rounded bg-monokai-cyan hover:bg-monokai-cyan text-white text-[10.5px] font-semibold text-center"
              >
                Run Reasoner
              </button>
            </div>
          </div>

          {/* Card 4: After Reasoner */}
          <div className="p-3 rounded-lg border border-monokai-border bg-monokai-elevated space-y-2">
            <div className="flex items-center justify-between font-mono">
              <span className="font-bold text-monokai-accent text-[11px]">(4) AFTER REASONER</span>
              <span className="text-[10px] text-monokai-accent font-bold">{reasoningReport.status}</span>
            </div>
            <div className="text-[10.5px] text-monokai-comment">
              Reasoning engine completed execution.
            </div>
            <div className="space-y-0.5 text-[10px] font-mono text-monokai-comment bg-monokai-bg p-2 rounded">
              <div>Duration: <span className="text-white">{reasoningReport.duration}</span></div>
              <div className="text-monokai-accent">New inferred axioms: +{reasoningReport.newInferredCount}</div>
              <div className="text-monokai-pink">Removed inferred axioms: -{reasoningReport.removedInferredCount}</div>
              <div>Total inferred axioms: <strong className="text-white">{reasoningReport.totalInferredAxioms}</strong></div>
            </div>
            <div className="pt-1">
              <button
                onClick={() => setSelectedDrawerTab('reasoning')}
                className="w-full py-1 rounded bg-monokai-hover hover:bg-monokai-border text-monokai-fg-muted text-[10.5px] font-medium text-center"
              >
                View Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Main Status Pipeline Bar */}
      <div className="flex h-9 shrink-0 items-center justify-between px-3">
        {/* Pipeline Status Sequence */}
        <div className="flex items-center gap-3">
          {/* Model */}
          <div
            onClick={() => setShowFlowDetails(!showFlowDetails)}
            className="flex items-center gap-1.5 font-mono cursor-pointer hover:underline"
            title="Click to view 4-phase closed loop stepper cards"
          >
            <span className="h-2 w-2 rounded-full bg-monokai-orange animate-pulse" />
            <span className="text-monokai-comment">Model:</span>
            <span className="font-semibold text-monokai-orange">
              {statePipeline.modelStatus === 'modified' ? 'Modified' : 'Clean'}
            </span>
          </div>

          <span className="text-monokai-border">&rarr;</span>

          {/* Mapping */}
          <div
            onClick={() => setSelectedDrawerTab('mappings')}
            className="flex items-center gap-1.5 font-mono cursor-pointer hover:underline"
          >
            <span className="h-2 w-2 rounded-full bg-monokai-accent" />
            <span className="text-monokai-comment">Mapping:</span>
            <span className="font-semibold text-monokai-accent">
              {statePipeline.mappingStatus.replaceAll('_', ' ')}
            </span>
          </div>

          <span className="text-monokai-border">&rarr;</span>

          {/* Validation */}
          <div
            onClick={() => setSelectedDrawerTab('validation')}
            className="flex items-center gap-1.5 font-mono cursor-pointer hover:underline"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                statePipeline.validationStatus === 'warnings' ? 'bg-monokai-yellow' : statePipeline.validationStatus === 'valid' ? 'bg-monokai-accent' : statePipeline.validationStatus === 'running' ? 'bg-monokai-cyan animate-pulse' : 'bg-monokai-pink'
              }`}
            />
            <span className="text-monokai-comment">Validation:</span>
            <span
              className={`font-semibold ${
                statePipeline.validationStatus === 'warnings' ? 'text-monokai-yellow' : statePipeline.validationStatus === 'valid' ? 'text-monokai-accent' : statePipeline.validationStatus === 'running' ? 'text-monokai-cyan' : 'text-monokai-pink'
              }`}
            >
              {statePipeline.validationStatus === 'warnings' ? `${statePipeline.validationWarningCount} warnings` : statePipeline.validationStatus === 'errors' ? `${statePipeline.validationErrorCount} errors` : statePipeline.validationStatus.replaceAll('_', ' ')}
            </span>
          </div>

          <span className="text-monokai-border">&rarr;</span>

          {/* Reasoning */}
          <div
            onClick={() => setSelectedDrawerTab('reasoning')}
            className="flex items-center gap-1.5 font-mono cursor-pointer hover:underline"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                statePipeline.reasoningStatus === 'completed'
                  ? 'bg-monokai-accent'
                  : statePipeline.reasoningStatus === 'running'
                  ? 'bg-monokai-cyan animate-spin'
                  : 'bg-monokai-orange'
              }`}
            />
            <span className="text-monokai-comment">Reasoning:</span>
            <span
              className={`font-semibold ${
                statePipeline.reasoningStatus === 'completed'
                  ? 'text-monokai-accent'
                  : statePipeline.reasoningStatus === 'running'
                  ? 'text-monokai-cyan'
                  : 'text-monokai-orange'
              }`}
            >
              {statePipeline.reasoningStatus === 'completed'
                ? 'Completed'
                : statePipeline.reasoningStatus === 'running'
                ? 'Running...'
                : 'Outdated'}
            </span>
          </div>

          <span className="text-monokai-border">&rarr;</span>

          {/* Draft */}
          <div
            onClick={() => setSelectedDrawerTab('changes')}
            className="flex items-center gap-1.5 font-mono cursor-pointer hover:underline"
          >
            <span className="h-2 w-2 rounded-full bg-monokai-cyan" />
            <span className="text-monokai-comment">Draft:</span>
            <span className="font-semibold text-monokai-cyan">
              {statePipeline.draftCount > 0 ? `${statePipeline.draftCount} changes` : 'Clean'}
            </span>
          </div>
        </div>

        {/* Right Execution Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFlowDetails(!showFlowDetails)}
            className="px-2.5 py-1 rounded bg-monokai-elevated hover:bg-monokai-hover text-monokai-comment hover:text-white text-[11px] font-mono border border-monokai-border"
          >
            {showFlowDetails ? '收起闭环卡片' : '展开闭环卡片'}
          </button>

          <button
            onClick={runValidation}
            disabled={statePipeline.validationStatus === 'running'}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-monokai-hover hover:bg-monokai-border text-monokai-fg-muted text-[11px] font-medium transition-colors"
          >
            <CheckCircle2 className="h-3 w-3 text-monokai-accent" />
            <span>{statePipeline.validationStatus === 'running' ? '验证中…' : '运行验证'}</span>
          </button>

          <button
            onClick={runReasoning}
            disabled={statePipeline.reasoningStatus === 'running'}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-monokai-hover hover:bg-monokai-border text-monokai-fg-muted text-[11px] font-medium transition-colors"
          >
            <Brain className="h-3 w-3 text-monokai-cyan" />
            <span>{statePipeline.reasoningStatus === 'running' ? '推理中…' : '运行推理'}</span>
          </button>

          <button
            onClick={publishDraft}
            disabled={statePipeline.draftCount === 0 || publishing || statePipeline.validationErrorCount > 0 || !['valid', 'warnings'].includes(statePipeline.validationStatus) || statePipeline.reasoningStatus !== 'completed'}
            className="flex items-center gap-1 px-3 py-1 rounded bg-monokai-accent hover:bg-monokai-accent disabled:opacity-40 disabled:hover:bg-monokai-accent text-white text-[11px] font-semibold transition-colors shadow-sm"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            <span>{publishing ? '发布中…' : '发布模型'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
