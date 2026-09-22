/**
 * types/ontologyStudioTypes.ts
 *
 * Types for DuckDB Studio modern Ontology Modeling & Semantic Data Layer.
 */

export interface PropertyItem {
  name: string;
  type: string;
  description?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  isNullable?: boolean;
}

export interface MetricItem {
  id: string;
  name: string;
  label: string;
  expression: string;
  aggregation?: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'CUSTOM';
  description?: string;
}

export interface OntologyEntity {
  id: string;
  name: string;
  label: string;
  description?: string;
  color?: string;
  mappedTable?: string;
  primaryKey?: string;
  properties: PropertyItem[];
  metrics: MetricItem[];
  position: { x: number; y: number };
  rowCount?: number;
}

export type RelationCardinality = '1:1' | '1:N' | 'N:1' | 'N:M';
export type RelationJoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

export interface RelationTypeInfo {
  cardinality: RelationCardinality;
  color: string;
  width: number;
  dashArray?: string;
  label: string;
}

export const RELATION_TYPE_INFO: Record<RelationCardinality, RelationTypeInfo> = {
  '1:1': { cardinality: '1:1', color: '#a6e22e', width: 2.2, label: '一对一' },
  '1:N': { cardinality: '1:N', color: '#66d9ef', width: 2.4, label: '一对多' },
  'N:1': { cardinality: 'N:1', color: '#fd971f', width: 2.4, label: '多对一' },
  'N:M': { cardinality: 'N:M', color: '#f92672', width: 2.6, dashArray: '6 4', label: '多对多' },
};

export interface OntologyRelation {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  name: string;
  label: string;
  cardinality: RelationCardinality;
  joinType: RelationJoinType;
  sourceField: string;
  targetField: string;
  description?: string;
}

export interface OntologyModel {
  version: string;
  name: string;
  description?: string;
  updatedAt: string;
  entities: OntologyEntity[];
  relations: OntologyRelation[];
}

export type SelectedElementType = 'entity' | 'relation' | null;

export interface PhysicalTableColumn {
  name: string;
  type: string;
  pk: boolean;
  notnull: boolean;
}

export interface PhysicalTableInfo {
  name: string;
  schema?: string;
  rowCount?: number;
  columns: PhysicalTableColumn[];
}

export type OntologyStudioMode = 'modeling' | 'deduction' | 'mapping';

export interface DeductionRule {
  id: string;
  name: string;
  description: string;
  sourceEntityId: string;
  targetEntityId: string;
  condition: string;
  inferredFact: string;
  confidence: number;
}

export interface MultiHopPath {
  id: string;
  nodes: string[];
  edges: string[];
  description: string;
}
