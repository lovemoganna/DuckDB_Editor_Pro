/**
 * slices/aiConfigSlice.ts — AI service configuration state
 */

export interface AIConfigSlice {
  aiProvider: string;
  aiApiKey: string;
  aiBaseUrl: string;
  aiModel: string;
  setAiConfig: (config: { provider?: string; apiKey?: string; baseUrl?: string; model?: string }) => void;

  availableModels: { id: string; name: string }[];
  setAvailableModels: (models: { id: string; name: string }[]) => void;
  loadingModels: boolean;
  setLoadingModels: (v: boolean) => void;
}

function load(key: string, fallback: string): string {
  return localStorage.getItem(key) ?? fallback;
}

function persist(key: string, value: string): void {
  localStorage.setItem(key, value);
}

export const createAIConfigSlice = (set: (partial: Partial<AIConfigSlice>) => void): AIConfigSlice => ({
  aiProvider: load('duckdb_ai_provider', 'google'),
  aiApiKey: load('duckdb_ai_api_key', ''),
  aiBaseUrl: load('duckdb_ai_base_url', ''),
  aiModel: load('duckdb_ai_model', 'gemini-2.0-flash-exp'),

  setAiConfig: (config) => {
    const next: Partial<AIConfigSlice> = {};

    if (config.provider !== undefined) {
      persist('duckdb_ai_provider', config.provider);
      next.aiProvider = config.provider;

      // Auto-set default model per provider
      if (config.model === undefined) {
        const defaultModel = config.provider === 'google'
          ? 'gemini-2.0-flash-exp'
          : 'llama-3.3-70b-versatile';
        persist('duckdb_ai_model', defaultModel);
        next.aiModel = defaultModel;
      }
    }
    if (config.apiKey !== undefined) {
      persist('duckdb_ai_api_key', config.apiKey);
      next.aiApiKey = config.apiKey;
    }
    if (config.baseUrl !== undefined) {
      persist('duckdb_ai_base_url', config.baseUrl);
      next.aiBaseUrl = config.baseUrl;
    }
    if (config.model !== undefined) {
      persist('duckdb_ai_model', config.model);
      next.aiModel = config.model;
    }

    set(next);
  },

  availableModels: [],
  setAvailableModels: (models) => set({ availableModels: models }),
  loadingModels: false,
  setLoadingModels: (v) => set({ loadingModels: v }),
});
