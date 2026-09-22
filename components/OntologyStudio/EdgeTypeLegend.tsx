import React, { useState, useMemo } from 'react';
import { Link2, Eye, EyeOff, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useOntologyStudioStore } from '../../hooks/useOntologyStudioStore';
import { LINK_TYPE_COLOR_TOKENS } from '../Library/ontologyStyles';
import type { RelationCardinality } from '../../types/ontologyStudioTypes';

const ALL_CARDINALITIES: RelationCardinality[] = ['1:1', '1:N', 'N:1', 'N:M'];

export const EdgeTypeLegend: React.FC = () => {
  const {
    relations,
    hiddenCardinalities,
    toggleCardinalityVisibility,
    setAllCardinalitiesVisible,
  } = useOntologyStudioStore();

  const [collapsed, setCollapsed] = useState(false);

  const counts = useMemo(() => {
    const acc: Record<RelationCardinality, number> = {
      '1:1': 0,
      '1:N': 0,
      'N:1': 0,
      'N:M': 0,
    };
    relations.forEach((r) => {
      acc[r.cardinality] = (acc[r.cardinality] ?? 0) + 1;
    });
    return acc;
  }, [relations]);

  const hiddenCount = hiddenCardinalities.length;

  return (
    <div
      className="absolute top-4 right-4 z-30 select-none"
      data-testid="edge-type-legend"
    >
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-monokai-surface/95 border border-monokai-border shadow-md text-monokai-fg hover:border-white/20 transition-colors cursor-pointer"
          title="展开关系类型图例"
        >
          <Link2 className="w-3.5 h-3.5 text-monokai-cyan" />
          <span className="text-xs font-mono">
            图例
            {hiddenCount > 0 && (
              <span className="ml-1 px-1 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 text-2xs">
                隐藏 {hiddenCount}
              </span>
            )}
          </span>
          <ChevronDown className="w-3 h-3 text-monokai-comment" />
        </button>
      ) : (
        <div className="w-56 rounded-lg bg-monokai-surface/95 backdrop-blur-md border border-monokai-border shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-monokai-border">
            <div className="flex items-center gap-2 min-w-0">
              <Link2 className="w-3.5 h-3.5 text-monokai-cyan shrink-0" />
              <span className="text-xs font-semibold text-monokai-fg">关系类型图例</span>
              <span className="text-xs font-mono text-monokai-comment">
                {relations.length} 条
              </span>
            </div>
            <div className="flex items-center gap-1">
              {hiddenCount > 0 && (
                <button
                  onClick={() => setAllCardinalitiesVisible()}
                  className="text-xs text-monokai-cyan hover:underline px-1 cursor-pointer"
                  title="全部显示"
                >
                  全显
                </button>
              )}
              <button
                onClick={() => setCollapsed(true)}
                className="p-0.5 text-monokai-comment hover:text-monokai-fg cursor-pointer"
                title="折叠图例"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="p-1.5 space-y-0.5">
            {ALL_CARDINALITIES.map((card) => {
              const info = LINK_TYPE_COLOR_TOKENS[card];
              const count = counts[card] ?? 0;
              const isHidden = hiddenCardinalities.includes(card);
              return (
                <div
                  key={card}
                  className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded text-xs font-mono transition-colors ${
                    isHidden
                      ? 'bg-monokai-bg/60 text-monokai-comment'
                      : 'text-monokai-fg-muted hover:bg-monokai-bg'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded shrink-0"
                      style={{
                        backgroundColor: isHidden ? 'rgba(113,113,122,0.4)' : info.color,
                        border: `1px solid ${info.color}80`,
                      }}
                    />
                    <span
                      className="font-semibold shrink-0"
                      style={{ color: isHidden ? undefined : info.color }}
                    >
                      {card}
                    </span>
                    <span className="text-monokai-comment truncate">{info.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-monokai-comment text-xs">{count}</span>
                    <button
                      onClick={() => toggleCardinalityVisibility(card)}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        isHidden
                          ? 'text-monokai-comment hover:text-monokai-accent'
                          : 'text-monokai-accent hover:text-monokai-fg'
                      }`}
                      title={isHidden ? '显示该类型' : '隐藏该类型'}
                      disabled={count === 0 && !isHidden}
                    >
                      {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-3 py-1.5 border-t border-monokai-border text-xs text-monokai-comment leading-relaxed flex items-start gap-1">
            <Sparkles className="w-3 h-3 mt-0.5 text-monokai-cyan shrink-0" />
            <span>颜色按关系基数区分，常驻 dash 表示多对多关系</span>
          </div>
        </div>
      )}
    </div>
  );
};

EdgeTypeLegend.displayName = 'OntologyStudio_EdgeTypeLegend';
export default EdgeTypeLegend;
