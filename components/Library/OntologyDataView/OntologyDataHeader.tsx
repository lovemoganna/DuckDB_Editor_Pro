import React from 'react';
import { Hexagon, Box, LayoutList, Link2, Zap, RefreshCw, Sparkles, AlertTriangle, Info } from 'lucide-react';
import { DataTab, TabMeta } from './types';

export const TAB_CONFIG: TabMeta[] = [
  {
    id: 'objectType',
    label: '类型 (Type)',
    icon: Hexagon,
    color: 'text-[#FF9F1C]',
    scenarioTitle: '类型构架层 — 本体论骨架',
    scenarioDesc: '定义实例的「种类标签」。类型是所有实例归属的基底，图谱中所有 Instance 节点均挂载于此层。常见于领域分类、角色谱系、项目维度等场景。',
    warningText: '删除或重命名类型会影响所有子实例节点在图谱中的视觉归属，可能引发 D3 TypeHub 渲染缺口。操作前请确认图谱中无孤立实例。',
  },
  {
    id: 'object',
    label: '实例 (Instance)',
    icon: Box,
    color: 'text-[#4CC9F0]',
    scenarioTitle: '实例存储层 — 核心知识单元',
    scenarioDesc: '承载所有具体实体（人物、事件、概念、资产等）。每个实体归属于一种类型，并可持有任意结构的 JSON 特性配置（properties）用于存放扩展元数据。',
    warningText: 'properties 字段为原始 JSON 字符串，格式错误会导致图谱属性徽章无法显示。填写时请确保是合法的 JSON（如 {"key": "value"}）。',
  },
  {
    id: 'linkType',
    label: '关系定义',
    icon: LayoutList,
    color: 'text-[#E76F51]',
    scenarioTitle: '关系约束层 — 语义边类型',
    scenarioDesc: '规定实体之间可以建立的连接「类别标签」。每条实际关系（link）都必须引用一个已有的关系类型。常见关系如「包含」、「触发」、「继承」等。',
    warningText: '删除关系类型不会自动删除引用该类型的所有实际关系（link），会造成关系库中出现悬空 foreign key，请先清除实际关系后再删除类型。',
  },
  {
    id: 'link',
    label: '关系库',
    icon: Link2,
    color: 'text-[#FFD166]',
    scenarioTitle: '关系连接层 — 图谱拓扑边',
    scenarioDesc: '记录两个实例节点之间的实际连接，每条关系带有一个 0~1 的耦合权重（weight）。权重影响 D3 图谱中边的弹力强度与视觉粗细，是控制图谱引力分布的核心变量。',
    warningText: '大幅修改高权重关系（w > 0.8）可能造成 D3 Force Simulation 向心力骤变，导致图谱节点大幅漂移甚至飞出视口。建议先在图谱视图中观察布局再调整权值。',
  },
  {
    id: 'action',
    label: '行动记录',
    icon: Zap,
    color: 'text-[#FF9CF7]',
    scenarioTitle: '行动任务层 — 实体挂载动作队列',
    scenarioDesc: '每个实例可挂载若干行动（Action），表示该实体需要完成的任务项或阶段里程碑。行动状态（pending / done）粒度清晰，是追踪知识图谱执行进度的主要入口。',
    warningText: 'execute_at 字段需严格遵守 YYYY-MM-DD 格式。传入 ISO 时间戳（含 T 与时区）将导致 DuckDB DATE 类型解析失败，行动将无法被正确落库。',
  },
  {
    id: 'introspection',
    label: '反思 (Introspection)',
    icon: RefreshCw,
    color: 'text-[#a6e22e]',
    scenarioTitle: '反思回顾层 — 心智与认知迭代',
    scenarioDesc: '记录针对特定实体（如心态、工作）提出的反思问题与回答。这是图谱用户进行自我复盘与深度思维沉淀的数据库。',
    warningText: '反思记录必须绑定一个已有的实例节点（object_id）。如果关联的实例被删除，级联删除行为视数据库约束而定。',
  },
  {
    id: 'insight',
    label: '洞察 (Insight)',
    icon: Sparkles,
    color: 'text-[#ae81ff]',
    scenarioTitle: '闪念洞察层 — 提炼价值碎片',
    scenarioDesc: '收集散落在各个实体之上的核心洞察与标签分类。支持通过标签分类对知识进行归纳整合。',
    warningText: '洞察记录必须关联实体。支持设置任意形式的 tag，用于快速聚合及检索高价值闪念。',
  },
];

interface OntologyDataHeaderProps {
  activeTab: DataTab;
  setActiveTab: (tab: DataTab) => void;
  showScenarioGuide: boolean;
  setShowScenarioGuide: (v: boolean) => void;
}

export const OntologyDataHeader: React.FC<OntologyDataHeaderProps> = ({
  activeTab,
  setActiveTab,
  showScenarioGuide,
  setShowScenarioGuide,
}) => {
  const currentTabMeta = TAB_CONFIG.find(t => t.id === activeTab) ?? TAB_CONFIG[0];

  return (
    <div className="flex-shrink-0 border-b border-monokai-accent/40 bg-monokai-sidebar p-3">
      <div className="flex items-center justify-between gap-4">
        {/* Flat Tab Group */}
        <div className="flex items-center gap-1 overflow-x-auto py-1">
          {TAB_CONFIG.map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-monokai-accent text-white shadow-sm'
                    : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent/30'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${t.color}`} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Toggle Scenario Guide */}
        <button
          onClick={() => setShowScenarioGuide(!showScenarioGuide)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-monokai-comment hover:text-monokai-fg bg-monokai-bg/60 border border-monokai-accent/40 rounded transition-colors"
        >
          <Info className="w-3.5 h-3.5 text-monokai-cyan" />
          <span>{showScenarioGuide ? '隐藏说明' : '场景说明'}</span>
        </button>
      </div>

      {/* Scenario Guidance Banner */}
      {showScenarioGuide && (
        <div className="mt-3 p-3 bg-monokai-bg/90 border border-monokai-accent/60 rounded-lg text-xs flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold text-monokai-fg">
            <span className={currentTabMeta.color}>{currentTabMeta.scenarioTitle}</span>
          </div>
          <p className="text-monokai-comment leading-relaxed">{currentTabMeta.scenarioDesc}</p>
          <div className="flex items-start gap-1.5 text-monokai-yellow bg-monokai-yellow/10 p-2 rounded border border-monokai-yellow/20">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{currentTabMeta.warningText}</span>
          </div>
        </div>
      )}
    </div>
  );
};
