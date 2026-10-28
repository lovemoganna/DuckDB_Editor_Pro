// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { DashboardWidget } from './DashboardWidget';
const mocks=vi.hoisted(()=>({execute:vi.fn(),queries:vi.fn()}));
vi.mock('../services/dbService',()=>({dbService:{getQueries:mocks.queries}}));
vi.mock('../services/workbench/runtime',()=>({executeWidget:mocks.execute,useWorkbenchRevision:()=>0,brushBindings:vi.fn(),temporalBrush:vi.fn()}));
vi.mock('../hooks/store/useAppStore',()=>({useAppStore:Object.assign((select:any)=>select({currentDatabase:'review'}),{getState:()=>({currentDatabase:'review'})})}));
vi.mock('./charts/ChartRenderer',async(importOriginal)=>{
 const actual=await importOriginal<typeof import('./charts/ChartRenderer')>();
 return {ChartRenderer:(props:any)=>props.chartSpec?.chartType==='table'?<actual.ChartRenderer {...props}/>:<button aria-label="测试系列" aria-pressed={!props.hiddenLegend?.has(0)} onClick={()=>props.onLegendChange(new Set(props.hiddenLegend?.has(0)?[]:[0]))}>系列</button>};
});
const query={id:'q',name:'amount',sql:'SELECT amount FROM source',databaseName:'review',widgetType:'table',createdAt:1};
const result=(amount:number)=>({query,rows:[{amount}],total:1,at:Date.now(),notices:[],fieldTypes:{amount:'INTEGER'},pageSize:100});
const props={savedQueryId:'q',ownerCatalog:'review',datasets:[],refreshTrigger:0,onRemove:vi.fn()};
beforeEach(()=>{vi.clearAllMocks();mocks.queries.mockResolvedValue([query]);});
afterEach(cleanup);
it('reports an instance configuration save failure inside the field configuration drawer',async()=>{
  mocks.execute.mockResolvedValue(result(10));
  const save=vi.fn().mockRejectedValue(new Error('instance storage unavailable'));
  render(<DashboardWidget {...props} item={{i:'placement',savedQueryId:'q',x:0,y:0,w:6,h:7}} onSettingsChange={save}/>);
  await screen.findByRole('button',{name:'10',exact:true});
  fireEvent.click(screen.getByRole('button',{name:'更多组件选项 amount'}));
  fireEvent.click(screen.getByRole('button',{name:'字段 / 单位配置'}));
  fireEvent.click(screen.getByRole('button',{name:'应用',exact:true}));
  expect(await screen.findByRole('alert')).toHaveTextContent('instance storage unavailable');
  expect(screen.getByRole('dialog',{name:'图表字段配置'})).toBeTruthy();
  expect(save).toHaveBeenCalledTimes(1);
});
it('coalesces refreshes and ignores the old response before executing the latest',async()=>{
  let release!:(value:any)=>void;
  mocks.execute.mockReturnValueOnce(new Promise(resolve=>{release=resolve;})).mockResolvedValueOnce(result(22));
  const {rerender}=render(<DashboardWidget {...props}/>);
  await waitFor(()=>expect(mocks.execute).toHaveBeenCalledTimes(1));
  rerender(<DashboardWidget {...props} refreshTrigger={1}/>);
  rerender(<DashboardWidget {...props} refreshTrigger={2}/>);
  rerender(<DashboardWidget {...props} refreshTrigger={3}/>);
  expect(mocks.execute).toHaveBeenCalledTimes(1);
  await act(async()=>release(result(11)));
  await screen.findByRole('button',{name:'22',exact:true});
  expect(mocks.execute).toHaveBeenCalledTimes(2);
  expect(mocks.execute.mock.calls[1][0].refresh).toBe(3);
  expect(screen.getByRole('button',{name:'22',exact:true})).toBeTruthy();expect(screen.queryByText('11')).toBeNull();
});
it('clears stale results with an explicit failed refresh and retry',async()=>{
  mocks.execute.mockResolvedValueOnce(result(10)).mockRejectedValueOnce(new Error('来源暂不可用'));
  const {rerender}=render(<DashboardWidget {...props}/>);
  await screen.findByRole('button',{name:'10',exact:true});
  rerender(<DashboardWidget {...props} refreshTrigger={1}/>);
  await screen.findByText(/来源暂不可用/);
  expect(screen.queryByText('10')).toBeNull();expect(screen.getByRole('button',{name:'重试'})).toBeTruthy();
});
it('clears the old result when the component identity changes to a missing query',async()=>{
  mocks.execute.mockResolvedValueOnce(result(10));
  const {rerender}=render(<DashboardWidget {...props}/>);
  await screen.findByRole('button',{name:'10',exact:true});
  rerender(<DashboardWidget {...props} savedQueryId="missing"/>);
  await screen.findByText(/未找到已保存的查询组件/);
  expect(screen.queryByText('10')).toBeNull();
});

it('keeps the fullscreen inspector and successful rows visible during a same-scope refresh',async()=>{
  let release!:(value:any)=>void;
  mocks.execute.mockResolvedValueOnce(result(10)).mockReturnValueOnce(new Promise(resolve=>{release=resolve;}));
  const view=render(<DashboardWidget {...props}/>);
  await screen.findByRole('button',{name:'10',exact:true});
  fireEvent.click(screen.getByRole('button',{name:'更多组件选项 amount'}));
  fireEvent.click(screen.getByRole('button',{name:'全屏查看'}));
  view.rerender(<DashboardWidget {...props} refreshTrigger={1}/>);
  await waitFor(()=>expect(mocks.execute).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('button',{name:'关闭全屏透视'})).toBeTruthy();
  expect(screen.getAllByRole('button',{name:'10',exact:true})).toHaveLength(2);
  await act(async()=>release(result(22)));
  expect(screen.getAllByRole('button',{name:'22',exact:true})).toHaveLength(2);
});

it('does not retain old totals or filter notices when a new scope fails',async()=>{
  mocks.execute.mockResolvedValueOnce({...result(10),total:201,notices:['旧条件说明']}).mockRejectedValueOnce(new Error('新条件查询失败'));
  const view=render(<DashboardWidget {...props}/>);
  await screen.findByText('旧条件说明');
  view.rerender(<DashboardWidget {...props} context={{refreshSeconds:0,filters:[{id:'status',field:'status',operator:'eq',value:'completed',bindings:{d:'status'}}]}}/>);
  await screen.findByText(/新条件查询失败/);
  expect(screen.queryByText('旧条件说明')).toBeNull();
  expect(screen.queryByText(/201 行/)).toBeNull();
  expect(screen.queryByRole('button',{name:'下一页'})).toBeNull();
});

it('keeps a successful empty-result inspector open during refresh',async()=>{
  let release!:(value:any)=>void;
  const empty={...result(10),rows:[],total:0};
  mocks.execute.mockResolvedValueOnce(empty).mockReturnValueOnce(new Promise(resolve=>{release=resolve;}));
  const view=render(<DashboardWidget {...props}/>);
  await screen.findByRole('button',{name:'更多组件选项 amount'});
  fireEvent.click(screen.getByRole('button',{name:'更多组件选项 amount'}));
  fireEvent.click(screen.getByRole('button',{name:'全屏查看'}));
  view.rerender(<DashboardWidget {...props} refreshTrigger={1}/>);
  await waitFor(()=>expect(mocks.execute).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('button',{name:'关闭全屏透视'})).toBeTruthy();
  await act(async()=>release(empty));
});

it('clears results when a saved definition changes under the same query id',async()=>{
  let release!:(value:any)=>void;
  mocks.execute.mockResolvedValueOnce(result(10)).mockReturnValueOnce(new Promise(resolve=>{release=resolve;}));
  const view=render(<DashboardWidget {...props}/>);
  await screen.findByRole('button',{name:'10',exact:true});
  mocks.queries.mockResolvedValue([{...query,name:'fee',sql:'SELECT fee FROM source'}]);
  view.rerender(<DashboardWidget {...props} refreshTrigger={1}/>);
  await waitFor(()=>expect(mocks.execute).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('button',{name:'10',exact:true})).toBeNull();
  await act(async()=>release({...result(22),query:{...query,name:'fee',sql:'SELECT fee FROM source'}}));
  await screen.findByRole('button',{name:'22',exact:true});
});

it('closes the component menu with Escape and opens one configuration dialog',async()=>{
  mocks.execute.mockResolvedValue(result(10));
  render(<DashboardWidget {...props}/>);
  await screen.findByRole('button',{name:'10',exact:true});
  const menu=screen.getByRole('button',{name:'更多组件选项 amount'});
  fireEvent.click(menu);
  await screen.findByRole('button',{name:'字段 / 单位配置'});
  fireEvent.keyDown(window,{key:'Escape'});
  expect(menu.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(menu);
  fireEvent.click(await screen.findByRole('button',{name:'字段 / 单位配置'}));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog',{name:'图表字段配置'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'关闭图表配置'}));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button',{name:'10',exact:true})).toBeTruthy();
});

it('shares legend selection between the card and fullscreen without changing query configuration',async()=>{
  const chartQuery={...query,widgetType:'chart',charts:[{id:'chart',title:'amount',type:'line',xKey:'month',yKeys:['amount']}]};
  mocks.queries.mockResolvedValue([chartQuery]);
  mocks.execute.mockResolvedValue({...result(10),query:chartQuery,rows:[{month:'2025-01',amount:10}]});
  render(<DashboardWidget {...props}/>);
  const legend=await screen.findByRole('button',{name:'测试系列'});
  fireEvent.click(legend);
  expect(legend.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(screen.getByRole('button',{name:'更多组件选项 amount'}));
  fireEvent.click(screen.getByRole('button',{name:'全屏查看'}));
  expect(screen.getAllByRole('button',{name:'测试系列'}).map(b=>b.getAttribute('aria-pressed'))).toEqual(['false','false']);
  fireEvent.click(screen.getAllByRole('button',{name:'测试系列'})[1]);
  expect(legend.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button',{name:'关闭全屏透视'}));
  expect(screen.getAllByRole('button',{name:'测试系列'})).toHaveLength(1);
});
