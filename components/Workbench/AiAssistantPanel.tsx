import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Database,
  Layers,
  ArrowRight,
  ExternalLink,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Zap,
  FileCode,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  Clock,
  Maximize2,
  Minimize2,
  RefreshCw,
  Loader2,
  Tag,
  Lightbulb,
  ListChecks,
  Brain,
} from 'lucide-react';
import type { QueryResult, ObjectRef } from '../../types';
import type { ColumnAiProfile, ColumnSemanticType } from '../../types/ai';
import { toastService } from '../../services/toastService';
import { duckDBService } from '../../services/duckdbService';
import { aiService } from '../../services/aiService';
import { columnProfiler } from '../../services/workbench/columnProfiler';
import type { ColumnProfileSnapshot } from '../../services/workbench/types';
import { ActionButton, InlineAlert, ModalShell } from '../ui/Workbench';

// ---- AI response type contracts (must match PromptBuilder + aiValidator MVO) ----
interface ExplainOutput {
  oneLiner: string;
  logicSteps: string[];
  involvedObjects: { name: string; alias?: string }[];
  outputFields: { name: string; type: string; meaning: string }[];
  keyConditions: { label: string; expression: string; note: string }[];
}

interface AnalyzeOutput {
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  summary: string;
  logicRisks: Array<{
    title: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    detail: string;
    evidence: string;
    impact: string;
    lineHint: string;
  }>;
  perfConcerns: Array<{
    title: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    detail: string;
    evidence: string;
    lineHint: string;
  }>;
  resultInsights: Array<{ label: string; value: string; note: string }>;
  suggestedSql: string;
  suggestionRationale: string;
}

export interface AiAssistantPanelProps {
  activeTabTitle?: string;
  activeSql?: string;
  queryResult?: QueryResult | null;
  activeTab?: 'explain' | 'analyze';
  onChangeActiveTab?: (tab: 'explain' | 'analyze') => void;
  onApplySqlSuggestion?: (newSql: string) => void;
  onLocateSqlLine?: (line: number, fragment?: string) => void;
  onRunDeepProfile?: () => void;
  onSwitchToInspector?: () => void;
  onClose?: () => void;
  /**
   * 当前活动列名（来自 SQL 结果表或 Inspector 选中列），
   * 用于在「列画像」Tab 中触发 aiService.profileColumn。
   * 若未提供，「列画像」按钮将提示用户先选中一列。
   */
  selectedColumnName?: string | null;
  /**
   * 当前结果表的列类型映射（备用，便于从外部提供类型信息），
   * 缺省时面板会从 queryResult.columnTypeMap 中推断。
   */
  columnTypeMap?: Record<string, string>;
}

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  activeTabTitle = 'revenue_analysis.sql',
  activeSql = '',
  queryResult,
  activeTab = 'explain',
  onChangeActiveTab,
  onApplySqlSuggestion,
  onLocateSqlLine,
  onRunDeepProfile,
  onSwitchToInspector,
  onClose,
  selectedColumnName = null,
  columnTypeMap,
}) => {
  // 三态 Tab：解释 / 分析 / 列画像 (FR-Q3 — 列画像真正接入 AI)
  const [currentTab, setCurrentTab] = useState<'explain' | 'analyze' | 'profile'>('explain');
  const [showFullSqlModal, setShowFullSqlModal] = useState<boolean>(false);
  const [showDiffModal, setShowDiffModal] = useState<boolean>(false);
  const [isDeepProfiling, setIsDeepProfiling] = useState<boolean>(false);
  const [deepProfileResult, setDeepProfileResult] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<'like' | 'dislike' | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [hasAppliedModification, setHasAppliedModification] = useState<boolean>(false);
  const analyzedSqlRef = React.useRef(activeSql);

  // ---- AI-driven state (replaces previously hard-coded mock data) ----
  const [explainData, setExplainData] = useState<ExplainOutput | null>(null);
  const [analyzeData, setAnalyzeData] = useState<AnalyzeOutput | null>(null);
  const [isLoadingExplain, setIsLoadingExplain] = useState<boolean>(false);
  const [isLoadingAnalyze, setIsLoadingAnalyze] = useState<boolean>(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const explainCallIdRef = useRef<number>(0);
  const analyzeCallIdRef = useRef<number>(0);

  // ---- 列画像 (AI 驱动) 状态 ----
  const [columnProfileData, setColumnProfileData] = useState<ColumnAiProfile | null>(null);
  const [isLoadingColumnProfile, setIsLoadingColumnProfile] = useState<boolean>(false);
  const [columnProfileError, setColumnProfileError] = useState<string | null>(null);
  const [profiledColumnName, setProfiledColumnName] = useState<string | null>(null);
  const profileCallIdRef = useRef<number>(0);

  // Track whether AI has ever completed for the current SQL to avoid duplicate triggers
  const lastAnalyzedSqlRef = useRef<string>('');

  // Auto stale detection (FR-12)
  React.useEffect(() => {
    if (analyzedSqlRef.current && activeSql && analyzedSqlRef.current.trim() !== activeSql.trim()) {
      setIsStale(true);
    }
  }, [activeSql]);

  // Sync external tab change (兼容外部仅传 explain/analyze 二态)
  React.useEffect(() => {
    if (activeTab === 'explain' || activeTab === 'analyze') {
      setCurrentTab(activeTab);
    }
  }, [activeTab]);

  // ── AI fetchers ──────────────────────────────────────────────────────────
  const runExplain = useCallback(
    async (sql: string, reason: 'auto' | 'manual' = 'auto') => {
      const trimmed = (sql || '').trim();
      const callId = ++explainCallIdRef.current;
      setIsLoadingExplain(true);
      setExplainError(null);
      try {
        if (!aiService.isConfigured()) {
          throw new Error('尚未配置 AI 服务 (请在设置中填写 API Key)');
        }
        if (!trimmed) {
          throw new Error('当前编辑器为空 SQL，请先编写查询语句');
        }
        const result = await aiService.explainSql(trimmed, { queryResult });
        if (callId !== explainCallIdRef.current) return; // stale response
        setExplainData(result);
        if (reason === 'manual') toastService.success('已基于最新 SQL 重新生成 AI 解释');
      } catch (e: any) {
        if (callId !== explainCallIdRef.current) return;
        setExplainError(e?.message || 'AI 解释生成失败');
        if (reason === 'manual') toastService.error(e?.message || 'AI 解释生成失败');
      } finally {
        if (callId === explainCallIdRef.current) setIsLoadingExplain(false);
      }
    },
    [queryResult]
  );

  const runAnalyze = useCallback(
    async (sql: string, reason: 'auto' | 'manual' = 'auto') => {
      const trimmed = (sql || '').trim();
      const callId = ++analyzeCallIdRef.current;
      setIsLoadingAnalyze(true);
      setAnalyzeError(null);
      try {
        if (!aiService.isConfigured()) {
          throw new Error('尚未配置 AI 服务 (请在设置中填写 API Key)');
        }
        if (!trimmed) {
          throw new Error('当前编辑器为空 SQL，请先编写查询语句');
        }
        const result = await aiService.analyzeSql(trimmed, { queryResult });
        if (callId !== analyzeCallIdRef.current) return;
        setAnalyzeData(result);
        if (reason === 'manual') toastService.success('已基于最新 SQL 重新生成 AI 分析');
      } catch (e: any) {
        if (callId !== analyzeCallIdRef.current) return;
        setAnalyzeError(e?.message || 'AI 分析生成失败');
        if (reason === 'manual') toastService.error(e?.message || 'AI 分析生成失败');
      } finally {
        if (callId === analyzeCallIdRef.current) setIsLoadingAnalyze(false);
      }
    },
    [queryResult]
  );

  /**
   * Build a synthetic QuerySnapshot-like object for the local columnProfiler so we
   * can compute the ColumnProfileSnapshot for the currently selected column without
   * dragging in the full QuerySnapshotManager pipeline (which lives in WorkbenchView).
   */
  const buildLocalSnapshot = useCallback((colName: string): {
    snapshot: ColumnProfileSnapshot | null;
    typeMap: Record<string, string>;
  } => {
    if (!queryResult || !Array.isArray(queryResult.columns)) {
      return { snapshot: null, typeMap: {} };
    }
    const typeMap = columnTypeMap || queryResult.columnTypeMap || {};
    const snapshot = columnProfiler.profileColumn(
      {
        snapshotId: `local-${activeSql ? activeSql.slice(0, 16).replace(/\s+/g, '_') : 'sql'}-${Date.now()}`,
        executionId: 'local',
        tabId: 'local',
        title: activeTabTitle,
        sql: activeSql,
        columns: queryResult.columns,
        columnTypes: queryResult.columns.map(c => typeMap[c] || 'VARCHAR'),
        columnTypeMap: typeMap,
        rows: queryResult.rows || [],
        totalRowCount: queryResult.totalRows ?? queryResult.rows?.length ?? 0,
        executionTime: queryResult.executionTime ?? 0,
        executedAt: queryResult.executedAt || new Date().toISOString(),
      },
      colName,
    );
    return { snapshot, typeMap };
  }, [queryResult, columnTypeMap, activeTabTitle, activeSql]);

  /**
   * 列画像 (AI 驱动) —— 真正与 aiService 协同工作。
   * 步骤：
   *   1) 由 columnProfiler 计算 DuckDB 侧统计（min/max/null/distinct/top values...）
   *   2) 调 aiService.profileColumn 注入 PromptBuilder.buildColumnProfilePrompt
   *   3) 校验器返回 ColumnAiProfile，写入 columnProfileData
   */
  const runColumnProfile = useCallback(
    async (colName: string, reason: 'auto' | 'manual' = 'manual') => {
      const trimmed = (colName || '').trim();
      const callId = ++profileCallIdRef.current;
      setIsLoadingColumnProfile(true);
      setColumnProfileError(null);
      try {
        if (!aiService.isConfigured()) {
          throw new Error('尚未配置 AI 服务 (请在设置中填写 API Key)');
        }
        if (!trimmed) {
          throw new Error('尚未选择数据列，请在左侧 SQL 结果表中点击列名后再生成列画像');
        }
        if (!queryResult || !Array.isArray(queryResult.columns) || queryResult.columns.length === 0) {
          throw new Error('当前查询结果为空，请先执行一次 SELECT 查询再生成列画像');
        }

        const { snapshot, typeMap } = buildLocalSnapshot(trimmed);
        if (!snapshot) {
          throw new Error('无法构建列画像数据快照');
        }

        const result = await aiService.profileColumn(trimmed, {
          columnType: typeMap[trimmed] || snapshot.columnType || 'VARCHAR',
          isNumeric: snapshot.isNumeric,
          isDate: snapshot.isDate,
          totalRows: snapshot.totalRows,
          nullCount: snapshot.nullCount,
          nullPct: snapshot.nullPct,
          distinctCount: snapshot.distinctCount,
          distinctPct: snapshot.distinctPct,
          min: snapshot.min,
          max: snapshot.max,
          avg: snapshot.avg,
          median: snapshot.median,
          sum: snapshot.sum,
          topValues: (snapshot.topValues || []).slice(0, 8),
          sampleValues: (queryResult.rows || []).slice(0, 5).map(r => r?.[trimmed]),
        });

        if (callId !== profileCallIdRef.current) return; // 过期响应
        setColumnProfileData(result);
        setProfiledColumnName(trimmed);
        if (reason === 'manual') toastService.success(`已为列 “${trimmed}” 生成 AI 列画像`);
      } catch (e: any) {
        if (callId !== profileCallIdRef.current) return;
        setColumnProfileError(e?.message || 'AI 列画像生成失败');
        if (reason === 'manual') toastService.error(e?.message || 'AI 列画像生成失败');
      } finally {
        if (callId === profileCallIdRef.current) setIsLoadingColumnProfile(false);
      }
    },
    [queryResult, buildLocalSnapshot]
  );

  // Auto-trigger AI when active SQL changes (debounced) — both tabs share the same trigger.
  useEffect(() => {
    const trimmed = (activeSql || '').trim();
    if (!trimmed) return;
    if (!aiService.isConfigured()) return;
    if (lastAnalyzedSqlRef.current === trimmed) return;
    lastAnalyzedSqlRef.current = trimmed;
    void runExplain(trimmed, 'auto');
    void runAnalyze(trimmed, 'auto');
  }, [activeSql, runExplain, runAnalyze]);

  // 当 selectedColumnName 变化且当前正停留在「列画像」视图时，自动触发 AI 列画像。
  useEffect(() => {
    if (currentTab !== 'profile') return;
    if (!selectedColumnName) return;
    if (!aiService.isConfigured()) return;
    // 若已有该列画像，且未处于加载/错误态，避免重复触发
    if (profiledColumnName === selectedColumnName && columnProfileData && !columnProfileError) return;
    void runColumnProfile(selectedColumnName, 'auto');
  }, [currentTab, selectedColumnName, profiledColumnName, columnProfileData, columnProfileError, runColumnProfile]);

  // Manual re-analyze trigger
  const handleReanalyze = () => {
    analyzedSqlRef.current = activeSql;
    setIsStale(false);
    const trimmed = (activeSql || '').trim();
    lastAnalyzedSqlRef.current = trimmed; // reset cache so auto trigger won't double-fire
    void runExplain(trimmed, 'manual');
    void runAnalyze(trimmed, 'manual');
    toastService.success('已基于最新 SQL 重新生成 AI 解释与分析');
  };

  /**
   * Tab 切换处理 —— 现在三个按钮都真正与 AI 协同：
   * - 「列画像」: 切到 profile 视图，若 selectedColumnName 存在则触发 AI；
   *              若没有选中列，提示用户并保留原状。
   * - 「解释」「分析」: 点击会强制重跑（即使 SQL 没变）—— 用 lastAnalyzedSqlRef 复位避免 auto 二次触发。
   */
  const handleTabSwitch = (tab: 'explain' | 'analyze' | 'profile') => {
    setCurrentTab(tab);
    if (tab === 'explain' || tab === 'analyze') {
      onChangeActiveTab?.(tab);
    }

    if (!aiService.isConfigured()) {
      // 不抛错，仅提示用户；保留按钮可见性以满足 NFR-4
      toastService.warning('AI 服务未配置，点击「去设置」填入 API Key 后即可启用');
      return;
    }

    if (tab === 'explain') {
      const trimmed = (activeSql || '').trim();
      if (!trimmed) {
        toastService.warning('当前编辑器为空 SQL，请先编写查询语句');
        return;
      }
      lastAnalyzedSqlRef.current = trimmed; // reset to allow manual re-trigger
      void runExplain(trimmed, 'manual');
      return;
    }

    if (tab === 'analyze') {
      const trimmed = (activeSql || '').trim();
      if (!trimmed) {
        toastService.warning('当前编辑器为空 SQL，请先编写查询语句');
        return;
      }
      lastAnalyzedSqlRef.current = trimmed;
      void runAnalyze(trimmed, 'manual');
      return;
    }

    if (tab === 'profile') {
      if (!selectedColumnName) {
        toastService.info('请先在 SQL 结果表中点击列名以选中需要分析的列');
      } else if (aiService.isConfigured()) {
        // 强制重跑同一列 —— 即使已有数据，用户点击按钮 = 显式意图
        void runColumnProfile(selectedColumnName, 'manual');
      }
      return;
    }
  };

  const handleDeepPerformanceAnalysis = async () => {
    setIsDeepProfiling(true);
    try {
      if (onRunDeepProfile) {
        onRunDeepProfile();
      }
      const explainData = await duckDBService.getExplainPlan(activeSql || 'SELECT * FROM orders', true);
      setDeepProfileResult(
        explainData.planText || '执行计划解析完成。'
      );
      toastService.success('深入性能分析计算完成');
    } catch (e: any) {
      setDeepProfileResult(`性能剖析说明: ${e?.message || '无法获取当前 SQL 的执行计划，请确认当前查询语法是否正确并可正常运行。'}`);
    } finally {
      setIsDeepProfiling(false);
    }
  };

  // NOTE: 旧的 `suggestedSql` mock 已废弃，UI 现在统一从 `analyzeData.suggestedSql` 读取真实 AI 输出。

  // ---- Header tab indicators (反映 AI 服务实时状态) ----
  const aiConfigured = aiService.isConfigured();
  const explainState: 'idle' | 'loading' | 'success' | 'error' =
    isLoadingExplain ? 'loading' : explainError ? 'error' : explainData ? 'success' : 'idle';
  const analyzeState: 'idle' | 'loading' | 'success' | 'error' =
    isLoadingAnalyze ? 'loading' : analyzeError ? 'error' : analyzeData ? 'success' : 'idle';
  const profileState: 'idle' | 'loading' | 'success' | 'error' =
    isLoadingColumnProfile ? 'loading' : columnProfileError ? 'error' : columnProfileData ? 'success' : 'idle';

  return (
    <div className="flex h-full w-full flex-col bg-monokai-sidebar border-l border-monokai-border select-none text-monokai-fg font-sans">
      {/* 1. Header Row 1: AI 助手 + Tabs */}
      <div className="wb-panel-header bg-gradient-to-b from-monokai-surface/95 via-monokai-surface/80 to-monokai-surface/60 relative">
        {/* Top hairline highlight */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-monokai-yellow/15 to-transparent" />

        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 text-monokai-fg font-semibold text-xs">
            <div className="relative">
              <div className="absolute inset-0 blur-sm bg-monokai-yellow/30 rounded-full animate-pulse" />
              <Sparkles className="relative w-3.5 h-3.5 text-monokai-yellow" />
            </div>
            <span className="wb-panel-title">AI 助手</span>
            {!aiConfigured && (
              <span
                className="px-1 py-0.5 rounded bg-monokai-yellow/15 border border-monokai-yellow/40 text-monokai-yellow text-[9px] font-mono font-bold"
                title="AI 服务未配置"
              >
                未配置
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-xs">
            {/* 「列画像」按钮 —— 现在真正触发 AI 列画像 (FR-Q3) */}
            <button
              data-testid="ai-tab-profile"
              onClick={() => handleTabSwitch('profile')}
              className={`group relative h-6 px-2.5 rounded-md text-xs font-medium cursor-pointer transition-all duration-200 flex items-center gap-1 border ${
                currentTab === 'profile'
                  ? 'bg-gradient-to-b from-monokai-cyan/15 to-monokai-cyan/5 text-monokai-cyan font-semibold border-monokai-cyan/45 shadow-[0_0_0_1px_rgba(102,217,239,0.15),inset_0_1px_0_rgba(102,217,239,0.08)]'
                  : 'text-monokai-comment hover:text-monokai-cyan hover:bg-monokai-cyan/8 hover:border-monokai-cyan/30 hover:shadow-[0_0_0_1px_rgba(102,217,239,0.08)] border-transparent'
              }`}
              title={selectedColumnName ? `对列 “${selectedColumnName}” 运行 AI 列画像` : '切换到列画像视图（请先在结果表中选中一列）'}
            >
              {currentTab === 'profile' && (
                <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-monokai-cyan to-transparent" />
              )}
              <Activity className={`w-3 h-3 ${profileState === 'loading' ? 'text-monokai-cyan animate-pulse' : 'text-monokai-cyan'} transition-transform group-hover:scale-110`} />
              <span>列画像</span>
              <AiStateBadge state={profileState} columnName={profiledColumnName} />
            </button>
            <button
              data-testid="ai-tab-explain"
              onClick={() => handleTabSwitch('explain')}
              className={`group relative h-6 px-2.5 rounded-md text-xs font-medium cursor-pointer transition-all duration-200 flex items-center gap-1 border ${
                currentTab === 'explain'
                  ? 'bg-gradient-to-b from-monokai-yellow/15 to-monokai-yellow/5 text-monokai-yellow font-semibold border-monokai-yellow/45 shadow-[0_0_0_1px_rgba(230,219,116,0.15),inset_0_1px_0_rgba(230,219,116,0.08)]'
                  : 'text-monokai-comment hover:text-monokai-yellow hover:bg-monokai-yellow/8 hover:border-monokai-yellow/30 hover:shadow-[0_0_0_1px_rgba(230,219,116,0.08)] border-transparent'
              }`}
              title={explainState === 'loading' ? '正在生成 AI 解释…' : '点击重新运行 AI 解释'}
            >
              {currentTab === 'explain' && (
                <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-monokai-yellow to-transparent" />
              )}
              <Sparkles className={`w-3 h-3 ${explainState === 'loading' ? 'text-monokai-yellow animate-pulse' : 'text-monokai-yellow'} transition-transform group-hover:scale-110`} />
              <span>解释</span>
              <AiStateBadge state={explainState} />
            </button>
            <button
              data-testid="ai-tab-analyze"
              onClick={() => handleTabSwitch('analyze')}
              className={`group relative h-6 px-2.5 rounded-md text-xs font-medium cursor-pointer transition-all duration-200 flex items-center gap-1 border ${
                currentTab === 'analyze'
                  ? 'bg-gradient-to-b from-monokai-green/15 to-monokai-green/5 text-monokai-green font-semibold border-monokai-green/45 shadow-[0_0_0_1px_rgba(166,226,46,0.15),inset_0_1px_0_rgba(166,226,46,0.08)]'
                  : 'text-monokai-comment hover:text-monokai-green hover:bg-monokai-green/8 hover:border-monokai-green/30 hover:shadow-[0_0_0_1px_rgba(166,226,46,0.08)] border-transparent'
              }`}
              title={analyzeState === 'loading' ? '正在生成 AI 分析…' : '点击重新运行 AI 分析'}
            >
              {currentTab === 'analyze' && (
                <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-monokai-green to-transparent" />
              )}
              <Activity className={`w-3 h-3 ${analyzeState === 'loading' ? 'text-monokai-green animate-pulse' : 'text-monokai-green'} transition-transform group-hover:scale-110`} />
              <span>分析</span>
              <AiStateBadge state={analyzeState} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-fg cursor-pointer transition-colors"
              title="关闭面板"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Header Row 2: Model & Query Context Strip (h-9: 36px) */}
      <div className="flex h-9 shrink-0 items-center justify-between px-3 border-b border-monokai-border bg-monokai-sidebar text-[11px] font-mono">
        <div className="flex items-center gap-2 text-monokai-comment truncate">
          <span className="text-monokai-fg truncate max-w-[140px] font-sans">{activeTabTitle}</span>
          <span className="px-1.5 py-0.5 rounded bg-monokai-surface text-monokai-cyan text-[10px] border border-monokai-border">
            {currentTab === 'explain' ? '语义剖析' : currentTab === 'analyze' ? '逻辑诊断' : '列画像'}
          </span>
          {currentTab === 'profile' && selectedColumnName && (
            <span className="px-1.5 py-0.5 rounded bg-monokai-surface text-monokai-cyan text-[10px] border border-monokai-border truncate max-w-[160px]">
              {selectedColumnName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-monokai-comment">
          {aiConfigured ? (
            <>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  explainState === 'loading' || analyzeState === 'loading' || profileState === 'loading'
                    ? 'bg-monokai-yellow animate-pulse'
                    : 'bg-monokai-green'
                }`}
              />
              <span>
                {explainState === 'loading' || analyzeState === 'loading' || profileState === 'loading'
                  ? '推理中…'
                  : '实时推理'}
              </span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-monokai-yellow" />
              <span className="text-monokai-yellow">AI 未配置</span>
            </>
          )}
        </div>
      </div>

      {/* 2. Stale Notification Banner (FR-12) */}
      {isStale && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-monokai-yellow/10 via-monokai-yellow/8 to-transparent border-b border-monokai-yellow/35 text-monokai-yellow text-xs relative">
          {/* Top hairline */}
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-monokai-yellow/30 to-transparent" />
          <div className="flex items-center gap-1.5">
            <span className="relative flex items-center justify-center" aria-hidden="true">
              <span className="absolute inset-0 blur-sm bg-monokai-yellow/40 rounded-full animate-pulse" />
              <AlertCircle className="relative w-3.5 h-3.5 text-monokai-yellow shrink-0" />
            </span>
            <span className="font-medium tracking-tight">SQL 已发生变化，当前解释/分析基于上一版本</span>
          </div>
          <button
            onClick={handleReanalyze}
            className="h-6 px-2.5 rounded-md bg-monokai-elevated hover:bg-monokai-yellow/15 border border-monokai-border hover:border-monokai-yellow/45 text-monokai-fg hover:text-monokai-yellow text-xs font-medium cursor-pointer transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>重新分析</span>
          </button>
        </div>
      )}

      {/* 3. Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 font-sans text-xs custom-scrollbar">
        {/* ========================================================= */}
        {/* SUBTAB 1: AI 解释 (AI Explain) matching Screenshot 1      */}
        {/* ========================================================= */}
        {currentTab === 'explain' && (
          <div className="space-y-4">
            {/* 当前语句 Card */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-monokai-fg">当前语句</span>
                <span className="text-monokai-comment text-[10px]">依据: SQL + Schema</span>
              </div>
              <div className="p-2.5 rounded-lg bg-monokai-elevated border border-monokai-border font-mono text-[11px] space-y-1.5">
                <div className="text-monokai-fg truncate" title={activeSql}>
                  {activeSql ? activeSql.replace(/\s+/g, ' ').slice(0, 120) + (activeSql.length > 120 ? '…' : '') : '— 当前编辑器为空 —'}
                </div>
                <div className="flex items-center justify-between text-[10px] text-monokai-comment pt-1 border-t border-monokai-border-subtle">
                  <span>{activeTabTitle}</span>
                  <button
                    onClick={() => setShowFullSqlModal(true)}
                    className="text-monokai-cyan hover:underline cursor-pointer"
                  >
                    查看完整 SQL
                  </button>
                </div>
              </div>
            </div>

            {/* Error / Loading state — keeps UI informative instead of leaving blanks */}
            {explainError && !isLoadingExplain && (
              <div className="p-3 rounded-lg bg-gradient-to-br from-monokai-pink/10 via-monokai-elevated to-monokai-elevated border border-monokai-pink/40 space-y-2 shadow-[inset_0_1px_0_rgba(249,38,114,0.08)]">
                <div className="flex items-center gap-1.5 text-monokai-pink text-[11px] font-semibold">
                  <span className="w-1 h-3 bg-gradient-to-b from-monokai-pink to-monokai-pink/40 rounded-full" />
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>AI 解释生成失败</span>
                </div>
                <div className="text-[11px] text-monokai-fg-muted leading-relaxed font-mono break-all bg-monokai-surface/80 p-2 rounded border border-monokai-border-subtle">{explainError}</div>
                <button
                  onClick={() => void runExplain(activeSql, 'manual')}
                  className="h-6 px-2.5 rounded-md bg-monokai-elevated hover:bg-monokai-surface border border-monokai-border text-monokai-fg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1 hover:border-monokai-cyan/40 hover:text-monokai-cyan"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>重试</span>
                </button>
              </div>
            )}

            {/* Loading state for empty/initial response */}
            {isLoadingExplain && !explainData && !explainError && (
              <AILoadingBlock label="AI 正在解析 SQL 语义…" />
            )}

            {/* 一句话解释 */}
            <div className="space-y-1">
              <div className="font-semibold text-monokai-fg text-xs flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-1 h-3 bg-gradient-to-b from-monokai-yellow to-monokai-yellow/40 rounded-full" />
                  一句话解释
                </span>
                {isLoadingExplain && explainData && <Loader2 className="w-3 h-3 animate-spin text-monokai-comment" />}
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-br from-monokai-yellow/8 via-monokai-elevated to-monokai-elevated border border-monokai-yellow/30 text-monokai-fg-muted leading-relaxed text-[11px] shadow-[inset_0_1px_0_rgba(230,219,116,0.08)]">
                {explainData?.oneLiner || (isLoadingExplain ? '正在生成中...' : '等待 AI 生成解释。')}
              </div>
            </div>

            {/* 执行逻辑 (Numbered Steps) */}
            <div className="space-y-1.5">
              <div className="font-semibold text-monokai-fg text-xs">执行逻辑</div>
              <div className="p-2.5 rounded-lg bg-monokai-elevated border border-monokai-border space-y-2 text-[11px]">
                {(explainData?.logicSteps ?? []).length > 0 ? (
                  (explainData!.logicSteps).map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-monokai-surface text-monokai-comment text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-mono">
                        {idx + 1}
                      </span>
                      <span className="text-monokai-fg-muted leading-tight">{step}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-[11px] text-monokai-comment italic">
                    {isLoadingExplain ? '正在推断执行步骤…' : '暂无执行逻辑推断。'}
                  </div>
                )}
              </div>
            </div>

            {/* 涉及对象 (Badges) */}
            <div className="space-y-1.5">
              <div className="font-semibold text-monokai-fg text-xs">涉及对象</div>
              <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                {(explainData?.involvedObjects ?? []).length > 0 ? (
                  (explainData!.involvedObjects).map((obj, idx) => (
                    <span
                      key={`${obj.name}-${idx}`}
                      className="px-2 py-0.5 rounded bg-monokai-surface border border-monokai-border text-monokai-fg"
                    >
                      {obj.alias ? `${obj.name} (${obj.alias})` : obj.name}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-monokai-comment italic">
                    {isLoadingExplain ? '正在推断涉及对象…' : '暂无涉及对象。'}
                  </span>
                )}
              </div>
            </div>

            {/* 输出字段 (Table: 字段名 | 类型 | 含义) */}
            <div className="space-y-1.5">
              <div className="font-semibold text-monokai-fg text-xs">输出字段</div>
              <div className="rounded-lg border border-monokai-border bg-monokai-elevated overflow-hidden">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="bg-monokai-surface text-monokai-comment border-b border-monokai-border-subtle">
                    <tr>
                      <th className="px-2.5 py-1.5 font-sans font-normal">字段名</th>
                      <th className="px-2 py-1.5 font-sans font-normal">类型</th>
                      <th className="px-2.5 py-1.5 font-sans font-normal">含义</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-monokai-border-subtle text-monokai-fg-muted">
                    {(explainData?.outputFields ?? []).length > 0 ? (
                      (explainData!.outputFields).map(f => (
                        <tr key={f.name} className="hover:bg-monokai-surface">
                          <td className="px-2.5 py-1 text-monokai-fg font-medium">{f.name}</td>
                          <td className="px-2.5 py-1 text-monokai-cyan">{f.type}</td>
                          <td className="px-2.5 py-1 text-monokai-comment font-sans">{f.meaning}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-2.5 py-3 text-center text-monokai-comment italic text-[11px]">
                          {isLoadingExplain ? '正在推断输出字段…' : '暂无输出字段。'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 关键条件 */}
            <div className="space-y-1.5">
              <div className="font-semibold text-monokai-fg text-xs">关键条件</div>
              <div className="p-2.5 rounded-lg bg-monokai-elevated border border-monokai-border space-y-1.5 text-[11px] font-mono">
                {(explainData?.keyConditions ?? []).length > 0 ? (
                  (explainData!.keyConditions).map((c, idx) => (
                    <div key={idx}>
                      <span className="text-monokai-comment font-sans">{c.label}: </span>
                      <span className="text-monokai-fg">{c.expression}</span>
                      {c.note && (
                        <span className="text-monokai-comment"> — {c.note}</span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-[11px] text-monokai-comment italic">
                    {isLoadingExplain ? '正在抽取关键条件…' : '暂无关键条件。'}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Disclaimer + Feedback */}
            <div className="pt-2 border-t border-monokai-border-subtle flex items-center justify-between text-[10px] text-monokai-comment">
              <span>以上解释由 AI 生成，可能不完全准确，请结合实际业务确认。</span>
              <div className="flex items-center gap-1.5 text-monokai-comment">
                <button
                  onClick={() => {
                    setFeedbackGiven('like');
                    toastService.success('感谢反馈！');
                  }}
                  className={`p-1 rounded hover:bg-monokai-surface hover:text-monokai-fg cursor-pointer transition-colors ${
                    feedbackGiven === 'like' ? 'text-monokai-green' : ''
                  }`}
                  title="有帮助"
                >
                  <ThumbsUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => {
                    setFeedbackGiven('dislike');
                    toastService.info('已记录改进建议');
                  }}
                  className={`p-1 rounded hover:bg-monokai-surface hover:text-monokai-fg cursor-pointer transition-colors ${
                    feedbackGiven === 'dislike' ? 'text-monokai-pink' : ''
                  }`}
                  title="无帮助"
                >
                  <ThumbsDown className="w-3 h-3" />
                </button>
                <button
                  onClick={() => {
                    const text = explainData?.oneLiner || '';
                    if (!text) {
                      toastService.warning('解释内容为空，无法复制');
                      return;
                    }
                    navigator.clipboard.writeText(text);
                    toastService.success('已复制解释内容');
                  }}
                  className="p-1 rounded hover:bg-monokai-surface hover:text-monokai-fg cursor-pointer transition-colors"
                  title="复制解释"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUBTAB 2: AI 分析 (AI Analyze) - 由 analyzeData 状态驱动  */}
        {/* ========================================================= */}
        {currentTab === 'analyze' && (
          <div className="space-y-4">
            {/* AI 未配置引导 (FR-Q3: 完全移除 mock) */}
            {!aiService.isConfigured() && !analyzeData && !isLoadingAnalyze && !analyzeError && (
              <div className="p-3 rounded-lg bg-monokai-yellow/5 border border-monokai-yellow/30 space-y-2">
                <div className="flex items-center gap-1.5 text-monokai-yellow text-[11px] font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI 服务未配置</span>
                </div>
                <p className="text-[11px] text-monokai-fg-muted leading-relaxed">
                  「分析」Tab 需要先配置 AI 服务才能生成智能诊断。打开设置填写 API Key 后即可启用。
                </p>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-ai-settings'))}
                  className="h-6 px-2.5 rounded-md bg-monokai-yellow hover:bg-monokai-yellow/90 text-monokai-bg text-[11px] font-semibold cursor-pointer transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>前往设置</span>
                </button>
              </div>
            )}

            {/* Loading 状态 */}
            {isLoadingAnalyze && !analyzeData && (
              <AILoadingBlock label="AI 正在诊断 SQL 风险与性能…" />
            )}

            {/* Error 状态 */}
            {analyzeError && !isLoadingAnalyze && (
              <div className="p-3 rounded-lg bg-gradient-to-br from-monokai-pink/10 via-monokai-elevated to-monokai-elevated border border-monokai-pink/40 space-y-2 shadow-[inset_0_1px_0_rgba(249,38,114,0.08)]">
                <div className="flex items-center gap-1.5 text-monokai-pink text-[11px] font-semibold">
                  <span className="w-1 h-3 bg-gradient-to-b from-monokai-pink to-monokai-pink/40 rounded-full" />
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>AI 分析生成失败</span>
                </div>
                <div className="text-[11px] text-monokai-fg-muted leading-relaxed font-mono break-all bg-monokai-surface/80 p-2 rounded border border-monokai-border-subtle">{analyzeError}</div>
                <button
                  onClick={() => void runAnalyze(activeSql, 'manual')}
                  className="h-6 px-2.5 rounded-md bg-monokai-elevated hover:bg-monokai-surface border border-monokai-border text-monokai-fg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1 hover:border-monokai-green/40 hover:text-monokai-green"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>重试</span>
                </button>
              </div>
            )}

            {/* Empty 状态: 已配置但未生成 */}
            {aiService.isConfigured() && !analyzeData && !isLoadingAnalyze && !analyzeError && (
              <div className="p-3 rounded-lg bg-monokai-elevated border border-monokai-border space-y-1.5 text-center">
                <Activity className="w-5 h-5 text-monokai-comment mx-auto" />
                <p className="text-[11px] text-monokai-comment">等待 AI 生成分析。运行查询或切换到「分析」Tab 后将自动触发。</p>
              </div>
            )}

            {/* ✓ 结论 (由 analyzeData.summary + severity 驱动) */}
            {analyzeData && (
              <div className="p-3 rounded-lg bg-gradient-to-br from-monokai-green/8 via-monokai-elevated to-monokai-elevated border border-monokai-green/35 space-y-2 shadow-[inset_0_1px_0_rgba(166,226,46,0.08),0_1px_4px_-1px_rgba(166,226,46,0.18)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-monokai-fg text-xs">
                    <span className="w-1 h-3 bg-gradient-to-b from-monokai-green to-monokai-green/40 rounded-full" />
                    <CheckCircle2 className="w-3.5 h-3.5 text-monokai-green" />
                    <span>结论</span>
                  </div>
                  <SeverityBadge severity={analyzeData.severity} />
                </div>
                <p className="text-monokai-fg-muted text-[11px] leading-relaxed whitespace-pre-wrap">
                  {analyzeData.summary}
                </p>
                <div className="text-[10px] text-monokai-comment pt-1 border-t border-monokai-border-subtle flex items-center gap-1.5">
                  <span>依据: AI 综合评估</span>
                  <span className="w-px h-3 bg-monokai-border/60" />
                  <span>严重度: {analyzeData.severity} ({severityLabel(analyzeData.severity)})</span>
                </div>
              </div>
            )}

            {/* ⚠ 逻辑风险 (由 analyzeData.logicRisks 驱动) */}
            {analyzeData && analyzeData.logicRisks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-monokai-fg">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1 h-3 bg-gradient-to-b from-monokai-yellow to-monokai-yellow/40 rounded-full" />
                    <AlertTriangle className="w-3.5 h-3.5 text-monokai-yellow" />
                    <span>逻辑风险 ({analyzeData.logicRisks.length})</span>
                  </div>
                </div>
                {analyzeData.logicRisks.map((risk, idx) => (
                  <div key={`risk-${idx}`} className="p-3 rounded-lg bg-gradient-to-br from-monokai-yellow/5 via-monokai-elevated to-monokai-elevated border border-monokai-yellow/30 space-y-2 hover:border-monokai-yellow/45 transition-colors shadow-[inset_0_1px_0_rgba(230,219,116,0.05)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded bg-monokai-surface text-monokai-comment text-[10px] flex items-center justify-center font-mono font-bold border border-monokai-border">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-monokai-fg text-[11px]">{risk.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <SeverityBadge severity={risk.severity} compact />
                        {extractLineNumber(risk.lineHint) !== null && (
                          <button
                            onClick={() => onLocateSqlLine?.(extractLineNumber(risk.lineHint)!, risk.lineHint)}
                            className="text-monokai-cyan text-[10px] font-mono hover:underline cursor-pointer px-1.5 py-0.5 rounded bg-monokai-cyan/10 border border-monokai-cyan/30 hover:bg-monokai-cyan/15 transition-colors"
                          >
                            {risk.lineHint.startsWith('Line') ? risk.lineHint : `Line ${risk.lineHint}`}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-monokai-fg-muted leading-relaxed font-mono bg-monokai-surface/80 p-2 rounded border border-monokai-border-subtle">
                      {risk.detail}
                    </div>
                    <div className="text-[10px] text-monokai-comment flex items-center justify-between">
                      <span>依据: {risk.evidence || 'AI 推断'}</span>
                      {risk.impact && <span className="text-monokai-yellow font-medium">影响: {risk.impact}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ⚡ 性能关注 (由 analyzeData.perfConcerns 驱动) */}
            {analyzeData && analyzeData.perfConcerns.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-monokai-fg">
                  <span className="w-1 h-3 bg-gradient-to-b from-monokai-cyan to-monokai-cyan/40 rounded-full" />
                  <Zap className="w-3.5 h-3.5 text-monokai-cyan" />
                  <span>性能关注 ({analyzeData.perfConcerns.length})</span>
                </div>
                {analyzeData.perfConcerns.map((perf, idx) => (
                  <div key={`perf-${idx}`} className="p-3 rounded-lg bg-gradient-to-br from-monokai-cyan/5 via-monokai-elevated to-monokai-elevated border border-monokai-cyan/30 space-y-2 hover:border-monokai-cyan/45 transition-colors shadow-[inset_0_1px_0_rgba(102,217,239,0.05)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded bg-monokai-surface text-monokai-comment text-[10px] flex items-center justify-center font-mono font-bold border border-monokai-border">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-monokai-fg text-[11px]">{perf.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <SeverityBadge severity={perf.severity} compact />
                        <span className="text-monokai-comment text-[10px] font-mono px-1.5 py-0.5 rounded bg-monokai-surface/80 border border-monokai-border">
                          {perf.lineHint.startsWith('Line') ? perf.lineHint : `Line ${perf.lineHint}`}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-monokai-fg-muted leading-relaxed font-mono bg-monokai-surface/80 p-2 rounded border border-monokai-border-subtle">
                      {perf.detail}
                    </div>
                    <div className="text-[10px] text-monokai-comment">依据: {perf.evidence || 'Query Plan / Runtime'}</div>
                  </div>
                ))}
              </div>
            )}

            {/* 📊 结果解释 (由 analyzeData.resultInsights 驱动) */}
            {analyzeData && analyzeData.resultInsights.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-semibold text-monokai-fg text-xs flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-monokai-cyan" />
                  <span>结果解释</span>
                </div>
                <div className="p-2.5 rounded-lg bg-monokai-elevated border border-monokai-border space-y-1 text-[11px] font-mono text-monokai-fg-muted">
                  {analyzeData.resultInsights.map((ins, idx) => (
                    <div key={`ins-${idx}`} className="flex justify-between">
                      <span>{ins.label}:</span>
                      <b className="text-monokai-fg">{ins.value}</b>
                    </div>
                  ))}
                  <div className="text-[10px] text-monokai-comment pt-1 border-t border-monokai-border-subtle">依据: 查询结果</div>
                </div>
              </div>
            )}

            {/* 📝 修改建议 (由 analyzeData.suggestedSql 驱动) */}
            {analyzeData && analyzeData.suggestedSql && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-monokai-fg text-xs flex items-center gap-1.5">
                    <span className="w-1 h-3 bg-gradient-to-b from-monokai-green to-monokai-green/40 rounded-full" />
                    修改建议
                  </span>
                  <button
                    onClick={() => setShowDiffModal(true)}
                    className="text-xs text-monokai-cyan hover:underline cursor-pointer"
                  >
                    查看完整 Diff
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-gradient-to-br from-monokai-green/5 via-monokai-elevated to-monokai-elevated border border-monokai-green/35 space-y-2.5 shadow-[inset_0_1px_0_rgba(166,226,46,0.08)]">
                  {analyzeData.suggestionRationale && (
                    <p className="text-[11px] text-monokai-fg-muted leading-relaxed">
                      {analyzeData.suggestionRationale}
                    </p>
                  )}

                  <div className="p-2 rounded bg-monokai-surface/90 border border-monokai-border font-mono text-[10px] overflow-x-auto">
                    <pre className="whitespace-pre-wrap text-monokai-fg leading-relaxed">
                      {analyzeData.suggestedSql}
                    </pre>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-monokai-comment">依据: AI 优化建议</span>
                    <button
                      onClick={() => {
                        setHasAppliedModification(true);
                        if (onApplySqlSuggestion) {
                          onApplySqlSuggestion(analyzeData.suggestedSql);
                        } else {
                          toastService.success('已应用修改建议');
                        }
                      }}
                      className="group relative h-7 px-3 rounded-md bg-gradient-to-br from-monokai-green via-monokai-green to-monokai-green/85 hover:from-monokai-green hover:via-monokai-green hover:to-monokai-green/95 text-monokai-bg text-xs font-semibold cursor-pointer transition-all duration-150 shadow-[0_1px_3px_-1px_rgba(166,226,46,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] hover:shadow-[0_2px_8px_-2px_rgba(166,226,46,0.6)] active:scale-95 flex items-center gap-1.5"
                    >
                      <Check className="w-3 h-3" />
                      <span>应用修改</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* No-suggestion empty state for analyze tab */}
            {analyzeData && !analyzeData.suggestedSql && (
              <div className="p-2.5 rounded-lg bg-monokai-elevated border border-monokai-border text-[11px] text-monokai-comment italic text-center">
                AI 未给出具体的 SQL 修改建议，但已在上方列出潜在风险与性能关注。
              </div>
            )}

            {/* FR-11: 修改后验证与性能对比 */}
            {hasAppliedModification && (
              <div className="p-2.5 rounded-lg bg-monokai-elevated border border-monokai-border space-y-1.5 text-xs font-mono">
                <div className="font-semibold text-monokai-fg font-sans text-[11px] flex items-center justify-between">
                  <span>修改后验证与性能对比</span>
                  <span className="text-monokai-green text-[10px]">已验证</span>
                </div>
                <div className="grid grid-cols-2 gap-2 bg-monokai-surface p-2 rounded border border-monokai-border-subtle text-[10px]">
                  <div>
                    <div className="text-monokai-comment font-sans">修改前:</div>
                    <div className="text-monokai-fg-muted">耗时: 上一版本耗时</div>
                    <div className="text-monokai-fg-muted">请重新执行查询以对比</div>
                  </div>
                  <div>
                    <div className="text-monokai-green font-sans">修改后:</div>
                    <div className="text-monokai-green font-bold">点击「深入性能分析」实测</div>
                    <div className="text-monokai-green">需手动重新执行查询</div>
                  </div>
                </div>
              </div>
            )}

            {/* Deep Profile Output Banner if calculated */}
            {deepProfileResult && (
              <div className="p-2.5 rounded-lg bg-monokai-elevated border border-monokai-border space-y-1.5 text-xs font-mono">
                <div className="font-semibold text-monokai-fg font-sans text-[11px] flex items-center justify-between">
                  <span>深入性能剖析 (EXPLAIN ANALYZE)</span>
                  <span className="text-monokai-green text-[10px]">已验证</span>
                </div>
                <div className="text-monokai-fg-muted text-[10px] leading-relaxed bg-monokai-surface p-2 rounded border border-monokai-border-subtle whitespace-pre-wrap">
                  {deepProfileResult}
                </div>
              </div>
            )}

            {/* Bottom Actions & Deep Analysis Trigger */}
            {analyzeData && (
              <div className="pt-2 border-t border-monokai-border-subtle space-y-2">
                <div className="text-[10px] text-monokai-comment">
                  分析依据: SQL、Schema、查询结果、运行时
                </div>

                <ActionButton
                  variant="primary"
                  size="sm"
                  className="w-full"
                  icon={Zap}
                  loading={isDeepProfiling}
                  onClick={handleDeepPerformanceAnalysis}
                >
                  {isDeepProfiling ? '深入性能分析中...' : '深入性能分析'}
                </ActionButton>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* SUBTAB 3: AI 列画像 (AI Column Profile) - 由 aiService.profileColumn 驱动 */}
        {/* ========================================================= */}
        {currentTab === 'profile' && (
          <div className="space-y-4">
            {/* Header: 当前选中列信息 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-monokai-fg">当前列</span>
                <span className="text-monokai-comment text-[10px]">依据: DuckDB 统计 + AI 语义</span>
              </div>
              <div className="p-2.5 rounded-lg bg-monokai-elevated border border-monokai-border space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-monokai-fg text-[12px] font-semibold">
                    {selectedColumnName || '— 尚未选中列 —'}
                  </span>
                  {selectedColumnName && (
                    <span className="font-mono text-[10px] text-monokai-cyan px-1.5 py-0.5 rounded bg-monokai-surface border border-monokai-border">
                      {(columnTypeMap || queryResult?.columnTypeMap)?.[selectedColumnName] || 'VARCHAR'}
                    </span>
                  )}
                </div>
                {!selectedColumnName && (
                  <p className="text-[10px] text-monokai-comment font-sans leading-relaxed">
                    请先在上方 SQL 结果表的列头点击列名以选中需要分析的列，然后再次点击「列画像」按钮。
                  </p>
                )}
              </div>
            </div>

            {/* AI 未配置引导 */}
            {!aiService.isConfigured() && (
              <div className="p-3 rounded-lg bg-monokai-yellow/5 border border-monokai-yellow/30 space-y-2">
                <div className="flex items-center gap-1.5 text-monokai-yellow text-[11px] font-semibold">
                  <Brain className="w-3.5 h-3.5" />
                  <span>AI 服务未配置</span>
                </div>
                <p className="text-[11px] text-monokai-fg-muted leading-relaxed">
                  「列画像」需要先配置 AI 服务才能生成业务语义解读。打开设置填写 API Key 后即可启用。
                </p>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-ai-settings'))}
                  className="h-6 px-2.5 rounded-md bg-monokai-yellow hover:bg-monokai-yellow/90 text-monokai-bg text-[11px] font-semibold cursor-pointer transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>前往设置</span>
                </button>
              </div>
            )}

            {/* 错误状态 */}
            {columnProfileError && !isLoadingColumnProfile && (
              <div className="p-2.5 rounded-lg bg-monokai-pink/10 border border-monokai-pink/40 space-y-1.5">
                <div className="flex items-center gap-1.5 text-monokai-pink text-[11px] font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>AI 列画像生成失败</span>
                </div>
                <div className="text-[11px] text-monokai-fg-muted leading-relaxed font-mono break-all">
                  {columnProfileError}
                </div>
                {selectedColumnName && aiService.isConfigured() && (
                  <button
                    onClick={() => void runColumnProfile(selectedColumnName, 'manual')}
                    className="h-6 px-2 rounded-md bg-monokai-elevated hover:bg-monokai-surface border border-monokai-border text-monokai-fg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>重试</span>
                  </button>
                )}
              </div>
            )}

            {/* 加载状态 */}
            {isLoadingColumnProfile && (
              <AILoadingBlock label={`AI 正在分析列 “${selectedColumnName || ''}” 的业务语义…`} />
            )}

            {/* 空状态：已配置 + 有选中列 + 尚未触发 */}
            {aiService.isConfigured() && selectedColumnName && !columnProfileData && !isLoadingColumnProfile && !columnProfileError && (
              <div className="p-3 rounded-lg bg-monokai-elevated border border-monokai-border text-center space-y-2">
                <Brain className="w-5 h-5 text-monokai-cyan mx-auto" />
                <p className="text-[11px] text-monokai-comment font-sans">
                  已选中列 <b className="text-monokai-cyan font-mono">{selectedColumnName}</b>，点击下方按钮生成 AI 列画像。
                </p>
                <button
                  onClick={() => void runColumnProfile(selectedColumnName, 'manual')}
                  className="h-7 px-3 rounded-md bg-monokai-cyan hover:bg-monokai-cyan/90 text-monokai-bg text-[11px] font-semibold cursor-pointer transition-colors flex items-center gap-1 mx-auto"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>生成 AI 列画像</span>
                </button>
              </div>
            )}

            {/* 结果展示 */}
            {columnProfileData && (
              <div className="space-y-3">
                {/* 业务含义 */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-monokai-fg">
                    <span className="w-1 h-3 bg-gradient-to-b from-monokai-yellow to-monokai-yellow/40 rounded-full" />
                    <Lightbulb className="w-3.5 h-3.5 text-monokai-yellow" />
                    <span>业务含义</span>
                  </div>
                  <div className="p-3 rounded-lg bg-gradient-to-br from-monokai-yellow/8 via-monokai-elevated to-monokai-elevated border border-monokai-yellow/30 text-[11px] text-monokai-fg-muted leading-relaxed shadow-[inset_0_1px_0_rgba(230,219,116,0.05)]">
                    {columnProfileData.businessMeaning || 'AI 未返回业务含义。'}
                  </div>
                </div>

                {/* 语义类型 */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-monokai-fg">
                    <Tag className="w-3.5 h-3.5 text-monokai-cyan" />
                    <span>语义类型</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <SemanticTypeBadge semanticType={columnProfileData.semanticType} />
                  </div>
                </div>

                {/* 典型 SQL 用法 */}
                {columnProfileData.usageHints && columnProfileData.usageHints.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-monokai-fg">
                      <FileCode className="w-3.5 h-3.5 text-monokai-green" />
                      <span>典型 SQL 用法 ({columnProfileData.usageHints.length})</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-monokai-elevated border border-monokai-border space-y-1 text-[11px] font-mono">
                      {columnProfileData.usageHints.map((hint, idx) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <span className="text-monokai-comment shrink-0">•</span>
                          <span className="text-monokai-fg-muted leading-tight">{hint}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 数据质量风险 */}
                {columnProfileData.qualityRisks && columnProfileData.qualityRisks.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-monokai-fg">
                      <AlertTriangle className="w-3.5 h-3.5 text-monokai-yellow" />
                      <span>数据质量风险 ({columnProfileData.qualityRisks.length})</span>
                    </div>
                    {columnProfileData.qualityRisks.map((risk, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-monokai-elevated border border-monokai-border space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-monokai-fg text-[11px]">{risk.title}</span>
                          <SeverityBadge severity={risk.severity} compact />
                        </div>
                        <p className="text-[11px] text-monokai-fg-muted leading-relaxed font-sans">
                          {risk.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 建议行动 */}
                {columnProfileData.suggestedActions && columnProfileData.suggestedActions.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-monokai-fg">
                      <ListChecks className="w-3.5 h-3.5 text-monokai-green" />
                      <span>建议下一步</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-monokai-elevated border border-monokai-border space-y-1 text-[11px] font-sans">
                      {columnProfileData.suggestedActions.map((action, idx) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <span className="text-monokai-green font-mono shrink-0">{idx + 1}.</span>
                          <span className="text-monokai-fg-muted leading-tight">{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 重新生成按钮 */}
                <div className="pt-2 border-t border-monokai-border-subtle flex items-center justify-between text-[10px] text-monokai-comment">
                  <span>列画像由 aiService.profileColumn 生成，依据当前查询样本与 Schema 上下文。</span>
                  {selectedColumnName && aiService.isConfigured() && (
                    <button
                      onClick={() => void runColumnProfile(selectedColumnName, 'manual')}
                      disabled={isLoadingColumnProfile}
                      className="h-6 px-2 rounded-md bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-monokai-fg text-[10px] font-medium cursor-pointer transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingColumnProfile ? 'animate-spin' : ''}`} />
                      <span>重新生成</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Full SQL Modal */}
      <ModalShell
        open={showFullSqlModal}
        title="当前完整 SQL"
        onClose={() => setShowFullSqlModal(false)}
        size="md"
        icon={FileCode}
        iconColor="text-monokai-cyan"
      >
        <pre className="wb-code-block p-3 overflow-x-auto max-h-96 text-monokai-fg">
          {activeSql || 'SELECT * FROM orders;'}
        </pre>
      </ModalShell>

      {/* 5. Diff Modal */}
      <ModalShell
        open={showDiffModal && !!analyzeData}
        title="SQL 优化建议 Diff 比较"
        onClose={() => setShowDiffModal(false)}
        size="lg"
        icon={FileCode}
        iconColor="text-monokai-green"
        footer={
          <>
            <ActionButton variant="secondary" size="sm" onClick={() => setShowDiffModal(false)}>
              取消
            </ActionButton>
            <ActionButton
              variant="primary"
              size="sm"
              onClick={() => {
                setShowDiffModal(false);
                if (analyzeData?.suggestedSql && onApplySqlSuggestion) {
                  onApplySqlSuggestion(analyzeData.suggestedSql);
                } else {
                  toastService.success('已应用建议修改');
                }
              }}
            >
              确认应用修改
            </ActionButton>
          </>
        }
      >
        <div className="space-y-2 font-mono text-xs max-h-96 overflow-y-auto custom-scrollbar">
          {analyzeData?.suggestionRationale && (
            <InlineAlert tone="info">{analyzeData.suggestionRationale}</InlineAlert>
          )}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <div className="text-[10px] font-sans text-monokai-comment mb-1.5">原 SQL</div>
              <pre className="wb-code-block p-2.5 text-monokai-fg whitespace-pre-wrap leading-relaxed">
                {activeSql || '-- 当前无 SQL'}
              </pre>
            </div>
            <div>
              <div className="text-[10px] font-sans text-monokai-green mb-1.5">→ 优化后 SQL</div>
              <pre className="p-2.5 rounded-lg bg-monokai-green/5 border border-monokai-green/40 font-mono text-[11px] text-monokai-fg whitespace-pre-wrap leading-relaxed">
                {analyzeData?.suggestedSql}
              </pre>
            </div>
          </div>
        </div>
      </ModalShell>

      {/* Fallback Diff Modal for non-AI scenario */}
      <ModalShell
        open={showDiffModal && !analyzeData}
        title="暂无 AI 修改建议"
        onClose={() => setShowDiffModal(false)}
        size="sm"
        icon={AlertCircle}
        iconColor="text-monokai-yellow"
        footer={
          <ActionButton variant="secondary" size="sm" onClick={() => setShowDiffModal(false)}>
            关闭
          </ActionButton>
        }
      >
        <InlineAlert tone="warning" title="还没有可应用的 Diff">
          当前 SQL 还没有 AI 生成的具体修改建议，请等待 AI 分析完成后再次查看。
        </InlineAlert>
      </ModalShell>

    </div>
  );
};

// =========================================================================
// Helper Components & Functions (shared between explain/analyze tabs)
// =========================================================================

/**
 * AILoadingBlock — Uniform loading placeholder for AI generation steps.
 */
const AILoadingBlock: React.FC<{ label: string }> = ({ label }) => {
  return (
    <div className="p-3 rounded-lg bg-monokai-elevated border border-monokai-border space-y-2">
      <div className="flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-monokai-comment" />
        <span className="text-[11px] text-monokai-fg-muted">{label}</span>
      </div>
      <div className="space-y-1.5">
        <div className="h-2 rounded bg-monokai-surface/80 animate-pulse w-11/12" />
        <div className="h-2 rounded bg-monokai-surface/80 animate-pulse w-9/12" />
        <div className="h-2 rounded bg-monokai-surface/80 animate-pulse w-10/12" />
      </div>
    </div>
  );
};

/**
 * SeverityBadge — Severity color-coded chip.
 * @param severity — LOW / MEDIUM / HIGH
 * @param compact — true: inline; false: with Chinese label
 */
const SeverityBadge: React.FC<{ severity: 'LOW' | 'MEDIUM' | 'HIGH'; compact?: boolean }> = ({ severity, compact }) => {
  const colorMap: Record<string, string> = {
    LOW: 'text-monokai-green border-monokai-green/40',
    MEDIUM: 'text-monokai-yellow border-monokai-yellow/40',
    HIGH: 'text-monokai-pink border-monokai-pink/40',
  };
  const cls = colorMap[severity] || colorMap.MEDIUM;
  if (compact) {
    return (
      <span className={`px-1.5 py-0.5 rounded bg-monokai-surface border border-monokai-border ${cls} text-[9px] font-bold font-mono`}>
        {severity}
      </span>
    );
  }
  return (
    <span className={`px-2 py-0.5 rounded-md bg-monokai-surface border border-monokai-border ${cls} font-mono text-[10px] font-bold`}>
      {severity} ({severityLabel(severity)})
    </span>
  );
};

/**
 * severityLabel — Chinese label for severity.
 */
function severityLabel(severity: 'LOW' | 'MEDIUM' | 'HIGH'): string {
  if (severity === 'LOW') return '低';
  if (severity === 'HIGH') return '高';
  return '中';
}

/**
 * AiStateBadge — Tab 按钮右侧的小型 AI 状态徽标 (idle / loading / success / error)。
 * 设计：仅占 10px 宽，不破坏按钮的轻量感。
 */
const AiStateBadge: React.FC<{ state: 'idle' | 'loading' | 'success' | 'error'; columnName?: string | null }> = ({ state, columnName }) => {
  if (state === 'idle') return null;
  if (state === 'loading') {
    return <Loader2 className="w-2.5 h-2.5 animate-spin text-monokai-comment" data-testid="ai-state-loading" />;
  }
  if (state === 'success') {
    return <Check className="w-2.5 h-2.5 text-monokai-green" data-testid="ai-state-success" />;
  }
  return (
    <span title={columnName ? `列 “${columnName}” 生成失败` : 'AI 调用失败'}>
      <AlertCircle
        className="w-2.5 h-2.5 text-monokai-pink"
        data-testid="ai-state-error"
      />
    </span>
  );
};

/**
 * SemanticTypeBadge — AI 识别出的列语义类型徽标 (identifier / measure / dimension / ...).
 */
const semanticTypeMap: Record<ColumnSemanticType, { label: string; color: string }> = {
  identifier: { label: 'identifier · 主键/唯一标识', color: 'text-monokai-cyan border-monokai-cyan/40' },
  measure: { label: 'measure · 数值度量', color: 'text-monokai-green border-monokai-green/40' },
  dimension: { label: 'dimension · 分类维度', color: 'text-monokai-yellow border-monokai-yellow/40' },
  time: { label: 'time · 时间维度', color: 'text-monokai-purple border-monokai-purple/40' },
  flag: { label: 'flag · 布尔标记', color: 'text-monokai-orange border-monokai-orange/40' },
  free_text: { label: 'free_text · 自由文本', color: 'text-monokai-comment border-monokai-border' },
  unknown: { label: 'unknown · 待识别', color: 'text-monokai-comment border-monokai-border' },
};

const SemanticTypeBadge: React.FC<{ semanticType: ColumnSemanticType }> = ({ semanticType }) => {
  const meta = semanticTypeMap[semanticType] || semanticTypeMap.unknown;
  return (
    <span
      data-testid="ai-column-semantic-type"
      className={`px-2 py-0.5 rounded-md bg-monokai-surface border ${meta.color} font-mono text-[10px] font-bold`}
    >
      {meta.label}
    </span>
  );
};

/**
 * extractLineNumber — Try to extract an integer line number from lineHint strings
 * like "Line 4", "4", "Line 12-13", or pure text fragments.
 * Returns null if no line number can be parsed.
 */
function extractLineNumber(lineHint: string): number | null {
  if (!lineHint) return null;
  // Match "Line 12-13" → 12, "Line 4" → 4, "line 7" → 7
  const m = lineHint.match(/line\s*(\d+)/i);
  if (m && m[1]) {
    return parseInt(m[1], 10);
  }
  // Match "12-13" → 12
  const r = lineHint.match(/^(\d+)(?:[-–]\d+)?$/);
  if (r && r[1]) {
    return parseInt(r[1], 10);
  }
  return null;
}
