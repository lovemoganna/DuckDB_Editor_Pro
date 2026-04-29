/**
 * AbstractionPathTag — 抽象路径标签组件
 */

import React from 'react';
import { LEVEL_CONFIG } from '../../types/abstraction';
import { AbstractionTable } from '../../types';

// 静态颜色映射（解决 Tailwind 动态类名问题）
const LEVEL_COLOR_CLASSES: Record<string, string> = {
  purple: 'bg-monokai-purple/20 text-monokai-purple',
  blue:   'bg-monokai-blue/20 text-monokai-blue',
  green:  'bg-monokai-green/20 text-monokai-green',
  yellow: 'bg-monokai-yellow/20 text-monokai-yellow',
  red:    'bg-monokai-red/20 text-monokai-red',
  pink:   'bg-monokai-pink/20 text-monokai-pink',
  orange: 'bg-monokai-orange/20 text-monokai-orange',
  cyan:   'bg-monokai-cyan/20 text-monokai-cyan',
  fg:     'bg-monokai-fg/20 text-monokai-fg',
};

const LEVEL_BORDER_CLASSES: Record<string, string> = {
  purple: 'border-monokai-purple/30',
  blue:   'border-monokai-blue/30',
  green:  'border-monokai-green/30',
  yellow: 'border-monokai-yellow/30',
  red:    'border-monokai-red/30',
  pink:   'border-monokai-pink/30',
  orange: 'border-monokai-orange/30',
  cyan:   'border-monokai-cyan/30',
  fg:     'border-monokai-fg/30',
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
