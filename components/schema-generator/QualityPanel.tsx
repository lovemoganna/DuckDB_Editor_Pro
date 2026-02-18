import React from 'react';
import { QualityReport } from '../../types';
import { Shield, AlertTriangle, XCircle, Info, Lightbulb, CheckCircle2 } from 'lucide-react';

interface QualityPanelProps {
    report: QualityReport | null;
}

export const QualityPanel: React.FC<QualityPanelProps> = ({ report }) => {
    if (!report) return null;

    const errorCount = report.issues.filter(i => i.severity === 'error').length;
    const warnCount = report.issues.filter(i => i.severity === 'warning').length;
    const infoCount = report.issues.filter(i => i.severity === 'info').length;

    return (
        <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quality Score</span>
                    <div className="flex items-end gap-2 mt-2">
                        <span className="text-3xl font-black text-gray-900">{report.overallScore}</span>
                        <span className="text-sm text-gray-400 mb-1">/100</span>
                    </div>
                    <div className="mt-4 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${report.overallScore >= 90 ? 'bg-green-500' : report.overallScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${report.overallScore}%` }}
                        ></div>
                    </div>
                </div>

                <div className="bg-red-50 p-5 rounded-2xl border border-red-100 shadow-sm">
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest flex items-center gap-1">
                        <XCircle size={10} /> Errors
                    </span>
                    <div className="text-3xl font-black text-red-600 mt-2">{errorCount}</div>
                    <p className="text-[10px] text-red-400 mt-1">Require immediate fix</p>
                </div>

                <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 shadow-sm">
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1">
                        <AlertTriangle size={10} /> Warnings
                    </span>
                    <div className="text-3xl font-black text-amber-600 mt-2">{warnCount}</div>
                    <p className="text-[10px] text-amber-500 mt-1">Recommended for review</p>
                </div>

                <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 shadow-sm">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1">
                        <Info size={10} /> Observations
                    </span>
                    <div className="text-3xl font-black text-blue-600 mt-2">{infoCount}</div>
                    <p className="text-[10px] text-blue-400 mt-1">Informational insights</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Issues List */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-amber-500" />
                        <h4 className="text-sm font-bold text-gray-700">发现的问题列表 (Detected Issues)</h4>
                    </div>
                    <div className="p-4 space-y-3">
                        {report.issues.length === 0 ? (
                            <div className="py-8 text-center text-gray-400 flex flex-col items-center gap-2">
                                <CheckCircle2 size={32} className="text-green-500 opacity-20" />
                                <span className="text-sm font-medium">No quality issues detected</span>
                            </div>
                        ) : (
                            report.issues.map((issue, idx) => (
                                <div key={idx} className={`p-4 rounded-xl border-l-4 flex gap-3 ${issue.severity === 'error' ? 'bg-red-50/50 border-red-500' :
                                        issue.severity === 'warning' ? 'bg-amber-50/50 border-amber-500' :
                                            'bg-blue-50/50 border-blue-500'
                                    }`}>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-gray-900 text-xs">[{issue.column}] {issue.type}</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${issue.severity === 'error' ? 'bg-red-100 text-red-600' :
                                                    issue.severity === 'warning' ? 'bg-amber-100 text-amber-600' :
                                                        'bg-blue-100 text-blue-600'
                                                }`}>{issue.severity}</span>
                                        </div>
                                        <p className="text-xs text-gray-600 leading-relaxed">{issue.detail}</p>
                                        <div className="mt-2 flex items-center gap-1.5 text-gray-900 font-bold text-[10px] bg-white w-fit px-2 py-1 rounded border border-gray-100 italic">
                                            <Lightbulb size={12} className="text-amber-500" />
                                            Suggest: {issue.suggestion}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Recommendations */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                        <Lightbulb size={16} className="text-amber-500" />
                        <h4 className="text-sm font-bold text-gray-700">修复与优化建议 (Recommendations)</h4>
                    </div>
                    <div className="p-6">
                        {report.recommendations.length === 0 ? (
                            <div className="py-8 text-center text-gray-400">
                                <span className="text-sm">No specific recommendations at this time</span>
                            </div>
                        ) : (
                            <ul className="space-y-4">
                                {report.recommendations.map((rec, idx) => (
                                    <li key={idx} className="flex gap-4">
                                        <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                            {idx + 1}
                                        </div>
                                        <div className="text-sm text-gray-700 leading-relaxed pt-1">
                                            {rec}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <div className="mt-8 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                            <h5 className="text-[10px] font-bold text-indigo-900 uppercase tracking-widest mb-1">Expert Tip</h5>
                            <p className="text-xs text-indigo-700">执行建议的修复脚本可以自动优化数据结构，减少存储占用并提升查询性能。</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
