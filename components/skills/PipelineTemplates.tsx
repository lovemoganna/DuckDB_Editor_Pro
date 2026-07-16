/**
 * PipelineTemplates - Template gallery for quick skill chain setup
 *
 * Shows preset pipeline templates that users can load with one click.
 */

import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Zap,
  BarChart3,
  Wrench,
  Layers,
} from 'lucide-react';
import { PipelineTemplate, PIPELINE_TEMPLATES, TEMPLATE_CATEGORIES } from '../../services/skill/pipelineTemplates';
import { templateToSkillChain } from '../../services/skill/pipelineTemplates';

interface PipelineTemplatesProps {
  onSelectTemplate: (template: PipelineTemplate) => void;
  onCreateCustom?: () => void;
  className?: string;
}

export const PipelineTemplates: React.FC<PipelineTemplatesProps> = ({
  onSelectTemplate,
  onCreateCustom,
  className = '',
}) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('analysis');
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);

  const getCategoryIcon = (categoryId: string) => {
    switch (categoryId) {
      case 'analysis': return BarChart3;
      case 'modeling': return Layers;
      case 'wrangling': return Wrench;
      case 'engineering': return Zap;
      default: return Layers;
    }
  };

  return (
    <div className={`p-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-monokai-amethyst" />
          <span className="text-xs font-medium text-monokai-fg font-sans">Pipeline 模板</span>
        </div>
        {onCreateCustom && (
          <button
            onClick={onCreateCustom}
            className="flex items-center gap-1 px-2 py-1 text-[10px] border border-monokai-amethyst/40 text-monokai-amethyst hover:bg-monokai-amethyst/10 rounded transition-colors"
          >
            <Plus className="w-3 h-3" />
            自定义
          </button>
        )}
      </div>

      {/* Category accordion */}
      <div className="space-y-1">
        {TEMPLATE_CATEGORIES.map(cat => {
          const templates = PIPELINE_TEMPLATES.filter(t => t.category === cat.id);
          const isExpanded = expandedCategory === cat.id;
          const Icon = getCategoryIcon(cat.id);

          return (
            <div key={cat.id}>
              {/* Category header */}
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] font-medium text-monokai-comment hover:bg-monokai-sidebar rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <span style={{ color: cat.color }}>{cat.icon}</span>
                <span>{cat.name}</span>
                <span className="ml-auto text-[9px] opacity-60">({templates.length})</span>
              </button>

              {/* Templates in category */}
              {isExpanded && (
                <div className="ml-4 mt-1 space-y-1 border-l border-monokai-accent/30 pl-2">
                  {templates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => onSelectTemplate(template)}
                      onMouseEnter={() => setHoveredTemplate(template.id)}
                      onMouseLeave={() => setHoveredTemplate(null)}
                      className={`w-full text-left px-2 py-2 rounded border transition-all ${
                        hoveredTemplate === template.id
                          ? 'bg-monokai-sidebar border-monokai-amethyst/40'
                          : 'bg-transparent border-transparent hover:bg-monokai-bg hover:border-monokai-accent/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{template.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium text-monokai-fg truncate">
                            {template.name}
                          </div>
                          <div className="text-[9px] text-monokai-comment line-clamp-1">
                            {template.description}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[9px] text-monokai-amethyst font-mono">
                            {template.steps.length}步
                          </span>
                          <ChevronRight className="w-3 h-3 text-monokai-comment" />
                        </div>
                      </div>

                      {/* Tags */}
                      {hoveredTemplate === template.id && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.tags.map(tag => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 text-[9px] bg-monokai-bg text-monokai-comment rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick stats */}
      <div className="mt-4 pt-3 border-t border-monokai-accent/30">
        <div className="flex items-center justify-between text-[10px] text-monokai-comment">
          <span>共 {PIPELINE_TEMPLATES.length} 个模板</span>
          <span className="text-monokai-amethyst">点击加载</span>
        </div>
      </div>
    </div>
  );
};

export default PipelineTemplates;
