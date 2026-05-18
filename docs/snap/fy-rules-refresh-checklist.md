# SNAP FY Rules Refresh Checklist

Triggered annually by `.github/workflows/fy-rules-refresh-reminder.yml`
(fires Aug 15 each year). Walk every row before Oct 1 — the FY+1
values take effect that day, and stale rules cause real eligibility
math errors.

This checklist mirrors `docs/SNAP-source-citation-signoff.md` and
the `civica_snap_signoff.xlsx` engineering verification packet.

---

## Step 0 — Confirm the COLA memo is out

USDA FNS publishes the next-FY COLA memo at:
- https://www.fns.usda.gov/snap/allotment/cola (rolling link)
- Per-year archive: `fns.usda.gov/snap/allotment/cola/fy{N}`

For state values:
- **CA:** CDSS All-County Letter (ACL) series at https://www.cdss.ca.gov/inforesources/CDSS-Programs/Welfare-to-Work/CalFresh/All-County-Letters
- **MA:** DTA Helpful Charts at https://www.mass.gov/lists/department-of-transitional-assistance-program-eligibility-charts-and-tables

If any of these aren't published yet, snooze this issue and re-check
in a week. Do NOT ship a refresh with placeholder values.

---

## Step 1 — Federal rows (5–11): highest-leverage updates

These almost always change YoY with the COLA cycle.

- [ ] **Row 5 — Max allotments HH 1-8 + per-add.** Read FY+1 COLA memo Table 1 (48 states + DC). Update `maxAllotmentSnapshots` in `Civica/Features/SNAP/Rules/FederalDefaultRules.swift`. Update `maxAllotmentTableSizesOneThroughEight` + `maxAllotmentExtrapolatesForLargeHouseholds` in `Civica Tests/FederalDefaultRulesTests.swift`.
- [ ] **Row 6 — Standard deduction by HH band.** Read FY+1 COLA memo Page 6. Update `standardDeductionSnapshots` + `standardDeductionByBucket` test.
- [ ] **Row 7 — Max excess shelter deduction.** Read FY+1 COLA memo Table 3. Update `shelterCapSnapshots` + `shelterCapWithoutElderlyOrDisabled` test.
- [ ] **Row 8 — Minimum SNAP benefit, HH 1-2.** Read FY+1 COLA memo minimum allotment table. Update `minimumBenefitSnapshots` + `minimumBenefitForFY{N}` test. Also update the `minimumBenefitDelegatesToFederal` assertion in `CAStateRulesTests` and `MAStateRulesTests`.
- [ ] **Row 9 — Gross income limits HH 1-8 (130% FPL).** Read FY+1 COLA memo Page 3. Update `grossIncomeSnapshots` + `grossIncomeLimitForKnownSizes` + per-add test. Do NOT derive from a monthly FPL formula — drift of ±$1 vs. the official memo is the documented hazard.
- [ ] **Row 10 — Net income limits HH 1-8 (100% FPL).** Same memo page. Update `netIncomeSnapshots` + tests symmetrically.
- [ ] **Row 11 — Asset limits.** Check the memo's "Resource Limit" section — typically unchanged but verify before stamping. If unchanged, add a new dated PolicySnapshot row anyway so the snapshot's `effectiveOn`/`expiresOn` reflects FY+1.

**Recompute downstream test cases** in `SNAPBenefitCalculatorTests.swift` — every test that pins specific dollars in the chained math will shift. The structure of the test is the same; only the expected numbers change.

---

## Step 2 — CA rows (13–18)

CDSS publishes its ACL letter in September (typically ACL XX-XX in the fall before Oct 1). Get the PDF, not a county chart book.

- [ ] **Row 13 — Apply URL.** Stable (`https://benefitscal.com`). Spot-check.
- [ ] **Row 14 — Helpline.** Stable (`877-847-3663`). Spot-check.
- [ ] **Row 15 — CA MCE gross income limits.** Read the CDSS ACL. Update `bbce200Snapshots` in `Civica/Features/SNAP/Rules/CAStateRules.swift` + tests. CA uses FFY FPL basis (Oct 1), MA uses HHS FPL basis (Feb 1) — table values differ even though both anchor at 200% FPL.
- [ ] **Row 16 — CA SUAs.** Read the CDSS ACL (typically same ACL as MCE limits or the separate SUA ACL). Update `suaSnapshots` in `CAStateRules.swift` + tests.
- [ ] **Row 17 — State Hearings Division address.** Verify against `https://www.cdss.ca.gov/inforesources/state-hearings` — CDSS occasionally re-orgs, MS codes/PO Box can change. The address surfaces on user-printable appeal letters — getting this wrong means real users mail to the wrong place.
- [ ] **Row 18 — Agency name.** Stable. Spot-check.

---

## Step 3 — MA rows (1–4)

DTA Helpful Charts typically updated in October with federal COLA + a possible mid-year refresh for the state supplement.

- [ ] **Row 1 — MA apply URL.** Stable (`https://dtaconnect.eohhs.mass.gov/`). Spot-check.
- [ ] **Row 2 — MA helpline.** Stable (`877-382-2363`). Spot-check.
- [ ] **Row 3 — MA BBCE gross income limits.** Read 106 CMR 364.976 PDF on mass.gov. Update `bbce200Snapshots` in `Civica/Features/SNAP/Rules/MAStateRules.swift` + tests.
- [ ] **Row 4 — MA SUAs.** Read 106 CMR 364.945 PDF on mass.gov. Update `suaSnapshots` + tests.

---

## Step 4 — All-states agency-name list (Row 12)

- [ ] Spot-check 5-10 state entries in `Civica/Features/SNAP/SNAPStateResources.swift` against the USDA SNAP State Directory at `https://www.fns.usda.gov/snap/state-directory`. Renames are rare but happen.

---

## Step 5 — Re-run signoff verification

- [ ] Update `docs/SNAP-source-citation-signoff.md` "Last checked" column to the current date for every row touched.
- [ ] Update the engineering signoff spreadsheet (`civica_snap_signoff.xlsx`) with the new values.
- [ ] Run all rules-engine tests: `xcodebuild test -scheme Civica -only-testing:CivicaTests/FederalDefaultRulesTests -only-testing:CivicaTests/CAStateRulesTests -only-testing:CivicaTests/MAStateRulesTests -only-testing:CivicaTests/SNAPBenefitCalculatorTests`.
- [ ] Confirm `RuleSnapshotStatus.snapshotStatusReportsCurrentForToday` test passes — this is the fail-loud tripwire that catches forgotten snapshot rows.

---

## Step 6 — Ship + monitor

- [ ] Bundle all rule updates into one PR per jurisdiction (Federal / CA / MA). Independent rollback if any one breaks.
- [ ] Tag each merged commit with `vYYYY-MM-DD-fy-rules-refresh` so post-launch incident investigations can trivially identify "which FY values were in production when the user filed their packet."
- [ ] Update memory file `project_obbba_audit.md` reflecting the refresh shipped.
- [ ] Close this tracking issue.

---

## Owner

The reminder workflow opens this issue but does not assign an owner. By
OBBBA Q18, the named owner must be identified before Oct 1 of the
target FY. Assign on the issue itself.

Suggested owner: whoever has the most recent commit to
`Civica/Features/SNAP/Rules/` (run `git log --oneline -5 -- Civica/Features/SNAP/Rules/`).
