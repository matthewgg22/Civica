import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next doesn't pick a sibling lockfile when
  // running from a Conductor worktree (two `pnpm-workspace.yaml` files visible
  // from the build dir would otherwise trigger an inferred-root warning).
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Retire the legacy student-waitlist landing: the applicant portal home is
  // now /welcome. Temporary redirect so a real marketing page can reclaim / later.
  async redirects() {
    return [{ source: "/", destination: "/welcome", permanent: false }];
  },
  webpack(config) {
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
