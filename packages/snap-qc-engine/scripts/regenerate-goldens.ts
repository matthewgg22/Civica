/**
 * Regenerate every `expected.json` under `test/golden/<flow>/<id>/` by
 * re-running the engine against `input.json`.
 *
 * Intentional, manual operation. Never wired into CI. Run when:
 *   - You bump ENGINE_VERSION major and reviewers have signed off on the
 *     scoring change.
 *   - You add a new fixture and need its first expected.json baseline.
 *
 * Usage:  pnpm --filter @civica/snap-qc-engine regenerate:goldens
 */
import { readFileSync, writeFileSync } from "node:fs";
import { qcEngine } from "../src/index.js";
import { discoverGoldenFixtures } from "../test/golden/_discover.js";

const FROZEN_NOW = "2026-05-18T00:00:00.000Z";

async function main(): Promise<void> {
  const fixtures = discoverGoldenFixtures();
  console.log(`Regenerating ${fixtures.length} golden fixtures…`);

  for (const f of fixtures) {
    const input = JSON.parse(readFileSync(f.inputPath, "utf8"));
    const result = await qcEngine.evaluate(input, { now: () => FROZEN_NOW });
    writeFileSync(f.expectedPath, JSON.stringify(result, null, 2) + "\n");
    console.log(
      `  ${f.flow}/${f.id} → ${result.defensibility_score}`,
    );
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
