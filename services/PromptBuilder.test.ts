
import { describe, it, expect } from 'vitest';
import { PromptBuilder } from './PromptBuilder';
import { AnalysisSummary } from '../types';

describe('PromptBuilder (AI Schema v5.1 - Cognitive Layers)', () => {
    const mockSummary: AnalysisSummary = {
        tableName: 'test_table',
        rowCount: 100,
        columnCount: 5,
        sampleData: 'col1,col2\n1,2',
        stats: []
    };

    it('Stage 0: Scene Probe (Perception Layer)', () => {
        const prompt = PromptBuilder.buildSceneProbePrompt(mockSummary);
        expect(prompt).toContain('Perception Layer');
        expect(prompt).toContain('test_table');
        expect(prompt).toContain('RETURN ONLY JSON OBJECT');
        // Check for new detectors
        expect(prompt).toContain('SKL-103');
        expect(prompt).toContain('SKL-104');
        expect(prompt).toContain('SKL-105');
        expect(prompt).toContain('SKL-106');
        expect(prompt).toContain('SKL-401'); // ALC
    });

    it('Stage 1: Semantic (Perception + Governance Strategy)', () => {
        const prompt = PromptBuilder.buildSemanticPrompt(mockSummary, 'DATA_CLEANING');
        expect(prompt).toContain('Stage 1');
        expect(prompt).toContain('数据治理与安全合约');
        expect(prompt).toContain('recommendedIntent');
        expect(prompt).toContain('SKL-205'); // Compliance
        expect(prompt).toContain('SKL-206'); // Metric Factory
    });

    it('Stage 3: SQL Engine (Execution Layer)', () => {
        const prompt = PromptBuilder.buildOperationsPrompt(mockSummary, 'DATA_CLEANING');
        expect(prompt).toContain('Stage 3');
        expect(prompt).toContain('CREATE');
        expect(prompt).toContain('IF NOT EXISTS');
        expect(prompt).toContain('SKL-203'); // CTE
        expect(prompt).toContain('SKL-204'); // WASM
        expect(prompt).toContain('SKL-304'); // Macro
        expect(prompt).toContain('SKL-305'); // Assertion
        expect(prompt).toContain('SKL-308'); // Snapshot
    });

    it('Stage 6: Narrative (Execution Layer)', () => {
        const prompt = PromptBuilder.buildNarrativePrompt(
            { tableName: 't1' },
            { qualityReport: { overallScore: 85 } } as any
        );
        expect(prompt).toContain('Stage 6');
        expect(prompt).toContain('叙事报告与总结');
        expect(prompt).toContain('SKL-306'); // Storage Optimizer
        expect(prompt).toContain('SKL-402'); // Trace
        expect(prompt).toContain('SKL-405'); // CEO Summary
    });

    it('Fix Error Prompt (Self-healing)', () => {
        const prompt = PromptBuilder.buildFixErrorPrompt('SELECT * FROM t', 'Table not found');
        expect(prompt).toContain('SKL-307');
    });
});
