# Chrome Web Store listing — Civica Submitter

Copy/paste fields for the **unlisted** Chrome Web Store listing. Unlisted = only
people with the link can install (share it with onboarded partner CBOs); it won't
appear in store search.

---

**Name:** Civica Submitter

**Summary (≤132 chars):**
Pre-fills the California BenefitsCal CalFresh application from a Civica case so a CBO assister can review and submit it faster.

**Category:** Workflow & Planning (or Productivity)

**Language:** English

**Detailed description:**
```
Civica Submitter helps community-based-organization (CBO) assisters file CalFresh
applications faster and more accurately.

When you open an applicant's BenefitsCal CalFresh application in your own browser,
Civica Submitter pre-fills the form fields from the Civica case you selected and
highlights each field it filled. You review everything, fix anything flagged for
manual review, and click BenefitsCal's own Next / Submit yourself.

What it does:
• Pre-fills BenefitsCal CalFresh fields from a Civica case you choose
• Highlights every field it filled so you can verify before moving on
• Shows a review panel of exactly what was written

What it never does:
• It never stores your BenefitsCal username or password — you stay logged in yourself
• It never submits or advances an application — that is always your click
• It runs only on benefitscal.com

Civica Submitter is for authorized CBO assisters with a Civica account. Connect it to
Civica once, pick the case you're working on, and open the BenefitsCal application.
```

**Single purpose (required):**
```
Pre-fill the California BenefitsCal CalFresh application form from an authorized
Civica case for a CBO assister to review and submit.
```

**Permission justifications:**
- `storage` — stores the Civica gateway URL, the assister's access token, and the
  selected case ID locally so the extension knows which case to fill.
- `activeTab` — read/fill form fields on the BenefitsCal tab the assister is on.
- Host permission `https://benefitscal.com/*` — the extension only operates on the
  BenefitsCal portal; it pre-fills that site's CalFresh form. It does not run elsewhere.

**Privacy policy URL:** https://<your-dashboard-domain>/legal/submitter-privacy
(currently a DRAFT — get counsel sign-off + finalize the contact line before submitting)

**Data usage disclosures (Chrome Web Store "Privacy practices" tab):**
- Collects: "Personally identifiable information" + "Web history" → NO (it doesn't
  collect/transmit to the developer; data flows applicant→Civica→portal under the
  assister's own session). Disclose accurately per counsel; do NOT over- or under-claim.
- "Not being sold to third parties": YES (it isn't).
- "Not used for purposes unrelated to the single purpose": YES.

**Assets needed (upload separately — not in this repo yet):**
- Store icon: 128×128 (the manifest icon `icons/icon-128.png` can seed it).
- At least one screenshot 1280×800 (e.g. the autofilled CalFresh page with the yellow
  highlights + review panel). Capture from a real/sanitized session before submitting.
- (Optional) small promo tile 440×280.
