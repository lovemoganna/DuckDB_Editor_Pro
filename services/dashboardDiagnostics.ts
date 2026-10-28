/** Bounded, session-local diagnostics. Never capture SQL, rows, parameters or stacks. */
import { APP_BUILD_ID } from './buildInfo';
export interface DashboardIncident {
  at: number;
  stage: 'configuration' | 'render' | 'layout-save' | 'query' | 'size';
  buildId?: string;
  durationMs?: number;
  queueWaitMs?: number;
  width?: number;
  height?: number;
  phase?: 'definition' | 'queue' | 'execute';
  catalog?: string;
  boardId?: string;
  widgetId?: string;
  formatVersion?: number;
  code: string;
}
const incidents: DashboardIncident[] = [];
let revision = 0;
export function getDashboardIncidentRevision() { return revision; }
export function reportDashboardIncident(incident: Omit<DashboardIncident, 'at'>) {
  const {stage,catalog,boardId,widgetId,formatVersion,code,durationMs,queueWaitMs,width,height,phase} = incident;
  const safeNumber=(value:number|undefined)=>Number.isFinite(value)?Math.max(0,Math.round(value!)):undefined;
  const entry = {stage,catalog,boardId,widgetId,formatVersion,code,buildId:APP_BUILD_ID,phase,
    durationMs:safeNumber(durationMs),queueWaitMs:safeNumber(queueWaitMs),width:safeNumber(width),height:safeNumber(height),at:Date.now()};
  incidents.push(entry);
  revision++;
  if (incidents.length > 50) incidents.shift();
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('duckdb-dashboard-incident', { detail: entry }));
}
export function getDashboardIncidents(): DashboardIncident[] { return incidents.map(entry => ({ ...entry })); }
