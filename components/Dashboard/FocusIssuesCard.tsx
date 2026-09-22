import React from 'react';
import { AlertTriangle, KeyRound, Copy, CheckCircle2, ChevronRight } from 'lucide-react';
import { AssetSummaryStats, FocusIssueCategory } from './types';

interface FocusIssuesCardProps {
  summary: AssetSummaryStats;
  selectedFocus: FocusIssueCategory;
  onSelectFocus: (focus: FocusIssueCategory) => void;
}

export const FocusIssuesCard: React.FC<FocusIssuesCardProps> = ({
  summary,
  selectedFocus,
  onSelectFocus,
}) => {
  const coverageRatio = summary.totalAnalyzable > 0 
    ? `${summary.analyzedCount}/${summary.totalAnalyzable}` 
    : '0/0';

  const cards: Array<{
    id: FocusIssueCategory;
    title: string;
    count: string | number;
    unit: string;
    icon: any;
    color: string;
    activeBorder: string;
    badgeBg: string;
  }> = [
    {
      id: 'null_anomaly',
      title: '空值异常',
      count: summary.nullIssueCount,
      unit: '个异常列',
      icon: AlertTriangle,
      color: 'text-monokai-yellow',
      activeBorder: 'border-monokai-border-strong bg-monokai-elevated shadow-xs',
      badgeBg: 'bg-monokai-surface text-monokai-yellow',
    },
    {
      id: 'missing_pk',
      title: '缺少主键',
      count: summary.missingPkCount,
      unit: '张表未设主键',
      icon: KeyRound,
      color: 'text-monokai-orange',
      activeBorder: 'border-monokai-border-strong bg-monokai-elevated shadow-xs',
      badgeBg: 'bg-monokai-surface text-monokai-orange',
    },
    {
      id: 'duplicate_risk',
      title: '重复风险',
      count: summary.duplicateRiskCount,
      unit: '个潜在重复',
      icon: Copy,
      color: 'text-monokai-pink',
      activeBorder: 'border-monokai-border-strong bg-monokai-elevated shadow-xs',
      badgeBg: 'bg-monokai-surface text-monokai-pink',
    },
    {
      id: 'coverage',
      title: '分析覆盖率',
      count: coverageRatio,
      unit: '张已完成分析',
      icon: CheckCircle2,
      color: 'text-monokai-green',
      activeBorder: 'border-monokai-border-strong bg-monokai-elevated shadow-xs',
      badgeBg: 'bg-monokai-surface text-monokai-green',
    },
  ];

  return (
    <div className="flex flex-col gap-2 rounded-md border border-monokai-border bg-monokai-surface p-3 font-sans">
      <div className="flex items-center justify-between">
        <h4 className="font-mono text-xs font-bold text-monokai-fg uppercase tracking-wider flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-monokai-yellow animate-pulse" />
          今日需要关注
        </h4>
        {selectedFocus !== 'all' && (
          <button
            type="button"
            onClick={() => onSelectFocus('all')}
            className="text-meta font-mono text-monokai-comment hover:text-monokai-fg cursor-pointer"
          >
            重置关注过滤
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {cards.map(card => {
          const Icon = card.icon;
          const isSelected = selectedFocus === card.id;

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelectFocus(isSelected ? 'all' : card.id)}
              className={`flex flex-col justify-between rounded-md border p-2.5 text-left transition-all cursor-pointer ${
                isSelected
                  ? card.activeBorder
                  : 'border-monokai-border bg-monokai-bg hover:border-monokai-comment/50 hover:bg-monokai-elevated/40'
              }`}
              title={`点击过滤 ${card.title}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-meta font-medium text-monokai-fg-muted truncate">
                  {card.title}
                </span>
                <Icon className={`h-3.5 w-3.5 ${card.color} shrink-0`} />
              </div>

              <div className="mt-2 flex items-baseline justify-between gap-1">
                <span className={`font-mono text-base font-bold ${card.color}`}>
                  {card.count}
                </span>
                <span className="text-2xs font-mono text-monokai-comment truncate">
                  {card.unit}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
