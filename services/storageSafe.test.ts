import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isQuotaExceededError,
  safeLocalStorageSet,
  safeLocalStorageGet,
  safeLocalStorageRemove,
  freeLocalStorageSpace,
  installGlobalStorageProtection,
  requestBrowserStoragePersistence
} from './storageSafe';

describe('storageSafe service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('detects various forms of QuotaExceededError', () => {
    expect(isQuotaExceededError({ name: 'QuotaExceededError' })).toBe(true);
    expect(isQuotaExceededError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    expect(isQuotaExceededError({ code: 22 })).toBe(true);
    expect(isQuotaExceededError({ message: 'The quota has been exceeded.' })).toBe(true);
    expect(isQuotaExceededError({ message: 'Other syntax error' })).toBe(false);
    expect(isQuotaExceededError(null)).toBe(false);
  });

  it('safely reads, writes, and removes items from localStorage', () => {
    const success = safeLocalStorageSet('test_key', 'hello_world');
    expect(success).toBe(true);
    expect(safeLocalStorageGet('test_key')).toBe('hello_world');
    expect(safeLocalStorageGet('non_existent', 'default')).toBe('default');

    safeLocalStorageRemove('test_key');
    expect(safeLocalStorageGet('test_key')).toBeNull();
  });

  it('frees ephemeral cache items when requested', () => {
    localStorage.setItem('duckdb_temp_data', 'temp_val');
    localStorage.setItem('duckdb_chart_cache_123', 'chart_val');
    localStorage.setItem('important_user_query', 'keep_me');

    const freed = freeLocalStorageSpace();
    expect(freed).toBeGreaterThanOrEqual(2);
    expect(localStorage.getItem('duckdb_temp_data')).toBeNull();
    expect(localStorage.getItem('duckdb_chart_cache_123')).toBeNull();
    expect(localStorage.getItem('important_user_query')).toBe('keep_me');
  });

  it('evicts ephemeral items and retries on QuotaExceededError in safeLocalStorageSet', () => {
    localStorage.setItem('duckdb_temp_old', 'junk');

    let calls = 0;
    const originalSetItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      calls++;
      if (calls === 1 && k === 'new_target_key') {
        const err = new Error('Quota exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      }
      return originalSetItem(k, v);
    });

    const result = safeLocalStorageSet('new_target_key', 'val');
    expect(result).toBe(true);
    expect(localStorage.getItem('new_target_key')).toBe('val');
  });

  it('queries navigator.storage.persist and estimate', async () => {
    const mockPersist = vi.fn().mockResolvedValue(true);
    const mockPersisted = vi.fn().mockResolvedValue(false);
    const mockEstimate = vi.fn().mockResolvedValue({ quota: 1000000, usage: 250000 });

    Object.defineProperty(navigator, 'storage', {
      value: {
        persist: mockPersist,
        persisted: mockPersisted,
        estimate: mockEstimate
      },
      configurable: true
    });

    const status = await requestBrowserStoragePersistence();
    expect(status.persistenceRequested).toBe(true);
    expect(status.isPersisted).toBe(true);
    expect(status.quotaBytes).toBe(1000000);
    expect(status.usagePercent).toBe(25);
  });
});
