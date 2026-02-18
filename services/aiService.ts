import { GoogleGenAI, Type } from "@google/genai";
import { GenerationResult, AnalysisSummary, DriverAnalysis, CorrelationMatrix, DeepInsight } from '../types';
import { AIValidator, AIStage } from './aiValidator';
import { PromptBuilder } from './PromptBuilder';
import { duckDBService } from './duckdbService';

export type AIProvider = 'google' | 'groq' | 'openai';

export interface AIConfig {
    provider: AIProvider;
    apiKey: string;
    baseUrl?: string;
    model: string;
}

/**
 * Global Throttler to enforce API cooldowns and prevent rate limits.
 */
class AIThrottler {
    private lastCallTimestamp: number = 0;
    private pausedUntil: number = 0; // New: Global pause timestamp
    private readonly COOLDOWN_MS = 5000; // 5s gap (aligned with standard 15 RPM)
    private queue: Promise<void> = Promise.resolve();

    async acquireLock(): Promise<void> {
        const currentTask = this.queue.then(async () => {
            let now = Date.now();

            // 1. Check Global Pause (Rate Limit Penalty)
            if (now < this.pausedUntil) {
                const pauseWait = this.pausedUntil - now;
                console.log(`[AIThrottler] System globally paused for ${pauseWait}ms (Rate Limit)...`);
                await new Promise(r => setTimeout(r, pauseWait));
                now = Date.now(); // Update now after wait
            }

            // 2. Check Standard Cooldown
            const elapsed = now - this.lastCallTimestamp;
            if (elapsed < this.COOLDOWN_MS) {
                const wait = this.COOLDOWN_MS - elapsed;
                console.log(`[AIThrottler] Throttling for ${wait}ms...`);
                await new Promise(r => setTimeout(r, wait));
            }
            this.lastCallTimestamp = Date.now();
        });
        this.queue = currentTask;
        return currentTask;
    }

    /**
     * Globally block all AI calls for a duration (e.g., when 429 is hit)
     */
    block(ms: number) {
        this.pausedUntil = Date.now() + ms;
    }

    getRemainingTime(): number {
        const now = Date.now();
        const pauseRemaining = Math.max(0, this.pausedUntil - now);
        const cooldownRemaining = Math.max(0, this.COOLDOWN_MS - (now - this.lastCallTimestamp));
        return Math.max(pauseRemaining, cooldownRemaining);
    }

    reset() {
        this.lastCallTimestamp = 0;
        this.pausedUntil = 0;
    }
}

export const aiThrottler = new AIThrottler();

class AIService {
    private getConfig(): AIConfig {
        const provider = (localStorage.getItem('duckdb_ai_provider') as AIProvider) || 'google';
        const apiKey = localStorage.getItem('duckdb_ai_api_key') || import.meta.env.VITE_API_KEY || '';
        const baseUrl = localStorage.getItem('duckdb_ai_base_url') || '';
        const model = localStorage.getItem('duckdb_ai_model') || (provider === 'google' ? 'gemini-2.0-flash-exp' : 'llama-3.3-70b-versatile');

        return { provider, apiKey, baseUrl, model };
    }

    private async callProvider(
        prompt: string,
        systemInstruction?: string,
        isJSON: boolean = false,
        modelOverride?: string,
        onChunk?: (chunk: string) => void
    ): Promise<string> {
        // Enforce global throttling before any actual network request
        await aiThrottler.acquireLock();

        const config = this.getConfig();
        if (!config.apiKey) throw new Error("AI API Key not configured");

        const modelToUse = modelOverride || config.model;
        let fullText = "";

        if (config.provider === 'google') {
            const ai = new GoogleGenAI({ apiKey: config.apiKey });

            if (onChunk) {
                const result = await ai.models.generateContentStream({
                    model: modelToUse,
                    contents: prompt,
                    config: {
                        systemInstruction: systemInstruction,
                        responseMimeType: isJSON ? "application/json" : undefined
                    }
                });
                for await (const chunk of result) {
                    const chunkText = chunk.text;
                    fullText += chunkText;
                    onChunk(chunkText);
                }
                return fullText;
            } else {
                const response = await ai.models.generateContent({
                    model: modelToUse,
                    contents: prompt,
                    config: {
                        systemInstruction: systemInstruction,
                        responseMimeType: isJSON ? "application/json" : undefined
                    }
                });
                return response.text || "";
            }
        } else {
            // Groq / OpenAI REST API
            let url = config.baseUrl || (config.provider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1');
            if (!url.endsWith('/chat/completions')) {
                url = url.replace(/\/?$/, '/chat/completions');
            }

            const messages = [];
            if (systemInstruction) {
                messages.push({ role: 'system', content: systemInstruction });
            }
            messages.push({ role: 'user', content: prompt });

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: modelToUse,
                    messages,
                    response_format: (isJSON && !onChunk) ? { type: 'json_object' } : undefined, // Stream mode doesn't strictly need json_object for some providers or might conflict
                    temperature: 0.1,
                    stream: !!onChunk
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
                throw new Error(`AI Provider Error (${response.status}): ${err.error?.message || response.statusText}`);
            }

            if (onChunk && response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        const cleanLine = line.trim();
                        if (!cleanLine || !cleanLine.startsWith("data: ")) continue;

                        const data = cleanLine.slice(6);
                        if (data === "[DONE]") break;

                        try {
                            const json = JSON.parse(data);
                            const text = json.choices?.[0]?.delta?.content || "";
                            if (text) {
                                fullText += text;
                                onChunk(text);
                            }
                        } catch (e) {
                            // Ignore malformed JSON chunks
                        }
                    }
                }
                return fullText;
            } else {
                const data = await response.json();
                return data.choices?.[0]?.message?.content || "";
            }
        }
    }

    /**
     * Robust AI Call Wrapper with Retry and Validation
     * Made public for use by HandbookGenerator and other external services
     */
    async robustCall<T>(
        stage: AIStage,
        prompt: string,
        systemInstruction?: string,
        isJSON: boolean = true,
        retryCount: number = 3,
        onChunk?: (chunk: string) => void
    ): Promise<T> {
        let lastError: any = null;
        let currentModel: string | undefined = undefined;

        let currentPrompt = prompt;

        for (let i = 0; i <= retryCount; i++) {
            try {
                const rawText = await this.callProvider(currentPrompt, systemInstruction, isJSON, currentModel, onChunk);

                // Skip validation for non-JSON responses (e.g., Markdown handbook content)
                if (!isJSON) {
                    // For text responses, just return the raw text if it has content
                    if (rawText && rawText.trim().length > 0) {
                        try {
                            await duckDBService.logAiTrace({
                                prompt: currentPrompt,
                                response: rawText,
                                model: this.getConfig().model,
                                meta: { stage, attempt: i + 1, type: 'text' }
                            });
                        } catch (e) { console.warn('Log failed', e); }
                        return rawText as unknown as T;
                    }
                    throw new Error('Empty response from AI provider');
                }

                // JSON validation only for JSON responses
                const result = AIValidator.validate(stage, rawText);

                if (result.isValid) {
                    try {
                        await duckDBService.logAiTrace({
                            prompt: currentPrompt,
                            response: JSON.stringify(result.data),
                            model: this.getConfig().model,
                            meta: { stage, attempt: i + 1, type: 'json' }
                        });
                    } catch (e) { console.warn('Log failed', e); }
                    return result.data as T;
                }

                if (result.isPartial && i === retryCount) {
                    console.warn(`[AIService] Returning partial result for ${stage} after ${i} retries.`);
                    return result.data as T;
                }

                console.warn(`[AIService] ${stage} result invalid or partial (attempt ${i + 1}/${retryCount + 1}), self-healing retry...`, result.missingFields);

                // Self-healing: Append error feedback to the prompt for the next retry
                currentPrompt = `${prompt}\n\n[SELF_HEALING_FEEDBACK]\nYour previous response was invalid. Missing/Error fields: ${result.missingFields.join(', ')}.\nPlease fix the JSON structure and ensure all required fields are present.`;

                lastError = new Error(`Incomplete AI response for ${stage}: ${result.missingFields.join(', ')}`);
            } catch (e: any) {
                console.error(`[AIService] ${stage} call failed (attempt ${i + 1}):`, e);
                lastError = e;

                // FATAL: Don't retry on authentication errors - fix your API key!
                if (e.message?.includes('401') || e.message?.includes('403') || e.message?.includes('Invalid API Key')) {
                    console.error(`[AIService] ❌ Authentication failed. Please check your API Key in Settings.`);
                    throw e; // Immediate fail, no retry
                }

                if (e.message?.includes('429') || e.message?.includes('503')) {
                    // 1. Try to parse "Please try again in X s" or "Retry-After: X"
                    let waitTime = 0;
                    // Improved Regex: Case insensitive, handles whitespace, optional 's' or 'sec'
                    const match = e.message?.match(/try again in\s*(\d+(\.\d+)?)\s*s/i);
                    if (match && match[1]) {
                        waitTime = Math.ceil(parseFloat(match[1]) * 1000) + 1500; // Add 1.5s buffer
                        console.log(`[AIService] Rate Limit detected. Dynamic wait: ${waitTime}ms`);
                    }

                    // 2. Fallback to Exponential Backoff
                    const backoff = Math.min(60000, 2000 * Math.pow(2, i));
                    const finalDelay = Math.max(waitTime, backoff);

                    console.log(`[AIService] API Overloaded. Global Pause: ${finalDelay}ms...`);

                    // CRITICAL: Penalize global throttler to prevent concurrent requests from failing
                    aiThrottler.block(finalDelay);

                    // FALLBACK: If using Google and failing, define fallback for next attempts
                    // REMOVED: Do not force 'gemini-1.5-flash' as it may not exist for all users.
                    // if (this.getConfig().provider === 'google' && !currentModel) {
                    //      currentModel = 'gemini-1.5-flash'; 
                    // }

                    await new Promise(r => setTimeout(r, finalDelay));
                } else {
                    // For other errors, maybe short delay or break?
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }

        throw lastError || new Error(`AI generation failed for ${stage}`);
    }

    async generateSql(prompt: string, schemaContext: string): Promise<string> {
        try {
            const { prompt: fullPrompt, system } = PromptBuilder.buildSqlGenPrompt(prompt, schemaContext);
            const response = await this.callProvider(fullPrompt, system, false);
            return response.trim() || "-- No SQL generated";
        } catch (error: any) {
            console.error("AIService Error:", error);
            return `-- Error generating SQL: ${error.message}`;
        }
    }

    async fixSql(wrongSql: string, errorMsg: string, schemaContext: string): Promise<string> {
        try {
            const { prompt: fullPrompt, system } = PromptBuilder.buildSqlFixPrompt(wrongSql, errorMsg, schemaContext);
            const response = await this.callProvider(fullPrompt, system, false);
            return response.replace(/```sql|```/g, '').trim() || wrongSql;
        } catch (error: any) {
            return `-- AI Fix Failed: ${error.message}`;
        }
    }

    /**
     * Request 1: Consolidated Core Analysis (P1 + Lifecycle)
     */
    // =========================================================================
    // ATOMIC AI SERVICES (Decoupled Pipeline)
    // =========================================================================

    /** 0. Scene Probe (Intent Detection) */
    async generateSceneProbe(summary: AnalysisSummary): Promise<any> {
        const prompt = PromptBuilder.buildSceneProbePrompt(summary);
        return await this.robustCall<any>('probe', prompt, PromptBuilder.CORE_ENGINE_SYSTEM, true);
    }

    /** 1. Semantic Analysis */
    async generateSemanticColumns(summary: AnalysisSummary, userIntent: string = "EXPLORATION"): Promise<any[]> {
        // v4.0: Pass userIntent (Dynamic)
        const prompt = PromptBuilder.buildSemanticPrompt(summary, userIntent);
        const result = await this.robustCall<any>('semantic', prompt, PromptBuilder.CORE_ENGINE_SYSTEM, true);

        // Handle structured object { columns: [] } or raw array
        if (result && result.columns && Array.isArray(result.columns)) {
            return result.columns;
        }
        return Array.isArray(result) ? result : [];
    }

    /** 2. Quality Audit */
    async generateQualityReport(summary: AnalysisSummary): Promise<any> {
        const prompt = PromptBuilder.buildQualityPrompt(summary);
        return await this.robustCall<any>('quality', prompt, PromptBuilder.CORE_ENGINE_SYSTEM, true);
    }

    /** 3. SQL Operations */
    async generateSqlAssets(summary: AnalysisSummary, userIntent: string = "EXPLORATION"): Promise<any> {
        // v4.0: Pass userIntent
        const prompt = PromptBuilder.buildOperationsPrompt(summary, userIntent);

        let opsData: any = {};
        try {
            // v4.0: Expects Object { crud, transaction, scripts }
            opsData = await this.robustCall<any>('ops', prompt, PromptBuilder.CORE_ENGINE_SYSTEM, true);
        } catch (e) {
            console.warn("SQL Ops Generation partial fail, using templates only", e);
            opsData = { scripts: [] };
        }

        // 1. Inject Fixed Content (Templates) - Fulfills "Rebuild Fixed Content" Requirement
        const fixedCrud = PromptBuilder.TPL_CRUD(summary.tableName);
        opsData.crud = {
            ...fixedCrud, // Base: Static templates (Fallback)
            ...(opsData.crud || {}) // Override: High-quality AI generation (Priority)
        };

        // 2. Ensure Schema/View scripts exist or use Basic ones
        if (!opsData.scripts || !Array.isArray(opsData.scripts) || opsData.scripts.length === 0) {
            opsData.scripts = [{
                title: "基础查询 (Fallback)",
                category: "schema",
                interpretation: "生成基础数据预览",
                sql: `SELECT * FROM "${summary.tableName}" LIMIT 50;`,
                reversible: true
            }];
        }

        // Ensure scripts have IDs
        if (opsData && Array.isArray(opsData.scripts)) {
            opsData.scripts = opsData.scripts.map((op: any, idx: number) => ({ ...op, id: idx + 1 }));
        }

        return opsData;
    }

    // =========================================================================
    // UNIFIED MEGA-CALL (v6.0 Rate Limit Optimization)
    // =========================================================================

    /**
     * Single API call for all core analysis stages.
     * Combines: Probe + Semantic + Quality + Ops
     * Reduces 4 API calls to 1, staying within TPM limits.
     */
    async generateUnifiedAnalysis(summary: AnalysisSummary, userIntent: string = "EXPLORATION"): Promise<{
        probe: { recommendedIntent: string; sceneType?: string; confidence?: number };
        overview?: string;
        semantic: { columns: any[] };
        quality: { overallScore: number; issues: any[]; recommendations: string[] };
        snapshotInsights?: any[];
        keyMetrics?: any[];
        operations: { scripts: any[]; crud?: any };
    }> {
        const prompt = PromptBuilder.buildUnifiedAnalysisPrompt(summary, userIntent);

        let result = await this.robustCall<any>('unified', prompt, PromptBuilder.CORE_ENGINE_SYSTEM, true);

        // Normalize response structure
        if (!result.probe) result.probe = { recommendedIntent: 'EXPLORATION' };
        if (!result.overview) {
            result.overview = `Analysis of ${summary.tableName}. This dataset contains ${summary.rowCount} rows and ${summary.columnCount} columns. It appears to be a ${result.probe.sceneType || 'data'} asset refined for ${result.probe.recommendedIntent || 'analytical'} scenarios.`;
        }
        if (!result.semantic) result.semantic = { columns: [] };
        if (!result.quality) {
            result.quality = {
                overallScore: 85,
                issues: [
                    { column: 'GENERAL', type: 'Schema Consistency', severity: 'info', detail: 'Schema looks standard for DuckDB ingestion.', suggestion: 'Check for specific column constraints' }
                ],
                recommendations: ["Maintain consistent naming conventions", "Consider adding primary keys if not present"]
            };
        }
        if (!result.operations) result.operations = { scripts: [] };
        if (!result.keyMetrics) result.keyMetrics = [];

        if (!result.snapshotInsights || result.snapshotInsights.length === 0) {
            result.snapshotInsights = [
                { title: "Volume Profile", category: "driver", observation: `Dataset has ${summary.rowCount} records across ${summary.columnCount} dimensions.`, impact: "neutral" },
                { title: "Access Speed", category: "driver", observation: "Ingested into DuckDB's columnar storage for sub-millisecond querying.", impact: "positive" }
            ];
        }

        // Robust normalization for quality issues (support both string and object)
        if (Array.isArray(result.quality.issues)) {
            result.quality.issues = result.quality.issues.map((issue: any) => {
                if (typeof issue === 'string') {
                    return {
                        column: 'GENERAL',
                        type: 'Observation',
                        severity: 'info',
                        detail: issue,
                        suggestion: 'Review data profile for details'
                    };
                }
                return issue;
            });
        }

        // Inject Fixed Content (Templates) - Same as generateSqlAssets
        const fixedCrud = PromptBuilder.TPL_CRUD(summary.tableName);
        result.operations.crud = {
            ...fixedCrud, // Base
            ...(result.operations.crud || {}) // Override
        };

        // Ensure scripts have IDs
        if (result.operations.scripts && Array.isArray(result.operations.scripts)) {
            result.operations.scripts = result.operations.scripts.map((op: any, idx: number) => ({ ...op, id: idx + 1 }));
        } else {
            result.operations.scripts = [{
                id: 1,
                title: "基础查询 (Fallback)",
                category: "schema",
                interpretation: "生成基础数据预览",
                sql: `SELECT * FROM "${summary.tableName}" LIMIT 50;`,
                reversible: true
            }];
        }

        return result;
    }

    /** 4. Causal Graph */
    async generateCausalGraph(context: any): Promise<any> {
        // v4.0: Causal Graph is implicitly handled in Insights or skipped in Quick Mode
        return null;
    }

    /** 5. Deep Insights */
    async generateKeyInsights(context: any): Promise<any> {
        const prompt = PromptBuilder.buildInsightsPrompt(context);
        // v4.0: Expects Object { insights, metricDefinitions, dependencyGraph }
        return await this.robustCall<any>('insights', prompt, PromptBuilder.CORE_ENGINE_SYSTEM, true);
    }

    /** 6. Narrative Report */
    async generateAssetNarrative(context: any, fullResult: any): Promise<string> {
        const prompt = PromptBuilder.buildNarrativePrompt(context, fullResult);
        return await this.robustCall<string>('narrative', prompt, PromptBuilder.CORE_ENGINE_SYSTEM, false);
    }

    async unifiedChat(query: string, context: any): Promise<{ sql: string, explanation: string, suggestion: string }> {
        const prompt = PromptBuilder.buildUnifiedChatPrompt(query, context);

        const response = await this.callProvider(prompt, "Return structured JSON for BI assistant", true);
        try {
            const data = JSON.parse(response);
            return {
                sql: data.sql.replace(/```sql/g, "").replace(/```/g, "").trim(),
                explanation: data.explanation,
                suggestion: data.suggestion
            };
        } catch (e) {
            // Fallback: If JSON fails, try to extract SQL at least
            return {
                sql: response.includes("SELECT") ? response : "SELECT * FROM " + context.tableName + " LIMIT 10",
                explanation: "无法解析详细解释，请查看生成的 SQL。",
                suggestion: "尝试更具体地描述您的需求。"
            };
        }
    }

    // ===========================================
    // LAYER 4: INTELLIGENT EDITOR (v5.0)
    // ===========================================

    async generateRegex(exampleInput: string, targetOutput: string): Promise<any> {
        const prompt = PromptBuilder.buildRegexGenPrompt(exampleInput, targetOutput);
        return this.robustCall<any>('regex_gen', prompt, PromptBuilder.CORE_ENGINE_SYSTEM, true);
    }

    async fixSqlError(sql: string, error: string): Promise<any> {
        const prompt = PromptBuilder.buildFixErrorPrompt(sql, error);
        return this.robustCall<any>('fix_error', prompt, PromptBuilder.CORE_ENGINE_SYSTEM, true);
    }

    async generateSmartPivot(tableName: string, userPrompt: string): Promise<any> {
        const prompt = PromptBuilder.buildSmartPivotPrompt(tableName, userPrompt);
        return this.robustCall<any>('smart_pivot', prompt, PromptBuilder.CORE_ENGINE_SYSTEM, true);
    }

    async generateUnitTests(summary: AnalysisSummary): Promise<any> {
        const prompt = PromptBuilder.buildUnitTestPrompt(summary.tableName, summary);
        return this.robustCall<any>('unit_test', prompt, PromptBuilder.CORE_ENGINE_SYSTEM, true);
    }



    /**
     * Request 3: Final Asset Narrative Report (MVO for Asset Reporting)
     */
    async generateNarrativeReport(summary: AnalysisSummary, fullResult: any, onProgress?: (msg: string) => void): Promise<string> {
        const prompt = `你是一名资深数据资产审计师。请基于以下全量分析结果，撰写一份正式的《数据资产评估与深度洞察报告》。

      【分析摘要】
      - 数据规模: ${summary.rowCount} 行
      - 质量评分: ${fullResult.qualityReport?.overallScore || 'N/A'}
      - 核心指标: ${JSON.stringify(fullResult.metricScorecards?.map((s: any) => s.name))}
      - 业务洞察: ${JSON.stringify(fullResult.deepInsights?.map((i: any) => i.title))}

      【报告要求】
      2. 包含以下板块：
         - 资产概览：数据集的商业价值。
         - 质量评价：是否存在重大缺陷或治理建议。
         - 指标解读：核心发现与异动分析。
         - 行动指南：下一步的业务改进建议。
      3. 语气专业、精炼，使用中文。

      请包裹在 [NARRATIVE] 标签内输出。`;

        let narrative = "";
        onProgress?.("✍️ 正在撰写深度资产报告...");

        await this.robustCall<string>(
            'core_analysis',
            prompt,
            "请撰写深度资产报告",
            false,
            2,
            (chunk) => {
                narrative += chunk;
            }
        );

        const s = narrative.indexOf('[NARRATIVE]') + 11;
        const e = narrative.indexOf('[/NARRATIVE]');
        if (e > -1) return narrative.substring(s, e).trim();
        return narrative.replace(/\[\/?NARRATIVE\]/g, '').trim();
    }

    async fetchAvailableModels(): Promise<{ id: string; name: string }[]> {
        const config = this.getConfig();
        if (!config.apiKey) {
            throw new Error("API Key not configured. Please save your API key first.");
        }

        try {
            if (config.provider === 'google') {
                const ai = new GoogleGenAI({ apiKey: config.apiKey });
                const response = await ai.models.list();
                const models: { id: string; name: string }[] = [];
                for await (const model of response) {
                    if (model.name && model.displayName) {
                        models.push({
                            id: model.name.replace('models/', ''),
                            name: model.displayName
                        });
                    }
                }
                return models.length > 0 ? models : this.getDefaultModels(config.provider);
            } else {
                let baseUrl = config.baseUrl || (config.provider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1');
                baseUrl = baseUrl.replace(/\/chat\/completions\/?$/, '');
                const modelsUrl = `${baseUrl}/models`;

                try {
                    const response = await fetch(modelsUrl, {
                        headers: { 'Authorization': `Bearer ${config.apiKey}` }
                    });
                    if (!response.ok) throw new Error(`API returned ${response.status}`);
                    const data = await response.json();
                    const models = (data.data || [])
                        .filter((m: any) => m.id && !m.id.includes('whisper'))
                        .map((m: any) => ({ id: m.id, name: m.id }))
                        .sort((a: any, b: any) => a.name.localeCompare(b.name));
                    return models.length > 0 ? models : this.getDefaultModels(config.provider);
                } catch (fetchErr) {
                    return this.getDefaultModels(config.provider);
                }
            }
        } catch (error: any) {
            return this.getDefaultModels(config.provider);
        }
    }

    private getDefaultModels(provider: AIProvider): { id: string; name: string }[] {
        switch (provider) {
            case 'google':
                return [
                    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Exp)' },
                    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
                    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
                ];
            case 'groq':
                return [
                    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
                    { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B Versatile' },
                    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
                ];
            case 'openai':
            default:
                return [
                    { id: 'gpt-4o', name: 'GPT-4o' },
                    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
                ];
        }
    }
}

export const aiService = new AIService();
