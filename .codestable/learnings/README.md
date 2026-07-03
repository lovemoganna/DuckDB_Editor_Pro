# learnings/ — AI 失败模式与踩坑记录

> AI 每次会话结束时，记录本次发现的问题到这里。格式见 `feedback-template.md`。

## 反馈记录格式

每次会话结束，追加一条以下格式的记录到 `sessions/` 子目录：

```
日期：{YYYY-MM-DD}
会话摘要：{本次会话完成的工作}
失败类型：[误解需求 / 违反架构 / 引入bug / 风格不一致 / 越界修改]
描述：{发生了什么}
根本原因：{AI缺少的上下文是什么，或哪条规则不存在}
规则更新：{已将以下规则添加到 attention.md / PROJECT-HARNESS.md / ...：……}
```

## 已记录的反馈（按日期倒序）

> 以下是从历史会话中整理的已知失败模式。

### 2026-06-08

**会话摘要**：执行自查自纠计划 Phase 1-2，共完成 8 项任务。

**失败模式 1：混淆重复文件的真假**
- 描述：git status 显示 `D3GraphView.tsx` 和 `D3GraphView/D3GraphView.tsx` 看似重复，实际是 Windows 路径显示格式问题（`/` vs `\`），只有一个真实文件。
- 根本原因：AI 不理解 Windows 路径的 `\` 是显示格式而非路径分隔符。
- 规则更新：已添加到 `attention.md`：> "Git status 中的反斜杠路径是 Windows 显示格式，不是实际文件"

**失败模式 2：str_replace 在大文件上失效**
- 描述：对 1700 行的 `MetricManager.tsx` 和 670 行的 `LibraryApp.tsx` 进行大块删除时，str_replace 因微小内容差异反复失败。
- 根本原因：大段文字中含不可见差异（空白符、中英文标点），精确匹配失败。
- 规则更新：超过 200 行的内联数据对象，应直接创建新的 `data/*.ts` 文件，然后用 import 替换，而非尝试 str_replace 删除内联对象。

**失败模式 3：TypeScript 相对路径计算错误**
- 描述：`components/MetricManager.tsx` 导入 `../../data/metricHelp` 失败，实际应为 `../data/metricHelp`（一级目录差异）。
- 根本原因：AI 错误计算了相对路径层数。
- 规则更新：已添加到 `attention.md`：> 路径计算：组件文件在 `components/` 下，data 在根目录，相对路径为 `../data/`。

---

*如需添加新记录，在 `sessions/` 下创建 `YYYY-MM-DD.md` 文件。*
