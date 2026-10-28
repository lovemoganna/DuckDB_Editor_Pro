import {afterEach,expect,it,vi} from 'vitest';
import {dbService} from './dbService';
import type {Dashboard} from '../types';
const original:Dashboard={id:'repair',databaseName:'sales',name:'original',createdAt:1,updatedAt:1,items:[
  {i:'a',savedQueryId:'q',x:0,y:0,w:6,h:5},{i:'b',savedQueryId:'q',x:0,y:0,w:6,h:5}]};
afterEach(()=>vi.restoreAllMocks());
function storage(fail?:string) {
  const objects=new Map<string,any>([['dashboard',{id:original.id,payload:JSON.stringify(original)}]]);
  vi.spyOn(dbService as any,'objectRecords').mockImplementation(async(kind:any)=>objects.has(kind)?[objects.get(kind)]:[]);
  const write=vi.spyOn(dbService as any,'putObject').mockImplementation(async(kind:any,item:any)=>{
    if(kind===fail)throw new Error('storage failed');
    objects.set(kind,{id:item.id,payload:JSON.stringify(item)});
  });
  return {objects,write};
}
it('backs up before repairing, serializes concurrent readers, and can durably restore original geometry',async()=>{
  const {objects,write}=storage();
  const [a,b]=await Promise.all([dbService.getDashboards('sales'),dbService.getDashboards('sales')]);
  expect(a[0].items[1].y).toBe(5);expect(b[0].items[1].y).toBe(5);
  expect(write.mock.calls.map(call=>call[0])).toEqual(['dashboard-layout-backup','dashboard']);
  expect(JSON.parse(objects.get('dashboard-layout-backup').payload).originalPayload).toBe(JSON.stringify(original));
  await dbService.getDashboards('sales');expect(write).toHaveBeenCalledTimes(2);
  await dbService.restoreDashboardLayout('repair','sales');
  expect((await dbService.getDashboards('sales'))[0].items).toMatchObject(original.items);
  expect(write).toHaveBeenCalledTimes(4);
});
it.each(['dashboard-layout-backup','dashboard'])('preserves the original if %s cannot commit',async(kind)=>{
  const {objects,write}=storage(kind);
  expect(await dbService.getDashboards('sales')).toEqual([]);
  expect(objects.get('dashboard').payload).toBe(JSON.stringify(original));
  expect(dbService.getDashboardReadIssues('sales')[0].message).toContain('storage failed');
  if(kind==='dashboard-layout-backup')expect(write).toHaveBeenCalledTimes(1);
});
