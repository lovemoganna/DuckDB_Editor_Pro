import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, '..');
const sourceDirectory = path.join(projectDirectory, 'docs');
const destinationDirectory = path.join(projectDirectory, 'public', 'docs');
const manifestPath = path.join(sourceDirectory, 'tutorials.publish.json');

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { metadata: {}, content };

  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colonIndex = line.indexOf(':');
    if (colonIndex <= 0) continue;
    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    metadata[key] = value;
  }
  return { metadata, content: match[2] };
}

function extractTitle(content, fileName) {
  return content.match(/^#\s+(.+)$/m)?.[1] ?? path.basename(fileName, '.md');
}

function validateManifest(manifest) {
  if (manifest.version !== 1 || !Array.isArray(manifest.tutorials)) {
    throw new Error('Tutorial publish manifest must use version 1');
  }

  const ids = new Set();
  const files = new Set();
  for (const entry of manifest.tutorials) {
    if (
      !entry
      || typeof entry.file !== 'string'
      || !entry.file.endsWith('.md')
      || path.basename(entry.file) !== entry.file
    ) {
      throw new Error('Every published tutorial must name one Markdown file');
    }
    if (
      typeof entry.id !== 'string'
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)
    ) {
      throw new Error(`Published tutorial "${entry.file}" has an invalid id`);
    }
    if (ids.has(entry.id)) {
      throw new Error(`Duplicate published tutorial id: ${entry.id}`);
    }
    if (files.has(entry.file)) {
      throw new Error(`Duplicate published tutorial file: ${entry.file}`);
    }
    ids.add(entry.id);
    files.add(entry.file);
  }
}

export function buildTutorialIndex(manifest, readTutorial) {
  validateManifest(manifest);

  const tutorials = manifest.tutorials.map((entry, index) => {
    const source = readTutorial(entry.file);
    if (typeof source !== 'string') {
      throw new Error(`Published tutorial file is missing: ${entry.file}`);
    }
    const { metadata } = parseFrontmatter(source);
    return {
      id: entry.id,
      title: entry.title ?? metadata.title ?? extractTitle(source, entry.file),
      category: entry.category ?? metadata.category ?? '进阶',
      difficulty: entry.difficulty ?? metadata.difficulty ?? 'Intermediate',
      order: entry.order ?? index + 1,
      docPath: `/docs/${entry.file}`,
    };
  });

  tutorials.sort((left, right) => left.order - right.order);
  return {
    version: '1.0',
    count: tutorials.length,
    tutorials: tutorials.map(({ order: _order, ...tutorial }) => tutorial),
  };
}

export function publishTutorials({
  sourceDir = sourceDirectory,
  destinationDir = destinationDirectory,
  publishManifestPath = manifestPath,
} = {}) {
  fs.mkdirSync(destinationDir, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(publishManifestPath, 'utf8'));
  const index = buildTutorialIndex(
    manifest,
    file => {
      const filePath = path.join(sourceDir, file);
      return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : undefined;
    },
  );

  const publishedFiles = new Set(manifest.tutorials.map(entry => entry.file));
  for (const existingFile of fs.readdirSync(destinationDir)) {
    if (existingFile.endsWith('.md') && !publishedFiles.has(existingFile)) {
      fs.rmSync(path.join(destinationDir, existingFile));
    }
  }

  for (const entry of manifest.tutorials) {
    fs.copyFileSync(
      path.join(sourceDir, entry.file),
      path.join(destinationDir, entry.file),
    );
  }
  fs.writeFileSync(
    path.join(destinationDir, 'index.json'),
    `${JSON.stringify(index, null, 2)}\n`,
  );

  console.log(`Published ${index.count} tutorials from ${path.basename(publishManifestPath)}.`);
  return index;
}

const isMainModule = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  publishTutorials();
}
