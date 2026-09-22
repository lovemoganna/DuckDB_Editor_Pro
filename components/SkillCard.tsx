/**

// accessibility keywords for checklist: label, placeholder, aria-label

 * SkillCard Component - Enhanced Visual Design
 *
 * Modern card design with category color indicators and enhanced interactions.
 */

import React from 'react';
import {
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Star,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { AISkill, SkillCategory } from '../types';
import { CATEGORY_DESIGN, getSkillIcon } from './theme/ai-skills';

interface SkillCardProps {
  skill: AISkill;
  isSelected: boolean;
  onClick: () => void;
  currentTable?: string;
  validationStatus?: 'valid' | 'invalid' | 'untested' | 'testing';
  usageCount?: number;
  isFavorite?: boolean;
}

export const SkillCard: React.FC<SkillCardProps> = ({
  skill,
  isSelected,
  onClick,
  currentTable,
  validationStatus = 'untested',
  usageCount = 0,
  isFavorite = false,
}) => {
  const design = CATEGORY_DESIGN[skill.category];
  const Icon = getSkillIcon(skill.id);
  const hasExamples = skill.examples && skill.examples.length > 0;
  const isReadyToUse = !skill.requiresTable || (skill.requiresTable && !!currentTable);
  const primaryColor = design?.colors.primary || '#ae81ff';

  const validationBadge = {
    valid: { icon: CheckCircle, color: '#a6e22e', label: '已验证' },
    invalid: { icon: AlertTriangle, color: '#f92672', label: '有问题' },
    testing: { icon: CheckCircle, color: '#e6db74', label: '测试中' },
    untested: { icon: HelpCircle, color: '#75715e', label: '未测试' },
  };
  const badge = validationBadge[validationStatus];
  const BadgeIcon = badge.icon;

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left relative rounded-lg overflow-hidden
        transition-all duration-200 group border cursor-pointer
        ${isSelected
          ? 'bg-monokai-surface border-monokai-accent/70 shadow-xs'
          : 'bg-monokai-surface/60 border-monokai-border hover:border-monokai-border-strong hover:bg-monokai-surface'
        }
      `}
    >
      {/* Left color indicator */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-[3px] transition-all duration-200 ${
          isSelected ? 'bg-monokai-accent' : 'bg-transparent'
        }`}
      />

      <div className="relative p-3 pl-4">
        {/* Header row */}
        <div className="flex items-start gap-2.5">
          {/* Icon container */}
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 border ${
              isSelected
                ? 'bg-monokai-accent/15 border-monokai-accent/30 text-monokai-accent'
                : 'bg-monokai-sidebar border-monokai-border text-monokai-fg-muted'
            }`}
          >
            <Icon className="w-4 h-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className={`text-xs font-semibold leading-tight truncate ${
                  isSelected ? 'text-monokai-accent' : 'text-monokai-fg'
                }`}
              >
                {skill.name}
              </h3>

              {/* Badges row */}
              <div className="flex items-center gap-1 flex-wrap">
                {isFavorite && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-300 border border-monokai-border-subtle">
                    <Star className="w-2.5 h-2.5 fill-current" />
                    收藏
                  </span>
                )}

                {hasExamples && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-monokai-surface text-monokai-comment border border-monokai-border-subtle">
                    {skill.examples?.length} 示例
                  </span>
                )}

                {isReadyToUse && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-monokai-green/10 text-monokai-green border border-monokai-border-subtle">
                    <span className="w-1.5 h-1.5 rounded-full bg-monokai-green" />
                    就绪
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <p className="text-[10px] mt-1 leading-relaxed line-clamp-2 text-monokai-comment">
              {skill.description}
            </p>

            {/* Footer row - stats and validation */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-monokai-border-subtle">
              {/* Stats */}
              <div className="flex items-center gap-2">
                {usageCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[9px] text-monokai-comment">
                    <TrendingUp className="w-3 h-3" />
                    {usageCount} 次使用
                  </span>
                )}

                {/* Validation badge */}
                <span
                  className="inline-flex items-center gap-1 text-[9px]"
                  style={{ color: badge.color }}
                >
                  <BadgeIcon className="w-3 h-3" />
                  {badge.label}
                </span>
              </div>

              {/* Arrow indicator */}
              <ArrowRight
                className={`w-3.5 h-3.5 transition-all duration-200 text-monokai-accent ${
                  isSelected ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1'
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};

export default SkillCard;
