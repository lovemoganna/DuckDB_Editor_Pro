import React from 'react';
import { ScrollText, ClipboardList, BarChart2, Link2, Zap } from 'lucide-react';

export interface AuditLog {
    id: number;
    log_time: string;
    operation_type: string;
    target_table: string | null;
    details: string;
    affected_rows: number;
}

export interface AuditTabProps {
    auditLogs: AuditLog[];
}

export const AuditTab: React.FC<AuditTabProps> = ({ auditLogs }) => {
    return (
        <div className="h-full flex flex-col bg-monokai-bg">
            <div className="p-4 border-b border-monokai-accent shrink-0">
                <h2 className="text-xl font-bold text-monokai-orange">System Audit Log</h2>
                <p className="text-sm text-monokai-comment">Persistent tracking of all data modification operations.</p>
            </div>
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-monokai-surface border-b border-monokai-accent sticky top-0">
                        <tr>
                            <th className="p-3 font-mono text-monokai-blue">Time</th>
                            <th className="p-3 font-mono text-monokai-pink">Type</th>
                            <th className="p-3 font-mono text-monokai-yellow">Table</th>
                            <th className="p-3 font-mono text-monokai-fg">Details</th>
                            <th className="p-3 font-mono text-monokai-green text-right">Rows</th>
                        </tr>
                    </thead>
                    <tbody className="font-mono">
                        {auditLogs.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-12 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <ScrollText className="w-12 h-12 text-monokai-comment/30" />
                                        <p className="text-sm text-monokai-comment">No audit records yet</p>
                                        <p className="text-xs text-monokai-comment/50">Data modification operations will appear here</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            auditLogs.map((log) => (
                                <tr key={log.id} className="border-b border-monokai-accent hover:bg-monokai-sidebar">
                                    <td className="p-3 text-monokai-comment">{new Date(log.log_time).toLocaleString()}</td>
                                    <td className="p-3 font-bold">{log.operation_type}</td>
                                    <td className="p-3">{log.target_table || '-'}</td>
                                    <td className="p-3 opacity-90 truncate max-w-xl" title={log.details}>{log.details}</td>
                                    <td className="p-3 text-right">{log.affected_rows}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
