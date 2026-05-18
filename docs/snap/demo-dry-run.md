# SNAP Demo Dry-Run Checklist

**Purpose:** Manually execute this checklist end-to-end on a **fresh test account** before every demo. This document IS the launch readiness gate — if you cannot complete it cleanly, the demo is not ready.

**Owner:** Matthew
**Last updated:** 2026-05-18
**Default state:** California / English

---

## Pre-flight

- [ ] Fresh test phone number available (one that has never enrolled)
- [ ] iOS device or simulator running iOS 26+, TestFlight build installed
- [ ] Web preview URL confirmed reachable (see [vercel-deploy-fix.md](vercel-deploy-fix.md) if 404)
- [ ] Dashboard navigator + demo cast seeded: `psql $UAT_DB_URL -f scripts/seed-demo-applicants.sql` (see [Demo cast](#demo-cast) below for what this provisions)
- [ ] Sentry dashboards open in a background tab (catch errors live)
- [ ] A sample paystub PDF + photo on hand for doc upload steps
- [ ] Stopwatch ready for the cross-surface 30s SLO check

---

## Demo cast

The `scripts/seed-demo-applicants.sql` script provisions 6 sympathetic applicants spanning the full packet lifecycle, all in California, mixed EN/ES. They give the dashboard queue + `ActivityTicker` the live-product feel an empty UAT shell lacks.

| Applicant | Lang | Status | What they show |
|---|---|---|---|
| **Maria Hernandez** | es | Submitted for Review | expedited flag, 1 missing rent receipt — the "navigator-friction" demo |
| **James Wilson** | en | In Navigator Review | clean docs (paystub + ID + lease, all confirmed) — the "fast happy path" demo |
| **Aisha Johnson** | es | Closed | consent withdrawn — shows the consent-withdrawal lifecycle works |
| **Daniel Park** | en | Needs Applicant Clarification | OCR-vs-applicant income discrepancy ($2,240 paystub vs $1,600 self-report) — the "AI catches errors" demo |
| **Sarah Chen** | en | Draft | partial answers, no docs — the "in-progress applicant" demo |
| **Roberto Vasquez** | es | Ready for Handoff | 5 confirmed docs, navigator-confirmed answers, PDF-ready — the "handoff export" demo |

### Recommended demo narrative

Focus on **Maria** (Spanish, expedited, missing one doc) for the navigator-workflow story — she's the sympathetic case that lets you say "watch how the navigator resolves a real human friction point in seconds." Switch to **Daniel** to show the AI-vs-applicant discrepancy catch. Close with **Roberto** to show a packet exporting cleanly via the handoff PDF.

### Live ticker pop (during demo)

To make the `ActivityTicker` light up live in front of the audience, run this single SQL command in a separate terminal while the dashboard is open:

```bash
psql $UAT_DB_URL -f scripts/demo-trigger-ticker-event.sql
```

Promotes Sarah's Draft → Submitted for Review. Audience sees the ticker prepend the new event within 1-3s. The script is idempotent — if Sarah was already promoted, it picks the next Draft packet, or notices that none remain.

### Reset between demos

```bash
psql $UAT_DB_URL -f scripts/seed-demo-applicants-CLEAR.sql  # wipe demo applicants
psql $UAT_DB_URL -f scripts/seed-demo-applicants.sql        # re-seed
```

The CLEAR script preserves the demo org + navigator `staff_user` so re-seeding is a 2-second reset, not a full re-provision.

---

## 1. iOS Surface

### 1.1 Cold-launch app
- **Action:** Force-quit Civica, then relaunch.
- **Expected:** Splash → home dashboard. SNAP entry tile visible above the fold with the California label.
- **If it fails:** Tile may be gated by remote config — skip ahead by deep-linking via `civica://snap/estimator`. If that also fails, **pause demo here** and switch to web walkthrough.

### 1.2 Estimator
- **Action:** Tap SNAP tile → Estimator. Enter household size **2**, monthly income **$1800**, rent **$900**. Tap Calculate.
- **Expected:** Result screen shows estimated benefit, eligibility verdict, **source citation footer** ("Based on FY2026 USDA SNAP rules…"), and (after Wave 2 Task 2 ships) the **federal-vs-state copy block** explaining CA's CalFresh overlay.
- **If it fails:** Estimator caches last result — back out, re-enter once. If still broken, say *"The estimator is the simplest piece — let me show you the application flow instead, which is the real value"* and skip to 1.3.

### 1.3 Start application + phone OTP
- **Action:** Back to SNAP entry → "Start application" → enter test phone → submit.
  - TestFlight: receive real SMS.
  - Dev build: pull magic code from Supabase Auth logs or the dev panel.
- **Expected:** OTP screen accepts code, lands on first application section. Session token persisted in Keychain (close + reopen app → still signed in).
- **If it fails:** Twilio outage is the usual culprit. Fall back to the **dev magic-code path** and narrate *"In production this would be an SMS — for the demo we're using a dev shortcut so you can see the flow."* If Keychain session breaks, see [project_enrollment_gaps_pr93.md] context.

### 1.4 Complete first 3 application sections
- **Action:** Fill household, income, expenses sections. Tap Continue between each.
- **Expected:** Each section autosaves; progress bar advances; back-navigation preserves entries. No validation errors with realistic inputs.
- **If it fails:** Note which section, skip it via Continue (server allows partial), and continue. Say *"Section X has known validation polish pending — we're tracking it."*

### 1.5 Interview Coach
- **Action:** From dashboard or application sidebar → Interview Coach → "Start practice."
- **Expected:** First practice question renders within 3s. Voice prompt audible (if device unmuted). Requires Wave 1 edge functions deployed — verify by checking `interview-coach` function status in Supabase.
- **If it fails:** Coach is the newest surface. Say *"Interview Coach is in beta — let me show the next core piece"* and skip to 1.6. Do **not** retry repeatedly on stage.

### 1.6 Doc scanner — paystub
- **Action:** Application → Documents → Add document → Scan paystub → capture page.
- **Expected:** Camera captures → processing spinner (~2-4s) → **extraction overlay** shows detected fields (employer, gross, pay date) over the scan thumbnail. Tap Save → document appears in list with extracted metadata.
- **If it fails:** Switch to **photo upload from library** using the prepared sample image. Extraction overlay may not render — that's acceptable. Narrate *"OCR runs server-side; for this demo we'll upload directly so you see the doc landing on the navigator side."*

### 1.7 Submit + waiting room
- **Action:** Complete remaining sections (or use "Submit partial for review" if enabled) → tap Submit.
- **Expected:** Waiting-room screen with status timeline (Submitted → In Review → …). Push-notification permission prompt may appear on first submit — accept.
- **If it fails:** If submit hangs >10s, check Sentry. Refresh the screen — submitted packets reappear. Say *"The packet is in — let me show you what the navigator sees."* and jump to dashboard surface.

---

## 2. Web Surface

### 2.1 Open marketing/app entry
- **Action:** Open `civica.example/en` (or the current Vercel preview URL).
- **Expected:** Marketing landing page loads <2s, Lighthouse-clean, hero + Sign In button visible.
- **If it fails:** Likely the `civica-app` Vercel Root Directory misconfig — see [vercel-deploy-fix.md](vercel-deploy-fix.md). Fallback to the **last green preview URL** from the PR list.

### 2.2 Sign in via OTP
- **Action:** Click Sign In → enter same test phone (or a second one if iOS is mid-flow) → submit OTP.
- **Expected:** Redirect to onboarding (new account) or app home (returning).
- **If it fails:** Same Twilio fallback as 1.3 — use dev magic code if available. Otherwise switch to the seeded navigator account for the rest of the web flow (acknowledge the limitation).

### 2.3 Onboarding
- **Action:** Pick **California** + **English**.
- **Expected:** Selection persists; lands on app home with CA-conditioned copy (CalFresh terminology where appropriate).
- **If it fails:** If MA shows up by default, state selector dropdown is stuck — refresh once. Don't dwell.

### 2.4 Answer 3 questions, confirm autosave
- **Action:** Open any application section, answer 3 questions, **hard refresh the page** (Cmd-R).
- **Expected:** Answers still present after reload.
- **If it fails:** Autosave is a tentpole feature — if it breaks, say *"We're seeing an autosave hiccup on this preview — production has a longer-running test in place"* and move on. **Flag for post-demo investigation.**

### 2.5 Upload doc via /app/documents
- **Action:** Navigate to `/app/documents` → Upload → pick prepared paystub.
- **Expected:** File appears in list with size + timestamp, status "Uploaded."
- **If it fails:** Multipart upload through the gateway is newest — check enrollment-api logs. Fall back to iOS doc upload (already done in 1.6) for the cross-surface story.

### 2.6 Consent page
- **Action:** Account → Privacy / Consent → toggle **Withdraw Consent**.
- **Expected:** Confirmation modal appears with clear copy; Cancel dismisses; Confirm logs the withdrawal (don't actually confirm during demo — Cancel).
- **If it fails:** Skip — this is a compliance surface, not a demo highlight. Note for follow-up.

### 2.7 Footer privacy + "Do Not Sell" anchor
- **Action:** Scroll to footer → click Privacy → on Privacy page, click the **Do Not Sell My Personal Information** link.
- **Expected:** Page navigates to Privacy, anchor scrolls smoothly to the Do-Not-Sell section.
- **If it fails:** Anchor mis-target is cosmetic — scroll manually and read the section header aloud.

---

## 3. Dashboard Surface

> **Prereq:** `scripts/seed-uat-navigator.sql` has been run against the demo DB. The seeded navigator credentials + the seeded packet ID should be in 1Password under "Civica UAT Navigator."

### 3.1 Sign in as seeded navigator
- **Action:** Open dashboard URL → sign in with seeded navigator email/OTP.
- **Expected:** Lands on `/packets` with the navigator's name in the top-right.
- **If it fails:** Re-run the seed script — the seeded user TTL may have expired. If RLS blocks, check the navigator role claim on the JWT.

### 3.2 /packets queue
- **Action:** View `/packets`.
- **Expected:** Queue renders with bucketed columns; **seeded packet visible in "Submitted for Review."**
- **If it fails:** Filter chips may default to "Assigned to me" — switch to "All." If still empty, the seed inserted to the wrong env.

### 3.3 Open packet — tabs
- **Action:** Click seeded packet → cycle through **Answers**, **Docs**, **Fields** tabs.
- **Expected:** Answers tab shows applicant responses; Docs tab lists uploaded files (preview works); Fields tab shows derived/computed fields.
- **If it fails:** If Docs tab is empty, the packet may pre-date doc upload — pivot to the live packet from §1.7 instead.

### 3.4 Audit log
- **Action:** Navigate to `/packets/:id/audit`.
- **Expected:** Audit page renders **DB-trigger events** (status changes, doc uploads, navigator views) in reverse-chronological order with actor + timestamp.
- **If it fails:** This is the compliance showpiece — if it's blank, say *"Audit events are written by DB triggers; this view is the read side and it's having a hiccup. The events are in `audit_events` regardless."* and pull up the table in the SQL console if pressed.

### 3.5 Advance status with blocker checks
- **Action:** Click status menu → advance one step (e.g., Submitted → In Review).
- **Expected:** **Blocker check fires** (e.g., "Missing income doc") if applicable → resolve inline or acknowledge → status advances → audit event written.
- **If it fails:** If status moves without blocker enforcement, that's a regression — note it. If it errors out, refresh and try a different transition.

### 3.6 Generate handoff PDF
- **Action:** Packet menu → **Generate handoff PDF** → wait for completion → download → open the PDF.
- **Expected:** Generation completes within ~10s; PDF opens; **applicant data (name, household, income, doc references) is present and readable**.
- **If it fails:** Handoff PDF ships and is covered by the nightly E2E (PRs #101–#103). If it errors live, check enrollment-api logs for the signed-URL step — most likely culprit is a missing/expired Supabase service-role secret on the deploy. Keep a recent nightly artifact handy as a backup so the demo can keep moving.

---

## 4. Cross-Surface (The Showpiece)

> **This is the moment of the demo. Practice this section twice before the real run.**

### 4.1 Same applicant signs in on iOS
- **Action:** On iOS, sign in with the test phone used above (or a fresh one for a clean run).
- **Expected:** Lands signed in; existing or new application visible.
- **If it fails:** Cross-surface story breaks without this — fall back to narrating the architecture with screenshots.

### 4.2 Submit application from iOS
- **Action:** Complete + submit application from iOS (per §1.7).
- **Expected:** Waiting-room screen appears on iOS.
- **If it fails:** Same fallback as 1.7.

### 4.3 Packet appears in dashboard queue within 30s
- **Action:** Switch to dashboard (already signed in as navigator from §3) → `/packets` → **start stopwatch at iOS submit**.
- **Expected:** New packet appears in "Submitted for Review" bucket **within 30 seconds**. Refresh once at ~15s if not auto-updating.
- **If it fails:** This is the SLO. If it takes 60s+, say *"Replication is typically sub-30s; we're seeing some latency on the preview env."* If it never appears, check the gateway logs — there may be a webhook drop.

### 4.4 ActivityTicker lights up within ~3s (the wow-moment)

> **Verified 2026-05-18.** See [§5 — Realtime wire audit](#5-realtime-wire-audit-technical) for the full trace.

- **Action:** While watching the dashboard `/packets` page with the ActivityTicker visible (top-right of the queue), submit from iOS (§4.2) or fire the curl below.
- **Expected:** The ActivityTicker prepends **"Packet `XXXXX` → Submitted for Review"** (indigo dot) within ~3 seconds of the iOS tap. No page refresh needed.
- **How it works:** `POST /me/packets/:id/submit` (enrollment-api) updates `snap_packets.status`. A Postgres `BEFORE UPDATE` trigger (`enforce_status_transition`) unconditionally inserts a row into `snap_enrollment.packet_status_history`. The ActivityTicker holds an open Supabase Realtime channel subscribed to `INSERT` on that table — the push arrives in the same DB round-trip.
- **If it fails — debug order:**
  1. Check that Supabase Realtime is enabled for `snap_enrollment.packet_status_history` (table-level publication must include the schema; check `supabase_realtime` publication in DB).
  2. Confirm the enrollment-api is using the **service-role** key for the status update (anon key would hit RLS and may be blocked before the trigger fires).
  3. Confirm the dashboard Supabase client is using the **anon key + navigator JWT** (service-role on the client side would bypass Realtime channel auth).
  4. As a fallback, verify the row landed: `SELECT * FROM snap_enrollment.packet_status_history ORDER BY occurred_at DESC LIMIT 5;`

**curl dry-run (staging):** Replace `$TOKEN` with a valid applicant JWT and `$PACKET_ID` with the draft packet's UUID.

```bash
# Submit a draft packet — same request EnrollmentAPIClient.submitPacket() sends
curl -X POST "$ENROLLMENT_API_URL/me/packets/$PACKET_ID/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nHTTP %{http_code} in %{time_total}s\n"

# Verify the history row landed (run against staging DB)
psql "$STAGING_DB_URL" -c \
  "SELECT history_id, from_status, to_status, occurred_at \
   FROM snap_enrollment.packet_status_history \
   WHERE packet_id = '$PACKET_ID' \
   ORDER BY occurred_at DESC LIMIT 3;"
```

Expected history row:

| from\_status | to\_status | occurred\_at |
|---|---|---|
| Draft | Submitted for Review | (timestamp within ms of the POST) |

### 4.5 Doc request round-trip
- **Action:** Open the freshly-submitted packet in dashboard → **Request additional document** → pick a doc type (e.g., utility bill) → send.
- **Expected:** Confirmation toast in dashboard. **Switch to iOS** → open the app (inbox badge should appear) → tap inbox → **document request visible** with doc type, deadline, and an Upload CTA.
- **If it fails:** Inbox sync is the newest cross-surface wire. If the request doesn't appear on iOS within 30s, pull-to-refresh the inbox once. If still missing, narrate *"The request is in the DB; the iOS inbox poll is on a 60s cadence in this build."* and pivot.

---

## 5. Realtime wire audit (technical)

> Audited 2026-05-18. No code changes were required — the wire was already intact.

### 5.1 Submit path (iOS + web share the same gateway call)

| Layer | File | Detail |
|---|---|---|
| iOS client | `Civica/Features/SNAP/Enrollment/EnrollmentAPIClient.swift:96` | `postEmpty(path: "/me/packets/\(packetId)/submit")` |
| Web action | `web/lib/api/actions.ts:152` | `client.POST("/me/packets/{packetId}/submit", …)` |
| Gateway route | `apps/enrollment-api/src/routes/me-packets.ts:431` | `POST /:packetId/submit` — updates `snap_packets.status = 'Submitted for Review'` using the **service-role** client |
| DB trigger | `supabase/migrations/20260521_snap_enrollment_06_triggers_guards.sql:204` | `guard_status_transition` fires `BEFORE UPDATE OF status` on `snap_packets` |
| History insert | same file, line 175 | `INSERT INTO snap_enrollment.packet_status_history (packet_id, from_status, to_status, …)` — unconditional on any valid transition |
| Realtime push | `apps/dashboard/components/ActivityTicker.tsx:32` | Channel subscribes to `{ event: 'INSERT', schema: 'snap_enrollment', table: 'packet_status_history' }` |

### 5.2 What is and isn't populated in the history row

| Column | For applicant submits | For navigator advances |
|---|---|---|
| `packet_id` | ✓ | ✓ |
| `from_status` / `to_status` | ✓ | ✓ |
| `occurred_at` | ✓ (`clock_timestamp()`) | ✓ |
| `changed_by_staff_id` | **NULL** (no `withActorContext()` call in submit route) | ✓ (navigator routes call `withActorContext`) |
| `changed_by_applicant_id` | **NULL** (trigger doesn't populate it; column exists but is unused) | NULL |
| `reason` | NULL | ✓ (from `snap_enrollment.transition_reason` session var) |

**Impact on ActivityTicker:** none — it reads only `history_id`, `to_status`, `from_status`, `occurred_at`, and `packet_id`. The NULL actor columns don't affect real-time delivery.

**Possible future improvement (not blocking demo):** the submit route could call `SET LOCAL snap_enrollment.actor_id = $applicant_id` so audit trails distinguish applicant- vs. navigator-initiated transitions. This is a one-liner addition to the route handler and could be a follow-up task.

---

## Post-demo

- [ ] Capture any failures observed in this run with a Linear/GitHub issue
- [ ] Note the actual stopwatch time from §4.3 in the demo log
- [ ] Sign out from all surfaces; rotate test phone if it was a real number you'll reuse
- [ ] Reset the demo DB if a destructive action was taken

---

## Decision rule

If **any single step** in §4 (cross-surface) fails on the dry run, **the demo is not ready**. Fix and re-run before going live. iOS or web individual surfaces may have one workaround in play; cross-surface must be clean.
