import React, { useState } from 'react';
import {
  Code, Copy, Edit3, GitBranch, Plus, Save,
  ShieldCheck, Trash2, Zap,
} from 'lucide-react';
import type { FeatureDefinition, RuleDefinition } from '../../../services/ontology/ontologyInferenceEngine';
import type { FeatureRuleAst } from '../../../services/ontology/ontologyRuleAst';
import { renderRuleLisp, validateRule } from '../../../services/ontology/ontologyInferenceEngine';
import { RuleNodeRenderer } from './RuleNodeRenderer';

export interface RuleBuilderPanelProps {
  rules: RuleDefinition[];
  features: FeatureDefinition[];
  activeRuleId: string | null;
  onSelectRule: (ruleId: string) => void;
  onCreateRule: (name: string) => void;
  onDeleteRule: (ruleId: string) => void;
  onDuplicateRule: (ruleId: string) => void;
  onUpdateRuleRoot: (ruleId: string, root: FeatureRuleAst) => void;
  onUpdateRuleMetadata: (ruleId: string, name: string, description: string) => void;
}

export const RuleBuilderPanel: React.FC<RuleBuilderPanelProps> = ({
  rules,
  features,
  activeRuleId,
  onSelectRule,
  onCreateRule,
  onDeleteRule,
  onDuplicateRule,
  onUpdateRuleRoot,
  onUpdateRuleMetadata,
}) => {
  const [newRuleName, setNewRuleName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);

  const activeRule = rules.find(r => r.id === activeRuleId) ?? rules[0];

  const handleCreate = () => {
    if (newRuleName.trim()) {
      onCreateRule(newRuleName.trim());
      setNewRuleName('');
      setIsCreating(false);
    }
  };

  const validation = activeRule
    ? validateRule(activeRule, features, rules)
    : { valid: true, errors: [], warnings: [], maxDepth: 0 };

  // Tree manipulation functions
  const findAndUpdateNode = (
    current: FeatureRuleAst,
    targetId: string,
    patch: Partial<FeatureRuleAst>,
  ): FeatureRuleAst => {
    if ('nodeId' in current && current.nodeId === targetId) {
      return { ...current, ...patch } as FeatureRuleAst;
    }
    if (current.kind === 'and' || current.kind === 'or') {
      return {
        ...current,
        children: current.children.map(child => findAndUpdateNode(child, targetId, patch)),
      };
    }
    if (current.kind === 'not') {
      return {
        ...current,
        child: findAndUpdateNode(current.child, targetId, patch),
      };
    }
    return current;
  };

  const findAndDeleteNode = (current: FeatureRuleAst, targetId: string): FeatureRuleAst | null => {
    if ('nodeId' in current && current.nodeId === targetId) {
      return null;
    }
    if (current.kind === 'and' || current.kind === 'or') {
      const filtered = current.children
        .map(child => findAndDeleteNode(child, targetId))
        .filter((child): child is FeatureRuleAst => child !== null);
      return { ...current, children: filtered };
    }
    if (current.kind === 'not') {
      const updatedChild = findAndDeleteNode(current.child, targetId);
      return updatedChild ? { ...current, child: updatedChild } : null;
    }
    return current;
  };

  const findAndAddChild = (
    current: FeatureRuleAst,
    parentId: string,
    childKind: FeatureRuleAst['kind'],
  ): FeatureRuleAst => {
    const newChildId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    let newChildNode: FeatureRuleAst;
    if (childKind === 'condition') {
      newChildNode = {
        kind: 'condition',
        nodeId: newChildId,
        featureId: features[0]?.id ?? '',
        operator: 'eq',
        value: '',
      };
    } else if (childKind === 'and' || childKind === 'or') {
      newChildNode = {
        kind: childKind,
        nodeId: newChildId,
        children: [],
      };
    } else if (childKind === 'not') {
      newChildNode = {
        kind: 'not',
        nodeId: newChildId,
        child: {
          kind: 'condition',
          nodeId: `${newChildId}-child`,
          featureId: features[0]?.id ?? '',
          operator: 'eq',
          value: '',
        },
      };
    } else {
      newChildNode = {
        kind: 'ruleRef',
        nodeId: newChildId,
        ruleId: rules.find(r => r.id !== activeRule?.id)?.id ?? '',
      };
    }

    if ('nodeId' in current && current.nodeId === parentId) {
      if (current.kind === 'and' || current.kind === 'or') {
        return { ...current, children: [...current.children, newChildNode] };
      }
      if (current.kind === 'not') {
        return { ...current, child: newChildNode };
      }
    }

    if (current.kind === 'and' || current.kind === 'or') {
      return {
        ...current,
        children: current.children.map(child => findAndAddChild(child, parentId, childKind)),
      };
    }
    if (current.kind === 'not') {
      return {
        ...current,
        child: findAndAddChild(current.child, parentId, childKind),
      };
    }
    return current;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#12141e] border-r border-white/10 p-3 text-xs">
      {/* Rule selector header */}
      <div className="mb-3 shrink-0 border-b border-white/10 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-black text-monokai-fg">
            <GitBranch className="h-4 w-4 text-monokai-amethyst" />
            规则 AST 构建器
          </h2>
          <button
            type="button"
            onClick={() => setIsCreating(prev => !prev)}
            className="flex items-center gap-1 rounded bg-monokai-amethyst/20 px-2 py-1 text-[10px] font-bold text-monokai-amethyst hover:bg-monokai-amethyst/30"
          >
            <Plus className="h-3 w-3" /> 新规
          </button>
        </div>

        {/* Create new rule inline box */}
        {isCreating && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-black/30 p-2">
            <input
              type="text"
              placeholder="新规则中文名称..."
              value={newRuleName}
              onChange={e => setNewRuleName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              className="flex-1 rounded bg-black/40 px-2 py-1 text-xs text-monokai-fg border border-white/10 outline-none focus:border-monokai-accent"
            />
            <button
              type="button"
              onClick={handleCreate}
              className="rounded bg-monokai-amethyst px-2 py-1 text-[10px] font-bold text-black"
            >
              确定
            </button>
          </div>
        )}

        {/* Rule Pills Selector */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {rules.map(rule => {
            const isActive = rule.id === activeRule?.id;
            return (
              <button
                key={rule.id}
                type="button"
                onClick={() => onSelectRule(rule.id)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${
                  isActive
                    ? 'border border-monokai-amethyst/40 bg-monokai-amethyst/20 text-monokai-amethyst'
                    : 'border border-transparent bg-white/5 text-monokai-comment hover:bg-white/10'
                }`}
              >
                <span>{rule.name}</span>
                <span className="text-[9px] text-monokai-comment">v{rule.version}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Rule Details & Visual Tree */}
      {activeRule ? (
        <div className="flex flex-1 flex-col overflow-hidden space-y-3">
          {/* Active Rule Metadata & Action Bar */}
          <div className="flex items-center justify-between rounded-lg bg-black/20 p-2 text-[11px]">
            <div>
              <span className="font-bold text-monokai-fg">{activeRule.name}</span>
              <span className="ml-2 text-monokai-comment">ID: {activeRule.logicalId}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onDuplicateRule(activeRule.id)}
                className="rounded p-1 text-monokai-comment hover:text-monokai-cyan"
                title="复制规则"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              {rules.length > 1 && (
                <button
                  type="button"
                  onClick={() => onDeleteRule(activeRule.id)}
                  className="rounded p-1 text-monokai-comment hover:text-monokai-pink"
                  title="删除规则"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Validation Warnings / Errors */}
          {validation.warnings.length > 0 && (
            <div className="rounded-lg bg-monokai-yellow/10 p-2 text-[10px] text-monokai-yellow space-y-1">
              {validation.warnings.map(w => (
                <div key={w.nodeId}>⚠️ {w.message}</div>
              ))}
            </div>
          )}

          {/* Recursive Visual Rule Tree */}
          <div className="flex-1 overflow-auto pr-1">
            <RuleNodeRenderer
              node={activeRule.root}
              features={features}
              allRules={rules}
              currentRuleId={activeRule.id}
              depth={0}
              onUpdateNode={(nodeId, patch) => {
                const updated = findAndUpdateNode(activeRule.root, nodeId, patch);
                onUpdateRuleRoot(activeRule.id, updated);
              }}
              onDeleteNode={nodeId => {
                const updated = findAndDeleteNode(activeRule.root, nodeId);
                if (updated) onUpdateRuleRoot(activeRule.id, updated);
              }}
              onAddChild={(parentId, childKind) => {
                const updated = findAndAddChild(activeRule.root, parentId, childKind);
                onUpdateRuleRoot(activeRule.id, updated);
              }}
            />
          </div>

          {/* Inline Lisp Preview Footer */}
          <div className="shrink-0 rounded-lg bg-black/40 p-2 font-mono text-[10px] text-monokai-comment">
            <div className="mb-1 flex items-center justify-between text-monokai-amethyst font-bold text-[9px]">
              <span><Code className="inline h-3 w-3 mr-1" />中文 Lisp 预览</span>
              <span>来自统一 AST</span>
            </div>
            <pre className="max-h-20 overflow-auto whitespace-pre-wrap">
              {renderRuleLisp(activeRule, features)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-monokai-comment">
          请选择或新建一条推演规则
        </div>
      )}
    </div>
  );
};
