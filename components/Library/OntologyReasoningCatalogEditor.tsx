import React, { useEffect, useMemo, useState } from 'react';
import { Save, Sparkles, BookOpen } from 'lucide-react';
import {
  ontologyInferenceModule,
  type InferenceWorkspace,
} from '../../services/ontology/ontologyInferenceModule';
import {
  ontologyReasoningModule,
  type OntologyProjectionSource,
  type OntologyReasoningCatalog,
} from '../../services/ontology/ontologyReasoningModule';
import { createOntologySituationModel } from '../../services/ontology/ontologySituationExplorer';
import { ModalShell, SegmentedTabs, ActionButton, type SegmentedTab } from '../ui/Workbench';

interface OntologyReasoningCatalogEditorProps {
  source: OntologyProjectionSource;
  onClose: () => void;
}

type DefinitionTab = 'world' | 'combination';

const DEFINITION_TABS: readonly SegmentedTab<DefinitionTab>[] = [
  { value: 'world', label: '世界变化规则', icon: BookOpen },
  { value: 'combination', label: '特征组合规则', icon: Sparkles },
];

export const OntologyReasoningCatalogEditor: React.FC<OntologyReasoningCatalogEditorProps> = ({
  source,
  onClose,
}) => {
  const [worldText, setWorldText] = useState('');
  const [combinationText, setCombinationText] = useState('');
  const [activeDefinition, setActiveDefinition] = useState<DefinitionTab>('world');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await Promise.all([
          ontologyReasoningModule.initialize(),
          ontologyInferenceModule.initialize(),
        ]);
        const [stored, inferenceWorkspace] = await Promise.all([
          ontologyReasoningModule.loadCatalog(),
          ontologyInferenceModule.loadWorkspace(),
        ]);
        const snapshot = ontologyReasoningModule.createSnapshot(source, stored);
        const nativeFeatures = snapshot.objectTypes.flatMap(objectType =>
          createOntologySituationModel(snapshot, { objectTypeId: objectType.id }).features,
        );
        const features = new Map(inferenceWorkspace.features.map(feature => [feature.id, feature]));
        nativeFeatures.forEach(feature => features.set(feature.id, feature));
        if (alive) {
          setWorldText(JSON.stringify(snapshot.catalog, null, 2));
          setCombinationText(JSON.stringify({
            ...inferenceWorkspace,
            features: [...features.values()],
          }, null, 2));
        }
      } catch (caught) {
        if (alive) setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, [source]);

  const summary = useMemo(() => {
    try {
      if (activeDefinition === 'combination') {
        const parsed = JSON.parse(combinationText) as InferenceWorkspace;
        return `${parsed.features?.length ?? 0} 特征 · ${parsed.rules?.length ?? 0} 组合规则 · ${parsed.outcomes?.length ?? 0} 目标`;
      }
      const parsed = JSON.parse(worldText) as OntologyReasoningCatalog;
      return `${parsed.propertyDefinitions?.length ?? 0} 属性 · ${parsed.rules?.length ?? 0} 变化规则 · ${parsed.actionDefinitions?.length ?? 0} 动作`;
    } catch {
      return 'JSON 尚不可解析';
    }
  }, [activeDefinition, combinationText, worldText]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const world = JSON.parse(worldText) as OntologyReasoningCatalog;
      const combination = JSON.parse(combinationText) as InferenceWorkspace;
      if (!Array.isArray(world.propertyDefinitions) || !Array.isArray(world.rules) || !Array.isArray(world.actionDefinitions)) {
        throw new Error('世界定义必须包含 propertyDefinitions、rules、actionDefinitions 三个数组');
      }
      if (!Array.isArray(combination.features) || !Array.isArray(combination.rules) || !Array.isArray(combination.outcomes)) {
        throw new Error('组合定义必须包含 features、rules、outcomes 三个数组');
      }
      const persistable: OntologyReasoningCatalog = {
        propertyDefinitions: world.propertyDefinitions.filter(item =>
          item.status === 'active' || item.status === 'archived'),
        rules: world.rules,
        actionDefinitions: world.actionDefinitions,
      };
      const issues = ontologyReasoningModule.validateModel(
        ontologyReasoningModule.createSnapshot(source, persistable),
      );
      if (issues.length > 0) throw new Error(issues.join('；'));
      await ontologyInferenceModule.validateWorkspace(combination);
      await ontologyReasoningModule.saveCatalog(persistable);
      await ontologyInferenceModule.saveWorkspace(combination);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={true}
      title="Ontology 推演定义"
      description="在 Ontology 主模块维护稳定属性、世界变化规则，以及供组合探索验证的特征规则"
      size="xl"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-monokai-comment">同一 logicalId + version 不可覆盖；修改定义时请递增版本</span>
          <div className="flex items-center gap-2.5">
            <ActionButton variant="ghost" onClick={onClose}>
              取消
            </ActionButton>
            <ActionButton
              variant="primary"
              loading={saving}
              disabled={!loaded}
              icon={Save}
              onClick={() => void save()}
            >
              校验并保存
            </ActionButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col h-[65vh] min-h-[420px] space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <SegmentedTabs<DefinitionTab>
            value={activeDefinition}
            items={DEFINITION_TABS}
            onChange={setActiveDefinition}
            aria-label="推演定义切换"
            tone="accent"
            size="sm"
          />
          <div className="text-xs font-mono font-medium text-monokai-cyan">{summary}</div>
        </div>

        {error && (
          <div role="alert" className="rounded-lg bg-monokai-pink/10 border border-monokai-pink/30 p-3 text-xs text-monokai-pink">
            {error}
          </div>
        )}

        <div className="flex-1 min-h-0 rounded-xl border border-monokai-border overflow-hidden bg-monokai-bg flex flex-col">
          {activeDefinition === 'world' ? (
            <textarea
              aria-label="Ontology 世界变化定义 JSON"
              value={worldText}
              onChange={event => setWorldText(event.target.value)}
              disabled={!loaded}
              spellCheck={false}
              className="flex-1 min-h-0 w-full resize-none p-4 font-mono text-xs leading-relaxed text-monokai-fg bg-transparent outline-none focus:ring-1 focus:ring-monokai-accent/40"
            />
          ) : (
            <textarea
              aria-label="Ontology 特征组合定义 JSON"
              value={combinationText}
              onChange={event => setCombinationText(event.target.value)}
              disabled={!loaded}
              spellCheck={false}
              className="flex-1 min-h-0 w-full resize-none p-4 font-mono text-xs leading-relaxed text-monokai-fg bg-transparent outline-none focus:ring-1 focus:ring-monokai-accent/40"
            />
          )}
        </div>
      </div>
    </ModalShell>
  );
};

export default OntologyReasoningCatalogEditor;

