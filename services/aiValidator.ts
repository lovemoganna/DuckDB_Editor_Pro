import { DeepInsight } from '../types';

export type AIStage = 'p1_semantic' | 'p3_causal' | 'p4_insights' | 'sql_lifecycle' | 'sql_batch' | 'core_analysis' | 'deep_intelligence'
    | 'semantic' | 'quality' | 'ops' | 'causal' | 'insights' | 'narrative' | 'probe'
    | 'regex_gen' | 'fix_error' | 'smart_pivot' | 'unit_test'
    | 'unified'; // v6.0: Single mega-call for all core stages

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
        }

        return {
            isValid: missingFields.length === 0,
            isPartial: isPartial || missingFields.length > 0,
            missingFields,
            data: this.applyMVO(stage, data)
        };
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
