/**
 * SkillHistoryStorage - Persistent storage for skill execution history and favorites
 *
 * Uses localStorage to persist:
 * - Execution history (last 100 entries)
 * - Favorite skills
 * - Execution statistics
 */

const HISTORY_KEY = 'duckdb_skill_history';
const FAVORITES_KEY = 'duckdb_skill_favorites';
const STATS_KEY = 'duckdb_skill_stats';
const MAX_HISTORY_SIZE = 100;

export interface SkillHistoryEntry {
  id: string;
  skillId: string;
  skillName: string;
  skillCategory: string;
  inputs: Record<string, any>;
  result: {
    success: boolean;
    sql?: string;
    error?: string;
    explanation?: string;
  };
  timestamp: number;
  duration?: number;  // execution time in ms
  tableName?: string;  // context table name
}

export interface SkillFavorite {
  skillId: string;
  addedAt: number;
  notes?: string;  // user notes
  tags?: string[];  // custom tags
}

export interface SkillStats {
  skillId: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  totalDuration: number;  // total execution time in ms
  lastExecuted: number;  // timestamp
  lastInputs: Record<string, any>;  // last used inputs
}

// ============================================================
// History Operations
// ============================================================

export function getSkillHistory(): SkillHistoryEntry[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function addToSkillHistory(entry: Omit<SkillHistoryEntry, 'id' | 'timestamp'>): void {
  try {
    const history = getSkillHistory();
    const newEntry: SkillHistoryEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    history.unshift(newEntry);
    // Keep only the last MAX_HISTORY_SIZE entries
    const trimmed = history.slice(0, MAX_HISTORY_SIZE);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    // Update stats
    updateSkillStats(entry.skillId, entry.result.success, entry.duration);
  } catch (e) {
    console.warn('Failed to save skill history:', e);
  }
}

export function clearSkillHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

export function deleteSkillHistoryEntry(id: string): void {
  try {
    const history = getSkillHistory();
    const filtered = history.filter(h => h.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('Failed to delete history entry:', e);
  }
}

export function searchSkillHistory(query: string): SkillHistoryEntry[] {
  const history = getSkillHistory();
  const q = query.toLowerCase();
  return history.filter(h =>
    h.skillName.toLowerCase().includes(q) ||
    h.result.sql?.toLowerCase().includes(q) ||
    h.result.explanation?.toLowerCase().includes(q) ||
    h.result.error?.toLowerCase().includes(q)
  );
}

// ============================================================
// Favorites Operations
// ============================================================

export function getSkillFavorites(): SkillFavorite[] {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function addSkillFavorite(skillId: string, notes?: string, tags?: string[]): void {
  try {
    const favorites = getSkillFavorites();
    if (favorites.some(f => f.skillId === skillId)) return;  // already favorited
    favorites.push({
      skillId,
      addedAt: Date.now(),
      notes,
      tags,
    });
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch (e) {
    console.warn('Failed to add favorite:', e);
  }
}

export function removeSkillFavorite(skillId: string): void {
  try {
    const favorites = getSkillFavorites();
    const filtered = favorites.filter(f => f.skillId !== skillId);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('Failed to remove favorite:', e);
  }
}

export function isSkillFavorited(skillId: string): boolean {
  const favorites = getSkillFavorites();
  return favorites.some(f => f.skillId === skillId);
}

export function updateSkillFavoriteNotes(skillId: string, notes?: string, tags?: string[]): void {
  try {
    const favorites = getSkillFavorites();
    const idx = favorites.findIndex(f => f.skillId === skillId);
    if (idx >= 0) {
      favorites[idx] = { ...favorites[idx], notes, tags };
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    }
  } catch (e) {
    console.warn('Failed to update favorite:', e);
  }
}

// ============================================================
// Stats Operations
// ============================================================

export function getSkillStats(): Record<string, SkillStats> {
  try {
    const stored = localStorage.getItem(STATS_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

export function getSkillStat(skillId: string): SkillStats | null {
  const stats = getSkillStats();
  return stats[skillId] || null;
}

function updateSkillStats(skillId: string, success: boolean, duration?: number): void {
  try {
    const stats = getSkillStats();
    if (!stats[skillId]) {
      stats[skillId] = {
        skillId,
        totalExecutions: 0,
        successCount: 0,
        failureCount: 0,
        totalDuration: 0,
        lastExecuted: 0,
        lastInputs: {},
      };
    }
    stats[skillId].totalExecutions++;
    if (success) {
      stats[skillId].successCount++;
    } else {
      stats[skillId].failureCount++;
    }
    if (duration) {
      stats[skillId].totalDuration += duration;
    }
    stats[skillId].lastExecuted = Date.now();
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    console.warn('Failed to update stats:', e);
  }
}

export function recordSkillInputs(skillId: string, inputs: Record<string, any>): void {
  try {
    const stats = getSkillStats();
    if (stats[skillId]) {
      stats[skillId].lastInputs = inputs;
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    }
  } catch (e) {
    console.warn('Failed to record inputs:', e);
  }
}

// ============================================================
// Usage Analytics
// ============================================================

export function getMostUsedSkills(limit: number = 5): { skillId: string; skillName: string; count: number }[] {
  const stats = getSkillStats();
  return Object.values(stats)
    .sort((a, b) => b.totalExecutions - a.totalExecutions)
    .slice(0, limit)
    .map(s => ({ skillId: s.skillId, skillName: s.skillId, count: s.totalExecutions }));
}

export function getSuccessRate(skillId: string): number {
  const stats = getSkillStats();
  const s = stats[skillId];
  if (!s || s.totalExecutions === 0) return 0;
  return (s.successCount / s.totalExecutions) * 100;
}

export function getAverageDuration(skillId: string): number {
  const stats = getSkillStats();
  const s = stats[skillId];
  if (!s || s.totalExecutions === 0) return 0;
  return s.totalDuration / s.totalExecutions;
}
