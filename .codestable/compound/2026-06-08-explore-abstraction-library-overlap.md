---
name: abstraction-library-module-survey
doc_type: explore
feature: phase2-module-survey
status: complete
summary: 调研 Abstraction 模块与 Library 模块是否真的存在职责重叠。
tags: [architecture, module-survey, P1]
created: 2026-06-08
---

# Abstraction vs Library 模块调研报告

## 1. 结论摘要

**两个模块不存在功能重叠。** 它们是完全独立的子系统，服务于不同的用户需求。

唯一的"重叠"是**命名巧合**：Abstraction 模块内部有一个组件叫 `LibraryView`（SQL 模板库视图），但它与 `components/Library/` 目录没有任何关系。

---

## 2. Abstraction 模块

### 定位
AnalysisHub 的子模块——**交互式 AI 辅助 SQL 模板管理和数据库探索**。

### 架构

```
AnalysisHubPanel（分析 Hub 根入口，Tab = Library/Analysis/Lab）
├── LibraryView（ Abstraction）
│   ├── TableList — SQL 模板浏览
│   ├── TableDetail — 模板详情 + SQL 预览
│   └── AbstractionChatSession — AI 对话生成 SQL 模板
├── SchemaGenerator — Schema 推断和导入本体
└── AbstractionLab
    ├── SandboxEditor — 自由 SQL 编辑
    ├── SandboxResults — 查询结果
    └── SandboxAIPanel — AI 辅助 SQL

共享状态：useAnalysisHubStore（Zustand，7 个 slice）
数据持久化：libraryStorage（IndexedDB）
```

### 核心功能
- AI 对话生成 SQL 模板（会话式）
- SQL 模板浏览/管理（收藏/分类/搜索）
- 沙盒 SQL 执行（自由实验）
- 版本历史记录

### 入口
- 在 App.tsx 中无独立 Tab
- 路由：`Tab.ANALYSIS` → `AnalysisHubPanel` → 子 Tab 切换

---

## 3. Library 模块

### 定位
Tools 区的独立 Tab——**SQL 参考手册和知识库**（类比 MDN 文档）。

### 架构

```
LibraryApp（独立 Tab = Library）
├── 7 个参考面板（按 MECE 分类）
│   ├── DDLPanel — DDL 参考（CREATE/ALTER/DROP/约束/索引/视图）
│   ├── DMLPanel — DML 参考（INSERT/UPDATE/DELETE/MERGE）
│   ├── DQLPanel — DQL 参考（SELECT/JOIN/聚合/窗口函数/CTE）
│   ├── FunctionsPanel — 函数参考（9 大类函数）
│   ├── DCLTCLPanel — 权限和事务参考
│   ├── OptimizationPanel — 性能优化参考
│   └── MetaKnowledgePanel — SQL 元知识
├── OntologyPanel（子模块，本体论知识图谱）
│   ├── D3GraphView — 力导向图浏览
│   ├── OntologyCanvas — 画布编辑器
│   └── OntologyDataView — 表格视图
└── ReferenceCardsPanel, SqlTemplatesPanel, LearningPathPanel 等辅助面板
```

### 核心功能
- SQL 语法参考手册（只读浏览）
- 代码片段复制到编辑器
- SQL 执行看结果
- 本体论知识图谱管理

### 入口
- 独立 Tab：`Tab.LIBRARY`（Tools 区）
- 渲染在 `App.tsx` 中，与 AnalysisHub 完全分离

---

## 4. 关键区分

| 维度 | Abstraction 模块 | Library 模块 |
|------|-----------------|-------------|
| 用户意图 | "帮我生成一条 SQL" | "我想查一下 JOIN 怎么写" |
| 交互模式 | 对话式 AI（Chat） | 浏览式参考（Reference） |
| 数据来源 | DuckDB 实时 Schema + IndexedDB 模板 | 硬编码片段 + DuckDB Ontology |
| 状态管理 | `useAnalysisHubStore`（Zustand） | `LibraryApp` 内部 state |
| 入口 | `Tab.ANALYSIS` → AnalysisHub 子 Tab | 独立 `Tab.LIBRARY` |
| 命名混淆 | 内部有 `LibraryView.tsx` 组件 | 同名目录 `components/Library/` |
| 交叉引用 | 无 | 无 |

---

## 5. 发现的问题（无需合并，但需澄清）

### 问题 1：命名混淆（轻微）
- `components/Abstraction/LibraryView.tsx` — Abstraction 内部的 SQL 模板库视图
- `components/Library/LibraryApp.tsx` — Library Tab 的主容器

两者功能完全不同但名称接近。建议：
- Abstraction 的 `LibraryView` 重命名为 `AbstractionLibraryView`（低优先级）

### 问题 2：Abstraction 未在主导航暴露
- `AnalysisHubPanel` 有 3 个子 Tab（Library/Analysis/Lab）
- 但 `App.tsx` 中 `Tab.ANALYSIS` 只路由到 `AnalysisHubPanel`
- Abstraction 的 Lab 功能需要穿过两层导航才能到达
- 如果用户不知道"先点 Analysis，再点 Lab"，会找不到 Abstraction

### 问题 3：Ontology 入口位置
- Ontology 作为独立 Tab（`Tab.ONTOLOGY`）在 App 顶层
- 同时 LibraryApp 内也有 Ontology 子模块
- 建议评估是否需要两个 Ontology 入口

---

## 6. 行动建议

1. **无需合并** — 两个模块职责清晰，无重叠
2. **更新 architecture.md** — 正确描述 AnalysisHub 的子模块结构
3. **更新 PROJECT-HARNESS.md** — 修正模块词汇表中对 Abstraction 和 Library 的描述
4. **考虑重命名** — `AbstractionLibraryView.tsx` → `AbstractionLibraryView.tsx`（已同名但目录不同，无需改）
5. **后续调研** — Abstraction 的 Lab 和 SchemaGenerator 与 SqlEditor 的关系（是否有重叠）

---

*调研时间：2026-06-08 | 耗时：1 会话 | 置信度：高*
