import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { DrawerShell } from '../ui/Workbench';
import { Dashboard as IDashboard } from '../../types';
import { DashboardAnalyticsHub } from './DashboardAnalyticsHub';

interface CustomDashboardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  dashboards: IDashboard[];
  loading: boolean;
  onCreateDashboard: () => void;
  onSelectDashboard: (dashboard: IDashboard) => void;
  onDeleteDashboard: (id: string) => void;
}

export const CustomDashboardDrawer: React.FC<CustomDashboardDrawerProps> = ({
  isOpen,
  onClose,
  dashboards,
  loading,
  onCreateDashboard,
  onSelectDashboard,
  onDeleteDashboard,
}) => (
  <DrawerShell
    open={isOpen}
    onClose={onClose}
    title="自定义指标大盘管理"
    description={`${dashboards.length} 个看板`}
    side="right"
    size="md"
    headerActions={
      <LayoutDashboard className="h-4 w-4 text-monokai-orange" aria-hidden="true" />
    }
    contentClassName="!p-0"
  >
    <div className="p-4">
      <DashboardAnalyticsHub
        dashboards={dashboards}
        loading={loading}
        onCreateDashboard={onCreateDashboard}
        onSelectDashboard={d => {
          onSelectDashboard(d);
          onClose();
        }}
        onDeleteDashboard={onDeleteDashboard}
      />
    </div>
  </DrawerShell>
);
