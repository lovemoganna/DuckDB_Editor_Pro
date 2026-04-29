/**
 * SkillPill - Compact skill pill/tag component
 *
 * A reusable, styled pill tag for displaying skill names
 * in compact contexts (recommendation strips, filters, chips)
 */

import React from 'react';
import { ChevronRight, ArrowUpRight } from 'lucide-react';
import { AISkill, SkillCategory } from '../../types';
import {
  CATEGORY_THEME,
  getCategoryTheme,
} from '../theme/monokai';

interface SkillPillProps {
  skill: AISkill;
  variant?: 'default' | 'compact' | 'interactive';
  size?: 'sm' | 'md';
  showArrow?: boolean;
  isActive?: boolean;
  animationDelay?: number;
  onClick?: () => void;
}

export const SkillPill: React.FC<SkillPillProps> = ({
  skill,
  variant = 'default',
  size = 'sm',
  showArrow = false,
  isActive = false,
  animationDelay = 0,
  onClick,
}) => {
  const theme = CATEGORY_THEME[skill.category];
  const c = theme.colors;

  const baseClasses = [
    'inline-flex items-center gap-1.5',
    'rounded-full border font-medium',
    'transition-all duration-200',
    'cursor-pointer',
    size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs',
  ].join(' ');

  const activeClasses = `${c.bg} ${c.border} ${c.text}`;
  const defaultClasses = isActive
    ? activeClasses
    : 'bg-monokai-bg border-monokai-accent/40 text-monokai-comment hover:border-monokai-accent hover:text-monokai-fg';

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${defaultClasses} skill-pill`}
      style={animationDelay > 0 ? { animationDelay: `${animationDelay}ms` } : undefined}
      type="button"
    >
      {variant !== 'compact' && (
        <span className="font-sans font-medium">{skill.name}</span>
      )}
      {variant === 'compact' && (
        <>
          <span className="font-sans font-medium truncate max-w-[80px]">{skill.name}</span>
        </>
      )}
      {showArrow && (
        <ArrowUpRight className="w-2.5 h-2.5 opacity-60 shrink-0" />
      )}
      {!showArrow && isActive && (
        <ChevronRight className={`w-2.5 h-2.5 opacity-60 shrink-0 ${c.icon}`} />
      )}
    </button>
  );
};

/** Category badge pill */
interface CategoryBadgeProps {
  category: SkillCategory;
  count?: number;
  isActive?: boolean;
  size?: 'sm' | 'md';
  onClick?: () => void;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  category,
  count,
  isActive = false,
  size = 'sm',
  onClick,
}) => {
  const theme = CATEGORY_THEME[category];
  const c = theme.colors;

  const sizeClasses = size === 'sm'
    ? 'px-2 py-1 text-[11px]'
    : 'px-3 py-1.5 text-xs';

  return (
    <button
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5',
        'rounded-lg border font-medium font-sans',
        'transition-all duration-200',
        sizeClasses,
        isActive
          ? `${c.bg} ${c.border} ${c.text}`
          : 'bg-monokai-bg border-monokai-accent text-monokai-comment hover:text-monokai-fg hover:border-monokai-accent/80',
      ].join(' ')}
      type="button"
    >
      <span>{theme.emoji}</span>
      <span>{theme.label}</span>
      {count !== undefined && (
        <span className="opacity-60">({count})</span>
      )}
    </button>
  );
};

/** All categories filter badge */
interface AllBadgeProps {
  total: number;
  isActive?: boolean;
  onClick?: () => void;
}

export const AllBadge: React.FC<AllBadgeProps> = ({
  total,
  isActive = false,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={[
        'px-2 py-1 text-[11px] font-medium rounded-lg border',
        'transition-all duration-200 font-sans',
        'inline-flex items-center gap-1',
        isActive
          ? 'bg-monokai-purple/20 border-monokai-purple/50 text-monokai-purple'
          : 'bg-monokai-bg border-monokai-accent text-monokai-comment hover:text-monokai-fg hover:border-monokai-accent/80',
      ].join(' ')}
      type="button"
    >
      所有 ({total})
    </button>
  );
};

export default SkillPill;
