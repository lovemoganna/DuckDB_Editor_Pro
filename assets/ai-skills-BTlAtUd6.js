import{r as x,K as A,j as $,a4 as j,Z as W,as as U,R as J,c as X,m as Z,aj as ee,ac as T,ao as re,aK as te,W as I,aA as ne,a7 as M,a2 as ae,h as ie,ae as se,aL as oe,L as le,ag as ce,p as ue}from"./index-pB7eF6pf.js";import{ap as C}from"./vendor-mermaid-CZUUdkMV.js";import{B as z}from"./book-open-DIZkqY4A.js";import{W as me}from"./wand-sparkles-CXiNydaL.js";import{T as de}from"./type-PVAcLxs3.js";import{T as P}from"./trending-down-CCTs-eZy.js";import{S as q}from"./settings-2-CLP32kJS.js";/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pe=[["path",{d:"M6 18h8",key:"1borvv"}],["path",{d:"M3 22h18",key:"8prr45"}],["path",{d:"M14 22a7 7 0 1 0 0-14h-1",key:"1jwaiy"}],["path",{d:"M9 14h2",key:"197e7h"}],["path",{d:"M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z",key:"1bmzmy"}],["path",{d:"M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3",key:"1drr47"}]],ge=x("microscope",pe);/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ye=[["path",{d:"M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z",key:"w46dr5"}]],B=x("puzzle",ye);/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fe=[["circle",{cx:"9",cy:"12",r:"3",key:"u3jwor"}],["rect",{width:"20",height:"14",x:"2",y:"5",rx:"7",key:"g7kal2"}]],ir=x("toggle-left",fe),Se=[{id:"sql-select-generator",name:"SELECT 查询生成",description:"根据自然语言描述生成 SELECT 查询语句",category:"modeling",icon:"🔍",generatorId:"sql-select",inputSchema:[{name:"description",type:"textarea",required:!0,label:"查询描述",placeholder:"例如：查询所有订单金额大于1000元的客户",rows:3},{name:"conditions",type:"textarea",required:!1,label:"筛选条件",placeholder:"WHERE 条件，可选"},{name:"orderBy",type:"select",required:!1,label:"排序方式",options:["不排序","升序","降序"]},{name:"limit",type:"number",required:!1,label:"返回行数",defaultValue:100,min:1,max:1e4}],outputType:"sql",requiresTable:!0,requiresColumns:!0,triggers:{keywords:["查询","查找","获取","看看","显示","展示","query","find","get","show","select","read","list"],sqlOperations:["select"]},examples:[{name:"基础查询",input:{description:"查询所有用户"},description:"生成最基本的 SELECT 查询"},{name:"条件查询",input:{description:"查询活跃用户",conditions:"status = 'active'"},description:"带 WHERE 条件的查询"}]},{id:"sql-join-generator",name:"JOIN 查询生成",description:"生成多表关联查询",category:"modeling",icon:"🔗",generatorId:"sql-join",inputSchema:[{name:"joinType",type:"select",required:!0,label:"连接类型",options:["INNER JOIN","LEFT JOIN","RIGHT JOIN","CROSS JOIN","FULL OUTER JOIN"],defaultValue:"INNER JOIN"},{name:"rightTable",type:"table",required:!0,label:"右表"},{name:"joinCondition",type:"text",required:!0,label:"连接条件",placeholder:"例如：a.user_id = b.id"},{name:"selectColumns",type:"text",required:!1,label:"选择列",placeholder:"a.*, b.name"}],outputType:"sql",requiresTable:!0,requiresColumns:!0,triggers:{keywords:["关联","连接","合并","join","link","combine","merge"],sqlOperations:["join"]},examples:[{name:"用户订单关联",input:{joinType:"INNER JOIN",joinCondition:"a.user_id = b.id",selectColumns:"a.*, b.order_id, b.total_amount"},description:"关联用户表和订单表"},{name:"左连接查询",input:{joinType:"LEFT JOIN",joinCondition:"a.product_id = b.id",selectColumns:"a.*, b.category_name"},description:"使用左连接保留左表所有记录"}]},{id:"sql-aggregation-generator",name:"聚合查询生成",description:"生成聚合函数和分组查询",category:"modeling",icon:"📊",generatorId:"sql-aggregation",inputSchema:[{name:"aggregationType",type:"select",required:!0,label:"聚合类型",options:["COUNT","SUM","AVG","MIN","MAX","多聚合"],defaultValue:"COUNT"},{name:"groupBy",type:"text",required:!1,label:"分组列",placeholder:"按某列分组"},{name:"having",type:"text",required:!1,label:"HAVING 条件",placeholder:"分组后筛选"}],outputType:"sql",requiresTable:!0,requiresColumns:!0,triggers:{keywords:["统计","合计","求和","平均","计数","最大值","最小值","汇总","group","sum","count","avg","max","min","total","aggregate"],sqlOperations:["aggregation"]}},{id:"sql-window-function",name:"窗口函数查询",description:"生成窗口函数（OVER, PARTITION BY, RANK 等）",category:"modeling",icon:"🪟",generatorId:"sql-window",inputSchema:[{name:"windowFunction",type:"select",required:!0,label:"窗口函数",options:["ROW_NUMBER","RANK","DENSE_RANK","LAG","LEAD","SUM OVER","AVG OVER","FIRST_VALUE","LAST_VALUE"],defaultValue:"ROW_NUMBER"},{name:"partitionBy",type:"text",required:!1,label:"分区列",placeholder:"PARTITION BY col"},{name:"orderBy",type:"text",required:!1,label:"排序列",placeholder:"ORDER BY col"},{name:"frame",type:"select",required:!1,label:"窗口范围",options:["无","ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW","ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING"],defaultValue:"无"}],outputType:"sql",requiresTable:!0,requiresColumns:!0,triggers:{keywords:["排名","排序","累计","移动平均","滞后","领先","窗口","rank","row_number","lag","lead","cumulative","moving","window"],sqlOperations:["window"]}},{id:"sql-cte-generator",name:"CTE 查询生成",description:"生成 Common Table Expression（WITH 子句）",category:"modeling",icon:"🌳",generatorId:"sql-cte",inputSchema:[{name:"cteName",type:"text",required:!0,label:"CTE 名称",placeholder:"例如：recent_orders"},{name:"cteQuery",type:"textarea",required:!0,label:"CTE 查询",placeholder:"SELECT ... FROM ...",rows:3},{name:"mainQuery",type:"textarea",required:!0,label:"主查询",placeholder:"SELECT * FROM cte_name ...",rows:3}],outputType:"sql",requiresTable:!0},{id:"sql-insert-generator",name:"INSERT 语句生成",description:"生成数据插入语句",category:"modeling",icon:"➕",generatorId:"sql-insert",inputSchema:[{name:"values",type:"textarea",required:!0,label:"插入值",placeholder:"VALUES (val1, val2, ...)",rows:3},{name:"mode",type:"select",required:!0,label:"插入模式",options:["普通 INSERT","INSERT ... RETURNING","INSERT ... ON CONFLICT"],defaultValue:"普通 INSERT"},{name:"conflictAction",type:"select",required:!1,label:"冲突处理",options:["DO NOTHING","DO UPDATE SET"]}],outputType:"sql",requiresTable:!0,requiresColumns:!0},{id:"sql-update-generator",name:"UPDATE 语句生成",description:"生成数据更新语句",category:"modeling",icon:"✏️",generatorId:"sql-update",inputSchema:[{name:"setClause",type:"text",required:!0,label:"更新字段",placeholder:"column = new_value"},{name:"whereCondition",type:"text",required:!0,label:"更新条件",placeholder:"WHERE id = ?"},{name:"returning",type:"boolean",required:!1,label:"返回更新行",defaultValue:!1}],outputType:"sql",requiresTable:!0,requiresColumns:!0},{id:"sql-delete-generator",name:"DELETE 语句生成",description:"生成数据删除语句",category:"modeling",icon:"🗑️",generatorId:"sql-delete",inputSchema:[{name:"whereCondition",type:"text",required:!0,label:"删除条件",placeholder:"WHERE id = ?"},{name:"limit",type:"number",required:!1,label:"限制删除行数"},{name:"returning",type:"boolean",required:!1,label:"返回删除行",defaultValue:!1}],outputType:"sql",requiresTable:!0,requiresColumns:!0}],Ee=[{id:"sql-create-table-generator",name:"CREATE TABLE 生成",description:"生成建表语句，支持完整表结构定义",category:"modeling",icon:"🏗️",generatorId:"sql-create-table",inputSchema:[{name:"tableName",type:"text",required:!0,label:"表名",placeholder:"例如：users, orders, products"},{name:"columns",type:"textarea",required:!0,label:"列定义",rows:6,placeholder:`格式：列名 类型 [约束]
示例：
id INTEGER PRIMARY KEY,
name VARCHAR(100) NOT NULL,
email VARCHAR(255) UNIQUE,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
status VARCHAR(20) DEFAULT 'active'`},{name:"primaryKey",type:"text",required:!1,label:"主键",placeholder:"例如：id 或 (id, name)"},{name:"foreignKeys",type:"textarea",required:!1,label:"外键",rows:3,placeholder:`格式：FOREIGN KEY (列名) REFERENCES 表名(列名)
示例：
FOREIGN KEY (user_id) REFERENCES users(id),
FOREIGN KEY (category_id) REFERENCES categories(id)`},{name:"indexes",type:"textarea",required:!1,label:"索引",rows:3,placeholder:`格式：INDEX 索引名 (列名)
示例：
INDEX idx_email (email),
INDEX idx_created (created_at)`},{name:"engine",type:"select",required:!1,label:"存储引擎",options:["默认","DuckDB","Memory","Parquet"],defaultValue:"默认"},{name:"ifNotExists",type:"boolean",required:!1,label:"IF NOT EXISTS",defaultValue:!0}],outputType:"sql",requiresTable:!1,requiresColumns:!1,examples:[{name:"用户表",input:{tableName:"users",columns:`id INTEGER PRIMARY KEY,
username VARCHAR(50) NOT NULL,
email VARCHAR(100) NOT NULL,
password_hash VARCHAR(255) NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
last_login TIMESTAMP`,primaryKey:"id",ifNotExists:!0},description:"创建完整的用户表"},{name:"订单表",input:{tableName:"orders",columns:`order_id BIGINT PRIMARY KEY,
user_id INTEGER NOT NULL,
total_amount DECIMAL(10,2),
status VARCHAR(20) DEFAULT 'pending',
created_at TIMESTAMP`,foreignKeys:"FOREIGN KEY (user_id) REFERENCES users(id)",ifNotExists:!0},description:"创建订单表并设置外键"}]},{id:"sql-create-table-nl",name:"自然语言建表",description:"用自然语言描述需求，AI 自动生成表结构",category:"modeling",icon:"✨",generatorId:"sql-create-table-nl",inputSchema:[{name:"description",type:"textarea",required:!0,label:"表需求描述",rows:4,placeholder:`用自然语言描述你的表需求：

例如：创建一个用户管理系统，包含用户基本信息（用户名、邮箱、手机号、注册时间）、用户状态、会员等级等信息。还需要记录用户的收货地址，每位用户可以有多个收货地址。`},{name:"businessDomain",type:"select",required:!1,label:"业务领域",options:["通用","电商","用户管理","订单系统","库存管理","财务","日志分析","物联网"],defaultValue:"通用"},{name:"includeSample",type:"boolean",required:!1,label:"包含示例数据",defaultValue:!1},{name:"useAI",type:"boolean",required:!1,label:"启用 AI 增强",defaultValue:!0,description:"使用 AI 分析需求并优化表结构"}],outputType:"sql",requiresTable:!1,requiresColumns:!1,examples:[{name:"电商订单表",input:{description:"创建电商订单系统，包含订单主表和订单明细表。订单包含订单号、用户、下单时间、订单金额、支付状态、物流信息。订单明细包含商品、价格、数量、小计。",businessDomain:"电商",includeSample:!0,useAI:!0},description:"根据电商业务需求生成完整订单系统"}]},{id:"sql-create-table-template",name:"模板建表",description:"使用预置模板快速创建标准表结构",category:"modeling",icon:"📋",generatorId:"sql-create-table-template",inputSchema:[{name:"templateType",type:"select",required:!0,label:"选择模板",options:["用户表","订单表","商品表","分类表","支付记录表","日志表","配置表","关系表"],defaultValue:"用户表"},{name:"tableName",type:"text",required:!0,label:"表名",placeholder:"自定义表名，留空使用模板默认名"},{name:"customizeFields",type:"textarea",required:!1,label:"自定义字段",rows:3,placeholder:"添加自定义字段，每行一个：字段名 类型"},{name:"addStatus",type:"boolean",required:!1,label:"包含状态字段",defaultValue:!0},{name:"addTimestamps",type:"boolean",required:!1,label:"包含时间戳",defaultValue:!0}],outputType:"sql",requiresTable:!1,requiresColumns:!1,examples:[{name:"会员用户表",input:{templateType:"用户表",tableName:"members",addStatus:!0,addTimestamps:!0},description:"基于用户表模板创建会员表"}]},{id:"sql-create-table-import",name:"导入建表",description:"从 JSON、CSV 或剪切板导入表结构",category:"modeling",icon:"📥",generatorId:"sql-create-table-import",inputSchema:[{name:"importSource",type:"select",required:!0,label:"导入来源",options:["JSON","CSV","剪切板"],defaultValue:"JSON"},{name:"importData",type:"textarea",required:!0,label:"导入数据",rows:8,placeholder:`JSON 格式示例：
[
  {"name": "id", "type": "INTEGER", "pk": true},
  {"name": "username", "type": "VARCHAR(50)", "notNull": true},
  {"name": "email", "type": "VARCHAR(255)", "unique": true},
  {"name": "status", "type": "VARCHAR(20)", "default": "active"}
]

或 CSV 格式：
name,type,pk,notNull,unique,default
id,INTEGER,true,true,false,
username,VARCHAR(50),false,true,false,
email,VARCHAR(255),false,true,true,`},{name:"tableName",type:"text",required:!0,label:"表名",placeholder:"导入后的表名"},{name:"inferTypes",type:"boolean",required:!1,label:"智能推断类型",defaultValue:!0,description:"从数据值推断列类型"}],outputType:"sql",requiresTable:!1,requiresColumns:!1},{id:"sql-alter-table-generator",name:"ALTER TABLE 生成",description:"生成表结构修改语句（添加/修改/删除列）",category:"modeling",icon:"🔧",generatorId:"sql-alter-table",inputSchema:[{name:"alterType",type:"select",required:!0,label:"操作类型",options:["添加列","修改列","删除列","添加约束","删除约束","重命名表"],defaultValue:"添加列"},{name:"columnName",type:"text",required:!1,label:"列名",placeholder:"要操作的列名"},{name:"columnDefinition",type:"text",required:!1,label:"列定义",placeholder:"例如：VARCHAR(100) NOT NULL"},{name:"constraint",type:"text",required:!1,label:"约束",placeholder:"例如：PRIMARY KEY, UNIQUE, CHECK"},{name:"ifExists",type:"boolean",required:!1,label:"IF EXISTS",defaultValue:!1}],outputType:"sql",requiresTable:!0,requiresColumns:!0},{id:"sql-drop-table-generator",name:"DROP TABLE 生成",description:"生成删除表语句",category:"modeling",icon:"💣",generatorId:"sql-drop-table",inputSchema:[{name:"tableName",type:"text",required:!0,label:"表名"},{name:"mode",type:"select",required:!0,label:"删除模式",options:["DROP TABLE","DROP TABLE IF EXISTS","TRUNCATE"],defaultValue:"DROP TABLE IF EXISTS"},{name:"cascade",type:"boolean",required:!1,label:"CASCADE",defaultValue:!1,description:"同时删除依赖对象"}],outputType:"sql",requiresTable:!1,requiresColumns:!1},{id:"sql-view-generator",name:"CREATE VIEW 生成",description:"生成视图创建语句",category:"modeling",icon:"👁️",generatorId:"sql-view",inputSchema:[{name:"viewName",type:"text",required:!0,label:"视图名",placeholder:"例如：active_users_view"},{name:"query",type:"textarea",required:!0,label:"视图查询",rows:5,placeholder:"SELECT ... FROM ... WHERE ..."},{name:"replace",type:"boolean",required:!1,label:"OR REPLACE",defaultValue:!1},{name:"recursive",type:"boolean",required:!1,label:"RECURSIVE",defaultValue:!1}],outputType:"sql",requiresTable:!1,requiresColumns:!1},{id:"sql-index-generator",name:"CREATE INDEX 生成",description:"生成索引创建语句",category:"modeling",icon:"📇",generatorId:"sql-index",inputSchema:[{name:"indexName",type:"text",required:!0,label:"索引名",placeholder:"例如：idx_user_email"},{name:"tableName",type:"text",required:!0,label:"表名"},{name:"columns",type:"text",required:!0,label:"索引列",placeholder:"例如：email, (last_name, first_name)"},{name:"indexType",type:"select",required:!1,label:"索引类型",options:["BTREE","HASH","GIST","GIN","默认"],defaultValue:"默认"},{name:"unique",type:"boolean",required:!1,label:"UNIQUE",defaultValue:!1},{name:"ifNotExists",type:"boolean",required:!1,label:"IF NOT EXISTS",defaultValue:!0}],outputType:"sql",requiresTable:!1,requiresColumns:!1},{id:"sql-table-design",name:"表结构设计",description:"根据业务需求设计完整的表结构（支持多表关联设计）",category:"modeling",icon:"📐",generatorId:"sql-table-design",inputSchema:[{name:"businessObject",type:"text",required:!0,label:"业务对象",placeholder:"例如：电商订单系统、用户管理系统、库存管理系统"},{name:"tables",type:"textarea",required:!0,label:"表清单",rows:4,placeholder:`每行一个表及用途：
users - 用户信息
orders - 订单信息
order_items - 订单明细
products - 商品信息`},{name:"relationships",type:"textarea",required:!1,label:"表关系",rows:3,placeholder:`描述表之间的关系：
users 1-n orders
orders 1-n order_items
products 1-n order_items`},{name:"includeSample",type:"boolean",required:!1,label:"包含示例数据",defaultValue:!1}],outputType:"sql",requiresTable:!1,requiresColumns:!1,examples:[{name:"电商订单系统",input:{businessObject:"电商订单系统",tables:`users - 用户账户信息
addresses - 用户收货地址
orders - 订单主表
order_items - 订单商品明细
products - 商品信息
categories - 商品分类
payments - 支付记录`,relationships:`users 1-n addresses
users 1-n orders
orders 1-n order_items
orders 1-n payments
products 1-n order_items
categories 1-n products`,includeSample:!0},description:"设计完整的电商订单系统表结构"}]}],be=[{id:"analysis-time-series",name:"时间序列分析",description:"生成时间序列趋势分析查询",category:"insights",icon:"📈",generatorId:"analysis-time-series",inputSchema:[{name:"timeColumn",type:"column",required:!0,label:"时间列"},{name:"valueColumn",type:"column",required:!0,label:"数值列"},{name:"granularity",type:"select",required:!0,label:"时间粒度",options:["日","周","月","季度","年"],defaultValue:"月"},{name:"analysisType",type:"select",required:!0,label:"分析类型",options:["趋势分析","环比增长率","同比增长率","移动平均","累计增长"],defaultValue:"趋势分析"}],outputType:"sql",requiresTable:!0,requiresColumns:!0,examples:[{name:"月趋势分析",input:{granularity:"月",analysisType:"趋势分析"},description:"按月汇总数据趋势"},{name:"环比增长",input:{granularity:"月",analysisType:"环比增长率"},description:"计算月度环比增长率"},{name:"移动平均",input:{granularity:"日",analysisType:"移动平均"},description:"计算7天移动平均"}]},{id:"analysis-comparison",name:"对比分析",description:"生成组间对比分析查询",category:"insights",icon:"⚖️",generatorId:"analysis-comparison",inputSchema:[{name:"dimension",type:"column",required:!0,label:"对比维度"},{name:"metrics",type:"text",required:!0,label:"度量列",placeholder:"需要对比的数值列"},{name:"comparisonType",type:"select",required:!0,label:"对比类型",options:["占比分析","差异分析","排名分析","分层分析"],defaultValue:"占比分析"}],outputType:"sql",requiresTable:!0,requiresColumns:!0},{id:"analysis-funnel",name:"漏斗分析",description:"生成用户转化漏斗分析",category:"insights",icon:"🔻",generatorId:"analysis-funnel",inputSchema:[{name:"steps",type:"textarea",required:!0,label:"漏斗步骤",placeholder:"每行一个步骤：SELECT ... FROM ... WHERE step = 1",rows:4},{name:"userIdColumn",type:"column",required:!0,label:"用户ID列"},{name:"timeRange",type:"text",required:!1,label:"时间范围"}],outputType:"sql",requiresTable:!0,examples:[{name:"电商转化漏斗",input:{steps:"注册 → 浏览商品 → 加入购物车 → 下单 → 支付",userIdColumn:"user_id",timeRange:"最近30天"},description:"分析用户从注册到支付的完整转化路径"},{name:"注册转化",input:{steps:"访问 → 注册 → 实名认证 → 首次交易",userIdColumn:"user_id",timeRange:"最近7天"},description:"分析新用户注册转化流程"}]},{id:"analysis-retention",name:"留存分析",description:"生成用户留存率分析查询",category:"insights",icon:"🎯",generatorId:"analysis-retention",inputSchema:[{name:"eventColumn",type:"column",required:!0,label:"事件列"},{name:"userColumn",type:"column",required:!0,label:"用户ID列"},{name:"timeColumn",type:"column",required:!0,label:"时间列"},{name:"periods",type:"text",required:!1,label:"留存周期",placeholder:"1,3,7,14,30 (天)",defaultValue:"1,3,7,14,30"}],outputType:"sql",requiresTable:!0,requiresColumns:!0}],Te=[{id:"transform-pivot",name:"数据透视 (PIVOT)",description:"生成 PIVOT 语句进行行转列",category:"wrangling",icon:"🔄",generatorId:"transform-pivot",inputSchema:[{name:"rows",type:"column",required:!0,label:"行标签"},{name:"columns",type:"column",required:!0,label:"列标签"},{name:"values",type:"column",required:!0,label:"值列"},{name:"aggregation",type:"select",required:!0,label:"聚合函数",options:["SUM","AVG","COUNT","MAX","MIN"],defaultValue:"SUM"}],outputType:"sql",requiresTable:!0,requiresColumns:!0},{id:"transform-unpivot",name:"逆透视 (UNPIVOT)",description:"生成 UNPIVOT 语句进行列转行",category:"wrangling",icon:"🔃",generatorId:"transform-unpivot",inputSchema:[{name:"columns",type:"text",required:!0,label:"要转换的列",placeholder:"col1, col2, col3"},{name:"nameColumn",type:"text",required:!0,label:"新列名列",placeholder:"例如：attribute"},{name:"valueColumn",type:"text",required:!0,label:"新值列",placeholder:"例如：value"}],outputType:"sql",requiresTable:!0},{id:"transform-type-conversion",name:"类型转换",description:"生成类型转换表达式",category:"wrangling",icon:"🔠",generatorId:"transform-type-conversion",inputSchema:[{name:"column",type:"column",required:!0,label:"源列"},{name:"targetType",type:"select",required:!0,label:"目标类型",options:["VARCHAR","INTEGER","BIGINT","DOUBLE","DATE","TIMESTAMP","BOOLEAN","JSON"],defaultValue:"VARCHAR"},{name:"format",type:"text",required:!1,label:"格式模板",placeholder:"例如：YYYY-MM-DD"}],outputType:"sql",requiresTable:!0,requiresColumns:!0},{id:"transform-string-manipulation",name:"字符串处理",description:"生成字符串处理函数",category:"wrangling",icon:"🔤",generatorId:"transform-string-manipulation",inputSchema:[{name:"column",type:"column",required:!0,label:"源列"},{name:"operation",type:"select",required:!0,label:"操作类型",options:["字符串拼接","大小写转换","去空格","截取子串","替换","正则提取","分割"],defaultValue:"字符串拼接"},{name:"params",type:"text",required:!1,label:"操作参数",placeholder:"根据操作类型填写"}],outputType:"sql",requiresTable:!0,requiresColumns:!0},{id:"transform-date-handling",name:"日期处理",description:"生成日期时间处理函数",category:"wrangling",icon:"📅",generatorId:"transform-date-handling",inputSchema:[{name:"column",type:"column",required:!0,label:"日期列"},{name:"operation",type:"select",required:!0,label:"操作类型",options:["提取年月日","日期加减","日期差计算","日期格式化","日期截断","星期计算"],defaultValue:"提取年月日"},{name:"params",type:"text",required:!1,label:"操作参数"}],outputType:"sql",requiresTable:!0,requiresColumns:!0}],he=[{id:"optimization-explain",name:"执行计划分析",description:"生成 EXPLAIN ANALYZE 查询分析执行计划",category:"optimization",icon:"🔬",generatorId:"optimization-explain",inputSchema:[{name:"sql",type:"textarea",required:!0,label:"SQL 语句",rows:5,placeholder:"要分析的 SQL 语句"},{name:"analyze",type:"boolean",required:!1,label:"执行并分析",defaultValue:!0}],outputType:"sql",requiresTable:!1},{id:"optimization-index",name:"索引建议",description:"分析查询并给出索引建议",category:"optimization",icon:"🚀",generatorId:"optimization-index",inputSchema:[{name:"query",type:"textarea",required:!0,label:"查询语句",rows:3,placeholder:"需要优化的查询"},{name:"table",type:"table",required:!0,label:"相关表"}],outputType:"sql",requiresTable:!0},{id:"optimization-query-rewrite",name:"查询重写优化",description:"优化和重写低效查询",category:"optimization",icon:"⚡",generatorId:"optimization-query-rewrite",inputSchema:[{name:"originalSql",type:"textarea",required:!0,label:"原始 SQL",rows:5},{name:"optimizationGoals",type:"select",required:!1,label:"优化目标",options:["性能优先","可读性优先","资源占用优先"],defaultValue:"性能优先"}],outputType:"sql",requiresTable:!1},{id:"optimization-duckdb-tuner",name:"DuckDB 向量化与内存调优",description:"自动配置 WASM 内存限制、Threads 并行度及 PRAGMA 执行调优",category:"optimization",icon:"🚀",generatorId:"optimization-duckdb-tuner",inputSchema:[{name:"memoryLimit",type:"select",required:!1,label:"内存上限",options:["1GB","2GB","4GB"],defaultValue:"2GB"},{name:"threads",type:"number",required:!1,label:"并行线程数",defaultValue:4}],outputType:"sql",requiresTable:!1},{id:"optimization-schema-sanitizer",name:"数据质量与 PII 自动化脱敏审计",description:"扫描表数据质量并生成敏感数据哈希/掩码与 Null 值填充 SQL",category:"optimization",icon:"🛡️",generatorId:"optimization-schema-sanitizer",inputSchema:[{name:"tableName",type:"table",required:!0,label:"目标数据表"},{name:"maskPii",type:"boolean",required:!1,label:"启用 PII 自动脱敏",defaultValue:!0}],outputType:"sql",requiresTable:!0}],Ie=[{id:"utility-test-data",name:"测试数据生成",description:"生成测试数据插入语句",category:"engineering",icon:"🧪",generatorId:"utility-test-data",inputSchema:[{name:"rowCount",type:"number",required:!0,label:"生成行数",defaultValue:10,min:1,max:1e3},{name:"pattern",type:"select",required:!0,label:"数据模式",options:["随机数据","序列数据","重复数据","边界值"],defaultValue:"随机数据"}],outputType:"sql",requiresTable:!0,requiresColumns:!0},{id:"utility-summarize",name:"数据摘要",description:"生成 SUMMARIZE 或统计摘要查询",category:"engineering",icon:"📋",generatorId:"utility-summarize",inputSchema:[{name:"table",type:"table",required:!0,label:"表名"},{name:"includeHistograms",type:"boolean",required:!1,label:"包含直方图",defaultValue:!0}],outputType:"sql",requiresTable:!1},{id:"utility-sample-query",name:"样本查询",description:"生成各种样本查询（随机抽样、分层抽样等）",category:"engineering",icon:"🎲",generatorId:"utility-sample-query",inputSchema:[{name:"sampleType",type:"select",required:!0,label:"抽样类型",options:["随机抽样","分层抽样","系统抽样","分组抽样"],defaultValue:"随机抽样"},{name:"sampleSize",type:"number",required:!0,label:"样本数量或百分比",defaultValue:100},{name:"stratifyBy",type:"column",required:!1,label:"分层列"}],outputType:"sql",requiresTable:!0,requiresColumns:!0}],k=[{id:"SKL-000",name:"系统输出协议 — 工程手册模式",content:`# SKL-000: 系统输出协议 — 工程手册模式 (Handbook Protocol)\r
\r
## 认知层级：感知层元指令 (Meta-Perception)\r
\r
本模块定义了所有 AI 输出的最高级结构格式，确保 DuckDB 分析结果表现为一份专业、可执行的“工程手册”。\r
\r
## 全局结构规范\r
\r
手册必须包含以下五大核心板块：\r
\r
1. **标题栏**: \`# DuckDB 系统化 SQL 教程 —— 以「{业务场景/表名}」为例\`\r
2. **目录总览**: \r
   - 必须包含“第一批次”、“第二批次”等层级。\r
   - 标注当前手册所属的批次。\r
3. **前言与环境准备**: 简述背景、环境要求。\r
4. **阅读约定**: \r
   - 必须包含符号说明表（📸, ⚠️, -- ← 已修改 等）。\r
5. **领域建模 (ER图)**: \r
   - 使用 \`mermaid erDiagram\` 描述当前表的逻辑地位或与关联表的结构。\r
\r
## 强制模块结构\r
\r
对于每一个分析模块（如 A1, B2），必须严格遵循以下 Markdown 结构：\r
\r
### [模块号] ▸ [功能名称]\r
\r
**🎯 解决什么问题**\r
- 简述该逻辑解决的业务或数据痛点。\r
\r
**📌 语法模板**\r
\`\`\`sql\r
-- 抽象化的 DuckDB 语法模板\r
[SELECT / CREATE / PIVOT ...]\r
\`\`\`\r
\r
**💻 可执行示例**\r
\`\`\`sql\r
-- 基于当前上下文 {tableName} 的具体 SQL 示例\r
[SQL CODE]\r
\`\`\`\r
\r
**📊 预期输出**\r
- Markdown 表格形式展示样例输出结果。\r
\r
**⚠️ 易错点 / 最佳实践**\r
- 针对 DuckDB 特特性（如向量化执行、WASM 内存限制）的专家提示。\r
\r
**🔗 上下文衔接**\r
- 说明该步骤与下一步骤的逻辑关联。\r
\r
## 批次快照 (Snapshot)\r
在每一批次（Batch）结束时，必须使用 \`📸 模块 X 结束 — 当前数据快照\` 板块展示当前表的最新状态。\r
\r
`,fileName:"skill-000-protocol.md",triggers:["protocol","format","handbook","structure","layout","template","规范","格式","输出"],intent:"META_PROTOCOL"},{id:"SKL-101",name:"语境与语义探针",content:`# SKL-101: 语境与语义探针 (Context & Semantic Probe)\r
\r
## 认知层级：感知层 (Perception Layer)\r
\r
作为 AI Agent 的“眼睛”，本模块负责构建对原始数据的初步物理与逻辑认知，不产生任何数据变更。\r
\r
## 核心任务\r
\r
### 1. 场景探针 (Stage 0: Scene Probe)\r
分析基础元数据：\r
- 表名: \${tableName}\r
- 行数: \${rowCount}\r
- 列数: \${colCount}\r
- 预览: \${sampleData}\r
\r
推断用户意图。\r
\r
**意图分类 (MECE):**\r
- **DATA_CLEANING**: 缺失值填充、格式标准化、脱敏。\r
- **METRIC_MODELING**: 定义指标、聚合分析、维度建模。\r
- **EXPLORATION**: 随机抽样、相关性探索、分布审计。\r
- **REPORTING**: 预警、日报生成、执行摘要。\r
\r
### 2. 语义推断 (Stage 1: Semantic Inference)\r
推断字段的业务语义，而非仅逻辑类型。\r
\r
| 字段特征 | 物理类型 | 映射语义 (MECE) | 推荐处理 |\r
|----------|----------|----------------|----------|\r
| ID, UUID | VARCHAR | **IDENTITY** (唯一标识) | 检查唯一性，建立关联 |\r
| Name, Desc | VARCHAR | **DIMENSION** (描述维度) | 分类汇总 |\r
| Price, Count | DOUBLE/INT | **MEASURE** (度量统计) | 聚合计算 (Sum/Avg) |\r
| CreatedAt | TIMESTAMP | **TEMPORAL** (时间序列) | 趋势分析、同比环比 |\r
| Phone, Email| VARCHAR | **SENSITIVE** (敏感信息) | 标记 PII，触发治理层 |\r
\r
## 输出规范\r
\r
必须包含以下 JSON 对象：\r
\r
\`\`\`json\r
{\r
  "recommendedIntent": "DATA_CLEANING | METRIC_MODELING | ...",\r
  "confidence": 0.95,\r
  "columns": [\r
    {\r
      "name": "col_a",\r
      "semanticType": "IDENTITY | DIMENSION | ...",\r
      "isPII": true/false,\r
      "description": "业务含义描述"\r
    }\r
  ]\r
}\r
\`\`\`\r
\r
## Handbook Protocol (SKL-000) 约束\r
- 本技能是手册“领域建模”的核心驱动。必须在 **1.1 ER 关系图** 板块中使用 \`mermaid erDiagram\` 展示当前表的字段拓扑。\r
- 必须在 **🎯 解决什么问题** 中解释物理列名映射到业务语义的必要性。\r
- 必须在 **📊 预期输出** 中展示字段映射后的业务视图表格。\r
\r
`,fileName:"skill-101-semantic.md",triggers:["semantic","intent","naming","metadata","probe","探针","语义","意图","字段描述"],intent:"SCENE_PROBE"},{id:"SKL-102",name:"数据质量审计",content:`# SKL-102: 数据质量审计 (Data Quality Audit)\r
\r
## 认知层级：感知层 (Perception Layer)\r
\r
作为 AI Agent 的“体检仪”，本模块负责深度扫描数据质量隐患，识别完整性、准确性和一致性问题。\r
\r
## 审计维度 (MECE)\r
\r
### 1. 完整性 (Completeness)\r
- **Null 率**: 识别关键列的缺失情况。\r
- **孤岛检测**: 检查外键关联的断裂情况。\r
\r
### 2. 有效性 (Validity)\r
- **逻辑区间**: 如“年龄”在 0-150 之间，“评分”在 0-5 之间。\r
- **格式合规**: 检查日期格式、JSON 字符串是否可解析。\r
\r
### 3. 一致性 (Consistency)\r
- **枚举冲突**: “男/M/Male” 是否存在多种表达。\r
- **精算平衡**: 识别“总额”是否等于“分项之和”。\r
\r
## 执行策略\r
\r
1. **多级扫描**:\r
   - \`L1\`: 基于 DuckDB \`SUMMARIZE\` 的快速分布统计。\r
   - \`L2\`: 针对异常枚举的 \`GROUP BY\` 频率分布。\r
   - \`L3\`: 针对 PII 疑似字段的正规匹配校验。\r
\r
## 输出建议\r
\r
每个质量问题必须伴随一个 **修复处方**:\r
- \`REASON\`: 为什么是问题？\r
- \`IMPACT\`: 影响哪些后续分析（如：Null 导致 Sum 偏低）。\r
- \`FIX\`: 建议的补救措施（删除/填充/修复）。\r
\r
## 质量记分卡\r
\r
| 维度 | 得分 (0-100) | 核心发现 |\r
|------|------------|----------|\r
| 完整性 | 85 | \`user_id\` 存在 15% 空值 |\r
| 有效性 | 100 | 无格式错误 |\r
| 安全性 | 20 | **检测到 3 列明文 PII** |\r
\r
> ⚠️ 如果安全性得分低于 60，必须自动挂起流水线，移交至 \`SKL-201-Governance\` 处理。\r
`,fileName:"skill-102-quality.md",triggers:["quality","audit","null","consistency","validity","completeness","审计","质量","空值","一致性"],intent:"QUALITY_AUDIT"},{id:"SKL-103",name:"时间特征探测器",content:`# SKL-103: 时间特征探测器 (Time Character Detector)\r
\r
## 认知层级：感知层 (Perception Layer)\r
\r
作为 AI Agent 的“计步器”，本模块负责识别数据中的时序脉络、业务周期及时间轴特征，不进行数据转换。\r
\r
## 核心任务\r
\r
### 1. 周期敏感度识别\r
分析 Timestamp/Date 字段，推断是否存在以下周期特征：\r
- **CALENDAR_YEAR**: 标准日历年特征。\r
- **FISCAL_YEAR**: 财年特征（如 4月开始）。\r
- **PROMO_SEASON**: 大促脉冲（如 双11, 618）。\r
- **WEEKLY_PATTERN**: 明显的周中/周末差异。\r
\r
### 2. 粒度感应\r
识别当前数据集的最佳分析粒度：\r
- \`YEAR\` | \`QUARTER\` | \`MONTH\` | \`WEEK\` | \`DAY\` | \`HOUR\`\r
\r
## 输出规范\r
\r
必须返回以下 JSON 片段：\r
\`\`\`json\r
{\r
  "timeCharacter": {\r
    "primaryTimeColumn": "created_at",\r
    "detectedCycles": ["WEEKLY_PATTERN", "MONTHLY_CLOSURE"],\r
    "granularity": "DAY",\r
    "isSparse": false\r
  }\r
}\r
\`\`\`\r
`,fileName:"skill-103-time.md",triggers:["time","temporal","period","trend","timestamp","date","时间","周期","趋势","日期"],intent:"TIME_DETECTOR"},{id:"SKL-104",name:"跨表关联感应器",content:`# SKL-104: 跨表关联感应器 (Cross-table Relation Sensor)\r
\r
## 认知层级：感知层 (Perception Layer)\r
\r
作为 AI Agent 的“雷达”，本模块负责在多表环境下感知潜在的逻辑关联、外键契约及 JOIN 路径。\r
\r
## 核心任务\r
\r
### 1. 关联路径发现\r
基于列名（如 \`xxx_id\`, \`id\`）与数据分布，探测可能的 JOIN 关系：\r
- **1:1**: 事实表与维度表关联。\r
- **1:N**: 事实表与维度表关联。\r
- **M:N**: 关联桥接表。\r
\r
### 2. JOIN 契约预判\r
识别表间合并时的潜在风险：\r
- **Fan-out Error**: 1:N 关联导致度量值被错误放大。\r
- **Missing Keys**: 关联键存在大量 Null 或不匹配。\r
\r
## Handbook Protocol (SKL-000) 约束\r
- 必须在 **领域建模 (ER图)** 中展示当前表与其他 1-2 个核心关联表的连接（1:N 或 M:N）。\r
- 在 **🔗 上下文衔接** 中明确预估后续批次（如“第二批次：多表连接模块 B”）的实施计划。\r
\r
`,fileName:"skill-104-relation.md",triggers:["join","relation","foreign key","er","modeling","关联","连接","外键","建模"],intent:"RELATION_SENSOR"},{id:"SKL-105",name:"本地化编码卫士",content:`# SKL-105: 本地化编码卫士 (Localization & Collation Guard)\r
\r
## 认知层级：感知层 (Perception Layer)\r
\r
作为 AI Agent 的“翻译官”，本模块负责识别区域化字符特征，确保护排序、过滤在中文等环境下的物理准确性。\r
\r
## 核心任务\r
\r
### 1. 编码与排序感应\r
- 识别字段是否包含中文（CJK）字符。\r
- 探测当前的排序策略是否会导致 \`GROUP BY\` 或 \`ORDER BY\` 结果异常（如拼音排序 vs 笔画排序）。\r
\r
### 2. 乱码预防\r
识别是否存在潜在的转码风险（如 GBK 混入 UTF-8）。\r
\r
## 输出规范\r
\r
必须返回以下 JSON 片段：\r
\`\`\`json\r
{\r
  "localization": {\r
    "hasCJK": true,\r
    "recommendedCollation": "zh_CN",\r
    "handlingStrategy": "USE_ICU_EXTENSION"\r
  }\r
}\r
\`\`\`\r
\r
## 物理建议\r
对于 DuckDB，如果 \`hasCJK\` 为 true，在生成 SQL 时应建议下载并加载 \`icu\` 扩展：\r
\`INSTALL icu; LOAD icu;\`\r
`,fileName:"skill-105-localization.md",triggers:["localization","chinese","collation","encoding","icu","cjk","编码","排序","中文","本地化"],intent:"LOCALIZATION_GUARD"},{id:"SKL-106",name:"变更感知基准仪",content:`# SKL-106: 变更感知基准仪 (Change & Drift Benchmarker)\r
\r
## 认知层级：感知层 (Perception Layer)\r
\r
作为 AI Agent 的“记忆记录仪”，本模块负责对比当前数据集与历史基准（Snapshot）的差异，识别 Schema Drift。\r
\r
## 核心任务\r
\r
### 1. 结构变更对比 (Drift Detection)\r
识别与历史版本相比的变化：\r
- **ADDED**: 新增字段。\r
- **REMOVED**: 缺失字段（可能导致 SQL 报错）。\r
- **MUTATED**: 类型变更（如 VARCHAR 转为 INT）。\r
\r
### 2. 数据量级波动\r
感知数据行数的异常增减（如瞬间翻倍或腰斩）。\r
\r
## 输出规范\r
\r
必须返回以下 JSON 片段：\r
\`\`\`json\r
{\r
  "drift": {\r
    "status": "STABLE | DRIFTED",\r
    "changes": [\r
      { "column": "price", "type": "MUTATED", "detail": "FLOAT -> DOUBLE" }\r
    ],\r
    "volumeChange": "+15%"\r
  }\r
}\r
\`\`\`\r
`,fileName:"skill-106-drift.md",triggers:["drift","change","benchmark","schema","diff","变更","结构","基准","对比"],intent:"DRIFT_BENCHMARKER"},{id:"SKL-201",name:"数据治理与安全合约",content:`# SKL-201: 数据治理与安全合约 (Data Governance & Contract)\r
\r
## 认知层级：决策层 (Strategy Layer)\r
\r
作为 AI Agent 的“法律顾问”，本模块负责对感知层发现的风险点制定处理规则，并确立消费标准（SLA）。\r
\r
## 1. PII 治理规则 (Privacy Strategy)\r
\r
基于检测到的风险，定义脱敏策略：\r
\r
| 策略 (MECE) | 适用场景 | DuckDB 实现技术 |\r
|-------------|----------|-----------------|\r
| **MASK** | 保持业务特征 (如：138****8000) | \`regexp_replace\` |\r
| **HASH** | 需要 Join 但不保留明文 | \`md5(cast(col as varchar))\` |\r
| **DROP** | 冗余敏感信息 | \`EXCLUDE (col_name)\` |\r
| **BLUR** | 泛化统计 (如：年龄 -> 年龄组) | \`floor(age/10)*10\` |\r
\r
## 2. 数据契约 (Data Contract)\r
\r
定义该数据集的物理与业务约束：\r
\r
- **主键契约 (PK)**: 必须 Unique & Not Null。\r
- **值域契约 (Range)**: 核心度量的上限与下限。\r
- **新鲜度契约 (SLA)**: 最后核验时间距离当前时间的间隔。\r
\r
## 决策逻辑\r
\r
1. **风险对齐**: 若 \`SKL-101\` 标记了 \`isPII: true\`，本模块必须输出脱敏 SQL 逻辑。\r
2. **阻断声明**: 定义哪些契约失效属于 **FATAL**（必须停止流水线）。\r
3. **策略归档**: 将处理决策记录 in \`governance/\` 目录中。\r
\r
## 交互范式\r
\r
\`\`\`text\r
检测到 PII 风险，建议执行以下治理：\r
- 字段 [phone]: 策略 MASK (已自动应用)\r
- 字段 [secret]: 策略 DROP (已自动应用)\r
\`\`\`\r
`,fileName:"skill-201-governance.md",triggers:["governance","privacy","pii","mask","hash","contract","legal","安全","脱敏","治理","隐私"],intent:"DATA_GOVERNANCE"},{id:"SKL-202",name:"洞察建模与因果推断",content:`# SKL-202: 洞察建模与因果推断 (Metric & Insight Modeling)\r
\r
## 认知层级：决策层 (Strategy Layer)\r
\r
作为 AI Agent 的“分析师”，本模块负责将原始字段转化为业务指标，并推断数据间的因果链条或关联模式。\r
\r
## 1. 指标建模 (Metric Semantic)\r
\r
将 \`SKL-101\` 识别出的 \`MEASURE\` 字段升级为业务指标。\r
\r
- **总量/均值** (Standard)\r
- **同比/环比分析** (Temporal)\r
- **Top N 贡献分布** (Contribution)\r
- **RFM / 转化漏斗** (Business Specific)\r
\r
## 2. 洞察发现矩阵 (MECE)\r
\r
- **🚨 异常型 (Anomaly)**: 超出 3-Sigma 范围的离群点，寻找突变根因。\r
- **📈 趋势型 (Trend)**: 线性或周期性增长，识别季节性特征。\r
- **⚙️ 驱动型 (Driver)**: A 的增长导致了 B 的下降（相关性与因果探索）。\r
- **🧩 细分型 (Segment)**: 不同地域/品类间的表现显著差异。\r
\r
## 3. 分析模板映射 (SKL-009)\r
\r
基于用户意图 (\`SKL-101.intent\`) 匹配最佳 SQL 模板。\r
\r
| 用户意图 | 推荐模板 |\r
|----------|----------|\r
| DATA_CLEANING | 分布直方图、Null 值扫描 |\r
| METRIC_MODELING | 窗口函数聚合、计算维度扩展 |\r
| EXPLORATION | 相关性矩阵、Z-Score 检测 |\r
| REPORTING | 环比增长、执行摘要 |\r
\r
## 任务执行\r
\r
- 生成 **Metric Glossary** (指标手册)。\r
- 建立 **Dependency Graph** (指标依赖图)。\r
- 提出 **轻量级假设** 等待验证。\r
`,fileName:"skill-202-insight.md",triggers:["metric","insight","modeling","causal","anomaly","trend","指标","洞察","分析","趋势","异常"],intent:"METRIC_MODELING"},{id:"SKL-203",name:"CTE 逻辑编排引擎",content:`# SKL-203: CTE 逻辑编排引擎 (CTE Logic Orchestrator)\r
\r
## 认知层级：决策层 (Strategy Layer)\r
\r
作为 AI Agent 的“逻辑架构师”，本模块负责将复杂的业务逻辑拆解为清晰、解耦的 CTE 节点，确保代码的可维护性。\r
\r
## 核心任务\r
\r
### 1. 逻辑分层拆解\r
强制执行以下编排顺序：\r
- **BASE_LAYER**: 原始数据清洗（Type Cast, Rename）。\r
- **FILTER_LAYER**: 业务过滤（PII Mask, Range Filter）。\r
- **JOIN_LAYER**: 多表关联（如果适用）。\r
- **AGG_LAYER**: 最终聚合计算。\r
\r
### 2. 语义命名\r
每一个 CTE 必须具备明确的业务词义（如 \`clean_orders\`, \`filtered_customer_metrics\`），禁止使用 \`t1\`, \`t2\`。\r
\r
## 输出建议\r
\`WITH ... AS (...)\` 是本模块的物理表现形式。\r
\r
## Handbook Protocol (SKL-000) 约束\r
当应用本技能时，必须在 **📌 语法模板** 中展示 CTE 框架，并在 **💻 可执行示例** 中使用业务命名（如 \`clean_events\`）。\r
每一个 CTE 节点应对应手册中的一个子模块，并配以 **📊 预期输出** 说明该中间状态。\r
`,fileName:"skill-203-cte.md",triggers:["cte","with","orchestrator","logic","architecture","架构","逻辑","分层"],intent:"CTE_ORCHESTRATOR"},{id:"SKL-204",name:"客户端性能策略师",content:`# SKL-204: 客户端性能策略师 (WASM Performance Strategist)\r
\r
## 认知层级：决策层 (Strategy Layer)\r
\r
作为 AI Agent 的“性能顾问”，本模块负责评估 DuckDB-WASM 在浏览器环境下的资源深度约束（如 4GB 内存上限）。\r
\r
## 核心任务\r
\r
### 1. 采样策略决策 (Sampling)\r
- 当 \`rowCount > 500,000\` 时，自动建议对 \`SUM/AVG\` 外的探索操作使用 \`USING SAMPLE 10%\`。\r
- 优先建议使用 \`SAMPLE 1000\` 进行预览。\r
\r
### 2. 计算下推建议\r
- 对于超大 Parquet 文件，建议利用 Metadata 过滤（Projection Pushdown）。\r
\r
## 输出规范\r
在生成 SQL 前，必须检测内存上下文：\r
- 若内存预估紧张，注入 \`SET memory_limit = '2GB';\`。\r
`,fileName:"skill-204-wasm.md",triggers:["wasm","performance","memory","sample","optimization","性能","内存","采样","优化"],intent:"WASM_STRATEGIST"},{id:"SKL-205",name:"合规性与抹除策略",content:`# SKL-205: 合规性与抹除策略 (Compliance & Erasure Policy)\r
\r
## 认知层级：决策层 (Strategy Layer)\r
\r
作为 AI Agent 的“安全官”，本模块负责在检测到 PII 后，制定最终的物理隔离与字段级抹除策略。\r
\r
## 核心任务\r
\r
### 1. 永久掩码策略\r
- 定义哪些字段必须被正则脱敏（如 Phone, Email）。\r
- 决定是使用 \`md5\` 混淆还是直接 \`EXCLUDE\`。\r
\r
### 2. 导出规则\r
- 禁止在本地未加密存储中保留 \`isPII\` 标记的明文字段。\r
\r
## 决策契约\r
若 \`SKL-101\` 感知触发 \`SENSITIVE\`，本模块必须强制在 \`SKL-301\` 执行层注入脱敏代码。\r
`,fileName:"skill-205-compliance.md",triggers:["compliance","erasure","policy","security","gdpr","合规","安全","策略"],intent:"COMPLIANCE_POLICY"},{id:"SKL-206",name:"指标语义工场",content:`# SKL-206: 指标语义工场 (Metric Semantic Factory)\r
\r
## 认知层级：决策层 (Strategy Layer)\r
\r
作为 AI Agent 的“业务分析师”，本模块负责将物理字段映射为业务指标，构建标准化的 Metric Glossary。\r
\r
## 核心任务\r
\r
### 1. 派生指标定义\r
- 自动识别复合指标（如：转化率 = 支付/访问）。\r
- 定义指标的统计频率与汇总策略。\r
\r
### 2. 业务单位对齐\r
- 识别金额单位（元/分/万）。\r
- 确保所有的 \`MEA\` 类型列具备可理解的中文标题。\r
\r
## 输出规范\r
\`\`\`json\r
{\r
  "metrics": [\r
    { "key": "gmv", "formula": "sum(price * qty)", "label": "交易总额" }\r
  ]\r
}\r
\`\`\`\r
`,fileName:"skill-206-metric.md",triggers:["metric","factory","glossary","formula","label","指标","公式","定义"],intent:"METRIC_FACTORY"},{id:"SKL-207",name:"动态多租户隔离策略",content:`# SKL-207: 动态多租户隔离策略 (Dynamic Isolation Policy)\r
\r
## 认知层级：决策层 (Strategy Layer)\r
\r
作为 AI Agent 的“沙箱管理员”，本模块负责在多用户或多租户环境下，制定物理会话级别的隔离方案。\r
\r
## 核心任务\r
\r
### 1. ATTACH 路径决策\r
- 为每一个新租户数据生成独立的 \`.db\` 文件。\r
- 自动生成 \`ATTACH 'tenant_x.db' AS sandbox;\` 指令。\r
\r
### 2. 权限受限视图 (Restricted View)\r
- 仅公开用户有权访问的表，屏蔽核心 System 表。\r
\r
## 安全性要求\r
确保 AI 生成的 SQL 不含有 \`SELECT * FROM system.xxx\` 之类的越权扫描。\r
`,fileName:"skill-207-isolation.md",triggers:["isolation","multi-tenant","sandbox","attach","security","多租户","隔离","沙箱"],intent:"ISOLATION_POLICY"},{id:"SKL-301",name:"SQL 自动化工程",content:`# SKL-301: SQL 自动化工程 (SQL Engineering & Execution)\r
\r
## 认知层级：执行层 (Execution Layer)\r
\r
作为 AI Agent 的“手”，本模块负责将感知层与决策层的意图落地为高性能、健壮的 DuckDB SQL。\r
\r
## 1. 健壮性规则 (Robustness)\r
\r
### 幂等化操作 (SKL-013)\r
- **CREATE**: 必须使用 \`IF NOT EXISTS\` 或 \`OR REPLACE\`。\r
- **INSERT**: 优先使用 \`INSERT OR IGNORE\` 或先 \`DELETE\` 旧 Batch。\r
- **ALTER**: 需要预检列是否存在。\r
\r
### 事务闭环\r
- **BEGIN TRANSACTION -> COMMIT / ROLLBACK**。\r
- 确保 DDL 变更与 DML 写入在同一事务中以维持一致性。\r
\r
## 2. SQL 审计 (Antipattern Check / SKL-008)\r
\r
拦截低效或风险 SQL：\r
- 🔴 **AP-02/03**: 拦截无 \`WHERE\` 的 \`DELETE\`/\`UPDATE\`。\r
- 🔴 **AP-05**: 拦截隐式笛卡尔积。\r
- 🟡 **AP-01**: 警告使用 \`SELECT *\`。\r
\r
## 3. 结果产出 (Assets)\r
\r
生成脚本族：\r
1. \`01-clean.sql\`: 脱敏、格式化。\r
2. \`02-schema.sql\`: 建模、视图构建。\r
3. \`03-analysis.sql\`: 洞察验证 SQL。\r
\r
## 性能优化建议\r
\r
- 针对大数据集利用 \`PARALLEL\` 和 \`MEMORY_LIMIT\` 设置。\r
- 推荐使用 \`parquet\` 格式导出中间结果。\r
\r
## Handbook Protocol (SKL-000) 约束\r
生成的 SQL 代码块必须嵌入在 **💻 可执行示例** 中。\r
必须在 **⚠️ 易错点** 中提醒主键手动管理或使用 Sequence。\r
必须在 **🔗 上下文衔接** 中说明该 SQL 如何支撑下一步的分析洞察。\r
`,fileName:"skill-301-sql.md",triggers:["sql","engineering","execution","robust","transaction","audit","antipattern","执行","事务","审计","健壮性","幂等"],intent:"SQL_ENGINEERING"},{id:"SKL-302",name:"变更防护与回滚",content:`# SKL-302: 变更防护与回滚 (Safety & Rollback)\r
\r
## 认知层级：执行层 (Execution Layer)\r
\r
作为 AI Agent 的“刹车系统”，本模块负责在执行产生副作用的操作前建立安全网，并在失败时恢复状态。\r
\r
## 1. 回滚计划 (SKL-014)\r
\r
任何正向操作必须配备对应的 Undo 逻辑：\r
\r
| 正向操作 | 逆向操作 |\r
|----------|----------|\r
| \`CREATE TABLE\` | \`DROP TABLE IF EXISTS\` |\r
| \`ADD COLUMN\` | \`ALTER TABLE DROP COLUMN\` |\r
| \`RENAME\` | \`RENAME\` (反向) |\r
\r
## 2. 注入防御 (Security)\r
\r
- 严格转义表名和列名，使用 \`"\` 包裹以防止 SQL 注入。\r
- 检查 SQL 注释中是否存在非法 HTML 标签（防止报告渲染时的 XSS）。\r
\r
## 3. 持久化防护\r
\r
- **Snapshot**: 在执行重大变更前，建议 COPY 原始 DuckDB 文件快照。\r
- **Logging**: 记录执行日志、受影响行数 and 耗时。\r
\r
## 检查清单 (Checkpoint)\r
\r
- [ ] 是否存在对应的 \`scripts/rollback.sql\`？\r
- [ ] 是否在事务中执行？\r
- [ ] 是否包含数据丢失风险警告？\r
`,fileName:"skill-302-safety.md",triggers:["rollback","safety","undo","security","injection","protection","回滚","安全","防护","注入"],intent:"SAFETY_ROLLBACK"},{id:"SKL-303",name:"叙事报告与总结",content:`# SKL-303: 叙事报告与总结 (Narrative Weaver & Report)\r
\r
## 认知层级：执行层 (Execution Layer)\r
\r
作为 AI Agent 的“播报员”，本模块负责将所有的技术发现、SQL 结果和治理策略翻译为人可读、可感知的业务报告。\r
\r
## 1. 叙事结构\r
\r
- **执行摘要 (Executive Summary)**: 50字简述核心结论。\r
- **治理声明 (Governance)**: PII 处理了什么，契约是否通过。\r
- **深度洞察 (Insights)**: 按照异常、驱动、建议的闭环描述。\r
- **下一步行动 (Next Best Action)**: 建议用户继续探索的方向。\r
\r
## 2. 视觉化描述\r
\r
- 推荐图表类型 (Bar, Line, Sankey)。\r
- 引用数据证据 (Data Evidence)。\r
\r
## 3. 结果存档\r
\r
- 将 Markdown 报告保存至 \`reports/analysis_yyyy-mm-dd.md\`。\r
- 输出控制台 Summary (带颜色的提示)。\r
\r
## 叙事原则\r
\r
1. **结论先行**：先讲发现了什么，再讲 SQL 是怎么写的。\r
2. **证据导向**：每一个观点必须引用具体的数值或趋势。\r
3. **行动导向**：不仅描述现状，更要提出建议。\r
`,fileName:"skill-303-report.md",triggers:["report","summary","narrative","executive","insights","报告","总结","叙事","摘要"],intent:"NARRATIVE_REPORT"},{id:"SKL-304",name:"SQL 宏封装工程",content:`# SKL-304: SQL 宏封装工程 (SQL Macro Factory)\r
\r
## 认知层级：执行层 (Execution Layer)\r
\r
作为 AI Agent 的“模具师”，本模块负责将重复的计算逻辑封装为 DuckDB \`MACRO\`（自定义函数），提升代码复用与 UI 调用的一致性。\r
\r
## 核心任务\r
\r
### 1. 复杂逻辑模具化\r
识别高频计算逻辑（如：环比增长计算、复杂的条件加权求和），并将其转化为 Macro。\r
- **示例**: \`CREATE OR REPLACE TEMPORARY MACRO growth_rate(curr, prev) AS (curr - prev) / prev;\`\r
\r
### 2. 交互界面简化\r
在输出最终 SQL 时，提供一套预制的 Macro 库，使 UI 层只需调用 \`SELECT growth_rate(...)\`。\r
\r
## 工程收益\r
- 显著减少生成的 SQL 文本长度。\r
- 确保业务逻辑在不同报表的一致性。\r
\r
## Handbook Protocol (SKL-000) 约束\r
当应用本技能时，必须在 **📌 语法模板** 中明确 \`CREATE TEMPORARY MACRO\` 的定义方式。\r
在 **⚠️ 易错点** 中说明 Macro 的作用域（Session-level）以及 DuckDB 版本的兼容性。\r
`,fileName:"skill-304-macro.md",triggers:["macro","reusable","function","template","封装","宏","复用"],intent:"MACRO_FACTORY"},{id:"SKL-305",name:"物理断言验证机",content:`# SKL-305: 物理断言验证机 (Physical Assertion Validator)\r
\r
## 认知层级：执行层 (Execution Layer)\r
\r
作为 AI Agent 的“质检员”，本模块负责在 SQL 执行前后生成物理断言，验证数据的逻辑准确性。\r
\r
## 核心任务\r
\r
### 1. 前置验证 SQL\r
在执行写操作前，验证源数据状态（如：Null 率是否超标）。\r
\r
### 2. 后置结果断言\r
执行关键计算后，验证结果是否符合物理常识。\r
- **示例**: \`SELECT count(*) FROM final_result WHERE total_amount < 0;\` (若结果 > 0 则视为失败)。\r
\r
## 回滚链路\r
若断言不通过，必须配合 \`SKL-302\` 进行原子回滚。\r
`,fileName:"skill-305-assertion.md",triggers:["assertion","validator","check","test","verification","断言","验证","检查"],intent:"ASSERTION_VALIDATOR"},{id:"SKL-306",name:"资源感知的存储优化",content:`# SKL-306: 资源感知的存储优化 (Storage Optimizer)\r
\r
## 认知层级：执行层 (Execution Layer)\r
\r
作为 AI Agent 的“仓储管理员”，本模块负责根据数据量级 and 本地资源，决定最佳的物理存储与导出策略。\r
\r
## 核心任务\r
\r
### 1. Parquet 深度优化\r
当导出大数据集时，自动配置：\r
- **ROW_GROUP_SIZE**: 优化读取性能。\r
- **COMPRESSION**: 根据浏览器 CPU 负载选择 \`SNAPPY\` 或 \`ZSTD\`。\r
\r
### 2. 分片导出决策\r
当文件预估超过浏览器下载限制时，自动生成分片导出逻辑。\r
- **指令**: \`COPY (SELECT * FROM table) TO 'part_1.parquet' (FORMAT PARQUET);\`\r
\r
## 物理建议\r
优先使用 Parquet 格式替代 CSV 存储中间结果。\r
`,fileName:"skill-306-storage.md",triggers:["storage","optimizer","parquet","compression","export","存储","优化","导出","压缩"],intent:"STORAGE_OPTIMIZER"},{id:"SKL-307",name:"自愈式 SQL 流水线",content:`# SKL-307: 自愈式 SQL 流水线 (Self-healing Pipeline)\r
\r
## 认知层级：执行层 (Execution Layer)\r
\r
作为 AI Agent 的“急修工”，本模块负责在 SQL 报错后，结合错误堆栈实现自动化的逻辑修正。\r
\r
## 核心任务\r
\r
### 1. 错误深度解析\r
解析 DuckDB 的报错信息（如：Binder Error, Missing Column）。\r
\r
### 2. 闭环修正生成\r
结合 \`SKL-101\`（感知）与 \`SKL-203\`（CTE 编排），重新生成修正后的 SQL 逻辑块。\r
\r
## 输出契约\r
必须输出一份 \`Correction Diff\`，向用户解释为了修复哪个错误而进行了何种逻辑调整。\r
`,fileName:"skill-307-healing.md",triggers:["healing","fix","repair","error","correction","自愈","修复","错误纠正"],intent:"SELF_HEALING_PIPELINE"},{id:"SKL-308",name:"原子级会话快照",content:`# SKL-308: 原子级会话快照 (Atomic Session Snapshot)\r
\r
## 认知层级：执行层 (Execution Layer)\r
\r
作为 AI Agent 的“黑匣子”，本模块负责在进行破坏性 DDL 前，建立物理级别的快照，确数据 100% 可恢复。\r
\r
## 核心任务\r
\r
### 1. checkpoint 强制触发\r
在执行 \`ALTER TABLE\` 或 \`DROP TABLE\` 前，执行 \`CHECKPOINT;\` 并备份对应的 \`.db\` 文件。\r
\r
### 2. 回滚路径记录\r
生成一套包含 \`ROLLBACK\` 逻辑的脚本，并将其存储在 \`snapshots/\` 目录中。\r
\r
## 工程准则\r
任何涉及 \`CREATE TABLE AS SELECT\` (CTAS) 的操作，必须先通过快照验证。\r
`,fileName:"skill-308-snapshot.md",triggers:["snapshot","atomic","checkpoint","backup","recovery","快照","备份","原子级"],intent:"SESSION_SNAPSHOT"},{id:"SKL-401",name:"认知对齐闭环",content:`# SKL-401: 认知对齐闭环 (Cognitive Alignment Loop - ALC)\r
\r
## 认知层级：元认知层 (Meta Layer)\r
\r
作为 AI Agent 的“长期记忆体”，本模块负责捕捉用户对手动生成的 SQL 或报告的修正行为，并将其转化为持续进化的认知准则。\r
\r
## 核心任务\r
\r
### 1. 修正模式识别\r
对比 AI 生成的原始 SQL 与用户执行的最终 SQL，识别偏好：\r
- **命名偏好**: 如用户喜欢将 \`id\` 重命名为 \`primary_key\`。\r
- **关联偏好**: 如用户倾向于特定的索引优化。\r
\r
### 2. 认知注入\r
在下一次分析启动时，将捕捉到的偏好作为“用户习惯补丁”注入所有感知层 Prompts。\r
\r
## 输出建议\r
本模块不直接输出 SQL，而是输出建议更新的 \`User Preference Map\`。\r
`,fileName:"skill-401-alc.md",triggers:["alignment","learning","preference","loop","feedback","对齐","偏好","学习","反馈"],intent:"COGNITIVE_ALIGNMENT"},{id:"SKL-402",name:"叙事溯源编织器",content:`# SKL-402: 叙事溯源编织器 (Narrative Trace Weaver)\r
\r
## 认知层级：元认知层 (Meta Layer)\r
\r
作为 AI Agent 的“信任构建师”，本模块负责将 AI 的黑盒推导逻辑（Chain-of-Thought）结构化为可追溯的内容，向用户揭示“为什么得出这个结论”。\r
\r
## 核心任务\r
\r
### 1. 推导链条展示\r
将分析过程拆解为物理证据点：\r
- **证据 A**: 字段 \`amount\` 的均值大于中位数。\r
- **推导 B**: 判定数据存在右偏分布。\r
- **结论 C**: 建议使用 \`MEDIAN\` 而非 \`AVG\`。\r
\r
### 2. 逻辑可追溯性\r
生成的每一项 Deep Insight 必须关联其对应的 SQL 证据快照。\r
\r
## 输出规范\r
In 报告末尾附加 \`## 推导溯源\` 板块，增强 AI 的专业信任感。\r
\r
## Handbook Protocol (SKL-000) 约束\r
推导链条必须作为 **🎯 解决什么问题** 的逻辑支撑。\r
在 **📊 预期输出** 中展示支撑结论的中间聚合结果（如 Median vs Avg）。\r
在 **⚠️ 易错点** 中指出统计陷阱（如 Outliers 对均值的影响）。\r
`,fileName:"skill-402-trace.md",triggers:["trace","weaver","chain-of-thought","evidence","explainable","溯源","推导","证据","可解释性"],intent:"NARRATIVE_TRACE"},{id:"SKL-403",name:"提示词语义压缩器",content:`# SKL-403: 提示词语义压缩器 (Prompt Semantic Compressor)\r
\r
## 认知层级：元认知层 (Meta Layer)\r
\r
作为 AI Agent 的“效率专家”，本模块负责在 Skills 库膨胀时，通过语义路由技术仅动态加载必要的技能块，节省 Token 并提升响应速度。\r
\r
## 核心任务\r
\r
### 1. 技能相关性过滤\r
基于 \`Stage 0\` 识别的意图，决定后续 Stages 注入哪些 Skills。\r
- **场景**: 若没有时间字段，自动剔除 \`SKL-103 (Time Detector)\`。\r
\r
### 2. 语义浓缩\r
将长篇大论的 Skills 规则压缩为极简的指令集（Cheatsheet 模式），在不损失逻辑的前提下减少 Prompt 长度。\r
\r
## 性能指标\r
目标是将复杂的全量 Prompt 压缩 30%-50%。\r
`,fileName:"skill-403-compressor.md",triggers:["compressor","prompt","token","efficiency","router","压缩","效率","优化"],intent:"PROMPT_COMPRESSOR"},{id:"SKL-404",name:"DBT 工程桥接器",content:`# SKL-404: DBT 工程桥接器 (DBT Engineering Bridge)\r
\r
## 认知层级：元认知层 (Meta Layer)\r
\r
作为 AI Agent 的“工程化专家”，本模块负责将 AI 生成的 SQL 资产无缝对接至现代数据模型管理工具（如 dbt）。\r
\r
## 核心任务\r
\r
### 1. 模型代码导出\r
将 CTE 编排后的 SQL 转化为 dbt 风格的 \`.sql\` 模型，自动注入 \`{{ ref(...) }}\` 和 \`{{ source(...) }}\`。\r
\r
### 2. Schema 配置生成\r
同步生成 \`schema.yml\` 文件，包含列描述、测试断言（SKL-305）及指标定义（SKL-206）。\r
\r
## 业务价值\r
实现从“临时数据分析”到“企业级资产沉淀”的闭环。\r
`,fileName:"skill-404-dbt.md",triggers:["dbt","engineering","bridge","model","schema","持久化","工程化","对接"],intent:"DBT_BRIDGE"},{id:"SKL-405",name:"首席执行官式摘要",content:`# SKL-405: 首席执行官式摘要 (CEO-style Executive Summary)\r
\r
## 认知层级：元认知层 (Meta Layer)\r
\r
作为 AI Agent 的“沟通专家”，本模块负责在最终报告的最顶层生成具备商业决策冲击力的极简摘要。\r
\r
## 核心任务\r
\r
### 1. TL;DR 抽象\r
从数十项 Insights 中提取最重要的 3 个“可行动结论”。\r
\r
### 2. 商业语言对齐\r
禁止使用“SELECT count(*) 是 100”这类术语，转化为“用户留存率较上周提升了 10%”。\r
\r
## 输出规范\r
报告首页必须包含一个 \`### 🚀 决策快照\` 区块，字数控制在 200 字以内。\r
`,fileName:"skill-405-ceo.md",triggers:["ceo","executive","summary","tl;dr","decision","摘要","决策","结论"],intent:"EXECUTIVE_SUMMARY"}],sr=[{layer:"perception",label:"感知层",priority:1,color:"cyan"},{layer:"strategy",label:"决策层",priority:2,color:"amethyst"},{layer:"execution",label:"执行层",priority:3,color:"green"},{layer:"meta",label:"元认知层",priority:4,color:"yellow"}],Ae={META_PROTOCOL:"meta",SCENE_PROBE:"perception",QUALITY_AUDIT:"perception",TIME_DETECTOR:"perception",RELATION_SENSOR:"perception",LOCALIZATION_GUARD:"perception",DRIFT_BENCHMARKER:"perception",DATA_GOVERNANCE:"strategy",METRIC_MODELING:"strategy",CTE_ORCHESTRATOR:"strategy",WASM_STRATEGIST:"strategy",COMPLIANCE_POLICY:"strategy",METRIC_FACTORY:"strategy",ISOLATION_POLICY:"strategy",SQL_ENGINEERING:"execution",SAFETY_ROLLBACK:"execution",NARRATIVE_REPORT:"execution",MACRO_FACTORY:"execution",ASSERTION_VALIDATOR:"execution",STORAGE_OPTIMIZER:"execution",SELF_HEALING_PIPELINE:"execution",SESSION_SNAPSHOT:"execution",COGNITIVE_ALIGNMENT:"meta",NARRATIVE_TRACE:"meta",PROMPT_COMPRESSOR:"meta",DBT_BRIDGE:"meta",EXECUTIVE_SUMMARY:"meta"};function Le(s){const e=s.split(`
`),t=n=>{const i=(n.match(/[\u4e00-\u9fff]/g)||[]).length,o=n.trim().split(/\s+/).filter(Boolean).length;return i*2+o},r=s.match(/🎯\s*解决什么问题[\s\S]*?(?=\*\*|##|```)/);if(r){const n=r[0].replace(/^[🎯\s*]*|\*\*|```|\n+/g," ").replace(/[#*\-]/g,"").trim();if(n.length>8)return n.slice(0,80)}const a=e.map(n=>n.replace(/^#+\s*/,"").trim()).filter(n=>n.length>8&&!n.startsWith("```")&&!n.startsWith("|")&&!n.startsWith("- ")).filter(n=>(n.match(/[\u4e00-\u9fff]/g)||[]).length>0).sort((n,i)=>t(i)-t(n));return a[0]?a[0].slice(0,80):""}function Ce(s){const e=Ae[s.intent??""]??"perception",t=s.triggers??[];return{id:s.id,name:s.name,description:Le(s.content),category:"handbook",inputSchema:[],outputType:"markdown",requiresTable:!1,requiresColumns:!1,examples:[],intentKeywords:t,triggers:{keywords:t},compatibleWith:[],sqlOperationType:void 0,_layer:e}}const qe=k.map(Ce),Re=[...Se,...Ee,...be,...Te,...he,...Ie,...qe];class Ne{constructor(){this.skills=new Map,this.categories=new Map,this.registerBuiltInSkills()}registerBuiltInSkills(){Re.forEach(e=>this.register(e))}register(e){this.skills.set(e.id,e),this.updateCategoryIndex(e)}update(e){return this.skills.has(e.id)?(this.skills.set(e.id,e),this.updateCategoryIndex(e),!0):!1}unregister(e){const t=this.skills.get(e);return t?(this.skills.delete(e),this.removeFromCategoryIndex(t),!0):!1}get(e){return this.skills.get(e)}getAll(){return Array.from(this.skills.values())}getByCategory(e){return(this.categories.get(e)||[]).map(r=>this.skills.get(r)).filter(Boolean)}getCategories(){const e=[];return this.categories.forEach((t,r)=>{e.push({category:r,count:t.length})}),e}search(e){const t=e.toLowerCase();return Array.from(this.skills.values()).filter(r=>r.name.toLowerCase().includes(t)||r.description.toLowerCase().includes(t))}matchSkillsByIntent(e){const t=e.map(r=>r.toLowerCase());return Array.from(this.skills.values()).filter(r=>{if(r.triggers){const{keywords:a,patterns:n}=r.triggers;if(a&&a.some(i=>t.some(o=>i.toLowerCase().includes(o)||o.includes(i.toLowerCase())))||n&&n.some(i=>{const o=typeof i=="string"?new RegExp(i,"i"):i;return e.some(c=>o.test(c))}))return!0}return r.intentKeywords?r.intentKeywords.some(a=>t.some(n=>a.toLowerCase().includes(n)||n.includes(a.toLowerCase()))):r.intentPatterns?r.intentPatterns.some(a=>{try{return e.some(n=>new RegExp(a,"i").test(n))}catch{return!1}}):!1})}matchAdvancedTriggers(e){const t=e.toLowerCase();return Array.from(this.skills.values()).filter(r=>{if(!r.triggers)return!1;const{keywords:a,patterns:n}=r.triggers;return!!(a!=null&&a.some(i=>t.includes(i.toLowerCase()))||n!=null&&n.some(i=>(typeof i=="string"?new RegExp(i,"i"):i).test(e)))})}matchSkillsByOperation(e){return Array.from(this.skills.values()).filter(t=>t.sqlOperationType===e)}findCompatibleSkills(e){const t=this.skills.get(e);if(!t)return[];if(t.compatibleWith)return t.compatibleWith.map(n=>this.skills.get(n)).filter(n=>n!==void 0);const r=t.sqlOperationType||"select",a=this.getCompatibleOperationTypes(r);return Array.from(this.skills.values()).filter(n=>n.id!==e&&n.sqlOperationType&&a.includes(n.sqlOperationType))}getCompatibleOperationTypes(e){return{select:["aggregation","join","window","transformation"],insert:[],update:[],delete:[],aggregation:["select","window"],join:["select","aggregation"],window:["select","aggregation"],transformation:["select"],analysis:["aggregation","window","transformation"],optimization:["select"],utility:["select","insert"]}[e]||[]}findSimilarSkills(e,t=5){const r=this.skills.get(e);return r?Array.from(this.skills.values()).filter(i=>i.id!==e).map(i=>{var b,_;let o=0;i.category===r.category&&(o+=.4),i.sqlOperationType===r.sqlOperationType&&(o+=.3);const c=new Set(r.name.toLowerCase().split(/\s+/)),u=new Set(i.name.toLowerCase().split(/\s+/)),p=[...c].filter(h=>u.has(h)).length;o+=p*.05;const m=new Set(r.description.toLowerCase().split(/\s+/)),d=new Set(i.description.toLowerCase().split(/\s+/)),f=[...m].filter(h=>d.has(h)).length;o+=f*.02;const E=((b=r.triggers)==null?void 0:b.keywords)||[],g=((_=i.triggers)==null?void 0:_.keywords)||[],y=E.filter(h=>g.includes(h)).length;return o+=y*.03,{skill:i,score:o}}).sort((i,o)=>o.score-i.score).slice(0,t).map(i=>i.skill):[]}updateCategoryIndex(e){const t=this.categories.get(e.category)||[];t.includes(e.id)||(t.push(e.id),this.categories.set(e.category,t))}removeFromCategoryIndex(e){const t=this.categories.get(e.category);if(t){const r=t.indexOf(e.id);r>-1&&t.splice(r,1)}}}const S=new Ne,O=s=>S.get(s),or=()=>S.getAll(),lr=s=>S.search(s),cr=()=>S.getCategories(),Oe={select:["查询","查找","获取","看看","显示","展示","query","find","get","show","select","read","list"],insert:["添加","插入","新建","创建","新增","add","insert","create","new","append"],update:["修改","更新","改变","调整","update","modify","change","edit","alter"],delete:["删除","移除","清除","去掉","delete","remove","drop","clear"],aggregation:["统计","合计","求和","平均","计数","最大值","最小值","汇总","group","sum","count","avg","max","min","total","aggregate"],join:["关联","连接","合并","join","link","combine","merge"],window:["排名","排序","累计","移动平均","滞后","领先","窗口","rank","row_number","lag","lead","cumulative","moving","window"],transformation:["转换","变换","透视","逆透视","pivot","unpivot","transform"],analysis:["分析","趋势","留存","漏斗","转化","对比","占比","analyze","trend","retention","funnel","conversion","compare","ratio"],optimization:["优化","性能","慢查询","索引","explain","optimize","performance","index"],utility:["生成","测试","示例","模拟","摘要","generate","test","sample","mock"]},xe=[{pattern:/留存/i,skills:["sql-time-series","sql-retention-analysis"]},{pattern:/漏斗/i,skills:["sql-funnel-analysis"]},{pattern:/(同比增长|环比|增长率)/i,skills:["sql-time-series","sql-growth-analysis"]},{pattern:/(占比|占比|百分比)/i,skills:["sql-aggregation","sql-ratio-analysis"]}];class ke{matchByTriggers(e,t){var o;if(!e.triggers)return{score:0,matched:!1};const r=t.toLowerCase(),{keywords:a,patterns:n}=e.triggers;let i=0;return a!=null&&a.some(c=>r.includes(c.toLowerCase()))&&(i+=.5),n!=null&&n.some(c=>(typeof c=="string"?new RegExp(c,"i"):c).test(t))&&(i+=.3),(o=e.triggers.sqlOperations)!=null&&o.length&&(i+=.1),{score:i,matched:i>0}}async analyze(e,t){const r=this.matchByKeywords(e);if(r.confidence>=.85)return r;try{const a=await this.aiAnalyzeIntent(e,t);return a.confidence>r.confidence?a:{...r,reasoning:`${r.reasoning} (AI 语义分析置信度较低，采用规则候选)`}}catch(a){return console.warn("AI intent analysis failed, using fallback:",a),{...r,reasoning:`${r.reasoning} (AI 服务不可用，已自动降级)`}}}matchOfficialSkills(e){const t=e.toLowerCase();return k.filter(r=>{var a;return(a=r.triggers)==null?void 0:a.some(n=>t.includes(n.toLowerCase()))}).map(r=>r.id)}matchByKeywords(e){var i;const t=e.toLowerCase(),r=[];for(const[o,c]of Object.entries(Oe)){const u=c.filter(p=>t.includes(p.toLowerCase()));u.length>0&&r.push({type:o,score:u.length/c.length+.5})}r.sort((o,c)=>c.score-o.score);const a=((i=r[0])==null?void 0:i.type)||"select",n=r.length>0?Math.min(r[0].score,.9):.3;return{intent:a,confidence:n,requiredSkills:[],userRequest:e,matchedOfficialSkills:this.matchOfficialSkills(e),reasoning:`关键词匹配: 识别到 ${a} 操作特征`}}async aiAnalyzeIntent(e,t){const r=t.tableName?`当前上下文: 表 ${t.tableName}`:"",a=`你是一个 SQL 需求分析专家。分析用户意图并返回 JSON。
需求: ${e}
${r}

可能的意图: select, insert, update, delete, aggregation, join, window, transformation, analysis, optimization, utility.

返回格式: {"intent": "...", "confidence": 0.0-1.0, "reasoning": "..."}`,i=(await A.generateSql(a,"")).match(/\{[\s\S]*\}/),o=i?JSON.parse(i[0]):{intent:"select",confidence:.5};return{intent:o.intent||"select",confidence:o.confidence||.6,requiredSkills:[],userRequest:e,reasoning:o.reasoning||"AI 语义分析",matchedOfficialSkills:this.matchOfficialSkills(e)}}getComplexSkills(e){for(const t of xe)if(t.pattern.test(e))return t.skills;return null}}const K=new ke;class we{async extract(e,t,r){const a=O(t);if(!a)return{description:e};if(a.inputParser)try{const o=a.inputParser(e,r);if(Object.keys(o).length>0)return o}catch(o){console.warn(`Custom parser failed for skill ${t}:`,o)}const n=this.extractByRules(e,a.inputSchema,r);if(a.inputSchema.filter(o=>o.required&&(n[o.name]===void 0||n[o.name]==="")).length===0)return n;try{const o=await this.extractByAI(e,a,r,n);return{...n,...o}}catch(o){return console.warn(`AI parameter extraction failed for skill ${t}:`,o),n}}extractByRules(e,t,r){e.toLowerCase();const a={};for(const n of t)switch(n.name){case"description":case"userRequest":a[n.name]=e;break;case"tableName":a[n.name]=r.tableName||n.defaultValue;break;case"conditions":case"whereClause":{const i=e.match(/(?:条件?|where|过滤|筛选)(.+?)(?:，|,|。|$)/i);i&&(a[n.name]=i[1].trim());break}case"limit":{const i=e.match(/(?:前|top|limit|最多)\s*(\d+)/i);a[n.name]=i?parseInt(i[1],10):n.defaultValue||100;break}case"orderBy":case"sortBy":{const i=e.match(/(?:按|排序|order\s*by|sort)\s*(\S+)/i);if(i){const o=this.matchColumnName(i[1],r);a[n.name]=o||i[1]}break}case"groupBy":case"groupByColumns":{const i=e.match(/(?:按|分组|group\s*by)\s*(\S+)/i);if(i){const o=this.matchColumnName(i[1],r);a[n.name]=o||i[1]}break}case"aggregationType":{const i=[[/求和|总[和计额]|sum/i,"SUM"],[/平均|均值|avg|average/i,"AVG"],[/计数|数量|count/i,"COUNT"],[/最大|最高|max/i,"MAX"],[/最小|最低|min/i,"MIN"]];for(const[o,c]of i)if(o.test(e)){a[n.name]=c;break}break}default:n.defaultValue!==void 0&&(a[n.name]=n.defaultValue)}return a}async extractByAI(e,t,r,a){var p;const n=r.tableName?`表: ${r.tableName}, 列: ${(p=r.columns)==null?void 0:p.map(m=>m.name).join(", ")}`:"无表结构上下文",i=t.inputSchema.filter(m=>!a[m.name]).map(m=>`${m.name} (${m.label}): ${m.description||""}`).join(`
`);if(!i)return{};const o=`你是一个参数提取专家。从用户的自然语言需求中提取以下字段。
需求: ${e}
${n}

需要提取的字段:
${i}

请仅返回 JSON 格式结果，不要包含任何解释。
格式: {"field1": "value1", "field2": "value2"}`,u=(await A.generateSql(o,"")).match(/\{[\s\S]*\}/);return u?JSON.parse(u[0]):{}}matchColumnName(e,t){if(!t.columns||t.columns.length===0)return null;const r=e.toLowerCase().replace(/[，,。、]/g,""),a=t.columns.find(i=>i.name.toLowerCase()===r);if(a)return a.name;const n=t.columns.find(i=>i.name.toLowerCase().includes(r)||r.includes(i.name.toLowerCase()));return(n==null?void 0:n.name)||null}}const v=new we,w="duckdb_skill_history",De="duckdb_skill_favorites",Q="duckdb_skill_stats",_e=100;function F(){try{const s=localStorage.getItem(w);return s?JSON.parse(s):[]}catch{return[]}}function Me(s){try{const e=F(),t={...s,id:`${Date.now()}-${Math.random().toString(36).substr(2,9)}`,timestamp:Date.now()};e.unshift(t);const r=e.slice(0,_e);localStorage.setItem(w,JSON.stringify(r)),Be(s.skillId,s.result.success,s.duration)}catch(e){console.warn("Failed to save skill history:",e)}}function Pe(){localStorage.removeItem(w)}function ur(){try{const s=localStorage.getItem(De);return s?JSON.parse(s):[]}catch{return[]}}function Y(){try{const s=localStorage.getItem(Q);return s?JSON.parse(s):{}}catch{return{}}}function Be(s,e,t){try{const r=Y();r[s]||(r[s]={skillId:s,totalExecutions:0,successCount:0,failureCount:0,totalDuration:0,lastExecuted:0,lastInputs:{}}),r[s].totalExecutions++,e?r[s].successCount++:r[s].failureCount++,t&&(r[s].totalDuration+=t),r[s].lastExecuted=Date.now(),localStorage.setItem(Q,JSON.stringify(r))}catch(r){console.warn("Failed to update stats:",r)}}const l=new Map;async function Ke(){return(await C(()=>import("./query-generators-Dgl-UklK.js"),[])).sqlQueryGenerators}async function ve(){return(await C(()=>import("./ddl-generators-BF6Xf6Jp.js"),[])).sqlDdlGenerators}async function Ve(){return(await C(()=>import("./analysis-generators-CnY4K4k6.js"),[])).analysisGenerators}async function Ge(){const s=await C(()=>import("./misc-generators-BY2Ie_rM.js"),[]);return{transformationGenerators:s.transformationGenerators,optimizationGenerators:s.optimizationGenerators,utilityGenerators:s.utilityGenerators}}let R=null;async function He(){if(!R){const[s,e,t,r]=await Promise.all([Ke(),ve(),Ve(),Ge()]);R={query:s,ddl:e,analysis:t,misc:r}}return R}async function Ue(){const{query:s,ddl:e,analysis:t,misc:r}=await He();l.set("sql-select",s.select),l.set("sql-join",s.join),l.set("sql-aggregation",s.aggregation),l.set("sql-window",s.window),l.set("sql-cte",s.cte),l.set("sql-insert",s.insert),l.set("sql-update",s.update),l.set("sql-delete",s.delete),l.set("sql-create-table",e.createTable),l.set("sql-create-table-nl",e.createTableNL),l.set("sql-create-table-template",e.createTableTemplate),l.set("sql-create-table-import",e.createTableImport),l.set("sql-alter-table",e.alterTable),l.set("sql-drop-table",e.dropTable),l.set("sql-view",e.createView),l.set("sql-index",e.createIndex),l.set("sql-table-design",e.tableDesign),l.set("analysis-time-series",t.timeSeries),l.set("analysis-comparison",t.comparison),l.set("analysis-funnel",t.funnel),l.set("analysis-retention",t.retention),l.set("transform-pivot",r.transformationGenerators.pivot),l.set("transform-unpivot",r.transformationGenerators.unpivot),l.set("transform-type-conversion",r.transformationGenerators.typeConversion),l.set("transform-string-manipulation",r.transformationGenerators.stringManipulation),l.set("transform-date-handling",r.transformationGenerators.dateHandling),l.set("optimization-explain",r.optimizationGenerators.explain),l.set("optimization-index",r.optimizationGenerators.index),l.set("optimization-query-rewrite",r.optimizationGenerators.queryRewrite),l.set("optimization-duckdb-tuner",r.optimizationGenerators.duckdbTuner),l.set("optimization-schema-sanitizer",r.optimizationGenerators.schemaSanitizer),l.set("utility-test-data",r.utilityGenerators.testData),l.set("utility-summarize",r.utilityGenerators.summarize),l.set("utility-sample-query",r.utilityGenerators.sampleQuery)}function ze(s){return l.get(s)??null}let V=!1,N=null;async function Qe(){if(!V)return N||(N=Ue().then(()=>{V=!0})),N}function Fe(s){const e=[];return s.tableName&&e.push(`表名: ${s.tableName}`),s.columns&&s.columns.length>0&&e.push(`列信息:
${s.columns.map(t=>`  - ${t.name} (${t.type}${t.pk?", 主键":""})`).join(`
`)}`),s.schema&&e.push(`Schema: ${s.schema}`),e.join(`

`)}async function Ye(s){if(s.execute)return async(e,t)=>(await s.execute(e,t)).sql??"";if(s.generatorId){await Qe();const e=ze(s.generatorId);if(e)return e}return null}async function G(s,e,t,r,a){const n=Date.now();try{if(a!=null&&a.cancelled)return{success:!1,error:"Execution cancelled",executionTime:Date.now()-n};const i=Fe(t),o=Object.entries(e).map(([g,y])=>`${g}: ${y}`).join(", "),c={modeling:`基于以下需求生成 DuckDB SQL 建模查询：
需求: ${e.description||o}
表结构: ${i}

请分析业务语义，生成完整、可执行的 SQL 语句、DDL 或数据模型。`,wrangling:`基于以下需求生成 DuckDB 数据转换 (Data Wrangling) SQL：
需求: ${o}
表结构: ${i}

请专注于数据清洗、类型转换、字符串处理或结构化转换逻辑。`,insights:`基于以下需求生成 DuckDB 深度分析 (Insights) 查询：
需求: ${o}
表结构: ${i}

请生成包含复杂聚合、窗口函数、时间序列分析或多维对比的 SQL。`,optimization:`基于以下需求生成 DuckDB 诊断与优化建议：
需求: ${o}
表结构: ${i}

请分析 SQL 性能，提供优化后的查询语句或索引思路。`,engineering:`基于以下需求生成 DuckDB 工程辅助 (Engineering) SQL：
需求: ${o}
表结构: ${i}

请专注于测试数据生成、抽样、导入导出或数据质量检查逻辑。`};let u="";t.matchedOfficialSkills&&t.matchedOfficialSkills.length>0&&(u=`

## 必须遵循的官方手册规则 (Handbook Rules):
`,t.matchedOfficialSkills.forEach(g=>{const y=k.find(b=>b.id===g);y&&(u+=`
### [${y.id}] ${y.name}
${y.content}
`)}));let p=(c[s.category]||`生成 DuckDB SQL: ${o}
表结构: ${i}`)+u;if(a!=null&&a.cancelled)return{success:!1,error:"Execution cancelled",executionTime:Date.now()-n};let m=await A.generateSql(p,i,r),d=0;const f=2;let E=!1;for(;d<f&&!(!m||!m.trim());)try{const g=m.trim().replace(/;+$/,"");/^\s*(SELECT|WITH|EXPLAIN|SHOW|DESCRIBE)/i.test(g)&&await $.query(`EXPLAIN ${g}`);break}catch(g){d++;const y=(g==null?void 0:g.message)||String(g);if(console.warn(`[Self-Healing SQL Retry #${d}] DuckDB Error: ${y}`),d>=f){console.warn("[Self-Healing SQL] Exceeded maximum retries, returning best effort SQL.");break}const b=`${p}

[自我修复日志 - 尝试 #${d}]
先前生成的 SQL:
\`\`\`sql
${m}
\`\`\`

DuckDB 引擎抛出错误:
${y}

请修改上述 SQL，修正错误的表名、字段名或语法约束，仅输出修复后的 SQL 代码段。`;m=await A.generateSql(b,i,r),E=!0}return a!=null&&a.cancelled?{success:!1,error:"Execution cancelled",executionTime:Date.now()-n}:{success:!0,sql:m.trim(),explanation:`基于 ${s.name} 生成的 SQL 查询${E?" (已自动自愈修复)":""}`,executionTime:Date.now()-n}}catch(i){return{success:!1,error:i.message||"SQL generation failed",executionTime:Date.now()-n}}}class $e{constructor(){this.executionHistory=[],this.maxHistorySize=50,this.currentCancelToken=null}async execute(e){const{skillId:t,inputs:r,context:a,simulateOnly:n,onChunk:i,cancelToken:o}=e,c=O(t);if(!c)return{success:!1,error:`Skill not found: ${t}`};this.currentCancelToken=o||null;const u=Date.now();try{if(o!=null&&o.cancelled)return{success:!1,error:"Execution cancelled",executionTime:Date.now()-u};const p=await Ye(c);let m;if(p){if(o!=null&&o.cancelled)return{success:!1,error:"Execution cancelled",executionTime:Date.now()-u};const d=p(r,a),f=d instanceof Promise?await d:d;if(f&&!f.includes("col")&&!f.includes("table_name")){const E=c.execute?"直接执行":"Generator注册表";return m={success:!0,sql:f,explanation:`基于 ${c.name} (${E}) 模板生成的 SQL`},this.addToHistory(t,m,a,r),n?{...m,metadata:{...m.metadata||{},simulated:!0},executionTime:Date.now()-u}:{...m,executionTime:Date.now()-u}}m={success:!0,sql:f,explanation:`基于 ${c.name} 模板生成的 SQL (AI 增强)`}}else m=await G(c,r,a,i,o);if(o!=null&&o.cancelled)return{success:!1,error:"Execution cancelled",executionTime:Date.now()-u};if(p)try{const d=await G(c,r,a,i,o);d.success&&d.sql&&(m={...m,...d,explanation:(m.explanation||"")+" (AI 增强)",executionTime:d.executionTime})}catch(d){console.warn("AI enhancement failed, using template:",d)}return this.addToHistory(t,m,a,r),n?{...m,metadata:{...m.metadata||{},simulated:!0},executionTime:Date.now()-u}:{...m,executionTime:Date.now()-u}}catch(p){const m={success:!1,error:p.message||"Execution failed",executionTime:Date.now()-u};return this.addToHistory(t,m,a,r),m}finally{this.currentCancelToken=null}}cancel(){this.currentCancelToken&&(this.currentCancelToken.cancelled=!0)}isExecuting(){return this.currentCancelToken!==null}addToHistory(e,t,r,a){const n=O(e),i={skillId:e,skillName:(n==null?void 0:n.name)||e,skillCategory:(n==null?void 0:n.category)||"unknown",inputs:a||{},result:{success:t.success,sql:t.sql,error:t.error,explanation:t.explanation},duration:t.executionTime,tableName:r==null?void 0:r.tableName};Me(i),this.executionHistory.unshift({skillId:e,result:t,timestamp:Date.now()}),this.executionHistory.length>this.maxHistorySize&&(this.executionHistory=this.executionHistory.slice(0,this.maxHistorySize))}getHistory(){return F().map(e=>({skillId:e.skillId,result:e.result,timestamp:e.timestamp}))}clearHistory(){Pe(),this.executionHistory=[]}}const L=new $e,mr=s=>L.execute(s),dr=()=>L.getHistory();function je(s){return Array.isArray(s)&&s.every(e=>typeof e=="object"&&e!==null&&"name"in e&&"type"in e)}function pr(s,e,t,r){return{tableName:s,columns:je(e)?e:void 0,userIntent:"",currentSql:r}}function H(s){const t=Y()[s];if(!t)return 0;const r=(Date.now()-t.lastExecuted)/(1e3*60*60*24);return r>7?0:Math.max(0,(7-r)/7)*.3}class We{constructor(){this.executionHistory=[],this.maxHistorySize=20,this.sessionRecentSkills=[],this.maxSessionRecent=5}async analyzeIntent(e,t){const r=await K.analyze(e,t);r.requiredSkills.length===0&&(r.requiredSkills=this.suggestSkillIds(r,t));const a=K.getComplexSkills(e);return a&&(r.skillChain=this.buildSkillChain(a,t)),this.addToHistory(r),r}suggestSkillIds(e,t){const r=S.matchAdvancedTriggers(e.userRequest);if(r.length>0)return r.map(n=>n.id);const a=S.matchSkillsByOperation(e.intent);return a.length>0?a.slice(0,3).map(n=>n.id):[this.getDefaultSkillId(e.intent)]}getDefaultSkillId(e){const t=S.matchSkillsByOperation(e);if(t.length>0)return t[0].id;const r=S.getByCategory("modeling");return r.length>0?r[0].id:"sql-select-generator"}async suggestSkills(e,t,r=5){const a=await this.analyzeIntent(e,t);let n=a.requiredSkills.map(i=>S.get(i)).filter(i=>i!==void 0);if(n=this.contextAwareSort(n,t),n.length<r){const i=this.intentToCategory(a.intent),o=S.getByCategory(i).filter(p=>!n.includes(p)),c=this.contextAwareSort(o,t),u=r-n.length;n=[...n,...c.slice(0,u)]}return n=this.filterByContext(n,t),n.forEach(i=>this.addToSessionMemory(i.id)),n.slice(0,r)}contextAwareSort(e,t){return[...e].sort((r,a)=>{let n=H(r.id),i=H(a.id);return this.sessionRecentSkills.includes(r.id)&&(n+=.2),this.sessionRecentSkills.includes(a.id)&&(i+=.2),t.tableName&&r.requiresTable&&(n+=.1),t.tableName&&a.requiresTable&&(i+=.1),t.columns&&t.columns.length>0&&(r.requiresColumns&&(n+=.1),a.requiresColumns&&(i+=.1)),i-n})}filterByContext(e,t){return e.filter(r=>!0)}addToSessionMemory(e){this.sessionRecentSkills=[e,...this.sessionRecentSkills.filter(t=>t!==e)].slice(0,this.maxSessionRecent)}async executeFromIntent(e,t,r=!1){const a=await this.analyzeIntent(e,t);if(a.skillChain&&a.skillChain.steps.length>0)return this.executeSkillChain(a.skillChain,t,r);const n=a.requiredSkills[0];if(!n)return{success:!1,error:"无法识别用户意图，没有找到匹配的技能"};this.addToSessionMemory(n);const i=await v.extract(e,n,t),o=t._onChunk,c=t.cancelToken,u={skillId:n,inputs:i,context:{...t,matchedOfficialSkills:a.matchedOfficialSkills},simulateOnly:r};return o&&(u.onChunk=o),c&&(u.cancelToken=c),L.execute(u)}async executeSkillChain(e,t,r){let a="",n=[],i={...t};for(const o of e.steps){this.addToSessionMemory(o.skillId);const c=await v.extract(t.userIntent||"",o.skillId,i),u=await L.execute({skillId:o.skillId,inputs:c,context:{...i,currentSql:a},simulateOnly:r});if(!u.success)return u;u.sql&&(a+=(a?`

`:"")+u.sql),u.explanation&&n.push(u.explanation),i={...i,currentSql:a}}return{success:!0,sql:a,explanation:n.join(`

`),metadata:{chainExecution:!0,steps:e.steps.length}}}buildSkillChain(e,t){return{steps:e.map((r,a)=>({stepId:`step_${a}`,skillId:r,inputs:{},dependsOn:a>0?[`step_${a-1}`]:[]}))}}intentToCategory(e){return{select:"modeling",insert:"modeling",update:"modeling",delete:"modeling",aggregation:"modeling",join:"modeling",window:"modeling",transformation:"wrangling",analysis:"insights",optimization:"optimization",utility:"engineering"}[e]||"modeling"}addToHistory(e){this.executionHistory.unshift(e),this.executionHistory.length>this.maxHistorySize&&this.executionHistory.pop()}getHistory(){return[...this.executionHistory]}clearHistory(){this.executionHistory=[]}clearSessionMemory(){this.sessionRecentSkills=[]}}const D=new We,gr=(s,e)=>D.analyzeIntent(s,e),yr=(s,e,t)=>D.suggestSkills(s,e,t),fr=(s,e,t)=>D.executeFromIntent(s,e,t),Sr={modeling:{label:"探测与建模",icon:X,emoji:"🔍",colors:{primary:"#66d9ef",bg:"bg-[#66d9ef]/[8%]",bgSubtle:"bg-[#66d9ef]/[5%]",iconBg:"bg-[#66d9ef]/[15%]",border:"border-monokai-border",text:"text-[#66d9ef]",icon:"text-[#66d9ef]",gradientFrom:"from-[#66d9ef]/[10%]",gradientTo:"to-[#66d9ef]/[5%]"},sqlOperations:["select","insert","update","delete","aggregation","join","window","cte"]},wrangling:{label:"清洗与转换",icon:J,emoji:"🔄",colors:{primary:"#a6e22e",bg:"bg-[#a6e22e]/[8%]",bgSubtle:"bg-[#a6e22e]/[5%]",iconBg:"bg-[#a6e22e]/[15%]",border:"border-monokai-border",text:"text-[#a6e22e]",icon:"text-[#a6e22e]",gradientFrom:"from-[#a6e22e]/[10%]",gradientTo:"to-[#a6e22e]/[5%]"},sqlOperations:["transformation"]},insights:{label:"深度分析与洞察",icon:U,emoji:"📊",colors:{primary:"#ae81ff",bg:"bg-[#ae81ff]/[8%]",bgSubtle:"bg-[#ae81ff]/[5%]",iconBg:"bg-[#ae81ff]/[15%]",border:"border-monokai-border",text:"text-[#ae81ff]",icon:"text-[#ae81ff]",gradientFrom:"from-[#ae81ff]/[10%]",gradientTo:"to-[#ae81ff]/[5%]"},sqlOperations:["analysis"]},optimization:{label:"诊断与优化",icon:W,emoji:"🚀",colors:{primary:"#fd971f",bg:"bg-[#fd971f]/[8%]",bgSubtle:"bg-[#fd971f]/[5%]",iconBg:"bg-[#fd971f]/[15%]",border:"border-monokai-border",text:"text-[#fd971f]",icon:"text-[#fd971f]",gradientFrom:"from-[#fd971f]/[10%]",gradientTo:"to-[#fd971f]/[5%]"},sqlOperations:["optimization"]},engineering:{label:"工程与运维",icon:j,emoji:"🛠️",colors:{primary:"#8be9fd",bg:"bg-[#8be9fd]/[8%]",bgSubtle:"bg-[#8be9fd]/[5%]",iconBg:"bg-[#8be9fd]/[15%]",border:"border-monokai-border",text:"text-[#8be9fd]",icon:"text-[#8be9fd]",gradientFrom:"from-[#8be9fd]/[10%]",gradientTo:"to-[#8be9fd]/[5%]"},sqlOperations:["utility"]},handbook:{label:"官方手册",icon:z,emoji:"📖",colors:{primary:"#e6db74",bg:"bg-[#e6db74]/[8%]",bgSubtle:"bg-[#e6db74]/[5%]",iconBg:"bg-[#e6db74]/[15%]",border:"border-monokai-border",text:"text-[#e6db74]",icon:"text-[#e6db74]",gradientFrom:"from-[#e6db74]/[10%]",gradientTo:"to-[#e6db74]/[5%]"},sqlOperations:[]}},Er={select:{label:"数据查询",color:"text-[#66d9ef]",bg:"bg-[#66d9ef]/[20%]",border:"border-monokai-border"},insert:{label:"数据插入",color:"text-[#a6e22e]",bg:"bg-[#a6e22e]/[20%]",border:"border-monokai-border"},update:{label:"数据更新",color:"text-[#e6db74]",bg:"bg-[#e6db74]/[20%]",border:"border-monokai-border"},delete:{label:"数据删除",color:"text-[#f92672]",bg:"bg-[#f92672]/[20%]",border:"border-monokai-border"},aggregation:{label:"聚合统计",color:"text-[#ae81ff]",bg:"bg-[#ae81ff]/[20%]",border:"border-monokai-border"},join:{label:"多表关联",color:"text-[#f92672]",bg:"bg-[#f92672]/[20%]",border:"border-monokai-border"},window:{label:"窗口函数",color:"text-[#8be9fd]",bg:"bg-[#8be9fd]/[20%]",border:"border-monokai-border"},transformation:{label:"数据转换",color:"text-[#fd971f]",bg:"bg-[#fd971f]/[20%]",border:"border-monokai-border"},analysis:{label:"数据分析",color:"text-[#ae81ff]",bg:"bg-[#ae81ff]/[20%]",border:"border-monokai-border"},optimization:{label:"SQL 优化",color:"text-[#e6db74]",bg:"bg-[#e6db74]/[20%]",border:"border-monokai-border"},utility:{label:"工具生成",color:"text-[#75715e]",bg:"bg-[#75715e]/[20%]",border:"border-monokai-border"}},Je={"skl-":z,select:ce,join:le,cte:oe,insert:se,update:q,delete:ie,"create-table":I,create_table:I,"alter-table":q,alter_table:q,"drop-table":P,drop_table:P,view:ae,index:T,table:I,"time-series":M,time_series:M,comparison:U,funnel:T,retention:ne,pivot:I,unpivot:te,"type-cast":T,type_cast:T,type:T,string:de,date:re,explain:ge,rewrite:me,"test-data":B,test_data:B,sample:T,summarize:ee,generator:Z};function br(s){const e=s.toLowerCase();for(const[t,r]of Object.entries(Je))if(e.includes(t))return r;return ue}const Tr={modeling:"#66d9ef",wrangling:"#a6e22e",insights:"#ae81ff",optimization:"#fd971f",engineering:"#8be9fd",handbook:"#e6db74"};export{Re as B,Sr as C,Er as I,ir as T,Tr as a,pr as b,gr as c,fr as d,mr as e,dr as f,br as g,Y as h,ur as i,cr as j,or as k,lr as l,sr as m,yr as n,S as s};
