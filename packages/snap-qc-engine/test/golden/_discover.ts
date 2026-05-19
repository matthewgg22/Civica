import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export interface GoldenFixture {
  flow: string;
  id: string;
  dir: string;
  inputPath: string;
  expectedPath: string;
}

export function discoverGoldenFixtures(): GoldenFixture[] {
  const out: GoldenFixture[] = [];
  const flows = readdirSync(here).filter((entry) => {
    if (entry.startsWith("_") || entry.startsWith(".")) return false;
    return statSync(join(here, entry)).isDirectory();
  });
  for (const flow of flows) {
    const flowDir = join(here, flow);
    const ids = readdirSync(flowDir).filter((id) =>
      statSync(join(flowDir, id)).isDirectory(),
    );
    for (const id of ids) {
      const dir = join(flowDir, id);
      out.push({
        flow,
        id,
        dir,
        inputPath: join(dir, "input.json"),
        expectedPath: join(dir, "expected.json"),
      });
    }
  }
  return out.sort((a, b) =>
    a.flow === b.flow ? a.id.localeCompare(b.id) : a.flow.localeCompare(b.flow),
  );
}

export const GOLDEN_ROOT = here;
