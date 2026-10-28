import React, { lazy, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DeferredTool } from './DeferredTool';
afterEach(cleanup);

it('loads only on first open and preserves a tool form across close and reopen', async () => {
  function Form({open}:{open:boolean}) { const [value,setValue]=useState(''); return open ? <input aria-label="工具草稿" value={value} onChange={event=>setValue(event.target.value)}/> : null; }
  const load=vi.fn(async()=>({default:Form}));
  const Tool=lazy(load);
  const close=vi.fn();
  const view=render(<DeferredTool open={false} onClose={close}><Tool open={false}/></DeferredTool>);
  expect(load).not.toHaveBeenCalled();
  await act(async()=>view.rerender(<DeferredTool open onClose={close}><Tool open/></DeferredTool>));
  fireEvent.change(screen.getByLabelText('工具草稿'),{target:{value:'尚未保存的配置'}});
  view.rerender(<DeferredTool open={false} onClose={close}><Tool open={false}/></DeferredTool>);
  expect(screen.queryByLabelText('工具草稿')).toBeNull();
  view.rerender(<DeferredTool open onClose={close}><Tool open/></DeferredTool>);
  expect(screen.getByLabelText('工具草稿')).toHaveValue('尚未保存的配置');
  expect(load).toHaveBeenCalledOnce();
});

it('allows cancelling the loading state and does not reopen when loading completes', async () => {
  let resolve!:(value:{default:React.FC<{open:boolean}>})=>void;
  const Tool=lazy(()=>new Promise<{default:React.FC<{open:boolean}>}>(done=>{resolve=done;}));
  const close=vi.fn();
  const view=render(<DeferredTool open onClose={close}><Tool open/></DeferredTool>);
  expect(screen.getByRole('status')).toHaveTextContent('正在准备');
  fireEvent.click(screen.getByRole('button',{name:'关闭'}));
  expect(close).toHaveBeenCalledOnce();
  view.rerender(<DeferredTool open={false} onClose={close}><Tool open={false}/></DeferredTool>);
  await act(async()=>resolve({default:({open})=>open?<p>工具内容</p>:null}));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByText('工具内容')).toBeNull();
});
