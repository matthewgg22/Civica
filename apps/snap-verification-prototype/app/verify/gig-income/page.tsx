"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  CashWeek,
  GigIncomePackage,
  GigPlatform,
  IncomeSource,
  StateCode,
} from "@/types/verification";
import { buildGigIncomePackage } from "@/lib/package-builder";
import PlaidLinkButton from "@/components/PlaidLinkButton";
import ArgyleConnectButton, { type ArgyleConnectResult } from "@/components/ArgyleConnectButton";

type Step = "intake" | "argyle" | "plaid" | "cash" | "review";

const PLATFORMS: { value: GigPlatform; label: string }[] = [
  { value: "doordash", label: "DoorDash" },
  { value: "uber", label: "Uber" },
  { value: "lyft", label: "Lyft" },
  { value: "instacart", label: "Instacart" },
  { value: "taskrabbit", label: "TaskRabbit" },
  { value: "amazon_flex", label: "Amazon Flex" },
  { value: "other", label: "Other platform" },
];

function thisWeekMinus(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().slice(0, 10);
}

export default function GigIncomeFlow() {
  const [step, setStep] = useState<Step>("intake");
  const [stateCode, setStateCode] = useState<StateCode>("CA");
  const [applicantName, setApplicantName] = useState("Alex Applicant");

  const [hasW2, setHasW2] = useState(true);
  const [w2Employer, setW2Employer] = useState("Acme Logistics");
  const [platforms, setPlatforms] = useState<GigPlatform[]>(["doordash", "uber"]);
  const [hasCash, setHasCash] = useState(true);
  const [cashMonthly, setCashMonthly] = useState(300);

  const [argyleSources, setArgyleSources] = useState<IncomeSource[]>([]);
  const [plaidSources, setPlaidSources] = useState<IncomeSource[]>([]);
  const [cashLog, setCashLog] = useState<CashWeek[]>(
    Array.from({ length: 12 }, (_, i) => ({ week_of: thisWeekMinus(11 - i), amount: 75 }))
  );
  const [cashSigned, setCashSigned] = useState(false);
  const [signature, setSignature] = useState("");

  const [loading, setLoading] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  function togglePlatform(p: GigPlatform) {
    setPlatforms((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));
  }

  async function onArgyleSuccess(_result: ArgyleConnectResult) {
    setLoading(true);
    try {
      const { earnings } = await fetch("/api/argyle/earnings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          w2Employer: hasW2 ? w2Employer : null,
          platforms,
        }),
      }).then((r) => r.json());

      const sources: IncomeSource[] = (earnings ?? []).map((e: { source_type: string; source: string; monthly_average: number }) => ({
        type: e.source_type,
        source_name: e.source,
        monthly_average: e.monthly_average,
        verification_method: "argyle_api" as const,
        confidence: "verified" as const,
      }));
      setArgyleSources(sources);
      setStep("plaid");
    } finally {
      setLoading(false);
    }
  }

  async function onPlaidSuccess(accessToken: string) {
    setLoading(true);
    try {
      const knownSources = [
        ...(hasW2 ? [w2Employer] : []),
        ...platforms.map((p) => p),
      ];

      const { deposits } = await fetch("/api/plaid/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "income", publicToken: accessToken, knownSources }),
      }).then((r) => r.json());

      const sources: IncomeSource[] = (deposits ?? []).map((d: any) => ({
        type: platforms.includes(d.source_name as GigPlatform) ? "platform_gig" : "w2",
        source_name: `${d.source_name} (bank deposits)`,
        monthly_average: d.monthly_average,
        verification_method: "plaid_deposits",
        confidence: "corroborated",
      }));
      setPlaidSources(sources);
      setStep(hasCash ? "cash" : "review");
    } finally {
      setLoading(false);
    }
  }

  function updateCashWeek(i: number, amount: number) {
    setCashLog((s) => s.map((w, idx) => (idx === i ? { ...w, amount } : w)));
  }

  const cashSource: IncomeSource | null = useMemo(() => {
    if (!hasCash) return null;
    const monthly =
      cashLog.length > 0
        ? Math.round((cashLog.reduce((s, w) => s + w.amount, 0) / cashLog.length) * 4.33 * 100) / 100
        : cashMonthly;
    return {
      type: "cash",
      source_name: "Cash / informal work",
      monthly_average: monthly,
      verification_method: "self_declared",
      confidence: "self_declared",
    };
  }, [hasCash, cashLog, cashMonthly]);

  const pkg: GigIncomePackage | null = useMemo(() => {
    if (argyleSources.length === 0 && plaidSources.length === 0 && !cashSource) return null;
    const sources = [...argyleSources, ...plaidSources, ...(cashSource ? [cashSource] : [])];
    return buildGigIncomePackage({
      applicantName,
      stateCode,
      sources,
      cashAttestationSigned: hasCash ? cashSigned : true,
      cashLog: hasCash ? cashLog : undefined,
    });
  }, [applicantName, stateCode, argyleSources, plaidSources, cashSource, cashSigned, cashLog, hasCash]);

  async function savePackage() {
    if (!pkg) return;
    setLoading(true);
    try {
      const res = await fetch("/api/packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applicant_name: applicantName, package: pkg }),
      }).then((r) => r.json());
      setSavedId(res.stored.id);
    } finally {
      setLoading(false);
    }
  }

  function signAttestation() {
    if (!signature.trim()) return;
    setCashSigned(true);
    setStep("review");
  }

  return (
    <>
      <div className="crumbs">
        <Link href="/">Home</Link> › Gig income
      </div>
      <h1>Gig / multi-source income verification</h1>
      <p className="sub">Flow 3 of 3. Estimated time: 3–4 minutes.</p>

      {step === "intake" && (
        <div className="card">
          <span className="step-tag">Step 1 · Income source mapping</span>
          <h2>Where does your income come from?</h2>

          <label>State</label>
          <select value={stateCode} onChange={(e) => setStateCode(e.target.value as StateCode)}>
            <option value="CA">California</option>
            <option value="MA">Massachusetts</option>
          </select>

          <label>Applicant full name</label>
          <input value={applicantName} onChange={(e) => setApplicantName(e.target.value)} />

          <label style={{ marginTop: 10 }}>Do you have a W-2 employer?</label>
          <label className="checkrow">
            <input type="radio" checked={hasW2} onChange={() => setHasW2(true)} /> Yes
          </label>
          <label className="checkrow">
            <input type="radio" checked={!hasW2} onChange={() => setHasW2(false)} /> No
          </label>
          {hasW2 && (
            <>
              <label>Employer name</label>
              <input value={w2Employer} onChange={(e) => setW2Employer(e.target.value)} />
            </>
          )}

          <label style={{ marginTop: 10 }}>Do you work for any of these platforms?</label>
          {PLATFORMS.map((p) => (
            <label key={p.value} className="checkrow">
              <input
                type="checkbox"
                checked={platforms.includes(p.value)}
                onChange={() => togglePlatform(p.value)}
              />
              {p.label}
            </label>
          ))}

          <label style={{ marginTop: 10 }}>Do you receive any cash income from informal work?</label>
          <label className="checkrow">
            <input type="radio" checked={hasCash} onChange={() => setHasCash(true)} /> Yes
          </label>
          <label className="checkrow">
            <input type="radio" checked={!hasCash} onChange={() => setHasCash(false)} /> No
          </label>
          {hasCash && (
            <>
              <label>Approximate monthly cash amount ($)</label>
              <input
                type="number"
                value={cashMonthly}
                onChange={(e) => setCashMonthly(Number(e.target.value) || 0)}
              />
            </>
          )}

          <div className="btn-row">
            <button onClick={() => setStep("argyle")}>Continue</button>
          </div>
        </div>
      )}

      {step === "argyle" && (
        <div className="card">
          <span className="step-tag">Step 2a · Argyle</span>
          <h2>Connect employer / platform accounts</h2>
          <p className="hint">
            We use Argyle (sandbox) to pull 90 days of W-2 and platform-gig earnings directly from
            the source.
          </p>
          <ul>
            {hasW2 && <li>W-2 employer: <strong>{w2Employer}</strong></li>}
            {platforms.map((p) => (
              <li key={p}>Platform: <strong>{p}</strong></li>
            ))}
            {!hasW2 && platforms.length === 0 && <li>(none — will skip API verification)</li>}
          </ul>
          {loading && <p className="hint">Fetching earnings data…</p>}
          <div className="btn-row">
            <button className="btn secondary" onClick={() => setStep("intake")}>Back</button>
            {!loading && (
              <ArgyleConnectButton
                applicantName={applicantName}
                label="Connect employer / platform with Argyle"
                onSuccess={onArgyleSuccess}
                onError={(e) => alert(`Argyle error: ${e}`)}
                disabled={loading}
              />
            )}
          </div>
        </div>
      )}

      {step === "plaid" && (
        <div className="card">
          <span className="step-tag">Step 2b · Plaid corroboration</span>
          <h2>Cross-check with bank deposits</h2>
          <p className="hint">
            Plaid sandbox: we calculate a 3-month rolling deposit average per known source and
            compare against the Argyle-verified totals.
          </p>
          {argyleSources.length > 0 && (
            <div className="kv">
              {argyleSources.map((s, i) => (
                <span key={i} style={{ gridColumn: "1 / -1" }}>
                  <span className="pill good">{s.confidence}</span>{" "}
                  <strong>{s.source_name}</strong> — ${s.monthly_average.toFixed(2)}/mo
                </span>
              ))}
            </div>
          )}
          <div className="btn-row">
            <button className="btn secondary" onClick={() => setStep("argyle")}>Back</button>
            {!loading && (
              <PlaidLinkButton
                userId={applicantName}
                label="Connect bank with Plaid Link"
                onSuccess={(r) => onPlaidSuccess(r.access_token)}
                disabled={loading}
              />
            )}
            {loading && <button disabled className="btn">Analyzing deposits…</button>}
          </div>
        </div>
      )}

      {step === "cash" && hasCash && (
        <div className="card">
          <span className="step-tag">Step 3 · Cash attestation</span>
          <h2>Log your cash income — last 12 weeks</h2>
          <p className="hint">
            Cash income is unverifiable via API. You must attest to it. This will be flagged as
            <strong> self-declared</strong> in the package.
          </p>

          <table className="txns">
            <thead>
              <tr>
                <th>Week of</th>
                <th>Amount ($)</th>
              </tr>
            </thead>
            <tbody>
              {cashLog.map((w, i) => (
                <tr key={i}>
                  <td>{w.week_of}</td>
                  <td>
                    <input
                      type="number"
                      value={w.amount}
                      onChange={(e) => updateCashWeek(i, Number(e.target.value) || 0)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <label style={{ marginTop: 14 }}>
            Type your full legal name to sign this attestation
          </label>
          <input
            value={signature}
            placeholder="e.g. Alex T. Applicant"
            onChange={(e) => setSignature(e.target.value)}
          />
          <p className="hint">
            By signing, I attest under penalty of perjury that the cash income amounts above are
            true and complete to the best of my knowledge.
          </p>
          <div className="btn-row">
            <button className="btn secondary" onClick={() => setStep("plaid")}>Back</button>
            <button disabled={!signature.trim()} onClick={signAttestation}>
              Sign &amp; continue
            </button>
          </div>
        </div>
      )}

      {step === "review" && pkg && (
        <>
          <div className="card">
            <span className="step-tag">Step 4 · Reconciliation</span>
            <h2>
              {pkg.reconciliation_flag ? (
                <span className="pill bad">RECONCILIATION FLAG</span>
              ) : (
                <span className="pill good">Reconciled</span>
              )}
            </h2>
            <div className="kv" style={{ marginTop: 10 }}>
              <span className="k">API-verified monthly</span>
              <span>${pkg.total_monthly_verified.toFixed(2)}</span>
              <span className="k">Bank-corroborated monthly</span>
              <span>${pkg.total_monthly_bank_corroborated.toFixed(2)}</span>
              <span className="k">Self-declared cash</span>
              <span>${pkg.total_monthly_self_declared_cash.toFixed(2)}</span>
              <span className="k">Total declared</span>
              <span><strong>${pkg.total_monthly_declared.toFixed(2)}</strong></span>
              <span className="k">Reconciliation gap</span>
              <span>${pkg.reconciliation_gap.toFixed(2)}</span>
              <span className="k">Cash attestation</span>
              <span>{pkg.cash_attestation_signed ? "signed" : "not signed"}</span>
              <span className="k">Regulatory citations</span>
              <span style={{ fontSize: 12 }}>{pkg.regulatory_citations.join(" · ")}</span>
            </div>

            <table className="txns">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Method</th>
                  <th>Confidence</th>
                  <th>Monthly avg</th>
                </tr>
              </thead>
              <tbody>
                {pkg.income_sources.map((s, i) => (
                  <tr key={i}>
                    <td>{s.source_name}</td>
                    <td>{s.type}</td>
                    <td>{s.verification_method}</td>
                    <td>
                      <span
                        className={`pill ${
                          s.confidence === "verified"
                            ? "good"
                            : s.confidence === "corroborated"
                              ? "neutral"
                              : "warn"
                        }`}
                      >
                        {s.confidence}
                      </span>
                    </td>
                    <td>${s.monthly_average.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Verification package</h2>
            <pre className="json">{JSON.stringify(pkg, null, 2)}</pre>
            <div className="btn-row">
              {!savedId && (
                <button disabled={loading} onClick={savePackage}>
                  {loading ? "Saving…" : "Save package"}
                </button>
              )}
              {savedId && (
                <>
                  <a className="btn" href={`/api/packages/${savedId}/pdf`} target="_blank">
                    Download PDF
                  </a>
                  <Link className="btn secondary" href={`/review?id=${savedId}`}>
                    Open in review
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
