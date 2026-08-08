import { duckDBService } from '../duckdbService';

export type OntologyTruthValue = 'TRUE' | 'FALSE' | 'UNKNOWN';
export type OntologyPropertyValueType =
  | 'boolean'
  | 'number'
  | 'string'
  | 'array'
  | 'object'
  | 'null';

export interface OntologyPropertyDefinition {
  id: string;
  logicalId: string;
  version: number;
  objectTypeId: number;
  key: string;
  name: string;
  valueType: OntologyPropertyValueType;
  nullable: boolean;
  status: 'candidate' | 'active' | 'conflicted' | 'archived';
  conflictTypes?: OntologyPropertyValueType[];
}

export interface OntologyRuleVariable {
  name: string;
  objectTypeId: number;
}

export type OntologyPropertyOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'is_missing'
  | 'is_present';

export type OntologyCondition =
  | {
      kind: 'and' | 'or';
      children: OntologyCondition[];
    }
  | {
      kind: 'not';
      child: OntologyCondition;
    }
  | {
      kind: 'property';
      variable: string;
      propertyId: string;
      operator: OntologyPropertyOperator;
      value?: unknown;
    }
  | {
      kind: 'relation';
      sourceVariable: string;
      linkTypeId: number;
      targetVariable: string;
      operator: 'exists' | 'not_exists';
    }
  | {
      kind: 'derived';
      predicate: string;
      variables: string[];
      operator: 'exists' | 'not_exists';
    };

export type OntologyEffect =
  | {
      kind: 'set_property' | 'unset_property';
      variable: string;
      propertyId: string;
      value?: unknown;
    }
  | {
      kind: 'add_relation' | 'remove_relation';
      sourceVariable: string;
      linkTypeId: number;
      targetVariable: string;
    }
  | {
      kind: 'assert_conclusion' | 'retract_conclusion';
      predicate: string;
      variables: string[];
    };

export interface OntologyRuleDefinition {
  id: string;
  logicalId: string;
  version: number;
  name: string;
  status: 'draft' | 'active' | 'archived';
  priority: number;
  variables: OntologyRuleVariable[];
  when: OntologyCondition;
  effects: OntologyEffect[];
}

export interface OntologyActionDefinition {
  id: string;
  logicalId: string;
  version: number;
  name: string;
  status: 'draft' | 'active' | 'archived';
  variables: OntologyRuleVariable[];
  precondition?: OntologyCondition;
  effects: OntologyEffect[];
  sourceActionId?: number;
}

export interface OntologyReasoningCatalog {
  propertyDefinitions: OntologyPropertyDefinition[];
  rules: OntologyRuleDefinition[];
  actionDefinitions: OntologyActionDefinition[];
}

export interface OntologyProjectionSource {
  activeTemplateId?: string;
  objectTypes?: Array<{ id: number; name: string; description?: string }>;
  objects?: Array<{
    id: number;
    object_type_id: number;
    name?: string;
    properties?: string | Record<string, unknown>;
    annotations?: string;
  }>;
  linkTypes?: Array<{ id: number; name: string; description?: string }>;
  links?: Array<{
    id: number;
    link_type_id: number;
    source_object_id: number;
    target_object_id: number;
    weight?: number;
  }>;
  actions?: Array<{ id: number; name: string; description?: string; object_id?: number }>;
}

export interface OntologySnapshot {
  snapshotId: string;
  createdAt: string;
  ontologyId: string;
  objectTypes: NonNullable<OntologyProjectionSource['objectTypes']>;
  objects: Array<{
    id: number;
    objectTypeId: number;
    name: string;
    properties: Record<string, unknown>;
  }>;
  linkTypes: NonNullable<OntologyProjectionSource['linkTypes']>;
  links: Array<{
    id: number;
    linkTypeId: number;
    sourceObjectId: number;
    targetObjectId: number;
    weight: number;
  }>;
  descriptiveActions: NonNullable<OntologyProjectionSource['actions']>;
  catalog: OntologyReasoningCatalog;
}

export type OntologyAssumption =
  | {
      kind: 'set_property';
      objectId: number;
      propertyId: string;
      value?: unknown;
    }
  | {
      kind: 'unset_property';
      objectId: number;
      propertyId: string;
    }
  | {
      kind: 'add_relation';
      sourceObjectId: number;
      linkTypeId: number;
      targetObjectId: number;
    }
  | {
      kind: 'remove_relation';
      sourceObjectId: number;
      linkTypeId: number;
      targetObjectId: number;
    };

export interface OntologyActionSelection {
  actionDefinitionId: string;
  bindings: Record<string, number>;
  order: number;
}

export interface OntologySimulationScenario {
  assumptions: OntologyAssumption[];
  actions: OntologyActionSelection[];
  focusObjectIds?: number[];
  goal?: {
    condition: OntologyCondition;
    bindings: Record<string, number>;
  };
}

export interface OntologySimulationLimits {
  maxRuleIterations?: number;
  maxBranches?: number;
  maxCounterfactualDistance?: number;
}

export interface OntologyPropertyFact {
  objectId: number;
  propertyId: string;
  value: unknown;
  origin: 'ontology' | 'assumption' | 'action' | 'derived';
  sourceId?: string;
}

export interface OntologyRelationFact {
  sourceObjectId: number;
  linkTypeId: number;
  targetObjectId: number;
  origin: 'ontology' | 'assumption' | 'action' | 'derived';
  sourceId?: string;
}

export interface OntologyPathStep {
  kind: 'assumption' | 'action' | 'rule' | 'blocked_action';
  label: string;
  ruleId?: string;
  actionDefinitionId?: string;
  ruleVersion?: number;
  binding: Record<string, number>;
  evidence: string[];
  changes: string[];
}

export interface OntologyMissingCondition {
  ruleId: string;
  ruleName: string;
  truth: OntologyTruthValue;
  binding: Record<string, number>;
  objectId?: number;
  propertyId?: string;
  expected?: unknown;
  actual?: unknown;
  operator?: OntologyPropertyOperator | 'exists' | 'not_exists';
  sourceObjectId?: number;
  linkTypeId?: number;
  targetObjectId?: number;
  description: string;
}

export interface OntologyConflict {
  slot: string;
  ruleIds: string[];
  alternatives: unknown[];
  resolvedByPriority: boolean;
}

export interface OntologySimulationBranch {
  id: string;
  properties: OntologyPropertyFact[];
  relations: OntologyRelationFact[];
  conclusions: string[];
  path: OntologyPathStep[];
  proofs: Array<{
    target: string;
    steps: OntologyPathStep[];
  }>;
}

export interface OntologyCounterfactual {
  ruleId: string;
  description: string;
  distance: number;
  changes: OntologyMissingCondition[];
}

export interface OntologySimulationReport {
  runId: string;
  generatedAt: string;
  snapshotId: string;
  modelIssues: string[];
  existingProperties: OntologyPropertyFact[];
  existingRelations: OntologyRelationFact[];
  branches: OntologySimulationBranch[];
  conflicts: OntologyConflict[];
  missingConditions: OntologyMissingCondition[];
  counterfactuals: OntologyCounterfactual[];
  goalResults: Array<{
    branchId: string;
    truth: OntologyTruthValue;
  }>;
  truncated: boolean;
  limits: Required<OntologySimulationLimits>;
}

export interface OntologyReasoningDatabase {
  executeTransaction(statements: string[]): Promise<unknown>;
  query(sql: string): Promise<Array<Record<string, unknown>>>;
  queryWithParams(sql: string, params: unknown[]): Promise<Array<Record<string, unknown>>>;
}

const DEFAULT_LIMITS: Required<OntologySimulationLimits> = {
  maxRuleIterations: 20,
  maxBranches: 200,
  maxCounterfactualDistance: 3,
};

export const ONTOLOGY_REASONING_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS _sys_ontology_property_definition (
    definition_id VARCHAR PRIMARY KEY,
    logical_id VARCHAR NOT NULL,
    version INTEGER NOT NULL,
    status VARCHAR NOT NULL,
    definition_json VARCHAR NOT NULL,
    fingerprint VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(logical_id, version)
  )`,
  `CREATE TABLE IF NOT EXISTS _sys_ontology_rule_definition (
    definition_id VARCHAR PRIMARY KEY,
    logical_id VARCHAR NOT NULL,
    version INTEGER NOT NULL,
    status VARCHAR NOT NULL,
    definition_json VARCHAR NOT NULL,
    fingerprint VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(logical_id, version)
  )`,
  `CREATE TABLE IF NOT EXISTS _sys_ontology_action_definition (
    definition_id VARCHAR PRIMARY KEY,
    logical_id VARCHAR NOT NULL,
    version INTEGER NOT NULL,
    status VARCHAR NOT NULL,
    definition_json VARCHAR NOT NULL,
    fingerprint VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(logical_id, version)
  )`,
  `CREATE TABLE IF NOT EXISTS _sys_ontology_reasoning_run (
    run_id VARCHAR PRIMARY KEY,
    generated_at TIMESTAMP NOT NULL,
    snapshot_json VARCHAR NOT NULL,
    scenario_json VARCHAR NOT NULL,
    report_json VARCHAR NOT NULL
  )`,
];

const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const json = (value: unknown): string => JSON.stringify(
  value,
  (_key, nested) => typeof nested === 'bigint' ? nested.toString() : nested,
);

const parseProperties = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return structuredClone(value as Record<string, unknown>);
  }
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const valueType = (value: unknown): OntologyPropertyValueType => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'object') return 'object';
  return 'string';
};

const propertyAcceptsValue = (property: OntologyPropertyDefinition, value: unknown): boolean => {
  if (value === null) return property.nullable;
  if (value === undefined) return true;
  return valueType(value) === property.valueType;
};

const propertyDefinitionId = (objectTypeId: number, key: string): string =>
  `property.${objectTypeId}.${stableHash(key)}`;

export function discoverPropertyDefinitions(
  source: OntologyProjectionSource,
): OntologyPropertyDefinition[] {
  const observed = new Map<string, {
    objectTypeId: number;
    key: string;
    types: Set<OntologyPropertyValueType>;
    nullable: boolean;
  }>();
  for (const object of source.objects ?? []) {
    const properties = parseProperties(object.properties);
    const declaredSchema = properties.schema && typeof properties.schema === 'object'
      ? properties.schema as Record<string, unknown>
      : {};
    for (const [key, raw] of Object.entries(properties)) {
      if (key === 'schema') continue;
      const mapKey = `${object.object_type_id}:${key}`;
      const entry = observed.get(mapKey) ?? {
        objectTypeId: object.object_type_id,
        key,
        types: new Set<OntologyPropertyValueType>(),
        nullable: false,
      };
      entry.types.add(valueType(raw));
      if (raw === null || raw === undefined) entry.nullable = true;
      observed.set(mapKey, entry);
    }
    for (const [key, declared] of Object.entries(declaredSchema)) {
      const mapKey = `${object.object_type_id}:${key}`;
      const entry = observed.get(mapKey) ?? {
        objectTypeId: object.object_type_id,
        key,
        types: new Set<OntologyPropertyValueType>(),
        nullable: true,
      };
      const normalized = String(declared).toLowerCase();
      if (normalized.includes('bool')) entry.types.add('boolean');
      else if (normalized.includes('int') || normalized.includes('number') || normalized.includes('double')) entry.types.add('number');
      else if (normalized.includes('array') || normalized.includes('list')) entry.types.add('array');
      else if (normalized.includes('object') || normalized.includes('json')) entry.types.add('object');
      else entry.types.add('string');
      observed.set(mapKey, entry);
    }
  }
  return [...observed.values()].map((entry): OntologyPropertyDefinition => {
    const nonNullTypes = [...entry.types].filter(type => type !== 'null').sort();
    const conflicted = nonNullTypes.length > 1;
    const id = propertyDefinitionId(entry.objectTypeId, entry.key);
    return {
      id,
      logicalId: id,
      version: 1,
      objectTypeId: entry.objectTypeId,
      key: entry.key,
      name: entry.key,
      valueType: (nonNullTypes[0] ?? 'null') as OntologyPropertyValueType,
      nullable: entry.nullable || entry.types.has('null'),
      status: conflicted ? 'conflicted' : 'candidate',
      ...(conflicted ? { conflictTypes: nonNullTypes } : {}),
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
}

export function createOntologySnapshot(
  source: OntologyProjectionSource,
  catalog: OntologyReasoningCatalog,
): OntologySnapshot {
  const discovered = discoverPropertyDefinitions(source);
  const explicitKeys = new Set(catalog.propertyDefinitions.map(item =>
    `${item.objectTypeId}:${item.key}`));
  const propertyDefinitions = [
    ...catalog.propertyDefinitions.map(item => structuredClone(item)),
    ...discovered.filter(item => !explicitKeys.has(`${item.objectTypeId}:${item.key}`)),
  ];
  const serializable = {
    ontologyId: source.activeTemplateId || 'current-ontology',
    objectTypes: source.objectTypes ?? [],
    objects: (source.objects ?? []).map(object => ({
      id: object.id,
      objectTypeId: object.object_type_id,
      name: object.name ?? `#${object.id}`,
      properties: parseProperties(object.properties),
    })),
    linkTypes: source.linkTypes ?? [],
    links: (source.links ?? []).map(link => ({
      id: link.id,
      linkTypeId: link.link_type_id,
      sourceObjectId: link.source_object_id,
      targetObjectId: link.target_object_id,
      weight: link.weight ?? 1,
    })),
    descriptiveActions: source.actions ?? [],
    catalog: {
      propertyDefinitions,
      rules: catalog.rules.map(item => structuredClone(item)),
      actionDefinitions: catalog.actionDefinitions.map(item => structuredClone(item)),
    },
  };
  return {
    snapshotId: `snapshot-${stableHash(json(serializable))}`,
    createdAt: new Date().toISOString(),
    ...serializable,
  };
}

const collectVariableNames = (condition: OntologyCondition, names: Set<string>): void => {
  if ('children' in condition) {
    condition.children.forEach(child => collectVariableNames(child, names));
  } else if (condition.kind === 'not') collectVariableNames(condition.child, names);
  else if (condition.kind === 'property') names.add(condition.variable);
  else if (condition.kind === 'relation') {
    names.add(condition.sourceVariable);
    names.add(condition.targetVariable);
  } else if ('variables' in condition) condition.variables.forEach(name => names.add(name));
};

const visitConditions = (
  condition: OntologyCondition,
  visitor: (condition: OntologyCondition) => void,
): void => {
  visitor(condition);
  if (condition.kind === 'and' || condition.kind === 'or') {
    condition.children.forEach(child => visitConditions(child, visitor));
  } else if (condition.kind === 'not') {
    visitConditions(condition.child, visitor);
  }
};

export function validateOntologySnapshot(snapshot: OntologySnapshot): string[] {
  const issues: string[] = [];
  const objectTypeIds = new Set(snapshot.objectTypes.map(item => item.id));
  const propertyMap = new Map(snapshot.catalog.propertyDefinitions.map(item => [item.id, item]));
  const linkTypeIds = new Set(snapshot.linkTypes.map(item => item.id));
  const objectIds = new Set(snapshot.objects.map(item => item.id));
  snapshot.links.forEach(link => {
    if (!objectIds.has(link.sourceObjectId) || !objectIds.has(link.targetObjectId)) {
      issues.push(`关系 ${link.id} 引用了不存在的对象`);
    }
    if (!linkTypeIds.has(link.linkTypeId)) issues.push(`关系 ${link.id} 的关系类型不存在`);
  });
  const validateDefinition = (
    definition: OntologyRuleDefinition | OntologyActionDefinition,
    condition: OntologyCondition | undefined,
  ) => {
    const variables = new Map(definition.variables.map(variable => [variable.name, variable]));
    definition.variables.forEach(variable => {
      if (!objectTypeIds.has(variable.objectTypeId)) {
        issues.push(`${definition.name} 的变量 ${variable.name} 引用了不存在的对象类型`);
      }
    });
    const used = new Set<string>();
    if (condition) {
      collectVariableNames(condition, used);
      visitConditions(condition, node => {
        if (node.kind === 'property') {
          const property = propertyMap.get(node.propertyId);
          if (!property || property.status !== 'active') {
            issues.push(`${definition.name} 引用了未激活属性 ${node.propertyId}`);
          } else {
            const variable = variables.get(node.variable);
            if (variable && variable.objectTypeId !== property.objectTypeId) {
              issues.push(`${definition.name} 的属性 ${node.propertyId} 与变量 ${node.variable} 类型不一致`);
            }
            if (!['is_missing', 'is_present'].includes(node.operator) && !propertyAcceptsValue(property, node.value)) {
              issues.push(`${definition.name} 的条件值不符合属性 ${node.propertyId} 的 ${property.valueType} 类型`);
            }
          }
        } else if (node.kind === 'relation' && !linkTypeIds.has(node.linkTypeId)) {
          issues.push(`${definition.name} 引用了不存在的关系类型 ${node.linkTypeId}`);
        }
      });
    }
    definition.effects.forEach(effect => {
      if (effect.kind === 'set_property' || effect.kind === 'unset_property') {
        used.add(effect.variable);
        const property = propertyMap.get(effect.propertyId);
        if (!property || property.status !== 'active') {
          issues.push(`${definition.name} 引用了未激活属性 ${effect.propertyId}`);
        } else if (effect.kind === 'set_property' && !propertyAcceptsValue(property, effect.value)) {
          issues.push(`${definition.name} 的效果值不符合属性 ${effect.propertyId} 的 ${property.valueType} 类型`);
        }
      } else if (effect.kind === 'add_relation' || effect.kind === 'remove_relation') {
        used.add(effect.sourceVariable);
        used.add(effect.targetVariable);
        if (!linkTypeIds.has(effect.linkTypeId)) issues.push(`${definition.name} 引用了不存在的关系类型`);
      } else if ('variables' in effect) effect.variables.forEach(name => used.add(name));
    });
    used.forEach(name => {
      if (!variables.has(name)) issues.push(`${definition.name} 引用了未声明变量 ${name}`);
    });
  };
  snapshot.catalog.rules.filter(rule => rule.status === 'active').forEach(rule =>
    validateDefinition(rule, rule.when));
  snapshot.catalog.actionDefinitions.filter(action => action.status === 'active').forEach(action =>
    validateDefinition(action, action.precondition));

  const dependencyGraph = new Map<string, Set<string>>();
  snapshot.catalog.rules.filter(rule => rule.status === 'active').forEach(rule => {
    const dependencies = new Set<string>();
    visitConditions(rule.when, condition => {
      if (condition.kind === 'derived' && condition.operator === 'exists') {
        dependencies.add(condition.predicate);
      }
    });
    rule.effects.forEach(effect => {
      if (effect.kind !== 'assert_conclusion') return;
      const current = dependencyGraph.get(effect.predicate) ?? new Set<string>();
      dependencies.forEach(predicate => current.add(predicate));
      dependencyGraph.set(effect.predicate, current);
    });
  });
  const visited = new Set<string>();
  const activePath = new Set<string>();
  const path: string[] = [];
  const visitPredicate = (predicate: string): void => {
    if (activePath.has(predicate)) {
      const cycleStart = path.indexOf(predicate);
      issues.push(`派生规则存在循环：${[...path.slice(cycleStart), predicate].join(' -> ')}`);
      return;
    }
    if (visited.has(predicate)) return;
    visited.add(predicate);
    activePath.add(predicate);
    path.push(predicate);
    dependencyGraph.get(predicate)?.forEach(visitPredicate);
    path.pop();
    activePath.delete(predicate);
  };
  dependencyGraph.forEach((_dependencies, predicate) => visitPredicate(predicate));
  return [...new Set(issues)];
}

interface World {
  properties: Map<string, OntologyPropertyFact>;
  missingProperties: Set<string>;
  relations: Map<string, OntologyRelationFact>;
  missingRelations: Set<string>;
  conclusions: Set<string>;
  retractedConclusions: Set<string>;
  path: OntologyPathStep[];
  handled: Set<string>;
}

interface Evaluation {
  truth: OntologyTruthValue;
  missing: Array<Omit<OntologyMissingCondition, 'ruleId' | 'ruleName' | 'binding'>>;
  evidence: string[];
}

const propertySlot = (objectId: number, propertyId: string): string => `${objectId}|${propertyId}`;
const relationSlot = (source: number, type: number, target: number): string => `${source}|${type}|${target}`;
const conclusionSlot = (predicate: string, ids: number[]): string => `${predicate}|${ids.join('|')}`;

const cloneWorld = (world: World): World => ({
  properties: new Map([...world.properties].map(([key, fact]) => [key, structuredClone(fact)])),
  missingProperties: new Set(world.missingProperties),
  relations: new Map([...world.relations].map(([key, fact]) => [key, structuredClone(fact)])),
  missingRelations: new Set(world.missingRelations),
  conclusions: new Set(world.conclusions),
  retractedConclusions: new Set(world.retractedConclusions),
  path: world.path.map(step => structuredClone(step)),
  handled: new Set(world.handled),
});

const compare = (actual: unknown, operator: OntologyPropertyOperator, expected: unknown): OntologyTruthValue => {
  if (operator === 'is_missing') return actual === undefined ? 'TRUE' : 'FALSE';
  if (operator === 'is_present') return actual === undefined ? 'FALSE' : 'TRUE';
  if (actual === undefined || actual === null) return 'UNKNOWN';
  if (operator === 'eq') return Object.is(actual, expected) ? 'TRUE' : 'FALSE';
  if (operator === 'neq') return Object.is(actual, expected) ? 'FALSE' : 'TRUE';
  if (operator === 'contains') {
    if (Array.isArray(actual)) return actual.some(item => Object.is(item, expected)) ? 'TRUE' : 'FALSE';
    if (typeof actual === 'string') return actual.includes(String(expected)) ? 'TRUE' : 'FALSE';
    return 'UNKNOWN';
  }
  const left = Number(actual);
  const right = Number(expected);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 'UNKNOWN';
  if (operator === 'gt') return left > right ? 'TRUE' : 'FALSE';
  if (operator === 'gte') return left >= right ? 'TRUE' : 'FALSE';
  if (operator === 'lt') return left < right ? 'TRUE' : 'FALSE';
  return left <= right ? 'TRUE' : 'FALSE';
};

const evaluateCondition = (
  condition: OntologyCondition,
  world: World,
  binding: Record<string, number>,
  properties: Map<string, OntologyPropertyDefinition>,
): Evaluation => {
  if (condition.kind === 'property') {
    const objectId = binding[condition.variable];
    const slot = propertySlot(objectId, condition.propertyId);
    const fact = world.properties.get(slot);
    const explicitlyMissing = world.missingProperties.has(slot);
    const truth = fact
      ? compare(fact.value, condition.operator, condition.value)
      : explicitlyMissing
        ? condition.operator === 'is_missing' ? 'TRUE' : condition.operator === 'is_present' ? 'FALSE' : 'UNKNOWN'
        : 'UNKNOWN';
    return {
      truth,
      evidence: truth === 'TRUE'
        ? [fact?.sourceId ? `${fact.sourceId} -> ${slot}=${String(fact.value)}` : `显式缺失 ${slot}`]
        : [],
      missing: truth === 'TRUE' ? [] : [{
        truth,
        objectId,
        propertyId: condition.propertyId,
        expected: condition.value,
        actual: fact?.value,
        operator: condition.operator,
        description: `${objectId}.${properties.get(condition.propertyId)?.name ?? condition.propertyId} ${condition.operator} ${String(condition.value)}`,
      }],
    };
  }
  if (condition.kind === 'relation') {
    const source = binding[condition.sourceVariable];
    const target = binding[condition.targetVariable];
    const slot = relationSlot(source, condition.linkTypeId, target);
    const exists = world.relations.has(slot);
    const explicitlyMissing = world.missingRelations.has(slot);
    const truth = exists
      ? condition.operator === 'exists' ? 'TRUE' : 'FALSE'
      : explicitlyMissing
        ? condition.operator === 'exists' ? 'FALSE' : 'TRUE'
        : 'UNKNOWN';
    return {
      truth,
      evidence: truth === 'TRUE'
        ? [exists ? `${world.relations.get(slot)?.sourceId ?? 'relation'} -> ${slot}` : `显式不存在关系 ${slot}`]
        : [],
      missing: truth === 'TRUE' ? [] : [{
        truth,
        sourceObjectId: source,
        linkTypeId: condition.linkTypeId,
        targetObjectId: target,
        operator: condition.operator,
        description: `${source} -[${condition.linkTypeId}]-> ${target} ${condition.operator}`,
      }],
    };
  }
  if (condition.kind === 'derived') {
    const key = conclusionSlot(condition.predicate, condition.variables.map(name => binding[name]));
    const exists = world.conclusions.has(key);
    const explicitlyRetracted = world.retractedConclusions.has(key);
    const truth = exists
      ? condition.operator === 'exists' ? 'TRUE' : 'FALSE'
      : explicitlyRetracted
        ? condition.operator === 'exists' ? 'FALSE' : 'TRUE'
        : 'UNKNOWN';
    return { truth, evidence: truth === 'TRUE' ? [`派生结论 ${key}`] : [], missing: truth === 'TRUE' ? [] : [{ truth, description: key }] };
  }
  if (condition.kind === 'not') {
    const child = evaluateCondition(condition.child, world, binding, properties);
    return {
      truth: child.truth === 'TRUE' ? 'FALSE' : child.truth === 'FALSE' ? 'TRUE' : 'UNKNOWN',
      evidence: child.truth === 'FALSE' ? child.evidence : [],
      missing: child.truth === 'FALSE' ? [] : child.missing,
    };
  }
  const children = condition.children.map(child => evaluateCondition(child, world, binding, properties));
  if (condition.kind === 'and') {
    const truth = children.some(child => child.truth === 'FALSE')
      ? 'FALSE'
      : children.every(child => child.truth === 'TRUE') ? 'TRUE' : 'UNKNOWN';
    return {
      truth,
      evidence: truth === 'TRUE' ? children.flatMap(child => child.evidence) : [],
      missing: children.flatMap(child => child.truth === 'TRUE' ? [] : child.missing),
    };
  }
  const truth = children.some(child => child.truth === 'TRUE')
    ? 'TRUE'
    : children.every(child => child.truth === 'FALSE') ? 'FALSE' : 'UNKNOWN';
  if (truth === 'TRUE') {
    const satisfied = children.find(child => child.truth === 'TRUE');
    return { truth, evidence: satisfied?.evidence ?? [], missing: [] };
  }
  const alternatives = children.filter(child => child.missing.length > 0)
    .sort((left, right) => left.missing.length - right.missing.length);
  return { truth, evidence: [], missing: alternatives[0]?.missing ?? [] };
};

const enumerateBindings = (
  variables: OntologyRuleVariable[],
  snapshot: OntologySnapshot,
  focusObjectIds?: number[],
): Array<Record<string, number>> => {
  let bindings: Array<Record<string, number>> = [{}];
  for (const variable of variables) {
    const candidates = snapshot.objects.filter(object => object.objectTypeId === variable.objectTypeId);
    bindings = bindings.flatMap(binding => candidates
      .filter(object => !Object.values(binding).includes(object.id))
      .map(object => ({ ...binding, [variable.name]: object.id })));
  }
  if (!focusObjectIds?.length) return bindings;
  const focus = new Set(focusObjectIds);
  return bindings.filter(binding => Object.values(binding).some(objectId => focus.has(objectId)));
};

interface EffectProposal {
  slot: string;
  value: unknown;
  effect: OntologyEffect;
  binding: Record<string, number>;
  rule: OntologyRuleDefinition;
  signature: string;
  evidence: string[];
}

const effectSlotAndValue = (
  effect: OntologyEffect,
  binding: Record<string, number>,
): { slot: string; value: unknown } => {
  if (effect.kind === 'set_property' || effect.kind === 'unset_property') {
    return {
      slot: `property:${propertySlot(binding[effect.variable], effect.propertyId)}`,
      value: effect.kind === 'unset_property' ? undefined : effect.value,
    };
  }
  if (effect.kind === 'add_relation' || effect.kind === 'remove_relation') {
    return {
      slot: `relation:${relationSlot(binding[effect.sourceVariable], effect.linkTypeId, binding[effect.targetVariable])}`,
      value: effect.kind === 'add_relation',
    };
  }
  const conclusionEffect = effect as {
    kind: 'assert_conclusion' | 'retract_conclusion';
    predicate: string;
    variables: string[];
  };
  return {
    slot: `conclusion:${conclusionSlot(conclusionEffect.predicate, conclusionEffect.variables.map(name => binding[name]))}`,
    value: effect.kind === 'assert_conclusion',
  };
};

const applyEffect = (
  world: World,
  effect: OntologyEffect,
  binding: Record<string, number>,
  origin: OntologyPropertyFact['origin'],
  sourceId: string,
): string | null => {
  if (effect.kind === 'set_property' || effect.kind === 'unset_property') {
    const objectId = binding[effect.variable];
    const slot = propertySlot(objectId, effect.propertyId);
    const before = world.properties.get(slot)?.value;
    if (effect.kind === 'unset_property') {
      if (!world.properties.has(slot) && world.missingProperties.has(slot)) return null;
      world.properties.delete(slot);
      world.missingProperties.add(slot);
      return `${objectId}.${effect.propertyId}: ${String(before)} → 未设置`;
    }
    if (Object.is(before, effect.value)) return null;
    world.missingProperties.delete(slot);
    world.properties.set(slot, {
      objectId,
      propertyId: effect.propertyId,
      value: structuredClone(effect.value),
      origin,
      sourceId,
    });
    return `${objectId}.${effect.propertyId}: ${String(before)} → ${String(effect.value)}`;
  }
  if (effect.kind === 'add_relation' || effect.kind === 'remove_relation') {
    const sourceObjectId = binding[effect.sourceVariable];
    const targetObjectId = binding[effect.targetVariable];
    const slot = relationSlot(sourceObjectId, effect.linkTypeId, targetObjectId);
    if (effect.kind === 'remove_relation') {
      if (!world.relations.has(slot) && world.missingRelations.has(slot)) return null;
      world.relations.delete(slot);
      world.missingRelations.add(slot);
      return `移除关系 ${slot}`;
    }
    if (world.relations.has(slot)) return null;
    world.missingRelations.delete(slot);
    world.relations.set(slot, {
      sourceObjectId,
      linkTypeId: effect.linkTypeId,
      targetObjectId,
      origin,
      sourceId,
    });
    return `新增关系 ${slot}`;
  }
  const conclusionEffect = effect as {
    kind: 'assert_conclusion' | 'retract_conclusion';
    predicate: string;
    variables: string[];
  };
  const slot = conclusionSlot(conclusionEffect.predicate, conclusionEffect.variables.map(name => binding[name]));
  if (effect.kind === 'retract_conclusion') {
    if (!world.conclusions.has(slot) && world.retractedConclusions.has(slot)) return null;
    world.conclusions.delete(slot);
    world.retractedConclusions.add(slot);
    return `撤销结论 ${slot}`;
  }
  if (world.conclusions.has(slot)) return null;
  world.retractedConclusions.delete(slot);
  world.conclusions.add(slot);
  return `派生结论 ${slot}`;
};

const worldFingerprint = (world: World): string => stableHash(json({
  properties: [...world.properties].sort(([left], [right]) => left.localeCompare(right)),
  missingProperties: [...world.missingProperties].sort(),
  relations: [...world.relations.keys()].sort(),
  missingRelations: [...world.missingRelations].sort(),
  conclusions: [...world.conclusions].sort(),
  retractedConclusions: [...world.retractedConclusions].sort(),
}));

const runRuleClosure = (
  initialWorlds: World[],
  snapshot: OntologySnapshot,
  limits: Required<OntologySimulationLimits>,
  conflicts: OntologyConflict[],
  focusObjectIds?: number[],
): { worlds: World[]; truncated: boolean } => {
  const propertyMap = new Map(snapshot.catalog.propertyDefinitions.map(item => [item.id, item]));
  const rules = snapshot.catalog.rules.filter(rule => rule.status === 'active');
  let worlds = initialWorlds;
  let truncated = false;
  for (let iteration = 0; iteration < limits.maxRuleIterations; iteration += 1) {
    let changed = false;
    const nextWorlds: World[] = [];
    for (const world of worlds) {
      const proposals: EffectProposal[] = [];
      for (const rule of rules) {
        for (const binding of enumerateBindings(rule.variables, snapshot, focusObjectIds)) {
          const evaluation = evaluateCondition(rule.when, world, binding, propertyMap);
          if (evaluation.truth !== 'TRUE') continue;
          rule.effects.forEach((effect, effectIndex) => {
            const signature = `${rule.id}|${json(binding)}|${effectIndex}|${worldFingerprint(world)}`;
            if (world.handled.has(signature)) return;
            const slotAndValue = effectSlotAndValue(effect, binding);
            proposals.push({ ...slotAndValue, effect, binding, rule, signature, evidence: evaluation.evidence });
          });
        }
      }
      if (proposals.length === 0) {
        nextWorlds.push(world);
        continue;
      }
      const groups = new Map<string, EffectProposal[]>();
      proposals.forEach(proposal => groups.set(
        proposal.slot,
        [...(groups.get(proposal.slot) ?? []), proposal],
      ));
      let variants = [cloneWorld(world)];
      for (const [slot, group] of groups) {
        const maxPriority = Math.max(...group.map(item => item.rule.priority));
        const winners = group.filter(item => item.rule.priority === maxPriority);
        const alternatives = new Map<string, EffectProposal>();
        winners.forEach(item => alternatives.set(json(item.value), item));
        if (alternatives.size > 1) {
          conflicts.push({
            slot,
            ruleIds: [...new Set(winners.map(item => item.rule.id))],
            alternatives: [...alternatives.values()].map(item => item.value),
            resolvedByPriority: false,
          });
          variants = variants.flatMap(variant => [...alternatives.values()].map(choice => {
            const branch = cloneWorld(variant);
            group.forEach(item => branch.handled.add(item.signature));
            const change = applyEffect(branch, choice.effect, choice.binding, 'derived', choice.rule.id);
            if (change) {
              branch.path.push({
                kind: 'rule',
                label: choice.rule.name,
                ruleId: choice.rule.id,
                ruleVersion: choice.rule.version,
                binding: choice.binding,
                evidence: choice.evidence,
                changes: [change],
              });
              changed = true;
            }
            return branch;
          }));
        } else {
          const choice = [...alternatives.values()][0];
          variants.forEach(variant => {
            group.forEach(item => variant.handled.add(item.signature));
            const change = applyEffect(variant, choice.effect, choice.binding, 'derived', choice.rule.id);
            if (change) {
              variant.path.push({
                kind: 'rule',
                label: choice.rule.name,
                ruleId: choice.rule.id,
                ruleVersion: choice.rule.version,
                binding: choice.binding,
                evidence: choice.evidence,
                changes: [change],
              });
              changed = true;
            }
          });
          if (group.some(item => item.rule.priority < maxPriority)) {
            conflicts.push({
              slot,
              ruleIds: [...new Set(group.map(item => item.rule.id))],
              alternatives: [...new Map(group.map(item => [json(item.value), item.value])).values()],
              resolvedByPriority: true,
            });
          }
        }
      }
      nextWorlds.push(...variants);
    }
    const unique: World[] = [];
    const seen = new Set<string>();
    for (const world of nextWorlds) {
      const fingerprint = worldFingerprint(world);
      if (!seen.has(fingerprint)) {
        seen.add(fingerprint);
        unique.push(world);
      } else {
        const existing = unique.find(candidate => worldFingerprint(candidate) === fingerprint);
        world.handled.forEach(signature => existing?.handled.add(signature));
      }
      if (unique.length >= limits.maxBranches) {
        truncated = true;
        break;
      }
    }
    worlds = unique;
    if (!changed) break;
    if (iteration === limits.maxRuleIterations - 1) truncated = true;
  }
  return { worlds, truncated };
};

const createInitialWorld = (snapshot: OntologySnapshot): World => {
  const properties = new Map<string, OntologyPropertyFact>();
  const definitionsByTypeAndKey = new Map(snapshot.catalog.propertyDefinitions.map(definition => [
    `${definition.objectTypeId}:${definition.key}`,
    definition,
  ]));
  snapshot.objects.forEach(object => Object.entries(object.properties).forEach(([key, value]) => {
    if (key === 'schema') return;
    const definition = definitionsByTypeAndKey.get(`${object.objectTypeId}:${key}`);
    if (!definition) return;
    properties.set(propertySlot(object.id, definition.id), {
      objectId: object.id,
      propertyId: definition.id,
      value: structuredClone(value),
      origin: 'ontology',
      sourceId: `object:${object.id}`,
    });
  }));
  return {
    properties,
    missingProperties: new Set(),
    relations: new Map(snapshot.links.map(link => [
      relationSlot(link.sourceObjectId, link.linkTypeId, link.targetObjectId),
      {
        sourceObjectId: link.sourceObjectId,
        linkTypeId: link.linkTypeId,
        targetObjectId: link.targetObjectId,
        origin: 'ontology' as const,
        sourceId: `link:${link.id}`,
      },
    ])),
    missingRelations: new Set(),
    conclusions: new Set(),
    retractedConclusions: new Set(),
    path: [],
    handled: new Set(),
  };
};

const applyAssumptions = (world: World, assumptions: OntologyAssumption[]): void => {
  assumptions.forEach((assumption, index) => {
    const binding: Record<string, number> = {};
    let change: string | null = null;
    if (assumption.kind === 'set_property') {
      binding.subject = assumption.objectId;
      change = applyEffect(world, {
        kind: 'set_property',
        variable: 'subject',
        propertyId: assumption.propertyId,
        value: assumption.value,
      }, binding, 'assumption', `assumption:${index}`);
    } else if (assumption.kind === 'unset_property') {
      binding.subject = assumption.objectId;
      change = applyEffect(world, {
        kind: 'unset_property',
        variable: 'subject',
        propertyId: assumption.propertyId,
      }, binding, 'assumption', `assumption:${index}`);
    } else if ('sourceObjectId' in assumption) {
      binding.source = assumption.sourceObjectId;
      binding.target = assumption.targetObjectId;
      change = applyEffect(world, {
        kind: assumption.kind,
        sourceVariable: 'source',
        linkTypeId: assumption.linkTypeId,
        targetVariable: 'target',
      }, binding, 'assumption', `assumption:${index}`);
    }
    if (change) world.path.push({ kind: 'assumption', label: `假设 ${index + 1}`, binding, evidence: [`scenario.assumptions[${index}]`], changes: [change] });
  });
};

const applyAction = (
  world: World,
  selection: OntologyActionSelection,
  snapshot: OntologySnapshot,
): void => {
  const action = snapshot.catalog.actionDefinitions.find(item =>
    item.id === selection.actionDefinitionId && item.status === 'active');
  if (!action) return;
  const propertyMap = new Map(snapshot.catalog.propertyDefinitions.map(item => [item.id, item]));
  const evaluation = action.precondition
    ? evaluateCondition(action.precondition, world, selection.bindings, propertyMap)
    : { truth: 'TRUE' as const, missing: [], evidence: [] };
  if (evaluation.truth !== 'TRUE') {
    world.path.push({
      kind: 'blocked_action',
      label: action.name,
      actionDefinitionId: action.id,
      binding: selection.bindings,
      evidence: evaluation.evidence,
      changes: evaluation.missing.map(item => item.description),
    });
    return;
  }
  const changes = action.effects.map(effect => applyEffect(
    world,
    effect,
    selection.bindings,
    'action',
    action.id,
  )).filter((item): item is string => Boolean(item));
  world.path.push({
    kind: 'action',
    label: action.name,
    actionDefinitionId: action.id,
    binding: selection.bindings,
    evidence: evaluation.evidence,
    changes,
  });
};

const collectMissingConditions = (
  worlds: World[],
  snapshot: OntologySnapshot,
  focusObjectIds?: number[],
): OntologyMissingCondition[] => {
  const propertyMap = new Map(snapshot.catalog.propertyDefinitions.map(item => [item.id, item]));
  const missing: OntologyMissingCondition[] = [];
  for (const world of worlds) {
    for (const rule of snapshot.catalog.rules.filter(item => item.status === 'active')) {
    for (const binding of enumerateBindings(rule.variables, snapshot, focusObjectIds)) {
        const evaluation = evaluateCondition(rule.when, world, binding, propertyMap);
        if (evaluation.truth === 'TRUE') continue;
        evaluation.missing.forEach(item => missing.push({
          ...item,
          ruleId: rule.id,
          ruleName: rule.name,
          binding,
        }));
      }
    }
  }
  const unique = new Map<string, OntologyMissingCondition>();
  missing.forEach(item => unique.set(`${item.ruleId}|${json(item.binding)}|${item.description}`, item));
  return [...unique.values()];
};

const buildProofs = (world: World): OntologySimulationBranch['proofs'] => {
  const targets = [
    ...[...world.properties.values()]
      .filter(fact => fact.origin !== 'ontology')
      .map(fact => `${fact.objectId}.${fact.propertyId}`),
    ...world.conclusions,
  ];
  return targets.map(target => {
    const producerIndex = world.path.findLastIndex(step => step.changes.some(change => change.includes(target)));
    return {
      target,
      steps: producerIndex >= 0 ? world.path.slice(0, producerIndex + 1).map(step => structuredClone(step)) : [],
    };
  });
};

export function simulateOntology(
  snapshot: OntologySnapshot,
  scenario: OntologySimulationScenario,
  requestedLimits: OntologySimulationLimits = {},
): OntologySimulationReport {
  const limits = { ...DEFAULT_LIMITS, ...requestedLimits };
  const modelIssues = validateOntologySnapshot(snapshot);
  const initial = createInitialWorld(snapshot);
  const existingProperties = [...initial.properties.values()].map(item => structuredClone(item));
  const existingRelations = [...initial.relations.values()].map(item => structuredClone(item));
  applyAssumptions(initial, scenario.assumptions);
  const conflicts: OntologyConflict[] = [];
  let closure = modelIssues.length === 0
    ? runRuleClosure([initial], snapshot, limits, conflicts, scenario.focusObjectIds)
    : { worlds: [initial], truncated: false };
  for (const selection of [...scenario.actions].sort((left, right) => left.order - right.order)) {
    closure.worlds.forEach(world => {
      applyAction(world, selection, snapshot);
      world.handled.clear();
    });
    const next = modelIssues.length === 0
      ? runRuleClosure(closure.worlds, snapshot, limits, conflicts, scenario.focusObjectIds)
      : { worlds: closure.worlds, truncated: false };
    closure = { worlds: next.worlds, truncated: closure.truncated || next.truncated };
  }
  const missingConditions = collectMissingConditions(closure.worlds, snapshot, scenario.focusObjectIds);
  const propertyMap = new Map(snapshot.catalog.propertyDefinitions.map(item => [item.id, item]));
  const toAssumption = (missing: OntologyMissingCondition): OntologyAssumption | null => {
    if (missing.objectId !== undefined && missing.propertyId) {
      if (missing.operator === 'is_missing') {
        return { kind: 'unset_property', objectId: missing.objectId, propertyId: missing.propertyId };
      }
      if (missing.operator === 'is_present' || missing.expected === undefined) return null;
      return {
        kind: 'set_property',
        objectId: missing.objectId,
        propertyId: missing.propertyId,
        value: missing.expected,
      };
    }
    if (missing.sourceObjectId !== undefined && missing.linkTypeId !== undefined && missing.targetObjectId !== undefined) {
      return {
        kind: missing.operator === 'not_exists' ? 'remove_relation' : 'add_relation',
        sourceObjectId: missing.sourceObjectId,
        linkTypeId: missing.linkTypeId,
        targetObjectId: missing.targetObjectId,
      };
    }
    return null;
  };
  const counterfactuals: OntologyCounterfactual[] = [];
  if (limits.maxCounterfactualDistance > 0 && modelIssues.length === 0) {
    const atomic = new Map<string, { missing: OntologyMissingCondition; edit: OntologyAssumption }>();
    missingConditions.forEach(missing => {
      const edit = toAssumption(missing);
      if (edit) atomic.set(json(edit), { missing, edit });
    });
    const candidates = [...atomic.values()].slice(0, 20);
    const combinations: Array<Array<typeof candidates[number]>> = [];
    const build = (start: number, targetSize: number, current: Array<typeof candidates[number]>) => {
      if (combinations.length >= 100) return;
      if (current.length === targetSize) {
        combinations.push([...current]);
        return;
      }
      for (let index = start; index < candidates.length; index += 1) {
        current.push(candidates[index]);
        build(index + 1, targetSize, current);
        current.pop();
        if (combinations.length >= 100) return;
      }
    };
    for (let distance = 1; distance <= limits.maxCounterfactualDistance; distance += 1) {
      build(0, distance, []);
    }
    const baselineGoalTrue = scenario.goal
      ? closure.worlds.some(world => evaluateCondition(scenario.goal!.condition, world, scenario.goal!.bindings, propertyMap).truth === 'TRUE')
      : false;
    const baselineRuleIds = new Set(closure.worlds.flatMap(world =>
      world.path.map(step => step.ruleId).filter((ruleId): ruleId is string => Boolean(ruleId))));
    for (const candidate of combinations) {
      const changedReport = simulateOntology(snapshot, {
        ...scenario,
        assumptions: [...scenario.assumptions, ...candidate.map(item => item.edit)],
      }, { ...limits, maxCounterfactualDistance: 0 });
      const triggeredRuleIds = [...new Set(changedReport.branches.flatMap(branch =>
        branch.path.map(step => step.ruleId).filter((ruleId): ruleId is string => Boolean(ruleId))))];
      const reachesNewGoal = scenario.goal
        ? !baselineGoalTrue && changedReport.goalResults.some(result => result.truth === 'TRUE')
        : triggeredRuleIds.some(ruleId => !baselineRuleIds.has(ruleId));
      if (!reachesNewGoal) continue;
      const changes = candidate.map(item => item.missing);
      counterfactuals.push({
        ruleId: triggeredRuleIds[0] ?? changes[0].ruleId,
        description: `改变 ${changes.length} 个条件可得到不同结果${triggeredRuleIds.length ? `（触发 ${triggeredRuleIds.join('、')}）` : ''}`,
        distance: changes.length,
        changes,
      });
      if (counterfactuals.length >= 10) break;
    }
  }
  const generatedAt = new Date().toISOString();
  const runSeed = `${snapshot.snapshotId}|${generatedAt}|${json(scenario)}`;
  const branchIds = closure.worlds.map((_world, index) => `branch-${index + 1}`);
  return {
    runId: `reasoning-${stableHash(runSeed)}-${Date.now().toString(36)}`,
    generatedAt,
    snapshotId: snapshot.snapshotId,
    modelIssues,
    existingProperties,
    existingRelations,
    branches: closure.worlds.map((world, index) => ({
      id: branchIds[index],
      properties: [...world.properties.values()],
      relations: [...world.relations.values()],
      conclusions: [...world.conclusions],
      path: world.path,
      proofs: buildProofs(world),
    })),
    conflicts: [...new Map(conflicts.map(conflict => [
      `${conflict.slot}|${conflict.ruleIds.sort().join(',')}`,
      conflict,
    ])).values()],
    missingConditions,
    counterfactuals,
    goalResults: scenario.goal
      ? closure.worlds.map((world, index) => ({
          branchId: branchIds[index],
          truth: evaluateCondition(
            scenario.goal!.condition,
            world,
            scenario.goal!.bindings,
            propertyMap,
          ).truth,
        }))
      : [],
    truncated: closure.truncated,
    limits,
  };
}

const parseDefinitionRows = <T>(rows: Array<Record<string, unknown>>, label: string): T[] =>
  rows.map((row, index) => {
    if (typeof row.definition_json !== 'string') throw new Error(`${label} ${index + 1} 缺少定义`);
    return JSON.parse(row.definition_json) as T;
  });

const latestDefinitions = <T extends { logicalId: string; version: number }>(definitions: T[]): T[] => {
  const latest = new Map<string, T>();
  definitions.forEach(definition => {
    const previous = latest.get(definition.logicalId);
    if (!previous || definition.version > previous.version) latest.set(definition.logicalId, definition);
  });
  return [...latest.values()];
};

export interface OntologyReasoningModule {
  initialize(): Promise<void>;
  loadCatalog(): Promise<OntologyReasoningCatalog>;
  saveCatalog(catalog: OntologyReasoningCatalog): Promise<void>;
  createSnapshot(source: OntologyProjectionSource, catalog: OntologyReasoningCatalog): OntologySnapshot;
  validateModel(snapshot: OntologySnapshot): string[];
  simulate(snapshot: OntologySnapshot, scenario: OntologySimulationScenario, limits?: OntologySimulationLimits): OntologySimulationReport;
  saveRun(snapshot: OntologySnapshot, scenario: OntologySimulationScenario, report: OntologySimulationReport): Promise<void>;
  replayRun(runId: string): Promise<OntologySimulationReport>;
}

export function createOntologyReasoningModule(
  database: OntologyReasoningDatabase,
): OntologyReasoningModule {
  let initialized: Promise<unknown> | null = null;
  const initialize = async () => {
    initialized ??= database.executeTransaction(ONTOLOGY_REASONING_SCHEMA);
    await initialized;
  };
  const prepareDefinitions = async (
    kind: 'property' | 'rule' | 'action',
    definitions: Array<OntologyPropertyDefinition | OntologyRuleDefinition | OntologyActionDefinition>,
  ) => {
    const pending: Array<{ definition: typeof definitions[number]; serialized: string; fingerprint: string }> = [];
    for (const definition of definitions) {
      const serialized = json(definition);
      const fingerprint = stableHash(serialized);
      const existing = await database.queryWithParams(
        `SELECT fingerprint FROM _sys_ontology_${kind}_definition
         WHERE logical_id = ? AND version = ?`,
        [definition.logicalId, definition.version],
      );
      if (existing.length > 0) {
        if (String(existing[0].fingerprint) === fingerprint) continue;
        throw new Error(`${definition.logicalId} v${definition.version} 已存在且不可覆盖，请创建新版本`);
      }
      pending.push({ definition, serialized, fingerprint });
    }
    return pending;
  };
  const insertDefinitions = async (
    kind: 'property' | 'rule' | 'action',
    pending: Awaited<ReturnType<typeof prepareDefinitions>>,
  ) => {
    for (const { definition, serialized, fingerprint } of pending) {
      await database.queryWithParams(
        `INSERT INTO _sys_ontology_${kind}_definition
          (definition_id, logical_id, version, status, definition_json, fingerprint, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [definition.id, definition.logicalId, definition.version, definition.status, serialized, fingerprint],
      );
    }
  };
  return {
    initialize,
    async loadCatalog() {
      await initialize();
      const [propertyRows, ruleRows, actionRows] = await Promise.all([
        database.query('SELECT definition_json FROM _sys_ontology_property_definition ORDER BY logical_id, version'),
        database.query('SELECT definition_json FROM _sys_ontology_rule_definition ORDER BY logical_id, version'),
        database.query('SELECT definition_json FROM _sys_ontology_action_definition ORDER BY logical_id, version'),
      ]);
      return {
        propertyDefinitions: latestDefinitions(parseDefinitionRows<OntologyPropertyDefinition>(propertyRows, '属性定义')),
        rules: latestDefinitions(parseDefinitionRows<OntologyRuleDefinition>(ruleRows, '规则定义')),
        actionDefinitions: latestDefinitions(parseDefinitionRows<OntologyActionDefinition>(actionRows, '动作定义')),
      };
    },
    async saveCatalog(catalog) {
      await initialize();
      const propertyDefinitions = await prepareDefinitions('property', catalog.propertyDefinitions);
      const rules = await prepareDefinitions('rule', catalog.rules);
      const actions = await prepareDefinitions('action', catalog.actionDefinitions);
      await insertDefinitions('property', propertyDefinitions);
      await insertDefinitions('rule', rules);
      await insertDefinitions('action', actions);
    },
    createSnapshot: createOntologySnapshot,
    validateModel: validateOntologySnapshot,
    simulate: simulateOntology,
    async saveRun(snapshot, scenario, report) {
      await initialize();
      await database.queryWithParams(
        `INSERT INTO _sys_ontology_reasoning_run
          (run_id, generated_at, snapshot_json, scenario_json, report_json)
         VALUES (?, ?, ?, ?, ?)`,
        [report.runId, report.generatedAt, json(snapshot), json(scenario), json(report)],
      );
    },
    async replayRun(runId) {
      await initialize();
      const rows = await database.queryWithParams(
        `SELECT snapshot_json, scenario_json, report_json
         FROM _sys_ontology_reasoning_run
         WHERE run_id = ?`,
        [runId],
      );
      if (rows.length === 0) throw new Error(`推演运行不存在：${runId}`);
      const snapshot = JSON.parse(String(rows[0].snapshot_json)) as OntologySnapshot;
      const scenario = JSON.parse(String(rows[0].scenario_json)) as OntologySimulationScenario;
      const previous = JSON.parse(String(rows[0].report_json)) as OntologySimulationReport;
      const replayed = simulateOntology(snapshot, scenario, previous.limits);
      return { ...replayed, runId: previous.runId, generatedAt: previous.generatedAt };
    },
  };
}

export const ontologyReasoningModule = createOntologyReasoningModule(
  duckDBService as OntologyReasoningDatabase,
);
