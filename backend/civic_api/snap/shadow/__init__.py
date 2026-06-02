"""Shadow eligibility sweep — the Eligibility & Integrity Engine, wired read-only.

This package runs the existing deterministic rules engine over the LIVE
enrollment packets (snap_enrollment.*) and persists a cited, replayable
determination + rule trace into snap_enrollment.eligibility_determinations /
eligibility_rule_trace (migration 20260602). It changes nothing in the
applicant/navigator flow — it only reads packets and writes determinations.

See docs/plans/snap-rules-matrix.md (the Eligibility and Integrity Engine) and
docs/plans/snap-rules-audit-pathway.md for the design this implements.

Modules:
  rest    — schema-aware PostgREST client (snap_enrollment schema, service_role).
  adapter — packet_answers -> Household, provenance-stamped, missing -> `needs`.
  sweep   — the batch entry point (dry-run by default; --write to persist).
"""
