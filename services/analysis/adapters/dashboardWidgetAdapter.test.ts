import { describe, it, expect } from 'vitest';
import { enrichWidgetChartConfig, widgetRowsToChartSpec } from './dashboardWidgetAdapter';
import type { ChartConfig } from '../../types';

describe('dashboardWidgetAdapter', () => {
  it('honors the selected KPI field instead of formatting auxiliary order counts as percentages', () => {
    const chart=widgetRowsToChartSpec([{value:86,completed:43,total:50}],{id:'success',title:'完成率',type:'counter',xKey:'',yKeys:['value'],unit:'%'});
    expect(chart.kpiCards?.map(card=>card.formatted)).toEqual(['86%']);
  });
  it('renders text-only rule results and assigns percentage format only to the selected measure', () => {
    const rules=widgetRowsToChartSpec([{issue:'待核对',record_id:'order-1'}],{id:'quality',title:'规则',type:'table',xKey:'issue',yKeys:[]});
    expect(rules.emptyState).toBe('ok');
    const channels=widgetRowsToChartSpec([{orders:6,completed:5,success_pct:83.33}],{id:'channels',title:'渠道',type:'table',xKey:'channel',yKeys:['success_pct'],unit:'%'});
    expect(channels.formatByKey?.orders).toMatchObject({unit:'',percent:false});
    expect(channels.format?.unit).toBe('%');
  });
  const rows = [
    { region: 'East', amount: 80000 },
    { region: 'West', amount: 20000 },
  ];

  const barCfg: ChartConfig = {
    id: 'w1',
    title: '区域销售',
    type: 'bar',
    xKey: 'region',
    yKeys: ['amount'],
    unit: '¥',
  };

  it('enriches bar with labels, format, brushField', () => {
    const { chartSpec, chartConfig } = enrichWidgetChartConfig(rows, barCfg);
    expect(chartSpec.showValues).toBe(true);
    expect(chartSpec.format?.unit).toBe('¥');
    expect(chartSpec.brushField).toBe('region');
    expect(chartConfig.legendPosition).toBe('bottom');
    expect(chartConfig.labelMode).toBe('auto');
  });

  it('precomputes doughnut slice percents from filtered rows', () => {
    const spec = widgetRowsToChartSpec(rows, {
      ...barCfg,
      type: 'doughnut',
      id: 'w2',
    });
    expect(spec.sliceLabels?.length).toBe(2);
    expect(spec.centerTotal).toBe(100000);
    expect(spec.sliceLabels![0].percent).toBe(80);
  });
});
