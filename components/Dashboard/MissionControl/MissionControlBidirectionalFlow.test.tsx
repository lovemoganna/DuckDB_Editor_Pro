// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfirmDialogProvider } from '../../ui/ConfirmDialog';
import { Dashboard } from '../../Dashboard';
import { Tab } from '../../../types';
import { useAppStore } from '../../../hooks/store/useAppStore';
import { useSqlEditorStore } from '../../../hooks/store/useSqlEditorStore';

const mocks = vi.hoisted(() => ({ tables: [] as string[], counts: {} as Record<string, number>, readQuery: vi.fn(), batch: vi.fn() }));
const board = vi.hoisted(() => ({ id:'home-current',name:'Analysis',databaseName:'memory',items:[],createdAt:1,updatedAt:1 }));
vi.mock('../../../services/duckdbService', () => ({ duckDBService: {
  query: mocks.readQuery, readQuery: mocks.readQuery, readQueryBatchWithParams: mocks.batch,
  getTables: async () => mocks.tables, getTableSchema: async () => [{name:'id',type:'INTEGER',pk:true}],
  getCurrentCatalogAndSchema: async () => ({catalog:'memory',schema:'main'}),
  listAnalysisContexts: async () => [{id:'memory',label:'memory / main',kind:'database',isCurrent:true}],
  isBatchRunning: () => false, getRuntimeInfo: () => ({storageMode:'memory'}),
} }));
vi.mock('../../../services/dynamicHome', () => ({ensureDynamicHome: async () => ({board,widgetsAdded:0,tableNames:mocks.tables})}));
vi.mock('../../../services/analysisObjects', () => ({listAnalysisObjects: async () => []}));
vi.mock('../../../services/dbService', () => ({dbService: {
  getDashboards: async () => [board], getQueries: async () => [],
  getDomainSetting: async () => null, saveDomainSetting: vi.fn(),
} }));
vi.mock('../../../services/toastService', () => ({toastService:{info:vi.fn(),success:vi.fn(),error:vi.fn(),warning:vi.fn(),show:vi.fn()}}));

// Contract test with database doubles. Real SQL/data correctness is covered by fundsBaseline.integration.test.ts.
describe('current analysis home data and navigation contract', () => {
  beforeEach(() => {
    localStorage.clear(); mocks.tables=[]; mocks.counts={};
    useAppStore.setState({tables:[],currentTable:null,currentDatabase:'memory',pendingSql:'',activeTab:Tab.DASHBOARD,dashboardRefreshTrigger:0});
    useSqlEditorStore.setState({history:[],tabs:[],activeTabId:''});
    mocks.readQuery.mockImplementation(async (sql:string) => {
      if (sql.startsWith('DESCRIBE')) return [{column_name:'id',column_type:'INTEGER',key:'PRI',null:'NO'}];
      if (sql.includes('duckdb_tables()')) return mocks.tables.map(table_name => ({database_name:'memory',schema_name:'main',table_name}));
      if (sql.includes('COUNT(*)')) {
        const table=mocks.tables.find(name=>sql.includes(`"${name}"`));
        return [{cnt:table?mocks.counts[table]:0}];
      }
      if (sql.includes('duckdb_databases()')) return [{database_name:'memory'}];
      return [];
    });
    mocks.batch.mockImplementation(async () => [[{count:8500}],[{id:42}]]);
  });
  afterEach(() => {cleanup();vi.clearAllMocks();});

  it('updates metadata consumers after schema changes and preserves navigation context', async () => {
    const onNavigate=vi.fn((tab:Tab)=>useAppStore.getState().setActiveTab(tab));
    const renderHome=(tables:string[]) => <ConfirmDialogProvider><Dashboard tables={tables} onNavigate={onNavigate} runtimeInfo={{version:'1.33.1',persistent:false,ready:true}}/></ConfirmDialogProvider>;
    const view=render(renderHome([]));
    await screen.findByRole('button',{name:'导入数据',exact:true});
    expect(screen.queryByRole('alert')).toBeNull();

    mocks.tables=['orders','customers'];mocks.counts={orders:8500,customers:320};
    act(()=>{useAppStore.getState().setTables(mocks.tables);window.dispatchEvent(new Event('duckdb-schema-changed'));});
    view.rerender(renderHome(mocks.tables));
    await screen.findByText(/2 个数据集 · 8\.8 K 行/);
    await screen.findByRole('option',{name:'memory.main.orders'});
    fireEvent.change(screen.getByRole('combobox',{name:'浏览数据集'}),{target:{value:'table:["memory","main","orders"]'}});
    await screen.findByText('memory.main.orders · 明细预览');
    await screen.findByText('42');
    expect(mocks.batch).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({sql:expect.stringContaining('"memory"."main"."orders"')})]));
    fireEvent.click(screen.getByRole('button',{name:'管理数据'}));
    expect(onNavigate).toHaveBeenLastCalledWith(Tab.DATA);
    expect(useAppStore.getState().currentDatabase).toBe('memory');
    fireEvent.click(screen.getByRole('button',{name:'查看 Schema'}));
    expect(onNavigate).toHaveBeenLastCalledWith(Tab.STRUCTURE);

    mocks.tables=['orders'];
    act(()=>{useAppStore.getState().setTables(mocks.tables);window.dispatchEvent(new Event('duckdb-schema-changed'));});
    view.rerender(renderHome(mocks.tables));
    await screen.findByText(/1 个数据集 · 8\.5 K 行/);
    await waitFor(()=>expect(screen.queryByRole('option',{name:'memory.main.customers'})).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
