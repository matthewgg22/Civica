// Argyle sandbox client.
//
// Real flow:
//   1. POST /v2/user-tokens → user_token for the Argyle Link widget
//   2. Frontend opens Argyle Link, user connects employer/platform
//   3. Backend polls /v2/accounts and /v2/paystubs (or /v2/gigs) for
//      earnings data.
//
// Prototype: synthesize.

import type { GigPlatform } from "@/types/verification";

export interface UserTokenResponse {
  user_token: string;
  user_id: string;
  expires_at: string;
}

export async function createUserToken(applicantName: string): Promise<UserTokenResponse> {
  return {
    user_token: `argyle-sandbox-${Math.random().toString(36).slice(2, 12)}`,
    user_id: `usr_${applicantName.replace(/\s+/g, "_").toLowerCase()}`,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

export interface Earnings90d {
  source: string;
  source_type: "w2" | "platform_gig";
  gross_90d: number;
  monthly_average: number;
  pay_period_count: number;
  source_id: string;
}

const PLATFORM_RATES: Record<GigPlatform, number> = {
  doordash: 1100,
  uber: 1400,
  lyft: 950,
  instacart: 850,
  taskrabbit: 600,
  amazon_flex: 1200,
  other: 700,
};

export async function fetchW2Earnings(employerName: string): Promise<Earnings90d> {
  const monthly = 2400 + Math.round(Math.random() * 600);
  return {
    source: employerName,
    source_type: "w2",
    gross_90d: monthly * 3,
    monthly_average: monthly,
    pay_period_count: 6,
    source_id: `argyle_${employerName.replace(/\s+/g, "_").toLowerCase()}`,
  };
}

export async function fetchPlatformEarnings(platform: GigPlatform): Promise<Earnings90d> {
  const monthly = PLATFORM_RATES[platform] + Math.round(Math.random() * 150);
  return {
    source: platform,
    source_type: "platform_gig",
    gross_90d: monthly * 3,
    monthly_average: monthly,
    pay_period_count: 12,
    source_id: `argyle_${platform}`,
  };
}
