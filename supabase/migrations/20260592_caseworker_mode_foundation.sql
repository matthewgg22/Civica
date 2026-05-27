-- snap_enrollment — Caseworker Mode foundation tables + RLS.
--
-- Source design: docs/designs/cbo-caseworker-mode.md (APPROVED 2026-05-27,
-- ENG CLEARED via /plan-eng-review 2026-05-27).
-- Lane A foundation task T1.
--
-- Adds three tables and one column needed to support CBO caseworker mode:
--
--   1. snap_enrollment.caseworker_assignments
--        Per-user, per-org caseworker membership. NOT a global app_metadata.role
--        claim — the buddy-role pattern (feedback_buddy_role_global memory) showed
--        that global role claims silently break when a user has multiple
--        simultaneous role-bearing relationships (e.g., the same auth user is
--        both a household applicant and a CBO caseworker, or serves multiple
--        CBOs across time).
--
--        Source-of-truth row for "does user X have an active caseworker
--        assignment to CBO org Y today?" The enrollment-api session-start
--        endpoint reads this table to mint the optional
--        `active_caseworker_session` JWT claim. The role is session-scoped,
--        not permanent.
--
--   2. snap_enrollment.handoff_tickets
--        Server-side single-use tickets for caseworker → client packet
--        ownership transfer. Design A2A: a JWT-only handoff is vulnerable to
--        QR-screenshot-by-stranger attacks. Instead, the JWT carries only
--        ticket_id; the server enforces (a) 15-min expiry, (b) atomic
--        consumed_at set on first redeem (replay → 409), (c) phone-OTP bind
--        to a phone number the caseworker enters at QR generation time.
--
--        A stranger who scans the QR off a coffee-shop screen cannot complete
--        OTP because they don't own the intended phone number.
--
--   3. snap_enrollment.caseworker_actions_audit
--        Append-only attribution log for every caseworker mutation. Required
--        by the grant-reportable PER export already in the CBO SaaS plan
--        scope (docs/designs/cbo-saas-repositioning.md). Centralized at the
--        enrollment-api gateway middleware (withCaseworkerAudit) so it cannot
--        be bypassed by adding a new endpoint that forgets to log.
--
--   4. snap_enrollment.snap_packets.version (column add)
--        Optimistic concurrency control. The caseworker and the (post-handoff)
--        client may concurrently edit the same packet. Without versioning,
--        last-write-wins silently overwrites. Application layer SETs
--        version = version + 1 inside the same UPDATE that asserts
--        WHERE version = :base_version; affected-rows = 0 → 409 conflict,
--        client refreshes and retries. No trigger needed; atomic with the
--        update itself.
--
-- RLS posture:
--   - service_role: full access on all three new tables (cron + API gateway).
--   - cbo_caseworker (JWT claim derived from active_caseworker_session):
--       read own assignments, read own org's audit rows scoped to packets they
--       are assigned to, read own un-consumed handoff tickets they created.
--   - cbo_admin: read all assignments + audit rows scoped to their staff_org.
--   - applicants / household users: no direct read; tickets are server-side
--       ephemeral and audit rows are not user-facing.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 1. caseworker_assignments
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.caseworker_assignments (
  assignment_id         uuid        primary key default snap_enrollment.gen_uuidv7(),
  user_id               uuid        not null references auth.users(id) on delete cascade,
  org_id                uuid        not null references snap_enrollment.staff_orgs(org_id) on delete cascade,
  role_within_cbo       text        not null
    check (role_within_cbo in ('caseworker', 'admin')),
  assigned_at           timestamptz not null default clock_timestamp(),
  revoked_at            timestamptz,
  app_metadata_cleared_at timestamptz,
  created_at            timestamptz not null default clock_timestamp(),
  updated_at            timestamptz not null default clock_timestamp(),
  -- One active assignment per (user, org). A revoked row stays in place for
  -- audit; a new assignment to the same org becomes a new row.
  constraint caseworker_assignment_unique_active
    exclude (user_id with =, org_id with =) where (revoked_at is null)
);

comment on table snap_enrollment.caseworker_assignments is
  'Per-user, per-org caseworker membership. Source of truth for the optional '
  'JWT claim active_caseworker_session. NOT a global app_metadata.role — same '
  'auth user can be a household applicant and a caseworker serving multiple '
  'CBOs simultaneously without role-claim collision.';

create index caseworker_assignments_user_active_idx
  on snap_enrollment.caseworker_assignments (user_id) where (revoked_at is null);

create index caseworker_assignments_org_active_idx
  on snap_enrollment.caseworker_assignments (org_id) where (revoked_at is null);

alter table snap_enrollment.caseworker_assignments enable row level security;

create policy caseworker_assignments_service_role_all
  on snap_enrollment.caseworker_assignments
  for all to service_role using (true) with check (true);

create policy caseworker_assignments_self_read
  on snap_enrollment.caseworker_assignments
  for select to authenticated
  using (user_id = auth.uid());

-- cbo_admin scope: every assignment within any org where the calling user
-- holds an active admin assignment.
create policy caseworker_assignments_org_admin_read
  on snap_enrollment.caseworker_assignments
  for select to authenticated
  using (
    exists (
      select 1
      from snap_enrollment.caseworker_assignments admin
      where admin.user_id = auth.uid()
        and admin.role_within_cbo = 'admin'
        and admin.revoked_at is null
        and admin.org_id = caseworker_assignments.org_id
    )
  );

-- ---------------------------------------------------------------------------
-- 2. handoff_tickets
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.handoff_tickets (
  ticket_id              uuid        primary key default snap_enrollment.gen_uuidv7(),
  packet_id              uuid        not null references snap_enrollment.snap_packets(packet_id) on delete cascade,
  created_by_caseworker_id uuid      not null references auth.users(id) on delete cascade,
  org_id                 uuid        not null references snap_enrollment.staff_orgs(org_id) on delete cascade,
  intended_client_phone_e164 text    not null
    check (intended_client_phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  created_at             timestamptz not null default clock_timestamp(),
  expires_at             timestamptz not null,
  consumed_at            timestamptz,
  consumed_by_user_id    uuid        references auth.users(id) on delete set null,
  -- Failed OTP attempts capped at 3 per ticket (rate-limit middleware also
  -- enforces strict tier on the redeem endpoint). Stored for forensics.
  failed_otp_attempts    int         not null default 0,
  -- Enforce expires_at must be in the future relative to created_at; 15-min
  -- window per design A2A.
  constraint handoff_ticket_expires_after_created
    check (expires_at > created_at)
);

comment on table snap_enrollment.handoff_tickets is
  'Server-side single-use tickets for caseworker → client packet handoff. '
  'Defends against QR-screenshot-stranger attack via phone-OTP bind. JWT in '
  'the QR carries only ticket_id; redemption requires matching the bound '
  'phone via OTP. 15-min expiry. Atomic consumed_at set on first redeem; '
  'second redeem returns 409. Cleanup of expired rows extends the buddy-app-'
  'metadata-cleanup cron (5-min cadence) — see Lane A task T14.';

create index handoff_tickets_active_idx
  on snap_enrollment.handoff_tickets (packet_id) where (consumed_at is null);

create index handoff_tickets_cleanup_idx
  on snap_enrollment.handoff_tickets (expires_at) where (consumed_at is null);

alter table snap_enrollment.handoff_tickets enable row level security;

create policy handoff_tickets_service_role_all
  on snap_enrollment.handoff_tickets
  for all to service_role using (true) with check (true);

-- Caseworker can read their own un-consumed tickets (for "in progress
-- handoffs" UI). No one else has direct read; client-side redemption goes
-- through the enrollment-api gateway which uses service_role.
create policy handoff_tickets_caseworker_own_read
  on snap_enrollment.handoff_tickets
  for select to authenticated
  using (
    created_by_caseworker_id = auth.uid()
    and consumed_at is null
  );

-- ---------------------------------------------------------------------------
-- 3. caseworker_actions_audit
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.caseworker_actions_audit (
  audit_id                uuid        primary key default snap_enrollment.gen_uuidv7(),
  caseworker_id           uuid        not null references auth.users(id) on delete restrict,
  household_user_id       uuid        references auth.users(id) on delete set null,
  packet_id               uuid        references snap_enrollment.snap_packets(packet_id) on delete set null,
  org_id                  uuid        not null references snap_enrollment.staff_orgs(org_id) on delete restrict,
  action_type             text        not null,
  endpoint                text        not null,
  -- SHA-256 hex of the request payload, used for tamper-evidence + grant-
  -- reportable PER export. Raw payload is NOT stored here (PII surface).
  payload_digest_sha256   char(64),
  created_at              timestamptz not null default clock_timestamp()
);

comment on table snap_enrollment.caseworker_actions_audit is
  'Append-only attribution log for every caseworker mutation. Writes from the '
  'enrollment-api gateway middleware withCaseworkerAudit only — direct writes '
  'from other code paths are an architectural violation. Feeds the grant-'
  'reportable PER export in the CBO SaaS plan scope.';

-- on delete restrict on caseworker_id + org_id: audit rows must survive even
-- if a caseworker is removed or a CBO winds down. The household_user_id and
-- packet_id are set null on delete so households retain their right-to-erasure
-- while the attribution surface remains.

create index caseworker_actions_audit_org_created_idx
  on snap_enrollment.caseworker_actions_audit (org_id, created_at desc);

create index caseworker_actions_audit_caseworker_created_idx
  on snap_enrollment.caseworker_actions_audit (caseworker_id, created_at desc);

create index caseworker_actions_audit_packet_idx
  on snap_enrollment.caseworker_actions_audit (packet_id) where (packet_id is not null);

alter table snap_enrollment.caseworker_actions_audit enable row level security;

create policy caseworker_actions_audit_service_role_all
  on snap_enrollment.caseworker_actions_audit
  for all to service_role using (true) with check (true);

-- cbo_admin scope: read all audit rows for any org where the calling user
-- holds an active admin assignment.
create policy caseworker_actions_audit_admin_read
  on snap_enrollment.caseworker_actions_audit
  for select to authenticated
  using (
    exists (
      select 1
      from snap_enrollment.caseworker_assignments admin
      where admin.user_id = auth.uid()
        and admin.role_within_cbo = 'admin'
        and admin.revoked_at is null
        and admin.org_id = caseworker_actions_audit.org_id
    )
  );

-- caseworker scope: read own audit rows (for self-review).
create policy caseworker_actions_audit_self_read
  on snap_enrollment.caseworker_actions_audit
  for select to authenticated
  using (caseworker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. snap_packets.version (optimistic concurrency)
-- ---------------------------------------------------------------------------
--
-- Application-layer optimistic concurrency. Writers SET
--   version = version + 1
-- inside the same UPDATE that asserts
--   WHERE packet_id = :id AND version = :base_version.
-- If affected-rows = 0, the API returns 409 and the client refreshes.
-- No DB trigger needed — the increment is atomic with the update itself
-- and the API enforces the version check.
--
-- Default 1 so existing rows have a valid starting version. Backfill is
-- automatic because the column has a non-null default.

alter table snap_enrollment.snap_packets
  add column if not exists version bigint not null default 1;

comment on column snap_enrollment.snap_packets.version is
  'Optimistic concurrency token. API layer asserts base_version on write '
  'and SETs version = version + 1 atomically. Mismatch → 409. Required to '
  'prevent caseworker / post-handoff client silent-overwrite races.';

-- ---------------------------------------------------------------------------
-- updated_at trigger on caseworker_assignments
-- ---------------------------------------------------------------------------
--
-- Mirror the project-wide pattern: maintain updated_at on row mutations.
-- snap_enrollment.set_updated_at() already exists (used by snap_packets and
-- other tables). Wire it to caseworker_assignments.

create trigger caseworker_assignments_set_updated_at
  before update on snap_enrollment.caseworker_assignments
  for each row execute function snap_enrollment.set_updated_at();
