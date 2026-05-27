// Top-level public surface of @civica/regops-engine.
//
// v1 scope (landing incrementally per docs/designs/regops-engine.md
// implementation sequencing):
//   - sources/ — SourceAdapter contract types + base class (E5, E9)
//   - audit/   — append-only audit-log writer interface + impls (E3)
//   - prompts/ — versioned LLM templates + checksum baseline gate (E6)
//   - polling/ — orchestrator + JSONL snapshot store + alert emitter +
//                CLI entrypoint for the GH Actions cron (E11)
// Still to land: drafter (E1), war-room (T7), counsel queue UI (T5),
// ERE coverage gate (E8), Supabase snapshot store + Sentry alert
// emitter (operator-secret wiring, separate PR).

export * from "./sources/index.js";
export * from "./audit/index.js";
export * from "./prompts/index.js";
export * from "./polling/index.js";
