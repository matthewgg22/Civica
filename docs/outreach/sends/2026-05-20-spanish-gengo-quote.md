# Spanish reviewer outreach — Paid translation service — Gengo

**Date drafted:** 2026-05-20 — refreshed 2026-05-24 (portal flow unchanged)
**Sender:** Matthew Greer-Gentis <matthewgreergentis@gmail.com>
**Recipient:** Gengo order portal — https://gengo.com/order/
**Subject:** N/A — submit via portal (no email)
**Status:** DRAFT (verified send-ready 2026-05-24) — open https://gengo.com/order/ + paste the project description below

## To copy-paste

This is **not an email** — Gengo's intake is a self-serve portal. Matthew should:

1. Go to **https://gengo.com/order/**
2. Create an account (free) if he doesn't have one
3. Choose service: **Translation** → **Source language: English (US)** → **Target language: Spanish (Latin American)**
4. Quality tier: **Advanced** ($0.12/word published rate — needed for benefits/UI context, not Standard)
5. Upload file (see "How to deliver review materials" below) OR paste the 106 strings as plain text
6. In the **comments / instructions field**, paste:

> ```
> Project: UI string review for Civica, a CalFresh (SNAP) enrollment app for
> California Community College + CSU students. Bilingual EN+ES app preparing
> for pilot launch.
>
> Scope: 106 short UI strings already translated to Spanish. I need a native
> Spanish translator to REVIEW the existing Spanish (not translate from
> scratch) and flag any strings that should be edited. Output: for each row,
> either "OK" or a suggested replacement + 1-line rationale.
>
> Audience: California community college students, 18-25, Latin American
> Spanish dialect (Mexican Spanish dominant — ~70% of CA Latino population
> is of Mexican origin). Heritage speakers included.
>
> Tone: plain, specific, adult. NOT bureaucratic county-form Spanish.
> Think how a bilingual case manager would explain CalFresh to a student,
> not how a county PDF reads. Avoid Castilian forms (vosotros, etc.).
>
> Domain context: CalFresh / SNAP eligibility, student-specific exemptions
> (work-study, EOPS, CalWORKs), document upload prompts, error messages.
> Familiarity with US public benefits terminology strongly preferred.
> Reference glossary: USDA SNAP Spanish glossary, CDSS CalFresh program
> materials. https://www.cdss.ca.gov/calfresh
>
> Format: I will upload a CSV with columns id | english | spanish_current.
> Please return CSV with added columns spanish_revised | change_type
> (OK / minor edit / major edit / reject) | note.
>
> Turnaround needed: 5 days (by 2026-05-26 end of day Pacific).
>
> Word count: ~600-900 words across 106 strings (most strings are
> 3-15 words). Treating as a "review" not a fresh translation — happy to
> discuss appropriate rate if Gengo's standard pricing assumes
> from-scratch translation.
>
> Contact: matthewgreergentis@gmail.com
> ```

7. Submit for quote. Expect ~$80-120 at Advanced tier ($0.12/word × ~900 words). If Gengo doesn't accept "review" scope at a discounted rate, the full Advanced rate is still well under the $250-400 honorarium budget.
8. If Gengo returns a quote outside the $200-400 range or turnaround longer than 72 hours, fall back to ProZ (see below).

## How to deliver review materials

- **Export script:** open `packages/snap-compliance-copy/data/exemption-copy.json` (and the rest of the directory). For Gengo upload, export to CSV with columns: `id, english, spanish_current`. Gengo accepts CSV, XLSX, JSON, and plain text.
- **Recommended format for Gengo:** CSV — their translator dashboard handles it natively and preserves row order.
- **Alternative if Gengo only accepts running text:** generate a numbered list `1. {english} → {spanish_current}` as a .txt file. Less clean but works.
- File size will be < 50KB — well under Gengo's upload limits.

## Why this candidate (service)

- **Published rates:** Standard $0.06/word, Advanced $0.12/word. At ~900 words, this is $54-108 — well under budget and leaves room to pay a premium for rush turnaround.
- **Turnaround:** Gengo's marketed turnaround is 24-72h for small jobs; 5-day deadline is comfortable.
- **Quality control:** Advanced tier is their "business / marketing / technical" tier with editor review built in — appropriate for benefits-app UI copy.
- **Tradeoff:** Gengo translators may not have specific US benefits-program context. The instructions block above mitigates this by pinning dialect, audience, and tone. A human reviewer (Channel 1) is still preferable for nuance, but Gengo is the cheapest fast-fallback if Julyssa and Lourdes both decline.

**Research source:**
- https://gengo.com/pricing-languages/
- https://gengo.com/business-insights/how-much-does-translation-cost/

## If Gengo declines or quotes outside range

Fall back to:
1. **ProZ.com** — post a job at https://www.proz.com/post-translation-job, filter for translators with "public benefits" or "government" in their specializations, English→Spanish (Latin American). Same project brief as above. Expect quotes $0.08-0.18/word; can negotiate flat-rate.
2. **Smartling** — enterprise-leaning, likely overkill and slower intake.
3. Pivot back to Channel 1 or 3.
