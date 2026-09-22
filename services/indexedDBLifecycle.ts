/**
 * IndexedDB sends `versionchange` before another context upgrades or deletes a
 * database. Closing here lets exact workspace restore replace app databases
 * without being blocked by idle connections retained by feature modules.
 */
export function closeDatabaseOnVersionChange(database: IDBDatabase): IDBDatabase {
  database.onversionchange = () => database.close();
  return database;
}
