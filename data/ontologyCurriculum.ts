/**
 * ontologyCurriculum.ts - 14 门本体实战课 5 步渐进式故事化学习流
 * 
 * 教学心智设计：
 * Step 1: 场景故事 (The Story & Dilemma) - 真实业务/生活故事引入
 * Step 2: 误区碰撞 (The Trap vs The Aha!) - ❌ 常见直觉陷阱 vs 💡 Palantir 本体准则
 * Step 3: 直观模型 (Visual Model) - 极简实体卡片与架构口诀
 * Step 4: 动手推演 (Interactive Lab) - 一键推演模拟与 DuckDB 交互代码
 * Step 5: 通关挑战 (Checkpoint Challenge) - 趣味诊断单选题与通关勋章
 */

export interface LessonStepFlow {
  lessonNumber: number;
  stage: 'recognition' | 'topology' | 'assembly' | 'evolution';

  // 教学脚手架字段（新增）
  stageGoal: string;        // 本阶段解决什么核心问题
  whyThisOrder: string;     // 为什么在这个位置学（承上启下）
  coreMethod: string;       // 本课最核心的1句判断方法
  caseConnection: string;   // 本课案例与统一Case（顺达物流）的关联说明
  modelingDecision: {
    objectVsProperty: string;  // Object vs Property 的判断逻辑
    linkCondition: string;     // 什么情况下建 Link
    actionTrigger: string;     // Action 的适用场景与触发条件
  };
  verificationChecklist: string[];  // 3个验证建模是否正确的检查项

  story: {
    scenario: string;
    quote: string;
    dilemma: string;
  };
  trapVsAha: {
    trap: {
      title: string;
      desc: string;
      danger: string;
    };
    aha: {
      title: string;
      desc: string;
      rule: string;
    };
  };
  model: {
    summary: string;
    keyEntities: {
      name: string;
      category: string;
      badge: string;
      badgeColor: 'cyan' | 'blue' | 'yellow' | 'pink' | 'green';
      explanation: string;
    }[];
    goldenRule: string;
  };
  lab: {
    title: string;
    description: string;
    actionLabel: string;
    simulationResult: {
      headline: string;
      stats: { label: string; value: string; color: string }[];
      insight: string;
    };
    duckdbSql: string;
  };
  challenge: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    takeaway: string;
  };
}

export const LESSON_STEP_FLOWS: Record<number, LessonStepFlow> = {
  1: {
    lessonNumber: 1,
    stage: 'recognition',
    stageGoal: '在进入建模之前，首先搞清楚"什么是真实存在的、什么是推断的、什么是未知的"。没有这层边界意识，后续所有建模都是沙上建塔。',
    whyThisOrder: '本体建模的第一步不是画图，而是审视材料——什么是直接证据？什么是主观推断？不做这个区分，后面建的每个关系都可能是伪事实。',
    coreMethod: '只写材料直接描述的事实；遇到"似乎是、应该是"，先设为未知边界，绝不脑补。',
    caseConnection: '本课案例对应统一Case（顺达物流）：取件记录只写"小刘于9:00接到包裹PKG-001"，签收状态未记录——如何建模这个未知边界而不随意填充？',
    modelingDecision: {
      objectVsProperty: '"妈妈"有独立业务身份和行动能力 → Object；"买了鲈鱼"是她的行为事实，挂在购物动作上 → Property 或 Link 的属性，不单独建 Object。',
      linkCondition: '当两个 Object 之间存在材料中有明确动词支撑的业务关系（买、交给、送达）才建 Link；常识推断的关联一律不建。',
      actionTrigger: '发现显式未知边界时，Action = 触发调查任务或补全请求。本课重点在识别边界。',
    },
    verificationChecklist: [
      '每个 Object 在材料中都有直接提及，没有凭经验推断出来的？',
      '每个 Link 背后都有材料中的动词支撑，不是主观脑补的连线？',
      '材料中没有写明的关系，是否都标记为"显式未知"而不是随意假设？',
    ],
    story: {
      scenario: '调查员拿到一份晚餐记录：“妈妈下午去生鲜超市买了鲈鱼和青菜，晚上桌上有三个人一起吃饭。”',
      quote: '“妈妈去超市买菜，晚上三个人就餐。”',
      dilemma: '材料里完全没提第三个人是谁，更没写菜带回家的完整交接。新人工程师很自然地把第三人画成了“父亲”，并在买菜与就餐之间连了线。这样做有什么致命隐患？'
    },
    trapVsAha: {
      trap: {
        title: '❌ 常识脑补陷阱',
        desc: '凭生活经验推测“三口之家必然是父母子女”，把没写的事当成事实写入系统。',
        danger: '在信贷反欺诈或法律取证中，脑补的伪事实会导致决策模型产生巨大假定性漏洞，彻底丧失公信力。'
      },
      aha: {
        title: '💡 材料没写的即是未知',
        desc: '严谨的本体建模必须区分“确凿事实”、“置信推断”与“未知盲区”，为未知单独设立显式未知边界。',
        rule: '宁可显式标记未知，绝不凭常识脑补任何材料未提及的实体。'
      }
    },
    model: {
      summary: '本课核心三要素：事实锁定、推断隔离、未知显式化。',
      keyEntities: [
        { name: '主体·妈妈', category: '实体对象', badge: '100%确凿事实', badgeColor: 'green', explanation: '材料白纸黑字明确提及买菜与就餐的主体' },
        { name: '推断·食材带回', category: '过程推断', badge: '85%高置信推断', badgeColor: 'yellow', explanation: '买菜与做菜之间缺失物理流转证据，置信度设为 0.85' },
        { name: '盲区·第三人', category: '未知边界', badge: '显式未知 (Unknown)', badgeColor: 'pink', explanation: '材料未提及身份，设立未知边界节点，触发后续证据补全' }
      ],
      goldenRule: '先分层置信度，再连线拓扑图。'
    },
    lab: {
      title: '事实与未知边界置信度分层推演',
      description: '点击推演按钮，模拟本体引擎对原始记录中各实体的依据与确证度进行自动化分层。',
      actionLabel: '执行置信度分层推演',
      simulationResult: {
        headline: '本体推理引擎已完成置信度隔离',
        stats: [
          { label: '确凿事实节点', value: '1 项', color: 'text-monokai-green' },
          { label: '置信推断节点', value: '1 项 (0.85)', color: 'text-monokai-yellow' },
          { label: '隔离未知边界', value: '1 项', color: 'text-monokai-pink' }
        ],
        insight: '成功将“未知第三人”隔离在未知边界内，阻断了下游规则算法将此人假定为“直系亲属”的连带误判！'
      },
      duckdbSql: `SELECT 
  name AS entity_name,
  json_extract_string(properties, '$.依据') AS evidence,
  coalesce(json_extract_string(properties, '$.确证度'), '推断置信度 ' || json_extract_string(properties, '$.置信度')) AS certainty
FROM (
  SELECT '做菜人·妈妈' as name, '{"依据":"原文明确提及","确证度":"100%已证事实"}' as properties
  UNION ALL
  SELECT '推断·菜已带回', '{"依据":"买菜后回家","置信度":"0.85"}'
  UNION ALL
  SELECT '未知·第三人', '{"依据":"完全未知","警示":"严禁常识脑补"}'
);`
    },
    challenge: {
      question: '材料中记录“老王去银行取了五万元现金，随后走进了一家汽车 4S 店”。在本体建模中，下列哪个做法是正确的？',
      options: [
        '直接建立连线：“老王 --全款购买了--> 汽车”',
        '建立对象“老王”、“五万元现金”和“4S店”，并将“是否买车”标记为显式未知边界',
        '根据常识，老王取钱进 4S 店一定是去提车，可以直接创建“购车合同”实体'
      ],
      correctIndex: 1,
      explanation: '老王进 4S 店可能只是看车、修车或找人，并未记录成交事实。在本体中只能记录确凿的取钱与进店轨迹，买车属于未经证实的假设，绝不可直接脑补连线。',
      takeaway: '恭喜通关！你已经掌握了本体建模最核心的心智防线：只写材料真正告诉你的事。'
    }
  },

  2: {
    lessonNumber: 2,
    stage: 'recognition',
    stageGoal: '在进入建模之前，首先搞清楚"什么是真实存在的、什么是推断的、什么是未知的"。没有这层边界意识，后续所有建模都是沙上建塔。',
    whyThisOrder: '知道了"只写材料告诉你的"之后，下一个关键问题是：同一个现实物体在系统里应该对应几个 Object？包裹从仓库到快递柜，是一个对象还是两个？',
    coreMethod: '有跨越时间空间依然唯一的业务主键 → Object；随时变化的数字、状态、位置 → Property，不要单独建 Object。',
    caseConnection: '顺达物流：包裹PKG-001从揽收站到转运中心再到快递柜，全程同一个运单号——重量、位置、当前状态应该怎么建模？是新 Object 还是同一 Object 的 Property？',
    modelingDecision: {
      objectVsProperty: '判断关键："如果这个东西消失了，系统里需要删除几条记录？"——多处都有该物体记录（是同一现实物体的状态） → 同一个 Object 的 Property；完全独立存在 → 独立 Object。',
      linkCondition: '包裹与快递员的"经手"关系：有方向（快递员→包裹），有动词（接收、移交），两端都是独立 Object → 建有向 Link。',
      actionTrigger: '本课重点在身份连续性，Action 暂不是重点。',
    },
    verificationChecklist: [
      '这个对象在不同时间/地点下，业务主键是否恒定？（是 → 同一 Object，状态是 Property）',
      '我有没有把纯数值（金额、重量）单独建成 Object？（如有，应改为 Property）',
      '每个 Object 都有不可替代的业务主键，而不只是数据库自增 ID？',
    ],
    story: {
      scenario: '物流分拣中心，周姐把运单号 PKG-2026-B 的包裹交给了快递员小林。包裹从小林的三轮车送到了智能快递柜。',
      quote: '“包裹在分拣仓库重 2.3kg，装车后移至阳光小区 3 号蜂巢柜。”',
      dilemma: '工程师把“仓库包裹”和“快递柜包裹”建成了两张不同的表，还把“包裹重量”单独做成了一个对象。为什么这样会导致系统追踪混乱？'
    },
    trapVsAha: {
      trap: {
        title: '❌ 混淆对象与数值属性',
        desc: '把随时间和空间变化的状态误当成新对象；或者把纯数值（重量、金额）建成了独立实体。',
        danger: '无法跨越时间和空间追踪同一个物理实体的全生命周期轨迹，造成实体身份断裂。'
      },
      aha: {
        title: '💡 对象的灵魂在于连续的唯一身份 (Identity)',
        desc: '对象拥有跨越变迁依然是自身的全局主键；位置、重量、状态只是挂载在对象上的属性变迁。',
        rule: '具有业务唯一标识与持续生命周期的为对象，易变的度量与快照属于属性。'
      }
    },
    model: {
      summary: '区分具备持续身份的实体（Entity）与临时度量属性（Property）。',
      keyEntities: [
        { name: '包裹 PKG-2026-B', category: '实体对象', badge: '全局唯一主键', badgeColor: 'blue', explanation: '物理实体，无论移到哪里主键恒定不变' },
        { name: '仓管员·周姐', category: '实体对象', badge: '责任主体', badgeColor: 'green', explanation: '具备工号主键的业务操作主体' },
        { name: '重量 2.3kg', category: '数值属性', badge: '动态快照属性', badgeColor: 'cyan', explanation: '挂载在包裹上的物理度量，不具备独立生命周期' }
      ],
      goldenRule: '对象穿行时空，属性记录变迁。'
    },
    lab: {
      title: '实体主键唯一性与属性变迁检验',
      description: '点击推演，观察包裹对象在不同流转节点下的全局身份保持性与属性变迁记录。',
      actionLabel: '执行身份连续性推演',
      simulationResult: {
        headline: '全局唯一身份连续性验证通过',
        stats: [
          { label: '核心业务对象', value: '2 个 (包裹+周姐)', color: 'text-monokai-cyan' },
          { label: '挂载动态属性', value: '3 项', color: 'text-monokai-yellow' },
          { label: '主键冲突率', value: '0.0%', color: 'text-monokai-green' }
        ],
        insight: '包裹在离开周姐仓库后，唯一主键保持恒定，成功将位置变更映射为流转记录而非新建对象！'
      },
      duckdbSql: `SELECT 
  json_extract_string(properties, '$.身份主键') AS identity_key,
  name,
  annotations
FROM (
  SELECT '仓管·周姐' as name, '{"身份主键":"ID_ZHOU_01"}' as properties, '主管' as annotations
  UNION ALL
  SELECT '包裹B', '{"身份主键":"PKG_2026_B"}' as properties, '流转标的' as annotations
);`
    },
    challenge: {
      question: '在电商系统本体建模中，用户购买商品支付了 299 元。下列哪种建模方式符合本体规范？',
      options: [
        '创建一个独立对象“299元实体”，分别连线给用户和商品',
        '把 299 元作为订单对象的“支付金额 (payment_amount)”属性',
        '为每次支付创建一个“299元全局字典表”'
      ],
      correctIndex: 1,
      explanation: '金额属于依附于订单交易的具体数值度量，不具备独立的生命周期和自主变迁能力，应作为订单对象的属性。',
      takeaway: '优秀！你已掌握了本体工程基石：对象拥有连续身份，度量属于属性。'
    }
  },

  3: {
    lessonNumber: 3,
    stage: 'recognition',
    stageGoal: '在进入建模之前，首先搞清楚"什么是真实存在的、什么是推断的、什么是未知的"。没有这层边界意识，后续所有建模都是沙上建塔。',
    whyThisOrder: '前两课教了如何识别 Object 和 Property。但现实中还有第三种情况：信息根本不存在，我们怎么优雅地处理"不知道"？这是边界识别阶段的最后一块拼图。',
    coreMethod: '未知 ≠ NULL ≠ False；未知是一个等待被证据填满的信息空洞，必须显式建模（值为 UNKNOWN）并触发行动去补全。',
    caseConnection: '顺达物流：PKG-002的快递员交接记录写"已出库"，但收件人签收状态未知——系统应标注 UNKNOWN 并触发催签通知，而不是默认填"未签收"。',
    modelingDecision: {
      objectVsProperty: '"防护状态未知"是 Object（患者）上的一个 Property，属性值枚举为 UNKNOWN（显式状态，而不是 NULL 或 False）。',
      linkCondition: '未知边界通常不新建 Link，而是将 Property 值设为 UNKNOWN，等待证据填充后再建立关系。',
      actionTrigger: '这是 Action 第一次登场：Property = UNKNOWN → 系统自动触发 Action（发送催确认通知、派发调查任务）。',
    },
    verificationChecklist: [
      '系统中是否有显式的 UNKNOWN/待确认 状态枚举，而不是用 NULL 或 False 代替未知？',
      '每个显式未知边界是否都挂载了至少一个 Action（补全任务/催查通知）？',
      '不同程度的未知是否有区分（确定未知 vs 暂未获取 vs 不适用）？',
    ],
    story: {
      scenario: '患者就诊卡记录：“患者李某突发高热 39.5℃，曾于 3 日前接触过不明发热人员，未知是否佩戴口罩，未做核酸检测。”',
      quote: '“未知是否佩戴口罩，未做核酸检测。”',
      dilemma: '如果数据库设计只留了布尔字段 mask_worn (TRUE/FALSE)，没有录入这个选项，录入员只能默认勾选 FALSE。这会导致什么恶果？'
    },
    trapVsAha: {
      trap: {
        title: '❌ 将缺失信息默认为否定 (False/Null)',
        desc: '很多传统系统因字段限制，把“不知道”直接强转为“没有发生”。',
        danger: '“未知是否佩戴”变成了“确凿未戴”，传染风险模型被严重假数据放大或误导。'
      },
      aha: {
        title: '💡 显式建模未知边界与证据补全诉求',
        desc: '未知不是 NULL，未知是一个需要被后续侦测活动闭环的“信息空洞（Information Hole）”。',
        rule: '将未知作为显式状态呈现，并生成信息补全行动（Action）。'
      }
    },
    model: {
      summary: '将盲区显式化，驱动下游自动化补全。',
      keyEntities: [
        { name: '患者·李某', category: '主体对象', badge: '确凿实体', badgeColor: 'green', explanation: '确定的患者主体' },
        { name: '防护状态盲区', category: '未知边界', badge: 'Explicit Unknown', badgeColor: 'pink', explanation: '显式状态：未探明是否佩戴防护' },
        { name: '流行病调查问卷', category: '闭环行动', badge: '触发行动 (Action)', badgeColor: 'yellow', explanation: '系统自动生成的待补全任务' }
      ],
      goldenRule: '未知不是死胡同，而是探索行动的起点。'
    },
    lab: {
      title: '未知边界与自动化补全探针推演',
      description: '点击推演，观察本体如何将数据缺失转化为待办工单与探针。',
      actionLabel: '推演未知边界捕获',
      simulationResult: {
        headline: '未知边界已被显式捕获并挂载行动',
        stats: [
          { label: '已探明事实', value: '2 项', color: 'text-monokai-green' },
          { label: '显式未知空洞', value: '1 个', color: 'text-monokai-pink' },
          { label: '派生调查任务', value: '1 个工单', color: 'text-monokai-yellow' }
        ],
        insight: '成功阻断了默认填 FALSE 导致的误诊风险，并自动触发了追问工单！'
      },
      duckdbSql: `SELECT 
  '患者·李某' AS patient,
  '防护状态' AS attribute,
  'UNKNOWN' AS state,
  '触发补充流调工单' AS action_triggered;`
    },
    challenge: {
      question: '供应链系统中，供应商未提交某批次零件的质检报告。下列哪种处理最符合显式未知边界原则？',
      options: [
        '直接标记为“质检不合格”，退回货物',
        '系统自动填入合格率 0%，等待人工覆盖',
        '记录质检状态为“待质检/未知”，并在本体中触发“质检催收工单”行动'
      ],
      correctIndex: 2,
      explanation: '缺失报告不代表质检不合格，显式将状态设为待探明并触发行动，才能精准反映真实业务推进。',
      takeaway: '太棒了！至此你已经攻克了第一阶段【识别与边界】的全部核心准则！'
    }
  },

  4: {
    lessonNumber: 4,
    stage: 'topology',
    stageGoal: '确认了什么是 Object 之后，下一步是建立关系网络（Link）并追踪状态随时间的变化。这是从"知道有什么"到"知道发生了什么"的飞跃。',
    whyThisOrder: '有了正确的 Object 定义，现在要把它们连接起来。但连接有讲究——不是随便画一条线，必须说清楚方向和语义动词，否则图遍历就失去意义。',
    coreMethod: '每个 Link 必须有：源 Object、目标 Object、语义动词（如 REPLACED）和反向谓词（如 WAS_REPLACED_BY）——缺一不可。',
    caseConnection: '顺达物流：快递员小刘 --[RECEIVED]--> 包裹PKG-001；当包裹出问题时，反向查询 PKG-001 --[WAS_RECEIVED_BY]--> 小刘，才能快速定位责任人。',
    modelingDecision: {
      objectVsProperty: '本课重点是 Link 的有向语义，不引入新的 Object/Property 判断要点。',
      linkCondition: '建 Link 的三个判断：① 两端都是独立 Object；② 之间有具体业务动词支撑；③ 业务上需要从两个方向查询（谁做了什么 vs 什么被谁做了）。',
      actionTrigger: '本课重点在拓扑建立，Action 暂不涉及。',
    },
    verificationChecklist: [
      '每个 Link 都有明确的方向（source → target），不是无向的双向连线？',
      '每个 Link 都定义了反向谓词，能从目标 Object 反向导航到源 Object？',
      '所有 Link 类型名称都是动词短语（如 MANAGED_BY、CONTAINS），不是名词？',
    ],
    story: {
      scenario: '航空维修台账记录：“机务老张对 3 号发动机进行了更换，旧发动机送往大修厂，新发动机来自航材库。”',
      quote: '“老张更换 3 号发动机；旧件返厂，新件入役。”',
      dilemma: '如果只在发动机和老张之间拉一条无方向的粗线“关联”，系统就根本无法判断谁修理了谁，更无法追溯航材的流向。'
    },
    trapVsAha: {
      trap: {
        title: '❌ 模糊无向连线',
        desc: '很多画图者喜欢在两个实体之间画一条虚线并标注“有关”，丢失了动词和主客体关系。',
        danger: '下游图算法无法计算出入度与因果传递路径，本体退化为死图。'
      },
      aha: {
        title: '💡 关系必有方向、动词语义与逆向导航',
        desc: '每个 LinkType 必须明确源（Source）、目标（Target）和语义动词，并定义反向谓词（如“被……维修”）。',
        rule: '有向有动词，正反双向导航无歧义。'
      }
    },
    model: {
      summary: '有向强语义关联构建图谱基础。',
      keyEntities: [
        { name: '机务·老张', category: '主体对象', badge: 'Source (源)', badgeColor: 'cyan', explanation: '维修动作的发起者与执行人' },
        { name: '关系: REPLACED', category: '有向关系', badge: '双向语义', badgeColor: 'blue', explanation: '正向：老张更换了发动机；逆向：发动机被老张更换' },
        { name: '3号发动机', category: '客体标的', badge: 'Target (目标)', badgeColor: 'green', explanation: '维修动作的受体' }
      ],
      goldenRule: '一条关系定义，双向导航畅通。'
    },
    lab: {
      title: '双向语义关系导航拓扑推演',
      description: '点击推演，验证从工程师出发与从航材出发的双向遍历是否具备等效语义。',
      actionLabel: '执行拓扑双向导航推演',
      simulationResult: {
        headline: '有向拓扑语义链路构建完成',
        stats: [
          { label: '正向导航路径', value: '工程师 -> 拆卸 -> 发动机', color: 'text-monokai-cyan' },
          { label: '反向追踪路径', value: '发动机 -> 经手 -> 工程师', color: 'text-monokai-blue' },
          { label: '语义完整度', value: '100%', color: 'text-monokai-green' }
        ],
        insight: '当发动机出现故障报警时，反向查询能毫秒级定位当时经手的机务工程师与检修规程！'
      },
      duckdbSql: `SELECT 
  '机务·老张' AS source_entity,
  'REPLACED (更换)' AS link_type,
  '3号发动机' AS target_entity,
  'WAS_REPLACED_BY (被更换于)' AS inverse_link;`
    },
    challenge: {
      question: '在银行风控本体中，公司 A 为公司 B 提供了 5000 万贷款担保。下列关系建模最合理的是？',
      options: [
        '在 A 和 B 之间建立无向连线“商业关联”',
        '建立有向边：A --[GUARANTEES (担保)]--> B，反向边为 B --[GUARANTEED_BY (被担保)]--> A',
        '将担保直接作为公司 A 的一个文本备注字段'
      ],
      correctIndex: 1,
      explanation: '担保具有极强的风险传导方向性。A 担保 B 意味着 B 违约会传导给 A，必须有清晰的有向连线与逆向导航。',
      takeaway: '精准理解！关系必有方向与语义，是图遍历与因果追溯的核心。'
    }
  },

  5: {
    lessonNumber: 5,
    stage: 'topology',
    stageGoal: '确认了什么是 Object 之后，下一步是建立关系网络（Link）并追踪状态随时间的变化。这是从"知道有什么"到"知道发生了什么"的飞跃。',
    whyThisOrder: '建好了静态的关系拓扑，现在要处理"变化"——对象的状态随时间演变。直接覆写字段会让历史记录永久消失，需要用事件流保留完整时序。',
    coreMethod: '每次状态迁跃不是更新字段，而是创建一个不可变的状态变迁事件 Object，挂在主体上形成事件链，任意历史时刻都可复现。',
    caseConnection: '顺达物流：包裹PKG-001状态变化：揽收(9:00)→到站(11:00)→派送中(14:00)→签收(16:00)。如果只保留最新状态，12:00 时包裹在哪里将永远无法查询。',
    modelingDecision: {
      objectVsProperty: '"当前状态"是主体 Object 上的实时快照 Property。"历次状态变迁"是独立的 StatusEvent Object（不可变），通过 HAS_STATUS_EVENT Link 挂在主体上。',
      linkCondition: '主体 --[HAS_STATUS_EVENT]--> StatusEvent（一对多）。StatusEvent 之间用 FOLLOWS Link 形成时序链。',
      actionTrigger: '当特定 StatusEvent 被创建时（如"派送超时"），自动触发 Action（客服联系/异常报告）。',
    },
    verificationChecklist: [
      '任意历史时间点，都能通过查询事件链还原出该 Object 当时的完整状态快照？',
      '状态变迁事件有操作人、时间戳，创建后不可修改（只能追加新事件）？',
      '从最早事件到最新事件，形成完整连续的时序链，没有孤立的"孤岛事件"？',
    ],
    story: {
      scenario: '急诊科抢救记录：“患者 10:00 处于昏迷，10:15 静脉推注肾上腺素，10:30 意识转清，心率稳定。”',
      quote: '“10:00 昏迷 -> 10:15 用药 -> 10:30 转清”',
      dilemma: '如果直接在患者身上不断 UPDATE 状态字段，10:30 的时候，系统就完全查不到 10:00 曾经昏迷的记录，抢救时序证据被覆写抹杀。'
    },
    trapVsAha: {
      trap: {
        title: '❌ 粗暴 UPDATE 覆写状态',
        desc: '把状态当成单行文本字段覆盖，导致历史断层。',
        danger: '医疗事故调查或风控溯源时，无法复原关键时序节点的状态截面。'
      },
      aha: {
        title: '💡 状态变迁是带有时间戳的事件对象 (Event/Transition)',
        desc: '每次状态迁跃都是不可篡改的历史事实，通过链表或事件流关联到主体。',
        rule: '核心实体状态变迁不可覆写，每次迁跃皆为不可变事件。'
      }
    },
    model: {
      summary: '状态机与时序快照的优雅统一。',
      keyEntities: [
        { name: '患者主体', category: '长周期实体', badge: '恒定主键', badgeColor: 'green', explanation: '跨越抢救全程的唯一主体' },
        { name: '状态事件流', category: '事件序列', badge: '不可变时序', badgeColor: 'yellow', explanation: '10:00昏迷 -> 10:15用药 -> 10:30转清' },
        { name: '当前有效状态', category: '物化视图', badge: '实时快照', badgeColor: 'cyan', explanation: '当前心率稳定、意识清醒' }
      ],
      goldenRule: '状态变迁留痕迹，历史不可被抹杀。'
    },
    lab: {
      title: '时序状态机与快照重现推演',
      description: '点击推演，重现患者在 10:00、10:15、10:30 任意时刻的状态切片。',
      actionLabel: '重现任意历史状态截面',
      simulationResult: {
        headline: '时序快照重现引擎推演成功',
        stats: [
          { label: '历史事件链', value: '3 节点', color: 'text-monokai-cyan' },
          { label: '当前最新状态', value: '意识转清', color: 'text-monokai-green' },
          { label: '历史覆写率', value: '0.0%', color: 'text-monokai-pink' }
        ],
        insight: '任何时刻的状态均可 100% 精确复现，用药前后的心率变化呈现清晰因果对比！'
      },
      duckdbSql: `SELECT 
  '2026-09-17 10:00' AS timestamp, '昏迷' AS status, '等待抢救' AS note
UNION ALL
SELECT '2026-09-17 10:15', '用药中', '推注肾上腺素'
UNION ALL
SELECT '2026-09-17 10:30', '意识转清', '心率恢复稳定';`
    },
    challenge: {
      question: '金融风控系统在处理账户冻结与解冻时，下列哪种本体设计最优？',
      options: [
        '直接在账户表上执行 UPDATE account SET status = "frozen"',
        '创建不可变的“账户状态变迁事件 (StatusChangeEvent)”，记录操作人、原因、时间戳及前后状态',
        '只记录当前状态，在日志文本文件里随便打一行 log 即可'
      ],
      correctIndex: 1,
      explanation: '创建独立的不可变状态变迁事件，能提供完备的合规审计轨迹与时间旅行（Time Travel）回溯能力。',
      takeaway: '漂亮！不可篡改的状态机是严肃企业级系统的护城河。'
    }
  },

  6: {
    lessonNumber: 6,
    stage: 'topology',
    stageGoal: '确认了什么是 Object 之后，下一步是建立关系网络（Link）并追踪状态随时间的变化。这是从"知道有什么"到"知道发生了什么"的飞跃。',
    whyThisOrder: '单节点关系查清楚了，现在要面对现实：业务关系经常不是直接的，而是通过中间人、机构传导的。扁平表根本看不到这种穿透关系。',
    coreMethod: '多跳拓扑 = 从起点出发，沿 Link 链条向外扩散 N 层，发现通过中间节点间接关联的隐藏路径。3 跳以内的间接关系通常能揭示关键风险。',
    caseConnection: '顺达物流追查假冒商品：发货人A → 转包给中间商B → 实际发货仓库C → 收件人D。A与D无直接关联，但 3 跳拓扑穿透发现完整的虚假发货链路。',
    modelingDecision: {
      objectVsProperty: '中转节点（皮包公司、转仓、中间人）必须建模为独立 Object，不能压缩为 Link 的属性或文本注释。',
      linkCondition: '每一跳都必须是有具体语义的有向 Link，不能用"间接关联"替代具体动词。每个中间 Object 都必须明确建模。',
      actionTrigger: '当多跳路径的终点命中风险标签（如黑名单地址），触发 Action（标记待核查、通知合规团队）。',
    },
    verificationChecklist: [
      '所有中间节点都被建模为独立 Object，而不是属性或注释文本？',
      '多跳路径上的每条 Link 都有具体语义动词，不是模糊的"有关联"？',
      '图遍历能找到 N 跳以内的所有路径，不只是直接相邻的 1 跳关系？',
    ],
    story: {
      scenario: '反洗钱排查：表面上看，张三和李四没有任何资金往来。但经图谱穿透，张三把钱打给了皮包公司 A，公司 A 投资了公司 B，公司 B 最终转账给李四。',
      quote: '“张三 -> 公司A -> 公司B -> 李四”',
      dilemma: '扁平的 SQL 单表关联在遇到 3 跳以上的复杂拓扑时，写出来的 JOIN 语句极为恐怖且性能极差。本体图谱如何破局？'
    },
    trapVsAha: {
      trap: {
        title: '❌ 扁平单层关联思维',
        desc: '仅关注直接发生联系的双方，忽略隐蔽的间接传导链路。',
        danger: '无法看破穿透式持股、多层洗钱与供应链多跳断供风险。'
      },
      aha: {
        title: '💡 多跳拓扑图谱计算与路径发现',
        desc: '在本体中定义图遍历规则，支持任意层级的多跳路径扩散与闭环检测。',
        rule: '从单点看数跃迁到全图穿透，3 跳之内现真形。'
      }
    },
    model: {
      summary: '多跳因果拓扑发现隐蔽链路。',
      keyEntities: [
        { name: '张三 (源头)', category: '洗钱源点', badge: '转出方', badgeColor: 'pink', explanation: '资金源头节点' },
        { name: '多跳中继节点', category: '中间通道', badge: '2跳通道', badgeColor: 'yellow', explanation: '空壳公司 A 与控股公司 B' },
        { name: '李四 (终点)', category: '收益主体', badge: '实际收益人', badgeColor: 'green', explanation: '隐蔽的资金终局流向' }
      ],
      goldenRule: '扁平表见树木，多跳图现森林。'
    },
    lab: {
      title: '多跳拓扑路径穿透推演',
      description: '点击推演，运行图遍历算法寻找张三与李四之间的最短隐藏流转路径。',
      actionLabel: '执行 3 跳深度图穿透',
      simulationResult: {
        headline: '发现张三与李四之间的隐藏传导链路',
        stats: [
          { label: '拓扑穿透深度', value: '3 跳 (Hops)', color: 'text-monokai-cyan' },
          { label: '流转中继主体', value: '2 家空壳企业', color: 'text-monokai-yellow' },
          { label: '洗钱团伙关联度', value: '98.4%', color: 'text-monokai-pink' }
        ],
        insight: '成功识别出穿透式洗钱链路，直接定位最终实际控制人李四！'
      },
      duckdbSql: `WITH RECURSIVE transfer_path AS (
  SELECT '张三' AS source, '公司A' AS target, 1 AS depth
  UNION ALL
  SELECT '公司A', '公司B', 2
  UNION ALL
  SELECT '公司B', '李四', 3
)
SELECT * FROM transfer_path;`
    },
    challenge: {
      question: '供应链风险排查中，二级供应商突然断供，如何评估对我司核心产品的影响？',
      options: [
        '只查看与我司直接签署合同的一级供应商名录',
        '通过本体图谱进行多跳拓扑向上追溯，计算受影响的一级零部件及关联产线',
        '等产品造不出来了再停工排查'
      ],
      correctIndex: 1,
      explanation: '多跳拓扑能够自动沿供应树向上传导风险，提前预测下游总装产线的停产断供影响。',
      takeaway: '厉害！掌握了多跳拓扑，你就拥有了穿透复杂业务暗流的透视眼。'
    }
  },

  7: {
    lessonNumber: 7,
    stage: 'topology',
    stageGoal: '确认了什么是 Object 之后，下一步是建立关系网络（Link）并追踪状态随时间的变化。这是从"知道有什么"到"知道发生了什么"的飞跃。',
    whyThisOrder: '多跳拓扑能找到间接关联，但要判断"是不是因果关系"，还要加上严格的时间顺序约束。这是拓扑与变迁阶段的综合终章。',
    coreMethod: '因果关系 = 时序先后（A严格早于B发生） + 拓扑连通（A和B之间有明确传导路径）。只有时序或只有连通都不足以断定因果。',
    caseConnection: '顺达物流异常分析：14:00中转站冰柜故障 → 14:30生鲜包裹温控异常 → 15:00客户收到损坏商品。如何证明是冰柜故障导致的，而不是运输途中其他原因？',
    modelingDecision: {
      objectVsProperty: '每个事件节点是独立的 EventObject，包含时间戳、触发类型和传导路径描述，不能压缩为 Property。',
      linkCondition: '因果链上的 Link 类型应为 CAUSES / LEADS_TO，必须注明传导介质（温度传导、电信号、资金流动等）。',
      actionTrigger: '根因事件一经确认，立即触发 Action（如启动召回流程、向保险申报、通知相关方）。',
    },
    verificationChecklist: [
      '因果链上每对事件都满足：原因时间戳 < 结果时间戳，没有时序倒置？',
      '每条因果 Link 有明确的物理或逻辑传导介质说明，不只是"可能有关"？',
      '逆序从结果往前追，能无断点地回溯到最初根因事件，没有"悬空结论"？',
    ],
    story: {
      scenario: '电力调度中心：“14:00 变电站雷击跳闸，14:01 备用发电机启动失败，14:03 数据中心双路掉电，14:05 交易系统瘫痪。”',
      quote: '“雷击(14:00) -> 发电机失败(14:01) -> 掉电(14:03) -> 瘫痪(14:05)”',
      dilemma: '如果时间戳记录混乱，或者仅仅把这 4 件事看作孤立报警，调度员就无法判定究竟是雷击导致的，还是数据中心自身的故障。'
    },
    trapVsAha: {
      trap: {
        title: '❌ 将时序相关性当成因果必然',
        desc: '缺乏严格时序先后关系与物理传导因果链约束。',
        danger: '容易出现“公鸡打鸣导致太阳升起”的荒谬归因，错失真正故障源。'
      },
      aha: {
        title: '💡 时序因果链推演 (Temporal Causality)',
        desc: '事件必须满足时序先后（T_cause < T_effect）且具备物理网络拓扑连通性。',
        rule: '时序为经，拓扑为纬，严谨推导根因因果链。'
      }
    },
    model: {
      summary: '时间线与拓扑传导的因果交织。',
      keyEntities: [
        { name: '根因事件: 雷击', category: '原始扰动', badge: 'T0 (14:00)', badgeColor: 'pink', explanation: '物理世界的初始冲击' },
        { name: '传导事件: 发电机故障', category: '连锁反应', badge: 'T1 (14:01)', badgeColor: 'yellow', explanation: '防御系统失效' },
        { name: '业务影响: 交易瘫痪', category: '终端恶果', badge: 'T3 (14:05)', badgeColor: 'cyan', explanation: '最终影响的业务价值' }
      ],
      goldenRule: '前事推后事，因果链成网。'
    },
    lab: {
      title: '时序因果链根因排查推演',
      description: '点击推演，逆序倒推各节点因果依赖，秒级定位事故第一触发源。',
      actionLabel: '推演事故因果链与根因定位',
      simulationResult: {
        headline: '事故根因因果链还原完成',
        stats: [
          { label: '初始根因', value: '14:00 变电站雷击', color: 'text-monokai-pink' },
          { label: '故障扩散耗时', value: '5 分钟', color: 'text-monokai-yellow' },
          { label: '关键阻断失误点', value: '备用发电机启动失败', color: 'text-monokai-cyan' }
        ],
        insight: '定位到备用发电机为阻断失败的核心责任环节，而非交易系统本身软件 Bug！'
      },
      duckdbSql: `SELECT 
  event_time,
  event_name,
  causal_parent,
  '因果链成立' AS validation
FROM (
  SELECT '14:00' AS event_time, '变电站雷击' AS event_name, NULL AS causal_parent
  UNION ALL
  SELECT '14:01', '发电机启动失败', '变电站雷击'
  UNION ALL
  SELECT '14:03', '数据中心掉电', '发电机启动失败'
  UNION ALL
  SELECT '14:05', '交易系统瘫痪', '数据中心掉电'
);`
    },
    challenge: {
      question: '判定事件 A 是否为事件 B 的根因，在本体因果推演中必须同时满足哪两个条件？',
      options: [
        'A 和 B 发生在同一个月份，且涉及同一位员工',
        'A 的发生时间严格早于 B，且 A 和 B 之间存在物理或逻辑传导路径',
        '只要 B 发生后大家普遍认为是 A 引起的即可'
      ],
      correctIndex: 1,
      explanation: '因果推演的两大铁律：严格的时间先后顺序（时序前置）与明确的因果传递介质（拓扑连通）。',
      takeaway: '恭喜！第二阶段【拓扑与变迁】顺利结业，你已能洞察动态演变的图谱全貌！'
    }
  },

  8: {
    lessonNumber: 8,
    stage: 'assembly',
    stageGoal: '有了正确的 Object、Link 和时序之后，挑战是：多源数据如何汇聚成统一视图？计算指标如何保持实时准确？如何在本体上直接驱动业务行动？',
    whyThisOrder: '前面都是在单一数据源内建模。现实是企业有多个系统，同一个现实对象在不同系统里有不同名字。组装阶段首先要解决：如何把它们认成同一个。',
    coreMethod: '实体对齐 = 找到权威全局主键（如统一社会信用代码、身份证号），把不同系统的别名都挂在同一个本体 Object 下，而不是创建多个重复 Object。',
    caseConnection: '顺达物流的企业客户：CRM里叫"北京科技"，ERP里叫"科技BJ-001"，合同系统里是"91110108MA000000"——三个名字，一个现实实体，如何建成唯一的 MasterObject？',
    modelingDecision: {
      objectVsProperty: '各系统的别名是 Property（alias_crm、alias_erp），不是新的 Object。唯一真实的 MasterObject 以全局权威主键（信用代码/身份证号）为准。',
      linkCondition: '融合前，不同系统的源记录可以临时建为 SourceRecord Object，通过 RESOLVES_TO Link 指向融合后的 MasterObject。',
      actionTrigger: '当发现两个记录主键相同但属性冲突时，触发 Action（人工审核/自动合并，输出融合置信度报告）。',
    },
    verificationChecklist: [
      '每个现实世界实体在本体中只有一个 MasterObject，没有来自不同源系统的重复建模？',
      '所有源系统别名都作为 Property 挂在 MasterObject 上，可追溯来源系统？',
      '融合算法有量化置信度，低于阈值的合并会触发人工复核而不是自动通过？',
    ],
    story: {
      scenario: '跨系统数据整合：CRM 里的“北京字节”，ERP 里的“字节跳动”，合同系统里的“91110108MA...”。其实都是同一家公司。',
      quote: '“三套系统，三个名字，其实是同一个实体。”',
      dilemma: '如果直接把三张表塞进数据库，同一家客户会被当成三个互不相识的对象，造成信用额度重复授信甚至坏账。'
    },
    trapVsAha: {
      trap: {
        title: '❌ 机械按表头字段硬合并',
        desc: '不同源系统主键各异，直接 UNION 导致同一现实实体分裂成多份。',
        danger: '同一客户数据割裂，无法形成 360 度全局统一视图，业务决策完全脱节。'
      },
      aha: {
        title: '💡 跨源对象唯一身份对齐 (Entity Resolution)',
        desc: '以统一社会信用代码/生物识别等全局唯一锚点为主键，建立多源别名映射与实体融合。',
        rule: '多源映射归一物，现实世界只有一个他。'
      }
    },
    model: {
      summary: '跨源数据汇聚于全局本体唯一身份。',
      keyEntities: [
        { name: '全局本体企业: 字节跳动', category: '融合实体', badge: '全局金标主键', badgeColor: 'green', explanation: '统一社会信用代码唯一锚定' },
        { name: 'CRM 源记录', category: '源数据别名', badge: '源别名 1', badgeColor: 'cyan', explanation: '别名：北京字节 (CRM_009)' },
        { name: 'ERP 源记录', category: '源数据别名', badge: '源别名 2', badgeColor: 'blue', explanation: '别名：字节跳动科技有限公司 (ERP_581)' }
      ],
      goldenRule: '万流归海，身份合一。'
    },
    lab: {
      title: '多源实体融合与去重对齐推演',
      description: '点击推演，模拟根据统一信用代码将 3 套异构系统数据融合成 1 个高置信本体对象。',
      actionLabel: '执行实体对齐融合算法',
      simulationResult: {
        headline: '多源异构记录已成功融合成统一实体',
        stats: [
          { label: '输入源记录数', value: '3 条', color: 'text-monokai-cyan' },
          { label: '融合后唯一实体', value: '1 个', color: 'text-monokai-green' },
          { label: '数据重复率消除', value: '100%', color: 'text-monokai-yellow' }
        ],
        insight: '成功融合了该企业在 CRM 的销售历史与在 ERP 的付款信用，统一视图构建完成！'
      },
      duckdbSql: `SELECT 
  '91110108MA000000' AS unified_uscc,
  '字节跳动' AS unified_name,
  list(source_system) AS merged_sources
FROM (
  SELECT 'CRM系统' AS source_system
  UNION ALL SELECT 'ERP系统'
  UNION ALL SELECT '合同法务系统'
);`
    },
    challenge: {
      question: '医院在整合就诊记录与疫苗接种记录时，患者姓名同音字不同（“张伟”与“张玮”），最佳融合策略是？',
      options: [
        '直接把他们当作两个完全不同的人分开对待',
        '把所有叫张伟的全部合并为一个账号',
        '依据唯一身份证号/医保卡号强对齐，将不同来源的拼写差异作为别名挂载在同一身份下'
      ],
      correctIndex: 2,
      explanation: '身份对齐必须依赖权威强锚点（如身份证号），姓名差异作为多源别名记录，确保人码精确对应。',
      takeaway: '精辟！多源实体融合是大型企业打破数据烟囱的第一杀手锏。'
    }
  },

  9: {
    lessonNumber: 9,
    stage: 'assembly',
    stageGoal: '有了正确的 Object、Link 和时序之后，挑战是：多源数据如何汇聚成统一视图？计算指标如何保持实时准确？如何在本体上直接驱动业务行动？',
    whyThisOrder: '实体统一之后，面临另一个问题：很多业务指标是算出来的（逾期天数、在途时间），存成静态字段随时可能过期，批处理失败就产生灾难性不一致。',
    coreMethod: '存不可变的原子事实（借款日期、发货时间戳），所有派生指标定义为基于原子事实的实时计算函数，而不是批处理更新的存储值。',
    caseConnection: '顺达物流：包裹PKG-001的"在途天数"不能存死，每天都在增加。"预计到达时间"可根据发货时间+历史平均速度实时算出，不需要每天更新数据库。',
    modelingDecision: {
      objectVsProperty: '区分两类：① 原子不可变事实（发货时间戳）→ 静态 Property；② 衍生计算值（在途天数）→ Derived Property，定义为函数不存储具体值。',
      linkCondition: '派生属性不影响 Link 的建立方式，Link 依然按业务关系建立。',
      actionTrigger: '当派生属性值超过阈值（在途天数 > 5天），自动触发 Action（异常预警/催回通知）。',
    },
    verificationChecklist: [
      '每个存储的属性值在创建后是否真的不会随时间自然老化？（否 → 应改为 Derived Property 函数）',
      '所有 Derived Property 都有明确的计算公式，而不是依赖定时脚本批量更新？',
      '当原子事实被修改时，所有依赖它的 Derived Property 能自动级联更新？',
    ],
    story: {
      scenario: '金融借贷平台：每天每小时用户的“逾期天数”都在增加。如果每天深夜批处理修改数据库里的数字，白天查出来的永远是旧数据。',
      quote: '“静态存储的数字天天落后，实时计算的指标才是真理。”',
      dilemma: '把可以动态算出来的衍生指标硬保存在数据库里，往往会导致不同部门算出来的值各不相同，数据一致性完全崩溃。'
    },
    trapVsAha: {
      trap: {
        title: '❌ 将衍生属性当静态字段死存',
        desc: '到处建字段存“年龄”、“逾期天数”、“总消费金额”，导致数据源频繁脏读。',
        danger: '时间一过数据就失效，批处理失败就产生灾难性账目不平。'
      },
      aha: {
        title: '💡 派生属性与聚合指标 (Derived & Aggregated Properties)',
        desc: '静态存原子事实（如出生日期、借款时刻），衍生指标定义为基于原子事实的实时动态函数。',
        rule: '存不可变原子事实，算动态实时衍生指标。'
      }
    },
    model: {
      summary: '原子事实层与派生计算层的清晰解耦。',
      keyEntities: [
        { name: '原子事实: 借款到期日', category: '不可变事实', badge: '底层原子', badgeColor: 'green', explanation: '合同确定的还款日 2026-09-01' },
        { name: '派生函数: 逾期天数', category: '动态指标', badge: '实时计算', badgeColor: 'yellow', explanation: 'date_diff(current_date, 到期日)' },
        { name: '风险等级', category: '规则推导', badge: '衍生标签', badgeColor: 'pink', explanation: '逾期 > 15 天自动降为高风险' }
      ],
      goldenRule: '事实不可变，指标随风算。'
    },
    lab: {
      title: '派生属性实时动态推演',
      description: '点击推演，观察当前时刻动态派生出实时的逾期天数与风险等级。',
      actionLabel: '触发衍生指标实时计算',
      simulationResult: {
        headline: '派生指标计算完毕，数据 100% 实时保真',
        stats: [
          { label: '还款到期日', value: '2026-09-01', color: 'text-monokai-cyan' },
          { label: '实时推算逾期天数', value: '16 天', color: 'text-monokai-yellow' },
          { label: '动态风险定级', value: '高风险 (High)', color: 'text-monokai-pink' }
        ],
        insight: '无需任何批处理更新，任何人在任何时刻访问该客户对象，逾期天数都毫秒级精确！'
      },
      duckdbSql: `SELECT 
  '借款合同_01' AS loan_id,
  DATE '2026-09-01' AS due_date,
  current_date - DATE '2026-09-01' AS overdue_days,
  CASE WHEN current_date - DATE '2026-09-01' > 15 THEN '高风险' ELSE '正常' END AS risk_tier;`
    },
    challenge: {
      question: '电商系统设计用户对象属性时，下列哪个属性应该设计为“动态派生属性”而非静态存储？',
      options: [
        '用户的注册时间 (created_at)',
        '用户的身份证出生日期 (birth_date)',
        '用户的最近 30 天消费总金额 (total_spent_30d)'
      ],
      correctIndex: 2,
      explanation: '注册时间和生日是永久不变的原子事实。而“最近30天消费总金额”每天都在滑动，必须作为订单聚合派生指标计算。',
      takeaway: '漂亮！区分原子事实与派生指标，让你的系统架构永不陈旧。'
    }
  },

  10: {
    lessonNumber: 10,
    stage: 'assembly',
    stageGoal: '有了正确的 Object、Link 和时序之后，挑战是：多源数据如何汇聚成统一视图？计算指标如何保持实时准确？如何在本体上直接驱动业务行动？',
    whyThisOrder: '数据汇聚、指标计算都做好了，但如何保证进来的数据是合理的、符合现实物理法则的？本体需要成为数据质量的最后防腐层，不能依赖前端表单。',
    coreMethod: '物理世界的硬性约束（温度范围、百分比上限）必须在本体层编码为不可绕过的校验规则，绕过前端依然会被拦截。',
    caseConnection: '顺达物流冷链：温控设定值被手误输成 -300℃。如果本体层没有约束拦截，错误值会传给制冷设备控制器，造成硬件损坏和货物损失。',
    modelingDecision: {
      objectVsProperty: '约束规则不是 Object 也不是 Property，它是 Object Type 定义上的元约束（CHECK CONSTRAINT），作用于特定 Property 的值域。',
      linkCondition: '跨对象业务约束（如实习生工资不能超过总经理）需要在跨 Object 的业务规则层定义，比单 Object 的属性约束更复杂。',
      actionTrigger: '约束校验违例时立即触发 Action（拒绝写入 + 发送告警通知），不允许先写入再事后修复。',
    },
    verificationChecklist: [
      '所有数值属性都有明确的上下界约束，覆盖物理意义上的极限？',
      '约束校验在数据进入本体时执行，而不是依赖前端 UI 验证？',
      '违例数据被完整记录到审计日志，包含来源、时间戳和拒绝原因？',
    ],
    story: {
      scenario: '化工厂安全监控：“操作员误将管道阀门开度设为 120%，温度设定为 -300℃（低于绝对零度）。”',
      quote: '“开度 120%，温度 -300℃”',
      dilemma: '底层数据表把温度字段定义为普通 FLOAT，任何荒唐的数字都能写入。当这样的脏数据喂给自动化控制系统时，可能引发物理爆炸。'
    },
    trapVsAha: {
      trap: {
        title: '❌ 将校验完全甩锅给前端 UI',
        desc: '认为前端有个表单限制就够了，后端模型层面不设物理防腐层。',
        danger: '通过 API、脚本或数据同步直接绕过前端，引发不可逆的物理级事故。'
      },
      aha: {
        title: '💡 本体层的一致性与物理约束校验 (Consistency Constraints)',
        desc: '本体是现实世界的映射，必须把现实物理法则（温度 >= -273.15℃、开度 0~100%）固化为本体硬约束。',
        rule: '现实有物理法则，本体有一致性硬防线。'
      }
    },
    model: {
      summary: '用本体防腐层阻断违反现实法则的脏数据。',
      keyEntities: [
        { name: '阀门开度约束', category: '物理硬规则', badge: 'CHECK (0 <= x <= 100)', badgeColor: 'green', explanation: '超过 100% 物理上不可能存在' },
        { name: '温度下限约束', category: '物理绝对法则', badge: 'CHECK (t >= -273.15)', badgeColor: 'pink', explanation: '低于绝对零度直接熔断拦截' },
        { name: '防腐告警机制', category: '系统拦截', badge: '主动熔断', badgeColor: 'yellow', explanation: '阻止脏数据污染下游' }
      ],
      goldenRule: '防腐做在本体中，违例直接抛熔断。'
    },
    lab: {
      title: '本体一致性物理约束拦截推演',
      description: '点击推演，测试非法温度数值（-300℃）与越界阀门开度（120%）是否被本体熔断拦截。',
      actionLabel: '执行物理法则约束校验',
      simulationResult: {
        headline: '本体一致性校验引擎成功熔断非法输入',
        stats: [
          { label: '拦截违例数据', value: '2 项物理越界', color: 'text-monokai-pink' },
          { label: '保护下游设备', value: '100% 隔离', color: 'text-monokai-green' },
          { label: '违规类型', value: '温度低于绝对零度', color: 'text-monokai-yellow' }
        ],
        insight: '成功将灾难性错误阻击在本体接入层，避免了工业控制系统误动！'
      },
      duckdbSql: `SELECT 
  valve_opening,
  temperature_c,
  CASE 
    WHEN valve_opening > 100 THEN 'REJECT: 阀门开度不能超过 100%'
    WHEN temperature_c < -273.15 THEN 'REJECT: 低于绝对零度'
    ELSE 'ACCEPT'
  END AS constraint_check
FROM (
  SELECT 120 AS valve_opening, -300 AS temperature_c
);`
    },
    challenge: {
      question: '在人事薪资管理本体中，若规定“实习生基本工资不能超过总经理”，这属于哪种约束？',
      options: [
        '字段类型约束（如 VARCHAR 限制）',
        '跨对象业务逻辑一致性约束 (Cross-Object Business Constraint)',
        '前端样式美化约束'
      ],
      correctIndex: 1,
      explanation: '这涉及实习生与总经理两个不同职级对象的数值横向比对，属于跨对象业务一致性约束，应由本体语义层统一防腐。',
      takeaway: '非常扎实！本体不仅是数据结构，更是业务世界规则的守护神。'
    }
  },

  11: {
    lessonNumber: 11,
    stage: 'assembly',
    stageGoal: '有了正确的 Object、Link 和时序之后，挑战是：多源数据如何汇聚成统一视图？计算指标如何保持实时准确？如何在本体上直接驱动业务行动？',
    whyThisOrder: '到这一步，本体已有完整的数据、关系和约束。但传统系统到这里就停了——只能看，不能做。Palantir 本体的终极价值在于：直接驱动业务执行。',
    coreMethod: 'Action = 绑定在 Object 上的可执行业务操作，有权限控制、前置条件和回写目标，一键触发真实系统变更和工作流流转。',
    caseConnection: '顺达物流调度台：看到仓区库存低于安全线时，不去另一个系统提申请，直接在库存 Object 上点击 [紧急调配] Action，自动触发调拨单和推送通知给仓管员。',
    modelingDecision: {
      objectVsProperty: 'Action 不是 Property（不是描述 Object 的属性），它是挂在 Object Type 上的可执行方法，有独立的权限控制、输入参数规范和回写目标定义。',
      linkCondition: 'Action 执行后产生的业务记录（如采购单、调拨单）可以建模为新 Object，与触发源 Object 建立 TRIGGERED Link。',
      actionTrigger: '建 Action 的三个判断：① 用户需要在查看数据的同时直接操作业务；② 操作会写回至少一个外部系统；③ 操作需要权限控制和完整审计记录。',
    },
    verificationChecklist: [
      '每个 Action 都定义了执行权限角色、前置条件（什么状态下才能执行）和回写目标系统？',
      'Action 执行有事务保障：成功和失败都有明确状态记录，失败时能回滚？',
      'Action 执行后，触发源 Object 的相关属性/状态自动更新，无需人工刷新？',
    ],
    story: {
      scenario: '传统报表看板：运营每天看着大屏上的“库存告警 50 件”，却必须切到另一个 ERP 页面重新搜索、申请补货，流程割裂严重。',
      quote: '“看数归看数，做事归做事。”',
      dilemma: '只读的图表和死知识无法解决现实问题。Palantir 本体之所以颠覆传统 BI，就在于它支持“双向行动 (Action)”。'
    },
    trapVsAha: {
      trap: {
        title: '❌ 将知识与行动人为割裂',
        desc: '做了一大堆漂亮的报表大屏，用户只能“看数据”，不能“点按钮驱动业务”。',
        danger: '数据洞察到业务执行存在严重时滞，错失应急黄金窗口。'
      },
      aha: {
        title: '💡 双向行动闭环 (Read-Write Action Ontology)',
        desc: '本体对象不仅有属性，还绑定了可执行的操作（Action），一键触发真实系统回写与业务流转。',
        rule: '洞察即行动，对象即服务。'
      }
    },
    model: {
      summary: '从只读报表蜕变为可直接驱动业务的行动闭环。',
      keyEntities: [
        { name: '低库存零件·A90', category: '业务对象', badge: '触发源点', badgeColor: 'pink', explanation: '当前库存低于安全警戒线' },
        { name: 'Action: 紧急补货申请', category: '双向行动', badge: '可执行动作', badgeColor: 'yellow', explanation: '校验权限后自动向供应商发订单' },
        { name: 'ERP 采购单回写', category: '系统闭环', badge: '事务回写', badgeColor: 'green', explanation: '生成采购订单，库存预期自动更新' }
      ],
      goldenRule: '看见问题的地方，就是解决问题的地方。'
    },
    lab: {
      title: '低库存对象触发一键补货行动推演',
      description: '点击推演，模拟在查看缺件对象时一键执行“快速采购”Action，观察采购单回写与状态流转。',
      actionLabel: '执行补货 Action 闭环',
      simulationResult: {
        headline: 'Action 成功执行，已回写业务系统',
        stats: [
          { label: '执行动作', value: 'PO_DISPATCH_001', color: 'text-monokai-cyan' },
          { label: '回写系统', value: 'ERP 供应链模块', color: 'text-monokai-green' },
          { label: '闭环响应耗时', value: '180 毫秒', color: 'text-monokai-yellow' }
        ],
        insight: '打破了从看板到操作台的系统壁垒，缺料对象即刻转变为采购中状态！'
      },
      duckdbSql: `SELECT 
  'PART-A90' AS part_id,
  '触发补货 200 件' AS action_name,
  'PO-20260917-88' AS generated_po_number,
  'SUCCESS' AS status;`
    },
    challenge: {
      question: 'Palantir Foundry 的核心架构理念中，Ontology 与普通数据库最根本的区别在于？',
      options: [
        'Ontology 用的也是表格存储，没有任何区别',
        'Ontology 整合了 Object（对象）、Link（关系）以及 Action（双向行动闭环），直接连接人与决策执行',
        'Ontology 只支持画关系图，不能执行增删改'
      ],
      correctIndex: 1,
      explanation: 'Action 是本体闭环的核心灵魂。它让数据从被动的静态展示，变成了可直接调起业务操作的互动平台。',
      takeaway: '卓越！恭喜你完成了第三阶段【组装与验证】，真正迈入了现代化本体工程大门！'
    }
  },

  12: {
    lessonNumber: 12,
    stage: 'evolution',
    stageGoal: '一个成熟的本体系统需要能够随业务变化平滑演进（不破坏兼容），在不确定性下科学决策，并对每一个重要结论提供可追溯的证据链。',
    whyThisOrder: '系统运行后业务必然变化（如支持国际区号、新增监管要求）。如何在不让现有系统崩溃的情况下，优雅地升级本体 Schema？',
    coreMethod: '废弃旧字段前先标记 @deprecated，新字段并行双写，设定明确迁移窗口，确保旧调用方有足够时间迁移后才真正删除。',
    caseConnection: '顺达物流开通国际件业务：原来手机号字段只存11位中国号码，现在要支持 +1-800-XXX（美国）。如何在不重写历史记录的情况下平滑完成升级？',
    modelingDecision: {
      objectVsProperty: '新旧两个 Property 并存（phone_v1 标记 @deprecated、phone_v2 为推荐），都挂在同一个 Object 上，服务新旧调用方。',
      linkCondition: 'Schema 演进通常不影响 Link 的定义，除非 Link 的语义本身发生变化（需创建新 Link 类型并废弃旧的）。',
      actionTrigger: '当监控到旧字段调用量降至零后，触发 Action（正式删除 @deprecated 字段的工单）。',
    },
    verificationChecklist: [
      '所有被废弃的字段都标记了 @deprecated，没有被直接删除导致运行时错误？',
      '旧调用方使用旧字段依然正常工作，不需要任何代码改动就能读到正确数据？',
      '有监控追踪旧字段的调用量，有明确的下线时间表和通知机制？',
    ],
    story: {
      scenario: '业务升级：随着出海业务拓展，用户表里的“手机号”原来只存 11 位数字，现在必须支持国际区号（如 +1, +44）。',
      quote: '“旧代码只认 11 位纯数字，新业务要求国际号码。”',
      dilemma: '如果直接把生产数据库字段强改，成千上万个旧微服务会直接崩溃报空。本体如何优雅演进？'
    },
    trapVsAha: {
      trap: {
        title: '❌ 粗暴强更 Schema，破坏向下兼容',
        desc: '直接对现有字段改名或重定义语义，引发不可预知的下游雪崩。',
        danger: '下游几十个报表和业务线瞬间报错瘫痪，生产事故频发。'
      },
      aha: {
        title: '💡 本体元数据版本平滑演进 (Schema Evolution)',
        desc: '通过版本化迁移（v1 -> v2）、字段废弃标记（@deprecated）与双写适配，实现无缝升级。',
        rule: '拥抱业务变化，永不破坏兼容。'
      }
    },
    model: {
      summary: '版本演进与平滑迁移工程化实践。',
      keyEntities: [
        { name: 'phone_v1 (旧字段)', category: '元数据属性', badge: '标记废弃 (@deprecated)', badgeColor: 'yellow', explanation: '继续向下兼容旧服务，禁止新增调用' },
        { name: 'e164_phone_v2 (新规范)', category: '元数据属性', badge: '当前标准推荐', badgeColor: 'green', explanation: '国际化 E.164 格式标准' },
        { name: 'Schema 演进版本控制', category: '版本快照', badge: 'SemVer: 2.1.0', badgeColor: 'cyan', explanation: '元数据全局版本化管控' }
      ],
      goldenRule: '增量演进不撕裂，废弃标记留过渡。'
    },
    lab: {
      title: '元数据双写兼容与平滑迁移推演',
      description: '点击推演，观察本体在处理旧格式与新格式时的自适应双向兼容转换。',
      actionLabel: '推演元数据版本无损迁移',
      simulationResult: {
        headline: '元数据平滑升级推演成功',
        stats: [
          { label: '旧服务兼容率', value: '100%', color: 'text-monokai-green' },
          { label: '新规范达标率', value: '100%', color: 'text-monokai-cyan' },
          { label: '破坏性变更', value: '0 项', color: 'text-monokai-yellow' }
        ],
        insight: '旧调用方依旧正常读取 11 位数字，新调用方无缝享受国际化区号支持！'
      },
      duckdbSql: `SELECT 
  raw_input,
  coalesce(regexp_extract(raw_input, '\\+?[0-9]{10,15}'), raw_input) AS v2_standard,
  right(raw_input, 11) AS v1_compatible
FROM (
  SELECT '+8613800000000' AS raw_input
  UNION ALL SELECT '13800000000'
);`
    },
    challenge: {
      question: '在本体发布新版本时，欲废弃某一个不再推荐使用的关联关系，最专业的做法是？',
      options: [
        '直接在数据库里 DROP 这条关系',
        '偷偷改个名字，让调用者自己报错发现',
        '在元模型中标记为 @deprecated，在审计中监控调用量，并在提供迁移指引后设定平稳过渡期'
      ],
      correctIndex: 2,
      explanation: '企业级本体演进讲究严密治理，标记废弃并提供迁移窗口，是保障高可用性的唯一正确手段。',
      takeaway: '极有工程素养！本体演进之道，贵在平稳有序。'
    }
  },

  13: {
    lessonNumber: 13,
    stage: 'evolution',
    stageGoal: '一个成熟的本体系统需要能够随业务变化平滑演进（不破坏兼容），在不确定性下科学决策，并对每一个重要结论提供可追溯的证据链。',
    whyThisOrder: '演进不只是技术升级，还包括面对不完整信息时的分析演进。真实世界永远信息不完全，如何在"不确定"中科学推进决策，而不是等到100%确定才行动？',
    coreMethod: '多分支并行假设 + 动态置信度更新：为每个不确定性设置互斥假设分支，随着新证据不断引入，让概率自然收敛到更可能的真相。',
    caseConnection: '顺达物流一批包裹同天损坏，可能原因：① 仓库潮湿；② 码垛压坏；③ 卸货操作不当——系统应支持三个假设同时推进，而不是武断选择其中一个。',
    modelingDecision: {
      objectVsProperty: '每个假设分支建为一个 HypothesisObject（独立 Object），包含先验概率、支持证据列表和反驳证据列表，而不是某个主对象的 Property。',
      linkCondition: '假设分支之间用 COMPETES_WITH Link（互斥关系），假设与证据之间用 SUPPORTED_BY / REFUTED_BY Link（支持或反驳关系）。',
      actionTrigger: '当某假设的后验概率超过设定阈值（如 80%），触发 Action（锁定假设，启动定向处置流程）。',
    },
    verificationChecklist: [
      '所有已知假设都建立了独立分支，没有因为主观偏好提前删除某个分支？',
      '每个分支的当前置信度有明确数值，并在引入新证据后实时更新？',
      '分支收敛有明确的决策阈值，而不是无限并行下去或凭感觉判断？',
    ],
    story: {
      scenario: '突发疫情溯源：“材料只显示 3 名感染者曾在同一天去过某购物中心，但没有公共监控，无法确定他们是否在同一家奶茶店碰面。”',
      quote: '“在同一购物中心，未记录具体店铺轨迹。”',
      dilemma: '决策者不能因为信息不全就什么都不做。本体如何支持在“不确定性”中展开多分支推演？'
    },
    trapVsAha: {
      trap: {
        title: '❌ 信息不全就拒绝推演，或盲目豪赌单一可能',
        desc: '要么完全瘫痪停工，要么把其中一种猜测当成唯一事实豪赌。',
        danger: '在重大危机应对中，单一假设破裂会导致全盘皆输。'
      },
      aha: {
        title: '💡 假设分支推演与敏感度分析 (What-If Branching)',
        desc: '建立多分支假设场景（分支 A: 奶茶店传播；分支 B: 电梯气溶胶传播），分配初始先验概率并伴随新证据动态收敛。',
        rule: '大胆设立假设分支，小心跟随证据收敛。'
      }
    },
    model: {
      summary: '不确定世界中的科学决策利器：分支推演。',
      keyEntities: [
        { name: '基线确证事实', category: '锚点事实', badge: '100% 同一商场', badgeColor: 'green', explanation: '所有分支共享的确定基础' },
        { name: '假设分支 A: 店铺同餐', category: '假设分支', badge: '先验概率 60%', badgeColor: 'yellow', explanation: '如果成立，需要排查全店密接' },
        { name: '假设分支 B: 公共环境暴露', category: '假设分支', badge: '先验概率 40%', badgeColor: 'pink', explanation: '如果成立，需要扩大环境消杀范围' }
      ],
      goldenRule: '多分支并进，证据定干戈。'
    },
    lab: {
      title: '多分支 What-If 假设敏感度推演',
      description: '点击推演，观察当引入新证据（如环境样本阳性）时，各假设分支概率如何动态洗牌。',
      actionLabel: '推演新证据引入下的概率收敛',
      simulationResult: {
        headline: '新证据触发贝叶斯概率重新洗牌',
        stats: [
          { label: '新发现证据', value: '洗手间门把手阳性', color: 'text-monokai-cyan' },
          { label: '分支 A 概率变动', value: '60% -> 25%', color: 'text-monokai-yellow' },
          { label: '分支 B 概率跃升', value: '40% -> 75%', color: 'text-monokai-green' }
        ],
        insight: '模型迅速将资源焦点从“排查奶茶店”收敛到“公共区域全面消杀”，避免了盲目扩大隔离！'
      },
      duckdbSql: `SELECT 
  '分支B: 公共环境暴露' AS leading_hypothesis,
  0.75 AS posterior_probability,
  '集中力量消杀公共环境' AS recommended_decision;`
    },
    challenge: {
      question: '在面对多套并行的假设分支时，最科学的本体演进策略是？',
      options: [
        '挑选领导最喜欢的那个分支，删掉其他分支',
        '保持分支隔离，持续注入新证据，让证据推动置信度自然收敛',
        '等待 100% 完整证据出来之前完全停止推演'
      ],
      correctIndex: 1,
      explanation: '真实世界永远信息不完全。用多分支容纳不确定性，并用源源不断的新证据筛选真实路径，是高级科学思维。',
      takeaway: '太精彩了！你已经具备了应对极高不确定性复杂决策的高级心智。'
    }
  },

  14: {
    lessonNumber: 14,
    stage: 'evolution',
    stageGoal: '一个成熟的本体系统需要能够随业务变化平滑演进（不破坏兼容），在不确定性下科学决策，并对每一个重要结论提供可追溯的证据链。',
    whyThisOrder: '最后一课是整个本体建模的终极目标：你做出的每一个重要结论，都必须能点穿到不可篡改的原始证据。这是严肃系统的生死线，也是本体超越普通数据库和黑盒AI的核心优势。',
    coreMethod: '每个推理结论必须附带完整的 Provenance 证据链：结论 ← 来自哪些推理步骤 ← 来自哪些 Object 属性 ← 来自哪些原始数据记录，全程无断点。',
    caseConnection: '顺达物流接到投诉"包裹被拆封"——系统需要展示：① 最后一次封签完整的扫描记录；② 第一次异常出现的时间节点；③ 当时经手人信息；④ 设备原始扫描数据（不可篡改）。',
    modelingDecision: {
      objectVsProperty: '每个原始证据建为 EvidenceObject（不可变 Object），包含来源系统标识、记录时间戳和原始内容哈希（防篡改验证）。',
      linkCondition: '推理结论 --[DERIVED_FROM]--> 推理节点 --[SUPPORTED_BY]--> EvidenceObject，形成完整的 Lineage 图，每个 Link 都是有向有语义的。',
      actionTrigger: '当证据链发现断点（某推理步骤缺乏支持证据），触发 Action（发出证据补全请求，标记结论为"待验证"状态）。',
    },
    verificationChecklist: [
      '系统中的每个重要结论都能追溯到至少两条独立的原始证据？',
      '所有 EvidenceObject 一旦记录就不可修改（只能新增反驳证据 Object）？',
      '从结论沿任意推理路径往前追，能无断点地抵达最原始的数据记录？',
    ],
    story: {
      scenario: '法庭取证现场：“检察官要求展示：系统为什么认定这笔交易涉嫌走私？每一步判断背后的原始凭证在哪里？”',
      quote: '“让结论的每一句话，都能点开原始证据。”',
      dilemma: '如果模型吐出一个结论，却没人说得清依据来自哪份报关单，法官会直接裁定证据无效。决策可解释性是严肃系统的生死线。'
    },
    trapVsAha: {
      trap: {
        title: '❌ 黑盒断言，证据脱节',
        desc: '只给结论不给证据链，或者证据链与结论之间存在断层。',
        danger: '无法通过法律、合规与监管审计，在医疗、军事与金融场景直接造成信任崩溃。'
      },
      aha: {
        title: '💡 结论必须全链路回溯到不可篡改证据 (Lineage & Evidence)',
        desc: '本体图谱中的每个派生结论，必须附带一条清晰的 Provenance 证据链，直达原始记录单据。',
        rule: '结论无根非真理，证据链明见青天。'
      }
    },
    model: {
      summary: '决策可解释性的终极基石：端到端证据链溯源。',
      keyEntities: [
        { name: '审查结论: 涉嫌虚报走私', category: '推导结论', badge: '最终判决标的', badgeColor: 'pink', explanation: 'AI 或业务规则推理出的审查结论' },
        { name: '证据节点 1: 报关货重异常', category: '原始证据', badge: '海关底账', badgeColor: 'green', explanation: '纸质提单重量与过磅传感器偏差 35%' },
        { name: '证据节点 2: 卫星 AIS 轨迹关机', category: '时空证据', badge: '雷达日志', badgeColor: 'cyan', explanation: '货轮在公海漂泊期间关闭定位 6 小时' }
      ],
      goldenRule: '点选任一结论，立现原始证据。'
    },
    lab: {
      title: '全链路决策证据溯源链回放',
      description: '点击推演，一键倒查“走私涉嫌结论”背后的两份不可篡改底层证据锚点。',
      actionLabel: '执行全链路证据回溯',
      simulationResult: {
        headline: '证据链溯源审查通过，形成不可辩驳闭环',
        stats: [
          { label: '审查结论证据锚点', value: '2 项独立硬证据', color: 'text-monokai-cyan' },
          { label: '证据链断点数', value: '0 (无缝衔接)', color: 'text-monokai-green' },
          { label: '审计合规可采信度', value: '100%', color: 'text-monokai-yellow' }
        ],
        insight: '法庭采纳该证据链！每一跳推理均有可追溯的传感器原始日志支撑，完美闭环！'
      },
      duckdbSql: `SELECT 
  '涉嫌虚报走私' AS conclusion,
  '提单重量偏差 35%' AS primary_evidence,
  'AIS 关机 6 小时' AS secondary_evidence,
  '100% 证据闭环' AS audit_verdict;`
    },
    challenge: {
      question: '本体工程之所以被 Palantir 用于反恐、国防和高精度企业决策，其区别于深度学习黑盒模型的最关键优势是？',
      options: [
        '本体模型运行速度比深度学习快一万倍',
        '本体具备人机可读的语义拓扑、双向行动闭环与 100% 可解释的证据溯源链',
        '本体不需要写任何代码就能自动完成所有工作'
      ],
      correctIndex: 1,
      explanation: '严肃决策必须经得起法庭与历史的检验。本体将数据、现实对象、关系与证据链紧密交织，提供了无与伦比的可解释性与行动力。',
      takeaway: '🎉 祝贺你！你已经完整修完了全部 14 门本体实战课程！你已经具备了真正的 Palantir 级本体建模心智！'
    }
  }
};
