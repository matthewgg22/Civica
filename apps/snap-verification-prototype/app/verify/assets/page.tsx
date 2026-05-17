"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AssetItem, AssetPackage, StateCode } from "@/types/verification";
import { buildAssetPackage } from "@/lib/package-builder";
import { STATE_ASSET_RULES } from "@/lib/asset-rules";
import PlaidLinkButton from "@/components/PlaidLinkButton";

type Step = "intake" | "plaid" | "review";

interface VehicleEntry {
  description: string;
  stated_value: number;
  primary_transport: boolean;
}

interface BankAccount {
  account_id: string;
  name: string;
  institution_name: string;
  balance: number;
}

export default function AssetsFlow() {
  const [step, setStep] = useState<Step>("intake");
  const [stateCode, setStateCode] = useState<StateCode>("CA");
  const [applicantName, setApplicantName] = useState("Alex Applicant");
  const [elderlyOrDisabled, setElderlyOrDisabled] = useState(false);

  // Vehicles
  const [hasVehicle, setHasVehicle] = useState(true);
  const [vehicles, setVehicles] = useState<VehicleEntry[]>([
    { description: "2018 Honda Civic", stated_value: 12000, primary_transport: true },
  ]);

  // Other liquid assets (self-declared)
  const [hasCash, setHasCash] = useState(false);
  const [cashAmount, setCashAmount] = useState(0);
  const [hasRetirement, setHasRetirement] = useState(false);
  const [retirementAmount, setRetirementAmount] = useState(0);

  // Plaid bank accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [plaidConnected, setPlaidConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const rules = STATE_ASSET_RULES[stateCode];

  function addVehicle() {
    setVehicles((v) => [...v, { description: "", stated_value: 0, primary_transport: false }]);
  }

  function updateVehicle(i: number, patch: Partial<VehicleEntry>) {
    setVehicles((v) => v.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  async function onPlaidSuccess(accessToken: string) {
    setLoading(true);
    try {
      const { accounts } = await fetch("/api/plaid/balances", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessToken }),
      }).then((r) => r.json());

      setBankAccounts(
        (accounts ?? []).map((a: any) => ({
          account_id: a.account_id,
          name: a.name,
          institution_name: a.institution_name ?? "Bank",
          balance: a.balances?.current ?? 0,
        }))
      );
      setPlaidConnected(true);
      setStep("review");
    } finally {
      setLoading(false);
    }
  }

  const assetItems: AssetItem[] = useMemo(() => {
    const items: AssetItem[] = [];

    // Vehicles
    for (const v of vehicles) {
      if (!v.description) continue;
      const exempt = v.primary_transport || rules.primary_vehicle_excluded;
      items.push({
        type: "vehicle",
        description: v.description,
        stated_value: v.stated_value,
        exempt,
        exemption_reason: exempt ? "primary_transport" : undefined,
        countable_value: exempt ? 0 : Math.max(0, v.stated_value - 4650), // federal equity over trade-in threshold
        verification_method: "self_declared",
      });
    }

    // Bank accounts from Plaid
    for (const acct of bankAccounts) {
      items.push({
        type: "bank_account",
        description: `${acct.institution_name} — ${acct.name}`,
        stated_value: acct.balance,
        exempt: false,
        countable_value: acct.balance,
        verification_method: "plaid_balance",
      });
    }

    // Cash on hand
    if (hasCash && cashAmount > 0) {
      items.push({
        type: "other_liquid",
        description: "Cash on hand",
        stated_value: cashAmount,
        exempt: false,
        countable_value: cashAmount,
        verification_method: "self_declared",
      });
    }

    // Retirement
    if (hasRetirement && retirementAmount > 0) {
      items.push({
        type: "retirement",
        description: "Retirement / deferred income account",
        stated_value: retirementAmount,
        exempt: rules.retirement_excluded,
        exemption_reason: rules.retirement_excluded ? "retirement_excluded" : undefined,
        countable_value: rules.retirement_excluded ? 0 : retirementAmount,
        verification_method: "self_declared",
      });
    }

    return items;
  }, [vehicles, bankAccounts, hasCash, cashAmount, hasRetirement, retirementAmount, rules]);

  const pkg: AssetPackage = useMemo(
    () =>
      buildAssetPackage({
        applicantName,
        stateCode,
        assets: assetItems,
        elderlyOrDisabled,
      }),
    [applicantName, stateCode, assetItems, elderlyOrDisabled]
  );

  async function savePackage() {
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

  const resultColor =
    pkg.asset_test_result === "pass"
      ? "good"
      : pkg.asset_test_result === "not_applicable"
        ? "neutral"
        : "bad";

  return (
    <>
      <div className="crumbs">
        <Link href="/">Home</Link> › Assets
      </div>
      <h1>Asset / resource verification</h1>
      <p className="sub">Flow 4 of 4. Estimated time: 2–3 minutes.</p>

      {step === "intake" && (
        <div className="card">
          <span className="step-tag">Step 1 · Intake</span>
          <h2>Tell us about your resources</h2>

          <label>State</label>
          <select value={stateCode} onChange={(e) => setStateCode(e.target.value as StateCode)}>
            <option value="CA">California (no asset test since Jan 2020)</option>
            <option value="MA">Massachusetts ($2,750 / $4,250 limit)</option>
          </select>

          {!rules.asset_test_applies && (
            <div className="banner good">
              {stateCode} does not apply a resource test for SNAP eligibility.
              This package is informational — assets are documented but not counted
              against a limit.
              <br />
              <span style={{ fontSize: 12 }}>{rules.citations[0]}</span>
            </div>
          )}

          <label>Applicant full name</label>
          <input value={applicantName} onChange={(e) => setApplicantName(e.target.value)} />

          {rules.asset_test_applies && (
            <>
              <label style={{ marginTop: 10 }}>
                Does any household member have a disability or is age 60+?
                <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 6 }}>
                  (increases limit to ${rules.elderly_disabled_limit_usd.toLocaleString()})
                </span>
              </label>
              <label className="checkrow">
                <input type="radio" checked={elderlyOrDisabled} onChange={() => setElderlyOrDisabled(true)} />
                Yes
              </label>
              <label className="checkrow">
                <input type="radio" checked={!elderlyOrDisabled} onChange={() => setElderlyOrDisabled(false)} />
                No
              </label>
            </>
          )}

          <label style={{ marginTop: 14 }}>Do you own any vehicles?</label>
          <label className="checkrow">
            <input type="radio" checked={hasVehicle} onChange={() => setHasVehicle(true)} /> Yes
          </label>
          <label className="checkrow">
            <input type="radio" checked={!hasVehicle} onChange={() => { setHasVehicle(false); setVehicles([]); }} /> No
          </label>

          {hasVehicle && vehicles.map((v, i) => (
            <div key={i} style={{ marginTop: 10, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8 }}>
              <label>Vehicle {i + 1} — description (year/make/model)</label>
              <input
                value={v.description}
                onChange={(e) => updateVehicle(i, { description: e.target.value })}
              />
              <label>Estimated value ($)</label>
              <input
                type="number"
                value={v.stated_value}
                onChange={(e) => updateVehicle(i, { stated_value: Number(e.target.value) || 0 })}
              />
              <label className="checkrow" style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={v.primary_transport}
                  onChange={(e) => updateVehicle(i, { primary_transport: e.target.checked })}
                />
                Primary means of transport (exempt in {stateCode})
              </label>
            </div>
          ))}
          {hasVehicle && (
            <button className="btn secondary" style={{ marginTop: 8, fontSize: 13 }} onClick={addVehicle}>
              + Add another vehicle
            </button>
          )}

          <label style={{ marginTop: 14 }}>Do you have cash on hand (&gt;$100)?</label>
          <label className="checkrow">
            <input type="radio" checked={hasCash} onChange={() => setHasCash(true)} /> Yes
          </label>
          <label className="checkrow">
            <input type="radio" checked={!hasCash} onChange={() => setHasCash(false)} /> No
          </label>
          {hasCash && (
            <>
              <label>Approximate cash amount ($)</label>
              <input type="number" value={cashAmount} onChange={(e) => setCashAmount(Number(e.target.value) || 0)} />
            </>
          )}

          <label style={{ marginTop: 14 }}>Do you have retirement / deferred income accounts?</label>
          <label className="checkrow">
            <input type="radio" checked={hasRetirement} onChange={() => setHasRetirement(true)} /> Yes
          </label>
          <label className="checkrow">
            <input type="radio" checked={!hasRetirement} onChange={() => setHasRetirement(false)} /> No
          </label>
          {hasRetirement && (
            <>
              <label>
                Total balance ($)
                {rules.retirement_excluded && (
                  <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 6 }}>
                    — excluded from countable assets in {stateCode}
                  </span>
                )}
              </label>
              <input type="number" value={retirementAmount} onChange={(e) => setRetirementAmount(Number(e.target.value) || 0)} />
            </>
          )}

          <div className="btn-row" style={{ marginTop: 16 }}>
            <button onClick={() => setStep("plaid")}>Continue to bank verification</button>
          </div>
        </div>
      )}

      {step === "plaid" && (
        <div className="card">
          <span className="step-tag">Step 2 · Plaid balance check</span>
          <h2>Connect bank account(s)</h2>
          <p className="hint">
            We use Plaid to read current balances on depository accounts.
            Balances are counted as liquid assets{rules.asset_test_applies ? ` toward the $${(elderlyOrDisabled ? rules.elderly_disabled_limit_usd : rules.standard_limit_usd).toLocaleString()} limit` : " (informational — no asset test in " + stateCode + ")"}.
          </p>
          <div className="btn-row">
            <button className="btn secondary" onClick={() => setStep("intake")}>Back</button>
            {!loading && (
              <PlaidLinkButton
                userId={applicantName}
                label="Connect bank with Plaid Link"
                onSuccess={(r) => onPlaidSuccess(r.access_token)}
                disabled={loading}
              />
            )}
            {loading && <button disabled className="btn">Reading balances…</button>}
            <button className="btn secondary" onClick={() => setStep("review")}>
              Skip (no bank account)
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <>
          <div className="card">
            <span className="step-tag">Step 3 · Review</span>
            <h2>
              Asset test:{" "}
              <span className={`pill ${resultColor}`}>
                {pkg.asset_test_result.replace("_", " ").toUpperCase()}
              </span>
            </h2>

            {rules.asset_test_applies && (
              <div className="kv" style={{ marginTop: 8 }}>
                <span className="k">Total countable assets</span>
                <span><strong>${pkg.total_countable_assets.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></span>
                <span className="k">Asset limit ({stateCode})</span>
                <span>${pkg.asset_limit_usd.toLocaleString()}</span>
              </div>
            )}

            <table className="txns" style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Stated value</th>
                  <th>Exempt?</th>
                  <th>Countable</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {pkg.assets.map((a, i) => (
                  <tr key={i}>
                    <td>{a.description}</td>
                    <td>{a.type}</td>
                    <td>${a.stated_value.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    <td>
                      {a.exempt
                        ? <span className="pill good">yes — {a.exemption_reason?.replace(/_/g, " ")}</span>
                        : "no"}
                    </td>
                    <td>${a.countable_value.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    <td>{a.verification_method}</td>
                  </tr>
                ))}
                {pkg.assets.length === 0 && (
                  <tr><td colSpan={6} style={{ color: "var(--muted)" }}>No assets entered</td></tr>
                )}
              </tbody>
            </table>

            <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
              {pkg.regulatory_citations.map((c, i) => <div key={i}>{c}</div>)}
            </div>
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
