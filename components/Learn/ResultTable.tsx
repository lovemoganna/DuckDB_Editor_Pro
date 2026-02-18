import React from 'react';
import { getTypeIcon } from '../../utils';

interface ResultTableProps {
    data: any[];
    columns?: string[];
    error?: string | null;
    loading?: boolean;
    executionTime?: number;
}

export const ResultTable: React.FC<ResultTableProps> = ({ data, columns, error, loading, executionTime }) => {
    if (loading) {
        return (
            <div className="p-4 bg-[#282a36] border-t border-monokai-accent/30 flex items-center gap-2 text-monokai-comment text-sm">
                <div className="w-4 h-4 border-2 border-monokai-blue border-t-transparent rounded-full animate-spin"></div>
                Running query...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-[#282a36] border-t border-monokai-accent/30 text-monokai-pink text-sm font-mono overflow-auto whitespace-pre-wrap">
                Error: {error}
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="p-4 bg-[#282a36] border-t border-monokai-accent/30 text-monokai-comment text-sm italic">
                Query returned no results. {executionTime !== undefined && <span className='text-xs ml-2 opacity-70'>({executionTime.toFixed(2)}ms)</span>}
            </div>
        );
    }

    // Auto-detect columns if not provided
    const displayColumns = columns || Object.keys(data[0]);

    return (
        <div className="bg-[#282a36] border-t border-monokai-accent/30 flex flex-col max-h-[300px] overflow-hidden">
            {executionTime !== undefined && (
                <div className="px-2 py-1 bg-monokai-sidebar/50 text-[10px] text-monokai-comment text-right border-b border-monokai-accent/20">
                    Executed in {executionTime.toFixed(2)}ms • {data.length} rows
                </div>
            )}
            <div className="overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead className="bg-[#21222c] sticky top-0 z-10 shadow-sm">
                        <tr>
                            {displayColumns.map(col => (
                                <th key={col} className="p-2 border-b border-monokai-accent/30 text-monokai-blue font-semibold whitespace-nowrap">
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-[#282a36]">
                        {data.map((row, idx) => (
                            <tr key={idx} className="hover:bg-monokai-accent/10 border-b border-monokai-accent/10 last:border-0">
                                {displayColumns.map(col => {
                                    const val = row[col];
                                    const isNull = val === null || val === undefined;
                                    return (
                                        <td key={`${idx}-${col}`} className={`p-2 whitespace-nowrap text-monokai-fg ${isNull ? 'italic text-monokai-comment/60' : ''}`}>
                                            {isNull ? 'NULL' : (typeof val === 'object' ? JSON.stringify(val) : String(val))}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
