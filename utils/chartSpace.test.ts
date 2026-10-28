import { describe, it, expect } from 'vitest';
import { chartSpace, chartColumns, wrapChartLabel } from './chartSpace';
describe('readable chart geometry', () => {
  it('keeps the plot readable even inside a narrow panel', () => {
    expect(chartSpace({width:280,type:'line',labels:['A'],series:1}).width).toBe(280);
    expect(chartColumns(390)).toBe(1); expect(chartColumns(1000)).toBe(2);
  });
  it('fits a sparse pie or ring into the available plot instead of forcing a cropped 480px circle',()=>{
    for(const type of ['pie','doughnut']) {
      const space=chartSpace({width:264,height:160,type,labels:['ach','wire_transfer'],series:1});
      expect(space.width).toBe(264);
      expect(space.height).toBe(160);
    }
  });
  it('respects container height for dense pie and doughnut charts without inflating height', () => {
    for (const type of ['pie', 'doughnut']) {
      const dense = chartSpace({
        width: 320,
        height: 220,
        type,
        labels: Array.from({ length: 12 }, (_, i) => `Slice ${i}`),
        series: 1,
      });
      expect(dense.width).toBe(320);
      expect(dense.height).toBe(220);
    }
  });
  it('allocates space for every category and series without removing data', () => {
    const dense = chartSpace({width:480,type:'bar',labels:Array.from({length:60},(_,i)=>`Category ${i}`),series:5});
    expect(dense.width).toBeGreaterThan(5400);
    const horizontal=chartSpace({width:480,type:'bar',horizontal:true,labels:Array(60).fill('分类'),series:1});
    expect(horizontal.height).toBeGreaterThan(2000);
  });
  it('wraps full Unicode labels without cutting characters', () => {
    const label='完整的中文分类名称😀超长英文categoryname';
    expect(wrapChartLabel(label,6).join('')).toBe(label);
    expect(wrapChartLabel(label,6).every(line=>Array.from(line).length<=6)).toBe(true);
  });
});

it('fits short timeline labels without budgeting grouped bars for every series', () => {
  const labels=Array.from({length:12},(_,i)=>`2025-${String(i+1).padStart(2,'0')}`);
  expect(chartSpace({width:530,type:'line',labels,series:3}).width).toBe(530);
  expect(chartSpace({width:530,type:'bar',labels,series:3}).width).toBeGreaterThan(530);
});
