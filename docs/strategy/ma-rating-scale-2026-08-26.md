# Massachusetts has no "Low Satisfactory" — and we were reading it wrong

**Discovered 2026-08-26 while re-reading North Shore Bank's evaluation.**

## The finding

The Massachusetts Division of Banks rates CRA component tests on a scale that **omits
"Low Satisfactory" entirely.** From North Shore Bank's July 25, 2022 evaluation, verbatim:

> "…in lieu of 'low satisfactory' for the Lending, Investment, and Service Test ratings,
> **as the Division does not have a 'low satisfactory' rating**."

The federal component scale runs Outstanding · High Satisfactory · **Low Satisfactory** ·
Needs to Improve · Substantial Noncompliance. The Massachusetts scale collapses the two
middle grades into a single **"Satisfactory."**

## Why this broke our screen

Our targeting screen treats **Low Satisfactory as a gap** and High Satisfactory as clean.
Against a Massachusetts evaluation that mapping silently fails:

| What the MA PE says | What we recorded | What it actually means |
|---|---|---|
| Outstanding | clean | clean |
| **Satisfactory** | **clean** ❌ | **could be either High or Low Satisfactory** |
| Needs to Improve | gap | gap |

Every Massachusetts state-chartered institution showing "Satisfactory" was scored as
though it had no gap. **North Shore Bank is the confirmed instance**: recorded as
clean-rated with $658,900 of giving, it is on the federal scale a Low Satisfactory bank on
both Investment and Service — a target, and one whose evaluation says its investments are
"not in a leadership position."

## Scope

This applies to institutions examined by the **Massachusetts Division of Banks**, which
conducts joint or parallel CRA evaluations with the FDIC for MA state-chartered banks, and
which separately evaluates licensed mortgage lenders under M.G.L. c.255E §8. It is a live
issue for the MA lender channel, where the whole target list rests on component ratings.

## What to do

1. **Never infer a component gap from "Satisfactory" on a Massachusetts evaluation.** The
   grade is ambiguous by construction. Read the narrative instead — "adequate level… but
   not in a leadership position" is the Low Satisfactory tell; "good" or "excellent" is
   the High Satisfactory tell.
2. **Re-screen every MA institution already scored**, including the MA lender list.
3. **Check the other state regimes before trusting their component grades.** New York
   (NYDFS), Connecticut and Rhode Island run their own evaluations and may differ from the
   federal scale in the same way. We have not verified any of them.
4. Encode the rule rather than remember it: a bank whose regulator is a state division
   should not be classified from a bare "Satisfactory."

## Why this was easy to miss

The sentence appears once, in a footnote-like aside, in the ratings preamble. Nothing about
a "Satisfactory" component grade looks wrong on its face — it reads as unremarkable, and it
sorts naturally alongside High Satisfactory. It surfaced only because a corrected figure
forced a full re-read of one evaluation.
