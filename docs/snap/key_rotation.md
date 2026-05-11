# SNAP_FERNET_KEY rotation runbook

`SNAP_FERNET_KEY` is the load-bearing secret for application-layer PII encryption. Rotate it on the schedule below or earlier in response to any suspected compromise.

---

## When to rotate

- **Scheduled**: every 12 months. Same calendar week each year so it's predictable.
- **After any SEV-1 / SEV-2 incident** where the prior key may have been exposed (KMS access compromise, accidental log of the key, departed engineer with KMS access).
- **Before changing KMS providers or accounts.**
- **Whenever counsel or compliance asks.**

---

## Strategy: MultiFernet rolling rotation

We use a `MultiFernet` setup so old ciphertext continues to decrypt during the rotation window. Concretely: the new key is added as the *primary*, the old key stays on as a *secondary*, and a background re-encryption job rewrites every existing `_ciphertext` row to use the new primary.

The rotation has four phases:

1. **Both keys live** — new primary, old secondary. Ciphertext written from now on uses the new key. Old ciphertext still decrypts via the secondary.
2. **Re-encrypt sweep** — background job rewrites every `_ciphertext` row to the new key.
3. **Verify** — every row's ciphertext begins with `snap_v1::` and decrypts with the new key alone (secondary turned off in a test environment).
4. **Retire old key** — KMS revocation for the old key version. From this point, ciphertext that wasn't migrated is permanently unreadable.

Phase 3 → 4 is the irreversible step. Don't move forward until the sweep is fully complete.

---

## Pre-rotation checklist

- [ ] Generate the new key in the same KMS account. Key ID recorded in counsel's secrets-management doc.
- [ ] Verify the audit-coverage CI test is green on the deployed commit. Rotating during a known audit gap creates a timeline that's hard to reconstruct.
- [ ] Confirm Supabase point-in-time recovery is enabled and the PITR window covers the next 7 days. If anything goes wrong, PITR is the recovery path.
- [ ] Schedule the rotation outside peak SNAP enrollment hours (avoid Monday 9am ET — that's the highest-usage slot per analytics).
- [ ] Notify the institutional partners listed in the comms doc 24 hours ahead. Some partners' compliance desks want to know.

---

## Phase 1 — Both keys live

### Code change

Wire `MultiFernet` in `backend/civic_api/snap/storage/encryption.py`:

```python
from cryptography.fernet import Fernet, MultiFernet

new_key = os.environ["SNAP_FERNET_KEY_NEW"].encode()
old_key = os.environ["SNAP_FERNET_KEY"].encode()  # legacy primary
self._fernet = MultiFernet([Fernet(new_key), Fernet(old_key)])
```

The first key in the list is the encryption primary; subsequent keys are tried during decryption only. Existing `PIIEncryptor.encrypt()` calls automatically use the new key after this deploy.

### Deploy

Deploy the code change with both env vars set. Smoke-test the SNAP endpoints:

```bash
# Confirm new sessions encrypt with the new key and old sessions still decrypt.
/usr/bin/python3 -m pytest tests/snap/ -q
curl -X POST "$PROD_API/snap/healthz"
```

---

## Phase 2 — Re-encrypt sweep

Run a background job that walks every `_ciphertext` column, decrypts via the secondary, re-encrypts via the new primary. The script lives at `bin/snap_reencrypt` (planned — wire it before you actually need to rotate; "running unsafe migrations under stress" is the canonical bad time).

```bash
# Pseudo-shape:
python3 bin/snap_reencrypt \
  --table snap_conversation_turns --column content_ciphertext \
  --batch-size 500 --rate-limit-per-second 50
python3 bin/snap_reencrypt \
  --table snap_extracted_state --column snapshot_ciphertext \
  --batch-size 500 --rate-limit-per-second 50
# ... etc for snap_documents.*_ciphertext, snap_eligibility_results.*_ciphertext
```

Every re-encryption produces an audit log entry (`PII_FIELD_DECRYPTED` for the read, then a write that doesn't currently have an audit action — add `PII_FIELD_REENCRYPTED` if implementing). The compliance team will want to see those rows on the post-rotation report.

---

## Phase 3 — Verify

Spin up a verification service (NOT prod) with only the new key configured. Run a query against a sample of 100 random rows from each `_ciphertext` column. Every row must decrypt successfully. If any rows fail, the sweep wasn't complete — return to Phase 2 with a more aggressive batch size and re-run for the failing rows.

```bash
SNAP_FERNET_KEY=$NEW_KEY_ONLY \
SUPABASE_URL=$STAGING_URL \
python3 bin/snap_verify_rotation --sample-size 100
```

---

## Phase 4 — Retire old key

1. Remove `SNAP_FERNET_KEY_NEW` from prod env. Set `SNAP_FERNET_KEY` to the new key value.
2. Revert the `MultiFernet` shim back to single-key `Fernet` in `storage/encryption.py`. Deploy.
3. Run KMS key version revocation for the old key. Document the revocation in Vanta evidence.
4. Update counsel's secrets-management doc with the new key ID and the rotation date.

---

## Rollback if something goes wrong

The rollback path depends on which phase you're in:

- **Phase 1**: just revert the code change. Both keys can co-exist indefinitely; there's no time pressure.
- **Phase 2**: stop the sweep. The state is mixed (some rows on new key, some on old). Both keys are still live, so decryption works for everything. Resume the sweep when ready.
- **Phase 3**: don't retire the old key. Investigate the verification failures.
- **Phase 4**: this is the irreversible step. If the new key turns out to be compromised AFTER the old one was revoked, you have lost the data — restore from PITR within the 7-day window or accept the loss.

---

## Key generation

```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

Output is a 32-byte url-safe base64 string. Drop the result into the KMS secret backing `SNAP_FERNET_KEY_NEW`. Never store it anywhere else; even in a 1Password vault, even temporarily.
