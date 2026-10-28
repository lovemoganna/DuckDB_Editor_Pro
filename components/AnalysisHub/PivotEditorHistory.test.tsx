// @vitest-environment jsdom
import React from 'react';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({run:vi.fn(),validate:vi.fn(),read:vi.fn()}));
vi.mock('../../services/duckdbService',()=>({duckDBService:{readQuery:(...args:unknown[])=>api.read(...args),getCurrentCatalogAndSchema:async()=>({catalog:'memory',schema:'main'})}}));
vi.mock('../../services/analysis/pipeline',()=>({runAnalysis:(...args:unknown[])=>api.run(...args)}));
vi.mock('../../services/analysis/pivotExperience',async()=>({...await vi.importActual('../../services/analysis/pivotExperience'),validatePivotSource:(...args:unknown[])=>api.validate(...args)}));
vi.mock('../../hooks/useCurrentAnalysisDataset',()=>({useCurrentAnalysisDataset:()=>({pending:false,source:'query'})}));
vi.mock('../../services/homeDashboardService',()=>({getOrCreateHomeDashboard:vi.fn(),addObjectToDashboard:vi.fn()}));
vi.mock('../../services/toastService',()=>({toastService:{success:vi.fn(),error:vi.fn()}}));
vi.mock('../../services/workbench/runtime',()=>({useWorkbenchRevision:()=>0}));
vi.mock('./AnalysisChartRenderer',()=>({AnalysisChartRenderer:()=><div>chart</div>}));
import {PivotEditor} from './PivotEditor';
import {defaultPivot,pivotDrafts} from '../../services/analysis/pivotExperience';
import {useAppStore} from '../../hooks/store/useAppStore';
const source={id:'query:orders',name:'Orders',catalog:'memory',schema:'main',kind:'query' as const,version:1,sql:'SELECT * FROM orders',fields:[{name:'region',type:'VARCHAR'},{name:'month',type:'VARCHAR'},{name:'amount',type:'DOUBLE'}]};
const result=(spec:any)=>({spec,sql:'SELECT 1',columns:['region','记录数'],rows:[{region:'North','记录数':2}],chartConfig:{type:'pivot'},executionTimeMs:2,
  chart:{id:'pivot',chartType:'table',title:'Orders',xKey:'region',yKeys:['记录数'],rows:[{region:'North','记录数':2}],pivotTable:{rowKey:'region',colKey:'',valKey:'记录数',rowValues:['North'],colValues:['汇总'],matrix:{North:{汇总:2}},rowTotals:{North:2},colTotals:{汇总:2},grandTotal:2,grandCount:2,aggregation:'sum'}}});
beforeEach(()=>{vi.clearAllMocks();pivotDrafts.clear();Object.defineProperty(window,'innerWidth',{value:1366,configurable:true});useAppStore.setState({currentDatabase:'memory',dashboardRefreshTrigger:0});api.validate.mockResolvedValue(source);api.run.mockImplementation(async spec=>result(spec));api.read.mockResolvedValue([]);});
afterEach(cleanup);
describe('pivot configuration history',()=>{
  it('undoes and redoes a destructive row/column swap via buttons',async()=>{
    render(<PivotEditor initial={{...defaultPivot(source),column:{column:'month'}}}/>);
    const undo=screen.getByRole('button',{name:'撤销配置修改'}),redo=screen.getByRole('button',{name:'重做配置修改'});
    expect(undo).toBeDisabled();expect(redo).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'交换行列'}));
    expect(screen.getByLabelText('行')).toHaveValue('month');
    fireEvent.click(undo);
    expect(screen.getByLabelText('行')).toHaveValue('region');expect(screen.getByLabelText('列')).toHaveValue('month');
    expect(redo).toBeEnabled();
    fireEvent.click(redo);
    expect(screen.getByLabelText('行')).toHaveValue('month');
  });
  it('supports Ctrl+Z / Ctrl+Shift+Z outside text fields and leaves text inputs to the browser',async()=>{
    render(<PivotEditor initial={defaultPivot(source)}/>);
    const row=screen.getByLabelText('行');
    fireEvent.change(row,{target:{value:'month'}});
    fireEvent.keyDown(screen.getByLabelText('分析名称'),{key:'z',ctrlKey:true});
    expect(row).toHaveValue('month');
    fireEvent.keyDown(row,{key:'z',ctrlKey:true});
    expect(screen.getByLabelText('行')).toHaveValue('region');
    fireEvent.keyDown(row,{key:'z',ctrlKey:true,shiftKey:true});
    expect(screen.getByLabelText('行')).toHaveValue('month');
  });
  it('appends fields from the catalog to rows, moves them to columns, and keeps extra row dimensions on swap',async()=>{
    render(<PivotEditor initial={defaultPivot(source)}/>);
    const directory=screen.getByText(/字段目录/).closest('details')!;
    expect(directory).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText(/字段目录/));
    fireEvent.change(screen.getByLabelText('添加字段 month'),{target:{value:'row'}});
    expect(screen.getByLabelText('行维度 2')).toHaveValue('month');expect(screen.getByLabelText('行')).toHaveValue('region');
    fireEvent.change(screen.getByLabelText('添加字段 amount'),{target:{value:'column'}});
    expect(screen.getByLabelText('列')).toHaveValue('amount');
    fireEvent.click(screen.getByRole('button',{name:'交换行列'}));
    expect(screen.getByLabelText('行')).toHaveValue('amount');expect(screen.getByLabelText('行维度 2')).toHaveValue('month');expect(screen.getByLabelText('列')).toHaveValue('region');
    fireEvent.click(screen.getByRole('button',{name:'撤销配置修改'}));
    expect(screen.getByLabelText('行')).toHaveValue('region');expect(screen.getByLabelText('行维度 2')).toHaveValue('month');
  });
  it('disables adding a row dimension when no field is left',async()=>{
    render(<PivotEditor initial={{...defaultPivot(source),rows:[{column:'region'},{column:'month'}],row:{column:'region'},column:{column:'amount'}}}/>);
    expect(screen.getByRole('button',{name:/添加行维度/})).toBeDisabled();
  });
  it('lets the user empty 行 and 值 and keeps a usable configuration',async()=>{
    render(<PivotEditor initial={defaultPivot(source)}/>);
    fireEvent.click(screen.getByRole('button',{name:'移除行维度 1'}));
    expect(screen.getByLabelText('行')).toHaveValue('');
    expect(screen.getByText(/所有记录合并为「全部」一行/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'移除值 1'}));
    expect(screen.getByText(/未选择值时，按「记录数」统计/)).toBeTruthy();
    await waitFor(()=>expect(api.run).toHaveBeenCalled());
    const spec=api.run.mock.calls.at(-1)![0];
    expect(spec.dimensions[0].column).toBe('汇总范围');
    expect(spec.metrics[0].alias).toBe('记录数');
    fireEvent.click(screen.getByRole('button',{name:'撤销配置修改'}));
    expect(screen.queryByText(/未选择值时/)).toBeNull();
  });
  it('merges rapid typing into one undo step and clears redo after a new edit',async()=>{
    render(<PivotEditor initial={defaultPivot(source)}/>);
    const title=screen.getByLabelText('分析名称');
    fireEvent.change(title,{target:{value:'A'}});fireEvent.change(title,{target:{value:'AB'}});
    fireEvent.click(screen.getByRole('button',{name:'撤销配置修改'}));
    expect(title).toHaveValue('Orders · 透视表');
    expect(screen.getByRole('button',{name:'撤销配置修改'})).toBeDisabled();
    fireEvent.change(screen.getByLabelText('行'),{target:{value:'month'}});
    expect(screen.getByRole('button',{name:'重做配置修改'})).toBeDisabled();
    await waitFor(()=>expect(api.run).toHaveBeenCalled());
  });
});
