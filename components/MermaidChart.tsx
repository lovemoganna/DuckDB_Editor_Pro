import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
        primaryColor: '#e0e7ff',
        primaryTextColor: '#1e3a8a',
        primaryBorderColor: '#1e3a8a',
        lineColor: '#6366f1',
    }
});

interface MermaidChartProps {
    chart: string;
}

export const MermaidChart: React.FC<MermaidChartProps> = ({ chart }) => {
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const renderChart = async () => {
            if (!chart) return;
            try {
                const uniqueId = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
                const { svg } = await mermaid.render(uniqueId, chart);
                setSvg(svg);
                setError(null);
            } catch (err: any) {
                console.error("Mermaid Render Error:", err);
                setError("Diagram Render Failed");
                // Mermaid might strip the error message, but catching avoids app crash
            }
        };

        renderChart();
    }, [chart]);

    if (error) return <div className="text-red-400 text-xs text-center p-4">❌ {error}</div>;

    return (
        <div
            className="mermaid-container w-full overflow-x-auto flex justify-center p-4"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
};
