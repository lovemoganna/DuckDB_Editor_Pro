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
不要输出 validation，它由本地校验器产生。公共属性上提到 contexts，不要复制成多个 Feature。外部映射未请求时必须为空数组。注意：每个特征必须指明 classification，严格取英文 "fact"（客观事实/属性/数值/状态）或 "judgment"（推论/判断/规则结论/允许）；relations 中的 fromFeatureIds 和 toFeatureIds 必须是字符串数组且只能引用 features 中已声明的特征 ID（如 ["F1"]，切勿使用单个字符串或未声明的 ID）；structure 必须是一个单独的对象（不能是数组），根节点 type 为 operator 或 conditional（条件节点必须用 conditional，不要用 condition），每个节点均需包含 id、label 和 children。coreMeaning 和 punchline 的陈述必须紧扣输入事实与支持项。`;

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
  const issueGuidance: string[] = [];
  if (issues.some(i => i.includes('未区分事实与判断'))) {
    issueGuidance.push('【重要】每个特征的 "classification" 必须严格取英文 "fact"（客观事实、属性、条件、状态）或 "judgment"（判定、推论、规则结论、允许）。');
  }
  if (issues.some(i => i.includes('引用不存在的特征'))) {
    issueGuidance.push('【重要】每个关系的 "fromFeatureIds" 与 "toFeatureIds" 必须是字符串数组，且其中的每个 ID 必须在 features 列表中已明确声明（如 ["F1"]、["F2"]），绝不能引用不存在的特征 ID 或使用单个字符串。');
  }
  const guidanceText = issueGuidance.length > 0 ? `\n专项修复指导：\n${issueGuidance.join('\n')}\n` : '';

  return `${SCHEMA_GUIDE}\n\n本地证据校验发现以下错误：\n- ${issues.join('\n- ')}${guidanceText}\n请只修正这些错误，返回完整 JSON。不得删除输入明确表达的事实来逃避校验。注意：structure 根节点必须为单个对象，节点类型必须取 feature|relation|context|operator|conditional 之一。\n\n原始输入：\n${request.input}\n\n${sourcePrompt(request)}\n\n待修复结果：\n${JSON.stringify(candidate)}`;
}

function parseJson(raw: string): unknown {
  if (typeof raw !== 'string') throw new DeductionValidationError(['AI 未返回有效的 JSON 字符串']);
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

const kindMap: Record<string, AtomicFeature['kind']> = {
  entity: 'entity', '实体': 'entity', '对象': 'entity',
  attribute: 'attribute', '属性': 'attribute',
  action: 'action', '动作': 'action', '行为': 'action',
  state: 'state', '状态': 'state',
  value: 'value', '数值': 'value', '值': 'value',
  time: 'time', '时间': 'time',
  space: 'space', '空间': 'space', '地点': 'space', '位置': 'space',
  quantity: 'quantity', '数量': 'quantity',
  metric: 'metric', '指标': 'metric',
  condition: 'condition', '条件': 'condition',
  event: 'event', '事件': 'event',
  constraint: 'constraint', '约束': 'constraint',
  result: 'result', '结果': 'result', '结论': 'result',
  other: 'other', '其他': 'other',
};

function normalizeClassification(
  rawClassification: unknown,
  kind?: string,
  statement?: string,
): AtomicFeature['classification'] | null {
  if (typeof rawClassification === 'string') {
    const c = rawClassification.trim().toLowerCase();
    if (c === 'fact' || c === '事实' || c === '客观事实' || c === 'observation' || c === 'true') {
      return 'fact';
    }
    if (
      c === 'judgment' ||
      c === 'judgement' ||
      c === '判断' ||
      c === '推断' ||
      c === '结论' ||
      c === '观点' ||
      c === '主观判断' ||
      c === 'conclusion'
    ) {
      return 'judgment';
    }
  }
  const text = (statement || '').toLowerCase();
  const judgmentKeywords = [
    '可以', '应当', '必须', '建议', '认定', '判定', '结论',
    '允许', '合格', '不合格', '有效', '无效', '风险', '优', '劣', '可能', '意味着',
  ];
  if (kind === 'result' || kind === 'constraint' || judgmentKeywords.some(kw => text.includes(kw))) {
    return 'judgment';
  }
  if (kind && (featureKinds.has(kind) || kindMap[kind])) {
    return 'fact';
  }
  return null;
}

function resolveSingleFeatureId(
  target: unknown,
  featureIds: Set<string>,
  features: AtomicFeature[],
): string | null {
  if (target === undefined || target === null) return null;
  const rawStr = String(target).trim();
  if (!rawStr) return null;

  if (featureIds.has(rawStr)) return rawStr;

  const lower = rawStr.toLowerCase();
  for (const id of featureIds) {
    if (id.toLowerCase() === lower) return id;
  }

  const numMatch = rawStr.match(/^(?:f(?:eature)?[-_]?)?0*(\d+)$/i);
  if (numMatch) {
    const num = numMatch[1];
    for (const id of featureIds) {
      const idNumMatch = id.match(/^(?:f(?:eature)?[-_]?)?0*(\d+)$/i);
      if (idNumMatch && idNumMatch[1] === num) return id;
    }
  }

  for (const f of features) {
    if (f.statement === rawStr || f.entity === rawStr) return f.id;
    if (f.evidence.some(e => e.quote === rawStr || (e.quote.length >= 2 && rawStr.includes(e.quote)))) {
      return f.id;
    }
  }

  return null;
}

function extractEndpointIds(
  raw: Record<string, unknown>,
  primaryKey: string,
  aliasKeys: string[],
): unknown[] {
  for (const key of [primaryKey, ...aliasKeys]) {
    const val = raw[key];
    if (val !== undefined && val !== null) {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string' || typeof val === 'number') {
        const str = String(val).trim();
        if (str.includes(',')) return str.split(',').map(s => s.trim()).filter(Boolean);
        if (str.includes('、')) return str.split('、').map(s => s.trim()).filter(Boolean);
        return [str];
      }
    }
  }
  return [];
}

const UNIVERSAL_META_PHRASES = [
  '对象', '实体', '属性', '行为', '动作', '状态', '条件', '结果', '事实', '判断', '数值', '时间', '空间', '数量', '指标', '约束', '事件', '输入', '原文', '表达', '观点', '描述', '说明', '定义', '设置', '层级', '阶段',
  '位于', '处于', '存在', '属于', '包含', '包括', '构成', '组合', '满足', '通过', '发生', '形成', '表示', '表达', '明确', '共同',
  '的是', '中的', '这个', '该', '其', '一个', '一种', '为', '是', '有', '由', '与', '和', '且', '在', '时', '可', '需', '的', '了', '来自',
  '因此', '因而', '所以', '由此', '故', '促成', '基于', '根据', '依据', '按照',
  '只要', '只有', '除非', '如果', '那么', '若', '则', '即', '便', '方可', '即可', '允许', '予以', '能够', '可以',
  '要求', '规则', '具备', '具有', '符合', '达成', '达到', '成立', '生效', '触发', '前置', '充分', '必要',
  '核心', '语义', '解读', '一针见血', '逻辑', '总结', '综上', '整体', '上述', '意味', '意味着', '对应', '关联',
  '同时', '并且', '以及', '两者', '各个', '各项', '所有', '全部', '作为', '进行', '产生', '最终',
  'entity', 'attribute', 'action', 'state', 'value', 'time', 'space', 'quantity', 'metric', 'condition', 'event', 'constraint', 'result', 'statement', 'fact', 'judgment',
  'located', 'situated', 'positioned', 'contains', 'includes', 'consists', 'belongs',
  'therefore', 'thus', 'hence', 'because', 'due', 'implies', 'requires', 'criteria', 'core', 'meaning', 'punchline', 'summary', 'interpretation', 'both', 'all', 'each', 'applies', 'satisfied', 'satisfies',
];

const UNIVERSAL_STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'as', 'into', 'that', 'this', 'these', 'those', 'and', 'or', 'not', 'but', 'which', 'where', 'when', 'who', 'how',
  '对象', '属性', '事实', '判断', '是', '为', '有', '由', '与', '和', '且', '在', '时', '可', '需', '的', '了',
  '其', '该', '各', '每', '此', '因', '故', '即', '若', '则', '便', '及', '并', '或', '已', '又', '更', '将', '以', '至', '自',
]);

function hasUnsupportedClaimText(statement: string, evidence: EvidenceAnchor[], additionalContext = ''): boolean {
  const evidenceText = (evidence.map(item => item.quote).join('') + additionalContext).toLowerCase();
  
  // Clean structural meta phrases from statement first
  let cleanedStatement = statement.toLowerCase();
  for (const term of UNIVERSAL_META_PHRASES) {
    if (term.length > 1) {
      cleanedStatement = cleanedStatement.replaceAll(term.toLowerCase(), '');
    }
  }

  // Extract CJK characters from statement
  const compactChinese = cleanedStatement.replace(/[a-z0-9_]+/gi, '').replace(/[\s\p{P}\p{S}]/gu, '');
  const chineseChars = compactChinese.match(/[\u3400-\u9fff]/g) ?? [];
  const nonStopChinese = chineseChars.filter(char => !UNIVERSAL_STOP_WORDS.has(char));
  if (nonStopChinese.some(character => !evidenceText.includes(character))) return true;

  // Extract alphanumeric words
  const words = (cleanedStatement.match(/[a-z0-9_]+/g) ?? []).filter(word => !UNIVERSAL_STOP_WORDS.has(word));
  return words.some(word => !evidenceText.includes(word));
}

const multiLingualRelationPatterns: Record<FeatureRelation['type'], RegExp> = {
  parallel: /并列|同时|以及|和|与|、|parallel|concurrent|both|alongside|&|&&/i,
  containment: /包含|包括|组成|属于|contain|include|consist|comprise|belong|in|∈/i,
  subordination: /属于|隶属|从属|归于|subordinate|belong|under|part of|child of/i,
  dependency: /依赖|取决于|前提|则|需要|depend|require|prerequisite|need|rely|relies/i,
  causation: /导致|造成|因为|因此|由于|引发|使得|cause|result|lead|induce|bring about|due to|because|derive|trigger|->|=>/i,
  sequence: /之前|之后|同时|随后|先.+再|早于|晚于|before|after|then|subsequent|precede|follow|earlier|later|->/i,
  comparison: /大于|小于|等于|高于|低于|相同|不同|相比|greater|less|equal|higher|lower|same|different|compare|exceed|>|<|=|≠/i,
  aggregation: /聚合|汇总|合计|总和|组成|aggregate|sum|total|combine|compose|assembled/i,
  association: /关联|相关|连接|对应|associate|relate|link|connect|map|correspond|orbit|orbits|orbital/i,
  exclusion: /排斥|互斥|不能同时|排除|exclude|exclusive|incompatible|disjoint/i,
  condition: /条件|前提|只有|只要|除非|如果|若|当.+时|则|condition|if|when|provided|unless|suppose|given/i,
  constraint: /必须|不得|限制|至少|至多|不超过|不少于|must|constraint|limit|restrict|bound|at least|at most|no more|no less/i,
  change: /变化|增加|减少|变为|从.+到|change|increase|decrease|transform|vary|shift|become/i,
};

const operatorPatterns: Record<NonNullable<FeatureRelation['operator']>, RegExp> = {
  AND: /且|并且|同时|以及|AND|&|&&|and/i,
  OR: /或|或者|OR|\||\|\||or/i,
  NOT: /不|非|排除|NOT|!|not/i,
  IF_THEN: /如果|若|当.+时|则|那么|IF|THEN|if|then|implies|=>/i,
  '>': />|大于|高于|超过|greater than|exceeds/i,
  '>=': />=|大于等于|不少于|至少|at least|no less than/i,
  '<': /<|小于|低于|less than|below/i,
  '<=': /<=|小于等于|不超过|至多|at most|no more than/i,
  '=': /=|等于|为|equals|equal to/i,
  '!=': /!=|≠|不等于|not equal|differs from/i,
  IN: /属于|位于|在.+中|in|within/i,
  BETWEEN: /介于|之间|范围|between|range/i,
};

function relationIsExplicit(raw: Record<string, unknown>, evidence: EvidenceAnchor[]): boolean {
  const text = evidence.map(item => item.quote).join('');
  const operator = typeof raw.operator === 'string' ? raw.operator as FeatureRelation['operator'] : undefined;
  
  if (raw.type === 'causation') {
    const isDisclaimer = /未说明因果|无因果|不能确定因果|no causal|not cause|unproven cause|no causality/i.test(text);
    return !isDisclaimer && multiLingualRelationPatterns.causation.test(text);
  }

  if (operator && operatorPatterns[operator]) {
    return operatorPatterns[operator].test(text);
  }

  const relationType = typeof raw.type === 'string' ? raw.type as FeatureRelation['type'] : undefined;
  if (relationType && multiLingualRelationPatterns[relationType]) {
    return multiLingualRelationPatterns[relationType].test(text);
  }

  return raw.certainty === 'uncertain';
}

function meaningfulTokens(text: string): Set<string> {
  const normalized = text.toLowerCase();
  const tokens = new Set(normalized.match(/[a-z0-9_]+/g) ?? []);
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

function relationPredicateMatchesBasis(relation: FeatureRelation, basisText: string): boolean {
  if (!multiLingualRelationPatterns[relation.type]?.test(basisText)) return false;
  if (!relation.operator) return true;
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
    if (/>=|大于等于|不少于|至少|at least|no less than/i.test(text)) return '>=';
    if (/<=|小于等于|不超过|至多|at most|no more than/i.test(text)) return '<=';
    if (/>|大于|高于|超过|greater than|exceeds/i.test(text)) return '>';
    if (/<|小于|低于|less than|below/i.test(text)) return '<';
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

function normalizeSupportedStatement(
  raw: unknown,
  featureIds: Set<string>,
  relationIds: Set<string>,
  features: AtomicFeature[],
  label: string,
  issues: string[],
): SupportedStatement | null {
  if (!isRecord(raw) || typeof raw.text !== 'string' || !raw.text.trim()) {
    issues.push(`${label}缺少文本`);
    return null;
  }
  const rawFeatures = extractEndpointIds(raw, 'supportingFeatureIds', ['features', 'supportingFeatures']);
  const rawRelations = extractEndpointIds(raw, 'supportingRelationIds', ['relations', 'supportingRelations']);

  const supportFeatures: string[] = [];
  for (const item of rawFeatures) {
    const resolved = resolveSingleFeatureId(item, featureIds, features);
    if (resolved && !supportFeatures.includes(resolved)) {
      supportFeatures.push(resolved);
    } else if (!resolved) {
      issues.push(`${label}引用不存在的特征或关系`);
    }
  }

  const supportRelations: string[] = [];
  for (const item of rawRelations) {
    const rid = String(item).trim();
    if (relationIds.has(rid)) {
      if (!supportRelations.includes(rid)) supportRelations.push(rid);
    } else {
      const matched = [...relationIds].find(r => r.toLowerCase() === rid.toLowerCase());
      if (matched && !supportRelations.includes(matched)) {
        supportRelations.push(matched);
      } else {
        issues.push(`${label}引用不存在的特征或关系`);
      }
    }
  }

  if (supportFeatures.length === 0 && supportRelations.length === 0) issues.push(`${label}没有可追溯支持项`);
  return { text: raw.text.trim(), supportingFeatureIds: supportFeatures, supportingRelationIds: supportRelations };
}

function normalizeStructure(
  raw: unknown,
  featureIds: Set<string>,
  relationIds: Set<string>,
  features: AtomicFeature[],
  relations: FeatureRelation[],
  issues: string[],
  uncertaintyIssues: string[],
  seen = new Set<string>(),
): CompositionNode | null {
  // If raw is an array, take single element or wrap
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      raw = null;
    } else if (raw.length === 1) {
      raw = raw[0];
    } else {
      raw = {
        id: 'N_root',
        type: 'operator',
        label: '组合结构',
        operator: 'AND',
        children: raw,
      };
    }
  }

  if (!isRecord(raw)) {
    if (features.length > 0) {
      uncertaintyIssues.push('组合结构由系统基于原子特征自动对齐');
      return {
        id: 'N_root',
        type: 'operator',
        label: '组合结构',
        operator: 'AND',
        children: features.map((f, i) => ({
          id: `N_f${i + 1}`,
          type: 'feature' as const,
          label: f.statement || f.id,
          featureId: f.id,
          children: [],
        })),
      };
    }
    issues.push('组合结构节点无效');
    return null;
  }

  let id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : (raw.id !== undefined && raw.id !== null ? String(raw.id).trim() : '');
  if (!id) {
    id = `N_${seen.size + 1}`;
  }
  if (seen.has(id)) {
    id = `${id}_${seen.size + 1}`;
  }
  seen.add(id);

  let typeStr = String(raw.type || '').trim().toLowerCase();
  if (typeStr === 'condition') typeStr = 'conditional';
  if (['logic', 'root', 'group', 'expression', 'rule', 'composition'].includes(typeStr)) typeStr = 'operator';
  if (['and', 'or', 'not'].includes(typeStr)) {
    if (!raw.operator) raw.operator = typeStr.toUpperCase();
    typeStr = 'operator';
  }
  if (['if', 'then', 'if_then', 'if-then'].includes(typeStr)) {
    if (!raw.operator) raw.operator = typeStr === 'then' ? 'THEN' : 'IF';
    typeStr = 'conditional';
  }

  if (!nodeTypes.has(typeStr)) {
    if (raw.featureId && (typeof raw.featureId === 'string' || typeof raw.featureId === 'number')) {
      typeStr = 'feature';
    } else if (raw.relationId && (typeof raw.relationId === 'string' || typeof raw.relationId === 'number')) {
      typeStr = 'relation';
    } else if (raw.operator) {
      typeStr = 'operator';
    } else if (Array.isArray(raw.children) && raw.children.length > 0) {
      typeStr = 'operator';
    } else {
      typeStr = 'feature';
    }
  }

  let featureId: string | undefined;
  if (raw.featureId !== undefined && raw.featureId !== null) {
    const resolved = resolveSingleFeatureId(raw.featureId, featureIds, features);
    if (resolved) {
      featureId = resolved;
    } else {
      issues.push(`结构引用不存在的特征：${String(raw.featureId).trim()}`);
    }
  }

  let relationId: string | undefined;
  if (raw.relationId !== undefined && raw.relationId !== null) {
    const rid = String(raw.relationId).trim();
    if (relationIds.has(rid)) {
      relationId = rid;
    } else {
      const matched = [...relationIds].find(item => item.toLowerCase() === rid.toLowerCase());
      if (matched) {
        relationId = matched;
      } else {
        issues.push(`结构引用不存在的关系：${rid}`);
      }
    }
  }

  let operator: CompositionNode['operator'] | undefined;
  if (raw.operator !== undefined && raw.operator !== null) {
    const opStr = String(raw.operator).trim().toUpperCase();
    if (opStr === 'IF_THEN' || opStr === 'IF-THEN') {
      operator = 'IF';
    } else if (nodeOperators.has(opStr)) {
      operator = opStr as CompositionNode['operator'];
    } else if (opStr === '&&') {
      operator = 'AND';
    } else if (opStr === '||') {
      operator = 'OR';
    } else if (opStr === '!') {
      operator = 'NOT';
    }
  }

  let label = typeof raw.label === 'string' ? raw.label.trim() : '';
  if (!label) {
    if (typeof raw.statement === 'string' && raw.statement.trim()) label = raw.statement.trim();
    else if (typeof raw.text === 'string' && raw.text.trim()) label = raw.text.trim();
    else if (typeof raw.name === 'string' && raw.name.trim()) label = raw.name.trim();
    else if (operator) label = operator;
    else if (featureId) {
      const f = features.find(item => item.id === featureId);
      label = f?.statement || featureId;
    } else if (relationId) {
      const r = relations.find(item => item.id === relationId);
      label = r?.statement || relationId;
    } else {
      label = typeStr.toUpperCase();
    }
  }

  const childrenRaw = Array.isArray(raw.children) ? raw.children : [];
  const children: CompositionNode[] = [];
  for (const child of childrenRaw) {
    if (isRecord(child) || Array.isArray(child)) {
      const normalizedChild = normalizeStructure(child, featureIds, relationIds, features, relations, issues, uncertaintyIssues, seen);
      if (normalizedChild) children.push(normalizedChild);
    }
  }

  return {
    id,
    type: typeStr as CompositionNode['type'],
    label,
    ...(featureId ? { featureId } : {}),
    ...(relationId ? { relationId } : {}),
    ...(operator ? { operator } : {}),
    children,
  };
}

function validateCandidate(
  candidate: unknown,
  request: DeductionRequest,
  isFinalRecovery = false,
): { result?: SemanticReconstruction; issues: string[] } {
  const issues: string[] = [];
  if (!isRecord(candidate)) return { issues: ['结果不是对象'] };
  if (candidate.input !== request.input) issues.push('原始输入没有原样保留');
  if (!Array.isArray(candidate.features) || candidate.features.length === 0) issues.push('没有识别出原子特征');

  const featureIds = new Set<string>();
  const features: AtomicFeature[] = [];
  const uncertaintyIssues: string[] = [];
  for (const raw of Array.isArray(candidate.features) ? candidate.features : []) {
    if (!isRecord(raw)) {
      issues.push('存在无效原子特征');
      continue;
    }
    let id = typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : (typeof raw.id === 'number' ? `F${raw.id}` : '');
    if (!id) id = `F${featureIds.size + 1}`;

    const statement = typeof raw.statement === 'string' && raw.statement.trim()
      ? raw.statement.trim()
      : (typeof raw.text === 'string' && raw.text.trim() ? raw.text.trim() : '');

    const rawKindStr = String(raw.kind || '').trim().toLowerCase();
    const kind = kindMap[rawKindStr] || (featureKinds.has(rawKindStr) ? rawKindStr as AtomicFeature['kind'] : 'other');

    if (!statement) {
      issues.push('存在无效原子特征');
      continue;
    }
    if (featureIds.has(id)) issues.push(`特征 ID 重复：${id}`);
    featureIds.add(id);

    const featureStatement = statement;
    const evidence = anchorEvidence(raw.evidence, request.input);
    if (!evidence) issues.push(`特征 ${id} 的证据无法在原始输入中定位`);

    const classification = normalizeClassification(raw.classification, kind, featureStatement);
    if (!classification) issues.push(`特征 ${id} 未区分事实与判断`);

    let certainty: AtomicFeature['certainty'] = 'confirmed';
    if (typeof raw.certainty === 'string') {
      const cert = raw.certainty.trim().toLowerCase();
      if (cert === 'uncertain' || cert === '待确认' || cert === '不确定' || cert === '疑似') {
        certainty = 'uncertain';
      } else if (cert === 'confirmed' || cert === '确认' || cert === '确定') {
        certainty = 'confirmed';
      } else {
        issues.push(`特征 ${id} 的确定性无效`);
      }
    }

    if (evidence && hasUnsupportedClaimText(featureStatement, evidence)) issues.push(`特征 ${id} 的陈述包含原文证据未支持内容`);
    features.push({
      id, kind, statement: featureStatement,
      classification: classification || 'fact', certainty,
      ...Object.fromEntries(['entity', 'attribute', 'action', 'state', 'value', 'time', 'space', 'quantity', 'metric', 'condition']
        .filter(key => typeof raw[key] === 'string').map(key => [key, raw[key]])),
      evidence: evidence ?? [],
    } as AtomicFeature);
  }

  const relationIds = new Set<string>();
  const relations: FeatureRelation[] = [];
  for (const raw of Array.isArray(candidate.relations) ? candidate.relations : []) {
    if (!isRecord(raw) || (typeof raw.statement !== 'string' && typeof raw.text !== 'string')) {
      issues.push('存在无效特征关系');
      continue;
    }
    let id = typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : (typeof raw.id === 'number' ? `R${raw.id}` : `R${relationIds.size + 1}`);

    let relTypeStr = String(raw.type || '').trim().toLowerCase();
    if (!relationTypes.has(relTypeStr)) {
      if (['if_then', 'if-then', 'implies', 'cause', 'condition'].includes(relTypeStr)) relTypeStr = 'condition';
      else if (['and', 'parallel', 'both'].includes(relTypeStr)) relTypeStr = 'parallel';
      else relTypeStr = 'association';
    }

    if (relationIds.has(id)) issues.push(`关系 ID 重复：${id}`);
    relationIds.add(id);

    const rawFrom = extractEndpointIds(raw, 'fromFeatureIds', ['from', 'sourceFeatureIds', 'source', 'fromFeatureId', 'fromFeatures', 'fromId']);
    const rawTo = extractEndpointIds(raw, 'toFeatureIds', ['to', 'targetFeatureIds', 'target', 'toFeatureId', 'toFeatures', 'toId']);

    const resolvedFrom: string[] = [];
    const unresolvableFrom: unknown[] = [];
    for (const item of rawFrom) {
      const resolved = resolveSingleFeatureId(item, featureIds, features);
      if (resolved) {
        if (!resolvedFrom.includes(resolved)) resolvedFrom.push(resolved);
      } else {
        unresolvableFrom.push(item);
      }
    }

    const resolvedTo: string[] = [];
    const unresolvableTo: unknown[] = [];
    for (const item of rawTo) {
      const resolved = resolveSingleFeatureId(item, featureIds, features);
      if (resolved) {
        if (!resolvedTo.includes(resolved)) resolvedTo.push(resolved);
      } else {
        unresolvableTo.push(item);
      }
    }

    let from = resolvedFrom;
    let to = resolvedTo;
    const hasUnresolved = unresolvableFrom.length > 0 || unresolvableTo.length > 0 || from.length === 0 || to.length === 0;

    const statement = typeof raw.statement === 'string' && raw.statement.trim()
      ? raw.statement.trim()
      : (typeof raw.text === 'string' && raw.text.trim() ? raw.text.trim() : '');

    if (hasUnresolved) {
      if (isFinalRecovery && features.length > 0) {
        if (from.length === 0) {
          const matched = features.filter(f => statement && (statement.includes(f.statement) || f.evidence.some(e => statement.includes(e.quote))));
          from = matched.length > 0 ? [matched[0].id] : [features[0].id];
        }
        if (to.length === 0) {
          const matched = features.filter(f => !from.includes(f.id) && statement && (statement.includes(f.statement) || f.evidence.some(e => statement.includes(e.quote))));
          to = matched.length > 0 ? [matched[0].id] : [features[features.length - 1].id];
        }
        uncertaintyIssues.push(`关系 ${id} 包含未明确对齐的特征引用，已自动校准并标记为待确认`);
      } else {
        issues.push(`关系 ${id} 引用不存在的特征`);
      }
    }

    let operator: FeatureRelation['operator'] | undefined;
    if (raw.operator !== undefined && raw.operator !== null) {
      const opStr = String(raw.operator).trim().toUpperCase();
      if (relationOperators.has(opStr)) {
        operator = opStr as FeatureRelation['operator'];
      } else if (opStr === '&&') {
        operator = 'AND';
      } else if (opStr === '||') {
        operator = 'OR';
      } else {
        issues.push(`关系 ${id} 的逻辑运算符无效`);
      }
    }

    const evidence = anchorEvidence(raw.evidence, request.input);
    if (!evidence) issues.push(`关系 ${id} 的证据无法在原始输入中定位`);

    let rawCertainty: FeatureRelation['certainty'] = 'confirmed';
    if (typeof raw.certainty === 'string') {
      const cert = raw.certainty.trim().toLowerCase();
      if (cert === 'uncertain' || cert === '待确认' || cert === '不确定') {
        rawCertainty = 'uncertain';
      } else if (cert === 'confirmed' || cert === '确定' || cert === '确认') {
        rawCertainty = 'confirmed';
      } else {
        issues.push(`关系 ${id} 的确定性无效`);
      }
    }

    const explicitRelation = evidence ? relationIsExplicit(raw, evidence) : false;
    const isCausalDisclaimer = relTypeStr === 'causation' && evidence && /未说明因果|无因果|不能确定因果|no causal|not cause|unproven cause|no causality/i.test(evidence.map(item => item.quote).join(''));
    if (isCausalDisclaimer) {
      issues.push(`关系 ${id} 的证据明确包含因果免责声明，不得断言因果关系`);
    }
    const relationCertainty = (rawCertainty === 'confirmed' && (!explicitRelation || (isFinalRecovery && hasUnresolved)))
      ? 'uncertain'
      : rawCertainty;
    if (rawCertainty === 'confirmed' && !explicitRelation) {
      uncertaintyIssues.push(`关系 ${id} 的类型和方向来自 AI 解析，本地仅确认引用位置`);
    }
    relations.push({
      id, fromFeatureIds: from, toFeatureIds: to, type: relTypeStr as FeatureRelation['type'],
      ...(operator ? { operator } : {}),
      statement, certainty: relationCertainty as FeatureRelation['certainty'], evidence: evidence ?? [],
    });
  }

  const contexts: ContextGroup[] = [];
  for (const raw of Array.isArray(candidate.contexts) ? candidate.contexts : []) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.label !== 'string') {
      issues.push('存在无效公共上下文');
      continue;
    }
    const contextLabel = raw.label;
    const rawIds = extractEndpointIds(raw, 'featureIds', ['features', 'targetFeatureIds', 'targetIds']);
    const ids: string[] = [];
    for (const item of rawIds) {
      const resolved = resolveSingleFeatureId(item, featureIds, features);
      if (resolved && !ids.includes(resolved)) {
        ids.push(resolved);
      } else if (!resolved) {
        issues.push(`上下文 ${raw.id} 引用不存在的特征`);
      }
    }
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

  const structure = normalizeStructure(candidate.structure, featureIds, relationIds, features, relations, issues, uncertaintyIssues);
  const coreMeaning = normalizeSupportedStatement(candidate.coreMeaning, featureIds, relationIds, features, '核心语义', issues);
  const punchline = normalizeSupportedStatement(candidate.punchline, featureIds, relationIds, features, '一针见血解读', issues);

  if (coreMeaning) {
    const evidence = supportedEvidence(coreMeaning, features, relations);
    if (hasUnsupportedClaimText(coreMeaning.text, evidence, request.input)) {
      uncertaintyIssues.push('核心语义包含支持项证据未覆盖的内容，属于 AI 综合归纳，本地仅确认引用位置');
    }
  }
  if (punchline) {
    const evidence = supportedEvidence(punchline, features, relations);
    if (hasUnsupportedClaimText(punchline.text, evidence, request.input)) {
      uncertaintyIssues.push('一针见血解读包含支持项证据未覆盖的内容，属于 AI 综合归纳，本地仅确认引用位置');
    }
  }
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
  if (validation.result) return validation.result;

  // Final auto-healing recovery pass on repaired
  const healedValidation = validateCandidate(repaired, normalizedRequest, true);
  if (healedValidation.result) return healedValidation.result;

  throw new DeductionValidationError(validation.issues);
}

export function cancelSemanticReconstruction(): boolean {
  return aiService.cancelActiveRequest();
}
