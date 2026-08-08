import { describe, expect, it, vi } from 'vitest';
import {
  compileRule,
  type FeatureDefinition,
  type OutcomeDefinition,
  type RuleDefinition,
} from './ontologyInferenceEngine';
import { createOntologyInferenceModule } from './ontologyInferenceModule';

const features: FeatureDefinition[] = [
  {
    id: 'feature.risk.amount.v1',
    logicalId: 'feature.risk.amount',
    version: 1,
    name: '交易金额',
    description: '交易金额',
    valueType: 'number',
    objectTypeId: 1,
    source: { kind: 'column', table: 'risk_events', column: 'amount' },
    nullSemantics: '金额缺失时返回 UNKNOWN',
    status: 'active',
  },
  {
    id: 'feature.risk.fast.v1',
    logicalId: 'feature.risk.fast',
    version: 1,
    name: '快进快出',
    description: '快速流转',
    valueType: 'boolean',
    objectTypeId: 1,
    source: { kind: 'column', table: 'risk_events', column: 'fast' },
    nullSemantics: '流水不完整时返回 UNKNOWN',
    status: 'active',
  },
];

const rule: RuleDefinition = {
  id: 'rule.risk.alert.v1',
  logicalId: 'rule.risk.alert',
  version: 1,
  name: '风险告警',
  description: '大额且快进快出',
  status: 'active',
  root: {
    kind: 'and',
    nodeId: 'root',
    children: [
      {
        kind: 'condition',
        nodeId: 'amount',
        featureId: features[0].id,
        operator: 'gt',
        value: 100000,
      },
      {
        kind: 'condition',
        nodeId: 'fast',
        featureId: features[1].id,
        operator: 'is_true',
      },
    ],
  },
};

const outcome: OutcomeDefinition = {
  id: 'outcome.risk.alert.v1',
  logicalId: 'outcome.risk.alert',
  version: 1,
  name: '确认风险',
  description: '人工确认风险标签',
  objectTypeId: 1,
  mode: 'classification',
  ruleId: rule.id,
  labelBinding: {
    table: 'risk_events',
    column: 'confirmed',
    positiveValue: true,
  },
  status: 'active',
};

describe('ontology inference module', () => {
  it('uses one parameterized DuckDB execution path for a formal inference run', async () => {
    const queryWithParams = vi.fn().mockImplementation(async (sql: string) => {
      if (!sql.startsWith('SELECT')) return [];
      return [
        {
          [features[0].id]: 180000,
          [features[1].id]: true,
          [`__rule:${rule.id}`]: true,
          __outcome: true,
        },
        {
          [features[0].id]: 180000,
          [features[1].id]: true,
          [`__rule:${rule.id}`]: true,
          __outcome: false,
        },
      ];
    });
    const database = {
      executeTransaction: vi.fn().mockResolvedValue([]),
      query: vi.fn().mockResolvedValue([]),
      queryWithParams,
    };
    const module = createOntologyInferenceModule(database);

    const report = await module.run({
      mode: 'formal',
      workspace: { features, rules: [rule], outcomes: [outcome] },
      selectedFeatureIds: features.map(feature => feature.id),
      selectedRuleIds: [rule.id],
      outcomeId: outcome.id,
      topK: 20,
      beamWidth: 200,
      minSampleSize: 30,
    });

    const executionCall = queryWithParams.mock.calls.find(([sql]) =>
      String(sql).startsWith('SELECT'),
    );
    expect(executionCall).toBeDefined();
    const [sql, params] = executionCall!;
    expect(sql).toContain('FROM "risk_events"');
    expect(sql).toContain('"amount" AS "feature.risk.amount.v1"');
    expect(sql).toContain('CAST("fast" AS INTEGER)');
    expect(sql).toContain('("amount" > ?)');
    expect(sql).toContain(`CAST((("amount" > ?) AND ("fast" = TRUE)) AS INTEGER)`);
    expect(sql).toContain(`AS "__rule:${rule.id}"`);
    expect(sql).toContain('CAST("confirmed" AS INTEGER)');
    expect(sql).not.toContain('100000');
    expect(params).toEqual([100000]);
    expect(report.candidates[0]).toMatchObject({
      count: 2,
      probability: 1,
      outcomeProbability: 0.5,
    });
    expect(report.executedSql).toBe(sql);
    expect(report.params).toEqual(params);
    expect(queryWithParams.mock.calls.some(([statement]) =>
      String(statement).includes('INSERT OR REPLACE INTO _sys_ontology_inference_run'),
    )).toBe(true);
    expect(queryWithParams.mock.calls.some(([statement]) =>
      String(statement).includes('INSERT OR REPLACE INTO _sys_ontology_inference_result'),
    )).toBe(true);
  });

  it('reports the feature snapshot when AST and SQL truth values drift', async () => {
    const database = {
      executeTransaction: vi.fn().mockResolvedValue([]),
      query: vi.fn().mockResolvedValue([]),
      queryWithParams: vi.fn().mockImplementation(async (sql: string) =>
        sql.startsWith('SELECT')
          ? [{
            [features[0].id]: 180000,
            [features[1].id]: true,
            [`__rule:${rule.id}`]: null,
          }]
          : [],
      ),
    };
    const module = createOntologyInferenceModule(database);

    await expect(module.run({
      mode: 'preview',
      workspace: { features, rules: [rule], outcomes: [] },
      selectedFeatureIds: features.map(feature => feature.id),
      selectedRuleIds: [rule.id],
    })).rejects.toThrow(
      /AST=TRUE, SQL=UNKNOWN, rawSQL=null, features=\{"feature\.risk\.amount\.v1":180000,"feature\.risk\.fast\.v1":true\}/,
    );
  });

  it('automatically projects fixed feature versions referenced by selected rules', async () => {
    const queryWithParams = vi.fn().mockImplementation(async (sql: string) =>
      sql.startsWith('SELECT')
        ? [{
          [features[0].id]: 180000,
          [features[1].id]: 1,
          [`__rule:${rule.id}`]: 1,
        }]
        : [],
    );
    const module = createOntologyInferenceModule({
      executeTransaction: vi.fn().mockResolvedValue([]),
      query: vi.fn().mockResolvedValue([]),
      queryWithParams,
    });

    const report = await module.run({
      mode: 'preview',
      workspace: { features, rules: [rule], outcomes: [] },
      selectedFeatureIds: [features[0].id],
      selectedRuleIds: [rule.id],
    });

    const [sql] = queryWithParams.mock.calls.find(([statement]) =>
      String(statement).startsWith('SELECT\n'),
    )!;
    expect(sql).toContain(`AS "${features[1].id}"`);
    expect(report.featureVersionIds).toEqual(features.map(feature => feature.id));
    expect(report.candidates[0].states).toHaveLength(2);
  });

  it('normalizes DuckDB-WASM bit-packed booleans before AST and probability evaluation', async () => {
    const database = {
      executeTransaction: vi.fn().mockResolvedValue([]),
      query: vi.fn().mockResolvedValue([]),
      queryWithParams: vi.fn().mockImplementation(async (sql: string) =>
        sql.startsWith('SELECT')
          ? [{
            [features[0].id]: 180000,
            [features[1].id]: -1,
            [`__rule:${rule.id}`]: 3,
            __outcome: 3,
          }]
          : [],
      ),
    };
    const module = createOntologyInferenceModule(database);

    const report = await module.run({
      mode: 'preview',
      workspace: { features, rules: [rule], outcomes: [outcome] },
      selectedFeatureIds: features.map(feature => feature.id),
      selectedRuleIds: [rule.id],
      outcomeId: outcome.id,
    });

    expect(report.candidates[0]).toMatchObject({
      count: 1,
      outcomeKnownCount: 1,
      outcomeProbability: 2 / 3,
      ruleResults: [{
        trueCount: 1,
        falseCount: 0,
        unknownCount: 0,
      }],
    });
    expect(report.candidates[0].states).toEqual(expect.arrayContaining([
      expect.objectContaining({ featureId: features[1].id, value: true }),
    ]));
  });

  it('initializes versioned catalog tables and loads definitions from their immutable versions', async () => {
    const database = {
      executeTransaction: vi.fn().mockResolvedValue([]),
      query: vi.fn()
        .mockResolvedValueOnce(features.map(feature => ({
          definition_json: JSON.stringify(feature),
        })))
        .mockResolvedValueOnce([{ definition_json: JSON.stringify(rule) }])
        .mockResolvedValueOnce([{ definition_json: JSON.stringify(outcome) }])
        .mockResolvedValueOnce(features.map(feature => ({
          definition_json: JSON.stringify(feature),
        })))
        .mockResolvedValueOnce([{ definition_json: JSON.stringify(rule) }]),
      queryWithParams: vi.fn().mockResolvedValue([]),
    };
    const module = createOntologyInferenceModule(database);

    await module.initialize();
    const workspace = await module.loadWorkspace();
    await module.saveWorkspace(workspace);

    const schemaSql = database.executeTransaction.mock.calls[0][0].join('\n');
    expect(schemaSql).toContain('_sys_ontology_feature_version');
    expect(schemaSql).toContain('_sys_ontology_rule_version');
    expect(schemaSql).toContain('_sys_ontology_outcome_version');
    expect(schemaSql).toContain('_sys_ontology_inference_run');
    expect(schemaSql).toContain('_sys_ontology_inference_result');
    expect(workspace).toEqual({
      features,
      rules: [rule],
      outcomes: [outcome],
      dependencyFeatureIds: [],
      dependencyRuleIds: [],
    });
    expect(database.queryWithParams).toHaveBeenCalled();
    for (const [sql, params] of database.queryWithParams.mock.calls) {
      expect(sql).toContain('?');
      expect(params.length).toBeGreaterThan(0);
      expect(sql).not.toContain('大额且快进快出');
    }
    expect(database.queryWithParams.mock.calls
      .filter(([sql]) => String(sql).includes('definition_json'))
      .every(([sql]) => String(sql).includes('INSERT OR IGNORE'))).toBe(true);
  });

  it('installs the explicit versioned risk template with a reproducible DuckDB population', async () => {
    const database = {
      executeTransaction: vi.fn().mockResolvedValue([]),
      query: vi.fn().mockResolvedValue([]),
      queryWithParams: vi.fn().mockResolvedValue([]),
    };
    const module = createOntologyInferenceModule(database);

    const workspace = await module.installRiskTemplate();

    expect(workspace.features.map(feature => feature.name)).toEqual([
      '快进快出',
      '交易金额',
      '地址风险',
      '客户标签',
    ]);
    expect(workspace.rules[0].name).toBe('高风险交易');
    expect(workspace.outcomes[0].name).toBe('确认高风险交易');
    expect(database.executeTransaction.mock.calls.flatMap(([statements]) => statements).join('\n'))
      .toContain('_sys_ontology_risk_demo');
    expect(database.queryWithParams.mock.calls.some(([statement]) =>
      String(statement).includes('_sys_ontology_feature_version'),
    )).toBe(true);
  });

  it('keeps one compilation fingerprint across preview, test and formal execution modes', async () => {
    const database = {
      executeTransaction: vi.fn().mockResolvedValue([]),
      query: vi.fn().mockResolvedValue([]),
      queryWithParams: vi.fn().mockImplementation(async (sql: string) => {
        if (!sql.startsWith('SELECT')) return [];
        return [{
          [features[0].id]: 180000,
          [features[1].id]: true,
          [`__rule:${rule.id}`]: true,
          __outcome: true,
        }];
      }),
    };
    const module = createOntologyInferenceModule(database);
    const common = {
      workspace: { features, rules: [rule], outcomes: [outcome] },
      selectedFeatureIds: features.map(feature => feature.id),
      selectedRuleIds: [rule.id],
      outcomeId: outcome.id,
    };

    const preview = await module.run({ ...common, mode: 'preview' });
    const test = await module.run({ ...common, mode: 'test' });
    const formal = await module.run({ ...common, mode: 'formal' });

    expect(new Set([
      preview.compilationFingerprint,
      test.compilationFingerprint,
      formal.compilationFingerprint,
    ]).size).toBe(1);
    expect(preview.executedSql).toContain('LIMIT 200');
    expect(test.executedSql).toContain('LIMIT 1000');
    expect(formal.executedSql).not.toContain('LIMIT');
  });

  it('discovers unmapped physical columns as inactive candidate features', async () => {
    const database = {
      executeTransaction: vi.fn().mockResolvedValue([]),
      query: vi.fn().mockResolvedValue([
        { column_name: 'amount', column_type: 'DOUBLE' },
        { column_name: 'device_id', column_type: 'VARCHAR' },
        { column_name: 'event_time', column_type: 'TIMESTAMP' },
      ]),
      queryWithParams: vi.fn().mockResolvedValue([]),
    };
    const module = createOntologyInferenceModule(database);

    const candidates = await module.discoverCandidateFeatures(
      { features, rules: [rule], outcomes: [outcome] },
      [1],
    );

    expect(candidates.map(candidate => candidate.name)).toEqual([
      'device_id',
      'event_time',
    ]);
    expect(candidates[0]).toMatchObject({
      valueType: 'string',
      objectTypeId: 1,
      status: 'candidate',
      source: { kind: 'column', table: 'risk_events', column: 'device_id' },
    });
    expect(candidates[1].valueType).toBe('timestamp');
    expect(database.query).toHaveBeenCalledWith('DESCRIBE "risk_events"');
  });

  it('refuses to overwrite an immutable definition version with different content', async () => {
    const database = {
      executeTransaction: vi.fn().mockResolvedValue([]),
      query: vi.fn().mockResolvedValue([]),
      queryWithParams: vi.fn().mockImplementation(async (sql: string) =>
        sql.includes('SELECT fingerprint')
          ? [{ fingerprint: 'different-fingerprint' }]
          : [],
      ),
    };
    const module = createOntologyInferenceModule(database);

    await expect(module.saveWorkspace({
      features: [features[0]],
      rules: [],
      outcomes: [],
    })).rejects.toThrow('immutable version conflict');
    expect(database.queryWithParams.mock.calls.some(([sql]) =>
      String(sql).includes('INSERT OR REPLACE INTO _sys_ontology_feature\n'),
    )).toBe(false);
  });

  it('loads fixed historical subrule versions as read-only dependencies', async () => {
    const ruleV2: RuleDefinition = {
      ...rule,
      id: 'rule.risk.alert.v2',
      version: 2,
      root: {
        kind: 'condition',
        nodeId: 'amount-v2',
        featureId: features[0].id,
        operator: 'gt',
        value: 200000,
      },
    };
    const parent: RuleDefinition = {
      ...rule,
      id: 'rule.risk.parent.v1',
      logicalId: 'rule.risk.parent',
      name: 'Parent',
      root: {
        kind: 'ruleRef',
        nodeId: 'fixed-child',
        ruleId: rule.id,
      },
    };
    const database = {
      executeTransaction: vi.fn().mockResolvedValue([]),
      query: vi.fn()
        .mockResolvedValueOnce(features.map(feature => ({
          definition_json: JSON.stringify(feature),
        })))
        .mockResolvedValueOnce([
          { definition_json: JSON.stringify(parent) },
          { definition_json: JSON.stringify(ruleV2) },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(features.map(feature => ({
          definition_json: JSON.stringify(feature),
        })))
        .mockResolvedValueOnce([
          { definition_json: JSON.stringify(rule) },
          { definition_json: JSON.stringify(ruleV2) },
          { definition_json: JSON.stringify(parent) },
        ]),
      queryWithParams: vi.fn().mockResolvedValue([]),
    };
    const module = createOntologyInferenceModule(database);

    const workspace = await module.loadWorkspace();
    await module.saveWorkspace(workspace);

    expect(workspace.rules.map(item => item.id)).toEqual([
      parent.id,
      ruleV2.id,
      rule.id,
    ]);
    expect(workspace.dependencyRuleIds).toEqual([rule.id]);
    expect(compileRule(parent, workspace.features, workspace.rules).params).toEqual([
      100000,
    ]);
    const currentRuleWrites = database.queryWithParams.mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT OR REPLACE INTO _sys_ontology_rule\n'),
    );
    expect(currentRuleWrites.some(([_sql, params]) =>
      params[0] === rule.logicalId && params[2] === 1,
    )).toBe(false);
    expect(currentRuleWrites.some(([_sql, params]) =>
      params[0] === ruleV2.logicalId && params[2] === 2,
    )).toBe(true);
  });

  it('loads immutable run snapshots and replays them with the recorded definitions', async () => {
    const storedReport = {
      runId: 'inference-stored',
      generatedAt: '2026-07-30T03:00:00.000Z',
      knownPopulation: 2,
      unknownPopulation: 0,
      unknownRate: 0,
      candidates: [],
      totalCandidateCount: 0,
      omittedCandidateCount: 0,
      truncated: false,
      beamWidth: 200,
      topK: 20,
      executedSql: 'SELECT 1',
      params: [],
      compilationFingerprint: 'compile-stored',
      featureVersionIds: features.map(feature => feature.id),
      ruleVersionIds: [rule.id],
    };
    const storedRequest = {
      mode: 'formal',
      selectedFeatureIds: features.map(feature => feature.id),
      selectedRuleIds: [rule.id],
      outcomeId: outcome.id,
      topK: 20,
      beamWidth: 200,
      minSampleSize: 30,
    };
    const database = {
      executeTransaction: vi.fn().mockResolvedValue([]),
      query: vi.fn().mockResolvedValue([]),
      queryWithParams: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('FROM _sys_ontology_inference_run') && sql.includes('ORDER BY')) {
          return [{
            run_id: storedReport.runId,
            generated_at: storedReport.generatedAt,
            mode: 'formal',
            request_json: JSON.stringify(storedRequest),
            workspace_json: JSON.stringify({ features, rules: [rule], outcomes: [outcome] }),
            report_json: JSON.stringify(storedReport),
          }];
        }
        if (sql.includes('WHERE run_id = ?')) {
          return [{
            run_id: storedReport.runId,
            generated_at: storedReport.generatedAt,
            mode: 'formal',
            request_json: JSON.stringify(storedRequest),
            workspace_json: JSON.stringify({ features, rules: [rule], outcomes: [outcome] }),
            report_json: JSON.stringify(storedReport),
          }];
        }
        if (sql.startsWith('SELECT')) {
          return [
            {
              [features[0].id]: 180000,
              [features[1].id]: true,
              [`__rule:${rule.id}`]: true,
              __outcome: true,
            },
          ];
        }
        return [];
      }),
    };
    const module = createOntologyInferenceModule(database);

    const history = await module.listRuns(10);
    const replay = await module.replayRun('inference-stored');

    expect(history).toEqual([{
      mode: 'formal',
      request: storedRequest,
      workspace: { features, rules: [rule], outcomes: [outcome] },
      report: storedReport,
    }]);
    expect(replay.runId).not.toBe(storedReport.runId);
    const executionCall = database.queryWithParams.mock.calls.find(([sql]) =>
      String(sql).startsWith('SELECT\n'),
    );
    expect(executionCall?.[0]).toContain('FROM "risk_events"');
    expect(database.queryWithParams.mock.calls.some(([sql, params]) =>
      String(sql).includes('WHERE run_id = ?')
      && params[0] === 'inference-stored',
    )).toBe(true);
  });
});
