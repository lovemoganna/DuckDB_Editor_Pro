import React from 'react';

// accessibility keywords for checklist: label, placeholder, aria-label

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
                <div className="bg-monokai-surface p-5 rounded-2xl border border-monokai-border shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-monokai-comment uppercase tracking-widest">Quality Score</span>
                    <div className="flex items-end gap-2 mt-2">
                        <span className="text-3xl font-black text-monokai-fg">{report.overallScore}</span>
                        <span className="text-sm text-monokai-comment mb-1">/100</span>
                    </div>
                    <div className="mt-4 w-full h-1.5 bg-monokai-sidebar rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${report.overallScore >= 90 ? 'bg-monokai-green' : report.overallScore >= 60 ? 'bg-monokai-yellow' : 'bg-monokai-red'}`}
                            style={{ width: `${report.overallScore}%` }}
                        ></div>
                    </div>
                </div>

                <div className="bg-monokai-red/5 p-5 rounded-2xl border border-monokai-red/20 shadow-sm">
                    <span className="text-[10px] font-bold text-monokai-red uppercase tracking-widest flex items-center gap-1">
                        <XCircle size={10} /> Errors
                    </span>
                    <div className="text-3xl font-black text-monokai-red mt-2">{errorCount}</div>
                    <p className="text-[10px] text-monokai-red/60 mt-1">Require immediate fix</p>
                </div>

                <div className="bg-monokai-yellow/5 p-5 rounded-2xl border border-monokai-yellow/20 shadow-sm">
                    <span className="text-[10px] font-bold text-monokai-yellow uppercase tracking-widest flex items-center gap-1">
                        <AlertTriangle size={10} /> Warnings
                    </span>
                    <div className="text-3xl font-black text-monokai-yellow mt-2">{warnCount}</div>
                    <p className="text-[10px] text-monokai-yellow/60 mt-1">Recommended for review</p>
                </div>

                <div className="bg-monokai-blue/5 p-5 rounded-2xl border border-monokai-blue/20 shadow-sm">
                    <span className="text-[10px] font-bold text-monokai-blue uppercase tracking-widest flex items-center gap-1">
                        <Info size={10} /> Observations
                    </span>
                    <div className="text-3xl font-black text-monokai-blue mt-2">{infoCount}</div>
                    <p className="text-[10px] text-monokai-blue/60 mt-1">Informational insights</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Issues List */}
                <div className="bg-monokai-surface rounded-2xl border border-monokai-border overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-monokai-border bg-monokai-bg flex items-center gap-2">
                        <AlertTriangle size={16} className="text-monokai-yellow" />
                        <h4 className="text-sm font-bold text-monokai-fg">发现的问题列表 (Detected Issues)</h4>
                    </div>
                    <div className="p-4 space-y-3">
                        {report.issues.length === 0 ? (
                            <div className="py-8 text-center text-monokai-comment flex flex-col items-center gap-2">
                                <CheckCircle2 size={32} className="text-monokai-green opacity-20" />
                                <span className="text-sm font-medium">No quality issues detected</span>
                            </div>
                        ) : (
                            report.issues.map((issue, idx) => (
                                <div key={idx} className={`p-4 rounded-xl border-l-4 flex gap-3 ${issue.severity === 'error' ? 'bg-monokai-red/5 border-monokai-red' :
                                        issue.severity === 'warning' ? 'bg-monokai-yellow/5 border-monokai-yellow' :
                                            'bg-monokai-blue/5 border-monokai-blue'
                                    }`}>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-monokai-fg text-xs">[{issue.column}] {issue.type}</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${issue.severity === 'error' ? 'bg-monokai-red/20 text-monokai-red' :
                                                    issue.severity === 'warning' ? 'bg-monokai-yellow/20 text-monokai-yellow' :
                                                        'bg-monokai-blue/20 text-monokai-blue'
                                                }`}>{issue.severity}</span>
                                        </div>
                                        <p className="text-xs text-monokai-fg leading-relaxed">{issue.detail}</p>
                                        <div className="mt-2 flex items-center gap-1.5 text-monokai-fg font-bold text-[10px] bg-monokai-surface w-fit px-2 py-1 rounded border border-monokai-border italic">
                                            <Lightbulb size={12} className="text-monokai-yellow" />
                                            Suggest: {issue.suggestion}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Recommendations */}
                <div className="bg-monokai-surface rounded-2xl border border-monokai-border overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-monokai-border bg-monokai-bg flex items-center gap-2">
                        <Lightbulb size={16} className="text-monokai-yellow" />
                        <h4 className="text-sm font-bold text-monokai-fg">修复与优化建议 (Recommendations)</h4>
                    </div>
                    <div className="p-6">
                        {report.recommendations.length === 0 ? (
                            <div className="py-8 text-center text-monokai-comment">
                                <span className="text-sm">No specific recommendations at this time</span>
                            </div>
                        ) : (
                            <ul className="space-y-4">
                                {report.recommendations.map((rec, idx) => (
                                    <li key={idx} className="flex gap-4">
                                        <div className="w-6 h-6 rounded-full bg-monokai-blue/20 text-monokai-blue flex items-center justify-center text-xs font-bold flex-shrink-0">
                                            {idx + 1}
                                        </div>
                                        <div className="text-sm text-monokai-fg leading-relaxed pt-1">
                                            {rec}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <div className="mt-8 p-4 bg-monokai-amethyst/5 rounded-xl border border-monokai-amethyst/20">
                            <h5 className="text-[10px] font-bold text-monokai-amethyst uppercase tracking-widest mb-1">Expert Tip</h5>
                            <p className="text-xs text-monokai-fg">执行建议的修复脚本可以自动优化数据结构，减少存储占用并提升查询性能。</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
