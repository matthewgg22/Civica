// The gateway declared `"lint": "eslint src/ test/"` with no flat config, so
// the script exited 2 before reading a source file and this app had never
// been linted (#721 — same class as apps/web's #695, different lineage).
//
// Extends the house config for non-Next packages
// (packages/config/eslint.config.mjs) the same way packages/demeter-engine
// does: plain typescript-eslint plus consistent-type-imports and no-console.
// Deliberately NOT eslint-config-next — this is a Hono worker, no React.
import base from "@civica/config/eslint";

export default [
  ...base,
  {
    ignores: ["dist/**", "coverage/**", ".wrangler/**"],
  },
];
