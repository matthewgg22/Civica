-- Backfill ebt_cards.county_fips from snap_packets (T4 from
-- ceo-plans/2026-05-25-ebt-monetization-dashboard.md)
--
-- Join path:
--   ebt_cards.user_id → applicants.auth_uid → snap_packets.applicant_id → snap_packets.county_fips
--
-- For users with multiple non-deleted packets, the most recent packet's
-- county_fips wins. Users with no packet remain NULL (bucketed as "00000"
-- in /ops UI per plan).
--
-- This is a one-shot backfill. Going forward, application code (the EBT link
-- handler in apps/enrollment-api) must populate county_fips at card-create
-- time, and a trigger on snap_packets.county_fips updates may be added in
-- v1.1 if county changes during enrollment become a real edge case.

SET search_path TO snap_enrollment, public;

WITH latest_packet_county AS (
  SELECT DISTINCT ON (a.auth_uid)
    a.auth_uid                                          AS user_id,
    p.county_fips
  FROM snap_enrollment.snap_packets p
  JOIN snap_enrollment.applicants  a ON a.applicant_id = p.applicant_id
  WHERE p.deleted_at IS NULL
    AND a.auth_uid IS NOT NULL
    AND p.county_fips IS NOT NULL
  ORDER BY a.auth_uid, p.updated_at DESC
)
UPDATE snap_enrollment.ebt_cards c
SET county_fips = lpc.county_fips
FROM latest_packet_county lpc
WHERE c.user_id = lpc.user_id
  AND (c.county_fips IS NULL OR c.county_fips <> lpc.county_fips);

-- Verification query (run manually post-migration; not part of the migration):
--   SELECT count(*) FILTER (WHERE county_fips IS NOT NULL) AS with_county,
--          count(*) FILTER (WHERE county_fips IS NULL)     AS without_county,
--          count(*) AS total
--   FROM snap_enrollment.ebt_cards;
