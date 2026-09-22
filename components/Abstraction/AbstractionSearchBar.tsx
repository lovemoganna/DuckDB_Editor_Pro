/**
 * AbstractionSearchBar — 抽象表搜索筛选栏
 *
 * 基于 MECE 原则的三维筛选：domain + operation + abstractionLevel
 */

import React from 'react';
import {
  Search,
  RotateCcw,
  Filter,
} from 'lucide-react';
import { AbstractionFilters, DEFAULT_FILTERS, OPERATION_CONFIG, LEVEL_CONFIG } from '../../types/abstraction';
import { AbstractionSqlOperation, AbstractionLevel } from '../../types';

interface AbstractionSearchBarProps {
  filters: AbstractionFilters;
  onFiltersChange: (filters: AbstractionFilters) => void;
  domains: string[];
  onClear: () => void;
  totalCount: number;
  filteredCount: number;
}

export const AbstractionSearchBar: React.FC<AbstractionSearchBarProps> = ({
  filters,
  onFiltersChange,
  domains,
  onClear,
  totalCount,
  filteredCount,
}) => {
  const operations: AbstractionSqlOperation[] = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'AGGREGATE', 'JOIN', 'WINDOW', 'CTE'];
  const levels: AbstractionLevel[] = ['concept', 'property', 'relation', 'instance'];

  return (
    <div className="space-y-2">
      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-monokai-comment" />
        <input
          type="text"
          placeholder="搜索数据抽象表..."
          value={filters.searchQuery}
          onChange={(e) => onFiltersChange({ ...filters, searchQuery: e.target.value })}
          className="w-full pl-8 pr-8 py-1.5 text-sm bg-monokai-bg border border-monokai-accent rounded-lg text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-amethyst"
        />
        {filters.searchQuery && (
          <button
            onClick={() => onFiltersChange({ ...filters, searchQuery: '' })}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-monokai-accent/30 text-monokai-comment"
            title="清除搜索"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* 筛选器 */}
      <div className="flex flex-wrap gap-2">
        {/* 领域筛选 */}
        <select
          value={filters.domain}
          onChange={(e) => onFiltersChange({ ...filters, domain: e.target.value })}
          className="px-2 py-1 text-xs bg-monokai-bg border border-monokai-accent rounded text-monokai-fg"
        >
          <option value="all">全部领域</option>
          {domains.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        {/* 操作类型筛选 */}
        <select
          value={filters.operation}
          onChange={(e) => onFiltersChange({ ...filters, operation: e.target.value as AbstractionSqlOperation | 'all' })}
          className="px-2 py-1 text-xs bg-monokai-bg border border-monokai-accent rounded text-monokai-fg"
        >
          <option value="all">全部操作</option>
          {operations.map((op) => (
            <option key={op} value={op}>
              {OPERATION_CONFIG[op]?.label || op}
            </option>
          ))}
        </select>

        {/* 抽象层级筛选 */}
        <select
          value={filters.abstractionLevel}
          onChange={(e) => onFiltersChange({ ...filters, abstractionLevel: e.target.value as AbstractionLevel | 'all' })}
          className="px-2 py-1 text-xs bg-monokai-bg border border-monokai-accent rounded text-monokai-fg"
        >
          <option value="all">全部层级</option>
          {levels.map((level) => (
            <option key={level} value={level}>
              {LEVEL_CONFIG[level]?.label || level}
            </option>
          ))}
        </select>
      </div>

      {/* 统计和快速清除 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-monokai-comment">
          <Filter className="w-3 h-3" />
          <span>
            {filteredCount === totalCount ? (
              <>共 {totalCount} 个抽象表</>
            ) : (
              <>筛选 {filteredCount}/{totalCount} 个</>
            )}
          </span>
        </div>
        {(filters.domain !== 'all' ||
          filters.operation !== 'all' ||
          filters.abstractionLevel !== 'all' ||
          filters.isFavorite) && (
          <button
            onClick={onClear}
            className="text-xs text-monokai-amethyst hover:underline"
          >
            清除筛选
          </button>
        )}
      </div>
    </div>
  );
};

export default AbstractionSearchBar;
