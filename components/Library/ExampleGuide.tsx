import React, { useState, useEffect } from 'react';
import { Network, Layers, Box, ChevronRight, ChevronLeft, ArrowRight, CheckCircle, Brain, Target, Zap } from 'lucide-react';
import * as d3 from 'd3';
import { useOntologyStore } from '../../hooks/useOntologyStore';

const CATEGORY_COLORS: Record<string, string> = {
  Product: '#FF9F1C',
  Customer: '#4CC9F0',
  Channel: '#E76F51',
  Campaign: '#FFD166',
  Metric: '#FF9CF7',
};

// ── Mini Graph Preview ─────────────────────────────────────────

const MiniGraph: React.FC = () => {
  const svgRef = React.useRef<SVGSVGElement>(null);

  React.useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const W = 340;
    const H = 220;

    const nodes = [
      // Products (top-left cluster)
      { label: '主力SKU-A', type: 'Product', r: 11, cx: 100, cy: 60 },
      { label: '主力SKU-B', type: 'Product', r: 10, cx: 60, cy: 95 },
      { label: '引流款C', type: 'Product', r: 9, cx: 140, cy: 105 },
      { label: '新品D', type: 'Product', r: 10, cx: 30, cy: 140 },
      // Channels (center-right)
      { label: '天猫旗舰店', type: 'Channel', r: 12, cx: 230, cy: 55 },
      { label: '抖音直播', type: 'Channel', r: 11, cx: 290, cy: 90 },
      { label: '私域社群', type: 'Channel', r: 10, cx: 310, cy: 150 },
      // Customers (bottom-left)
      { label: '高价值用户', type: 'Customer', r: 10, cx: 80, cy: 190 },
      { label: '价格敏感用户', type: 'Customer', r: 9, cx: 160, cy: 200 },
      { label: '沉睡用户', type: 'Customer', r: 9, cx: 200, cy: 175 },
      // Campaigns (top-right)
      { label: '618大促', type: 'Campaign', r: 11, cx: 250, cy: 130 },
      { label: '新品首发', type: 'Campaign', r: 10, cx: 290, cy: 180 },
      // Metrics (bottom-right)
      { label: '综合毛利率', type: 'Metric', r: 10, cx: 320, cy: 55 },
      { label: '月活用户', type: 'Metric', r: 9, cx: 330, cy: 100 },
    ];

    const links = [
      // Channel → Product
      [4, 0], [4, 1], [5, 2], [5, 3],
      // Channel → Customer
      [6, 7], [6, 0],
      // Customer → Product
      [7, 0], [7, 1], [8, 2], [8, 0],
      // Campaign → Channel
      [10, 4], [10, 5], [11, 3], [11, 6],
      // Metric contributions
      [0, 12], [4, 12], [6, 13],
      // Influence
      [5, 14], [10, 13],
    ];

    const g = svg.append('g');

    links.forEach(([from, to]) => {
      const s = nodes[from];
      const t = nodes[to];
      if (!s || !t) return;
      g.append('line')
        .attr('x1', s.cx).attr('y1', s.cy)
        .attr('x2', t.cx).attr('y2', t.cy)
        .style('stroke', 'rgba(150,150,180,0.25)')
        .style('stroke-width', 1.5)
        .style('pointer-events', 'none');
    });

    nodes.forEach(n => {
      const ng = g.append('g').attr('transform', `translate(${n.cx},${n.cy})`);
      ng.append('circle').attr('r', n.r)
        .style('fill', CATEGORY_COLORS[n.type])
        .style('stroke', 'rgba(200,220,255,0.5)')
        .style('stroke-width', 1.5)
        .style('opacity', 0.9);
      ng.append('text')
        .text(n.label.length > 5 ? n.label.slice(0, 5) + '…' : n.label)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('font-size', '7px')
        .style('fill', 'white')
        .style('font-weight', '600')
        .style('pointer-events', 'none')
        .style('text-shadow', '0 1px 2px rgba(0,0,0,0.8)');
    });

    const legendItems = [
      { label: 'Product', color: '#FF9F1C' },
      { label: 'Customer', color: '#4CC9F0' },
      { label: 'Channel', color: '#E76F51' },
      { label: 'Campaign', color: '#FFD166' },
      { label: 'Metric', color: '#FF9CF7' },
    ];

    const legendG = svg.append('g').attr('transform', 'translate(8, 8)');
    legendItems.forEach((item, i) => {
      legendG.append('circle').attr('cx', 6).attr('cy', 6 + i * 14).attr('r', 4).style('fill', item.color);
      legendG.append('text').attr('x', 14).attr('y', 6 + i * 14)
        .attr('dominant-baseline', 'middle')
        .style('font-size', '8px').style('fill', 'rgba(200,200,220,0.7)')
        .text(item.label);
    });
  }, []);

  return (
    <svg ref={svgRef} width="340" height="220"
      style={{ background: 'transparent', display: 'block', margin: '0 auto' }}
    />
  );
};

// ── Concept Cards ─────────────────────────────────────────────

const CONCEPT_CARDS = [
  {
    icon: Layers,
    color: 'monokai-purple',
    bg: 'bg-monokai-purple/10',
    border: 'border-monokai-purple/20',
    title: '对象类型 (ObjectType)',
    desc: '定义图谱中的实体种类。类型是节点的组织骨架，决定了实体的语义归属。常见类型：Product、Customer、Campaign、Metric。',
    example: 'Product · Customer · Channel · Campaign · Metric',
  },
  {
    icon: Box,
    color: 'monokai-blue',
    bg: 'bg-monokai-blue/10',
    border: 'border-monokai-blue/20',
    title: '实体节点 (Object)',
    desc: '每种类型的具体实例。实体可持有 JSON 结构的 properties 字段，用于存储业务扩展属性，如价格、用户画像、渠道占比等。',
    example: '主力SKU-A · 高价值用户群 · 天猫旗舰店 · 618大促活动',
  },
  {
    icon: Network,
    color: 'monokai-green',
    bg: 'bg-monokai-green/10',
    border: 'border-monokai-green/20',
    title: '拓扑关系 (Link)',
    desc: '实体之间的语义连接。每条关系带有 0~1 的权重，影响图谱的力导向布局和节点聚类。关系类型决定边的语义，如「销售」「投放」「转化」。',
    example: '销售 · 投放 · 贡献 · 影响 · 转化 · 捆绑',
  },
];

// ── Main Component ─────────────────────────────────────────────

interface ExampleGuideProps {
  onNavigateSchema?: () => void;
}

export const ExampleGuide: React.FC<ExampleGuideProps> = ({ onNavigateSchema }) => {
  const [step, setStep] = useState(0);
  const [hasOntologyData, setHasOntologyData] = useState(false);
  const { state } = useOntologyStore();
  const initState = state.initState;
  const objectTypes = state.objectTypes;

  useEffect(() => {
    setHasOntologyData(initState === 'ready' && (objectTypes?.length ?? 0) > 0);
  }, [initState, objectTypes]);

  const handleStart = () => {
    onNavigateSchema?.();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Step indicator */}
      <div className="shrink-0 px-4 pt-4 pb-2 flex items-center justify-center gap-2">
        {[0, 1, 2].map(i => (
          <React.Fragment key={i}>
            <button
              onClick={() => setStep(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === step
                  ? 'bg-monokai-cyan w-6'
                  : i < step
                  ? 'bg-monokai-cyan/50 cursor-pointer'
                  : 'bg-monokai-border/50 cursor-pointer'
              }`}
            />
            {i < 2 && <div className={`w-8 h-px ${i < step ? 'bg-monokai-cyan/50' : 'bg-monokai-border/50'}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4">
        {step === 0 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Header */}
            <div className="text-center pt-2 pb-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-monokai-cyan/10 border border-monokai-cyan/20 text-monokai-cyan text-[10px] font-medium mb-3">
                <Network className="w-3 h-3" />
                示例 · 电商运营知识图谱
              </div>
              <h3 className="text-base font-bold text-monokai-fg mb-1">商业本体论演示</h3>
              <p className="text-xs text-monokai-comment/70 leading-relaxed">
                展示知识图谱在电商运营场景下的建模能力：商品、用户、渠道、营销活动、运营指标 — 五个维度全链路打通。
              </p>
            </div>

            {/* Mini graph */}
            <div className="rounded-xl border border-monokai-border/40 bg-monokai-surface overflow-hidden">
              <div className="px-3 py-2 border-b border-monokai-border/30 flex items-center gap-2">
                <Network className="w-3.5 h-3.5 text-monokai-cyan shrink-0" />
                <span className="text-xs font-semibold text-monokai-fg">拓扑预览</span>
                <span className="text-[10px] text-monokai-comment/50 ml-auto">5类型 · 16节点 · 24关系</span>
              </div>
              <div className="p-2" style={{ background: 'linear-gradient(135deg, #0d0d18 0%, #12121f 100%)' }}>
                <MiniGraph />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: '类型', value: 5, color: 'text-monokai-purple' },
                { label: '节点', value: 16, color: 'text-monokai-blue' },
                { label: '关系', value: 24, color: 'text-monokai-green' },
                { label: '行动', value: 5, color: 'text-monokai-yellow' },
                { label: '关系类', value: 7, color: 'text-monokai-orange' },
              ].map(stat => (
                <div key={stat.label} className="rounded-lg bg-monokai-surface border border-monokai-border/40 p-2 text-center">
                  <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-[10px] text-monokai-comment/60">{stat.label}</div>
                </div>
              ))}
            </div>

            {hasOntologyData && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-monokai-green/10 border border-monokai-green/20 text-xs text-monokai-green">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                已有一组本体数据，图谱正在运行
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3 pt-2 animate-in fade-in duration-300">
            <div className="text-center pb-1">
              <h3 className="text-base font-bold text-monokai-fg mb-1">本体论核心要素</h3>
              <p className="text-xs text-monokai-comment/70">
                对象类型定义「是什么」，实体节点定义「具体是谁」，拓扑关系定义「如何相互影响」。
              </p>
            </div>

            <div className="space-y-2">
              {CONCEPT_CARDS.map(card => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className={`rounded-xl border ${card.border} ${card.bg} p-3`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg ${card.bg} border ${card.border} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-4 h-4 text-monokai-fg`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-monokai-fg mb-0.5">{card.title}</h4>
                        <p className="text-[11px] text-monokai-comment/80 leading-relaxed">{card.desc}</p>
                        <div className="mt-1.5 text-[10px] text-monokai-comment/50 font-mono">
                          {card.example}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg bg-monokai-sidebar/40 border border-monokai-border/30 p-3">
              <p className="text-[11px] text-monokai-comment leading-relaxed">
                <strong className="text-monokai-cyan">业务价值：</strong>
                本体论将分散在不同数据库表中的业务实体抽象为统一的图谱模型，
                支持跨表关系推理、影响路径分析和聚合洞察。
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 pt-2 animate-in fade-in duration-300">
            <div className="text-center pt-4 pb-2">
              <div className="w-14 h-14 rounded-2xl bg-monokai-cyan/15 border border-monokai-cyan/30 flex items-center justify-center mx-auto mb-3">
                <Zap className="w-7 h-7 text-monokai-cyan" />
              </div>
              <h3 className="text-base font-bold text-monokai-fg mb-1">开始构建业务本体</h3>
              <p className="text-xs text-monokai-comment/70 leading-relaxed">
                从现有数据库表结构出发，智能推断本体论模型。
                <br />选择表 → 生成图谱 → 导入本体库。
              </p>
            </div>

            {/* Feature highlights */}
            <div className="space-y-2">
              {[
                { icon: Network, color: 'text-monokai-cyan', bg: 'bg-monokai-cyan/10', border: 'border-monokai-cyan/20', title: 'Schema 图谱', desc: '读取数据库表结构与外键关系，生成可视化拓扑图' },
                { icon: Brain, color: 'text-monokai-purple', bg: 'bg-monokai-purple/10', border: 'border-monokai-purple/20', title: '本体推断', desc: '从外键关系智能推断对象类型和语义关系定义' },
                { icon: ArrowRight, color: 'text-monokai-green', bg: 'bg-monokai-green/10', border: 'border-monokai-green/20', title: '一键导入', desc: '将推断结果批量写入本体论实体库' },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className={`flex items-center gap-3 p-3 rounded-xl border ${item.border} ${item.bg}`}>
                    <Icon className={`w-5 h-5 shrink-0 ${item.color}`} />
                    <div>
                      <div className="text-xs font-semibold text-monokai-fg">{item.title}</div>
                      <div className="text-[10px] text-monokai-comment/60">{item.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CTA */}
            <button
              onClick={handleStart}
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-semibold text-sm
                bg-monokai-cyan/15 text-monokai-cyan hover:bg-monokai-cyan/25
                border border-monokai-cyan/30 transition-all
                shadow-[0_0_20px_rgba(102,217,239,0.15)]"
            >
              <ArrowRight className="w-4 h-4" />
              从 Schema 构建本体
            </button>

            <p className="text-center text-[10px] text-monokai-comment/40">
              或通过数据表视图右上角「本体建模」启动 AI 辅助建模
            </p>
          </div>
        )}
      </div>

      {/* Navigation footer */}
      <div className="shrink-0 px-4 py-3 border-t border-monokai-border/50 flex items-center justify-between">
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-monokai-comment
            hover:text-monokai-fg hover:bg-monokai-sidebar/40 transition-colors
            disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          上一步
        </button>

        <span className="text-[10px] text-monokai-comment/40">
          {step + 1} / 3
        </span>

        {step < 2 ? (
          <button
            onClick={() => setStep(s => Math.min(2, s + 1))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-monokai-sidebar/40 text-monokai-fg hover:bg-monokai-sidebar/60 transition-colors
              border border-monokai-border/40"
          >
            下一步
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="w-[60px]" />
        )}
      </div>
    </div>
  );
};

export default ExampleGuide;
