// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QuickTablePeekDrawer } from './QuickTablePeekDrawer';
const mocks=vi.hoisted(()=>({query:vi.fn(),schema:vi.fn(),success:vi.fn(),error:vi.fn()}));
vi.mock('../../services/duckdbService',()=>({duckDBService:{query:mocks.query,getTableSchema:mocks.schema}}));
vi.mock('../../services/toastService',()=>({toastService:{success:mocks.success,error:mocks.error}}));
const props={tableName:'quoted"table',onClose:vi.fn(),onNavigateToData:vi.fn(),onNavigateToSql:vi.fn()};
beforeEach(()=>{vi.clearAllMocks();mocks.schema.mockResolvedValue([{name:'quoted"column',type:'INTEGER'}]);mocks.query.mockImplementation(async(sql:string)=>sql.startsWith('SUMMARIZE')?[{column_name:'quoted"column',null_percentage:10}]:sql.includes('COUNT')?[{total:1}]:[{'quoted"column':1}]);});
afterEach(cleanup);
it('escapes identifiers for samples and null drill-down SQL',async()=>{
  render(<QuickTablePeekDrawer {...props}/>);
  await screen.findByText('在 SQL 编辑器中深入分析 →');
  expect(mocks.query).toHaveBeenCalledWith('SELECT * FROM "quoted""table" LIMIT 10;');
  fireEvent.click(screen.getByRole('button',{name:'SUMMARIZE 统计画像'}));
  fireEvent.click(screen.getByRole('button',{name:'SQL ↗'}));
  expect(props.onNavigateToSql).toHaveBeenCalledWith('SELECT * FROM "quoted""table" WHERE "quoted""column" IS NULL LIMIT 50;');
});
it('reports a failed sample as an error and retries without claiming the table is empty',async()=>{
  mocks.schema.mockRejectedValueOnce(new Error('schema unavailable'));
  render(<QuickTablePeekDrawer {...props}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('schema unavailable');
  expect(screen.queryByText('表中暂无任何数据记录')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'重试读取速览'}));
  await screen.findByText('在 SQL 编辑器中深入分析 →');
  expect(screen.queryByRole('alert')).toBeNull();
});
it('reports clipboard rejection without reporting success',async()=>{
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockRejectedValue(new Error('clipboard denied'))}});
  render(<QuickTablePeekDrawer {...props}/>);
  fireEvent.click(screen.getByRole('button',{name:'复制表名'}));
  await waitFor(()=>expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('clipboard denied')));
  expect(mocks.success).not.toHaveBeenCalled();
});
