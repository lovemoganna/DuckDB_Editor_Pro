import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { createHash } from 'node:crypto';

// Includes uncommitted source and configuration; a Git SHA alone cannot identify this workspace.
function sourceBuildId() {
  const hash=createHash('sha256');
  function visit(directory:string) {
    for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      if(['node_modules','.git','dist','docs','public','output','.playwright-cli'].includes(entry.name) || entry.name.startsWith('.codex-'))continue;
      const file=path.join(directory,entry.name);
      if(entry.isDirectory())visit(file);
      else if(/\.(tsx?|css)$/.test(entry.name) || ['package.json','pnpm-lock.yaml','index.html'].includes(entry.name)) {
        hash.update(path.relative(__dirname,file).replaceAll('\\','/'));hash.update(fs.readFileSync(file));
      }
    }
  }
  visit(__dirname);
  return `${process.env.GITHUB_SHA?.slice(0,8) || 'local'}-${hash.digest('hex').slice(0,12)}`;
}

function snippetFsPlugin(): Plugin {
  return {
    name: 'snippet-fs-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';
        const url = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`);
        if (!url.pathname.includes('/api/snippets') && !url.pathname.includes('/api/docs') && !url.pathname.includes('/api/proxy')) {
          return next();
        }

        if (url.pathname.includes('/api/proxy')) {
          const targetUrl = url.searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing url query param' }));
            return;
          }
          try {
            let fetchOptions: any = { redirect: 'follow' };
            const proxyEnv = process.env.https_proxy || process.env.http_proxy || process.env.ALL_PROXY || 'http://127.0.0.1:18890';
            if (proxyEnv) {
              try {
                const undiciMod: any = await (import(/* @vite-ignore */ 'undici' as any) as Promise<any>).catch(() => null);
                const ProxyAgent = undiciMod?.ProxyAgent;
                fetchOptions.dispatcher = new ProxyAgent(proxyEnv);
              } catch {}
            }
            let targetRes: Response;
            try {
              targetRes = await fetch(targetUrl, fetchOptions);
            } catch {
              targetRes = await fetch(targetUrl, { redirect: 'follow' });
            }

            res.statusCode = targetRes.status;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Expose-Headers', '*');
            const ct = targetRes.headers.get('content-type');
            if (ct) res.setHeader('Content-Type', ct);
            const cd = targetRes.headers.get('content-disposition');
            if (cd) res.setHeader('Content-Disposition', cd);

            const buffer = Buffer.from(await targetRes.arrayBuffer());
            res.end(buffer);
          } catch (err: any) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Proxy fetch failed' }));
          }
          return;
        }

        if (url.pathname.includes('/api/docs')) {
          const docsDir = path.resolve(__dirname, 'docs');
          if (req.method === 'GET') {
            try {
              if (!fs.existsSync(docsDir)) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, docs: [] }));
                return;
              }
              const files = fs.readdirSync(docsDir).filter((f: string) => f.endsWith('.md'));
              const docs = files.map((file: string) => {
                const fullPath = path.join(docsDir, file);
                const content = fs.readFileSync(fullPath, 'utf-8');
                return { filename: file, content };
              });
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, docs }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
            return;
          }
          return next();
        }

        const snippetsDir = path.resolve(__dirname, 'snippets');
        if (!fs.existsSync(snippetsDir)) {
          fs.mkdirSync(snippetsDir, { recursive: true });
        }

        if (req.method === 'GET') {
          try {
            const files = fs.readdirSync(snippetsDir).filter((f: string) => f.endsWith('.md'));
            const snippets = files.map((file: string) => {
              const fullPath = path.join(snippetsDir, file);
              const content = fs.readFileSync(fullPath, 'utf-8');
              return { filename: file, content };
            });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, snippets }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: Buffer) => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const { filename, id, content } = JSON.parse(body);
              const safeName =
                (filename || id || `snippet-${Date.now()}`)
                  .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_')
                  .replace(/\.md$/, '') + '.md';
              const filePath = path.join(snippetsDir, safeName);
              fs.writeFileSync(filePath, content, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, filename: safeName }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        if (req.method === 'DELETE') {
          try {
            const targetId = url.searchParams.get('id');
            const targetFile = url.searchParams.get('filename');
            const files = fs.readdirSync(snippetsDir).filter((f: string) => f.endsWith('.md'));
            let deleted = false;
            for (const file of files) {
              const fullPath = path.join(snippetsDir, file);
              if (targetFile && file === targetFile) {
                fs.unlinkSync(fullPath);
                deleted = true;
                break;
              }
              const content = fs.readFileSync(fullPath, 'utf-8');
              if (
                targetId &&
                (file.startsWith(targetId) ||
                  content.includes(`id: "${targetId}"`) ||
                  content.includes(`id: ${targetId}`))
              ) {
                fs.unlinkSync(fullPath);
                deleted = true;
                break;
              }
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, deleted }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
          return;
        }

        next();
      });
    },
  };
}

function baseRedirectPlugin(basePath: string): Plugin {
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const cleanBase = normalizedBase.slice(0, -1);

  const handleRedirect = (req: any, res: any, next: () => void) => {
    const rawUrl = req.url || '';
    const parsedUrl = new URL(rawUrl, 'http://localhost');
    const pathname = parsedUrl.pathname;

    // Pass through Vite dev server internals, assets, and APIs
    if (
      pathname.startsWith('/@') ||
      pathname.startsWith('/__vite') ||
      pathname.startsWith('/api/') ||
      pathname.includes('/api/snippets') ||
      pathname.includes('/api/docs') ||
      pathname.includes('/api/proxy')
    ) {
      return next();
    }

    // 1. Exact base without trailing slash (case-insensitive, e.g. /DuckDB_Editor_Pro or /duckdb_editor_pro)
    if (pathname.toLowerCase() === cleanBase.toLowerCase()) {
      const target = normalizedBase + (parsedUrl.search || '') + (parsedUrl.hash || '');
      res.writeHead(302, { Location: target });
      res.end();
      return;
    }

    // 2. Case mismatch for base prefix (e.g. /duckdb_editor_pro/... -> /DuckDB_Editor_Pro/...)
    if (
      pathname.toLowerCase().startsWith(cleanBase.toLowerCase() + '/') &&
      !pathname.startsWith(normalizedBase)
    ) {
      const rest = pathname.slice(cleanBase.length + 1);
      const target = normalizedBase + rest + (parsedUrl.search || '') + (parsedUrl.hash || '');
      res.writeHead(302, { Location: target });
      res.end();
      return;
    }

    // 3. Root path / or /index.html
    if (pathname === '/' || pathname === '/index.html') {
      const target = normalizedBase + (parsedUrl.search || '') + (parsedUrl.hash || '');
      res.writeHead(302, { Location: target });
      res.end();
      return;
    }

    // 4. Any HTML page navigation request outside base path
    const acceptHeader = req.headers?.accept || '';
    const secFetchDest = req.headers?.['sec-fetch-dest'] || '';
    const isNavigation =
      acceptHeader.includes('text/html') ||
      secFetchDest === 'document';

    if (isNavigation && !pathname.startsWith(normalizedBase)) {
      const subPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
      const target = normalizedBase + subPath + (parsedUrl.search || '') + (parsedUrl.hash || '');
      res.writeHead(302, { Location: target });
      res.end();
      return;
    }

    next();
  };

  return {
    name: 'base-redirect-plugin',
    configureServer(server) {
      server.middlewares.use(handleRedirect);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleRedirect);
    },
  };
}

const BASE_PATH = process.env.VITE_BASE || '/DuckDB_Editor_Pro/';

// https://vite.dev/config/
export default defineConfig({
  base: BASE_PATH,
  cacheDir: process.env.VITE_ACCEPTANCE_CACHE_DIR || 'node_modules/.vite',
  // Historical HTML/evidence directories are not application entry points.
  optimizeDeps: { entries: ['index.html', 'test/dashboard-stability.html'] },
  plugins: [react(), snippetFsPlugin(), baseRedirectPlugin(BASE_PATH)],
  define: {
    __APP_BUILD_ID__: JSON.stringify(sourceBuildId()),
    'process.env': {},
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@Skills': path.resolve(__dirname, './Skills'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // DuckDB WASM core (largest static asset, separate chunk)
          'duckdb-wasm': [
            '@duckdb/duckdb-wasm',
          ],
          // Visualization libraries
          'vendor-d3': ['d3', 'd3-force', 'dagre'],
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
          'vendor-reactflow': ['reactflow'],
          // Code editing
          'vendor-codemirror': [
            '@uiw/react-codemirror',
            '@codemirror/autocomplete',
            '@codemirror/commands',
            '@codemirror/lint',
            '@codemirror/state',
            '@codemirror/view',
            '@codemirror/lang-sql',
            '@codemirror/lang-json',
            '@codemirror/lang-python',
            '@codemirror/lang-javascript',
            '@codemirror/lang-markdown',
            '@codemirror/lang-css',
            '@codemirror/lang-html',
            '@codemirror/lang-java',
            '@codemirror/lang-yaml',
            '@codemirror/lang-xml',
            '@codemirror/lang-rust',
            '@codemirror/lang-cpp',
            '@codemirror/lang-php',
          ],
          // Mermaid diagrams (lazy-friendly)
          'vendor-mermaid': ['mermaid'],
          // React core (vendor-chunks are empty because react is also in index; keep for future optimization)
          // Layout utilities
          'vendor-layout': ['react-grid-layout'],
          // AI / storage
          'vendor-ai': ['@google/genai'],
          // Utilities
          'vendor-utils': ['lodash', 'uuid', 'idb', 'html2canvas'],
          // Recharts
          'vendor-recharts': ['recharts'],
          // Parser-backed SQL lineage; isolate the large ANTLR runtime from the main shell.
          'vendor-sql-parser': ['dt-sql-parser'],
        },
      },
    },
  },
});
