-- Live ticker pop: insert a single packet_status_history transition to
-- make the navigator dashboard's ActivityTicker (apps/dashboard/components/
-- ActivityTicker.tsx) light up during a demo.
--
-- Usage during a demo:
--   1. Open the dashboard /packets page in the demo browser tab.
--   2. In a separate terminal:
--        psql $DATABASE_URL -f scripts/demo-trigger-ticker-event.sql
--   3. Watch the ticker. Within ~1-3s a new row should appear:
--        "Packet ABCDE → In Navigator Review"
--
-- This script picks Sarah Chen's Draft packet (Sarah is the predictable
-- target — her status doesn't change across other demo flows). It moves
-- her Draft → Submitted for Review.
--
-- If Sarah was already promoted in a prior run, the script promotes the
-- next available Draft packet instead. If no Draft packets remain it
-- creates a no-op notice rather than erroring.

begin;

do $$
declare
  v_packet_id uuid;
  v_applicant_id uuid;
  v_org_id uuid;
begin
  select org_id into v_org_id
    from snap_enrollment.staff_orgs
   where name = 'Silo H (Demo)'
   limit 1;

  if v_org_id is null then
    raise notice 'No Silo H (Demo) org found. Run scripts/seed-demo-applicants.sql first.';
    return;
  end if;

  -- Find any Draft packet in the demo org. Prefer Sarah Chen by name match.
  select p.packet_id, p.applicant_id
    into v_packet_id, v_applicant_id
    from snap_enrollment.snap_packets p
    join snap_enrollment.applicants a on a.applicant_id = p.applicant_id
   where p.org_id = v_org_id
     and p.status = 'Draft'
   order by case
     when a.full_name_ciphertext = 'snap_v1::DEMO:Sarah Chen' then 0
     else 1
   end, p.created_at
   limit 1;

  if v_packet_id is null then
    raise notice 'No Draft demo packets available to promote. Run seed-demo-applicants-CLEAR + seed-demo-applicants again to reset.';
    return;
  end if;

  -- Promote the packet
  update snap_enrollment.snap_packets
     set status = 'Submitted for Review',
         submitted_at = now()
   where packet_id = v_packet_id;

  -- Append a history row (the realtime subscription is on INSERT to history,
  -- so this is what makes the ticker pop).
  insert into snap_enrollment.packet_status_history
    (packet_id, from_status, to_status,
     changed_by_applicant_id, reason, occurred_at)
  values
    (v_packet_id, 'Draft', 'Submitted for Review',
     v_applicant_id, 'Submitted via demo trigger', now());

  raise notice 'Ticker event sent: packet % promoted Draft → Submitted for Review', v_packet_id;
end $$;

commit;
