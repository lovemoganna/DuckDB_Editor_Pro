/**
 * data/metricHelp.ts — Metric Manager MECE 帮助内容数据
 *
 * 从 components/MetricManager.tsx 中迁移而来（2026-06-08）。
 * 作为纯数据文件，便于独立维护和编辑。
 */

export type MetricCategoryKey =
  | 'metricModeling'
  | 'metricValidation'
  | 'metricAnalysis'
  | 'chartGeneration'
  | 'metricManagement';

export interface MetricCategoryHelp {
  title: string;
  description: string;
  scenarios: string[];
  commonErrors: string[];
  aiHints: string[];
  quickStart: string[];
  bestPractices: string[];
  formulaExamples: { name: string; formula: string; note: string }[];
}

export const METRIC_CATEGORY_HELP: Record<MetricCategoryKey, MetricCategoryHelp> = {
  metricModeling: {
    title: '指标定义 / 建模',
    description: '适用于将业务问题转化为可量化的指标，每个指标需包含名称、场景、特点、定义、公式、案例与数据依赖。',
    scenarios: [
      '有明确业务目标，需要定义一组核心指标体系',
      '数据表结构已知，希望 AI 自动推断关键指标',
      '需要快速搭建营收/流量/转化/留存的指标集合',
      '对已有指标进行标准化命名与语义对齐',
    ],
    commonErrors: [
      '公式中使用列名占位符（如 amount_col），未替换为实际字段名',
      '混用 MySQL 聚合语法（如 GROUP_CONCAT），在 DuckDB 中报错',
      '比率类指标未处理分母为零（应使用 NULLIF 防除零）',
      '趋势类指标未指定时间粒度，导致聚合结果失去时序意义',
      '依赖字段（dependencies）填写表名而非列名',
    ],
    aiHints: [
      '提供「业务目标 + 表名 + 关键字段」，AI 可一次生成 5-10 个指标草稿',
      '生成后检查每个公式是否有未填的占位符，可再次让 AI 补全',
      '复合指标（如留存率）建议先拆解为原子指标，再组合',
      '指定分类（营收类/流量类/转化类），AI 生成的指标体系更系统',
    ],
    quickStart: [
      '1. 在左侧勾选目标数据表',
      '2. 输入包名或点击「AI 填充」自动生成包名与描述',
      '3. 在自然语言框描述业务需求，AI 实时生成指标草稿',
      '4. 检查草稿并点击「生成指标」保存指标包',
      '5. 生成后进入详情页逐一验证指标公式',
    ],
    bestPractices: [
      '指标名称使用 snake_case（如 daily_active_users），保持一致性',
      '每个指标必须填写单位（个/元/次/%），便于图表轴标签',
      '公式中明确写出聚合粒度（如：按 user_id 去重）',
      '复杂公式优先写成 CTE 形式，便于后续验证与维护',
    ],
    formulaExamples: [
      { name: 'DAU（日活用户数）', formula: 'COUNT(DISTINCT user_id)', note: '配合 WHERE date_trunc 过滤日期' },
      { name: '订单金额总计', formula: 'SUM(order_amount)', note: '注意过滤已取消订单' },
      { name: '用户渗透率', formula: 'COUNT(DISTINCT user_id) * 1.0 / NULLIF(total_users, 0)', note: '用 NULLIF 防分母为零' },
    ],
  },
  metricValidation: {
    title: '指标验证 / 修复',
    description: '适用于对指标 SQL 公式进行实际执行验证，定位语法或字段错误，并使用 AI 自动修复后重新验证。',
    scenarios: [
      '批量导入后的指标公式正确性核查',
      '数据表结构变更后，检查依赖该表的指标是否仍然可用',
      '新建指标后，确认公式在实际数据上可正确执行',
      'AI 生成的公式含占位符或方言语法，需修复后验证',
    ],
    commonErrors: [
      '验证时未选择数据源表，导致 SQL 执行缺失 FROM 目标',
      '指标公式为纯聚合表达式（如 SUM(amount)），需补全 SELECT...FROM 结构',
      '字段名大小写不匹配（DuckDB 默认不区分大小写，但双引号内区分）',
      '公式引用的列已被重命名或删除，验证失败但错误信息不明确',
      '批量验证时并发触发过多 AI 请求，导致限流失败',
    ],
    aiHints: [
      '验证失败后，将错误信息粘贴给 AI，描述「这是指标 X 的公式，执行报错如下」',
      '使用「修复」按钮让 AI 自动改写公式，修复后会自动重新验证',
      '批量验证前建议先单个验证典型指标，确认数据源连通性',
      'AI 修复时可提示「保持业务含义不变，仅修复语法错误」',
    ],
    quickStart: [
      '1. 进入指标包详情页',
      '2. 点击指标卡片的「验证（▶）」按钮进行单个验证',
      '3. 若出现红色「验证失败」标签，点击「修复」',
      '4. AI 修复完成后自动重新验证，直到出现绿色「已验证」标签',
      '5. 全部验证通过后点击顶部「验证全部」进行批量确认',
    ],
    bestPractices: [
      '公式中使用 LIMIT 1 或 COUNT(*) 等轻量操作验证，而非完整聚合扫描',
      '验证前确认左侧数据源表已正确导入且有数据',
      '修复后建议对比原公式与修复版本，确认业务含义未改变',
      '验证通过的指标及时打上「收藏」标记，便于后续快速检索',
    ],
    formulaExamples: [
      { name: '防除零写法', formula: 'SUM(revenue) / NULLIF(COUNT(*), 0)', note: '避免分母为 0 导致运行时错误' },
      { name: '安全类型转换', formula: 'TRY_CAST(amount_str AS DOUBLE)', note: '字段类型不匹配时安全转换，失败返回 NULL' },
      { name: '空值处理', formula: 'COALESCE(SUM(amount), 0)', note: '当表无数据时返回 0 而非 NULL' },
    ],
  },
  metricAnalysis: {
    title: '指标分类 / 检索',
    description: '适用于对指标按业务域、计算类型、数据依赖进行分类管理，支持关键词搜索与收藏筛选，快速定位目标指标。',
    scenarios: [
      '指标包内指标数量超过 20 个，需要快速定位特定指标',
      '按业务域（营收/流量/转化/留存）筛选相关指标',
      '查找依赖特定字段（如 user_id）的所有指标',
      '标记高频使用的核心指标以便快速访问',
    ],
    commonErrors: [
      '搜索词使用中文业务名，但指标名称为英文，搜索无结果',
      '「仅显示收藏」过滤器开启后忘记关闭，导致看不到新增指标',
      '指标分类（category）未填写，搜索时无法按类别过滤',
      '多个指标包中存在同名指标，未注意当前处于哪个包的详情页',
    ],
    aiHints: [
      '搜索支持指标名称、定义与分类的模糊匹配，可用英文关键词搜索',
      '为指标填写 category（如「营收类」「流量类」），可在搜索框中精确过滤',
      '收藏核心指标后，可快速切换「仅收藏」视图做日常查看',
      '指标包支持导出为 JSON，可离线整理后再导入其他项目复用',
    ],
    quickStart: [
      '1. 进入指标包详情页，顶部搜索框输入关键词',
      '2. 点击⭐筛选按钮切换「收藏 / 全部」模式',
      '3. 搜索结果为零时，检查「仅显示收藏」是否已开启',
      '4. 为常用指标点击星标图标进行收藏',
      '5. 使用「导出」将整个指标包保存为 JSON 备份',
    ],
    bestPractices: [
      '统一指标命名规范（snake_case 英文），提高搜索命中率',
      '每个指标填写 category 字段，便于分组查看',
      '跨项目复用时优先用导入/导出，而非手动重建',
      '收藏数量建议控制在 10 个以内，保持核心指标突出',
    ],
    formulaExamples: [
      { name: '按分类搜索', formula: '搜索框输入 "营收类" 或 "revenue"', note: '匹配指标名、定义、分类三个字段' },
      { name: '依赖字段检索', formula: '搜索框输入字段名如 "user_id"', note: '可在指标定义文本中匹配' },
      { name: '批量导出复用', formula: '点击包列表「⬇」图标 → 保存 JSON → 导入新项目', note: '跨库复用指标体系' },
    ],
  },
  chartGeneration: {
    title: '图表生成 / 可视化',
    description: '适用于从指标公式自动推断图表类型（折线/柱状/饼图等）并生成可在 SQL 编辑器中展示的图表配置，无需手动配置图表参数。',
    scenarios: [
      '趋势类指标（日/周/月聚合）自动生成折线图',
      '构成类指标（各类别占比）自动生成饼图或柱状图',
      '对比类指标（同环比）自动生成分组柱状图',
      '批量为指标包内所有指标生成图表',
    ],
    commonErrors: [
      '数据源表未连接或无数据，生成图表时 SQL 返回空结果',
      '指标公式为纯标量（如 COUNT(*)），无时间维度，系统无法推断 X 轴',
      '图表类型推断错误，需手动调整图表配置',
      '批量生成时因 AI 调用频繁导致超时，部分指标图表生成失败',
    ],
    aiHints: [
      '生成图表前确保指标已通过「验证」（绿色标签），避免图表 SQL 执行失败',
      '趋势类指标在公式中注明时间字段（如 date_trunc），AI 图表推断更准确',
      '批量生成时建议分批（每次 5-10 个），避免并发限流',
      '生成的图表可在 SQL 编辑器的「图表」标签页中查看与调整',
    ],
    quickStart: [
      '1. 进入指标包详情页，确认指标已验证通过',
      '2. 点击指标卡片右上角「📊」按钮生成单个图表',
      '3. 或点击顶部「生成全部图表」批量处理',
      '4. 点击「查看图表」打开图表列表模态框',
      '5. 点击图表卡片的「在 SQL 编辑器中打开」进行进一步分析',
    ],
    bestPractices: [
      '趋势指标公式中建议包含 date_trunc 或 strftime，帮助 AI 推断时间 X 轴',
      '构成指标公式中包含 GROUP BY 类别字段，有助于生成正确的分组图表',
      '重新分析（刷新）指标包后需重新生成图表，旧图表不会自动更新',
    ],
    formulaExamples: [
      { name: '折线图（趋势）', formula: "SELECT date_trunc('day', created_at) AS day, COUNT(*) AS cnt FROM t GROUP BY 1", note: '包含时间维度，AI 推断为折线图' },
      { name: '柱状图（分组）', formula: 'SELECT category, SUM(amount) AS total FROM t GROUP BY category', note: '分类维度，AI 推断为柱状图' },
      { name: '饼图（构成）', formula: 'SELECT status, COUNT(*) AS cnt FROM t GROUP BY status', note: '枚举类别，AI 推断为饼图' },
    ],
  },
  metricManagement: {
    title: '指标包管理 / 版本控制',
    description: '适用于指标包的创建、导入/导出、版本历史查看与血缘追踪管理，支持跨项目指标体系迁移与复用。',
    scenarios: [
      '从零开始构建一套指标体系并保存为指标包',
      '将团队共享的指标包 JSON 导入当前项目',
      '数据表结构变更后，重新分析刷新指标包',
      '查看某个指标的修改历史与版本差异',
    ],
    commonErrors: [
      '导入 JSON 格式不合法（缺少 id/name/metrics 字段）导致导入失败',
      '重新分析（刷新）时数据源表已被删除，导致分析报错',
      '删除指标包时未导出备份，数据无法恢复',
      '同一指标包被多次导入，产生重复包',
    ],
    aiHints: [
      '重新分析前先导出当前指标包作为备份，防止分析结果覆盖手动调整内容',
      '导入外部指标包后，逐一检查公式中的表名是否与当前项目一致',
      '版本号大于 1 的指标可点击展开历史记录，查看各版本变更字段',
      '血缘追踪（lineage）字段由 AI 分析时自动填充，可辅助理解指标依赖关系',
    ],
    quickStart: [
      '1. 在指标包列表页点击「导入」上传 JSON 文件',
      '2. 或勾选数据表后点击「新建指标包」从零创建',
      '3. 进入指标包后点击「重新分析」可基于当前表重新生成指标',
      '4. 点击指标列表页的「导出」图标保存指标包 JSON',
      '5. 删除前务必先导出备份',
    ],
    bestPractices: [
      '每次重要修改前先「导出」备份，避免误操作丢失数据',
      '指标包命名包含业务域与日期（如：电商核心指标_2026Q1），便于版本识别',
      '导入外部包后立即执行「验证全部」确认字段匹配性',
    ],
    formulaExamples: [
      { name: '导出指标包', formula: '点击包列表「⬇」图标 → 保存 .json', note: '包含所有指标定义与元数据' },
      { name: '导入指标包', formula: '包列表页右上角「导入」→ 选择 .json 文件', note: '系统自动生成新 ID 避免冲突' },
      { name: '版本查看', formula: '指标卡片展开 → 查看 history 字段变更记录', note: '保留最近 N 版修改历史' },
    ],
  },
};

export const HELP_CATEGORIES: { key: MetricCategoryKey; label: string }[] = [
  { key: 'metricModeling', label: '指标建模' },
  { key: 'metricValidation', label: '指标验证' },
  { key: 'metricAnalysis', label: '指标分类' },
  { key: 'chartGeneration', label: '图表生成' },
  { key: 'metricManagement', label: '包管理' },
];
