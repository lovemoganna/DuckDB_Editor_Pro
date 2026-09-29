// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  deriveSessionTitle,
  sanitizeMessagesForStorage,
  toSessionMeta,
  type CopilotSession,
} from './copilotSessionStorage';

describe('copilotSessionStorage helpers', () => {
  it('deriveSessionTitle uses first user message and truncates long text', () => {
    expect(deriveSessionTitle([])).toBe('新对话');
    expect(
      deriveSessionTitle([
        { role: 'assistant', content: '欢迎' },
        { role: 'user', content: '统计订单金额' },
      ]),
    ).toBe('统计订单金额');

    const long = '这是一段特别特别特别特别特别特别特别特别特别长的用户问题用于截断';
    const title = deriveSessionTitle([{ role: 'user', content: long }]);
    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(29);
  });

  it('sanitizeMessagesForStorage drops streaming flag and caps length', () => {
    const cleaned = sanitizeMessagesForStorage([
      { id: '1', role: 'user', content: 'hi', timestamp: '12:00', isStreaming: true },
      { id: '2', role: 'system', content: 'sys', timestamp: '12:00' },
    ]);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0]).toEqual({ id: '1', role: 'user', content: 'hi', timestamp: '12:00' });
    expect('isStreaming' in cleaned[0]).toBe(false);
  });

  it('toSessionMeta builds preview from latest user message', () => {
    const session: CopilotSession = {
      id: 'cps-1',
      name: '会话 A',
      messages: [
        { id: 'a', role: 'assistant', content: '欢迎', timestamp: '12:00' },
        { id: 'b', role: 'user', content: '  分析 categories 表质量  ', timestamp: '12:01' },
        { id: 'c', role: 'assistant', content: '结论如下', timestamp: '12:02' },
      ],
      contextTables: ['categories'],
      contextTable: 'categories',
      createdAt: 1,
      updatedAt: 2,
    };
    const meta = toSessionMeta(session);
    expect(meta.messageCount).toBe(3);
    expect(meta.preview).toBe('分析 categories 表质量');
    expect(meta.name).toBe('会话 A');
  });
});
