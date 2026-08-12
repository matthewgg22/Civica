# South Dakota pack — provenance

**Created:** 2026-08-12. South Dakota is a genuine BLANK SLATE in this roster — like Nebraska's,
Connecticut's, Utah's, Iowa's, Arkansas's, Mississippi's, Kansas's, New Mexico's, and New
Hampshire's prior builds, South Dakota has NO existing `packages/snap-rules` entry and NO oracle
fixture coverage at all. No discrepancy-checking against an existing engine constant was possible
or attempted; this pack's findings stand entirely on its own primary-source research. This task's
scope was CORPUS ONLY — the Demeter chatbot's Q&A content layer — and does not touch
`packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay fully
parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

South Dakota was built as one of a five-agent parallel batch (RI, MT, DE, SD, ND), each on its own
branch, in the same window.

## Method

`dss.sd.gov` returned a clean, consistent HTTP 200 to every direct curl attempt this pack made,
with a standard desktop browser User-Agent — genuinely NO WAF/bot-detection barrier, unlike
several other states this roster has built (e.g. New Hampshire's 403 wall). This pack's only
friction was navigational: a guessed short-form URL (`dss.sd.gov/economicassistance/snap/`)
returned a 404, resolved immediately via WebSearch, which surfaced both the correct consumer page
(`dss.sd.gov/economicassistance/snap.aspx`) and, critically, a direct link to South Dakota DSS's
own SNAP Policy and Procedure Manual PDF (`dss.sd.gov/docs/economicassistance/snap/snapmanual.pdf`,
2.7MB, 249 pages, dated "Updated July 2026" on its own cover page). This pack fetched that PDF
directly and extracted its text with `pdftotext -layout` (17,261 lines) rather than a
markdown-converting fetch tool, specifically to preserve the manual's numbered-section structure
(e.g. `9010`, `13222`) and multi-column example tables without mangling. The ONE genuine access
barrier this pack hit was a secondary source: `law.justia.com` served an unresolvable Cloudflare
JS-challenge wall when this pack attempted to independently verify South Dakota Codified Law
28-12-3's statutory text; this pack substituted a WebFetch-summarized quote of the same statute
from a different secondary source (Collateral Consequences Resource Center's national
SNAP/TANF drug-felony survey) instead, flagged explicitly in `freshness.json` as not independently
verified against South Dakota's own legislative text.

## Finding 1 (flagship, structural) — South Dakota does NOT run Broad-Based Categorical
Eligibility (BBCE)

DSS's own manual §7700 defines categorical eligibility narrowly — TANF, Tribal TANF, SSI, or Child
Care Services recipients only — with no income-ceiling expansion the way BBCE states run. §11300
states directly that non-categorically-eligible households face the standard 130% FPG gross / 100%
FPG net income test. This pack cross-checked this against WebSearch corroboration naming South
Dakota among a small group of states nationally (six or seven, depending on the source) that have
not adopted BBCE — this pack confirms South Dakota's own status directly from its own manual
rather than relying on the secondary-source list alone, and did not independently re-verify every
other named state.

## Finding 2 (flagship, correction of a stale, still-repeated secondary-source figure) — South
Dakota's CURRENT resource limits are $4,500/$3,000, not the $2,750/$4,250 several current
aggregator sites still quote

DSS's manual §9010 (from a manual dated "Updated July 2026") gives $4,500 (elderly/disabled) and
$3,000 (all other households) — matching the current national FFY2026 cycle this roster's other
current-cycle states have independently confirmed. Multiple secondary/aggregator sources this pack
found during research quote $2,750/$4,250 instead — figures consistent with an earlier FFY cycle
(likely FFY2023) that those sites have not updated. This pack flags this explicitly as the kind of
stale-secondary-source trap this build was specifically asked to watch for.

## Finding 3 (flagship, primary-source-adjacent confirmation of a minority-position claim) —
South Dakota FULLY opted out of the federal drug-felony SNAP ban

This pack read the DSS manual's entire felon-related disqualification content closely and found
only ONE felony-conviction disqualification category: §3920/§7370, which applies exclusively to the
2014 Farm Bill's violent/sex-offense list (aggravated sexual abuse, murder, child sexual
exploitation, sexual assault) for convictions after 2/7/2014 — NOT a drug-felony provision. This
pack cross-checked that silence against South Dakota Codified Law 28-12-3, quoted by a secondary
legal-research source (Collateral Consequences Resource Center) as South Dakota's 2020 statutory
opt-out of Pub. L. 104-193 § 115(a)(2) (the federal drug-felony ban). This pack treats the finding
as genuinely confirmed by two independent lines of evidence (the manual's complete silence on any
drug-felony provision, plus the secondary source's direct statutory quote) but flags the statutory
text itself as secondary-source-only, since this pack could not independently fetch it from South
Dakota's own Legislature site or from Justia (both inaccessible to this pack's fetch methods).

## Finding 4 — South Dakota's manual explicitly names a STATEWIDE Native American ABAWD
exemption, and separately documents FDPIR/SNAP mutual exclusivity — this build's specific
tribal-land research question, answered directly

§13222 states plainly that "individuals who are Native American who live anywhere in the state are
exempt from ABAWD time limits" — the manual's own wording explicitly generalizes beyond
reservation residency, and ACCESS codes the exemption as "I – Native American living in any
county in South Dakota." Separately, §§3902, 5026, and 6385-6387 establish that an individual may
not receive SNAP and FDPIR (Food Distribution Program on Indian Reservations) commodities in the
same month, with a documented battered-women's-shelter exception and an FDPIR IPV carryover
disqualification rule that also affects the SNAP resource-limit exception list. This pack found
this treatment to be a genuine, specific engagement with FDPIR/tribal interaction — not a topic
South Dakota's manual is silent on — though this pack did NOT find reservation-specific
administrative detail (e.g. a specific note about Pine Ridge, Rosebud, Standing Rock, or any of
South Dakota's other reservations) beyond these general statewide rules, and discloses that
negative result explicitly per this build's instruction to disclose either finding honestly.

## Finding 5 — an internal DSS-manual inconsistency this pack caught and disclosed: Table of
Contents utility figures contradict the manual's own (twice-repeated) body text

The manual's Table of Contents (PDF page 9) lists SUA $850/LUA $238/OUA $98/PUA $54, while the
body text (§§10400 and 10411, worded identically in both places) gives SUA $950/LUA $265/OUA
$109/PUA $60. This pack treats the twice-repeated body-text figures as authoritative — a stale,
unrevised Table of Contents entry is a more plausible explanation than the body text being wrong
identically in two separate sections — but flags this explicitly in `freshness.json` rather than
silently picking one number without disclosure, since this pack could not confirm which figure
DSS's live eaPortal system actually applies.

## Finding 6 — South Dakota does NOT operate a Restaurant Meals Program; a 2022 legislative
attempt (SB 149) failed in the state Senate

This pack found no RMP language anywhere in the current DSS manual and corroborated via WebSearch
that South Dakota Senate Bill 149 (2022), which would have established an RMP for elderly,
disabled, and homeless South Dakotans, failed in the state Senate 12-23 and was never enacted.
This pack flags this explicitly because news coverage of the bill's 2022 introduction, read in
isolation, could mislead a reader into believing South Dakota has or is about to have an RMP — the
bill's actual outcome was a floor defeat.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant
existed to check against)

South Dakota has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass primary-source
finding. A future `packages/snap-rules` build for South Dakota (out of scope for this task,
requiring its own separate, explicit go-ahead per the standing park rule) should treat this pack's
citations as a starting point, not a final answer, and should specifically re-verify Finding 5's
SUA figure conflict (this pack's single manual fetch could not resolve which number the live
eaPortal system uses) and Finding 3's statutory citation (secondary-source-only) before hardcoding
South Dakota's parameters into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched South Dakota text, checking
specifically for: claims inferred from a secondary-source summary rather than the underlying
primary text; a genuinely stale secondary-source dollar figure; and any South Dakota-specific
finding overclaimed as settled when the underlying evidence was genuinely single-sourced or
internally inconsistent. Concrete catches from this pass:

- The resource-limit correction (Finding 2) does not simply repeat this pack's own manual read —
  it explicitly checked several current secondary/aggregator sites' quoted figures against the
  manual's own numbers and found a real, disclosable discrepancy (stale $2,750/$4,250 vs. current
  $4,500/$3,000), rather than assuming secondary sources were current without checking.
- The drug-felony finding (Finding 3) does not overstate its own evidentiary basis: this pack
  explicitly separates what it directly confirmed (the DSS manual's silence on any drug-felony
  provision, read directly from the primary source) from what rests on a secondary source alone
  (SDCL 28-12-3's exact statutory text, which this pack could not independently fetch), and flags
  the latter in `freshness.json` rather than presenting both with equal confidence.
- The SUA figure conflict (Finding 5) is the most consequential catch in this pack: an early draft
  pass, before this pack noticed the Table of Contents entry disagreed with the body text, could
  have picked either number without disclosing the conflict at all. This pack instead surfaces the
  conflict explicitly, explains its reasoning for preferring the body text, and flags the
  uncertainty rather than presenting a single confident number.
- The FDPIR/tribal-land finding (Finding 4) discloses a genuine negative result (no
  reservation-specific administrative detail found) rather than letting the positive finding (the
  general FDPIR-interaction rules and the statewide Native American ABAWD exemption) imply more
  completeness than this pack's research actually achieved.
- The Restaurant Meals Program finding does not merely cite absence-of-mention in the manual — it
  actively investigated why South Dakota's RMP search results are noisy (the 2022 SB 149 bill) and
  disclosed the bill's actual failed outcome rather than leaving the ambiguous search results
  unresolved.
- The BBCE finding (Finding 1) is grounded in a direct read of §7700 and §11300's own text, not
  merely repeated from a secondary source's "no BBCE" framing — this pack states explicitly that
  it did not independently re-verify every other state in the secondary sources' comparison list.

## Sources

| Source | Access | Dated |
|---|---|---|
| South Dakota DSS, SNAP Policy and Procedure Manual (full PDF) | direct curl fetch (browser UA) + `pdftotext -layout` | cover page states "Updated July 2026"; Standard Deduction effective 10/1/2025; fetched 2026-08-12 |
| South Dakota DSS, SNAP consumer page (dss.sd.gov/economicassistance/snap.aspx) | direct curl fetch (browser UA), clean HTTP 200 | fetched 2026-08-12 |
| South Dakota DSS-EA-301 Economic Assistance Application (11/25) | WebSearch corroboration only, not independently fetched in full | revised 11/25 |
| USDA FNS/FNA, ABAWD Time Limit Waivers FY 2025-2029 index | direct curl fetch (browser UA), clean HTTP 200 | fetched 2026-08-12; page states "Page updated: July 22, 2026" |
| Collateral Consequences Resource Center, national SNAP/TANF drug-felony-ban survey | WebFetch (secondary source, quotes SDCL 28-12-3 directly) | not independently cross-checked against sdlegislature.gov (JS-rendered, no plain text) or Justia (Cloudflare-blocked) |
| WebSearch corroboration only (SD's non-BBCE status among a small named group of states; SB 149's 2022 Senate failure 12-23; USDA ABAWD waiver-status framing) | WebSearch, not independently fetched | see freshness.json for specific disclosed gaps |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (SD guide questions), `eval/answer-eval.ts` (SD_GOLD, spread into
ALL_GOLD). South Dakota is deliberately NOT added to any `engine-citations.ts` per-state constant
map — South Dakota has no `packages/snap-rules` `StatePolicy` entry at all to mirror.
`formatEngineParams("SD", ...)` will throw `UnknownStateError` until a future, separately-gated
`packages/snap-rules` build adds a South Dakota policy — this matches the precedent already set by
Nebraska's, North Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's,
Maryland's, Colorado's, South Carolina's, Alabama's, Louisiana's, Kentucky's, Oklahoma's,
Connecticut's, Utah's, Iowa's, Arkansas's, Mississippi's, Kansas's, New Mexico's, and New
Hampshire's corpus packs in this same roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future South Dakota `packages/snap-rules` build is out of scope here and would need its
own separate, explicit go-ahead.

**Five-agent parallel batch:** South Dakota was built in parallel with Rhode Island (RI), Montana
(MT), Delaware (DE), and North Dakota (ND) — five separate agents in the same window, each on its
own branch (`feat/demeter-sd-corpus` for this one). All five states register in the same four
shared files (`states/index.ts`, `packs.ts`, `apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`)
and therefore all five PRs are expected to conflict with each other on merge. The rule to follow
when resolving that conflict is to always COMBINE every state's additions (StateCode union members,
REGISTRY entries, QUESTIONS entries, and `_GOLD` arrays spread into the aggregate export), never to
drop another state's entry to resolve a conflict — matching the precedent this roster's prior
same-window batch tiers (Mississippi/Kansas/New Mexico/Nebraska; Florida/Massachusetts/Nevada/
Arizona; Idaho/West Virginia/Hawaii/New Hampshire/Maine) already set.
