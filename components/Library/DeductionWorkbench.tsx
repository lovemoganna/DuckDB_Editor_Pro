import React, { useEffect, useMemo, useState } from 'react';
import { Layers, RotateCcw, X } from 'lucide-react';
import { useOntologyStore } from '../../hooks/useOntologyStore';
import type { RuleDefinition } from '../../services/ontology/ontologyInferenceEngine';
import { ontologyInferenceModule } from '../../services/ontology/ontologyInferenceModule';
import {
  ontologyReasoningModule,
  type OntologyProjectionSource,
  type OntologyReasoningCatalog,
} from '../../services/ontology/ontologyReasoningModule';
import { OntologyCombinationExplorer } from './OntologyCombinationExplorer';
import { IconButton } from '../ui/Workbench';

export interface DeductionWorkbenchProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const EMPTY_CATALOG: OntologyReasoningCatalog = {
  propertyDefinitions: [],
  rules: [],
  actionDefinitions: [],
};

export const DeductionWorkbench: React.FC<DeductionWorkbenchProps> = ({
  isOpen = true,
  onClose,
}) => {
  const { state, activeTemplateId } = useOntologyStore();
  const source = useMemo<OntologyProjectionSource>(() => ({
    ...state,
    activeTemplateId: state.activeTemplateId ?? activeTemplateId,
  }), [activeTemplateId, state]);

  const [catalog, setCatalog] = useState<OntologyReasoningCatalog>(EMPTY_CATALOG);
  const [rules, setRules] = useState<RuleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        await ontologyReasoningModule.initialize();
        const loadedCatalog = await ontologyReasoningModule.loadCatalog();
        await ontologyInferenceModule.initialize();
        const workspace = await ontologyInferenceModule.loadWorkspace();

        if (!alive) return;
        setCatalog(loadedCatalog);
        setRules(workspace.rules);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [source]);

  if (!isOpen) return null;

  return (
    <section aria-label="Ontology 特征组合探索与推演" className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-monokai-bg text-monokai-fg">
      {/* Master Top Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-monokai-border bg-monokai-sidebar px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-monokai-accent/15 text-monokai-accent">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-monokai-fg">
              特征组合探索与推演 · Ontology Combination Explorer
            </h1>
            <p className="text-xs text-monokai-comment">
              基于真实拓扑挑选特征组合，自动溯源依据并一键下推至 DuckDB SQL 验证。
            </p>
          </div>
        </div>

        {onClose && (
          <IconButton
            icon={X}
            label="关闭特征组合探索"
            onClick={onClose}
          />
        )}
      </header>

      {/* Main Body Content */}
      <main className="min-h-0 flex-1 overflow-hidden p-4">
        {error && (
          <div role="alert" className="mb-3 rounded-lg bg-monokai-danger/10 border border-monokai-danger/20 p-3 text-xs text-monokai-danger">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-monokai-comment">
            <RotateCcw className="mr-2 h-4 w-4 animate-spin text-monokai-info" />
            正在载入 Ontology 快照与特征模型...
          </div>
        ) : (
          <div className="h-full overflow-hidden">
            <OntologyCombinationExplorer
              source={source}
              catalog={catalog}
              rules={rules}
            />
          </div>
        )}
      </main>
    </section>
  );
};

export default DeductionWorkbench;
