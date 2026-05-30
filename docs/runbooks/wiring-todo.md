# Wiring TODO ledger — HIDDEN UNTIL BACKEND

Tracks UI that **exists in the iOS code but is intentionally hidden** in
production because a backend dependency hasn't shipped yet. These rows
render nothing today (their gating signal defaults to a hidden state),
so the user never sees a fake or non-functional affordance.

Each block is marked in source with `// MARK: - HIDDEN UNTIL BACKEND`
so the hidden state reads as deliberate, not as dead code to be deleted
or accidentally enabled.

Source: `docs/audits/civica-ios-product-audit-2026-05-29.md` (IS-7,
approved: "Hide entirely until backend ships").

## Hidden rows

| Surface | File | Gating signal | Unhides when |
|---|---|---|---|
| Phase 2 messages-inbox row | `Civica/App/CivicaHomePhase2View.swift` | `unreadMessageCount > 0` (defaults to `0`) | A distinct applicant-facing messages channel ships (1:1 conversations, unread state, separate model + endpoint). Today doc requests + navigator prompts share the `missing_item_requests` stream, already surfaced as the documents-requested row. |
| Phase 3 messages-inbox row | `Civica/App/CivicaHomePhase3View.swift` | `unreadMessageCount > 0` (defaults to `0`) | Same as above — the enrolled-phase home reuses the same messages model. |

## How to unhide (when the backend lands)

1. Add a `SNAPMessagesInboxStore` (per-concern Store + Repository, per the
   EBT module template in `CLAUDE.md`).
2. Bind `unreadMessageCount` / `mostRecentMessageSender` /
   `mostRecentMessageRelative` (Phase 2) and `…Topic` (Phase 3) to the
   store the same way the error-risk and documents-requested rows are bound.
3. Remove the `// MARK: - HIDDEN UNTIL BACKEND` marker above the block.
4. Add a snapshot test exercising the now-visible row (pass an override
   count > 0), and record its baseline.
5. Delete the corresponding row from this ledger.

## Why a ledger instead of deleting the code

The design exists in the code so the row is ready the moment the backend
ships — no re-design round-trip. The risk the audit flagged is that a
future engineer reads the hidden block as abandoned scaffolding and
either deletes it or wires it to a stub. The marker + this ledger make
the intent explicit and greppable: `grep -rn "HIDDEN UNTIL BACKEND" Civica/`.
