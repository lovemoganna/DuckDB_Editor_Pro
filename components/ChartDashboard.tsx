import { expandChartExport } from '../utils/chartExport';
import { chartContent, widgetSpace } from '../utils/dashboardLayout';
import React, { useState } from 'react';
import './Visualization/visualizationUi.css';
import { toastService } from '../services/toastService';
import { ChartConfig } from '../types';
import { ChartRenderer } from './charts/ChartRenderer';
import { widgetRowsToChartSpec } from '../services/analysis/adapters/dashboardWidgetAdapter';
import { Edit, Trash2, Download } from 'lucide-react';
import html2canvas from 'html2canvas';

interface ChartDashboardProps {
    charts: ChartConfig[];
    data: any[];
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
}

export const ChartDashboard: React.FC<ChartDashboardProps> = ({ charts, data, onEdit, onDelete }) => {

    const [exporting, setExporting] = useState<string | null>(null);
    const downloadChart = async (id: string, title: string) => {
        const element = document.getElementById(`chart-container-${id}`);
        if (element && !exporting) {
          setExporting(id);
          try {
            const canvas = await html2canvas(element, { backgroundColor: getComputedStyle(element).backgroundColor, onclone: document => expandChartExport(document, element) });
            const url = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `${(title || '图表').replace(/[\s<>:"/\\|?*]+/g, '_')}_chart.png`;
            link.href = url;
            link.click();
            toastService.success('图表图片导出成功');
          } catch { toastService.error('导出失败，请重试'); } finally { setExporting(null); }
        }
    };

    return (
        <div className="visualization-surface grid gap-4 min-w-0 h-full overflow-y-auto pb-20 custom-scrollbar content-start items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))' }}>
            {charts.map(chart => {
                const chartSpec = widgetRowsToChartSpec(data, chart);

                return (
                    <div key={chart.id} id={`chart-container-${chart.id}`} style={{ height: widgetSpace(chartContent(chart.type, data.length, chart.yKeys.length), 480).height + 56 }} className="bg-monokai-sidebar border border-monokai-border rounded-xl p-4 flex flex-col min-w-0 relative group hover:border-monokai-border-strong transition-colors shadow-md">
                        <div className="flex justify-between items-center mb-2 pb-1 border-b border-monokai-border/60">
                            <h3 className="text-xs font-bold text-monokai-fg break-words px-1">{chart.title || '未命名图表'}</h3>
                            <div className="flex shrink-0 gap-1">
                                <button type="button" aria-label="下载图片" disabled={Boolean(exporting) || !data.length} onClick={() => downloadChart(chart.id, chart.title)} className="h-7 w-7 flex items-center justify-center hover:bg-monokai-surface rounded-lg text-monokai-comment hover:text-monokai-fg transition-colors" title="下载图片"><Download size={13} /></button>
                                <button type="button" onClick={() => onEdit(chart.id)} className="h-7 w-7 flex items-center justify-center hover:bg-monokai-surface rounded-lg text-monokai-comment hover:text-monokai-fg transition-colors" title="编辑"><Edit size={13} /></button>
                                <button type="button" onClick={() => onDelete(chart.id)} className="h-7 w-7 flex items-center justify-center hover:bg-monokai-surface rounded-lg text-monokai-comment hover:text-monokai-pink transition-colors" title="删除"><Trash2 size={13} /></button>
                            </div>
                        </div>
                        <div className="flex-1 relative min-h-0 w-full bg-monokai-bg/40 p-2">
                            <ChartRenderer chartSpec={chartSpec} hideTitle />
                        </div>
                    </div>
                );
            })}
        </div>
    );

};
