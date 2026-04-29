import { GenerationResult, AnalysisSummary, DriverAnalysis, CorrelationMatrix, DeepInsight } from '../types';
import { AI_SCHEMA, AISchemaBlock } from './generated/aiSchema';
import { AIModule } from './aiSchemaTypes';

/**
 * =========================================================================================
 * DUCKDB AI SCHEMA v4.0 & v5.0
 * 
 * Architecture:
 * - Layer 1: Core Engine (System Prompts, Rules, Modes) - Injected as "System"
 * - Layer 2: Functional Modules (Semantic, Quality, SQL, Insight, Report) - User Prompts
 * - Layer 3: Template Library (Stats, CRUD, Join) - Reusable SQL Fragments
 * - Layer 4: Intelligent Editor (Regex, Fix, Assert, Pivot) - Co-Pilot Features
 * =========================================================================================
 */

export class PromptBuilder {

  // ===========================================
  // LAYER 3: TEMPLATE LIBRARY (Static)
  // ===========================================

  static TPL_CRUD(tableName: string): any {
    return {
      create: [`INSERT INTO "${tableName}" VALUES (...);`],
      read: [
        `SELECT * FROM "${tableName}" LIMIT 20;`,
        `SELECT count(*) FROM "${tableName}";`
      ],
      update: [`UPDATE "${tableName}" SET col = val WHERE id = ...;`],
      delete: [`DELETE FROM "${tableName}" WHERE id = ...;`],
      extras: [
        `SELECT * FROM "${tableName}.csv";`,
        `COPY "${tableName}" TO 'out.parquet' (FORMAT PARQUET);`
      ]
    };
  }

  static TPL_STATS(tableName: string, col: string): string {
    return `SELECT 
    COUNT(*) AS cnt,
    SUM("${col}") AS total,
    AVG("${col}")::INTEGER AS avg,
    MEDIAN("${col}")::INTEGER AS median,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY "${col}") AS p25,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "${col}") AS p75,
    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY "${col}") AS p90,
    MIN("${col}") AS min,
    MAX("${col}") AS max,
    STDDEV("${col}") AS stddev
FROM "${tableName}";`;
  }

  // ===========================================
  // LAYER 1: CORE ENGINE (System Prompts)
  // ===========================================

  static get CORE_ENGINE_SYSTEM(): string {
    return `## 系统身份
你是一名“DuckDB 资深数据工程架构师”。你不仅分析数据，更是在为用户构建一套可维护、可执行的“数据资产工程手册”。

## 核心规则
【输出协议 (SKL-000)】
- 每一项分析结论必须包含：🎯问题、📌模板、💻示例、📊输出、⚠️实践、🔗衔接。
- 逻辑表达：优先使用 CTE (SKL-203) 和 MACRO (SKL-304) 封装。

【认知原则】
- 渐进洞察：从物理感知 (Perception) 到业务策略 (Strategy) 再到资产固化 (Execution)。
- 溯源透明：每一条结论必须提供 SQL 推导物理证据 (SKL-402)。

【输出规范】
- 进度指示: "⏱ Stage N/6 | 阶段名 | 状态"
- 变量规范: {tableName}, {columnName}, {rowCount}`;
  }

  // ===========================================
  // LAYER 2: FUNCTIONAL MODULES (User Prompts)
  // ===========================================

  // ===========================================
  // LAYER 2: COGNITIVE SKILLS (v5.1 - SKL-1xx, 2xx, 3xx)
  // ===========================================

  private static injectSkills(ids: string[]): string {
    // SKL-403: 语义压缩与动态注入逻辑
    return ids.map(id => {
      const skill = AI_SCHEMA.skills[id];
      if (!skill) return "";
      return `\n\n### [SKL-${id}] ${skill.title}\n${skill.fullContent}`;
    }).join("");
  }

  /**
   * Stage 0: Scene Probe (Intent Detection) - Perception Layer
   */
  static buildSceneProbePrompt(summary: AnalysisSummary): string {
    const baseIds = ['000-protocol', '101-semantic', '401-alc'];
    const probeIds = ['103-time', '104-relation', '105-localization', '106-drift'];

    // SKL-403: 初始感知阶段注入所有探针，后续阶段将根据 Stage 0 的 JSON 结果进行重选
    const skills = this.injectSkills([...baseIds, ...probeIds]);

    let prompt = `# Stage 0: 场景探针与意图识别\n${skills}`;

    return prompt
      .replace(/\${tableName}/g, summary.tableName)
      .replace(/\${rowCount}/g, summary.rowCount.toString())
      .replace(/\${colCount}/g, summary.columnCount.toString())
      .replace(/\${sampleData}/g, summary.sampleData || "")
      + "\n\n## Output Format (JSON Only)\nRETURN ONLY JSON OBJECT.";
  }

  /**
   * Stage 1: Semantic Analysis - Perception Layer
   */
  static buildSemanticPrompt(summary: AnalysisSummary, userIntent: string = "EXPLORATION"): string {
    const skills = this.injectSkills(['101-semantic', '201-governance', '205-compliance', '206-metric']);
    let prompt = `# Stage 1: 语义推断与指标语义工场\n${skills}`;

    prompt = prompt
      .replace(/\${tableName}/g, summary.tableName)
      .replace(/\${userIntent}/g, userIntent)
      .replace(/\${sampleData}/g, summary.sampleData || "");

    return prompt + `\n\n## Output Format (JSON Only)\nRETURN ONLY JSON OBJECT { recommendedIntent, columns: [] }.`;
  }

  /**
   * Stage 2: Quality Audit - Perception Layer
   */
  static buildQualityPrompt(summary: AnalysisSummary): string {
    const skills = this.injectSkills(['102-quality', '201-governance']);
    let prompt = `# Stage 2: 质量审计与安全合约\n${skills}`;

    const stats = summary.stats ? JSON.stringify(summary.stats, null, 2) : "N/A";

    prompt = prompt
      .replace(/\${tableName}/g, summary.tableName)
      .replace(/\${stats}/g, stats);

    return prompt + `\n\n## Output Format (JSON Only)\nRETURN ONLY JSON OBJECT { overallScore, issues: [], recommendations: [] }.`;
  }

  /**
   * Stage 3: SQL Operations - Execution Layer
   */
  static buildOperationsPrompt(summary: AnalysisSummary, userIntent: string = "EXPLORATION"): string {
    const skills = this.injectSkills(['301-sql', '302-safety', '203-cte', '204-wasm', '304-macro', '305-assertion', '308-snapshot']);
    let prompt = `# Stage 3: SQL 自动化工程、宏与断言验证\n${skills}`;

    prompt = prompt
      .replace(/\${tableName}/g, summary.tableName)
      .replace(/\${userIntent}/g, userIntent);

    // Context Injection for Realistic SQL
    const dataContext = this.buildDataContext(summary);
    const rules = `
## CRITICAL INSTRUCTION: REALISTIC SQL GENERATION
1. **NO PLACEHOLDERS**: You MUST NOT use generic placeholders like 'val', 'col', 'id=...'.
2. **USE REAL VALUES**:
   - For INSERT: Generate a valid row using actual column names and realistic values from the stats/samples above.
   - For UPDATE: Choose a meaningful column (e.g. status, updated_at) and a specific condition based on real data (e.g. 'WHERE status = "PENDING"').
   - For DELETE: Use a specific, safe condition (e.g. 'WHERE id = 101' or 'WHERE created_at < "2023-01-01"').
3. **SYNTAX VALIDITY**: Ensure all SQL is valid DuckDB syntax. Quote identifier names if they contain special characters.
`;

    return prompt + `\n\n${dataContext}\n${rules}\n\n## Output Format (JSON Only)\nRETURN ONLY JSON OBJECT { crud, transaction, scripts }.`;
  }

  /**
   * Stage 4 & 5: Insight Modeling - Strategy Layer
   */
  static buildInsightsPrompt(context: any): string {
    const skills = this.injectSkills(['202-insight', '206-metric']);
    let prompt = `# Stage 4/5: 洞察建模与业务解释\n${skills}`;

    const anomalies = context.anomalies ? JSON.stringify(context.anomalies.slice(0, 5)) : "[]";
    const metrics = context.metrics ? JSON.stringify(context.metrics) : "[]";

    prompt = prompt
      .replace(/\${tableName}/g, context.tableName)
      .replace(/\${anomalies}/g, anomalies)
      .replace(/\${metrics}/g, metrics);

    const structure = `
## Output Format (JSON Only)
RETURN ONLY JSON OBJECT matching this structure:
{
  "insights": [ 
    { "title": "...", "observation": "...", "impact": "positive|negative", "category": "driver|anomaly" }
  ],
  "keyMetrics": [
    {
      "name": "Metric Name (e.g. ARPU)",
      "formula": "Calculation Formula (e.g. SUM(revenue)/COUNT(users))",
      "visual": "bar | line | number",
      "impact": "Core Business Value (Why it matters) - Explain in Chinese",
      "explanation": "Detailed Metric Definition & Context - Explain in Chinese",
      "unit": "currency | percentage | count"
    }
  ]
}`;

    return prompt + `\n\n${structure}`;
  }

  /**
   * Stage 6: Asset Handbook Weaver - Evolution Layer (v5.3 Style Alignment)
   */
  static buildNarrativePrompt(context: any, fullResult: any): string {
    const skills = this.injectSkills(['000-protocol', '101-semantic', '104-relation', '303-report', '402-trace', '405-ceo', '404-dbt']);
    let prompt = `# Stage 6: 生成最终版《数据资产工程手册》

## 任务目标
你现在需要将分析结果编织成一份与 @[效果参照.md] 风格完全一致的专业工程手册。

## 手册必须包含的顶层结构：
1. **标题**: # DuckDB 系统化 SQL 教程 —— 以「${context.tableName}」为例
2. **目录总览**: 
   - 使用 Markdown 代码块展示。
   - 分为“第一批次（本批）”、“第二批次”等。
3. **前言与环境准备**: 描述 DuckDB/WASM 环境适配。
4. **阅读约定**: 
   - 提供符号对照表（📸 数据快照, ⚠️ 易错点, -- ← 已修改 等）。
5. **领域建模 (ER 图)**: 
   - 必须使用 \`mermaid erDiagram\` 展示物理到逻辑的映射。
6. **精选模块内容**: 
   - 至少包含 5-8 个基于 [SKL-000] 格式的模块（🎯, 📌, 💻, 📊, ⚠️, 🔗）。
7. **数据快照 (📸)**: 手册末尾必须展示当前分析后的表数据预览。

${skills}`;

    const insights = fullResult.deepInsights ? JSON.stringify(fullResult.deepInsights.slice(0, 5)) : "[]";
    const score = fullResult.qualityReport?.overallScore || 0;

    prompt = prompt
      .replace(/\${tableName}/g, context.tableName)
      .replace(/\${score}/g, score.toString())
      .replace(/\${insights}/g, insights);

    return prompt + `\n\n## Output Guidance\n输出格式必须是纯 Markdown，禁止冗余解释，直接开始手册正文。`;
  }


  // ===========================================
  // LAYER 4: INTELLIGENT EDITOR (v5.0)
  // ===========================================

  /**
   * MOD_REGEX_GEN
   */
  static buildRegexGenPrompt(exampleInput: string, targetOutput: string): string {
    return `# MOD_REGEX_GEN
## 任务
生成 DuckDB 正则表达式 (regexp_extract / regexp_replace) 以匹配转换规则。

## 示例
输入: "${exampleInput}"
目标: "${targetOutput}"

## 输出 (JSON Only)
{ "sql_pattern": "regexp_extract(col, 'pattern', 1)", "explanation": "..." }
仅仅返回 JSON 对象。`;
  }

  /**
   * MOD_FIX_ERROR
   */
  static buildFixErrorPrompt(wrongSql: string, errorMsg: string): string {
    const skills = this.injectSkills(['307-healing']);
    return `# MOD_FIX_ERROR
## 任务
修复 SQL 语法错误。返回最小改动 Diff。

${skills}

## 错误上下文
SQL: ${wrongSql}
Error: ${errorMsg}

## 输出 (JSON Only)
{ "fixed_sql": "Valid DuckDB SQL", "diff_explanation": "..." }
仅仅返回 JSON 对象。`;
  }

  /**
   * MOD_SMART_PIVOT
   */
  static buildSmartPivotPrompt(tableName: string, prompt: string): string {
    return `# MOD_SMART_PIVOT
## 任务
根据用户描述生成 DuckDB PIVOT 语句。
表: ${tableName}
描述: ${prompt}

## 输出 (JSON Only)
{ "sql": "PIVOT ...", "structure": { "rows": [], "cols": [], "values": [] } }
仅仅返回 JSON 对象。`;
  }

  /**
   * MOD_UNIT_TEST
   */
  static buildUnitTestPrompt(tableName: string, schemaSummary: any): string {
    return `# MOD_UNIT_TEST
## 任务
为数据表生成 3-5 个数据质量断言测试 (Assertions)。
表: ${tableName}
Schema: ${JSON.stringify(schemaSummary)}

## 规则
- 使用 'SELECT count(*) FROM table WHERE <bad_condition>' 形式
- 结果应为 0 表示通过

## 输出 (JSON Only)
{ "tests": [ { "name": "...", "sql": "...", "severity": "critical" } ] }
仅仅返回 JSON 对象。`;
  }

  // ===========================================
  // UTILS
  // ===========================================

  static buildUnifiedChatPrompt(query: string, context: any): string {
    return `你是一名 DuckDB 专家。
    【上下文】
    - 表: ${context.tableName}
    
    【问题】: "${query}"
    
    【输出 JSON】: { "sql": "SELECT...", "explanation": "解释", "suggestion": "追问" }`;
  }

  static buildSqlGenPrompt(prompt: string, schemaContext: string): { prompt: string, system: string } {
    return {
      prompt: `Schema:\n${schemaContext}\n\nQuestion: ${prompt}`,
      system: "You are a DuckDB SQL expert. Return ONLY raw SQL."
    };
  }

  static buildSqlFixPrompt(wrongSql: string, errorMsg: string, schemaContext: string): { prompt: string, system: string } {
    return {
      prompt: `Schema:\n${schemaContext}\n\nBroken SQL:\n${wrongSql}\n\nError:\n${errorMsg}`,
      system: "You are a SQL Debugger. Return ONLY fixed SQL."
    };
  }

  // ===========================================
  // PRIVATE HELPERS
  // ===========================================

  public static buildDataContext(summary: AnalysisSummary): string {
    let statsInfo = "No detailed statistics available.";

    if (summary.stats && Array.isArray(summary.stats) && summary.stats.length > 0) {
      statsInfo = summary.stats.slice(0, 50).map((s: any) => {
        const colName = s.name || s.column || 'Unknown';
        const type = s.type || '?';
        const rowCount = summary.rowCount || 1;

        const nullPct = ((s.null_count / rowCount) * 100).toFixed(1);
        const distinctPct = ((s.distinct_count / rowCount) * 100).toFixed(1);

        let details = `[Scale: Nulls ${s.null_count}(${nullPct}%), Distinct ${s.distinct_count}(${distinctPct}%)]`;

        // Ranges
        details += ` [Range: ${s.min} to ${s.max}]`;

        // Add Mean/Std for Numerics
        if (s.mean !== undefined || s.avg !== undefined) {
          const meanVal = s.mean ?? s.avg;
          details += ` [Stats: Mean ${Number(meanVal).toFixed(2)} | StdDev ${Number(s.std || 0).toFixed(2)}]`;
          if (s.skew !== undefined) details += ` [Skew: ${Number(s.skew).toFixed(2)}]`;
        }

        // Add Top K for Categoricals
        if (s.top_k && Array.isArray(s.top_k) && s.top_k.length > 0) {
          const topKStr = s.top_k.slice(0, 8).map((t: any) => `"${t.value}"(${t.count})`).join(', ');
          details += ` [Top Distributions: ${topKStr}]`;
        }

        // Semantic Hint
        if (s.distinct_count === rowCount && s.null_count === 0) details += ` [Hint: Potential PK/Unique ID]`;
        if (s.distinct_count < 10 && rowCount > 100) details += ` [Hint: Low Cardinality Dimension]`;

        return `- **${colName}** (${type}): ${details}`;
      }).join('\n');
    }

    const sampleData = summary.sampleData ? summary.sampleData.slice(0, 2000) : "No sample data.";

    return `### 📊 Data Profiling (Top 50 Columns)
${statsInfo}

### 📋 Sample Data Preview (First 15 Rows)
\`\`\`
${sampleData}
\`\`\``;
  }

  // ===========================================
  // UNIFIED MEGA-PROMPT (v6.0 Rate Limit Optimization)
  // ===========================================

  /**
   * Single API call for all core analysis stages.
   * Reduces 4 separate calls to 1, staying within TPM limits.
   */
  static buildUnifiedAnalysisPrompt(summary: AnalysisSummary, userIntent: string = "EXPLORATION"): string {
    // Inject essential skills from all stages
    const skills = this.injectSkills([
      '000-protocol', // Core output format
      '101-semantic', // Semantic inference
      '102-quality',  // Quality audit
      '301-sql',      // SQL generation
      '203-cte',      // CTE patterns
      '304-macro'     // Macro patterns
    ]);

    const sampleData = summary.sampleData || "(No sample data available)";

    // Context Injection
    const dataContext = this.buildDataContext(summary);

    return `# Unified Data Analysis Pipeline

## 任务
你需要在 **一次响应** 中完成以下所有分析阶段：

1. **Stage 0 - Scene Probe**: 识别数据意图和场景
2. **Stage 1 - Semantic Analysis**: 推断列的语义类型 (DIM/MEA/TIME/ID/TEXT)
3. **Stage 2 - Quality Audit**: 评估数据质量 (0-100分)
4. **Stage 3 - Operations**: 生成教学级 SQL 工程资料。要求：每个 CRUD 操作包含问题陈述+语法模板+2个示例+易错点；事务包含安全等级+限制+反模式；生成 2+ 个 DuckDB 宏（含参数文档）；2+ 条数据质量断言（含期望值和修复SQL）；6+ 条分类脚本（含教学注释）

## CRITICAL INSTRUCTION: REALISTIC SQL GENERATION
1. **NO PLACEHOLDERS**: You MUST NOT use generic placeholders like 'val', 'col', 'id=...'.
2. **USE REAL VALUES**:
   - For INSERT: Generate a valid row using actual column names and realistic values from the stats/samples above.
   - For UPDATE: Choose a meaningful column (e.g. status, updated_at) and a specific condition based on real data (e.g. 'WHERE status = "PENDING"').
   - For DELETE: Use a specific, safe condition (e.g. 'WHERE id = 101' or 'WHERE created_at < "2023-01-01"').

## 数据上下文
- **表名**: \`${summary.tableName}\`
- **行数**: ${summary.rowCount}
- **列数**: ${summary.columnCount}
- **用户意图**: ${userIntent}

${dataContext}

${skills}

## Output Format (JSON Only)
返回一个 **严格的 JSON 对象**，包含以下结构：

\`\`\`json
{
  "probe": {
    "recommendedIntent": "EXPLORATION | AUDIT | REPORTING | FORECAST",
    "sceneType": "TRANSACTIONAL | ANALYTICAL | MASTER_DATA",
    "confidence": 0.95,
    "reasoning": "为什么选择这个意图——推理过程说明"  // NEW: 推理链
  },
  "overview": "100-200字的数据资产核心概览，描述数据的本质意义、核心价值和主要业务场景。",
  "semantic": {
    "columns": [
      {
        "name": "column_name",
        "semanticType": "DIM | MEA | TIME | ID | TEXT | CURR | PII",
        "confidenceScore": 95,  // NEW: 0-100 精确置信度
        "confidenceLevel": "high | medium | low",  // NEW: 置信度等级
        "reasoning": "为什么判断为该类型——推理依据",  // NEW: 推理依据
        "alternatives": [  // NEW: 备选语义类型
          { "type": "MEA", "confidence": 30 }
        ],
        "needsReview": false,  // NEW: 是否需要人工确认（置信度<70时为true）
        "description": "简短描述",
        "isPrimaryKey": false,
        "isForeignKey": false
      }
    ]
  },
  "quality": {
    "overallScore": 85,
    "overallScoreGrade": "A | B | C | D",  // NEW: 字母等级
    "dimensionScores": {  // NEW: 多维度评分
      "completeness": 90,
      "consistency": 85,
      "accuracy": 80,
      "timeliness": 95,
      "uniqueness": 88
    },
    "reasoning": "质量评分推理过程——如何得出这个分数",  // NEW: 评分推理
    "issues": [
      { "column": "col_name", "type": "Invalid Value | Missing | Schema Drift", "severity": "error | warning | info", "detail": "具体问题描述", "suggestion": "修复建议" }
    ],
    "recommendations": ["Recommendation 1"]
  },
  "snapshotInsights": [
    { 
      "title": "Insight Title", 
      "category": "driver | correlation | anomaly", 
      "observation": "Brief high-value observation", 
      "impact": "positive | negative | neutral",
      "assumption": "此洞察成立的前提条件",  // NEW: 假设前提
      "limitation": "数据限制或样本量要求",  // NEW: 数据限制
      "confidenceScore": 85  // NEW: 1-100 置信度
    }
  ],
  "keyMetrics": [
    {
      "name": "Metric Name",
      "formula": "Calculation Formula",
      "visual": "bar | line | number",
      "impact": "Core Business Value (Chinese)",
      "explanation": "Detailed Definition (Chinese)",
      "unit": "currency | percentage | count",
      "confidenceScore": 80,  // NEW: 置信度
      "assumption": "指标计算成立的前提",  // NEW: 假设
      "limitation": "数据限制"  // NEW: 限制
    }
  ],
  "operations": {
    "crud": {
      "read": {
        "problem": "为什么需要查询——一句话说明核心场景",
        "syntaxTemplate": "SELECT [DISTINCT] col1, col2 FROM table WHERE condition ORDER BY col LIMIT n;",
        "examples": [
          { "title": "示例名称", "sql": "SELECT ... FROM ${summary.tableName} ...", "explanation": "此查询的意图和关键点", "expectedColumns": ["col1", "col2"] }
        ],
        "gotchas": ["DuckDB 特有的易错点或性能提示"]
      },
      "create": {
        "problem": "插入场景说明",
        "syntaxTemplate": "INSERT INTO table (col1, col2) VALUES (v1, v2) RETURNING *;",
        "examples": [
          { "title": "示例名称", "sql": "INSERT INTO ${summary.tableName} ...", "explanation": "意图说明", "expectedColumns": ["col1"] }
        ],
        "gotchas": ["易错点"]
      },
      "update": {
        "problem": "更新场景说明",
        "syntaxTemplate": "UPDATE table SET col = value WHERE condition;",
        "examples": [
          { "title": "示例名称", "sql": "UPDATE ${summary.tableName} SET ...", "explanation": "意图说明", "expectedColumns": ["col1"] }
        ],
        "gotchas": ["易错点"]
      },
      "delete": {
        "problem": "删除场景说明",
        "syntaxTemplate": "DELETE FROM table WHERE condition;",
        "examples": [
          { "title": "示例名称", "sql": "DELETE FROM ${summary.tableName} WHERE ...", "explanation": "意图说明", "expectedColumns": [] }
        ],
        "gotchas": ["易错点"]
      }
    },
    "transaction": {
      "safetyLevel": "SAFE | CAUTION | DANGER",
      "limitations": [
        { "title": "限制标题", "detail": "详细说明", "workaround": "解决方案" }
      ],
      "bestPractices": [
        { "title": "实践标题", "detail": "详细说明", "sql": "可选示例SQL" }
      ],
      "antiPatterns": [
        { "pattern": "反模式描述", "fix": "正确做法" }
      ],
      "syntax": ["BEGIN TRANSACTION;", "-- your operations", "COMMIT;"]
    },
    "macros": [
      { "name": "macro_name", "sql": "CREATE MACRO ...", "description": "用途说明", "useCase": "适用场景", "params": [{"name": "param", "type": "type", "description": "参数说明"}] }
    ],
    "assertions": [
      { "name": "assertion_name", "sql": "SELECT ...", "description": "验证说明", "severity": "error | warning", "expectedValue": "期望结果", "fixSql": "修复SQL" }
    ],
    "scripts": [
      { "id": 1, "title": "Script Name", "sql": "SELECT ...", "category": "schema | crud | analysis | view | join | window", "description": "脚本用途", "learningNote": "教学注释：此脚本演示了什么概念" }
    ]
  }
}
\`\`\`

**CRITICAL**: 仅返回 JSON 对象，包含 3 条高质量首屏洞察 (snapshotInsights)，禁止任何额外文字或解释。`;
  }

  // ===========================================
  // HANDBOOK BATCH PROMPTS (v6.0)
  // ===========================================

  /**
   * Batch 1: 前言 + 环境 + ER图 + 模块A (CRUD)
   */
  static buildHandbookBatch1Prompt(context: any): string {
    const { tableName, rowCount, columnCount, erDiagram, seedInserts, sampleData, columns, stats } = context;

    // Use the central data context builder for consistent rich stats
    const summaryStub: any = {
      rowCount,
      columnCount,
      tableName,
      sampleData,
      stats: stats || context.stats // Ensure stats are passed
    };

    const richDataContext = this.buildDataContext(summaryStub);

    return `# 任务：生成 DuckDB 教程手册 - 第一批次

## 数据上下文
${richDataContext}

## ER 关系图 (已检测)
${erDiagram.mermaid}

## 种子数据
\`\`\`sql
${seedInserts}
\`\`\`

## 样本数据预览
${sampleData}

---

## 请生成以下内容（纯 Markdown）：

### 0. 前言与环境准备
- 背景介绍（基于表 "${tableName}" 的业务场景，结合数据行数 ${rowCount} 描述规模）
- 环境要求（DuckDB 版本、运行方式）
- 阅读约定表 (📸, ⚠️, -- ← 已修改 等符号说明)

### 0.5 📊 数据资产透视 (Stats Overview)
**此环节至关重要，请根据提供的 Data Profiling 信息生成：**
- **数据规模综述**：描述表的基础规格。
- **核心维度分布**：提取 Top 3 的关键维度（如类别、城市、状态），列出其高频值及占比。
- **数值度量特征**：选取重要的度量列，描述其均值、最小值和最大值，揭示数据范围。
- **数据质量快照**：提及空值率或异常极值情况。
**要求：语言自然、专业，像一份真实的数据分析报告，禁止简单的空值堆砌。**

### 1. 领域建模与数据初始化
- 1.1 ER 关系图 (直接使用上面提供的 Mermaid 图)
- 1.2 建表语句 (CREATE TABLE for "${tableName}")
- 1.3 种子数据 (使用上面的 INSERT 语句)

### 2. 模块 A：CRUD 操作
为每个子模块 (A1-A6) 生成完整内容：

**A1 ▸ INSERT — 数据写入**
**A2 ▸ SELECT 基础查询**
**A3 ▸ SELECT 聚合与分组**
**A4 ▸ SELECT 子查询与 CTE**
**A5 ▸ UPDATE — 数据修改**
**A6 ▸ DELETE — 数据删除**

每个模块必须包含:
- 🎯 解决什么问题
- 📌 语法模板 (抽象 SQL)
- 💻 可执行示例 (针对 "${tableName}" 的真实 SQL)
- 📊 预期输出 (Markdown 表格)
- ⚠️ 易错点 / 最佳实践
- 🔗 上下文衔接

### 📸 模块 A 结束 — 当前数据快照
展示执行所有 CRUD 后的表状态 (SELECT * FROM "${tableName}")`;
  }

  /**
   * Batch 2: 模块B-E (JOIN + 视图 + 事务 + 窗口)
   */
  static buildHandbookBatch2Prompt(context: any): string {
    const { tableName, columns, erDiagram } = context;

    const dims = columns.filter((c: any) => c.semanticType === 'DIM').map((c: any) => c.name);
    const meas = columns.filter((c: any) => c.semanticType === 'MEA' || c.semanticType === 'CURR').map((c: any) => c.name);
    const timeCol = columns.find((c: any) => c.semanticType === 'TIME')?.name;

    return `# 任务：生成 DuckDB 教程手册 - 第二批次

## 上下文
- 表名: \`${tableName}\`
- 维度列: ${dims.join(', ') || '无'}
- 度量列: ${meas.join(', ') || '无'}
- 时间列: ${timeCol || '无'}

## ER 关系
${erDiagram.relationships.map((r: any) => `- ${r.from} → ${r.to} (${r.type})`).join('\n') || '无关联表'}

---

## 请生成以下内容（纯 Markdown）：

### 3. 模块 B：多表连接 (B1-B4)
**B1 ▸ INNER JOIN — 精确匹配**
**B2 ▸ LEFT JOIN — 保留左表**
**B3 ▸ CROSS JOIN — 笛卡尔积**
**B4 ▸ SELF JOIN — 自连接**

### 4. 模块 C：视图 (C1-C3)
**C1 ▸ CREATE VIEW — 虚拟表**
**C2 ▸ CREATE OR REPLACE — 视图更新**
**C3 ▸ DROP VIEW — 视图删除**

### 5. 模块 D：事务控制 (D1-D3)
**D1 ▸ BEGIN TRANSACTION**
**D2 ▸ COMMIT — 提交**
**D3 ▸ ROLLBACK — 回滚**

### 📸 模块 D 结束 — 当前数据快照

### 6. 综合实战：端到端分析查询
设计一个复杂的 CTE + JOIN + 聚合查询，展示完整的分析流程。

每个模块必须包含:
- 🎯 解决什么问题
- 📌 语法模板
- 💻 可执行示例 (针对 "${tableName}")
- 📊 预期输出
- ⚠️ 易错点
- 🔗 上下文衔接`;
  }

  /**
   * Batch 3: 模块E-I + 速查表 + 知识地图
   */
  static buildHandbookBatch3Prompt(context: any): string {
    const { tableName, columns, rowCount } = context;

    const meas = columns.filter((c: any) => c.semanticType === 'MEA' || c.semanticType === 'CURR').map((c: any) => c.name);
    const timeCol = columns.find((c: any) => c.semanticType === 'TIME')?.name;

    return `# 任务：生成 DuckDB 教程手册 - 第三批次

## 上下文
- 表名: \`${tableName}\`
- 行数: ${rowCount}
- 度量列: ${meas.join(', ') || '无'}
- 时间列: ${timeCol || '无'}

---

## 请生成以下内容（纯 Markdown）：

### 7. 模块 E：窗口函数 (E1-E3)
**E1 ▸ ROW_NUMBER / RANK / DENSE_RANK**
**E2 ▸ LAG / LEAD — 前后行对比**
**E3 ▸ 滚动聚合 — SUM() OVER (ROWS BETWEEN)**

### 8. 模块 F：数据导入导出 (F1-F3)
**F1 ▸ COPY TO — 导出 CSV/Parquet**
**F2 ▸ COPY FROM — 导入外部文件**
**F3 ▸ read_csv_auto — 自动推断导入**

### 9. 模块 G：高级数据处理函数 (G1-G4)
**G1 ▸ CASE WHEN — 条件逻辑**
**G2 ▸ COALESCE / NULLIF — 空值处理**
**G3 ▸ regexp_extract / regexp_replace — 正则**
**G4 ▸ strftime / date_trunc — 日期处理**

### 10. 模块 H：PIVOT 与高级聚合 (H1-H2)
**H1 ▸ PIVOT — 行转列**
**H2 ▸ UNPIVOT — 列转行**

### 11. 模块 I：性能分析与调试 (I1-I3)
**I1 ▸ EXPLAIN ANALYZE — 执行计划**
**I2 ▸ PRAGMA — 配置参数**
**I3 ▸ SUMMARIZE — 快速统计**

### 12. 速查备忘表（Cheat Sheet）
生成一个紧凑的 Markdown 表格，包含:
| 操作 | 语法 | 示例 |
|------|------|------|
(覆盖 SELECT, INSERT, UPDATE, DELETE, JOIN, 窗口函数, 导入导出)

### 13. 完整知识地图
用 Mermaid flowchart 展示所有模块的关系和学习路径。

每个模块必须包含:
- 🎯 解决什么问题
- 📌 语法模板
- 💻 可执行示例 (针对 "${tableName}")
- 📊 预期输出
- ⚠️ 易错点
- 🔗 上下文衔接`;
  }
}
