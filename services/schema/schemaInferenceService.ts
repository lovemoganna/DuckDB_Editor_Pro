/**
 * services/schema/schemaInferenceService.ts — Schema 推断 Service
 *
 * 职责：从 SchemaInferencePanel.tsx 中上浮的 SQL 查询。
 * 提供 DuckDB 元数据读取和 ID 解析，辅助本体构建流程。
 */

import { duckDBService } from '../duckdbService';

export interface OntologyIdByName {
  objectTypeId: number;
  linkTypeId: number;
}

/**
 * Looks up the database ID of a life_object_type record by its name.
 * Uses duckDBService.escapeLiteral() for safe string comparison.
 */
export async function getObjectTypeDbIdByName(name: string): Promise<number> {
  const rows = await duckDBService.query(
    `SELECT id FROM "life_object_type" WHERE name = ${duckDBService.escapeLiteral(name)}`
  );
  return rows[0]?.id ?? 0;
}

/**
 * Looks up the database ID of a life_link_type record by its name.
 * Uses duckDBService.escapeLiteral() for safe string comparison.
 */
export async function getLinkTypeDbIdByName(name: string): Promise<number> {
  const rows = await duckDBService.query(
    `SELECT id FROM "life_link_type" WHERE name = ${duckDBService.escapeLiteral(name)}`
  );
  return rows[0]?.id ?? 0;
}

/**
 * Fetches all object IDs belonging to a given object type ID.
 */
export async function getObjectIdsByObjectType(objectTypeId: number): Promise<number[]> {
  const rows = await duckDBService.query(
    `SELECT id FROM "life_object" WHERE object_type_id = ${objectTypeId}`
  );
  return rows.map(r => r.id);
}

/**
 * Builds a lookup map of ontology type names to their database IDs.
 */
export async function buildOntologyIdMap(
  objectTypeNames: string[],
  linkTypeNames: string[]
): Promise<OntologyIdByName> {
  const [otResults, ltResults] = await Promise.all([
    Promise.all(objectTypeNames.map(n => getObjectTypeDbIdByName(n))),
    Promise.all(linkTypeNames.map(n => getLinkTypeDbIdByName(n))),
  ]);

  const objectTypeId = otResults.find(id => id > 0) ?? 0;
  const linkTypeId = ltResults.find(id => id > 0) ?? 0;

  return { objectTypeId, linkTypeId };
}
