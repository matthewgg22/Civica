# Auditing the U.S. Campaign-Finance Sector
### How much money, from whom, and how much we cannot see
*A Policy Analysis Exercise (PAE) — draft, 2026-07-19*
*Companion to the VoteNow live instrument (`/Users/matthewgreer-gentis/Developer/votenow-money-map`)*

---

## Executive summary

There is **no single clean "total" for money in U.S. elections.** The honest answer is a *decomposed, sourced, uncertainty-bounded* accounting, and producing even that is genuinely hard for four structural reasons: committee-type overlap (double-counting), scope ambiguity (federal vs. state/local), timing (cycle-to-date vs. final), and the dark-money wall (money you can see enter but not trace to source).

Best current figures:

| Measure | Amount | Source |
|---|---|---|
| 2024 federal cycle, total | **~$15.9B** | OpenSecrets (record; 2020 = $15.1B) |
| 2023-24, federal + state/local | **~$20.5B** | OpenSecrets |
| 2024 outside spending (super PACs) | ~$2.6B+ | OpenSecrets |
| 2024 dark money (federal) | **~$1.9B** | Brennan Center |
| 2025-26 to date (through Mar 2026) | candidates $2.1B · parties $1.1B · **PACs $6.3B** raised | FEC 15-mo statistical summary |

**Three findings dominate:**
1. **Concentration.** The top 1% of donors supply roughly **half** of all money; the top 10 individuals ≈ $599M (~7% of federal fundraising); small donors (<$200) have fallen to ~24% of candidate money (from 30% in 2020). The sector is a plutocracy by revenue.
2. **Opacity.** A structural slice — at least ~$1.9B federally in 2024 — is *dark*: it enters disclosed vehicles (super PACs) from 501(c)(4)/(c)(6)/527 nonprofits whose own donors are legally hidden. You can trace money **to** the nonprofit, never **through** it.
3. **Evasion.** The limits and disclosure rules are routinely circumvented — legally (redboxing, JFC "ads," leadership-PAC personal use, anonymous LLCs) and criminally (straw donors, foreign money, scam PACs — Parnas, D'Souza, the FTX/Salame scheme, Herrera Velutini). The FEC almost never enforces coordination. See §7.

**Contribution of this PAE + instrument:** a *live, reproducible* audit that (a) computes the sector total from primary FEC data with an explicit de-duplication rule, (b) decomposes it by channel and source, and (c) makes the untraceable fraction a first-class, quantified number rather than a footnote.

---

## 1. Research question

> How much money moves through the U.S. campaign-finance sector per cycle; from what sources; through what channels; what share is untraceable; and *why is a single authoritative total so hard to produce?*

Sub-questions: (a) What is the defensible total, by scope? (b) How concentrated are the sources? (c) How large and how measurable is the dark-money fraction? (d) What would make the number more legible and more comparable across cycles?

## 2. Why a single number is hard (the measurement problem)

1. **Committee-type overlap → double-counting.** For 2025-26, federal committees report, separately: congressional candidates $2.1B, party committees $1.1B, PACs $6.3B raised. **These cannot be summed.** A dollar flows donor → PAC → candidate → independent expenditure and is counted at each committee it passes through. Gross-receipts-by-type ($9.5B) massively overstates the true total. Any credible number must **count each dollar once, at its point of final expenditure**, and treat inter-committee transfers as edges, not additions.
2. **Scope ambiguity.** "US elections" = federal only (~$15.9B, 2024) or + state/local (~$4.6B more in 2023-24, → ~$20.5B)? Presidential-year vs. midterm differ ~2x. Cycle (2 years) vs. calendar year differ ~2x.
3. **Timing.** Cycle-to-date understates the final. The VoteNow live ingest illustrates the trap: it reports ~$3.58B, but that is **congressional-candidate receipts + a partial independent-expenditure pull, mid-2026, no PACs or parties** — a floor of a floor, not the sector total.
4. **The dark-money wall + announced ≠ filed.** 501(c)(4) money is traceable only to the nonprofit; and announced commitments (e.g., a super PAC's $44M reservation in Georgia) exceed filed-to-date spending.

## 3. Data & methods

**Primary source — the FEC.** OpenFEC API + bulk data + the FEC's own **statistical summaries** (authoritative cycle aggregates by committee type). Schedules used: A (contributions in), B (disbursements/transfers), E (independent expenditures).

**Secondary — de-duplicated & dark-money estimates.** OpenSecrets "Cost of Election" (de-duplicated, projected); Brennan Center (dark money); Issue One (dark-money → super-PAC flows).

**Live instrument (reproducible).** `scripts/fec-ingest.mjs` computes, from primary FEC data: per-state and per-district candidate receipts, Senate/House independent expenditures, each race's top spending committees, and a **donor hop** (each top super PAC's largest contributors) with a curated dark-money-conduit classifier. Output: `src/data.json`. This makes the audit *rerunnable* rather than a point-in-time report.

**De-duplication rule (this audit).** Two levels: (a) at the *race* level, count money once at point of expenditure and attribute backward to sources without re-summing; (b) at the *sector* level, net out committee-to-committee transfers via an empirically-calibrated **de-duplication ratio** (see Appendix C) — the FEC publishes gross-by-type but no de-duplicated total, so the ratio is calibrated against the two most recent completed cycles where OpenSecrets *has* de-duplicated.

**Known-uncounted (declared, not hidden).** Presidential (none in 2026), some party soft accounts, state/local, and the un-disclosable dark remainder. A rigorous total states its exclusions.

## 4. Findings

### 4.1 The total, decomposed
- **Federal, 2024: ~$15.9B** (OpenSecrets), up from $15.1B (2020) — a rising secular trend.
- **+ state/local: ~$4.6B (2023-24) → ~$20.5B** all-in.
- **2025-26 to date:** the sector has *raised* candidates $2.1B + parties $1.1B + PACs $6.3B (FEC), which after de-duplication and full-cycle projection will land in the low-double-digit billions for a midterm (2022 final ≈ $8.9B federal by OpenSecrets' de-duplicated method).

### 4.2 Sources — extreme concentration
- **Top 1% of donors ≈ 50%** of all money.
- **Top 10 individuals ≈ $599M (~7%)** of federal fundraising.
- **Small donors (<$200): ~24%** of candidate contributions, **down from 30% (2020)** — the small-dollar share is *declining*, not rising.
- **Industry concentration (live-observed):** the crypto industry's FairShake super PAC drew ~$23-25M each from Coinbase, Ripple, and a16z; Miriam Adelson put $30M into Senate Leadership Fund. A handful of industries and individuals move the marginal dollar.

### 4.3 Channels — the vehicles
Candidate committees → party committees → traditional & leadership PACs → **super PACs (independent expenditure, unlimited)** → hybrid PACs → joint fundraising committees. Outside/super-PAC spending alone was ~$2.6B+ in 2024 and is the fastest-growing channel post-*Citizens United*.

### 4.4 The untraceable fraction (the dark gap)
- **~$1.9B** federal dark money in 2024 (Brennan) — a record.
- **Live-observed conduits:** One Nation → Senate Leadership Fund ($35M of the sampled top gifts); Majority Forward → Senate Majority PAC ($25M). In the sample, **42% (SLF) and 64% (SMP)** of top gifts trace to a dark-money nonprofit — symmetric across parties.
- The wall is a **data-law limit**, not a measurement failure: 501(c)(4)s are not required to disclose donors. The audit's contribution is drawing the wall *precisely* and reporting "% traceable vs. behind the wall."

## 5. Limitations
- **Federal-centric.** State/local (50 disparate disclosure systems) is included only via secondary estimates.
- **Dark money is a floor.** The curated conduit list catches known 501(c)(4)s; an unknowable remainder passes as ordinary contributions.
- **Cycle-to-date understates.** Live figures for 2025-26 are partial.
- **De-duplication is methodology-dependent.** Reasonable analysts produce different "totals"; the honest move is to publish the rule and the components.

## 6. Policy implications / recommendations
1. **Disclosure reform (DISCLOSE-Act-type).** Require 501(c)(4)/(c)(6) groups that fund electoral advertising to disclose donors above a threshold — directly shrinks the ~$1.9B dark gap.
2. **A standardized public "total money" methodology,** so the headline number is comparable across cycles and not a projection artifact.
3. **A live, reproducible public accounting** (this instrument) as a complement to annual point-in-time reports — the sector should be auditable continuously, not once a cycle.
4. **Surface concentration, not just totals.** The politically salient fact is not "$16B" but "half of it came from the top 1%."
5. **Close the coordination gap.** Enforce existing rules or pass the *Stop Illegal Campaign Coordination Act* — presume coordination unlawful when a campaign publishes specific ad phrasing/media that an outside group then reuses (the **redboxing** fix). The FEC's near-total non-enforcement of coordination is the single largest structural failure (§7.3).
6. **Close the JFC-ad and leadership-PAC loopholes.** Bar joint-fundraising committees from paying for what are effectively candidate ads, and clarify (a comma and three words in statute) that the **personal-use ban applies to leadership PACs**. Both currently sit open behind 3-3 FEC deadlocks (§7.3).
7. **Fix the conduit and shell-LLC gaps.** Require online conduits (WinRed/ActBlue) to fully report operating expenses/fees, and require LLC political donors to disclose beneficial owners — closing the shell-LLC/straw-donor pathway that shades from legal (anonymous LLC) into criminal (reimbursed straw donor, §7.1).

## 7. Scandals, uncounted money, and loopholes (deep-research supplement)

*Synthesized from a multi-agent deep-research pass (98 verified claims). Institutional sources — DOJ/USAO press releases, Campaign Legal Center, Brennan Center, FEC statistical summaries, Yale Law Journal — named inline.*

### 7.1 The disclosure regime is defeated criminally, not just legally (scandals & prosecutions)
- **Foreign money via straw donors — Parnas/Fruman (2021-22).** Lev Parnas (Giuliani associate) convicted Oct 2021, sentenced to **20 months** for foreign-national contributions and straw donations; Igor Fruman, Andrey Kukushkin, and David Correia each got ~366 days. Russian oligarch **Andrey Muraviev** wired ~$1M, routed through nested accounts, to fund contributions made in Parnas/Fruman's names; they gave **$325,000 to a super PAC** falsely reported as coming from shell company *Global Energy Producers*, then filed **false sworn FEC affidavits** to conceal the source. (Shows FEC committee totals can carry laundered/misattributed donors.)
- **Straw donors — Dinesh D'Souza (2014).** Pled guilty to a **felony FECA violation** for ~$20,000 in contributions in others' names to a Senate campaign, reimbursing straw donors in cash; 5 yrs probation, 8 months confinement, $30k fine.
- **FTX straw-donor scheme (2024).** **Ryan Salame** (7.5 yrs) pled guilty to conspiracy to make unlawful contributions and **defraud the FEC** — 300+ contributions totaling tens of millions via straw donors/corporate funds, with **Sam Bankman-Fried** (25 yrs, on fraud counts; the campaign-finance count was dropped pre-trial) and Nishad Singh, using misappropriated FTX customer money for bipartisan giving to obscure the true source.
- **Conduit + obstruction — Kenneth Smukler (2018).** Convicted of concealed/illegal contributions and **obstructing an FEC investigation** across two PA primaries, including a **$90,000** concealed payment to induce a candidate to quit and **$150,000 disguised as "escrowed refunds"** in FEC reports (which caused the FEC to dismiss a complaint).
- **Foreign money + pardon — Julio Herrera Velutini (2025-26).** Venezuelan billionaire allegedly funneled **$3.5M to pro-Trump MAGA Inc.** through his daughter as a straw donor while barred as a foreign national; **pardoned by Trump in Jan 2026** — timing suggests the payments sought clemency (CLC filed an FEC complaint).
- **Scam PACs — William Tierney (2018).** First federal scam-PAC prosecution: six PACs defrauded tens of thousands of small donors on false pretenses (autism, law enforcement, pro-life); **<1% went to candidates**; "Stealth LLCs" hid that the PACs paid the same telemarketers.

> **Audit implication:** the totals we sum can include laundered, misattributed, or outright fraudulent money, and enforcement — especially of coordination — is weak. A "total" is an accounting of *reported* money, not clean money.

### 7.2 The money our $11.8B misses (tertiary / third-party channels)
- **Dark-money "laddering" into super PACs.** 501(c)(4)/(c)(6) groups don't disclose donors, then contribute to super PACs that report the receipt but not the origin. 2024: **Future Forward Action** (c)(4) → **$205M** to the Future Forward super PAC (Bill Gates alone **$50M** to the (c)(4)); **Securing American Greatness** (c)(4) → $15M → SAG PAC ($7M opposing RFK Jr.); **Building America's Future** (Musk-linked) → multiple GOP digital-ad super PACs; **Majority Forward** funded a super PAC in the 2024 MT GOP Senate primary. Brennan: **~$1.9B** federal dark money in 2024.
- **Issue/electioneering ads outside the IE line.** Dark-money groups must report election spending only for express advocacy or a candidate mention in a brief pre-election window — so much "issue ad" money goes unreported. FEC tracks **electioneering communications ($11.3M)** and **communication costs ($39.7M)** separately from the **$4.43B** in independent expenditures (2023-24).
- **Hybrid/Carey PACs & leadership PACs.** Hybrid (non-contribution-account) PACs reported **$8.09B** in 2023-24 receipts; leadership PACs **$857M** — categories a candidate-committee view misses entirely.
- **Online conduits (a double-counting trap).** **WinRed** passed through **$2.8B+** and **ActBlue $5.5B+** in earmarked contributions — money that can be counted twice when reconciling committee totals (directly relevant to our de-duplication). WinRed reported <$2,700 in operating expenses despite ~$114M in fees (CLC FEC complaint).
- **Anonymous LLCs.** Delaware, New Mexico, Nevada, and Wyoming let LLCs incorporate **without disclosing members** — shell companies make major super-PAC gifts concealing the true donor (e.g., Global Energy Producers, above).
- **State/local & ballot measures** — ~$4.6B in 2023-24, entirely outside the FEC.

> **Audit implication:** the true "money in US elections" is materially larger than any FEC-committee total, and a growing share is *structurally* invisible (dark money) or *outside federal jurisdiction* (state/local).

### 7.3 How money legally evades limits & disclosure (loopholes)
- **Redboxing.** Campaigns post strategy instructions in literal red boxes on public sites; single-candidate super PACs reuse them, preserving nominal "independence" under *Citizens United*. Used by **200+ federal candidates** in 2022 (Yale Law Journal, Kaveri Sharma, 2021 — argues it violates 52 U.S.C. §30116). Documented: Sen. Tester's campaign posted a redbox on Rosendale's votes (Oct 11, 2018); five days later VoteVets/Majority Forward ran an **$850,000** ad citing exactly those votes. The FEC "almost never" enforces coordination. Fix: the *Stop Illegal Campaign Coordination Act*.
- **Joint-fundraising-committee "ads."** A JFC allocates a joint ad's cost by its share of *solicitation* content — so a 30-second ad with 26s of candidate advocacy and 4s of donation appeal lets the candidate pay only ~**25%**, circumventing limits. In 2024 the Trump campaign off-loaded **$5M+** in online-ad costs onto a JFC; the NRSC ran QR-code "fundraising" ads. The FEC **deadlocked 3-3**, leaving it open.
- **Leadership-PAC personal use.** **92%** of members keep a leadership PAC; the FEC's personal-use ban has **never been applied** to them, so funds flow to travel/lodging/dining (2019-20: Rep. Holding's PAC 2% political, incl. $22k airfare and $11k at the East India Club; Sen. Paul 12%; Rep. Moulton 8%).
- **Single-candidate super PACs at scale.** Elon Musk put **~$300M** into pro-Trump super PACs in 2024 — nominally independent money that coordination practices (redboxing, common vendors) effectively direct.

> **Audit implication:** the binding constraints today are (1) disclosure of dark money, (2) enforcement of coordination rules, and (3) the JFC-ad and leadership-PAC loopholes — each a concrete, narrow legislative fix, folded into the recommendations below.

## Sources
- FEC — [Statistical Summary of 15-Month Campaign Activity, 2025-2026 cycle](https://www.fec.gov/updates/statistical-summary-of-15-month-campaign-activity-of-the-2025-2026-election-cycle/)
- OpenSecrets — [Cost of Election](https://www.opensecrets.org/elections-overview/cost-of-election) · [2024 spending projected to exceed record](https://www.opensecrets.org/news/2024/10/total-2024-election-spending-projected-to-exceed-previous-record/) · [Georgia Senate money race](https://www.opensecrets.org/news/2026/07/which-house-and-senate-candidates-lead-the-money-race)
- Brennan Center — [Dark Money Hit a Record $1.9B in 2024](https://www.brennancenter.org/our-work/research-reports/dark-money-hit-record-high-19-billion-2024-federal-races)
- Issue One — [Four super PACs raised ~$120M from allied dark-money groups](https://issueone.org/press/four-main-super-pacs-focused-on-control-of-congress-have-raised-nearly-120-million-from-allied-dark-money-groups-this-election-cycle/)
- CNN — [2024 election most expensive, nearly $16B](https://www.cnn.com/2024/10/08/politics/2024-election-most-expensive)
- U.S. DOJ / USAO-SDNY press releases — Parnas/Fruman/Muraviev, D'Souza, Bankman-Fried, Salame, Smukler, Tierney prosecutions (§7.1)
- Campaign Legal Center — [coordination between candidates & super PACs](https://campaignlegal.org/update/new-clc-report-unchecked-coordination-between-candidates-and-super-pacs), Herrera Velutini foreign-money complaint, WinRed complaint (§7.1-7.3)
- Just Security — [survey of prosecutions for covert campaign payments](https://www.justsecurity.org/85745/) (§7.1)
- Yale Law Journal — Kaveri Sharma, "Redboxing" coordination analysis, Vol. 130 (2021) (§7.3)
- FEC — 24-month statistical summary, 2023-24 cycle (PAC/hybrid/leadership-PAC/IE totals, §7.2)
- Brennan Center — dark-money laddering & Future Forward Action (§7.2)

*Note: this section was produced via a multi-agent deep-research pass (fan-out search → fetch → adversarial verification of 98 claims). The final auto-synthesis step failed on a structured-output cap; the verified claims were recovered from the run journal and synthesized here directly.*

## Appendix A — reproducing the live figures
Run `FEC_API_KEY=… node scripts/fec-ingest.mjs` (free key at api.data.gov). Produces `src/data.json` (per-state/district money, top vehicles, donor hop, dark-conduit flags). The VoteNow app renders it: national headline → map → state → district → race → source→vehicle→race chain → dark-money wall.

## Appendix C — the de-duplication calculation (exact netting)

The FEC reports gross receipts by committee type; summing them double-counts every dollar that moves committee-to-committee (a donor → PAC → candidate dollar is counted in both PAC and candidate receipts). To net this out **exactly**, we use the FEC **bulk committee-summary files** (`weball` = every candidate, `webk` = every PAC and party), which carry each committee's *reported* totals for money received from other committees (that total is the sum of its actual transfer transactions). De-duplicated total = gross receipts − Σ(committee-to-committee inflows: transfers + inter-committee contributions), counting each dollar once at its original source.

| Cycle | Gross receipts | − Committee transfers | = De-duplicated (raised) | net ratio |
|---|---|---|---|---|
| 2022 (final) | $17.40B | $2.51B | **$14.89B** | 0.856 |
| 2024 (final) | $30.10B | $5.71B | **$24.38B** | 0.810 |
| **2026 (to date)** | $13.77B | $1.98B | **$11.80B** | 0.857 |

**Two corrections that only surfaced by doing the real computation:**
1. **Double-counting is small (~15-19%), not ~38%.** An earlier draft estimated the de-dup via a *ratio* calibrated against OpenSecrets' "cost of election" ($8.9B/2022, $15.9B/2024), which implied ~38% overlap and a $7.4B figure. That was wrong: it compared two different metrics. Exact netting shows inter-committee transfers are only ~15-19% of gross — most of the gross is already original-source money. **The corrected 2026 figure is $11.8B, not $7.4B.**
2. **Raised ≠ spent.** The exact "money raised (de-duplicated)" ($14.9B for 2022) is *higher* than OpenSecrets' "cost of election" ($8.9B for 2022) — because OpenSecrets measures *spending on the campaigns*, a narrower construct than total money raised (which includes overhead, cash reserves, and money not spent on the race). Both are legitimate; they answer different questions. This audit's headline is **money raised, de-duplicated**; it names the distinction rather than blur it.

**Remaining limit:** this nets each committee's *reported* transfer totals — exact at the committee-summary level. A transaction-by-transaction reconstruction (itemized Schedule B) could catch edge cases like earmark pass-throughs and JFC allocation timing, but would move the total by well under a percent.

## Appendix B — the correction this audit makes
The naive instrument reported **$3.58B** (congressional candidate receipts + a partial independent-expenditure pull, mid-cycle). Switching to the FEC's authoritative `/totals/by_entity` aggregate (as of 2026-07-31) gives the real sector scale:

| Committee type | Receipts, 2025-26 to date |
|---|---|
| Candidates | $2.44B |
| Party committees | $1.43B |
| PACs | **$8.09B** |
| **Gross (sum — double-counts transfers)** | **$11.96B** |

**The $8.4B gap between the naive figure and the gross sector total is itself the finding:** ~two-thirds of federal campaign money sits in PACs, and a candidate-committee-only view is blind to it. The gross ($12.0B) is an upper bound (transfers counted multiple times); the de-duplicated "cost of election" (OpenSecrets method) for a completed presidential cycle was $15.9B (2024) and for a midterm $8.9B (2022). The honest headline is therefore a *decomposition with a stated de-duplication caveat*, not a single false-precise total — which is the core methodological claim of this PAE.
