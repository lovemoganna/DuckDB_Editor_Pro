/**
 * useOntologyLessons - 本体建模课程专用 Hook
 * 
 * 职责：
 * 1. 管理本体课程元数据的加载和缓存
 * 2. 追踪每个课程的学习进度（按阶段分类）
 * 3. 提供课程完成状态和阶段进度统计
 * 4. 支持课程内容的懒加载
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { TutorialMetadata, TutorialSection } from '../data/tutorials';

// ============================================================
// 阶段配置 (MECE 分类)
// ============================================================
export type OntologyStage = 'recognition' | 'topology' | 'assembly' | 'evolution';

export interface StageConfig {
  id: OntologyStage;
  label: string;
  labelEn: string;
  description: string;
  icon: string;
  color: string;
  colorVar: string;
  lessonRange: [number, number]; // 课程编号范围 [start, end]
}

export const ONTOLOGY_STAGE_LABELS: Record<OntologyStage, string> = {
  recognition: '阶段一：识别与边界',
  topology: '阶段二：拓扑与变迁',
  assembly: '阶段三：组装与验证',
  evolution: '阶段四：演进与证据',
};

export const ONTOLOGY_STAGES: StageConfig[] = [
  {
    id: 'recognition',
    label: '识别与边界',
    labelEn: 'Recognition & Boundaries',
    description: '严辨现实证据与主观臆测，划清 Object 与 Property 身份边界，显式建模未知',
    icon: '🔍',
    color: 'cyan',
    colorVar: '--monokai-cyan',
    lessonRange: [1, 3],
  },
  {
    id: 'topology',
    label: '拓扑与变迁',
    labelEn: 'Topology & Transitions',
    description: '建立有向有谓词的关系网络 Link，以不可变事件流精确捕获状态变迁与因果传导',
    icon: '🕸️',
    color: 'blue',
    colorVar: '--monokai-blue',
    lessonRange: [4, 7],
  },
  {
    id: 'assembly',
    label: '组装与验证',
    labelEn: 'Assembly & Verification',
    description: '打破多源烟囱实现实体对齐，解耦实时派生指标与物理硬约束，打通双向 Action 闭环',
    icon: '🧩',
    color: 'green',
    colorVar: '--monokai-green',
    lessonRange: [8, 11],
  },
  {
    id: 'evolution',
    label: '演进与证据',
    labelEn: 'Evolution & Evidence',
    description: '面向生产平滑演进 Schema，在不确定性中推进假设分支，构建端到端决策溯源证据链',
    icon: '🔮',
    color: 'yellow',
    colorVar: '--monokai-yellow',
    lessonRange: [12, 14],
  },
];

// ============================================================
// 课程元数据
// ============================================================
export interface OntologyLesson {
  id: string;
  number: number; // 课程编号 1-14
  title: string;
  titleEn: string;
  stage: OntologyStage;
  difficulty: 'foundation' | 'intermediate' | 'advanced';
  estimatedTime: string;
  prerequisites: string[];
  sections: TutorialSection[];
  seedDataPath?: string; // 对应的 seed JSON 路径
  coreConcept?: string;
  caseBackground?: string;
  description?: string;
  isCompleted: boolean;
  isStarted: boolean;
  progress: number; // 0-1
  lastAccessedAt?: string;
  completedAt?: string;
}

// 预载全部 14 门本体实战课程 seed JSON
const seedJsonModules = import.meta.glob('../data/ontology/seed-lesson-*.json', { eager: true }) as Record<string, any>;

/**
 * 同步获取本体实战课程对应的 Seed 数据对象（零网络请求、零 404）
 */
export const getSeedDataForLesson = (lessonNumberOrId: number | string): any => {
  let num: number;
  if (typeof lessonNumberOrId === 'number') {
    num = lessonNumberOrId;
  } else {
    const matched = String(lessonNumberOrId).match(/\d+/);
    num = matched ? parseInt(matched[0], 10) : 1;
  }
  const padded = String(num).padStart(4, '0');

  for (const [key, module] of Object.entries(seedJsonModules)) {
    if (key.includes(`seed-lesson-${padded}.json`)) {
      return module.default || module;
    }
  }
  return null;
};

// 14课完整元数据定义 - 与底层 14 份真实 seed-lesson-*.json 严格对齐
export const ONTOLOGY_LESSONS_DATA: Omit<OntologyLesson, 'isCompleted' | 'isStarted' | 'progress' | 'lastAccessedAt' | 'completedAt'>[] = [
  // Stage 1: 识别与边界 (Lessons 1-3)
  {
    id: 'ontology-lesson-0001',
    number: 1,
    title: '只写材料真正告诉你的事',
    titleEn: 'Write Only What Materials Tell You',
    stage: 'recognition',
    difficulty: 'foundation',
    estimatedTime: '30分钟',
    coreConcept: 'Fact vs Inference vs Unknown',
    description: '严格区分确凿事实、推断与未知边界，严禁常识脑补，只记录直接证据',
    caseBackground: '【案例背景材料】中午，妈妈在家做了一道茄子。我去餐馆买了两道菜，回家后，我们三个人一起吃饭。',
    prerequisites: [],
    sections: [
      { id: 'case-analysis', title: '案例背景与直接材料', anchor: 'case-analysis' },
      { id: 'fact-vs-inference', title: '确凿事实 vs 推断 vs 未知边界', anchor: 'fact-vs-inference' },
      { id: 'object-topology', title: '实体识别与拓扑结构', anchor: 'object-topology' },
      { id: 'interactive-graph', title: '本体图谱交互推演', anchor: 'interactive-graph' },
      { id: 'introspections', title: '自省检验与反向提问', anchor: 'introspections' },
    ],
    seedDataPath: 'data/ontology/seed-lesson-0001.json',
  },
  {
    id: 'ontology-lesson-0002',
    number: 2,
    title: '找出需要保持身份的对象',
    titleEn: 'Identify Objects with Persistent Identity',
    stage: 'recognition',
    difficulty: 'foundation',
    estimatedTime: '35分钟',
    coreConcept: 'Entity Identity & Instance Tracking',
    description: '识别具备独立连续唯一 Identity 的实体，区分对象身份与易变数值属性',
    caseBackground: '【案例背景材料】上午，小林进入仓库1。管理员周姐把包裹B交给小林。随后，小林离开仓库。',
    prerequisites: ['ontology-lesson-0001'],
    sections: [
      { id: 'case-analysis', title: '仓储物流交接背景', anchor: 'case-analysis' },
      { id: 'identity-principles', title: '身份实体 (Identity) vs 易变属性', anchor: 'identity-principles' },
      { id: 'object-topology', title: '交接过程与主体建模', anchor: 'object-topology' },
      { id: 'interactive-graph', title: '包裹流转本体图谱', anchor: 'interactive-graph' },
      { id: 'introspections', title: '主键存续性自省检验', anchor: 'introspections' },
    ],
    seedDataPath: 'data/ontology/seed-lesson-0002.json',
  },
  {
    id: 'ontology-lesson-0003',
    number: 3,
    title: '找出发生了什么过程',
    titleEn: 'Identify Process Objects & State Machines',
    stage: 'recognition',
    difficulty: 'intermediate',
    estimatedTime: '40分钟',
    coreConcept: 'Process Object & State Machine',
    description: '识别包含时间起止与状态机跃迁的动态过程事件，作为连接多实体的拓扑中枢',
    caseBackground: '【案例背景材料】采购员李四在周一发起服务器设备采购流程，经历供应商比价与物资入库验收。',
    prerequisites: ['ontology-lesson-0002'],
    sections: [
      { id: 'case-analysis', title: '采购业务事件背景', anchor: 'case-analysis' },
      { id: 'process-concepts', title: '过程对象 (Process Object) 的时间边界', anchor: 'process-concepts' },
      { id: 'state-machine', title: '状态机跃迁与拓扑中枢', anchor: 'state-machine' },
      { id: 'interactive-graph', title: '采购流程交互画布', anchor: 'interactive-graph' },
      { id: 'introspections', title: '过程完整性探针', anchor: 'introspections' },
    ],
    seedDataPath: 'data/ontology/seed-lesson-0003.json',
  },
  // Stage 2: 拓扑与变迁 (Lessons 4-7)
  {
    id: 'ontology-lesson-0004',
    number: 4,
    title: '把对象连接到过程',
    titleEn: 'Connect Objects to Processes',
    stage: 'topology',
    difficulty: 'foundation',
    estimatedTime: '45分钟',
    coreConcept: 'Topology & Role Semantic',
    description: '一次聚焦一个核心过程，把材料中明确涉及的对象汇聚连接，形成初具形态的关联拓扑',
    caseBackground: '【案例背景材料】合规专家王五接入采购框架协议审批流，审查并签署了《年度采购框架协议.pdf》。',
    prerequisites: ['ontology-lesson-0003'],
    sections: [
      { id: 'case-analysis', title: '合规审查协议审批背景', anchor: 'case-analysis' },
      { id: 'process-binding', title: '对象向过程的汇聚连接', anchor: 'process-binding' },
      { id: 'link-structure', title: '初级关联拓扑的生成', anchor: 'link-structure' },
      { id: 'interactive-graph', title: '审批拓扑网络推演', anchor: 'interactive-graph' },
      { id: 'introspections', title: '单过程连接自洽性探针', anchor: 'introspections' },
    ],
    seedDataPath: 'data/ontology/seed-lesson-0004.json',
  },
  {
    id: 'ontology-lesson-0005',
    number: 5,
    title: '为过程中的角色命名',
    titleEn: 'Qualify Roles in Link Semantics',
    stage: 'topology',
    difficulty: 'intermediate',
    estimatedTime: '45分钟',
    coreConcept: 'Link Role Qualification',
    description: '在连接线上明确标出对象在过程中扮演的业务角色，赋予连线精确的业务语义',
    caseBackground: '【案例背景材料】买方小张与卖方老李在二手车交易平台上达成协议，通过资金托管中间方进行车辆权属转让。',
    prerequisites: ['ontology-lesson-0004'],
    sections: [
      { id: 'case-analysis', title: '三方二手车交易材料', anchor: 'case-analysis' },
      { id: 'role-qualification', title: '连接角色 (Role) 与语义赋能', anchor: 'role-qualification' },
      { id: 'qualified-links', title: '区分买方、卖方与托管方', anchor: 'qualified-links' },
      { id: 'interactive-graph', title: '多角色交易拓扑图谱', anchor: 'interactive-graph' },
      { id: 'introspections', title: '角色语义无歧义检验', anchor: 'introspections' },
    ],
    seedDataPath: 'data/ontology/seed-lesson-0005.json',
  },
  {
    id: 'ontology-lesson-0006',
    number: 6,
    title: '记录状态的改变',
    titleEn: 'Record State Transitions & Event Writeback',
    stage: 'topology',
    difficulty: 'intermediate',
    estimatedTime: '50分钟',
    coreConcept: 'State Transition & Event Writeback',
    description: '跟踪过程触发的对象状态变迁，显式刻画初始状态向目标状态的跃迁流转',
    caseBackground: '【案例背景材料】顾客针对订单 ORD-2026 完成了微信扫码支付，触发支付成功事件，订单状态跃迁为已支付待履约。',
    prerequisites: ['ontology-lesson-0005'],
    sections: [
      { id: 'case-analysis', title: '扫码支付履约事件剖析', anchor: 'case-analysis' },
      { id: 'transition-rules', title: '状态跃迁规律与前置条件', anchor: 'transition-rules' },
      { id: 'event-writeback', title: '双向行动回写机制', anchor: 'event-writeback' },
      { id: 'interactive-graph', title: '订单流转状态图谱', anchor: 'interactive-graph' },
      { id: 'introspections', title: '状态机死锁与合法性检测', anchor: 'introspections' },
    ],
    seedDataPath: 'data/ontology/seed-lesson-0006.json',
  },
  {
    id: 'ontology-lesson-0007',
    number: 7,
    title: '写出对象之间的直接关系',
    titleEn: 'Model Direct Bi-directional Links',
    stage: 'topology',
    difficulty: 'intermediate',
    estimatedTime: '45分钟',
    coreConcept: 'Bi-directional Link Traversal',
    description: '表达不依赖特定过程的静态结构关系，严格注意有向性与层级继承',
    caseBackground: '【案例背景材料】前端工程师小赵隶属于 UI/UX 架构研发部，负责推进 Ontology 内核重构项目，形成清晰拓扑结构。',
    prerequisites: ['ontology-lesson-0006'],
    sections: [
      { id: 'case-analysis', title: '组织架构与团队隶属材料', anchor: 'case-analysis' },
      { id: 'direct-links', title: '静态关系 vs 动态过程关系', anchor: 'direct-links' },
      { id: 'traversal-semantics', title: '双向遍历与有向层级继承', anchor: 'traversal-semantics' },
      { id: 'interactive-graph', title: '组织拓扑网络图谱', anchor: 'interactive-graph' },
      { id: 'introspections', title: '关系依赖环与孤岛检验', anchor: 'introspections' },
    ],
    seedDataPath: 'data/ontology/seed-lesson-0007.json',
  },
  // Stage 3: 组装与验证 (Lessons 8-11)
  {
    id: 'ontology-lesson-0008',
    number: 8,
    title: '组装一个最小本体模型',
    titleEn: 'Assemble a Minimal Viable Ontology (MVO)',
    stage: 'assembly',
    difficulty: 'foundation',
    estimatedTime: '50分钟',
    coreConcept: 'Minimal Viable Enterprise Ontology (MVO)',
    description: '合并已验证的对象、过程、角色、状态和关系，消除冗余，构建最小可行自洽模型',
    caseBackground: '【案例背景材料】VIP 客户 Alice 在商城下单购买人体工学椅 ErgoX，系统派发顺丰特快运单 SF-9920 进行物流履约，形成闭环。',
    prerequisites: ['ontology-lesson-0007'],
    sections: [
      { id: 'case-analysis', title: '端到端电商闭环材料', anchor: 'case-analysis' },
      { id: 'mvo-principles', title: '最小可行本体 (MVO) 组装原则', anchor: 'mvo-principles' },
      { id: 'redundancy-elimination', title: '去冗余与模型对齐', anchor: 'redundancy-elimination' },
      { id: 'interactive-graph', title: 'MVO 完整运行画布', anchor: 'interactive-graph' },
      { id: 'introspections', title: '端到端一致性校验', anchor: 'introspections' },
    ],
    seedDataPath: 'data/ontology/seed-lesson-0008.json',
  },
  {
    id: 'ontology-lesson-0009',
    number: 9,
    title: '用问题检验模型',
    titleEn: 'Test Models with Introspection Probes',
    stage: 'assembly',
    difficulty: 'intermediate',
    estimatedTime: '55分钟',
    coreConcept: 'Introspection Probe & Lineage Completeness',
    description: '提出业务反向问题，检验模型链路自洽性与全流程因果血缘追溯能力',
    caseBackground: '【案例背景材料】凌晨 02:15，SRE 运维工程师张博执行生产 DB 内存上限调整事件，将 DuckDB 的 max_memory 从 16GB 调整为 32GB。',
    prerequisites: ['ontology-lesson-0008'],
    sections: [
      { id: 'case-analysis', title: '生产运维变更事故背景', anchor: 'case-analysis' },
      { id: 'reverse-probing', title: '反向业务提问设计方法', anchor: 'reverse-probing' },
      { id: 'lineage-tracing', title: '因果追溯与全流程血缘验证', anchor: 'lineage-tracing' },
      { id: 'interactive-graph', title: 'SRE 变更拓扑画布', anchor: 'interactive-graph' },
      { id: 'introspections', title: '反脆弱性与自洽性探针', anchor: 'introspections' },
    ],
    seedDataPath: 'data/ontology/seed-lesson-0009.json',
  },
  {
    id: 'ontology-lesson-0010',
    number: 10,
    title: '把模型用到新案例',
    titleEn: 'Apply Models to New Scenarios (Interface & Polymorphism)',
    stage: 'assembly',
    difficulty: 'advanced',
    estimatedTime: '60分钟',
    coreConcept: 'Object Interface & Polymorphic Pattern',
    description: '面向通用接口 (Interface) 多态复用模型，将已验证模式快速迁移到异构新业务场景',
    caseBackground: '【案例背景材料】AI 独角兽企业客户 B 采购了 H100 云算力集群月度订阅，平台为其自动绑定并分配了 GPU 计算节点 Cluster#04。',
    prerequisites: ['ontology-lesson-0009'],
    sections: [
      { id: 'case-analysis', title: '异构算力订阅场景分析', anchor: 'case-analysis' },
      { id: 'interface-abstraction', title: '对象接口 (Interface) 与抽象层设计', anchor: 'interface-abstraction' },
      { id: 'polymorphism', title: '多态复用与跨领域模型迁移', anchor: 'polymorphism' },
      { id: 'interactive-graph', title: '算力服务多态拓扑图', anchor: 'interactive-graph' },
      { id: 'introspections', title: '接口契约合规性检测', anchor: 'introspections' },
    ],
    seedDataPath: 'data/ontology/seed-lesson-0010.json',
  },
  {
    id: 'ontology-lesson-0011',
    number: 11,
    title: '独立完成可验证模型',
    titleEn: 'Build End-to-End Auditable Decisioning Model',
    stage: 'assembly',
    difficulty: 'advanced',
    estimatedTime: '60分钟',
    coreConcept: 'Auditable Credit Decisioning',
    description: '端到端独立构建包含客户、单据、审批流、评分卡与授信账户的自动化风控闭环',
    caseBackground: '【案例背景材料】借款人赵六提交个人消费贷款申请，智能风控审批流 V4.2 自动运行信用分评估，为赵六开设 ￥50,000 消费授信账户。',
    prerequisites: ['ontology-lesson-0010'],
    sections: [
      { id: 'case-analysis', title: '自动化信贷审批全流程材料', anchor: 'case-analysis' },
      { id: 'credit-architecture', title: '决策链、风控评分卡与账户建模', anchor: 'credit-architecture' },
      { id: 'auditable-loops', title: '可审计自动化决策闭环', anchor: 'auditable-loops' },
      { id: 'interactive-graph', title: '信贷风控决策拓扑图谱', anchor: 'interactive-graph' },
      { id: 'introspections', title: '决策因果链路合规审计', anchor: 'introspections' },
    ],
    seedDataPath: 'data/ontology/seed-lesson-0011.json',
  },
  // Stage 4: 演进与证据 (Lessons 12-14)
  {
    id: 'ontology-lesson-0012',
    number: 12,
    title: '用新事实更新模型',
    titleEn: 'Update Models with Incremental Facts',
    stage: 'evolution',
    difficulty: 'intermediate',
    estimatedTime: '55分钟',
    coreConcept: 'Incremental Fact & Dynamic Risk Evolution',
    description: '面对业务增量新事实，保持既有模型主线不变，以增量子图形式平滑挂载演进',
    caseBackground: '【案例背景材料】客户账户 C-901 突发境外异地登录事件，反欺诈风控引擎实时捕获增量事实，平滑挂载 Level3 高危防盗标记。',
    prerequisites: ['ontology-lesson-0011'],
    sections: [
      { id: 'case-analysis', title: '突发高危异地登录材料', anchor: 'case-analysis' },
      { id: 'incremental-subgraph', title: '增量子图挂载设计范式', anchor: 'incremental-subgraph' },
      { id: 'dynamic-evolution', title: '模型主干保真与动态风险演进', anchor: 'dynamic-evolution' },
      { id: 'interactive-graph', title: '增量事实演进拓扑图', anchor: 'interactive-graph' },
      { id: 'introspections', title: '模型演进回滚与演进测试', anchor: 'introspections' },
    ],
    seedDataPath: 'data/ontology/seed-lesson-0012.json',
  },
  {
    id: 'ontology-lesson-0013',
    number: 13,
    title: '处理相互冲突的材料',
    titleEn: 'Resolve Conflicting Sources & Weight Arbitration',
    stage: 'evolution',
    difficulty: 'advanced',
    estimatedTime: '60分钟',
    coreConcept: 'Conflict Resolution & Weight Arbitration',
    description: '多来源矛盾事实不强行二选一，通过双信源节点与置信度解耦呈现并由仲裁器裁决',
    caseBackground: '【案例背景材料】供应商 X 科技公司在自报财报中声称净利润增长 20%，但第三方数据源接入法院公开执行公告，显示其存在被执行案款 ￥1,500 万。',
    prerequisites: ['ontology-lesson-0012'],
    sections: [
      { id: 'case-analysis', title: '双信源矛盾材料深度对比', anchor: 'case-analysis' },
      { id: 'conflict-decoupling', title: '矛盾事实解耦与证据置信度标定', anchor: 'conflict-decoupling' },
      { id: 'arbitration-engine', title: '仲裁器规则设计与裁决节点', anchor: 'arbitration-engine' },
      { id: 'interactive-graph', title: '双信源冲突裁决拓扑图', anchor: 'interactive-graph' },
      { id: 'introspections', title: '置信度冲突裁决自洽性探针', anchor: 'introspections' },
    ],
    seedDataPath: 'data/ontology/seed-lesson-0013.json',
  },
  {
    id: 'ontology-lesson-0014',
    number: 14,
    title: '让模型结论回到证据',
    titleEn: 'Trace Claims Back to Direct Evidence',
    stage: 'evolution',
    difficulty: 'advanced',
    estimatedTime: '70分钟',
    coreConcept: 'Claims to Evidence Lineage',
    description: '为关键业务结论绑定当前有效且不可动摇的原文证据，保证全流程可追溯',
    caseBackground: '【案例背景材料】原记录：陈工在实验室1检测样品S。主管更正单：实际检测人是王工，陈工为录入错误。确认记录：刘工在实验室1复核样品S，复核后标记为合格。未确认消息：复核地点可能是实验室2；结果可能是不合格。',
    prerequisites: ['ontology-lesson-0013'],
    sections: [
      { id: 'case-analysis', title: '实验室复杂纠错流转材料', anchor: 'case-analysis' },
      { id: 'claims-lineage', title: '从结论 (Claim) 到直接证据链 (Evidence)', anchor: 'claims-lineage' },
      { id: 'tamper-proof', title: '不可动摇证据绑定与失效应对', anchor: 'tamper-proof' },
      { id: 'interactive-graph', title: '证据回溯全景拓扑图', anchor: 'interactive-graph' },
      { id: 'introspections', title: '全链路证据可信度审计', anchor: 'introspections' },
    ],
    seedDataPath: 'data/ontology/seed-lesson-0014.json',
  },
];

// ============================================================
// Storage Keys
// ============================================================
const ONTOLOGY_PROGRESS_KEY = 'duckdb_ontology_progress';
const ONTOLOGY_SETTINGS_KEY = 'duckdb_ontology_settings';

interface OntologyProgress {
  [lessonId: string]: {
    startedAt?: string;
    completedAt?: string;
    completedSections: string[];
    totalSections: number;
    lastAccessedAt?: string;
  };
}

interface OntologySettings {
  showCompletedLessons: boolean;
  autoExpandCurrentStage: boolean;
  enableSoundEffects: boolean;
}

// ============================================================
// Hook 实现
// ============================================================
export interface UseOntologyLessonsReturn {
  // 数据
  lessons: OntologyLesson[];
  lessonsByStage: Record<OntologyStage, OntologyLesson[]>;
  currentLesson: OntologyLesson | null;
  
  // 进度统计
  overallProgress: number; // 0-1
  stageProgress: Record<OntologyStage, number>;
  completedCount: number;
  inProgressCount: number;
  
  // 图谱统计 (来自实际数据)
  graphStats: {
    entities: number;
    relations: number;
    concepts: number;
  };
  
  // 操作方法
  selectLesson: (lessonId: string) => void;
  markSectionComplete: (lessonId: string, sectionId: string) => void;
  markLessonComplete: (lessonId: string) => void;
  resetLessonProgress: (lessonId: string) => void;
  resetAllProgress: () => void;
  
  // 兼容方法 (用于 OntologyLearnViewer)
  getLesson: (lessonId: string) => OntologyLesson | null;
  loadLessonData: (lessonId: string) => Promise<any>;
  
  // 状态
  isLoading: boolean;
  error: string | null;
}

export function useOntologyLessons(): UseOntologyLessonsReturn {
  const [progress, setProgress] = useState<OntologyProgress>({});
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphStats, setGraphStats] = useState({ entities: 0, relations: 0, concepts: 0 });

  // 加载进度
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ONTOLOGY_PROGRESS_KEY);
      if (saved) {
        setProgress(JSON.parse(saved));
      }
    } catch (e) {
      console.error('[useOntologyLessons] Failed to load progress:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 从 seed 文件计算图谱统计 (直接同步读取预载内存数据，零网络延迟)
  useEffect(() => {
    let totalEntities = 0;
    let totalRelations = 0;
    let totalConcepts = 0;

    for (const lesson of ONTOLOGY_LESSONS_DATA) {
      const lessonProgress = progress[lesson.id];
      if (lessonProgress?.completedAt) {
        const data = getSeedDataForLesson(lesson.number);
        if (data) {
          totalEntities += (data.objects?.length || 0);
          totalRelations += (data.links?.length || 0);
          totalConcepts += (data.objectTypes?.length || 0);
        }
      }
    }

    setGraphStats({
      entities: totalEntities,
      relations: totalRelations,
      concepts: totalConcepts,
    });
  }, [progress]);

  // 保存进度
  const saveProgress = useCallback((newProgress: OntologyProgress) => {
    try {
      localStorage.setItem(ONTOLOGY_PROGRESS_KEY, JSON.stringify(newProgress));
    } catch (e) {
      console.error('[useOntologyLessons] Failed to save progress:', e);
    }
  }, []);

  // 选择课程
  const selectLesson = useCallback((lessonId: string) => {
    setCurrentLessonId(lessonId);
    
    // 更新最后访问时间
    setProgress(prev => {
      const lessonProgress = prev[lessonId] || {
        completedSections: [],
        totalSections: ONTOLOGY_LESSONS_DATA.find(l => l.id === lessonId)?.sections.length || 0,
      };
      
      const updated = {
        ...prev,
        [lessonId]: {
          ...lessonProgress,
          startedAt: lessonProgress.startedAt || new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
        },
      };
      
      saveProgress(updated);
      return updated;
    });
  }, [saveProgress]);

  // 标记章节完成
  const markSectionComplete = useCallback((lessonId: string, sectionId: string) => {
    setProgress(prev => {
      const lessonProgress = prev[lessonId] || {
        completedSections: [],
        totalSections: ONTOLOGY_LESSONS_DATA.find(l => l.id === lessonId)?.sections.length || 0,
      };
      
      if (lessonProgress.completedSections.includes(sectionId)) {
        return prev; // 已完成，不重复处理
      }
      
      const updated = {
        ...prev,
        [lessonId]: {
          ...lessonProgress,
          completedSections: [...lessonProgress.completedSections, sectionId],
        },
      };
      
      saveProgress(updated);
      return updated;
    });
  }, [saveProgress]);

  // 标记课程完成
  const markLessonComplete = useCallback((lessonId: string) => {
    const lesson = ONTOLOGY_LESSONS_DATA.find(l => l.id === lessonId);
    if (!lesson) return;

    setProgress(prev => {
      const lessonProgress = prev[lessonId] || {
        completedSections: [],
        totalSections: lesson.sections.length,
      };
      
      // 确保所有章节都标记为完成
      const allSectionsComplete = lesson.sections.every(
        s => lessonProgress.completedSections.includes(s.id)
      );
      
      if (!allSectionsComplete) {
        // 自动标记所有章节为完成
        const updated = {
          ...prev,
          [lessonId]: {
            ...lessonProgress,
            completedSections: lesson.sections.map(s => s.id),
            completedAt: new Date().toISOString(),
          },
        };
        saveProgress(updated);
        return updated;
      }
      
      const updated = {
        ...prev,
        [lessonId]: {
          ...lessonProgress,
          completedAt: lessonProgress.completedAt || new Date().toISOString(),
        },
      };
      
      saveProgress(updated);
      return updated;
    });
  }, [saveProgress]);

  // 重置单个课程进度
  const resetLessonProgress = useCallback((lessonId: string) => {
    setProgress(prev => {
      const { [lessonId]: _, ...rest } = prev;
      saveProgress(rest);
      return rest;
    });
    
    if (currentLessonId === lessonId) {
      setCurrentLessonId(null);
    }
  }, [currentLessonId, saveProgress]);

  // 重置所有进度
  const resetAllProgress = useCallback(() => {
    setProgress({});
    setCurrentLessonId(null);
    saveProgress({});
  }, [saveProgress]);

  // 转换课程数据为完整 OntologyLesson
  const lessons = useMemo<OntologyLesson[]>(() => {
    return ONTOLOGY_LESSONS_DATA.map(lesson => {
      const lessonProgress = progress[lesson.id];
      const completedSections = lessonProgress?.completedSections || [];
      const totalSections = lesson.sections.length;
      
      return {
        ...lesson,
        isCompleted: !!lessonProgress?.completedAt,
        isStarted: !!lessonProgress?.startedAt,
        progress: totalSections > 0 ? completedSections.length / totalSections : 0,
        lastAccessedAt: lessonProgress?.lastAccessedAt,
        completedAt: lessonProgress?.completedAt,
      };
    });
  }, [progress]);

  // 按阶段分类
  const lessonsByStage = useMemo(() => {
    const result: Record<OntologyStage, OntologyLesson[]> = {
      recognition: [],
      topology: [],
      assembly: [],
      evolution: [],
    };
    
    lessons.forEach(lesson => {
      result[lesson.stage].push(lesson);
    });
    
    return result;
  }, [lessons]);

  // 当前课程
  const currentLesson = useMemo(() => {
    if (!currentLessonId) return null;
    return lessons.find(l => l.id === currentLessonId) || null;
  }, [currentLessonId, lessons]);

  // 总体进度
  const overallProgress = useMemo(() => {
    const completed = lessons.filter(l => l.isCompleted).length;
    return lessons.length > 0 ? completed / lessons.length : 0;
  }, [lessons]);

  // 各阶段进度
  const stageProgress = useMemo(() => {
    const result: Record<OntologyStage, number> = {
      recognition: 0,
      topology: 0,
      assembly: 0,
      evolution: 0,
    };
    
    Object.entries(lessonsByStage).forEach(([stage, stageLessons]) => {
      const completed = stageLessons.filter(l => l.isCompleted).length;
      result[stage as OntologyStage] = stageLessons.length > 0 
        ? completed / stageLessons.length 
        : 0;
    });
    
    return result;
  }, [lessonsByStage]);

  // 统计
  const completedCount = useMemo(() => 
    lessons.filter(l => l.isCompleted).length, 
  [lessons]);
  
  const inProgressCount = useMemo(() => 
    lessons.filter(l => l.isStarted && !l.isCompleted).length, 
  [lessons]);

  // 获取单个课程元数据
  const getLesson = useCallback((lessonId: string): OntologyLesson | null => {
    return lessons.find(l => l.id === lessonId) || null;
  }, [lessons]);

  // 加载课程数据（直接从预载内存数据读取）
  const loadLessonData = useCallback(async (lessonId: string) => {
    return getSeedDataForLesson(lessonId);
  }, []);

  return {
    lessons,
    lessonsByStage,
    currentLesson,
    overallProgress,
    stageProgress,
    completedCount,
    inProgressCount,
    graphStats,
    selectLesson,
    markSectionComplete,
    markLessonComplete,
    resetLessonProgress,
    resetAllProgress,
    getLesson,
    loadLessonData,
    isLoading,
    error,
  };
}

export default useOntologyLessons;
