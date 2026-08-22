# Demeter legal package — review memo

**Date:** 2026-08-22
**Subject:** Review of the Demeter Privacy Policy, Terms of Service, and Safety Notice
**Status:** Internal review. Not legal advice, and not a substitute for a licensed attorney.

---

## What this review is, and what it is not

This is a structured self-review of the three documents against the product as
built, in the shape a technology and privacy lawyer would use: applicability
analysis, then findings ranked by severity, then what remains open.

It is **not legal advice and does not come from a lawyer.** Three things in it
genuinely require a bar-admitted attorney and should not be treated as settled
because they appear here — they are marked **[NEEDS COUNSEL]** and listed again
at the end. The rest is the ordinary work of making documents describe the
system accurately and not promise things the code does not do, which is
engineering as much as law, and which is done.

---

## The governing point

Most of the compliance conversation about privacy policies is about whether a
statute applies. For Demeter today, **almost none of them do** — the thresholds
are not met (see the applicability table below). That produces a tempting but
wrong conclusion: that the policy is low-stakes.

The opposite is true. **Section 5 of the FTC Act applies to everyone, at every
size, with no threshold.** A material representation that is likely to mislead is
a deceptive practice, and the FTC has brought exactly these cases against small
companies over privacy promises they did not keep. Everything voluntarily
promised in these documents — "we do not sell your information," "we do not train
on your conversations," "deleted after 7 days" — is enforceable *because it was
promised*, not because a statute required it.

This inverts the usual drafting instinct. The risk is not in saying too little.
The risk is in saying something reassuring that operations does not actually do.

That is why the retention gate exists (Finding 1), and why the fix throughout has
been to make promises *narrower and true* rather than *broader and aspirational*.

---

## Applicability

| Regime | Applies? | Why |
|---|---|---|
| **FTC Act §5** | **Yes, now** | No threshold. Every promise in these documents is enforceable. The operative constraint. |
| **State breach notification** | **Yes, now** | All 50 states, no size threshold. Addressed by the new Security section. |
| **MA 201 CMR 17.00** | **Probably yes — see Finding 3** | Applies to anyone owning or licensing personal information about a Massachusetts resident. No size threshold. Requires a written program. |
| CCPA / CPRA | Not yet | Requires >$25M revenue, or buying/selling/sharing PI of 100k+ CA consumers, or ≥50% of revenue from selling PI. None met. Nonprofits are excluded entirely. Rights are offered voluntarily anyway. |
| Other state privacy laws (VA, CO, CT, UT, OR, MT…) | Not yet | Mostly 100k-consumer thresholds. Texas has no revenue threshold but exempts SBA-defined small businesses. Revisit at scale. |
| COPPA | No | Not directed to children; no actual knowledge. Posture now stated explicitly in the policy. |
| HIPAA | **No** | Not a covered entity or business associate. Disability or health details a user types into a SNAP question are not PHI here. Worth knowing so nobody assumes protections that do not exist. |
| SNAP confidentiality — 7 U.S.C. §2020(e)(8), 7 C.F.R. §272.1(c) | Not yet | Binds state agencies and those acting for them. Demeter talking directly to applicants is outside it — **until** it contracts with an agency or acts under a CBO's agency authority, at which point it inherits the restrictions. The policy is conditionally worded for this reason. |
| GDPR / UK GDPR / EU AI Act | No | US-only program, no targeting. Reinforced by the new US-only statement. |
| Colorado AI Act (SB 24-205) | **Monitor — [NEEDS COUNSEL]** | Reaches "high-risk" systems that are a substantial factor in consequential decisions, and the enumerated list includes essential government services. Demeter's defense is structural: it does not make the decision, the agency does. I am not confident of the current effective date after the 2025 amendments — confirm before launch. |
| TCPA / CAN-SPAM | Not implicated | No SMS. Email is transactional only. Now stated in Terms §15. |
| ADA Title III (web accessibility) | **Real risk, out of scope here** | Consumer-facing sites draw these claims regardless of size. Not a document fix. Should be its own workstream. |

---

## Findings

### 1. The retention promise is not enforced by anything — **BLOCKER, gated**

The Privacy Policy states question text is deleted after 7 days. No job does
this; nothing has ever been deleted from `mae_query_log`. Publishing that
sentence today would be a false statement of fact about privacy practices — the
exact FTC §5 fact pattern, aggravated by the population served.

**Status: gated in code, not merely noted.** `RETENTION_JOB_LIVE = false`, and
the test suite fails if any document reaches `status: "published"` while it is.
Tracked as issue #926.

**A lawyer would add one thing I have now added:** the policy previously implied
our deletion schedule was the whole story. It is not — the model provider keeps
its own short-term copy under its own terms. Describing our 7 days without that
was misleading by omission. Now disclosed.

### 2. There was no assent mechanism at all — **CRITICAL, fixed**

The Terms said "By using Demeter you agree to these Terms," and the only path to
them was a footer link. That is textbook **browsewrap**, and browsewrap is
routinely held unenforceable for lack of notice and assent.

This is not a technicality about one clause. **If the agreement does not form,
nothing in it binds** — not the arbitration clause and class waiver you chose,
not the $100 liability cap, not the disclaimer of warranties, and not the
"NOT AN ELIGIBILITY DETERMINATION" provision that is the single most protective
sentence in the package. The most consequential legal decision in this project
was resting on nothing.

**Fixed** by converting to sign-in-wrap: conspicuous notice adjacent to each act
that manifests assent — under the chat composer ("By sending a message you agree
to our Terms and Privacy Policy") and beside the sign-in button ("By creating an
account…"), in all four languages, with both documents linked. Terms §1 was
rewritten to describe this actual mechanism rather than footer-by-implication,
and a test pins the notice in every locale so a redesign cannot quietly drop it.

**[NEEDS COUNSEL]** — whether this implementation clears the bar in the circuits
that matter is a judgment call on conspicuousness that needs a real lawyer's
eyes on the rendered page, not a description of it. Screenshots are in the PR.

### 3. Massachusetts 201 CMR 17.00 requires a written security program — **OPEN, needs you**

Massachusetts imposes a specific data-security regulation on **any** entity that
owns or licenses personal information about a Massachusetts resident. There is
no revenue or headcount threshold. It requires a documented Written Information
Security Program (a "WISP"), a designated person responsible for it, risk
assessment, third-party service provider oversight, and encryption of personal
information transmitted across networks or stored on portable devices.

If the operating entity is Massachusetts-based (my understanding), this is a live
obligation and one of the most commonly missed by startups. The encryption and
vendor-oversight parts you largely satisfy already. The written program does not
exist and cannot be inferred from code.

This is not a documents fix — it is a separate artifact. Worth doing: it is a
half-day of writing, and its absence is the kind of thing that turns a minor
incident into a regulatory finding.

### 4. The immigration promise contradicted the legal-process section — **fixed**

The policy promised absolutely that we "do not give what you tell us to
immigration authorities," while a later section correctly acknowledged we would
comply with valid legal process. Both cannot be true. An absolute promise that
compelled process would break is itself the misrepresentation.

**Fixed** by making the promise narrower and, I would argue, more persuasive: we
never *volunteer* it; if compelled, there is almost nothing to give, because the
chat is anonymous, the IP is not reversible, and status is not stored. The
reassurance now rests on architecture rather than on a promise the company does
not have the power to keep. A new paragraph says exactly that, and says why.

### 5. Governing law pointed at California — **changed, confirm**

The Terms selected California law and California courts, but the only verified
location fact available is a Massachusetts headquarters. A forum with no
connection to either party is the weakest choice available and can be challenged.

**Changed to Massachusetts**, which matches the known place of business and makes
venue genuinely inconvenient for out-of-state plaintiffs — a real if unglamorous
benefit.

**Two consequences you should know.** Massachusetts **Chapter 93A** is a
plaintiff-friendly consumer protection statute allowing multiple damages and
attorney's fees; choosing MA law brings it more clearly into play, though as a
MA-based company much of your conduct would likely be reachable under it anyway.
And this choice is downstream of the unresolved entity question — if Demeter is
actually operated by an entity based elsewhere, revisit both this and the §13.2
notice address.

### 6. Rights were offered "depending on where you live" — **fixed**

Conditioning rights on residency invites an argument about which statute applies
and forces a user to prove where they live before you will delete their data.
For this population — including people who may be reluctant to document
residency at all — that is both bad practice and bad optics.

**Fixed:** rights are now extended to everyone regardless of state or immigration
status, with a 45-day response commitment and an appeal path. This costs
essentially nothing at current volume and forecloses the whole applicability
argument.

### 7. Indemnification was too broad for a consumer contract — **fixed**

Broad indemnities against consumers are disfavored and can be found
unconscionable, particularly against a low-income user base in a free service.
The prior clause reached any claim arising from "how you used Demeter."

**Fixed** and narrowed to actual misuse — the Section 6 prohibitions, illegality,
infringement — with an explicit carve-out saying ordinary use, including relying
on an answer that turned out to be wrong, creates no indemnity obligation.

### 8. Missing standard provisions — **fixed**

Added: sensitive-information handling with a no-inference commitment (several
state regimes treat immigration status, disability and health as sensitive, and
users volunteer all three); security and breach-notification; an explicit
de-identification and no-re-identification commitment; a US-only statement that
undercuts any GDPR or EU AI Act argument; a COPPA posture statement; a
no-third-party-beneficiaries clause; a no-agency clause; and a statement that we
send no marketing email.

### 9. Unauthorized practice of law — **mitigated, monitor** — **[NEEDS COUNSEL]**

Explaining published rules is information, not legal advice, and there is
substantial protection for legal self-help publishing. The risk rises if Demeter
moves toward case-specific advocacy or acts for a user with an agency.

Mitigated by the existing "not legal advice / no attorney-client relationship"
language and by a **new** clause: SNAP permits an authorized representative,
Demeter is not one, and using it does not make us one. Revisit per-state if the
product ever files, appeals, or communicates with an agency on a user's behalf.

### 10. Mass-arbitration fee exposure — **structural, accepted**

Under AAA Consumer Rules the business bears nearly all fees. Coordinated filings
at 25+ claims can generate serious cost with no merits determination. §13.9's
staged mass-dispute protocol is the standard mitigation and is drafted in. Note
that some courts have scrutinized these protocols; this is an accepted risk of
the clause you chose, not a defect in the drafting.

---

## Before launch

**Requires a licensed attorney:**
1. Review the assent implementation as rendered (Finding 2) and the enforceability of §13 as a whole.
2. Confirm the Colorado AI Act analysis and its current effective date.
3. Per-state UPL review if the product's scope widens beyond information.

**Requires you:**
4. Resolve the entity question — Civica Technologies LLC vs Civica Torrey Inc. Which one operates Demeter? Governing law, the §13.2 notice address, and the WISP obligation all follow from it. It is one constant (`ENTITY`) plus a regenerate.
5. Fill `[MAILING ADDRESS]` in Terms §13.2.
6. Create `privacy@civica.app` and `legal@civica.app`. A bouncing privacy contact defeats the rights process; an unreachable opt-out address is what gets arbitration clauses struck.
7. Execute the DPAs — Anthropic, Supabase, Vercel, Resend, Sentry all offer them and most require affirmative acceptance. The policy says these vendors are contractually bound; that must be true.
8. Write the WISP (Finding 3).
9. Build the retention job (#926) before any document leaves draft.

**Separate workstreams:** ADA accessibility review; the self-harm and DV gap in the distress gate (#927).
