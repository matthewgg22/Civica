# LA cluster launch — Los Angeles County

**Built 2026-08-22.** Supersedes the Miami-first sequencing, which rested on a county ranking that
had silently dropped California.

**Los Angeles County: 796,577 eligible-unenrolled persons — #1 in the country**, 60% larger than
Harris TX. Pool potential **$105,000**, against Miami-Dade's $40,000.

---

## Component ratings re-sorted this cluster too, and dropped a bank

| Bank | Overall | Lending | Investment | Service | Ask |
|---|---|---|---|---|---|
| **Hanmi Bank** | Satisfactory | Low Sat | **LOW SATISFACTORY** | High Sat | **$25,000** |
| **City National** | **Needs to Improve** | High Sat | **Outstanding** | **Low Satisfactory** | **$75,000** |
| **Mega Bank** | **Needs to Improve** | **NTI** | — | — *(CD Test **Satisfactory**)* | **$5,000** |
| ~~American Business Bank~~ | Satisfactory | High Sat | High Sat | High Sat | **drop** |

**American Business Bank is High Satisfactory on all three tests.** No documented gap in any test our
activity feeds. Same call as Stock Yards, First National Bank Texas and Inwood — a grant fixes
nothing they need fixed. Removing $25,000 of nominal pipeline that was never real.

---

## 1. Hanmi Bank — $25,000 — ask first

The cleanest target in the cluster. Their Investment Test is rated **Low Satisfactory**, and the
evaluation's own explanation is that *"HB's adequate level of qualified CD investments and grants
primarily support this rating"* — adequate, and no more, in the exact test a grant is scored under.

And **Los Angeles is their richest assessment area**: $281,080 across 14 donations, an average of
$20,077 — so a $25,000 ask sits inside what they already give here, while Dallas ($20,500 across 5)
and Houston ($13,000 across 4) would each have supported roughly $5,000. This is the per-AA
re-baseline paying off: the ask went *up* because we read the right assessment area.

---

## 2. City National — $75,000 — and the thing we must not say

Their NTI is **not** a community development failure. The evaluation rates Lending High Satisfactory
and **Investment Outstanding**; the overall Needs to Improve follows from a *Discriminatory or Other
Illegal Credit Practices* review — a fair-lending downgrade.

**So a grant cannot fix City National's rating, and no material may imply it can.** This is the same
bright line already applied to Helm and Mega, and it matters more here because the ask is the largest
in the project.

What is true and sufficient: their **Service Test is Low Satisfactory** — community development
services are exactly what that test scores — and their **$31M DOJ consent order names
majority-Black/Hispanic Los Angeles County census tracts**, with community-investment line items that
must be spent in that geography. The door is the consent order's outreach and partnership budget, not
the CRA rating.

They also give at a scale that supports the ask: **$13.2M in qualifying grants and donations to
roughly 359 organisations**, averaging $36,769 — so $75,000 is about two of their typical grants.

---

## 3. Mega Bank — $5,000 — join the programme

Current NTI (5/2025), but again driven by the **Lending Test**, with the **Community Development Test
rated Satisfactory**. Pitch participation and cost-sharing in a running county programme, never
remediation. Their disclosed giving is 11 CD donations totalling $46,300 — an average of $4,209 — so
$5,000 is one typical donation.

---

## Pooled economics

$25,000 + $75,000 + $5,000 = **$105,000** in one county.
Shares: City National **71%**, Hanmi **24%**, Mega **5%**.

Sequence the asks, not the pool. **Hanmi first** — cleanest documented gap, ask inside their
demonstrated LA giving, and a yes creates the programme City National and Mega are then invited to
join. City National is the largest cheque but the most complex conversation, and it is easier to walk
into once something is already running in their consent-order geography.

---

## Blockers

1. **CA Form CT-1 registration, $50, unfiled** — legally gates California solicitation. Cheaper and
   simpler than Florida's FDACS filing. **This is the critical path.**
2. **City National and Mega Bank are not in `assessment_areas.json`** and cannot be generated yet.
   City National is a ~$100B multi-AA institution — its Los Angeles assessment-area delineation must
   be read from the PE before anything is produced. Do not infer it.
3. **Hanmi is `verified: false`** — `--send` refuses until its AA is confirmed.
4. Meta ad-category placement unconfirmed; LA County at ~4,058 sq mi absorbs a 15-mile radius.

## Constraints that travel

- **California figures are MODELED**, not survey-weighted like the other twelve states. A bank
  scrutinising 796,577 is scrutinising a model output. Footprint-level, never tract-level.
- Neither City National nor Mega Bank can have their rating repaired by this grant, and the materials
  must not imply otherwise.
