import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataIdeMissionControl } from './DataIdeMissionControl';
import { Tab } from '../../../types';
import { useSqlEditorStore } from '../../../hooks/store/useSqlEditorStore';
import { useDataInspection } from '../../../hooks/store/useDataInspection';
import { useAppStore } from '../../../hooks/store/useAppStore';

vi.mock('../../../services/dbService', () => ({
  dbService: {
    getDomainSetting: vi.fn().mockResolvedValue(null),
    saveDomainSetting: vi.fn().mockResolvedValue(undefined),
    getDashboards: vi.fn().mockResolvedValue([]),
    saveDashboard: vi.fn().mockResolvedValue(undefined),
    getQueries: vi.fn().mockResolvedValue([]),
    saveQuery: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../services/duckdbService', () => ({
  duckDBService: {
    getRuntimeInfo: () => ({ storageMode: 'opfs' }),
    getTables: vi.fn().mockResolvedValue([]),
    getTableSchema: vi.fn().mockResolvedValue([]),
    query: vi.fn().mockResolvedValue([]),
    readQuery: vi.fn().mockResolvedValue([{ c: 0 }]),
  },
}));

vi.mock('../../../hooks/useAnalyticalCatalog', () => ({
  useAnalyticalCatalog: () => ({
    catalog: {
      builtAt: Date.now(),
      tableCount: 1,
      tables: [],
      coreMetrics: [],
      timeDimensions: [],
      categoryDimensions: [],
      comparisonDimensions: [],
      drillPaths: [],
      linkageFields: [],
      workspaceGaps: ['缺少时间维度 — 无法做趋势/同比环比'],
      overallReadinessScore: 20,
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock('../../../services/dynamicHome', () => ({
  ensureDynamicHome: vi.fn(async () => ({
    board: {
      id: 'home-default-board',
      name: '分析首页',
      items: [],
      createdAt: 0,
      updatedAt: 0,
    },
    seededData: false,
    widgetsAdded: 0,
    tableNames: [],
  })),
}));

describe('Analysis Home (DataIdeMissionControl)', () => {
  beforeEach(() => {
    useDataInspection.getState().invalidate();
    useSqlEditorStore.setState({ tabs: [], activeTabId: '' });
    useAppStore.getState().setCurrentDatabase('memory');
    useAppStore.getState().clearPending();
  });

  const baseMetrics = {
    tableCount: 1,
    dataSize: '100 KB',
    totalRows: 200,
    formattedTotalRows: '200',
    totalQueries: 5,
    avgLatencyMs: 8,
    formattedAvgLatency: '8.0ms',
    successRatePct: 100,
    errorCount: 0,
    qualityIssues: { missingPkCount: 0 },
    latencyDistribution: { slowCount: 0 },
    memoryPercentage: 10,
  } as any;

  it('routes a known rule failure to the affected dataset without calling unchecked data normal', () => {
    useDataInspection.getState().record({catalog:'memory',schema:'main',table:'users',checkedAt:1,status:'issues',rules:[],constraints:[]});
    const onSelectTableAnalysis = vi.fn();
    render(<DataIdeMissionControl metrics={{...baseMetrics,databaseName:'memory',schemaName:'main'}}
      tables={[{name:'users',rowCount:200}] as any} queries={[]} onSelectTableAnalysis={onSelectTableAnalysis}
      onNavigate={vi.fn()} onOpenImport={vi.fn()} onOpenCreate={vi.fn()} onOpenSettings={vi.fn()} onRefresh={vi.fn()}/>);
    expect(screen.getByText(/1 \/ 1 个数据集/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'处理检查问题'}));
    expect(onSelectTableAnalysis).toHaveBeenCalledWith('users');
  });

  it('keeps saved analyses reachable when queries do not need physical tables', () => {
    vi.stubGlobal('ResizeObserver',class { observe(){} unobserve(){} disconnect(){} });
    const board = {id:'saved',name:'已保存视图',databaseName:'memory',items:[{i:'item',savedQueryId:'missing',x:0,y:0,w:6,h:7}]} as any;
    render(<DataIdeMissionControl metrics={{...baseMetrics,totalRows:0,formattedTotalRows:'0'}} tables={[]} queries={[]}
      homeDashboard={board} onNavigate={vi.fn()} onOpenImport={vi.fn()} onOpenCreate={vi.fn()} onOpenSettings={vi.fn()} onRefresh={vi.fn()}/>);
    expect(screen.queryByText('导入数据开始分析')).toBeNull();
    expect(screen.getByText('1 项分析组件')).toBeTruthy();
    expect(screen.getAllByRole('button',{name:'导入数据',exact:true})).toHaveLength(1);
    expect(board.items).toHaveLength(1);
  });

  it('renders Analysis Home header, board empty state, assets and queries', () => {
    const onNavigate = vi.fn();
    const onOpenImport = vi.fn();

    render(
      <DataIdeMissionControl
        metrics={baseMetrics}
        tables={[{ name: 'users', rowCount: 200, formattedRowCount: '200', formattedSize: '100 KB', type: 'table' } as any]}
        queries={[]}
        homeDashboard={{ id: 'home', name: '分析首页', items: [], createdAt: 0, updatedAt: 0 }}
        onNavigate={onNavigate}
        onOpenImport={onOpenImport}
        onOpenCreate={vi.fn()}
        onOpenSettings={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', {name:'分析范围'})).toBeTruthy();
    expect(screen.queryByText('数据资产')).toBeNull();
    expect(screen.queryByText('数据来源与检查')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name:'查看 Schema'}));
    expect(onNavigate).toHaveBeenCalledWith(Tab.STRUCTURE);
    expect(screen.queryByText('最近查询')).toBeNull();
    expect(screen.queryByText('数据基础')).toBeNull();
    expect(screen.getByRole('heading', {name:'开始分析'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name:'新建查询'}));
    expect(onNavigate).toHaveBeenLastCalledWith(Tab.SQL);
    expect(useAppStore.getState().pendingNewQuery).toBe(true);
    expect(screen.getAllByRole('button', { name: '添加分析', exact: true })).toHaveLength(1);
    expect(screen.queryByText('系统健康')).toBeNull();
    expect(screen.queryByText('更多去向')).toBeNull();
    expect(screen.queryByText('性能趋势')).toBeNull();
    expect(screen.queryByTestId('studio-metric-strip')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '导入数据', exact: true }));
    expect(onOpenImport).toHaveBeenCalledTimes(1);
  });

  it('hides insight strip when healthy and shows it when errors exist', () => {
    const { rerender } = render(
      <DataIdeMissionControl
        metrics={baseMetrics}
        tables={[]}
        queries={[]}
        onNavigate={vi.fn()}
        onOpenImport={vi.fn()}
        onOpenCreate={vi.fn()}
        onOpenSettings={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.queryByText(/发现 .* 项异常/)).toBeNull();
    expect(screen.getAllByRole('button', {name: '导入数据', exact:true})).toHaveLength(1);
    expect(screen.queryByRole('button', {name:'添加分析', exact:true})).toBeNull();

    rerender(
      <DataIdeMissionControl
        metrics={{
          ...baseMetrics,
          errorCount: 2,
          qualityIssues: { missingPkCount: 0 },
          latencyDistribution: { slowCount: 0 },
        }}
        tables={[]}
        queries={[]}
        onNavigate={vi.fn()}
        onOpenImport={vi.fn()}
        onOpenCreate={vi.fn()}
        onOpenSettings={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.queryByText(/发现 .* 项异常/)).toBeNull();
    expect(screen.getByRole('button', {name: '查看失败查询（2）'})).toBeTruthy();
  });

  it('keeps the same workspace mounted during a refresh and reports waiting without placeholder content', () => {
    const props = {metrics:baseMetrics, tables:[{name:'users',rowCount:200}] as any, queries:[],
      homeDashboard:{id:'home',name:'真实分析视图',items:[],createdAt:0,updatedAt:0},
      onNavigate:vi.fn(),onOpenImport:vi.fn(),onOpenCreate:vi.fn(),onOpenSettings:vi.fn(),onRefresh:vi.fn()};
    const view = render(<DataIdeMissionControl {...props}/>);
    const selector = screen.getByRole('combobox',{name:'浏览数据集'});
    view.rerender(<DataIdeMissionControl {...props} dataLoading isRefreshing/>);
    expect(screen.getByRole('combobox',{name:'浏览数据集'})).toBe(selector);
    expect(screen.getByRole('status').textContent).toContain('当前视图保持可用');
    expect(view.container.querySelector('.workspace-load-placeholder')).toBeNull();
    expect(screen.getByRole('heading',{name:'真实分析视图'})).toBeTruthy();
  });

  it('does not expose the previous database board during a context switch', () => {
    useAppStore.getState().setCurrentDatabase('next-db');
    render(<DataIdeMissionControl metrics={{...baseMetrics,databaseName:'old-db'}}
      tables={[{name:'old-table',rowCount:200}] as any} queries={[]} homeBoardLoading
      homeDashboard={{id:'old-board',databaseName:'old-db',name:'旧工作台',items:[],createdAt:0,updatedAt:0}}
      onNavigate={vi.fn()} onOpenImport={vi.fn()} onOpenCreate={vi.fn()} onOpenSettings={vi.fn()} onRefresh={vi.fn()}/>);
    expect(screen.queryByRole('button',{name:'添加分析',exact:true})).toBeNull();
    expect(screen.queryByRole('combobox',{name:'浏览数据集'})).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('加载');
    expect(screen.queryByRole('heading',{name:'旧工作台'})).toBeNull();
  });
});
