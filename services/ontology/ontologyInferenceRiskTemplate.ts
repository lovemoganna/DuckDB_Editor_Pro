import type {
  FeatureDefinition,
  OutcomeDefinition,
  RuleDefinition,
} from './ontologyInferenceEngine';
import type { InferenceWorkspace } from './ontologyInferenceModule';

const FEATURE_IDS = {
  fast: 'feature.risk.fast_in_fast_out.v1',
  amount: 'feature.risk.transaction_amount.v1',
  addressRisk: 'feature.risk.address_risk.v1',
  customerTags: 'feature.risk.customer_tags.v1',
} as const;

const RULE_ID = 'rule.risk.high_risk_transaction.v1';
const OUTCOME_ID = 'outcome.risk.confirmed_high_risk_transaction.v1';
const DEMO_TABLE = '_sys_ontology_risk_demo';

export const RISK_TEMPLATE_FEATURES: FeatureDefinition[] = [
  {
    id: FEATURE_IDS.fast,
    logicalId: 'feature.risk.fast_in_fast_out',
    version: 1,
    name: '快进快出',
    description: '资金在短时间内快速转入并转出的行为特征。',
    valueType: 'boolean',
    objectTypeId: 1,
    source: {
      kind: 'column',
      table: DEMO_TABLE,
      column: 'fast_in_fast_out',
    },
    nullSemantics: '缺少完整资金流水时返回 UNKNOWN，不推断为否。',
    window: { value: 30, unit: 'minute' },
    domain: [true, false],
    status: 'active',
  },
  {
    id: FEATURE_IDS.amount,
    logicalId: 'feature.risk.transaction_amount',
    version: 1,
    name: '交易金额',
    description: '当前交易的人民币计价金额。',
    valueType: 'number',
    objectTypeId: 1,
    source: {
      kind: 'column',
      table: DEMO_TABLE,
      column: 'transaction_amount',
    },
    nullSemantics: '金额缺失时返回 UNKNOWN，不按零金额处理。',
    domain: [20000, 50000, 180000],
    status: 'active',
  },
  {
    id: FEATURE_IDS.addressRisk,
    logicalId: 'feature.risk.address_risk',
    version: 1,
    name: '地址风险',
    description: '交易对手地址经过合规名单与风险情报归一后的等级。',
    valueType: 'category',
    objectTypeId: 1,
    source: {
      kind: 'column',
      table: DEMO_TABLE,
      column: 'address_risk',
    },
    nullSemantics: '没有可核验的地址情报时返回 UNKNOWN。',
    domain: ['低风险', '高风险', '制裁'],
    status: 'active',
  },
  {
    id: FEATURE_IDS.customerTags,
    logicalId: 'feature.risk.customer_tags',
    version: 1,
    name: '客户标签',
    description: '客户当前有效的业务标签集合，示例使用 JSON 数组存储。',
    valueType: 'set',
    objectTypeId: 1,
    source: {
      kind: 'column',
      table: DEMO_TABLE,
      column: 'customer_tags',
      encoding: 'json_array',
    },
    nullSemantics: '标签记录缺失时返回 UNKNOWN；空数组仅表示已确认没有标签。',
    domain: [[], ['白名单']],
    status: 'active',
  },
];
export const RISK_TEMPLATE_RULES: RuleDefinition[] = [
  {
    id: RULE_ID,
    logicalId: 'rule.risk.high_risk_transaction',
    version: 1,
    name: '高风险交易',
    description: '大额快进快出，且涉及高风险或制裁地址，同时排除白名单客户。',
    status: 'active',
    outcomeId: OUTCOME_ID,
    root: {
      kind: 'and',
      nodeId: 'high-risk-root',
      children: [
        {
          kind: 'condition',
          nodeId: 'fast-in-fast-out',
          featureId: FEATURE_IDS.fast,
          operator: 'is_true',
        },
        {
          kind: 'condition',
          nodeId: 'large-amount',
          featureId: FEATURE_IDS.amount,
          operator: 'gt',
          value: 100000,
        },
        {
          kind: 'or',
          nodeId: 'risky-address',
          children: [
            {
              kind: 'condition',
              nodeId: 'high-risk-address',
              featureId: FEATURE_IDS.addressRisk,
              operator: 'eq',
              value: '高风险',
            },
            {
              kind: 'condition',
              nodeId: 'sanctioned-address',
              featureId: FEATURE_IDS.addressRisk,
              operator: 'eq',
              value: '制裁',
            },
          ],
        },
        {
          kind: 'not',
          nodeId: 'exclude-whitelist',
          child: {
            kind: 'condition',
            nodeId: 'whitelisted-customer',
            featureId: FEATURE_IDS.customerTags,
            operator: 'contains',
            value: '白名单',
          },
        },
      ],
    },
  },
];

export const RISK_TEMPLATE_OUTCOMES: OutcomeDefinition[] = [
  {
    id: OUTCOME_ID,
    logicalId: 'outcome.risk.confirmed_high_risk_transaction',
    version: 1,
    name: '确认高风险交易',
    description: '人工复核或后续处置确认的高风险交易标签。',
    objectTypeId: 1,
    mode: 'classification',
    ruleId: RULE_ID,
    labelBinding: {
      table: DEMO_TABLE,
      column: 'confirmed_high_risk',
      positiveValue: true,
      subjectKey: 'transaction_id',
      eventTimeColumn: 'occurred_at',
    },
    status: 'active',
  },
];

export const RISK_INFERENCE_WORKSPACE: InferenceWorkspace = {
  features: RISK_TEMPLATE_FEATURES,
  rules: RISK_TEMPLATE_RULES,
  outcomes: RISK_TEMPLATE_OUTCOMES,
};

export const RISK_TEMPLATE_DATA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS ${DEMO_TABLE} (
    transaction_id VARCHAR PRIMARY KEY,
    occurred_at TIMESTAMP NOT NULL,
    fast_in_fast_out BOOLEAN,
    transaction_amount DOUBLE,
    address_risk VARCHAR,
    customer_tags VARCHAR,
    confirmed_high_risk BOOLEAN
  )`,
  `INSERT INTO ${DEMO_TABLE}
    SELECT
      'risk-demo-' || LPAD(CAST(i AS VARCHAR), 3, '0'),
      TIMESTAMP '2026-01-01 00:00:00' + i * INTERVAL '1 hour',
      CASE WHEN i >= 43 THEN NULL WHEN i < 30 THEN TRUE ELSE FALSE END,
      CASE WHEN i < 18 OR i >= 43 THEN 180000 WHEN i < 30 THEN 50000 ELSE 20000 END,
      CASE WHEN i < 18 OR i >= 43 THEN '制裁' ELSE '低风险' END,
      CASE WHEN i >= 30 AND i < 43 THEN '["白名单"]' ELSE '[]' END,
      CASE WHEN i < 14 OR i >= 43 THEN TRUE ELSE FALSE END
    FROM range(48) AS demo(i)
    WHERE NOT EXISTS (
      SELECT 1
      FROM ${DEMO_TABLE} AS existing
      WHERE existing.transaction_id = 'risk-demo-' || LPAD(CAST(i AS VARCHAR), 3, '0')
    )`,
];
