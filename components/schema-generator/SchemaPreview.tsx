/**
 * Schema Preview Component
 *
 * Displays a visual preview of table schema with semantic information.
 * Design follows Monokai theme from DESIGN_SYSTEM.md
 */

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
        <div className="bg-monokai-surface rounded-xl border border-monokai-accent p-5 shadow-sm h-full flex flex-col">
            <h4 className="text-sm font-bold text-monokai-comment uppercase tracking-widest mb-4 flex items-center gap-2">
                <span>🔗</span> Schema Preview
            </h4>

            <div className="flex-1 flex flex-col items-center justify-center py-2">
                {/* Visual Table Representation */}
                <div className="bg-monokai-bg border-2 border-monokai-accent/50 rounded-lg w-full max-w-[200px] shadow-sm relative overflow-hidden group hover:border-monokai-blue transition-colors">
                    <div className="bg-monokai-sidebar px-3 py-2 text-xs font-bold text-monokai-fg border-b border-monokai-accent flex justify-between">
                        <span className="truncate">{tableName}</span>
                        <span className="text-[10px] bg-monokai-accent/20 px-1 rounded text-monokai-comment">{columns.length} cols</span>
                    </div>
                    <div className="p-2 space-y-1">
                        {columns.slice(0, 5).map((col, i) => (
                            <div key={i} className="flex justify-between text-[10px]">
                                <span className={`font-mono ${col.isPrimaryKey ? 'font-bold text-monokai-yellow' : 'text-monokai-fg'}`}>
                                    {col.name} {col.isPrimaryKey && '🔑'}
                                </span>
                                <span className="text-monokai-comment">{col.physicalType}</span>
                            </div>
                        ))}
                        {columns.length > 5 && (
                            <div className="text-[9px] text-center text-monokai-comment pt-1">
                                + {columns.length - 5} more...
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Semantic Summary Tags */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-monokai-accent/30">
                {ids > 0 && (
                    <span className="px-2 py-0.5 bg-monokai-yellow/20 text-monokai-yellow text-[10px] rounded border border-monokai-yellow/30 font-bold" title="Identifiers">
                        🔑 {ids} IDs
                    </span>
                )}
                {dims > 0 && (
                    <span className="px-2 py-0.5 bg-monokai-blue/20 text-monokai-blue text-[10px] rounded border border-monokai-blue/30 font-bold" title="Dimensions">
                        📦 {dims} DIMs
                    </span>
                )}
                {meas > 0 && (
                    <span className="px-2 py-0.5 bg-monokai-green/20 text-monokai-green text-[10px] rounded border border-monokai-green/30 font-bold" title="Measures">
                        📈 {meas} MEAs
                    </span>
                )}
                {times > 0 && (
                    <span className="px-2 py-0.5 bg-monokai-amethyst/20 text-monokai-amethyst text-[10px] rounded border border-monokai-amethyst/30 font-bold" title="Time Attributes">
                        📅 {times} TIMEs
                    </span>
                )}
            </div>
        </div>
    );
};
