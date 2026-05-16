# Production image for apps/api (Hono gateway).
# Build context must be the REPO ROOT so workspace packages are available:
#   docker build -f apps/api/Dockerfile .
#
# Two-stage build: compile TypeScript in `builder`, then copy only the
# compiled output + production node_modules into a lean `runner`.

# ── Stage 1: builder ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /workspace

# Install ALL deps (including devDeps needed for tsc).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/api-types/package.json ./packages/api-types/
RUN pnpm install --frozen-lockfile

# Compile TypeScript.
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/
RUN pnpm --filter @civica/api build

# ── Stage 2: runner ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate \
  && addgroup -g 1001 -S civica \
  && adduser -u 1001 -S civica -G civica

WORKDIR /workspace

# Install ONLY production deps.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/api-types/package.json ./packages/api-types/
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output from builder.
COPY --from=builder /workspace/apps/api/dist ./apps/api/dist

USER civica
WORKDIR /workspace/apps/api

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
