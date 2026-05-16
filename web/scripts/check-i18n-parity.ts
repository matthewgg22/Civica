#!/usr/bin/env npx tsx
/**
 * Fails if any key present in en.json is missing from es.json (or vice versa).
 * Run: npx tsx scripts/check-i18n-parity.ts
 */
import en from "../messages/en.json";
import es from "../messages/es.json";

type NestedRecord = { [key: string]: string | NestedRecord };

function flattenKeys(obj: NestedRecord, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const full = prefix ? `${prefix}.${k}` : k;
    return typeof v === "object" ? flattenKeys(v as NestedRecord, full) : [full];
  });
}

const enKeys = new Set(flattenKeys(en as NestedRecord));
const esKeys = new Set(flattenKeys(es as NestedRecord));

const missingInEs = [...enKeys].filter((k) => !esKeys.has(k));
const missingInEn = [...esKeys].filter((k) => !enKeys.has(k));

if (missingInEs.length || missingInEn.length) {
  if (missingInEs.length) {
    console.error("❌ Keys in en.json missing from es.json:");
    missingInEs.forEach((k) => console.error(`  ${k}`));
  }
  if (missingInEn.length) {
    console.error("❌ Keys in es.json missing from en.json:");
    missingInEn.forEach((k) => console.error(`  ${k}`));
  }
  process.exit(1);
}

console.log(`✅ i18n parity OK — ${enKeys.size} keys in both locales`);
