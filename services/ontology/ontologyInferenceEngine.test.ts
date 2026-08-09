import { describe, expect, it } from 'vitest';
import {
  compileRule,
  compileFeatureExpression,
  evaluateRule,
  parseRuleLisp,
  runInference,
  renderRuleExplanation,
  renderRuleLisp,
  validateRule,
  type FeatureDefinition,
  type RuleDefinition,
  type OutcomeDefinition,
} from './ontologyInferenceEngine';
import { RISK_INFERENCE_WORKSPACE } from './ontologyInferenceRiskTemplate';

const riskFeatures: FeatureDefinition[] = [
  {
    id: 'feature.risk.fast_in_fast_out.v1',
    logicalId: 'feature.risk.fast_in_fast_out',
    version: 1,
    name: '快进快出',
    description: '30 分钟内累计入账不少于 10000 且转出比例不少于 90%',
    valueType: 'boolean',
    objectTypeId: 1,
    source: { kind: 'column', table: 'risk_transactions', column: 'fast_in_fast_out' },
    nullSemantics: '缺少完整资金流水时返回 UNKNOWN',
    status: 'active',
  },
  {
    id: 'feature.risk.transaction_amount.v1',
    logicalId: 'feature.risk.transaction_amount',
    version: 1,
    name: '交易金额',
    description: '交易原币金额',
    valueType: 'number',
    objectTypeId: 1,
    source: { kind: 'column', table: 'risk_transactions', column: 'transaction_amount' },
    nullSemantics: '金额缺失时返回 UNKNOWN',
    status: 'active',
  },
  {
    id: 'feature.risk.address_risk.v1',
    logicalId: 'feature.risk.address_risk',
    version: 1,
    name: '地址风险',
    description: '地址风险分级',
    valueType: 'category',
    objectTypeId: 1,
    source: { kind: 'column', table: 'risk_transactions', column: 'address_risk' },
    nullSemantics: '地址未评级时返回 UNKNOWN',
    status: 'active',
  },
  {
    id: 'feature.risk.customer_tags.v1',
    logicalId: 'feature.risk.customer_tags',
    version: 1,
    name: '客户标签',
    description: '客户标签集合',
    valueType: 'set',
    objectTypeId: 1,
    source: { kind: 'column', table: 'risk_transactions', column: 'customer_tags' },
    nullSemantics: '标签未加载时返回 UNKNOWN',
    status: 'active',
  },
];

const highRiskRule: RuleDefinition = {
  id: 'rule.risk.high_risk_transaction.v1',
  logicalId: 'rule.risk.high_risk_transaction',
  version: 1,
  name: '高风险交易',
  description: '识别快速流转的大额高风险地址交易，并排除白名单客户',
  status: 'active',
  root: {
    kind: 'and',
    nodeId: 'root',
    children: [
      {
        kind: 'condition',
        nodeId: 'fast',
        featureId: riskFeatures[0].id,
        operator: 'is_true',
      },
      {
        kind: 'condition',
        nodeId: 'amount',
        featureId: riskFeatures[1].id,
        operator: 'gt',
        value: 100000,
      },
      {
        kind: 'or',
        nodeId: 'address',
        children: [
          {
            kind: 'condition',
            nodeId: 'address-high',
            featureId: riskFeatures[2].id,
            operator: 'eq',
            value: '高风险',
          },
          {
            kind: 'condition',
            nodeId: 'address-sanctioned',
            featureId: riskFeatures[2].id,
            operator: 'eq',
            value: '制裁',
          },
        ],
      },
      {
        kind: 'not',
        nodeId: 'not-whitelist',
        child: {
          kind: 'condition',
          nodeId: 'whitelist',
          featureId: riskFeatures[3].id,
          operator: 'contains',
          value: '白名单',
        },
      },
    ],
  },
};

const riskOutcome: OutcomeDefinition = {
  id: 'outcome.risk.high_risk_transaction.v1',
  logicalId: 'outcome.risk.high_risk_transaction',
  version: 1,
  name: '高风险交易',
  description: '当前交易是否被人工复核确认为高风险',
  objectTypeId: 1,
  mode: 'classification',
  ruleId: highRiskRule.id,
  labelBinding: {
    table: 'risk_transactions',
    column: 'confirmed_high_risk',
    positiveValue: true,
  },
  status: 'active',
};

describe('ontology inference engine', () => {
  it('evaluates a nested risk rule with strong Kleene three-valued logic', () => {
    const result = evaluateRule(highRiskRule, riskFeatures, {
      [riskFeatures[0].id]: true,
      [riskFeatures[1].id]: 180000,
      [riskFeatures[2].id]: '制裁',
      [riskFeatures[3].id]: ['高净值'],
    });

    expect(result.value).toBe('TRUE');
    expect(result.children).toHaveLength(4);

    const unknown = evaluateRule(highRiskRule, riskFeatures, {
      [riskFeatures[0].id]: true,
      [riskFeatures[1].id]: null,
      [riskFeatures[2].id]: '制裁',
      [riskFeatures[3].id]: ['高净值'],
    });

    expect(unknown.value).toBe('UNKNOWN');
    expect(unknown.children?.[1]).toMatchObject({
      nodeId: 'amount',
      value: 'UNKNOWN',
      reason: '金额缺失时返回 UNKNOWN',
    });
  });

  it('derives Chinese Lisp, explanation and parameterized SQL from the same AST', () => {
    const validation = validateRule(highRiskRule, riskFeatures);
    const compiled = compileRule(highRiskRule, riskFeatures);

    expect(validation).toMatchObject({ valid: true, errors: [] });
    expect(renderRuleLisp(highRiskRule, riskFeatures)).toBe(`(高风险交易
 (AND
  (快进快出 是)
  (交易金额 大于 100000)
  (OR
   (地址风险 等于 高风险)
   (地址风险 等于 制裁))
  (NOT
   (客户标签 包含 白名单))))`);
    expect(renderRuleExplanation(highRiskRule, riskFeatures)).toContain(
      '同时满足：快进快出为是；交易金额大于100000',
    );
    expect(compiled.params).toEqual([100000, '高风险', '制裁', '白名单']);
    expect(compiled.predicateSql).toContain('"transaction_amount" > ?');
    expect(compiled.predicateSql).toContain('"address_risk" = ?');
    expect(compiled.predicateSql).not.toContain('100000');
    expect(compiled.predicateSql).not.toContain('高风险');
    expect(compiled.fingerprint).toMatch(/^[0-9a-f]{8}$/);
  });

  it('accepts a valid Chinese Lisp edit only after parsing and validation', () => {
    const edited = parseRuleLisp(`(重点风险交易
 (AND
  (快进快出 是)
  (交易金额 大于 200000)
  (NOT
   (客户标签 包含 白名单))))`, highRiskRule, riskFeatures);

    expect(edited.name).toBe('重点风险交易');
    expect(edited.id).toBe(highRiskRule.id);
    expect(validateRule(edited, riskFeatures).valid).toBe(true);
    expect(compileRule(edited, riskFeatures).params).toEqual([200000, '白名单']);
    expect(evaluateRule(edited, riskFeatures, {
      [riskFeatures[0].id]: true,
      [riskFeatures[1].id]: 250000,
      [riskFeatures[3].id]: [],
    }).value).toBe('TRUE');

    expect(() => parseRuleLisp(
      '(错误规则 (NOT (交易金额 大于 1) (快进快出 是)))',
      highRiskRule,
      riskFeatures,
    )).toThrow('NOT 必须且只能包含一个直接子节点');
  });

  it('round-trips quoted business names and array parameters through Chinese Lisp', () => {
    const categoryFeature: FeatureDefinition = {
      ...riskFeatures[2],
      id: 'feature.risk.category_with_space.v1',
      logicalId: 'feature.risk.category_with_space',
      name: '风险 分类',
    };
    const arrayRule: RuleDefinition = {
      ...highRiskRule,
      id: 'rule.risk.array_round_trip.v1',
      logicalId: 'rule.risk.array_round_trip',
      name: '数组 规则',
      root: {
        kind: 'condition',
        nodeId: 'category-in',
        featureId: categoryFeature.id,
        operator: 'in',
        value: ['高风险', '制裁'],
      },
    };

    const lisp = renderRuleLisp(arrayRule, [categoryFeature]);
    const parsed = parseRuleLisp(lisp, arrayRule, [categoryFeature]);

    expect(lisp).toContain('"数组 规则"');
    expect(lisp).toContain('"风险 分类"');
    expect(lisp).toContain('["高风险","制裁"]');
    expect(parsed.root).toMatchObject({
      kind: 'condition',
      value: ['高风险', '制裁'],
    });
    expect(compileRule(parsed, [categoryFeature]).params).toEqual(['高风险', '制裁']);
  });

  it('ranks mutually exclusive feature situations by evidence instead of rule hit count', () => {
    const rows = [
      [true, 180000, '制裁', ['高净值'], true],
      [true, 180000, '制裁', ['高净值'], true],
      [true, 180000, '制裁', ['高净值'], true],
      [true, 180000, '制裁', ['高净值'], false],
      [true, 90000, '低风险', [], false],
      [true, 90000, '低风险', [], false],
      [false, 20000, '低风险', ['白名单'], false],
      [false, 20000, '低风险', ['白名单'], false],
      [false, 20000, '低风险', ['白名单'], false],
      [null, 180000, '制裁', [], true],
    ].map(([fast, amount, address, tags, outcome]) => ({
      [riskFeatures[0].id]: fast,
      [riskFeatures[1].id]: amount,
      [riskFeatures[2].id]: address,
      [riskFeatures[3].id]: tags,
      __outcome: outcome,
    }));

    const report = runInference({
      features: riskFeatures,
      rules: [highRiskRule],
      outcomes: [riskOutcome],
      selectedFeatureIds: riskFeatures.map(feature => feature.id),
      selectedRuleIds: [highRiskRule.id],
      outcomeId: riskOutcome.id,
      rows,
      topK: 20,
      beamWidth: 200,
      minSampleSize: 30,
      executedSql: 'SELECT ... FROM "risk_transactions"',
      params: [],
    });

    expect(report.knownPopulation).toBe(9);
    expect(report.unknownPopulation).toBe(1);
    expect(report.candidates[0]).toMatchObject({
      count: 4,
      probability: 4 / 9,
      smallSample: true,
      outcomeProbability: 4 / 6,
      evidenceKind: 'empirical_probability',
    });
    expect(report.candidates[0].ruleResults[0]).toMatchObject({
      ruleId: highRiskRule.id,
      trueCount: 4,
      falseCount: 0,
      unknownCount: 0,
    });
    expect(report.executedSql).toBe('SELECT ... FROM "risk_transactions"');
    expect(report.truncated).toBe(false);
  });

  it('computes a global Top-K for outcome probability instead of reordering frequency Top-K', () => {
    const amountFeature = riskFeatures[1];
    const amountRule: RuleDefinition = {
      ...highRiskRule,
      root: {
        kind: 'condition',
        nodeId: 'amount-threshold',
        featureId: amountFeature.id,
        operator: 'gt',
        value: 100000,
      },
    };
    const labelledOutcome: OutcomeDefinition = {
      ...riskOutcome,
      ruleId: amountRule.id,
    };
    const rows = [
      ...Array.from({ length: 10 }, (_, index) => ({
        [amountFeature.id]: 50000,
        __outcome: index === 0,
      })),
      { [amountFeature.id]: 180000, __outcome: true },
      { [amountFeature.id]: 180000, __outcome: true },
    ];

    const report = runInference({
      features: [amountFeature],
      rules: [amountRule],
      outcomes: [labelledOutcome],
      selectedFeatureIds: [amountFeature.id],
      selectedRuleIds: [amountRule.id],
      outcomeId: labelledOutcome.id,
      rows,
      topK: 1,
      executedSql: 'SELECT amount, confirmed FROM risk_transactions',
      params: [],
    });

    expect(report.candidates[0]).toMatchObject({ count: 10 });
    expect(report.outcomeCandidates[0]).toMatchObject({
      count: 2,
      outcomeProbability: 0.75,
    });
  });

  it('exhausts the strong Kleene truth tables for AND, OR and NOT', () => {
    const truthRows = [
      { raw: true, truth: 'TRUE' as const },
      { raw: false, truth: 'FALSE' as const },
      { raw: null, truth: 'UNKNOWN' as const },
    ];
    const expectedAnd = {
      'TRUE|TRUE': 'TRUE',
      'TRUE|FALSE': 'FALSE',
      'TRUE|UNKNOWN': 'UNKNOWN',
      'FALSE|TRUE': 'FALSE',
      'FALSE|FALSE': 'FALSE',
      'FALSE|UNKNOWN': 'FALSE',
      'UNKNOWN|TRUE': 'UNKNOWN',
      'UNKNOWN|FALSE': 'FALSE',
      'UNKNOWN|UNKNOWN': 'UNKNOWN',
    } as const;
    const expectedOr = {
      'TRUE|TRUE': 'TRUE',
      'TRUE|FALSE': 'TRUE',
      'TRUE|UNKNOWN': 'TRUE',
      'FALSE|TRUE': 'TRUE',
      'FALSE|FALSE': 'FALSE',
      'FALSE|UNKNOWN': 'UNKNOWN',
      'UNKNOWN|TRUE': 'TRUE',
      'UNKNOWN|FALSE': 'UNKNOWN',
      'UNKNOWN|UNKNOWN': 'UNKNOWN',
    } as const;
    const leftFeature = riskFeatures[0];
    const rightFeature = {
      ...riskFeatures[0],
      id: 'feature.risk.second_boolean.v1',
      logicalId: 'feature.risk.second_boolean',
      name: '第二布尔特征',
      source: { kind: 'column' as const, table: 'risk_transactions', column: 'second_boolean' },
    };
    for (const left of truthRows) {
      for (const right of truthRows) {
        const children = [
          {
            kind: 'condition' as const,
            nodeId: 'left',
            featureId: leftFeature.id,
            operator: 'is_true' as const,
          },
          {
            kind: 'condition' as const,
            nodeId: 'right',
            featureId: rightFeature.id,
            operator: 'is_true' as const,
          },
        ];
        const row = {
          [leftFeature.id]: left.raw,
          [rightFeature.id]: right.raw,
        };
        const key = `${left.truth}|${right.truth}` as keyof typeof expectedAnd;
        expect(evaluateRule(
          { ...highRiskRule, root: { kind: 'and', nodeId: 'and', children } },
          [leftFeature, rightFeature],
          row,
        ).value).toBe(expectedAnd[key]);
        expect(evaluateRule(
          { ...highRiskRule, root: { kind: 'or', nodeId: 'or', children } },
          [leftFeature, rightFeature],
          row,
        ).value).toBe(expectedOr[key]);
      }
      expect(evaluateRule(
        {
          ...highRiskRule,
          root: {
            kind: 'not',
            nodeId: 'not',
            child: {
              kind: 'condition',
              nodeId: 'value',
              featureId: leftFeature.id,
              operator: 'is_true',
            },
          },
        },
        [leftFeature],
        { [leftFeature.id]: left.raw },
      ).value).toBe(
        left.truth === 'TRUE' ? 'FALSE' : left.truth === 'FALSE' ? 'TRUE' : 'UNKNOWN',
      );
    }
  });

  it('uses rule thresholds as numeric state boundaries instead of raw values', () => {
    const amountFeature = riskFeatures[1];
    const amountRule: RuleDefinition = {
      ...highRiskRule,
      root: {
        kind: 'condition',
        nodeId: 'amount-threshold',
        featureId: amountFeature.id,
        operator: 'gt',
        value: 100000,
      },
    };
    const report = runInference({
      features: [amountFeature],
      rules: [amountRule],
      outcomes: [],
      selectedFeatureIds: [amountFeature.id],
      selectedRuleIds: [amountRule.id],
      rows: [10000, 50000, 90000, 180000].map(amount => ({
        [amountFeature.id]: amount,
      })),
      executedSql: 'SELECT transaction_amount FROM risk_transactions',
      params: [],
    });

    expect(report.candidates).toHaveLength(2);
    expect(report.candidates[0]).toMatchObject({ count: 3, probability: 0.75 });
    expect(report.candidates[0].states[0].label).toContain('100000');
    expect(report.candidates[0].ruleResults[0]).toMatchObject({
      trueCount: 0,
      falseCount: 3,
      unknownCount: 0,
    });
  });

  it('adds bounded logical-only combinations from declared feature domains', () => {
    const report = runInference({
      ...RISK_INFERENCE_WORKSPACE,
      selectedFeatureIds: RISK_INFERENCE_WORKSPACE.features.map(feature => feature.id),
      selectedRuleIds: RISK_INFERENCE_WORKSPACE.rules.map(rule => rule.id),
      outcomeId: RISK_INFERENCE_WORKSPACE.outcomes[0].id,
      rows: [],
      topK: 20,
      beamWidth: 5,
      executedSql: 'SELECT ... FROM _sys_ontology_risk_demo WHERE FALSE',
      params: [],
    });

    expect(report.knownPopulation).toBe(0);
    expect(report.candidates.length).toBeGreaterThan(0);
    expect(report.candidates.every(candidate =>
      candidate.evidenceKind === 'logical_only'
      && candidate.probability === 0,
    )).toBe(true);
    expect(report.truncated).toBe(true);
    expect(report.totalCandidateCount).toBeGreaterThan(report.beamWidth);
  });

  it('evaluates JSON-array set features with the same membership semantics as DuckDB', () => {
    const tags = RISK_INFERENCE_WORKSPACE.features.find(feature =>
      feature.valueType === 'set',
    )!;
    const tagsRule: RuleDefinition = {
      ...RISK_INFERENCE_WORKSPACE.rules[0],
      root: {
        kind: 'condition',
        nodeId: 'json-tag',
        featureId: tags.id,
        operator: 'contains',
        value: '白名单',
      },
    };

    expect(evaluateRule(
      tagsRule,
      RISK_INFERENCE_WORKSPACE.features,
      { [tags.id]: '["重点客户","白名单"]' },
    ).value).toBe('TRUE');
    expect(evaluateRule(
      tagsRule,
      RISK_INFERENCE_WORKSPACE.features,
      { [tags.id]: '[]' },
    ).value).toBe('FALSE');
  });

  it('keeps malformed non-null feature values in the UNKNOWN population', () => {
    const tags = RISK_INFERENCE_WORKSPACE.features.find(feature =>
      feature.valueType === 'set',
    )!;
    const tagsRule: RuleDefinition = {
      ...RISK_INFERENCE_WORKSPACE.rules[0],
      root: {
        kind: 'condition',
        nodeId: 'json-tag',
        featureId: tags.id,
        operator: 'contains',
        value: '白名单',
      },
    };

    const report = runInference({
      features: [tags],
      rules: [tagsRule],
      outcomes: [],
      selectedFeatureIds: [tags.id],
      selectedRuleIds: [tagsRule.id],
      rows: [
        { [tags.id]: '["白名单"]' },
        { [tags.id]: '{malformed-json' },
      ],
      executedSql: 'SELECT customer_tags FROM risk_transactions',
      params: [],
    });

    expect(report).toMatchObject({
      knownPopulation: 1,
      unknownPopulation: 1,
      unknownRate: 0.5,
      unknownReasons: [{
        featureId: tags.id,
        count: 1,
        reason: tags.nullSemantics,
      }],
    });
    expect(report.candidates.every(candidate =>
      candidate.states.every(state => state.label !== 'UNKNOWN'),
    )).toBe(true);
  });

  it('compiles only catalog-controlled computed expressions and functions', () => {
    const computedFeature: FeatureDefinition = {
      ...riskFeatures[1],
      id: 'feature.risk.normalized_amount.v1',
      logicalId: 'feature.risk.normalized_amount',
      name: '标准化交易金额',
      source: {
        kind: 'computed',
        table: 'risk_transactions',
        expression: 'coalesce(transaction_amount, 0)',
        dependencies: ['transaction_amount'],
        allowedFunctions: ['coalesce'],
      },
    };
    const computedRule: RuleDefinition = {
      ...highRiskRule,
      root: {
        kind: 'condition',
        nodeId: 'computed',
        featureId: computedFeature.id,
        operator: 'gt',
        value: 100000,
      },
    };

    expect(compileFeatureExpression(computedFeature)).toBe(
      '(coalesce(transaction_amount, 0))',
    );
    expect(compileRule(computedRule, [computedFeature]).predicateSql).toContain(
      'coalesce(transaction_amount, 0)',
    );
    expect(() => compileFeatureExpression({
      ...computedFeature,
      source: {
        ...computedFeature.source,
        expression: 'read_csv_auto(transaction_amount)',
      },
    })).toThrow('not system-controlled');
    expect(() => compileFeatureExpression({
      ...computedFeature,
      source: {
        ...computedFeature.source,
        expression: 'transaction_amount); DROP TABLE risk_transactions; --',
      },
    })).toThrow('unsafe');
    expect(() => compileFeatureExpression({
      ...computedFeature,
      source: {
        ...computedFeature.source,
        expression: 'read_csv_auto(transaction_amount)',
        allowedFunctions: ['read_csv_auto'],
      },
    })).toThrow('not system-controlled');
    expect(validateRule({
      ...computedRule,
      root: {
        kind: 'condition',
        nodeId: 'bad-number',
        featureId: computedFeature.id,
        operator: 'gt',
        value: 'not-a-number',
      },
    }, [computedFeature]).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid_value' }),
    ]));
  });

  it('rejects cyclic subrules, warns on deep trees, and keeps IDs stable across renames', () => {
    const ruleA: RuleDefinition = {
      ...highRiskRule,
      id: 'rule.risk.a.v1',
      logicalId: 'rule.risk.a',
      name: '规则甲',
      root: {
        kind: 'ruleRef',
        nodeId: 'a-to-b',
        ruleId: 'rule.risk.b.v1',
      },
    };
    const ruleB: RuleDefinition = {
      ...highRiskRule,
      id: 'rule.risk.b.v1',
      logicalId: 'rule.risk.b',
      name: '规则乙',
      root: {
        kind: 'ruleRef',
        nodeId: 'b-to-a',
        ruleId: ruleA.id,
      },
    };
    expect(validateRule(ruleA, riskFeatures, [ruleA, ruleB]).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'cyclic_rule_reference' }),
      ]),
    );

    const deepRule: RuleDefinition = {
      ...highRiskRule,
      root: {
        kind: 'not',
        nodeId: 'depth-1',
        child: {
          kind: 'not',
          nodeId: 'depth-2',
          child: {
            kind: 'not',
            nodeId: 'depth-3',
            child: {
              kind: 'not',
              nodeId: 'depth-4',
              child: {
                kind: 'condition',
                nodeId: 'depth-5',
                featureId: riskFeatures[0].id,
                operator: 'is_true',
              },
            },
          },
        },
      },
    };
    expect(validateRule(deepRule, riskFeatures).warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'deep_nesting' }),
      ]),
    );

    const beforeRename = compileRule(highRiskRule, riskFeatures);
    const renamedFeatures = riskFeatures.map(feature =>
      feature.id === riskFeatures[1].id
        ? { ...feature, name: '24小时交易金额' }
        : feature,
    );
    const afterRename = compileRule(
      { ...highRiskRule, name: '重点风险交易' },
      renamedFeatures,
    );
    expect(afterRename.fingerprint).toBe(beforeRename.fingerprint);
    expect(afterRename.lisp).toContain('24小时交易金额');
  });

  it('keeps explicitly configured expert priors separate from empirical probability', () => {
    const priorOutcome: OutcomeDefinition = {
      ...riskOutcome,
      labelBinding: undefined,
      expertPrior: {
        priorProbability: 0.2,
        likelihoods: [{
          featureId: riskFeatures[2].id,
          stateValue: '制裁',
          likelihoodRatio: 4,
        }],
      },
    };
    const report = runInference({
      features: riskFeatures,
      rules: [highRiskRule],
      outcomes: [priorOutcome],
      selectedFeatureIds: riskFeatures.map(feature => feature.id),
      selectedRuleIds: [highRiskRule.id],
      outcomeId: priorOutcome.id,
      rows: [{
        [riskFeatures[0].id]: true,
        [riskFeatures[1].id]: 180000,
        [riskFeatures[2].id]: '制裁',
        [riskFeatures[3].id]: [],
      }],
      executedSql: 'SELECT ...',
      params: [],
    });

    expect(report.candidates[0]).toMatchObject({
      evidenceKind: 'empirical_frequency',
      probability: 1,
      expertPriorProbability: 0.5,
    });
    expect(report.candidates[0].outcomeProbability).toBeUndefined();
  });

  it('keeps string and timestamp comparisons aligned with compiled DuckDB semantics', () => {
    const textFeature: FeatureDefinition = {
      ...riskFeatures[2],
      id: 'feature.risk.memo.v1',
      logicalId: 'feature.risk.memo',
      name: '交易备注',
      valueType: 'string',
      source: { kind: 'column', table: 'risk_transactions', column: 'memo' },
    };
    const timeFeature: FeatureDefinition = {
      ...riskFeatures[2],
      id: 'feature.risk.time.v1',
      logicalId: 'feature.risk.time',
      name: '交易时间',
      valueType: 'timestamp',
      source: { kind: 'column', table: 'risk_transactions', column: 'event_time' },
    };
    const stringRule: RuleDefinition = {
      ...highRiskRule,
      root: {
        kind: 'condition',
        nodeId: 'memo',
        featureId: textFeature.id,
        operator: 'contains',
        value: '紧急',
      },
    };
    const timeRule: RuleDefinition = {
      ...highRiskRule,
      root: {
        kind: 'condition',
        nodeId: 'time',
        featureId: timeFeature.id,
        operator: 'between',
        value: '2026-07-01T00:00:00Z',
        secondValue: '2026-08-01T00:00:00Z',
      },
    };

    expect(evaluateRule(
      stringRule,
      [textFeature],
      { [textFeature.id]: '需要紧急人工复核' },
    ).value).toBe('TRUE');
    expect(evaluateRule(
      timeRule,
      [timeFeature],
      { [timeFeature.id]: new Date('2026-07-30T12:00:00Z') },
    ).value).toBe('TRUE');
    expect(evaluateRule(
      { ...timeRule, root: { ...timeRule.root, operator: 'eq', value: '2026-07-30T12:00:00Z' } },
      [timeFeature],
      { [timeFeature.id]: new Date('2026-07-30T12:00:00Z') },
    ).value).toBe('TRUE');
  });

  it('compiles Ontology JSON properties and directed relations as native feature sources', () => {
    const propertyFeature: FeatureDefinition = {
      ...riskFeatures[1],
      id: 'feature.ontology.order.amount.v1',
      logicalId: 'feature.ontology.order.amount',
      source: {
        kind: 'ontology_property',
        table: 'life_object',
        jsonColumn: 'properties',
        propertyKey: 'amount',
      },
    };
    const relationFeature: FeatureDefinition = {
      ...riskFeatures[0],
      id: 'feature.ontology.order.has_payment.v1',
      logicalId: 'feature.ontology.order.has_payment',
      source: {
        kind: 'ontology_relation',
        table: 'life_object',
        objectIdColumn: 'id',
        linkTable: 'life_link',
        linkTypeId: 7,
        direction: 'incoming',
      },
    };

    expect(compileFeatureExpression(propertyFeature)).toContain(
      `TRY_CAST(json_extract_string("properties", '$."amount"') AS DOUBLE)`,
    );
    expect(compileFeatureExpression(relationFeature)).toContain(
      'CASE WHEN EXISTS (SELECT 1 FROM "life_link" AS "__ontology_link"',
    );
    expect(compileFeatureExpression(relationFeature)).toContain(
      '"__ontology_link"."target_object_id" = "__population"."id"',
    );
  });

  it('separates established, possible and excluded combinations and explains ranking', () => {
    const report = runInference({
      features: [riskFeatures[0], riskFeatures[2]],
      rules: [{
        ...highRiskRule,
        id: 'rule.allowed.v1',
        logicalId: 'rule.allowed',
        name: '可成立组合',
        root: {
          kind: 'and',
          nodeId: 'allowed-root',
          children: [
            { kind: 'condition', nodeId: 'fast', featureId: riskFeatures[0].id, operator: 'is_true' },
            { kind: 'condition', nodeId: 'address', featureId: riskFeatures[2].id, operator: 'eq', value: '高风险' },
          ],
        },
      }],
      outcomes: [],
      selectedFeatureIds: [riskFeatures[0].id, riskFeatures[2].id],
      selectedRuleIds: ['rule.allowed.v1'],
      rows: [
        { [riskFeatures[0].id]: true, [riskFeatures[2].id]: '高风险' },
        { [riskFeatures[0].id]: false, [riskFeatures[2].id]: '低风险' },
      ],
      topK: 20,
      beamWidth: 20,
      executedSql: 'SELECT real ontology facts',
      params: [],
      ranking: {
        featureReliability: {
          [riskFeatures[0].id]: 0.9,
          [riskFeatures[2].id]: 0.8,
        },
        manualWeights: { [riskFeatures[0].id]: 0.2 },
      },
    });

    expect(report.establishedCandidates).toHaveLength(1);
    expect(report.establishedCandidates[0].status).toBe('ESTABLISHED');
    expect(report.excludedCandidates.length).toBeGreaterThan(0);
    expect(report.excludedCandidates[0].status).toBe('EXCLUDED');
    expect(report.rankedCandidates[0].ranking).toMatchObject({
      evidenceCoverage: expect.any(Number),
      reliability: expect.any(Number),
      conditionSatisfaction: expect.any(Number),
      conflictPenalty: expect.any(Number),
      unknownPenalty: expect.any(Number),
      historicalValidation: expect.any(Number),
      manualWeight: expect.any(Number),
      score: expect.any(Number),
      reasons: expect.any(Array),
    });
  });

  it('keeps conflicting real evidence possible instead of trusting the first row', () => {
    const report = runInference({
      features: [riskFeatures[0], riskFeatures[2]],
      rules: [{
        ...highRiskRule,
        id: 'rule.conflicting.v1',
        logicalId: 'rule.conflicting',
        root: {
          kind: 'condition',
          nodeId: 'address-condition',
          featureId: riskFeatures[2].id,
          operator: 'eq',
          value: '高风险',
        },
      }],
      outcomes: [],
      selectedFeatureIds: [riskFeatures[0].id],
      selectedRuleIds: ['rule.conflicting.v1'],
      rows: [
        { [riskFeatures[0].id]: true, [riskFeatures[2].id]: '高风险' },
        { [riskFeatures[0].id]: true, [riskFeatures[2].id]: '低风险' },
      ],
      topK: 10,
      beamWidth: 10,
      executedSql: 'SELECT real ontology facts',
      params: [],
    });

    expect(report.possibleCandidates).toHaveLength(1);
    expect(report.possibleCandidates[0].ruleResults[0]).toMatchObject({
      trueCount: 1,
      falseCount: 1,
      trace: { value: 'UNKNOWN' },
    });
    expect(report.possibleCandidates[0].ranking.conflictPenalty).toBe(1);
  });
});
