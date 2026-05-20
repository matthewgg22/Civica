import { getCache, setCache } from "./cache.js";

export type Deliverability = "deliverable" | "deliverable-missing-unit" | "undeliverable" | "unavailable";

export interface SmartyResult {
  deliverability: Deliverability;
  rdi: "Residential" | "Commercial" | "Unknown";
  advisory?: string;
}

interface SmartyCandidate {
  metadata?: { rdi?: string };
  analysis?: { dpv_match_code?: string };
}

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days — address data is stable

export async function validateAddress(
  street: string,
  city: string,
  state: string,
  zip: string,
  authId: string,
  authToken: string,
): Promise<SmartyResult> {
  const cacheKey = `smarty:${street}:${city}:${state}:${zip}`;
  const cached = getCache<SmartyResult>(cacheKey);
  if (cached) return cached;

  let result: SmartyResult = { deliverability: "unavailable", rdi: "Unknown" };

  try {
    const params = new URLSearchParams({
      "auth-id": authId,
      "auth-token": authToken,
      street,
      city,
      state,
      zipcode: zip,
      candidates: "1",
    });
    const res = await fetch(`https://us-street.api.smarty.com/street-address?${params}`);
    if (res.ok) {
      const candidates = (await res.json()) as SmartyCandidate[];
      const c = candidates[0];
      if (!c) {
        result = { deliverability: "undeliverable", rdi: "Unknown" };
      } else {
        const code = c.analysis?.dpv_match_code;
        const rdi = (c.metadata?.rdi ?? "Unknown") as SmartyResult["rdi"];

        if (code === "Y") {
          result = { deliverability: "deliverable", rdi };
        } else if (code === "S" || code === "D") {
          result = {
            deliverability: "deliverable-missing-unit",
            rdi,
            advisory: "Address confirmed but no unit/secondary number — verify with applicant",
          };
        } else {
          result = { deliverability: "undeliverable", rdi };
        }
      }
      setCache(cacheKey, result, CACHE_TTL_SECONDS);
    }
  } catch {
    // Network error — return unavailable
  }

  return result;
}
