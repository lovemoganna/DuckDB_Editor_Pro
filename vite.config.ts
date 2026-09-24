import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

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
                const { ProxyAgent } = await import('undici');
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

// https://vite.dev/config/
export default defineConfig({
  base: '/DuckDB_Editor_Pro/',
  plugins: [react(), snippetFsPlugin()],
  define: {
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
