import React, { useState, useEffect, useCallback } from 'react';
import { Uploader } from './schema-generator/Uploader';
import { ResultCard } from './schema-generator/ResultCard';
import { HistorySidebar } from './schema-generator/HistorySidebar';
import { HandbookViewer } from './schema-generator/HandbookViewer';
import { aiService } from '../services/aiService';
import { dbService } from '../services/dbService';
import { featureEngineeringService } from '../services/featureEngineeringService';
import { causalService } from '../services/causalService';
import { guidanceService } from '../services/guidanceService';
import { duckDBService } from '../services/duckdbService';
import { inferenceService } from '../services/inferenceService';
import { anomalyService } from '../services/anomalyService';
import { handbookGenerator, HandbookBatch, HandbookResult, HandbookContext } from '../services/HandbookGenerator';
import { GenerationResult, AnalysisSummary, SavedAnalysis } from '../types';
import { ProjectManagerModal } from './ProjectManagerModal';
import { TableManager } from './TableManager';
import { ERDiagram } from './ERDiagram';
import { Activity, Database, LayoutTemplate, BookOpen } from 'lucide-react';


interface SchemaGeneratorProps {
  onExecuteSql: (sql: string) => void;
  onRefresh?: () => void;
}

// Pipeline Stage Tracking for Progressive Rendering
type PipelineStage =
  | 'idle'
  | 's0_probe'       // Stage 0: Scene Probe
  | 's1_semantic'    // Stage 1: Semantic Analysis
  | 's2_quality'     // Stage 2: Quality Audit
  | 's3_sql'         // Stage 3: Operations (SQL)
  | 's4_insights'    // Stage 4: Insights (KPI, Anomaly, Causal)
  | 's5_report'      // Stage 5: Narrative Report
  | 'complete'
  | 'error';

interface PipelineError {
  stage: PipelineStage;
  message: string;
}

const SchemaGenerator: React.FC<SchemaGeneratorProps> = ({ onExecuteSql, onRefresh }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [activeSummary, setActiveSummary] = useState<AnalysisSummary | null>(null);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);

  /**
   * Helper to consistently build flat result structure matching EnrichedAnalysisResult.
   * v6.1: Improved robustness and state merger to prevent data loss between stages.
   */
  const buildResult = (currentCtx: any): GenerationResult => {
    // 1. Generate Heuristic Overview (Zero-Blank Fallback)
    const heuristicOverview = currentCtx.activeSummary ?
      `Analysis of ${currentCtx.activeSummary.tableName}. This dataset contains ${currentCtx.activeSummary.rowCount} rows across ${currentCtx.activeSummary.columnCount} columns. ` +
      `Detected ${currentCtx.metrics?.length || 0} metrics and ${currentCtx.dimensions?.length || 0} dimensions. ` +
      `Primary focus: ${currentCtx.probeResult?.recommendedIntent || 'General Exploration'}.` : "";

    return {
      ...currentCtx.genResult,
      // UI Properties
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
      // Narrative & Identity
      overview: currentCtx.genResult?.overview || heuristicOverview,
      narrativeReport: currentCtx.narrativeReport,
      snapshotInsights: currentCtx.snapshotInsights || [],
      userIntent: currentCtx.probeResult?.recommendedIntent || 'EXPLORATION',

      // Legacy/Nested backup
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
  };
  const [error, setError] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedAnalysis[]>([]);
  const [viewMode, setViewMode] = useState<'analysis' | 'model' | 'handbook'>('analysis');

  // Progressive Pipeline State
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('idle');
  const [pipelineStatus, setPipelineStatus] = useState<string>('');
  const [pipelineError, setPipelineError] = useState<PipelineError | null>(null);
  const [pipelineContext, setPipelineContext] = useState<any>(null); // Store intermediate results for retry
  const [deepAnalysisStarted, setDeepAnalysisStarted] = useState(false);

  // Handbook Generation State (v6.0)
  const [handbookBatches, setHandbookBatches] = useState<HandbookBatch[]>([]);
  const [handbookResult, setHandbookResult] = useState<HandbookResult | null>(null);
  const [isGeneratingHandbook, setIsGeneratingHandbook] = useState(false);
  const [handbookProgress, setHandbookProgress] = useState<string>('');

  useEffect(() => { loadHistory(); }, []);

  // M4: Epic-008 Auto-Save Session
  useEffect(() => {
    if (activeProject && (result || activeSummary)) {
      const saveState = async () => {
        try {
          await duckDBService.saveSession('main_analysis', {
            fileName: activeFileName,
            summary: activeSummary,
            result: result,
            timestamp: Date.now()
          });
          console.log("[Session] Auto-saved to DB");
        } catch (e) {
          console.warn("[Session] Auto-save failed", e);
        }
      };
      // Debounce 2s
      const timer = setTimeout(saveState, 2000);
      return () => clearTimeout(timer);
    }
  }, [activeProject, result, activeSummary, activeFileName]);


  const loadHistory = async () => {
    try { setHistory(await dbService.getAll()); }
    catch (e) { console.error("DB Error", e); }
  };

  // ============================================================
  // PROGRESSIVE ANALYSIS PIPELINE (Staged Execution)
  // ============================================================
  // Each stage runs independently and renders partial results.
  // AI-heavy stages (P3, P4) can fail without losing P0-P2 results.

  const runAnalysisPipeline = async (
    summary: AnalysisSummary,
    enrichedStats: any[],
    stagingTable: string,
    startFromStage?: PipelineStage // For retry
  ) => {
    if (isProcessing && !startFromStage) {
      console.warn("[Pipeline] Execution blocked: Pipeline is already running.");
      return;
    }

    setIsProcessing(true);
    setPipelineError(null);
    const ctx = pipelineContext || { summary, enrichedStats, stagingTable };
    setPipelineContext(ctx);

    // Defensive init
    if (!ctx.genResult) ctx.genResult = {};

    try {
      // ============ Stage 0-3: Unified Analysis (Single API Call) ===========
      // v6.0: Combines Probe + Semantic + Quality + Ops into ONE request
      // Reduces 4 API calls to 1, staying within Groq's 8000 TPM limit
      if (!startFromStage || ['s0_probe', 's1_semantic', 's2_quality', 's3_sql'].includes(startFromStage)) {
        setPipelineStage('s0_probe');
        setPipelineStatus('🚀 Unified Analysis Pipeline (Single API Call)...');
        console.log(`[Pipeline] Running Unified Analysis...`);

        // Heuristic P0 Stats first (no AI needed)
        const colNames = enrichedStats.map(s => s.name);
        ctx.heuristicColumns = inferenceService.inferSchema(enrichedStats);
        ctx.hierarchies = await duckDBService.detectHierarchies(stagingTable, colNames);

        // Single Unified AI Call
        try {
          setPipelineStatus('🧠 AI: Analyzing Schema, Quality & Operations...');
          const unified = await aiService.generateUnifiedAnalysis(summary);

          // Unpack results
          const { probe, semantic, quality, operations, snapshotInsights, overview, keyMetrics } = unified;

          ctx.probeResult = probe;
          ctx.genResult = {
            ...ctx.genResult,
            semanticColumns: semantic.columns,
            operations: operations,
            overview: overview || ctx.genResult?.overview, // Update overview in genResult
            keyMetrics: keyMetrics || [], // Explicitly unpack keyMetrics
          };
          ctx.snapshotInsights = snapshotInsights || [];
          ctx.semanticResult = {
            semanticColumns: semantic.columns,
            qualityReport: quality
          };
          ctx.narrativeReport = overview || ctx.narrativeReport; // Also update narrativeReport directly in ctx

          // Setup Metadata
          const cols = unified.semantic.columns || [];
          ctx.metrics = cols.filter((c: any) => c.semanticType === 'MEA' || c.semanticType === 'CURR');
          ctx.dimensions = cols.filter((c: any) => c.semanticType === 'DIM');
          ctx.timeCol = cols.find((c: any) => c.semanticType === 'TIME')?.name;

          setPipelineStatus(`✅ Unified Analysis Complete (Intent: ${unified.probe.recommendedIntent})`);
          setResult(buildResult(ctx));
          await new Promise(r => setTimeout(r, 800));
        } catch (e: any) {
          console.error("Unified Analysis failed", e);
          // Fallback: Set defaults
          ctx.probeResult = { recommendedIntent: 'EXPLORATION' };
          ctx.semanticResult = { semanticColumns: [], qualityReport: null };
          if (!ctx.genResult) ctx.genResult = {}; // Init if missing
          ctx.genResult.operations = { scripts: [] };

          // Defensive Init for Stage 4
          ctx.metrics = [];
          ctx.dimensions = [];
          ctx.timeCol = null;

          setPipelineError({ stage: 's0_probe', message: e.message });
        }
        setPipelineContext({ ...ctx });
        // Mark stages as complete
        setPipelineStage('s3_sql');
      }

      // ============ Stage 4: Insights (KPIs + Deep) ===========
      if (!startFromStage || ['s0_probe', 's1_semantic', 's2_quality', 's3_sql', 's4_insights'].includes(startFromStage)) {
        setPipelineStage('s4_insights');
        setPipelineStatus('Stage 4: Insights & Anomalies...');

        // --- 4.1 Streaming KPIs ---
        ctx.metrics = ctx.metrics || []; // Defensive check
        ctx.scorecards = [];
        ctx.anomalies = [];
        setResult(buildResult(ctx));

        // Generate KPIs
        for (const m of ctx.metrics) {
          setPipelineStatus(`Calculating Metric: ${m.name}...`);
          try {
            const data = await duckDBService.getMetricScorecardQuery(stagingTable, m.name, ctx.timeCol);
            ctx.scorecards.push({ name: m.name, displayName: m.name, ...data.stats, trend: data.trend || [] });
            setResult(buildResult(ctx)); // Stream update
          } catch (e) { console.error(e); }
        }

        // --- 4.2 Anomalies ---
        const numericCols = enrichedStats.filter(s => ['INTEGER', 'DOUBLE', 'BIGINT', 'DECIMAL'].some(t => s.type.includes(t))).map(s => s.name);
        for (const col of numericCols) {
          try {
            const res = await anomalyService.detectIQR(stagingTable, col); // Assuming public
            if (res && res.ratio > 0 && res.ratio < 0.2) {
              ctx.anomalies.push(res);
              setResult(buildResult(ctx));
            }
          } catch (e) { }
        }

        // --- 4.3 Deep Insights ---
        // Just prepare context, actual deep insights might be triggered on-demand or here
        // For v5 schema, we do "Insight Analysis" here.

        // Compute Heuristics for Causal
        const featureProposals = featureEngineeringService.suggestFeatures(ctx.semanticResult.semanticColumns);
        ctx.featureProposalsHeuristic = featureProposals;

        // We stop automatic here? Or run deep insights? V5 says Stage 4 is Insight.
        // Let's run a lightweight insight pass.
        setPipelineStatus('Stage 4: Generating Template Analysis...');
        const intelContext = {
          drivers: [],
          correlations: [],
          anomalies: ctx.anomalies,
          metrics: ctx.metrics.map((m: any) => m.name)
        };
        // Just placeholder for deep insights unless triggered
        // user can trigger "Deep Analysis" button to fill this fully

        setPipelineStage('complete');
        setIsProcessing(false);
      }

    } catch (err: any) {
      console.error(`[Pipeline] Stage ${pipelineStage} failed:`, err);
      setPipelineError({
        stage: pipelineStage,
        message: err.message || 'Unknown error'
      });
      setPipelineStage('error');
      setIsProcessing(false);
    }
  };

  // ============================================================
  // HANDBOOK GENERATION (v6.0)
  // ============================================================
  const generateHandbook = useCallback(async () => {
    if (!pipelineContext || !activeSummary) {
      console.error('[Handbook] No context available');
      return;
    }

    setIsGeneratingHandbook(true);
    setViewMode('handbook');
    setHandbookProgress('🚀 初始化手册生成...');

    try {
      // Build handbook context from existing analysis
      const ctx = pipelineContext;
      const columns = ctx.semanticResult?.semanticColumns || [];
      const sampleRows = activeSummary?.sampleData ? [] : []; // Would need raw row data

      const handbookContext = handbookGenerator.initContext(
        activeSummary.tableName,
        activeSummary.rowCount,
        columns,
        ctx.semanticResult?.qualityReport || null,
        activeSummary.sampleData || '',
        sampleRows,
        activeSummary.stats || []
      );

      // Initialize batches
      setHandbookBatches([
        { id: 'batch_1', title: '第一批次：基础CRUD', modules: [], status: 'pending', content: '', tokenEstimate: 4000 },
        { id: 'batch_2', title: '第二批次：关联与事务', modules: [], status: 'pending', content: '', tokenEstimate: 5000 },
        { id: 'batch_3', title: '第三批次：高级与附录', modules: [], status: 'pending', content: '', tokenEstimate: 4000 },
      ]);

      // Generate with streaming callback
      const result = await handbookGenerator.generateHandbook(
        handbookContext,
        (batch) => {
          // Update batch state incrementally
          setHandbookBatches(prev => prev.map(b =>
            b.id === batch.id ? batch : b
          ));
        },
        (msg) => setHandbookProgress(msg)
      );

      setHandbookResult(result);
      setHandbookProgress('✅ 手册生成完成');

      // Auto-save debug info for analysis
      console.log('[Handbook Debug]', result);
    } catch (err: any) {
      console.error('[Handbook] Generation failed:', err);
      setHandbookProgress(`❌ 生成失败: ${err.message}`);
    } finally {
      setIsGeneratingHandbook(false);
    }
  }, [pipelineContext, activeSummary]);

  // ... (runDeepAnalysis would be similar, mapped to S4/S5)

  // ============================================================
  // DEEP ANALYSIS PIPELINE (On-Demand)
  // ============================================================
  const runDeepAnalysis = async () => {
    if (!result || !pipelineContext) return;

    setIsProcessing(true);
    setDeepAnalysisStarted(true);
    const ctx = pipelineContext;


    try {
      setPipelineStage('s4_insights');
      setPipelineStatus('Stage 4: Deep Insights & Causal Analysis...');
      console.log(`[Pipeline S4] Starting Deep Intelligence...`);

      const intelContext = {
        drivers: ctx.drivers,
        correlations: ctx.correlations,
        anomalies: ctx.anomalies,
        causalContext: ctx.causalContext,
        qualityScore: ctx.semanticResult?.qualityReport?.overallScore,
        metrics: ctx.metrics.map((m: any) => m.name),
        tableName: ctx.summary.tableName
      };

      // 1. Causal Graph
      setPipelineStatus('Building Causal Graph...');
      const causalRes = await aiService.generateCausalGraph(intelContext);
      ctx.causalAnalysis = causalRes;
      setResult(buildResult(ctx));

      // 2. Deep Insights
      setPipelineStatus('Discovering Insights...');
      const insights = await aiService.generateKeyInsights(intelContext);
      ctx.deepInsights = insights || [];
      setResult(buildResult(ctx));

      // ============ Stage 5: Report ===========
      setPipelineStage('s5_report');
      setPipelineStatus('Stage 5: Narrative Reporting...');

      // 3. Narrative
      const finalRes = buildResult(ctx);
      const narrative = await aiService.generateAssetNarrative(intelContext, finalRes);
      ctx.narrativeReport = narrative;
      setResult(buildResult(ctx));

      // Generate Guidance
      const guidance = guidanceService.generateActions(finalRes as any, ctx.stagingTable);
      ctx.guidance = guidance;

      setResult(buildResult(ctx));
      console.log(`[Pipeline S5] ✓ Deep Intelligence & Asset Report Complete`);

      setPipelineStage('complete');
      setIsProcessing(false);

    } catch (err: any) {
      console.error(`[Pipeline] Deep Analysis failed:`, err);
      setPipelineError({
        stage: 's4_insights',
        message: err.message || 'Deep Analysis Failed'
      });
      setPipelineStage('error');
      setIsProcessing(false);
    }
  };

  // Retry from failed stage
  const retryFromStage = async (stage: PipelineStage) => {
    if (!pipelineContext) return;
    setIsProcessing(true);
    setPipelineError(null); // Clear error on retry

    // If failing during Deep Analysis (S4/S5), retry the Deep Analysis flow
    if (deepAnalysisStarted && (stage === 's4_insights' || stage === 's5_report')) {
      console.log("Retrying Deep Analysis...");
      await runDeepAnalysis();
      return;
    }

    await runAnalysisPipeline(
      pipelineContext.summary,
      pipelineContext.enrichedStats,
      pipelineContext.stagingTable,
      stage
    );
  };

  // Skip failed stage and continue
  const skipCurrentStage = async () => {
    if (!pipelineError || !pipelineContext) return;

    const stage = pipelineError.stage;
    const stages: PipelineStage[] = ['s0_probe', 's1_semantic', 's2_quality', 's3_sql', 's4_insights', 's5_report'];
    const idx = stages.indexOf(stage);

    setPipelineError(null);

    if (idx < stages.length - 1) {
      // ... skip logic
      retryFromStage(stages[idx + 1]); // Simplified
    }
  };


  const handleDataReady = async (rawData: string, fileName: string) => {
    // ... same as before
    setIsProcessing(true); setError(null);
    try {
      console.log(`[SchemaGenerator] Creating staging table for ${fileName}...`);
      const stagingTable = await duckDBService.createStagingTable(rawData, fileName);
      if (onRefresh) onRefresh();

      console.log(`[SchemaGenerator] Generating enriched profile...`);
      const enrichedStats = await duckDBService.getEnrichedProfile(stagingTable);

      const cleanData = rawData.trim();
      const lines = cleanData.split('\n');
      const summary: AnalysisSummary = {
        rowCount: lines.length - 1,
        columnCount: lines[0].split(',').length,
        tableName: stagingTable,
        sampleData: lines.slice(0, 15).join('\n'),
        stats: enrichedStats as any
      };

      setActiveSummary(summary);
      setActiveFileName(fileName);

      await runAnalysisPipeline(summary, enrichedStats, stagingTable, 's0_probe');

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Analysis failed');
      setIsProcessing(false);
    }
  };

  const handleTableSelect = async (tableName: string) => {
    // ... same as before
    setIsProcessing(true); setError(null);
    try {
      console.log(`[SchemaGenerator] Analyzing existing table ${tableName}...`);
      const enrichedStats = await duckDBService.getEnrichedProfile(tableName);
      const sampleRes = await duckDBService.query(`SELECT * FROM "${tableName}" LIMIT 15`);
      const tableInfo = await duckDBService.query(`SELECT COUNT(*) as cnt FROM "${tableName}"`);
      const count = Number(tableInfo[0].cnt);

      const summary: AnalysisSummary = {
        rowCount: count,
        columnCount: enrichedStats.length,
        tableName: tableName,
        sampleData: JSON.stringify(sampleRes, null, 2),
        stats: enrichedStats as any
      };

      setActiveSummary(summary);
      setActiveFileName(tableName + '.csv');

      await runAnalysisPipeline(summary, enrichedStats, tableName, 's0_probe');
    } catch (e: any) {
      // ...
    }
  };


  return (
    <div className="w-full h-full overflow-hidden bg-[#FAFAFA] flex flex-col">
      <div className="flex h-full w-full overflow-hidden">
        {activeProject && (
          <TableManager
            onTableSelect={handleTableSelect}
            activeTable={activeSummary?.tableName || null}
          />
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-[#FAFAFA]">
          <div className="w-full px-8 py-8 min-h-full">
            {error && (
              <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-red-50 text-red-600 px-6 py-3 rounded-lg text-xs font-bold border border-red-100 shadow-xl z-50 flex gap-4">
                <span>⚠️ {error}</span>
                <button onClick={() => setError(null)}>✕</button>
              </div>
            )}

            {/* Pipeline Progress Indicator */}
            {isProcessing && pipelineStage !== 'idle' && (
              <div className="fixed bottom-6 right-6 bg-white border border-gray-200 rounded-xl shadow-2xl p-4 z-50 min-w-[320px]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center animate-pulse">
                    <span className="text-white text-sm">⚡</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800">AI Analysis Pipeline (v5.0)</p>
                    <p className="text-[10px] text-blue-500 font-medium animate-pulse">{pipelineStatus || `Stage: ${pipelineStage}`}</p>
                  </div>
                  {/* Active Rules Badge */}
                  <div className="ml-auto flex gap-1">
                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[9px] rounded font-bold border border-purple-200">PII</span>
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] rounded font-bold border border-green-200">Contract</span>
                  </div>
                </div>
                <div className="flex gap-1 mb-1">
                  {['s0_probe', 's1_semantic', 's2_quality', 's3_sql', 's4_insights', 's5_report'].map((stage, i) => (
                    <div
                      key={stage}
                      className={`flex-1 h-1.5 rounded-full transition-all ${pipelineStage === stage ? 'bg-blue-500 animate-pulse' :
                        ['s0_probe', 's1_semantic', 's2_quality', 's3_sql', 's4_insights', 's5_report'].indexOf(pipelineStage) > i ? 'bg-green-500' :
                          'bg-gray-200'
                        }`}
                      title={stage}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1 text-[9px] text-gray-400 font-mono w-full px-0.5">
                  <span>Probe</span><span>Sens</span><span>Qual</span><span>SQL</span><span>Ins</span><span>Rpt</span>
                </div>
              </div>
            )}

            {/* Pipeline Error with Retry */}
            {pipelineError && (
              <div className="fixed bottom-6 right-6 bg-amber-50 border border-amber-200 rounded-xl shadow-2xl p-4 z-50 min-w-[320px]">
                {/* ... existing error UI ... */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm">⚠️</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-amber-800">Pipeline Paused at {pipelineError.stage}</p>
                    <p className="text-[10px] text-amber-600 mt-1 break-words">{pipelineError.message}</p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => retryFromStage(pipelineError.stage)}
                        className="px-3 py-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-lg hover:bg-amber-600 transition-all"
                      >
                        🔄 Retry
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Top Toolbar */}
            <div className="flex justify-between items-center mb-12 max-w-[1920px] mx-auto">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsHistoryOpen(true)}
                  className="bg-white border border-gray-200 w-10 h-10 rounded-lg flex items-center justify-center hover:bg-black hover:text-white hover:border-black transition-all shadow-sm group"
                >
                  <span className="text-lg group-hover:scale-110 transition-transform">📂</span>
                </button>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-[0.1em]">Pipeline Engine</h2>
                  <p className="text-[10px] text-gray-400 font-mono">
                    STATUS: {pipelineStage === 'complete' ? '✓ COMPLETE' :
                      pipelineStage === 'error' ? '⚠️ PAUSED' :
                        pipelineStage === 'idle' ? 'IDLE' :
                          `⏳ ${pipelineStage.toUpperCase()}`}
                  </p>
                </div>
              </div>

              {/* View Mode Toggle (Center) */}
              <div className="bg-gray-100 p-1 rounded-lg flex items-center gap-1">
                <button
                  onClick={() => setViewMode('analysis')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'analysis' ? 'bg-white shadow text-black' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Activity size={14} /> <span>Analysis</span>
                </button>
                <button
                  onClick={() => setViewMode('model')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'model' ? 'bg-white shadow text-black' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <LayoutTemplate size={14} /> <span>Model</span>
                </button>
                <button
                  onClick={() => setViewMode('handbook')}
                  disabled={!pipelineContext}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'handbook' ? 'bg-white shadow text-black' : 'text-gray-400 hover:text-gray-600'} ${!pipelineContext ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <BookOpen size={14} /> <span>Handbook</span>
                  {isGeneratingHandbook && <span className="ml-1 animate-spin">⏳</span>}
                </button>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowProjects(true)}
                  className="bg-white border border-gray-200 px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-50 text-gray-700 flex items-center gap-2"
                >
                  <span>📁</span> {activeProject ? activeProject : 'Projects'}
                </button>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="bg-white border border-gray-200 px-3 py-2 rounded-lg text-xs font-bold hover:bg-black hover:text-white transition-all flex items-center gap-2"
                >
                  <span>⚙️</span> 配置 API
                </button>
              </div>
            </div>




            {/* Content */}
            {viewMode === 'handbook' ? (
              <div className="h-[calc(100vh-180px)] w-full">
                <HandbookViewer
                  result={handbookResult}
                  batches={handbookBatches}
                  isGenerating={isGeneratingHandbook}
                  progressMessage={handbookProgress}
                  onGenerate={generateHandbook}
                  onExecuteSql={onExecuteSql}
                />
              </div>
            ) : viewMode === 'model' ? (
              <div className="h-[calc(100vh-180px)] w-full">
                <ERDiagram onExecuteSql={(sql) => { setViewMode('analysis'); onExecuteSql(sql); }} />
              </div>
            ) : (
              !result || !activeSummary ? (
                <div className="flex flex-col items-center justify-center h-[60vh]">
                  {!activeProject ? (
                    <div className="text-center text-gray-400">
                      <p className="text-lg font-bold mb-2">No Project Selected</p>
                      <p className="text-xs">Create or select a project to start.</p>
                      <button onClick={() => setShowProjects(true)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">Open Projects</button>
                    </div>
                  ) : (
                    <Uploader onDataReady={handleDataReady} isProcessing={isProcessing} />
                  )}
                </div>
              ) : (
                <ResultCard
                  result={result}
                  summary={activeSummary}
                  fileName={activeFileName}
                  onExecuteSql={onExecuteSql}
                  onRefresh={onRefresh}
                  onGenerateHandbook={generateHandbook}
                />
              )
            )}

            {/* History Sidebar */}
            {isHistoryOpen && (
              <HistorySidebar
                history={history}
                onClose={() => setIsHistoryOpen(false)}
                onLoadAnalysis={(analysis) => {
                  setResult(analysis.result);
                  setActiveSummary(analysis.summary);
                  setActiveFileName(analysis.fileName);
                  setIsHistoryOpen(false);
                }}
                onDeleteAnalysis={async (id) => {
                  await dbService.delete(id);
                  await loadHistory();
                }}
              />
            )}

            {/* Settings Modal */}
            {isSettingsOpen && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center animate-[fadeIn_0.2s]">
                <div className="bg-white rounded-xl shadow-2xl w-[450px] p-6 animate-[slideIn_0.2s]">
                  <h3 className="text-lg font-bold mb-4">AI 服务配置</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">供应商 (Provider)</label>
                      <select
                        className="w-full border border-gray-300 rounded p-2 text-sm text-black bg-white"
                        defaultValue={localStorage.getItem('duckdb_ai_provider') || 'google'}
                        onChange={(e) => {
                          const provider = e.target.value;
                          localStorage.setItem('duckdb_ai_provider', provider);
                          // Default models for convenience
                          if (provider === 'groq') {
                            localStorage.setItem('duckdb_ai_model', 'llama-3.3-70b-versatile');
                            localStorage.setItem('duckdb_ai_base_url', 'https://api.groq.com/openai/v1/chat/completions');
                          } else if (provider === 'google') {
                            localStorage.setItem('duckdb_ai_model', 'gemini-2.0-flash-exp');
                            localStorage.setItem('duckdb_ai_base_url', '');
                          } else if (provider === 'openai') {
                            localStorage.setItem('duckdb_ai_model', 'gpt-4o');
                            localStorage.setItem('duckdb_ai_base_url', 'https://api.openai.com/v1/chat/completions');
                          }
                          window.location.reload();
                        }}
                      >
                        <option value="google">Google Gemini</option>
                        <option value="groq">Groq (Fastest)</option>
                        <option value="openai">OpenAI / Compatible</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">API Key</label>
                      <input
                        type="password"
                        className="w-full border border-gray-300 rounded p-2 text-sm text-black"
                        placeholder="Key for selected provider"
                        defaultValue={localStorage.getItem('duckdb_ai_api_key') || ''}
                        onChange={(e) => localStorage.setItem('duckdb_ai_api_key', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">模型 (Model Name)</label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded p-2 text-sm text-black"
                        placeholder="e.g. gemini-2.0-flash-exp, llama-3.3-70b-versatile"
                        defaultValue={localStorage.getItem('duckdb_ai_model') || ''}
                        onChange={(e) => localStorage.setItem('duckdb_ai_model', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">端点 (Base URL - 可选)</label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded p-2 text-sm text-black"
                        placeholder="Custom endpoint URL"
                        defaultValue={localStorage.getItem('duckdb_ai_base_url') || ''}
                        onChange={(e) => {
                          localStorage.setItem('duckdb_ai_base_url', e.target.value);
                        }}
                      />
                    </div>

                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={() => { setIsSettingsOpen(false); }}
                        className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-800"
                      >
                        确认并关闭
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <ProjectManagerModal
              isOpen={showProjects}
              onClose={() => setShowProjects(false)}
              currentProject={activeProject}
              onProjectSelected={async (name) => {
                setActiveProject(name || null);
                if (name) {
                  const saved = await duckDBService.loadSession('main_analysis');
                  if (saved) {
                    if (saved.summary) setActiveSummary(saved.summary);
                    if (saved.result) setResult(saved.result);
                    if (saved.fileName) setActiveFileName(saved.fileName);
                  } else {
                    setResult(null);
                    setActiveSummary(null);
                  }
                }
              }}
            />
          </div>
        </div>
      </div>
    </div >
  );
};

export { SchemaGenerator };
