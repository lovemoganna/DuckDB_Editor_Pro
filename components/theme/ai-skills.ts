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
  /** Semantic CSS color; use color-mix for transparency rather than hex suffixes. */
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
      primary: 'var(--monokai-cyan)',
      bg: 'bg-monokai-cyan/[8%]',
      bgSubtle: 'bg-monokai-cyan/[5%]',
      iconBg: 'bg-monokai-cyan/[15%]',
      border: 'border-monokai-border',
      text: 'text-monokai-cyan',
      icon: 'text-monokai-cyan',
      gradientFrom: 'from-monokai-cyan/[10%]',
      gradientTo: 'to-monokai-cyan/[5%]',
    },
    sqlOperations: ['select', 'insert', 'update', 'delete', 'aggregation', 'join', 'window', 'cte'],
  },
  wrangling: {
    label: '清洗与转换',
    icon: RefreshCw,
    emoji: '🔄',
    colors: {
      primary: 'var(--monokai-accent)',
      bg: 'bg-monokai-accent/[8%]',
      bgSubtle: 'bg-monokai-accent/[5%]',
      iconBg: 'bg-monokai-accent/[15%]',
      border: 'border-monokai-border',
      text: 'text-monokai-accent',
      icon: 'text-monokai-accent',
      gradientFrom: 'from-monokai-accent/[10%]',
      gradientTo: 'to-monokai-accent/[5%]',
    },
    sqlOperations: ['transformation'],
  },
  insights: {
    label: '深度分析与洞察',
    icon: BarChart3,
    emoji: '📊',
    colors: {
      primary: 'var(--monokai-purple)',
      bg: 'bg-monokai-purple/[8%]',
      bgSubtle: 'bg-monokai-purple/[5%]',
      iconBg: 'bg-monokai-purple/[15%]',
      border: 'border-monokai-border',
      text: 'text-monokai-purple',
      icon: 'text-monokai-purple',
      gradientFrom: 'from-monokai-purple/[10%]',
      gradientTo: 'to-monokai-purple/[5%]',
    },
    sqlOperations: ['analysis'],
  },
  optimization: {
    label: '诊断与优化',
    icon: Zap,
    emoji: '🚀',
    colors: {
      primary: 'var(--monokai-orange)',
      bg: 'bg-monokai-orange/[8%]',
      bgSubtle: 'bg-monokai-orange/[5%]',
      iconBg: 'bg-monokai-orange/[15%]',
      border: 'border-monokai-border',
      text: 'text-monokai-orange',
      icon: 'text-monokai-orange',
      gradientFrom: 'from-monokai-orange/[10%]',
      gradientTo: 'to-monokai-orange/[5%]',
    },
    sqlOperations: ['optimization'],
  },
  engineering: {
    label: '工程与运维',
    icon: Wrench,
    emoji: '🛠️',
    colors: {
      primary: 'var(--monokai-cyan)',
      bg: 'bg-monokai-cyan/[8%]',
      bgSubtle: 'bg-monokai-cyan/[5%]',
      iconBg: 'bg-monokai-cyan/[15%]',
      border: 'border-monokai-border',
      text: 'text-monokai-cyan',
      icon: 'text-monokai-cyan',
      gradientFrom: 'from-monokai-cyan/[10%]',
      gradientTo: 'to-monokai-cyan/[5%]',
    },
    sqlOperations: ['utility'],
  },
  handbook: {
    label: '官方手册',
    icon: BookOpen,
    emoji: '📖',
    colors: {
      primary: 'var(--monokai-yellow)',
      bg: 'bg-monokai-yellow/[8%]',
      bgSubtle: 'bg-monokai-yellow/[5%]',
      iconBg: 'bg-monokai-yellow/[15%]',
      border: 'border-monokai-border',
      text: 'text-monokai-yellow',
      icon: 'text-monokai-yellow',
      gradientFrom: 'from-monokai-yellow/[10%]',
      gradientTo: 'to-monokai-yellow/[5%]',
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
  select:       { label: '数据查询',   color: 'text-monokai-cyan',  bg: 'bg-monokai-cyan/[20%]',  border: 'border-monokai-border' },
  insert:       { label: '数据插入',   color: 'text-monokai-accent', bg: 'bg-monokai-accent/[20%]',  border: 'border-monokai-border' },
  update:       { label: '数据更新',   color: 'text-monokai-yellow', bg: 'bg-monokai-yellow/[20%]',  border: 'border-monokai-border' },
  delete:       { label: '数据删除',   color: 'text-monokai-pink', bg: 'bg-monokai-pink/[20%]',  border: 'border-monokai-border' },
  aggregation:  { label: '聚合统计',   color: 'text-monokai-purple', bg: 'bg-monokai-purple/[20%]',  border: 'border-monokai-border' },
  join:         { label: '多表关联',   color: 'text-monokai-pink', bg: 'bg-monokai-pink/[20%]',  border: 'border-monokai-border' },
  window:       { label: '窗口函数',   color: 'text-monokai-cyan', bg: 'bg-monokai-cyan/[20%]',  border: 'border-monokai-border' },
  transformation:{ label: '数据转换',  color: 'text-monokai-orange', bg: 'bg-monokai-orange/[20%]',  border: 'border-monokai-border' },
  analysis:     { label: '数据分析',   color: 'text-monokai-purple', bg: 'bg-monokai-purple/[20%]',  border: 'border-monokai-border' },
  optimization:  { label: 'SQL 优化',   color: 'text-monokai-yellow', bg: 'bg-monokai-yellow/[20%]',  border: 'border-monokai-border' },
  utility:      { label: '工具生成',   color: 'text-monokai-comment', bg: 'bg-monokai-comment/[20%]',  border: 'border-monokai-border' },
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
  success: { primary: 'var(--monokai-accent)', bg: 'bg-monokai-accent/[12%]', border: 'border-monokai-border', text: 'text-monokai-accent' },
  error:   { primary: 'var(--monokai-pink)', bg: 'bg-monokai-pink/[12%]',   border: 'border-rose-500/40',   text: 'text-monokai-pink' },
  warning: { primary: 'var(--monokai-yellow)', bg: 'bg-monokai-yellow/[12%]', border: 'border-amber-500/30', text: 'text-monokai-yellow' },
  info:    { primary: 'var(--monokai-cyan)', bg: 'bg-monokai-cyan/[12%]',  border: 'border-monokai-border',   text: 'text-monokai-cyan' },
} as const;

// ============================================================
// BRAND DESIGN — Primary action styling
// ============================================================

export const BRAND_DESIGN = {
  primaryGradient: 'from-monokai-purple to-monokai-pink',
  primaryBg: 'bg-gradient-to-r from-monokai-purple to-monokai-pink',
  primaryText: 'text-white',
  primaryBtn: 'bg-gradient-to-r from-monokai-purple to-monokai-pink text-white hover:opacity-90 shadow-md shadow-monokai-purple/[20%]',
  primaryBtnDisabled: 'bg-gradient-to-r from-monokai-purple/[50%] to-monokai-pink/[50%] text-white/[60%] cursor-not-allowed',
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
  'border-monokai-border',
  'hover:border-white/15',
].join(' ');

export function SKILL_CARD_SELECTED(category: SkillCategory) {
  const c = CATEGORY_DESIGN[category].colors;
  return [
    c.bgSubtle,
    'border-monokai-border',
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

/** Spacing — mirrors index.css --space-* (8px grid). Prefer Tailwind spacing / CSS vars. */
export const SPACING = {
  0: '0',
  1: 'var(--space-1)',  // 4px
  2: 'var(--space-2)',  // 8px
  3: 'var(--space-3)',  // 12px
  4: 'var(--space-4)',  // 16px
  5: 'var(--space-5)',  // 24px
  6: 'var(--space-6)',  // 32px
  8: 'var(--space-8)',  // 48px
} as const;

// ============================================================
// TYPOGRAPHY SCALE — compact density (body = 12px)
// ============================================================

export const TYPOGRAPHY = {
  xs: '11px',   // meta
  sm: '12px',   // body / text-xs
  base: '14px', // text-sm
  lg: '16px',
  xl: '18px',
} as const;

// ============================================================
// RADIUS SYSTEM — mirrors index.css --radius-*
// ============================================================

export const RADIUS = {
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  full: 'var(--radius-full)',
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
    amethyst: '0 0 20px rgba(189,147,249,0.15)',
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
 * Flat Design color constants — mapped to Monokai SSOT (index.css).
 * Layer 0 (bg):       --monokai-bg
 * Layer 1 (surface):  --monokai-surface / sidebar
 * Layer 2 (elevated): --monokai-elevated
 */
export const FLAT = {
  /** Deepest background (content lists, deepest panels) */
  deepBg:    'var(--monokai-bg)',
  /** Surface background (panels, cards, form areas) */
  surface:   'var(--monokai-surface)',
  /** Elevated surface (tab bar, toolbar backgrounds) */
  elevated:  'var(--monokai-elevated)',
  /** Primary border (interactive element borders) */
  border:    'var(--monokai-border)',
  /** Accent border (active/selected borders) */
  borderAccent: 'var(--monokai-border-strong)',
  /** Muted text (comments, placeholders) */
  muted:     'var(--monokai-comment)',
  /** Primary foreground text */
  fg:        'var(--monokai-fg)',
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
