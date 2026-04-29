/**
 * analysisHub.ts — Shared types for the Analysis Hub module
 * 
 * Consolidated types from:
 * - SchemaGenerator (GenerationResult, AnalysisSummary, SavedAnalysis, PipelineStage)
 * - Abstraction (re-exported from abstraction.ts)
 */

import type {
  GenerationResult,
  AnalysisSummary,
  SavedAnalysis,
  SemanticType,
  ColumnSemanticInfo,
  QualityReport,
  MetricScorecard,
  KeyMetric,
  CausalGraph,
  FeatureProposal,
  AnomalyResult,
  CustomAssertion,
} from '../types';

// ============================================================
// Pipeline Types (from SchemaGenerator)
// ============================================================

export type PipelineStage =
  | 'idle'
  | 's0_probe'       // Stage 0: Scene Probe
  | 's1_semantic'     // Stage 1: Semantic Analysis
  | 's2_quality'      // Stage 2: Quality Audit
  | 's3_sql'          // Stage 3: Operations (SQL)
  | 's4_insights'     // Stage 4: Insights (KPI, Anomaly, Causal)
  | 's5_report'       // Stage 5: Narrative Report
  | 'complete'
  | 'error';

export interface PipelineError {
  stage: PipelineStage;
  message: string;
}

export interface PipelineContext {
  // S0: Probe
  probeResult?: {
    recommendedIntent: string;
    analysisDepth: string;
    suggestedCategories: string[];
  };
  // S1: Semantic
  semanticResult?: {
    semanticColumns: ColumnSemanticInfo[];
    qualityReport?: QualityReport;
    hierarchies?: any[];
    correlations?: any[];
  };
  // S2: Quality (enriched from S1)
  qualityReport?: QualityReport;
  // S3: SQL Operations
  operations?: any;
  // S4: Insights
  scorecards?: MetricScorecard[];
  anomalies?: AnomalyResult[];
  drivers?: any[];
  causalAnalysis?: {
    graph: CausalGraph;
    engineeredFeatures: FeatureProposal[];
  };
  featureProposalsHeuristic?: FeatureProposal[];
  // S5: Report
  narrativeReport?: string;
  snapshotInsights?: any[];
  // Shared
  activeSummary?: AnalysisSummary;
  genResult?: Partial<GenerationResult>;
  metrics?: any[];
  dimensions?: any[];
}

// ============================================================
// Analysis Hub View Modes
// ============================================================

export type AnalysisHubMainTab = 'library' | 'analysis' | 'lab';
export type AnalysisViewMode = 'result' | 'model' | 'handbook';
export type SandboxTab = 'editor' | 'results' | 'ai';

// ============================================================
// Analysis Slice State
// ============================================================

export interface AnalysisSlice {
  // Processing state
  isProcessing: boolean;
  pipelineStage: PipelineStage;
  pipelineContext: PipelineContext;
  pipelineError: PipelineError | null;

  // Results
  result: GenerationResult | null;
  activeSummary: AnalysisSummary | null;
  activeFileName: string | null;

  // History
  history: SavedAnalysis[];

  // View mode (for handbook integration)
  viewMode: AnalysisViewMode;

  // Handbook
  handbookResult: any | null;
  handbookProgress: number;
  isGeneratingHandbook: boolean;
}

// ============================================================
// Re-export Abstraction types (from abstraction.ts)
// ============================================================

export {
  AbstractionFilters,
  DEFAULT_FILTERS,
  AbstractionGenerationRequest,
  AbstractionGenerationResult,
  AISession,
  AISessionMessage,
} from '../types/abstraction';
export type { AnalysisHubMainTab } from '../types/analysisHub';
