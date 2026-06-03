// Server-only re-exports for @civica/snap-rules.
//
// These symbols depend on node:fs / node:path / node:url (YAML registry
// loader + linter). They must NEVER be reachable from a browser bundle
// — webpack rejects node: scheme imports with UnhandledSchemeError on
// Vercel, breaking the dashboard build for every PR.
//
// Consumers:
//   - tools/profile-harness/src/preflight.ts    → lintRegistry
//   - (future) CI jobs / build scripts          → loadRegistry et al.
//
// If you need a registry value at the browser, precompute it server-side
// and pass it down as props — do NOT add this import to a client
// component.

export { lintRegistry } from "./registry/lint";
export {
  loadRegistry,
  registryEntry,
  constantValue,
  citationValue,
} from "./registry/load";
export type { RegistryEntry } from "./registry/load";
