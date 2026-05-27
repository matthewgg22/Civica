// Prompt-template checksum helper.
//
// E6 ties every prompt version to a frozen SHA-256 of its file contents.
// The baseline test (CI gate) recomputes the hash and fails if it drifts
// from the recorded value. That forces a deliberate version bump +
// rebaseline whenever a template changes, instead of silent edits
// invalidating downstream eval baselines.
//
// We normalize line endings to LF before hashing so a git autocrlf
// checkout on Windows doesn't flip every checksum.

import { createHash } from "node:crypto";

export function normalizeTemplate(raw: string): string {
  return raw.replace(/\r\n/g, "\n");
}

export function checksumPromptTemplate(raw: string): string {
  return createHash("sha256").update(normalizeTemplate(raw), "utf8").digest("hex");
}
