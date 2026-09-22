import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import publishManifest from '../docs/tutorials.publish.json';
import { tutorials } from './tutorials';

describe('runtime tutorial registry', () => {
  it('contains exactly the manifest tutorials in publish order', () => {
    const expectedIds = [...publishManifest.tutorials]
      .sort((left, right) => left.order - right.order)
      .map(tutorial => tutorial.id);

    expect(tutorials.map(tutorial => tutorial.id)).toEqual(expectedIds);
    expect(tutorials).toHaveLength(publishManifest.tutorials.length);
  });

  it('does not expose internal plan or prompt documents', () => {
    expect(tutorials.map(tutorial => tutorial.title).join('\n')).not.toMatch(/\bPLAN\b|提示词|Prompt/i);
  });

  it('does not use a broad eager Markdown glob that bundles internal docs', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'data', 'tutorials.ts'), 'utf8');
    expect(source).not.toContain("import.meta.glob('../docs/*.md'");
    for (const entry of publishManifest.tutorials) {
      expect(source).toContain(`../docs/${entry.file}?raw`);
    }
  });
});
