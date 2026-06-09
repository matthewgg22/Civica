// Package the built extension into a downloadable .zip for the pilot
// (load-unpacked) distribution, served by the dashboard at
// /downloads/civica-submitter.zip.
//
// Run AFTER build.mjs (the `package` npm script chains them). The zip stages the
// dist output under a `civica-submitter/` folder so unzipping yields one folder
// the officer points "Load unpacked" at (manifest.json at its root).
//
// Output is git-ignored (generated, ~1 MB binary). Re-run on every release; the
// dashboard build should run `pnpm --filter civica-submitter-extension package`
// before deploy, or set NEXT_PUBLIC_SUBMITTER_EXTENSION_ZIP_URL to a hosted asset.
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const extRoot = resolve(here, "..");
const dist = resolve(extRoot, "dist");
const stageRoot = resolve(extRoot, ".package");
const stage = resolve(stageRoot, "civica-submitter");
const outDir = resolve(extRoot, "..", "dashboard", "public", "downloads");
const out = resolve(outDir, "civica-submitter.zip");

if (!existsSync(dist)) {
  console.error("dist/ not found — run the build first (node scripts/build.mjs).");
  process.exit(1);
}

rmSync(stageRoot, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
cpSync(dist, stage, { recursive: true });
mkdirSync(outDir, { recursive: true });
rmSync(out, { force: true });
execSync(`cd "${stageRoot}" && zip -r -q "${out}" civica-submitter`, { stdio: "inherit" });
rmSync(stageRoot, { recursive: true, force: true });
console.log("✓ Packaged →", out);
