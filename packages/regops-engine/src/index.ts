// Top-level public surface of @civica/regops-engine.
//
// v1 scope (landing incrementally per docs/designs/regops-engine.md
// implementation sequencing):
//   - sources/    — SourceAdapter contract + adapter classes (E5, E9, E10)
//   - audit/      — append-only audit-log writer interface + impls (E3)
//   - prompts/    — versioned LLM templates + checksum baseline gate (E6)
//   - polling/    — orchestrator + snapshot store + alert emitter +
//                   CLI entrypoint for the GH Actions cron (E11)
//   - classifier/ — keyword-based topic classifier (P1, OBBBA depth)
// Still to land: drafter (E1), war-room (T7), counsel queue UI (T5).

export * from "./sources/index.js";
export * from "./audit/index.js";
export * from "./prompts/index.js";
export * from "./polling/index.js";
export * from "./classifier/index.js";
