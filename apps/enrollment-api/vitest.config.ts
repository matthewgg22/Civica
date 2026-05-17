import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Mirror tsconfig paths so vitest can resolve the db-types package
      // without requiring pnpm workspace node_modules linking.
      '@civica/db-types': resolve(__dirname, '../../packages/db-types/snap_enrollment.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
  },
});
