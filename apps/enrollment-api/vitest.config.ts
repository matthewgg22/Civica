import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Mirror tsconfig paths so vitest can resolve workspace packages
      // without requiring pnpm workspace node_modules linking.
      '@civica/db-types':        resolve(__dirname, '../../packages/db-types/snap_enrollment.ts'),
      '@civica/snap-enums':      resolve(__dirname, '../../packages/snap-enums/src/index.ts'),
      '@civica/recert-engine/outreach': resolve(__dirname, '../../packages/recert-engine/src/outreach/index.ts'),
      '@civica/recert-engine':         resolve(__dirname, '../../packages/recert-engine/src/index.ts'),
      '@civica/benefitscal-cbo': resolve(__dirname, '../../packages/benefitscal-cbo/src/index.ts'),
      '@civica/snap-rules':      resolve(__dirname, '../../packages/snap-rules/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
  },
});
