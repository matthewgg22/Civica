-- Demo seed: wipe only the rows inserted by scripts/seed-demo-applicants.sql.
--
-- Identifies demo applicants by their `snap_v1::DEMO:` ciphertext prefix.
-- Deleting applicants cascades to:
--   - snap_packets        (on delete cascade from applicants)
--   - packet_status_history (on delete cascade from snap_packets)
--   - packet_answers       (on delete cascade from snap_packets)
--   - uploaded_documents   (on delete cascade from snap_packets)
--   - missing_item_requests (on delete cascade from snap_packets)
--
-- The Silo H (Demo) staff_org, role, and staff_user are PRESERVED so a
-- subsequent re-seed doesn't have to repeat the org setup.
--
-- Usage:
--   psql $DATABASE_URL -f scripts/seed-demo-applicants-CLEAR.sql

begin;

do $$
begin
  if current_database() in ('prod', 'production', 'civica_prod', 'civica_production') then
    raise exception 'Refusing to run demo CLEAR in production database: %', current_database();
  end if;
end $$;

do $$
declare
  v_deleted int;
begin
  delete from snap_enrollment.applicants
   where full_name_ciphertext like 'snap_v1::DEMO:%';
  get diagnostics v_deleted = row_count;

  raise notice '════════════════════════════════════════════════════════════';
  raise notice 'Demo CLEAR complete. % demo applicants removed.', v_deleted;
  raise notice '(packets, answers, docs, status history, missing-item requests';
  raise notice ' all cascade-deleted from applicants.)';
  raise notice '════════════════════════════════════════════════════════════';
end $$;

commit;
