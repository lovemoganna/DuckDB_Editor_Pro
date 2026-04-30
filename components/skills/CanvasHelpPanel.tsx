/**
 * CanvasHelpPanel — Ontology 高阶画布背景说明与 AI 协作引导
 *
 * 功能：
 * - 提供 OntologyCanvas 和 D3GraphView 的模块背景说明
 * - 明确使用场景、常见错误、最佳实践
 * - AI 协作预置提示词 + 二次优化入口
 */

import React, { useState } from 'react';
import { HelpCircle, X, Sparkles, AlertTriangle, Lightbulb, Wand2 } from 'lucide-react';

export interface CanvasHelpConfig {
  type: 'canvas' | 'graph';
  /** 当前画布已有的对象列表（用于生成智能提示） */
  existingObjects?: string[];
}

interface HelpSection {
  title: string;
  icon: React.ReactNode;
  color: string;
  items: string[];
}

const CANVAS_HELP: HelpSection[] = [
  {
    title: '适用场景',
    icon: <Lightbulb className="w-3.5 h-3.5" />,
    color: '#4ade80',
    items: [
      '设计数据管道拓扑（ETL/ELT 工作流）',
      '规划多表 JOIN 顺序与依赖关系',
      '构建可复用的 SQL 模板片段库',
      '可视化数据流转路径与变换节点',
      '头脑风暴式自由空间规划',
    ],
  },
  {
    title: '常见错误',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    color: '#fb923c',
    items: [
      '节点间形成循环依赖（DAG 检测失败）',
      'Transform 节点未配置 SQL 变换逻辑',
      'Source 节点表名与实际物理表不一致',
      'Space/Group 层级过深导致视图混乱',
      'AI 填充后未检查节点位置重叠',
    ],
  },
  {
    title: '最佳实践',
    icon: <Wand2 className="w-3.5 h-3.5" />,
    color: '#a78bfa',
    items: [
      '先用 AI 一键填充生成基础拓扑，再手动微调',
      'Transform 节点应至少有一个输入边、一个输出边',
      'Sink 节点放在拓扑最右侧，作为数据出口',
      '为每个节点配置 tableName 和 sqlFragment，便于调试',
      'Ctrl+Shift+O 快速触发 AI 填充 · Ctrl+Shift+R 清空画布 · Escape 清空或退出',
    ],
  },
];

const GRAPH_HELP: HelpSection[] = [
  {
    title: '适用场景',
    icon: <Lightbulb className="w-3.5 h-3.5" />,
    color: '#4ade80',
    items: [
      '全局关系可视化与概念图谱浏览',
      '发现高耦合节点（度数异常高）',
      '识别孤立节点（无连接的实体）',
      '追踪实体间的最短路径',
      '按类型/颜色过滤图谱子集',
    ],
  },
  {
    title: '常见错误',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    color: '#fb923c',
    items: [
      '节点过多（>100）导致力导向布局卡顿',
      '边权重未归一化（混入 >1 的值）',
      '拖拽节点后忘记固定位置（doble-click）',
      '在大量 Action 节点中寻找特定实例困难',
      'AI 生成图谱后直接注入，忽略现有节点冲突',
    ],
  },
  {
    title: '最佳实践',
    icon: <Wand2 className="w-3.5 h-3.5" />,
    color: '#a78bfa',
    items: [
      '先在 MECE 基础层构建对象，再在图谱中观察关系',
      'AI 图谱生成后，先 Fit All 查看全貌再精细操作',
      '高权重边（>0.8）使用较粗线条突出显示',
      '使用控制面板的物理力场调节优化布局密度',
      '大量节点时使用降噪聚焦（右键 → 折叠）',
    ],
  },
];

// ── AI 协作预置提示词 ──

export const CANVAS_AI_PROMPTS = {
  fill: (objects: string[]) =>
    `基于已有对象 [${objects.join(', ')}]，生成一个数据处理拓扑。` +
    '包含 Source（数据源）、Transform（变换）、Sink（输出）三类节点，' +
    '自动规划节点布局（x/y 坐标）和节点间数据依赖边。',

  refine: (currentSql: string) =>
    `当前拓扑 SQL 预览如下，请分析其数据依赖路径，并给出优化建议：\n\n${currentSql}\n\n` +
    '指出可能的性能问题，并生成改进后的 SQL 片段。',

  nodeHint: (nodeType: string, tableName: string) =>
    `节点类型：${nodeType}，绑定表：${tableName}。` +
    `请生成该节点在拓扑中的最佳 SQL 片段，并说明其在 CTE 流中的作用。`,
};

// ── MECE Layer Design — 高阶画布的五层语义 ──

export type MECELayer = 'foundation' | 'relations' | 'methodology' | 'patterns' | 'domains';

export interface MECELayerDesign {
  label: string;
  labelZh: string;
  description: string;
  color: string;
  /** Tailwind text color */
  textClass: string;
  /** Tailwind bg color */
  bgClass: string;
  /** Tailwind border color */
  borderClass: string;
  /** Lucide icon name */
  icon: string;
  applicableScenario: string;
  commonMistakes: string[];
}

export const CANVAS_MECE_LAYER_DESIGN: Record<MECELayer, MECELayerDesign> = {
  foundation: {
    label: 'Foundation',
    labelZh: '基础层',
    description: '定义对象类型（Object Type）和实例（Object Instance），是本体论的根基。',
    color: '#a78bfa',
    textClass: 'text-[#a78bfa]',
    bgClass: 'bg-[#a78bfa]/[8%]',
    borderClass: 'border-[#a78bfa]/[20%]',
    icon: 'Database',
    applicableScenario: '设计数据表结构、定义概念维度、批量导入实体',
    commonMistakes: [
      '对象类型定义过于宽泛（如"其他"类型）',
      '同一概念重复创建多个对象类型',
      'properties 字段未序列化，直接存字符串',
    ],
  },
  relations: {
    label: 'Relations',
    labelZh: '关系层',
    description: '建立对象之间的关系（Link）和关系类型（Link Type），描绘语义连接。',
    color: '#38bdf8',
    textClass: 'text-[#38bdf8]',
    bgClass: 'bg-[#38bdf8]/[8%]',
    borderClass: 'border-[#38bdf8]/[20%]',
    icon: 'GitBranch',
    applicableScenario: '建立实体间依赖、构建概念图谱、权重关系建模',
    commonMistakes: [
      'link_type_id 使用了不存在的类型 ID',
      'weight 未归一化（混入 >1 的值）',
      '关系类型命名混乱（大小写混用）',
    ],
  },
  methodology: {
    label: 'Methodology',
    labelZh: '方法论层',
    description: '提供建模范式的建议和分步实施计划，引导结构化思考。',
    color: '#4ade80',
    textClass: 'text-[#4ade80]',
    bgClass: 'bg-[#4ade80]/[8%]',
    borderClass: 'border-[#4ade80]/[20%]',
    icon: 'Lightbulb',
    applicableScenario: '选择建模范式、规划实施路径、获取 AI 建议',
    commonMistakes: [
      '跳过 Foundation 层直接建关系',
      '建议步骤过于抽象，未落地到具体操作',
      '复杂度评估不准确（低估 high/high）',
    ],
  },
  patterns: {
    label: 'Patterns',
    labelZh: '模式层',
    description: '生成高级 SQL 模式（递归 CTE、聚合视图、时序版本化），驱动分析能力。',
    color: '#fb923c',
    textClass: 'text-[#fb923c]',
    bgClass: 'bg-[#fb923c]/[8%]',
    borderClass: 'border-[#fb923c]/[20%]',
    icon: 'Layers',
    applicableScenario: '递归路径分析、时序数据建模、复杂聚合视图',
    commonMistakes: [
      '递归 CTE 未设置深度限制（max_recursion）',
      '聚合视图与物理表混用导致数据不一致',
      '时序版本化未考虑增量更新',
    ],
  },
  domains: {
    label: 'Domains',
    labelZh: '领域层',
    description: '生成完整的领域模型，包含类型、关系、种子数据和视图，一站式交付。',
    color: '#fbbf24',
    textClass: 'text-[#fbbf24]',
    bgClass: 'bg-[#fbbf24]/[8%]',
    borderClass: 'border-[#fbbf24]/[20%]',
    icon: 'Globe',
    applicableScenario: '快速启动新领域、批量生成完整本体论模板',
    commonMistakes: [
      '领域边界划分不清（范围过大或过小）',
      'seed data 与实际业务脱节',
      '视图依赖链断裂（循环引用）',
    ],
  },
};

// ── MECE Layer AI 提示词 ──

export const CANVAS_MECE_PROMPTS = {
  /** 填充提示词 — 接收当前 MECE 层，返回完整 prompt 字符串 */
  fill: (layer: MECELayer, context?: { existingObjects?: string[]; objectTypes?: string[] }): string => {
    const existingObjects = context?.existingObjects?.join(' / ') || '（尚无对象）';
    const existingTypes = context?.objectTypes?.join(', ') || '（尚无类型）';

    const prompts: Record<MECELayer, string> = {
      foundation: `基于已有对象类型 [${existingTypes}] 和已有对象 [${existingObjects}]，` +
        `请为画布生成 Foundation 层布局。` +
        `每个 Space 代表一个对象类型区域，包含该类型的实例节点（Item）。` +
        `Space 标题 = 对象类型名称；Item 标签 = 对象名称。` +
        `请输出 1-3 个 Space，2-5 个 Item，合理分布 x/y 坐标。`,

      relations: `基于已有对象 [${existingObjects}]，` +
        `请生成 Relations 层的数据依赖图谱布局。` +
        `用 Item 节点表示对象，用 SVG 边表示关系类型。` +
        `每个 Item 的 metadata.sqlFragment 应包含该关系对应的 JOIN 或 CTE 片段。` +
        `建议 3-6 个 Item，3-5 条边，线性或树状拓扑。`,

      methodology: `基于已有对象 [${existingObjects}]，` +
        `请生成 Methodology 层的方法论引导布局。` +
        `用 Group 节点表示方法论步骤（Plan / Build / Review 等），` +
        `Item 表示该步骤的具体操作要点。` +
        `metadata.sqlFragment 存放方法论建议的 SQL 示例。` +
        `建议 2-4 个 Group，4-8 个 Item，步骤式布局（从上到下或从左到右）。`,

      patterns: `基于已有对象 [${existingObjects}]，` +
        `请生成 Patterns 层的高级 SQL 模式布局。` +
        `每个 Item 代表一个 SQL 模式节点（递归 CTE / 聚合视图 / 时序分析），` +
        `Item 的 metadata.sqlFragment 存放完整的 DuckDB SQL 模板。` +
        `建议 2-4 个 Item，使用 Transform 类型节点。`,

      domains: `基于已有对象 [${existingObjects}]，` +
        `请生成 Domains 层的完整领域布局。` +
        `使用多个 Space 分别代表不同子领域，Space 内包含子领域核心对象节点。` +
        `每个 Space 的 color 使用语义化配色，Item 之间用边表示领域内关系。` +
        `建议 2-3 个 Space，6-10 个 Item，网格状或分组布局。`,
    };

    return prompts[layer];
  },

  /** 二次优化提示词 — 接收当前画布拓扑 SQL 和用户指令，返回优化方向 */
  refine: (layer: MECELayer, currentSql: string, userInstruction: string): string => {
    const layerPrompts: Record<MECELayer, string> = {
      foundation: `当前 Foundation 层拓扑 SQL 如下，请分析对象类型和实例的完整性，` +
        `并给出优化建议（如补充遗漏的关联对象、修正 properties 格式）：\n\n${currentSql}\n\n` +
        `用户指令：${userInstruction}`,

      relations: `当前 Relations 层拓扑 SQL 如下，请分析关系路径的合理性，` +
        `检查 link_type 和 weight 配置，并生成优化建议：\n\n${currentSql}\n\n` +
        `用户指令：${userInstruction}`,

      methodology: `当前 Methodology 层拓扑 SQL 如下，请分析建模范式的适用性，` +
        `检查步骤完整性，并给出改进建议：\n\n${currentSql}\n\n` +
        `用户指令：${userInstruction}`,

      patterns: `当前 Patterns 层拓扑 SQL 如下，请分析 SQL 模式的效率和正确性，` +
        `检查 CTE 深度、聚合逻辑、时序处理，并给出优化版本：\n\n${currentSql}\n\n` +
        `用户指令：${userInstruction}`,

      domains: `当前 Domains 层拓扑 SQL 如下，请分析领域模型的边界和完整性，` +
        `检查种子数据一致性和视图依赖链：\n\n${currentSql}\n\n` +
        `用户指令：${userInstruction}`,
    };
    return layerPrompts[layer];
  },

  /** MECE 层快速示例 — 返回指定层级的启发式示例数据 */
  example: (layer: MECELayer): string => {
    const examples: Record<MECELayer, string> = {
      foundation: '用户画像：Aspect（维度）/ Person（人物）/ Goal（目标）→ 对象类型 + 实例',
      relations: '关系建模：Person EMPLOYED_BY Aspect → LinkType + Link + weight',
      methodology: '方法论：自底向上建模 → Plan（识别核心概念）/ Build（建立关系）/ Review（验证一致性）',
      patterns: 'SQL 模式：递归 CTE（路径分析）/ 聚合视图（统计）/ 时序版本化（快照）',
      domains: '领域模型：家庭财务 → 收入/支出/资产/负债四类，6-12 个种子对象，5+ 关系',
    };
    return examples[layer];
  },
};

export const GRAPH_AI_PROMPTS = {
  fill: (topic: string) =>
    `请为【${topic}】领域生成一个概念图谱布局方案，包含 5-10 个核心节点和它们之间的关系边。` +
    '输出节点坐标（x/y），以便在画布上直接渲染。',

  expand: (nodeName: string) =>
    `围绕【${nodeName}】节点，展开其周围 3-5 个相关概念节点，生成新的边连接。` +
    '同时给出这些新节点的 x/y 布局坐标。',
};

// ── Component ──

interface CanvasHelpPanelProps {
  config: CanvasHelpConfig;
  onClose?: () => void;
}

export const CanvasHelpPanel: React.FC<CanvasHelpPanelProps> = ({ config, onClose }) => {
  const [activeTab, setActiveTab] = useState<'guide' | 'prompts' | 'mece'>('guide');
  const sections = config.type === 'canvas' ? CANVAS_HELP : GRAPH_HELP;
  const existingObjects = config.existingObjects || [];

  return (
    <div style={{
      position: 'absolute', top: 16, right: 16, zIndex: 200,
      width: 320, maxHeight: 'calc(100vh - 80px)', overflow: 'hidden',
      background: 'rgba(23,23,35,0.95)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <HelpCircle className="w-4 h-4 text-indigo-400" />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
          {config.type === 'canvas' ? '画布使用指南' : '图谱使用指南'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button
            onClick={() => setActiveTab('guide')}
            style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
              border: '1px solid', cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === 'guide' ? 'rgba(99,102,241,0.2)' : 'transparent',
              borderColor: activeTab === 'guide' ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)',
              color: activeTab === 'guide' ? '#a5b4fc' : '#64748b',
            }}
          >
            指南
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
              border: '1px solid', cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === 'prompts' ? 'rgba(167,139,250,0.2)' : 'transparent',
              borderColor: activeTab === 'prompts' ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.1)',
              color: activeTab === 'prompts' ? '#c4b5fd' : '#64748b',
            }}
          >
            AI 提示词
          </button>
          <button
            onClick={() => setActiveTab('mece')}
            style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
              border: '1px solid', cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === 'mece' ? 'rgba(251,146,60,0.2)' : 'transparent',
              borderColor: activeTab === 'mece' ? 'rgba(251,146,60,0.5)' : 'rgba(255,255,255,0.1)',
              color: activeTab === 'mece' ? '#fbbf24' : '#64748b',
            }}
          >
            MECE 层
          </button>
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2 }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {activeTab === 'guide' ? (
          <div className="space-y-4">
            {sections.map((section, i) => (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ color: section.color }}>{section.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: section.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {section.title}
                  </span>
                </div>
                <div style={{ paddingLeft: 22 }}>
                  {section.items.map((item, j) => (
                    <div key={j} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <span style={{ color: section.color, fontSize: 11, fontWeight: 700, lineHeight: '18px' }}>•</span>
                      <span style={{ fontSize: 11, color: '#94a3b8', lineHeight: '18px' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'mece' ? (
          <div className="space-y-4">
            {/* MECE 层导航 */}
            <div>
              <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                MECE 五层导航
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {(Object.keys(CANVAS_MECE_LAYER_DESIGN) as MECELayer[]).map(layer => {
                  const design = CANVAS_MECE_LAYER_DESIGN[layer];
                  return (
                    <div
                      key={layer}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        background: design.bgClass,
                        border: `1px solid ${design.borderClass}`,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, color: design.color }}>
                        {design.labelZh}
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                        {design.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* MECE 层详情 */}
            {(Object.keys(CANVAS_MECE_LAYER_DESIGN) as MECELayer[]).map(layer => {
              const design = CANVAS_MECE_LAYER_DESIGN[layer];
              return (
                <div key={layer}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ color: design.color }}>{design.labelZh} / {design.label}</span>
                  </div>
                  <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 10, border: `1px solid ${design.borderClass}`, fontSize: 11, color: '#94a3b8', lineHeight: 1.7, marginBottom: 8 }}>
                    {design.description}
                  </div>
                  <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 600, marginBottom: 4 }}>适用场景</div>
                  <div style={{ paddingLeft: 10, marginBottom: 8, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
                    {design.applicableScenario}
                  </div>
                  <div style={{ fontSize: 10, color: '#fb923c', fontWeight: 600, marginBottom: 4 }}>常见错误</div>
                  <div style={{ paddingLeft: 10, marginBottom: 8, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
                    {design.commonMistakes.map((m, i) => <div key={i} style={{ marginBottom: 3 }}>• {m}</div>)}
                  </div>
                  <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.2)', fontSize: 11, color: '#a78bfa', lineHeight: 1.6 }}>
                    示例：{CANVAS_MECE_PROMPTS.example(layer)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {config.type === 'canvas' ? (
              <>
                <div>
                  <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    AI 一键填充提示词
                  </div>
                  <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 10, border: '1px solid rgba(167,139,250,0.15)', fontSize: 11, color: '#94a3b8', lineHeight: 1.7 }}>
                    {existingObjects.length > 0 ? (
                      <>基于已有对象 [{existingObjects.slice(0, 3).join(', ')}{existingObjects.length > 3 ? '...' : ''}]，生成数据处理拓扑，包含 Source/Transform/Sink 节点及依赖边。</>
                    ) : (
                      <>输入图谱主题，AI 自动生成 Space/Group/Item 层级结构及拓扑依赖边。</>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#fb923c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    二次优化提示词
                  </div>
                  <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 10, border: '1px solid rgba(251,146,60,0.15)', fontSize: 11, color: '#94a3b8', lineHeight: 1.7 }}>
                    输入类似「增加一个过滤节点」「改为时序聚合」等，AI 将更新拓扑 SQL 片段。
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    AI 图谱生成提示词
                  </div>
                  <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 10, border: '1px solid rgba(167,139,250,0.15)', fontSize: 11, color: '#94a3b8', lineHeight: 1.7 }}>
                    输入领域主题（如「电商订单」「家庭财务」），AI 生成 5-10 个核心概念节点和关系边，包含布局坐标。
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#fb923c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    展开节点提示词
                  </div>
                  <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 10, border: '1px solid rgba(251,146,60,0.15)', fontSize: 11, color: '#94a3b8', lineHeight: 1.7 }}>
                    选中某节点后，输入「围绕 [节点名] 展开更多关系」，AI 将追加相关概念节点和边。
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
