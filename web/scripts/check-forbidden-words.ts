#!/usr/bin/env npx tsx
/**
 * Scans user-visible strings (messages/*.json) and status-related source
 * files for forbidden eligibility/approval language.
 *
 * Per product requirement: Civica must never imply it determines eligibility
 * or approves/denies benefits. These words must not appear in any copy shown
 * to applicants.
 */
import fs from "fs";
import path from "path";
import { glob } from "glob";

const FORBIDDEN = [
  /\bapprove[sd]?\b/i,
  /\bapproval\b/i,
  /\bden(y|ied|ial)\b/i,
  /\beligib(le|ility)\b/i,
  /\bqualif(y|ied|ication)\b/i,
  /\bineligib(le|ility)\b/i,
];

// Allowlist: these files contain forbidden words intentionally (e.g., the
// disclaimer explicitly says "We do not determine eligibility") — we scan them
// but allow negated context.
// For simplicity we skip the disclaimer text itself (it's a safe negation).
// Lines where a forbidden word appears in an explicitly safe negation context.
// Matches the standard disclaimer + consent copy that reference what Civica
// does NOT do ("does not determine eligibility", "do not approve benefits").
const DISCLAIMER_SAFE_PATTERN =
  /\b(do|does) not\b.{0,60}\b(eligib|approv|determin)/i;

type Violation = { file: string; line: number; text: string; word: string };

async function main() {
  const root = path.resolve(import.meta.dirname, "..");

  const files = await glob(
    [
      "messages/**/*.json",
      "components/snap/**/*.tsx",
      "app/**/packet/**/*.tsx",
      "app/**/consent/**/*.tsx",
    ],
    { cwd: root, absolute: true }
  );

  const violations: Violation[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip lines that are the explicit safe disclaimer negation
      if (DISCLAIMER_SAFE_PATTERN.test(line)) continue;

      for (const pattern of FORBIDDEN) {
        if (pattern.test(line)) {
          const match = line.match(pattern);
          violations.push({
            file: path.relative(root, file),
            line: i + 1,
            text: line.trim(),
            word: match?.[0] ?? pattern.source,
          });
          break; // one violation per line is enough
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log("✅ No forbidden eligibility/approval language found.");
    process.exit(0);
  }

  console.error(`❌ Found ${violations.length} forbidden-word violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  "${v.word}"`);
    console.error(`    ${v.text}\n`);
  }
  process.exit(1);
}

main();
