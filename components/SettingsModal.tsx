/**
 * SettingsModal - Workspace Settings Dialog
 * 
 * AI configuration, backup/restore workspace settings.
 * Extracted from App.tsx (formerly lines 609-790 + handleExportWorkspace/handleImportWorkspace).
 */

import React, { useState } from 'react';
import { aiService } from '../services/aiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // AI Config — all lifted state
  aiProvider: string;
  aiApiKey: string;
  aiBaseUrl: string;
  aiModel: string;
  availableModels: { id: string; name: string }[];
  loadingModels: boolean;
  onSetAiProvider: (v: string) => void;
  onSetAiApiKey: (v: string) => void;
  onSetAiBaseUrl: (v: string) => void;
  onSetAiModel: (v: string) => void;
  onSetAvailableModels: (v: { id: string; name: string }[]) => void;
  onSetLoadingModels: (v: boolean) => void;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
  onExportWorkspace: () => void;
  onImportWorkspace: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  aiProvider,
  aiApiKey,
  aiBaseUrl,
  aiModel,
  availableModels,
  loadingModels,
  onSetAiProvider,
  onSetAiApiKey,
  onSetAiBaseUrl,
  onSetAiModel,
  onSetAvailableModels,
  onSetLoadingModels,
  onNotify,
  onExportWorkspace,
  onImportWorkspace,
}) => {
  const handleProviderChange = (newProvider: string) => {
    onSetAiProvider(newProvider);
    localStorage.setItem('duckdb_ai_provider', newProvider);

    let defaultModel = '';
    let defaultBaseUrl = '';
    if (newProvider === 'groq') {
      defaultModel = 'llama-3.3-70b-versatile';
      defaultBaseUrl = 'https://api.groq.com/openai/v1';
    } else if (newProvider === 'google') {
      defaultModel = 'gemini-2.0-flash-exp';
    } else if (newProvider === 'claude') {
      defaultModel = 'claude-sonnet-4-20250514';
    }
    if (defaultModel) {
      onSetAiModel(defaultModel);
      localStorage.setItem('duckdb_ai_model', defaultModel);
    }
    if (defaultBaseUrl) {
      onSetAiBaseUrl(defaultBaseUrl);
      localStorage.setItem('duckdb_ai_base_url', defaultBaseUrl);
    }
  };

  const handleRefreshModels = async () => {
    if (!aiApiKey.trim()) {
      onNotify('Please save your API key first.', 'error');
      return;
    }
    localStorage.setItem('duckdb_ai_api_key', aiApiKey);
    localStorage.setItem('duckdb_ai_provider', aiProvider);
    if (aiBaseUrl) localStorage.setItem('duckdb_ai_base_url', aiBaseUrl);
    onSetLoadingModels(true);
    try {
      const models = await aiService.fetchAvailableModels();
      onSetAvailableModels(models);
      if (models.length > 0 && !models.find(m => m.id === aiModel)) {
        onSetAiModel(models[0].id);
        localStorage.setItem('duckdb_ai_model', models[0].id);
      }
      onNotify(`Loaded ${models.length} models`, 'success');
    } catch (err: any) {
      onNotify(`Failed to fetch models: ${err.message}`, 'error');
    } finally {
      onSetLoadingModels(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-md animate-[fadeIn_0.2s]"
      onClick={onClose}
    >
      <div
        className="bg-monokai-bg border border-monokai-accent p-6 rounded shadow-2xl w-full max-w-lg animate-[slideIn_0.2s_ease-out] flex flex-col max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4 text-monokai-yellow flex items-center gap-2">
          <span>⚙️</span> Workspace Settings
        </h2>

        <div className="space-y-6">
          {/* AI Configuration */}
          <div className="bg-monokai-bg p-4 rounded border border-monokai-accent">
            <h3 className="text-sm font-bold text-monokai-fg mb-2">🤖 AI Configuration</h3>
            <p className="text-xs text-monokai-comment mb-4">
              Configure your AI provider for SQL generation and schema analysis.
            </p>

            <div className="space-y-4">
              {/* Provider */}
              <div>
                <label className="block text-xs font-medium text-monokai-comment mb-1">AI Provider</label>
                <select
                  value={aiProvider}
                  onChange={e => handleProviderChange(e.target.value)}
                  className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent rounded text-sm text-monokai-fg focus:outline-none focus:ring-1 focus:ring-monokai-blue"
                >
                  <option value="google">Google Gemini (Default)</option>
                  <option value="groq">Groq (Fastest)</option>
                  <option value="openai">OpenAI / Compatible</option>
                  <option value="claude">Anthropic Claude</option>
                </select>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-xs font-medium text-monokai-comment mb-1">API Key</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={aiApiKey}
                    onChange={e => onSetAiApiKey(e.target.value)}
                    placeholder={`Enter your ${aiProvider} API key...`}
                    className="flex-1 px-3 py-2 bg-monokai-sidebar border border-monokai-accent rounded text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:ring-1 focus:ring-monokai-blue"
                  />
                  <button
                    onClick={() => {
                      localStorage.setItem('duckdb_ai_api_key', aiApiKey);
                      onNotify('API key saved!', 'success');
                    }}
                    className="px-3 py-2 bg-monokai-blue hover:bg-monokai-blue/80 transition-colors text-white font-bold rounded text-sm"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-xs font-medium text-monokai-comment mb-1">
                  Base URL {aiProvider === 'google' ? '(Optional)' : '(Required for Custom/Groq/Claude)'}
                </label>
                <input
                  type="text"
                  value={aiBaseUrl}
                  onChange={e => {
                    onSetAiBaseUrl(e.target.value);
                    localStorage.setItem('duckdb_ai_base_url', e.target.value);
                  }}
                  placeholder={aiProvider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1'}
                  className="w-full px-3 py-2 bg-monokai-sidebar border border-monokai-accent rounded text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:ring-1 focus:ring-monokai-blue"
                />
              </div>

              {/* Model */}
              <div>
                <label className="block text-xs font-medium text-monokai-comment mb-1">AI Model</label>
                <div className="flex gap-2">
                  <select
                    value={aiModel}
                    onChange={e => {
                      onSetAiModel(e.target.value);
                      localStorage.setItem('duckdb_ai_model', e.target.value);
                    }}
                    disabled={loadingModels}
                    className="flex-1 px-3 py-2 bg-monokai-sidebar border border-monokai-accent rounded text-sm text-monokai-fg appearance-none focus:outline-none focus:ring-1 focus:ring-monokai-blue disabled:opacity-50"
                  >
                    {availableModels.length === 0 && (
                      <option value={aiModel}>{aiModel || 'Click Refresh to load models...'}</option>
                    )}
                    {availableModels.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleRefreshModels}
                    disabled={loadingModels || !aiApiKey.trim()}
                    className="px-3 py-2 bg-monokai-green hover:bg-monokai-green/80 transition-colors text-monokai-bg font-bold rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingModels ? '⏳' : '🔄'}
                  </button>
                </div>
                <p className="text-[10px] text-monokai-comment mt-1">
                  {availableModels.length > 0
                    ? `✓ ${availableModels.length} models available`
                    : 'Click 🔄 to fetch available models from your provider.'}
                </p>
              </div>
            </div>
          </div>

          {/* Backup */}
          <div className="bg-monokai-bg p-4 rounded border border-monokai-accent">
            <h3 className="text-sm font-bold text-monokai-fg mb-2">Backup Workspace</h3>
            <p className="text-xs text-monokai-comment mb-3">
              Export your query history and saved queries to a JSON file.
            </p>
            <button
              onClick={onExportWorkspace}
              className="w-full py-2 bg-monokai-accent hover:bg-monokai-blue hover:text-monokai-bg transition-colors text-monokai-blue font-bold rounded text-sm"
            >
              📤 Download Backup
            </button>
          </div>

          {/* Restore */}
          <div className="bg-monokai-bg p-4 rounded border border-monokai-accent">
            <h3 className="text-sm font-bold text-monokai-fg mb-2">Restore Workspace</h3>
            <p className="text-xs text-monokai-comment mb-3">
              Restore settings from a backup file. <strong className="text-monokai-pink">Warning: Overwrites history.</strong>
            </p>
            <label className="block w-full py-2 bg-monokai-green/20 hover:bg-monokai-green/40 border border-monokai-green/50 hover:border-monokai-green transition-colors text-monokai-green font-bold rounded text-sm text-center cursor-pointer">
              📥 Upload Backup File
              <input type="file" accept=".json" onChange={onImportWorkspace} className="hidden" />
            </label>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded text-sm bg-monokai-accent hover:text-white">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
