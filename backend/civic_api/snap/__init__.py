"""civicaSNAP — SNAP benefits enrollment vertical.

This package is intentionally siloed from the My Reps / VoteNow vertical.
Cross-imports between snap/ and the rest of civic_api/ should go through
explicit boundary interfaces (repository, audit logger), not direct module
references.

Persistence stance for this module is locked: SNAP sessions, conversation
turns, extracted entities, document blobs, and eligibility results are
persisted to Supabase with RLS, application-layer Fernet on PII columns,
and append-only audit logging. See plans/i-am-looking-to-fizzy-eagle.md
for the privacy decision record.
"""
