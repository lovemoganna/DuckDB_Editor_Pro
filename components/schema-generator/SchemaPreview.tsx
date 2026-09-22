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
        <div className="bg-monokai-surface rounded-xl border border-monokai-border p-5 shadow-xs h-full flex flex-col">
            <h4 className="text-xs font-bold text-monokai-comment uppercase tracking-wider mb-4 flex items-center gap-2">
                <span>🔗</span> Schema Preview
            </h4>

            <div className="flex-1 flex flex-col items-center justify-center py-2">
                {/* Visual Table Representation */}
                <div className="bg-monokai-bg border border-monokai-border rounded-lg w-full max-w-[200px] shadow-xs relative overflow-hidden group hover:border-monokai-accent/60 transition-colors">
                    <div className="bg-monokai-sidebar px-3 py-2 text-xs font-bold text-monokai-fg border-b border-monokai-border flex justify-between">
                        <span className="truncate">{tableName}</span>
                        <span className="text-[10px] bg-monokai-surface px-1.5 py-0.5 rounded text-monokai-comment border border-monokai-border">{columns.length} cols</span>
                    </div>
                    <div className="p-2.5 space-y-1.5">
                        {columns.slice(0, 5).map((col, i) => (
                            <div key={i} className="flex justify-between text-[11px]">
                                <span className={`font-mono ${col.isPrimaryKey ? 'font-bold text-monokai-accent' : 'text-monokai-fg'}`}>
                                    {col.name} {col.isPrimaryKey && '🔑'}
                                </span>
                                <span className="text-monokai-comment text-[10px]">{col.physicalType}</span>
                            </div>
                        ))}
                        {columns.length > 5 && (
                            <div className="text-[10px] text-center text-monokai-comment pt-1">
                                + {columns.length - 5} more...
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Semantic Summary Tags */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-monokai-border">
                {ids > 0 && (
                    <span className="px-2 py-0.5 bg-monokai-surface text-monokai-accent text-[10px] rounded border border-monokai-border font-medium" title="Identifiers">
                        🔑 {ids} IDs
                    </span>
                )}
                {dims > 0 && (
                    <span className="px-2 py-0.5 bg-monokai-surface text-monokai-fg text-[10px] rounded border border-monokai-border font-medium" title="Dimensions">
                        📦 {dims} DIMs
                    </span>
                )}
                {meas > 0 && (
                    <span className="px-2 py-0.5 bg-monokai-surface text-monokai-fg text-[10px] rounded border border-monokai-border font-medium" title="Measures">
                        📈 {meas} MEAs
                    </span>
                )}
                {times > 0 && (
                    <span className="px-2 py-0.5 bg-monokai-surface text-monokai-comment text-[10px] rounded border border-monokai-border font-medium" title="Time Attributes">
                        📅 {times} TIMEs
                    </span>
                )}
            </div>
        </div>
    );
};
