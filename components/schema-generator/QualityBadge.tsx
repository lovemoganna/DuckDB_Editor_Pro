import React from 'react';
import { QualityReport } from '../../types';

interface QualityBadgeProps {
    report: QualityReport | null;
}

export const QualityBadge: React.FC<QualityBadgeProps> = ({ report }) => {
    if (!report) return null;

    const score = report.overallScore || 0;
    const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D';

    const colorClass = score >= 90 ? 'text-monokai-green bg-monokai-green/10 border-monokai-green/30' :
        score >= 60 ? 'text-monokai-yellow bg-monokai-yellow/10 border-monokai-yellow/30' :
            'text-monokai-red bg-monokai-red/10 border-monokai-red/30';

    const issuesCount = report.issues?.length || 0;

    return (
        <div className="bg-monokai-surface rounded-xl border border-monokai-border p-5 shadow-sm h-full flex flex-col justify-between">
            <h4 className="text-sm font-bold text-monokai-comment uppercase tracking-widest mb-4 flex items-center gap-2">
                <span>🛡️</span> Data Quality
            </h4>

            <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black border-4 ${colorClass.replace('bg-', 'border-').replace('text-', '')} ${colorClass}`}>
                    {grade}
                </div>
                <div>
                    <div className="text-3xl font-bold text-monokai-fg">{score}<span className="text-sm text-monokai-comment font-normal">/100</span></div>
                    <div className="text-xs text-monokai-comment font-medium">Auto-Audit Score</div>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-monokai-border">
                {issuesCount === 0 ? (
                    <div className="flex items-center gap-2 text-monokai-green text-xs font-bold">
                        <span>✅</span> Healthy Dataset
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-monokai-yellow text-xs font-bold">
                        <span>⚠️</span> {issuesCount} Potential Issues
                    </div>
                )}
            </div>
        </div>
    );
};
