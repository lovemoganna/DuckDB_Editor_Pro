---
run_id: ontology-meal-training-20260724-02
stage: Step 3
status: PASS
gate: G3
test_mode: BLIND
model_version: 1.1.0
model_frozen_before_test: true
reuse_case: R1
---

# 冻结模型后的盲测验收

## 隔离声明

家庭聚餐本体 1.1.0 在读取 R1 前已经冻结。R1 和预期答案来自 Run_Manifest.md 的锁定测试区；测试期间没有修改模型、案例或预期答案。

## R1 事实基线

> 晚上，我回到家时，我爸已经做好一道茄子，我妻子正在做另一道茄子。过了一会儿，我、我爸和我妻子一起吃晚饭。

| ID | 等级 | 内容 |
| --- | --- | --- |
| R1-F-01 | 事实 | 晚上，我回到家 |
| R1-F-02 | 事实 | 我回家时，父亲已经做好一道茄子 |
| R1-F-03 | 事实 | 我回家时，妻子正在做另一道茄子 |
| R1-F-04 | 事实 | 两道同名菜品由“一道”和“另一道”明确区分 |
| R1-F-05 | 事实 | 过了一会儿，我、父亲和妻子一起吃晚饭 |
| R1-F-06 | 事实 | 父亲制作先于我回家；妻子制作与我回家重叠；我回家先于用餐 |
| R1-I-01 | 推断 | 两道茄子菜可能是晚饭输入 |
| R1-U-01 | 未知 | 两道菜是否上桌或被吃 |
| R1-U-02 | 未知 | 妻子的制作过程是否在用餐前完成 |
| R1-U-03 | 未知 | 三个过程之间是否存在必要依赖 |

## 实例映射

| MAP ID | 新实例 | 既有类型 | 角色、状态或关系 | 来源 |
| --- | --- | --- | --- | --- |
| MAP-R1-01 | 我 | OT-PERSON | RT-TRAVELER、RT-MEAL_PARTICIPANT | R1-F-01、05 |
| MAP-R1-02 | 我爸 | OT-PERSON | RT-PREPARATION_PERFORMER、RT-MEAL_PARTICIPANT | R1-F-02、05 |
| MAP-R1-03 | 我妻子 | OT-PERSON | RT-PREPARATION_PERFORMER、RT-MEAL_PARTICIPANT | R1-F-03、05 |
| MAP-R1-04 | 家 | OT-PLACE | 出行目的地、制作地点和用餐语境地点 | R1-F-01—05 |
| MAP-R1-05 | 父亲做的茄子 | OT-DISH | ST-PREPARATION_RESULT | R1-F-02、04 |
| MAP-R1-06 | 妻子做的茄子 | OT-DISH | ST-PREPARATION_RESULT | R1-F-03、04 |
| MAP-R1-07 | 父亲制作 | PT-PREPARE_DISH | REL-PRODUCES → MAP-R1-05 | R1-F-02 |
| MAP-R1-08 | 妻子制作 | PT-PREPARE_DISH | REL-PRODUCES → MAP-R1-06 | R1-F-03 |
| MAP-R1-09 | 我回家 | PT-TRAVEL | REL-HAS_DESTINATION → MAP-R1-04 | R1-F-01 |
| MAP-R1-10 | 三人吃晚饭 | PT-SHARED_MEAL | 三名 OT-PERSON 参与 | R1-F-05 |

过程关系使用既有构件表达：

- MAP-R1-07 `REL-ACTUAL_PRECEDES` MAP-R1-09；
- MAP-R1-08 `REL-MAY_OVERLAP` MAP-R1-09；
- MAP-R1-09 `REL-ACTUAL_PRECEDES` MAP-R1-10；
- 没有证据建立 `REL-REQUIRES_COMPLETION`。

## CQ 盲测比较

实际答案先依据冻结模型生成，再与 Manifest 中的预期答案比较。

| CQ ID | 预期答案 | 模型实际答案 | 判定 |
| --- | --- | --- | --- |
| CQ-01 | 3 人、1 地点、2 道不同菜品、4 个过程 | OT-PERSON 3 个、OT-PLACE 1 个、OT-DISH 2 个；制作 2 次、出行 1 次、用餐 1 次 | MATCH |
| CQ-02 | 两道同名菜品是两个实例 | CON-02 禁止按名称合并；两道菜由不同制作过程形成，保持为 MAP-R1-05、06 | MATCH |
| CQ-03 | 两道菜均由制作进入，没有购买 | 两道菜均由 PT-PREPARE_DISH 经 REL-PRODUCES 形成；没有 PT-PURCHASE_DISH 实例 | MATCH |
| CQ-04 | 父亲和妻子是制作执行者，我是出行者，三人参加用餐 | 既有 RT-PREPARATION_PERFORMER、RT-TRAVELER、RT-MEAL_PARTICIPANT 完整承载 | MATCH |
| CQ-05 | 我回到家；两道菜分别由两个制作过程形成 | ST-LOCATION 表达我的位置变化；ST-PREPARATION_RESULT 分别绑定两道菜 | MATCH |
| CQ-06 | 父亲制作先于回家，妻子制作与回家重叠，回家先于用餐，不升级为依赖 | REL-ACTUAL_PRECEDES 和 REL-MAY_OVERLAP 完整表达；CON-04 阻止升级为必要依赖 | MATCH |
| CQ-07 | 明示内容为事实；菜品消费和妻子完成制作仍未知 | R1-F、R1-I、R1-U 分层，ST-EVIDENCE 保留两个关键未知 | MATCH |
| CQ-08 | 直接复用，不新增模型构件 | 所有实例和时间关系均映射到既有 OT、PT、RT、ST、REL、CON | MATCH |

## 复用挑战

| GAP ID | 结构变化 | 判定 | 依据 |
| --- | --- | --- | --- |
| GAP-R1-01 | 两个菜品使用相同名称 | REUSE | CON-02 与独立制作过程保持实例身份 |
| GAP-R1-02 | 没有购买过程 | REUSE | 过程类型是可选分支，缺少实例不构成模型缺口 |
| GAP-R1-03 | 制作过程与回家明确重叠 | REUSE | REL-MAY_OVERLAP 已能表达 |

## G3 决定

**PASS：8/8 MATCH，0 MISMATCH。**

模型决定：**REUSE**。测试期间没有新增或修改本体构件。
