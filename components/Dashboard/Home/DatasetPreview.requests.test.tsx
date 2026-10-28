// @vitest-environment jsdom
import React from 'react';
import { beforeAll, beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent, waitFor } from '@testing-library/react';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { DatasetPreview } from './DatasetPreview';
import type { DatasetDefinition } from '../../../services/workbench/analysisTypes';
const transport=vi.hoisted(()=>({read:vi.fn(),guard:vi.fn()}));
vi.mock('../../../services/duckdbService',()=>({duckDBService:{readQueryBatchWithParams:transport.read,readQueryWithParams:transport.guard}}));
// Controlled timing/failure only; successful rows are read from the same real funds baseline.
let data:Record<string,unknown>[]=[];
const dataset:DatasetDefinition={id:'fiat',name:'fiat_transactions',kind:'table',catalog:'baseline',schema:'main',table:'fiat_transactions',version:1,sql:'SELECT * FROM baseline.main.fiat_transactions',fields:[{name:'fiat_order_id',type:'VARCHAR'}]};
const props={dataset,datasets:[dataset],revision:0};
beforeAll(()=>{
  const r=spawnSync('duckdb',[resolve('data/crud-lab/baseline.duckdb'),'-readonly','-bail','-json'],{input:'SELECT fiat_order_id FROM fiat_transactions ORDER BY ALL',encoding:'utf8'});
  if(r.status!==0)throw new Error(r.stderr||'real baseline unavailable');
  data=JSON.parse(r.stdout);expect(data).toHaveLength(25);
});
beforeEach(()=>{transport.guard.mockReset().mockResolvedValue([]);transport.read.mockReset();transport.read.mockResolvedValue([[{count:data.length}],data]);});
afterEach(cleanup);
it('rechecks saved join-key constraints before previewing and recovers after retry',async()=>{
  transport.guard.mockResolvedValueOnce([{fiat_order_id:'duplicate'}]);
  const guarded={...dataset,uniqueKeys:[{sql:dataset.sql,key:'fiat_order_id'}]};
  render(<DatasetPreview {...props} dataset={guarded} datasets={[guarded]}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('右侧关联键不唯一');
  expect(transport.read).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'重试'}));
  await screen.findByText(String(data[0].fiat_order_id));
  expect(transport.guard).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).toBeNull();
});
it('returns to a valid page when refreshed data shrinks below the current offset',async()=>{
  transport.read.mockResolvedValue([[{count:75}],data]);
  const view=render(<DatasetPreview {...props}/>);
  fireEvent.click(await screen.findByRole('button',{name:'下一页'}));
  await screen.findByText('2 / 2');
  transport.read.mockResolvedValue([[{count:25}],data]);
  view.rerender(<DatasetPreview {...props} revision={1}/>);
  await waitFor(()=>expect(transport.read.mock.calls.at(-1)?.[0][1].sql).toContain('OFFSET 0'));
  expect(screen.queryByText('2 / 2')).toBeNull();
});
it('keeps the last successful detail during refresh and explicitly labels a failed refresh',async()=>{
  const view=render(<DatasetPreview {...props}/>);
  await screen.findByText(String(data[0].fiat_order_id));
  let reject!:(error:Error)=>void;
  transport.read.mockReturnValueOnce(new Promise((_resolve,r)=>{reject=r;}));
  view.rerender(<DatasetPreview {...props} revision={1}/>);
  expect(screen.getByText(String(data[0].fiat_order_id))).toBeTruthy();
  expect(screen.getByRole('status')).toBeTruthy();
  await act(async()=>reject(new Error('temporary read failure')));
  expect(screen.getByRole('alert').textContent).toContain('上次成功结果');
  expect(screen.getByText(String(data[0].fiat_order_id))).toBeTruthy();
});
it('does not label old rows as the result of a changed filter after failure',async()=>{
  const view=render(<DatasetPreview {...props}/>);
  await screen.findByText(String(data[0].fiat_order_id));
  transport.read.mockRejectedValueOnce(new Error('filter read failed'));
  view.rerender(<DatasetPreview {...props} context={{refreshSeconds:0,filters:[{id:'id',field:'fiat_order_id',operator:'eq',value:'missing',bindings:{fiat:'fiat_order_id'}}]}}/>);
  await screen.findByRole('alert');
  expect(screen.queryByText(String(data[0].fiat_order_id))).toBeNull();
  expect(screen.queryByText('25 行')).toBeNull();
});
it('ignores an older successful request after the current refresh fails',async()=>{
  let resolveOld!:(rows:unknown)=>void;
  transport.read.mockReturnValueOnce(new Promise(r=>{resolveOld=r;}));
  const view=render(<DatasetPreview {...props}/>);
  transport.read.mockRejectedValueOnce(new Error('latest read failed'));
  view.rerender(<DatasetPreview {...props} revision={1}/>);
  await screen.findByRole('alert');
  await act(async()=>resolveOld([[{count:25}],data]));
  expect(screen.getByRole('alert').textContent).toContain('latest read failed');
  expect(screen.queryByText(String(data[0].fiat_order_id))).toBeNull();
});
