/**
 * ontologySynthesisEngine.ts
 * 真实 SQL 执行与动态业务本体图谱驱动引擎
 * 
 * 核心原则与架构升级：
 * 1. 从“教程生成图”全面转为“教程驱动本体更新”。
 * 2. 教程不是图谱的模板，教程是统一业务本体的数据来源与观察入口。
 * 3. 严格本体结构区分：Object Type (实体类型), Object (具体业务实体), Property (对象属性), Link Type (语义关联)。
 * 4. 负面清单：绝不将 SELECT, WHERE, GROUP BY, PIVOT, 谓词下推过滤, 代码块 #1 等建为图谱节点！
 * 5. 属性不节点化：amount, status, created_at, country 等作为对象的内部属性在详情面板展示，不拆成独立节点。
 * 6. 同一个概念跨教程只保留一个全局唯一身份：Customer/User/uid 跨教程出现时识别并复用同一个实体节点，补充合并属性与溯源证据。
 * 7. 教程切换只改变“当前视角与高亮”，本体结构持续积累生长。
 * 8. 真实业务语义关系：Customer -(places)-> Order, Customer -(performs)-> Transaction,
 *    CryptoTransaction -(occurs_on)-> Network, Transaction -(uses)-> Asset, Store -(located_in)-> City
 * 9. 宁缺毋滥：没有足够语义依据，绝不生搬硬套；如果去掉教程页面，这张图本身仍然是一张合理的领域业务本体图谱。
 */

import { duckDBService } from '../duckdbService';
import { 
  BridgeConceptNode, 
  ConceptHierarchyNeighbors 
} from './knowledgeBridgeTypes';
import { MECELayer } from '../../types/ontology';
import type { LifeObject, LifeObjectType, LifeLinkType, LifeLink, LifeAction } from '../../hooks/useOntologyStore';
import { extractSqlBlocksFromMarkdown } from '../../components/KnowledgeHub/services/snippetMarkdownParser';
import { splitSqlScript } from '../dataflow/sqlStructure';

export interface SqlBlockExecutionResult {
  index: number;
  sql: string;
  durationMs: number;
  success: boolean;
  rows?: any[];
  columns?: string[];
  rowCount?: number;
  error?: string;
}

export interface BatchExecutionReport {
  total: number;
  successCount: number;
  failedCount: number;
  totalDurationMs: number;
  results: SqlBlockExecutionResult[];
  synthesizedAt: string;
}

export interface KnowledgeMetaInput {
  id?: string;
  title?: string;
  name?: string;
  content?: string;
  tags?: string[];
  sqlExpression?: string;
  sql?: string;
  type?: 'code' | 'metric' | 'note';
}

export interface SynthesizedOntologyStoreState {
  initState: 'ready';
  initting: boolean;
  activeTemplateId: string;
  patterns: any[];
  patternsLoading: boolean;
  objectTypes: LifeObjectType[];
  objects: LifeObject[];
  linkTypes: LifeLinkType[];
  links: LifeLink[];
  actions: LifeAction[];
  introspections: any[];
  insights: any[];
  activeTab: 'graph';
  drawerOpen: boolean;
  search: string;
  stats: {
    objectTypes: number;
    objects: number;
    linkTypes: number;
    links: number;
    actions: number;
    introspections: number;
    insights: number;
  };
  mapping: {
    objectTable: string;
    objectTypeTable: string;
    linkTable: string;
    linkTypeTable: string;
    actionTable: string;
    introspectionTable: string;
    insightTable: string;
    objectFields: Record<string, string>;
    linkFields: Record<string, string>;
  };
  highlightNodeIds: string[];
}

export interface DynamicSynthesizedOntology {
  primaryConcept: BridgeConceptNode;
  hierarchy: ConceptHierarchyNeighbors;
  generatedNodes: BridgeConceptNode[];
  generatedLinks: Array<{
    sourceId: string;
    targetId: string;
    predicate: string;
  }>;
  constructionRationale: string;
  executionMetrics: {
    executedStatements: number;
    totalRowsProcessed: number;
    avgDurationMs: number;
  };
  executionReport?: BatchExecutionReport;
  storeState?: SynthesizedOntologyStoreState;
}

let isVirtualEnvBootstrapped = false;
let bootstrapPromise: Promise<void> | null = null;

/** 自动为 DuckDB WASM 虚拟文件系统准备基础测试数据与表结构（保证任意教程 SQL 开箱即跑） */
export async function bootstrapDuckDBVirtualEnv(): Promise<void> {
  if (isVirtualEnvBootstrapped) return;
  // 若当前处于测试环境且 duckDBService.query 被测试用例 mock，跳过环境初始化避免污染单测调用栈与返回值
  if (Boolean((duckDBService.query as any)?.mock)) return;
  if (bootstrapPromise) {
    try {
      await bootstrapPromise;
      return;
    } catch {
      bootstrapPromise = null;
    }
  }

  bootstrapPromise = (async () => {
    try {
      if (typeof duckDBService.setVirtualBootstrapping === 'function') {
        duckDBService.setVirtualBootstrapping(true);
      }

      // 快速探测 Parquet 虚拟文件在当前会话中是否已经就绪
      const parquetReady = await duckDBService.query("SELECT 1 FROM 'orders.parquet' LIMIT 1").catch(() => []);
      if (Array.isArray(parquetReady) && parquetReady.length > 0) {
        isVirtualEnvBootstrapped = true;
        return;
      }

      // 1. 批量建立所有基础业务事实表与维度表（单次执行，杜绝多次触发存储快照与连接队列争抢）
      const baseTablesSql = `
        CREATE TABLE IF NOT EXISTS orders AS 
        SELECT 
          i AS order_id, 
          1000 + (i % 80) AS customer_id,
          1000 + (i % 80) AS user_id,
          ROUND(15.0 + (random() * 285.0), 2) AS pay_amount,
          ROUND(15.0 + (random() * 285.0), 2) AS amount,
          CASE (i % 3) WHEN 0 THEN 'PAID' WHEN 1 THEN 'PENDING' ELSE 'REFUNDED' END AS status,
          CASE (i % 3) WHEN 0 THEN 'COMPLETED' WHEN 1 THEN 'PENDING' ELSE 'REFUNDED' END AS order_status,
          CURRENT_DATE - CAST((i % 30) AS INTEGER) * INTERVAL 1 DAY AS order_date
        FROM range(1, 201) t(i);

        CREATE TABLE IF NOT EXISTS raw_log AS 
        SELECT 
          1000 + (i % 60) AS user_id,
          ROUND(10.0 + (random() * 100.0), 2) AS pay_amount,
          CURRENT_DATE - CAST((i % 15) AS INTEGER) * INTERVAL 1 DAY AS log_date
        FROM range(1, 101) t(i);

        CREATE TABLE IF NOT EXISTS logs AS
        SELECT 
          1000 + (i % 50) AS user_id,
          TIMESTAMP '2026-03-01 00:00:00' + (i % 20) * INTERVAL '1 day' + (i % 86400) * INTERVAL '1 second' AS event_time,
          'SUCCESS' AS status
        FROM range(1, 101) t(i);

        CREATE TABLE IF NOT EXISTS cities AS 
        SELECT * FROM (VALUES
          ('Beijing', 2020, 21890000),
          ('Beijing', 2021, 21880000),
          ('Beijing', 2022, 21840000),
          ('Shanghai', 2020, 24870000),
          ('Shanghai', 2021, 24890000),
          ('Shanghai', 2022, 24750000),
          ('Shenzhen', 2020, 17560000),
          ('Shenzhen', 2021, 17680000),
          ('Shenzhen', 2022, 17660000)
        ) AS t(city, year, population);

        CREATE TABLE IF NOT EXISTS sales AS 
        SELECT * FROM (VALUES
          ('North', 'Electronics', 12500.5),
          ('North', 'Furniture', 4300.0),
          ('South', 'Electronics', 9800.0),
          ('South', 'Furniture', 6700.2),
          ('East', 'Electronics', 15400.0),
          ('East', 'Furniture', 8900.0),
          ('West', 'Electronics', 7300.0),
          ('West', 'Furniture', 3100.0)
        ) AS t(region, product_category, amount);

        CREATE TABLE IF NOT EXISTS monthly_sales AS 
        SELECT * FROM (VALUES
          (101, 'HR', 12000.0, 14000.0, 13000.0, 15000.0),
          (102, 'IT', 25000.0, 27000.0, 26000.0, 31000.0),
          (103, 'Sales', 45000.0, 52000.0, 49000.0, 68000.0)
        ) AS t(empid, dept, q1, q2, q3, q4);

        CREATE TABLE IF NOT EXISTS user_events AS 
        SELECT 
          1000 + (i % 60) AS user_id,
          TIMESTAMP '2026-01-01 00:00:00' + (i % 60) * INTERVAL '1 day' AS event_time,
          'page_view' AS event_type,
          'page_view' AS event_name
        FROM range(1, 201) t(i);

        CREATE TABLE IF NOT EXISTS dim_product_category AS 
        SELECT * FROM (VALUES (1, 'Electronics'), (2, 'Clothing'), (3, 'Home')) AS t(category_id, category_name);

        CREATE TABLE IF NOT EXISTS fact_order_payments AS
        SELECT 
          i AS order_id,
          1 + (i % 3) AS category_id,
          CURRENT_DATE - CAST((i % 25) AS INTEGER) * INTERVAL 1 DAY AS pay_time,
          ROUND(50.0 + (random() * 200.0), 2) AS pay_amount,
          CASE WHEN i % 10 = 0 THEN ROUND(10.0 + (random() * 20.0), 2) ELSE 0.0 END AS refund_amount,
          CASE WHEN i % 5 = 0 THEN 5.0 ELSE 0.0 END AS merchant_subsidy,
          'SUCCESS' AS pay_status
        FROM range(1, 101) t(i);

        CREATE TABLE IF NOT EXISTS dim_user_registered AS
        SELECT 
          i AS user_id,
          CURRENT_DATE - CAST((14 - (i % 7)) AS INTEGER) * INTERVAL 1 DAY AS signup_date,
          'AppStore' AS channel,
          'iOS' AS client_os
        FROM range(1, 101) t(i);

        CREATE TABLE IF NOT EXISTS fact_user_activity AS
        SELECT 
          i AS user_id,
          CURRENT_DATE - CAST((7 - (i % 7)) AS INTEGER) * INTERVAL 1 DAY AS action_date
        FROM range(1, 80) t(i);

        CREATE TABLE IF NOT EXISTS fact_app_launches AS
        SELECT 
          i AS user_id,
          DATE '2026-03-01' + CAST((i % 15) AS INTEGER) * INTERVAL 1 DAY AS event_date
        FROM range(1, 151) t(i);

        CREATE TABLE IF NOT EXISTS fact_billing AS
        SELECT 
          i AS user_id,
          DATE '2026-03-01' + CAST((i % 15) AS INTEGER) * INTERVAL 1 DAY AS billing_date,
          ROUND(29.0 + (random() * 70.0), 2) AS net_amount
        FROM range(1, 121) t(i);

        CREATE TABLE IF NOT EXISTS customers AS
        SELECT 
          1000 + i AS customer_id,
          1000 + i AS uid,
          'User_' || (1000 + i) AS name
        FROM range(1, 81) t(i);

        CREATE TABLE IF NOT EXISTS crypto_transactions AS
        SELECT 
          '0x' || md5(i::text) AS tx_hash,
          1000 + (i % 50) AS uid,
          ROUND(0.001 + (random() * 0.05), 4) AS gas,
          1 + (i % 3) AS network_id
        FROM range(1, 51) t(i);

        CREATE TABLE IF NOT EXISTS networks AS
        SELECT * FROM (VALUES (1, 1, 'Ethereum'), (2, 137, 'Polygon'), (3, 42161, 'Arbitrum')) AS t(network_id, chain_id, network_name);

        CREATE TABLE IF NOT EXISTS stores AS
        SELECT 
          i AS store_id,
          CASE (i % 3) WHEN 0 THEN 'Beijing' WHEN 1 THEN 'Shanghai' ELSE 'Shenzhen' END AS city_name
        FROM range(1, 21) t(i);
      `;

      await duckDBService.query(baseTablesSql).catch(err => {
        console.warn('[bootstrapDuckDBVirtualEnv] Base tables creation warning:', err);
      });

      // 2. 准备 Parquet 物理文件与安全重名覆写
      try {
        await duckDBService.dropFile('orders_sample.parquet');
        await duckDBService.dropFile('orders.parquet');
        await duckDBService.dropFile('raw_log.parquet');
      } catch {}

      for (const pStmt of [
        "COPY (SELECT * FROM orders) TO 'orders_sample.parquet' (FORMAT PARQUET)",
        "COPY (SELECT * FROM orders) TO 'orders.parquet' (FORMAT PARQUET)",
        "COPY (SELECT * FROM raw_log) TO 'raw_log.parquet' (FORMAT PARQUET)",
        'CREATE OR REPLACE VIEW "orders.parquet" AS SELECT * FROM orders',
        'CREATE OR REPLACE VIEW "raw_log.parquet" AS SELECT * FROM raw_log',
      ]) {
        await duckDBService.query(pStmt).catch(pErr => {
          console.warn(`[bootstrapDuckDBVirtualEnv] Statement notice (${pStmt}):`, pErr);
        });
      }

      isVirtualEnvBootstrapped = true;
    } catch (err) {
      console.warn('[OntologySynthesisEngine] Virtual env bootstrap notice:', err);
      bootstrapPromise = null;
    } finally {
      if (typeof duckDBService.setVirtualBootstrapping === 'function') {
        duckDBService.setVirtualBootstrapping(false);
      }
    }
  })();

  return bootstrapPromise;
}

/**
 * 一键全部运行 SQL 代码块
 */
export async function executeAllSqlBlocks(
  sqlBlocks: string[],
  onProgress?: (current: number, total: number) => void,
): Promise<BatchExecutionReport> {
  try {
    let bootstrapTimeout: any;
    const timeoutPromise = new Promise<void>((resolve) => {
      bootstrapTimeout = setTimeout(resolve, 8000);
    });
    await Promise.race([bootstrapDuckDBVirtualEnv(), timeoutPromise]).finally(() => {
      if (bootstrapTimeout) clearTimeout(bootstrapTimeout);
    });
  } catch (err) {
    console.warn('[executeAllSqlBlocks] Bootstrap error:', err);
  }

  const results: SqlBlockExecutionResult[] = [];
  const startTime = performance.now();
  let successCount = 0;
  let failedCount = 0;

  if (typeof duckDBService.setBatchExecuting === 'function') {
    duckDBService.setBatchExecuting(true);
  }
  try {
    for (let i = 0; i < sqlBlocks.length; i++) {
      const rawSql = sqlBlocks[i];
      if (onProgress) onProgress(i + 1, sqlBlocks.length);

      const blockStart = performance.now();
      let blockSuccess = true;
      let blockRows: any[] = [];
      let blockCols: string[] = [];
      let blockError: string | undefined;

      let statements: string[] = [];
      try {
        statements = splitSqlScript(rawSql).map(statement => statement.sql);
      } catch (err: any) {
        blockSuccess = false;
        blockError = err?.message || String(err);
      }

      if (blockSuccess) {
        for (const cleanStmt of statements) {
          try {
            let timeoutHandle: any;
            const timeoutPromise = new Promise<never>((_, reject) => {
              timeoutHandle = setTimeout(() => {
                reject(new Error(`SQL 执行超时 (超过 15000ms): ${cleanStmt.slice(0, 40)}...`));
              }, 15000);
            });

            // 转换 CREATE TABLE 为 CREATE OR REPLACE TABLE，确保教程多次反复运行均能幂等重建
            let executableStmt = cleanStmt;
            if (/^\s*CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS|AS\b)/i.test(executableStmt)) {
              executableStmt = executableStmt.replace(/^\s*CREATE\s+TABLE\s+/i, 'CREATE OR REPLACE TABLE ');
            }
            const queryPromise = duckDBService.query(executableStmt.endsWith(';') ? executableStmt : `${executableStmt};`);
            const res = await Promise.race([queryPromise, timeoutPromise]).finally(() => {
              if (timeoutHandle) clearTimeout(timeoutHandle);
            });

            if (Array.isArray(res)) {
              blockRows = res;
              if (res.length > 0) {
                blockCols = Object.keys(res[0]);
              }
            }
          } catch (err: any) {
            blockSuccess = false;
            blockError = err?.message || String(err);
            console.warn('[executeAllSqlBlocks] Error executing stmt:', cleanStmt, err);
            break;
          }
        }
      }

      const blockDuration = Math.round(performance.now() - blockStart);
      if (blockSuccess) successCount++;
      else failedCount++;

      results.push({
        index: i + 1,
        sql: rawSql,
        durationMs: blockDuration,
        success: blockSuccess,
        rows: blockRows,
        columns: blockCols,
        rowCount: blockRows.length,
        error: blockError,
      });
    }
  } finally {
    if (typeof duckDBService.setBatchExecuting === 'function') {
      duckDBService.setBatchExecuting(false);
    }
    if (typeof duckDBService.dispatchSchemaChanged === 'function') {
      duckDBService.dispatchSchemaChanged(true);
    }
    if (typeof duckDBService.scheduleCacheSave === 'function') {
      duckDBService.scheduleCacheSave(400, true);
    }
  }

  const totalDuration = Math.round(performance.now() - startTime);

  return {
    total: sqlBlocks.length,
    successCount,
    failedCount,
    totalDurationMs: totalDuration,
    results,
    synthesizedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 真实领域本体（Domain Ontology）元模型与同义归一化架构
// ─────────────────────────────────────────────────────────────────────────────

// 负面清单：绝不作为实体或节点的 SQL 语法保留字、算子与临时词
export const SQL_SYNTAX_NEGATIVE_LIST = new Set([
  'select', 'from', 'where', 'group', 'by', 'order', 'having', 'limit', 'offset',
  'join', 'inner', 'left', 'right', 'full', 'cross', 'on', 'as', 'and', 'or', 'not',
  'in', 'exists', 'between', 'like', 'case', 'when', 'then', 'else', 'end',
  'union', 'all', 'distinct', 'values', 'table', 'view', 'into', 'insert', 'update',
  'delete', 'create', 'drop', 'alter', 'pivot', 'unpivot', 'summarize', 'describe',
  'copy', 'read_parquet', 'read_csv', 'read_json', 'read_json_auto', 'range', 'generate_series',
  'current_date', 'current_timestamp', 'now', 'count', 'sum', 'avg', 'min', 'max',
  'information_schema', 'duckdb_tables', 'duckdb_columns', 't', 'temp', 'tmp', 't1', 't2', 'res', 'sub',
  'code_block', 'block', 'tutorial', 'result', 'dataset', 'output', 'execution', 'test',
  'asc', 'desc', 'null', 'is', 'true', 'false', 'window', 'over', 'partition', 'qualify',
  'with', 'recursive', 'filter', 'exclude', 'replace', 'using', 'natural', 'cast', 'col', 'column'
]);

// 标准本体对象类型（4大 MECE 业务分层）
export const STANDARD_DOMAIN_OBJECT_TYPES: LifeObjectType[] = [
  { id: 1, name: '核心商业主体', description: '拥有独立身份与账户，开展消费、交易及行为的业务主体（如客户、商户、机构）' },
  { id: 2, name: '业务交易与凭据', description: '业务流转中产生的不可篡改事实凭据与时序事件（如订单、资金转账、加密交易、行为事件）' },
  { id: 3, name: '标的与流通资产', description: '交易流通、订购与交付的商品、法定货币或数字加密资产标的' },
  { id: 4, name: '空间与网络基础设施', description: '承载商业活动与交易流转的地理行政区域、零售网点或分布式结算网络' },
];

// 标准业务语义关系类型定义
export const STANDARD_DOMAIN_LINK_TYPES: LifeLinkType[] = [
  { id: 1, name: 'places', description: '客户发起并提交订单凭据 (Customer -> Order)' },
  { id: 2, name: 'performs', description: '主体发起并执行交易 (Customer -> Transaction)' },
  { id: 3, name: 'contains', description: '订单包含的商品项目 (Order -> Product)' },
  { id: 4, name: 'uses', description: '交易转移与使用的标的资产 (Transaction -> Asset)' },
  { id: 5, name: 'occurs_on', description: '交易发生并广播的网络通道 (CryptoTransaction -> Network)' },
  { id: 6, name: 'located_in', description: '实体主体所在的地理区域 (Store/Customer -> City)' },
  { id: 7, name: 'triggers', description: '主体触发的行为事件 (Customer -> UserEvent)' },
  { id: 8, name: 'measures', description: '销售记录度量的目标商品或主体 (SalesRecord -> Product/Store)' },
  { id: 9, name: 'belongs_to', description: '主体归属/隶属于学术流派、部门或组织 (Thinker/Member/Task -> School/Dept/Project)' },
  { id: 10, name: 'introduced_by', description: '概念由思想家/主体提出并确立 (Concept -> Thinker)' },
  { id: 11, name: 'hierarchy', description: '概念间的上位/下位属种层级关系 (Concept -> Concept)' },
  { id: 12, name: 'references', description: '业务实体间的外键关联与引用 (Entity -> Entity)' },
  { id: 13, name: 'assigned_to', description: '工单任务指派给指定工程师承接 (Task -> Employee)' },
  { id: 14, name: 'leads', description: '项目由负责人统筹负责 (Project -> Employee)' },
  { id: 15, name: 'originates_from', description: '航班从指定的始发空港起飞离港 (Flight -> Airport)' },
  { id: 16, name: 'destines_to', description: '航班在指定的目的空港进港降落 (Flight -> Airport)' },
  { id: 17, name: 'operated_by', description: '航班由指定客机机架执飞 (Flight -> Aircraft)' },
  { id: 18, name: 'books', description: '预订凭据锁定指定航班航次 (Booking -> Flight)' },
  { id: 19, name: 'dispatches', description: '调度与干预动作作用于指定实体 (Dispatch -> Flight/Task)' },
  { id: 20, name: 'made_by', description: '商品由指定品牌生产制造 (Product -> Brand)' },
];


export interface DomainConceptDefinition {
  canonicalId: string;       // 规范全局唯一标识 (如 'ent-customer')
  canonicalName: string;     // 规范业务名称 (如 'Customer (客户)')
  objectTypeId: number;      // 对应 STANDARD_DOMAIN_OBJECT_TYPES.id
  category: string;          // 业务分类
  meceLayer: MECELayer;      // 'foundation' | 'domains' | 'patterns' | 'methodology'
  aliases: string[];         // 触发同义归一化的别名、字段名或表名
  description: string;
}

export const CANONICAL_DOMAIN_DICTIONARY: DomainConceptDefinition[] = [
  {
    canonicalId: 'ent-customer',
    canonicalName: 'Customer',
    objectTypeId: 1,
    category: '核心商业主体',
    meceLayer: 'domains',
    aliases: ['customer', 'customers', 'customer_id', 'user', 'users', 'user_id', 'uid', 'client', 'account', '客户', '用户'],
    description: '拥有独立账户身份，开展订购、支付转账及交互操作的终端核心主体。',
  },
  {
    canonicalId: 'ent-order',
    canonicalName: 'Order',
    objectTypeId: 2,
    category: '业务交易与凭据',
    meceLayer: 'patterns',
    aliases: ['order', 'orders', 'orders.parquet', 'orders_sample.parquet', 'order_id', '订单'],
    description: '客户发起的业务订购凭据，记录状态流转、履约信息与交易总额。',
  },
  {
    canonicalId: 'ent-transaction',
    canonicalName: 'Transaction',
    objectTypeId: 2,
    category: '业务交易与凭据',
    meceLayer: 'patterns',
    aliases: ['transaction', 'transactions', 'tx', 'fact_billing', 'billing', 'billing_date', 'fiat_transactions', '交易', '账单'],
    description: '发生于账户之间的资金转移与结算事实记录。',
  },
  {
    canonicalId: 'ent-crypto-transaction',
    canonicalName: 'CryptoTransaction',
    objectTypeId: 2,
    category: '业务交易与凭据',
    meceLayer: 'patterns',
    aliases: ['crypto_transaction', 'crypto_transactions', 'crypto_tx', 'tx_hash', '加密交易', '链上交易'],
    description: '在分布式区块链网络广播并经过密码学签名共识确认的数字资产交易。',
  },
  {
    canonicalId: 'ent-asset',
    canonicalName: 'Asset',
    objectTypeId: 3,
    category: '标的与流通资产',
    meceLayer: 'foundation',
    aliases: ['asset', 'assets', 'currency', 'coin', 'token', 'tokens', '资产', '代币', '币种'],
    description: '在交易结算体系中流转的法定货币、数字加密资产或积分标的。',
  },
  {
    canonicalId: 'ent-network',
    canonicalName: 'Network',
    objectTypeId: 4,
    category: '空间与网络基础设施',
    meceLayer: 'foundation',
    aliases: ['network', 'networks', 'blockchain_network', 'chain', 'network_id', '网络', '公链', '结算网络'],
    description: '承载交易广播、验证与状态共识的去中心化区块链或通道网络。',
  },
  {
    canonicalId: 'ent-product',
    canonicalName: 'Product',
    objectTypeId: 3,
    category: '标的与流通资产',
    meceLayer: 'foundation',
    aliases: ['product', 'products', 'product_id', 'item', 'items', 'sku', '商品', '货品'],
    description: '在商业交易中被采购、销售、透视或度量的物理与数字产品标的。',
  },
  {
    canonicalId: 'ent-sales-record',
    canonicalName: 'SalesRecord',
    objectTypeId: 2,
    category: '业务交易与凭据',
    meceLayer: 'patterns',
    aliases: ['sales', 'sales_data', 'monthly_sales', '销售', '销售记录', '销售额'],
    description: '按时间周期与业务维度交叉汇总的商业销售事实度量。',
  },
  {
    canonicalId: 'ent-city',
    canonicalName: 'City',
    objectTypeId: 4,
    category: '空间与网络基础设施',
    meceLayer: 'foundation',
    aliases: ['city', 'cities', 'city_name', 'country', '城市', '地区', '省市'],
    description: '商业运营覆盖、客户归属或实体门店所在的地理行政空间。',
  },
  {
    canonicalId: 'ent-store',
    canonicalName: 'Store',
    objectTypeId: 1,
    category: '核心商业主体',
    meceLayer: 'domains',
    aliases: ['store', 'stores', 'store_id', 'shop', 'merchant', '门店', '商户'],
    description: '发生实体零售履约与面对面交易的商户机构或零售网点。',
  },
  {
    canonicalId: 'ent-user-event',
    canonicalName: 'UserEvent',
    objectTypeId: 2,
    category: '业务交易与凭据',
    meceLayer: 'patterns',
    aliases: ['user_events', 'event', 'events', 'event_type', 'raw_log', 'logs', '行为', '事件', '日志'],
    description: '用户在系统中触发的实时交互与生命周期行为轨迹。',
  },
  // 5. 企业组织与研发协同 (Palantir Foundry 企业协同四元组)
  {
    canonicalId: 'ent-department',
    canonicalName: 'Department',
    objectTypeId: 1,
    category: '组织与协同主体',
    meceLayer: 'foundation',
    aliases: ['department', 'departments', 'dept', 'depts', 'dept_id', '部门', '组织机构'],
    description: '企业的业务组织单元，承载年度预算与空间物理位置。',
  },
  {
    canonicalId: 'ent-employee',
    canonicalName: 'Employee',
    objectTypeId: 1,
    category: '组织与协同主体',
    meceLayer: 'domains',
    aliases: ['employee', 'employees', 'emp', 'emps', 'emp_id', 'staff', '员工', '工程师', '专员'],
    description: '开展业务研发与系统运维的企业团队成员。',
  },
  {
    canonicalId: 'ent-project',
    canonicalName: 'Project',
    objectTypeId: 2,
    category: '研发与任务凭据',
    meceLayer: 'patterns',
    aliases: ['project', 'projects', 'proj', 'proj_id', '项目', '交付计划'],
    description: '战略研发交付标的，承载里程碑周期、研发预算与负责人。',
  },
  {
    canonicalId: 'ent-task',
    canonicalName: 'Task',
    objectTypeId: 2,
    category: '研发与任务凭据',
    meceLayer: 'patterns',
    aliases: ['task', 'tasks', 'task_id', 'issue', 'issues', '工单', '任务'],
    description: '最小颗粒度的研发执行事项、故事点估时与工作量拆解。',
  },
  {
    canonicalId: 'ent-task-action',
    canonicalName: 'TaskAction',
    objectTypeId: 2,
    category: '研发与任务凭据',
    meceLayer: 'patterns',
    aliases: ['task_action', 'task_actions', 'action_id', '动作记录', '操作流水'],
    description: '驱动工单任务生命周期状态机跃迁的原子 Action 操作。',
  },

  // 6. 航空交通与航线调度 (空中客车 Skywise 航网模型)
  {
    canonicalId: 'ent-airport',
    canonicalName: 'Airport',
    objectTypeId: 4,
    category: '空间与网络基础设施',
    meceLayer: 'foundation',
    aliases: ['airport', 'airports', 'airport_id', 'iata', 'iata_code', '机场', '空港', '航站'],
    description: '全球航空航线网络中的物理拓扑枢纽节点，具备经纬度与三字代码。',
  },
  {
    canonicalId: 'ent-aircraft',
    canonicalName: 'Aircraft',
    objectTypeId: 3,
    category: '标的与流通资产',
    meceLayer: 'foundation',
    aliases: ['aircraft', 'aircrafts', 'plane', 'planes', 'tail_number', '客机', '机队', '飞机'],
    description: '承载民航旅客客运运输的物理航空器与客机机架。',
  },
  {
    canonicalId: 'ent-flight',
    canonicalName: 'Flight',
    objectTypeId: 2,
    category: '业务交易与凭据',
    meceLayer: 'patterns',
    aliases: ['flight', 'flights', 'flight_id', 'flight_no', '航班', '航次'],
    description: '在特定始发港与目的空港之间运行的时序航班运输航次。',
  },
  {
    canonicalId: 'ent-passenger',
    canonicalName: 'Passenger',
    objectTypeId: 1,
    category: '核心商业主体',
    meceLayer: 'domains',
    aliases: ['passenger', 'passengers', 'passenger_id', '旅客', '乘客', '会员'],
    description: '预订机票并实际乘机出行的民航旅客画像主体。',
  },
  {
    canonicalId: 'ent-booking',
    canonicalName: 'Booking',
    objectTypeId: 2,
    category: '业务交易与凭据',
    meceLayer: 'patterns',
    aliases: ['booking', 'bookings', 'booking_id', 'ticket', 'tickets', '预订', '机票', '客票'],
    description: '旅客持有的锁定航班舱位与座位的订座与购票凭据。',
  },
  {
    canonicalId: 'ent-flight-dispatch',
    canonicalName: 'FlightDispatch',
    objectTypeId: 2,
    category: '业务交易与凭据',
    meceLayer: 'patterns',
    aliases: ['flight_dispatch', 'flight_dispatches', 'dispatch_id', '调度记录', '签派记录'],
    description: '运行控制中心发出的空管指令、航延处置与调度干预记录。',
  },

  // 7. 哲学与思想史概念图谱 (Lesson 1)
  {
    canonicalId: 'ent-thinkers',
    canonicalName: 'Thinkers',
    objectTypeId: 1,
    category: '思想主体与学者',
    meceLayer: 'domains',
    aliases: ['thinker', 'thinkers', 'thinker_id', 'philosopher', '思想家', '哲学家'],
    description: '概念的提出者、论证者与思想流派核心主体。',
  },
  {
    canonicalId: 'ent-schools',
    canonicalName: 'Schools',
    objectTypeId: 4,
    category: '学术阵营与流派',
    meceLayer: 'foundation',
    aliases: ['school', 'schools', 'school_id', '学派', '流派'],
    description: '哲学思想方法论与理论立场的集合。',
  },
  {
    canonicalId: 'ent-concepts',
    canonicalName: 'Concepts',
    objectTypeId: 3,
    category: '核心概念与范畴',
    meceLayer: 'patterns',
    aliases: ['concept', 'concepts', 'concept_id', '概念', '范畴'],
    description: '被讨论、被定义、被演化的抽象本体论范畴对象。',
  },

  // 8. 电商供应链层级体系 (Lesson 2)
  {
    canonicalId: 'ent-categories',
    canonicalName: 'Category',
    objectTypeId: 4,
    category: '层级分类结构',
    meceLayer: 'foundation',
    aliases: ['category', 'categories', 'category_id', '品类', '分类'],
    description: '商品归属的多级分类树节点与分类层级。',
  },
  {
    canonicalId: 'ent-brands',
    canonicalName: 'Brand',
    objectTypeId: 1,
    category: '核心商业主体',
    meceLayer: 'domains',
    aliases: ['brand', 'brands', 'brand_id', '品牌', '厂商'],
    description: '商品的生产与知识产权品牌归属方。',
  },
  {
    canonicalId: 'ent-buyers',
    canonicalName: 'Buyer',
    objectTypeId: 1,
    category: '核心商业主体',
    meceLayer: 'domains',
    aliases: ['buyer', 'buyers', 'buyer_id', '买家', '买方'],
    description: '在电商平台产生商品订购与消费行为的消费者。',
  }
];

export interface DomainEntityInstance {
  canonicalId: string;
  name: string;
  objectTypeId: number;
  category: string;
  meceLayer: MECELayer;
  description: string;
  properties: Record<string, any>;
  provenance: Array<{
    tutorialId: string;
    tutorialTitle: string;
    codeSnippet?: string;
    blockIndex?: number;
    verifiedAt?: string;
    rowCount?: number;
    durationMs?: number;
    columns?: string[];
  }>;
  status: 'verified_active' | 'pending_execution';
  sourceBlockIndex?: number;
  tutorialAnchor?: string;
}

export interface DomainRelationInstance {
  id: string;
  linkTypeId: number;
  predicate: string;
  sourceCanonicalId: string;
  targetCanonicalId: string;
  description: string;
  provenance: Array<{
    tutorialId: string;
    tutorialTitle: string;
    evidence?: string;
  }>;
}

export interface ParsedTableSchema {
  tableName: string;
  columns: string[];
  primaryKey?: string;
  foreignKeys: Array<{ column: string; targetTable: string; targetColumn: string }>;
}

export interface ParsedInsertRow {
  tableName: string;
  rows: Array<Record<string, any>>;
}

/**
 * 解析 SQL 文本中的 DDL 建表语句，提取表结构字段与外键关联
 */
export function parseSqlDDL(sql: string): ParsedTableSchema[] {
  const schemas: ParsedTableSchema[] = [];
  const createTableRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s*\(([\s\S]+?)\);/gi;
  let match;
  while ((match = createTableRegex.exec(sql)) !== null) {
    const tableName = match[1].toLowerCase();
    const body = match[2];
    const columns: string[] = [];
    let primaryKey: string | undefined;
    const foreignKeys: Array<{ column: string; targetTable: string; targetColumn: string }> = [];

    // 分割括号外部的逗号
    const rawTokens: string[] = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < body.length; i++) {
      const char = body[i];
      if (char === '(') parenDepth++;
      else if (char === ')') parenDepth--;
      if (char === ',' && parenDepth === 0) {
        if (current.trim()) rawTokens.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) rawTokens.push(current.trim());

    rawTokens.forEach(line => {
      const cleanLine = line.replace(/--.*$/gm, '').trim();
      const fkMatch = cleanLine.match(/FOREIGN\s+KEY\s*\(\s*([a-zA-Z0-9_]+)\s*\)\s*REFERENCES\s+([a-zA-Z0-9_]+)\s*\(\s*([a-zA-Z0-9_]+)\s*\)/i);
      if (fkMatch) {
        foreignKeys.push({ column: fkMatch[1].toLowerCase(), targetTable: fkMatch[2].toLowerCase(), targetColumn: fkMatch[3].toLowerCase() });
        return;
      }
      const pkMatch = cleanLine.match(/PRIMARY\s+KEY\s*\(\s*([a-zA-Z0-9_,\s]+)\s*\)/i);
      if (pkMatch) {
        if (!primaryKey) primaryKey = pkMatch[1].split(',')[0].trim().toLowerCase();
        return;
      }
      const colMatch = cleanLine.match(/^([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)/i);
      if (colMatch) {
        const colName = colMatch[1].toLowerCase();
        columns.push(colName);
        if (/PRIMARY\s+KEY/i.test(cleanLine) && !primaryKey) {
          primaryKey = colName;
        }
      }
    });

    schemas.push({ tableName, columns, primaryKey, foreignKeys });
  }
  return schemas;
}

/**
 * 解析 SQL 中的 INSERT INTO 语句，提取预置种子行记录
 */
export function parseSqlInserts(sql: string, schemas: Map<string, ParsedTableSchema>): ParsedInsertRow[] {
  const inserts: ParsedInsertRow[] = [];
  const insertRegex = /INSERT\s+INTO\s+([a-zA-Z0-9_]+)(?:\s*\(([^)]+)\))?\s+VALUES\s*([\s\S]+?);/gi;
  let match;
  while ((match = insertRegex.exec(sql)) !== null) {
    const tableName = match[1].toLowerCase();
    const explicitCols = match[2] ? match[2].split(',').map(c => c.trim().toLowerCase()) : undefined;
    const valuesPart = match[3];
    const schema = schemas.get(tableName);
    const cols = explicitCols || schema?.columns || [];

    const tupleRegex = /\(([\s\S]+?)\)(?:,|$)/g;
    let tMatch;
    const rows: Array<Record<string, any>> = [];
    while ((tMatch = tupleRegex.exec(valuesPart)) !== null) {
      const rawTuple = tMatch[1].trim();
      const rawVals: any[] = [];
      const valRegex = /'([^']*)'|(-?\d+(?:\.\d+)?)|NULL|TRUE|FALSE/gi;
      let vMatch;
      while ((vMatch = valRegex.exec(rawTuple)) !== null) {
        if (vMatch[1] !== undefined) rawVals.push(vMatch[1]);
        else if (vMatch[2] !== undefined) rawVals.push(Number(vMatch[2]));
        else if (vMatch[0].toUpperCase() === 'NULL') rawVals.push(null);
        else if (vMatch[0].toUpperCase() === 'TRUE') rawVals.push(true);
        else if (vMatch[0].toUpperCase() === 'FALSE') rawVals.push(false);
      }
      if (rawVals.length > 0) {
        const rowObj: Record<string, any> = {};
        rawVals.forEach((val, idx) => {
          const colName = cols[idx] || `col_${idx + 1}`;
          rowObj[colName] = val;
        });
        rows.push(rowObj);
      }
    }
    inserts.push({ tableName, rows });
  }
  return inserts;
}

/**
 * 全局统一业务本体知识库 (Unified Domain Ontology Repository)
 * 具备跨教程实体同义归一、属性累积、单身份保持、按教程视口高亮能力
 */
export class UnifiedDomainOntologyRepository {

  private entities: Map<string, DomainEntityInstance> = new Map();
  private relations: Map<string, DomainRelationInstance> = new Map();
  private entityIdNumberMap: Map<string, number> = new Map();
  private nextNumericId = 101;

  public clear(): void {
    this.entities.clear();
    this.relations.clear();
    this.entityIdNumberMap.clear();
    this.nextNumericId = 101;
  }

  public getEntity(id: string): DomainEntityInstance | undefined {
    return this.entities.get(id);
  }

  public getAllEntities(): DomainEntityInstance[] {
    return Array.from(this.entities.values());
  }

  public getAllRelations(): DomainRelationInstance[] {
    return Array.from(this.relations.values());
  }

  public getNumericId(canonicalId: string): number {
    if (!this.entityIdNumberMap.has(canonicalId)) {
      this.entityIdNumberMap.set(canonicalId, this.nextNumericId++);
    }
    return this.entityIdNumberMap.get(canonicalId)!;
  }

  /**
   * 观察输入证据（教程内容、SQL 代码、执行结果），进行业务实体与关系推导，融入统一本体库
   */
  public ingestEvidence(
    knowledgeMeta: KnowledgeMetaInput,
    sqlBlocks: string[],
    report?: BatchExecutionReport
  ): {
    activeEntityIds: string[];
    activeRelationIds: string[];
  } {
    const tutorialId = knowledgeMeta.id || 'default-tutorial';
    const tutorialTitle = knowledgeMeta.title || knowledgeMeta.name || 'DuckDB 知识资产';
    const activeEntities = new Set<string>();
    const activeRelations = new Set<string>();

    const rawSqls = sqlBlocks.length > 0 
      ? sqlBlocks 
      : (knowledgeMeta.content ? extractSqlBlocksFromMarkdown(knowledgeMeta.content) : []);

    const allSql = rawSqls.join('\n;\n');
    const parsedSchemas = parseSqlDDL(allSql);
    const schemaMap = new Map<string, ParsedTableSchema>();
    parsedSchemas.forEach(s => schemaMap.set(s.tableName, s));
    const isJunctionTable = (s: ParsedTableSchema) => s.foreignKeys.length >= 2 && s.columns.length <= 4;

    const effectiveResults = report?.results || rawSqls.map((sql, idx) => ({
      index: idx + 1,
      sql,
      durationMs: 0,
      success: false,
    }));

    effectiveResults.forEach(res => {
      const sql = res.sql;
      const cleanSql = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

      // 提取引用的物理表名/文件名
      const tableMatches: string[] = [];
      const fileRegex = /(?:read_parquet|read_csv|read_json_auto|read_json)\s*\(\s*['"]([^'"]+)['"]\s*\)|(?:FROM|JOIN)\s+['"]([^'"]+\.(?:parquet|csv|json|tsv|arrow))['"]/gi;
      let fileMatch;
      while ((fileMatch = fileRegex.exec(cleanSql)) !== null) {
        const rawFile = (fileMatch[1] || fileMatch[2]).trim().toLowerCase();
        if (rawFile && !SQL_SYNTAX_NEGATIVE_LIST.has(rawFile)) {
          tableMatches.push(rawFile);
        }
      }

      const tblRegex = /\b(?:FROM|JOIN|PIVOT|UNPIVOT|TABLE|INTO|UPDATE)\s+([a-zA-Z0-9_.'"-]+)|\bCREATE\s+(?:OR\s+REPLACE\s+)?TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z0-9_.'"-]+)/gi;
      let match;
      while ((match = tblRegex.exec(cleanSql)) !== null) {
        let tName = (match[1] || match[2]).replace(/['"]/g, '').trim().toLowerCase();
        if (tName.endsWith(';')) tName = tName.slice(0, -1);
        if (!SQL_SYNTAX_NEGATIVE_LIST.has(tName) && !tName.startsWith('read_')) {
          tableMatches.push(tName);
        }
      }

      // 提取查询中出现的列名与字段
      const referencedCols: string[] = res.columns ? [...res.columns] : [];
      parsedSchemas.forEach(s => {
        if (tableMatches.includes(s.tableName)) {
          s.columns.forEach(col => {
            if (!SQL_SYNTAX_NEGATIVE_LIST.has(col) && !referencedCols.includes(col)) {
              referencedCols.push(col);
            }
          });
        }
      });

      const selectMatch = cleanSql.match(/^\s*SELECT\s+([\s\S]+?)\s+FROM\b/i);
      if (selectMatch && !selectMatch[1].includes('*')) {
        const parts = selectMatch[1].split(',').map(p => p.trim());
        parts.forEach(part => {
          const colClean = part.split(/\s+AS\s+/i)[0].replace(/[^a-zA-Z0-9_]/g, ' ').trim().split(/\s+/).pop();
          if (colClean && !SQL_SYNTAX_NEGATIVE_LIST.has(colClean.toLowerCase()) && !referencedCols.includes(colClean)) {
            referencedCols.push(colClean);
          }
        });
      }

      // 2. 匹配与映射实体概念
      const matchedConceptDefs = new Set<DomainConceptDefinition>();

      // A. 表名匹配（先精确别名匹配，再进行形态学/边界匹配，避免如 'user' 误匹配 'user_events'）
      tableMatches.forEach(t => {
        const schema = schemaMap.get(t);
        const isJunctionTbl = (schema && isJunctionTable(schema)) || t === 'thinker_schools' || t === 'concept_hierarchy' || /_junction$|_hierarchy$|_to_|_has_/i.test(t);
        if (isJunctionTbl) {
          // 关联/中间表：连接两端业务实体，不单独作为根实体类型
          let srcId = '';
          let tgtId = '';
          if (schema && schema.foreignKeys.length >= 2) {
            srcId = `ent-${schema.foreignKeys[0].targetTable}`;
            tgtId = `ent-${schema.foreignKeys[1].targetTable}`;
          } else if (t === 'thinker_schools') {
            srcId = 'ent-thinkers';
            tgtId = 'ent-schools';
          } else if (t === 'concept_hierarchy') {
            srcId = 'ent-concepts';
            tgtId = 'ent-concepts';
          } else {
            const parts = t.split('_');
            srcId = `ent-${parts[0]}`;
            tgtId = `ent-${parts[parts.length - 1]}`;
          }

          if (srcId && tgtId) {
            activeEntities.add(srcId);
            activeEntities.add(tgtId);
            const relId = `rel-${srcId}-associated-${tgtId}`;
            activeRelations.add(relId);
            this.addOrUpdateRelation(relId, 9, 'belongs_to', srcId, tgtId, `${t} 关联两端业务主体`, tutorialId, tutorialTitle, cleanSql);
          }
          return;
        }

        const resolveConceptId = (tableName: string): string => {
          const lower = tableName.toLowerCase().replace(/['"`]/g, '').trim();
          const match = CANONICAL_DOMAIN_DICTIONARY.find(def =>
            def.aliases.some(alias => lower === alias.toLowerCase() || `${lower}s` === alias.toLowerCase() || lower === `${alias.toLowerCase()}s`)
          );
          return match ? match.canonicalId : `ent-${lower.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        };

        if (schema && schema.foreignKeys.length > 0) {
          schema.foreignKeys.forEach(fk => {
            const srcId = resolveConceptId(schema.tableName);
            const tgtId = resolveConceptId(fk.targetTable);
            activeEntities.add(srcId);
            activeEntities.add(tgtId);
            const relId = `rel-${srcId}-${fk.column}-${tgtId}`;
            activeRelations.add(relId);
            this.addOrUpdateRelation(relId, 10, fk.column, srcId, tgtId, `${schema.tableName} 引用 ${fk.targetTable} (${fk.column})`, tutorialId, tutorialTitle, cleanSql);
          });
        }

        let matched = CANONICAL_DOMAIN_DICTIONARY.find(def => 
          def.aliases.some(alias => t === alias.toLowerCase())
        );
        if (!matched) {
          matched = CANONICAL_DOMAIN_DICTIONARY.find(def => 
            def.aliases.some(alias => {
              const al = alias.toLowerCase();
              return t === `${al}s` || `${t}s` === al || t.startsWith(`${al}_`) || t.endsWith(`_${al}`);
            })
          );
        }
        if (matched) {
          matchedConceptDefs.add(matched);
        } else {
          // 开放式自定义业务表（非负面清单）
          const baseName = t.split('.').shift() || t;
          if (baseName.length > 2 && !SQL_SYNTAX_NEGATIVE_LIST.has(baseName)) {
            const pascalName = baseName.replace(/(?:^|_)([a-z])/g, (_, c) => c.toUpperCase());
            matchedConceptDefs.add({
              canonicalId: `ent-${baseName.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
              canonicalName: pascalName,
              objectTypeId: 2,
              category: '业务交易与凭据',
              meceLayer: 'domains',
              aliases: [baseName],
              description: `从业务数据表 ${baseName} 中识别的业务实体。`,
            });
          }
        }
      });


      // B. 列名及上下文语义匹配（例如 uid/customer_id 触发 Customer，tx_hash 触发 CryptoTransaction）
      referencedCols.forEach(col => {
        const lowerCol = col.toLowerCase();
        if (['uid', 'customer_id', 'user_id', 'cust_id'].some(k => lowerCol === k || lowerCol.includes(k))) {
          const custDef = CANONICAL_DOMAIN_DICTIONARY.find(d => d.canonicalId === 'ent-customer');
          if (custDef) matchedConceptDefs.add(custDef);
        }
        if (['tx_hash', 'hash', 'gas'].some(k => lowerCol.includes(k))) {
          const cryptoDef = CANONICAL_DOMAIN_DICTIONARY.find(d => d.canonicalId === 'ent-crypto-transaction');
          if (cryptoDef) matchedConceptDefs.add(cryptoDef);
        }
        if (['network', 'network_id', 'chain_id'].some(k => lowerCol.includes(k))) {
          const netDef = CANONICAL_DOMAIN_DICTIONARY.find(d => d.canonicalId === 'ent-network');
          if (netDef) matchedConceptDefs.add(netDef);
        }
      });

      // C. 为匹配到的实体注册或合并至全局本体库
      matchedConceptDefs.forEach(def => {
        activeEntities.add(def.canonicalId);
        const existing = this.entities.get(def.canonicalId);

        // 收集该实体在本次执行中体现的业务属性（挂载在对象属性中，绝不作为独立节点）
        const newProps: Record<string, any> = {};
        referencedCols.forEach(c => {
          newProps[c] = `属性: ${c}`;
        });
        if (def.canonicalId === 'ent-order' && Object.keys(newProps).length === 0) {
          newProps['order_id'] = '标识: order_id';
          newProps['status'] = '状态: status';
        }
        if (res.rowCount !== undefined && res.rowCount > 0) {
          newProps['_lastRowCount'] = res.rowCount;
          newProps['_lastDurationMs'] = res.durationMs;
        }

        const isVerified = res.success && (res.rowCount !== undefined || res.durationMs > 0);

        if (!existing) {
          this.entities.set(def.canonicalId, {
            canonicalId: def.canonicalId,
            name: def.canonicalName,
            objectTypeId: def.objectTypeId,
            category: def.category,
            meceLayer: def.meceLayer,
            description: def.description,
            properties: newProps,
            provenance: [
              {
                tutorialId,
                tutorialTitle,
                codeSnippet: sql.trim().slice(0, 120),
                blockIndex: res.index,
                verifiedAt: isVerified ? new Date().toISOString() : undefined,
                rowCount: res.rowCount,
                durationMs: res.durationMs,
                columns: res.columns,
              }
            ],
            status: isVerified ? 'verified_active' : 'pending_execution',
            sourceBlockIndex: res.index,
            tutorialAnchor: `code-block-${res.index}`,
          });
        } else {
          // 关键原则：同一个概念跨教程复用，补充合并属性，绝不创建同义多份节点
          Object.assign(existing.properties, newProps);
          if (isVerified) {
            existing.status = 'verified_active';
          }
          const hasProv = existing.provenance.some(p => p.tutorialId === tutorialId && p.blockIndex === res.index);
          if (!hasProv) {
            existing.provenance.push({
              tutorialId,
              tutorialTitle,
              codeSnippet: sql.trim().slice(0, 120),
              blockIndex: res.index,
              verifiedAt: isVerified ? new Date().toISOString() : undefined,
              rowCount: res.rowCount,
              durationMs: res.durationMs,
              columns: res.columns,
            });
          }
        }
      });

      // 3. 严格基于真实业务语义与执行证据建立关系（宁缺毋滥）
      const presentConceptIds = Array.from(matchedConceptDefs).map(d => d.canonicalId);

      // 规则 A: Customer -> places -> Order
      if (presentConceptIds.includes('ent-customer') && presentConceptIds.includes('ent-order')) {
        const relId = 'rel-customer-places-order';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 1, 'places', 'ent-customer', 'ent-order', '客户发起并提交订购单据', tutorialId, tutorialTitle, sql);
      }

      // 规则 B: Customer -> performs -> Transaction
      if (presentConceptIds.includes('ent-customer') && presentConceptIds.includes('ent-transaction')) {
        const relId = 'rel-customer-performs-transaction';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 2, 'performs', 'ent-customer', 'ent-transaction', '客户发起资金转移结算交易', tutorialId, tutorialTitle, sql);
      }

      // 规则 C: Customer -> performs -> CryptoTransaction
      if (presentConceptIds.includes('ent-customer') && presentConceptIds.includes('ent-crypto-transaction')) {
        const relId = 'rel-customer-performs-crypto-transaction';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 2, 'performs', 'ent-customer', 'ent-crypto-transaction', '客户签名发起加密资产转账', tutorialId, tutorialTitle, sql);
      }

      // 规则 D: CryptoTransaction -> occurs_on -> Network
      if (presentConceptIds.includes('ent-crypto-transaction') && presentConceptIds.includes('ent-network')) {
        const relId = 'rel-crypto-transaction-occurs-on-network';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 5, 'occurs_on', 'ent-crypto-transaction', 'ent-network', '加密交易在目标区块链网络广播并完成确认', tutorialId, tutorialTitle, sql);
      }

      // 规则 E: Transaction -> uses -> Asset
      if ((presentConceptIds.includes('ent-transaction') || presentConceptIds.includes('ent-crypto-transaction')) && presentConceptIds.includes('ent-asset')) {
        const srcId = presentConceptIds.includes('ent-crypto-transaction') ? 'ent-crypto-transaction' : 'ent-transaction';
        const relId = `rel-${srcId}-uses-asset`;
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 4, 'uses', srcId, 'ent-asset', '交易使用指定数字资产或法定货币进行价值交付', tutorialId, tutorialTitle, sql);
      }

      // 规则 F: Order -> contains -> Product
      if (presentConceptIds.includes('ent-order') && presentConceptIds.includes('ent-product')) {
        const relId = 'rel-order-contains-product';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 3, 'contains', 'ent-order', 'ent-product', '订单履约包含对应的商品明细', tutorialId, tutorialTitle, sql);
      }

      // 规则 G: Store -> located_in -> City
      if (presentConceptIds.includes('ent-store') && presentConceptIds.includes('ent-city')) {
        const relId = 'rel-store-located-in-city';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 6, 'located_in', 'ent-store', 'ent-city', '门店物理坐落于所属地理城市', tutorialId, tutorialTitle, sql);
      }

      // 规则 H: Customer -> triggers -> UserEvent
      if (presentConceptIds.includes('ent-customer') && presentConceptIds.includes('ent-user-event')) {
        const relId = 'rel-customer-triggers-user-event';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 7, 'triggers', 'ent-customer', 'ent-user-event', '用户交互行为触发时序日志事件', tutorialId, tutorialTitle, sql);
      }

      // 规则 I: SalesRecord -> measures -> Product
      if (presentConceptIds.includes('ent-sales-record') && presentConceptIds.includes('ent-product')) {
        const relId = 'rel-sales-measures-product';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 8, 'measures', 'ent-sales-record', 'ent-product', '销售事实记录度量商品销售额度', tutorialId, tutorialTitle, sql);
      }

      // 规则 J: Employee -> belongs_to -> Department
      if (presentConceptIds.includes('ent-employee') && presentConceptIds.includes('ent-department')) {
        const relId = 'rel-employee-belongs-to-department';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 9, 'belongs_to', 'ent-employee', 'ent-department', '员工隶属/就职于指定业务部门', tutorialId, tutorialTitle, sql);
      }

      // 规则 K: Project -> leads -> Employee
      if (presentConceptIds.includes('ent-project') && presentConceptIds.includes('ent-employee')) {
        const relId = 'rel-project-lead-by-employee';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 14, 'leads', 'ent-project', 'ent-employee', '项目由技术主管/专家统筹负责', tutorialId, tutorialTitle, sql);
      }

      // 规则 L: Task -> belongs_to -> Project
      if (presentConceptIds.includes('ent-task') && presentConceptIds.includes('ent-project')) {
        const relId = 'rel-task-belongs-to-project';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 9, 'belongs_to', 'ent-task', 'ent-project', '工单任务从属于指定项目的范围拆解', tutorialId, tutorialTitle, sql);
      }

      // 规则 M: Task -> assigned_to -> Employee
      if (presentConceptIds.includes('ent-task') && presentConceptIds.includes('ent-employee')) {
        const relId = 'rel-task-assigned-to-employee';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 13, 'assigned_to', 'ent-task', 'ent-employee', '工单任务指派给指定工程师承接', tutorialId, tutorialTitle, sql);
      }

      // 规则 N: TaskAction -> dispatches -> Task
      if (presentConceptIds.includes('ent-task-action') && presentConceptIds.includes('ent-task')) {
        const relId = 'rel-task-action-targets-task';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 19, 'dispatches', 'ent-task-action', 'ent-task', '操作指令作用于目标工单任务', tutorialId, tutorialTitle, sql);
      }

      // 规则 O: Flight -> operated_by -> Aircraft
      if (presentConceptIds.includes('ent-flight') && presentConceptIds.includes('ent-aircraft')) {
        const relId = 'rel-flight-operated-by-aircraft';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 17, 'operated_by', 'ent-flight', 'ent-aircraft', '航班由指定客机机架实际执飞', tutorialId, tutorialTitle, sql);
      }

      // 规则 P: Flight -> originates_from / destines_to -> Airport
      if (presentConceptIds.includes('ent-flight') && presentConceptIds.includes('ent-airport')) {
        const relIdOrig = 'rel-flight-originates-from-airport';
        activeRelations.add(relIdOrig);
        this.addOrUpdateRelation(relIdOrig, 15, 'originates_from', 'ent-flight', 'ent-airport', '航班从指定始发空港起飞离港', tutorialId, tutorialTitle, sql);

        const relIdDest = 'rel-flight-destines-to-airport';
        activeRelations.add(relIdDest);
        this.addOrUpdateRelation(relIdDest, 16, 'destines_to', 'ent-flight', 'ent-airport', '航班在指定目的空港进港降落', tutorialId, tutorialTitle, sql);
      }

      // 规则 Q: Booking -> books -> Flight
      if (presentConceptIds.includes('ent-booking') && presentConceptIds.includes('ent-flight')) {
        const relId = 'rel-booking-books-flight';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 18, 'books', 'ent-booking', 'ent-flight', '订座凭据锁定指定航班航次', tutorialId, tutorialTitle, sql);
      }

      // 规则 R: Booking -> placed_by -> Passenger
      if (presentConceptIds.includes('ent-booking') && presentConceptIds.includes('ent-passenger')) {
        const relId = 'rel-booking-placed-by-passenger';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 1, 'places', 'ent-passenger', 'ent-booking', '旅客发起机票预订凭据', tutorialId, tutorialTitle, sql);
      }

      // 规则 S: FlightDispatch -> dispatches -> Flight
      if (presentConceptIds.includes('ent-flight-dispatch') && presentConceptIds.includes('ent-flight')) {
        const relId = 'rel-flight-dispatch-targets-flight';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 19, 'dispatches', 'ent-flight-dispatch', 'ent-flight', '调度与航延干预指令作用于指定航班', tutorialId, tutorialTitle, sql);
      }

      // 规则 T: Thinker -> belongs_to -> School
      if (presentConceptIds.includes('ent-thinkers') && presentConceptIds.includes('ent-schools')) {
        const relId = 'rel-thinker-belongs-to-school';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 9, 'belongs_to', 'ent-thinkers', 'ent-schools', '思想家归属/就学于哲学流派', tutorialId, tutorialTitle, sql);
      }

      // 规则 U: Concept -> introduced_by -> Thinker
      if (presentConceptIds.includes('ent-concepts') && presentConceptIds.includes('ent-thinkers')) {
        const relId = 'rel-concept-introduced-by-thinker';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 10, 'introduced_by', 'ent-concepts', 'ent-thinkers', '哲学概念由思想家首次提出或论证', tutorialId, tutorialTitle, sql);
      }

      // 规则 V: Product -> belongs_to -> Category
      if (presentConceptIds.includes('ent-product') && presentConceptIds.includes('ent-categories')) {
        const relId = 'rel-product-belongs-to-category';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 9, 'belongs_to', 'ent-product', 'ent-categories', '商品归属于特定品类分类节点', tutorialId, tutorialTitle, sql);
      }

      // 规则 W: Product -> made_by -> Brand
      if (presentConceptIds.includes('ent-product') && presentConceptIds.includes('ent-brands')) {
        const relId = 'rel-product-made-by-brand';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 20, 'made_by', 'ent-product', 'ent-brands', '商品由指定品牌生产制造', tutorialId, tutorialTitle, sql);
      }

      // 规则 X: Order -> placed_by -> Buyer
      if (presentConceptIds.includes('ent-order') && presentConceptIds.includes('ent-buyers')) {
        const relId = 'rel-order-placed-by-buyer';
        activeRelations.add(relId);
        this.addOrUpdateRelation(relId, 1, 'places', 'ent-buyers', 'ent-order', '买家发起并提交订单凭据', tutorialId, tutorialTitle, sql);
      }
    });

    return {
      activeEntityIds: Array.from(activeEntities),
      activeRelationIds: Array.from(activeRelations),
    };
  }

  private addOrUpdateRelation(
    id: string,
    linkTypeId: number,
    predicate: string,
    sourceCanonicalId: string,
    targetCanonicalId: string,
    description: string,
    tutorialId: string,
    tutorialTitle: string,
    evidenceSql: string
  ): void {
    const existing = this.relations.get(id);
    if (!existing) {
      this.relations.set(id, {
        id,
        linkTypeId,
        predicate,
        sourceCanonicalId,
        targetCanonicalId,
        description,
        provenance: [{ tutorialId, tutorialTitle, evidence: evidenceSql.trim().slice(0, 100) }],
      });
    } else {
      if (!existing.provenance.some(p => p.tutorialId === tutorialId)) {
        existing.provenance.push({ tutorialId, tutorialTitle, evidence: evidenceSql.trim().slice(0, 100) });
      }
    }
  }

  /**
   * 将全局本体库导出为 D3GraphView 和 RightInspector 消费的原生 Store State
   * 彻底删除固定父节点，按真实执行结果建立 Object Type -> Object Instance -> Property / Link
   */
  public exportToStoreState(
    activeEntityIds: string[],
    report?: BatchExecutionReport,
    knowledgeMeta?: KnowledgeMetaInput,
    sqlBlocks?: string[]
  ): SynthesizedOntologyStoreState {
    const activeEntities = this.getAllEntities().filter(ent => activeEntityIds.includes(ent.canonicalId));
    const activeRelations = this.getAllRelations().filter(rel => 
      activeEntityIds.includes(rel.sourceCanonicalId) && activeEntityIds.includes(rel.targetCanonicalId)
    );

    // 1. 彻底删除固定父节点（如“业务交易与凭据”）：顶层节点直接由当前领域实体 Object Type 构成
    const entityTypeMap = new Map<string, number>();
    activeEntities.forEach((ent, idx) => {
      entityTypeMap.set(ent.canonicalId, idx + 1);
    });

    const objectTypes: LifeObjectType[] = activeEntities.map(ent => ({
      id: entityTypeMap.get(ent.canonicalId)!,
      name: ent.name, // 'Customer', 'Order', 'Transaction', etc.
      description: ent.description || `${ent.name} 领域业务对象类型`,
    }));

    // 2. 从表级图谱升级为实例级图谱：解析当前代码执行实际返回的行记录与正文 DDL/种子数据
    const objects: LifeObject[] = [];
    const links: LifeLink[] = [];
    let nextInstanceId = 1;
    let nextLinkId = 1;
    const instanceDedupe = new Map<string, number>();
    const entityPkToInstId = new Map<string, Map<string, number>>();

    const addInstance = (
      canonicalId: string,
      primaryKey: string,
      instanceLabel: string,
      rowProps: Record<string, any>,
      sourceBlockIndex?: number
    ): number => {
      const typeId = entityTypeMap.get(canonicalId);
      if (!typeId) return 0;
      const cleanKey = String(primaryKey).trim();
      const dedupeKey = `${canonicalId}::${cleanKey}`;
      if (instanceDedupe.has(dedupeKey)) {
        const existingId = instanceDedupe.get(dedupeKey)!;
        const existingObj = objects.find(o => o.id === existingId);
        if (existingObj) {
          try {
            const prevProps = JSON.parse(existingObj.properties);
            existingObj.properties = JSON.stringify({ ...prevProps, ...rowProps }, null, 2);
          } catch {}
        }
        return existingId;
      }

      // 检查当前实体类型下是否已有同名实例（例如种子已置入，查询后回填字段属性）
      const existingByName = objects.find(o => o.object_type_id === typeId && o.name === instanceLabel);
      if (existingByName) {
        try {
          const prevProps = JSON.parse(existingByName.properties);
          existingObjByNamePropertiesUpdate: {
            existingByName.properties = JSON.stringify({ ...prevProps, ...rowProps }, null, 2);
          }
        } catch {}
        instanceDedupe.set(dedupeKey, existingByName.id);
        if (!entityPkToInstId.has(canonicalId)) {
          entityPkToInstId.set(canonicalId, new Map());
        }
        entityPkToInstId.get(canonicalId)!.set(cleanKey, existingByName.id);
        return existingByName.id;
      }
      const id = nextInstanceId++;
      instanceDedupe.set(dedupeKey, id);

      if (!entityPkToInstId.has(canonicalId)) {
        entityPkToInstId.set(canonicalId, new Map());
      }
      entityPkToInstId.get(canonicalId)!.set(cleanKey, id);

      const propsObj = {
        ...rowProps,
        _displayName: instanceLabel,
        _domainType: canonicalId,
        _canonicalId: canonicalId,
        _primaryKey: cleanKey,
        sourceBlockIndex: sourceBlockIndex || 1,
        status: 'verified_active',
      };

      objects.push({
        id,
        object_type_id: typeId,
        name: instanceLabel,
        properties: JSON.stringify(propsObj, null, 2),
        annotations: 'current_tutorial_instance',
      });
      return id;
    };

    const addLink = (
      linkTypeId: number,
      sourceId: number | string,
      targetId: number | string,
      weight: number = 1.0
    ) => {
      const exists = links.some(l => 
        l.link_type_id === linkTypeId && 
        String(l.source_object_id) === String(sourceId) && 
        String(l.target_object_id) === String(targetId)
      );
      if (!exists && String(sourceId) !== String(targetId)) {
        links.push({
          id: nextLinkId++,
          link_type_id: linkTypeId,
          source_object_id: sourceId as any,
          target_object_id: targetId as any,
          weight,
        });
      }
    };

    const resolveCanonicalId = (tableName: string): string | undefined => {
      const clean = tableName.toLowerCase().replace(/['"`]/g, '').trim();
      const direct = activeEntities.find(e => {
        const raw = e.canonicalId.replace(/^ent-/, '').toLowerCase();
        return raw === clean || `${raw}s` === clean || raw === `${clean}s`;
      });
      if (direct) return direct.canonicalId;

      const def = CANONICAL_DOMAIN_DICTIONARY.find(d =>
        d.aliases.some(a => clean === a.toLowerCase() || `${clean}s` === a.toLowerCase() || clean === `${a.toLowerCase()}s`)
      );
      if (def && activeEntityIds.includes(def.canonicalId)) {
        return def.canonicalId;
      }

      const entKey = `ent-${clean.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      if (activeEntityIds.includes(entKey)) return entKey;

      return undefined;
    };

    // 3. 解析教程文本中的建表 DDL 与 INSERT 种子数据（如果有）
    const combinedSql = [
      knowledgeMeta?.content || '',
      ...(sqlBlocks || []),
      knowledgeMeta?.sql || '',
      knowledgeMeta?.sqlExpression || ''
    ].join('\n\n');

    if (combinedSql) {
      const schemasList = parseSqlDDL(combinedSql);
      const schemasMap = new Map<string, ParsedTableSchema>();
      schemasList.forEach(s => schemasMap.set(s.tableName, s));
      const parsedInserts = parseSqlInserts(combinedSql, schemasMap);

      const isJunction = (tbl: string) => {
        const schema = schemasMap.get(tbl);
        if (schema && schema.foreignKeys.length >= 2 && schema.columns.length <= 4) return true;
        return /_to_|_has_|_junction|_hierarchy/i.test(tbl) || tbl === 'thinker_schools' || tbl === 'concept_hierarchy';
      };

      // 提取实体初始种子实例
      parsedInserts.forEach(ins => {
        if (isJunction(ins.tableName)) return;
        const canonicalId = resolveCanonicalId(ins.tableName);
        if (!canonicalId) return;

        const schema = schemasMap.get(ins.tableName);
        const entity = activeEntities.find(e => e.canonicalId === canonicalId);
        const entName = entity?.name || ins.tableName;

        const boundedRows = ins.rows.slice(0, 20);
        boundedRows.forEach(row => {
          const pkCol = schema?.primaryKey || Object.keys(row).find(k => k === 'id' || k.endsWith('_id')) || Object.keys(row)[0];
          const pkVal = String(row[pkCol] ?? row.id ?? row.name ?? Math.random());
          const labelCol = Object.keys(row).find(k => 
            ['name', 'title', 'label', 'term', 'user_name', 'username', 'flight_no', 'model', 'iata_code'].includes(k.toLowerCase()) || 
            k.toLowerCase().endsWith('_name')
          );
          const label = labelCol && row[labelCol] 
            ? String(row[labelCol]) 
            : `${entName} #${pkVal}`;

          addInstance(canonicalId, pkVal, label, row, 1);
        });
      });

      // 建立种子实例间的语义关系 (外键)
      parsedInserts.forEach(ins => {
        if (isJunction(ins.tableName)) return;
        const canonicalId = resolveCanonicalId(ins.tableName);
        if (!canonicalId) return;
        const schema = schemasMap.get(ins.tableName);
        if (!schema) return;

        schema.foreignKeys.forEach(fk => {
          const targetCanonicalId = resolveCanonicalId(fk.targetTable);
          if (!targetCanonicalId) return;

          let ltId = 12;
          const col = fk.column.toLowerCase();
          if (col.includes('introduced') || col.includes('author') || col.includes('creator')) {
            ltId = 10; // introduced_by
          } else if (col.includes('school') || col.includes('dept') || col.includes('category') || col.includes('proj')) {
            ltId = 9; // belongs_to
          } else if (col.includes('assignee') || col.includes('assigned')) {
            ltId = 13; // assigned_to
          } else if (col.includes('lead')) {
            ltId = 14; // leads
          } else if (col.includes('origin')) {
            ltId = 15; // originates_from
          } else if (col.includes('dest')) {
            ltId = 16; // destines_to
          } else if (col.includes('aircraft') || col.includes('tail')) {
            ltId = 17; // operated_by
          } else if (col.includes('flight') || col.includes('booking')) {
            ltId = 18; // books
          } else if (col.includes('dispatch') || col.includes('action')) {
            ltId = 19; // dispatches
          } else if (col.includes('brand')) {
            ltId = 20; // made_by
          } else if (col === 'uid' || col === 'user_id' || col === 'customer_id' || col === 'buyer_id' || col === 'passenger_id' || col === 'actor_id') {
            ltId = 2; // performs
          }

          ins.rows.slice(0, 8).forEach(row => {
            const pkCol = schema.primaryKey || Object.keys(row).find(k => k === 'id' || k.endsWith('_id')) || Object.keys(row)[0];
            const srcPk = String(row[pkCol] ?? '');
            const tgtPk = String(row[fk.column] ?? '');
            if (srcPk && tgtPk) {
              const srcInstId = entityPkToInstId.get(canonicalId)?.get(srcPk);
              const tgtInstId = entityPkToInstId.get(targetCanonicalId)?.get(tgtPk);
              if (srcInstId && tgtInstId) {
                addLink(ltId, srcInstId, tgtInstId);
              }
            }
          });
        });
      });

      // 建立关联表/层级表的语义连线
      parsedInserts.forEach(ins => {
        if (!isJunction(ins.tableName)) return;
        const schema = schemasMap.get(ins.tableName);

        if (ins.tableName === 'thinker_schools' || (schema && schema.foreignKeys.length >= 2)) {
          const col1 = schema?.foreignKeys[0]?.column || 'thinker_id';
          const tgtTbl1 = schema?.foreignKeys[0]?.targetTable || 'thinkers';
          const col2 = schema?.foreignKeys[1]?.column || 'school_id';
          const tgtTbl2 = schema?.foreignKeys[1]?.targetTable || 'schools';

          const can1 = resolveCanonicalId(tgtTbl1);
          const can2 = resolveCanonicalId(tgtTbl2);

          if (can1 && can2) {
            ins.rows.forEach(row => {
              const pk1 = String(row[col1] ?? Object.values(row)[0]);
              const pk2 = String(row[col2] ?? Object.values(row)[1]);
              const inst1 = entityPkToInstId.get(can1)?.get(pk1);
              const inst2 = entityPkToInstId.get(can2)?.get(pk2);
              if (inst1 && inst2) {
                addLink(9, inst1, inst2); // belongs_to
              }
            });
          }
        }

        if (ins.tableName === 'concept_hierarchy' || (schema && schema.foreignKeys.length === 1 && schema.foreignKeys[0].targetTable === 'concepts')) {
          const can = resolveCanonicalId('concepts');
          if (can) {
            ins.rows.forEach(row => {
              const childPk = String(row.concept_id ?? Object.values(row)[0]);
              const parentPk = String(row.parent_concept_id ?? Object.values(row)[1]);
              const childInst = entityPkToInstId.get(can)?.get(childPk);
              const parentInst = entityPkToInstId.get(can)?.get(parentPk);
              if (childInst && parentInst) {
                addLink(11, childInst, parentInst); // hierarchy
              }
            });
          }
        }
      });
    }

    // 4. 解析真实执行结果：驱动实例增量或基于执行数据的实例图谱
    if (report && Array.isArray(report.results)) {
      report.results.forEach(res => {
        if (!res.success || !res.rows || !Array.isArray(res.rows) || res.rows.length === 0) return;
        const boundedRows = res.rows.slice(0, 8);
        const sql = res.sql || '';

        boundedRows.forEach((row, rowIdx) => {
          let custInstId: number | undefined;
          let ordInstId: number | undefined;
          let txInstId: number | undefined;
          let ctxInstId: number | undefined;
          let netInstId: number | undefined;
          let prodInstId: number | undefined;
          let storeInstId: number | undefined;
          let cityInstId: number | undefined;
          let evtInstId: number | undefined;
          let salesInstId: number | undefined;

          // A. Customer
          if (activeEntityIds.includes('ent-customer')) {
            const custCol = ['customer_id', 'uid', 'user_id', 'cust_id', 'client_id'].find(k => row[k] !== undefined);
            if (custCol) {
              const custKey = String(row[custCol]);
              custInstId = addInstance('ent-customer', custKey, `Customer #${custKey}`, row, res.index);
            }
          }

          // B. Transaction
          if (activeEntityIds.includes('ent-transaction')) {
            const hasTxCol = ['amount', 'pay_amount', 'billing_amount', 'tx_id', 'transaction_id'].some(k => row[k] !== undefined);
            if (hasTxCol) {
              const txKey = String(row.tx_id ?? row.transaction_id ?? row.id ?? `tx_${res.index}_${rowIdx + 1}`);
              const amt = row.amount ?? row.billing_amount;
              const txLabel = amt !== undefined ? `Transaction ($${amt})` : `Transaction #${txKey}`;
              txInstId = addInstance('ent-transaction', txKey, txLabel, row, res.index);
              if (custInstId && txInstId) {
                addLink(2, custInstId, txInstId);
              }
            }
          }

          // C. Order
          if (activeEntityIds.includes('ent-order')) {
            const hasOrdCol = ['order_id', 'pay_amount', 'total_amount'].some(k => row[k] !== undefined) || row.id !== undefined;
            if (hasOrdCol) {
              const ordKey = String(row.order_id ?? row.id ?? `ord_${res.index}_${rowIdx + 1}`);
              const ordLabel = row.pay_amount !== undefined ? `Order #${ordKey} (￥${row.pay_amount})` : `Order #${ordKey}`;
              ordInstId = addInstance('ent-order', ordKey, ordLabel, row, res.index);
              if (custInstId && ordInstId) {
                addLink(1, custInstId, ordInstId);
              }
            } else if (['count', 'cnt', 'sum', 'avg', 'min', 'max'].some(k => row[k] !== undefined)) {
              const ordKey = `batch_${res.index}_${rowIdx + 1}`;
              const countVal = row.count ?? row.cnt ?? res.rowCount;
              ordInstId = addInstance('ent-order', ordKey, `Order Batch (${countVal} records)`, row, res.index);
            }
          }

          // D. CryptoTransaction
          if (activeEntityIds.includes('ent-crypto-transaction')) {
            const hasCtxCol = ['tx_hash', 'hash', 'gas'].some(k => row[k] !== undefined);
            if (hasCtxCol) {
              const ctxKey = String(row.tx_hash ?? row.hash ?? `ctx_${res.index}_${rowIdx + 1}`);
              const ctxLabel = `CryptoTx #${ctxKey.slice(0, 8)}...`;
              ctxInstId = addInstance('ent-crypto-transaction', ctxKey, ctxLabel, row, res.index);
              if (custInstId && ctxInstId) {
                addLink(2, custInstId, ctxInstId);
              }
            }
          }

          // E. Network
          if (activeEntityIds.includes('ent-network')) {
            const hasNetCol = ['network_id', 'chain_id', 'network_name'].some(k => row[k] !== undefined);
            if (hasNetCol) {
              const netKey = String(row.network_id ?? row.chain_id ?? row.network_name ?? `net_${res.index}_${rowIdx + 1}`);
              const netLabel = row.network_name ? `Network (${row.network_name})` : `Network #${netKey}`;
              netInstId = addInstance('ent-network', netKey, netLabel, row, res.index);
              if (ctxInstId && netInstId) {
                addLink(5, ctxInstId, netInstId);
              }
            }
          }

          // F. Product
          if (activeEntityIds.includes('ent-product')) {
            const hasProdCol = ['product_id', 'item_id', 'sku', 'product_name'].some(k => row[k] !== undefined);
            if (hasProdCol) {
              const prodKey = String(row.product_id ?? row.sku ?? row.item_id ?? row.product_name ?? `prod_${res.index}_${rowIdx + 1}`);
              const prodLabel = row.product_name ? `Product (${row.product_name})` : `Product #${prodKey}`;
              prodInstId = addInstance('ent-product', prodKey, prodLabel, row, res.index);
              if (ordInstId && prodInstId) {
                addLink(3, ordInstId, prodInstId);
              }
            }
          }

          // G. Store
          if (activeEntityIds.includes('ent-store')) {
            const hasStoreCol = ['store_id', 'shop_id'].some(k => row[k] !== undefined);
            if (hasStoreCol) {
              const storeKey = String(row.store_id ?? row.shop_id ?? `store_${res.index}_${rowIdx + 1}`);
              storeInstId = addInstance('ent-store', storeKey, `Store #${storeKey}`, row, res.index);
            }
          }

          // H. City
          if (activeEntityIds.includes('ent-city')) {
            const hasCityCol = ['city_name', 'city_id'].some(k => row[k] !== undefined);
            if (hasCityCol) {
              const cityKey = String(row.city_name ?? row.city_id ?? `city_${res.index}_${rowIdx + 1}`);
              cityInstId = addInstance('ent-city', cityKey, `City (${cityKey})`, row, res.index);
              if (storeInstId && cityInstId) {
                addLink(6, storeInstId, cityInstId);
              }
            }
          }

          // I. UserEvent
          if (activeEntityIds.includes('ent-user-event')) {
            const hasEvtCol = ['event_id', 'event_type'].some(k => row[k] !== undefined);
            if (hasEvtCol) {
              const evtKey = String(row.event_id ?? row.event_type ?? `evt_${res.index}_${rowIdx + 1}`);
              evtInstId = addInstance('ent-user-event', evtKey, `Event (${row.event_type || evtKey})`, row, res.index);
              if (custInstId && evtInstId) {
                addLink(7, custInstId, evtInstId);
              }
            }
          }

          // J. SalesRecord
          if (activeEntityIds.includes('ent-sales-record')) {
            const hasSalesCol = ['sales_id', 'record_id', 'monthly_sales'].some(k => row[k] !== undefined);
            if (hasSalesCol) {
              const salesKey = String(row.sales_id ?? row.record_id ?? `sales_${res.index}_${rowIdx + 1}`);
              salesInstId = addInstance('ent-sales-record', salesKey, `Sales #${salesKey}`, row, res.index);
              if (prodInstId && salesInstId) {
                addLink(8, salesInstId, prodInstId);
              }
            }
          }

          const EXPLICITLY_HANDLED_CANONICAL_IDS = new Set([
            'ent-customer', 'ent-transaction', 'ent-order', 'ent-crypto-transaction',
            'ent-network', 'ent-product', 'ent-store', 'ent-city', 'ent-user-event', 'ent-sales-record'
          ]);

          // K. 领域与自定义业务实体：精准关联至查询的目标实体，绝不全量广播
          activeEntities.forEach(ent => {
            if (ent.canonicalId.startsWith('ent-') && !EXPLICITLY_HANDLED_CANONICAL_IDS.has(ent.canonicalId)) {
              const rawTbl = ent.canonicalId.replace(/^ent-/, '').toLowerCase();
              const tblRegex = new RegExp(`\\b${rawTbl}\\b`, 'i');
              if (!tblRegex.test(sql) && !sql.toLowerCase().includes(ent.name.toLowerCase())) {
                return;
              }

              // 若 SQL 中存在主表 FROM 且与当前自定义实体表名不一致，优先只匹配主表
              const fromMatch = sql.match(/\bFROM\s+([a-zA-Z0-9_]+)/i);
              if (fromMatch) {
                const fromTbl = fromMatch[1].toLowerCase();
                const isSingularPluralMatch = fromTbl === rawTbl || `${fromTbl}s` === rawTbl || fromTbl === `${rawTbl}s`;
                if (!isSingularPluralMatch && !sql.toLowerCase().includes(`join ${rawTbl}`)) {
                  return;
                }
              }

              // label col detection: exact name/title/label/term, then entity-specific alias, then any _name/_code/_title suffix
              const rowKeys = Object.keys(row);
              const singularRawTbl = rawTbl.replace(/s$/, '');
              const labelCol = rowKeys.find(k => ['name', 'title', 'label', 'term', 'user_name', 'username', 'flight_no', 'model', 'iata_code'].includes(k.toLowerCase()))
                ?? rowKeys.find(k => k.toLowerCase() === (rawTbl + '_name') || k.toLowerCase() === (singularRawTbl + '_name'))
                ?? rowKeys.find(k => k.toLowerCase().endsWith('_name') || k.toLowerCase().endsWith('_code') || k.toLowerCase().endsWith('_title'));
              const pkCol = rowKeys.find(k => k === 'id' || k === (rawTbl + '_id') || k === (singularRawTbl + '_id') || k.endsWith('_id') || k === 'tail_number' || k === 'dept_id' || k === 'emp_id' || k === 'proj_id' || k === 'task_id' || k === 'action_id' || k === 'airport_id' || k === 'flight_id' || k === 'passenger_id' || k === 'booking_id');
              const rawLabel = (labelCol != null && row[labelCol] != null) ? String(row[labelCol]) : null;
              const customKey = String((pkCol ? row[pkCol] : undefined) ?? rawLabel ?? ('custom_' + res.index + '_' + (rowIdx + 1)));
              const label = rawLabel != null ? rawLabel : (ent.name + ' #' + customKey);

              const curTypeId = entityTypeMap.get(ent.canonicalId);
              const alreadyBelongsToOther = objects.some(o => o.object_type_id !== curTypeId && o.name === label);
              if (alreadyBelongsToOther) { return; }

              // If label already exists as a seed instance, only merge properties
              const seedExists = objects.some(o => o.object_type_id === curTypeId && o.name === label);
              if (seedExists) {
                addInstance(ent.canonicalId, label, label, row, res.index);
                return;
              }

              addInstance(ent.canonicalId, customKey, label, row, res.index);
            }
          });
        });
      });
    }

    // 5. 当既无种子数据也无执行结果时，绝不伪造虚假实例，在类型层建立概念间连线
    if (objects.length === 0) {
      activeRelations.forEach((rel, idx) => {
        const srcTypeId = entityTypeMap.get(rel.sourceCanonicalId);
        const tgtTypeId = entityTypeMap.get(rel.targetCanonicalId);
        if (srcTypeId && tgtTypeId) {
          links.push({
            id: idx + 1,
            link_type_id: rel.linkTypeId,
            source_object_id: `type::${srcTypeId}` as any,
            target_object_id: `type::${tgtTypeId}` as any,
            weight: 1.0,
          });
        }
      });
    }

    const highlightNodeIds: string[] = [
      ...objects.map(o => `obj::${o.id}`),
      ...objectTypes.map(t => `type::${t.id}`),
    ];

    return {
      initState: 'ready',
      initting: false,
      activeTemplateId: 'synthesized',
      patterns: [],
      patternsLoading: false,
      objectTypes,
      objects,
      linkTypes: STANDARD_DOMAIN_LINK_TYPES,
      links,
      actions: [],
      introspections: [],
      insights: [],
      activeTab: 'graph',
      drawerOpen: false,
      search: '',
      stats: {
        objectTypes: objectTypes.length,
        objects: objects.length,
        linkTypes: STANDARD_DOMAIN_LINK_TYPES.length,
        links: links.length,
        actions: 0,
        introspections: 0,
        insights: 0,
      },
      mapping: {
        objectTable: 'life_objects',
        objectTypeTable: 'life_object_types',
        linkTable: 'life_links',
        linkTypeTable: 'life_link_types',
        actionTable: 'life_actions',
        introspectionTable: 'life_introspections',
        insightTable: 'life_insights',
        objectFields: {
          id: 'id',
          object_type_id: 'object_type_id',
          name: 'name',
          properties: 'properties',
          annotations: 'annotations',
        },
        linkFields: {
          id: 'id',
          link_type_id: 'link_type_id',
          source_object_id: 'source_object_id',
          target_object_id: 'target_object_id',
          weight: 'weight',
        },
      },
      highlightNodeIds,
    };
  }

  /**
   * 构造契约适配的 DynamicSynthesizedOntology
   */
  public exportToDynamicOntology(
    knowledgeMeta: KnowledgeMetaInput,
    activeEntityIds: string[],
    activeRelationIds: string[],
    report?: BatchExecutionReport,
    sqlBlocks?: string[]
  ): DynamicSynthesizedOntology {
    const rawTitle = knowledgeMeta.title || knowledgeMeta.name || 'DuckDB 知识资产';
    const storeState = this.exportToStoreState(activeEntityIds, report, knowledgeMeta, sqlBlocks);
    const activeEntities = this.getAllEntities().filter(e => activeEntityIds.includes(e.canonicalId));
    const activeRelations = this.getAllRelations().filter(r => activeRelationIds.includes(r.id));

    // 选取最具代表性的实体作为焦点 concept（无实体时不捏造标题伪节点）
    const primaryTarget = activeEntities.find(e => e.canonicalId === 'ent-customer' || e.canonicalId === 'ent-transaction') || activeEntities[0];
    const primaryConcept: BridgeConceptNode = primaryTarget ? {
      id: primaryTarget.canonicalId,
      name: primaryTarget.name,
      category: primaryTarget.category,
      meceLayer: primaryTarget.meceLayer,
      entityType: 'object',
      description: primaryTarget.description,
      propertiesCount: Object.keys(primaryTarget.properties).length || 4,
      status: report?.successCount ? 'verified_active' : 'pending_execution',
      sourceBlockIndex: primaryTarget.sourceBlockIndex || 1,
      tutorialAnchor: `code-block-${primaryTarget.sourceBlockIndex || 1}`,
      customProperties: {
        ...primaryTarget.properties,
        _activeEntitiesCount: activeEntities.length,
        _activeRelationsCount: activeRelations.length,
        _instancesCount: storeState.objects.length,
      },
    } : {
      id: 'none',
      name: '暂无业务实体',
      category: '未识别领域实体',
      meceLayer: 'domains',
      entityType: 'object',
      description: '当前教程代码专注底层 SQL 算子与语法特性，未引入领域业务对象。遵循真实建模原则，未强行捏造伪本体。',
      propertiesCount: 0,
      status: 'pending_execution',
      sourceBlockIndex: 1,
    };

    // 节点列表：包含当前活跃领域实体类型，以及若有执行记录下钻生成的实例节点
    const entityNodes: BridgeConceptNode[] = activeEntities.map(e => ({
      id: e.canonicalId,
      name: e.name,
      category: e.category,
      meceLayer: e.meceLayer,
      entityType: 'object',
      description: e.description,
      propertiesCount: Object.keys(e.properties).length,
      status: e.status,
      sourceBlockIndex: e.sourceBlockIndex || 1,
      tutorialAnchor: e.tutorialAnchor || 'code-block-1',
      customProperties: e.properties,
    }));

    const instanceNodes: BridgeConceptNode[] = storeState.objects.map(o => {
      let props = {};
      try { props = JSON.parse(o.properties); } catch {}
      return {
        id: `obj::${o.id}`,
        name: o.name,
        category: (props as any)._entityType || '业务实例',
        meceLayer: 'patterns' as MECELayer,
        entityType: 'object' as const,
        description: `从真实执行记录派生的业务实例 (${o.name})`,
        propertiesCount: Object.keys(props).length,
        status: 'verified_active',
        sourceBlockIndex: (props as any).sourceBlockIndex || 1,
        tutorialAnchor: `code-block-${(props as any).sourceBlockIndex || 1}`,
        customProperties: props,
      };
    });

    const generatedNodes = [...entityNodes, ...instanceNodes];

    const generatedLinks = activeRelations.map(r => ({
      sourceId: r.sourceCanonicalId,
      targetId: r.targetCanonicalId,
      predicate: r.predicate,
    }));

    const hierarchy: ConceptHierarchyNeighbors = {
      currentNode: primaryConcept,
      superConcepts: generatedNodes.filter(n => n.id !== primaryConcept.id && (n.meceLayer === 'domains' || n.meceLayer === 'foundation')),
      subConcepts: generatedNodes.filter(n => n.id !== primaryConcept.id && n.meceLayer === 'patterns'),
      associatedConcepts: generatedLinks.map(l => {
        const otherNode = generatedNodes.find(n => n.id === (l.sourceId === primaryConcept.id ? l.targetId : l.sourceId));
        return {
          node: otherNode || primaryConcept,
          predicate: l.predicate,
          direction: l.sourceId === primaryConcept.id ? 'outgoing' : 'incoming',
        };
      }),
    };

    const totalRows = (report?.results || []).reduce((acc, r) => acc + (r.rowCount || 0), 0);
    const avgDuration = Math.round((report?.totalDurationMs || 0) / Math.max(report?.total || 1, 1));

    const constructionRationale = activeEntities.length === 0
      ? '【纯语法与算子教程】：当前代码专注底层 SQL 计算或基础语法，无明确业务领域实体。依据真实建模原则，没有明确语义就不建立伪本体。'
      : (report?.successCount
          ? `【业务本体真实建模】：已基于真实 SQL 执行结果（产出 ${totalRows} 行数据，验证耗时 ${report.totalDurationMs}ms），确认了 ${activeEntities.length} 个核心业务对象（如 ${activeEntities.map(e => e.name.split(' ')[0]).join('、')}）与 ${activeRelations.length} 条真实业务语义关联。属性已规范沉淀至实体内部。`
          : `【业务语义预解析建模】：已从当前教程提取 ${activeEntities.length} 个业务实体类型与 ${activeRelations.length} 条业务关系候选。代码执行后将即时回填真实字段属性与执行证据。`);

    return {
      primaryConcept,
      hierarchy,
      generatedNodes,
      generatedLinks,
      constructionRationale,
      executionMetrics: {
        executedStatements: report?.total || activeEntities.length,
        totalRowsProcessed: totalRows,
        avgDurationMs: avgDuration,
      },
      executionReport: report,
      storeState,
    };
  }
}

// 全局单例统一本体库
export const unifiedDomainOntology = new UnifiedDomainOntologyRepository();

export function getUnifiedDomainOntologyRepository(): UnifiedDomainOntologyRepository {
  return unifiedDomainOntology;
}

/**
 * 针对尚未执行的教程，预提取业务实体基线
 */
export function synthesizeBaselineOntology(
  knowledgeMeta: KnowledgeMetaInput
): DynamicSynthesizedOntology {
  const rawBlocks = extractSqlBlocksFromMarkdown(knowledgeMeta.content || '');
  const sqlBlocks = rawBlocks.length > 0 
    ? rawBlocks 
    : (knowledgeMeta.sql ? [knowledgeMeta.sql] : (knowledgeMeta.sqlExpression ? [knowledgeMeta.sqlExpression] : []));

  const { activeEntityIds, activeRelationIds } = unifiedDomainOntology.ingestEvidence(
    knowledgeMeta,
    sqlBlocks
  );

  return unifiedDomainOntology.exportToDynamicOntology(
    knowledgeMeta,
    activeEntityIds,
    activeRelationIds,
    undefined,
    sqlBlocks
  );
}

/**
 * 根据代码特征与执行结果驱动统一本体库更新，返回当前视角切片
 */
export function synthesizeOntologyFromExecution(
  knowledgeMeta: KnowledgeMetaInput,
  report: BatchExecutionReport,
): DynamicSynthesizedOntology {
  const rawBlocks = extractSqlBlocksFromMarkdown(knowledgeMeta.content || '');
  const sqlBlocks = rawBlocks.length > 0 
    ? rawBlocks 
    : (knowledgeMeta.sql ? [knowledgeMeta.sql] : (knowledgeMeta.sqlExpression ? [knowledgeMeta.sqlExpression] : []));

  const { activeEntityIds, activeRelationIds } = unifiedDomainOntology.ingestEvidence(
    knowledgeMeta,
    sqlBlocks,
    report
  );

  return unifiedDomainOntology.exportToDynamicOntology(
    knowledgeMeta,
    activeEntityIds,
    activeRelationIds,
    report,
    sqlBlocks
  );
}

/**
 * 单个 SQL 代码块执行成功后的增量融合更新
 */
export function synthesizeOntologyFromSingleBlock(
  knowledgeMeta: KnowledgeMetaInput,
  currentOntology: DynamicSynthesizedOntology | null,
  blockResult: SqlBlockExecutionResult
): DynamicSynthesizedOntology {
  const existingReport = currentOntology?.executionReport;
  const prevResults = existingReport ? [...existingReport.results] : [];
  const existingIdx = prevResults.findIndex(r => r.index === blockResult.index);
  if (existingIdx >= 0) {
    prevResults[existingIdx] = blockResult;
  } else {
    prevResults.push(blockResult);
  }

  const successCount = prevResults.filter(r => r.success).length;
  const failedCount = prevResults.filter(r => !r.success).length;
  const totalDuration = prevResults.reduce((acc, r) => acc + (r.durationMs || 0), 0);

  const report: BatchExecutionReport = {
    total: prevResults.length,
    successCount,
    failedCount,
    totalDurationMs: totalDuration,
    results: prevResults,
    synthesizedAt: new Date().toISOString(),
  };

  return synthesizeOntologyFromExecution(knowledgeMeta, report);
}

/**
 * 将概念图谱转换为 D3GraphView 原生消费规范（向后兼容接口）
 */
export function convertSynthesizedOntologyToStoreState(
  base: Omit<DynamicSynthesizedOntology, 'storeState'>
): SynthesizedOntologyStoreState {
  const activeIds = base.generatedNodes.map(n => n.id);
  return unifiedDomainOntology.exportToStoreState(activeIds);
}
