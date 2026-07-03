# SQL 板块 AI 辅助优化提示词

> 请在现有系统基础上，基于 MECE 原则进一步优化 SQL 编辑器模块。
> **目标**：实现 SQL 编写、执行与调试能力的快速调用，并根据用户输入即时生成对应的 SQL 方案。整体结构需清晰、调用路径明确，确保在复杂场景下稳定输出可执行的 DuckDB SQL 逻辑。

---

## 一、模块定位与优化目标

**核心功能**：SQL 编辑器是系统的核心工作区，支持多标签 SQL 编写、一键执行、结果可视化、智能提示与历史管理。

**优化方向（MECE 分解）**：

| 维度 | 当前痛点 | 优化目标 |
|------|---------|---------|
| **输入效率** | 用户需手动输入完整 SQL，门槛高 | 内嵌 AI 一键填充，降低冷启动成本 |
| **迭代效率** | 多轮修改后输入框内容堆积，难以重置 | 内嵌快速清除，支持一键重置与撤销 |
| **理解效率** | 功能分散，用户不清楚当前适合哪种模式 | 提供结构化背景说明与错误提示 |

---

## 二、模块优化要求

### 2.1 内嵌「AI 一键填充」功能

**目的**：快速生成上下文相关的 SQL 示例，降低用户从零编写的门槛。

**实现方式**：

| 填充类型 | 触发入口 | 生成逻辑 |
|---------|---------|---------|
| **智能填充** | 点击「AI 填充」按钮 | 基于当前选中的表和列，自动生成上下文相关的 SQL 查询草稿 |
| **片段填充** | 点击代码片段标签 | 插入预定义 SQL 模板（CTE、窗口函数、PIVOT、UNPIVOT、SUMMARIZE 等） |
| **自然语言填充** | 顶部输入框输入描述 | 调用 AI 服务将自然语言需求转译为 DuckDB SQL（带 500ms 防抖预览） |

**AI 填充内容结构**（按场景分层生成）：

```typescript
const generateSqlAIFillPrompt = (
  tableName?: string,
  columns?: { name: string; type: string }[],
  scenario?: 'select' | 'aggregate' | 'join' | 'window' | 'transform'
): string => {
  if (!tableName) {
    return "请先在左侧选择一个表，或直接描述你的 SQL 需求";
  }

  const colList = columns?.map(c => `${c.name} (${c.type})`).join(', ') ?? '暂无列信息';
  const baseContext = `表名: ${tableName}\n可用字段: ${colList}`;

  const templates: Record<string, string> = {
    select:    `${baseContext}\n生成带 WHERE 条件的基础查询，建议加 LIMIT 100`,
    aggregate: `${baseContext}\n生成 GROUP BY 聚合查询，包含 COUNT / SUM / AVG`,
    join:      `${baseContext}\n生成与其他表的 LEFT JOIN 查询模板，占位符用 other_table`,
    window:    `${baseContext}\n生成窗口函数查询，包含 ROW_NUMBER / RANK / LAG / LEAD`,
    transform: `${baseContext}\n生成列转行（UNPIVOT）或行转列（PIVOT）的转换查询`,
  };

  return templates[scenario ?? 'select'];
};
```

**UI 设计要求**：
- AI 填充按钮位于 SQL 编辑器工具栏左侧，使用 `bg-monokai-green/10 text-monokai-green` 配色
- 片段库以下拉菜单形式展开，按类别分组（基础 / 聚合 / JOIN / 窗口 / DuckDB 专有）
- 自然语言输入框支持实时预览（防抖 500ms → 生成 SQL 草稿显示于编辑器下方）

---

### 2.2 内嵌「快速清除」按钮

**目的**：一键重置 SQL 编辑器内容，提升多轮迭代效率。

**实现方式**：

| 清除范围 | 触发方式 | 行为说明 |
|---------|---------|---------|
| **当前标签页** | 工具栏「清除」图标 | 仅清空当前活动标签页的 SQL 内容 |
| **AI 输入框** | 旁边的 × 按钮 | 清空自然语言描述输入框 |
| **全部重置** | 「快速清除」主按钮 | 清空 SQL + AI 输入 + 恢复默认状态 |
| **历史清除** | 历史面板内「清除全部」 | 需确认对话框，清空查询历史记录 |

**UI 组件实现参考**：

```jsx
// 快速清除按钮
<button
  onClick={handleQuickClear}
  className="flex items-center gap-2 px-3.5 py-2.5
    bg-monokai-pink/10 border border-monokai-pink/40
    hover:bg-monokai-pink/20 text-monokai-pink
    font-medium rounded-lg transition-colors"
  title="一键清空 SQL 输入与 AI 描述"
>
  <Trash2 className="w-4 h-4" />
  <span>快速清除</span>
</button>
```

**增强行为**：
- 清除前弹出二次确认（防误操作），可通过设置关闭
- 支持 `Ctrl+Z` 撤销最近一次清除，撤销栈保留最近 10 次操作
- 清除时默认保留「收藏查询」与「历史记录」，仅重置当前编辑内容

---

### 2.3 提供模块背景说明

**目的**：明确各 SQL 使用场景与常见错误，支持用户基于提示与 AI 进行二次优化。

**MECE 结构设计**（5 大类，相互独立，完全穷尽）：

#### 2.3.1 分类总览

| 类别 | 标题 | 核心描述 |
|------|------|---------|
| **SQL 生成** | 查询生成 / 建模 | 将自然语言需求转成可执行的 DuckDB SQL |
| **数据分析** | 聚合 / 指标分析 | 时间序列、漏斗、留存、同环比等分析场景 |
| **数据转换** | 转换 / 清洗 | 列转行、行转列、类型转换、字符串处理 |
| **性能调优** | 执行计划 / 优化 | EXPLAIN 分析、索引思路与查询改写 |
| **实用工具** | 辅助 / 测试数据 | 样本生成、数据摘要、随机抽样 |

#### 2.3.2 背景说明数据结构

```typescript
type SqlCategoryHelp = {
  title: string;              // 分类标题
  description: string;       // 核心描述（1-2 句话）
  scenarios: string[];       // 典型使用场景（3-5 个）
  commonErrors: string[];    // 常见错误与误区（3-5 个）
  aiHints: string[];         // AI 协作技巧（3-5 条）
  quickStart: string[];      // 快速上手步骤（≤5 步）
  bestPractices: string[];   // 最佳实践建议（3-5 条）
  duckdbSpecific: string[];  // DuckDB 专有语法提示（2-4 条）
  exampleFlows: { name: string; description: string }[]; // 推荐操作流程
};
```

#### 2.3.3 五类背景说明内容（完整示例）

```typescript
const SQL_EDITOR_CATEGORY_HELP: Record<string, SqlCategoryHelp> = {

  // ── 类别一：SQL 生成 ──────────────────────────────────────
  sqlGeneration: {
    title: 'SQL 生成 / 建模',
    description: '适用于将自然语言需求快速转成可执行的 DuckDB SQL，支持查询、建表、增删改等操作。',
    scenarios: [
      '有明确业务问题，需要一条或一组 SQL 直接回答',
      '需要快速搭建表结构或模拟数据场景',
      '已有表和字段，希望生成标准化查询模板',
      '从零设计完整数据模型',
    ],
    commonErrors: [
      '未指定表名或字段，生成 SQL 含占位符（table_name / col）无法直接执行',
      'WHERE 条件中混入中文自然语言而非字段名',
      '混用 MySQL 方言（如 LIMIT x,y），在 DuckDB 中报错',
      '未处理 NULL 值，导致聚合结果偏差',
      '特殊字符列名未加双引号',
    ],
    aiHints: [
      '用「业务意图 + 实际字段名」描述需求，AI 生成结果更稳定',
      '生成结果含占位符时，先用 AI 填充补全字段，再手动微调',
      '复杂查询建议先拆为多个 CTE 子查询，逐步合成',
      'DuckDB 特有语法（SUMMARIZE / PIVOT / unnest）优先使用，性能更好',
    ],
    quickStart: [
      '1. 在顶部输入框描述查询需求（如：统计每个用户的订单总金额）',
      '2. 点击「AI 填充」或等待 500ms 自动预览',
      '3. 检查生成的 SQL 草稿是否符合预期',
      '4. 按需修改后点击「执行」',
      '5. 查看结果并保存为收藏查询',
    ],
    bestPractices: [
      '优先使用明确列名，避免 SELECT *',
      '大结果集必须加 LIMIT',
      '使用 CTE 将复杂逻辑分层',
      '参数化 WHERE 条件，避免 SQL 注入风险',
    ],
    duckdbSpecific: [
      'SUMMARIZE table_name; — 快速统计各列分布',
      'FROM table SELECT col — DuckDB 允许 FROM 在 SELECT 之前',
      'SELECT * EXCLUDE (col1, col2) — 排除指定列',
      'PIVOT / UNPIVOT — 原生行列转换，无需子查询',
    ],
    exampleFlows: [
      { name: '查询用户订单', description: 'SELECT + JOIN + WHERE + LIMIT' },
      { name: '快速建表', description: '自然语言描述 → AI 生成 CREATE TABLE' },
      { name: '复杂分析', description: 'CTE + 窗口函数 + 聚合组合' },
    ],
  },

  // ── 类别二：数据分析 ──────────────────────────────────────
  dataAnalysis: {
    title: '聚合 / 指标分析',
    description: '适用于时间序列、同环比、漏斗、留存等分析场景，支持多维聚合与窗口计算。',
    scenarios: [
      '按时间维度统计指标趋势（日/周/月）',
      '计算同比 / 环比增长率',
      '用户行为漏斗与留存分析',
      '多维度下钻分析（GROUP BY ROLLUP / CUBE）',
    ],
    commonErrors: [
      'GROUP BY 遗漏非聚合列导致报错',
      'HAVING 与 WHERE 混用（HAVING 过滤聚合结果，WHERE 过滤原始行）',
      '时间截断函数使用错误（应使用 date_trunc / strftime）',
      '窗口函数 PARTITION BY 与 GROUP BY 逻辑混淆',
      '留存计算时忘记处理用户首次出现的边界条件',
    ],
    aiHints: [
      '描述分析目标时带上时间粒度（如：按天统计 MAU）',
      '同环比场景可提示 AI 使用 LAG 窗口函数',
      '漏斗分析建议用 CTE 逐步筛选各步骤用户集合',
      '多维分析提示 AI 使用 GROUPING SETS / ROLLUP',
    ],
    quickStart: [
      '1. 选择包含时间列的数据表',
      '2. 描述分析场景（如：统计最近 30 天每日新增用户）',
      '3. AI 填充生成基础聚合 SQL',
      '4. 在结果区切换「图表」模式查看趋势',
      '5. 保存为指标收藏',
    ],
    bestPractices: [
      '时间截断统一使用 date_trunc，保证粒度一致',
      '指标计算使用 FILTER 子句代替 CASE WHEN，可读性更高',
      '多指标并列时用 CTE 分别计算后 JOIN 合并',
      '避免在 WHERE 中对聚合列过滤，改用 HAVING',
    ],
    duckdbSpecific: [
      'date_trunc(\'month\', ts) — 时间截断',
      'GROUPING SETS / ROLLUP / CUBE — 多维聚合',
      'FILTER (WHERE condition) — 条件聚合',
      'quantile_cont(0.5) WITHIN GROUP (ORDER BY col) — 中位数',
    ],
    exampleFlows: [
      { name: '日活趋势', description: 'date_trunc + COUNT(DISTINCT user_id)' },
      { name: '同比计算', description: 'LAG(value, 12) OVER (PARTITION BY ... ORDER BY month)' },
      { name: '漏斗分析', description: 'CTE 逐步筛选 → LEFT JOIN → 计算转化率' },
    ],
  },

  // ── 类别三：数据转换 ──────────────────────────────────────
  dataTransform: {
    title: '数据转换 / 清洗',
    description: '适用于数据预处理场景，包括列转行、行转列、类型转换、字符串处理与去重等操作。',
    scenarios: [
      '宽表转长表（多列 → 行）',
      '长表转宽表（行 → 多列）',
      '字段类型转换与格式标准化',
      '字符串提取、分割与拼接',
      '去重与数据质量检查',
    ],
    commonErrors: [
      'CAST 类型不兼容导致静默 NULL（应先用 TRY_CAST）',
      'UNPIVOT 时列数据类型不一致导致报错',
      'regexp_extract 捕获组序号写错（DuckDB 从 0 开始）',
      '字符串拼接使用 + 而非 || 或 concat()',
      '去重时未考虑大小写或前后空格差异',
    ],
    aiHints: [
      '描述「从哪种格式转为哪种格式」，AI 可直接生成 PIVOT/UNPIVOT',
      '类型转换场景提示 AI 使用 TRY_CAST 以防错误中断',
      '正则提取场景提供示例字符串，AI 生成结果更准确',
      '去重场景说明去重键字段，AI 会生成 QUALIFY ROW_NUMBER() 逻辑',
    ],
    quickStart: [
      '1. 确认源数据的列结构（可使用 SUMMARIZE 快速查看）',
      '2. 描述目标格式（如：把 q1/q2/q3/q4 列转为 quarter / value 两列）',
      '3. AI 填充生成 UNPIVOT 或 PIVOT 语句',
      '4. 执行并检查结果行数是否符合预期',
      '5. 如有异常，使用 TRY_CAST + COALESCE 补全缺失值',
    ],
    bestPractices: [
      '类型转换优先使用 TRY_CAST 而非 CAST，避免整批失败',
      '字符串处理统一使用 lower() + trim() 标准化后再比较',
      '去重使用 QUALIFY ROW_NUMBER() OVER (...) = 1 效率最高',
      '清洗逻辑用 CTE 分层，方便定位问题步骤',
    ],
    duckdbSpecific: [
      'PIVOT col FOR key IN (v1, v2, v3) — 原生行转列',
      'UNPIVOT tbl ON (c1, c2, c3) INTO name k value v — 原生列转行',
      'TRY_CAST(col AS INTEGER) — 安全类型转换',
      'regexp_extract(col, pattern, 0) — 正则提取（从第 0 组开始）',
    ],
    exampleFlows: [
      { name: '宽转长', description: 'UNPIVOT 多个季度列 → quarter + value' },
      { name: '长转宽', description: 'PIVOT category OVER month → 交叉表' },
      { name: '字段清洗', description: 'TRY_CAST + COALESCE + trim + lower' },
    ],
  },

  // ── 类别四：性能调优 ──────────────────────────────────────
  performanceTuning: {
    title: '执行计划 / 性能优化',
    description: '适用于慢查询诊断与改写，通过 EXPLAIN 分析执行路径，定位性能瓶颈并提出优化方案。',
    scenarios: [
      '查询执行时间超出预期，需要定位慢节点',
      '大表 JOIN 时内存占用过高',
      '扫描行数远多于实际返回行数',
      '复杂子查询可改写为更高效的形式',
    ],
    commonErrors: [
      '未使用 EXPLAIN ANALYZE 导致只看到计划而非实际执行数据',
      '过早 JOIN 大表而未先过滤（应先 WHERE 再 JOIN）',
      '在 WHERE 中对列做函数操作，导致无法利用分区裁剪',
      '使用 SELECT * 导致不必要的列读取',
      '忽略 Parquet 文件的列式存储优势，查询过多列',
    ],
    aiHints: [
      '将 EXPLAIN ANALYZE 输出粘贴给 AI，让其定位最耗时节点',
      '描述表的大小与数据分布，AI 给出的优化建议更有针对性',
      '提示 AI「将子查询改为 JOIN」或「尝试 CTE 物化」',
      '询问 AI「是否可以下推 WHERE 条件」减少扫描量',
    ],
    quickStart: [
      '1. 在编辑器前加 EXPLAIN ANALYZE 执行目标查询',
      '2. 查看执行计划中各节点的耗时与行数',
      '3. 将执行计划文本粘贴至 AI 输入框，描述优化目标',
      '4. AI 生成改写版本，对比执行时间',
      '5. 确认结果一致后替换原查询',
    ],
    bestPractices: [
      '先 WHERE 过滤，后 JOIN，减少参与连接的行数',
      '避免在 WHERE 条件中对列做函数（用计算列代替）',
      '读取 Parquet 时只 SELECT 需要的列',
      '复杂 CTE 可用 MATERIALIZED 强制物化，避免重复计算',
    ],
    duckdbSpecific: [
      'EXPLAIN ANALYZE query — 查看实际执行计划与耗时',
      'PRAGMA threads=N — 调整并行线程数',
      'SET memory_limit=\'4GB\' — 限制内存使用',
      'CREATE TABLE t AS SELECT ... — 物化中间结果',
    ],
    exampleFlows: [
      { name: '慢查询诊断', description: 'EXPLAIN ANALYZE → 定位扫描节点 → 下推 WHERE' },
      { name: '大表 JOIN 优化', description: '先过滤小表 → Broadcast JOIN → 减少 Shuffle' },
      { name: '子查询改写', description: '相关子查询 → LEFT JOIN + COALESCE' },
    ],
  },

  // ── 类别五：实用工具 ──────────────────────────────────────
  utilities: {
    title: '实用工具 / 辅助',
    description: '适用于测试数据生成、数据摘要统计、随机抽样等辅助性场景，快速了解数据概况。',
    scenarios: [
      '快速生成模拟数据用于功能测试',
      '查看数据分布与统计摘要',
      '从大表中随机抽取样本',
      '检查数据质量（缺失值、重复值、异常值）',
    ],
    commonErrors: [
      'generate_series 范围参数填错导致生成数据量异常',
      'random() 种子未固定，每次运行结果不同影响可重现性',
      'USING SAMPLE 语法与 TABLESAMPLE 混淆',
      'SUMMARIZE 结果中 NULL 比例列名拼写易错（null_percentage）',
      '数据质量检查时忘记对字符串类型做 trim 去空格',
    ],
    aiHints: [
      '描述「需要几行、哪些字段、什么类型的测试数据」，AI 直接生成 INSERT',
      '摘要统计场景直接用「SUMMARIZE 表名」，AI 可进一步解读结果',
      '抽样场景提示 AI 使用 USING SAMPLE 语法，指定行数或百分比',
      '质量检查场景提示 AI 生成「缺失值 / 重复值 / 范围异常」三合一检查 SQL',
    ],
    quickStart: [
      '1. 选择目标用途（生成数据 / 摘要统计 / 抽样 / 质量检查）',
      '2. 在 AI 输入框描述需求（如：生成 1000 行用户订单测试数据）',
      '3. AI 填充生成对应 SQL',
      '4. 执行并检查结果',
      '5. 可保存为片段模板复用',
    ],
    bestPractices: [
      '测试数据生成固定随机种子（setseed(0.42)），保证可重现',
      '摘要统计优先使用 SUMMARIZE，比手写 COUNT/AVG 更全面',
      '大表抽样使用 USING SAMPLE N ROWS（精确行数）而非百分比',
      '质量检查结果用 UNION ALL 合并，方便一次性审查',
    ],
    duckdbSpecific: [
      'SUMMARIZE table_name — 一行代码生成全列统计摘要',
      'SELECT * FROM range(1, 1001) — 生成序列',
      'SELECT * FROM t USING SAMPLE 100 ROWS — 精确行数抽样',
      'setseed(0.42) — 固定随机种子',
    ],
    exampleFlows: [
      { name: '测试数据', description: 'generate_series + random() + setseed() → INSERT INTO' },
      { name: '数据摘要', description: 'SUMMARIZE → 解读 null_percentage / min / max / avg' },
      { name: '质量检查', description: 'NULL 检查 + 重复检查 + 范围检查 → UNION ALL 汇总' },
    ],
  },
};
```

---

## 三、UI 布局设计规范

### 3.1 整体布局结构

```
┌──────────────────────────────────────────────────────────────┐
│  SQL 编辑器 Header                                            │
│  [标签页: 查询1 | 查询2 | +]           [历史] [收藏] [设置]    │
├──────────────────────────────────────────────────────────────┤
│  AI 助手工具栏                                                 │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 🤖 [AI 填充] [片段库 ▾] [快速清除]    [实时预览 ●/○]  │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 自然语言输入框：描述你的 SQL 需求...        [生成 SQL] │    │
│  └──────────────────────────────────────────────────────┘    │
├────────────────────────┬─────────────────────────────────────┤
│  侧边栏                 │  SQL 编辑主区域                      │
│  ─ 📋 历史记录          │  ┌──────────────────────────────┐   │
│  ─ ⭐ 收藏查询          │  │  CodeMirror 编辑器            │   │
│  ─ 📦 片段库            │  │  语法高亮 / 自动补全           │   │
│  ─ 🗂 表结构浏览        │  │  格式化 / 折叠                │   │
│  ─ ❓ 模块背景说明      │  └──────────────────────────────┘   │
│                        │  SQL 预览区（AI 草稿，可复制）        │
├────────────────────────┴─────────────────────────────────────┤
│  结果区                                                        │
│  [表格] [图表] [JSON] [EXPLAIN]         [耗时: xx ms] [导出]   │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 配色规范（Monokai 主题）

| UI 元素 | 配色 | Tailwind 类 |
|---------|------|------------|
| 主执行按钮 | 渐变紫→粉 | `bg-gradient-to-r from-monokai-purple to-monokai-pink` |
| AI 填充按钮 | 绿色 | `bg-monokai-green/10 border-monokai-green/40 text-monokai-green` |
| 快速清除按钮 | 粉色 | `bg-monokai-pink/10 border-monokai-pink/40 text-monokai-pink` |
| 实时预览开启 | 紫色 | `bg-monokai-purple/20 text-monokai-purple` |
| 片段库标签 | 黄色 | `bg-monokai-yellow/10 text-monokai-yellow` |
| 背景 | 深色 | `bg-monokai-bg` |
| 侧边栏 | 稍浅 | `bg-monokai-sidebar` |
| 结果区边框 | 边框线 | `border-monokai-border` |

---

## 四、核心交互流程

### 4.1 AI 一键填充流程

```
用户点击「AI 填充」
        ↓
读取当前选中表名 + 列信息
        ↓
读取顶部自然语言输入框内容
        ↓
合并上下文 → 调用 generateSqlAIFillPrompt()
        ↓
将生成结果插入 SQL 编辑器（光标位置 / 全替换）
        ↓
显示「已填充」Toast 提示（1.5s 自动消失）
```

### 4.2 快速清除流程

```
用户点击「快速清除」
        ↓
保存当前内容到撤销栈（lastClearedContent）
        ↓
[可选] 弹出确认对话框（默认开启，可在设置关闭）
        ↓
清空 SQL 编辑器内容
清空自然语言输入框
重置执行结果展示区
        ↓
显示「已清除」Toast + 撤销入口（5s 内可点击 Ctrl+Z 恢复）
```

### 4.3 实时预览流程

```
用户修改自然语言输入框（防抖 500ms）
        ↓
校验输入非空
        ↓
调用 AI 生成 SQL 草稿（simulateOnly 模式）
        ↓
将草稿展示于编辑器下方预览区（灰色背景，只读）
        ↓
显示「复制到编辑器」按钮
```

### 4.4 模块背景说明触发流程

```
用户点击侧边栏「❓ 模块背景说明」
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
  · DuckDB 专有语法
        ↓
用户可将提示内容「一键复制到 AI 输入框」
```

---

## 五、技术实现要点

### 5.1 状态管理结构

```typescript
interface SqlEditorState {
  // 编辑内容
  tabs: SqlTab[];                    // 多标签页列表
  activeTabId: string;               // 当前激活标签
  aiNaturalLanguageInput: string;    // 自然语言描述输入

  // AI 状态
  isAiFilling: boolean;              // AI 填充 Loading
  isGeneratingPreview: boolean;      // 预览生成 Loading
  showLivePreview: boolean;          // 是否开启实时预览
  liveSqlPreview: string;            // 实时预览内容

  // 清除与撤销
  lastClearedContent: {
    sql: string;
    aiInput: string;
  } | null;

  // 侧边栏
  activeSidePanel: 'history' | 'favorites' | 'snippets' | 'schema' | 'help' | null;
  activeHelpCategory: keyof typeof SQL_EDITOR_CATEGORY_HELP;
}
```

### 5.2 关键函数列表

| 函数名 | 功能 | 输入 | 输出 |
|-------|------|------|------|
| `handleAIFill` | AI 一键填充 | currentTable, columns, aiInput | 更新 SQL 编辑器内容 |
| `handleInsertSnippet` | 插入代码片段 | snippetId | 在光标位置插入模板 |
| `handleQuickClear` | 快速清除 | - | 清空 SQL + AI 输入 |
| `handleUndoClear` | 撤销清除 | - | 恢复 lastClearedContent |
| `generateLivePreview` | 实时生成 SQL 草稿 | aiInput, context | SQL 字符串 |
| `handleApplyPreview` | 应用草稿到编辑器 | previewSql | 更新 activeTab SQL |
| `handleFormatSql` | 格式化 SQL | - | 格式化当前 Tab SQL |
| `handleExplainSql` | 执行计划查看 | - | 在结果区展示 EXPLAIN |

### 5.3 防抖与性能优化

- **实时预览防抖**：500ms，避免用户输入中途频繁触发 AI 调用
- **历史记录本地化**：`localStorage` 持久化，内存中最多保留最近 100 条
- **撤销栈**：仅保留最近 10 次清除操作，避免内存累积
- **代码片段懒加载**：片段库数据在用户首次点击时加载，不阻塞初始渲染

---

## 六、可选增强功能

### 6.1 SQL 语法本地验证
- 集成 `sql-formatter` 对 SQL 做格式化与基础语法检查
- 在编辑器 gutter 处显示行级错误提示，无需执行即可发现语法问题

### 6.2 执行计划可视化
- 将 `EXPLAIN ANALYZE` 文本输出解析为树状结构
- 以节点图展示各步骤耗时与行数，高亮最慢节点

### 6.3 查询模板市场
- 用户可将常用查询保存为命名模板
- 支持导出为 JSON 文件，实现跨项目复用
- 内置 20+ DuckDB 最佳实践模板（开箱即用）

### 6.4 多结果对比（Result Diff）
- 支持在两个标签页查询结果之间进行行级差异对比
- 用于验证 SQL 改写前后结果是否一致

---

## 七、验收标准

| 验收项 | 验收标准 | 测试方法 |
|--------|---------|---------|
| AI 一键填充 | 选中表后点击按钮，编辑器出现上下文相关 SQL | 选表 → 填充 → 检查字段名是否匹配 |
| 自然语言生成 | 输入描述后 1s 内出现 SQL 预览草稿 | 输入 → 等待 500ms → 检查预览区 |
| 代码片段插入 | 点击片段标签后 SQL 在光标处插入，不覆盖全文 | 打开片段库 → 点击模板 → 检查插入位置 |
| 快速清除 | 点击后 SQL 与 AI 输入框全部清空 | 填写内容 → 清除 → 检查所有字段为空 |
| 撤销清除 | Ctrl+Z 后内容恢复为清除前状态 | 清除 → Ctrl+Z → 检查内容一致性 |
| 模块背景说明 | 侧边栏展示五类 MECE 帮助内容，各类均有场景/错误/提示 | 点击各标签 → 检查内容完整性 |
| 实时预览开关 | 关闭后输入内容不触发 AI 调用 | 关闭预览 → 输入内容 → 观察网络请求 |
| 执行计划 | EXPLAIN ANALYZE 结果在结果区单独展示 | 执行 EXPLAIN → 检查结果区标签 |

---

## 八、参考实现

详见以下组件，可直接复用相关逻辑：

| 参考文件 | 可复用内容 |
|---------|---------|
| `components/SkillInvoker.tsx` | `handleAIFill`、`handleClear`、`CATEGORY_HELP` 数据结构、实时预览逻辑 |
| `components/SqlEditor.tsx` | CodeMirror 编辑器集成、历史记录管理、多标签页状态 |
| `components/ExplainPlanViewer.tsx` | EXPLAIN 结果解析与可视化 |
| `components/ResultDiff.tsx` | 查询结果差异对比 |

**迁移优先级**：
1. ✅ 优先迁移 `CATEGORY_HELP` → `SQL_EDITOR_CATEGORY_HELP`（内容直接可用）
2. ✅ 复用 `handleClear` 逻辑与快速清除按钮样式
3. ✅ 适配 `handleAIFill` → 接入 SQL 编辑器上下文（当前表/列）
4. 🔲 新增自然语言输入框与实时预览区域
5. 🔲 新增代码片段库侧边栏
