import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Use the same automatic JSX runtime as Next.js so component render tests do
  // not need React in scope.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
