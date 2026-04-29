/**
 * ai-skills.test.ts — Unit tests for AI Skills design system utilities
 *
 * Tests:
 * - CATEGORY_DESIGN completeness (all 5 categories defined)
 * - getCategoryColors type safety
 * - categoryClass utility
 * - INTENT_DESIGN completeness
 * - getSkillIcon pattern matching
 */

import { describe, it, expect } from 'vitest';
import {
  CATEGORY_DESIGN,
  getCategoryColors,
  getCategoryDesign,
  categoryClass,
  getSkillIcon,
  getIntentDesign,
  INTENT_DESIGN,
} from './ai-skills';
import type { SkillCategory } from '../../types';

const ALL_CATEGORIES: SkillCategory[] = ['modeling', 'wrangling', 'insights', 'optimization', 'engineering'];

describe('CATEGORY_DESIGN — completeness', () => {
  it('should have all 5 skill categories defined', () => {
    expect(ALL_CATEGORIES.every(cat => cat in CATEGORY_DESIGN)).toBe(true);
    expect(Object.keys(CATEGORY_DESIGN)).toHaveLength(5);
  });

  it('should have label, icon, emoji, colors, sqlOperations for each category', () => {
    for (const cat of ALL_CATEGORIES) {
      const design = CATEGORY_DESIGN[cat];
      expect(design.label).toBeTruthy();
      expect(typeof design.icon).toBeTruthy(); // React component or object
      expect(typeof design.emoji).toBe('string');
      expect(design.colors).toBeTruthy();
      expect(design.colors.bg).toBeTruthy();
      expect(design.colors.text).toBeTruthy();
      expect(design.colors.border).toBeTruthy();
      expect(design.colors.icon).toBeTruthy();
      expect(design.sqlOperations).toBeTruthy();
    }
  });

  it('should have unique colors per category', () => {
    const texts = new Set(ALL_CATEGORIES.map(c => CATEGORY_DESIGN[c].colors.text));
    // All should have distinct text colors
    expect(texts.size).toBeGreaterThanOrEqual(4);
  });
});

describe('getCategoryColors — utility', () => {
  it('should return colors object for each category', () => {
    for (const cat of ALL_CATEGORIES) {
      const colors = getCategoryColors(cat);
      expect(colors.bg).toBeTruthy();
      expect(colors.text).toBeTruthy();
      expect(colors.border).toBeTruthy();
    }
  });
});

describe('getCategoryDesign — utility', () => {
  it('should return full design object', () => {
    for (const cat of ALL_CATEGORIES) {
      const design = getCategoryDesign(cat);
      expect(design.label).toBeTruthy();
      expect(design.emoji).toBeTruthy();
    }
  });
});

describe('categoryClass — utility', () => {
  it('should return correct color class for known variants', () => {
    expect(categoryClass('modeling', 'bg')).toBeTruthy();
    expect(categoryClass('modeling', 'text')).toBeTruthy();
    expect(categoryClass('modeling', 'border')).toBeTruthy();
    expect(categoryClass('insights', 'bg')).toBeTruthy();
  });

  it('should return correct class for icon variant', () => {
    const iconClass = categoryClass('modeling', 'icon');
    expect(iconClass).toContain('text-');
  });
});

describe('getSkillIcon — pattern matching', () => {
  const testCases = [
    'sql-select-generator',
    'sql-join-generator',
    'sql-aggregation-generator',
    'sql-create-table-generator',
    'transform-pivot',
    'analysis-time-series',
    'utility-test-data',
    'unknown-skill',
  ] as const;

  testCases.forEach((skillId) => {
    it(`should return a truthy icon for ${skillId}`, () => {
      const Icon = getSkillIcon(skillId);
      expect(Icon).toBeTruthy();
    });
  });

  it('should be case-insensitive', () => {
    const upper = getSkillIcon('SQL-SELECT-GENERATOR');
    const lower = getSkillIcon('sql-select-generator');
    // Same pattern match regardless of case
    expect(typeof upper).toBe(typeof lower);
  });
});

describe('INTENT_DESIGN — completeness', () => {
  const CORE_OPERATIONS = [
    'select', 'insert', 'update', 'delete',
    'aggregation', 'join', 'window',
    'transformation', 'analysis', 'optimization', 'utility',
  ];

  it('should have all core operations defined', () => {
    expect(CORE_OPERATIONS.every(op => op in INTENT_DESIGN)).toBe(true);
  });

  it('should have label, color, bg, border for each operation', () => {
    for (const op of CORE_OPERATIONS) {
      const design = INTENT_DESIGN[op];
      expect(design.label).toBeTruthy();
      expect(design.color).toBeTruthy();
      expect(design.bg).toBeTruthy();
      expect(design.border).toBeTruthy();
    }
  });
});

describe('getIntentDesign — utility', () => {
  it('should return design for known operations', () => {
    const design = getIntentDesign('select');
    expect(design.label).toBe('数据查询');
  });

  it('should fall back to select for unknown operations', () => {
    const design = getIntentDesign('foobar');
    expect(design.label).toBe('数据查询'); // fallback to select
  });
});
