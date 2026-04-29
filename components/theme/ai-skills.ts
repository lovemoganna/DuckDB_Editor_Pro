/**
 * AI Skills Module - Unified Design System
 *
 * Single source of truth for all AI Skills visual configuration.
 * Consolidates duplicate definitions from:
 *   - components/constants/skills.ts  (CATEGORY_CONFIG, INTENT_LABELS)
 *   - components/theme/ai-skills-tokens.ts (CATEGORY_TOKENS, INTENT_TOKENS)
 *   - components/theme/monokai.ts (CATEGORY_THEME, INTENT_THEME, BRAND_THEME, SEMANTIC_THEME)
 *   - components/animations/DuckDBSkillsGuide.tsx (inline CATEGORY_META)
 *
 * All components MUST import from here. Do NOT define category/intent colors elsewhere.
 */

import React from 'react';
import {
  DatabaseZap, BarChart3, ArrowRightLeft, Zap, Wrench,
  BookOpen, RefreshCw, Settings2, Brain, Search,
  Sparkles,
  FileCode, Database, Layers, Hash, TrendingUp,
  Clock, Table, Wand2, Microscope, Trash2,
  Eye, GitBranch, Calendar, Type, TrendingDown,
  FileText, Puzzle, Terminal,
} from 'lucide-react';
import { SkillCategory } from '../../types';

// ============================================================
// CATEGORY DESIGN — Per-category visual configuration
// ============================================================

export interface CategoryColorSet {
  /** Hex color for glow/shadow effects */
  primary: string;
  /** Tailwind class for background tint */
  bg: string;
  /** Subtle background (used for selection state) */
  bgSubtle: string;
  /** Tailwind class for icon-only backgrounds */
  iconBg: string;
  /** Tailwind class for border */
  border: string;
  /** Tailwind class for text/icon color */
  text: string;
  /** Tailwind class for icon color (same as text) */
  icon: string;
  /** Gradient start class */
  gradientFrom: string;
  /** Gradient end class */
  gradientTo: string;
}

export interface CategoryDesign {
  label: string;
  /** Lucide icon component for this category */
  icon: React.ElementType;
  /** Emoji fallback */
  emoji: string;
  colors: CategoryColorSet;
  /** SQL operation types this category supports */
  sqlOperations: string[];
}

export const CATEGORY_DESIGN: Record<SkillCategory, CategoryDesign> = {
  modeling: {
    label: '探测与建模',
    icon: Search,
    emoji: '🔍',
    colors: {
      primary: '#66d9ef',
      bg: 'bg-[#66d9ef]/[8%]',
      bgSubtle: 'bg-[#66d9ef]/[5%]',
      iconBg: 'bg-[#66d9ef]/[15%]',
      border: 'border-[#66d9ef]/[20%]',
      text: 'text-[#66d9ef]',
      icon: 'text-[#66d9ef]',
      gradientFrom: 'from-[#66d9ef]/[10%]',
      gradientTo: 'to-[#66d9ef]/[5%]',
    },
    sqlOperations: ['select', 'insert', 'update', 'delete', 'aggregation', 'join', 'window', 'cte'],
  },
  wrangling: {
    label: '清洗与转换',
    icon: RefreshCw,
    emoji: '🔄',
    colors: {
      primary: '#a6e22e',
      bg: 'bg-[#a6e22e]/[8%]',
      bgSubtle: 'bg-[#a6e22e]/[5%]',
      iconBg: 'bg-[#a6e22e]/[15%]',
      border: 'border-[#a6e22e]/[20%]',
      text: 'text-[#a6e22e]',
      icon: 'text-[#a6e22e]',
      gradientFrom: 'from-[#a6e22e]/[10%]',
      gradientTo: 'to-[#a6e22e]/[5%]',
    },
    sqlOperations: ['transformation'],
  },
  insights: {
    label: '深度分析与洞察',
    icon: BarChart3,
    emoji: '📊',
    colors: {
      primary: '#ae81ff',
      bg: 'bg-[#ae81ff]/[8%]',
      bgSubtle: 'bg-[#ae81ff]/[5%]',
      iconBg: 'bg-[#ae81ff]/[15%]',
      border: 'border-[#ae81ff]/[20%]',
      text: 'text-[#ae81ff]',
      icon: 'text-[#ae81ff]',
      gradientFrom: 'from-[#ae81ff]/[10%]',
      gradientTo: 'to-[#ae81ff]/[5%]',
    },
    sqlOperations: ['analysis'],
  },
  optimization: {
    label: '诊断与优化',
    icon: Zap,
    emoji: '🚀',
    colors: {
      primary: '#fd971f',
      bg: 'bg-[#fd971f]/[8%]',
      bgSubtle: 'bg-[#fd971f]/[5%]',
      iconBg: 'bg-[#fd971f]/[15%]',
      border: 'border-[#fd971f]/[20%]',
      text: 'text-[#fd971f]',
      icon: 'text-[#fd971f]',
      gradientFrom: 'from-[#fd971f]/[10%]',
      gradientTo: 'to-[#fd971f]/[5%]',
    },
    sqlOperations: ['optimization'],
  },
  engineering: {
    label: '工程与运维',
    icon: Wrench,
    emoji: '🛠️',
    colors: {
      primary: '#8be9fd',
      bg: 'bg-[#8be9fd]/[8%]',
      bgSubtle: 'bg-[#8be9fd]/[5%]',
      iconBg: 'bg-[#8be9fd]/[15%]',
      border: 'border-[#8be9fd]/[20%]',
      text: 'text-[#8be9fd]',
      icon: 'text-[#8be9fd]',
      gradientFrom: 'from-[#8be9fd]/[10%]',
      gradientTo: 'to-[#8be9fd]/[5%]',
    },
    sqlOperations: ['utility'],
  },
  handbook: {
    label: '官方手册',
    icon: BookOpen,
    emoji: '📖',
    colors: {
      primary: '#e6db74',
      bg: 'bg-[#e6db74]/[8%]',
      bgSubtle: 'bg-[#e6db74]/[5%]',
      iconBg: 'bg-[#e6db74]/[15%]',
      border: 'border-[#e6db74]/[20%]',
      text: 'text-[#e6db74]',
      icon: 'text-[#e6db74]',
      gradientFrom: 'from-[#e6db74]/[10%]',
      gradientTo: 'to-[#e6db74]/[5%]',
    },
    sqlOperations: [],
  },
};

// ============================================================
// INTENT DESIGN — Operation-level visual configuration
// ============================================================

export interface IntentDesign {
  label: string;
  color: string;
  bg: string;
  border: string;
}

export const INTENT_DESIGN: Record<string, IntentDesign> = {
  select:       { label: '数据查询',   color: 'text-[#66d9ef]',  bg: 'bg-[#66d9ef]/[20%]',  border: 'border-[#66d9ef]/[30%]' },
  insert:       { label: '数据插入',   color: 'text-[#a6e22e]', bg: 'bg-[#a6e22e]/[20%]',  border: 'border-[#a6e22e]/[30%]' },
  update:       { label: '数据更新',   color: 'text-[#e6db74]', bg: 'bg-[#e6db74]/[20%]',  border: 'border-[#e6db74]/[30%]' },
  delete:       { label: '数据删除',   color: 'text-[#f92672]', bg: 'bg-[#f92672]/[20%]',  border: 'border-[#f92672]/[30%]' },
  aggregation:  { label: '聚合统计',   color: 'text-[#ae81ff]', bg: 'bg-[#ae81ff]/[20%]',  border: 'border-[#ae81ff]/[30%]' },
  join:         { label: '多表关联',   color: 'text-[#f92672]', bg: 'bg-[#f92672]/[20%]',  border: 'border-[#f92672]/[30%]' },
  window:       { label: '窗口函数',   color: 'text-[#8be9fd]', bg: 'bg-[#8be9fd]/[20%]',  border: 'border-[#8be9fd]/[30%]' },
  transformation:{ label: '数据转换',  color: 'text-[#fd971f]', bg: 'bg-[#fd971f]/[20%]',  border: 'border-[#fd971f]/[30%]' },
  analysis:     { label: '数据分析',   color: 'text-[#ae81ff]', bg: 'bg-[#ae81ff]/[20%]',  border: 'border-[#ae81ff]/[30%]' },
  optimization:  { label: 'SQL 优化',   color: 'text-[#e6db74]', bg: 'bg-[#e6db74]/[20%]',  border: 'border-[#e6db74]/[30%]' },
  utility:      { label: '工具生成',   color: 'text-[#75715e]', bg: 'bg-[#75715e]/[20%]',  border: 'border-[#75715e]/[30%]' },
};

// Backward-compatible aliases
/** @deprecated Use INTENT_DESIGN instead */
export const INTENT_LABELS = INTENT_DESIGN;

/** @deprecated Use CATEGORY_DESIGN instead */
export const CATEGORY_META = CATEGORY_DESIGN;

// ============================================================
// SEMANTIC DESIGN — State feedback colors
// ============================================================

export const SEMANTIC_DESIGN = {
  success: { primary: '#a6e22e', bg: 'bg-[#a6e22e]/[12%]', border: 'border-[#a6e22e]/[30%]', text: 'text-[#a6e22e]' },
  error:   { primary: '#f92672', bg: 'bg-[#f92672]/[12%]',   border: 'border-[#f92672]/[30%]',   text: 'text-[#f92672]' },
  warning: { primary: '#e6db74', bg: 'bg-[#e6db74]/[12%]', border: 'border-[#e6db74]/[30%]', text: 'text-[#e6db74]' },
  info:    { primary: '#66d9ef', bg: 'bg-[#66d9ef]/[12%]',  border: 'border-[#66d9ef]/[30%]',   text: 'text-[#66d9ef]' },
} as const;

// ============================================================
// BRAND DESIGN — Primary action styling
// ============================================================

export const BRAND_DESIGN = {
  primaryGradient: 'from-[#ae81ff] to-[#f92672]',
  primaryBg: 'bg-gradient-to-r from-[#ae81ff] to-[#f92672]',
  primaryText: 'text-white',
  primaryBtn: 'bg-gradient-to-r from-[#ae81ff] to-[#f92672] text-white hover:opacity-90 shadow-md shadow-[#ae81ff]/[20%]',
  primaryBtnDisabled: 'bg-gradient-to-r from-[#ae81ff]/[50%] to-[#f92672]/[50%] text-white/[60%] cursor-not-allowed',
} as const;

// ============================================================
// SKILL ICON MAP — Skill ID → Lucide Icon
// ============================================================

/** Maps skill ID patterns to Lucide icon components */
export const SKILL_ICON_MAP: Record<string, React.ElementType> = {
  // Official Handbook skill IDs — must be checked before generic keyword matches
  'skl-': BookOpen,
  // SQL operation patterns
  'select': FileCode,       'join': Layers,              'cte': GitBranch,
  'insert': Database,       'update': Settings2,         'delete': Trash2,
  'create-table': Table,   'create_table': Table,
  'alter-table': Settings2, 'alter_table': Settings2,
  'drop-table': TrendingDown,'drop_table': TrendingDown,
  'view': Eye,              'index': Hash,               'table': Table,
  'time-series': TrendingUp,'time_series': TrendingUp,
  'comparison': BarChart3,   'funnel': Hash,             'retention': Clock,
  'pivot': Table,           'unpivot': ArrowRightLeft,
  'type-cast': Hash,        'type_cast': Hash,           'type': Hash,
  'string': Type,           'date': Calendar,
  'explain': Microscope,    'rewrite': Wand2,
  'test-data': Puzzle,      'test_data': Puzzle,
  'sample': Hash,           'summarize': FileText,
  'generator': Terminal,
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/** Get full category design */
export function getCategoryDesign(category: SkillCategory): CategoryDesign {
  return CATEGORY_DESIGN[category];
}

/** Get category colors as Tailwind classes */
export function getCategoryColors(category: SkillCategory): CategoryColorSet {
  return CATEGORY_DESIGN[category].colors;
}

/** Get intent design by operation type */
export function getIntentDesign(operation: string): IntentDesign {
  return INTENT_DESIGN[operation] ?? INTENT_DESIGN.select;
}

/** Get semantic theme by state */
export function getSemanticTheme(state: keyof typeof SEMANTIC_DESIGN) {
  return SEMANTIC_DESIGN[state];
}

/** Get icon component for a skill ID by pattern matching */
export function getSkillIcon(skillId: string): React.ElementType {
  const id = skillId.toLowerCase();
  for (const [key, Icon] of Object.entries(SKILL_ICON_MAP)) {
    if (id.includes(key)) return Icon;
  }
  return Sparkles;
}

/** Get category icon component */
export function getCategoryIcon(category: SkillCategory): React.ElementType {
  return CATEGORY_DESIGN[category]?.icon ?? Brain;
}

/** Build Tailwind class string for a category color variant */
export function categoryClass(category: SkillCategory, variant: keyof CategoryColorSet): string {
  return CATEGORY_DESIGN[category].colors[variant];
}

// ============================================================
// SKILL CARD UTILITIES — consistent card composition
// ============================================================

export const SKILL_CARD_BASE = [
  'w-full',
  'text-left',
  'rounded-xl',
  'transition-all duration-200',
  'border border-transparent',
  'overflow-hidden',
  'group',
  'relative',
].join(' ');

export const SKILL_CARD_DEFAULT = [
  'bg-monokai-bg',
  'border-monokai-accent/40',
  'hover:border-monokai-accent/70',
].join(' ');

export function SKILL_CARD_SELECTED(category: SkillCategory) {
  const c = CATEGORY_DESIGN[category].colors;
  return [
    c.bgSubtle,
    c.border,
    'border-t-2',
    `border-t-[${c.primary}]`,
    'shadow-md shadow-monokai-bg/50',
  ].join(' ');
}

export const SKILL_CARD_PADDING = 'p-3.5';
export const SKILL_ICON_SIZE = 'w-9 h-9';

// ============================================================
// SPACING SYSTEM (4px base) — from monokai.ts
// ============================================================

export const SPACING = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
} as const;

// ============================================================
// TYPOGRAPHY SCALE — from monokai.ts
// ============================================================

export const TYPOGRAPHY = {
  xs: '11px',
  sm: '13px',
  base: '15px',
  lg: '18px',
  xl: '22px',
} as const;

// ============================================================
// RADIUS SYSTEM — from monokai.ts
// ============================================================

export const RADIUS = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

// ============================================================
// ANIMATION SYSTEM — from monokai.ts
// ============================================================

export const ANIMATION = {
  ease: {
    outExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
    inOutQuart: 'cubic-bezier(0.76, 0, 0.24, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  duration: {
    fast: '150ms',
    normal: '250ms',
    slow: '400ms',
  },
} as const;

// ============================================================
// SHADOW SYSTEM — from monokai.ts
// ============================================================

export const SHADOW = {
  sm: '0 1px 2px rgba(0,0,0,0.25)',
  md: '0 2px 8px rgba(0,0,0,0.30)',
  lg: '0 4px 16px rgba(0,0,0,0.35)',
  glow: {
    purple: '0 0 20px rgba(189,147,249,0.15)',
    cyan: '0 0 20px rgba(102,217,239,0.15)',
    green: '0 0 20px rgba(166,226,46,0.12)',
  },
} as const;

// ============================================================
// BRAND DESIGN — from monokai.ts
// ============================================================

/** @deprecated Use BRAND_DESIGN from ai-skills.ts */
export const BRAND_THEME = BRAND_DESIGN;

// ============================================================
// FLAT DESIGN TOKENS — Pure color constants for flat Monokai design
// These avoid hardcoded hex values scattered across components.
// Reference: DESIGN_SYSTEM.md — 3-layer background system
// ============================================================

/**
 * Flat Design color constants.
 * Layer 3 (deepest): #272822 — content area, list backgrounds
 * Layer 2:          #1e1f1c — panels, cards, form areas
 * Layer 1:          #3e3d32 — borders, dividers, sidebar
 * Border accent:    #49483e — interactive element borders
 * Muted text:      #75715e — comments, placeholders, labels
 * Foreground:      #f8f8f2 — primary text
 */
export const FLAT = {
  /** Deepest background (content lists, deepest panels) */
  deepBg:    '#272822',
  /** Surface background (panels, cards, form areas) */
  surface:   '#1e1f1c',
  /** Elevated surface (tab bar, toolbar backgrounds) */
  elevated:  '#3e3d32',
  /** Primary border (interactive element borders) */
  border:    '#3e3d32',
  /** Accent border (active/selected borders) */
  borderAccent: '#49483e',
  /** Muted text (comments, placeholders) */
  muted:     '#75715e',
  /** Primary foreground text */
  fg:        '#f8f8f2',
} as const;

// ============================================================
// CATEGORY ACCENT — Per-category accent hex colors
// Used by SkillInvoker for inline style coloring.
// ============================================================

export const CATEGORY_ACCENT: Record<SkillCategory, string> = {
  modeling:     '#66d9ef',
  wrangling:   '#a6e22e',
  insights:    '#ae81ff',
  optimization: '#fd971f',
  engineering: '#8be9fd',
  handbook:    '#e6db74',
};
