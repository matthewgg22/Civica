# Bank PE mining — FDIC pass, and the per-assessment-area correction

**Done:** 2026-08-22. 31 banks authoritatively identified; **17 FDIC evaluations mined**.
**Data:** [`fdic_pe_scan_2026.csv`](../../data-ops/analysis/bank-pe-mining/fdic_pe_scan_2026.csv)
**Supersedes ask figures in:** the Band B/C/E tables of
[cra-targets-national-2026-08-22.md](cra-targets-national-2026-08-22.md)

Two things came out of this: the ask figures move, and **several of the highest-ranked targets turn
out to have no gap at all.**

---

## 1. The CRAPES API — the retrieval problem, solved for FDIC banks

FDIC's CRA rating search is an Angular app with no documented API. The backing call is:

```
POST https://crapes.fdic.gov/api/getSearchResults
{"release":"2005-1-1:2026-12-31","cert":"16068"}
```

It returns, per examination: overall rating, **component ratings (Lending / Investment / Service)**,
asset size at exam, exam procedure, and `SYS_EXTRN_FILE_ID` — the PE path, fetchable at
`https://crapes.fdic.gov/publish/{FILE_ID}`. Both endpoints accept ordinary curl; no WAF.

**Component ratings without opening a PDF** is the valuable part. As in Massachusetts, the public
overall rating hides the gap that matters.

**Identification discipline:** every bank was resolved through FDIC BankFind (`banks.data.fdic.gov`)
and then **name-validated**, because the `search` endpoint does relevance matching and returns
plausible wrong answers. It proposed *Barnett Bank of Central Florida* for "Winter Park National" and
*Texas Commerce Bank-Austin* for "Austin Capital Bank" — the same failure that earlier produced
*T Bank* when I searched for Texas Capital. **Two of 33 were rejected on name mismatch.** Never accept
a search result for an institution identity.

---

## 2. Several top-ranked targets have no gap

| Bank | Overall | Lending | Investment | Service | Verdict |
|---|---|---|---|---|---|
| **Stock Yards Bank & Trust** | Outstanding | Outstanding | Outstanding | High Sat | **Deprioritise** |
| **Israel Discount Bank of NY** | Outstanding | — | — | — | **Deprioritise** |
| **Texas Capital Bank** | Satisfactory | High Sat | High Sat | **Outstanding** | Low pressure |
| **International Bank of Commerce** | Satisfactory | High Sat | **Outstanding** | High Sat | Low pressure |
| **Provident Bank** | Satisfactory | High Sat | **Outstanding** | High Sat | Low pressure *(despite consent order)* |
| **ESSA Bank & Trust** | Satisfactory | High Sat | High Sat | High Sat | Low pressure *(despite consent order)* |

Six of seventeen. Stock Yards was Band C's #4 and is Outstanding on every test.

**Two Band E consent-order banks — Provident and ESSA — are strong performers.** That is the second
independent reason to deprioritise consent-order targets: the money is administered on a fixed
schedule *and* they have no CRA weakness to fix.

### Where the real gaps are

| Bank | The documented gap |
|---|---|
| **Apple Bank** ($19.2B) | **Investment Test: Low Satisfactory** — the test where a grant counts |
| **City Bank Lubbock** ($4.6B) | **Low Satisfactory on all three tests** |
| **Northfield Bank** ($5.7B) | **Investment Test: Needs to Improve** ⚠️ evaluation dated 2007 — confirm a newer exam |
| **FirstBank Nashville** ($16.4B) | Component ratings read **Substantial Noncompliance** on Lending *and* Service beneath an overall Satisfactory ⚠️ **verify before use** — that combination is anomalous |
| Mega · Sonata · Berkshire · Zenith · Oakwood | Current NTI |
| Pearland State | Substantial Noncompliance |

**The Berkshire Bank is now NTI as of 8/2026** — newer than the 12/2024 rating in our target list.

---

## 3. Disclosed giving — the asks come down again

| Bank | Disclosed CD giving | Avg donation | Prior ask | **Revised** |
|---|---|---|---|---|
| Northfield | $396,372 across 29 | **$13,668** | — | **$20,000** |
| Provident | $868,000/60 · $422,000/44 · $3,000 | ~$9,600 | $100,000 | **$20,000** |
| City Bank Lubbock | $927,385 across 199 | $4,660 | $25,000 | **$10,000** |
| IBC | $1.2M across 279 (Laredo) | $4,301 | $50,000 | **$10,000** |
| Oakwood | $60,000 across 14 | $4,286 | $10,000 | **$5,000** |
| Mega Bank | $46,300 across 11 | $4,209 | $7,500 | **$5,000** |
| ESSA | $335,905 across 100 | $3,359 | $35,000 | **$7,500** |
| Stock Yards | $150,000 across 3 | $50,000 | $40,000 | deprioritised |
| FirstBank | donations of $126,000 | — | $50,000 | **$10,000** |

**Typical bank community development donation is $3,300–$14,000.** Stock Yards, which makes very
large single gifts, is the exception that proves the rule — and is the one target we should not
pursue.

The Band C and E asks were mostly **3–5× too high**, the same error the Helm correction caught.

---

## 4. The per-assessment-area rule is now confirmed three times

Woodforest showed it first: **$17.8M in grants in the Houston CSA, $86,614 in Dallas.** This pass
found the same pattern twice more, at different scales:

- **Oakwood Bank** — $60,000 total, of which **$57,000 in the Dallas MSA AA and $3,000 in the Texas
  Non-MSA AA**; the evaluation states the Dallas AA accounted for **95.0 percent**.
- **Provident Bank** — three assessment areas at **$868,000 / $422,000 / $3,000**.

**One ask per bank is structurally wrong.** `assessment_areas.json` carries a single `ask_usd`, so
every multi-AA target is mispriced — high in the bank's minor AA, low in its major one. The right
anchor is *that assessment area's* disclosed giving, not the institution's.

**Not yet fixed.** Band A's eight banks need their PEs re-read per AA before their asks are trusted.
That is the immediate next task and it is bounded — eight documents, all already located.

---

## 5. What remains unmined

**14 of 31 are OCC- or Fed-supervised** and absent from CRAPES, which covers only FDIC-supervised
institutions: City National, First National Bank Texas, Inwood National, Susser, Woodforest *(already
mined separately)*, First National Bank of Pennsylvania, Farmers National Bank of Danville, Maspeth
Federal, Florida Capital, Dallas Capital, Interamerican, Terrabank, Generations, OceanFirst.

OCC evaluations live at `occ.gov/static/cra/craeval/{mon}{yy}/{charter}.pdf` and curl fine — the
blocker is charter-number lookup, which needs the same authoritative discipline used here rather than
a search engine. Federal Reserve evaluations are at `federalreserve.gov/apps/CRAPubWeb/`.

**Also unresolved:** the FirstBank Nashville component ratings. An overall Satisfactory sitting above
two Substantial Noncompliance component ratings is anomalous enough that I would read the PE text
before putting it in front of anyone.
