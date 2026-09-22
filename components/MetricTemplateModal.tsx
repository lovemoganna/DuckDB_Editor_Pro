import React, { useState, useMemo } from 'react';
import { MetricDefinition } from '../types';
import { Package, Search, X, Plus, Sparkles, Hash, DollarSign, Activity, TrendingUp, Filter } from 'lucide-react';
import { ActionButton, ModalShell } from './ui/Workbench';

interface MetricTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: Omit<MetricDefinition, 'id' | 'createdAt'>) => void;
}

export const METRIC_TEMPLATES: Omit<MetricDefinition, 'id' | 'createdAt'>[] = [
  {
    name: 'total_count',
    scenario: '统计总数',
    characteristics: '计数型',
    value: '用于了解业务总量与规模体量',
    definition: '表中记录的绝对总数量',
    formula: 'COUNT(*)',
    example: '总订单数为 10,000 笔',
    dependencies: [],
    unit: '个',
    category: '基础统计',
  },
  {
    name: 'sum_amount',
    scenario: '金额汇总',
    characteristics: '累加型',
    value: '用于了解业务营收与资金流动规模',
    definition: '金额相关数值字段的累计总和',
    formula: 'SUM(amount)',
    example: '总销售流水为 500,000 元',
    dependencies: ['amount'],
    unit: '元',
    category: '营收类',
  },
  {
    name: 'avg_amount',
    scenario: '平均金额 (客单价/客单量)',
    characteristics: '比率型',
    value: '用于评估用户平均消费水平与业务单价质量',
    definition: '金额字段的算术平均值',
    formula: 'AVG(amount)',
    example: '平均客单价为 58.5 元',
    dependencies: ['amount'],
    unit: '元',
    category: '营收类',
  },
  {
    name: 'max_amount',
    scenario: '最大峰值',
    characteristics: '极值型',
    value: '用于监控业务单笔极值与大客户交易特征',
    definition: '数值字段的历史或周期最大值',
    formula: 'MAX(amount)',
    example: '单笔最大订单为 12,000 元',
    dependencies: ['amount'],
    unit: '元',
    category: '基础统计',
  },
  {
    name: 'min_amount',
    scenario: '最小底线',
    characteristics: '极值型',
    value: '用于识别数据下限与异常低额流水',
    definition: '数值字段的有效最小值',
    formula: 'MIN(amount)',
    example: '最小交易金额为 0.01 元',
    dependencies: ['amount'],
    unit: '元',
    category: '基础统计',
  },
  {
    name: 'distinct_users',
    scenario: '独立主体去重计数 (UV/DAP)',
    characteristics: '去重计数型',
    value: '用于评估实际覆盖的独立用户/设备规模',
    definition: '主键或用户唯一标识的非重复计数',
    formula: 'COUNT(DISTINCT user_id)',
    example: '独立访客/用户数为 2,450 人',
    dependencies: ['user_id'],
    unit: '人',
    category: '流量类',
  },
  {
    name: 'daily_active_trend',
    scenario: '每日趋势聚合',
    characteristics: '时序趋势型',
    value: '用于观测业务日常波动与周期性规律',
    definition: '按天粒度截断并聚合的时间序列记录数',
    formula: "SELECT date_trunc('day', created_at) AS day, COUNT(*) AS cnt FROM table_name GROUP BY 1",
    example: '2026-08-28 活跃记录 1,200 条',
    dependencies: ['created_at'],
    unit: '条/天',
    category: '流量类',
  },
  {
    name: 'retention_rate_day1',
    scenario: '次日留存率',
    characteristics: '转化比率型',
    value: '用于衡量新用户粘性与产品初期吸引力',
    definition: '次日发生回访事件的活跃人数占基准人数的比率',
    formula: 'SUM(CASE WHEN date_diff(\'day\', created_at, event_date) = 1 THEN 1 ELSE 0 END) * 1.0 / NULLIF(COUNT(*), 0)',
    example: '次日留存率为 42.5%',
    dependencies: ['created_at', 'event_date'],
    unit: '%',
    category: '转化类',
  },
  {
    name: 'conversion_funnel_rate',
    scenario: '转化漏斗达成率',
    characteristics: '比率型',
    value: '用于分析用户从起始节点到支付终点的转化效率',
    definition: '完成转化的人数除以进入环节的总人数',
    formula: "COUNT(DISTINCT CASE WHEN status = 'paid' THEN user_id END) * 1.0 / NULLIF(COUNT(DISTINCT user_id), 0)",
    example: '最终支付转化率为 18.2%',
    dependencies: ['status', 'user_id'],
    unit: '%',
    category: '转化类',
  },
];

const CATEGORY_ICONS: Record<string, typeof Activity> = {
  全部: Filter,
  基础统计: Hash,
  营收类: DollarSign,
  流量类: Activity,
  转化类: TrendingUp,
};

export const MetricTemplateModal: React.FC<MetricTemplateModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');

  const categories = useMemo(() => {
    const set = new Set<string>(['全部']);
    METRIC_TEMPLATES.forEach(t => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, []);

  const filteredTemplates = useMemo(() => {
    return METRIC_TEMPLATES.filter(t => {
      const matchCategory = selectedCategory === '全部' || t.category === selectedCategory;
      if (!matchCategory) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.scenario.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q) ||
        t.formula.toLowerCase().includes(q)
      );
    });
  }, [selectedCategory, searchTerm]);

  if (!isOpen) return null;

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title="标准语义指标模板库"
      description="精选行业通用的标准原子指标与复合指标，支持一键注入当前指标包"
      icon={Package}
      badge={`${METRIC_TEMPLATES.length} 个经典模版`}
      size="lg"
      footer={
        <>
          <span className="mr-auto flex items-center gap-1.5 text-xs text-monokai-comment">
            <Sparkles size={13} className="text-monokai-yellow" aria-hidden="true" />
            点击任意模版卡片即可添加到当前指标包
          </span>
          <ActionButton variant="secondary" size="sm" onClick={onClose}>
            关闭
          </ActionButton>
        </>
      }
    >
      <div className="-m-5 flex min-h-0 flex-col">
        {/* Toolbar & Category Pills */}
        <div className="space-y-3 border-b border-monokai-border bg-monokai-bg/60 p-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-monokai-comment" aria-hidden="true" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="搜索指标名称、场景、公式语法..."
              className="w-full rounded-md border border-monokai-border bg-monokai-surface py-1.5 pl-9 pr-8 text-xs text-monokai-fg placeholder-monokai-comment/60 transition-colors focus:border-monokai-accent focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer p-0.5 text-monokai-comment hover:text-monokai-fg"
              >
                <X size={12} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map(cat => {
              const IconComp = CATEGORY_ICONS[cat] || Filter;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all ${
                    isSelected
                      ? 'border-monokai-border-strong bg-monokai-surface text-monokai-fg shadow-xs'
                      : 'border-monokai-border/70 bg-monokai-sidebar text-monokai-comment hover:border-monokai-border hover:text-monokai-fg'
                  }`}
                >
                  <IconComp size={12} className={isSelected ? 'text-monokai-fg' : 'text-monokai-comment'} aria-hidden="true" />
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-monokai-bg p-4 custom-scrollbar">
          {filteredTemplates.length === 0 ? (
            <div className="py-12 text-center text-monokai-comment">
              <Package size={36} className="mx-auto mb-2 opacity-30" aria-hidden="true" />
              <p className="text-xs">未找到符合条件的指标模板</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredTemplates.map((t, idx) => (
                <div
                  key={idx}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectTemplate(t)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectTemplate(t);
                    }
                  }}
                  className="group relative flex cursor-pointer flex-col justify-between rounded-md border border-monokai-border bg-monokai-sidebar p-3.5 shadow-xs transition-all hover:border-monokai-border-strong hover:bg-monokai-surface/60 hover:shadow-md"
                >
                  <div>
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-mono text-xs font-bold text-monokai-fg transition-colors group-hover:text-monokai-accent">
                          {t.name}
                        </span>
                        {t.unit && (
                          <span className="rounded border border-monokai-border bg-monokai-surface px-1.5 font-mono text-2xs text-monokai-comment">
                            {t.unit}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 rounded border border-monokai-border bg-monokai-surface px-2 py-0.5 text-2xs font-medium text-monokai-fg-muted">
                        {t.category}
                      </span>
                    </div>

                    <p className="mb-2 text-xs font-medium text-monokai-fg-muted">{t.scenario}</p>
                    <p className="mb-2 line-clamp-2 text-meta leading-relaxed text-monokai-comment">
                      {t.definition}
                    </p>

                    <div className="break-all rounded border border-monokai-border/80 bg-monokai-bg px-2.5 py-1.5 font-mono text-meta text-monokai-accent">
                      <code>{t.formula}</code>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-monokai-border/60 pt-2.5 text-meta text-monokai-comment">
                    <span className="truncate">{t.characteristics}</span>
                    <span className="flex items-center gap-1 text-xs font-medium text-monokai-cyan transition-transform group-hover:translate-x-0.5">
                      <Plus size={13} aria-hidden="true" /> 添加此指标
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
};
