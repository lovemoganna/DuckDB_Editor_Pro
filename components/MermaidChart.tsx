import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { SafeSvgImage } from './ui/SafeSvgImage';
import { useVisualizationRequest } from '../hooks/useVisualizationRequest';

mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
        primaryColor: '#e0e7ff',
        primaryTextColor: '#1e3a8a',
        primaryBorderColor: '#1e3a8a',
        lineColor: '#6366f1',
    },
    securityLevel: 'strict',
});

interface MermaidChartProps {
    chart: string;
}

export const MermaidChart: React.FC<MermaidChartProps> = ({ chart }) => {
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const request = useVisualizationRequest();

    useEffect(() => {
        const current = request.begin();
        setSvg(''); setError(null);
        const renderChart = async () => {
            if (!chart) return;
            try {
                const uniqueId = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
                const { svg } = await mermaid.render(uniqueId, chart);
                if (!current()) return;
                setSvg(svg);
                setError(null);
            } catch (err: any) {
                if (!current()) return;
                console.error("Mermaid Render Error:", err);
                setError("Diagram Render Failed");
                // Mermaid might strip the error message, but catching avoids app crash
            }
        };

        renderChart();
        return request.invalidate;
    }, [chart, request]);

    if (error) return <div className="text-red-400 text-xs text-center p-4">❌ {error}</div>;
    if (!chart.trim()) return <div className="text-monokai-comment text-xs text-center p-4">暂无图形数据</div>;

    return (
        <div className="mermaid-container w-full overflow-x-auto flex justify-center p-4">
            <SafeSvgImage svg={svg} alt="Generated diagram" className="max-w-none" />
        </div>
    );
};
