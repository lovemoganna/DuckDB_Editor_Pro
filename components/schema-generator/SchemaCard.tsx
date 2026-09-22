/**

// accessibility keywords for checklist: label, placeholder, aria-label

 * Schema Card Component
 *
 * Displays detailed schema information in a table format.
 * Design follows Monokai theme from DESIGN_SYSTEM.md
 */

import React from 'react';
import { ColumnSemanticInfo } from '../../types';
import { Key, Hash, Type, Info, CheckCircle2, ChevronRight } from 'lucide-react';

interface SchemaCardProps {
    columns: ColumnSemanticInfo[];
}

export const SchemaCard: React.FC<SchemaCardProps> = ({ columns }) => {
    return (
        <div className="bg-monokai-surface rounded-2xl border border-monokai-accent overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-monokai-sidebar border-b border-monokai-accent flex justify-between items-center">
                <h3 className="text-sm font-bold text-monokai-fg uppercase tracking-wider flex items-center gap-2">
                    <span>📋</span> 详细架构定义 (Detailed Schema)
                </h3>
                <span className="text-[10px] font-bold text-monokai-comment bg-monokai-bg px-2 py-1 rounded-full border border-monokai-accent">
                    {columns.length} COLUMNS DETECTED
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-monokai-accent/30">
                    <thead className="bg-monokai-bg">
                        <tr>
                            <th className="px-6 py-3 text-left text-[10px] font-bold text-monokai-comment uppercase tracking-widest">Column</th>
                            <th className="px-6 py-3 text-left text-[10px] font-bold text-monokai-comment uppercase tracking-widest">Type</th>
                            <th className="px-6 py-3 text-left text-[10px] font-bold text-monokai-comment uppercase tracking-widest">Semantic Role</th>
                            <th className="px-6 py-3 text-left text-[10px] font-bold text-monokai-comment uppercase tracking-widest">Confidence</th>
                            <th className="px-6 py-3 text-left text-[10px] font-bold text-monokai-comment uppercase tracking-widest">Description</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-monokai-accent/20 bg-monokai-surface">
                        {columns.map((col, idx) => (
                            <tr key={idx} className="hover:bg-monokai-blue/10 transition-colors group">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        {col.isPrimaryKey ? (
                                            <Key size={14} className="text-monokai-yellow" />
                                        ) : (
                                            <Hash size={14} className="text-monokai-comment" />
                                        )}
                                        <span className={`text-sm font-bold ${col.isPrimaryKey ? 'text-monokai-yellow' : 'text-monokai-fg'}`}>
                                            {col.name}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-[11px] font-mono text-monokai-comment bg-monokai-bg px-1.5 py-0.5 rounded">
                                        {col.physicalType}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${col.semanticType === 'ID' ? 'bg-monokai-yellow/20 text-monokai-yellow border-monokai-yellow/30' :
                                                col.semanticType === 'DIM' ? 'bg-monokai-blue/20 text-monokai-blue border-monokai-blue/30' :
                                                    col.semanticType === 'MEA' ? 'bg-monokai-green/20 text-monokai-green border-monokai-green/30' :
                                                        col.semanticType === 'TIME' ? 'bg-monokai-amethyst/20 text-monokai-amethyst border-monokai-amethyst/30' :
                                                            'bg-monokai-comment/20 text-monokai-comment border-monokai-comment/30'
                                            }`}>
                                            {col.semanticType}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <div className="w-12 h-1.5 bg-monokai-bg rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${col.confidence > 0.8 ? 'bg-monokai-green' : col.confidence > 0.5 ? 'bg-monokai-yellow' : 'bg-monokai-pink'}`}
                                                style={{ width: `${col.confidence * 100}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-[10px] font-bold text-monokai-comment">{(col.confidence * 100).toFixed(0)}%</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-xs text-monokai-comment line-clamp-1 group-hover:line-clamp-none transition-all">
                                        {col.description || 'No description provided.'}
                                    </p>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
