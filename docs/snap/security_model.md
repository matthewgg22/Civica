# civicaSNAP security model

Defense-in-depth posture for the SNAP benefits-enrollment vertical. This document is the input to Vanta/Drata compliance evidence, security reviews, and any future SOC 2 / StateRAMP audit work.

---

## Trust boundaries

```
iOS client  ──HTTPS──▶  FastAPI  ──PostgREST──▶  Supabase
                          │
                          └─── LLM provider (Anthropic primary, OpenAI fallback)
```

**iOS client** holds the conversation transcript and the running `PartialHousehold` in memory only. No SNAP PII is written to UserDefaults, Keychain, or local files except the temporary application-PDF blob during share-sheet presentation.

**FastAPI** is the trust boundary. Every iOS request goes through it; no iOS client talks to Supabase directly. Authentication, rate-limiting, and audit-logging all happen here.

**Supabase** is the persistence trust boundary. Row-level security policies enforce that anonymous sessions are service-role-only; only post-magic-link authenticated users can read their own session data. The audit log is append-only via a Postgres trigger.

**LLM provider** sees user utterances and document images. We treat these as PII-bearing — the provider's data-processing agreement covers them, and we never log them outside of the encrypted-at-rest snap_conversation_turns content.

---

## Defense layers

Five independent layers protect SNAP PII. An attacker would need to compromise multiple layers — and different sets of credentials — to read sensitive data in cleartext.

| Layer | What it protects | Compromise to bypass |
|-------|------------------|----------------------|
| 1. TLS | Data in transit | MITM the iOS↔FastAPI or FastAPI↔Supabase TLS connection |
| 2. Postgres at-rest encryption | Database files on disk | Get the Supabase storage volumes |
| 3. Application-layer Fernet | Specific PII columns | Get `SNAP_FERNET_KEY` from KMS |
| 4. Row-level security | Cross-tenant access | Bypass FastAPI and present a forged auth token |
| 5. Audit log | Detection | All of the above + ability to write/delete on snap_audit_log (blocked by trigger) |

Layer 3 is the load-bearing one for "even if Supabase is breached" — without `SNAP_FERNET_KEY`, the database backup leaks ciphertext only. The key lives in AWS KMS or GCP Cloud KMS in production; never in repo, env-var checked-in, or anywhere reachable from the application's Supabase credentials.

---

## Encrypted-at-rest fields

Every column ending in `_ciphertext` is Fernet-encrypted with the `snap_v1::` prefix scheme. The PII guardrail test in `tests/snap/compliance/test_privacy_guardrails.py` enforces that no new column with a PII-suggestive name skips the suffix. See `data_inventory.md` for the complete list.

---

## Secret management

| Secret | Storage | Who has access |
|--------|---------|----------------|
| `SNAP_FERNET_KEY` | AWS KMS / GCP KMS, key ID injected into FastAPI env at deploy | Application service role + KMS admin |
| `SUPABASE_SERVICE_ROLE_KEY` | Vendor secrets manager | Application service role |
| `SUPABASE_AUDIT_READ_KEY` | Vendor secrets manager (read-only role) | Compliance / on-call only |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | Vendor secrets manager | Application service role |

Application code refuses to start without `SNAP_FERNET_KEY` (see `storage/encryption.py`). The boot gate is deliberate — failing closed prevents accidentally storing PII in cleartext.

---

## Audit posture

Every PII operation produces a row in `snap_audit_log`:

- session creation / recovery
- conversation turn write (user or assistant)
- extracted-state snapshot write
- decryption of any `_ciphertext` column
- document upload / decryption / extraction / confirmation
- eligibility determination
- application PDF generation

The audit-coverage CI test in `tests/snap/compliance/test_audit_coverage.py` is BLOCKING — every endpoint that touches PII must produce its expected audit actions or the test fails.

The audit log itself is append-only at the database level. The `snap_audit_log_block_mutation` trigger raises on UPDATE or DELETE attempts, so even a compromised application credential cannot rewrite history.

---

## Threat model (abbreviated)

The full threat model is maintained in Vanta. Highlights:

- **Stolen iOS device.** SNAP draft data is held in memory; closing the app or rebooting clears it. Magic-link recovery requires possession of the user's phone or email — the device alone doesn't grant access to a recovered session.
- **Compromised institutional partner credentials.** Partner staff see only their own org's referrals. Row-level security enforces tenancy at the database; the partner's auth token can't query other partners' rows even with direct PostgREST access.
- **Stolen Supabase backup.** Application-layer Fernet means the backup leaks ciphertext only. KMS key is the second compromise needed.
- **Insider threat at LLM provider.** User utterances and document images are visible to the LLM provider. Mitigated by the BAA with Anthropic/OpenAI and by the eval harness's discipline of never sending PII to LLM calls outside the documented stages.
- **Replay of magic-link tokens.** Magic-link tokens are single-use, time-limited (15 minutes), and bound to the issuing channel (phone or email). Stolen tokens can only be redeemed once.

---

## Related documents

- [data_inventory.md](data_inventory.md) — every PII field, where it lives, encryption status, retention.
- [retention_policy.md](retention_policy.md) — 7-year retention details and deletion procedures.
- [incident_response.md](incident_response.md) — runbook for security incidents.
- [key_rotation.md](key_rotation.md) — `SNAP_FERNET_KEY` rotation procedure.
