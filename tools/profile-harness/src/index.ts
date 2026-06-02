// Public exports for programmatic consumers (tests, other tools).

export { loadProfileSuite, DEFAULT_FIXTURE_PATH } from "./loader.ts";
export { runHarness } from "./runner.ts";
export { renderMarkdownReport } from "./report.ts";
export { SentinelAdapter } from "./adapters/sentinel.ts";
export { TsSnapRulesAdapter } from "./adapters/ts-snap-rules.ts";
export { applyFactsPatch } from "./facts-patch.ts";
export { TS_MANIFEST_WAVE_A, TS_MANIFEST_WAVE_B, missingSurfaces } from "./capability-manifest.ts";
export type * from "./types.ts";
