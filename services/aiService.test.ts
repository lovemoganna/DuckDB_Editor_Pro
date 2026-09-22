// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiService } from './aiService';

describe('aiService LM Studio provider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('diagnoses LM Studio connection successfully and lists models', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'qwen2.5-coder-7b-instruct', state: 'loaded' },
          { id: 'deepseek-r1-distill-qwen-7b', state: 'not-loaded' },
        ],
      }),
    } as any);

    const result = await aiService.diagnoseConnection({
      provider: 'lmstudio',
      baseUrl: 'http://localhost:1234/v1',
    });

    expect(result.success).toBe(true);
    expect(result.modelCount).toBe(2);
    expect(result.models).toEqual([
      { id: 'qwen2.5-coder-7b-instruct', name: 'qwen2.5-coder-7b-instruct (已加载)' },
      { id: 'deepseek-r1-distill-qwen-7b', name: 'deepseek-r1-distill-qwen-7b' },
    ]);
    expect(result.message).toContain('已连接本地 LM Studio');
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:1234/v1/models', expect.any(Object));
  });

  it('returns service_not_running error when LM Studio cannot be reached', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await aiService.diagnoseConnection({
      provider: 'lmstudio',
      baseUrl: 'http://localhost:1234/v1',
    });

    expect(result.success).toBe(false);
    expect(result.errorCategory).toBe('service_not_running');
    expect(result.message).toContain('LM Studio 本地服务未启动或无法访问');
  });

  it('fetches available models from LM Studio and handles fallbacks', async () => {
    localStorage.setItem('duckdb_ai_provider', 'lmstudio');
    localStorage.setItem('duckdb_ai_base_url', 'http://localhost:1234/v1');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'qwen2.5-coder-7b-instruct', state: 'loaded' },
        ],
      }),
    } as any);

    const models = await aiService.fetchAvailableModels();
    expect(models).toEqual([
      { id: 'qwen2.5-coder-7b-instruct', name: 'qwen2.5-coder-7b-instruct (已加载)' },
    ]);
  });

  it('omits response_format: json_object for LM Studio provider calls', async () => {
    localStorage.setItem('duckdb_ai_provider', 'lmstudio');
    localStorage.setItem('duckdb_ai_base_url', 'http://localhost:1234/v1');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ recommendedIntent: 'exploration' }),
            },
          },
        ],
      }),
    } as any);

    const result = await aiService.robustCall<{ recommendedIntent: string }>('probe', 'analyze data', undefined, true);
    expect(result.recommendedIntent).toBe('exploration');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:1234/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        body: expect.not.stringContaining('"response_format":{"type":"json_object"}'),
      })
    );
  });

  it('correctly extracts string error message from provider when error is not an object', async () => {
    localStorage.setItem('duckdb_ai_provider', 'lmstudio');
    localStorage.setItem('duckdb_ai_base_url', 'http://localhost:1234/v1');

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        error: "'response_format.type' must be 'json_schema' or 'text'",
      }),
    } as any);

    await expect(
      aiService.robustCall('probe', 'test', undefined, true, 0)
    ).rejects.toThrow("AI Provider Error (400): 'response_format.type' must be 'json_schema' or 'text'");
  });

  it('retries without response_format if provider returns 400 Bad Request on OpenAI endpoint', async () => {
    localStorage.setItem('duckdb_ai_provider', 'openai');
    localStorage.setItem('duckdb_ai_api_key', 'test-key');

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (_url, options) => {
      callCount++;
      const body = JSON.parse(options.body);
      if (body.response_format) {
        return {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: async () => ({ error: 'Unsupported response_format' }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ recommendedIntent: 'reporting' }),
              },
            },
          ],
        }),
      };
    });

    const result = await aiService.robustCall<{ recommendedIntent: string }>('probe', 'test', undefined, true, 0);
    expect(result.recommendedIntent).toBe('reporting');
    expect(callCount).toBe(2);
  });
});

describe('aiService.profileColumn / profileColumns — Workbench AI Column Profiling', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // 配置一个最小可用的 fake 配置 — 走 fetch 链路 (lmstudio) 才能用 global.fetch mock
  const configureAI = () => {
    localStorage.setItem('duckdb_ai_provider', 'lmstudio');
    localStorage.setItem('duckdb_ai_base_url', 'http://localhost:1234/v1');
  };

  // 列画像样本数据
  const sampleColumnData = {
    columnType: 'VARCHAR',
    isNumeric: false,
    isDate: false,
    totalRows: 1000,
    nullCount: 5,
    nullPct: '0.50%',
    distinctCount: 320,
    distinctPct: '32.00%',
    topValues: [
      { value: '北京', count: 120, pct: '12.00%' },
      { value: '上海', count: 110, pct: '11.00%' },
    ],
    sampleValues: ['北京', '上海', '广州'],
  };

  // ─── profileColumn 守卫逻辑 ─────────────────────────────────
  it('profileColumn throws friendly error when AI is not configured', async () => {
    // 清空所有配置，AI 处于未配置状态
    await expect(
      aiService.profileColumn('city', sampleColumnData)
    ).rejects.toThrow('尚未配置 AI 服务');
  });

  it('profileColumn throws when columnName is empty', async () => {
    configureAI();
    await expect(
      aiService.profileColumn('', sampleColumnData)
    ).rejects.toThrow();
  });

  it('profileColumn returns ColumnAiProfile on success and injects columnName', async () => {
    configureAI();
    const mockPayload = {
      semanticType: 'dimension',
      businessMeaning: '用户所在城市',
      usageHints: ['GROUP BY city', 'WHERE city = ?'],
      qualityRisks: [{ severity: 'LOW', title: '少量空值', detail: '约 0.5% 行缺失' }],
      suggestedActions: ['考虑建立索引'],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(mockPayload) } }],
      }),
    } as any);

    const result = await aiService.profileColumn('city', sampleColumnData);
    expect(result.columnName).toBe('city'); // 注入 columnName
    expect(result.semanticType).toBe('dimension');
    expect(result.businessMeaning).toBe('用户所在城市');
    expect(result.usageHints).toHaveLength(2);
    expect(result.qualityRisks).toHaveLength(1);
    expect(result.suggestedActions).toHaveLength(1);
  });

  // ─── profileColumns 守卫逻辑 ──────────────────────────────
  it('profileColumns throws friendly error when AI is not configured', async () => {
    await expect(
      aiService.profileColumns([{ columnName: 'city', data: sampleColumnData }])
    ).rejects.toThrow('尚未配置 AI 服务');
  });

  it('profileColumns throws when columns array is empty', async () => {
    configureAI();
    await expect(
      aiService.profileColumns([])
    ).rejects.toThrow('没有需要分析的列');
  });

  it('profileColumns throws when columns count exceeds MAX_BATCH (8)', async () => {
    configureAI();
    const tooMany = Array.from({ length: 9 }, (_, i) => ({
      columnName: `col_${i}`,
      data: sampleColumnData,
    }));
    await expect(
      aiService.profileColumns(tooMany)
    ).rejects.toThrow(/最多支持 8 列/);
  });

  it('profileColumns accepts up to 8 columns and returns profiles + overallSummary', async () => {
    configureAI();
    const mockPayload = {
      overallSummary: '整体为电商订单快照，包含 3 个维度列与 1 个度量列',
      profiles: [
        {
          columnName: 'city',
          semanticType: 'dimension',
          businessMeaning: '用户城市',
          usageHints: ['GROUP BY city'],
          qualityRisks: [],
          suggestedActions: [],
        },
        {
          columnName: 'amount',
          semanticType: 'measure',
          businessMeaning: '订单金额',
          usageHints: ['SUM(amount)'],
          qualityRisks: [],
          suggestedActions: [],
        },
      ],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(mockPayload) } }],
      }),
    } as any);

    const result = await aiService.profileColumns([
      { columnName: 'city', data: sampleColumnData },
      { columnName: 'amount', data: { ...sampleColumnData, columnType: 'DOUBLE', isNumeric: true } },
    ]);
    expect(result.overallSummary).toContain('电商订单快照');
    expect(result.profiles).toHaveLength(2);
    expect(result.profiles[0].columnName).toBe('city');
    expect(result.profiles[0].semanticType).toBe('dimension');
    expect(result.profiles[1].semanticType).toBe('measure');
  });

  it('profileColumns accepts exactly MAX_BATCH=8 columns (boundary case)', async () => {
    configureAI();
    const exactlyEight = Array.from({ length: 8 }, (_, i) => ({
      columnName: `col_${i}`,
      data: sampleColumnData,
    }));
    const mockPayload = {
      overallSummary: '边界测试',
      profiles: exactlyEight.map(c => ({
        columnName: c.columnName,
        semanticType: 'dimension' as const,
        businessMeaning: 'meaning',
        usageHints: [],
        qualityRisks: [],
        suggestedActions: [],
      })),
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(mockPayload) } }],
      }),
    } as any);

    const result = await aiService.profileColumns(exactlyEight);
    expect(result.profiles).toHaveLength(8);
  });
});

