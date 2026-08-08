import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@civica/demeter-engine",
    "@civica/snap-enums",
    "@civica/snap-qc-engine",
    "@civica/snap-rules",
    "@civica/snap-calculator",
    "@civica/snap-compliance-copy",
    "@civica/analytics-engine",
  ],
  // Native-binding packages must stay out of Next's bundler. @xenova/transformers
  // (Mae's local embedding model) pulls onnxruntime-node + sharp.
  serverExternalPackages: ["@duckdb/node-api", "@xenova/transformers", "onnxruntime-node", "sharp"],
  // Vendored embedding model (packages/demeter-engine/models/) is fs-read at
  // runtime — invisible to Vercel's tracer without this include.
  outputFileTracingIncludes: {
    "/api/demeter": ["../../packages/demeter-engine/models/**"],
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
