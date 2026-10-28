import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 20000,
    include: ['**/*.test.{ts,tsx}'],
    exclude: [...configDefaults.exclude, 'output/**'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '*.config.*',
        'scripts/**',
      ],
    },
  },
  resolve: {
    alias: [
      {
        find: '@/',
        replacement: path.resolve(__dirname, '.') + '/',
      },
      {
        find: '@',
        replacement: path.resolve(__dirname, '.'),
      },
      // Prevent Vitest from evaluating the real DuckDB IIFE worker under jsdom.
      {
        find: '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?worker',
        replacement: path.resolve(__dirname, './test/mocks/duckdbWorkerCtor.ts'),
      },
      {
        find: '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url',
        replacement: path.resolve(__dirname, './test/mocks/duckdbAssetUrl.ts'),
      },
      {
        find: '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url',
        replacement: path.resolve(__dirname, './test/mocks/duckdbAssetUrl.ts'),
      },
    ],
  },
});
