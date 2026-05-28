-- snap_enrollment — Submission Lane foundation tables + RLS.
--
-- Source design: docs/designs/submission-lane-v1.md (TODO — write after this
-- migration lands; design context lives in chat history dated 2026-05-27).
--
-- Adds the "last mile" between a packet that has been reviewed and prepared
-- inside Civica and the act of actually delivering it to the agency that
-- runs the SNAP / CalFresh case. Three new objects + one extension to an
-- existing enum-adjacent column:
--
--   1. snap_enrollment.submission_status (enum)
--        Process states for a single submission attempt. Deliberately
--        DOES NOT include outcome vocabulary (Approved / Denied / etc.) —
--        that vocabulary is reserved for downstream county case states,
--        which are tracked via snap_enrollment.county_outcome on the
--        snap_packets row (migration 20260564). Submission process and
--        case outcome are different concerns.
--
--   2. snap_enrollment.submission_channel (enum)
--        Which mechanism delivered the packet. v1 targets benefitscal_cbo
--        — Civica registers as a CBO with CalSAWS, an authorized CBO
--        assister logs into BenefitsCal under their own credentials and
--        submits the prepared packet under the applicant's signed
--        ABCDM 229 release. Other values are placeholders for the
--        documented-but-deferred channels (fax via API, telephonic
--        signature, mail, in-person drop-off).
--
--   3. snap_enrollment.abcdm_229_releases
--        Applicant-signed Release of Information per CA CalFresh /
--        CalSAWS policy (this is the ONLY acceptable RoI form for CBO
--        access in BenefitsCal — confirmed via CalSAWS ABCDM 229
--        guidance, December 2024). Authorizes a specific CBO (org_id)
--        to receive case-status information for the applicant for up
--        to one year. The MA equivalent is a different form; this
--        table is CA-specific by design (state_code constrained to
--        'CA'). When MA support lands, add a parallel
--        ma_dta_release table or generalize with a release_kind
--        enum — do NOT silently overload this CA-specific schema.
--
--   4. snap_enrollment.packet_submissions
--        One row per submission ATTEMPT. A packet may have multiple
--        attempts: a failed submission (e.g., BenefitsCal portal
--        error, missing document caught by county, county requested
--        re-submission) creates a new row with attempt_number = N+1.
--        The latest row reflects the current submission state; the
--        history is preserved for audit and PER reporting.
--
--   5. snap_enrollment.packet_submission_events
--        Append-only event log mirroring packet_status_history.
--        Every status transition + significant operational event
--        (queued by applicant, picked up by assister, fields filled,
--        external case number captured, status sync from external
--        system) writes a row. Blocked from UPDATE and DELETE by
--        trigger.
--
-- Legal posture (v1 is benefitscal_cbo channel):
--   - Civica must be a registered CBO with CalSAWS before any rows
--     reference org_ids tied to BenefitsCal submission. The schema
--     does not enforce CBO registration — that's an operational gate
--     enforced by application code + onboarding.
--   - Every packet_submissions row MUST reference an abcdm_229_releases
--     row that is signed, not revoked, and not expired at submitted_at
--     time. This is enforced at the application layer (gateway route)
--     not at the DB level, because the DB cannot easily compare
--     timestamps against a moving "now" for IS NOT REVOKED checks.
--   - The submitted_by_staff_id column captures the human assister
--     whose click is the legal attestation event. The attestation_kind
--     column is future-proofing: today every row is
--     'human_assister_review' (a human reviewed Civica's prep and
--     clicked submit). If CDSS ever sanctions automated submission via
--     a service credential, a new attestation_kind value is added.
--     The column existing now does NOT permit autonomous submission —
--     it just means the schema won't need a migration if policy ever
--     changes.
--
-- RLS posture:
--   - service_role: full access on all new tables (cron + API gateway).
--   - applicant (auth.uid() = applicants.auth_uid):
--       Read own release rows + own submission rows. No write — all
--       writes happen via the enrollment-api gateway under service_role.
--   - staff_users at the assigned org_id:
--       Read submissions for packets routed to their org. Read releases
--       for those same packets. Write submissions via the gateway (the
--       gateway authenticates the staff user, then uses service_role
--       for the DB write while recording submitted_by_staff_id).
--   - cbo_admin (existing caseworker_assignments admin role):
--       Read all submissions and releases within their org.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type snap_enrollment.submission_status as enum (
    'queued',                 -- applicant tapped submit; awaiting assister pickup
    'in_review',              -- assister has opened the case; reviewing
    'submitted_to_external',  -- assister submitted via channel; awaiting confirmation
    'confirmed',              -- external system acknowledged receipt (e.g., BenefitsCal case # captured)
    'failed',                 -- submission attempt failed; new attempt may be created
    'cancelled'               -- applicant withdrew or release revoked before submit
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type snap_enrollment.submission_channel as enum (
    'benefitscal_cbo',  -- v1: Civica CBO assister submits via BenefitsCal CBO portal
    'fax',              -- placeholder: county intake fax via API (Twilio/Documo)
    'mail',             -- placeholder: paper-mail via Lob or similar
    'in_person',        -- placeholder: applicant-presented packet at county office
    'telephone'         -- placeholder: 3-way call with county hotline + verbal assent
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type snap_enrollment.submission_attestation_kind as enum (
    'human_assister_review',         -- v1: human reviewed prep + clicked submit
    'auto_fast_track_human_confirm', -- future: low-risk score auto-prepped, human confirmed
    'civica_sanctioned_agent'        -- future: if CDSS ever explicitly sanctions automated submitter
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 1. abcdm_229_releases
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.abcdm_229_releases (
  release_id              uuid        primary key default snap_enrollment.gen_uuidv7(),
  applicant_id            uuid        not null references snap_enrollment.applicants(applicant_id) on delete cascade,
  packet_id               uuid        not null references snap_enrollment.snap_packets(packet_id) on delete cascade,
  org_id                  uuid        not null references snap_enrollment.staff_orgs(org_id) on delete restrict,
  state_code              snap_enrollment.launch_state not null,
  form_version            text        not null,
    -- e.g., 'abcdm-229-2024-12'. Track which revision of the CalSAWS form
    -- was signed; counties occasionally update the form and old releases
    -- may need re-signing if revisions are material.
  signed_pdf_storage_key  text        not null,
    -- Path / object key in Supabase Storage for the fully-rendered signed PDF.
    -- The PDF itself contains the applicant's name, signature, date — all PII.
    -- Storage bucket policies enforce signed-URL access only.
  signature_attestation_ciphertext text not null,  -- COMMENT 'PII'
    -- Fernet-encrypted JSON blob with signature metadata: signed-image-hash,
    -- signature method (touch / typed / drawn), timestamp, user-agent,
    -- consent text version. Used to defend the signature in any dispute.
  signed_at               timestamptz not null default clock_timestamp(),
  expires_at              timestamptz not null,
    -- Default in application code: signed_at + interval '1 year' per CalSAWS
    -- guidance. DB check enforces expires_at > signed_at.
  revoked_at              timestamptz,
  revoke_reason           text,
  ip_address_ciphertext   text,  -- COMMENT 'PII' (optional, attestation evidence)
  created_at              timestamptz not null default clock_timestamp(),
  updated_at              timestamptz not null default clock_timestamp(),

  -- State-specific guard: this table is for CA's ABCDM 229 form only.
  -- MA / other states must use a sibling table or future generalization.
  constraint abcdm_229_state_is_ca
    check (state_code = 'CA'),

  -- Expiry must be after signing.
  constraint abcdm_229_expires_after_signed
    check (expires_at > signed_at),

  -- One active (non-revoked, non-expired) release per (packet, org). A new
  -- signature creates a new row; revoking the old happens in app code
  -- inside a transaction.
  constraint abcdm_229_unique_active
    exclude (packet_id with =, org_id with =) where (revoked_at is null)
);

comment on table snap_enrollment.abcdm_229_releases is
  'Applicant-signed CalSAWS ABCDM 229 Release of Information. Authorizes a '
  'specific CBO (org_id) to receive case-status information from BenefitsCal / '
  'CalSAWS for the applicant for up to 1 year. CA-specific (state_code = CA '
  'check constraint). MA equivalent goes in a sibling table to keep state-'
  'specific legal artifacts cleanly separated.';

comment on column snap_enrollment.abcdm_229_releases.signed_pdf_storage_key is
  'Supabase Storage object key for the fully-rendered signed PDF. The PDF is '
  'PII; storage bucket enforces signed-URL-only access.';

comment on column snap_enrollment.abcdm_229_releases.signature_attestation_ciphertext is
  'PII — Fernet-encrypted JSON with signature metadata: image hash, method, '
  'timestamp, user-agent, consent text version. Defends signature in dispute.';

comment on column snap_enrollment.abcdm_229_releases.ip_address_ciphertext is 'PII';

create index if not exists abcdm_229_releases_packet_active_idx
  on snap_enrollment.abcdm_229_releases (packet_id)
  where (revoked_at is null);

create index if not exists abcdm_229_releases_org_active_idx
  on snap_enrollment.abcdm_229_releases (org_id)
  where (revoked_at is null);

create index if not exists abcdm_229_releases_applicant_idx
  on snap_enrollment.abcdm_229_releases (applicant_id, signed_at desc);

create index if not exists abcdm_229_releases_expiry_cleanup_idx
  on snap_enrollment.abcdm_229_releases (expires_at)
  where (revoked_at is null);

drop trigger if exists abcdm_229_releases_updated_at on snap_enrollment.abcdm_229_releases;
create trigger abcdm_229_releases_updated_at
  before update on snap_enrollment.abcdm_229_releases
  for each row execute function snap_enrollment.set_updated_at();

alter table snap_enrollment.abcdm_229_releases enable row level security;

create policy abcdm_229_releases_service_role_all
  on snap_enrollment.abcdm_229_releases
  for all to service_role using (true) with check (true);

-- Applicant can read their own releases (for "your authorizations" screen).
create policy abcdm_229_releases_applicant_own_read
  on snap_enrollment.abcdm_229_releases
  for select to authenticated
  using (
    exists (
      select 1
      from snap_enrollment.applicants a
      where a.applicant_id = abcdm_229_releases.applicant_id
        and a.auth_uid = auth.uid()
    )
  );

-- Staff at the same org can read releases authorizing their org.
create policy abcdm_229_releases_org_staff_read
  on snap_enrollment.abcdm_229_releases
  for select to authenticated
  using (
    exists (
      select 1
      from snap_enrollment.staff_users su
      where su.auth_uid = auth.uid()
        and su.deleted_at is null
        and su.org_id = abcdm_229_releases.org_id
    )
  );

-- ---------------------------------------------------------------------------
-- 2. packet_submissions
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.packet_submissions (
  submission_id           uuid        primary key default snap_enrollment.gen_uuidv7(),
  packet_id               uuid        not null references snap_enrollment.snap_packets(packet_id) on delete cascade,
  org_id                  uuid        not null references snap_enrollment.staff_orgs(org_id) on delete restrict,
  release_id              uuid        references snap_enrollment.abcdm_229_releases(release_id) on delete set null,
    -- ON DELETE SET NULL on release_id: a submission row must survive even if
    -- the underlying release row is wiped (e.g., applicant consent withdrawal
    -- cascades through applicants). The submission row preserves attestation
    -- attribution even after the release is gone.
  attempt_number          int         not null default 1
    check (attempt_number >= 1),

  channel                 snap_enrollment.submission_channel not null,
  status                  snap_enrollment.submission_status  not null default 'queued',

  -- Who attested (clicked submit). Required for any status >= 'submitted_to_external'.
  -- Enforced at the application layer because the constraint depends on a value transition.
  submitted_by_staff_id   uuid        references snap_enrollment.staff_users(staff_id) on delete restrict,
  attestation_kind        snap_enrollment.submission_attestation_kind,
    -- Null while status is 'queued' or 'cancelled'; required for submitted /
    -- confirmed / failed states. App-layer enforced.

  -- Snapshot of the review summary the assister attested to. Includes
  -- scoreErrorRisk, retentionRisk, rule check pass/fail, doc completeness
  -- flags, threshold tier. Frozen at submit time so the attestation has
  -- forensic clarity: "this is exactly what the assister saw when they
  -- clicked submit".
  review_summary_jsonb    jsonb,

  -- Channel-specific destination metadata. For benefitscal_cbo:
  --   { "county_fips": "06037", "benefitscal_org_id": "<cbo manager id>" }
  -- For fax (future):
  --   { "county_fips": "06037", "fax_e164": "+16613167500" }
  -- Validated at the app layer per-channel.
  destination_jsonb       jsonb       not null default '{}'::jsonb,

  -- External-system reference, captured when the assister records the
  -- BenefitsCal case number from the success screen.
  external_case_number    text,
  external_status         text,
  external_status_last_synced_at timestamptz,

  -- Phase timestamps. NULL until the phase is entered.
  queued_at               timestamptz not null default clock_timestamp(),
  in_review_at            timestamptz,
  submitted_at            timestamptz,
  confirmed_at            timestamptz,
  failed_at               timestamptz,
  cancelled_at            timestamptz,

  failure_reason          text,
  cancellation_reason     text,

  created_at              timestamptz not null default clock_timestamp(),
  updated_at              timestamptz not null default clock_timestamp(),

  -- Only one active (non-terminal) submission per packet at a time.
  -- Terminal states: confirmed, failed, cancelled.
  constraint packet_submissions_one_active_per_packet
    exclude (packet_id with =)
    where (status in ('queued', 'in_review', 'submitted_to_external')),

  -- Attempt numbers are unique per packet.
  constraint packet_submissions_attempt_unique
    unique (packet_id, attempt_number)
);

comment on table snap_enrollment.packet_submissions is
  'One row per submission attempt for a packet. Multiple attempts allowed '
  '(failed/retried). The latest row reflects current state; history kept for '
  'audit + PER reporting. Application layer enforces: release_id required '
  'before status >= submitted_to_external, submitted_by_staff_id required '
  'with attestation_kind for any human-actioned status.';

comment on column snap_enrollment.packet_submissions.review_summary_jsonb is
  'Snapshot of error_risk / retention_risk / rule-check results frozen at '
  'submit time. Forensic clarity: this is exactly what the assister saw '
  'when they attested to accuracy.';

comment on column snap_enrollment.packet_submissions.destination_jsonb is
  'Channel-specific destination metadata. For benefitscal_cbo: county_fips + '
  'benefitscal CBO manager id. For fax: county_fips + e164 fax number. '
  'Validated per-channel at the application layer.';

create index if not exists packet_submissions_packet_idx
  on snap_enrollment.packet_submissions (packet_id, attempt_number desc);

create index if not exists packet_submissions_org_status_idx
  on snap_enrollment.packet_submissions (org_id, status, queued_at);

create index if not exists packet_submissions_status_queue_idx
  on snap_enrollment.packet_submissions (status, queued_at)
  where (status in ('queued', 'in_review'));

create index if not exists packet_submissions_external_case_idx
  on snap_enrollment.packet_submissions (external_case_number)
  where (external_case_number is not null);

drop trigger if exists packet_submissions_updated_at on snap_enrollment.packet_submissions;
create trigger packet_submissions_updated_at
  before update on snap_enrollment.packet_submissions
  for each row execute function snap_enrollment.set_updated_at();

alter table snap_enrollment.packet_submissions enable row level security;

create policy packet_submissions_service_role_all
  on snap_enrollment.packet_submissions
  for all to service_role using (true) with check (true);

-- Applicant can read their own submissions (for iOS "submission status" UI).
create policy packet_submissions_applicant_own_read
  on snap_enrollment.packet_submissions
  for select to authenticated
  using (
    exists (
      select 1
      from snap_enrollment.snap_packets sp
      join snap_enrollment.applicants a on a.applicant_id = sp.applicant_id
      where sp.packet_id = packet_submissions.packet_id
        and a.auth_uid = auth.uid()
    )
  );

-- Staff at the same org can read submissions for their org (assister queue UI).
create policy packet_submissions_org_staff_read
  on snap_enrollment.packet_submissions
  for select to authenticated
  using (
    exists (
      select 1
      from snap_enrollment.staff_users su
      where su.auth_uid = auth.uid()
        and su.deleted_at is null
        and su.org_id = packet_submissions.org_id
    )
  );

-- ---------------------------------------------------------------------------
-- 3. packet_submission_events
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.packet_submission_events (
  event_id            uuid        primary key default snap_enrollment.gen_uuidv7(),
  submission_id       uuid        not null references snap_enrollment.packet_submissions(submission_id) on delete cascade,
  from_status         snap_enrollment.submission_status,  -- null on initial insert
  to_status           snap_enrollment.submission_status not null,

  actor_kind          snap_enrollment.audit_actor_kind not null,
  actor_staff_id      uuid        references snap_enrollment.staff_users(staff_id) on delete set null,
  actor_applicant_id  uuid        references snap_enrollment.applicants(applicant_id) on delete set null,

  -- Event-type-specific payload. Examples:
  --   prep_fill_complete: { "fields_filled": 87, "duration_seconds": 134 }
  --   external_case_captured: { "external_case_number": "BC-12345678" }
  --   external_status_sync: { "old_status": "Pending", "new_status": "Approved" }
  --   submission_failed: { "error_code": "...", "stage": "doc_upload_3_of_5" }
  payload_jsonb       jsonb       not null default '{}'::jsonb,

  reason              text,
  occurred_at         timestamptz not null default clock_timestamp()
);

comment on table snap_enrollment.packet_submission_events is
  'Append-only event log for packet_submissions. Mirrors packet_status_history '
  'pattern: blocked from UPDATE/DELETE by trigger. Every status transition + '
  'significant operational event writes a row.';

create index if not exists packet_submission_events_submission_idx
  on snap_enrollment.packet_submission_events (submission_id, occurred_at desc);

create index if not exists packet_submission_events_to_status_idx
  on snap_enrollment.packet_submission_events (to_status, occurred_at desc);

-- Reuse the existing block_status_history_mutation function (defined in
-- migration 20260517 alongside packet_status_history) — it already raises
-- 42501 on UPDATE / DELETE.
drop trigger if exists submission_events_no_update on snap_enrollment.packet_submission_events;
create trigger submission_events_no_update
  before update on snap_enrollment.packet_submission_events
  for each row execute function snap_enrollment.block_status_history_mutation();

drop trigger if exists submission_events_no_delete on snap_enrollment.packet_submission_events;
create trigger submission_events_no_delete
  before delete on snap_enrollment.packet_submission_events
  for each row execute function snap_enrollment.block_status_history_mutation();

alter table snap_enrollment.packet_submission_events enable row level security;

create policy packet_submission_events_service_role_all
  on snap_enrollment.packet_submission_events
  for all to service_role using (true) with check (true);

-- Applicant can read events for their own submissions.
create policy packet_submission_events_applicant_own_read
  on snap_enrollment.packet_submission_events
  for select to authenticated
  using (
    exists (
      select 1
      from snap_enrollment.packet_submissions ps
      join snap_enrollment.snap_packets sp on sp.packet_id = ps.packet_id
      join snap_enrollment.applicants a on a.applicant_id = sp.applicant_id
      where ps.submission_id = packet_submission_events.submission_id
        and a.auth_uid = auth.uid()
    )
  );

-- Staff at the same org can read events for submissions to their org.
create policy packet_submission_events_org_staff_read
  on snap_enrollment.packet_submission_events
  for select to authenticated
  using (
    exists (
      select 1
      from snap_enrollment.packet_submissions ps
      join snap_enrollment.staff_users su on su.org_id = ps.org_id
      where ps.submission_id = packet_submission_events.submission_id
        and su.auth_uid = auth.uid()
        and su.deleted_at is null
    )
  );
