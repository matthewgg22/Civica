import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Instrument Next.js server/edge runtimes
  experimental: {
    instrumentationHook: true,
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry project settings — set SENTRY_ORG and SENTRY_PROJECT in CI/Vercel env
  silent: true,
  // Upload source maps during CI builds only; skip in local dev
  disableClientWebpackPlugin: process.env.NODE_ENV !== "production",
  disableServerWebpackPlugin: process.env.NODE_ENV !== "production",
  // Tunnel Sentry requests through Next.js to avoid ad blockers
  tunnelRoute: "/monitoring",
  // Hide source map files from the public bundle
  hideSourceMaps: true,
  // Disable logging Sentry build output
  widenClientFileUpload: false,
});
