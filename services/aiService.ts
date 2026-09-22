import { GoogleGenAI, Type } from "@google/genai";
import { GenerationResult, AnalysisSummary, DriverAnalysis, CorrelationMatrix, DeepInsight } from '../types';
import type { ColumnAiProfile, ColumnsAiProfileResult, ColumnProfileInput } from '../types/ai';
import { AIValidator, AIStage } from './aiValidator';
import { PromptBuilder } from './PromptBuilder';
import { duckDBService } from './duckdbService';

export type AIProvider = 'google' | 'groq' | 'openai' | 'claude' | 'ollama' | 'lmstudio';

export interface AIConfig {
    provider: AIProvider;
    apiKey: string;
    baseUrl?: string;
    model: string;
}

async function extractErrorMessage(response: Response, defaultPrefix: string): Promise<string> {
    let errorDetails = response.statusText;
    try {
        const err = await response.json();
        if (typeof err === 'string') {
            errorDetails = err;
        } else if (typeof err.error === 'string') {
            errorDetails = err.error;
        } else if (err.error?.message) {
            errorDetails = err.error.message;
        } else if (err.message) {
            errorDetails = err.message;
        }
    } catch (_) {
        try {
            const txt = await response.text();
            if (txt) errorDetails = txt;
        } catch { /* ignore */ }
    }
    return `${defaultPrefix} (${response.status}): ${errorDetails}`;
}

/**
 * Global Throttler to enforce API cooldowns and prevent rate limits.
 */
class AIThrottler {
    private lastCallTimestamp: number = 0;
    private pausedUntil: number = 0; // New: Global pause timestamp
    private readonly COOLDOWN_MS = 5000; // 5s gap (aligned with standard 15 RPM)
    private queue: Promise<void> = Promise.resolve();

    async acquireLock(provider?: AIProvider): Promise<void> {
        const currentTask = this.queue.then(async () => {
            let now = Date.now();

            // 1. Check Global Pause (Rate Limit Penalty)
            if (now < this.pausedUntil) {
                const pauseWait = this.pausedUntil - now;
                console.log(`[AIThrottler] System globally paused for ${pauseWait}ms (Rate Limit)...`);
                await new Promise(r => setTimeout(r, pauseWait));
                now = Date.now(); // Update now after wait
            }

            // 2. Check Standard Cooldown (Bypass for local providers like Ollama / LM Studio)
            const isLocal = provider === 'ollama' || provider === 'lmstudio';
            const cooldown = isLocal ? 0 : this.COOLDOWN_MS;
            const elapsed = now - this.lastCallTimestamp;
            if (cooldown > 0 && elapsed < cooldown) {
                const wait = cooldown - elapsed;
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

    getRemainingTime(provider?: AIProvider): number {
        const now = Date.now();
        const pauseRemaining = Math.max(0, this.pausedUntil - now);
        const activeProvider = provider || (typeof localStorage !== 'undefined' ? localStorage.getItem('duckdb_ai_provider') as AIProvider : undefined);
        const isLocal = activeProvider === 'ollama' || activeProvider === 'lmstudio';
        if (isLocal) {
            return pauseRemaining;
        }
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
    private activeAbortController: AbortController | null = null;

    cancelActiveRequest(): boolean {
        if (!this.activeAbortController || this.activeAbortController.signal.aborted) return false;
        this.activeAbortController.abort();
        return true;
    }

    private getConfig(): AIConfig {
        const storedProvider = (localStorage.getItem('duckdb_ai_provider') as AIProvider) || 'google';
        const provider: AIProvider = ['google', 'groq', 'openai', 'claude', 'ollama', 'lmstudio'].includes(storedProvider) ? storedProvider : 'google';
        const apiKey = localStorage.getItem('duckdb_ai_api_key') || import.meta.env.VITE_API_KEY || (provider === 'ollama' ? 'ollama' : provider === 'lmstudio' ? 'lm-studio' : '');
        const baseUrl = localStorage.getItem('duckdb_ai_base_url') || (provider === 'ollama' ? 'http://localhost:11434' : provider === 'lmstudio' ? 'http://localhost:1234/v1' : '');
        const defaultModel = provider === 'google' ? 'gemini-2.0-flash-exp'
            : provider === 'claude' ? 'claude-sonnet-4-20250514'
            : provider === 'openai' ? 'gpt-4o'
            : provider === 'ollama' ? 'llama3.2'
            : provider === 'lmstudio' ? 'qwen2.5-coder-7b-instruct'
            : 'llama-3.3-70b-versatile';
        const model = localStorage.getItem('duckdb_ai_model') || defaultModel;

        return { provider, apiKey, baseUrl, model };
    }

    isConfigured(): boolean {
        const config = this.getConfig();
        if (config.provider === 'ollama' || config.provider === 'lmstudio') {
            return true;
        }
        return Boolean(config.apiKey && config.apiKey.trim().length > 0);
    }

    private async callProvider(
        prompt: string,
        systemInstruction?: string,
        isJSON: boolean = false,
        modelOverride?: string,
        onChunk?: (chunk: string) => void
    ): Promise<string> {
        const config = this.getConfig();
        // Enforce global throttling before any actual network request (local providers bypass 5s cooldown)
        await aiThrottler.acquireLock(config.provider);

        if (!config.apiKey && config.provider !== 'ollama' && config.provider !== 'lmstudio') throw new Error("AI API Key not configured");

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
        } else if (config.provider === 'claude') {
            // Anthropic Claude API
            const url = config.baseUrl || 'https://api.anthropic.com/v1/messages';
            const headers: Record<string, string> = {
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            };
            const body: Record<string, any> = {
                model: modelToUse,
                max_tokens: 4096,
                messages: [],
            };
            if (systemInstruction) {
                body.system = systemInstruction;
            }
            body.messages.push({ role: 'user', content: prompt });

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(await extractErrorMessage(response, 'Claude API Error'));
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
                            const text = json.choices?.[0]?.delta?.content || json.content?.[0]?.text || "";
                            if (text) {
                                fullText += text;
                                onChunk(text);
                            }
                        } catch (_) { /* ignore */ }
                    }
                }
                return fullText;
            } else {
                const data = await response.json();
                return data.content?.[0]?.text || "";
            }
        } else {
            // Groq / OpenAI / Ollama / LM Studio REST API
            let url = config.baseUrl || (config.provider === 'groq' ? 'https://api.groq.com/openai/v1' : config.provider === 'ollama' ? 'http://localhost:11434/v1' : config.provider === 'lmstudio' ? 'http://localhost:1234/v1' : 'https://api.openai.com/v1');
            url = url.replace(/\/+$/, '');
            if (!url.endsWith('/chat/completions')) {
                if ((config.provider === 'ollama' || config.provider === 'lmstudio') && !url.endsWith('/v1')) {
                    url = `${url}/v1/chat/completions`;
                } else {
                    url = `${url}/chat/completions`;
                }
            }

            const messages = [];
            if (systemInstruction) {
                messages.push({ role: 'system', content: systemInstruction });
            }
            messages.push({ role: 'user', content: prompt });

            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            if (config.apiKey && config.apiKey !== 'ollama' && config.apiKey !== 'lm-studio') {
                headers['Authorization'] = `Bearer ${config.apiKey}`;
            }

            const isLmStudio = config.provider === 'lmstudio' || url.includes(':1234');
            // LM Studio /v1/chat/completions strictly requires response_format.type to be 'json_schema' or 'text'.
            // Passing { type: 'json_object' } results in HTTP 400 Bad Request.
            // Other cloud providers like OpenAI and Groq support json_object.
            let responseFormat: { type: string } | undefined = (isJSON && !onChunk && !isLmStudio) ? { type: 'json_object' } : undefined;

            let response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: modelToUse,
                    messages,
                    response_format: responseFormat,
                    temperature: 0.1,
                    stream: !!onChunk
                })
            });

            // Resilient fallback: if the endpoint returns 400 when response_format was sent, retry once without it
            // (handles custom local/proxy OpenAI servers that do not support json_object)
            if (!response.ok && response.status === 400 && responseFormat) {
                console.warn('[AIService] 400 Bad Request with response_format, retrying without response_format...');
                responseFormat = undefined;
                response = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        model: modelToUse,
                        messages,
                        temperature: 0.1,
                        stream: !!onChunk
                    })
                });
            }

            if (!response.ok) {
                throw new Error(await extractErrorMessage(response, 'AI Provider Error'));
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

    async generateSql(
        prompt: string,
        schemaContext: string,
        onChunk?: (text: string) => void
    ): Promise<string> {
        try {
            const { prompt: fullPrompt, system } = PromptBuilder.buildSqlGenPrompt(prompt, schemaContext);
            const response = await this.callProvider(fullPrompt, system, false, undefined, onChunk);
            return response.trim() || "-- No SQL generated";
        } catch (error: any) {
            console.error("AIService Error:", error);
            if (error.message?.includes("API Key not configured")) {
                throw error;
            }
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
     * Build a compact text summary of a QueryResult suitable for AI context.
     * Includes column names + first 3 sample rows. Returns '' on failure.
     */
    private summarizeQueryResult(queryResult: any): string {
        try {
            if (!queryResult) return '';
            const cols: string[] = Array.isArray(queryResult.columns) ? queryResult.columns : [];
            const rows: any[] = Array.isArray(queryResult.rows) ? queryResult.rows : [];
            const totalRows = queryResult.totalRows ?? rows.length;
            const sampleRows = rows.slice(0, 3).map((r: any) => {
                if (!Array.isArray(r)) return JSON.stringify(r);
                return '[' + r.slice(0, 6).map((v: any) => {
                    if (v === null || v === undefined) return 'NULL';
                    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
                    return s.length > 24 ? s.slice(0, 24) + '…' : s;
                }).join(', ') + (r.length > 6 ? ', ...]' : ']');
            });
            return [
                `总行数: ${totalRows}`,
                `列 (${cols.length}): ${cols.join(', ') || '(无列)'}`,
                ...(sampleRows.length ? ['前 3 行样本:'] : []),
                ...sampleRows.map(r => `  ${r}`),
            ].join('\n');
        } catch {
            return '';
        }
    }

    /**
     * Resolve schema context from DuckDB. Falls back to '' when unavailable.
     */
    private async resolveSchemaContext(): Promise<string> {
        try {
            const ctx = await duckDBService.getSchemaContext();
            if (!ctx || typeof ctx !== 'object') return '';
            // Format: "tableA(col1 TYPE, col2 TYPE, ...); tableB(...)"
            return Object.entries(ctx)
                .map(([table, cols]: [string, any]) => {
                    const colList = Array.isArray(cols)
                        ? cols.map((c: any) => `${c.name} ${c.type || 'VARCHAR'}`).join(', ')
                        : '';
                    return `${table}(${colList})`;
                })
                .slice(0, 40) // cap to top 40 tables to avoid blowing up the prompt
                .join('; ');
        } catch {
            return '';
        }
    }

    /**
     * Workbench AI Assistant — 解释当前 SQL 的语义与执行逻辑。
     * Returns a structured object with oneLiner / logicSteps / involvedObjects / outputFields / keyConditions.
     */
    async explainSql(
        sql: string,
        options?: { schemaContext?: string; queryResult?: any; onChunk?: (text: string) => void }
    ): Promise<{
        oneLiner: string;
        logicSteps: string[];
        involvedObjects: { name: string; alias?: string }[];
        outputFields: { name: string; type: string; meaning: string }[];
        keyConditions: { label: string; expression: string; note: string }[];
    }> {
        const schema = options?.schemaContext ?? (await this.resolveSchemaContext());
        const resultSummary = this.summarizeQueryResult(options?.queryResult);
        const prompt = PromptBuilder.buildSqlExplainPrompt(sql, schema, resultSummary);
        return await this.robustCall<any>('sql_explain', prompt, PromptBuilder.CORE_ENGINE_SYSTEM, true, 2, options?.onChunk);
    }

    /**
     * Workbench AI Assistant — 分析当前 SQL 的业务风险 / 性能关注 / 结果洞察 / 优化建议。
     * Returns a structured object suitable for the Analyze tab UI.
     */
    async analyzeSql(
        sql: string,
        options?: { schemaContext?: string; queryResult?: any; onChunk?: (text: string) => void }
    ): Promise<{
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
    }> {
        const schema = options?.schemaContext ?? (await this.resolveSchemaContext());
        const resultSummary = this.summarizeQueryResult(options?.queryResult);
        const prompt = PromptBuilder.buildSqlAnalyzePrompt(sql, schema, resultSummary);
        return await this.robustCall<any>('sql_analyze', prompt, PromptBuilder.CORE_ENGINE_SYSTEM, true, 2, options?.onChunk);
    }

    // =========================================================================
    // v6.2: Workbench AI Assistant — Column Profiling (单列 / 批量)
    // =========================================================================

    /**
     * 单列 AI 解读 - 业务含义 + 语义类型 + 质量风险 + 使用建议。
     * 适合: 用户在 Inspector 中选中某列，需要详细解读。
     */
    async profileColumn(
        columnName: string,
        columnData: ColumnProfileInput['data'],
        options?: { schemaContext?: string; queryResult?: any; onChunk?: (text: string) => void }
    ): Promise<ColumnAiProfile> {
        if (!this.isConfigured()) {
            throw new Error('尚未配置 AI 服务 (请在设置中填写 API Key)');
        }
        if (!columnName || !columnData) {
            throw new Error('列名与列画像数据不能为空');
        }

        const schema = options?.schemaContext ?? (await this.resolveSchemaContext());
        const prompt = PromptBuilder.buildColumnProfilePrompt(
            {
                columnName,
                columnType: columnData.columnType || 'VARCHAR',
                isNumeric: columnData.isNumeric ?? false,
                isDate: columnData.isDate ?? false,
                totalRows: columnData.totalRows ?? 0,
                nullCount: columnData.nullCount ?? 0,
                nullPct: columnData.nullPct || '0.00%',
                distinctCount: columnData.distinctCount ?? 0,
                distinctPct: columnData.distinctPct || '0.00%',
                min: columnData.min,
                max: columnData.max,
                avg: columnData.avg,
                median: columnData.median,
                sum: columnData.sum,
                topValues: columnData.topValues || [],
                sampleValues: columnData.sampleValues || [],
            },
            schema
        );
        const result = await this.robustCall<any>('sql_column_profile', prompt, PromptBuilder.CORE_ENGINE_SYSTEM, true, 2, options?.onChunk);
        return { columnName, ...result } as ColumnAiProfile;
    }

    /**
     * 批量列 AI 解读 - 单次 API 调用覆盖 ≤8 列。
     * 适合: Inspector 中一次性展示多列 AI 解读，节省 token 与限速次数。
     *
     * 错误码:
     * - columns.length === 0 → "没有需要分析的列"
     * - columns.length > 8    → "批量列画像最多支持 8 列/次"
     * - !isConfigured()       → "尚未配置 AI 服务"
     */
    async profileColumns(
        columns: ColumnProfileInput[],
        options?: { schemaContext?: string; queryResult?: any; onChunk?: (text: string) => void }
    ): Promise<ColumnsAiProfileResult> {
        const MAX_BATCH = 8;
        if (!this.isConfigured()) {
            throw new Error('尚未配置 AI 服务 (请在设置中填写 API Key)');
        }
        if (!Array.isArray(columns) || columns.length === 0) {
            throw new Error('没有需要分析的列');
        }
        if (columns.length > MAX_BATCH) {
            throw new Error(`批量列画像最多支持 ${MAX_BATCH} 列/次，当前传入 ${columns.length} 列`);
        }

        const schema = options?.schemaContext ?? (await this.resolveSchemaContext());
        const normalizedColumns = columns.map(c => ({
            columnName: c.columnName,
            columnType: c.data.columnType || 'VARCHAR',
            isNumeric: c.data.isNumeric ?? false,
            isDate: c.data.isDate ?? false,
            totalRows: c.data.totalRows ?? 0,
            nullCount: c.data.nullCount ?? 0,
            nullPct: c.data.nullPct || '0.00%',
            distinctCount: c.data.distinctCount ?? 0,
            distinctPct: c.data.distinctPct || '0.00%',
            topValues: c.data.topValues || [],
            sampleValues: c.data.sampleValues || [],
        }));
        const prompt = PromptBuilder.buildColumnsProfilePrompt(normalizedColumns, schema);
        return await this.robustCall<ColumnsAiProfileResult>('sql_columns_profile', prompt, PromptBuilder.CORE_ENGINE_SYSTEM, true, 2, options?.onChunk);
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

    async diagnoseConnection(configOverride?: Partial<AIConfig>): Promise<{
        success: boolean;
        latencyMs: number;
        modelCount: number;
        models: { id: string; name: string }[];
        message: string;
        errorCategory?: 'service_not_running' | 'unreachable' | 'auth_failed' | 'timeout' | 'model_not_found' | 'other';
    }> {
        const config = { ...this.getConfig(), ...configOverride };
        const startTime = Date.now();

        if (config.provider === 'ollama') {
            const rawBaseUrl = (config.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
            const rootUrl = rawBaseUrl.replace(/\/v1\/?$/, '');

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);

                const response = await fetch(`${rootUrl}/api/tags`, {
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                const latencyMs = Date.now() - startTime;

                if (response.ok) {
                    const data = await response.json();
                    const models = Array.isArray(data.models) ? data.models.map((m: any) => ({
                        id: m.name || m.model,
                        name: `${m.name || m.model}${m.size ? ` (${(m.size / (1024 * 1024 * 1024)).toFixed(1)} GB)` : ''}`,
                    })) : [];

                    return {
                        success: true,
                        latencyMs,
                        modelCount: models.length,
                        models,
                        message: `已连接本地 Ollama (延迟: ${latencyMs}ms，已安装 ${models.length} 个模型)`,
                    };
                } else if (response.status === 401 || response.status === 403) {
                    return {
                        success: false,
                        latencyMs,
                        modelCount: 0,
                        models: [],
                        message: '认证失败: Ollama 实例启用了访问鉴权',
                        errorCategory: 'auth_failed',
                    };
                } else {
                    return {
                        success: false,
                        latencyMs,
                        modelCount: 0,
                        models: [],
                        message: `Endpoint 无法正常连接 (HTTP ${response.status})`,
                        errorCategory: 'unreachable',
                    };
                }
            } catch (err: any) {
                const latencyMs = Date.now() - startTime;
                if (err.name === 'AbortError') {
                    return {
                        success: false,
                        latencyMs,
                        modelCount: 0,
                        models: [],
                        message: '请求超时: 无法在 4 秒内收到本地 Ollama 响应',
                        errorCategory: 'timeout',
                    };
                }
                return {
                    success: false,
                    latencyMs,
                    modelCount: 0,
                    models: [],
                    message: `Ollama 服务未启动或无法访问 (${rootUrl})`,
                    errorCategory: 'service_not_running',
                };
            }
        } else if (config.provider === 'lmstudio') {
            const rawBaseUrl = (config.baseUrl || 'http://localhost:1234/v1').replace(/\/+$/, '');
            const rootUrl = rawBaseUrl.replace(/\/v1\/?$/, '');

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);

                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (config.apiKey && config.apiKey !== 'lm-studio' && config.apiKey !== 'ollama') {
                    headers['Authorization'] = `Bearer ${config.apiKey}`;
                }

                const response = await fetch(`${rootUrl}/v1/models`, {
                    signal: controller.signal,
                    headers,
                });
                clearTimeout(timeoutId);
                const latencyMs = Date.now() - startTime;

                if (response.ok) {
                    const data = await response.json();
                    const models = Array.isArray(data.data) ? data.data
                        .filter((m: any) => m.id)
                        .map((m: any) => ({
                            id: m.id,
                            name: `${m.id}${m.state === 'loaded' ? ' (已加载)' : ''}`,
                        })) : [];

                    return {
                        success: true,
                        latencyMs,
                        modelCount: models.length,
                        models,
                        message: models.length > 0
                            ? `已连接本地 LM Studio (延迟: ${latencyMs}ms，检测到 ${models.length} 个可用模型)`
                            : `已连接本地 LM Studio (延迟: ${latencyMs}ms，当前暂未加载模型，请在 LM Studio 中加载模型)`,
                    };
                } else if (response.status === 401 || response.status === 403) {
                    return {
                        success: false,
                        latencyMs,
                        modelCount: 0,
                        models: [],
                        message: '认证失败: LM Studio 服务启用了 API Key 鉴权',
                        errorCategory: 'auth_failed',
                    };
                } else {
                    return {
                        success: false,
                        latencyMs,
                        modelCount: 0,
                        models: [],
                        message: `Endpoint 无法正常连接 (HTTP ${response.status})`,
                        errorCategory: 'unreachable',
                    };
                }
            } catch (err: any) {
                const latencyMs = Date.now() - startTime;
                if (err.name === 'AbortError') {
                    return {
                        success: false,
                        latencyMs,
                        modelCount: 0,
                        models: [],
                        message: '请求超时: 无法在 4 秒内收到本地 LM Studio 响应',
                        errorCategory: 'timeout',
                    };
                }
                return {
                    success: false,
                    latencyMs,
                    modelCount: 0,
                    models: [],
                    message: `LM Studio 本地服务未启动或无法访问 (${rootUrl})`,
                    errorCategory: 'service_not_running',
                };
            }
        } else {
            // Cloud providers
            if (!config.apiKey?.trim()) {
                return {
                    success: false,
                    latencyMs: 0,
                    modelCount: 0,
                    models: [],
                    message: '认证失败: 尚未填写 API Key',
                    errorCategory: 'auth_failed',
                };
            }

            try {
                const models = await this.fetchAvailableModels();
                const latencyMs = Date.now() - startTime;
                return {
                    success: true,
                    latencyMs,
                    modelCount: models.length,
                    models,
                    message: `已连接 ${config.provider} (延迟: ${latencyMs}ms，检测到 ${models.length} 个可用模型)`,
                };
            } catch (err: any) {
                const latencyMs = Date.now() - startTime;
                return {
                    success: false,
                    latencyMs,
                    modelCount: 0,
                    models: [],
                    message: `连接失败: ${err.message || '网络请求错误'}`,
                    errorCategory: 'other',
                };
            }
        }
    }

    async fetchAvailableModels(): Promise<{ id: string; name: string }[]> {
        const config = this.getConfig();
        if (!config.apiKey && config.provider !== 'ollama' && config.provider !== 'lmstudio') {
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
            } else if (config.provider === 'ollama') {
                const rawBaseUrl = (config.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
                const rootUrl = rawBaseUrl.replace(/\/v1\/?$/, '');

                // 1. First attempt: Standard Ollama /api/tags endpoint listing currently downloaded/installed models
                try {
                    const response = await fetch(`${rootUrl}/api/tags`);
                    if (response.ok) {
                        const data = await response.json();
                        if (Array.isArray(data.models) && data.models.length > 0) {
                            return data.models.map((m: any) => {
                                const id = m.name || m.model;
                                const sizeGB = m.size ? ` (${(m.size / (1024 * 1024 * 1024)).toFixed(1)} GB)` : '';
                                return { id, name: `${id}${sizeGB}` };
                            });
                        }
                    }
                } catch (tagErr) {
                    console.warn('[AIService] Ollama /api/tags request failed, trying /v1/models...', tagErr);
                }

                // 2. Second attempt: OpenAI compatible /v1/models on Ollama
                try {
                    const response = await fetch(`${rootUrl}/v1/models`);
                    if (response.ok) {
                        const data = await response.json();
                        const models = (data.data || [])
                            .filter((m: any) => m.id)
                            .map((m: any) => ({ id: m.id, name: m.id }))
                            .sort((a: any, b: any) => a.name.localeCompare(b.name));
                        if (models.length > 0) return models;
                    }
                } catch (v1Err) {
                    console.warn('[AIService] Ollama /v1/models request failed, using default models...', v1Err);
                }

                return this.getDefaultModels(config.provider);
            } else if (config.provider === 'lmstudio') {
                const rawBaseUrl = (config.baseUrl || 'http://localhost:1234/v1').replace(/\/+$/, '');
                const rootUrl = rawBaseUrl.replace(/\/v1\/?$/, '');

                try {
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (config.apiKey && config.apiKey !== 'lm-studio' && config.apiKey !== 'ollama') {
                        headers['Authorization'] = `Bearer ${config.apiKey}`;
                    }
                    const response = await fetch(`${rootUrl}/v1/models`, { headers });
                    if (response.ok) {
                        const data = await response.json();
                        const models = (data.data || [])
                            .filter((m: any) => m.id)
                            .map((m: any) => ({
                                id: m.id,
                                name: `${m.id}${m.state === 'loaded' ? ' (已加载)' : ''}`,
                            }))
                            .sort((a: any, b: any) => a.name.localeCompare(b.name));
                        if (models.length > 0) return models;
                    }
                } catch (err) {
                    console.warn('[AIService] LM Studio /v1/models request failed, using default models...', err);
                }

                return this.getDefaultModels(config.provider);
            } else {
                let baseUrl = config.baseUrl || (config.provider === 'groq' ? 'https://api.groq.com/openai/v1' : config.provider === 'claude' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1');
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
                return [
                    { id: 'gpt-4o', name: 'GPT-4o' },
                    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
                ];
            case 'claude':
                return [
                    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (May 2025)' },
                    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
                    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
                ];
            case 'ollama':
                return [
                    { id: 'llama3.2', name: 'Llama 3.2 (Local)' },
                    { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder (Local)' },
                    { id: 'deepseek-r1', name: 'DeepSeek R1 (Local)' },
                    { id: 'mistral', name: 'Mistral (Local)' },
                    { id: 'codellama', name: 'CodeLlama (Local)' },
                ];
            case 'lmstudio':
                return [
                    { id: 'qwen2.5-coder-7b-instruct', name: 'Qwen 2.5 Coder 7B (LM Studio)' },
                    { id: 'deepseek-r1-distill-qwen-7b', name: 'DeepSeek R1 Distill Qwen 7B (LM Studio)' },
                    { id: 'llama-3.2-3b-instruct', name: 'Llama 3.2 3B (LM Studio)' },
                    { id: 'mistral-nemo-instruct-2407', name: 'Mistral Nemo 12B (LM Studio)' },
                ];
            default:
                return [];
        }
    }
}

export const aiService = new AIService();
