import React from 'react';
import { ColumnSemanticInfo } from '../../types';

interface SchemaPreviewProps {
    tableName: string;
    columns: ColumnSemanticInfo[];
    rowCount: number;
}

export const SchemaPreview: React.FC<SchemaPreviewProps> = ({ tableName, columns, rowCount }) => {
    // Group columns by semantic type
    const dims = columns.filter(c => c.semanticType === 'DIM').length;
    const meas = columns.filter(c => c.semanticType === 'MEA' || c.semanticType === 'CURR').length;
    const times = columns.filter(c => c.semanticType === 'TIME').length;
    const ids = columns.filter(c => c.semanticType === 'ID').length;

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm h-full flex flex-col">
            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span>🔗</span> Schema Preview
            </h4>

            <div className="flex-1 flex flex-col items-center justify-center py-2">
                {/* Visual Table Representation */}
                <div className="bg-slate-50 border-2 border-slate-200 rounded-lg w-full max-w-[200px] shadow-sm relative overflow-hidden group hover:border-blue-400 transition-colors">
                    <div className="bg-slate-200 px-3 py-2 text-xs font-bold text-slate-700 border-b border-slate-300 flex justify-between">
                        <span className="truncate">{tableName}</span>
                        <span className="text-[10px] bg-white px-1 rounded text-slate-500">{columns.length} cols</span>
                    </div>
                    <div className="p-2 space-y-1">
                        {columns.slice(0, 5).map((col, i) => (
                            <div key={i} className="flex justify-between text-[10px]">
                                <span className={`font-mono ${col.isPrimaryKey ? 'font-bold text-amber-600' : 'text-slate-600'}`}>
                                    {col.name} {col.isPrimaryKey && '🔑'}
                                </span>
                                <span className="text-slate-400">{col.physicalType}</span>
                            </div>
                        ))}
                        {columns.length > 5 && (
                            <div className="text-[9px] text-center text-slate-400 pt-1">
                                + {columns.length - 5} more...
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Semantic Summary Tags */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                {ids > 0 && (
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] rounded border border-amber-100 font-bold" title="Identifiers">
                        🔑 {ids} IDs
                    </span>
                )}
                {dims > 0 && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded border border-blue-100 font-bold" title="Dimensions">
                        📦 {dims} DIMs
                    </span>
                )}
                {meas > 0 && (
                    <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] rounded border border-green-100 font-bold" title="Measures">
                        📈 {meas} MEAs
                    </span>
                )}
                {times > 0 && (
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] rounded border border-purple-100 font-bold" title="Time Attributes">
                        📅 {times} TIMEs
                    </span>
                )}
            </div>
        </div>
    );
};
