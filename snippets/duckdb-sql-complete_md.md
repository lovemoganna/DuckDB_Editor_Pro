---
id: "duckdb-sql-complete"
type: "note"
isFavorite: false
createdAt: "2026-09-27T08:00:00.000Z"
updatedAt: "2026-09-27T08:00:00.000Z"
tags:
  - "DuckDB"
  - "本体建模"
  - "资金流向"
  - "交易所"
  - "风控对账"
  - "SQL"
  - "入门教程"
title: "DuckDB SQL 完整使用教程 (交易所资金流向与业务风控全局体系)"
topic: "best_practice"
summary: "以 Google Sheets 交易所资金流向真实数据（users / fiat_transactions / crypto_transactions / expected_fiat_result / expected_crypto_result）贯穿全局，严格践行【读取 → 查询 → 筛选 → 聚合 → 关联 → 验证 → 输出】闭环教学，先跑通看结果，再深入概念，驱动本体图谱实时呈现。"
---

# DuckDB SQL 完整使用教程 · 交易所资金流向与业务风控全局体系

## 交易所业务本体 · 资金流向与对账风控闭环

**难度等级**：L1 - L2（从入门读写到进阶对账与生产风控全覆盖）  
**前置依赖**：无（完整内嵌 Google Spreadsheet 真实业务种子数据，独立闭环，开箱即跑）  
**核心教学原则**：
> **先让用户用真实数据跑通、看到结果、理解为什么，再解释概念。**  
> 围绕一套贯穿始终的交易所真实出入金业务，按 **读取 → 查询 → 筛选 → 聚合 → 关联 → 验证 → 输出** 7 步循序推进。右侧本体图谱将随每一步 SQL 的执行实时动态生成，真实呈现领域实体（客户、交易、资产、网络）与状态拓扑。

---

## 一、学习目标与领域定位

完成本实战教程后，你将能够：

1. **读取（Read & Ingest）**：使用 DuckDB 创建符合金融级约束的关系表（`users`, `fiat_transactions`, `crypto_transactions`, `expected_fiat_result`, `expected_crypto_result`），并完整装载跨国真实业务流水。
2. **查询（Query & Projection）**：掌握单表基础投影、别名与数据类型识别，透视用户合规属性。
3. **筛选（Filter & Predicates）**：使用复合谓词（`WHERE`, `AND/OR`, `IN`, `BETWEEN`）准确定位高净值客户与大额交易。
4. **聚合（Aggregate & Grouping）**：使用 `GROUP BY` 与条件聚合（`SUM(CASE WHEN ...)`）精确核算多币种出入金净沉淀。
5. **关联（Join & Entity Linking）**：通过 `INNER JOIN` 与 `LEFT JOIN` 打通“用户身份”与“资金流水”，识别未入金/零交易用户。
6. **验证（Validate & Reconciliation）**：将实时计算的净额与官方对账基准表对齐，以 `variance = 0` 完成 100% 自动零差异对账核销。
7. **输出（Output & Advanced Insights）**：运用开窗函数（Window Function）分析资产流动曲线，运用风控规则精确排查冻结账户出金重大违规，并汇总跨渠道管理决策大盘。

---

## 二、领域概念说明（本体论锚定）

在交易所的真实业务宇宙中，资金流向与风控并非孤立的数字，而是由**实体（Entities）**与其间的**语义连线（Links）**构成的动态网络：

### 1. 核心业务实体（Entities）

| 实体 | 业务含义 | 数据库角色 / 主键 | 核心业务属性 |
| :--- | :--- | :--- | :--- |
| **用户（Users）** | 交易所开户的主体客户，承载合规身份 | 维度表 (`uid` BIGINT PK) | 用户名、国别码、本位币种、KYC等级、账户状态 |
| **法币交易（Fiat Transactions）** | 银行与第三方清算网关的法币充提事件 | 事实表 (`fiat_order_id` VARCHAR PK) | 资金流向、币种、金额、通道手续费、支付渠道、结算状态、时间戳 |
| **加密资产流水（Crypto Transactions）** | 底层区块链网络的数字货币充提事件 | 事实表 (`crypto_order_id` VARCHAR PK) | 资产符号、主网协议、代币数量、网络矿工费、TxHash、钱包地址、确认数 |
| **法币对账基准（Expected Fiat Result）** | 财务与清算部门的预期净额对账基准 | 验证基准表 (`uid, currency` PK) | 预期充值总额、预期提现总额、预期净流入沉淀额 |
| **加密对账基准（Expected Crypto Result）** | 链上清算部门的数字货币净额基准 | 验证基准表 (`uid, asset, network` PK) | 预期代币充值量、预期提现量、预期净沉淀代币量 |

### 2. 核心语义关联（Semantic Relations）

| 关系连线 | 语义解释 | 外键关联字段 |
| :--- | :--- | :--- |
| `fiat_transactions → users` | 法币出入金订单由指定用户发起 | `fiat_transactions.uid = users.uid` |
| `crypto_transactions → users` | 链上数字货币充提由指定用户发起 | `crypto_transactions.uid = users.uid` |
| `expected_fiat_result → users` | 财务法币净额对账单对应指定用户 | `expected_fiat_result.uid = users.uid` |
| `expected_crypto_result → users` | 链上数字资产净额对账单对应指定用户 | `expected_crypto_result.uid = users.uid` |

---

## 三、步骤一：读取（Read & Ingest）· 数据定义与入库

我们首先在 DuckDB 中建立 5 张业务表，并装载来自 Google Sheets 的 10 位跨国用户画像、25 笔法币流水、25 笔链上加密流水以及官方对账基准。

### 1️⃣ DDL：建表定义

```sql
CREATE TABLE users (
    uid BIGINT PRIMARY KEY,
    user_name VARCHAR NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    base_fiat_currency VARCHAR(3) NOT NULL,
    kyc_level INTEGER NOT NULL,
    account_status VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL
);

CREATE TABLE fiat_transactions (
    fiat_order_id VARCHAR PRIMARY KEY,
    uid BIGINT NOT NULL,
    direction VARCHAR NOT NULL,
    currency VARCHAR(3) NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    fee DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    channel VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    FOREIGN KEY (uid) REFERENCES users(uid)
);

CREATE TABLE crypto_transactions (
    crypto_order_id VARCHAR PRIMARY KEY,
    uid BIGINT NOT NULL,
    direction VARCHAR NOT NULL,
    asset VARCHAR NOT NULL,
    network VARCHAR NOT NULL,
    amount DECIMAL(18, 8) NOT NULL,
    fee DECIMAL(18, 8) NOT NULL DEFAULT 0.00,
    tx_hash VARCHAR,
    address VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    confirmations INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    FOREIGN KEY (uid) REFERENCES users(uid)
);

CREATE TABLE expected_fiat_result (
    uid BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL,
    deposit_amount DECIMAL(18, 2) NOT NULL,
    withdrawal_amount DECIMAL(18, 2) NOT NULL,
    net_amount DECIMAL(18, 2) NOT NULL,
    PRIMARY KEY (uid, currency),
    FOREIGN KEY (uid) REFERENCES users(uid)
);

CREATE TABLE expected_crypto_result (
    uid BIGINT NOT NULL,
    asset VARCHAR NOT NULL,
    network VARCHAR NOT NULL,
    deposit_amount DECIMAL(18, 8) NOT NULL,
    withdrawal_amount DECIMAL(18, 8) NOT NULL,
    net_amount DECIMAL(18, 8) NOT NULL,
    PRIMARY KEY (uid, asset, network),
    FOREIGN KEY (uid) REFERENCES users(uid)
);
```

### 2️⃣ DML：种子数据装载

```sql
-- 1. 用户画像数据 (10人)
INSERT INTO users VALUES
(784231905, 'Alice Chen', 'DE', 'EUR', 2, 'active', '2024-01-15 08:30:00'),
(615902374, 'Bob Miller', 'US', 'USD', 3, 'active', '2024-02-10 14:15:00'),
(903174628, 'Charlie Tanaka', 'JP', 'USD', 1, 'active', '2024-03-05 09:45:00'),
(528406193, 'David Smith', 'GB', 'GBP', 2, 'active', '2024-04-12 11:20:00'),
(846219537, 'Elena Rostova', 'FR', 'EUR', 2, 'active', '2024-05-18 16:40:00'),
(692481305, 'Fatimah Al-Sayed', 'AE', 'USD', 3, 'active', '2024-06-01 10:10:00'),
(438750921, 'Gabriel Garcia', 'BR', 'BRL', 2, 'active', '2024-07-22 13:00:00'),
(319582046, 'Hakan Yilmaz', 'TR', 'TRY', 1, 'active', '2024-08-30 15:25:00'),
(502847193, 'Irene Jung', 'KR', 'USD', 2, 'frozen', '2024-09-14 18:50:00'),
(219485730, 'Jonas Weber', 'DE', 'EUR', 0, 'pending_kyc', '2024-11-05 12:00:00');

-- 2. 法币出入金订单 (25笔)
INSERT INTO fiat_transactions VALUES
('fo_20250110_78423190', 784231905, 'deposit', 'EUR', 1500.00, 0.00, 'sepa_instant', 'completed', '2025-01-10 10:15:00', '2025-01-10 10:18:00'),
('fo_20250220_78423191', 784231905, 'withdrawal', 'EUR', 500.00, 1.50, 'sepa_instant', 'completed', '2025-02-20 14:30:00', '2025-02-20 14:35:00'),
('fo_20250315_78423192', 784231905, 'deposit', 'EUR', 2000.00, 0.00, 'sepa_credit', 'completed', '2025-03-15 09:00:00', '2025-03-15 16:20:00'),
('fo_20250410_78423193', 784231905, 'withdrawal', 'EUR', 300.00, 1.50, 'sepa_instant', 'failed', '2025-04-10 11:00:00', '2025-04-10 11:05:00'),
('fo_20250112_61590237', 615902374, 'deposit', 'USD', 50000.00, 15.00, 'wire_transfer', 'completed', '2025-01-12 08:30:00', '2025-01-12 15:45:00'),
('fo_20250214_61590238', 615902374, 'withdrawal', 'USD', 12000.00, 25.00, 'wire_transfer', 'completed', '2025-02-14 23:45:00', '2025-02-15 01:15:00'),
('fo_20250618_61590239', 615902374, 'withdrawal', 'USD', 5000.00, 25.00, 'wire_transfer', 'completed', '2025-06-18 10:20:00', '2025-06-18 14:10:00'),
('fo_20250720_61590240', 615902374, 'deposit', 'USD', 10000.00, 15.00, 'wire_transfer', 'pending', '2025-07-20 16:00:00', NULL),
('fo_20250308_90317462', 903174628, 'deposit', 'USD', 1000.00, 0.00, 'ach', 'completed', '2025-03-08 09:10:00', '2025-03-09 11:30:00'),
('fo_20250415_90317463', 903174628, 'withdrawal', 'USD', 450.00, 2.00, 'ach', 'completed', '2025-04-15 14:00:00', '2025-04-16 10:00:00'),
('fo_20250502_90317464', 903174628, 'withdrawal', 'USD', 200.00, 2.00, 'ach', 'cancelled', '2025-05-02 12:30:00', NULL),
('fo_20250418_52840619', 528406193, 'deposit', 'GBP', 3000.00, 0.00, 'faster_payments', 'completed', '2025-04-18 10:00:00', '2025-04-18 10:04:00'),
('fo_20250525_52840620', 528406193, 'withdrawal', 'GBP', 800.00, 1.00, 'faster_payments', 'completed', '2025-05-25 15:30:00', '2025-05-25 15:33:00'),
('fo_20250810_52840621', 528406193, 'withdrawal', 'GBP', 1200.00, 1.00, 'faster_payments', 'completed', '2025-08-10 18:20:00', '2025-08-10 18:24:00'),
('fo_20250912_52840622', 528406193, 'deposit', 'GBP', 500.00, 0.00, 'faster_payments', 'processing', '2025-09-12 09:15:00', NULL),
('fo_20250520_84621953', 846219537, 'deposit', 'EUR', 4200.00, 0.00, 'sepa_instant', 'completed', '2025-05-20 11:10:00', '2025-05-20 11:12:00'),
('fo_20250711_84621954', 846219537, 'deposit', 'EUR', 1800.00, 0.00, 'sepa_credit', 'completed', '2025-07-11 13:40:00', '2025-07-11 17:50:00'),
('fo_20250605_69248130', 692481305, 'deposit', 'USD', 25000.00, 15.00, 'wire_transfer', 'completed', '2025-06-05 09:30:00', '2025-06-05 16:10:00'),
('fo_20250915_69248131', 692481305, 'withdrawal', 'USD', 10000.00, 25.00, 'wire_transfer', 'completed', '2025-09-15 14:00:00', '2025-09-15 17:30:00'),
('fo_20241231_43875092', 438750921, 'deposit', 'BRL', 2500.00, 0.00, 'pix', 'completed', '2024-12-31 23:50:00', '2024-12-31 23:52:00'),
('fo_20250101_43875093', 438750921, 'withdrawal', 'BRL', 2500.00, 3.50, 'pix', 'completed', '2025-01-01 00:20:00', '2025-01-01 00:22:00'),
('fo_20250901_31958204', 319582046, 'deposit', 'TRY', 15000.00, 0.00, 'papara', 'completed', '2025-09-01 10:00:00', '2025-09-01 10:05:00'),
('fo_20251010_31958205', 319582046, 'withdrawal', 'TRY', 6000.00, 15.00, 'papara', 'completed', '2025-10-10 14:20:00', '2025-10-10 14:25:00'),
('fo_20250920_50284719', 502847193, 'withdrawal', 'USD', 800.00, 2.00, 'ach', 'completed', '2025-09-20 16:45:00', '2025-09-21 09:30:00'),
('fo_20251025_50284720', 502847193, 'withdrawal', 'USD', 20.00, 1.00, 'ach', 'completed', '2025-10-25 11:00:00', '2025-10-25 15:30:00');

-- 3. 加密货币流水 (25笔)
INSERT INTO crypto_transactions VALUES
('co_20250110_78423190', 784231905, 'deposit', 'USDT', 'TRON', 1500.00000000, 0.00000000, '63dd1029e5ca5cf984c2ed338bcba077d3efff2b5d25c543d129490e2588a375', 'TZTs2kMxqhLKQUqAiRBqgv1EbiBPk7w2UB', 'completed', 26, '2025-01-10 11:20:00', '2025-01-10 12:07:00'),
('co_20250222_78423191', 784231905, 'withdrawal', 'USDT', 'TRON', 500.00000000, 1.00000000, '0e641a560a1d663bc5dbc993d5e46d584a2f72554fb1109d97388c553bb651e2', 'TBE1SbTMMmmgvA6RbYPBJxmSf2Ytz1xz9L', 'completed', 20, '2025-02-22 18:10:00', '2025-02-22 19:09:00'),
('co_20250605_78423192', 784231905, 'deposit', 'ETH', 'ETHEREUM', 0.20000000, 0.00000000, '0x697857752aaa8607d1961ddfecb3ec44d9fd3cc4c45097ad44c9beff38b5f6a2', '0xc453f38ebdb4343a3242b060779e7531c69454bc', 'completed', 25, '2025-06-05 07:45:00', '2025-06-05 08:56:00'),
('co_20250320_61590237', 615902374, 'deposit', 'BTC', 'BITCOIN', 0.05000000, 0.00000000, 'b39506e732fd1f7a288a1ff4338028b098dc9bb0eb37d9145e48440f70849bf5', 'bc1q09h5eeyq6xkqfxz35sjdasv4r0uwu7sty56j3q', 'completed', 15, '2025-03-20 12:05:00', '2025-03-20 12:21:00'),
('co_20250801_61590238', 615902374, 'withdrawal', 'BTC', 'BITCOIN', 0.02000000, 0.00020000, '3aad3f0cdb66295a3bd2cc2a65eb900b3d1662a4388bbf093fb4593da315fad8', 'bc1q3glu088led8nf7j4puhy6sj4x63tfz0vypclkn', 'completed', 14, '2025-08-01 16:30:00', '2025-08-01 16:39:00'),
('co_20250815_61590239', 615902374, 'deposit', 'USDT', 'BSC', 600.00000000, 0.00000000, '0xa19ab825bc70785a4762c5d0704d338de601f635364658929267aa7365da4400', '0x6e0a0adb598ac01b4a24cca74747862290c52668', 'completed', 25, '2025-08-15 09:05:00', '2025-08-15 09:42:00'),
('co_20250212_90317462', 903174628, 'deposit', 'USDT', 'ARBITRUM', 400.00000000, 0.00000000, '0xb933b56829a298cdc0afd793e79c16011ac1fb6fa5fa00ffe25f4e971e59dfbd', '0xdc3487818cfda4ea4a05c495791f680aecf9d8b3', 'completed', 26, '2025-02-12 13:40:00', '2025-02-12 13:49:00'),
('co_20250902_90317463', 903174628, 'withdrawal', 'USDT', 'BSC', 300.00000000, 0.80000000, '0xea0f2bd3d9dc5ed8def5298f1c68cbe8782ec64d7e6815d0c7e018d73345af38', '0x4413ae3344245ba4bd12d2b473b9c642132ce2e5', 'completed', 17, '2025-09-02 10:20:00', '2025-09-02 11:23:00'),
('co_20251220_90317464', 903174628, 'withdrawal', 'USDT', 'ARBITRUM', 250.00000000, 0.30000000, NULL, '0x3b13a19c9377fe05031c01098a19ac18966a548f', 'processing', 0, '2025-12-20 20:10:00', NULL),
('co_20250407_52840619', 528406193, 'withdrawal', 'USDT', 'ETHEREUM', 1500.00000000, 5.00000000, '0x76dee5dcb35703c649a43288fc14e2cf692bc9821031877df211823bd509e148', '0x49d045820e74c6588e1a0c26757aaef2476c22ff', 'completed', 23, '2025-04-07 21:15:00', '2025-04-07 21:22:00'),
('co_20250420_52840620', 528406193, 'deposit', 'USDT', 'TRON', 700.00000000, 0.00000000, 'e1bd98dde29c160c154b642a90fc3cc5fa29ffd2da05c2fa35d35fb8bee1e5a3', 'TBGKnRW9K5wiLmhUDSLsUXJuK5ETvC83xM', 'completed', 23, '2025-04-20 08:45:00', '2025-04-20 10:03:00'),
('co_20251111_52840621', 528406193, 'withdrawal', 'USDT', 'TRON', 300.00000000, 1.00000000, 'b0b316bd299eee088bcdf1ae9328dd1c899294f77a63ab6a4887817e91c53ed3', 'TMn9NxEKnutzexB6W3kKLbfzsLuRw9ocut', 'completed', 21, '2025-11-11 13:05:00', '2025-11-11 13:09:00'),
('co_20250105_84621953', 846219537, 'deposit', 'ETH', 'ETHEREUM', 0.40000000, 0.00000000, '0x0d28c056661be39b220f2c211e59a5ee51db5186d5ab9629d69ee2cc89d6dfb0', '0x099c0e97614fd374d7e546dc2fcbdd52df00224a', 'completed', 15, '2025-01-05 06:25:00', '2025-01-05 07:46:00'),
('co_20250505_84621954', 846219537, 'withdrawal', 'ETH', 'ETHEREUM', 0.10000000, 0.00120000, '0xea497e8d88ee3ee055bd364c2e146246bb96deb5dc86f9c5505c3b292eb85b80', '0x41108ae1113dc504a0f34c39d731ac814c343b9b', 'completed', 26, '2025-05-05 17:15:00', '2025-05-05 17:57:00'),
('co_20251010_84621955', 846219537, 'deposit', 'USDT', 'TRON', 1000.00000000, 0.00000000, '6417aedbf3a07badbd672209b43886240cf096b9015d44cc53ca179b33577279', 'TSEdPbLdvpu7xY9sKwGuRPLpU5BuaCqjza', 'completed', 27, '2025-10-10 09:00:00', '2025-10-10 09:49:00'),
('co_20250107_69248130', 692481305, 'deposit', 'USDT', 'TRON', 2000.00000000, 0.00000000, '360e42a95096a44553f9b6ac51a889d7355a8a472968bbc6865573e9ced82456', 'TzSQmX1NuEsYWRaskDpkqVxaUtRMQ3Hrqf', 'completed', 21, '2025-01-07 14:30:00', '2025-01-07 15:05:00'),
('co_20250318_69248131', 692481305, 'withdrawal', 'USDT', 'TRON', 600.00000000, 1.00000000, 'd62970a686c4901f7776dd175ff0053d1af520e991121a082a88f51bcdde9637', 'TdwuvV9ytQqruGcwsJcaR2SHdztSJAfztM', 'completed', 22, '2025-03-18 11:40:00', '2025-03-18 13:01:00'),
('co_20250709_69248132', 692481305, 'deposit', 'BTC', 'BITCOIN', 0.03000000, 0.00000000, 'b811a6d96346cb2407724c1b86fac4357b0bb24a64938fff77c0214f00389e0b', 'bc1q76tcqtgmgd0gdw7v0ujpnt4w929j8kc5kznj9e', 'completed', 7, '2025-07-09 19:25:00', '2025-07-09 20:48:00'),
('co_20250801_69248133', 692481305, 'deposit', 'USDT', 'BSC', 500.00000000, 0.00000000, '0x33aeea111548a4bef60d04849b6326c2562a08a7de68b0f248e8e3f9de93af63', '0x29c14b9b9823aa3754bc21f9c4dfbe252491d85e', 'confirming', 5, '2025-08-01 08:10:00', NULL),
('co_20251201_69248134', 692481305, 'withdrawal', 'USDT', 'BSC', 300.00000000, 0.80000000, NULL, '0xe0b6b8387d822451eca3c2173d974ef5bf2c6fbb', 'failed', 0, '2025-12-01 07:20:00', NULL),
('co_20241231_43875092', 438750921, 'deposit', 'USDT', 'TRON', 300.00000000, 0.00000000, '233ee1f098f65a8b6832253005919d0086745c9ec55a04c7c4f8fd1b01b46b52', 'TvcdwQMYE3CJ1uBT2jN5cSfNmwwyGz4syK', 'completed', 26, '2024-12-31 23:40:00', '2024-12-31 23:55:00'),
('co_20250101_43875093', 438750921, 'deposit', 'USDT', 'TRON', 500.00000000, 0.00000000, 'a604c6354367ee9df63fa4a8e4c9ac51a954ea3e2b9bf929c991345fcd6c4fc8', 'T9gb744yUqjdkiaJCGLnugKmjXSsUpCb4r', 'completed', 25, '2026-01-01 00:15:00', '2026-01-01 00:52:00'),
('co_20251229_43875094', 438750921, 'deposit', 'USDT', 'TRON', 1000.00000000, 0.00000000, '7d0161907f296b3ab768712f56095ba777ac7536d241896d3a7b53fbaaa460b6', 'Tvtb4VirWCMnbBktzqaCvboDmo9rSzo7nh', 'completed', 25, '2025-12-29 09:10:00', '2025-12-29 09:33:00'),
('co_20251231_43875095', 438750921, 'withdrawal', 'USDT', 'TRON', 1800.00000000, 1.00000000, '219361f01e2a7c60f65ca604af06a392872684ff230241b3823a9540e645df54', 'TVSzNFcdNHjGcWNzbVi7movAKU9vDEUg3J', 'completed', 34, '2025-12-31 12:15:00', '2025-12-31 13:06:00'),
('co_20251105_31958204', 319582046, 'deposit', 'BTC', 'BITCOIN', 0.00100000, 0.00000000, 'e48440f70849bf5b39506e732fd1f7a288a1ff4338028b098dc9bb0eb37d9145', 'bc1q9d846392019485720192847291048572019283', 'completed', 6, '2025-11-05 14:10:00', '2025-11-05 14:55:00');

-- 4. 官方对账基准表
INSERT INTO expected_fiat_result VALUES
(784231905, 'EUR', 3500.00, 500.00, 3000.00),
(615902374, 'USD', 50000.00, 17000.00, 33000.00),
(903174628, 'USD', 1000.00, 450.00, 550.00),
(528406193, 'GBP', 3000.00, 2000.00, 1000.00),
(846219537, 'EUR', 6000.00, 0.00, 6000.00),
(692481305, 'USD', 25000.00, 10000.00, 15000.00),
(438750921, 'BRL', 2500.00, 2500.00, 0.00),
(319582046, 'TRY', 15000.00, 6000.00, 9000.00),
(502847193, 'USD', 0.00, 820.00, -820.00);

INSERT INTO expected_crypto_result VALUES
(784231905, 'USDT', 'TRON', 1500.0000, 500.0000, 1000.0000),
(784231905, 'ETH', 'ETHEREUM', 0.2000, 0.00, 0.2000),
(615902374, 'BTC', 'BITCOIN', 0.0500, 0.0200, 0.0300),
(615902374, 'USDT', 'BSC', 600.0000, 0.00, 600.0000),
(903174628, 'USDT', 'ARBITRUM', 400.0000, 0.00, 400.0000),
(903174628, 'USDT', 'BSC', 0.00, 300.0000, -300.0000),
(528406193, 'USDT', 'ETHEREUM', 0.00, 1500.0000, -1500.0000),
(528406193, 'USDT', 'TRON', 700.0000, 300.0000, 400.0000),
(846219537, 'ETH', 'ETHEREUM', 0.4000, 0.1000, 0.3000),
(846219537, 'USDT', 'TRON', 1000.0000, 0.00, 1000.0000),
(692481305, 'USDT', 'TRON', 2000.0000, 600.0000, 1400.0000),
(692481305, 'BTC', 'BITCOIN', 0.0300, 0.00, 0.0300),
(438750921, 'USDT', 'TRON', 1800.0000, 1800.0000, 0.00),
(319582046, 'BTC', 'BITCOIN', 0.0010, 0.00, 0.0010);
```

### 3️⃣ 校验读取结果

执行以下统计，立即核对 5 张表的装载完整度：

```sql
SELECT 'users' AS table_name, count(*) AS total_rows FROM users
UNION ALL
SELECT 'fiat_transactions', count(*) FROM fiat_transactions
UNION ALL
SELECT 'crypto_transactions', count(*) FROM crypto_transactions
UNION ALL
SELECT 'expected_fiat_result', count(*) FROM expected_fiat_result
UNION ALL
SELECT 'expected_crypto_result', count(*) FROM expected_crypto_result;
```

#### 预期结果与理解为什么：
* `users`：10 行（覆盖欧美、中东、拉美、东亚等地 10 位真实用户）。
* `fiat_transactions`：25 行（含 SEPA、Wire、ACH、Faster Payments、Pix、Papara 等多通道）。
* `crypto_transactions`：25 行（含 TRON、Ethereum、Bitcoin、BSC、Arbitrum 等多公链）。
* **为什么使用 `DECIMAL(18,2)` 与 `DECIMAL(18,8)`**？金融与加密交易绝不能使用浮点数 `FLOAT` 或 `DOUBLE`，否则会出现 `0.1 + 0.2 != 0.3` 的精度截断漂移。DuckDB 的定点数精确存储保障了分厘不差的对账基石。

---

## 四、步骤二：查询（Query & Projection）· 基础投影与实体洞察

先运行 SQL，从用户表与法币流水中查看基础数据分布：

### 查询 1：用户合规画像清单

```sql
SELECT 
    uid, 
    user_name, 
    country_code, 
    base_fiat_currency, 
    kyc_level, 
    account_status
FROM users
ORDER BY uid;
```

#### 预期结果与为什么：
* 跑出 10 位用户的核心字段。可以看到：
  * Alice Chen 来自德国（DE），本位币 EUR，KYC 等级 2，状态为 `active`；
  * Irene Jung 状态为 `frozen`（冻结）；
  * Jonas Weber 为 `pending_kyc`（待认证，KYC 等级 0）。
* **核心概念解析**：`SELECT` 负责列投影，DuckDB 作为纯列式向量化执行引擎，只从内存中提取请求的 6 列，跳过无关数据，扫描速度极快。

---

## 五、步骤三：筛选（Filter & Predicates）· 业务条件过滤

在实际风控与运营中，我们只关心符合特定业务规则的子集。先跑代码筛选两组重点数据：

### 查询 2：筛选活跃且完成高级 KYC 的高净值用户

```sql
SELECT 
    uid, 
    user_name, 
    country_code, 
    base_fiat_currency, 
    kyc_level, 
    account_status
FROM users
WHERE account_status = 'active' 
  AND kyc_level >= 2
ORDER BY kyc_level DESC, uid;
```

#### 预期结果与为什么：
* 仅返回符合条件的 6 位用户（Bob Miller KYC 3, Fatimah Al-Sayed KYC 3, Alice, David, Elena, Gabriel KYC 2）。
* 状态为 `frozen` 的 Irene Jung 和 KYC 等级为 0/1 的用户被自动排除。

### 查询 3：筛选单笔大于等于 5,000 的大额法币订单

```sql
SELECT 
    fiat_order_id,
    uid,
    direction,
    currency,
    amount,
    channel,
    status,
    completed_at
FROM fiat_transactions
WHERE amount >= 5000.00
ORDER BY amount DESC;
```

#### 预期结果与为什么：
* 结果显示共 6 笔大额资金：
  * Bob Miller (615902374) 在 Wire Transfer 通道有 50,000 USD 充值、12,000 USD 提现与 10,000 USD 待处理充值；
  * Fatimah (692481305) 有 25,000 USD 充值与 10,000 USD 提现；
  * Hakan (319582046) 有 15,000 TRY 充值与 6,000 TRY 提现。
* **核心概念解析**：`WHERE` 谓词负责行级过滤，DuckDB 在扫描时直接利用 Min/Max 统计信息进行谓词下推（Predicate Pushdown），避免多余的数据解包。

---

## 六、步骤四：聚合（Aggregate & Grouping）· 净额度量与通道分布

交易所的核心财务指标不是流水总笔数，而是**净沉淀资金（Net Inflow）**。我们用条件聚合来统计每个用户在各法币币种下的真实净额。

### 查询 4：按用户和币种聚合计算出入金净额

```sql
SELECT 
    uid,
    currency,
    COUNT(*) AS total_tx_count,
    SUM(CASE WHEN direction = 'deposit' THEN amount ELSE 0.00 END) AS total_deposit,
    SUM(CASE WHEN direction = 'withdrawal' THEN amount ELSE 0.00 END) AS total_withdrawal,
    SUM(CASE WHEN direction = 'deposit' THEN amount ELSE -amount END) AS net_inflow
FROM fiat_transactions
WHERE status = 'completed'
GROUP BY uid, currency
ORDER BY net_inflow DESC;
```

#### 预期结果与为什么：
* 只对 `status = 'completed'`（已完成结算）的订单统计，避免把失败或待处理单计入资产。
* 结果清晰揭示：
  * 用户 615902374 (Bob) 净沉淀 +33,000.00 USD；
  * 用户 692481305 (Fatimah) 净沉淀 +15,000.00 USD；
  * 用户 846219537 (Elena) 净沉淀 +6,000.00 EUR；
  * 用户 502847193 (Irene) 发生提现净流出 -820.00 USD。
* **核心概念解析**：`SUM(CASE WHEN ...)` 是一种将多行转为多列聚合维度的经典 SQL 模式；`GROUP BY uid, currency` 则确立了聚合的复合粒度。

---

## 七、步骤五：关联（Join & Entity Linking）· 跨表实体拓扑打通

流水表只有孤立的 `uid`，必须与用户维度表关联，才能呈现立体的业务全景图。

### 查询 5：多表 INNER JOIN 打通用户身份与资金流水

```sql
SELECT 
    f.fiat_order_id,
    u.user_name,
    u.country_code,
    u.kyc_level,
    f.direction,
    f.currency,
    f.amount,
    f.channel,
    f.status,
    f.completed_at
FROM fiat_transactions f
JOIN users u ON f.uid = u.uid
WHERE f.amount >= 5000.00
ORDER BY f.amount DESC;
```

#### 预期结果与为什么：
* 现在看到的不仅是抽象的 `fo_...` 订单，而是实实在在的用户全名 `Bob Miller`（美国 US，KYC 3）、`Fatimah Al-Sayed`（阿联酋 AE，KYC 3）。
* **本体语义映射**：这一关联直接印证了本体图谱中的语义关系 `fiat_transactions -(uid)-> users`（即 `Transaction -(performed_by)-> Customer`）。

### 查询 6：LEFT JOIN 识别零链上交易的潜在转化用户

```sql
SELECT 
    u.uid,
    u.user_name,
    u.country_code,
    u.account_status,
    COUNT(c.crypto_order_id) AS crypto_order_count
FROM users u
LEFT JOIN crypto_transactions c ON u.uid = c.uid
GROUP BY u.uid, u.user_name, u.country_code, u.account_status
HAVING COUNT(c.crypto_order_id) = 0
ORDER BY u.uid;
```

#### 预期结果与为什么：
* 准确找出 2 位从未参与过链上充提的用户：
  * `David Smith`（英国用户，仅进行过英镑 Faster Payments 交易）；
  * `Jonas Weber`（德国新用户，尚未完成 KYC 认证）。
* **核心概念解析**：`LEFT JOIN` 保留左表（`users`）的所有记录，即使右表无匹配也以 NULL 补齐；结合 `COUNT(c.crypto_order_id) = 0`，是排查“无事件发生主体”的标准范式。

---

## 八、步骤六：验证（Validate & Reconciliation）· 财务基准自动对账

生产系统的核心法则是：**未经对账的数据不可信**。我们使用 CTE（公共表表达式），将刚才计算出的实时净沉淀，与官方清算基准表 `expected_fiat_result` 进行 100% 自动对账比对。

### 查询 7：法币出入金零差异自动对账

```sql
WITH live_fiat_summary AS (
    SELECT 
        uid,
        currency,
        SUM(CASE WHEN direction = 'deposit' THEN amount ELSE 0.00 END) AS calc_deposit,
        SUM(CASE WHEN direction = 'withdrawal' THEN amount ELSE 0.00 END) AS calc_withdrawal,
        SUM(CASE WHEN direction = 'deposit' THEN amount ELSE -amount END) AS calc_net
    FROM fiat_transactions
    WHERE status = 'completed'
    GROUP BY uid, currency
)
SELECT 
    u.user_name,
    s.currency,
    s.calc_deposit,
    s.calc_withdrawal,
    s.calc_net,
    e.net_amount AS expected_net,
    ROUND(s.calc_net - e.net_amount, 2) AS variance
FROM live_fiat_summary s
JOIN users u ON s.uid = u.uid
JOIN expected_fiat_result e ON s.uid = e.uid AND s.currency = e.currency
ORDER BY s.calc_net DESC;
```

#### 预期结果与为什么：
* **对账结果**：所有 9 个涉及法币交易的用户，其计算净额与预期净额的差异 `variance` **全部精确等于 0.00**！
  * Alice Chen: calc_net 3000.00 EUR == expected_net 3000.00 EUR (variance 0.00)
  * Bob Miller: calc_net 33000.00 USD == expected_net 33000.00 USD (variance 0.00)
  * Elena Rostova: calc_net 6000.00 EUR == expected_net 6000.00 EUR (variance 0.00)
  * Irene Jung: calc_net -820.00 USD == expected_net -820.00 USD (variance 0.00)
* **业务价值**：证实账面流水与财务总账完全平衡，无丢失记账、无漏扣手续费截断。

### 查询 8：多公链多资产数字货币零差异自动对账

```sql
WITH live_crypto_summary AS (
    SELECT 
        uid,
        asset,
        network,
        SUM(CASE WHEN direction = 'deposit' THEN amount ELSE 0.00000000 END) AS calc_deposit,
        SUM(CASE WHEN direction = 'withdrawal' THEN amount ELSE 0.00000000 END) AS calc_withdrawal,
        SUM(CASE WHEN direction = 'deposit' THEN amount ELSE -amount END) AS calc_net
    FROM crypto_transactions
    WHERE status = 'completed'
    GROUP BY uid, asset, network
)
SELECT 
    u.user_name,
    c.asset,
    c.network,
    c.calc_deposit,
    c.calc_withdrawal,
    c.calc_net,
    e.net_amount AS expected_net,
    (c.calc_net - e.net_amount) AS variance
FROM live_crypto_summary c
JOIN users u ON c.uid = u.uid
JOIN expected_crypto_result e ON c.uid = e.uid AND c.asset = e.asset AND c.network = e.network
ORDER BY c.asset, c.calc_net DESC;
```

#### 预期结果与为什么：
* 覆盖 BTC、ETH、USDT 在 Bitcoin、Ethereum、Tron、BSC、Arbitrum 上的全量对账。
* 每一个代币的 `variance` 全部为 `0.00000000`，证实链上解析流水与清算预期完全契合。

---

## 九、步骤七：输出（Output & Advanced Insights）· 开窗流动与生产风控

在保证数据完全准确的前提下，我们输出生产级高级洞察：包括资金流动态水位曲线、安全合规违规排查、以及全局通道收益大盘。

### 查询 9：开窗时序流 —— 计算 Bob Miller 资金动态累计流动曲线

```sql
SELECT 
    fiat_order_id,
    currency,
    direction,
    amount,
    completed_at,
    SUM(CASE WHEN direction = 'deposit' THEN amount ELSE -amount END) 
        OVER (ORDER BY completed_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_balance
FROM fiat_transactions
WHERE uid = 615902374 
  AND status = 'completed'
ORDER BY completed_at;
```

#### 预期结果与为什么：
* 清晰展现 Bob Miller 资金水位的历史起伏：
  1. 2025-01-12 存入 50,000 USD → 累计水位 50,000.00 USD；
  2. 2025-02-15 提现 12,000 USD → 累计水位降至 38,000.00 USD；
  3. 2025-06-18 提现 5,000 USD → 累计水位稳定在 33,000.00 USD。
* **核心概念解析**：`OVER (ORDER BY ... ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)` 为开窗累加器，避免了自连接带来的 $O(N^2)$ 计算瓶颈。

### 查询 10：生产级合规审计 —— 排查“冻结账户异常出金”重大风控漏洞

```sql
SELECT 
    f.fiat_order_id,
    u.uid,
    u.user_name,
    u.account_status,
    f.direction,
    f.amount,
    f.currency,
    f.channel,
    f.status,
    f.created_at,
    f.completed_at
FROM fiat_transactions f
JOIN users u ON f.uid = u.uid
WHERE u.account_status = 'frozen'
  AND f.direction = 'withdrawal'
  AND f.status = 'completed';
```

#### 预期结果与为什么：
* **抓出 2 笔严重违规出金漏洞**：
  * 用户 `Irene Jung` (502847193) 的账户状态为 `frozen`（被依法冻结）；
  * 但系统却分别在 2025-09-21 和 2025-10-25 成功放行了两笔 ACH 提现（800.00 USD 与 20.00 USD）！
* **业务价值**：证实出金网关的校验逻辑存在漏洞——提现处理引擎仅校验了订单状态，未实时拦截冻结账户，为交易所避免了潜在重大合规罚单。

### 查询 11：管理层全局大盘 —— 全渠道结算成功率与手续费收入大盘

```sql
SELECT 
    'Fiat - ' || channel AS gateway_or_network,
    COUNT(*) AS total_orders,
    ROUND(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS success_rate_pct,
    SUM(fee) AS total_fee_revenue
FROM fiat_transactions
GROUP BY channel

UNION ALL

SELECT 
    'Crypto - ' || network AS gateway_or_network,
    COUNT(*) AS total_orders,
    ROUND(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS success_rate_pct,
    SUM(fee) AS total_fee_revenue
FROM crypto_transactions
GROUP BY network
ORDER BY total_orders DESC;
```

#### 预期结果与为什么：
* 将法币清算网关与公链网络合并为一张统一的运营大盘：
  * TRON 网络订单量最多（11 笔），成功率 100%，手续费创收 3.00；
  * Wire Transfer 虽然订单量仅 4 笔，但手续费创收最高（80.00 USD）；
  * BSC 存在失败订单（成功率 66.7%），提示运维团队关注 BSC 节点网络稳定性。

---

## 十、总结与本体图谱映射

通过上述 **读取 → 查询 → 筛选 → 聚合 → 关联 → 验证 → 输出** 7 步闭环，你不仅系统掌握了 DuckDB 从建表到开窗与风控的高级 SQL 能力，而且在右侧本体图谱中实时构建了如下资产：

1. **核心实体**：
   * `Customer`：以 Alice、Bob 为代表的跨国用户主体；
   * `Transaction`：以 25 笔出入金订单为代表的法币事实；
   * `CryptoTransaction`：以 25 笔区块链转账为代表的链上事实；
   * `Asset` & `Network`：流通代币与底层承载公链。
2. **核心语义连线**：
   * `Customer -(performs)-> Transaction`
   * `Customer -(performs)-> CryptoTransaction`
   * `CryptoTransaction -(occurs_on)-> Network`
   * `ExpectedFiatResult / ExpectedCryptoResult -(verified_against)-> Customer`

每当你点击右侧图谱中的任意节点，即可查验真实的字段属性与执行统计，实现数据、代码与本体认知的彻底统一。