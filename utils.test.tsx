// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { highlightSql } from './utils';

describe('shared SQL preview', () => {
  it.each([
    '-- SELECT FROM\nSELECT SUM(amount), 1e-3 FROM "quoted" WHERE unit = \'it\'\'s USD\';',
    '/* SELECT 123 "quote" */ SELECT \'<img src=x onerror=alert(1)>\';',
    'SELECT 中文, 1abc, "a""b", \'unfinished',
    '/* unfinished comment SELECT 42',
  ])('preserves source text and creates only highlight spans: %s', sql => {
    const preview = document.createElement('div');
    preview.innerHTML = highlightSql(sql);
    expect(preview.textContent).toBe(sql);
    expect(Array.from(preview.querySelectorAll('*')).every(node => node.tagName === 'SPAN')).toBe(true);
    expect(preview.querySelector('span span')).toBeNull();
  });

  it('keeps comments and strings intact while highlighting function calls', () => {
    const preview = document.createElement('div');
    preview.innerHTML = highlightSql("-- SELECT 12\nSELECT SUM(value), 'FROM 123';");
    expect(preview.querySelector('.sql-comment')?.textContent).toBe('-- SELECT 12');
    expect(preview.querySelector('.sql-string')?.textContent).toBe("'FROM 123'");
    expect(preview.querySelector('.sql-function')?.textContent).toBe('SUM');
  });
});
