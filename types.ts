// ============================================
// NEW: AI Schema Analysis V6.0 Enhanced Types
// ============================================

/**
 * 推理链 - 用于追溯 AI 决策过程
 */
export interface ReasoningChain {
  stage: 'probe' | 'semantic' | 'quality' | 'ops' | 'insights' | 'narrative';
  input: string;      // 输入摘要
  reasoning: string; // 推理过程
  output: any;       // 输出摘要
  confidence: number; // 0-100 置信度
  timestamp: number;
}

/**
 * 带置信度校准的语义标注
 */
export interface CalibratedSemanticInfo extends ColumnSemanticInfo {
  confidenceScore: number;    // 0-100 精确置信度分数
  confidenceLevel: 'high' | 'medium' | 'low'; // 置信度等级
  reasoning: string;         // 推理依据
  alternatives?: {            // 备选语义类型
    type: SemanticType;
    confidence: number;
  }[];
  needsReview: boolean;      // 是否需要人工确认
}

/**
 * 带前提假设的洞察
 */
export interface HypothesisInsight {
  title: string;
  observation: string;
  impact: 'positive' | 'negative' | 'neutral';
  assumption: string;        // 成立前提
  limitation: string;       // 数据限制
  confidenceScore: number;   // 1-100 置信度
  category: 'driver' | 'correlation' | 'forecast' | 'anomaly' | 'pattern';
}

/**
 * 自定义断言
 */
export interface CustomAssertion {
  id: string;
  name: string;
  description: string;
  sql: string;
  expectedValue?: any;
  severity: 'error' | 'warning' | 'info';
  category: 'null_check' | 'uniqueness' | 'range' | 'relationship' | 'custom';
  column?: string;          // 关联列
  status?: 'pending' | 'running' | 'pass' | 'fail';
  fixSql?: string;          // 修复建议 SQL
}

/**
 * 断言模板库
 */
export interface AssertionTemplate {
  id: string;
  name: string;
  category: 'null_check' | 'uniqueness' | 'range' | 'relationship' | 'custom';
  description: string;
  templateSql: string;
  params: {
    name: string;
    type: 'string' | 'number' | 'column';
    required: boolean;
    default?: any;
  }[];
}

/**
 * 分析模板 - 用于模板市场
 */
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

/**
 * 用户注解
 */
export interface AnalysisAnnotation {
  id: string;
  targetType: 'column' | 'metric' | 'insight' | 'script' | 'general';
  targetId?: string;
  content: string;
  author: string;
  createdAt: number;
}

/**
 * 性能监控
 */
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

/**
 * 会话性能汇总
 */
export interface SessionPerformance {
  totalCalls: number;
  totalTokens: number;
  totalDuration: number;
  stageBreakdown: PerformanceMetrics[];
  estimatedCost?: number;
}

// ============================================
// Original Types Continue...
// ============================================

export interface TableInfo {
  name: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  notnull: boolean;
  dflt_value: any;
  pk: boolean;
  cid?: number; // From schema generator
}

export interface QueryResult {
  columns: string[];
  rows: any[];
  executionTime: number;
  error?: string;
  isExplain?: boolean;
}

export interface AuditLogEntry {
  id: number;
  log_time: string;
  operation_type: string;
  target_table: string;
  details: string;
  affected_rows: number;
  sql_statement: string;
}

export interface ExtensionStatus {
  name: string;
  description: string;
  loaded: boolean;
  installable: boolean; // In WASM, usually means 'try LOAD'
}

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface QueryHistoryItem {
  id: string;
  sql: string;
  timestamp: number;
  status: 'success' | 'error';
  executionTime?: number;
}

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter' | 'counter';

export interface ChartConfig {
  id: string;
  title: string;
  type: ChartType;
  xKey: string;
  yKeys: string[];
  yRightKeys?: string[];
  groupBy?: string;
  aggregation?: 'none' | 'count' | 'sum' | 'avg' | 'min' | 'max';
  stacked?: boolean;
  horizontal?: boolean;
  showLegend?: boolean;
  showValues?: boolean;
  yAxisLabel?: string;
  colors?: string[];
  // 指标关联字段
  metricId?: string;           // 关联的指标ID
  metricPackageId?: string;    // 关联的指标包ID
  metricName?: string;         // 指标名称（用于显示）
  // 图表来源
  source?: 'metric' | 'manual';
  // 交互下钻配置
  drillDownConfig?: {
    enabled: boolean;
    drillDownSql?: string;    // 下钻SQL模板
    drillDownColumn?: string; // 下钻依据的列
  };
}

export interface SqlTab {
  id: string;
  title: string;
  code: string;
  result?: QueryResult;
  history: string[];
  historyIndex: number;
  loading: boolean;
  viewMode: 'table' | 'chart' | 'explain';
  chartConfig: ChartConfig; // Keep for backward compatibility
  charts?: ChartConfig[]; // New multi-chart support
  page: number;
  filterTerm: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  desc?: string;
  pinned?: boolean;
  folder?: string;
  createdAt: number;
  charts?: ChartConfig[];
  widgetType?: 'value' | 'table' | 'chart';
  // 标记是否来自指标图表
  metricChartId?: string;
}

export interface TopKEntry {
  value: any;
  count: number;
}

export interface ColumnStats {
  min: any;
  max: any;
  null_count: number;
  distinct_count: number;
  total_count: number;
  top_k?: TopKEntry[]; // New field for categorical analysis
  // Advanced M1 Stats
  avg?: number;
  std?: number;
  skew?: number;
  kurt?: number;
  entropy?: number;
  q25?: number;
  q50?: number;
  q75?: number;
  p01?: number; // 1st percentile (outlier lower bound)
  p99?: number; // 99th percentile (outlier upper bound)
  histogram?: { bin: number, count: number }[]; // For bimodality detection
}

export interface EnrichedColumnStats extends ColumnStats {
  name: string;
  type: string;
  // Previously these were optional in ColumnStats, but in Enriched they are populated
  avg: number;
  std: number;
  skew: number;
  kurt: number;
  entropy: number;
  p01: number;
  p99: number;
}

export interface ImportOptions {
  header: boolean;
  delimiter: string;
  quote: string;
  dateFormat: string;
}

// Schema Generator Types
export interface SqlOperation {
  id: number;
  title: string;
  category: 'schema' | 'view' | 'crud' | 'analysis';
  interpretation: string;
  description: string;
  sql: string;
}

export interface AnalysisSummary {
  rowCount: number;
  columnCount: number;
  tableName: string;
  sampleData: string;
  stats?: ColumnStats[];
  fileName?: string;
}

export interface GenerationResult {
  overview?: string;
  narrativeReport?: string;        // NEW: 叙述性报告
  semanticColumns?: ColumnSemanticInfo[];
  operations?: any;
  metricScorecards?: MetricScorecard[];
  keyMetrics?: KeyMetric[]; // New field for AI definitions
  snapshotInsights?: any[];
  // NEW: 带假设的洞察
  hypothesisInsights?: HypothesisInsight[];
  qualityReport?: QualityReport | null; // M3: Epic-005
  deepInsights?: any[]; // M2: Epic-003
  featureProposals?: FeatureProposal[];
  causalGraph?: CausalGraph; // M2: Epic-004
  // NEW: 推理链
  reasoningChains?: ReasoningChain[];
  // NEW: 自定义断言
  customAssertions?: CustomAssertion[];
  // NEW: 性能监控
  performanceMetrics?: PerformanceMetrics[];
  // NEW: 用户注解
  annotations?: AnalysisAnnotation[];
  // NEW: 意图
  userIntent?: string;
}

export interface SavedAnalysis {
  id: string;
  fileName: string;
  timestamp: number;
  summary: AnalysisSummary;
  result: GenerationResult;
}

export interface QueryHistoryEntry {
  sql: string;
  time: string;
  duration: string;
}

export enum Tab {
  DASHBOARD = 'dashboard',
  DATA = 'data',
  STRUCTURE = 'structure',
  SQL = 'sql',
  HISTORY = 'history',
  AUDIT = 'audit',
  EXTENSIONS = 'extensions',
  TUTORIALS = 'tutorials',
  SCHEMA_GENERATOR = 'schema_generator',
  METRICS = 'metrics'
}

export type SemanticType = 'DIM' | 'MEA' | 'ID' | 'TIME' | 'ATTR' | 'RATIO' | 'CURR';

export interface ColumnSemanticInfo {
  name: string;
  physicalType: string;
  semanticType: SemanticType;
  confidence: number;
  confidenceScore?: number;        // NEW: 0-100 精确置信度
  confidenceLevel?: 'high' | 'medium' | 'low'; // NEW: 置信度等级
  reasoning?: string;              // NEW: 推理依据
  alternatives?: {                 // NEW: 备选语义类型
    type: SemanticType;
    confidence: number;
  }[];
  needsReview?: boolean;          // NEW: 是否需要人工确认
  description?: string;
  isPrimaryKey?: boolean;
  nullable?: boolean;
  cardinality?: number;
  topValues?: string[];
  aggregatable?: boolean;
  suggestedAggregations?: string[];
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
  overallScoreGrade?: 'A' | 'B' | 'C' | 'D'; // NEW: 字母等级
  dimensionScores?: {              // NEW: 多维度评分
    completeness: number;         // 完整性
    consistency: number;          // 一致性
    accuracy: number;             // 准确性
    timeliness: number;           // 时效性
    uniqueness: number;           // 唯一性
  };
  issues: DataIssue[];
  recommendations: string[];
  reasoning?: string;             // NEW: 评分推理过程
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

// 新增：指标定义（AI分析生成）
export interface MetricDefinition {
  id: string;
  name: string;           // 指标名称
  scenario: string;       // 指标场景（用于什么业务分析）
  characteristics: string; // 指标特点（如：可累加、比率型、趋势型）
  value: string;          // 价值说明（为什么这个指标重要）
  definition: string;     // 指标定义（精确的业务含义）
  formula: string;        // 计算公式
  example: string;        // 典型案例
  dependencies: string[]; // 数据表依赖（列名）
  unit?: string;          // 单位
  category?: string;       // 分类
  createdAt: number;
  updatedAt?: number;
  // SQL 验证相关字段
  sqlValidation?: string;   // 自动生成的 SQL 验证语句
  isValid?: boolean;       // 验证状态
  lastValidated?: number;  // 最后验证时间戳
  validationError?: string; // 验证错误信息
  // 版本控制
  version?: number;       // 当前版本号
  history?: {              // 版本历史
    version: number;
    changedAt: number;
    changedFields: string[];
    previousValues: Record<string, any>;
  }[];
  // 血缘追踪
  lineage?: {
    upstream: string[];   // 上游依赖指标/表
    downstream: string[]; // 下游依赖此指标的指标
    transformSteps?: string[]; // 数据转换步骤
  };
}

// 新增：指标包（包含多个指标定义）
export interface MetricPackage {
  id: string;
  name: string;           // 指标包名称
  description: string;    // 描述
  sourceTables: string[]; // 依赖的数据表
  metrics: MetricDefinition[];
  createdAt: number;
  updatedAt: number;
}

// 新增：指标图表（自动从指标生成）
export interface MetricChart {
  id: string;
  metricId: string;           // 关联的指标ID
  metricPackageId: string;    // 关联的指标包ID
  metricName: string;         // 指标名称
  sourceTable: string;        // 数据源表
  chartConfig: ChartConfig;   // 图表配置
  sql: string;               // 执行的SQL语句
  createdAt: number;
  updatedAt: number;
}

// M1: Issue-007 Anomaly Result
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

// M2: Epic-003 & 004 types
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
  label: string; // e.g. "Direct Cause", "Correlation"
  confidence: number;
}

export interface CausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
  narrative: string;
}

// M3: Guidance
export interface RecommendedAction {
  type: 'DRILL_DOWN' | 'EXPLAIN' | 'MONITOR' | 'QUALITY_FIX';
  title: string;
  description: string;
  sql?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AnalysisLayerResult extends EnrichedAnalysisResult {
  drivers: DriverAnalysis[];
  correlations: CorrelationMatrix;
  deepInsights: DeepInsight[];
  anomalies?: AnomalyResult[];
  // M2 & M3 New Fields
  causalGraph?: CausalGraph;
  featureProposals?: FeatureProposal[];
  recommendedActions?: RecommendedAction[]; // M3
}

export interface HierarchyResult {
  child: string;
  parent: string;
  type: 'hierarchy';
  confidence: number;
}

export interface KeyMetric {
  name: string;
  formula: string;
  visual: 'bar' | 'line' | 'number';
  impact: string;     // Chinese Business Value
  explanation: string; // Chinese Description
  unit?: string;
  confidenceScore?: number;      // NEW: 1-100 置信度
  assumption?: string;           // NEW: 成立前提
  limitation?: string;           // NEW: 数据限制
}

export interface EnrichedAnalysisResult extends GenerationResult {
  semanticColumns: ColumnSemanticInfo[];
  hierarchies?: HierarchyResult[]; // New M1 field
  qualityReport: QualityReport;
  metricScorecards: MetricScorecard[];
}

export interface DriverAnalysis {
  metric: string;
  dimension: string;
  drivers: {
    value: string;
    contribution: number;
    impact: 'positive' | 'negative' | 'neutral';
  }[];
}

export interface CorrelationMatrix {
  columns: string[];
  matrix: number[][]; // Grid of correlation scores (-1 to 1)
}

export interface DeepInsight {
  title: string;
  category: 'driver' | 'correlation' | 'forecast' | 'anomaly';
  observation: string;
  evidence: string;
  sql: string;
}

export interface DashboardItem {
  i: string; // Layout ID for react-grid-layout
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