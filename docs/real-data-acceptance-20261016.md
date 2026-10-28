# DuckDB Editor Pro 真实数据验收记录

验收日期：2026-10-16。结论：**有条件通过**。指定四表的核心流程已完成真实运行；本报告不代表所有功能、规模和运行环境均已验收。最终自动化汇总见下方验证结果。

## 任务与可回退基线

按用户指定的 [loop-engineering-meta](https://github.com/lovemoganna/Org-Skills/blob/main/skills/loop-engineering-meta/SKILL.md) 执行；读取并复核远端 blob `fb98899160a0d579d7567ab7af96b88d3937eb59`，原文保存在证据目录。进行了两轮产品修复，分别只改变日期转换和共享图表布局。

证据目录：`C:\Users\luoyu\Desktop\Duckdb_Manager\audit-20261015`（沿用任务开始日期）。以下证据文件均相对此目录。

- 基线 HEAD：`4fd454247c2b34bcb9aea2014d6246e41e5c0575`。工作区原有大量未提交修改，未执行重置、提交或推送。
- `workspace-before.zip` 保存 2,412 个原有 Git 跟踪及非忽略未跟踪文件；`workspace-before-sha256.json`、`baseline-git-status.txt`、`baseline-working.diff` 保存内容指纹和状态。忽略目录（依赖、构建产物、业务数据库）不在源码快照内。
- 本次隔离浏览器和数据库测试使用端口 5191/5192；用户原有 5173 服务和浏览器会话未重置。构建输出写入证据目录，未覆盖既有 dist。
- 原始全量基线测试未取得完整通过结论：运行超时后停止本次测试进程，详见 `baseline-tests-status.txt`。不能把修复后的通过结果倒推为修复前通过。

## 固定样本与独立数据依据

原始文件：`C:\Users\luoyu\AppData\Roaming\.emacs.d\org-roam\pages\sql\exchange_funds_flow_dataset.xlsx`。

SHA256：`1630f146e0d7e92005881be3a1a4e15fd34d31ba31133de76a7258e2f86bc1fc`，验收结束再次核对一致。

仅读取 users、fiat_transactions、crypto_transactions、exchange_rates，非空数据行分别为 **10、25、25、8**，共 68 行；去掉 Excel 空白尾行，没有生成业务样本。独立 openpyxl 读取原值，原生 Python DuckDB 1.4.0 使用 DECIMAL(38,12) 计算金额。浏览器实际 DuckDB WASM 1.33.1 执行相同 SQL 对账。`oracle.json` 包含模式、空值、查询和期望值，`source-rows.json` 保留核对原值，`oracle.duckdb` 可重新执行。

| 核对项目 | 固定口径及预期 |
| --- | --- |
| 单表透视 | fiat_transactions，USD，status=completed，channel × direction |
| 总金额 | 104270 USD，非跨币种相加，不减手续费 |
| 净流入 | deposit 正、withdrawal 负，47730 USD，不减手续费 |
| 渠道 | wire_transfer 102000；ach 2270 |
| 四个透视单元格 | wire deposit 75000、withdrawal 27000；ach deposit 1000、withdrawal 1270 |
| 总平均值 | 104270 / 9 = 11585.55555556；不是两个渠道平均值的简单平均 |
| 用户连接汇总 | AE 35000、JP 1450、KR 820、US 67000 |
| 日期 | 全部 6 个日期列逐项与原始工作簿核对，保留真实毫秒 |

多表分析先检查实值：users.uid 10/10 唯一且非空，两张交易表订单号各 25/25 唯一，用户关联孤儿数均为 0，两张交易表各自连接 users 后均为 25 行。交易表彼此直接按 uid 连接产生 **71 行**，存在事实表扇出，不能据此直接汇总金额。`join-extra-checks.json` 保存额外 SQL 和结果。

汇率表 asset/quote_currency/effective_date 组合唯一，加密资产均有匹配；8 条汇率均生效于 2024-09-01，交易跨越后续日期。这里只验证覆盖和键，不将其冒充交易当日汇率，不宣称跨币种时点折算已验收。

## 功能状态与实际覆盖

| 能力 | 实现状态 | 本次验证状态 |
| --- | --- | --- |
| 四表 Excel 导入、数据浏览 | 已实现 | 真实 UI 导入，行数和日期通过 |
| 单表透视 count/sum/avg、筛选、明细 | 已实现 | 对账通过，空结果、快速更换筛选通过 |
| SQL 编辑与计算 | 已实现 | 编辑器执行净流入 SQL；独立 SQL 对账通过 |
| 指标定义、校验、保存、生成图表 | 已实现 | 实际服务持久化和 UI 编辑、校验、保存通过 |
| Chart.js 与首页展示 | 已实现 | 两个真实分析图，1440/1024/768/390 宽度通过 |
| 首页筛选与状态隔离 | 已实现 | 104270 → 102000 → 104270；数据集及数据库切换通过 |
| 错误与空结果 | 已实现 | 不存在的字段显示错误；空结果明确提示，不显示为金额零 |
| 用户维度关联 | 已实现 SQL 能力 | 唯一性、孤儿、基数及金额核对通过 |
| 交易当日多币种折算 | 本样本无足够时点汇率 | 未验收，不补造数据或结果 |
| 长期 OPFS 持久化、其他浏览器、大数据并发、AI 功能 | 不据设计文档判断完成 | 本次未验证 |

UI 测试直接运行应用、DuckDB 和 Chart.js。无网络/查询结果 Mock；错误用例执行真实错误 SQL。现有单元测试中的隔离替身只承担单元回归，不用作业务验收证据。

## 缺陷、根因与最小修复

### D1：Excel 日期提前 1 毫秒

真实记录 `2024-01-15 08:30:00` 导入成 `08:29:59.999`。根因是 read-excel-file 9.3.4 的 Excel 浮点日期转换使用 Math.floor，浮点误差被向下截断。通过 pnpm 官方补丁机制将 ESM/CJS 两处转换改为 Math.round；不替换 DuckDB 或导入技术栈。

证据：`runtime-before.json`、`date-red*.log`、`date-green.log`；补充真实四表测试和 .123/.999/.001 毫秒边界测试。浏览器最终逐项核对全部 6 个日期列，生产构建也检查原记录。真正小数毫秒未被粗暴舍入到整秒。

文件：`patches/read-excel-file@9.3.4.patch`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`；`.gitignore` 允许保存补丁。依赖版本未升级。

### D2：窄屏图表左轴不可达

390px 首页图表容器内 canvas 左边界为 -23px，容器为 13px，左侧 36px 因 flex 居中溢出而被裁掉。仅检查卡片不重叠不足以发现此问题，截图复核后补充了 canvas 边界和滚动可达性断言。

修复共享 `components/charts/ChartRenderer.tsx`：移除外层强制居中，内层使用自动边距，空间足够时居中，溢出时从可滚动起点开始。修复后 canvas 与容器左边界均为 13px；保留完整数据和横向滚动。

证据：`axis-red.log`、`axis-red/canvas-bounds-390.json`、修复后 `acceptance-final` 截图/几何断言、`production-visible/home-390.png`（滚动至图表后拍摄）；共享图表定向回归 5 文件 25 测试通过。

## 验证结果与失败记录

- 开发环境真实浏览器：`acceptance-final/checks.json`、`trace.zip`、各宽度截图及 SQL 对账文件，21 项检查，浏览器未捕获异常为 0。
- 生产构建真实 UI：`production-replay.log`、`production-visible/checks.json`，导入日期、透视汇总、窄屏首页图表三项通过。
- 类型检查：`final-typecheck-after-chart.log`，退出码 0。
- 最终生产构建：`build-final.log`，输出 `build-final`，退出码 0；保留既有大包、eval 和静态/动态混合导入警告。
- 最终全量单元/组件回归：`final-all-tests.log`，296 个测试文件、2695 项测试全部通过（耗时 1222.61s，退出码 0），包含图表修复与日期补丁后全量回归验证。
- 依赖审计：`dependency-audit.json`，5 中危、3 低危、0 高危、0 严重，**安全依赖审计未通过**。涉及现有 mermaid、DOMPurify、KaTeX 等，未为本任务擅自升级其版本。

保留失败尝试，不将测试脚本错误计为产品缺陷：SQL 别名语法、Arrow 日期表示差异、Vite 旧缓存、初次导航等待、测试 widget 缺 title、金额缩写与断言不一致、生产导入结束但网格尚在加载。分别修正测试口径/等待/配置后重放。`production.log` 保留过早断言失败，`production-replay.log` 是重新等待真实记录后的结果。默认 Vitest forks 的 Windows 停滞改用单 worker threads，并保留原日志。

## 重放与回退

在 duckdb-editor 目录，使用当前项目依赖执行（native Python 需要 openpyxl 和 duckdb）：

```powershell
python scripts/prepare-funds-acceptance.py --source 'C:\Users\luoyu\AppData\Roaming\.emacs.d\org-roam\pages\sql\exchange_funds_flow_dataset.xlsx' --output ../audit-20261015
pnpm install --frozen-lockfile
# 单独终端启动验收服务；隔离缓存避免旧依赖预构建
$env:VITE_ACCEPTANCE_CACHE_DIR='node_modules/.vite-funds-acceptance'
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5191 --strictPort --force
# 另一个终端
node scripts/test-funds-acceptance.mjs
node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=1 --no-file-parallelism --reporter=verbose
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build --outDir ../audit-20261015/build-final
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5192 --strictPort --outDir ../audit-20261015/build-final
# 另一个终端
node scripts/test-funds-production.mjs
```

脚本支持 FUNDS_BASE_URL/FUNDS_OUTPUT，开发验收还支持 FUNDS_ORACLE；用新的输出目录保留失败证据。`acceptance-delivery-files.json` 与 `acceptance-delivery.diff` 是本次修复清单，相对于任务开始工作区，而非 HEAD。原始 `delivery-files.json` / `delivery.diff` 可能包含任务开始后其他工作产生的差异，不应用作本次修复的独占归属证明。

如需回退，先确认本次文件之后没有新的编辑，再从 workspace-before.zip 恢复 acceptance-delivery-files.json 中 changed 文件的任务前版本，并逐项处理本次 added 文件；勿整仓 reset。恢复依赖补丁配置后重新安装锁定依赖。此操作未执行，快照是源码回退材料而非业务数据库备份。

## Loop QA 与剩余风险

G0 任务范围、G1 轨迹、G2 独立证据、G4 授权与回退、G6 复用维护符合本次范围；G3 为指定核心路径的有条件通过；G5 以最终全量回归及真实边界重放共同确认。保留两项共享修复，不采用组件逐个补丁。

停止原因：已复现的两个产品缺陷完成最小修复及真实重放，指定核心流程已有独立数据证据。仍有明确未通过/未验证项：8 条依赖漏洞告警；仅 68 行和 Chromium 的验证不能证明规模性能、任意请求竞争、所有浏览器或长期存储可靠；汇率不具备交易日粒度；特殊 Excel 自定义日期格式未全面覆盖。

用户 5173 服务未重启，已有预构建缓存可能仍包含旧日期解析代码。使用修复需重启/重新构建；已经导入并存储的错误日期不会自动纠正，需要从原文件重新导入。没有自动修改用户历史数据库。

### 后续工作区变更边界

最终全量测试日志在 2026-10-16 04:33（执行主机时间）结束。继续核实时发现 `services/analysis/types.ts` 与 `docs/pivot-enhancement-spec-20261016.md` 等透视增强文件在测试之后发生修改，且仍有后续文件变化；完整排除清单见 `acceptance-delivery-files.json` 的 excluded_later_changes。这些改动不属于上述两项修复，已保留，不计入本次交付清单，也未被本次最终测试覆盖。因此通过结论适用于已验收的修复版本，不能据此宣布当前所有后续改动都通过回归。持续变化的工作区需要在透视增强改动稳定后另做验收。
