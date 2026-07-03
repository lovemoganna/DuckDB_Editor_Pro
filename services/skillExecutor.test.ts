/**
 * services/skillExecutor.test.ts — Unit tests for AI Skill Executor
 *
 * Tests:
 * - Cancel token: create / isCancelled / cancellation
 * - Skill not found error
 * - Generator resolution: direct execute path
 * - Generator resolution: generatorId path (mocked)
 * - AI fallback path (no generator, no execute)
 * - SkillResult shape validation
 * - simulateOnly flag
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AISkill } from '../types';

import {
  skillExecutor,
  createCancelToken,
  isCancelled,
} from './skillExecutor';

// ============================================================
// Mock skill definitions
// ============================================================

const mockSkillWithExecute: AISkill = {
  id: 'mock-direct-execute',
  name: 'Mock Direct Execute',
  description: 'Skill with direct execute function',
  category: 'modeling',
  inputSchema: [],
  outputType: 'sql',
  async execute() {
    return {
      success: true,
      sql: 'SELECT * FROM "users" LIMIT 10',
      explanation: 'Mock direct execute',
    };
  },
};

const mockSkillWithGeneratorId: AISkill = {
  id: 'mock-generator-id',
  name: 'Mock GeneratorId',
  description: 'Skill with generatorId but no execute fn',
  category: 'modeling',
  inputSchema: [],
  outputType: 'sql',
  generatorId: 'mock-generator',
};

const mockSkillNoGenerator: AISkill = {
  id: 'mock-no-generator',
  name: 'Mock No Generator',
  description: 'Skill without generator or execute',
  category: 'modeling',
  inputSchema: [],
  outputType: 'sql',
};

// ============================================================
// Mock modules
// ============================================================

vi.mock('./skillRegistry', () => ({
  getSkill(skillId: string) {
    const map: Record<string, AISkill> = {
      'mock-direct-execute': mockSkillWithExecute,
      'mock-generator-id': mockSkillWithGeneratorId,
      'mock-no-generator': mockSkillNoGenerator,
      'non-existent-skill': undefined as unknown as AISkill,
    };
    return map[skillId];
  },
}));

vi.mock('./skills/generators', () => ({
  ensureInitialized: vi.fn().mockResolvedValue(undefined),
  getGenerator(generatorId: string) {
    if (generatorId === 'mock-generator') {
      return () => 'SELECT * FROM mock_table LIMIT 10';
    }
    return null;
  },
  getRegisteredGeneratorIds: () => ['mock-generator', 'sql-select', 'sql-join'],
}));

vi.mock('./skills/definitions/official-skills', () => ({
  OFFICIAL_HANDBOOK_SKILLS: [],
}));

vi.mock('./skill/skillHistoryStorage', () => ({
  addToSkillHistory: vi.fn(),
  getSkillHistory: vi.fn().mockReturnValue([]),
  clearSkillHistory: vi.fn(),
}));

const mockGenerateSql = vi.fn().mockResolvedValue('SELECT * FROM users');
vi.mock('./aiService', () => ({
  aiService: { generateSql: mockGenerateSql },
}));

// ============================================================
// Test helpers
// ============================================================

function makeRequest(skillId: string, overrides: Record<string, unknown> = {}) {
  return {
    skillId,
    inputs: {},
    context: {
      tableName: 'test_users',
      columns: [
        { name: 'id', type: 'BIGINT', notnull: true, dflt_value: null, pk: true },
        { name: 'name', type: 'VARCHAR', notnull: false, dflt_value: null, pk: false },
      ],
      userIntent: '查询所有用户',
    },
    simulateOnly: false,
    ...overrides,
  };
}

// ============================================================
// Cancel token
// ============================================================

describe('Cancel token', () => {
  it('createCancelToken returns uncancelled token', () => {
    const token = createCancelToken();
    expect(token.cancelled).toBe(false);
  });

  it('isCancelled returns false for uncancelled token', () => {
    expect(isCancelled(createCancelToken())).toBe(false);
  });

  it('isCancelled returns true after manual cancellation', () => {
    const token = createCancelToken();
    token.cancelled = true;
    expect(isCancelled(token)).toBe(true);
  });
});

// ============================================================
// Error paths
// ============================================================

describe('SkillExecutor.execute — error paths', () => {
  it('returns error when skill not found', async () => {
    const result = await skillExecutor.execute(makeRequest('non-existent-skill'));
    expect(result.success).toBe(false);
    expect(result.error).toContain('Skill not found');
  });

  it('returns error when cancelled before start', async () => {
    const token = createCancelToken();
    token.cancelled = true;
    const result = await skillExecutor.execute(makeRequest('mock-direct-execute', { cancelToken: token }));
    expect(result.success).toBe(false);
    expect(result.error).toContain('cancelled');
  });
});

// ============================================================
// Generator resolution paths
// ============================================================

describe('SkillExecutor.execute — generator resolution', () => {
  it('uses direct execute function and marks source as 直接执行', async () => {
    const result = await skillExecutor.execute(makeRequest('mock-direct-execute'));
    expect(result.success).toBe(true);
    expect(result.sql).toContain('SELECT * FROM');
    expect(result.explanation).toContain('直接执行');
  });

  it('uses generatorId from registry and marks source as Generator注册表', async () => {
    const result = await skillExecutor.execute(makeRequest('mock-generator-id'));
    expect(result.success).toBe(true);
    expect(result.sql).toContain('mock_table');
    expect(result.explanation).toContain('Generator注册表');
  });

  it('falls back to AI when no generator or execute is available', async () => {
    mockGenerateSql.mockClear();
    const result = await skillExecutor.execute(makeRequest('mock-no-generator'));
    expect(result.success).toBe(true);
    expect(mockGenerateSql).toHaveBeenCalled();
  });
});

// ============================================================
// SkillResult shape
// ============================================================

describe('SkillResult shape', () => {
  it('success result has required fields', async () => {
    const result = await skillExecutor.execute(makeRequest('mock-direct-execute'));
    expect(result.success).toBe(true);
    expect(typeof result.sql).toBe('string');
    expect(result.sql!.length).toBeGreaterThan(0);
    expect(typeof result.explanation).toBe('string');
    expect(typeof result.executionTime).toBe('number');
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });

  it('error result has required fields', async () => {
    const result = await skillExecutor.execute(makeRequest('non-existent-skill'));
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
    expect(result.error!.length).toBeGreaterThan(0);
  });
});

// ============================================================
// simulateOnly flag
// ============================================================

describe('simulateOnly flag', () => {
  it('marks result as simulated when set', async () => {
    const result = await skillExecutor.execute(makeRequest('mock-direct-execute', { simulateOnly: true }));
    expect(result.success).toBe(true);
    expect(result.metadata?.simulated).toBe(true);
  });
});
