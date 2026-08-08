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
  webpack(config) {
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
