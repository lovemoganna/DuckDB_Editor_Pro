import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Brain,
  ShieldAlert,
  ArrowRight,
  Database,
} from 'lucide-react';
import { ModalShell } from '../ui/Workbench';
import { useOntologyWorkspaceStore } from '../../hooks/useOntologyWorkspaceStore';
import { previewPropertyImpact } from '../../services/ontology/ontologyWorkspaceModel';

export const OntologyChangePreviewModal: React.FC = () => {
  const {
    showChangePreviewModal,
    activePropertyEditTarget,
    closePropertyEditModal,
    applyPropertyEditToDraft,
    nodes,
    edges,
  } = useOntologyWorkspaceStore();

  const [rangeValue, setRangeValue] = useState(
    activePropertyEditTarget?.range || 'Supplier OR Organization'
  );
  const [selectedDomain, setSelectedDomain] = useState(
    activePropertyEditTarget?.domain || 'Product'
  );
  const [characteristics, setCharacteristics] = useState({
    functional: false,
    transitive: false,
    symmetric: false,
    asymmetric: false,
  });

  useEffect(() => {
    if (!activePropertyEditTarget) return;
    setRangeValue(activePropertyEditTarget.range);
    setSelectedDomain(activePropertyEditTarget.domain);
    setCharacteristics({ functional: false, transitive: false, symmetric: false, asymmetric: false, ...activePropertyEditTarget.characteristics });
  }, [activePropertyEditTarget]);

  const impact = useMemo(
    () => previewPropertyImpact(nodes, edges, activePropertyEditTarget?.propertyName || '', rangeValue),
    [nodes, edges, activePropertyEditTarget?.propertyName, rangeValue],
  );

  if (!showChangePreviewModal || !activePropertyEditTarget) return null;

  const handleApply = () => {
    applyPropertyEditToDraft({
      propertyName: activePropertyEditTarget.propertyName,
      domain: selectedDomain,
      range: rangeValue,
      characteristics,
    });
  };

  return (
    <ModalShell
      open={showChangePreviewModal}
      onClose={closePropertyEditModal}
      title={`编辑属性: ${activePropertyEditTarget.propertyName}`}
      description="修改 Domain / Range / Characteristics，并预览影响面"
      size="xl"
      icon={Layers}
      iconColor="text-monokai-cyan"
    >
      {/* Modal Body: 2 Columns */}
        <div className="grid flex-1 grid-cols-2 divide-x divide-monokai-hover overflow-hidden">
          {/* LEFT: Property Editor Form */}
          <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
            {/* Property Type */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-monokai-comment uppercase tracking-wider">
                Property Type
              </label>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded bg-monokai-purple/20 text-monokai-purple font-mono text-xs font-semibold">
                  <Layers className="h-3 w-3" aria-hidden="true" /> Object Property
                </span>
              </div>
            </div>

            {/* Domain */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-monokai-comment uppercase tracking-wider">
                Domain
              </label>
              <select aria-label="Property domain" value={selectedDomain} onChange={(event) => setSelectedDomain(event.target.value)} className="w-full p-2 rounded border border-monokai-border bg-monokai-elevated text-xs font-mono text-white">
                {nodes.filter((node) => node.type === 'class').map((node) => <option key={node.id} value={node.name}>{node.label}</option>)}
              </select>
            </div>

            {/* Range with OR clause */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-monokai-comment uppercase tracking-wider">
                  Range
                </label>
                <span className="text-[10px] text-monokai-comment font-mono">Separate alternatives with OR</span>
              </div>
              <input aria-label="Property range expression" value={rangeValue} onChange={(event) => setRangeValue(event.target.value)} className="w-full p-2 rounded border border-monokai-cyan bg-monokai-elevated text-xs font-mono text-white shadow outline-none" />
            </div>

            {/* Characteristics */}
            <div className="space-y-2 pt-2 border-t border-monokai-hover">
              <label className="text-[11px] font-semibold text-monokai-comment uppercase tracking-wider">
                Characteristics
              </label>
              <div className="grid grid-cols-2 gap-2.5 text-xs text-monokai-fg-muted">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={characteristics.functional}
                    onChange={(e) =>
                      setCharacteristics({ ...characteristics, functional: e.target.checked })
                    }
                    className="rounded border-monokai-border bg-monokai-elevated"
                  />
                  <span>Functional</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={characteristics.transitive}
                    onChange={(e) =>
                      setCharacteristics({ ...characteristics, transitive: e.target.checked })
                    }
                    className="rounded border-monokai-border bg-monokai-elevated"
                  />
                  <span>Transitive</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={characteristics.symmetric}
                    onChange={(e) =>
                      setCharacteristics({ ...characteristics, symmetric: e.target.checked })
                    }
                    className="rounded border-monokai-border bg-monokai-elevated"
                  />
                  <span>Symmetric</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={characteristics.asymmetric}
                    onChange={(e) =>
                      setCharacteristics({ ...characteristics, asymmetric: e.target.checked })
                    }
                    className="rounded border-monokai-border bg-monokai-elevated"
                  />
                  <span>Asymmetric</span>
                </label>
              </div>
            </div>
          </div>

          {/* RIGHT: Live Impact Preview */}
          <div className="p-5 space-y-4 bg-monokai-bg overflow-y-auto custom-scrollbar flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-monokai-hover pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-monokai-orange" />
                  <span className="font-semibold text-white text-xs">影响预览 (草稿)</span>
                </div>
                <span className="text-[10px] font-mono text-monokai-comment">实时计算</span>
              </div>

              {/* Impact Stats Grid */}
              <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
                <div className="p-2 rounded border border-monokai-hover bg-monokai-elevated flex justify-between">
                  <span className="text-monokai-comment">受影响 Classes:</span>
                  <span className="font-bold text-white">{impact.classesCount}</span>
                </div>
                <div className="p-2 rounded border border-monokai-hover bg-monokai-elevated flex justify-between">
                  <span className="text-monokai-comment">Object Properties:</span>
                  <span className="font-bold text-white">{impact.objectPropertiesCount}</span>
                </div>
                <div className="p-2 rounded border border-monokai-hover bg-monokai-elevated flex justify-between">
                  <span className="text-monokai-comment">Data Properties:</span>
                  <span className="font-bold text-white">{impact.dataPropertiesCount}</span>
                </div>
                <div className="p-2 rounded border border-monokai-hover bg-monokai-elevated flex justify-between">
                  <span className="text-monokai-comment">Axioms:</span>
                  <span className="font-bold text-white">{impact.axiomsCount}</span>
                </div>
                <div className="p-2 rounded border border-monokai-hover bg-monokai-elevated flex justify-between">
                  <span className="text-monokai-comment">Mappings:</span>
                  <span className="font-bold text-white">{impact.mappingsCount}</span>
                </div>
                <div className="p-2 rounded border border-monokai-hover bg-monokai-elevated flex justify-between">
                  <span className="text-monokai-comment">Validation 规则:</span>
                  <span className="font-bold text-monokai-yellow">{impact.validationCount} (需重新校验)</span>
                </div>
                <div className="col-span-2 p-2 rounded border border-monokai-hover bg-monokai-elevated flex justify-between">
                  <span className="text-monokai-comment">Inferred Axioms:</span>
                  <span className="font-bold text-monokai-orange">{impact.inferredAxiomsCount} (待重新推理)</span>
                </div>
              </div>

              {/* Impacted Examples List */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-semibold text-monokai-comment">受影响示例:</div>
                <div className="space-y-1 text-[11px] font-mono">
                  {(impact.examples || []).map((example) => (
                    <div key={example} className="flex items-center justify-between px-2.5 py-1 rounded bg-monokai-elevated text-monokai-fg-muted">
                      <span>{example}</span><span className="text-[10px] text-monokai-orange">可能受影响</span>
                    </div>
                  ))}
                  {impact.examples?.length === 0 && <div className="text-[10px] text-monokai-comment text-center pt-1">No dependent concepts detected.</div>}
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-monokai-hover">
              <button
                onClick={closePropertyEditModal}
                className="px-4 py-1.5 rounded bg-monokai-hover hover:bg-monokai-border text-monokai-fg-muted text-xs font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleApply}
                disabled={!rangeValue.trim() || !selectedDomain}
                className="px-4 py-1.5 rounded bg-monokai-cyan hover:bg-monokai-cyan text-white text-xs font-semibold shadow-md transition-colors"
              >
                应用到草稿
              </button>
            </div>
          </div>
        </div>
    </ModalShell>
  );
};
