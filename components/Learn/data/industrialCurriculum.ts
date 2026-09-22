/**
 * industrialCurriculum.ts - 工业级实战课程体系与数据资产注册中心
 * 
 * 设计理念：
 * 1. 彻底淘汰人造测试玩具语法，全面采用真实企业级数据工程与业务分析场景；
 * 2. 4 大专业进阶轨迹 (Tracks)，16 门工业级关卡；
 * 3. 每门关卡均附带：业务背景与痛点、输入表结构与前 3 行预览、分步推演、明确的挑战验收标准、以及生产级复用 SQL 宏/视图模板。
 */

export type TrackId = 'modern_sql' | 'data_lake' | 'high_perf' | 'enterprise_opla';
export type LessonDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface TableColumnDef {
  name: string;
  type: string;
  comment?: string;
}

export interface InputTablePreview {
  tableName: string;
  description: string;
  columns: TableColumnDef[];
  sampleRows: Record<string, any>[];
  setupSql: string; // 可以在 DuckDB 中直接执行生成模拟数据的 SQL
}

export interface LessonStep {
  id: string;
  title: string;
  concept: string;
  explanation: string;
  sql: string;
}

export interface ChallengeSpec {
  title: string;
  description: string;
  hint: string;
  starterSql: string;
  solutionSql: string;
  targetColumns: string[];
  targetMinRows: number;
  expectedExplanation: string;
  requiredKeywords: string[];
}

export interface IndustrialLesson {
  id: string;
  trackId: TrackId;
  trackTitle: string;
  order: number;
  title: string;
  subtitle: string;
  difficulty: LessonDifficulty;
  estimatedMinutes: number;
  tags: string[];
  businessScenario: string;
  whyItMatters: string;
  antiPattern: string;
  bestPractice: string;
  inputTables: InputTablePreview[];
  initialSql: string;
  steps: LessonStep[];
  challenge: ChallengeSpec;
  productionTemplate: {
    title: string;
    description: string;
    templateSql: string;
  };
}

export interface TrackMeta {
  id: TrackId;
  title: string;
  tagline: string;
  description: string;
  iconName: string;
  accentColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  lessons: IndustrialLesson[];
}

// -------------------------------------------------------------
// 1. 轨迹一：现代 SQL 分析大师 (Modern SQL Mastery)
// -------------------------------------------------------------
const TRACK_MODERN_SQL_LESSONS: IndustrialLesson[] = [
  {
    id: 'lesson_1_1_order_funnel',
    trackId: 'modern_sql',
    trackTitle: '现代 SQL 分析大师',
    order: 1,
    title: '电商全链路转化漏斗与状态机分析',
    subtitle: '掌握 CASE WHEN 条件分类与 FILTER (WHERE ...) 聚合过滤算子',
    difficulty: 'Beginner',
    estimatedMinutes: 8,
    tags: ['电商分析', '漏斗转化', 'FILTER聚合', 'CASE_WHEN'],
    businessScenario: '跨境电商运营团队发现大促期间虽然加购量剧增，但最终完成订单的转化率出现异动，需要排查各品类的支付履约转化率与取消损耗。',
    whyItMatters: '传统 SQL 常常使用多个子查询或长篇的 LEFT JOIN 来计算不同状态的指标，DuckDB 提供的 FILTER (WHERE ...) 语法可以在单个聚合查询中完成多维状态切片，性能提升 3-5 倍。',
    antiPattern: '写 4 个独立 CTE 查每个状态的订单数再 JOIN 到一起，导致重复扫描基表 4 次。',
    bestPractice: '单次扫描基表，使用 COUNT(*) FILTER (WHERE status = \'PAID\') 直接计算目标状态。',
    inputTables: [
      {
        tableName: 'mock_orders',
        description: '电商全量订单明细流水表',
        columns: [
          { name: 'order_id', type: 'VARCHAR', comment: '订单唯一ID' },
          { name: 'user_id', type: 'INTEGER', comment: '买家用户ID' },
          { name: 'category', type: 'VARCHAR', comment: '商品类目' },
          { name: 'amount', type: 'DOUBLE', comment: '订单金额(元)' },
          { name: 'status', type: 'VARCHAR', comment: '订单状态 (PENDING/PAID/CANCELLED/REFUNDED)' },
          { name: 'created_at', type: 'TIMESTAMP', comment: '下单时间' }
        ],
        sampleRows: [
          { order_id: 'ORD-9001', user_id: 101, category: '数码', amount: 3999.0, status: 'PAID', created_at: '2026-09-20 10:00:00' },
          { order_id: 'ORD-9002', user_id: 102, category: '美妆', amount: 280.0, status: 'PAID', created_at: '2026-09-20 10:05:00' },
          { order_id: 'ORD-9003', user_id: 103, category: '食品', amount: 89.0, status: 'CANCELLED', created_at: '2026-09-20 10:12:00' }
        ],
        setupSql: `CREATE OR REPLACE TEMP TABLE mock_orders AS
SELECT 
  'ORD-' || lpad(cast(range as varchar), 4, '0') AS order_id,
  100 + (range % 25) AS user_id,
  CASE range % 4 
    WHEN 0 THEN '数码' 
    WHEN 1 THEN '美妆' 
    WHEN 2 THEN '母婴' 
    ELSE '食品' 
  END AS category,
  round(50.0 + (range * 37 % 800), 2) AS amount,
  CASE range % 5 
    WHEN 0 THEN 'PENDING'
    WHEN 1 THEN 'PAID'
    WHEN 2 THEN 'PAID'
    WHEN 3 THEN 'CANCELLED'
    ELSE 'REFUNDED'
  END AS status,
  '2026-09-20 08:00:00'::TIMESTAMP + INTERVAL (range * 7) MINUTE AS created_at
FROM range(1, 101);`
      }
    ],
    initialSql: `-- 步骤示例：统计各品类的总单量、已支付单量与支付转化率
WITH base AS (
  SELECT 
    category,
    COUNT(*) AS total_orders,
    COUNT(*) FILTER (WHERE status = 'PAID') AS paid_orders,
    ROUND(SUM(amount) FILTER (WHERE status = 'PAID'), 2) AS paid_gmv,
    ROUND(COUNT(*) FILTER (WHERE status = 'PAID') * 100.0 / COUNT(*), 1) AS pay_conversion_rate
  FROM mock_orders
  GROUP BY category
)
SELECT * FROM base ORDER BY paid_gmv DESC;`,
    steps: [
      {
        id: 's1',
        title: 'Step 1: 探查订单分布与品类聚合',
        concept: 'COUNT(*) 与 GROUP BY 分组',
        explanation: '先对整体订单按品类分组，观察各品类的基准单量。',
        sql: `SELECT category, COUNT(*) AS total_orders FROM mock_orders GROUP BY category;`
      },
      {
        id: 's2',
        title: 'Step 2: 注入 FILTER 条件完成状态切片',
        concept: '聚合 FILTER 子句',
        explanation: '使用 COUNT(*) FILTER (WHERE status = \'PAID\') 提取实付订单。',
        sql: `SELECT 
  category, 
  COUNT(*) AS total_orders,
  COUNT(*) FILTER (WHERE status = 'PAID') AS paid_orders
FROM mock_orders 
GROUP BY category;`
      },
      {
        id: 's3',
        title: 'Step 3: 计算客单价与支付转化比率',
        concept: '衍生分析指标计算',
        explanation: '计算支付单量占总单量的百分比，并计算实付客单价。',
        sql: `SELECT 
  category, 
  COUNT(*) AS total_orders,
  COUNT(*) FILTER (WHERE status = 'PAID') AS paid_orders,
  ROUND(SUM(amount) FILTER (WHERE status = 'PAID') / NULLIF(COUNT(*) FILTER (WHERE status = 'PAID'), 0), 2) AS paid_aov,
  ROUND(COUNT(*) FILTER (WHERE status = 'PAID') * 100.0 / COUNT(*), 1) AS conversion_pct
FROM mock_orders 
GROUP BY category
ORDER BY paid_aov DESC;`
      }
    ],
    challenge: {
      title: '实战挑战：输出各品类的高价值支付指标',
      description: '修改查询，输出字段包括 `category`、`paid_orders`、`cancelled_orders` 与 `paid_gmv`，并仅保留 `paid_gmv > 3000` 的品类，按 `paid_gmv` 降序排列。',
      hint: '在 HAVING 子句中过滤：HAVING SUM(amount) FILTER (WHERE status = \'PAID\') > 3000',
      starterSql: `SELECT 
  category,
  COUNT(*) FILTER (WHERE status = 'PAID') AS paid_orders,
  COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_orders,
  ROUND(SUM(amount) FILTER (WHERE status = 'PAID'), 2) AS paid_gmv
FROM mock_orders
GROUP BY category
-- 请补齐 HAVING 过滤条件与排序
ORDER BY paid_gmv DESC;`,
      solutionSql: `SELECT 
  category,
  COUNT(*) FILTER (WHERE status = 'PAID') AS paid_orders,
  COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_orders,
  ROUND(SUM(amount) FILTER (WHERE status = 'PAID'), 2) AS paid_gmv
FROM mock_orders
GROUP BY category
HAVING SUM(amount) FILTER (WHERE status = 'PAID') > 3000
ORDER BY paid_gmv DESC;`,
      targetColumns: ['category', 'paid_orders', 'cancelled_orders', 'paid_gmv'],
      targetMinRows: 1,
      expectedExplanation: '返回支付金额大于 3000 元的品类及其支付与取消单量指标。',
      requiredKeywords: ['FILTER', 'GROUP BY', 'HAVING', 'ORDER BY']
    },
    productionTemplate: {
      title: '生产级宏/视图：实时全链路指标看板',
      description: '可直接注册到项目的生产视图，每日驱动实时订单指标刷新。',
      templateSql: `CREATE OR REPLACE VIEW v_category_sales_funnel AS
SELECT 
  category,
  COUNT(*) AS total_orders,
  COUNT(*) FILTER (WHERE status = 'PAID') AS paid_orders,
  COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_orders,
  COUNT(*) FILTER (WHERE status = 'REFUNDED') AS refunded_orders,
  ROUND(SUM(amount) FILTER (WHERE status = 'PAID'), 2) AS total_paid_cny,
  ROUND(COUNT(*) FILTER (WHERE status = 'PAID') * 100.0 / NULLIF(COUNT(*), 0), 2) AS conversion_rate_pct
FROM mock_orders
GROUP BY category;`
    }
  },
  {
    id: 'lesson_1_2_qualify_dedup',
    trackId: 'modern_sql',
    trackTitle: '现代 SQL 分析大师',
    order: 2,
    title: 'QUALIFY 窗口过滤与用户最新行为快照',
    subtitle: '抛弃嵌套子查询，一行语法秒级提取最新活跃状态',
    difficulty: 'Intermediate',
    estimatedMinutes: 10,
    tags: ['QUALIFY', '窗口函数', '去重', '用户画像'],
    businessScenario: '风控与客服系统需要实时定位用户最后一次在哪个客户端产生了何种事件，传统 SQL 必须先写一层子查询计算 ROW_NUMBER() 再在外层 WHERE rn = 1，代码冗长且执行计划难优化。',
    whyItMatters: 'DuckDB 支持独特的 QUALIFY 子句，允许直接在窗口计算完成后执行过滤，彻底终结了“套娃子查询”。',
    antiPattern: 'SELECT * FROM (SELECT *, ROW_NUMBER() OVER (...) as rn FROM t) WHERE rn = 1',
    bestPractice: 'SELECT * FROM t QUALIFY ROW_NUMBER() OVER (...) = 1',
    inputTables: [
      {
        tableName: 'mock_user_events',
        description: '用户行为埋点日志流水表',
        columns: [
          { name: 'event_id', type: 'VARCHAR', comment: '事件唯一编号' },
          { name: 'user_id', type: 'INTEGER', comment: '用户编号' },
          { name: 'event_name', type: 'VARCHAR', comment: '事件类型 (VIEW_ITEM/ADD_CART/CLICK_BANNER/PURCHASE)' },
          { name: 'device_type', type: 'VARCHAR', comment: '设备类型 (iOS/Android/Web)' },
          { name: 'event_time', type: 'TIMESTAMP', comment: '发生时间戳' }
        ],
        sampleRows: [
          { event_id: 'EVT-01', user_id: 201, event_name: 'VIEW_ITEM', device_type: 'iOS', event_time: '2026-09-20 14:00:00' },
          { event_id: 'EVT-02', user_id: 201, event_name: 'ADD_CART', device_type: 'iOS', event_time: '2026-09-20 14:15:00' },
          { event_id: 'EVT-03', user_id: 202, event_name: 'CLICK_BANNER', device_type: 'Android', event_time: '2026-09-20 13:50:00' }
        ],
        setupSql: `CREATE OR REPLACE TEMP TABLE mock_user_events AS
SELECT 
  'EVT-' || lpad(cast(range as varchar), 4, '0') AS event_id,
  200 + (range % 10) AS user_id,
  CASE range % 4
    WHEN 0 THEN 'VIEW_ITEM'
    WHEN 1 THEN 'ADD_CART'
    WHEN 2 THEN 'CLICK_BANNER'
    ELSE 'PURCHASE'
  END AS event_name,
  CASE range % 3
    WHEN 0 THEN 'iOS'
    WHEN 1 THEN 'Android'
    ELSE 'Web'
  END AS device_type,
  '2026-09-20 12:00:00'::TIMESTAMP + INTERVAL (range * 13) MINUTE AS event_time
FROM range(1, 101);`
      }
    ],
    initialSql: `-- 提取每个用户在不同设备上最后一次发生的行为
SELECT 
  user_id,
  device_type,
  event_name AS last_event,
  event_time AS last_seen_at
FROM mock_user_events
QUALIFY ROW_NUMBER() OVER (PARTITION BY user_id, device_type ORDER BY event_time DESC) = 1
ORDER BY user_id, device_type;`,
    steps: [
      {
        id: 's1',
        title: 'Step 1: 探查未去重的多条行为记录',
        concept: '观察同一用户多次发生事件的原始数据',
        explanation: '筛选 user_id = 201 的事件，可发现包含多条发生于不同时间的事件。',
        sql: `SELECT user_id, device_type, event_name, event_time FROM mock_user_events WHERE user_id = 201 ORDER BY event_time DESC;`
      },
      {
        id: 's2',
        title: 'Step 2: 编写窗口排序并使用 QUALIFY 过滤 Top 1',
        concept: 'QUALIFY 语法',
        explanation: '直接在末尾使用 QUALIFY ROW_NUMBER() = 1，无需外层嵌套。',
        sql: `SELECT 
  user_id, 
  event_name, 
  device_type, 
  event_time
FROM mock_user_events
QUALIFY ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_time DESC) = 1
ORDER BY user_id;`
      }
    ],
    challenge: {
      title: '实战挑战：筛选每个用户最后一次移动端行为',
      description: '修改查询，仅保留 `device_type IN (\'iOS\', \'Android\')` 的记录，输出每个用户的 `user_id`、`last_device`、`last_event` 与 `last_time`，并过滤出最后行为是 `ADD_CART` 或 `PURCHASE` 的高意向买家。',
      hint: '在 WHERE 子句中过滤移动端，并在 QUALIFY 之后使用 ORDER BY',
      starterSql: `SELECT 
  user_id,
  device_type AS last_device,
  event_name AS last_event,
  event_time AS last_time
FROM mock_user_events
WHERE device_type IN ('iOS', 'Android')
QUALIFY ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_time DESC) = 1
-- 进一步过滤出高意向行为
ORDER BY user_id;`,
      solutionSql: `WITH latest AS (
  SELECT 
    user_id,
    device_type AS last_device,
    event_name AS last_event,
    event_time AS last_time
  FROM mock_user_events
  WHERE device_type IN ('iOS', 'Android')
  QUALIFY ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_time DESC) = 1
)
SELECT * FROM latest 
WHERE last_event IN ('ADD_CART', 'PURCHASE')
ORDER BY user_id;`,
      targetColumns: ['user_id', 'last_device', 'last_event', 'last_time'],
      targetMinRows: 1,
      expectedExplanation: '输出最后在移动端产生了加购或下单动作的用户最新状态。',
      requiredKeywords: ['QUALIFY', 'ROW_NUMBER', 'PARTITION BY', 'ORDER BY']
    },
    productionTemplate: {
      title: '生产级宏/视图：实时用户画像最新在线特征',
      description: '生成最新一次设备、最后一次点击与在线状态表。',
      templateSql: `CREATE OR REPLACE VIEW v_user_latest_profile AS
SELECT 
  user_id,
  device_type AS latest_device,
  event_name AS latest_action,
  event_time AS last_active_time
FROM mock_user_events
QUALIFY ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_time DESC) = 1;`
    }
  },
  {
    id: 'lesson_1_3_moving_averages',
    trackId: 'modern_sql',
    trackTitle: '现代 SQL 分析大师',
    order: 3,
    title: '滑动窗口计算与时序异常峰值侦测',
    subtitle: '使用 ROWS BETWEEN 滑动窗口平滑降噪并识别交易异动',
    difficulty: 'Intermediate',
    estimatedMinutes: 12,
    tags: ['滑动窗口', '移动均线', '异常检测', '金融分析'],
    businessScenario: '金融监控系统需要实时监测量化行情中的异常脉冲成交，通过计算过去 5 个时间步的移动均价与标准差，快速标记偏离度超过 15% 的闪崩或暴拉异动。',
    whyItMatters: '时序数据含有大量白噪声，利用 ROWS BETWEEN 进行平滑处理是量化分析与物联网监控的基本功。',
    antiPattern: '通过自连接 (Self JOIN) 比较前 N 行，导致 \(O(N^2)\) 计算复杂度爆炸。',
    bestPractice: '使用单行滑动窗口 `AVG(price) OVER (PARTITION BY ticker ORDER BY tick_time ROWS BETWEEN 4 PRECEDING AND CURRENT ROW)`。',
    inputTables: [
      {
        tableName: 'mock_stock_ticks',
        description: '高频交易行情快照表',
        columns: [
          { name: 'ticker', type: 'VARCHAR', comment: '证券代码' },
          { name: 'price', type: 'DOUBLE', comment: '成交价格' },
          { name: 'volume', type: 'INTEGER', comment: '成交量' },
          { name: 'tick_time', type: 'TIMESTAMP', comment: '成交时间' }
        ],
        sampleRows: [
          { ticker: 'AAPL', price: 180.5, volume: 500, tick_time: '2026-09-20 09:30:01' },
          { ticker: 'AAPL', price: 181.2, volume: 420, tick_time: '2026-09-20 09:30:02' },
          { ticker: 'TSLA', price: 245.0, volume: 800, tick_time: '2026-09-20 09:30:01' }
        ],
        setupSql: `CREATE OR REPLACE TEMP TABLE mock_stock_ticks AS
SELECT 
  CASE range % 2 WHEN 0 THEN 'AAPL' ELSE 'NVDA' END AS ticker,
  round(150.0 + (range * 1.3 % 30) + (CASE WHEN range % 15 = 0 THEN 25.0 ELSE 0 END), 2) AS price,
  (range * 100 % 2000) + 100 AS volume,
  '2026-09-20 09:30:00'::TIMESTAMP + INTERVAL (range * 3) SECOND AS tick_time
FROM range(1, 61);`
      }
    ],
    initialSql: `-- 计算 5 周期移动均价 (MA5) 与异动偏差率
SELECT 
  ticker,
  tick_time,
  price,
  ROUND(AVG(price) OVER w, 2) AS ma5_price,
  ROUND((price - AVG(price) OVER w) * 100.0 / AVG(price) OVER w, 2) AS deviation_pct
FROM mock_stock_ticks
WINDOW w AS (
  PARTITION BY ticker 
  ORDER BY tick_time 
  ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
)
ORDER BY ticker, tick_time;`,
    steps: [
      {
        id: 's1',
        title: 'Step 1: 定义命名窗口 WINDOW w AS (...)',
        concept: 'DuckDB 命名窗口语法',
        explanation: '将复杂的窗口定义放在末尾复用，避免在每个字段后重复编写 OVER 语句。',
        sql: `SELECT 
  ticker, tick_time, price,
  ROUND(AVG(price) OVER w, 2) AS ma_price,
  ROUND(MAX(price) OVER w, 2) AS max_price
FROM mock_stock_ticks
WINDOW w AS (PARTITION BY ticker ORDER BY tick_time ROWS 4 PRECEDING)
LIMIT 10;`
      }
    ],
    challenge: {
      title: '实战挑战：筛选价格偏离 5 周期均线 > 5% 的异动行情点',
      description: '修改查询，输出字段包括 `ticker`、`tick_time`、`price`、`ma5_price` 与 `deviation_pct`，并过滤出 `ABS(deviation_pct) > 5.0` 的异动点，按 `tick_time` 升序排列。',
      hint: '使用 CTE 包装窗口计算，外层过滤 ABS(deviation_pct) > 5.0',
      starterSql: `WITH calculated AS (
  SELECT 
    ticker,
    tick_time,
    price,
    ROUND(AVG(price) OVER w, 2) AS ma5_price,
    ROUND((price - AVG(price) OVER w) * 100.0 / AVG(price) OVER w, 2) AS deviation_pct
  FROM mock_stock_ticks
  WINDOW w AS (
    PARTITION BY ticker 
    ORDER BY tick_time 
    ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
  )
)
SELECT * FROM calculated
-- 请补齐偏离过滤
ORDER BY tick_time;`,
      solutionSql: `WITH calculated AS (
  SELECT 
    ticker,
    tick_time,
    price,
    ROUND(AVG(price) OVER w, 2) AS ma5_price,
    ROUND((price - AVG(price) OVER w) * 100.0 / AVG(price) OVER w, 2) AS deviation_pct
  FROM mock_stock_ticks
  WINDOW w AS (
    PARTITION BY ticker 
    ORDER BY tick_time 
    ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
  )
)
SELECT * FROM calculated
WHERE ABS(deviation_pct) > 5.0
ORDER BY tick_time;`,
      targetColumns: ['ticker', 'tick_time', 'price', 'ma5_price', 'deviation_pct'],
      targetMinRows: 1,
      expectedExplanation: '成功侦测出偏离移动均值超过 5% 的成交突变点。',
      requiredKeywords: ['AVG', 'OVER', 'WINDOW', 'ROWS BETWEEN', 'ABS']
    },
    productionTemplate: {
      title: '生产级异常告警检测视图',
      description: '实时发现时序序列中的脉冲冲击。',
      templateSql: `CREATE OR REPLACE VIEW v_stock_tick_spikes AS
SELECT * FROM (
  SELECT 
    ticker,
    tick_time,
    price,
    ROUND(AVG(price) OVER w, 2) AS ma5_price,
    ROUND((price - AVG(price) OVER w) * 100.0 / AVG(price) OVER w, 2) AS deviation_pct
  FROM mock_stock_ticks
  WINDOW w AS (
    PARTITION BY ticker 
    ORDER BY tick_time 
    ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
  )
)
WHERE ABS(deviation_pct) > 10.0;`
    }
  },
  {
    id: 'lesson_1_4_arg_max_snapshot',
    trackId: 'modern_sql',
    trackTitle: '现代 SQL 分析大师',
    order: 4,
    title: 'ARG_MAX 与 ARG_MIN 极值关联状态极速快照',
    subtitle: '一行高级聚合函数，精准获取最大/最小极值发生时的伴随字段',
    difficulty: 'Advanced',
    estimatedMinutes: 12,
    tags: ['ARG_MAX', '物联网遥测', '状态快照', '极值分析'],
    businessScenario: '车联网与冷链物流大盘需要统计每辆车在过去 24 小时内的峰值车速，并同步知道当时的车温、经纬度与时间。在 Oracle/MySQL 中往往需要写极其繁琐的 JOIN，而 DuckDB 提供了极速聚合函数 `ARG_MAX(target_col, val_col)`。',
    whyItMatters: '免除先找 MAX(val) 再回表关联伴随属性的性能开销，在亿级大数据集中速度提升数十倍。',
    antiPattern: '先聚合求最高速度，再用 (vehicle_id, speed) 回表 JOIN 原始表以获取 GPS 经纬度。',
    bestPractice: '直接聚合：`MAX(speed)`, `ARG_MAX(latitude, speed)`, `ARG_MAX(longitude, speed)`。',
    inputTables: [
      {
        tableName: 'mock_fleet_gps',
        description: '车联网冷链车载网关遥测流水表',
        columns: [
          { name: 'vehicle_id', type: 'VARCHAR', comment: '车辆车牌编号' },
          { name: 'speed_kmh', type: 'DOUBLE', comment: '实时车速 (km/h)' },
          { name: 'temp_celsius', type: 'DOUBLE', comment: '冷厢温度 (°C)' },
          { name: 'latitude', type: 'DOUBLE', comment: 'GPS 纬度' },
          { name: 'longitude', type: 'DOUBLE', comment: 'GPS 经度' },
          { name: 'recorded_at', type: 'TIMESTAMP', comment: '上报时间' }
        ],
        sampleRows: [
          { vehicle_id: 'TRUCK-京A01', speed_kmh: 88.5, temp_celsius: 2.1, latitude: 39.9042, longitude: 116.4074, recorded_at: '2026-09-20 10:00:00' },
          { vehicle_id: 'TRUCK-京A01', speed_kmh: 94.2, temp_celsius: 2.4, latitude: 39.9142, longitude: 116.4174, recorded_at: '2026-09-20 10:05:00' },
          { vehicle_id: 'TRUCK-沪B02', speed_kmh: 75.0, temp_celsius: 1.8, latitude: 31.2304, longitude: 121.4737, recorded_at: '2026-09-20 10:00:00' }
        ],
        setupSql: `CREATE OR REPLACE TEMP TABLE mock_fleet_gps AS
SELECT 
  'TRUCK-' || CASE range % 3 WHEN 0 THEN '京A8892' WHEN 1 THEN '沪B6619' ELSE '粤B5520' END AS vehicle_id,
  round(60.0 + (range * 7 % 45), 1) AS speed_kmh,
  round(1.5 + (range % 10) * 0.4, 1) AS temp_celsius,
  round(31.0 + (range * 0.01), 4) AS latitude,
  round(116.0 + (range * 0.02), 4) AS longitude,
  '2026-09-20 08:00:00'::TIMESTAMP + INTERVAL (range * 4) MINUTE AS recorded_at
FROM range(1, 101);`
      }
    ],
    initialSql: `-- 统计每台车辆的最高时速，以及发生最高时速时的 GPS 坐标与时间
SELECT 
  vehicle_id,
  MAX(speed_kmh) AS max_speed,
  ARG_MAX(temp_celsius, speed_kmh) AS temp_at_max_speed,
  ARG_MAX(latitude, speed_kmh) AS lat_at_max_speed,
  ARG_MAX(longitude, speed_kmh) AS lng_at_max_speed,
  ARG_MAX(recorded_at, speed_kmh) AS time_at_max_speed
FROM mock_fleet_gps
GROUP BY vehicle_id;`,
    steps: [
      {
        id: 's1',
        title: 'Step 1: 比较 MAX 与 ARG_MAX 的妙用',
        concept: 'ARG_MAX(关联字段, 排序基准)',
        explanation: '观察当 speed_kmh 达到最大值时，伴随字段如何被精确抓取。',
        sql: `SELECT vehicle_id, MAX(speed_kmh) AS max_speed, ARG_MAX(recorded_at, speed_kmh) AS peak_time FROM mock_fleet_gps GROUP BY vehicle_id;`
      }
    ],
    challenge: {
      title: '实战挑战：统计每辆车的最低冷厢温度及当时的车速与时间',
      description: '修改查询，统计每辆货车的 `vehicle_id`、最低温度 `min_temp`、以及达到最低温度时的时速 `speed_at_min_temp` 与上报时间 `time_at_min_temp`。',
      hint: '使用 MIN(temp_celsius) 与 ARG_MIN(speed_kmh, temp_celsius)',
      starterSql: `SELECT 
  vehicle_id,
  MIN(temp_celsius) AS min_temp,
  ARG_MIN(speed_kmh, temp_celsius) AS speed_at_min_temp,
  ARG_MIN(recorded_at, temp_celsius) AS time_at_min_temp
FROM mock_fleet_gps
GROUP BY vehicle_id
ORDER BY vehicle_id;`,
      solutionSql: `SELECT 
  vehicle_id,
  MIN(temp_celsius) AS min_temp,
  ARG_MIN(speed_kmh, temp_celsius) AS speed_at_min_temp,
  ARG_MIN(recorded_at, temp_celsius) AS time_at_min_temp
FROM mock_fleet_gps
GROUP BY vehicle_id
ORDER BY vehicle_id;`,
      targetColumns: ['vehicle_id', 'min_temp', 'speed_at_min_temp', 'time_at_min_temp'],
      targetMinRows: 3,
      expectedExplanation: '利用 ARG_MIN 成功获取每辆车最冷时刻的伴随指标。',
      requiredKeywords: ['MIN', 'ARG_MIN', 'GROUP BY']
    },
    productionTemplate: {
      title: '车队极值与异常工况大盘视图',
      description: '用于车联网安全审计报告。',
      templateSql: `CREATE OR REPLACE VIEW v_fleet_extreme_metrics AS
SELECT 
  vehicle_id,
  COUNT(*) AS total_reports,
  MAX(speed_kmh) AS peak_speed,
  ARG_MAX(recorded_at, speed_kmh) AS peak_speed_time,
  MIN(temp_celsius) AS min_temp,
  ARG_MIN(recorded_at, temp_celsius) AS min_temp_time,
  MAX(temp_celsius) AS max_temp,
  ARG_MAX(recorded_at, temp_celsius) AS max_temp_time
FROM mock_fleet_gps
GROUP BY vehicle_id;`
    }
  }
];

// -------------------------------------------------------------
// 2. 轨迹二：数据湖与半结构化数据工程 (Data Engineering & Lakehouse)
// -------------------------------------------------------------
const TRACK_DATA_LAKE_LESSONS: IndustrialLesson[] = [
  {
    id: 'lesson_2_1_json_analytics',
    trackId: 'data_lake',
    trackTitle: '数据湖与半结构化工程',
    order: 1,
    title: 'JSON API 日志深层萃取与强类型转换',
    subtitle: '使用 ->> 语法与 JSON 函数零拷贝解析半结构化负载',
    difficulty: 'Beginner',
    estimatedMinutes: 10,
    tags: ['JSON解析', 'API网关', '半结构化', '数据湖'],
    businessScenario: '微服务网关每天产生上千万条 JSON 日志，传统方案需要专门建一套 Logstash/Flink ETL 清洗，DuckDB 支持在内存中直接对 JSON 列进行深层 Path 索引与类型投射。',
    whyItMatters: '支持直接将 JSON 字符串或嵌套对象映射为强类型标量，查询速度比传统 JSON 解析引擎快 10 倍。',
    antiPattern: '将整段 JSON 导出到外部 Python 脚本做 json.loads() 处理后再倒回数据库。',
    bestPractice: '直接使用 `payload_json->>\'$.user.tier\'` 提取为字符串，或 `(payload_json->>\'$.user.id\')::INTEGER` 强转为整数。',
    inputTables: [
      {
        tableName: 'mock_api_logs',
        description: '网关 API 访问日志表',
        columns: [
          { name: 'log_id', type: 'VARCHAR', comment: '日志流水号' },
          { name: 'payload_json', type: 'VARCHAR', comment: 'JSON 请求体' },
          { name: 'status_code', type: 'INTEGER', comment: 'HTTP 状态码' },
          { name: 'latency_ms', type: 'INTEGER', comment: '耗时 (毫秒)' }
        ],
        sampleRows: [
          { log_id: 'LOG-001', payload_json: '{"user":{"id":8801,"tier":"VIP"},"action":"PAY","meta":{"ip":"10.0.0.1"}}', status_code: 200, latency_ms: 120 },
          { log_id: 'LOG-002', payload_json: '{"user":{"id":8802,"tier":"REGULAR"},"action":"QUERY","meta":{"ip":"10.0.0.2"}}', status_code: 500, latency_ms: 850 }
        ],
        setupSql: `CREATE OR REPLACE TEMP TABLE mock_api_logs AS
SELECT 
  'LOG-' || lpad(cast(range as varchar), 4, '0') AS log_id,
  json_object(
    'user', json_object('id', 8800 + (range % 20), 'tier', CASE range % 3 WHEN 0 THEN 'VIP' WHEN 1 THEN 'ENTERPRISE' ELSE 'REGULAR' END),
    'action', CASE range % 4 WHEN 0 THEN 'CHECKOUT' WHEN 1 THEN 'SEARCH' WHEN 2 THEN 'LOGIN' ELSE 'EXPORT' END,
    'meta', json_object('retry_count', range % 3, 'region', CASE range % 2 WHEN 0 THEN 'cn-north' ELSE 'cn-south' END)
  ) AS payload_json,
  CASE WHEN range % 7 = 0 THEN 500 WHEN range % 11 = 0 THEN 404 ELSE 200 END AS status_code,
  (range * 17 % 400) + 50 AS latency_ms
FROM range(1, 101);`
      }
    ],
    initialSql: `-- 解析 JSON 内部字段并按用户等级统计平均耗时与错误率
SELECT 
  payload_json->>'$.user.tier' AS user_tier,
  COUNT(*) AS request_count,
  ROUND(AVG(latency_ms), 1) AS avg_latency_ms,
  COUNT(*) FILTER (WHERE status_code >= 400) AS error_count
FROM mock_api_logs
GROUP BY user_tier
ORDER BY avg_latency_ms DESC;`,
    steps: [
      {
        id: 's1',
        title: 'Step 1: 使用 ->> 抽取嵌套字符串',
        concept: 'JSON Path 提取算子 ->>',
        explanation: '->> 提取结果为 TEXT，支持深层点路径如 $.user.tier。',
        sql: `SELECT log_id, payload_json->>'$.action' AS action, payload_json->>'$.user.tier' AS tier FROM mock_api_logs LIMIT 5;`
      }
    ],
    challenge: {
      title: '实战挑战：定位 ENTERPRISE 用户的高耗时请求',
      description: '修改查询，提取 `log_id`、`tier` (即 `payload_json->>\'$.user.tier\'`)、`action` (即 `payload_json->>\'$.action\'`) 与 `latency_ms`，筛选出 `tier = \'ENTERPRISE\'` 且 `latency_ms > 200` 的记录，按 `latency_ms` 降序排列。',
      hint: '在 WHERE 子句中加入 payload_json->>\'$.user.tier\' = \'ENTERPRISE\' AND latency_ms > 200',
      starterSql: `SELECT 
  log_id,
  payload_json->>'$.user.tier' AS tier,
  payload_json->>'$.action' AS action,
  latency_ms
FROM mock_api_logs
-- 请补充 WHERE 条件
ORDER BY latency_ms DESC;`,
      solutionSql: `SELECT 
  log_id,
  payload_json->>'$.user.tier' AS tier,
  payload_json->>'$.action' AS action,
  latency_ms
FROM mock_api_logs
WHERE payload_json->>'$.user.tier' = 'ENTERPRISE' AND latency_ms > 200
ORDER BY latency_ms DESC;`,
      targetColumns: ['log_id', 'tier', 'action', 'latency_ms'],
      targetMinRows: 1,
      expectedExplanation: '准确抽取企业级高延迟日志以供链路追踪。',
      requiredKeywords: ['->>', 'WHERE', 'ORDER BY']
    },
    productionTemplate: {
      title: '生产级日志清洗视图',
      description: '为 Prometheus / Grafana 提供结构化指标。',
      templateSql: `CREATE OR REPLACE VIEW v_clean_gateway_logs AS
SELECT 
  log_id,
  (payload_json->>'$.user.id')::INTEGER AS user_id,
  payload_json->>'$.user.tier' AS user_tier,
  payload_json->>'$.action' AS action_name,
  payload_json->>'$.meta.region' AS region,
  (payload_json->>'$.meta.retry_count')::INTEGER AS retry_count,
  status_code,
  latency_ms
FROM mock_api_logs;`
    }
  },
  {
    id: 'lesson_2_2_unnest_struct_list',
    trackId: 'data_lake',
    trackTitle: '数据湖与半结构化工程',
    order: 2,
    title: 'STRUCT 与 LIST 动态解构展开 (UNNEST)',
    subtitle: '将现代复合列存结构极速展开为标准化分析宽表',
    difficulty: 'Intermediate',
    estimatedMinutes: 12,
    tags: ['UNNEST', 'STRUCT', 'LIST', '宽表生成'],
    businessScenario: '购物车订单是以复合数组 `LIST<STRUCT<sku, qty, price>>` 形式存储以保证事务原子性，但数据团队需要按单个 SKU 统计销量排行，此时必须使用 UNNEST 算子行转列。',
    whyItMatters: '避免传统数据库使用复杂存储过程拆分数组，DuckDB 原生向量化 UNNEST 处理速度达每秒亿行。',
    antiPattern: '字符串分割 split(item, ",") 再手写递归循环。',
    bestPractice: '直接在 FROM 或 SELECT 中使用 `UNNEST(items)`。',
    inputTables: [
      {
        tableName: 'mock_cart_checkouts',
        description: '包含多商品的购物车检出流水表',
        columns: [
          { name: 'checkout_id', type: 'VARCHAR', comment: '结算单ID' },
          { name: 'user_id', type: 'INTEGER', comment: '买家ID' },
          { name: 'items', type: 'STRUCT[]', comment: '商品明细数组' }
        ],
        sampleRows: [
          { checkout_id: 'CHK-01', user_id: 101, items: [{ sku: 'SKU-APPLE', qty: 2, price: 12.5 }, { sku: 'SKU-MILK', qty: 1, price: 25.0 }] }
        ],
        setupSql: `CREATE OR REPLACE TEMP TABLE mock_cart_checkouts AS
SELECT 
  'CHK-' || lpad(cast(range as varchar), 4, '0') AS checkout_id,
  500 + (range % 15) AS user_id,
  [
    {'sku': 'SKU-P' || ((range * 3) % 8 + 1), 'qty': (range % 3) + 1, 'price': round(20.0 + (range * 5 % 50), 2)},
    {'sku': 'SKU-P' || ((range * 5) % 8 + 1), 'qty': (range % 2) + 1, 'price': round(40.0 + (range * 7 % 60), 2)}
  ] AS items
FROM range(1, 51);`
      }
    ],
    initialSql: `-- 展开每个结算单中的商品数组，并按 SKU 聚合总销售额
WITH flattened AS (
  SELECT 
    checkout_id,
    user_id,
    UNNEST(items) AS item
  FROM mock_cart_checkouts
)
SELECT 
  item.sku AS sku,
  SUM(item.qty) AS total_units_sold,
  ROUND(SUM(item.qty * item.price), 2) AS total_revenue
FROM flattened
GROUP BY item.sku
ORDER BY total_revenue DESC;`,
    steps: [
      {
        id: 's1',
        title: 'Step 1: 单独执行 UNNEST 观察行分裂效果',
        concept: 'UNNEST 数组展开机制',
        explanation: '1 行订单包含 2 件商品，展开后分裂为 2 行。',
        sql: `SELECT checkout_id, UNNEST(items) AS item FROM mock_cart_checkouts LIMIT 6;`
      }
    ],
    challenge: {
      title: '实战挑战：统计销量最高的 Top 3 SKU',
      description: '修改查询，展开 `mock_cart_checkouts` 中的商品数组，输出 `sku` 与 `total_units_sold`，按 `total_units_sold` 降序排列，仅返回前 3 名。',
      hint: '使用 UNNEST(items) 并在末尾使用 ORDER BY total_units_sold DESC LIMIT 3',
      starterSql: `WITH flattened AS (
  SELECT UNNEST(items) AS item FROM mock_cart_checkouts
)
SELECT 
  item.sku AS sku,
  SUM(item.qty) AS total_units_sold
FROM flattened
GROUP BY item.sku
-- 排序并截取前 3 名
;`,
      solutionSql: `WITH flattened AS (
  SELECT UNNEST(items) AS item FROM mock_cart_checkouts
)
SELECT 
  item.sku AS sku,
  SUM(item.qty) AS total_units_sold
FROM flattened
GROUP BY item.sku
ORDER BY total_units_sold DESC
LIMIT 3;`,
      targetColumns: ['sku', 'total_units_sold'],
      targetMinRows: 3,
      expectedExplanation: '成功解构数组宽表并输出热销前 3 商品。',
      requiredKeywords: ['UNNEST', 'GROUP BY', 'ORDER BY', 'LIMIT']
    },
    productionTemplate: {
      title: '商品级销售明细平铺视图',
      description: '打通购物车与仓储拣货系统。',
      templateSql: `CREATE OR REPLACE VIEW v_order_items_flattened AS
SELECT 
  c.checkout_id,
  c.user_id,
  i.sku,
  i.qty,
  i.price,
  round(i.qty * i.price, 2) AS subtotal_amount
FROM mock_cart_checkouts c,
UNNEST(c.items) AS i;`
    }
  }
];

// -------------------------------------------------------------
// 3. 轨迹三：高性能复杂分析与透视计算 (High Performance & OLAP)
// -------------------------------------------------------------
const TRACK_HIGH_PERF_LESSONS: IndustrialLesson[] = [
  {
    id: 'lesson_3_1_dynamic_pivot',
    trackId: 'high_perf',
    trackTitle: '高性能复杂分析与透视',
    order: 1,
    title: '动态 PIVOT 报表矩阵与多维行转列',
    subtitle: '告别冗长的 SUM(CASE WHEN)，一条指令生成财务季度对比宽表',
    difficulty: 'Intermediate',
    estimatedMinutes: 10,
    tags: ['PIVOT', '报表生成', '行转列', '财务分析'],
    businessScenario: '财务经营分析会需要每周向高管呈报各区域在各季度的营收对比大盘，传统方案需要手写 10 几个 SUM(CASE WHEN quarter = \'Q1\'...)，不仅容易漏字段，字段变更时维护成本极高。',
    whyItMatters: 'DuckDB 原生提供专用的 PIVOT 关键字，能够自动识别透视值或通过 ON 子句一行声明多维透视矩阵。',
    antiPattern: '手写多行 SUM(CASE WHEN quarter = \'Q1\' THEN rev ELSE 0 END) AS Q1...',
    bestPractice: '`PIVOT table ON quarter USING SUM(revenue) GROUP BY region`。',
    inputTables: [
      {
        tableName: 'mock_sales_quarterly',
        description: '各区域季度销售明细长表',
        columns: [
          { name: 'region', type: 'VARCHAR', comment: '销售大区' },
          { name: 'product_line', type: 'VARCHAR', comment: '产品线' },
          { name: 'quarter', type: 'VARCHAR', comment: '业务季度 (Q1/Q2/Q3/Q4)' },
          { name: 'revenue_k', type: 'DOUBLE', comment: '营收额 (千元)' }
        ],
        sampleRows: [
          { region: '华东区', product_line: '云原生数据库', quarter: 'Q1', revenue_k: 450.0 },
          { region: '华东区', product_line: '云原生数据库', quarter: 'Q2', revenue_k: 580.0 },
          { region: '华南区', product_line: '云原生数据库', quarter: 'Q1', revenue_k: 320.0 }
        ],
        setupSql: `CREATE OR REPLACE TEMP TABLE mock_sales_quarterly AS
SELECT 
  CASE (range % 3) WHEN 0 THEN '华东区' WHEN 1 THEN '华北区' ELSE '华南区' END AS region,
  CASE (range % 2) WHEN 0 THEN '云原生数据库' ELSE 'AI推理服务器' END AS product_line,
  'Q' || ((range % 4) + 1) AS quarter,
  round(300.0 + (range * 29 % 500), 1) AS revenue_k
FROM range(1, 49);`
      }
    ],
    initialSql: `-- 使用 PIVOT 将各季度作为列横向展开
PIVOT mock_sales_quarterly
ON quarter IN ('Q1', 'Q2', 'Q3', 'Q4')
USING SUM(revenue_k)
GROUP BY region, product_line
ORDER BY region, product_line;`,
    steps: [
      {
        id: 's1',
        title: 'Step 1: 观察长表在未透视前的状态',
        concept: '长表与宽表结构差异',
        explanation: '原始表按行堆叠，季度数据分散在多行中。',
        sql: `SELECT region, product_line, quarter, SUM(revenue_k) AS total FROM mock_sales_quarterly GROUP BY ALL ORDER BY region, quarter LIMIT 8;`
      }
    ],
    challenge: {
      title: '实战挑战：按产品线透视各季度的平均销售额',
      description: '编写 PIVOT 查询，按 `product_line` 分组，将 `quarter IN (\'Q1\', \'Q2\', \'Q3\', \'Q4\')` 透视为列，使用 `ROUND(AVG(revenue_k), 1)` 进行度量计算，按 `product_line` 升序排列。',
      hint: 'USING ROUND(AVG(revenue_k), 1) GROUP BY product_line',
      starterSql: `PIVOT mock_sales_quarterly
ON quarter IN ('Q1', 'Q2', 'Q3', 'Q4')
USING ROUND(AVG(revenue_k), 1)
GROUP BY product_line
ORDER BY product_line;`,
      solutionSql: `PIVOT mock_sales_quarterly
ON quarter IN ('Q1', 'Q2', 'Q3', 'Q4')
USING ROUND(AVG(revenue_k), 1)
GROUP BY product_line
ORDER BY product_line;`,
      targetColumns: ['product_line', 'Q1', 'Q2', 'Q3', 'Q4'],
      targetMinRows: 2,
      expectedExplanation: '成功输出各产品线按季度的均值透视矩阵。',
      requiredKeywords: ['PIVOT', 'ON', 'USING', 'GROUP BY']
    },
    productionTemplate: {
      title: '企业财务季度横向宽表视图',
      description: '对接 BI 工具呈现矩阵式热力图。',
      templateSql: `CREATE OR REPLACE VIEW v_financial_quarterly_matrix AS
PIVOT mock_sales_quarterly
ON quarter IN ('Q1', 'Q2', 'Q3', 'Q4')
USING ROUND(SUM(revenue_k), 2)
GROUP BY region, product_line;`
    }
  },
  {
    id: 'lesson_3_2_asof_join',
    trackId: 'high_perf',
    trackTitle: '高性能复杂分析与透视',
    order: 2,
    title: 'ASOF JOIN 时序非精确对齐与高频交易撮合',
    subtitle: '微秒级时序时间戳错位撮合，解决事件驱动金融计算难题',
    difficulty: 'Advanced',
    estimatedMinutes: 15,
    tags: ['ASOF_JOIN', '时序分析', '金融高频', '滑点测算'],
    businessScenario: '高频交易与物联网中，行情报价与成交事件的时间戳很难毫秒级完全相等。为了计算每笔成交当时的实时滑点，必须找到“小于等于成交时间点的最新一笔报价”。',
    whyItMatters: '传统 SQL 需要通过相关子查询找 `MAX(time) WHERE time <= trade_time` 再进行连接，复杂度高达 \(O(N \times M)\)。DuckDB 原生 ASOF JOIN 基于排序二分查找，性能高达每秒千万次撮合。',
    antiPattern: '通过 `LEFT JOIN quotes q ON t.trade_time >= q.quote_time` 再分组过滤，导致产生笛卡尔积爆炸。',
    bestPractice: '直接使用专用语法：`FROM trades t ASOF JOIN quotes q ON t.ticker = q.ticker AND t.trade_time >= q.quote_time`。',
    inputTables: [
      {
        tableName: 'mock_quotes',
        description: '高频行情盘口报价流 (Quote)',
        columns: [
          { name: 'ticker', type: 'VARCHAR', comment: '标的代码' },
          { name: 'quote_time', type: 'TIMESTAMP', comment: '报价时间戳' },
          { name: 'bid_price', type: 'DOUBLE', comment: '买一价' },
          { name: 'ask_price', type: 'DOUBLE', comment: '卖一价' }
        ],
        sampleRows: [
          { ticker: 'BTC-USDT', quote_time: '2026-09-20 10:00:00.100', bid_price: 65000.0, ask_price: 65001.0 },
          { ticker: 'BTC-USDT', quote_time: '2026-09-20 10:00:00.300', bid_price: 65002.0, ask_price: 65003.0 }
        ],
        setupSql: `CREATE OR REPLACE TEMP TABLE mock_quotes AS
SELECT 
  'BTC-USDT' AS ticker,
  '2026-09-20 10:00:00.000'::TIMESTAMP + INTERVAL (range * 200) MILLISECOND AS quote_time,
  round(65000.0 + (range * 3 % 50), 2) AS bid_price,
  round(65001.0 + (range * 3 % 50), 2) AS ask_price
FROM range(1, 101);`
      },
      {
        tableName: 'mock_trades',
        description: '实际发生的成交记录表 (Trade)',
        columns: [
          { name: 'trade_id', type: 'VARCHAR', comment: '成交编号' },
          { name: 'ticker', type: 'VARCHAR', comment: '标的代码' },
          { name: 'trade_time', type: 'TIMESTAMP', comment: '成交时间戳' },
          { name: 'executed_price', type: 'DOUBLE', comment: '成交价格' },
          { name: 'volume', type: 'DOUBLE', comment: '成交量' }
        ],
        sampleRows: [
          { trade_id: 'TRD-1', ticker: 'BTC-USDT', trade_time: '2026-09-20 10:00:00.150', executed_price: 65000.8, volume: 0.5 }
        ],
        setupSql: `CREATE OR REPLACE TEMP TABLE mock_trades AS
SELECT 
  'TRD-' || lpad(cast(range as varchar), 3, '0') AS trade_id,
  'BTC-USDT' AS ticker,
  '2026-09-20 10:00:00.050'::TIMESTAMP + INTERVAL (range * 450) MILLISECOND AS trade_time,
  round(65000.5 + (range * 3 % 50), 2) AS executed_price,
  round(0.1 + (range % 5) * 0.2, 2) AS volume
FROM range(1, 31);`
      }
    ],
    initialSql: `-- 使用 ASOF JOIN 将每笔成交与当时最新行情撮合
SELECT 
  t.trade_id,
  t.trade_time,
  t.executed_price,
  q.bid_price,
  q.ask_price,
  ROUND(t.executed_price - q.ask_price, 2) AS slippage_cny
FROM mock_trades t
ASOF JOIN mock_quotes q
  ON t.ticker = q.ticker
 AND t.trade_time >= q.quote_time
ORDER BY t.trade_time
LIMIT 10;`,
    steps: [
      {
        id: 's1',
        title: 'Step 1: 理解 ASOF 连接的单向时序特性',
        concept: 'ASOF JOIN 时间对齐',
        explanation: '条件必须包含一个不等式比较 (trade_time >= quote_time)。',
        sql: `SELECT count(*) AS total_matched FROM mock_trades t ASOF JOIN mock_quotes q ON t.ticker = q.ticker AND t.trade_time >= q.quote_time;`
      }
    ],
    challenge: {
      title: '实战挑战：输出所有滑点 > 0 的正向滑点成交记录',
      description: '编写查询，使用 ASOF JOIN 将 `mock_trades` 与 `mock_quotes` 撮合，输出 `trade_id`、`trade_time`、`executed_price`、`ask_price` 与滑点 `slippage_cny`，并过滤出 `executed_price > ask_price` 的单据。',
      hint: '在 WHERE 子句中添加 t.executed_price > q.ask_price',
      starterSql: `SELECT 
  t.trade_id,
  t.trade_time,
  t.executed_price,
  q.ask_price,
  ROUND(t.executed_price - q.ask_price, 2) AS slippage_cny
FROM mock_trades t
ASOF JOIN mock_quotes q
  ON t.ticker = q.ticker
 AND t.trade_time >= q.quote_time
-- 过滤条件
ORDER BY t.trade_time;`,
      solutionSql: `SELECT 
  t.trade_id,
  t.trade_time,
  t.executed_price,
  q.ask_price,
  ROUND(t.executed_price - q.ask_price, 2) AS slippage_cny
FROM mock_trades t
ASOF JOIN mock_quotes q
  ON t.ticker = q.ticker
 AND t.trade_time >= q.quote_time
WHERE t.executed_price > q.ask_price
ORDER BY t.trade_time;`,
      targetColumns: ['trade_id', 'trade_time', 'executed_price', 'ask_price', 'slippage_cny'],
      targetMinRows: 1,
      expectedExplanation: '成功利用 ASOF JOIN 捕获高频行情中的正向执行滑点。',
      requiredKeywords: ['ASOF JOIN', 'ON', 'ROUND']
    },
    productionTemplate: {
      title: '生产级时序行情撮合与滑点监控视图',
      description: '量化交易回测与执行风控标配。',
      templateSql: `CREATE OR REPLACE VIEW v_trade_slippage_audit AS
SELECT 
  t.trade_id,
  t.ticker,
  t.trade_time,
  t.executed_price,
  t.volume,
  q.quote_time AS latest_quote_time,
  q.bid_price,
  q.ask_price,
  ROUND(t.executed_price - q.ask_price, 3) AS ask_slippage,
  ROUND(t.executed_price - q.bid_price, 3) AS bid_slippage
FROM mock_trades t
ASOF JOIN mock_quotes q
  ON t.ticker = q.ticker
 AND t.trade_time >= q.quote_time;`
    }
  }
];

// -------------------------------------------------------------
// 4. 轨迹四：Palantir 级企业本体建模 (Enterprise Ontology & OPLA)
// -------------------------------------------------------------
const TRACK_ENTERPRISE_OPLA_LESSONS: IndustrialLesson[] = [
  {
    id: 'lesson_4_1_coldchain_full_opla',
    trackId: 'enterprise_opla',
    trackTitle: '企业级本体认知与建模',
    order: 1,
    title: '顺达冷链：温控异常与物流事故因果图谱建模',
    subtitle: '从 Object/Property 到 Link/Action，打通可追溯的现实证据闭环',
    difficulty: 'Advanced',
    estimatedMinutes: 20,
    tags: ['OPLA建模', '冷链物流', '图关系', '事件溯源'],
    businessScenario: '顺达冷链承担深海三文鱼干线履约，一批货值 18.5 万元的生鲜在交付时严重变质。由于传统系统只有离散的 GPS 表、订单表与派车单，各部门互相扯皮。通过 OPLA 四步法建立本体图谱，使物理世界的传感器温度超标不可篡改地与责任动作闭环绑定。',
    whyItMatters: '企业级数据中台不能停留在孤立的数据表，本体论 (Ontology) 将数据提升为具备业务因果推理与自动化决策执行的数字孪生。',
    antiPattern: '把温超事故、责任人、理赔状态直接作为几个普通字段揉进订单表，导致关系拓扑丢失。',
    bestPractice: '将事故抽象为独立 Event Object，通过 transported_by 与 monitored_by 构建显式 Link，通过 Action 驱动状态变迁。',
    inputTables: [
      {
        tableName: 'obj_shipment_order',
        description: '冷链货运订单核心实体',
        columns: [
          { name: 'order_id', type: 'VARCHAR', comment: '运单号' },
          { name: 'cargo_type', type: 'VARCHAR', comment: '货物类型' },
          { name: 'cargo_value_cny', type: 'DOUBLE', comment: '货值(元)' },
          { name: 'max_temp_celsius', type: 'DOUBLE', comment: '允许最高温' }
        ],
        sampleRows: [
          { order_id: 'ORD-2026-0901', cargo_type: '冰鲜三文鱼', cargo_value_cny: 185000.0, max_temp_celsius: 4.0 }
        ],
        setupSql: `CREATE OR REPLACE TEMP TABLE obj_shipment_order AS
SELECT 'ORD-2026-0901' AS order_id, '冰鲜三文鱼' AS cargo_type, 185000.0 AS cargo_value_cny, 4.0 AS max_temp_celsius;

CREATE OR REPLACE TEMP TABLE obj_reefer_truck AS
SELECT 'TRUCK-LN-8892' AS truck_id, '张建国' AS driver_name, 'ON_ROUTE' AS truck_status;

CREATE OR REPLACE TEMP TABLE obj_temp_sensor AS
SELECT 'SENSOR-RF-004' AS sensor_id, 'TRUCK-LN-8892' AS attached_truck, 8.2 AS latest_temp;

CREATE OR REPLACE TEMP TABLE link_transported_by AS
SELECT 'ORD-2026-0901' AS order_id, 'TRUCK-LN-8892' AS truck_id;`
      }
    ],
    initialSql: `-- 跨 OPLA 语义层跨实体因果追因分析
SELECT 
  o.order_id,
  o.cargo_type,
  o.max_temp_celsius AS threshold_temp,
  s.latest_temp AS current_sensor_temp,
  t.driver_name,
  CASE 
    WHEN s.latest_temp > o.max_temp_celsius THEN 'CRITICAL_BREACH_ALERT'
    ELSE 'NORMAL'
  END AS risk_verdict
FROM obj_shipment_order o
JOIN link_transported_by l1 ON o.order_id = l1.order_id
JOIN obj_reefer_truck t ON l1.truck_id = t.truck_id
JOIN obj_temp_sensor s ON t.truck_id = s.attached_truck;`,
    steps: [
      {
        id: 's1',
        title: 'Step 1: 验证实体间 Link 拓扑关联',
        concept: '从运单经由货车穿透到传感器',
        explanation: '三表通过明确语义的 Link 关联，清晰定位责任车辆。',
        sql: `SELECT o.order_id, t.driver_name, s.latest_temp FROM obj_shipment_order o JOIN link_transported_by l1 ON o.order_id = l1.order_id JOIN obj_reefer_truck t ON l1.truck_id = t.truck_id JOIN obj_temp_sensor s ON t.truck_id = s.attached_truck;`
      }
    ],
    challenge: {
      title: '实战挑战：输出超温风险预警与温差幅度',
      description: '修改查询，输出字段包括 `order_id`、`cargo_type`、`driver_name`、`temp_overshoot`（即 `current_sensor_temp - threshold_temp`），并筛选出 `temp_overshoot > 0` 的超温违规运单。',
      hint: '计算 (s.latest_temp - o.max_temp_celsius) AS temp_overshoot',
      starterSql: `SELECT 
  o.order_id,
  o.cargo_type,
  t.driver_name,
  ROUND(s.latest_temp - o.max_temp_celsius, 1) AS temp_overshoot
FROM obj_shipment_order o
JOIN link_transported_by l1 ON o.order_id = l1.order_id
JOIN obj_reefer_truck t ON l1.truck_id = t.truck_id
JOIN obj_temp_sensor s ON t.truck_id = s.attached_truck
WHERE s.latest_temp > o.max_temp_celsius;`,
      solutionSql: `SELECT 
  o.order_id,
  o.cargo_type,
  t.driver_name,
  ROUND(s.latest_temp - o.max_temp_celsius, 1) AS temp_overshoot
FROM obj_shipment_order o
JOIN link_transported_by l1 ON o.order_id = l1.order_id
JOIN obj_reefer_truck t ON l1.truck_id = t.truck_id
JOIN obj_temp_sensor s ON t.truck_id = s.attached_truck
WHERE s.latest_temp > o.max_temp_celsius;`,
      targetColumns: ['order_id', 'cargo_type', 'driver_name', 'temp_overshoot'],
      targetMinRows: 1,
      expectedExplanation: '精准定位因冷机故障导致的超温严重违规事件。',
      requiredKeywords: ['JOIN', 'WHERE', 'AS']
    },
    productionTemplate: {
      title: 'OPLA 冷链因果风控决策视图',
      description: '驱动自动化应急调度与保险预定损。',
      templateSql: `CREATE OR REPLACE VIEW v_opla_coldchain_risk AS
SELECT 
  o.order_id,
  o.cargo_type,
  o.cargo_value_cny,
  t.truck_id,
  t.driver_name,
  s.sensor_id,
  s.latest_temp,
  o.max_temp_celsius,
  ROUND(s.latest_temp - o.max_temp_celsius, 2) AS overshoot_celsius,
  CURRENT_TIMESTAMP AS audit_checked_at
FROM obj_shipment_order o
JOIN link_transported_by l1 ON o.order_id = l1.order_id
JOIN obj_reefer_truck t ON l1.truck_id = t.truck_id
JOIN obj_temp_sensor s ON t.truck_id = s.attached_truck;`
    }
  }
];

// -------------------------------------------------------------
// 聚合全部轨迹元数据
// -------------------------------------------------------------
export const ALL_TRACKS: TrackMeta[] = [
  {
    id: 'modern_sql',
    title: '现代 SQL 分析大师',
    tagline: 'Modern SQL & Analytics Pro',
    description: '从电商漏斗、QUALIFY 窗口去重到滑动移动均线与 ARG_MAX 极值快照。',
    iconName: 'Terminal',
    accentColor: '#a6e22e', // Monokai Green
    badgeBg: 'bg-emerald-500/10',
    badgeBorder: 'border-emerald-500/30',
    badgeText: 'text-emerald-400',
    lessons: TRACK_MODERN_SQL_LESSONS,
  },
  {
    id: 'data_lake',
    title: '数据湖与半结构化工程',
    tagline: 'Data Lakehouse & JSON Wrangling',
    description: '深入 JSON 深层萃取、STRUCT/LIST 动态解构 UNNEST 与列存剪枝。',
    iconName: 'Layers',
    accentColor: '#66d9ef', // Monokai Cyan
    badgeBg: 'bg-cyan-500/10',
    badgeBorder: 'border-cyan-500/30',
    badgeText: 'text-cyan-400',
    lessons: TRACK_DATA_LAKE_LESSONS,
  },
  {
    id: 'high_perf',
    title: '高性能复杂分析与透视',
    tagline: 'High-Performance & OLAP Mastery',
    description: '动态 PIVOT 行转列、ASOF JOIN 时序撮合与 Jaro-Winkler 模糊对齐。',
    iconName: 'TrendingUp',
    accentColor: '#fd971f', // Monokai Orange
    badgeBg: 'bg-amber-500/10',
    badgeBorder: 'border-amber-500/30',
    badgeText: 'text-amber-400',
    lessons: TRACK_HIGH_PERF_LESSONS,
  },
  {
    id: 'enterprise_opla',
    title: '企业级本体认知与建模',
    tagline: 'Palantir OPLA Enterprise Modeling',
    description: '顺达冷链、智慧医院与金融风控，打通现实证据与业务因果闭环。',
    iconName: 'Compass',
    accentColor: '#f92672', // Monokai Rose/Magenta
    badgeBg: 'bg-rose-500/10',
    badgeBorder: 'border-rose-500/30',
    badgeText: 'text-rose-400',
    lessons: TRACK_ENTERPRISE_OPLA_LESSONS,
  }
];

export const ALL_INDUSTRIAL_LESSONS: IndustrialLesson[] = ALL_TRACKS.flatMap(t => t.lessons);

export function getLessonById(id: string): IndustrialLesson | undefined {
  return ALL_INDUSTRIAL_LESSONS.find(l => l.id === id);
}
