import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  base: '/DuckDB_Editor_Pro/',
  plugins: [react()],
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
            '@codemirror/theme-one-dark',
          ],
          // Mermaid diagrams (lazy-friendly)
          'vendor-mermaid': ['mermaid'],
          // React core (vendor-chunks are empty because react is also in index; keep for future optimization)
          // Layout utilities
          'vendor-layout': ['react-grid-layout'],
          // AI / storage
          'vendor-ai': ['@google/genai'],
          // Utilities
          'vendor-utils': ['lodash', 'uuid', 'idb', 'xlsx', 'html2canvas'],
          // Recharts
          'vendor-recharts': ['recharts'],
        },
      },
    },
  },
});
