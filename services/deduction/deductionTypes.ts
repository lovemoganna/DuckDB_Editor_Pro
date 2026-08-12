export const DEDUCTION_RESULT_VERSION = 1 as const;

export type FeatureKind =
  | 'entity' | 'attribute' | 'action' | 'state' | 'value' | 'time' | 'space'
  | 'quantity' | 'metric' | 'condition' | 'event' | 'constraint' | 'result' | 'other';

export type FeatureClassification = 'fact' | 'judgment';
export type Certainty = 'confirmed' | 'uncertain';

export interface DeductionSource {
  id: string;
  title: string;
  content: string;
}

export interface DeductionRequest {
  input: string;
  externalMappingRequested: boolean;
  sources?: DeductionSource[];
}

export interface EvidenceAnchor {
  quote: string;
  start: number;
  end: number;
  sourceId?: string;
}

export interface AtomicFeature {
  id: string;
  kind: FeatureKind;
  statement: string;
  classification: FeatureClassification;
  certainty: Certainty;
  entity?: string;
  attribute?: string;
  action?: string;
  state?: string;
  value?: string;
  time?: string;
  space?: string;
  quantity?: string;
  metric?: string;
  condition?: string;
  evidence: EvidenceAnchor[];
}

export type RelationType =
  | 'parallel' | 'containment' | 'subordination' | 'dependency' | 'causation'
  | 'sequence' | 'comparison' | 'aggregation' | 'association' | 'exclusion'
  | 'condition' | 'constraint' | 'change';

export type RelationOperator =
  | 'AND' | 'OR' | 'NOT' | 'IF_THEN' | '>' | '>=' | '<' | '<=' | '=' | '!=' | 'IN' | 'BETWEEN';

export interface FeatureRelation {
  id: string;
  fromFeatureIds: string[];
  toFeatureIds: string[];
  type: RelationType;
  operator?: RelationOperator;
  statement: string;
  certainty: Certainty;
  evidence: EvidenceAnchor[];
}

export interface ContextGroup {
  id: string;
  label: string;
  featureIds: string[];
  evidence: EvidenceAnchor[];
}

export type CompositionNodeType = 'feature' | 'relation' | 'context' | 'operator' | 'conditional';

export interface CompositionNode {
  id: string;
  type: CompositionNodeType;
  label: string;
  featureId?: string;
  relationId?: string;
  operator?: 'AND' | 'OR' | 'NOT' | 'IF' | 'THEN';
  children: CompositionNode[];
}

export type ExternalMatchLevel = '直接对应' | '高度匹配' | '部分匹配' | '仅相关' | '无法确认';

export interface ExternalMapping {
  id: string;
  targetKind: 'feature' | 'relation';
  targetId: string;
  sourceId: string;
  correspondingObject: string;
  correspondingContent: string;
  matchLevel: ExternalMatchLevel;
  basis?: EvidenceAnchor;
  validationNote: string;
}

export interface SupportedStatement {
  text: string;
  supportingFeatureIds: string[];
  supportingRelationIds: string[];
}

export interface SemanticReconstruction {
  version: typeof DEDUCTION_RESULT_VERSION;
  input: string;
  features: AtomicFeature[];
  relations: FeatureRelation[];
  contexts: ContextGroup[];
  structure: CompositionNode;
  coreMeaning: SupportedStatement;
  externalMappings?: ExternalMapping[];
  punchline: SupportedStatement;
  validation: {
    status: 'valid' | 'valid_with_uncertainty';
    issues: string[];
  };
}

export interface DeductionHistoryRecord {
  id: string;
  createdAt: string;
  request: DeductionRequest;
  result: SemanticReconstruction;
}
