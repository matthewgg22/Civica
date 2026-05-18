import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: ["@civica/snap-rules", "@civica/snap-calculator"],
};

export default withSentryConfig(nextConfig, {
  silent: true,
  tunnelRoute: "/monitoring",
  sourcemaps: { disable: process.env.NODE_ENV !== "production" },
  widenClientFileUpload: false,
});
