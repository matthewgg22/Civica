#!/usr/bin/env bash
# Reference script — fill in real values then run once per app.
# DO NOT commit with real secrets. Values here are placeholders only.
#
# Usage:
#   Fill in each value below, then:
#     bash scripts/fly-secrets-set.sh

set -euo pipefail

# ── Shared between both apps ──────────────────────────────────────────────

# 32+ byte random hex. Generate: openssl rand -hex 32
INTERNAL_HMAC_SECRET="REPLACE_ME"

# Supabase project → Settings → Database → Connection string (Transaction mode)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"

# Supabase project → Settings → API
SUPABASE_URL="https://[ref].supabase.co"
SUPABASE_JWT_SECRET="REPLACE_ME"          # Settings → API → JWT Settings → JWT Secret

# ── Hono API (civica-snap-api) ────────────────────────────────────────────

SUPABASE_ANON_KEY="REPLACE_ME"            # Settings → API → anon public

# Internal Fly hostname of the FastAPI engine.
# Format: http://<app-name>.internal:<port>
ENGINE_BASE_URL="http://civica-snap-engine.internal:8080"

# OCR webhook — generate: openssl rand -hex 32
OCR_WEBHOOK_HMAC_SECRET="REPLACE_ME"

fly secrets set --config fly.api.toml \
  DATABASE_URL="$DATABASE_URL" \
  SUPABASE_JWT_SECRET="$SUPABASE_JWT_SECRET" \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  INTERNAL_HMAC_SECRET="$INTERNAL_HMAC_SECRET" \
  ENGINE_BASE_URL="$ENGINE_BASE_URL" \
  OCR_WEBHOOK_HMAC_SECRET="$OCR_WEBHOOK_HMAC_SECRET"

echo "✓ civica-snap-api secrets set"

# ── FastAPI engine (civica-snap-engine) ───────────────────────────────────

# Fernet key — generate: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
SNAP_FERNET_KEY="REPLACE_ME"

# Supabase service-role key — Settings → API → service_role (secret)
SUPABASE_SERVICE_ROLE_KEY="REPLACE_ME"

ANTHROPIC_API_KEY="REPLACE_ME"

fly secrets set --config fly.engine.toml \
  DATABASE_URL="$DATABASE_URL" \
  INTERNAL_HMAC_SECRET="$INTERNAL_HMAC_SECRET" \
  SNAP_FERNET_KEY="$SNAP_FERNET_KEY" \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"

echo "✓ civica-snap-engine secrets set"
