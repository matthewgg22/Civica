---
id: 2026-05-29-guarino-error-rate-metric
date: 2026-05-29
scope: [analytics, pitch]
confidence: medium
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: url
    ref: "https://daveguarino.substack.com/p/government-stuff-1"
    note: "Dave Guarino, 'Plausible Legibility' — payment-error-rate methodology essay. Quotes below confirmed verbatim against the raw post HTML on 2026-05-29."
  - kind: url
    ref: "https://daveguarino.substack.com/p/diagnosing-government-incapacity"
    note: "Companion essay: state capacity (implementation/execution) as the object-level constraint, not only policy design."
---

## What we found

Dave Guarino built **GetCalFresh** at Code for America — the applicant-facing
tool that processed millions of CalFresh applications — and now writes the
*Plausible Legibility* substack. He is the highest-signal independent voice on
CA SNAP operations. His payment-error-rate essay makes two points that bear
directly on Civica's error-rate page, and both are quotable verbatim:

1. **The error rate is a partial scoreboard.** It is computed over *payments
   made*, not the whole universe of what the program does:
   > "a payment error methodology starts with a universe of payments made, not
   > the total universe of what the machine does."

   Eligible people who never got benefits do not count at all: of a household
   that should have been paid but was not, he asks "what effect does it have on
   our payment error rate?" — "**None. It doesn't count at all.**"

2. **Chasing the rate the wrong way harms access.** Because "payment accuracy is
   really *the* thing people look at most for benefit programs … a very strong
   systematic force over the long run," agencies push it down with more
   documentation — and that backfires:
   > "When does asking for more documentation actually lead to eligible people
   > not getting benefits due to that extra burden?"

## Why it matters

This is the **witness lens** on the error rate — expert operational analysis,
distinct from the *measured* lens (USDA QC microdata,
[[2026-05-29-usda-qc-ca-grounding]]) and the forthcoming *modeled* lens
(PolicyEngine benefit mechanism). It does two things for the pitch:

- **It sharpens the perfect-application ethos.** There is a right way and a
  wrong way to lower the rate. The wrong way adds verification burden onto the
  applicant and pushes eligible people out. The right way is to make the
  submitted case **correct before it is filed** — which is exactly what Civica
  does. The error falls because the application is right, not because the
  applicant cleared one more hoop. The most credible voice in the space has
  drawn the line Civica sits on the correct side of.
- **It buys intellectual honesty.** The page can now acknowledge the metric's
  own limits (it only sees processed overpayments; access-side underpayments are
  invisible to it) instead of treating PER as the whole truth. Acknowledging the
  limit makes the rest of the claim more credible, not less.

## What changes

- `/findings/error-rate` gains a clearly-labeled "A caution worth taking
  seriously" block after "operational, not policy" — a short framing plus one
  verbatim Guarino quote and a link to the source. It is marked as practitioner
  perspective, not federal data, to keep the evidence lenses legible.
- Sets up the three-lens framing (measured / modeled / witnessed) to be
  completed when the PolicyEngine mechanism lands.

## Open questions

- **Do not overclaim.** PER's blind spot (access-side underpayments) is a
  genuine limit of *our own headline number* too. Keep the page's claim scoped
  to agency-side (operational) overpayment error, which is what QC measures and
  what Civica reduces.
- His "access vs accuracy vs timeliness" framing deserves its own treatment in
  the B2G deck (not just this page).

Related: [[2026-05-29-usda-qc-ca-grounding]] · [[2026-05-29-error-rate-truth-point]]
