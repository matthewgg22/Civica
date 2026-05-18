import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@civica/snap-enums",
    "@civica/snap-rules",
    "@civica/snap-calculator",
    "@civica/analytics-engine",
    "@civica/cfr-273",
  ],
  // @duckdb/node-api ships native bindings; keep it out of Next's bundler.
  serverExternalPackages: ["@duckdb/node-api"],
};

export default withSentryConfig(nextConfig, {
  silent: true,
  tunnelRoute: "/monitoring",
  sourcemaps: { disable: process.env.NODE_ENV !== "production" },
  widenClientFileUpload: false,
});
