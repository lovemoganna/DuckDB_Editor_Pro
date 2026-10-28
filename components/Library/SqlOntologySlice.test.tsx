import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api=vi.hoisted(()=>({execute:vi.fn(),discover:vi.fn(),suggest:vi.fn(),validate:vi.fn(),catalog:'real'}));
vi.mock('../../services/duckdbService',()=>({duckDBService:{getRuntimeInfo:()=>({currentDatabase:api.catalog})}}));
vi.mock('../../services/ontology/sqlGraphProjection',async(importOriginal)=>({...await importOriginal<any>(),discoverSliceTables:api.discover,executeSqlSlice:api.execute,suggestSliceIdentity:api.suggest,validateSliceIdentity:api.validate,listSliceValues:vi.fn().mockResolvedValue(['first'])}));
import { SqlOntologySlice } from './SqlOntologySlice';
const publish=vi.fn();
const current=()=>publish.mock.calls.at(-1)?.[0];
const table={catalog:'real',schema:'main',name:'payments',columns:['id'],primaryKey:['id']};
const result=(label:string)=>({catalog:'real',rows:[{id:label}],sql:'SELECT',skipped:0,graph:{nodes:[{id:label,label,group:'instance',color:'#888',size:13,description:'',_rowIndices:[0],_trace:{table:'payments',key:{id:label}}}],links:[],typeMap:{},linkTypeMap:{},typeNames:['Payment']}});
async function mount(){render(<SqlOntologySlice onClose={()=>{}} onProjectionChange={publish}/>);await act(async()=>{});await act(async()=>{fireEvent.change(screen.getByLabelText('切片来源表'),{target:{value:'main.payments'}});});await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'查看图谱'}));});}
function manual(){fireEvent.click(screen.getByRole('button',{name:'切换为手动查询'}));}
async function tick(){await act(async()=>{await vi.advanceTimersByTimeAsync(451);});}
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();api.catalog='real';api.discover.mockResolvedValue([table]);api.execute.mockResolvedValue(result('first'));api.suggest.mockResolvedValue('id');api.validate.mockResolvedValue(undefined);});
afterEach(()=>{cleanup();vi.useRealTimers();});
const dataset=(name='payments',sql='SELECT * FROM payments WHERE status=\'completed\'')=>({id:`table:${name}`,name,catalog:'real',schema:'main',table:name,kind:'table' as const,version:1,sql,fields:[{name:'id',type:'INTEGER'}]});
it('automatically projects the shared filtered dataset and replaces it on a cross-module source switch',async()=>{
  const view=render(<SqlOntologySlice dataset={dataset()} onClose={()=>{}} onProjectionChange={publish}/>);
  await act(async()=>{});await tick();
  expect(api.execute.mock.calls.at(-1)?.[0]).toContain("WHERE status='completed'");
  expect(current().result.graph.nodes[0].label).toBe('first');
  expect(screen.queryByLabelText('切片来源表')).toBeNull();
  view.rerender(<SqlOntologySlice dataset={dataset('users','SELECT * FROM users')} onClose={()=>{}} onProjectionChange={publish}/>);
  expect(current().result).toBeNull();
  api.execute.mockResolvedValue(result('user'));await act(async()=>{});await tick();
  expect(api.execute.mock.calls.at(-1)?.[0]).toContain('SELECT * FROM users');
  expect(api.execute.mock.calls.at(-1)?.[0]).not.toContain('payments');
  expect(current().result.graph.nodes[0].label).toBe('user');
});
it('clears an existing projection when the shared dataset fails instead of falling back to an unfiltered table',async()=>{
  const view=render(<SqlOntologySlice dataset={dataset()} onClose={()=>{}} onProjectionChange={publish}/>);
  await act(async()=>{});await tick();
  api.execute.mockClear();
  view.rerender(<SqlOntologySlice datasetError="数据集筛选字段不存在" onClose={()=>{}} onProjectionChange={publish}/>);
  await act(async()=>{});await tick();
  expect(current().result).toBeNull();expect(api.execute).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('数据集筛选字段不存在');
});
it('recalculates on dataset refresh without losing the current additional conditions',async()=>{
  const view=render(<SqlOntologySlice dataset={dataset()} onClose={()=>{}} onProjectionChange={publish}/>);
  await act(async()=>{});await tick();
  fireEvent.click(screen.getByRole('button',{name:'添加筛选'}));
  fireEvent.change(screen.getByLabelText('筛选字段 1'),{target:{value:'id'}});
  fireEvent.change(screen.getByLabelText('筛选值 1'),{target:{value:'specific'}});await tick();
  view.rerender(<SqlOntologySlice dataset={{...dataset()}} datasetPending onClose={()=>{}} onProjectionChange={publish}/>);
  expect(current().result).toBeNull();expect(current().busy).toBe(true);
  view.rerender(<SqlOntologySlice dataset={{...dataset()}} onClose={()=>{}} onProjectionChange={publish}/>);
  await tick();expect(api.execute.mock.calls.at(-1)?.[0]).toContain('specific');expect(screen.getByLabelText('筛选值 1')).toHaveValue('specific');
});
it('projects current rows, exposes source trace, and clears old nodes immediately on a condition edit',async()=>{
  await mount();await tick();expect(current().result.graph.nodes[0].label).toBe('first');expect(document.querySelector('svg[aria-label="SQL 切片图谱"]')).toBeNull();expect(screen.queryByRole('dialog')).toBeNull();
  manual();
  fireEvent.change(screen.getByLabelText('切片 SQL'),{target:{value:'SELECT id FROM payments WHERE false'}});
  expect(current().result).toBeNull();
  api.execute.mockResolvedValue({...result(''),rows:[],graph:{...result('').graph,nodes:[]}});
  await tick();expect(screen.getByText('当前查询没有匹配记录，图谱为空。')).toBeInTheDocument();
});
it('discards a late response after query edits and keeps error results empty',async()=>{
  let complete:(value:any)=>void=()=>{};api.execute.mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
  await mount();await tick();
  manual();
  fireEvent.change(screen.getByLabelText('切片 SQL'),{target:{value:'SELECT missing FROM payments'}});
  api.execute.mockRejectedValue(new Error('missing column'));await tick();
  await act(async()=>{complete(result('stale'));});
  expect(screen.getByRole('alert')).toHaveTextContent('missing column');expect(current().result).toBeNull();
});
it('runs without SQL editing and updates visual filters while preserving manual queries',async()=>{
  await mount();await tick();expect(api.validate).toHaveBeenCalledWith(table,'id');
  fireEvent.click(screen.getByRole('button',{name:'添加筛选'}));
  expect(current().result).toBeNull();
  fireEvent.change(screen.getByLabelText('筛选字段 1'),{target:{value:'id'}});
  fireEvent.change(screen.getByLabelText('筛选值 1'),{target:{value:"O'Brien"}});await tick();
  expect(api.execute.mock.calls.at(-1)?.[0]).toContain("'O''Brien'");
  manual();fireEvent.change(screen.getByLabelText('切片 SQL'),{target:{value:'SELECT manual'}});await tick();
  expect(screen.getByLabelText('切片来源表')).toBeDisabled();expect(screen.getByLabelText('切片 SQL')).toHaveValue('SELECT manual');
});
it('blocks invalid identities before publishing a graph',async()=>{
  api.validate.mockRejectedValue(new Error('存在重复或空值'));
  await mount();await tick();expect(api.execute).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('存在重复或空值');
});
it('clears SQL and projection on database switch and recalculates on actual data-change notifications',async()=>{
  await mount();await tick();
  api.execute.mockResolvedValue(result('updated'));
  act(()=>{window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));});expect(current().result).toBeNull();
  await tick();expect(current().result.graph.nodes[0].label).toBe('updated');
  act(()=>{api.catalog='other';window.dispatchEvent(new CustomEvent('duckdb-database-changed'));});
  await act(async()=>{});expect(screen.getByLabelText('切片 SQL')).toHaveValue('');expect(current().result).toBeNull();
  expect(screen.getByText(/当前数据库：other/)).toBeInTheDocument();
});
