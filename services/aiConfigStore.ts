export type AIProvider = 'google' | 'groq' | 'openai' | 'claude' | 'ollama' | 'lmstudio';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export type AIConfigUpdate = Partial<AIConfig>;

const STORAGE_KEYS = {
  provider: 'duckdb_ai_provider',
  legacyApiKey: 'duckdb_ai_api_key',
  baseUrl: 'duckdb_ai_base_url',
  model: 'duckdb_ai_model',
} as const;

const DEFAULT_MODELS: Record<AIProvider, string> = {
  google: 'gemini-2.0-flash-exp',
  groq: 'llama-3.3-70b-versatile',
  openai: 'gpt-4o',
  claude: 'claude-sonnet-4-20250514',
  ollama: 'llama3.2',
  lmstudio: 'qwen2.5-coder-7b-instruct',
};

function isProvider(value: string | null): value is AIProvider {
  return value === 'google' || value === 'groq' || value === 'openai' || value === 'claude' || value === 'ollama' || value === 'lmstudio';
}

function browserStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Keeps credentials in this page's JavaScript memory only.
 *
 * Provider, endpoint, and model are preferences and remain durable. A key left
 * by older releases is consumed once for the current page and immediately
 * removed from localStorage.
 */
export class AIConfigStore {
  private apiKey = '';

  constructor(private readonly storage: Storage | undefined = browserStorage()) {
    this.apiKey = this.read(STORAGE_KEYS.legacyApiKey) ?? '';
    this.remove(STORAGE_KEYS.legacyApiKey);
  }

  getConfig(): AIConfig {
    const storedProvider = this.read(STORAGE_KEYS.provider);
    const provider = isProvider(storedProvider) ? storedProvider : 'google';

    return {
      provider,
      apiKey: this.apiKey,
      baseUrl: this.read(STORAGE_KEYS.baseUrl) ?? '',
      model: this.read(STORAGE_KEYS.model) ?? DEFAULT_MODELS[provider],
    };
  }

  setConfig(update: AIConfigUpdate): AIConfig {
    const before = this.getConfig();
    const provider = update.provider ?? before.provider;

    if (update.provider !== undefined) {
      this.write(STORAGE_KEYS.provider, provider);
      if (update.model === undefined) {
        this.write(STORAGE_KEYS.model, DEFAULT_MODELS[provider]);
      }
    }
    if (update.apiKey !== undefined) {
      this.apiKey = update.apiKey;
      this.remove(STORAGE_KEYS.legacyApiKey);
    }
    if (update.baseUrl !== undefined) {
      this.write(STORAGE_KEYS.baseUrl, update.baseUrl);
    }
    if (update.model !== undefined) {
      this.write(STORAGE_KEYS.model, update.model);
    }

    return this.getConfig();
  }

  clearSecret(): void {
    this.apiKey = '';
    this.remove(STORAGE_KEYS.legacyApiKey);
  }

  private read(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      this.storage?.setItem(key, value);
    } catch {
      // Preferences are best-effort; credentials remain memory-only either way.
    }
  }

  private remove(key: string): void {
    try {
      this.storage?.removeItem(key);
    } catch {
      // A blocked storage backend must not prevent in-memory configuration.
    }
  }
}

export const aiConfigStore = new AIConfigStore();
