# 首页组件稳定性实施与验收（2026-10-08）

本轮在现有大量未提交改动上实施最小修复。没有回退其他工作，没有重新生成业务数据或改动原资金总览。本文仅归属本轮新增修复与实际执行的验证，不把以前报告的 PASS 自动继承为本轮结果。

## 六、待确认项的核实结果

### 1. 固定数据来源、版本和内容

来源为项目已有 Google Sheet 下载快照，见 `data/crud-lab/manifest.json` 与 `data/crud-lab/README.md`。原地址是清单中的 XLSX 导出链接；本轮使用冻结文件，没有重新下载可能变化的在线表。

- 下载时间：2026-10-02T00:22:34.341732+00:00（洛杉矶 2026-10-01 17:22:34）。
- XLSX SHA256：`6be7f75d21611e38888819204bccad8c161a965abde7d0039336cf5746718315`。
- `data/crud-lab/baseline.duckdb` SHA256：`a16db823884ef4c8a6056214c624eaf12fc12a454e31a93f2ab180b5948cc887`；存储兼容版本 v1.0.0。
- 四张真实业务表：users 10、fiat_transactions 25、crypto_transactions 25、exchange_rates 8，共 68 行。法币 DECIMAL(18,2)，加密 DECIMAL(18,8)，uid 按原清单无损统一 BIGINT，时间不推断时区。
- 浏览器活动库是 `sql_funds_flow.main`。顶部的 13 张表 / 96 行还包含现有技术表，不能把这些统计混同为四表基线，也没有删除技术表。

原始四表和磁盘数据库均只读。浏览器验收复制出“稳定性验收 20261008”，仅在副本测试条件、布局和组件增删；原“资金业务总览”仍为 10 项。磁盘基线与浏览器 OPFS 是独立存储，本轮不宣称两文件逐字节一致。

### 2. 指标口径、页面初态与独立预期

初态为资金总览的 10 项组件、浏览模式、无全局和联动条件、图例全部可见。刷新子案例显式选择法币明细、关闭 net 系列；全屏、窗口变化与编辑布局分别作为子状态，不改变原始业务口径。

金额按币种 / 资产分开，不换算、不跨单位合计。完成交易只含 completed；总额是完成入金与出金之和，不扣手续费；净额为入金减出金；完成率为两个交易表的 completed 数 / 交易总数。月度趋势使用 USD 原始订单创建日期范围补齐月份，按 completed 聚合。

| 指标 | 无条件预期 | wire_transfer 显式绑定法币表 |
|---|---:|---:|
| USD 完成交易总额 | 104270 USD | 102000 USD |
| USDT 完成交易总额 | 13000 USDT | 不受法币条件影响，提示适用范围 |
| USD 净流入 | 47730 USD | 48000 USD |
| 完成率 SQL | 43 / 50 = 86% | 本轮不新增已被用户移除的完成率卡片 |
| USD 月度趋势 | 2025-01 至 2025-10，10 行；net 合计 47730 | 由筛选后真实订单日期范围计算 |

独立核验新增于 `fundsBaseline.integration.test.ts`：使用已有 read-excel-file 直接读冻结 XLSX 原始行，在测试侧分别计算数量、金额、净额、完成率、渠道条件与逐月数组，然后对照生产运行时执行的真实 DuckDB 结果。它不读取生产 SQL 来生成这些独立预期。其他组件的 SQL 原样执行对照仍保留，作为传输与运行时回归，明确不称为独立业务口径验证。

### 3. 实际模块、职责和保存依赖

入口为 App → Dashboard → useDashboardWorkflow / DataIdeMissionControl → HomeBoardCanvas → DashboardGrid → DashboardWidget → executeWidget → DuckDB。明细另走 DatasetPreview，但使用同一编译器、数据集和条件。图表由现有 Chart.js / ChartRenderer 呈现。

| 层 | 实际模块与输入输出 | 状态 / 错误边界 |
|---|---|---|
| 数据与计算 | datasets、queryCompiler、workbench/runtime；字段、定义、参数和条件 → SQL、真实行、总数、类型与适用范围 | 实际 SQL 查询、缓存失效和请求合并；失败不生成替代数值 |
| 基础组件 | ChartRenderer、Chart.js 适配器、chartSpace / tableSpace、DashboardWidget | 查询代次保护；本轮结果范围与定义保护；空结果不等于未加载 |
| 组合 | HomeBoardCanvas、DatasetPreview、WorkspaceObjects、DashboardGrid | 刷新信号、数据集读取、条件联动、图例共享、读模式尺寸适配、编辑模式布局 |
| 首页 | Dashboard、useDashboardWorkflow、DataIdeMissionControl | 元数据刷新、数据库范围、加载 / 错误 / 空状态与已保存视图 |
| 保存 | dbService、homeDashboardService、DuckDB OPFS | 当前库 `__studio` 元数据；dashboard、active-home-view、workbench-datasets-v1；updateDashboard 串行读取最新保存状态后合并修改 |

自动窗口测量只产生临时阅读排版，不保存坐标。用户拖拽 / 调整尺寸走原有停止回调与串行保存。没有增加另一套状态或保存机制。

### 4. 有限兼容性范围和数量

限三个现有真实结构：users 的 uid、country_code 与 account_status；exchange_rates 的定点数、日期和来源文本；crypto_transactions 的定点数、整数与 nullable 完成时间。只读取原表投影，不造行、不导入新数据集、不要求自动生成同一看板。每个结构用真实 DuckDB 读取并验证表格适配不丢行、不改值、字段保持完整。执行入口为 `homeCompatibility.integration.test.ts`，核心基线通过后单独执行，3 项通过，见 compatibility-verified.log。初次查询误写 country，DuckDB 明确拒绝；依据真实 DESCRIBE 修正为 country_code，失败记录保留在 compatibility.log，不算产品缺陷，也没有修改预期结果。同三张原表的浏览器明细检查尚未执行，不计入 PASS。

## 本轮缺陷闭环

| 编号 | 复现 / 根因 | 最小修复 | 前后证据 |
|---|---|---|---|
| S1 | 同范围刷新无条件清空行；`loading && !data.length` 使全屏窗口和已成功的空结果一起退出渲染 | 以输入范围和成功状态判断加载，刷新期间保留同范围成功结果；成功空结果同样处理 | widget-before：全屏与空结果两个新增案例失败；widget-after 与最终组件回归通过 |
| S2 | 改变筛选后执行失败，只清空行，保留旧 total、updatedAt、notices 和类型，旧分页仍可见 | 成功结果元信息作为一个范围清除；失败不残留旧总数、旧时间、旧说明或旧行 | widget-before 第三个新增案例失败；widget-after 与最终组件回归通过 |
| S3 | 同查询 ID 修改保存的 SQL / 名称后，等待期间把旧数值展示在新定义下 | 比较实际查询与呈现定义；定义变更清除旧结果；忽略创建时间等非计算元信息 | definition-before：1 失败 / 8 通过；definition-after：9 通过；最终组件回归通过 |
| M1 | 回归脚本原来把各层混在一个测试批次，不保证下层失败后停止上层 | 脚本按四层顺序执行，保留分层日志和整轮日志；纳入实际网格鼠标交互回归 | verified 目录两轮分层日志 |

生产修改限 DashboardWidget；其他修改为测试与回归脚本。错误标题改为“查询失败”，不把暂时读取失败一概描述为定义失效。查询、单位、Chart.js、原有配置及专业 IDE 风格保留。

网格手势新增测试运行真实 react-grid-layout，通过鼠标事件验证移动、尺寸和锁定。仅替代子组件为拖动手柄，不提供伪造查询数据；jsdom 的尺寸测量需控制，不能替代浏览器视觉检查。测试搭建期间的失败保存在 grid-gestures 系列日志中，其中 offsetParent 缺失与垂直压缩预期属于测试环境校准，不登记为产品缺陷。

开发中首次类型检查发现两个 useRef 缺少初始值，已修正；`final/typecheck.log` 保留该失败，不能当作最终通过日志。

## 验证结果

两轮核心分层均通过：底层 6 文件 / 42 项，基础组件 7 文件 / 37 项，组合 6 文件 / 16 项，首页 3 文件 / 15 项；每轮共 22 个文件、110 项。批次不重复累计为不同测试数量。构建阶段日志见 `verified/`。续做时使用最终脚本完整复跑两轮和兼容性阶段，退出 0：最新类型检查、每层每轮日志及 3 项兼容性通过记录见 `delivery/`。

已核验浏览器副本保存渠道条件、重载恢复与取消条件；USD 指标分别为 102000 / 48000 和 104270 / 47730。全屏月度明细为 10 行，与固定口径一致，保存为 monthly-browser.json。全屏跨 1440、1280、1024、768、390px 保持打开与 net 隐藏状态，见 fullscreen-evidence.json 与对应截图。

实际拖拽将 USD 卡片 x 从 0 移至 2；实际调整 w 从 2 至 3、h 从 3 至 4，对应 236×196 → 358×264。邻接卡片自动让位。完成编辑、重载、再次编辑后，全部组件样式坐标与尺寸逐项一致，`layout-gesture-reopened.json` 中 same=true。原资金总览未受这些布局操作影响。

最终类型检查通过（typecheck-delivery.log）；构建退出 0，耗时 2 分 31 秒（verified/build.log）。构建保留既有 DuckDB eval 与分包大小警告。相关修改的 diff 空白检查通过，不将其他未提交工作归为本轮。

稳定版本连续十轮刷新均完成，USD 104270、net 47730、法币明细 25 行、10 个组件与 net 图例关闭状态保持正确，见 stable-refresh-evidence.json。早期 refresh-evidence.json 包含热更新和未完成请求期间的失败观察，不能当作十轮成功。

首页窗口分别为 1440、1280、1024、768、390px；各档数据、图例状态和组件数量保持一致，页面 scrollWidth 与视口一致，见 home-size-evidence.json。宽类别图在卡片内部保留横向滚动，不把所有类别压缩为不可读标签；因此不宣称所有图表在窄屏无需滚动。全屏 390px 的有效截图为 fullscreen-390-stable.png；首次截图未完成画面更新的 fullscreen-390.png 仅保留为过程证据。

monthly-browser.json 是浏览器单元格串接文本，只用于证明真实明细可见，不将串接字符串当作可解析金额或合计。逐月金额的独立核验以冻结 XLSX 与真实 DuckDB 的分层测试为准。

本轮借鉴 diagnosing-bugs 的最小复现、失败证据和修复后关联回归方法，以及 playwright 的逐步观察和交互后核验方法；没有引入新架构或扩展业务功能。

## 验收矩阵与完成判定

| 验收项 | 当前结果 | 实际覆盖与边界 |
|---|---|---|
| 真实计算 | PASS | 原始 XLSX 独立计算对照真实 DuckDB；无条件、渠道条件、完成率与逐月数组 |
| 数据加载 | PASS（已执行范围） | 固定文件哈希、真实查询、空结果、缺失字段、失败与重试；失效结果与元信息清除 |
| 筛选联动 | PASS（固定案例） | 渠道条件保存、重载及取消；适用范围提示；底层条件编译与页面联动回归 |
| 尺寸变化 | PASS（五档宽度） | 首页与全屏五档尺寸、图例和数值；实际拖拽与尺寸改变；窄屏使用内部滚动 |
| 全屏交互 | PASS（已执行范围） | 进入退出、图例共享、五档尺寸；同范围刷新及成功空结果的组件回归 |
| 状态切换 | PASS（已执行范围） | 十轮刷新；旧响应、旧错误隔离；查询定义改变清除旧结果 |
| 保存恢复 | 部分 PASS | 筛选与实际坐标尺寸重载恢复通过；组件新增、移除、重载恢复未执行 |
| 分层回归 | PASS | 两轮四层测试，各 22 文件 / 110 项；最终交付脚本另行复跑并记录 |
| 缺陷复验 | PASS | S1–S3 均有失败日志、根因、最小修改和回归；M1 有分层脚本和日志 |
| 兼容性 | PASS（计算与适配） | 三种原表结构真实查询与表格适配；对应浏览器明细未验证 |
| 功能保护 | PASS（已执行范围） | 技术栈、原始数据哈希、原视图和已有有效配置保留；不代表所有项目功能 |

**本轮尚不能按 BRD 判定全部完成。** 尚未执行：浏览器组件增删后重载恢复、真实 30 秒定时刷新与全屏组合、三种兼容结构的浏览器明细。定时器触发由 HomeLifecycle 单元测试覆盖，全屏刷新由 DashboardWidget 单元测试覆盖，但分开通过不能替代该组合的浏览器验收。

最后浏览器状态为“稳定性验收 20261008”副本、390px 测试视口；原资金总览的定义与数据未修改。续做时内置浏览器控制工具未出现在可调用工具列表中，旧浏览器会话也未在当前 JavaScript 会话恢复，因此没有通过其他方式修改隐藏应用状态或声称已返回原视图。恢复默认视口和返回“资金业务总览”仍待执行。

续做已尝试 Playwright CLI 的独立浏览器，页面正常启动，控制台 0 errors / 1 warning，但它进入新的 `memory [MEMORY]` 空工作区，0 张表，控制台报告 High-Performance Mode: OFF / Persistence may be limited。它未获得原浏览器的 OPFS、视图和配置，不能将该空工作区的成功启动算作固定基线的交互验收。该临时会话已关闭，未导入替代结果或修改原浏览器。相关启动快照与警告保存于 fallback-browser 证据文件。

## 重复执行与验收边界

在项目目录执行：`./scripts/test-home-baseline.ps1 -Repeat 2 -Build -LogDirectory docs/dashboard-stability-20261008/recheck`。脚本校验基线文件和 DuckDB CLI，运行类型检查，每轮按四层执行；失败即停止。核心轮次后执行三项有限结构回归，再按参数决定是否构建。有限结构测试也可单独执行：`pnpm exec vitest run --pool=forks --maxWorkers=1 services/workbench/homeCompatibility.integration.test.ts`。本轮先执行两轮核心与构建；最终脚本再使用 `-Repeat 2 -LogDirectory docs/dashboard-stability-20261008/delivery` 完整运行，包含类型检查、两轮四层和最后三项兼容性，退出 0。复跑期间无生产修改，未重复构建。

没有运行全项目所有测试；本轮通过只覆盖上述首页依赖与案例。长时间运行、其他浏览器、所有图表类型及全部配置组合不属于本次固定范围的 PASS。仍须明确实际执行的浏览器尺寸 / 手势 / 保存检查与控制时序的单元测试各自证明的行为。未配置的下钻不临时启用，其他已有数据库附件状态不在本轮修改范围。
