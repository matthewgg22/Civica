// Top-level public surface of @civica/regops-engine.
//
// v1 scope: source-adapter contract types only. Drafter, war-room
// trigger, counsel-queue plumbing, and audit-log writers land in
// subsequent tasks (E1, E3, E6, E7, E9) and will re-export from here as
// they ship. See docs/designs/regops-engine.md for the implementation
// sequencing.

export * from "./sources/index.js";
