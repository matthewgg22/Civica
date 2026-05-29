-- snap_enrollment — Extension OAuth 2.0 Device Authorization Grant (RFC 8628).
--
-- Source: GitHub issue #317 (V1-8, BenefitsCal bridge epic #308).
-- Plan: docs/plans/benefitscal-bridge-extension-first.md (task V1-8).
--
-- The Civica Submitter browser extension authenticates a signed-in CBO
-- assister via the device authorization grant: the extension requests a
-- device_code + user_code, the assister approves in the Civica dashboard
-- (authenticated by their Supabase JWT), and the extension polls to exchange
-- the device_code for a per-CBO access + refresh token scoped to the
-- approving user's org. This replaces the single shared EXTENSION_BEARER_TOKEN
-- (which stays valid for back-compat until the extension fully migrates).
--
-- Two tables:
--
--   1. snap_enrollment.extension_device_authorizations
--        One row per device-flow attempt. Holds the hashed device_code +
--        user_code, status (pending → approved → consumed | expired | denied),
--        expiry, the slow-down poll tracker, and — once approved — the binding
--        to the approving staff user + org. Codes are stored SHA-256-hashed,
--        never in plaintext (same posture as buddy_invite.token_hash).
--
--   2. snap_enrollment.extension_device_tokens
--        One row per issued access/refresh token pair (a "token family").
--        Both secrets are stored SHA-256-hashed. Refresh tokens rotate: each
--        refresh issues a new row and marks the prior row rotated. Reuse of an
--        already-rotated refresh token is a theft signal → the entire family
--        (family_id) is revoked. Tokens are org-scoped + user-scoped so a
--        token can only ever read its own CBO org's packets.
--
-- Security model (enforced in the enrollment-api gateway, not just here):
--   - device_code / user_code: crypto-random (Web Crypto getRandomValues),
--     single-use, time-expiring (~10 min).
--   - access token: short-lived (~1h). refresh token: rotating, reuse-detected.
--   - all secrets hashed at rest (SHA-256 hex).
--   - tokens scoped to org_id; cross-org packet reads are impossible.
--
-- RLS posture: service_role full access ONLY. These rows are server-side
-- secrets (hashed codes/tokens). No authenticated-user or applicant read path
-- exists — clients never list device codes or token rows. Mirrors the
-- buddy_invite "service_role only" stance.
--
-- Operator note: apply via the Supabase dashboard SQL editor (paste this file).
-- Civica has no automated migration pipeline; `supabase db push --linked`
-- targets PROD. See ~/.claude memory reference_supabase_migration_apply.

set search_path to snap_enrollment, public;

create extension if not exists pgcrypto;  -- gen_random_bytes(), digest()

-- ---------------------------------------------------------------------------
-- 1. extension_device_authorizations
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.extension_device_authorizations (
  device_auth_id      uuid        primary key default snap_enrollment.gen_uuidv7(),
  -- SHA-256 hex of the device_code (the long secret the extension polls with).
  device_code_hash    char(64)    not null unique,
  -- SHA-256 hex of the user_code (the short XXXX-XXXX code the assister types).
  -- Hashed too: a leaked DB snapshot must not reveal a code a stranger could
  -- approve. The dashboard approval looks up by hash, not plaintext.
  user_code_hash      char(64)    not null unique,
  status              text        not null default 'pending'
    check (status in ('pending', 'approved', 'consumed', 'expired', 'denied')),
  -- Set on approval: which staff user + org the resulting token is scoped to.
  approved_by_staff_id uuid       references snap_enrollment.staff_users(staff_id) on delete set null,
  org_id              uuid        references snap_enrollment.staff_orgs(org_id) on delete cascade,
  -- Poll-interval enforcement (RFC 8628 §3.5 slow_down). Updated on each poll.
  last_polled_at      timestamptz,
  interval_seconds    int         not null default 5,
  -- Loose, non-PII client hint for the approval screen / audit (e.g. UA string,
  -- extension id). Never trusted for auth.
  client_label        text,
  created_at          timestamptz not null default clock_timestamp(),
  updated_at          timestamptz not null default clock_timestamp(),
  expires_at          timestamptz not null,
  approved_at         timestamptz,
  consumed_at         timestamptz,
  constraint extension_device_auth_expires_after_created
    check (expires_at > created_at)
);

comment on table snap_enrollment.extension_device_authorizations is
  'RFC 8628 device authorization grant rows for the Civica Submitter '
  'extension. device_code + user_code stored SHA-256-hashed (never plaintext). '
  'Single-use, ~10-min expiry. Approved rows bind to the approving staff '
  'user + org; the issued token inherits that org scope. Service-role only.';

-- Cleanup / poll lookups hit device_code_hash (unique index covers it).
-- A partial index on pending rows speeds the expiry sweep + approval lookup.
create index if not exists extension_device_auth_pending_idx
  on snap_enrollment.extension_device_authorizations (expires_at)
  where status = 'pending';

create index if not exists extension_device_auth_org_idx
  on snap_enrollment.extension_device_authorizations (org_id)
  where org_id is not null;

drop trigger if exists extension_device_auth_updated_at
  on snap_enrollment.extension_device_authorizations;
create trigger extension_device_auth_updated_at
  before update on snap_enrollment.extension_device_authorizations
  for each row execute function snap_enrollment.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. extension_device_tokens
-- ---------------------------------------------------------------------------
--
-- One row per access/refresh token pair. family_id ties a rotation chain
-- together: the first token issued for a device_auth seeds a family, and each
-- refresh issues a NEW row with the SAME family_id, marking the prior row
-- rotated_at. Reuse of a rotated refresh token revokes the whole family
-- (sets revoked_at on every row sharing family_id) — RFC-recommended
-- refresh-token reuse detection.

create table if not exists snap_enrollment.extension_device_tokens (
  token_id            uuid        primary key default snap_enrollment.gen_uuidv7(),
  -- Rotation chain id. Stable across refreshes; revoke-the-chain keys on this.
  family_id           uuid        not null,
  device_auth_id      uuid        not null
    references snap_enrollment.extension_device_authorizations(device_auth_id) on delete cascade,
  -- Scope: the token can only ever read this org's packets. Enforced in the
  -- gateway on every /extension/* call that accepts a device token.
  org_id              uuid        not null references snap_enrollment.staff_orgs(org_id) on delete cascade,
  staff_id            uuid        not null references snap_enrollment.staff_users(staff_id) on delete cascade,
  -- SHA-256 hex of the access + refresh secrets. Plaintext is returned to the
  -- extension exactly once at issue time and never persisted.
  access_token_hash   char(64)    not null unique,
  refresh_token_hash  char(64)    not null unique,
  access_expires_at   timestamptz not null,
  refresh_expires_at  timestamptz not null,
  -- Rotation + revocation bookkeeping.
  rotated_at          timestamptz,           -- set when this refresh token is exchanged
  revoked_at          timestamptz,           -- set on family revocation (reuse-detect / approval revoke)
  revoked_reason      text,
  created_at          timestamptz not null default clock_timestamp()
);

comment on table snap_enrollment.extension_device_tokens is
  'Per-CBO extension access/refresh token pairs (RFC 8628 grant output). '
  'Both secrets SHA-256-hashed. Refresh rotation: each refresh inserts a new '
  'row sharing family_id and stamps the prior row rotated_at. Reuse of a '
  'rotated refresh token revokes the whole family. org_id + staff_id scope '
  'every packet read. Service-role only.';

create index if not exists extension_device_tokens_family_idx
  on snap_enrollment.extension_device_tokens (family_id);

create index if not exists extension_device_tokens_org_idx
  on snap_enrollment.extension_device_tokens (org_id);

-- Active-access lookup on the /extension/* hot path: hash unique index already
-- covers exact-match; this partial index keeps the live (un-revoked) set tight
-- for the expiry sweep.
create index if not exists extension_device_tokens_live_idx
  on snap_enrollment.extension_device_tokens (access_expires_at)
  where revoked_at is null and rotated_at is null;

-- ---------------------------------------------------------------------------
-- RLS — service_role only on both tables.
-- ---------------------------------------------------------------------------
--
-- These tables hold hashed secrets. No client (applicant, staff, buddy) ever
-- needs to read them directly — the gateway uses the service-role client for
-- all device-flow operations. Enabling RLS with a single service_role policy
-- (and no authenticated policy) means a leaked anon/auth JWT cannot enumerate
-- device codes or token rows.

alter table snap_enrollment.extension_device_authorizations enable row level security;
alter table snap_enrollment.extension_device_tokens enable row level security;

create policy extension_device_auth_service_role_all
  on snap_enrollment.extension_device_authorizations
  for all to service_role using (true) with check (true);

create policy extension_device_tokens_service_role_all
  on snap_enrollment.extension_device_tokens
  for all to service_role using (true) with check (true);
