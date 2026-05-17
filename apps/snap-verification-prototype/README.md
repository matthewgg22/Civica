# SNAP Verification Prototype

Four self-contained SNAP eligibility verification flows, each producing a
**verification package** (structured JSON + human-readable PDF) designed
to meet SNAP QC evidentiary standards (7 CFR 273).

> Prototype. No authentication, no case management, no state-agency
> integration.

## Stack

- Next.js 14 (App Router) + TypeScript
- `@react-pdf/renderer` for server-side PDF generation
- `better-sqlite3` for package persistence (`.data/snap.db`)
- Sandbox clients for Plaid, UtilityAPI, Argyle, USPS (under `lib/`).
  When credentials are absent the clients return fixture data shaped like
  the real APIs so the prototype is fully runnable without credentials.

## Run

```bash
cd snap-verification-prototype
npm install
cp .env.local.example .env.local   # optional — fill in sandbox credentials
npm run dev
# open http://localhost:3000
```

Type check: `npm run typecheck`   |   Tests: `npm test`   |   Build: `npm run build`

## Optional credentials

All integrations fall back to deterministic fixture data when credentials are absent.

| Service | `.env.local` keys | Fallback |
|---------|-------------------|---------|
| Plaid | `PLAID_CLIENT_ID`, `PLAID_SECRET` | Fixture link token + sandbox transactions |
| Argyle | `ARGYLE_API_KEY`, `ARGYLE_API_SECRET` | Fixture user token + sandbox earnings |
| USPS | `USPS_USER_ID` | Fixture address validation |

## Data storage

- **Packages** — SQLite WAL at `.data/snap.db` (auto-created).
- **Uploaded documents** — `.data/uploads/<uuid>.<ext>` (served at `GET /api/uploads/:id`).
- Neither directory is committed to git.

## Flows

### Flow 1 — Utility / SUA tier (`/verify/utility`)

1. Intake: which utilities the applicant pays directly, state (CA / MA).
2. UtilityAPI lookup keyed on applicant name + service address.
3. State-aware SUA tier: `full` (heat/electric; CA includes A/C), `limited`,
   `telephone`, `none`.
4. Package emits `basis` of `api_confirmed | self_declared | conflicting` and
   sets `attestation_required` accordingly.

### Flow 2 — Shared lease (`/verify/shared-lease`)

1. Intake: leaseholder, monthly share, payment method, address.
2. Document upload (sublease or landlord letter); binary saved to `.data/uploads/`.
   Pre-filled letter template downloadable from `/api/landlord-letter`.
3. Plaid bank scan for recurring transfers matching ±15% of stated amount on a
   monthly cadence. Confidence: `high / medium / low / none`.
4. USPS address validation.
5. QC defensibility score: `strong / moderate / weak`.

### Flow 3 — Gig / multi-source income (`/verify/gig-income`)

1. Intake: W-2 employer (optional), platform checkboxes, cash income flag.
2. Argyle Link widget pulls 90-day W-2 and platform-gig earnings (verified).
3. Plaid Link cross-checks 3-month rolling deposit averages (corroborated).
4. Cash: 12-week structured log + signed attestation (self_declared).
5. Reconciliation flag fires when Plaid-vs-Argyle gap > 25%.

### Flow 4 — Asset / resource test (`/verify/assets`)

1. Intake: vehicles, cash, retirement accounts, state, elderly/disabled flag.
2. Plaid balance pull for bank accounts.
3. CA: no asset test (SB 1090). MA: $2,750 standard / $4,250 elderly+disabled.
4. Vehicle equity formula: `max(0, stated_value − 4650)` for second vehicle.
5. Package cites relevant state regulations.

### Caseworker — Review (`/review`)

Lists all saved packages, renders a flow-specific summary (SUA tier badge,
QC defensibility pill, reconciliation flag, asset test result), inline PDF
preview, and download link.

### Caseworker — Benefit estimate (`/verify/deductions`)

Full 7 CFR 273.10 deduction worksheet:

- Gross income test (130% FPL) — waived for CA households under BBCE (200% FPL).
- Net income test (100% FPL).
- 20% earned income deduction, standard deduction, dependent care deduction.
- Excess shelter deduction (capped at $672 for non-elderly/non-disabled).
- Estimated monthly allotment = `max_allotment − 30% × net_income`.

## Layout

```
app/
  verify/utility/          Flow 1
  verify/shared-lease/     Flow 2
  verify/gig-income/       Flow 3
  verify/assets/           Flow 4
  verify/deductions/       Caseworker benefit calculator
  review/                  Caseworker package review
  api/                     Route handlers (thin — delegate to lib/)

lib/
  argyle/                  Argyle sandbox adapter
  asset-rules/             State asset-test rule tables + citations
  package-builder/         Pure builder functions + PDF renderer
  plaid/                   Plaid sandbox adapter
  snap-calculator/         SNAP net income + benefit estimation
  store/                   SQLite persistence
  sua-rules/               State SUA tier rule tables + citations
  usps/                    USPS address validation adapter
  utilityapi/              UtilityAPI sandbox adapter

types/
  verification.ts          All package and shared types
```

## Tests

```bash
npm test            # Vitest watch
npm run test:run    # single pass
```

Coverage: `lib/asset-rules`, `lib/package-builder`, `lib/snap-calculator`, `lib/store`.

## Regulatory citations embedded in packages

| Citation | Applies to |
|----------|-----------|
| 7 CFR 273.8 | Asset / resource test |
| 7 CFR 273.10 | Income counting and deductions |
| 7 CFR 273.2(f)(1)(vi) | Shelter deduction |
| 7 CFR 273.10(e)(1) | 20% earned income deduction |
| CA SB 1090 (2019) | California no-asset-test |
| CA CDSS ACL 11-27 | Broad-based categorical eligibility |
| CA CDSS MPP 63-503 | CA shelter + income counting |
| 106 CMR 365.180 | Massachusetts asset limit |
| 106 CMR 363.230 | Massachusetts SUA |
