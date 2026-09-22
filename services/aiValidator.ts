import { DeepInsight } from '../types';

export type AIStage = 'p1_semantic' | 'p3_causal' | 'p4_insights' | 'sql_lifecycle' | 'sql_batch' | 'core_analysis' | 'deep_intelligence'
    | 'semantic' | 'quality' | 'ops' | 'causal' | 'insights' | 'narrative' | 'probe'
    | 'regex_gen' | 'fix_error' | 'smart_pivot' | 'unit_test' | 'ontology'
    | 'unified' | 'sql_explain' | 'sql_analyze'
    | 'sql_column_profile' | 'sql_columns_profile'; // v6.2: Workbench AI Column Profiling stages

export interface ValidationResult {
    isValid: boolean;
    isPartial: boolean;
    missingFields: string[];
    data: any;
}

export class AIValidator {

    /**
     * Attempts to parse and validate AI response.
     * Handles truncated JSON by trying to close open brackets.
     */
    static validate(stage: AIStage, rawText: string): ValidationResult {
        let data: any = null;
        let isPartial = false;
        const missingFields: string[] = [];

        // 1. Try normal parse
        try {
            data = JSON.parse(this.cleanJSON(rawText));
        } catch (e) {
            // 2. Try partial parse (fix common truncation)
            const fixedText = this.fixTruncatedJSON(rawText);
            try {
                data = JSON.parse(fixedText);
                isPartial = true;
            } catch (e2) {
                // For streaming stages, we don't treat broad parse error as fatal yet
                // because it might be the Tagged-Stream format.
                if (stage !== 'sql_lifecycle' && stage !== 'core_analysis' && stage !== 'deep_intelligence') {
                    return { isValid: false, isPartial: false, missingFields: ['JSON_PARSE_ERROR'], data: null };
                }
            }
        }

        // 3. Schema specific validation
        switch (stage) {
            case 'p1_semantic':
                if (!data || !data.semanticColumns || !Array.isArray(data.semanticColumns) || data.semanticColumns.length === 0) {
                    missingFields.push('semanticColumns');
                }
                if (!data || !data.qualityReport) {
                    missingFields.push('qualityReport');
                }
                break;

            case 'probe':
                if (!data || !data.recommendedIntent) missingFields.push('recommendedIntent');
                break;

            case 'semantic':
                // v5.1: Expect object { recommendedIntent, columns: [] }
                // Fallback: If array, treat as columns (legacy/direct prompt output)
                if (Array.isArray(data)) {
                    data = { columns: data };
                }
                if (!data || !data.columns || !Array.isArray(data.columns) || data.columns.length === 0) {
                    missingFields.push('semantic_columns_array');
                }
                break;

            case 'quality':
                // Relaxed: Score OR Issues list is enough. Don't fail just for score type execution.
                if (!data) {
                    missingFields.push('quality_data_missing');
                } else if (!data.overallScore && (!data.issues || data.issues.length === 0)) {
                    missingFields.push('quality_content_missing');
                }
                break;

            case 'ops':
                // v2.1: Expect object { crud, transaction, scripts: [] }
                // Fallback: If array, treat as scripts only (legacy support)
                if (Array.isArray(data)) {
                    data = { scripts: data, crud: {}, transaction: {} };
                }

                // Relaxed Validation: If scripts missing, allow it (handled by Service)
                if (!data) data = {};
                if (!data.scripts || !Array.isArray(data.scripts)) {
                    data.scripts = [];
                }
                break;

            case 'causal':
                // Allow null for empty causal graph (conditional generation)
                if (data === null) break;
                if (!data || !data.nodes || !data.edges) missingFields.push('graph_structure');
                break;

            case 'insights':
                // v2.1: Expect object { insights: [], metricDefinitions: [], dependencyGraph }
                // Fallback: If array, treat as insights only
                if (Array.isArray(data)) {
                    data = { insights: data, metricDefinitions: [], dependencyGraph: null };
                }
                if (!data || !data.insights || !Array.isArray(data.insights)) {
                    missingFields.push('insights_array');
                }
                break;

            case 'narrative':
                if (!data || typeof data !== 'string' || data.length < 10) missingFields.push('narrative_text');
                break;

            case 'ontology':
                if (!data || !data.objects || !Array.isArray(data.objects)) {
                    missingFields.push('objects_array');
                }
                break;

            // v6.0: Unified Mega-Call validation
            case 'unified':
                if (!data) data = {};
                if (!data.probe) {
                    data.probe = { recommendedIntent: 'EXPLORATION' };
                    isPartial = true;
                }
                if (!data.semantic || !data.semantic.columns || !Array.isArray(data.semantic.columns)) {
                    if (!data.semantic) data.semantic = { columns: [] };
                    missingFields.push('semantic.columns');
                }
                if (!data.quality) {
                    data.quality = { overallScore: 0, issues: [], recommendations: [] };
                    isPartial = true;
                }
                if (!data.operations) {
                    data.operations = { scripts: [] };
                    isPartial = true;
                }
                break;

            case 'p3_causal':
                if (!data || !data.causalGraph || !data.causalGraph.nodes) {
                    missingFields.push('causalGraph.nodes');
                }
                if (!data || !data.causalGraph || !data.causalGraph.edges) {
                    missingFields.push('causalGraph.edges');
                }
                break;

            case 'p4_insights':
                if (!data || !Array.isArray(data) || data.length === 0) {
                    // Check if it's wrapped in an object field like { insights: [...] }
                    if (data && data.insights && Array.isArray(data.insights)) {
                        data = data.insights;
                    } else {
                        missingFields.push('insights');
                    }
                }
                break;


            case 'sql_batch':
                if (!data || !Array.isArray(data) || data.length === 0) {
                    missingFields.push('batch_operations');
                }
                break;

            case 'core_analysis':
                if (rawText.includes('[SEMANTIC_LABELS]') || rawText.includes('[QUALITY_REPORT]') || rawText.includes('[OP]')) {
                    const parsedData: any = {
                        qualityReport: null,
                        semanticColumns: [],
                        operations: []
                    };

                    // Extract Quality Report
                    const qualityMatch = rawText.match(/\[QUALITY_REPORT\]([\s\S]*?)\[\/QUALITY_REPORT\]/);
                    if (qualityMatch) {
                        try {
                            parsedData.qualityReport = JSON.parse(qualityMatch[1].trim());
                        } catch (e) { /* Skip malformed JSON */ }
                    }

                    // Extract Semantic Labels
                    const labelsMatch = rawText.match(/\[SEMANTIC_LABELS\]([\s\S]*?)\[\/SEMANTIC_LABELS\]/);
                    if (labelsMatch) {
                        try {
                            parsedData.semanticColumns = JSON.parse(labelsMatch[1].trim());
                        } catch (e) { /* Skip malformed JSON */ }
                    }

                    // Extract Operations
                    const opMs = [...rawText.matchAll(/\[OP\]([\s\S]*?)\[\/OP\]/g)];
                    for (const m of opMs) {
                        try {
                            let json = m[1].trim();
                            if (!json.endsWith('}')) json += '}';
                            const op = JSON.parse(json);
                            parsedData.operations.push({ ...op, id: parsedData.operations.length + 1 });
                        } catch (e) { /* Skip */ }
                    }

                    data = parsedData;
                    if (!data.qualityReport) missingFields.push('quality_report_tag');
                    if (data.semanticColumns.length === 0) missingFields.push('semantic_labels_tag');
                    if (data.operations.length === 0) missingFields.push('operations_tag');
                } else {
                    missingFields.push('core_analysis_format_missing');
                }
                break;

            case 'deep_intelligence':
                if (rawText.includes('[CAUSAL_GRAPH]') || rawText.includes('[INSIGHTS]')) {
                    const parsedData: any = { causalGraph: null, insights: [] };

                    const causalMatch = rawText.match(/\[CAUSAL_GRAPH\]([\s\S]*?)\[\/CAUSAL_GRAPH\]/);
                    if (causalMatch) {
                        try {
                            parsedData.causalGraph = JSON.parse(causalMatch[1].trim());
                        } catch (e) { /* Skip */ }
                    }

                    const insightsMatch = rawText.match(/\[INSIGHTS\]([\s\S]*?)\[\/INSIGHTS\]/);
                    if (insightsMatch) {
                        try {
                            parsedData.insights = JSON.parse(insightsMatch[1].trim());
                        } catch (e) { /* Skip */ }
                    }

                    const narrativeMatch = rawText.match(/\[NARRATIVE\]([\s\S]*?)\[\/NARRATIVE\]/);
                    if (narrativeMatch) {
                        parsedData.narrative = narrativeMatch[1].trim();
                    }

                    data = parsedData;
                    if (!data.causalGraph) missingFields.push('causal_graph_tag');
                    if (data.insights.length === 0) missingFields.push('insights_tag');
                } else {
                    missingFields.push('deep_intelligence_format_missing');
                }
                break;

            // ============================================================
            // Workbench AI Assistant: SQL Explanation
            // ============================================================
            case 'sql_explain':
                // Expect JSON { oneLiner, logicSteps: [], involvedObjects: [], outputFields: [], keyConditions: [] }
                if (!data || typeof data !== 'object') {
                    missingFields.push('explain_data_missing');
                    break;
                }
                if (!data.oneLiner || typeof data.oneLiner !== 'string') {
                    missingFields.push('oneLiner');
                }
                if (!Array.isArray(data.logicSteps)) {
                    missingFields.push('logicSteps_array');
                } else if (data.logicSteps.length === 0) {
                    missingFields.push('logicSteps_empty');
                }
                if (!Array.isArray(data.involvedObjects)) {
                    missingFields.push('involvedObjects_array');
                }
                if (!Array.isArray(data.outputFields)) {
                    missingFields.push('outputFields_array');
                }
                if (!Array.isArray(data.keyConditions)) {
                    missingFields.push('keyConditions_array');
                }
                break;

            // ============================================================
            // Workbench AI Assistant: SQL Analysis (Risks + Perf + Suggestion)
            // ============================================================
            case 'sql_analyze':
                // Expect JSON { severity, summary, logicRisks: [], perfConcerns: [], resultInsights: [], suggestedSql, suggestionRationale }
                if (!data || typeof data !== 'object') {
                    missingFields.push('analyze_data_missing');
                    break;
                }
                if (!data.severity || !['LOW', 'MEDIUM', 'HIGH'].includes(data.severity)) {
                    missingFields.push('severity');
                }
                if (!data.summary || typeof data.summary !== 'string') {
                    missingFields.push('summary');
                }
                if (!Array.isArray(data.logicRisks)) {
                    missingFields.push('logicRisks_array');
                }
                if (!Array.isArray(data.perfConcerns)) {
                    missingFields.push('perfConcerns_array');
                }
                if (!Array.isArray(data.resultInsights)) {
                    missingFields.push('resultInsights_array');
                }
                // suggestedSql is optional - allow empty array if model chooses to skip
                if (data.suggestedSql !== undefined && typeof data.suggestedSql !== 'string') {
                    missingFields.push('suggestedSql_type');
                }
                break;

            // ============================================================
            // Workbench AI Assistant: Column Profiling (single column)
            // ============================================================
            case 'sql_column_profile':
                // Expect JSON { semanticType, businessMeaning, usageHints: [], qualityRisks: [], suggestedActions: [] }
                if (!data || typeof data !== 'object') {
                    missingFields.push('column_profile_data_missing');
                    break;
                }
                if (!data.semanticType || !['identifier', 'measure', 'dimension', 'time', 'flag', 'free_text', 'unknown'].includes(data.semanticType)) {
                    missingFields.push('semanticType');
                }
                if (!data.businessMeaning || typeof data.businessMeaning !== 'string') {
                    missingFields.push('businessMeaning');
                }
                if (!Array.isArray(data.usageHints)) {
                    missingFields.push('usageHints_array');
                }
                if (!Array.isArray(data.qualityRisks)) {
                    missingFields.push('qualityRisks_array');
                }
                if (!Array.isArray(data.suggestedActions)) {
                    missingFields.push('suggestedActions_array');
                }
                break;

            // ============================================================
            // Workbench AI Assistant: Column Profiling (batch ≤8 columns)
            // ============================================================
            case 'sql_columns_profile':
                // Expect JSON { overallSummary, profiles: [ColumnAiProfile] }
                if (!data || typeof data !== 'object') {
                    missingFields.push('columns_profile_data_missing');
                    break;
                }
                if (!data.overallSummary || typeof data.overallSummary !== 'string') {
                    missingFields.push('overallSummary');
                }
                if (!Array.isArray(data.profiles)) {
                    missingFields.push('profiles_array');
                    break;
                }
                if (data.profiles.length === 0) {
                    missingFields.push('profiles_empty');
                } else {
                    data.profiles.forEach((p: any, idx: number) => {
                        if (!p || typeof p !== 'object') {
                            missingFields.push(`profiles[${idx}]_type`);
                            return;
                        }
                        if (!p.columnName || typeof p.columnName !== 'string') {
                            missingFields.push(`profiles[${idx}].columnName`);
                        }
                        if (!p.semanticType || !['identifier', 'measure', 'dimension', 'time', 'flag', 'free_text', 'unknown'].includes(p.semanticType)) {
                            missingFields.push(`profiles[${idx}].semanticType`);
                        }
                        if (!p.businessMeaning || typeof p.businessMeaning !== 'string') {
                            missingFields.push(`profiles[${idx}].businessMeaning`);
                        }
                        if (!Array.isArray(p.usageHints)) {
                            missingFields.push(`profiles[${idx}].usageHints`);
                        }
                        if (!Array.isArray(p.qualityRisks)) {
                            missingFields.push(`profiles[${idx}].qualityRisks`);
                        }
                        if (!Array.isArray(p.suggestedActions)) {
                            missingFields.push(`profiles[${idx}].suggestedActions`);
                        }
                    });
                }
                break;
        }

        return {
            isValid: missingFields.length === 0,
            isPartial: isPartial || missingFields.length > 0,
            missingFields,
            data: this.applyMVO(stage, data)
        };
    }

    /**
     * Builds a concise self-healing prompt targeting missing JSON schema fields
     */
    static buildRepairPrompt(missingFields: string[], rawResponse: string): string {
        return `上一次生成的 JSON 格式校验不完整，缺少必须字段: ${missingFields.join(', ')}。
请仅输出纠正后的标准 JSON，不要包含任何 markdown 解释或额外前导文字。

原错误输出截断:
${rawResponse.slice(0, 300)}`;
    }

    private static applyMVO(stage: AIStage, data: any): any {
        if (!data) data = {};

        switch (stage) {
            case 'core_analysis':
                return {
                    qualityReport: data.qualityReport || { overallScore: 0, issues: [], recommendations: [] },
                    semanticColumns: data.semanticColumns || [],
                    overview: data.overview || "分析中...",
                    typeInference: data.typeInference || "推断中...",
                    operations: data.operations || []
                };
            case 'deep_intelligence':
                return {
                    causalGraph: data.causalGraph || { nodes: [], edges: [], engineeredFeatures: [] },
                    insights: data.insights || [],
                    narrative: data.narrative || ""
                };
            case 'sql_explain':
                return {
                    oneLiner: data.oneLiner || '无法生成此查询的一句话解释。',
                    logicSteps: Array.isArray(data.logicSteps) ? data.logicSteps : [],
                    involvedObjects: Array.isArray(data.involvedObjects) ? data.involvedObjects : [],
                    outputFields: Array.isArray(data.outputFields) ? data.outputFields : [],
                    keyConditions: Array.isArray(data.keyConditions) ? data.keyConditions : []
                };
            case 'sql_analyze':
                return {
                    severity: data.severity || 'MEDIUM',
                    summary: data.summary || '无法生成此查询的分析摘要。',
                    logicRisks: Array.isArray(data.logicRisks) ? data.logicRisks : [],
                    perfConcerns: Array.isArray(data.perfConcerns) ? data.perfConcerns : [],
                    resultInsights: Array.isArray(data.resultInsights) ? data.resultInsights : [],
                    suggestedSql: typeof data.suggestedSql === 'string' ? data.suggestedSql : '',
                    suggestionRationale: data.suggestionRationale || ''
                };
            case 'sql_column_profile':
                return {
                    semanticType: data.semanticType || 'unknown',
                    businessMeaning: data.businessMeaning || '业务含义待人工标注。',
                    usageHints: Array.isArray(data.usageHints) ? data.usageHints : [],
                    qualityRisks: Array.isArray(data.qualityRisks) ? data.qualityRisks : [],
                    suggestedActions: Array.isArray(data.suggestedActions) ? data.suggestedActions : []
                };
            case 'sql_columns_profile':
                return {
                    overallSummary: data.overallSummary || '',
                    profiles: Array.isArray(data.profiles) ? data.profiles : []
                };
            default:
                return data;
        }
    }

    private static cleanJSON(text: string): string {
        // Remove markdown code blocks if present
        let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        // Sometimes LLM puts text before or after the JSON.
        // Try to find the first '{' or '[' and last '}' or ']'
        const firstBrace = Math.min(
            cleaned.indexOf('{') === -1 ? Infinity : cleaned.indexOf('{'),
            cleaned.indexOf('[') === -1 ? Infinity : cleaned.indexOf('[')
        );
        const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));

        if (firstBrace !== Infinity && lastBrace !== -1 && lastBrace > firstBrace) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }
        return cleaned;
    }

    /**
   * Simple logic to close unclosed JSON brackets
   * Also attempts to strip trailing incomplete text
   */
    private static fixTruncatedJSON(text: string): string {
        let t = this.cleanJSON(text);

        // Find last possible recovery point (end of an object or array)
        const lastBrace = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));

        if (lastBrace > 0) {
            const tail = t.substring(lastBrace + 1).trim();
            // If the tail looks like an incomplete field (e.g., , "name": "...)
            // we strip it back to the last valid closing brace.
            if (tail.length > 0 && tail.includes('"') && !tail.endsWith('}') && !tail.endsWith(']')) {
                t = t.substring(0, lastBrace + 1);
            }
        }

        // Handle trailing commas which break JSON.parse
        t = t.trim().replace(/,$/, '');

        const stack: string[] = [];
        // Basic bracket balancer
        for (const char of t) {
            if (char === '{' || char === '[') stack.push(char);
            else if (char === '}') {
                if (stack[stack.length - 1] === '{') stack.pop();
            } else if (char === ']') {
                if (stack[stack.length - 1] === '[') stack.pop();
            }
        }

        // Close everything left open
        while (stack.length > 0) {
            const last = stack.pop();
            if (last === '{') t += '}';
            if (last === '[') t += ']';
        }

        return t;
    }
}
