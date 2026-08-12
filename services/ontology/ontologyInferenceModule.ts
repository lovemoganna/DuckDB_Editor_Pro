import { duckDBService } from '../duckdbService';
import {
  compileRule,
  compileFeatureExpression,
  evaluateRule,
  runInference,
  type FeatureDefinition,
  type InferenceReport,
  type OutcomeDefinition,
  type RuleAst,
  type RuleDefinition,
  type TruthValue,
} from './ontologyInferenceEngine';

export interface OntologyInferenceDatabase {
  executeTransaction(statements: string[]): Promise<unknown>;
  query(sql: string): Promise<Array<Record<string, unknown>>>;
  queryWithParams(sql: string, params: unknown[]): Promise<Array<Record<string, unknown>>>;
}

export interface InferenceWorkspace {
  features: FeatureDefinition[];
  rules: RuleDefinition[];
  outcomes: OutcomeDefinition[];
  dependencyFeatureIds?: string[];
  dependencyRuleIds?: string[];
}

export interface DatabaseInferenceRequest {
  mode: 'preview' | 'test' | 'formal';
  workspace: InferenceWorkspace;
  selectedFeatureIds: string[];
  selectedRuleIds: string[];
  outcomeId?: string;
  topK?: number;
  beamWidth?: number;
  minSampleSize?: number;
}

export type SavedInferenceRequest = Omit<DatabaseInferenceRequest, 'workspace'>;

export interface StoredInferenceRun {
  mode: DatabaseInferenceRequest['mode'];
  request: SavedInferenceRequest;
  workspace: InferenceWorkspace;
  report: InferenceReport;
}

export interface OntologyInferenceModule {
  initialize(): Promise<void>;
  loadWorkspace(): Promise<InferenceWorkspace>;
  validateWorkspace(workspace: InferenceWorkspace): Promise<void>;
  saveWorkspace(workspace: InferenceWorkspace): Promise<void>;
  discoverCandidateFeatures(
    workspace: InferenceWorkspace,
    objectTypeIds: number[],
  ): Promise<FeatureDefinition[]>;
  listRuns(limit?: number): Promise<StoredInferenceRun[]>;
  replayRun(runId: string): Promise<InferenceReport>;
  run(request: DatabaseInferenceRequest): Promise<InferenceReport>;
}

export const ONTOLOGY_INFERENCE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS _sys_ontology_feature (
    logical_id VARCHAR PRIMARY KEY,
    display_name VARCHAR NOT NULL,
    current_version INTEGER NOT NULL,
    status VARCHAR NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS _sys_ontology_feature_version (
    logical_id VARCHAR NOT NULL,
    version INTEGER NOT NULL,
    version_id VARCHAR NOT NULL UNIQUE,
    definition_json VARCHAR NOT NULL,
    fingerprint VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (logical_id, version)
  )`,
  `CREATE TABLE IF NOT EXISTS _sys_ontology_rule (
    logical_id VARCHAR PRIMARY KEY,
    display_name VARCHAR NOT NULL,
    current_version INTEGER NOT NULL,
    status VARCHAR NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS _sys_ontology_rule_version (
    logical_id VARCHAR NOT NULL,
    version INTEGER NOT NULL,
    version_id VARCHAR NOT NULL UNIQUE,
    definition_json VARCHAR NOT NULL,
    fingerprint VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (logical_id, version)
  )`,
  `CREATE TABLE IF NOT EXISTS _sys_ontology_outcome (
    logical_id VARCHAR PRIMARY KEY,
    display_name VARCHAR NOT NULL,
    current_version INTEGER NOT NULL,
    status VARCHAR NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS _sys_ontology_outcome_version (
    logical_id VARCHAR NOT NULL,
    version INTEGER NOT NULL,
    version_id VARCHAR NOT NULL UNIQUE,
    definition_json VARCHAR NOT NULL,
    fingerprint VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (logical_id, version)
  )`,
  `CREATE TABLE IF NOT EXISTS _sys_ontology_inference_run (
    run_id VARCHAR PRIMARY KEY,
    generated_at TIMESTAMP NOT NULL,
    mode VARCHAR NOT NULL,
    request_json VARCHAR NOT NULL,
    workspace_json VARCHAR NOT NULL,
    sql_text VARCHAR NOT NULL,
    params_json VARCHAR NOT NULL,
    report_json VARCHAR,
    catalog_fingerprint VARCHAR NOT NULL,
    known_population BIGINT NOT NULL,
    unknown_population BIGINT NOT NULL,
    truncated BOOLEAN NOT NULL
  )`,
  `ALTER TABLE _sys_ontology_inference_run
    ADD COLUMN IF NOT EXISTS report_json VARCHAR`,
  `CREATE TABLE IF NOT EXISTS _sys_ontology_inference_result (
    run_id VARCHAR NOT NULL,
    rank INTEGER NOT NULL,
    candidate_json VARCHAR NOT NULL,
    PRIMARY KEY (run_id, rank)
  )`,
];

const quoteIdentifier = (identifier: string): string =>
  `"${identifier.replace(/"/g, '""')}"`;

const inferFeatureValueType = (columnType: string): FeatureDefinition['valueType'] => {
  const normalized = columnType.toUpperCase();
  if (normalized.includes('BOOL')) return 'boolean';
  if (normalized.includes('TIMESTAMP') || normalized === 'DATE') return 'timestamp';
  if (
    normalized.includes('INT')
    || normalized.includes('DECIMAL')
    || normalized.includes('DOUBLE')
    || normalized.includes('FLOAT')
    || normalized.includes('REAL')
  ) {
    return 'number';
  }
  if (normalized.includes('LIST') || normalized.includes('ARRAY')) return 'set';
  return 'string';
};

const identifierKey = (value: string): string => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || `column_${definitionFingerprint(value)}`;
};

const definitionFingerprint = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const serializeJSON = (value: unknown): string => JSON.stringify(
  value,
  (_key, nested) => typeof nested === 'bigint'
    ? { __ontologyInferenceType: 'bigint', value: nested.toString() }
    : nested,
);

const parseJSON = <T>(value: unknown, label: string): T => {
  if (typeof value !== 'string') {
    throw new Error(`${label} is missing`);
  }
  try {
    return JSON.parse(value, (_key, nested) =>
      nested
      && typeof nested === 'object'
      && nested.__ontologyInferenceType === 'bigint'
        ? BigInt(nested.value)
        : nested,
    ) as T;
  } catch {
    throw new Error(`${label} contains invalid JSON`);
  }
};

const fromSqlTruth = (value: unknown): TruthValue => {
  if (value === null || value === undefined) return 'UNKNOWN';
  if (typeof value === 'number') return value === 0 ? 'FALSE' : 'TRUE';
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return Number(value) === 0 ? 'FALSE' : 'TRUE';
  }
  if (
    value === true
    || value === 'true'
    || value === 'TRUE'
  ) return 'TRUE';
  if (value === false || value === 'false' || value === 'FALSE') return 'FALSE';
  return 'UNKNOWN';
};

const normalizeBooleanValue = (value: unknown): unknown => {
  if (value === true || value === false || value === null || value === undefined) {
    return value ?? null;
  }
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value) !== 0;
  return value;
};

const collectRuleDependencyIds = (
  node: RuleAst,
  ruleMap: Map<string, RuleDefinition>,
  featureIds: Set<string>,
  ruleIds: Set<string>,
  activeRuleIds: Set<string>,
): void => {
  if (node.kind === 'condition') {
    featureIds.add(node.featureId);
    return;
  }
  if (node.kind === 'ruleRef') {
    ruleIds.add(node.ruleId);
    if (activeRuleIds.has(node.ruleId)) return;
    const referenced = ruleMap.get(node.ruleId);
    if (referenced) {
      collectRuleDependencyIds(
        referenced.root,
        ruleMap,
        featureIds,
        ruleIds,
        new Set(activeRuleIds).add(node.ruleId),
      );
    }
    return;
  }
  if (node.kind === 'not') {
    collectRuleDependencyIds(
      node.child,
      ruleMap,
      featureIds,
      ruleIds,
      activeRuleIds,
    );
    return;
  }
  node.children.forEach(child =>
    collectRuleDependencyIds(child, ruleMap, featureIds, ruleIds, activeRuleIds),
  );
};

export function createOntologyInferenceModule(
  database: OntologyInferenceDatabase,
): OntologyInferenceModule {
  let initialization: Promise<void> | null = null;
  const initialize = async (): Promise<void> => {
    if (!initialization) {
      initialization = database.executeTransaction(ONTOLOGY_INFERENCE_SCHEMA)
        .then(() => undefined)
        .catch(error => {
          initialization = null;
          throw error;
        });
    }
    await initialization;
  };

  const loadDefinitions = async <T>(sql: string, label: string): Promise<T[]> => {
    const rows = await database.query(sql);
    return rows.map((row, index) => {
      if (typeof row.definition_json !== 'string') {
        throw new Error(`${label} version ${index + 1} has no definition JSON`);
      }
      try {
        return JSON.parse(row.definition_json) as T;
      } catch {
        throw new Error(`${label} version ${index + 1} contains invalid definition JSON`);
      }
    });
  };

  const saveDefinition = async (
    kind: 'feature' | 'rule' | 'outcome',
    definition: FeatureDefinition | RuleDefinition | OutcomeDefinition,
    updateCurrent: boolean,
  ): Promise<void> => {
    const serialized = JSON.stringify(definition);
    const fingerprint = definitionFingerprint(serialized);
    const existingVersions = await database.queryWithParams(
      `SELECT fingerprint
       FROM _sys_ontology_${kind}_version
       WHERE logical_id = ? AND version = ?`,
      [definition.logicalId, definition.version],
    );
    const existingFingerprint = existingVersions[0]?.fingerprint;
    if (
      typeof existingFingerprint === 'string'
      && existingFingerprint !== fingerprint
    ) {
      throw new Error(
        `${kind} immutable version conflict: ${definition.logicalId}.v${definition.version}`,
      );
    }
    await database.queryWithParams(
      `INSERT OR IGNORE INTO _sys_ontology_${kind}_version
        (logical_id, version, version_id, definition_json, fingerprint, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        definition.logicalId,
        definition.version,
        definition.id,
        serialized,
        fingerprint,
      ],
    );
    if (updateCurrent) {
      await database.queryWithParams(
        `INSERT OR REPLACE INTO _sys_ontology_${kind}
          (logical_id, display_name, current_version, status, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [definition.logicalId, definition.name, definition.version, definition.status],
      );
    }
  };

  const validateWorkspace = async (workspace: InferenceWorkspace): Promise<void> => {
    await initialize();
    workspace.features.forEach(feature => {
      compileFeatureExpression(feature);
    });
    workspace.rules.forEach(rule => {
      if (rule.status === 'active') {
        compileRule(rule, workspace.features, workspace.rules);
      }
    });
    workspace.outcomes.forEach(outcome => {
      if (!workspace.rules.some(rule => rule.id === outcome.ruleId)) {
        throw new Error(`Outcome ${outcome.name} references a missing rule version: ${outcome.ruleId}`);
      }
    });
    const definitions: Array<{
      kind: 'feature' | 'rule' | 'outcome';
      definition: FeatureDefinition | RuleDefinition | OutcomeDefinition;
    }> = [
      ...workspace.features.map(definition => ({ kind: 'feature' as const, definition })),
      ...workspace.rules.map(definition => ({ kind: 'rule' as const, definition })),
      ...workspace.outcomes.map(definition => ({ kind: 'outcome' as const, definition })),
    ];
    for (const { kind, definition } of definitions) {
      const existingVersions = await database.queryWithParams(
        `SELECT fingerprint
         FROM _sys_ontology_${kind}_version
         WHERE logical_id = ? AND version = ?`,
        [definition.logicalId, definition.version],
      );
      const existingFingerprint = existingVersions[0]?.fingerprint;
      const fingerprint = definitionFingerprint(JSON.stringify(definition));
      if (
        typeof existingFingerprint === 'string'
        && existingFingerprint !== fingerprint
      ) {
        throw new Error(
          `${kind} immutable version conflict: ${definition.logicalId}.v${definition.version}`,
        );
      }
    }
  };

  const saveWorkspace = async (workspace: InferenceWorkspace): Promise<void> => {
    await validateWorkspace(workspace);
    const dependencyFeatureIds = new Set(workspace.dependencyFeatureIds ?? []);
    const dependencyRuleIds = new Set(workspace.dependencyRuleIds ?? []);
    for (const feature of workspace.features) {
      await saveDefinition('feature', feature, !dependencyFeatureIds.has(feature.id));
    }
    for (const rule of workspace.rules) {
      await saveDefinition('rule', rule, !dependencyRuleIds.has(rule.id));
    }
    for (const outcome of workspace.outcomes) {
      await saveDefinition('outcome', outcome, true);
    }
  };

  const parseStoredRun = (row: Record<string, unknown>): StoredInferenceRun => {
    const request = parseJSON<SavedInferenceRequest>(
      row.request_json,
      'Stored inference request',
    );
    const workspace = parseJSON<InferenceWorkspace>(
      row.workspace_json,
      'Stored inference workspace',
    );
    const report = parseJSON<InferenceReport>(
      row.report_json,
      'Stored inference report',
    );
    return {
      mode: request.mode,
      request,
      workspace,
      report,
    };
  };

  const executeRun = async (
    request: DatabaseInferenceRequest,
  ): Promise<InferenceReport> => {
    await initialize();
    const selectedRules = request.selectedRuleIds.map(ruleId => {
      const rule = request.workspace.rules.find(item => item.id === ruleId);
      if (!rule) throw new Error(`Selected rule does not exist: ${ruleId}`);
      return rule;
    });
    const compiledRules = selectedRules.map(rule => ({
      rule,
      compiled: compileRule(
        rule,
        request.workspace.features,
        request.workspace.rules,
      ),
    }));
    const effectiveSelectedFeatureIds = [...new Set([
      ...request.selectedFeatureIds,
      ...compiledRules.flatMap(item => item.compiled.featureIds),
    ])];
    const selectedFeatures = effectiveSelectedFeatureIds.map(featureId => {
      const feature = request.workspace.features.find(item => item.id === featureId);
      if (!feature) throw new Error(`Selected feature does not exist: ${featureId}`);
      return feature;
    });
    if (selectedFeatures.length === 0) {
      throw new Error('At least one feature must be selected');
    }
    const sourceTables = new Set(selectedFeatures.map(feature => feature.source.table));
    if (sourceTables.size !== 1) {
      throw new Error('Selected features must use one declared population table');
    }
    const table = selectedFeatures[0].source.table;
    const outcome = request.outcomeId
      ? request.workspace.outcomes.find(item => item.id === request.outcomeId)
      : undefined;
    if (request.outcomeId && !outcome) {
      throw new Error(`Selected outcome does not exist: ${request.outcomeId}`);
    }
    if (outcome?.labelBinding && outcome.labelBinding.table !== table) {
      throw new Error('Outcome label must use the selected population table');
    }

    const params: unknown[] = [];
    const compiledRuleFingerprints: string[] = [];
    const selections = selectedFeatures.map(feature => {
      const expression = compileFeatureExpression(feature);
      const projectedExpression = feature.valueType === 'boolean'
        ? `CAST(${expression} AS INTEGER)`
        : expression;
      return `${projectedExpression} AS ${quoteIdentifier(feature.id)}`;
    });
    compiledRules.forEach(({ rule, compiled }) => {
      compiledRuleFingerprints.push(compiled.fingerprint);
      selections.push(
        `CAST(${compiled.predicateSql} AS INTEGER) `
        + `AS ${quoteIdentifier(`__rule:${rule.id}`)}`,
      );
      params.push(...compiled.params);
    });
    if (outcome?.labelBinding) {
      const labelExpression = quoteIdentifier(outcome.labelBinding.column);
      const projectedLabel = typeof outcome.labelBinding.positiveValue === 'boolean'
        ? `CAST(${labelExpression} AS INTEGER)`
        : labelExpression;
      selections.push(
        `${projectedLabel} AS ${quoteIdentifier('__outcome')}`,
      );
    }
    const limit = request.mode === 'preview'
      ? 200
      : request.mode === 'test'
        ? 1000
        : null;
    const sql = `SELECT\n  ${selections.join(',\n  ')}\nFROM ${quoteIdentifier(table)} AS ${quoteIdentifier('__population')}${
      limit ? `\nORDER BY ALL\nLIMIT ${limit}` : ''
    }`;
    const rows = await database.queryWithParams(sql, params);
    const normalizedRows = rows.map(row => {
      const normalized = { ...row };
      selectedFeatures.forEach(feature => {
        normalized[feature.id] = feature.valueType === 'boolean'
          ? normalizeBooleanValue(row[feature.id])
          : row[feature.id];
      });
      if (outcome?.labelBinding && typeof outcome.labelBinding.positiveValue === 'boolean') {
        normalized.__outcome = normalizeBooleanValue(row.__outcome);
      }
      return normalized;
    });

    for (let rowIndex = 0; rowIndex < normalizedRows.length; rowIndex += 1) {
      const row = normalizedRows[rowIndex];
      const rawRow = rows[rowIndex];
      for (const rule of selectedRules) {
        const JavaScriptTruth = evaluateRule(
          rule,
          request.workspace.features,
          row,
          { rules: request.workspace.rules },
        ).value;
        const sqlTruth = fromSqlTruth(row[`__rule:${rule.id}`]);
        if (JavaScriptTruth !== sqlTruth) {
          const featureSnapshot = Object.fromEntries(
            selectedFeatures.map(feature => [feature.id, row[feature.id] ?? null]),
          );
          throw new Error(
            `Rule execution drift detected for ${rule.id}: AST=${JavaScriptTruth}, `
            + `SQL=${sqlTruth}, rawSQL=${serializeJSON(rawRow[`__rule:${rule.id}`])}, `
            + `features=${serializeJSON(featureSnapshot)}`,
          );
        }
      }
    }

    const report = runInference({
      features: request.workspace.features,
      rules: request.workspace.rules,
      outcomes: request.workspace.outcomes,
      selectedFeatureIds: effectiveSelectedFeatureIds,
      selectedRuleIds: request.selectedRuleIds,
      outcomeId: request.outcomeId,
      rows: normalizedRows,
      topK: request.topK,
      beamWidth: request.beamWidth,
      minSampleSize: request.minSampleSize,
      executedSql: sql,
      params,
      compilationFingerprint: definitionFingerprint(JSON.stringify({
        featureVersionIds: selectedFeatures.map(feature => feature.id),
        compiledRuleFingerprints,
      })),
    });
    const requestSnapshot: SavedInferenceRequest = {
      mode: request.mode,
      selectedFeatureIds: effectiveSelectedFeatureIds,
      selectedRuleIds: request.selectedRuleIds,
      outcomeId: request.outcomeId,
      topK: report.topK,
      beamWidth: report.beamWidth,
      minSampleSize: request.minSampleSize ?? 30,
    };
    const workspaceJSON = serializeJSON(request.workspace);
    await database.queryWithParams(
      `INSERT OR REPLACE INTO _sys_ontology_inference_run
        (run_id, generated_at, mode, request_json, workspace_json, sql_text,
         params_json, report_json, catalog_fingerprint, known_population,
         unknown_population, truncated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        report.runId,
        report.generatedAt,
        request.mode,
        serializeJSON(requestSnapshot),
        workspaceJSON,
        sql,
        serializeJSON(params),
        serializeJSON(report),
        report.compilationFingerprint,
        report.knownPopulation,
        report.unknownPopulation,
        report.truncated,
      ],
    );
    for (const candidate of report.candidates) {
      await database.queryWithParams(
        `INSERT OR REPLACE INTO _sys_ontology_inference_result
          (run_id, rank, candidate_json)
         VALUES (?, ?, ?)`,
        [report.runId, candidate.rank, serializeJSON(candidate)],
      );
    }
    return report;
  };

  return {
    initialize,
    validateWorkspace,
    async loadWorkspace() {
      await initialize();
      const [
        currentFeatures,
        currentRules,
        outcomes,
        allFeatureVersions,
        allRuleVersions,
      ] = await Promise.all([
        loadDefinitions<FeatureDefinition>(
          `SELECT version.definition_json
           FROM _sys_ontology_feature AS current
           JOIN _sys_ontology_feature_version AS version
             ON version.logical_id = current.logical_id
            AND version.version = current.current_version
           ORDER BY current.logical_id`,
          'Feature',
        ),
        loadDefinitions<RuleDefinition>(
          `SELECT version.definition_json
           FROM _sys_ontology_rule AS current
           JOIN _sys_ontology_rule_version AS version
             ON version.logical_id = current.logical_id
            AND version.version = current.current_version
           ORDER BY current.logical_id`,
          'Rule',
        ),
        loadDefinitions<OutcomeDefinition>(
          `SELECT version.definition_json
           FROM _sys_ontology_outcome AS current
           JOIN _sys_ontology_outcome_version AS version
             ON version.logical_id = current.logical_id
            AND version.version = current.current_version
           ORDER BY current.logical_id`,
          'Outcome',
        ),
        loadDefinitions<FeatureDefinition>(
          `SELECT definition_json
           FROM _sys_ontology_feature_version
           ORDER BY logical_id, version`,
          'Feature',
        ),
        loadDefinitions<RuleDefinition>(
          `SELECT definition_json
           FROM _sys_ontology_rule_version
           ORDER BY logical_id, version`,
          'Rule',
        ),
      ]);
      const currentFeatureIds = new Set(currentFeatures.map(feature => feature.id));
      const currentRuleIds = new Set(currentRules.map(rule => rule.id));
      const allFeaturesById = new Map(
        [...allFeatureVersions, ...currentFeatures].map(feature => [feature.id, feature]),
      );
      const allRulesById = new Map(
        [...allRuleVersions, ...currentRules].map(rule => [rule.id, rule]),
      );
      const referencedFeatureIds = new Set<string>();
      const referencedRuleIds = new Set<string>(
        outcomes.map(outcome => outcome.ruleId),
      );
      currentRules.forEach(rule =>
        collectRuleDependencyIds(
          rule.root,
          allRulesById,
          referencedFeatureIds,
          referencedRuleIds,
          new Set([rule.id]),
        ),
      );
      for (const ruleId of [...referencedRuleIds]) {
        const referenced = allRulesById.get(ruleId);
        if (!referenced) continue;
        collectRuleDependencyIds(
          referenced.root,
          allRulesById,
          referencedFeatureIds,
          referencedRuleIds,
          new Set([referenced.id]),
        );
      }
      const dependencyRuleIds = [...referencedRuleIds]
        .filter(ruleId => !currentRuleIds.has(ruleId) && allRulesById.has(ruleId));
      const dependencyRules = dependencyRuleIds
        .map(ruleId => allRulesById.get(ruleId)!);
      const dependencyFeatureIds = [...referencedFeatureIds]
        .filter(featureId => !currentFeatureIds.has(featureId) && allFeaturesById.has(featureId));
      const dependencyFeatures = dependencyFeatureIds
        .map(featureId => allFeaturesById.get(featureId)!);
      return {
        features: [...currentFeatures, ...dependencyFeatures],
        rules: [...currentRules, ...dependencyRules],
        outcomes,
        dependencyFeatureIds,
        dependencyRuleIds,
      };
    },
    saveWorkspace,
    async discoverCandidateFeatures(workspace, objectTypeIds) {
      await initialize();
      const relevantObjectTypeIds = new Set(objectTypeIds);
      const relevantFeatures = workspace.features.filter(feature =>
        relevantObjectTypeIds.has(feature.objectTypeId),
      );
      const tableOwners = new Map<string, number>();
      relevantFeatures.forEach(feature => {
        if (!tableOwners.has(feature.source.table)) {
          tableOwners.set(feature.source.table, feature.objectTypeId);
        }
      });
      const mappedColumns = new Set(workspace.features.flatMap(feature =>
        feature.source.kind === 'column'
          ? [`${feature.source.table}.${feature.source.column}`]
          : [],
      ));
      const candidates: FeatureDefinition[] = [];
      for (const [table, objectTypeId] of [...tableOwners.entries()].sort()) {
        const rows = await database.query(`DESCRIBE ${quoteIdentifier(table)}`);
        for (const row of rows) {
          const column = typeof row.column_name === 'string'
            ? row.column_name
            : typeof row.name === 'string'
              ? row.name
              : '';
          if (!column || mappedColumns.has(`${table}.${column}`)) continue;
          const columnType = typeof row.column_type === 'string'
            ? row.column_type
            : typeof row.type === 'string'
              ? row.type
              : 'VARCHAR';
          const logicalId = `feature.discovered.${
            identifierKey(`${objectTypeId}_${table}_${column}`)
          }`;
          candidates.push({
            id: `${logicalId}.v1`,
            logicalId,
            version: 1,
            name: column,
            description: `从 ${table}.${column} 自动发现；启用前需补充中文业务名称与计算口径。`,
            valueType: inferFeatureValueType(columnType),
            objectTypeId,
            source: {
              kind: 'column',
              table,
              column,
              encoding: inferFeatureValueType(columnType) === 'set'
                ? 'native_list'
                : 'scalar',
            },
            nullSemantics: '尚未确认 NULL / UNKNOWN 业务语义，候选状态不可用于正式规则。',
            status: 'candidate',
          });
        }
      }
      return candidates.sort((left, right) => left.id.localeCompare(right.id));
    },
    async listRuns(limit = 20) {
      await initialize();
      const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
      const rows = await database.queryWithParams(
        `SELECT run_id, generated_at, mode, request_json, workspace_json, report_json
         FROM _sys_ontology_inference_run
         WHERE report_json IS NOT NULL
         ORDER BY generated_at DESC
         LIMIT ?`,
        [boundedLimit],
      );
      return rows.map(parseStoredRun);
    },
    async replayRun(runId) {
      await initialize();
      const rows = await database.queryWithParams(
        `SELECT run_id, generated_at, mode, request_json, workspace_json, report_json
         FROM _sys_ontology_inference_run
         WHERE run_id = ?`,
        [runId],
      );
      if (rows.length === 0) {
        throw new Error(`Inference run does not exist: ${runId}`);
      }
      const stored = parseStoredRun(rows[0]);
      return executeRun({
        ...stored.request,
        workspace: stored.workspace,
      });
    },
    run: executeRun,
  };
}

export const ontologyInferenceModule = createOntologyInferenceModule(
  duckDBService as OntologyInferenceDatabase,
);
