# civicaSNAP incident response runbook

Read this when something has gone wrong. Each section is self-contained. Do not skip the "first 10 minutes" section — even if the incident looks routine.

---

## First 10 minutes (always)

1. **Open a timeline.** Date-stamped notes in a shared doc. Every action you take from this point goes into the timeline.
2. **Page the on-call engineer.** Even if you ARE the on-call engineer, write down "paged self at HH:MM."
3. **Don't panic-mutate.** Do not run `delete`, `truncate`, `drop`, or `revoke` against production. Containment comes BEFORE remediation.
4. **Check the audit-coverage CI pipeline status.** If it's red, the incident may be a known coverage gap.
5. **Decide severity:**
   - **SEV-1**: confirmed PII leak, prod outage, or regulator inquiry
   - **SEV-2**: suspected leak, partial outage, audit-log gap
   - **SEV-3**: anomaly worth investigating but no user impact

---

## Scenario A — User reports their data may have leaked

### What to ask the user

- Approximate session date range
- The channel they used for magic-link recovery (phone or email) — this is how we find their session_id
- What specifically they saw that suggests a leak (screenshot if possible, redacted)

### What to check

```bash
# Pull every audit entry for the session.
python3 -c "
from datetime import datetime, timedelta, timezone
from backend.civic_api.snap.audit.queries import list_entries_for_session
import json
for entry in list_entries_for_session('<session_id>'):
    print(json.dumps(entry, default=str))
"
```

Look specifically for:
- `pii_field_decrypted` entries from actor_kinds other than `background_job` (orchestrator) and `admin` (you)
- Any `action` you don't recognize
- Decryption events outside the expected sequence (e.g. decryption events for a session that hasn't had a conversation turn)

### If a leak is confirmed

1. Escalate to SEV-1 immediately. Notify counsel within 1 hour.
2. Identify the scope: how many sessions had data accessed by the unexpected actor?
3. Rotate `SNAP_FERNET_KEY` per [key_rotation.md](key_rotation.md). All future ciphertext is unreadable to whoever has the prior key.
4. Notify affected users via the channel of record. Template language is in counsel's incident-response folder.
5. File a post-incident review within 48 hours.

---

## Scenario B — Audit log has gaps

If the audit-coverage CI test is failing, or production audit query results are missing entries you'd expect:

1. **Don't trust the application.** Stop new traffic to the affected endpoint(s) before investigating. Audit-log gaps mean we can't reconstruct what happened.
2. Run the audit-coverage CI test locally against the deployed commit:
   ```bash
   /usr/bin/python3 -m pytest tests/snap/compliance/test_audit_coverage.py -v
   ```
3. If CI was green and prod has gaps, the issue is environmental:
   - Is `snap_audit_log` accessible? PostgREST returning 4xx/5xx on inserts?
   - Is the `snap_audit_log_block_mutation` trigger somehow blocking inserts (it shouldn't — only update/delete)?
   - Has the audit sink swallowed an exception? Check `AUDIT_SINK_FAILURE` log lines.
4. Once the gap is identified and fixed, document the time window where audit entries are missing in the post-incident review. That window cannot be reconstructed.

---

## Scenario C — Suspicious decryption rate

The compliance dashboard reports an unusually high count of `pii_field_decrypted` events.

### What to check

```bash
python3 -c "
from datetime import datetime, timedelta, timezone
from backend.civic_api.snap.audit.queries import list_decryption_events
since = datetime.now(timezone.utc) - timedelta(hours=24)
events = list_decryption_events(since=since)
from collections import Counter
print('Decryption events in last 24h:', len(events))
print('By actor_id:', Counter(e['actor_id'] for e in events).most_common(10))
print('By actor_kind:', Counter(e['actor_kind'] for e in events).most_common())
"
```

Expected baseline (rule of thumb):
- Average user session: ~10–20 decryption events (one per turn for state read, plus PDF generation reads)
- 24-hour total: roughly `active_sessions * 15`

If the rate is 5×+ baseline:
- **Spike from one actor_id**: likely a runaway script or compromised credential. Block that actor immediately.
- **Even spike across actors**: likely a code regression that's reading PII for no reason. Find the deploy that started the spike, roll back if recent.

---

## Scenario D — Wrong eligibility verdict surfaced to a user

A user contacts support saying they were told they qualified (or didn't qualify) and the state disagrees.

### What to check

1. Pull the session's `snap_eligibility_results` row. Decrypt the `result_ciphertext` column.
2. Re-run the rules engine against the same `household_snapshot_ciphertext` and the same `effective_date` and `rules_version`. The result MUST match bit-for-bit.
3. If it doesn't match, the rules engine has a determinism bug. SEV-2 (no PII issue, but a correctness issue affecting users).
4. If it does match, the issue is one of:
   - The `PartialHousehold` snapshot was wrong (interpretation bug — review the relevant turn's `snap_extracted_state` history).
   - The user's actual situation differs from what they reported (no system bug; counsel the user on how to update their information for the actual application).
   - State agency uses different rules than we model (escalate to engineering — this is a rules-engine update need).

### What to do

Update the user that the screening result is informational, not the state's final decision. Help them complete the official DTA Connect application with accurate data. If a rules bug is confirmed, generate a list of all sessions that would have been affected and notify them with a re-screening offer.

---

## Scenario E — On-call needs to look at a session right now

```bash
# 1. Pull the audit trail for context.
python3 -c "
from backend.civic_api.snap.audit.queries import list_entries_for_session
import json
for e in list_entries_for_session('<session_id>'):
    print(json.dumps(e, default=str))
"

# 2. Pull the conversation transcript.
curl -X GET \"$SUPABASE_URL/rest/v1/snap_conversation_turns?session_id=eq.<session_id>&order=turn_index.asc\" \
  -H \"apikey: $SUPABASE_AUDIT_READ_KEY\" \
  -H \"Authorization: Bearer $SUPABASE_AUDIT_READ_KEY\"
# Note: the content_ciphertext fields are encrypted. Decrypt via the
# `bin/snap_audit decrypt` helper (planned).
```

Every read you do here produces an audit entry. That's deliberate — the audit log records who accessed the user's data during the incident. The user has a right to see those entries if they ever ask.

---

## After every incident

- Post-incident review within 48 hours (template in counsel's folder).
- Update this runbook with anything that was unclear or wrong.
- Add a regression test if the incident was caused by a code defect.
- File a Vanta evidence record describing the response, including timeline and remediation.
