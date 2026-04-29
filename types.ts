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

// ============================================
// AI Thinking Display Types
// ============================================

/**
 * AI 思考过程的阶段
 */
export type ThinkingPhase =
  | 'intent'           // 意图识别
  | 'extract'          // 参数提取
  | 'skill_select'     // 技能选择
  | 'sql_generate'     // SQL 生成
  | 'validating'       // 验证 SQL
  | 'executing'       // 执行 SQL
  | 'confirm';        // 等待确认

/**
 * 思考步骤的状态
 */
export type ThinkingStepStatus = 'pending' | 'running' | 'done' | 'error' | 'cancelled';

/**
 * 单个思考步骤
 */
export interface ThinkingStep {
  phase: ThinkingPhase;
  label: string;
  status: ThinkingStepStatus;
  content?: string;    // 阶段产生的分析内容或 SQL
  startTime?: number;
  endTime?: number;
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
  ANALYSIS_HUB = 'analysis_hub',   // Abstraction + SchemaGenerator merged
  METRICS = 'metrics',
  AI_SKILLS = 'ai_skills',
  LIBRARY = 'library',
  ONTOLOGY = 'ontology',
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

// ============================================
// AI Skills Module Types
// ============================================

/**
 * 技能分类
 */
export type SkillCategory = 'modeling' | 'wrangling' | 'insights' | 'optimization' | 'engineering' | 'handbook';

/**
 * 输入字段类型
 */
export type InputFieldType = 'text' | 'textarea' | 'select' | 'table' | 'column' | 'number' | 'boolean';

/**
 * 输出类型
 */
export type OutputType = 'sql' | 'json' | 'markdown' | 'table';

/**
 * 基础输入字段属性（所有类型共享）
 */
interface BaseSkillInputField {
  name: string;
  required: boolean;
  label: string;
  description?: string;
  defaultValue?: unknown;
}

/**
 * 文本输入字段
 */
interface TextSkillInputField extends BaseSkillInputField {
  type: 'text';
  placeholder?: string;
}

/**
 * 多行文本输入字段
 */
interface TextareaSkillInputField extends BaseSkillInputField {
  type: 'textarea';
  placeholder?: string;
  rows?: number;
}

/**
 * 下拉选择字段
 */
interface SelectSkillInputField extends BaseSkillInputField {
  type: 'select';
  options: string[];
  placeholder?: string;
}

/**
 * 数字输入字段
 */
interface NumberSkillInputField extends BaseSkillInputField {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

/**
 * 布尔开关字段
 */
interface BooleanSkillInputField extends BaseSkillInputField {
  type: 'boolean';
}

/**
 * 表名选择字段
 */
interface TableSkillInputField extends BaseSkillInputField {
  type: 'table';
  placeholder?: string;
}

/**
 * 列名选择字段
 */
interface ColumnSkillInputField extends BaseSkillInputField {
  type: 'column';
  allowMultiple?: boolean;
  placeholder?: string;
}

/**
 * 输入字段定义（discriminated union，按 type 区分）
 *
 * 所有字段类型均包含基础属性，通过 type 字段进行类型区分。
 * 渲染组件使用 switch(field.type) 进行分发。
 *
 * @example
 * function renderField(field: SkillInputField) {
 *   switch (field.type) {
 *     case 'select': return <Select options={field.options} />;
 *     case 'number': return <NumberInput min={field.min} max={field.max} />;
 *   }
 * }
 */
export type SkillInputField =
  | TextSkillInputField
  | TextareaSkillInputField
  | SelectSkillInputField
  | NumberSkillInputField
  | BooleanSkillInputField
  | TableSkillInputField
  | ColumnSkillInputField;

/**
 * 输入字段类型守卫
 */
export function isSkillInputField(v: unknown): v is SkillInputField {
  if (!v || typeof v !== 'object') return false;
  const t = (v as Record<string, unknown>).type;
  return (
    t === 'text' ||
    t === 'textarea' ||
    t === 'select' ||
    t === 'number' ||
    t === 'boolean' ||
    t === 'table' ||
    t === 'column'
  );
}

/**
 * 技能执行结果
 */
export interface SkillResult {
  success: boolean;
  sql?: string;
  explanation?: string;
  error?: string;
  metadata?: Record<string, any>;
  warnings?: string[];
  executionTime?: number;
}

/**
 * 技能执行上下文
 *
 * @typeParam T - 样本数据的类型，默认 Record<string, unknown>
 */
export interface SkillExecutionContext<T extends Record<string, unknown> = Record<string, unknown>> {
  tableName?: string;
  columns?: ColumnInfo[];
  schema?: string;
  sampleData?: T[];
  currentSql?: string;
  userIntent?: string;
  matchedOfficialSkills?: string[]; // 已触发的官方手册技能 ID
  // 扩展字段，供插件和 handbook executor 使用
  [key: string]: unknown;
}

/**
 * AI 技能定义
 */
export interface AISkill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  icon?: string;
  inputSchema: SkillInputField[];
  outputType: OutputType;
  requiresTable?: boolean;
  requiresColumns?: boolean;
  examples?: SkillExample[];
  // 意图分析引导，用于自动匹配和推荐
  intentKeywords?: string[];
  intentPatterns?: string[];
  
  // [NEW] 声明式触发规则 (替代 intentKeywords/intentPatterns)
  triggers?: {
    keywords?: string[];
    patterns?: (string | RegExp)[];
    sqlOperations?: SqlOperationType[];
    confidence?: number;
  };

  // [NEW] 声明式参数提取器
  // 如果提供，则由 ParameterExtractor 调用以获取技能输入
  inputParser?: (request: string, context: SkillExecutionContext) => Record<string, any>;

  // 可组合的其他技能 ID（用于多技能编排）
  compatibleWith?: string[];
  // 技能操作的 SQL 类型
  sqlOperationType?: SqlOperationType;
  // [NEW] Generator 注册表 ID — 声明式路由，替代 skillExecutor.ts 硬编码 if-else
  generatorId?: string;
  // 执行函数（动态加载）
  execute?: (input: Record<string, any>, context: SkillExecutionContext) => Promise<SkillResult>;

  // [Handbook] 认知层级 — 仅官方手册技能使用，标注该技能属于哪一认知层
  _layer?: 'perception' | 'strategy' | 'execution' | 'meta';
}

/**
 * SQL 操作类型
 */
export type SqlOperationType = 
  | 'select'           // 查询
  | 'insert'           // 插入
  | 'update'           // 更新
  | 'delete'           // 删除
  | 'aggregation'      // 聚合统计
  | 'join'             // 表关联
  | 'window'           // 窗口函数
  | 'transformation'   // 数据转换
  | 'analysis'         // 分析建模
  | 'optimization'     // 性能优化
  | 'utility';         // 工具类

/**
 * 意图分析结果
 */
export interface IntentAnalysis {
  intent: SqlOperationType;
  confidence: number;  // 0-1 置信度
  requiredSkills: string[];  // 需要的技能 ID 列表
  matchedOfficialSkills?: string[]; // 匹配到的官方手册技能 ID (SKL-xxx)
  skillChain?: SkillChain;  // 技能调用链（复杂需求）
  missingInfo?: string[];  // 需要补充的信息
  userRequest: string;  // 原始用户请求
  reasoning?: string;  // 分析理由
}

/**
 * 技能调用链（用于多技能编排）
 */
export interface SkillChain {
  steps: SkillChainStep[];
  finalSql?: string;
}

/**
 * 技能链步骤（带类型化输入）
 */
export interface SkillChainStep<
  TInputs extends Record<string, unknown> = Record<string, unknown>
> {
  stepId: string;
  skillId: string;
  inputs: TInputs;
  dependsOn: string[];  // 依赖的前置步骤 ID
  expectedOutput?: string;
}

/**
 * 技能路由选项
 */
export interface SkillRoutingOption {
  mode: 'auto' | 'hybrid';
  autoExecute: boolean;  // 是否自动执行
  showConfidence: boolean;  // 是否显示置信度
  maxSuggestions: number;  // 最大建议数量
}

/**
 * 技能使用示例
 */
export interface SkillExample {
  name: string;
  input: Record<string, any>;
  description: string;
}

/**
 * 技能执行历史记录
 */
export interface SkillExecutionHistory {
  id: string;
  skillId: string;
  skillName: string;
  input: Record<string, any>;
  result: SkillResult;
  timestamp: number;
  duration: number;
}

/**
 * 技能调用请求
 */
export interface SkillInvokeRequest {
  skillId: string;
  inputs: Record<string, any>;
  context: SkillExecutionContext;
  simulateOnly?: boolean;
  /** Streaming callback for real-time token output */
  onChunk?: (text: string) => void;
  /** Cancel token for aborting execution */
  cancelToken?: { cancelled: boolean };
}

/**
 * 技能面板状态
 */
export interface SkillPanelState {
  isOpen: boolean;
  selectedSkillId: string | null;
  isExecuting: boolean;
  history: SkillExecutionHistory[];
}

// ============================================
// Library 模块类型定义
// ============================================

/**
 * 速查卡片 - 高频语法速查
 */
export interface ReferenceCard {
  id: string;
  title: string;
  syntax: string;
  example: string;
  scenario: string;
  tags: string[];
  isSystem?: boolean; // 系统预置 vs 用户自定义
  createdAt: number;
  updatedAt: number;
}

/**
 * SQL 模板
 */
export interface SqlTemplate {
  id: string;
  name: string;
  description: string;
  sql: string;
  params: TemplateParam[];
  category: TemplateCategory;
  tags: string[];
  usageCount: number;
  isSystem?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TemplateParam {
  name: string;
  type: 'string' | 'number' | 'column' | 'table';
  required: boolean;
  default?: any;
  description?: string;
}

export type TemplateCategory = 
  | 'user-segmentation'    // 用户分层
  | 'multi-table-join'     // 多表关联
  | 'time-series'          // 时间序列
  | 'aggregation'          // 聚合分析
  | 'data-cleaning'        // 数据清洗
  | 'window-function'     // 窗口函数
  | 'custom';              // 自定义

/**
 * 学习路径节点
 */
export interface LearningNode {
  id: string;
  title: string;
  description: string;
  content: string; // Markdown 内容
  order: number;
  duration: number; // 预计分钟数
  isCompleted: boolean;
  skills: string[]; // 关联的 AI Skills IDs
}

/**
 * 学习路径阶段
 */
export interface LearningStage {
  id: string;
  title: string;
  description: string;
  nodes: LearningNode[];
  order: number;
  isUnlocked: boolean;
}

/**
 * 个人代码片段
 */
export interface CodeSnippet {
  id: string;
  title: string;
  sql: string;
  description: string;
  tags: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Library 面板状态
 */
export interface LibraryPanelState {
  isOpen: boolean;
  activeTab: LibraryTab;
  searchQuery: string;
  selectedCategory: string | 'all';
}

export type LibraryTab = 'meta' | 'ddl' | 'dml' | 'dql' | 'functions' | 'dcl' | 'optimization';

/**
 * AI 生成内容标记
 */
export interface AIGeneratedContent {
  source: 'ai-generated';
  verified: boolean;
  generatedAt: number;
  prompt?: string;
}

// ============================================
// Ontology 本体论数据表 - 核心抽象层
// ============================================

/**
 * 本体论条目 - 知识管理的核心抽象
 * 
 * 设计理念：
 * - concept: 抽象概念（如"用户"、"订单"、"时间"）
 * - property: 概念属性（如"用户.姓名"、"订单.金额"）
 * - relation: 概念间关系（如"用户 HAS_MANY 订单"）
 * - instance: 具体实例（如"用户表"、"订单表"）
 * - abstractionLevel: 抽象层级（concept > property > relation > instance）
 */
export interface OntologyEntry {
  id: string;
  // 核心标识
  name: string;                    // 名称：如 "用户"
  fullName?: string;               // 全限定名：如 "system.user"
  
  // 抽象层级（本体论核心）
  abstractionLevel: AbstractionLevel;
  
  // 语义分类
  semanticType: OntologySemanticType;
  
  // 描述与示例
  description: string;
  example?: string;               // 示例 SQL
  sqlTemplate?: string;            // SQL 模板（可参数化）
  
  // 层级关系（上下位）
  parentId?: string;              // 父概念 ID（上位概念）
  childIds?: string[];            // 子概念 IDs（下位概念）
  
  // 关联关系
  relatedEntries?: OntologyRelation[];
  
  // 元数据
  tags: string[];
  domain: string;                  // 领域：如 "SQL"、"业务"、"分析"
  
  // AI 生成标记
  aiGenerated?: AIGeneratedContent;
  
  // 系统标记
  isSystem?: boolean;
  
  // 时间戳
  createdAt: number;
  updatedAt: number;
}

/**
 * 抽象层级 - 本体论核心维度
 * 
 * 层次结构：
 * - CONCEPT: 最抽象的概念层面（如"实体"、"度量"、"维度"）
 * - PROPERTY: 概念属性层面（如"金额"、"日期"、"名称"）
 * - RELATION: 概念关系层面（如"HAS_MANY"、"BELONGS_TO"）
 * - INSTANCE: 最具体的实例层面（如具体表名、具体字段）
 */
export type AbstractionLevel = 'concept' | 'property' | 'relation' | 'instance';

/**
 * 本体论语义类型
 * 
 * 与数据库语义对应：
 * - DIMENSION: 维度（如时间、地域、渠道）
 * - MEASURE: 度量（如金额、数量、比率）
 * - IDENTIFIER: 标识符（如ID、编号）
 * - ATTRIBUTE: 属性（如名称、描述、状态）
 * - TIME: 时间相关
 * - RELATIONSHIP: 关系标记
 * - COMPUTED: 计算派生
 */
export type OntologySemanticType = 
  | 'DIMENSION'      // 维度
  | 'MEASURE'        // 度量/指标
  | 'IDENTIFIER'     // 标识符
  | 'ATTRIBUTE'      // 属性
  | 'TIME'           // 时间
  | 'RELATIONSHIP'   // 关系
  | 'COMPUTED';      // 计算派生

/**
 * 本体论关系定义
 */
export interface OntologyRelation {
  targetId: string;               // 目标条目 ID
  relationType: RelationType;      // 关系类型
  description?: string;           // 关系描述
}

export type RelationType = 
  | 'is_a'            // 继承关系（instance is_a concept）
  | 'has_a'           // 包含关系（concept has_a property）
  | 'has_many'        // 一对多关系
  | 'belongs_to'      // 从属关系
  | 'related_to'      // 关联关系
  | 'depends_on';     // 依赖关系

/**
 * 本体论视图 - 用户自定义的本体论视角
 */
export interface OntologyView {
  id: string;
  name: string;
  description?: string;
  rootEntryIds: string[];         // 根节点 IDs
  expandedIds?: string[];         // 展开的节点
  
  // 筛选条件
  filters?: {
    domains?: string[];
    abstractionLevels?: AbstractionLevel[];
    semanticTypes?: OntologySemanticType[];
  };
  
  // 布局配置
  layout?: {
    type: 'tree' | 'graph' | 'list';
    sortBy?: 'name' | 'abstraction' | 'domain';
  };
  
  createdAt: number;
  updatedAt: number;
}

/**
 * 本体论导入/导出具
 */
export interface OntologyExport {
  version: string;
  exportedAt: number;
  entries: OntologyEntry[];
  views?: OntologyView[];
}

/**
 * 数据抽象表 (AbstractionTable)
 * 
 * 基于 MECE 原则设计的数据抽象层核心表
 * 用于快速调用指定能力并生成 SQL 模拟方案
 * 
 * 设计原则：
 * - 层层展开：从概念到实例，路径清晰
 * - 快速调用：选中条目即可生成对应 SQL
 * - 灵活扩展：支持用户自定义和 AI 增强
 */
export interface AbstractionTable {
  id: string;
  name: string;                      // 表名：如 "用户行为分析"
  description?: string;              // 描述
  
  // 抽象层级路径（MECE 原则：相互独立，完全穷尽）
  abstractionPath: {
    concept: string;                 // 概念层：如 "用户"、"订单"、"商品"
    property?: string;               // 属性层：如 "金额"、"日期"、"状态"
    relation?: string;               // 关系层：如 "HAS_MANY"、"BELONGS_TO"
    instance?: string;               // 实例层：如 "orders"、"users"
  };
  
  // SQL 生成参数
  sqlConfig: {
    operation: AbstractionSqlOperation;         // 操作类型：SELECT/INSERT/UPDATE/DELETE/AGGREGATE
    template: string;                // SQL 模板（可参数化）
    parameters?: SqlParameter[];      // 参数定义
    sampleOutput?: string;           // 示例输出
  };
  
  // 关联的本体论条目
  linkedOntologyIds?: string[];      // 关联的 OntologyEntry IDs
  
  // 元数据
  tags: string[];
  domain: string;                    // 领域：如 "电商"、"金融"、"分析"
  isFavorite?: boolean;
  isSystem?: boolean;
  
  createdAt: number;
  updatedAt: number;
}

/**
 * SQL 操作类型
 */
export type AbstractionSqlOperation = 
  | 'SELECT'        // 查询
  | 'INSERT'        // 插入
  | 'UPDATE'        // 更新
  | 'DELETE'        // 删除
  | 'AGGREGATE'     // 聚合分析
  | 'JOIN'          // 关联查询
  | 'WINDOW'        // 窗口函数
  | 'CTE';          // 公共表表达式

/**
 * SQL 参数定义
 */
export interface SqlParameter {
  name: string;                      // 参数名：如 "${table_name}"
  type: 'string' | 'number' | 'date' | 'column' | 'table';
  description?: string;              // 参数描述
  defaultValue?: string;              // 默认值
  required?: boolean;                 // 是否必填
}

/**
 * SQL 生成请求
 */
export interface SqlGenerationRequest {
  abstractionPath: AbstractionTable['abstractionPath'];
  operation: AbstractionSqlOperation;
  customParameters?: Record<string, string>;
  context?: string;                   // 额外上下文
}

/**
 * SQL 生成结果
 */
export interface SqlGenerationResult {
  sql: string;
  explanation: string;                // SQL 解释
  parameterValues?: Record<string, string>;  // 参数值建议
}