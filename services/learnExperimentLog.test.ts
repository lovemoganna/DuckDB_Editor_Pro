import { describe, expect, it } from 'vitest';
import { createLearnExperimentRecord } from './learnExperimentLog';

describe('learn experiment log', () => {
  it('captures reproducible SQL metadata with a bounded result snapshot', () => {
    const rows = Array.from({ length: 150 }, (_, index) => ({
      id: index,
      value: BigInt(index),
    }));

    const record = createLearnExperimentRecord({
      tutorialId: 'lesson-1',
      codeBlockId: 'block-1',
      sql: 'select * from events',
      executedSql: 'select * from events limit 1000',
      engineVersion: 'v1.3.2',
      durationMs: 12,
      rows,
      timestamp: 100,
    });

    expect(record.rowCount).toBe(150);
    expect(record.resultSnapshot).toHaveLength(100);
    expect(record.resultSnapshot[0].value).toBe('0');
    expect(record.engineVersion).toBe('v1.3.2');
    expect(record.sql).toBe('select * from events');
    expect(record.executedSql).toContain('limit 1000');
  });
});
