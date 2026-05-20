import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@civica/snap-enums",
    "@civica/snap-qc-engine",
    "@civica/snap-rules",
    "@civica/snap-calculator",
    "@civica/snap-compliance-copy",
    "@civica/analytics-engine",
  ],
  // @duckdb/node-api ships native bindings; keep it out of Next's bundler.
  serverExternalPackages: ["@duckdb/node-api"],
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
