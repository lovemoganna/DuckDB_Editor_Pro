import { expect, it } from 'vitest';
import { widgetRowsToChartSpec } from './adapters/dashboardWidgetAdapter';
import { selectScatterRecords } from './scatterSelection';
it('selects real records in data coordinates and excludes regression points', () => {
  const spec=widgetRowsToChartSpec([{x:1,y:2,record:'A'},{x:2,y:4,record:'B'},{x:3,y:6,record:'C'}],{id:'scatter',title:'散点',type:'scatter',xKey:'x',yKeys:['y'],showTrendLine:true,brushField:'record'});
  expect(spec.scatterSeries).toHaveLength(2);
  expect(selectScatterRecords(spec,[{seriesIndex:0,xMin:1.5,xMax:3,yMin:0,yMax:5},{seriesIndex:1,xMin:0,xMax:10,yMin:0,yMax:10}],'record')).toEqual(['B']);
});
