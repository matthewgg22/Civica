import Link from "next/link";

export default function Home() {
  return (
    <>
      <h1>SNAP Verification Prototype</h1>
      <p className="sub">
        Three self-contained verification flows. Each produces a structured JSON
        package and a human-readable PDF designed to meet SNAP QC evidentiary
        standards.
      </p>

      <div className="tile-grid">
        <Link className="tile" href="/verify/utility">
          <span className="step-tag">Flow 1</span>
          <h3>Utility / SUA tier</h3>
          <p>Intake + UtilityAPI account match → Full / Limited / Telephone / None.</p>
        </Link>
        <Link className="tile" href="/verify/shared-lease">
          <span className="step-tag">Flow 2</span>
          <h3>Shared lease</h3>
          <p>Intake + landlord letter + Plaid rent transfer detection + USPS validation.</p>
        </Link>
        <Link className="tile" href="/verify/gig-income">
          <span className="step-tag">Flow 3</span>
          <h3>Gig / multi-source income</h3>
          <p>Argyle W-2 + platform earnings, Plaid deposit corroboration, cash attestation.</p>
        </Link>
        <Link className="tile" href="/verify/assets">
          <span className="step-tag">Flow 4</span>
          <h3>Asset / resource test</h3>
          <p>Vehicles, Plaid account balances, cash, retirement — CA vs MA limits with exemptions.</p>
        </Link>
        <Link className="tile" href="/verify/deductions">
          <span className="step-tag">Caseworker</span>
          <h3>Benefit estimate</h3>
          <p>Enter income + shelter figures from completed flows to compute estimated SNAP allotment.</p>
        </Link>
        <Link className="tile" href="/review" style={{ gridColumn: "1 / -1" }}>
          <span className="step-tag">Caseworker</span>
          <h3>Review packages</h3>
          <p>List, inspect, and download completed verification packages as PDF.</p>
        </Link>
      </div>
    </>
  );
}
