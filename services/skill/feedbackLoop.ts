/**
 * FeedbackLoop.ts — User feedback capture and implicit improvement loop
 *
 * Tracks explicit feedback (thumbs up/down on AI outputs) and implicit feedback
 * (execution success/failure) to build a feedback log that can be used to
 * improve future AI generations and skill matching.
 *
 * Design follows PROJECT-HARNESS.md:
 * - Explicit assumptions: feedback categories are documented
 * - Testable criteria: feedback items have numeric scores
 * - Feedback loops: history informs future skill suggestions
 */

import type { SkillResult } from '../../types';

const FEEDBACK_KEY = 'duckdb_feedback_log';
const MAX_FEEDBACK_ENTRIES = 500;

export type FeedbackType =
  | 'thumbs_up'    // User explicitly approved the AI output
  | 'thumbs_down'  // User explicitly rejected the AI output
  | 'sql_executed' // User ran the SQL successfully
  | 'sql_error'    // Execution produced an error
  | 'auto_verified'; // System auto-verified correctness

export interface FeedbackEntry {
  id: string;
  timestamp: number;
  skillId: string;
  skillName: string;
  feedbackType: FeedbackType;
  /** Numeric score: 1 (worst) to 5 (best) */
  score: number;
  /** User's optional text comment */
  comment?: string;
  /** The AI-generated SQL (if any) */
  sql?: string;
  /** Execution error message (for sql_error type) */
  errorMessage?: string;
  /** What the user changed (for thumbs_down type) */
  userCorrection?: string;
  /** Context: table name used */
  tableName?: string;
  /** Context: user request text */
  userRequest?: string;
  /** Whether this feedback has been applied to improve skill/template */
  applied: boolean;
}

export interface FeedbackStats {
  skillId: string;
  totalFeedback: number;
  thumbsUp: number;
  thumbsDown: number;
  sqlExecuted: number;
  sqlError: number;
  averageScore: number;
  lastFeedback: number;
}

// ============================================================
// Feedback Log Operations
// ============================================================

function loadFeedbackLog(): FeedbackEntry[] {
  try {
    const stored = localStorage.getItem(FEEDBACK_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function saveFeedbackLog(log: FeedbackEntry[]): void {
  // Trim to max size (keep most recent)
  const trimmed = log.slice(-MAX_FEEDBACK_ENTRIES);
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(trimmed));
}

// ============================================================
// Feedback Capture
// ============================================================

/**
 * Record explicit user feedback on AI output
 */
export function recordFeedback(params: {
  skillId: string;
  skillName: string;
  feedbackType: 'thumbs_up' | 'thumbs_down';
  sql?: string;
  userRequest?: string;
  tableName?: string;
  comment?: string;
  userCorrection?: string;
}): FeedbackEntry {
  const entry: FeedbackEntry = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    skillId: params.skillId,
    skillName: params.skillName,
    feedbackType: params.feedbackType,
    score: params.feedbackType === 'thumbs_up' ? 5 : 1,
    sql: params.sql,
    userRequest: params.userRequest,
    tableName: params.tableName,
    comment: params.comment,
    userCorrection: params.userCorrection,
    applied: false,
  };

  const log = loadFeedbackLog();
  log.push(entry);
  saveFeedbackLog(log);

  return entry;
}

/**
 * Record implicit feedback from execution result
 */
export function recordImplicitFeedback(params: {
  skillId: string;
  skillName: string;
  result: SkillResult;
  tableName?: string;
  userRequest?: string;
}): FeedbackEntry | null {
  if (!params.result.executionTime) return null;

  const entry: FeedbackEntry = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    skillId: params.skillId,
    skillName: params.skillName,
    feedbackType: params.result.success ? 'sql_executed' : 'sql_error',
    score: params.result.success ? 4 : 1,
    sql: params.result.sql,
    errorMessage: params.result.error,
    tableName: params.tableName,
    userRequest: params.userRequest,
    applied: false,
  };

  const log = loadFeedbackLog();
  log.push(entry);
  saveFeedbackLog(log);

  return entry;
}

// ============================================================
// Feedback Retrieval
// ============================================================

/**
 * Get all feedback for a specific skill
 */
export function getSkillFeedback(skillId: string): FeedbackEntry[] {
  return loadFeedbackLog().filter(e => e.skillId === skillId);
}

/**
 * Get recent feedback entries
 */
export function getRecentFeedback(limit = 50): FeedbackEntry[] {
  const log = loadFeedbackLog();
  return log.slice(-limit).reverse();
}

/**
 * Get feedback statistics for a skill
 */
export function getFeedbackStats(skillId: string): FeedbackStats | null {
  const entries = getSkillFeedback(skillId);
  if (entries.length === 0) return null;

  const thumbsUp = entries.filter(e => e.feedbackType === 'thumbs_up').length;
  const thumbsDown = entries.filter(e => e.feedbackType === 'thumbs_down').length;
  const sqlExecuted = entries.filter(e => e.feedbackType === 'sql_executed').length;
  const sqlError = entries.filter(e => e.feedbackType === 'sql_error').length;
  const totalScore = entries.reduce((sum, e) => sum + e.score, 0);

  return {
    skillId,
    totalFeedback: entries.length,
    thumbsUp,
    thumbsDown,
    sqlExecuted,
    sqlError,
    averageScore: Math.round((totalScore / entries.length) * 10) / 10,
    lastFeedback: entries[entries.length - 1].timestamp,
  };
}

/**
 * Get overall feedback statistics across all skills
 */
export function getOverallFeedbackStats(): {
  totalEntries: number;
  positiveRate: number;
  topSkills: { skillId: string; skillName: string; score: number }[];
} {
  const log = loadFeedbackLog();
  if (log.length === 0) {
    return { totalEntries: 0, positiveRate: 0, topSkills: [] };
  }

  const positive = log.filter(e => e.score >= 4).length;
  const positiveRate = Math.round((positive / log.length) * 100);

  // Aggregate by skill
  const skillMap = new Map<string, { skillName: string; totalScore: number; count: number }>();
  for (const entry of log) {
    const existing = skillMap.get(entry.skillId);
    if (existing) {
      existing.totalScore += entry.score;
      existing.count += 1;
    } else {
      skillMap.set(entry.skillId, {
        skillName: entry.skillName,
        totalScore: entry.score,
        count: 1,
      });
    }
  }

  const topSkills = Array.from(skillMap.entries())
    .map(([skillId, data]) => ({
      skillId,
      skillName: data.skillName,
      score: Math.round((data.totalScore / data.count) * 10) / 10,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return { totalEntries: log.length, positiveRate, topSkills };
}

/**
 * Mark feedback entry as applied (used for improvement tracking)
 */
export function markFeedbackApplied(feedbackId: string): void {
  const log = loadFeedbackLog();
  const entry = log.find(e => e.id === feedbackId);
  if (entry) {
    entry.applied = true;
    saveFeedbackLog(log);
  }
}

/**
 * Clear all feedback (for testing/reset)
 */
export function clearFeedbackLog(): void {
  localStorage.removeItem(FEEDBACK_KEY);
}
