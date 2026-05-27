// Prompt-template loader.
//
// Templates live as plain .md files in ./templates/{name}.v{N}.md. The
// drafter (E1) will load by (name, version), receive the raw template
// plus its checksum, and use the checksum as an attribution key when it
// records eval results. Versioning is explicit — to edit a template you
// either rebaseline its current version (deliberate; logged) or you bump
// the version and add a new file.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { checksumPromptTemplate, normalizeTemplate } from "./checksum.js";

export interface LoadedPrompt {
  readonly name: string;
  readonly version: number;
  /** Template with LF line endings, suitable for hashing or interpolation. */
  readonly template: string;
  /** SHA-256 of the LF-normalized template. */
  readonly checksum: string;
}

const TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), "templates");

export function promptFilename(name: string, version: number): string {
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error(`Invalid prompt name '${name}': must match /^[a-z0-9-]+$/`);
  }
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`Invalid prompt version '${version}': must be a positive integer`);
  }
  return `${name}.v${version}.md`;
}

export function loadPrompt(name: string, version: number): LoadedPrompt {
  const filename = promptFilename(name, version);
  const fullPath = join(TEMPLATES_DIR, filename);
  let raw: string;
  try {
    raw = readFileSync(fullPath, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load prompt '${name}@v${version}' at ${fullPath}: ${message}`);
  }
  const template = normalizeTemplate(raw);
  return {
    name,
    version,
    template,
    checksum: checksumPromptTemplate(template),
  };
}
