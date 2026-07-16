/**
 * abstractionColors — 统一的静态颜色映射
 *
 * 解决 Tailwind 动态类名（bg-monokai-${color}）在运行时无效的问题
 * 所有需要动态颜色的地方统一使用此文件的映射
 */

import { AbstractionSqlOperation } from '../../types';
import { OPERATION_CONFIG } from '../../types/abstraction';

// 操作类型 → 背景色+文字色类名
export const OPERATION_BG_CLASSES: Record<string, string> = {
  SELECT:    'bg-monokai-blue/15 text-monokai-blue',
  INSERT:    'bg-monokai-green/15 text-monokai-green',
  UPDATE:    'bg-monokai-yellow/15 text-monokai-yellow',
  DELETE:    'bg-monokai-red/15 text-monokai-red',
  AGGREGATE: 'bg-monokai-amethyst/15 text-monokai-amethyst',
  JOIN:      'bg-monokai-pink/15 text-monokai-pink',
  WINDOW:    'bg-monokai-orange/15 text-monokai-orange',
  CTE:       'bg-monokai-cyan/15 text-monokai-cyan',
};

// 操作类型 → 边框类名
export const OPERATION_BORDER_CLASSES: Record<string, string> = {
  SELECT:    'border-monokai-blue/30',
  INSERT:    'border-monokai-green/30',
  UPDATE:    'border-monokai-yellow/30',
  DELETE:    'border-monokai-red/30',
  AGGREGATE: 'border-monokai-amethyst/30',
  JOIN:      'border-monokai-pink/30',
  WINDOW:    'border-monokai-orange/30',
  CTE:       'border-monokai-cyan/30',
};

// 操作类型 → 完整标签样式
export const OPERATION_TAG_CLASSES: Record<string, string> = {
  SELECT:    'bg-monokai-blue/15 text-monokai-blue border-monokai-blue/30',
  INSERT:    'bg-monokai-green/15 text-monokai-green border-monokai-green/30',
  UPDATE:    'bg-monokai-yellow/15 text-monokai-yellow border-monokai-yellow/30',
  DELETE:    'bg-monokai-red/15 text-monokai-red border-monokai-red/30',
  AGGREGATE: 'bg-monokai-amethyst/15 text-monokai-amethyst border-monokai-amethyst/30',
  JOIN:      'bg-monokai-pink/15 text-monokai-pink border-monokai-pink/30',
  WINDOW:    'bg-monokai-orange/15 text-monokai-orange border-monokai-orange/30',
  CTE:       'bg-monokai-cyan/15 text-monokai-cyan border-monokai-cyan/30',
};

// 操作类型 → 选中状态样式
export const OPERATION_SELECTED_CLASSES: Record<string, string> = {
  SELECT:    'bg-monokai-blue/20 text-monokai-blue border-monokai-blue/40',
  INSERT:    'bg-monokai-green/20 text-monokai-green border-monokai-green/40',
  UPDATE:    'bg-monokai-yellow/20 text-monokai-yellow border-monokai-yellow/40',
  DELETE:    'bg-monokai-red/20 text-monokai-red border-monokai-red/40',
  AGGREGATE: 'bg-monokai-amethyst/20 text-monokai-amethyst border-monokai-amethyst/40',
  JOIN:      'bg-monokai-pink/20 text-monokai-pink border-monokai-pink/40',
  WINDOW:    'bg-monokai-orange/20 text-monokai-orange border-monokai-orange/40',
  CTE:       'bg-monokai-cyan/20 text-monokai-cyan border-monokai-cyan/40',
};

// 抽象层级 → 颜色类名
export const LEVEL_COLOR_CLASSES: Record<string, string> = {
  concept:   'bg-monokai-amethyst/15 text-monokai-amethyst',
  property:  'bg-monokai-blue/15 text-monokai-blue',
  relation:  'bg-monokai-green/15 text-monokai-green',
  instance:  'bg-monokai-yellow/15 text-monokai-yellow',
};

/**
 * 获取操作类型的完整样式类名
 */
export const getOperationTagClass = (operation: AbstractionSqlOperation): string => {
  return OPERATION_TAG_CLASSES[operation] || 'bg-monokai-fg/15 text-monokai-fg border-monokai-fg/30';
};

/**
 * 获取操作类型的选中样式类名
 */
export const getOperationSelectedClass = (operation: AbstractionSqlOperation): string => {
  return OPERATION_SELECTED_CLASSES[operation] || 'bg-monokai-fg/20 text-monokai-fg border-monokai-fg/40';
};

/**
 * 获取操作类型的未选中样式类名
 */
export const getOperationDefaultClass = (_operation: AbstractionSqlOperation): string => {
  return 'bg-monokai-surface text-monokai-fg-muted hover:text-monokai-fg';
};
