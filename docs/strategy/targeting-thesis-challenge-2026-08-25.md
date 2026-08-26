# Is targeting the gap backwards?

**Date:** 2026-08-25 · Prompted by Matthew's challenge to the core screen

## The challenge

The whole pipeline screens for banks rated **Needs to Improve** or **Low Satisfactory** on
the Investment or Service Test, on the theory that a documented deficiency creates pressure
to act.

The counter-hypothesis: **a bad rating may mean the bank does not care.** A bank rated
Outstanding has demonstrated it funds this work — it has a CRA officer, a grants process, a
budget, and a history of saying yes. A bank rated Needs to Improve may have none of those,
and the rating is the symptom rather than the lever.

## What our own data says

**Median disclosed assessment-area giving:**

| | n | Median |
|---|---|---|
| Clean-rated banks (no gap on our tests) | 5 | **$1,600,000** |
| Gap-rated banks (our entire roster) | 19 | **$258,000** |

**A 6.2× difference in favour of the banks we screen out.**

Caveats, stated plainly: the clean sample is tiny, its figures were not all verified as
per-assessment-area, and clean-rated banks in it skew larger — **size may drive both the
rating and the giving**, which would make this correlation confounded rather than causal.
It is directional evidence, not proof.

## The sharper version of the objection

There is a mechanism here that is stronger than "they don't care", and it is visible
directly in the evaluations we read.

**A bank can satisfy the Investment Test without writing grants at all**, by holding
LIHTC funds, municipal bonds and SBIC positions. Several of our targets do exactly that:

| Bank | Investments in the AA | Grants in the AA |
|---|---|---|
| Parkway | **$27.1M** | **$7,000** |
| FirstBank (TN) | **$84.5M** bank-wide | **$126,000** bank-wide |
| Mechanics | **$24.4M** new | **$11,000** (Fresno) |
| Third Coast | $2.5M | $65,000 (Houston) |

So an **Investment Test rating tells us almost nothing about grant propensity.** A bank
rated well on Investment may write no grants; a bank rated poorly may simply have a small
balance sheet. Screening for an Investment gap in order to ask for a *grant* is close to a
category error — we were reading the wrong signal.

## Where the original thesis still holds

**The Service Test is different, and it is the one that matters for us.**

Our activity is outreach that reaches LMI households. That is a service-delivery response,
and a Service Test gap means the examiner found the bank is not reaching those households
through its own channels. The evaluations say so in terms we can quote:

- **Busey**, Chicago MD: *"no branches, limited service facilities, or ATMs within low- and
  moderate-income areas"*
- **FirstBank**, Nashville: delivery systems *"unreasonably accessible to significant
  portions"* of the AA, with no ATMs in LMI tracts — *"a very poor level"*

Neither of those is fixed by buying a bond. Both are addressed by what we do.

## The revision

Rating and giving are **independent axes**, and the screen conflated them:

- **Giving capacity** — disclosed per-AA donations — decides whether a bank *can* fund at
  our ask size. This is what the ask formula already anchors on, so the pricing was right.
- **Gap** — specifically a **Service** gap — decides whether they have a reason to act now.
- **Investment gap** should be dropped as a targeting signal. It selects for banks that
  meet CRA through instruments rather than grants.

**And the screen should stop excluding clean-rated banks.** Woodforest is the clearest
case: Outstanding on all three tests and **$17.8M of disclosed Houston giving** — the
largest in anything we have seen. It was recorded as "no examination pressure, not a first
pitch." On the capacity axis it is the strongest prospect in the entire dataset. The pitch
to such a bank is not remediation; it is *"you already fund this work, here is a better
instrument for it."*

## What this does not change

The **ask formula stays as it is.** It multiplies a giving-based anchor by a gap
multiplier, which is exactly the two-axis model this argues for. What changes is the
*targeting screen* upstream of it, which was gap-only.

## What to do

1. **Re-screen on the Service Test alone**, not Investment or Service.
2. **Add a capacity screen** independent of rating — banks with large disclosed AA giving,
   whatever their rating.
3. **Re-open the "NO GAP" rejections.** Woodforest, Beverly ($2.9M), American Business
   ($1.6M), Northfield ($1.3M) and Flagstar ($783K) were all dismissed for lack of
   pressure while carrying more giving capacity than most of the roster.
4. Test the size confound before treating the 6.2× as real — regress giving on assets
   within each rating band.

## Credit where due

This came from Matthew, not from the data. The pattern was visible in four separate PE
reads — the "big investments, negligible grants" note recurs in the commit history — and
was recorded each time as a curiosity about that bank rather than as evidence against the
screen producing it.
