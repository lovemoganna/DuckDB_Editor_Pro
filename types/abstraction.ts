/**
 * Abstraction 模块类型定义
 *
 * 基于 MECE 原则设计的数据抽象层类型系统
 */

import {
  AbstractionTable,
  AbstractionSqlOperation,
  AbstractionLevel,
  SqlParameter,
} from '../types';

// Re-export for consumers of this module
export type { AbstractionSqlOperation } from '../types';

// ============================================================
// 配置常量
// ============================================================

export interface OperationMeta {
  label: string;
  color: string;
}

export interface LevelMeta {
  label: string;
  color: string;
}

// SQL 操作类型配置
export const OPERATION_CONFIG: Record<AbstractionSqlOperation, OperationMeta> = {
  SELECT:    { label: '查询', color: 'monokai-blue' },
  INSERT:    { label: '插入', color: 'monokai-green' },
  UPDATE:    { label: '更新', color: 'monokai-yellow' },
  DELETE:    { label: '删除', color: 'monokai-red' },
  AGGREGATE: { label: '聚合', color: 'monokai-amethyst' },
  JOIN:      { label: '关联', color: 'monokai-pink' },
  WINDOW:    { label: '窗口', color: 'monokai-orange' },
  CTE:       { label: 'CTE',  color: 'monokai-cyan' },
};

// 抽象层级配置
export const LEVEL_CONFIG: Record<AbstractionLevel, LevelMeta> = {
  concept:   { label: '概念', color: 'monokai-amethyst' },
  property:  { label: '属性', color: 'monokai-blue' },
  relation:  { label: '关系', color: 'monokai-green' },
  instance:  { label: '实例', color: 'monokai-yellow' },
};

// ============================================================
// 筛选状态
// ============================================================

export interface AbstractionFilters {
  domain: string;
  operation: AbstractionSqlOperation | 'all';
  abstractionLevel: AbstractionLevel | 'all';
  searchQuery: string;
  tags: string[];
  isFavorite?: boolean;
  isSystem?: boolean;
}

export const DEFAULT_FILTERS: AbstractionFilters = {
  domain: 'all',
  operation: 'all',
  abstractionLevel: 'all',
  searchQuery: '',
  tags: [],
};

// ============================================================
// AI 生成
// ============================================================

export interface AbstractionGenerationRequest {
  concept: string;
  property?: string;
  relation?: string;
  instance?: string;
  operation: AbstractionSqlOperation;
  context?: string;
}

export interface AbstractionGenerationResult {
  sql: string;
  explanation: string;
  template?: string;
  parameters?: SqlParameter[];
  patternType?: string;
  tips?: string[];
}

export interface AbstractionGenerationError {
  message: string;
  code?: string;
}

// ============================================================
// 模板管理
// ============================================================

export interface AbstractionTemplate {
  id: string;
  name: string;
  description: string;
  sql: string;
  domain: string;
  tags: string[];
  abstractionPath: AbstractionTable['abstractionPath'];
  operation: AbstractionSqlOperation;
  parameters?: SqlParameter[];
  sampleOutput?: string;
  createdAt: number;
  updatedAt: number;
  isFavorite: boolean;
  isSystem: boolean;
  currentVersion: number;
}

// ============================================================
// 版本历史
// ============================================================

export interface AbstractionVersion {
  id: string;
  templateId: string;
  version: number;
  sql: string;
  changeNote: string;
  createdAt: number;
}

// ============================================================
// 草稿管理
// ============================================================

export interface AbstractionDraft {
  id: string;
  name: string;
  sql: string;
  result?: unknown;
  abstractionPath?: AbstractionTable['abstractionPath'];
  operation?: AbstractionSqlOperation;
  createdAt: number;
  updatedAt: number;
}

// ============================================================
// 实验台状态
// ============================================================

export type SandboxTab = 'editor' | 'results' | 'ai';

export interface SandboxState {
  activeTab: SandboxTab;
  sql: string;
  result?: unknown;
  error?: string;
  isExecuting: boolean;
}

// ============================================================
// 导入导出
// ============================================================

export interface AbstractionExportData {
  version: string;
  exportedAt: number;
  templates: AbstractionTemplate[];
}

export interface AbstractionImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

// ============================================================
// 帮助数据
// ============================================================

export interface AbstractionHelpData {
  title: string;
  description: string;
  scenarios: string[];
  commonErrors: string[];
  aiHints: string[];
  quickStart: string[];
  bestPractices: string[];
}

// ============================================================
// 组件 Props
// ============================================================

export interface AbstractionCardProps {
  table: AbstractionTable;
  isSelected: boolean;
  onClick: () => void;
  onCopy: () => void;
  onInsert: () => void;
  copiedId: string | null;
}

export interface AbstractionDetailProps {
  table: AbstractionTable | null;
  onCopy: () => void;
  onInsert: () => void;
  onEdit: () => void;
  onDelete: () => void;
  copiedId: string | null;
}

export interface AbstractionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<AbstractionTable, 'id' | 'createdAt' | 'updatedAt'>) => void;
  editingTable?: AbstractionTable | null;
  domains: string[];
}

export interface AbstractionSearchBarProps {
  filters: AbstractionFilters;
  onFiltersChange: (filters: AbstractionFilters) => void;
  domains: string[];
  onClear: () => void;
  totalCount: number;
  filteredCount: number;
}

export interface AbstractionAIPanelProps {
  onGenerate: (request: AbstractionGenerationRequest) => void;
  onCopy: (sql: string) => void;
  onInsert: (sql: string) => void;
  onApply: (sql: string, abstractionPath: AbstractionTable['abstractionPath'], operation: AbstractionSqlOperation) => void;
  isGenerating: boolean;
  generatedSQL: string;
  error: string | null;
  onClear: () => void;
}

export interface AbstractionListProps {
  tables: AbstractionTable[];
  selectedTable: AbstractionTable | null;
  onSelect: (table: AbstractionTable) => void;
  onCopy: (id: string, sql: string) => void;
  onInsert: (sql: string) => void;
  copiedId: string | null;
  filters: AbstractionFilters;
  onFiltersChange: (filters: AbstractionFilters) => void;
  domains: string[];
  onClear: () => void;
  totalCount: number;
  filteredCount: number;
  onAdd: () => void;
  onToggleFavorite: (id: string) => void;
}

export interface AbstractionEmptyStateProps {
  onFillSamples: () => void;
  onAdd: () => void;
}

// ============================================================
// Lab 实验台 Props
// ============================================================

export interface SandboxEditorProps {
  sql: string;
  onChange: (sql: string) => void;
  onExecute: () => void;
  isExecuting: boolean;
  error?: string;
}

export interface SandboxResultsProps {
  result?: unknown;
  error?: string;
  isLoading: boolean;
}

export interface SandboxAIPanelProps {
  context?: string;
  onGenerate: (prompt: string) => void;
  isGenerating: boolean;
  generatedSQL: string;
  error: string | null;
  onInsert: (sql: string) => void;
}

export interface AbstractionLabProps {
  initialSql?: string;
  onInsertSql?: (sql: string) => void;
}

// ============================================================
// AI Session — 贯穿数据库生命周期的持续会话
// ============================================================

export interface AISessionMessage {
  id: string;
  role: 'user' | 'assistant';
  /** 发送时携带的 AI 请求参数（用于重新生成等操作） */
  request?: {
    concept: string;
    property?: string;
    relation?: string;
    instance?: string;
    operation: AbstractionSqlOperation;
    context?: string;
  };
  result?: AbstractionGenerationResult;
  /** 来自 AI service 的原始摘要（如 "生成了 N 个对象"） */
  rawSummary?: string;
  error?: string;
  timestamp: number;
}

export interface AISession {
  id: string;
  /** 所属数据库名称（用于多数据库场景的会话隔离） */
  database: string;
  name: string;
  messages: AISessionMessage[];
  createdAt: number;
  updatedAt: number;
}
