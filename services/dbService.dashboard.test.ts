import { afterEach, describe, expect, it, vi } from 'vitest';
import { dbService } from './dbService';
import type { Dashboard } from '../types';

const initial: Dashboard = {id:'view',databaseName:'sales',name:'view',createdAt:1,updatedAt:1,
  items:[{i:'a',savedQueryId:'q',x:0,y:0,w:4,h:3}]};
afterEach(() => vi.restoreAllMocks());

describe('persisted dashboard edits', () => {
  it('serializes delayed writes and merges independent edits against the last successful save', async () => {
    let stored = structuredClone(initial);
    let release!: () => void;
    const firstWrite = new Promise<void>(resolve => {release=resolve;});
    vi.spyOn(dbService as any, 'readDashboards').mockImplementation(async()=>[structuredClone(stored)]);
    const write = vi.spyOn(dbService as any, 'putObject').mockImplementation(async (_kind: unknown, next: any) => {
      if (next.name==='renamed') await firstWrite;
      stored=structuredClone(next);
    });
    const first = dbService.updateDashboard('view','sales',board=>({...board,name:'renamed'}));
    const second = dbService.updateDashboard('view','sales',board=>({...board,items:board.items.map(item=>({...item,x:5}))}));
    await vi.waitFor(()=>expect(write).toHaveBeenCalledTimes(1));
    release();
    await Promise.all([first,second]);
    expect(stored.name).toBe('renamed');
    expect(stored.items[0].x).toBe(5);
  });

  it('recovers from a failed save without applying that edit to the next operation', async () => {
    let stored=structuredClone(initial);
    vi.spyOn(dbService as any,'readDashboards').mockImplementation(async()=>[structuredClone(stored)]);
    vi.spyOn(dbService as any,'putObject').mockRejectedValueOnce(new Error('disk unavailable'))
      .mockImplementation(async (_kind: unknown,next:any)=>{stored=structuredClone(next);});
    const failed=dbService.updateDashboard('view','sales',board=>({...board,name:'lost'}));
    const next=dbService.updateDashboard('view','sales',board=>({...board,layoutLocked:true}));
    await expect(failed).rejects.toThrow('disk unavailable');
    await next;
    expect(stored.name).toBe('view');
    expect(stored.layoutLocked).toBe(true);
  });

  it('does not resurrect a deleted view or write into another catalog', async () => {
    const write=vi.spyOn(dbService as any,'putObject');
    const read=vi.spyOn(dbService as any,'readDashboards').mockResolvedValue([]);
    await expect(dbService.updateDashboard('view','sales',board=>board)).rejects.toThrow('已不存在');
    read.mockResolvedValue([initial]);
    await expect(dbService.updateDashboard('view','sales',board=>({...board,databaseName:'other'}))).rejects.toThrow('身份');
    expect(write).not.toHaveBeenCalled();
  });
});
