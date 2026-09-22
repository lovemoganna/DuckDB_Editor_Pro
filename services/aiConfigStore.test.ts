import { describe, expect, it } from 'vitest';
import { AIConfigStore } from './aiConfigStore';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('AIConfigStore', () => {
  it('migrates a legacy persisted API key into session memory and deletes the persisted copy', () => {
    const storage = new MemoryStorage();
    storage.setItem('duckdb_ai_api_key', 'legacy-secret');

    const store = new AIConfigStore(storage);

    expect(store.getConfig().apiKey).toBe('legacy-secret');
    expect(storage.getItem('duckdb_ai_api_key')).toBeNull();
  });

  it('never persists API keys while retaining non-secret preferences', () => {
    const storage = new MemoryStorage();
    const store = new AIConfigStore(storage);

    store.setConfig({
      provider: 'openai',
      apiKey: 'session-secret',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
    });

    expect(store.getConfig()).toEqual({
      provider: 'openai',
      apiKey: 'session-secret',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
    });
    expect(storage.getItem('duckdb_ai_api_key')).toBeNull();
    expect(storage.getItem('duckdb_ai_provider')).toBe('openai');
    expect(storage.getItem('duckdb_ai_base_url')).toBe('https://api.openai.com/v1');
    expect(storage.getItem('duckdb_ai_model')).toBe('gpt-4o');
  });

  it('clears the in-memory secret without erasing provider preferences', () => {
    const storage = new MemoryStorage();
    const store = new AIConfigStore(storage);
    store.setConfig({ provider: 'claude', apiKey: 'temporary' });

    store.clearSecret();

    expect(store.getConfig().apiKey).toBe('');
    expect(store.getConfig().provider).toBe('claude');
  });

  it('supports ollama provider and retains its configuration', () => {
    const storage = new MemoryStorage();
    const store = new AIConfigStore(storage);
    store.setConfig({
      provider: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'llama3.2',
    });

    expect(store.getConfig()).toEqual({
      provider: 'ollama',
      apiKey: '',
      baseUrl: 'http://localhost:11434',
      model: 'llama3.2',
    });
    expect(storage.getItem('duckdb_ai_provider')).toBe('ollama');
    expect(storage.getItem('duckdb_ai_base_url')).toBe('http://localhost:11434');
    expect(storage.getItem('duckdb_ai_model')).toBe('llama3.2');
  });

  it('supports lmstudio provider and retains its configuration', () => {
    const storage = new MemoryStorage();
    const store = new AIConfigStore(storage);
    store.setConfig({
      provider: 'lmstudio',
      baseUrl: 'http://localhost:1234/v1',
    });

    expect(store.getConfig()).toEqual({
      provider: 'lmstudio',
      apiKey: '',
      baseUrl: 'http://localhost:1234/v1',
      model: 'qwen2.5-coder-7b-instruct',
    });
    expect(storage.getItem('duckdb_ai_provider')).toBe('lmstudio');
    expect(storage.getItem('duckdb_ai_base_url')).toBe('http://localhost:1234/v1');
    expect(storage.getItem('duckdb_ai_model')).toBe('qwen2.5-coder-7b-instruct');
  });
});
