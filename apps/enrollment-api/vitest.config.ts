import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Mirror tsconfig paths so vitest can resolve workspace packages
      // without requiring pnpm workspace node_modules linking.
      '@civica/snap-rules': resolve(__dirname, '../../packages/snap-rules/src/index.ts'),
      '@civica/db-types': resolve(__dirname, '../../packages/db-types/snap_enrollment.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
  },
});
