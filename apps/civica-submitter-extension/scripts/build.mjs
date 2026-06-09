// Civica Submitter extension build script.
//
// Produces a sideload-ready dist/ directory:
//   dist/manifest.json    (copied verbatim)
//   dist/background.js    (esbuild bundled, ESM)
//   dist/content.js       (esbuild bundled, IIFE so it runs inside the page's
//                         isolated world without import-statement issues)
//   dist/options.html     (copied)
//   dist/options.js       (esbuild bundled, IIFE)
//
// Run from package root: `node scripts/build.mjs`.

import { build } from "esbuild";
import { copyFileSync, mkdirSync, rmSync, existsSync, cpSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = resolve(root, "dist");

// Fresh dist on every build — extension packagers don't like stale leftovers.
if (existsSync(dist)) rmSync(dist, { recursive: true });
mkdirSync(dist, { recursive: true });

// 1. Bundle entrypoints.
//    background.js: service worker, ESM is permitted (and required by our manifest "type": "module").
//    content.js + options.js: IIFE so they don't trip module-loader edge cases
//    inside content-script isolation or static <script src> tags.
const shared = {
  bundle: true,
  platform: "browser",
  target: ["chrome120"],
  sourcemap: "inline",
  logLevel: "info",
};

await build({
  ...shared,
  entryPoints: [resolve(root, "src/background.ts")],
  outfile: resolve(dist, "background.js"),
  format: "esm",
});

await build({
  ...shared,
  entryPoints: [resolve(root, "src/content.ts")],
  outfile: resolve(dist, "content.js"),
  format: "iife",
});

await build({
  ...shared,
  entryPoints: [resolve(root, "src/options.ts")],
  outfile: resolve(dist, "options.js"),
  format: "iife",
});

// popup.js: the action popup (Connect-with-Civica device flow + packet picker,
// #317). IIFE so the inline <script src> loads without module-loader quirks.
await build({
  ...shared,
  entryPoints: [resolve(root, "src/popup.ts")],
  outfile: resolve(dist, "popup.js"),
  format: "iife",
});

// 2. Copy static assets.
copyFileSync(resolve(root, "manifest.json"), resolve(dist, "manifest.json"));
copyFileSync(resolve(root, "src/options.html"), resolve(dist, "options.html"));
copyFileSync(resolve(root, "src/popup.html"), resolve(dist, "popup.html"));
// Toolbar + store icons (16/32/48/128), referenced by manifest.icons +
// action.default_icon. Required for a Chrome Web Store listing.
cpSync(resolve(root, "src/icons"), resolve(dist, "icons"), { recursive: true });

console.log("✓ Built dist/ — load it as an unpacked extension via chrome://extensions");
