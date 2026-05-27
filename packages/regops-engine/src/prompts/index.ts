// Public barrel for prompt-template loading + baseline checks.
//
// Drafter (E1) consumes loadPrompt() at runtime; CI consumes the
// registry + baseline pair via baseline.test.ts to enforce that no
// silent template edits have happened since the last deliberate
// rebaseline. See docs/designs/regops-engine.md §"LLM prompts —
// versioned templates directory."

export { checksumPromptTemplate, normalizeTemplate } from "./checksum.js";
export { loadPrompt, promptFilename } from "./loader.js";
export type { LoadedPrompt } from "./loader.js";
export {
  REGISTERED_PROMPTS,
  baselineKey,
  getBaselineChecksum,
} from "./registry.js";
export type { RegisteredPrompt } from "./registry.js";
