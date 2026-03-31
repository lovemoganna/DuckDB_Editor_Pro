/**
 * useSkillRouter - Shared Hook for AI Skill Routing
 *
 * Encapsulates the NL → Intent → Skill → SQL pipeline.
 * Used by both SkillPanel (smart mode) and SkillAssistant (modal).
 */

import { useState, useCallback, useMemo } from 'react';
import { AISkill, SkillExecutionContext, SkillResult, IntentAnalysis } from '../types';
import { analyzeIntent, suggestSkills, executeFromIntent } from '../services/skillRouter';

export interface UseSkillRouterOptions {
    currentTable?: string;
    currentColumns?: { name: string; type: string }[];
}

export interface UseSkillRouterReturn {
    /** Natural language input */
    input: string;
    setInput: (val: string) => void;

    /** Loading states */
    isAnalyzing: boolean;
    isExecuting: boolean;

    /** Results */
    intentAnalysis: IntentAnalysis | null;
    suggestedSkills: AISkill[];
    executionResult: SkillResult | null;

    /** Actions */
    handleAnalyze: () => Promise<void>;
    handleExecute: () => Promise<void>;
    reset: () => void;

    /** Execution context (derived from options) */
    context: SkillExecutionContext;
}

export function useSkillRouter(options: UseSkillRouterOptions): UseSkillRouterReturn {
    const { currentTable, currentColumns } = options;

    const [input, setInput] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [intentAnalysis, setIntentAnalysis] = useState<IntentAnalysis | null>(null);
    const [suggestedSkills, setSuggestedSkills] = useState<AISkill[]>([]);
    const [executionResult, setExecutionResult] = useState<SkillResult | null>(null);

    const context = useMemo<SkillExecutionContext>(() => ({
        tableName: currentTable,
        columns: currentColumns as any,
        userIntent: input,
    }), [currentTable, currentColumns, input]);

    const handleAnalyze = useCallback(async () => {
        if (!input.trim()) return;

        setIsAnalyzing(true);
        setExecutionResult(null);

        try {
            const [skills, analysis] = await Promise.all([
                suggestSkills(input, context, 5),
                analyzeIntent(input, context),
            ]);
            setSuggestedSkills(skills);
            setIntentAnalysis(analysis);
        } catch (error) {
            console.error('Skill analysis error:', error);
        } finally {
            setIsAnalyzing(false);
        }
    }, [input, context]);

    const handleExecute = useCallback(async () => {
        if (!input.trim()) return;

        setIsExecuting(true);

        try {
            const result = await executeFromIntent(input, context, false);
            setExecutionResult(result);
        } catch (error) {
            console.error('Skill execution error:', error);
            setExecutionResult({
                success: false,
                error: error instanceof Error ? error.message : '执行失败，请重试',
            });
        } finally {
            setIsExecuting(false);
        }
    }, [input, context]);

    const reset = useCallback(() => {
        setInput('');
        setIntentAnalysis(null);
        setSuggestedSkills([]);
        setExecutionResult(null);
    }, []);

    return {
        input,
        setInput,
        isAnalyzing,
        isExecuting,
        intentAnalysis,
        suggestedSkills,
        executionResult,
        handleAnalyze,
        handleExecute,
        reset,
        context,
    };
}
