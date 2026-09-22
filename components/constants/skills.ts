/**
 * AI Skills Module - Centralized Constants
 *
 * DEPRECATED: Design system values have moved to components/theme/ai-skills.ts
 *
 * This file now only contains:
 *   - CATEGORY_HELP: Category-level help content (unique, no equivalent elsewhere)
 *
 * All design tokens (CATEGORY_CONFIG, INTENT_LABELS, etc.) are now
 * re-exported from ./theme/ai-skills.ts for backward compatibility.
 *
 * New code should import directly:
 *   import { CATEGORY_DESIGN, INTENT_DESIGN } from '../theme/ai-skills';
 *   import { CATEGORY_HELP } from './skills';
 */

import React from 'react';
import { DatabaseZap } from 'lucide-react';
import { SkillCategory } from '../../types';
import { CATEGORY_DESIGN, INTENT_DESIGN } from '../theme/ai-skills';

// ============================================================
// BACKWARD-COMPATIBLE RE-EXPORTS (deprecated)
// ============================================================

/** @deprecated Use CATEGORY_DESIGN from '../theme/ai-skills' */
export const CATEGORY_CONFIG = CATEGORY_DESIGN;

/** @deprecated Use INTENT_DESIGN from '../theme/ai-skills' */
export const INTENT_LABELS = INTENT_DESIGN;

/** @deprecated Use CATEGORY_DESIGN from '../theme/ai-skills' */
export const CATEGORY_META = CATEGORY_DESIGN;

/** @deprecated Use CATEGORY_DESIGN from '../theme/ai-skills' */
export const INTENT_LABELS_SIMPLE: Record<string, string> = Object.fromEntries(
  Object.entries(INTENT_DESIGN).map(([k, v]) => [k, v.label])
);

// Backward-compatible getSkillCategoryIcon (returns icon class name)
// NOTE: The new system returns Lucide ElementType — this function returns React.ElementType for compatibility
export function getSkillCategoryIcon(category: string): React.ElementType {
  return CATEGORY_DESIGN[category as SkillCategory]?.icon ?? DatabaseZap;
}

export const ALL_SKILL_CATEGORIES = ['all', 'modeling', 'wrangling', 'insights', 'optimization', 'engineering', 'handbook'] as const;
export type SkillCategoryFilter = typeof ALL_SKILL_CATEGORIES[number];

// ============================================================
// CATEGORY HELP — unique content data (NOT design tokens)
// ============================================================

type CategoryHelpData = {
  title: string;
  description: string;
  scenarios: string[];
  commonErrors: string[];
  aiHints: string[];
  bestPractices: string[];
};

export const CATEGORY_HELP: Record<SkillCategory, CategoryHelpData> = {
  modeling: {
    title: '探测与建模 (Discovery & Modeling)',
    description: '适用于将自然语言需求快速转成可执行的 DuckDB SQL，包括查询、建表、Schema 分析等。',
    scenarios: [
      '有明确业务问题，需要一条或一组 SQL 直接回答',
      '需要快速搭建表结构或模拟数据场景',
      '需要从零开始设计完整的数据模型',
      '对现有 Schema 进行语义化标注与理解'
    ],
    commonErrors: [
      '未指定表 or 字段，导致生成的 SQL 含有占位符',
      '在 WHERE 条件中直接拼接自然语言而非字段条件',
      '混用不同数据库方言导致语法错误'
    ],
    aiHints: [
      '尽量用「业务意图 + 关键字段名」描述需求，AI 更稳定',
      '使用 CTE 逐步构建复杂查询，便于调试和维护',
      '善用 DuckDB 特有的 SUMMARIZE 进行快速探测'
    ],
    bestPractices: [
      '优先使用带列名的 SELECT，避免 SELECT *',
      '复杂查询使用 CTE 分解',
      '添加必要的注释说明字段逻辑'
    ],
  },
  wrangling: {
    title: '清洗与转换 (Wrangling & Transformation)',
    description: '用于列转行、行转列、类型转换、字符串与日期处理等数据预处理逻辑。',
    scenarios: [
      '在建模前标准化原始数据格式',
      '为后续分析生成中间宽表或特征列',
      '处理半结构化数据（JSON、嵌套数据）',
      '替换脏数据或进行文本结构化拆分'
    ],
    commonErrors: [
      '忽略 NULL 值或异常值，导致转换后统计失真',
      '在日期操作中使用了错误的格式模板',
      '转换后的别名与原字段名冲突'
    ],
    aiHints: [
      '说明「原字段含义 + 期望结果格式」，AI 更精准',
      '遇到报错时优先检查 CAST 是否与源字段类型匹配',
      '使用 TRY_CAST 避免转换失败导致整查询崩溃'
    ],
    bestPractices: [
      '保持转换后字段命名规范',
      '复杂转换拆分为多步 CTE',
      '使用正则表达式处理复杂文本'
    ],
  },
  insights: {
    title: '深度分析与洞察 (Analytics & Insights)',
    description: '围绕时间序列、对比、漏斗、留存等分析场景，生成带聚合与窗口函数的深度分析 SQL。',
    scenarios: [
      '进行趋势分析、同比环比、留存率分析',
      '构建多步骤转化漏斗',
      '在仪表盘中复用分析 SQL 进行指标展示',
      '发现数据中的潜在异常与相关性'
    ],
    commonErrors: [
      '维度列基数过高，导致结果集过大',
      '窗口函数缺少 ORDER BY 导致结果不稳定',
      '在 WHERE 与 HAVING 中混淆过滤条件'
    ],
    aiHints: [
      '优先选择「时间列 + 指标列」，AI 会自动补充分析模式',
      '使用 DATE_TRUNC 统一时间粒度，避免时区问题',
      '对比分析时加入占比计算，更容易发现异常'
    ],
    bestPractices: [
      '留存分析使用 cohort 方法',
      '漏斗分析先验证单步骤转化',
      '始终添加 LIMIT 限制最终输出规模'
    ],
  },
  optimization: {
    title: '诊断与优化 (Diagnostics & Optimization)',
    description: '围绕分析执行计划、索引思路与查询改写，帮助理解并优化现有 SQL 性能。',
    scenarios: [
      '查询在大表上执行缓慢，需要找出性能瓶颈',
      '想要对关键报表 SQL 做结构性改写以提高可维护性',
      '分析复杂查询的逻辑执行计划与物理开销'
    ],
    commonErrors: [
      '直接对非过滤列进行复杂计算，导致全表扫描',
      'JOIN 顺序不当，导致中间结果集大幅膨胀',
      '误以为 DuckDB 有传统索引而忽略了列式存储优势'
    ],
    aiHints: [
      '先用 EXPLAIN 查看执行计划，再将结果交给 AI 优化',
      '标明优化目标（性能优先 vs 可读性优先）',
      '复杂聚合优先考虑物化视图 or 预计算'
    ],
    bestPractices: [
      '始终先进行 EXPLAIN 分析',
      '优先优化 WHERE 过滤条件',
      '避免在 JOIN Key 上进行函数运算'
    ],
  },
  engineering: {
    title: '工程与运维 (Engineering & Ops)',
    description: '包括测试数据生成、样本抽取、导入导出、质量检查等工程辅助逻辑。',
    scenarios: [
      '需要快速生成测试数据验证模型或仪表盘',
      '接入新表前快速了解数据分布与质量',
      '执行大规模数据的 IMPORT/EXPORT 操作'
    ],
    commonErrors: [
      '在生产表上直接插入大规模测试数据',
      '抽样时忽略分层条件，导致样本失真',
      '测试数据未考虑外键约束'
    ],
    aiHints: [
      '建议使用临时表 (TEMP TABLE) 进行测试数据生成',
      '抽样时尽量指定分层字段以保持代表性',
      '使用 GENERATE_SERIES 生成有序测试序列'
    ],
    bestPractices: [
      '测试数据使用独立表空间',
      '重要操作前先执行数据质量摘要',
      '使用 USING SAMPLE 进行高效抽样'
    ],
  },
  handbook: {
    title: '手册与参考 (Handbook & Reference)',
    description: '提供 DuckDB 官方文档速查、语法参考和最佳实践指南，帮助用户快速找到所需信息。',
    scenarios: [
      '需要快速查找某个函数的具体用法',
      '想了解某个 SQL 语法的官方示例',
      '在编写 SQL 时遇到语法错误，需要确认正确写法',
      '学习 DuckDB 新特性和函数'
    ],
    commonErrors: [
      '混淆不同数据库方言的语法',
      '未注意函数参数的数据类型要求',
      '忽略 DuckDB 特有的函数和语法'
    ],
    aiHints: [
      '尽量提供完整的函数名或关键词，AI 更容易精确匹配',
      '可以附上当前 SQL 的错误信息，AI 能给出修正建议',
      'DuckDB 有大量特有的函数（如 list_* 系列），善用 handbook 查找'
    ],
    bestPractices: [
      '优先查阅官方文档以确保信息准确性',
      '结合具体场景描述需求，便于找到最相关的参考',
      '将常用参考保存到个人笔记中'
    ],
  },
};

// ============================================================
// BACKWARD-COMPATIBLE RE-EXPORTS
// ============================================================

/**
 * SKILL_BACKGROUND_INFO — Skill-level guidance and usage hints
 * @deprecated Import directly from './skill-background-info' instead
 */
export { SKILL_BACKGROUND_INFO } from './skill-background-info';

/**
 * @deprecated Import directly from './skill-background-info' instead
 */
export { getCategoryTagColors } from './skill-background-info';
