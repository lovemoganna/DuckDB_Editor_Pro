import * as ontologyStorage from './ontologyStorage';
import type { LifeIntrospection, LifeInsight } from '../../hooks/useOntologyStore';

export interface IntrospectionRow {
  id: number;
  object_id: number;
  question: string;
  answer: string;
  created_at: string;
}

export interface InsightRow {
  id: number;
  object_id: number;
  insight: string;
  tag: string;
  created_at: string;
  object_name?: string;
}

const DEFAULT_MAPPING = {
  objectTable: 'life_object',
  objectTypeTable: 'life_object_type',
  linkTable: 'life_link',
  linkTypeTable: 'life_link_type',
  actionTable: 'life_action',
  introspectionTable: 'life_introspection',
  insightTable: 'life_insight',
};

/** Fetches recent introspections across all objects. */
export async function queryRecentIntrospections(limit = 20): Promise<IntrospectionRow[]> {
  return ontologyStorage.queryRecentIntrospections(DEFAULT_MAPPING, limit);
}

/** Fetches recent insights with their associated object names. */
export async function queryRecentInsights(limit = 20): Promise<InsightRow[]> {
  return ontologyStorage.queryRecentInsights(DEFAULT_MAPPING, limit);
}

/** Fetches introspections for a specific object. */
export async function queryIntrospectionsByObject(
  objectId: number,
  limit = 20
): Promise<IntrospectionRow[]> {
  return ontologyStorage.queryIntrospectionsByObject(DEFAULT_MAPPING, objectId, limit);
}

/** Fetches insights for a specific object. */
export async function queryInsightsByObject(
  objectId: number,
  limit = 20
): Promise<InsightRow[]> {
  return ontologyStorage.queryInsightsByObject(DEFAULT_MAPPING, objectId, limit);
}

/** Inserts a new introspection reflection row. */
export async function addIntrospection(
  objectId: number,
  question: string,
  answer: string
): Promise<void> {
  await ontologyStorage.addIntrospection(DEFAULT_MAPPING, objectId, question, answer);
}

/** Inserts a new insight block. */
export async function addInsight(
  objectId: number,
  insight: string,
  tag: string
): Promise<void> {
  await ontologyStorage.addInsight(DEFAULT_MAPPING, objectId, insight, tag);
}

/** Deletes an insight block by ID. */
export async function deleteInsight(id: number): Promise<void> {
  await ontologyStorage.deleteInsight(DEFAULT_MAPPING, id);
}


