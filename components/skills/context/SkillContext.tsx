/**
 * SkillContext - Centralized state for AI Skills module
 *
 * All skill-related components consume state from this context.
 * Avoids prop drilling across the Browse/Guide dual-mode interface.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { AISkill, IntentAnalysis, SkillResult, ThinkingStep } from '../../../types';
import { SkillExecutionContext } from '../../../types';
import { analyzeIntent } from '../../../services/skillRouter';
import { executeSkill } from '../../../services/skillExecutor';

// ============================================================
// Context Value Interface
// ============================================================

export interface SkillContextValue {
  // View mode
  viewMode: 'guide' | 'browse';
  setViewMode: (mode: 'guide' | 'browse') => void;

  // Natural language input (Guide mode)
  nlInput: string;
  setNlInput: (v: string) => void;

  // Intent analysis (Guide mode)
  intentAnalysis: IntentAnalysis | null;
  setIntentAnalysis: (a: IntentAnalysis | null) => void;

  // Suggested skills (from intent analysis)
  suggestedSkills: AISkill[];
  setSuggestedSkills: (s: AISkill[]) => void;

  // Selected skill (shared across modes)
  selectedSkill: AISkill | null;
  setSelectedSkill: (skill: AISkill | null) => void;

  // Execution
  isExecuting: boolean;
  setIsExecuting: (v: boolean) => void;
  executionResult: SkillResult | null;
  setExecutionResult: (r: SkillResult | null) => void;
  executionProgress: number;
  setExecutionProgress: (p: number) => void;

  // Browse mode result (separate from guide result)
  browseResult: SkillResult | null;
  setBrowseResult: (r: SkillResult | null) => void;

  // Thinking display
  thinkingSteps: ThinkingStep[];
  setThinkingSteps: (steps: ThinkingStep[]) => void;
  streamingSql: string;
  setStreamingSql: (sql: string) => void;

  // Cancellation
  cancelExecution: () => void;

  // Skill list state (Browse mode)
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;
  filteredSkills: AISkill[];
  setFilteredSkills: (s: AISkill[]) => void;
  skillsByCategory: Record<string, AISkill[]>;
  setSkillsByCategory: (m: Record<string, AISkill[]>) => void;
  expandedCategories: Set<string>;
  toggleCategory: (c: string) => void;
  sortOrder: string;
  setSortOrder: (o: string) => void;
  isPipelineMode: boolean;
  setIsPipelineMode: (v: boolean) => void;

  // Context for skill execution
  currentTable?: string;
  setCurrentTable: (t: string | undefined) => void;
  currentColumns?: { name: string; type: string }[];
  setCurrentColumns: (c: { name: string; type: string }[] | undefined) => void;

  // Spotlight search
  isSpotlightActive: boolean;
  setIsSpotlightActive: (v: boolean) => void;

  // Modals
  showImportModal: boolean;
  setShowImportModal: (v: boolean) => void;

  // Handlers
  handleAnalyze: (nlInput: string, context: SkillExecutionContext) => Promise<void>;
  handleExecute: (skill: AISkill, inputs: Record<string, unknown>, context: SkillExecutionContext) => Promise<void>;
}

const SkillContext = createContext<SkillContextValue | null>(null);

export const useSkillContext = (): SkillContextValue => {
  const ctx = useContext(SkillContext);
  if (!ctx) throw new Error('useSkillContext must be used within SkillProvider');
  return ctx;
};

// ============================================================
// Provider
// ============================================================

export const SkillProvider: React.FC<{ children: React.ReactNode; currentTable?: string; currentColumns?: { name: string; type: string }[] }> = ({ children, currentTable: initTable, currentColumns: initColumns }) => {
  // View mode
  const [viewMode, setViewMode] = useState<'guide' | 'browse'>('guide');

  // Natural language input
  const [nlInput, setNlInput] = useState('');
  const [intentAnalysis, setIntentAnalysis] = useState<IntentAnalysis | null>(null);
  const [suggestedSkills, setSuggestedSkills] = useState<AISkill[]>([]);

  // Selected skill
  const [selectedSkill, setSelectedSkill] = useState<AISkill | null>(null);

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<SkillResult | null>(null);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [browseResult, setBrowseResult] = useState<SkillResult | null>(null);

  // Thinking display
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [streamingSql, setStreamingSql] = useState('');

  // Context for skill execution
  const [currentTable, setCurrentTable] = useState<string | undefined>(initTable);
  const [currentColumns, setCurrentColumns] = useState<{ name: string; type: string }[] | undefined>(initColumns);

  // Spotlight
  const [isSpotlightActive, setIsSpotlightActive] = useState(false);

  // Skill list state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filteredSkills, setFilteredSkills] = useState<AISkill[]>([]);
  const [skillsByCategory, setSkillsByCategory] = useState<Record<string, AISkill[]>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState('default');
  const [isPipelineMode, setIsPipelineMode] = useState(false);

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);

  // Cancel token
  const cancelRef = React.useRef<{ cancelled: boolean }>({ cancelled: false });

  const cancelExecution = useCallback(() => {
    cancelRef.current.cancelled = true;
    setIsExecuting(false);
    setExecutionProgress(0);
  }, []);

  // Analyze handler
  const handleAnalyze = useCallback(async (input: string, context: SkillExecutionContext) => {
    if (!input.trim()) return;
    setIsExecuting(true);
    setExecutionResult(null);
    setThinkingSteps([]);
    setStreamingSql('');
    cancelRef.current = { cancelled: false };

    try {
      const result = await analyzeIntent(input, context);
      setIntentAnalysis(result);
      setSuggestedSkills(result.requiredSkills.map(id => ({ id } as AISkill)).filter(Boolean));
    } catch (err) {
      setExecutionResult({
        success: false,
        error: err instanceof Error ? err.message : 'Intent analysis failed',
      });
    } finally {
      if (!cancelRef.current.cancelled) {
        setIsExecuting(false);
      }
    }
  }, []);

  // Execute handler
  const handleExecute = useCallback(async (
    skill: AISkill,
    inputs: Record<string, unknown>,
    context: SkillExecutionContext
  ) => {
    setIsExecuting(true);
    setExecutionResult(null);
    setExecutionProgress(0);
    cancelRef.current = { cancelled: false };

    setThinkingSteps(prev => [
      ...prev,
      { phase: 'intent', label: '解析意图', status: 'done' },
      { phase: 'skill_select', label: '选择技能', status: 'done' },
      { phase: 'sql_generate', label: '生成 SQL', status: 'running' },
    ]);

    try {
      const result = await executeSkill({
        skillId: skill.id,
        inputs,
        context,
        simulateOnly: false,
        onChunk: (text) => {
          setStreamingSql(prev => prev + text);
        },
        cancelToken: cancelRef.current,
      });
      setExecutionResult(result);
    } catch (err) {
      setExecutionResult({
        success: false,
        error: err instanceof Error ? err.message : 'Execution failed',
      });
    } finally {
      if (!cancelRef.current.cancelled) {
        setThinkingSteps(prev =>
          prev.map(s =>
            s.phase === 'sql_generate' ? { ...s, status: 'done' as const } : s
          )
        );
        setIsExecuting(false);
      }
    }
  }, []);

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const value: SkillContextValue = {
    viewMode, setViewMode,
    nlInput, setNlInput,
    intentAnalysis, setIntentAnalysis,
    suggestedSkills, setSuggestedSkills,
    selectedSkill, setSelectedSkill,
    isExecuting, setIsExecuting,
    executionResult, setExecutionResult,
    executionProgress, setExecutionProgress,
    browseResult, setBrowseResult,
    thinkingSteps, setThinkingSteps,
    streamingSql, setStreamingSql,
    cancelExecution,
    searchQuery, setSearchQuery,
    selectedCategory, setSelectedCategory,
    filteredSkills, setFilteredSkills,
    skillsByCategory, setSkillsByCategory,
    expandedCategories, toggleCategory,
    sortOrder, setSortOrder,
    isPipelineMode, setIsPipelineMode,
    currentTable, setCurrentTable,
    currentColumns, setCurrentColumns,
    isSpotlightActive, setIsSpotlightActive,
    showImportModal, setShowImportModal,
    handleAnalyze,
    handleExecute,
  };

  return <SkillContext.Provider value={value}>{children}</SkillContext.Provider>;
};
