// Loader: reads the v0.6 fixture from disk, validates against the
// shipped JSON Schema, returns the decoded suite. Schema-validation
// failure terminates the run with a precise path so a malformed fixture
// is caught at start, not 50 profiles into the run.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ProfileSuite } from "./types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Walks up from this source file to the repo root, then resolves the
 * canonical fixture path. Mirrors the Swift adapter's `#filePath` walk.
 */
function repoRoot(): string {
  // tools/profile-harness/src/loader.ts
  //   parent: tools/profile-harness/src/
  //   parent: tools/profile-harness/
  //   parent: tools/
  //   parent: <repo root>
  return resolve(__dirname, "..", "..", "..");
}

export const DEFAULT_FIXTURE_PATH = resolve(
  repoRoot(),
  "data-ops",
  "sample",
  "civica-test-profiles",
  "v0.6.json",
);

export const DEFAULT_SCHEMA_PATH = resolve(
  repoRoot(),
  "data-ops",
  "sample",
  "civica-test-profiles",
  "v0.6.schema.json",
);

export interface LoadOptions {
  fixturePath?: string;
  schemaPath?: string;
  /** Skip schema validation (only for debugging — production runs validate). */
  skipValidation?: boolean;
}

export interface LoadedSuite {
  suite: ProfileSuite;
  fixturePath: string;
  schemaPath: string;
  validationSkipped: boolean;
}

export function loadProfileSuite(opts: LoadOptions = {}): LoadedSuite {
  const fixturePath = opts.fixturePath ?? DEFAULT_FIXTURE_PATH;
  const schemaPath = opts.schemaPath ?? DEFAULT_SCHEMA_PATH;

  const rawFixture = JSON.parse(readFileSync(fixturePath, "utf-8")) as unknown;

  if (!opts.skipValidation) {
    const schema = JSON.parse(readFileSync(schemaPath, "utf-8")) as object;
    // Ajv2020 supports JSON Schema Draft 2020-12 (the schema's $schema).
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    // `addFormats` registers "date" + others used by the schema.
    addFormats.default(ajv);
    const validate = ajv.compile(schema);
    const ok = validate(rawFixture);
    if (!ok) {
      const top = (validate.errors ?? []).slice(0, 5);
      const lines = top.map((e) => `  ${e.instancePath} ${e.message}`);
      throw new Error(
        `Fixture failed schema validation (${fixturePath}):\n${lines.join("\n")}`,
      );
    }
  }

  return {
    suite: rawFixture as ProfileSuite,
    fixturePath,
    schemaPath,
    validationSkipped: opts.skipValidation === true,
  };
}
