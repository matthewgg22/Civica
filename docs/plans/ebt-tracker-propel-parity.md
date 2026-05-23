# EBT Tracker — Propel Parity Plan

**Status:** Eng-reviewed + DX-reviewed 2026-05-22 (17 eng decisions + 8 DX passes locked)
**Owner:** Matthew Greer
**Branch:** `claude/compliance-session-2026-05-21` (will branch off `codex/rebuild-feb18` for this work)
**Date:** 2026-05-22
**Scope decision:** Full Propel parity, optimized for **real CA CalFresh recipient value** (not demo polish, not pure B2G).

---

## 1. Why now

Civica already ships a Propel-styled EBT dashboard, but every byte of data is fixture-backed (see [EBTBalanceFixtures.swift](Civica/Features/SNAP/EBTBalance/EBTBalanceFixtures.swift)). The UI shell is production-grade; what's missing is the substrate that makes Propel useful: real balance, real transactions, push alerts, budgeting that survives across sessions, marketplace partnerships, and a path to the financial-services surface Propel monetizes against.

Civica's positioning vs Propel:

| | Civica | Propel (Providers) |
|---|---|---|
| Apply for SNAP | Full flow (BenefitsCal-bound) | None |
| Track EBT | UI only, fixture-backed | Real, multi-state |
| Recert / interview / work-hours | Yes | No |
| Compliance / B2G surface | Yes (dashboard) | No |
| Marketplace + financial services | None | Core revenue (~$50M ARR) |
| Push notifications | None | Deposit + low-balance + perks |
| ~5M monthly active SNAP recipients | 0 | ~5M |

The strategic bet: a recipient who applies through Civica should never need to install Propel. Tracker parity is a defensive moat against churn back to Propel post-enrollment.

---

## 2. North star

A CalFresh recipient opens Civica on the 1st of the month, sees their deposit hit in real time, sees their projected runway given last month's spend, gets a push the day before benefits expire from 274-day inactivity, claims a Market Match perk inside the app, and never calls 1-877 to check their balance again.

---

## 3. Feature matrix

| Feature | Civica today | Propel | Gap | Tier |
|---|---|---|---|---|
| **Real EBT balance** | Fixture | Real (FIS for most states) | Backend wire | **1** |
| **Transaction history** | Fixture, 7 sample rows | Real, paginated | Backend wire | **1** |
| **Card link** | Demo input | Real, credentials encrypted | Auth flow + secret storage | **1** |
| **Manual refresh** | Re-stamps timestamp | Real poll | Server-side cache + iOS pull-to-refresh | **1** |
| **Push notifications** | None | Deposit, low balance, perks, recert | APNs + scheduled jobs | **1** |
| **Spending categorization** | 5 categories, deterministic | ML-assisted, ~12 categories | Merchant→category lookup table + override | **2** |
| **Budget projection (runway)** | `projectedRunOutDate` from 30-day avg | Same | Already shipped | OK |
| **Receipts capture** | None | OCR scan, attach to transaction | VisionKit + on-device classifier | **2** |
| **Card lock / geo restrict** | Local UserDefaults toggle | Real (state-dependent) | Wire to processor; gracefully degrade | **2** |
| **Deposit calendar** | Static deposit day | Real, with skip-month warnings | CA issuance schedule data | **1** |
| **Anti-skimming alerts** | None | Yes (post-EBT-theft uptick) | Anomaly detector on velocity + state-code | **2** |
| **Perks / marketplace** | 4 static CA perks | Live, geo-targeted, ~50 partners | Partner deals + impression tracking | **3** |
| **Surveys for cash** | None | Pollfish/Cint integration | Partner; payouts via Stripe/Dwolla | **3** |
| **Refer-a-friend** | None | $5–$10/referral | Referral tracking + payout | **3** |
| **Bill pay** | None | Yes (Plaid + ACH) | Big lift; CA-specific utility partners | **4** |
| **Tax filing partner** | None | TurboTax / Cash App Taxes | Affiliate link only (Tier 4) | **4** |
| **Job listings** | None | Snagajob integration | Already in distribution plan (SEIU/UFW/gig) → Tier 2/3 | **2** |
| **WIC tracking** | None | Yes in WIC states | CA WIC = separate eWIC system; defer | **4** |
| **News / content** | 4 static CA articles | CMS-driven, geo + lang | Sanity/Contentful + editorial workflow | **2** |
| **Account services (lost card, etc.)** | None | Deep-links to state | Static state directory + tel: links | **1** |

Tier definitions:
- **Tier 1** — Blocks "real recipient value." Must ship before promoting tracker publicly.
- **Tier 2** — Differentiating; ship Q3 2026.
- **Tier 3** — Revenue-positive; ship after Tier 1+2 + partner agreements.
- **Tier 4** — Optional / partner-gated; defer until product-market fit on Tier 1–3.

---

## 4. Architecture

### 4.1 iOS layer (delta)

Existing files (preserve):
- [EBTBalanceRootView.swift](Civica/Features/SNAP/EBTBalance/EBTBalanceRootView.swift)
- [EBTBalanceDashboardView.swift](Civica/Features/SNAP/EBTBalance/EBTBalanceDashboardView.swift)
- [EBTBalanceStore.swift](Civica/Features/SNAP/EBTBalance/EBTBalanceStore.swift) — scope narrowed to dashboard UI state per Q1
- [EBTBalanceModels.swift](Civica/Features/SNAP/EBTBalance/EBTBalanceModels.swift)
- [EBTBalanceInsights.swift](Civica/Features/SNAP/EBTBalance/EBTBalanceInsights.swift) — already pure-fn, keep
- [EBTBalanceStrings.swift](Civica/Features/SNAP/EBTBalance/EBTBalanceStrings.swift) — split per feature per Q2
- [EBTBalanceFixtures.swift](Civica/Features/SNAP/EBTBalance/EBTBalanceFixtures.swift) — preserved behind feature flag `ebt_real_data`
- [EBTCardLockView.swift](Civica/Features/SNAP/EBTBalance/EBTCardLockView.swift) — degrades gracefully when card-lock unavailable in CA
- [EBTLinkCardView.swift](Civica/Features/SNAP/EBTBalance/EBTLinkCardView.swift) — replaced by `EBTLinkWebView.swift` for cookie-handoff
- [EBTTransactionDetailSheet.swift](Civica/Features/SNAP/EBTBalance/EBTTransactionDetailSheet.swift)

**Per-concern store + repository layering (Q1/D8):**

```
EBTBalanceStore       ← UI state for dashboard (linkState, account snapshot, error banner)
  └ subscribes to → EBTBalanceRepository      ← single source of truth for account data
                      └ uses → EBTBalanceAPIClient

EBTReceiptsStore      ← UI state for capture + list
  └ subscribes to → EBTReceiptsRepository
                      └ uses → EBTBalanceAPIClient + VisionKit

EBTPerksStore         ← UI state for marketplace tile + claim flow
  └ subscribes to → EBTPerksRepository
                      └ uses → EBTBalanceAPIClient

EBTCardLockStore      ← UI state for lock toggle (CA: shows "Coming soon")
EBTAnomalyDetector    ← pure-fn over [EBTTransaction] (no store)
EBTBalanceInsights    ← pure-fn (existing)
```

New iOS files:
- `EBTBalanceAPIClient.swift` — gateway client (URLSession + signed JWT from KeychainSession; mirrors EnrollmentAPIClient pattern)
- `EBTBalanceRepository.swift` — owns cache (UserDefaults JSON v1, CoreData v2 if needed); merges server snapshot + local optimistic state
- `EBTLinkWebView.swift` — in-app WKWebView at ebt.ca.gov; intercepts session cookie via WKHTTPCookieStore; ships cookie to gateway (per D4)
- `EBTScrapeError.swift` — typed enum: networkTimeout, portalDown, sessionExpired, captcha, pinLocked, cardClosed, parseError (Q3/D10); maps to per-variant banner copy
- `Receipts/EBTReceipt.swift`, `Receipts/EBTReceiptCaptureView.swift`, `Receipts/EBTReceiptsRepository.swift`, `Receipts/EBTReceiptsStore.swift`
- `Anomaly/EBTAnomalyDetector.swift` — pure-fn: velocity (>$50/<2min, >5/<10min) + merchant state-code regex (per D5)
- `Push/EBTPushHandler.swift` — APNs registration, deep-link to dashboard on tap, just-in-time pre-prompt (per D7)
- `Push/EBTNotificationPrefsStore.swift` — per-type opt-in
- `Perks/EBTPerksRepository.swift`, `Perks/EBTPerksStore.swift`
- `AccountServices/EBTAccountServicesView.swift` — state directory (CA: 1-877-328-9677, BenefitsCal link, etc.)
- `Referral/EBTReferralView.swift` — referral code surface (gated behind Tier 3)
- `Strings/EBTBalanceStrings.swift` (split from current) + `Strings/EBTPushStrings.swift`, `Strings/EBTReceiptStrings.swift`, `Strings/EBTAnomalyStrings.swift`, `Strings/EBTAccountServicesStrings.swift`, `Strings/EBTPerksStrings.swift`, `Strings/EBTReferralStrings.swift`
- Tests: `EBTBalanceStoreTests.swift`, `EBTBalanceInsightsTests.swift`, `EBTBalanceRepositoryTests.swift`, `EBTAnomalyDetectorTests.swift`, `EBTReceiptOCRTests.swift`, `EBTScrapeErrorTests.swift`, `EBTLinkWebViewTests.swift`, `EBTStringParityTests.swift` (parity guard per Q2 — see §16.8 for spec), `EBTBalanceA11yTests.swift` (snapshots at xxxLarge + VoiceOver label coverage per T2)
- **Regression-critical tests (IRON RULE, per test review):**
  - `EBTFeatureFlagRegressionTests.swift` — assert `ebt_real_data=false` preserves existing fixture-only experience (simulatePurchase/simulateDeposit/EBTBalanceInsights behave identically)
  - Snapshot test on dashboard at flag-OFF — diff must equal pre-plan baseline

### 4.2 Gateway (`apps/enrollment-api/`)

Decision: add EBT routes to `apps/enrollment-api/` (single gateway, single JWT, single Sentry). Mount under `/ebt/*` via subdirectory `apps/enrollment-api/src/routes/ebt/` (per §16.1 convention decision — matches existing Civica per-feature pattern).

Routes (each in its own file with co-located `.test.ts`):
- `ebt/link.ts` — POST /ebt/link (receives session cookie from iOS WebView; stores in Vault)
- `ebt/balance.ts` — GET /ebt/balance (Supabase column cache per D14; 30min stale threshold)
- `ebt/transactions.ts` — GET /ebt/transactions (cursor pagination)
- `ebt/refresh.ts` — POST /ebt/refresh (rate-limit 1/min/user, triggers Fly scraper)
- `ebt/lock.ts` — POST/DELETE /ebt/lock (Phase 1: 501 stub with CA copy)
- `ebt/deposit-calendar.ts` — GET /ebt/deposit-calendar (static CA issuance schedule)
- `ebt/receipts.ts` — POST /ebt/receipts (Phase 2)
- `ebt/perks.ts` — GET /ebt/perks (Phase 3)
- `ebt/referrals.ts` — POST /ebt/referrals/claim (Phase 3)
- `ebt/notifications.ts` — POST /ebt/notifications/register
- `ebt/webhooks.ts` — POST /webhooks/ebt-scraper (HMAC verify; event fan-out)
- `ebt/index.ts` — exports `mountEbt(app)` that registers all of the above

Wire error format for scrape errors (per §16.2):

```json
{
  "error": {
    "type": "ebt_scrape_error",
    "code": "sessionExpired",
    "message": "Your EBT card link has expired. Please re-link to continue.",
    "cta": { "kind": "re_link", "target": "civica://ebt/link" },
    "doc_url": "https://help.civica.app/ebt/re-link"
  },
  "request_id": "req_abc123"
}
```

### 4.3 EBT processor integration

This is the load-bearing decision. Three paths:

| Path | Pros | Cons |
|---|---|---|
| **A. Direct integration with FIS** (CalFresh processor) | Authoritative, real-time | FIS access is gated; need state partnership or vendor agreement; 6–12mo timeline; possible RFP |
| **B. Plaid EBT** (rolling out 2025–2026) | Existing dev relationship; standardized | Coverage uneven; CA not on roadmap as of 2026-05; per-link cost |
| **C. Recipient-session-cookie handoff (Civica)** | Works day-one; **PIN never leaves device** (per D4); counsel-friendlier than scraping-with-stored-PIN | Brittle to portal redesigns; cookie re-prompt cadence TBD; requires careful UX |

**Decision (D4 / CMT-1):** Path **C with session-cookie handoff** for Tier 1. iOS opens in-app WebView at ebt.ca.gov; user enters card+PIN locally; app intercepts session cookie + "remember me" cookie; ships cookie (not PIN) to gateway. Server scrapes with cookie until expiry; on expiry, server APNs-pings "please re-link" and user re-runs the WebView flow. **PIN is never persisted on Civica infrastructure.** Lane E counsel brief documents this posture.

Parallel-track **B (Plaid CA)** as the long-term path; abandon C the moment B is reliable in California. **A** is a 12-month B2G play and a separate initiative.

CA-specific: `www.ebt.ca.gov` recipient portal — California EBT Client Web Portal. Credentials = 16-digit card + 4-digit PIN entered in iOS WebView. **Transaction history depth (60 days vs 10-txn cap) is a Phase 1 probe** — confirmed in PoC before P3 backfill is sized. Rate-limited; expect captcha within 6–12mo; Lane B Fly worker pool absorbs aggregate volume via queue + jitter (D13).

### 4.4 Push notifications

- **APNs** via gateway (Cloudflare Workers) + token-based auth; direct, no OneSignal middleman.
- **Event-driven scrape model (D3, replaces daily poll):**
  - **Issuance-day push:** CA issuance calendar (deterministic per case-suffix, days 1–10 of month) tells us when a recipient's deposit lands. Server scrapes day-0 + day-1 only, fans out deposit-landed APNs. No daily polling.
  - **On-open refresh:** When iOS app opens and cached balance > 30min old, app triggers gateway → scraper → fresh data. UX shows loading state with cancel.
  - **Low-balance push:** Computed from each scrape result against recipient threshold; fires when threshold first crossed in a billing cycle.
- **Scraper fan-out (D13):** Cloudflare Queues (or Supabase pgmq) buffer issuance-day scrapes; Fly worker pool (~50 machines, auto-stop) drains the queue with 1-hour jitter window (6am–7am randomized per card). Targets ~50 parallel; absorbs 10× growth without redesign.
- **Just-in-time permission (D7):** App does NOT request push permission at install. After first successful card link → balance render, iOS shows a pre-prompt sheet ("Get a notification the moment your $232 deposit lands?"). Tap Yes → fire system APNs prompt. Deny → re-ask 30 days later; hard-deny → deep-link to Settings. Per Apple HIG, expected ~70–80% accept rate.
- Per-user notification settings: deposit, low balance, perks, recert (default all on; one-tap mute).
- Quiet hours: 9pm–8am recipient-local.

### 4.5 Marketplace + revenue

- Schema-first: define `Perk` model with impression + claim tracking, geo bounds, lang, expiry
- Partner ingestion via JSON import (manual to start); promote to admin UI once >20 partners
- Revenue model: per-claim attribution (CPA), not display ads. Affiliate links for tax/bill-pay/job partners.
- **Anti-pattern guard:** No display ads. Propel's reputation depends on dignity; we match that bar.

### 4.6 Data model (new tables, Supabase)

- `ebt_cards` — id, user_id, card_id_hash, processor, **session_cookie_encrypted, session_cookie_expires_at, remember_cookie_encrypted** (per D4 — NO PIN stored), last_synced_at, **balance_cents, balance_at** (cache per D14), lock_state
- `ebt_transactions` — id, card_id, posted_at, amount_cents, merchant, category, raw_description, **state_code_match** (computed from merchant string per D5)
- `ebt_deposits` — id, card_id, scheduled_for, posted_at, amount_cents
- `ebt_receipts` — id, transaction_id (nullable until matched), image_url, ocr_total_cents, ocr_merchant, ocr_captured_at, **match_status** (pending_match | matched | ambiguous | standalone), user_confirmed
- `ebt_perks` — id, slug, title, description, geo_bbox, langs[], partner, claim_url, valid_through
- `ebt_perk_claims` — id, user_id, perk_id, claimed_at, redeemed_at
- `ebt_referrals` — id, referrer_user_id, referred_user_id, claimed_at, payout_state
- `ebt_notification_prefs` — user_id, deposit_on, low_balance_on, perks_on, recert_on, quiet_start, quiet_end, **travel_mute_until** (per D5 anomaly false-positive escape)
- `ebt_device_tokens` — user_id, apns_token, platform, registered_at

All RLS-scoped to `auth.uid()`. **Session cookies encrypted via Supabase Vault (KMS); decrypted only inside the Fly scraper machine (key held in Fly secret, not in code).** No recipient PINs are ever persisted on Civica infrastructure (per D4 — counsel posture is "expiring session token, not credential").

**Cache layer for GET /ebt/balance (D14):** single Supabase query on `ebt_cards.balance_cents + balance_at`; if `age(balance_at) > 30min` the route returns last-known with `stale=true` and triggers a refresh job. Migrate to CF KV only if metrics show > 1000 RPS on this route.

---

## 5. Phased rollout

### Phase 1 — Tier 1 + read-only real wire (3 weeks, 5 parallel lanes)

**Lane A — Gateway core (sequential within):**
- DB migrations: `ebt_cards`, `ebt_transactions`, `ebt_deposits`, `ebt_device_tokens`, `ebt_notification_prefs`
- Gateway endpoints in `apps/enrollment-api/src/routes/ebt/`: `link.ts`, `balance.ts` (Supabase column cache per D14), `transactions.ts` (pagination), `refresh.ts` (rate-limit 1/min), `deposit-calendar.ts`, `webhooks.ts`, `notifications.ts`, `index.ts`
- Card-lock graceful stub: `lock.ts` → 501 with CA-specific copy

**Lane B — Fly scraper (new `fly/ebt-scraper/`, skeleton per §16.7):**
- Playwright Docker container; Fly worker pool ~50 machines auto-stop
- Login flow with cookie capture (per D4 — receives cookie from /ebt/link, doesn't handle PIN)
- Balance + transaction parser
- **Phase-1 prereq:** probe ebt.ca.gov to determine actual transaction history depth (60-day window vs 10-txn cap per CMT-4); size P3 backfill accordingly
- Cookie-expired detection → emits `sessionExpired` event → gateway fans out push
- Captcha + parse-error detection → emits typed events (per D10)
- Cloudflare Queue (or pgmq) consumer with 1-hour jitter on issuance days (per D13)

**Lane C — iOS API + store decomposition:**
- `EBTBalanceAPIClient.swift`; mock backend during dev
- Per-concern store split (Q1/D8): EBTBalanceStore narrowed to UI state; EBTBalanceRepository owns data
- `EBTLinkWebView.swift` for cookie handoff (per D4)
- `EBTScrapeError.swift` enum + per-variant banner copy (Q3/D10); decodes from §16.2 wire format
- `EBTAccountServicesView.swift` (state directory, tel: links — no backend dep)
- Feature flag `ebt_real_data`; fixtures path preserved at flag-OFF (regression-critical)
- Strings files split per Q2 + parity unit test per §16.8
- A11y snapshot tests at xxxLarge + VoiceOver label test (per T2)
- 30d sync + 60d background backfill on first link (per D15)

**Lane D — APNs infra:**
- APNs cert + send-push helper in gateway
- `Push/EBTPushHandler.swift` in iOS: just-in-time pre-prompt after first link (per D7); deny → re-ask 30d; hard-deny → Settings deep-link
- Gateway: `ebt/notifications.ts`

**Lane E — Compliance + counsel:**
- Counsel brief: "Cookie-handoff posture" (PIN never leaves device; session cookie = expiring token, not credential per D4)
- Security review of scraper (cookie storage, key rotation, ATO surface)
- Update `docs/compliance-copy-design.md` with EBT-specific posture
- Lane gates production rollout; does not block dev work

**Test coverage (per T1/T2):**
- 5 critical E2Es: cookie-handoff link, deposit-landed push, receipt OCR auto-match (Phase 2 wires it), scraper sessionExpired re-link, daily-open refresh
- Gateway routes ≥ 90% unit coverage (vitest, makeDbClient + makeQueryBuilder per memory)
- iOS repositories ≥ 80% unit coverage
- A11y: snapshot + VoiceOver + EN/ES parity unit test
- Regression-critical (IRON RULE): `EBTFeatureFlagRegressionTests` + dashboard snapshot at flag-OFF

**Gate:** Lane E counsel sign-off; A11y test pass; 5 E2Es pass

### Phase 2 — Tier 2 deepen (4 weeks)
- Receipts OCR (VisionKit) + match-receipt-job
- Card lock real wire (state-dependent; CA card-lock unavailable as of 2025 — show "coming soon" gracefully)
- Anomaly detector + skimming alerts (per D5)
- News CMS (start: hand-rolled MDX in `apps/dashboard/public/perks/`)
- Job listings tile (link to existing SEIU/UFW/gig surface)

### Phase 3 — Tier 3 monetization (6 weeks)
- Perks marketplace v2 (admin UI, impression/claim tracking)
- Referral payouts
- Surveys-for-cash partner (Pollfish first pass)
- Marketplace partner contracts (parallel-track, not eng work)

### Phase 4 — Tier 4 (deferred)
- Bill pay, tax filing, WIC — only after Tier 1–3 metrics validate retention lift

---

## 6. Tech decisions

| ID | Decision | Choice | Why |
|---|---|---|---|
| | Backend home | `apps/enrollment-api/` | Single JWT, single Sentry, single CI |
| D2 / A1 | Scraper runtime | Fly machine + Playwright; CF Cron triggers Fly webhook | CF Workers can't run Playwright; Fly already runs Civica's Python backend |
| D3 / A2 | Scrape cadence | **Event-driven**: issuance-calendar day-0/day-1 + on-open refresh | Daily poll at 1.6M cards breaks portal + costs unbounded |
| D4 / A3 | Credential model | **Session-cookie handoff** in iOS WebView (PIN never leaves device) | Counsel-defensible; minimizes ATO blast radius vs server-side PIN |
| D5 / A4 | Anomaly signal | Velocity + merchant-name state-code heuristic | Portal returns no geo; merchant string catches cross-state skimming |
| D6 / A5 | Receipt matching | Async auto-match on next scrape (amount ±$0.50, merchant fuzzy ≥0.7, ≤72h window); ambiguous → user picks; ≥7d → standalone | Matches recipient mental model; degrades gracefully |
| D7 / A6 | APNs prompt timing | Just-in-time pre-prompt after first link succeeds | ~70–80% accept vs ~30% at install (Apple HIG) |
| D8 / Q1 | iOS layering | Per-concern Store + Repository (not God-class) | Each new feature ≤150 lines; testable in isolation |
| D9 / Q2 | Strings parity | Split files per feature + parity unit test (reflection-based per §16.8) | Catches EN/ES drift at CI before merge |
| D10 / Q3 | Scraper errors | Typed `EBTScrapeError` enum with per-type banner + CTA; wire format per §16.2 | Recipient knows what to do per failure mode |
| D11 / T1 | E2E test budget | 5 critical paths; rest as integration with mocked scraper | CI stays fast; flake rate manageable |
| D12 / T2 | A11y phase | Phase 1 includes snapshot + VoiceOver + Dynamic Type tests | Blind/elderly recipients are core SNAP demographic |
| D13 / P1 | Scraper fan-out | Fly pool (~50) + queue + 1-hour jitter on issuance days | Survives 10× growth; queue gives ops visibility |
| D14 / P2 | Balance cache | Supabase column `balance_cents + balance_at`, single query | Strong consistency; no eventual-consistency UX bugs around deposits |
| D15 / P3 | First-link backfill | 30d sync + 60d background within 1h | Sub-15s link; recipient sees full month immediately |
| DX1 §16.1 | Route file convention | `apps/enrollment-api/src/routes/ebt/<route>.ts` subdir, one file per route, co-located test | Matches existing Civica per-feature pattern; scales as EBT grows |
| | EBT processor (Tier 2+) | Plaid EBT | Migrate once CA support lands (no roadmap commitment yet) |
| | Receipt OCR | VisionKit (on-device) | No image leaves device until user opts in; iOS 26-native |
| | Push transport | APNs direct, no OneSignal | One vendor dropped; we already manage certs |
| | Categorization | Merchant→category lookup (static JSON) | ML/LLM premature; static covers ~80% |
| | Receipt storage | Supabase Storage + signed URLs, 90-day TTL | Cheap, RLS-compatible |

---

## 7. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ebt.ca.gov captcha / IP ban during scrape rollout | High | Blocks Tier 1 | Event-driven scrape (D3) drops volume ~30×; jitter window (D13); residential proxy fallback only if needed |
| Counsel blocks recipient-credential storage | Low (downgraded post-D4) | Reshape Tier 1 | D4 keeps PIN device-local; counsel brief reframes as "expiring session token" not "credential storage" |
| Plaid EBT CA support delayed past Q4 2026 | High | Tier 1→2 migration stalls | Scraper IS the long-term path; budget for it |
| Push spam → opt-out cascade | Medium | Erodes recipient trust | Default-on for deposit only; just-in-time prompt (D7); preferences screen Phase 1 |
| Perk partners refuse benefits-recipient targeting | Low | Tier 3 stalls | Lead with public-good perks (Market Match, museums) where contracts already exist |
| Receipt OCR fails on common CA grocers' receipts | Medium | Tier 2 ships broken | Manual fallback (user types total); collect failed receipts for fine-tuning |
| ATO surface from session-cookie storage | Medium (downgraded post-D4) | Limited blast (expiring tokens, not PINs) | Vault-encrypt cookies; rotate Fly secret; alert on impossible-travel; 2FA on Civica account |
| Outside-voice scraper-feasibility flag (CMT-1) | Acknowledged | If correct, Phase 1 rewrites | User reviewed + chose to proceed; Lane B Phase-1 PoC validates session timeout assumption before going wide |
| Portal transaction depth assumption wrong (CMT-4) | Unknown | P3 backfill may need redesign | Lane B Phase-1 PoC measures actual depth before P3 sizing |
| Cost: scraper Fly machine-hours scale with active recipients | Medium | Could break unit economics | Auto-stop idle machines; event-driven (D3) cuts polls 30×; review monthly burn |

---

## 8. Open questions

**Closed by eng review:**
1. ~~Counsel — credential storage~~ → **D4: session-cookie handoff, PIN device-local.** Lane E counsel brief.
2. ~~CA card-lock API~~ → Lane A ships 501 stub with CA-specific "Coming soon" copy.
4. ~~Push consent flow~~ → **D7: just-in-time after first link.**
5. ~~Receipt OCR provider~~ → **VisionKit on-device** (start). Re-evaluate in Phase 2 only if accuracy < 80%.

**Still open:**
3. **Plaid EBT CA timeline.** Get confirmed date from Plaid AM; conditional path B activation.
6. **Marketplace anti-pattern guard.** Hard policy: zero display ads, ever? Or allow neutral "sponsored perk" labels in Phase 3? — defer to /plan-ceo-review.
7. **Referral payout mechanism.** Stripe Issuing virtual card? Direct deposit via Dwolla? Or non-cash (perk credit)? — defer to Phase 3 partner research.
8. **B2G angle.** Should work-hours alerts + recert reminders integrated into tracker count toward county compliance dashboards? — coordinate with `project_compliance_page_strategy` owner.

**New from eng review:**
9. **Portal transaction history depth.** 60-day window vs 10-txn cap. Lane B Phase-1 PoC answers this before P3 backfill sizing is finalized. (CMT-4)
10. **Session cookie lifetime + "remember me".** Lane B Phase-1 PoC measures ebt.ca.gov session timeout + identifies whether a long-lived "remember me" cookie exists. Drives D3 event-driven feasibility. (CMT-1)

---

## 9. Test plan

Full coverage diagram + 5 critical-path E2E set + a11y + regression-critical specs in test plan artifact:
`~/.gstack/projects/matthewgg22-Civica/matthewgreer-gentis-claude-compliance-session-2026-05-21-eng-review-test-plan-20260522-200111.md`

Summary:
- **Unit (Swift Testing):** EBTBalanceInsights edge cases (zero balance, single transaction, future deposits, leap years); EBTBalanceRepository (cache merge, optimistic+server reconcile); EBTAnomalyDetector (velocity bursts, state-code match, false positives on payday); EBTReceiptOCR; EBTScrapeError mapping (7 variants); EBTLinkWebView (cookie capture); EBTStringParityTests per §16.8; EBTBalanceA11yTests per T2.
- **Unit (vitest, gateway):** Every route — happy path, auth-missing, processor-down, rate-limit; mock processor with `makeDbClient`/`makeQueryBuilder` pattern per memory.
- **Integration:** Scraper against ebt.ca.gov staging account; assert balance + transactions parse correctly; assert cookie-expired detection; assert captcha detection.
- **5 critical E2Es (per T1/D11):** cookie-handoff link, deposit-landed push, receipt OCR auto-match, scraper sessionExpired re-link, daily-open refresh.
- **Regression-critical (IRON RULE):** `ebt_real_data=false` preserves existing fixture-based experience; dashboard snapshot at flag-OFF must equal pre-plan baseline.
- **Load:** Push notification fan-out at 1.6M cards (simulated); Fly scraper pool at issuance-day peak (160K scrapes in 2-hour window).
- **Security:** ZAP scan on /ebt/* routes; pen-test of scraper credential path; ATO simulation (compromise of Supabase Vault → blast radius limited to expiring cookies per D4).

---

## 10. Metrics (post-launch)

| Metric | Target (90 days post-Phase-1) |
|---|---|
| Linked-card rate among enrolled CA users | ≥40% |
| Daily-active among linked users | ≥30% |
| 1st-of-month notification open rate | ≥60% |
| Low-balance push → in-app session | ≥45% |
| Avg session length (vs. pre-tracker) | +90s |
| 30-day retention (linked vs unlinked cohort) | +20pp |
| Support tickets re: "where's my balance" | -70% |
| Tier 3 perk claim rate | ≥5% MAU |
| **DX**: Time-to-extend (per §16.10) | <30min |

---

## 11. NOT in scope (explicitly deferred)

- **Bill pay** (Tier 4 only) — needs CA-utility partnerships Civica doesn't have today
- **WIC tracking** — CA eWIC is a separate system; not part of EBT processor surface
- **In-app tax filing** — affiliate-only, no co-branded tax product
- **Cross-state launch** — CA-only until Phase 1 metrics validate
- **Real-time ML anomaly detection** — heuristics first (D5); ML after labeled data exists
- **Display advertising** — hard policy, never
- **Plaid EBT path** — parallel-tracked but not in eng scope this plan
- **USDA SNAP retailer locator (map)** — Propel-parity gap; proposed during eng review but not added to TODOS.md
- **Multi-card support (CalFresh + Cash Aid on separate cards)** — real edge case; proposed during eng review but not added to TODOS.md
- **Card-lock real wire** — Phase 1 ships 501 stub; Phase 2 attempts wire if state processor exposes it
- **Migration of existing CivicaString system to .xcstrings** — out of scope; new EBT strings get parity unit test instead

## 12. What already exists (and how this plan uses it)

| Existing | Reuse posture |
|---|---|
| [EBTBalanceDashboardView.swift](Civica/Features/SNAP/EBTBalance/EBTBalanceDashboardView.swift) (643 lines) | **Preserved.** Real data flows through unchanged surface; loading + error states added via EBTScrapeError banners |
| [EBTBalanceInsights.swift](Civica/Features/SNAP/EBTBalance/EBTBalanceInsights.swift) (pure-fn) | **Preserved.** Already pure; receives real EBTAccount unchanged |
| [EBTBalanceModels.swift](Civica/Features/SNAP/EBTBalance/EBTBalanceModels.swift) | **Preserved.** Server response normalizes to existing EBTTransaction/EBTAccount shape |
| [EBTBalanceFixtures.swift](Civica/Features/SNAP/EBTBalance/EBTBalanceFixtures.swift) | **Preserved behind feature flag** `ebt_real_data=false` (regression-critical) |
| [EBTBalanceStore.swift](Civica/Features/SNAP/EBTBalance/EBTBalanceStore.swift) | **Scope narrowed** to dashboard UI state (Q1/D8); data moves to EBTBalanceRepository |
| [EBTBalanceStrings.swift](Civica/Features/SNAP/EBTBalance/EBTBalanceStrings.swift) (CivicaString pattern) | **Pattern reused**, file split per Q2; new parity unit test guards EN/ES |
| `apps/enrollment-api/` (Hono + Vitest, 92 tests per memory) | **Reused** as backend home; routes mount under `routes/ebt/` subdir per §16.1 |
| Existing route pattern: `apps/enrollment-api/src/routes/buddy.ts` + `buddy.test.ts` | **Pattern reused** — one route file per file with co-located test |
| [docs/accessibility.md](docs/accessibility.md) | **Standards applied** (T2 a11y tests reference it) |
| [docs/compliance-copy-design.md](docs/compliance-copy-design.md) | **Updated** by Lane E with EBT cookie-handoff posture |
| Memory `feedback_vitest_supabase_mock.md` | **Pattern reused**: makeDbClient + makeQueryBuilder for new EBT route tests |
| Memory `feedback_swift_testing_concurrent.md` | **Applied**: any new test suite with nonisolated(unsafe) static state gets `@Suite(.serialized)` |
| CA SNAPAgencyDirectory (per memory `project_launch_state_ca.md`) | **Used** for account-services tel: + URLs |
| Existing JWT/KeychainSession infrastructure | **Reused** for EBT API client auth |

## 13. Open files & next actions

If approved post-review:
1. Branch off `codex/rebuild-feb18` → `claude/ebt-propel-parity-phase-1`
2. Open 5 parallel-lane issues (A/B/C/D/E per §5 Phase 1)
3. Lane E counsel brief drafted in week 1 (gate for prod rollout, not dev)
4. Lane B Phase-1 PoC: probe ebt.ca.gov for session timeout + transaction depth (resolves CMT-1 + CMT-4 open questions)
5. Append `## EBT module conventions` section to root CLAUDE.md per §16.3 — first PR

## 14. Parallelization strategy

Dependency table (module-level):

| Step | Modules touched | Depends on |
|------|-----------------|------------|
| **P1-A** DB + gateway core | `supabase/migrations/`, `apps/enrollment-api/src/routes/ebt/` | — |
| **P1-B** Fly scraper | `fly/ebt-scraper/` (NEW) | Mock /webhooks contract |
| **P1-C** iOS API + store decomp | `Civica/Features/SNAP/EBTBalance/` | Mock gateway contract |
| **P1-D** APNs infra | `Civica/.../EBTBalance/Push/`, `apps/enrollment-api/src/routes/ebt/notifications.ts` | Lane A for register endpoint |
| **P1-E** Counsel + compliance | `docs/compliance-copy-design.md`, root `CLAUDE.md` | — |
| **P2-F** Receipts (OCR + match) | `Civica/.../EBTBalance/Receipts/`, `apps/enrollment-api/src/routes/ebt/receipts.ts`, `apps/enrollment-api/src/jobs/` | P1 merged |
| **P2-G** Anomaly detector | `Civica/.../EBTBalance/Anomaly/` (pure-fn) | P1 merged |
| **P2-H** Card lock graceful UX | `Civica/.../EBTBalance/`, `apps/enrollment-api/src/routes/ebt/lock.ts` | P1 merged |
| **P3-I** Marketplace | `Civica/.../EBTBalance/Perks/`, `apps/enrollment-api/src/routes/ebt/perks.ts`, `apps/dashboard/admin/` | P1+P2 merged; partner contracts |
| **P3-J** Referrals + Surveys | `Civica/.../EBTBalance/Referral/`, `apps/enrollment-api/src/routes/ebt/referrals.ts` | P1 merged |

Parallel lanes:

```
Phase 1 (week 1–3): 5 parallel lanes
  A (DB + gateway) ─────────────┐
  B (Fly scraper)  ─────────────┤── integration test
  C (iOS API+stores) ───────────┤
  D (APNs)         ─────────────┤
  E (counsel + CLAUDE.md)  ─────┘   (gates ship, not work)

Phase 2 (week 4–7): 3 parallel lanes; serialize project.pbxproj merges
  F (receipts) ──┐
  G (anomaly)  ──┤── one PR at a time for Xcode target membership
  H (card lock)──┘

Phase 3 (week 8–13): 2 parallel lanes
  I (marketplace) ───┐
  J (refer+survey) ──┘
```

**Conflict flags:**
- A + D both touch `apps/enrollment-api/src/routes/ebt/index.ts` — solve with predictable ordering
- B + F: Fly scraper emits anomaly events; receipt match-job runs in gateway — define webhook payload schema in shared package first
- F + G + H all touch `Civica/Features/SNAP/EBTBalance/` — per-concern Q1 subdirectories minimize file-level conflicts but Xcode `project.pbxproj` target membership stays a serialization point

## 15. Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific finding above. Run with Claude Code or Codex; checkbox as you ship.

### Phase 1 (Lanes A–E)

- [ ] **T1 (P1, human: ~2 days / CC: ~3h)** — Fly scraper PoC: ebt.ca.gov session timeout + transaction-depth probe (CMT-1 + CMT-4)
- [ ] **T2 (P1, human: ~1 week / CC: ~1 day)** — Counsel brief: cookie-handoff posture, ATO blast-radius, ToS analysis
- [ ] **T3 (P1, human: ~3 days / CC: ~6h)** — DB migrations for ebt_cards/transactions/deposits/device_tokens/notification_prefs (no PIN column, balance cache cols)
- [ ] **T4 (P1, human: ~2 weeks / CC: ~2 days)** — Gateway routes under `apps/enrollment-api/src/routes/ebt/` (per §16.1) + `webhooks.ts` HMAC verify + EBTScrapeError wire format per §16.2
- [ ] **T5 (P1, human: ~2 weeks / CC: ~2 days)** — Fly scraper skeleton per §16.7 + Playwright cookie handoff + typed error events
- [ ] **T6 (P1, human: ~1 week / CC: ~1 day)** — iOS per-concern store decomposition (EBTBalanceStore → Repository + UI-state store)
- [ ] **T7 (P1, human: ~3 days / CC: ~5h)** — `EBTLinkWebView` for cookie handoff (WKHTTPCookieStore)
- [ ] **T8 (P1, human: ~2 days / CC: ~3h)** — `EBTScrapeError` enum + per-variant banner copy (EN+ES) + wire-format decoder
- [ ] **T9 (P1, human: ~2 days / CC: ~3h)** — Strings file split per feature + `EBTStringParityTests.swift` per §16.8
- [ ] **T10 (P1, human: ~3 days / CC: ~5h)** — `EBTPushHandler` + just-in-time pre-prompt after first link
- [ ] **T11 (P1, human: ~2 days / CC: ~3h)** — A11y tests (snapshot at xxxLarge + VoiceOver + Dynamic Type)
- [ ] **T12 (P1, human: ~1 day / CC: ~2h)** — Regression-critical feature-flag tests (IRON RULE)
- [ ] **T13 (P1, human: ~2 days / CC: ~3h)** — `EBTAccountServicesView` (CA state directory: tel:, BenefitsCal links)
- [ ] **T14 (P1, human: ~3 days / CC: ~5h)** — 5 critical E2E tests
- [ ] **T15 (P1, human: ~30min / CC: ~5min)** — Append `## EBT module conventions` to root `CLAUDE.md` per §16.3

### Phase 2 (Lanes F–H)

- [ ] **T16 (P2, human: ~1 week / CC: ~1 day)** — iOS: VisionKit receipt capture + on-device OCR
- [ ] **T17 (P2, human: ~3 days / CC: ~5h)** — Gateway `ebt/receipts.ts` + match-receipt-job
- [ ] **T18 (P2, human: ~3 days / CC: ~5h)** — `EBTAnomalyDetector` pure-fn (velocity + merchant state-code) + UI banner
- [ ] **T19 (P2, human: ~1 day / CC: ~2h)** — Card lock graceful UX (CA "Coming soon")
- [ ] **T20 (P2, human: ~3 days / CC: ~5h)** — Post-Phase-1 DX retrospective per §16.10 (`docs/plans/ebt-dx-retro.md`)

### Phase 3 (Lanes I–J)

- [ ] **T21 (P3, human: ~3 weeks / CC: ~3 days)** — Marketplace v2 (repo + routes + admin)
- [ ] **T22 (P3, human: ~1 week / CC: ~1 day)** — Referrals + payouts state machine
- [ ] **T23 (P3, human: ~1 week / CC: ~1 day)** — Pollfish surveys

## 16. Internal Developer Experience (extension points + conventions)

This section is the output of /plan-devex-review (2026-05-22). Persona: a fresh AI agent (Claude Code + gstack, or Codex) invoked to extend the EBT feature with no conversation context — the recurring "developer" for Civica today. DX target: agent extends a new card type / processor / state / locale in ≤30 minutes from plan + one file read.

### 16.1 Route file convention

Plan §4.1 originally listed `ebt-link.ts`, `ebt-balance.ts`, etc. — multi-file with `ebt-` prefix. **Existing Civica convention** ([apps/enrollment-api/src/routes/](apps/enrollment-api/src/routes/)) is **one file per feature** (`buddy.ts`, `consents.ts`, `documents.ts`) with co-located `.test.ts`. The plan's multi-file/prefix pattern diverges from repo norms.

**Decision (DX1):** Follow existing Civica convention. EBT lives at `apps/enrollment-api/src/routes/ebt/` subdirectory — one route per file, co-located test, `index.ts` exports `mountEbt(app)`. Subdirectory grouping (vs flat prefixed files) scales better as EBT grows past 10 routes; an agent finds everything with one `ls apps/enrollment-api/src/routes/ebt/`.

### 16.2 Wire format for EBTScrapeError

D10 defined the iOS Swift enum; this defines the JSON wire format gateway returns. Standardize as Stripe-style:

```json
{
  "error": {
    "type": "ebt_scrape_error",
    "code": "sessionExpired",
    "message": "Your EBT card link has expired. Please re-link to continue.",
    "cta": {
      "kind": "re_link",
      "target": "civica://ebt/link"
    },
    "doc_url": "https://help.civica.app/ebt/re-link"
  },
  "request_id": "req_abc123"
}
```

Codes match the EBTScrapeError enum exactly: `networkTimeout | portalDown | sessionExpired | captcha | pinLocked | cardClosed | parseError`. iOS decodes `error.code` into the enum; `cta.kind` drives the banner CTA per D10. New error variant = (a) add code to gateway emitter, (b) add case to iOS enum, (c) add CTA copy in EN+ES. Three-point change with a checklist.

### 16.3 CLAUDE.md additions

Current root CLAUDE.md is 18 lines (skill routing only). For a future agent to find EBT module conventions, append a `## EBT module conventions` section after the existing skill routing — task T15.

Content (recommended):

```markdown
## EBT module conventions

When working in `Civica/Features/SNAP/EBTBalance/` or `apps/enrollment-api/src/routes/ebt/`:
- iOS layering: per-concern Store + Repository (see `EBTBalanceRepository.swift` for template). Never add data-fetching to a Store.
- Strings: split per feature into `Strings/EBT{Concern}Strings.swift`. Every CivicaString MUST have both `.en` and `.es` (parity unit test in EBTStringParityTests catches drift at CI).
- Scrape errors: typed enum (`EBTScrapeError.swift`), wire format per plan §16.2.
- Gateway routes: one file per route under `apps/enrollment-api/src/routes/ebt/`, co-located `.test.ts`, mounted via `ebt/index.ts`.
- Scraper logic: lives in `fly/ebt-scraper/` (separate service), emits typed events to `/webhooks/ebt-scraper`.
- Tests: Swift Testing (`@Test`/`@Suite`). Suites with `nonisolated(unsafe)` static state get `@Suite(.serialized)`.
- Test fixtures: `Civica/Features/SNAP/EBTBalance/__fixtures__/`.

To add a new card processor: see plan §16.4.
To add a new error variant: see §16.2.
To add a new push category: see §16.5.
```

### 16.4 Extension recipe — new card processor

When a future agent is asked to "add support for processor X" (eWIC, Plaid CA, FIS direct):

1. **Add processor column value.** Insert into `ebt_cards.processor` enum (Supabase migration): `'ewic'`, `'plaid_ca'`, etc.
2. **Add scraper module.** New subdir in `fly/ebt-scraper/src/processors/X/` with `login.ts`, `parse-balance.ts`, `parse-transactions.ts`. Implement the `Processor` interface (see `fly/ebt-scraper/src/processor.ts`).
3. **Register in scraper dispatcher.** Add case to `fly/ebt-scraper/src/scrape.ts` switch on `card.processor`.
4. **Add link UI variant.** New `EBTLinkWebView` subclass or strategy parameter for processor-specific login URLs (eWIC may not have a portal — link flow may be card-number-only).
5. **Update gateway `ebt/link.ts`** to accept processor in payload; route to right scraper endpoint.
6. **Tests:** processor-specific scraper integration test against staging account; gateway route test with new processor enum value.
7. **Update plan §4.3** with the new processor entry.

Effort estimate: ~3–5 days human / ~1 day CC for a well-bounded processor.

### 16.5 Extension recipe — new push category

1. Add notification pref column to `ebt_notification_prefs` (Supabase migration): `<category>_on` boolean.
2. Add `EBTNotificationCategory` enum case in iOS `EBTNotificationPrefsStore.swift`.
3. Add APNs send helper in `apps/enrollment-api/src/routes/ebt/notifications.ts` for the new category.
4. Add toggle row in iOS `EBTNotificationPrefsView.swift`.
5. Add EN+ES copy in `Strings/EBTPushStrings.swift` (parity test enforces both).

### 16.6 Extension recipe — new state launch (post-CA)

1. Copy `docs/plans/ebt-tracker-propel-parity.md` to `ebt-tracker-{state}-launch.md`.
2. Add state-specific scraper under `fly/ebt-scraper/src/processors/{state}/` if portal model differs.
3. Add state issuance calendar to `apps/enrollment-api/src/routes/ebt/deposit-calendar.ts` (case-suffix → day-of-month mapping).
4. Add state agency directory to iOS `EBTAccountServicesView.swift` and SNAPAgencyDirectory.
5. Update `supportedStateCodes` in plan + per memory `project_launch_state_ca.md`.

### 16.7 Fly scraper bootstrap

Civica has no `fly/` directory today. Phase 1 ships a complete templated skeleton:

```
fly/
  ebt-scraper/
    Dockerfile               # Node + Playwright base
    fly.toml                 # 50 machines auto-stop; region sjc; HTTP service
    package.json             # Hono, Playwright, Sentry
    src/
      server.ts              # POST /scrape; HMAC verify; dispatch by processor
      processor.ts           # Processor interface
      processors/ebt-ca/     # First processor
        login.ts, parse-balance.ts, parse-transactions.ts, errors.ts
      scrape.ts              # Dispatcher
      events.ts              # Emit typed events to /webhooks/ebt-scraper
    test/ebt-ca.test.ts      # Integration against staging
    README.md                # Local dev; staging vs prod
```

Local-dev recipe in `fly/ebt-scraper/README.md`: `fly launch --copy-config --no-deploy` → `fly secrets set EBT_SCRAPER_SECRET=...` → `flyctl deploy`. Don't run Playwright on local Mac for dev — use Fly machine + `flyctl logs` for debugging (per memory `feedback_fly_deploy_worktree`, deploy from `~/Developer/Civica`, not worktrees).

### 16.8 Strings parity unit test stub

```swift
import Testing
@testable import Civica

@Suite("EBT strings have EN/ES parity")
struct EBTStringParityTests {
    @Test("Every CivicaString in EBT* namespaces has both languages")
    func parity() throws {
        let namespaces: [Any.Type] = [
            EBTBalanceStrings.self, EBTPushStrings.self, EBTReceiptStrings.self,
            EBTAnomalyStrings.self, EBTAccountServicesStrings.self,
            EBTPerksStrings.self, EBTReferralStrings.self,
        ]
        for ns in namespaces {
            let mirror = Mirror(reflecting: ns)
            for child in mirror.children {
                guard let cs = child.value as? CivicaString else { continue }
                #expect(!cs.en.isEmpty, "EN missing in \(String(describing: ns)).\(child.label ?? "?")")
                #expect(!cs.es.isEmpty, "ES missing in \(String(describing: ns)).\(child.label ?? "?")")
            }
        }
    }
}
```

New strings file → add to `namespaces` array. Forgetting the array entry is the failure mode; mitigate via a separate test that asserts `namespaces.count == <expected>` matched against a directory scan of `Strings/`.

### 16.9 Test framework + fixtures convention

- All new EBT tests: **Swift Testing** (`@Test`/`@Suite`), not XCTest. Per memory `feedback_swift_testing_concurrent`, suites with `nonisolated(unsafe)` static state get `@Suite(.serialized)`.
- Vitest patterns for gateway tests: `makeDbClient` (non-thenable, for `withActorContext`) + `makeQueryBuilder` (thenable, for query chains) per memory `feedback_vitest_supabase_mock`.
- Fixtures live at `Civica/Features/SNAP/EBTBalance/__fixtures__/` (iOS) and `apps/enrollment-api/src/test/fixtures/ebt/` (gateway).

### 16.10 DX measurement

Post-Phase-1 retrospective (Task T20). The next time an engineer adds a new EBT capability (Phase 2 receipt scope counts as the first measurement), record:
- Wall time from "task assigned" to "PR open"
- Number of plan/CLAUDE.md re-reads
- Number of "wrong shape" PR comments

Target: <30min wall time for a well-bounded extension; <2 re-reads; 0 wrong-shape comments. Track in `docs/plans/ebt-dx-retro.md`.

### 16.11 DX scorecard

```
DIMENSION              BEFORE  AFTER (with §16)  TARGET
Getting Started        5/10    9/10              9/10
API/CLI/SDK (routes)   6/10    8/10              8/10
Error Messages         6/10    9/10              9/10
Documentation          6/10    9/10              9/10
Upgrade Path           7/10    8/10              8/10
Dev Environment        5/10    8/10              8/10
Community              N/A     N/A               N/A (internal)
DX Measurement         4/10    6/10              7/10
─────────────────────  ──────  ────────────────  ──────
Overall                5.6     8.1               8.3
Time-to-extend (est)   >2h     <30min            <30min
```

DX principle coverage (post-§16):

| Principle | Status |
|---|---|
| Zero Friction | covered (skeleton ship, CLAUDE.md, extension recipes) |
| Learn by Doing | covered (T15 CLAUDE.md addition gives copy-paste-ready conventions) |
| Fight Uncertainty | covered (§16.2 wire format; §16.4-16.6 extension recipes) |
| Opinionated + Escape Hatches | covered (Q1 layering opinion + processor-strategy escape hatch) |
| Code in Context | covered (parity test stub §16.8; scaffold §16.7) |
| Magical Moments | covered (target: agent extends in <30min) |

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | OPEN (unrelated session 2026-05-22) | not run on this plan |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 15 issues found, 17 decisions locked (D2-D15 + DX1 + CMT-1/4), 0 unresolved, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 1 | CLEAR (PLAN) | score: 5.6/10 → 8.1/10, TTHW (time-to-extend) target: <30min, persona: AI agent (CC+gstack/Codex) extending EBT, mode: DX POLISH, 8 passes complete |
| Outside Voice | claude subagent (codex unavailable) | Adversarial plan challenge | 1 | ISSUES | 5 findings; CMT-1 (scraper feasibility) + CMT-4 (CA facts) presented; user kept scraper, verified 274-day, portal depth deferred to PoC |

**CROSS-MODEL:** Outside voice argued (a) scraper is mechanically broken + B2G-killer, (b) parity is wrong strategic frame, (c) marketplace should be Phase 1, (d) 365-day inactivity (wrong: 274 confirmed), (e) portal returns 10 txns not 60d (unverifiable; Lane B PoC will probe). User reviewed each tension: kept scraper, affirmed parity scope, kept Phase 1 ordering, one fact corrected, one set as Phase-1 prereq.

**UNRESOLVED:** 0 decisions left unresolved by user across eng + devex reviews. Phase-1 PoC questions (session timeout + portal txn depth) tracked as Lane B prerequisites, not silent gaps.

**VERDICT:** ENG + DEVEX CLEARED — ready for implementation. Recommended next steps: branch off `codex/rebuild-feb18` → `claude/ebt-propel-parity-phase-1`; open 5 parallel-lane issues per §5; Lane E counsel brief + Lane B Phase-1 PoC start week 1.
