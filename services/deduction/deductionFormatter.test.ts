import { describe, expect, it } from 'vitest';
import { formatDeductionMarkdown } from './deductionFormatter';
import type { SemanticReconstruction } from './deductionTypes';

const base: SemanticReconstruction = {
  version: 1,
  input: 'A 且 B，则 C。',
  features: [{ id: 'F1', kind: 'condition', statement: 'A', classification: 'fact', certainty: 'confirmed', evidence: [{ quote: 'A', start: 0, end: 1 }] }],
  relations: [], contexts: [],
  structure: { id: 'N1', type: 'feature', label: 'A', featureId: 'F1', children: [] },
  coreMeaning: { text: 'A 是输入中的条件。', supportingFeatureIds: ['F1'], supportingRelationIds: [] },
  punchline: { text: '只保留输入明确表达的条件。', supportingFeatureIds: ['F1'], supportingRelationIds: [] },
  validation: { status: 'valid', issues: [] },
};

describe('deductionFormatter public seam', () => {
  it('exports the fixed sections and omits section 6 when mapping was not requested', () => {
    const markdown = formatDeductionMarkdown(base);
    expect(markdown.match(/^## \d\./gm)).toEqual(['## 1.', '## 2.', '## 3.', '## 4.', '## 5.', '## 7.']);
    expect(markdown).not.toContain('## 6. 外部映射');
  });

  it('includes source-grounded section 6 when mapping was requested', () => {
    const markdown = formatDeductionMarkdown({
      ...base,
      externalMappings: [{
        id: 'M1', targetKind: 'feature', targetId: 'F1', sourceId: 'S1', correspondingObject: '规则条件',
        correspondingContent: 'A', matchLevel: '直接对应', basis: { quote: 'A', start: 0, end: 1, sourceId: 'S1' }, validationNote: '对象与条件一致',
      }],
    });
    expect(markdown).toContain('## 6. 外部映射');
    expect(markdown).toContain('**匹配程度：** 直接对应');
    expect(markdown).toContain('**依据：** 「A」');
  });
});
