# NBER WP 34434 — citable estimates

**Source of record:** Homonoff, T., Lee, M., & Meckel, K. (2025). *The Financial Consequences of
Being Denied Benefit Access.* NBER Working Paper 34434.
**Draft cited:** version dated **November 3, 2025** (`SNAP_CCP-19.pdf`, author copy hosted at
[sites.google.com/view/katherinemeckel](https://sites.google.com/view/katherinemeckel/home)).
**Publication status:** Revise & Resubmit, *American Economic Journal: Economic Policy*.
**Figures read from the draft on:** 2026-08-22.

> ⚠️ **AUDIT TRIGGER — every number on this page must be re-verified against the published version.**
> See [§ Audit obligation](#audit-obligation). Tracked as a GitHub issue; do not close it until the
> AEJ:Policy version is checked line by line.

---

## The citation posture we use

The draft's title page carries the customary preliminary-work notice: *"PRELIMINARY—PLEASE DO NOT
CITE OR DISTRIBUTE."* We cite it anyway, and the reasoning is deliberate rather than convenient:

- The paper is a **publicly issued NBER working paper** with a public abstract, and **NYU issued a
  press release** publicizing exactly these findings in December 2025. The authors and their
  institution put the work into public discussion.
- Citing working papers is ordinary practice. What is *not* ordinary — and what we do not do — is
  cite one **without saying it is preliminary**.
- Our mitigation is the version stamp. Every use in bank-facing material labels the draft date and
  states that estimates are subject to revision, so a reader in a CRA exam file three years from now
  knows exactly which version they are looking at and that a published version supersedes it.
- **We tell the authors.** A courtesy note goes to them offering our characterization for correction
  ([cra-homonoff-permission-request.md](cra-homonoff-permission-request.md)). Citing carefully and
  telling them is a better posture than citing silently.

**Required citation form in any bank-facing document:**

> Homonoff, Lee & Meckel, NBER Working Paper 34434 (preliminary draft, November 2025; estimates
> subject to revision)

Never drop "preliminary" and never drop the date. That is the whole basis on which this is defensible.

---

## Design (what the numbers are estimates *of*)

Two settings, both linking **administrative SNAP records to credit-report data** via the University
of California Consumer Credit Panel (California Policy Lab):

| | Los Angeles | San Francisco |
|---|---|---|
| Population | ~65,000 **applicants** | ~40,000 **recertification** cases |
| Period | 2020–21 | 2014–16 |
| Variation | Randomly-assigned access to an interview call center letting applicants schedule their own interview | Earlier recertification interviews, leaving more time to reschedule a missed interview before the deadline |
| Direction of the estimate | Effect of **gaining** access | Effect of **losing** access |
| Type | Experimental | Quasi-random |

Headline estimates below are **treatment-on-the-treated (TOT)** — the reduced-form effect scaled by
the first-stage effect on approval/recertification. This is the right quantity for us: it is the
effect on the household whose outcome actually changed because of the procedural fix.

---

## Los Angeles — effect of *gaining* SNAP access (TOT)

| Outcome | Year 1 | Year 2 | Year 3 | Baseline |
|---|---|---|---|---|
| Credit card balance | −$236 | −$1,394 | **−$2,436** | control mean $4,778 (**−51%**) |
| Has a delinquent account | −5.1 pp | −7.6 pp | **−10.1 pp** | 41% |
| Severe delinquency (90+ days past due) | — | — | **−13.0 pp** | **−68%** relative to baseline |
| Credit score | — | — | **+17 points** | mean 634 |
| Bankruptcy filing | no effect | no effect | no effect | — |

The authors note the debt reduction is *"roughly equivalent to the annual SNAP benefit for a
single-person household at the time of the study"* — the financial-stability effect is about the same
size as the grocery benefit itself.

On the credit score, quote the authors rather than paraphrasing upward. They describe the increases
as *"somewhat modest and only statistically significant in the final quarter"* but having *"the
potential to move recipients out of the subprime range."*

---

## San Francisco — effect of *losing* SNAP access at recertification (TOT)

| Outcome | Effect |
|---|---|
| Credit card balance | **+$500** in year 1 (+26% vs. control mean) |
| Credit score | **−15 points** year 1; range **−15 to −19 points** (marginally significant) |
| Number of delinquent accounts | **+0.41** (**+87%** vs. baseline) |
| Bankruptcy filing | no effect |

Both counties point the same way, from opposite directions — which is the strongest internal
evidence in the paper.

---

## The dollar translation (the sentence for a credit committee)

The authors translate their own estimate into borrower economics, citing Brevoort et al. (2020):
a **10-point credit-score increase yields $45–$70 in annual savings for borrowers**, so the score
increases they observe among marginal SNAP enrollees *"translate to savings of over $100 per year."*

This is the line to bring to a bank, because it is the authors' arithmetic and not ours. **Attribute
it to them.** Do not re-derive it, do not extend it to a household count, and do not multiply it
across an assessment area — a per-borrower annual figure multiplied by our projected enrollments
would be exactly the kind of invented aggregate this channel has refused from day one.

---

## Caveats that travel with every use

1. **Preliminary.** Under R&R; estimates may move. Always version-stamped.
2. **Credit-score effects are the weakest results in the paper** — "marginally significant" in San
   Francisco, significant only in the final quarter in Los Angeles. Debt and delinquency effects are
   far more precisely estimated. If an officer presses on statistics, **lead with delinquency and
   balances**, which are also the outcomes a lender underwrites on.
3. **TOT, not ITT.** These are effects on the marginal household whose enrollment changed, not the
   average effect of an outreach campaign. Our funnel projections remain entirely separate and are
   never combined with these figures.
4. **This is research about SNAP access, not about Civica Torrey.** It establishes that the
   mechanism we operate on has financial consequences. It does not measure our program.
5. **Los Angeles is 2020–21** — pandemic-era. Worth knowing before someone else points it out.
6. **Subprime framing:** 634 + 17 = 651, which is still below the conventional 660 subprime cutoff.
   The authors say "potential to move recipients out of the subprime range" — quote that phrasing;
   do **not** claim the average recipient crosses into near-prime.

---

## Audit obligation

When the AEJ:Policy version publishes (or the authors circulate a revised draft):

- [ ] Re-read every figure in this document against the published version.
- [ ] Update the tables and change the citation stamp from "preliminary draft, November 2025" to the
      published citation.
- [ ] Re-check `templates/artifact.html` and `cra-officer-call-guide.md`, which quote these numbers.
- [ ] If any figure moved materially, note it here with both values — lineage is the point — and
      consider whether any bank already holds a document with a superseded number. If one does,
      **send the corrected page**. A bank's exam file should not carry our stale figure.
- [ ] Run `pytest tools/cra-artifact/tests/` — the citation-stamp guard will fail if a number appears
      without the preliminary label.

Related: [cra-research-citations-2026-08-22.md](cra-research-citations-2026-08-22.md) ·
[cra-officer-call-guide.md](cra-officer-call-guide.md)
