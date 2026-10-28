import { build } from 'vite';
import { gzipSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve(process.env.QUALITY_BUNDLE_OUTPUT || 'output/playwright/quality-20261016-round2/bundle-before');
await build({ build: { outDir: path.join(output, 'build') }, plugins: [{
  name: 'quality-bundle-report',
  async generateBundle(_options, bundle) {
    const chunks = Object.values(bundle).filter(item => item.type === 'chunk');
    const initial = new Set();
    const visit = name => { if (initial.has(name)) return; initial.add(name); (bundle[name]?.imports || []).forEach(visit); };
    chunks.filter(chunk => chunk.isEntry).forEach(chunk => visit(chunk.fileName));
    const report = chunks.map(chunk => ({ file: chunk.fileName, entry: chunk.isEntry, initial: initial.has(chunk.fileName), bytes: Buffer.byteLength(chunk.code), gzip: gzipSync(chunk.code).length,
      imports: chunk.imports, dynamicImports: chunk.dynamicImports,
      modules: Object.entries(chunk.modules).sort((a,b) => b[1].renderedLength-a[1].renderedLength).slice(0,30).map(([id,module]) => ({id:path.relative(process.cwd(),id),bytes:module.renderedLength}))
    })).sort((a,b)=>b.bytes-a.bytes);
    await mkdir(output,{recursive:true});
    const initialChunks=report.filter(chunk=>chunk.initial);
    const totals={bytes:initialChunks.reduce((n,c)=>n+c.bytes,0),gzip:initialChunks.reduce((n,c)=>n+c.gzip,0),chunks:initialChunks.length};
    await writeFile(path.join(output,'report.json'),JSON.stringify({initial:totals,chunks:report},null,2));
    console.log('Initial JS graph:',JSON.stringify(totals));
  }
}] });
