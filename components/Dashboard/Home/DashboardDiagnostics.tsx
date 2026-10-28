import React, { useSyncExternalStore } from 'react';
import { APP_BUILD_ID } from '../../../services/buildInfo';
import { getDashboardIncidents, getDashboardIncidentRevision } from '../../../services/dashboardDiagnostics';

const subscribe=(listener:()=>void)=>{
  window.addEventListener('duckdb-dashboard-incident',listener);
  return()=>window.removeEventListener('duckdb-dashboard-incident',listener);
};

export function DashboardDiagnostics({catalog,boardId}:{catalog:string;boardId?:string}) {
  const revision=useSyncExternalStore(subscribe,getDashboardIncidentRevision,()=>0);
  const incidents=getDashboardIncidents().filter(entry=>entry.catalog===catalog && (!boardId || !entry.boardId || entry.boardId===boardId));
  return <details className="text-xs text-monokai-comment" data-diagnostic-revision={revision}>
    <summary className="w-fit cursor-pointer rounded px-1 py-1 hover:text-monokai-fg">{incidents.length > 0 ? `工作台诊断 · ${incidents.length} 条异常记录` : '工作台诊断'}</summary>
    <div className="mt-1 flex flex-wrap items-center gap-3 rounded border border-monokai-border p-2">
    <span data-build-id={APP_BUILD_ID} title="反馈问题时可附上此版本">版本 {APP_BUILD_ID}</span>
    {incidents.length>0 && <span>本次会话记录了 {incidents.length} 条看板异常</span>}
    <button type="button" className="underline" onClick={()=>{
      const url=URL.createObjectURL(new Blob([JSON.stringify({version:2,buildId:APP_BUILD_ID,incidents},null,2)],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download='dashboard-diagnostics.json';link.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),0);
    }}>导出诊断记录</button>
    </div>
  </details>;
}
