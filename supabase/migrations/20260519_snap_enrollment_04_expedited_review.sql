-- OBBBA §10102(a) compliance: navigator distress-review gate.
--
-- Adds is_expedited to snap_packets to record whether the navigator
-- reviewed the applicant's situation and elected expedited SNAP
-- processing (7 CFR 273.2(i)) or explicitly continued standard review.
--
-- NULL  = gate not yet acted on (shown to navigator when distress criteria met)
-- TRUE  = navigator confirmed expedited routing
-- FALSE = navigator confirmed standard review
--
-- The column is set via PATCH /v1/enrollment/packets/:id and is
-- immutable once set (enforced by the application layer, not a DB
-- trigger, since navigators may need to correct a mis-click within
-- the same session before advancing the packet status).

alter table snap_enrollment.snap_packets
  add column if not exists is_expedited boolean;

comment on column snap_enrollment.snap_packets.is_expedited is
  'OBBBA §10102(a) navigator review outcome: true = expedited routing elected, false = standard review, null = gate not yet shown or acted on.';
