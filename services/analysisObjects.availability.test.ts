import { describe, expect, it, vi } from 'vitest';
import { listAnalysisObjects } from './analysisObjects';
vi.mock('./dbService', () => ({ dbService: { getDomainSetting: vi.fn(async () => [{id:'a',title:'失效分析',metricId:'bad',sourceTables:[],note:''}]) } }));
vi.mock('./metricAnalyzer', () => ({ metricAnalyzer: { loadMetricPackages: () => [{metrics:[{id:'good',name:'正常指标',isValid:true},{id:'bad',name:'失效指标',isValid:false,validationError:'来源表已不存在'}]}] } }));
vi.mock('./visualizationAssets', () => ({ loadVisualizationAssets: async () => [{id:'c',metricId:'bad',metricName:'失效图表',chartConfig:{}}] }));
describe('content library availability', () => {
  it('shares the verified failure reason across a metric and its dependent chart and analysis', async () => {
    const objects = await listAnalysisObjects('review');
    expect(objects.find(item => item.id === 'good')?.unavailableReason).toBeUndefined();
    for (const id of ['bad','c','a']) expect(objects.find(item => item.id === id)?.unavailableReason).toBe('来源表已不存在');
  });
});
