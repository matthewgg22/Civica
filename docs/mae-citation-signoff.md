# Mae caseworker-assistant — citation & claim sign-off

Engineering deliverable for **legal/policy review**. "Ask Mae" (the staff SNAP
assistant in the CBO dashboard, `apps/dashboard/lib/mae/`) answers caseworker
policy questions grounded in the authorities below and constrained to make the
load-bearing claims below. Every row is **engineering-verified** against the
cited primary source on the date shown, but **counsel-unsigned**. The reviewer
fills the **Reviewer**, **Signoff date**, and **Notes** columns and returns this
signed before Mae is exposed to **partner CBOs** (it is internal/staff-only
until then).

> **Scope.** This covers Mae's *authority set* and the *curated claims* Mae is
> instructed to make — the places a wrong statement causes real harm (wrongful
> denial, deterred enrollment, immigration fear). It complements
> [`docs/SNAP-source-citation-signoff.md`](SNAP-source-citation-signoff.md),
> which covers the engine's FY26 dollar figures (Mae quotes those live from the
> engine, so they inherit that sign-off).

> **Why this matters.** Mae's answers carry inline citations, which makes them
> read as authoritative whether or not they're correct. The citation verifier
> (`lib/mae/citation-verifier.ts`) flags citations not backed by source, but it
> cannot validate that a *claim* is legally correct — that is what this review
> is for.

---

## A. Verbatim source (no legal interpretation — fidelity only)

Mae retrieves and quotes verbatim text from these eCFR sections. Reviewer need
only confirm the corpus is faithful to eCFR and current; no interpretation.

| Source | Sections | Pinned issue date | Verified | Reviewer | Signoff |
|---|---|---|---|---|---|
| eCFR Title 7 (SNAP) | 273.1–273.17, 273.24, 272.1, 272.17, 275.12 | 2026-06-02 | 2026-06-07 | | |
| Build/refresh | `apps/dashboard/lib/mae/corpus/build-ecfr-corpus.py` | — | — | | |

---

## B. Curated claims — REQUIRE legal review

These are statements Mae makes that are **not** verbatim eCFR — they are
engineering's reading of statute/guidance/cross-title rules. Each is the kind of
claim where a wrong answer is high-harm.

| # | Claim Mae makes | Source authority | Verified | Reviewer | Signoff / Notes |
|---|---|---|---|---|---|
| 1 | **SNAP is NOT counted in the public-charge test.** Public charge is a DHS rule; only cash assistance for income maintenance + long-term institutionalization count; SNAP/Medicaid(non-LTC)/CHIP/WIC are excluded. Applying for citizen/LPR children doesn't affect it. | 8 CFR 212.21–212.22 (DHS/USCIS); current USCIS public-charge guidance | 2026-06-02 | | |
| 2 | **ABAWD time-limit age ceiling is now 64** (exempt only if under 18 or 65+); the prior "55+" exemption no longer applies. | OBBBA / Pub. L. 119-21 §10102; FNS ABAWD memo (2025-10-03) | 2026-06-02 | | |
| 3 | **The veteran, homeless, and former-foster-youth ABAWD exemptions were ELIMINATED**; an Indian / Urban Indian / California Indian exemption was added (IHCIA). | OBBBA §10102; FNS ABAWD Exceptions memo (2025-10-03) | 2026-06-02 | | |
| 4 | **Non-citizen eligibility was narrowed** — refugees, asylees, and TPS holders removed; eligible set now U.S. nationals, LPRs, Cuban/Haitian entrants, COFA migrants. | OBBBA §10108; FNS Alien Eligibility memo (2025-10-31) | 2026-06-02 | | |
| 5 | OBBBA §10104 **excludes internet/telecom from the shelter deduction** (effective-date open — Mae says "confirm county practice"). | OBBBA §10104; FNS OBBB implementation memo (2025-09-04) | 2026-06-02 | | |
| 6 | **CA ABAWD time limits resumed 2026-06-01**; only a small set of counties hold a waiver through 2026-10-31 (Mae tells caseworkers to confirm the specific county). | CDSS ACL 25-93 | 2026-06-02 | | |
| 7 | CA Standard Utility Allowance values | CDSS ACL 25-68 (FY26 SUA chart) | 2026-06-02 | | |
| 8 | CA BBCE income standard is 200% FPL | CDSS ACIN I-46-25 (FFY2026) | 2026-06-02 | | |
| 9 | Restaurant Meals Program is a **statewide** CA mandate (every county) | AB 942 (eff. 2019) | 2026-06-02 | | |
| 10 | **Hot foods / foods for immediate consumption and nonfood household goods are NOT SNAP-eligible**; staple groceries are (RMP exception for eligible elderly/disabled/homeless). | 7 CFR 271.2 ("eligible food") | 2026-06-07 | | |

---

## C. Behavioral guardrails Mae is instructed to follow

Not citations, but reviewer should confirm these are adequate as deployed:

- Frames every answer as **guidance to verify against the county system, not a
  determination** (system prompt + a "Sources as of …" footer on every answer).
- **Refuses non-SNAP** questions and **does not request/echo applicant PII**
  (and input PII is server-side redacted before the model — `lib/mae/pii.ts`).
- **Defers** California-specific procedure it lacks primary source for (the
  corpus is federal-only) to the current CDSS ACL / handbook / county.
- Every query is **audit-logged** (PII-scrubbed) — `lib/mae/audit.ts`.

---

## Reviewer sign-off

**As of this revision: 0 reviewer signatures.** Mae remains internal/staff-only
pending legal-policy sign-off of Section B. Engineering owner: Matthew.
Reviewer: _(legal-policy)_. Target: before any partner-CBO exposure.
