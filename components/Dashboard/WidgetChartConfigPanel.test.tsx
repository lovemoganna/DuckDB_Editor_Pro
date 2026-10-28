// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WidgetChartConfigPanel } from './WidgetChartConfigPanel';

afterEach(cleanup);
it('waits for saving, reports failure in the drawer and retains the draft for retry', async () => {
  let reject!: (error: Error) => void;
  const change=vi.fn().mockImplementationOnce(() => new Promise((_resolve,r)=>{reject=r;})).mockResolvedValueOnce(undefined);
  render(<WidgetChartConfigPanel columns={['amount']} config={{id:'k',title:'Value',type:'kpi',xKey:'',yKeys:['amount']}} onChange={change} onClose={vi.fn()}/>);
  fireEvent.change(screen.getByRole('textbox',{name:'计量单位'}),{target:{value:'USD'}});
  const apply=screen.getByRole('button',{name:'应用'});
  fireEvent.click(apply);
  expect(apply).toBeDisabled();
  fireEvent.click(apply);
  expect(change).toHaveBeenCalledTimes(1);
  await act(async()=>reject(new Error('storage unavailable')));
  expect(screen.getByRole('alert')).toHaveTextContent('storage unavailable');
  expect(screen.getByRole('textbox',{name:'计量单位'})).toHaveValue('USD');
  expect(apply).toBeEnabled();
  await act(async()=>fireEvent.click(apply));
  expect(change).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).toBeNull();
});
it('configures pivot dimensions and aggregation through the same field editor', () => {
  const change=vi.fn();
  render(<WidgetChartConfigPanel columns={['channel','status','amount']} config={{id:'p',title:'Orders',type:'table',xKey:'channel',yKeys:['amount']}} onChange={change} onClose={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText('表格展示'),{target:{value:'pivot'}});
  fireEvent.change(screen.getByLabelText('透视列维度'),{target:{value:'status'}});
  fireEvent.change(screen.getByLabelText('透视汇总方式'),{target:{value:'avg'}});
  fireEvent.click(screen.getByRole('button',{name:'应用'}));
  expect(change).toHaveBeenCalledWith(expect.objectContaining({type:'pivot',colKey:'status',aggFunc:'avg'}));
});
it('applies fixed bin width and percentage mode through the shared saved configuration', () => {
  const change=vi.fn();
  render(<WidgetChartConfigPanel columns={['amount']} config={{id:'h',title:'Distribution',type:'histogram',xKey:'amount',yKeys:['amount']}} onChange={change} onClose={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText('分箱宽度'),{target:{value:'2.5'}});
  fireEvent.change(screen.getByLabelText('直方图纵轴指标'),{target:{value:'percent'}});
  fireEvent.click(screen.getByRole('button',{name:'应用'}));
  expect(change).toHaveBeenCalledWith(expect.objectContaining({binWidth:2.5,valueMode:'percent'}));
});
it('applies waterfall roles and KPI targets without discarding existing formats', () => {
  const change=vi.fn();
  const view=render(<WidgetChartConfigPanel columns={['amount','role']} config={{id:'w',title:'Changes',type:'waterfall',xKey:'role',yKeys:['amount'],format:{decimals:3}}} onChange={change} onClose={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText('节点角色字段'),{target:{value:'role'}});
  fireEvent.click(screen.getByRole('button',{name:'应用'}));
  expect(change).toHaveBeenCalledWith(expect.objectContaining({waterfallRoleKey:'role',format:{decimals:3}}));
  view.unmount();
  render(<WidgetChartConfigPanel columns={['amount','prior']} config={{id:'k',title:'Value',type:'kpi',xKey:'',yKeys:['amount']}} onChange={change} onClose={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText('比较基准字段'),{target:{value:'prior'}});
  fireEvent.change(screen.getByLabelText('指标目标值'),{target:{value:'100'}});
  fireEvent.click(screen.getByRole('button',{name:'应用'}));
  expect(change).toHaveBeenLastCalledWith(expect.objectContaining({kpiBaselineKey:'prior',kpiTarget:100}));
});
it('keeps configuration outside the clipped widget and applies the edited draft explicitly', () => {
  const change = vi.fn(), close = vi.fn();
  const { container } = render(<div style={{height:100,overflow:'hidden'}}><WidgetChartConfigPanel columns={['value']} config={{id:'c',title:'Total',type:'counter',xKey:'value',yKeys:['value'],unit:'USD'}} onChange={change} onClose={close}/></div>);
  const dialog = screen.getByRole('dialog', {name:'图表字段配置'});
  expect(container.contains(dialog)).toBe(false);
  fireEvent.change(screen.getByRole('textbox', {name:'计量单位'}), {target:{value:'USDT'}});
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name:'应用'}));
  expect(change).toHaveBeenCalledWith(expect.objectContaining({unit:'USDT',type:'counter'}));
  fireEvent.keyDown(document.activeElement || document, {key:'Escape'});
  expect(close).toHaveBeenCalled();
});
