import fs from 'node:fs';

// CLI logs contain executable-source echoes after the structured result.
for (const [input, output] of [
  ['browser-matrix.log', 'browser-matrix.json'],
  ['browser-controls-stable.log', 'browser-controls.json'],
]) {
  const directory = process.argv[2] || 'docs/visualization-governance-20261009';
  const source = fs.readFileSync(`${directory}/${input}`, 'utf8');
  const start = source.indexOf('### Result');
  const end = source.indexOf('### Ran', start);
  if (start < 0 || end < 0) throw new Error(`Missing structured result: ${input}`);
  const result = JSON.parse(source.slice(start + '### Result'.length, end).trim());
  fs.writeFileSync(`${directory}/${output}`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ output, typeCount: result.typeCount, renderChecks: result.renderChecks, checks: result.checks }));
}
