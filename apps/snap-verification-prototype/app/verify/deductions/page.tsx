"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { calculateSnapBenefit, SUA_AMOUNTS, type SnapDeductionBreakdown } from "@/lib/snap-calculator";
import type { StateCode } from "@/types/verification";

type SuaTier = "full" | "limited" | "telephone" | "none";

export default function DeductionsPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <DeductionsInner />
    </Suspense>
  );
}

function DeductionsInner() {
  const params = useSearchParams();

  // Seed from query params when arriving from the review page
  const [stateCode, setStateCode] = useState<StateCode>((params.get("state") as StateCode) ?? "CA");
  const [householdSize, setHouseholdSize] = useState(Number(params.get("hh")) || 2);
  const [earnedIncome, setEarnedIncome] = useState(Number(params.get("earned")) || 2400);
  const [unearnedIncome, setUnearnedIncome] = useState(Number(params.get("unearned")) || 0);
  const [monthlyRent, setMonthlyRent] = useState(Number(params.get("rent")) || 850);
  const [suaTier, setSuaTier] = useState<SuaTier>((params.get("sua") as SuaTier) ?? "full");
  const [depCare, setDepCare] = useState(Number(params.get("depcare")) || 0);
  const [hasChildUnder2, setHasChildUnder2] = useState(params.get("child2") === "1");
  const [elderlyOrDisabled, setElderlyOrDisabled] = useState(params.get("elderly") === "1");

  // Re-seed if params change (e.g. browser back then different package)
  useEffect(() => {
    if (params.get("state")) setStateCode(params.get("state") as StateCode);
    if (params.get("hh")) setHouseholdSize(Number(params.get("hh")));
    if (params.get("earned")) setEarnedIncome(Number(params.get("earned")));
    if (params.get("unearned")) setUnearnedIncome(Number(params.get("unearned")));
    if (params.get("rent")) setMonthlyRent(Number(params.get("rent")));
    if (params.get("sua")) setSuaTier(params.get("sua") as SuaTier);
  }, [params]);

  const suaAmount = suaTier === "none" ? 0 : SUA_AMOUNTS[stateCode][suaTier];

  const pdfUrl = useMemo(() => {
    const p = new URLSearchParams({
      state: stateCode,
      hh: String(householdSize),
      earned: String(earnedIncome),
      unearned: String(unearnedIncome),
      rent: String(monthlyRent),
      sua_amount: String(suaAmount),
      depcare: String(depCare),
      child2: hasChildUnder2 ? "1" : "0",
      elderly: elderlyOrDisabled ? "1" : "0",
    });
    return `/api/deductions/pdf?${p}`;
  }, [stateCode, householdSize, earnedIncome, unearnedIncome, monthlyRent, suaAmount, depCare, hasChildUnder2, elderlyOrDisabled]);

  const result: SnapDeductionBreakdown = useMemo(
    () =>
      calculateSnapBenefit({
        stateCode,
        householdSize,
        grossMonthlyEarnedIncome: earnedIncome,
        grossMonthlyUnearnedIncome: unearnedIncome,
        monthlySheltCost: monthlyRent,
        monthlySuaAmount: suaAmount,
        monthlyDependentCareCost: depCare,
        hasChildUnder2,
        elderlyOrDisabled,
      }),
    [stateCode, householdSize, earnedIncome, unearnedIncome, monthlyRent, suaAmount, depCare, hasChildUnder2, elderlyOrDisabled]
  );

  function row(label: string, value: number, indent = false) {
    return (
      <>
        <span className="k" style={indent ? { paddingLeft: 20 } : undefined}>{label}</span>
        <span>${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
      </>
    );
  }

  const ineligible = !result.eligible;

  return (
    <>
      <div className="crumbs">
        <Link href="/">Home</Link> › SNAP benefit estimate
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>SNAP benefit estimate calculator</h1>
          <p className="sub">
            Caseworker tool. Enter income and shelter figures from completed verification packages to
            estimate the monthly SNAP allotment. Calculation follows 7 CFR 273.10.
          </p>
        </div>
        <a className="btn" href={pdfUrl} target="_blank" style={{ marginTop: 8, whiteSpace: "nowrap" }}>
          Download worksheet PDF
        </a>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>
        {/* Input panel */}
        <div className="card">
          <span className="step-tag">Inputs</span>
          <h2>Household details</h2>

          <label>State</label>
          <select value={stateCode} onChange={(e) => setStateCode(e.target.value as StateCode)}>
            <option value="CA">California</option>
            <option value="MA">Massachusetts</option>
          </select>

          <label>Household size</label>
          <input
            type="number"
            min={1}
            max={20}
            value={householdSize}
            onChange={(e) => setHouseholdSize(Math.max(1, Number(e.target.value) || 1))}
          />

          <h2 style={{ marginTop: 16 }}>Income (monthly)</h2>
          <label>Gross earned income (from Flow 3)</label>
          <input
            type="number"
            value={earnedIncome}
            onChange={(e) => setEarnedIncome(Number(e.target.value) || 0)}
          />

          <label>Unearned income (SSI, child support, etc.)</label>
          <input
            type="number"
            value={unearnedIncome}
            onChange={(e) => setUnearnedIncome(Number(e.target.value) || 0)}
          />

          <h2 style={{ marginTop: 16 }}>Shelter (monthly)</h2>
          <label>Monthly rent / housing cost (from Flow 2)</label>
          <input
            type="number"
            value={monthlyRent}
            onChange={(e) => setMonthlyRent(Number(e.target.value) || 0)}
          />

          <label>SUA tier (from Flow 1)</label>
          <select value={suaTier} onChange={(e) => setSuaTier(e.target.value as SuaTier)}>
            <option value="full">Full — ${SUA_AMOUNTS[stateCode].full}/mo</option>
            <option value="limited">Limited — ${SUA_AMOUNTS[stateCode].limited}/mo</option>
            <option value="telephone">Telephone — ${SUA_AMOUNTS[stateCode].telephone}/mo</option>
            <option value="none">None — $0</option>
          </select>

          <h2 style={{ marginTop: 16 }}>Other deductions</h2>
          <label>Monthly dependent care costs</label>
          <input
            type="number"
            value={depCare}
            onChange={(e) => setDepCare(Number(e.target.value) || 0)}
          />

          <label className="checkrow" style={{ marginTop: 6 }}>
            <input
              type="checkbox"
              checked={hasChildUnder2}
              onChange={(e) => setHasChildUnder2(e.target.checked)}
            />
            Child under 2 in household
          </label>

          <label className="checkrow">
            <input
              type="checkbox"
              checked={elderlyOrDisabled}
              onChange={(e) => setElderlyOrDisabled(e.target.checked)}
            />
            Elderly or disabled member (no shelter cap)
          </label>
        </div>

        {/* Result panel */}
        <div>
          {/* Eligibility banner */}
          <div className="card">
            <span className="step-tag">Eligibility</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                  Gross income test {result.gross_income_test_waived ? "(CA BBCE — waived)" : `(130% FPL · $${result.gross_income_limit.toLocaleString()})`}
                </div>
                <span className={`pill ${result.gross_income_test_pass ? "good" : "bad"}`}>
                  {result.gross_income_test_pass ? (result.gross_income_test_waived ? "WAIVED (BBCE)" : "PASS") : "FAIL"}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                  Net income test (100% FPL · ${result.net_income_limit.toLocaleString()})
                </div>
                <span className={`pill ${result.net_income_test_pass ? "good" : "bad"}`}>
                  {result.net_income_test_pass ? "PASS" : "FAIL"}
                </span>
              </div>
            </div>
            {result.bbce_eligible && (
              <p className="hint" style={{ marginTop: 8 }}>
                CA broad-based categorical eligibility (CDSS ACL 11-27): gross income test and
                asset test waived for households with gross income ≤ 200% FPL (${(result.gross_income_limit / 1.3 * 2).toFixed(0)}/mo for this household size).
              </p>
            )}
            {ineligible && (
              <div className="banner" style={{ marginTop: 8, background: "var(--bad-bg, #fff0f0)", color: "var(--bad, #c00)" }}>
                Household does not appear eligible based on the income figures entered.
                Estimated benefit: $0.
              </div>
            )}
          </div>

          {!ineligible && (
            <div className="card" style={{ marginTop: 12 }}>
              <span className="step-tag">Result</span>
              <h2>
                Estimated monthly benefit:{" "}
                <span className="pill good" style={{ fontSize: 20 }}>
                  ${result.estimated_benefit.toFixed(2)}
                </span>
              </h2>
              <p className="hint">
                Maximum allotment for {householdSize}-person household: ${result.max_allotment}/mo.
                {result.benefit_capped && " (Benefit capped at maximum allotment.)"}
              </p>
            </div>
          )}

          <div className="card" style={{ marginTop: 12 }}>
            <span className="step-tag">Deduction worksheet</span>
            <h2>Net income calculation</h2>
            <div className="kv" style={{ marginTop: 10 }}>
              {row("Gross earned income", earnedIncome)}
              {row("Gross unearned income", unearnedIncome)}
              {row("Total gross income", result.gross_income)}

              <span className="k" style={{ gridColumn: "1 / -1", marginTop: 8, fontWeight: 700, fontSize: 12, color: "var(--muted)" }}>
                DEDUCTIONS
              </span>
              {row("20% earned income deduction", result.earned_income_deduction, true)}
              {row(`Standard deduction (HH size ${householdSize})`, result.standard_deduction, true)}
              {result.dependent_care_deduction > 0 && row("Dependent care deduction", result.dependent_care_deduction, true)}
              {row("Adjusted net (before shelter)", result.adjusted_net_before_shelter)}

              <span className="k" style={{ gridColumn: "1 / -1", marginTop: 8, fontWeight: 700, fontSize: 12, color: "var(--muted)" }}>
                SHELTER DEDUCTION
              </span>
              {row("Monthly rent", monthlyRent, true)}
              {row(`SUA (${suaTier})`, suaAmount, true)}
              {row("Total shelter cost", result.shelter_cost_total, true)}
              {row("50% of adjusted net", result.half_adjusted_net, true)}
              {row("Excess shelter", result.excess_shelter, true)}
              {!elderlyOrDisabled && result.excess_shelter > 672 && (
                <>
                  <span className="k" style={{ paddingLeft: 20, fontSize: 12, color: "var(--muted)" }}>
                    Shelter deduction cap applied
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>$672 max (non-elderly)</span>
                </>
              )}
              {row("Shelter deduction applied", result.shelter_deduction_applied, true)}

              <span className="k" style={{ gridColumn: "1 / -1", borderTop: "2px solid var(--border)", paddingTop: 8, marginTop: 4 }}></span>
              <span className="k"><strong>Net monthly income</strong></span>
              <span><strong>${result.net_income.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></span>

              {!ineligible && (
                <>
                  <span className="k" style={{ gridColumn: "1 / -1", marginTop: 8, fontWeight: 700, fontSize: 12, color: "var(--muted)" }}>
                    BENEFIT
                  </span>
                  {row("Maximum allotment", result.max_allotment, true)}
                  {row("30% × net income", result.thirty_pct_net, true)}
                  <span className="k"><strong>Estimated benefit</strong></span>
                  <span>
                    <span className="pill good">
                      ${result.estimated_benefit.toFixed(2)}/mo
                    </span>
                  </span>
                </>
              )}
            </div>

            <p className="hint" style={{ marginTop: 14 }}>
              <strong>Citations:</strong> 7 CFR 273.10(e)(1) (earned income deduction) ·
              7 CFR 273.10(d)(4) (dependent care) · 7 CFR 273.10(d)(6) (shelter deduction) ·
              7 CFR 273.10(e)(4) (benefit calculation)
              {stateCode === "CA" && " · CA CDSS ACL 11-27 (BBCE)"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
