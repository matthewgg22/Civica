// 7 CFR 273.2(f) verification chains + reroute rules R-01..R-04.
// All 4 steps always present — rerouted steps flagged, never omitted.
// Core invariant: Component R may never remove information.

import type { VerificationStep, FeasibilityContext } from "./types";

// ─── Step template (before rerouting) ────────────────────────────────────────

interface StepTemplate {
  method: VerificationStep["method"];
  label: string;
  detail: string;
  citation: string;
  reroutableBy: Array<"R-01" | "R-02">;
}

// ─── Verification chain library ───────────────────────────────────────────────

const CHAINS: Record<string, StepTemplate[]> = {
  "income.wages": [
    {
      method: "document",
      label: "Recent pay stubs",
      detail: "Provide most recent 30 days of pay stubs, or an employer letter on letterhead.",
      citation: "7 CFR 273.2(f)(1)(i)",
      reroutableBy: [],
    },
    {
      method: "collateral_contact",
      label: "Employer contact",
      detail: "Agency contacts employer directly to verify employment and earnings.",
      citation: "7 CFR 273.2(f)(1)(ii)",
      reroutableBy: ["R-02"],
    },
    {
      method: "attestation",
      label: "Written statement",
      detail: "Signed written statement from applicant, acceptable when documentation is unavailable.",
      citation: "7 CFR 273.2(f)(1)(iv)",
      reroutableBy: [],
    },
    {
      method: "agency_assist",
      label: "Agency assistance",
      detail: "Agency must assist in obtaining verification; application may not be denied solely for inability to provide documents.",
      citation: "7 CFR 273.2(f)(4)",
      reroutableBy: [],
    },
  ],

  "income.gig": [
    {
      method: "document",
      label: "Platform earnings statement",
      detail: "Provide a 1099 form, earnings summary from the platform, or bank statements showing deposits.",
      citation: "7 CFR 273.2(f)(1)(i)",
      reroutableBy: [],
    },
    {
      method: "collateral_contact",
      label: "Platform contact",
      detail: "Agency contacts the gig platform to confirm earnings.",
      citation: "7 CFR 273.2(f)(1)(ii)",
      reroutableBy: ["R-02"],
    },
    {
      method: "attestation",
      label: "Written statement",
      detail: "Signed written statement from applicant.",
      citation: "7 CFR 273.2(f)(1)(iv)",
      reroutableBy: [],
    },
    {
      method: "agency_assist",
      label: "Agency assistance",
      detail: "Agency must assist in obtaining verification.",
      citation: "7 CFR 273.2(f)(4)",
      reroutableBy: [],
    },
  ],

  "income.se": [
    {
      method: "document",
      label: "Business records or tax return",
      detail: "Provide most recent tax return Schedule C, or business records showing net income.",
      citation: "7 CFR 273.2(f)(1)(i)",
      reroutableBy: [],
    },
    {
      method: "collateral_contact",
      label: "Third-party verification",
      detail: "Agency may contact a client, supplier, or business contact to verify self-employment activity.",
      citation: "7 CFR 273.2(f)(1)(ii)",
      reroutableBy: ["R-02"],
    },
    {
      method: "attestation",
      label: "Written statement",
      detail: "Signed written statement from applicant with best estimate of monthly net income.",
      citation: "7 CFR 273.2(f)(1)(iv)",
      reroutableBy: [],
    },
    {
      method: "agency_assist",
      label: "Agency assistance",
      detail: "Agency must assist in obtaining verification.",
      citation: "7 CFR 273.2(f)(4)",
      reroutableBy: [],
    },
  ],

  "shelter.rent": [
    {
      method: "document",
      label: "Lease or landlord letter",
      detail: "Lease, sublease agreement, or written landlord letter confirming shelter costs.",
      citation: "7 CFR 273.2(f)(1)(i)",
      reroutableBy: ["R-01"],
    },
    {
      method: "collateral_contact",
      label: "Landlord contact",
      detail: "Agency contacts landlord to verify shelter costs.",
      citation: "7 CFR 273.2(f)(1)(ii)",
      reroutableBy: ["R-01", "R-02"],
    },
    {
      method: "attestation",
      label: "Written statement",
      detail: "Written self-attestation of shelter costs.",
      citation: "7 CFR 273.2(f)(1)(iv)",
      reroutableBy: [],
    },
    {
      method: "agency_assist",
      label: "Agency assistance",
      detail: "Agency must assist in obtaining verification.",
      citation: "7 CFR 273.2(f)(4)",
      reroutableBy: [],
    },
  ],

  "shelter.sua_tier": [
    {
      method: "document",
      label: "Utility bill",
      detail: "Provide a recent utility bill showing the type of service (heating, electric/gas, phone).",
      citation: "7 CFR 273.2(f)(1)(i)",
      reroutableBy: [],
    },
    {
      method: "collateral_contact",
      label: "Utility provider contact",
      detail: "Agency contacts utility provider to confirm active service.",
      citation: "7 CFR 273.2(f)(1)(ii)",
      reroutableBy: [],
    },
    {
      method: "attestation",
      label: "Written statement",
      detail: "Signed written statement confirming utility type and responsibility.",
      citation: "7 CFR 273.2(f)(1)(iv)",
      reroutableBy: [],
    },
    {
      method: "agency_assist",
      label: "Agency assistance",
      detail: "Agency must assist in obtaining verification.",
      citation: "7 CFR 273.2(f)(4)",
      reroutableBy: [],
    },
  ],

  "deductions.medical": [
    {
      method: "document",
      label: "Medical statement or receipts",
      detail: "Provide medical bills, insurance statements, or pharmacy receipts showing out-of-pocket costs.",
      citation: "7 CFR 273.2(f)(1)(i)",
      reroutableBy: [],
    },
    {
      method: "collateral_contact",
      label: "Provider contact",
      detail: "Agency contacts medical provider to verify ongoing treatment costs.",
      citation: "7 CFR 273.2(f)(1)(ii)",
      reroutableBy: ["R-02"],
    },
    {
      method: "attestation",
      label: "Written statement",
      detail: "Signed written statement from applicant with best estimate of monthly medical costs.",
      citation: "7 CFR 273.2(f)(1)(iv)",
      reroutableBy: [],
    },
    {
      method: "agency_assist",
      label: "Agency assistance",
      detail: "Agency must assist in obtaining verification.",
      citation: "7 CFR 273.2(f)(4)",
      reroutableBy: [],
    },
  ],

  "deductions.child_support": [
    {
      method: "document",
      label: "Court order or payment record",
      detail: "Provide legal child support order or payment history.",
      citation: "7 CFR 273.2(f)(1)(i)",
      reroutableBy: [],
    },
    {
      method: "collateral_contact",
      label: "Agency or court contact",
      detail: "Agency contacts the child support enforcement agency to verify obligation.",
      citation: "7 CFR 273.2(f)(1)(ii)",
      reroutableBy: ["R-02"],
    },
    {
      method: "attestation",
      label: "Written statement",
      detail: "Signed written statement from applicant.",
      citation: "7 CFR 273.2(f)(1)(iv)",
      reroutableBy: [],
    },
    {
      method: "agency_assist",
      label: "Agency assistance",
      detail: "Agency must assist in obtaining verification.",
      citation: "7 CFR 273.2(f)(4)",
      reroutableBy: [],
    },
  ],

  "deductions.dependent_care": [
    {
      method: "document",
      label: "Provider receipt or statement",
      detail: "Provide receipt, contract, or written statement from the care provider.",
      citation: "7 CFR 273.2(f)(1)(i)",
      reroutableBy: [],
    },
    {
      method: "collateral_contact",
      label: "Provider contact",
      detail: "Agency contacts care provider to verify payment and necessity.",
      citation: "7 CFR 273.2(f)(1)(ii)",
      reroutableBy: ["R-02"],
    },
    {
      method: "attestation",
      label: "Written statement",
      detail: "Signed written statement from applicant.",
      citation: "7 CFR 273.2(f)(1)(iv)",
      reroutableBy: [],
    },
    {
      method: "agency_assist",
      label: "Agency assistance",
      detail: "Agency must assist in obtaining verification.",
      citation: "7 CFR 273.2(f)(4)",
      reroutableBy: [],
    },
  ],

  "shelter.homeless": [
    {
      method: "document",
      label: "Shelter provider letter",
      detail: "Letter from shelter provider, CoC/HMIS verification, or lodging receipt.",
      citation: "7 CFR 273.2(f)(1)(i)",
      reroutableBy: [],
    },
    {
      method: "collateral_contact",
      label: "Shelter provider contact",
      detail: "Agency contacts shelter provider or CoC to verify homeless status.",
      citation: "7 CFR 273.2(f)(1)(ii)",
      reroutableBy: ["R-02"],
    },
    {
      method: "attestation",
      label: "Written statement",
      detail: "Self-attestation is accepted for homeless deduction when documentation is unavailable.",
      citation: "7 CFR 273.2(f)(1)(iv)",
      reroutableBy: [],
    },
    {
      method: "agency_assist",
      label: "Agency assistance",
      detail: "Agency must assist in obtaining verification.",
      citation: "7 CFR 273.2(f)(4)",
      reroutableBy: [],
    },
  ],

  "default": [
    {
      method: "document",
      label: "Supporting document",
      detail: "Provide documentation supporting this field.",
      citation: "7 CFR 273.2(f)(1)(i)",
      reroutableBy: [],
    },
    {
      method: "collateral_contact",
      label: "Third-party contact",
      detail: "Agency contacts a third party to verify.",
      citation: "7 CFR 273.2(f)(1)(ii)",
      reroutableBy: ["R-02"],
    },
    {
      method: "attestation",
      label: "Written statement",
      detail: "Signed written statement from applicant.",
      citation: "7 CFR 273.2(f)(1)(iv)",
      reroutableBy: [],
    },
    {
      method: "agency_assist",
      label: "Agency assistance",
      detail: "Agency must assist in obtaining verification.",
      citation: "7 CFR 273.2(f)(4)",
      reroutableBy: [],
    },
  ],
};

// ─── Chain selector ───────────────────────────────────────────────────────────

function selectChain(field: string): StepTemplate[] {
  if (field.includes("shelter.rent")) return CHAINS["shelter.rent"]!;
  if (field.includes("shelter.sua_tier")) return CHAINS["shelter.sua_tier"]!;
  if (field.includes("shelter.homeless")) return CHAINS["shelter.homeless"]!;
  if (field.includes("type=wages") || field.includes("type=wages_contract"))
    return CHAINS["income.wages"]!;
  if (field.includes("type=platform_gig")) return CHAINS["income.gig"]!;
  if (field.includes("type=self_employment") || field.includes("type=farm_se"))
    return CHAINS["income.se"]!;
  if (field.includes("income") && field.includes("gross")) return CHAINS["income.wages"]!;
  if (field.includes("income") && field.includes("net")) return CHAINS["income.wages"]!;
  if (field.includes("medical")) return CHAINS["deductions.medical"]!;
  if (field.includes("child_support")) return CHAINS["deductions.child_support"]!;
  if (field.includes("dependent_care")) return CHAINS["deductions.dependent_care"]!;
  return CHAINS["default"]!;
}

// ─── Reroute application ──────────────────────────────────────────────────────

export function buildVerificationSteps(
  field: string,
  ctx: FeasibilityContext,
): VerificationStep[] {
  const templates = selectChain(field);

  return templates.map((tpl) => {
    const rerouteRule = tpl.reroutableBy.find((rule) => {
      if (rule === "R-01") return ctx.is_homeless;
      if (rule === "R-02") return ctx.is_dv_survivor;
      return false;
    });

    const rerouted = rerouteRule != null;
    const reroute_reason = rerouted
      ? rerouteRule === "R-01"
        ? "R-01: homeless — lease or landlord contact unavailable"
        : "R-02: safety routing — third-party contact rerouted to avoid disclosure risk"
      : undefined;

    return {
      method: tpl.method,
      label: tpl.label,
      detail: tpl.detail,
      citation: tpl.citation,
      rerouted,
      ...(reroute_reason ? { reroute_reason } : {}),
    };
  });
}

// ─── Top-level rerouted flag for a recommendation ────────────────────────────

export function isRerouted(steps: VerificationStep[]): boolean {
  return steps.some((s) => s.rerouted);
}

export function firstRerouteReason(steps: VerificationStep[]): string | undefined {
  return steps.find((s) => s.rerouted)?.reroute_reason;
}
