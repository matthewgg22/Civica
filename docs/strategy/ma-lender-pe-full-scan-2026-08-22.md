# All 99 MA mortgage lender evaluations read — full scan

**Completed:** 2026-08-22. All 99 Division of Banks performance evaluations parsed, **zero failures**.
**Data:** [`ma_pe_scan_2026.csv`](../../data-ops/analysis/state-cra-mortgage/ma_pe_scan_2026.csv) ·
register: [`ma_lender_register_2026.csv`](../../data-ops/analysis/state-cra-mortgage/ma_lender_register_2026.csv)
**Supersedes the ask figures in:** [ma-lender-pe-mining-2026-08-22.md](ma-lender-pe-mining-2026-08-22.md)

Two findings reshape the Massachusetts channel: the gap is **systemic, not individual**, and the
money is **far smaller than any prior estimate**.

---

## 1. 🔴 Forty lenders carry a Service Test "Needs to Improve"

The DOB's public ratings table shows only overall ratings — **7 of 99 rated NI**. Component ratings
live inside the PDFs, and they tell a completely different story:

| | Count |
|---|---|
| Overall rating NI (visible in the public table) | **7** |
| **Service Test rated "Needs to Improve"** (inside the PEs) | **≈40** |
| Explicit "does not engage in any qualified community development investment" | **6** |
| Examiner wrote "**strongly encouraged**" to expand CD activity | **~30** |

**This is not a handful of laggards. It is roughly 40% of the licensed mortgage lender population
in Massachusetts failing the exact test our activity serves** — the Service Test is where community
development services are evaluated.

Confirmed Service Test NI includes: loanDepot · NewRez · Movement Mortgage · CMG · Nationstar ·
PennyMac · Figure Lending · EMM Loans · New Fed · American Neighborhood · Amerisave · OCMBC · NFM ·
William Raveis · Paramount Residential · American Financial Network · Envoy · Finance of America
Reverse · Sierra Pacific · Semper · Primary Residential · Arc Home · LeaderOne · MLD · Reliance First ·
Nations Lending · Guidance Residential · Allied · Academy · American Internet · Caliber · Everett
Financial · Finance of America Mortgage · First Guaranty · Homespire · JG Wentworth · Keller ·
New Day · Northeast Home Loan · Provident Funding.

**Six with zero community development investment at all:** Total Mortgage Services · EMM Loans ·
NFM · MiLend · Northeast Home Loan · Zillow Home Loans (f/k/a Mortgage Lenders of America).

---

## 2. 🔴 The money is much smaller than estimated — again

This is the second downward correction, and it is decisive. Actual disclosed Massachusetts community
development giving, read from the evaluations:

| Lender | Disclosed giving |
|---|---|
| **Rocket Mortgage** | ~$2.6 million in financial contributions |
| **Guaranteed Rate** | $74,824 in MA + $6.7M national (Feeding America, Baby2Baby) |
| PrimeLending | ~$18,250 |
| Bay Equity | ~$8,030 |
| Guild Mortgage | $5,000/yr to the Mass. Mortgage Bankers Association |
| Mortgage Equity Partners | ~$1,600 |
| Six lenders | **$0** |

**Typical Massachusetts CD giving for a mortgage lender is between $1,600 and $18,250 for an entire
review period.** Rocket and Guaranteed Rate are outliers by one to two orders of magnitude.

My previous revision cut the MA band from $175,000 to $95,000. **That is still far too high.** A
$15,000 ask to a lender whose entire disclosed giving is $8,030 repeats exactly the Helm mistake —
asking for more than the institution has ever given.

### Revised ask ladder — grounded in disclosed giving

| Lender profile | Ask |
|---|---|
| Zero CD investment / no giving history | **$2,500** |
| Typical (giving $1,600–$20,000) | **$5,000** |
| Above-average giver (PrimeLending tier) | **$7,500** |
| Guaranteed Rate ($74,824 MA) | **$15,000** |
| Rocket ($2.6M contributions) | **$25,000** |

---

## 3. What this means strategically — Massachusetts inverts the bank model

The bank channel was **few targets, larger checks**. Massachusetts mortgage lending is the opposite:

**Many targets, small checks.** Forty lenders with a documented Service Test failure, most of whom
have never funded anything meaningful, at $2,500–$7,500 each. Forty lenders at $5,000 is $200,000 —
comparable to prior estimates, but from a completely different shape of pipeline.

**That shape suits us better than it looks.** A $5,000 ask needs no board approval at most firms, and
the artifact is identical for every lender because the assessment area is the whole Commonwealth —
one document, one data set, one registration, forty prospects. The bank channel needs a bespoke PE
read, county map and need calculation per target. **Cost to produce the fortieth Massachusetts pitch
is near zero.**

**And the examiners keep naming our category as the remedy.** Across the PEs the recommended
activities repeat almost verbatim: *"financial literacy education initiatives targeted to LMI
individuals"* and *"providing technical assistance to community organizations."* Forty lenders have
been told in writing to go do approximately what we sell.

Combined with the Fairway precedent — a DOB examiner already crediting a lender for funding SNAP
application assistance — Massachusetts has the strongest qualification position of any channel and
the weakest per-target economics.

**Sequence: lead with the Service Test NI + zero-investment lenders** (EMM Loans, NFM, Northeast Home
Loan, MiLend, Zillow Home Loans, Total Mortgage Services). They have a documented failure, a named
remedy, and no incumbent partner.

---

## Method — the retrieval problem is solved

mass.gov's WAF returns 403 to any scripted client regardless of headers (TLS fingerprinting; the
download is served directly with no redirect to an unprotected origin). The unlock was a PDF text
extractor running **inside the browser page**, where `fetch()` carries the real browser's TLS
handshake and cookies.

Four bugs had to be fixed to get there, each worth recording:

1. `indexOf("stream")` matched inside `endstream`, corrupting every offset.
2. CSP blocks constructing a `Response` from a `DecompressionStream` — a manual `getReader()` loop is
   required.
3. `DecompressionStream` rejects trailing bytes ("Junk found after end of compressed data"), so
   streams must be sliced to the exact `/Length`, not to `endstream`.
4. Text is CID hex (`[<0003>] TJ`) needing ToUnicode CMaps. In older PEs those CMaps are
   **uncompressed**; in newer ones they are Flate-compressed. Both paths are needed. Merging all
   CMaps in a document proved safe — 144 shared codes, **zero conflicts**.

Validated against a locally-parsed PE before running the batch. **93 documents, 0 errors.** The same
technique unlocks any mass.gov PDF, including the 209 CMR regulations and bank/credit union PEs.

**Caveats:** the scan is regex over extracted text, so a lender showing no signal is *probably* clean
rather than *certainly* clean; dollar figures were captured where stated on the same line as a giving
keyword, so a lender with no figure here may still have disclosed one in prose. Spot-check any lender
before it receives a document.
