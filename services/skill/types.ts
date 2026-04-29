/**
 * Internal types for the skill module
 *
 * Re-exports key types from the main types.ts and defines
 * internal types used within the skill pipeline services.
 */

import type { IntentAnalysis, SqlOperationType, SkillChain, SkillChainStep } from '../../types';

/** Source of confidence score for intent analysis */
export type IntentConfidenceSource = 'keyword' | 'pattern' | 'rule' | 'ai';

/** Intent confidence with attribution */
export interface IntentConfidence {
  score: number;          // 0-1 confidence score
  source: IntentConfidenceSource;
  matchedTerms?: string[];
}

/** Result of parameter extraction */
export interface ExtractionResult {
  fields: Record<string, unknown>;
  missingFields: string[];
  confidence: number;     // 0-1 extraction confidence
}

/** A matched rule during intent analysis */
export interface RuleMatch {
  ruleId: string;
  operation: SqlOperationType;
  priority: number;
  score: number;          // raw accumulated score
  normalizedScore: number; // capped at 1.0
  matchedTerms: string[];
  confidence: number;
}
