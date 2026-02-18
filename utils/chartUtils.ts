import { ChartConfig } from '../types';

export const MONOKAI_COLORS = [
    'rgba(249, 38, 114, 0.8)', // Pink
    'rgba(166, 226, 46, 0.8)', // Green
    'rgba(102, 217, 239, 0.8)', // Blue
    'rgba(253, 151, 31, 0.8)', // Orange
    'rgba(174, 129, 255, 0.8)', // Purple
    'rgba(230, 219, 116, 0.8)', // Yellow
];

const aggregate = (rows: any[], key: string, type?: string) => {
    if (rows.length === 0) return 0;
    const values = rows.map(r => Number(r[key]));

    switch (type) {
        case 'count': return rows.length;
        case 'sum': return values.reduce((a, b) => a + b, 0);
        case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
        case 'min': return Math.min(...values);
        case 'max': return Math.max(...values);
        case 'none':
        default: return values[0] || 0; // Take first if no agg
    }
};

/**
 * Aggregates data based on the configuration.
 * If groupBy is provided, it returns multiple datasets.
 * If not, it returns a single dataset (or multiple if yKeys > 1).
 */
export const transformDataForChart = (data: any[], config: ChartConfig) => {
    if (!data || data.length === 0) return { labels: [], datasets: [] };

    const { xKey, yKeys, groupBy, aggregation, type, yRightKeys } = config;

    // 1. Group Data (if groupBy exists)
    // If groupBy exists, we pivot: each unique value of groupBy becomes a dataset.
    // The xKey is the shared axis.

    // Get unique X values (labels)
    // If xKey is empty, use row index
    const labels = xKey ? Array.from(new Set(data.map(r => String(r[xKey])))) : data.map((_, i) => String(i + 1));

    // Sort labels if they look numeric or dates? For now, keep order of appearance or sort alphanumeric.
    // data.sort((a, b) => String(a[xKey]).localeCompare(String(b[xKey]))); // Naive sort

    let datasets: any[] = [];

    if (groupBy && yKeys.length > 0) {
        // Pivot Mode: One dataset per unique value of GroupBy column
        // We only support the first yKey for value in pivot mode for simplicity
        const valueKey = yKeys[0];
        const groups = Array.from(new Set(data.map(r => String(r[groupBy]))));

        datasets = groups.map((group, idx) => {
            const groupData = labels.map(label => {
                // Find rows matching this xLabel and this group
                const matches = data.filter(r => String(r[xKey]) === label && String(r[groupBy]) === group);
                return aggregate(matches, valueKey, aggregation);
            });

            return {
                label: group,
                data: groupData,
                backgroundColor: MONOKAI_COLORS[idx % MONOKAI_COLORS.length],
                borderColor: MONOKAI_COLORS[idx % MONOKAI_COLORS.length].replace('0.8', '1'),
                borderWidth: 1,
                fill: type === 'area',
                tension: 0.4
            };
        });
    } else {
        // Standard Mode: One dataset per yKey
        // Supports aggregation if multiple rows have same xKey (implicit group by xKey)
        // Or raw mapping if no aggregation

        datasets = yKeys.map((yKey, idx) => {
            const seriesData = labels.map(label => {
                const matches = xKey ? data.filter(r => String(r[xKey]) === label) : [data[Number(label) - 1]];
                return aggregate(matches, yKey, aggregation);
            });

            const color = config.colors?.[idx] || MONOKAI_COLORS[idx % MONOKAI_COLORS.length];
            return {
                label: yKey,
                data: seriesData,
                backgroundColor: (type === 'pie' || type === 'doughnut') ? MONOKAI_COLORS : color,
                borderColor: (type === 'pie' || type === 'doughnut') ? '#fff' : color.replace('0.8', '1'),
                borderWidth: 1,
                fill: type === 'area',
                tension: 0.4,
                yAxisID: 'y'
            };
        });

        // Add Right Axis Datasets
        if (yRightKeys && yRightKeys.length > 0) {
            const rightDatasets = yRightKeys.map((yKey, idx) => {
                const seriesData = labels.map(label => {
                    const matches = xKey ? data.filter(r => String(r[xKey]) === label) : [data[Number(label) - 1]];
                    return aggregate(matches, yKey, aggregation);
                });

                const color = MONOKAI_COLORS[(idx + yKeys.length) % MONOKAI_COLORS.length];
                return {
                    label: `${yKey} (R)`,
                    data: seriesData,
                    type: 'line', // Right axis usually line
                    backgroundColor: color,
                    borderColor: color.replace('0.8', '1'),
                    borderWidth: 2,
                    yAxisID: 'y1'
                };
            });
            datasets = [...datasets, ...rightDatasets];
        }
    }

    return { labels, datasets };
};

export const getChartOptions = (config: ChartConfig) => {
    const isPie = config.type === 'pie' || config.type === 'doughnut';
    return {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: (config.horizontal ? 'y' : 'x') as 'x' | 'y',
        plugins: {
            legend: {
                display: config.showLegend !== false,
                labels: { color: '#f8f8f2', font: { family: 'monospace' } }
            },
            datalabels: {
                display: config.showValues ? 'auto' : false,
                color: '#fff',
                formatter: (v: any) => typeof v === 'number' ? v.toFixed(2).replace(/\.00$/, '') : v
            },
            title: {
                display: !!config.title,
                text: config.title,
                color: '#fff',
                font: { size: 14, weight: 'bold' as const }
            }
        },
        scales: isPie ? { x: { display: false }, y: { display: false } } : {
            x: {
                stacked: !!config.stacked,
                ticks: { color: 'gray' },
                grid: { color: '#333' }
            },
            y: {
                display: true,
                stacked: !!config.stacked,
                ticks: { color: 'gray' },
                grid: { color: '#333' },
                title: {
                    display: !!config.yAxisLabel,
                    text: config.yAxisLabel || '',
                    color: 'white'
                }
            },
            ...((config.yRightKeys && config.yRightKeys.length > 0) ? {
                y1: {
                    display: true,
                    position: 'right' as const,
                    grid: {
                        drawOnChartArea: false,
                    },
                    ticks: { color: 'gray' },
                }
            } : {})
        },
        elements: {
            bar: { borderRadius: 4 },
            line: { tension: 0.3 }
        }
    };
};
