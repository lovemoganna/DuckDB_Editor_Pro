import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildTutorialIndex, publishTutorials } from './copy-docs.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  temporaryDirectories.splice(0).forEach(directory =>
    fs.rmSync(directory, { recursive: true, force: true }),
  );
});

describe('tutorial publishing', () => {
  it('publishes only manifest entries with stable unique ids', () => {
    const index = buildTutorialIndex({
      version: 1,
      tutorials: [
        { file: 'lesson-a.md', id: 'lesson-a', order: 2 },
        { file: 'lesson-b.md', id: 'lesson-b', order: 1 },
      ],
    }, file => `# ${file}`);

    expect(index).toEqual({
      version: '1.0',
      count: 2,
      tutorials: [
        {
          id: 'lesson-b',
          title: 'lesson-b.md',
          category: '进阶',
          difficulty: 'Intermediate',
          docPath: '/docs/lesson-b.md',
        },
        {
          id: 'lesson-a',
          title: 'lesson-a.md',
          category: '进阶',
          difficulty: 'Intermediate',
          docPath: '/docs/lesson-a.md',
        },
      ],
    });
  });

  it('fails the build when two published tutorials share an id', () => {
    expect(() => buildTutorialIndex({
      version: 1,
      tutorials: [
        { file: 'lesson-a.md', id: 'duplicate' },
        { file: 'lesson-b.md', id: 'duplicate' },
      ],
    }, file => `# ${file}`)).toThrow('Duplicate published tutorial id');
  });

  it('removes stale Markdown files that are no longer in the publish manifest', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'duckdb-tutorial-publish-'));
    temporaryDirectories.push(root);
    const sourceDir = path.join(root, 'docs');
    const destinationDir = path.join(root, 'public', 'docs');
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(destinationDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'lesson.md'), '# Published');
    fs.writeFileSync(path.join(destinationDir, 'PLAN-internal.md'), '# Internal');
    const manifestPath = path.join(sourceDir, 'tutorials.publish.json');
    fs.writeFileSync(manifestPath, JSON.stringify({
      version: 1,
      tutorials: [{ file: 'lesson.md', id: 'lesson' }],
    }));

    publishTutorials({
      sourceDir,
      destinationDir,
      publishManifestPath: manifestPath,
    });

    expect(fs.readdirSync(destinationDir).sort()).toEqual(['index.json', 'lesson.md']);
  });
});
