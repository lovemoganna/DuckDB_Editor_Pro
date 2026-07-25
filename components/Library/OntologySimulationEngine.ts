export type SimulationStatus = 'possible' | 'conflicted' | 'excluded';
export type PropertyOperator = 'equals' | 'not_equals';

export interface SimulationObjectType {
  id: number;
  name: string;
  description?: string;
}

export interface SimulationObject {
  id: number;
  object_type_id: number;
  name: string;
  properties?: string | Record<string, unknown>;
  annotations?: string;
}

export interface SimulationLinkType {
  id: number;
  name: string;
  description?: string;
}

export interface SimulationLink {
  id: number;
  link_type_id: number;
  source_object_id: number;
  target_object_id: number;
  weight?: number;
}

export interface SimulationAction {
  id: number;
  object_id: number;
  name: string;
  description?: string;
  status?: string;
  execute_at?: string | null;
}

export interface SimulationIntrospection {
  id: number;
  object_id: number;
  question: string;
  answer: string;
}

export interface SimulationInsight {
  id: number;
  object_id: number;
  insight: string;
  tag: string;
}

export interface OntologySimulationData {
  _meta?: {
    name?: string;
    description?: string;
    case_background?: string;
    core_concept?: string;
  };
  objectTypes?: SimulationObjectType[];
  objects: SimulationObject[];
  linkTypes: SimulationLinkType[];
  links: SimulationLink[];
  actions?: SimulationAction[];
  introspections?: SimulationIntrospection[];
  insights?: SimulationInsight[];
}

export interface SimulationScenario {
  id: string;
  name: string;
  sourceObjectId: number | null;
  targetObjectId: number | null;
  propertyKey: string | null;
  propertyOperator: PropertyOperator;
  propertyValue: unknown;
  linkTypeId: number | null;
  actionId: number | null;
  selectedRuleIds: string[];
  timeOffsetHours: number;
}

export interface SimulationRule {
  id: string;
  title: string;
  description: string;
  source: 'insight' | 'introspection';
  appliesToObjectId: number;
  effect?: {
    property: string;
    value: string;
  };
}

export interface SimulationExclusion {
  code:
    | 'missing_object'
    | 'self_relation'
    | 'missing_relation'
    | 'relation_direction_mismatch'
    | 'missing_property'
    | 'property_condition_failed'
    | 'action_out_of_scope';
  title: string;
  detail: string;
}

export interface SimulationConflict {
  code: 'competing_evidence' | 'invalid_evidence' | 'rule_effect_mismatch';
  kind: 'evidence' | 'rule';
  title: string;
  detail: string;
  relatedObjectNames: string[];
  relatedRuleIds: string[];
}

export interface SimulationStateChange {
  objectId: number;
  objectName: string;
  property: string;
  before: unknown;
  after: unknown;
  reason: string;
}

export interface SimulationTimelineStep {
  id: string;
  index: number;
  atHours: number;
  title: string;
  description: string;
  changes: SimulationStateChange[];
}

export interface SimulationResult {
  scenarioId: string;
  scenarioName: string;
  status: SimulationStatus;
  exclusions: SimulationExclusion[];
  timeline: SimulationTimelineStep[];
  triggeredRules: SimulationRule[];
  conflicts: SimulationConflict[];
  stateChanges: SimulationStateChange[];
  finalOutcome: {
    title: string;
    summary: string;
    evidenceLevel: 'direct' | 'contested' | 'insufficient';
  };
}

export interface ScenarioComparison {
  possible: number;
  conflicted: number;
  excluded: number;
  totalTriggeredRules: number;
  totalStateChanges: number;
}

const normalizeComparable = (value: unknown): string => {
  if (value === null) return 'null';
  if (value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const parseSimulationProperties = (
  value: SimulationObject['properties'],
): Record<string, unknown> => {
  if (!value) return {};
  if (typeof value === 'object') return { ...value };
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const parseSimulationRuleEffect = (
  description: string,
): SimulationRule['effect'] => {
  const match = description.match(
    /([A-Za-z_][A-Za-z0-9_-]*|状态)\s*(?:必须为|应为|更新为|设为|=)\s*([A-Za-z0-9_\-\u4e00-\u9fff]+)/iu,
  );
  if (!match) return undefined;
  return {
    property: match[1] === '状态' ? 'status' : match[1],
    value: match[2],
  };
};

export const deriveSimulationRules = (
  data: OntologySimulationData,
): SimulationRule[] => [
  ...(data.insights ?? []).map(insight => ({
    id: `insight-${insight.id}`,
    title: insight.tag || `教程洞察 ${insight.id}`,
    description: insight.insight,
    source: 'insight' as const,
    appliesToObjectId: insight.object_id,
    effect: parseSimulationRuleEffect(insight.insight),
  })),
  ...(data.introspections ?? []).map(item => ({
    id: `introspection-${item.id}`,
    title: item.question,
    description: item.answer,
    source: 'introspection' as const,
    appliesToObjectId: item.object_id,
    effect: parseSimulationRuleEffect(item.answer),
  })),
];

export const createDefaultScenario = (
  id: string,
  data: OntologySimulationData,
): SimulationScenario => {
  const firstLink = data.links[0];
  const source = data.objects.find(object => object.id === firstLink?.source_object_id)
    ?? data.objects[0];
  const target = data.objects.find(object => object.id === firstLink?.target_object_id)
    ?? data.objects.find(object => object.id !== source?.id)
    ?? null;
  const propertyEntries = Object.entries(parseSimulationProperties(source?.properties));
  const relevantAction = (data.actions ?? []).find(action =>
    action.object_id === source?.id || action.object_id === target?.id,
  );

  return {
    id,
    name: `场景 ${id.replace(/^scenario-/, '').toUpperCase()}`,
    sourceObjectId: source?.id ?? null,
    targetObjectId: target?.id ?? null,
    propertyKey: propertyEntries[0]?.[0] ?? null,
    propertyOperator: 'equals',
    propertyValue: propertyEntries[0]?.[1] ?? '',
    linkTypeId: firstLink?.link_type_id ?? data.linkTypes[0]?.id ?? null,
    actionId: relevantAction?.id ?? null,
    selectedRuleIds: deriveSimulationRules(data).map(rule => rule.id),
    timeOffsetHours: 6,
  };
};

type RelationEvidence =
  | { kind: 'existing'; link: SimulationLink }
  | { kind: 'type-compatible'; link: SimulationLink };

const findRelationEvidence = (
  data: OntologySimulationData,
  source: SimulationObject,
  target: SimulationObject,
  linkTypeId: number,
): RelationEvidence | undefined => {
  const exactLink = data.links.find(link =>
    link.link_type_id === linkTypeId
    && link.source_object_id === source.id
    && link.target_object_id === target.id,
  );
  if (exactLink) return { kind: 'existing', link: exactLink };

  const typeCompatibleLink = data.links.find(link => {
    if (link.link_type_id !== linkTypeId) return false;
    const knownSource = data.objects.find(object => object.id === link.source_object_id);
    const knownTarget = data.objects.find(object => object.id === link.target_object_id);
    return knownSource?.object_type_id === source.object_type_id
      && knownTarget?.object_type_id === target.object_type_id;
  });
  return typeCompatibleLink
    ? { kind: 'type-compatible', link: typeCompatibleLink }
    : undefined;
};

const buildExclusions = (
  data: OntologySimulationData,
  scenario: SimulationScenario,
): SimulationExclusion[] => {
  const exclusions: SimulationExclusion[] = [];
  const source = data.objects.find(object => object.id === scenario.sourceObjectId);
  const target = data.objects.find(object => object.id === scenario.targetObjectId);
  const linkType = data.linkTypes.find(type => type.id === scenario.linkTypeId);

  if (!source || !target) {
    exclusions.push({
      code: 'missing_object',
      title: '缺少对象',
      detail: '起点对象和目标对象都必须存在，推演才能建立状态路径。',
    });
    return exclusions;
  }

  if (source.id === target.id) {
    exclusions.push({
      code: 'self_relation',
      title: '对象不能指向自身',
      detail: `教程拓扑没有定义「${source.name}」的自环关系。`,
    });
  }

  if (!linkType) {
    exclusions.push({
      code: 'missing_relation',
      title: '缺少关系',
      detail: '请选择一个教程中已经定义的关系类型。',
    });
  } else {
    const relationEvidence = findRelationEvidence(data, source, target, linkType.id);
    if (!relationEvidence) {
      exclusions.push({
        code: 'relation_direction_mismatch',
        title: '关系方向不成立',
        detail: `现有教程拓扑既没有这条关系，也没有相同对象类型之间的「${linkType.name}」用法，无法支持「${source.name}」指向「${target.name}」。`,
      });
    }
  }

  if (scenario.propertyKey) {
    const properties = parseSimulationProperties(source.properties);
    if (!(scenario.propertyKey in properties)) {
      exclusions.push({
        code: 'missing_property',
        title: '属性不存在',
        detail: `「${source.name}」没有属性「${scenario.propertyKey}」。`,
      });
    } else {
      const actual = normalizeComparable(properties[scenario.propertyKey]);
      const expected = normalizeComparable(scenario.propertyValue);
      const passes = scenario.propertyOperator === 'equals'
        ? actual === expected
        : actual !== expected;
      if (!passes) {
        exclusions.push({
          code: 'property_condition_failed',
          title: '属性条件不满足',
          detail: `「${source.name}.${scenario.propertyKey}」当前为「${actual}」，不满足所选条件「${scenario.propertyOperator === 'equals' ? '=' : '≠'} ${expected}」。`,
        });
      }
    }
  }

  if (scenario.actionId !== null) {
    const action = (data.actions ?? []).find(item => item.id === scenario.actionId);
    if (!action || (action.object_id !== source.id && action.object_id !== target.id)) {
      exclusions.push({
        code: 'action_out_of_scope',
        title: '动作不适用于所选对象',
        detail: '所选动作没有挂载在起点或目标对象上，不能进入这条推演路径。',
      });
    }
  }

  return exclusions;
};

interface ParsedActionEffect {
  subject: string;
  property: string;
  before?: string;
  after: string;
}

const cleanEffectSubject = (subject: string): string => subject
  .replace(/^(?:并)?(?:将|更新|修改|改变)\s*/u, '')
  .replace(/的\s*$/u, '')
  .trim();

const parseActionEffect = (action: SimulationAction): ParsedActionEffect | null => {
  const description = action.description ?? '';
  const transition = description.match(
    /([^，。；]*?)状态从\s*([A-Za-z0-9_]+)\s*(?:推进至|变更为|更新为)\s*([A-Za-z0-9_]+)/iu,
  );
  if (transition) {
    return {
      subject: cleanEffectSubject(transition[1]),
      property: 'status',
      before: transition[2],
      after: transition[3],
    };
  }

  const statusAssignment = description.match(
    /(?:并将|将|更新|修改|改变)\s*([^，。；]*?)\s*(?:的)?(?:状态|status)\s*(?:更新为|修改为|改变为|降级为|为)\s*([A-Za-z0-9_]+)/iu,
  );
  if (statusAssignment) {
    return {
      subject: cleanEffectSubject(statusAssignment[1]),
      property: 'status',
      after: statusAssignment[2],
    };
  }

  const propertyAssignment = description.match(
    /(?:并将|将|更新|修改|改变)\s*([^，。；]*?)\s*(?:的)?(保管人|投入比例)\s*(?:更新为|修改为|改变为|为|至)\s*([^，。；\s]+)/iu,
  );
  if (propertyAssignment) {
    return {
      subject: cleanEffectSubject(propertyAssignment[1]),
      property: propertyAssignment[2],
      after: propertyAssignment[3],
    };
  }

  return null;
};

const normalizeEffectText = (value: string): string =>
  value.toLowerCase().replace(/[^\p{L}\p{N}_#.%]/gu, '');

const longestSharedFragment = (leftValue: string, rightValue: string): number => {
  const left = normalizeEffectText(leftValue);
  const right = normalizeEffectText(rightValue);
  if (!left || !right) return 0;

  const lengths = new Array(right.length + 1).fill(0);
  let longest = 0;
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = right.length; rightIndex >= 1; rightIndex -= 1) {
      lengths[rightIndex] = left[leftIndex - 1] === right[rightIndex - 1]
        ? lengths[rightIndex - 1] + 1
        : 0;
      longest = Math.max(longest, lengths[rightIndex]);
    }
  }
  return longest;
};

const resolveEffectObject = (
  data: OntologySimulationData,
  action: SimulationAction,
  subject: string,
): SimulationObject | undefined => {
  const actionOwner = data.objects.find(object => object.id === action.object_id);
  if (!subject) return actionOwner;

  const ranked = data.objects.map(object => {
    const objectType = data.objectTypes?.find(type => type.id === object.object_type_id);
    const corpus = [
      object.name,
      object.annotations,
      objectType?.name,
      objectType?.description,
    ].filter(Boolean).join(' ');
    return {
      object,
      score: longestSharedFragment(subject, corpus)
        + (object.id === action.object_id ? 0.1 : 0),
    };
  }).sort((left, right) => right.score - left.score);

  return (ranked[0]?.score ?? 0) >= 2 ? ranked[0].object : actionOwner;
};

const inferActionChanges = (
  action: SimulationAction,
  data: OntologySimulationData,
): SimulationStateChange[] => {
  const effect = parseActionEffect(action);
  if (!effect) return [];

  const object = resolveEffectObject(data, action, effect.subject);
  if (!object) return [];

  const properties = parseSimulationProperties(object.properties);
  const matchingStatusKey = effect.property === 'status'
    ? Object.keys(properties).find(key => key === 'status' || key.endsWith('_status'))
    : undefined;
  const property = matchingStatusKey ?? effect.property;

  return [{
    objectId: object.id,
    objectName: object.name,
    property,
    before: effect.before ?? properties[property] ?? '未设置',
    after: effect.after,
    reason: action.name,
  }];
};

const detectRuleConflicts = (
  data: OntologySimulationData,
  triggeredRules: SimulationRule[],
): SimulationConflict[] => {
  const rulesByTargetAndProperty = new Map<string, SimulationRule[]>();
  triggeredRules.forEach(rule => {
    if (!rule.effect) return;
    const key = `${rule.appliesToObjectId}:${rule.effect.property}`;
    const existing = rulesByTargetAndProperty.get(key) ?? [];
    rulesByTargetAndProperty.set(key, [...existing, rule]);
  });

  return Array.from(rulesByTargetAndProperty.values()).flatMap(rules => {
    const property = rules[0].effect!.property;
    const object = data.objects.find(item => item.id === rules[0].appliesToObjectId);
    const values = Array.from(new Set(rules.map(rule => rule.effect!.value)));
    if (values.length < 2) return [];
    return [{
      code: 'rule_effect_mismatch' as const,
      kind: 'rule' as const,
      title: `规则对 ${object?.name ?? '同一对象'}.${property} 给出互斥结果`,
      detail: `所选规则分别要求「${object?.name ?? '同一对象'}」的 ${property} 为 ${values.join('、')}，同一时间步无法同时成立。`,
      relatedObjectNames: object ? [object.name] : [],
      relatedRuleIds: rules.map(rule => rule.id),
    }];
  });
};

const detectEvidenceConflicts = (
  data: OntologySimulationData,
  relationEvidence: RelationEvidence,
  sourceObjectId: number,
  targetObjectId: number,
  triggeredRules: SimulationRule[],
): SimulationConflict[] => {
  const conflicts: SimulationConflict[] = [];
  const selectedLink = relationEvidence.link;
  const relatedRuleIds = triggeredRules.map(rule => rule.id);
  const target = data.objects.find(object => object.id === targetObjectId);
  const targetProperties = parseSimulationProperties(target?.properties);
  const hasInvalidEvidence = Object.values(targetProperties).some(value =>
    /失效|废弃|无效|过期/.test(normalizeComparable(value)),
  );

  if (hasInvalidEvidence && target) {
    conflicts.push({
      code: 'invalid_evidence',
      kind: 'evidence',
      title: '所选证据已经失效',
      detail: `「${target.name}」包含失效或废弃标记，不能直接支持最终结论。`,
      relatedObjectNames: [target.name],
      relatedRuleIds,
    });
  }

  const peers = data.links.filter(link =>
    link.id !== selectedLink.id
    && link.source_object_id === sourceObjectId
    && link.target_object_id !== targetObjectId,
  );
  const evidencePeers = peers.filter(link => {
    const peer = data.objects.find(object => object.id === link.target_object_id);
    const properties = parseSimulationProperties(peer?.properties);
    return ['confidence', 'weight', 'source', 'validity'].some(key => key in properties);
  });
  const selectedWeight = selectedLink.weight ?? 0.5;
  const strongerPeer = evidencePeers
    .filter(link => (link.weight ?? 0.5) > selectedWeight)
    .sort((a, b) => (b.weight ?? 0.5) - (a.weight ?? 0.5))[0];

  if (strongerPeer && target) {
    const strongerTarget = data.objects.find(object => object.id === strongerPeer.target_object_id);
    if (strongerTarget) {
      conflicts.push({
        code: 'competing_evidence',
        kind: 'evidence',
        title: '所选路径命中相互竞争的证据',
        detail: `「${target.name}」权重 ${selectedWeight.toFixed(2)}，但「${strongerTarget.name}」权重 ${(strongerPeer.weight ?? 0.5).toFixed(2)}；最终动作应优先服从更强证据。`,
        relatedObjectNames: [target.name, strongerTarget.name],
        relatedRuleIds,
      });
    }
  }

  return conflicts;
};

export const runOntologySimulation = (
  data: OntologySimulationData,
  scenario: SimulationScenario,
): SimulationResult => {
  const exclusions = buildExclusions(data, scenario);
  if (exclusions.length > 0) {
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      status: 'excluded',
      exclusions,
      timeline: [],
      triggeredRules: [],
      conflicts: [],
      stateChanges: [],
      finalOutcome: {
        title: '组合已排除',
        summary: exclusions.map(issue => issue.title).join('、'),
        evidenceLevel: 'insufficient',
      },
    };
  }

  const source = data.objects.find(object => object.id === scenario.sourceObjectId)!;
  const target = data.objects.find(object => object.id === scenario.targetObjectId)!;
  const linkType = data.linkTypes.find(type => type.id === scenario.linkTypeId)!;
  const relationEvidence = findRelationEvidence(data, source, target, linkType.id)!;
  const isExistingLink = relationEvidence.kind === 'existing';
  const action = scenario.actionId === null
    ? null
    : (data.actions ?? []).find(item => item.id === scenario.actionId) ?? null;

  const applicableObjectIds = new Set([
    source.id,
    target.id,
    ...(action ? [action.object_id] : []),
  ]);
  const triggeredRules = deriveSimulationRules(data).filter(rule =>
    scenario.selectedRuleIds.includes(rule.id)
    && applicableObjectIds.has(rule.appliesToObjectId),
  );
  const conflicts = [
    ...detectRuleConflicts(data, triggeredRules),
    ...detectEvidenceConflicts(
      data,
      relationEvidence,
      source.id,
      target.id,
      triggeredRules,
    ),
  ];
  const ruleConflictCount = conflicts.filter(conflict => conflict.kind === 'rule').length;
  const evidenceConflictCount = conflicts.filter(conflict => conflict.kind === 'evidence').length;

  const stateChanges = action && scenario.timeOffsetHours > 0
    ? inferActionChanges(action, data)
    : [];

  const timeline: SimulationTimelineStep[] = [
    {
      id: `${scenario.id}-initial`,
      index: 1,
      atHours: 0,
      title: '读取初始状态',
      description: `读取「${source.name}」与「${target.name}」的当前属性。`,
      changes: [],
    },
    {
      id: `${scenario.id}-relation`,
      index: 2,
      atHours: 0,
      title: '验证关系路径',
      description: isExistingLink
        ? `确认「${source.name}」—${linkType.name}→「${target.name}」，关系权重 ${(relationEvidence.link.weight ?? 0.5).toFixed(2)}。`
        : `同类型对象已有「${linkType.name}」关系，因此保留「${source.name}」→「${target.name}」作为可推演的新可能；它不是现有事实。`,
      changes: [],
    },
    {
      id: `${scenario.id}-rules`,
      index: 3,
      atHours: Math.min(1, scenario.timeOffsetHours),
      title: '评估规则',
      description: triggeredRules.length > 0
        ? `触发 ${triggeredRules.length} 条教程规则；规则互斥 ${ruleConflictCount} 处，证据冲突 ${evidenceConflictCount} 处。`
        : `没有选中的教程规则适用于当前对象；规则互斥 0 处，仍独立发现证据冲突 ${evidenceConflictCount} 处。`,
      changes: [],
    },
  ];

  if (action) {
    const isObservationOnly = scenario.timeOffsetHours === 0;
    timeline.push({
      id: `${scenario.id}-action`,
      index: 4,
      atHours: scenario.timeOffsetHours,
      title: isObservationOnly ? '等待时间条件' : '执行动作',
      description: isObservationOnly
        ? `t+0h 只观察，所选动作「${action.name}」尚未进入未来时间步。`
        : `在 t+${scenario.timeOffsetHours}h 执行「${action.name}」。`,
      changes: stateChanges,
    });
  }

  const status: SimulationStatus = conflicts.length > 0 ? 'conflicted' : 'possible';
  const stateChangeSummary = stateChanges.length > 0
    ? stateChanges
        .map(change => `${change.objectName}.${change.property}：${normalizeComparable(change.before)} → ${normalizeComparable(change.after)}`)
        .join('；')
    : null;
  const actionSummary = !action
    ? '；未选择动作，因此只保留关系推演结果'
    : scenario.timeOffsetHours === 0
      ? `；t+0h 只观察，「${action.name}」尚未执行`
      : stateChangeSummary
        ? `；t+${scenario.timeOffsetHours}h 触发「${action.name}」，${stateChangeSummary}`
        : `；t+${scenario.timeOffsetHours}h 可触发「${action.name}」，但教程材料没有给出可验证的对象属性新值`;
  const ruleSummary = triggeredRules.length === 0
    ? `；没有选中的教程规则被触发，证据冲突 ${evidenceConflictCount} 处`
    : conflicts.length > 0
      ? `；触发 ${triggeredRules.length} 条教程规则，规则互斥 ${ruleConflictCount} 处、证据冲突 ${evidenceConflictCount} 处，需先裁决`
      : `；触发 ${triggeredRules.length} 条教程规则，规则互斥与证据冲突均为 0`;

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    status,
    exclusions: [],
    timeline,
    triggeredRules,
    conflicts,
    stateChanges,
    finalOutcome: {
      title: status === 'conflicted' ? '可继续，但需先裁决冲突' : '组合成立',
      summary: `「${source.name}」通过「${linkType.name}」影响「${target.name}」${actionSummary}${ruleSummary}。`,
      evidenceLevel: status === 'conflicted'
        ? 'contested'
        : isExistingLink
          ? 'direct'
          : 'insufficient',
    },
  };
};

export const buildScenarioComparison = (
  results: SimulationResult[],
): ScenarioComparison => {
  return {
    possible: results.filter(result => result.status === 'possible').length,
    conflicted: results.filter(result => result.status === 'conflicted').length,
    excluded: results.filter(result => result.status === 'excluded').length,
    totalTriggeredRules: results.reduce((total, result) => total + result.triggeredRules.length, 0),
    totalStateChanges: results.reduce((total, result) => total + result.stateChanges.length, 0),
  };
};
