import { getCache, setCache } from "./cache.js";

export interface FMRResult {
  zip: string;
  bedroom_count: 0 | 1 | 2 | 3 | 4;
  fmr: number | null;
  fy: number;
  source: "hud_api" | "unavailable";
}

const BEDROOM_LABEL: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "Efficiency",
  1: "One-Bedroom",
  2: "Two-Bedroom",
  3: "Three-Bedroom",
  4: "Four-Bedroom",
};

// HUD 24 CFR Part 982: voucher bedroom size by household size.
export function householdSizeToBedrooms(size: number): 0 | 1 | 2 | 3 | 4 {
  if (size <= 1) return 0;
  if (size <= 2) return 1;
  if (size <= 4) return 2;
  if (size <= 6) return 3;
  return 4;
}

const HUD_BASE = "https://www.huduser.gov/hudapi/public";
const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

interface HudFmrResponse {
  data?: {
    basicdata?: Record<string, number>;
  };
}

export async function fetchFMR(
  zip: string,
  bedroom_count: 0 | 1 | 2 | 3 | 4,
  hudToken: string,
  fy = 2026,
): Promise<FMRResult> {
  const cacheKey = `hud-fmr:${zip}:${bedroom_count}:${fy}`;
  const cached = getCache<FMRResult>(cacheKey);
  if (cached) return cached;

  let fmr: number | null = null;
  try {
    const res = await fetch(`${HUD_BASE}/fmr/byzip/${zip}?year=${fy}`, {
      headers: { Authorization: `Bearer ${hudToken}` },
    });
    if (res.ok) {
      const json = (await res.json()) as HudFmrResponse;
      const label = BEDROOM_LABEL[bedroom_count];
      const val = json.data?.basicdata?.[label];
      if (typeof val === "number") fmr = val;
    }
  } catch {
    // Network error — return unavailable
  }

  const result: FMRResult = {
    zip,
    bedroom_count,
    fmr,
    fy,
    source: fmr !== null ? "hud_api" : "unavailable",
  };

  if (fmr !== null) {
    setCache(cacheKey, result, CACHE_TTL_SECONDS);
  }

  return result;
}
