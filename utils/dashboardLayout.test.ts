import { expect, it } from 'vitest';
import { chartContent, widgetSpace, viewportBoardLayout } from './dashboardLayout';

it('projects saved geometry deterministically and stacks narrow screens without overwriting it', () => {
  const items = [{i:'kpi',x:0,y:0,w:2,h:3},{i:'chart',x:2,y:0,w:10,h:6}];
  const before = JSON.stringify(items);
  expect(viewportBoardLayout(items,1200).items[0]).toMatchObject({column:1,span:2,row:1,rowSpan:3,height:196});
  for (const width of [390,768]) {
    const layout = viewportBoardLayout(items,width);
    expect(layout.columns).toBe(1);
    expect(layout.items.map(item=>item.row)).toEqual([1,2]);
    expect(layout.items.map(item=>item.height)).toEqual([196,400]);
  }
  expect(JSON.stringify(items)).toBe(before);
});

it('gives values and short tables less space than a statistical chart', () => {
  expect(widgetSpace(chartContent('counter', 1, 1), 600).height).toBeLessThan(220);
  expect(widgetSpace(chartContent('table', 3), 600).height).toBeLessThan(300);
  expect(widgetSpace(chartContent('line', 100), 600).height).toBeGreaterThanOrEqual(320);
  expect(widgetSpace(chartContent('kpi', 1, 6), 250).height).toBeGreaterThan(400);
});
it('preserves reading order and leaves saved coordinates intact at every requested width', () => {
  const items = [{i:'c',x:0,y:3,w:12,h:6},{i:'a',x:0,y:0,w:3,h:3},{i:'b',x:3,y:0,w:3,h:3}];
  const before = JSON.stringify(items);
  for (const width of [1440,1280,1024,768,390]) {
    const layout = viewportBoardLayout(items,width);
    expect(layout.items.map(item=>item.i)).toEqual(['a','b','c']);
    expect(layout.items.every(item=>item.column + item.span - 1 <= layout.columns)).toBe(true);
    expect(layout.items[0].height).toBeLessThan(layout.items[2].height);
  }
  expect(JSON.stringify(items)).toBe(before);
});

it('preserves desktop columns for paired charts', () => {
  const items = [{i:'a',x:0,y:0,w:6,h:5},{i:'b',x:6,y:0,w:6,h:5}];
  const layout = viewportBoardLayout(items,1400);
  expect(layout.items[0].span + layout.items[1].span).toBe(layout.columns);
  expect(layout.items[0].row).toBe(layout.items[1].row);
});

it('safely stacks explicitly restored overlapping coordinates without changing storage', () => {
  const items = [{i:'a',x:0,y:0,w:6,h:5},{i:'b',x:0,y:0,w:6,h:5}];
  const before = JSON.stringify(items);
  expect(viewportBoardLayout(items,1400).items.map(item=>item.row)).toEqual([1,2]);
  expect(JSON.stringify(items)).toBe(before);
});
