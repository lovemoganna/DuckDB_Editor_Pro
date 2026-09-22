import React, { useState } from 'react';
import {
  GitCompare,
  Plus,
  Edit2,
  Trash2,
  Layers,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useOntologyWorkspaceStore } from '../../hooks/useOntologyWorkspaceStore';
import { DraftChange } from '../../types/ontologyWorkspace';

export const OntologyDiffView: React.FC = () => {
  const {
    versionDiff,
    openPropertyEditModal,
    setSelectedDrawerTab,
  } = useOntologyWorkspaceStore();

  const [selectedChangeId, setSelectedChangeId] = useState(
    versionDiff.changes[2]?.id || versionDiff.changes[0]?.id
  );

  const activeChange =
    versionDiff.changes.find((c) => c.id === selectedChangeId) || versionDiff.changes[0];

  const addedChanges = versionDiff.changes.filter((c) => c.type === 'added');
  const modifiedChanges = versionDiff.changes.filter((c) => c.type === 'modified');
  const removedChanges = versionDiff.changes.filter((c) => c.type === 'removed');

  return (
    <div className="flex-1 overflow-hidden bg-monokai-bg flex flex-col font-sans select-none">
      {/* Diff Header Bar */}
      <div className="flex h-11 items-center justify-between border-b border-monokai-border bg-monokai-bg px-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-monokai-cyan" />
            <span className="font-bold text-white text-xs">DIFF MODE:</span>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <span className="text-monokai-comment">Base Version:</span>
            <span className="px-2.5 py-0.5 rounded bg-monokai-elevated border border-monokai-border text-white">
              {versionDiff.baseVersion}
            </span>
            <span className="text-monokai-comment">&rarr;</span>
            <span className="text-monokai-comment">Compare Version:</span>
            <span className="px-2.5 py-0.5 rounded bg-monokai-elevated border border-monokai-cyan text-monokai-cyan font-semibold">
              {versionDiff.compareVersion}
            </span>
          </div>
        </div>

        <span className="text-[10.5px] font-mono text-monokai-accent bg-monokai-accent/15 px-2.5 py-0.5 rounded">
          {versionDiff.changes.length} Total Changes
        </span>
      </div>

      {/* Main Diff Split: Changes Tree (Left) + Change Details & Impact (Right) */}
      <div className="flex-1 grid grid-cols-3 divide-x divide-[var(--monokai-border)] overflow-hidden">
        {/* LEFT COLUMN: Changes Breakdown List */}
        <div className="p-4 space-y-4 bg-monokai-bg overflow-y-auto custom-scrollbar">
          {/* 1. Added */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-monokai-accent">
              <Plus className="h-3.5 w-3.5" />
              <span>Added ({addedChanges.length})</span>
            </div>
            <div className="space-y-1">
              {addedChanges.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedChangeId(c.id)}
                  className={`p-2 rounded border text-xs font-mono transition-all cursor-pointer ${
                    selectedChangeId === c.id
                      ? 'border-monokai-accent bg-monokai-accent/15 text-white shadow'
                      : 'border-monokai-hover bg-monokai-elevated text-monokai-fg-muted hover:bg-monokai-hover'
                  }`}
                >
                  <div className="font-semibold text-white">{c.entityName}</div>
                  <div className="text-[10px] text-monokai-comment mt-0.5 truncate">{c.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Modified */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-monokai-orange">
              <Edit2 className="h-3.5 w-3.5" />
              <span>Modified ({modifiedChanges.length})</span>
            </div>
            <div className="space-y-1">
              {modifiedChanges.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedChangeId(c.id)}
                  className={`p-2 rounded border text-xs font-mono transition-all cursor-pointer ${
                    selectedChangeId === c.id
                      ? 'border-monokai-orange bg-monokai-orange/15 text-white shadow'
                      : 'border-monokai-hover bg-monokai-elevated text-monokai-fg-muted hover:bg-monokai-hover'
                  }`}
                >
                  <div className="font-semibold text-white">{c.entityName}</div>
                  <div className="text-[10px] text-monokai-comment mt-0.5 truncate">{c.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Removed */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-monokai-pink">
              <Trash2 className="h-3.5 w-3.5" />
              <span>Removed ({removedChanges.length})</span>
            </div>
            <div className="space-y-1">
              {removedChanges.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedChangeId(c.id)}
                  className={`p-2 rounded border text-xs font-mono transition-all cursor-pointer ${
                    selectedChangeId === c.id
                      ? 'border-monokai-pink bg-monokai-pink/15 text-white shadow'
                      : 'border-monokai-hover bg-monokai-elevated text-monokai-fg-muted hover:bg-monokai-hover'
                  }`}
                >
                  <div className="font-semibold text-white">{c.entityName}</div>
                  <div className="text-[10px] text-monokai-comment mt-0.5 truncate">{c.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT 2 COLUMNS: Selected Change Details & Impact Preview */}
        <div className="col-span-2 p-6 flex flex-col justify-between overflow-y-auto custom-scrollbar">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-monokai-hover pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white font-mono">
                    {activeChange.entityName}
                  </span>
                  <span
                    className={`text-[10.5px] px-2 py-0.5 rounded font-mono font-semibold ${
                      activeChange.type === 'added'
                        ? 'bg-monokai-accent/20 text-monokai-accent'
                        : activeChange.type === 'modified'
                        ? 'bg-monokai-yellow/20 text-monokai-yellow'
                        : 'bg-monokai-pink/20 text-monokai-pink'
                    }`}
                  >
                    {activeChange.type.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-monokai-comment mt-1 font-mono">{activeChange.description}</p>
              </div>

              <button
                onClick={() => openPropertyEditModal(activeChange.entityName)}
                className="flex items-center gap-1 px-3 py-1.5 rounded bg-monokai-cyan hover:bg-monokai-cyan text-white text-xs font-medium shadow transition-colors"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Edit Change</span>
              </button>
            </div>

            {/* Impact Preview Metrics */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-monokai-comment">
                Impact Preview
              </h4>
              <div className="grid grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg border border-monokai-hover bg-monokai-elevated">
                  <div className="text-monokai-comment text-[11px]">Classes affected</div>
                  <div className="text-base font-bold text-white mt-1">
                    {activeChange.impact.classesCount}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-monokai-hover bg-monokai-elevated">
                  <div className="text-monokai-comment text-[11px]">Inferred axioms</div>
                  <div className="text-base font-bold text-monokai-orange mt-1">
                    {activeChange.impact.inferredAxiomsCount}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-monokai-hover bg-monokai-elevated">
                  <div className="text-monokai-comment text-[11px]">Mappings</div>
                  <div className="text-base font-bold text-monokai-cyan mt-1">
                    {activeChange.impact.mappingsCount}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-monokai-hover bg-monokai-elevated">
                  <div className="text-monokai-comment text-[11px]">Validation rules</div>
                  <div className="text-base font-bold text-monokai-yellow mt-1">
                    {activeChange.impact.validationCount}
                  </div>
                </div>
              </div>
            </div>

            {/* Change Diff Inspection */}
            {activeChange.beforeValue && activeChange.afterValue && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-monokai-comment">
                  Before vs After
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg border border-monokai-pink/30 bg-monokai-pink/10">
                    <div className="text-monokai-pink font-bold text-[11px] mb-1">Before (v0.8)</div>
                    <div className="text-monokai-fg-muted">{activeChange.beforeValue}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-monokai-accent/30 bg-monokai-accent/10">
                    <div className="text-monokai-accent font-bold text-[11px] mb-1">After (v0.9)</div>
                    <div className="text-monokai-fg-muted">{activeChange.afterValue}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-monokai-hover flex items-center justify-between text-xs text-monokai-comment">
            <span>Author: {activeChange.author} · Time: {activeChange.time}</span>
            <button
              onClick={() => setSelectedDrawerTab('changes')}
              className="text-monokai-cyan hover:underline"
            >
              View Full Change Log in Drawer &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
