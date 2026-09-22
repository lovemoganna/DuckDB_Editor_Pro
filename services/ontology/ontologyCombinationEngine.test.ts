import { describe, expect, it } from 'vitest';
import {
  createCustomCombination,
  createCustomFeature,
  extractOntologyFeatures,
  generateDynamicDemoCasesFromActiveOntology,
  generateExplanation,
  generateFeatureCombinations,
  PRESET_DEMO_CASES,
  queryFeatureCombinationMetrics,
  type OntologyFeature,
} from './ontologyCombinationEngine';
import { type OntologyProjectionSource } from './ontologyReasoningModule';

describe('ontologyCombinationEngine — 动态自然语言与句式去重生成引擎', () => {
  const mockSource: OntologyProjectionSource = {
    activeTemplateId: 'ecommerce-test',
    objectTypes: [
      { id: 1, name: 'Customer', description: '客户实体' },
      { id: 2, name: 'Order', description: '订单实体' },
    ],
    objects: [
      { id: 10, object_type_id: 1, name: 'Customer A', properties: JSON.stringify({ vipLevel: 'Gold', creditScore: 780 }), annotations: '' },
      { id: 20, object_type_id: 2, name: 'Order #1001', properties: JSON.stringify({ amount: 1500, isFlagged: false }), annotations: '' },
    ],
    linkTypes: [
      { id: 101, name: 'placed_order', description: '客户下单关系' },
    ],
    links: [
      { id: 1001, link_type_id: 101, source_object_id: 10, target_object_id: 20 },
    ],
    actions: [],
  };

  it('同一事实输入不会靠轮换动词伪造不同意图', () => {
    const features: OntologyFeature[] = [
      { id: 'f1', kind: 'entity', name: '客户', categoryLabel: '实体概念', description: '', sourceType: 'objectType', meta: {} },
      { id: 'f2', kind: 'property', name: '会员等级', categoryLabel: '属性特征', description: '', sourceType: 'property', meta: {} },
      { id: 'f3', kind: 'property', name: '消费金额', categoryLabel: '属性特征', description: '', sourceType: 'property', meta: {} },
    ];

    const first = generateExplanation(features, mockSource, 0);
    const second = generateExplanation(features, mockSource, 7);
    expect(second).toEqual(first);
  });

  it('同一种特征在不同组合中产生不同的情境解释', () => {
    const customerFeat: OntologyFeature = { id: 'f1', kind: 'entity', name: '客户', categoryLabel: '实体概念', description: '', sourceType: 'objectType', meta: {} };
    const levelFeat: OntologyFeature = { id: 'f2', kind: 'property', name: '会员等级', categoryLabel: '属性特征', description: '', sourceType: 'property', meta: {} };
    const moneyFeat: OntologyFeature = { id: 'f3', kind: 'property', name: '消费金额', categoryLabel: '属性特征', description: '', sourceType: 'property', meta: {} };
    const riskFeat: OntologyFeature = { id: 'f4', kind: 'property', name: '黑名单风险', categoryLabel: '属性特征', description: '', sourceType: 'property', meta: {} };

    const combo1 = generateExplanation([customerFeat, levelFeat, moneyFeat], mockSource, 0);
    const combo2 = generateExplanation([customerFeat, riskFeat], mockSource, 1);

    expect(combo1.explanation).not.toEqual(combo2.explanation);
  });

  it('信息不足时明确说明数据不足，拒绝编造虚假意义', () => {
    const abstractFeat1: OntologyFeature = { id: 'a1', kind: 'custom', name: 'X1', categoryLabel: '自定义', description: '', sourceType: 'custom', meta: {} };
    const abstractFeat2: OntologyFeature = { id: 'a2', kind: 'custom', name: 'Y2', categoryLabel: '自定义', description: '', sourceType: 'custom', meta: {} };

    const emptySource: OntologyProjectionSource = { activeTemplateId: 'empty', objectTypes: [], objects: [], linkTypes: [], links: [], actions: [] };
    const result = generateExplanation([abstractFeat1, abstractFeat2], emptySource, 0);

    expect(result.explanation).toContain('当前无法判断');
    expect(result.explanation).toContain('没有可追溯的 Ontology 定义或对象事实');
  });

  it('严禁输出任何空泛套话（如多维交叉、结构关联、综合状态）', () => {
    const features: OntologyFeature[] = [
      { id: 'f1', kind: 'entity', name: '人员', categoryLabel: '实体概念', description: '', sourceType: 'objectType', meta: {} },
      { id: 'f2', kind: 'entity', name: '操作', categoryLabel: '实体概念', description: '', sourceType: 'objectType', meta: {} },
      { id: 'f3', kind: 'entity', name: '结果', categoryLabel: '实体概念', description: '', sourceType: 'objectType', meta: {} },
    ];

    const result = generateExplanation(features, mockSource, 0);

    expect(result.intent).not.toContain('多维交叉');
    expect(result.intent).not.toContain('结构关联');
    expect(result.explanation).not.toContain('综合状态');
    expect(result.explanation).not.toContain('边缘形态');
    expect(result.explanation).not.toContain('多特征映射');
  });

  it('does not inject fixed-domain demos into an empty or unfamiliar ontology', () => {
    const emptySource: OntologyProjectionSource = {
      activeTemplateId: 'empty',
      objectTypes: [],
      objects: [],
      linkTypes: [],
      links: [],
      actions: [],
    };
    expect(generateDynamicDemoCasesFromActiveOntology(emptySource)).toEqual([]);

    const unfamiliarSource: OntologyProjectionSource = {
      activeTemplateId: 'orbital-ecology',
      objectTypes: [{ id: 91, name: 'CryospherePatch', description: 'A measured ice region' }],
      objects: [{
        id: 910,
        object_type_id: 91,
        name: 'Patch-Zeta',
        properties: { albedoFlux: 0.41 },
      }],
      linkTypes: [],
      links: [],
      actions: [],
    };
    const demos = generateDynamicDemoCasesFromActiveOntology(unfamiliarSource);
    expect(demos.length).toBeGreaterThan(0);
    expect(demos.every(demo => demo.id.startsWith('active_demo_'))).toBe(true);
    expect(demos.flatMap(demo => demo.features).every(feature =>
      feature.name === 'CryospherePatch' || feature.name === 'albedoFlux' || feature.name === 'Patch-Zeta'
    )).toBe(true);
  });

  it('requires selected relation facts before claiming matching evidence', () => {
    const source: OntologyProjectionSource = {
      activeTemplateId: 'orbital-ecology',
      objectTypes: [
        { id: 91, name: 'CryospherePatch' },
        { id: 92, name: 'SensorArc' },
      ],
      objects: [
        { id: 910, object_type_id: 91, name: 'Patch-Zeta', properties: { albedoFlux: 0.41 } },
        { id: 920, object_type_id: 92, name: 'Arc-Nu', properties: { phaseIndex: 7 } },
      ],
      linkTypes: [{ id: 901, name: 'phaseCouples' }],
      links: [],
      actions: [],
    };
    const features: OntologyFeature[] = [
      { id: 'entity_91', kind: 'entity', name: 'CryospherePatch', categoryLabel: 'entity', description: '', sourceType: 'objectType', meta: { objectTypeId: 91 } },
      { id: 'relation_901', kind: 'relation', name: 'phaseCouples', categoryLabel: 'relation', description: '', sourceType: 'linkType', meta: { linkTypeId: 901 } },
    ];

    expect(queryFeatureCombinationMetrics(features, source).matchingObjectsCount).toBe(0);

    const linkedSource: OntologyProjectionSource = {
      ...source,
      links: [{ id: 1, link_type_id: 901, source_object_id: 910, target_object_id: 920 }],
    };
    expect(queryFeatureCombinationMetrics(features, linkedSource).matchingObjectsCount).toBe(1);
  });

  it('explains an unfamiliar domain from structure and facts without keyword hallucination', () => {
    const source: OntologyProjectionSource = {
      activeTemplateId: 'orbital-ecology',
      objectTypes: [{ id: 91, name: 'CryospherePatch' }],
      objects: [{ id: 910, object_type_id: 91, name: 'Patch-Zeta', properties: { albedoFlux: 0.41 } }],
      linkTypes: [],
      links: [],
      actions: [],
    };
    const features = extractOntologyFeatures(source).filter(feature =>
      feature.id === 'entity_91' || feature.id === 'prop_albedoFlux'
    );

    const result = generateExplanation(features, source, 0);
    expect(result.intent).toContain('CryospherePatch');
    expect(result.intent).toContain('albedoFlux');
    expect(result.explanation).toContain('实际读取当前 Ontology 的 1 个对象和 0 条关系');
    expect(result.explanation).toContain('得到 1 个对象');
    expect(result.explanation).toContain('不证明因果、风险或业务影响');
    expect(result.explanation).not.toMatch(/客户|交易|健康|项目|睡眠|风险记录/);
  });
});
