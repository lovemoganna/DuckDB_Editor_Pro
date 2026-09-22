// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsModal } from './SettingsModal';
import { aiService } from '../services/aiService';

afterEach(cleanup);

describe('SettingsModal Ollama configuration', () => {
  it('supports selecting Ollama and sets default model and local base URL', async () => {
    const onSetAiProvider = vi.fn();
    const onSetAiModel = vi.fn();
    const onSetAiBaseUrl = vi.fn();
    const onSetAvailableModels = vi.fn();
    const onSetLoadingModels = vi.fn();
    const onNotify = vi.fn();

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        aiProvider="google"
        aiApiKey=""
        aiBaseUrl=""
        aiModel="gemini-2.0-flash-exp"
        availableModels={[]}
        loadingModels={false}
        onSetAiProvider={onSetAiProvider}
        onSetAiApiKey={vi.fn()}
        onSetAiBaseUrl={onSetAiBaseUrl}
        onSetAiModel={onSetAiModel}
        onSetAvailableModels={onSetAvailableModels}
        onSetLoadingModels={onSetLoadingModels}
        onNotify={onNotify}
      />
    );

    const providerSelect = screen.getAllByRole('combobox')[0];
    expect(screen.getByText(/Ollama \(Local \/ Self-hosted\)/i)).toBeTruthy();

    fireEvent.change(providerSelect, { target: { value: 'ollama' } });

    expect(onSetAiProvider).toHaveBeenCalledWith('ollama');
    expect(onSetAiModel).toHaveBeenCalledWith('llama3.2');
    expect(onSetAiBaseUrl).toHaveBeenCalledWith('http://localhost:11434');
  });

  it('allows refreshing models for Ollama without an API key', async () => {
    const onSetAvailableModels = vi.fn();
    const onNotify = vi.fn();

    vi.spyOn(aiService, 'fetchAvailableModels').mockResolvedValue([
      { id: 'deepseek-r1:8b', name: 'deepseek-r1:8b (4.9 GB)' },
    ]);

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        aiProvider="ollama"
        aiApiKey=""
        aiBaseUrl="http://localhost:11434"
        aiModel="llama3.2"
        availableModels={[
          { id: 'llama3.2', name: 'llama3.2' },
        ]}
        loadingModels={false}
        onSetAiProvider={vi.fn()}
        onSetAiApiKey={vi.fn()}
        onSetAiBaseUrl={vi.fn()}
        onSetAiModel={vi.fn()}
        onSetAvailableModels={onSetAvailableModels}
        onSetLoadingModels={vi.fn()}
        onNotify={onNotify}
      />
    );

    const refreshBtn = screen.getByTitle(/从本地 Ollama 刷新已安装的模型/i);
    expect(refreshBtn).not.toBeDisabled();

    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(aiService.fetchAvailableModels).toHaveBeenCalled();
      expect(onSetAvailableModels).toHaveBeenCalledWith([
        { id: 'deepseek-r1:8b', name: 'deepseek-r1:8b (4.9 GB)' },
      ]);
    });
  });

  it('performs connection diagnosis for Ollama', async () => {
    vi.spyOn(aiService, 'diagnoseConnection').mockResolvedValue({
      success: true,
      latencyMs: 88,
      modelCount: 2,
      models: [
        { id: 'llama3.2', name: 'llama3.2' },
        { id: 'qwen2.5-coder', name: 'qwen2.5-coder' },
      ],
      message: '已连接本地 Ollama (延迟: 88ms，已安装 2 个模型)',
    });

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        aiProvider="ollama"
        aiApiKey=""
        aiBaseUrl="http://localhost:11434"
        aiModel="llama3.2"
        availableModels={[]}
        loadingModels={false}
        onSetAiProvider={vi.fn()}
        onSetAiApiKey={vi.fn()}
        onSetAiBaseUrl={vi.fn()}
        onSetAiModel={vi.fn()}
        onSetAvailableModels={vi.fn()}
        onSetLoadingModels={vi.fn()}
        onNotify={vi.fn()}
      />
    );

    const testBtn = screen.getByRole('button', { name: /测试连接/i });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(screen.getByText(/● 已连接/i)).toBeTruthy();
      expect(screen.getByText(/已连接本地 Ollama/i)).toBeTruthy();
      expect(screen.getAllByText(/88ms/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('supports toggling API key visibility and using preset chips and reset endpoint', () => {
    const onSetAiModel = vi.fn();
    const onSetAiBaseUrl = vi.fn();

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        aiProvider="groq"
        aiApiKey="gsk_secret_123"
        aiBaseUrl="https://custom.groq.proxy/v1"
        aiModel="llama-3.3-70b-versatile"
        availableModels={[]}
        loadingModels={false}
        onSetAiProvider={vi.fn()}
        onSetAiApiKey={vi.fn()}
        onSetAiBaseUrl={onSetAiBaseUrl}
        onSetAiModel={onSetAiModel}
        onSetAvailableModels={vi.fn()}
        onSetLoadingModels={vi.fn()}
        onNotify={vi.fn()}
      />
    );

    // 1. Check API Key visibility toggle
    const apiKeyInput = screen.getByPlaceholderText(/gsk_\.\.\./i) as HTMLInputElement;
    expect(apiKeyInput.type).toBe('password');

    const toggleEyeBtn = screen.getByRole('button', { name: /显示明文 API Key/i });
    fireEvent.click(toggleEyeBtn);
    expect(apiKeyInput.type).toBe('text');

    // 2. Check reset base URL button
    const resetUrlBtn = screen.getByRole('button', { name: /恢复默认端点/i });
    fireEvent.click(resetUrlBtn);
    expect(onSetAiBaseUrl).toHaveBeenCalledWith('https://api.groq.com/openai/v1');

    // 3. Check popular model preset chips
    const chipBtn = screen.getByRole('button', { name: /DeepSeek R1 70B/i });
    fireEvent.click(chipBtn);
    expect(onSetAiModel).toHaveBeenCalledWith('deepseek-r1-distill-llama-70b');
  });

  it('supports selecting LM Studio and sets default model and local base URL', async () => {
    const onSetAiProvider = vi.fn();
    const onSetAiModel = vi.fn();
    const onSetAiBaseUrl = vi.fn();
    const onSetAvailableModels = vi.fn();
    const onSetLoadingModels = vi.fn();
    const onNotify = vi.fn();

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        aiProvider="google"
        aiApiKey=""
        aiBaseUrl=""
        aiModel="gemini-2.0-flash-exp"
        availableModels={[]}
        loadingModels={false}
        onSetAiProvider={onSetAiProvider}
        onSetAiApiKey={vi.fn()}
        onSetAiBaseUrl={onSetAiBaseUrl}
        onSetAiModel={onSetAiModel}
        onSetAvailableModels={onSetAvailableModels}
        onSetLoadingModels={onSetLoadingModels}
        onNotify={onNotify}
      />
    );

    const providerSelect = screen.getAllByRole('combobox')[0];
    expect(screen.getByText(/LM Studio \(Local \/ Self-hosted\)/i)).toBeTruthy();

    fireEvent.change(providerSelect, { target: { value: 'lmstudio' } });

    expect(onSetAiProvider).toHaveBeenCalledWith('lmstudio');
    expect(onSetAiModel).toHaveBeenCalledWith('qwen2.5-coder-7b-instruct');
    expect(onSetAiBaseUrl).toHaveBeenCalledWith('http://localhost:1234/v1');
  });

  it('allows connection diagnosis and refreshing models for LM Studio without an API key', async () => {
    const onSetAvailableModels = vi.fn();
    const onSetAiModel = vi.fn();
    const onNotify = vi.fn();

    vi.spyOn(aiService, 'diagnoseConnection').mockResolvedValue({
      success: true,
      latencyMs: 42,
      modelCount: 2,
      models: [
        { id: 'qwen2.5-coder-7b-instruct', name: 'qwen2.5-coder-7b-instruct (已加载)' },
        { id: 'deepseek-r1-distill-qwen-7b', name: 'deepseek-r1-distill-qwen-7b' },
      ],
      message: '已连接本地 LM Studio (延迟: 42ms，检测到 2 个可用模型)',
    });

    vi.spyOn(aiService, 'fetchAvailableModels').mockResolvedValue([
      { id: 'qwen2.5-coder-7b-instruct', name: 'qwen2.5-coder-7b-instruct (已加载)' },
      { id: 'deepseek-r1-distill-qwen-7b', name: 'deepseek-r1-distill-qwen-7b' },
    ]);

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        aiProvider="lmstudio"
        aiApiKey=""
        aiBaseUrl="http://localhost:1234/v1"
        aiModel="qwen2.5-coder-7b-instruct"
        availableModels={[]}
        loadingModels={false}
        onSetAiProvider={vi.fn()}
        onSetAiApiKey={vi.fn()}
        onSetAiBaseUrl={vi.fn()}
        onSetAiModel={onSetAiModel}
        onSetAvailableModels={onSetAvailableModels}
        onSetLoadingModels={vi.fn()}
        onNotify={onNotify}
      />
    );

    // Test connection button should be active without requiring API key
    const testBtn = screen.getByRole('button', { name: /测试连接/i });
    expect(testBtn).not.toBeDisabled();
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(screen.getByText(/● 已连接/i)).toBeTruthy();
      expect(screen.getByText(/已连接本地 LM Studio/i)).toBeTruthy();
      expect(screen.getAllByText(/42ms/i).length).toBeGreaterThanOrEqual(1);
    });

    // Refresh models button should be active without requiring API key
    const refreshBtn = screen.getByTitle(/从本地 LM Studio 刷新已加载\/可用模型/i);
    expect(refreshBtn).not.toBeDisabled();
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(aiService.fetchAvailableModels).toHaveBeenCalled();
      expect(onSetAvailableModels).toHaveBeenCalledWith([
        { id: 'qwen2.5-coder-7b-instruct', name: 'qwen2.5-coder-7b-instruct (已加载)' },
        { id: 'deepseek-r1-distill-qwen-7b', name: 'deepseek-r1-distill-qwen-7b' },
      ]);
    });
  });
});


