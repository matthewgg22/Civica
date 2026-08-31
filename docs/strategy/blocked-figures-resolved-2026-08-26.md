# The three blocked figures — resolved, and none of them existed

**2026-08-26.** Each of Prosperity, FirstBank and Glacier was blocked awaiting one
assessment-area giving figure. The search is finished. **In all three cases the figure does
not exist in the evaluation**, and the reason is structural rather than accidental.

Establishing this required re-extracting the PDFs with `pdftotext -layout`. Flattened text
destroys table row labels — the figures are there, but which assessment area owns which
number is lost. Layout mode preserves the columns and the answer is then unambiguous.

## What each evaluation actually contains

**Prosperity.** Only the **full-scope** areas — OKC and DFW — get a `Qualified Investments`
table with a `Qualified Donations` row. The **Houston MSA AA is limited-scope** and appears
only as a row in the state table: **192 items totaling $158,870 thousand**, investments and
donations combined. Texas donations are reported once for the whole rated area: **1,068 for
$3,489 thousand** against **$557,397 thousand** of investments.

**FirstBank.** The Tennessee table gives Nashville MSA AA as **45 qualified investments
totaling $39,639 thousand** — investments-inclusive. **Donations appear exactly once in the
entire document**, on the institution table: **26 grants and donations totaling $126
thousand, bank-wide across all states**, against $116,633 thousand of investments. There is
no per-AA and no per-state donations row anywhere.

**Glacier.** The Arizona table gives Phoenix as **10 items totaling $18,932 thousand** — and
that row sits **above** the `Qualified Grants & Donations` line, so it is investments only.
Grants and donations are reported once for the rated area: **403 for $1,008 thousand**.
Phoenix is limited-scope; the full-scope Arizona area is Prescott.

**The pattern:** a limited-scope assessment area does not receive a donations breakout. That
is how these evaluations are written, so waiting for the figure means waiting forever.

## The fix: the guard now asks what the figure actually does

A wrong-scope giving figure is dangerous in exactly two ways — it can **size** the ask, or it
can be **quoted** in the pitch. Blocking on scope alone conflated those with merely *having*
a figure at the wrong scope, which would have permanently barred three real targets over a
number their evaluations do not contain.

| Archetype | Ask derives from giving? | Pitch quotes giving? | Wrong scope blocks? |
|---|---|---|---|
| peer | yes | **yes** | **yes** |
| remediation | yes | no | yes |
| pooled | yes | no | yes |
| **service partnership** | **no** — floor | **no** — mismatch framing | **no** |

**Prosperity and FirstBank are service partnerships and are now unblocked.** Their ask is
`MIN_VIABLE_GRANT`, which does not touch the giving figure, and their rationale block leads
on the investment-versus-service mismatch rather than a donations number. Both artifacts were
checked: **zero occurrences** of the wrong-scope figures they carry.

**Glacier stays blocked, correctly.** It is a **peer**, and a peer pitch leads with the bank's
own disclosed assessment-area figure. There is no honest peer pitch without one.

## Recorded on each record

Every one now states in `pe_giving` what was searched and what was found, so nobody repeats
the hunt. The caveats no longer say "resolve this before sending"; they say the figure does
not exist and what may therefore not be claimed.

## Roster

**25 sendable, $442,000.** One blocked — Glacier — on a figure that cannot be obtained until
a successor evaluation makes Phoenix full-scope.
