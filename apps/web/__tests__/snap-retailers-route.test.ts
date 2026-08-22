// The ZIP is interpolated into an ArcGIS where-clause, so its validation is the
// security boundary of this route — not a convenience check.
import { describe, expect, it, vi, afterEach } from "vitest";
import { GET } from "../app/api/snap-retailers/route";

const call = (zip: string) => GET(new Request(`http://x/api/snap-retailers?zip=${zip}`));

afterEach(() => vi.unstubAllGlobals());

function stubService(payload: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => payload,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ZIP validation is the boundary", () => {
  it.each([
    ["", "empty"],
    ["9411", "four digits"],
    ["941100", "six digits"],
    ["9411a", "letter"],
    ["94110' OR '1'='1", "quote break-out"],
    ["../../etc", "path"],
  ])("rejects %s (%s) without calling the service", async (zip) => {
    const fetchMock = stubService({});
    const res = await call(encodeURIComponent(zip));
    expect(res.status).toBe(400);
    // The point: nothing malformed ever reaches the query string.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts exactly five digits and quotes them into the where-clause", async () => {
    const fetchMock = stubService({ features: [] });
    const res = await call("94110");
    expect(res.status).toBe(200);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(decodeURIComponent(url)).toContain("Zip_Code='94110'");
  });
});

describe("results", () => {
  it("maps the service's fields onto the shape the UI renders", async () => {
    stubService({
      features: [
        {
          attributes: {
            Store_Name: "Ray Market And Deli Inc",
            Store_Street_Address: "2898 Folsom St",
            City: "San Francisco",
            State: "CA",
            Zip_Code: "94110",
            Store_Type: "Convenience Store",
            Latitude: 37.751026,
            Longitude: -122.41426,
          },
        },
      ],
    });
    const body = (await (await call("94110")).json()) as {
      stores: { name: string; type: string; lat: number | null }[];
    };
    expect(body.stores).toHaveLength(1);
    expect(body.stores[0]).toMatchObject({
      name: "Ray Market And Deli Inc",
      type: "Convenience Store",
      lat: 37.751026,
    });
  });

  it("reports a FAILED lookup distinctly from an empty one", async () => {
    // Telling someone there is nowhere near them to shop, when in fact the
    // lookup broke, is the worst way for this to fail.
    stubService({ error: { code: 500 } });
    const res = await call("94110");
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("unavailable");
  });

  it("survives a service that returns nonsense", async () => {
    stubService({ features: [{ attributes: {} }] });
    const body = (await (await call("94110")).json()) as { stores: { name: string }[] };
    expect(body.stores[0].name).toBe("");
  });
});
