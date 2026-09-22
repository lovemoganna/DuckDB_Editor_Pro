/**
 * ontologyCombinationEngine.ts — 基于当前 Ontology 事实的特征组合与覆盖说明
 *
 * 核心设计原则：
 * 1. 不绑定固定业务规矩，根据当前 Ontology 动态合成
 * 2. 真实数据透视：打通 DuckDB / Ontology 实体数据，直接统计真实记录数与占比
 * 3. 不根据字段名称猜测业务意图，不把匹配数量解释成因果或影响
 * 4. 动态案例只从当前活跃 Ontology 抽取，固定教学案例不进入正式运行链路
 * 5. 数据不足时明确返回“当前无法判断”
 * 6. 支持内联编辑与修改保护
 */

import { OntologyProjectionSource } from './ontologyReasoningModule';

export type FeatureKind = 'entity' | 'property' | 'relation' | 'instance' | 'custom';

export interface OntologyFeature {
  id: string;
  kind: FeatureKind;
  name: string;
  categoryLabel: string;
  description: string;
  sourceType: 'objectType' | 'property' | 'linkType' | 'object' | 'link' | 'custom';
  isCustom?: boolean;
  meta: {
    objectTypeId?: number;
    propertyKey?: string;
    linkTypeId?: number;
    objectId?: number;
    dataType?: string;
    sampleValue?: unknown;
  };
}

export interface CombinationMetrics {
  totalObjectsCount: number;
  matchingObjectsCount: number;
  matchRatioPercentage: number;
  sampleValuesText?: string;
}

export interface FeatureCombination {
  id: string;
  title: string;
  features: OntologyFeature[];
  explanation: {
    combinedFeaturesSummary: string; // 组合包含的特征
    intent: string;                  // 🎯 意图
    explanation: string;             // 💡 解释
  };
  metrics?: CombinationMetrics;      // 真实 DuckDB 数据例证指标
  tags: string[];
  cohesionScore: number;
  createdAt: number;
  parentId?: string;
  isCustom?: boolean;
  isHumanEdited?: boolean;
}

export interface PresetDemoCase {
  id: string;
  title: string;
  industry: string;
  icon: string;
  description: string;
  features: OntologyFeature[];
  combinationTitle: string;
  intent: string;
  explanation: string;
  tags: string[];
}

/**
 * 从 OntologyProjectionSource 中提取可用特征
 */
export function extractOntologyFeatures(source: OntologyProjectionSource): OntologyFeature[] {
  const features: OntologyFeature[] = [];

  // 1. 概念/实体类型特征 (Object Types)
  const objectTypes = source.objectTypes ?? [];
  objectTypes.forEach(ot => {
    features.push({
      id: `entity_${ot.id}`,
      kind: 'entity',
      name: ot.name,
      categoryLabel: '实体概念',
      description: ot.description || `Ontology 中的实体概念 [${ot.name}]`,
      sourceType: 'objectType',
      meta: { objectTypeId: ot.id },
    });
  });

  // 2. 属性特征 (Properties)
  const propertyKeyMap = new Map<string, { objectTypeNames: string[]; sampleValues: Set<unknown> }>();

  (source.objects ?? []).forEach(obj => {
    if (!obj.properties) return;
    try {
      const parsed = typeof obj.properties === 'string' ? JSON.parse(obj.properties) : obj.properties;
      if (parsed && typeof parsed === 'object') {
        const otName = objectTypes.find(t => t.id === obj.object_type_id)?.name ?? '未知实体';
        Object.entries(parsed).forEach(([key, val]) => {
          if (!propertyKeyMap.has(key)) {
            propertyKeyMap.set(key, { objectTypeNames: [], sampleValues: new Set() });
          }
          const info = propertyKeyMap.get(key)!;
          if (!info.objectTypeNames.includes(otName)) {
            info.objectTypeNames.push(otName);
          }
          if (val !== undefined && val !== null && info.sampleValues.size < 3) {
            info.sampleValues.add(val);
          }
        });
      }
    } catch {
      // 忽略解析错误
    }
  });

  propertyKeyMap.forEach((info, key) => {
    const samples = Array.from(info.sampleValues).map(v => String(v)).join(', ');
    features.push({
      id: `prop_${key}`,
      kind: 'property',
      name: `${key}`,
      categoryLabel: '属性特征',
      description: `属于 ${info.objectTypeNames.join('/')} 的关键属性 (样例: ${samples || '无'})`,
      sourceType: 'property',
      meta: {
        propertyKey: key,
        sampleValue: Array.from(info.sampleValues)[0],
      },
    });
  });

  // 3. 关联关系特征 (Link Types)
  const linkTypes = source.linkTypes ?? [];
  linkTypes.forEach(lt => {
    features.push({
      id: `relation_${lt.id}`,
      kind: 'relation',
      name: lt.name,
      categoryLabel: '关联关系',
      description: lt.description || `描述实体间的 [${lt.name}] 连接关系`,
      sourceType: 'linkType',
      meta: { linkTypeId: lt.id },
    });
  });

  // 4. 关键对象实例特征 (Objects)
  const objects = source.objects ?? [];
  objects.slice(0, 30).forEach(obj => {
    const otName = objectTypes.find(t => t.id === obj.object_type_id)?.name ?? '实例';
    features.push({
      id: `instance_${obj.id}`,
      kind: 'instance',
      name: `${obj.name}`,
      categoryLabel: `${otName} 实例`,
      description: `对象实例 #${obj.id} (${otName})`,
      sourceType: 'object',
      meta: { objectTypeId: obj.object_type_id, objectId: obj.id },
    });
  });

  return features;
}

/**
 * 实时统计特征组合在真实数据集中的量化例证指标 (DuckDB Data Coupling)
 */
export function queryFeatureCombinationMetrics(
  features: OntologyFeature[],
  source: OntologyProjectionSource
): CombinationMetrics {
  const allObjects = source.objects ?? [];
  const totalCount = allObjects.length;

  if (totalCount === 0 || features.length === 0) {
    return {
      totalObjectsCount: 0,
      matchingObjectsCount: 0,
      matchRatioPercentage: 0,
      sampleValuesText: '暂无真实数据记录',
    };
  }

  const propKeys = features.filter(f => f.kind === 'property').map(f => f.meta.propertyKey).filter(Boolean) as string[];
  const targetTypeIds = features.filter(f => f.kind === 'entity').map(f => f.meta.objectTypeId).filter(Boolean) as number[];
  const targetObjectIds = features.filter(f => f.kind === 'instance').map(f => f.meta.objectId).filter(Boolean) as number[];
  const relationTypeIds = features.filter(f => f.kind === 'relation').map(f => f.meta.linkTypeId).filter(Boolean) as number[];
  const links = source.links ?? [];

  let matchingCount = 0;
  const sampleValues: string[] = [];

  allObjects.forEach(obj => {
    let match = true;

    if (targetTypeIds.length > 0 && !targetTypeIds.includes(obj.object_type_id)) {
      match = false;
    }

    if (match && targetObjectIds.length > 0 && !targetObjectIds.includes(obj.id)) {
      match = false;
    }

    if (match && relationTypeIds.length > 0) {
      const participatesInEverySelectedRelation = relationTypeIds.every(linkTypeId =>
        links.some(link =>
          link.link_type_id === linkTypeId
          && (link.source_object_id === obj.id || link.target_object_id === obj.id)
        )
      );
      if (!participatesInEverySelectedRelation) match = false;
    }

    if (match && propKeys.length > 0 && obj.properties) {
      try {
        const parsed = typeof obj.properties === 'string' ? JSON.parse(obj.properties) : obj.properties;
        if (parsed && typeof parsed === 'object') {
          const hasProps = propKeys.every(k => Object.prototype.hasOwnProperty.call(parsed, k));
          if (!hasProps) match = false;
          else if (sampleValues.length < 2) {
            propKeys.forEach(k => {
              if (parsed[k] !== undefined && parsed[k] !== null) {
                sampleValues.push(`${k}: ${parsed[k]}`);
              }
            });
          }
        } else {
          match = false;
        }
      } catch {
        match = false;
      }
    }

    if (match) matchingCount++;
  });

  const ratio = totalCount > 0 ? Number(((matchingCount / totalCount) * 100).toFixed(1)) : 0;

  return {
    totalObjectsCount: totalCount,
    matchingObjectsCount: matchingCount,
    matchRatioPercentage: ratio,
    sampleValuesText: sampleValues.length > 0 ? sampleValues.slice(0, 2).join(', ') : undefined,
  };
}

/**
 * 根据当前活跃 Ontology 动态提取合成探查案例 (非硬编码)
 */
export function generateDynamicDemoCasesFromActiveOntology(source: OntologyProjectionSource): PresetDemoCase[] {
  const allFeatures = extractOntologyFeatures(source);
  if (allFeatures.length === 0) return [];

  const objectTypes = source.objectTypes ?? [];
  const linkTypes = source.linkTypes ?? [];

  const cases: PresetDemoCase[] = [];

  // 案例 1：当前模型的核心实体与属性组合
  if (objectTypes.length > 0) {
    const mainOt = objectTypes[0];
    const relatedFeats = allFeatures.filter(f =>
      f.meta.objectTypeId === mainOt.id || f.description.includes(mainOt.name)
    ).slice(0, 3);

    if (relatedFeats.length > 0) {
      cases.push({
        id: `active_demo_1_${mainOt.id}`,
        title: `核心场景：${mainOt.name} 特征聚合探查`,
        industry: '当前模型',
        icon: '📊',
        description: `自动萃取自当前 Ontology 核心实体 [${mainOt.name}] 的关键探查组合。`,
        features: relatedFeats,
        combinationTitle: `${mainOt.name} · 核心全景`,
        intent: `排查 ${mainOt.name} 在当前拓扑中的关键数据状态。`,
        explanation: `将 ${mainOt.name} 及其关联指标连起来，直观查看具体数据分布与表现。`,
        tags: ['#当前拓扑', '#核心实体'],
      });
    }
  }

  // 案例 2：跨实体关联探查
  if (linkTypes.length > 0) {
    const mainLt = linkTypes[0];
    const linkFeat = allFeatures.find(f => f.kind === 'relation' && f.meta.linkTypeId === mainLt.id);
    const entityFeats = allFeatures.filter(f => f.kind === 'entity').slice(0, 2);

    if (linkFeat && entityFeats.length > 0) {
      const comboFeats = [...entityFeats, linkFeat];
      cases.push({
        id: `active_demo_2_${mainLt.id}`,
        title: `关联路径：${mainLt.name} 链路穿透`,
        industry: '图谱关联',
        icon: '🔗',
        description: `基于关联路径 [${mainLt.name}] 的穿透探索。`,
        features: comboFeats,
        combinationTitle: `${mainLt.name} · 拓扑路径`,
        intent: `分析实体之间通过 ${mainLt.name} 产生连接时的影响过程。`,
        explanation: `打通实体与 ${mainLt.name} 路径，一眼看清节点之间的依赖与传导。`,
        tags: ['#拓扑路径', '#关联穿透'],
      });
    }
  }

  return cases;
}

export const PRESET_DEMO_CASES: PresetDemoCase[] = [
  {
    id: 'ecommerce_vip_order',
    title: '商业电商：VIP客户 × 大额订单交易路径',
    industry: '电商运营',
    icon: '🛒',
    description: '展示商业对象分层（VIP客户）与核心指标（订单金额）及交易关系的拓扑组合。',
    features: [
      { id: 'demo_ecom_1', kind: 'entity', name: '客户', categoryLabel: '实体概念', description: '电商平台注册客户对象', sourceType: 'objectType', meta: {} },
      { id: 'demo_ecom_2', kind: 'property', name: '会员等级', categoryLabel: '属性特征', description: '客户的会员分层标签', sourceType: 'property', meta: {} },
      { id: 'demo_ecom_3', kind: 'entity', name: '订单', categoryLabel: '实体概念', description: '平台交易订单实体', sourceType: 'objectType', meta: {} },
      { id: 'demo_ecom_4', kind: 'relation', name: '下单关系', categoryLabel: '关联关系', description: '客户连接订单的交易链路', sourceType: 'linkType', meta: {} },
    ],
    combinationTitle: 'VIP客户 × 高额交易路径',
    intent: '排查 VIP 高价值客户的大额消费轨迹，看核心用户群体的实时交易表现。',
    explanation: '把会员等级、订单金额和下单关系串在一起，一眼搞懂大额消费都是哪些 VIP 客户产生的。',
    tags: ['#高价值客户', '#交易路径', '#商业分层'],
  },
  {
    id: 'health_sleep_heartrate',
    title: '医疗健康：睡眠恢复 × 生理指标联动',
    industry: '健康管理',
    icon: '🏥',
    description: '展示体征指标（睡眠时长/心率波动/卡路里）在个人生理状态分析中的交叉组合。',
    features: [
      { id: 'demo_health_1', kind: 'entity', name: '健康日志', categoryLabel: '实体概念', description: '每日体征追踪对象', sourceType: 'objectType', meta: {} },
      { id: 'demo_health_2', kind: 'property', name: '睡眠时长', categoryLabel: '属性特征', description: '夜间总睡眠小时数', sourceType: 'property', meta: {} },
      { id: 'demo_health_3', kind: 'property', name: '静息心率', categoryLabel: '属性特征', description: '静息状态心率波动', sourceType: 'property', meta: {} },
      { id: 'demo_health_4', kind: 'property', name: '消耗卡路里', categoryLabel: '属性特征', description: '日间运动卡路里消耗量', sourceType: 'property', meta: {} },
    ],
    combinationTitle: '睡眠深度 × 运动负荷平衡',
    intent: '观察昨晚睡眠充不充分，以及对今天运动心率和卡路里消耗的影响。',
    explanation: '把睡眠时间与心率运动量放在一起，如果昨晚没睡够、今天运动心率又飚高，说明身体超负荷了。',
    tags: ['#体征联动', '#恢复负荷', '#健康因子'],
  },
  {
    id: 'it_infra_risk',
    title: 'IT系统运维：数据库延时 × 依赖链路传导',
    industry: 'IT运维与风险',
    icon: '⚙️',
    description: '展示核心数据库性能瓶颈沿系统依赖拓扑向业务服务演变传导的风险组合。',
    features: [
      { id: 'demo_it_1', kind: 'entity', name: '核心数据库', categoryLabel: '实体概念', description: '后端数据存储节点', sourceType: 'objectType', meta: {} },
      { id: 'demo_it_2', kind: 'property', name: '查询延时', categoryLabel: '属性特征', description: '数据库执行延时', sourceType: 'property', meta: {} },
      { id: 'demo_it_3', kind: 'relation', name: '依赖关系', categoryLabel: '关联关系', description: '服务对数据库的拓扑调用关系', sourceType: 'linkType', meta: {} },
      { id: 'demo_it_4', kind: 'entity', name: '业务服务', categoryLabel: '实体概念', description: '面向用户的 API 服务', sourceType: 'objectType', meta: {} },
    ],
    combinationTitle: '数据库性能瓶颈 × 服务依赖传导',
    intent: '抓取底层数据库变卡时，向上拖慢了哪些上游 API 业务接口。',
    explanation: '把故障源头、延时指标与调用关系连起来，直接展示性能瓶颈会扩散影响到哪些前端服务。',
    tags: ['#故障传导', '#依赖关系', '#风险链条'],
  },
  {
    id: 'project_task_milestone',
    title: '项目管理：关键里程碑 × 阻塞任务剖析',
    industry: '项目协作',
    icon: '📅',
    description: '展示任务阻塞状态与责任人分派对关键工程里程碑交付落地的阻断组合。',
    features: [
      { id: 'demo_proj_1', kind: 'entity', name: '里程碑', categoryLabel: '实体概念', description: '项目关键交付时间点', sourceType: 'objectType', meta: {} },
      { id: 'demo_proj_2', kind: 'property', name: '阻塞状态', categoryLabel: '属性特征', description: '任务是否处于 Block 状态', sourceType: 'property', meta: {} },
      { id: 'demo_proj_3', kind: 'relation', name: '责任分派', categoryLabel: '关联关系', description: '任务到具体开发者的归属关系', sourceType: 'linkType', meta: {} },
      { id: 'demo_proj_4', kind: 'entity', name: '开发者', categoryLabel: '实体概念', description: '具体任务执行人员', sourceType: 'objectType', meta: {} },
    ],
    combinationTitle: '阻塞卡点 × 里程碑交付风险',
    intent: '定位项目发布延迟的原因，看是不是卡在某个关键人员手里的阻塞任务上。',
    explanation: '打通里程碑、阻塞任务与开发者，项目落后时能立刻看出是哪个开发人员负责的卡点任务拖累了进度。',
    tags: ['#项目卡点', '#关键路径', '#资源分配'],
  },
];

/**
 * 创建自定义特征
 */
export function createCustomFeature(
  name: string,
  kind: FeatureKind = 'custom',
  description?: string,
  sampleValue?: string
): OntologyFeature {
  const now = Date.now();
  return {
    id: `custom_feat_${now}_${Math.random().toString(36).substring(2, 7)}`,
    kind: kind,
    name: name.trim(),
    categoryLabel: kind === 'custom' ? '自定义特征' : KIND_LABEL_MAP[kind],
    description: description?.trim() || `用户自定义扩展特征 [${name.trim()}]`,
    sourceType: 'custom',
    isCustom: true,
    meta: {
      sampleValue: sampleValue?.trim() || undefined,
    },
  };
}

const KIND_LABEL_MAP: Record<FeatureKind, string> = {
  entity: '实体概念',
  property: '属性特征',
  relation: '关联关系',
  instance: '实例节点',
  custom: '自定义特征',
};

/**
 * 手动创建自定义特征组合
 */
export function createCustomCombination(
  title: string,
  features: OntologyFeature[],
  source: OntologyProjectionSource,
  customExplanation?: { summary?: string; intent?: string; explanation?: string },
  customTags?: string[]
): FeatureCombination {
  const now = Date.now();
  const autoExplanation = generateExplanation(features, source, 0);
  const metrics = queryFeatureCombinationMetrics(features, source);

  return {
    id: `combo_custom_${now}_${Math.random().toString(36).substring(2, 7)}`,
    title: title.trim() || `${features.map(f => f.name).join(' × ')} · 组合探查`,
    features: [...features],
    explanation: {
      combinedFeaturesSummary: customExplanation?.summary?.trim() || autoExplanation.combinedFeaturesSummary,
      intent: customExplanation?.intent?.trim() || autoExplanation.intent,
      explanation: customExplanation?.explanation?.trim() || autoExplanation.explanation,
    },
    metrics,
    tags: customTags && customTags.length > 0 ? customTags : [...recommendTags(features, 'multi'), '#自定义组合'],
    cohesionScore: calculateCohesion(features, source),
    createdAt: now,
    isCustom: true,
    isHumanEdited: Boolean(customExplanation?.intent || customExplanation?.explanation),
  };
}

/**
 * 通用组合生成算法：基于用户勾选的特征生成推演组合 (含数据穿透与去重)
 */
export function generateFeatureCombinations(
  selectedFeatures: OntologyFeature[],
  source: OntologyProjectionSource,
  options?: { parentCombination?: FeatureCombination; customTag?: string }
): FeatureCombination[] {
  if (selectedFeatures.length === 0) return [];

  const combinations: FeatureCombination[] = [];
  const now = Date.now();
  let seedCounter = 0;

  // 如果仅勾选1个特征，生成针对该特征的基础探查组合
  if (selectedFeatures.length === 1) {
    const feat = selectedFeatures[0];
    const comboId = `combo_single_${feat.id}_${now}`;

    combinations.push({
      id: comboId,
      title: `${feat.name} · 单项分析`,
      features: [feat],
      explanation: generateExplanation([feat], source, seedCounter++),
      metrics: queryFeatureCombinationMetrics([feat], source),
      tags: recommendTags([feat], 'single'),
      cohesionScore: 85,
      createdAt: now,
      parentId: options?.parentCombination?.id,
    });

    // 寻找相关的其他特征进行扩展建议
    const relatedFeatures = findRelatedFeatures(feat, source);
    if (relatedFeatures.length > 0) {
      relatedFeatures.slice(0, 2).forEach((relFeat, idx) => {
        const subCombo = [feat, relFeat];
        combinations.push({
          id: `combo_expanded_${feat.id}_${relFeat.id}_${now}_${idx}`,
          title: `${feat.name} × ${relFeat.name} · 关联探查`,
          features: subCombo,
          explanation: generateExplanation(subCombo, source, seedCounter++),
          metrics: queryFeatureCombinationMetrics(subCombo, source),
          tags: recommendTags(subCombo, 'pairwise'),
          cohesionScore: 90,
          createdAt: now,
          parentId: comboId,
        });
      });
    }

    return combinations;
  }

  // 当勾选 2 个或更多特征时：生成全集组合 + 两两关联子集组合
  // 1. 全集组合
  const fullTitle = selectedFeatures.map(f => f.name).slice(0, 3).join(' × ') + (selectedFeatures.length > 3 ? ` 等 ${selectedFeatures.length} 项` : '');
  combinations.push({
    id: `combo_full_${now}`,
    title: `${fullTitle} · 组合探查`,
    features: [...selectedFeatures],
    explanation: generateExplanation(selectedFeatures, source, seedCounter++),
    metrics: queryFeatureCombinationMetrics(selectedFeatures, source),
    tags: recommendTags(selectedFeatures, 'multi'),
    cohesionScore: calculateCohesion(selectedFeatures, source),
    createdAt: now,
    parentId: options?.parentCombination?.id,
  });

  // 2. 两两特征搭配 (如果特征数量 >= 3)
  if (selectedFeatures.length >= 3) {
    for (let i = 0; i < Math.min(selectedFeatures.length - 1, 3); i++) {
      for (let j = i + 1; j < Math.min(selectedFeatures.length, 4); j++) {
        const pair = [selectedFeatures[i], selectedFeatures[j]];
        combinations.push({
          id: `combo_pair_${i}_${j}_${now}`,
          title: `${pair[0].name} × ${pair[1].name} · 局部结合`,
          features: pair,
          explanation: generateExplanation(pair, source, seedCounter++),
          metrics: queryFeatureCombinationMetrics(pair, source),
          tags: recommendTags(pair, 'pairwise'),
          cohesionScore: calculateCohesion(pair, source),
          createdAt: now + i + j,
          parentId: options?.parentCombination?.id,
        });
      }
    }
  }

  return combinations;
}

/**
 * 寻找指定特征的关联特征
 */
function findRelatedFeatures(feature: OntologyFeature, source: OntologyProjectionSource): OntologyFeature[] {
  const all = extractOntologyFeatures(source);
  return all.filter(f => f.id !== feature.id).slice(0, 3);
}

/**
 * 计算特征集合的逻辑凝聚度分值 (0 - 100)
 */
function calculateCohesion(features: OntologyFeature[], source: OntologyProjectionSource): number {
  if (features.length <= 1) return 100;
  const kinds = new Set(features.map(f => f.kind));
  let baseScore = 75;
  if (kinds.has('entity') && kinds.has('property')) baseScore += 10;
  if (kinds.has('relation')) baseScore += 10;
  if (kinds.has('custom')) baseScore += 5;
  return Math.min(98, baseScore);
}

/**
 * 清洗任何中英混杂括弧与空泛废话套话
 */
/**
 * 动态自然语言情境合成引擎 (包含 DuckDB 真实数据透视注入)
 */
export function generateExplanation(
  features: OntologyFeature[],
  source: OntologyProjectionSource,
  _variantSeed: number = 0
): { combinedFeaturesSummary: string; intent: string; explanation: string } {
  if (features.length === 0) {
    return {
      combinedFeaturesSummary: '未选择特征',
      intent: '请选择特征。',
      explanation: '请在左侧勾选需要观察的特征。',
    };
  }

  const cleanName = (name: string) => name.trim();
  const names = features.map(f => cleanName(f.name));
  const summary = `包含 ${features.length} 个特征：${names.map(n => `「${n}」`).join('、')}。`;
  const metrics = queryFeatureCombinationMetrics(features, source);

  const objects = source.objects ?? [];
  const links = source.links ?? [];
  const objectTypes = source.objectTypes ?? [];
  const linkTypes = source.linkTypes ?? [];
  const objectHasProperty = (key: string): boolean => objects.some(object => {
    try {
      const properties = typeof object.properties === 'string'
        ? JSON.parse(object.properties)
        : object.properties;
      return Boolean(properties && typeof properties === 'object'
        && Object.prototype.hasOwnProperty.call(properties, key));
    } catch {
      return false;
    }
  });
  const isGrounded = (feature: OntologyFeature): boolean => {
    if (feature.sourceType === 'custom' || feature.isCustom) return false;
    if (feature.kind === 'entity') {
      return feature.meta.objectTypeId !== undefined
        && objectTypes.some(type => type.id === feature.meta.objectTypeId);
    }
    if (feature.kind === 'property') {
      return Boolean(feature.meta.propertyKey && objectHasProperty(feature.meta.propertyKey));
    }
    if (feature.kind === 'relation') {
      return feature.meta.linkTypeId !== undefined
        && linkTypes.some(type => type.id === feature.meta.linkTypeId);
    }
    if (feature.kind === 'instance') {
      return feature.meta.objectId !== undefined
        && objects.some(object => object.id === feature.meta.objectId);
    }
    return false;
  };

  const ungroundedNames = features.filter(feature => !isGrounded(feature)).map(feature => cleanName(feature.name));
  const entityNames = features.filter(feature => feature.kind === 'entity').map(feature => cleanName(feature.name));
  const propertyNames = features.filter(feature => feature.kind === 'property').map(feature => cleanName(feature.name));
  const relationNames = features.filter(feature => feature.kind === 'relation').map(feature => cleanName(feature.name));

  let intent: string;
  if (relationNames.length > 0) {
    intent = `核对参与“${relationNames.join('、')}”关系的对象是否同时满足所选类型与属性条件。`;
  } else if (entityNames.length > 0 && propertyNames.length > 0) {
    intent = `核对“${entityNames.join('、')}”对象是否实际记录“${propertyNames.join('、')}”。`;
  } else if (propertyNames.length > 0) {
    intent = `统计当前 Ontology 中实际记录“${propertyNames.join('、')}”的对象。`;
  } else {
    intent = `核对当前 Ontology 中“${names.join('、')}”对应的事实覆盖。`;
  }

  let explanation: string;
  if (ungroundedNames.length > 0) {
    explanation = `当前无法判断：特征“${ungroundedNames.join('、')}”没有可追溯的 Ontology 定义或对象事实。`;
  } else if (objects.length === 0) {
    explanation = '当前无法判断：Ontology 中没有可读取的对象事实。';
  } else {
    explanation = `实际读取当前 Ontology 的 ${objects.length} 个对象和 ${links.length} 条关系，按所选对象类型、属性存在性、实例和关系参与条件逐项匹配，得到 ${metrics.matchingObjectsCount} 个对象（${metrics.matchRatioPercentage}%）。该结果只证明事实覆盖，不证明因果、风险或业务影响。`;
  }

  return {
    combinedFeaturesSummary: summary,
    intent: intent.trim(),
    explanation: explanation.trim(),
  };
}

/**
 * 自动推荐标签
 */
export function recommendTags(features: OntologyFeature[], type: 'single' | 'pairwise' | 'multi'): string[] {
  const tags = new Set<string>();

  if (features.length === 1) {
    tags.add('#单特征');
    tags.add(`#${features[0].categoryLabel}`);
  } else if (type === 'pairwise') {
    tags.add('#双特征');
  } else {
    tags.add('#多维组合');
  }

  const hasEntity = features.some(f => f.kind === 'entity');
  const hasProp = features.some(f => f.kind === 'property');
  const hasRel = features.some(f => f.kind === 'relation');
  const hasCustom = features.some(f => f.kind === 'custom' || f.isCustom);

  if (hasEntity && hasProp && hasRel) {
    tags.add('#全要素');
  } else if (hasEntity && hasRel) {
    tags.add('#跨实体');
  } else if (hasProp) {
    tags.add('#属性约束');
  }

  if (hasCustom) {
    tags.add('#自定义拓展');
  }

  return Array.from(tags);
}
