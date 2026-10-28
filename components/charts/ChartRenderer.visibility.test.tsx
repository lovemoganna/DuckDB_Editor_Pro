// @vitest-environment jsdom
import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const {resize}=vi.hoisted(()=>({resize:vi.fn()}));
vi.mock('react-chartjs-2',async()=>{
  const React=await import('react');
  const Fake=React.forwardRef((_props:any,ref:any)=>{
    React.useImperativeHandle(ref,()=>({resize,setDatasetVisibility:vi.fn(),isDatasetVisible:()=>true,toggleDataVisibility:vi.fn(),getDataVisibility:()=>true,update:vi.fn()}));
    return <canvas/>;
  });
  return {Bar:Fake,Line:Fake,Pie:Fake,Doughnut:Fake,Scatter:Fake};
});
import { ChartRenderer } from './ChartRenderer';
import { widgetRowsToChartSpec } from '../../services/analysis/adapters/dashboardWidgetAdapter';
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();resize.mockClear();});
it('synchronizes the canvas dimensions when only the container height changes',()=>{
 let size={width:600,height:400};
 const callbacks:Array<()=>void>=[];
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(()=>size as DOMRect);
 vi.stubGlobal('ResizeObserver',class{constructor(callback:()=>void){callbacks.push(callback);}observe(){}disconnect(){}});
 const spec=widgetRowsToChartSpec([{channel:'ach',amount:2270},{channel:'wire_transfer',amount:102000}],{id:'arc',title:'USD',type:'pie',xKey:'channel',yKeys:['amount'],unit:'USD'});
 render(<ChartRenderer chartSpec={spec}/>);
 expect(resize).toHaveBeenLastCalledWith(584,384);
 act(()=>{size={width:600,height:240};callbacks.forEach(callback=>callback());});
 expect(resize).toHaveBeenLastCalledWith(584,224);
});
it('renders two presentations from one visibility state and propagates both directions',()=>{
  const spec=widgetRowsToChartSpec([{month:'2025-01',net:10}],{id:'c',title:'monthly',type:'line',xKey:'month',yKeys:['net']});
  function Pair(){
    const [hidden,setHidden]=useState<ReadonlySet<number>>(new Set());
    return <><ChartRenderer chartSpec={spec} hiddenLegend={hidden} onLegendChange={setHidden}/><ChartRenderer chartSpec={spec} hiddenLegend={hidden} onLegendChange={setHidden}/></>;
  }
  render(<Pair/>);
  const legends=screen.getAllByRole('button',{name:'net'});
  fireEvent.click(legends[0]);
  expect(legends.map(l=>l.getAttribute('aria-pressed'))).toEqual(['false','false']);
  fireEvent.click(legends[1]);
  expect(legends.map(l=>l.getAttribute('aria-pressed'))).toEqual(['true','true']);
});

it('uses current filtered rows for table totals and links the clicked cell field',()=>{
 const onBrush=vi.fn();
 const spec=widgetRowsToChartSpec([{category:'A',amount:10},{category:'B',amount:20}],{id:'table',title:'table',type:'table',xKey:'category',yKeys:['amount'],unit:'USD'});
 render(<ChartRenderer chartSpec={spec} onBrush={onBrush}/>);
 fireEvent.change(screen.getByLabelText('筛选表格'),{target:{value:'A'}});
 expect(screen.getByText('1 / 2 行')).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'B'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'A',exact:true}));
 expect(onBrush).toHaveBeenCalledWith('category','A');
 expect(screen.getAllByText(/10.*USD/).length).toBeGreaterThanOrEqual(2);
});

it('clears table filtering when non-measure result fields change', () => {
  const config = {id:'table',title:'table',type:'table' as const,xKey:'category',yKeys:['amount']};
  const first = widgetRowsToChartSpec([{category:'A',amount:10n,note:'old'}],config);
  const view = render(<ChartRenderer chartSpec={first}/>);
  fireEvent.change(screen.getByLabelText('筛选表格'),{target:{value:'old'}});
  expect(screen.getByText('1 / 1 行')).toBeInTheDocument();
  view.rerender(<ChartRenderer chartSpec={widgetRowsToChartSpec([{category:'A',amount:10n,note:'new'}],config)}/>);
  expect(screen.getByLabelText('筛选表格')).toHaveValue('');
  expect(screen.getByText('new')).toBeInTheDocument();
});

it('renders doughnut chart with legend alignment and toggling', () => {
  const spec = widgetRowsToChartSpec(
    [
      { type: 'A', count: 30 },
      { type: 'B', count: 70 },
    ],
    { id: 'donut', title: 'Donut Chart', type: 'doughnut', xKey: 'type', yKeys: ['count'] }
  );
  render(<ChartRenderer chartSpec={spec} />);
  const legend = screen.getByLabelText('图例');
  expect(legend).toBeInTheDocument();
  const buttons = screen.getAllByRole('button');
  expect(buttons.length).toBeGreaterThanOrEqual(2);
  expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(buttons[0]);
  expect(buttons[0]).toHaveAttribute('aria-pressed', 'false');
});

it('triggers re-measurement on window resize for zooming and layout shifts', () => {
  let size = { width: 500, height: 300 };
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => size as DOMRect);
  const spec = widgetRowsToChartSpec([{ x: 'A', y: 10 }], { id: 'bar', title: 'Bar', type: 'bar', xKey: 'x', yKeys: ['y'] });
  render(<ChartRenderer chartSpec={spec} />);
  expect(resize).toHaveBeenCalled();
  const callsBefore = resize.mock.calls.length;
  act(() => {
    size = { width: 700, height: 400 };
    window.dispatchEvent(new Event('resize'));
  });
  expect(resize.mock.calls.length).toBeGreaterThan(callsBefore);
});
