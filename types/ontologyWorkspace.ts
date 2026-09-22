/**
 * types/ontologyWorkspace.ts
 *
 * Types for the DuckDB Studio Ontology Spatial Analysis Workspace
 * Aligned with BRD V1.0 and target UI design specifications.
 */

export type AbstractionLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'GROUNDING';

export type BusinessDomain = 'Commerce' | 'Customer' | 'Fulfillment' | 'Risk' | 'Finance' | string;

export type NodeType = 'class' | 'data_source' | 'individual_agg';

export type EdgeType = 'subClassOf' | 'object_property' | 'data_property' | 'mappedTo' | 'inferred';

export interface DataProperty {
  name: string;
  type: string; // e.g. xsd:string, xsd:decimal
  required?: boolean;
}

export interface ObjectPropertyRef {
  name: string;
  targetClassId: string;
  targetClassName: string;
  cardinality?: string; // e.g. '1..*', '0..1', '1..1'
  asserted: boolean;
}

export interface OntologyNode {
  id: string; // e.g. 'C-0003' or 'Product'
  name: string; // e.g. 'Product'
  label: string; // e.g. 'Product'
  iri: string; // e.g. 'ex:Product'
  description: string;
  abstractionLevel: AbstractionLevel;
  domain: BusinessDomain;
  type: NodeType;
  status: 'normal' | 'modified' | 'stale' | 'draft';
  instanceCount?: number; // e.g. 2350000
  instanceCountLabel?: string; // e.g. '2.35M'
  mappingState?: 'mapped' | 'partial' | 'stale' | 'broken' | 'unmapped';
  validationState?: 'valid' | 'warning' | 'error' | 'stale' | 'not_run';
  parentClassId?: string; // e.g. 'BusinessEntity'
  parentClassName?: string;
  subClassIds?: string[]; // e.g. ['Electronics', 'Clothing']
  objectProperties?: ObjectPropertyRef[];
  dataProperties?: DataProperty[];
  // Physical table mapping reference if mapped
  mappedTable?: string; // e.g. 'main.products'
  // Layout coordinates (grid / relative)
  gridColumn?: number; // 0: Commerce, 1: Customer, 2: Fulfillment, 3: Risk, 4: Finance
  gridRow?: number; // 0: L0, 1: L1, 2: L2, 3: L3, 4: Grounding
}

export interface OntologyEdge {
  id: string;
  source: string; // source node id / name
  target: string; // target node id / name
  relationName: string; // e.g. 'suppliedBy', 'subClassOf', 'mappedTo'
  type: EdgeType;
  asserted: boolean;
  inferred: boolean;
  mapping: boolean;
  cardinality?: string;
  confidence?: 'High' | 'Medium' | 'Low' | number;
  stale?: boolean;
  sourceRevision?: string;
  inverseOf?: string;
  characteristics?: {
    functional?: boolean;
    transitive?: boolean;
    symmetric?: boolean;
    asymmetric?: boolean;
  };
  rangeExpression?: string; // e.g. 'Supplier' or 'Supplier OR Store'
}

export type WorkspaceViewMode = 'map' | 'local' | 'matrix' | 'path' | 'compare' | 'diff';

export interface AnalysisContext {
  activeMode: WorkspaceViewMode;
  focusEntityId: string | null;
  selectedEntityIds: string[];
  selectedRelationId: string | null;
  // Path mode endpoints
  sourceEntityId: string | null;
  targetEntityId: string | null;
  // Filters
  domainFilter: string; // 'All' or specific domain
  relationTypeFilter: string; // 'All' or specific type
  assertedInferredFilter: 'all' | 'asserted' | 'inferred';
  dataSourceFilter: string;
  showInstancesMode: 'aggregated' | 'sample' | 'hidden';
  // Local mode depth
  depth: number; // 1, 2, 3 (default 2)
  // Matrix layer
  matrixLayer: 'L0' | 'L1' | 'L2';
  // History stack for back / forward navigation
  history: Array<{
    mode: WorkspaceViewMode;
    focusEntityId: string | null;
    selectedEntityIds: string[];
    selectedRelationId: string | null;
    sourceEntityId?: string | null;
    targetEntityId?: string | null;
    domainFilter?: string;
    relationTypeFilter?: string;
    assertedInferredFilter?: 'all' | 'asserted' | 'inferred';
    dataSourceFilter?: string;
    showInstancesMode?: 'aggregated' | 'sample' | 'hidden';
    depth?: number;
    matrixLayer?: 'L0' | 'L1' | 'L2';
  }>;
  historyIndex: number;
}

export interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  focusNode: string;
  focusNodeName: string;
  resultPath: string; // e.g. 'Product.price'
  expectedValue: string; // e.g. 'DECIMAL'
  actualValue: string; // e.g. 'VARCHAR'
  sourceTable: string; // e.g. 'main.products'
  sourceColumn: string; // e.g. 'price'
  constraint: string; // e.g. 'sh:datatype'
  message: string;
}

export interface ReasoningReport {
  status: 'current' | 'stale' | 'running' | 'not_run';
  duration: string; // e.g. '00:04.12'
  newInferredCount: number; // e.g. +17
  removedInferredCount: number; // e.g. -3
  totalInferredAxioms: number; // e.g. 214
  lastRunTime?: string;
  inferredAxioms: Array<{
    id: string;
    subject: string;
    predicate: string;
    object: string;
    ruleName: string;
    premises: string[];
    confidence: number;
  }>;
}

export interface FieldMapping {
  sourceColumn: string;
  targetProperty: string;
  sourceType: string;
  targetType: string;
  status: 'mapped' | 'stale' | 'invalid';
}

export interface MappingItem {
  id: string;
  sourceTable: string;
  targetClass: string;
  fields: FieldMapping[];
  status: 'mapped' | 'partial' | 'stale' | 'broken' | 'unmapped';
  sampleRowsCount: number;
  validRate: number; // 0.0 - 1.0
  schemaDrift: boolean;
  driftMessage?: string;
}

export interface DraftChange {
  id: string;
  type: 'added' | 'modified' | 'removed';
  entityType: 'class' | 'object_property' | 'data_property' | 'mapping' | 'axiom';
  entityName: string;
  level: AbstractionLevel;
  domain?: BusinessDomain;
  description: string;
  beforeValue?: any;
  afterValue?: any;
  impact: {
    classesCount: number;
    objectPropertiesCount: number;
    dataPropertiesCount: number;
    axiomsCount: number;
    mappingsCount: number;
    validationCount: number;
    inferredAxiomsCount: number;
    examples?: string[];
  };
  author: string;
  time: string;
}

export interface StatePipeline {
  modelStatus: 'clean' | 'modified';
  mappingStatus: 'up_to_date' | 'needs_check' | 'checking' | 'stale' | 'broken';
  validationStatus: 'valid' | 'warnings' | 'errors' | 'running' | 'failed' | 'stale' | 'not_run';
  validationWarningCount: number;
  validationErrorCount: number;
  reasoningStatus: 'completed' | 'outdated' | 'running' | 'not_run';
  draftCount: number;
}

export interface VersionDiff {
  baseVersion: string; // e.g. 'v0.8'
  compareVersion: string; // e.g. 'v0.9'
  changes: DraftChange[];
}

export interface PathStep {
  from: string;
  relation: string;
  to: string;
  type: EdgeType;
  source: string;
  confidence: 'High' | 'Medium' | 'Low';
  asserted: boolean;
  inferred: boolean;
  mapping: boolean;
  explain?: {
    rule: string;
    premises: string[];
    conclusion: string;
  };
}

export interface FoundPath {
  id: string;
  title: string;
  length: number;
  isShortest: boolean;
  confidence: 'High' | 'Medium' | 'Low';
  hasInferred: boolean;
  steps: PathStep[];
}
