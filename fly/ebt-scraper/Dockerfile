# Civica EBT scraper — Fly machine + Playwright
#
# Multi-stage:
#   1) deps: install only prod deps + Playwright Chromium for runtime image
#   2) build: compile TypeScript -> dist/
#   3) runtime: Playwright official Chromium image + dist/ + prod node_modules
#
# Base image: mcr.microsoft.com/playwright (Node 22) ships browsers + deps preinstalled,
# which is what Fly machines need to launch headless Chromium without extra apt steps.
# See: https://mcr.microsoft.com/en-us/product/playwright

FROM mcr.microsoft.com/playwright:v1.49.0-noble AS deps

WORKDIR /app
COPY package.json package-lock.json* ./
# Note: --omit=dev gives a leaner final image; build stage installs dev deps separately
RUN npm ci --omit=dev

FROM mcr.microsoft.com/playwright:v1.49.0-noble AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.49.0-noble AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Healthcheck — Fly also runs an HTTP health check (see fly.toml); this is the container-level one
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

EXPOSE 8080

# Run as the non-root pwuser baked into the Playwright base image (uid 1000)
USER pwuser

CMD ["node", "dist/server.js"]
