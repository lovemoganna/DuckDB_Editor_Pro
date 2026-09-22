// ============================================
// AI Skills Module Types
// ============================================

import type { ColumnInfo } from './db';

// Re-export for cross-module convenience
export type { ColumnInfo };

// ============================================================
// Skill Category & IO Types
// ============================================================

export type SkillCategory = 'modeling' | 'wrangling' | 'insights' | 'optimization' | 'engineering' | 'handbook';
export type InputFieldType = 'text' | 'textarea' | 'select' | 'table' | 'column' | 'number' | 'boolean';
export type OutputType = 'sql' | 'json' | 'markdown' | 'table';
export type SqlOperationType =
  | 'select' | 'insert' | 'update' | 'delete'
  | 'aggregation' | 'join' | 'window'
  | 'transformation' | 'analysis' | 'optimization' | 'utility';

export type SkillRoutingOption = {
  mode: 'auto' | 'hybrid';
  autoExecute: boolean;
  showConfidence: boolean;
  maxSuggestions: number;
};

// ============================================================
// Skill Input Fields (Discriminated Union)
// ============================================================

interface BaseSkillInputField {
  name: string;
  required: boolean;
  label: string;
  description?: string;
  defaultValue?: unknown;
}

export interface TextSkillInputField extends BaseSkillInputField {
  type: 'text';
  placeholder?: string;
}

export interface TextareaSkillInputField extends BaseSkillInputField {
  type: 'textarea';
  placeholder?: string;
  rows?: number;
}

export interface SelectSkillInputField extends BaseSkillInputField {
  type: 'select';
  options: string[];
  placeholder?: string;
}

export interface NumberSkillInputField extends BaseSkillInputField {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export interface BooleanSkillInputField extends BaseSkillInputField {
  type: 'boolean';
}

export interface TableSkillInputField extends BaseSkillInputField {
  type: 'table';
  placeholder?: string;
}

export interface ColumnSkillInputField extends BaseSkillInputField {
  type: 'column';
  allowMultiple?: boolean;
  placeholder?: string;
}

export type SkillInputField =
  | TextSkillInputField
  | TextareaSkillInputField
  | SelectSkillInputField
  | NumberSkillInputField
  | BooleanSkillInputField
  | TableSkillInputField
  | ColumnSkillInputField;

export function isSkillInputField(v: unknown): v is SkillInputField {
  if (!v || typeof v !== 'object') return false;
  const t = (v as Record<string, unknown>).type;
  return (
    t === 'text' || t === 'textarea' || t === 'select' ||
    t === 'number' || t === 'boolean' || t === 'table' || t === 'column'
  );
}

// ============================================================
// Skill Execution
// ============================================================

export interface SkillResult {
  success: boolean;
  sql?: string;
  explanation?: string;
  error?: string;
  metadata?: Record<string, any>;
  warnings?: string[];
  executionTime?: number;
}

export interface SkillExecutionContext<T extends Record<string, unknown> = Record<string, unknown>> {
  tableName?: string;
  columns?: ColumnInfo[];
  schema?: string;
  sampleData?: T[];
  currentSql?: string;
  userIntent?: string;
  matchedOfficialSkills?: string[];
  /** Chain execution state for multi-step skills */
  chainData?: SkillChainData;
  /** ER relationship metadata from ERDetector */
  erInfo?: {
    foreignKeys: { column: string; referencedTable: string; referencedColumn: string; relationshipType?: string }[];
  };
  [key: string]: unknown;
}

export interface SkillInvokeRequest {
  skillId: string;
  inputs: Record<string, any>;
  context: SkillExecutionContext;
  simulateOnly?: boolean;
  onChunk?: (text: string) => void;
  cancelToken?: { cancelled: boolean };
}

// ============================================================
// Skill Definition
// ============================================================

export interface SkillExample {
  name: string;
  input: Record<string, any>;
  description: string;
}

export interface AISkill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  icon?: string;
  inputSchema: SkillInputField[];
  outputType: OutputType;
  requiresTable?: boolean;
  requiresColumns?: boolean;
  examples?: SkillExample[];
  intentKeywords?: string[];
  intentPatterns?: string[];
  triggers?: {
    keywords?: string[];
    patterns?: (string | RegExp)[];
    sqlOperations?: SqlOperationType[];
    confidence?: number;
  };
  inputParser?: (request: string, context: SkillExecutionContext) => Record<string, any>;
  compatibleWith?: string[];
  sqlOperationType?: SqlOperationType;
  generatorId?: string;
  execute?: (input: Record<string, any>, context: SkillExecutionContext) => Promise<SkillResult>;
  _layer?: 'perception' | 'strategy' | 'execution' | 'meta';
}

// ============================================================
// Intent Analysis
// ============================================================

export interface IntentAnalysis {
  intent: SqlOperationType;
  confidence: number;
  requiredSkills: string[];
  matchedOfficialSkills?: string[];
  skillChain?: SkillChain;
  missingInfo?: string[];
  userRequest: string;
  reasoning?: string;
}

// ============================================================
// Skill Chain (Multi-step orchestration)
// ============================================================

/**
 * Structured data passed between chain steps.
 * Replaces the previous approach of only passing `currentSql: string`.
 */
export interface SkillChainData {
  /** SQL fragments produced by previous steps, joined as needed */
  sqlFragments: string[];
  /** Key-value metadata from each step (e.g., { "step_0": { "rows_affected": 5 } }) */
  stepOutputs: Record<string, Record<string, unknown>>;
  /** Tables referenced in the chain so far */
  referencedTables: string[];
  /** Error messages from failed steps */
  errors: string[];
}

export interface SkillChainStep<TInputs extends Record<string, unknown> = Record<string, unknown>> {
  stepId: string;
  skillId: string;
  inputs: TInputs;
  dependsOn: string[];
  /** Optional output key in SkillChainData.stepOutputs for this step */
  outputKey?: string;
  expectedOutput?: string;
}

export interface SkillChain {
  steps: SkillChainStep[];
  finalSql?: string;
  /** Structured data accumulated during chain execution */
  data?: SkillChainData;
}

// ============================================================
// Skill History & Panel
// ============================================================

export interface SkillExecutionHistory {
  id: string;
  skillId: string;
  skillName: string;
  input: Record<string, any>;
  result: SkillResult;
  timestamp: number;
  duration: number;
}

export interface SkillPanelState {
  isOpen: boolean;
  selectedSkillId: string | null;
  isExecuting: boolean;
  history: SkillExecutionHistory[];
}

// ============================================================
// AI Thinking Display (for UI)
// ============================================================

export type ThinkingPhase =
  | 'intent' | 'extract' | 'skill_select'
  | 'sql_generate' | 'validating' | 'executing' | 'confirm';

export type ThinkingStepStatus = 'pending' | 'running' | 'done' | 'error' | 'cancelled';

export interface ThinkingStep {
  phase: ThinkingPhase;
  label: string;
  status: ThinkingStepStatus;
  content?: string;
  startTime?: number;
  endTime?: number;
}

export interface ReasoningChain {
  stage: 'probe' | 'semantic' | 'quality' | 'ops' | 'insights' | 'narrative';
  input: string;
  reasoning: string;
  output: any;
  confidence: number;
  timestamp: number;
}
