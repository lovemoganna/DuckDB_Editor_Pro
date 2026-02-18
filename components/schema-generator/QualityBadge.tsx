import React from 'react';
import { QualityReport } from '../../types';

interface QualityBadgeProps {
    report: QualityReport | null;
}

export const QualityBadge: React.FC<QualityBadgeProps> = ({ report }) => {
    if (!report) return null;

    const score = report.overallScore || 0;
    const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D';

    const colorClass = score >= 90 ? 'text-green-600 bg-green-50 border-green-200' :
        score >= 60 ? 'text-amber-600 bg-amber-50 border-amber-200' :
            'text-red-600 bg-red-50 border-red-200';

    const issuesCount = report.issues?.length || 0;

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm h-full flex flex-col justify-between">
            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span>🛡️</span> Data Quality
            </h4>

            <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black border-4 ${colorClass.replace('bg-', 'border-').replace('text-', '')} ${colorClass}`}>
                    {grade}
                </div>
                <div>
                    <div className="text-3xl font-bold text-gray-900">{score}<span className="text-sm text-gray-400 font-normal">/100</span></div>
                    <div className="text-xs text-gray-500 font-medium">Auto-Audit Score</div>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
                {issuesCount === 0 ? (
                    <div className="flex items-center gap-2 text-green-600 text-xs font-bold">
                        <span>✅</span> Healthy Dataset
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-amber-600 text-xs font-bold">
                        <span>⚠️</span> {issuesCount} Potential Issues
                    </div>
                )}
            </div>
        </div>
    );
};
