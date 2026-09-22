import json
import os

seeds = {
  'lesson-0001': {
    '_meta': {'name': '0001 只写材料真正告诉你的事', 'description': '区分事实、推断与未知'},
    'objectTypes': [
      {'id': 1, 'name': '事实记录', 'description': '原文直接明确给出的已知信息'},
      {'id': 2, 'name': '推断结论', 'description': '根据证据和线索推导得出的可能情况'}
    ],
    'objects': [
      {'id': 1, 'object_type_id': 1, 'name': '妈妈在家做了一道茄子(事实)', 'properties': json.dumps({'来源': '原文段落1'}, ensure_ascii=False), 'annotations': '确定事实'},
      {'id': 2, 'object_type_id': 1, 'name': '我去餐馆买了两道菜(事实)', 'properties': json.dumps({'来源': '原文段落1'}, ensure_ascii=False), 'annotations': '确定事实'},
      {'id': 3, 'object_type_id': 2, 'name': '可能把购买的菜带回了家(推断)', 'properties': json.dumps({'推断线索': '购买后回家'}, ensure_ascii=False), 'annotations': '需要线索支撑的推断'}
    ],
    'linkTypes': [{'id': 1, 'name': '推导支撑', 'description': '事实为推断提供证据链'}],
    'links': [{'id': 1, 'link_type_id': 1, 'source_object_id': 2, 'target_object_id': 3, 'weight': 1.0}],
    'actions': [], 'introspections': [], 'insights': []
  },
  'lesson-0002': {
    '_meta': {'name': '0002 找出需要保持身份的对象', 'description': '提炼独立身份的实体'},
    'objectTypes': [
      {'id': 1, 'name': '人员实体', 'description': '具有唯一身份标识的个人'},
      {'id': 2, 'name': '设备资产', 'description': '具有独立编号的物理设备'},
      {'id': 3, 'name': '组织机构', 'description': '独立的法人或业务部门'}
    ],
    'objects': [
      {'id': 1, 'object_type_id': 1, 'name': '工程师张三', 'properties': json.dumps({'工号': 'E-102'}, ensure_ascii=False), 'annotations': '人员'},
      {'id': 2, 'object_type_id': 2, 'name': '测试手机A', 'properties': json.dumps({'SN': 'SN-8890'}, ensure_ascii=False), 'annotations': '设备'},
      {'id': 3, 'object_type_id': 3, 'name': '北京研发部', 'properties': json.dumps({'DeptID': 'D-01'}, ensure_ascii=False), 'annotations': '机构'}
    ],
    'linkTypes': [
      {'id': 1, 'name': '名下持有', 'description': '人员持有设备'},
      {'id': 2, 'name': '隶属于', 'description': '人员归属于机构'}
    ],
    'links': [
      {'id': 1, 'link_type_id': 1, 'source_object_id': 1, 'target_object_id': 2, 'weight': 1.0},
      {'id': 2, 'link_type_id': 2, 'source_object_id': 1, 'target_object_id': 3, 'weight': 1.0}
    ],
    'actions': [], 'introspections': [], 'insights': []
  },
  'lesson-0003': {
    '_meta': {'name': '0003 找出发生了什么过程', 'description': '建模有始有终的动态过程'},
    'objectTypes': [
      {'id': 1, 'name': '参与主体', 'description': '发起或参与过程的实体'},
      {'id': 2, 'name': '业务过程', 'description': '包含起始、终止与状态演变的时间闭环'}
    ],
    'objects': [
      {'id': 1, 'object_type_id': 1, 'name': '采购员李四', 'properties': json.dumps({'部门': '采购部'}, ensure_ascii=False), 'annotations': '主体'},
      {'id': 2, 'object_type_id': 2, 'name': '服务器设备采购过程', 'properties': json.dumps({'开始时间': '2026-05-01', '状态': '进行中'}, ensure_ascii=False), 'annotations': '过程'}
    ],
    'linkTypes': [{'id': 1, 'name': '发起并主持', 'description': '主体与过程的关联'}],
    'links': [{'id': 1, 'link_type_id': 1, 'source_object_id': 1, 'target_object_id': 2, 'weight': 1.0}],
    'actions': [], 'introspections': [], 'insights': []
  },
  'lesson-0004': {
    '_meta': {'name': '0004 把对象连接到过程', 'description': '区分主导者、受体与关联工具'},
    'objectTypes': [
      {'id': 1, 'name': '人员对象', 'description': '过程主导者'},
      {'id': 2, 'name': '过程事件', 'description': '核心动态业务流'},
      {'id': 3, 'name': '文档标的', 'description': '过程作用的对象标的'}
    ],
    'objects': [
      {'id': 1, 'object_type_id': 1, 'name': '审核官王五', 'properties': json.dumps({'角色': '主审'}, ensure_ascii=False), 'annotations': '主导者'},
      {'id': 2, 'object_type_id': 2, 'name': '合同合规审批流', 'properties': json.dumps({'编号': 'PROC-909'}, ensure_ascii=False), 'annotations': '过程'},
      {'id': 3, 'object_type_id': 3, 'name': '采购框架协议.pdf', 'properties': json.dumps({'密级': '内部'}, ensure_ascii=False), 'annotations': '受体标的'}
    ],
    'linkTypes': [
      {'id': 1, 'name': '主导推进', 'description': '人员发起或推进过程'},
      {'id': 2, 'name': '针对标的', 'description': '过程作用的目标文档'}
    ],
    'links': [
      {'id': 1, 'link_type_id': 1, 'source_object_id': 1, 'target_object_id': 2, 'weight': 1.0},
      {'id': 2, 'link_type_id': 2, 'source_object_id': 2, 'target_object_id': 3, 'weight': 1.0}
    ],
    'actions': [], 'introspections': [], 'insights': []
  },
  'lesson-0005': {
    '_meta': {'name': '0005 说清对象在过程中的作用', 'description': '明确实体在过程中的语义角色'},
    'objectTypes': [
      {'id': 1, 'name': '参与人员', 'description': '交易双方向对象'},
      {'id': 2, 'name': '交易过程', 'description': '双边交易事件'}
    ],
    'objects': [
      {'id': 1, 'object_type_id': 1, 'name': '买方:小张', 'properties': json.dumps({'资金账户': 'ACC-01'}, ensure_ascii=False), 'annotations': '买家'},
      {'id': 2, 'object_type_id': 2, 'name': '二手车转让交易', 'properties': json.dumps({'金额': '85000'}, ensure_ascii=False), 'annotations': '交易过程'},
      {'id': 3, 'object_type_id': 1, 'name': '卖方:老李', 'properties': json.dumps({'卖家评级': '5星'}, ensure_ascii=False), 'annotations': '卖家'}
    ],
    'linkTypes': [
      {'id': 1, 'name': '作为买方参与', 'description': '买方角色 link'},
      {'id': 2, 'name': '作为卖方出让', 'description': '卖方角色 link'}
    ],
    'links': [
      {'id': 1, 'link_type_id': 1, 'source_object_id': 1, 'target_object_id': 2, 'weight': 1.0},
      {'id': 2, 'link_type_id': 2, 'source_object_id': 3, 'target_object_id': 2, 'weight': 1.0}
    ],
    'actions': [], 'introspections': [], 'insights': []
  },
  'lesson-0006': {
    '_meta': {'name': '0006 记录对象变化前后的状态', 'description': '建模状态转变与触发事件'},
    'objectTypes': [
      {'id': 1, 'name': '业务主对象', 'description': '具有生命周期的实体'},
      {'id': 2, 'name': '状态节点', 'description': '特定时间点的阶段特征'},
      {'id': 3, 'name': '触发动作', 'description': '促成状态转变的事件'}
    ],
    'objects': [
      {'id': 1, 'object_type_id': 1, 'name': '订单#ORD-2026', 'properties': json.dumps({'总额': '300'}, ensure_ascii=False), 'annotations': '主实体'},
      {'id': 2, 'object_type_id': 2, 'name': '初始状态:待支付', 'properties': json.dumps({'阶段': 'Draft'}, ensure_ascii=False), 'annotations': '旧状态'},
      {'id': 3, 'object_type_id': 3, 'name': '在线扫码支付成功', 'properties': json.dumps({'流水': 'TX-99'}, ensure_ascii=False), 'annotations': '事件'},
      {'id': 4, 'object_type_id': 2, 'name': '变更状态:已支付', 'properties': json.dumps({'阶段': 'Paid'}, ensure_ascii=False), 'annotations': '新状态'}
    ],
    'linkTypes': [
      {'id': 1, 'name': '处于初始状态', 'description': '实体与旧状态关联'},
      {'id': 2, 'name': '触发状态改变', 'description': '事件促成新状态'}
    ],
    'links': [
      {'id': 1, 'link_type_id': 1, 'source_object_id': 1, 'target_object_id': 2, 'weight': 1.0},
      {'id': 2, 'link_type_id': 2, 'source_object_id': 2, 'target_object_id': 3, 'weight': 1.0},
      {'id': 3, 'link_type_id': 2, 'source_object_id': 3, 'target_object_id': 4, 'weight': 1.0}
    ],
    'actions': [], 'introspections': [], 'insights': []
  },
  'lesson-0007': {
    '_meta': {'name': '0007 写清两个对象之间的关系', 'description': '实体间的直连语义拓扑'},
    'objectTypes': [
      {'id': 1, 'name': '员工对象', 'description': '企业个人'},
      {'id': 2, 'name': '部门对象', 'description': '组织单元'},
      {'id': 3, 'name': '项目对象', 'description': '业务项目'}
    ],
    'objects': [
      {'id': 1, 'object_type_id': 1, 'name': '前端工程师小赵', 'properties': json.dumps({'职级': 'P6'}, ensure_ascii=False), 'annotations': '人员'},
      {'id': 2, 'object_type_id': 2, 'name': 'UI/UX研发部门', 'properties': json.dumps({'编制': '15'}, ensure_ascii=False), 'annotations': '部门'},
      {'id': 3, 'object_type_id': 3, 'name': 'Ontology重构项目', 'properties': json.dumps({'里程碑': 'Phase1'}, ensure_ascii=False), 'annotations': '项目'}
    ],
    'linkTypes': [
      {'id': 1, 'name': '归属于', 'description': '员工隶属部门'},
      {'id': 2, 'name': '主导管理', 'description': '部门管理项目'}
    ],
    'links': [
      {'id': 1, 'link_type_id': 1, 'source_object_id': 1, 'target_object_id': 2, 'weight': 1.0},
      {'id': 2, 'link_type_id': 2, 'source_object_id': 2, 'target_object_id': 3, 'weight': 1.0}
    ],
    'actions': [], 'introspections': [], 'insights': []
  },
  'lesson-0008': {
    '_meta': {'name': '0008 组装一个最小本体模型', 'description': '整合实体、过程、角色与状态闭环'},
    'objectTypes': [
      {'id': 1, 'name': '客户实体', 'description': '下单主体'},
      {'id': 2, 'name': '履约过程', 'description': '订单履约中心事件'},
      {'id': 3, 'name': '商品标的', 'description': '交易交付物'},
      {'id': 4, 'name': '交付状态', 'description': '最终到达状态'}
    ],
    'objects': [
      {'id': 1, 'object_type_id': 1, 'name': 'VIP客户Alice', 'properties': json.dumps({'等级': 'VIP3'}, ensure_ascii=False), 'annotations': '客户'},
      {'id': 2, 'object_type_id': 2, 'name': '订单#8081履约流', 'properties': json.dumps({'快递': '顺丰'}, ensure_ascii=False), 'annotations': '过程'},
      {'id': 3, 'object_type_id': 3, 'name': '人体工学椅', 'properties': json.dumps({'型号': 'Ergo-X'}, ensure_ascii=False), 'annotations': '商品'},
      {'id': 4, 'object_type_id': 4, 'name': '终端签收(已送达)', 'properties': json.dumps({'签收人': '本人'}, ensure_ascii=False), 'annotations': '状态'}
    ],
    'linkTypes': [
      {'id': 1, 'name': '发起订单', 'description': '客户发起过程'},
      {'id': 2, 'name': '包含标的', 'description': '过程交付商品'},
      {'id': 3, 'name': '达成终端状态', 'description': '过程到达状态'}
    ],
    'links': [
      {'id': 1, 'link_type_id': 1, 'source_object_id': 1, 'target_object_id': 2, 'weight': 1.0},
      {'id': 2, 'link_type_id': 2, 'source_object_id': 2, 'target_object_id': 3, 'weight': 1.0},
      {'id': 3, 'link_type_id': 3, 'source_object_id': 2, 'target_object_id': 4, 'weight': 1.0}
    ],
    'actions': [], 'introspections': [], 'insights': []
  },
  'lesson-0009': {
    '_meta': {'name': '0009 用问题检查模型是否可用', 'description': '用业务追问检验链路完整性'},
    'objectTypes': [
      {'id': 1, 'name': '责任人员', 'description': '操作人'},
      {'id': 2, 'name': '变更事件', 'description': '业务动作'},
      {'id': 3, 'name': '被控配置', 'description': '目标受体'}
    ],
    'objects': [
      {'id': 1, 'object_type_id': 1, 'name': '运维管理员', 'properties': json.dumps({'权限': 'Root'}, ensure_ascii=False), 'annotations': '谁操作的？'},
      {'id': 2, 'object_type_id': 2, 'name': '修改生产数据库配置', 'properties': json.dumps({'时间': '14:02:00'}, ensure_ascii=False), 'annotations': '什么时间做了什么？'},
      {'id': 3, 'object_type_id': 3, 'name': 'DuckDB内存阈值', 'properties': json.dumps({'原值': '4G', '新值': '16G'}, ensure_ascii=False), 'annotations': '影响了什么目标？'}
    ],
    'linkTypes': [
      {'id': 1, 'name': '执行操作', 'description': '回答谁发起了动作'},
      {'id': 2, 'name': '作用目标', 'description': '回答修改了什么配置'}
    ],
    'links': [
      {'id': 1, 'link_type_id': 1, 'source_object_id': 1, 'target_object_id': 2, 'weight': 1.0},
      {'id': 2, 'link_type_id': 2, 'source_object_id': 2, 'target_object_id': 3, 'weight': 1.0}
    ],
    'actions': [], 'introspections': [], 'insights': []
  },
  'lesson-0010': {
    '_meta': {'name': '0010 把模型迁移到新案例', 'description': '抽象通用服务模式'},
    'objectTypes': [
      {'id': 1, 'name': '服务请求方', 'description': '通用 Client 角色'},
      {'id': 2, 'name': '服务订阅过程', 'description': '通用 Process 角色'},
      {'id': 3, 'name': '服务资源标的', 'description': '通用 Resource 角色'}
    ],
    'objects': [
      {'id': 1, 'object_type_id': 1, 'name': '企业客户B', 'properties': json.dumps({'规模': '中型企业'}, ensure_ascii=False), 'annotations': '从买菜抽象为服务请求'},
      {'id': 2, 'object_type_id': 2, 'name': '云算力服务订阅', 'properties': json.dumps({'周期': '按月'}, ensure_ascii=False), 'annotations': '通用过程'},
      {'id': 3, 'object_type_id': 3, 'name': 'GPU集群节点#04', 'properties': json.dumps({'卡数': '8xH100'}, ensure_ascii=False), 'annotations': '通用资源标的'}
    ],
    'linkTypes': [
      {'id': 1, 'name': '订阅请求', 'description': '通用请求 link'},
      {'id': 2, 'name': '分配资源', 'description': '通用分配 link'}
    ],
    'links': [
      {'id': 1, 'link_type_id': 1, 'source_object_id': 1, 'target_object_id': 2, 'weight': 1.0},
      {'id': 2, 'link_type_id': 2, 'source_object_id': 2, 'target_object_id': 3, 'weight': 1.0}
    ],
    'actions': [], 'introspections': [], 'insights': []
  },
  'lesson-0011': {
    '_meta': {'name': '0011 独立完成一个可验证模型', 'description': '独立闭环模型验证'},
    'objectTypes': [
      {'id': 1, 'name': '申请人', 'description': '贷款主体'},
      {'id': 2, 'name': '风控过程', 'description': '核心评估机制'},
      {'id': 3, 'name': '授信结果', 'description': '输出资产'}
    ],
    'objects': [
      {'id': 1, 'object_type_id': 1, 'name': '借款人赵六', 'properties': json.dumps({'信用分': '720'}, ensure_ascii=False), 'annotations': '申请人'},
      {'id': 2, 'object_type_id': 2, 'name': '自动风控审查引擎', 'properties': json.dumps({'策略集': 'V4.2'}, ensure_ascii=False), 'annotations': '过程'},
      {'id': 3, 'object_type_id': 3, 'name': '授信额度:￥50,000', 'properties': json.dumps({'利率': '4.35%'}, ensure_ascii=False), 'annotations': '结果'}
    ],
    'linkTypes': [
      {'id': 1, 'name': '提交申请', 'description': '申请人发起'},
      {'id': 2, 'name': '算得额度', 'description': '风控输出授信'}
    ],
    'links': [
      {'id': 1, 'link_type_id': 1, 'source_object_id': 1, 'target_object_id': 2, 'weight': 1.0},
      {'id': 2, 'link_type_id': 2, 'source_object_id': 2, 'target_object_id': 3, 'weight': 1.0}
    ],
    'actions': [], 'introspections': [], 'insights': []
  },
  'lesson-0012': {
    '_meta': {'name': '0012 用新事实更新模型', 'description': '平滑扩展增量节点'},
    'objectTypes': [
      {'id': 1, 'name': '已有主线对象', 'description': '原模型对象'},
      {'id': 2, 'name': '新增补充事实', 'description': '新获取的事实'},
      {'id': 3, 'name': '衍生风险状态', 'description': '扩充的状态维度'}
    ],
    'objects': [
      {'id': 1, 'object_type_id': 1, 'name': '原客户档案', 'properties': json.dumps({'ID': 'C-901'}, ensure_ascii=False), 'annotations': '既有事实'},
      {'id': 2, 'object_type_id': 2, 'name': '新增异地登录事实', 'properties': json.dumps({'IP': '192.168.1.1', '地点': '异地'}, ensure_ascii=False), 'annotations': '新事实'},
      {'id': 3, 'object_type_id': 3, 'name': '触发高危防刷标记', 'properties': json.dumps({'等级': 'Level-3'}, ensure_ascii=False), 'annotations': '扩充节点'}
    ],
    'linkTypes': [
      {'id': 1, 'name': '观测到新事实', 'description': '增量扩展 link'},
      {'id': 2, 'name': '标记衍生状态', 'description': '状态扩充 link'}
    ],
    'links': [
      {'id': 1, 'link_type_id': 1, 'source_object_id': 1, 'target_object_id': 2, 'weight': 1.0},
      {'id': 2, 'link_type_id': 2, 'source_object_id': 2, 'target_object_id': 3, 'weight': 1.0}
    ],
    'actions': [], 'introspections': [], 'insights': []
  },
  'lesson-0013': {
    '_meta': {'name': '0013 处理相互冲突的材料', 'description': '标记多来源冲突事实'},
    'objectTypes': [
      {'id': 1, 'name': '目标实体', 'description': '被调查的主实体'},
      {'id': 2, 'name': '信源A记录', 'description': '渠道1事实'},
      {'id': 3, 'name': '信源B记录', 'description': '渠道2冲突事实'}
    ],
    'objects': [
      {'id': 1, 'object_type_id': 1, 'name': '供应商X公司', 'properties': json.dumps({'税号': '9111000'}, ensure_ascii=False), 'annotations': '主体'},
      {'id': 2, 'object_type_id': 2, 'name': '信源A:财务状况优良', 'properties': json.dumps({'来源': '自报财报', '置信度': '0.6'}, ensure_ascii=False), 'annotations': '渠道A正面'},
      {'id': 3, 'object_type_id': 3, 'name': '信源B:存在法律纠纷', 'properties': json.dumps({'来源': '法院公告', '置信度': '0.9'}, ensure_ascii=False), 'annotations': '渠道B负面冲突'}
    ],
    'linkTypes': [
      {'id': 1, 'name': '信源A声称', 'description': '渠道A声明'},
      {'id': 2, 'name': '信源B声称', 'description': '渠道B冲突声明'}
    ],
    'links': [
      {'id': 1, 'link_type_id': 1, 'source_object_id': 1, 'target_object_id': 2, 'weight': 0.6},
      {'id': 2, 'link_type_id': 2, 'source_object_id': 1, 'target_object_id': 3, 'weight': 0.9}
    ],
    'actions': [], 'introspections': [], 'insights': []
  }
}

target_dir = r'c:\Users\luoyu\Desktop\Duckdb_Manager\duckdb-editor\data\ontology'
for key, data in seeds.items():
    filePath = os.path.join(target_dir, f'seed-{key}.json')
    with open(filePath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print('Created seed:', filePath)
