/**
 * HandbookGenerator.ts
 * Streaming 3-batch Handbook generation engine
 * Part of AI Handbook Generation Architecture (Phase 8.1)
 */

import { aiService } from './aiService';
import { PromptBuilder } from './PromptBuilder';
import { erDetector, ERDiagram, ERColumn } from './ERDetector';
import { ColumnSemanticInfo, QualityReport } from '../types';

// Use ColumnSemanticInfo as SemanticColumn for internal consistency
type SemanticColumn = ColumnSemanticInfo;

// =========================================================================
// Types
// =========================================================================

export interface HandbookBatch {
    id: 'batch_1' | 'batch_2' | 'batch_3';
    title: string;
    modules: string[];
    status: 'pending' | 'generating' | 'complete' | 'error';
    content: string;
    tokenEstimate: number;
    error?: string;
    debugPrompt?: string;
}

export interface HandbookContext {
    tableName: string;
    rowCount: number;
    columnCount: number;
    columns: SemanticColumn[];
    erDiagram: ERDiagram;
    erColumns: ERColumn[];
    qualityReport: QualityReport | null;
    sampleData: string;
    seedInserts: string;
    sampleRows: any[];
    stats?: any[];
}

export interface HandbookResult {
    batches: HandbookBatch[];
    fullContent: string;
    generatedAt: Date;
    tableName: string;
}

// =========================================================================
// Batch Configuration
// =========================================================================

const BATCH_CONFIG: Array<Omit<HandbookBatch, 'content' | 'status' | 'error'>> = [
    {
        id: 'batch_1',
        title: '第一批次：基础与CRUD',
        modules: ['前言', '环境准备', '阅读约定', 'ER图', '种子数据', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', '快照A'],
        tokenEstimate: 4000,
    },
    {
        id: 'batch_2',
        title: '第二批次：关联与事务',
        modules: ['B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'D1', 'D2', 'D3', '快照B', '综合实战'],
        tokenEstimate: 5000,
    },
    {
        id: 'batch_3',
        title: '第三批次：高级与附录',
        modules: ['E1', 'E2', 'E3', 'F1', 'F2', 'F3', 'G1', 'G2', 'G3', 'G4', 'H1', 'H2', 'I1', 'I2', 'I3', '速查表', '知识地图'],
        tokenEstimate: 4000,
    },
];

// Cooldown between batches (ms) to avoid TPM limits
// 15s cooldown ensures TPM (8000) replenishes sufficiently between batches
const BATCH_COOLDOWN_MS = 15000;

// =========================================================================
// HandbookGenerator Class
// =========================================================================

export class HandbookGenerator {
    private context: HandbookContext | null = null;

    /**
     * Initialize context from analysis results
     */
    initContext(
        tableName: string,
        rowCount: number,
        columns: SemanticColumn[],
        qualityReport: QualityReport | null,
        sampleData: string,
        sampleRows: any[] = [],
        stats: any[] = []
    ): HandbookContext {
        // Detect ER relations
        const erColumns = erDetector.detectRelations(tableName, columns);
        const erDiagram = erDetector.generateMermaidER(tableName, erColumns);
        const seedInserts = erDetector.generateSeedInserts(tableName, erColumns, sampleRows);

        this.context = {
            tableName,
            rowCount,
            columnCount: columns.length,
            columns,
            erColumns,
            erDiagram,
            qualityReport,
            sampleData,
            seedInserts,
            sampleRows,
            stats
        };

        return this.context;
    }

    /**
     * Generate complete handbook in 3 batches with streaming callback
     */
    async generateHandbook(
        context: HandbookContext,
        onBatchComplete: (batch: HandbookBatch) => void,
        onProgress?: (message: string) => void
    ): Promise<HandbookResult> {
        this.context = context;
        const batches: HandbookBatch[] = BATCH_CONFIG.map(cfg => ({
            ...cfg,
            status: 'pending' as const,
            content: '',
        }));

        const completedBatches: HandbookBatch[] = [];

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];

            try {
                // Update status
                batch.status = 'generating';
                onProgress?.(`📝 生成 ${batch.title}...`);

                // Generate batch content
                const result = await this.generateBatch(batch.id, context);

                batch.content = result.content;
                batch.debugPrompt = result.prompt;
                batch.status = 'complete';
                completedBatches.push(batch);

                // Notify callback
                onBatchComplete(batch);
                onProgress?.(`✅ ${batch.title} 完成`);

                // Cooldown between batches (except last)
                if (i < batches.length - 1) {
                    onProgress?.(`⏳ 冷却 ${BATCH_COOLDOWN_MS / 1000}s...`);
                    await this.sleep(BATCH_COOLDOWN_MS);
                }

            } catch (error: any) {
                console.error(`[HandbookGenerator] Batch ${batch.id} failed:`, error);
                batch.status = 'error';
                batch.error = error.message || 'Unknown error';
                batch.content = this.generateFallbackContent(batch.id, context);
                completedBatches.push(batch);
                onBatchComplete(batch);
            }
        }

        // Combine all batches
        const fullContent = this.combineHandbook(completedBatches, context);

        return {
            batches: completedBatches,
            fullContent,
            generatedAt: new Date(),
            tableName: context.tableName,
        };
    }

    /**
     * Generate single batch content
     */
    private async generateBatch(batchId: string, context: HandbookContext): Promise<{ content: string; prompt: string }> {
        let prompt: string;

        switch (batchId) {
            case 'batch_1':
                prompt = PromptBuilder.buildHandbookBatch1Prompt(context);
                break;
            case 'batch_2':
                prompt = PromptBuilder.buildHandbookBatch2Prompt(context);
                break;
            case 'batch_3':
                prompt = PromptBuilder.buildHandbookBatch3Prompt(context);
                break;
            default:
                throw new Error(`Unknown batch: ${batchId}`);
        }

        const systemPrompt = `你是一位资深的 DuckDB 教程作者。请根据提供的上下文生成高质量的 Markdown 教程内容。
输出必须是纯 Markdown，遵循 SKL-000 协议的模块结构。
每个模块必须包含：🎯问题 + 📌语法模板 + 💻可执行示例 + 📊预期输出 + ⚠️易错点 + 🔗衔接。
所有 SQL 示例必须针对表 "${context.tableName}" 且可直接执行。`;

        // Call AI service (using narrative stage for markdown output)
        const result = await aiService.robustCall<string>(
            'narrative',
            prompt,
            systemPrompt,
            false // Not JSON, plain text
        );

        return { content: result, prompt };
    }

    /**
     * Generate fallback content when AI fails
     */
    private generateFallbackContent(batchId: string, context: HandbookContext): string {
        const tbl = context.tableName;

        switch (batchId) {
            case 'batch_1':
                return `## 第一批次（基础CRUD）

> ⚠️ AI 生成失败，以下为基础模板

### A1 ▸ INSERT — 数据写入

**📌 语法模板**
\`\`\`sql
INSERT INTO "${tbl}" (col1, col2) VALUES (v1, v2);
\`\`\`

### A2 ▸ SELECT — 基础查询

**📌 语法模板**
\`\`\`sql
SELECT * FROM "${tbl}" LIMIT 10;
\`\`\`
`;

            case 'batch_2':
                return `## 第二批次（关联与事务）

> ⚠️ AI 生成失败，以下为基础模板

### B1 ▸ INNER JOIN

**📌 语法模板**
\`\`\`sql
SELECT a.*, b.*
FROM "${tbl}" a
INNER JOIN other_table b ON a.id = b.${tbl}_id;
\`\`\`
`;

            case 'batch_3':
                return `## 第三批次（高级与附录）

> ⚠️ AI 生成失败，以下为基础模板

### E1 ▸ 窗口函数

**📌 语法模板**
\`\`\`sql
SELECT *, ROW_NUMBER() OVER (ORDER BY id) AS row_num
FROM "${tbl}";
\`\`\`

## 速查表

| 操作 | SQL |
|------|-----|
| 查询 | \`SELECT * FROM "${tbl}"\` |
| 统计 | \`SELECT COUNT(*) FROM "${tbl}"\` |
`;

            default:
                return `## 未知批次\n> 生成失败`;
        }
    }

    /**
     * Combine all batches into final handbook
     */
    private combineHandbook(batches: HandbookBatch[], context: HandbookContext): string {
        const header = this.generateHeader(context);
        const content = batches.map(b => b.content).join('\n\n---\n\n');

        return `${header}\n\n${content}`;
    }

    /**
     * Generate handbook header with TOC
     */
    private generateHeader(context: HandbookContext): string {
        const { tableName, rowCount, columnCount } = context;
        const now = new Date().toISOString().split('T')[0];

        return `# DuckDB 系统化 SQL 教程 —— 以「${tableName}」为例

> 📅 生成时间: ${now}
> 📊 数据规模: ${rowCount} 行 × ${columnCount} 列

---

## 目录总览

\`\`\`
第一批次（本批）
  0. 前言与环境准备
  1. 领域建模与数据初始化（ER 图 + 建表 + 种子数据）
  2. 模块 A：CRUD 操作（A1 → A6）
     📸 数据快照

第二批次
  3. 模块 B：多表连接（B1 → B4）
  4. 模块 C：视图（C1 → C3）
  5. 模块 D：事务控制（D1 → D3）
     📸 数据快照
  6. 综合实战：端到端分析查询

第三批次
  7.  模块 E：窗口函数（E1 → E3）
  8.  模块 F：数据导入导出（F1 → F3）
  9.  模块 G：高级数据处理函数（G1 → G4）
  10. 模块 H：PIVOT 与高级聚合（H1 → H2）
  11. 模块 I：性能分析与调试（I1 → I3）
  12. 速查备忘表（Cheat Sheet）
  13. 完整知识地图
\`\`\`
`;
    }

    /**
     * Helper: Sleep for ms
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton export
export const handbookGenerator = new HandbookGenerator();
