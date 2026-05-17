"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SUA_AMOUNTS } from "@/lib/snap-calculator";
import type { StoredPackage, GigIncomePackage, SharedLeasePackage, UtilityPackage } from "@/types/verification";

export default function ReviewPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <ReviewInner />
    </Suspense>
  );
}

function ReviewInner() {
  const params = useSearchParams();
  const initialId = params.get("id");
  const [packages, setPackages] = useState<StoredPackage[]>([]);
  const [selected, setSelected] = useState<StoredPackage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/packages")
      .then((r) => r.json())
      .then((d) => {
        setPackages(d.packages ?? []);
        if (initialId) {
          const match = (d.packages ?? []).find((p: StoredPackage) => p.id === initialId);
          if (match) setSelected(match);
        }
      })
      .finally(() => setLoading(false));
  }, [initialId]);

  // Check whether there are packages of at least 2 different flow types → show combine panel
  const flowTypes = useMemo(
    () => new Set(packages.map((p) => p.flow)),
    [packages]
  );
  const showCombine = flowTypes.size >= 2;

  return (
    <>
      <div className="crumbs">
        <Link href="/">Home</Link> › Caseworker review
      </div>
      <h1>Caseworker review</h1>
      <p className="sub">All verification packages produced in this session.</p>

      {loading && <p>Loading…</p>}

      {!loading && packages.length === 0 && (
        <div className="card">
          <h2>No packages yet</h2>
          <p className="hint">
            Complete one of the three flows and save a package to see it here.
          </p>
        </div>
      )}

      {!loading && packages.length > 0 && (
        <>
          {showCombine && <CombinePanel packages={packages} />}
          <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, marginTop: showCombine ? 16 : 0 }}>
            <div className="card" style={{ padding: 12 }}>
              <h2 style={{ fontSize: 14, marginBottom: 8 }}>Packages</h2>
              {packages.map((p) => (
                <button
                  key={p.id}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: selected?.id === p.id ? "var(--accent-bg)" : "white",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    marginBottom: 6,
                    padding: "8px 10px",
                    fontWeight: 500,
                  }}
                  onClick={() => setSelected(p)}
                >
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{p.flow}</div>
                  <div>{p.applicant_name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.created_at}</div>
                </button>
              ))}
            </div>

            <div>
              {selected ? <PackageDetail pkg={selected} /> : <p>Select a package on the left.</p>}
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ---------- Combine panel ----------

function CombinePanel({ packages }: { packages: StoredPackage[] }) {
  const utilities = packages.filter((p) => p.flow === "utility");
  const leases = packages.filter((p) => p.flow === "shared-lease");
  const incomes = packages.filter((p) => p.flow === "gig-income");

  const [utilId, setUtilId] = useState(utilities[0]?.id ?? "");
  const [leaseId, setLeaseId] = useState(leases[0]?.id ?? "");
  const [incomeId, setIncomeId] = useState(incomes[0]?.id ?? "");
  const [hh, setHh] = useState(2);
  const [open, setOpen] = useState(false);

  const combinedUrl = useMemo(() => {
    const utilPkg = utilities.find((p) => p.id === utilId);
    const leasePkg = leases.find((p) => p.id === leaseId);
    const incomePkg = incomes.find((p) => p.id === incomeId);

    const state =
      (incomePkg?.package as GigIncomePackage | undefined)?.state_code ??
      (leasePkg?.package as SharedLeasePackage | undefined)?.state_code ??
      "CA";

    const earned =
      (incomePkg?.package as GigIncomePackage | undefined)?.total_monthly_declared ?? 0;

    const rent =
      (leasePkg?.package as SharedLeasePackage | undefined)?.stated_monthly_rent ?? 0;

    const utilTier =
      (utilPkg?.package as UtilityPackage | undefined)?.tier ?? "none";

    const suaAmount =
      utilTier === "none" ? 0 : SUA_AMOUNTS[state as keyof typeof SUA_AMOUNTS]?.[utilTier] ?? 0;

    const applicant = incomePkg?.applicant_name ?? leasePkg?.applicant_name ?? "";

    const p = new URLSearchParams({
      state,
      hh: String(hh),
      earned: String(Math.round(earned)),
      rent: String(rent),
      sua_amount: String(suaAmount),
      ...(applicant ? { applicant } : {}),
    });
    return `/verify/deductions?${p}`;
  }, [utilId, leaseId, incomeId, hh, utilities, leases, incomes]);

  return (
    <div className="card">
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <span className="step-tag">Caseworker tool</span>
          <h2 style={{ marginTop: 4, marginBottom: 0 }}>Combine packages for benefit estimate</h2>
        </div>
        <span style={{ fontSize: 20, color: "var(--muted)" }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{ marginTop: 14 }}>
          <p className="hint" style={{ marginTop: 0 }}>
            Select one package of each type to pull rent, income, and SUA tier into the benefit
            calculator automatically.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px", gap: 12, alignItems: "end" }}>
            <div>
              <label>Flow 1 · Utility (SUA tier)</label>
              <select value={utilId} onChange={(e) => setUtilId(e.target.value)}>
                <option value="">(none)</option>
                {utilities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.applicant_name} · {(p.package as UtilityPackage).tier.toUpperCase()} · {p.created_at.slice(0, 10)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Flow 2 · Shared lease (rent)</label>
              <select value={leaseId} onChange={(e) => setLeaseId(e.target.value)}>
                <option value="">(none)</option>
                {leases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.applicant_name} · ${(p.package as SharedLeasePackage).stated_monthly_rent}/mo · {p.created_at.slice(0, 10)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Flow 3 · Gig income (earned)</label>
              <select value={incomeId} onChange={(e) => setIncomeId(e.target.value)}>
                <option value="">(none)</option>
                {incomes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.applicant_name} · ${Math.round((p.package as GigIncomePackage).total_monthly_declared)}/mo · {p.created_at.slice(0, 10)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>HH size</label>
              <input
                type="number"
                min={1}
                max={20}
                value={hh}
                onChange={(e) => setHh(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          </div>

          <div className="btn-row" style={{ marginTop: 12 }}>
            <Link className="btn" href={combinedUrl}>
              Open benefit calculator →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function deductionsUrl(pkg: StoredPackage): string | null {
  const p = pkg.package;
  if (p.flow === "gig-income") {
    const gi = p as GigIncomePackage;
    const params = new URLSearchParams({
      state: gi.state_code,
      earned: String(Math.round(gi.total_monthly_declared)),
    });
    return `/verify/deductions?${params}`;
  }
  if (p.flow === "shared-lease") {
    const sl = p as SharedLeasePackage;
    const params = new URLSearchParams({
      state: sl.state_code,
      rent: String(sl.stated_monthly_rent),
    });
    return `/verify/deductions?${params}`;
  }
  return null;
}

function PackageDetail({ pkg }: { pkg: StoredPackage }) {
  const pdfUrl = `/api/packages/${pkg.id}/pdf`;
  const dedUrl = deductionsUrl(pkg);

  // Uploaded source document (Flow 2 only)
  const uploadId =
    pkg.package.flow === "shared-lease"
      ? (pkg.package as SharedLeasePackage).document_upload_id
      : undefined;

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span className="step-tag">{pkg.flow}</span>
          <h2 style={{ marginTop: 6 }}>{pkg.applicant_name}</h2>
          <p className="hint">
            Package ID: <code>{pkg.id}</code> · Generated: {pkg.created_at}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {dedUrl && (
            <Link className="btn secondary" href={dedUrl}>
              Calculate benefit →
            </Link>
          )}
          <a className="btn" href={pdfUrl} target="_blank">
            Download PDF
          </a>
        </div>
      </div>

      <PackageSummary pkg={pkg} />

      <h2 style={{ marginTop: 18 }}>Verification package PDF</h2>
      <iframe
        src={pdfUrl}
        title="Verification package PDF"
        style={{ width: "100%", height: 520, border: "1px solid var(--border)", borderRadius: 4 }}
      />

      {uploadId && (
        <>
          <h2 style={{ marginTop: 18 }}>Uploaded source document</h2>
          <iframe
            src={`/api/uploads/${uploadId}`}
            title="Uploaded source document"
            style={{ width: "100%", height: 480, border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </>
      )}

      <h2 style={{ marginTop: 18 }}>Raw package JSON</h2>
      <pre className="json">{JSON.stringify(pkg.package, null, 2)}</pre>
    </div>
  );
}

function PackageSummary({ pkg }: { pkg: StoredPackage }) {
  const p = pkg.package;
  if (p.flow === "utility") {
    return (
      <div className="kv" style={{ marginTop: 10 }}>
        <span className="k">SUA tier</span>
        <span>
          <span className={`pill ${p.tier === "full" ? "good" : "neutral"}`}>
            {p.tier.toUpperCase()}
          </span>
        </span>
        <span className="k">Basis</span>
        <span>{p.basis}</span>
        <span className="k">Name match</span>
        <span>{p.name_match ? "yes" : "no"}</span>
        <span className="k">Attestation required</span>
        <span>{p.attestation_required ? "yes" : "no"}</span>
        <span className="k">Service address</span>
        <span>{p.service_address}</span>
      </div>
    );
  }
  if (p.flow === "shared-lease") {
    return (
      <div className="kv" style={{ marginTop: 10 }}>
        <span className="k">QC defensibility</span>
        <span>
          <span
            className={`pill ${
              p.qc_defensibility_score === "strong"
                ? "good"
                : p.qc_defensibility_score === "moderate"
                  ? "warn"
                  : "bad"
            }`}
          >
            {p.qc_defensibility_score.toUpperCase()}
          </span>
        </span>
        <span className="k">Leaseholder</span>
        <span>{p.leaseholder_name}</span>
        <span className="k">Stated rent</span>
        <span>${p.stated_monthly_rent.toFixed(2)}</span>
        <span className="k">Document</span>
        <span>{p.document_type}</span>
        <span className="k">Bank match confidence</span>
        <span>{p.bank_payment_evidence.confidence}</span>
        <span className="k">Address valid</span>
        <span>{p.address_valid ? "yes" : "no"}</span>
      </div>
    );
  }
  if (p.flow === "gig-income") return (
    <div className="kv" style={{ marginTop: 10 }}>
      <span className="k">Total declared</span>
      <span><strong>${p.total_monthly_declared.toFixed(2)}/mo</strong></span>
      <span className="k">API-verified</span>
      <span>${p.total_monthly_verified.toFixed(2)}</span>
      <span className="k">Bank-corroborated</span>
      <span>${p.total_monthly_bank_corroborated.toFixed(2)}</span>
      <span className="k">Self-declared cash</span>
      <span>${p.total_monthly_self_declared_cash.toFixed(2)}</span>
      <span className="k">Reconciliation</span>
      <span>
        {p.reconciliation_flag ? (
          <span className="pill bad">FLAGGED · gap ${p.reconciliation_gap.toFixed(2)}</span>
        ) : (
          <span className="pill good">Clean</span>
        )}
      </span>
      <span className="k">Cash attestation</span>
      <span>{p.cash_attestation_signed ? "signed" : "not signed"}</span>
      <span className="k">CA BBCE</span>
      <span>
        {p.snap_bbce_applies ? (
          <span className="pill good">Applies — gross income test waived</span>
        ) : (
          <span className="pill neutral">Not applicable</span>
        )}
      </span>
    </div>
  );
  if (p.flow === "assets") {
    const resultColor =
      p.asset_test_result === "pass" ? "good" : p.asset_test_result === "not_applicable" ? "neutral" : "bad";
    return (
      <div className="kv" style={{ marginTop: 10 }}>
        <span className="k">Asset test</span>
        <span>
          <span className={`pill ${resultColor}`}>
            {p.asset_test_result.replace("_", " ").toUpperCase()}
          </span>
        </span>
        <span className="k">State</span>
        <span>{p.state_code}</span>
        <span className="k">Total countable</span>
        <span>${p.total_countable_assets.toFixed(2)}</span>
        {p.asset_test_applies && (
          <>
            <span className="k">Limit</span>
            <span>${p.asset_limit_usd.toLocaleString()}</span>
          </>
        )}
        <span className="k">Assets on record</span>
        <span>{p.assets.length}</span>
      </div>
    );
  }
  return null;
}
