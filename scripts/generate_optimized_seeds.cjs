const fs = require('fs');
const path = require('path');

const SEEDS = {
  'lesson-0001': {
    _meta: {
      name: '第 01 课：只写材料真正告诉你的事',
      description: '严格区分确凿事实、推断与未知边界，严禁常识脑补，只记录直接证据',
      case_background: '【案例背景材料】中午，妈妈在家做了一道茄子。我去餐馆买了两道菜，回家后，我们三个人一起吃饭。',
      core_concept: 'Fact vs Inference vs Unknown',
      version: '1.0.0',
      author: 'system',
      created_at: '2026-07-25',
      scenario: 'lesson-0001',
      complexity: 'easy'
    },
    objectTypes: [
      { id: 1, name: '确凿事实', description: '原文直接证明的主体、事件与客观结果' },
      { id: 2, name: '推断与未知', description: '有线索未确证的推测及不可脑补的未知盲区' }
    ],
    objects: [
      { id: 1, object_type_id: 1, name: '做菜人·妈妈', properties: JSON.stringify({ 身份: '做菜人', 地点: '家中', 依据: '原文明确提及' }), annotations: '确定事实主体' },
      { id: 2, object_type_id: 1, name: '买菜人·我', properties: JSON.stringify({ 身份: '买菜人', 轨迹: '餐馆至家中', 依据: '原文明确提及' }), annotations: '确定事实主体' },
      { id: 3, object_type_id: 1, name: '自做茄子', properties: JSON.stringify({ 品类: '茄子', 地点: '家中', 确证度: '100%已证事实' }), annotations: '确凿烹饪事件' },
      { id: 4, object_type_id: 1, name: '餐馆买菜', properties: JSON.stringify({ 数量: '两道菜', 地点: '餐馆', 确证度: '100%已证事实' }), annotations: '确凿采购事件' },
      { id: 5, object_type_id: 1, name: '三人用餐', properties: JSON.stringify({ 就餐人数: 3, 地点: '家中', 菜品总数: '至少包含茄子' }), annotations: '确凿汇聚事件' },
      { id: 6, object_type_id: 2, name: '推断·菜已带回', properties: JSON.stringify({ 推断依据: '买菜后回家与三人就餐', 置信度: 0.85 }), annotations: '线索支撑推断' },
      { id: 7, object_type_id: 2, name: '未知·第三人', properties: JSON.stringify({ 信息状态: '完全未知', 警示: '绝不可凭常识脑补为爸爸' }), annotations: '严格未知边界' }
    ],
    linkTypes: [
      { id: 1, name: '亲自制作', description: '主体在家执行烹饪制作' },
      { id: 2, name: '外出采购', description: '主体在餐馆执行外部购买' },
      { id: 3, name: '线索支撑', description: '采购事实为推断提供证据链' },
      { id: 4, name: '汇入餐食', description: '自制菜肴汇入就餐事件' },
      { id: 5, name: '推断汇入', description: '高置信推断汇入共同就餐' },
      { id: 6, name: '暴露盲区', description: '就餐事件暴露出不可脑补的第三人' }
    ],
    links: [
      { id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 3, weight: 1.0 },
      { id: 2, link_type_id: 2, source_object_id: 2, target_object_id: 4, weight: 1.0 },
      { id: 3, link_type_id: 3, source_object_id: 4, target_object_id: 6, weight: 0.85 },
      { id: 4, link_type_id: 4, source_object_id: 3, target_object_id: 5, weight: 1.0 },
      { id: 5, link_type_id: 5, source_object_id: 6, target_object_id: 5, weight: 0.85 },
      { id: 6, link_type_id: 6, source_object_id: 5, target_object_id: 7, weight: 0.9 }
    ],
    actions: [
      { id: 1, object_id: 6, name: '校验推断置信度', description: '复核买菜至就餐时间线，评估推断有效性', status: 'executed', execute_at: '2026-07-25' },
      { id: 2, object_id: 7, name: '标记信息盲区', description: '显式记录第三人身份为待确证字段，阻断脑补数据', status: 'in_progress', execute_at: '2026-07-26' }
    ],
    introspections: [
      { id: 1, object_id: 7, question: '三个人一起吃饭，为什么不能直接把第三个人建模为“爸爸”？', answer: '这是初学者最易犯的常识脑补错误。原文完全没提及第三人的身份，可能是爸爸、孩子、朋友或客人。未直接说明的内容必须归为“未知”，绝不可凭经验代入假设。', created_at: '2026-07-25' }
    ],
    insights: [
      { id: 1, object_id: 1, insight: '区分事实、推断与未知是避免产生“有毒假定”的最高防线。一旦在底层把推断写成事实，上层推演就会步步失真。', tag: '事实边界', created_at: '2026-07-25' }
    ]
  },

  'lesson-0002': {
    _meta: {
      name: '第 02 课：找出需要保持身份的对象',
      description: '识别具备独立连续唯一 Identity 的实体，区分对象身份与易变数值属性',
      case_background: '【案例背景材料】上午，小林进入仓库1。管理员周姐把包裹B交给小林。随后，小林离开仓库。',
      core_concept: 'Entity Identity & Instance Tracking',
      version: '1.0.0',
      author: 'system',
      created_at: '2026-07-25',
      scenario: 'lesson-0002',
      complexity: 'easy'
    },
    objectTypes: [
      { id: 1, name: '身份实体', description: '具备全局唯一业务主键的物理与业务对象' },
      { id: 2, name: '交接过程', description: '连接多个实体的动态流转动作与存证凭单' }
    ],
    objects: [
      { id: 1, object_type_id: 1, name: '仓管·周姐', properties: JSON.stringify({ 工号: 'ADM-2001', 权限: '库区主管', 身份主键: 'ID_ZHOU_01' }), annotations: '交付管理员' },
      { id: 2, object_type_id: 1, name: '配送·小林', properties: JSON.stringify({ 工号: 'EMP-1008', 岗位: '末端配送', 身份主键: 'ID_LIN_01' }), annotations: '领件经办人' },
      { id: 3, object_type_id: 1, name: '1号仓库', properties: JSON.stringify({ 仓区编码: 'WH-001-A', 位置: '华北物流园', 身份主键: 'LOC_WH01' }), annotations: '空间设施' },
      { id: 4, object_type_id: 2, name: '包裹交接', properties: JSON.stringify({ 事件流水: 'PROC-TR-9901', 时间: '09:15', 状态: '已完成' }), annotations: '核心交接事件' },
      { id: 5, object_type_id: 1, name: '包裹B', properties: JSON.stringify({ 运单号: 'PKG-2026-B', 重量KG: 2.4, 身份主键: 'PKG_2026_B' }), annotations: '流转物资标的' },
      { id: 6, object_type_id: 2, name: '签收凭单', properties: JSON.stringify({ 单据号: 'DOC-SIGN-880', 防伪码: 'SHA256-EF99', 状态: '双人已签' }), annotations: '存证凭据' }
    ],
    linkTypes: [
      { id: 1, name: '经办交付', description: '管理员在过程中交出物资' },
      { id: 2, name: '作为领件人', description: '经办业务员参与过程接收包裹' },
      { id: 3, name: '提供场地', description: '仓储设施为交接过程提供物理空间' },
      { id: 4, name: '流转标的', description: '过程转移核心物资对象' },
      { id: 5, name: '固化存证', description: '交接过程生成不可篡改签收凭证' }
    ],
    links: [
      { id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 4, weight: 1.0 },
      { id: 2, link_type_id: 2, source_object_id: 2, target_object_id: 4, weight: 1.0 },
      { id: 3, link_type_id: 3, source_object_id: 3, target_object_id: 4, weight: 0.95 },
      { id: 4, link_type_id: 4, source_object_id: 4, target_object_id: 5, weight: 1.0 },
      { id: 5, link_type_id: 5, source_object_id: 4, target_object_id: 6, weight: 0.9 }
    ],
    actions: [
      { id: 1, object_id: 5, name: '核验包裹唯一条码', description: '扫描包裹条码与系统库底台账比对，确保实体Identity一致', status: 'executed', execute_at: '2026-07-25' },
      { id: 2, object_id: 6, name: '生成可溯源电子收据', description: '交接后联动生成区块链数字签名并同步发件人', status: 'executed', execute_at: '2026-07-25' }
    ],
    introspections: [
      { id: 1, object_id: 5, question: '“包裹B的重量”和“包裹B”本身在建模上有何本质区别？', answer: '包裹B具备跨生命周期的全局唯一业务主键（PKG-2026-B），是需要持续跟踪的实体对象 (Object)；而“重量2.4kg”是当前时间下的数值特征，应当作为 Object 的属性 (Property) 而不是独立节点。', created_at: '2026-07-25' }
    ],
    insights: [
      { id: 1, object_id: 1, insight: '拥有独立业务标识、跨时间地点持续存在且有生命周期的构件，才是合格的本体对象。不可将单纯属性升格为独立对象。', tag: '实体身份', created_at: '2026-07-25' }
    ]
  },

  'lesson-0003': {
    _meta: {
      name: '第 03 课：找出发生了什么过程',
      description: '识别包含时间起止与状态机跃迁的动态过程事件，作为连接多实体的拓扑中枢',
      case_background: '【案例背景材料】采购员李四在周一发起服务器设备采购流程，经历供应商比价与物资入库验收。',
      core_concept: 'Process Object & State Machine',
      version: '1.0.0',
      author: 'system',
      created_at: '2026-07-25',
      scenario: 'lesson-0003',
      complexity: 'easy'
    },
    objectTypes: [
      { id: 1, name: '业务实体', description: '参与采购的人员、供应商主体及物理资产' },
      { id: 2, name: '推进过程', description: '具备时间起止、承载状态机变迁的动态主流程与子阶段' }
    ],
    objects: [
      { id: 1, object_type_id: 1, name: '采购员·李四', properties: JSON.stringify({ 责任工号: 'BUYER-042', 部门: 'IT基础设施组' }), annotations: '流程发起人' },
      { id: 2, object_type_id: 2, name: '服务器采购', properties: JSON.stringify({ 采购单号: 'PROC-2026-08', 预算: '￥120万', 状态: '推进中' }), annotations: '核心主流程' },
      { id: 3, object_type_id: 2, name: '比价决策', properties: JSON.stringify({ 比价批次: 'BID-Q3-01', 候选方数: 3, 决策: '优选联众' }), annotations: '前置决策子阶段' },
      { id: 4, object_type_id: 1, name: '联众科技', properties: JSON.stringify({ 供应商编码: 'SUP-8820', 评级: '金牌供应商' }), annotations: '中选供应商' },
      { id: 5, object_type_id: 2, name: '到货验收', properties: JSON.stringify({ 验收批次: 'CHK-9902', 质检标准: 'ISO-9001', 结果: '合格' }), annotations: '后续履约子阶段' },
      { id: 6, object_type_id: 1, name: '算力服务器', properties: JSON.stringify({ 资产标签: 'SRV-H100-08', 规格: '8卡GPU机架', 状态: '已入库' }), annotations: '验收交付实物资产' }
    ],
    linkTypes: [
      { id: 1, name: '发起推进', description: '经办人发起核心采购流程' },
      { id: 2, name: '启动阶段', description: '主流程进入比价决策子阶段' },
      { id: 3, name: '选定伙伴', description: '比价决策确认中选供应商' },
      { id: 4, name: '推进阶段', description: '采购流程推进到货验收子阶段' },
      { id: 5, name: '交付资产', description: '验收完成正式交付入库实物资产' }
    ],
    links: [
      { id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 2, weight: 1.0 },
      { id: 2, link_type_id: 2, source_object_id: 2, target_object_id: 3, weight: 1.0 },
      { id: 3, link_type_id: 3, source_object_id: 3, target_object_id: 4, weight: 0.95 },
      { id: 4, link_type_id: 4, source_object_id: 2, target_object_id: 5, weight: 1.0 },
      { id: 5, link_type_id: 5, source_object_id: 5, target_object_id: 6, weight: 0.95 }
    ],
    actions: [
      { id: 1, object_id: 3, name: '归档比价决策矩阵', description: '将供应商报价对比清单与内审决议上链留痕', status: 'executed', execute_at: '2026-07-25' },
      { id: 2, object_id: 6, name: '机房上架通电点检', description: '服务器装载机架通电测试，生成固定资产唯一标签', status: 'in_progress', execute_at: '2026-07-26' }
    ],
    introspections: [
      { id: 1, object_id: 2, question: '为什么“采购流程”本身是一个对象，而不能只作为李四的一个属性？', answer: '过程拥有自己的生命周期、多方参与者、状态跃迁和审计留痕，它连接多方实体。将其作为核心过程对象才能表达复杂的业务现实。', created_at: '2026-07-25' }
    ],
    insights: [
      { id: 1, object_id: 2, insight: '对象是静态的，过程是动态的。过程记录了在特定时空发生了什么，是打通孤立实体的拓扑中枢。', tag: '过程枢纽', created_at: '2026-07-25' }
    ]
  },

  'lesson-0004': {
    _meta: {
      name: '第 04 课：把对象连接到过程',
      description: '一次聚焦一个核心过程，把材料中明确涉及的对象汇聚连接，形成初具形态的关联拓扑',
      case_background: '【案例背景材料】合规专家王五接入采购框架协议审批流，审查并签署了《年度采购框架协议.pdf》。',
      core_concept: 'Topology & Role Semantic',
      version: '1.0.0',
      author: 'system',
      created_at: '2026-07-25',
      scenario: 'lesson-0004',
      complexity: 'easy'
    },
    objectTypes: [
      { id: 1, name: '合规主体与标的', description: '审核人员、协议文档标的及审计终态档案' },
      { id: 2, name: '审查流程与凭据', description: '审批工作流中枢与具有法律效力的生效存证凭据' }
    ],
    objects: [
      { id: 1, object_type_id: 1, name: '合规专家·王五', properties: JSON.stringify({ 工号: 'COMP-501', 职责: '合规终审' }), annotations: '终审责任人' },
      { id: 2, object_type_id: 1, name: '法务初审·小刘', properties: JSON.stringify({ 工号: 'LEGAL-204', 职责: '前置审查' }), annotations: '初审责任人' },
      { id: 3, object_type_id: 1, name: '年度框架协议', properties: JSON.stringify({ 文档编号: 'AGR-2026-HQ', 格式: 'PDF', 页数: 48 }), annotations: '审查标的文档' },
      { id: 4, object_type_id: 2, name: '框架协议审批', properties: JSON.stringify({ 审批流水: 'FLOW-AGR-88', 时效: '48小时', 状态: '已核准' }), annotations: '核心流程中枢' },
      { id: 5, object_type_id: 2, name: '生效存证单', properties: JSON.stringify({ 存证哈希: 'HASH-E99A-2026', 公章: 'CA已加盖' }), annotations: '签署法律凭据' },
      { id: 6, object_type_id: 1, name: '合规审计库', properties: JSON.stringify({ 档案区: 'ARCH-LEGAL-A', 密级: '机密', 保存期限: '10年' }), annotations: '归档目的地' }
    ],
    linkTypes: [
      { id: 1, name: '终审签署', description: '合规终审人在流程中签署' },
      { id: 2, name: '前置合规', description: '法务前置完成合规核查' },
      { id: 3, name: '送审标的', description: '核心协议文档作为标的接入审批' },
      { id: 4, name: '产出凭据', description: '流程完结生成法律效力生效单据' },
      { id: 5, name: '归档存证', description: '生效单据归档至审计档案库' }
    ],
    links: [
      { id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 4, weight: 1.0 },
      { id: 2, link_type_id: 2, source_object_id: 2, target_object_id: 4, weight: 1.0 },
      { id: 3, link_type_id: 3, source_object_id: 3, target_object_id: 4, weight: 1.0 },
      { id: 4, link_type_id: 4, source_object_id: 4, target_object_id: 5, weight: 1.0 },
      { id: 5, link_type_id: 5, source_object_id: 5, target_object_id: 6, weight: 0.95 }
    ],
    actions: [
      { id: 1, object_id: 4, name: '自动比对合规条款', description: '调用合规规则库自动核验免责及违约条款完整性', status: 'executed', execute_at: '2026-07-25' },
      { id: 2, object_id: 5, name: '加盖国密电子时间戳', description: '对接国家授时中心对签署单据加盖防伪时间戳', status: 'executed', execute_at: '2026-07-25' }
    ],
    introspections: [
      { id: 1, object_id: 4, question: '为什么不直接把王五连到年度协议上，而要通过审批流连接？', answer: '王五与协议发生关系是因“审批签署”这一具体事件而起。直接连线丢失了时间、审批状态与存证凭据，无法还原业务事实全貌。', created_at: '2026-07-25' }
    ],
    insights: [
      { id: 1, object_id: 4, insight: '以过程为中枢辐射连接主体与标的，是本体图谱建立高信度动态拓扑的核心模式。', tag: '过程拓扑', created_at: '2026-07-25' }
    ]
  },

  'lesson-0005': {
    _meta: {
      name: '第 05 课：为过程中的角色命名',
      description: '在连接线上明确标出对象在过程中扮演的业务角色，赋予连线精确的业务语义',
      case_background: '【案例背景材料】买方小张与卖方老李在二手车交易平台上达成协议，通过资金托管中间方进行车辆权属转让。',
      core_concept: 'Link Role Qualification',
      version: '1.0.0',
      author: 'system',
      created_at: '2026-07-25',
      scenario: 'lesson-0005',
      complexity: 'easy'
    },
    objectTypes: [
      { id: 1, name: '交易参与方', description: '具备不同法律地位与职责的市场主体' },
      { id: 2, name: '流转过程与资产', description: '核心交易事件、流通车辆与监管账户' }
    ],
    objects: [
      { id: 1, object_type_id: 1, name: '买方·小张', properties: JSON.stringify({ 用户ID: 'USR-BUY-09', 实名认证: true, 授信额度: '￥20万' }), annotations: '出资买方' },
      { id: 2, object_type_id: 1, name: '卖方·老李', properties: JSON.stringify({ 用户ID: 'USR-SEL-21', 车主身份: '原车主', 信用分: 780 }), annotations: '转让卖方' },
      { id: 3, object_type_id: 1, name: '资金托管方', properties: JSON.stringify({ 机构代码: 'ESCROW-BANK-01', 资质: '备付金银行托管' }), annotations: '中立居间担保' },
      { id: 4, object_type_id: 2, name: '车辆转让交易', properties: JSON.stringify({ 合同号: 'CAR-TR-2026-88', 成交价: '￥15.8万', 状态: '过户中' }), annotations: '核心交易中枢' },
      { id: 5, object_type_id: 2, name: '车辆·Model3', properties: JSON.stringify({ 车架号VIN: 'TESLA-2023-M3-908', 里程: '2.8万公里' }), annotations: '交易标的物' },
      { id: 6, object_type_id: 2, name: '资金托管账户', properties: JSON.stringify({ 账户编码: 'ACC-LOCK-9921', 锁定金额: '￥15.8万', 状态: '已冻结' }), annotations: '保障资金实体' }
    ],
    linkTypes: [
      { id: 1, name: '角色·买方出资', description: '小张在交易中担任出资买方角色' },
      { id: 2, name: '角色·卖方转让', description: '老李在交易中担任权属转让方角色' },
      { id: 3, name: '角色·居间监管', description: '平台机构在交易中担任资金托管担保角色' },
      { id: 4, name: '转移权属标的', description: '交易直接指向并转移的实物车辆' },
      { id: 5, name: '锁定保障资金', description: '交易过程冻结与划拨对应的履约保障账户' }
    ],
    links: [
      { id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 4, weight: 1.0 },
      { id: 2, link_type_id: 2, source_object_id: 2, target_object_id: 4, weight: 1.0 },
      { id: 3, link_type_id: 3, source_object_id: 3, target_object_id: 4, weight: 1.0 },
      { id: 4, link_type_id: 4, source_object_id: 4, target_object_id: 5, weight: 1.0 },
      { id: 5, link_type_id: 5, source_object_id: 4, target_object_id: 6, weight: 0.95 }
    ],
    actions: [
      { id: 1, object_id: 6, name: '冻结托管保障资金', description: '买方付款后触发银行备付金监管账户实时资金锁定', status: 'executed', execute_at: '2026-07-25' },
      { id: 2, object_id: 5, name: '核验车管所过户凭据', description: '直连交警车管所接口查询电子档案与机动车登记证书', status: 'in_progress', execute_at: '2026-07-26' }
    ],
    introspections: [
      { id: 1, object_id: 4, question: '如果小张和老李只是简单连线到交易，而不命名角色会怎样？', answer: '若不标明角色，图谱无法区分谁出资、谁交车、谁担保。角色限定是让图谱具备精确业务契约与法律语义的关键。', created_at: '2026-07-25' }
    ],
    insights: [
      { id: 1, object_id: 1, insight: '同一个实体在不同过程中扮演不同角色。在关系线上显式命名角色，能让通用对象具备情境化的业务语义。', tag: '角色语义', created_at: '2026-07-25' }
    ]
  },

  'lesson-0006': {
    _meta: {
      name: '第 06 课：记录状态的改变',
      description: '跟踪过程触发的对象状态变迁，显式刻画初始状态向目标状态的跃迁流转',
      case_background: '【案例背景材料】顾客针对订单 ORD-2026 完成了微信扫码支付，触发支付成功事件，订单状态跃迁为已支付待履约。',
      core_concept: 'State Transition & Event Writeback',
      version: '1.0.0',
      author: 'system',
      created_at: '2026-07-25',
      scenario: 'lesson-0006',
      complexity: 'easy'
    },
    objectTypes: [
      { id: 1, name: '业务主实体', description: '顾客主体、主订单与清算结算单据' },
      { id: 2, name: '事件与状态', description: '触发事件与生命周期状态节点' }
    ],
    objects: [
      { id: 1, object_type_id: 1, name: '顾客·王女士', properties: JSON.stringify({ 客户编号: 'CUST-9012', 支付渠道: '微信绑卡支付' }), annotations: '付款人主体' },
      { id: 2, object_type_id: 1, name: '订单·2026', properties: JSON.stringify({ 订单号: 'ORD-2026', 总额: '￥399.00', 创建时间: '10:05' }), annotations: '核心业务对象' },
      { id: 3, object_type_id: 2, name: '待支付状态', properties: JSON.stringify({ 状态码: 'INIT_UNPAID', 倒计时: '15分钟', 阶段: '初始态' }), annotations: '前置生命周期' },
      { id: 4, object_type_id: 2, name: '扫码支付', properties: JSON.stringify({ 支付流水: 'WX-PAY-889920', 耗时: '1.2s', 判定: '成功' }), annotations: '触发事件' },
      { id: 5, object_type_id: 2, name: '已支付状态', properties: JSON.stringify({ 状态码: 'PAID_CONFIRMED', 履约队列: '待分拣', 阶段: '达成终态' }), annotations: '跃迁终态' },
      { id: 6, object_type_id: 1, name: '银行对账单', properties: JSON.stringify({ 对账流水: 'REC-BANK-022', 手续费: '￥1.20', 清算: 'T+1已入账' }), annotations: '财务清算凭证' }
    ],
    linkTypes: [
      { id: 1, name: '持有创建', description: '顾客创建并持有主订单' },
      { id: 2, name: '初始处于', description: '订单初始挂载待支付状态' },
      { id: 3, name: '执行付款', description: '顾客发起扫码支付动作' },
      { id: 4, name: '事件驱动跃迁', description: '待支付状态在付款成功后触发跃迁' },
      { id: 5, name: '达成目标状态', description: '支付成功促使生成已支付终态' },
      { id: 6, name: '沉淀清算凭证', description: '支付事件沉淀银行对账单据' }
    ],
    links: [
      { id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 2, weight: 1.0 },
      { id: 2, link_type_id: 2, source_object_id: 2, target_object_id: 3, weight: 1.0 },
      { id: 3, link_type_id: 3, source_object_id: 1, target_object_id: 4, weight: 1.0 },
      { id: 4, link_type_id: 4, source_object_id: 3, target_object_id: 4, weight: 1.0 },
      { id: 5, link_type_id: 5, source_object_id: 4, target_object_id: 5, weight: 1.0 },
      { id: 6, link_type_id: 6, source_object_id: 4, target_object_id: 6, weight: 0.9 }
    ],
    actions: [
      { id: 1, object_id: 4, name: '校验支付网关签名', description: '微信网关回调验签并执行本地事务回写', status: 'executed', execute_at: '2026-07-25' },
      { id: 2, object_id: 5, name: '触发仓储WMS自动分拣', description: '订单变为已支付后唤醒仓储管理系统自动拣货', status: 'executed', execute_at: '2026-07-25' }
    ],
    introspections: [
      { id: 1, object_id: 4, question: '为什么不直接把订单的状态字段改成“已支付”，而是显式建模状态节点？', answer: '直接覆写属性会丢失状态跃迁的历史轨迹与因果证据。将状态与驱动事件独立建模，能完整还原“因何事从何态跃迁至何态”。', created_at: '2026-07-25' }
    ],
    insights: [
      { id: 1, object_id: 2, insight: '业务状态不是静止的标签，它是由特定事件触发并附着在对象身上的生命周期切片。', tag: '状态变迁', created_at: '2026-07-25' }
    ]
  },

  'lesson-0007': {
    _meta: {
      name: '第 07 课：写出对象之间的直接关系',
      description: '表达不依赖特定过程的静态结构关系，严格注意有向性与层级继承',
      case_background: '【案例背景材料】前端工程师小赵隶属于 UI/UX 架构研发部，负责推进 Ontology 内核重构项目，形成清晰拓扑结构。',
      core_concept: 'Bi-directional Link Traversal',
      version: '1.0.0',
      author: 'system',
      created_at: '2026-07-25',
      scenario: 'lesson-0007',
      complexity: 'easy'
    },
    objectTypes: [
      { id: 1, name: '组织与团队', description: '组织机构与研发工程人员' },
      { id: 2, name: '研发与标准', description: '重点工程项目、技术依赖库与工程规范' }
    ],
    objects: [
      { id: 1, object_type_id: 1, name: '架构总监·孙老师', properties: JSON.stringify({ 职级: 'T10', 管辖跨度: '平台研发线' }), annotations: '管理负责人' },
      { id: 2, object_type_id: 1, name: '前端·小赵', properties: JSON.stringify({ 工号: 'FE-309', 方向: '图谱可视化与交互' }), annotations: '核心研发骨干' },
      { id: 3, object_type_id: 1, name: '架构研发部', properties: JSON.stringify({ 部门代码: 'DEPT-ARCH-01', 编制: 45 }), annotations: '归属部门' },
      { id: 4, object_type_id: 2, name: '内核重构项目', properties: JSON.stringify({ 代号: 'PROJ-ONTO-V2', 优先级: 'P0', 里程碑: 'M3' }), annotations: '核心研发工程' },
      { id: 5, object_type_id: 2, name: '图引擎核心库', properties: JSON.stringify({ 包名: '@duckdb/graph-core', 版本: 'v2.4.0' }), annotations: '底层技术依赖' },
      { id: 6, object_type_id: 2, name: '工程发布规范', properties: JSON.stringify({ 规范编号: 'STD-ENG-2026', 单测覆盖率: '≥90%' }), annotations: '遵循质量准则' }
    ],
    linkTypes: [
      { id: 1, name: '行政管辖', description: '总监对部门实施行政管辖与领导' },
      { id: 2, name: '组织隶属', description: '工程师隶属于架构研发部' },
      { id: 3, name: '主导推进', description: '工程师负责推进具体研发项目' },
      { id: 4, name: '核心依赖', description: '项目依赖底层核心图渲染库' },
      { id: 5, name: '严格遵从', description: '工程开发严格遵从发布质量规范' }
    ],
    links: [
      { id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 3, weight: 1.0 },
      { id: 2, link_type_id: 2, source_object_id: 2, target_object_id: 3, weight: 1.0 },
      { id: 3, link_type_id: 3, source_object_id: 2, target_object_id: 4, weight: 1.0 },
      { id: 4, link_type_id: 4, source_object_id: 4, target_object_id: 5, weight: 0.95 },
      { id: 5, link_type_id: 5, source_object_id: 4, target_object_id: 6, weight: 0.9 }
    ],
    actions: [
      { id: 1, object_id: 4, name: '执行基准渲染压测', description: '自动化运行千节点拓扑渲染 Benchmark 评估帧率', status: 'executed', execute_at: '2026-07-25' },
      { id: 2, object_id: 6, name: '组织架构级代码合规走查', description: '评审团队依据工程标准对重构核心模块执行准入检查', status: 'in_progress', execute_at: '2026-07-26' }
    ],
    introspections: [
      { id: 1, object_id: 2, question: '对象之间的直接关系与“通过过程连接”有什么区别？', answer: '直接关系表达相对稳定的静态组织与技术架构（如小赵隶属于研发部）；而过程关系表达瞬态有起止的业务流转。两者互为经纬。', created_at: '2026-07-25' }
    ],
    insights: [
      { id: 1, object_id: 3, insight: '静态结构关系具有明确的方向性（上级管辖下级、项目依赖组件），构建清晰的直接关系网是支撑图谱多跳双向寻路的基础。', tag: '直接拓扑', created_at: '2026-07-25' }
    ]
  },

  'lesson-0008': {
    _meta: {
      name: '第 08 课：组装一个最小本体模型',
      description: '合并已验证的对象、过程、角色、状态和关系，消除冗余，构建最小可行自洽模型',
      case_background: '【案例背景材料】VIP 客户 Alice 在商城下单购买人体工学椅 ErgoX，系统派发顺丰特快运单 SF-9920 进行物流履约，形成闭环。',
      core_concept: 'Minimal Viable Enterprise Ontology (MVO)',
      version: '1.0.0',
      author: 'system',
      created_at: '2026-07-25',
      scenario: 'lesson-0008',
      complexity: 'medium'
    },
    objectTypes: [
      { id: 1, name: '商业要素', description: '客户主体、商品资产与物流履约单据' },
      { id: 2, name: '流转阶段', description: '交易达成、仓储就绪与签收交付终态' }
    ],
    objects: [
      { id: 1, object_type_id: 1, name: '客户·Alice', properties: JSON.stringify({ 会员级别: 'VIP金卡', 信用分: 850, 常住城市: '北京' }), annotations: '消费者主体' },
      { id: 2, object_type_id: 1, name: '工学椅·ErgoX', properties: JSON.stringify({ SKU: 'CHAIR-ERG-01', 售价: '￥2,499', 产地: '顺义仓' }), annotations: '核心售卖商品' },
      { id: 3, object_type_id: 2, name: '商城下单', properties: JSON.stringify({ 交易流水: 'ORD-ECOM-8821', 付款: '在线全额', 时间: '14:20' }), annotations: '核心交易过程' },
      { id: 4, object_type_id: 2, name: '待出库状态', properties: JSON.stringify({ 仓储指令: 'WMS-PICK-OK', 波次: 'B-2026', 时限: '当日发' }), annotations: '就绪流转状态' },
      { id: 5, object_type_id: 1, name: '顺丰运单', properties: JSON.stringify({ 运单号: 'SF-9920-8801', 服务类型: '顺丰特快', 送达: '次日上午' }), annotations: '履约物流实体' },
      { id: 6, object_type_id: 2, name: '客户已签收', properties: JSON.stringify({ 签收时间: '次日 10:15', 签收人: '本人面签', 状态: '交易闭环' }), annotations: '交付完成终态' }
    ],
    linkTypes: [
      { id: 1, name: '提交订单', description: '客户提交商城采购订单' },
      { id: 2, name: '包含商品', description: '下单过程包含具体选购商品' },
      { id: 3, name: '生成状态', description: '交易达成生成仓储待出库状态' },
      { id: 4, name: '派生物流', description: '出库指令派生物流特快运单' },
      { id: 5, name: '终端闭环', description: '物流终端派送达成客户签收终态' }
    ],
    links: [
      { id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 3, weight: 1.0 },
      { id: 2, link_type_id: 2, source_object_id: 2, target_object_id: 3, weight: 1.0 },
      { id: 3, link_type_id: 3, source_object_id: 3, target_object_id: 4, weight: 1.0 },
      { id: 4, link_type_id: 4, source_object_id: 4, target_object_id: 5, weight: 1.0 },
      { id: 5, link_type_id: 5, source_object_id: 5, target_object_id: 6, weight: 1.0 }
    ],
    actions: [
      { id: 1, object_id: 5, name: '智能调度顺丰最优干线', description: '依据收发件地址与时效要求动态匹配航空货运舱位', status: 'executed', execute_at: '2026-07-25' },
      { id: 2, object_id: 6, name: '发放电子保修卡与返积分', description: '客户面签确认后自动激活五年质保并返赠VIP积分', status: 'executed', execute_at: '2026-07-26' }
    ],
    introspections: [
      { id: 1, object_id: 3, question: '怎样才算是一个“最小本体模型 (MVO)”？', answer: '不发明冗余概念，恰好将业务闭环所需的对象、过程、角色、状态和关系整合为一个自洽的最小拓扑，既能回答核心业务问题，又无多余噪音。', created_at: '2026-07-25' }
    ],
    insights: [
      { id: 1, object_id: 3, insight: 'MVO 的精髓在于“克制”。好的本体模型不是把所有字段画在图上，而是用最精炼的拓扑骨架穿透端到端业务闭环。', tag: '最小模型', created_at: '2026-07-25' }
    ]
  },

  'lesson-0009': {
    _meta: {
      name: '第 09 课：用问题检验模型',
      description: '提出业务反向问题，检验模型链路自洽性与全流程因果血缘追溯能力',
      case_background: '【案例背景材料】凌晨 02:15，SRE 运维工程师张博执行生产 DB 内存上限调整事件，将 DuckDB 的 max_memory 从 16GB 调整为 32GB。',
      core_concept: 'Introspection Probe & Lineage Completeness',
      version: '1.0.0',
      author: 'system',
      created_at: '2026-07-25',
      scenario: 'lesson-0009',
      complexity: 'medium'
    },
    objectTypes: [
      { id: 1, name: '运维对象与记录', description: 'SRE人员、受控数据库实例与不可篡改审计日志' },
      { id: 2, name: '变更驱动与参数', description: '告警工单、参数变更操作与生效参数状态' }
    ],
    objects: [
      { id: 1, object_type_id: 1, name: 'SRE·张博', properties: JSON.stringify({ 工号: 'SRE-007', 权限: 'Root-Ops', 轮次: '夜班A组' }), annotations: '运维责任人' },
      { id: 2, object_type_id: 2, name: '高负载告警', properties: JSON.stringify({ 告警单号: 'WARN-9901', 指标: 'Memory > 92%', 级别: 'P1' }), annotations: '变更触发工单' },
      { id: 3, object_type_id: 2, name: '内存上限调整', properties: JSON.stringify({ 变更编号: 'CHG-2026-0215', 时间: '02:15', 指令: 'max_memory=32GB' }), annotations: '实施变更事件' },
      { id: 4, object_type_id: 1, name: 'DuckDB实例', properties: JSON.stringify({ 实例标识: 'DUCKDB-PROD-CORE', 节点: '计算集群' }), annotations: '受控数据库内核' },
      { id: 5, object_type_id: 2, name: '内存32GB状态', properties: JSON.stringify({ 参数: 'max_memory=32GB', 利用率: '48%', 健康度: '良好' }), annotations: '生效目标参数' },
      { id: 6, object_type_id: 1, name: '审计留痕日志', properties: JSON.stringify({ 日志ID: 'LOG-0215-998', 存储: '不可变S3桶', 验签: '通过' }), annotations: '不可篡改证据' }
    ],
    linkTypes: [
      { id: 1, name: '认领工单', description: 'SRE工程师认领并响应告警工单' },
      { id: 2, name: '依据实施', description: '依据告警工单授权实施线上配置变更' },
      { id: 3, name: '变更配置', description: '调整操作直接作用于目标数据库内核' },
      { id: 4, name: '生效参数', description: '内核实例成功生效目标配置参数状态' },
      { id: 5, name: '生成留痕', description: '操作事件自动沉淀不可篡改审计日志' }
    ],
    links: [
      { id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 2, weight: 1.0 },
      { id: 2, link_type_id: 2, source_object_id: 2, target_object_id: 3, weight: 1.0 },
      { id: 3, link_type_id: 3, source_object_id: 3, target_object_id: 4, weight: 1.0 },
      { id: 4, link_type_id: 4, source_object_id: 4, target_object_id: 5, weight: 1.0 },
      { id: 5, link_type_id: 5, source_object_id: 3, target_object_id: 6, weight: 0.95 }
    ],
    actions: [
      { id: 1, object_id: 3, name: '执行内存热重载PRAGMA', description: '执行 PRAGMA max_memory 并在零中断下平滑扩容', status: 'executed', execute_at: '2026-07-25' },
      { id: 2, object_id: 6, name: '推送SRE值班群审计通报', description: '将操作留痕与前后资源对比广播至值班大群', status: 'executed', execute_at: '2026-07-25' }
    ],
    introspections: [
      { id: 1, object_id: 3, question: '业务方问：“为什么凌晨系统内存突然增大？是谁操作的？依据是什么？”，图谱如何回答？', answer: '沿着拓扑路径反向追溯：内存32GB状态 ← DuckDB实例 ← 内存上限调整(操作人:张博, 时间:02:15) ← 依据高负载告警(WARN-9901)。因果链条完整闭环，这就是问题检验的威力。', created_at: '2026-07-25' }
    ],
    insights: [
      { id: 1, object_id: 4, insight: '模型优劣的试金石是能否秒级回答关键追溯问题。若查不出来说明缺少核心实体，若能查出多义矛盾说明拓扑定义不清。', tag: '问题验证', created_at: '2026-07-25' }
    ]
  },

  'lesson-0010': {
    _meta: {
      name: '第 10 课：把模型用到新案例',
      description: '面向通用接口 (Interface) 多态复用模型，将已验证模式快速迁移到异构新业务场景',
      case_background: '【案例背景材料】AI 独角兽企业客户 B 采购了 H100 云算力集群月度订阅，平台为其自动绑定并分配了 GPU 计算节点 Cluster#04。',
      core_concept: 'Object Interface & Polymorphic Pattern',
      version: '1.0.0',
      author: 'system',
      created_at: '2026-07-25',
      scenario: 'lesson-0010',
      complexity: 'medium'
    },
    objectTypes: [
      { id: 1, name: '租户与硬件', description: '算力租户客户、服务客户经理与GPU物理计算节点' },
      { id: 2, name: '订阅与接口', description: '云集群月度订阅服务、多态通用算力接口及服务就绪终态' }
    ],
    objects: [
      { id: 1, object_type_id: 1, name: '客户·独角兽B', properties: JSON.stringify({ 租户编号: 'TENANT-AI-09', 行业: '大模型预训练', 级别: '战略级' }), annotations: '算力需求方' },
      { id: 2, object_type_id: 1, name: '商务·周敏', properties: JSON.stringify({ 工号: 'BD-088', 职务: '算力解决方案架构师' }), annotations: '服务客户经理' },
      { id: 3, object_type_id: 2, name: '算力集群订阅', properties: JSON.stringify({ 订阅单号: 'SUB-H100-M03', 计费: '月度预付', 配额: '8卡SXM5' }), annotations: '业务订阅过程' },
      { id: 4, object_type_id: 2, name: '算力标准接口', properties: JSON.stringify({ 协议: 'PCIe-RoCE-v2', 带宽: '3.2Tbps', 多态抽象: true }), annotations: '多态抽象规范' },
      { id: 5, object_type_id: 1, name: 'GPU节点04', properties: JSON.stringify({ 机架: 'RACK-GPU-CL04', 芯片: 'H100 SXM5', 园区: '乌兰察布A区' }), annotations: '物理基础设施' },
      { id: 6, object_type_id: 2, name: '就绪接入状态', properties: JSON.stringify({ 凭证: 'Kubeconfig-Ready', 资源池: '专有Namespace', 状态: '可用' }), annotations: '资源开通终态' }
    ],
    linkTypes: [
      { id: 1, name: '采购发起', description: '租户企业提交云算力集群采购订阅' },
      { id: 2, name: '商务推进', description: '客户经理推进技术参数与合同匹配' },
      { id: 3, name: '实现标准接口', description: '订阅流实现通用算力抽象接口协议' },
      { id: 4, name: '绑定物理硬件', description: '标准接口向下挂载具体的物理计算节点' },
      { id: 5, name: '交付激活', description: '硬件初始化完毕交付租户就绪接入状态' }
    ],
    links: [
      { id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 3, weight: 1.0 },
      { id: 2, link_type_id: 2, source_object_id: 2, target_object_id: 3, weight: 1.0 },
      { id: 3, link_type_id: 3, source_object_id: 3, target_object_id: 4, weight: 1.0 },
      { id: 4, link_type_id: 4, source_object_id: 4, target_object_id: 5, weight: 1.0 },
      { id: 5, link_type_id: 5, source_object_id: 5, target_object_id: 6, weight: 0.95 }
    ],
    actions: [
      { id: 1, object_id: 4, name: '自动化挂载RDMA无损网络', description: '按标准接口拓扑配置端到端 400G 无损网络链路', status: 'executed', execute_at: '2026-07-25' },
      { id: 2, object_id: 6, name: '下发租户专有Kubeconfig密钥', description: '生成隔离的 Kubernetes 集群访问认证文件并加密交付', status: 'executed', execute_at: '2026-07-25' }
    ],
    introspections: [
      { id: 1, object_id: 4, question: '为什么要在订阅和物理GPU之间插入“算力标准接口”？', answer: '这是本体多态性 (Polymorphism) 的核心：面向接口建模。未来无论后端物理节点换成 H200 还是 ASIC 芯片，上层订阅流程无需任何修改，实现高内聚低耦合。', created_at: '2026-07-25' }
    ],
    insights: [
      { id: 1, object_id: 4, insight: '检验本体设计能力的高阶标准，是能否将通用服务-资源模型无缝迁移应用至全新的异构业务场景中。', tag: '多态复用', created_at: '2026-07-25' }
    ]
  },

  'lesson-0011': {
    _meta: {
      name: '第 11 课：独立完成可验证模型',
      description: '端到端独立构建包含客户、单据、审批流、评分卡与授信账户的自动化风控闭环',
      case_background: '【案例背景材料】借款人赵六提交个人消费贷款申请，智能风控审批流 V4.2 自动运行信用分评估，为赵六开设 ￥50,000 消费授信账户。',
      core_concept: 'Auditable Credit Decisioning',
      version: '1.0.0',
      author: 'system',
      created_at: '2026-07-25',
      scenario: 'lesson-0011',
      complexity: 'hard'
    },
    objectTypes: [
      { id: 1, name: '客户主体与账户', description: '贷款申请人、贷款单据及获批的消费信贷账户' },
      { id: 2, name: '风控决策与状态', description: '自动化风控审批中枢、信用评分卡及授信激活状态' }
    ],
    objects: [
      { id: 1, object_type_id: 1, name: '借款人·赵六', properties: JSON.stringify({ 身份证: '110101****3210', 收入: '25K/月', 评级: '低风险' }), annotations: '申请主体' },
      { id: 2, object_type_id: 1, name: '贷款申请单', properties: JSON.stringify({ 申请编号: 'APP-LN-2026-90', 金额: '￥50,000', 用途: '数码消费' }), annotations: '申请凭单' },
      { id: 3, object_type_id: 2, name: '风控审批流', properties: JSON.stringify({ 引擎: 'RISK-V4.2', 审批耗时: '850ms', 决议: '自动过审' }), annotations: '自动化审批中枢' },
      { id: 4, object_type_id: 2, name: '评分卡·720', properties: JSON.stringify({ 得分: 720, 违约率预测: '<0.15%', 评级: 'AAA' }), annotations: '决策规则卡' },
      { id: 5, object_type_id: 1, name: '消费授信账户', properties: JSON.stringify({ 账号: 'ACC-CREDIT-8801', 额度: '￥50,000', 年化: '4.35%' }), annotations: '信贷实体账户' },
      { id: 6, object_type_id: 2, name: '授信可用状态', properties: JSON.stringify({ 状态码: 'ACTIVE_READY', 提现权限: '已开放', 监控: '实时心跳' }), annotations: '激活终态' }
    ],
    linkTypes: [
      { id: 1, name: '提交申请', description: '借款人提交消费信贷业务申请' },
      { id: 2, name: '输入审查', description: '单据资料输入风控决策中枢引擎' },
      { id: 3, name: '特征评分', description: '风控引擎调用多维特征模型生成评分卡' },
      { id: 4, name: '核准开户', description: '高分评分结果核准开设专属授信账户' },
      { id: 5, name: '激活生效', description: '授信账户赋权激活至正常可用状态' }
    ],
    links: [
      { id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 2, weight: 1.0 },
      { id: 2, link_type_id: 2, source_object_id: 2, target_object_id: 3, weight: 1.0 },
      { id: 3, link_type_id: 3, source_object_id: 3, target_object_id: 4, weight: 1.0 },
      { id: 4, link_type_id: 4, source_object_id: 4, target_object_id: 5, weight: 1.0 },
      { id: 5, link_type_id: 5, source_object_id: 5, target_object_id: 6, weight: 0.95 }
    ],
    actions: [
      { id: 1, object_id: 3, name: '在线穿透二代征信报告', description: '调用央行征信API拉取近五年涉诉、负债与逾期明细', status: 'executed', execute_at: '2026-07-25' },
      { id: 2, object_id: 5, name: '电子授信合同双向存证上链', description: '合同哈希写入区块链存证节点并签发数字证书', status: 'executed', execute_at: '2026-07-25' }
    ],
    introspections: [
      { id: 1, object_id: 3, question: '独立建模金融风控信贷场景时，最核心的拓扑检验标准是什么？', answer: '从客户意向 → 申请单据 → 决策中枢 → 规则模型 → 资产账户 → 可用状态，每一步都必须有因果单向可审计链路，且任何决定都具备数据证据。', created_at: '2026-07-25' }
    ],
    insights: [
      { id: 1, object_id: 5, insight: '可审计的决策链是金融本体图谱的灵魂。将风控规则（评分卡）具象为拓扑节点，使算法黑盒转化为可解释的业务因果链。', tag: '因果自洽', created_at: '2026-07-25' }
    ]
  },

  'lesson-0012': {
    _meta: {
      name: '第 12 课：用新事实更新模型',
      description: '面对业务增量新事实，保持既有模型主线不变，以增量子图形式平滑挂载演进',
      case_background: '【案例背景材料】客户账户 C-901 突发境外异地登录事件，反欺诈风控引擎实时捕获增量事实，平滑挂载 Level3 高危防盗标记。',
      core_concept: 'Incremental Fact & Dynamic Risk Evolution',
      version: '1.0.0',
      author: 'system',
      created_at: '2026-07-25',
      scenario: 'lesson-0012',
      complexity: 'medium'
    },
    objectTypes: [
      { id: 1, name: '存量业务要素', description: '既有存量主账户及正常运行的常态交易流' },
      { id: 2, name: '增量事实与防御', description: '突发增量新事实、反欺诈引擎、高危防盗标记及主动防御验证' }
    ],
    objects: [
      { id: 1, object_type_id: 1, name: '账户·C-901', properties: JSON.stringify({ 账号: 'ACC-C-901', 所属人: '白领客户', 开户地: '上海' }), annotations: '核心存量账户' },
      { id: 2, object_type_id: 1, name: '正常交易流', properties: JSON.stringify({ 状态: '常态运行', 日均: '￥1,200', 基线: '国内商户消费' }), annotations: '既有业务主线' },
      { id: 3, object_type_id: 2, name: '异地登录事件', properties: JSON.stringify({ 性质: '突发增量新事实', 来源IP: '境外动态代理', 时差: '10分钟' }), annotations: '突发增量事件' },
      { id: 4, object_type_id: 2, name: '反欺诈引擎', properties: JSON.stringify({ 规则版本: 'FRAUD-2026', 置信度: 0.98, 判定: '撞库盗号高危' }), annotations: '实时评估分析' },
      { id: 5, object_type_id: 2, name: '高危防盗标记', properties: JSON.stringify({ 级别: 'Level-3', 作用: '全渠道转账拦截', 时效: '即时生效' }), annotations: '增量风险标签' },
      { id: 6, object_type_id: 2, name: '强制人脸验证', properties: JSON.stringify({ 机制: '双因子生物识别', 渠道: 'App强弹窗', 状态: '待用户核验' }), annotations: '主动防御策略' }
    ],
    linkTypes: [
      { id: 1, name: '维持常态主线', description: '账户维持既有存量正常业务流转' },
      { id: 2, name: '突发增量事实', description: '账户突发非典型境外异地登录事件' },
      { id: 3, name: '触发风控评估', description: '增量事实实时上报反欺诈引擎评估' },
      { id: 4, name: '平滑挂载标记', description: '引擎在拓扑上为账户动态挂载高危标记' },
      { id: 5, name: '激活防御动作', description: '高危标记驱动触发二次生物识别主动防御' }
    ],
    links: [
      { id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 2, weight: 1.0 },
      { id: 2, link_type_id: 2, source_object_id: 1, target_object_id: 3, weight: 1.0 },
      { id: 3, link_type_id: 3, source_object_id: 3, target_object_id: 4, weight: 1.0 },
      { id: 4, link_type_id: 4, source_object_id: 4, target_object_id: 5, weight: 1.0 },
      { id: 5, link_type_id: 5, source_object_id: 5, target_object_id: 6, weight: 0.95 }
    ],
    actions: [
      { id: 1, object_id: 5, name: '临时截断API大额转账权限', description: '风控中台熔断该账户资金出海及单笔超万元转账', status: 'executed', execute_at: '2026-07-25' },
      { id: 2, object_id: 6, name: '向预留安全手机下发人脸核验通知', description: '触发移动端强认证流程并在通过后解除风险标记', status: 'in_progress', execute_at: '2026-07-26' }
    ],
    introspections: [
      { id: 1, object_id: 3, question: '面对突发的异地高危登录，传统系统往往推翻重构或打补丁，本体模型如何优雅演进？', answer: '本体具备天然演进性 (Evolutionary)。保持既有主线结构不变，将新增事实作为增量子图挂载在既有实体节点上，实现无损平滑扩展。', created_at: '2026-07-25' }
    ],
    insights: [
      { id: 1, object_id: 1, insight: '优秀的本体拓扑具备开闭原则：对扩展开放，对修改关闭。面对业务新增变量，挂载增量子图，绝不推翻重做。', tag: '平滑演进', created_at: '2026-07-25' }
    ]
  },

  'lesson-0013': {
    _meta: {
      name: '第 13 课：处理相互冲突的材料',
      description: '多来源矛盾事实不强行二选一，通过双信源节点与置信度解耦呈现并由仲裁器裁决',
      case_background: '【案例背景材料】供应商 X 科技公司在自报财报中声称净利润增长 20%，但第三方数据源接入法院公开执行公告，显示其存在被执行案款 ￥1,500 万。',
      core_concept: 'Conflict Resolution & Weight Arbitration',
      version: '1.0.0',
      author: 'system',
      created_at: '2026-07-25',
      scenario: 'lesson-0013',
      complexity: 'hard'
    },
    objectTypes: [
      { id: 1, name: '调查对象与信源', description: '尽调目标企业及权威级别不同的异构信息来源' },
      { id: 2, name: '声明事实与仲裁', description: '企业自报事实、司法涉诉事实、仲裁器与准入决策结论' }
    ],
    objects: [
      { id: 1, object_type_id: 1, name: '供应商·X科技', properties: JSON.stringify({ 统一代码: '91110108MA01****', 资本: '￥5,000万', 状态: '准入尽调中' }), annotations: '尽调目标企业' },
      { id: 2, object_type_id: 1, name: '信源·企业自报', properties: JSON.stringify({ 来源性质: '供应商自行填报', 材料: '自报年报', 固有权重: 0.40 }), annotations: '内部弱信源' },
      { id: 3, object_type_id: 1, name: '信源·司法公开', properties: JSON.stringify({ 来源性质: '中国执行信息网', 材料: '生效判决执行', 固有权重: 0.98 }), annotations: '官方权威强信源' },
      { id: 4, object_type_id: 2, name: '声明·利润增20%', properties: JSON.stringify({ 内容: '净利润同比增长20%', 特征: '无外部审计背书', 置信度: 0.35 }), annotations: '自报利好事实' },
      { id: 5, object_type_id: 2, name: '涉诉·被执行1500万', properties: JSON.stringify({ 案号: '(2026)京01执988号', 标的额: '￥1500万', 置信度: 0.95 }), annotations: '官方涉诉事实' },
      { id: 6, object_type_id: 2, name: '风控仲裁引擎', properties: JSON.stringify({ 算法: '信源权重加权仲裁', 规则: '司法事实绝对优先', 耗时: '12ms' }), annotations: '冲突仲裁器' },
      { id: 7, object_type_id: 2, name: '暂缓准入结论', properties: JSON.stringify({ 评级: 'D-高危供应商', 决议: '暂缓准入·观察名单', 要求: '提供结案证明' }), annotations: '最终仲裁决议' }
    ],
    linkTypes: [
      { id: 1, name: '采集报送材料', description: '系统采集供应商自行填报的审计材料' },
      { id: 2, name: '接入司法底网', description: '系统直连最高法执行公开网权威司法接口' },
      { id: 3, name: '自报声明', description: '企业信源声明净利润大幅增长事实' },
      { id: 4, name: '公示案款', description: '司法信源公示大额未执行案款' },
      { id: 5, name: '提交仲裁', description: '利好声明送交风控仲裁引擎加权裁决' },
      { id: 6, name: '权威呈递', description: '高危司法涉诉事实呈递仲裁引擎' },
      { id: 7, name: '判定准入等级', description: '仲裁引擎输出暂缓准入终态决策' }
    ],
    links: [
      { id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 2, weight: 1.0 },
      { id: 2, link_type_id: 2, source_object_id: 1, target_object_id: 3, weight: 1.0 },
      { id: 3, link_type_id: 3, source_object_id: 2, target_object_id: 4, weight: 0.8 },
      { id: 4, link_type_id: 4, source_object_id: 3, target_object_id: 5, weight: 1.0 },
      { id: 5, link_type_id: 5, source_object_id: 4, target_object_id: 6, weight: 0.6 },
      { id: 6, link_type_id: 6, source_object_id: 5, target_object_id: 6, weight: 1.0 },
      { id: 7, link_type_id: 7, source_object_id: 6, target_object_id: 7, weight: 1.0 }
    ],
    actions: [
      { id: 1, object_id: 5, name: '拉取司法判决书PDF电子存证', description: '自动获取裁判文书网裁定书扫描件生成哈希防篡改凭证', status: 'executed', execute_at: '2026-07-25' },
      { id: 2, object_id: 7, name: '向供应链采购中台下发黑名单拦截', description: '阻断业务部门发起与该供应商的付款与签署流程', status: 'executed', execute_at: '2026-07-25' }
    ],
    introspections: [
      { id: 1, object_id: 6, question: '当两个数据源说法矛盾时，为什么不能直接用“权威的一方”覆盖掉“不权威的一方”？', answer: '强行覆盖抹杀了信息源差异。保留双信源与冲突事实，能清晰看清谁在撒谎、谁在说真话，为后续法律追偿与商业诚信评估提供完整证据链。', created_at: '2026-07-25' }
    ],
    insights: [
      { id: 1, object_id: 1, insight: '真实世界的材料充满矛盾。本体模型绝不可强行抹平冲突，引入信源节点与置信度，把矛盾作为显式拓扑客观呈现。', tag: '冲突仲裁', created_at: '2026-07-25' }
    ]
  },

  'lesson-0014': {
    _meta: {
      name: '第 14 课：让模型结论回到证据',
      description: '为关键业务结论绑定当前有效且不可动摇的原文证据，保证全流程可追溯',
      case_background: '【案例背景材料】原记录：陈工在实验室1检测样品S。主管更正单：实际检测人是王工，陈工为录入错误。确认记录：刘工在实验室1复核样品S，复核后标记为合格。未确认消息：复核地点可能是实验室2；结果可能是不合格。',
      core_concept: 'Claims to Evidence Lineage',
      version: '1.0.0',
      author: 'system',
      created_at: '2026-07-25',
      scenario: 'lesson-0014',
      complexity: 'hard'
    },
    objectTypes: [
      { id: 1, name: '样品与凭据', description: '被检样品标的、历史错误单据、纠偏证据、复核确认单及孤立传闻' },
      { id: 2, name: '确证结论', description: '经有效法律证据链条严密支撑确立的真实检测人结论与合格交付结论' }
    ],
    objects: [
      { id: 1, object_type_id: 1, name: '样品·S', properties: JSON.stringify({ 批次: 'SMP-2026-S9', 材质: '特种合金', 阶段: '复核结项' }), annotations: '检测对象标的' },
      { id: 2, object_type_id: 1, name: '初检记录·作废', properties: JSON.stringify({ 记录人: '陈工', 状态: '录入错误·已作废', 效力: '失效' }), annotations: '已作废历史记录' },
      { id: 3, object_type_id: 1, name: '主管更正单', properties: JSON.stringify({ 文号: 'CORR-2026-08', 依据: '签字审批单', 效力: '法定有效证据' }), annotations: '纠偏有效证据' },
      { id: 4, object_type_id: 1, name: '复核单·合格', properties: JSON.stringify({ 复核人: '刘工', 地点: '实验室1', 结果: '合格', 效力: '法定有效证据' }), annotations: '复核确认证据' },
      { id: 5, object_type_id: 1, name: '孤立传闻·未采信', properties: JSON.stringify({ 内容: '传言地点实验室2/不合格', 信源: '匿名传闻', 采信度: '0%排除' }), annotations: '未采信流言' },
      { id: 6, object_type_id: 2, name: '结论·检测人王工', properties: JSON.stringify({ 责任人: '王工', 确认方式: '主管更正单确证', 法律效力: '确认生效' }), annotations: '确证检测人' },
      { id: 7, object_type_id: 2, name: '交付·合格出厂', properties: JSON.stringify({ 结论: '准予出厂交付', 证据链: '主管更正单+复核单', 追溯码: 'PASS-9901' }), annotations: '交付终态结论' }
    ],
    linkTypes: [
      { id: 1, name: '初检留痕', description: '样品初检操作生成历史初检记录' },
      { id: 2, name: '纠偏废止', description: '主管更正单正式纠偏并废止初检记录' },
      { id: 3, name: '法定确认', description: '主管更正单权威确立实际检测责任人为王工' },
      { id: 4, name: '规范复核', description: '样品经由刘工复核并出具合格凭单' },
      { id: 5, name: '标记排除', description: '图谱显式标记排除无证据链支撑的流言' },
      { id: 6, name: '归纳支撑', description: '王工确证结论支撑最终合格交付' },
      { id: 7, name: '出厂凭据', description: '复核合格单据提供出厂准入法定义务凭据' }
    ],
    links: [
      { id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 2, weight: 0.5 },
      { id: 2, link_type_id: 2, source_object_id: 3, target_object_id: 2, weight: 1.0 },
      { id: 3, link_type_id: 3, source_object_id: 3, target_object_id: 6, weight: 1.0 },
      { id: 4, link_type_id: 4, source_object_id: 1, target_object_id: 4, weight: 1.0 },
      { id: 5, link_type_id: 5, source_object_id: 1, target_object_id: 5, weight: 0.1 },
      { id: 6, link_type_id: 6, source_object_id: 6, target_object_id: 7, weight: 1.0 },
      { id: 7, link_type_id: 7, source_object_id: 4, target_object_id: 7, weight: 1.0 }
    ],
    actions: [
      { id: 1, object_id: 3, name: '主管双人生物手写签名封存', description: '对更正单加盖主管生物识别签名并封存至司法区块链', status: 'executed', execute_at: '2026-07-25' },
      { id: 2, object_id: 7, name: '签发全链路证据溯源码合格证', description: '生成合格证并印制二维码，扫码可穿透完整证据链条', status: 'executed', execute_at: '2026-07-25' }
    ],
    introspections: [
      { id: 1, object_id: 7, question: '质量审计员问：“为什么说样品S合格且实际检测人是王工？”，图谱如何自证？', answer: '沿着拓扑逆向追查：合格出厂结论由王工结论和复核单直接支撑；王工结论由主管更正单确证，同时主管更正单明确废止了陈工初检；孤立传闻无证据链支撑已被标记排除。结论完全立足证据。', created_at: '2026-07-25' }
    ],
    insights: [
      { id: 1, object_id: 1, insight: '图谱交付的任何高阶业务结论都不能悬空。每一条结论必须有一条坚不可摧的拓扑通路，直通最底层的原文证据。', tag: '证据血缘', created_at: '2026-07-25' }
    ]
  }
};

// Write files to data/ontology
const outDir = path.resolve(__dirname, '../data/ontology');
for (const [key, data] of Object.entries(SEEDS)) {
  data.actions = [];
  data.introspections = [];
  data.insights = [];
  const filePath = path.join(outDir, `seed-${key}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Successfully generated: ${filePath} (Objects: ${data.objects.length}, Links: ${data.links.length})`);
}
