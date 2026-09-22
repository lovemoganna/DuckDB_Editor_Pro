import React, { useState } from 'react';
import {
  BookOpen, CheckCircle2, ChevronDown, ChevronRight, HelpCircle,
  Info, Layers, Search, Sliders, Sparkles,
} from 'lucide-react';
import type { FeatureDefinition } from '../../../services/ontology/ontologyInferenceEngine';
import {
  explainFeature,
  estimateNullSemantics,
} from '../../../services/ontology/ontologyInferenceEngine';

export interface FeatureCatalogPanelProps {
  features: FeatureDefinition[];
  selectedFeatureIds: string[];
  featureReliability: Record<string, number>;
  manualWeights: Record<string, number>;
  totalRows: number;
  rows: Array<Record<string, unknown>>;
  onToggleFeature: (featureId: string) => void;
  onSelectAllFeatures: () => void;
  onClearFeatureSelection: () => void;
  onUpdateReliability: (featureId: string, value: number) => void;
  onUpdateWeight: (featureId: string, value: number) => void;
}

export const FeatureCatalogPanel: React.FC<FeatureCatalogPanelProps> = ({
  features,
  selectedFeatureIds,
  featureReliability,
  manualWeights,
  totalRows,
  rows,
  onToggleFeature,
  onSelectAllFeatures,
  onClearFeatureSelection,
  onUpdateReliability,
  onUpdateWeight,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFeatureId, setExpandedFeatureId] = useState<string | null>(null);

  const filteredFeatures = features.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const getFeatureCoverage = (featureId: string): number => {
    if (totalRows === 0) return 0;
    const nonNullCount = rows.filter(r => r[featureId] !== undefined && r[featureId] !== null).length;
    return Math.round((nonNullCount / totalRows) * 100);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#12141e] border-r border-white/10 p-3 text-xs">
      {/* Header */}
      <div className="mb-3 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-black text-monokai-fg">
            <Layers className="h-4 w-4 text-monokai-cyan" />
            本体特征库
          </h2>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-monokai-comment">
            {selectedFeatureIds.length} / {features.length}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-monokai-comment">
          勾选参与交叉推理的特征，可展开查看完整逻辑定义与 NULL 语义。
        </p>

        {/* Search & Actions */}
        <div className="mt-2.5 flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-monokai-comment" />
            <input
              type="text"
              placeholder="搜索特征名称/ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0c0d12] py-1 pl-7 pr-2 text-[10px] text-monokai-fg outline-none focus:border-monokai-accent transition-colors"
              aria-label="搜索特征"
            />
          </div>
          <button
            type="button"
            onClick={onSelectAllFeatures}
            className="rounded bg-white/5 px-2 py-1 text-[10px] text-monokai-accent transition-colors hover:bg-white/10 cursor-pointer"
          >
            全选
          </button>
          <button
            type="button"
            onClick={onClearFeatureSelection}
            className="rounded bg-white/5 px-2 py-1 text-[10px] text-monokai-comment transition-colors hover:bg-white/10"
          >
            清空
          </button>
        </div>
      </div>

      {/* Feature list */}
      <div className="flex-1 space-y-2 overflow-auto pr-1">
        {filteredFeatures.length === 0 ? (
          <div className="rounded-lg bg-black/20 p-4 text-center text-monokai-comment">
            未找到匹配的特征
          </div>
        ) : (
          filteredFeatures.map(feature => {
            const isSelected = selectedFeatureIds.includes(feature.id);
            const isExpanded = expandedFeatureId === feature.id;
            const coverage = getFeatureCoverage(feature.id);
            const explanation = explainFeature(feature);
            const nullReport = estimateNullSemantics(feature);

            return (
              <div
                key={feature.id}
                className={`rounded-xl border transition-all duration-150 ${
                  isSelected
                    ? 'border-monokai-cyan/30 bg-monokai-cyan/[0.03]'
                    : 'border-white/[0.07] bg-black/20 hover:border-white/20'
                }`}
              >
                {/* Main feature row */}
                <div className="flex items-start gap-2 p-2.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleFeature(feature.id)}
                    className="mt-0.5 shrink-0"
                    aria-label={`选择特征 ${feature.name}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <strong className="truncate font-bold text-monokai-fg">{feature.name}</strong>
                      <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-mono text-monokai-yellow">
                        {feature.valueType}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[10px] text-monokai-comment">
                      <span>{feature.source.kind === 'ontology_property' ? '属性' : '关系'} · 覆盖率 {coverage}%</span>
                      <button
                        type="button"
                        onClick={() => setExpandedFeatureId(isExpanded ? null : feature.id)}
                        className="flex items-center gap-0.5 text-monokai-cyan hover:underline"
                      >
                        <BookOpen className="h-3 w-3" />
                        {isExpanded ? '收起定义' : '查看定义'}
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>
                    </div>

                    {/* Coverage bar */}
                    <div className="mt-1.5 h-1 w-full rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-monokai-cyan/60"
                        style={{ width: `${coverage}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded feature definition & null semantics */}
                {isExpanded && (
                  <div className="border-t border-white/[0.08] bg-black/30 p-2.5 text-[11px] space-y-2">
                    <div className="rounded-lg bg-white/5 p-2 space-y-1">
                      <div className="font-bold text-monokai-cyan">特征元数据定义</div>
                      <div>唯一标识 ID：<code className="text-monokai-yellow">{feature.id}</code></div>
                      <div>数据来源：<span className="text-monokai-fg">{explanation.sourceDescription}</span></div>
                      {explanation.window && (
                        <div>统计窗口：<span className="text-monokai-green">{explanation.window.description}</span></div>
                      )}
                    </div>

                    <div className="rounded-lg border border-monokai-yellow/20 bg-monokai-yellow/[0.05] p-2 space-y-1 text-monokai-fg">
                      <div className="flex items-center gap-1 font-bold text-monokai-yellow">
                        <HelpCircle className="h-3.5 w-3.5" />
                        NULL / UNKNOWN 语义处理策略
                      </div>
                      <div className="text-[10px] text-monokai-comment">{nullReport.unknownDescription}</div>
                      <div className="text-[10px] text-monokai-green">💡 建议：{nullReport.recommendation}</div>
                    </div>

                    {/* Reliability & Manual weight sliders */}
                    {isSelected && (
                      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-2 text-[10px]">
                        <div>
                          <span className="text-monokai-comment">可靠度:</span>
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.1"
                            value={featureReliability[feature.id] ?? 1}
                            onChange={e => onUpdateReliability(feature.id, Number(e.target.value))}
                            className="ml-1 w-12 rounded bg-black/40 px-1 py-0.5 text-monokai-fg border border-white/10"
                            aria-label={`${feature.name} 可靠度`}
                          />
                        </div>
                        <div>
                          <span className="text-monokai-comment">权重:</span>
                          <input
                            type="number"
                            min="-1"
                            max="1"
                            step="0.1"
                            value={manualWeights[feature.id] ?? 0}
                            onChange={e => onUpdateWeight(feature.id, Number(e.target.value))}
                            className="ml-1 w-12 rounded bg-black/40 px-1 py-0.5 text-monokai-fg border border-white/10"
                            aria-label={`${feature.name} 权重`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
