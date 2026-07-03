// ============================================
// Library Module Types
// ============================================

// ============================================================
// Reference & Template Types
// ============================================================

export interface ReferenceCard {
  id: string;
  title: string;
  syntax: string;
  example: string;
  scenario: string;
  tags: string[];
  isSystem?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type TemplateCategory =
  | 'user-segmentation' | 'multi-table-join' | 'time-series'
  | 'aggregation' | 'data-cleaning' | 'window-function' | 'custom';

export interface TemplateParam {
  name: string;
  type: 'string' | 'number' | 'column' | 'table';
  required: boolean;
  default?: any;
  description?: string;
}

export interface SqlTemplate {
  id: string;
  name: string;
  description: string;
  sql: string;
  params: TemplateParam[];
  category: TemplateCategory;
  tags: string[];
  usageCount: number;
  isSystem?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CodeSnippet {
  id: string;
  title: string;
  sql: string;
  description: string;
  tags: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

// ============================================================
// Learning Path Types
// ============================================================

export interface LearningNode {
  id: string;
  title: string;
  description: string;
  content: string;
  order: number;
  duration: number;
  isCompleted: boolean;
  skills: string[];
}

export interface LearningStage {
  id: string;
  title: string;
  description: string;
  nodes: LearningNode[];
  order: number;
  isUnlocked: boolean;
}

// ============================================================
// Library Panel State
// ============================================================

export type LibraryTab = 'meta' | 'ddl' | 'dml' | 'dql' | 'functions' | 'dcl' | 'optimization';

export interface LibraryPanelState {
  isOpen: boolean;
  activeTab: LibraryTab;
  searchQuery: string;
  selectedCategory: string | 'all';
}

// ============================================================
// Query History
// ============================================================

export interface QueryHistoryEntry {
  sql: string;
  time: string;
  duration: string;
}
