import React from 'react';
import { ArrowUpRight, Pin, Database } from 'lucide-react';
import type { MetricChart } from '../../types';
import { listChartTypes } from '../../services/analysis/chartRegistry';
import { extractTablesFromSql } from '../../services/queryVizHint';

interface Props {
  charts: MetricChart[];
  data: Record<string, unknown[]>;
  errors: Record<string, string>;
  loading: boolean;
  pinned: ReadonlySet<string>;
  onInspect: (id: string) => void;
}

/** A scan-friendly presentation of the same filtered assets and query results. */
export function VisualizationAssetList({charts,data,errors,loading,pinned,onInspect}:Props) {
  const types=listChartTypes();
  return <div className="viz-asset-list">
    <div className="viz-asset-list-heading" aria-hidden="true"><span>图表名称</span><span>数据来源</span><span>类型</span><span>结果行</span><span>查看</span></div>
    <ul aria-label="图表资产列表">
      {charts.map(chart=>{
        const title=chart.chartConfig?.title || chart.metricName || '未命名图表';
        const rawType=chart.chartConfig?.type || 'bar';
        const type=rawType==='counter'?'kpi':rawType==='pivot'?'table':rawType;
        const source=chart.sourceTable || extractTablesFromSql(chart.sql || '')[0];
        const error=errors[chart.id];
        const rows=data[chart.id];
        return <li key={chart.id} className="viz-asset-row">
          <div className="viz-asset-name"><button type="button" onClick={()=>onInspect(chart.id)} aria-label={`查看图表 ${title}`}>{title}</button>
            <span className="viz-asset-origin">{chart.metricId?'来自指标':'即席分析'}{pinned.has(chart.id)&&<span><Pin size={11} aria-hidden="true" />已固定首页</span>}</span>
          </div>
          <span className="viz-asset-source" title={source}><Database size={13} aria-hidden="true" /><span>{source || '查询结果'}</span></span>
          <span className="viz-asset-type">{types.find(item=>item.id===type)?.label || type}</span>
          <span className={`viz-asset-result ${error?'text-monokai-pink':''}`} title={error} aria-label={`${title}：${error?'查询失败':rows?`${rows.length} 行结果`:loading?'正在读取':'结果未加载'}`}><span className="viz-result-label" aria-hidden="true">结果行</span>{error?'查询失败':rows?rows.length.toLocaleString():loading?'读取中…':'—'}</span>
          <button type="button" className="viz-asset-arrow" onClick={()=>onInspect(chart.id)} aria-label={`专注查看 ${title}`}><ArrowUpRight size={16} aria-hidden="true" /></button>
        </li>;
      })}
    </ul>
  </div>;
}
