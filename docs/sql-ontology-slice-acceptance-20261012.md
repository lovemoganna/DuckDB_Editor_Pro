# SQL 本体切片与动态图谱投影验收

> 历史记录：本文对应早期独立切片画布。该画布已被撤除，当前方案改为直接接入既有 D3GraphView。见 [主图谱接入记录](sql-slice-main-graph-integration-20261012.md)。

日期：2026-10-12。交付范围：当前本地代码；未执行发布、提交或推送。

## 现有实现检查

当前主入口为 `OntologyPanel`，主图谱为 `D3GraphView`。其数据来自本体对象仓库或本体映射表，不能直接将任意业务查询的结果作为独立局部图谱。现有 `GraphRenderer` 与 `graphLayoutService` 可以复用，无需再建图谱引擎。

本次增加“SQL 切片”入口，使用现有 ModalShell、FormSelect、ActionButton、图谱渲染器及布局服务，维持原有主题。切片为临时查询投影，不写入本体仓库，不加入示例对象，不改变原图谱的对象、关系或布局。

## 完整链路与边界

| 环节 | 实现及验证 |
| --- | --- |
| 识别数据结构 | 从当前数据库 information_schema 读取实际表、列与声明的主键；没有主键时要求明确选择标识字段。 |
| 定义对象与关系 | 来源表、唯一标识、关联表与关联字段显式绑定；不会把同名字段自动视作已确认外键。 |
| SQL 切片 | 生成全限定、正确引用的来源 SQL；用户通过 WHERE、JOIN、CTE 限定任务，支持直接修改 SQL 与映射。 |
| 结果投影 | 以数据库、来源表、对象类型、键组成稳定身份；按结果去重，属性仍为实际查询返回值；支持复合键与平行关系键。 |
| 关联完整性 | 空关联端点不会生成虚构节点或悬空边；显示跳过数量。相同身份的属性冲突会报错，要求检查 JOIN 粒度或标识字段。 |
| 展示与追溯 | 复用现有 SVG 图谱渲染及拓扑布局，支持缩放、平移、适配视图、对象及关系选择。每个对象和关系保留所有贡献查询行及来源绑定。键盘可通过对象及关系列表检视。 |
| 同步与失效 | SQL 或映射修改立即移除旧图，450ms 防抖重算；仅最新请求可发布。数据库切换清空原绑定与查询，重新读取当前结构，避免把旧库定义猜配到新库。数据/结构通知使旧投影失效并重算。 |
| 异常与容量 | 复用单条只读 SQL 校验；缺列、SQL 错误、无结果及映射错误有明确状态。超过 1000 查询行直接要求缩小条件，不展示被静默截断的关系图。 |

来源表与属性来自明确的投影绑定。复杂 SQL 的字段语义与关系含义由用户确认；不宣称自动证明任意自定义 SQL 的业务关系。聚合查询的追溯范围是它实际返回的查询行，未伪造被聚合掉的明细记录。外部进程直接修改文件而没有应用通知时，可通过“重新计算”刷新；未增加文件监控或后台轮询。

## 真实工作簿验证

实际读取用户指定文件：

`C:\Users\luoyu\AppData\Roaming\.emacs.d\org-roam\pages\sql\exchange_funds_flow_dataset.xlsx`

SHA256：`1630f146e0d7e92005881be3a1a4e15fd34d31ba31133de76a7258e2f86bc1fc`。

集成测试从这份工作簿读取四张表，写入独立临时 DuckDB 测试库，并以原始工作簿行独立计算预期对象集合；SQL 通过真实 DuckDB 执行，仅替换浏览器传输边界。未修改工作簿或当前业务数据库。临时测试库结束后清理。无该本机路径时测试可用 `SQL_SLICE_WORKBOOK` 指定来源，或使用仓库现有真实冻结工作簿。

| 数据表/业务问题 | 验收结果 |
| --- | --- |
| users / 实际对象结构 | 10 行，7 个实际字段；通过真实字段定义用户对象。 |
| fiat_transactions / 已完成 USD 交易与对应用户 | 25 行原始交易中匹配 9 行；9 个交易对象、4 个用户对象、9 条关系；金额独立核对为 104270 USD。 |
| crypto_transactions / 已完成 USDT 交易与对应用户 | 25 行原始交易中匹配 15 行；15 个交易对象、7 个用户对象、15 条关系；金额独立核对为 13000 USDT。 |
| exchange_rates / EUR 完成交易与基准汇率来源 | 8 行原始汇率；显式按 currency=asset 关联，汇率对象使用 asset+effective_date 复合键，保留来源与有效日期。关系命名为资产基准关联，未冒充交易日汇率。 |

工作簿中用户 uid 与交易 uid 的原始单元格类型不同，测试保留该差异，并按实际 SQL 关联的键值核对。没有通过改写数据或模拟值使关联通过。

## 当前浏览器端到端验收

在应用当前选择的真实 `sql_funds_flow` 数据库中完成：

1. 进入 AI 认知 → 本体图谱 → SQL 切片，选择实际表及唯一标识、关联字段，生成 SQL。25 行法币查询实际生成 34 个对象、25 条关系。
2. 修改条件为 `s.status='completed' AND s.currency='USD'`。观察旧节点立即清空，完成后为 9 行、13 个对象、9 条关系；点击关系查看关联键与实际查询行。
3. 改为 `WHERE false`，得到 0 行、0 对象、0 关系；原对象不会残留。
4. 改为不存在的字段，显示 DuckDB 列错误；图谱为空，修正后可继续执行。
5. 切换来源到 crypto_transactions，原 SQL 与图谱清空；重新绑定并限定 completed/USDT，实际 SVG 中 22 个节点、15 条边，与 15 行查询对应。
6. 浅色模式执行相同 USD 问题，仍为 13 个对象、9 条关系；标签、背景、表单及状态使用现有主题。关闭切片后原图谱保持原对象与关系。

截图均来自本次运行，已检查：

- `output/playwright/sql-slice/01-before.png`：原有图谱入口。
- `output/playwright/sql-slice/02-fiat-dark.png`：USD 切片及关系追溯。
- `output/playwright/sql-slice/03-empty.png`：空结果无残留。
- `output/playwright/sql-slice/04-error.png`：错误状态无残留。
- `output/playwright/sql-slice/05-crypto-dark.png`：切换加密货币数据集。
- `output/playwright/sql-slice/06-fiat-light.png`：相同问题的浅色模式。

视觉审查中的两个问题在交付前修复：末尾 SQL 行注释导致包装查询括号被注释吞掉；不连通分组被布局到画布外且过度缩小。前者以包装前后换行修正并补入真实执行测试；后者复用可配置拓扑流布局、限制行间距并增加完整范围适配。主图谱渲染器只增加可选箭头标识参数，默认行为保持兼容。

## 自动回归与构建

7 个测试文件、70 项测试通过，覆盖：投影身份、所有贡献行追溯、空关联、缺字段、属性冲突、复合键、平行关系、只读限制、超限拒绝、数据库离开后返回的迟到结果、查询编辑后迟到结果、错误与空结果、数据通知重算、数据库切换清空、真实工作簿完整查询及关联、原图谱数据与布局、原本体命令路由、现有只读查询服务。

- 日志：`output/sql-slice-regression.log`。
- TypeScript 类型检查通过：`output/sql-slice-types.log`。
- 生产构建通过：`output/sql-slice-build.log`。保留现有 DuckDB worker eval、混合导入和体积提示；未把它们当作本次新增缺陷。

本次未运行整个仓库测试全集，也未宣称全产品无回归。数据库切换及迟到响应通过组件/服务回归验证；浏览器实际执行了数据集切换、条件变化、对象与关系追溯及异常恢复。截图不能替代完整无障碍合规测试，本次只验证了可键盘访问的表单、状态及追溯列表。

## 验收截图

1. 原图谱及原有入口。

![原图谱](C:/Users/luoyu/Desktop/Duckdb_Manager/duckdb-editor/output/playwright/sql-slice/01-before.png)

2. USD 局部图谱与关系追溯。

![USD 切片及追溯](C:/Users/luoyu/Desktop/Duckdb_Manager/duckdb-editor/output/playwright/sql-slice/02-fiat-dark.png)

3. 无匹配行时不残留节点。

![空结果](C:/Users/luoyu/Desktop/Duckdb_Manager/duckdb-editor/output/playwright/sql-slice/03-empty.png)

4. 查询异常时图谱清空。

![查询错误](C:/Users/luoyu/Desktop/Duckdb_Manager/duckdb-editor/output/playwright/sql-slice/04-error.png)

5. 切换 USDT 业务问题与数据集。

![USDT 切片](C:/Users/luoyu/Desktop/Duckdb_Manager/duckdb-editor/output/playwright/sql-slice/05-crypto-dark.png)

6. 相同 USD 查询的浅色模式。

![浅色图谱](C:/Users/luoyu/Desktop/Duckdb_Manager/duckdb-editor/output/playwright/sql-slice/06-fiat-light.png)
