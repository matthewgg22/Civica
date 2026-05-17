FROM node:22-alpine
WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# ── Workspace manifests (layer-cached until deps change) ─────────────────────
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/config/package.json       ./packages/config/
COPY packages/types/package.json        ./packages/types/
COPY packages/snap-enums/package.json   ./packages/snap-enums/
COPY packages/snap-handoff/package.json ./packages/snap-handoff/
COPY apps/api/package.json              ./apps/api/

# Install only production deps (tsx is in dependencies, not devDependencies)
RUN pnpm install --frozen-lockfile --prod

# ── Source files ──────────────────────────────────────────────────────────────
# Workspace packages consumed as TypeScript source (no build step needed;
# tsx resolves them through pnpm's node_modules symlinks at runtime)
COPY packages/config/       ./packages/config/
COPY packages/types/        ./packages/types/
COPY packages/db-types/     ./packages/db-types/
COPY packages/snap-enums/   ./packages/snap-enums/
COPY packages/snap-handoff/ ./packages/snap-handoff/
COPY apps/api/src/          ./apps/api/src/

# ── Runtime ───────────────────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app/apps/api
EXPOSE 3001

# tsx runs TypeScript directly — no compile step, workspace .ts imports work
CMD ["pnpm", "start"]
