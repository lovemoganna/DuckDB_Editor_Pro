/**
 * Storage Protection & Browser Persistence Service
 *
 * Provides:
 * 1. Safe localStorage access preventing uncaught QuotaExceededError crashes.
 * 2. Automatic eviction of non-critical ephemeral caches when quota is reached.
 * 3. Global transparent patch for `localStorage.setItem`.
 * 4. Browser Persistent Storage request (`navigator.storage.persist()`) preventing
 *    silent browser evictions of OPFS / IndexedDB DuckDB tables.
 */

export interface StorageStatus {
  isPersisted: boolean;
  quotaBytes?: number;
  usageBytes?: number;
  usagePercent?: number;
  persistenceRequested: boolean;
}

// Low-priority prefix list for quota-exceeded eviction
const EPHEMERAL_KEY_PREFIXES = [
  'duckdb_temp_',
  'duckdb_chart_cache_',
  'duckdb_query_logs',
  'copilot_cache_',
  'editor_undo_cache_'
];

/**
 * Checks if an error is a QuotaExceededError across different browsers
 */
export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: number; message?: string };
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014 ||
    (typeof e.message === 'string' && /quota|exceeded/i.test(e.message))
  );
}

/**
 * Clean up ephemeral caches to free up localStorage space
 */
export function freeLocalStorageSpace(): number {
  if (typeof window === 'undefined' || !window.localStorage) return 0;
  let freedCount = 0;

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && EPHEMERAL_KEY_PREFIXES.some(prefix => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
      freedCount++;
    }

    // If still tight, trim recent queries list to 10
    const recentQueriesKey = 'duckdb_recent_queries_v1';
    const recentQueriesRaw = window.localStorage.getItem(recentQueriesKey);
    if (recentQueriesRaw) {
      try {
        const parsed = JSON.parse(recentQueriesRaw);
        if (Array.isArray(parsed) && parsed.length > 10) {
          window.localStorage.setItem(recentQueriesKey, JSON.stringify(parsed.slice(0, 10)));
          freedCount++;
        }
      } catch {
        window.localStorage.removeItem(recentQueriesKey);
        freedCount++;
      }
    }
  } catch (e) {
    console.warn('[StorageSafe] Error while freeing storage space:', e);
  }

  return freedCount;
}

/**
 * Safely writes to localStorage without crashing the application on quota errors
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.warn(`[StorageSafe] LocalStorage Quota Exceeded on key "${key}". Attempting cache eviction...`);
      const freed = freeLocalStorageSpace();
      if (freed > 0) {
        try {
          window.localStorage.setItem(key, value);
          console.info(`[StorageSafe] Persisted "${key}" after evicting ${freed} ephemeral storage items.`);
          return true;
        } catch (retryErr) {
          console.error(`[StorageSafe] Still unable to write key "${key}" after eviction.`, retryErr);
        }
      }
      
      // Dispatch storage warning event for UI notification
      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(
          new CustomEvent('duckdb-storage-quota-warning', {
            detail: { key, error: String(err) }
          })
        );
      }
      return false;
    }
    console.error(`[StorageSafe] Unexpected error setting localStorage key "${key}":`, err);
    return false;
  }
}

/**
 * Safely reads from localStorage
 */
export function safeLocalStorageGet<T = string>(key: string, defaultValue: T | null = null): T | null {
  if (typeof window === 'undefined' || !window.localStorage) return defaultValue;

  try {
    const val = window.localStorage.getItem(key);
    if (val === null) return defaultValue;
    return val as unknown as T;
  } catch (err) {
    console.warn(`[StorageSafe] Failed to read localStorage key "${key}":`, err);
    return defaultValue;
  }
}

/**
 * Safely removes a key from localStorage
 */
export function safeLocalStorageRemove(key: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (err) {
    console.warn(`[StorageSafe] Failed to remove localStorage key "${key}":`, err);
    return false;
  }
}

let isProtectionInitialized = false;

/**
 * Installs transparent protection on window.localStorage.setItem
 * to prevent unhandled QuotaExceededError across the entire project
 */
export function installGlobalStorageProtection(): void {
  if (isProtectionInitialized || typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const storageProto = Object.getPrototypeOf(window.localStorage);
    if (storageProto && typeof storageProto.setItem === 'function') {
      const originalSetItem = storageProto.setItem;
      storageProto.setItem = function (this: Storage, key: string, value: string) {
        try {
          originalSetItem.call(this, key, value);
        } catch (err) {
          if (isQuotaExceededError(err)) {
            console.warn(`[StorageSafe] Intercepted QuotaExceededError for "${key}". Attempting recovery.`);
            const freed = freeLocalStorageSpace();
            if (freed > 0) {
              try {
                originalSetItem.call(this, key, value);
                return;
              } catch {
                // Ignore secondary failure
              }
            }
            if (typeof window.dispatchEvent === 'function') {
              window.dispatchEvent(
                new CustomEvent('duckdb-storage-quota-warning', {
                  detail: { key, error: String(err) }
                })
              );
            }
            return;
          }
          throw err;
        }
      };
      isProtectionInitialized = true;
      console.log('[StorageSafe] Global localStorage protection installed.');
    }
  } catch (e) {
    console.warn('[StorageSafe] Could not patch localStorage prototype:', e);
  }
}

// Auto-install on module import in browser
if (typeof window !== 'undefined' && window.localStorage) {
  installGlobalStorageProtection();
}

/**
 * Requests browser persistent storage (navigator.storage.persist())
 * to guarantee that IndexedDB and OPFS databases are not automatically
 * purged by the browser during low disk space situations.
 */
export async function requestBrowserStoragePersistence(): Promise<StorageStatus> {
  const result: StorageStatus = {
    isPersisted: false,
    persistenceRequested: false
  };

  if (typeof navigator === 'undefined' || !navigator.storage) {
    return result;
  }

  try {
    // 1. Check if already persisted
    if (navigator.storage.persisted) {
      result.isPersisted = await navigator.storage.persisted();
    }

    // 2. If not persisted, request persistence
    if (!result.isPersisted && navigator.storage.persist) {
      result.persistenceRequested = true;
      result.isPersisted = await navigator.storage.persist();
      if (result.isPersisted) {
        console.log('[StorageSafe] Browser persistent storage granted.');
      } else {
        console.info('[StorageSafe] Persistent storage requested but not granted (best-effort storage active).');
      }
    }

    // 3. Query storage quota and usage
    if (navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      result.quotaBytes = estimate.quota;
      result.usageBytes = estimate.usage;
      if (estimate.quota && estimate.quota > 0 && estimate.usage !== undefined) {
        result.usagePercent = Math.round((estimate.usage / estimate.quota) * 1000) / 10;
      }
    }
  } catch (err) {
    console.warn('[StorageSafe] Error querying/requesting storage persistence:', err);
  }

  return result;
}
