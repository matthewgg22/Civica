# Courtesy note to the authors of NBER WP 34434

**Status:** DRAFT, not sent. Sending is Matthew's call — it goes out under his name, from his address.
**Created:** 2026-08-22
**Related:** [cra-wp34434-estimates.md](cra-wp34434-estimates.md) ·
[cra-research-citations-2026-08-22.md](cra-research-citations-2026-08-22.md)

## What this email is, and is not

It is **not** a permission request. We have decided to cite the paper's estimates in bank-facing
materials, version-stamped as preliminary — that decision is made, and the reasoning is recorded in
[cra-wp34434-estimates.md](cra-wp34434-estimates.md#the-citation-posture-we-use).

It is a **courtesy note** that does two things worth doing:

1. **Tells them.** The draft says "please do not cite or distribute." We are citing it. Doing that
   quietly is a worse posture than doing it openly, and if they object we would rather hear it now
   than after eight banks hold the document.
2. **Buys a free accuracy check.** We are quoting six figures and a subprime-boundary framing from a
   paper under revision. The authors are the only people who can tell us we've read a table wrong,
   or that a specific estimate is one they expect to move. That correction is worth more to us than
   the permission would have been.

If they ask us to stop, we stop — and fall back to the qualitative framing, which the channel worked
on before these numbers existed. Nothing is blocked either way.

## Draft email

> **To:** tatiana.homonoff@nyu.edu
> **Cc:** kmeckel@ucsd.edu *(verify from her UCSD directory before sending)*; Min Lee (UCSD)
> **Subject:** Citing WP 34434 in nonprofit materials — a heads-up and an accuracy check

> Dear Professor Homonoff,
>
> I run a small nonprofit, Civica Torrey Inc., that helps low-income households complete SNAP
> applications and recertifications — the exact procedural step your work with Min Lee and Katherine
> Meckel studies. I'm writing to tell you how we're using your paper and to ask you to correct us if
> we've gotten anything wrong.
>
> Our funding model asks banks to support SNAP outreach in their Community Reinvestment Act
> assessment areas. Your finding gives that case something it otherwise lacks: evidence that the harm
> from a process-related denial lands on a credit report, which is an outcome a bank already
> understands.
>
> I read the full draft from Professor Meckel's faculty page and I saw the "preliminary — please do
> not cite or distribute" notice. I want to be straightforward with you: we have decided to cite the
> estimates, and I would rather say so directly than do it quietly. Our reasoning is that the paper
> is a publicly issued NBER working paper that NYU publicized by press release, and that the honest
> way to use preliminary work is to label it as preliminary rather than to avoid it. Every citation
> in our materials reads "NBER Working Paper 34434 (preliminary draft, November 2025; estimates
> subject to revision)," and we have an internal obligation to re-verify every figure against the
> published version and to send corrected pages to any bank holding a superseded number.
>
> If you would prefer we hold off until the AEJ:Policy version, tell me and we will — we managed
> without the figures before and can again.
>
> The part I would most value: **have we read it correctly?** Specifically, we cite the
> treatment-on-the-treated estimates — the $2,436 reduction in credit card balances by year three in
> Los Angeles, the 10.1 percentage point reduction in delinquent accounts, the 17-point credit score
> increase off a 634 baseline, and the 15-to-19-point decrease among San Francisco recertification
> failures. We also repeat your translation via Brevoort et al. that this amounts to over $100 a year
> in borrower savings. We flag in our own materials that the credit-score results are the least
> precisely estimated of the set and steer conversations toward the delinquency and balance effects.
> If any of that is a misreading, or if there is an estimate you expect to move in revision, I would
> be grateful to know.
>
> I'm glad to send the one paragraph as it appears in our materials. These documents end up in a
> bank's CRA examination file, so I'd rather have it right than have it fast.
>
> Thank you for the work itself. There's a real gap between research on administrative burden and the
> organizations doing the paperwork, and this paper closes part of it.
>
> With appreciation,
> Matthew Greer
> Civica Torrey Inc. *(501(c)(3), determination August 2026)*
> matthewgreergentis@gmail.com

## Before sending

- [ ] Verify Meckel's and Lee's current UCSD addresses from the department directory — do not guess.
- [ ] Send from an address you monitor; academics often reply days or weeks later.
- [ ] **If they object:** revert bank-facing materials to the qualitative framing
      (`git revert` the citation commit is not enough — the numbers live in `artifact.html`, the call
      guide, and `cra-wp34434-estimates.md`), and record the objection in the estimates doc.
- [ ] **If they correct a figure:** fix it everywhere, and check whether any bank already received a
      document with the wrong number. If so, send the corrected page unprompted.
- [ ] **If no reply:** that is neither permission nor objection. Keep the version-stamped citation and
      the audit obligation, which is what makes it defensible regardless.
