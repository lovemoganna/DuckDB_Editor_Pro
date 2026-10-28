import { openDB } from 'idb';

/** Durable browser-owned configuration for readonly data sources; never write source files. */
export interface StudioMetadataRecord { catalog:string; kind:string; id:string; payload:string; updated_at:number; deleted?:boolean }
async function database() {
  return openDB('DuckDBStudioReadonlyConfiguration', 1, {
    upgrade(db) { db.createObjectStore('objects', {keyPath:['catalog','kind','id']}); },
    blocking(_current, _blocked, event) { (event.target as IDBDatabase).close(); },
  });
}
export async function readSidecar(catalog:string, kind:string): Promise<StudioMetadataRecord[]> {
  const db = await database();
  try { return (await db.getAll('objects', IDBKeyRange.bound([catalog,kind,''],[catalog,kind,'\uffff']))); }
  finally { db.close(); }
}
export async function writeSidecar(record:StudioMetadataRecord): Promise<void> {
  const db = await database();
  try { const tx=db.transaction('objects','readwrite'); await Promise.all([tx.store.put(record),tx.done]); }
  finally { db.close(); }
}
