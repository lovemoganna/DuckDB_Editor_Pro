import React from 'react';
import {
  LayoutDashboard,
  ArrowLeft,
  RefreshCw,
  Plus,
  Sparkles,
} from 'lucide-react';
import { Dashboard as IDashboard, Tab } from '../../types';
import { DashboardGrid } from '../DashboardGrid';
import { ActionButton, Badge, EmptyState, IconButton, PageHeader } from '../ui/Workbench';

interface DashboardDetailCanvasProps {
  currentDashboard: IDashboard;
  refreshTrigger: number;
  onReturnToList: () => void;
  onRefreshData: () => void;
  onOpenAddWidget: () => void;
  onLoadStarterPack: () => void;
  onLayoutChange: (layout: any[]) => void;
  onRemoveWidget: (itemId: string) => void;
  onNavigate: (tab: Tab) => void;
}

export const DashboardDetailCanvas: React.FC<DashboardDetailCanvasProps> = ({
  currentDashboard,
  refreshTrigger,
  onReturnToList,
  onRefreshData,
  onOpenAddWidget,
  onLoadStarterPack,
  onLayoutChange,
  onRemoveWidget,
  onNavigate,
}) => {
  const itemCount = currentDashboard.items?.length || 0;

  return (
    <div className="flex h-full flex-col bg-monokai-bg text-monokai-fg font-sans">
      <PageHeader
        title={currentDashboard.name}
        description={`${itemCount} 个组件 · 实时自动保存网格布局`}
        icon={LayoutDashboard}
        badge={<Badge tone="neutral">{itemCount} 个组件</Badge>}
        sticky={false}
        actions={(
          <>
            <IconButton
              label="返回看板列表"
              icon={ArrowLeft}
              onClick={onReturnToList}
            />
            <ActionButton
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={onRefreshData}
            >
              刷新全部
            </ActionButton>
            <ActionButton
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={onOpenAddWidget}
            >
              添加组件
            </ActionButton>
          </>
        )}
      />

      {/* Grid Canvas with dark industrial backdrop */}
      <div className="relative flex-1 overflow-hidden bg-monokai-bg p-4">
        {itemCount === 0 ? (
          <EmptyState
            title="当前仪表板为空"
            description="可以直接装载推荐监控组件，也可以从已保存查询中添加自定义图表。"
            icon={LayoutDashboard}
            action={(
              <div className="flex items-center gap-2">
                <ActionButton
                  variant="primary"
                  icon={Sparkles}
                  onClick={onLoadStarterPack}
                >
                  一键装载推荐监控看板
                </ActionButton>
                <ActionButton
                  variant="secondary"
                  icon={Plus}
                  onClick={onOpenAddWidget}
                >
                  添加组件
                </ActionButton>
              </div>
            )}
            className="h-full border-0 bg-transparent"
          />
        ) : (
          <DashboardGrid
            dashboard={currentDashboard}
            refreshTrigger={refreshTrigger}
            onLayoutChange={onLayoutChange}
            onRemoveWidget={onRemoveWidget}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </div>
  );
};
