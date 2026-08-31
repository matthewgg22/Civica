# Wells Fargo's per-market giving — 71 assessment areas, $849 million

**2026-08-26.** Data: `data-ops/analysis/cra-universe-2026/wells_aa_giving.csv`.
Extractor: `tools/cra-artifact/src/wells_aa_table.py`.

Wells' February 2023 evaluation states its grants-and-donations figure inside **each
assessment area's own Investment discussion**. Extracted and anchored properly, that is
**71 assessment areas totalling $849,332,900** of disclosed giving.

| Assessment area | Grants | Disclosed giving |
|---|---:|---:|
| Washington Multistate CSA | 661 | **$164,200,000** |
| New York Multistate CSA | 908 | $95,700,000 |
| San Jose CSA | 1,366 | $88,500,000 |
| **Los Angeles CSA** | 1,051 | $80,000,000 |
| Salt Lake City CSA | 220 | $55,500,000 |
| Philadelphia Multistate CSA | 416 | $51,000,000 |
| Atlanta CSA | 435 | $39,800,000 |
| Minneapolis Multistate CSA | 317 | $38,000,000 |
| Charlotte Multistate CSA | 353 | $31,600,000 |
| **Phoenix CSA** | 275 | $19,900,000 |
| Raleigh CSA | 247 | $17,200,000 |
| **Dallas MSA** | 309 | $14,500,000 |

## How the anchor works, and why it had to be rebuilt twice

The figure sits in prose a few sentences after a heading that is the assessment area's name.
Anchoring on the nearest **mention** of a place put Fresno's $5.5M under Los Angeles. Anchoring
on the **section opener** — `"<AA name> The bank had an excellent level…"` — fixed the
single-state areas but silently dropped the **sixteen multistate areas**, whose sections follow
a table with no named opener, including the three largest figures in the whole document.

Those were recovered separately, each identified from its own `"Investment Test in the
[X] Multistate CSA is rated…"` heading rather than assumed. **The largest figure in the table
would have been missing entirely from a one-pass extraction.**

## What was loaded, and what deliberately was not

**Loaded: Dallas ($14.5M) and Phoenix ($19.9M).**

Dallas is the one that mattered. Wells' Dallas MSA spans the Dallas-Plano-Irving MD *and* the
Fort Worth-Arlington-Grapevine MD — **eleven counties covering both Dallas and Tarrant**, which
between them had **zero roster banks against 67 and 47 addressable**. That is the single
largest gap on the depth table, now opened.

**Not loaded: the other 68.** Wells is one bank. Loading it under 71 assessment areas would
put 71 asks in front of one institution.

## The judgement call this raises

Large banks do run **regional CRA budgets** with market-level officers, so a Philadelphia ask
and a Los Angeles ask are genuinely separate decisions from separate pots. Approaching Wells in
several markets is defensible on those grounds.

But it is defensible up to a point. A central CRA team that compares notes and sees a dozen
simultaneous approaches from one small nonprofit reads that as a mass mailing, not a
market-specific case — and the cost of that is not one declined ask, it is the relationship.
**Three markets is a portfolio; twelve is a spray.** Wells now sits at three: Los Angeles,
Dallas, Phoenix.

## The table's better use

Its highest value is probably **not** as a Wells target list at all. It is the **peer benchmark
for pitching every other bank in these markets.**

"Wells Fargo disclosed $19.9 million of grants and donations in the Phoenix assessment area"
is a verifiable, examiner-sourced fact that belongs in front of *other* Phoenix banks — it
establishes what a serious commitment looks like in that market without asserting anything
about the reader. That works in all 71 markets, including the 68 where Wells itself is not
being approached, and it costs nothing to use.

## Roster

**37 sendable, $714,500** — 21 peer, 8 remediation, 6 service partnership, 2 pooled.
Los Angeles 8 banks · Harris 7 · Maricopa 4 · Cook, Philadelphia, Jefferson 3 each ·
**Dallas and Tarrant now on the board at 1 each**, from zero.
