/**
 * useAnalysisPipeline.ts — Analysis pipeline orchestration hook
 * 
 * Encapsulates the staged analysis pipeline (Probe → Semantic → Quality → Ops → Insights → Report)
 * into a reusable hook, removing service coupling from SchemaGenerator.tsx.
 */

import { useCallback } from 'react';
import { aiService } from '../services/aiService';
import { duckDBService } from '../services/duckdbService';
import { inferenceService } from '../services/inferenceService';
import { anomalyService } from '../services/anomalyService';
import { featureEngineeringService } from '../services/featureEngineeringService';
import { guidanceService } from '../services/guidanceService';
import type { PipelineStage } from '../types/analysisHub';
import type { GenerationResult, AnalysisSummary } from '../types';

export interface PipelineCallbacks {
  setIsProcessing: (v: boolean) => void;
  setPipelineStage: (stage: PipelineStage) => void;
  setPipelineError: (err: { stage: PipelineStage; message: string } | null) => void;
  setResult: (result: GenerationResult | null) => void;
  setActiveSummary: (summary: AnalysisSummary | null) => void;
  setActiveFileName: (name: string | null) => void;
  setPipelineContext: (ctx: any) => void;
  pipelineContext: any;
  isProcessing: boolean;
  result: GenerationResult | null;
  deepAnalysisStarted: boolean;
  setDeepAnalysisStarted: (v: boolean) => void;
}

function buildResult(currentCtx: any): GenerationResult {
  const heuristicOverview = currentCtx.activeSummary
    ? `Analysis of ${currentCtx.activeSummary.tableName}. This dataset contains ${currentCtx.activeSummary.rowCount} rows across ${currentCtx.activeSummary.columnCount} columns. ` +
      `Detected ${currentCtx.metrics?.length || 0} metrics and ${currentCtx.dimensions?.length || 0} dimensions. ` +
      `Primary focus: ${currentCtx.probeResult?.recommendedIntent || 'General Exploration'}.`
    : "";

  return {
    ...currentCtx.genResult,
    semanticColumns: currentCtx.semanticResult?.semanticColumns || currentCtx.genResult?.semanticColumns || [],
    metricScorecards: currentCtx.scorecards || [],
    anomalies: currentCtx.anomalies || [],
    qualityReport: currentCtx.semanticResult?.qualityReport || currentCtx.genResult?.qualityReport,
    hierarchies: currentCtx.hierarchies || [],
    correlations: currentCtx.correlations,
    causalGraph: currentCtx.causalAnalysis?.graph,
    featureProposals: [
      ...(currentCtx.causalAnalysis?.engineeredFeatures || []),
      ...(currentCtx.featureProposalsHeuristic || [])
    ],
    drivers: currentCtx.drivers,
    overview: currentCtx.genResult?.overview || heuristicOverview,
    narrativeReport: currentCtx.narrativeReport,
    snapshotInsights: currentCtx.snapshotInsights || [],
    userIntent: currentCtx.probeResult?.recommendedIntent || 'EXPLORATION',
    semanticSchema: {
      ...currentCtx.semanticResult,
      hierarchies: currentCtx.hierarchies,
      scorecards: currentCtx.scorecards,
      anomalies: currentCtx.anomalies,
      correlations: currentCtx.correlations,
      causalGraph: currentCtx.causalAnalysis?.graph,
      featureProposals: currentCtx.causalAnalysis?.engineeredFeatures,
      narrativeReport: currentCtx.narrativeReport
    }
  };
}

export function useAnalysisPipeline(callbacks: PipelineCallbacks) {
  const {
    setIsProcessing, setPipelineStage, setPipelineError,
    setResult, setActiveSummary, setActiveFileName,
    setPipelineContext, pipelineContext,
    isProcessing, result, deepAnalysisStarted, setDeepAnalysisStarted
  } = callbacks;

  const runAnalysisPipeline = useCallback(async (
    summary: AnalysisSummary,
    enrichedStats: any[],
    stagingTable: string,
    startFromStage?: PipelineStage
  ) => {
    if (isProcessing && !startFromStage) {
      console.warn("[Pipeline] Execution blocked: Pipeline is already running.");
      return;
    }

    setIsProcessing(true);
    setPipelineError(null);
    const ctx = pipelineContext || { summary, enrichedStats, stagingTable };
    setPipelineContext(ctx);

    if (!ctx.genResult) ctx.genResult = {};

    try {
      if (!startFromStage || ['s0_probe', 's1_semantic', 's2_quality', 's3_sql'].includes(startFromStage)) {
        setPipelineStage('s0_probe');

        ctx.heuristicColumns = inferenceService.inferSchema(enrichedStats);
        ctx.hierarchies = await duckDBService.detectHierarchies(stagingTable, enrichedStats.map((s: any) => s.name));

        try {
          const unified = await aiService.generateUnifiedAnalysis(summary);
          const { probe, semantic, quality, operations, snapshotInsights, overview, keyMetrics } = unified;

          ctx.probeResult = probe;
          ctx.genResult = {
            ...ctx.genResult,
            semanticColumns: semantic.columns,
            operations: operations,
            overview: overview || ctx.genResult?.overview,
            keyMetrics: keyMetrics || [],
          };
          ctx.snapshotInsights = snapshotInsights || [];
          ctx.semanticResult = { semanticColumns: semantic.columns, qualityReport: quality };
          ctx.narrativeReport = overview || ctx.narrativeReport;

          const cols = unified.semantic.columns || [];
          ctx.metrics = cols.filter((c: any) => c.semanticType === 'MEA' || c.semanticType === 'CURR');
          ctx.dimensions = cols.filter((c: any) => c.semanticType === 'DIM');
          ctx.timeCol = cols.find((c: any) => c.semanticType === 'TIME')?.name;

          setResult(buildResult(ctx));
          await new Promise(r => setTimeout(r, 800));
        } catch (e: any) {
          console.error("Unified Analysis failed", e);
          ctx.probeResult = { recommendedIntent: 'EXPLORATION' };
          ctx.semanticResult = { semanticColumns: [], qualityReport: null };
          if (!ctx.genResult) ctx.genResult = {};
          ctx.genResult.operations = { scripts: [] };
          ctx.metrics = [];
          ctx.dimensions = [];
          ctx.timeCol = null;
          setPipelineError({ stage: 's0_probe', message: e.message });
        }
        setPipelineContext({ ...ctx });
        setPipelineStage('s3_sql');
      }

      if (!startFromStage || ['s0_probe', 's1_semantic', 's2_quality', 's3_sql', 's4_insights'].includes(startFromStage)) {
        setPipelineStage('s4_insights');

        ctx.metrics = ctx.metrics || [];
        ctx.scorecards = [];
        ctx.anomalies = [];
        setResult(buildResult(ctx));

        for (const m of ctx.metrics) {
          try {
            const data = await duckDBService.getMetricScorecardQuery(stagingTable, m.name, ctx.timeCol);
            ctx.scorecards.push({ name: m.name, displayName: m.name, ...data.stats, trend: data.trend || [] });
            setResult(buildResult(ctx));
          } catch (e) { console.error(e); }
        }

        const numericCols = enrichedStats.filter((s: any) =>
          ['INTEGER', 'DOUBLE', 'BIGINT', 'DECIMAL'].some(t => s.type.includes(t))
        ).map((s: any) => s.name);
        for (const col of numericCols) {
          try {
            const res = await anomalyService.detectIQR(stagingTable, col);
            if (res && res.ratio > 0 && res.ratio < 0.2) {
              ctx.anomalies.push(res);
              setResult(buildResult(ctx));
            }
          } catch (e) { }
        }

        const featureProposals = featureEngineeringService.suggestFeatures(ctx.semanticResult.semanticColumns);
        ctx.featureProposalsHeuristic = featureProposals;

        setPipelineStage('complete');
        setIsProcessing(false);
      }

    } catch (err: any) {
      console.error(`[Pipeline] Stage failed:`, err);
      setPipelineError({ stage: 's4_insights', message: err.message || 'Unknown error' });
      setPipelineStage('error');
      setIsProcessing(false);
    }
  }, [isProcessing, pipelineContext, setIsProcessing, setPipelineStage, setPipelineError, setResult, setPipelineContext, deepAnalysisStarted, setDeepAnalysisStarted]);

  const runDeepAnalysis = useCallback(async () => {
    if (!result || !callbacks.pipelineContext) return;

    setIsProcessing(true);
    setDeepAnalysisStarted(true);
    const ctx = callbacks.pipelineContext;

    try {
      setPipelineStage('s4_insights');

      const intelContext = {
        drivers: ctx.drivers,
        correlations: ctx.correlations,
        anomalies: ctx.anomalies,
        causalContext: ctx.causalContext,
        qualityScore: ctx.semanticResult?.qualityReport?.overallScore,
        metrics: ctx.metrics.map((m: any) => m.name),
        tableName: ctx.summary.tableName
      };

      const causalRes = await aiService.generateCausalGraph(intelContext);
      ctx.causalAnalysis = causalRes;
      setResult(buildResult(ctx));

      const insights = await aiService.generateKeyInsights(intelContext);
      ctx.deepInsights = insights || [];
      setResult(buildResult(ctx));

      setPipelineStage('s5_report');

      const finalRes = buildResult(ctx);
      const narrative = await aiService.generateAssetNarrative(intelContext, finalRes);
      ctx.narrativeReport = narrative;
      setResult(buildResult(ctx));

      const guidance = guidanceService.generateActions(finalRes as any, ctx.stagingTable);
      ctx.guidance = guidance;

      setResult(buildResult(ctx));

      setPipelineStage('complete');
      setIsProcessing(false);

    } catch (err: any) {
      console.error(`[Pipeline] Deep Analysis failed:`, err);
      setPipelineError({ stage: 's4_insights', message: err.message || 'Deep Analysis Failed' });
      setPipelineStage('error');
      setIsProcessing(false);
    }
  }, [callbacks.pipelineContext, setIsProcessing, setDeepAnalysisStarted, setPipelineStage, setPipelineError, setResult, result]);

  return { runAnalysisPipeline, runDeepAnalysis };
}
