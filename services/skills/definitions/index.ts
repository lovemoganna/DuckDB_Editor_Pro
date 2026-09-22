/**
 * AI Skill Definitions - Barrel Export
 *
 * Aggregates all category-specific skill definitions into a single
 * BUILT_IN_SKILLS array for consumption by the SkillRegistry.
 */

import { AISkill, SkillCategory } from '../../../types';
import { SQL_QUERY_SKILLS } from './sql-skills';
import { SQL_DDL_SKILLS } from './sql-ddl-skills';
import { ANALYSIS_SKILLS } from './analysis-skills';
import { TRANSFORMATION_SKILLS } from './transformation-skills';
import { OPTIMIZATION_SKILLS } from './optimization-skills';
import { UTILITY_SKILLS } from './utility-skills';
import { OFFICIAL_HANDBOOK_SKILLS, OfficialHandbookSkill } from './official-skills';

/** Cognitive layer of an official handbook skill */
export type CognitiveLayer = 'perception' | 'strategy' | 'execution' | 'meta';

/** Cognitive layer metadata with label and sort priority */
export interface HandbookLayerMeta {
  layer: CognitiveLayer;
  label: string;        // 中文显示名
  priority: number;     // 排序优先级（数值越小越靠前）
  color: string;       // Tailwind 颜色类前缀
}

/** All cognitive layers in execution order */
export const COGNITIVE_LAYERS: HandbookLayerMeta[] = [
  { layer: 'perception', label: '感知层',   priority: 1, color: 'cyan'    },
  { layer: 'strategy',   label: '决策层',   priority: 2, color: 'amethyst'  },
  { layer: 'execution',  label: '执行层',   priority: 3, color: 'green'   },
  { layer: 'meta',       label: '元认知层', priority: 4, color: 'yellow'  },
];

/** Map intent code → cognitive layer */
const INTENT_TO_LAYER: Record<string, CognitiveLayer> = {
  META_PROTOCOL:          'meta',
  SCENE_PROBE:            'perception',
  QUALITY_AUDIT:          'perception',
  TIME_DETECTOR:          'perception',
  RELATION_SENSOR:        'perception',
  LOCALIZATION_GUARD:     'perception',
  DRIFT_BENCHMARKER:      'perception',
  DATA_GOVERNANCE:        'strategy',
  METRIC_MODELING:        'strategy',
  CTE_ORCHESTRATOR:       'strategy',
  WASM_STRATEGIST:        'strategy',
  COMPLIANCE_POLICY:      'strategy',
  METRIC_FACTORY:         'strategy',
  ISOLATION_POLICY:       'strategy',
  SQL_ENGINEERING:        'execution',
  SAFETY_ROLLBACK:        'execution',
  NARRATIVE_REPORT:       'execution',
  MACRO_FACTORY:          'execution',
  ASSERTION_VALIDATOR:    'execution',
  STORAGE_OPTIMIZER:     'execution',
  SELF_HEALING_PIPELINE: 'execution',
  SESSION_SNAPSHOT:      'execution',
  COGNITIVE_ALIGNMENT:   'meta',
  NARRATIVE_TRACE:       'meta',
  PROMPT_COMPRESSOR:     'meta',
  DBT_BRIDGE:            'meta',
  EXECUTIVE_SUMMARY:     'meta',
};

/**
 * Extract a short, human-readable Chinese description from official skill markdown.
 *
 * Priority order:
 * 1. "🎯 解决什么问题" block → strip tags, prefer Chinese
 * 2. "## 核心任务" first bullet → prefer Chinese
 * 3. Any line with mixed Chinese characters → prefer Chinese
 * 4. Fallback: any non-empty line
 */
function extractDescription(content: string): string {
  const lines = content.split('\n');

  // Score a line: higher = more likely useful Chinese description
  const score = (line: string) => {
    const cjk = (line.match(/[\u4e00-\u9fff]/g) || []).length;
    const words = line.trim().split(/\s+/).filter(Boolean).length;
    return cjk * 2 + words;
  };

  // 1. Try "🎯 解决什么问题" block
  const solveMatch = content.match(/🎯\s*解决什么问题[\s\S]*?(?=\*\*|##|```)/);
  if (solveMatch) {
    const text = solveMatch[0]
      .replace(/^[🎯\s*]*|\*\*|```|\n+/g, ' ')
      .replace(/[#*\-]/g, '')
      .trim();
    if (text.length > 8) return text.slice(0, 80);
  }

  // 2. Filter to lines with mixed Chinese, skip pure English bullet lines
  const chineseLines = lines
    .map(l => l.replace(/^#+\s*/, '').trim())
    .filter(l => l.length > 8 && !l.startsWith('```') && !l.startsWith('|') && !l.startsWith('- '))
    .filter(l => (l.match(/[\u4e00-\u9fff]/g) || []).length > 0)
    .sort((a, b) => score(b) - score(a));

  if (chineseLines[0]) return chineseLines[0].slice(0, 80);

  return '';
}

/**
 * Infer AISkill properties from OfficialHandbookSkill metadata.
 */
function buildHandbookSkill(official: OfficialHandbookSkill): AISkill {
  const layer: CognitiveLayer = INTENT_TO_LAYER[official.intent ?? ''] ?? 'perception';
  const triggers = official.triggers ?? [];

  return {
    id: official.id,
    name: official.name,
    description: extractDescription(official.content),
    category: 'handbook' as SkillCategory,
    inputSchema: [],
    outputType: 'markdown',
    requiresTable: false,
    requiresColumns: false,
    examples: [],
    intentKeywords: triggers,
    triggers: { keywords: triggers },
    compatibleWith: [],
    sqlOperationType: undefined,
    _layer: layer,
  };
}

/** All DuckDB Official Handbook skills, converted to AISkill format */
export const HANDBOOK_SKILLS: AISkill[] = OFFICIAL_HANDBOOK_SKILLS.map(buildHandbookSkill);

/** All built-in skill definitions, ordered by category */
export const BUILT_IN_SKILLS: AISkill[] = [
  ...SQL_QUERY_SKILLS,
  ...SQL_DDL_SKILLS,
  ...ANALYSIS_SKILLS,
  ...TRANSFORMATION_SKILLS,
  ...OPTIMIZATION_SKILLS,
  ...UTILITY_SKILLS,
  ...HANDBOOK_SKILLS,
];

// Re-export individual category arrays for selective imports
export {
  SQL_QUERY_SKILLS,
  SQL_DDL_SKILLS,
  ANALYSIS_SKILLS,
  TRANSFORMATION_SKILLS,
  OPTIMIZATION_SKILLS,
  UTILITY_SKILLS,
  // HANDBOOK_SKILLS already exported via `export const` above
};
