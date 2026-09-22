/**
 * AbstractionEmptyState — 空状态（复用 Workbench EmptyState / ActionButton）
 */

import React from 'react';
import { Table, Plus, Database, Search } from 'lucide-react';
import { useAnalysisHubStore } from '../../hooks/store/analysisHubStore';
import { SAMPLE_ABSTRACTION_TABLES } from '../../utils/abstractionSeedData';
import { ActionButton, EmptyState } from '../ui/Workbench';

interface AbstractionEmptyStateProps {
  /** When filtered=true, clears active filters; unused for true-empty fill (handled internally). */
  onFillSamples: () => void;
  onAdd: () => void;
  filtered?: boolean;
}

export const AbstractionEmptyState: React.FC<AbstractionEmptyStateProps> = ({
  onFillSamples: onClearFilters,
  onAdd,
  filtered = false,
}) => {
  const tables = useAnalysisHubStore(s => s.tables);
  const addTable = useAnalysisHubStore(s => s.addTable);
  const setCopiedId = useAnalysisHubStore(s => s.setCopiedId);

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
      <EmptyState
        icon={Search}
        title="没有找到匹配的抽象表"
        description="调整关键词或清除筛选条件后重试"
        action={
          <ActionButton variant="ghost" size="sm" onClick={onClearFilters}>
            清除筛选条件
          </ActionButton>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={Table}
      title="暂无数据抽象表"
      description="创建新的抽象表或填充示例数据开始使用"
      action={
        <ActionButton variant="primary" size="sm" icon={Database} onClick={handleFillSamples}>
          填充示例数据
        </ActionButton>
      }
      secondaryAction={
        <ActionButton variant="secondary" size="sm" icon={Plus} onClick={onAdd}>
          添加抽象表
        </ActionButton>
      }
    />
  );
};
