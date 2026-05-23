# EBT Cookie-Handoff Posture — Counsel Briefing

**Date:** 2026-05-22
**Owner:** Matthew Greer
**Status:** DRAFT pending counsel review
**For:** Civica SNAP-literate counsel (per `TODOS.md` TODO-10 ongoing batch)
**Companion in-tree doc:** `docs/compliance-copy-design.md` § "EBT cookie-handoff posture"
**Technical plan reference:** `docs/plans/ebt-tracker-propel-parity.md` §4.3 (D4), §16.2 (wire format)

---

## 1. Background

Civica is a CalFresh enrollment and case-management app that already ships in the App Store. Phase 1 of our EBT tracker feature (planned for delivery on `claude/ebt-propel-parity-phase-1`, off `codex/rebuild-feb18`) adds real-time balance and transaction visibility for California recipients. Today the EBT dashboard exists in the app but is fixture-backed; Phase 1 wires it to real recipient data.

**Why this matters to recipients:**

- CalFresh recipients today call `1-877-328-9677` or visit `ebt.ca.gov` in a browser to check their balance. The phone IVR is slow; the portal is mobile-unfriendly. Civica wants to surface balance + transactions inside the app the recipient already uses for application + recertification.
- Real-time balance enables low-balance push alerts, deposit-landed alerts, runway projection, and the broader set of features documented in `docs/plans/ebt-tracker-propel-parity.md`.
- Without recipient-side EBT data, every other feature the plan contemplates (receipts, anomaly detection, marketplace perks) is impossible.

**Why this matters to the business:**

- Propel (the existing dominant EBT tracker product) has ~5M monthly active SNAP recipients. Civica's positioning is "enrollment + tracker in one app" — without tracker parity, recipients churn to Propel post-enrollment, defeating Civica's retention thesis.
- Tier-3 marketplace revenue depends on having recipients in the app daily; daily activity depends on real balance data.

**Why CA-only for Phase 1:**

- California is Civica's launch state (per `project_launch_state_ca` in our memory). The `ebt.ca.gov` portal model is well-documented.
- Each state's EBT portal is a separate processor integration (CA = California EBT Client Web Portal; MA = `EBTedge`; other states vary). CA-only contains scope.
- Cross-state expansion is deferred until Phase 1 metrics validate retention lift.

## 2. Technical model of cookie handoff

The numbered flow below describes what happens, end-to-end, when a CA CalFresh recipient links their EBT card inside Civica.

```
[iOS device]                          [Civica gateway]              [Civica scraper]                   [ebt.ca.gov]
    |                                       |                              |                                |
 1. Recipient taps "Connect EBT card"       |                              |                                |
    in Civica iOS app                       |                              |                                |
    |                                       |                              |                                |
 2. iOS opens WKWebView pointed at          |                              |                                |
    https://www.ebt.ca.gov                  |                              |                                |
    |  --------------------------------------------------------------------------------------------------> |
    |  <-- portal login page (real CA-state UI, real TLS lock) <---------------------------------------    |
    |                                       |                              |                                |
 3. Recipient types card # + PIN            |                              |                                |
    DIRECTLY into the portal's form.        |                              |                                |
    Civica code does not intercept,         |                              |                                |
    log, persist, or transmit these         |                              |                                |
    fields. WKWebView is the official       |                              |                                |
    Apple primitive; no swizzling.          |                              |                                |
    |  -- POST /login w/ card + PIN ---------------------------------------------------------------------> |
    |  <-- 302 Set-Cookie: session=...; remember=... <----------------------------------------------------|
    |                                       |                              |                                |
 4. iOS reads cookies from                  |                              |                                |
    WKHTTPCookieStore (Apple's              |                              |                                |
    documented API for cookies a            |                              |                                |
    WebView received). Card # is hashed     |                              |                                |
    for dedup; PIN is discarded             |                              |                                |
    in-process and never serialized.        |                              |                                |
    |                                       |                              |                                |
 5. POST /ebt/link {card_hash, cookies}     |                              |                                |
    |  ------------------------------>     |                              |                                |
    |                                  6. Gateway encrypts cookie         |                                |
    |                                     via Supabase Vault (KMS).       |                                |
    |                                     Inserts row in `ebt_cards`:     |                                |
    |                                     - user_id (auth.uid)            |                                |
    |                                     - card_id_hash                  |                                |
    |                                     - session_cookie_encrypted      |                                |
    |                                     - session_cookie_expires_at     |                                |
    |                                     - remember_cookie_encrypted     |                                |
    |                                     (NO PIN column exists)          |                                |
    |  <-- 200 OK {card_id} ----------     |                              |                                |
    |                                       |                              |                                |
 7. Future scrape job:                      |                              |                                |
    |                                  Gateway enqueues scrape job        |                                |
    |                                  on Cloudflare Queue.               |                                |
    |                                       |  --- POST /scrape ------->  |                                |
    |                                       |                          8. Fly machine boots               |
    |                                       |                             Playwright (auto-stops idle).    |
    |                                       |                             Decrypts cookie using Fly        |
    |                                       |                             secret (KMS key never leaves     |
    |                                       |                             scraper sandbox).                |
    |                                       |                             Loads cookie into headless       |
    |                                       |                             browser.                          |
    |                                       |                             |  -- GET /balance w/ cookie -> |
    |                                       |                             |  <-- balance HTML <---------- |
    |                                       |                             Parses, normalizes.              |
    |                                       |  <-- POST /webhooks/        |                                |
    |                                       |      ebt-scraper            |                                |
    |                                       |      {balance, txns}        |                                |
    |                                  Gateway updates `ebt_cards`        |                                |
    |                                  cache cols + inserts txns.          |                                |
    |                                       |                              |                                |
 9. iOS pulls balance via                   |                              |                                |
    GET /ebt/balance.                       |                              |                                |
    |  ------------------------------>     |                              |                                |
    |  <-- {balance, last_synced}-----     |                              |                                |
    |                                       |                              |                                |
10. Cookie expiry path:                     |                              |                                |
    Scraper attempts replay; portal         |                              |                                |
    returns "session expired"; scraper      |                              |                                |
    emits `sessionExpired` event.           |                              |                                |
    Gateway fires APNs push                 |                              |                                |
    "Please re-connect your EBT card."     |                              |                                |
    Recipient taps -> step 2 again.         |                              |                                |
```

**Key properties of this model:**

- The PIN exists only in the WebView's process memory and the TLS connection to `ebt.ca.gov`. It is never read by Civica Swift code, never POSTed to Civica's backend, never written to any disk under Civica's control, never logged.
- The session cookie is treated as an expiring bearer token. We hold a refresh window's worth of read-only access; we do not hold a credential that would let us log in from scratch.
- Decryption of the stored cookie happens only inside the Fly scraper machine, with the decryption key held in a Fly secret. The application server (`apps/enrollment-api/`) never has access to plaintext cookies in normal operation.
- The recipient retains immediate revocation via `ebt.ca.gov` sign-out (server-side cookie invalidation).

## 3. Comparison vs Propel's posture

Per the outside-voice review captured in `docs/plans/ebt-tracker-propel-parity.md` CMT-1, Propel's product was originally built on a different model. Our understanding (which counsel should independently verify if material to the analysis):

| Dimension | Civica (cookie handoff) | Propel (legacy, per public reporting) |
|---|---|---|
| Where the PIN is typed | Inside an iOS WKWebView pointed at the official state portal | Inside Propel's own UI (in earlier product generations) |
| Whether Propel's / Civica's server sees the PIN | **No.** Never transmitted off device. | Historically yes — PIN was stored to enable unattended re-login |
| What we store at rest | Encrypted expiring session cookie | Encrypted credential (card + PIN) |
| What happens when the cookie / credential is rotated | Recipient does a fresh in-WebView login; we capture a new cookie | Service uses stored PIN to log in again automatically |
| Worst-case ATO blast radius | Expiring cookies (auto-invalidate on portal-side timer) | Permanent credentials (only invalidate when recipient changes PIN) |

**Important caveat:** This comparison reflects Civica's understanding of Propel's earlier-generation architecture, drawn from outside-voice review notes. Propel's current architecture may differ; counsel should not rely on the comparison as a statement of Propel's present posture. Our claim is about Civica's posture, not Propel's. The comparison is offered to show that the credential-handling design space is real, and that we have placed Civica deliberately on the lower-blast-radius end of it.

## 4. Risk surface

### 4.1 ATO compromise of Supabase Vault

- **Scenario:** Attacker obtains Supabase Vault decryption keys, plus access to a Fly secret for the scraper.
- **Blast radius (Civica):** Attacker obtains encrypted session cookies and (if they also breach the Fly machine) plaintext session cookies. Cookies expire on the portal's own clock — Phase 1 Lane B PoC measures the actual session lifetime; assumption is hours-to-days, not weeks-to-months.
- **What the attacker cannot do:** Log in as the recipient from scratch (no PIN). Change the recipient's PIN. Drain the EBT card balance directly (the portal exposes read-only views of balance + transaction history; it does not let a session holder transfer funds).
- **What the attacker can do:** Read the recipient's balance + transaction history for the lifetime of the active cookie. This is sensitive (transaction history is location-revealing) but materially less harmful than a credential breach where the attacker can rotate access indefinitely.
- **Mitigations in place:** KMS-backed encryption at rest; Fly secret rotation; Sentry alerting on impossible-travel cookie use; 2FA available on the Civica account itself.

### 4.2 `ebt.ca.gov` ToS exposure

- **Scenario:** CDSS or California EBT portal operator concludes Civica's cookie-replay-on-user's-behalf violates portal ToS.
- **Blast radius:** Civica is asked to stop, or faces civil action, or recipients are individually rate-limited / blocked.
- **What makes this a gray zone:** Most state portal ToS were written to address "scrape with stored credentials" or "unattended bot access." Cookie-replay-on-user-initiated-login is structurally different — the recipient logged in through the official UI; we replay the resulting session on their explicit behalf with their explicit disclosure-screen consent.
- **Counsel guidance needed:** §5 questions 1, 2, and 3.

### 4.3 State agency partnership exposure

- **Scenario:** Civica's CDSS-facing partnership (forthcoming, currently informal) requires disclosure of automated cookie use as a condition of partnership.
- **Blast radius:** Partnership conversation reopens; cookie-handoff may need state-agency sign-off in addition to counsel sign-off.
- **What we can do proactively:** Document the model clearly (this brief), invite CDSS to review before launch if counsel recommends, frame the disclosure around recipient empowerment rather than business need.
- **Counsel guidance needed:** §5 question 3.

### 4.4 Recipient consent adequacy

- **Scenario:** A recipient later challenges whether their consent to cookie storage was adequately informed (e.g., a CCPA / CPRA complaint, a state agency complaint, a private action).
- **Blast radius:** Civica may need to refresh consent, may face penalties, may need to delete data.
- **What we have in place:** The first-link consent screen (drafted in `docs/compliance-copy-design.md` § EBT cookie-handoff posture > "First-link consent disclosure copy") explicitly discloses the three required points: (a) PIN stays on device, (b) we periodically refresh balance using a session token, (c) recipient controls revocation three ways. EN + ES at parity, enforced by `EBTStringParityTests` at CI.
- **Counsel guidance needed:** §5 questions 4 and 5.

### 4.5 Benefit theft via mis-used cookies

- **Scenario:** A bad actor compromises Civica's systems, exfiltrates active cookies, then uses them to read transaction history and target a recipient for skimming, social engineering, or fraud.
- **Blast radius:** Compromised recipient may experience downstream benefit theft (card cloned, EBT-skimmed, etc.) that traces back to Civica being upstream of the disclosure.
- **What we have in place:** Anomaly detector (planned in plan §4.1) flags impossible-travel cookie use; Sentry alerts on velocity anomalies; cookie auto-rotates on portal-side expiry.
- **Counsel guidance needed:** §5 question 6.

## 5. Seven questions for counsel

1. **Federal benefit privacy law:** Is "session cookie replay on a user's behalf" materially different from "scraping with stored credentials" under 7 CFR 272.1(c) (SNAP recipient information confidentiality requirements)? HIPAA does not apply to SNAP. 45 CFR Part 2 governs substance-abuse records and does not appear relevant. Are there other federal frameworks (Privacy Act of 1974 as applied to state-administered federal programs; Section 504 of the Rehabilitation Act re: accessibility-equivalent automation) we should be analyzing?

2. **State portal ToS — `ebt.ca.gov`:** Does the CA EBT Client Web Portal ToS specifically prohibit automated cookie replay (vs prohibiting "automated access" generically)? If the ToS is silent or ambiguous on cookie replay specifically, what is counsel's read on whether courts have treated user-agent-style automation (recipient initiated the session, third party assists with replay under recipient direction) differently from credential-based bot automation?

3. **State agency notification — CDSS:** Does Civica's cookie posture require state agency notification (to CDSS, to CalFresh program staff, or to the CA EBT contractor) before production launch? If so, what is the recommended channel (formal letter, program-staff conversation, RFI response, etc.)?

4. **CA consumer privacy law:** Is the iOS app's first-link consent screen (per §6 below) sufficient under CCPA / CPRA for the data we're collecting (session cookie, hashed card ID) and the data we'll subsequently retrieve and store (balance, transaction history)? Are there specific CCPA-required notices (Notice at Collection, Right to Know, Right to Delete) that the consent screen should incorporate by reference or link to?

5. **Benefit-recipient-specific protections:** Are there CalFresh- or EBT-recipient-specific consent protections (under CDSS regulation, under federal SNAP recipient-rights doctrine, under any vulnerable-population doctrine California recognizes) that elevate the standard above generic CCPA? If yes, does our draft consent copy clear that elevated bar?

6. **Misuse liability:** If a recipient's cookie is mis-used (e.g., a third party compromises Civica → reads transaction history → uses the data to skim the recipient's EBT card), what is Civica's exposure under CA / federal benefit theft law? Is the cookie-handoff posture (as opposed to credential storage) treated as a meaningfully reduced-liability profile?

7. **Insurance:** Should Civica obtain insurance specifically for benefit-tracker liability — cyber liability, errors & omissions, tech E&O — beyond Civica's existing general commercial coverage? If so, what coverage limits and named perils does counsel recommend we ask the broker to quote?

## 6. Proposed consent copy

The full draft consent text — three paragraphs, EN + ES at parity — lives in `docs/compliance-copy-design.md` § "EBT cookie-handoff posture" > "First-link consent disclosure copy".

Summary of what the copy discloses:

| Paragraph | Discloses |
|---|---|
| 1 | The card and PIN stay on the device; Civica never sees or stores them. |
| 2 | Civica saves a short-lived session token so we can refresh balance and transactions in the background. The token expires automatically; we'll notify the recipient to re-connect when it does. |
| 3 | Three independent paths to revocation: sign out at `ebt.ca.gov`, toggle off in Civica settings, or uninstall the app. |

Both EN and ES copy is drafted to plain-language readability levels (8th-grade target). Counsel feedback on wording lands here; once feedback returns, the approved strings will be wired into `Civica/Features/SNAP/EBTBalance/Strings/EBTBalanceStrings.swift` under the `EBTBalanceStrings.linkConsent*` namespace, with parity-test coverage enforced at CI.

## 7. Recommended next steps for counsel sign-off

1. **Counsel review window:** 4–6 weeks from the date this brief is delivered. This aligns with the Phase 1 development timeline; Lane E (counsel) is the production-rollout gate, not the dev-work gate. Engineering will continue building against staging.
2. **Block production rollout — NOT dev work — until counsel sign-off received.** Counsel sign-off is the gate for promoting `ebt_real_data` feature flag to true for non-test recipients. All other gates (E2E tests, A11y, security review) ship in parallel.
3. **Re-run this briefing if Lane B PoC reveals material facts.** Lane B Phase-1 PoC measures the actual `ebt.ca.gov` session cookie lifetime (assumed: hours-to-days) and the actual transaction history depth (assumed: 60 days, but may be 10-txn cap per CMT-4 in the plan). If session lifetime is materially shorter (e.g., minutes — re-link cadence becomes user-hostile) or materially longer (e.g., months — ATO blast radius scales up), §4.1 and §4.2 analysis should be revisited.
4. **Coordinate with existing counsel batch.** Per `TODOS.md` TODO-10, Civica is currently in the process of identifying SNAP-literate counsel for the OBBBA compliance-strings sign-off batch. The same counsel relationship should cover this EBT brief if scope allows. If counsel-of-record for the OBBBA batch cannot take EBT, request a referral to a privacy/tech-savvy attorney within the same firm or network. Avoid splitting Civica's external counsel surface across multiple firms unless specifically required for specialized expertise.
5. **Document counsel's answers in this file.** Once counsel responds, append a §8 "Counsel responses" section to this document with the answers to the seven questions and any clarifying back-and-forth. Move status from `DRAFT pending counsel review` to `APPROVED — production-cleared` or `REVISED — see §8 for changes required` based on outcome.

## Cross-references

- Plan: `docs/plans/ebt-tracker-propel-parity.md` (§4.3 = decision D4; §16.2 = wire format; CMT-1 + CMT-4 = open PoC questions)
- In-tree compliance addendum: `docs/compliance-copy-design.md` § "EBT cookie-handoff posture"
- Root developer conventions: `CLAUDE.md` § "EBT module conventions"
- Counsel batch tracking: `TODOS.md` TODO-10
- Memory: `project_launch_state_ca` (CA-only launch posture)
