import {expect,it,vi} from 'vitest';
import {LatestTask} from './latestTask';
it('retains only the latest pending operation and clears it on unmount',async()=>{
  const queue=new LatestTask();let release!:()=>void;
  const first=queue.submit(()=>new Promise(resolve=>{release=resolve;}));
  const discarded=vi.fn(async()=>{}),latest=vi.fn(async()=>{});
  const a=queue.submit(discarded),b=queue.submit(latest);
  release();await Promise.all([first,a,b]);
  expect(discarded).not.toHaveBeenCalled();expect(latest).toHaveBeenCalledOnce();
  const next=queue.submit(()=>new Promise(resolve=>{release=resolve;}));
  const cleared=queue.submit(discarded);queue.clear();release();await Promise.all([next,cleared]);
  expect(discarded).not.toHaveBeenCalled();
});
