import type { UtilityAccount } from "@/types/verification";

// UtilityAPI sandbox client.
//
// Real call (when UTILITYAPI_TOKEN is set):
//   GET https://utilityapi.com/api/v2/accounts?... (with Authorization: Bearer)
// Sandbox is rate-limited and returns fixture-style accounts. For the
// prototype, when no token is configured, we synthesize a plausible
// response shaped like the real API.
//
// Docs: https://utilityapi.com/docs/api/v2

export interface LookupParams {
  applicantName: string;
  serviceAddress: string;
}

export interface LookupResult {
  accounts: UtilityAccount[];
  name_match: boolean;
  source: "utilityapi_sandbox_live" | "utilityapi_sandbox_fixture";
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function namesMatch(a: string, b: string): boolean {
  const an = normalize(a);
  const bn = normalize(b);
  if (!an || !bn) return false;
  if (an === bn) return true;
  const [aFirst, ...aRest] = an.split(" ");
  const aLast = aRest[aRest.length - 1] ?? "";
  const [bFirst, ...bRest] = bn.split(" ");
  const bLast = bRest[bRest.length - 1] ?? "";
  return aFirst === bFirst && aLast === bLast;
}

export async function lookupAccounts(params: LookupParams): Promise<LookupResult> {
  const token = process.env.UTILITYAPI_TOKEN;
  if (token) {
    // Real sandbox call would go here. Left as a stub to keep the
    // prototype self-contained.
    // const res = await fetch("https://utilityapi.com/api/v2/accounts?...", {
    //   headers: { Authorization: `Bearer ${token}` },
    // });
  }

  // Fixture: address ending in "2" => account in landlord's name (mismatch).
  // Address ending in "3" => no accounts found. Otherwise => in applicant's name.
  const addr = params.serviceAddress.trim();
  const lastChar = addr.replace(/[^0-9]/g, "").slice(-1);

  if (lastChar === "3") {
    return { accounts: [], name_match: false, source: "utilityapi_sandbox_fixture" };
  }

  const heldBy =
    lastChar === "2" ? "Maria Landlord" : params.applicantName || "Applicant Unknown";

  const accounts: UtilityAccount[] = [
    {
      utility: "Pacific Gas & Electric",
      account_holder_name: heldBy,
      service_address: addr,
      account_status: "active",
      utility_type: "electric",
      source: "utilityapi_sandbox",
    },
    {
      utility: "Pacific Gas & Electric",
      account_holder_name: heldBy,
      service_address: addr,
      account_status: "active",
      utility_type: "gas",
      source: "utilityapi_sandbox",
    },
  ];

  return {
    accounts,
    name_match: namesMatch(heldBy, params.applicantName),
    source: "utilityapi_sandbox_fixture",
  };
}
