import './metricUi.css';
import React, { useState, useMemo } from 'react';
import { METRIC_RECIPES, type MetricRecipeId } from '../services/metricRecipes';
import { MetricRecipeBuilder } from './MetricRecipeBuilder';
import { MetricDefinition } from '../types';
import { METRIC_TEMPLATES, METRIC_KNOWLEDGE, METRIC_SOURCES, METRIC_BUSINESS_CATALOG } from '../data/metricSystem';
import {
  Package,
  Plus,
  Sparkles,
  Hash,
  DollarSign,
  Activity,
  TrendingUp,
  Filter,
  ExternalLink,
  ArrowRight,
  BookOpen,
  Layers,
  Calculator,
  Briefcase,
} from 'lucide-react';
import { ActionButton, ModalShell, SearchInput } from './ui/Workbench';

interface MetricTemplateModalProps {
  tables?: string[];
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: Omit<MetricDefinition, 'id' | 'createdAt'>) => void;
}

export { METRIC_TEMPLATES } from '../data/metricSystem';

const CATEGORY_ICONS: Record<string, typeof Activity> = {
  全部: Filter,
  基础统计: Hash,
  规模与覆盖: Hash,
  位置与分布: Activity,
  离散与波动: Activity,
  效率与比率: DollarSign,
  时间分析: TrendingUp,
  营收类: DollarSign,
  流量类: Activity,
  转化类: TrendingUp,
};

export const MetricTemplateModal: React.FC<MetricTemplateModalProps> = ({
  isOpen,
  tables = [],
  onClose,
  onSelectTemplate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'templates' | 'knowledge' | 'recipes' | 'business'>('templates');
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [selectedDomain, setSelectedDomain] = useState<string>('全部');
  const [selectedRecipeId, setSelectedRecipeId] = useState<MetricRecipeId>('retention');

  const categories = useMemo(() => {
    const set = new Set<string>(['全部']);
    METRIC_TEMPLATES.forEach(t => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, []);

  const domains = useMemo(() => {
    const set = new Set<string>(['全部']);
    METRIC_BUSINESS_CATALOG.forEach(item => {
      if (item.domain) set.add(item.domain);
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

  const filteredBusinessItems = useMemo(() => {
    return METRIC_BUSINESS_CATALOG.filter(item => {
      const matchDomain = selectedDomain === '全部' || item.domain === selectedDomain;
      if (!matchDomain) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.definition.toLowerCase().includes(q) ||
        item.domain.toLowerCase().includes(q)
      );
    });
  }, [selectedDomain, searchTerm]);

  if (!isOpen) return null;

  return (
    <ModalShell
      className="metric-surface"
      open={isOpen}
      onClose={onClose}
      title="标准语义指标模板库"
      description="按计算原语和分析变换组织；业务分类与治理用途独立登记"
      icon={Package}
      badge={`${METRIC_TEMPLATES.length} 个可配置模板`}
      size="lg"
      footer={
        <>
          <span className="mr-auto flex items-center gap-1.5 text-xs text-monokai-comment">
            <Sparkles size={13} className="text-monokai-yellow" aria-hidden="true" />
            选择模板 → 绑定实际字段 → 执行验证 → 核对口径并保存
          </span>
          <ActionButton variant="secondary" size="sm" onClick={onClose}>
            关闭
          </ActionButton>
        </>
      }
    >
      <div className="-m-5 flex min-h-0 flex-col">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-3.5 border-b border-monokai-border bg-monokai-sidebar/30">
          <ActionButton
            variant={view === 'templates' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setView('templates')}
          >
            <Calculator size={13} className="mr-1" />
            计算模板
          </ActionButton>
          <ActionButton
            variant={view === 'knowledge' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setView('knowledge')}
          >
            <BookOpen size={13} className="mr-1" />
            专业方法与口径
          </ActionButton>
          <ActionButton
            variant={view === 'recipes' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setView('recipes')}
          >
            <Layers size={13} className="mr-1" />
            留存 / 漏斗 / 快照 / 占比
          </ActionButton>
          <ActionButton
            variant={view === 'business' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setView('business')}
          >
            <Briefcase size={13} className="mr-1" />
            业务口径索引
          </ActionButton>
        </div>

        {view === 'business' ? (
          <div className="flex flex-col flex-1 min-h-0 bg-monokai-bg">
            <div className="space-y-3 border-b border-monokai-border bg-monokai-bg/60 p-4">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                onClear={() => setSearchTerm('')}
                placeholder="搜索业务口径、定义、领域..."
                size="sm"
                className="w-full max-w-none"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {domains.map(dom => {
                  const isSelected = selectedDomain === dom;
                  return (
                    <button
                      key={dom}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedDomain(dom)}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all ${
                        isSelected
                          ? 'border-monokai-border-strong bg-monokai-surface text-monokai-fg shadow-xs'
                          : 'border-monokai-border/70 bg-monokai-sidebar text-monokai-comment hover:border-monokai-border hover:text-monokai-fg'
                      }`}
                    >
                      <span>{dom}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-2xs text-monokai-comment">
                业务用途独立于计算方式。下列口径需先确认资格总体与输入事实；涉及归因、跨表、符号金额或成熟观察期时先准备一致的模型。
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-5">
              {filteredBusinessItems.length === 0 ? (
                <div className="py-12 text-center text-monokai-comment">
                  <Briefcase size={36} className="mx-auto mb-2 opacity-30" aria-hidden="true" />
                  <p className="text-xs">未找到符合条件的业务口径</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredBusinessItems.map(item => {
                    const hasTemplate = 'template' in item && item.template;
                    const hasRecipe = 'recipe' in item && item.recipe;
                    const matchedTemplate = hasTemplate
                      ? METRIC_TEMPLATES.find(t => t.name === item.template)
                      : null;
                    const matchedRecipe = hasRecipe
                      ? METRIC_RECIPES.find(r => r.id === item.recipe)
                      : null;

                    return (
                      <article
                        key={item.name}
                        className="group flex flex-col justify-between rounded-md border border-monokai-border bg-monokai-sidebar/50 p-3.5 shadow-xs transition-all hover:border-monokai-border-strong hover:bg-monokai-surface/60 hover:shadow-md"
                      >
                        <div>
                          <div className="mb-1.5 flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <h4 className="truncate font-semibold text-xs text-monokai-fg group-hover:text-monokai-accent transition-colors">
                                {item.name}
                              </h4>
                              {item.unit && (
                                <span className="rounded border border-monokai-border bg-monokai-surface px-1.5 font-mono text-2xs text-monokai-comment">
                                  {item.unit}
                                </span>
                              )}
                            </div>
                            <span className="shrink-0 rounded border border-monokai-border bg-monokai-surface px-2 py-0.5 text-2xs font-medium text-monokai-fg-muted">
                              {item.domain}
                            </span>
                          </div>

                          <p className="mb-3 text-xs leading-relaxed text-monokai-comment line-clamp-3">
                            {item.definition}
                          </p>
                        </div>

                        <div className="mt-2 flex items-center justify-between border-t border-monokai-border/60 pt-2.5 text-2xs text-monokai-comment">
                          <span className="truncate">
                            建模入口: {matchedTemplate?.scenario || matchedRecipe?.title || '通用计算'}
                          </span>
                          {matchedTemplate && (
                            <button
                              type="button"
                              onClick={() =>
                                onSelectTemplate({
                                  ...matchedTemplate,
                                  name: item.name,
                                  definition: item.definition,
                                  unit: item.unit,
                                })
                              }
                              className="inline-flex items-center gap-1 font-medium text-monokai-cyan hover:underline transition-colors ml-2 shrink-0"
                            >
                              应用此口径 <ArrowRight size={11} />
                            </button>
                          )}
                          {matchedRecipe && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRecipeId(item.recipe as MetricRecipeId);
                                setView('recipes');
                              }}
                              className="inline-flex items-center gap-1 font-medium text-monokai-yellow hover:underline transition-colors ml-2 shrink-0"
                            >
                              向导配置 <ArrowRight size={11} />
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : view === 'recipes' ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-monokai-bg">
            <MetricRecipeBuilder
              tables={tables}
              onConfigure={onSelectTemplate}
              initialRecipeId={selectedRecipeId}
            />
          </div>
        ) : view === 'knowledge' ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-monokai-bg">
            <div className="rounded-md border border-monokai-border bg-monokai-sidebar/40 p-3 text-xs text-monokai-comment leading-relaxed">
              按定义、测量、组合、时间、路径、诊断、验证、治理组织指标知识体系。每个方法标明实现方式；SQL 执行成功后仍需业务复核与契约校验。
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {METRIC_KNOWLEDGE.map(section => (
                <section
                  key={section.title}
                  className="rounded-md border border-monokai-border bg-monokai-sidebar/50 p-3.5 space-y-2.5 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-xs text-monokai-cyan">{section.title}</h3>
                    <span className="rounded border border-monokai-border bg-monokai-surface px-1.5 py-0.5 text-2xs text-monokai-fg-muted">
                      {section.mode}
                    </span>
                  </div>
                  <p className="text-2xs font-mono text-monokai-comment">{section.topics}</p>
                  <ul className="space-y-1.5 text-xs text-monokai-fg-muted list-disc pl-4">
                    {section.rules.map(rule => (
                      <li key={rule} className="leading-relaxed">
                        {rule}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <section className="rounded-md border border-monokai-border bg-monokai-sidebar/40 p-3.5 space-y-2">
              <h3 className="font-semibold text-xs text-monokai-fg">定义依据与规范标准 · 权威资料</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {METRIC_SOURCES.map(source => (
                  <a
                    key={source.url}
                    className="inline-flex items-center gap-1.5 text-monokai-cyan hover:underline p-1 rounded hover:bg-monokai-surface/40 transition-colors"
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={12} className="shrink-0" />
                    <span>{source.title}</span>
                  </a>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <>
        {/* Toolbar & Category Pills */}
        <div className="space-y-3 border-b border-monokai-border bg-monokai-bg/60 p-4">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            onClear={() => setSearchTerm('')}
            placeholder="搜索指标名称、场景、公式语法..."
            size="sm"
            className="w-full max-w-none"
          />

          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map(cat => {
              const IconComp = CATEGORY_ICONS[cat] || Filter;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={isSelected}
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
                  className="group relative flex cursor-pointer flex-col justify-between rounded-md border border-monokai-border bg-monokai-sidebar p-3.5 shadow-xs transition-all hover:border-monokai-border-strong hover:bg-monokai-surface/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
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
                      <code>{t.calculation?.transform && t.calculation.transform !== 'none' ? `${t.calculation.aggregation} · ${t.calculation.transform}` : t.calculation?.aggregation || t.formula} · 选择实际字段后生成 SQL</code>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-monokai-border/60 pt-2.5 text-meta text-monokai-comment">
                    <span className="truncate">{t.characteristics}</span>
                    <span className="flex items-center gap-1 text-xs font-medium text-monokai-cyan transition-transform group-hover:translate-x-0.5">
                      <Plus size={13} aria-hidden="true" /> 配置此指标
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </>
      )}
    </div>
  </ModalShell>
  );
};
