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
        transition-all duration-200 group
        ${isSelected
          ? 'ring-1 ring-offset-1'
          : 'hover:ring-1 hover:ring-offset-1'
        }
      `}
      style={{
        backgroundColor: isSelected ? `${primaryColor}10` : '#272822',
        borderColor: isSelected ? primaryColor : '#3e3d32',
        borderWidth: '1px',
      }}
    >
      {/* Left color indicator */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] transition-all duration-200"
        style={{
          backgroundColor: isSelected ? primaryColor : 'transparent',
        }}
      />

      <div className="relative p-3 pl-4">
        {/* Header row */}
        <div className="flex items-start gap-2.5">
          {/* Icon container */}
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200"
            style={{
              backgroundColor: `${primaryColor}15`,
              borderWidth: '1px',
              borderColor: isSelected ? primaryColor : '#3e3d32',
            }}
          >
            <Icon
              className="w-4 h-4 transition-colors"
              style={{ color: primaryColor }}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="text-xs font-semibold leading-tight truncate"
                style={{ color: isSelected ? primaryColor : '#f8f8f2' }}
              >
                {skill.name}
              </h3>

              {/* Badges row */}
              <div className="flex items-center gap-1 flex-wrap">
                {isFavorite && (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium"
                    style={{ backgroundColor: '#f1fa8c20', color: '#f1fa8c' }}
                  >
                    <Star className="w-2.5 h-2.5 fill-current" />
                    收藏
                  </span>
                )}

                {hasExamples && (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono"
                    style={{ backgroundColor: '#ae81ff15', color: '#ae81ff' }}
                  >
                    {skill.examples?.length} 示例
                  </span>
                )}

                {isReadyToUse && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
                    style={{ backgroundColor: '#a6e22e15', color: '#a6e22e' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#a6e22e' }} />
                    就绪
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <p
              className="text-[10px] mt-1 leading-relaxed line-clamp-2"
              style={{ color: '#75715e' }}
            >
              {skill.description}
            </p>

            {/* Footer row - stats and validation */}
            <div className="flex items-center justify-between mt-2 pt-2"
              style={{ borderTopWidth: '1px', borderColor: '#3e3d3230' }}
            >
              {/* Stats */}
              <div className="flex items-center gap-2">
                {usageCount > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-[9px]"
                    style={{ color: '#75715e' }}
                  >
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
                className="w-4 h-4 transition-all duration-200"
                style={{
                  color: primaryColor,
                  opacity: isSelected ? 1 : 0,
                  transform: isSelected ? 'translateX(0)' : 'translateX(-4px)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Hover overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}05 0%, transparent 50%)`,
        }}
      />
    </button>
  );
};

export default SkillCard;
