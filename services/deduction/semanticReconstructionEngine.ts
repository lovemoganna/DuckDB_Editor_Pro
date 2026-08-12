import { aiService } from '../aiService';
import {
  DEDUCTION_RESULT_VERSION,
  type AtomicFeature,
  type CompositionNode,
  type ContextGroup,
  type DeductionRequest,
  type DeductionSource,
  type EvidenceAnchor,
  type ExternalMapping,
  type FeatureRelation,
  type SemanticReconstruction,
  type SupportedStatement,
} from './deductionTypes';

export type {
  AtomicFeature,
  CompositionNode,
  ContextGroup,
  DeductionRequest,
  DeductionSource,
  EvidenceAnchor,
  ExternalMapping,
  FeatureRelation,
  SemanticReconstruction,
} from './deductionTypes';

export interface DeductionAiClient {
  generate(prompt: string, systemInstruction: string): Promise<string>;
}

export class DeductionValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`语义还原结果未通过证据校验：${issues.join('；')}`);
    this.name = 'DeductionValidationError';
    this.issues = issues;
  }
}

const defaultAiClient: DeductionAiClient = {
  generate: (prompt, systemInstruction) => aiService.robustCall<string>(
    'ontology', prompt, systemInstruction, false, 0,
  ),
};

const SYSTEM_INSTRUCTION = `你是“特征组合与语义还原器”。你的唯一任务是从输入中恢复原子特征、明确关系、公共上下文、组合结构和等价核心语义。
严格约束：不增加输入不存在的事实、常识、判断、因果或背景；不把相关性写成直接对应；不把事实升级成结论。关系不明确时 certainty 必须是 uncertain。每项内容必须引用输入中的连续原文 quote。只输出一个 JSON 对象，不输出 Markdown。`;

const SCHEMA_GUIDE = `JSON 必须符合以下结构：
{
  "version": 1,
  "input": "原始输入原样返回",
  "features": [{"id":"F1","kind":"entity|attribute|action|state|value|time|space|quantity|metric|condition|event|constraint|result|other","statement":"单一事实","classification":"fact|judgment","certainty":"confirmed|uncertain","entity":"可选","attribute":"可选","action":"可选","state":"可选","value":"可选","time":"可选","space":"可选","quantity":"可选","metric":"可选","condition":"可选","evidence":[{"quote":"输入中的连续原文"}]}],
  "relations": [{"id":"R1","fromFeatureIds":["F1"],"toFeatureIds":["F2"],"type":"parallel|containment|subordination|dependency|causation|sequence|comparison|aggregation|association|exclusion|condition|constraint|change","operator":"AND|OR|NOT|IF_THEN|>|>=|<|<=|=|!=|IN|BETWEEN（可选）","statement":"关系说明","certainty":"confirmed|uncertain","evidence":[{"quote":"输入中的连续原文"}]}],
  "contexts": [{"id":"C1","label":"公共上下文","featureIds":["F1"],"evidence":[{"quote":"输入中的连续原文"}]}],
  "structure": {"id":"N1","type":"feature|relation|context|operator|conditional","label":"节点文本","featureId":"可选","relationId":"可选","operator":"AND|OR|NOT|IF|THEN（可选）","children":[]},
  "coreMeaning": {"text":"一句话核心语义","supportingFeatureIds":["F1"],"supportingRelationIds":["R1"]},
  "externalMappings": [{"id":"M1","targetKind":"feature|relation","targetId":"F1 或 R1","sourceId":"S1","correspondingObject":"对应对象","correspondingContent":"对应内容","matchLevel":"直接对应|高度匹配|部分匹配|仅相关|无法确认","basis":{"quote":"用户依据中的连续原文；无法确认时可省略"},"validationNote":"对象、特征、关系、条件、范围、时间的反向校验说明"}],
  "punchline": {"text":"1至2句话解释组合为何形成该语义","supportingFeatureIds":["F1"],"supportingRelationIds":["R1"]}
}
不要输出 validation，它由本地校验器产生。公共属性上提到 contexts，不要复制成多个 Feature。外部映射未请求时必须为空数组。`;

function sourcePrompt(request: DeductionRequest): string {
  if (!request.externalMappingRequested) return '外部映射：未请求。';
  const sources = (request.sources ?? []).map(source =>
    `--- 依据 ${source.id}：${source.title} ---\n${source.content}`,
  ).join('\n');
  return `外部映射：已请求。只能使用下列用户依据。每条映射必须绑定 feature 或 relation，引用 sourceId 和依据中的连续 quote，并使用五级匹配：直接对应/高度匹配/部分匹配/仅相关/无法确认。\n${sources}`;
}

function reconstructionPrompt(request: DeductionRequest): string {
  return `${SCHEMA_GUIDE}\n\n原始输入：\n${request.input}\n\n${sourcePrompt(request)}`;
}

function auditPrompt(request: DeductionRequest, draft: unknown): string {
  return `${SCHEMA_GUIDE}\n\n请反向审计下方草稿：是否遗漏原子特征或关系、是否凭空增加关系、是否重复公共上下文、是否把事实升级成判断、核心语义是否等价。直接返回纠正后的完整 JSON。\n\n原始输入：\n${request.input}\n\n${sourcePrompt(request)}\n\n待审计草稿：\n${JSON.stringify(draft)}`;
}

function repairPrompt(request: DeductionRequest, candidate: unknown, issues: string[]): string {
  return `${SCHEMA_GUIDE}\n\n本地证据校验发现以下错误：\n- ${issues.join('\n- ')}\n请只修正这些错误，返回完整 JSON。不得删除输入明确表达的事实来逃避校验。\n\n原始输入：\n${request.input}\n\n${sourcePrompt(request)}\n\n待修复结果：\n${JSON.stringify(candidate)}`;
}

function parseJson(raw: string): unknown {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first < 0 || last <= first) throw new DeductionValidationError(['AI 未返回 JSON 对象']);
  try {
    return JSON.parse(cleaned.slice(first, last + 1));
  } catch {
    throw new DeductionValidationError(['AI 返回的 JSON 无法解析']);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function anchorEvidence(raw: unknown, text: string, sourceId?: string): EvidenceAnchor[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const anchors: EvidenceAnchor[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.quote !== 'string' || !item.quote) return null;
    const start = text.indexOf(item.quote);
    if (start < 0) return null;
    anchors.push({ quote: item.quote, start, end: start + item.quote.length, ...(sourceId ? { sourceId } : {}) });
  }
  return anchors;
}

const featureKinds = new Set(['entity', 'attribute', 'action', 'state', 'value', 'time', 'space', 'quantity', 'metric', 'condition', 'event', 'constraint', 'result', 'other']);
const relationTypes = new Set(['parallel', 'containment', 'subordination', 'dependency', 'causation', 'sequence', 'comparison', 'aggregation', 'association', 'exclusion', 'condition', 'constraint', 'change']);
const relationOperators = new Set(['AND', 'OR', 'NOT', 'IF_THEN', '>', '>=', '<', '<=', '=', '!=', 'IN', 'BETWEEN']);
const nodeTypes = new Set(['feature', 'relation', 'context', 'operator', 'conditional']);
const nodeOperators = new Set(['AND', 'OR', 'NOT', 'IF', 'THEN']);
const mappingLevels = new Set(['直接对应', '高度匹配', '部分匹配', '仅相关', '无法确认']);

const CLAIM_GLUE = /对象|属性|行为|动作|状态|条件|结果|事实|判断|输入|原文|存在|表示|表达|明确|共同|构成|组合|满足|通过|属于|包含|关系|发生|形成|位于|的是|中的|这个|该|其|一个|一种|为|是|有|由|与|和|且|在|时|可|需|的|了|来自|and|or|the|is|are|has|have|with/gi;

function hasUnsupportedClaimText(statement: string, evidence: EvidenceAnchor[]): boolean {
  const evidenceText = evidence.map(item => item.quote).join('').toLowerCase();
  const compactChinese = statement.replace(/[a-z0-9_]+/gi, '').replace(CLAIM_GLUE, '').replace(/[\s\p{P}\p{S}]/gu, '');
  const chinese = compactChinese.match(/[\u3400-\u9fff]/g) ?? [];
  if (chinese.some(character => !evidenceText.includes(character))) return true;
  const words = (statement.toLowerCase().match(/[a-z][a-z0-9_]*/g) ?? []).filter(word => !['and', 'or', 'the', 'is', 'are', 'has', 'have', 'with'].includes(word));
  return words.some(word => !evidenceText.includes(word));
}

function relationIsExplicit(raw: Record<string, unknown>, evidence: EvidenceAnchor[]): boolean {
  const text = evidence.map(item => item.quote).join('');
  const operator = typeof raw.operator === 'string' ? raw.operator : '';
  if (raw.type === 'causation') return !/未说明因果|无因果|不能确定因果/.test(text) && /导致|造成|因为|因此|由于|引发|使得/.test(text);
  if (operator === 'AND') return /且|并且|同时|以及|AND/i.test(text);
  if (operator === 'OR') return /或|或者|OR/i.test(text);
  if (operator === 'NOT') return /不|非|排除|NOT/i.test(text);
  if (operator === 'IF_THEN') return /如果|若|当.+时|则|那么/.test(text);
  if (['>', '>=', '<', '<=', '=', '!=', 'IN', 'BETWEEN'].includes(operator)) return />|<|=|≠|大于|小于|等于|不少于|不超过|至少|至多|介于|属于|范围/.test(text);
  if (raw.type === 'sequence') return /之前|之后|同时|随后|先.+再|早于|晚于/.test(text);
  if (raw.type === 'comparison') return /大于|小于|等于|高于|低于|相同|不同|相比/.test(text);
  if (raw.type === 'association') return /关联|相关|连接|对应/.test(text);
  if (raw.type === 'containment') return /包含|包括|组成|属于/.test(text);
  if (raw.type === 'parallel') return /并列|同时|以及|和|与|、/.test(text);
  if (raw.type === 'subordination') return /属于|隶属|从属|归于/.test(text);
  if (raw.type === 'dependency') return /依赖|取决于|前提|则|需要/.test(text);
  if (raw.type === 'aggregation') return /聚合|汇总|合计|总和|组成/.test(text);
  if (raw.type === 'condition') return /条件|前提|只有|只要|除非|如果|若|当.+时|则/.test(text);
  if (raw.type === 'constraint') return /必须|不得|限制|至少|至多|不超过|不少于/.test(text);
  if (raw.type === 'exclusion') return /排斥|互斥|不能同时|排除/.test(text);
  if (raw.type === 'change') return /变化|增加|减少|变为|从.+到/.test(text);
  return raw.certainty === 'uncertain';
}

function meaningfulTokens(text: string): Set<string> {
  const normalized = text.toLowerCase();
  const tokens = new Set(normalized.match(/[a-z][a-z0-9_]*/g) ?? []);
  for (const run of normalized.match(/[\u3400-\u9fff]+/g) ?? []) {
    if (run.length === 1) tokens.add(run);
    for (let index = 0; index < run.length - 1; index += 1) tokens.add(run.slice(index, index + 2));
  }
  return tokens;
}

const directionalRelationTypes = new Set<FeatureRelation['type']>([
  'containment', 'subordination', 'dependency', 'causation', 'sequence',
  'comparison', 'aggregation', 'condition', 'constraint', 'change',
]);

const relationPredicatePatterns: Record<FeatureRelation['type'], RegExp> = {
  parallel: /并列|同时|以及|和|与|、/,
  containment: /包含|包括|组成|属于/,
  subordination: /属于|隶属|从属|归于/,
  dependency: /依赖|取决于|前提|需要/,
  causation: /导致|造成|因为|因此|由于|引发|使得/,
  sequence: /之前|之后|随后|先.+再|早于|晚于/,
  comparison: /大于|小于|等于|高于|低于|相同|不同|相比|>|<|=|≠/,
  aggregation: /聚合|汇总|合计|总和|组成/,
  association: /关联|相关|连接|对应/,
  exclusion: /排斥|互斥|不能同时|排除/,
  condition: /条件|前提|只有|只要|除非|如果|若|当.+时|则/,
  constraint: /必须|不得|限制|至少|至多|不超过|不少于/,
  change: /变化|增加|减少|变为|从.+到/,
};

function relationPredicateMatchesBasis(relation: FeatureRelation, basisText: string): boolean {
  if (!relationPredicatePatterns[relation.type].test(basisText)) return false;
  if (!relation.operator) return true;
  const operatorPatterns: Partial<Record<NonNullable<FeatureRelation['operator']>, RegExp>> = {
    AND: /且|并且|同时|以及|AND/i,
    OR: /或|或者|OR/i,
    NOT: /不|非|排除|NOT/i,
    IF_THEN: /如果|若|当.+时|则|那么/,
    '>': />|大于|高于|超过/,
    '>=': />=|大于等于|不少于|至少/,
    '<': /<|小于|低于/,
    '<=': /<=|小于等于|不超过|至多/,
    '=': /=|等于|为/,
    '!=': /!=|≠|不等于/,
    IN: /属于|位于|在.+中/,
    BETWEEN: /介于|之间|范围/,
  };
  return operatorPatterns[relation.operator]?.test(basisText) ?? false;
}

function featurePosition(text: string, feature: AtomicFeature): number | null {
  const candidates = [
    ...feature.evidence.map(item => item.quote),
    feature.entity, feature.attribute, feature.action, feature.state, feature.value,
    feature.time, feature.space, feature.quantity, feature.metric,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  const positions = candidates.map(value => text.indexOf(value)).filter(position => position >= 0);
  return positions.length > 0 ? Math.min(...positions) : null;
}

function relationDirectionMatchesBasis(relation: FeatureRelation, basisText: string, features: AtomicFeature[]): boolean {
  if (!directionalRelationTypes.has(relation.type)) return true;
  const fromFeatures = relation.fromFeatureIds.map(id => features.find(feature => feature.id === id)).filter(Boolean) as AtomicFeature[];
  const toFeatures = relation.toFeatureIds.map(id => features.find(feature => feature.id === id)).filter(Boolean) as AtomicFeature[];
  if (fromFeatures.length === 0 || toFeatures.length === 0) return false;
  const relationText = `${relation.evidence.map(item => item.quote).join(' ')} ${relation.statement}`;
  const originalFrom = fromFeatures.map(feature => featurePosition(relationText, feature)).filter((position): position is number => position !== null);
  const originalTo = toFeatures.map(feature => featurePosition(relationText, feature)).filter((position): position is number => position !== null);
  const basisFrom = fromFeatures.map(feature => featurePosition(basisText, feature)).filter((position): position is number => position !== null);
  const basisTo = toFeatures.map(feature => featurePosition(basisText, feature)).filter((position): position is number => position !== null);
  if (originalFrom.length === 0 || originalTo.length === 0 || basisFrom.length === 0 || basisTo.length === 0) return false;
  return Math.min(...originalFrom) < Math.min(...originalTo) === (Math.min(...basisFrom) < Math.min(...basisTo));
}

function mappingMatchesTarget(mapping: Record<string, unknown>, basis: EvidenceAnchor, features: AtomicFeature[], relations: FeatureRelation[]): boolean {
  const target = mapping.targetKind === 'feature'
    ? features.find(feature => feature.id === mapping.targetId)
    : relations.find(relation => relation.id === mapping.targetId);
  if (!target) return false;
  if (mapping.targetKind === 'relation') {
    const relation = target as FeatureRelation;
    if (!relationPredicateMatchesBasis(relation, basis.quote) || !relationDirectionMatchesBasis(relation, basis.quote, features)) return false;
  }
  const targetText = `${target.statement} ${target.evidence.map(item => item.quote).join(' ')}`;
  const basisTokens = meaningfulTokens(basis.quote);
  const overlaps = [...meaningfulTokens(targetText)].some(token => token.length >= 2 && basisTokens.has(token));
  if (!overlaps) return false;
  const targetNumbers: string[] = targetText.match(/\d+(?:\.\d+)?/g) ?? [];
  const basisNumbers: string[] = basis.quote.match(/\d+(?:\.\d+)?/g) ?? [];
  if (targetNumbers.some(number => !basisNumbers.includes(number)) || basisNumbers.some(number => !targetNumbers.includes(number))) return false;
  const comparison = (text: string): string | null => {
    if (/>=|大于等于|不少于|至少/.test(text)) return '>=';
    if (/<=|小于等于|不超过|至多/.test(text)) return '<=';
    if (/>|大于|高于|超过/.test(text)) return '>';
    if (/<|小于|低于/.test(text)) return '<';
    if (/!=|≠|不等于/.test(text)) return '!=';
    if (/=|等于|为/.test(text)) return '=';
    return null;
  };
  const targetComparison = comparison(targetText);
  const basisComparison = comparison(basis.quote);
  if (targetComparison && basisComparison && targetComparison !== basisComparison) return false;
  const negated = (text: string): boolean => /未|不|非|禁止|不得|排除/.test(text);
  return negated(targetText) === negated(basis.quote);
}

function supportedEvidence(
  statement: SupportedStatement,
  features: AtomicFeature[],
  relations: FeatureRelation[],
): EvidenceAnchor[] {
  return [
    ...statement.supportingFeatureIds.flatMap(id => features.find(feature => feature.id === id)?.evidence ?? []),
    ...statement.supportingRelationIds.flatMap(id => relations.find(relation => relation.id === id)?.evidence ?? []),
  ];
}

function normalizeSupportedStatement(raw: unknown, featureIds: Set<string>, relationIds: Set<string>, label: string, issues: string[]): SupportedStatement | null {
  if (!isRecord(raw) || typeof raw.text !== 'string' || !raw.text.trim()) {
    issues.push(`${label}缺少文本`);
    return null;
  }
  const supportFeatures = Array.isArray(raw.supportingFeatureIds) ? raw.supportingFeatureIds.filter(id => typeof id === 'string') as string[] : [];
  const supportRelations = Array.isArray(raw.supportingRelationIds) ? raw.supportingRelationIds.filter(id => typeof id === 'string') as string[] : [];
  if (supportFeatures.some(id => !featureIds.has(id)) || supportRelations.some(id => !relationIds.has(id))) issues.push(`${label}引用不存在的特征或关系`);
  if (supportFeatures.length === 0 && supportRelations.length === 0) issues.push(`${label}没有可追溯支持项`);
  return { text: raw.text.trim(), supportingFeatureIds: supportFeatures, supportingRelationIds: supportRelations };
}

function normalizeStructure(raw: unknown, featureIds: Set<string>, relationIds: Set<string>, issues: string[], seen = new Set<string>()): CompositionNode | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.label !== 'string' || !nodeTypes.has(String(raw.type))) {
    issues.push('组合结构节点无效');
    return null;
  }
  if (seen.has(raw.id)) issues.push(`组合结构节点 ID 重复：${raw.id}`);
  seen.add(raw.id);
  if (raw.featureId !== undefined && (typeof raw.featureId !== 'string' || !featureIds.has(raw.featureId))) issues.push(`结构引用不存在的特征：${String(raw.featureId)}`);
  if (raw.relationId !== undefined && (typeof raw.relationId !== 'string' || !relationIds.has(raw.relationId))) issues.push(`结构引用不存在的关系：${String(raw.relationId)}`);
  if (raw.operator !== undefined && !nodeOperators.has(String(raw.operator))) issues.push(`结构运算符无效：${String(raw.operator)}`);
  const childrenRaw = Array.isArray(raw.children) ? raw.children : [];
  const children = childrenRaw.map(child => normalizeStructure(child, featureIds, relationIds, issues, seen)).filter(Boolean) as CompositionNode[];
  return {
    id: raw.id, type: raw.type as CompositionNode['type'], label: raw.label,
    ...(typeof raw.featureId === 'string' ? { featureId: raw.featureId } : {}),
    ...(typeof raw.relationId === 'string' ? { relationId: raw.relationId } : {}),
    ...(typeof raw.operator === 'string' ? { operator: raw.operator as CompositionNode['operator'] } : {}),
    children,
  };
}

function validateCandidate(candidate: unknown, request: DeductionRequest): { result?: SemanticReconstruction; issues: string[] } {
  const issues: string[] = [];
  if (!isRecord(candidate)) return { issues: ['结果不是对象'] };
  if (candidate.input !== request.input) issues.push('原始输入没有原样保留');
  if (!Array.isArray(candidate.features) || candidate.features.length === 0) issues.push('没有识别出原子特征');

  const featureIds = new Set<string>();
  const features: AtomicFeature[] = [];
  const uncertaintyIssues: string[] = [];
  for (const raw of Array.isArray(candidate.features) ? candidate.features : []) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.statement !== 'string' || !featureKinds.has(String(raw.kind))) {
      issues.push('存在无效原子特征');
      continue;
    }
    if (featureIds.has(raw.id)) issues.push(`特征 ID 重复：${raw.id}`);
    featureIds.add(raw.id);
    const featureStatement = raw.statement;
    const evidence = anchorEvidence(raw.evidence, request.input);
    if (!evidence) issues.push(`特征 ${raw.id} 的证据无法在原始输入中定位`);
    if (raw.classification !== 'fact' && raw.classification !== 'judgment') issues.push(`特征 ${raw.id} 未区分事实与判断`);
    if (raw.certainty !== 'confirmed' && raw.certainty !== 'uncertain') issues.push(`特征 ${raw.id} 的确定性无效`);
    if (evidence && hasUnsupportedClaimText(featureStatement, evidence)) issues.push(`特征 ${raw.id} 的陈述包含原文证据未支持内容`);
    features.push({
      id: raw.id, kind: raw.kind as AtomicFeature['kind'], statement: featureStatement,
      classification: raw.classification as AtomicFeature['classification'], certainty: raw.certainty as AtomicFeature['certainty'],
      ...Object.fromEntries(['entity', 'attribute', 'action', 'state', 'value', 'time', 'space', 'quantity', 'metric', 'condition']
        .filter(key => typeof raw[key] === 'string').map(key => [key, raw[key]])),
      evidence: evidence ?? [],
    } as AtomicFeature);
  }

  const relationIds = new Set<string>();
  const relations: FeatureRelation[] = [];
  for (const raw of Array.isArray(candidate.relations) ? candidate.relations : []) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.statement !== 'string' || !relationTypes.has(String(raw.type))) {
      issues.push('存在无效特征关系');
      continue;
    }
    if (relationIds.has(raw.id)) issues.push(`关系 ID 重复：${raw.id}`);
    relationIds.add(raw.id);
    const from = Array.isArray(raw.fromFeatureIds) ? raw.fromFeatureIds.filter(id => typeof id === 'string') as string[] : [];
    const to = Array.isArray(raw.toFeatureIds) ? raw.toFeatureIds.filter(id => typeof id === 'string') as string[] : [];
    if (from.length === 0 || to.length === 0 || [...from, ...to].some(id => !featureIds.has(id))) issues.push(`关系 ${raw.id} 引用不存在的特征`);
    if (raw.operator !== undefined && !relationOperators.has(String(raw.operator))) issues.push(`关系 ${raw.id} 的逻辑运算符无效`);
    const evidence = anchorEvidence(raw.evidence, request.input);
    if (!evidence) issues.push(`关系 ${raw.id} 的证据无法在原始输入中定位`);
    if (raw.certainty !== 'confirmed' && raw.certainty !== 'uncertain') issues.push(`关系 ${raw.id} 的确定性无效`);
    const explicitRelation = evidence ? relationIsExplicit(raw, evidence) : false;
    const relationCertainty = raw.certainty === 'confirmed' && !explicitRelation ? 'uncertain' : raw.certainty;
    if (raw.certainty === 'confirmed' && !explicitRelation) {
      uncertaintyIssues.push(`关系 ${raw.id} 的类型和方向来自 AI 解析，本地仅确认引用位置`);
    }
    relations.push({
      id: raw.id, fromFeatureIds: from, toFeatureIds: to, type: raw.type as FeatureRelation['type'],
      ...(typeof raw.operator === 'string' ? { operator: raw.operator as FeatureRelation['operator'] } : {}),
      statement: raw.statement, certainty: relationCertainty as FeatureRelation['certainty'], evidence: evidence ?? [],
    });
  }

  const contexts: ContextGroup[] = [];
  for (const raw of Array.isArray(candidate.contexts) ? candidate.contexts : []) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.label !== 'string') {
      issues.push('存在无效公共上下文');
      continue;
    }
    const contextLabel = raw.label;
    const ids = Array.isArray(raw.featureIds) ? raw.featureIds.filter(id => typeof id === 'string') as string[] : [];
    if (ids.some(id => !featureIds.has(id))) issues.push(`上下文 ${raw.id} 引用不存在的特征`);
    const evidence = anchorEvidence(raw.evidence, request.input);
    if (!evidence) issues.push(`上下文 ${raw.id} 的证据无法在原始输入中定位`);
    if (evidence && !evidence.some(anchor => anchor.quote.trim() === contextLabel.trim())) {
      uncertaintyIssues.push(`上下文 ${raw.id} 的标签是 AI 归纳，本地仅确认引用位置`);
    }
    contexts.push({ id: raw.id, label: contextLabel, featureIds: ids, evidence: evidence ?? [] });
  }

  for (const context of contexts) {
    const contextTokens = meaningfulTokens(context.label);
    const scopedFeatures = features.filter(feature => context.featureIds.includes(feature.id));
    const exactShortContext = context.label.trim().length === 1 ? context.label.trim().toLowerCase() : null;
    const repeatedToken = [...contextTokens].find(token => (token.length >= 2 || token === exactShortContext)
      && scopedFeatures.filter(feature => meaningfulTokens(feature.statement).has(token)).length > 1);
    if (repeatedToken) issues.push(`公共上下文 ${context.id} 未上提，片段“${repeatedToken}”仍重复存在于多个特征陈述中`);
  }

  const structure = normalizeStructure(candidate.structure, featureIds, relationIds, issues);
  const coreMeaning = normalizeSupportedStatement(candidate.coreMeaning, featureIds, relationIds, '核心语义', issues);
  const punchline = normalizeSupportedStatement(candidate.punchline, featureIds, relationIds, '一针见血解读', issues);
  if (coreMeaning && hasUnsupportedClaimText(coreMeaning.text, supportedEvidence(coreMeaning, features, relations))) issues.push('核心语义包含支持项证据未覆盖的内容');
  if (punchline && hasUnsupportedClaimText(punchline.text, supportedEvidence(punchline, features, relations))) issues.push('一针见血解读包含支持项证据未覆盖的内容');
  let externalMappings: ExternalMapping[] | undefined;

  if (request.externalMappingRequested) {
    const sources = new Map((request.sources ?? []).map(source => [source.id, source]));
    externalMappings = [];
    for (const raw of Array.isArray(candidate.externalMappings) ? candidate.externalMappings : []) {
      if (!isRecord(raw) || typeof raw.id !== 'string' || (raw.targetKind !== 'feature' && raw.targetKind !== 'relation')
        || typeof raw.targetId !== 'string' || typeof raw.sourceId !== 'string') {
        issues.push('存在无效外部映射');
        continue;
      }
      const targetExists = raw.targetKind === 'feature' ? featureIds.has(raw.targetId) : relationIds.has(raw.targetId);
      if (!targetExists) issues.push(`外部映射 ${raw.id} 引用不存在的目标`);
      const source = sources.get(raw.sourceId);
      if (!source) issues.push(`外部映射 ${raw.id} 引用不存在的依据`);
      const basis = source && isRecord(raw.basis) ? anchorEvidence([raw.basis], source.content, source.id)?.[0] : undefined;
      let matchLevel = mappingLevels.has(String(raw.matchLevel)) ? raw.matchLevel as ExternalMapping['matchLevel'] : '无法确认';
      let validationNote = typeof raw.validationNote === 'string' ? raw.validationNote : '';
      if (matchLevel !== '无法确认' && !basis) {
        matchLevel = '无法确认';
        validationNote = '依据无法在用户提供资料中定位，已降级为无法确认。';
        uncertaintyIssues.push(`外部映射 ${raw.id} 的依据无法定位`);
      } else if (basis && (matchLevel === '直接对应' || matchLevel === '高度匹配') && !mappingMatchesTarget(raw, basis, features, relations)) {
        matchLevel = '仅相关';
        validationNote = '依据原文存在，但对象、特征、条件或取值无法与目标形成直接对应，已降级为仅相关。';
        uncertaintyIssues.push(`外部映射 ${raw.id} 与目标缺少直接对应证据`);
      }
      externalMappings.push({
        id: raw.id, targetKind: raw.targetKind, targetId: raw.targetId, sourceId: raw.sourceId,
        correspondingObject: typeof raw.correspondingObject === 'string' ? raw.correspondingObject : '',
        correspondingContent: typeof raw.correspondingContent === 'string' ? raw.correspondingContent : '',
        matchLevel, ...(basis ? { basis } : {}), validationNote,
      });
    }
    if (externalMappings.length === 0) issues.push('已请求外部映射，但结果没有逐项映射或无法确认项');
  }

  if (features.some(feature => feature.certainty === 'uncertain') || relations.some(relation => relation.certainty === 'uncertain')) {
    uncertaintyIssues.push('存在待确认的特征或关系');
  }
  if (issues.length > 0 || !structure || !coreMeaning || !punchline) return { issues };
  return {
    issues: [],
    result: {
      version: DEDUCTION_RESULT_VERSION,
      input: request.input,
      features, relations, contexts, structure, coreMeaning,
      ...(request.externalMappingRequested ? { externalMappings } : {}),
      punchline,
      validation: {
        status: uncertaintyIssues.length > 0 ? 'valid_with_uncertainty' : 'valid',
        issues: uncertaintyIssues,
      },
    },
  };
}

export async function reconstructSemantics(
  request: DeductionRequest,
  client: DeductionAiClient = defaultAiClient,
): Promise<SemanticReconstruction> {
  const input = request.input.trim();
  if (!input) throw new Error('请输入需要还原的原始文本');
  const normalizedRequest: DeductionRequest = {
    ...request,
    input,
    sources: (request.sources ?? []).filter(source => source.title.trim() && source.content.trim()),
  };
  if (normalizedRequest.externalMappingRequested && normalizedRequest.sources?.length === 0) {
    throw new Error('请求外部映射时，至少提供一份命名依据');
  }

  const draft = parseJson(await client.generate(reconstructionPrompt(normalizedRequest), SYSTEM_INSTRUCTION));
  const audited = parseJson(await client.generate(auditPrompt(normalizedRequest, draft), SYSTEM_INSTRUCTION));
  let validation = validateCandidate(audited, normalizedRequest);
  if (validation.result) return validation.result;

  const repaired = parseJson(await client.generate(repairPrompt(normalizedRequest, audited, validation.issues), SYSTEM_INSTRUCTION));
  validation = validateCandidate(repaired, normalizedRequest);
  if (!validation.result) throw new DeductionValidationError(validation.issues);
  return validation.result;
}

export function cancelSemanticReconstruction(): boolean {
  return aiService.cancelActiveRequest();
}
