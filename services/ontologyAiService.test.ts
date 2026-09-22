// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ontologyAiService } from './ontologyAiService';
import { aiService } from './aiService';

describe('ontologyAiService with LM Studio and provider configurations', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('successfully generates graph layout when LM Studio is configured without an API key', async () => {
    localStorage.setItem('duckdb_ai_provider', 'lmstudio');
    localStorage.setItem('duckdb_ai_base_url', 'http://localhost:1234/v1');

    vi.spyOn(aiService, 'robustCall').mockResolvedValue({
      nodes: [
        { id: 'node_1', label: '用户', type: 'object', x: 100, y: 100, color: 'blue' },
        { id: 'node_2', label: '订单', type: 'object', x: 200, y: 200, color: 'green' },
      ],
      edges: [
        { source: 'node_1', target: 'node_2', label: '创建', weight: 0.8 },
      ],
      layoutAlgorithm: 'dagre',
    });

    const result = await ontologyAiService.generateGraphLayout('电商交易模型');

    expect(aiService.robustCall).toHaveBeenCalledWith(
      'ontology-graph-layout',
      expect.stringContaining('电商交易模型'),
      expect.any(String)
    );
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].label).toBe('创建');
  });

  it('throws helpful configuration error when cloud provider has no API key', async () => {
    localStorage.setItem('duckdb_ai_provider', 'google');
    localStorage.removeItem('duckdb_ai_api_key');

    await expect(ontologyAiService.generateGraphLayout('任何话题')).rejects.toThrow(
      'AI Provider not configured. Please set it in Settings.'
    );
  });

  it('falls back to rule-based suggestions when AI is not configured', async () => {
    localStorage.setItem('duckdb_ai_provider', 'openai');
    localStorage.removeItem('duckdb_ai_api_key');

    const suggestions = await ontologyAiService.generateSuggestions([], [], 0, 0);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].title).toBe('创建初始实体概念');
  });
});
