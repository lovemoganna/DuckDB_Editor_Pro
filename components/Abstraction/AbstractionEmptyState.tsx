/**
 * AbstractionEmptyState — 空状态组件
 */

import React from 'react';
import { Table, Plus, Database, Search } from 'lucide-react';
import { useAnalysisHubStore } from '../../hooks/store/analysisHubStore';
import { SAMPLE_ABSTRACTION_TABLES } from '../../utils/abstractionSeedData';

interface AbstractionEmptyStateProps {
  onFillSamples: () => void;
  onAdd: () => void;
  filtered?: boolean;
}

export const AbstractionEmptyState: React.FC<AbstractionEmptyStateProps> = ({
  onFillSamples,
  onAdd,
  filtered = false,
}) => {
  const openAddForm = useAnalysisHubStore(s => s.openAddForm);
  const loadTables = useAnalysisHubStore(s => s.loadTables);
  const tables = useAnalysisHubStore(s => s.tables);
  const addTable = useAnalysisHubStore(s => s.addTable);
  const setCopiedId = useAnalysisHubStore(s => s.setCopiedId);

  // 真实填充示例数据
  const handleFillSamples = async () => {
    for (const sample of SAMPLE_ABSTRACTION_TABLES) {
      try {
        await addTable(sample);
      } catch {
        // ignore duplicates
      }
    }
    setCopiedId('fill-success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (filtered && tables.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <Search className="w-10 h-10 text-monokai-comment opacity-50 mb-3" />
        <p className="text-sm text-monokai-comment mb-4">没有找到匹配的抽象表</p>
        <button
          onClick={onFillSamples}
          className="text-xs text-monokai-amethyst hover:underline"
        >
          清除筛选条件
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <Table className="w-12 h-12 text-monokai-comment opacity-50 mb-4" />
      <p className="text-sm text-monokai-comment mb-2">暂无数据抽象表</p>
      <p className="text-xs text-monokai-comment mb-4">
        创建新的抽象表或填充示例数据开始使用
      </p>
      <div className="flex items-center gap-3">
      <button
        onClick={handleFillSamples}
        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-monokai-blue/20 text-monokai-blue rounded-lg hover:bg-monokai-blue/30 transition-colors"
      >
        <Database className="w-3 h-3" />
        填充示例数据
      </button>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-monokai-amethyst/20 text-monokai-amethyst rounded-lg hover:bg-monokai-amethyst/30 transition-colors"
        >
          <Plus className="w-3 h-3" />
          添加抽象表
        </button>
      </div>
    </div>
  );
};

export default AbstractionEmptyState;
