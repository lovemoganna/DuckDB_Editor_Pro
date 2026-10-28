import React from 'react';
import { render,screen,fireEvent } from '@testing-library/react';
import { expect,it,vi } from 'vitest';
import { ChartRenderer } from './ChartRenderer';
import { widgetRowsToChartSpec } from '../../services/analysis/adapters/dashboardWidgetAdapter';
import {PivotTableView} from './PivotTableView';
import {computePivotTable} from '../../services/analysis/chartDisplay';
it('uses engine averages for pivot totals and supports collapse and linked cells',()=>{
  const spec=widgetRowsToChartSpec([{region:'A',product:'X',value:10},{region:'A',product:'Y',value:30},{region:'B',product:'X',value:50}],
    {id:'pivot',title:'透视',type:'pivot',xKey:'region',yKeys:['value'],rowKey:'region',colKey:'product',valKey:'value',aggFunc:'avg',unit:'USD'});
  expect(spec.pivotTable?.grandTotal).toBe(30);
  const brush=vi.fn();render(<ChartRenderer chartSpec={spec} onBrush={brush}/>);
  fireEvent.click(screen.getByRole('button',{name:'10 USD'}));expect(brush).toHaveBeenCalledWith('region','A');
  fireEvent.click(screen.getByRole('button',{name:'隐藏行值 A'}));expect(screen.queryByRole('button',{name:'10 USD'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'显示行值 A'}));expect(screen.getByRole('button',{name:'10 USD'})).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox',{name:'筛选透视维度'}),{target:{value:'A'}});
  expect(screen.queryByRole('button',{name:'50 USD'})).toBeNull();
  expect(screen.getAllByText('20 USD').length).toBeGreaterThanOrEqual(1);
});
it('has one grid Tab entry and moves between cells with arrow keys',()=>{
  const data=[{region:'N',channel:'A',value:1,__pivot_all_value:3,__pivot_row_value:3,__pivot_col_value:1,__pivot_count:2},{region:'N',channel:'B',value:2,__pivot_all_value:3,__pivot_row_value:3,__pivot_col_value:2,__pivot_count:2}];
  const pivot={...computePivotTable(data,'region','channel','value'),rowKey:'region',colKey:'channel',valKey:'value',aggregation:'sum' as const};
  const view=render(<PivotTableView spec={{id:'keyboard',title:'Keyboard',chartType:'table',xKey:'region',yKeys:['value'],rows:data,pivotTable:pivot}} onCell={vi.fn()}/>);
  const first=view.getByRole('button',{name:'查看明细 N / A'}),second=view.getByRole('button',{name:'查看明细 N / B'});
  first.focus();fireEvent.keyDown(first,{key:'ArrowRight'});expect(second).toHaveFocus();
  expect(view.container.querySelectorAll('table button[tabindex="0"]')).toHaveLength(1);
});

it('renders precision-safe string values in the heatmap without changing displayed values',()=>{
  const data=[{region:'N',channel:'A',value:'0.125'},{region:'S',channel:'A',value:'9.875'}];
  const pivot={...computePivotTable(data,'region','channel','value'),rowKey:'region',colKey:'channel',valKey:'value',aggregation:'sum' as const};
  pivot.matrix=Object.fromEntries(Object.entries(pivot.matrix).map(([row,values])=>[row,Object.fromEntries(Object.entries(values).map(([col,value])=>[col,String(value)]))]));
  const view=render(<PivotTableView spec={{format:{decimals:3},id:'heat',title:'Heat',chartType:'table',xKey:'region',yKeys:['value'],rows:data,pivotTable:pivot}} onCell={vi.fn()}/>);
  fireEvent.click(view.getByRole('button',{name:'热力色阶 关'}));
  const cell=view.getByRole('button',{name:'查看明细 S / A'});
  expect(cell.closest('td')?.style.backgroundColor).not.toBe('');
  expect(cell).toHaveTextContent('9.875');
});
