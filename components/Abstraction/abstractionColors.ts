/**
 * abstractionColors — 统一的静态颜色映射
 *
 * 解决 Tailwind 动态类名（bg-monokai-${color}）在运行时无效的问题。
 * 全部映射到 Monokai 语义色，禁止 sky/emerald/amber/rose 等默认 Tailwind 色板。
 */

import { AbstractionSqlOperation } from '../../types';

/** 操作类型 → 背景色+文字色类名（Monokai SSOT） */
export const OPERATION_BG_CLASSES: Record<string, string> = {
  SELECT:    'bg-monokai-cyan/10 text-monokai-cyan',
  INSERT:    'bg-monokai-accent/10 text-monokai-accent',
  UPDATE:    'bg-monokai-yellow/10 text-monokai-yellow',
  DELETE:    'bg-monokai-pink/10 text-monokai-pink',
  AGGREGATE: 'bg-monokai-surface text-monokai-fg-muted',
  JOIN:      'bg-monokai-pink/10 text-monokai-pink',
  WINDOW:    'bg-monokai-orange/10 text-monokai-orange',
  CTE:       'bg-monokai-cyan/10 text-monokai-cyan',
};

/** 操作类型 → 边框类名 */
export const OPERATION_BORDER_CLASSES: Record<string, string> = {
  SELECT:    'border-monokai-border-subtle',
  INSERT:    'border-monokai-border-subtle',
  UPDATE:    'border-monokai-border-subtle',
  DELETE:    'border-monokai-border-subtle',
  AGGREGATE: 'border-monokai-border-subtle',
  JOIN:      'border-monokai-border-subtle',
  WINDOW:    'border-monokai-border-subtle',
  CTE:       'border-monokai-border-subtle',
};

/** 操作类型 → 完整标签样式 */
export const OPERATION_TAG_CLASSES: Record<string, string> = {
  SELECT:    'bg-monokai-cyan/10 text-monokai-cyan border-monokai-border-subtle',
  INSERT:    'bg-monokai-accent/10 text-monokai-accent border-monokai-border-subtle',
  UPDATE:    'bg-monokai-yellow/10 text-monokai-yellow border-monokai-border-subtle',
  DELETE:    'bg-monokai-pink/10 text-monokai-pink border-monokai-border-subtle',
  AGGREGATE: 'bg-monokai-surface text-monokai-fg-muted border-monokai-border-subtle',
  JOIN:      'bg-monokai-pink/10 text-monokai-pink border-monokai-border-subtle',
  WINDOW:    'bg-monokai-orange/10 text-monokai-orange border-monokai-border-subtle',
  CTE:       'bg-monokai-cyan/10 text-monokai-cyan border-monokai-border-subtle',
};

/** 操作类型 → 选中状态样式 */
export const OPERATION_SELECTED_CLASSES: Record<string, string> = {
  SELECT:    'bg-monokai-surface text-monokai-accent border-monokai-border font-medium shadow-xs',
  INSERT:    'bg-monokai-surface text-monokai-accent border-monokai-border font-medium shadow-xs',
  UPDATE:    'bg-monokai-surface text-monokai-accent border-monokai-border font-medium shadow-xs',
  DELETE:    'bg-monokai-surface text-monokai-accent border-monokai-border font-medium shadow-xs',
  AGGREGATE: 'bg-monokai-surface text-monokai-accent border-monokai-border font-medium shadow-xs',
  JOIN:      'bg-monokai-surface text-monokai-accent border-monokai-border font-medium shadow-xs',
  WINDOW:    'bg-monokai-surface text-monokai-accent border-monokai-border font-medium shadow-xs',
  CTE:       'bg-monokai-surface text-monokai-accent border-monokai-border font-medium shadow-xs',
};

/** 抽象层级 → 颜色类名 */
export const LEVEL_COLOR_CLASSES: Record<string, string> = {
  concept:   'bg-monokai-surface text-monokai-fg-muted border border-monokai-border-subtle',
  property:  'bg-monokai-surface text-monokai-fg-muted border border-monokai-border-subtle',
  relation:  'bg-monokai-surface text-monokai-fg-muted border border-monokai-border-subtle',
  instance:  'bg-monokai-surface text-monokai-fg-muted border border-monokai-border-subtle',
};

/** 获取操作类型的完整样式类名 */
export const getOperationTagClass = (operation: AbstractionSqlOperation): string => {
  return OPERATION_TAG_CLASSES[operation] || 'bg-monokai-fg/15 text-monokai-fg border-monokai-border';
};

/** 获取操作类型的选中样式类名 */
export const getOperationSelectedClass = (operation: AbstractionSqlOperation): string => {
  return OPERATION_SELECTED_CLASSES[operation] || 'bg-monokai-fg/20 text-monokai-fg border-monokai-border-strong shadow-sm';
};

/** 获取操作类型的未选中样式类名 */
export const getOperationDefaultClass = (_operation: AbstractionSqlOperation): string => {
  return 'bg-monokai-surface text-monokai-fg-muted hover:text-monokai-fg';
};
