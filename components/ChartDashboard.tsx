import React, { useRef } from 'react';
import { ChartConfig } from '../types';
import { transformDataForChart, getChartOptions } from '../utils/chartUtils';
import { Bar, Line, Pie, Doughnut, Scatter } from 'react-chartjs-2';
import { MoreVertical, Maximize2, Edit, Trash2, Download } from 'lucide-react';
import html2canvas from 'html2canvas';

interface ChartDashboardProps {
    charts: ChartConfig[];
    data: any[];
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
}

export const ChartDashboard: React.FC<ChartDashboardProps> = ({ charts, data, onEdit, onDelete }) => {

    const downloadChart = async (id: string, title: string) => {
        const element = document.getElementById(`chart-container-${id}`);
        if (element) {
            const canvas = await html2canvas(element);
            const url = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `${title.replace(/\s+/g, '_')}_chart.png`;
            link.href = url;
            link.click();
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 h-full overflow-y-auto pb-20 custom-scrollbar">
            {charts.map(chart => {
                const chartData = transformDataForChart(data, chart);
                const options = getChartOptions(chart);

                return (
                    <div key={chart.id} id={`chart-container-${chart.id}`} className="bg-monokai-sidebar border border-monokai-border rounded-xl p-4 flex flex-col h-[300px] relative group hover:border-monokai-border-strong transition-colors shadow-md">
                        <div className="flex justify-between items-center mb-2 pb-1 border-b border-monokai-border/60">
                            <h3 className="text-xs font-bold text-monokai-fg truncate px-1">{chart.title || '未命名图表'}</h3>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => downloadChart(chart.id, chart.title)} className="p-1 hover:bg-monokai-surface rounded-lg text-monokai-comment hover:text-monokai-fg transition-colors" title="下载图片"><Download size={13} /></button>
                                <button onClick={() => onEdit(chart.id)} className="p-1 hover:bg-monokai-surface rounded-lg text-monokai-comment hover:text-monokai-fg transition-colors" title="编辑"><Edit size={13} /></button>
                                <button onClick={() => onDelete(chart.id)} className="p-1 hover:bg-monokai-surface rounded-lg text-monokai-comment hover:text-monokai-pink transition-colors" title="删除"><Trash2 size={13} /></button>
                            </div>
                        </div>
                        <div className="flex-1 relative min-h-0 w-full bg-monokai-bg/40 p-2">
                            {chart.type === 'bar' && <Bar data={chartData} options={options} />}
                            {chart.type === 'line' && <Line data={chartData} options={options} />}
                            {chart.type === 'area' && <Line data={chartData} options={options} />}
                            {chart.type === 'pie' && <Pie data={chartData} options={options} />}
                            {chart.type === 'doughnut' && <Doughnut data={chartData} options={options} />}
                            {chart.type === 'scatter' && <Scatter data={chartData} options={options} />}
                        </div>
                    </div>
                );
            })}
        </div>
    );

};
