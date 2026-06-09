# Publish runbook — Civica Submitter (unlisted Chrome Web Store)

Goal: get partner CBO officers a **one-click "Add to Chrome"** install (no
developer mode), via an **unlisted** Chrome Web Store listing.

Legend: 🤖 = already done in code · 🧑 = operator (human) action.

---

## 0. Pre-flight (🤖 done in code)
- 🤖 Manifest has `icons` (16/32/48/128) + `action.default_icon` + a real description.
- 🤖 `pnpm --filter civica-submitter-extension package` produces a clean zip
  (`apps/dashboard/public/downloads/civica-submitter.zip`) that unzips to a
  `civica-submitter/` folder with `manifest.json` at root.
- 🤖 Privacy policy page at `/legal/submitter-privacy` (DRAFT).
- 🤖 Store listing copy in `STORE-LISTING.md`.

## 1. Counsel sign-off (🧑 — blocking)
- 🧑 Review `/legal/submitter-privacy` + the data-usage disclosures in `STORE-LISTING.md`.
  Finalize the contact line + entity. Publish the privacy page to prod so its URL is live.

## 2. Build the upload artifact (🤖 → 🧑)
```bash
pnpm --filter civica-submitter-extension package
# → apps/dashboard/public/downloads/civica-submitter.zip
```
🧑 Chrome Web Store wants a zip of the extension **contents** (manifest at the zip
root), not a wrapping folder. Re-zip the dist contents for upload:
```bash
cd apps/civica-submitter-extension/dist && zip -r ../civica-submitter-cws.zip . && cd -
# upload apps/civica-submitter-extension/civica-submitter-cws.zip
```
(The `/downloads/civica-submitter.zip` with the `civica-submitter/` wrapper is for the
load-unpacked pilot path, not the CWS upload.)

## 3. Create the listing (🧑)
1. Go to the Chrome Web Store Developer Dashboard, pay the one-time $5 registration if
   this is a new developer account. Use a Civica-owned Google account.
2. **New item** → upload `civica-submitter-cws.zip`.
3. Fill the listing from `STORE-LISTING.md` (name, summary, description, single purpose,
   permission justifications, category, language).
4. **Privacy practices** tab: set the privacy policy URL to the live
   `/legal/submitter-privacy`; complete the data-usage disclosures per counsel.
5. Upload assets: 128×128 store icon + ≥1 screenshot (1280×800) of the autofilled
   CalFresh page with the yellow highlights.
6. **Visibility: Unlisted.** Submit for review (typically ~1-3 business days).

## 4. Go live (🧑 → 🤖)
1. 🧑 On approval, copy the listing URL: `https://chrome.google.com/webstore/detail/<id>`.
2. 🧑 Set the dashboard env var (Vercel project settings):
   `NEXT_PUBLIC_SUBMITTER_EXTENSION_URL=https://chrome.google.com/webstore/detail/<id>`
3. 🤖 The `/cbo`, `/cbo/setup`, and `/cbo-preview` cards automatically switch from the
   pilot ".zip download" to one-click **"Add to Chrome"** — no code change.

## 5. Officer onboarding (🧑)
Each officer still needs a Civica account to *use* it: install → open the popup →
**Connect with Civica** (device flow) → pick a case → open BenefitsCal. See `/cbo/setup`.

---

## Interim (before approval): the .zip pilot
Until step 4, the cards show **"Download the build (.zip)"** → load-unpacked. To make
that download work on the deployed site, either:
- ensure the deploy runs `pnpm --filter civica-submitter-extension package` (the
  dashboard `prebuild` does this; the zip lands in `public/downloads/`), **or**
- host the zip elsewhere (e.g. a GitHub Release) and set
  `NEXT_PUBLIC_SUBMITTER_EXTENSION_ZIP_URL` to that asset URL.
