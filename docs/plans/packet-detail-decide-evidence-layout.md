# Packet Detail — Decide/Evidence Two-Zone Layout

**Status:** plan, awaiting approval
**Owner:** Matthew
**Branch target:** off `codex/rebuild-feb18`
**Scope:** `apps/dashboard/app/packets/[packetId]/page.tsx` (overview tab only)

## Problem

The packet detail overview tab stacks 14–18 cards of identical visual weight. Every `<Section>` uses the same surface (`bg-surface border-hairline rounded-[4px] p-6`), so the page is a flat list of equally-shouting boxes. The reviewer can't tell, by scanning, what needs action vs. what's reference material.

`ReviewStatusCard` ([page.tsx:825](apps/dashboard/app/packets/[packetId]/page.tsx:825)) is intended as the at-a-glance answer, but the 13+ same-weight cards immediately below undermine it. The page mixes two distinct reviewer intents under the same hierarchy:

- **Decide** — sign-off gates and actions the reviewer must take (ReviewStatusCard, Work-Hours, Consent, Shared Lease allocation, Expedited Gate, Advance Status, BenefitsCal, Handoff).
- **Evidence** — source material + computed advisory the reviewer consults on demand (Application Answers, Extracted Fields, API Cross-Verification, Missed Elections, Documents, Notes, Activity timeline, Packet metadata).

Missed Elections is advisory output, not a sign-off gate: the engine derives it from existing answers, nothing blocks on it, and there's no navigator confirmation step. It belongs with the other computed-from-data panels in Evidence.

Today both groups are flat-equal. That is the jumble.

## Solution

Two zones inside the overview tab:

1. **Decide** — same-weight cards, all open, in current visual style. ~6–8 cards.
2. **Evidence** — collapsible disclosure rows with a status-chip summary. Auto-expanded when the section has flagged/unresolved items; collapsed otherwise.

```
+---------------------------------------------------+
| Hero (status + applicant + LifecycleStrip)        |
| [Overview] [Error Risk]                           |
+---------------------------------------------------+
| DECIDE                                            |
|   ▾ Review Status (always open)                   |
|   ▾ Work-Hours Rule                               |
|   ▾ Privacy Consent                               |
|   ▾ Shared Lease (conditional)                    |
|   ▾ Expedited Review Gate (conditional)           |
|   ▾ Advance Status (conditional)                  |
|   ▾ BenefitsCal Submission                        |
|   ▾ Handoff & Export                              |
|                                                   |
| EVIDENCE                                          |
|   ▶ Documents          12 · 2 unresolved      ⚠   |
|   ▶ Application Answers 47                        |
|   ▶ Extracted Fields    18 · 3 need review    ⚠   |
|   ▶ API Cross-Verification · no flags             |
|   ▶ Missed Elections    2 · $214/mo potential ⚠   |
|   ▶ Notes               4                         |
|   ▶ Activity Timeline                             |
|   ▶ Packet metadata                               |
+---------------------------------------------------+
```

### Why native `<details>` and not a custom Accordion

- Already used in dashboard: `BenefitsCalPanel.tsx:518`, `compliance/RulesFrameworkPanel.tsx:564`. Established pattern.
- Free keyboard a11y (Enter/Space toggles, focus visible), free screen-reader semantics, free `prefers-reduced-motion` respect.
- No client-state required — page can stay a server component.
- DESIGN.md §6.2 focus-ring rule applies via `details > summary:focus-visible:ring-2 ring-pine/30`.

### Auto-expand rule (load-bearing)

A section opens by default iff it has actionable signal:

| Section | Open if … |
|---|---|
| Documents | `unresolved_docs.length > 0` |
| Application Answers | never (reference) |
| Extracted Fields | `fields.some(f => f.needs_review && !f.reviewed_at)` |
| API Cross-Verification | `verificationFlagCount > 0` |
| Missed Elections | `missedElections.length > 0` |
| Notes | never (reference) |
| Activity Timeline | never (reference) |
| Packet metadata | never (reference) |

The flag count / unresolved count is in the summary row itself (text, not color-only — DESIGN.md §6.4). So a closed section still announces "needs review" through copy; collapsing never hides a problem from a scanner.

No localStorage persistence v1. State derives from the data; the reviewer doesn't manually arrange UI between visits.

## New component

`apps/dashboard/components/packet-detail/EvidenceSection.tsx`

```tsx
type Props = {
  id?: string;
  title: string;
  count?: number;          // primary count, e.g. 12 documents
  summary?: string;        // sub-summary, e.g. "2 unresolved"
  flagged?: boolean;       // drives ⚠ icon + auto-open
  defaultOpen?: boolean;   // explicit override (else derived from `flagged`)
  children: React.ReactNode;
};
```

Render shape:

```html
<details className="bg-surface border border-hairline rounded-[4px]"
         open={defaultOpen ?? flagged}>
  <summary className="cursor-pointer list-none flex items-center
                       justify-between gap-4 px-6 py-4
                       focus-visible:ring-2 focus-visible:ring-pine/30">
    <div className="flex items-center gap-3">
      <span aria-hidden="true">▶</span>   {/* CSS rotates on [open] */}
      <h3 className="section-title">{title}</h3>
    </div>
    <div className="flex items-center gap-3 text-[13px] text-muted">
      {count != null && <span className="tabular-nums">{count}</span>}
      {summary && <span>· {summary}</span>}
      {flagged && (
        <span role="img" aria-label="needs attention"
              className="text-warning">⚠</span>
      )}
    </div>
  </summary>
  <div className="px-6 pb-6 border-t border-hairline pt-5">
    {children}
  </div>
</details>
```

No CSS animation on the disclosure itself (matches DESIGN.md §6.5 reduced-motion stance — native `<details>` is instant by default, which is correct).

## DESIGN.md addendum (§4)

Add new entry under "Component patterns":

> **EvidenceSection** (`components/packet-detail/EvidenceSection.tsx`) — collapsible card for reference content on packet detail. Uses native `<details>` for free a11y. Summary row shows count + sub-summary text + optional `⚠` for flagged state. Auto-opens when the underlying data has unresolved items; closed otherwise. State is derived from data, never persisted client-side. Used only for "evidence" content (sources the reviewer consults on demand), never for sign-off gates (those stay as same-weight `<Section>` cards).

## File changes

1. **New:** `apps/dashboard/components/packet-detail/EvidenceSection.tsx` (~50 lines).
2. **Edit:** `apps/dashboard/app/packets/[packetId]/page.tsx`
   - Split the overview-tab JSX into two sibling blocks (`<section aria-label="Decide">` and `<section aria-label="Evidence">`).
   - Move `<Section title="Missed Elections">` out of the Decide group and wrap it as `<EvidenceSection>` in the Evidence zone (auto-open when `missedElections.length > 0`).
   - Wrap each Evidence-zone section in `<EvidenceSection>` with the auto-expand rule.
   - Add `space-y-3` between Evidence rows (tighter than the `space-y-5` between Decide cards), so the two zones read as distinct rhythm.
3. **Edit:** `apps/dashboard/DESIGN.md` §4 — add EvidenceSection entry; §9 decisions log — add an entry for 2026-05-28.
4. **Tests:** add a Vitest case in `apps/dashboard/tests/` verifying auto-expand: flagged section renders with `open` attribute, unflagged does not. (Pattern: `feedback_vitest_dashboard_mock.md` — use `vi.hoisted()` for any required mocks.)

No backend changes. No schema changes. No new fetcher.

## Out of scope (deferred)

- Sticky decision rail on lg+ (Option C from the design discussion). Revisit after layout lands and we have reviewer feedback.
- localStorage persistence of expand state. Deferred until a real reviewer asks for it.
- Mobile-specific tweaks. Two-zone reads correctly on mobile already (single column, accordion is naturally finger-friendly via native `<details>`).
- Animating the disclosure. DESIGN.md §6.5 + the reduced-motion default argue against it.
- Restructuring the **Decide** zone itself. Same cards, same order, just grouped under a zone label.

## What already exists worth reusing

- Native `<details>` pattern: `BenefitsCalPanel.tsx:518`, `compliance/RulesFrameworkPanel.tsx:564`.
- `Section` component (page.tsx:1092) — stays unchanged; used only in the Decide zone.
- Tokens: `bg-surface`, `border-hairline`, `text-warning`, `text-muted`, `.section-title`, `.tabular-nums` — all already in use.

## Tasks

- [ ] **T1 (P1, human: ~45min / CC: ~10min)** — `components/packet-detail/EvidenceSection.tsx` — Build `<EvidenceSection>` with native `<details>`, summary row, focus-ring, `⚠` flagged glyph with `role="img"`.
  - Verify: renders open when `flagged`, closed otherwise; keyboard toggles via Enter/Space.
- [ ] **T2 (P1, human: ~30min / CC: ~10min)** — `app/packets/[packetId]/page.tsx` — Split overview JSX into Decide + Evidence zones. Wrap Documents, Application Answers, Extracted Fields, API Cross-Verification, Notes, Activity timeline, Packet metadata in `<EvidenceSection>` with computed `flagged`.
  - Verify: page renders end-to-end with sample-data packet; flagged sections open, unflagged closed.
- [ ] **T3 (P2, human: ~15min / CC: ~5min)** — `apps/dashboard/DESIGN.md` — Add §4 EvidenceSection entry + §9 decisions-log row dated 2026-05-28.
- [ ] **T4 (P2, human: ~20min / CC: ~10min)** — `apps/dashboard/tests/` — Vitest case asserting `open` attribute behavior across flagged/unflagged + a snapshot that the Decide zone still renders all sign-off gates.
- [ ] **T5 (P3, follow-up TODO)** — Reviewer feedback gate: after 1 week of UAT, decide whether to add sticky decision rail (Option C) or localStorage expand persistence.

## Resolved (2026-05-28)

1. Packet metadata → collapsed row in Evidence zone (confirmed).
2. Missed Elections → moved to Evidence zone (advisory, not a gate).
3. `EvidenceSection` naming → accepted.
