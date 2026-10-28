const p=[{key:"generation",label:"SQL 生成与转换",icon:"⚡",description:"自然语言生成 SQL (NL2SQL) 与高级 DE ETL 代码"},{key:"diagnosis",label:"错误诊断与修复",icon:"🔍",description:"自动定位 DuckDB 运行时与语法故障，精准修复"},{key:"optimization",label:"性能重构与向量化",icon:"🚀",description:"CTE 重构、MACRO 与 DuckDB 向量化引擎加速"},{key:"insight",label:"数据与结果洞察",icon:"📊",description:"结果集特征提取、商业结论总结与逐行代码解释"},{key:"quality",label:"数据质量审计",icon:"🛡️",description:"SUMMARIZE 自动质检、空值检测与断言生成"},{key:"schema",label:"Schema 模型演进",icon:"📐",description:"数仓分层建表 DDL 与物理视图 (VIEW) 定义"}],r=[{id:"nl2sql",name:"自然语言生成 SQL (NL2SQL)",category:"generation",description:"自动感知当前 DuckDB 数据库 Schema 结构，根据业务自然语言描述生成极简可执行 SQL。",purpose:"从自然语言描述快速转化为可运行的 DuckDB 方言 SQL 查询。",inputRequirement:"Schema 上下文 + 用户自然语言需求描述",outputRule:"直接输出可执行的 SQL 代码段，并在顶部带单行注释说明。",promptTemplate:`请为 DuckDB 生成满足以下业务需求的 SQL 语句：
【需求描述】: {userPrompt}

【当前表结构与字段】:
{schemaContext}

请直接输出可执行的 SQL 代码，并在注释中简要说明逻辑。`,contextParams:["Schema 上下文","用户需求"],tags:["NL2SQL","DuckDB 方言","Schema 感知"],isSystem:!0},{id:"error_fix",name:"错误智能诊断与修复",category:"diagnosis",description:"捕获 DuckDB 运行时与语法错误日志，定位错定位与列号，提供可替换的精准修正 SQL。",purpose:"解决 SQL 运行报错、找不到列、函数签名不匹配与方言兼容性故障。",inputRequirement:"错误日志 + 报错原 SQL + Schema 上下文",outputRule:"输出错误根因简析，并提供完全可替换运行的修正 SQL 代码。",promptTemplate:`请分析并修复以下 DuckDB SQL 错误：
【错误信息】: {errorMessage}

【报错原 SQL】:
{currentSql}

【相关表结构】:
{schemaContext}

请指出具体错误原因，并输出修正后的可执行 SQL 代码。`,contextParams:["错误日志","当前 SQL","Schema 上下文"],tags:["错误定位","自动修复","DuckDB 语法"],isSystem:!0},{id:"sql_optimize",name:"DuckDB 性能与语法重构",category:"optimization",description:"利用 DuckDB 向量化引擎、CTE、MACRO 与并行扫描优化现有的复杂查询语句。",purpose:"解决慢查询、子查询性能低下与高内存开销计算。",inputRequirement:"当前 SQL + Schema 上下文",outputRule:"输出使用向量化优化与 CTE 重构后的高效 SQL。",promptTemplate:`请对以下 SQL 进行重构优化，提升在 DuckDB 向量化引擎中的查询执行效率：
【原 SQL】:
{currentSql}

【表结构上下文】:
{schemaContext}

请使用 CTE 结构优化子查询，利用 DuckDB 特有语法（如 SUMMARIZE, PIVOT, SAMPLE）提升性能。`,contextParams:["当前 SQL","Schema 上下文"],tags:["向量化性能","CTE 重构","DuckDB 方言"],isSystem:!0},{id:"sql_explain",name:"SQL 代码精准读懂与解释",category:"insight",description:"逐行拆解复杂 SQL 的逻辑步骤、关联关系与数据流走向，生成 Markdown 解释报告。",purpose:"帮助数据分析师和开发人员快速读懂复杂查询与继承项目代码。",inputRequirement:"当前 SQL 代码",outputRule:"生成包含【查询目的】、【表与字段关联】、【核心逻辑】、【输出含义】的 Markdown 报告。",promptTemplate:`请详细解释以下 SQL 查询的计算逻辑和数据指标：
【SQL 代码】:
{currentSql}

请从【查询目的】、【表与字段关联】、【核心计算逻辑】、【输出结果含义】4 个维度生成 Markdown 报告。`,contextParams:["当前 SQL"],tags:["代码解释","逻辑拆解","Markdown 报告"],isSystem:!0},{id:"result_insight",name:"查询结果集数据洞察",category:"insight",description:"自动扫描结果集的分布特征、极值与异常数据，归纳商业结论与下钻建议。",purpose:"从返回的结果集数据中提取商业发现、发现异常极值。",inputRequirement:"结果集数据 + 字段维度 + 数据行数",outputRule:"输出 Markdown 格式的数据概览、业务发现与下钻分析建议。",promptTemplate:`请对以下 DuckDB 查询结果集进行业务解读与数据质量分析：
【字段维度】: {columns}
【结果总行数】: {rowCount}
【样例数据】:
{sampleData}

请归纳【数据分布概览】、【核心业务结论】、【异常/极值提醒】与【进一步数据下钻建议】。`,contextParams:["结果集数据","字段维度","耗时统计"],tags:["数据洞察","异常检测","商业结论"],isSystem:!0},{id:"de_advanced_skills",name:"数据工程高级技能 (DE Skills)",category:"generation",description:"生成 Window 窗口函数、数据拉链表、PIVOT/UNPIVOT 透视与 DuckDB 宏函数 (MACRO)。",purpose:"处理复杂 ETL 数据转换、数据仓库清洗与高级管道工程。",inputRequirement:"当前 SQL + Schema 上下文 + 转化要求",outputRule:"输出符合 DuckDB 规范的高级 ETL 转换代码。",promptTemplate:`请使用 DuckDB 高级数据工程语法（窗口函数/QUALIFY/MACRO/透视表）完成以下需求：
【转化需求】: {userPrompt}

【现有 SQL】:
{currentSql}

【表结构】:
{schemaContext}

请直接输出高效的 DuckDB 转化 SQL。`,contextParams:["当前 SQL","Schema 上下文","用户需求"],tags:["窗口函数","MACRO 宏","透视分析","ETL"],isSystem:!0},{id:"data_quality_audit",name:"数据质量智能审计 (Data Quality)",category:"quality",description:"生成针对当前表的缺失率、唯一性、范围断言与异常统计分析 SQL 规则。",purpose:"在数据入库和分析前自动扫描数据质量与异常分布。",inputRequirement:"Schema 上下文 + 示例数据",outputRule:"输出包含 SUMMARIZE() 与断言比对的数据质检 SQL 脚本。",promptTemplate:"请为以下 DuckDB 数据表生成一套完整的数据质量审计与异常断言 SQL：\n【表结构】:\n{schemaContext}\n\n请输出利用 `SUMMARIZE` 和 `COUNTIF` 的质检 SQL 语句，检查空值率、重复值与极值。",contextParams:["Schema 上下文"],tags:["数据审计","SUMMARIZE","质量断言","空值检测"],isSystem:!0},{id:"schema_evolution",name:"Schema 智能模型演进 (Model DDL)",category:"schema",description:"根据分析需求自动设计 CREATE TABLE, ALTER TABLE 变更或 CREATE VIEW 视图定义。",purpose:"协助构建规范的数仓分层 (ODS/DWD/ADS) 与视图物理化。",inputRequirement:"当前 Schema 上下文 + 演进需求",outputRule:"输出标准规范的 DDL 或 CREATE VIEW 视图定义 SQL。",promptTemplate:`请为以下 DuckDB 数据模型生成 DDL 演进与视图建表语句：
【演进需求】: {userPrompt}

【当前 Schema】:
{schemaContext}

请输出符合 DuckDB 规范的 \`CREATE VIEW\` 或 \`CREATE TABLE\` DDL 语句。`,contextParams:["Schema 上下文","用户需求"],tags:["DDL 演进","视图创建","数仓模型"],isSystem:!0}],s="duckdb_standalone_ai_capabilities_v2",m="duckdb_ai_capabilities_changed";function c(){typeof window<"u"&&window.dispatchEvent(new CustomEvent(m))}function u(){try{const e=localStorage.getItem(s);if(!e)return r;const t=JSON.parse(e),i=new Set(t.map(n=>n.id));return[...r.map(n=>i.has(n.id)?t.find(o=>o.id===n.id):n),...t.filter(n=>!r.some(o=>o.id===n.id))]}catch(e){return console.error("Failed to load AI capabilities from storage",e),r}}function S(e){const t=u(),i=t.findIndex(n=>n.id===e.id);let a;i>=0?(a=[...t],a[i]=e):a=[...t,e],localStorage.setItem(s,JSON.stringify(a)),c()}function l(e){const t=u().filter(i=>i.id!==e||i.isSystem);localStorage.setItem(s,JSON.stringify(t)),c()}function d(){localStorage.removeItem(s),c()}function D(e,t,i="generation",a="由 SQL 编辑器沉淀的 AI 能力",n=["编辑器沉淀","自定义AI"]){const o={id:`cap_custom_${Date.now().toString(36)}`,name:e,category:i,description:a,purpose:a,inputRequirement:"Schema 上下文 + 业务需求",outputRule:"输出可执行 SQL 或分析报告",promptTemplate:t,contextParams:["Schema 上下文","用户需求"],tags:n,isSystem:!1,createdAt:Date.now()};return S(o),o}export{m as A,p as a,D as b,l as d,u as g,d as r,S as s};
