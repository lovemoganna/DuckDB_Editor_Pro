---
id: "ontology-duckdb-runnable"
type: "note"
isFavorite: false
createdAt: "2026-09-27T08:00:00.000Z"
updatedAt: "2026-09-27T08:00:00.000Z"
tags:
  - "本体建模"
  - "DuckDB"
  - "Palantir"
  - "航空调度"
  - "递归图算法"
  - "Ontology"
  - "进阶教程"
title: "用 DuckDB 建模 Palantir Ontology 元结构：智能航空航线与机队调度动态图谱"
topic: "best_practice"
summary: "以 Palantir 标杆 Skywise 航空协作网络为真实业务宇宙，将 Object（机场/机队/航班/旅客/预订）、Link（航线网络拓扑）、State（航班时序状态机）、Action（调度与航延干预）融为一体，开箱即跑，驱动本体图谱与递归图算法实时展现。"
---

# 用 DuckDB 建模 Palantir Ontology 元结构 · 智能航空航线与机队调度动态图谱

## 航空调度业务本体 · Skywise 航线网络与状态机闭环

**难度等级**：L2 - L3（从航网拓扑关系到复杂图递归遍历与动态调度）  
**前置依赖**：无（完整内嵌国际机场、机队、航班与预订种子数据，独立闭环，开箱即跑）  
**核心教学原则**：
> **先让用户用真实数据跑通、看到结果、理解为什么，再解释概念。**  
> 以 Palantir Foundry 全球最著名的工业标杆——**空中客车 Skywise 航空大数据本体**为原型，构建真实的机场枢纽、飞机机队、动态航班、旅客预订与调度动作。右侧本体图谱将实时生成立体的航线拓扑网络与状态流转图。

---

## 一、学习目标与领域定位

完成本实战教程后，你将能够：

1. **掌握航空工业级本体模型的数据库实现**：
   * **Object**：以关系表定义全球机场枢纽、飞机机架、航班航次、旅客画像与机票预订（`airports`, `aircrafts`, `flights`, `passengers`, `bookings`）；
   * **Link**：构建由起点/终点空港构成的有向航网拓扑、机架执飞关联以及旅客订座归属；
   * **State**：以时序状态机跟踪航班生命演化（`SCHEDULED` → `BOARDING` → `DEPARTED` → `IN_AIR` → `LANDED` / `DELAYED`）；
   * **Action**：以调度日志（`flight_dispatches`）记录空管指令、航延处置与机型轮转。
2. **掌握 DuckDB 递归 CTE（Recursive CTE）实现图路径搜索**：在多跳航线拓扑中，自动寻找两地之间的联程转机航班方案并累加飞行时长。
3. **掌握航延风控与机队周转瓶颈排查**：计算起飞延误时长，分析故障机架引发的串联延误蝴蝶效应。
4. **掌握机场枢纽吞吐量度量**：基于进出港流量统计枢纽连接度与航线客座率（Load Factor）。

---

## 二、领域概念说明（本体论锚定）

### 1. Palantir Ontology 四元组映射表

| Palantir 元概念 | 本质定义 | 本教程数据库落地表 | 业务现实对应 |
| :--- | :--- | :--- | :--- |
| **Object** | 承载业务属性的实体类型与实例 | `airports`, `aircrafts`, `flights`, `passengers`, `bookings` | 机场、客机机队、航班航次、旅客、机票预订 |
| **Link** | 跨对象实体间的有向语义关系 | 外键约束与关联网 | 航班从始发港起飞、执飞客机、旅客订购指定航班 |
| **State** | 实体对象生命周期中的状态节点 | `status` 状态枚举与时序列 | 航班处于计划、登机、起飞、空中巡航、降落状态 |
| **Action** | 改变实体属性或状态的调度干预操作 | `flight_dispatches` 调度记录表 | 气象延误指令、机组轮换、备降申请、取消放行 |

### 2. 核心实体（Entities）

| 实体 | 业务含义 | 数据库角色 / 主键 | 核心业务属性 |
| :--- | :--- | :--- | :--- |
| **机场枢纽（Airports）** | 航线网络的物理拓扑节点 | 维度表 (`airport_id` VARCHAR PK) | 三字代码（IATA）、机场全称、所在城市、经纬度坐标 |
| **飞机机队（Aircrafts）** | 承载客运运输的物理航空器 | 实体表 (`tail_number` VARCHAR PK) | 机尾号、客机型号、制造商、载客客容量、服役状态 |
| **航班航次（Flights）** | 在特定时刻执行的时序运输事件 | 实体表 (`flight_id` VARCHAR PK) | 航班号、起飞/降落机场、计划与实际起降时间、当前状态 |
| **旅客画像（Passengers）** | 航空公司的会员与乘机客户 | 实体表 (`passenger_id` VARCHAR PK) | 姓名、会员层级（白金/金卡/普卡）、国籍 |
| **机票预订（Bookings）** | 旅客发起的座位预留凭据 | 事实表 (`booking_id` VARCHAR PK) | 关联合班、关联旅客、座位号、舱位等级、票价（元） |
| **调度记录（Flight Dispatches）**| 空管与签派中心的调度指令 Action | 事实表 (`dispatch_id` VARCHAR PK) | 作用航班、调度指令、延误分钟数、延误归因、调度时间 |

### 3. 核心语义关联（Semantic Relations）

| 关系连线 | 语义解释 | 外键关联字段 |
| :--- | :--- | :--- |
| `flights → aircrafts` | 航班由指定机架客机实际执飞 | `flights.aircraft_tail = aircrafts.tail_number` |
| `flights → airports (origin)` | 航班从指定的始发机场起飞离港 | `flights.origin_airport_id = airports.airport_id` |
| `flights → airports (dest)` | 航班在指定的目的机场进港降落 | `flights.dest_airport_id = airports.airport_id` |
| `bookings → flights` | 订座凭据锁定指定航班航次 | `bookings.flight_id = flights.flight_id` |
| `bookings → passengers` | 订座凭据由指定旅客持有 | `bookings.passenger_id = passengers.passenger_id` |
| `flight_dispatches → flights` | 调度与延误处置动作作用于指定航班 | `flight_dispatches.flight_id = flights.flight_id` |

---

## 三、步骤一：读取（Read & Ingest）· 数据定义与入库

在 DuckDB 中建立标准的 6 张业务表，并装载真实自洽的国际航网种子数据。

### 1️⃣ DDL：建表定义

```sql
CREATE TABLE airports (
    airport_id VARCHAR PRIMARY KEY,
    iata_code VARCHAR(3) NOT NULL UNIQUE,
    name VARCHAR NOT NULL,
    city VARCHAR NOT NULL,
    country VARCHAR(2) NOT NULL,
    latitude DECIMAL(9, 6) NOT NULL,
    longitude DECIMAL(9, 6) NOT NULL
);

CREATE TABLE aircrafts (
    tail_number VARCHAR PRIMARY KEY,
    model VARCHAR NOT NULL,
    manufacturer VARCHAR NOT NULL,
    capacity INTEGER NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'ACTIVE',
    manufacture_year INTEGER NOT NULL
);

CREATE TABLE flights (
    flight_id VARCHAR PRIMARY KEY,
    flight_no VARCHAR NOT NULL,
    aircraft_tail VARCHAR NOT NULL,
    origin_airport_id VARCHAR NOT NULL,
    dest_airport_id VARCHAR NOT NULL,
    scheduled_departure TIMESTAMP NOT NULL,
    scheduled_arrival TIMESTAMP NOT NULL,
    actual_departure TIMESTAMP,
    actual_arrival TIMESTAMP,
    status VARCHAR NOT NULL DEFAULT 'SCHEDULED',
    FOREIGN KEY (aircraft_tail) REFERENCES aircrafts(tail_number),
    FOREIGN KEY (origin_airport_id) REFERENCES airports(airport_id),
    FOREIGN KEY (dest_airport_id) REFERENCES airports(airport_id)
);

CREATE TABLE passengers (
    passenger_id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    tier VARCHAR NOT NULL DEFAULT 'REGULAR',
    nationality VARCHAR(2) NOT NULL
);

CREATE TABLE bookings (
    booking_id VARCHAR PRIMARY KEY,
    flight_id VARCHAR NOT NULL,
    passenger_id VARCHAR NOT NULL,
    seat_no VARCHAR NOT NULL,
    class VARCHAR NOT NULL DEFAULT 'ECONOMY',
    fare DECIMAL(10, 2) NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'CONFIRMED',
    booking_time TIMESTAMP NOT NULL,
    FOREIGN KEY (flight_id) REFERENCES flights(flight_id),
    FOREIGN KEY (passenger_id) REFERENCES passengers(passenger_id)
);

CREATE TABLE flight_dispatches (
    dispatch_id VARCHAR PRIMARY KEY,
    flight_id VARCHAR NOT NULL,
    action_type VARCHAR NOT NULL,
    reason VARCHAR,
    delay_minutes INTEGER NOT NULL DEFAULT 0,
    dispatch_time TIMESTAMP NOT NULL,
    FOREIGN KEY (flight_id) REFERENCES flights(flight_id)
);
```

### 2️⃣ DML：真实种子数据装载

```sql
-- 1. 枢纽机场 (5座核心枢纽)
INSERT INTO airports VALUES
('APT_PEK', 'PEK', '北京首都国际机场', 'Beijing',   'CN', 40.080111, 116.584556),
('APT_SHA', 'SHA', '上海虹桥国际机场', 'Shanghai',  'CN', 31.197875, 121.336319),
('APT_SZX', 'SZX', '深圳宝安国际机场', 'Shenzhen',  'CN', 22.639258, 113.810664),
('APT_SIN', 'SIN', '新加坡樟宜国际机场', 'Singapore', 'SG',  1.350189, 103.994433),
('APT_HND', 'HND', '东京羽田国际机场', 'Tokyo',     'JP', 35.552258, 139.779694);

-- 2. 机队机架 (3架主流宽体/窄体客机)
INSERT INTO aircrafts VALUES
('B-7890', 'Boeing 787-9',      'Boeing', 290, 'ACTIVE', 2021),
('B-3501', 'Airbus A350-900',   'Airbus', 315, 'ACTIVE', 2022),
('B-3205', 'Airbus A320neo',    'Airbus', 180, 'ACTIVE', 2020);

-- 3. 航班航次数据 (涵盖直飞与中转连通航线)
INSERT INTO flights VALUES
('FL_101', 'CA1831', 'B-3205', 'APT_PEK', 'APT_SHA', '2026-03-27 08:00:00', '2026-03-27 10:15:00', '2026-03-27 08:05:00', '2026-03-27 10:10:00', 'LANDED'),
('FL_102', 'MU5105', 'B-7890', 'APT_SHA', 'APT_SIN', '2026-03-27 12:30:00', '2026-03-27 18:00:00', '2026-03-27 13:15:00', NULL,                  'IN_AIR'),
('FL_103', 'CZ3155', 'B-3501', 'APT_PEK', 'APT_SZX', '2026-03-27 09:30:00', '2026-03-27 13:00:00', '2026-03-27 10:45:00', NULL,                  'IN_AIR'),
('FL_104', 'SQ805',  'B-7890', 'APT_SZX', 'APT_SIN', '2026-03-27 15:00:00', '2026-03-27 19:15:00', NULL,                  NULL,                  'SCHEDULED'),
('FL_105', 'JL086',  'B-3501', 'APT_PEK', 'APT_HND', '2026-03-27 14:00:00', '2026-03-27 18:20:00', NULL,                  NULL,                  'SCHEDULED');

-- 4. 旅客画像 (5位不同会籍旅客)
INSERT INTO passengers VALUES
('PA_001', 'Li Wei',       'PLATINUM', 'CN'),
('PA_002', 'Sarah Connor', 'GOLD',     'US'),
('PA_003', 'Kenji Sato',   'REGULAR',  'JP'),
('PA_004', 'Maria Santos', 'SILVER',   'BR'),
('PA_005', 'Zhang Min',    'PLATINUM', 'CN');

-- 5. 订座流水 (6笔预订)
INSERT INTO bookings VALUES
('BK_901', 'FL_101', 'PA_001', '02A', 'BUSINESS', 3200.00, 'CONFIRMED', '2026-03-20 10:15:00'),
('BK_902', 'FL_102', 'PA_001', '01K', 'BUSINESS', 8500.00, 'CONFIRMED', '2026-03-20 10:20:00'),
('BK_903', 'FL_101', 'PA_002', '15F', 'ECONOMY',   980.00, 'CONFIRMED', '2026-03-22 14:30:00'),
('BK_904', 'FL_103', 'PA_003', '21C', 'ECONOMY',  1450.00, 'CONFIRMED', '2026-03-24 09:00:00'),
('BK_905', 'FL_104', 'PA_004', '18A', 'ECONOMY',  2800.00, 'CONFIRMED', '2026-03-25 11:45:00'),
('BK_906', 'FL_105', 'PA_005', '03D', 'BUSINESS', 6200.00, 'CONFIRMED', '2026-03-26 16:10:00');

-- 6. 调度干预记录 (Dispatches)
INSERT INTO flight_dispatches VALUES
('DSP_01', 'FL_102', 'DEPARTURE_DELAY', '机务前序过站检查耗时增加', 45, '2026-03-27 12:00:00'),
('DSP_02', 'FL_103', 'AIR_TRAFFIC_HOLD', '华北空域流量动态管制',   75, '2026-03-27 09:10:00');
```

### 3️⃣ 校验读取结果

```sql
SELECT 'airports' AS entity, count(*) AS count FROM airports
UNION ALL
SELECT 'aircrafts', count(*) FROM aircrafts
UNION ALL
SELECT 'flights', count(*) FROM flights
UNION ALL
SELECT 'passengers', count(*) FROM passengers
UNION ALL
SELECT 'bookings', count(*) FROM bookings
UNION ALL
SELECT 'flight_dispatches', count(*) FROM flight_dispatches;
```

#### 预期结果与理解为什么：
* 5 座枢纽、3 架客机、5 个代表性航班、5 位旅客、6 张客票预订、2 笔调度动作。
* **本体图谱动态生成**：右侧图谱自动解析出以 `Airports`、`Aircrafts`、`Flights`、`Passengers`、`Bookings` 为核心的对象类型，并自动生成了机场起降与机队执飞的语义连接拓扑。

---

## 四、步骤二：查询（Query & Projection）· 航线运行拓扑透视

先跑代码，查看今天所有航班的起降机场与实际执行客机信息：

### 查询 1：今日航班执行全景拓扑

```sql
SELECT 
    f.flight_no,
    orig.name AS origin_airport,
    dest.name AS dest_airport,
    a.model AS aircraft_model,
    a.tail_number,
    f.status AS flight_status,
    f.scheduled_departure,
    f.actual_departure
FROM flights f
JOIN airports orig ON f.origin_airport_id = orig.airport_id
JOIN airports dest ON f.dest_airport_id = dest.airport_id
JOIN aircrafts a ON f.aircraft_tail = a.tail_number
ORDER BY f.scheduled_departure;
```

#### 预期结果与为什么：
* 清楚呈现 5 个航班的航线起落：
  * CA1831: 北京首都 → 上海虹桥 (A320neo / B-3205)，状态 `LANDED`；
  * MU5105: 上海虹桥 → 新加坡樟宜 (B787-9 / B-7890)，状态 `IN_AIR`；
  * CZ3155: 北京首都 → 深圳宝安 (A350-900 / B-3501)，状态 `IN_AIR`。
* **业务价值**：打通了始发港、目的港与执飞机型的立体关联，构建起最基础的航线网络。

---

## 五、步骤三：筛选（Filter & Predicates）· 航班延误风控排查

在航空运营中，重点关注起飞延误超过 30 分钟的异常航班，以便及时向联程旅客触发改签建议。

### 查询 2：排查实际发生严重延误的离港航班

```sql
SELECT 
    f.flight_no,
    orig.iata_code AS origin,
    dest.iata_code AS destination,
    f.scheduled_departure,
    f.actual_departure,
    date_diff('minute', f.scheduled_departure, f.actual_departure) AS delay_minutes,
    f.status
FROM flights f
JOIN airports orig ON f.origin_airport_id = orig.airport_id
JOIN airports dest ON f.dest_airport_id = dest.airport_id
WHERE f.actual_departure IS NOT NULL
  AND date_diff('minute', f.scheduled_departure, f.actual_departure) >= 30
ORDER BY delay_minutes DESC;
```

#### 预期结果与为什么：
* 精确捕捉到 2 个延误航班：
  * `CZ3155` (PEK → SZX)：计划 09:30，实际 10:45，延误 **75 分钟**；
  * `MU5105` (SHA → SIN)：计划 12:30，实际 13:15，延误 **45 分钟**。
* **业务价值**：系统可自动将这两笔异常数据推向航变处置工作台，提前安排地面保障。

---

## 六、步骤四：聚合（Aggregate & Grouping）· 机场枢纽吞吐量度量

### 查询 3：计算各大机场的进出港航班量与连接度

```sql
WITH airport_traffic AS (
    SELECT origin_airport_id AS airport_id, 1 AS is_outbound, 0 AS is_inbound FROM flights
    UNION ALL
    SELECT dest_airport_id AS airport_id, 0 AS is_outbound, 1 AS is_inbound FROM flights
)
SELECT 
    a.iata_code,
    a.name AS airport_name,
    a.city,
    SUM(t.is_outbound) AS outbound_flights,
    SUM(t.is_inbound) AS inbound_flights,
    COUNT(*) AS total_movements
FROM airport_traffic t
JOIN airports a ON t.airport_id = a.airport_id
GROUP BY a.airport_id, a.iata_code, a.name, a.city
ORDER BY total_movements DESC;
```

#### 预期结果与为什么：
* 北京首都（PEK）总吞吐量最高（3 架次出港，总计 3 架次，为核心始发枢纽）；
* 新加坡樟宜（SIN）总计 2 架次进港，是国际枢纽到达地；
* 上海虹桥（SHA）1 架次进港、1 架次出港，呈现典型的中转联程枢纽特征。

---

## 七、步骤五：关联（Join & Entity Linking）· 旅客联程机票与行程打通

在航空服务中，识别旅客的转机联程路径至关重要。

### 查询 4：白金卡旅客 Li Wei 的联程订座行程单

```sql
SELECT 
    p.name AS passenger_name,
    p.tier AS loyalty_tier,
    b.booking_id,
    f.flight_no,
    orig.iata_code AS from_airport,
    dest.iata_code AS to_airport,
    f.scheduled_departure,
    b.seat_no,
    b.class,
    b.fare
FROM bookings b
JOIN passengers p ON b.passenger_id = p.passenger_id
JOIN flights f ON b.flight_id = f.flight_id
JOIN airports orig ON f.origin_airport_id = orig.airport_id
JOIN airports dest ON f.dest_airport_id = dest.airport_id
WHERE p.passenger_id = 'PA_001'
ORDER BY f.scheduled_departure;
```

#### 预期结果与为什么：
* 返回 Li Wei（白金卡会员）的 2 张商务舱机票：
  1. `CA1831`: PEK (北京) → SHA (上海虹桥)，08:00 起飞；
  2. `MU5105`: SHA (上海虹桥) → SIN (新加坡)，12:30 起飞。
* **业务价值**：旅客在上海虹桥有 2 小时 15 分钟的充裕中转时间，系统可自动在行李系统中标记“联程行李直挂”，提升高净值旅客体验。

---

## 八、步骤六：验证（Validate & 图递归运算）· Recursive CTE 自动寻找中转转机方案

这是 Palantir 图计算能力在 DuckDB 上的典型体现：**给定起点和终点，自动在拓扑网络中递归搜索所有「直达 + 一次中转」的飞行方案与总用时**！

### 查询 5：递归图遍历 —— 查找从北京（PEK）到新加坡（SIN）的所有可行航线

```sql
WITH RECURSIVE flight_routes AS (
    -- 1. 基础锚点：所有从 PEK 起飞的直达航班
    SELECT 
        f.flight_id,
        f.flight_no,
        orig.iata_code AS origin,
        dest.iata_code AS destination,
        f.scheduled_departure,
        f.scheduled_arrival,
        date_diff('minute', f.scheduled_departure, f.scheduled_arrival) AS total_flight_minutes,
        orig.iata_code || ' -> ' || dest.iata_code AS route_path,
        1 AS hops
    FROM flights f
    JOIN airports orig ON f.origin_airport_id = orig.airport_id
    JOIN airports dest ON f.dest_airport_id = dest.airport_id
    WHERE orig.iata_code = 'PEK'

    UNION ALL

    -- 2. 递归项：在中转港续接出发的下一程航班 (转机留存时间在 60-360 分钟之间)
    SELECT 
        next_f.flight_id,
        r.flight_no || ' + ' || next_f.flight_no,
        r.origin,
        next_dest.iata_code,
        r.scheduled_departure,
        next_f.scheduled_arrival,
        r.total_flight_minutes + date_diff('minute', next_f.scheduled_departure, next_f.scheduled_arrival),
        r.route_path || ' -> ' || next_dest.iata_code,
        r.hops + 1
    FROM flight_routes r
    JOIN airports current_dest ON r.destination = current_dest.iata_code
    JOIN flights next_f ON current_dest.airport_id = next_f.origin_airport_id
    JOIN airports next_dest ON next_f.dest_airport_id = next_dest.airport_id
    WHERE r.hops < 3
      AND next_f.scheduled_departure >= r.scheduled_arrival + INTERVAL '60 minutes'
      AND next_f.scheduled_departure <= r.scheduled_arrival + INTERVAL '360 minutes'
)
SELECT 
    route_path,
    flight_no AS flight_combination,
    scheduled_departure AS journey_start,
    scheduled_arrival AS journey_end,
    total_flight_minutes,
    hops
FROM flight_routes
WHERE destination = 'SIN'
ORDER BY total_flight_minutes;
```

#### 预期结果与为什么：
* 自动计算并输出转机路径：
  * `PEK -> SHA -> SIN`（经上海中转）；
  * 组合航班：`CA1831 + MU5105`；
  * 总航程纯飞行耗时：465 分钟（135分钟 + 330分钟）；
  * 中转停靠（Hops）：2 跳。
* **核心概念解析**：`WITH RECURSIVE` 是分析图遍历、供应链多阶 BOM、资金穿透追踪的最强 SQL 工具，DuckDB 能够在内存中高速执行有向图的拓扑展开。

---

## 九、步骤七：输出（Output & Advanced Insights）· 调度动作追溯与延误归因

### 查询 6：调度指令 Action 归因与航线收益大盘

```sql
SELECT 
    f.flight_no,
    a.iata_code AS departure_airport,
    d.action_type,
    d.reason AS delay_reason,
    d.delay_minutes,
    COUNT(b.booking_id) AS impacted_passengers,
    SUM(b.fare) AS total_revenue_impact
FROM flight_dispatches d
JOIN flights f ON d.flight_id = f.flight_id
JOIN airports a ON f.origin_airport_id = a.airport_id
LEFT JOIN bookings b ON f.flight_id = b.flight_id
GROUP BY f.flight_no, a.iata_code, d.action_type, d.reason, d.delay_minutes
ORDER BY d.delay_minutes DESC;
```

#### 预期结果与为什么：
* `CZ3155`（PEK 始发）：受“华北空域流量动态管制”延误 75 分钟，波及 1 位旅客（客票 1,450 元）；
* `MU5105`（SHA 始发）：受“机务前序过站检查耗时”延误 45 分钟，波及 1 位白金卡高端商务旅客（客票 8,500 元）。
* **决策价值**：空管管制属于不可抗力，但机务前序过站属于航司自身地面保障瓶颈，机务主管必须针对 SHA 站点的过站标准作业流程（SOP）进行专项优化。

---

## 十、总结与本体图谱映射

通过本篇教程，我们完整落地了航空调度网络的动态图谱模型：

1. **Object**：以全球枢纽 `Airports`、高价值机架 `Aircrafts`、航班 `Flights` 与乘机人 `Passengers` 构成自描述实体资产。
2. **Link**：构建了进港、出港、执飞、订座多维度的语义连线拓扑。
3. **State**：航班生命周期在调度与飞行过程中演进（`SCHEDULED` → `IN_AIR` → `LANDED`）。
4. **Action**：调度中心的指令（`flight_dispatches`）真实驱动延误归因与航班改派。

右侧本体图谱已同步生成该领域的动态航网实体与实例网络，完美展现真实世界的物理拓扑与业务逻辑。
