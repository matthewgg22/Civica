# Predicting a usable figure — three attempts, one that half-works

**2026-08-26.** The ask was to prefer banks whose target assessment area is full-scope, since
that is what predicts a usable donations figure. Three predictors were tried. **Two failed
outright and are recorded so they are not tried again.**

## What failed

**1. National branch concentration.** Rejected by First-Citizens: **2 branches out of ~550
nationally** in Phoenix, and Phoenix was still taken full-scope. National share says nothing.

**2. Within-state branch share.** Rejected harder — measured against the nine banks already
read, the ones **without** a usable figure scored *higher* than the ones with it:

| | within-state share |
|---|---|
| WaFd (no figure) | 34% |
| Glacier (no figure) | 31% |
| Pinnacle (no figure) | 25% |
| Truist (figure) | 26% |
| OZK (figure) | 18% |
| First-Citizens (figure) | 9% |

The signal is absent, not merely weak. **Full-scope status is the bank's own scoping decision
inside a rated area, and nothing observable outside the document predicts it.**

**3. A strict table-subject matcher.** An attempt to require the assessment area to be the
table's *subject* rather than one row, plus a prose fallback, scored **4 of 8** — worse than
the simple version, because Truist's and OZK's figures sit in tables titled by rated area.
Over-fitted and reverted.

## What ships

`src/scope_probe.py` — downloads the PE, extracts with `-layout`, and reports two things:
whether the target area is described as full- or limited-scope, and whether a donations row
appears in a table near the area's name. **6 of 8 on the banks already read.**

It is a **hint that orders a reading queue, not a gate.** Both failures are understood and
written into the module:

- **Glacier, false positive.** Its Arizona table lists Phoenix as a *row* and carries a
  Donations line that is the *state* total. The look-back window sees both.
- **First-Citizens, false negative.** Its figure is a sentence — "seven donation or grant
  contributions totaling $59,149" — with no table at all.

`-layout` extraction is the load-bearing part regardless of the heuristic. Flattened text
destroys table row labels, so the numbers survive while the assessment area that owns them
does not.

## Used immediately, and it worked

Probed six candidates, promoted the two that came back full-scope with a donations row or a
strong rated-area signal, and both read cleanly:

| Bank | Rated area | Figure | Loaded |
|---|---|---|---|
| **Republic Bank & Trust** | **Louisville MSA — rated OUTSTANDING** | **173 grants and donations totaling $1,113,000** | peer, $25,000 |
| **Enterprise Bank & Trust** | Arizona — Investment Outstanding / Service High Satisfactory | **27 donations totaling $263,000** | peer, $12,500 |

Republic's evaluation is dated **February 2, 2026** — the most recent on the roster — and the
Louisville MSA is a **rated area in its own right**, rated Outstanding, rather than one
assessment area among many. Its Kentucky and Florida rated areas carry lower Service ratings,
so reading the institution grid would have been wrong.

Enterprise's California rated area is **Low Satisfactory on all three tests** while Arizona is
Outstanding/High Satisfactory. Same document, opposite conclusions — the multi-rated-area trap
again.

Both figures were read from the **Qualified Grants & Donations row itself**, not derived from
a total-minus-subtotal difference.

## Roster

**29 sendable, $514,500.**
