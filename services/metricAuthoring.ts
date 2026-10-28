import type { MetricDefinition } from '../types';

/** Missing context stays visible; never drop a generated draft for missing prose. */
export function metricDraftIssues(metric: MetricDefinition): string[] {
  return [!metric.name?.trim() && '指标名称', !metric.scenario?.trim() && '应用场景',
    !metric.value?.trim() && '决策价值', !metric.definition?.trim() && '业务口径',
    !metric.formula?.trim() && !metric.calculation && '计算公式', !metric.unit?.trim() && '单位',
    !metric.sourceTable && !/\b(?:FROM|JOIN)\b/i.test(metric.formula || '') && '来源表'].filter(Boolean) as string[];
}

/** Shared contract for full generation and natural-language previews. */
export const METRIC_AUTHORING_RULES = `
仅使用提供的真实表和字段。元数据不能证明业务资格、主键唯一性或事件取值；缺少证据时明确待确认，不编造字段、状态取值、结果数值、目标或基线。
计算方式、业务域、分析方法和指标用途分别描述，避免为满足数量凑指标。同一口径不重复命名。
COUNT(*)、direction 字段分布和 created_at 时间分布只能证明数据规模 / 结构，不能直接称为高价值或核心业务指标。scenario 明确业务问题与决策，value 说明结果支持何种行动；证据不足时留空待确认，保留候选，不编造价值判断。
每项填写 sourceTable；多表或时序指标在 formula 中提供一条完整只读 DuckDB SQL，明确连接粒度，避免一对多连接放大。
COUNT(*) 是记录数，活跃人数需指定期间和有效活动事件后去重主体。留存需首次入组队列、第 N 日回访去重及成熟观察窗；漏斗需主体、事件顺序、窗口与归因。条件不足不生成此类指标。
比率分别聚合分子分母，NULLIF 防零；单位 % 按 0–100 输出，比例按 0–1 输出。均值、去重、比率、分位数不能直接跨组相加或平均。
时间比较明确时区与日历粒度，缺失上期不视为最近一行；快照先取主体期末记录，余额不得沿时间求和。
definition 写明资格总体、事实粒度、排除与空值规则、时间范围、单位；example 只描述核验方法，不填未经查询的结果。所有生成项均为待验证、待业务审核草稿。
如提供 calculation 或 governance，完整保留字段、分组、时间粒度、过滤、分子分母和权重绑定。governance 登记 entity、sourceGrain、timezone、exclusions、additivity 和用途 role；不得自行标记 reviewed。多表 SQL 写明 JOIN 键、连接类型和连接前预聚合粒度，未知关联不靠同名字段猜测。
`;
