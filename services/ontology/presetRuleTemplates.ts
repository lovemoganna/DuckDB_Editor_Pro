import type { FeatureDefinition, RuleDefinition } from './ontologyInferenceEngine';

export interface PresetTemplate {
  id: string;
  category: 'finance' | 'ecommerce' | 'supply_chain' | 'cybersecurity';
  categoryLabel: string;
  chipLabel: string;
  name: string;
  description: string;
  lispCode: string;
  explanation: string;
  sampleFeatures: FeatureDefinition[];
  rule: RuleDefinition;
}

export const PRESET_RULE_TEMPLATES: PresetTemplate[] = [
  {
    id: 'preset_aml_high_risk',
    category: 'finance',
    categoryLabel: '🏦 金融风控 / 反洗钱',
    chipLabel: '🏦 金融反洗钱',
    name: '高风险交易识别',
    description: '识别资金快进快出、大额交易且涉及高风险/涉制裁地址，同时排除白名单信任客户。',
    lispCode: `(高风险交易
 (AND
  (快进快出 是)
  (交易金额 大于 100000)
  (OR
   (地址风险 等于 高风险)
   (地址风险 等于 制裁))
  (NOT
   (客户标签 包含 白名单))))`,
    explanation: '当同时满足“资金快进快出”且“交易金额 > 10万”，且“对手地址为高风险或涉制裁”，且“客户不属于白名单”时，推演判定为高风险交易。',
    sampleFeatures: [
      {
        id: 'feat_fast_in_out',
        logicalId: 'feature.risk.fast_in_fast_out',
        version: 1,
        name: '快进快出',
        description: '资金短时间内转入并快速转出',
        valueType: 'boolean',
        objectTypeId: 1,
        source: { kind: 'column', table: 'tx', column: 'fast_in_out' },
        nullSemantics: '缺流水时为 UNKNOWN',
        domain: [true, false],
        status: 'active',
      },
      {
        id: 'feat_tx_amount',
        logicalId: 'feature.risk.transaction_amount',
        version: 1,
        name: '交易金额',
        description: '交易的人民币折算金额',
        valueType: 'number',
        objectTypeId: 1,
        source: { kind: 'column', table: 'tx', column: 'amount' },
        nullSemantics: '缺金额时为 UNKNOWN',
        domain: [50000, 150000, 500000],
        status: 'active',
      },
      {
        id: 'feat_addr_risk',
        logicalId: 'feature.risk.address_risk',
        version: 1,
        name: '地址风险',
        description: '对手地址安全等级',
        valueType: 'category',
        objectTypeId: 1,
        source: { kind: 'column', table: 'tx', column: 'address_risk' },
        nullSemantics: '缺地址情报时为 UNKNOWN',
        domain: ['正常', '高风险', '制裁'],
        status: 'active',
      },
      {
        id: 'feat_cust_tags',
        logicalId: 'feature.risk.customer_tags',
        version: 1,
        name: '客户标签',
        description: '客户业务身份标签集合',
        valueType: 'set',
        objectTypeId: 1,
        source: { kind: 'column', table: 'customer', column: 'tags' },
        nullSemantics: '缺标签时为 UNKNOWN',
        domain: [[], ['白名单']],
        status: 'active',
      },
    ],
    rule: {
      id: 'rule_preset_aml_high_risk',
      logicalId: 'rule.risk.high_risk_transaction',
      version: 1,
      name: '高风险交易识别',
      description: '大额快进快出，且涉及高风险或制裁地址，同时排除白名单客户。',
      status: 'active',
      root: {
        kind: 'and',
        nodeId: 'node_aml_root',
        children: [
          {
            kind: 'condition',
            nodeId: 'node_aml_fast',
            featureId: 'feat_fast_in_out',
            operator: 'is_true',
          },
          {
            kind: 'condition',
            nodeId: 'node_aml_amount',
            featureId: 'feat_tx_amount',
            operator: 'gt',
            value: 100000,
          },
          {
            kind: 'or',
            nodeId: 'node_aml_addr_or',
            children: [
              {
                kind: 'condition',
                nodeId: 'node_aml_addr_high',
                featureId: 'feat_addr_risk',
                operator: 'eq',
                value: '高风险',
              },
              {
                kind: 'condition',
                nodeId: 'node_aml_addr_sanction',
                featureId: 'feat_addr_risk',
                operator: 'eq',
                value: '制裁',
              },
            ],
          },
          {
            kind: 'not',
            nodeId: 'node_aml_whitelist_not',
            child: {
              kind: 'condition',
              nodeId: 'node_aml_whitelist_tag',
              featureId: 'feat_cust_tags',
              operator: 'contains',
              value: '白名单',
            },
          },
        ],
      },
    },
  },
  {
    id: 'preset_ecom_scalper_fraud',
    category: 'ecommerce',
    categoryLabel: '🛒 电商防刷 / 账户欺诈',
    chipLabel: '🛒 电商防刷',
    name: '黑产刷单团伙预警',
    description: '识别同 IP/设备集中注册登录，配合大额优惠券套现，且未通过真实实名认证的团伙行为。',
    lispCode: `(黑产刷单团伙
 (AND
  (同IP注册账号数 大于 5)
  (同设备多账号登录 是)
  (OR
   (支付渠道 等于 虚假代付)
   (优惠券使用率 大于 0.9))
  (NOT
   (实名认证状态 等于 已通过))))`,
    explanation: '同一 IP 批量注册且同设备多账号登录，使用虚假代付或超高比例优惠券，且未通过实名认证时，推演判定为黑产刷单。',
    sampleFeatures: [
      {
        id: 'feat_ip_reg_count',
        logicalId: 'feature.ecom.ip_reg_count',
        version: 1,
        name: '同IP注册账号数',
        description: '同一 IP 24小时内注册账号总数',
        valueType: 'number',
        objectTypeId: 1,
        source: { kind: 'column', table: 'user_log', column: 'ip_reg_count' },
        nullSemantics: '缺日志时为 UNKNOWN',
        domain: [1, 3, 10],
        status: 'active',
      },
      {
        id: 'feat_device_multi_login',
        logicalId: 'feature.ecom.device_multi_login',
        version: 1,
        name: '同设备多账号登录',
        description: '单设备登录多于 3 个账户',
        valueType: 'boolean',
        objectTypeId: 1,
        source: { kind: 'column', table: 'user_log', column: 'multi_login' },
        nullSemantics: '缺设备指纹时为 UNKNOWN',
        domain: [true, false],
        status: 'active',
      },
      {
        id: 'feat_pay_channel',
        logicalId: 'feature.ecom.pay_channel',
        version: 1,
        name: '支付渠道',
        description: '订单支付渠道类别',
        valueType: 'category',
        objectTypeId: 1,
        source: { kind: 'column', table: 'order', column: 'pay_channel' },
        nullSemantics: '缺支付方式时为 UNKNOWN',
        domain: ['微信支付', '支付宝', '虚假代付'],
        status: 'active',
      },
      {
        id: 'feat_coupon_rate',
        logicalId: 'feature.ecom.coupon_rate',
        version: 1,
        name: '优惠券使用率',
        description: '优惠券金额占订单总额比例',
        valueType: 'number',
        objectTypeId: 1,
        source: { kind: 'column', table: 'order', column: 'coupon_rate' },
        nullSemantics: '缺优惠券记录时为 UNKNOWN',
        domain: [0.1, 0.5, 0.95],
        status: 'active',
      },
      {
        id: 'feat_kyc_status',
        logicalId: 'feature.ecom.kyc_status',
        version: 1,
        name: '实名认证状态',
        description: '用户二要素/四要素核验状态',
        valueType: 'category',
        objectTypeId: 1,
        source: { kind: 'column', table: 'user', column: 'kyc_status' },
        nullSemantics: '未提交认证时为 UNKNOWN',
        domain: ['未认证', '已通过', '审核失败'],
        status: 'active',
      },
    ],
    rule: {
      id: 'rule_preset_ecom_scalper_fraud',
      logicalId: 'rule.ecom.scalper_fraud',
      version: 1,
      name: '黑产刷单团伙预警',
      description: '同 IP/设备集中注册登录，配合大额优惠券套现，且未通过真实实名认证。',
      status: 'active',
      root: {
        kind: 'and',
        nodeId: 'node_ecom_root',
        children: [
          {
            kind: 'condition',
            nodeId: 'node_ecom_ip',
            featureId: 'feat_ip_reg_count',
            operator: 'gt',
            value: 5,
          },
          {
            kind: 'condition',
            nodeId: 'node_ecom_device',
            featureId: 'feat_device_multi_login',
            operator: 'is_true',
          },
          {
            kind: 'or',
            nodeId: 'node_ecom_pay_or',
            children: [
              {
                kind: 'condition',
                nodeId: 'node_ecom_pay_fake',
                featureId: 'feat_pay_channel',
                operator: 'eq',
                value: '虚假代付',
              },
              {
                kind: 'condition',
                nodeId: 'node_ecom_coupon_rate',
                featureId: 'feat_coupon_rate',
                operator: 'gt',
                value: 0.9,
              },
            ],
          },
          {
            kind: 'not',
            nodeId: 'node_ecom_kyc_not',
            child: {
              kind: 'condition',
              nodeId: 'node_ecom_kyc_pass',
              featureId: 'feat_kyc_status',
              operator: 'eq',
              value: '已通过',
            },
          },
        ],
      },
    },
  },
  {
    id: 'preset_supply_chain_delay',
    category: 'supply_chain',
    categoryLabel: '🚚 供应链履约 / 违约预警',
    chipLabel: '🚚 供应链履约',
    name: '履约高风险订单识别',
    description: '识别物流长久停滞、供应商履约历史差的高风险订单，保障 VIP 客户与生鲜易腐货物履约。',
    lispCode: `(履约高风险订单
 (AND
  (物流停滞时长 大于 48)
  (供应商历史履约率 小于 0.85)
  (OR
   (货物类型 等于 易腐生鲜)
   (客户优先等级 等于 VIP天猫))
  (NOT
   (异常报备状态 等于 已报备))))`,
    explanation: '物流停滞超 48 小时且供应商历史履约率低于 85%，针对生鲜或 VIP 订单且尚未报备时，推演预警为履约高风险订单。',
    sampleFeatures: [
      {
        id: 'feat_logistics_stagnant_hours',
        logicalId: 'feature.supply.logistics_stagnant_hours',
        version: 1,
        name: '物流停滞时长',
        description: '运单最新轨迹未更新小时数',
        valueType: 'number',
        objectTypeId: 1,
        source: { kind: 'column', table: 'waybill', column: 'stagnant_hours' },
        nullSemantics: '缺物流轨迹时为 UNKNOWN',
        domain: [12, 36, 72],
        status: 'active',
      },
      {
        id: 'feat_supplier_fulfillment_rate',
        logicalId: 'feature.supply.supplier_fulfillment_rate',
        version: 1,
        name: '供应商历史履约率',
        description: '过去 90 天准时送达比例',
        valueType: 'number',
        objectTypeId: 1,
        source: { kind: 'column', table: 'supplier', column: 'rate' },
        nullSemantics: '新供应商无历史时为 UNKNOWN',
        domain: [0.75, 0.9, 0.98],
        status: 'active',
      },
      {
        id: 'feat_cargo_type',
        logicalId: 'feature.supply.cargo_type',
        version: 1,
        name: '货物类型',
        description: '托运货物特殊分类',
        valueType: 'category',
        objectTypeId: 1,
        source: { kind: 'column', table: 'cargo', column: 'type' },
        nullSemantics: '普通货物',
        domain: ['普通件', '易腐生鲜', '危险品'],
        status: 'active',
      },
      {
        id: 'feat_customer_vip_level',
        logicalId: 'feature.supply.customer_vip_level',
        version: 1,
        name: '客户优先等级',
        description: '客户服务 SLA 优先级',
        valueType: 'category',
        objectTypeId: 1,
        source: { kind: 'column', table: 'customer', column: 'sla_level' },
        nullSemantics: '标准客户',
        domain: ['标准', 'VIP天猫', '战略大客户'],
        status: 'active',
      },
      {
        id: 'feat_exception_report_status',
        logicalId: 'feature.supply.exception_report_status',
        version: 1,
        name: '异常报备状态',
        description: '物流客服是否已在系统进行人工报备',
        valueType: 'category',
        objectTypeId: 1,
        source: { kind: 'column', table: 'waybill', column: 'report_status' },
        nullSemantics: '未报备',
        domain: ['未报备', '已报备', '处理中'],
        status: 'active',
      },
    ],
    rule: {
      id: 'rule_preset_supply_chain_delay',
      logicalId: 'rule.supply.high_risk_fulfillment',
      version: 1,
      name: '履约高风险订单识别',
      description: '物流停滞长、供应商履约差，且涉及易腐生鲜或 VIP 客户订单。',
      status: 'active',
      root: {
        kind: 'and',
        nodeId: 'node_supply_root',
        children: [
          {
            kind: 'condition',
            nodeId: 'node_supply_hours',
            featureId: 'feat_logistics_stagnant_hours',
            operator: 'gt',
            value: 48,
          },
          {
            kind: 'condition',
            nodeId: 'node_supply_rate',
            featureId: 'feat_supplier_fulfillment_rate',
            operator: 'lt',
            value: 0.85,
          },
          {
            kind: 'or',
            nodeId: 'node_supply_type_or',
            children: [
              {
                kind: 'condition',
                nodeId: 'node_supply_cargo_fresh',
                featureId: 'feat_cargo_type',
                operator: 'eq',
                value: '易腐生鲜',
              },
              {
                kind: 'condition',
                nodeId: 'node_supply_vip',
                featureId: 'feat_customer_vip_level',
                operator: 'eq',
                value: 'VIP天猫',
              },
            ],
          },
          {
            kind: 'not',
            nodeId: 'node_supply_report_not',
            child: {
              kind: 'condition',
              nodeId: 'node_supply_report_done',
              featureId: 'feat_exception_report_status',
              operator: 'eq',
              value: '已报备',
            },
          },
        ],
      },
    },
  },
  {
    id: 'preset_cybersecurity_privilege_escalation',
    category: 'cybersecurity',
    categoryLabel: '🛡️ 网络安全 / 零信任防护',
    chipLabel: '🛡️ 网络安全',
    name: '高危特权越权与数据导出',
    description: '识别异地登录、高频访问，且试图导出全量敏感库或提权，且未完成二次 MFA 验证的行为。',
    lispCode: `(高危特权越权
 (AND
  (异地登录 是)
  (访问频次 大于 1000)
  (OR
   (请求指令 等于 导出全量敏感库)
   (请求指令 等于 提权执行))
  (NOT
   (二次MFA认证 等于 已验证))))`,
    explanation: '异地登录且高频访问，触发高危数据导出或提权命令，且未经过二次 MFA 动态口令验证时，推演判定为高危越权。',
    sampleFeatures: [
      {
        id: 'feat_offsite_login',
        logicalId: 'feature.sec.offsite_login',
        version: 1,
        name: '异地登录',
        description: '登录 IP 城市偏离常用办公地',
        valueType: 'boolean',
        objectTypeId: 1,
        source: { kind: 'column', table: 'sec_log', column: 'is_offsite' },
        nullSemantics: '缺 IP 定位时为 UNKNOWN',
        domain: [true, false],
        status: 'active',
      },
      {
        id: 'feat_access_rate',
        logicalId: 'feature.sec.access_rate',
        version: 1,
        name: '访问频次',
        description: '1 分钟内 API 请求次数',
        valueType: 'number',
        objectTypeId: 1,
        source: { kind: 'column', table: 'sec_log', column: 'req_count' },
        nullSemantics: '缺统计时为 UNKNOWN',
        domain: [50, 500, 2000],
        status: 'active',
      },
      {
        id: 'feat_request_action',
        logicalId: 'feature.sec.request_action',
        version: 1,
        name: '请求指令',
        description: '访问的具体敏感 API 动作',
        valueType: 'category',
        objectTypeId: 1,
        source: { kind: 'column', table: 'sec_log', column: 'action' },
        nullSemantics: '普通读取',
        domain: ['常规查询', '导出全量敏感库', '提权执行'],
        status: 'active',
      },
      {
        id: 'feat_mfa_status',
        logicalId: 'feature.sec.mfa_status',
        version: 1,
        name: '二次MFA认证',
        description: '多因素动态口令校验状态',
        valueType: 'category',
        objectTypeId: 1,
        source: { kind: 'column', table: 'sec_log', column: 'mfa_status' },
        nullSemantics: '未触发 MFA',
        domain: ['未验证', '已验证', '验证失败'],
        status: 'active',
      },
    ],
    rule: {
      id: 'rule_preset_cybersecurity_privilege_escalation',
      logicalId: 'rule.sec.privilege_escalation',
      version: 1,
      name: '高危特权越权与数据导出',
      description: '异地登录、高频访问，且试图导出全量敏感库或提权，且未完成二次 MFA 验证。',
      status: 'active',
      root: {
        kind: 'and',
        nodeId: 'node_sec_root',
        children: [
          {
            kind: 'condition',
            nodeId: 'node_sec_offsite',
            featureId: 'feat_offsite_login',
            operator: 'is_true',
          },
          {
            kind: 'condition',
            nodeId: 'node_sec_rate',
            featureId: 'feat_access_rate',
            operator: 'gt',
            value: 1000,
          },
          {
            kind: 'or',
            nodeId: 'node_sec_action_or',
            children: [
              {
                kind: 'condition',
                nodeId: 'node_sec_export',
                featureId: 'feat_request_action',
                operator: 'eq',
                value: '导出全量敏感库',
              },
              {
                kind: 'condition',
                nodeId: 'node_sec_escalate',
                featureId: 'feat_request_action',
                operator: 'eq',
                value: '提权执行',
              },
            ],
          },
          {
            kind: 'not',
            nodeId: 'node_sec_mfa_not',
            child: {
              kind: 'condition',
              nodeId: 'node_sec_mfa_pass',
              featureId: 'feat_mfa_status',
              operator: 'eq',
              value: '已验证',
            },
          },
        ],
      },
    },
  },
];
