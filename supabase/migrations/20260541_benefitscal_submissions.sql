-- snap_enrollment — Migration: BenefitsCal CBO submission log
--
-- Table: snap_enrollment.benefitscal_submissions
--
-- Stores one row per BenefitsCal submission attempt for a given packet.
-- A packet may have multiple rows (retries, re-submissions after failure).
-- The most recent row for a packet is authoritative for current status.
--
-- Phase 1: rows are written with status = 'pending_review' when a navigator
--   calls POST /benefitscal/prepare-export/:packetId.
-- Phase 2: Playwright automation updates status to 'submitted' or 'failed'
--   after the navigator confirms and the automation completes.
--
-- RLS: org_id must match app.current_org_id (set by withActorContext middleware).

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.benefitscal_submissions (
  submission_id         uuid        primary key default gen_random_uuid(),
  packet_id             uuid        not null
                          references snap_enrollment.snap_packets(packet_id)
                          on delete restrict,
  org_id                uuid        not null,

  -- Payload snapshot: BenefitsCalPayload JSON at the time prepare-export ran.
  -- Never updated after creation (append-only payload history).
  payload_json          jsonb       not null,

  -- Submission outcome
  status                text        not null default 'pending_review'
                          check (status in ('pending_review', 'submitted', 'failed', 'cancelled')),
  benefitscal_confirmation_number text,
  submitted_at          timestamptz,
  submitted_by          uuid,        -- navigator staff_id

  -- Assister account used by the Playwright worker (Phase 2)
  assister_account_id   text,

  -- Consent
  consent_type          text        not null
                          check (consent_type in ('in_person', 'telephonic', 'async_portal')),
  telephonic_consent_recorded_at timestamptz,

  -- Error tracking
  error_message         text,
  retry_count           int         not null default 0,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists benefitscal_submissions_packet_id_idx
  on snap_enrollment.benefitscal_submissions (packet_id);

create index if not exists benefitscal_submissions_org_id_status_idx
  on snap_enrollment.benefitscal_submissions (org_id, status);

-- ---------------------------------------------------------------------------
-- updated_at trigger (uses the existing snap_enrollment.set_updated_at function
-- defined in migration 02 and used across all mutable tables)
-- ---------------------------------------------------------------------------

drop trigger if exists benefitscal_submissions_updated_at
  on snap_enrollment.benefitscal_submissions;

create trigger benefitscal_submissions_updated_at
  before update on snap_enrollment.benefitscal_submissions
  for each row execute function snap_enrollment.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table snap_enrollment.benefitscal_submissions enable row level security;

-- Navigators/staff may only see submissions belonging to their org.
-- The app sets app.current_org_id at the start of every request via
-- withActorContext (same pattern as snap_packets, staff_users, etc.).
drop policy if exists benefitscal_submissions_org_isolation
  on snap_enrollment.benefitscal_submissions;

create policy benefitscal_submissions_org_isolation
  on snap_enrollment.benefitscal_submissions
  using (org_id = current_setting('app.current_org_id')::uuid);

-- Service role bypasses RLS (Supabase default — no additional grant needed).
