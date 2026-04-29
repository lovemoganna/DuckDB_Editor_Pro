/**
 * DuckDB Official Handbook Skills - Generated from .agent/skills
 * 
 * Total: 28 official rules/standards.
 */

export interface OfficialHandbookSkill {
  id: string;
  name: string;
  content: string;
  fileName: string;
  triggers?: string[];
  intent?: string;
}

export const OFFICIAL_HANDBOOK_SKILLS: OfficialHandbookSkill[] = [
  {
    "id": "SKL-000",
    "name": "系统输出协议 — 工程手册模式",
    "content": "# SKL-000: 系统输出协议 — 工程手册模式 (Handbook Protocol)\r\n\r\n## 认知层级：感知层元指令 (Meta-Perception)\r\n\r\n本模块定义了所有 AI 输出的最高级结构格式，确保 DuckDB 分析结果表现为一份专业、可执行的“工程手册”。\r\n\r\n## 全局结构规范\r\n\r\n手册必须包含以下五大核心板块：\r\n\r\n1. **标题栏**: `# DuckDB 系统化 SQL 教程 —— 以「{业务场景/表名}」为例`\r\n2. **目录总览**: \r\n   - 必须包含“第一批次”、“第二批次”等层级。\r\n   - 标注当前手册所属的批次。\r\n3. **前言与环境准备**: 简述背景、环境要求。\r\n4. **阅读约定**: \r\n   - 必须包含符号说明表（📸, ⚠️, -- ← 已修改 等）。\r\n5. **领域建模 (ER图)**: \r\n   - 使用 `mermaid erDiagram` 描述当前表的逻辑地位或与关联表的结构。\r\n\r\n## 强制模块结构\r\n\r\n对于每一个分析模块（如 A1, B2），必须严格遵循以下 Markdown 结构：\r\n\r\n### [模块号] ▸ [功能名称]\r\n\r\n**🎯 解决什么问题**\r\n- 简述该逻辑解决的业务或数据痛点。\r\n\r\n**📌 语法模板**\r\n```sql\r\n-- 抽象化的 DuckDB 语法模板\r\n[SELECT / CREATE / PIVOT ...]\r\n```\r\n\r\n**💻 可执行示例**\r\n```sql\r\n-- 基于当前上下文 {tableName} 的具体 SQL 示例\r\n[SQL CODE]\r\n```\r\n\r\n**📊 预期输出**\r\n- Markdown 表格形式展示样例输出结果。\r\n\r\n**⚠️ 易错点 / 最佳实践**\r\n- 针对 DuckDB 特特性（如向量化执行、WASM 内存限制）的专家提示。\r\n\r\n**🔗 上下文衔接**\r\n- 说明该步骤与下一步骤的逻辑关联。\r\n\r\n## 批次快照 (Snapshot)\r\n在每一批次（Batch）结束时，必须使用 `📸 模块 X 结束 — 当前数据快照` 板块展示当前表的最新状态。\r\n\r\n",
    "fileName": "skill-000-protocol.md",
    "triggers": ["protocol", "format", "handbook", "structure", "layout", "template", "规范", "格式", "输出"],
    "intent": "META_PROTOCOL"
  },
  {
    "id": "SKL-101",
    "name": "语境与语义探针",
    "content": "# SKL-101: 语境与语义探针 (Context & Semantic Probe)\r\n\r\n## 认知层级：感知层 (Perception Layer)\r\n\r\n作为 AI Agent 的“眼睛”，本模块负责构建对原始数据的初步物理与逻辑认知，不产生任何数据变更。\r\n\r\n## 核心任务\r\n\r\n### 1. 场景探针 (Stage 0: Scene Probe)\r\n分析基础元数据：\r\n- 表名: ${tableName}\r\n- 行数: ${rowCount}\r\n- 列数: ${colCount}\r\n- 预览: ${sampleData}\r\n\r\n推断用户意图。\r\n\r\n**意图分类 (MECE):**\r\n- **DATA_CLEANING**: 缺失值填充、格式标准化、脱敏。\r\n- **METRIC_MODELING**: 定义指标、聚合分析、维度建模。\r\n- **EXPLORATION**: 随机抽样、相关性探索、分布审计。\r\n- **REPORTING**: 预警、日报生成、执行摘要。\r\n\r\n### 2. 语义推断 (Stage 1: Semantic Inference)\r\n推断字段的业务语义，而非仅逻辑类型。\r\n\r\n| 字段特征 | 物理类型 | 映射语义 (MECE) | 推荐处理 |\r\n|----------|----------|----------------|----------|\r\n| ID, UUID | VARCHAR | **IDENTITY** (唯一标识) | 检查唯一性，建立关联 |\r\n| Name, Desc | VARCHAR | **DIMENSION** (描述维度) | 分类汇总 |\r\n| Price, Count | DOUBLE/INT | **MEASURE** (度量统计) | 聚合计算 (Sum/Avg) |\r\n| CreatedAt | TIMESTAMP | **TEMPORAL** (时间序列) | 趋势分析、同比环比 |\r\n| Phone, Email| VARCHAR | **SENSITIVE** (敏感信息) | 标记 PII，触发治理层 |\r\n\r\n## 输出规范\r\n\r\n必须包含以下 JSON 对象：\r\n\r\n```json\r\n{\r\n  \"recommendedIntent\": \"DATA_CLEANING | METRIC_MODELING | ...\",\r\n  \"confidence\": 0.95,\r\n  \"columns\": [\r\n    {\r\n      \"name\": \"col_a\",\r\n      \"semanticType\": \"IDENTITY | DIMENSION | ...\",\r\n      \"isPII\": true/false,\r\n      \"description\": \"业务含义描述\"\r\n    }\r\n  ]\r\n}\r\n```\r\n\r\n## Handbook Protocol (SKL-000) 约束\r\n- 本技能是手册“领域建模”的核心驱动。必须在 **1.1 ER 关系图** 板块中使用 `mermaid erDiagram` 展示当前表的字段拓扑。\r\n- 必须在 **🎯 解决什么问题** 中解释物理列名映射到业务语义的必要性。\r\n- 必须在 **📊 预期输出** 中展示字段映射后的业务视图表格。\r\n\r\n",
    "fileName": "skill-101-semantic.md",
    "triggers": ["semantic", "intent", "naming", "metadata", "probe", "探针", "语义", "意图", "字段描述"],
    "intent": "SCENE_PROBE"
  },
  {
    "id": "SKL-102",
    "name": "数据质量审计",
    "content": "# SKL-102: 数据质量审计 (Data Quality Audit)\r\n\r\n## 认知层级：感知层 (Perception Layer)\r\n\r\n作为 AI Agent 的“体检仪”，本模块负责深度扫描数据质量隐患，识别完整性、准确性和一致性问题。\r\n\r\n## 审计维度 (MECE)\r\n\r\n### 1. 完整性 (Completeness)\r\n- **Null 率**: 识别关键列的缺失情况。\r\n- **孤岛检测**: 检查外键关联的断裂情况。\r\n\r\n### 2. 有效性 (Validity)\r\n- **逻辑区间**: 如“年龄”在 0-150 之间，“评分”在 0-5 之间。\r\n- **格式合规**: 检查日期格式、JSON 字符串是否可解析。\r\n\r\n### 3. 一致性 (Consistency)\r\n- **枚举冲突**: “男/M/Male” 是否存在多种表达。\r\n- **精算平衡**: 识别“总额”是否等于“分项之和”。\r\n\r\n## 执行策略\r\n\r\n1. **多级扫描**:\r\n   - `L1`: 基于 DuckDB `SUMMARIZE` 的快速分布统计。\r\n   - `L2`: 针对异常枚举的 `GROUP BY` 频率分布。\r\n   - `L3`: 针对 PII 疑似字段的正规匹配校验。\r\n\r\n## 输出建议\r\n\r\n每个质量问题必须伴随一个 **修复处方**:\r\n- `REASON`: 为什么是问题？\r\n- `IMPACT`: 影响哪些后续分析（如：Null 导致 Sum 偏低）。\r\n- `FIX`: 建议的补救措施（删除/填充/修复）。\r\n\r\n## 质量记分卡\r\n\r\n| 维度 | 得分 (0-100) | 核心发现 |\r\n|------|------------|----------|\r\n| 完整性 | 85 | `user_id` 存在 15% 空值 |\r\n| 有效性 | 100 | 无格式错误 |\r\n| 安全性 | 20 | **检测到 3 列明文 PII** |\r\n\r\n> ⚠️ 如果安全性得分低于 60，必须自动挂起流水线，移交至 `SKL-201-Governance` 处理。\r\n",
    "fileName": "skill-102-quality.md",
    "triggers": ["quality", "audit", "null", "consistency", "validity", "completeness", "审计", "质量", "空值", "一致性"],
    "intent": "QUALITY_AUDIT"
  },
  {
    "id": "SKL-103",
    "name": "时间特征探测器",
    "content": "# SKL-103: 时间特征探测器 (Time Character Detector)\r\n\r\n## 认知层级：感知层 (Perception Layer)\r\n\r\n作为 AI Agent 的“计步器”，本模块负责识别数据中的时序脉络、业务周期及时间轴特征，不进行数据转换。\r\n\r\n## 核心任务\r\n\r\n### 1. 周期敏感度识别\r\n分析 Timestamp/Date 字段，推断是否存在以下周期特征：\r\n- **CALENDAR_YEAR**: 标准日历年特征。\r\n- **FISCAL_YEAR**: 财年特征（如 4月开始）。\r\n- **PROMO_SEASON**: 大促脉冲（如 双11, 618）。\r\n- **WEEKLY_PATTERN**: 明显的周中/周末差异。\r\n\r\n### 2. 粒度感应\r\n识别当前数据集的最佳分析粒度：\r\n- `YEAR` | `QUARTER` | `MONTH` | `WEEK` | `DAY` | `HOUR`\r\n\r\n## 输出规范\r\n\r\n必须返回以下 JSON 片段：\r\n```json\r\n{\r\n  \"timeCharacter\": {\r\n    \"primaryTimeColumn\": \"created_at\",\r\n    \"detectedCycles\": [\"WEEKLY_PATTERN\", \"MONTHLY_CLOSURE\"],\r\n    \"granularity\": \"DAY\",\r\n    \"isSparse\": false\r\n  }\r\n}\r\n```\r\n",
    "fileName": "skill-103-time.md",
    "triggers": ["time", "temporal", "period", "trend", "timestamp", "date", "时间", "周期", "趋势", "日期"],
    "intent": "TIME_DETECTOR"
  },
  {
    "id": "SKL-104",
    "name": "跨表关联感应器",
    "content": "# SKL-104: 跨表关联感应器 (Cross-table Relation Sensor)\r\n\r\n## 认知层级：感知层 (Perception Layer)\r\n\r\n作为 AI Agent 的“雷达”，本模块负责在多表环境下感知潜在的逻辑关联、外键契约及 JOIN 路径。\r\n\r\n## 核心任务\r\n\r\n### 1. 关联路径发现\r\n基于列名（如 `xxx_id`, `id`）与数据分布，探测可能的 JOIN 关系：\r\n- **1:1**: 事实表与维度表关联。\r\n- **1:N**: 事实表与维度表关联。\r\n- **M:N**: 关联桥接表。\r\n\r\n### 2. JOIN 契约预判\r\n识别表间合并时的潜在风险：\r\n- **Fan-out Error**: 1:N 关联导致度量值被错误放大。\r\n- **Missing Keys**: 关联键存在大量 Null 或不匹配。\r\n\r\n## Handbook Protocol (SKL-000) 约束\r\n- 必须在 **领域建模 (ER图)** 中展示当前表与其他 1-2 个核心关联表的连接（1:N 或 M:N）。\r\n- 在 **🔗 上下文衔接** 中明确预估后续批次（如“第二批次：多表连接模块 B”）的实施计划。\r\n\r\n",
    "fileName": "skill-104-relation.md",
    "triggers": ["join", "relation", "foreign key", "er", "modeling", "关联", "连接", "外键", "建模"],
    "intent": "RELATION_SENSOR"
  },
  {
    "id": "SKL-105",
    "name": "本地化编码卫士",
    "content": "# SKL-105: 本地化编码卫士 (Localization & Collation Guard)\r\n\r\n## 认知层级：感知层 (Perception Layer)\r\n\r\n作为 AI Agent 的“翻译官”，本模块负责识别区域化字符特征，确保护排序、过滤在中文等环境下的物理准确性。\r\n\r\n## 核心任务\r\n\r\n### 1. 编码与排序感应\r\n- 识别字段是否包含中文（CJK）字符。\r\n- 探测当前的排序策略是否会导致 `GROUP BY` 或 `ORDER BY` 结果异常（如拼音排序 vs 笔画排序）。\r\n\r\n### 2. 乱码预防\r\n识别是否存在潜在的转码风险（如 GBK 混入 UTF-8）。\r\n\r\n## 输出规范\r\n\r\n必须返回以下 JSON 片段：\r\n```json\r\n{\r\n  \"localization\": {\r\n    \"hasCJK\": true,\r\n    \"recommendedCollation\": \"zh_CN\",\r\n    \"handlingStrategy\": \"USE_ICU_EXTENSION\"\r\n  }\r\n}\r\n```\r\n\r\n## 物理建议\r\n对于 DuckDB，如果 `hasCJK` 为 true，在生成 SQL 时应建议下载并加载 `icu` 扩展：\r\n`INSTALL icu; LOAD icu;`\r\n",
    "fileName": "skill-105-localization.md",
    "triggers": ["localization", "chinese", "collation", "encoding", "icu", "cjk", "编码", "排序", "中文", "本地化"],
    "intent": "LOCALIZATION_GUARD"
  },
  {
    "id": "SKL-106",
    "name": "变更感知基准仪",
    "content": "# SKL-106: 变更感知基准仪 (Change & Drift Benchmarker)\r\n\r\n## 认知层级：感知层 (Perception Layer)\r\n\r\n作为 AI Agent 的“记忆记录仪”，本模块负责对比当前数据集与历史基准（Snapshot）的差异，识别 Schema Drift。\r\n\r\n## 核心任务\r\n\r\n### 1. 结构变更对比 (Drift Detection)\r\n识别与历史版本相比的变化：\r\n- **ADDED**: 新增字段。\r\n- **REMOVED**: 缺失字段（可能导致 SQL 报错）。\r\n- **MUTATED**: 类型变更（如 VARCHAR 转为 INT）。\r\n\r\n### 2. 数据量级波动\r\n感知数据行数的异常增减（如瞬间翻倍或腰斩）。\r\n\r\n## 输出规范\r\n\r\n必须返回以下 JSON 片段：\r\n```json\r\n{\r\n  \"drift\": {\r\n    \"status\": \"STABLE | DRIFTED\",\r\n    \"changes\": [\r\n      { \"column\": \"price\", \"type\": \"MUTATED\", \"detail\": \"FLOAT -> DOUBLE\" }\r\n    ],\r\n    \"volumeChange\": \"+15%\"\r\n  }\r\n}\r\n```\r\n",
    "fileName": "skill-106-drift.md",
    "triggers": ["drift", "change", "benchmark", "schema", "diff", "变更", "结构", "基准", "对比"],
    "intent": "DRIFT_BENCHMARKER"
  },
  {
    "id": "SKL-201",
    "name": "数据治理与安全合约",
    "content": "# SKL-201: 数据治理与安全合约 (Data Governance & Contract)\r\n\r\n## 认知层级：决策层 (Strategy Layer)\r\n\r\n作为 AI Agent 的“法律顾问”，本模块负责对感知层发现的风险点制定处理规则，并确立消费标准（SLA）。\r\n\r\n## 1. PII 治理规则 (Privacy Strategy)\r\n\r\n基于检测到的风险，定义脱敏策略：\r\n\r\n| 策略 (MECE) | 适用场景 | DuckDB 实现技术 |\r\n|-------------|----------|-----------------|\r\n| **MASK** | 保持业务特征 (如：138****8000) | `regexp_replace` |\r\n| **HASH** | 需要 Join 但不保留明文 | `md5(cast(col as varchar))` |\r\n| **DROP** | 冗余敏感信息 | `EXCLUDE (col_name)` |\r\n| **BLUR** | 泛化统计 (如：年龄 -> 年龄组) | `floor(age/10)*10` |\r\n\r\n## 2. 数据契约 (Data Contract)\r\n\r\n定义该数据集的物理与业务约束：\r\n\r\n- **主键契约 (PK)**: 必须 Unique & Not Null。\r\n- **值域契约 (Range)**: 核心度量的上限与下限。\r\n- **新鲜度契约 (SLA)**: 最后核验时间距离当前时间的间隔。\r\n\r\n## 决策逻辑\r\n\r\n1. **风险对齐**: 若 `SKL-101` 标记了 `isPII: true`，本模块必须输出脱敏 SQL 逻辑。\r\n2. **阻断声明**: 定义哪些契约失效属于 **FATAL**（必须停止流水线）。\r\n3. **策略归档**: 将处理决策记录 in `governance/` 目录中。\r\n\r\n## 交互范式\r\n\r\n```text\r\n检测到 PII 风险，建议执行以下治理：\r\n- 字段 [phone]: 策略 MASK (已自动应用)\r\n- 字段 [secret]: 策略 DROP (已自动应用)\r\n```\r\n",
    "fileName": "skill-201-governance.md",
    "triggers": ["governance", "privacy", "pii", "mask", "hash", "contract", "legal", "安全", "脱敏", "治理", "隐私"],
    "intent": "DATA_GOVERNANCE"
  },
  {
    "id": "SKL-202",
    "name": "洞察建模与因果推断",
    "content": "# SKL-202: 洞察建模与因果推断 (Metric & Insight Modeling)\r\n\r\n## 认知层级：决策层 (Strategy Layer)\r\n\r\n作为 AI Agent 的“分析师”，本模块负责将原始字段转化为业务指标，并推断数据间的因果链条或关联模式。\r\n\r\n## 1. 指标建模 (Metric Semantic)\r\n\r\n将 `SKL-101` 识别出的 `MEASURE` 字段升级为业务指标。\r\n\r\n- **总量/均值** (Standard)\r\n- **同比/环比分析** (Temporal)\r\n- **Top N 贡献分布** (Contribution)\r\n- **RFM / 转化漏斗** (Business Specific)\r\n\r\n## 2. 洞察发现矩阵 (MECE)\r\n\r\n- **🚨 异常型 (Anomaly)**: 超出 3-Sigma 范围的离群点，寻找突变根因。\r\n- **📈 趋势型 (Trend)**: 线性或周期性增长，识别季节性特征。\r\n- **⚙️ 驱动型 (Driver)**: A 的增长导致了 B 的下降（相关性与因果探索）。\r\n- **🧩 细分型 (Segment)**: 不同地域/品类间的表现显著差异。\r\n\r\n## 3. 分析模板映射 (SKL-009)\r\n\r\n基于用户意图 (`SKL-101.intent`) 匹配最佳 SQL 模板。\r\n\r\n| 用户意图 | 推荐模板 |\r\n|----------|----------|\r\n| DATA_CLEANING | 分布直方图、Null 值扫描 |\r\n| METRIC_MODELING | 窗口函数聚合、计算维度扩展 |\r\n| EXPLORATION | 相关性矩阵、Z-Score 检测 |\r\n| REPORTING | 环比增长、执行摘要 |\r\n\r\n## 任务执行\r\n\r\n- 生成 **Metric Glossary** (指标手册)。\r\n- 建立 **Dependency Graph** (指标依赖图)。\r\n- 提出 **轻量级假设** 等待验证。\r\n",
    "fileName": "skill-202-insight.md",
    "triggers": ["metric", "insight", "modeling", "causal", "anomaly", "trend", "指标", "洞察", "分析", "趋势", "异常"],
    "intent": "METRIC_MODELING"
  },
  {
    "id": "SKL-203",
    "name": "CTE 逻辑编排引擎",
    "content": "# SKL-203: CTE 逻辑编排引擎 (CTE Logic Orchestrator)\r\n\r\n## 认知层级：决策层 (Strategy Layer)\r\n\r\n作为 AI Agent 的“逻辑架构师”，本模块负责将复杂的业务逻辑拆解为清晰、解耦的 CTE 节点，确保代码的可维护性。\r\n\r\n## 核心任务\r\n\r\n### 1. 逻辑分层拆解\r\n强制执行以下编排顺序：\r\n- **BASE_LAYER**: 原始数据清洗（Type Cast, Rename）。\r\n- **FILTER_LAYER**: 业务过滤（PII Mask, Range Filter）。\r\n- **JOIN_LAYER**: 多表关联（如果适用）。\r\n- **AGG_LAYER**: 最终聚合计算。\r\n\r\n### 2. 语义命名\r\n每一个 CTE 必须具备明确的业务词义（如 `clean_orders`, `filtered_customer_metrics`），禁止使用 `t1`, `t2`。\r\n\r\n## 输出建议\r\n`WITH ... AS (...)` 是本模块的物理表现形式。\r\n\r\n## Handbook Protocol (SKL-000) 约束\r\n当应用本技能时，必须在 **📌 语法模板** 中展示 CTE 框架，并在 **💻 可执行示例** 中使用业务命名（如 `clean_events`）。\r\n每一个 CTE 节点应对应手册中的一个子模块，并配以 **📊 预期输出** 说明该中间状态。\r\n",
    "fileName": "skill-203-cte.md",
    "triggers": ["cte", "with", "orchestrator", "logic", "architecture", "架构", "逻辑", "分层"],
    "intent": "CTE_ORCHESTRATOR"
  },
  {
    "id": "SKL-204",
    "name": "客户端性能策略师",
    "content": "# SKL-204: 客户端性能策略师 (WASM Performance Strategist)\r\n\r\n## 认知层级：决策层 (Strategy Layer)\r\n\r\n作为 AI Agent 的“性能顾问”，本模块负责评估 DuckDB-WASM 在浏览器环境下的资源深度约束（如 4GB 内存上限）。\r\n\r\n## 核心任务\r\n\r\n### 1. 采样策略决策 (Sampling)\r\n- 当 `rowCount > 500,000` 时，自动建议对 `SUM/AVG` 外的探索操作使用 `USING SAMPLE 10%`。\r\n- 优先建议使用 `SAMPLE 1000` 进行预览。\r\n\r\n### 2. 计算下推建议\r\n- 对于超大 Parquet 文件，建议利用 Metadata 过滤（Projection Pushdown）。\r\n\r\n## 输出规范\r\n在生成 SQL 前，必须检测内存上下文：\r\n- 若内存预估紧张，注入 `SET memory_limit = '2GB';`。\r\n",
    "fileName": "skill-204-wasm.md",
    "triggers": ["wasm", "performance", "memory", "sample", "optimization", "性能", "内存", "采样", "优化"],
    "intent": "WASM_STRATEGIST"
  },
  {
    "id": "SKL-205",
    "name": "合规性与抹除策略",
    "content": "# SKL-205: 合规性与抹除策略 (Compliance & Erasure Policy)\r\n\r\n## 认知层级：决策层 (Strategy Layer)\r\n\r\n作为 AI Agent 的“安全官”，本模块负责在检测到 PII 后，制定最终的物理隔离与字段级抹除策略。\r\n\r\n## 核心任务\r\n\r\n### 1. 永久掩码策略\r\n- 定义哪些字段必须被正则脱敏（如 Phone, Email）。\r\n- 决定是使用 `md5` 混淆还是直接 `EXCLUDE`。\r\n\r\n### 2. 导出规则\r\n- 禁止在本地未加密存储中保留 `isPII` 标记的明文字段。\r\n\r\n## 决策契约\r\n若 `SKL-101` 感知触发 `SENSITIVE`，本模块必须强制在 `SKL-301` 执行层注入脱敏代码。\r\n",
    "fileName": "skill-205-compliance.md",
    "triggers": ["compliance", "erasure", "policy", "security", "gdpr", "合规", "安全", "策略"],
    "intent": "COMPLIANCE_POLICY"
  },
  {
    "id": "SKL-206",
    "name": "指标语义工场",
    "content": "# SKL-206: 指标语义工场 (Metric Semantic Factory)\r\n\r\n## 认知层级：决策层 (Strategy Layer)\r\n\r\n作为 AI Agent 的“业务分析师”，本模块负责将物理字段映射为业务指标，构建标准化的 Metric Glossary。\r\n\r\n## 核心任务\r\n\r\n### 1. 派生指标定义\r\n- 自动识别复合指标（如：转化率 = 支付/访问）。\r\n- 定义指标的统计频率与汇总策略。\r\n\r\n### 2. 业务单位对齐\r\n- 识别金额单位（元/分/万）。\r\n- 确保所有的 `MEA` 类型列具备可理解的中文标题。\r\n\r\n## 输出规范\r\n```json\r\n{\r\n  \"metrics\": [\r\n    { \"key\": \"gmv\", \"formula\": \"sum(price * qty)\", \"label\": \"交易总额\" }\r\n  ]\r\n}\r\n```\r\n",
    "fileName": "skill-206-metric.md",
    "triggers": ["metric", "factory", "glossary", "formula", "label", "指标", "公式", "定义"],
    "intent": "METRIC_FACTORY"
  },
  {
    "id": "SKL-207",
    "name": "动态多租户隔离策略",
    "content": "# SKL-207: 动态多租户隔离策略 (Dynamic Isolation Policy)\r\n\r\n## 认知层级：决策层 (Strategy Layer)\r\n\r\n作为 AI Agent 的“沙箱管理员”，本模块负责在多用户或多租户环境下，制定物理会话级别的隔离方案。\r\n\r\n## 核心任务\r\n\r\n### 1. ATTACH 路径决策\r\n- 为每一个新租户数据生成独立的 `.db` 文件。\r\n- 自动生成 `ATTACH 'tenant_x.db' AS sandbox;` 指令。\r\n\r\n### 2. 权限受限视图 (Restricted View)\r\n- 仅公开用户有权访问的表，屏蔽核心 System 表。\r\n\r\n## 安全性要求\r\n确保 AI 生成的 SQL 不含有 `SELECT * FROM system.xxx` 之类的越权扫描。\r\n",
    "fileName": "skill-207-isolation.md",
    "triggers": ["isolation", "multi-tenant", "sandbox", "attach", "security", "多租户", "隔离", "沙箱"],
    "intent": "ISOLATION_POLICY"
  },
  {
    "id": "SKL-301",
    "name": "SQL 自动化工程",
    "content": "# SKL-301: SQL 自动化工程 (SQL Engineering & Execution)\r\n\r\n## 认知层级：执行层 (Execution Layer)\r\n\r\n作为 AI Agent 的“手”，本模块负责将感知层与决策层的意图落地为高性能、健壮的 DuckDB SQL。\r\n\r\n## 1. 健壮性规则 (Robustness)\r\n\r\n### 幂等化操作 (SKL-013)\r\n- **CREATE**: 必须使用 `IF NOT EXISTS` 或 `OR REPLACE`。\r\n- **INSERT**: 优先使用 `INSERT OR IGNORE` 或先 `DELETE` 旧 Batch。\r\n- **ALTER**: 需要预检列是否存在。\r\n\r\n### 事务闭环\r\n- **BEGIN TRANSACTION -> COMMIT / ROLLBACK**。\r\n- 确保 DDL 变更与 DML 写入在同一事务中以维持一致性。\r\n\r\n## 2. SQL 审计 (Antipattern Check / SKL-008)\r\n\r\n拦截低效或风险 SQL：\r\n- 🔴 **AP-02/03**: 拦截无 `WHERE` 的 `DELETE`/`UPDATE`。\r\n- 🔴 **AP-05**: 拦截隐式笛卡尔积。\r\n- 🟡 **AP-01**: 警告使用 `SELECT *`。\r\n\r\n## 3. 结果产出 (Assets)\r\n\r\n生成脚本族：\r\n1. `01-clean.sql`: 脱敏、格式化。\r\n2. `02-schema.sql`: 建模、视图构建。\r\n3. `03-analysis.sql`: 洞察验证 SQL。\r\n\r\n## 性能优化建议\r\n\r\n- 针对大数据集利用 `PARALLEL` 和 `MEMORY_LIMIT` 设置。\r\n- 推荐使用 `parquet` 格式导出中间结果。\r\n\r\n## Handbook Protocol (SKL-000) 约束\r\n生成的 SQL 代码块必须嵌入在 **💻 可执行示例** 中。\r\n必须在 **⚠️ 易错点** 中提醒主键手动管理或使用 Sequence。\r\n必须在 **🔗 上下文衔接** 中说明该 SQL 如何支撑下一步的分析洞察。\r\n",
    "fileName": "skill-301-sql.md",
    "triggers": ["sql", "engineering", "execution", "robust", "transaction", "audit", "antipattern", "执行", "事务", "审计", "健壮性", "幂等"],
    "intent": "SQL_ENGINEERING"
  },
  {
    "id": "SKL-302",
    "name": "变更防护与回滚",
    "content": "# SKL-302: 变更防护与回滚 (Safety & Rollback)\r\n\r\n## 认知层级：执行层 (Execution Layer)\r\n\r\n作为 AI Agent 的“刹车系统”，本模块负责在执行产生副作用的操作前建立安全网，并在失败时恢复状态。\r\n\r\n## 1. 回滚计划 (SKL-014)\r\n\r\n任何正向操作必须配备对应的 Undo 逻辑：\r\n\r\n| 正向操作 | 逆向操作 |\r\n|----------|----------|\r\n| `CREATE TABLE` | `DROP TABLE IF EXISTS` |\r\n| `ADD COLUMN` | `ALTER TABLE DROP COLUMN` |\r\n| `RENAME` | `RENAME` (反向) |\r\n\r\n## 2. 注入防御 (Security)\r\n\r\n- 严格转义表名和列名，使用 `\"` 包裹以防止 SQL 注入。\r\n- 检查 SQL 注释中是否存在非法 HTML 标签（防止报告渲染时的 XSS）。\r\n\r\n## 3. 持久化防护\r\n\r\n- **Snapshot**: 在执行重大变更前，建议 COPY 原始 DuckDB 文件快照。\r\n- **Logging**: 记录执行日志、受影响行数 and 耗时。\r\n\r\n## 检查清单 (Checkpoint)\r\n\r\n- [ ] 是否存在对应的 `scripts/rollback.sql`？\r\n- [ ] 是否在事务中执行？\r\n- [ ] 是否包含数据丢失风险警告？\r\n",
    "fileName": "skill-302-safety.md",
    "triggers": ["rollback", "safety", "undo", "security", "injection", "protection", "回滚", "安全", "防护", "注入"],
    "intent": "SAFETY_ROLLBACK"
  },
  {
    "id": "SKL-303",
    "name": "叙事报告与总结",
    "content": "# SKL-303: 叙事报告与总结 (Narrative Weaver & Report)\r\n\r\n## 认知层级：执行层 (Execution Layer)\r\n\r\n作为 AI Agent 的“播报员”，本模块负责将所有的技术发现、SQL 结果和治理策略翻译为人可读、可感知的业务报告。\r\n\r\n## 1. 叙事结构\r\n\r\n- **执行摘要 (Executive Summary)**: 50字简述核心结论。\r\n- **治理声明 (Governance)**: PII 处理了什么，契约是否通过。\r\n- **深度洞察 (Insights)**: 按照异常、驱动、建议的闭环描述。\r\n- **下一步行动 (Next Best Action)**: 建议用户继续探索的方向。\r\n\r\n## 2. 视觉化描述\r\n\r\n- 推荐图表类型 (Bar, Line, Sankey)。\r\n- 引用数据证据 (Data Evidence)。\r\n\r\n## 3. 结果存档\r\n\r\n- 将 Markdown 报告保存至 `reports/analysis_yyyy-mm-dd.md`。\r\n- 输出控制台 Summary (带颜色的提示)。\r\n\r\n## 叙事原则\r\n\r\n1. **结论先行**：先讲发现了什么，再讲 SQL 是怎么写的。\r\n2. **证据导向**：每一个观点必须引用具体的数值或趋势。\r\n3. **行动导向**：不仅描述现状，更要提出建议。\r\n",
    "fileName": "skill-303-report.md",
    "triggers": ["report", "summary", "narrative", "executive", "insights", "报告", "总结", "叙事", "摘要"],
    "intent": "NARRATIVE_REPORT"
  },
  {
    "id": "SKL-304",
    "name": "SQL 宏封装工程",
    "content": "# SKL-304: SQL 宏封装工程 (SQL Macro Factory)\r\n\r\n## 认知层级：执行层 (Execution Layer)\r\n\r\n作为 AI Agent 的“模具师”，本模块负责将重复的计算逻辑封装为 DuckDB `MACRO`（自定义函数），提升代码复用与 UI 调用的一致性。\r\n\r\n## 核心任务\r\n\r\n### 1. 复杂逻辑模具化\r\n识别高频计算逻辑（如：环比增长计算、复杂的条件加权求和），并将其转化为 Macro。\r\n- **示例**: `CREATE OR REPLACE TEMPORARY MACRO growth_rate(curr, prev) AS (curr - prev) / prev;`\r\n\r\n### 2. 交互界面简化\r\n在输出最终 SQL 时，提供一套预制的 Macro 库，使 UI 层只需调用 `SELECT growth_rate(...)`。\r\n\r\n## 工程收益\r\n- 显著减少生成的 SQL 文本长度。\r\n- 确保业务逻辑在不同报表的一致性。\r\n\r\n## Handbook Protocol (SKL-000) 约束\r\n当应用本技能时，必须在 **📌 语法模板** 中明确 `CREATE TEMPORARY MACRO` 的定义方式。\r\n在 **⚠️ 易错点** 中说明 Macro 的作用域（Session-level）以及 DuckDB 版本的兼容性。\r\n",
    "fileName": "skill-304-macro.md",
    "triggers": ["macro", "reusable", "function", "template", "封装", "宏", "复用"],
    "intent": "MACRO_FACTORY"
  },
  {
    "id": "SKL-305",
    "name": "物理断言验证机",
    "content": "# SKL-305: 物理断言验证机 (Physical Assertion Validator)\r\n\r\n## 认知层级：执行层 (Execution Layer)\r\n\r\n作为 AI Agent 的“质检员”，本模块负责在 SQL 执行前后生成物理断言，验证数据的逻辑准确性。\r\n\r\n## 核心任务\r\n\r\n### 1. 前置验证 SQL\r\n在执行写操作前，验证源数据状态（如：Null 率是否超标）。\r\n\r\n### 2. 后置结果断言\r\n执行关键计算后，验证结果是否符合物理常识。\r\n- **示例**: `SELECT count(*) FROM final_result WHERE total_amount < 0;` (若结果 > 0 则视为失败)。\r\n\r\n## 回滚链路\r\n若断言不通过，必须配合 `SKL-302` 进行原子回滚。\r\n",
    "fileName": "skill-305-assertion.md",
    "triggers": ["assertion", "validator", "check", "test", "verification", "断言", "验证", "检查"],
    "intent": "ASSERTION_VALIDATOR"
  },
  {
    "id": "SKL-306",
    "name": "资源感知的存储优化",
    "content": "# SKL-306: 资源感知的存储优化 (Storage Optimizer)\r\n\r\n## 认知层级：执行层 (Execution Layer)\r\n\r\n作为 AI Agent 的“仓储管理员”，本模块负责根据数据量级 and 本地资源，决定最佳的物理存储与导出策略。\r\n\r\n## 核心任务\r\n\r\n### 1. Parquet 深度优化\r\n当导出大数据集时，自动配置：\r\n- **ROW_GROUP_SIZE**: 优化读取性能。\r\n- **COMPRESSION**: 根据浏览器 CPU 负载选择 `SNAPPY` 或 `ZSTD`。\r\n\r\n### 2. 分片导出决策\r\n当文件预估超过浏览器下载限制时，自动生成分片导出逻辑。\r\n- **指令**: `COPY (SELECT * FROM table) TO 'part_1.parquet' (FORMAT PARQUET);`\r\n\r\n## 物理建议\r\n优先使用 Parquet 格式替代 CSV 存储中间结果。\r\n",
    "fileName": "skill-306-storage.md",
    "triggers": ["storage", "optimizer", "parquet", "compression", "export", "存储", "优化", "导出", "压缩"],
    "intent": "STORAGE_OPTIMIZER"
  },
  {
    "id": "SKL-307",
    "name": "自愈式 SQL 流水线",
    "content": "# SKL-307: 自愈式 SQL 流水线 (Self-healing Pipeline)\r\n\r\n## 认知层级：执行层 (Execution Layer)\r\n\r\n作为 AI Agent 的“急修工”，本模块负责在 SQL 报错后，结合错误堆栈实现自动化的逻辑修正。\r\n\r\n## 核心任务\r\n\r\n### 1. 错误深度解析\r\n解析 DuckDB 的报错信息（如：Binder Error, Missing Column）。\r\n\r\n### 2. 闭环修正生成\r\n结合 `SKL-101`（感知）与 `SKL-203`（CTE 编排），重新生成修正后的 SQL 逻辑块。\r\n\r\n## 输出契约\r\n必须输出一份 `Correction Diff`，向用户解释为了修复哪个错误而进行了何种逻辑调整。\r\n",
    "fileName": "skill-307-healing.md",
    "triggers": ["healing", "fix", "repair", "error", "correction", "自愈", "修复", "错误纠正"],
    "intent": "SELF_HEALING_PIPELINE"
  },
  {
    "id": "SKL-308",
    "name": "原子级会话快照",
    "content": "# SKL-308: 原子级会话快照 (Atomic Session Snapshot)\r\n\r\n## 认知层级：执行层 (Execution Layer)\r\n\r\n作为 AI Agent 的“黑匣子”，本模块负责在进行破坏性 DDL 前，建立物理级别的快照，确数据 100% 可恢复。\r\n\r\n## 核心任务\r\n\r\n### 1. checkpoint 强制触发\r\n在执行 `ALTER TABLE` 或 `DROP TABLE` 前，执行 `CHECKPOINT;` 并备份对应的 `.db` 文件。\r\n\r\n### 2. 回滚路径记录\r\n生成一套包含 `ROLLBACK` 逻辑的脚本，并将其存储在 `snapshots/` 目录中。\r\n\r\n## 工程准则\r\n任何涉及 `CREATE TABLE AS SELECT` (CTAS) 的操作，必须先通过快照验证。\r\n",
    "fileName": "skill-308-snapshot.md",
    "triggers": ["snapshot", "atomic", "checkpoint", "backup", "recovery", "快照", "备份", "原子级"],
    "intent": "SESSION_SNAPSHOT"
  },
  {
    "id": "SKL-401",
    "name": "认知对齐闭环",
    "content": "# SKL-401: 认知对齐闭环 (Cognitive Alignment Loop - ALC)\r\n\r\n## 认知层级：元认知层 (Meta Layer)\r\n\r\n作为 AI Agent 的“长期记忆体”，本模块负责捕捉用户对手动生成的 SQL 或报告的修正行为，并将其转化为持续进化的认知准则。\r\n\r\n## 核心任务\r\n\r\n### 1. 修正模式识别\r\n对比 AI 生成的原始 SQL 与用户执行的最终 SQL，识别偏好：\r\n- **命名偏好**: 如用户喜欢将 `id` 重命名为 `primary_key`。\r\n- **关联偏好**: 如用户倾向于特定的索引优化。\r\n\r\n### 2. 认知注入\r\n在下一次分析启动时，将捕捉到的偏好作为“用户习惯补丁”注入所有感知层 Prompts。\r\n\r\n## 输出建议\r\n本模块不直接输出 SQL，而是输出建议更新的 `User Preference Map`。\r\n",
    "fileName": "skill-401-alc.md",
    "triggers": ["alignment", "learning", "preference", "loop", "feedback", "对齐", "偏好", "学习", "反馈"],
    "intent": "COGNITIVE_ALIGNMENT"
  },
  {
    "id": "SKL-402",
    "name": "叙事溯源编织器",
    "content": "# SKL-402: 叙事溯源编织器 (Narrative Trace Weaver)\r\n\r\n## 认知层级：元认知层 (Meta Layer)\r\n\r\n作为 AI Agent 的“信任构建师”，本模块负责将 AI 的黑盒推导逻辑（Chain-of-Thought）结构化为可追溯的内容，向用户揭示“为什么得出这个结论”。\r\n\r\n## 核心任务\r\n\r\n### 1. 推导链条展示\r\n将分析过程拆解为物理证据点：\r\n- **证据 A**: 字段 `amount` 的均值大于中位数。\r\n- **推导 B**: 判定数据存在右偏分布。\r\n- **结论 C**: 建议使用 `MEDIAN` 而非 `AVG`。\r\n\r\n### 2. 逻辑可追溯性\r\n生成的每一项 Deep Insight 必须关联其对应的 SQL 证据快照。\r\n\r\n## 输出规范\r\nIn 报告末尾附加 `## 推导溯源` 板块，增强 AI 的专业信任感。\r\n\r\n## Handbook Protocol (SKL-000) 约束\r\n推导链条必须作为 **🎯 解决什么问题** 的逻辑支撑。\r\n在 **📊 预期输出** 中展示支撑结论的中间聚合结果（如 Median vs Avg）。\r\n在 **⚠️ 易错点** 中指出统计陷阱（如 Outliers 对均值的影响）。\r\n",
    "fileName": "skill-402-trace.md",
    "triggers": ["trace", "weaver", "chain-of-thought", "evidence", "explainable", "溯源", "推导", "证据", "可解释性"],
    "intent": "NARRATIVE_TRACE"
  },
  {
    "id": "SKL-403",
    "name": "提示词语义压缩器",
    "content": "# SKL-403: 提示词语义压缩器 (Prompt Semantic Compressor)\r\n\r\n## 认知层级：元认知层 (Meta Layer)\r\n\r\n作为 AI Agent 的“效率专家”，本模块负责在 Skills 库膨胀时，通过语义路由技术仅动态加载必要的技能块，节省 Token 并提升响应速度。\r\n\r\n## 核心任务\r\n\r\n### 1. 技能相关性过滤\r\n基于 `Stage 0` 识别的意图，决定后续 Stages 注入哪些 Skills。\r\n- **场景**: 若没有时间字段，自动剔除 `SKL-103 (Time Detector)`。\r\n\r\n### 2. 语义浓缩\r\n将长篇大论的 Skills 规则压缩为极简的指令集（Cheatsheet 模式），在不损失逻辑的前提下减少 Prompt 长度。\r\n\r\n## 性能指标\r\n目标是将复杂的全量 Prompt 压缩 30%-50%。\r\n",
    "fileName": "skill-403-compressor.md",
    "triggers": ["compressor", "prompt", "token", "efficiency", "router", "压缩", "效率", "优化"],
    "intent": "PROMPT_COMPRESSOR"
  },
  {
    "id": "SKL-404",
    "name": "DBT 工程桥接器",
    "content": "# SKL-404: DBT 工程桥接器 (DBT Engineering Bridge)\r\n\r\n## 认知层级：元认知层 (Meta Layer)\r\n\r\n作为 AI Agent 的“工程化专家”，本模块负责将 AI 生成的 SQL 资产无缝对接至现代数据模型管理工具（如 dbt）。\r\n\r\n## 核心任务\r\n\r\n### 1. 模型代码导出\r\n将 CTE 编排后的 SQL 转化为 dbt 风格的 `.sql` 模型，自动注入 `{{ ref(...) }}` 和 `{{ source(...) }}`。\r\n\r\n### 2. Schema 配置生成\r\n同步生成 `schema.yml` 文件，包含列描述、测试断言（SKL-305）及指标定义（SKL-206）。\r\n\r\n## 业务价值\r\n实现从“临时数据分析”到“企业级资产沉淀”的闭环。\r\n",
    "fileName": "skill-404-dbt.md",
    "triggers": ["dbt", "engineering", "bridge", "model", "schema", "持久化", "工程化", "对接"],
    "intent": "DBT_BRIDGE"
  },
  {
    "id": "SKL-405",
    "name": "首席执行官式摘要",
    "content": "# SKL-405: 首席执行官式摘要 (CEO-style Executive Summary)\r\n\r\n## 认知层级：元认知层 (Meta Layer)\r\n\r\n作为 AI Agent 的“沟通专家”，本模块负责在最终报告的最顶层生成具备商业决策冲击力的极简摘要。\r\n\r\n## 核心任务\r\n\r\n### 1. TL;DR 抽象\r\n从数十项 Insights 中提取最重要的 3 个“可行动结论”。\r\n\r\n### 2. 商业语言对齐\r\n禁止使用“SELECT count(*) 是 100”这类术语，转化为“用户留存率较上周提升了 10%”。\r\n\r\n## 输出规范\r\n报告首页必须包含一个 `### 🚀 决策快照` 区块，字数控制在 200 字以内。\r\n",
    "fileName": "skill-405-ceo.md",
    "triggers": ["ceo", "executive", "summary", "tl;dr", "decision", "摘要", "决策", "结论"],
    "intent": "EXECUTIVE_SUMMARY"
  }
];
