import { describe, expect, it } from "vitest";
import { makeUSPSClient } from "../src/usps/client.js";
import { makeFakeFetch } from "./helpers/fakeFetch.js";

const baseUrl = "https://apis.usps.test";

function client(routes: Parameters<typeof makeFakeFetch>[0]) {
  return makeUSPSClient({
    credentials: { clientId: "id", clientSecret: "secret" },
    baseUrl,
    fetchImpl: makeFakeFetch(routes),
  });
}

describe("USPSClient", () => {
  it("caches the OAuth token across calls", async () => {
    let tokenCalls = 0;
    const c = makeUSPSClient({
      credentials: { clientId: "id", clientSecret: "secret" },
      baseUrl,
      fetchImpl: makeFakeFetch([
        {
          match: (req) => {
            if (req.url.endsWith("/oauth2/v3/token")) {
              tokenCalls++;
              return true;
            }
            return false;
          },
          fixture: "usps/token.json",
        },
        { match: (req) => req.url.includes("/addresses/v3/address"), fixture: "usps/validate-la.json" },
      ]),
    });
    await c.validate({ street: "1100 S Broadway", city: "Los Angeles", state: "CA", zip: "90015" });
    await c.validate({ street: "1100 S Broadway", city: "Los Angeles", state: "CA", zip: "90015" });
    expect(tokenCalls).toBe(1);
  });

  it("returns normalized address with DPV=Y for a deliverable address", async () => {
    const c = client([
      { match: (req) => req.url.endsWith("/oauth2/v3/token"), fixture: "usps/token.json" },
      { match: (req) => req.url.includes("/addresses/v3/address"), fixture: "usps/validate-la.json" },
    ]);
    const r = await c.validate({ street: "1100 S Broadway", city: "Los Angeles", state: "CA", zip: "90015" });
    expect(r.valid).toBe(true);
    expect(r.delivery_point_validation).toBe("Y");
    expect(r.normalized).toEqual({
      street: "1100 S BROADWAY",
      city: "LOS ANGELES",
      state: "CA",
      zip5: "90015",
      zip4: "2353",
    });
  });

  it("marks DPV=N as invalid and surfaces warnings", async () => {
    const c = client([
      { match: (req) => req.url.endsWith("/oauth2/v3/token"), fixture: "usps/token.json" },
      { match: (req) => req.url.includes("/addresses/v3/address"), fixture: "usps/validate-undeliverable.json" },
    ]);
    const r = await c.validate({ street: "9999 Nowhere St", city: "Los Angeles", state: "CA", zip: "90015" });
    expect(r.valid).toBe(false);
    expect(r.delivery_point_validation).toBe("N");
    expect(r.warnings).toContain("DPV did not confirm delivery point");
  });

  it("treats DPV=S (secondary missing) as not fully valid but normalized", async () => {
    const c = client([
      { match: (req) => req.url.endsWith("/oauth2/v3/token"), fixture: "usps/token.json" },
      { match: (req) => req.url.includes("/addresses/v3/address"), fixture: "usps/validate-secondary-missing.json" },
    ]);
    const r = await c.validate({ street: "1 Main St", city: "Springfield", state: "MA", zip: "01103" });
    expect(r.valid).toBe(false);
    expect(r.delivery_point_validation).toBe("S");
    expect(r.normalized?.zip5).toBe("01103");
  });

  it("rejects malformed input at the Zod boundary", async () => {
    const c = client([]);
    await expect(
      c.validate({ street: "X", city: "Y", state: "California", zip: "abc" }),
    ).rejects.toThrow();
  });
});
