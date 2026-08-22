// The engine had no lint script at all (#721) — not a broken one like apps/web
// had, simply none. This is the package that produces every answer the product
// gives, and nothing had ever run a static check over it beyond `tsc`.
//
// Extends the house config for non-Next packages
// (packages/config/eslint.config.mjs): plain typescript-eslint, plus
// consistent-type-imports and a no-console rule. Deliberately NOT
// eslint-config-next — there is no React or Next here, and pulling that in
// would add hook rules with nothing to check and a dependency this package
// does not otherwise need.
//
// The import specifier is `@civica/config/eslint`, from that package's own
// `exports` map. `@civica/config/eslint.config.mjs` does NOT resolve — the map
// has no wildcard, and the failure reads as a module-not-found deep in Node's
// ESM loader rather than anything about the config.
import base from "@civica/config/eslint";

export default [
  ...base,
  {
    ignores: [
      "dist/**",
      "coverage/**",
      // Vendored embedding model + corpus fixtures: generated data, not source.
      "vendor/**",
      "**/__fixtures__/**",
    ],
  },
];
