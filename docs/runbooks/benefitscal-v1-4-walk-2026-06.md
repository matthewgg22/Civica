# BenefitsCal V1-4 Walk Runbook (T7a) — 2026-06

The one human-gated task in the Civica closeout submission rail. Capture the DOM of BenefitsCal steps 2-9 once, so the extension can fill them. Everything downstream (V1-5 PR4/PR5 fill logic, the end-to-end demo) is blocked on the artifacts this walk produces.

**Scope:** California BenefitsCal. Branch reference: `codex/rebuild-feb18`. Closeout decisions this runbook executes: eng D3 (walk method), eng D4 (PII scrub), eng D12 (staff program election). Companion plan: [`docs/plans/v1-5-dom-fill-decomposition.md`](../plans/v1-5-dom-fill-decomposition.md). Parent epic: [#314](https://github.com/matthewgg22/Civica/issues/314) (PRs 4-5).

**What "done" looks like:** ~30-80 new `PortalPage` entries added to `packages/benefitscal-cbo/src/core/selector-map.ts` for steps 2-9, plus jsdom snapshot fixtures, all PII-scrubbed, committed. That unblocks T7b → T8 → T9.

**Why a human:** an agent cannot log into BenefitsCal, walk a real application, or judge "this field is PII." The capture is manual; the conversion to `PortalPage` entries (T7b) can be agent-assisted afterward.

---

## Pre-walk — do these first (no portal needed)

### P0 — Build the PII scrub script (eng D4) — ~30 min
**Precondition:** none. **Do this BEFORE the walk** so no raw PII ever reaches Git.

- **Action:** Create `packages/benefitscal-cbo/scripts/scrub-pii.ts`. It takes a captured HTML/JSON snapshot and replaces PII field *values* (never structure) with deterministic placeholders:
  - Names → `FIRST_TEST` / `LAST_TEST`
  - SSN / SSN-last-4 → `000-00-0000` / `0000`
  - DOB → `1985-03-15`
  - Address lines → `123 Main St` / `Oakland` / `CA` / `94601`
  - Phone → `5105550100`
  - Email → `applicant@example.test`
  - Any `value="..."`, `placeholder` echoing entered data, and pre-filled `<input>`/`<select>` selected states.
- **Keep:** all selectors, `id`/`name`/`aria-label` attributes, label text, option lists, DOM hierarchy. The scrub touches data, not structure.
- **Verification:** run it against a hand-made fixture containing fake-but-realistic PII; confirm output has zero real-looking values and identical structure. Add a unit test `scripts/scrub-pii.test.ts`.
- **Why first:** if the scrub script doesn't exist when you walk, you'll be tempted to commit raw captures "to clean later." Don't. Scrub-on-capture is the only safe order.

### P1 — Decide the walk method (eng D3) — ~15 min
**Precondition:** P0 done.

- **Action, in order of preference:**
  1. **BenefitsCal sandbox.** Check whether CDSS / CalSAWS provides a CBO integration sandbox (ask via the VoteNow CBO contact, or check the CalSAWS partner portal). If one exists, use it — cleanest compliance, no real submission risk. **Try this first.**
  2. **Consenting prod walk under VoteNow CBO.** If no sandbox, walk real BenefitsCal with a *consenting* test applicant's data (you, or a staff member who consents in writing). Legally clean under VoteNow's CBO registration. **ABORT before final submit** — see Safety below.
- **Do NOT:** walk prod with fabricated SSN/identity data (eng D3 rejected option C — risks CDSS terms-of-service violation and Civica's CBO standing).
- **Recorded method:** ______  **Sandbox available? Y / N:** ______

### P2 — Prep the capture toolkit — ~10 min
- Chrome DevTools open (Elements + Network tabs).
- A scratch capture dir **outside the repo**: `~/civica-walk-raw-2026-06/` (raw captures land here, get scrubbed, THEN move into the repo). Never capture directly into the repo tree.
- The existing step-0 + step-1 entries in `selector-map.ts` as your template — match their `PortalPage` shape exactly.
- The program-election plan: the walk should cover the **multi-program superset** path (SNAP + Medi-Cal + TANF) so the captured sequence is the full set; SNAP-only is a subset gated by `sectionSequence()` (eng D8 + D12, already shipped in PR #477).

---

## The walk — steps 2-9

Walk the application as the consenting applicant. At **every page**, capture the per-page record below, scrub it (P0 script), and stage it. The 8 step-groups to capture:

| Step | Section | Capture notes |
|---|---|---|
| 2 | People | Per-HH-member sub-pages; capture the repeat pattern + the "add member" control |
| 3 | Household | Composition, relationships |
| 4 | Income | Per-source rows; capture the "add income" repeat + frequency selectors |
| 5 | Expenses | Shelter, utilities, dependent care, medical |
| 6 | Assets | Gated for SNAP-only via `shouldSkipPageForFlow` (PR #477) — capture anyway for the superset |
| 7 | Other Situations | Special circumstances |
| 8 | Document Upload | File `<input>` elements — capture structure but note these are SKIPPED by `fillElement`'s file guard |
| 9 | Review & Submit | The summary + the final submit button. Capturing this URL unblocks V1-6a's auto-trigger detection (#316) |

### Per-page capture record (one per page)
For each page the walk lands on, record:

1. **`pageCode`** — the 5-letter code. Source: it's usually in the page URL, a hidden field, or the SELECTORS.md naming convention (step 1 used `ABxxx`). If none visible, mint a consistent one (e.g., `ABPEO` for People) and note it.
2. **`title`** — human-readable purpose (mirror SELECTORS.md style).
3. **`urlPattern`** — copy `window.location.pathname`. Convert the volatile parts (UUIDs, app IDs) to a RegExp. Example: `/^\/application\/[0-9a-f-]+\/people$/`.
4. **`step`** — 2 through 9.
5. **`fields`** — for every fillable control: a logical field name → `FieldSelector`. Capture the control's accessible name / label, `type` (text/radio/checkbox/select/date), and any option list. BenefitsCal uses random-UUID `id`s, so resolve by **label**, never by id (matches `locate.ts` `resolveField` strategy).
6. **`advanceButton`** — the control that moves to the next page. Most are the shared `Next` button (already `NEXT_BUTTON` in selector-map); note any exceptions.
7. **`infoOnly: true`** — flag pages with no fillable fields (pure info / navigation).
8. **Raw DOM snapshot** — save the page's relevant form subtree as HTML to `~/civica-walk-raw-2026-06/{step}-{pageCode}.html`. **Run the scrub script on it immediately.** Move scrubbed output to `packages/benefitscal-cbo/snapshots/step-{N}/{pageCode}.html`.

### Repeat-section pattern (People / Income especially)
Steps 2 and 4 have "add another" repeats. Capture:
- The single-row template (one member / one income source).
- The "add" control's selector.
- How the page re-renders after adding (does the URL change? does a new row append?).
Note this in the `PortalPage` title so T7b/T8 can model the loop.

---

## Safety — prod walk only

If walking prod (P1 option 2), this is the discipline that keeps it clean:

- **ABORT before final submit.** On the Step 9 Review page, capture the submit button's selector + the page structure, then **close the tab**. Do NOT click submit — you'd file a real application for the consenting applicant. (For the actual demo later, T13a is a *separate* deliberate end-to-end run.)
- **One walk = one consenting applicant.** Don't reuse another person's in-progress application.
- **If you accidentally submit:** it's a real determination for the consenting applicant. Note it; the applicant can withdraw via the county. Not catastrophic with a consenting test applicant, but avoid it.
- **PII never hits Git unscrubbed.** Raw captures live in `~/civica-walk-raw-2026-06/` and are deleted after scrubbing. Only scrubbed snapshots enter the repo.

---

## After the walk — hand off to T7b (agent-assistable)

Once captures exist, the conversion is mechanical and can be handed to a Sonnet agent:

1. **T7b** — Convert each scrubbed capture into a `PortalPage` entry in `selector-map.ts` (steps 2-9). Target: 29 → ~60-110 entries. Co-locate the snapshot fixtures.
2. **T8 (V1-5 PR4)** — Per-section fill modules for steps 2-5, map-literal dispatch (eng D7), walker falls through to `fillPage` for unknown codes (eng D2). Per-section tests reuse the PR3 `makePacket` snapshot-freeze fixture.
3. **T9 (V1-5 PR5)** — Steps 6-9 fill + snapshot replay harness (issue #314 AC #4: replay walks the captured flow without throwing).
4. **T16** — CI canary on one BenefitsCal page (eng D13) — *this one is already unblocked* (T4/section-sequence merged); can run in parallel with the walk.

## Acceptance (T7a complete when)

- [ ] Scrub script built + tested (P0)
- [ ] Walk method chosen + recorded (P1); sandbox tried first
- [ ] Steps 2-9 captured: per-page record + scrubbed snapshot for every page
- [ ] Zero raw PII in any committed file (grep the snapshots for real-looking SSN/name/address patterns)
- [ ] `~/civica-walk-raw-2026-06/` deleted after scrubbing
- [ ] Repeat-section patterns (People/Income) documented
- [ ] Step 9 submit captured WITHOUT submitting (prod walk)
- [ ] Handed to T7b for `PortalPage` conversion

**Recorded walk date:** ______  **Captured page count:** ______  **Steps covered:** ______
