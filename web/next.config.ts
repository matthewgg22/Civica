import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {};

const sentryOptions = {
  // Suppress Sentry CLI output in CI logs
  silent: true,
  // Upload source maps only when SENTRY_AUTH_TOKEN is present
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  hideSourceMaps: true,
  // Route Sentry event tunnel through same origin to avoid ad-blocker drops
  tunnelRoute: "/monitoring",
};

export default withSentryConfig(withNextIntl(nextConfig), sentryOptions);
