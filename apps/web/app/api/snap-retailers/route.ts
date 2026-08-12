// Stores near a ZIP that accept EBT, from USDA's SNAP Retailer Locator.
//
// A national choropleth answers "is it everywhere?" and nothing else. The
// question someone actually has is "can I use this at the shop on my corner",
// and that needs a live lookup — 250,000 rows cannot be precomputed into a page
// the way the per-state counts were.
//
// PROXIED through our own route rather than called from the browser, for three
// reasons: the page's CSP does not have to admit a third-party host; a ZIP is
// a coarse location and it should not be handed to ArcGIS with the visitor's IP
// attached; and the response can be cached, since which shops take EBT does not
// change minute to minute.

import { NextResponse } from "next/server";

const SERVICE =
  "https://services1.arcgis.com/RLQu0rK7h4kbsBq5/arcgis/rest/services/" +
  "snap_retailer_location_data/FeatureServer/0/query";

/** Enough to be useful, few enough to read. Someone scanning for a shop they
 *  recognise does not need the 90th result. */
const LIMIT = 40;

export interface RetailerHit {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  type: string;
  lat: number | null;
  lon: number | null;
}

export async function GET(req: Request) {
  const zip = new URL(req.url).searchParams.get("zip")?.trim() ?? "";
  // Exactly five digits. The value is interpolated into a where-clause, so it
  // is validated by SHAPE rather than escaped — nothing that is not five digits
  // ever reaches the query.
  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: "bad_zip", stores: [] }, { status: 400 });
  }

  const params = new URLSearchParams({
    where: `Zip_Code='${zip}'`,
    outFields: "Store_Name,Store_Street_Address,City,State,Zip_Code,Store_Type,Latitude,Longitude",
    returnGeometry: "false",
    orderByFields: "Store_Name ASC",
    resultRecordCount: String(LIMIT),
    f: "json",
  });

  try {
    const res = await fetch(`${SERVICE}?${params}`, {
      // A day. The dataset is refreshed on a much slower cycle than that, and a
      // stale shop is a far smaller problem than a page that waits on ArcGIS.
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as {
      features?: { attributes: Record<string, unknown> }[];
      error?: unknown;
    };
    if (data.error) throw new Error("service error");

    const stores: RetailerHit[] = (data.features ?? []).map((f) => {
      const a = f.attributes;
      return {
        name: String(a.Store_Name ?? "").trim(),
        address: String(a.Store_Street_Address ?? "").trim(),
        city: String(a.City ?? "").trim(),
        state: String(a.State ?? "").trim(),
        zip: String(a.Zip_Code ?? "").trim(),
        type: String(a.Store_Type ?? "").trim(),
        lat: typeof a.Latitude === "number" ? a.Latitude : null,
        lon: typeof a.Longitude === "number" ? a.Longitude : null,
      };
    });

    return NextResponse.json({ zip, stores, truncated: stores.length >= LIMIT });
  } catch {
    // A dead lookup must not read as "there are no shops near you". The client
    // distinguishes this from an empty result and says so.
    return NextResponse.json({ error: "unavailable", stores: [] }, { status: 502 });
  }
}
