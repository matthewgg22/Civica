# State-Facing Audit Surface Design

**Status:** LOCKED 2026-05-18 via /plan-eng-review T5 design pass
**Pattern:** Three-tab dashboard page; analytics-engine reads Supabase Storage; no direct state Postgres access
**Owner:** Coordinator session (claude/clever-albattani-816917)
**Urgency:** §10106 admin-cost-share drops 50%→25% Oct 2026. Tab 2 is the most urgent deliverable.

## Summary

The state-facing audit surface is a set of three dashboard views that Civica shows to state and county contacts — CDSS, county DPSS, and prospective CBO licensees — to demonstrate QC defensibility and model cost exposure under OBBBA. It is NOT a portal for state employees to log in and pull caseworker data. It is a Civica-operated dashboard that Civica navigators share in walk-through meetings, and that state contacts can bookmark and view with a shared-link auth token.

Three tabs:

| Tab | Audience | Urgency | Data source |
|-----|---------|---------|------------|
| 1. §10105 State Cost Share | CDSS | High | analytics-engine: per/ + section-10105/ |
| 2. §10106 Admin Cost Share | County DPSS contacts | **P0 — Oct 2026 deadline** | analytics-engine: per/ + static §10106 calc |
| 3. CBO Preview | Prospective CBO licensees | Medium | enrollment-api: aggregate QC metrics (no PII) |

---

## Tab 1 — §10105 CDSS State Cost Share

**Audience:** CDSS policy staff, state budget analysts.
**Question answered:** "If our FY24 PER holds, how much will California owe under §10105 starting FY2028?"

### Data flow
```
analytics.paymentErrorRate.byState({ fy: 2024, state: 'CA' })
  → PER tier assignment (≤6%: tier 1 / 6–9%: tier 2 / >9%: tier 3)
analytics.section10105.tierLiability({ scenario: 'baseline', fy: 2028 })
  → state_liability_dollars, federal_share_dollars, cost_share_pct
```

### UI elements
- **Hero number**: CA FY24 PER (e.g. "7.2%") → Tier 2 badge
- **Cost table**: Three scenarios (PER holds / PER improves 1pt / PER worsens 1pt) × three tiers → liability dollars
- **FY29 cliff callout**: If CA is near a tier boundary, highlight the cliff (e.g. "At 5.9% CA saves $XXM/year vs. current trajectory")
- **Provenance footer**: Source citation for PER figure (USDA FNS, June 2025) — rendered from analytics-engine provenance sidecar
- **Last updated**: ISO timestamp from the parquet provenance.json

### What this is NOT
- Not live data pull from CDSS. All inputs are published federal data.
- Not a prediction. Scenarios are labeled explicitly as projections.

---

## Tab 2 — §10106 Admin Cost Share (MOST URGENT)

**Audience:** County DPSS administrators (LA County DPSS, SF HSA, Alameda SSA, etc.)
**Question answered:** "How much of our admin budget will we lose in October 2026, and what does QC-defensible casework do to that number?"

**Why this is P0:** §10106 cuts federal admin cost-share from 50% to 25% starting Oct 2026 for counties with high payment error rates. This is a near-term cash impact, not a FY2028 thing. County DPSS contacts need to see this NOW to allocate FY2027 budget planning.

### §10106 mechanics (locked from statutory text)
- Current: Federal covers 50% of state/county SNAP admin costs
- Post-§10106: Drops to 25% for counties/states with PER above a threshold (TBD from ACL — pending T13/legal)
- Effective: October 1, 2026 (FY2027 Q1)
- Impact: ~$1B/year nationally in admin cost-share at risk

### Data flow
```
analytics.paymentErrorRate.byState({ fy: 2024, state: 'CA' })   // county-level PER not yet in DB
analytics.section10106.adminCostExposure({ stateCode: 'CA', countyFips?: string })
  → { current_admin_share_pct: 0.50, post_obbba_share_pct: 0.25,
      exposure_dollars: number, effective_date: '2026-10-01' }
```

**Note on county-level data:** FY24 PER is published at the state level. County-level PER is in the QC microdata (blocked by OS lock currently; T13 may unblock). For MVP, Tab 2 shows state-level exposure only, with a note that county-level breakdowns are available on request.

### UI elements
- **Hero number**: Federal admin cost-share current vs. post-§10106 (50% → 25%)
- **Effective date countdown**: "X days until Oct 1, 2026"
- **Exposure calculator**: Input field for county's total admin budget → computes dollar exposure
- **QC defensibility impact**: "Counties that improve PER by 1pt before FY2026 QC measurement reduce exposure by ~$X"
- **Call to action**: "Schedule a Civica QC walkthrough" — links to calendar booking (Calendly or similar)
- **Disclaimer**: "Based on published statutory text of P.L. 119-21 §10106. Final implementation guidance pending USDA FNS rulemaking."

### `analytics.section10106` — new method on analytics-engine

```typescript
analytics.section10106.adminCostExposure({
  stateCode: 'CA',
  adminBudgetDollars?: number,   // optional; if provided, computes dollar exposure
}): Result<AdminCostExposure>
```

Returns:
```typescript
type AdminCostExposure = {
  state_code: string;
  fy24_per: number;
  current_admin_share_pct: number;      // 0.50
  post_obbba_share_pct: number;         // 0.25
  exposure_share_pct: number;           // 0.25 (the lost share)
  exposure_dollars?: number;            // if adminBudgetDollars was provided
  effective_date: string;               // '2026-10-01'
  scenario: 'current_per_holds' | 'per_improves_1pt' | 'per_worsens_1pt';
  provenance: Provenance[];
};
```

---

## Tab 3 — CBO Preview

**Audience:** Prospective CBO licensees (community colleges, legal aid orgs, food banks).
**Question answered:** "What does Civica actually produce, and what does QC defensibility look like in practice?"

### Data flow (no PII)
```
enrollment-api: GET /internal/qc-aggregate-metrics?orgId=civica
  → { packets_evaluated: number, strong_pct: number, moderate_pct: number, weak_pct: number,
      avg_citations_per_packet: number, flows_covered: FlowKind[], states: string[] }
```

The aggregate metrics endpoint returns counts and percentages only — no individual packet data. RLS: only Civica org's own aggregates are exposed here (no cross-org leakage).

### UI elements
- **Aggregate stats panel**: Packets evaluated, defensibility distribution (strong/moderate/weak donut chart), flows covered
- **Sample evidence packet** (redacted): A static PDF mockup of what a QC-defensible evidence package looks like — cached, not live-generated
- **Citation chain example**: Rendered inline using `@civica/snap-compliance-copy` Q1–Q5
- **How it works** explainer: Three steps — applicant answers → AI QC → evidence packet
- **Pilot interest form**: Name, org, email, state, "What's your current QC process?" → posts to CRM (HubSpot or Airtable for MVP)

---

## Auth model — shared-link tokens

State contacts and CBO previews use shared-link tokens, NOT full Supabase Auth accounts. Pattern:

```sql
CREATE TABLE snap_enrollment.audit_access_tokens (
  token_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash  TEXT NOT NULL UNIQUE,    -- bcrypt hash of the token shown to user
  org_id      UUID NOT NULL,           -- which org granted this token
  granted_to  TEXT,                    -- email or name of recipient (display only)
  scope       TEXT[] NOT NULL,         -- ['tab_10105', 'tab_10106', 'tab_cbo_preview']
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
```

Middleware (`apps/dashboard/middleware.ts`) checks for `?token=` param or `Authorization: Bearer` header on `/audit/*` routes. Token grants read access to scoped tabs only.

This is separate from navigator auth (JWT-based Supabase session). No navigator account required to view the audit surface.

---

## Route structure (`apps/dashboard`)

```
/audit/                  → redirects to /audit/10105 (default tab)
/audit/10105             → Tab 1: §10105 state cost share
/audit/10106             → Tab 2: §10106 admin cost share (CTA page)
/audit/cbo-preview       → Tab 3: CBO preview
```

Each `/audit/*` route is a Next.js server component that calls analytics-engine server-side. No client-side DuckDB for MVP.

Feature flag: `AUDIT_SURFACE_ENABLED=true` (off by default, on for prod after T5 ships).

---

## New analytics-engine method: `analytics.section10106`

Add to `packages/analytics-engine/src/index.ts`:

```typescript
analytics.section10106 = {
  adminCostExposure(params: { stateCode: string; adminBudgetDollars?: number }): Promise<Result<AdminCostExposure>>;
};
```

For MVP, this is computed entirely from the PER parquet (already in the bucket) + static §10106 formula (50%→25% for states above threshold). No new data files needed for the initial version. If USDA publishes county-level admin cost data, add a `by_county.parquet` later.

---

## Migration plan (PR-level)

1. **`audit_access_tokens` table + middleware** — auth layer for shared links. No UI yet.
2. **`analytics.section10106.adminCostExposure`** — method in analytics-engine, unit-tested against static PER fixture.
3. **Tab 2 first** (`/audit/10106`) — hero number + countdown + exposure calc + CTA. Fastest to build, highest urgency. Needs only PER data (already in bucket).
4. **Tab 1** (`/audit/10105`) — reuses existing `analytics.section10105` methods. Add tier assignment + scenario table.
5. **Tab 3** (`/audit/cbo-preview`) — aggregate metrics endpoint in enrollment-api + static sample packet PDF.
6. **Shared link generation UI** — navigator can generate a scoped token from `/navigator/settings/audit-links`. Send link to CDSS/DPSS contact.
7. **Tab 2 hardening** — add the exposure calculator input field + "schedule walkthrough" CTA.

---

## What this design does NOT include (deferred)

- **State employee login portal.** State contacts use shared-link tokens for MVP. Full SSO deferred.
- **Real-time county-level PER.** QC microdata parse (T10) unblocks this; add county breakdown once microdata is in Supabase Storage.
- **White-label per-county branding.** MVP is Civica-branded. CBO licensees get the same UI.
- **Editable scenario inputs for Tab 1/2.** Static scenarios only for MVP. Interactive calculator deferred.
- **Export to PDF/Excel.** Deferred. MVP is screen-share / web URL.

---

## Sign-off

Locked in `/plan-eng-review` coordinator session 2026-05-18. T5 design deliverable complete. Spawned T5 build session consumes this document as authoritative spec.
