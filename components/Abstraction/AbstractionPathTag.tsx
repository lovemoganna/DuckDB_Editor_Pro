/**
 * AbstractionPathTag — 抽象路径标签组件
 */

import React from 'react';
import { LEVEL_CONFIG } from '../../types/abstraction';
import { AbstractionTable } from '../../types';

// 静态颜色映射（解决 Tailwind 动态类名问题）
// 静态颜色映射（解决 Tailwind 动态类名问题）
const LEVEL_COLOR_CLASSES: Record<string, string> = {
  amethyst: 'bg-monokai-surface text-monokai-fg-muted border border-monokai-border-subtle',
  blue:   'bg-monokai-surface text-monokai-fg-muted border border-monokai-border-subtle',
  green:  'bg-monokai-surface text-monokai-fg-muted border border-monokai-border-subtle',
  yellow: 'bg-monokai-surface text-monokai-fg-muted border border-monokai-border-subtle',
  red:    'bg-monokai-surface text-monokai-fg-muted border border-monokai-border-subtle',
  pink:   'bg-monokai-surface text-monokai-fg-muted border border-monokai-border-subtle',
  orange: 'bg-monokai-surface text-monokai-fg-muted border border-monokai-border-subtle',
  cyan:   'bg-monokai-surface text-monokai-fg-muted border border-monokai-border-subtle',
  fg:     'bg-monokai-surface text-monokai-fg-muted border border-monokai-border-subtle',
};

const LEVEL_BORDER_CLASSES: Record<string, string> = {
  amethyst: 'border-monokai-border-subtle',
  blue:   'border-monokai-border-subtle',
  green:  'border-monokai-border-subtle',
  yellow: 'border-monokai-border-subtle',
  red:    'border-monokai-border-subtle',
  pink:   'border-monokai-border-subtle',
  orange: 'border-monokai-border-subtle',
  cyan:   'border-monokai-border-subtle',
  fg:     'border-monokai-border-subtle',
};

interface AbstractionPathTagProps {
  path: AbstractionTable['abstractionPath'];
  size?: 'sm' | 'md' | 'lg';
  separator?: string;
}

export const AbstractionPathTag: React.FC<AbstractionPathTagProps> = ({
  path,
  size = 'md',
  separator = '/',
}) => {
  const levels = Object.entries(path).filter(([, v]) => Boolean(v));

  if (levels.length === 0) {
    return null;
  }

  const sizeClasses = {
    sm: 'text-[10px] px-1 py-0.5',
    md: 'text-xs px-1.5 py-0.5',
    lg: 'text-sm px-2 py-1',
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {levels.map(([level, value], idx) => {
        const levelConfig = LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG];
        const color = levelConfig?.color || 'fg';
        const colorClass = LEVEL_COLOR_CLASSES[color] || LEVEL_COLOR_CLASSES.fg;

        return (
          <React.Fragment key={level}>
            {idx > 0 && (
              <span className={`text-monokai-comment ${size === 'sm' ? 'text-[8px]' : 'text-xs'}`}>
                {separator}
              </span>
            )}
            <span className={`rounded font-medium ${colorClass} ${sizeClasses[size]}`}>
              {value}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default AbstractionPathTag;
