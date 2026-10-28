import React from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({sql:'',execute:vi.fn()}));
vi.mock('./SqlWorkspacePanel',()=>({SqlWorkspacePanel:(props:any)=><button onClick={()=>props.onExecuteQuery(api.sql)}>执行当前任务</button>}));
vi.mock('./DataExplorerPanel',()=>({DataExplorerPanel:()=>null}));
vi.mock('./InspectorPanel',()=>({InspectorPanel:()=>null}));
vi.mock('./AiAssistantPanel',()=>({AiAssistantPanel:()=>null}));
vi.mock('./WorkbenchStatusBar',()=>({WorkbenchStatusBar:()=>null}));
vi.mock('../../services/workbench/queryExecutionService',()=>({queryExecutionService:{executeQuery:api.execute}}));
import {WorkbenchView} from './WorkbenchView';
import {useAppStore} from '../../hooks/store/useAppStore';
import {useWorkflowStore} from '../../services/dataflow/workflowStore';
import {duckDBService} from '../../services/duckdbService';
const props={tables:['users'],currentTable:null,runtimeInfo:{version:'test',storageMode:'memory' as const,persistent:false,ready:true},onRefreshTables:vi.fn().mockResolvedValue(undefined),onSelectTable:vi.fn(),onOpenFile:vi.fn(),onAttachDatabase:vi.fn(),onAddDataSource:vi.fn()};
beforeEach(()=>{localStorage.clear();api.execute.mockReset();useAppStore.setState({activeDataset:null,currentDatabase:'memory',currentTable:null,pendingSql:'',pendingNewQuery:false});vi.spyOn(duckDBService,'getRuntimeInfo').mockReturnValue({currentDatabase:'memory',databaseContextRevision:1} as any);vi.spyOn(duckDBService,'getCurrentCatalogAndSchema').mockResolvedValue({catalog:'memory',schema:'main'});vi.spyOn(useWorkflowStore.getState(),'syncExecutionResult').mockImplementation(()=>{});});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
async function run(sql:string){api.sql=sql;useWorkflowStore.setState({activeSql:sql});fireEvent.click(screen.getByRole('button',{name:'执行当前任务'}));await waitFor(()=>expect(api.execute).toHaveBeenCalled());}
it('publishes the executed query to the same dataset context consumed by the graph',async()=>{
  api.execute.mockResolvedValue({snapshot:{columns:['uid'],columnTypes:['BIGINT'],rows:[{uid:1}],executionTime:1},task:{status:'success'}});
  render(<WorkbenchView {...props}/>);
  await run("SELECT uid FROM memory.main.users WHERE country_code='US'");
  await waitFor(()=>expect(useAppStore.getState().activeDataset?.error).toBeUndefined());
  expect(useAppStore.getState().activeDataset).toMatchObject({catalog:'memory',schema:'main',sql:api.sql,fields:[{name:'uid',type:'BIGINT'}]});
});
it.each(['failed','cancelled'])('replaces the current dataset with an explicit error when a read query is %s',async status=>{
  api.execute.mockResolvedValue({task:{status,error:'missing field'}});
  render(<WorkbenchView {...props}/>);
  await run('SELECT missing_field FROM memory.main.users');
  await waitFor(()=>expect(useAppStore.getState().activeDataset?.error).toContain(status==='failed'?'missing field':'取消'));
  expect(useAppStore.getState().activeDataset?.sql).toBe(api.sql);
  expect(useAppStore.getState().activeDataset?.fields).toEqual([]);
});
