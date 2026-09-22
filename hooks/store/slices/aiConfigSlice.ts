/**
 * slices/aiConfigSlice.ts — AI service configuration state
 */

import { aiConfigStore, AIProvider } from '../../../services/aiConfigStore';

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

export const createAIConfigSlice = (set: (partial: Partial<AIConfigSlice>) => void): AIConfigSlice => {
  const initial = aiConfigStore.getConfig();
  return {
    aiProvider: initial.provider,
    aiApiKey: initial.apiKey,
    aiBaseUrl: initial.baseUrl,
    aiModel: initial.model,

    setAiConfig: (config) => {
      const next = aiConfigStore.setConfig({
        ...config,
        provider: config.provider as AIProvider | undefined,
      });
      set({
        aiProvider: next.provider,
        aiApiKey: next.apiKey,
        aiBaseUrl: next.baseUrl,
        aiModel: next.model,
      });
    },

    availableModels: [],
    setAvailableModels: (models) => set({ availableModels: models }),
    loadingModels: false,
    setLoadingModels: (v) => set({ loadingModels: v }),
  };
};
