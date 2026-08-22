<!-- GENERATED FILE — DO NOT EDIT BY HAND.
     Source: apps/web/lib/legal/. Regenerate: pnpm --filter web legal:md
     Redlines should be applied to the source, then regenerated. -->

# Safety and How Demeter Answers

**Civica Technologies LLC** · Last updated 2026-08-22

*Where Demeter's answers come from, how far to trust them, and where to go when you need a person.*

> **STATUS: DRAFT — NOT IN EFFECT.**
> Written against the running code, not yet reviewed by counsel.
> See `docs/legal/README.md` for the open questions and the publish checklist.

## If you need food today

> **Call 211, or visit 211.org, for food banks and community meals near you. No paperwork, no application, no wait.**

If you apply for SNAP and qualify for expedited service — which generally means very low income and few resources — federal rules require benefits to be available within 7 days. Say when you apply that you have almost nothing coming in. Many states move faster than 7 days.

If your benefits were stolen, skimmed, or cut off, contact your state agency right away and ask about replacement and about appealing. Appealing a denial is free.

When a question mentions an immediate food or housing crisis, Demeter is built to lead with these options before it explains any rules. That check looks for common phrasings in English and Spanish; it will not catch every way a person might say it.

## If you are in danger or thinking about harming yourself

> **Demeter is not a crisis service and cannot reliably tell when someone is in an emergency. Please contact a person.**

- Suicide and Crisis Lifeline — call or text 988, any time, free and confidential.
- National Domestic Violence Hotline — call 1-800-799-7233, or text START to 88788.
- Emergency — call 911.

Demeter answers questions about a food assistance program. It is not a counselor, not a therapist, and not a substitute for one. It does not detect self-harm or abuse, and it should never be relied on to.

## Demeter is AI, and it can be wrong

You are talking to a computer program, not a caseworker. It can misread a rule, miss one your state applies, or be out of date. It can also be wrong confidently, in fluent and reasonable-sounding language — that is the failure mode of this kind of system, and it is the reason for everything described below.

Nothing Demeter says is a decision about your case. Only your state SNAP agency decides that.

## How an answer is built

Demeter does not answer from memory. Each question is used to search a collection of source documents — federal SNAP regulations from the Electronic Code of Federal Regulations, and, for states we have verified, that state's own policy manual. The passages that come back are what the answer is written from.

Every source snapshot carries a date, and the date the answer was grounded on is recorded with it. Rules change; an answer is only as current as the snapshot behind it.

After an answer is written, its citations are checked against the sources. If a citation cannot be verified, Demeter tries again; if it still cannot, the answer is degraded rather than shipped as if it were solid — you see a weaker claim instead of a confident one resting on a citation that does not exist.

Each answer then carries a one-line verdict: a ✓ when the claim is grounded in a verified citation, or a ⚠ when it is not, with the reason and the citations to check for yourself. When Demeter makes no rule-based claim at all, there is no banner, because there is nothing for you to verify.

## States, and the federal floor

SNAP is federal rules administered by states, and states differ in ways that change real answers — income limits, deductions, work requirements, and which exemptions apply.

If you have not told Demeter your state, it answers with federal rules only, and says so. It never guesses a state for you: an answer confidently given for the wrong state is worse than a general one.

A "verified" state is one whose own policy manual we have loaded and checked, so answers for it can cite that state's source. For other states you get the federal floor, with a note that your local agency is the one to confirm with.

Puerto Rico, American Samoa, and the Northern Mariana Islands do not run SNAP at all — they operate block-grant nutrition assistance programs with their own eligibility rules. Demeter answers questions from those places with a direct hand-off rather than applying SNAP rules that do not exist there.

## When to be extra careful

Be more skeptical, and confirm with your agency or a local organization, when:

- The answer carries a ⚠ rather than a ✓.
- Your state is not one of the verified ones, so the answer is the federal floor.
- Your situation involves rules that change often or vary locally — work requirements and their exemptions, student eligibility, non-citizen eligibility, or how a specific kind of income is counted.
- The stakes are high and immediate: an appeal deadline, a recertification date, or a decision about whether to apply at all.
- Anything Demeter says conflicts with what your agency told you. The agency is the authority; Demeter is not.

If Demeter suggests you may not qualify, that is not a denial and it is not a reason to skip applying. Applying is free, only the agency can decide, and people are approved every day who assumed they would not be.

## How we check ourselves

We keep a short-lived record of each question and answer, with personal identifiers stripped out, together with the citations the answer used, whether they verified, and which source snapshot it was grounded on. That record is what makes an accuracy claim checkable rather than merely asserted. The Privacy Policy explains how long it is kept and what is removed from it.

Answers whose citations could not be verified are flagged and reviewed by a person.

If Demeter told you something wrong, please tell us — use the feedback link in the footer. A wrong answer about benefits is not an abstraction, and reports are how they get found and fixed.

## Languages

Demeter answers in English and Spanish. When an answer contains figures, the two versions are checked against each other so the numbers cannot drift apart between languages.

This notice and our other legal documents are currently published in English only. If you would like them in another language, write to us and we will help.

## Where to get help from a person

- Your state SNAP agency — the only office that can decide your case, and the place to apply, appeal, or report stolen benefits.
- 211, or 211.org — food banks, community meals, and local help, right now.
- Local legal aid — free help if your benefits were denied, cut, or stopped and you think it was wrong.
- Community organizations near you that help with applications, in person.

Demeter is operated by Civica Technologies LLC. It is free, it carries no advertising, and nobody pays to influence what it tells you.
