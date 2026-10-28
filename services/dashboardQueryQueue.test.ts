import {afterEach,expect,it,vi} from 'vitest';
import {duckDBService} from './duckdbService';
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});
function connection() {
  const prepared={query:vi.fn(async()=>({toArray:()=>[]})),close:vi.fn(async()=>{})};
  const conn={prepare:vi.fn(async()=>prepared)};
  Object.assign(duckDBService,{conn,isInitialized:true,initPromise:Promise.resolve(),queryQueue:Promise.resolve()});
  return {conn,prepared};
}
it('skips invalidated queued reads without preparing SQL',async()=>{
  const {conn}=connection();let release!:()=>void;
  (duckDBService as any).queryQueue=new Promise(resolve=>{release=resolve;});
  let current=true;
  const pending=duckDBService.readQueryBatchWithParams([{sql:'SELECT 1',params:[]}],{isCurrent:()=>current});
  const rejected=expect(pending).rejects.toMatchObject({name:'AbortError'});
  current=false;release();await rejected;expect(conn.prepare).not.toHaveBeenCalled();
});
it('a UI timeout never releases the connection or declares physical completion',async()=>{
  vi.useFakeTimers();const {conn,prepared}=connection();let release!:(value:any)=>void;
  prepared.query.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  let completed=false;
  const first=duckDBService.readQueryBatchWithParams([{sql:'SELECT 1',params:[]}],{onExecutionScheduled:done=>{void done.then(()=>{completed=true;});}});
  const timeout=expect(first).rejects.toThrow('25s');
  await vi.advanceTimersByTimeAsync(1);
  const second=duckDBService.readQueryBatchWithParams([{sql:'SELECT 2',params:[]}]);
  const secondTimeout=expect(second).rejects.toThrow('25s');
  await vi.advanceTimersByTimeAsync(25001);await Promise.all([timeout,secondTimeout]);
  expect(conn.prepare).toHaveBeenCalledTimes(1);expect(completed).toBe(false);
  release({toArray:()=>[]});await (duckDBService as any).queryQueue;
  expect(completed).toBe(true);expect(conn.prepare).toHaveBeenCalledTimes(2);
});
