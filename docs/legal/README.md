# Demeter legal package — counsel review

**Status: DRAFT. Not in effect. Not yet reviewed by counsel.**

Three documents covering the public Demeter chat, written against the running
code rather than against intent. Every factual claim in them was read out of a
specific file, and the citations are in this document so a reviewer can check
any sentence against the system it describes.

| Document | Source of truth | Published at |
|---|---|---|
| [Privacy Policy](demeter-privacy.md) | `apps/web/lib/legal/privacy.ts` | `/privacy` |
| [Terms of Service](demeter-terms.md) | `apps/web/lib/legal/terms.ts` | `/terms` |
| [Safety and How Demeter Answers](demeter-safety.md) | `apps/web/lib/legal/safety.ts` | `/safety` |

The `.md` files here are **generated**. Redlines get applied to the TypeScript
source, then `pnpm --filter web legal:md` regenerates. This keeps the website
and the reviewed document from ever being two different texts.

---

## Scope

**Covered:** the public Demeter chat (`/`, `/chat`, `/questions`, `/screen/ask`),
saved conversations, the emailed application outline, and the feedback form.

**Not covered:** the Civica application flow (`/apply`, `/documents`, `/packet`),
which uploads documents and transmits a packet to a state agency, and the CBO
screening tool (`demeter_screenings`), which is an organizational surface with
its own access model. Both need their own coverage.

The apply flow was excluded deliberately: its retention question is unresolved
in our own documentation. `docs/snap/llm-retention-policy.md` says document
images must never be stored (0 days); `docs/snap/retention_policy.md` says they
are kept for 7 years. A privacy policy cannot be written over a contradiction,
so this package does not try.

---

## Publish blockers

These are not review comments. Publishing before they are resolved would put a
false statement on the site.

**1. The retention purge job does not exist.**
`apps/web/lib/demeter-audit-sink.ts` states that retention is "enforced by the
retention job, not here." There is no such job anywhere in the repository. No
row has ever been deleted from `snap_enrollment.mae_query_log`; every question
and answer written since the public chat launched is still stored. The Privacy
Policy's retention section is therefore a statement of intent, and until the job
runs it must not be published as fact.

The build enforces this: `RETENTION_JOB_LIVE` in `apps/web/lib/legal/types.ts`
is `false`, and `legal-claims.test.ts` fails if any document reaches status
`published` while it is. Build the job against the `RETENTION_DAYS` constants,
flip the flag, and the gate opens.

**2. The contact mailboxes must exist.**
`privacy@civica.app` and `legal@civica.app` are referenced throughout, including
as the address for rights requests and for the arbitration opt-out. A bouncing
privacy contact defeats the rights process that CCPA §1798.130 requires us to
provide, and an unreachable opt-out address is the specific defect that gets
arbitration clauses struck.

**3. A mailing address is required.**
`[MAILING ADDRESS]` appears in Terms §13.2 where the arbitration notice
provision requires a physical address. The test blocks publishing any document
that still contains a bracketed placeholder.

---

## Review status

A full review pass has been done and its findings applied — see
**[COUNSEL-REVIEW.md](COUNSEL-REVIEW.md)** for the memo: applicability analysis,
ten findings ranked by severity, and what remains open. That memo is not legal
advice and was not written by a lawyer; three items in it are marked
**[NEEDS COUNSEL]** and genuinely require a bar-admitted attorney.

The headline from that review, because it reframes everything else: **FTC Act §5
applies at every size with no threshold**, while essentially none of the state
privacy statutes are triggered yet. So the enforceable constraint is not "did we
comply with CCPA" — it is "is every sentence we voluntarily wrote actually true."
That is why the drafting throughout prefers narrow-and-true over broad-and-warm,
and why the retention claim is gated in code rather than merely flagged.

Two findings were serious enough to name here:

1. **There was no assent mechanism.** Terms reachable only from a footer link is
   browsewrap. If the agreement does not form, *nothing in it binds* — including
   the arbitration clause, the liability cap, and the "not an eligibility
   determination" disclaimer. Fixed with conspicuous notice at the composer and
   at sign-in, in four languages, pinned by tests.

2. **Massachusetts 201 CMR 17.00** requires a Written Information Security
   Program from anyone holding personal information about a MA resident, with no
   size threshold. It does not exist. It is not a documents fix.

## Still open

**Needs a licensed attorney:** the assent implementation as rendered and §13's
enforceability; the Colorado AI Act analysis and effective date; per-state
unauthorized-practice review if the product widens beyond information.

**Needs you:**

1. **Entity.** `Civica Technologies LLC` is used throughout, per instruction —
   but the 501(c)(3) is recorded elsewhere as `Civica Torrey Inc`. Which entity
   operates Demeter? Governing law, the §13.2 notice address, and the WISP
   obligation all follow from the answer. One constant (`ENTITY` in
   `apps/web/lib/legal/types.ts`) plus a regenerate.
2. **`[MAILING ADDRESS]`** in Terms §13.2 — the only unfilled placeholder.
3. **Mailboxes.** `privacy@civica.app` and `legal@civica.app` must exist.
4. **DPAs** with Anthropic, Supabase, Vercel, Resend and Sentry. The policy says
   these vendors are contractually bound; that has to be true.
5. **The WISP**, and **the retention job (#926)** before anything leaves draft.

Decisions already made and recorded, not open: arbitration in standard form
(operator's explicit direction, tradeoff raised first); no age floor for asking;
English-only legal text for now; scope limited to the Demeter chat surfaces.

## The data-flow map these documents describe

Every row was read from the code, not from a design document.

| Flow | What is collected | Where it lands | Stated retention |
|---|---|---|---|
| Public chat (anonymous, no account) | Question with structured identifiers stripped, answer, citations, verifier outcome, certainty, corpus date, model, token counts, state scope, anonymous session id, turn index | `snap_enrollment.mae_query_log` (`lib/demeter-audit-sink.ts`) | 7 days / 30 days flagged — **not enforced yet** |
| Rate + spend gate | Salted SHA-256 of IP, truncated to 16 hex chars. Raw IP never stored | `demeter_usage` (`lib/demeter-usage.ts`) | Current window / current day |
| Partner referral | Opaque `ref` code, capped at 64 chars, never identity | `mae_query_log.scope_ref` | With the row |
| Saved conversations (account only) | Email (via magic link), transcript, title, state, language | `snap_enrollment.demeter_conversations`, RLS-enforced (migration `20260617`) | Until the user deletes |
| Working estimate | **Not persisted** — deliberately excluded from the saved row so the in-product "nothing is saved" promise about the worksheet stays true | — | — |
| Outline email | Composed document sent to the session's own address only; no body-supplied recipient | Resend | Provider |
| Model inference | Redacted question | Anthropic API | Per agreement; not used for training |
| Errors | Scrubbed error events | Sentry | Provider |

**PII redaction** (`packages/demeter-engine/src/pii.ts`) removes SSNs, phone
numbers, emails, slash-dates, and long account/EBT/case numbers before the
question leaves the server. It deliberately does **not** redact names, because
name detection is error-prone and false positives would mangle real questions.
The documents state this limitation plainly rather than implying full scrubbing.

**Distress handling** (`packages/demeter-engine/src/distress.ts`) detects acute
food and housing crisis phrasing in English and Spanish and makes the answer
lead with expedited-service rights, 211, and stolen-benefit steps. It does
**not** detect self-harm, suicidal ideation, or domestic violence. The Safety
notice therefore gives 988 and the DV hotline unconditionally and states that
Demeter is not a crisis service, rather than implying a protocol that does not
exist. Closing that gap is tracked separately.

---

## Deliberate departures from the reference policies

Reviewed against Inflection AI (Pi), OpenEvidence, and OpenAI.

**Adopted:** OpenEvidence's plain-language promises above the fold; its
conspicuous `NO MEDICAL ADVICE` block, retargeted as "Demeter does not decide
your case"; OpenAI's three-bucket retention structure with concrete numbers;
Inflection's separate published safety protocol; and its transparency page,
retargeted from content moderation to *grounding* — which corpus, which snapshot
date, what a citation means.

**Rejected:** OpenEvidence's advertising, audience-extension and data-licensing
apparatus, which is foreclosed in writing here. Note that OpenEvidence's own
documents contradict each other on this point — the Privacy Policy's banner says
personal information is never sold, while the Terms of Use contemplate selling
user data to Licensees. Also rejected: Pi's 18+ bar (see item 3 above), and
bundling SMS marketing consent into acceptance of terms.

**Added, with no counterpart in any of the three:** the immigration-status
section, the SNAP confidentiality reference, and the grounding disclosure.
