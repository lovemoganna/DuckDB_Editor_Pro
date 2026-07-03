# Metrics 板块 AI 辅助优化提示词

> 请在现有系统基础上，基于 MECE 原则进一步优化 Metrics 指标管理模块。
> **目标**：实现指标定义、验证与图表生成能力的快速调用，并根据用户输入即时生成对应的指标 SQL 模拟方案。整体结构需清晰、调用路径明确，确保在复杂业务场景下稳定输出可执行的指标逻辑。

---

## 一、模块定位与优化目标

**核心功能**：Metrics 模块是系统的业务指标管理中枢，支持 AI 自动从数据表中提取指标定义、多维指标包管理、SQL 公式验证与修复、图表自动生成及收藏/搜索等操作。

**优化方向（MECE 分解）**：

| 维度 | 当前痛点 | 优化目标 |
|------|---------|---------|
| **输入效率** | 创建指标包时需手动填写名称/描述，模板库入口分散 | 内嵌 AI 一键填充，快速生成指标包配置与指标内容 |
| **迭代效率** | 表单内容填写后难以一键重置，模板切换成本高 | 内嵌快速清除，支持一键重置输入与撤销 |
| **理解效率** | 指标类型多样，用户不清楚何时用哪种指标或公式 | 提供 MECE 背景说明与场景引导，降低认知门槛 |

---

## 二、模块优化要求

### 2.1 内嵌「AI 一键填充」功能

**目的**：快速生成与当前数据表上下文相关的指标包配置及指标定义内容，降低用户从零搭建的门槛。

**实现方式**：

| 填充类型 | 触发入口 | 生成逻辑 |
|---------|---------|---------|
| **指标包智能填充** | 新建表单中点击「AI 填充」按钮 | 基于选中的数据表名称与推断的业务域，自动生成包名与描述草稿 |
| **指标模板填充** | 模板库中点击指标模板 | 将预定义的指标（count/sum/avg/retention 等）插入当前指标包 |
| **自然语言填充** | 顶部输入框输入业务需求描述 | 调用 AI 服务将自然语言转译为结构化指标定义（含公式）并填入表单 |
| **公式快速填充** | 指标卡片「编辑」模式下点击公式助手 | 根据选中的列类型推荐合适的聚合公式（带 DuckDB 语法） |

**AI 填充内容结构**（按场景分层生成）：

```typescript
const generateMetricAIFillPrompt = (
  tableName?: string,
  columns?: { name: string; type: string }[],
  scenario?: 'count' | 'revenue' | 'funnel' | 'retention' | 'trend' | 'ratio'
): string => {
  if (!tableName) {
    return "请先在左侧勾选至少一张数据表，或直接描述你的业务指标需求";
  }

  const colList = columns?.map(c => `${c.name} (${c.type})`).join(', ') ?? '暂无列信息';
  const baseContext = `表名: ${tableName}\n可用字段: ${colList}`;

  const templates: Record<string, string> = {
    count:     `${baseContext}\n生成基础计数指标，包含总数、去重数、日活趋势三个指标定义`,
    revenue:   `${baseContext}\n生成营收类指标，包含总金额、平均金额、最大/最小金额`,
    funnel:    `${baseContext}\n生成漏斗转化指标，包含各步骤的到达数、转化率、流失率`,
    retention: `${baseContext}\n生成留存指标，包含次日留存率、7日留存率、30日留存率`,
    trend:     `${baseContext}\n生成趋势类指标，包含日/周/月粒度的同环比计算公式`,
    ratio:     `${baseContext}\n生成比率类指标，包含渗透率、完成率、增长率`,
  };

  return templates[scenario ?? 'count'];
};
```

**UI 设计要求**：
- AI 填充按钮位于「新建指标包」表单内部，使用 `bg-monokai-green/10 text-monokai-green` 配色
- 公式助手以悬浮菜单形式展开，按字段类型分组（数值型 / 时间型 / 字符串型 / 布尔型）
- 自然语言输入框置于指标包创建区顶部，支持实时预览（防抖 500ms → 生成指标 JSON 草稿展示于表单下方）

---

### 2.2 内嵌「快速清除」按钮

**目的**：一键重置指标包创建表单，提升多轮迭代效率。

**实现方式**：

| 清除范围 | 触发方式 | 行为说明 |
|---------|---------|---------|
| **包名 + 描述** | 表单内「清除」图标 | 仅清空包名与描述输入框，保留已勾选的数据表 |
| **AI 输入框** | 旁边的 × 按钮 | 清空自然语言描述输入框 |
| **全部重置** | 「快速清除」主按钮 | 清空包名/描述/AI输入，取消所有表勾选，恢复初始状态 |
| **搜索/筛选重置** | 指标列表搜索框 × 按钮 | 清空搜索词并关闭「仅显示收藏」筛选 |

**UI 组件实现参考**：

```jsx
// 快速清除按钮（置于「新建指标包」表单底部）
<button
  onClick={handleMetricQuickClear}
  className="flex items-center gap-2 px-3.5 py-2.5
    bg-monokai-pink/10 border border-monokai-pink/40
    hover:bg-monokai-pink/20 text-monokai-pink
    font-medium rounded-lg transition-colors"
  title="一键清空表单与 AI 输入"
>
  <Trash2 className="w-4 h-4" />
  <span>快速清除</span>
</button>
```

**增强行为**：
- 清除前弹出二次确认（防止误操作），可通过设置关闭
- 支持 `Ctrl+Z` 撤销最近一次清除，撤销栈保留最近 10 次操作
- 清除时默认保留「收藏指标」与「历史指标包」，仅重置当前表单内容

---

### 2.3 提供模块背景说明

**目的**：明确各指标使用场景与常见错误，支持用户基于提示与 AI 进行二次优化。

**MECE 结构设计**（5 大类，相互独立，完全穷尽）：

#### 2.3.1 分类总览

| 类别 | 标题 | 核心描述 |
|------|------|---------|
| **指标建模** | 定义 / 建模 | 将业务问题转化为可量化的指标定义，含公式与语义说明 |
| **指标验证** | 验证 / 修复 | 对指标 SQL 公式进行执行验证，检测并修复错误 |
| **指标分析** | 分类 / 检索 | 按业务域、指标类型、数据依赖对指标进行组织与筛选 |
| **图表生成** | 可视化 / 图表 | 从指标公式自动推断适合的图表类型并生成可嵌入配置 |
| **指标管理** | 包管理 / 版本控制 | 指标包的导入/导出、版本历史与血缘追踪管理 |

#### 2.3.2 背景说明数据结构

```typescript
type MetricCategoryHelp = {
  title: string;              // 分类标题
  description: string;       // 核心描述（1-2 句话）
  scenarios: string[];       // 典型使用场景（3-5 个）
  commonErrors: string[];    // 常见错误与误区（3-5 个）
  aiHints: string[];         // AI 协作技巧（3-5 条）
  quickStart: string[];      // 快速上手步骤（≤5 步）
  bestPractices: string[];   // 最佳实践建议（3-5 条）
  formulaExamples: { name: string; formula: string; note: string }[]; // 公式示例
  exampleFlows: { name: string; description: string }[]; // 推荐操作流程
};
```

#### 2.3.3 五类背景说明内容（完整示例）

```typescript
const METRIC_CATEGORY_HELP: Record<string, MetricCategoryHelp> = {

  // ── 类别一：指标建模 ────────────────────────────────────────
  metricModeling: {
    title: '指标定义 / 建模',
    description: '适用于将业务问题转化为可量化的指标，每个指标需包含名称、场景、特点、定义、公式、案例与数据依赖。',
    scenarios: [
      '有明确业务目标，需要定义一组核心指标体系',
      '数据表结构已知，希望 AI 自动推断关键指标',
      '需要快速搭建某业务域（营收/流量/转化/留存）的指标集合',
      '对已有指标进行标准化命名与语义对齐',
    ],
    commonErrors: [
      '公式中使用列名占位符（如 amount_col），未替换为实际字段名',
      '混用 MySQL 聚合语法（如 GROUP_CONCAT），在 DuckDB 中报错',
      '比率类指标未处理分母为零的情况（应使用 NULLIF 防除零）',
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
      '2. 输入包名（如：电商核心指标）与描述',
      '3. 点击「AI 填充」或输入业务需求描述',
      '4. 检查生成的指标草稿，按需修改公式与字段',
      '5. 点击「生成指标」保存指标包',
    ],
    bestPractices: [
      '指标名称使用 snake_case（如 daily_active_users），保持一致性',
      '每个指标必须填写单位（个/元/次/%），便于图表轴标签',
      '公式中明确写出聚合粒度（如：按 user_id 去重）',
      '复杂公式优先写成 CTE 形式，便于后续验证与维护',
    ],
    formulaExamples: [
      { name: 'DAU（日活用户数）', formula: 'COUNT(DISTINCT user_id)', note: '需配合 WHERE date_trunc 过滤日期' },
      { name: '订单金额总计', formula: 'SUM(order_amount)', note: '注意过滤已取消订单' },
      { name: '用户渗透率', formula: 'COUNT(DISTINCT user_id) / total_users * 100', note: '用 NULLIF 防分母为零' },
    ],
    exampleFlows: [
      { name: '电商指标包', description: '勾选 orders 表 → AI 填充 → 生成营收/流量/转化指标' },
      { name: '用户行为指标', description: '勾选 events 表 → 自然语言描述 → 生成 DAU/留存/漏斗指标' },
    ],
  },

  // ── 类别二：指标验证 ────────────────────────────────────────
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
      '指标公式为纯聚合表达式（如 SUM(amount)），需系统自动补全 SELECT ... FROM 结构',
      '字段名大小写不匹配（DuckDB 默认不区分大小写，但双引号内区分）',
      '公式引用的列已被重命名或删除，验证失败但错误信息不明确',
      '批量验证时并发触发过多 AI 请求，导致限流失败',
    ],
    aiHints: [
      '验证失败后，将错误信息粘贴给 AI，描述「这是指标 X 的公式，执行报错如下」',
      '使用「修复」按钮（🔧）让 AI 自动改写公式，修复后会自动重新验证',
      '批量验证前建议先单个验证典型指标，确认数据源连通性',
      'AI 修复时可提示「保持业务含义不变，仅修复语法错误」',
    ],
    quickStart: [
      '1. 进入指标包详情页',
      '2. 点击指标卡片的「验证（▶）」按钮进行单个验证',
      '3. 若出现红色「验证失败」标签，点击「修复（🔧）」',
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
    exampleFlows: [
      { name: '单指标修复', description: '验证失败 → 点击修复 → AI 改写 → 自动重验证' },
      { name: '批量核查', description: '顶部「验证全部」→ 查看失败列表 → 逐个修复' },
    ],
  },

  // ── 类别三：指标分析 ────────────────────────────────────────
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
      '搜索词使用中文业务名（如「日活」），但指标名称为英文（daily_active_users），搜索无结果',
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
      { name: '分类筛选（搜索框）', formula: '输入 "营收类" 或 "revenue"', note: '匹配指标名、定义、分类三个字段' },
      { name: '依赖字段检索', formula: '输入字段名如 "user_id"', note: '可在指标定义文本中匹配' },
      { name: '批量导出复用', formula: '点击包列表「导出」→ 保存 JSON → 新项目「导入」', note: '跨库复用指标体系' },
    ],
    exampleFlows: [
      { name: '快速定位', description: '搜索框输入关键词 → 收藏筛选 → 查看指标卡片详情' },
      { name: '指标体系迁移', description: '导出 JSON → 分享给团队 → 导入新项目' },
    ],
  },

  // ── 类别四：图表生成 ────────────────────────────────────────
  chartGeneration: {
    title: '图表生成 / 可视化',
    description: '适用于从指标公式自动推断图表类型（折线/柱状/饼图等）并生成可在 SQL 编辑器中展示的图表配置，无需手动配置图表参数。',
    scenarios: [
      '趋势类指标（日/周/月聚合）自动生成折线图',
      '构成类指标（各类别占比）自动生成饼图或柱状图',
      '对比类指标（同环比）自动生成分组柱状图',
      '漏斗类指标自动生成漏斗图',
      '批量为指标包内所有指标生成图表',
    ],
    commonErrors: [
      '数据源表未连接或无数据，生成图表时 SQL 返回空结果',
      '指标公式为纯标量（如 COUNT(*)），无时间维度，系统无法推断 X 轴',
      '图表类型推断错误（如将趋势指标推断为饼图），需手动调整图表配置',
      '批量生成时因 AI 调用频繁导致超时，部分指标图表生成失败',
      '生成的图表 SQL 与指标原始公式语义不一致（添加了额外过滤条件）',
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
      '图表生成完成后点击卡片上的紫色「📊」图标确认图表已关联',
      '重新分析（刷新）指标包后需重新生成图表，旧图表不会自动更新',
    ],
    formulaExamples: [
      { name: '折线图（趋势）', formula: "SELECT date_trunc('day', created_at) AS day, COUNT(*) AS cnt FROM t GROUP BY 1", note: '包含时间维度，AI 推断为折线图' },
      { name: '柱状图（分组）', formula: 'SELECT category, SUM(amount) AS total FROM t GROUP BY category', note: '分类维度，AI 推断为柱状图' },
      { name: '饼图（构成）', formula: 'SELECT status, COUNT(*) AS cnt FROM t GROUP BY status', note: '枚举类别，AI 推断为饼图' },
    ],
    exampleFlows: [
      { name: '单指标可视化', description: '点击 📊 → 图表生成 → 查看图表 → 在 SQL 编辑器中打开' },
      { name: '批量生成', description: '顶部「生成全部图表」→ 等待完成 → 「查看图表」列表总览' },
    ],
  },

  // ── 类别五：指标管理 ────────────────────────────────────────
  metricManagement: {
    title: '指标包管理 / 版本控制',
    description: '适用于指标包的创建、导入/导出、版本历史查看与血缘追踪管理，支持跨项目指标体系迁移与复用。',
    scenarios: [
      '从零开始构建一套指标体系并保存为指标包',
      '将团队共享的指标包 JSON 导入当前项目',
      '数据表结构变更后，重新分析刷新指标包',
      '查看某个指标的修改历史与版本差异',
      '追踪指标的上下游数据血缘关系',
    ],
    commonErrors: [
      '导入 JSON 格式不合法（缺少 id/name/metrics 字段）导致导入失败',
      '重新分析（刷新）时数据源表已被删除，导致分析报错',
      '删除指标包时未导出备份，数据无法恢复',
      '同一指标包被多次导入，产生重复包（系统自动生成新 ID，但内容相同）',
      '指标版本号（version）超过 1 的历史记录未查阅，直接覆盖修改',
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
      '血缘字段（upstream/downstream）有助于评估修改指标的影响范围',
    ],
    formulaExamples: [
      { name: '导出指标包', formula: '点击包列表「⬇」图标 → 保存 metric_package_xxx.json', note: '包含所有指标定义与元数据' },
      { name: '导入指标包', formula: '包列表页右上角「导入」→ 选择 .json 文件', note: '系统自动生成新 ID 避免冲突' },
      { name: '版本查看', formula: '指标卡片展开 → 查看 history 字段各版本变更记录', note: '保留最近 N 版修改历史' },
    ],
    exampleFlows: [
      { name: '跨项目迁移', description: '导出 JSON → 分享 → 导入新项目 → 验证全部' },
      { name: '版本回溯', description: '查看 history → 确认变更字段 → 手动恢复历史公式' },
    ],
  },
};
```

---

## 三、UI 布局设计规范

### 3.1 整体布局结构

```
┌──────────────────────────────────────────────────────────────┐
│  Metrics Header                                               │
│  指标管理           [验证全部] [生成全部图表] [查看图表] [导出] │
├─────────────────┬────────────────────────────────────────────┤
│  左侧面板        │  右侧主区域                                 │
│  ─ 📋 数据表选择  │  ┌──────────────────────────────────────┐  │
│    ☑ table_a    │  │  AI 助手工具栏                         │  │
│    ☑ table_b    │  │  [🤖 AI 填充] [模板库 ▾] [快速清除]    │  │
│    ☐ table_c    │  │  自然语言: 描述你的指标需求...  [生成]   │  │
│  ─ ─────────── │  └──────────────────────────────────────┘  │
│  [新建指标包]    │                                             │
│  [使用模板]      │  ┌──────────────────────────────────────┐  │
│  [连接数据源]    │  │  指标卡片网格 (2列 / 1列)              │  │
│                 │  │  ┌────────┐  ┌────────┐              │  │
│  ─ ❓ 背景说明   │  │  │指标卡片│  │指标卡片│              │  │
│    · 指标建模    │  │  │▶ 🔧 📊│  │▶ 📊 ⭐│              │  │
│    · 指标验证    │  │  └────────┘  └────────┘              │  │
│    · 指标分类    │  └──────────────────────────────────────┘  │
│    · 图表生成    │                                             │
│    · 指标管理    │  [搜索框] [⭐收藏筛选]  共 N 个指标          │
└─────────────────┴────────────────────────────────────────────┘
```

### 3.2 配色规范（Monokai 主题）

| UI 元素 | 配色 | Tailwind 类 |
|---------|------|------------|
| 主生成按钮（生成指标） | 绿色 | `bg-monokai-green text-monokai-bg` |
| AI 填充按钮 | 绿色透明 | `bg-monokai-green/10 border-monokai-green/40 text-monokai-green` |
| 快速清除按钮 | 粉色 | `bg-monokai-pink/10 border-monokai-pink/40 text-monokai-pink` |
| 图表相关按钮 | 紫色 | `bg-monokai-purple/20 text-monokai-purple` |
| 模板库按钮 | 紫色边框 | `border-monokai-purple text-monokai-purple` |
| 连接数据源按钮 | 蓝色边框 | `border-monokai-blue text-monokai-blue` |
| 验证通过标签 | 绿色 | `bg-monokai-green/20 text-monokai-green` |
| 验证失败标签 | 粉色 | `bg-monokai-pink/20 text-monokai-pink` |
| 收藏星标（激活） | 黄色 | `text-monokai-yellow fill-current` |
| 背景 | 深色 | `bg-monokai-bg` |
| 指标卡片 | 稍浅 | `bg-[#272822] border-monokai-accent` |

---

## 四、核心交互流程

### 4.1 AI 一键填充流程

```
用户点击「AI 填充」
        ↓
读取当前已勾选的数据表列表
        ↓
读取顶部自然语言输入框内容（若有）
        ↓
合并上下文 → 调用 generateMetricAIFillPrompt()
        ↓
将生成结果填入「包名」与「描述」输入框
显示指标草稿预览（JSON 形式，只读）
        ↓
显示「已填充」Toast 提示（1.5s 自动消失）
```

### 4.2 快速清除流程

```
用户点击「快速清除」
        ↓
保存当前表单内容到撤销栈（lastClearedForm）
        ↓
[可选] 弹出确认对话框（默认开启）
        ↓
清空包名输入框
清空描述输入框
清空自然语言输入框
取消所有已勾选的数据表
        ↓
显示「已清除」Toast + 撤销入口（5s 内可 Ctrl+Z 恢复）
```

### 4.3 自然语言生成指标预览流程

```
用户修改自然语言输入框（防抖 500ms）
        ↓
校验输入非空 + 已勾选至少一张表
        ↓
调用 AI 生成指标草稿（simulateOnly 模式，返回 MetricDefinition[]）
        ↓
将草稿展示于表单下方预览区（灰色背景，只读 JSON）
        ↓
显示「应用到包」按钮（点击后替换当前指标列表草稿）
```

### 4.4 模块背景说明触发流程

```
用户点击左侧「❓ 模块背景说明」
        ↓
展开侧边栏帮助面板
        ↓
显示五类 MECE 分类标签页
        ↓
用户切换标签 → 展示对应类别的：
  · 使用场景
  · 常见错误
  · AI 协作提示
  · 快速上手步骤
  · 公式示例
        ↓
用户可将提示内容「一键复制到 AI 输入框」
```

### 4.5 指标验证与修复流程

```
用户点击指标卡片「▶ 验证」按钮
        ↓
系统构建验证 SQL（SELECT formula FROM sourceTable LIMIT 1）
        ↓
执行 SQL → 返回结果
        ↓
┌─ 成功 → 更新 isValid = true，显示绿色「已验证」标签
└─ 失败 → 更新 isValid = false，显示红色「验证失败」标签
                ↓
        用户点击「🔧 修复」按钮
                ↓
        AI 分析错误信息 → 生成修复后的公式
                ↓
        自动更新 formula 字段 → 触发重新验证
```

---

## 五、技术实现要点

### 5.1 状态管理结构

```typescript
interface MetricManagerState {
  // 包与数据
  packages: MetricPackage[];               // 所有指标包
  selectedPackage: MetricPackage | null;   // 当前查看的指标包
  selectedTables: Set<string>;             // 已勾选的数据表

  // 表单输入
  packageName: string;                     // 新建包名
  packageDescription: string;             // 新建包描述
  aiNaturalLanguageInput: string;          // 自然语言描述输入

  // AI 状态
  isAiFilling: boolean;                    // AI 填充 Loading
  isGeneratingPreview: boolean;           // 指标预览生成 Loading
  metricPreview: MetricDefinition[] | null; // AI 生成的指标草稿

  // 验证与图表
  isAnalyzing: boolean;                    // 分析/验证 Loading
  isGeneratingChart: boolean;             // 图表生成 Loading
  metricCharts: Map<string, boolean>;      // metricId → hasChart

  // 搜索与筛选
  searchTerm: string;                      // 搜索关键词
  showFavoritesOnly: boolean;             // 仅显示收藏
  favorites: Set<string>;                 // 收藏的指标 ID

  // 清除与撤销
  lastClearedForm: {
    packageName: string;
    packageDescription: string;
    aiInput: string;
    selectedTables: Set<string>;
  } | null;

  // 侧边栏
  activeHelpCategory: keyof typeof METRIC_CATEGORY_HELP;
  showHelpPanel: boolean;
}
```

### 5.2 关键函数列表

| 函数名 | 功能 | 输入 | 输出 |
|-------|------|------|------|
| `handleMetricAIFill` | AI 一键填充包名/描述 | selectedTables, aiInput | 更新表单字段 |
| `handleInsertTemplate` | 插入指标模板 | templateId | 向指标包追加指标 |
| `handleMetricQuickClear` | 快速清除表单 | - | 清空所有输入与选择 |
| `handleUndoClear` | 撤销清除 | - | 恢复 lastClearedForm |
| `generateMetricPreview` | 实时生成指标草稿 | aiInput, tables | MetricDefinition[] |
| `handleApplyPreview` | 应用草稿到指标包 | metricPreview | 更新包内指标列表 |
| `handleValidateMetric` | 验证单个指标 | metric, sourceTable | 更新 isValid 状态 |
| `handleFixMetric` | AI 修复指标公式 | metric, sourceTable | 更新 formula 字段 |
| `handleGenerateChart` | 生成单个指标图表 | metric, packageId | MetricChart 对象 |
| `handleGenerateAllCharts` | 批量生成图表 | - | 遍历未生成图表的指标 |
| `handleValidateAll` | 批量验证指标 | - | 更新所有指标 isValid |

### 5.3 防抖与性能优化

- **自然语言预览防抖**：500ms，避免用户输入中途频繁触发 AI 调用
- **收藏状态持久化**：`localStorage` 持久化，key 为 `duckdb_metric_favorites`
- **撤销栈**：仅保留最近 10 次清除操作，避免内存累积
- **批量验证并发控制**：最多同时执行 3 个验证请求，避免触发 AI 限流
- **模板库懒加载**：模板数据在用户首次点击时加载，不阻塞初始渲染

---

## 六、可选增强功能

### 6.1 指标健康度评分

- 综合考量：已验证（+40）/ 有图表（+30）/ 有单位（+15）/ 有分类（+15）
- 在指标卡片右上角显示健康度百分比，用颜色区分（绿/黄/红）
- 指标包详情页顶部显示包级健康度均值

### 6.2 指标血缘可视化

- 将 `lineage.upstream` 与 `lineage.downstream` 渲染为简单的有向图
- 节点为指标名称，边为依赖关系，点击节点可跳转至对应指标卡片
- 便于评估修改某个基础字段时的影响范围

### 6.3 指标对比（Metric Diff）

- 支持在同一指标包内选择两个时间版本进行 JSON 对比
- 高亮变更的字段（formula / definition / dependencies）
- 辅助 Code Review 或回归验证

### 6.4 指标模板市场

- 内置按行业分类的指标模板（电商/SaaS/金融/内容平台）
- 支持一键导入整套行业指标包（20-50 个预定义指标）
- 用户可将自定义指标包贡献为模板并导出分享

---

## 七、验收标准

| 验收项 | 验收标准 | 测试方法 |
|--------|---------|---------|
| AI 一键填充 | 勾选数据表后点击填充，包名/描述自动生成与表名相关 | 勾选表 → 填充 → 检查包名是否包含业务语义 |
| 自然语言生成 | 输入描述后 1s 内出现指标草稿（JSON 预览） | 输入 → 等待 500ms → 检查预览区指标数量 |
| 模板插入 | 点击模板后指标出现在当前包内，不覆盖已有指标 | 打开模板库 → 点击模板 → 检查指标列表追加 |
| 快速清除 | 点击后包名/描述/AI 输入/勾选表全部清空 | 填写内容 → 清除 → 检查所有字段为空 |
| 撤销清除 | Ctrl+Z 后内容恢复为清除前状态 | 清除 → Ctrl+Z → 检查内容一致性 |
| 单指标验证 | 点击「▶」后出现绿色/红色验证标签 | 点击验证 → 等待结果 → 检查标签颜色 |
| AI 修复指标 | 失败指标点击「🔧」后公式被改写并自动重验证 | 故意输入错误公式 → 修复 → 检查验证是否通过 |
| 图表生成 | 点击「📊」后图表出现在「查看图表」列表中 | 生成单个图表 → 查看图表列表 → 确认存在 |
| 批量图表 | 「生成全部图表」后成功数 = 无图表指标数（排除失败） | 批量生成 → 检查成功/失败计数 |
| 背景说明 | 侧边栏展示五类 MECE 帮助内容，各类均有场景/错误/提示 | 点击各标签 → 检查内容完整性 |
| 搜索/收藏 | 搜索词匹配名称/定义/分类；收藏筛选仅显示已收藏指标 | 搜索 → 检查结果；收藏 → 开启筛选 → 确认只见收藏 |
| 导入/导出 | 导出的 JSON 可被重新导入，指标数量与内容一致 | 导出 → 导入 → 对比指标列表 |

---

## 八、参考实现

详见以下组件，可直接复用相关逻辑：

| 参考文件 | 可复用内容 |
|---------|---------|
| `components/MetricManager.tsx` | 表单状态管理、导入/导出逻辑、验证全部/图表生成逻辑 |
| `components/MetricCard.tsx` | 指标卡片交互、验证/修复/图表按钮、内联编辑表单 |
| `components/SkillInvoker.tsx` | `handleAIFill`、`handleClear`、`CATEGORY_HELP` 数据结构、实时预览逻辑 |
| `components/SqlEditor.tsx` | 快速清除撤销栈实现、Toast 提示组件 |
| `components/MetricChartListModal.tsx` | 图表列表展示与「在 SQL 编辑器中打开」联动 |

**迁移优先级**：
1. ✅ 优先迁移 `CATEGORY_HELP` → `METRIC_CATEGORY_HELP`（内容直接可用）
2. ✅ 复用 `handleClear` 逻辑与快速清除按钮样式，适配指标包表单字段
3. ✅ 适配 `handleAIFill` → 接入已选数据表上下文，生成指标包名/描述
4. 🔲 新增自然语言输入框与指标草稿预览区域（MetricDefinition[] JSON 预览）
5. 🔲 新增公式助手悬浮菜单（按字段类型分组的聚合公式快速填充）
6. 🔲 新增侧边栏「背景说明」面板（五类 MECE 帮助标签页）
