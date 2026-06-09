# Civica Submitter — load & test the real BenefitsCal autofill

This is the **real** extension that autofills the live BenefitsCal CBO portal from a
Civica packet, highlights every field it fills (yellow), shows a review panel, and
**never** clicks Submit — the officer does. This guide loads it into your Chrome and
walks a real test.

> Internal trial build. Filled fields are marked with a **yellow** autofill highlight
> (outline + pale-yellow fill + badge); fields needing manual review are burnt-orange.

## 0. Prerequisites

- Chrome 120+.
- A reachable Civica gateway (enrollment-api) with at least one submittable packet —
  local (`http://localhost:8787`), staging, or prod. The popup connects to it.
- A real BenefitsCal **CBO Manager** login (e.g. the VoteNow Advocacy Foundation
  account). The extension fills the officer's own logged-in session.

## 1. Build

```bash
pnpm --filter civica-submitter-extension build
# → apps/civica-submitter-extension/dist/   (already built if you just ran this)
```

## 2. Load it unpacked

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top-right) on.
3. Click **Load unpacked** → select `apps/civica-submitter-extension/dist/`.
4. "Civica Submitter" appears. Pin it (puzzle icon → pin) so the popup is one click.

## 3. Point it at your Civica gateway

1. Right-click the extension icon → **Options** (or `chrome://extensions` → Details →
   Extension options).
2. Set **Gateway URL** (`civica.baseUrl`) to your gateway, e.g.
   `http://localhost:8787` or your staging URL. Save.

## 4. Connect + pick a packet

1. Click the extension icon → **Connect with Civica** (device-flow auth; sets
   `civica.bearerToken`).
2. Once connected, the popup lists submittable packets. **Pick one** — that sets
   `civica.activePacketId`, which the content script reads on every BenefitsCal page.

## 5. Watch it autofill the real portal

1. Log into **benefitscal.com** (CBO Manager) and start/open a **CalFresh**
   application.
2. On each application page, the content script:
   - fetches the selected packet's approved answers,
   - fills the fields it recognizes (55 portal pages mapped),
   - **highlights each filled field in yellow** + drops a small badge,
   - shows a bottom-right overlay: filled / needs-review / not-found counts, plus
     **Re-fill**, **Clear**, and **Review what Civica filled** (the pre-submit trust
     panel — source value vs what's on the page).
3. **You** review the yellow fields and click the portal's own **Next / Continue /
   Submit**. The extension never advances or submits.

## What you'll see vs. what's still being mapped

- Pages in the selector map autofill + highlight. Unmapped pages (or fields with no
  packet value) are left for you — counted as "needs review", never guessed.
- The income pay-frequency enum and a few step 3-4 sub-flows are partially mapped (see
  `packages/benefitscal-cbo/portal-map/live-walk-2026-06-capture.md` §follow-ups).
  Those fields show as needs-review until their selectors land.

## Troubleshooting

- **Overlay says "No packet selected":** redo step 4 (pick a packet in the popup).
- **"Could not load packet":** check the gateway URL in Options + that you're connected
  (step 4); the gateway must be reachable from your browser.
- **Nothing highlights on a page:** that page isn't mapped yet, or fields hadn't
  hydrated — click **Re-fill** in the overlay. If it persists, the page is unmapped.
- **Extension only runs on benefitscal.com** (manifest host-restricted) — it does
  nothing on other sites by design.
