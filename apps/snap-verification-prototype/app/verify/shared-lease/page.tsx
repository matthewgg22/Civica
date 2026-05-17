"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  BankPaymentEvidence,
  SharedLeaseIntake,
  SharedLeasePackage,
  StateCode,
} from "@/types/verification";
import { analyzeRentTransactions, buildSharedLeasePackage } from "@/lib/package-builder";
import PlaidLinkButton from "@/components/PlaidLinkButton";

type Step = "intake" | "document" | "plaid" | "address" | "review";

export default function SharedLeaseFlow() {
  const [step, setStep] = useState<Step>("intake");
  const [stateCode, setStateCode] = useState<StateCode>("CA");
  const [applicantName, setApplicantName] = useState("Alex Applicant");
  const [intake, setIntake] = useState<SharedLeaseIntake>({
    lease_in_applicant_name: false,
    leaseholder_name: "Sam Leaseholder",
    stated_monthly_rent: 850,
    payment_method: "venmo_zelle",
    address: "1421 Mission St Apt 4, San Francisco, CA 94103",
  });

  const [documentType, setDocumentType] = useState<"sublease" | "landlord_letter" | "none">("landlord_letter");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [bankEvidence, setBankEvidence] = useState<BankPaymentEvidence | null>(null);
  const [addressValid, setAddressValid] = useState(false);
  const [addressNormalized, setAddressNormalized] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function onFileSelected(file: File) {
    setDocumentFile(file);
    setUploadId(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: form }).then((r) => r.json());
      setUploadId(res.upload_id ?? null);
    } finally {
      setUploading(false);
    }
  }

  async function onPlaidSuccess(accessToken: string) {
    setLoading(true);
    try {
      const { transactions } = await fetch("/api/plaid/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "rent",
          publicToken: accessToken,
          leaseholderName: intake.leaseholder_name,
          monthlyAmount: intake.stated_monthly_rent,
          paymentMethod: intake.payment_method,
        }),
      }).then((r) => r.json());

      setBankEvidence(
        analyzeRentTransactions(transactions, intake.stated_monthly_rent, intake.leaseholder_name ?? "")
      );
      setStep("address");
    } finally {
      setLoading(false);
    }
  }

  async function runUsps() {
    setLoading(true);
    try {
      const r = await fetch("/api/usps/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: intake.address }),
      }).then((res) => res.json());
      setAddressValid(!!r.valid && !!r.is_residential);
      setAddressNormalized(r.normalized);
      setStep("review");
    } finally {
      setLoading(false);
    }
  }

  const pkg: SharedLeasePackage | null = useMemo(() => {
    if (!bankEvidence) return null;
    return buildSharedLeasePackage({
      applicantName,
      stateCode,
      intake,
      documentType,
      documentFilename: documentFile?.name,
      documentUploadId: uploadId ?? undefined,
      bankEvidence,
      addressValid,
      addressNormalized,
    });
  }, [applicantName, intake, documentType, documentFile, bankEvidence, addressValid, addressNormalized]);

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

  const letterUrl = `/api/landlord-letter?address=${encodeURIComponent(intake.address)}&leaseholder=${encodeURIComponent(intake.leaseholder_name ?? "")}&applicant=${encodeURIComponent(applicantName)}&amount=${intake.stated_monthly_rent}`;

  return (
    <>
      <div className="crumbs">
        <Link href="/">Home</Link> › Shared lease
      </div>
      <h1>Shared lease / non-primary leaseholder</h1>
      <p className="sub">Flow 2 of 3. Estimated time: 3–4 minutes.</p>

      {step === "intake" && (
        <div className="card">
          <span className="step-tag">Step 1 · Intake</span>
          <h2>Tell us about your lease</h2>

          <label>State</label>
          <select value={stateCode} onChange={(e) => setStateCode(e.target.value as StateCode)}>
            <option value="CA">California</option>
            <option value="MA">Massachusetts</option>
          </select>

          <label>Applicant full name</label>
          <input value={applicantName} onChange={(e) => setApplicantName(e.target.value)} />

          <label style={{ marginTop: 10 }}>Is the lease or rental agreement in your name?</label>
          <div>
            <label className="checkrow">
              <input
                type="radio"
                name="lease"
                checked={intake.lease_in_applicant_name}
                onChange={() => setIntake({ ...intake, lease_in_applicant_name: true })}
              />
              Yes
            </label>
            <label className="checkrow">
              <input
                type="radio"
                name="lease"
                checked={!intake.lease_in_applicant_name}
                onChange={() => setIntake({ ...intake, lease_in_applicant_name: false })}
              />
              No
            </label>
          </div>

          {!intake.lease_in_applicant_name && (
            <>
              <label>Primary leaseholder name</label>
              <input
                value={intake.leaseholder_name ?? ""}
                onChange={(e) => setIntake({ ...intake, leaseholder_name: e.target.value })}
              />
            </>
          )}

          <label>Your monthly share of rent</label>
          <input
            type="number"
            value={intake.stated_monthly_rent}
            onChange={(e) =>
              setIntake({ ...intake, stated_monthly_rent: Number(e.target.value) || 0 })
            }
          />

          <label>How do you pay your share?</label>
          <select
            value={intake.payment_method}
            onChange={(e) =>
              setIntake({ ...intake, payment_method: e.target.value as SharedLeaseIntake["payment_method"] })
            }
          >
            <option value="bank_transfer">Bank transfer / ACH</option>
            <option value="venmo_zelle">Venmo / Zelle / Cash App</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>

          <label>Residence address</label>
          <input value={intake.address} onChange={(e) => setIntake({ ...intake, address: e.target.value })} />

          <div className="btn-row">
            <button onClick={() => setStep("document")}>Continue</button>
          </div>
        </div>
      )}

      {step === "document" && (
        <div className="card">
          <span className="step-tag">Step 2 · Supporting document</span>
          <h2>Upload a sublease or landlord letter</h2>

          <label>Document type</label>
          <select value={documentType} onChange={(e) => setDocumentType(e.target.value as typeof documentType)}>
            <option value="sublease">Formal sublease agreement</option>
            <option value="landlord_letter">Landlord / leaseholder letter</option>
            <option value="none">No document available</option>
          </select>

          {documentType === "landlord_letter" && (
            <div className="banner good">
              No letter yet?{" "}
              <a href={letterUrl} target="_blank" rel="noreferrer">
                Download a pre-filled fillable template
              </a>{" "}
              with this address, leaseholder name, applicant name, and amount.
            </div>
          )}

          {documentType !== "none" && (
            <>
              <label>Upload file (PDF or image)</label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFileSelected(f);
                }}
              />
              {uploading && <p className="hint">Uploading…</p>}
              {documentFile && !uploading && (
                <p className="hint">
                  <strong>{documentFile.name}</strong> ({Math.round(documentFile.size / 1024)} KB)
                  {uploadId ? (
                    <span style={{ color: "var(--good)" }}> · Saved (ID: {uploadId.slice(0, 8)}…)</span>
                  ) : (
                    <span style={{ color: "var(--bad)" }}> · Upload failed</span>
                  )}
                </p>
              )}
            </>
          )}

          <div className="btn-row">
            <button className="btn secondary" onClick={() => setStep("intake")}>
              Back
            </button>
            <button onClick={() => setStep("plaid")}>Continue</button>
          </div>
        </div>
      )}

      {step === "plaid" && (
        <div className="card">
          <span className="step-tag">Step 3 · Plaid bank verification</span>
          <h2>Scan 90 days of bank transactions for rent payments</h2>
          <p className="hint">
            Connect your bank via Plaid Link, then we scan for recurring transfers matching{" "}
            <strong>${intake.stated_monthly_rent}/mo</strong> to{" "}
            <strong>{intake.leaseholder_name}</strong> within ±15% on a monthly cadence.
          </p>
          <div className="btn-row">
            <button className="btn secondary" onClick={() => setStep("document")}>
              Back
            </button>
            {!loading && (
              <PlaidLinkButton
                userId={applicantName}
                label="Connect bank with Plaid Link"
                onSuccess={(r) => onPlaidSuccess(r.access_token)}
                disabled={loading}
              />
            )}
            {loading && <button disabled className="btn">Analyzing transactions…</button>}
          </div>
        </div>
      )}

      {step === "address" && (
        <div className="card">
          <span className="step-tag">Step 4 · USPS address validation</span>
          <h2>Confirm residence address</h2>
          <p className="hint">Validate that the address is residential and matches on-file information.</p>
          <div className="kv">
            <span className="k">Address</span>
            <span>{intake.address}</span>
          </div>
          <div className="btn-row">
            <button className="btn secondary" onClick={() => setStep("plaid")}>
              Back
            </button>
            <button disabled={loading} onClick={runUsps}>
              {loading ? "Validating…" : "Run USPS validation"}
            </button>
          </div>
        </div>
      )}

      {step === "review" && pkg && (
        <>
          <div className="card">
            <span className="step-tag">Step 5 · Review</span>
            <h2>
              QC defensibility:{" "}
              <span
                className={`pill ${
                  pkg.qc_defensibility_score === "strong"
                    ? "good"
                    : pkg.qc_defensibility_score === "moderate"
                      ? "warn"
                      : "bad"
                }`}
              >
                {pkg.qc_defensibility_score.toUpperCase()}
              </span>
            </h2>
            <div className="kv" style={{ marginTop: 10 }}>
              <span className="k">Lease in applicant's name</span>
              <span>{pkg.lease_in_applicant_name ? "yes" : "no"}</span>
              <span className="k">Leaseholder</span>
              <span>{pkg.leaseholder_name}</span>
              <span className="k">Stated monthly rent</span>
              <span>${pkg.stated_monthly_rent.toFixed(2)}</span>
              <span className="k">Document</span>
              <span>
                {pkg.document_type}
                {pkg.document_filename ? ` · ${pkg.document_filename}` : ""}
              </span>
              <span className="k">Bank match</span>
              <span>
                {pkg.bank_payment_evidence.match_found
                  ? `yes · ${pkg.bank_payment_evidence.confidence} confidence · ${pkg.bank_payment_evidence.months_confirmed} months`
                  : "no"}
              </span>
              <span className="k">Address valid</span>
              <span>{pkg.address_valid ? "yes" : "no"}</span>
              <span className="k">Regulatory citations</span>
              <span style={{ fontSize: 12 }}>{pkg.regulatory_citations.join(" · ")}</span>
            </div>

            {pkg.bank_payment_evidence.matched_transactions.length > 0 && (
              <table className="txns">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {pkg.bank_payment_evidence.matched_transactions.map((t, i) => (
                    <tr key={i}>
                      <td>{t.date}</td>
                      <td>${t.amount.toFixed(2)}</td>
                      <td>{t.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
