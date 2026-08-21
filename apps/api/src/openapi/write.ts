/**
 * Run with: pnpm --filter @civica/api build:openapi
 *
 * Writes the generated OpenAPI spec to packages/api-types/openapi.json
 * so iOS / web / dashboard clients can consume it for codegen.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOpenAPIDocument } from './spec.js';

const outPath = resolve(
  fileURLToPath(import.meta.url),
  '../../../../..',   // worktree root
  'packages/api-types/openapi.json',
);

const spec = buildOpenAPIDocument();
writeFileSync(outPath, JSON.stringify(spec, null, 2) + '\n', 'utf-8');
process.stdout.write(`OpenAPI spec written to ${outPath}\n`);
