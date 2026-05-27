# RegOps Engine — Source Adapter Reference

> **Scope:** Per-source documentation for each `SourceAdapter` in
> `packages/regops-engine/src/sources/`. Read this before modifying any
> adapter, adding a new source, or responding to a `source_wedged` alert.
>
> **Related:** [runbook.md](./runbook.md) (on-call response),
> [war-room-playbook.md](./war-room-playbook.md) (major-bill events),
> [docs/snap/fy-rules-refresh-checklist.md](../snap/fy-rules-refresh-checklist.md)
> (annual COLA cadence).

---

## Adapter contract

Every source adapter implements:

```typescript
type FetchResult<T> =
  | { kind: 'Success', data: T[], fetchedAt: Date, urlHash: string }
  | { kind: 'NoChange', fetchedAt: Date, urlHash: string }
  | { kind: 'TransientFailure', error: string, retryAfterMs?: number }
  | { kind: 'StructuralFailure', error: string, rawDocSampleRef: string }
  | { kind: 'SourceWedged', lastSuccessAt: Date, error: string };

interface SourceAdapter<TRaw> {
  readonly id: string;                           // e.g. 'usda-fns-cola'
  readonly domainTag: 'eligibility' | 'copy' | 'ftc';
  readonly pollIntervalMs: number;               // base class enforces >=3600000 (1h)
  readonly contactAdmin?: { email: string, name: string };
  fetch(): Promise<FetchResult<TRaw>>;
  diff(prev: TRaw[], curr: TRaw[]): StructuredDiff;
}
```

All adapters inherit from `SourceAdapterBase`, which provides:

- Hourly rate cap (override requires explicit `acknowledgedReason` field)
- Exponential backoff on `TransientFailure` (1m, 5m, 15m, 1h, 4h max)
- Identifying User-Agent: `Civica-RegOps/1.0 (regops@civica.app)`
- `robots.txt` respect (cached 24h)
- Audit-log write on every `fetch()` call (success or failure)
- `SourceWedged` escalation after 24h continuous failure

---

## Roster

| Adapter ID | Domain | URL | Cadence | Contact admin |
|---|---|---|---|---|
| `usda-fns-cola` | eligibility | https://www.fns.usda.gov/snap/allotment/cola | Daily Jul-Sep, weekly otherwise | snap-hq@usda.gov (general) |
| `usda-fns-memos` | eligibility | https://www.fns.usda.gov/snap/policy-memos | Weekly | snap-hq@usda.gov |
| `federal-register-snap` | eligibility | https://www.federalregister.gov/api/v1/documents.json?conditions[agencies][]=food-and-nutrition-service | Hourly | (API; no contact needed) |
| `ca-cdss-acl` | eligibility | https://www.cdss.ca.gov/inforesources/CDSS-Programs/Welfare-to-Work/CalFresh/All-County-Letters | Daily | CalFreshPolicy@dss.ca.gov |
| `ma-dta-charts` | eligibility | https://www.mass.gov/lists/department-of-transitional-assistance-program-eligibility-charts-and-tables | Weekly | DTAPolicy@mass.gov |
| `ftc-actions` | ftc | https://www.ftc.gov/news-events/news/press-releases?field_press_release_type_target_id=All&field_topics_target_id=All | Daily | (no direct counterpart; route to marketing counsel) |

---

## Per-source detail

### usda-fns-cola (Federal eligibility — Annual COLA cycle)

**URL:** https://www.fns.usda.gov/snap/allotment/cola
**Schema:** HTML page linking to PDFs per fiscal year. Each FY's PDF is the
canonical COLA memo (Table 1 = max allotments, Page 3 = gross income limits,
Page 6 = standard deductions, Table 3 = excess shelter cap).

**Why it matters:** Federal eligibility math depends on the FY+1 COLA memo
landing in August each year for Oct-1 effective date. This is the single
most important source to never miss.

**Parser notes:**
- Two PDFs/year typically: "48 contiguous states + DC" and "AK/HI/Guam/USVI"
- The "Maximum SNAP Allotments" table is consistently formatted YoY
- Watch for footnote drift — USDA occasionally adds/removes notes that
  affect interpretation (rare, but happened in FY24)
- Implementation: `packages/regops-engine/src/sources/usda-fns-cola.ts`.
  **v1 is detection-only:** the adapter fetches the index HTML, extracts
  COLA-relevant PDF links via regex on `<a href="*.pdf">…</a>` tags
  filtered by keyword (`cola`, `allotment`, `income`, `deduction`,
  `shelter`, `snap`), and surfaces them as `UsdaColaResourceLink` rows
  with inferred fiscal year + region + kind. PDF body parsing (Table 1,
  Page 3, etc.) is the drafter's (E1) job, per the design doc's
  "PDF format changed: extract via Claude API" guidance.
- StructuralFailure threshold: < 2 plausible COLA PDF links on the
  index. Anything fewer = USDA changed the layout and the parser
  needs an update before next FY refresh.
- 30s fetch timeout via `AbortSignal.timeout` so a slow USDA CDN
  doesn't burn the cron's 10-minute workflow budget.
- Known v1 gap: silent in-place PDF replacement (same URL, new content)
  is NOT caught — we'd need to HEAD/GET each PDF on every poll to
  notice. Deferred until we observe a real false-negative justifying
  the bandwidth cost.

**Map to rule code:**
- Table 1 → `FederalDefaultRules.maxAllotmentSnapshots`
- Page 3 → `FederalDefaultRules.grossIncomeSnapshots` (130% FPL)
- Page 3 → `FederalDefaultRules.netIncomeSnapshots` (100% FPL)
- Page 6 → `FederalDefaultRules.standardDeductionSnapshots`
- Table 3 → `FederalDefaultRules.shelterCapSnapshots`

**Critical:** Do NOT derive income limits from a monthly FPL formula. The
memo's published values differ from formulaic derivation by ±$1 due to
USDA rounding rules. Always use the memo's literal numbers.

**Manual override:** During FY refresh week (typically third week of August),
poll cadence increases to hourly. Override `pollIntervalMs` via the
`fy_refresh_active` feature flag.

**Failure modes:**
- 5xx during peak August traffic: backoff and retry; not unusual
- HTML structure changed: parser breaks → `StructuralFailure`; rebuild
  parser before next FY refresh
- PDF format changed: extract via Claude API; flag for manual review

**Historical incidents:**
- 2024-08-15: COLA memo URL pattern changed from `/fy{NN}` to `/fy-{YYYY}`.
  Parser regression caught at next poll. Fixed within 2h.

### usda-fns-memos (Federal eligibility — Policy memos)

**URL:** https://www.fns.usda.gov/snap/policy-memos
**Schema:** Date-ordered list of policy memos. Each memo is a PDF or HTML
attachment with a memo number and effective date.

**Why it matters:** USDA issues guidance throughout the year that
clarifies or modifies rule implementation. Most are operational (state
agency-facing) but some affect eligibility math or required disclosures.

**Parser notes:**
- Triage by memo type. Operational memos (e.g., "state SNAP-Ed allocations")
  are low-priority. Policy memos affecting eligibility are high-priority.
- Use LLM extraction to classify; verify classification in eval set.

**Map to rule code:** varies; drafter must determine impact per memo.

### federal-register-snap (Federal eligibility — Proposed/final rules)

**URL:** https://www.federalregister.gov/api/v1/documents.json?conditions[agencies][]=food-and-nutrition-service
**Schema:** JSON API; well-documented. Pagination via `next_page_url`.

**Why it matters:** Proposed rules and final rules from FNS land here.
Comment-period start, proposed-rule publication, final-rule publication,
and effective date are all distinct events to track.

**Parser notes:**
- API is stable; rate limits are documented (1000/hr)
- `type` field distinguishes proposed vs. final vs. notice
- `effective_on` field is authoritative for when the rule takes effect
- Implementation: `packages/regops-engine/src/sources/federal-register.ts`.
  Tests cover Success / NoChange / TransientFailure (429 + 5xx + network
  throw) / StructuralFailure (4xx / malformed JSON / unknown `type` /
  missing field). Pagination via `next_page_url` is not yet consumed —
  the v1 adapter reads the first page only (newest-first, 100/page),
  which covers ~3 months of FNS activity at observed cadence. Multi-page
  walk lands in a follow-up before historical backfill.
- Agency field accepts both `["food-and-nutrition-service"]` and
  `[{slug: "food-and-nutrition-service", name: "FNS"}]` shapes — the API
  switches between them depending on endpoint.

**Map to rule code:** varies; usually affects `FederalDefaultRules.swift`
or triggers a war-room event if the rule is large enough.

### ca-cdss-acl (California CDSS All-County Letters)

**URL:** https://www.cdss.ca.gov/inforesources/CDSS-Programs/Welfare-to-Work/CalFresh/All-County-Letters
**Schema:** HTML page with date-ordered list of ACL PDFs. Each ACL has a
number (e.g., "ACL 25-42") and may supersede prior ACLs.

**Why it matters:** California operationalizes federal SNAP via ACLs. CA
case implementation lives in `packages/snap-rules/src/data/ca.json`. Every
ACL is a potential rule change.

**Parser notes:**
- Supersession is explicit ("This ACL supersedes ACL 24-18") — the
  policy timeline (D3) MUST capture supersedes/supersededBy edges
- Effective date is in the ACL body, not the filename
- Translation note: CDSS publishes ACLs in English only; the Spanish
  parity work happens separately in `snap-compliance-copy`

**Map to rule code:** `packages/snap-rules/src/data/ca.json`, plus CA-specific
strings in `snap-compliance-copy/strings/CAComplianceStrings.swift`.

**Historical incidents:**
- 2025-Q3: ACL 25-12 superseded ACL 23-08 which had been superseded by
  24-18. The chain was three deep. The policy timeline must walk the chain
  to determine what's currently in effect.

### ma-dta-charts (Massachusetts DTA Helpful Charts)

**URL:** https://www.mass.gov/lists/department-of-transitional-assistance-program-eligibility-charts-and-tables
**Schema:** HTML page linking to charts (PDF + sometimes Excel). MA updates
charts when federal COLA changes propagate.

**Why it matters:** MA is the second state target (Project Bread caseworker
mode plan). `packages/snap-rules/src/data/ma.json` lives here.

**Parser notes:**
- MA tends to lag USDA by 2-6 weeks after federal COLA — don't alarm if
  MA hasn't updated by Oct 1
- Charts are visually consistent YoY; Excel format is sometimes provided
  and is much easier to parse than PDF

**Map to rule code:** `packages/snap-rules/src/data/ma.json`.

### ftc-actions (FTC press releases / enforcement actions)

**URL:** https://www.ftc.gov/news-events/news/press-releases
**Schema:** HTML index with date-ordered press releases. Filter for
deceptive-practices, benefits-navigation, or social-services-related
actions.

**Why it matters:** FTC actions can affect how Civica is allowed to
describe SNAP enrollment services in app store copy + marketing site.
OBBBA audit Q16/Q17 are still open on exactly this.

**Parser notes:**
- v1 scope: detection + counsel routing only, no LLM drafting against
  marketing copy (per CEO review Open Question §FTC, deferred to TODO-29)
- LLM classification: is this action relevant to benefits-navigation
  marketing? Most FTC press releases are not.

**Map to rule code:** none in v1. Counsel-routed only.

---

## Adding a new source

Steps:

1. Decide domain tag (`eligibility`, `copy`, `ftc`).
2. Create `packages/regops-engine/src/sources/{id}.ts` extending
   `SourceAdapterBase`.
3. Implement `fetch()` returning a `FetchResult` discriminated union.
4. Implement `diff()` against prior snapshot.
5. Add fixture corpus to `packages/regops-engine/test/fixtures/{id}/`
   covering Success, NoChange, TransientFailure, StructuralFailure scenarios.
6. Add an eval-set entry exercising the source's typical doc shape.
7. Register the adapter in `packages/regops-engine/src/sources/registry.ts`.
8. Update this document with a new "Per-source detail" section.
9. Update `.github/workflows/regops-poll.yml` to dispatch the new adapter.

---

## Counsel roster (keep current — used by E4 RLS policy)

| Domain | Primary reviewer | Alternate | Email | Onboarded |
|---|---|---|---|---|
| Federal (USDA SNAP policy) | TBD | TBD | TBD | _pending T11_ |
| California (CDSS ACL) | TBD | TBD | TBD | _pending T11_ |
| Massachusetts (DTA) | TBD | TBD | TBD | _pending T11_ |
| FTC marketing | TBD | TBD | TBD | _pending T11_ |

**Action:** Update each row as counsel candidates are identified and
onboarded. The engine cannot move faster than counsel will (see CEO
review Open Question §Counsel).
