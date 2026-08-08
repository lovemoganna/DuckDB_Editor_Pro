import React, { useEffect, useMemo, useState } from 'react';
import { Save, X } from 'lucide-react';
import {
  ontologyReasoningModule,
  type OntologyProjectionSource,
  type OntologyReasoningCatalog,
} from '../../services/ontology/ontologyReasoningModule';

interface OntologyReasoningCatalogEditorProps {
  source: OntologyProjectionSource;
  onClose: () => void;
}

export const OntologyReasoningCatalogEditor: React.FC<OntologyReasoningCatalogEditorProps> = ({ source, onClose }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await ontologyReasoningModule.initialize();
        const stored = await ontologyReasoningModule.loadCatalog();
        const discovered = ontologyReasoningModule.createSnapshot(source, stored).catalog;
        if (alive) setText(JSON.stringify(discovered, null, 2));
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
      const parsed = JSON.parse(text) as OntologyReasoningCatalog;
      return `${parsed.propertyDefinitions?.length ?? 0} 属性 · ${parsed.rules?.length ?? 0} 规则 · ${parsed.actionDefinitions?.length ?? 0} 动作`;
    } catch {
      return 'JSON 尚不可解析';
    }
  }, [text]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const parsed = JSON.parse(text) as OntologyReasoningCatalog;
      if (!Array.isArray(parsed.propertyDefinitions) || !Array.isArray(parsed.rules) || !Array.isArray(parsed.actionDefinitions)) {
        throw new Error('目录必须包含 propertyDefinitions、rules、actionDefinitions 三个数组');
      }
      const persistable: OntologyReasoningCatalog = {
        propertyDefinitions: parsed.propertyDefinitions.filter(item => item.status === 'active' || item.status === 'archived'),
        rules: parsed.rules,
        actionDefinitions: parsed.actionDefinitions,
      };
      const issues = ontologyReasoningModule.validateModel(ontologyReasoningModule.createSnapshot(source, persistable));
      if (issues.length > 0) throw new Error(issues.join('；'));
      await ontologyReasoningModule.saveCatalog(persistable);
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
            <p className="mt-1 text-xs text-monokai-comment">在 Ontology 中维护稳定属性 ID、类型变量规则和结构化动作。候选属性改为 active 后才会保存。</p>
          </div>
          <button type="button" aria-label="关闭推演定义编辑器" onClick={onClose} className="rounded-lg p-2 text-monokai-comment hover:bg-white/10"><X className="h-4 w-4" /></button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col p-5">
          <div className="mb-2 text-xs text-monokai-cyan">{summary}</div>
          {error && <div role="alert" className="mb-3 rounded-lg bg-monokai-pink/10 p-3 text-xs text-monokai-pink">{error}</div>}
          <textarea aria-label="Ontology 推演定义 JSON" value={text} onChange={event => setText(event.target.value)} disabled={!loaded} spellCheck={false} className="min-h-0 flex-1 resize-none rounded-xl border border-white/10 bg-[#090a0f] p-4 font-mono text-xs leading-5 text-monokai-fg outline-none focus:border-monokai-amethyst/50" />
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
