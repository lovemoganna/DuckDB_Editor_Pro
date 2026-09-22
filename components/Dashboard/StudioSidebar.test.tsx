// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioSidebar } from './StudioSidebar';
import { Tab } from '../../types';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('StudioSidebar component', () => {
  it('renders all navigation items from 00-reference.png', () => {
    const setActiveTab = vi.fn();
    const onShowImportModal = vi.fn();
    const onLoadDemo = vi.fn();

    render(
      <StudioSidebar
        activeTab={Tab.DASHBOARD}
        setActiveTab={setActiveTab}
        onShowImportModal={onShowImportModal}
        onLoadDemo={onLoadDemo}
      />,
    );

    expect(screen.getByText('首页')).toBeInTheDocument();
    expect(screen.getByText('SQL 工作台')).toBeInTheDocument();
    expect(screen.getByText('数据')).toBeInTheDocument();
    expect(screen.getByText('表')).toBeInTheDocument();
    expect(screen.getByText('Schema')).toBeInTheDocument();
    expect(screen.getByText('文件导入')).toBeInTheDocument();
    expect(screen.getByText('示例数据')).toBeInTheDocument();
    expect(screen.getByText('知识沉淀')).toBeInTheDocument();
    expect(screen.getByText('知识资产')).toBeInTheDocument();
    expect(screen.getByText('AI 认知')).toBeInTheDocument();
  });

  it('triggers callbacks when clicking navigation items', () => {
    const setActiveTab = vi.fn();
    const onShowImportModal = vi.fn();
    const onLoadDemo = vi.fn();

    render(
      <StudioSidebar
        activeTab={Tab.DASHBOARD}
        setActiveTab={setActiveTab}
        onShowImportModal={onShowImportModal}
        onLoadDemo={onLoadDemo}
      />,
    );

    // Click SQL 工作台
    fireEvent.click(screen.getByText('SQL 工作台'));
    expect(setActiveTab).toHaveBeenCalledWith(Tab.SQL);

    // Click 表
    fireEvent.click(screen.getByText('表'));
    expect(setActiveTab).toHaveBeenCalledWith(Tab.DATA);

    // Click 文件导入
    fireEvent.click(screen.getByText('文件导入'));
    expect(onShowImportModal).toHaveBeenCalled();

    // Click 示例数据
    fireEvent.click(screen.getByText('示例数据'));
    expect(onLoadDemo).toHaveBeenCalled();
  });
});
