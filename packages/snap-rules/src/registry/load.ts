// Verification-hyperdrive Layer 3 registry loader.
//
// Parses the YAML registry file at compile/test time, validates each
// entry against a Zod schema, exposes typed lookups by id.
//
// The point: every time-sensitive constant + every CFR citation has an
// owner, an expiry, and a URL that resolves. Engine code reads from
// here (or has tables generated from here) so a primary-source
// correction propagates without hunting every hardcoded value.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parse as parseYAML } from "yaml";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Schema ───────────────────────────────────────────────────────────────

const EntryBase = z.object({
  id: z.string().min(1),
  type: z.enum(["constant", "citation", "boolean"]),
  label: z.string().min(1),
  source_url: z.string().url(),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  valid_through: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  owner: z.string().min(1),
  source_doc: z.string().optional(),
  notes: z.string().optional(),
});

const ConstantEntry = EntryBase.extend({
  type: z.literal("constant"),
  value: z.number(),
  unit: z.string().min(1),
  state: z.string().min(1),
});

const CitationEntry = EntryBase.extend({
  type: z.literal("citation"),
  value: z.string().min(1),
});

const BooleanEntry = EntryBase.extend({
  type: z.literal("boolean"),
  value: z.boolean(),
  state: z.string().min(1),
});

const RegistryEntry = z.discriminatedUnion("type", [
  ConstantEntry,
  CitationEntry,
  BooleanEntry,
]);

const RegistryFile = z.object({
  entries: z.array(RegistryEntry).min(1),
});

export type RegistryEntry = z.infer<typeof RegistryEntry>;
export type ConstantEntry = z.infer<typeof ConstantEntry>;
export type CitationEntry = z.infer<typeof CitationEntry>;

// ─── Loader ───────────────────────────────────────────────────────────────

const DEFAULT_REGISTRY_PATH = resolve(__dirname, "fy26.yaml");

let cached: Map<string, RegistryEntry> | null = null;

export function loadRegistry(path: string = DEFAULT_REGISTRY_PATH): Map<string, RegistryEntry> {
  if (cached) return cached;
  const raw = readFileSync(path, "utf8");
  const parsed = parseYAML(raw);
  const validated = RegistryFile.parse(parsed);
  const map = new Map<string, RegistryEntry>();
  for (const entry of validated.entries) {
    if (map.has(entry.id)) {
      throw new Error(`Duplicate registry entry id: ${entry.id}`);
    }
    map.set(entry.id, entry);
  }
  cached = map;
  return map;
}

export function registryEntry(id: string): RegistryEntry {
  const map = loadRegistry();
  const entry = map.get(id);
  if (!entry) {
    throw new Error(`Registry entry not found: ${id}`);
  }
  return entry;
}

export function constantValue(id: string): number {
  const entry = registryEntry(id);
  if (entry.type !== "constant") {
    throw new Error(`Registry entry ${id} is not a constant (got ${entry.type})`);
  }
  return entry.value;
}

export function citationValue(id: string): string {
  const entry = registryEntry(id);
  if (entry.type !== "citation") {
    throw new Error(`Registry entry ${id} is not a citation (got ${entry.type})`);
  }
  return entry.value;
}

/** Reset the module-level cache (used by tests). */
export function _resetRegistryCache(): void {
  cached = null;
}
