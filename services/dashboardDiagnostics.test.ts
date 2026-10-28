import {expect,it} from 'vitest';
import {getDashboardIncidents,reportDashboardIncident} from './dashboardDiagnostics';
import {APP_BUILD_ID} from './buildInfo';
it('bounds diagnostics and whitelists metadata, excluding SQL, data and parameters',()=>{
  for(let index=0;index<55;index++)reportDashboardIncident({stage:'query',code:'test',phase:'queue',durationMs:12.8,queueWaitMs:Infinity,width:400,
    sql:'secret SQL',params:['secret'],rows:[{secret:true}]} as any);
  const incidents=getDashboardIncidents();expect(incidents).toHaveLength(50);
  expect(incidents[0]).toMatchObject({buildId:APP_BUILD_ID,durationMs:13,width:400,phase:'queue'});
  expect(JSON.stringify(incidents)).not.toContain('secret');expect(incidents[0].queueWaitMs).toBeUndefined();
});
