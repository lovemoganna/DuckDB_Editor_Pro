import { describe, expect, it } from 'vitest';
import { applyAIEgressPolicy, summarizeAITraceText } from './aiEgressPolicy';

describe('AI egress policy', () => {
  it('removes row samples and sensitive distribution values before network egress', () => {
    const prompt = `Schema: users(id BIGINT, email VARCHAR)
### Sample Data Preview (First 15 Rows)
\`\`\`
{"id": 42, "email": "alice@example.com", "phone": "+86 13800138000"}
\`\`\`
- status [Top Distributions: "VIP"(20), "Trial"(10)]`;

    const result = applyAIEgressPolicy(prompt);

    expect(result.text).toContain('Schema: users');
    expect(result.text).not.toContain('alice@example.com');
    expect(result.text).not.toContain('13800138000');
    expect(result.text).not.toContain('"VIP"');
    expect(result.text).toContain('[ROW SAMPLES REDACTED]');
    expect(result.redactionCount).toBeGreaterThan(0);
  });

  it('stores trace metadata instead of full prompts or responses', () => {
    const trace = summarizeAITraceText('customer secret value', 'prompt');

    expect(trace).toContain('prompt omitted');
    expect(trace).toContain('length=21');
    expect(trace).not.toContain('customer secret value');
  });

  it('redacts legacy unfenced sample sections used by metric prompts', () => {
    const prompt = `### 表名: orders
- 行数: 2
- 样本数据:
alice@example.com | 4111111111111111
bob@example.com | 13800138000

---
### 表名: products`;

    const result = applyAIEgressPolicy(prompt);

    expect(result.text).toContain('[ROW SAMPLES REDACTED]');
    expect(result.text).toContain('### 表名: products');
    expect(result.text).not.toContain('alice@example.com');
    expect(result.text).not.toContain('4111111111111111');
  });
});
