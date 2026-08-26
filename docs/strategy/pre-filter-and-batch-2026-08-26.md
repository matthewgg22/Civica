# The phantom pre-filter, and a batch that yielded nothing

**2026-08-26.**

## The pre-filter

`phantom_check()` in `src/scope_probe.py`. Before spending a read, confirm the evaluation
covers the target geography at all — count mentions of the state name and target county, and
check the rated-area headers.

**7 of 7 on the validation set:** it catches German American (Ohio=1, Franklin=0, rated areas
Indiana and Kentucky) and Umpqua (Arizona=0, Phoenix=0, Maricopa=0) while passing all five
banks that turned out to be real targets.

Run against the next ten candidates, it immediately caught a **third phantom — Bank of
England**, an Arkansas bank with Arizona branches whose evaluation mentions Arizona once and
Maricopa never. That read never had to happen.

The cause is structural and now confirmed three times: **FDIC branch data is current while an
evaluation is historical**, so any acquisition or expansion in between manufactures a target
that does not exist.

## The batch: four read, zero loadable

| Bank | Target AA | Result |
|---|---|---|
| Bankers Trust | Phoenix (full-scope) | no donations row anywhere |
| Harmony Bank | Dallas MD (full-scope) | no donations row; ISB |
| Apple Bank for Savings | New York | no donations row |
| First Security Bank | Little Rock MSA (full-scope) | row is 319 items / $29,004K **combined**; donations only at institution level (644 / $839K) |

All four are full-scope in the target area. **Full-scope is necessary but not sufficient** —
the bank must also publish a Qualified Grants & Donations row, and these four do not.

First Security's evaluation is also **six years old** (August 2020), which is worth flagging
independently of the missing figure.

## A fourth failed predictor: asset size

Having failed on national branch concentration, within-state branch share, and strict
table-subject matching, I tested whether **asset size** predicts a per-AA donations row.

| | median assets |
|---|---|
| Has a per-AA donations figure (7) | **$16.8B** |
| Does not (10) | **$13.0B** |

The distributions overlap almost completely — **Pinnacle at $41.8B has none; Republic at
$7.0B has one.** Rejected.

**Four predictors have now been tried and discarded.** The conclusion is stable: whether an
evaluation publishes a per-assessment-area donations figure is a formatting choice by the
examining office, and nothing observable outside the document predicts it.

## Yield, honestly

The first twelve reads produced **seven** usable figures. This batch of four produced **zero**.
That is not a change in method — it is the queue. The top of the ranking was worked first, and
the marginal read is now much less likely to pay.

`data-ops/analysis/cra-universe-2026/pe_read_log_2026.csv` records all twenty-one dispositions
so none is read twice.

## Roster

**30 sendable, $539,500** — unchanged by this batch, which is the correct outcome rather than a
disappointing one.
