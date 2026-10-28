# 系统一致性审查与质量修复

审查开始：2026-10-12；最后复验：2026-10-13。项目：DuckDB Editor Pro。

## 结论与信息边界

已对 17 个主入口建立空库与真实数据检查记录，并对 18 个子视图执行切换操作。本轮针对已复现的主题、重复输入、键盘访问、焦点管理和窄屏布局问题做了修复，保留现有整体设计、业务流程、图谱布局和真实 DuckDB 查询链路。

这是一轮有明确覆盖范围的审查，不代表全部组件、全部按钮与所有状态已经验收。没有使用旧报告代替本次结果，也没有将代码生成、页面能打开或加载中的截图作为功能通过依据。外部 AI、插件安装、生产库写入、所有窗口组合与所有导出格式仍未完成端到端验收。

工作区开始时已有 519 条修改或新增记录；未清理、覆盖或提交这些历史修改。主界面实际使用 AppTopBar；旧 NavigationHeader 的固定颜色不能直接认定为当前产品缺陷。知识资产与知识联动共用 KnowledgeHub，保留该复用关系。

## 已确认问题、根因和最小修复

| 问题 | 影响与根因 | 修复与证据 |
|---|---|---|
| 图谱空状态浅色对比不足 | 固定深色主题黄、绿色和无样式按钮绕过公共规则 | 使用现有 EmptyState、ActionButton 与主题变量，保持重试、AI、刷新、禁用导出行为 |
| 空图谱出现两个 AI 主题输入 | 空状态与通用浮层重复渲染同一编辑表单 | 删除空状态内重复实现，保留单一主题编辑器；测试输入唯一、自动聚焦及 Escape |
| 多页标签在窄窗口不可达 | 公共 SegmentedTabs 缺少最大宽度、滚动约束，子按钮会被压缩 | 在公共组件提供横向滚动并保持按钮不收缩；实测 End 选中末项且自动滚入视口 |
| 知识资产窄屏正文被侧栏挤压 | 288px 固定侧栏与正文始终横排 | 窄屏导航覆盖式展开，选择资产后收起；桌面折叠偏好独立保留，Ctrl+B 同步使用当前窗口规则 |
| 本体工具栏被裁切 | 标题、切换器与多项操作固定一行 | 标题栏与状态栏按可用宽度换行，保留全部现有入口 |
| 技能页标题和状态互相挤压 | 标题栏不换行，介绍横幅坚持两列 | 标题栏允许换行，横幅在窄屏上下排布，保留分类滚动与既有内容 |
| 数据导入焦点可逃逸、缺少对话框语义 | 全屏容器没有接入公共弹层焦点机制 | 使用已有 useOverlayFocus，加入具名 dialog；保留嵌套帮助、预览、历史的 Escape 关闭顺序 |
| 数据导入窄屏预览不可访问、顶部文本挤成竖排 | 配置区占满宽度仍与预览横排，顶部和底部固定高度 | 窄屏上下排列并滚动，头尾允许换行；桌面保留原双栏 |
| Schema 窄屏字段列表高度被压为零 | 上下排布后检查器不收缩，字段区只分到剩余空间 | 窄屏字段与检查器各有可滚动高度，整个内容区可滚动；桌面双栏不变；实测 user_name 可滚动访问 |
| 只读查询错误被重放到主连接 | 所有错误均触发连接回退，可能改变解析上下文或掩盖语义错误 | 对 Catalog/Binder/Parser 等明确 SQL 错误保留原错误；连接故障仍可回退；测试明确使用持久库分支 |
| 首页联动测试使用旧文案 | 测试期待“明细”，实际界面为“明细预览” | 仅更新断言，保留真实数据集选择和数据/Schema 导航验证 |

表格内容的横向滚动、插件分类滚动、业务图谱节点分类颜色、空数据下禁用导出属于正常业务差异，没有按外观相似强行合并或更改。

## 入口与子视图覆盖

下表中的“已检查”指入口切换、当前渲染、可见状态与截图检查，不代表该页全部操作通过。桌面宽度 1440，高度 1000；窄屏 390×844。桌面深浅主题与窄屏浅色均有记录；没有完成窄屏深色和所有中间尺寸矩阵。

| 分区 | 主入口 | 实际子视图切换 | 健康结论 |
|---|---|---|---|
| 工程核心 | 仪表盘、数据、Schema、SQL、数据流 | Schema 列表/ER；SQL 数据/图表/透视/执行计划 | 入口已检查；真实表浏览已验证；Schema 窄屏缺陷已修复；SQL/数据流完整执行仍需专项端到端覆盖 |
| 分析洞察 | 指标、可视化、分析、历史、审计 | 分析的关联分析/数据体检/透视聚合/时序分析/场景配方/SQL 模板；审计高危/删除 | 入口已检查；真实 users 字段、10 行数据可用于分析；标签可达性已复验；审计真实新增事件未单独验证 |
| 知识沉淀 | 知识资产、插件、知识联动 | 当前知识文档、分类导航与内置关联图谱 | 入口已检查；导航修复已复验；插件外部安装、文件夹授权及全部文档运行未验收 |
| AI 认知 | 本体图谱、技能、能力、推演 | 知识图谱/数据视图/实体画布；AI Skills/技能方案 | 入口已检查；空状态与标题布局修复已回归；真实 AI 请求和全部推演业务未验收 |

没有将带数量徽标而未匹配成功的标签计入 18 个已切换子视图。没有将自动扫描出的“元素超出视口”直接等同缺陷：滚动表格和滚动分类条需结合实际交互判断。

## 实际数据与交互证据

通过界面“导入数据”选择本地 baseline.duckdb，点击“挂载为独立库 (ATTACH)”，在浏览器的独立 OPFS 副本中验证 users 表显示 10 条记录。文件有 main 与 lab_baseline 两个 Schema；当前 main 的四表分别为 users 10、fiat_transactions 25、crypto_transactions 25、exchange_rates 8，共 68 行、38 字段。没有把第二个 Schema 的相同源表累加成业务总量。

原文件 SHA256：A16DB823884EF4C8A6056214C624EAF12FC12A454E31A93F2AB180B5948CC887，复验保持一致。没有为通过界面验收生成 Mock 业务记录。

实际操作已通过：导入窗口获得焦点、Escape 关闭、焦点返回触发按钮；真实文件挂载；users 的 10 行显示；窄屏 Schema 字段滚动可达；分析标签 End 键切换及滚动；知识导航打开及 Ctrl+B 关闭。

第一版交互脚本误从“项目”菜单寻找导入入口，该查找未通过，未计入产品缺陷或通过结果。后续通过真实导入入口复验成功。第一批包含加载中的截图未作稳定页面通过证据；最终技能截图等已等待实际组件挂载重新拍摄。

## 自动测试结果

- 全量基线：279 个测试文件，276 通过、3 失败；2608 项测试，2605 通过、3 失败。该长测试运行与修复重叠，不能代表最终代码全量通过。
- 三个失败涉及只读查询错误回退、首页旧断言、重复 AI 输入；最终相关回归全部通过：9 个文件、57 项测试。
- 最后响应式修改后再次执行导入与 Schema 回归：2 个文件、21 项测试通过。上述数量存在重复覆盖，不相加为独立测试总数。
- TypeScript 检查：通过。
- 最终构建：通过（最后一次耗时 1 分 46 秒）。
- jsdom 提示未实现 Canvas getContext，不能据此证明真实 Canvas 绘制正确；图谱真实渲染另由浏览器截图观察。构建中的 DuckDB worker eval 与包体积告警保留，未通过无关重构消除。

第一轮无最终摘要的测试运行被终止，保留为未完成运行；随后详细报告的完整基线正常结束。不能将第一轮描述为已确认的产品死循环。

## 仍需覆盖

1. 最终代码上的全量测试重跑；当前只能确认上述相关回归通过。
2. 全部 458 个 TSX 文件不等于 458 个独立页面；本轮没有逐个组件逐状态进行人工操作验收。
3. Hover/Focus/Active/Disabled/Loading/Empty/Error/Success 的全系统逐组件矩阵，以及窄屏深色与更多窗口宽度。
4. 配置真实 AI 凭据后的建议接受/拒绝全链路、外部插件安装及失败恢复、目录授权与网络异常。
5. 每个导出格式的实际下载内容、生产库写入/删除影响确认、保存后重启恢复，以及全部图谱布局和复杂数据边界。

这些范围没有标记为通过，也没有将未复现的怀疑列为已修复。

## 截图与可重复执行材料

### 图谱空状态主题修复

![图谱空状态主题修复](C:/Users/luoyu/Desktop/Duckdb_Manager/duckdb-editor/docs/system-consistency-20261012/repaired-light-390/AI 认知-本体图谱.png)

### 知识资产窄屏导航修复

![知识资产窄屏导航修复](C:/Users/luoyu/Desktop/Duckdb_Manager/duckdb-editor/docs/system-consistency-20261012/knowledge-narrow-after.png)

### 技能页窄屏修复

![技能页窄屏修复](C:/Users/luoyu/Desktop/Duckdb_Manager/duckdb-editor/docs/system-consistency-20261012/skills-narrow-after.png)

### Schema 字段区恢复

![Schema 字段区恢复](C:/Users/luoyu/Desktop/Duckdb_Manager/duckdb-editor/docs/system-consistency-20261012/schema-narrow-after.png)

### 导入窗口窄屏修复

![导入窗口窄屏修复](C:/Users/luoyu/Desktop/Duckdb_Manager/duckdb-editor/docs/system-consistency-20261012/import-dialog-after.png)

### verified-real-dark-1440 全入口截图索引

![verified-real-dark-1440 1](C:/Users/luoyu/Desktop/Duckdb_Manager/duckdb-editor/docs/system-consistency-20261012/verified-real-dark-1440-sheet-1.jpg)

![verified-real-dark-1440 2](C:/Users/luoyu/Desktop/Duckdb_Manager/duckdb-editor/docs/system-consistency-20261012/verified-real-dark-1440-sheet-2.jpg)

![verified-real-dark-1440 3](C:/Users/luoyu/Desktop/Duckdb_Manager/duckdb-editor/docs/system-consistency-20261012/verified-real-dark-1440-sheet-3.jpg)

### verified-real-light-1440 全入口截图索引

![verified-real-light-1440 1](C:/Users/luoyu/Desktop/Duckdb_Manager/duckdb-editor/docs/system-consistency-20261012/verified-real-light-1440-sheet-1.jpg)

![verified-real-light-1440 2](C:/Users/luoyu/Desktop/Duckdb_Manager/duckdb-editor/docs/system-consistency-20261012/verified-real-light-1440-sheet-2.jpg)

![verified-real-light-1440 3](C:/Users/luoyu/Desktop/Duckdb_Manager/duckdb-editor/docs/system-consistency-20261012/verified-real-light-1440-sheet-3.jpg)


原始截图、DOM 记录及子视图明细保存在本目录；evidence 包含完整基线、最终针对性测试及实际操作输出。截图联系表仅供总览，细节判断使用对应原图。

复跑脚本：scripts/audit-system-capture.js、audit-system-subviews.js、audit-system-interactions.js、audit-system-final-checks.js。使用已获授权的 Playwright CLI，在隔离浏览器会话运行；真实数据脚本在空库开始并导入已有本地文件。
