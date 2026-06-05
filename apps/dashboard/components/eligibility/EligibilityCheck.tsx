"use client";

// Navigator quick-check: enter the determinative facts, get verdict + estimated
// benefit + recommendations in one shot. Posts to /api/eligibility-check, which
// runs Component R (elicit → determine → recommend) server-side.
//
// v1 covers the single-adult case (the most common SNAP household). Multi-member
// + medical/dependent-care deductions are the next increment.

import { useState } from "react";

const SUA_TIERS = [
  { value: "HCSUA", label: "Heating / cooling" },
  { value: "LUA", label: "Electric or gas" },
  { value: "phone", label: "Phone only" },
  { value: "none", label: "None" },
] as const;

const CAT_ELIG = [
  { value: "NPA", label: "No (regular SNAP)" },
  { value: "TANF", label: "TANF / CalWORKs" },
  { value: "pure_cash", label: "SSI / cash aid" },
] as const;

type Rec = {
  rank: number;
  field: string;
  action: string;
  delta_monthly_usd: number;
  urgency: string;
};

type Result = {
  status: string;
  missing_fields: string[];
  verdict: string | null;
  estimated_monthly_benefit_usd: number | null;
  recommendations: Rec[];
  error?: string;
};

export default function EligibilityCheck({ state }: { state: "CA" | "MA" }) {
  const [age, setAge] = useState("");
  const [immigration, setImmigration] = useState("citizen");
  const [wages, setWages] = useState("");
  const [rent, setRent] = useState("");
  const [suaTier, setSuaTier] = useState<string>("HCSUA");
  const [assets, setAssets] = useState("");
  const [catElig, setCatElig] = useState("NPA");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  function buildFacts() {
    const ageNum = Number(age) || 0;
    const wagesNum = Number(wages) || 0;
    return {
      household: [
        {
          member_id: "m1",
          age: ageNum,
          role: "head",
          immigration,
          disability: false,
          elderly: ageNum >= 60,
          student: "not",
          five_yr_bar: "n/a",
          sponsored: false,
          work_class: "gen_work_subject",
          abawd_months_used: 0,
          disqual: [],
          living: "housed",
        },
      ],
      income:
        wagesNum > 0
          ? [{ member: "m1", type: "wages", amount: wagesNum, freq: "monthly", anticipation: "averaged", source_status: "ongoing" }]
          : [],
      shelter: { rent: Number(rent) || 0, sua_tier: suaTier, sua_amount: 0, internet: 0, homeless_deduction: false },
      deductions: { dependent_care: 0, medical_unreimbursed: 0, child_support_paid: 0 },
      assets: Number(assets) || 0,
      cat_elig: catElig,
    };
  }

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/eligibility-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facts: buildFacts(), state }),
      });
      setResult(await res.json());
    } catch {
      setResult({ status: "ERROR", missing_fields: [], verdict: null, estimated_monthly_benefit_usd: null, recommendations: [], error: "Request failed" });
    } finally {
      setLoading(false);
    }
  }

  const approved = result?.verdict === "APPROVE";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <section className="rounded-[4px] border border-hairline bg-surface p-5">
        <h2 className="text-[14px] font-bold text-ink">Applicant facts</h2>
        <p className="mt-1 text-[12px] text-graphite">
          Enter what you know. Estimate is for navigator use — not a promise to the applicant.
        </p>
        <div className="mt-4 space-y-3">
          <Field label="Age"><input type="number" value={age} onChange={(e) => setAge(e.target.value)} className={inputCls} placeholder="e.g. 34" /></Field>
          <Field label="Citizenship / status">
            <select value={immigration} onChange={(e) => setImmigration(e.target.value)} className={inputCls}>
              <option value="citizen">U.S. citizen</option>
              <option value="lpr">Green card (LPR)</option>
              <option value="refugee">Refugee / asylee</option>
              <option value="other">Other / not eligible</option>
            </select>
          </Field>
          <Field label="Monthly earned income ($)"><input type="number" value={wages} onChange={(e) => setWages(e.target.value)} className={inputCls} placeholder="before taxes" /></Field>
          <Field label="Monthly rent / mortgage ($)"><input type="number" value={rent} onChange={(e) => setRent(e.target.value)} className={inputCls} /></Field>
          <Field label="Utilities">
            <select value={suaTier} onChange={(e) => setSuaTier(e.target.value)} className={inputCls}>
              {SUA_TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Liquid assets ($)"><input type="number" value={assets} onChange={(e) => setAssets(e.target.value)} className={inputCls} placeholder="bank + cash" /></Field>
          <Field label="Receives cash aid?">
            <select value={catElig} onChange={(e) => setCatElig(e.target.value)} className={inputCls}>
              {CAT_ELIG.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading || !age}
          className="mt-5 w-full rounded-[4px] bg-pine px-4 py-2.5 text-[13px] font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Checking…" : "Check eligibility"}
        </button>
      </section>

      {/* ── Result ───────────────────────────────────────────────────────── */}
      <section className="rounded-[4px] border border-hairline bg-surface p-5">
        <h2 className="text-[14px] font-bold text-ink">Result</h2>
        {!result && <p className="mt-3 text-[13px] text-graphite">Fill in the facts and run a check.</p>}
        {result?.error && <p className="mt-3 text-[13px] text-error">{result.error}</p>}

        {result && !result.error && (
          <div className="mt-3 space-y-4">
            {result.status === "ELICIT" ? (
              <div className="rounded-[4px] border border-warning/30 bg-warning/[0.06] p-4">
                <p className="text-[13px] font-semibold text-warning">More information needed</p>
                <p className="mt-1 text-[12px] text-graphite">
                  Still need: {result.missing_fields.join(", ") || "more facts"}.
                </p>
              </div>
            ) : (
              <>
                <div className={`rounded-[4px] border p-4 ${approved ? "border-pine/30 bg-pine/[0.06]" : "border-brick/30 bg-brick/[0.06]"}`}>
                  <p className={`text-[11px] font-semibold uppercase tracking-wider ${approved ? "text-pine" : "text-brick"}`}>
                    {approved ? "Likely eligible" : "Likely not eligible"}
                  </p>
                  {approved && (
                    <p className="mt-1 text-[32px] font-semibold tabular-nums leading-none text-ink">
                      ${result.estimated_monthly_benefit_usd ?? 0}<span className="text-[14px] font-normal text-graphite">/mo</span>
                    </p>
                  )}
                  <p className="mt-1.5 text-[11px] text-muted">Estimate from the {state} rules engine. Final amount set by the county.</p>
                </div>

                {result.recommendations.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Recommended actions</p>
                    <ul className="mt-2 space-y-2">
                      {result.recommendations.map((r) => (
                        <li key={r.rank} className="rounded-[4px] border border-hairline bg-surface-secondary p-3">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-[13px] text-ink">{r.action}</p>
                            {r.delta_monthly_usd > 0 && (
                              <span className="shrink-0 text-[12px] font-semibold tabular-nums text-pine">+${Math.round(r.delta_monthly_usd)}/mo</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

const inputCls =
  "w-full rounded-[4px] border border-hairline bg-paper px-3 py-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-pine/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-graphite">{label}</span>
      {children}
    </label>
  );
}
