import {dbService} from './dbService';

const pending=new Map<string,Promise<unknown>>();
/** Serialize the whole read/modify/write, including readonly-sidecar configuration.
 * Web Locks extend the boundary to same-origin tabs; the queue also covers tests/older browsers.
 * All writers of a shared setting must use this function, not a stale caller-owned snapshot.
 */
export async function mutateDomainSetting<T>(key:string,catalog:string,mutate:(current:T|null)=>T):Promise<T> {
  const identity=JSON.stringify([catalog,key]);
  const run=async()=>{
    const apply=async()=>{const next=mutate(await dbService.getDomainSetting<T>(key,catalog));await dbService.saveDomainSetting(key,next,catalog);return next;};
    return typeof navigator!=='undefined' && navigator.locks?.request
      ? navigator.locks.request(`duckdb-studio:setting:${identity}`,apply) : apply();
  };
  const operation=(pending.get(identity) || Promise.resolve()).catch(()=>{}).then(run);
  pending.set(identity,operation);
  try{return await operation;}finally{if(pending.get(identity)===operation)pending.delete(identity);}
}
