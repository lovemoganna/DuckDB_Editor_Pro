import type {
  FeatureConditionAstNode,
  FeatureRuleAst,
  RuleReferenceAstNode,
} from './ontologyRuleAst';

export type TruthValue = 'TRUE' | 'FALSE' | 'UNKNOWN';

export type FeatureValueType =
  | 'boolean'
  | 'number'
  | 'string'
  | 'category'
  | 'set'
  | 'timestamp';

export type ConditionOperator =
  | 'is_true'
  | 'is_false'
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'not_contains'
  | 'contains_any'
  | 'contains_all'
  | 'before'
  | 'after'
  | 'on_or_before'
  | 'on_or_after'
  | 'is_null'
  | 'is_not_null';

export interface ColumnFeatureSource {
  kind: 'column';
  table: string;
  column: string;
  encoding?: 'scalar' | 'json_array' | 'native_list' | 'csv';
}

export interface ComputedFeatureSource {
  kind: 'computed';
  table: string;
  expression: string;
  dependencies: string[];
  allowedFunctions: string[];
}

export interface OntologyPropertyFeatureSource {
  kind: 'ontology_property';
  table: string;
  jsonColumn: string;
  propertyKey: string;
}

export interface OntologyRelationFeatureSource {
  kind: 'ontology_relation';
  table: string;
  objectIdColumn: string;
  linkTable: string;
  linkTypeId: number;
  direction: 'outgoing' | 'incoming';
}

export interface FeatureDefinition {
  id: string;
  logicalId: string;
  version: number;
  name: string;
  description: string;
  valueType: FeatureValueType;
  objectTypeId: number;
  source:
    | ColumnFeatureSource
    | ComputedFeatureSource
    | OntologyPropertyFeatureSource
    | OntologyRelationFeatureSource;
  nullSemantics: string;
  status: 'candidate' | 'active' | 'archived';
  window?: {
    value: number;
    unit: 'minute' | 'hour' | 'day';
    anchorColumn?: string;
  };
  domain?: unknown[];
}

export type RuleAst = FeatureRuleAst<ConditionOperator>;
export type LogicNode = Extract<RuleAst, { kind: 'and' | 'or' }>;
export type NotNode = Extract<RuleAst, { kind: 'not' }>;
export type ConditionNode = FeatureConditionAstNode<ConditionOperator>;
export type RuleRefNode = RuleReferenceAstNode;

export interface RuleDefinition {
  id: string;
  logicalId: string;
  version: number;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'archived';
  root: RuleAst;
  outcomeId?: string;
}

export interface OutcomeDefinition {
  id: string;
  logicalId: string;
  version: number;
  name: string;
  description: string;
  objectTypeId: number;
  mode: 'classification' | 'forecast';
  ruleId: string;
  labelBinding?: {
    table: string;
    column: string;
    positiveValue: unknown;
    subjectKey?: string;
    eventTimeColumn?: string;
  };
  horizonHours?: number;
  expertPrior?: {
    priorProbability: number;
    likelihoods: Array<{
      featureId: string;
      stateValue: unknown;
      likelihoodRatio: number;
    }>;
  };
  status: 'draft' | 'active' | 'archived';
}

export interface EvaluationTrace {
  nodeId: string;
  kind: RuleAst['kind'];
  label: string;
  value: TruthValue;
  reason?: string;
  featureId?: string;
  actual?: unknown;
  expected?: unknown;
  children?: EvaluationTrace[];
}

export interface RuleEvaluationOptions {
  rules?: RuleDefinition[];
}

export interface RuleValidationIssue {
  code:
    | 'invalid_arity'
    | 'missing_feature'
    | 'inactive_feature'
    | 'invalid_operator'
    | 'missing_value'
    | 'invalid_value'
    | 'missing_rule'
    | 'cyclic_rule_reference';
  nodeId: string;
  message: string;
}

export interface RuleValidationReport {
  valid: boolean;
  errors: RuleValidationIssue[];
  warnings: Array<{
    code: 'deep_nesting';
    nodeId: string;
    message: string;
  }>;
  maxDepth: number;
}

export interface CompiledRule {
  predicateSql: string;
  params: unknown[];
  fingerprint: string;
  lisp: string;
  explanation: string;
  featureIds: string[];
}

export interface InferenceRequest {
  features: FeatureDefinition[];
  rules: RuleDefinition[];
  outcomes: OutcomeDefinition[];
  selectedFeatureIds: string[];
  selectedRuleIds: string[];
  outcomeId?: string;
  rows: Array<Record<string, unknown>>;
  topK?: number;
  beamWidth?: number;
  minSampleSize?: number;
  executedSql: string;
  params: unknown[];
  compilationFingerprint?: string;
  ranking?: {
    featureReliability?: Record<string, number>;
    historicalValidation?: Record<string, number>;
    manualWeights?: Record<string, number>;
    weights?: Partial<RankingWeights>;
  };
}

export interface SituationState {
  featureId: string;
  featureName: string;
  value: unknown;
  label: string;
}

export interface InferenceRuleResult {
  ruleId: string;
  ruleName: string;
  trueCount: number;
  falseCount: number;
  unknownCount: number;
  trace: EvaluationTrace;
}

export interface CandidateMissingCondition {
  ruleId: string;
  ruleName: string;
  nodeId: string;
  featureId?: string;
  label: string;
  value: 'UNKNOWN';
  reason: string;
  actual?: unknown;
  expected?: unknown;
}

export interface CandidateCounterfactualChange {
  featureId: string;
  featureName: string;
  from: unknown;
  to: unknown;
}

export interface CandidateCounterfactual {
  targetCandidateId: string;
  targetStatus: SituationCandidate['status'];
  targetScore: number;
  editDistance: number;
  changes: CandidateCounterfactualChange[];
}

export interface SituationCandidate {
  id: string;
  rank: number;
  states: SituationState[];
  sourceObjectIds: number[];
  count: number;
  probability: number;
  probabilityInterval: [number, number];
  smallSample: boolean;
  outcomeProbability?: number;
  outcomeKnownCount?: number;
  expertPriorProbability?: number;
  evidenceKind: 'empirical_frequency' | 'empirical_probability' | 'logical_only';
  ruleResults: InferenceRuleResult[];
  status: 'ESTABLISHED' | 'POSSIBLE' | 'EXCLUDED';
  ranking: CandidateRanking;
  missingConditions: CandidateMissingCondition[];
  counterfactuals: CandidateCounterfactual[];
}

export interface RankingWeights {
  evidenceCoverage: number;
  reliability: number;
  conditionSatisfaction: number;
  conflictPenalty: number;
  unknownPenalty: number;
  historicalValidation: number;
  manualWeight: number;
}

export interface CandidateRanking {
  evidenceCoverage: number;
  reliability: number;
  conditionSatisfaction: number;
  conflictPenalty: number;
  unknownPenalty: number;
  historicalValidation: number;
  manualWeight: number;
  score: number;
  reasons: string[];
}

export interface InferenceReport {
  runId: string;
  generatedAt: string;
  knownPopulation: number;
  unknownPopulation: number;
  unknownRate: number;
  candidates: SituationCandidate[];
  rankedCandidates: SituationCandidate[];
  establishedCandidates: SituationCandidate[];
  possibleCandidates: SituationCandidate[];
  excludedCandidates: SituationCandidate[];
  outcomeCandidates: SituationCandidate[];
  unknownReasons: Array<{
    featureId: string;
    featureName: string;
    count: number;
    reason: string;
  }>;
  totalCandidateCount: number;
  omittedCandidateCount: number;
  truncated: boolean;
  beamWidth: number;
  topK: number;
  executedSql: string;
  params: unknown[];
  compilationFingerprint: string;
  featureVersionIds: string[];
  ruleVersionIds: string[];
  sourceSnapshot?: {
    snapshotId: string;
    ontologyId: string;
    objectTypeId: number;
    objectIds: number[];
  };
}

const isUnknown = (value: unknown): value is null | undefined =>
  value === null || value === undefined;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));

const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  evidenceCoverage: 0.2,
  reliability: 0.2,
  conditionSatisfaction: 0.25,
  conflictPenalty: 0.15,
  unknownPenalty: 0.15,
  historicalValidation: 0.05,
  manualWeight: 0.1,
};

const truth = (value: boolean): TruthValue => value ? 'TRUE' : 'FALSE';

const toComparableTime = (value: unknown): number | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

function evaluateCondition(
  node: ConditionNode,
  feature: FeatureDefinition | undefined,
  actual: unknown,
): EvaluationTrace {
  const label = feature?.name ?? node.featureId;
  if (node.operator === 'is_null') {
    return {
      nodeId: node.nodeId,
      kind: node.kind,
      label,
      featureId: node.featureId,
      actual,
      value: truth(isUnknown(actual)),
    };
  }
  if (node.operator === 'is_not_null') {
    return {
      nodeId: node.nodeId,
      kind: node.kind,
      label,
      featureId: node.featureId,
      actual,
      value: truth(!isUnknown(actual)),
    };
  }
  if (isUnknown(actual)) {
    return {
      nodeId: node.nodeId,
      kind: node.kind,
      label,
      featureId: node.featureId,
      actual,
      expected: node.value,
      value: 'UNKNOWN',
      reason: feature?.nullSemantics ?? '特征值缺失，返回 UNKNOWN',
    };
  }

  let result: boolean | null = null;
  if (node.operator === 'is_true') result = actual === true;
  if (node.operator === 'is_false') result = actual === false;
  if (node.operator === 'eq' || node.operator === 'neq') {
    const equal = feature?.valueType === 'timestamp'
      ? toComparableTime(actual) !== null
        && toComparableTime(actual) === toComparableTime(node.value)
      : feature?.valueType === 'number'
        ? Number.isFinite(Number(actual))
          && Number.isFinite(Number(node.value))
          && Number(actual) === Number(node.value)
      : Object.is(actual, node.value);
    result = node.operator === 'eq' ? equal : !equal;
  }
  if (node.operator === 'gt') result = Number(actual) > Number(node.value);
  if (node.operator === 'gte') result = Number(actual) >= Number(node.value);
  if (node.operator === 'lt') result = Number(actual) < Number(node.value);
  if (node.operator === 'lte') result = Number(actual) <= Number(node.value);
  if (node.operator === 'between') {
    if (feature?.valueType === 'timestamp') {
      const actualTime = toComparableTime(actual);
      const startTime = toComparableTime(node.value);
      const endTime = toComparableTime(node.secondValue);
      result = actualTime !== null && startTime !== null && endTime !== null
        ? actualTime >= startTime && actualTime <= endTime
        : null;
    } else {
      result = Number(actual) >= Number(node.value) && Number(actual) <= Number(node.secondValue);
    }
  }
  if (node.operator === 'in' || node.operator === 'not_in') {
    const members = Array.isArray(node.value) ? node.value : [node.value];
    const contains = members.some(member =>
      feature?.valueType === 'timestamp'
        ? toComparableTime(actual) !== null
          && toComparableTime(actual) === toComparableTime(member)
        : feature?.valueType === 'number'
          ? Number.isFinite(Number(actual))
            && Number.isFinite(Number(member))
            && Number(actual) === Number(member)
          : Object.is(member, actual),
    );
    result = node.operator === 'in' ? contains : !contains;
  }
  if (
    node.operator === 'contains'
    || node.operator === 'not_contains'
    || node.operator === 'contains_any'
    || node.operator === 'contains_all'
  ) {
    if (
      feature?.valueType === 'string'
      && (node.operator === 'contains' || node.operator === 'not_contains')
    ) {
      const contains = String(actual).includes(String(node.value));
      result = node.operator === 'contains' ? contains : !contains;
    } else {
    let actualMembers: unknown[] | null = Array.isArray(actual)
      ? actual
      : actual instanceof Set
        ? [...actual]
        : null;
    if (actualMembers === null && typeof actual === 'string') {
      const encoding = feature?.source.kind === 'column'
        ? feature.source.encoding ?? 'json_array'
        : 'json_array';
      if (encoding === 'csv') {
        actualMembers = actual.split(',').map(item => item.trim()).filter(Boolean);
      } else if (encoding === 'json_array') {
        try {
          const parsed = JSON.parse(actual);
          actualMembers = Array.isArray(parsed) ? parsed : null;
        } catch {
          actualMembers = null;
        }
      }
    }
    if (actualMembers) {
      const expectedMembers = Array.isArray(node.value) ? node.value : [node.value];
      const has = (member: unknown) => actualMembers.some(item => Object.is(item, member));
      if (node.operator === 'contains') result = has(node.value);
      if (node.operator === 'not_contains') result = !has(node.value);
      if (node.operator === 'contains_any') result = expectedMembers.some(has);
      if (node.operator === 'contains_all') result = expectedMembers.every(has);
    }
    }
  }
  if (
    node.operator === 'before'
    || node.operator === 'after'
    || node.operator === 'on_or_before'
    || node.operator === 'on_or_after'
  ) {
    const actualTime = toComparableTime(actual);
    const expectedTime = toComparableTime(node.value);
    if (actualTime !== null && expectedTime !== null) {
      if (node.operator === 'before') result = actualTime < expectedTime;
      if (node.operator === 'after') result = actualTime > expectedTime;
      if (node.operator === 'on_or_before') result = actualTime <= expectedTime;
      if (node.operator === 'on_or_after') result = actualTime >= expectedTime;
    }
  }

  return {
    nodeId: node.nodeId,
    kind: node.kind,
    label,
    featureId: node.featureId,
    actual,
    expected: node.value,
    value: result === null ? 'UNKNOWN' : truth(result),
    ...(result === null ? { reason: '特征值与操作符不兼容，返回 UNKNOWN' } : {}),
  };
}

function evaluateNode(
  node: RuleAst,
  featureMap: Map<string, FeatureDefinition>,
  values: Record<string, unknown>,
  ruleMap: Map<string, RuleDefinition>,
  activeRuleIds: Set<string>,
): EvaluationTrace {
  if (node.kind === 'condition') {
    return evaluateCondition(node, featureMap.get(node.featureId), values[node.featureId]);
  }
  if (node.kind === 'ruleRef') {
    const referenced = ruleMap.get(node.ruleId);
    if (!referenced || activeRuleIds.has(node.ruleId)) {
      return {
        nodeId: node.nodeId,
        kind: node.kind,
        label: referenced?.name ?? node.ruleId,
        value: 'UNKNOWN',
        reason: referenced ? '检测到循环规则引用' : '引用的规则版本不存在',
      };
    }
    const child = evaluateNode(
      referenced.root,
      featureMap,
      values,
      ruleMap,
      new Set(activeRuleIds).add(node.ruleId),
    );
    return {
      nodeId: node.nodeId,
      kind: node.kind,
      label: referenced.name,
      value: child.value,
      children: [child],
    };
  }
  if (node.kind === 'not') {
    const child = evaluateNode(node.child, featureMap, values, ruleMap, activeRuleIds);
    return {
      nodeId: node.nodeId,
      kind: node.kind,
      label: 'NOT',
      value: child.value === 'TRUE' ? 'FALSE' : child.value === 'FALSE' ? 'TRUE' : 'UNKNOWN',
      children: [child],
    };
  }

  const children = node.children.map(child =>
    evaluateNode(child, featureMap, values, ruleMap, activeRuleIds),
  );
  const childValues = children.map(child => child.value);
  const value: TruthValue = node.kind === 'and'
    ? childValues.includes('FALSE')
      ? 'FALSE'
      : childValues.every(item => item === 'TRUE')
        ? 'TRUE'
        : 'UNKNOWN'
    : childValues.includes('TRUE')
      ? 'TRUE'
      : childValues.every(item => item === 'FALSE')
        ? 'FALSE'
        : 'UNKNOWN';

  return {
    nodeId: node.nodeId,
    kind: node.kind,
    label: node.kind.toUpperCase(),
    value,
    children,
  };
}

export function evaluateRule(
  rule: RuleDefinition,
  features: FeatureDefinition[],
  values: Record<string, unknown>,
  options: RuleEvaluationOptions = {},
): EvaluationTrace {
  return evaluateNode(
    rule.root,
    new Map(features.map(feature => [feature.id, feature])),
    values,
    new Map((options.rules ?? []).map(item => [item.id, item])),
    new Set([rule.id]),
  );
}

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
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

const operatorLabels = OPERATOR_LABELS;

export const OPERATORS_BY_TYPE: Record<FeatureValueType, ConditionOperator[]> = {
  boolean: ['is_true', 'is_false', 'eq', 'neq', 'is_null', 'is_not_null'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'],
  string: ['eq', 'neq', 'in', 'not_in', 'is_null', 'is_not_null'],
  category: ['eq', 'neq', 'in', 'not_in', 'is_null', 'is_not_null'],
  set: ['contains', 'not_contains', 'contains_any', 'contains_all', 'is_null', 'is_not_null'],
  timestamp: [
    'eq',
    'neq',
    'before',
    'after',
    'on_or_before',
    'on_or_after',
    'between',
    'is_null',
    'is_not_null',
  ],
};

const operatorsByType = OPERATORS_BY_TYPE;

export const VALUE_FREE_OPERATORS = new Set<ConditionOperator>([
  'is_true',
  'is_false',
  'is_null',
  'is_not_null',
]);

const valueFreeOperators = VALUE_FREE_OPERATORS;


const displayValue = (value: unknown): string => {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    return /\s|[()"]/.test(value) ? JSON.stringify(value) : value;
  }
  return String(value);
};

const versionedDisplayName = (
  item: { name: string; version: number },
  items: Iterable<{ name: string; version: number }>,
): string => {
  const duplicateCount = [...items].filter(candidate => candidate.name === item.name).length;
  return duplicateCount > 1 ? `${item.name}@v${item.version}` : item.name;
};

function renderLispNode(
  node: RuleAst,
  featureMap: Map<string, FeatureDefinition>,
  ruleMap: Map<string, RuleDefinition>,
  depth: number,
): string {
  const indent = ' '.repeat(depth);
  if (node.kind === 'condition') {
    const feature = featureMap.get(node.featureId);
    const featureName = feature
      ? versionedDisplayName(feature, featureMap.values())
      : node.featureId;
    const operator = operatorLabels[node.operator];
    const values = valueFreeOperators.has(node.operator)
      ? ''
      : node.operator === 'between'
        ? ` ${displayValue(node.value)} ${displayValue(node.secondValue)}`
        : ` ${displayValue(node.value)}`;
    return `${indent}(${displayValue(featureName)} ${operator}${values})`;
  }
  if (node.kind === 'ruleRef') {
    const referenced = ruleMap.get(node.ruleId);
    const name = referenced
      ? versionedDisplayName(referenced, ruleMap.values())
      : node.ruleId;
    return `${indent}${displayValue(name)}`;
  }
  if (node.kind === 'not') {
    return `${indent}(NOT\n${renderLispNode(node.child, featureMap, ruleMap, depth + 1)})`;
  }
  return `${indent}(${node.kind.toUpperCase()}\n${
    node.children.map(child => renderLispNode(child, featureMap, ruleMap, depth + 1)).join('\n')
  })`;
}

export function renderRuleLisp(
  rule: RuleDefinition,
  features: FeatureDefinition[],
  rules: RuleDefinition[] = [],
): string {
  return `(${displayValue(rule.name)}\n${renderLispNode(
    rule.root,
    new Map(features.map(feature => [feature.id, feature])),
    new Map(rules.map(item => [item.id, item])),
    1,
  )})`;
}

function explainNode(
  node: RuleAst,
  featureMap: Map<string, FeatureDefinition>,
  ruleMap: Map<string, RuleDefinition>,
): string {
  if (node.kind === 'condition') {
    const name = featureMap.get(node.featureId)?.name ?? node.featureId;
    const value = valueFreeOperators.has(node.operator)
      ? ''
      : node.operator === 'between'
        ? `${displayValue(node.value)}和${displayValue(node.secondValue)}`
        : displayValue(node.value);
    const operator = node.operator === 'is_true' || node.operator === 'is_false'
      ? `为${operatorLabels[node.operator]}`
      : operatorLabels[node.operator];
    return `${name}${operator}${value}`;
  }
  if (node.kind === 'ruleRef') return `子规则“${ruleMap.get(node.ruleId)?.name ?? node.ruleId}”成立`;
  if (node.kind === 'not') return `排除：${explainNode(node.child, featureMap, ruleMap)}`;
  const children = node.children.map(child => explainNode(child, featureMap, ruleMap));
  return node.kind === 'and'
    ? `同时满足：${children.join('；')}`
    : `其中任一成立：${children.join('；')}`;
}

export function renderRuleExplanation(
  rule: RuleDefinition,
  features: FeatureDefinition[],
  rules: RuleDefinition[] = [],
): string {
  return `${rule.name}：${explainNode(
    rule.root,
    new Map(features.map(feature => [feature.id, feature])),
    new Map(rules.map(item => [item.id, item])),
  )}`;
}

const MAX_RECOMMENDED_NESTING_DEPTH = 4;

function validateNode(
  node: RuleAst,
  featureMap: Map<string, FeatureDefinition>,
  ruleMap: Map<string, RuleDefinition>,
  activeRuleIds: Set<string>,
  depth: number,
  report: RuleValidationReport,
): void {
  report.maxDepth = Math.max(report.maxDepth, depth);
  if (depth > MAX_RECOMMENDED_NESTING_DEPTH) {
    report.warnings.push({
      code: 'deep_nesting',
      nodeId: node.nodeId,
      message: `建议将深层嵌套拆分为可复用的子规则（ruleRef），当前深度 ${depth} 层`,
    });
  }
  if (node.kind === 'condition') {
    const feature = featureMap.get(node.featureId);
    if (!feature) {
      report.errors.push({
        code: 'missing_feature',
        nodeId: node.nodeId,
        message: `特征版本不存在：${node.featureId}`,
      });
      return;
    }
    if (feature.status !== 'active') {
      report.errors.push({
        code: 'inactive_feature',
        nodeId: node.nodeId,
        message: `特征“${feature.name}”尚未启用`,
      });
    }
    if (!operatorsByType[feature.valueType].includes(node.operator)) {
      report.errors.push({
        code: 'invalid_operator',
        nodeId: node.nodeId,
        message: `特征“${feature.name}”不支持操作符“${operatorLabels[node.operator]}”`,
      });
    }
    if (!valueFreeOperators.has(node.operator) && node.value === undefined) {
      report.errors.push({
        code: 'missing_value',
        nodeId: node.nodeId,
        message: `条件“${feature.name} ${operatorLabels[node.operator]}”缺少参数值`,
      });
    }
    if (node.operator === 'between' && node.secondValue === undefined) {
      report.errors.push({
        code: 'missing_value',
        nodeId: node.nodeId,
        message: `条件“${feature.name} 介于”缺少第二个参数值`,
      });
    }
    const addInvalidValue = (message: string): void => {
      report.errors.push({
        code: 'invalid_value',
        nodeId: node.nodeId,
        message,
      });
    };
    if (!valueFreeOperators.has(node.operator) && node.value !== undefined) {
      const values = (
        node.operator === 'in'
        || node.operator === 'not_in'
        || node.operator === 'contains_any'
        || node.operator === 'contains_all'
      )
        ? Array.isArray(node.value) ? node.value : []
        : [node.value];
      if (
        (
          node.operator === 'in'
          || node.operator === 'not_in'
          || node.operator === 'contains_any'
          || node.operator === 'contains_all'
        )
        && values.length === 0
      ) {
        addInvalidValue(`条件“${feature.name} ${operatorLabels[node.operator]}”需要非空数组参数`);
      }
      if (
        feature.valueType === 'number'
        && [...values, ...(node.operator === 'between' ? [node.secondValue] : [])]
          .some(value => typeof value !== 'number' || !Number.isFinite(value))
      ) {
        addInvalidValue(`特征“${feature.name}”的比较参数必须是有限数值`);
      }
      if (
        feature.valueType === 'timestamp'
        && [...values, ...(node.operator === 'between' ? [node.secondValue] : [])]
          .some(value => toComparableTime(value) === null)
      ) {
        addInvalidValue(`特征“${feature.name}”的比较参数必须是有效时间`);
      }
      if (
        feature.valueType === 'boolean'
        && (node.operator === 'eq' || node.operator === 'neq')
        && typeof node.value !== 'boolean'
      ) {
        addInvalidValue(`特征“${feature.name}”的比较参数必须是布尔值`);
      }
      if (
        node.operator === 'between'
        && node.secondValue !== undefined
        && (
          feature.valueType === 'number'
            ? Number(node.value) > Number(node.secondValue)
            : feature.valueType === 'timestamp'
              ? toComparableTime(node.value)! > toComparableTime(node.secondValue)!
              : false
        )
      ) {
        addInvalidValue(`条件“${feature.name} 介于”的起始值不得晚于或大于结束值`);
      }
    }
    return;
  }
  if (node.kind === 'ruleRef') {
    const referenced = ruleMap.get(node.ruleId);
    if (!referenced) {
      report.errors.push({
        code: 'missing_rule',
        nodeId: node.nodeId,
        message: `子规则版本不存在：${node.ruleId}`,
      });
      return;
    }
    if (activeRuleIds.has(node.ruleId)) {
      report.errors.push({
        code: 'cyclic_rule_reference',
        nodeId: node.nodeId,
        message: `检测到循环规则引用：${referenced.name}`,
      });
      return;
    }
    validateNode(
      referenced.root,
      featureMap,
      ruleMap,
      new Set(activeRuleIds).add(node.ruleId),
      depth + 1,
      report,
    );
    return;
  }
  if (node.kind === 'not') {
    if (!node.child) {
      report.errors.push({
        code: 'invalid_arity',
        nodeId: node.nodeId,
        message: 'NOT 必须且只能包含一个直接子节点',
      });
      return;
    }
    validateNode(node.child, featureMap, ruleMap, activeRuleIds, depth + 1, report);
    return;
  }
  if (!Array.isArray(node.children) || node.children.length < 2) {
    report.errors.push({
      code: 'invalid_arity',
      nodeId: node.nodeId,
      message: `${node.kind.toUpperCase()} 至少需要两个直接子节点`,
    });
    return;
  }
  node.children.forEach(child =>
    validateNode(child, featureMap, ruleMap, activeRuleIds, depth + 1, report),
  );
}

export function validateRule(
  rule: RuleDefinition,
  features: FeatureDefinition[],
  rules: RuleDefinition[] = [],
): RuleValidationReport {
  const report: RuleValidationReport = {
    valid: true,
    errors: [],
    warnings: [],
    maxDepth: 1,
  };
  validateNode(
    rule.root,
    new Map(features.map(feature => [feature.id, feature])),
    new Map(rules.map(item => [item.id, item])),
    new Set([rule.id]),
    1,
    report,
  );
  report.valid = report.errors.length === 0;
  return report;
}

const quoteIdentifier = (identifier: string): string =>
  `"${identifier.replace(/"/g, '""')}"`;

const COMPUTED_SQL_KEYWORDS = new Set([
  'and',
  'as',
  'between',
  'boolean',
  'case',
  'date',
  'decimal',
  'double',
  'else',
  'end',
  'false',
  'float',
  'in',
  'integer',
  'interval',
  'not',
  'null',
  'or',
  'then',
  'timestamp',
  'true',
  'varchar',
  'when',
]);

const CONTROLLED_COMPUTED_FUNCTIONS = new Set([
  'abs',
  'ceil',
  'coalesce',
  'date_diff',
  'date_part',
  'floor',
  'greatest',
  'least',
  'length',
  'lower',
  'nullif',
  'round',
  'upper',
]);

export function compileFeatureExpression(feature: FeatureDefinition): string {
  if (feature.source.kind === 'column') {
    return quoteIdentifier(feature.source.column);
  }
  if (feature.source.kind === 'ontology_property') {
    const pathKey = feature.source.propertyKey
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
    const extracted = `json_extract_string(${quoteIdentifier(feature.source.jsonColumn)}, '$."${pathKey}"')`;
    if (feature.valueType === 'number') return `TRY_CAST(${extracted} AS DOUBLE)`;
    if (feature.valueType === 'boolean') return `TRY_CAST(${extracted} AS BOOLEAN)`;
    if (feature.valueType === 'timestamp') return `TRY_CAST(${extracted} AS TIMESTAMP)`;
    return extracted;
  }
  if (feature.source.kind === 'ontology_relation') {
    if (!Number.isSafeInteger(feature.source.linkTypeId)) {
      throw new Error(`Ontology relation feature ${feature.name} has an invalid link type`);
    }
    const linkAlias = quoteIdentifier('__ontology_link');
    const populationAlias = quoteIdentifier('__population');
    const subjectColumn = feature.source.direction === 'outgoing'
      ? 'source_object_id'
      : 'target_object_id';
    return `CASE WHEN EXISTS (SELECT 1 FROM ${quoteIdentifier(feature.source.linkTable)} AS ${linkAlias}`
      + ` WHERE ${linkAlias}.${quoteIdentifier('link_type_id')} = ${feature.source.linkTypeId}`
      + ` AND ${linkAlias}.${quoteIdentifier(subjectColumn)} = ${populationAlias}.${quoteIdentifier(feature.source.objectIdColumn)})`
      + ' THEN TRUE ELSE NULL END';
  }
  const expression = feature.source.expression.trim();
  if (
    expression.length === 0
    || /;|--|\/\*|\*\//.test(expression)
    || /\b(attach|copy|create|delete|drop|export|from|import|insert|install|load|pragma|select|update)\b/i
      .test(expression)
  ) {
    throw new Error(`Computed feature ${feature.name} contains unsafe SQL`);
  }
  const dependencies = new Set(feature.source.dependencies.map(dependency => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(dependency)) {
      throw new Error(`Computed feature ${feature.name} has an unsafe dependency`);
    }
    return dependency.toLowerCase();
  }));
  const allowedFunctions = new Set(
    feature.source.allowedFunctions.map(name => name.toLowerCase()),
  );
  const functionNames = new Set(
    [...expression.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)]
      .map(match => match[1].toLowerCase()),
  );
  for (const functionName of functionNames) {
    if (!CONTROLLED_COMPUTED_FUNCTIONS.has(functionName)) {
      throw new Error(
        `Computed feature ${feature.name} uses function ${functionName}, `
        + 'which is not system-controlled',
      );
    }
    if (!allowedFunctions.has(functionName)) {
      throw new Error(
        `Computed feature ${feature.name} uses function ${functionName}, which is not allowed`,
      );
    }
  }
  const expressionWithoutStrings = expression.replace(/'(?:''|[^'])*'/g, '');
  const identifiers = expressionWithoutStrings.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) ?? [];
  for (const identifier of identifiers) {
    const normalized = identifier.toLowerCase();
    if (
      functionNames.has(normalized)
      || dependencies.has(normalized)
      || COMPUTED_SQL_KEYWORDS.has(normalized)
    ) {
      continue;
    }
    throw new Error(
      `Computed feature ${feature.name} references undeclared field ${identifier}`,
    );
  }
  return `(${expression})`;
}

function compileContains(
  expression: string,
  feature: FeatureDefinition,
  values: unknown[],
  mode: 'any' | 'all',
  params: unknown[],
): string {
  const source = feature.source.kind === 'column' ? feature.source : undefined;
  const encoding = source?.encoding ?? (feature.valueType === 'set' ? 'json_array' : 'scalar');
  const clauses = values.map(value => {
    params.push(value);
    if (encoding === 'native_list') return `list_contains(${expression}, ?)`;
    if (encoding === 'csv') {
      return `list_contains(string_split(${expression}, ','), CAST(? AS VARCHAR))`;
    }
    if (encoding === 'json_array') {
      return `json_contains(TRY_CAST(${expression} AS JSON), to_json(?))`;
    }
    return `contains(CAST(${expression} AS VARCHAR), CAST(? AS VARCHAR))`;
  });
  return `(CASE WHEN ${expression} IS NULL THEN NULL ELSE (${
    clauses.join(mode === 'all' ? ' AND ' : ' OR ')
  }) END)`;
}

function compileNode(
  node: RuleAst,
  featureMap: Map<string, FeatureDefinition>,
  ruleMap: Map<string, RuleDefinition>,
  params: unknown[],
  activeRuleIds: Set<string>,
  featureIds: Set<string>,
): string {
  if (node.kind === 'condition') {
    const feature = featureMap.get(node.featureId);
    if (!feature) throw new Error(`Cannot compile missing feature: ${node.featureId}`);
    featureIds.add(feature.id);
    const expression = compileFeatureExpression(feature);
    if (node.operator === 'is_true') return `(${expression} = TRUE)`;
    if (node.operator === 'is_false') return `(${expression} = FALSE)`;
    if (node.operator === 'is_null') return `(${expression} IS NULL)`;
    if (node.operator === 'is_not_null') return `(${expression} IS NOT NULL)`;
    const simpleOperators: Partial<Record<ConditionOperator, string>> = {
      eq: '=',
      neq: '<>',
      gt: '>',
      gte: '>=',
      lt: '<',
      lte: '<=',
      before: '<',
      after: '>',
      on_or_before: '<=',
      on_or_after: '>=',
    };
    const sqlOperator = simpleOperators[node.operator];
    if (sqlOperator) {
      params.push(node.value);
      return `(${expression} ${sqlOperator} ?)`;
    }
    if (node.operator === 'between') {
      params.push(node.value, node.secondValue);
      return `(${expression} BETWEEN ? AND ?)`;
    }
    if (node.operator === 'in' || node.operator === 'not_in') {
      const values = Array.isArray(node.value) ? node.value : [node.value];
      if (values.length === 0) return node.operator === 'in' ? 'FALSE' : 'TRUE';
      params.push(...values);
      return `(${expression} ${node.operator === 'not_in' ? 'NOT ' : ''}IN (${
        values.map(() => '?').join(', ')
      }))`;
    }
    if (node.operator === 'contains' || node.operator === 'not_contains') {
      const sql = compileContains(expression, feature, [node.value], 'any', params);
      return node.operator === 'not_contains' ? `(NOT ${sql})` : sql;
    }
    if (node.operator === 'contains_any' || node.operator === 'contains_all') {
      return compileContains(
        expression,
        feature,
        Array.isArray(node.value) ? node.value : [node.value],
        node.operator === 'contains_all' ? 'all' : 'any',
        params,
      );
    }
    throw new Error(`Unsupported condition operator: ${node.operator}`);
  }
  if (node.kind === 'ruleRef') {
    const referenced = ruleMap.get(node.ruleId);
    if (!referenced) throw new Error(`Cannot compile missing rule: ${node.ruleId}`);
    if (activeRuleIds.has(node.ruleId)) throw new Error(`Cyclic rule reference: ${node.ruleId}`);
    return compileNode(
      referenced.root,
      featureMap,
      ruleMap,
      params,
      new Set(activeRuleIds).add(node.ruleId),
      featureIds,
    );
  }
  if (node.kind === 'not') {
    return `(NOT ${compileNode(node.child, featureMap, ruleMap, params, activeRuleIds, featureIds)})`;
  }
  return `(${node.children.map(child =>
    compileNode(child, featureMap, ruleMap, params, activeRuleIds, featureIds),
  ).join(node.kind === 'and' ? ' AND ' : ' OR ')})`;
}

const fnv1a = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export function compileRule(
  rule: RuleDefinition,
  features: FeatureDefinition[],
  rules: RuleDefinition[] = [],
): CompiledRule {
  const validation = validateRule(rule, features, rules);
  if (!validation.valid) {
    throw new Error(validation.errors.map(issue => issue.message).join('; '));
  }
  const params: unknown[] = [];
  const featureIds = new Set<string>();
  const predicateSql = compileNode(
    rule.root,
    new Map(features.map(feature => [feature.id, feature])),
    new Map(rules.map(item => [item.id, item])),
    params,
    new Set([rule.id]),
    featureIds,
  );
  const lisp = renderRuleLisp(rule, features, rules);
  const explanation = renderRuleExplanation(rule, features, rules);
  const fingerprint = fnv1a(JSON.stringify({
    ruleId: rule.id,
    root: rule.root,
    features: [...featureIds].sort().map(id => {
      const feature = features.find(item => item.id === id)!;
      return { id, source: feature.source, valueType: feature.valueType };
    }),
    predicateSql,
    params,
  }));
  return {
    predicateSql,
    params,
    fingerprint,
    lisp,
    explanation,
    featureIds: [...featureIds],
  };
}

function tokenizeLisp(source: string): string[] {
  const tokens: string[] = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === '(' || character === ')') {
      tokens.push(character);
      index += 1;
      continue;
    }
    if (character === '"') {
      let end = index + 1;
      let escaped = false;
      while (end < source.length) {
        const current = source[end];
        if (!escaped && current === '"') break;
        escaped = !escaped && current === '\\';
        if (current !== '\\') escaped = false;
        end += 1;
      }
      if (end >= source.length) throw new Error('中文 Lisp 包含未闭合的字符串');
      tokens.push(source.slice(index, end + 1));
      index = end + 1;
      continue;
    }
    let end = index;
    while (end < source.length && !/[\s()]/.test(source[end])) end += 1;
    tokens.push(source.slice(index, end));
    index = end;
  }
  return tokens;
}

const parseLispValue = (token: string): unknown => {
  if (token.startsWith('"')) return JSON.parse(token);
  if (token.startsWith('[')) {
    try {
      const value = JSON.parse(token);
      if (!Array.isArray(value)) throw new Error('not an array');
      return value;
    } catch {
      throw new Error(`中文 Lisp 数组参数不是有效 JSON：${token}`);
    }
  }
  if (/^-?(?:\d+|\d*\.\d+)$/.test(token)) return Number(token);
  if (token === 'TRUE' || token === 'true') return true;
  if (token === 'FALSE' || token === 'false') return false;
  if (token === 'NULL' || token === 'null') return null;
  return token;
};

export function parseRuleLisp(
  source: string,
  currentRule: RuleDefinition,
  features: FeatureDefinition[],
  rules: RuleDefinition[] = [],
): RuleDefinition {
  const tokens = tokenizeLisp(source);
  let cursor = 0;
  const take = (): string => {
    const token = tokens[cursor];
    if (token === undefined) throw new Error('中文 Lisp 意外结束');
    cursor += 1;
    return token;
  };
  const expect = (expected: string): void => {
    const actual = take();
    if (actual !== expected) throw new Error(`中文 Lisp 期望“${expected}”，实际为“${actual}”`);
  };
  const uniqueFeature = (name: string): FeatureDefinition => {
    const versioned = /^(.*)@v(\d+)$/.exec(name);
    if (versioned) {
      const match = features.find(feature =>
        feature.name === versioned[1] && feature.version === Number(versioned[2]),
      );
      if (match) return match;
    }
    const matches = features.filter(feature => feature.name === name);
    if (matches.length === 0) throw new Error(`找不到业务特征“${name}”`);
    if (matches.length > 1) throw new Error(`业务特征名称“${name}”不唯一`);
    return matches[0];
  };
  const uniqueRule = (name: string): RuleDefinition => {
    const versioned = /^(.*)@v(\d+)$/.exec(name);
    if (versioned) {
      const match = rules.find(rule =>
        rule.name === versioned[1] && rule.version === Number(versioned[2]),
      );
      if (match) return match;
    }
    const matches = rules.filter(rule => rule.name === name);
    if (matches.length === 0) throw new Error(`找不到子规则“${name}”`);
    if (matches.length > 1) throw new Error(`子规则名称“${name}”不唯一`);
    return matches[0];
  };
  const operatorByLabel = new Map(
    Object.entries(operatorLabels).map(([operator, label]) => [
      label,
      operator as ConditionOperator,
    ]),
  );

  const parseExpression = (path: string): RuleAst => {
    if (tokens[cursor] !== '(') {
      const referenced = uniqueRule(String(parseLispValue(take())));
      return { kind: 'ruleRef', nodeId: path, ruleId: referenced.id };
    }
    expect('(');
    const head = String(parseLispValue(take()));
    if (head === 'AND' || head === 'OR') {
      const children: RuleAst[] = [];
      while (tokens[cursor] !== ')') {
        children.push(parseExpression(`${path}-${children.length}`));
      }
      expect(')');
      return {
        kind: head === 'AND' ? 'and' : 'or',
        nodeId: path,
        children,
      };
    }
    if (head === 'NOT') {
      if (tokens[cursor] === ')') {
        throw new Error('NOT 必须且只能包含一个直接子节点');
      }
      const child = parseExpression(`${path}-0`);
      if (tokens[cursor] !== ')') {
        throw new Error('NOT 必须且只能包含一个直接子节点');
      }
      expect(')');
      return { kind: 'not', nodeId: path, child };
    }

    const feature = uniqueFeature(head);
    const operatorLabel = take();
    const operator = operatorByLabel.get(operatorLabel);
    if (!operator) throw new Error(`不支持的条件操作符“${operatorLabel}”`);
    const value = valueFreeOperators.has(operator) ? undefined : parseLispValue(take());
    const secondValue = operator === 'between' ? parseLispValue(take()) : undefined;
    if (tokens[cursor] !== ')') {
      throw new Error(`判断条件“${head} ${operatorLabel}”包含多余内容`);
    }
    expect(')');
    return {
      kind: 'condition',
      nodeId: path,
      featureId: feature.id,
      operator,
      ...(value !== undefined ? { value } : {}),
      ...(secondValue !== undefined ? { secondValue } : {}),
    };
  };

  expect('(');
  const name = take();
  const root = parseExpression('root');
  expect(')');
  if (cursor !== tokens.length) throw new Error('中文 Lisp 规则结尾包含多余内容');

  const parsed: RuleDefinition = {
    ...currentRule,
    name: parseLispValue(name) as string,
    root,
  };
  const validation = validateRule(parsed, features, rules);
  if (!validation.valid) {
    throw new Error(validation.errors.map(issue => issue.message).join('; '));
  }
  return parsed;
}

const stableValue = (value: unknown): string => {
  if (value instanceof Date) return `date:${value.toISOString()}`;
  if (Array.isArray(value)) return `[${value.map(stableValue).sort().join(',')}]`;
  if (value instanceof Set) return `[${[...value].map(stableValue).sort().join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableValue(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const situationLabel = (value: unknown): string => {
  if (Array.isArray(value)) return value.length > 0 ? value.map(String).sort().join('、') : '空集合';
  if (value instanceof Set) return value.size > 0 ? [...value].map(String).sort().join('、') : '空集合';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
};

const wilsonInterval = (successes: number, total: number): [number, number] => {
  if (total <= 0) return [0, 0];
  const z = 1.959963984540054;
  const proportion = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (proportion + (z * z) / (2 * total)) / denominator;
  const margin = (
    z
    * Math.sqrt((proportion * (1 - proportion) + (z * z) / (4 * total)) / total)
    / denominator
  );
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
};

let inferenceRunSequence = 0;

const createInferenceRunId = (): string => {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) return `inference-${randomId}`;
  inferenceRunSequence += 1;
  return `inference-${Date.now()}-${inferenceRunSequence}`;
};

interface MutableSituation {
  key: string;
  states: SituationState[];
  rows: Array<Record<string, unknown>>;
}

interface ClassifiedFeatureState extends SituationState {
  key: string;
}

interface FeatureClassifier {
  feature: FeatureDefinition;
  classify(value: unknown): ClassifiedFeatureState;
}

const collectConditions = (
  node: RuleAst,
  ruleMap: Map<string, RuleDefinition>,
  target: Map<string, ConditionNode[]>,
  activeRuleIds: Set<string>,
): void => {
  if (node.kind === 'condition') {
    const existing = target.get(node.featureId) ?? [];
    existing.push(node);
    target.set(node.featureId, existing);
    return;
  }
  if (node.kind === 'ruleRef') {
    if (activeRuleIds.has(node.ruleId)) return;
    const referenced = ruleMap.get(node.ruleId);
    if (!referenced) return;
    collectConditions(
      referenced.root,
      ruleMap,
      target,
      new Set(activeRuleIds).add(node.ruleId),
    );
    return;
  }
  if (node.kind === 'not') {
    collectConditions(node.child, ruleMap, target, activeRuleIds);
    return;
  }
  node.children.forEach(child =>
    collectConditions(child, ruleMap, target, activeRuleIds),
  );
};

const conditionBoundaryValues = (condition: ConditionNode): unknown[] => {
  if (condition.operator === 'between') {
    return [condition.value, condition.secondValue];
  }
  if (condition.operator === 'in' || condition.operator === 'not_in') {
    return Array.isArray(condition.value) ? condition.value : [condition.value];
  }
  if (
    condition.operator === 'is_true'
    || condition.operator === 'is_false'
    || condition.operator === 'is_null'
    || condition.operator === 'is_not_null'
    || condition.operator === 'contains'
    || condition.operator === 'not_contains'
    || condition.operator === 'contains_any'
    || condition.operator === 'contains_all'
  ) {
    return [];
  }
  return [condition.value];
};

const comparableValue = (
  value: unknown,
  valueType: FeatureValueType,
): number | null => {
  if (valueType === 'timestamp') return toComparableTime(value);
  if (valueType !== 'number') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const displayBoundary = (
  boundary: number,
  valueType: FeatureValueType,
): string => valueType === 'timestamp'
  ? new Date(boundary).toISOString()
  : String(boundary);

const createFeatureClassifier = (
  feature: FeatureDefinition,
  conditions: ConditionNode[],
  rows: Array<Record<string, unknown>>,
): FeatureClassifier => {
  if (feature.valueType === 'number' || feature.valueType === 'timestamp') {
    const ruleBoundaries = conditions
      .flatMap(conditionBoundaryValues)
      .map(value => comparableValue(value, feature.valueType))
      .filter((value): value is number => value !== null);
    const uniqueRuleBoundaries = [...new Set(ruleBoundaries)].sort((left, right) => left - right);
    let boundaries = uniqueRuleBoundaries;
    let preserveExactBoundary = boundaries.length > 0;
    if (boundaries.length === 0) {
      const observed = rows
        .map(row => comparableValue(row[feature.id], feature.valueType))
        .filter((value): value is number => value !== null)
        .sort((left, right) => left - right);
      boundaries = [...new Set([0.2, 0.4, 0.6, 0.8]
        .map(quantile => observed[Math.min(
          observed.length - 1,
          Math.max(0, Math.ceil(observed.length * quantile) - 1),
        )])
        .filter((value): value is number => value !== undefined))];
      preserveExactBoundary = false;
    }
    return {
      feature,
      classify(value) {
        const comparable = comparableValue(value, feature.valueType);
        if (comparable === null) {
          return {
            key: 'UNKNOWN',
            featureId: feature.id,
            featureName: feature.name,
            value,
            label: 'UNKNOWN',
          };
        }
        if (boundaries.length === 0) {
          return {
            key: `value:${stableValue(value)}`,
            featureId: feature.id,
            featureName: feature.name,
            value,
            label: situationLabel(value),
          };
        }
        const exactIndex = boundaries.findIndex(boundary => boundary === comparable);
        if (preserveExactBoundary && exactIndex >= 0) {
          const label = `= ${displayBoundary(boundaries[exactIndex], feature.valueType)}`;
          return {
            key: `boundary:${exactIndex}`,
            featureId: feature.id,
            featureName: feature.name,
            value,
            label,
          };
        }
        const upperIndex = boundaries.findIndex(boundary =>
          preserveExactBoundary ? comparable < boundary : comparable <= boundary,
        );
        const intervalIndex = upperIndex >= 0 ? upperIndex : boundaries.length;
        const label = intervalIndex === 0
          ? `${preserveExactBoundary ? '<' : '≤'} ${displayBoundary(boundaries[0], feature.valueType)}`
          : intervalIndex === boundaries.length
            ? `> ${displayBoundary(boundaries[boundaries.length - 1], feature.valueType)}`
            : `${preserveExactBoundary ? '(' : '('}${
              displayBoundary(boundaries[intervalIndex - 1], feature.valueType)
            }, ${displayBoundary(boundaries[intervalIndex], feature.valueType)}${
              preserveExactBoundary ? ')' : ']'
            }`;
        return {
          key: `interval:${intervalIndex}`,
          featureId: feature.id,
          featureName: feature.name,
          value,
          label,
        };
      },
    };
  }

  if (feature.valueType === 'set' && conditions.length > 0) {
    return {
      feature,
      classify(value) {
        const signature = conditions.map(condition =>
          evaluateCondition(condition, feature, value).value,
        );
        if (signature.includes('UNKNOWN')) {
          return {
            key: 'UNKNOWN',
            featureId: feature.id,
            featureName: feature.name,
            value,
            label: 'UNKNOWN',
          };
        }
        return {
          key: `condition-signature:${signature.join('|')}`,
          featureId: feature.id,
          featureName: feature.name,
          value,
          label: conditions.map((condition, index) =>
            `${operatorLabels[condition.operator]} ${situationLabel(condition.value)}：${
              signature[index]
            }`,
          ).join('；'),
        };
      },
    };
  }

  return {
    feature,
    classify(value) {
      return {
        key: stableValue(value),
        featureId: feature.id,
        featureName: feature.name,
        value,
        label: situationLabel(value),
      };
    },
  };
};

const buildLogicalSituations = (
  classifiers: FeatureClassifier[],
  observedStates: Array<Map<string, ClassifiedFeatureState>>,
  selectedRules: RuleDefinition[],
  allFeatures: FeatureDefinition[],
  allRules: RuleDefinition[],
  observedKeys: Set<string>,
  beamWidth: number,
): { situations: MutableSituation[]; theoreticalCount: number } => {
  const options = classifiers.map((classifier, index) => {
    const available = new Map(observedStates[index]);
    for (const domainValue of classifier.feature.domain ?? []) {
      const state = classifier.classify(domainValue);
      if (state.key !== 'UNKNOWN') available.set(state.key, state);
    }
    return [...available.values()].sort((left, right) => left.key.localeCompare(right.key));
  });
  if (options.some(featureOptions => featureOptions.length === 0)) {
    return { situations: [], theoreticalCount: 0 };
  }
  const theoreticalCount = options.reduce(
    (total, featureOptions) => total * featureOptions.length,
    1,
  );
  const enumerationLimit = Math.min(
    theoreticalCount,
    Math.max(beamWidth * 20, beamWidth),
  );
  let combinations: ClassifiedFeatureState[][] = [[]];
  for (const featureOptions of options) {
    const expanded: ClassifiedFeatureState[][] = [];
    for (const combination of combinations) {
      for (const state of featureOptions) {
        expanded.push([...combination, state]);
        if (expanded.length >= enumerationLimit) break;
      }
      if (expanded.length >= enumerationLimit) break;
    }
    combinations = expanded;
  }
  return {
    theoreticalCount,
    situations: combinations
      .map(states => {
        const key = states.map(state => state.key).join('|');
        const representative = Object.fromEntries(
          states.map(state => [state.featureId, state.value]),
        );
        const truthScore = selectedRules.reduce((score, rule) => {
          const value = evaluateRule(rule, allFeatures, representative, {
            rules: allRules,
          }).value;
          return score + (value === 'TRUE' ? 2 : value === 'UNKNOWN' ? 1 : 0);
        }, 0);
        return {
          situation: {
            key,
            states: states.map(({ key: _key, ...state }) => state),
            rows: [],
          },
          truthScore,
        };
      })
      .filter(item => !observedKeys.has(item.situation.key))
      .sort((left, right) =>
        right.truthScore - left.truthScore
        || left.situation.key.localeCompare(right.situation.key),
      )
      .slice(0, beamWidth)
      .map(item => item.situation),
  };
};

function classifyAndRankCandidate(
  candidate: SituationCandidate,
  request: InferenceRequest,
): SituationCandidate {
  const ruleTruths = candidate.ruleResults.map(result => result.trace.value);
  const status: SituationCandidate['status'] = ruleTruths.includes('FALSE')
    ? 'EXCLUDED'
    : (ruleTruths.length > 0 && ruleTruths.every(value => value === 'TRUE'))
      || (ruleTruths.length === 0 && candidate.count > 0)
      ? 'ESTABLISHED'
      : 'POSSIBLE';
  const ruleCount = Math.max(1, ruleTruths.length);
  const evidenceCoverage = candidate.count > 0 ? 1 : 0;
  const configuredReliability = candidate.states.map(state =>
    request.ranking?.featureReliability?.[state.featureId],
  ).filter((value): value is number => typeof value === 'number');
  const reliability = configuredReliability.length > 0
    ? configuredReliability.reduce((sum, value) => sum + clamp(value, 0, 1), 0)
      / configuredReliability.length
    : candidate.count > 0 ? 1 : 0.5;
  const conditionSatisfaction = ruleTruths.filter(value => value === 'TRUE').length / ruleCount;
  const conflictPenalty = candidate.ruleResults.filter(result =>
    result.trueCount > 0 && result.falseCount > 0,
  ).length / ruleCount;
  const unknownPenalty = ruleTruths.filter(value => value === 'UNKNOWN').length / ruleCount;
  const historicalValidation = clamp(
    request.ranking?.historicalValidation?.[candidate.id] ?? 0,
    0,
    1,
  );
  const stateWeights = candidate.states.map(state =>
    request.ranking?.manualWeights?.[`${state.featureId}:${stableValue(state.value)}`]
      ?? request.ranking?.manualWeights?.[state.featureId]
      ?? 0,
  );
  const manualWeight = stateWeights.length > 0
    ? clamp(stateWeights.reduce((sum, value) => sum + value, 0) / stateWeights.length, -1, 1)
    : 0;
  const weights: RankingWeights = {
    ...DEFAULT_RANKING_WEIGHTS,
    ...request.ranking?.weights,
  };
  const numerator = evidenceCoverage * weights.evidenceCoverage
    + reliability * weights.reliability
    + conditionSatisfaction * weights.conditionSatisfaction
    + historicalValidation * weights.historicalValidation
    + manualWeight * weights.manualWeight
    - conflictPenalty * weights.conflictPenalty
    - unknownPenalty * weights.unknownPenalty;
  const denominator = Object.values(weights)
    .reduce((sum, weight) => sum + Math.abs(weight), 0) || 1;
  const score = Math.round(clamp(100 * numerator / denominator, 0, 100) * 100) / 100;
  const reasons = [
    candidate.count > 0
      ? `由 ${candidate.count} 个真实对象状态支持`
      : '逻辑候选，尚无真实对象状态支持',
    ruleTruths.length === 0
      ? 'Ontology 尚未定义可执行约束'
      : `${ruleTruths.filter(value => value === 'TRUE').length}/${ruleTruths.length} 条约束成立`,
  ];
  if (unknownPenalty > 0) reasons.push(`${Math.round(unknownPenalty * 100)}% 约束因事实缺失而未知`);
  if (conflictPenalty > 0) reasons.push('历史对象对同一规则给出冲突证据');
  if (status === 'EXCLUDED') reasons.push('至少一条约束明确不成立');
  if (manualWeight !== 0) reasons.push(`人工权重 ${manualWeight > 0 ? '+' : ''}${manualWeight.toFixed(2)}`);
  return {
    ...candidate,
    status,
    ranking: {
      evidenceCoverage,
      reliability,
      conditionSatisfaction,
      conflictPenalty,
      unknownPenalty,
      historicalValidation,
      manualWeight,
      score,
      reasons,
    },
  };
}

function collectMissingConditions(
  ruleResults: InferenceRuleResult[],
): CandidateMissingCondition[] {
  const collectLeaves = (trace: EvaluationTrace): EvaluationTrace[] => {
    if (trace.value !== 'UNKNOWN') return [];
    const unknownChildren = (trace.children ?? []).flatMap(collectLeaves);
    return unknownChildren.length > 0 ? unknownChildren : [trace];
  };
  return ruleResults.flatMap(result => collectLeaves(result.trace).map(trace => ({
    ruleId: result.ruleId,
    ruleName: result.ruleName,
    nodeId: trace.nodeId,
    featureId: trace.featureId,
    label: trace.label,
    value: 'UNKNOWN' as const,
    reason: trace.reason ?? 'The required fact is unknown in the current ontology snapshot',
    actual: trace.actual,
    expected: trace.expected,
  })));
}

function buildCounterfactuals(
  source: SituationCandidate,
  candidates: SituationCandidate[],
): CandidateCounterfactual[] {
  const targetPriority: Record<SituationCandidate['status'], number> = {
    ESTABLISHED: 0,
    POSSIBLE: 1,
    EXCLUDED: 2,
  };
  return candidates
    .filter(target => target.id !== source.id && target.status !== source.status)
    .map(target => {
      const targetStates = new Map(target.states.map(state => [state.featureId, state]));
      const changes = source.states.flatMap<CandidateCounterfactualChange>(state => {
        const targetState = targetStates.get(state.featureId);
        if (!targetState || stableValue(state.value) === stableValue(targetState.value)) return [];
        return [{
          featureId: state.featureId,
          featureName: state.featureName,
          from: state.value,
          to: targetState.value,
        }];
      });
      return {
        targetCandidateId: target.id,
        targetStatus: target.status,
        targetScore: target.ranking.score,
        editDistance: changes.length,
        changes,
      };
    })
    .filter(suggestion => suggestion.editDistance > 0 && suggestion.editDistance <= 3)
    .sort((left, right) =>
      left.editDistance - right.editDistance
      || targetPriority[left.targetStatus] - targetPriority[right.targetStatus]
      || right.targetScore - left.targetScore
      || left.targetCandidateId.localeCompare(right.targetCandidateId),
    )
    .slice(0, 5);
}

export function runInference(request: InferenceRequest): InferenceReport {
  const topK = Math.max(1, Math.floor(request.topK ?? 20));
  const beamWidth = Math.max(topK, Math.floor(request.beamWidth ?? 200));
  const minSampleSize = Math.max(1, Math.floor(request.minSampleSize ?? 30));
  const featureMap = new Map(request.features.map(feature => [feature.id, feature]));
  const selectedFeatures = request.selectedFeatureIds.map(featureId => {
    const feature = featureMap.get(featureId);
    if (!feature) throw new Error(`Selected feature does not exist: ${featureId}`);
    if (feature.status !== 'active') throw new Error(`Selected feature is not active: ${feature.name}`);
    return feature;
  });
  const selectedRules = request.selectedRuleIds.map(ruleId => {
    const rule = request.rules.find(item => item.id === ruleId);
    if (!rule) throw new Error(`Selected rule does not exist: ${ruleId}`);
    return rule;
  });
  const compilationFingerprint = request.compilationFingerprint ?? fnv1a(JSON.stringify({
    featureVersionIds: selectedFeatures.map(feature => feature.id),
    compiledRules: selectedRules.map(rule =>
      compileRule(rule, request.features, request.rules).fingerprint,
    ),
  }));
  const outcome = request.outcomeId
    ? request.outcomes.find(item => item.id === request.outcomeId)
    : undefined;
  if (request.outcomeId && !outcome) {
    throw new Error(`Selected outcome does not exist: ${request.outcomeId}`);
  }

  const conditionMap = new Map<string, ConditionNode[]>();
  const ruleMap = new Map(request.rules.map(rule => [rule.id, rule]));
  selectedRules.forEach(rule =>
    collectConditions(
      rule.root,
      ruleMap,
      conditionMap,
      new Set([rule.id]),
    ),
  );
  const classifiers = selectedFeatures.map(feature =>
    createFeatureClassifier(
      feature,
      conditionMap.get(feature.id) ?? [],
      request.rows,
    ),
  );
  const situations = new Map<string, MutableSituation>();
  const observedStates = classifiers.map(() => new Map<string, ClassifiedFeatureState>());
  const unknownReasonCounts = new Map<string, number>();
  const recordUnknownReason = (feature: FeatureDefinition): void => {
    unknownReasonCounts.set(feature.id, (unknownReasonCounts.get(feature.id) ?? 0) + 1);
  };
  let unknownPopulation = 0;
  for (const row of request.rows) {
    const values = selectedFeatures.map(feature => row[feature.id]);
    const classifiedStates = classifiers.map((classifier, index) =>
      isUnknown(values[index]) ? undefined : classifier.classify(values[index]),
    );
    classifiedStates.forEach((state, index) => {
      if (state && state.key !== 'UNKNOWN') observedStates[index].set(state.key, state);
    });
    if (values.some(isUnknown) || classifiedStates.some(state => !state || state.key === 'UNKNOWN')) {
      unknownPopulation += 1;
      values.forEach((value, index) => {
        if (isUnknown(value) || classifiedStates[index]?.key === 'UNKNOWN') {
          recordUnknownReason(selectedFeatures[index]);
        }
      });
      continue;
    }
    const knownStates = classifiedStates as ClassifiedFeatureState[];
    const key = knownStates.map(state => state.key).join('|');
    const existing = situations.get(key);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    situations.set(key, {
      key,
      states: knownStates.map(({ key: _key, ...state }) => state),
      rows: [row],
    });
  }

  const knownPopulation = request.rows.length - unknownPopulation;
  const rankedSituations = [...situations.values()]
    .sort((left, right) => right.rows.length - left.rows.length || left.key.localeCompare(right.key));
  const logical = selectedRules.length === 0
    ? { situations: [], theoreticalCount: rankedSituations.length }
    : buildLogicalSituations(
        classifiers,
        observedStates,
        selectedRules,
        request.features,
        request.rules,
        new Set(rankedSituations.map(situation => situation.key)),
        beamWidth,
      );
  const considered = [
    ...rankedSituations.slice(0, beamWidth),
    ...logical.situations.slice(0, Math.max(0, beamWidth - rankedSituations.length)),
  ];
  const candidatesWithoutCounterfactuals = considered.map((situation, index): SituationCandidate => {
    const representative = situation.rows[0] ?? Object.fromEntries(
      situation.states.map(state => [state.featureId, state.value]),
    );
    const ruleResults = selectedRules.map(rule => {
      const evaluations = situation.rows.map(row =>
        evaluateRule(rule, request.features, row, { rules: request.rules }),
      );
      const representativeTrace = evaluateRule(
        rule,
        request.features,
        representative,
        { rules: request.rules },
      );
      const aggregateTruth: TruthValue = evaluations.length === 0
        ? representativeTrace.value
        : evaluations.every(item => item.value === 'TRUE')
          ? 'TRUE'
          : evaluations.every(item => item.value === 'FALSE')
            ? 'FALSE'
            : 'UNKNOWN';
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        trueCount: evaluations.filter(item => item.value === 'TRUE').length,
        falseCount: evaluations.filter(item => item.value === 'FALSE').length,
        unknownCount: evaluations.filter(item => item.value === 'UNKNOWN').length,
        trace: { ...representativeTrace, value: aggregateTruth },
      };
    });
    const candidate: SituationCandidate = {
      id: `situation-${fnv1a(situation.key)}`,
      rank: index + 1,
      states: situation.states,
      sourceObjectIds: situation.rows
        .map(row => row.__objectId)
        .filter((objectId): objectId is number => typeof objectId === 'number'),
      count: situation.rows.length,
      probability: knownPopulation > 0 ? situation.rows.length / knownPopulation : 0,
      probabilityInterval: wilsonInterval(situation.rows.length, knownPopulation),
      smallSample: situation.rows.length < minSampleSize,
      evidenceKind: situation.rows.length === 0
        ? 'logical_only'
        : outcome?.labelBinding
          ? 'empirical_probability'
          : 'empirical_frequency',
      ruleResults,
      status: 'POSSIBLE',
      ranking: {
        evidenceCoverage: 0,
        reliability: 0,
        conditionSatisfaction: 0,
        conflictPenalty: 0,
        unknownPenalty: 0,
        historicalValidation: 0,
        manualWeight: 0,
        score: 0,
        reasons: [],
      },
      missingConditions: collectMissingConditions(ruleResults),
      counterfactuals: [],
    };
    if (outcome?.labelBinding && situation.rows.length > 0) {
      const labelledRows = situation.rows.filter(row => !isUnknown(row.__outcome));
      const positive = labelledRows.filter(row =>
        Object.is(row.__outcome, outcome.labelBinding!.positiveValue),
      ).length;
      candidate.outcomeKnownCount = labelledRows.length;
      candidate.outcomeProbability = labelledRows.length > 0
        ? (positive + 1) / (situation.rows.length + 2)
        : undefined;
    }
    if (outcome?.expertPrior) {
      const prior = outcome.expertPrior.priorProbability;
      if (!(prior > 0 && prior < 1)) {
        throw new Error('Expert prior probability must be between 0 and 1');
      }
      let odds = prior / (1 - prior);
      for (const likelihood of outcome.expertPrior.likelihoods) {
        if (!(likelihood.likelihoodRatio > 0)) {
          throw new Error('Expert likelihood ratios must be greater than 0');
        }
        const state = candidate.states.find(item =>
          item.featureId === likelihood.featureId,
        );
        if (
          state
          && stableValue(state.value) === stableValue(likelihood.stateValue)
        ) {
          odds *= likelihood.likelihoodRatio;
        }
      }
      candidate.expertPriorProbability = odds / (1 + odds);
    }
    return classifyAndRankCandidate(candidate, request);
  });
  const allCandidates = candidatesWithoutCounterfactuals.map(candidate => ({
    ...candidate,
    counterfactuals: buildCounterfactuals(candidate, candidatesWithoutCounterfactuals),
  }));
  const rankCandidates = (
    values: SituationCandidate[],
    compare: (left: SituationCandidate, right: SituationCandidate) => number,
  ): SituationCandidate[] => [...values]
    .sort(compare)
    .slice(0, topK)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
  const candidates = rankCandidates(
    allCandidates,
    (left, right) =>
      right.probability - left.probability
      || right.count - left.count
      || left.id.localeCompare(right.id),
  );
  const outcomeCandidates = outcome?.labelBinding
    ? rankCandidates(
      allCandidates,
      (left, right) =>
        (right.outcomeProbability ?? -1) - (left.outcomeProbability ?? -1)
        || (right.outcomeKnownCount ?? 0) - (left.outcomeKnownCount ?? 0)
        || right.probability - left.probability
        || left.id.localeCompare(right.id),
    )
    : [];
  const rankedCandidates = rankCandidates(
    allCandidates,
    (left, right) =>
      right.ranking.score - left.ranking.score
      || right.count - left.count
      || left.id.localeCompare(right.id),
  );
  const byStatus = (status: SituationCandidate['status']): SituationCandidate[] =>
    allCandidates
      .filter(candidate => candidate.status === status)
      .sort((left, right) =>
        right.ranking.score - left.ranking.score
        || right.count - left.count
        || left.id.localeCompare(right.id),
      );
  const totalCandidateCount = Math.max(rankedSituations.length, logical.theoreticalCount);

  return {
    runId: createInferenceRunId(),
    generatedAt: new Date().toISOString(),
    knownPopulation,
    unknownPopulation,
    unknownRate: request.rows.length > 0 ? unknownPopulation / request.rows.length : 0,
    candidates,
    rankedCandidates,
    establishedCandidates: byStatus('ESTABLISHED'),
    possibleCandidates: byStatus('POSSIBLE'),
    excludedCandidates: byStatus('EXCLUDED'),
    outcomeCandidates,
    unknownReasons: [...unknownReasonCounts.entries()].map(([featureId, count]) => {
      const feature = featureMap.get(featureId)!;
      return {
        featureId,
        featureName: feature.name,
        count,
        reason: feature.nullSemantics,
      };
    }).sort((left, right) => right.count - left.count || left.featureId.localeCompare(right.featureId)),
    totalCandidateCount,
    omittedCandidateCount: Math.max(0, totalCandidateCount - candidates.length),
    truncated: totalCandidateCount > beamWidth,
    beamWidth,
    topK,
    executedSql: request.executedSql,
    params: [...request.params],
    compilationFingerprint,
    featureVersionIds: selectedFeatures.map(feature => feature.id),
    ruleVersionIds: selectedRules.map(rule => rule.id),
  };
}

export interface FeatureExplanation {
  name: string;
  logicalId: string;
  valueType: string;
  sourceKind: string;
  sourceDescription: string;
  nullSemantics: string;
  window?: { value: number; unit: string; description: string };
  domain?: unknown[];
}

export function explainFeature(feature: FeatureDefinition): FeatureExplanation {
  const sourceDescriptions: Record<string, (source: any) => string> = {
    column: (s) => `数据表 ${s.table} 列 ${s.column}${s.encoding && s.encoding !== 'scalar' ? ` (${s.encoding} 编码)` : ''}`,
    computed: (s) => `计算表达式：${s.expression}（依赖 ${s.dependencies.join('、')}）`,
    ontology_property: (s) => `本体属性 ${s.propertyKey}（来自 ${s.jsonColumn}）`,
    ontology_relation: (s) => `${s.direction === 'outgoing' ? '发出' : '接收'}关系（关系类型 #${s.linkTypeId}）`,
  };
  const describer = sourceDescriptions[feature.source.kind];
  return {
    name: feature.name,
    logicalId: feature.logicalId,
    valueType: feature.valueType,
    sourceKind: feature.source.kind,
    sourceDescription: describer ? describer(feature.source) : feature.source.kind,
    nullSemantics: feature.nullSemantics,
    window: feature.window ? {
      value: feature.window.value,
      unit: feature.window.unit,
      description: `统计周期：${feature.window.value} ${feature.window.unit}`,
    } : undefined,
    domain: feature.domain,
  };
}

export interface NullSemanticsReport {
  featureId: string;
  featureName: string;
  trueDescription: string;
  falseDescription: string;
  unknownDescription: string;
  recommendation: string;
}

export function estimateNullSemantics(feature: FeatureDefinition): NullSemanticsReport {
  const isBooleanLike = feature.valueType === 'boolean';
  const isRelation = feature.source.kind === 'ontology_relation';
  return {
    featureId: feature.id,
    featureName: feature.name,
    trueDescription: isBooleanLike
      ? `${feature.name} 明确为真`
      : `${feature.name} 存在有效值`,
    falseDescription: isBooleanLike
      ? `${feature.name} 明确为假`
      : `${feature.name} 明确不满足条件`,
    unknownDescription: isRelation
      ? `未记录该关系时为 UNKNOWN；只有显式不存在断言才是 FALSE`
      : `${feature.name} 未记录或数据缺失时为 UNKNOWN，不自动推断为 TRUE 或 FALSE`,
    recommendation: isRelation
      ? '建议在规则中显式处理关系不存在的情况'
      : isBooleanLike
        ? '建议规则同时覆盖 TRUE、FALSE 和 UNKNOWN 三种状态'
        : '建议在条件中使用 is_null / is_not_null 运算符显式处理缺失值',
  };
}
