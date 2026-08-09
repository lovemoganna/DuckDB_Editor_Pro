import React, { useEffect, useMemo, useState } from 'react';
import { Save, X } from 'lucide-react';
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

interface OntologyReasoningCatalogEditorProps {
  source: OntologyProjectionSource;
  onClose: () => void;
}

export const OntologyReasoningCatalogEditor: React.FC<OntologyReasoningCatalogEditorProps> = ({
  source,
  onClose,
}) => {
  const [worldText, setWorldText] = useState('');
  const [combinationText, setCombinationText] = useState('');
  const [activeDefinition, setActiveDefinition] = useState<'world' | 'combination'>('world');
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
    <div role="dialog" aria-label="推演定义编辑器" className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <section className="flex h-[min(820px,92vh)] w-[min(1040px,94vw)] flex-col overflow-hidden rounded-2xl border border-monokai-amethyst/30 bg-[#11131d] shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="font-black text-monokai-fg">Ontology 推演定义</h2>
            <p className="mt-1 text-xs text-monokai-comment">在 Ontology 主模块维护稳定属性、世界变化规则，以及供组合探索验证的特征规则。</p>
          </div>
          <button type="button" aria-label="关闭推演定义编辑器" onClick={onClose} className="rounded-lg p-2 text-monokai-comment hover:bg-white/10"><X className="h-4 w-4" /></button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col p-5">
          <div className="mb-3 flex gap-2">
            <button type="button" onClick={() => setActiveDefinition('world')} className={activeDefinition === 'world' ? 'rounded-lg bg-monokai-amethyst px-3 py-2 text-xs font-bold text-black' : 'rounded-lg bg-white/5 px-3 py-2 text-xs'}>世界变化规则</button>
            <button type="button" onClick={() => setActiveDefinition('combination')} className={activeDefinition === 'combination' ? 'rounded-lg bg-monokai-amethyst px-3 py-2 text-xs font-bold text-black' : 'rounded-lg bg-white/5 px-3 py-2 text-xs'}>特征组合规则</button>
          </div>
          <div className="mb-2 text-xs text-monokai-cyan">{summary}</div>
          {error && <div role="alert" className="mb-3 rounded-lg bg-monokai-pink/10 p-3 text-xs text-monokai-pink">{error}</div>}
          {activeDefinition === 'world' ? (
            <textarea aria-label="Ontology 世界变化定义 JSON" value={worldText} onChange={event => setWorldText(event.target.value)} disabled={!loaded} spellCheck={false} className="min-h-0 flex-1 resize-none rounded-xl border border-white/10 bg-[#090a0f] p-4 font-mono text-xs leading-5 text-monokai-fg outline-none focus:border-monokai-amethyst/50" />
          ) : (
            <textarea aria-label="Ontology 特征组合定义 JSON" value={combinationText} onChange={event => setCombinationText(event.target.value)} disabled={!loaded} spellCheck={false} className="min-h-0 flex-1 resize-none rounded-xl border border-white/10 bg-[#090a0f] p-4 font-mono text-xs leading-5 text-monokai-fg outline-none focus:border-monokai-amethyst/50" />
          )}
        </div>
        <footer className="flex items-center justify-between border-t border-white/10 px-5 py-4 text-xs text-monokai-comment">
          <span>同一 logicalId + version 不可覆盖；修改定义时请递增版本。</span>
          <button type="button" onClick={() => void save()} disabled={!loaded || saving} className="flex items-center gap-2 rounded-lg bg-monokai-amethyst px-4 py-2 font-bold text-black disabled:opacity-50"><Save className="h-4 w-4" />{saving ? '保存中…' : '校验并保存'}</button>
        </footer>
      </section>
    </div>
  );
};

export default OntologyReasoningCatalogEditor;
