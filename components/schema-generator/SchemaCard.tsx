import React from 'react';
import { ColumnSemanticInfo } from '../../types';
import { Key, Hash, Type, Info, CheckCircle2, ChevronRight } from 'lucide-react';

interface SchemaCardProps {
    columns: ColumnSemanticInfo[];
}

export const SchemaCard: React.FC<SchemaCardProps> = ({ columns }) => {
    return (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <span>📋</span> 详细架构定义 (Detailed Schema)
                </h3>
                <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-1 rounded-full border border-gray-100">
                    {columns.length} COLUMNS DETECTED
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-white">
                        <tr>
                            <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Column</th>
                            <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</th>
                            <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Semantic Role</th>
                            <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Confidence</th>
                            <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Description</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 bg-white">
                        {columns.map((col, idx) => (
                            <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        {col.isPrimaryKey ? (
                                            <Key size={14} className="text-amber-500" />
                                        ) : (
                                            <Hash size={14} className="text-gray-300" />
                                        )}
                                        <span className={`text-sm font-bold ${col.isPrimaryKey ? 'text-amber-700' : 'text-gray-900'}`}>
                                            {col.name}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-[11px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                        {col.physicalType}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${col.semanticType === 'ID' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                col.semanticType === 'DIM' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                    col.semanticType === 'MEA' ? 'bg-green-50 text-green-600 border-green-100' :
                                                        col.semanticType === 'TIME' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                                            'bg-gray-50 text-gray-500 border-gray-100'
                                            }`}>
                                            {col.semanticType}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${col.confidence > 0.8 ? 'bg-green-500' : col.confidence > 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                style={{ width: `${col.confidence * 100}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-400">{(col.confidence * 100).toFixed(0)}%</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-xs text-gray-500 line-clamp-1 group-hover:line-clamp-none transition-all">
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
