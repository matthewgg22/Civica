"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  StateCode,
  UtilityAccount,
  UtilityIntake,
  UtilityPackage,
} from "@/types/verification";
import { buildUtilityPackage, determineSuaTier } from "@/lib/package-builder";
import { STATE_SUA_RULES } from "@/lib/sua-rules";

type Step = "intake" | "lookup" | "review";

export default function UtilityFlowPage() {
  const [step, setStep] = useState<Step>("intake");
  const [applicantName, setApplicantName] = useState("Alex Applicant");
  const [serviceAddress, setServiceAddress] = useState("1421 Mission St, San Francisco, CA 94103");

  const [intake, setIntake] = useState<UtilityIntake>({
    state_code: "CA",
    landlord_pays_any: false,
    utilities_paid_by_applicant: {
      heat_gas: true,
      electricity: true,
      cooling: false,
      water: false,
      phone_internet: false,
      none: false,
    },
  });

  const [accounts, setAccounts] = useState<UtilityAccount[]>([]);
  const [nameMatch, setNameMatch] = useState(false);
  const [lookupSource, setLookupSource] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const previewTier = useMemo(() => determineSuaTier(intake), [intake]);

  function toggle(key: keyof UtilityIntake["utilities_paid_by_applicant"]) {
    setIntake((s) => {
      const u = { ...s.utilities_paid_by_applicant, [key]: !s.utilities_paid_by_applicant[key] };
      if (key === "none" && u.none) {
        u.heat_gas = u.electricity = u.cooling = u.water = u.phone_internet = false;
      } else if (key !== "none") {
        u.none = false;
      }
      return { ...s, utilities_paid_by_applicant: u };
    });
  }

  async function runLookup() {
    setLoading(true);
    try {
      const res = await fetch("/api/utilityapi/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applicantName, serviceAddress }),
      }).then((r) => r.json());
      setAccounts(res.accounts ?? []);
      setNameMatch(!!res.name_match);
      setLookupSource(res.source ?? "");
      setStep("review");
    } finally {
      setLoading(false);
    }
  }

  const pkg: UtilityPackage = useMemo(
    () =>
      buildUtilityPackage({
        applicantName,
        serviceAddress,
        intake,
        accounts,
        nameMatch,
      }),
    [applicantName, serviceAddress, intake, accounts, nameMatch]
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

  return (
    <>
      <div className="crumbs">
        <Link href="/">Home</Link> › Utility / SUA
      </div>
      <h1>Utility / SUA tier determination</h1>
      <p className="sub">Flow 1 of 3. Estimated time: 2 minutes.</p>

      {step === "intake" && (
        <div className="card">
          <span className="step-tag">Step 1 · Intake</span>
          <h2>Tell us about your utilities</h2>

          <label>State</label>
          <select
            value={intake.state_code}
            onChange={(e) => setIntake({ ...intake, state_code: e.target.value as StateCode })}
          >
            <option value="CA">California (HCSUA includes A/C)</option>
            <option value="MA">Massachusetts</option>
          </select>

          <label>Applicant full name</label>
          <input value={applicantName} onChange={(e) => setApplicantName(e.target.value)} />

          <label>Service address</label>
          <input value={serviceAddress} onChange={(e) => setServiceAddress(e.target.value)} />

          <label style={{ marginTop: 16 }}>
            Does your landlord pay any of your utility bills, or are any utilities included in your rent?
          </label>
          <div>
            <label className="checkrow">
              <input
                type="radio"
                name="lp"
                checked={intake.landlord_pays_any}
                onChange={() => setIntake({ ...intake, landlord_pays_any: true })}
              />
              Yes
            </label>
            <label className="checkrow">
              <input
                type="radio"
                name="lp"
                checked={!intake.landlord_pays_any}
                onChange={() => setIntake({ ...intake, landlord_pays_any: false })}
              />
              No
            </label>
          </div>

          <label>Which utilities do YOU pay directly?</label>
          <label className="checkrow">
            <input
              type="checkbox"
              checked={intake.utilities_paid_by_applicant.heat_gas}
              onChange={() => toggle("heat_gas")}
            />
            Heat / gas
          </label>
          <label className="checkrow">
            <input
              type="checkbox"
              checked={intake.utilities_paid_by_applicant.electricity}
              onChange={() => toggle("electricity")}
            />
            Electricity
          </label>
          <label className="checkrow">
            <input
              type="checkbox"
              checked={intake.utilities_paid_by_applicant.cooling}
              onChange={() => toggle("cooling")}
            />
            Cooling / air conditioning (separate from electric){" "}
            {intake.state_code === "CA" && (
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                — counts toward HCSUA in CA
              </span>
            )}
          </label>
          <label className="checkrow">
            <input
              type="checkbox"
              checked={intake.utilities_paid_by_applicant.water}
              onChange={() => toggle("water")}
            />
            Water
          </label>
          <label className="checkrow">
            <input
              type="checkbox"
              checked={intake.utilities_paid_by_applicant.phone_internet}
              onChange={() => toggle("phone_internet")}
            />
            Phone / internet
          </label>
          <label className="checkrow">
            <input
              type="checkbox"
              checked={intake.utilities_paid_by_applicant.none}
              onChange={() => toggle("none")}
            />
            None of the above
          </label>

          <div className="banner good" style={{ marginTop: 14 }}>
            Preview SUA tier: <strong>{previewTier.toUpperCase()}</strong>
            {previewTier !== "none" && (
              <>
                {" "}
                — {intake.state_code} amount{" "}
                <strong>
                  $
                  {previewTier === "full"
                    ? STATE_SUA_RULES[intake.state_code].amounts_usd.full
                    : previewTier === "limited"
                      ? STATE_SUA_RULES[intake.state_code].amounts_usd.limited
                      : STATE_SUA_RULES[intake.state_code].amounts_usd.telephone}
                  /mo
                </strong>
              </>
            )}
            <br />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {STATE_SUA_RULES[intake.state_code].citation}
            </span>
          </div>

          <div className="btn-row">
            <button onClick={() => setStep("lookup")}>Continue</button>
          </div>
        </div>
      )}

      {step === "lookup" && (
        <div className="card">
          <span className="step-tag">Step 2 · UtilityAPI lookup</span>
          <h2>Find utility accounts at this address</h2>
          <p className="hint">
            We query UtilityAPI (sandbox) for active utility accounts at the service address and
            check whether any are in the applicant's name.
          </p>
          <div className="kv">
            <span className="k">Applicant</span>
            <span>{applicantName}</span>
            <span className="k">Service address</span>
            <span>{serviceAddress}</span>
          </div>
          <div className="btn-row">
            <button className="btn secondary" onClick={() => setStep("intake")}>
              Back
            </button>
            <button disabled={loading} onClick={runLookup}>
              {loading ? "Querying UtilityAPI…" : "Run lookup"}
            </button>
          </div>
          <p className="hint" style={{ marginTop: 16 }}>
            Tip — try addresses ending in <code>…2</code> (account in landlord's name → conflict)
            or <code>…3</code> (no accounts → self-declared) to exercise edge cases.
          </p>
        </div>
      )}

      {step === "review" && (
        <>
          <div className="card">
            <span className="step-tag">Step 3 · SUA tier</span>
            <h2>
              Determined tier:{" "}
              <span
                className={`pill ${
                  pkg.tier === "full" ? "good" : pkg.tier === "none" ? "bad" : "neutral"
                }`}
              >
                {pkg.tier.toUpperCase()}
              </span>{" "}
              {pkg.tier_amount_usd > 0 && (
                <span className="pill neutral">
                  ${pkg.tier_amount_usd}/mo · {pkg.state_code}
                </span>
              )}{" "}
              <span
                className={`pill ${
                  pkg.basis === "api_confirmed"
                    ? "good"
                    : pkg.basis === "conflicting"
                      ? "bad"
                      : "warn"
                }`}
              >
                basis: {pkg.basis}
              </span>
            </h2>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 8px" }}>
              {pkg.rule_citation}
            </p>
            <p className="hint">
              {pkg.basis === "api_confirmed" &&
                "Utility accounts confirmed in applicant's name. No additional attestation required."}
              {pkg.basis === "conflicting" &&
                "Applicant declares paying utilities but accounts are held in another name. Caseworker review required."}
              {pkg.basis === "self_declared" &&
                "No corroborating utility accounts found. A signed self-attestation is required."}
            </p>

            <div className="kv" style={{ marginTop: 10 }}>
              <span className="k">Source</span>
              <span>{lookupSource}</span>
              <span className="k">Accounts found</span>
              <span>{pkg.utility_accounts_found.length}</span>
              <span className="k">Name match</span>
              <span>{pkg.name_match ? "yes" : "no"}</span>
              <span className="k">Attestation required</span>
              <span>{pkg.attestation_required ? "yes" : "no"}</span>
            </div>

            {pkg.utility_accounts_found.length > 0 && (
              <table className="txns">
                <thead>
                  <tr>
                    <th>Utility</th>
                    <th>Type</th>
                    <th>Account holder</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pkg.utility_accounts_found.map((a, i) => (
                    <tr key={i}>
                      <td>{a.utility}</td>
                      <td>{a.utility_type}</td>
                      <td>{a.account_holder_name}</td>
                      <td>{a.account_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <span className="step-tag">Step 4 · Output package</span>
            <h2>Verification package preview</h2>
            <pre className="json">{JSON.stringify(pkg, null, 2)}</pre>
            <div className="btn-row">
              <button className="btn secondary" onClick={() => setStep("lookup")}>
                Back
              </button>
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
