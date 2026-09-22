import React, { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle, ChevronDown, ChevronRight, GitBranch, Minus,
  Plus, Shield, Trash2, X,
} from 'lucide-react';
import type {
  FeatureRuleAst,
  FeatureConditionAstNode,
  RuleReferenceAstNode,
} from '../../../services/ontology/ontologyRuleAst';
import type {
  ConditionOperator,
  FeatureDefinition,
  RuleDefinition,
} from '../../../services/ontology/ontologyInferenceEngine';

type RuleAst = FeatureRuleAst<ConditionOperator>;

export interface RuleNodeRendererProps {
  node: RuleAst;
  features: FeatureDefinition[];
  allRules: RuleDefinition[];
  currentRuleId: string;
  depth?: number;
  maxDepth?: number;
  readOnly?: boolean;
  onUpdateNode: (nodeId: string, patch: Partial<RuleAst>) => void;
  onDeleteNode: (nodeId: string) => void;
  onAddChild: (parentNodeId: string, childKind: RuleAst['kind']) => void;
}

const LOGIC_STYLES = {
  and: {
    border: 'border-monokai-cyan/30',
    bg: 'bg-monokai-cyan/[0.04]',
    label: 'AND',
    labelBg: 'bg-monokai-cyan/20 text-monokai-cyan',
    description: '所有条件必须同时满足',
  },
  or: {
    border: 'border-monokai-yellow/30',
    bg: 'bg-monokai-yellow/[0.04]',
    label: 'OR',
    labelBg: 'bg-monokai-yellow/20 text-monokai-yellow',
    description: '满足任一条件即可',
  },
  not: {
    border: 'border-monokai-pink/30',
    bg: 'bg-monokai-pink/[0.04]',
    label: 'NOT',
    labelBg: 'bg-monokai-pink/20 text-monokai-pink',
    description: '排除此条件',
  },
} as const;

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  is_true: '是',
  is_false: '否',
  eq: '等于',
  neq: '不等于',
  gt: '大于',
  gte: '大于等于',
  lt: '小于',
  lte: '小于等于',
  between: '介于',
  in: '属于',
  not_in: '不属于',
  contains: '包含',
  not_contains: '不包含',
  contains_any: '包含任一',
  contains_all: '包含全部',
  before: '早于',
  after: '晚于',
  on_or_before: '不晚于',
  on_or_after: '不早于',
  is_null: '为空',
  is_not_null: '不为空',
};

const OPERATORS_BY_TYPE: Record<string, ConditionOperator[]> = {
  boolean: ['is_true', 'is_false', 'is_null', 'is_not_null'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'],
  string: ['eq', 'neq', 'contains', 'not_contains', 'in', 'not_in', 'is_null', 'is_not_null'],
  category: ['eq', 'neq', 'in', 'not_in', 'is_null', 'is_not_null'],
  set: ['contains', 'not_contains', 'contains_any', 'contains_all', 'is_null', 'is_not_null'],
  timestamp: ['eq', 'before', 'after', 'on_or_before', 'on_or_after', 'between', 'is_null', 'is_not_null'],
};

const VALUE_FREE_OPERATORS: ConditionOperator[] = ['is_true', 'is_false', 'is_null', 'is_not_null'];

const displayValue = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value ?? '');

/** Add child buttons for logic nodes */
const AddChildButtons: React.FC<{
  parentNodeId: string;
  canAddRuleRef: boolean;
  onAddChild: (parentNodeId: string, kind: RuleAst['kind']) => void;
}> = ({ parentNodeId, canAddRuleRef, onAddChild }) => (
  <div className="mt-2 flex flex-wrap gap-1.5">
    <button
      type="button"
      onClick={() => onAddChild(parentNodeId, 'condition')}
      className="flex items-center gap-1 rounded-lg border border-dashed border-white/20 px-2 py-1 text-[10px] text-monokai-comment transition-colors hover:border-monokai-accent/70 hover:text-monokai-accent hover:bg-monokai-surface/60 cursor-pointer"
      aria-label="添加条件"
    >
      <Plus className="h-3 w-3" /> 条件
    </button>
    <button
      type="button"
      onClick={() => onAddChild(parentNodeId, 'and')}
      className="flex items-center gap-1 rounded-lg border border-dashed border-white/20 px-2 py-1 text-[10px] text-monokai-comment transition-colors hover:border-monokai-accent/70 hover:text-monokai-accent hover:bg-monokai-surface/60 cursor-pointer"
      aria-label="添加 AND 组"
    >
      <Plus className="h-3 w-3" /> AND
    </button>
    <button
      type="button"
      onClick={() => onAddChild(parentNodeId, 'or')}
      className="flex items-center gap-1 rounded-lg border border-dashed border-white/20 px-2 py-1 text-[10px] text-monokai-comment transition-colors hover:border-monokai-accent/70 hover:text-monokai-accent hover:bg-monokai-surface/60 cursor-pointer"
      aria-label="添加 OR 组"
    >
      <Plus className="h-3 w-3" /> OR
    </button>
    <button
      type="button"
      onClick={() => onAddChild(parentNodeId, 'not')}
      className="flex items-center gap-1 rounded-lg border border-dashed border-white/20 px-2 py-1 text-[10px] text-monokai-comment transition-colors hover:border-monokai-accent/70 hover:text-monokai-accent hover:bg-monokai-surface/60 cursor-pointer"
      aria-label="添加 NOT 排除"
    >
      <Minus className="h-3 w-3" /> NOT
    </button>
    {canAddRuleRef && (
      <button
        type="button"
        onClick={() => onAddChild(parentNodeId, 'ruleRef')}
        className="flex items-center gap-1 rounded-lg border border-dashed border-white/20 px-2 py-1 text-[10px] text-monokai-comment transition-colors hover:border-monokai-accent/70 hover:text-monokai-accent hover:bg-monokai-surface/60 cursor-pointer"
        aria-label="引用子规则"
      >
        <GitBranch className="h-3 w-3" /> 子规则
      </button>
    )}
  </div>
);

/** Condition leaf node renderer */
const ConditionNodeEditor: React.FC<{
  node: FeatureConditionAstNode<ConditionOperator>;
  features: FeatureDefinition[];
  readOnly?: boolean;
  onUpdate: (patch: Partial<FeatureConditionAstNode<ConditionOperator>>) => void;
  onDelete: () => void;
}> = ({ node, features, readOnly, onUpdate, onDelete }) => {
  const feature = features.find(f => f.id === node.featureId);
  const availableOperators = useMemo(
    () => OPERATORS_BY_TYPE[feature?.valueType ?? 'string'] ?? OPERATORS_BY_TYPE.string,
    [feature?.valueType],
  );
  const needsValue = !VALUE_FREE_OPERATORS.includes(node.operator);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.08] bg-black/20 p-2 text-xs transition-all duration-150 hover:border-white/15">
      {/* Feature selector */}
      <select
        aria-label="选择特征"
        value={node.featureId}
        disabled={readOnly}
        onChange={e => onUpdate({ featureId: e.target.value })}
        className="rounded-lg border border-white/10 bg-[#0c0d12] px-2 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-accent disabled:opacity-50 transition-colors"
      >
        <option value="">选择特征…</option>
        {features.map(f => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>

      {/* Operator selector */}
      <select
        aria-label="选择操作符"
        value={node.operator}
        disabled={readOnly}
        onChange={e => onUpdate({ operator: e.target.value as ConditionOperator })}
        className="rounded-lg border border-white/10 bg-[#0c0d12] px-2 py-1.5 text-xs text-monokai-comment outline-none focus:border-monokai-accent disabled:opacity-50 transition-colors"
      >
        {availableOperators.map(op => (
          <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
        ))}
      </select>

      {/* Value input */}
      {needsValue && (
        <input
          type="text"
          aria-label="条件值"
          placeholder="值"
          value={displayValue(node.value)}
          disabled={readOnly}
          onChange={e => {
            const raw = e.target.value.trim();
            let parsed: unknown = raw;
            if (raw === 'true') parsed = true;
            else if (raw === 'false') parsed = false;
            else if (raw !== '' && Number.isFinite(Number(raw))) parsed = Number(raw);
            onUpdate({ value: parsed });
          }}
          className="w-28 rounded-lg border border-white/10 bg-[#0c0d12] px-2 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-accent disabled:opacity-50 transition-colors font-mono"
        />
      )}

      {/* Between second value */}
      {node.operator === 'between' && (
        <>
          <span className="text-monokai-comment">~</span>
          <input
            type="text"
            aria-label="范围上限"
            placeholder="上限"
            value={displayValue(node.secondValue)}
            disabled={readOnly}
            onChange={e => {
              const raw = e.target.value.trim();
              let parsed: unknown = raw;
              if (raw !== '' && Number.isFinite(Number(raw))) parsed = Number(raw);
              onUpdate({ secondValue: parsed });
            }}
            className="w-28 rounded-lg border border-white/10 bg-[#0c0d12] px-2 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-accent disabled:opacity-50 transition-colors font-mono"
          />
        </>
      )}

      {/* Feature label */}
      {feature && (
        <span className="text-[10px] text-monokai-comment">
          {feature.source.kind === 'ontology_property' ? '属性' : feature.source.kind === 'ontology_relation' ? '关系' : '特征'}
          · {feature.valueType}
        </span>
      )}

      {/* Delete button */}
      {!readOnly && (
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto text-monokai-comment transition-colors hover:text-monokai-pink"
          aria-label="删除条件"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

/** Rule reference node renderer */
const RuleRefNodeEditor: React.FC<{
  node: RuleReferenceAstNode;
  allRules: RuleDefinition[];
  currentRuleId: string;
  readOnly?: boolean;
  onUpdate: (patch: Partial<RuleReferenceAstNode>) => void;
  onDelete: () => void;
}> = ({ node, allRules, currentRuleId, readOnly, onUpdate, onDelete }) => {
  const referenceable = useMemo(
    () => allRules.filter(r => r.id !== currentRuleId && r.status === 'active'),
    [allRules, currentRuleId],
  );
  const referencedRule = allRules.find(r => r.id === node.ruleId);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-monokai-border bg-monokai-surface/60 p-2 text-xs">
      <GitBranch className="h-3.5 w-3.5 shrink-0 text-monokai-accent" />
      <select
        aria-label="选择子规则"
        value={node.ruleId}
        disabled={readOnly}
        onChange={e => onUpdate({ ruleId: e.target.value })}
        className="rounded-lg border border-white/10 bg-[#0c0d12] px-2 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-accent disabled:opacity-50 transition-colors"
      >
        <option value="">选择子规则…</option>
        {referenceable.map(r => (
          <option key={r.id} value={r.id}>{r.name} · v{r.version}</option>
        ))}
      </select>
      {referencedRule && (
        <span className="text-[10px] text-monokai-comment">
          引用《{referencedRule.name}》
        </span>
      )}
      {!readOnly && (
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto text-monokai-comment transition-colors hover:text-monokai-pink"
          aria-label="删除子规则引用"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};


/** Main recursive AST node renderer */
export const RuleNodeRenderer: React.FC<RuleNodeRendererProps> = ({
  node,
  features,
  allRules,
  currentRuleId,
  depth = 0,
  maxDepth = 10,
  readOnly = false,
  onUpdateNode,
  onDeleteNode,
  onAddChild,
}) => {
  const [collapsed, setCollapsed] = useState(depth > 3);
  const MAX_RECOMMENDED_DEPTH = 4;
  const isDeep = depth >= MAX_RECOMMENDED_DEPTH;

  const handleUpdate = useCallback(
    (patch: Partial<RuleAst>) => {
      const nodeId = 'nodeId' in node ? (node as { nodeId?: string }).nodeId : undefined;
      if (nodeId) onUpdateNode(nodeId, patch);
    },
    [node, onUpdateNode],
  );

  const handleDelete = useCallback(() => {
    const nodeId = 'nodeId' in node ? (node as { nodeId?: string }).nodeId : undefined;
    if (nodeId) onDeleteNode(nodeId);
  }, [node, onDeleteNode]);

  const nodeId = 'nodeId' in node ? (node as { nodeId?: string }).nodeId ?? '' : '';

  // Condition leaf node
  if (node.kind === 'condition') {
    return (
      <ConditionNodeEditor
        node={node}
        features={features}
        readOnly={readOnly}
        onUpdate={patch => handleUpdate(patch as Partial<RuleAst>)}
        onDelete={handleDelete}
      />
    );
  }

  // Rule reference node
  if (node.kind === 'ruleRef') {
    return (
      <RuleRefNodeEditor
        node={node}
        allRules={allRules}
        currentRuleId={currentRuleId}
        readOnly={readOnly}
        onUpdate={patch => handleUpdate(patch as Partial<RuleAst>)}
        onDelete={handleDelete}
      />
    );
  }

  // Logic nodes (AND, OR, NOT)
  const style = LOGIC_STYLES[node.kind as keyof typeof LOGIC_STYLES];
  if (!style) return null;

  const children = node.kind === 'not'
    ? [node.child]
    : (node as Extract<RuleAst, { kind: 'and' | 'or' }>).children;

  const childCount = Array.isArray(children) ? children.length : (children ? 1 : 0);

  if (depth > maxDepth) {
    return (
      <div className="rounded-lg bg-monokai-pink/10 p-2 text-[10px] text-monokai-pink">
        <AlertTriangle className="mr-1 inline h-3 w-3" />
        超过最大渲染深度 ({maxDepth})，请拆分为子规则。
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border ${style.border} ${style.bg} p-3 transition-all duration-200`}
      style={{ marginLeft: depth > 0 ? 12 : 0 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="shrink-0 text-monokai-comment transition-colors hover:text-monokai-fg"
          aria-label={collapsed ? '展开' : '折叠'}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        <span className={`rounded-md px-2 py-0.5 text-[10px] font-black ${style.labelBg}`}>
          {style.label}
        </span>

        <span className="text-[10px] text-monokai-comment">
          {style.description}
          {childCount > 0 && ` · ${childCount} 项`}
        </span>

        {isDeep && (
          <span className="flex items-center gap-1 rounded bg-monokai-yellow/10 px-1.5 py-0.5 text-[10px] text-monokai-yellow">
            <AlertTriangle className="h-3 w-3" />
            嵌套 {depth + 1} 层，建议拆分为子规则
          </span>
        )}

        {!readOnly && (
          <button
            type="button"
            onClick={handleDelete}
            className="ml-auto shrink-0 text-monokai-comment transition-colors hover:text-monokai-pink"
            aria-label={`删除 ${style.label} 节点`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Children */}
      {!collapsed && (
        <div className="mt-2 space-y-2">
          {(Array.isArray(children) ? children : (children ? [children] : [])).map((child, index) => (
            <RuleNodeRenderer
              key={('nodeId' in child ? (child as { nodeId?: string }).nodeId : null) ?? `child-${index}`}
              node={child}
              features={features}
              allRules={allRules}
              currentRuleId={currentRuleId}
              depth={depth + 1}
              maxDepth={maxDepth}
              readOnly={readOnly}
              onUpdateNode={onUpdateNode}
              onDeleteNode={onDeleteNode}
              onAddChild={onAddChild}
            />
          ))}

          {/* Add child buttons */}
          {!readOnly && node.kind !== 'not' && (
            <AddChildButtons
              parentNodeId={nodeId}
              canAddRuleRef={allRules.filter(r => r.id !== currentRuleId && r.status === 'active').length > 0}
              onAddChild={onAddChild}
            />
          )}

          {/* NOT can only have one child */}
          {!readOnly && node.kind === 'not' && childCount === 0 && (
            <AddChildButtons
              parentNodeId={nodeId}
              canAddRuleRef={allRules.filter(r => r.id !== currentRuleId && r.status === 'active').length > 0}
              onAddChild={onAddChild}
            />
          )}
        </div>
      )}

      {collapsed && childCount > 0 && (
        <div className="mt-1 text-[10px] text-monokai-comment">
          已折叠 {childCount} 项子条件
        </div>
      )}
    </div>
  );
};

export default RuleNodeRenderer;
