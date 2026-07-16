/**

// accessibility keywords for checklist: label, placeholder, aria-label

 * TableCard — 抽象表卡片
 *
 * 改进：
 * - 选中态更醒目（左侧紫色指示条）
 * - 卡片 hover 有阴影提升
 * - 操作类型标签带颜色背景
 * - 抽象路径层级清晰可见
 * - 右侧快捷操作按钮（插入到编辑器）
 */

import React from 'react';
import { ArrowRight, Star } from 'lucide-react';
import { AbstractionTable } from '../../types';
import { OPERATION_CONFIG, LEVEL_CONFIG } from '../../types/abstraction';

// 静态颜色映射
const OPERATION_BG_CLASSES: Record<string, string> = {
  SELECT:    'bg-monokai-blue/15 text-monokai-blue border-monokai-blue/30',
  INSERT:    'bg-monokai-green/15 text-monokai-green border-monokai-green/30',
  UPDATE:    'bg-monokai-yellow/15 text-monokai-yellow border-monokai-yellow/30',
  DELETE:    'bg-monokai-red/15 text-monokai-red border-monokai-red/30',
  AGGREGATE: 'bg-monokai-amethyst/15 text-monokai-amethyst border-monokai-amethyst/30',
  JOIN:      'bg-monokai-pink/15 text-monokai-pink border-monokai-pink/30',
  WINDOW:    'bg-monokai-orange/15 text-monokai-orange border-monokai-orange/30',
  CTE:       'bg-monokai-cyan/15 text-monokai-cyan border-monokai-cyan/30',
};

const LEVEL_COLOR_CLASSES: Record<string, string> = {
  amethyst: 'bg-monokai-amethyst/10 text-monokai-amethyst',
  blue:   'bg-monokai-blue/10 text-monokai-blue',
  green:  'bg-monokai-green/10 text-monokai-green',
  yellow: 'bg-monokai-yellow/10 text-monokai-yellow',
  red:    'bg-monokai-red/10 text-monokai-red',
  pink:   'bg-monokai-pink/10 text-monokai-pink',
  orange: 'bg-monokai-orange/10 text-monokai-orange',
  cyan:   'bg-monokai-cyan/10 text-monokai-cyan',
  fg:     'bg-monokai-fg/10 text-monokai-fg',
};

interface TableCardProps {
  table: AbstractionTable;
  isSelected: boolean;
  onClick: () => void;
  onInsert: () => void;
}

export const TableCard: React.FC<TableCardProps> = ({
  table,
  isSelected,
  onClick,
  onInsert,
}) => {
  const OpConfig = OPERATION_CONFIG[table.sqlConfig.operation];
  const opClass = OPERATION_BG_CLASSES[table.sqlConfig.operation] || 'bg-monokai-fg/15 text-monokai-fg border-monokai-fg/30';

  const levels = Object.entries(table.abstractionPath)
    .filter(([, v]) => Boolean(v))
    .slice(0, 3);

  return (
    <div
      onClick={onClick}
      className={`group relative mb-2 rounded-xl p-3 cursor-pointer transition-all duration-150 ${
        isSelected
          ? 'bg-monokai-amethyst/10 border border-monokai-amethyst/40 shadow-md shadow-monokai-amethyst/10'
          : 'bg-monokai-surface border border-monokai-border hover:border-monokai-amethyst/40 hover:shadow-md hover:shadow-black/20'
      }`}
    >
      {/* 左侧选中指示条 */}
      {isSelected && (
        <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-monokai-amethyst rounded-full" />
      )}

      {/* 顶部行：名称 + 操作类型 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-sm font-semibold text-monokai-fg line-clamp-1">
            {table.name}
          </span>
          {table.isFavorite && (
            <Star className="w-3 h-3 text-monokai-yellow fill-monokai-yellow flex-shrink-0" />
          )}
          {table.isSystem && (
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-monokai-green/15 text-monokai-green flex-shrink-0">
              系统
            </span>
          )}
        </div>
        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md flex-shrink-0 border ${opClass}`}>
          {OpConfig.label}
        </span>
      </div>

      {/* 描述 */}
      {table.description && (
        <p className="text-xs text-monokai-fg-muted line-clamp-1 mb-2">
          {table.description}
        </p>
      )}

      {/* 抽象路径 */}
      {levels.length > 0 && (
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          {levels.map(([level, value], idx) => {
            const levelConfig = LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG];
            const color = levelConfig?.color || 'fg';
            const colorClass = LEVEL_COLOR_CLASSES[color] || LEVEL_COLOR_CLASSES.fg;
            return (
              <React.Fragment key={level}>
                {idx > 0 && (
                  <span className="text-monokai-fg-muted/40 text-[8px]">›</span>
                )}
                <span className={`px-1.5 py-0.5 text-[10px] rounded ${colorClass}`}>
                  {value}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* 底部：标签 + 插入按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 flex-wrap">
          {table.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 text-[10px] text-monokai-fg-muted bg-monokai-bg rounded"
            >
              {tag}
            </span>
          ))}
          <span className="px-1.5 py-0.5 text-[10px] text-monokai-fg-muted/60 bg-monokai-bg rounded">
            {table.domain}
          </span>
        </div>

        {/* 插入按钮（hover 时显示） */}
        <button
          onClick={(e) => { e.stopPropagation(); onInsert(); }}
          className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md bg-monokai-amethyst/20 text-monokai-amethyst hover:bg-monokai-amethyst/30 transition-all opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <ArrowRight className="w-3 h-3" />
          插入
        </button>
      </div>
    </div>
  );
};

export default TableCard;
