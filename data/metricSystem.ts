import type { MetricDefinition } from '../types';
import type { MetricAggregation } from '../types/metric';

export const AGGREGATION_LABELS: Record<MetricAggregation, string> = {
  COUNT: '记录数 / 非空数', 'COUNT DISTINCT': '去重主体数', SUM: '求和', AVG: '算术均值', MIN: '最小值', MAX: '最大值',
  MEDIAN: '中位数', QUANTILE: '连续分位数', STDDEV_SAMP: '样本标准差', STDDEV_POP: '总体标准差', VAR_SAMP: '样本方差', VAR_POP: '总体方差',
  WEIGHTED_AVG: '加权均值', RATIO: '聚合比率',
};
type Template = Omit<MetricDefinition, 'id' | 'createdAt'>;
function template(name: string, aggregation: MetricAggregation, definition: string, category: string, extra: Partial<Template> = {}): Template {
  return { name, scenario: AGGREGATION_LABELS[aggregation], definition, category, characteristics: '按口径重新聚合', value: '支持可复算的业务决策',
    formula: '', example: '绑定当前数据库字段后验证，结果以实际执行为准', dependencies: [],
    calculation: { aggregation, ...(aggregation === 'QUANTILE' ? { quantile: 0.95 } : {}) },
    governance: { reviewStatus: 'draft', additivity: ['SUM', 'COUNT'].includes(aggregation) ? 'additive' : 'non_additive' }, ...extra };
}
/** No guessed field names, synthetic observations or implicit business targets. */
export const METRIC_TEMPLATES: Template[] = [
  template('total_count', 'COUNT', '统计筛选范围内的记录行；只有一行一业务实体时才等于业务实体数。选择字段则只统计非空值。', '规模与覆盖', { unit: '条' }),
  template('distinct_entities', 'COUNT DISTINCT', '统计非空主体标识的去重数。跨组、跨期需重新去重，不能直接相加。', '规模与覆盖', { unit: '个' }),
  template('total_value', 'SUM', '汇总同币种、同单位、同事实粒度的数值；连接明细前检查是否放大行数。', '规模与覆盖'),
  template('mean_value', 'AVG', '非空数值总和除以非空数值个数。客单价只有在一行一订单且金额口径一致时才可用 AVG。', '位置与分布'),
  template('minimum_value', 'MIN', '筛选范围内非空观测的最小值。', '位置与分布'),
  template('maximum_value', 'MAX', '筛选范围内非空观测的最大值。', '位置与分布'),
  template('median_value', 'MEDIAN', '数值中位数，降低极端值对中心位置判断的影响。', '位置与分布'),
  template('p95_value', 'QUANTILE', '非空数值的连续 P95，采用插值；不等于实际观测值，也不能对分组 P95 再平均。', '位置与分布'),
  template('sample_stddev', 'STDDEV_SAMP', '样本标准差，分母 n−1；少于两个非空观测时未定义。', '离散与波动'),
  template('population_stddev', 'STDDEV_POP', '总体标准差，分母 n；用于完整总体而非样本推断。', '离散与波动'),
  template('sample_variance', 'VAR_SAMP', '样本方差，单位为原始单位的平方。', '离散与波动'),
  template('population_variance', 'VAR_POP', '总体方差，适用于已覆盖完整总体的观测。', '离散与波动'),
  template('weighted_mean', 'WEIGHTED_AVG', '按权重汇总有效观测；数值或权重为空的行不参与。权重和为零时返回 NULL。业务需另行确定权重是否允许负数。', '效率与比率'),
  template('aggregate_ratio', 'RATIO', '分别计算同范围同分组的分子和分母，再相除；分母为零返回 NULL。比例与百分数倍率必须明确。', '效率与比率', {
    calculation: { aggregation: 'RATIO', numerator: { aggregation: 'COUNT' }, denominator: { aggregation: 'COUNT' }, scale: 100 }, unit: '%',
  }),
  template('cumulative_total', 'SUM', '按时间和维度累计可加值；累计从当前筛选范围的起点开始，缺失期间不会自动补零。', '时间分析', { calculation: { aggregation: 'SUM', transform: 'cumulative', grain: 'day' } }),
  template('rolling_total', 'SUM', '按日历区间汇总最近 N 期含当前期；有数据的期间输出结果，不等同于最近 N 行。', '时间分析', { calculation: { aggregation: 'SUM', transform: 'rolling', grain: 'day', windowPeriods: 7 } }),
  template('previous_period_growth', 'SUM', '与严格相邻日历期间比较：(本期−上期)/上期×100。缺失上期或上期为零返回 NULL。', '时间分析', { unit: '%', calculation: { aggregation: 'SUM', transform: 'previous_growth', grain: 'month' } }),
  template('year_over_year_growth', 'SUM', '与上一年同一日历期间比较；周粒度按日历日期偏移一年，不代表 ISO 同周序号。负基数须另行解释。', '时间分析', { unit: '%', calculation: { aggregation: 'SUM', transform: 'year_growth', grain: 'month' } }),
];

export const METRIC_SOURCES = [
  { title: 'DuckDB 聚合与 NULL 语义', url: 'https://duckdb.org/docs/stable/sql/functions/aggregates' },
  { title: 'DuckDB FILTER 条件聚合', url: 'https://duckdb.org/docs/stable/sql/query_syntax/filter' },
  { title: 'DuckDB 窗口函数与时间区间', url: 'https://duckdb.org/docs/stable/sql/functions/window_functions' },
  { title: 'Kimball 可加性与比率重聚合', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/additive-semi-additive-non-additive-fact/' },
  { title: 'dbt 实体、事件与转化窗口', url: 'https://docs.getdbt.com/docs/build/conversion' },
];
export const METRIC_KNOWLEDGE = [
  { title: '1 · 定义契约', topics: '业务问题 / 主体 / 事实粒度 / 总体范围 / 单位', rules: [
    '先写决策问题和统计对象，再选公式。结果指标、驱动指标、护栏指标、诊断指标是用途标签，不是计算类型。',
    '每项记录负责人、来源粒度、统计主体、排除规则、时区、更新频率和审核状态。目标值需有历史或业务依据，不预填行业阈值。',
    '金额不能跨币种直接求和；统一汇率日期、税费、退款、成功状态和收入确认规则。比率的“%”输出为 0–100，比例输出为 0–1。',
  ], mode: '口径登记' },
  { title: '2 · 基础测量', topics: '计数 / 去重 / 求和 / 位置 / 离散', rules: [
    'COUNT(*) 统计行；COUNT(field) 忽略空值；COUNT DISTINCT 忽略空标识。空集合 COUNT 为 0，SUM / AVG 通常为 NULL。',
    '均值、中位数、分位数用于位置与分布；标准差、方差用于波动。样本统计与总体统计分开选择。',
    '可加事实可重汇总；余额等快照通常不能沿时间累加；去重数、均值、比率、分位数需保留原始明细或可重算的组成量。',
  ], mode: '结构化建模' },
  { title: '3 · 效率与构成', topics: '比率 / 百分数 / 条件聚合 / 加权均值 / 占比', rules: [
    '全局 WHERE 定义共同总体；分子和分母各自 FILTER 定义子总体。总体转换率用分子之和 / 分母之和，不能平均分组转换率。',
    '构成占比的分母须包含所有被比较组；当前结构化比率在同组内计算，跨组占比需用 SQL 窗口或独立总量。',
    '分母为零返回 NULL 并说明未定义。不要用 COALESCE 将未知误报为零。加权均值必须使用成对非空的数值与权重。',
  ], mode: '结构化建模 / 跨组占比用 SQL' },
  { title: '4 · 时间与比较', topics: '粒度 / 环比 / 同比 / 累计 / 滚动 / 快照', rules: [
    '统计窗口优先用 [开始, 结束)；先统一时间类型和业务时区再截断。登记时区不等于自动转换，会话设置与表达式需一致。',
    '环比严格匹配上一日历期；直接 LAG 会跳过缺失期。滚动日历窗口与最近 N 行不同。缺失期只有确认没有业务发生才补零。',
    '累计受筛选起点影响；滚动去重需在窗口原始主体上重算。余额先取每主体期末快照，再跨主体汇总，不能求全期流水 SUM。',
  ], mode: '时间变换 / 快照方法向导' },
  { title: '5 · 生命周期与路径', topics: '活跃 / 留存 / 流失 / 复购 / 漏斗 / 队列', rules: [
    'DAU 是指定业务日期内符合活跃事件定义的去重主体；不能把每日记录数命名为日活人数。',
    '次日留存：按首次符合入组事件的日期确定 cohort；分子为其中在第 1 个业务日发生回访的去重主体，分母为该 cohort 主体数。观察截止日不足的 cohort 不纳入成熟留存。',
    '严格漏斗必须指定主体、起始事件、顺序、窗口、去重与归因。完成状态占所有用户的比率只能称状态渗透率，不能推断漏斗转化。',
    '流失先确定资格、无活动阈值和观察截止日；复购先按订单去重再按主体计数。同期队列与滚动留存、严格第 N 日留存要分别定义。',
  ], mode: '方法向导（留存 / 两步漏斗）· 高级路径用 SQL' },
  { title: '6 · 诊断与推断', topics: '维度拆解 / 排名 / 集中度 / 相关 / 实验 / 预测', rules: [
    '按地区、渠道、人群拆解时固定总体和时间窗口；帕累托 / Top-N 展示应保留其他组，不隐藏分母。警惕辛普森悖论。',
    '相关系数只能说明关联。实验需预先确定随机化单位、主指标、护栏、样本量、观察期和多重检验策略。',
    '异常阈值和预测区间需考虑季节性、数据延迟、样本量和结构变化。当前 SQL 可计算统计量，不提供自动因果结论或预测模型。',
  ], mode: '完整 SQL / 外部分析方法' },
  { title: '7 · 质量与验证', topics: '唯一性 / 完整性 / 有效性 / 一致性 / 及时性', rules: [
    '验证 SQL 能运行只代表技术通过，不代表业务正确。核对独立总账、抽样明细、边界日期、空集合、零分母与极端值。',
    '一对多 JOIN 会放大分子和分母；先在同一事实粒度预聚合，再按唯一键连接。核对连接前后行数、去重主体数和金额守恒。',
    'TRY_CAST 会把无效值转为空，需另报转换失败率。监测空标识、重复键、超范围值、延迟、迟到回补和不完整期间。',
  ], mode: '实际执行 + 人工复核' },
  { title: '8 · 资产治理', topics: '版本 / 血缘 / 审核 / 复用 / 废弃', rules: [
    '业务域与计算方法独立：营收、客户、产品、营销、运营、财务、风险均复用同一组计算原语，新增业务域不新增互斥计算类型。',
    '计算定义变更应失效旧验证，保留版本和上下游引用。数据库隔离；导入后重新确认来源和执行，不能沿用其他环境的验证状态。',
    '审核状态由责任人确认；维护唯一口径与变更说明。已废弃指标保留解释，避免关联分析悄悄换用不同含义。',
  ], mode: '版本与口径管理' },
];

export function metricReadiness(metric: MetricDefinition): string[] {
  const g = metric.governance || {};
  return [!metric.scenario?.trim() && '明确业务问题与应用场景', !metric.value?.trim() && '说明决策价值与使用方式',
    !metric.definition?.trim() && '补充业务定义与总体范围', !metric.unit?.trim() && '明确单位 / 倍率',
    !g.owner?.trim() && '指定负责人', !g.entity?.trim() && '明确统计主体', !g.sourceGrain?.trim() && '登记来源事实粒度',
    !g.freshness?.trim() && '约定更新频率与延迟', !g.additivity && '确认可加性',
    metric.calculation?.grain && !g.timezone?.trim() && '确认业务时区', g.reviewStatus !== 'reviewed' && '完成业务口径审核'].filter(Boolean) as string[];
}

export function metricOutputAdditivity(metric: MetricDefinition): string {
  const c = metric.calculation;
  if (c?.transform === 'cumulative' || c?.transform === 'rolling') return '结果沿时间不可相加';
  if (c && (['previous_growth', 'year_growth'].includes(c.transform || '') || !['SUM', 'COUNT'].includes(c.aggregation))) return '结果需重新聚合，不能直接相加';
  return metric.governance?.additivity === 'additive' ? '可在互斥事实分区汇总' : metric.governance?.additivity === 'semi_additive' ? '仅允许沿指定维度汇总' : '跨组 / 跨期请重新计算';
}

/** Business applications are a separate browsing axis, never a substitute for a calculation definition. */
export const METRIC_BUSINESS_CATALOG = [
  { domain: '交易与变现', name: '成交金额', template: 'total_value', definition: '同币种成功交易金额总和；明确支付、退款、取消、税费与时间确认口径。', unit: '金额' },
  { domain: '交易与变现', name: '净收入', template: 'total_value', definition: '收入确认口径下的收入减退款与折让；须先准备带符号净额，不能直接把支付流水当收入。', unit: '金额' },
  { domain: '交易与变现', name: '客单价', template: 'aggregate_ratio', definition: '符合资格的订单金额总和 / 去重订单数；分子选择 SUM、分母选择 COUNT DISTINCT，倍率 1。', unit: '金额/单' },
  { domain: '交易与变现', name: '毛利率', template: 'aggregate_ratio', definition: '同期间同确认口径毛利总和 / 营业收入总和 ×100；毛利字段需由收入与成本正确配比得到。', unit: '%' },
  { domain: '客户与使用', name: '活跃主体数', template: 'distinct_entities', definition: '指定期间内发生符合活跃定义事件的去重主体数；须过滤有效事件并登记时间粒度，跨期重新去重。', unit: '个' },
  { domain: '客户与使用', name: '新客数', template: 'distinct_entities', definition: '首次满足获客资格日期落在统计期内的去重主体数；首次日期必须由完整历史或权威主表确定。', unit: '个' },
  { domain: '客户与使用', name: '功能渗透率', template: 'aggregate_ratio', definition: '使用目标功能的去重主体 / 具备该功能资格的去重主体 ×100；明确用户资格和共同期间。', unit: '%' },
  { domain: '客户与使用', name: '使用频次', template: 'aggregate_ratio', definition: '有效行为次数 / 活跃去重主体数；明确会话、事件去重及异常机器人排除规则，倍率 1。', unit: '次/主体' },
  { domain: '增长与渠道', name: '获客成本 CAC', template: 'aggregate_ratio', definition: '同获客范围的可归属成本 / 新增付费客户数；跨表须先按同期间同渠道预聚合，避免连接放大，倍率 1。', unit: '金额/客户' },
  { domain: '增长与渠道', name: '广告支出回报 ROAS', template: 'aggregate_ratio', definition: '约定归因窗口内广告归因收入 / 广告支出；明确归因模型与退款，非利润 ROI，倍率 1。', unit: '倍' },
  { domain: '增长与渠道', name: '点击率 CTR', template: 'aggregate_ratio', definition: '有效点击次数 / 有效曝光次数 ×100；先统一广告粒度及去重方式，不得平均各广告点击率。', unit: '%' },
  { domain: '增长与渠道', name: '渠道构成占比', recipe: 'share', definition: '各渠道可加规模 / 全渠道规模 ×100；保留其他与未知渠道，统一归因和总体范围。', unit: '%' },
  { domain: '履约与服务', name: '准时履约率', template: 'aggregate_ratio', definition: '截止观察日已到承诺期限且按时完成的订单 / 同范围到期应履约订单 ×100；不能仅以已完成订单为分母。', unit: '%' },
  { domain: '履约与服务', name: '处理时长 P95', template: 'p95_value', definition: '合格已完成任务处理时长的连续 95 分位数；明确起止事件与暂停规则，另报未完成积压以控制幸存者偏差。', unit: '时间' },
  { domain: '履约与服务', name: '一次解决率', template: 'aggregate_ratio', definition: '首次接触解决且观察期内未重开的有效工单 / 观察期完整的有效工单 ×100；主体为工单。', unit: '%' },
  { domain: '履约与服务', name: '单位产出成本', template: 'aggregate_ratio', definition: '同成本归集范围总成本 / 合格产出数量；明确固定成本分摊、废品和返工边界，倍率 1。', unit: '金额/单位' },
  { domain: '存量与资源', name: '期末余额 / 库存', recipe: 'snapshot', definition: '每账户或 SKU 在期末的最后有效快照再汇总；缺失快照与前向结转规则需明确，禁止把每日余额直接求和。', unit: '金额/数量' },
  { domain: '存量与资源', name: '资源利用率', template: 'aggregate_ratio', definition: '实际占用资源时长 / 可用资源时长 ×100；资源与时间单位一致，明确计划停机是否排除。', unit: '%' },
  { domain: '存量与资源', name: '库存周转率', template: 'aggregate_ratio', definition: '期间销售成本 / 同估值口径平均库存成本；先生成时间加权或约定期初期末平均库存，倍率 1，不把日余额简单相加。', unit: '次' },
  { domain: '存量与资源', name: '账龄分布', recipe: 'share', definition: '截至指定观察日，各账龄桶未结金额占全部未结金额；先构造互斥账龄桶，明确负余额与核销。', unit: '%' },
  { domain: '风险与质量', name: '不良 / 违约率', template: 'aggregate_ratio', definition: '到达约定风险观察期的不良主体或金额 / 同范围风险暴露主体或金额 ×100；主体口径与金额口径不得混用。', unit: '%' },
  { domain: '风险与质量', name: '损失率', template: 'aggregate_ratio', definition: '指定观察窗净损失 / 同口径风险暴露 ×100；明确追回、核销、成熟窗口和存量暴露口径。', unit: '%' },
  { domain: '风险与质量', name: '缺失率', template: 'aggregate_ratio', definition: '指定字段为空的记录数 / 应填写该字段的记录数 ×100；空字符串与 NULL 的定义分别处理。', unit: '%' },
  { domain: '风险与质量', name: '重复率', template: 'aggregate_ratio', definition: '(合格记录数−合格唯一业务键数) / 合格记录数 ×100；分子需先构造重复标记或用 SQL，不能把所有重复组成员数误称冗余记录数。', unit: '%' },
];
