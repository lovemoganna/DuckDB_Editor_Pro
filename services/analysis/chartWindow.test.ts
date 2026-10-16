import { it, expect } from 'vitest';
import { widgetRowsToChartSpec } from './adapters/dashboardWidgetAdapter';
import { chartWindow } from './chartWindow';
import { adaptChartSpec } from './adapters/chartJsAdapter';

it('windows large charts without altering totals, values or linked category identity', () => {
  const rows = Array.from({ length: 10000 }, (_, i) => ({ category: `record-${i}`, amount: i - 50 }));
  const spec = widgetRowsToChartSpec(rows, { id: 'large', title: '金额', type: 'waterfall', xKey: 'category', yKeys: ['amount'] });
  const display = chartWindow(spec, 2);
  expect(display.pages).toBe(125);
  expect(display.spec.waterfall?.bases[0]).toBe(spec.waterfall?.bases[160]);
  const linked: unknown[] = [];
  const bundle = adaptChartSpec(display.spec, { onBrush: (...args) => linked.push(args) });
  if (bundle.kind !== 'canvas') throw new Error('expected canvas');
  bundle.options.onClick?.({}, [{ index: 0 }]);
  expect(linked).toEqual([['category', 'record-160']]);
  expect(spec.rows).toHaveLength(10000);
  expect(display.spec.waterfall?.labels).toHaveLength(80);
});

it('preserves percentage denominators when paging a percent stack', () => {
  const spec = widgetRowsToChartSpec(Array.from({ length: 1000 }, (_, i) => ({ category: String(i), a: 20, b: 80 })),
    { id: 'percent', title: '占比', type: 'area', xKey: 'category', yKeys: ['a', 'b'], stackMode: 'percent' });
  const display = chartWindow(spec, 8);
  expect(display.spec.cartesian?.series[0].values[0]).toBe(20);
  expect(display.spec.cartesian?.series[1].values[0]).toBe(80);
});
it('pages dense arc labels while retaining every sector and the filtered total',()=>{
  const spec=widgetRowsToChartSpec(Array.from({length:10000},(_,i)=>({category:String(i),amount:1})),{id:'pie',title:'占比',type:'pie',xKey:'category',yKeys:['amount']});
  const display=chartWindow(spec,10);
  expect(display.spec.cartesian?.labels).toHaveLength(10000);
  expect(display.spec.centerTotal).toBe(10000);
  expect(display.spec.sliceLabels?.[400].percent).toBe(.01);
  expect(display.spec.arcLabelWindow).toEqual({from:400,to:440});
});
