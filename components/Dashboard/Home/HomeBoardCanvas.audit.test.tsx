// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HomeBoardCanvas } from './HomeBoardCanvas';
import { useAppStore } from '../../../hooks/store/useAppStore';
import type { DatasetDefinition } from '../../../services/workbench/analysisTypes';
import { dbService } from '../../../services/dbService';

const mocks=vi.hoisted(()=>({load:vi.fn(),revision:0}));
vi.mock('../../../services/dbService',()=>({dbService:{updateDashboard:vi.fn()}}));
vi.mock('../../../services/workbench/datasets',()=>({loadDatasets:mocks.load}));
vi.mock('../../../services/workbench/runtime',()=>({useWorkbenchRevision:()=>mocks.revision}));
vi.mock('./WorkspaceObjects',()=>({WorkspaceObjects:({controls}:any)=><div>{controls}</div>}));
vi.mock('./WorkbenchControls',()=>({DashboardContextControls:()=>null,DatasetComposer:()=>null,DatasetWidgetBuilder:()=>null}));
vi.mock('./DatasetPreview',()=>({DatasetPreview:({dataset}:any)=><div>{dataset ? `preview:${dataset.name}` : 'missing-preview'}</div>}));
vi.mock('../../DashboardGrid',()=>({DashboardGrid:()=>null}));
const dataset:DatasetDefinition={id:'d',name:'orders',kind:'query',catalog:'memory',schema:'main',sql:'SELECT 1 AS id',fields:[{name:'id',type:'INTEGER'}],version:1};
const props={dashboard:{id:'b',name:'board',databaseName:'memory',items:[],createdAt:1,updatedAt:1},refreshTrigger:0,brushFilter:null,onBrushFilterChange:vi.fn(),onDashboardChange:vi.fn(),onNavigate:vi.fn()};
beforeEach(()=>{mocks.revision=0;mocks.load.mockReset();mocks.load.mockResolvedValue([dataset]);useAppStore.setState({activeDataset:null,currentDatabase:'memory'});});
afterEach(cleanup);
it('reloads dataset metadata on the header refresh trigger without losing the selection',async()=>{
  const view=render(<HomeBoardCanvas {...props}/>);
  await screen.findByRole('option',{name:'orders'});
  fireEvent.change(screen.getByRole('combobox',{name:'浏览数据集'}),{target:{value:'d'}});
  mocks.load.mockResolvedValue([dataset,{...dataset,id:'new',name:'new-source'}]);
  view.rerender(<HomeBoardCanvas {...props} refreshTrigger={1}/>);
  await screen.findByRole('option',{name:'new-source'});
  expect(screen.getByRole('combobox',{name:'浏览数据集'})).toHaveValue('d');
});
it('disables layout toggling until persistence finishes and permits retry after failure',async()=>{
  let reject!: (error: Error) => void;
  vi.mocked(dbService.updateDashboard).mockReset().mockImplementationOnce(() => new Promise((_resolve,r)=>{reject=r;}));
  const dashboard={...props.dashboard,items:[{i:'w',savedQueryId:'q',x:0,y:0,w:3,h:3}]};
  render(<HomeBoardCanvas {...props} dashboard={dashboard}/>);
  const button=screen.getByRole('button',{name:'编辑布局'});
  fireEvent.click(button);
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(dbService.updateDashboard).toHaveBeenCalledTimes(1);
  await act(async()=>reject(new Error('storage unavailable')));
  expect(button).toBeEnabled();
  vi.mocked(dbService.updateDashboard).mockResolvedValueOnce({...dashboard,layoutLocked:false});
  fireEvent.click(button);
  await waitFor(()=>expect(dbService.updateDashboard).toHaveBeenCalledTimes(2));
});
it('adopts the active dataset after an asynchronous list finishes loading',async()=>{
  let finish!:(datasets:DatasetDefinition[])=>void;
  const view=render(<HomeBoardCanvas {...props}/>);
  await screen.findByRole('option',{name:'orders'});
  mocks.load.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));mocks.revision++;
  view.rerender(<HomeBoardCanvas {...props}/>);
  act(()=>useAppStore.getState().setActiveDataset({...dataset,id:'new',name:'new-orders',origin:'home'}));
  await act(async()=>finish([dataset,{...dataset,id:'new',name:'new-orders'}]));
  await waitFor(()=>expect(screen.getByRole('combobox',{name:'浏览数据集'})).toHaveProperty('value','new'));
  expect(screen.getByText('preview:new-orders')).toBeTruthy();
});
it('clears a removed selection and offers the remaining datasets',async()=>{
  const view=render(<HomeBoardCanvas {...props}/>);
  await screen.findByRole('option',{name:'orders'});
  fireEvent.change(screen.getByRole('combobox',{name:'浏览数据集'}),{target:{value:'d'}});
  await screen.findByText('preview:orders');
  mocks.load.mockResolvedValue([{...dataset,id:'other',name:'remaining'}]);mocks.revision++;
  view.rerender(<HomeBoardCanvas {...props}/>);
  await screen.findByRole('option',{name:'remaining'});
  await waitFor(()=>expect(screen.queryByText('missing-preview')).toBeNull());
  expect(screen.getByRole('combobox',{name:'浏览数据集'})).toHaveProperty('value','');
  expect(useAppStore.getState().activeDataset).toBeNull();
});
