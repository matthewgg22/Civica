import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next doesn't pick a sibling lockfile when
  // running from a Conductor worktree (two `pnpm-workspace.yaml` files visible
  // from the build dir would otherwise trigger an inferred-root warning).
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // The root URL is the applicant portal's front door — send it to the polished
  // /welcome page so there's one canonical applicant landing to maintain.
  // Temporary (307) so it's trivially reversible if a distinct marketing page
  // is ever built for /.
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
