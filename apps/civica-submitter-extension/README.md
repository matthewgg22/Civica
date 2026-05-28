# Civica Submitter — Chrome Extension (Sideload MVP)

A Chrome Manifest V3 extension that autofills BenefitsCal CBO Manager
application forms from a Civica packet. Intended for partner-CBO trials:
assisters at other organizations install this in their own Chrome, log
in to BenefitsCal under **their own** CBO Manager credentials, and let
the extension type the prepared packet data while they review and
submit.

The legal-posture difference from the server-side path (`/benefitscal/*`
routes) is that the actor at the keyboard is always the assister
themselves — Civica is just a typing assistant, like a password manager
or accessibility tool. The submit click happens in their browser, in
their session, attributed to their named CBO assister account in
CalSAWS logs.

## Status

**Sideload-only MVP.** Not on the Chrome Web Store. Two hard blockers
gate functional autofill:

1. **TODO-14** — the 9 form-page selectors inside
   `packages/benefitscal-cbo/src/field-map.ts` carry `todo: true` flags
   because they haven't been captured against a live CBO Manager
   portal yet. The extension correctly recognizes the field-map's
   form pages and renders an overlay showing how many fields it
   _would_ have filled, but it skips every field until TODO-14 is
   cleared.
2. **PII decryption** — the gateway's `/extension/.../payload`
   endpoint returns Phase-1 ciphertext for `full_name`, `dob`,
   `phone`, and `address`. The extension marks these as skipped with
   a clear console log until the same Phase-2 decryption work that
   unblocks the server-side submitter is wired up. Both unblock
   together when CBO Manager access lands.

What works today:
- Manifest + build pipeline.
- Background service worker brokering bearer-token authenticated
  requests to the Civica gateway.
- Content script: URL match against `APPLICATION_FORM_PAGES`, an
  overlay that surfaces filled/skipped counts to the assister, and a
  confirmation-page capture path that records the BenefitsCal case
  number back to Civica via `POST /extension/.../confirm`.
- Options page for entering the Civica gateway URL + bearer token.
- 21 unit tests covering the fill loop, payload-path resolver, and
  TODO-skip semantics.

## Sideload install

1. `pnpm install --filter @civica/civica-submitter-extension`
2. `pnpm --filter @civica/civica-submitter-extension build`
   Outputs `apps/civica-submitter-extension/dist/`.
3. Open `chrome://extensions` in Chrome.
4. Toggle **Developer mode** on (top-right).
5. Click **Load unpacked**.
6. Pick the `apps/civica-submitter-extension/dist/` directory.
7. Pin the extension to your toolbar (optional — convenient for
   reaching the options page).

## Configure

Right-click the extension icon → **Options** (or via
`chrome://extensions` → Civica Submitter → Extension options).

Three fields:

- **Civica gateway URL** — defaults to
  `https://civica-api.workers.dev`. Override to your staging worker
  URL or `http://localhost:8787` for local dev.
- **Assister bearer token** — provided by Civica. Until per-CBO
  tokens are wired (post-MVP), this is a single shared secret
  configured via `wrangler secret put EXTENSION_BEARER_TOKEN` on
  the enrollment-api side.
- **Active packet ID** — the UUID of the packet you want to fill.
  In the production flow this will be set automatically when an
  assister opens a packet from the Civica dashboard. For sideload
  testing today, paste the UUID manually.

Save. The next time you navigate to a BenefitsCal CBO page, the
extension reads these values and acts.

## Smoke-test flow (selectors-still-TODO build)

1. Stand up the Civica enrollment-api locally with
   `EXTENSION_BEARER_TOKEN` set in `.dev.vars`.
2. Open `chrome://extensions`, reload the Civica Submitter after a
   `pnpm build`.
3. In the options page, set the gateway URL to your local enrollment-api
   and the bearer token to whatever you set in `.dev.vars`.
4. Set an active packet ID for a packet that exists in your local
   Supabase.
5. Navigate to `https://benefitscal.com/cbo/login` (or your CBO
   manager sandbox path).
6. After login, navigate to the application form. You should see a
   small overlay in the bottom-right corner reading something like:
   > Civica Submitter active. Navigate to a CalFresh application
   > page to autofill packet `abc12345`.
7. Navigate to a form page that matches a known `urlPattern` (today
   the patterns are speculative `/cbo/application/...` paths from
   the locked design — they will likely need adjustment after the
   live walkthrough). The overlay should change to:
   > Filled 0 of N fields on this page (N skipped — selectors not yet
   > verified). Review the form, then click Continue.

This confirms the wiring is end-to-end correct: the background fetches
the payload, the content script matches the URL, the field-fill loop
runs, and the overlay reports honest counts. When TODO-14 lands, the
zero count becomes the real fill count and nothing else in the
extension needs to change.

## Architecture quick reference

```
manifest.json
└── content_scripts → benefitscal.com only
    └── content.js (compiled from src/content.ts)
        ├── reads chrome.storage.local for activePacketId
        ├── messages background.js for payload + confirmation
        ├── matches window.location.pathname against
        │   APPLICATION_FORM_PAGES from @civica/benefitscal-cbo
        ├── runs fillField loop, dispatching input/change events
        └── renders a Shadow-DOM overlay with filled/skipped counts

background.js (compiled from src/background.ts)
└── chrome.runtime.onMessage
    ├── "fetchPayload"  → GET  /v1/enrollment/extension/packets/:id/payload
    └── "reportConfirm" → POST /v1/enrollment/extension/packets/:id/confirm

options.html / options.js
└── reads/writes chrome.storage.local for baseUrl, bearerToken, activePacketId
```

All bearer-token storage and HTTP fetches live in the background
worker. The content script never sees the token directly — it only
sends messages and receives sanitized responses, which keeps the
token out of any web-accessible page's reach.

## What this extension never does

- **Auto-submit.** No `.click()` on submit buttons or `.submit()` on
  forms. The assister always advances and submits manually.
- **Touch credentials.** Never reads or writes BenefitsCal
  username/password fields. The assister logged in themselves before
  the extension acts.
- **Run outside benefitscal.com.** Manifest's `content_scripts.matches`
  + `host_permissions` allowlist the BenefitsCal origins only.
- **Auto-fill file inputs.** Browser security prevents JavaScript from
  setting `<input type="file">.value`; the content script
  intentionally skips `file_upload` fields with a clear log.
- **Phone home.** The only outbound HTTP is to the configured Civica
  gateway URL. No analytics, no telemetry.

## Known limits and next steps

- **Per-CBO bearer tokens.** Currently one shared secret per
  environment. When more than one partner CBO is onboarded, the
  gateway gains a `cbo_extension_tokens` table mapping tokens to
  org_ids, and the payload route filters by org.
- **No popup.** Status surfaces via the in-page overlay only. A
  toolbar popup would help when no BenefitsCal tab is open; deferred
  until the MVP gets the first partner sign-off.
- **Active-packet selection.** Manual paste-in for sideload. Once a
  Civica dashboard "Open in extension" button exists, this becomes
  one-click from a packet detail page.
- **Chrome Web Store packaging.** Out of scope for the MVP. When the
  flow is validated against a live portal and at least one partner
  CBO has confirmed adoption appetite, package + submit. Expect
  2-3 weeks of Chrome Web Store review.
