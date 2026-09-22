import React, { useState } from 'react';
import {
  BookOpen, Code, Copy, Edit3, GitBranch, Layers, Plus,
  Trash2, Zap, Sliders, ChevronDown, ChevronRight,
} from 'lucide-react';
import type {
  ConditionOperator,
  FeatureDefinition,
  RuleDefinition,
} from '../../../services/ontology/ontologyInferenceEngine';
import type { FeatureRuleAst } from '../../../services/ontology/ontologyRuleAst';
import { renderRuleLisp, validateRule, explainFeature, estimateNullSemantics } from '../../../services/ontology/ontologyInferenceEngine';
import { RuleNodeRenderer } from '../DeductionWorkbench/RuleNodeRenderer';
import { AiRuleDrafter } from './AiRuleDrafter';

export interface RuleStudioProps {
  rules: RuleDefinition[];
  features: FeatureDefinition[];
  selectedFeatureIds: string[];
  activeRuleId: string | null;
  featureReliability: Record<string, number>;
  manualWeights: Record<string, number>;
  totalRows: number;
  rows: Array<Record<string, unknown>>;
  onToggleFeature: (featureId: string) => void;
  onSelectAllFeatures: () => void;
  onClearFeatureSelection: () => void;
  onSelectRule: (ruleId: string) => void;
  onCreateRule: (name: string, root?: FeatureRuleAst<ConditionOperator>) => void;
  onDeleteRule: (ruleId: string) => void;
  onDuplicateRule: (ruleId: string) => void;
  onUpdateRuleRoot: (ruleId: string, root: FeatureRuleAst<ConditionOperator>) => void;
}

export const RuleStudio: React.FC<RuleStudioProps> = ({
  rules,
  features,
  selectedFeatureIds,
  activeRuleId,
  featureReliability,
  manualWeights,
  totalRows,
  rows,
  onToggleFeature,
  onSelectAllFeatures,
  onClearFeatureSelection,
  onSelectRule,
  onCreateRule,
  onDeleteRule,
  onDuplicateRule,
  onUpdateRuleRoot,
}) => {
  const [newRuleName, setNewRuleName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [featureDrawerOpen, setFeatureDrawerOpen] = useState(false);
  const [expandedFeatureId, setExpandedFeatureId] = useState<string | null>(null);

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

  // Tree mutation helpers
  const findAndUpdateNode = (
    current: FeatureRuleAst<ConditionOperator>,
    targetId: string,
    patch: Partial<FeatureRuleAst<ConditionOperator>>,
  ): FeatureRuleAst<ConditionOperator> => {
    if ('nodeId' in current && current.nodeId === targetId) {
      return { ...current, ...patch } as FeatureRuleAst<ConditionOperator>;
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

  const findAndDeleteNode = (
    current: FeatureRuleAst<ConditionOperator>,
    targetId: string,
  ): FeatureRuleAst<ConditionOperator> | null => {
    if ('nodeId' in current && current.nodeId === targetId) {
      return null;
    }
    if (current.kind === 'and' || current.kind === 'or') {
      const filtered = current.children
        .map(child => findAndDeleteNode(child, targetId))
        .filter((child): child is FeatureRuleAst<ConditionOperator> => child !== null);
      return { ...current, children: filtered };
    }
    if (current.kind === 'not') {
      const updatedChild = findAndDeleteNode(current.child, targetId);
      return updatedChild ? { ...current, child: updatedChild } : null;
    }
    return current;
  };

  const findAndAddChild = (
    current: FeatureRuleAst<ConditionOperator>,
    parentId: string,
    childKind: FeatureRuleAst<ConditionOperator>['kind'],
  ): FeatureRuleAst<ConditionOperator> => {
    const newChildId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    let newChildNode: FeatureRuleAst<ConditionOperator>;
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
    <div className="flex h-full flex-col overflow-hidden bg-[#12141e] border-r border-white/10 p-3.5 text-xs space-y-3">
      {/* AI Drafter Header Section */}
      <AiRuleDrafter
        features={features}
        onRuleGenerated={(name, root) => onCreateRule(name, root as FeatureRuleAst<ConditionOperator>)}
      />

      {/* Feature Catalog Collapsible Accordion Bar */}
      <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setFeatureDrawerOpen(prev => !prev)}
            className="flex items-center gap-2 font-bold text-monokai-cyan text-[11px]"
          >
            <Layers className="h-4 w-4" />
            参与交叉推演的特征 ({selectedFeatureIds.length} / {features.length})
            {featureDrawerOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <div className="flex items-center gap-1.5 text-[10px]">
            <button type="button" onClick={onSelectAllFeatures} className="text-monokai-cyan hover:underline">全选</button>
            <span className="text-monokai-comment">·</span>
            <button type="button" onClick={onClearFeatureSelection} className="text-monokai-comment hover:underline">清空</button>
          </div>
        </div>

        {/* Feature Checkboxes Grid when open */}
        {featureDrawerOpen && (
          <div className="mt-2.5 space-y-1.5 border-t border-white/10 pt-2.5 max-h-48 overflow-auto">
            {features.map(f => {
              const isChecked = selectedFeatureIds.includes(f.id);
              const isExpanded = expandedFeatureId === f.id;
              const explanation = explainFeature(f);
              const nullReport = estimateNullSemantics(f);

              return (
                <div key={f.id} className="rounded-lg bg-white/5 p-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleFeature(f.id)}
                        className="rounded"
                      />
                      <span className="font-bold text-monokai-fg">{f.name}</span>
                      <span className="text-[9px] text-monokai-yellow font-mono">({f.valueType})</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setExpandedFeatureId(isExpanded ? null : f.id)}
                      className="text-[9px] text-monokai-cyan hover:underline"
                    >
                      {isExpanded ? '收起' : '详细定义'}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="mt-1 text-[10px] text-monokai-comment space-y-0.5 border-t border-white/10 pt-1">
                      <div>来源：{explanation.sourceDescription}</div>
                      <div>空值语义：{nullReport.unknownDescription}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rule Selection Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {rules.map(rule => {
            const isActive = rule.id === activeRule?.id;
            return (
              <button
                key={rule.id}
                type="button"
                onClick={() => onSelectRule(rule.id)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all whitespace-nowrap ${
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
        <button
          type="button"
          onClick={() => setIsCreating(prev => !prev)}
          className="flex items-center gap-1 shrink-0 rounded bg-monokai-amethyst/20 px-2 py-1 text-[10px] font-bold text-monokai-amethyst hover:bg-monokai-amethyst/30 ml-2"
        >
          <Plus className="h-3 w-3" /> 新建规则
        </button>
      </div>

      {/* Inline Create Input */}
      {isCreating && (
        <div className="flex items-center gap-1.5 rounded-lg bg-black/30 p-2">
          <input
            type="text"
            placeholder="新规则名称..."
            value={newRuleName}
            onChange={e => setNewRuleName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
            className="flex-1 rounded bg-black/40 px-2 py-1 text-xs text-monokai-fg border border-white/10 outline-none focus:border-monokai-accent"
          />
          <button type="button" onClick={handleCreate} className="rounded bg-monokai-amethyst px-2 py-1 text-[10px] font-bold text-black">
            确定
          </button>
        </div>
      )}

      {/* Visual Rule AST Tree Editor */}
      {activeRule ? (
        <div className="flex-1 overflow-auto space-y-2 pr-1">
          {validation.warnings.length > 0 && (
            <div className="rounded-lg bg-monokai-yellow/10 p-2 text-[10px] text-monokai-yellow space-y-1">
              {validation.warnings.map(w => (
                <div key={w.nodeId}>⚠️ {w.message}</div>
              ))}
            </div>
          )}

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
      ) : (
        <div className="flex flex-1 items-center justify-center text-monokai-comment">
          请选择或新建一条规则
        </div>
      )}
    </div>
  );
};
