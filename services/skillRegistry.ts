/**
 * AI Skills Registry
 *
 * Central registry for all available AI skills.
 * Manages skill discovery, registration, and lookup.
 *
 * Skill definitions are loaded from `./skills/definitions/`.
 */

import { AISkill, SkillCategory } from '../types';
import { BUILT_IN_SKILLS } from './skills/definitions';

// Re-export for backward compatibility
export { BUILT_IN_SKILLS } from './skills/definitions';

/**
 * SkillRegistry class for managing skills
 */
class SkillRegistry {
  private skills: Map<string, AISkill> = new Map();
  private categories: Map<SkillCategory, string[]> = new Map();

  constructor() {
    this.registerBuiltInSkills();
  }

  private registerBuiltInSkills(): void {
    BUILT_IN_SKILLS.forEach(skill => this.register(skill));
  }

  register(skill: AISkill): void {
    this.skills.set(skill.id, skill);
    this.updateCategoryIndex(skill);
  }

  update(skill: AISkill): boolean {
    if (!this.skills.has(skill.id)) return false;
    this.skills.set(skill.id, skill);
    this.updateCategoryIndex(skill);
    return true;
  }

  unregister(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    if (skill) {
      this.skills.delete(skillId);
      this.removeFromCategoryIndex(skill);
      return true;
    }
    return false;
  }

  get(skillId: string): AISkill | undefined {
    return this.skills.get(skillId);
  }

  getAll(): AISkill[] {
    return Array.from(this.skills.values());
  }

  getByCategory(category: SkillCategory): AISkill[] {
    const ids = this.categories.get(category) || [];
    return ids.map(id => this.skills.get(id)).filter(Boolean) as AISkill[];
  }

  getCategories(): { category: SkillCategory; count: number }[] {
    const result: { category: SkillCategory; count: number }[] = [];
    this.categories.forEach((ids, category) => {
      result.push({ category, count: ids.length });
    });
    return result;
  }

  search(query: string): AISkill[] {
    const q = query.toLowerCase();
    return Array.from(this.skills.values()).filter(s =>
      s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  }

  matchSkillsByIntent(keywords: string[]): AISkill[] {
    const lower = keywords.map(k => k.toLowerCase());
    return Array.from(this.skills.values()).filter(skill => {
      // PRIMARY: Use new declarative 'triggers' system
      if (skill.triggers) {
        const { keywords: tKeywords, patterns: tPatterns } = skill.triggers;
        
        if (tKeywords && tKeywords.some(tk => lower.some(lk => tk.toLowerCase().includes(lk) || lk.includes(tk.toLowerCase())))) {
          return true;
        }
        
        if (tPatterns && tPatterns.some(tp => {
          const reg = typeof tp === 'string' ? new RegExp(tp, 'i') : tp;
          return keywords.some(kw => reg.test(kw));
        })) {
          return true;
        }
      }

      // DEPRECATED FALLBACK: legacy intentKeywords/intentPatterns
      // These will be removed once all skills migrate to triggers
      if (skill.intentKeywords) {
        return skill.intentKeywords.some(kw =>
          lower.some(lk => kw.toLowerCase().includes(lk) || lk.includes(kw.toLowerCase()))
        );
      }

      if (skill.intentPatterns) {
        return skill.intentPatterns.some(pattern => {
          try { return keywords.some(kw => new RegExp(pattern, 'i').test(kw)); }
          catch { return false; }
        });
      }
      return false;
    });
  }

  /**
   * Match advanced triggers for direct recommendation
   */
  matchAdvancedTriggers(userRequest: string): AISkill[] {
    const lower = userRequest.toLowerCase();
    return Array.from(this.skills.values()).filter(skill => {
      if (!skill.triggers) return false;
      const { keywords, patterns } = skill.triggers;

      if (keywords?.some(k => lower.includes(k.toLowerCase()))) return true;
      if (patterns?.some(p => {
        const reg = typeof p === 'string' ? new RegExp(p, 'i') : p;
        return reg.test(userRequest);
      })) return true;

      return false;
    });
  }

  matchSkillsByOperation(operation: string): AISkill[] {
    return Array.from(this.skills.values()).filter(s => s.sqlOperationType === operation);
  }

  findCompatibleSkills(skillId: string): AISkill[] {
    const skill = this.skills.get(skillId);
    if (!skill) return [];

    if (skill.compatibleWith) {
      return skill.compatibleWith.map(id => this.skills.get(id)).filter((s): s is AISkill => s !== undefined);
    }

    const op = skill.sqlOperationType || 'select';
    const compatible = this.getCompatibleOperationTypes(op);
    return Array.from(this.skills.values()).filter(s =>
      s.id !== skillId && s.sqlOperationType && compatible.includes(s.sqlOperationType)
    );
  }

  private getCompatibleOperationTypes(operation: string): string[] {
    const map: Record<string, string[]> = {
      select: ['aggregation', 'join', 'window', 'transformation'],
      insert: [], update: [], delete: [],
      aggregation: ['select', 'window'],
      join: ['select', 'aggregation'],
      window: ['select', 'aggregation'],
      transformation: ['select'],
      analysis: ['aggregation', 'window', 'transformation'],
      optimization: ['select'],
      utility: ['select', 'insert'],
    };
    return map[operation] || [];
  }

  /**
   * Find similar skills based on semantic similarity
   */
  findSimilarSkills(skillId: string, maxResults: number = 5): AISkill[] {
    const skill = this.skills.get(skillId);
    if (!skill) return [];

    const allSkills = Array.from(this.skills.values())
      .filter(s => s.id !== skillId);

    // Calculate similarity scores
    const scored = allSkills.map(other => {
      let score = 0;

      // Same category: high weight
      if (other.category === skill.category) score += 0.4;

      // Same operation type: high weight
      if (other.sqlOperationType === skill.sqlOperationType) score += 0.3;

      // Name word overlap
      const skillWords = new Set(skill.name.toLowerCase().split(/\s+/));
      const otherWords = new Set(other.name.toLowerCase().split(/\s+/));
      const overlap = [...skillWords].filter(w => otherWords.has(w)).length;
      score += overlap * 0.05;

      // Description word overlap
      const skillDescWords = new Set(skill.description.toLowerCase().split(/\s+/));
      const otherDescWords = new Set(other.description.toLowerCase().split(/\s+/));
      const descOverlap = [...skillDescWords].filter(w => otherDescWords.has(w)).length;
      score += descOverlap * 0.02;

      // Trigger keyword overlap
      const skillTriggers = skill.triggers?.keywords || [];
      const otherTriggers = other.triggers?.keywords || [];
      const triggerOverlap = skillTriggers.filter(k => otherTriggers.includes(k)).length;
      score += triggerOverlap * 0.03;

      return { skill: other, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(s => s.skill);
  }

  private updateCategoryIndex(skill: AISkill): void {
    const ids = this.categories.get(skill.category) || [];
    if (!ids.includes(skill.id)) {
      ids.push(skill.id);
      this.categories.set(skill.category, ids);
    }
  }

  private removeFromCategoryIndex(skill: AISkill): void {
    const ids = this.categories.get(skill.category);
    if (ids) {
      const idx = ids.indexOf(skill.id);
      if (idx > -1) ids.splice(idx, 1);
    }
  }
}

// Singleton
export const skillRegistry = new SkillRegistry();

// Convenience functions
export const getSkill = (id: string) => skillRegistry.get(id);
export const getAllSkills = () => skillRegistry.getAll();
export const getSkillsByCategory = (category: SkillCategory) => skillRegistry.getByCategory(category);
export const searchSkills = (query: string) => skillRegistry.search(query);
export const getSkillCategories = () => skillRegistry.getCategories();
export const matchSkillsByIntent = (keywords: string[]) => skillRegistry.matchSkillsByIntent(keywords);
export const matchSkillsByOperation = (operation: string) => skillRegistry.matchSkillsByOperation(operation);
export const findCompatibleSkills = (skillId: string) => skillRegistry.findCompatibleSkills(skillId);
export const findSimilarSkills = (skillId: string, maxResults?: number) => skillRegistry.findSimilarSkills(skillId, maxResults);
export const updateSkill = (skill: AISkill) => skillRegistry.update(skill);