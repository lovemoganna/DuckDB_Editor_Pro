# PROJECT-HARNESS — duckdb-editor (DuckDB Manager Pro)

> **最后更新**：2026-06-21 Phase 3 完成
> **神秘屋风险评级**：高 → 中（Phase 3 完成，TS 错误大幅减少）
> **版本**：v3.0

---

## 项目概述

一个基于 Web 的 DuckDB 可视化管理工具，核心功能：数据导入/编辑/导出、Schema 管理、AI 辅助 SQL 生成（Skills 系统）、数据质量分析（Abstraction 本体论层）、知识库（Library）。

**技术栈**：React 18 + TypeScript + Zustand / Vite + TailwindCSS / DuckDB WASM / CodeMirror6 / ReactFlow / Recharts / TanStack / Mermaid / Google Gemini AI + Claude + Groq + OpenAI 多 Provider

**项目状态**：原型/开发中 — 单人维护，AI辅助开发比重高

---

## 一、项目词典

> AI 在这个项目中应该使用以下术语，不得随意替换或创造新词。

### 核心实体

| 规范名称 | 含义边界 | 禁用别名 |
|---------|---------|---------|
| Skill | AI辅助任务执行单元，声明式generatorId路由 | "技能"、"AI能力" |
| AbstractionTable | 基于MECE原则的数据抽象路径（concept→property→relation→instance） | "抽象表"、"能力表" |
| OntologyEntry | 本体论条目，四层抽象（concept/property/relation/instance） | "知识节点" |
| Intent | 用户需求的语义意图分类（10种SqlOperationType） | "意图"、"目标" |
| Generator | 声明式SQL生成器函数，通过generatorId注册到Registry | "生成器" |
| AbstractionLevel | 抽象层级枚举（concept/property/relation/instance） | "层级" |
| SemanticType | 列语义类型（DIM/MEA/ID/TIME/ATTR/RATIO/CURR） | "列类型" |
| GenerationResult | AI分析全量结果类型 | "分析结果" |
| SkillResult | Skill执行结果（success/sql/error/explanation） | "执行结果" |
| SkillExecutionContext | Skill执行上下文（tableName/columns/schema/sampleData） | "上下文" |

### 核心操作

| 规范动词 | 含义 | 包含 | 不包含 |
|---------|------|------|--------|
| route | 通过skillRouter将用户意图路由到对应Skill | 意图分析→技能匹配→上下文增强 | 实际执行 |
| execute | 通过skillExecutor执行Skill并返回SkillResult | generator解析→AI生成→结果处理 | 路由决策 |
| generate | 通过GeneratorRegistry生成SQL或分析结果 | 模板SQL→AI增强→格式化输出 | 路由和执行 |
| infer | 通过schemaInferenceEngine从数据推断语义类型 | 列统计→模式匹配→类型推断 | SQL生成 |
| build | PromptBuilder构建AI调用prompt | 系统指令→用户输入→上下文注入 | 执行和解析 |

### 模块词汇

> 2026-06-08 更新：调研确认 Abstraction 和 Library 模块职责完全不同，无重叠，无需合并。

| 名称 | 完整含义 | 职责边界 |
|------|---------|---------|
| AnalysisHub | 分析 Hub 容器（AnalysisHubPanel）含 Library/Analysis/Lab 三个子 Tab | 仅路由，不管执行 |
| Abstraction 模块 | AnalysisHub 的子模块：SQL 模板管理 + AI 对话生成 + 沙盒实验 | LibraryView / AbstractionChatSession / AbstractionLab |
| Library 模块 | 独立 Tab（Tab.LIBRARY）：SQL 参考手册 + 知识库 | DDLPanel/DMLPanel/DQLPanel 等 7 个参考面板 |
| AbstractionStore → analysisHubStore | 本体论+抽象表全局状态，已合并为 `hooks/store/analysisHubStore.ts` | 状态，不管 UI |

---

## 二、架构规范

> AI 生成的代码必须遵循以下架构规范。当有疑问时，参考 `services/skillExecutor.ts`。

### 目录结构

```
duckdb-editor/
├── components/          # UI 组件（按Tab/功能域组织）
│   ├── ui/              # 基础UI（ErrorBoundary等）
│   ├── skills/           # AI Skills相关UI（SkillPanel/SkillChain等）
│   ├── Library/          # Library模块（含OntologyApp/LibraryApp）
│   ├── Abstraction/      # Abstraction Lab UI
│   ├── Learn/            # Learn/Tutorial UI
│   ├── schema-generator/  # Schema生成器UI
│   └── theme/            # 主题配置（monokai/ai-skills）
├── services/             # 业务逻辑层（纯函数/类）
│   ├── duckdbService.ts  # DuckDB WASM 封装
│   ├── aiService.ts      # AI Provider 调用
│   ├── skillRouter.ts    # 意图分析+技能路由
│   ├── skillExecutor.ts  # Skill 执行引擎
│   ├── PromptBuilder.ts  # Prompt 模板构建
│   ├── skills/           # Skill 系统核心
│   │   ├── definitions/  # Skill 定义（official/official-skills等）
│   │   ├── generators/   # Generator 注册表
│   │   ├── sql-generators/  # 各类SQL生成器
│   │   ├── intentAnalyzer.ts  # 意图分析器
│   │   └── parameterExtractor.ts  # 参数提取器
│   ├── schemaInferenceEngine.ts  # Schema推断
│   ├── ERDetector.ts     # ER关系检测
│   ├── anomalyService.ts # 异常检测
│   ├── causalService.ts  # 因果分析
│   ├── featureEngineeringService.ts  # 特征工程
│   └── inferenceService.ts  # 推断服务
├── hooks/                # React Hooks（含Zustand store）
│   ├── store/            # Zustand stores（useAppStore/useOntologyStore等）
│   ├── useAbstraction*.ts  # Abstraction相关hooks
│   └── useSkillRouter.ts  # Skill路由hook
├── types.ts              # 共享类型定义（核心：1300+行）
├── types/                # 按域细分的类型
│   ├── abstraction.ts
│   └── analysisHub.ts
├── data/                 # 静态数据（tutorials/ontologyTemplates等）
├── utils.tsx             # 工具函数
└── App.tsx              # 根组件
```

### 命名规范

```
文件命名：kebab-case.ts/tscx（示例：duckdbService.ts, skillRouter.ts）
函数命名：camelCase（示例：analyzeIntent(), executeSkill()）
类命名：PascalCase（示例：AIService, SkillRouter, SkillExecutor）
类型命名：PascalCase（同TS规范）
常量命名：SCREAMING_SNAKE_CASE（示例：MAX_RETRY_COUNT）
枚举值：SCREAMING_SNAKE_CASE（示例：Tab.DASHBOARD）
```

### 模块依赖规则

```
允许的依赖方向：
  - components → services/hooks/types
  - hooks → services/types
  - services → services（同级，但避免循环依赖）
  - types → types（同文件或types.ts）

禁止的依赖：
  - services 不得依赖 components（反向依赖）
  - 避免 services 间循环依赖（aiService → PromptBuilder → aiService 检查）
```

### 标准模式

**AI调用**：必须使用 `aiService.robustCall()` + 自动重试 + throttling，不直接用 `callProvider`

**Skill执行**：`generatorId` 声明式路由 → GeneratorRegistry O(1) 查找 → generator函数执行 → AI增强降级

**状态管理**：全局状态用 Zustand store；组件本地状态用 React `useState`/`useRef`

**错误处理**：`addNotification()` 用于用户反馈；`console.error()` 用于开发日志；异常用于不可恢复错误

**参考实现**：`services/skillExecutor.ts` — 执行流程最清晰，是项目规范的最佳参考

---

## 三、AI 工作规则

### 任务语法模板

> 2026-06-08 更新：已集成 CodeStable 技能体系。使用 `cs` 入口路由到具体技能。

**使用 CodeStable 技能系统（推荐）**：

| 指令 | 路由到 |
|------|--------|
| `cs` | CodeStable 根入口，介绍体系全貌并路由 |
| `cs feat` | 新功能开发流程（brainstorm → design → impl → acceptance） |
| `cs refactor` | 代码重构流程（scan → design → apply） |
| `cs issue` | Bug 修复流程（report → analyze → fix） |
| `cs audit` | 系统审计（代码问题/bug/安全/性能/债务） |
| `cs explore` | 定向代码探索 |
| `cs note` | 把碎片知识追加到 attention.md |

**手工任务语法模板**（不使用 CodeStable 时）：

```
位置：{文件路径或模块名}
场景：{触发这个功能的用户行为或业务场景}
任务：{增加/修改/删除/重构} {具体内容}
约束：{不修改 X} / {保持与 Y 一致} / {不引入新依赖}
验收：{完成的标准，可检验的行为描述}
```

**示例**：
```
位置：services/skillRouter.ts
场景：为Skill增加新的生成器支持
任务：增加generatorId声明式路由支持
约束：不修改skillExecutor.ts的执行流程，不引入新依赖
验收：新generatorId在registry中可O(1)查找，生成器函数签名符合GeneratorFn类型
```

### 允许 AI 自由操作的区域

```
components/ui/         — 样式调整和UI改进
components/theme/      — 主题和颜色调整
data/                  — 静态数据和示例
services/skills/generators/  — 新增generator
services/skills/definitions/  — 新增skill定义
```

### 需要人工确认才能修改的区域

```
types.ts               — 核心类型变更，影响范围广
services/aiService.ts   — AI调用逻辑，影响所有AI功能
services/skillRouter.ts — 路由逻辑，影响Skill匹配
services/skillExecutor.ts — 执行逻辑，影响Skill执行
hooks/store/useAppStore.ts — 全局状态结构变更
App.tsx                — 根组件，影响整体架构
```

### AI 的硬禁止操作

> 以下操作无论AI如何建议，都不执行：

```
- 不修改 duckdbService 的底层 WASM 封装方式
- 不删除 types.ts 中的任何类型定义（可新增）
- 不修改 aiService.ts 的多Provider路由逻辑
- 不在 services 目录引入新的外部依赖
- 不重构 skillExecutor.ts 的 generator→AI降级流程

本体模块专项禁止：
- 不删除 components/Library/OntologyCanvas.tsx 或 D3GraphView.tsx（两者都在使用中）
- 不单独改动 D3GraphView 或 OntologyCanvas 之一而不考虑另一个的影响
- 不修改 useOntologyStore.ts 的乐观更新机制（pendingMutations）
- 不绕过 useOntologyStore 直接读写 DuckDB 的本体数据
```

### 每次会话的上下文包

```
必须提供：
□ 本文件（PROJECT-HARNESS.md）摘要或 `.codestable/attention.md`
□ 当前任务相关的核心文件（最多3个）
□ 本次任务的目标和验收标准

按需提供：
□ skillExecutor.ts 作为执行层参考
□ types.ts 作为类型参考
□ 相关generator文件作为生成逻辑参考
□ `.codestable/architecture/ontology.md` 作为本体模块参考
```

---

## 四、验证要求

### 生成前检查

```
□ 任务描述符合任务语法模板（位置/场景/任务/约束/验收 齐全）
□ 相关的现有代码已经包含在上下文中
□ 本次任务的禁止事项已经明确说明
□ 不在硬禁止操作范围内
```

### 生成后检查

**结构性检查**：
```
□ 只修改了任务定义范围内的文件
□ 类型签名符合types.ts中的定义
□ generatorId路由到GeneratorRegistry中有对应条目
□ 没有引入新的console.error/warning（AI生成代码审查）
□ 没有破坏现有import链
```

**功能性检查**：
```
□ Skill执行后返回正确格式的SkillResult
□ generator解析成功时返回有意义SQL（非placeholder）
□ AI降级时prompt包含schemaContext
□ 错误时返回有意义error信息
```

### 测试覆盖要求

```
核心逻辑（skillRouter/skillExecutor）：必须覆盖边界case
AI调用层（aiService）：必须覆盖throttle/retry/error path
Generator层：必须覆盖generatorId解析
UI组件：建议覆盖交互逻辑
```

---

## 五、反馈规则

### 失败记录格式

> 每次会话结束，将失败模式追加到 `.codestable/learnings/sessions/YYYY-MM-DD.md`。
> 通用模式整理到 `.codestable/learnings/README.md`。

记录格式：
```
日期：{日期}
会话摘要：{本次完成的工作}
失败类型：[误解需求 / 违反架构 / 引入bug / 风格不一致 / 越界修改]
根本原因：{AI缺少的上下文是什么，或哪条规则不存在}
规则更新：{已将以下规则添加到……：……}
```

### 已知失败模式

1. **generatorId路由遗漏**：AI生成新Skill时忘记注册generatorId到Registry → 已在 `generators/index.ts` 的 `registerAllGenerators()` 中添加说明
2. **类型膨胀**：新增功能直接在 `types.ts` 末尾追加，未按领域归类 → 已在第二节目录规范中说明应使用 `types/` 子目录
3. **AI prompt上下文不足**：AI生成的SQL在复杂JOIN场景下不准确 → 已在skillExecutor中确保 `schemaContext` 传递给prompt
4. **Windows路径双斜杠**：Windows下 `components\Library/` 和 `components/Library/` 混用导致 `git status` 显示双条目 → 避免手动处理路径，优先用 glob/grep/StrReplace

### 自检清单

开始工作前请参考 `.codestable/checks/README.md` 的预检清单，包含：
- 模块边界检查
- 导入路径验证
- 大文件修改注意事项
- 编译自验证

### Harness 更新节奏

```
每次会话结束：记录发现的规则漏洞（估时 5 分钟）
每周：将漏洞转化为规则（估时 15 分钟）
每月：全面审查，删除过时规则（估时 30 分钟）
重大架构变更时：更新第一节和第二节
```

---

## 六、待解决的开放问题

> 2026-06-08 更新：Phase 1-2 已完成。以下问题已重新评估。

1. **D3GraphView 和 OntologyCanvas 两套系统统一** ✅ 已执行 ontology-viz-unification checklist
2. ~~DuckDB WASM 同步问题~~ ✅ 已实现 workaround + UI 引导
3. **types.ts 拆分时机**：1300+ 行单文件已过大，是否开始拆分为 `types/` 子目录？
4. ~~测试覆盖率目标~~ ✅ Phase 3.3 完成：26个 CRUD 集成测试（ObjectType/Object/LinkType/Link/Action/Introspection/Insight + SQL注入 + 乐观回滚）
5. **skillExecutor 的 AI 增强时机**：当前 generator 返回 placeholder-heavy 结果时一定会触发 AI 增强，是否应该改为可选？
6. **GeneratorRegistry 的动态扩展**：当前注册在 `registerAllGenerators()` 启动时完成，动态 skill 如何注册？
7. **AI 生成代码的验证**：Skill 生成的 SQL 目前无自动验证机制，是否需要？
8. **MECE 五层认知负担过重**：Canvas knowledge 模式有 5 个层级（foundation/relations/methodology/patterns/domains），普通用户不会用。建议简化。
9. ~~本体模块 CommandPalette 入口缺失~~ ✅ Phase 3.4 完成：Ontology 分组 + OntologyCommand 类型 + pendingCommand Zustand 桥接
10. **Abstraction 模块导航层级过深**：`AnalysisHubPanel` → 子Tab → AbstractionLab，用户需要穿过两层才能到达。建议评估是否需要独立 Tab。

## 六-1、已解决的开放问题（历史）

> 2026-05-11 | DuckDB namespace 硬编码问题（O2）

| # | 问题 | 解决方案 | 验收 |
|---|------|---------|------|
| O2 | `duckDBService.ts` 18个方法硬编码 `life_` namespace，动态 namespace 功能部分失效 | 添加 `private _ontologyNamespace` 字段 + `private _ontTables()` 封装 + 4个 public getter；所有方法通过 `buildOntologyTableNames()` 动态生成表名 | 自定义 namespace 下 delete/update 操作命中正确表；`OntologyCanvas.tsx` 和 `OntologyInsightsPanel.tsx` 中的直接查询同步修复；`tsc --noEmit` 通过 |
| O1（核实） | 原报告称 `data/ontologyTemplates.ts` 缺失会导致运行时崩溃 | 核实：`data/ontologyTemplates.ts` 未被任何文件 import，不存在运行时崩溃 | — |

---

## 六-2、已解决的 Phase 1-2 修复记录（2026-06-08）

> 自查自纠计划执行完成

| # | 问题 | 解决方案 | 状态 |
|---|------|---------|------|
| P1-1 | 两套可视化系统（D3GraphView + OntologyCanvas）用户困惑 | 已执行 ontology-viz-unification checklist：VIEW_TABS 顺序重排、SceneGuidanceBanner 新建、Canvas 探索按钮添加 | ✅ |
| P1-2 | 物理重复文件 | 核实 `D3GraphView/` 子文件全部被引用（无重复）；`src/utils/graph.ts` 孤立已恢复并重构；`src/utils/graph/clustering.test.ts` 测试通过 30/30 | ✅ |
| P2-1 | Abstraction vs Library 模块重叠误判 | 调研确认：两模块职责完全不同（Library=SQL参考手册，Abstraction=AI对话生成SQL模板），无实际重叠，无需合并 | ✅ |
| P2-2 | MetricManager/LibraryApp 硬编码帮助文本 | 已迁移到 `data/metricHelp.ts` 和 `data/libraryZoneHelp.ts`；`tsc --noEmit: 0 errors` | ✅ |
| P2-3 | `useAbstractionStore` 遗留别名 | 确认 `hooks/useAbstractionSandbox.ts` 活跃使用别名；已迁移到 `useAnalysisHubStore`；别名已移除 | ✅ |
| P2-4 | DuckDB WASM 同步 bug UI 引导不足 | Workaround 已实现（`OntologyPanel.tsx:89`）；`GraphEmptyState` 增加提示文案；`attention.md` 更新说明 | ✅ |

## 六-3、已解决的 Phase 3 修复记录（2026-06-21）

> 自查自纠 Phase 3 完成

| # | 问题 | 解决方案 | 状态 |
|---|------|---------|------|
| P3-1 | duckDBService.query(sql, params[]) 传参形式与实现不符 | 改为模板字符串拼接；SQL 注入防护用 escapeLiteral() 转义 | ✅ |
| P3-2 | OntologyPanel.tsx store.refresh() / store.delete*() 引用已不存在的 store 变量 | 从 useOntologyStore() 直接解构；CRUDList / EntityEditor / MappingConsole 均已修复 | ✅ |
| P3-3 | OntologyPanel.tsx insight.content / insight.category 与 LifeInsight 类型不符 | 改为 insight.insight / insight.tag | ✅ |
| P3-4 | 子组件用 dispatch / store.updateAction / store.createAction 未声明 | 补 dispatch / refresh / updateAction / createAction 解构 | ✅ |
| P3-5 | CommandPalette.tsx 引用陈旧的 OntologyAction 类型 | 统一改为 OntologyCommand；cmd.ontologyAction -> cmd.ontologyCommand | ✅ |
| P3-6 | CommandPalette 与 Ontology 系统未连接 | App.tsx 引入 useOntologyStore；onOntologyAction 回调写入 setPendingCommand + 切换 Tab.ONTOLOGY | ✅ |
| P3-7 | 无 Ontology CRUD 集成测试 | hooks/useOntologyStore.crud.test.ts：26个测试，全部通过 | ✅ |

> 按 onto-gen-mcos 五元分析产出（2026-05-11）

| 优先级 | 问题 | 状态 | 备注 |
|--------|------|------|------|
| 高 | O1-O2 已修复 | ✅ 已解决 | — |
| 高 | OntologyCanvas.tsx 单文件（2021→736行） | ✅ O3 已解决 | 7个子文件拆分 |
| 高 | OntologyPanel.tsx 单文件（1049→561行） | ✅ O6 已解决 | 拆分为4个子文件（types/RightInspector/AIDraftModal/Main） |
| 中 | types/abstraction.ts ↔ types/ontology.ts 循环引用 | ✅ O7 已核实 | TypeScript 编译正常；abstraction.ts 仅用 `import type` 引用 ontology.ts（编译擦除），无运行时循环 |
| 中 | 无 OntologyModuleSpec.md | ✅ O8 已完成 | docs/superpowers/specs/ontology-module-spec.md |
| 中 | MECE Layer 与 Abstraction 操作无映射 | ✅ O10 已核实 | 两个系统独立（Canvas 5层 vs Abstraction 4层），无需自动映射 |
| 低 | AI prompt ID 偏移量无协调 | ⚠️ 低风险 | 仅 libraryStorage.ts 一处引用，无多模块冲突 |
| 低 | IndexedDB 存储配额无检查 | ⚠️ 建议处理 | libraryStorage.ts 未调用 navigator.storage.estimate()，大存储量时可能静默失败 |
| 高 | Schema 图 ↔ 知识图谱联动缺失 | ✅ 2026-05-11 已修复 | crossSelectionSlice.ts + OntologyPanel 状态编排；三视图通过 selectedSchemaTable/highlightedSourceTable 双向联动；window 全局变量已消除 |

## 七、项目核心架构图

```
用户交互
  │
  ├─→ SkillPanel (components/skills/)
  │     └─→ skillRouter.analyzeIntent()   ← 意图分析
  │           └─→ skillRouter.suggestSkills()  ← 技能推荐
  │                 └─→ skillExecutor.execute()  ← 执行
  │                       ├─→ GeneratorRegistry.lookup(generatorId)  ← 模板生成
  │                       └─→ aiService.robustCall()  ← AI降级
  │
  ├─→ AnalysisHub (components/AnalysisHub/)
  │     └─→ aiService.generateUnifiedAnalysis()  ← 统一AI分析
  │           └─→ PromptBuilder + robustCall + AIValidator
  │
  ├─→ OntologyApp (components/Library/)
  │     ├─→ AbstractionStore (Zustand)
  │     └─→ OntologyEntry CRUD + 本体论图谱
  │
  └─→ LibraryApp (components/Library/)
        ├─→ ReferenceCards / SqlTemplates / CodeSnippets
        └─→ DDL/DML/DQL Panels
```

---

*此文档由 mystery-house-harness Skill 生成。*
*生成日期：2026-05-10 | 风险评级：中 | 下次审查：2026-06-10*
