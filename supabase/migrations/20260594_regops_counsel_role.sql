-- regops — Counsel reviewer role + domain-scoped RLS (E4).
--
-- Source design: docs/designs/regops-engine.md §Architectural Decisions D5
-- (eng review 2026-05-27). The RegOps Engine's counsel queue is reviewed
-- by external lawyers (state policy counsel, federal SNAP counsel, FTC
-- marketing counsel) who don't fit the existing staff / buddy / applicant
-- RBAC categories. This migration adds the counsel role infrastructure
-- so the queue is usable on day 1 — critical path to T11.
--
-- Design decisions (informed by feedback_buddy_role_global memory):
--
--   1. Per-relationship assignments, NOT a global app_metadata claim.
--      A counsel reviewer may eventually serve more than one domain
--      (e.g., the same attorney covers both CA + MA SNAP policy). A
--      global "role: counsel" JWT claim works for routing but cannot
--      express WHICH domain(s) they're approved for. The
--      counsel_assignments table is the source of truth for domain
--      scope; the JWT role just unlocks the /regops/* route prefix.
--
--   2. Domain enum, not free-form text. Drift between "FTC" / "ftc" /
--      "Ftc" in policy expressions is exactly the bug class we're
--      avoiding by formalizing the contract.
--
--   3. RLS posture: counsel can SELECT their domain's source_audit_log
--      rows (and future counsel queue tables). They CANNOT see other
--      domains. service_role retains full access via the existing
--      source_audit_log_service_role_all policy.
--
--   4. Source-id → domain mapping lives in a SQL function so the RLS
--      policy can use it. The mapping mirrors the SourceAdapter
--      registry conventions (federal-fns-cola, ca-cdss-acl, ma-dta-
--      charts, ftc-actions). Adding a new adapter requires updating
--      this function and the policy stays correct.
--
-- References:
--   - docs/designs/regops-engine.md §Architectural Decisions D5
--   - docs/regops/runbook.md §"Counsel reviewer offboarding"
--   - docs/regops/source-adapters.md §"Counsel roster"
--   - Memory: feedback_buddy_role_global (why per-relationship beats
--     global JWT claim)

-- ---------------------------------------------------------------------------
-- 1. Domain enum
-- ---------------------------------------------------------------------------

do $$ begin
  create type regops.counsel_domain as enum ('federal', 'CA', 'MA', 'FTC');
exception
  when duplicate_object then null;
end $$;

comment on type regops.counsel_domain is
  'Domains a counsel reviewer can be assigned to. Mirrors the four counsel '
  'tracks in docs/regops/source-adapters.md §"Counsel roster": federal SNAP '
  'policy, CA state policy, MA state policy, FTC marketing.';

-- ---------------------------------------------------------------------------
-- 2. counsel_assignments table
-- ---------------------------------------------------------------------------

create table if not exists regops.counsel_assignments (
  assignment_id  uuid                  primary key default snap_enrollment.gen_uuidv7(),
  user_id        uuid                  not null references auth.users(id) on delete cascade,
  domain         regops.counsel_domain not null,
  -- Free-form note for ops: which firm, billing contact, onboarding date.
  -- Not RLS-visible to counsel themselves; only service_role can read.
  notes          text,
  assigned_at    timestamptz           not null default clock_timestamp(),
  -- Revocation = soft delete. Historical signoffs by a revoked reviewer
  -- remain attributable; only the ability to NEW work is removed.
  -- See docs/regops/runbook.md §"Counsel reviewer offboarding".
  revoked_at     timestamptz,
  unique (user_id, domain)
);

comment on table regops.counsel_assignments is
  'Per-(user, domain) authorization for counsel reviewers. Source of truth '
  'for "is user X allowed to review domain Y today." A user with no rows '
  'here cannot see any counsel queue content even if their JWT role is '
  '''counsel''. See docs/designs/regops-engine.md §D5.';

-- Active assignment lookup (the hot path).
create index counsel_assignments_active_idx
  on regops.counsel_assignments (user_id, domain) where (revoked_at is null);

-- Per-domain rosters (ops dashboard "who's reviewing CA today").
create index counsel_assignments_domain_active_idx
  on regops.counsel_assignments (domain) where (revoked_at is null);

-- ---------------------------------------------------------------------------
-- 3. Authorization helpers
-- ---------------------------------------------------------------------------

create or replace function regops.is_active_counsel_for(
  p_user_id uuid,
  p_domain regops.counsel_domain
) returns boolean
  language sql stable
  set search_path = regops, public
  as $$
    select exists (
      select 1
      from regops.counsel_assignments
      where user_id = p_user_id
        and domain = p_domain
        and revoked_at is null
    );
  $$;

comment on function regops.is_active_counsel_for(uuid, regops.counsel_domain) is
  'Returns true iff (p_user_id, p_domain) has an active assignment in '
  'regops.counsel_assignments. Used by RLS policies on regops tables '
  'and by the dashboard counselAuth helper.';

create or replace function regops.source_id_to_domain(p_source_id text)
  returns regops.counsel_domain
  language sql immutable
  as $$
    select case
      when p_source_id like 'federal-%' or p_source_id = 'federal-register-snap'
        then 'federal'::regops.counsel_domain
      when p_source_id like 'usda-%' then 'federal'::regops.counsel_domain
      when p_source_id like 'ca-%' then 'CA'::regops.counsel_domain
      when p_source_id like 'ma-%' then 'MA'::regops.counsel_domain
      when p_source_id like 'ftc-%' then 'FTC'::regops.counsel_domain
      else null
    end;
  $$;

comment on function regops.source_id_to_domain(text) is
  'Maps SourceAdapter.id (e.g. ca-cdss-acl, usda-fns-cola) to its '
  'counsel domain. Mirrors the adapter registry conventions in '
  'docs/regops/source-adapters.md. Returns NULL for unknown source_id '
  'so RLS policies fail-closed on unmapped sources — adding a new '
  'adapter requires updating this function before counsel can see it.';

-- ---------------------------------------------------------------------------
-- 4. RLS on counsel_assignments
-- ---------------------------------------------------------------------------

alter table regops.counsel_assignments enable row level security;

create policy counsel_assignments_service_role_all
  on regops.counsel_assignments
  for all to service_role using (true) with check (true);

-- A counsel reviewer can see their OWN assignments (so the dashboard
-- can show "you're reviewing for domain X"). They cannot see other
-- reviewers' assignments — that's an operational roster, not a peer-
-- visible artifact.
create policy counsel_assignments_self_read
  on regops.counsel_assignments
  for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. RLS on regops.source_audit_log — domain-scoped counsel read
-- ---------------------------------------------------------------------------
--
-- The existing source_audit_log_service_role_all policy (from
-- 20260593_regops_audit_log.sql) stays. This adds a SELECT policy for
-- the 'authenticated' role: a row is visible if the calling user has an
-- active counsel_assignment for the source's domain.
--
-- Engine-internal SELECTs continue to go through service_role (via the
-- enrollment-api gateway impersonation pattern); this policy is the
-- counsel-facing path.

create policy source_audit_log_counsel_domain_read
  on regops.source_audit_log
  for select to authenticated
  using (
    regops.is_active_counsel_for(
      auth.uid(),
      regops.source_id_to_domain(source_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------
--
-- Supabase's PostgREST exposes schemas listed in db.schemas. The regops
-- schema needs USAGE for authenticated + service_role so counsel can
-- reach the audit log via the dashboard's existing Supabase client.

grant usage on schema regops to authenticated, service_role;
grant select on regops.counsel_assignments to authenticated;
grant select on regops.source_audit_log to authenticated;
grant execute on function regops.is_active_counsel_for(uuid, regops.counsel_domain)
  to authenticated, service_role;
grant execute on function regops.source_id_to_domain(text)
  to authenticated, service_role;
