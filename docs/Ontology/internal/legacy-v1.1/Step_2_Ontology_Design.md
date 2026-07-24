---
run_id: ontology-meal-training-20260724-02
stage: Step 2
status: PASS
gate: G2
model_version: 1.1.0
---

# 家庭聚餐本体蓝图

## 范围

用于分析家庭成员通过制作或购买取得食物，并共同参与一次用餐的案例。配送、付款、营养和库存不在范围内。

## 能力问题

| ID | 问题 |
| --- | --- |
| CQ-01 | 案例中有哪些人物、地点、菜品和过程？ |
| CQ-02 | 同名或近似名称的菜品是否为同一实例？ |
| CQ-03 | 每道菜通过制作还是购买进入案例？ |
| CQ-04 | 谁在什么过程中承担什么角色？ |
| CQ-05 | 同一对象发生了哪些状态变化？ |
| CQ-06 | 过程之间是先后、依赖、并发还是汇聚？ |
| CQ-07 | 哪些结论是事实、推断或未知？ |
| CQ-08 | 新案例可以直接复用、需要扩展还是超出范围？ |

## 实例到类型

| 源实例 | 目标类型 | 来源 |
| --- | --- | --- |
| INS-PER-01—04 | OT-PERSON | F-01 |
| INS-PLC-01—02 | OT-PLACE | F-02—05 |
| INS-DISH-01—03 | OT-DISH | F-02、F-04 |
| INS-PROC-01 | PT-PREPARE_DISH | F-02 |
| INS-PROC-02、04 | PT-TRAVEL | F-03、F-05 |
| INS-PROC-03 | PT-PURCHASE_DISH | F-04 |
| INS-PROC-05 | PT-SHARED_MEAL | F-06 |

## 本体构件

### 对象类型

| ID | 定义 | 身份依据 | 支持 CQ |
| --- | --- | --- | --- |
| OT-PERSON | 在案例中保持身份的人物 | 人物标识 + 用餐上下文 | CQ-01、02、04、05 |
| OT-PLACE | 过程发生或移动指向的地点 | 地点标识 | CQ-01、05、06 |
| OT-DISH | 需要区分来源与状态的菜品 | 上下文 + 形成或取得过程 + 本地标签 | CQ-01—03、05 |
| OT-MEAL_CONTEXT | 一次用餐的事件边界 | 用餐事件标识 | CQ-01、06、07 |

### 过程类型

| ID | 作用 | 支持 CQ |
| --- | --- | --- |
| PT-PREPARE_DISH | 形成 OT-DISH | CQ-03、04 |
| PT-TRAVEL | 改变 OT-PERSON 的位置 | CQ-04—06 |
| PT-PURCHASE_DISH | 记录人物购买菜品 | CQ-03、04 |
| PT-SHARED_MEAL | 记录人物共同参与用餐 | CQ-01、04、06 |

### 角色类型

| ID | 绑定过程 | 支持 CQ |
| --- | --- | --- |
| RT-PREPARATION_PERFORMER | PT-PREPARE_DISH | CQ-04 |
| RT-TRAVELER | PT-TRAVEL | CQ-04 |
| RT-BUYER | PT-PURCHASE_DISH | CQ-04 |
| RT-MEAL_PARTICIPANT | PT-SHARED_MEAL | CQ-04 |

### 状态维度

| ID | 适用对象 | 含义 | 支持 CQ |
| --- | --- | --- | --- |
| ST-LOCATION | OT-PERSON；有证据时可用于 OT-DISH | 当前地点与变化时间 | CQ-05 |
| ST-ACQUISITION | OT-DISH | 未知、已购买等取得状态 | CQ-03、05 |
| ST-PREPARATION_RESULT | OT-DISH | 由哪个制作过程形成 | CQ-03、05 |
| ST-TIME_WINDOW | 过程 | 时间点、区间或粗粒度时间 | CQ-06 |
| ST-EVIDENCE | 所有断言 | FACT、INFERENCE 或 UNKNOWN | CQ-07 |

### 关系类型

| ID | 连接 | 含义 | 支持 CQ |
| --- | --- | --- | --- |
| REL-PLAYS_ROLE_IN | OT-PERSON → 过程 | 人以指定角色参与过程 | CQ-04 |
| REL-OCCURS_AT | 过程 → OT-PLACE | 过程发生地点 | CQ-01、05 |
| REL-PRODUCES | PT-PREPARE_DISH → OT-DISH | 制作形成菜品 | CQ-03 |
| REL-PURCHASES | PT-PURCHASE_DISH → OT-DISH | 购买以菜品为对象 | CQ-03 |
| REL-HAS_DESTINATION | PT-TRAVEL → OT-PLACE | 出行目的地 | CQ-05 |
| REL-ACTUAL_PRECEDES | 过程 → 过程 | 本次事实先后 | CQ-06 |
| REL-REQUIRES_COMPLETION | 过程 → 过程 | 后一过程必须等待前一过程 | CQ-06 |
| REL-MAY_OVERLAP | 过程 ↔ 过程 | 有证据支持的时间重叠 | CQ-06 |
| REL-CONVERGES_AT | 人或菜品 → PT-SHARED_MEAL | 汇聚到用餐过程 | CQ-06 |

### 模型约束

| ID | 约束 | 支持 CQ |
| --- | --- | --- |
| CON-01 | 确定断言必须有来源并标记 ST-EVIDENCE | CQ-07 |
| CON-02 | 对象不能仅凭同名合并，也不能因状态变化拆分 | CQ-02、05 |
| CON-03 | 角色必须绑定过程，不能替代对象类型 | CQ-04 |
| CON-04 | REL-ACTUAL_PRECEDES 不自动升级为 REL-REQUIRES_COMPLETION | CQ-06 |
| CON-05 | 实例名称、数量或角色绑定变化不构成模型扩展 | CQ-08 |

## 最小模式

~~~text
OT-PERSON --REL-PLAYS_ROLE_IN / RT-*--> PT-*
PT-PREPARE_DISH  --REL-PRODUCES-------> OT-DISH
PT-PURCHASE_DISH --REL-PURCHASES------> OT-DISH
PT-TRAVEL        --REL-HAS_DESTINATION-> OT-PLACE
PT-TRAVEL        --changes------------> ST-LOCATION
OT-PERSON        --REL-CONVERGES_AT----> PT-SHARED_MEAL
过程 --REL-ACTUAL_PRECEDES / REL-REQUIRES_COMPLETION / REL-MAY_OVERLAP--> 过程
断言 --ST-EVIDENCE--> FACT | INFERENCE | UNKNOWN
~~~

模式不包含源实例专名。

## 规则边界

- 已确认业务规则：无。
- BR-CAND-01：菜品是否必须到达用餐地点才能参与用餐，需补充地点和输入规则。
- BR-CAND-02：是否必须等所有菜品齐全才开始，需补充启动条件。
- U-01：制作与购买是否并发，仍需精确时间。

## G2 决定

**PASS，模型版本 1.1.0 已冻结。** 所有源实例均有类型归属，模式不含实例专名，CQ-01—08 均有构件承载，事实、候选规则和未知保持分离。
