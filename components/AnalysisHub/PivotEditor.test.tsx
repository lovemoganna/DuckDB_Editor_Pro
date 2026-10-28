// @vitest-environment jsdom
import React from 'react';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({run:vi.fn(),save:vi.fn(),validate:vi.fn(),load:vi.fn(),inherited:vi.fn(),home:vi.fn(),read:vi.fn()}));
vi.mock('../../services/duckdbService',()=>({duckDBService:{readQuery:(...args:unknown[])=>api.read(...args),getCurrentCatalogAndSchema:async()=>({catalog:'memory',schema:'main'})}}));
vi.mock('../../services/analysis/pipeline',()=>({runAnalysis:(...args:unknown[])=>api.run(...args)}));
vi.mock('../../services/analysis/pivotExperience',async()=>({...await vi.importActual('../../services/analysis/pivotExperience'),validatePivotSource:(...args:unknown[])=>api.validate(...args),savePivotRecord:(...args:unknown[])=>api.save(...args),loadPivotRecord:(...args:unknown[])=>api.load(...args)}));
vi.mock('../../hooks/useCurrentAnalysisDataset',()=>({useCurrentAnalysisDataset:()=>api.inherited()}));
vi.mock('../../services/homeDashboardService',()=>({getOrCreateHomeDashboard:(...args:unknown[])=>api.home(...args),addObjectToDashboard:vi.fn()}));
vi.mock('../../services/toastService',()=>({toastService:{success:vi.fn(),error:vi.fn()}}));
vi.mock('../../services/workbench/runtime',()=>({useWorkbenchRevision:()=>0}));
vi.mock('./AnalysisChartRenderer',()=>({AnalysisChartRenderer:()=> <div>图表结果</div>}));
import {PivotEditor,PivotExperienceEntry} from './PivotEditor';
import {useAnalysisWorkspace} from '../../hooks/store/useAnalysisWorkspace';
import {defaultPivot,pivotDrafts} from '../../services/analysis/pivotExperience';
import {useAppStore} from '../../hooks/store/useAppStore';
const source={id:'query:orders',name:'Orders',catalog:'memory',schema:'main',kind:'query' as const,version:1,sql:'SELECT * FROM orders',fields:[{name:'region',type:'VARCHAR'},{name:'month',type:'VARCHAR'},{name:'amount',type:'DOUBLE'}]};
function result(spec:any){return {spec,sql:'SELECT 1',columns:['region','记录数'],rows:[{region:'North','记录数':2}],chartConfig:{type:'pivot'},executionTimeMs:2,
  chart:{id:'pivot',chartType:'table',title:'Orders',xKey:'region',yKeys:['记录数'],rows:[{region:'North','记录数':2}],pivotTable:{rowKey:'region',colKey:'',valKey:'记录数',rowValues:['North'],colValues:['汇总'],matrix:{North:{汇总:2}},rowTotals:{North:2},colTotals:{汇总:2},grandTotal:2,grandCount:2,aggregation:'sum'}}};}
beforeEach(()=>{vi.clearAllMocks();pivotDrafts.clear();Object.defineProperty(window,'innerWidth',{value:1366,configurable:true});useAppStore.setState({currentDatabase:'memory',dashboardRefreshTrigger:0});api.inherited.mockReturnValue({pending:false,dataset:source,source:'query'});api.validate.mockResolvedValue(source);api.run.mockImplementation(async spec=>result(spec));api.home.mockResolvedValue({databaseName:'memory',items:[]});api.save.mockResolvedValue({id:'analysis:1'});});
afterEach(cleanup);
describe('pivot editor continuity',()=>{
  it('searches the restored asset instead of losing it outside the first candidate page',async()=>{
    const unitSource={...source,fields:[...source.fields,{name:'asset',type:'VARCHAR'}]};
    api.validate.mockResolvedValue(unitSource);api.read.mockResolvedValue([{unit:'asset-249'}]);
    render(<PivotEditor initial={{...defaultPivot(unitSource),unit:'asset-249'}}/>);
    await waitFor(()=>expect(api.read).toHaveBeenCalledWith(expect.stringContaining("'%asset-249%'")));
    expect(screen.getByLabelText('分析计量资产')).toHaveValue('asset-249');
  });
  it('retries only publishing after the analysis has already saved',async()=>{
    api.save.mockResolvedValue({id:'analysis:1',databaseName:'memory',schemaName:'main',title:'Saved',savedAt:1});
    api.home.mockRejectedValueOnce(new Error('Board unavailable'));
    render(<PivotEditor initial={defaultPivot(source)}/>);
    await waitFor(()=>expect(screen.getByRole('button',{name:'保存分析'})).toBeEnabled());
    fireEvent.click(screen.getByRole('button',{name:'保存并加入首页'}));
    await screen.findByText(/分析已保存，加入首页失败/);
    fireEvent.click(screen.getByRole('button',{name:'重试加入首页'}));
    await waitFor(()=>expect(screen.queryByText(/分析已保存，加入首页失败/)).toBeNull());
    expect(api.save).toHaveBeenCalledTimes(1);expect(api.home).toHaveBeenCalledTimes(2);
  });
  it('batches query changes until Apply in manual mode',async()=>{
    render(<PivotEditor initial={defaultPivot(source)}/>);
    await waitFor(()=>expect(screen.getByRole('button',{name:'保存分析'})).toBeEnabled());
    fireEvent.click(screen.getByLabelText('修改后手动应用'));
    fireEvent.change(screen.getByLabelText('行'),{target:{value:'month'}});
    fireEvent.change(screen.getByLabelText('列'),{target:{value:'region'}});
    expect(screen.getByRole('button',{name:'保存分析'})).toBeDisabled();expect(api.run).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button',{name:'应用配置'}));
    await waitFor(()=>expect(api.run).toHaveBeenCalledTimes(2));
    await waitFor(()=>expect(screen.getByRole('button',{name:'保存分析'})).toBeEnabled());
  });
  it('preserves grid search while renaming and switching views without querying',async()=>{
    render(<PivotEditor initial={defaultPivot(source)}/>);
    await waitFor(()=>expect(screen.getByRole('button',{name:'保存分析'})).toBeEnabled());
    fireEvent.change(screen.getByLabelText('筛选透视维度'),{target:{value:'North'}});
    fireEvent.change(screen.getByLabelText('分析名称'),{target:{value:'New title'}});
    fireEvent.click(screen.getByRole('button',{name:'图表',exact:true}));
    fireEvent.click(screen.getByRole('button',{name:'透视表',exact:true}));
    expect(screen.getByLabelText('筛选透视维度')).toHaveValue('North');
    expect(api.run).toHaveBeenCalledTimes(1);
  });
  it('retries the saved-source loader after a transient failure',async()=>{
    useAnalysisWorkspace.setState({pivotRequest:{key:'retry',analysisId:'a'}});
    api.load.mockRejectedValueOnce(new Error('Transient source failure')).mockResolvedValue({id:'a',savedAt:1,pivot:defaultPivot(source)});
    render(<PivotExperienceEntry currentTable="" schema={[]}/>);
    await screen.findByText('Transient source failure');fireEvent.click(screen.getByRole('button',{name:'重试'}));
    await screen.findByTestId('pivot-editor');expect(api.load).toHaveBeenCalledTimes(2);
  });
  it('prevents saving pending configuration and an older request cannot publish into newer edits',async()=>{
    const pending:{spec:any;resolve:(value:any)=>void}[]=[];
    api.run.mockImplementation(spec=>new Promise(resolve=>pending.push({spec,resolve})));
    render(<PivotEditor initial={defaultPivot(source)}/>);
    await waitFor(()=>expect(pending).toHaveLength(1));
    expect(screen.getByRole('button',{name:'保存分析'})).toBeDisabled();
    fireEvent.change(screen.getByLabelText('分析名称'),{target:{value:'Latest'}});
    fireEvent.change(screen.getByLabelText('行'),{target:{value:'month'}});
    await waitFor(()=>expect(pending).toHaveLength(2));
    pending[0].resolve(result(pending[0].spec));
    expect(screen.getByRole('button',{name:'保存分析'})).toBeDisabled();
    pending[1].resolve(result(pending[1].spec));
    await waitFor(()=>expect(screen.getByRole('button',{name:'保存分析'})).toBeEnabled());
    fireEvent.click(screen.getByRole('button',{name:'保存分析'}));
    await waitFor(()=>expect(api.save.mock.calls[0][0].title).toBe('Latest'));
  });
  it('swaps both dimension definitions without dropping date grain, filters or measures',async()=>{
    const initial={...defaultPivot(source),column:{column:'month'},filters:[{column:'amount',op:'>' as const,value:'10'}]};
    render(<PivotEditor initial={initial}/>);
    fireEvent.click(screen.getByRole('button',{name:'交换行列'}));
    expect(screen.getByLabelText('行')).toHaveValue('month');expect(screen.getByLabelText('列')).toHaveValue('region');
    expect(screen.getByLabelText('筛选 1 值')).toHaveValue('10');
    expect(screen.getByLabelText('值 1 名称')).toHaveValue('记录数');
  });
  it('restores session edits after a subview unmount',()=>{
    const initial=defaultPivot(source);
    const view=render(<PivotEditor initial={initial}/>);
    fireEvent.change(screen.getByLabelText('分析名称'),{target:{value:'Unsaved observation'}});
    view.unmount();render(<PivotEditor initial={initial}/>);
    expect(screen.getByLabelText('分析名称')).toHaveValue('Unsaved observation');
  });
  it('loads a newer saved definition rather than an old cached definition with the same identity',()=>{
    const initial=defaultPivot(source);
    const view=render(<PivotEditor initial={initial} initialId="a"/>);view.unmount();
    render(<PivotEditor initial={{...initial,title:'Updated elsewhere'}} initialId="a"/>);
    expect(screen.getByLabelText('分析名称')).toHaveValue('Updated elsewhere');
  });
  it('leaves settings editable after failure and retry uses the retained configuration',async()=>{
    api.run.mockRejectedValueOnce(new Error('Source unavailable'));
    render(<PivotEditor initial={defaultPivot(source)}/>);
    await screen.findByText('Source unavailable');
    expect(screen.getByRole('button',{name:'保存分析'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'重试'}));
    expect(screen.getByLabelText('行')).toHaveValue('region');
  });
  it('opens extract metric modal when clicking extract metric button', async () => {
    render(<PivotEditor initial={defaultPivot(source)} />);
    await waitFor(() => expect(screen.getByRole('button', { name: '提取为指标' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '提取为指标' }));
    await screen.findByText('从透视表提炼并沉淀业务指标');
    expect(screen.getByLabelText('指标名称')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '沉淀到指标库' })).toBeInTheDocument();
  });
});


it('changes null placeholders without recalculating the source query',async()=>{
  render(<PivotEditor initial={defaultPivot(source)}/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'保存分析'})).toBeEnabled());
  const count=api.run.mock.calls.length;
  fireEvent.change(screen.getByLabelText('空单元格显示'),{target:{value:'zero'}});
  await waitFor(()=>expect(screen.getByLabelText('空单元格显示')).toHaveValue('zero'));
  expect(api.run).toHaveBeenCalledTimes(count);
  expect(screen.getByRole('button',{name:'保存分析'})).toBeEnabled();
});
