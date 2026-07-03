function _(T){return Array.isArray(T)&&T.every(l=>typeof l=="object"&&l!==null&&"name"in l&&"type"in l)}function C(T){return{users:`INSERT INTO "${T}" (username, email, real_name, gender, status) VALUES
  ('admin', 'admin@example.com', '管理员', 'male', 'active'),
  ('john_doe', 'john@example.com', '张三', 'male', 'active'),
  ('jane_smith', 'jane@example.com', '李四', 'female', 'active'),
  ('bob_wilson', 'bob@example.com', '王五', 'male', 'inactive');
`,categories:`INSERT INTO "${T}" (category_name, level, sort_order) VALUES
  ('电子产品', 1, 1), ('服装', 1, 2), ('图书', 1, 3), ('食品', 1, 4);
`,products:`INSERT INTO "${T}" (product_code, product_name, category_id, price, cost_price, stock_quantity, status) VALUES
  ('P001', 'iPhone 15 Pro', 1, 8999.00, 6500.00, 100, 'active'),
  ('P002', 'MacBook Pro', 1, 15999.00, 12000.00, 50, 'active'),
  ('P003', '纯棉T恤', 2, 99.00, 30.00, 500, 'active'),
  ('P004', 'Java编程思想', 3, 108.00, 50.00, 200, 'active');
`}[T.toLowerCase()]||null}const N={用户表:{name:"users",columns:[{name:"id",type:"BIGINT",pk:!0},{name:"username",type:"VARCHAR(50)",notNull:!0,unique:!0},{name:"email",type:"VARCHAR(255)",notNull:!0,unique:!0},{name:"phone",type:"VARCHAR(20)"},{name:"password_hash",type:"VARCHAR(255)",notNull:!0},{name:"real_name",type:"VARCHAR(100)"},{name:"avatar",type:"VARCHAR(500)"},{name:"gender",type:"VARCHAR(10)"},{name:"birthday",type:"DATE"}]},订单表:{name:"orders",columns:[{name:"order_id",type:"BIGINT",pk:!0},{name:"order_number",type:"VARCHAR(50)",notNull:!0,unique:!0},{name:"user_id",type:"BIGINT",notNull:!0},{name:"total_amount",type:"DECIMAL(12,2)",notNull:!0,default:"0"},{name:"discount_amount",type:"DECIMAL(12,2)",default:"0"},{name:"pay_amount",type:"DECIMAL(12,2)",notNull:!0},{name:"pay_method",type:"VARCHAR(20)"},{name:"status",type:"VARCHAR(20)",default:"'pending'"},{name:"remark",type:"TEXT"}]},商品表:{name:"products",columns:[{name:"id",type:"BIGINT",pk:!0},{name:"product_code",type:"VARCHAR(50)",notNull:!0,unique:!0},{name:"product_name",type:"VARCHAR(255)",notNull:!0},{name:"category_id",type:"BIGINT"},{name:"description",type:"TEXT"},{name:"price",type:"DECIMAL(10,2)",notNull:!0},{name:"cost_price",type:"DECIMAL(10,2)"},{name:"stock_quantity",type:"INTEGER",default:"0"},{name:"image_url",type:"VARCHAR(500)"},{name:"unit",type:"VARCHAR(20)",default:"'个'"}]},分类表:{name:"categories",columns:[{name:"id",type:"BIGINT",pk:!0},{name:"category_name",type:"VARCHAR(100)",notNull:!0},{name:"parent_id",type:"BIGINT"},{name:"level",type:"INTEGER",default:"1"},{name:"sort_order",type:"INTEGER",default:"0"},{name:"icon",type:"VARCHAR(100)"},{name:"description",type:"TEXT"}]},支付记录表:{name:"payments",columns:[{name:"id",type:"BIGINT",pk:!0},{name:"order_id",type:"BIGINT",notNull:!0},{name:"user_id",type:"BIGINT",notNull:!0},{name:"amount",type:"DECIMAL(12,2)",notNull:!0},{name:"payment_method",type:"VARCHAR(50)",notNull:!0},{name:"transaction_id",type:"VARCHAR(100)",unique:!0},{name:"status",type:"VARCHAR(20)",default:"'pending'"},{name:"pay_time",type:"TIMESTAMP"}]},日志表:{name:"logs",columns:[{name:"id",type:"BIGINT",pk:!0},{name:"log_type",type:"VARCHAR(30)",notNull:!0},{name:"level",type:"VARCHAR(20)",default:"'info'"},{name:"message",type:"TEXT",notNull:!0},{name:"user_id",type:"BIGINT"},{name:"ip_address",type:"VARCHAR(50)"},{name:"request_url",type:"VARCHAR(500)"},{name:"request_method",type:"VARCHAR(10)"},{name:"execution_time",type:"INTEGER"},{name:"extra",type:"JSON"}]},配置表:{name:"configs",columns:[{name:"id",type:"BIGINT",pk:!0},{name:"config_key",type:"VARCHAR(100)",notNull:!0,unique:!0},{name:"config_value",type:"TEXT",notNull:!0},{name:"config_type",type:"VARCHAR(20)",default:"'string'"},{name:"description",type:"VARCHAR(200)"},{name:"is_system",type:"BOOLEAN",default:"FALSE"},{name:"created_at",type:"TIMESTAMP",default:"CURRENT_TIMESTAMP"},{name:"updated_at",type:"TIMESTAMP",default:"CURRENT_TIMESTAMP"}]},关系表:{name:"relations",columns:[{name:"id",type:"BIGINT",pk:!0},{name:"source_type",type:"VARCHAR(30)",notNull:!0},{name:"source_id",type:"BIGINT",notNull:!0},{name:"target_type",type:"VARCHAR(30)",notNull:!0},{name:"target_id",type:"BIGINT",notNull:!0},{name:"relation_type",type:"VARCHAR(50)",notNull:!0},{name:"metadata",type:"JSON"},{name:"created_at",type:"TIMESTAMP",default:"CURRENT_TIMESTAMP"}]}},y={电商:{tables:{}},用户管理:{tables:{}},订单系统:{tables:{}},库存管理:{tables:{}},财务:{tables:{}},日志分析:{tables:{}},物联网:{tables:{}}},f={createTable(T,l){const{tableName:E,columns:A,primaryKey:o,foreignKeys:R,indexes:a,engine:s,ifNotExists:u}=T;let e=`CREATE TABLE ${u?`IF NOT EXISTS "${E}"`:`"${E}"`} (
`;if(!A)return e+`  -- columns not provided
);`;const m=A.split(`
`).filter(t=>t.trim());return e+=m.map(t=>`  ${t.trim()}`).join(`,
`),o&&(e+=`,
  PRIMARY KEY (${o})`),R&&R.split(`
`).filter(i=>i.trim()).forEach(i=>{e+=`,
  ${i.trim()}`}),e+=`
)`,s&&s!=="默认"&&(s==="Memory"?e+=" USING MEMORY":s==="Parquet"&&(e+=" USING PARQUET")),e+=";",a&&a.split(`
`).filter(i=>i.trim()).forEach(i=>{e+=`

-- 创建索引
CREATE INDEX ${i.trim()};`}),e},createTableNL(T,l){const{description:E,businessDomain:A,includeSample:o}=T,R=A||"通用";let a=y[R];a||(a={tables:{generic:{columns:[{name:"id",type:"BIGINT",pk:!0},{name:"name",type:"VARCHAR(100)",notNull:!0},{name:"code",type:"VARCHAR(50)",unique:!0},{name:"description",type:"TEXT"},{name:"status",type:"VARCHAR(20)",default:"'active'"},{name:"sort_order",type:"INTEGER",default:"0"},{name:"created_by",type:"BIGINT"},{name:"created_at",type:"TIMESTAMP",default:"CURRENT_TIMESTAMP"},{name:"updated_at",type:"TIMESTAMP",default:"CURRENT_TIMESTAMP"}]}}});let s=`-- =====================================================
-- 自然语言建表方案
-- 业务领域: ${R}
${E?`-- 需求描述: ${E.substring(0,100)}...`:"-- 需求描述: (未提供)"}
-- =====================================================

`;const u=Object.entries(a.tables);return u.forEach(([n,e],m)=>{const t=_(e.columns)?e.columns:[];s+=`-- ${m+1}. ${n}
`,s+=`CREATE TABLE IF NOT EXISTS "${n}" (
`;const i=t.map(r=>{let d=`  ${r.name} ${r.type}`;return r.notNull&&(d+=" NOT NULL"),r.unique&&(d+=" UNIQUE"),r.default&&(d+=` DEFAULT ${r.default}`),r.pk&&(d+=" PRIMARY KEY"),d});s+=i.join(`,
`);const c=t.filter(r=>r.fk);c.length>0&&(s+=`,
`,s+=c.map(r=>`  FOREIGN KEY (${r.name}) REFERENCES ${r.fk}`).join(`,
`)),s+=`
);

`;const p=t.filter(r=>!r.pk&&(r.unique||r.name.includes("_id")||r.name.includes("_name")));p.length>0&&(p.forEach(r=>{const d=`idx_${n}_${r.name}`;s+=`CREATE INDEX IF NOT EXISTS "${d}" ON "${n}" (${r.name});
`}),s+=`
`)}),o&&(s+=`-- =====================================================
-- 示例数据
-- =====================================================

`,u.forEach(([n])=>{if(["users","categories","products"].includes(n)){const e=C(n);e&&(s+=e)}})),s},createTableTemplate(T,l){const{templateType:E,tableName:A,customizeFields:o,addStatus:R,addTimestamps:a}=T,s=N[E]||N.用户表,u=A||s.name;let n=`-- =====================================================
-- 模板建表: ${E}
-- 表名: ${u}
-- =====================================================

`;n+=`CREATE TABLE IF NOT EXISTS "${u}" (
`;let e=s.columns.map(m=>{let t=`  ${m.name} ${m.type}`;return m.notNull&&(t+=" NOT NULL"),m.unique&&(t+=" UNIQUE"),m.default&&(t+=` DEFAULT ${m.default}`),m.pk&&(t+=" PRIMARY KEY"),t});return R&&e.push("  status VARCHAR(20) DEFAULT 'active'"),a&&(e.push("  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),e.push("  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")),o&&o.split(`
`).filter(t=>t.trim()).forEach(t=>{const i=t.match(/^(\w+)\s+(\w+(?:\([^)]+\))?)/);i&&e.push(`  ${i[1]} ${i[2]}`)}),n+=e.join(`,
`),n+=`
);
`,n+=`
-- 索引
`,n+=`CREATE INDEX IF NOT EXISTS "idx_${u}_status" ON "${u}" (status);
`,a&&(n+=`CREATE INDEX IF NOT EXISTS "idx_${u}_created_at" ON "${u}" (created_at);
`),n},createTableImport(T,l){const{importSource:E,importData:A,tableName:o,inferTypes:R}=T;let a=[];try{if(E==="JSON")a=JSON.parse(A);else if(E==="CSV"){const n=A.trim().split(`
`);if(n.length>=2){const e=n[0].split(",").map(m=>m.trim());a=n.slice(1).map(m=>{var c,p,r,d;const t=m.split(","),i={name:((c=t[0])==null?void 0:c.trim())||"column"};return e.includes("type")&&t[e.indexOf("type")]&&(i.type=t[e.indexOf("type")].trim()),e.includes("pk")&&((p=t[e.indexOf("pk")])==null?void 0:p.toLowerCase())==="true"&&(i.pk=!0),e.includes("notNull")&&((r=t[e.indexOf("notNull")])==null?void 0:r.toLowerCase())==="true"&&(i.notNull=!0),e.includes("unique")&&((d=t[e.indexOf("unique")])==null?void 0:d.toLowerCase())==="true"&&(i.unique=!0),e.includes("default")&&t[e.indexOf("default")]&&(i.default=t[e.indexOf("default")].trim()),i})}}else if(E==="剪切板")try{a=JSON.parse(A)}catch{const n=A.trim().split(`
`);n.length>=2&&(a=n.slice(1).map(e=>{var t;return{name:((t=e.split("	")[0])==null?void 0:t.trim())||"column"}}))}if(R){const n={id:"BIGINT",user_id:"BIGINT",order_id:"BIGINT",product_id:"BIGINT",category_id:"BIGINT",amount:"DECIMAL(12,2)",price:"DECIMAL(10,2)",cost:"DECIMAL(10,2)",quantity:"INTEGER",count:"INTEGER",status:"VARCHAR(20)",type:"VARCHAR(30)",name:"VARCHAR(100)",title:"VARCHAR(200)",description:"TEXT",content:"TEXT",email:"VARCHAR(255)",phone:"VARCHAR(20)",address:"VARCHAR(500)",url:"VARCHAR(500)",image:"VARCHAR(500)",avatar:"VARCHAR(500)",remark:"VARCHAR(500)",created_at:"TIMESTAMP",updated_at:"TIMESTAMP",date:"DATE",time:"TIME",datetime:"TIMESTAMP",is_:"BOOLEAN",has_:"BOOLEAN",can_:"BOOLEAN",enable:"BOOLEAN",active:"BOOLEAN"};a=a.map(e=>{var m;if(!e.type){const t=((m=e.name)==null?void 0:m.toLowerCase())||"";for(const[i,c]of Object.entries(n))if(t.includes(i)){e.type=c;break}e.type=e.type||"VARCHAR(255)"}return e})}}catch{return`-- 导入解析失败
-- 请检查导入数据格式是否正确
-- JSON 示例: [{"name": "id", "type": "INTEGER", "pk": true}]
-- CSV 示例: name,type,pk,notNull
--         id,INTEGER,true,false`}let s=`-- =====================================================
-- 导入建表
-- 来源: ${E}
-- 表名: ${o}
-- 列数: ${a.length}
-- =====================================================

`;s+=`CREATE TABLE IF NOT EXISTS "${o}" (
`;const u=a.map(n=>{let e=`  ${n.name} ${n.type||"VARCHAR(255)"}`;return n.notNull&&(e+=" NOT NULL"),n.unique&&(e+=" UNIQUE"),n.default&&(e+=` DEFAULT ${n.default}`),n.pk&&(e+=" PRIMARY KEY"),e});return s+=u.join(`,
`),s+=`
);
`,s},alterTable(T,l){const{alterType:E,columnName:A,columnDefinition:o,constraint:R,ifExists:a}=T,s=l.tableName||"table_name",u=a?"IF EXISTS ":"";let n=`ALTER TABLE ${u}"${s}"
`;switch(E){case"添加列":n+=`  ADD COLUMN ${A} ${o||"VARCHAR(255)"};`;break;case"修改列":n+=`  ALTER COLUMN ${A} SET DATA TYPE ${o||"VARCHAR(255)"};`;break;case"删除列":n+=`  DROP COLUMN ${u}${A};`;break;case"添加约束":n+=`  ADD CONSTRAINT ${R||"constraint_name"};`;break;case"删除约束":n+=`  DROP CONSTRAINT ${u}${R||"constraint_name"};`;break;case"重命名表":n+="  RENAME TO new_table_name;";break}return n},dropTable(T,l){const{tableName:E,mode:A,cascade:o}=T,R=o?" CASCADE":"";return A==="TRUNCATE"?`TRUNCATE TABLE "${E}";`:`${A} "${E}"${R};`},createView(T,l){const{viewName:E,query:A,replace:o,recursive:R}=T;let a="CREATE ";return o&&(a+="OR REPLACE "),R&&(a+="RECURSIVE "),a+=`VIEW "${E}" AS
${A};`,a},createIndex(T,l){const{indexName:E,tableName:A,columns:o,indexType:R,unique:a,ifNotExists:s}=T,u=s?"IF NOT EXISTS ":"",n=a?"UNIQUE ":"",e=R&&R!=="默认"?` USING ${R}`:"";return`CREATE ${n}INDEX ${u}"${E}" ON "${A}"${e} (${o});`},tableDesign(T,l){const{businessObject:E,tables:A,relationships:o,includeSample:R}=T;let a=`-- =====================================================
-- 表结构设计方案
${E?`-- 业务对象: ${E}`:"-- 业务对象: (未提供)"}
-- =====================================================

`;const s=(A||"").split(`
`).filter(t=>t.trim()),u={};s.forEach(t=>{const i=t.match(/^(\w+)\s*-\s*(.+)$/);i&&(u[i[1].trim()]=i[2].trim())});const n=Object.keys(u),e={user:`  id INTEGER PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,order:`  id BIGINT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  order_number VARCHAR(50) UNIQUE,
  total_amount DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  shipping_address VARCHAR(500),
  notes TEXT`,product:`  id INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  category_id INTEGER,
  stock_quantity INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,item:`  id INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  category_id INTEGER,
  stock_quantity INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,category:`  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  parent_id INTEGER,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,payment:`  id BIGINT PRIMARY KEY,
  order_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50),
  transaction_id VARCHAR(100) UNIQUE,
  status VARCHAR(20) DEFAULT 'pending',
  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,transaction:`  id BIGINT PRIMARY KEY,
  order_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50),
  transaction_id VARCHAR(100) UNIQUE,
  status VARCHAR(20) DEFAULT 'pending',
  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,address:`  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  recipient_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  province VARCHAR(50),
  city VARCHAR(50),
  district VARCHAR(50),
  detail_address VARCHAR(500),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`},m=`  id INTEGER PRIMARY KEY,
  name VARCHAR(255),
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`;return n.forEach((t,i)=>{const c=u[t];a+=`-- ${i+1}. ${t} - ${c}
`;const p=t.toLowerCase();let r=m;for(const[d,I]of Object.entries(e))if(p.includes(d)){r=I;break}a+=`CREATE TABLE IF NOT EXISTS "${t}" (
${r}
);

`}),o&&(a+=`-- =====================================================
-- 表关系定义
-- =====================================================

`,o.split(`
`).filter(i=>i.trim()).forEach(i=>{const c=i.match(/(\w+)\s+(\d+)-n\s+(\w+)/);if(c){const[,p,,r]=c;a+=`-- ${p} 1-n ${r}
`,a+=`ALTER TABLE "${r}" ADD FOREIGN KEY (${p}_id) REFERENCES ${p}(id);

`}})),R&&(a+=`-- =====================================================
-- 示例数据
-- =====================================================

`,n.forEach(t=>{t.toLowerCase().includes("user")?a+=`INSERT INTO "${t}" (username, email, password_hash) VALUES
  ('admin', 'admin@example.com', 'hashed_password'),
  ('testuser', 'test@example.com', 'hashed_password');

`:t.toLowerCase().includes("category")&&(a+=`INSERT INTO "${t}" (name, sort_order) VALUES
  ('Electronics', 1),
  ('Clothing', 2),
  ('Books', 3);

`)})),a}};export{f as sqlDdlGenerators};
