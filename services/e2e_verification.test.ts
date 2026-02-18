import { describe, it, expect, vi } from 'vitest';
import { PromptBuilder } from './PromptBuilder';
import { AnalysisSummary } from '../types';

describe('E2E Cognitive Pipeline Verification (v5.2)', () => {
    const mockSummary: AnalysisSummary = {
        tableName: 'ontology_sample',
        rowCount: 10,
        columnCount: 9,
        sampleData: '本体ID,术语名称,所属领域,定义描述,负责人邮箱,联系电话,复杂度评分,引用次数,最后核验日期\n1001,数字实体,核心域,"数据的离散单位",data.gov@example.com,13812345678,0.1,15000,2024-01-15',
        stats: [
            { column: '联系电话', count: 10, unique: 10, nulls: 0 },
            { column: '最后核验日期', count: 10, unique: 10, nulls: 0 }
        ]
    };

    it('Should include all cognitive layers in the full pipeline and Handbook structure', () => {
        // 1. Stage 0: Perception (Probe)
        const probe = PromptBuilder.buildSceneProbePrompt(mockSummary);
        expect(probe).toContain('SKL-103'); // Time
        expect(probe).toContain('SKL-105'); // Localization
        expect(probe).toContain('SKL-401'); // ALC
        expect(probe).toContain('SKL-000'); // Protocol

        // 2. Stage 1: Strategy (Semantic)
        const semantic = PromptBuilder.buildSemanticPrompt(mockSummary, 'EXPLORATION');
        expect(semantic).toContain('SKL-205'); // Compliance
        expect(semantic).toContain('SKL-206'); // Metric Factory

        // 3. Stage 3: Execution (Ops)
        const ops = PromptBuilder.buildOperationsPrompt(mockSummary, 'METRIC_MODELING');
        expect(ops).toContain('SKL-203'); // CTE Orchestrator
        expect(ops).toContain('SKL-304'); // Macro Factory
        expect(ops).toContain('SKL-308'); // Atomic Snapshot

        // 4. Stage 6: Meta (Handbook Weaver)
        const narrative = PromptBuilder.buildNarrativePrompt(mockSummary, {
            deepInsights: [{ title: 'Insights' }],
            qualityReport: { overallScore: 90 }
        } as any);
        expect(narrative).toContain('数据资产工程手册');
        expect(narrative).toContain('SKL-000'); // Handbook Protocol
        expect(narrative).toContain('SKL-402'); // Trace Weaver
        expect(narrative).toContain('SKL-405'); // CEO Summary
        expect(narrative).toContain('🎯'); // Mandatory Protocol Symbol
        expect(narrative).toContain('📌');
    });

    it('Check SQL Generation specific prompts', () => {
        const fixPrompt = PromptBuilder.buildFixErrorPrompt('SELECT * FROM t', 'Table not found');
        expect(fixPrompt).toContain('SKL-307'); // Self-healing
    });
});
