# PLAN-ontology-ai

## 任务目标
根据 `[/enhance]` 意图与之前的业务目标（对齐 AI 技能模块），由于目前本体论图谱初始状态“内容为空”，需要为其植入“AI 一键填充(生成)”和“快捷清空”功能，大幅降低用户构建知识图谱的门槛。

## 分析与痛点
1. 当前 `D3GraphView`（对齐 Network-Vector）已支持拖拽钉住、双击释放、折叠子树等功能；AI 智能填充仍需完善。
2. 当 `objects.length === 0` 时，仅提示“请先在 MECE 面板添加对象和关系”，全手动构建操作极其繁琐。
3. 缺少“快捷清空 (Quick Clear)”功能，用户无法快速验证多组不同场景的图谱。

## 方案设计 (Proposed Architecture)

### 1. 结构大纲（AI One-Click Fill）
- 在 `D3GraphView`（Network-Vector 风格）的控制面板中加入大模型闪烁 UI (`<Sparkles>`) 的 **"AI 智能填充"** 按钮。
- **功能逻辑**：点击后，召唤一个轻量级的弹窗/输入框，用户输入自然语言（例如：“帮我生成一个电商支付系统的系统本体论图谱”），系统自动结合 `ontologyDataModel` 的结构转换为对应的 DuckDB SQL 并插入。
- **Mock Fallback**：如果系统架构限制直接调用模型，将在本地通过智能代码预设几种复杂的业务流（如：电商架构、SaaS 服务架构等）作为第一步迭代。

### 2. 快捷清空功能（Quick Clear）
- 在右上角控制台增加一个醒目的“清空画布” (Trash Icon) 按钮。
- **执行逻辑**：一键执行 `DELETE FROM life_link; DELETE FROM life_action; DELETE FROM life_object; DELETE FROM life_object_type; DELETE FROM life_link_type;`，方便用户快速清理脏数据。

### 3. MECE 层级协同
- 在 `OntologyMECEPanel` (特别是 instance 层级) 中同步提供这些快捷操作，保持面板与图谱视图的数据与操作一致性。

## Socratic Gate (待确认问题)
见通讯信息。
