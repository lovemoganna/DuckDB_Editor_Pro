// ============================================
// Analysis Pipeline Types
// ============================================

// ============================================================
// Semantic Types
// ============================================================

export type SemanticType = 'DIM' | 'MEA' | 'ID' | 'TIME' | 'ATTR' | 'RATIO' | 'CURR';

export interface ColumnSemanticInfo {
  name: string;
  physicalType: string;
  semanticType: SemanticType;
  confidence: number;
  confidenceScore?: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
  reasoning?: string;
  alternatives?: { type: SemanticType; confidence: number }[];
  needsReview?: boolean;
  description?: string;
  isPrimaryKey?: boolean;
  nullable?: boolean;
  cardinality?: number;
  topValues?: string[];
  aggregatable?: boolean;
  suggestedAggregations?: string[];
}

export interface CalibratedSemanticInfo extends ColumnSemanticInfo {
  confidenceScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  reasoning: string;
  needsReview: boolean;
}

// ============================================================
// Analysis Summary & Result
// ============================================================

export interface AnalysisSummary {
  rowCount: number;
  columnCount: number;
  tableName: string;
  sampleData: string;
  stats?: any;
  fileName?: string;
}

export interface DataIssue {
  column: string;
  type: 'missing_values' | 'outliers' | 'duplicates' | 'skew' | 'format';
  severity: 'info' | 'warning' | 'error';
  detail: any;
  suggestion: string;
}

export interface QualityReport {
  overallScore: number;
  overallScoreGrade?: 'A' | 'B' | 'C' | 'D';
  dimensionScores?: {
    completeness: number;
    consistency: number;
    accuracy: number;
    timeliness: number;
    uniqueness: number;
  };
  issues: DataIssue[];
  recommendations: string[];
  reasoning?: string;
}

export interface HierarchyResult {
  child: string;
  parent: string;
  type: 'hierarchy';
  confidence: number;
}

// ============================================================
// Insights & Metrics
// ============================================================

export interface HypothesisInsight {
  title: string;
  observation: string;
  impact: 'positive' | 'negative' | 'neutral';
  assumption: string;
  limitation: string;
  confidenceScore: number;
  category: 'driver' | 'correlation' | 'forecast' | 'anomaly' | 'pattern';
}

export interface KeyMetric {
  name: string;
  formula: string;
  visual: 'bar' | 'line' | 'number';
  impact: string;
  explanation: string;
  unit?: string;
  confidenceScore?: number;
  assumption?: string;
  limitation?: string;
}

export interface MetricScorecard {
  name: string;
  displayName: string;
  total: number | string;
  mean: number | string;
  median: number | string;
  stddev: number | string;
  min: number | string;
  max: number | string;
  trend?: { month: string, total: number }[];
  distribution?: { label: string, value: number }[];
}

export interface CustomAssertion {
  id: string;
  name: string;
  description: string;
  sql: string;
  expectedValue?: any;
  severity: 'error' | 'warning' | 'info';
  category: 'null_check' | 'uniqueness' | 'range' | 'relationship' | 'custom';
  column?: string;
  status?: 'pending' | 'running' | 'pass' | 'fail';
  fixSql?: string;
}

export interface AssertionTemplate {
  id: string;
  name: string;
  category: 'null_check' | 'uniqueness' | 'range' | 'relationship' | 'custom';
  description: string;
  templateSql: string;
  params: { name: string; type: 'string' | 'number' | 'column'; required: boolean; default?: any }[];
}

export interface AnalysisTemplate {
  id: string;
  name: string;
  description: string;
  applicableSchema: {
    minColumns?: number;
    maxColumns?: number;
    requiredSemanticTypes?: SemanticType[];
    dataPatterns?: string[];
  };
  pipelineConfig: {
    enableDeepInsights: boolean;
    enableCausalAnalysis: boolean;
    enableAnomalyDetection: boolean;
    qualityThreshold: number;
  };
  customMetrics?: string[];
  author: string;
  isSystem: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AnalysisAnnotation {
  id: string;
  targetType: 'column' | 'metric' | 'insight' | 'script' | 'general';
  targetId?: string;
  content: string;
  author: string;
  createdAt: number;
}

export interface PerformanceMetrics {
  stage: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tokenCount?: number;
  model?: string;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
}

export interface SessionPerformance {
  totalCalls: number;
  totalTokens: number;
  totalDuration: number;
  stageBreakdown: PerformanceMetrics[];
  estimatedCost?: number;
}

// ============================================================
// Causal & Anomaly
// ============================================================

export interface AnomalyResult {
  column: string;
  strategy: 'IQR' | 'Z-Score';
  anomalies_count: number;
  total_count: number;
  ratio: number;
  bounds: { lower: number, upper: number };
  sample_values: any[];
  sql: string;
}

export interface FeatureProposal {
  name: string;
  sql: string;
  reason: string;
}

export interface CausalNode {
  id: string;
  label: string;
}

export interface CausalEdge {
  from: string;
  to: string;
  label: string;
  confidence: number;
}

export interface CausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
  narrative: string;
}

export interface RecommendedAction {
  type: 'DRILL_DOWN' | 'EXPLAIN' | 'MONITOR' | 'QUALITY_FIX';
  title: string;
  description: string;
  sql?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ============================================================
// Driver & Deep Insights
// ============================================================

export interface DriverAnalysis {
  metric: string;
  dimension: string;
  drivers: { value: string; contribution: number; impact: 'positive' | 'negative' | 'neutral' }[];
}

export interface CorrelationMatrix {
  columns: string[];
  matrix: number[][];
}

export interface DeepInsight {
  title: string;
  category: 'driver' | 'correlation' | 'forecast' | 'anomaly';
  observation: string;
  evidence: string;
  sql: string;
}

export interface MetricDefinition {
  id: string;
  name: string;
  scenario: string;
  characteristics: string;
  value: string;
  definition: string;
  formula: string;
  example: string;
  dependencies: string[];
  unit?: string;
  category?: string;
  createdAt: number;
  updatedAt?: number;
  sqlValidation?: string;
  isValid?: boolean;
  lastValidated?: number;
  validationError?: string;
  version?: number;
  history?: { version: number; changedAt: number; changedFields: string[]; previousValues: Record<string, any> }[];
  lineage?: { upstream: string[]; downstream: string[]; transformSteps?: string[] };
}

export interface MetricPackage {
  id: string;
  name: string;
  description: string;
  sourceTables: string[];
  metrics: MetricDefinition[];
  createdAt: number;
  updatedAt: number;
}

export interface MetricChart {
  id: string;
  metricId: string;
  metricPackageId: string;
  metricName: string;
  sourceTable: string;
  chartConfig: any;
  sql: string;
  createdAt: number;
  updatedAt: number;
}

// ============================================================
// Analysis Result Containers
// ============================================================

export interface GenerationResult {
  overview?: string;
  narrativeReport?: string;
  semanticColumns?: ColumnSemanticInfo[];
  operations?: any;
  metricScorecards?: MetricScorecard[];
  keyMetrics?: KeyMetric[];
  snapshotInsights?: any[];
  hypothesisInsights?: HypothesisInsight[];
  qualityReport?: QualityReport | null;
  deepInsights?: any[];
  featureProposals?: FeatureProposal[];
  causalGraph?: CausalGraph;
  reasoningChains?: any[];
  customAssertions?: CustomAssertion[];
  performanceMetrics?: PerformanceMetrics[];
  annotations?: AnalysisAnnotation[];
  userIntent?: string;
}

export interface SavedAnalysis {
  id: string;
  fileName: string;
  timestamp: number;
  summary: AnalysisSummary;
  result: GenerationResult;
}

export interface EnrichedAnalysisResult extends GenerationResult {
  semanticColumns: ColumnSemanticInfo[];
  hierarchies?: HierarchyResult[];
  qualityReport: QualityReport;
  metricScorecards: MetricScorecard[];
}

export interface AnalysisLayerResult extends EnrichedAnalysisResult {
  drivers: DriverAnalysis[];
  correlations: CorrelationMatrix;
  deepInsights: DeepInsight[];
  anomalies?: AnomalyResult[];
  causalGraph?: CausalGraph;
  featureProposals?: FeatureProposal[];
  recommendedActions?: RecommendedAction[];
}

// ============================================================
// SqlOperation (Schema Generator)
// ============================================================

export interface SqlOperation {
  id: number;
  title: string;
  category: 'schema' | 'view' | 'crud' | 'analysis';
  interpretation: string;
  description: string;
  sql: string;
}

// ============================================================
// Dashboard
// ============================================================

export interface DashboardItem {
  i: string;
  savedQueryId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  items: DashboardItem[];
  createdAt: number;
  updatedAt: number;
}
