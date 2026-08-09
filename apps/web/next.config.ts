import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next doesn't pick a sibling lockfile when
  // running from a Conductor worktree (two `pnpm-workspace.yaml` files visible
  // from the build dir would otherwise trigger an inferred-root warning).
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Workspace packages export raw TS; Next must transpile them. The engine
  // pulls @civica/snap-rules internally, so both must be listed.
  transpilePackages: ["@civica/demeter-engine", "@civica/snap-rules"],
  // Native-binding packages must stay out of Next's bundler. @xenova/transformers
  // (the engine's local embedding model) pulls onnxruntime-node + sharp.
  serverExternalPackages: ["@xenova/transformers", "onnxruntime-node", "sharp"],
  // The vendored embedding model (packages/demeter-engine/models/) is loaded
  // via fs at runtime — Vercel's file tracing can't see fs reads, so the
  // include must be explicit or the lambda ships without the weights.
  outputFileTracingIncludes: {
    "/api/demeter": ["../../packages/demeter-engine/models/**"],
  },
  // The root URL is Demeter's front door. Since the 2026-08 pivot the chat IS
  // the product, so "/" must land on it rather than the applicant-portal
  // landing page — a visitor (or a prize reviewer) typing the bare domain
  // should be able to ask a SNAP question immediately, not read marketing.
  // /welcome and the apply flow stay reachable at their own URLs.
  //
  // Destination updated 2026-08-09: /demeter merged into the screening
  // tool's own route tree as /screen/ask (same chat, /screen is now the
  // whole Demeter AI public surface). /demeter itself 301s to /screen/ask
  // so this could point straight there instead of chaining through it.
  //
  // Still temporary (307), not 308: browsers cache permanent redirects hard,
  // so a 308 would strand every prior visitor if a distinct marketing page is
  // ever built for "/". Query strings carry through automatically, which keeps
  // campaign links like /?state=CA&q=… working.
  async redirects() {
    return [{ source: "/", destination: "/screen/ask", permanent: false }];
  },
  webpack(config, { isServer }) {
    // serverExternalPackages does NOT externalize imports made from inside a
    // transpiled workspace package (demeter-engine → @xenova/transformers), so
    // webpack tries to parse onnxruntime's native .node binaries and 500s.
    // Explicit server externals leave the require to Node at runtime.
    if (isServer) {
      config.externals.push({
        // ESM package: an "import" external keeps the dynamic import() real at
        // runtime — a "commonjs" external would require() an ES module and
        // crash Node's ESM-from-CJS loader, killing the server on first use.
        "@xenova/transformers": "import @xenova/transformers",
        // CJS native packages: plain require at runtime.
        "onnxruntime-node": "commonjs onnxruntime-node",
        sharp: "commonjs sharp",
      });
    }
    // Workspace packages use .js extensions for TypeScript ESM imports (node16).
    // Webpack needs this alias to resolve ./foo.js → ./foo.ts at build time.
    // Mirrored from apps/dashboard/next.config.ts.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  tunnelRoute: "/monitoring",
  sourcemaps: { disable: process.env.NODE_ENV !== "production" },
  widenClientFileUpload: false,
});
