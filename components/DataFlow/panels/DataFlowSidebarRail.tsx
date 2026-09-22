/**
 * DataFlowSidebarRail - 数据流专用左侧快捷工具轨
 *
 * 严格对应终态截图左侧 8 个核心操作项：
 * 1. 数据源
 * 2. SQL
 * 3. 数据表
 * 4. 连接
 * 5. 聚合
 * 6. 可视化
 * 7. 导出
 * 8. 历史
 *
 * 点击对应图标可在画布中快速插入对应类型节点，支持与右侧画布无缝交互。
 * 仅在「自由编排」模式下可添加节点，其他模式按钮置灰并显示 tooltip 说明。
 */

import React from 'react';
import {
  Database,
  Code2,
  Table2,
  Link2,
  Sigma,
  LineChart,
  Upload,
  History,
} from 'lucide-react';
import { useWorkflowStore } from '../../../services/dataflow/workflowStore';
import type { WorkflowNodeType } from '../../../services/dataflow/workflowTypes';

interface RailItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  nodeType?: WorkflowNodeType;
  action?: () => void;
}

export const DataFlowSidebarRail: React.FC = () => {
  const { addNode, setBottomDrawerTab, setIsBottomDrawerOpen, dataFlowMode } = useWorkflowStore();

  const isCustomMode = dataFlowMode === 'custom';

  const railItems: RailItem[] = [
    {
      id: 'source',
      label: '数据源',
      icon: Database,
      nodeType: 'source',
    },
    {
      id: 'sql',
      label: 'SQL',
      icon: Code2,
      nodeType: 'sql_transform',
    },
    {
      id: 'schema',
      label: '数据表',
      icon: Table2,
      nodeType: 'schema',
    },
    {
      id: 'join',
      label: '连接',
      icon: Link2,
      nodeType: 'join',
    },
    {
      id: 'aggregate',
      label: '聚合',
      icon: Sigma,
      nodeType: 'aggregate',
    },
    {
      id: 'visualize',
      label: '可视化',
      icon: LineChart,
      nodeType: 'result',
    },
    {
      id: 'export',
      label: '导出',
      icon: Upload,
      nodeType: 'export',
    },
    {
      id: 'history',
      label: '历史',
      icon: History,
      action: () => {
        setBottomDrawerTab('logs');
        setIsBottomDrawerOpen(true);
      },
    },
  ];

  const handleItemClick = (item: RailItem) => {
    if (item.action) {
      item.action();
    } else if (item.nodeType) {
      if (!isCustomMode) return; // Guard: only allow in custom mode
      addNode(item.nodeType);
    }
  };

  const getTooltip = (item: RailItem) => {
    if (item.action) return `查看 ${item.label}`;
    if (!isCustomMode) return `切换至「自由编排」模式后可添加 ${item.label} 节点`;
    return `添加 ${item.label} 节点`;
  };

  return (
    <div className="flex w-14 shrink-0 flex-col items-center border-r border-monokai-border bg-monokai-surface py-2 select-none z-10">
      <div className="flex flex-col gap-1 w-full px-1">
        {railItems.map((item) => {
          const Icon = item.icon;
          const isDisabled = !item.action && !isCustomMode;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleItemClick(item)}
              title={getTooltip(item)}
              disabled={isDisabled}
              className={`group flex flex-col items-center justify-center rounded-md py-2 px-1 text-center transition-all cursor-pointer ${
                isDisabled
                  ? 'text-monokai-comment/40 cursor-not-allowed opacity-50'
                  : item.action
                  ? 'text-monokai-fg-muted hover:bg-white/[0.04] hover:text-monokai-fg'
                  : 'text-monokai-fg-muted hover:bg-monokai-accent/10 hover:text-monokai-accent'
              }`}
            >
              <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
              <span className="mt-1 text-2xs font-medium leading-none tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
