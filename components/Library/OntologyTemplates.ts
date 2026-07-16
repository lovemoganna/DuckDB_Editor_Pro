/**
 * Ontology Templates — 8+ rapid modeling blueprints for ontology knowledge graphs.
 * Each template seeds objects, link types, links, and optionally actions/introspections.
 * IDs are prefixed to avoid collisions with existing data.
 *
 * Categories: Productivity · Domain Knowledge · Analysis · Personal
 */

export interface OntologyTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  /** SQL statements to execute for seeding. */
  sql: string[];
  /** Metadata */
  category?: string;
  author?: string;
  usageCount?: number;
  isBuiltin?: boolean;
}

export const ONTOLOGY_TEMPLATES: OntologyTemplate[] = [
  // ── Productivity ──────────────────────────────────────────────
  {
    id: 'okr-mapping',
    name: 'OKR 战略图谱',
    description: '核心目标 -> 关键结果 -> 具体行动的层级驱动系统',
    icon: '🎯',
    color: '#ae81ff',
    category: 'Productivity',
    isBuiltin: true,
    sql: [
      "INSERT INTO life_object_type VALUES (10, 'Objective', '核心目标'), (11, 'KeyResult', '关键结果')",
      "INSERT INTO life_object (id, object_type_id, name, properties) VALUES (100, 10, '成为全栈高手', '{\"priority\": \"High\"}'), (101, 11, '完成 5 个实战项目', '{\"progress\": \"20%\"}'), (102, 11, '阅读 10 本技术深度书籍', '{\"progress\": \"10%\"}')",
      "INSERT INTO life_link_type VALUES (10, '驱动', 'A 推动 B 的达成')",
      "INSERT INTO life_link VALUES (100, 10, 101, 100, 1.0), (101, 10, 102, 100, 0.8)",
      "INSERT INTO life_action (id, object_id, name, description, status) VALUES (100, 101, '开发 DuckDB 管理器', '当前正在进行的任务', 'pending')",
    ],
  },
  {
    id: 'gtd-loop',
    name: 'GTD 极简回路',
    description: '收集 -> 处理 -> 执行 -> 回顾的闭环流转',
    icon: '🔁',
    color: '#38bdf8',
    category: 'Productivity',
    isBuiltin: true,
    sql: [
      "INSERT INTO life_object_type VALUES (20, 'Inbox', '收集箱'), (21, 'Project', '项目'), (22, 'Area', '责任领域')",
      "INSERT INTO life_object (id, object_type_id, name, properties) VALUES (200, 20, '杂事堆', '{\"count\": 15}'), (201, 21, '装修房子', '{\"status\": \"Doing\"}'), (202, 22, '职业发展', '{\"weight\": 3}')",
      "INSERT INTO life_link_type VALUES (20, '转化为', 'A 经过处理变为 B'), (21, '隶属于', 'A 属于更大的 B')",
      "INSERT INTO life_link VALUES (200, 20, 200, 201, 1.0), (201, 21, 201, 202, 0.9)",
    ],
  },
  {
    id: 'habit-reflector',
    name: '习惯追踪 / 反思器',
    description: '行为习惯 -> 精神反馈 -> 认知觉醒的成长循环',
    icon: '🧠',
    color: '#fbbf24',
    category: 'Personal',
    isBuiltin: true,
    sql: [
      "INSERT INTO life_object_type VALUES (30, 'Habit', '习惯'), (31, 'Insight', '认知洞察')",
      "INSERT INTO life_object (id, object_type_id, name, properties) VALUES (300, 30, '晨间冥想', '{\"days\": 21, \"streak\": 5}'), (301, 31, '平静心态', '{\"depth\": 8}')",
      "INSERT INTO life_link_type VALUES (30, '塑造', 'A 长期坚持塑造 B')",
      "INSERT INTO life_link VALUES (300, 30, 300, 301, 0.9)",
      "INSERT INTO life_introspection (id, object_id, question, answer) VALUES (300, 301, '冥想带给我最大的变化是什么？', '更从容地应对突发事件。')",
    ],
  },
  // ── Domain Knowledge ────────────────────────────────────────
  {
    id: 'knowledge-graph',
    name: '知识管理图谱',
    description: '概念 -> 文章 -> 观点 -> 关联的知识沉淀网络',
    icon: '📚',
    color: '#4ade80',
    category: 'Knowledge',
    sql: [
      "INSERT INTO life_object_type VALUES (40, 'Concept', '核心概念'), (41, 'Article', '文章'), (42, 'Viewpoint', '观点')",
      "INSERT INTO life_object (id, object_type_id, name, properties) VALUES (400, 40, '复利思维', '{\"field\": \"Finance\"}'), (401, 41, '《穷查理宝典》', '{\"author\": \"查理·芒格\"}'), (402, 42, '多元思维模型', '{\"source\": \"查理·芒格\"}')",
      "INSERT INTO life_link_type VALUES (40, '源自', 'A 来源于 B'), (41, '支撑', 'A 为 B 提供支撑')",
      "INSERT INTO life_link VALUES (400, 40, 400, 402, 1.0), (401, 41, 401, 402, 0.7)",
      "INSERT INTO life_insight (id, object_id, insight, tag) VALUES (400, 400, '复利不仅是金融概念，也是知识积累的核心机制', '高价值')",
    ],
  },
  {
    id: 'project-management',
    name: '项目管理图谱',
    description: 'Epic -> Story -> Task -> Sprint 的敏捷开发结构',
    icon: '🏗️',
    color: '#fb923c',
    category: 'Productivity',
    sql: [
      "INSERT INTO life_object_type VALUES (50, 'Epic', '史诗'), (51, 'Story', '用户故事'), (52, 'Task', '任务'), (53, 'Sprint', '冲刺')",
      "INSERT INTO life_object (id, object_type_id, name, properties) VALUES (500, 50, '用户增长系统', '{\"quarter\": \"Q2\"}'), (501, 51, '注册转化率优化', '{\"priority\": \"P1\"}'), (502, 52, '设计注册表单', '{\"assignee\": \"@Alice\"}'), (503, 53, 'Sprint 12', '{\"velocity\": 34}')",
      "INSERT INTO life_link_type VALUES (50, '包含', 'A 包含 B'), (51, '负责', 'A 由 B 负责'), (52, '属于', 'A 属于 B')",
      "INSERT INTO life_link VALUES (500, 50, 500, 501, 1.0), (501, 50, 501, 502, 0.9), (502, 51, 502, 503, 0.8)",
      "INSERT INTO life_action (id, object_id, name, description, status) VALUES (500, 502, '评审注册表单设计', '完成设计后进行团队评审', 'pending')",
    ],
  },
  {
    id: 'health-tracker',
    name: '健康追踪图谱',
    description: '身体指标 -> 习惯行为 -> 目标达成的健康管理',
    icon: '💪',
    color: '#f472b6',
    category: 'Personal',
    sql: [
      "INSERT INTO life_object_type VALUES (60, 'Metric', '健康指标'), (61, 'Habit', '健康习惯'), (62, 'Goal', '健康目标')",
      "INSERT INTO life_object (id, object_type_id, name, properties) VALUES (600, 60, '体重', '{\"unit\": \"kg\", \"baseline\": 72}'), (601, 61, '每日健走 8000 步', '{\"frequency\": \"daily\"}'), (602, 62, '体脂率降至 18%', '{\"target\": 18}')",
      "INSERT INTO life_link_type VALUES (60, '支撑', 'A 支撑 B 的达成'), (61, '衡量', 'A 衡量 B 的进展')",
      "INSERT INTO life_link VALUES (600, 60, 600, 602, 0.8), (601, 60, 601, 600, 0.6)",
      "INSERT INTO life_action (id, object_id, name, description, status) VALUES (600, 601, '记录今日步数', '每日步行打卡', 'pending')",
    ],
  },
  {
    id: 'ecommerce-analytics',
    name: '电商分析图谱',
    description: '商品 -> 用户 -> 订单 -> 评价的全链路运营分析',
    icon: '🛒',
    color: '#67e8f9',
    category: 'Analysis',
    sql: [
      "INSERT INTO life_object_type VALUES (70, 'Product', '商品'), (71, 'User', '用户'), (72, 'Order', '订单'), (73, 'Review', '评价')",
      "INSERT INTO life_object (id, object_type_id, name, properties) VALUES (700, 70, '旗舰款 T 恤', '{\"sku\": \"TS-001\", \"price\": 129}'), (701, 71, '高价值用户', '{\"ltv\": 5800}'), (702, 72, '月度爆款订单', '{\"amount\": 2580}'), (703, 73, '好评反馈', '{\"rating\": 4.8}')",
      "INSERT INTO life_link_type VALUES (70, '下单', 'A 用户下单 B'), (71, '评价', 'A 用户评价 B'), (72, '关联', 'A 与 B 存在关联')",
      "INSERT INTO life_link VALUES (700, 70, 701, 702, 1.0), (702, 70, 702, 703, 0.9), (700, 70, 700, 701, 0.5)",
    ],
  },
  {
    id: 'risk-management',
    name: '风险管理图谱',
    description: '风险 -> 影响 -> 应对 -> 监控的完整风险管理',
    icon: '⚠️',
    color: '#f87171',
    category: 'Analysis',
    sql: [
      "INSERT INTO life_object_type VALUES (80, 'Risk', '风险'), (81, 'Impact', '影响评估'), (82, 'Mitigation', '应对措施'), (83, 'Monitor', '监控指标')",
      "INSERT INTO life_object (id, object_type_id, name, properties) VALUES (800, 80, '供应商交付延迟', '{\"probability\": \"High\", \"severity\": \"Critical\"}'), (801, 81, '产能下降 40%', '{\"scope\": \"production\"}'), (802, 82, '引入备选供应商', '{\"budget\": 50000}'), (803, 83, '交付准时率', '{\"threshold\": 95}')",
      "INSERT INTO life_link_type VALUES (80, '导致', 'A 风险导致 B 影响'), (81, '缓解', 'A 措施缓解 B 风险'), (82, '监控', 'A 指标监控 B 风险')",
      "INSERT INTO life_link VALUES (800, 80, 800, 801, 1.0), (802, 80, 802, 800, 0.8), (803, 80, 803, 800, 0.6)",
      "INSERT INTO life_action (id, object_id, name, description, status) VALUES (800, 802, '评估备选供应商资质', '本周内完成资质审查', 'pending')",
    ],
  },
  {
    id: 'financial-tracking',
    name: '财务追踪图谱',
    description: '账户 -> 交易 -> 预算 -> 目标的个人财务闭环',
    icon: '💰',
    color: '#ae81ff',
    category: 'Finance',
    sql: [
      "INSERT INTO life_object_type VALUES (90, 'Account', '账户'), (91, 'Transaction', '交易'), (92, 'Budget', '预算'), (93, 'Goal', '财务目标')",
      "INSERT INTO life_object (id, object_type_id, name, properties) VALUES (900, 90, '主账户', '{\"balance\": 50000, \"currency\": \"CNY\"}'), (901, 91, '月度餐饮支出', '{\"amount\": -3500, \"month\": \"2026-01\"}'), (902, 92, '本月餐饮预算', '{\"limit\": 4000}'), (903, 93, '年内储蓄 10 万', '{\"progress\": 50}')",
      "INSERT INTO life_link_type VALUES (90, '超支', 'A 超出 B 预算'), (91, '支撑', 'A 收入支撑 B 目标'), (92, '属于', 'A 交易属于 B 账户')",
      "INSERT INTO life_link VALUES (901, 90, 901, 902, 0.88), (900, 90, 900, 903, 0.5)",
    ],
  },
  {
    id: 'financial-audit',
    name: '金融审计风控图谱',
    description: '商户 -> 账户 -> 异常交易 -> 风控处置链条',
    icon: '🔍',
    color: '#fb7171',
    category: 'Analysis',
    sql: [
      "INSERT INTO life_object_type VALUES (110, 'Merchant', '商户'), (111, 'Card', '银行卡'), (112, 'RiskAlert', '风险告警')",
      "INSERT INTO life_object (id, object_type_id, name, properties) VALUES (1100, 110, '商户A', '{\"industry\": \"Retail\", \"risk_level\": \"medium\"}'), (1101, 111, '尾号8888的借记卡', '{\"bank\": \"ICBC\"}'), (1102, 112, '洗钱嫌疑告警', '{\"rules_triggered\": 3, \"score\": 92}')",
      "INSERT INTO life_link_type VALUES (110, '绑定', 'A 绑定了 B'), (111, '触发', 'A 交易触发了 B 告警')",
      "INSERT INTO life_link VALUES (1100, 110, 1101, 1100, 1.0), (1101, 111, 1101, 1102, 0.95)",
      "INSERT INTO life_action (id, object_id, name, description, status) VALUES (1100, 1102, '冻结账户并上报', '触发高风险洗钱告警，需要立即执行暂停交易处置', 'pending')",
    ],
  },
  {
    id: 'supply-chain',
    name: '物流供应链物流图谱',
    description: '仓库 -> 货运线路 -> 承运商 -> 履约节点',
    icon: '🚚',
    color: '#fb923c',
    category: 'Analysis',
    sql: [
      "INSERT INTO life_object_type VALUES (120, 'Warehouse', '仓库'), (121, 'Route', '线路'), (122, 'Carrier', '承运商')",
      "INSERT INTO life_object (id, object_type_id, name, properties) VALUES (1200, 120, '华东1号仓', '{\"capacity\": 50000}'), (1201, 121, '沪宁高速专线', '{\"distance\": 310}'), (1202, 122, '顺丰速运', '{\"contract_active\": true}')",
      "INSERT INTO life_link_type VALUES (120, '指派', 'A 任务指派给 B'), (121, '起始于', 'A 线路起始于 B 仓')",
      "INSERT INTO life_link VALUES (1201, 120, 1201, 1200, 0.9), (1202, 120, 1202, 1201, 0.85)",
    ],
  },
  {
    id: 'devops-observability',
    name: 'DevOps可观测性图谱',
    description: '微服务 -> 监控指标 -> 关联异常 -> 故障响应',
    icon: '⚙️',
    color: '#38bdf8',
    category: 'Productivity',
    sql: [
      "INSERT INTO life_object_type VALUES (130, 'Service', '微服务'), (131, 'Metric', '核心指标'), (132, 'Incident', '故障事件')",
      "INSERT INTO life_object (id, object_type_id, name, properties) VALUES (1300, 130, '订单API服务', '{\"language\": \"Go\", \"version\": \"v2.1\"}'), (1301, 131, 'P99 响应延迟', '{\"unit\": \"ms\", \"value\": 1200}'), (1302, 132, '支付超时故障', '{\"severity\": \"P0\", \"status\": \"active\"}')",
      "INSERT INTO life_link_type VALUES (130, '引发', 'A 异常导致 B 故障'), (131, '监控', 'A 监控 B 服务性能')",
      "INSERT INTO life_link VALUES (1301, 131, 1301, 1300, 0.95), (1301, 130, 1301, 1302, 0.9)",
      "INSERT INTO life_action (id, object_id, name, description, status) VALUES (1300, 1302, '重启Pod实例', '立即重启以清空连接池异常状态', 'pending')",
    ],
  },
  {
    id: 'ai-knowledge',
    name: 'AI 学术与模型图谱',
    description: '论文 -> 模型架构 -> 数据集 -> 评估基准',
    icon: '🤖',
    color: '#4ade80',
    category: 'Knowledge',
    sql: [
      "INSERT INTO life_object_type VALUES (140, 'Paper', '论文'), (141, 'Model', 'AI模型'), (142, 'Benchmark', '评估基准')",
      "INSERT INTO life_object (id, object_type_id, name, properties) VALUES (1400, 140, 'Attention Is All You Need', '{\"year\": 2017}'), (1401, 141, 'Transformer', '{\"parameters\": \"large\"}'), (1402, 142, 'MMLU', '{\"metric\": \"Accuracy\"}')",
      "INSERT INTO life_link_type VALUES (140, '提出', 'A 论文提出了 B 模型'), (141, '测试于', 'A 模型测试于 B 基准')",
      "INSERT INTO life_link VALUES (1400, 140, 1400, 1401, 1.0), (1401, 141, 1401, 1402, 0.92)",
    ],
  },
];

// Template categories for grouping in the UI
export const TEMPLATE_CATEGORIES = ['Productivity', 'Knowledge', 'Personal', 'Analysis', 'Finance'] as const;
export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number];
