/**
 * AI Skills Theme - Unified Design System
 *
 * DEPRECATED: All theme values have moved to ./ai-skills.ts
 *
 * This file re-exports everything from ai-skills.ts and provides
 * backward-compatible aliases for code that still imports from './monokai'.
 *
 * New code should import from './ai-skills' directly:
 *   import { CATEGORY_DESIGN, SEMANTIC_DESIGN, ... } from './ai-skills';
 *
 * DO NOT add new theme values here. All new values go in ai-skills.ts.
 */

import type { SkillCategory } from '../../types';

// Namespace import creates a local binding (unlike `export *` which only creates re-exports)
// so we can reference ai-skills names in local alias definitions.
import * as AI from './ai-skills';

// Re-export everything from ai-skills for consumers
export {
  CATEGORY_DESIGN,
  getCategoryDesign,
  SEMANTIC_DESIGN,
  getSemanticTheme,
  BRAND_DESIGN,
  SKILL_ICON_MAP,
  getSkillIcon,
  getCategoryIcon,
  categoryClass,
  CATEGORY_ACCENT,
  INTENT_DESIGN,
  getIntentDesign,
  SKILL_CARD_BASE,
  SKILL_CARD_DEFAULT,
  SKILL_CARD_SELECTED,
  SKILL_CARD_PADDING,
  SKILL_ICON_SIZE,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  ANIMATION,
  SHADOW,
} from './ai-skills';

// Re-export types with proper `export type` syntax
export type { CategoryColorSet } from './ai-skills';
export type { CategoryDesign } from './ai-skills';
export type { IntentDesign } from './ai-skills';

// ============================================================
// Backward-compatible aliases (deprecated)
// ============================================================

/** @deprecated Use CATEGORY_DESIGN from './ai-skills' */
export const CATEGORY_THEME = AI.CATEGORY_DESIGN;

/** @deprecated Use getCategoryDesign from './ai-skills' */
export const getCategoryTheme = AI.getCategoryDesign;

/** @deprecated Use SEMANTIC_DESIGN from './ai-skills' */
export const SEMANTIC_THEME = AI.SEMANTIC_DESIGN;

/** @deprecated Use CATEGORY_DESIGN or categoryClass() from './ai-skills' */
export function categoryClasses(category: SkillCategory, variant: keyof AI.CategoryColorSet): string {
  return AI.categoryClass(category, variant);
}
