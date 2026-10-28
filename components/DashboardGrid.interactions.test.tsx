import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardGrid } from './DashboardGrid';
import type { Dashboard } from '../types';

// No substitute grid or layout callbacks: exercise react-grid-layout's mouse path.
// The child supplies only a drag handle; this test makes no claims about query results.
vi.mock('./DashboardWidget',()=>({DashboardWidget:()=> <div className="drag-handle">移动组件</div>}));
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});

it('moves and resizes through real grid gestures and stops editing when locked',()=>{
  vi.stubGlobal('ResizeObserver',class { observe(){} disconnect(){} });
  vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
    const width=parseFloat(this.style.width)||1456,height=parseFloat(this.style.height)||1000;
    return {x:0,y:0,left:0,top:0,right:width,bottom:height,width,height,toJSON(){}};
  });
  vi.spyOn(HTMLElement.prototype,'offsetParent','get').mockImplementation(function(this:HTMLElement){return this.parentElement;});
  vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(1456);
  vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(1000);
  const dashboard={id:'gestures',databaseName:'baseline',name:'布局',createdAt:1,updatedAt:1,layoutLocked:false,
    items:[{i:'usd',savedQueryId:'usd-gmv',x:0,y:0,w:4,h:6}]} as Dashboard;
  const save=vi.fn();
  const props={dashboard,refreshTrigger:0,onLayoutChange:save,onRemoveWidget:vi.fn()};
  const view=render(<DashboardGrid {...props}/>);
  const handle=view.container.querySelector('.drag-handle')!;
  fireEvent.mouseDown(handle,{button:0,clientX:40,clientY:40});
  fireEvent.mouseMove(document,{clientX:290,clientY:108});
  fireEvent.mouseUp(document,{clientX:290,clientY:108});
  expect(save).toHaveBeenCalled();
  // Editing uses vertical compaction: a single item returns to the first row.
  expect(save.mock.lastCall![0][0]).toMatchObject({i:'usd',x:2,y:0,w:4,h:6});
  save.mockClear();
  const resize=view.container.querySelector('.react-resizable-handle-se')!;
  fireEvent.mouseDown(resize,{button:0,clientX:480,clientY:400});
  fireEvent.mouseMove(document,{clientX:730,clientY:536});
  fireEvent.mouseUp(document,{clientX:730,clientY:536});
  expect(save).toHaveBeenCalled();
  expect(save.mock.lastCall![0][0].w).toBeGreaterThan(4);
  expect(save.mock.lastCall![0][0].h).toBeGreaterThan(6);
  view.rerender(<DashboardGrid {...props} dashboard={{...dashboard,layoutLocked:true}}/>);
  expect(view.container.querySelector('.react-resizable-handle-se')).toBeNull();
  expect(dashboard.items[0]).toMatchObject({x:0,y:0,w:4,h:6});
});
