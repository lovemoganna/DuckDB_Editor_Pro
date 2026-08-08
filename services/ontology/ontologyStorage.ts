/**
 * services/ontology/ontologyStorage.ts — 本体论持久化 Service
 *
 * 职责：从 OntologyPanel.tsx 中上浮的所有 SQL 操作，消除 TSX 内手写 SQL 的
 * 安全风险（字符串拼接、注入风险），统一使用 duckDBService.escapeLiteral()
 * 进行安全的参数化等价处理。
 *
 * 导出的都是纯数据函数（async），无 React 依赖，可被 service 层或 hooks 层调用。
 */

import { duckDBService } from '../duckdbService';
import type {
  LifeObjectType,
  LifeObject,
  LifeLinkType,
  LifeLink,
  LifeAction,
  LifeIntrospection,
  LifeInsight,
} from '../../hooks/useOntologyStore';
import type {
  FeatureDefinition,
  OutcomeDefinition,
  RuleDefinition,
} from './ontologyInferenceEngine';
import { ontologyInferenceModule } from './ontologyInferenceModule';
import type {
  OntologyActionDefinition,
  OntologyPropertyDefinition,
  OntologyRuleDefinition as NativeOntologyRuleDefinition,
} from './ontologyReasoningModule';
import { ontologyReasoningModule } from './ontologyReasoningModule';

// ============================================================
// Types
// ============================================================

export interface OntologyMapping {
  objectTable: string;
  objectTypeTable: string;
  linkTable: string;
  linkTypeTable: string;
  actionTable: string;
  introspectionTable?: string;
  insightTable?: string;
  canvasStateTable?: string;
  canvasEdgeTable?: string;
}

export interface OntologyExportData {
  version: '3.0';
  exportedAt: string;
  objectTypes: LifeObjectType[];
  objects: LifeObject[];
  linkTypes: LifeLinkType[];
  links: LifeLink[];
  actions: LifeAction[];
  introspections: LifeIntrospection[];
  insights: LifeInsight[];
  features: FeatureDefinition[];
  rules: RuleDefinition[];
  outcomes: OutcomeDefinition[];
  inferenceDependencies: {
    featureVersionIds: string[];
    ruleVersionIds: string[];
  };
  propertyDefinitions: OntologyPropertyDefinition[];
  ruleDefinitions: NativeOntologyRuleDefinition[];
  actionDefinitions: OntologyActionDefinition[];
}

export interface ImportOntologyPayload {
  version?: '1.0' | '2.0' | '3.0' | string;
  objectTypes?: LifeObjectType[];
  objects?: LifeObject[];
  linkTypes?: LifeLinkType[];
  links?: LifeLink[];
  actions?: LifeAction[];
  introspections?: LifeIntrospection[];
  insights?: LifeInsight[];
  features?: FeatureDefinition[];
  rules?: RuleDefinition[];
  outcomes?: OutcomeDefinition[];
  inferenceDependencies?: {
    featureVersionIds?: string[];
    ruleVersionIds?: string[];
  };
  propertyDefinitions?: OntologyPropertyDefinition[];
  ruleDefinitions?: NativeOntologyRuleDefinition[];
  actionDefinitions?: OntologyActionDefinition[];
}

// ============================================================
// Safe literal escape — uses duckDBService internally
// ============================================================

function safeStr(value: string | null | undefined): string {
  if (value == null) return 'NULL';
  return duckDBService.escapeLiteral(value);
}

function safeNumber(
  value: unknown,
  col: string,
  fallback?: number,
  range?: { min: number; max: number },
): string {
  const candidate = value == null && fallback !== undefined ? fallback : value;
  if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
    throw new Error(`Invalid numeric value for ${col}`);
  }
  if (range && (candidate < range.min || candidate > range.max)) {
    throw new Error(`${col} must be between ${range.min} and ${range.max}`);
  }
  return String(candidate);
}

function safeId(value: unknown, col: string): string {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid id value for ${col}`);
  }
  return String(value);
}

function safeNullableId(value: unknown, col: string): string {
  return value == null ? 'NULL' : safeId(value, col);
}

function normalizeJSON(value: unknown, col: string): string {
  const source = typeof value === 'string' ? value : JSON.stringify(value ?? {});
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error(`${col} must be valid JSON`);
  }
  if (
    parsed === null
    || typeof parsed !== 'object'
    || Array.isArray(parsed)
    || Object.getPrototypeOf(parsed) !== Object.prototype
  ) {
    throw new Error(`${col} must be a JSON object`);
  }
  return JSON.stringify(parsed);
}

function safeBool(value: string | null | undefined, fallback = 'NULL'): string {
  if (value == null) return fallback;
  return duckDBService.escapeLiteral(value);
}

// ============================================================
// Export — reads all 5 ontology tables and returns serializable JSON
// ============================================================

export async function exportOntologyToJSON(
  mapping: OntologyMapping
): Promise<OntologyExportData> {
  const introspectionTable =
    mapping.introspectionTable ?? `${mapping.objectTable.split('_')[0]}_introspection`;
  const insightTable =
    mapping.insightTable ?? `${mapping.objectTable.split('_')[0]}_insight`;
  const [
    objectTypes,
    objects,
    linkTypes,
    links,
    actions,
    introspections,
    insights,
    inferenceWorkspace,
    reasoningCatalog,
  ] = await Promise.all([
    duckDBService.query(`SELECT * FROM ${mapping.objectTypeTable}`),
    duckDBService.query(`SELECT * FROM ${mapping.objectTable}`),
    duckDBService.query(`SELECT * FROM ${mapping.linkTypeTable}`),
    duckDBService.query(`SELECT * FROM ${mapping.linkTable}`),
    duckDBService.query(`SELECT * FROM ${mapping.actionTable}`),
    duckDBService.query(`SELECT * FROM ${introspectionTable}`),
    duckDBService.query(`SELECT * FROM ${insightTable}`),
    ontologyInferenceModule.loadWorkspace(),
    ontologyReasoningModule.loadCatalog(),
  ]);

  return {
    version: '3.0',
    exportedAt: new Date().toISOString(),
    objectTypes: objectTypes || [],
    objects: objects || [],
    linkTypes: linkTypes || [],
    links: links || [],
    actions: actions || [],
    introspections: introspections || [],
    insights: insights || [],
    features: inferenceWorkspace.features,
    rules: inferenceWorkspace.rules,
    outcomes: inferenceWorkspace.outcomes,
    inferenceDependencies: {
      featureVersionIds: inferenceWorkspace.dependencyFeatureIds ?? [],
      ruleVersionIds: inferenceWorkspace.dependencyRuleIds ?? [],
    },
    propertyDefinitions: reasoningCatalog.propertyDefinitions,
    ruleDefinitions: reasoningCatalog.rules,
    actionDefinitions: reasoningCatalog.actionDefinitions,
  };
}

/**
 * Triggers a browser download of the ontology as a JSON file.
 */
export async function downloadOntologyJSON(mapping: OntologyMapping): Promise<void> {
  const data = await exportOntologyToJSON(mapping);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ontology-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// Import — reads a parsed JSON and writes all 5 tables
// Uses duckDBService.escapeLiteral() instead of manual replace(/'/g, "''")
// ============================================================

export async function importOntologyFromJSON(
  mapping: OntologyMapping,
  payload: ImportOntologyPayload
): Promise<{ objectCount: number; linkCount: number }> {
  const statements: string[] = [];

  // --- Object Types ---
  for (const ot of payload.objectTypes || []) {
    statements.push(
      `INSERT OR REPLACE INTO ${mapping.objectTypeTable} (id, name, description) ` +
        `VALUES (${safeId(ot.id, 'objectTypes.id')}, ${safeStr(ot.name)}, ${safeStr(ot.description ?? null)})`
    );
  }

  // --- Objects ---
  for (const o of payload.objects || []) {
    const props = normalizeJSON(o.properties ?? {}, 'objects.properties');
    const annots =
      typeof o.annotations === 'string' ? o.annotations : JSON.stringify(o.annotations || '');
    statements.push(
      `INSERT OR REPLACE INTO ${mapping.objectTable} ` +
        `(id, object_type_id, name, properties, annotations) ` +
        `VALUES (${safeId(o.id, 'objects.id')}, ${safeId(o.object_type_id, 'objects.object_type_id')}, ${safeStr(o.name)}, ${safeStr(props)}, ${safeStr(annots)})`
    );
  }

  // --- Link Types ---
  for (const lt of payload.linkTypes || []) {
    statements.push(
      `INSERT OR REPLACE INTO ${mapping.linkTypeTable} (id, name, description) ` +
        `VALUES (${safeId(lt.id, 'linkTypes.id')}, ${safeStr(lt.name)}, ${safeStr(lt.description ?? null)})`
    );
  }

  // --- Links ---
  for (const l of payload.links || []) {
    statements.push(
      `INSERT OR REPLACE INTO ${mapping.linkTable} ` +
        `(id, link_type_id, source_object_id, target_object_id, weight) ` +
        `VALUES (${safeId(l.id, 'links.id')}, ${safeId(l.link_type_id, 'links.link_type_id')}, ${safeId(l.source_object_id, 'links.source_object_id')}, ${safeId(l.target_object_id, 'links.target_object_id')}, ${safeNumber(l.weight, 'links.weight', 0.5, { min: 0, max: 1 })})`
    );
  }

  // --- Actions ---
  for (const a of payload.actions || []) {
    const execAt = a.execute_at ? safeStr(a.execute_at) : 'NULL';
    statements.push(
      `INSERT OR REPLACE INTO ${mapping.actionTable} ` +
        `(id, object_id, name, description, status, execute_at) ` +
        `VALUES (${safeId(a.id, 'actions.id')}, ${safeNullableId(a.object_id, 'actions.object_id')}, ${safeStr(a.name)}, ${safeStr(a.description ?? null)}, ${safeStr(a.status ?? 'pending')}, ${execAt})`
    );
  }

  const introspectionTable =
    mapping.introspectionTable ?? `${mapping.objectTable.split('_')[0]}_introspection`;
  for (const introspection of payload.introspections || []) {
    const createdAt = introspection.created_at
      ? safeStr(introspection.created_at)
      : 'CURRENT_TIMESTAMP';
    statements.push(
      `INSERT OR REPLACE INTO ${introspectionTable} ` +
        `(id, object_id, question, answer, created_at) ` +
        `VALUES (${safeId(introspection.id, 'introspections.id')}, ${safeId(introspection.object_id, 'introspections.object_id')}, ${safeStr(introspection.question)}, ${safeStr(introspection.answer ?? null)}, ${createdAt})`
    );
  }

  const insightTable =
    mapping.insightTable ?? `${mapping.objectTable.split('_')[0]}_insight`;
  for (const insight of payload.insights || []) {
    const createdAt = insight.created_at ? safeStr(insight.created_at) : 'CURRENT_TIMESTAMP';
    statements.push(
      `INSERT OR REPLACE INTO ${insightTable} ` +
        `(id, object_id, insight, tag, created_at) ` +
        `VALUES (${safeId(insight.id, 'insights.id')}, ${safeId(insight.object_id, 'insights.object_id')}, ${safeStr(insight.insight)}, ${safeStr(insight.tag ?? null)}, ${createdAt})`
    );
  }

  const hasInferenceDefinitions = payload.features !== undefined
    || payload.rules !== undefined
    || payload.outcomes !== undefined;
  const inferenceWorkspace = hasInferenceDefinitions
    ? {
      features: payload.features ?? [],
      rules: payload.rules ?? [],
      outcomes: payload.outcomes ?? [],
      dependencyFeatureIds: payload.inferenceDependencies?.featureVersionIds ?? [],
      dependencyRuleIds: payload.inferenceDependencies?.ruleVersionIds ?? [],
    }
    : null;
  if (inferenceWorkspace) {
    await ontologyInferenceModule.validateWorkspace(inferenceWorkspace);
  }
  const hasReasoningDefinitions = payload.propertyDefinitions !== undefined
    || payload.ruleDefinitions !== undefined
    || payload.actionDefinitions !== undefined;
  const reasoningCatalog = hasReasoningDefinitions
    ? {
      propertyDefinitions: payload.propertyDefinitions ?? [],
      rules: payload.ruleDefinitions ?? [],
      actionDefinitions: payload.actionDefinitions ?? [],
    }
    : null;
  if (reasoningCatalog) {
    const snapshot = ontologyReasoningModule.createSnapshot({
      activeTemplateId: 'ontology-import',
      objectTypes: payload.objectTypes ?? [],
      objects: payload.objects ?? [],
      linkTypes: payload.linkTypes ?? [],
      links: payload.links ?? [],
      actions: payload.actions ?? [],
    }, reasoningCatalog);
    const issues = ontologyReasoningModule.validateModel(snapshot);
    if (issues.length > 0) throw new Error(`Ontology 推演定义无效：${issues.join('；')}`);
  }

  if (inferenceWorkspace) {
    await ontologyInferenceModule.saveWorkspace(inferenceWorkspace);
  }
  if (reasoningCatalog) {
    await ontologyReasoningModule.saveCatalog(reasoningCatalog);
  }

  await duckDBService.ontologyInit();

  if (statements.length > 0) {
    await duckDBService.executeTransaction(statements);
  }

  return {
    objectCount: (payload.objects || []).length,
    linkCount: (payload.links || []).length,
  };
}

// ============================================================
// Query — read all 5 tables (used by store refresh)
// ============================================================

export async function queryAllOntologyTables(
  mapping: OntologyMapping
): Promise<{
  objectTypes: LifeObjectType[];
  objects: LifeObject[];
  linkTypes: LifeLinkType[];
  links: LifeLink[];
  actions: LifeAction[];
}> {
  const [objectTypes, objects, linkTypes, links, actions] = await Promise.all([
    duckDBService.query(`SELECT * FROM ${mapping.objectTypeTable}`),
    duckDBService.query(`SELECT * FROM ${mapping.objectTable}`),
    duckDBService.query(`SELECT * FROM ${mapping.linkTypeTable}`),
    duckDBService.query(`SELECT * FROM ${mapping.linkTable}`),
    duckDBService.query(`SELECT * FROM ${mapping.actionTable}`),
  ]);
  return { objectTypes, objects, linkTypes, links, actions };
}

// ============================================================
// Execute Ontology Draft — unified, safe batch commit
// Replaces duckDBService.executeOntologyDraft() which used
// manual .replace(/'/g, "''") string concatenation.
// Uses duckDBService.escapeLiteral() for all string values.
// ============================================================

export interface OntologyDraftPayload {
  objects: Array<{
    id: number;
    object_type_id?: number;
    name: string;
    properties?: Record<string, any>;
    annotations?: string;
  }>;
  links: Array<{
    id: number;
    link_type_id?: number;
    source_object_id: number;
    target_object_id: number;
    weight?: number;
  }>;
  actions: Array<{
    id: number;
    object_id: number;
    name: string;
    description?: string;
    status?: string;
  }>;
  introspections: Array<{
    id: number;
    object_id: number;
    question: string;
    answer?: string;
  }>;
  insights: Array<{
    id: number;
    object_id: number;
    insight: string;
    tag?: string;
  }>;
}

/**
 * Validate a draft payload before committing.
 * Throws an error with details if any entity is invalid.
 */
export function validateDraftPayload(payload: OntologyDraftPayload): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const validateId = (value: unknown, label: string) => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      errors.push(`${label} must be a non-negative integer, got: ${String(value)}`);
      return false;
    }
    return true;
  };

  // Validate every numeric value before any SQL is constructed. AI payloads
  // are runtime data even though the TypeScript shape declares numbers.
  for (const obj of payload.objects || []) {
    validateId(obj.id, 'Object id');
    if (obj.object_type_id !== undefined) {
      validateId(obj.object_type_id, `Object ${String(obj.id)} object_type_id`);
    }
  }

  // Validate link endpoint IDs and weight range
  const validObjectIds = new Set((payload.objects || []).map(o => o.id));
  for (const link of payload.links || []) {
    validateId(link.id, 'Link id');
    if (link.link_type_id !== undefined) {
      validateId(link.link_type_id, `Link ${String(link.id)} link_type_id`);
    }
    validateId(link.source_object_id, `Link ${String(link.id)} source_object_id`);
    validateId(link.target_object_id, `Link ${String(link.id)} target_object_id`);
    if (!validObjectIds.has(link.source_object_id)) {
      errors.push(`Link ${link.id}: source_object_id ${link.source_object_id} does not exist in objects`);
    }
    if (!validObjectIds.has(link.target_object_id)) {
      errors.push(`Link ${link.id}: target_object_id ${link.target_object_id} does not exist in objects`);
    }
    if (
      link.weight !== undefined
      && (
        typeof link.weight !== 'number'
        || !Number.isFinite(link.weight)
        || link.weight < 0
        || link.weight > 1
      )
    ) {
      errors.push(`Link ${link.id}: weight ${link.weight} must be between 0 and 1`);
    }
  }

  // Validate action object_ids
  for (const action of payload.actions || []) {
    validateId(action.id, 'Action id');
    validateId(action.object_id, `Action ${String(action.id)} object_id`);
    if (!validObjectIds.has(action.object_id)) {
      errors.push(`Action ${action.id}: object_id ${action.object_id} does not exist in objects`);
    }
  }

  // Validate introspection object_ids
  for (const intro of payload.introspections || []) {
    validateId(intro.id, 'Introspection id');
    validateId(intro.object_id, `Introspection ${String(intro.id)} object_id`);
    if (!validObjectIds.has(intro.object_id)) {
      errors.push(`Introspection ${intro.id}: object_id ${intro.object_id} does not exist in objects`);
    }
  }

  // Validate insight object_ids
  for (const ins of payload.insights || []) {
    validateId(ins.id, 'Insight id');
    validateId(ins.object_id, `Insight ${String(ins.id)} object_id`);
    if (!validObjectIds.has(ins.object_id)) {
      errors.push(`Insight ${ins.id}: object_id ${ins.object_id} does not exist in objects`);
    }
  }

  return { valid: errors.length === 0, errors };
}

const DRAFT_CHUNK = 50;

function buildChunkedInsert(
  table: string,
  columns: string[],
  rows: Record<string, any>[],
  mapping: OntologyMapping
): string[] {
  const stmts: string[] = [];
  const cols = columns.map(c => `"${c}"`).join(', ');
  for (let ci = 0; ci < rows.length; ci += DRAFT_CHUNK) {
    const chunk = rows.slice(ci, ci + DRAFT_CHUNK);
    const values = chunk.map(row => {
      return columns.map(col => {
        const v = row[col];
        if (col === 'id') return safeId(v, `${table}.id`);
        if (col === 'weight') return safeNumber(v, `${table}.weight`, 0.5);
        if (col === 'object_type_id' || col === 'link_type_id' || col === 'source_object_id' || col === 'target_object_id' || col === 'object_id') {
          return safeNullableId(v, `${table}.${col}`);
        }
        if (v == null) return 'NULL';
        return duckDBService.escapeLiteral(typeof v === 'object' ? JSON.stringify(v) : String(v));
      }).join(', ');
    }).join('), (');
    stmts.push(`INSERT INTO "${table}" (${cols}) VALUES (${values})`);
  }
  return stmts;
}

export async function executeOntologyDraft(
  mapping: OntologyMapping,
  payload: OntologyDraftPayload
): Promise<void> {
  const validation = validateDraftPayload(payload);
  if (!validation.valid) {
    throw new Error(`Invalid ontology draft: ${validation.errors.join('; ')}`);
  }

  const stmts: string[] = [];

  // Objects
  const objCols = ['id', 'object_type_id', 'name', 'properties', 'annotations'];
  const objRows = (payload.objects || []).map(o => ({
    id: o.id,
    object_type_id: o.object_type_id ?? 1,
    name: o.name,
    properties: JSON.stringify(o.properties ?? {}),
    annotations: o.annotations ?? '',
  }));
  stmts.push(...buildChunkedInsert(mapping.objectTable, objCols, objRows, mapping));

  // Links
  const linkCols = ['id', 'link_type_id', 'source_object_id', 'target_object_id', 'weight'];
  const linkRows = (payload.links || []).map(l => ({
    id: l.id,
    link_type_id: l.link_type_id ?? 1,
    source_object_id: l.source_object_id,
    target_object_id: l.target_object_id,
    weight: l.weight ?? 1.0,
  }));
  stmts.push(...buildChunkedInsert(mapping.linkTable, linkCols, linkRows, mapping));

  // Actions
  const actionCols = ['id', 'object_id', 'name', 'description', 'status'];
  const actionRows = (payload.actions || []).map(a => ({
    id: a.id,
    object_id: a.object_id,
    name: a.name,
    description: a.description ?? '',
    status: a.status ?? 'pending',
  }));
  stmts.push(...buildChunkedInsert(mapping.actionTable, actionCols, actionRows, mapping));

  // Introspections
  const introCols = ['id', 'object_id', 'question', 'answer'];
  const introRows = (payload.introspections || []).map(i => ({
    id: i.id,
    object_id: i.object_id,
    question: i.question,
    answer: i.answer ?? '',
  }));
  stmts.push(...buildChunkedInsert(mapping.introspectionTable ?? `${mapping.objectTable.split('_')[0]}_introspection`, introCols, introRows, mapping));

  // Insights
  const insightCols = ['id', 'object_id', 'insight', 'tag'];
  const insightRows = (payload.insights || []).map(i => ({
    id: i.id,
    object_id: i.object_id,
    insight: i.insight,
    tag: i.tag ?? '',
  }));
  stmts.push(...buildChunkedInsert(mapping.insightTable ?? `${mapping.objectTable.split('_')[0]}_insight`, insightCols, insightRows, mapping));

  // DuckDBRuntime preserves statement order and rolls the entire draft back on failure.
  if (stmts.length > 0) {
    await duckDBService.executeTransaction(stmts);
  }
}

// ============================================================
// Single-entity safe write methods
// Replace duckDBService.updateOntologyObject/Action/Insight etc.
// ============================================================

export async function updateOntologyObject(
  mapping: OntologyMapping,
  id: number,
  updates: { name?: string; properties?: Record<string, any> }
): Promise<void> {
  const sets: string[] = [];
  if (updates.name !== undefined) {
    sets.push(`name = ${duckDBService.escapeLiteral(updates.name)}`);
  }
  if (updates.properties !== undefined) {
    sets.push(`properties = ${duckDBService.escapeLiteral(JSON.stringify(updates.properties))}`);
  }
  if (sets.length === 0) return;
  await duckDBService.query(`UPDATE "${mapping.objectTable}" SET ${sets.join(', ')} WHERE id = ${id}`);
}

export async function createOntologyObject(
  mapping: OntologyMapping,
  name: string,
  objectTypeId: number,
  properties: Record<string, any> = {}
): Promise<void> {
  await duckDBService.query(
    `INSERT INTO "${mapping.objectTable}" (name, object_type_id, properties) VALUES (${duckDBService.escapeLiteral(name)}, ${objectTypeId}, ${duckDBService.escapeLiteral(JSON.stringify(properties))})`
  );
}

export async function updateOntologyAnnotation(
  mapping: OntologyMapping,
  objectId: number,
  annotation: string
): Promise<void> {
  await duckDBService.query(
    `UPDATE "${mapping.objectTable}" SET annotations = ${duckDBService.escapeLiteral(annotation)} WHERE id = ${objectId}`
  );
}

export async function updateOntologyProperties(
  mapping: OntologyMapping,
  objectId: number,
  properties: Record<string, any>
): Promise<void> {
  await duckDBService.query(
    `UPDATE "${mapping.objectTable}" SET properties = ${duckDBService.escapeLiteral(JSON.stringify(properties))} WHERE id = ${objectId}`
  );
}

export async function updateOntologyLinkWeight(
  mapping: OntologyMapping,
  linkId: number,
  weight: number
): Promise<void> {
  await duckDBService.query(`UPDATE "${mapping.linkTable}" SET weight = ${weight} WHERE id = ${linkId}`);
}

export async function createOntologyLink(
  mapping: OntologyMapping,
  linkTypeId: number,
  sourceId: number,
  targetId: number,
  weight: number = 1.0
): Promise<void> {
  await duckDBService.query(
    `INSERT INTO "${mapping.linkTable}" (link_type_id, source_object_id, target_object_id, weight) VALUES (${linkTypeId}, ${sourceId}, ${targetId}, ${weight})`
  );
}

export async function deleteOntologyLink(
  mapping: OntologyMapping,
  linkId: number
): Promise<void> {
  await duckDBService.query(`DELETE FROM "${mapping.linkTable}" WHERE id = ${linkId}`);
}

export async function deleteOntologyNodeTree(
  mapping: OntologyMapping,
  objectId: number
): Promise<void> {
  const ns = mapping.objectTable.split('_')[0];
  const tables = [
    mapping.actionTable ?? `${ns}_action`,
    `${ns}_introspection`,
    `${ns}_insight`,
    mapping.linkTable,
    mapping.canvasStateTable ?? `${ns}_canvas_state`,
    mapping.objectTable,
  ];
  const statements = tables.map(table => {
    if (table === mapping.linkTable) {
      return `DELETE FROM "${table}" WHERE source_object_id = ${objectId} OR target_object_id = ${objectId}`;
    }
    if (table === mapping.objectTable) {
      return `DELETE FROM "${table}" WHERE id = ${objectId}`;
    }
    return `DELETE FROM "${table}" WHERE object_id = ${objectId}`;
  });
  await duckDBService.executeTransaction(statements);
}

export async function updateOntologyAction(
  mapping: OntologyMapping,
  id: number,
  updates: { name?: string; description?: string; status?: string }
): Promise<void> {
  const sets: string[] = [];
  if (updates.name !== undefined) sets.push(`name = ${duckDBService.escapeLiteral(updates.name)}`);
  if (updates.description !== undefined) sets.push(`description = ${duckDBService.escapeLiteral(updates.description)}`);
  if (updates.status !== undefined) sets.push(`status = ${duckDBService.escapeLiteral(updates.status)}`);
  if (sets.length === 0) return;
  await duckDBService.query(`UPDATE "${mapping.actionTable}" SET ${sets.join(', ')} WHERE id = ${id}`);
}

export async function updateOntologyInsight(
  mapping: OntologyMapping,
  id: number,
  updates: { insight?: string; tag?: string }
): Promise<void> {
  const sets: string[] = [];
  if (updates.insight !== undefined) sets.push(`insight = ${duckDBService.escapeLiteral(updates.insight)}`);
  if (updates.tag !== undefined) sets.push(`tag = ${duckDBService.escapeLiteral(updates.tag)}`);
  if (sets.length === 0) return;
  const insightTable = mapping.insightTable ?? `${mapping.objectTable.split('_')[0]}_insight`;
  await duckDBService.query(`UPDATE "${insightTable}" SET ${sets.join(', ')} WHERE id = ${id}`);
}

export async function updateOntologyIntrospection(
  mapping: OntologyMapping,
  id: number,
  updates: { question?: string; answer?: string }
): Promise<void> {
  const sets: string[] = [];
  if (updates.question !== undefined) sets.push(`question = ${duckDBService.escapeLiteral(updates.question)}`);
  if (updates.answer !== undefined) sets.push(`answer = ${duckDBService.escapeLiteral(updates.answer)}`);
  if (sets.length === 0) return;
  const introspectTable = mapping.introspectionTable ?? `${mapping.objectTable.split('_')[0]}_introspection`;
  await duckDBService.query(`UPDATE "${introspectTable}" SET ${sets.join(', ')} WHERE id = ${id}`);
}

export async function addIntrospection(
  mapping: OntologyMapping,
  objectId: number,
  question: string,
  answer: string
): Promise<void> {
  const introspectTable = mapping.introspectionTable ?? `${mapping.objectTable.split('_')[0]}_introspection`;
  await duckDBService.query(
    `INSERT INTO "${introspectTable}" (object_id, question, answer) VALUES (${objectId}, ${duckDBService.escapeLiteral(question)}, ${duckDBService.escapeLiteral(answer)})`
  );
}

export async function getIntrospections(
  mapping: OntologyMapping,
  objectId: number
): Promise<any[]> {
  const introspectTable = mapping.introspectionTable ?? `${mapping.objectTable.split('_')[0]}_introspection`;
  return duckDBService.query(`SELECT * FROM "${introspectTable}" WHERE object_id = ${objectId} ORDER BY created_at DESC`);
}

export async function addInsight(
  mapping: OntologyMapping,
  objectId: number,
  insight: string,
  tag: string
): Promise<void> {
  const insightTable = mapping.insightTable ?? `${mapping.objectTable.split('_')[0]}_insight`;
  await duckDBService.query(
    `INSERT INTO "${insightTable}" (object_id, insight, tag) VALUES (${objectId}, ${duckDBService.escapeLiteral(insight)}, ${duckDBService.escapeLiteral(tag)})`
  );
}

export async function getInsights(
  mapping: OntologyMapping
): Promise<any[]> {
  const insightTable = mapping.insightTable ?? `${mapping.objectTable.split('_')[0]}_insight`;
  return duckDBService.query(
    `SELECT li.*, lo.name as object_name FROM "${insightTable}" li LEFT JOIN "${mapping.objectTable}" lo ON li.object_id = lo.id ORDER BY li.created_at DESC`
  );
}

export async function getInsightsByTag(
  mapping: OntologyMapping,
  tag: string
): Promise<any[]> {
  const insightTable = mapping.insightTable ?? `${mapping.objectTable.split('_')[0]}_insight`;
  return duckDBService.query(
    `SELECT * FROM "${insightTable}" WHERE tag = ${duckDBService.escapeLiteral(tag)} ORDER BY created_at DESC`
  );
}

export async function deleteInsight(
  mapping: OntologyMapping,
  id: number
): Promise<void> {
  const insightTable = mapping.insightTable ?? `${mapping.objectTable.split('_')[0]}_insight`;
  await duckDBService.query(`DELETE FROM "${insightTable}" WHERE id = ${id}`);
}

// ============================================================
// Query — read introspection / insight tables
// ============================================================

export async function queryRecentIntrospections(
  mapping: OntologyMapping,
  limit = 20
): Promise<any[]> {
  const introspectTable = mapping.introspectionTable ?? `${mapping.objectTable.split('_')[0]}_introspection`;
  return duckDBService.query(`SELECT * FROM "${introspectTable}" ORDER BY created_at DESC LIMIT ${limit}`);
}

export async function queryRecentInsights(
  mapping: OntologyMapping,
  limit = 20
): Promise<any[]> {
  const insightTable = mapping.insightTable ?? `${mapping.objectTable.split('_')[0]}_insight`;
  return duckDBService.query(
    `SELECT li.*, lo.name as object_name FROM "${insightTable}" li LEFT JOIN "${mapping.objectTable}" lo ON li.object_id = lo.id ORDER BY li.created_at DESC LIMIT ${limit}`
  );
}

export async function queryIntrospectionsByObject(
  mapping: OntologyMapping,
  objectId: number,
  limit = 20
): Promise<any[]> {
  const introspectTable = mapping.introspectionTable ?? `${mapping.objectTable.split('_')[0]}_introspection`;
  return duckDBService.query(`SELECT * FROM "${introspectTable}" WHERE object_id = ${objectId} ORDER BY created_at DESC LIMIT ${limit}`);
}

export async function queryInsightsByObject(
  mapping: OntologyMapping,
  objectId: number,
  limit = 20
): Promise<any[]> {
  const insightTable = mapping.insightTable ?? `${mapping.objectTable.split('_')[0]}_insight`;
  return duckDBService.query(`SELECT * FROM "${insightTable}" WHERE object_id = ${objectId} ORDER BY created_at DESC LIMIT ${limit}`);
}

// ============================================================
// Canvas Spatial Layout Persistence — DuckDB Table Storage
// ============================================================

export async function initCanvasLayoutTable(mapping: OntologyMapping): Promise<void> {
  const layoutTable = mapping.canvasStateTable ?? `${mapping.objectTable.split('_')[0]}_canvas_layout`;
  await duckDBService.query(`
    CREATE TABLE IF NOT EXISTS "${layoutTable}" (
      object_id INTEGER PRIMARY KEY,
      x DOUBLE,
      y DOUBLE,
      is_locked BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function saveCanvasLayoutToDuckDB(
  mapping: OntologyMapping,
  positions: Record<number, { x: number; y: number }>,
  lockedIds: Set<number>
): Promise<void> {
  const layoutTable = mapping.canvasStateTable ?? `${mapping.objectTable.split('_')[0]}_canvas_layout`;
  await initCanvasLayoutTable(mapping);

  const entries = Object.entries(positions);
  if (entries.length === 0) return;

  const values = entries.map(([idStr, pos]) => {
    const id = Number(idStr);
    const locked = lockedIds.has(id) ? 'TRUE' : 'FALSE';
    return `(${id}, ${pos.x}, ${pos.y}, ${locked}, CURRENT_TIMESTAMP)`;
  });

  await duckDBService.query(`
    INSERT OR REPLACE INTO "${layoutTable}" (object_id, x, y, is_locked, updated_at)
    VALUES ${values.join(', ')};
  `);
}

export async function loadCanvasLayoutFromDuckDB(
  mapping: OntologyMapping
): Promise<{ positions: Record<number, { x: number; y: number }>; lockedIds: number[] }> {
  const layoutTable = mapping.canvasStateTable ?? `${mapping.objectTable.split('_')[0]}_canvas_layout`;
  await initCanvasLayoutTable(mapping);

  const rows = await duckDBService.query(`SELECT object_id, x, y, is_locked FROM "${layoutTable}"`);
  const positions: Record<number, { x: number; y: number }> = {};
  const lockedIds: number[] = [];

  if (rows && rows.length > 0) {
    rows.forEach(r => {
      positions[Number(r.object_id)] = { x: Number(r.x), y: Number(r.y) };
      if (Boolean(r.is_locked)) {
        lockedIds.push(Number(r.object_id));
      }
    });
  }

  return { positions, lockedIds };
}

