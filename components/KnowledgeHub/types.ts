/**
 * KnowledgeHub/types.ts
 * 统一知识资产中心数据结构定义 (三段式核心资产模型)
 */

export type AssetType = 'code' | 'metric' | 'note';

export type CodeCategory = 'snippet' | 'template' | 'script';
export type NoteTopic = 'pitfall' | 'optimization' | 'best_practice' | 'memo';

export interface CodeParam {
  name: string;
  label?: string;
  defaultValue: string;
  description?: string;
}

export interface CodeAsset {
  id: string;
  type: 'code';
  title: string;
  category: CodeCategory;
  description: string;
  sql: string;
  params?: CodeParam[];
  tags: string[];
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MetricAsset {
  id: string;
  type: 'metric';
  name: string;
  businessMeaning: string;
  calculationFormula: string;
  sqlExpression: string;
  sourceTables: string[];
  dimensions: string[];
  owner?: string;
  tags: string[];
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteAsset {
  id: string;
  type: 'note';
  title: string;
  topic: NoteTopic;
  summary: string;
  content: string; // Markdown
  tags: string[];
  references?: string[];
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type KnowledgeAsset = CodeAsset | MetricAsset | NoteAsset;

export interface AssetFilter {
  type?: AssetType | 'all';
  searchQuery?: string;
  selectedTag?: string;
  favoritesOnly?: boolean;
  categoryOrTopic?: string;
}
