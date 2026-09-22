// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tab } from '../../types';
import { AppTopBar } from './AppTopBar';

afterEach(cleanup);

describe('AppTopBar Domain Cluster Navigation Tabs', () => {
  it('renders clean topbar matching 00-reference.png when activeTab is DASHBOARD', () => {
    const setShowSettingsModal = vi.fn();

    render(
      <AppTopBar
        activeTab={Tab.DASHBOARD}
        currentTable="customers"
        tables={['customers', 'orders', 'products']}
        setActiveTab={vi.fn()}
        handleTableSelect={vi.fn()}
        handleCreateDemo={vi.fn()}
        setShowCreateModal={vi.fn()}
        setShowImportModal={vi.fn()}
        setShowExportModal={vi.fn()}
        setShowSettingsModal={setShowSettingsModal}
        fetchTableData={vi.fn()}
        refreshAudit={vi.fn()}
        runtimeInfo={{
          version: '1.0.0',
          storageMode: 'memory',
          persistent: false,
          ready: true,
        }}
      />,
    );

    // Brand and header elements
    expect(screen.getByText('DuckDB Studio')).toBeTruthy();
    expect(screen.queryByText('方案 05')).toBeNull();
    expect(screen.getByText('项目')).toBeTruthy();
    expect(screen.getByText('memory')).toBeTruthy();
    expect(screen.getByText('内存临时模式')).toBeTruthy();

    fireEvent.click(screen.getByTitle('系统与 AI 首选项设置'));
    expect(setShowSettingsModal).toHaveBeenCalledWith(true);

    // Domain cluster tabs and Tier 2 tabs are persistently available on DASHBOARD
    expect(screen.getByRole('navigation', { name: '业务领域大类' })).toBeTruthy();
    expect(screen.getByText('工程核心')).toBeTruthy();
    expect(screen.getByText('分析洞察')).toBeTruthy();
    expect(screen.getByText('知识沉淀')).toBeTruthy();
    expect(screen.getByText('AI 认知')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /仪表盘/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /^数据$/ })).toBeTruthy();
  });

  it('renders core direct tabs and handles direct switching when on workspace tabs', () => {
    const setActiveTab = vi.fn();
    const handleTableSelect = vi.fn();
    const setShowCreateModal = vi.fn();
    const setShowImportModal = vi.fn();
    const setShowSettingsModal = vi.fn();
    const setShowExportModal = vi.fn();

    render(
      <AppTopBar
        activeTab={Tab.DATA}
        currentTable="customers"
        tables={['customers', 'orders', 'products']}
        setActiveTab={setActiveTab}
        handleTableSelect={handleTableSelect}
        handleCreateDemo={vi.fn()}
        setShowCreateModal={setShowCreateModal}
        setShowImportModal={setShowImportModal}
        setShowExportModal={setShowExportModal}
        setShowSettingsModal={setShowSettingsModal}
        fetchTableData={vi.fn()}
        refreshAudit={vi.fn()}
        runtimeInfo={{
          version: '1.0.0',
          storageMode: 'opfs',
          persistent: true,
          ready: true,
        }}
      />,
    );

    // 1. Check Brand, Core Tabs, and Domain Group buttons
    expect(screen.getByText('DuckDB Studio')).toBeTruthy();
    expect(screen.getByText('仪表盘')).toBeTruthy();
    expect(screen.getByText('数据')).toBeTruthy();
    expect(screen.getByText('Schema')).toBeTruthy();
    expect(screen.getByText('SQL')).toBeTruthy();
    expect(screen.getByText('分析洞察')).toBeTruthy();
    expect(screen.getByText('知识沉淀')).toBeTruthy();
    expect(screen.getByText('AI 认知')).toBeTruthy();

    // 2. Click Direct Core Tabs
    fireEvent.click(screen.getByText('数据'));
    expect(setActiveTab).toHaveBeenCalledWith(Tab.DATA);

    fireEvent.click(screen.getByText('Schema'));
    expect(setActiveTab).toHaveBeenCalledWith(Tab.STRUCTURE);

    fireEvent.click(screen.getByText('SQL'));
    expect(setActiveTab).toHaveBeenCalledWith(Tab.SQL);

    // 3. Check Toolbar Actions
    expect(screen.getByText('项目')).toBeTruthy();
    expect(screen.getByText('memory')).toBeTruthy();
    expect(screen.getByText('已保存到 OPFS')).toBeTruthy();

    fireEvent.click(screen.getByTitle('系统与 AI 首选项设置'));
    expect(setShowSettingsModal).toHaveBeenCalledWith(true);

    // Verify that dropdown chevron buttons have been removed from topbar tabs
    expect(screen.queryByRole('button', { name: /展开.*功能菜单/ })).toBeNull();
  });

  it('switches domain category directly without dropdown chevron clutter', () => {
    const setActiveTab = vi.fn();

    render(
      <AppTopBar
        activeTab={Tab.DATA}
        currentTable={null}
        tables={[]}
        setActiveTab={setActiveTab}
        handleTableSelect={vi.fn()}
        handleCreateDemo={vi.fn()}
        setShowCreateModal={vi.fn()}
        setShowImportModal={vi.fn()}
        setShowExportModal={vi.fn()}
        setShowSettingsModal={vi.fn()}
        fetchTableData={vi.fn()}
        refreshAudit={vi.fn()}
        runtimeInfo={{
          version: '1.0.0',
          storageMode: 'opfs',
          persistent: true,
          ready: true,
        }}
      />,
    );

    // Click "分析洞察" domain capsule directly
    fireEvent.click(screen.getByText('分析洞察'));
    expect(setActiveTab).toHaveBeenCalledWith(Tab.METRICS);

    // Click "AI 认知" domain capsule directly
    fireEvent.click(screen.getByText('AI 认知'));
    expect(setActiveTab).toHaveBeenCalledWith(Tab.ONTOLOGY);
  });

  it('highlights the domain button with active child name when a domain feature is active', () => {
    render(
      <AppTopBar
        activeTab={Tab.ONTOLOGY}
        currentTable={null}
        tables={[]}
        setActiveTab={vi.fn()}
        handleTableSelect={vi.fn()}
        handleCreateDemo={vi.fn()}
        setShowCreateModal={vi.fn()}
        setShowImportModal={vi.fn()}
        setShowExportModal={vi.fn()}
        setShowSettingsModal={vi.fn()}
        fetchTableData={vi.fn()}
        refreshAudit={vi.fn()}
        runtimeInfo={{
          version: '1.0.0',
          storageMode: 'opfs',
          persistent: true,
          ready: true,
        }}
      />,
    );

    // AI Cognitive domain button dynamically reflects active child '本体图谱'
    expect(screen.getByText('本体图谱')).toBeTruthy();
  });

  it('supports roving keyboard arrow navigation between Tier 2 tabs', () => {
    const setActiveTab = vi.fn();
    render(
      <AppTopBar
        activeTab={Tab.DATA}
        currentTable={null}
        tables={[]}
        setActiveTab={setActiveTab}
        handleTableSelect={vi.fn()}
        handleCreateDemo={vi.fn()}
        setShowCreateModal={vi.fn()}
        setShowImportModal={vi.fn()}
        setShowExportModal={vi.fn()}
        setShowSettingsModal={vi.fn()}
        fetchTableData={vi.fn()}
        refreshAudit={vi.fn()}
        runtimeInfo={{
          version: '1.0.0',
          storageMode: 'opfs',
          persistent: true,
          ready: true,
        }}
      />,
    );

    const dashboardTab = screen.getByRole('tab', { name: /仪表盘/ });
    fireEvent.keyDown(dashboardTab, { key: 'ArrowRight' });
    expect(setActiveTab).toHaveBeenCalledWith(Tab.DATA);
  });

  it('keeps active domain stable without opening any dropdown menus when clicked', () => {
    const setActiveTab = vi.fn();
    render(
      <AppTopBar
        activeTab={Tab.ONTOLOGY}
        currentTable={null}
        tables={[]}
        setActiveTab={setActiveTab}
        handleTableSelect={vi.fn()}
        handleCreateDemo={vi.fn()}
        setShowCreateModal={vi.fn()}
        setShowImportModal={vi.fn()}
        setShowExportModal={vi.fn()}
        setShowSettingsModal={vi.fn()}
        fetchTableData={vi.fn()}
        refreshAudit={vi.fn()}
        runtimeInfo={{
          version: '1.0.0',
          storageMode: 'opfs',
          persistent: true,
          ready: true,
        }}
      />,
    );

    // Initial state: no dropdown menu or chevron
    expect(screen.queryByText('直达子功能')).toBeNull();

    // Click "AI 认知" which is already the active domain
    fireEvent.click(screen.getByText('AI 认知'));

    // Verify still clean and no dropdown is opened
    expect(screen.queryByText('直达子功能')).toBeNull();
  });

  it('displays IndexedDB persistence badge and provides Clear Cache button in dropdown', () => {
    render(
      <AppTopBar
        activeTab={Tab.DASHBOARD}
        currentTable={null}
        tables={[]}
        setActiveTab={vi.fn()}
        handleTableSelect={vi.fn()}
        handleCreateDemo={vi.fn()}
        setShowCreateModal={vi.fn()}
        setShowImportModal={vi.fn()}
        setShowExportModal={vi.fn()}
        setShowSettingsModal={vi.fn()}
        fetchTableData={vi.fn()}
        refreshAudit={vi.fn()}
        runtimeInfo={{
          version: '1.0.0',
          storageMode: 'indexeddb',
          persistent: true,
          ready: true,
        }}
      />,
    );

    // Shows IndexedDB persistence indicator
    expect(screen.getByText('已保存到 IndexedDB')).toBeTruthy();

    // Open database dropdown
    fireEvent.click(screen.getByText('已保存到 IndexedDB'));

    // Clear Cache button is present
    expect(screen.getByText('清理工作区缓存 (IndexedDB)')).toBeTruthy();
  });
});


