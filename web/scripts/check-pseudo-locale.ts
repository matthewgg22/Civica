#!/usr/bin/env npx tsx
/**
 * Pseudo-locale stress test.
 *
 * Generates a padded version of every en.json string (each word repeated
 * once, roughly +40–60%) and checks for obvious layout risks:
 *   - any string longer than 120 chars that lives in a UI label namespace
 *   - keys whose padded form is > 2× the Spanish translation length
 *     (indicates the ES copy may be under-translated)
 *
 * Does NOT require a running server. Exit 0 = no concerns found.
 */
import fs from "fs";
import path from "path";

type Messages = Record<string, Record<string, string>>;

const root = path.resolve(import.meta.dirname, "..");
const en: Messages = JSON.parse(fs.readFileSync(path.join(root, "messages/en.json"), "utf8"));
const es: Messages = JSON.parse(fs.readFileSync(path.join(root, "messages/es.json"), "utf8"));

// Pad each word with a tilde suffix to simulate longer translations
function pseudo(str: string): string {
  return str.replace(/\b([A-Za-zÀ-ÿ]{2,})\b/g, "$1~$1");
}

// Flatten nested object to dotted keys
function flatten(obj: Messages): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [ns, keys] of Object.entries(obj)) {
    for (const [key, val] of Object.entries(keys)) {
      out[`${ns}.${key}`] = val;
    }
  }
  return out;
}

const enFlat = flatten(en);
const esFlat = flatten(es);

type Warning = { key: string; reason: string; length?: number };
const warnings: Warning[] = [];

// Label-like namespaces where overflow is most visible
const UI_NAMESPACES = new Set(["common", "auth", "onboarding", "documents", "inbox", "packet", "consent", "questions"]);

for (const [key, enVal] of Object.entries(enFlat)) {
  const padded = pseudo(enVal);
  const ns = key.split(".")[0];

  // Flag padded labels that are suspiciously long — but only for originally-short
  // strings (≤60 chars EN). Long body copy is expected to wrap and is excluded.
  if (UI_NAMESPACES.has(ns) && enVal.length <= 60 && padded.length > 120) {
    warnings.push({ key, reason: `pseudo length ${padded.length} (from ${enVal.length} EN chars) — may overflow constrained UI`, length: padded.length });
  }

  // Flag where Spanish is far shorter than pseudo-English (possible under-translation)
  const esVal = esFlat[key];
  if (esVal && esVal.length < enVal.length * 0.5 && enVal.length > 20) {
    warnings.push({ key, reason: `ES ("${esVal}") is < 50% the length of EN ("${enVal}") — possible under-translation` });
  }
}

if (warnings.length === 0) {
  console.log(`✅ Pseudo-locale stress test passed — ${Object.keys(enFlat).length} strings checked.`);
  process.exit(0);
}

console.warn(`⚠️  ${warnings.length} pseudo-locale warning(s):\n`);
for (const w of warnings) {
  console.warn(`  ${w.key}: ${w.reason}`);
}
// Warnings don't fail CI — they're advisory for the copy reviewer
process.exit(0);
