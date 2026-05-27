// Top-level public surface of @civica/regops-engine.
//
// v1 scope (landing incrementally per docs/designs/regops-engine.md
// implementation sequencing):
//   - sources/ — SourceAdapter contract types (E5)
//   - audit/   — append-only audit-log writer interface + impls (E3)
// Still to land: drafter (E1), versioned prompts (E6), base adapter +
// polling hygiene (E9), adversarial fixtures (E7), war-room (T7),
// counsel queue UI (T5), ERE coverage gate (E8).

export * from "./sources/index.js";
export * from "./audit/index.js";
