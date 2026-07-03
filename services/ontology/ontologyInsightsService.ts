/**
 * services/ontology/ontologyInsightsService.ts — 本体论洞察查询 Service
 *
 * 职责：从 OntologyInsightsPanel.tsx 中上浮的 SQL 查询。
 * 仅做数据读取，不含业务逻辑，无 React 依赖。
 */

import { duckDBService } from '../duckdbService';
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

// Table names are part of the schema contract and live in `services/ontology/ontologySchema.ts`.
// Hardcode here for read-only queries and inline directly to keep the SQL obvious.
const TABLE_INSIGHT = 'life_insight';
const TABLE_OBJECT = 'life_object';

/** Fetches recent introspections across all objects. */
export async function queryRecentIntrospections(limit = 20): Promise<IntrospectionRow[]> {
  return duckDBService.query(
    `SELECT * FROM life_introspection ORDER BY created_at DESC LIMIT ${limit}`
  );
}

/** Fetches recent insights with their associated object names. */
export async function queryRecentInsights(limit = 20): Promise<InsightRow[]> {
  return duckDBService.query(
    `SELECT li.*, lo.name as object_name FROM ${TABLE_INSIGHT} li ` +
      `LEFT JOIN ${TABLE_OBJECT} lo ON li.object_id = lo.id ` +
      `ORDER BY li.created_at DESC LIMIT ${limit}`
  );
}

/** Fetches introspections for a specific object. */
export async function queryIntrospectionsByObject(
  objectId: number,
  limit = 20
): Promise<IntrospectionRow[]> {
  return duckDBService.query(
    `SELECT * FROM ${TABLE_INSIGHT} WHERE object_id = ${objectId} ORDER BY created_at DESC LIMIT ${limit}`
  );
}

/** Fetches insights for a specific object. */
export async function queryInsightsByObject(
  objectId: number,
  limit = 20
): Promise<InsightRow[]> {
  return duckDBService.query(
    `SELECT li.*, lo.name as object_name FROM ${TABLE_INSIGHT} li ` +
      `LEFT JOIN ${TABLE_OBJECT} lo ON li.object_id = lo.id ` +
      `WHERE li.object_id = ${objectId} ORDER BY li.created_at DESC LIMIT ${limit}`
  );
}
