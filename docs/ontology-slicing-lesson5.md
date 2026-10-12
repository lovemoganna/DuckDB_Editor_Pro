# 本体切片第五课：使用真实 DuckDB 数据驱动交互图谱

## 入口与目标

在「AI 认知 / 本体图谱」打开「真实数据切片 · 第五课」。输入一个真实用户名，点击「提取子图」，直接调用已有 `duckDBService.query()`，用本次查询的返回行生成节点、关系和点击详情。

原本体工作区仍是默认视图。实验模块可以独立切换，不改变其数据或布局定义。

## 数据与操作边界

- 数据库：Editor Pro 当前已导入数据的 `main` Schema。
- 只读表：`main.users`、`main.fiat_transactions`。
- 不重新导入 Excel，不访问其他工作表，不增删改任何数据库对象。
- 统一 SQL 口径：`snippets/lesson5-user-fiat-slice.sql` 与实验组件内 `lesson5Sql()` 一致，唯一变化是用户输入。
- 用户名仅作为受控字面量参数使用，单引号转义；不允许手写 SQL 注入。
- 用 `TRY_CAST(... AS BIGINT)` 比较 UID，以兼容已验证的文本与数字导入类型。其他数据集使用前需验证 UID 是否可无损转换。

## 最小运行链路

1. 在现有 SQL 工作台执行 `snippets/lesson5-user-fiat-slice.sql`；先将其中用户名改成 `Alice Chen`。
2. 打开「本体图谱 / 真实数据切片 · 第五课」。
3. 输入 `Alice Chen`，点击「提取子图」。前端重新执行只读 SQL，返回真实用户与交易行。
4. 前端根据返回行映射 `User:<uid>`、`FiatTransaction:<fiat_order_id>` 两类节点，创建 `HAS_TRANSACTION` 关系边；点击节点查看 UID、订单、金额、币种、状态。
5. 换成 `Bob Miller` 并重新执行。输入变更后，旧图立即清除，不能继续显示 Alice 的节点或边。
6. 再试 `Jonas Weber` 和一个不存在的用户名；验证零交易、零用户的边界行为。

## 真实数据独立核验

2026-10-12 已在现有 MotherDuck 副本 `my_db.oca_v2_20261011` 中，以同一 UID 联接口径执行只读查询，返回：

| 用户名 | User | FiatTransaction | HAS_TRANSACTION |
|---|---:|---:|---:|
| Alice Chen | 1 | 4 | 4 |
| Bob Miller | 1 | 4 | 4 |
| Jonas Weber | 1 | 0 | 0 |
| 不存在的用户名 | 0 | 0 | 0 |

该核验说明 SQL 与现有真实数据相符，不等同于 Editor Pro 当前浏览器环境的端到端验收。

## 待做的应用级验收

- 在实际 Editor Pro 浏览器中确认用户与交易表已经在当前数据库。
- 实际运行 Alice / Bob / Jonas / 无此用户四个场景。
- 点击各节点验证属性来自本次 SQL 返回行。
- 检查切换用户名、SQL 报错时旧图已清除。
- 在仓库执行 `pnpm typecheck`、`pnpm test:run`、`pnpm build`；所有检查通过后才能合并 PR。

严禁把 MotherDuck SQL 通过、TypeScript 语法检查通过，冒称为浏览器交互或生产构建通过。
