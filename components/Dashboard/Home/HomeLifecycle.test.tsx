import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DataIdeMissionControl } from '../MissionControl/DataIdeMissionControl';
import { HomeBoardCanvas } from './HomeBoardCanvas';
import type { Dashboard } from '../../../types';

const baseline = { id:'fixed-funds',name:'资金业务总览',databaseName:'sql_funds_flow',items:[{i:'usd',savedQueryId:'usd-gmv',x:0,y:0,w:3,h:3}],createdAt:1,updatedAt:1 } as Dashboard;
const { load, revision }=vi.hoisted(()=>({revision:{value:0},load:vi.fn(async()=>[{id:'fiat',name:'fiat_transactions',catalog:'sql_funds_flow',schema:'main',table:'fiat_transactions',kind:'table',fields:[],version:1}])}));
// These doubles test component lifetime and inputs; data results are tested against baseline.duckdb separately.
function StatefulChild() { const [choice,setChoice]=React.useState('all'); return <input aria-label="组件局部选择" value={choice} onChange={e=>setChoice(e.target.value)}/>; }
vi.mock('../Home',()=>({HomeHeader:()=>null,HomeBoardCanvas:()=> <StatefulChild/>}));
vi.mock('../../DashboardGrid',()=>({DashboardGrid:()=> <StatefulChild/>}));
vi.mock('./WorkspaceObjects',()=>({WorkspaceObjects:({controls}:{controls:React.ReactNode})=> <div>{controls}</div>}));
vi.mock('./WorkbenchControls',()=>({DashboardContextControls:()=>null,DatasetComposer:()=>null,DatasetWidgetBuilder:()=>null}));
vi.mock('./DatasetPreview',()=>({DatasetPreview:({revision}:{revision:number})=> <output aria-label="明细修订">{revision}</output>}));
vi.mock('../../../services/workbench/datasets',()=>({loadDatasets:load}));
vi.mock('../../../services/workbench/runtime',()=>({useWorkbenchRevision:()=>revision.value}));
vi.mock('../../../services/dbService',()=>({dbService:{}}));
vi.mock('../../../hooks/store/useCopilotStore',()=>({useCopilotStore:()=>vi.fn()}));
vi.mock('../../../hooks/store/useSqlEditorStore',()=>({useSqlEditorStore:()=>vi.fn()}));
vi.mock('../../../hooks/store/useAppStore',()=>({useAppStore:Object.assign((select:any)=>select({currentDatabase:'sql_funds_flow',activeDataset:null}), {getState:()=>({setActiveDataset:vi.fn(),activeDataset:null})})}));
vi.mock('../../../hooks/store/useAnalysisWorkspace',()=>({useAnalysisWorkspace:{}}));
vi.mock('../../../hooks/store/useDataInspection',()=>({useDataInspection:(select:any)=>select({reports:{}})}));
afterEach(()=>{cleanup();vi.useRealTimers();revision.value=0;vi.clearAllMocks();});

it('keeps the existing workbench mounted while metadata refreshes',()=>{
  const props={metrics:{databaseName:'sql_funds_flow',schemaName:'main'} as any,tables:[{name:'fiat_transactions',rowCount:25}] as any,queries:[],homeDashboard:baseline,onNavigate:vi.fn(),onOpenImport:vi.fn(),onOpenCreate:vi.fn(),onOpenSettings:vi.fn(),onRefresh:vi.fn()};
  const view=render(<DataIdeMissionControl {...props}/>);
  fireEvent.change(screen.getByLabelText('组件局部选择'),{target:{value:'net:hidden'}});
  view.rerender(<DataIdeMissionControl {...props} dataLoading homeBoardLoading/>);
  expect(screen.getByLabelText('组件局部选择')).toHaveProperty('value','net:hidden');
  view.rerender(<DataIdeMissionControl {...props}/>);
  expect(screen.getByLabelText('组件局部选择')).toHaveProperty('value','net:hidden');
});

it('keeps chart instances mounted while the saved board refreshes',async()=>{
  const props={dashboard:baseline,refreshTrigger:0,brushFilter:null,onBrushFilterChange:vi.fn(),onDashboardChange:vi.fn(),onNavigate:vi.fn()};
  const view=render(<HomeBoardCanvas {...props}/>);
  fireEvent.change(await screen.findByLabelText('组件局部选择'),{target:{value:'net:hidden'}});
  view.rerender(<HomeBoardCanvas {...props} loading/>);
  expect(screen.getByLabelText('组件局部选择')).toHaveProperty('value','net:hidden');
  view.rerender(<HomeBoardCanvas {...props} refreshTrigger={1}/>);
  expect(screen.getByLabelText('组件局部选择')).toHaveProperty('value','net:hidden');
});

it('refreshes visible dataset details and widgets on the same board timer',async()=>{
  vi.useFakeTimers();
  const board={...baseline,context:{filters:[],refreshSeconds:30}};
  render(<HomeBoardCanvas dashboard={board} refreshTrigger={0} brushFilter={null} onBrushFilterChange={vi.fn()} onDashboardChange={vi.fn()} onNavigate={vi.fn()}/>);
  await act(async()=>{await Promise.resolve();});
  fireEvent.change(screen.getByRole('combobox',{name:'浏览数据集'}),{target:{value:'fiat'}});
  expect(screen.getByLabelText('明细修订').textContent).toBe('0');
  act(()=>vi.advanceTimersByTime(30000));
  expect(screen.getByLabelText('明细修订').textContent).toBe('1');
});

it('ignores a failed older retry after a newer dataset refresh succeeds',async()=>{
  let rejectOld!:(error:Error)=>void;
  load.mockRejectedValueOnce(new Error('读取失败')).mockImplementationOnce(()=>new Promise((_resolve,reject)=>{rejectOld=reject;}));
  const props={dashboard:baseline,refreshTrigger:0,brushFilter:null,onBrushFilterChange:vi.fn(),onDashboardChange:vi.fn(),onNavigate:vi.fn()};
  const view=render(<HomeBoardCanvas {...props}/>);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button',{name:'重试读取数据集'}));
  revision.value=1;
  view.rerender(<HomeBoardCanvas {...props}/>);
  await screen.findByRole('option',{name:'fiat_transactions'});
  await act(async()=>rejectOld(new Error('旧请求失败')));
  expect(screen.queryByRole('alert')).toBeNull();
});

it('pauses automatic refresh while hidden and refreshes once on return',async()=>{
  vi.useFakeTimers();
  let visibility='visible';
  const visible=vi.spyOn(document,'visibilityState','get').mockImplementation(()=>visibility as DocumentVisibilityState);
  render(<HomeBoardCanvas dashboard={{...baseline,context:{filters:[],refreshSeconds:30}}} refreshTrigger={0} brushFilter={null} onBrushFilterChange={vi.fn()} onDashboardChange={vi.fn()} onNavigate={vi.fn()}/>);
  await act(async()=>{await Promise.resolve();});
  fireEvent.change(screen.getByRole('combobox',{name:'浏览数据集'}),{target:{value:'fiat'}});
  visibility='hidden';fireEvent(document,new Event('visibilitychange'));
  act(()=>vi.advanceTimersByTime(90000));expect(screen.getByLabelText('明细修订')).toHaveTextContent('0');
  visibility='visible';fireEvent(document,new Event('visibilitychange'));
  expect(screen.getByLabelText('明细修订')).toHaveTextContent('1');
  fireEvent(document,new Event('visibilitychange'));expect(screen.getByLabelText('明细修订')).toHaveTextContent('1');
  act(()=>vi.advanceTimersByTime(30000));expect(screen.getByLabelText('明细修订')).toHaveTextContent('2');
  visible.mockRestore();
});
