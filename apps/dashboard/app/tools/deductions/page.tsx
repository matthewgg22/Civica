"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  calculateSnapBenefit,
  SUA_AMOUNTS,
  type SnapDeductionBreakdown,
} from "@civica/snap-calculator";

type StateCode = "CA" | "MA";
type SuaTier = "full" | "limited" | "telephone" | "none";

export default function DeductionsPage() {
  return (
    <Suspense fallback={<p className="text-[14px] text-muted p-8">Loading…</p>}>
      <DeductionsInner />
    </Suspense>
  );
}

function DeductionsInner() {
  const params = useSearchParams();

  const [stateCode, setStateCode] = useState<StateCode>((params.get("state") as StateCode) ?? "CA");
  const [householdSize, setHouseholdSize] = useState(Number(params.get("hh")) || 2);
  const [earnedIncome, setEarnedIncome] = useState(Number(params.get("earned")) || 0);
  const [unearnedIncome, setUnearnedIncome] = useState(Number(params.get("unearned")) || 0);
  const [monthlyRent, setMonthlyRent] = useState(Number(params.get("rent")) || 0);
  const [suaTier, setSuaTier] = useState<SuaTier>((params.get("sua") as SuaTier) ?? "none");
  const [depCare, setDepCare] = useState(Number(params.get("depcare")) || 0);
  const [hasChildUnder2, setHasChildUnder2] = useState(params.get("child2") === "1");
  const [elderlyOrDisabled, setElderlyOrDisabled] = useState(params.get("elderly") === "1");

  useEffect(() => {
    if (params.get("state")) setStateCode(params.get("state") as StateCode);
    if (params.get("hh")) setHouseholdSize(Number(params.get("hh")));
    if (params.get("earned")) setEarnedIncome(Number(params.get("earned")));
    if (params.get("unearned")) setUnearnedIncome(Number(params.get("unearned")));
    if (params.get("rent")) setMonthlyRent(Number(params.get("rent")));
    if (params.get("sua")) setSuaTier(params.get("sua") as SuaTier);
    if (params.get("sua_amount")) {
      // If a pre-computed sua_amount arrives (from packet combine), derive tier
      const amt = Number(params.get("sua_amount"));
      const tiers = SUA_AMOUNTS[params.get("state") as StateCode ?? "CA"];
      if (amt === tiers?.full) setSuaTier("full");
      else if (amt === tiers?.limited) setSuaTier("limited");
      else if (amt === tiers?.telephone) setSuaTier("telephone");
      else if (amt === 0) setSuaTier("none");
    }
  }, [params]);

  const suaAmount = suaTier === "none" ? 0 : SUA_AMOUNTS[stateCode][suaTier];

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
    [stateCode, householdSize, earnedIncome, unearnedIncome, monthlyRent, suaAmount, depCare, hasChildUnder2, elderlyOrDisabled],
  );

  const ineligible = !result.eligible;

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-surface border-b border-hairline px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/packets" className="text-[13px] font-semibold text-pine hover:underline">← Queue</Link>
          <span className="text-hairline">·</span>
          <span className="text-[13px] text-muted">SNAP benefit estimate</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-8">
        <div className="mb-6">
          <h1 className="text-[24px] font-semibold tracking-tight text-ink">SNAP benefit estimate</h1>
          <p className="text-[14px] text-graphite mt-1">
            Navigator tool — enter verified income and shelter figures to estimate the monthly allotment.
            Calculation follows 7 CFR 273.10.
          </p>
        </div>

        <div className="grid gap-5" style={{ gridTemplateColumns: "300px 1fr", alignItems: "start" }}>

          {/* Input panel */}
          <div className="bg-surface border border-hairline rounded-[4px] p-5 space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted mb-3">Household</p>
              <Field label="State">
                <select value={stateCode} onChange={(e) => setStateCode(e.target.value as StateCode)} className={input}>
                  <option value="CA">California</option>
                  <option value="MA">Massachusetts</option>
                </select>
              </Field>
              <Field label="Household size">
                <input type="number" min={1} max={20} value={householdSize} className={input}
                  onChange={(e) => setHouseholdSize(Math.max(1, Number(e.target.value) || 1))} />
              </Field>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted mb-3">Income (monthly)</p>
              <Field label="Gross earned income">
                <input type="number" value={earnedIncome} className={input}
                  onChange={(e) => setEarnedIncome(Number(e.target.value) || 0)} />
              </Field>
              <Field label="Unearned income (SSI, child support…)">
                <input type="number" value={unearnedIncome} className={input}
                  onChange={(e) => setUnearnedIncome(Number(e.target.value) || 0)} />
              </Field>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted mb-3">Shelter (monthly)</p>
              <Field label="Monthly rent / housing cost">
                <input type="number" value={monthlyRent} className={input}
                  onChange={(e) => setMonthlyRent(Number(e.target.value) || 0)} />
              </Field>
              <Field label="SUA tier">
                <select value={suaTier} onChange={(e) => setSuaTier(e.target.value as SuaTier)} className={input}>
                  <option value="full">Full — ${SUA_AMOUNTS[stateCode].full}/mo</option>
                  <option value="limited">Limited — ${SUA_AMOUNTS[stateCode].limited}/mo</option>
                  <option value="telephone">Telephone — ${SUA_AMOUNTS[stateCode].telephone}/mo</option>
                  <option value="none">None — $0</option>
                </select>
              </Field>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted mb-3">Other deductions</p>
              <Field label="Monthly dependent care">
                <input type="number" value={depCare} className={input}
                  onChange={(e) => setDepCare(Number(e.target.value) || 0)} />
              </Field>
              <label className="flex items-center gap-2 text-[13px] text-graphite mt-2 cursor-pointer">
                <input type="checkbox" checked={hasChildUnder2} onChange={(e) => setHasChildUnder2(e.target.checked)} />
                Child under 2 in household
              </label>
              <label className="flex items-center gap-2 text-[13px] text-graphite mt-2 cursor-pointer">
                <input type="checkbox" checked={elderlyOrDisabled} onChange={(e) => setElderlyOrDisabled(e.target.checked)} />
                Elderly or disabled member (no shelter cap)
              </label>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {/* Eligibility */}
            <div className="bg-surface border border-hairline rounded-[4px] p-5">
              <p className="eyebrow mb-3">Eligibility</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[12px] text-muted mb-1.5">
                    Gross income test {result.gross_income_test_waived ? "(CA BBCE — waived)" : `· 130% FPL · $${result.gross_income_limit.toLocaleString()}/mo`}
                  </p>
                  <Pill pass={result.gross_income_test_pass} waived={result.gross_income_test_waived} />
                </div>
                <div>
                  <p className="text-[12px] text-muted mb-1.5">Net income test · 100% FPL · ${result.net_income_limit.toLocaleString()}/mo</p>
                  <Pill pass={result.net_income_test_pass} />
                </div>
              </div>
              {result.bbce_eligible && (
                <p className="text-[12px] text-graphite mt-3 leading-snug">
                  CA broad-based categorical eligibility (CDSS ACL 11-27): gross income test and asset test waived
                  for households with gross income ≤ 200% FPL.
                </p>
              )}
              {ineligible && (
                <div className="mt-3 px-4 py-3 rounded-[3px] bg-brick/8 border border-brick/30 text-[13px] text-brick font-medium">
                  Household does not appear eligible based on the figures entered. Estimated benefit: $0.
                </div>
              )}
            </div>

            {/* Result */}
            {!ineligible && (
              <div className="bg-surface border border-teal/40 rounded-[4px] p-5">
                <p className="eyebrow mb-1">Estimated monthly benefit</p>
                <p className="text-[36px] font-semibold text-teal tabular-nums leading-none">
                  ${result.estimated_benefit.toFixed(2)}
                </p>
                <p className="text-[12px] text-muted mt-1.5">
                  Max allotment for {householdSize}-person household: ${result.max_allotment}/mo.
                  {result.benefit_capped && " (Capped at maximum.)"}
                </p>
              </div>
            )}

            {/* Worksheet */}
            <div className="bg-surface border border-hairline rounded-[4px] p-5">
              <p className="eyebrow mb-4">Deduction worksheet · 7 CFR 273.10</p>
              <table className="w-full text-[13px]">
                <tbody>
                  <WRow label="Gross earned income" value={earnedIncome} />
                  <WRow label="Gross unearned income" value={unearnedIncome} />
                  <WRow label="Total gross income" value={result.gross_income} bold />
                  <WSection label="DEDUCTIONS" />
                  <WRow label="20% earned income deduction" value={result.earned_income_deduction} indent />
                  <WRow label={`Standard deduction (HH ${householdSize})`} value={result.standard_deduction} indent />
                  {result.dependent_care_deduction > 0 && (
                    <WRow label="Dependent care deduction" value={result.dependent_care_deduction} indent />
                  )}
                  <WRow label="Adjusted net (before shelter)" value={result.adjusted_net_before_shelter} bold />
                  <WSection label="SHELTER DEDUCTION" />
                  <WRow label="Monthly rent" value={monthlyRent} indent />
                  <WRow label={`SUA (${suaTier})`} value={suaAmount} indent />
                  <WRow label="Total shelter cost" value={result.shelter_cost_total} indent />
                  <WRow label="50% of adjusted net" value={result.half_adjusted_net} indent />
                  <WRow label="Excess shelter" value={result.excess_shelter} indent />
                  {!elderlyOrDisabled && result.excess_shelter > 672 && (
                    <tr>
                      <td className="py-1 pl-8 text-muted italic">Shelter cap applied ($672 max)</td>
                      <td />
                    </tr>
                  )}
                  <WRow label="Shelter deduction applied" value={result.shelter_deduction_applied} indent />
                  <tr><td colSpan={2}><div className="border-t-2 border-hairline my-2" /></td></tr>
                  <WRow label="Net monthly income" value={result.net_income} bold />
                  {!ineligible && (
                    <>
                      <WSection label="BENEFIT" />
                      <WRow label="Maximum allotment" value={result.max_allotment} indent />
                      <WRow label="30% × net income" value={result.thirty_pct_net} indent />
                      <WRow label="Estimated benefit" value={result.estimated_benefit} bold />
                    </>
                  )}
                </tbody>
              </table>
              <p className="text-[11px] text-muted mt-4 leading-relaxed">
                <strong>Citations:</strong> 7 CFR 273.10(e)(1) earned income deduction ·
                7 CFR 273.10(d)(4) dependent care · 7 CFR 273.10(d)(6) shelter deduction ·
                7 CFR 273.10(e)(4) benefit calculation
                {stateCode === "CA" && " · CA CDSS ACL 11-27 (BBCE)"}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const input = "w-full border border-hairline rounded-[3px] px-3 py-2 text-[13px] bg-paper focus:outline-none focus:border-pine transition-colors mt-1";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="text-[12px] font-medium text-graphite">{label}</label>
      {children}
    </div>
  );
}

function Pill({ pass, waived }: { pass: boolean; waived?: boolean }) {
  if (waived) return <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-teal/10 text-teal">WAIVED (BBCE)</span>;
  return pass
    ? <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-teal/10 text-teal">PASS</span>
    : <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-brick/10 text-brick">FAIL</span>;
}

function WRow({ label, value, indent, bold }: { label: string; value: number; indent?: boolean; bold?: boolean }) {
  return (
    <tr>
      <td className={`py-1 ${indent ? "pl-6" : ""} ${bold ? "font-semibold text-ink" : "text-graphite"}`}>{label}</td>
      <td className={`py-1 text-right tabular-nums ${bold ? "font-semibold text-ink" : "text-graphite"}`}>
        ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </td>
    </tr>
  );
}

function WSection({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={2} className="pt-3 pb-1 text-[11px] uppercase tracking-wider font-semibold text-muted">{label}</td>
    </tr>
  );
}
