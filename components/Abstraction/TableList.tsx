/**
 * TableList — 抽象表列表
 *
 * 改进：
 * - 紧凑顶部快捷筛选栏（Domain 标签 + 操作类型）
 * - 卡片选中态更突出（左侧色条）
 * - 统计信息实时显示
 * - 添加"新增"按钮视觉更突出
 */

import React, { useState } from 'react';
import { Plus, Search, X, Star, Filter } from 'lucide-react';
import { useAnalysisHubStore, useFilteredTables } from '../../hooks/store/analysisHubStore';
import { useAbstractionFilters } from '../../hooks/useAbstractionFilters';
import { TableCard } from './TableCard';
import { AbstractionEmptyState } from './AbstractionEmptyState';
import { AbstractionHelp } from './AbstractionHelp';
import { OPERATION_CONFIG, LEVEL_CONFIG } from '../../types/abstraction';
import { AbstractionSqlOperation } from '../../types';
import { OPERATION_SELECTED_CLASSES, OPERATION_TAG_CLASSES } from './abstractionColors';

interface TableListProps {
  onInsert: (sql: string) => void;
}

export const TableList: React.FC<TableListProps> = ({ onInsert }) => {
  const filteredTables = useFilteredTables();
  const selectedId = useAnalysisHubStore(s => s.selectedId);
  const selectTable = useAnalysisHubStore(s => s.selectTable);
  const openAddForm = useAnalysisHubStore(s => s.openAddForm);
  const stats = useAnalysisHubStore(s => s.stats);
  const tables = useAnalysisHubStore(s => s.tables);

  const { filters, updateFilters, resetFilters, domains } = useAbstractionFilters();

  const [showHelp, setShowHelp] = useState(false);

  const operationFilters: AbstractionSqlOperation[] = [
    'SELECT', 'AGGREGATE', 'JOIN', 'WINDOW', 'CTE', 'INSERT', 'UPDATE', 'DELETE'
  ];

  return (
    <div className="flex flex-col h-full bg-monokai-bg">
      {/* 顶部：搜索 + 新增 */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-monokai-fg-muted" />
          <input
            type="text"
            placeholder="搜索模板..."
            value={filters.searchQuery}
            onChange={(e) => updateFilters({ searchQuery: e.target.value })}
            className="w-full pl-8 pr-8 py-2 text-sm bg-monokai-surface border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-fg-muted/60 focus:outline-none focus:border-monokai-purple transition-colors"
          />
          {filters.searchQuery && (
            <button
              onClick={() => updateFilters({ searchQuery: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-monokai-fg-muted hover:text-monokai-fg"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <button
          onClick={() => openAddForm()}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium bg-gradient-to-r from-monokai-purple/20 to-monokai-blue/20 text-monokai-purple border border-monokai-purple/30 rounded-lg hover:from-monokai-purple/30 hover:to-monokai-blue/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          新增模板
        </button>
      </div>

      {/* 快捷筛选栏 */}
      <div className="px-3 pb-2 space-y-2">
        {/* 领域筛选 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-monokai-fg-muted uppercase tracking-wider">领域</span>
            {(filters.domain !== 'all' || filters.isFavorite) && (
              <button onClick={resetFilters} className="text-[10px] text-monokai-purple hover:underline">
                重置
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => updateFilters({ domain: 'all', isFavorite: false })}
              className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                filters.domain === 'all' && !filters.isFavorite
                  ? 'bg-monokai-purple/20 text-monokai-purple border border-monokai-purple/40'
                  : 'bg-monokai-surface text-monokai-fg-muted border border-monokai-border hover:border-monokai-fg-muted'
              }`}
            >
              全部
            </button>
            {domains.map((d) => (
              <button
                key={d}
                onClick={() => updateFilters({ domain: d, isFavorite: false })}
                className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                  filters.domain === d
                    ? 'bg-monokai-purple/20 text-monokai-purple border border-monokai-purple/40'
                    : 'bg-monokai-surface text-monokai-fg-muted border border-monokai-border hover:border-monokai-fg-muted'
                }`}
              >
                {d}
              </button>
            ))}
            <button
              onClick={() => updateFilters({ domain: 'all', isFavorite: true })}
              className={`flex items-center gap-0.5 px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                filters.isFavorite
                  ? 'bg-monokai-yellow/20 text-monokai-yellow border border-monokai-yellow/40'
                  : 'bg-monokai-surface text-monokai-fg-muted border border-monokai-border hover:border-monokai-fg-muted'
              }`}
            >
              <Star className="w-2.5 h-2.5 fill-current" />
              收藏
            </button>
          </div>
        </div>

        {/* 操作类型筛选 */}
        <div>
          <span className="text-[10px] font-semibold text-monokai-fg-muted uppercase tracking-wider block mb-1">操作</span>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => updateFilters({ operation: 'all' })}
              className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                filters.operation === 'all'
                  ? 'bg-monokai-purple/20 text-monokai-purple border border-monokai-purple/40'
                  : 'bg-monokai-surface text-monokai-fg-muted border border-monokai-border hover:border-monokai-fg-muted'
              }`}
            >
              全部
            </button>
            {operationFilters.map((op) => {
              const config = OPERATION_CONFIG[op];
              const selectedClass = OPERATION_SELECTED_CLASSES[op];
              const defaultClass = 'bg-monokai-surface text-monokai-fg-muted border border-monokai-border hover:border-monokai-fg-muted';
              return (
                <button
                  key={op}
                  onClick={() => updateFilters({ operation: op })}
                  className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${filters.operation === op ? selectedClass : defaultClass}`}
                >
                  {config?.label || op}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 统计信息栏 */}
      <div className="px-3 pb-1 flex items-center justify-between">
        <span className="text-[10px] text-monokai-fg-muted">
          {stats.filtered === stats.total
            ? `${stats.total} 个模板`
            : `筛选 ${stats.filtered} / ${stats.total} 个`}
        </span>
        {showHelp ? (
          <button onClick={() => setShowHelp(false)} className="text-[10px] text-monokai-yellow">收起</button>
        ) : (
          <button onClick={() => setShowHelp(true)} className="text-[10px] text-monokai-fg-muted hover:text-monokai-yellow">MECE 帮助</button>
        )}
      </div>

      {/* 帮助面板 */}
      {showHelp && (
        <div className="px-3 pb-2">
          <AbstractionHelp compact />
        </div>
      )}

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {filteredTables.length > 0 ? (
          filteredTables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              isSelected={selectedId === table.id}
              onClick={() => selectTable(table.id)}
              onInsert={() => onInsert(table.sqlConfig.template)}
            />
          ))
        ) : (
          <AbstractionEmptyState
            onFillSamples={resetFilters}
            onAdd={() => openAddForm()}
            filtered={stats.total > 0 && stats.filtered === 0}
          />
        )}
      </div>
    </div>
  );
};

export default TableList;
