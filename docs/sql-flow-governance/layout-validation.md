# 多布局与连接层级验收

日期：2026-10-05。

- 布局入口：SQL 画布工具栏的“流程图布局”，提供自动、横向、纵向、树形、力导向。
- 修复：JOIN 条件子查询连接独立依赖端口；树形递归反馈避开 SCC 外的旁支，标注递归反馈。
- 结构与几何：67 个 Glossary 输入逐一验证四种手动布局，检查节点和连接身份、真实输入生产者、JOIN 左右角色、Boundary 包含、端口方向、正交路径、无节点重叠和无关节点穿越。
- 回归：16 个相关文件、634 项通过，见 [测试日志](../sql-flow-multilayout-related.log)。[类型检查](../sql-flow-multilayout-typecheck.log)退出码 0，无诊断；[生产构建](../sql-flow-multilayout-build.log)退出码 0。现有 DuckDB worker eval 和大包警告保留。
- 真实 DuckDB：含一次 CTE 定义、两处引用、嵌套查询与 JOIN 的查询返回 `(1,20)、(2,40)、(3,60)`。四种布局均保留 12 个节点、12 条连接及全部 success 状态；见 [切换记录](layout-switch-state.json)与 [树形效果](layout-tree.png)。
- 运行中切换：`SELECT sum(sin(i)) AS work FROM range(30000000) r(i); SELECT 2 AS next_statement;` 从力导向切换树形后，第一条 4 个节点仍 running，第二条 3 个节点仍 queued，输出端口转为底部；编辑器高亮仍精确覆盖第一条。见 [运行中 DOM 记录](layout-during-run.json)。完成后各节点均 success，后续语句返回 2。

树形保留共享输入与多输入汇合的真实 DAG，不复制节点。力导向提供空间探索，箭头方向不受单一层级方向限制；大图仍需平移，默认缩放不低于 85%，手动适配全图允许缩小。字段级相关引用的限制沿用 [支持矩阵](README.md)。没有改动 SQL 执行逻辑，也没有提交或整理其他模块已有改动。
