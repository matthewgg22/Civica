# Dashboard sample data mode

The CDSS (`/cdss`), county (`/county`), and CBO preview (`/cbo-preview`)
surfaces consume `@civica/analytics-engine`, which reads Parquet from
Supabase Storage. Until Matthew uploads the real USDA / OBBBA inputs, the
dashboard can run against a **fabricated** sample dataset that has the
same shape so charts render plausible numbers instead of stubs.

## When to use sample data

- Pre-launch pilot demos
- Staging environments without the real-data upload completed
- Local dev where you don't want to pull production parquet
- Internal "what would the surface look like with data" reviews

Do **not** enable sample data in production. Real values from real
sources only.

## How to enable

1. Build + upload the sample dataset (operator action, see
   [`data-ops/README.md`](../../data-ops/README.md#sample-dataset)):

   ```sh
   pnpm data:build:sample
   SUPABASE_URL=<staging url> \
     SUPABASE_SERVICE_ROLE_KEY=<key> \
     pnpm data:sync -- --prefix sample
   ```

2. In Vercel (or your dashboard host), set:

   ```
   ANALYTICS_USE_SAMPLE_DATA=true
   ```

3. Redeploy. The next request will:
   - Render the "Demo data — not real USDA / OBBBA values" banner across
     every page (top of the layout).
   - Have the analytics-engine read parquet from `sample/...` paths in
     the bucket instead of the canonical layout.

## How to verify it's active

- Visit `/cdss`, `/county`, or `/cbo-preview` and confirm the amber
  "Demo data" banner is visible above the page header.
- Provenance citations rendered on the dashboard footer (when present)
  will show `source_kind: sample-fixtures` and the note "Generated for
  demo purposes only. NOT real USDA / OBBBA data."

## How to disable

Unset `ANALYTICS_USE_SAMPLE_DATA` in the Vercel environment and
redeploy. The engine immediately reverts to the canonical bucket paths
(no `sample/` prefix). The banner disappears.

## What the sample dataset contains

| Dataset             | Rows  | CA pinned                              |
| ------------------- | ----- | -------------------------------------- |
| PER FY2024 by state | 53    | 10.98% (matches §10105 design doc)     |
| PER FY2023 by state | 53    | 9.85%                                  |
| OBBBA scenarios     | 20    | 4 scenarios × 5 metrics                |
| CFR-273 rule index  | 223   | Reused from real index (public domain) |

The 4 OBBBA scenarios are:

- `current_law` — no OBBBA. Zero CA state liability.
- `obbba_full` — statutory baseline OBBBA implementation.
- `obbba_with_bbce_removal` — adds BBCE removal.
- `obbba_with_bbce_removal_and_lpie` — above + LPIE softener.

All values are fabricated for demo purposes. See
`scripts/generate-sample-analytics-data.ts` for the generator (RNG is
seeded off each state's USPS code so output is deterministic).
