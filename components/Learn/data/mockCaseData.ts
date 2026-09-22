/**
 * mockCaseData.ts - 预设本体建模实战标准案例库
 * 
 * 为用户提供从业务痛点材料到 Object / Property / Link / Action (OPLA) 闭环的完整参考范例。
 */

export interface CaseObjectProperty {
  id: string;
  name: string;
  dataType: 'VARCHAR' | 'INTEGER' | 'DOUBLE' | 'TIMESTAMP' | 'BOOLEAN';
  kind: 'identity' | 'state' | 'metric' | 'immutable';
  description: string;
  exampleValue: string;
}

export interface CaseObject {
  id: string;
  name: string;
  displayName: string;
  description: string;
  isEventDriven: boolean; // 是否为事件型实体（如温超事故、签收交接）
  primaryKey: string;
  properties: CaseObjectProperty[];
}

export interface CaseLink {
  id: string;
  sourceObjectId: string;
  targetObjectId: string;
  predicate: string; // 动词谓词，如 TRANSPORTED_BY, MONITORED_BY
  cardinality: '1:1' | '1:N' | 'N:1' | 'M:N';
  description: string;
}

export interface CaseAction {
  id: string;
  name: string;
  displayName: string;
  targetObjectId: string;
  actor: string; // 操作主体，如 "调度员", "车载温控网关", "理赔审核员"
  preconditions: string; // 前置条件，如 "truck.status == 'IDLE' AND order.status == 'PAID'"
  mutation: string; // 状态迁移，如 "order.status -> IN_TRANSIT, truck.status -> OCCUPIED"
  auditEvent: string; // 产生的不可变事件
  description: string;
}

export interface ModelingCase {
  id: string;
  title: string;
  industry: string;
  difficulty: '入门' | '进阶' | '核心旗舰';
  summary: string;
  businessBackground: string;
  businessDilemmas: string[]; // 业务三大核心痛点/挑战
  referenceModel: {
    objects: CaseObject[];
    links: CaseLink[];
    actions: CaseAction[];
  };
  sampleDuckDbSql: string; // 可直接在 DuckDB 执行的 DDL & DML 验证脚本
}

export const PRESET_MODELING_CASES: ModelingCase[] = [
  {
    id: 'case-coldchain-shunda',
    title: '顺达冷链：跨省生鲜干线履约与温控异常理赔',
    industry: '现代智慧物流 / 冷链物联网',
    difficulty: '核心旗舰',
    summary: '全流程打通高货值生鲜冷链运输、物联网温控实时监视、温超异常紧急改派与履约索赔业务闭环。',
    businessBackground: `【真实业务场景描述】
顺达供应链负责将一批高品质冰鲜三文鱼和澳洲和牛从大连港冷库干线转运至北京核心商超。
每个运单对应一批货物包装，包含发货人、收货人、货值及全程温度控制红线（三文鱼最高允许 4℃，和牛最高允许 0℃）。
货物由具备双回路制冷机组的专业冷藏车承运，车厢内布置有 IoT 无线温湿度传感器，每 5 分钟向网关上报实时温度与经纬度。
在京沈高速路段，车辆遭遇严重拥堵且制冷副机突发跳闸，传感器在 30 分钟内连续 6 次上报车厢温度突破 7.5℃。
系统需立即捕获该温控异常事件，触发调度员执行「紧急就近进中转冷库排险」Action，并在货物变质后联动保险公司生成理赔单据，完成闭环。`,
    businessDilemmas: [
      '关系数据库碎片化：运单在 TMS、车辆在 GPS 系统、温度在 IoT 时序库、理赔在 ERP，多表无法及时关联，导致发现温超延误超 2 小时。',
      '缺乏业务行动闭环：只在仪表盘展示红色警报，缺乏从"发现异常"到"改派中转库"和"责任判定"的标准化 Action 状态迁移。',
      '主观推断与责任争议：司机称冷库交接时已超温，冷库称车厢制冷失效，缺乏客观因果链与不可变溯源证据。',
    ],
    referenceModel: {
      objects: [
        {
          id: 'obj-shipment-order',
          name: 'ShipmentOrder',
          displayName: '货运订单',
          description: '冷链干线运输业务的履约核心容器与货值载体',
          isEventDriven: false,
          primaryKey: 'order_id',
          properties: [
            { id: 'p-order-id', name: 'order_id', dataType: 'VARCHAR', kind: 'identity', description: '运单唯一全局编码', exampleValue: "'ORD-2026-0901'" },
            { id: 'p-cargo-type', name: 'cargo_type', dataType: 'VARCHAR', kind: 'immutable', description: '货物种类（冰鲜三文鱼/和牛）', exampleValue: "'冰鲜三文鱼'" },
            { id: 'p-temp-threshold', name: 'max_temp_celsius', dataType: 'DOUBLE', kind: 'immutable', description: '最高允许冷链温控阈值', exampleValue: '4.0' },
            { id: 'p-order-status', name: 'status', dataType: 'VARCHAR', kind: 'state', description: '订单履约状态机', exampleValue: "'IN_TRANSIT'" },
            { id: 'p-cargo-value', name: 'cargo_value_cny', dataType: 'DOUBLE', kind: 'immutable', description: '申报货值（元）', exampleValue: '185000.0' },
          ],
        },
        {
          id: 'obj-reefer-truck',
          name: 'ReeferTruck',
          displayName: '冷藏货车',
          description: '执行物理干线运输与温控保障的重型冷链载具',
          isEventDriven: false,
          primaryKey: 'truck_id',
          properties: [
            { id: 'p-truck-id', name: 'truck_id', dataType: 'VARCHAR', kind: 'identity', description: '车辆唯一资产编号/车牌号', exampleValue: "'TRUCK-LN-8892'" },
            { id: 'p-driver-name', name: 'driver_name', dataType: 'VARCHAR', kind: 'immutable', description: '主驾司机姓名', exampleValue: "'张建国'" },
            { id: 'p-cur-location', name: 'current_coords', dataType: 'VARCHAR', kind: 'state', description: '最新 GPS 经纬度位置', exampleValue: "'119.82,39.91'" },
            { id: 'p-truck-status', name: 'truck_status', dataType: 'VARCHAR', kind: 'state', description: '车辆调度状态', exampleValue: "'EN_ROUTE'" },
          ],
        },
        {
          id: 'obj-temp-sensor',
          name: 'TempSensor',
          displayName: '温控传感器',
          description: '车厢内安装的工业级高精度物联网温湿度探头',
          isEventDriven: false,
          primaryKey: 'sensor_id',
          properties: [
            { id: 'p-sensor-id', name: 'sensor_id', dataType: 'VARCHAR', kind: 'identity', description: '传感器物理硬件 MAC / ID', exampleValue: "'SENSOR-RF-004'" },
            { id: 'p-latest-temp', name: 'latest_temp', dataType: 'DOUBLE', kind: 'state', description: '最近一次探头读数(℃)', exampleValue: '7.8' },
            { id: 'p-battery-level', name: 'battery_pct', dataType: 'INTEGER', kind: 'metric', description: '设备剩余电量百分比', exampleValue: '92' },
          ],
        },
        {
          id: 'obj-temp-incident',
          name: 'TempAlertIncident',
          displayName: '温超异常事件',
          description: '由时序连续超温触发的具有独立生命周期的异常事件容器',
          isEventDriven: true,
          primaryKey: 'incident_id',
          properties: [
            { id: 'p-inc-id', name: 'incident_id', dataType: 'VARCHAR', kind: 'identity', description: '异常事件编码', exampleValue: "'INC-2026-9041'" },
            { id: 'p-inc-time', name: 'triggered_at', dataType: 'TIMESTAMP', kind: 'immutable', description: '判定触发时间戳', exampleValue: "'2026-09-18 14:35:00'" },
            { id: 'p-peak-temp', name: 'peak_temp', dataType: 'DOUBLE', kind: 'metric', description: '事故期间记录的最高温', exampleValue: '8.2' },
            { id: 'p-severity', name: 'severity', dataType: 'VARCHAR', kind: 'state', description: '事故等级（严重/中度/预警）', exampleValue: "'CRITICAL'" },
          ],
        },
        {
          id: 'obj-claim-sheet',
          name: 'InsuranceClaim',
          displayName: '理赔单据',
          description: '货物货损发生后，面向保险公司或责任方生成的闭环索赔契约',
          isEventDriven: false,
          primaryKey: 'claim_id',
          properties: [
            { id: 'p-claim-id', name: 'claim_id', dataType: 'VARCHAR', kind: 'identity', description: '理赔单流水号', exampleValue: "'CLM-88029'" },
            { id: 'p-claimed-amount', name: 'claimed_amount', dataType: 'DOUBLE', kind: 'metric', description: '申报定损金额', exampleValue: '185000.0' },
            { id: 'p-claim-status', name: 'claim_status', dataType: 'VARCHAR', kind: 'state', description: '审核赔付状态机', exampleValue: "'APPROVED'" },
          ],
        },
      ],
      links: [
        {
          id: 'link-order-truck',
          sourceObjectId: 'obj-shipment-order',
          targetObjectId: 'obj-reefer-truck',
          predicate: 'TRANSPORTED_BY',
          cardinality: 'N:1',
          description: '运单由指定冷藏车辆在干线区间内负责运输承载',
        },
        {
          id: 'link-truck-sensor',
          sourceObjectId: 'obj-reefer-truck',
          targetObjectId: 'obj-temp-sensor',
          predicate: 'MONITORED_BY',
          cardinality: '1:N',
          description: '冷藏车箱体内布设了多个温控探头实时监视环境',
        },
        {
          id: 'link-incident-order',
          sourceObjectId: 'obj-temp-incident',
          targetObjectId: 'obj-shipment-order',
          predicate: 'AFFECTS_ORDER',
          cardinality: '1:1',
          description: '温超事故直接导致对应运单的货物品质受到严重破坏威胁',
        },
        {
          id: 'link-claim-incident',
          sourceObjectId: 'obj-claim-sheet',
          targetObjectId: 'obj-temp-incident',
          predicate: 'DERIVED_FROM_INCIDENT',
          cardinality: '1:1',
          description: '理赔单据将温超事故的不可变事实日志作为理赔唯一客观证据',
        },
      ],
      actions: [
        {
          id: 'act-dispatch-truck',
          name: 'DispatchTruck',
          displayName: '派车发运',
          targetObjectId: 'obj-shipment-order',
          actor: '调度主管',
          preconditions: "order.status == 'PAID' AND truck.truck_status == 'IDLE' AND sensor.battery_pct > 80",
          mutation: "order.status := 'IN_TRANSIT', truck.truck_status := 'EN_ROUTE'",
          auditEvent: 'EVT_DISPATCH_COMPLETED',
          description: '校验车辆与探头就绪条件，装车完毕并锁定运力，开启实时监控流。',
        },
        {
          id: 'act-report-temp-alert',
          name: 'ReportTempAlert',
          displayName: '上报温超告警',
          targetObjectId: 'obj-temp-incident',
          actor: '车载边缘网关',
          preconditions: 'sensor.latest_temp > order.max_temp_celsius FOR 15_MINUTES',
          mutation: "incident.severity := 'CRITICAL', order.status := 'ALERT_TEMPERATURE'",
          auditEvent: 'EVT_TEMPERATURE_EXCEEDED',
          description: '边缘探测连续突破安全上限，自动实例化温超事故，上浮工单到调度指挥大屏。',
        },
        {
          id: 'act-emergency-reroute',
          name: 'EmergencyReroute',
          displayName: '紧急排险改派',
          targetObjectId: 'obj-reefer-truck',
          actor: '应急指挥组',
          preconditions: "order.status == 'ALERT_TEMPERATURE' AND depot.available_capacity > 0",
          mutation: "truck.truck_status := 'DIVERTED_TO_DEPOT'",
          auditEvent: 'EVT_ROUTE_DIVERTED',
          description: '指示司机立即驶入最近冷库借冷保货，遏制损失进一步扩大。',
        },
        {
          id: 'act-approve-claim',
          name: 'ApproveClaim',
          displayName: '闭环理赔审核',
          targetObjectId: 'obj-claim-sheet',
          actor: '保险定损专家',
          preconditions: "incident.severity == 'CRITICAL' AND incident.peak_temp > 7.0",
          mutation: "claim.claim_status := 'APPROVED', order.status := 'COMPENSATED'",
          auditEvent: 'EVT_CLAIM_SETTLED',
          description: '基于全链路本体不可变证据链自动核验责任，向货主秒级划拨赔款并结案。',
        },
      ],
    },
    sampleDuckDbSql: `-- ========================================================
-- 顺达冷链 OPLA 物理层模型（DuckDB 实机运行验证）
-- ========================================================

-- 1. 创建实体对象表 (Object Types)
CREATE OR REPLACE TABLE obj_shipment_order (
  order_id VARCHAR PRIMARY KEY,
  cargo_type VARCHAR NOT NULL,
  max_temp_celsius DOUBLE NOT NULL,
  status VARCHAR NOT NULL,
  cargo_value_cny DOUBLE NOT NULL
);

CREATE OR REPLACE TABLE obj_reefer_truck (
  truck_id VARCHAR PRIMARY KEY,
  driver_name VARCHAR NOT NULL,
  current_coords VARCHAR NOT NULL,
  truck_status VARCHAR NOT NULL
);

CREATE OR REPLACE TABLE obj_temp_sensor (
  sensor_id VARCHAR PRIMARY KEY,
  latest_temp DOUBLE NOT NULL,
  battery_pct INTEGER NOT NULL
);

CREATE OR REPLACE TABLE obj_temp_incident (
  incident_id VARCHAR PRIMARY KEY,
  triggered_at TIMESTAMP NOT NULL,
  peak_temp DOUBLE NOT NULL,
  severity VARCHAR NOT NULL
);

CREATE OR REPLACE TABLE obj_insurance_claim (
  claim_id VARCHAR PRIMARY KEY,
  claimed_amount DOUBLE NOT NULL,
  claim_status VARCHAR NOT NULL
);

-- 2. 创建关系网络表 (Link Types)
CREATE OR REPLACE TABLE link_transported_by (
  order_id VARCHAR,
  truck_id VARCHAR,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id, truck_id)
);

CREATE OR REPLACE TABLE link_monitored_by (
  truck_id VARCHAR,
  sensor_id VARCHAR,
  installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (truck_id, sensor_id)
);

CREATE OR REPLACE TABLE link_incident_order (
  incident_id VARCHAR,
  order_id VARCHAR,
  PRIMARY KEY (incident_id, order_id)
);

-- 3. 创建 Action 审计与状态迁移表 (Action Audit Log)
CREATE OR REPLACE TABLE action_execution_log (
  log_id INTEGER PRIMARY KEY,
  action_name VARCHAR NOT NULL,
  actor VARCHAR NOT NULL,
  target_object_id VARCHAR NOT NULL,
  event_type VARCHAR NOT NULL,
  payload_json VARCHAR,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. 插入实战种子数据
INSERT INTO obj_shipment_order VALUES 
  ('ORD-2026-0901', '冰鲜三文鱼', 4.0, 'ALERT_TEMPERATURE', 185000.0),
  ('ORD-2026-0902', '澳洲和牛M9', 0.0, 'IN_TRANSIT', 260000.0);

INSERT INTO obj_reefer_truck VALUES 
  ('TRUCK-LN-8892', '张建国', '119.82,39.91', 'DIVERTED_TO_DEPOT'),
  ('TRUCK-BJ-3301', '李振海', '116.40,39.90', 'EN_ROUTE');

INSERT INTO obj_temp_sensor VALUES 
  ('SENSOR-RF-004', 7.8, 92),
  ('SENSOR-RF-008', -0.5, 88);

INSERT INTO obj_temp_incident VALUES 
  ('INC-2026-9041', TIMESTAMP '2026-09-18 14:35:00', 8.2, 'CRITICAL');

INSERT INTO obj_insurance_claim VALUES 
  ('CLM-88029', 185000.0, 'APPROVED');

INSERT INTO link_transported_by VALUES 
  ('ORD-2026-0901', 'TRUCK-LN-8892', CURRENT_TIMESTAMP);

INSERT INTO link_monitored_by VALUES 
  ('TRUCK-LN-8892', 'SENSOR-RF-004', CURRENT_TIMESTAMP);

INSERT INTO link_incident_order VALUES 
  ('INC-2026-9041', 'ORD-2026-0901');

INSERT INTO action_execution_log VALUES 
  (1, 'ReportTempAlert', '车载边缘网关', 'INC-2026-9041', 'EVT_TEMPERATURE_EXCEEDED', '{"peak_temp":8.2,"threshold":4.0}', CURRENT_TIMESTAMP),
  (2, 'EmergencyReroute', '应急指挥组', 'TRUCK-LN-8892', 'EVT_ROUTE_DIVERTED', '{"depot_id":"DEPOT-TS-01"}', CURRENT_TIMESTAMP),
  (3, 'ApproveClaim', '保险定损专家', 'CLM-88029', 'EVT_CLAIM_SETTLED', '{"approved_cny":185000.0}', CURRENT_TIMESTAMP);

-- 5. 跨 OPLA 语义层因果追因查询（一键验证）
SELECT 
  o.order_id,
  o.cargo_type,
  o.max_temp_celsius AS allowed_temp,
  s.latest_temp AS current_sensor_temp,
  t.driver_name,
  t.truck_status,
  inc.severity AS incident_severity,
  clm.claim_status,
  clm.claimed_amount
FROM obj_shipment_order o
JOIN link_transported_by l1 ON o.order_id = l1.order_id
JOIN obj_reefer_truck t ON l1.truck_id = t.truck_id
JOIN link_monitored_by l2 ON t.truck_id = l2.truck_id
JOIN obj_temp_sensor s ON l2.sensor_id = s.sensor_id
LEFT JOIN link_incident_order l3 ON o.order_id = l3.order_id
LEFT JOIN obj_temp_incident inc ON l3.incident_id = inc.incident_id
LEFT JOIN obj_insurance_claim clm ON o.cargo_value_cny = clm.claimed_amount;
`,
  },
  {
    id: 'case-smart-hospital',
    title: '智慧医疗：120 急救绿色通道与移动体征协同调度',
    industry: '智慧医疗 / 急救医学物联网',
    difficulty: '进阶',
    summary: '急救患者车载体征监护上云、医院抢救室床位与手术资源提前闭环锁定、绿色通道一键开辟。',
    businessBackground: `【真实业务场景描述】
急救中心接警：某心梗高危患者在家突发剧烈胸痛。
120 出车接到患者后，车载十二导联心电图探头及监护仪实时捕捉到 ST 段抬高（急性心肌梗死典型表征）。
随车急救医生需要一键触发「绿色通道建立」Action，远程锁定三甲医院导管室空闲介入机位并通知手术团队集结。
救护车在送达医院前，体征数据与就诊卡已完成虚拟预入院登记，车辆到达即可免去挂号缴费直接推入导管室溶栓开通血管。`,
    businessDilemmas: [
      '院前与院内系统断裂：急救车信息与医院 HIS/PACS 孤立，患者到院后重新排队建档，丧失黄金 90 分钟。',
      '资源静态查询无法协同：缺乏 Action 级前置条件检查与资源强制预占，经常出现救护车拉到医院发现导管室已占满。',
    ],
    referenceModel: {
      objects: [
        {
          id: 'obj-patient',
          name: 'EmergencyPatient',
          displayName: '急救患者',
          description: '具有生命危险的主体，承载唯一身份与病史',
          isEventDriven: false,
          primaryKey: 'patient_id',
          properties: [
            { id: 'p-pat-id', name: 'patient_id', dataType: 'VARCHAR', kind: 'identity', description: '患者就诊卡/身份证', exampleValue: "'PAT-2026-7781'" },
            { id: 'p-pat-name', name: 'name', dataType: 'VARCHAR', kind: 'immutable', description: '患者姓名', exampleValue: "'陈爱华'" },
            { id: 'p-heart-rate', name: 'latest_heart_rate', dataType: 'INTEGER', kind: 'state', description: '实时心率 (BPM)', exampleValue: '128' },
            { id: 'p-vital-status', name: 'vital_status', dataType: 'VARCHAR', kind: 'state', description: '生命体征危急等级', exampleValue: "'CRITICAL_STEMI'" },
          ],
        },
        {
          id: 'obj-ambulance',
          name: 'AmbulanceUnit',
          displayName: '急救单元',
          description: '具备抢救机动能力的救护车物理载体',
          isEventDriven: false,
          primaryKey: 'ambulance_id',
          properties: [
            { id: 'p-amb-id', name: 'ambulance_id', dataType: 'VARCHAR', kind: 'identity', description: '急救车牌号', exampleValue: "'AMB-08'" },
            { id: 'p-eta-minutes', name: 'eta_to_hospital_mins', dataType: 'INTEGER', kind: 'metric', description: '预计到院剩余分钟数', exampleValue: '14' },
          ],
        },
        {
          id: 'obj-cath-lab',
          name: 'CathLabRoom',
          displayName: '介入导管室',
          description: '医院执行急诊介入心脏手术的核心医疗硬件空间',
          isEventDriven: false,
          primaryKey: 'room_id',
          properties: [
            { id: 'p-room-id', name: 'room_id', dataType: 'VARCHAR', kind: 'identity', description: '导管室编号', exampleValue: "'CATH-ROOM-02'" },
            { id: 'p-room-status', name: 'status', dataType: 'VARCHAR', kind: 'state', description: '机位状态(空闲/预占/手术中)', exampleValue: "'RESERVED'" },
          ],
        },
      ],
      links: [
        {
          id: 'link-patient-amb',
          sourceObjectId: 'obj-patient',
          targetObjectId: 'obj-ambulance',
          predicate: 'CARRIED_BY',
          cardinality: '1:1',
          description: '患者处于指定急救车的严密监护与转运中',
        },
        {
          id: 'link-amb-cath',
          sourceObjectId: 'obj-ambulance',
          targetObjectId: 'obj-cath-lab',
          predicate: 'DESTINATION_RESERVED',
          cardinality: '1:1',
          description: '急救车提前与目标医院导管室建立业务通道',
        },
      ],
      actions: [
        {
          id: 'act-activate-green-channel',
          name: 'ActivateGreenChannel',
          displayName: '激活胸痛绿色通道',
          targetObjectId: 'obj-cath-lab',
          actor: '随车急救主治医',
          preconditions: "patient.vital_status == 'CRITICAL_STEMI' AND cathLab.status == 'IDLE'",
          mutation: "cathLab.status := 'RESERVED', patient.vital_status := 'PRE_ADMITTED'",
          auditEvent: 'EVT_GREEN_CHANNEL_ACTIVATED',
          description: '确认危重急症，强行将医院导管室置为预占并呼叫二线手术班就位。',
        },
      ],
    },
    sampleDuckDbSql: `-- 智慧医疗 DuckDB 验证
CREATE OR REPLACE TABLE obj_patient (patient_id VARCHAR PRIMARY KEY, name VARCHAR, latest_heart_rate INTEGER, vital_status VARCHAR);
CREATE OR REPLACE TABLE obj_ambulance (ambulance_id VARCHAR PRIMARY KEY, eta_to_hospital_mins INTEGER);
CREATE OR REPLACE TABLE obj_cath_lab (room_id VARCHAR PRIMARY KEY, status VARCHAR);

INSERT INTO obj_patient VALUES ('PAT-2026-7781', '陈爱华', 128, 'CRITICAL_STEMI');
INSERT INTO obj_ambulance VALUES ('AMB-08', 14);
INSERT INTO obj_cath_lab VALUES ('CATH-ROOM-02', 'RESERVED');

SELECT p.name, p.vital_status, a.eta_to_hospital_mins, c.status AS room_status
FROM obj_patient p, obj_ambulance a, obj_cath_lab c;
`,
  },
];

/**
 * 动态编译 OPLA 业务模型为标准 DuckDB DDL & DML 验证脚本
 */
export function compileDuckDbSql(caseData: ModelingCase): string {
  const { objects, links, actions } = caseData.referenceModel;
  if (objects.length === 0) return '-- 暂无 Object 实体，请先添加实体';

  let sql = `-- ========================================================\n`;
  sql += `-- 自动生成：${caseData.title} 物理层模型\n`;
  sql += `-- 生成时间：${new Date().toISOString()}\n`;
  sql += `-- ========================================================\n\n`;

  const toSnake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().replace(/[^a-z0-9_]/g, '_');

  // 1. DDL Object Tables
  sql += `-- 1. 实体对象表 (Object Types)\n`;
  objects.forEach(obj => {
    const tableName = `obj_${toSnake(obj.name)}`;
    sql += `CREATE OR REPLACE TABLE ${tableName} (\n`;
    const colDefs: string[] = [];
    
    // 优先放主键
    const pkProp = obj.properties.find(p => p.name === obj.primaryKey) || {
      name: obj.primaryKey || 'id',
      dataType: 'VARCHAR',
      kind: 'identity',
    };
    colDefs.push(`  ${pkProp.name} ${pkProp.dataType || 'VARCHAR'} PRIMARY KEY`);

    obj.properties
      .filter(p => p.name !== pkProp.name)
      .forEach(p => {
        colDefs.push(`  ${p.name} ${p.dataType || 'VARCHAR'}`);
      });

    sql += colDefs.join(',\n') + '\n);\n\n';
  });

  // 2. DDL Link Tables
  if (links.length > 0) {
    sql += `-- 2. 关系拓扑表 (Link Types)\n`;
    links.forEach(l => {
      const linkTableName = `link_${l.predicate.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const srcObj = objects.find(o => o.id === l.sourceObjectId);
      const tgtObj = objects.find(o => o.id === l.targetObjectId);
      const srcCol = srcObj ? `${srcObj.primaryKey || 'src_id'}` : 'src_id';
      const tgtCol = tgtObj ? `${tgtObj.primaryKey || 'tgt_id'}` : 'tgt_id';

      sql += `CREATE OR REPLACE TABLE ${linkTableName} (\n`;
      sql += `  ${srcCol} VARCHAR,\n`;
      sql += `  ${tgtCol} VARCHAR,\n`;
      sql += `  linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
      sql += `);\n\n`;
    });
  }

  // 3. Action Log Table
  sql += `-- 3. Action 业务执行审计表 (Action Audit Log)\n`;
  sql += `CREATE OR REPLACE TABLE action_execution_log (\n`;
  sql += `  log_id INTEGER PRIMARY KEY,\n`;
  sql += `  action_name VARCHAR NOT NULL,\n`;
  sql += `  actor VARCHAR NOT NULL,\n`;
  sql += `  target_object_id VARCHAR NOT NULL,\n`;
  sql += `  event_type VARCHAR NOT NULL,\n`;
  sql += `  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
  sql += `);\n\n`;

  // 4. Sample Seed Data
  sql += `-- 4. 插入示例种子数据\n`;
  objects.forEach(obj => {
    const tableName = `obj_${toSnake(obj.name)}`;
    const sampleCols: string[] = [];
    const sampleVals: string[] = [];

    obj.properties.forEach(p => {
      sampleCols.push(p.name);
      sampleVals.push(p.exampleValue || (p.dataType === 'INTEGER' ? '1' : p.dataType === 'DOUBLE' ? '0.0' : `'demo'`));
    });

    if (sampleCols.length > 0) {
      sql += `INSERT INTO ${tableName} (${sampleCols.join(', ')}) VALUES (${sampleVals.join(', ')});\n`;
    }
  });

  // 5. Verification Query
  if (objects.length > 0) {
    const primaryObj = objects[0];
    const primaryTable = `obj_${toSnake(primaryObj.name)}`;
    sql += `\n-- 5. 跨 OPLA 语义层因果追因查询（一键验证）\n`;
    sql += `SELECT * FROM ${primaryTable} LIMIT 10;\n`;
  }

  return sql;
}

/**
 * 实时架构合规性审计计算器
 */
export function computeAuditReport(caseData: ModelingCase) {
  const { objects, links, actions } = caseData.referenceModel;
  const issues: { type: 'error' | 'warning' | 'info'; message: string }[] = [];
  let score = 100;

  if (objects.length < 2) {
    issues.push({ type: 'error', message: '实体数量不足：至少需要 2 个核心 Object 才能构建网络。' });
    score -= 30;
  }

  const missingPk = objects.filter(o => !o.primaryKey || o.primaryKey.trim() === '');
  if (missingPk.length > 0) {
    issues.push({ type: 'error', message: `存在未定义主键的实体：${missingPk.map(o => o.displayName || o.name).join(', ')}。` });
    score -= 20;
  }

  const connectedObjectIds = new Set<string>();
  links.forEach(l => {
    connectedObjectIds.add(l.sourceObjectId);
    connectedObjectIds.add(l.targetObjectId);
  });
  const orphans = objects.filter(o => !connectedObjectIds.has(o.id));
  if (orphans.length > 0 && objects.length > 1) {
    issues.push({ type: 'warning', message: `发现孤岛实体（未建立 Link 连接）：${orphans.map(o => o.displayName || o.name).join(', ')}。` });
    score -= 15;
  }

  const emptyProps = objects.filter(o => o.properties.length === 0);
  if (emptyProps.length > 0) {
    issues.push({ type: 'warning', message: `实体缺少属性描述：${emptyProps.map(o => o.displayName || o.name).join(', ')}。` });
    score -= 15;
  }

  const invalidLinks = links.filter(l => !l.predicate || l.predicate.trim() === '' || l.predicate.toLowerCase() === 'related_to');
  if (invalidLinks.length > 0) {
    issues.push({ type: 'warning', message: '发现弱语义谓词：请使用具体业务动词，避免使用模糊的 RELATED_TO。' });
    score -= 10;
  }

  if (actions.length === 0) {
    issues.push({ type: 'error', message: '缺少 Action 闭环：必须至少定义 1 个驱动状态迁移的 Action。' });
    score -= 20;
  }

  const finalScore = Math.max(0, Math.min(100, score));
  return {
    score: finalScore,
    isPassing: finalScore >= 80,
    issues,
  };
}

